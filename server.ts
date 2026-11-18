import express from 'express';
import fs from 'fs';
import path from 'path';
import { store } from './server/store.js';
import {
  buildDatabaseWorkbookBuffer,
  buildDatabaseWorkbookSpec,
  buildPersonalLoginWorkbookBuffer,
  buildPersonalLoginWorkbookSpec,
  loadAuthenticPutraRoster,
  type TemplateContext,
} from './server/templates.js';
import type { Gender, PresensiType, StatusTindakLanjut, TeacherPublic, UserRole, WilayahFilter } from './src/types';

export const app = express();
app.use(express.json({ limit: '15mb' }));

function registerApiRoutes() {
  // ==============================================================
  // API ROUTES — PINTAR TERINTEGRASI & PEMBINAAN WALI KELAS
  // ==============================================================

  app.get('/api/bootstrap', (_req, res) => {
    const teachers = store.getPublicTeachers('Semua', 'Semua');
    const options = store.getOptionsLaporan();
    const stats = store.getDashboardStats();
    const quota = store.getQuotaMetrics();
    const counts = store.getSystemCounts();
    const rooms = store.getAllRooms();
    res.json({ teachers, options, stats, quota, counts, rooms });
  });

  // AUTH & ACCOUNT MANAGEMENT (GURU, WALI KELAS, MUSYRIF, MUSYRIFAH, ADMIN SIM)
  app.post('/api/auth/login', (req, res) => {
    const { identifier, namaGuru, pin } = req.body;
    const result = store.verifyTeacherPin(String(identifier || namaGuru || ''), String(pin || ''));
    if (!result.ok) return res.status(401).json(result);
    res.json(result);
  });

  app.post('/api/auth/register', (req, res) => {
    const safeBody = {
      ...req.body,
      peran: req.body?.peran === 'Admin Super' ? 'Guru' : req.body?.peran,
    };
    const result = store.registerTeacherAccount(safeBody);
    if (!result.ok) return res.status(400).json(result);
    res.json({ ...result, counts: store.getSystemCounts() });
  });

  app.post('/api/guru/verify', (req, res) => {
    const { namaGuru, identifier, pin } = req.body;
    const result = store.verifyTeacherPin(String(identifier || namaGuru || ''), String(pin || ''));
    if (!result.ok) return res.status(401).json(result);
    res.json(result);
  });

  app.put('/api/guru/:id', (req, res) => {
    const updated = store.updateTeacherAccount(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    res.json({ teacher: updated });
  });

  app.delete('/api/guru/:id', (req, res) => {
    const result = store.deleteTeacherAccount(req.params.id);
    if (!result.deleted) return res.status(400).json({ error: result.error || 'Gagal menghapus akun.' });
    res.json({ deleted: true, counts: store.getSystemCounts() });
  });

  app.get('/api/guru/rekap', (req, res) => {
    const namaGuru = String(req.query.namaGuru || req.query.username || req.query.id || '');
    const tanggal = String(req.query.tanggal || '');
    let recap = store.getTeacherPersonalRecap(namaGuru, tanggal);
    if (!recap && req.query.username) {
      recap = store.getTeacherPersonalRecap(String(req.query.username), tanggal);
    }
    if (!recap && req.query.id) {
      recap = store.getTeacherPersonalRecap(String(req.query.id), tanggal);
    }
    if (!recap) return res.status(404).json({ error: 'Akun guru tidak ditemukan.' });
    res.json(recap);
  });

  app.post('/api/guru/import-personal', (req, res) => {
    const body = req.body || {};
    if (!body.teacherName) {
      return res.status(400).json({ error: 'Akun login pembina tidak dikenali.' });
    }
    const hasData =
      (Array.isArray(body.santriRows) && body.santriRows.length > 0) ||
      (Array.isArray(body.scheduleRows) && body.scheduleRows.length > 0) ||
      (Array.isArray(body.pembinaanRows) && body.pembinaanRows.length > 0);
    if (!hasData) {
      return res.status(400).json({ error: 'Tidak ada data santri, jadwal, atau pembinaan untuk disimpan.' });
    }
    const result = store.importPersonalByTeacher(body);
    if (!result.ok) {
      return res.status(404).json({ error: result.error });
    }
    res.json({ ...result, counts: store.getSystemCounts(), quota: store.getQuotaMetrics() });
  });

  // JADWAL PEMBELAJARAN MANDIRI (GURU MEMBUAT & MENGUBAH JADWAL SENDIRI + CLASH DETECTION)
  app.get('/api/jadwal', (req, res) => {
    const guru = req.query.guru ? String(req.query.guru) : undefined;
    const hari = req.query.hari ? String(req.query.hari) : undefined;
    const gender = req.query.gender ? String(req.query.gender) : undefined;
    res.json(store.getSchedulesList({ guru, hari, gender }));
  });

  app.post('/api/jadwal/check-clash', (req, res) => {
    const { excludeId, guru, hari, kelas, jamKe } = req.body || {};
    const clash = store.checkScheduleClash({
      excludeId: excludeId ? String(excludeId) : undefined,
      guru: String(guru || ''),
      hari: String(hari || ''),
      kelas: String(kelas || ''),
      jamKe: String(jamKe || ''),
    });
    res.json(clash);
  });

  app.post('/api/jadwal', (req, res) => {
    const { guru, hari, kelas, mapel, jamKe, gender, allowOverride } = req.body;
    if (!guru || !hari || !kelas || !mapel || !jamKe || !gender) {
      return res.status(400).json({ error: 'Lengkapi Guru, Hari, Kelas/Halaqah, Mapel, Jam, dan Gender.' });
    }
    const clash = store.checkScheduleClash({
      guru: String(guru),
      hari: String(hari),
      kelas: String(kelas),
      jamKe: String(jamKe),
    });
    if (clash.hasClash && !allowOverride) {
      return res.status(409).json({
        error: clash.message || 'Jadwal bentrok dengan jadwal lain.',
        clash,
      });
    }
    const created = store.createSchedule(req.body);
    res.json({ schedule: created, clash, counts: store.getSystemCounts() });
  });

  app.put('/api/jadwal/:id', (req, res) => {
    const { guru, hari, kelas, jamKe, allowOverride } = req.body || {};
    if (guru && hari && kelas && jamKe) {
      const clash = store.checkScheduleClash({
        excludeId: req.params.id,
        guru: String(guru),
        hari: String(hari),
        kelas: String(kelas),
        jamKe: String(jamKe),
      });
      if (clash.hasClash && !allowOverride) {
        return res.status(409).json({
          error: clash.message || 'Perubahan jadwal menyebabkan bentrok.',
          clash,
        });
      }
    }
    const updated = store.updateSchedule(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
    res.json({ schedule: updated });
  });

  app.delete('/api/jadwal/:id', (req, res) => {
    const ok = store.deleteSchedule(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
    res.json({ deleted: true, counts: store.getSystemCounts() });
  });

  // KELOLA & PINDAH KELAS SISWA (KOREKSI DATA OLEH GURU / ADMIN)
  app.get('/api/students', (req, res) => {
    const gender = req.query.gender ? String(req.query.gender) : undefined;
    const kelas = req.query.kelas ? String(req.query.kelas) : undefined;
    const q = req.query.q ? String(req.query.q) : undefined;
    res.json(store.getStudentsDirectory({ gender, kelas, q }));
  });

  app.put('/api/students/:id', (req, res) => {
    const updated = store.updateStudentById(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Data santri tidak ditemukan.' });
    res.json({ student: updated, counts: store.getSystemCounts() });
  });

  app.delete('/api/students/:id', (req, res) => {
    const ok = store.deleteStudentById(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Data santri tidak ditemukan.' });
    res.json({ deleted: true, counts: store.getSystemCounts() });
  });

  app.post('/api/students/move-class', (req, res) => {
    const { studentIds, targetKelas, targetKamar, targetKelompok, targetGender } = req.body || {};
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal 1 siswa yang akan dipindahkan.' });
    }
    if (!targetKelas && !targetKamar && !targetKelompok && !targetGender) {
      return res.status(400).json({ error: 'Isi minimal kelas, kamar, kelompok, atau wilayah tujuan.' });
    }
    const result = store.moveStudentsClass({
      studentIds,
      targetKelas,
      targetKamar,
      targetKelompok,
      targetGender,
    });
    res.json({ ...result, counts: store.getSystemCounts() });
  });

  // KAMAR & MUSYRIF/MUSYRIFAH MAPPING
  app.get('/api/rooms', (_req, res) => {
    res.json(store.getAllRooms());
  });

  app.post('/api/rooms', (req, res) => {
    const { kamar, musyrif, gender } = req.body;
    if (!kamar || !musyrif || !gender) {
      return res.status(400).json({ error: 'Nama kamar, nama musyrif/ah, dan gender wajib diisi.' });
    }
    const room = store.assignRoomMusyrif({ kamar, musyrif, gender });
    res.json({ room, counts: store.getSystemCounts() });
  });

  app.delete('/api/rooms', (req, res) => {
    const kamar = String(req.query.kamar || '');
    const ok = store.deleteRoomMapping(kamar);
    if (!ok) return res.status(404).json({ error: 'Kamar tidak ditemukan.' });
    res.json({ deleted: true });
  });

  // IMPORT & FORMAT SIM (CSV / EXCEL PASTE)
  app.post('/api/import/santri-sim', (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada baris santri valid untuk diimpor.' });
    }
    const result = store.importSantriSim(req.body);
    res.json({ ...result, counts: store.getSystemCounts(), quota: store.getQuotaMetrics() });
  });

  app.post('/api/import/pembinaan-master', (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada baris master pembinaan valid.' });
    }
    const result = store.importPembinaanMaster(req.body);
    res.json({ ...result, counts: store.getSystemCounts(), quota: store.getQuotaMetrics() });
  });

  app.post('/api/import/jadwal', (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada baris jadwal valid.' });
    }
    const result = store.importSchedulesBulk(req.body);
    res.json({ ...result, counts: store.getSystemCounts(), quota: store.getQuotaMetrics() });
  });

  app.post('/api/import/guru', (req, res) => {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Tidak ada baris akun guru/musyrif valid.' });
    }
    const result = store.importTeachersBulk(req.body);
    res.json({ ...result, counts: store.getSystemCounts(), quota: store.getQuotaMetrics() });
  });

  app.post('/api/import/ruangan-ujian', (req, res) => {
    const { namaRuang } = req.body;
    if (!namaRuang) return res.status(400).json({ error: 'Nama ruangan ujian wajib diisi.' });
    const list = store.addRuanganUjian(String(namaRuang));
    res.json({ ruanganUjian: list });
  });

  app.put('/api/import/ruangan-ujian', (req, res) => {
    const { oldName, newName } = req.body || {};
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Nama ruangan lama dan baru wajib diisi.' });
    }
    const list = store.updateRuanganUjian(String(oldName), String(newName));
    res.json({ ruanganUjian: list });
  });

  app.delete('/api/import/ruangan-ujian', (req, res) => {
    const namaRuang = String(req.query.namaRuang || req.body?.namaRuang || '');
    if (!namaRuang) return res.status(400).json({ error: 'Nama ruangan wajib diisi.' });
    const list = store.deleteRuanganUjian(namaRuang);
    res.json({ ruanganUjian: list });
  });

  app.post('/api/import/all-in-one', (req, res) => {
    try {
      const body = req.body || {};
      const hasAnyData =
        (Array.isArray(body.santriRows) && body.santriRows.length > 0) ||
        (Array.isArray(body.teacherRows) && body.teacherRows.length > 0) ||
        (Array.isArray(body.scheduleRows) && body.scheduleRows.length > 0) ||
        (Array.isArray(body.ruanganUjian) && body.ruanganUjian.length > 0) ||
        (Array.isArray(body.pembinaanRows) && body.pembinaanRows.length > 0);

      if (!hasAnyData) {
        return res.status(400).json({ error: 'File Excel tidak berisi baris data valid untuk diimpor.' });
      }

      const result = store.importAllInOne(body);
      return res.json({ ...result, counts: store.getSystemCounts(), quota: store.getQuotaMetrics() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Gagal memproses import data Excel.' });
    }
  });

  app.post('/api/system/reset-empty', (_req, res) => {
    const counts = store.resetDatabaseEmpty();
    res.json({ ok: true, counts });
  });

  app.get('/api/system/snapshot', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(store.getFullSnapshot());
  });

  app.post('/api/system/restore-snapshot', (req, res) => {
    try {
      const { snapshot, mode } = req.body || {};
      if (!snapshot || typeof snapshot !== 'object') {
        return res.status(400).json({ error: 'Payload snapshot diperlukan untuk memulihkan data.' });
      }
      const result = store.restoreSnapshot(snapshot, mode === 'replace' ? 'replace' : 'merge');
      if (!result.ok) {
        return res.status(400).json(result);
      }
      return res.json({ ...result, quota: store.getQuotaMetrics() });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Gagal memulihkan snapshot data.' });
    }
  });

  // TEMPLATE DATABASE EXCEL TERPADU (.XLSX)
  const getTemplateContext = (): TemplateContext => ({
    students: store.getStudentsByFilter(),
    rooms: store.getAllRooms(),
    teachers: store.getPublicTeachers('Semua', 'Semua'),
    schedules: store.getSchedulesList(),
    ruanganUjian: store.getOptionsLaporan().ruanganUjian,
  });

  app.get('/api/templates/workbook-data', (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(buildDatabaseWorkbookSpec(getTemplateContext()));
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Gagal menyusun data template terpadu.' });
    }
  });

  app.post('/api/templates/commit-master', (req, res) => {
    try {
      const { defaultPin, autoCreateAccounts, autoCreateQuranSchedules } = req.body || {};
      const ctx = getTemplateContext();
      const authenticPutra = loadAuthenticPutraRoster();

      // Never wipe or overwrite existing students/logs/schedules; only seed missing authentic roster items if empty or fill missing relations
      const santriRows =
        ctx.students.length === 0
          ? authenticPutra.map((r) => ({
              nis: r.no,
              nama: r.nama,
              kelas: r.kelas,
              kamar: r.kamar,
              kelompokQuran: r.kelompokQuran,
              pengampuQuran: r.pengampuQuran,
              gender: 'Putra' as Gender,
            }))
          : [];

      const defaultRuangUjian =
        ctx.ruanganUjian && ctx.ruanganUjian.length > 0
          ? []
          : [
              'RUANG 01 PUTRA - AL-GHAZALI',
              'RUANG 02 PUTRA - IBNU SINA',
              'RUANG 01 PUTRI - KHADIJAH',
              'RUANG 02 PUTRI - AISYAH',
            ];

      const result = store.importAllInOne({
        santriRows,
        ruanganUjian: defaultRuangUjian,
        replaceExisting: false,
        autoCreateAccounts: autoCreateAccounts ?? true,
        autoCreateQuranSchedules: autoCreateQuranSchedules ?? true,
        defaultPin: String(defaultPin || '1234'),
      });

      return res.json({
        ok: true,
        ...result,
        counts: store.getSystemCounts(),
        quota: store.getQuotaMetrics(),
      });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Gagal mengambil & menyimpan data template terpadu.' });
    }
  });

  app.get('/api/templates/xlsx', (_req, res) => {
    try {
      const built = buildDatabaseWorkbookBuffer(getTemplateContext());
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`);
      res.setHeader('Content-Length', String(built.buffer.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.end(built.buffer);
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Gagal membuat file Excel template.' });
    }
  });

  const resolveTeacherForPersonalTemplate = (req: express.Request): TeacherPublic | null => {
    const namaGuru = String(req.query.namaGuru || '').trim();
    const username = String(req.query.username || '').trim();
    const id = String(req.query.id || '').trim();

    const found =
      (namaGuru ? store.getTeacherByIdentifier(namaGuru) : null) ||
      (username ? store.getTeacherByIdentifier(username) : null) ||
      (id ? store.getTeacherByIdentifier(id) : null);
    if (found) return found;

    // Synthesize safe fallback from active session query params so template generation never fails on cold start
    const displayName = namaGuru || username || 'GURU PEMBINA';
    const rawPeran = String(req.query.peran || 'Guru') as UserRole;
    const validRoles = new Set<UserRole>(['Guru', 'Wali Kelas', 'Musyrif', 'Musyrifah', 'Admin SIM', 'Admin Super', 'Pengampu Al-Quran']);
    const peran: UserRole = validRoles.has(rawPeran) ? rawPeran : 'Guru';
    const rawScope = String(req.query.genderScope || 'Semua');
    const genderScope: 'Putra' | 'Putri' | 'Semua' =
      rawScope === 'Putra' || rawScope === 'Putri' ? rawScope : 'Semua';
    const waliKelasOf = String(req.query.waliKelasOf || '').trim() || undefined;
    const kamarBinaanRaw = String(req.query.kamarBinaan || '').trim();
    const kamarBinaan = kamarBinaanRaw
      ? kamarBinaanRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      : undefined;

    return {
      id: id || `GURU-TMP-${Date.now()}`,
      nama: displayName.toUpperCase(),
      jabatan: peran,
      peran,
      genderScope,
      waliKelasOf,
      kamarBinaan,
      username:
        username ||
        displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.|\.$/g, '') ||
        'guru',
      whatsapp: '',
    };
  };

  app.get('/api/templates/personal-data', (req, res) => {
    try {
      const teacher = resolveTeacherForPersonalTemplate(req);
      if (!teacher) return res.status(400).json({ error: 'Identitas akun pembina diperlukan.' });
      res.setHeader('Cache-Control', 'no-store');
      return res.json(buildPersonalLoginWorkbookSpec(getTemplateContext(), teacher));
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Gagal menyusun template login personal.' });
    }
  });

  app.get('/api/templates/personal-xlsx', (req, res) => {
    try {
      const teacher = resolveTeacherForPersonalTemplate(req);
      if (!teacher) return res.status(400).json({ error: 'Identitas akun pembina diperlukan.' });
      const built = buildPersonalLoginWorkbookBuffer(getTemplateContext(), teacher);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${built.filename}"`);
      res.setHeader('Content-Length', String(built.buffer.length));
      res.setHeader('Cache-Control', 'no-store');
      return res.end(built.buffer);
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message || 'Gagal mengunduh template login personal.' });
    }
  });

  // PRESENSI HARIAN
  app.get('/api/presensi/teachers', (req, res) => {
    const jenis = String(req.query.jenis || 'Semua');
    const gender = String(req.query.gender || 'Semua');
    res.json(store.getPublicTeachers(jenis, gender));
  });

  app.get('/api/presensi/opsi', (req, res) => {
    const jenis = String(req.query.jenis || 'Asrama') as PresensiType;
    const gender = String(req.query.gender || 'Putri') as Gender;
    const guru = String(req.query.guru || '');
    const hari = String(req.query.hari || '');

    if (jenis === 'Asrama') {
      const rooms = store.getKamarMusyrif(guru, gender);
      return res.json({ rooms });
    }
    const jadwal = store.getJadwal(hari, guru, gender).filter((j) =>
      jenis === 'Al-Quran'
        ? j.mapel.toUpperCase().includes('QUR') || j.mapel.toUpperCase().includes('TAHFIDZ') || j.mapel.toUpperCase().includes('TAHSIN')
        : !j.mapel.toUpperCase().includes('QUR')
    );
    return res.json({ jadwal });
  });

  app.get('/api/presensi/siswa', (req, res) => {
    const tanggal = String(req.query.tanggal || '');
    const guru = String(req.query.guru || '');
    const targetGrup = String(req.query.targetGrup || '');
    const mapel = String(req.query.mapel || '');
    const jenisPresensi = String(req.query.jenisPresensi || 'Asrama') as PresensiType;
    const gender = String(req.query.gender || 'Putri') as Gender;

    const data = store.getSiswaForm({ tanggal, guru, targetGrup, mapel, jenisPresensi, gender });
    res.json(data);
  });

  app.post('/api/presensi/simpan', (req, res) => {
    const { jenisPresensi, gender, tanggal, guru, kelas, mapel, materi, siswa } = req.body;
    if (!guru || !kelas || !tanggal || !Array.isArray(siswa)) {
      return res.status(400).json({ error: 'Data presensi tidak lengkap.' });
    }
    const result = store.simpanAbsen({
      jenisPresensi,
      gender,
      tanggal,
      guru,
      kelas,
      mapel: mapel || 'KELUAR ASRAMA',
      materi,
      siswa,
    });
    res.json({ ...result, quota: store.getQuotaMetrics() });
  });

  // UJIAN
  app.get('/api/ujian/siswa', (req, res) => {
    const tanggal = String(req.query.tanggal || '');
    const kelas = String(req.query.kelas || '');
    const mapel = String(req.query.mapel || '');
    const gender = String(req.query.gender || 'Putri') as Gender;
    res.json(store.getSiswaUjianForm({ tanggal, kelas, mapel, gender }));
  });

  app.post('/api/ujian/simpan', (req, res) => {
    const result = store.simpanAbsenUjian(req.body);
    res.json({ ...result, quota: store.getQuotaMetrics() });
  });

  app.get('/api/ujian/riwayat', (req, res) => {
    const tanggal = String(req.query.tanggal || '');
    const gender = String(req.query.gender || 'Putri') as Gender;
    res.json(store.getUjianRiwayatDanSusulan(tanggal, gender));
  });

  // PIKET & INVAL
  app.get('/api/piket', (req, res) => {
    const tanggal = String(req.query.tanggal || '');
    res.json(store.getPiketHariIni(tanggal));
  });

  app.post('/api/piket/simpan', (req, res) => {
    const { tanggal, namaGuru, status, keterangan } = req.body;
    if (!tanggal || !namaGuru) return res.status(400).json({ error: 'Harap pilih tanggal dan nama guru.' });
    res.json(store.simpanGuruAbsen({ tanggal, namaGuru, status, keterangan: keterangan || '' }));
  });

  app.get('/api/piket/broadcast', (req, res) => {
    const tanggal = String(req.query.tanggal || '');
    const gender = String(req.query.gender || 'Putri') as Gender;
    res.json({ text: store.getBroadcastHarian(tanggal, gender) });
  });

  app.get('/api/inval', (req, res) => {
    const tanggal = String(req.query.tanggal || '');
    const jam = String(req.query.jam || '');
    const gender = String(req.query.gender || 'SEMUA');
    const jenjang = String(req.query.jenjang || 'SEMUA');
    res.json(store.getGuruKosong(tanggal, jam, gender, jenjang));
  });

  // MONITORING & LAPORAN
  app.get('/api/monitoring', (req, res) => {
    const tanggal = String(req.query.tanggal || '');
    res.json(store.getMonitoringData(tanggal));
  });

  app.get('/api/stats', (req, res) => {
    const wilayah = (req.query.wilayah ? String(req.query.wilayah) : 'Semua') as WilayahFilter;
    res.json(store.getDashboardStats(wilayah));
  });

  app.get('/api/analisis', (req, res) => {
    const tanggal = req.query.tanggal ? String(req.query.tanggal) : undefined;
    res.json(store.getAnalyticsTerpadu(tanggal));
  });

  app.get('/api/laporan', (req, res) => {
    const jenis = String(req.query.jenis || 'social');
    const param1 = String(req.query.param1 || '');
    const param2 = String(req.query.param2 || '');
    const semester = String(req.query.semester || 'Ganjil (Jul-Des)');
    const divisi = String(req.query.divisi || 'Akademik');
    const wilayah = (req.query.wilayah ? String(req.query.wilayah) : 'Semua') as WilayahFilter;
    res.json(store.getReportData({ jenis, param1, param2, semester, divisi, wilayah }));
  });

  app.get('/api/laporan/siswa-by-group', (req, res) => {
    const group = String(req.query.group || '');
    const divisi = String(req.query.divisi || 'Akademik');
    const wilayah = (req.query.wilayah ? String(req.query.wilayah) : 'Semua') as WilayahFilter;
    res.json(store.getSiswaByGroup(group, divisi, wilayah));
  });

  app.get('/api/laporan/ringkasan-bulanan', (req, res) => {
    const bulan = req.query.bulan ? String(req.query.bulan) : 'SEMUA';
    const wilayah = (req.query.wilayah ? String(req.query.wilayah) : 'Semua') as WilayahFilter;
    const kelas = req.query.kelas ? String(req.query.kelas) : 'SEMUA';
    res.json(store.getMonthlyWaliKelasSummary({ bulan, wilayah, kelas }));
  });

  // PEMBINAAN TERPADU (WALI KELAS, MUSYRIF, MUSYRIFAH, GURU)
  app.get('/api/pembinaan/students', (req, res) => {
    const rawGender = req.query.gender ? String(req.query.gender) : '';
    const gender = rawGender && rawGender !== 'Semua' ? (rawGender as Gender) : undefined;
    const kelas = req.query.kelas ? String(req.query.kelas) : undefined;
    const kamar = req.query.kamar ? String(req.query.kamar) : undefined;
    res.json(store.getStudentsByFilter(gender, kelas, kamar));
  });

  app.put('/api/pembinaan/student-profile', (req, res) => {
    const { namaSantri, updates } = req.body;
    if (!namaSantri) return res.status(400).json({ error: 'Nama santri diperlukan.' });
    const student = store.updateStudentProfile(String(namaSantri), updates || {});
    if (!student) return res.status(404).json({ error: 'Santri tidak ditemukan.' });
    res.json({ student });
  });

  app.get('/api/pembinaan/list', (req, res) => {
    const gender = (req.query.gender || req.query.wilayah || 'Semua') as WilayahFilter;
    const kelas = req.query.kelas ? String(req.query.kelas) : undefined;
    const kamar = req.query.kamar ? String(req.query.kamar) : undefined;
    const santri = req.query.santri ? String(req.query.santri) : undefined;
    const pekanKe = req.query.pekanKe ? Number(req.query.pekanKe) : undefined;
    const statusTindakLanjut = req.query.statusTindakLanjut
      ? (String(req.query.statusTindakLanjut) as StatusTindakLanjut)
      : undefined;
    const pembinaPeran = req.query.pembinaPeran ? String(req.query.pembinaPeran) : undefined;
    res.json(store.getPembinaanList({ gender, kelas, kamar, santri, pekanKe, statusTindakLanjut, pembinaPeran }));
  });

  app.get('/api/pembinaan/portfolio', (req, res) => {
    const santri = String(req.query.santri || '');
    if (!santri) return res.status(400).json({ error: 'Nama santri wajib dipilih.' });
    res.json(store.getPortfolioSantri(santri));
  });

  app.post('/api/pembinaan/simpan', (req, res) => {
    const rec = store.savePembinaanRecord(req.body);
    res.json({ record: rec, quota: store.getQuotaMetrics(), counts: store.getSystemCounts() });
  });

  app.post('/api/pembinaan/batch', (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Minimal satu catatan santri diperlukan.' });
    }
    const result = store.savePembinaanBatch(records);
    res.json({ ...result, quota: store.getQuotaMetrics(), counts: store.getSystemCounts() });
  });

  app.patch('/api/pembinaan/:id/status', (req, res) => {
    const { statusTindakLanjut, tindakLanjut } = req.body;
    const updated = store.updatePembinaanStatus(req.params.id, statusTindakLanjut, tindakLanjut);
    if (!updated) return res.status(404).json({ error: 'Catatan pembinaan tidak ditemukan.' });
    res.json({ record: updated });
  });

  app.delete('/api/pembinaan/:id', (req, res) => {
    const ok = store.deletePembinaanRecord(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Data tidak ditemukan.' });
    res.json({ deleted: true, counts: store.getSystemCounts() });
  });

  // QUOTA METRICS, FIREBASE CLOUD SYNC & OPTIONAL GAS BRIDGE
  app.post('/api/auth/google', (req, res) => {
    const { email, displayName, requireAdmin } = req.body || {};
    const result = store.verifyGoogleLogin({
      email: String(email || ''),
      displayName: displayName ? String(displayName) : undefined,
      requireAdmin: Boolean(requireAdmin),
    });
    if (!result.ok) return res.status(401).json(result);
    res.json({ ...result, counts: store.getSystemCounts() });
  });

  app.get('/api/firebase/snapshot', (_req, res) => {
    res.json(store.getCloudSnapshot());
  });

  app.post('/api/firebase/mark-synced', (_req, res) => {
    res.json(store.markSynced());
  });

  app.get('/api/quota-metrics', (_req, res) => {
    res.json(store.getQuotaMetrics());
  });

  app.post('/api/settings/gas-bridge', (req, res) => {
    const { gasBridgeUrl } = req.body;
    res.json(store.updateGasBridge(String(gasBridgeUrl || '')));
  });

  app.post('/api/settings/gas-sync-test', async (req, res) => {
    const { gasBridgeUrl } = req.body;
    const url = String(gasBridgeUrl || store.getQuotaMetrics().gasBridgeUrl).trim();
    if (!url || !url.startsWith('https://script.google.com/')) {
      return res.status(400).json({
        error: 'Masukkan URL Google Apps Script Web App yang valid (dimulai dengan https://script.google.com/...).',
      });
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ functionName: 'getDashboardStats', args: [] }),
      });
      if (!response.ok) {
        return res.status(502).json({ error: `GAS merespons status ${response.status}` });
      }
      const metrics = store.markSynced();
      res.json({ ok: true, metrics, message: 'Sinkronisasi batch dengan Google Apps Script berhasil.' });
    } catch (err) {
      res.status(502).json({ error: `Gagal terhubung ke GAS Web App: ${(err as Error).message}` });
    }
  });

  // ==============================================================
  // PORTAL WALI MURID (READ-ONLY VIA NIS & TANGGAL LAHIR)
  // ==============================================================
  app.get('/api/parent-portal/samples', (_req, res) => {
    const allStudents = store.getStudentsByFilter();
    const samples = allStudents.slice(0, 8).map((s) => ({
      nis: s.nis || s.id,
      nama: s.nama,
      kelas: s.kelas,
      kamar: s.kamar,
      gender: s.gender,
      tanggalLahir: s.tanggalLahir || '2009-05-12',
    }));
    res.json({ samples });
  });

  app.post('/api/parent-portal/lookup', (req, res) => {
    const { nisOrName, tanggalLahir } = req.body || {};
    const result = store.getParentPortalStudentPortfolio({
      nisOrName: String(nisOrName || ''),
      tanggalLahir: tanggalLahir ? String(tanggalLahir) : undefined,
    });
    if (!result.ok) {
      return res.status(404).json(result);
    }
    res.json(result);
  });

  // ==============================================================
  // WHATSAPP GATEWAY AUTOMATION (FONNTE / WABLAS / BAILEYS)
  // ==============================================================
  app.get('/api/whatsapp/dashboard', (_req, res) => {
    res.json(store.getWhatsAppDashboard());
  });

  app.post('/api/whatsapp/config', (req, res) => {
    const config = store.updateWhatsAppConfig(req.body || {});
    res.json({ ok: true, config });
  });

  app.post('/api/whatsapp/send-test', (req, res) => {
    const { namaSantri, kelas, nomorTujuan, recipientPhone, triggerType, pesan, message } = req.body || {};
    const entry = store.recordWhatsAppTrigger({
      triggerType: triggerType === 'ESKALASI_PEMBINAAN' ? 'ESKALASI_PEMBINAAN' : 'BROADCAST_MANUAL',
      namaSantri: String(namaSantri || 'SANTRI CONTOH'),
      kelas: String(kelas || 'X-A'),
      nomorTujuan: String(nomorTujuan || recipientPhone || '6281234567890'),
      pesan:
        String(pesan || message || '') ||
        '[SIM PINTAR] Uji coba koneksi WhatsApp Gateway berhasil terhubung ke nomor Wali Santri.',
    });
    res.json({ ok: true, entry, dashboard: store.getWhatsAppDashboard() });
  });

  // ==============================================================
  // CLOUD STORAGE LAMPIRAN (SURAT SAKIT / SERTIFIKAT / BUKTI)
  // ==============================================================
  app.get('/api/attachments', (req, res) => {
    const namaSantri = req.query.namaSantri ? String(req.query.namaSantri) : undefined;
    res.json(store.getCloudAttachments(namaSantri));
  });

  app.post('/api/attachments', (req, res) => {
    const {
      namaSantri,
      kelas,
      kategori,
      kategoriLampiran,
      fileName,
      mimeType,
      fileSizeKb,
      sizeBytes,
      dataUrl,
      url,
      uploadedBy,
    } = req.body || {};
    const finalUrl = String(url || dataUrl || '');
    if (!namaSantri || !fileName || !finalUrl) {
      return res.status(400).json({ error: 'Nama santri, nama file, dan data lampiran wajib diisi.' });
    }
    const item = store.saveCloudAttachment({
      namaSantri: String(namaSantri),
      kelas: String(kelas || '-'),
      kategoriLampiran: kategoriLampiran || kategori || 'Lainnya',
      fileName: String(fileName),
      mimeType: String(mimeType || 'image/jpeg'),
      sizeBytes: Number(sizeBytes || (fileSizeKb ? Number(fileSizeKb) * 1024 : 65536)),
      url: finalUrl,
      uploadedBy: String(uploadedBy || 'Guru Pembina'),
    });
    res.json({ ok: true, attachment: item });
  });

  // ==============================================================
  // DASBOR PENGAMPU AL-QUR'AN (REKAP HALAQAH, ZIYADAH, TILAWAH & MURAJAAH)
  // ==============================================================
  app.get('/api/halaqah/rekap', (req, res) => {
    const guru = req.query.guru ? String(req.query.guru) : undefined;
    const kelompok = req.query.kelompok ? String(req.query.kelompok) : undefined;
    const gender = req.query.gender ? (String(req.query.gender) as Gender | 'Semua') : 'Semua';
    res.json(store.getQuranHalaqahRecap({ guru, kelompok, gender }));
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan internal server.';
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  });
}

registerApiRoutes();

async function startServer() {
  // ==============================================================
  // VITE / STATIC SERVING
  // ==============================================================
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distPath)) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PINTAR Terpadu server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}

export default app;
