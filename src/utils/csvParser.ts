import type { Gender, PembinaanKategori, UserRole } from '../types';

export function inferGenderFromText(...texts: Array<string | undefined>): Gender {
  const combined = texts.filter(Boolean).join(' ').toUpperCase();
  if (
    combined.includes('PUTRI') ||
    combined.includes('AKHWAT') ||
    combined.includes('MUSYRIFAH') ||
    combined.includes('USTZ') ||
    /\bP\b/.test(combined)
  ) {
    return 'Putri';
  }
  return 'Putra';
}

export interface ParsedSantriSimRow {
  nis: string;
  nama: string;
  kelas: string;
  kamar: string;
  kelompokQuran: string;
  pengampuQuran: string;
  waliKelas?: string;
  musyrif?: string;
  gender: Gender;
  warning?: string;
}

function normalizePengampuName(raw: string): string {
  const up = raw.trim().toUpperCase();
  if (!up || up === 'TIDAK DITEMUKAN' || up === '-' || up === 'KOSONG') return '';
  if (up === 'UST, SOFYAN IMAM KELSABA' || up === 'UST. SOFYAN IMAM K') {
    return 'UST. SOFYAN IMAM KELSABA';
  }
  if (up === 'UST. ERDI JAYARI T') return 'UST. ERDI JAYARI TANJUNG';
  if (up === 'ILMAN HAMDANI') return 'UST. ILMAN HAMDANI';
  return up;
}

