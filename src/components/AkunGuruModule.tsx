import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Home,
  KeyRound,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { Gender, ScheduleItem, TeacherAbsenceLog, TeacherPublic } from '../types';
import { downloadCsv, formatTanggalIndo, getTodayDateStr } from '../utils/exportHelpers';
import {
  downloadComponentExcelTemplate,
  parseDatabaseExcelBuffer,
  triggerExcelDownloadFromSpec,
  type DatabaseWorkbookSpec,
  type ParsedDatabaseWorkbook,
} from '../utils/excelParser';

interface TeacherRecapResponse {
  teacher: TeacherPublic;
  totalSessions: number;
  todaySessions: number;
  examSessionsCount: number;
  sessions: Array<{
    tanggal: string;
    jenisPresensi: string;
    kelas: string;
    mapel: string;
    materi: string;
    totalSiswa: number;
    hadir: number;
    tidakHadir: number;
    timestamp: string;
  }>;
  allMySchedules: ScheduleItem[];
  todaySchedules: Array<{
    id: string;
    kelas: string;
    mapel: string;
    jamKe: string;
    filled: boolean;
  }>;
  myRooms: Array<{
    kamar: string;
    musyrif: string;
    gender?: string;
    filled: boolean;
  }>;
  myAbsences: TeacherAbsenceLog[];
  waliStudents: Array<{ id: string; nama: string; kelas: string; kamar: string }>;
  waliPembinaanCount: number;
  waliProgress: {
    kelasBinaan: string;
    totalSantri: number;
    santriSudahDibina: number;
    kasusProsesEskalasi: number;
    rataSholatWajibPct: number;
    rataSholatSunnahPct: number;
    santriProgress: Array<{
      nama: string;
      kelas: string;
      kamar: string;
      prioritas: string;
      totalPembinaan: number;
      netPoin: number;
      statusTerakhir: string;
      lastTanggal: string;
      absenSakit: number;
      absenIzin: number;
      absenAlfa: number;
      wajibPct: number;
    }>;
  };
  musyrifProgress: {
    kamarList: string[];
    totalKamar: number;
    sudahPresensiHariIni: number;
    totalSantri: number;
    santriSudahDibina: number;
    totalPembinaanAsrama: number;
    rataSholatWajibPct: number;
    rataSholatSunnahPct: number;
    absenHariIni: Array<{
      namaSiswa: string;
      kamar: string;
      status: string;
      keterangan: string;
    }>;
    santriProgress: Array<{
      nama: string;
      kelas: string;
      kamar: string;
      totalPembinaan: number;
      wajibPct: number;
      sunnahPct: number;
      statusAsramaHariIni: string;
      keteranganHariIni: string;
    }>;
  };
}

