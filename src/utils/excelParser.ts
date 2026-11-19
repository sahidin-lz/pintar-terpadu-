import * as XLSX from 'xlsx';
import {
  parsePembinaanImportRows,
  parseSantriSimRows,
  parseScheduleRows,
  parseTeacherRows,
  type ParsedPembinaanImportRow,
  type ParsedSantriSimRow,
  type ParsedScheduleRow,
  type ParsedTeacherRow,
} from './csvParser';

export interface WorkbookSheetSpec {
  name: string;
  label: string;
  rows: string[][];
}

export interface DatabaseWorkbookSpec {
  filename: string;
  sourceLabel: string;
  sheets: WorkbookSheetSpec[];
}

export interface ParsedDatabaseWorkbook {
  fileName: string;
  detectedSheets: string[];
  santriRows: ParsedSantriSimRow[];
  pegawaiRows: ParsedTeacherRow[];
  musyrifRows: ParsedTeacherRow[];
  waliKelasRows: ParsedTeacherRow[];
  guruRows: ParsedTeacherRow[];
  waliGuruRows: ParsedTeacherRow[];
  scheduleRows: ParsedScheduleRow[];
  ruanganUjian: string[];
  pembinaanRows: ParsedPembinaanImportRow[];
}

function detectTextDelimiter(text: string): string {
  const firstLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  const score = (delim: string) => {
    let total = 0;
    for (const line of firstLines) {
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (!inQ && ch === delim) total++;
      }
    }
    return total;
  };
  const candidates = [
    { d: ';', n: score(';') },
    { d: ',', n: score(',') },
    { d: '\t', n: score('\t') },
  ].sort((a, b) => b.n - a.n);
  return candidates[0].n > 0 ? candidates[0].d : ',';
}

function parseDelimitedTextToMatrix(rawText: string): string[][] {
  const cleaned = rawText.replace(/^\uFEFF/, '');
  const delim = detectTextDelimiter(cleaned);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell.replace(/\s+/g, ' ').trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && cleaned[i + 1] === '\n') i++;
      row.push(cell.replace(/\s+/g, ' ').trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\s+/g, ' ').trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function inferWilayahHintFromLabel(label: string): 'Putra' | 'Putri' | undefined {
  const low = String(label || '').toLowerCase();
  if (
    low.includes('putri') ||
    low.includes('akhwat') ||
    low.includes('siswi') ||
    low.includes('santriwati') ||
    low.includes('musyrifah') ||
    low.startsWith('1b_') ||
    low.startsWith('2b_') ||
    low.startsWith('3b_')
  ) {
    return 'Putri';
  }
  if (
    low.includes('putra') ||
    low.includes('ikhwan') ||
    low.startsWith('1a_') ||
    low.startsWith('2a_') ||
    low.startsWith('3a_')
  ) {
    return 'Putra';
  }
  return undefined;
}

function sheetToStringMatrix(ws: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: false,
  });
  return aoa
    .map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '').replace(/\s+/g, ' ').trim()) : [],
    )
    .filter((row) => row.some((c) => c.length > 0));
}

function parseRuanganRows(rows: string[][], forcedGender?: 'Putra' | 'Putri'): string[] {
  if (rows.length === 0) return [];
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const joined = rows[i].map((c) => c.toLowerCase()).join(' ');
    if (joined.includes('ruang') || joined.includes('nama') || joined.includes('lokasi')) {
      headerIdx = i;
      break;
    }
  }
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;
  const set = new Set<string>();
  for (const r of dataRows) {
    let val = (r[0] || '').trim().toUpperCase();
    if (!val || val === 'NAMA RUANGAN' || val === 'NAMA RUANGAN UJIAN') continue;
    const rawWilayah = (r[1] || '').trim().toUpperCase();
    const resolvedWilayah =
      rawWilayah.includes('PUTRI') || rawWilayah === 'PI' || rawWilayah === 'P'
        ? 'PUTRI'
        : rawWilayah.includes('PUTRA') || rawWilayah === 'PA' || rawWilayah === 'L'
        ? 'PUTRA'
        : forcedGender
        ? forcedGender.toUpperCase()
        : '';
    if (
      (resolvedWilayah === 'PUTRA' || resolvedWilayah === 'PUTRI') &&
      !val.includes('PUTRA') &&
      !val.includes('PUTRI')
    ) {
      val = `${val} (${resolvedWilayah})`;
    }
    set.add(val);
  }
  return Array.from(set);
}

