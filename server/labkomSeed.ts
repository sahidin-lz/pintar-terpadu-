import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  LabkomBooking,
  LabkomKampus,
  LabkomMasterItem,
  LabkomMasterKategori,
} from '../src/types';

export const DEFAULT_LABKOM_BROADCAST_TEMPLATE =
  '==========================================\n📢 *INFO JADWAL RUANGAN & LABKOM* 📢\n🏢 Area: *{{KAMPUS}}*\n🗓 Tanggal: *{{TANGGAL}}*\n{{DATA}}==========================================\nBooking Link:\n_s.id/bookingruangansma_\n==========================================';

const CANONICAL_LABS = ['LABKOM A', 'LABKOM B', 'LABKOM C', 'BIOKIM'];
const CANONICAL_RUANGAN = [
  'KELAS UI',
  'KELAS ITB',
  'KELAS UGM',
  'KELAS UPI',
  'KELAS UNPAD',
  'KELAS TIMTENG',
  'KELAS UNAIR',
  'KELAS ITS',
  'KELAS UB',
  'KELAS EROPA',
  'RUANG RAPAT',
  'PERPUSTAKAAN',
];
const CANONICAL_JAMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10 (SORE)', '11 (MALAM)'];
const CANONICAL_WAKTU_RUANG = ['PAGI', 'SIANG', 'SORE', 'MALAM'];

const THIS_DIR =
  typeof __dirname !== 'undefined' && __dirname
    ? __dirname
    : typeof import.meta !== 'undefined' && import.meta.url
    ? path.dirname(fileURLToPath(import.meta.url))
    : process.cwd();

function resolveLabkomCsvPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'data', 'labkom-putra-2026.csv'),
    path.resolve(THIS_DIR, '../data', 'labkom-putra-2026.csv'),
    path.resolve(THIS_DIR, '../../data', 'labkom-putra-2026.csv'),
    '/var/task/data/labkom-putra-2026.csv',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function detectCsvDelimiter(clean: string): ',' | ';' | '\t' {
  const sampleLines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length && sampleLines.length < 5; i++) {
    const ch = clean[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === '\n' && !inQuotes) {
      if (current.trim().length > 0) sampleLines.push(current);
      current = '';
    } else if (ch !== '\r') {
      current += ch;
    }
  }
  if (current.trim().length > 0 && sampleLines.length < 5) {
    sampleLines.push(current);
  }

  let commaCount = 0;
  let semiCount = 0;
  let tabCount = 0;
  for (const line of sampleLines) {
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') q = !q;
      else if (!q) {
        if (ch === ',') commaCount++;
        else if (ch === ';') semiCount++;
        else if (ch === '\t') tabCount++;
      }
    }
  }
  if (tabCount > commaCount && tabCount >= semiCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

/**
 * RFC-4180 multiline CSV parser supporting comma, semicolon, and tab delimiters.
 */
export function parseRfc4180Csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(clean);

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

export function parseLabkomTanggalToIso(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';

  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    const [, dd, mm, yyyyRaw] = dmyMatch;
    const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Numeric Excel serial date string (e.g. 46050)
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    if (serial > 30000 && serial < 70000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      if (!Number.isNaN(utc.getTime())) {
        return utc.toISOString().slice(0, 10);
      }
    }
  }
  return '';
}