interface AkunGuruModuleProps {
  teachers: TeacherPublic[];
  unlockedTeacher: TeacherPublic | null;
  onUnlock: (teacher: TeacherPublic | null) => void;
  onOpenQuickPresensi: (namaGuru: string) => void;
  onOpenWaliKelas: () => void;
  onOpenJadwal?: () => void;
  onOpenRegisterPortal?: () => void;
  onDataUpdated?: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AkunGuruModule: React.FC<AkunGuruModuleProps> = ({
  teachers,
  unlockedTeacher,
  onUnlock,
  onOpenQuickPresensi,
  onOpenWaliKelas,
  onOpenJadwal,
  onOpenRegisterPortal,
  onDataUpdated,
  notify,
}) => {
  const [selectedName, setSelectedName] = useState<string>(unlockedTeacher?.nama || teachers[0]?.nama || '');
  const [pin, setPin] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [recap, setRecap] = useState<TeacherRecapResponse | null>(null);
  const [loadingRecap, setLoadingRecap] = useState(false);
  const [progressTab, setProgressTab] = useState<
    'mengajar' | 'walikelas' | 'musyrif' | 'quran' | 'whatsapp' | 'upload'
  >('mengajar');
  const today = getTodayDateStr();

  // Dasbor Pengampu Al-Qur'an (Halaqah) state
  const [halaqahRows, setHalaqahRows] = useState<
    Array<{
      id: string;
      nis: string;
      nama: string;
      gender: Gender;
      kelas: string;
      kelompokQuran: string;
      pengampuQuran: string;
      persenHadir: number;
      totalHadir: number;
      totalAbsen: number;
      lastSetoran: string;
      lastTilawah: string;
      lastMurajaah: string;
      lastTanggal: string;
    }>
  >([]);
  const [loadingHalaqah, setLoadingHalaqah] = useState(false);

  // WhatsApp Gateway Automation state
  const [waProvider, setWaProvider] = useState<'Fonnte' | 'Wablas' | 'Baileys'>('Fonnte');
  const [waToken, setWaToken] = useState('');
  const [waAutoAlfa, setWaAutoAlfa] = useState(true);
  const [waAutoEskalasi, setWaAutoEskalasi] = useState(true);
  const [waLogs, setWaLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      triggerType: string;
      namaSantri: string;
      kelas: string;
      nomorTujuan: string;
      pesan: string;
      provider: string;
      status: string;
    }>
  >([]);
  const [savingWa, setSavingWa] = useState(false);

  // Per-login Excel Upload state
  const [personalExcel, setPersonalExcel] = useState<ParsedDatabaseWorkbook | null>(null);
  const [downloadingTpl, setDownloadingTpl] = useState(false);
  const [uploadingPersonal, setUploadingPersonal] = useState(false);

  // Per-login Direct Input state (Santri, Jadwal, Assignment)
  const defaultGender: Gender = unlockedTeacher?.genderScope === 'Putri' ? 'Putri' : 'Putra';
  const [inWilayah, setInWilayah] = useState<Gender>(defaultGender);
  const [inNis, setInNis] = useState('');
  const [inNamaSantri, setInNamaSantri] = useState('');
  const [inKelas, setInKelas] = useState(unlockedTeacher?.waliKelasOf || '');
  const [inKamar, setInKamar] = useState(unlockedTeacher?.kamarBinaan?.[0] || '');
  const [inKelompok, setInKelompok] = useState('');
  const [savingSantri, setSavingSantri] = useState(false);

  const [editingJadwalId, setEditingJadwalId] = useState<string | null>(null);
  const [inKategoriJadwal, setInKategoriJadwal] = useState<'Akademik' | 'Al-Quran'>('Akademik');
  const [inHari, setInHari] = useState('SENIN');
  const [inJadwalWilayah, setInJadwalWilayah] = useState<Gender>(defaultGender);
  const [inJadwalKelas, setInJadwalKelas] = useState(unlockedTeacher?.waliKelasOf || '');
  const [inMapel, setInMapel] = useState('');
  const [inJam, setInJam] = useState('1-2');
  const [savingJadwal, setSavingJadwal] = useState(false);
  const [uploadingJadwalExcel, setUploadingJadwalExcel] = useState(false);

  const [editScope, setEditScope] = useState<'Putra' | 'Putri' | 'Semua'>(unlockedTeacher?.genderScope || 'Putra');
  const [editWaliKelas, setEditWaliKelas] = useState(unlockedTeacher?.waliKelasOf || '');
  const [editKamarBinaan, setEditKamarBinaan] = useState((unlockedTeacher?.kamarBinaan || []).join('; '));
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!selectedName && teachers.length > 0) {
      setSelectedName(teachers[0].nama);
    }
  }, [teachers, selectedName]);

  useEffect(() => {
    if (unlockedTeacher) {
      const defG: Gender = unlockedTeacher.genderScope === 'Putri' ? 'Putri' : 'Putra';
      setInWilayah(defG);
      setInJadwalWilayah(defG);
      setInKelas(unlockedTeacher.waliKelasOf || '');
      setInJadwalKelas(unlockedTeacher.waliKelasOf || '');
      setInKamar(unlockedTeacher.kamarBinaan?.[0] || '');
      setEditScope(unlockedTeacher.genderScope || 'Putra');
      setEditWaliKelas(unlockedTeacher.waliKelasOf || '');
      setEditKamarBinaan((unlockedTeacher.kamarBinaan || []).join('; '));
      setPersonalExcel(null);

      if (unlockedTeacher.peran === 'Musyrif' || unlockedTeacher.peran === 'Musyrifah') {
        setProgressTab('musyrif');
      } else if (unlockedTeacher.peran === 'Wali Kelas') {
        setProgressTab('walikelas');
      } else if (unlockedTeacher.peran === 'Pengampu Al-Quran') {
        setProgressTab('quran');
      } else {
        setProgressTab('mengajar');
      }
    }
  }, [unlockedTeacher]);

  const fetchRecap = (namaGuru: string) => {
    setLoadingRecap(true);
    fetch(`/api/guru/rekap?namaGuru=${encodeURIComponent(namaGuru)}&tanggal=${encodeURIComponent(today)}`)
      .then((r) => r.json())
      .then((data: TeacherRecapResponse) => setRecap(data))
      .finally(() => setLoadingRecap(false));
  };

  const fetchHalaqahRecap = (namaGuru: string) => {
    setLoadingHalaqah(true);
    fetch(`/api/halaqah/rekap?guru=${encodeURIComponent(namaGuru)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.rows) && data.rows.length > 0) {
          setHalaqahRows(data.rows);
        } else {
          fetch('/api/halaqah/rekap')
            .then((r2) => r2.json())
            .then((allData) => setHalaqahRows(allData?.rows || []));
        }
      })
      .finally(() => setLoadingHalaqah(false));
  };

  const fetchWaDashboard = () => {
    fetch('/api/whatsapp/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data?.config) {
          setWaProvider(data.config.provider || 'Fonnte');
          setWaToken(data.config.apiToken || '');
          setWaAutoAlfa(data.config.autoNotifyAlfa !== false);
          setWaAutoEskalasi(data.config.autoNotifyEskalasi !== false);
        }
        setWaLogs(data?.logs || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (unlockedTeacher) {
      fetchRecap(unlockedTeacher.nama);
      fetchHalaqahRecap(unlockedTeacher.nama);
      fetchWaDashboard();
    } else {
      setRecap(null);
    }
  }, [unlockedTeacher]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedName) return;
    setVerifying(true);
    try {
      const res = await fetch('/api/guru/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namaGuru: selectedName, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'PIN tidak cocok.', 'error');
        return;
      }
      onUnlock(data.teacher);
      notify(`Selamat datang, ${data.teacher.nama}. Rekapan & progres siap dilihat.`, 'success');
    } catch {
      notify('Gagal memverifikasi PIN akun.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyPersonalLink = (nama: string) => {
    const url = `${window.location.origin}/?guru=${encodeURIComponent(nama)}`;
    navigator.clipboard.writeText(url);
    notify(`Link Presensi Cepat untuk ${nama} berhasil disalin.`, 'success');
  };

  const handleExportRecapCsv = () => {
    if (!recap) return;
    const header = ['Tanggal', 'Divisi', 'Kelas / Kamar', 'Mapel', 'Materi / Catatan', 'Hadir/Telat', 'S/I/A', 'Total Santri'];
    const rows = recap.sessions.map((s) => [
      formatTanggalIndo(s.tanggal),
      s.jenisPresensi,
      s.kelas,
      s.mapel,
      s.materi,
      String(s.hadir),
      String(s.tidakHadir),
      String(s.totalSiswa),
    ]);
    downloadCsv(`Rekap_Mengajar_${recap.teacher.nama.replace(/\s+/g, '_')}.csv`, [header, ...rows]);
    notify('Rekap pribadi guru berhasil diunduh.', 'success');
  };

  const handleDownloadPersonalTemplate = async () => {
    if (!unlockedTeacher) return;
    setDownloadingTpl(true);
    try {
      const res = await fetch(
        `/api/templates/personal-data?namaGuru=${encodeURIComponent(unlockedTeacher.nama)}`,
      );
      if (!res.ok) throw new Error('Gagal menyiapkan template akun.');
      const spec: DatabaseWorkbookSpec = await res.json();
      triggerExcelDownloadFromSpec(spec);
      notify(`Mengunduh ${spec.filename} (Format Putra & Putri khusus akun ${unlockedTeacher.nama}).`, 'success');
    } catch (err) {
      notify((err as Error).message || 'Gagal mengunduh template Excel.', 'error');
    } finally {
      setDownloadingTpl(false);
    }
  };

  const handlePersonalExcelPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) return;
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        setPersonalExcel(parsed);
        notify(`File ${file.name} berhasil dibaca. Periksa ringkasan lalu simpan ke akun ini.`, 'success');
      } catch {
        notify('Gagal membaca file Excel (.xlsx/.xls).', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmitPersonalExcel = async () => {
    if (!unlockedTeacher || !personalExcel) return;
    setUploadingPersonal(true);
    try {
      const res = await fetch('/api/guru/import-personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: unlockedTeacher.nama,
          santriRows: personalExcel.santriRows,
          scheduleRows: personalExcel.scheduleRows,
          pembinaanRows: personalExcel.pembinaanRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data upload.');
      notify(
        `Upload selesai! Santri: ${data.santriInserted} baru/${data.santriUpdated} update · Jadwal: ${data.schedulesAdded} · Pembinaan: ${data.pembinaanSaved}.`,
        'success',
      );
      setPersonalExcel(null);
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setUploadingPersonal(false);
    }
  };

  const handleDirectSaveSantri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedTeacher) return;
    if (!inNamaSantri.trim() || !inKelas.trim()) {
      notify('Nama santri dan Nama Kelas wajib diisi.', 'error');
      return;
    }
    setSavingSantri(true);
    try {
      const res = await fetch('/api/guru/import-personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: unlockedTeacher.nama,
          santriRows: [
            {
              nis: inNis.trim(),
              nama: inNamaSantri.trim(),
              kelas: inKelas.trim(),
              kamar: inKamar.trim(),
              kelompokQuran: inKelompok.trim(),
              pengampuQuran: unlockedTeacher.nama,
              gender: inWilayah,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan santri.');
      setInNis('');
      setInNamaSantri('');
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
      notify(`Santri ${inNamaSantri.trim().toUpperCase()} (Wilayah ${inWilayah}) disimpan di akun Anda.`, 'success');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingSantri(false);
    }
  };

  const handleDirectSaveJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedTeacher) return;
    if (!inJadwalKelas.trim() || !inMapel.trim()) {
      notify('Kelas/Halaqah dan Mata Pelajaran wajib diisi.', 'error');
      return;
    }
    setSavingJadwal(true);
    try {
      if (editingJadwalId) {
        const res = await fetch(`/api/jadwal/${editingJadwalId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guru: unlockedTeacher.nama,
            hari: inHari,
            kelas: inJadwalKelas.trim(),
            mapel: inMapel.trim(),
            jamKe: inJam.trim() || '1-2',
            gender: inJadwalWilayah,
            kategori: inKategoriJadwal,
            allowOverride: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui jadwal.');
        setEditingJadwalId(null);
        setInMapel('');
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        notify(`Jadwal ${inHari} (${inJadwalKelas.toUpperCase()}) berhasil diperbarui.`, 'success');
      } else {
        const res = await fetch('/api/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guru: unlockedTeacher.nama,
            hari: inHari,
            kelas: inJadwalKelas.trim(),
            mapel: inMapel.trim(),
            jamKe: inJam.trim() || '1-2',
            gender: inJadwalWilayah,
            kategori: inKategoriJadwal,
            allowOverride: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan jadwal.');
        setInMapel('');
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        notify(`Jadwal ${inHari} (${inJadwalKelas.toUpperCase()}) ditambahkan ke akun Anda.`, 'success');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingJadwal(false);
    }
  };

  const handleStartEditPersonalJadwal = (item: ScheduleItem) => {
    setEditingJadwalId(item.id);
    setInKategoriJadwal(
      item.kategori ||
        (item.mapel.toUpperCase().includes('QUR') || item.mapel.toUpperCase().includes('HALAQAH')
          ? 'Al-Quran'
          : 'Akademik')
    );
    setInHari(item.hari);
    setInJadwalWilayah(item.gender);
    setInJadwalKelas(item.kelas);
    setInMapel(item.mapel);
    setInJam(item.jamKe);
    notify(`Mode Edit Jadwal aktif: ${item.hari} · ${item.kelas} (${item.mapel}).`, 'info');
  };

  const handleDeletePersonalJadwal = async (id: string) => {
    if (!unlockedTeacher) return;
    const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingJadwalId === id) {
        setEditingJadwalId(null);
        setInMapel('');
      }
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
      notify('Jadwal berhasil dihapus.', 'info');
    }
  };

  const handleDownloadMyJadwalExcel = (mode: 'blank' | 'filled') => {
    if (!unlockedTeacher) return;
    if (mode === 'blank') {
      const fname = downloadComponentExcelTemplate('jadwal', 'blank');
      notify(`Mengunduh ${fname} (Template Kosong Jadwal Akademik & Al-Qur'an).`, 'success');
      return;
    }
    const mySchedules = recap?.allMySchedules || [];
    const defG = unlockedTeacher.genderScope === 'Putri' ? 'Putri' : 'Putra';
    const rows: string[][] = [
      ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
      ...(mySchedules.length > 0
        ? mySchedules.map((s) => [s.guru, s.hari, s.kelas, s.mapel, s.jamKe, s.gender])
        : [
            [
              unlockedTeacher.nama,
              'SENIN',
              unlockedTeacher.waliKelasOf || (defG === 'Putri' ? '10 KHADIJAH' : '10 ABU BAKAR AS-SHIDDIQ'),
              'BAHASA ARAB',
              '1-2',
              defG,
            ],
            [
              unlockedTeacher.nama,
              'SELASA',
              defG === 'Putri' ? '10-01 Putri' : '10-08 Putra',
              "HALAQAH AL-QUR'AN",
              '3-4',
              defG,
            ],
          ]),
    ];
    triggerExcelDownloadFromSpec({
      filename: `Jadwal_${unlockedTeacher.nama.replace(/[^A-Za-z0-9]+/g, '_')}.xlsx`,
      sourceLabel: `Jadwal ${unlockedTeacher.nama}`,
      sheets: [{ name: '4_Jadwal_Mengajar', label: 'Jadwal Saya', rows }],
    });
    notify(`Berhasil mengunduh jadwal ${unlockedTeacher.nama} ke Excel (.xlsx).`, 'success');
  };

  const handleUploadMyJadwalExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !unlockedTeacher) return;
    setUploadingJadwalExcel(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) {
        setUploadingJadwalExcel(false);
        return;
      }
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        if (parsed.scheduleRows.length === 0) {
          throw new Error(
            'File Excel tidak berisi baris jadwal valid. Pastikan menggunakan Template Jadwal Mengajar.'
          );
        }
        const rowsForMe = parsed.scheduleRows.map((r) => ({
          ...r,
          guru: r.guru?.trim() ? r.guru.trim().toUpperCase() : unlockedTeacher.nama,
        }));
        const res = await fetch('/api/import/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rowsForMe, replaceExisting: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengimpor jadwal Excel.');
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        notify(
          `Upload Excel Jadwal berhasil! (${data.added || 0} jadwal baru ditambahkan, ${data.updated || 0} jadwal lama diperbarui).`,
          'success'
        );
      } catch (err) {
        notify((err as Error).message, 'error');
      } finally {
        setUploadingJadwalExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderInlineScheduleWorkbench = (roleContext: 'Akademik' | 'Al-Quran') => {
    const mySchedules = recap?.allMySchedules || [];
    return (
      <div className="rounded-xl border border-teal-200 bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-teal-50/90 via-emerald-50/50 to-white px-5 py-4 border-b border-slate-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Kelola Jadwal {roleContext === 'Al-Quran' ? "Halaqah Al-Qur'an & Mengajar" : 'Guru Akademik & Al-Qur’an'} ({mySchedules.length} Jadwal)
              </h3>
              <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
                Tambah Sistem · Edit Jadwal · Template Excel
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Anda bisa menambah jadwal baru lewat form sistem di bawah, klik <b>Edit</b> pada jadwal yang sudah ada, atau <b>Unduh &amp; Upload Template Excel Jadwal (.xlsx)</b>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleDownloadMyJadwalExcel('blank')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-teal-700" />
              Template Kosong (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleDownloadMyJadwalExcel('filled')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-teal-700" />
              Unduh &amp; Edit Jadwal Saya (.xlsx)
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1324] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="h-3.5 w-3.5 text-teal-300" />
              <span>{uploadingJadwalExcel ? 'Mengupload...' : 'Upload Excel Jadwal (.xlsx)'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={uploadingJadwalExcel}
                onChange={handleUploadMyJadwalExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Form Tambah / Edit Jadwal */}
          <form
            onSubmit={handleDirectSaveJadwal}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="text-xs font-bold text-slate-900">
                {editingJadwalId ? 'Mode Edit Jadwal Saya' : 'Tambah Jadwal Baru via Sistem'}
              </div>
              {editingJadwalId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingJadwalId(null);
                    setInMapel('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kategori Jadwal</label>
                <select
                  value={inKategoriJadwal}
                  onChange={(e) => {
                    const val = e.target.value as 'Akademik' | 'Al-Quran';
                    setInKategoriJadwal(val);
                    if (val === 'Al-Quran' && !inMapel) setInMapel("HALAQAH AL-QUR'AN");
                  }}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                >
                  <option value="Akademik">Guru Akademik (KBM)</option>
                  <option value="Al-Quran">Guru Al-Qur&apos;an (Halaqah)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah</label>
                <select
                  value={inJadwalWilayah}
                  onChange={(e) => setInJadwalWilayah(e.target.value as Gender)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                >
                  <option value="Putra">Wilayah Putra</option>
                  <option value="Putri">Wilayah Putri</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hari</label>
                <select
                  value={inHari}
                  onChange={(e) => setInHari(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                >
                  {['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Pelajaran (JP)</label>
                <input
                  type="text"
                  value={inJam}
                  onChange={(e) => setInJam(e.target.value)}
                  placeholder="Contoh: 1-2 atau 5-6"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {inKategoriJadwal === 'Al-Quran' ? 'Kelompok Halaqah Al-Qur’an *' : 'Nama Kelas Akademik *'}
              </label>
              <input
                type="text"
                value={inJadwalKelas}
                onChange={(e) => setInJadwalKelas(e.target.value)}
                placeholder={
                  inKategoriJadwal === 'Al-Quran'
                    ? inJadwalWilayah === 'Putri'
                      ? '10-01 Putri'
                      : '10-08 Putra'
                    : inJadwalWilayah === 'Putri'
                    ? '10 KHADIJAH BINTI KHUWAILID'
                    : '10 ABU BAKAR AS-SHIDDIQ'
                }
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {inKategoriJadwal === 'Al-Quran' ? 'Agenda Halaqah / Target Tahfidz *' : 'Mata Pelajaran *'}
              </label>
              <input
                type="text"
                value={inMapel}
                onChange={(e) => setInMapel(e.target.value)}
                placeholder={inKategoriJadwal === 'Al-Quran' ? "HALAQAH AL-QUR'AN" : 'BAHASA ARAB / FIQIH'}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={savingJadwal}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {savingJadwal
                ? 'Menyimpan...'
                : editingJadwalId
                ? 'Simpan Perubahan Jadwal'
                : `Tambah Jadwal ${inKategoriJadwal}`}
            </button>
          </form>

          {/* Tabel Daftar Jadwal Saya + Tombol Edit & Hapus */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Daftar Jadwal Aktif ({unlockedTeacher?.nama})
              </span>
              <span className="text-[11px] text-slate-500">Klik Edit untuk mengubah jadwal yang sudah ada</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Hari &amp; JP</th>
                    <th className="px-3 py-2 font-semibold">Kelas / Halaqah</th>
                    <th className="px-3 py-2 font-semibold">Mapel / Kategori</th>
                    <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mySchedules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Belum ada jadwal terdaftar. Tambahkan lewat form di samping atau upload Template Excel.
                      </td>
                    </tr>
                  ) : (
                    mySchedules.map((sch) => (
                      <tr
                        key={sch.id}
                        className={`hover:bg-slate-50 ${
                          editingJadwalId === sch.id ? 'bg-teal-50/70' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{sch.hari}</div>
                          <div className="font-mono-num text-[11px] text-slate-500">JP {sch.jamKe}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{sch.kelas}</div>
                          <div className="text-[11px] text-slate-500">Wilayah {sch.gender}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{sch.mapel}</div>
                          <div className="text-[10px] font-semibold text-teal-700">
                            {sch.kategori || (sch.mapel.includes('QUR') ? 'Al-Quran' : 'Akademik')}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleStartEditPersonalJadwal(sch)}
                            className="mr-1.5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
                          >
                            <Edit3 className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePersonalJadwal(sch.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedTeacher) return;
    setSavingProfile(true);
    try {
      const kamarArr = editKamarBinaan
        .split(/[;,]/)
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch(`/api/guru/${unlockedTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genderScope: editScope,
          waliKelasOf: editWaliKelas.trim(),
          kamarBinaan: kamarArr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui penugasan.');
      onUnlock(data.teacher);
      fetchRecap(data.teacher.nama);
      onDataUpdated?.();
      notify('Penugasan wilayah, kelas wali, dan kamar binaan diperbarui.', 'success');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!unlockedTeacher) {
    return (
      <div className="mx-auto max-w-xl py-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Login Rekapan Data &amp; Progres Guru, Wali Kelas, dan Musyrif/ah
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Pengisian presensi dan pembinaan di halaman depan tidak membutuhkan login. Masuk dengan akun Anda di sini untuk memantau rekapan mengajar, progres kelas binaan wali kelas, dan progres kamar asrama musyrif/musyrifah.
            </p>
          </div>

          {teachers.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2.5">
              <div className="font-semibold">Belum Ada Akun Terdaftar (Database Kosong)</div>
              <p className="text-amber-800 leading-relaxed">
                Daftarkan akun pertama terlebih dahulu atau unggah CSV Guru/Santri melalui menu <b>Upload &amp; Format SIM</b>.
              </p>
              {onOpenRegisterPortal && (
                <button
                  type="button"
                  onClick={onOpenRegisterPortal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Daftar Akun Baru Sekarang
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Akun Guru / Wali Kelas / Musyrif / Musyrifah
                </label>
                <select
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.nama}>
                      {t.nama} — {t.peran} {t.waliKelasOf ? `(${t.waliKelasOf})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">PIN / Password Akun</label>
                  <span className="font-mono-num text-[11px] text-slate-500">Default impor CSV: 1234</span>
                </div>
                <input
                  type="password"
                  maxLength={12}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN atau password..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-mono-num tracking-widest focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={verifying || !selectedName}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
                >
                  <KeyRound className="h-4 w-4" />
                  {verifying ? 'Memverifikasi...' : 'Masuk & Lihat Rekapan Progres'}
                </button>
                {onOpenRegisterPortal && (
                  <button
                    type="button"
                    onClick={onOpenRegisterPortal}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    Daftar Akun Baru
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-900">{unlockedTeacher.nama}</h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{unlockedTeacher.jabatan}</span>
            <span aria-hidden="true">·</span>
            <span>Unit {unlockedTeacher.genderScope}</span>
            {unlockedTeacher.waliKelasOf && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-teal-700">Wali Kelas {unlockedTeacher.waliKelasOf}</span>
              </>
            )}
            {unlockedTeacher.kamarBinaan && unlockedTeacher.kamarBinaan.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-sky-700">Kamar: {unlockedTeacher.kamarBinaan.join(', ')}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyPersonalLink(unlockedTeacher.nama)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Salin Link Presensi
          </button>
          <button
            type="button"
            onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Input Presensi
          </button>
          <button
            type="button"
            onClick={onOpenWaliKelas}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Pembinaan &amp; Portofolio
          </button>
          {onOpenJadwal && (
            <button
              type="button"
              onClick={onOpenJadwal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Atur Jadwal
            </button>
          )}
          <button
            type="button"
            onClick={() => onUnlock(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </div>

      {/* Role Progress Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setProgressTab('mengajar')}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
            progressTab === 'mengajar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-teal-700" />
          Rekap &amp; Progres Guru Mengajar
        </button>
        <button
          type="button"
          onClick={() => setProgressTab('walikelas')}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors ${
            progressTab === 'walikelas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-sky-700" />
          Progres Wali Kelas ({recap?.waliProgress.totalSantri ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setProgressTab('musyrif')}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            progressTab === 'musyrif' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Home className="h-3.5 w-3.5 text-emerald-700" />
          Progres Musyrif / Musyrifah ({recap?.musyrifProgress.totalKamar ?? 0} Kamar)
        </button>
        <button
          type="button"
          onClick={() => setProgressTab('quran')}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            progressTab === 'quran' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-amber-700" />
          Dasbor Pengampu Al-Qur&apos;an ({halaqahRows.length})
        </button>
        <button
          type="button"
          onClick={() => setProgressTab('whatsapp')}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            progressTab === 'whatsapp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          WhatsApp Gateway ({waLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setProgressTab('upload')}
          className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            progressTab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="h-3.5 w-3.5 text-violet-700" />
          Upload Template &amp; Input Langsung
        </button>
      </div>

      {progressTab === 'upload' ? (
        <div className="space-y-6">
          {/* 1. Upload via Template Excel Putra & Putri di Akun Login Ini */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Upload Lewat Template Excel (.xlsx) — Khusus Login {unlockedTeacher.nama}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Template Excel mencakup <b>Wilayah Putra &amp; Wilayah Putri</b> (`1A_Siswa_Putra`, `1B_Siswa_Putri`), <b>Jadwal Mengajar</b>, dan <b>Catatan Pembinaan</b> untuk diupload langsung di akun ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={downloadingTpl}
                onClick={handleDownloadPersonalTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {downloadingTpl ? 'Menyiapkan...' : 'Unduh Template Excel (.xlsx)'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
              <label className="lg:col-span-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-white p-5 text-center cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors">
                <Upload className="h-6 w-6 text-emerald-700 mb-2" />
                <span className="text-xs font-bold text-slate-900">
                  {personalExcel ? personalExcel.fileName : 'Pilih File Template Excel (.xlsx / .xls)'}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Mendukung file Template Akun Pribadi maupun Template Master Putra/Putri
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handlePersonalExcelPick}
                  className="hidden"
                />
              </label>

              <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4">
                {!personalExcel ? (
                  <div className="text-xs text-slate-600 space-y-1.5 py-2">
                    <div className="font-semibold text-slate-900">Alur Upload dari Login Pembina:</div>
                    <p>1. Klik <b>Unduh Template Excel (.xlsx)</b> di atas untuk mendapatkan sheet Putra &amp; Putri siap isi.</p>
                    <p>2. Isi data santri Putra/Putri, jadwal mengajar, atau catatan pembinaan lalu simpan.</p>
                    <p>3. Pilih file di kotak kiri, tinjau ringkasan data, lalu klik <b>Simpan Upload ke Akun Saya</b>.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                      <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-2.5">
                        <div className="text-[11px] text-sky-800">Santri Putra</div>
                        <div className="font-mono-num text-base font-bold text-sky-950">
                          {personalExcel.santriRows.filter((s) => s.gender === 'Putra').length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2.5">
                        <div className="text-[11px] text-rose-800">Santri Putri</div>
                        <div className="font-mono-num text-base font-bold text-rose-950">
                          {personalExcel.santriRows.filter((s) => s.gender === 'Putri').length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                        <div className="text-[11px] text-amber-800">Jadwal</div>
                        <div className="font-mono-num text-base font-bold text-amber-950">
                          {personalExcel.scheduleRows.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-2.5">
                        <div className="text-[11px] text-violet-800">Pembinaan</div>
                        <div className="font-mono-num text-base font-bold text-violet-950">
                          {personalExcel.pembinaanRows.length}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPersonalExcel(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={uploadingPersonal}
                        onClick={handleSubmitPersonalExcel}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {uploadingPersonal ? 'Menyimpan...' : 'Simpan Upload ke Akun Saya'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Input Langsung di Masing-Masing Login (Tanpa File Excel) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
            <form
              onSubmit={handleDirectSaveSantri}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                <Users className="h-4 w-4 text-teal-700" />
                Input Langsung Santri Binaan
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah *</label>
                  <select
                    value={inWilayah}
                    onChange={(e) => setInWilayah(e.target.value as Gender)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="Putra">Putra</option>
                    <option value="Putri">Putri</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">No / NIS</label>
                  <input
                    type="text"
                    value={inNis}
                    onChange={(e) => setInNis(e.target.value)}
                    placeholder="1001"
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-mono-num"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Santri *</label>
                <input
                  type="text"
                  value={inNamaSantri}
                  onChange={(e) => setInNamaSantri(e.target.value)}
                  placeholder={inWilayah === 'Putri' ? 'AISYAH HUMAIRA' : 'AHMAD FAUZI'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelas *</label>
                  <input
                    type="text"
                    value={inKelas}
                    onChange={(e) => setInKelas(e.target.value)}
                    placeholder={inWilayah === 'Putri' ? '10 KHADIJAH' : '10 ABU BAKAR'}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kamar</label>
                  <input
                    type="text"
                    value={inKamar}
                    onChange={(e) => setInKamar(e.target.value)}
                    placeholder={inWilayah === 'Putri' ? '10.1 Putri' : '10.4 Putra'}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelompok Al-Qur&apos;an</label>
                <input
                  type="text"
                  value={inKelompok}
                  onChange={(e) => setInKelompok(e.target.value)}
                  placeholder={inWilayah === 'Putri' ? '10-01 Putri' : '10-08 Putra'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={savingSantri}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {savingSantri ? 'Menyimpan...' : `Simpan Santri (${inWilayah})`}
              </button>
            </form>

            <form
              onSubmit={handleDirectSaveJadwal}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                <BookOpen className="h-4 w-4 text-sky-700" />
                Input Langsung Jadwal Saya
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah</label>
                  <select
                    value={inJadwalWilayah}
                    onChange={(e) => setInJadwalWilayah(e.target.value as Gender)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="Putra">Putra</option>
                    <option value="Putri">Putri</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hari</label>
                  <select
                    value={inHari}
                    onChange={(e) => setInHari(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                  >
                    {['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelas / Halaqah *</label>
                <input
                  type="text"
                  value={inJadwalKelas}
                  onChange={(e) => setInJadwalKelas(e.target.value)}
                  placeholder={inJadwalWilayah === 'Putri' ? '10 KHADIJAH' : '10 ABU BAKAR'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mata Pelajaran *</label>
                  <input
                    type="text"
                    value={inMapel}
                    onChange={(e) => setInMapel(e.target.value)}
                    placeholder="BAHASA ARAB"
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Ke</label>
                  <input
                    type="text"
                    value={inJam}
                    onChange={(e) => setInJam(e.target.value)}
                    placeholder="1-2"
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-mono-num"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingJadwal}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {savingJadwal ? 'Menyimpan...' : `Simpan Jadwal (${inJadwalWilayah})`}
              </button>
            </form>

            <form
              onSubmit={handleSaveAssignment}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                <ShieldCheck className="h-4 w-4 text-violet-700" />
                Atur Wilayah, Kelas &amp; Kamar Saya
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cakupan Wilayah Tugas</label>
                <select
                  value={editScope}
                  onChange={(e) => setEditScope(e.target.value as 'Putra' | 'Putri' | 'Semua')}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                >
                  <option value="Putra">Wilayah Putra</option>
                  <option value="Putri">Wilayah Putri</option>
                  <option value="Semua">Semua (Putra &amp; Putri)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelas Binaan (Wali Kelas)</label>
                <input
                  type="text"
                  value={editWaliKelas}
                  onChange={(e) => setEditWaliKelas(e.target.value)}
                  placeholder="Contoh: 10 KHADIJAH"
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kamar Binaan (pisah koma / titik koma)
                </label>
                <input
                  type="text"
                  value={editKamarBinaan}
                  onChange={(e) => setEditKamarBinaan(e.target.value)}
                  placeholder="Contoh: 10.1 Putri; 10.2 Putri"
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {savingProfile ? 'Memperbarui...' : 'Simpan Penugasan Akun'}
              </button>
            </form>
          </div>
        </div>
      ) : loadingRecap || !recap ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
      ) : progressTab === 'mengajar' ? (
        <div className="space-y-6">
          {/* Summary Stats Guru Mengajar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Sesi Presensi Diisi</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{recap.totalSessions}</div>
              <div className="mt-1 text-xs text-slate-500">Rekam jejak dari input halaman depan</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Progres Mengajar Hari Ini</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
                {recap.todaySchedules.filter((s) => s.filled).length}/{recap.todaySchedules.length}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono-num">{formatTanggalIndo(today)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Jadwal Mingguan</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{recap.allMySchedules.length}</div>
              <div className="mt-1 text-xs text-slate-500">Akademik &amp; Halaqah Al-Qur&apos;an</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Pengawasan Ujian</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{recap.examSessionsCount}</div>
              <div className="mt-1 text-xs text-slate-500">Sesi berita acara tercatat</div>
            </div>
          </div>

          {/* Today's Checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Target Mengajar Hari Ini ({formatTanggalIndo(today)})
            </h3>
            {recap.todaySchedules.length === 0 ? (
              <p className="text-xs text-slate-500">
                Tidak ada jadwal mengajar terjadwal pada hari ini. Anda dapat menambah atau menyesuaikan jadwal di menu <b>Jadwal &amp; Perubahan</b>.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recap.todaySchedules.map((sch) => (
                  <div
                    key={sch.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      sch.filled ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {sch.kelas} · {sch.mapel}
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono-num">Jam ke-{sch.jamKe}</div>
                    </div>
                    {sch.filled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Sudah
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <Clock className="h-4 w-4" />
                        Belum
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kelola Jadwal Guru Akademik & Al-Qur'an (Sistem, Edit, atau Template Excel) */}
          {renderInlineScheduleWorkbench('Akademik')}

          {/* Personal Session History */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Riwayat Rekapan Mengajar &amp; Presensi</h3>
                <p className="text-xs text-slate-500">
                  Seluruh sesi yang diisi atas nama {recap.teacher.nama}
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportRecapCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh CSV Pribadi
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold">Divisi</th>
                    <th className="px-3 py-3 font-semibold">Kelas / Kamar</th>
                    <th className="px-3 py-3 font-semibold">Mapel / Agenda</th>
                    <th className="px-4 py-3 font-semibold">Materi / Catatan</th>
                    <th className="px-3 py-3 text-right font-semibold">H+T</th>
                    <th className="px-4 py-3 text-right font-semibold">S/I/A</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recap.sessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Belum ada sesi presensi tersimpan untuk akun ini.
                      </td>
                    </tr>
                  ) : (
                    recap.sessions.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono-num whitespace-nowrap">
                          {formatTanggalIndo(s.tanggal)}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700">{s.jenisPresensi}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{s.kelas}</td>
                        <td className="px-3 py-3 text-slate-700">{s.mapel}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{s.materi}</td>
                        <td className="px-3 py-3 text-right font-mono-num font-semibold text-emerald-700">
                          {s.hadir}/{s.totalSiswa}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold text-rose-700">
                          {s.tidakHadir}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : progressTab === 'walikelas' ? (
        /* WALI KELAS PROGRESS TAB */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Santri Kelas Binaan</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                {recap.waliProgress.totalSantri}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {recap.waliProgress.kelasBinaan || 'Kelas wali belum ditetapkan'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Progres Pembinaan Kelas</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
                {recap.waliProgress.santriSudahDibina}/{recap.waliProgress.totalSantri}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Santri sudah mendapat catatan ({recap.waliPembinaanCount} total entri)
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Kasus Proses / Eskalasi</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-amber-700">
                {recap.waliProgress.kasusProsesEskalasi}
              </div>
              <div className="mt-1 text-xs text-slate-500">Menunggu tindak lanjut selesai</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Rata-rata Ibadah Kelas</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                {recap.waliProgress.rataSholatWajibPct}%
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Wajib {recap.waliProgress.rataSholatWajibPct}% · Sunnah {recap.waliProgress.rataSholatSunnahPct}%
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Progres Pembinaan &amp; Kehadiran Santri ({recap.waliProgress.kelasBinaan || 'Semua Binaan'})
                </h3>
                <p className="text-xs text-slate-500">
                  Pantau kemajuan ibadah, poin pembinaan, dan status ketidakhadiran setiap santri perwalian.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenWaliKelas}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Buka Portofolio &amp; DB Pembinaan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama Santri</th>
                    <th className="px-3 py-3 font-semibold">Kamar</th>
                    <th className="px-3 py-3 font-semibold">Prioritas</th>
                    <th className="px-3 py-3 text-right font-semibold">Pembinaan</th>
                    <th className="px-3 py-3 text-right font-semibold">Sholat Wajib</th>
                    <th className="px-3 py-3 text-right font-semibold">Net Poin</th>
                    <th className="px-3 py-3 font-semibold">Status Terakhir</th>
                    <th className="px-4 py-3 text-right font-semibold">Absen (S/I/A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recap.waliProgress.santriProgress.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Belum ada santri yang terhubung ke kelas binaan Anda ({recap.waliProgress.kelasBinaan || 'belum diatur'}).
                      </td>
                    </tr>
                  ) : (
                    recap.waliProgress.santriProgress.map((st) => (
                      <tr key={st.nama} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{st.nama}</td>
                        <td className="px-3 py-3 text-slate-600">{st.kamar}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`font-semibold ${
                              st.prioritas === 'Intensif'
                                ? 'text-rose-700'
                                : st.prioritas === 'Rutin'
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {st.prioritas}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono-num">{st.totalPembinaan}x</td>
                        <td className="px-3 py-3 text-right font-mono-num font-semibold text-teal-700">
                          {st.wajibPct}%
                        </td>
                        <td className="px-3 py-3 text-right font-mono-num font-semibold">{st.netPoin}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`font-semibold ${
                              st.statusTerakhir === 'Eskalasi'
                                ? 'text-rose-700'
                                : st.statusTerakhir === 'Proses'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {st.statusTerakhir}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num text-slate-700">
                          {st.absenSakit}/{st.absenIzin}/{st.absenAlfa}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : progressTab === 'quran' ? (
        /* DASBOR PENGAMPU AL-QUR'AN (HALAQAH, SETORAN ZIYADAH, TILAWAH & MURAJAAH) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Santri Halaqah</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{halaqahRows.length}</div>
              <div className="mt-1 text-xs text-slate-500">Terdaftar pada kelompok Al-Qur&apos;an</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Rata-rata Kehadiran Mengaji</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
                {halaqahRows.length > 0
                  ? Math.round(halaqahRows.reduce((acc, r) => acc + r.persenHadir, 0) / halaqahRows.length)
                  : 100}
                %
              </div>
              <div className="mt-1 text-xs text-slate-500">Halaqah Pagi &amp; Petang</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Sudah Setor Ziyadah</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-emerald-700">
                {halaqahRows.filter((r) => r.lastSetoran && r.lastSetoran !== '-').length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Santri memiliki rekam setoran aktif</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Aktif Murajaah &amp; Tilawah</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-amber-700">
                {halaqahRows.filter((r) => (r.lastTilawah && r.lastTilawah !== '-') || (r.lastMurajaah && r.lastMurajaah !== '-')).length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Evaluasi berkala pengampu</div>
            </div>
          </div>

          {/* Kelola Jadwal Pengampu Al-Qur'an & Halaqah (Sistem, Edit, atau Template Excel) */}
          {renderInlineScheduleWorkbench('Al-Quran')}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Monitoring Halaqah Al-Qur&apos;an: Target Ziyadah, Tilawah &amp; Murajaah
                </h3>
                <p className="text-xs text-slate-500">
                  Rekapitulasi kehadiran mengaji dan progres setoran hafalan santri per kelompok halaqah.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Input Setoran &amp; Presensi Halaqah
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama Santri</th>
                    <th className="px-3 py-3 font-semibold">Kelas</th>
                    <th className="px-3 py-3 font-semibold">Kelompok Halaqah</th>
                    <th className="px-3 py-3 font-semibold">Pengampu</th>
                    <th className="px-3 py-3 text-right font-semibold">Kehadiran</th>
                    <th className="px-3 py-3 font-semibold">Setoran Ziyadah Terakhir</th>
                    <th className="px-3 py-3 font-semibold">Tilawah</th>
                    <th className="px-4 py-3 font-semibold">Murajaah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHalaqah ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Memuat progres halaqah...
                      </td>
                    </tr>
                  ) : halaqahRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Belum ada data santri halaqah.
                      </td>
                    </tr>
                  ) : (
                    halaqahRows.slice(0, 60).map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.nama}</td>
                        <td className="px-3 py-3 text-slate-600">{row.kelas}</td>
                        <td className="px-3 py-3 font-semibold text-amber-800">{row.kelompokQuran}</td>
                        <td className="px-3 py-3 text-slate-700">{row.pengampuQuran}</td>
                        <td className="px-3 py-3 text-right font-mono-num font-bold text-teal-700">
                          {row.persenHadir}% ({row.totalHadir}H)
                        </td>
                        <td className="px-3 py-3 font-medium text-emerald-800">{row.lastSetoran}</td>
                        <td className="px-3 py-3 text-slate-700">{row.lastTilawah}</td>
                        <td className="px-4 py-3 text-slate-700">{row.lastMurajaah}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : progressTab === 'whatsapp' ? (
        /* OTOMASI WHATSAPP GATEWAY (FONNTE / WABLAS / BAILEYS) */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Konfigurasi WhatsApp Gateway Automation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sistem otomatis mengirim pesan WhatsApp ke nomor Wali Santri saat santri diinput berstatus <b>Alfa (A)</b> atau mendapat catatan <b>Eskalasi Pelanggaran</b>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Provider Gateway</label>
              <select
                value={waProvider}
                onChange={(e) => setWaProvider(e.target.value as 'Fonnte' | 'Wablas' | 'Baileys')}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
              >
                <option value="Fonnte">Fonnte WhatsApp API</option>
                <option value="Wablas">Wablas Enterprise Gateway</option>
                <option value="Baileys">Baileys Self-Hosted Multi-Device</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                API Token / Device Key (Opsional untuk Live Dispatch)
              </label>
              <input
                type="password"
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
                placeholder="Kosongkan untuk mode pencatatan otomatis lokal..."
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-mono-num"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waAutoAlfa}
                  onChange={(e) => setWaAutoAlfa(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Auto-Trigger WA saat Santri Berstatus ALFA (A)
              </label>
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waAutoEskalasi}
                  onChange={(e) => setWaAutoEskalasi(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Auto-Trigger WA saat Pembinaan Berstatus ESKALASI / Poin &le; -10
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingWa}
                onClick={async () => {
                  setSavingWa(true);
                  try {
                    await fetch('/api/whatsapp/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        provider: waProvider,
                        apiToken: waToken,
                        autoNotifyAlfa: waAutoAlfa,
                        autoNotifyEskalasi: waAutoEskalasi,
                      }),
                    });
                    notify('Konfigurasi WhatsApp Gateway berhasil disimpan.', 'success');
                    fetchWaDashboard();
                  } finally {
                    setSavingWa(false);
                  }
                }}
                className="flex-1 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                Simpan Konfigurasi
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/whatsapp/send-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      namaSantri: halaqahRows[0]?.nama || 'AHMAD FAUZI',
                      kelas: halaqahRows[0]?.kelas || '10 ABU BAKAR',
                      nomorTujuan: '6281234567890',
                    }),
                  });
                  notify('Uji pengiriman notifikasi WhatsApp berhasil dicatat.', 'info');
                  fetchWaDashboard();
                }}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Kirim Pesan Uji Coba
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Log Pengiriman Notifikasi WhatsApp Otomatis ({waLogs.length})
              </h3>
              <span className="text-xs font-mono-num text-emerald-700 font-semibold">
                Provider: {waProvider}
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {waLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada log notifikasi WhatsApp. Log akan terisi otomatis saat guru menginput status Alfa (A) atau Eskalasi Pembinaan.
                </div>
              ) : (
                waLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-1.5 hover:bg-slate-50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {log.namaSantri} ({log.kelas}) — <span className="text-teal-700">{log.triggerType}</span>
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-500">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{log.pesan}</p>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      Nomor Ortu: {log.nomorTujuan} · Status: {log.status} ({log.provider})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* MUSYRIF / MUSYRIFAH PROGRESS TAB */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Presensi Kamar Hari Ini</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
                {recap.musyrifProgress.sudahPresensiHariIni}/{recap.musyrifProgress.totalKamar}
              </div>
              <div className="mt-1 text-xs text-slate-500">Kamar binaan sudah diisi</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Santri Kamar Binaan</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                {recap.musyrifProgress.santriSudahDibina}/{recap.musyrifProgress.totalSantri}
              </div>
              <div className="mt-1 text-xs text-slate-500">Sudah tercatat pembinaan</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Catatan Pembinaan Asrama</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                {recap.musyrifProgress.totalPembinaanAsrama}
              </div>
              <div className="mt-1 text-xs text-slate-500">Akumulasi seluruh pekan</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Rata-rata Ibadah Asrama</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                {recap.musyrifProgress.rataSholatWajibPct}%
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Wajib {recap.musyrifProgress.rataSholatWajibPct}% · Sunnah {recap.musyrifProgress.rataSholatSunnahPct}%
              </div>
            </div>
          </div>

          {/* Status Kamar Hari Ini & Santri Tidak Hadir */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Checklist Kamar Asrama ({formatTanggalIndo(today)})
              </h3>
              {recap.myRooms.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada kamar binaan yang ditetapkan untuk akun Anda. Atur di menu <b>Jadwal &amp; Perubahan → Penugasan Kamar</b>.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {recap.myRooms.map((rm) => (
                    <div
                      key={rm.kamar}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        rm.filled ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-900">{rm.kamar}</div>
                        <div className="text-[11px] text-slate-500">Asrama {rm.gender}</div>
                      </div>
                      {rm.filled ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Sudah
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <Clock className="h-4 w-4" />
                          Belum
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Santri Sakit / Izin / Alfa Kamar Binaan Hari Ini
              </h3>
              {recap.musyrifProgress.absenHariIni.length === 0 ? (
                <p className="text-xs text-slate-500">Tidak ada santri kamar binaan yang tercatat S/I/A hari ini.</p>
              ) : (
                <div className="space-y-2">
                  {recap.musyrifProgress.absenHariIni.map((ab) => (
                    <div key={ab.namaSiswa} className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{ab.namaSiswa}</span>
                        <span className="text-rose-700">[{ab.status}] {ab.kamar}</span>
                      </div>
                      {ab.keterangan && <div className="text-slate-600 mt-0.5">{ab.keterangan}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Progres Santri Kamar */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Progres Ibadah &amp; Pembinaan Santri Kamar Binaan
              </h3>
              <button
                type="button"
                onClick={onOpenWaliKelas}
                className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Buka Portofolio &amp; Input Asrama
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama Santri</th>
                    <th className="px-3 py-3 font-semibold">Kamar</th>
                    <th className="px-3 py-3 font-semibold">Kelas</th>
                    <th className="px-3 py-3 font-semibold">Asrama Hari Ini</th>
                    <th className="px-3 py-3 text-right font-semibold">Pembinaan</th>
                    <th className="px-3 py-3 text-right font-semibold">Sholat Wajib</th>
                    <th className="px-4 py-3 text-right font-semibold">Sunnah &amp; Tilawah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recap.musyrifProgress.santriProgress.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Belum ada santri kamar binaan yang tercatat untuk akun ini.
                      </td>
                    </tr>
                  ) : (
                    recap.musyrifProgress.santriProgress.map((st) => (
                      <tr key={st.nama} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{st.nama}</td>
                        <td className="px-3 py-3 font-medium text-slate-700">{st.kamar}</td>
                        <td className="px-3 py-3 text-slate-600">{st.kelas}</td>
                        <td className="px-3 py-3 font-mono-num font-semibold">{st.statusAsramaHariIni}</td>
                        <td className="px-3 py-3 text-right font-mono-num">{st.totalPembinaan}x</td>
                        <td className="px-3 py-3 text-right font-mono-num font-semibold text-teal-700">
                          {st.wajibPct}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num text-sky-700">{st.sunnahPct}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
