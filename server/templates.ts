import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import type { Gender, RoomMapping, ScheduleItem, Student, TeacherPublic } from '../src/types';

const XLSX_API = (XLSX as unknown as { default?: typeof XLSX }).default || XLSX;

interface AuthenticRosterRow {
  no: string;
  nama: string;
  kelas: string;
  kamar: string;
  kelompokQuran: string;
  pengampuQuran: string;
  waliKelas?: string;
  musyrif?: string;
  guruWali?: string;
  gender: Gender;
}

export interface TemplateContext {
  students: Student[];
  rooms: RoomMapping[];
  teachers: TeacherPublic[];
  schedules: ScheduleItem[];
  ruanganUjian?: string[];
}

export interface WorkbookSheetSpec {
  name: string;
  label: string;
  rows: string[][];
}

const THIS_DIR =
  typeof __dirname !== 'undefined' && __dirname
    ? __dirname
    : typeof import.meta !== 'undefined' && import.meta.url
    ? path.dirname(fileURLToPath(import.meta.url))
    : process.cwd();
const INTEGRASI_ASSET_NAME = 'Salinan_dari_integrASI__pengembangan_sistem_presensi_baru__232cd323';

function resolveIntegrasiAssetPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/integrasi-putra.csv'),
    path.resolve(THIS_DIR, '../data/integrasi-putra.csv'),
    path.resolve(THIS_DIR, '../../data/integrasi-putra.csv'),
    '/var/task/data/integrasi-putra.csv',
    path.resolve(process.cwd(), 'public/assets/aistudio', INTEGRASI_ASSET_NAME),
    path.resolve(THIS_DIR, '../public/assets/aistudio', INTEGRASI_ASSET_NAME),
    path.resolve(THIS_DIR, '../../public/assets/aistudio', INTEGRASI_ASSET_NAME),
    path.resolve('/var/task/public/assets/aistudio', INTEGRASI_ASSET_NAME),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function parseCsvRowsSimple(raw: string): string[][] {
  const cleaned = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

function inferGender(text: string): Gender {
  const up = text.toUpperCase();
  if (
    up.includes('PUTRI') ||
    up.includes('AKHWAT') ||
    up.includes('KHADIJAH') ||
    up.includes('AISYAH') ||
    up.includes('FATIMAH') ||
    up.includes('HAFSHAH') ||
    up.includes('RUQAYYAH') ||
    up.includes('USTZ') ||
    up.includes('MUSYRIFAH')
  ) {
    return 'Putri';
  }
  return 'Putra';
}

function normalizePengampu(raw: string): string {
  const up = raw.trim().toUpperCase();
  if (!up || up === 'TIDAK DITEMUKAN' || up === '-') return '';
  if (up === 'UST, SOFYAN IMAM KELSABA' || up === 'UST. SOFYAN IMAM K') return 'UST. SOFYAN IMAM KELSABA';
  if (up === 'UST. ERDI JAYARI T') return 'UST. ERDI JAYARI TANJUNG';
  if (up === 'ILMAN HAMDANI') return 'UST. ILMAN HAMDANI';
  return up;
}

function makeUsername(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/^(ust\.|ustadz\.|ustz\.|ustadzah\.|ust,)\s*/i, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 24) || 'user'
  );
}