function normalizeHeaderToken(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function inferLabkomKampusFromValues(...texts: string[]): LabkomKampus {
  const up = texts.filter(Boolean).join(' ').toUpperCase();
  if (
    up.includes('PUTRI') ||
    up.includes('AKHWAT') ||
    up.includes('USTZ') ||
    up.includes('KHADIJAH') ||
    up.includes('AISYAH') ||
    up.includes('FATIMAH') ||
    up.includes('HAFSHAH') ||
    up.includes('MARIYAM') ||
    up.includes('ZAINAB') ||
    up.includes('RUQAYYAH')
  ) {
    return 'PUTRI';
  }
  return 'PUTRA';
}

export function classifyLocationCategory(loc: string): 'LAB' | 'RUANGAN' {
  const u = loc.toUpperCase();
  if (u.includes('LAB') || u.includes('BIOKIM')) return 'LAB';
  return 'RUANGAN';
}

export function classifyTimeCategory(jam: string): 'JAM' | 'WAKTU_RUANG' {
  const u = jam.trim().toUpperCase();
  if (CANONICAL_WAKTU_RUANG.includes(u)) return 'WAKTU_RUANG';
  return 'JAM';
}

export function ensureUniqueLabkomBookingIds(bookings: LabkomBooking[]): LabkomBooking[] {
  const seenIds = new Set<string>();
  return bookings.map((b, idx) => {
    let id = String(b.id || '').trim() || `TRX-AUTO-${idx}`;
    if (seenIds.has(id)) {
      const jamSlug = String(b.jamKe || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '');
      let candidate = `${id}__J${jamSlug || idx}`;
      let suffix = 2;
      while (seenIds.has(candidate)) {
        candidate = `${id}__J${jamSlug || idx}_${suffix++}`;
      }
      id = candidate;
    }
    seenIds.add(id);
    return id === b.id ? b : { ...b, id };
  });
}

export function parseLabkomCsvContent(
  csvText: string,
  overrideKampus?: LabkomKampus,
): LabkomBooking[] {
  const rows = parseRfc4180Csv(csvText);
  if (rows.length <= 1) return [];

  // Auto-detect header row within the first 25 rows (handles title/banner rows)
  let headerRowIdx = 0;
  for (let idx = 0; idx < Math.min(rows.length, 25); idx++) {
    const tokens = rows[idx].map(normalizeHeaderToken);
    const hasLoc = tokens.some((t) =>
      ['lab', 'lokasi', 'ruang', 'ruangan', 'labkom', 'ruanganyangdipinjam', 'tempat'].includes(t),
    );
    const hasDateOrTime = tokens.some((t) =>
      ['tanggal', 'tgl', 'tanggalpinjam', 'tanggalpeminjaman', 'jamke', 'jam', 'waktu', 'sesi'].includes(t),
    );
    if (hasLoc && hasDateOrTime) {
      headerRowIdx = idx;
      break;
    }
  }

  const header = rows[headerRowIdx].map(normalizeHeaderToken);
  const colIndex = (names: string[], fallbackIdx: number) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0) return idx;
    }
    for (const n of names) {
      const idx = header.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return fallbackIdx;
  };

  const iId = colIndex(['id', 'kode', 'notrx'], 0);
  const iTs = colIndex(['timestamp', 'waktukirim', 'createdat'], 1);
  const iKampus = colIndex(['kampus', 'wilayah', 'area', 'unit', 'gender'], 2);
  const iEmail = colIndex(['email', 'emailaddress', 'surel'], 3);
  const iNama = colIndex(['namapeminjam', 'peminjam', 'pemohon', 'nama', 'pengisi'], 4);
  const iGuru = colIndex(['guru', 'pengajar', 'ustadz', 'ustadzah', 'pendamping'], 5);
  const iKelas = colIndex(['kelas', 'rombel', 'tingkat'], 6);
  const iMapel = colIndex(['mapel', 'matapelajaran', 'pelajaran', 'kegiatan'], 7);
  const iLab = colIndex(['lab', 'lokasi', 'ruang', 'ruangan', 'labkom', 'ruanganyangdipinjam', 'tempat'], 8);
  const iTanggal = colIndex(['tanggal', 'tgl', 'tanggalpinjam', 'tanggalpeminjaman', 'date'], 9);
  const iJam = colIndex(['jamke', 'jam', 'sesi', 'waktupinjam', 'waktu', 'jampinjam'], 10);
  const iKet = colIndex(['keterangan', 'ket', 'catatan', 'keperluan', 'notes'], 11);
  const iStatus = colIndex(['status'], 12);

  const bookings: LabkomBooking[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length < 3) continue;

    const rawLab = String(cols[iLab] || '').trim();
    const rawTanggal = String(cols[iTanggal] || '').trim();
    const isoTanggal = parseLabkomTanggalToIso(rawTanggal);
    if (!rawLab || !isoTanggal) continue;

    const jamKe = String(cols[iJam] || '').trim();
    if (!jamKe) continue;

    const rawKampus = String(cols[iKampus] || '').trim().toUpperCase();
    const namaVal = String(cols[iNama] || '').trim();
    const guruVal = String(cols[iGuru] || '').trim();
    const kelasVal = String(cols[iKelas] || '').trim();

    let kampus: LabkomKampus;
    if (overrideKampus) {
      kampus = overrideKampus;
    } else if (rawKampus.includes('PUTRI') || rawKampus.includes('AKHWAT') || rawKampus === 'PI') {
      kampus = 'PUTRI';
    } else if (rawKampus.includes('PUTRA') || rawKampus.includes('IKHWAN') || rawKampus === 'PA') {
      kampus = 'PUTRA';
    } else {
      kampus = inferLabkomKampusFromValues(rawLab, guruVal, kelasVal, namaVal);
    }

    const idVal = String(cols[iId] || '').trim() || `TRX-CSV-${r}-${Date.now().toString(36).slice(-4)}`;
    bookings.push({
      id: idVal,
      timestamp: String(cols[iTs] || '').trim() || isoTanggal,
      kampus,
      email: String(cols[iEmail] || '').trim(),
      namaPeminjam: namaVal || guruVal || '-',
      guru: guruVal || '-',
      kelas: kelasVal || '-',
      mapel: String(cols[iMapel] || '').trim() || '-',
      lab: rawLab.toUpperCase(),
      tanggal: isoTanggal,
      jamKe: jamKe.toUpperCase(),
      keterangan: String(cols[iKet] || '').trim(),
      status: String(cols[iStatus] || '').trim() || 'Disetujui',
    });
  }
  return ensureUniqueLabkomBookingIds(bookings);
}

