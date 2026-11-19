import type { Gender, PembinaanKategori, UserRole } from '../types';

const PUTRI_NAME_MARKERS = [
  'PUTRI',
  'AKHWAT',
  'MUSYRIFAH',
  'MUSRIFAH',
  'SANTRIWATI',
  'SISWI',
  'USTZ',
  'USTADZAH',
  'KHADIJAH',
  'AISYAH',
  'FATIMAH',
  'HAFSHAH',
  'ZAINAB',
  'MARIYAM',
  'MARYAM',
  'RUQAYYAH',
  'SUMAYYAH',
  'SUMMAYYAH',
  'UMMU',
];

export function inferGenderFromText(...texts: Array<string | undefined>): Gender {
  const combined = texts.filter(Boolean).join(' ').toUpperCase();
  if (PUTRI_NAME_MARKERS.some((m) => combined.includes(m)) || /\bPI\b/.test(combined)) {
    return 'Putri';
  }
  return 'Putra';
}

export function findHeaderRowIndex(
  rows: string[][],
  matcher: (lowerCells: string[]) => boolean,
  maxScan = 10,
): number {
  const limit = Math.min(rows.length, maxScan);
  for (let i = 0; i < limit; i++) {
    const lower = rows[i].map((c) => String(c || '').toLowerCase().trim());
    if (matcher(lower)) return i;
  }
  return -1;
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
  guruWali?: string;
  gender: Gender;
  warning?: string;
}

function normalizePengampuName(raw: string): string {
  const up = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!up || up === 'TIDAK DITEMUKAN' || up === '-' || up === 'KOSONG') return '';
  if (up === 'UST, SOFYAN IMAM KELSABA' || up === 'UST. SOFYAN IMAM K') {
    return 'UST. SOFYAN IMAM KELSABA';
  }
  if (up === 'UST. ERDI JAYARI T') return 'UST. ERDI JAYARI TANJUNG';
  if (up === 'ILMAN HAMDANI') return 'UST. ILMAN HAMDANI';
  return up;
}

function parseExplicitWilayah(raw: string): Gender | null {
  const up = raw.trim().toUpperCase();
  if (!up) return null;
  if (
    up.includes('PUTRI') ||
    up.includes('AKHWAT') ||
    up.includes('PEREMPUAN') ||
    up.includes('SISWI') ||
    up === 'P' ||
    up === 'PI'
  ) {
    return 'Putri';
  }
  if (
    up.includes('PUTRA') ||
    up.includes('IKHWAN') ||
    up.includes('LAKI') ||
    up.includes('SISWA') ||
    up === 'L' ||
    up === 'PA'
  ) {
    return 'Putra';
  }
  return null;
}