export function parseSantriSimRows(rows: string[][], forcedGender?: Gender): ParsedSantriSimRow[] {
  if (rows.length === 0) return [];
  const first = rows[0].map((c) => c.toLowerCase().trim());
  const hasHeader =
    first.some((c) => c.includes('nama')) &&
    first.some(
      (c) =>
        c.includes('kelas') ||
        c.includes('kamar') ||
        c.includes('wilayah') ||
        c.includes('quran') ||
        c.includes('halaqah')
    );

  const findHeaderIdx = (...needles: string[]): number => {
    for (const n of needles) {
      const idx = first.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const wilayahColIdx = hasHeader
    ? findHeaderIdx('wilayah', 'gender', 'l/p', 'jenis kelamin')
    : -1;
  const namaColIdx = hasHeader
    ? first.findIndex((h) => h.includes('nama') && !h.includes('kelas') && !h.includes('wali') && !h.includes('ortu'))
    : -1;
  const kelasColIdx = hasHeader
    ? first.findIndex((h) => h.includes('kelas') && !h.includes('wali'))
    : -1;
  const kamarColIdx = hasHeader ? findHeaderIdx('kamar', 'asrama') : -1;
  const waliColIdx = hasHeader ? findHeaderIdx('wali kelas', 'walikelas') : -1;
  const musyrifColIdx = hasHeader ? findHeaderIdx('musyrif', 'musrif') : -1;

  // Handle Kelp. Al-Quran & Pengampu Al-Quran (including Salinan_dari_integrASI where both headers say Kelp. Al-Quran)
  let kelompokColIdx = -1;
  let pengampuColIdx = -1;
  if (hasHeader) {
    kelompokColIdx = first.findIndex(
      (h) => (h.includes('kelp') || h.includes('kelompok') || h.includes('halaqah')) && !h.includes('pengampu')
    );
    pengampuColIdx = first.findIndex(
      (h, idx) =>
        idx !== kelompokColIdx &&
        (h.includes('pengampu') || h.includes('muallim') || h.includes('ustadz') || h.includes('quran'))
    );
  }

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const seenNames = new Set<string>();
  const parsed: ParsedSantriSimRow[] = [];

  for (const cols of dataRows) {
    const col0 = (cols[0] || '').trim();
    const nama = (namaColIdx >= 0 ? cols[namaColIdx] || '' : cols[1] || '').trim().toUpperCase();
    if (!nama) continue;

    // Detect explicit Wilayah column at index 2 (7-column template) or header index
    const rawCol2 = (cols[2] || '').trim().toUpperCase();
    const hasExplicitWilayahAt2 =
      wilayahColIdx === 2 ||
      (wilayahColIdx === -1 &&
        cols.length >= 7 &&
        (rawCol2 === 'PUTRA' || rawCol2 === 'PUTRI' || rawCol2 === 'IKHWAN' || rawCol2 === 'AKHWAT'));

    const explicitWilayah =
      wilayahColIdx >= 0
        ? (cols[wilayahColIdx] || '').trim()
        : hasExplicitWilayahAt2
        ? (cols[2] || '').trim()
        : '';

    const offset = hasExplicitWilayahAt2 ? 1 : 0;
    const kelas = (kelasColIdx >= 0 ? cols[kelasColIdx] || '' : cols[2 + offset] || '')
      .trim()
      .toUpperCase();
    const kamar = (kamarColIdx >= 0 ? cols[kamarColIdx] || '' : cols[3 + offset] || '').trim();
    const kelompokQuran = (
      kelompokColIdx >= 0 ? cols[kelompokColIdx] || '' : cols[4 + offset] || ''
    ).trim();
    const rawPengampu = (
      pengampuColIdx >= 0 ? cols[pengampuColIdx] || '' : cols[5 + offset] || ''
    ).trim();
    const pengampuQuran = normalizePengampuName(rawPengampu);

    const waliKelas =
      waliColIdx >= 0 ? (cols[waliColIdx] || '').trim().toUpperCase() || undefined : undefined;
    const musyrif =
      musyrifColIdx >= 0 ? (cols[musyrifColIdx] || '').trim().toUpperCase() || undefined : undefined;

    let warning: string | undefined;
    if (nama === kelas) {
      warning = 'Nama identik dengan Nama Kelas';
    } else if (seenNames.has(nama)) {
      warning = 'Duplikat nama santri dalam file';
    }
    seenNames.add(nama);

    const gender: Gender = explicitWilayah
      ? explicitWilayah.toUpperCase().includes('PUTRI') ||
        explicitWilayah.toUpperCase().includes('AKHWAT') ||
        explicitWilayah.toUpperCase() === 'P'
        ? 'Putri'
        : 'Putra'
      : forcedGender || inferGenderFromText(kelas, kamar, kelompokQuran, pengampuQuran);

    parsed.push({
      nis: col0,
      nama,
      kelas,
      kamar,
      kelompokQuran,
      pengampuQuran,
      waliKelas: waliKelas && waliKelas !== '-' ? waliKelas : undefined,
      musyrif: musyrif && musyrif !== '-' ? musyrif : undefined,
      gender,
      warning,
    });
  }

  return parsed;
}

export interface ParsedScheduleRow {
  guru: string;
  hari: string;
  kelas: string;
  mapel: string;
  jamKe: string;
  gender: Gender;
  kategori: 'Akademik' | 'Al-Quran';
}

export function parseScheduleRows(rows: string[][]): ParsedScheduleRow[] {
  if (rows.length === 0) return [];
  const first = rows[0].map((c) => c.toLowerCase().trim());
  const hasHeader = first.some(
    (c) => c.includes('guru') || c.includes('pengajar') || c.includes('mapel') || c.includes('hari')
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const findCol = (...needles: string[]): number => {
    for (const n of needles) {
      const idx = first.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const guruIdx = hasHeader ? findCol('guru', 'pengajar', 'ustadz', 'nama') : -1;
  const hariIdx = hasHeader ? findCol('hari') : -1;
  const kelasIdx = hasHeader ? findCol('kelas', 'halaqah', 'rombel') : -1;
  const mapelIdx = hasHeader ? findCol('mapel', 'mata pelajaran', 'pelajaran') : -1;
  const jamIdx = hasHeader ? findCol('jam', 'jp') : -1;
  const genderIdx = hasHeader ? findCol('wilayah', 'gender', 'unit') : -1;
  const katIdx = hasHeader ? findCol('kategori', 'jenis') : -1;

  const parsed: ParsedScheduleRow[] = [];
  for (const cols of dataRows) {
    const hasLeadingNumber = !hasHeader && /^\d+$/.test((cols[0] || '').trim());
    const base = hasLeadingNumber ? 1 : 0;

    const guru = (guruIdx >= 0 ? cols[guruIdx] || '' : cols[base] || '').trim().toUpperCase();
    const hari = (hariIdx >= 0 ? cols[hariIdx] || 'SENIN' : cols[base + 1] || 'SENIN')
      .trim()
      .toUpperCase();
    const kelas = (kelasIdx >= 0 ? cols[kelasIdx] || '' : cols[base + 2] || '').trim().toUpperCase();
    const mapel = (mapelIdx >= 0 ? cols[mapelIdx] || '' : cols[base + 3] || '').trim().toUpperCase();
    const jamKe = (jamIdx >= 0 ? cols[jamIdx] || '1-2' : cols[base + 4] || '1-2').trim();
    const rawGender = (genderIdx >= 0 ? cols[genderIdx] || '' : cols[base + 5] || '').trim();
    const rawKat = (katIdx >= 0 ? cols[katIdx] || '' : cols[base + 6] || '').trim().toUpperCase();

    if (!guru || !kelas || !mapel) continue;

    const gender = rawGender
      ? inferGenderFromText(rawGender)
      : inferGenderFromText(kelas, guru);
    const kategori: 'Akademik' | 'Al-Quran' =
      rawKat.includes('QUR') ||
      mapel.includes('QUR') ||
      mapel.includes('TAHFIDZ') ||
      mapel.includes('TAHSIN') ||
      mapel.includes('HALAQAH')
        ? 'Al-Quran'
        : 'Akademik';
    parsed.push({ guru, hari, kelas, mapel, jamKe, gender, kategori });
  }
  return parsed;
}

export interface ParsedTeacherRow {
  nama: string;
  peran: UserRole;
  peranTambahan?: UserRole[];
  genderScope: 'Putra' | 'Putri' | 'Semua';
  waliKelasOf?: string;
  kamarBinaan?: string[];
  whatsapp?: string;
  username?: string;
  pin?: string;
}

export interface ParseTeacherOptions {
  defaultRole?: UserRole;
  forcedGender?: 'Putra' | 'Putri';
}

function normalizeUserRole(raw: string): UserRole | null {
  const low = raw.trim().toLowerCase();
  if (!low) return null;
  if (low.includes('super')) return 'Admin Super';
  if (low.includes('admin')) return 'Admin SIM';
  if (low.includes('wali')) return 'Wali Kelas';
  if (low.includes('musyrifah') || low.includes('musrifah')) return 'Musyrifah';
  if (low.includes('musyrif') || low.includes('musrif')) return 'Musyrif';
  if (low.includes('guru') || low.includes('pengampu')) return 'Guru';
  return null;
}

function cleanOptionalAssignment(val: string): string | undefined {
  const up = val.trim().toUpperCase();
  if (!up || up === '-' || up === 'KOSONG' || up === 'KOSONGKAN' || up === 'TIDAK ADA') {
    return undefined;
  }
  return up;
}

export function parseTeacherRows(
  rows: string[][],
  options?: ParseTeacherOptions,
): ParsedTeacherRow[] {
  if (rows.length === 0) return [];
  const first = rows[0].map((c) => c.toLowerCase().trim());
  const hasHeader = first.some(
    (c) =>
      c.includes('nama') ||
      c.includes('peran') ||
      c.includes('jabatan') ||
      c.includes('amanah') ||
      c.includes('kamar') ||
      c.includes('kelas'),
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const findCol = (...needles: string[]): number => {
    for (const n of needles) {
      const idx = first.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const namaIdx = hasHeader ? findCol('nama') : -1;
  const peranIdx = hasHeader ? findCol('amanah utama', 'peran', 'jabatan', 'bidang') : -1;
  const extraIdx = hasHeader ? findCol('amanah tambahan', 'tambahan') : -1;
  const wilayahIdx = hasHeader ? findCol('wilayah', 'gender', 'unit') : -1;
  const kelasIdx = hasHeader
    ? (() => {
        const direct = findCol('kelas binaan');
        if (direct >= 0) return direct;
        return first.findIndex(
          (h) => h.includes('kelas') && !h.includes('nama') && !h.includes('amanah'),
        );
      })()
    : -1;
  const kamarIdx = hasHeader ? findCol('kamar binaan', 'kamar') : -1;
  const waIdx = hasHeader
    ? (() => {
        const direct = findCol('whatsapp', 'no wa', 'no. wa', 'hp', 'telp');
        if (direct >= 0) return direct;
        return first.findIndex((h) => /\bwa\b/.test(h));
      })()
    : -1;
  const userIdx = hasHeader ? findCol('username', 'email') : -1;
  const pinIdx = hasHeader ? findCol('pin', 'password') : -1;

  const parsed: ParsedTeacherRow[] = [];
  for (const cols of dataRows) {
    let nama = '';
    if (namaIdx >= 0) {
      nama = (cols[namaIdx] || '').trim().toUpperCase();
    } else {
      const col0 = (cols[0] || '').trim();
      nama = (/^\d+$/.test(col0) ? cols[1] || '' : col0).trim().toUpperCase();
    }
    if (!nama || nama === '-' || nama === 'NAMA') continue;

    // Resolve Wilayah / GenderScope first so role defaults know Putra/Putri
    const rawGender = (wilayahIdx >= 0 ? cols[wilayahIdx] : !hasHeader ? cols[2] : '')
      .trim()
      .toLowerCase();
    let genderScope: 'Putra' | 'Putri' | 'Semua' = options?.forcedGender || 'Semua';
    if (rawGender) {
      if (rawGender.includes('putri') || rawGender.includes('akhwat')) genderScope = 'Putri';
      else if (rawGender.includes('putra') || rawGender.includes('ikhwan')) genderScope = 'Putra';
      else if (rawGender.includes('semua')) genderScope = 'Semua';
    } else if (!options?.forcedGender && (nama.includes('USTZ') || nama.includes('MUSYRIFAH'))) {
      genderScope = 'Putri';
    } else if (!options?.forcedGender && (nama.includes('UST.') || nama.includes('PUTRA'))) {
      genderScope = 'Putra';
    }

    const waliKelasOf = cleanOptionalAssignment(
      kelasIdx >= 0 ? cols[kelasIdx] || '' : !hasHeader ? cols[3] || '' : ''
    );

    const kamarRaw = (kamarIdx >= 0 ? cols[kamarIdx] || '' : !hasHeader ? cols[4] || '' : '').trim();
    const kamarList = kamarRaw
      ? kamarRaw
          .split(/[;,]/)
          .map((k) => k.trim())
          .filter((k) => Boolean(k && k !== '-' && k.toUpperCase() !== 'KOSONG'))
      : [];
    const kamarBinaan = kamarList.length > 0 ? kamarList : undefined;

    // Resolve Peran
    const rawPeran = (peranIdx >= 0 ? cols[peranIdx] : !hasHeader ? cols[1] : '').trim();
    let peran: UserRole = normalizeUserRole(rawPeran) || options?.defaultRole || 'Guru';
    if (!rawPeran && !options?.defaultRole) {
      if (kamarBinaan && kamarBinaan.length > 0) {
        peran = genderScope === 'Putri' ? 'Musyrifah' : 'Musyrif';
      } else if (waliKelasOf) {
        peran = 'Wali Kelas';
      } else {
        peran = 'Guru';
      }
    }
    if (peran === 'Musyrif' && genderScope === 'Putri') peran = 'Musyrifah';
    if (peran === 'Musyrifah' && genderScope === 'Putra') peran = 'Musyrif';

    // Resolve Amanah Tambahan (plus automatic secondary role if both waliKelasOf & kamarBinaan exist)
    const extraRaw = (extraIdx >= 0 ? cols[extraIdx] : '').trim();
    const peranTambahanSet = new Set<UserRole>(
      extraRaw
        ? extraRaw
            .split(/[;,]/)
            .map((item) => normalizeUserRole(item))
            .filter((r): r is UserRole => Boolean(r && r !== peran))
        : []
    );
    if (waliKelasOf && peran !== 'Wali Kelas') {
      peranTambahanSet.add('Wali Kelas');
    }
    if (kamarBinaan && kamarBinaan.length > 0) {
      const mRole: UserRole = genderScope === 'Putri' ? 'Musyrifah' : 'Musyrif';
      if (peran !== mRole) peranTambahanSet.add(mRole);
    }
    const peranTambahan = peranTambahanSet.size > 0 ? Array.from(peranTambahanSet) : undefined;

    const whatsapp =
      (waIdx >= 0 ? cols[waIdx] : !hasHeader ? cols[5] : '').trim() || undefined;

    let username: string | undefined;
    let pin = '1234';
    if (hasHeader) {
      username = userIdx >= 0 ? (cols[userIdx] || '').trim().toLowerCase() || undefined : undefined;
      pin = (pinIdx >= 0 ? cols[pinIdx] : '').trim() || '1234';
    } else {
      const col6 = (cols[6] || '').trim();
      const col7 = (cols[7] || '').trim();
      username = col7 ? col6.toLowerCase() : undefined;
      pin = (col7 || col6 || '1234').trim();
    }

    parsed.push({
      nama,
      peran,
      peranTambahan,
      genderScope,
      waliKelasOf,
      kamarBinaan,
      whatsapp,
      username,
      pin,
    });
  }
  return parsed;
}

export interface ParsedPembinaanImportRow {
  tanggal: string;
  namaSantri: string;
  gender: Gender;
  kategori: PembinaanKategori;
  uraian: string;
  poin: number;
  statusTindakLanjut: 'Selesai' | 'Proses' | 'Eskalasi';
  tindakLanjut: string;
}

export function parsePembinaanImportRows(rows: string[][]): ParsedPembinaanImportRow[] {
  if (rows.length === 0) return [];
  const first = rows[0].map((c) => c.toLowerCase());
  const hasHeader =
    first.some((c) => c.includes('santri') || c.includes('nama')) &&
    first.some((c) => c.includes('tanggal') || c.includes('kategori') || c.includes('uraian'));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const todayStr = new Date().toISOString().slice(0, 10);

  const parsed: ParsedPembinaanImportRow[] = [];
  for (const cols of dataRows) {
    const rawTgl = (cols[0] || '').trim();
    const namaSantri = (cols[1] || '').trim().toUpperCase();
    if (!namaSantri) continue;
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(rawTgl) ? rawTgl : todayStr;
    const rawWilayah = (cols[2] || '').trim().toLowerCase();
    const gender: Gender = rawWilayah.includes('putri') ? 'Putri' : 'Putra';
    const rawKat = (cols[3] || '').trim().toLowerCase();
    let kategori: PembinaanKategori = 'Pemantauan Ibadah';
    if (rawKat.includes('disipl')) kategori = 'Kedisiplinan';
    else if (rawKat.includes('prest')) kategori = 'Prestasi';
    else if (rawKat.includes('sehat') || rawKat.includes('sakit')) kategori = 'Kesehatan';
    else if (rawKat.includes('karak') || rawKat.includes('akade') || rawKat.includes('konsel')) {
      kategori = 'Pembinaan Karakter';
    }

    const uraian = (cols[4] || '').trim() || 'Catatan pembinaan';
    const poinNum = Number.parseInt((cols[5] || '0').trim(), 10);
    const poin = Number.isFinite(poinNum) ? poinNum : 0;

    const rawStatus = (cols[6] || '').trim().toLowerCase();
    let statusTindakLanjut: ParsedPembinaanImportRow['statusTindakLanjut'] = 'Selesai';
    if (rawStatus.includes('eskal')) statusTindakLanjut = 'Eskalasi';
    else if (rawStatus.includes('pros')) statusTindakLanjut = 'Proses';

    const tindakLanjut = (cols[7] || '').trim() || '-';
    parsed.push({
      tanggal,
      namaSantri,
      gender,
      kategori,
      uraian,
      poin,
      statusTindakLanjut,
      tindakLanjut,
    });
  }
  return parsed;
}
