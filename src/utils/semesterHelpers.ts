import type { SemesterFilter, SemesterType } from '../types';

export const NAMA_HARI_LIST = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export const NAMA_BULAN_LIST = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export interface AcademicSemesterInfo {
  semester: SemesterType;
  filterKey: Exclude<SemesterFilter, 'ALL'>;
  tahunAjaran: string;
  bulanAngka: number;
  bulanNama: string;
  periodeBulan: string;
  labelSingkat: string;
  labelLengkap: string;
}

/**
 * Mengidentifikasi Semester Ganjil (Juli–Desember) dan Semester Genap (Januari–Juni)
 * beserta Tahun Ajaran secara otomatis berdasarkan tanggal.
 */
export function getAcademicSemester(dateInput?: string | Date): AcademicSemesterInfo {
  let d: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    const [y, m, day] = dateInput.slice(0, 10).split('-').map(Number);
    d = new Date(y, (m || 1) - 1, day || 1);
  } else if (dateInput instanceof Date && !Number.isNaN(dateInput.getTime())) {
    d = dateInput;
  } else {
    d = new Date();
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1..12
  const isGanjil = month >= 7;
  const semester: SemesterType = isGanjil ? 'Ganjil' : 'Genap';
  const filterKey: Exclude<SemesterFilter, 'ALL'> = isGanjil ? 'GANJIL' : 'GENAP';
  const tahunAjaran = isGanjil ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const periodeBulan = isGanjil ? 'Jul–Des' : 'Jan–Jun';
  const bulanNama = NAMA_BULAN_LIST[month - 1] || 'Januari';

  return {
    semester,
    filterKey,
    tahunAjaran,
    bulanAngka: month,
    bulanNama,
    periodeBulan,
    labelSingkat: `Semester ${semester} (${periodeBulan})`,
    labelLengkap: `Semester ${semester} · TA ${tahunAjaran}`,
  };
}

/**
 * Mengecek kecocokan tanggal (YYYY-MM-DD) terhadap filter semester.
 */
export function matchesSemesterFilter(dateStr: string, filter: SemesterFilter): boolean {
  if (!dateStr) return false;
  if (filter === 'ALL') return true;
  const iso = parseFlexibleDateToIso(dateStr);
  const m = parseInt(iso.slice(5, 7), 10);
  if (!m || Number.isNaN(m)) return false;
  if (filter === 'GANJIL') return m >= 7 && m <= 12;
  if (filter === 'GENAP') return m >= 1 && m <= 6;
  return true;
}

/**
 * Mengubah format tanggal DD/MM/YYYY [HH:mm:ss] atau YYYY-MM-DD ke YYYY-MM-DD.
 */
export function parseFlexibleDateToIso(raw: string): string {
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

export function formatTanggalIndoLengkap(dateStr: string): string {
  const iso = parseFlexibleDateToIso(dateStr);
  if (!iso) return '-';
  const [y, m, day] = iso.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  if (Number.isNaN(d.getTime())) return dateStr;
  const hari = NAMA_HARI_LIST[d.getDay()] || '';
  const bulan = NAMA_BULAN_LIST[d.getMonth()] || '';
  return `${hari}, ${String(day).padStart(2, '0')} ${bulan} ${y}`;
}
