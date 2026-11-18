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

/**
 * RFC-4180 multiline CSV parser (handles quoted cells containing commas and newlines).
 */
export function parseRfc4180Csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, '');
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
    } else if (ch === ',') {
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
  return rows;
}

export function parseLabkomTanggalToIso(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';

  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return '';
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

export function parseLabkomCsvContent(
  csvText: string,
  overrideKampus?: LabkomKampus,
): LabkomBooking[] {
  const rows = parseRfc4180Csv(csvText);
  if (rows.length <= 1) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = (names: string[], fallbackIdx: number) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0) return idx;
    }
    return fallbackIdx;
  };

  const iId = colIndex(['id'], 0);
  const iTs = colIndex(['timestamp'], 1);
  const iKampus = colIndex(['kampus'], 2);
  const iEmail = colIndex(['email'], 3);
  const iNama = colIndex(['nama peminjam', 'nama_peminjam', 'nama'], 4);
  const iGuru = colIndex(['guru'], 5);
  const iKelas = colIndex(['kelas'], 6);
  const iMapel = colIndex(['mapel'], 7);
  const iLab = colIndex(['lab', 'lokasi', 'ruang'], 8);
  const iTanggal = colIndex(['tanggal'], 9);
  const iJam = colIndex(['jam_ke', 'jam ke', 'jam'], 10);
  const iKet = colIndex(['keterangan'], 11);
  const iStatus = colIndex(['status'], 12);

  const bookings: LabkomBooking[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length < 10) continue;

    const rawLab = String(cols[iLab] || '').trim();
    const rawTanggal = String(cols[iTanggal] || '').trim();
    const isoTanggal = parseLabkomTanggalToIso(rawTanggal);
    if (!rawLab || !isoTanggal) continue;

    const rawKampus = String(cols[iKampus] || '').trim().toUpperCase();
    const kampus: LabkomKampus =
      overrideKampus || (rawKampus === 'PUTRI' ? 'PUTRI' : 'PUTRA');

    const jamKe = String(cols[iJam] || '').trim();
    if (!jamKe) continue;

    const idVal = String(cols[iId] || '').trim() || `TRX-CSV-${r}`;
    bookings.push({
      id: idVal,
      timestamp: String(cols[iTs] || '').trim() || isoTanggal,
      kampus,
      email: String(cols[iEmail] || '').trim(),
      namaPeminjam: String(cols[iNama] || '').trim() || String(cols[iGuru] || '').trim() || '-',
      guru: String(cols[iGuru] || '').trim() || '-',
      kelas: String(cols[iKelas] || '').trim() || '-',
      mapel: String(cols[iMapel] || '').trim() || '-',
      lab: rawLab.toUpperCase(),
      tanggal: isoTanggal,
      jamKe: jamKe.toUpperCase(),
      keterangan: String(cols[iKet] || '').trim(),
      status: String(cols[iStatus] || '').trim() || 'Disetujui',
    });
  }
  return bookings;
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

  return merged;
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