function computeColWidths(rows: string[][], minWidth = 12, maxWidth = 38): XLSX.ColInfo[] {
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

export function buildWorkbookFromSpec(spec: DatabaseWorkbookSpec): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  for (const sheet of spec.sheets) {
    const cleanRows = sheet.rows.map((r) =>
      r.map((cell) => String(cell ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')),
    );
    const ws = XLSX.utils.aoa_to_sheet(cleanRows);
    ws['!cols'] = computeColWidths(cleanRows);
    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    if (range) {
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (cell) {
            cell.t = 's';
            cell.z = '@';
            cell.v = String(cell.v ?? '');
          }
        }
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  return wb;
}

export type ComponentTemplateKey =
  | 'master_pegawai'
  | 'santri'
  | 'musyrif_kamar'
  | 'wali_kelas'
  | 'guru_quran'
  | 'jadwal'
  | 'ruang_ujian'
  | 'pembinaan';

export interface ComponentTemplateDefinition {
  key: ComponentTemplateKey;
  stepNumber: string;
  title: string;
  subtitle: string;
  filenameBlank: string;
  filenameFilled: string;
  columnsSummary: string[];
  sheetNamesInSpec: string[];
  blankSheets: WorkbookSheetSpec[];
}

export const COMPONENT_TEMPLATES: ComponentTemplateDefinition[] = [
  {
    key: 'master_pegawai',
    stepNumber: '01',
    title: 'Master Pegawai & Token Login',
    subtitle: 'Daftar induk pegawai & pusat Token Login. Token Login hanya diatur pada sheet Master_Pegawai ini.',
    filenameBlank: 'Template_01_Master_Pegawai_Kosong.xlsx',
    filenameFilled: 'Template_01_Master_Pegawai_Data_Saat_Ini.xlsx',
    columnsSummary: [
      'No',
      'Nama Pegawai (Wajib)',
      'Wilayah (Putra/Putri/Semua)',
      'Peran Utama',
      'Amanah Tambahan (pisah ;)',
      'Wali Kelas Dari',
      'Kamar Binaan (pisah ;)',
      'WhatsApp',
      'Username Login',
      'Token Login',
    ],
    sheetNamesInSpec: ['Master_Pegawai'],
    blankSheets: [
      {
        name: 'Master_Pegawai',
        label: 'Pegawai & Token Login',
        rows: [
          [
            'No',
            'Nama Pegawai (Wajib)',
            'Wilayah (Putra/Putri/Semua)',
            'Peran Utama (Guru/Wali Kelas/Wali Asrama/Guru Wali/Musyrif/Musyrifah/Pimpinan/Admin SIM)',
            'Amanah Tambahan (Pisahkan dengan ; misal: Wali Kelas; Guru Wali; Wali Asrama)',
            'Amanah Wali Kelas Dari (Contoh: 10 ABU BAKAR AS-SHIDDIQ)',
            'Amanah Kamar Binaan (Pisahkan dengan ; misal: 10.1 Putra; 10.2 Putra)',
            'WhatsApp',
            'Username Login',
            'Token Login',
          ],
          ['1', 'UST. AHMAD FAUZI', 'Putra', 'Wali Kelas', 'Guru; Guru Wali; Wali Asrama', '10 ABU BAKAR AS-SHIDDIQ', '10.1 Putra', '6281234567890', 'ahmad.fauzi', 'PN-4821'],
          ['2', 'USTZ. SITI MARIYAM', 'Putri', 'Musyrifah', 'Wali Kelas; Guru Wali', '10 KHADIJAH BINTI KHUWAILID', '10.1 Putri', '6281298765432', 'siti.mariyam', 'PN-7392'],
        ],
      },
    ],
  },
  {
    key: 'santri',
    stepNumber: '02',
    title: 'Data Santri (Putra & Putri)',
    subtitle: 'Master biodata santri lengkap dengan Kelas Akademik, Kamar Asrama, Kelompok & Pengampu Al-Qur’an.',
    filenameBlank: 'Template_02_Data_Santri_Kosong.xlsx',
    filenameFilled: 'Template_02_Data_Santri_Data_Saat_Ini.xlsx',
    columnsSummary: [
      'No / NIS',
      'Nama',
      'Wilayah (Putra/Putri)',
      'Nama Kelas',
      'Kamar',
      'Kelp. Al-Quran',
      'Pengampu Al-Quran',
      'Wali Kelas (Opsional)',
      'Wali Asrama / Musyrif (Opsional)',
      'Guru Wali (Opsional)',
    ],
    sheetNamesInSpec: ['1A_Siswa_Putra', '1B_Siswa_Putri'],
    blankSheets: [
      {
        name: '1A_Siswa_Putra',
        label: 'Santri Wilayah Putra',
        rows: [
          ['No / NIS', 'Nama', 'Wilayah (Putra/Putri)', 'Nama Kelas', 'Kamar', 'Kelp. Al-Quran', 'Pengampu Al-Quran', 'Wali Kelas', 'Wali Asrama / Musyrif', 'Guru Wali'],
          ['1001', 'ABDUL GHOFAR RAHMAN', 'Putra', '10 ABU BAKAR AS-SHIDDIQ', '10.6 Putra', '10-03 Putra', 'UST. NUR FAIZIN', 'UST. NUR FAIZIN', 'UST. FATIH', 'UST. NUR FAIZIN'],
          ['1002', 'ACHMAD RASYA FARID', 'Putra', '10 ABU BAKAR AS-SHIDDIQ', '10.4 Putra', '10-08 Putra', 'UST. DAFFA M Z', 'UST. NUR FAIZIN', 'UST. FATIH', 'UST. DAFFA M Z'],
        ],
      },
      {
        name: '1B_Siswa_Putri',
        label: 'Santri Wilayah Putri',
        rows: [
          ['No / NIS', 'Nama', 'Wilayah (Putra/Putri)', 'Nama Kelas', 'Kamar', 'Kelp. Al-Quran', 'Pengampu Al-Quran', 'Wali Kelas', 'Wali Asrama / Musyrif', 'Guru Wali'],
          ['P-01', 'AISYAH HUMAIRA ZAHRA', 'Putri', '10 KHADIJAH BINTI KHUWAILID', '10.1 Putri', '10-01 Putri', 'USTZ. SITI MARIYAM', 'USTZ. HANIFAH', 'USTZ. SITI MARIYAM', 'USTZ. SITI MARIYAM'],
          ['P-02', 'FATIMAH AZ-ZAHRA', 'Putri', '10 KHADIJAH BINTI KHUWAILID', '10.1 Putri', '10-01 Putri', 'USTZ. SITI MARIYAM', 'USTZ. HANIFAH', 'USTZ. SITI MARIYAM', 'USTZ. HANIFAH'],
        ],
      },
    ],
  },
  {
    key: 'musyrif_kamar',
    stepNumber: '03',
    title: 'Musyrif/ah & Kamar Asrama',
    subtitle: 'Khusus pembagian kamar asrama Putra & Putri (Token Login terpusat di Master_Pegawai).',
    filenameBlank: 'Template_03_Musyrif_Kamar_Asrama_Kosong.xlsx',
    filenameFilled: 'Template_03_Musyrif_Kamar_Asrama_Data_Saat_Ini.xlsx',
    columnsSummary: [
      'No',
      'Nama Musyrif/ah',
      'Kamar Binaan (pisah ;)',
      'Wilayah (Putra/Putri)',
      'WhatsApp',
    ],
    sheetNamesInSpec: ['2A_Musyrif_Putra', '2B_Musyrifah_Putri'],
    blankSheets: [
      {
        name: '2A_Musyrif_Putra',
        label: 'Musyrif Asrama Putra',
        rows: [
          ['No', 'Nama Musyrif', 'Kamar Binaan (Pisahkan dengan ;)', 'Wilayah', 'WhatsApp'],
          ['1', 'UST. RIZKI PRATAMA', '10.1 Putra; 10.2 Putra', 'Putra', '62812000111'],
        ],
      },
      {
        name: '2B_Musyrifah_Putri',
        label: 'Musyrifah Asrama Putri',
        rows: [
          ['No', 'Nama Musyrifah', 'Kamar Binaan (Pisahkan dengan ;)', 'Wilayah', 'WhatsApp'],
          ['1', 'USTZ. SITI MARIYAM', '10.1 Putri; 10.2 Putri', 'Putri', '62812000222'],
        ],
      },
    ],
  },
  {
    key: 'wali_kelas',
    stepNumber: '04',
    title: 'Wali Kelas (Putra & Putri)',
    subtitle: 'Khusus daftar Wali Kelas dan penugasan Kelas Binaan Akademik (Token Login terpusat di Master_Pegawai).',
    filenameBlank: 'Template_04_Wali_Kelas_Kosong.xlsx',
    filenameFilled: 'Template_04_Wali_Kelas_Data_Saat_Ini.xlsx',
    columnsSummary: [
      'No',
      'Nama Wali Kelas',
      'Kelas Binaan',
      'Wilayah (Putra/Putri)',
      'WhatsApp',
    ],
    sheetNamesInSpec: ['3A_Wali_Kelas_Putra', '3B_Wali_Kelas_Putri'],
    blankSheets: [
      {
        name: '3A_Wali_Kelas_Putra',
        label: 'Wali Kelas Putra',
        rows: [
          ['No', 'Nama Wali Kelas', 'Kelas Binaan', 'Wilayah', 'WhatsApp'],
          ['1', 'UST. NUR FAIZIN', '10 ABU BAKAR AS-SHIDDIQ', 'Putra', '62812000333'],
        ],
      },
      {
        name: '3B_Wali_Kelas_Putri',
        label: 'Wali Kelas Putri',
        rows: [
          ['No', 'Nama Wali Kelas', 'Kelas Binaan', 'Wilayah', 'WhatsApp'],
          ['1', 'USTZ. HANIFAH', '10 KHADIJAH BINTI KHUWAILID', 'Putri', '62812000444'],
        ],
      },
    ],
  },
  {
    key: 'guru_quran',
    stepNumber: '05',
    title: "Guru Mapel & Pengampu Al-Qur'an",
    subtitle: "Khusus daftar Guru Mapel & Pengampu Halaqah Al-Qur'an (Token Login terpusat di Master_Pegawai).",
    filenameBlank: 'Template_05_Guru_dan_Pengampu_Quran_Kosong.xlsx',
    filenameFilled: 'Template_05_Guru_dan_Pengampu_Quran_Data_Saat_Ini.xlsx',
    columnsSummary: [
      'No',
      'Nama Guru / Pengampu',
      'Peran (Guru / Pengampu Al-Quran)',
      'Wilayah (Putra/Putri/Semua)',
      'WhatsApp',
    ],
    sheetNamesInSpec: ['3C_Guru_Pengampu'],
    blankSheets: [
      {
        name: '3C_Guru_Pengampu',
        label: 'Guru & Pengampu Quran',
        rows: [
          ['No', 'Nama Guru', 'Peran (Guru / Pengampu Al-Quran)', 'Wilayah (Putra/Putri/Semua)', 'WhatsApp'],
          ['1', 'UST. DAFFA M Z', 'Pengampu Al-Quran', 'Putra', '62812000555'],
          ['2', 'UST. SOFYAN IMAM KELSABA', 'Guru', 'Putra', '62812000666'],
        ],
      },
    ],
  },
  {
    key: 'jadwal',
    stepNumber: '06',
    title: "Jadwal KBM & Halaqah Al-Qur'an",
    subtitle: 'Jadwal mengajar harian (Senin–Sabtu) beserta validasi anti-bentrok jam pelajaran (JP).',
    filenameBlank: 'Template_06_Jadwal_Mengajar_Kosong.xlsx',
    filenameFilled: 'Template_06_Jadwal_Mengajar_Data_Saat_Ini.xlsx',
    columnsSummary: [
      'Guru',
      'Hari (SENIN-SABTU)',
      'Kelas / Halaqah',
      'Mata Pelajaran',
      'Jam Ke (misal: 1-2)',
      'Wilayah (Putra/Putri)',
    ],
    sheetNamesInSpec: ['4_Jadwal_Mengajar'],
    blankSheets: [
      {
        name: '4_Jadwal_Mengajar',
        label: 'Jadwal Putra & Putri',
        rows: [
          ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
          ['UST. NUR FAIZIN', 'SENIN', '10 ABU BAKAR AS-SHIDDIQ', 'FIQIH IBADAH', '1-2', 'Putra'],
          ['UST. DAFFA M Z', 'SELASA', '10-08 Putra', "HALAQAH AL-QUR'AN", '3-4', 'Putra'],
        ],
      },
    ],
  },
  {
    key: 'ruang_ujian',
    stepNumber: '07',
    title: 'Daftar Ruangan Ujian',
    subtitle: 'Master ruangan pengawasan ujian akademik & tahfidz wilayah Putra dan Putri.',
    filenameBlank: 'Template_07_Ruang_Ujian_Kosong.xlsx',
    filenameFilled: 'Template_07_Ruang_Ujian_Data_Saat_Ini.xlsx',
    columnsSummary: ['Nama Ruangan Ujian', 'Wilayah (Putra/Putri/Semua)'],
    sheetNamesInSpec: ['5_Ruang_Ujian'],
    blankSheets: [
      {
        name: '5_Ruang_Ujian',
        label: 'Ruang Ujian Putra/Putri',
        rows: [
          ['Nama Ruangan Ujian', 'Wilayah (Putra/Putri/Semua)'],
          ['RUANG 01 PUTRA - AL-GHAZALI', 'Putra'],
          ['RUANG 01 PUTRI - KHADIJAH', 'Putri'],
        ],
      },
    ],
  },
  {
    key: 'pembinaan',
    stepNumber: '08',
    title: 'Catatan Pembinaan & Prestasi/Pelanggaran',
    subtitle: 'Rekap catatan ibadah, karakter, kedisiplinan, poin prestasi/pelanggaran, dan tindak lanjut.',
    filenameBlank: 'Template_08_Catatan_Pembinaan_Kosong.xlsx',
    filenameFilled: 'Template_08_Catatan_Pembinaan_Data_Saat_Ini.xlsx',
    columnsSummary: [
      'Tanggal (YYYY-MM-DD)',
      'Nama Santri',
      'Wilayah',
      'Kategori',
      'Uraian Pembinaan',
      'Poin (+/-)',
      'Status (Selesai/Proses/Eskalasi)',
      'Tindak Lanjut',
      'Jalur (Wali Kelas/Guru Wali/Room Visit Asrama)',
      'Momen (Klasikal Pekanan/Khusus Individu)',
    ],
    sheetNamesInSpec: ['6_Catatan_Pembinaan'],
    blankSheets: [
      {
        name: '6_Catatan_Pembinaan',
        label: 'Catatan Pembinaan',
        rows: [
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
            new Date().toISOString().slice(0, 10),
            'ABDUL GHOFAR RAHMAN',
            'Putra',
            'Prestasi',
            'Juara 1 Tasmi 5 Juz Sekali Duduk tingkat Asrama.',
            '15',
            'Selesai',
            'Diberikan sertifikat penghargaan',
            'Wali Kelas',
            'Khusus Individu',
          ],
        ],
      },
    ],
  },
];

export function downloadComponentExcelTemplate(
  key: ComponentTemplateKey,
  mode: 'blank' | 'filled',
  serverSpec?: DatabaseWorkbookSpec | null,
): string {
  const def = COMPONENT_TEMPLATES.find((t) => t.key === key);
  if (!def) throw new Error('Definisi template komponen tidak ditemukan.');

  let sheetsToExport: WorkbookSheetSpec[] = def.blankSheets;
  if (mode === 'filled' && serverSpec && serverSpec.sheets.length > 0) {
    const matched = serverSpec.sheets.filter((s) => def.sheetNamesInSpec.includes(s.name));
    if (matched.length > 0) {
      sheetsToExport = matched;
    }
  }

  const filename = mode === 'blank' ? def.filenameBlank : def.filenameFilled;
  triggerExcelDownloadFromSpec({
    filename,
    sourceLabel: `${def.title} (${mode === 'blank' ? 'Template Kosong' : 'Data Saat Ini'})`,
    sheets: sheetsToExport,
  });
  return filename;
}

export function triggerExcelDownloadFromSpec(spec: DatabaseWorkbookSpec): void {
  const wb = buildWorkbookFromSpec(spec);
  const out = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = spec.filename || 'Template_Database_PINTAR_SIM.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function parseDatabaseWorkbookFromSpec(spec: DatabaseWorkbookSpec): ParsedDatabaseWorkbook {
  const wb = buildWorkbookFromSpec(spec);
  const out = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;
  return parseDatabaseExcelBuffer(out, spec.filename);
}

function inspectMatrixHeaders(matrix: string[][], maxScan = 10): string {
  return matrix
    .slice(0, maxScan)
    .map((r) => r.join(' ').toLowerCase())
    .join(' | ');
}

export function parseDatabaseExcelBuffer(buffer: ArrayBuffer, fileName: string): ParsedDatabaseWorkbook {
  const fileForcedGender = inferWilayahHintFromLabel(fileName);
  const lowerFile = String(fileName || '').toLowerCase();

  const sheetEntries: Array<{ name: string; matrix: string[][] }> = [];
  if (lowerFile.endsWith('.csv') || lowerFile.endsWith('.tsv')) {
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(new Uint8Array(buffer));
    const matrix = parseDelimitedTextToMatrix(text);
    const baseName = fileName.replace(/\.(csv|tsv)$/i, '') || 'CSV_Data';
    if (matrix.length > 0) {
      sheetEntries.push({ name: baseName, matrix });
    }
  } else {
    const wb = XLSX.read(buffer, { type: 'array' });
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const matrix = sheetToStringMatrix(ws);
      if (matrix.length > 0) {
        sheetEntries.push({ name, matrix });
      }
    }
  }

  const detectedSheets = sheetEntries.map((s) => s.name);

  let santriRows: ParsedSantriSimRow[] = [];
  let pegawaiRows: ParsedTeacherRow[] = [];
  let musyrifRows: ParsedTeacherRow[] = [];
  let waliKelasRows: ParsedTeacherRow[] = [];
  let guruRows: ParsedTeacherRow[] = [];
  let scheduleRows: ParsedScheduleRow[] = [];
  let ruanganUjian: string[] = [];
  let pembinaanRows: ParsedPembinaanImportRow[] = [];

  for (const { name, matrix } of sheetEntries) {
    const low = name.toLowerCase();
    if (low.includes('panduan') || low.startsWith('0_')) continue;

    const sheetGender = inferWilayahHintFromLabel(name);
    const effectiveGender = sheetGender || fileForcedGender;

    if (low.includes('pembinaan') || low.startsWith('6_')) {
      pembinaanRows = pembinaanRows.concat(parsePembinaanImportRows(matrix, effectiveGender));
    } else if (low.includes('pegawai')) {
      pegawaiRows = pegawaiRows.concat(
        parseTeacherRows(matrix, { forcedGender: effectiveGender }),
      );
    } else if (
      low.includes('siswa') ||
      low.includes('siswi') ||
      low.includes('santri') ||
      low.startsWith('1')
    ) {
      santriRows = santriRows.concat(parseSantriSimRows(matrix, effectiveGender));
    } else if (low.includes('musyrifah') || low.startsWith('2b_')) {
      musyrifRows = musyrifRows.concat(
        parseTeacherRows(matrix, { defaultRole: 'Musyrifah', forcedGender: 'Putri' }),
      );
    } else if (low.includes('musyrif') || low.includes('musrif') || low.startsWith('2')) {
      musyrifRows = musyrifRows.concat(
        parseTeacherRows(matrix, {
          defaultRole: effectiveGender === 'Putri' ? 'Musyrifah' : 'Musyrif',
          forcedGender: effectiveGender,
        }),
      );
    } else if (low.includes('wali') || low.startsWith('3a_') || low.startsWith('3b_')) {
      const parsedRows = parseTeacherRows(matrix, {
        defaultRole: 'Wali Kelas',
        forcedGender: effectiveGender,
      });
      for (const row of parsedRows) {
        if (row.peran === 'Guru') guruRows.push(row);
        else if (row.peran === 'Musyrif' || row.peran === 'Musyrifah') musyrifRows.push(row);
        else waliKelasRows.push(row);
      }
    } else if (low.includes('guru') || low.includes('pengampu') || low.startsWith('3c_') || low.startsWith('3_')) {
      const parsedRows = parseTeacherRows(matrix, {
        defaultRole: 'Guru',
        forcedGender: effectiveGender,
      });
      for (const row of parsedRows) {
        if (row.peran === 'Wali Kelas') waliKelasRows.push(row);
        else if (row.peran === 'Musyrif' || row.peran === 'Musyrifah') musyrifRows.push(row);
        else guruRows.push(row);
      }
    } else if (low.includes('jadwal') || low.startsWith('4_')) {
      scheduleRows = scheduleRows.concat(parseScheduleRows(matrix, effectiveGender));
    } else if (low.includes('ruang') || low.startsWith('5_')) {
      ruanganUjian = Array.from(new Set([...ruanganUjian, ...parseRuanganRows(matrix, effectiveGender)]));
    } else {
      // Multi-row header-based fallback detection (e.g. Sheet1, Data, Putri, Akhwat, etc.)
      const headerJoined = inspectMatrixHeaders(matrix, 10);
      if (
        headerJoined.includes('kelp') ||
        headerJoined.includes('kelompok') ||
        headerJoined.includes('pengampu') ||
        headerJoined.includes('siswi') ||
        headerJoined.includes('santri') ||
        ((headerJoined.includes('nama') || headerJoined.includes('siswa')) &&
          (headerJoined.includes('kelas') || headerJoined.includes('rombel') || headerJoined.includes('kamar') || headerJoined.includes('asrama')))
      ) {
        santriRows = santriRows.concat(parseSantriSimRows(matrix, effectiveGender));
      } else if (headerJoined.includes('hari') && (headerJoined.includes('mapel') || headerJoined.includes('pelajaran') || headerJoined.includes('jam'))) {
        scheduleRows = scheduleRows.concat(parseScheduleRows(matrix, effectiveGender));
      } else if (headerJoined.includes('uraian') || headerJoined.includes('tindak lanjut')) {
        pembinaanRows = pembinaanRows.concat(parsePembinaanImportRows(matrix, effectiveGender));
      } else if (headerJoined.includes('amanah') || headerJoined.includes('peran') || headerJoined.includes('jabatan')) {
        pegawaiRows = pegawaiRows.concat(parseTeacherRows(matrix, { forcedGender: effectiveGender }));
      } else if (headerJoined.includes('kamar binaan') || headerJoined.includes('musyrif')) {
        musyrifRows = musyrifRows.concat(
          parseTeacherRows(matrix, {
            defaultRole: effectiveGender === 'Putri' ? 'Musyrifah' : 'Musyrif',
            forcedGender: effectiveGender,
          }),
        );
      } else if (headerJoined.includes('kelas binaan') || headerJoined.includes('wali kelas')) {
        waliKelasRows = waliKelasRows.concat(
          parseTeacherRows(matrix, { defaultRole: 'Wali Kelas', forcedGender: effectiveGender }),
        );
      } else if (headerJoined.includes('ruang ujian') || headerJoined.includes('ruangan ujian')) {
        ruanganUjian = Array.from(new Set([...ruanganUjian, ...parseRuanganRows(matrix, effectiveGender)]));
      }
    }
  }

  // Konsolidasi pusat Token Login ke Master_Pegawai:
  // Token Login hanya berasal dari Master_Pegawai (atau dibuat deterministik PN-XXXX jika kosong di Master_Pegawai),
  // sedangkan sub-sheet (2A, 2B, 3A, 3B, 3C) hanya menyumbang amanah kamar/kelas/peran tanpa menimpa Token Login.
  const makeDeterministicToken = (nama: string): string => {
    const clean = String(nama || '')
      .trim()
      .toLowerCase()
      .replace(/["']/g, '')
      .replace(/\s+/g, ' ');
    let hash = 2166136261;
    for (let i = 0; i < clean.length; i++) {
      hash ^= clean.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    let code = (Math.abs(hash) % 8900) + 1000;
    if (code === 1234) code = 2468;
    return `PN-${code}`;
  };

  const makeUsernameFromNama = (name: string): string =>
    name
      .toLowerCase()
      .replace(/^(ust\.|ustadz\.|ustz\.|ustadzah\.|ust,)\s*/i, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 24) || 'user';

  const masterMap = new Map<string, ParsedTeacherRow>();

  // 1. Masukkan seluruh baris Master_Pegawai terlebih dahulu (sumber tunggal Token Login di template)
  for (const p of pegawaiRows) {
    const key = p.nama.trim().toUpperCase();
    if (!key) continue;
    masterMap.set(key, {
      ...p,
      nama: key,
      username: p.username || makeUsernameFromNama(key),
      pin: p.pin && p.pin.trim() ? p.pin.trim() : makeDeterministicToken(key),
    });
  }

  // 2. Gabungkan amanah dari sub-sheet (2A, 2B, 3A, 3B, 3C) tanpa pernah menimpa Token Login di Master_Pegawai
  const mergeSubRowIntoMaster = (sub: ParsedTeacherRow, allowPinIfNew: boolean) => {
    const key = sub.nama.trim().toUpperCase();
    if (!key || key === '(BELUM DITENTUKAN)' || key === 'BELUM DIATUR' || key === '-') return;
    const existing = masterMap.get(key);
    if (existing) {
      const extras = new Set(existing.peranTambahan || []);
      if (existing.peran !== sub.peran) {
        if (existing.peran === 'Guru' && sub.peran !== 'Guru') {
          extras.add('Guru');
          existing.peran = sub.peran;
        } else {
          extras.add(sub.peran);
        }
      }
      (sub.peranTambahan || []).forEach((r) => {
        if (r !== existing.peran) extras.add(r);
      });
      existing.peranTambahan = extras.size > 0 ? Array.from(extras) : undefined;
      if (!existing.waliKelasOf && sub.waliKelasOf) existing.waliKelasOf = sub.waliKelasOf;
      if (sub.kamarBinaan && sub.kamarBinaan.length > 0) {
        existing.kamarBinaan = Array.from(new Set([...(existing.kamarBinaan || []), ...sub.kamarBinaan]));
      }
      if ((!existing.whatsapp || existing.whatsapp === '628') && sub.whatsapp) {
        existing.whatsapp = sub.whatsapp;
      }
      if (existing.genderScope !== sub.genderScope && existing.genderScope !== 'Semua' && sub.genderScope !== 'Semua') {
        existing.genderScope = 'Semua';
      }
    } else {
      masterMap.set(key, {
        ...sub,
        nama: key,
        username: sub.username || makeUsernameFromNama(key),
        pin: allowPinIfNew && sub.pin && sub.pin.trim() ? sub.pin.trim() : makeDeterministicToken(key),
      });
    }
  };

  const hasExplicitMasterSheet = pegawaiRows.length > 0;
  for (const r of musyrifRows) {
    mergeSubRowIntoMaster(r, !hasExplicitMasterSheet);
    r.pin = masterMap.get(r.nama.trim().toUpperCase())?.pin;
  }
  for (const r of waliKelasRows) {
    mergeSubRowIntoMaster(r, !hasExplicitMasterSheet);
    r.pin = masterMap.get(r.nama.trim().toUpperCase())?.pin;
  }
  for (const r of guruRows) {
    mergeSubRowIntoMaster(r, !hasExplicitMasterSheet);
    r.pin = masterMap.get(r.nama.trim().toUpperCase())?.pin;
  }

  pegawaiRows = Array.from(masterMap.values());

  return {
    fileName,
    detectedSheets,
    santriRows,
    pegawaiRows,
    musyrifRows,
    waliKelasRows,
    guruRows,
    waliGuruRows: [...waliKelasRows, ...guruRows],
    scheduleRows,
    ruanganUjian,
    pembinaanRows,
  };
}