export function parseSantriSimRows(rows: string[][], forcedGender?: Gender): ParsedSantriSimRow[] {
  if (rows.length === 0) return [];

  const headerIdx = findHeaderRowIndex(rows, (cells) => {
    const hasNameCol = cells.some(
      (c) =>
        c.includes('nama') ||
        c === 'santri' ||
        c === 'siswi' ||
        c === 'siswa' ||
        c.includes('nama siswa') ||
        c.includes('nama siswi') ||
        c.includes('nama santri') ||
        c.includes('peserta'),
    );
    const hasMetaCol = cells.some(
      (c) =>
        c.includes('kelas') ||
        c.includes('rombel') ||
        c.includes('kamar') ||
        c.includes('asrama') ||
        c.includes('hujroh') ||
        c.includes('wilayah') ||
        c.includes('quran') ||
        c.includes('halaqah') ||
        c.includes('nis'),
    );
    return hasNameCol && hasMetaCol;
  });

  const hasHeader = headerIdx >= 0;
  const headerCells = hasHeader ? rows[headerIdx].map((c) => String(c || '').toLowerCase().trim()) : [];

  const findHeaderIdx = (...needles: string[]): number => {
    for (const n of needles) {
      const idx = headerCells.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const nisColIdx = hasHeader ? findHeaderIdx('nis', 'nomor induk', 'no / nis', 'no.') : -1;
  const wilayahColIdx = hasHeader
    ? findHeaderIdx('wilayah', 'gender', 'l/p', 'jenis kelamin', 'unit', 'kampus')
    : -1;
  const namaColIdx = hasHeader
    ? (() => {
        const direct = headerCells.findIndex(
          (h) =>
            (h.includes('nama') || h === 'santri' || h === 'siswi' || h === 'siswa' || h.includes('peserta')) &&
            !h.includes('kelas') &&
            !h.includes('wali') &&
            !h.includes('ortu') &&
            !h.includes('orang tua') &&
            !h.includes('kamar') &&
            !h.includes('pengampu') &&
            !h.includes('musyrif'),
        );
        return direct;
      })()
    : -1;
  const kelasColIdx = hasHeader
    ? headerCells.findIndex(
        (h) => (h.includes('kelas') || h.includes('rombel') || h.includes('tingkat')) && !h.includes('wali'),
      )
    : -1;
  const kamarColIdx = hasHeader ? findHeaderIdx('kamar', 'asrama', 'hujroh', 'rayon') : -1;
  const waliColIdx = hasHeader ? findHeaderIdx('wali kelas', 'walikelas', 'walas') : -1;
  const musyrifColIdx = hasHeader ? findHeaderIdx('wali asrama', 'musyrif', 'musrif', 'murobbi', 'pembina asrama') : -1;
  const guruWaliColIdx = hasHeader ? findHeaderIdx('guru wali', 'guruwali', 'pembimbing', 'mentor') : -1;

  let kelompokColIdx = -1;
  let pengampuColIdx = -1;
  if (hasHeader) {
    kelompokColIdx = headerCells.findIndex(
      (h, idx) =>
        idx !== namaColIdx &&
        (h.includes('kelp') || h.includes('kelompok') || h.includes('halaqah') || h.includes('tahfidz')) &&
        !h.includes('pengampu') &&
        !h.includes('guru'),
    );
    pengampuColIdx = headerCells.findIndex(
      (h, idx) =>
        idx !== namaColIdx &&
        idx !== kelompokColIdx &&
        (h.includes('pengampu') || h.includes('muallim') || h.includes('ustadz') || h.includes('quran')),
    );
  }

  const dataRows = hasHeader ? rows.slice(headerIdx + 1) : rows;
  const seenNames = new Set<string>();
  const parsed: ParsedSantriSimRow[] = [];

  for (const cols of dataRows) {
    if (!cols || cols.every((c) => !String(c || '').trim())) continue;

    const col0 = String(cols[0] || '').trim();
    const rawNama = namaColIdx >= 0 ? cols[namaColIdx] || '' : cols[1] || cols[0] || '';
    const nama = String(rawNama).trim().replace(/\s+/g, ' ').toUpperCase();
    if (
      !nama ||
      nama === 'NAMA' ||
      nama === 'NAMA SANTRI' ||
      nama === 'NAMA SISWA' ||
      nama === 'NAMA SISWI' ||
      nama === 'TOTAL' ||
      nama === 'JUMLAH' ||
      /^\d+$/.test(nama)
    ) {
      continue;
    }

    const rawNis = nisColIdx >= 0 ? String(cols[nisColIdx] || '').trim() : /^\d+$/.test(col0) || /^[a-z0-9-]+$/i.test(col0) ? col0 : '';

    const rawCol2 = String(cols[2] || '').trim();
    const hasExplicitWilayahAt2 =
      wilayahColIdx === 2 ||
      (wilayahColIdx === -1 && cols.length >= 6 && parseExplicitWilayah(rawCol2) !== null);

    const explicitWilayahRaw =
      wilayahColIdx >= 0
        ? String(cols[wilayahColIdx] || '').trim()
        : hasExplicitWilayahAt2
        ? rawCol2
        : '';
    const explicitGender = parseExplicitWilayah(explicitWilayahRaw);

    const offset = hasExplicitWilayahAt2 ? 1 : 0;
    const rawKelas =
      kelasColIdx >= 0 ? cols[kelasColIdx] || '' : hasHeader ? '' : cols[2 + offset] || '';
    const kelas = String(rawKelas).trim().replace(/\s+/g, ' ').toUpperCase();
    const rawKamar =
      kamarColIdx >= 0 ? cols[kamarColIdx] || '' : hasHeader ? '' : cols[3 + offset] || '';
    const kamar = String(rawKamar).trim().replace(/\s+/g, ' ');
    const rawKelompok =
      kelompokColIdx >= 0 ? cols[kelompokColIdx] || '' : hasHeader ? '' : cols[4 + offset] || '';
    const kelompokQuran = String(rawKelompok).trim().replace(/\s+/g, ' ');
    const rawPengampu =
      pengampuColIdx >= 0 ? cols[pengampuColIdx] || '' : hasHeader ? '' : cols[5 + offset] || '';
    const pengampuQuran = normalizePengampuName(String(rawPengampu));

    const waliKelas =
      waliColIdx >= 0
        ? String(cols[waliColIdx] || '').trim().replace(/\s+/g, ' ').toUpperCase() || undefined
        : undefined;
    const musyrif =
      musyrifColIdx >= 0
        ? String(cols[musyrifColIdx] || '').trim().replace(/\s+/g, ' ').toUpperCase() || undefined
        : undefined;
    const guruWali =
      guruWaliColIdx >= 0
        ? String(cols[guruWaliColIdx] || '').trim().replace(/\s+/g, ' ').toUpperCase() || undefined
        : undefined;

    let warning: string | undefined;
    if (kelas && nama === kelas) {
      warning = 'Nama identik dengan Nama Kelas';
    } else if (seenNames.has(nama)) {
      warning = 'Duplikat nama santri dalam file';
    }
    seenNames.add(nama);

    const textInferred = inferGenderFromText(kelas, kamar, kelompokQuran, pengampuQuran, waliKelas, musyrif);
    const gender: Gender =
      explicitGender ||
      forcedGender ||
      textInferred;

    parsed.push({
      nis: rawNis,
      nama,
      kelas: kelas || '-',
      kamar: kamar || '-',
      kelompokQuran: kelompokQuran || '-',
      pengampuQuran,
      waliKelas: waliKelas && waliKelas !== '-' ? waliKelas : undefined,
      musyrif: musyrif && musyrif !== '-' ? musyrif : undefined,
      guruWali: guruWali && guruWali !== '-' ? guruWali : undefined,
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

const EXCEL_MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

function normalizeJamKeValue(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '1-2';
  if (/^\d{1,2}(\s*[-–,]\s*\d{1,2})*$/.test(s)) {
    return s.replace(/\s+/g, '');
  }
  const dayMon = s.match(/^(\d{1,2})[-/\s]([A-Za-z]+)(?:[-/\s]\d{2,4})?$/);
  if (dayMon) {
    const day = Number.parseInt(dayMon[1], 10);
    const mon = EXCEL_MONTHS[dayMon[2].toLowerCase()];
    if (mon && day >= 1 && day <= 12) {
      return mon <= day ? `${mon}-${day}` : `${day}-${mon}`;
    }
  }
  const monDay = s.match(/^([A-Za-z]+)[-/\s](\d{1,2})(?:[-/\s]\d{2,4})?$/);
  if (monDay) {
    const mon = EXCEL_MONTHS[monDay[1].toLowerCase()];
    const day = Number.parseInt(monDay[2], 10);
    if (mon && day >= 1 && day <= 12) {
      return mon <= day ? `${mon}-${day}` : `${day}-${mon}`;
    }
  }
  const isoDate = s.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    const a = Number.parseInt(isoDate[1], 10);
    const b = Number.parseInt(isoDate[2], 10);
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) {
      return a <= b ? `${a}-${b}` : `${b}-${a}`;
    }
  }
  return s;
}

export function parseScheduleRows(rows: string[][], forcedGender?: Gender): ParsedScheduleRow[] {
  if (rows.length === 0) return [];

  const headerIdx = findHeaderRowIndex(
    rows,
    (cells) =>
      cells.some((c) => c.includes('guru') || c.includes('pengajar') || c.includes('pengampu') || c.includes('ustadz')) &&
      cells.some((c) => c.includes('mapel') || c.includes('hari') || c.includes('pelajaran') || c.includes('jam')),
  );
  const hasHeader = headerIdx >= 0;
  const headerCells = hasHeader ? rows[headerIdx].map((c) => String(c || '').toLowerCase().trim()) : [];
  const dataRows = hasHeader ? rows.slice(headerIdx + 1) : rows;

  const findCol = (...needles: string[]): number => {
    for (const n of needles) {
      const idx = headerCells.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const guruIdx = hasHeader ? findCol('guru', 'pengajar', 'pengampu', 'ustadz', 'nama') : -1;
  const hariIdx = hasHeader ? findCol('hari') : -1;
  const kelasIdx = hasHeader ? findCol('kelas', 'halaqah', 'rombel') : -1;
  const mapelIdx = hasHeader ? findCol('mapel', 'mata pelajaran', 'pelajaran', 'materi') : -1;
  const jamIdx = hasHeader ? findCol('jam', 'jp', 'waktu') : -1;
  const genderIdx = hasHeader ? findCol('wilayah', 'gender', 'unit', 'kampus') : -1;
  const katIdx = hasHeader ? findCol('kategori', 'jenis') : -1;

  const parsed: ParsedScheduleRow[] = [];
  for (const cols of dataRows) {
    if (!cols || cols.every((c) => !String(c || '').trim())) continue;
    const hasLeadingNumber = !hasHeader && /^\d+$/.test((cols[0] || '').trim());
    const base = hasLeadingNumber ? 1 : 0;

    const guru = (guruIdx >= 0 ? cols[guruIdx] || '' : cols[base] || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const hari = (hariIdx >= 0 ? cols[hariIdx] || 'SENIN' : cols[base + 1] || 'SENIN')
      .trim()
      .toUpperCase();
    const kelas = (kelasIdx >= 0 ? cols[kelasIdx] || '' : cols[base + 2] || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const mapel = (mapelIdx >= 0 ? cols[mapelIdx] || '' : cols[base + 3] || '').trim().replace(/\s+/g, ' ').toUpperCase();
    const jamKe = normalizeJamKeValue(jamIdx >= 0 ? cols[jamIdx] || '1-2' : cols[base + 4] || '1-2');
    const rawGender = (genderIdx >= 0 ? cols[genderIdx] || '' : cols[base + 5] || '').trim();
    const rawKat = (katIdx >= 0 ? cols[katIdx] || '' : cols[base + 6] || '').trim().toUpperCase();

    if (!guru || !kelas || !mapel || guru === 'GURU' || guru === 'NAMA GURU') continue;

    const explicit = parseExplicitWilayah(rawGender);
    const gender: Gender = explicit || forcedGender || inferGenderFromText(kelas, guru);
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
  if (
    low.includes('pimpinan') ||
    low.includes('kepala sekolah') ||
    low.includes('kepsek') ||
    low.includes('mudir') ||
    low.includes('wakasek') ||
    low.includes('direktur')
  ) {
    return 'Pimpinan';
  }
  if (low.includes('guru wali') || low.includes('guruwali') || low.includes('pembimbing')) return 'Guru Wali';
  if (low.includes('wali asrama') || low.includes('waliasrama') || low.includes('kepala asrama')) return 'Wali Asrama';
  if (low.includes('wali kelas') || low.includes('walikelas') || low.includes('walas') || low.includes('wali')) return 'Wali Kelas';
  if (low.includes('musyrifah') || low.includes('musrifah')) return 'Musyrifah';
  if (low.includes('musyrif') || low.includes('musrif')) return 'Musyrif';
  if (low.includes('qur')) return 'Pengampu Al-Quran';
  if (low.includes('guru') || low.includes('pengampu')) return 'Guru';
  return null;
}

function cleanOptionalAssignment(val: string): string | undefined {
  const up = val.trim().replace(/\s+/g, ' ').toUpperCase();
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
  const headerIdx = findHeaderRowIndex(rows, (cells) =>
    cells.some(
      (c) =>
        c.includes('nama') ||
        c.includes('peran') ||
        c.includes('jabatan') ||
        c.includes('amanah') ||
        c.includes('kamar binaan') ||
        c.includes('kelas binaan') ||
        c.includes('musyrif') ||
        c.includes('wali kelas'),
    ),
  );
  const hasHeader = headerIdx >= 0;
  const headerCells = hasHeader ? rows[headerIdx].map((c) => String(c || '').toLowerCase().trim()) : [];
  const dataRows = hasHeader ? rows.slice(headerIdx + 1) : rows;

  const findCol = (...needles: string[]): number => {
    for (const n of needles) {
      const idx = headerCells.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const namaIdx = hasHeader
    ? headerCells.findIndex(
        (h) =>
          (h.includes('nama') || h === 'guru' || h === 'musyrif' || h === 'musyrifah' || h === 'wali kelas') &&
          !h.includes('kelas binaan') &&
          !h.includes('kamar binaan'),
      )
    : -1;
  const peranIdx = hasHeader ? findCol('amanah utama', 'peran', 'jabatan', 'bidang') : -1;
  const extraIdx = hasHeader ? findCol('amanah tambahan', 'tambahan') : -1;
  const wilayahIdx = hasHeader ? findCol('wilayah', 'gender', 'unit', 'kampus') : -1;
  const kelasIdx = hasHeader
    ? (() => {
        const direct = findCol('kelas binaan');
        if (direct >= 0) return direct;
        return headerCells.findIndex(
          (h) => h.includes('kelas') && !h.includes('nama') && !h.includes('amanah'),
        );
      })()
    : -1;
  const kamarIdx = hasHeader ? findCol('kamar binaan', 'kamar', 'asrama') : -1;
  const waIdx = hasHeader
    ? (() => {
        const direct = findCol('whatsapp', 'no wa', 'no. wa', 'hp', 'telp');
        if (direct >= 0) return direct;
        return headerCells.findIndex((h) => /\bwa\b/.test(h));
      })()
    : -1;
  const userIdx = hasHeader ? findCol('username', 'email') : -1;
  const pinIdx = hasHeader
    ? findCol('token login', 'token akses', 'token', 'pin', 'password', 'kode login', 'kode akses')
    : -1;

  const parsed: ParsedTeacherRow[] = [];
  for (const cols of dataRows) {
    if (!cols || cols.every((c) => !String(c || '').trim())) continue;
    let nama = '';
    if (namaIdx >= 0) {
      nama = (cols[namaIdx] || '').trim().replace(/\s+/g, ' ').toUpperCase();
    } else {
      const col0 = (cols[0] || '').trim();
      nama = (/^\d+$/.test(col0) ? cols[1] || '' : col0).trim().replace(/\s+/g, ' ').toUpperCase();
    }
    if (
      !nama ||
      nama === '-' ||
      nama === 'NAMA' ||
      nama === 'NAMA PEGAWAI' ||
      nama === 'NAMA GURU' ||
      nama === '(BELUM DITENTUKAN)' ||
      nama === 'BELUM DIATUR' ||
      /^(UST\.|USTZ\.)\s+(WALI KELAS|MUSYRIFAH|MUSYRIF)\s+/i.test(nama)
    ) {
      continue;
    }

    const rawGender = (wilayahIdx >= 0 ? cols[wilayahIdx] : !hasHeader ? cols[2] : '')
      .trim()
      .toLowerCase();

    const waliKelasOf = cleanOptionalAssignment(
      kelasIdx >= 0 ? cols[kelasIdx] || '' : !hasHeader ? cols[3] || '' : '',
    );

    const kamarRaw = (kamarIdx >= 0 ? cols[kamarIdx] || '' : !hasHeader ? cols[4] || '' : '').trim();
    const kamarList = kamarRaw
      ? kamarRaw
          .split(/[;,]/)
          .map((k) => k.trim().replace(/\s+/g, ' '))
          .filter((k) => Boolean(k && k !== '-' && k.toUpperCase() !== 'KOSONG'))
      : [];
    const kamarBinaan = kamarList.length > 0 ? kamarList : undefined;

    let genderScope: 'Putra' | 'Putri' | 'Semua' = options?.forcedGender || 'Semua';
    if (rawGender) {
      if (rawGender.includes('putri') || rawGender.includes('akhwat') || rawGender === 'pi' || rawGender === 'p') {
        genderScope = 'Putri';
      } else if (rawGender.includes('putra') || rawGender.includes('ikhwan') || rawGender === 'pa' || rawGender === 'l') {
        genderScope = 'Putra';
      } else if (rawGender.includes('semua')) {
        genderScope = 'Semua';
      }
    } else if (!options?.forcedGender) {
      const checkText = `${nama} ${waliKelasOf || ''} ${kamarList.join(' ')}`.toUpperCase();
      if (PUTRI_NAME_MARKERS.some((m) => checkText.includes(m))) {
        genderScope = 'Putri';
      } else if (nama.includes('UST.') || checkText.includes('PUTRA') || checkText.includes('ABU BAKAR') || checkText.includes('UMAR') || checkText.includes('UTSMAN') || checkText.includes('ALI ')) {
        genderScope = 'Putra';
      }
    }

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

    const extraRaw = (extraIdx >= 0 ? cols[extraIdx] : '').trim();
    const peranTambahanSet = new Set<UserRole>(
      extraRaw
        ? extraRaw
            .split(/[;,]/)
            .map((item) => normalizeUserRole(item))
            .filter((r): r is UserRole => Boolean(r && r !== peran))
        : [],
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
    let pin: string | undefined;
    if (hasHeader) {
      username = userIdx >= 0 ? (cols[userIdx] || '').trim().toLowerCase() || undefined : undefined;
      const rawPin = pinIdx >= 0 ? (cols[pinIdx] || '').trim() : '';
      pin = rawPin && rawPin !== '-' && rawPin.toUpperCase() !== 'KOSONG' ? rawPin : undefined;
    } else {
      const col6 = (cols[6] || '').trim();
      const col7 = (cols[7] || '').trim();
      username = col7 ? col6.toLowerCase() : undefined;
      const rawPin = (col7 || col6 || '').trim();
      pin = rawPin && rawPin !== '-' ? rawPin : undefined;
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
  jalurPembinaan?: 'Wali Kelas' | 'Guru Wali' | 'Room Visit Asrama';
  lingkup?: 'Individu' | 'Klasikal';
  pekanKe?: number;
  pembinaNama?: string;
}

export function parsePembinaanImportRows(
  rows: string[][],
  forcedGender?: Gender,
): ParsedPembinaanImportRow[] {
  if (rows.length === 0) return [];
  const headerIdx = findHeaderRowIndex(
    rows,
    (cells) =>
      cells.some((c) => c.includes('santri') || c.includes('nama')) &&
      cells.some((c) => c.includes('tanggal') || c.includes('kategori') || c.includes('uraian') || c.includes('catatan')),
  );
  const hasHeader = headerIdx >= 0;
  const headerCells = hasHeader ? rows[headerIdx].map((c) => String(c || '').toLowerCase().trim()) : [];
  const dataRows = hasHeader ? rows.slice(headerIdx + 1) : rows;
  const todayStr = new Date().toISOString().slice(0, 10);

  const findCol = (fallback: number, ...needles: string[]) => {
    if (!hasHeader) return fallback;
    for (const n of needles) {
      const idx = headerCells.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return fallback;
  };

  const iTgl = findCol(0, 'tanggal', 'tgl');
  const iNama = findCol(1, 'santri', 'nama');
  const iWil = findCol(2, 'wilayah', 'gender', 'unit');
  const iKat = findCol(3, 'kategori');
  const iUraian = findCol(4, 'uraian', 'catatan', 'keterangan');
  const iPoin = findCol(5, 'poin', 'skor');
  const iStatus = findCol(6, 'status');
  const iTindak = findCol(7, 'tindak lanjut', 'tindak');
  const iJalur = findCol(8, 'jalur', 'peran pembina');
  const iLingkup = findCol(9, 'momen', 'lingkup', 'mode');
  const iPekan = findCol(10, 'pekan');
  const iPembina = findCol(11, 'pembina');

  const parsed: ParsedPembinaanImportRow[] = [];
  for (const cols of dataRows) {
    if (!cols || cols.every((c) => !String(c || '').trim())) continue;
    const rawTgl = (cols[iTgl] || '').trim();
    const namaSantri = (cols[iNama] || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!namaSantri || namaSantri === 'NAMA SANTRI' || namaSantri === 'NAMA') continue;
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(rawTgl) ? rawTgl : todayStr;
    const rawWilayah = (cols[iWil] || '').trim();
    const gender: Gender =
      parseExplicitWilayah(rawWilayah) || forcedGender || inferGenderFromText(namaSantri);
    const rawKat = (cols[iKat] || '').trim().toLowerCase();
    let kategori: PembinaanKategori = 'Pemantauan Ibadah';
    if (rawKat.includes('disipl')) kategori = 'Kedisiplinan';
    else if (rawKat.includes('prest')) kategori = 'Prestasi';
    else if (rawKat.includes('sehat') || rawKat.includes('sakit')) kategori = 'Kesehatan';
    else if (rawKat.includes('karak') || rawKat.includes('akade') || rawKat.includes('konsel')) {
      kategori = 'Pembinaan Karakter';
    }

    const uraian = (cols[iUraian] || '').trim() || 'Catatan pembinaan';
    const poinNum = Number.parseInt((cols[iPoin] || '0').trim(), 10);
    const poin = Number.isFinite(poinNum) ? poinNum : 0;

    const rawStatus = (cols[iStatus] || '').trim().toLowerCase();
    let statusTindakLanjut: ParsedPembinaanImportRow['statusTindakLanjut'] = 'Selesai';
    if (rawStatus.includes('eskal')) statusTindakLanjut = 'Eskalasi';
    else if (rawStatus.includes('pros')) statusTindakLanjut = 'Proses';

    const tindakLanjut = (cols[iTindak] || '').trim() || '-';

    const rawJalur = (cols[iJalur] || '').trim().toLowerCase();
    let jalurPembinaan: ParsedPembinaanImportRow['jalurPembinaan'];
    if (rawJalur.includes('asrama') || rawJalur.includes('room') || rawJalur.includes('musyrif')) {
      jalurPembinaan = 'Room Visit Asrama';
    } else if (rawJalur.includes('guru wali') || rawJalur.includes('guruwali')) {
      jalurPembinaan = 'Guru Wali';
    } else if (rawJalur.includes('wali kelas') || rawJalur.includes('walikelas')) {
      jalurPembinaan = 'Wali Kelas';
    }

    const rawLingkup = (cols[iLingkup] || '').trim().toLowerCase();
    const lingkup: 'Individu' | 'Klasikal' | undefined =
      rawLingkup.includes('klasikal') || rawLingkup.includes('pekan')
        ? 'Klasikal'
        : rawLingkup.includes('khusus') || rawLingkup.includes('individu') || rawLingkup.includes('satu')
        ? 'Individu'
        : undefined;

    const pekanRaw = Number.parseInt((cols[iPekan] || '').trim(), 10);
    const pekanKe = Number.isFinite(pekanRaw) && pekanRaw >= 1 && pekanRaw <= 52 ? pekanRaw : undefined;
    const pembinaNama = (cols[iPembina] || '').trim().toUpperCase() || undefined;

    parsed.push({
      tanggal,
      namaSantri,
      gender,
      kategori,
      uraian,
      poin,
      statusTindakLanjut,
      tindakLanjut,
      jalurPembinaan,
      lingkup,
      pekanKe,
      pembinaNama,
    });
  }
  return parsed;
}