function sanitizeXmlText(val: unknown): string {
  return String(val ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

const FALLBACK_PUTRA_ROSTER: AuthenticRosterRow[] = [
  { no: '1', nama: 'ABDUL GHOFAR RAHMAN', kelas: '10 ABU BAKAR AS-SHIDDIQ', kamar: '10.6 Putra', kelompokQuran: '10-03 Putra', pengampuQuran: 'UST. NUR FAIZIN', gender: 'Putra' },
  { no: '2', nama: 'ACHMAD RASYA FARID', kelas: '10 ABU BAKAR AS-SHIDDIQ', kamar: '10.4 Putra', kelompokQuran: '10-08 Putra', pengampuQuran: 'UST. DAFFA M Z', gender: 'Putra' },
  { no: '7', nama: 'ARDANA PRANA SATRIA RAMADAN', kelas: '10 ABU BAKAR AS-SHIDDIQ', kamar: '10.8 Putra', kelompokQuran: '10-08 Putra', pengampuQuran: 'UST. DAFFA M Z', gender: 'Putra' },
  { no: '34', nama: 'ARIF AHKAM MAULANA', kelas: '10 ALI BIN ABI THALIB', kamar: '10.1 Putra', kelompokQuran: '10-09 Putra', pengampuQuran: 'UST. SOFYAN IMAM KELSABA', gender: 'Putra' },
  { no: '73', nama: 'GHAISAN WIDRATAMA AHLAM', kelas: '10 UMAR BIN KHATTAB', kamar: '10.9 Putra', kelompokQuran: '10-08 Putra', pengampuQuran: 'UST. DAFFA M Z', gender: 'Putra' },
  { no: '96', nama: 'AHMAD SYAKIR IHSAN', kelas: '10 UTSMAN BIN AFFAN', kamar: '10.5 Putra', kelompokQuran: '10-09 Putra', pengampuQuran: 'UST. SOFYAN IMAM KELSABA', gender: 'Putra' },
];

const DEFAULT_PUTRI_TEMPLATE_ROSTER: AuthenticRosterRow[] = [
  { no: 'P-01', nama: 'AISYAH HUMAIRA ZAHRA', kelas: '10 KHADIJAH BINTI KHUWAILID', kamar: '10.1 Putri', kelompokQuran: '10-01 Putri', pengampuQuran: 'USTZ. SITI MARIYAM', gender: 'Putri' },
  { no: 'P-02', nama: 'FATIMAH AZ-ZAHRA', kelas: '10 KHADIJAH BINTI KHUWAILID', kamar: '10.1 Putri', kelompokQuran: '10-01 Putri', pengampuQuran: 'USTZ. SITI MARIYAM', gender: 'Putri' },
  { no: 'P-03', nama: 'KHANSA ADILA RAHMAH', kelas: '10 AISYAH BINTI ABU BAKAR', kamar: '10.2 Putri', kelompokQuran: '10-02 Putri', pengampuQuran: 'USTZ. HANIFAH', gender: 'Putri' },
  { no: 'P-04', nama: 'NAYLA SALSABILA PUTRI', kelas: '10 AISYAH BINTI ABU BAKAR', kamar: '10.2 Putri', kelompokQuran: '10-02 Putri', pengampuQuran: 'USTZ. HANIFAH', gender: 'Putri' },
  { no: 'P-05', nama: 'HAFSHAH MUTIARA QOLBI', kelas: '11 FATIMAH AZ-ZAHRA', kamar: '11.1 Putri', kelompokQuran: '11-01 Putri', pengampuQuran: 'USTZ. MARYAM AL-HAFIDZAH', gender: 'Putri' },
  { no: 'P-06', nama: 'SALMA NURUL AINI', kelas: '12 RUQAYYAH BINTI MUHAMMAD', kamar: '12.1 Putri', kelompokQuran: '12-01 Putri', pengampuQuran: 'USTZ. MARYAM AL-HAFIDZAH', gender: 'Putri' },
];

let cachedAuthenticPutraRoster: AuthenticRosterRow[] | null = null;

export function loadAuthenticPutraRoster(): AuthenticRosterRow[] {
  if (cachedAuthenticPutraRoster) return cachedAuthenticPutraRoster;
  try {
    const assetPath = resolveIntegrasiAssetPath();
    if (!fs.existsSync(assetPath)) {
      cachedAuthenticPutraRoster = FALLBACK_PUTRA_ROSTER;
      return cachedAuthenticPutraRoster;
    }
    const raw = fs.readFileSync(assetPath, 'utf-8');
    const rows = parseCsvRowsSimple(raw);
    const seenNames = new Set<string>();
    const list: AuthenticRosterRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const no = (cols[0] || String(i)).trim();
      const nama = (cols[1] || '').trim().toUpperCase();
      const kelas = (cols[2] || '').trim().toUpperCase();
      const kamar = (cols[3] || '').trim();
      const kelompokQuran = (cols[4] || '').trim();
      const pengampuQuran = normalizePengampu(cols[5] || '');

      if (!nama || nama === kelas || seenNames.has(nama)) continue;
      seenNames.add(nama);

      list.push({
        no,
        nama,
        kelas,
        kamar,
        kelompokQuran,
        pengampuQuran,
        gender: inferGender(`${kelas} ${kamar} ${kelompokQuran}`),
      });
    }

    const putraList = list.filter((r) => r.gender === 'Putra');
    cachedAuthenticPutraRoster = putraList.length > 0 ? putraList : FALLBACK_PUTRA_ROSTER;
    return cachedAuthenticPutraRoster;
  } catch {
    cachedAuthenticPutraRoster = FALLBACK_PUTRA_ROSTER;
    return cachedAuthenticPutraRoster;
  }
}

function autoFitColumns(rows: string[][], minWidth = 12, maxWidth = 38): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = Array(colCount).fill(minWidth);
  for (let r = 0; r < Math.min(rows.length, 250); r++) {
    const row = rows[r];
    for (let c = 0; c < colCount; c++) {
      const len = String(row[c] ?? '').length + 3;
      if (len > widths[c]) widths[c] = Math.min(maxWidth, len);
    }
  }
  return widths.map((wch) => ({ wch: Math.round(wch) }));
}

function buildCombinedRosterForTemplate(ctx: TemplateContext): {
  putraRoster: AuthenticRosterRow[];
  putriRoster: AuthenticRosterRow[];
  putraSourceNote: string;
  putriSourceNote: string;
} {
  const livePutra = ctx.students.filter((s) => s.gender === 'Putra');
  const livePutri = ctx.students.filter((s) => s.gender === 'Putri');

  const putraRoster: AuthenticRosterRow[] =
    livePutra.length > 0
      ? livePutra.map((s, idx) => ({
          no: s.nis || String(idx + 1),
          nama: s.nama,
          kelas: s.kelas,
          kamar: s.kamar,
          kelompokQuran: s.kelompokQuran,
          pengampuQuran: s.pengampuQuran || '',
          waliKelas: s.waliKelas || '',
          musyrif: s.musyrif || '',
          guruWali: s.guruWali || '',
          gender: 'Putra',
        }))
      : loadAuthenticPutraRoster();

  const putriRoster: AuthenticRosterRow[] =
    livePutri.length > 0
      ? livePutri.map((s, idx) => ({
          no: s.nis || `P-${idx + 1}`,
          nama: s.nama,
          kelas: s.kelas,
          kamar: s.kamar,
          kelompokQuran: s.kelompokQuran,
          pengampuQuran: s.pengampuQuran || '',
          waliKelas: s.waliKelas || '',
          musyrif: s.musyrif || '',
          guruWali: s.guruWali || '',
          gender: 'Putri',
        }))
      : DEFAULT_PUTRI_TEMPLATE_ROSTER;

  return {
    putraRoster,
    putriRoster,
    putraSourceNote: livePutra.length > 0 ? 'Data Aktif DB' : 'Template IntegrASI Putra',
    putriSourceNote: livePutri.length > 0 ? 'Data Aktif DB' : 'Contoh Format Wilayah Putri (siap diedit)',
  };
}

