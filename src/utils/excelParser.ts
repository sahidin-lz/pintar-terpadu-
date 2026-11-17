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

function sheetToStringMatrix(ws: XLSX.WorkSheet): string[][] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: false,
  });
  return aoa
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []))
    .filter((row) => row.some((c) => c.length > 0));
}

function parseRuanganRows(rows: string[][]): string[] {
  if (rows.length === 0) return [];
  const first = (rows[0][0] || '').toLowerCase();
  const dataRows = first.includes('ruang') || first.includes('nama') ? rows.slice(1) : rows;
  const set = new Set<string>();
  for (const r of dataRows) {
    let val = (r[0] || '').trim().toUpperCase();
    if (!val) continue;
    const rawWilayah = (r[1] || '').trim().toUpperCase();
    if (
      (rawWilayah === 'PUTRA' || rawWilayah === 'PUTRI') &&
      !val.includes('PUTRA') &&
      !val.includes('PUTRI')
    ) {
      val = `${val} (${rawWilayah})`;
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
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  return wb;
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

export function parseDatabaseExcelBuffer(buffer: ArrayBuffer, fileName: string): ParsedDatabaseWorkbook {
  const wb = XLSX.read(buffer, { type: 'array' });
  const detectedSheets = wb.SheetNames.slice();

  let santriRows: ParsedSantriSimRow[] = [];
  let pegawaiRows: ParsedTeacherRow[] = [];
  let musyrifRows: ParsedTeacherRow[] = [];
  let waliKelasRows: ParsedTeacherRow[] = [];
  let guruRows: ParsedTeacherRow[] = [];
  let scheduleRows: ParsedScheduleRow[] = [];
  let ruanganUjian: string[] = [];
  let pembinaanRows: ParsedPembinaanImportRow[] = [];

  for (const name of wb.SheetNames) {
    const low = name.toLowerCase();
    if (low.includes('panduan') || low.startsWith('0_')) continue;

    const ws = wb.Sheets[name];
    if (!ws) continue;
    const matrix = sheetToStringMatrix(ws);
    if (matrix.length === 0) continue;

    if (low.includes('pembinaan') || low.startsWith('6_')) {
      pembinaanRows = pembinaanRows.concat(parsePembinaanImportRows(matrix));
    } else if (low.includes('pegawai')) {
      pegawaiRows = pegawaiRows.concat(parseTeacherRows(matrix));
    } else if (low.includes('siswa') || low.includes('santri') || low.startsWith('1')) {
      const forcedGender =
        low.includes('putri') || low.startsWith('1b_')
          ? 'Putri'
          : low.includes('putra') || low.startsWith('1a_')
          ? 'Putra'
          : undefined;
      santriRows = santriRows.concat(parseSantriSimRows(matrix, forcedGender));
    } else if (low.includes('musyrifah') || low.startsWith('2b_')) {
      musyrifRows = musyrifRows.concat(
        parseTeacherRows(matrix, { defaultRole: 'Musyrifah', forcedGender: 'Putri' }),
      );
    } else if (low.includes('musyrif') || low.includes('musrif') || low.startsWith('2')) {
      const forcedGender = low.includes('putra') || low.startsWith('2a_') ? 'Putra' : undefined;
      musyrifRows = musyrifRows.concat(
        parseTeacherRows(matrix, { defaultRole: 'Musyrif', forcedGender }),
      );
    } else if (low.includes('wali') || low.startsWith('3a_') || low.startsWith('3b_')) {
      const forcedGender =
        low.includes('putri') || low.startsWith('3b_')
          ? 'Putri'
          : low.includes('putra') || low.startsWith('3a_')
          ? 'Putra'
          : undefined;
      const parsedRows = parseTeacherRows(matrix, { defaultRole: 'Wali Kelas', forcedGender });
      for (const row of parsedRows) {
        if (row.peran === 'Guru') guruRows.push(row);
        else if (row.peran === 'Musyrif' || row.peran === 'Musyrifah') musyrifRows.push(row);
        else waliKelasRows.push(row);
      }
    } else if (low.includes('guru') || low.includes('pengampu') || low.startsWith('3c_') || low.startsWith('3_')) {
      const parsedRows = parseTeacherRows(matrix, { defaultRole: 'Guru' });
      for (const row of parsedRows) {
        if (row.peran === 'Wali Kelas') waliKelasRows.push(row);
        else if (row.peran === 'Musyrif' || row.peran === 'Musyrifah') musyrifRows.push(row);
        else guruRows.push(row);
      }
    } else if (low.includes('jadwal') || low.startsWith('4_')) {
      scheduleRows = scheduleRows.concat(parseScheduleRows(matrix));
    } else if (low.includes('ruang') || low.startsWith('5_')) {
      ruanganUjian = Array.from(new Set([...ruanganUjian, ...parseRuanganRows(matrix)]));
    } else {
      // Header-based fallback detection for generic sheet names (e.g. Sheet1, Data, IntegrASI)
      const headerJoined = (matrix[0] || []).join(' ').toLowerCase();
      if (
        headerJoined.includes('kelp') ||
        headerJoined.includes('kelompok') ||
        headerJoined.includes('pengampu') ||
        (headerJoined.includes('nama') && headerJoined.includes('kelas') && headerJoined.includes('kamar'))
      ) {
        santriRows = santriRows.concat(parseSantriSimRows(matrix));
      } else if (headerJoined.includes('hari') && (headerJoined.includes('mapel') || headerJoined.includes('jam'))) {
        scheduleRows = scheduleRows.concat(parseScheduleRows(matrix));
      } else if (headerJoined.includes('uraian') || headerJoined.includes('tindak lanjut')) {
        pembinaanRows = pembinaanRows.concat(parsePembinaanImportRows(matrix));
      } else if (headerJoined.includes('amanah') || headerJoined.includes('peran') || headerJoined.includes('jabatan')) {
        pegawaiRows = pegawaiRows.concat(parseTeacherRows(matrix));
      } else if (headerJoined.includes('kamar binaan') || headerJoined.includes('musyrif')) {
        musyrifRows = musyrifRows.concat(parseTeacherRows(matrix, { defaultRole: 'Musyrif' }));
      } else if (headerJoined.includes('kelas binaan') || headerJoined.includes('wali kelas')) {
        waliKelasRows = waliKelasRows.concat(parseTeacherRows(matrix, { defaultRole: 'Wali Kelas' }));
      } else if (headerJoined.includes('ruang ujian')) {
        ruanganUjian = Array.from(new Set([...ruanganUjian, ...parseRuanganRows(matrix)]));
      }
    }
  }

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