export function buildMastersFromBookings(
  bookings: LabkomBooking[],
  extraGurus: string[] = [],
  extraKelas: string[] = [],
): LabkomMasterItem[] {
  const byCat: Record<LabkomMasterKategori, Set<string>> = {
    GURU: new Set<string>(),
    KELAS: new Set<string>(),
    MAPEL: new Set<string>(),
    LAB: new Set<string>(CANONICAL_LABS),
    RUANGAN: new Set<string>(CANONICAL_RUANGAN),
    JAM: new Set<string>(CANONICAL_JAMS),
    WAKTU_RUANG: new Set<string>(CANONICAL_WAKTU_RUANG),
  };

  for (const g of extraGurus) {
    const v = g.trim();
    if (v && v !== '-') byCat.GURU.add(v);
  }
  for (const k of extraKelas) {
    const v = k.trim();
    if (v && v !== '-') byCat.KELAS.add(v);
  }

  for (const b of bookings) {
    if (b.guru && b.guru !== '-') byCat.GURU.add(b.guru.trim());
    if (b.kelas && b.kelas !== '-') byCat.KELAS.add(b.kelas.trim());
    if (b.mapel && b.mapel !== '-') byCat.MAPEL.add(b.mapel.trim());
    if (b.lab) {
      const cat = classifyLocationCategory(b.lab);
      byCat[cat].add(b.lab.trim().toUpperCase());
    }
    if (b.jamKe) {
      const tCat = classifyTimeCategory(b.jamKe);
      byCat[tCat].add(b.jamKe.trim().toUpperCase());
    }
  }

  const items: LabkomMasterItem[] = [];
  (Object.keys(byCat) as LabkomMasterKategori[]).forEach((kategori) => {
    const sorted = Array.from(byCat[kategori]).sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true }),
    );
    sorted.forEach((nilai, idx) => {
      items.push({
        id: `LM_${kategori}_${idx + 1}`,
        kategori,
        nilai,
      });
    });
  });

  return items;
}

export function ensureBaselineMasters(existing: LabkomMasterItem[]): LabkomMasterItem[] {
  const merged = [...existing];
  const has = (kat: LabkomMasterKategori, val: string) =>
    merged.some(
      (m) => m.kategori === kat && m.nilai.trim().toUpperCase() === val.trim().toUpperCase(),
    );

  const pushIfMissing = (kat: LabkomMasterKategori, values: string[]) => {
    for (const v of values) {
      if (!has(kat, v)) {
        merged.push({
          id: `LM_${kat}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          kategori: kat,
          nilai: v,
        });
      }
    }
  };

  pushIfMissing('LAB', CANONICAL_LABS);
  pushIfMissing('RUANGAN', CANONICAL_RUANGAN);
  pushIfMissing('JAM', CANONICAL_JAMS);
  pushIfMissing('WAKTU_RUANG', CANONICAL_WAKTU_RUANG);

  const seenMasterIds = new Set<string>();
  return merged.map((m, idx) => {
    let id = String(m.id || '').trim() || `LM_${m.kategori}_${idx + 1}`;
    if (seenMasterIds.has(id)) {
      let suffix = 2;
      while (seenMasterIds.has(`${id}_${suffix}`)) suffix++;
      id = `${id}_${suffix}`;
    }
    seenMasterIds.add(id);
    return id === m.id ? m : { ...m, id };
  });
}

let cachedSeed: { bookings: LabkomBooking[]; masters: LabkomMasterItem[] } | null = null;

export function loadLabkomSeedData(
  extraGurus: string[] = [],
  extraKelas: string[] = [],
): { bookings: LabkomBooking[]; masters: LabkomMasterItem[] } {
  if (!cachedSeed) {
    const csvPath = resolveLabkomCsvPath();
    let bookings: LabkomBooking[] = [];
    if (csvPath) {
      try {
        const raw = fs.readFileSync(csvPath, 'utf-8');
        bookings = parseLabkomCsvContent(raw, 'PUTRA');
      } catch {
        bookings = [];
      }
    }
    const masters = buildMastersFromBookings(bookings, extraGurus, extraKelas);
    cachedSeed = { bookings, masters };
  }
  return {
    bookings: cachedSeed.bookings.map((b) => ({ ...b })),
    masters: cachedSeed.masters.map((m) => ({ ...m })),
  };
}