/**
 * Generates pure master database workbook specification with explicit Wilayah Putra & Wilayah Putri
 * sheets (`1A_Siswa_Putra` & `1B_Siswa_Putri`) as well as Musyrif/Musyrifah, Wali/Guru, Jadwal, and Ruang Ujian.
 */
export function buildDatabaseWorkbookSpec(ctx: TemplateContext): {
  filename: string;
  sourceLabel: string;
  sheets: WorkbookSheetSpec[];
} {
  const { putraRoster, putriRoster, putraSourceNote, putriSourceNote } =
    buildCombinedRosterForTemplate(ctx);

  const roster = [...putraRoster, ...putriRoster];
  const putraCount = putraRoster.length;
  const putriCount = putriRoster.length;

  const sourceLabel = `Putra: ${putraCount} (${putraSourceNote}) · Putri: ${putriCount} (${putriSourceNote})`;

  const studentHeader = [
    'No / NIS',
    'Nama',
    'Wilayah (Putra/Putri)',
    'Nama Kelas',
    'Kamar',
    'Kelp. Al-Quran',
    'Pengampu Al-Quran',
    'Wali Kelas',
    'Wali Asrama / Musyrif',
    'Guru Wali',
  ];

  const sortRoster = (arr: AuthenticRosterRow[]) =>
    [...arr].sort(
      (a, b) =>
        a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) ||
        a.nama.localeCompare(b.nama),
    );

  // Sheet 1A: Master Siswa Wilayah Putra
  const santriPutraRows: string[][] = [
    studentHeader,
    ...sortRoster(putraRoster).map((r) => [
      sanitizeXmlText(r.no),
      sanitizeXmlText(r.nama),
      'Putra',
      sanitizeXmlText(r.kelas),
      sanitizeXmlText(r.kamar),
      sanitizeXmlText(r.kelompokQuran),
      sanitizeXmlText(r.pengampuQuran),
      sanitizeXmlText(r.waliKelas || ''),
      sanitizeXmlText(r.musyrif || ''),
      sanitizeXmlText(r.guruWali || ''),
    ]),
  ];

  // Sheet 1B: Master Siswa Wilayah Putri
  const santriPutriRows: string[][] = [
    studentHeader,
    ...sortRoster(putriRoster).map((r) => [
      sanitizeXmlText(r.no),
      sanitizeXmlText(r.nama),
      'Putri',
      sanitizeXmlText(r.kelas),
      sanitizeXmlText(r.kamar),
      sanitizeXmlText(r.kelompokQuran),
      sanitizeXmlText(r.pengampuQuran),
      sanitizeXmlText(r.waliKelas || ''),
      sanitizeXmlText(r.musyrif || ''),
      sanitizeXmlText(r.guruWali || ''),
    ]),
  ];

  // Sheet 2A & 2B: Tabel Terpisah Musyrif (Putra) dan Musyrifah (Putri)
  const roomGenderMap = new Map<string, Gender>();
  for (const r of roster) {
    if (r.kamar) roomGenderMap.set(r.kamar, r.gender);
  }
  for (const rm of ctx.rooms) {
    if (rm.kamar) roomGenderMap.set(rm.kamar, rm.gender);
  }
  const sortedRooms = Array.from(roomGenderMap.keys()).sort(
    (a, b) =>
      (roomGenderMap.get(a) || 'Putra').localeCompare(roomGenderMap.get(b) || 'Putra') ||
      a.localeCompare(b, 'id', { numeric: true }),
  );

  const musyrifPutraBody: string[][] = [];
  const musyrifahPutriBody: string[][] = [];
  const coveredRooms = new Set<string>();

  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    if ((t.kamarBinaan && t.kamarBinaan.length > 0) || t.peran === 'Musyrif' || t.peran === 'Musyrifah') {
      const isPutri =
        t.genderScope === 'Putri' ||
        t.peran === 'Musyrifah' ||
        (t.kamarBinaan || []).some((km) => inferGender(km) === 'Putri');
      const targetBody = isPutri ? musyrifahPutriBody : musyrifPutraBody;
      targetBody.push([
        String(targetBody.length + 1),
        sanitizeXmlText(t.nama),
        sanitizeXmlText((t.kamarBinaan || []).join('; ')),
        isPutri ? 'Putri' : 'Putra',
        sanitizeXmlText(t.whatsapp || '628'),
        sanitizeXmlText(t.username),
        '1234',
      ]);
      (t.kamarBinaan || []).forEach((km) => coveredRooms.add(km.toUpperCase()));
    }
  }

  if (!coveredRooms.has('10.4 PUTRA') && sortedRooms.includes('10.4 Putra')) {
    musyrifPutraBody.push([
      String(musyrifPutraBody.length + 1),
      'UST. FATIH',
      sortedRooms.includes('10.8 Putra') ? '10.4 Putra; 10.8 Putra' : '10.4 Putra',
      'Putra',
      '628123456700',
      'ust.fatih',
      '1234',
    ]);
    coveredRooms.add('10.4 PUTRA');
    coveredRooms.add('10.8 PUTRA');
  }
  if (!coveredRooms.has('10.1 PUTRI') && sortedRooms.includes('10.1 Putri')) {
    musyrifahPutriBody.push([
      String(musyrifahPutriBody.length + 1),
      'USTZ. RAHMAH MUSYRIFAH',
      sortedRooms.includes('10.2 Putri') ? '10.1 Putri; 10.2 Putri' : '10.1 Putri',
      'Putri',
      '628123456701',
      'ustz.rahmah',
      '1234',
    ]);
    coveredRooms.add('10.1 PUTRI');
    coveredRooms.add('10.2 PUTRI');
  }

  for (const rm of sortedRooms) {
    if (coveredRooms.has(rm.toUpperCase())) continue;
    const roomGender = roomGenderMap.get(rm) || inferGender(rm);
    const isPutri = roomGender === 'Putri';
    const targetBody = isPutri ? musyrifahPutriBody : musyrifPutraBody;
    targetBody.push([
      String(targetBody.length + 1),
      '(Belum Ditentukan)',
      sanitizeXmlText(rm),
      isPutri ? 'Putri' : 'Putra',
      '',
      '',
      '',
    ]);
  }

  const musyrifPutraRows: string[][] = [
    ['No', 'Nama Musyrif', 'Kamar Binaan (pisah ;)', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...musyrifPutraBody,
  ];

  const musyrifahPutriRows: string[][] = [
    ['No', 'Nama Musyrifah', 'Kamar Binaan (pisah ;)', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...musyrifahPutriBody,
  ];

  // Sheet 3A, 3B & 3C: Tabel Terpisah Wali Kelas Putra, Wali Kelas Putri, dan Guru Pengampu
  const classGenderMap = new Map<string, Gender>();
  const pengampuMap = new Map<string, Gender>();
  for (const r of roster) {
    if (r.kelas) classGenderMap.set(r.kelas, r.gender);
    if (r.pengampuQuran) pengampuMap.set(r.pengampuQuran.toUpperCase(), r.gender);
  }
  const sortedClasses = Array.from(classGenderMap.keys()).sort(
    (a, b) =>
      (classGenderMap.get(a) || 'Putra').localeCompare(classGenderMap.get(b) || 'Putra') ||
      a.localeCompare(b, 'id', { numeric: true }),
  );
  const waliByClass = new Map<string, TeacherPublic>();
  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    if (t.waliKelasOf) waliByClass.set(t.waliKelasOf.toUpperCase(), t);
  }

  const waliPutraBody: string[][] = [];
  const waliPutriBody: string[][] = [];
  const addedWaliNames = new Set<string>();

  for (const kls of sortedClasses) {
    const existing = waliByClass.get(kls.toUpperCase());
    const classGender = classGenderMap.get(kls) || inferGender(kls);
    const isPutri = classGender === 'Putri';
    const targetBody = isPutri ? waliPutriBody : waliPutraBody;
    if (existing) {
      targetBody.push([
        String(targetBody.length + 1),
        sanitizeXmlText(existing.nama),
        sanitizeXmlText(kls),
        isPutri ? 'Putri' : 'Putra',
        sanitizeXmlText(existing.whatsapp || '628'),
        sanitizeXmlText(existing.username),
        '1234',
      ]);
      addedWaliNames.add(existing.nama.toUpperCase());
    } else {
      targetBody.push([
        String(targetBody.length + 1),
        '(Belum Ditentukan)',
        sanitizeXmlText(kls),
        isPutri ? 'Putri' : 'Putra',
        '',
        '',
        '',
      ]);
    }
  }

  const waliPutraRows: string[][] = [
    ['No', 'Nama Wali Kelas', 'Kelas Binaan', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...waliPutraBody,
  ];

  const waliPutriRows: string[][] = [
    ['No', 'Nama Wali Kelas', 'Kelas Binaan', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...waliPutriBody,
  ];

  // Sheet 3C: Guru Mapel & Pengampu Al-Qur'an
  const guruBody: string[][] = [];
  const addedGuruNames = new Set<string>();
  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    if (t.peran === 'Guru') {
      guruBody.push([
        String(guruBody.length + 1),
        sanitizeXmlText(t.nama),
        'Guru',
        sanitizeXmlText(t.genderScope || 'Semua'),
        sanitizeXmlText(t.whatsapp || '628'),
        sanitizeXmlText(t.username),
        '1234',
      ]);
      addedGuruNames.add(t.nama.toUpperCase());
    }
  }
  for (const [pengampu, g] of Array.from(pengampuMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (addedGuruNames.has(pengampu) || addedWaliNames.has(pengampu)) continue;
    guruBody.push([
      String(guruBody.length + 1),
      sanitizeXmlText(pengampu),
      'Guru / Pengampu Al-Quran',
      g,
      '628',
      makeUsername(pengampu),
      '1234',
    ]);
    addedGuruNames.add(pengampu);
  }
  const guruRows: string[][] = [
    ['No', 'Nama Guru / Pengampu', 'Peran / Bidang', 'Wilayah (Putra/Putri/Semua)', 'WhatsApp', 'Username / Email', 'PIN'],
    ...guruBody,
  ];

  // Sheet Master_Pegawai: Daftar seluruh Pegawai / Ustadz / Ustadzah (bisa diupload nama saja lalu klik amanah di aplikasi)
  const pegawaiMap = new Map<
    string,
    {
      nama: string;
      wilayah: 'Putra' | 'Putri' | 'Semua';
      amanahUtama: string;
      amanahTambahan: string[];
      kelasBinaan: string;
      kamarBinaan: string;
      whatsapp: string;
      username: string;
      pin: string;
    }
  >();

  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    pegawaiMap.set(t.nama.toUpperCase(), {
      nama: sanitizeXmlText(t.nama),
      wilayah: t.genderScope || 'Semua',
      amanahUtama: t.peran,
      amanahTambahan: (t.peranTambahan || []).filter((p) => p !== t.peran),
      kelasBinaan: sanitizeXmlText(t.waliKelasOf || ''),
      kamarBinaan: sanitizeXmlText((t.kamarBinaan || []).join('; ')),
      whatsapp: sanitizeXmlText(t.whatsapp || '628'),
      username: sanitizeXmlText(t.username),
      pin: '1234',
    });
  }

  const upsertTemplatePegawai = (
    nama: string,
    wilayah: 'Putra' | 'Putri' | 'Semua',
    role: string,
    opts: { kelas?: string; kamar?: string; wa?: string; user?: string },
  ) => {
    const key = nama.trim().toUpperCase();
    if (!key || key === '(BELUM DITENTUKAN)' || key === 'BELUM DIATUR') return;
    const prev = pegawaiMap.get(key);
    if (prev) {
      if (prev.amanahUtama !== role && !prev.amanahTambahan.includes(role)) {
        prev.amanahTambahan.push(role);
      }
      if (!prev.kelasBinaan && opts.kelas) prev.kelasBinaan = opts.kelas;
      if (!prev.kamarBinaan && opts.kamar) prev.kamarBinaan = opts.kamar;
      if ((!prev.whatsapp || prev.whatsapp === '628') && opts.wa) prev.whatsapp = opts.wa;
      if (!prev.username && opts.user) prev.username = opts.user;
    } else {
      pegawaiMap.set(key, {
        nama: sanitizeXmlText(nama),
        wilayah,
        amanahUtama: role,
        amanahTambahan: [],
        kelasBinaan: sanitizeXmlText(opts.kelas || ''),
        kamarBinaan: sanitizeXmlText(opts.kamar || ''),
        whatsapp: sanitizeXmlText(opts.wa || '628'),
        username: sanitizeXmlText(opts.user || makeUsername(nama)),
        pin: '1234',
      });
    }
  };

  for (const r of musyrifPutraBody) {
    upsertTemplatePegawai(r[1], 'Putra', 'Musyrif', { kamar: r[2], wa: r[4], user: r[5] });
  }
  for (const r of musyrifahPutriBody) {
    upsertTemplatePegawai(r[1], 'Putri', 'Musyrifah', { kamar: r[2], wa: r[4], user: r[5] });
  }
  for (const r of waliPutraBody) {
    upsertTemplatePegawai(r[1], 'Putra', 'Wali Kelas', { kelas: r[2], wa: r[4], user: r[5] });
  }
  for (const r of waliPutriBody) {
    upsertTemplatePegawai(r[1], 'Putri', 'Wali Kelas', { kelas: r[2], wa: r[4], user: r[5] });
  }
  for (const r of guruBody) {
    const w: 'Putra' | 'Putri' | 'Semua' =
      r[3] === 'Putri' ? 'Putri' : r[3] === 'Putra' ? 'Putra' : 'Semua';
    upsertTemplatePegawai(r[1], w, 'Guru', { wa: r[4], user: r[5] });
  }

  const masterPegawaiBody: string[][] = Array.from(pegawaiMap.values())
    .sort((a, b) => a.wilayah.localeCompare(b.wilayah) || a.nama.localeCompare(b.nama))
    .map((p, idx) => [
      String(idx + 1),
      p.nama,
      p.wilayah,
      p.amanahUtama,
      p.amanahTambahan.join('; '),
      p.kelasBinaan,
      p.kamarBinaan,
      p.whatsapp,
      p.username,
      p.pin,
    ]);

  const masterPegawaiRows: string[][] = [
    [
      'No',
      'Nama Pegawai',
      'Wilayah (Putra/Putri/Semua)',
      'Amanah Utama (Guru/Wali Kelas/Musyrif/Musyrifah)',
      'Amanah Tambahan (pisah ;)',
      'Kelas Binaan',
      'Kamar Binaan (pisah ;)',
      'WhatsApp',
      'Username / Email',
      'PIN',
    ],
    ...masterPegawaiBody,
  ];

  // Sheet 4: Jadwal Mengajar & Halaqah (Putra & Putri)
  let jadwalBody: string[][] = [];
  if (ctx.schedules.length > 0) {
    jadwalBody = ctx.schedules.map((s) => [
      sanitizeXmlText(s.guru),
      sanitizeXmlText(s.hari),
      sanitizeXmlText(s.kelas),
      sanitizeXmlText(s.mapel),
      sanitizeXmlText(s.jamKe),
      sanitizeXmlText(s.gender),
    ]);
  } else {
    for (const kls of sortedClasses) {
      const assignedWali = waliByClass.get(kls.toUpperCase());
      if (!assignedWali) continue;
      const klsGender = classGenderMap.get(kls) || inferGender(kls);
      jadwalBody.push([
        sanitizeXmlText(assignedWali.nama),
        'SENIN',
        sanitizeXmlText(kls),
        'BAHASA ARAB',
        '1-2',
        klsGender,
      ]);
    }
    const halaqahPairs = new Map<string, { guru: string; kelompok: string; gender: Gender }>();
    for (const r of roster) {
      if (r.pengampuQuran && r.kelompokQuran) {
        halaqahPairs.set(`${r.pengampuQuran}|${r.kelompokQuran}`, {
          guru: r.pengampuQuran,
          kelompok: r.kelompokQuran,
          gender: r.gender,
        });
      }
    }
    const putraPairs = Array.from(halaqahPairs.values()).filter((p) => p.gender === 'Putra').slice(0, 8);
    const putriPairs = Array.from(halaqahPairs.values()).filter((p) => p.gender === 'Putri').slice(0, 8);
    for (const pair of [...putraPairs, ...putriPairs]) {
      jadwalBody.push([
        sanitizeXmlText(pair.guru),
        'SENIN',
        sanitizeXmlText(pair.kelompok),
        "HALAQAH AL-QUR'AN",
        '5-6',
        pair.gender,
      ]);
    }
  }
  const jadwalRows: string[][] = [
    ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
    ...jadwalBody,
  ];

  // Sheet 5: Ruang Ujian Putra & Putri
  const existingRooms =
    ctx.ruanganUjian && ctx.ruanganUjian.length > 0
      ? ctx.ruanganUjian
      : [
          'RUANG 01 PUTRA - AL-GHAZALI',
          'RUANG 02 PUTRA - IBNU SINA',
          'RUANG 01 PUTRI - KHADIJAH',
          'RUANG 02 PUTRI - AISYAH',
        ];
  const ruangRows: string[][] = [
    ['Nama Ruangan Ujian', 'Wilayah (Putra/Putri/Semua)'],
    ...existingRooms.map((r) => [
      sanitizeXmlText(r),
      r.toUpperCase().includes('PUTRI') ? 'Putri' : r.toUpperCase().includes('PUTRA') ? 'Putra' : 'Semua',
    ]),
  ];

  // Sheet 0: Panduan Singkat + Ringkasan Tabel Terpisah
  const guideRows: string[][] = [
    ['TEMPLATE DATABASE MASTER SEKOLAH (.XLSX) - PINTAR TERPADU (WILAYAH PUTRA & PUTRI)'],
    ['TIPS CEPAT: Anda TIDAK harus mengisi semua sheet. Cukup upload Sheet Master_Pegawai (bahkan hanya Nama Pegawai saja), lalu di aplikasi Admin Super klik Nama Pegawai -> klik Amanah Kamar / Wali Kelas / Musyrif / Guru!'],
    ['Pemisahan Sheet: Siswa (1A/1B), Master_Pegawai, Musyrif Putra (2A), Musyrifah Putri (2B), Wali Kelas Putra (3A), Wali Kelas Putri (3B), dan Guru Pengampu (3C).'],
    [''],
    ['Nama Sheet', 'Isi Tabel Khusus', 'Jumlah Baris', 'Kolom Utama & Keterangan'],
    ['1A_Siswa_Putra', 'Master Santri Wilayah Putra', String(santriPutraRows.length - 1), `${putraCount} santri Putra (${putraSourceNote}).`],
    ['1B_Siswa_Putri', 'Master Santri Wilayah Putri', String(santriPutriRows.length - 1), `${putriCount} santri Putri (${putriSourceNote}).`],
    ['Master_Pegawai', 'Daftar Induk Seluruh Pegawai', String(masterPegawaiRows.length - 1), 'Boleh isi Nama Pegawai saja dulu, lalu klik amanah kamar/kelas di aplikasi!'],
    ['2A_Musyrif_Putra', 'Tabel Musyrif Asrama Putra', String(musyrifPutraRows.length - 1), 'No | Nama Musyrif | Kamar Binaan (pisah ;) | Wilayah | WhatsApp | Username | PIN'],
    ['2B_Musyrifah_Putri', 'Tabel Musyrifah Asrama Putri', String(musyrifahPutriRows.length - 1), 'No | Nama Musyrifah | Kamar Binaan (pisah ;) | Wilayah | WhatsApp | Username | PIN'],
    ['3A_Wali_Kelas_Putra', 'Tabel Wali Kelas Wilayah Putra', String(waliPutraRows.length - 1), 'No | Nama Wali Kelas | Kelas Binaan | Wilayah | WhatsApp | Username | PIN'],
    ['3B_Wali_Kelas_Putri', 'Tabel Wali Kelas Wilayah Putri', String(waliPutriRows.length - 1), 'No | Nama Wali Kelas | Kelas Binaan | Wilayah | WhatsApp | Username | PIN'],
    ['3C_Guru_Pengampu', 'Tabel Guru Mapel & Pengampu Qur’an', String(guruRows.length - 1), 'No | Nama Guru | Peran | Wilayah (Putra/Putri/Semua) | WhatsApp | Username | PIN'],
    ['4_Jadwal_Mengajar', 'Jadwal Akademik & Halaqah Putra/Putri', String(jadwalRows.length - 1), 'Hari: SENIN-SABTU (Senin/Jumat 6 JP, Sel-Kam 9 JP, Sabtu 7 JP).'],
    ['5_Ruang_Ujian', 'Daftar Ruangan Ujian Putra & Putri', String(ruangRows.length - 1), 'Tandai ruangan Putra / Putri / Semua.'],
    [''],
    ['CARA PRAKTIS:'],
    ['1. Upload Sheet Master_Pegawai (atau paste daftar nama di panel Admin Super -> tab 2. Master Pegawai & Amanah).'],
    ['2. Klik nama pegawai yang sudah masuk, lalu klik amanah Kamar Asrama, Kelas Wali, Musyrif/ah, atau Guru langsung dari aplikasi.'],
  ];

  return {
    filename: 'Template_Database_PINTAR_SIM.xlsx',
    sourceLabel,
    sheets: [
      { name: '0_Panduan', label: 'Panduan & Peta Sheet', rows: guideRows },
      { name: '1A_Siswa_Putra', label: 'Santri Wilayah Putra', rows: santriPutraRows },
      { name: '1B_Siswa_Putri', label: 'Santri Wilayah Putri', rows: santriPutriRows },
      { name: 'Master_Pegawai', label: 'Daftar Induk Pegawai', rows: masterPegawaiRows },
      { name: '2A_Musyrif_Putra', label: 'Musyrif Asrama Putra', rows: musyrifPutraRows },
      { name: '2B_Musyrifah_Putri', label: 'Musyrifah Asrama Putri', rows: musyrifahPutriRows },
      { name: '3A_Wali_Kelas_Putra', label: 'Wali Kelas Putra', rows: waliPutraRows },
      { name: '3B_Wali_Kelas_Putri', label: 'Wali Kelas Putri', rows: waliPutriRows },
      { name: '3C_Guru_Pengampu', label: 'Guru & Pengampu Qur’an', rows: guruRows },
      { name: '4_Jadwal_Mengajar', label: 'Jadwal Putra & Putri', rows: jadwalRows },
      { name: '5_Ruang_Ujian', label: 'Ruang Ujian Putra/Putri', rows: ruangRows },
    ],
  };
}

function buildSheetWithTextCells(rows: string[][]): XLSX.WorkSheet {
  const ws = XLSX_API.utils.aoa_to_sheet(rows);
  ws['!cols'] = autoFitColumns(rows);
  const range = ws['!ref'] ? XLSX_API.utils.decode_range(ws['!ref']) : null;
  if (range) {
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX_API.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
          cell.t = 's';
          cell.z = '@';
          cell.v = String(cell.v ?? '');
        }
      }
    }
  }
  return ws;
}

export function buildDatabaseWorkbookBuffer(ctx: TemplateContext): {
  filename: string;
  buffer: Buffer;
} {
  const spec = buildDatabaseWorkbookSpec(ctx);
  const wb = XLSX_API.utils.book_new();
  for (const sheet of spec.sheets) {
    const ws = buildSheetWithTextCells(sheet.rows);
    XLSX_API.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const buffer = XLSX_API.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  }) as Buffer;

  return {
    filename: spec.filename,
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
  };
}

/**
 * Builds a tailored .xlsx workbook specification for an individual logged-in
 * Guru, Wali Kelas, Musyrif, or Musyrifah (including Putra & Putri support).
 */
export function buildPersonalLoginWorkbookSpec(
  ctx: TemplateContext,
  teacher: TeacherPublic,
): {
  filename: string;
  sourceLabel: string;
  sheets: WorkbookSheetSpec[];
} {
  const { putraRoster, putriRoster } = buildCombinedRosterForTemplate(ctx);
  const todayStr = new Date().toISOString().slice(0, 10);

  const filterForTeacher = (arr: AuthenticRosterRow[]): AuthenticRosterRow[] => {
    const kelasTarget = (teacher.waliKelasOf || '').toUpperCase();
    const kamarTargets = (teacher.kamarBinaan || []).map((k) => k.toUpperCase());
    const matched = arr.filter((r) => {
      if (kelasTarget && r.kelas.toUpperCase() === kelasTarget) return true;
      if (kamarTargets.length > 0 && kamarTargets.includes(r.kamar.toUpperCase())) return true;
      if (r.pengampuQuran && r.pengampuQuran.toUpperCase().includes(teacher.nama.toUpperCase())) return true;
      return false;
    });
    return matched.length > 0 ? matched : arr.slice(0, 5);
  };

  const studentHeader = [
    'No / NIS',
    'Nama',
    'Wilayah (Putra/Putri)',
    'Nama Kelas',
    'Kamar',
    'Kelp. Al-Quran',
    'Pengampu Al-Quran',
    'Wali Kelas',
    'Wali Asrama / Musyrif',
    'Guru Wali',
  ];

  const putraPersonal = filterForTeacher(putraRoster);
  const putriPersonal = filterForTeacher(putriRoster);

  const putraSheetRows: string[][] = [
    studentHeader,
    ...putraPersonal.map((r) => [
      sanitizeXmlText(r.no),
      sanitizeXmlText(r.nama),
      'Putra',
      sanitizeXmlText(teacher.waliKelasOf && teacher.genderScope !== 'Putri' ? teacher.waliKelasOf : r.kelas),
      sanitizeXmlText(r.kamar),
      sanitizeXmlText(r.kelompokQuran),
      sanitizeXmlText(r.pengampuQuran || teacher.nama),
      sanitizeXmlText(r.waliKelas || (teacher.peran === 'Wali Kelas' ? teacher.nama : '')),
      sanitizeXmlText(r.musyrif || (teacher.peran === 'Musyrif' || teacher.peran === 'Wali Asrama' ? teacher.nama : '')),
      sanitizeXmlText(r.guruWali || (teacher.peran === 'Guru Wali' ? teacher.nama : '')),
    ]),
  ];

  const putriSheetRows: string[][] = [
    studentHeader,
    ...putriPersonal.map((r) => [
      sanitizeXmlText(r.no),
      sanitizeXmlText(r.nama),
      'Putri',
      sanitizeXmlText(teacher.waliKelasOf && teacher.genderScope === 'Putri' ? teacher.waliKelasOf : r.kelas),
      sanitizeXmlText(r.kamar),
      sanitizeXmlText(r.kelompokQuran),
      sanitizeXmlText(r.pengampuQuran || teacher.nama),
      sanitizeXmlText(r.waliKelas || (teacher.peran === 'Wali Kelas' ? teacher.nama : '')),
      sanitizeXmlText(r.musyrif || (teacher.peran === 'Musyrifah' || teacher.peran === 'Wali Asrama' ? teacher.nama : '')),
      sanitizeXmlText(r.guruWali || (teacher.peran === 'Guru Wali' ? teacher.nama : '')),
    ]),
  ];

  const mySchedules = ctx.schedules.filter(
    (s) => s.guru.toUpperCase().includes(teacher.nama.toUpperCase()) || teacher.nama.toUpperCase().includes(s.guru.toUpperCase()),
  );
  const defaultWilayah = teacher.genderScope === 'Putri' ? 'Putri' : 'Putra';
  const jadwalRows: string[][] = [
    ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
    ...(mySchedules.length > 0
      ? mySchedules.map((s) => [
          sanitizeXmlText(s.guru),
          sanitizeXmlText(s.hari),
          sanitizeXmlText(s.kelas),
          sanitizeXmlText(s.mapel),
          sanitizeXmlText(s.jamKe),
          sanitizeXmlText(s.gender),
        ])
      : [
          [
            sanitizeXmlText(teacher.nama),
            'SENIN',
            sanitizeXmlText(
              teacher.waliKelasOf ||
                (defaultWilayah === 'Putri' ? '10 KHADIJAH BINTI KHUWAILID' : '10 ABU BAKAR AS-SHIDDIQ'),
            ),
            'BAHASA ARAB',
            '1-2',
            defaultWilayah,
          ],
          [
            sanitizeXmlText(teacher.nama),
            'SELASA',
            sanitizeXmlText(defaultWilayah === 'Putri' ? '10-01 Putri' : '10-08 Putra'),
            "HALAQAH AL-QUR'AN",
            '5-6',
            defaultWilayah,
          ],
        ]),
  ];

  const pembinaanSampleSantri =
    teacher.genderScope === 'Putri' ? putriPersonal[0] : putraPersonal[0];
  const pembinaanRows: string[][] = [
    [
      'Tanggal (YYYY-MM-DD)',
      'Nama Santri',
      'Wilayah (Putra/Putri)',
      'Kategori (Pemantauan Ibadah/Pembinaan Karakter/Kedisiplinan/Prestasi/Kesehatan)',
      'Uraian Pembinaan / Catatan',
      'Poin (+/-)',
      'Status (Selesai/Proses/Eskalasi)',
      'Tindak Lanjut',
      'Jalur Pembinaan (Wali Kelas / Guru Wali / Room Visit Asrama)',
      'Momen Pembinaan (Klasikal Pekanan / Khusus Individu)',
    ],
    [
      todayStr,
      sanitizeXmlText(pembinaanSampleSantri?.nama || 'CONTOH NAMA SANTRI'),
      pembinaanSampleSantri?.gender || defaultWilayah,
      'Pemantauan Ibadah',
      'Contoh: Momen klasikal pekanan & setoran hafalan tertib.',
      '5',
      'Selesai',
      'Pertahankan murojaah harian',
      teacher.peran === 'Musyrif' || teacher.peran === 'Musyrifah' || teacher.peran === 'Wali Asrama'
        ? 'Room Visit Asrama'
        : teacher.peran === 'Guru Wali'
        ? 'Guru Wali'
        : 'Wali Kelas',
      'Klasikal Pekanan',
    ],
  ];

  const guideRows: string[][] = [
    [`TEMPLATE UPLOAD KHUSUS LOGIN: ${teacher.nama} (${teacher.peran} · Wilayah ${teacher.genderScope})`],
    ['File ini dapat diupload langsung melalui menu Login Akun Saya -> tab Upload Template & Input Langsung.'],
    [''],
    ['Sheet Tersedia', 'Fungsi Upload'],
    ['1A_Siswa_Putra', 'Tambah atau perbarui santri Wilayah Putra yang terhubung ke akun Anda'],
    ['1B_Siswa_Putri', 'Tambah atau perbarui santri Wilayah Putri yang terhubung ke akun Anda'],
    ['4_Jadwal_Mengajar', 'Tambah atau perbarui jadwal mengajar & halaqah atas nama akun Anda'],
    ['6_Catatan_Pembinaan', 'Unggah catatan pembinaan santri (otomatis masuk portofolio & akun pembina)'],
  ];

  const sheets: WorkbookSheetSpec[] = [
    { name: '0_Panduan_Login', label: 'Panduan Login Pembina', rows: guideRows },
    { name: '1A_Siswa_Putra', label: 'Santri Wilayah Putra', rows: putraSheetRows },
    { name: '1B_Siswa_Putri', label: 'Santri Wilayah Putri', rows: putriSheetRows },
    { name: '4_Jadwal_Mengajar', label: 'Jadwal Saya', rows: jadwalRows },
    { name: '6_Catatan_Pembinaan', label: 'Upload Pembinaan', rows: pembinaanRows },
  ];

  const cleanUser = makeUsername(teacher.username || teacher.nama);
  return {
    filename: `Template_Upload_${cleanUser}.xlsx`,
    sourceLabel: `Template Login ${teacher.nama} (${teacher.peran} · Wilayah ${teacher.genderScope})`,
    sheets,
  };
}

export function buildPersonalLoginWorkbookBuffer(
  ctx: TemplateContext,
  teacher: TeacherPublic,
): {
  filename: string;
  buffer: Buffer;
} {
  const spec = buildPersonalLoginWorkbookSpec(ctx, teacher);
  const wb = XLSX_API.utils.book_new();
  for (const sheet of spec.sheets) {
    const ws = buildSheetWithTextCells(sheet.rows);
    XLSX_API.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const buffer = XLSX_API.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  }) as Buffer;

  return {
    filename: spec.filename,
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
  };
}
