import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CalendarPlus,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  Edit3,
  FileSpreadsheet,
  History,
  LayoutGrid,
  Lock,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  LabkomBooking,
  LabkomKampus,
  LabkomMasterKategori,
  LabkomStatePayload,
  SemesterFilter,
  TeacherPublic,
} from '../types';
import {
  downloadLabkomDenahPdf,
  downloadLabkomExcelClient,
  downloadLabkomLogTemplateClient,
  downloadLabkomMasterTemplateClient,
  downloadLabkomRekapPdf,
  getTodayDateStr,
  NAMA_BULAN_INDO,
  shiftDateStr,
} from '../utils/exportHelpers';
import {
  formatTanggalIndoLengkap,
  getAcademicSemester,
  matchesSemesterFilter,
  parseFlexibleDateToIso,
} from '../utils/semesterHelpers';
import { emitDataMutated, loadSubTab, saveSubTab } from '../utils/sessionPersistence';

type LabkomTab =
  | 'dashboard'
  | 'form'
  | 'rekap'
  | 'ploting'
  | 'broadcast'
  | 'massal'
  | 'jadwal'
  | 'history'
  | 'master';

const VALID_TABS: readonly LabkomTab[] = [
  'dashboard',
  'form',
  'rekap',
  'ploting',
  'broadcast',
  'massal',
  'jadwal',
  'history',
  'master',
];

const HARI_MAP: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
};

const ROOM_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
  'bg-fuchsia-600',
];

const ROOM_DOT_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-fuchsia-500',
];

function getColorIdx(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % ROOM_COLORS.length;
}

function getDayNumber1To7(dateStr: string): number {
  const iso = parseFlexibleDateToIso(dateStr);
  if (!iso) return 1;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const day = dt.getDay();
  return day === 0 ? 7 : day;
}

function normalizeExcelDateCell(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number' && Number.isFinite(val)) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  const raw = String(val).trim();
  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 90000) {
      const parsed = XLSX.SSF.parse_date_code(serial);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    }
  }
  return parseFlexibleDateToIso(raw) || raw;
}

function detectClientCsvDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  const countChar = (delim: string) => {
    let total = 0;
    for (const line of lines) {
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQ = !inQ;
        else if (!inQ && line[i] === delim) total++;
      }
    }
    return total;
  };
  const ranked = [
    { d: ';', n: countChar(';') },
    { d: ',', n: countChar(',') },
    { d: '\t', n: countChar('\t') },
  ].sort((a, b) => b.n - a.n);
  return ranked[0].n > 0 ? ranked[0].d : ',';
}

function parseClientCsvMatrix(rawText: string): string[][] {
  const cleaned = rawText.replace(/^\uFEFF/, '');
  const delim = detectClientCsvDelimiter(cleaned);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inQ) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && cleaned[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function normHdr(raw: unknown): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extractLabkomRowsFromMatrix(
  matrix: unknown[][],
  hintKampus?: LabkomKampus,
): Array<Partial<LabkomBooking>> {
  if (!matrix || matrix.length === 0) return [];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 25); i++) {
    const tokens = (matrix[i] || []).map(normHdr);
    const hasLoc = tokens.some(
      (t) =>
        t === 'lab' ||
        t.includes('lokasi') ||
        t.includes('ruang') ||
        t.includes('labkom') ||
        t === 'tempat',
    );
    const hasTgl = tokens.some((t) => t.includes('tanggal') || t === 'tgl' || t === 'date');
    const hasJam = tokens.some(
      (t) => t.includes('jam') || t.includes('sesi') || t.includes('waktu'),
    );
    if ((hasLoc && hasTgl) || (hasTgl && hasJam) || (hasLoc && hasJam)) {
      headerIdx = i;
      break;
    }
  }

  let iId = 0;
  let iTs = 1;
  let iKampus = 2;
  let iEmail = 3;
  let iNama = 4;
  let iGuru = 5;
  let iKelas = 6;
  let iMapel = 7;
  let iLab = 8;
  let iTgl = 9;
  let iJam = 10;
  let iKet = 11;
  let iStatus = 12;
  let startRow = 0;

  if (headerIdx >= 0) {
    startRow = headerIdx + 1;
    const hdr = (matrix[headerIdx] || []).map(normHdr);
    const findCol = (preds: Array<(h: string) => boolean>, fallback: number): number => {
      const idx = hdr.findIndex((h) => h && preds.some((fn) => fn(h)));
      return idx >= 0 ? idx : fallback;
    };
    iId = findCol([(h) => h === 'id' || h === 'idtransaksi' || h === 'kode'], -1);
    iTs = findCol([(h) => h.includes('timestamp') || h === 'dibuat'], -1);
    iKampus = findCol([(h) => h.includes('kampus') || h.includes('wilayah') || h === 'area' || h === 'unit'], -1);
    iEmail = findCol([(h) => h.includes('email')], -1);
    iNama = findCol([(h) => h.includes('namapeminjam') || h === 'peminjam' || h === 'pemohon' || h === 'nama'], -1);
    iGuru = findCol([(h) => h.includes('guru') || h.includes('pengajar') || h.includes('ustadz') || h.includes('pembina')], -1);
    iKelas = findCol([(h) => h.includes('kelas') || h.includes('rombel')], -1);
    iMapel = findCol([(h) => h.includes('mapel') || h.includes('matapelajaran') || h.includes('kegiatan') || h.includes('keperluan')], -1);
    iLab = findCol([(h) => h === 'lab' || h.includes('labkom') || h.includes('ruang') || h.includes('lokasi') || h === 'tempat'], -1);
    iTgl = findCol([(h) => h.includes('tanggal') || h === 'tgl' || h === 'date'], -1);
    iJam = findCol([(h) => h.includes('jamke') || h === 'jam' || h.includes('sesi') || h.includes('waktu')], -1);
    iKet = findCol([(h) => h.includes('keterangan') || h === 'ket' || h.includes('catatan')], -1);
    iStatus = findCol([(h) => h.includes('status')], -1);
  }

  const out: Array<Partial<LabkomBooking>> = [];
  for (let r = startRow; r < matrix.length; r++) {
    const row = matrix[r] || [];
    const readStr = (idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '');
    const lab = readStr(iLab).toUpperCase();
    const rawTgl = iTgl >= 0 ? row[iTgl] : undefined;
    const tanggal = normalizeExcelDateCell(rawTgl);
    const jamKe = readStr(iJam).toUpperCase();
    if (!lab || !tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !jamKe) continue;

    const kampusCell = readStr(iKampus).toUpperCase();
    const guru = readStr(iGuru) || '-';
    const kelas = readStr(iKelas) || '-';
    const namaPeminjam = readStr(iNama) || guru;
    const mapel = readStr(iMapel) || '-';
    const ket = readStr(iKet);

    const combinedHints = `${lab} ${kelas} ${guru} ${namaPeminjam} ${ket}`.toUpperCase();
    const isPutriKeyword =
      kampusCell.includes('PUTRI') ||
      kampusCell === 'PI' ||
      kampusCell === 'AKHWAT' ||
      /\b(PUTRI|AKHWAT|USTZ|KHADIJAH|AISYAH|FATIMAH|HAFSHAH|ZAINAB|MARIYAM)\b/i.test(combinedHints);
    const isPutraKeyword =
      kampusCell.includes('PUTRA') ||
      kampusCell === 'PA' ||
      kampusCell === 'IKHWAN';

    const resolvedKampus: LabkomKampus = isPutriKeyword
      ? 'PUTRI'
      : isPutraKeyword
      ? 'PUTRA'
      : hintKampus || 'PUTRA';

    out.push({
      id: readStr(iId),
      timestamp: readStr(iTs),
      kampus: resolvedKampus,
      email: readStr(iEmail),
      namaPeminjam: namaPeminjam || '-',
      guru,
      kelas,
      mapel,
      lab,
      tanggal,
      jamKe,
      keterangan: ket,
      status: readStr(iStatus) || 'Disetujui',
    });
  }
  return out;
}

interface Props {
  currentUser: TeacherPublic | null;
  onRequestLogin: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LabkomRuangModule: React.FC<Props> = ({
  currentUser,
  onRequestLogin,
  notify,
}) => {
  const isAdmin = Boolean(
    currentUser &&
      (currentUser.peran === 'Admin Super' ||
        currentUser.peran === 'Admin SIM' ||
        (currentUser.peranTambahan || []).includes('Admin Super') ||
        (currentUser.peranTambahan || []).includes('Admin SIM')),
  );

  const [state, setState] = useState<LabkomStatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tab, setTab] = useState<LabkomTab>(() =>
    loadSubTab('pintar_labkom_tab_v1', VALID_TABS, 'dashboard'),
  );
  const [viewKampus, setViewKampus] = useState<LabkomKampus>(() =>
    loadSubTab('pintar_labkom_kampus_v1', ['PUTRA', 'PUTRI'] as const, 'PUTRA'),
  );
  const [viewSub, setViewSub] = useState<'lab' | 'ruang'>(() =>
    loadSubTab('pintar_labkom_sub_v1', ['lab', 'ruang'] as const, 'lab'),
  );
  const [vDate, setVDate] = useState<string>(() => getTodayDateStr());

  // Rekap Filters (Default ke semester terdeteksi otomatis atau ALL)
  const todaySemester = useMemo(() => getAcademicSemester(), []);
  const selectedDateSemester = useMemo(() => getAcademicSemester(vDate), [vDate]);
  const [filterSemester, setFilterSemester] = useState<SemesterFilter>('ALL');
  const [filterBulan, setFilterBulan] = useState<string>('ALL');
  const [excludeInformatika, setExcludeInformatika] = useState<boolean>(true);

  // Single Booking Form State
  const [formKampus, setFormKampus] = useState<LabkomKampus>(viewKampus);
  const [formEmail, setFormEmail] = useState<string>(currentUser?.username || '');
  const [formNama, setFormNama] = useState<string>(currentUser?.nama || '');
  const [formGuru, setFormGuru] = useState<string>('');
  const [formKelas, setFormKelas] = useState<string>('-');
  const [formLab, setFormLab] = useState<string>('');
  const [formMapel, setFormMapel] = useState<string>('-');
  const [formTanggal, setFormTanggal] = useState<string>(vDate);
  const [selectedJams, setSelectedJams] = useState<string[]>([]);
  const [formKeterangan, setFormKeterangan] = useState<string>('');

  // Bulk Booking State
  const [bulkTglMulai, setBulkTglMulai] = useState<string>(getTodayDateStr());
  const [bulkTglSelesai, setBulkTglSelesai] = useState<string>(shiftDateStr(getTodayDateStr(), 30));
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkJams, setBulkJams] = useState<string[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // Fixed Schedule State
  const [fixedKampus, setFixedKampus] = useState<LabkomKampus>('PUTRA');
  const [fixedHari, setFixedHari] = useState<number>(1);
  const [fixedLab, setFixedLab] = useState<string>('');
  const [fixedGuru, setFixedGuru] = useState<string>('');
  const [fixedKelas, setFixedKelas] = useState<string>('');
  const [fixedMapel, setFixedMapel] = useState<string>('');
  const [fixedJams, setFixedJams] = useState<string[]>([]);

  // Ploting State
  const [currentPlotingRuang, setCurrentPlotingRuang] = useState<string>('LABKOM A');
  const [plotModalPc, setPlotModalPc] = useState<number | null>(null);
  const [plotSelectedKelas, setPlotSelectedKelas] = useState<string>('ALL');
  const [plotSelectedSiswa, setPlotSelectedSiswa] = useState<string>('--KOSONGKAN--');
  const [plotManualName, setPlotManualName] = useState<string>('');
  const [plotManualKelas, setPlotManualKelas] = useState<string>('');

  // Broadcast State
  const [broadcastDraft, setBroadcastDraft] = useState<string>('');
  const [templateModalOpen, setTemplateModalOpen] = useState<boolean>(false);
  const [templateEditorVal, setTemplateEditorVal] = useState<string>('');
  const [tgConfigOpen, setTgConfigOpen] = useState<boolean>(false);
  const [tgBotToken, setTgBotToken] = useState<string>('');
  const [tgChatId, setTgChatId] = useState<string>('');

  // History & Visualization State (Detailed Booking Logs Data Grid)
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyKampusFilter, setHistoryKampusFilter] = useState<'ALL' | LabkomKampus>('ALL');
  const [historySemesterFilter, setHistorySemesterFilter] = useState<SemesterFilter>('ALL');
  const [historyLabFilter, setHistoryLabFilter] = useState<string>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [historySortKey, setHistorySortKey] = useState<
    'tanggal' | 'kampus' | 'namaPeminjam' | 'guru' | 'kelas' | 'mapel' | 'lab' | 'jamKe' | 'status'
  >('tanggal');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('desc');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number | 'ALL'>(50);
  const [historySelectedIds, setHistorySelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<boolean>(false);
  const [dashBorrowerFilter, setDashBorrowerFilter] = useState<'ALL' | LabkomKampus>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Admin Edit Booking Modal State
  const [editingBooking, setEditingBooking] = useState<LabkomBooking | null>(null);
  const [editKampus, setEditKampus] = useState<LabkomKampus>('PUTRA');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editNamaPeminjam, setEditNamaPeminjam] = useState<string>('');
  const [editGuru, setEditGuru] = useState<string>('');
  const [editKelas, setEditKelas] = useState<string>('');
  const [editMapel, setEditMapel] = useState<string>('');
  const [editLab, setEditLab] = useState<string>('');
  const [editTanggal, setEditTanggal] = useState<string>('');
  const [editJamKe, setEditJamKe] = useState<string>('');
  const [editKeterangan, setEditKeterangan] = useState<string>('');
  const [editStatus, setEditStatus] = useState<string>('Disetujui');

  // Log Upload Preview State (Putra & Putri Excel / CSV)
  const logPreviewRef = useRef<HTMLDivElement | null>(null);
  const [logImportPreview, setLogImportPreview] = useState<{
    fileName: string;
    isCsv: boolean;
    csvText?: string;
    rows: Array<Partial<LabkomBooking>>;
    defaultKampus: 'AUTO' | 'PUTRA' | 'PUTRI';
    mode: 'append' | 'upsert' | 'replace';
    autoSyncMasters: boolean;
  } | null>(null);

  // Master Data State
  const [masterKategori, setMasterKategori] = useState<LabkomMasterKategori>('GURU');
  const [masterNilai, setMasterNilai] = useState<string>('');
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
  const [editingMasterVal, setEditingMasterVal] = useState<string>('');
  const [masterSearch, setMasterSearch] = useState<string>('');
  const [masterCascadeEdit, setMasterCascadeEdit] = useState<boolean>(true);
  const [masterBulkPasteOpen, setMasterBulkPasteOpen] = useState<boolean>(false);
  const [masterBulkPasteText, setMasterBulkPasteText] = useState<string>('');
  const [masterImportPreview, setMasterImportPreview] = useState<{
    fileName: string;
    items: Array<{
      id?: string;
      kategori: LabkomMasterKategori;
      nilai: string;
      renameFrom?: string;
    }>;
    mode: 'merge' | 'replace';
    cascade: boolean;
  } | null>(null);

  useEffect(() => {
    saveSubTab('pintar_labkom_tab_v1', tab);
  }, [tab]);

  useEffect(() => {
    saveSubTab('pintar_labkom_kampus_v1', viewKampus);
    setFormKampus(viewKampus);
  }, [viewKampus]);

  useEffect(() => {
    saveSubTab('pintar_labkom_sub_v1', viewSub);
    setSelectedJams([]);
    setBulkJams([]);
  }, [viewSub]);

  useEffect(() => {
    if (currentUser) {
      if (!formNama) setFormNama(currentUser.nama);
      if (!formEmail) setFormEmail(currentUser.username.includes('@') ? currentUser.username : `${currentUser.username}@assyifa.sch.id`);
    }
  }, [currentUser, formEmail, formNama]);

  const fetchLabkomState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/labkom/state');
      if (!res.ok) throw new Error('HTTP error');
      const data = (await res.json()) as LabkomStatePayload;
      setState(data);
      setTemplateEditorVal(data.broadcastTemplate);
    } catch {
      notify('Gagal memuat data Labkom & Ruangan SMA.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchLabkomState();
  }, [fetchLabkomState]);

  const getMaster = useCallback(
    (kat: LabkomMasterKategori) => {
      if (!state) return [];
      return state.masters
        .filter((m) => m.kategori === kat)
        .sort((a, b) => a.nilai.localeCompare(b.nilai, 'id', { numeric: true }));
    },
    [state],
  );

  // Initialize default dropdown selections once state loads
  useEffect(() => {
    if (!state) return;
    const gurus = getMaster('GURU');
    const kelasList = getMaster('KELAS');
    const mapels = getMaster('MAPEL');
    const locs = getMaster(viewSub === 'lab' ? 'LAB' : 'RUANGAN');
    const allLocs = [...getMaster('LAB'), ...getMaster('RUANGAN')];

    if (!formGuru && gurus.length > 0) setFormGuru(gurus[0].nilai);
    if ((!formLab || !locs.some((l) => l.nilai === formLab)) && locs.length > 0) {
      setFormLab(locs[0].nilai);
    }
    if (!fixedGuru && gurus.length > 0) setFixedGuru(gurus[0].nilai);
    if (!fixedKelas && kelasList.length > 0) setFixedKelas(kelasList[0].nilai);
    if (!fixedMapel && mapels.length > 0) setFixedMapel(mapels[0].nilai);
    if (!fixedLab && allLocs.length > 0) setFixedLab(allLocs[0].nilai);
    if (allLocs.length > 0 && !allLocs.some((l) => l.nilai === currentPlotingRuang)) {
      setCurrentPlotingRuang(allLocs[0].nilai);
    }
  }, [state, viewSub, formGuru, formLab, fixedGuru, fixedKelas, fixedMapel, fixedLab, currentPlotingRuang, getMaster]);

  // Helper: Merge Bookings + Fixed Schedules for a given date & kampus
  const getMergedSchedule = useCallback(
    (targetDate: string, targetKampus: LabkomKampus) => {
      if (!state) return [];
      const dayNum = getDayNumber1To7(targetDate);
      const isoDate = parseFlexibleDateToIso(targetDate);
      const activeBookings = state.bookings.filter(
        (b) => b.kampus === targetKampus && b.tanggal === isoDate,
      );
      const fixedForDay: LabkomBooking[] = state.fixedSchedules
        .filter((f) => f.kampus === targetKampus && f.hari === dayNum)
        .map((f) => ({
          id: f.id,
          timestamp: '',
          kampus: f.kampus,
          email: '',
          namaPeminjam: 'Sistem',
          guru: f.guru,
          kelas: f.kelas,
          mapel: f.mapel,
          lab: f.lab,
          tanggal: isoDate,
          jamKe: f.jamKe,
          keterangan: 'JADWAL TETAP / KBM',
          status: 'Tetap',
        }));

      return [...activeBookings, ...fixedForDay];
    },
    [state],
  );

  // ==========================================
  // BROADCAST TEXT GENERATOR (Exact GAS Grouping Algorithm)
  // ==========================================
  const computedBroadcastText = useMemo(() => {
    if (!state) return '';
    const isLab = viewSub === 'lab';
    const cols = getMaster(isLab ? 'LAB' : 'RUANGAN');
    const rows = getMaster(isLab ? 'JAM' : 'WAKTU_RUANG');
    const merged = getMergedSchedule(vDate, viewKampus);

    if (cols.length === 0) return '_Tidak ada data master lokasi._';

    let dataText = '';
    for (const lb of cols) {
      interface GroupBlock {
        key: string;
        detail: LabkomBooking | null;
        jams: string[];
      }
      const groupedDB: GroupBlock[] = [];
      let currentGroup: GroupBlock | null = null;

      for (const jm of rows) {
        if (!jm.nilai) continue;
        const b = merged.find(
          (x) =>
            x.lab.toUpperCase() === lb.nilai.toUpperCase() &&
            x.jamKe.toUpperCase() === jm.nilai.toUpperCase(),
        );
        const key = b ? `${b.mapel}-${b.guru}-${b.kelas}-${b.keterangan}` : 'KOSONG';
        const detail = b || null;

        if (!currentGroup) {
          currentGroup = { key, detail, jams: [jm.nilai] };
        } else if (currentGroup.key === key) {
          currentGroup.jams.push(jm.nilai);
        } else {
          groupedDB.push(currentGroup);
          currentGroup = { key, detail, jams: [jm.nilai] };
        }
      }
      if (currentGroup) groupedDB.push(currentGroup);

      let namaRuang = lb.nilai.toUpperCase();
      if (isLab && !namaRuang.includes('LAB')) {
        namaRuang = `LABKOM ${namaRuang}`;
      }

      const divider = '==========================================\n';
      dataText += divider;
      dataText += `${namaRuang} ${viewKampus}\n`;
      dataText += divider;

      for (const d of groupedDB) {
        let jamStr = d.jams[0];
        if (d.jams.length > 1) {
          const validNums = d.jams
            .map((j) => {
              const trimmed = j.trim();
              return /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN;
            })
            .filter((n) => !Number.isNaN(n));

          if (validNums.length === d.jams.length) {
            const sorted = [...validNums].sort((a, b) => a - b);
            let consecutive = true;
            for (let i = 1; i < sorted.length; i++) {
              if (sorted[i] !== sorted[i - 1] + 1) {
                consecutive = false;
                break;
              }
            }
            jamStr = consecutive ? `${sorted[0]} - ${sorted[sorted.length - 1]}` : sorted.join(', ');
          } else {
            jamStr = d.jams.join(', ');
          }
        }

        dataText += `▪️ *${namaRuang}* (${isLab ? 'Jam' : 'Waktu'} ${jamStr})\n`;
        if (d.key === 'KOSONG' || !d.detail) {
          dataText += `   _KOSONG_\n\n`;
        } else {
          dataText += `   Guru: ${d.detail.guru}\n`;
          dataText += `   Kelas: ${d.detail.kelas !== '-' ? d.detail.kelas : 'Tanpa Kelas'} | Mapel: ${d.detail.mapel}\n`;
          if (d.detail.keterangan && d.detail.keterangan !== 'JADWAL TETAP / KBM') {
            dataText += `   Ket: ${d.detail.keterangan}\n`;
          }
          dataText += '\n';
        }
      }
    }

    const template =
      state.broadcastTemplate ||
      '==========================================\n📢 *INFO JADWAL RUANGAN & LABKOM* 📢\n🏢 Area: *{{KAMPUS}}*\n🗓 Tanggal: *{{TANGGAL}}*\n{{DATA}}==========================================\nBooking Link:\n_s.id/bookingruangansma_\n==========================================';

    return template
      .replace('{{KAMPUS}}', viewKampus)
      .replace('{{TANGGAL}}', formatTanggalIndoLengkap(vDate))
      .replace('{{DATA}}', dataText);
  }, [state, viewSub, viewKampus, vDate, getMaster, getMergedSchedule]);

  useEffect(() => {
    setBroadcastDraft(computedBroadcastText);
  }, [computedBroadcastText]);

  // ==========================================
  // REKAP ANALITIK (SEMESTER GANJIL / GENAP + BULAN)
  // ==========================================
  const rekapData = useMemo(() => {
    if (!state) {
      return {
        guruAktif: [] as Array<[string, number]>,
        guruBelum: [] as string[],
        topItems: [] as Array<[string, number]>,
        totalPemakaian: 0,
        totalRawDiPeriode: 0,
      };
    }
    const isLab = viewSub === 'lab';
    const validLocs = new Set(getMaster(isLab ? 'LAB' : 'RUANGAN').map((l) => l.nilai.toUpperCase()));
    const guruMaster = getMaster('GURU');

    const guruCounts: Record<string, number> = {};
    guruMaster.forEach((g) => {
      guruCounts[g.nilai] = 0;
    });
    const itemCounts: Record<string, number> = {};

    const activeDB = state.bookings.filter((b) => b.kampus === viewKampus);
    const filteredByTime = activeDB.filter((r) => {
      if (!r.tanggal) return false;
      const mm = r.tanggal.slice(5, 7);
      const passBulan = filterBulan === 'ALL' || mm === filterBulan;
      const passSem = matchesSemesterFilter(r.tanggal, filterSemester);
      return passBulan && passSem;
    });

    let totalPemakaian = 0;
    for (const r of filteredByTime) {
      const amanLab = (r.lab || '').toUpperCase();
      const amanMapel = (r.mapel || '').toUpperCase();
      const amanGuru = (r.guru || '').trim();
      if (!validLocs.has(amanLab)) continue;
      if (excludeInformatika && amanMapel.includes('INFORMATIKA')) continue;

      totalPemakaian++;
      if (amanGuru && amanGuru !== '-') {
        guruCounts[amanGuru] = (guruCounts[amanGuru] ?? 0) + 1;
      }
      if (isLab) {
        if (r.mapel && r.mapel !== '-') {
          itemCounts[r.mapel] = (itemCounts[r.mapel] || 0) + 1;
        }
      } else if (r.lab) {
        itemCounts[r.lab] = (itemCounts[r.lab] || 0) + 1;
      }
    }

    const sortedGuru = Object.entries(guruCounts).sort((a, b) => b[1] - a[1]);
    const guruAktif = sortedGuru.filter((g) => g[1] > 0);
    const guruBelum = sortedGuru.filter((g) => g[1] === 0).map((g) => g[0]);
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

    return {
      guruAktif,
      guruBelum,
      topItems,
      totalPemakaian,
      totalRawDiPeriode: filteredByTime.length,
    };
  }, [state, viewSub, viewKampus, filterBulan, filterSemester, excludeInformatika, getMaster]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleQuickBookCell = (labName: string, jamName: string) => {
    setFormKampus(viewKampus);
    setFormTanggal(vDate);
    setFormLab(labName);
    setSelectedJams([jamName]);
    setTab('form');
  };

  const toggleArrValue = <T,>(arr: T[], val: T, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  };

  const handleSubmitSingleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJams.length === 0) {
      notify('Pilih minimal satu jam / slot waktu terlebih dahulu.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kampus: formKampus,
          email: formEmail,
          namaPeminjam: formNama,
          guru: formGuru,
          kelas: formKelas,
          lab: formLab,
          mapel: formMapel,
          tanggal: formTanggal,
          jamKe: selectedJams,
          keterangan: formKeterangan,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal menyimpan booking.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setSelectedJams([]);
      setFormKeterangan('');
      setViewKampus(formKampus);
      setVDate(formTanggal);
      setTab('dashboard');
      notify(`Booking ${formLab} (${selectedJams.length} slot) berhasil disimpan.`, 'success');
    } catch {
      notify('Terjadi kesalahan koneksi saat menyimpan booking.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const bulkTargetDates = useMemo(() => {
    if (!bulkTglMulai || !bulkTglSelesai || bulkDays.length === 0) return [];
    const start = new Date(`${bulkTglMulai}T00:00:00`);
    const end = new Date(`${bulkTglSelesai}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

    const dates: string[] = [];
    const cur = new Date(start);
    let guard = 0;
    while (cur <= end && guard < 370) {
      const dayNum = cur.getDay() === 0 ? 7 : cur.getDay();
      if (bulkDays.includes(dayNum)) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
      }
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    return dates;
  }, [bulkTglMulai, bulkTglSelesai, bulkDays]);

  const handleSubmitBulkBooking = async () => {
    if (bulkTargetDates.length === 0 || bulkJams.length === 0) {
      notify('Pilih rentang tanggal, hari, dan jam aktif.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/bookings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kampus: formKampus,
          email: formEmail || 'admin@assyifa.sch.id',
          namaPeminjam: formNama || currentUser?.nama || 'Admin',
          guru: formGuru,
          kelas: formKelas,
          lab: formLab,
          mapel: formMapel,
          tanggalList: bulkTargetDates,
          jamKe: bulkJams,
          keterangan: formKeterangan,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal memproses booking massal.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setBulkJams([]);
      setBulkConfirmOpen(false);
      setTab('dashboard');
      notify(`Berhasil menyimpan ${data.createdCount} slot booking massal.`, 'success');
    } catch {
      notify('Gagal terhubung ke server untuk booking massal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFixedSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fixedJams.length === 0) {
      notify('Pilih minimal satu jam untuk jadwal tetap.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kampus: fixedKampus,
          hari: fixedHari,
          lab: fixedLab,
          guru: fixedGuru,
          kelas: fixedKelas,
          mapel: fixedMapel,
          jamKe: fixedJams,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal menyimpan jadwal tetap.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setFixedJams([]);
      notify('Jadwal tetap / KBM disimpan dan otomatis memblokir booking.', 'success');
    } catch {
      notify('Kesalahan server saat menyimpan jadwal tetap.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFixed = async (id: string) => {
    try {
      const res = await fetch(`/api/labkom/fixed/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        notify('Jadwal tetap dihapus.', 'info');
      }
    } catch {
      notify('Gagal menghapus jadwal tetap.', 'error');
    }
  };

  const handleSavePloting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (plotModalPc === null) return;
    let nama = '-';
    let kelas = '-';
    if (plotSelectedSiswa === '--MANUAL--') {
      nama = plotManualName.trim() || '-';
      kelas = plotManualKelas.trim() || '-';
    } else if (plotSelectedSiswa !== '--KOSONGKAN--') {
      const [n, k] = plotSelectedSiswa.split('|');
      nama = n || '-';
      kelas = k || '-';
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/ploting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kampus: viewKampus,
          lokasi: currentPlotingRuang,
          noPc: plotModalPc,
          namaSiswa: nama,
          kelas,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        setPlotModalPc(null);
        notify(`Posisi PC/Kursi #${plotModalPc} diperbarui.`, 'success');
      } else {
        notify(data.error || 'Gagal menyimpan ploting.', 'error');
      }
    } catch {
      notify('Gagal terhubung ke server.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePloting = async (id: string) => {
    try {
      const res = await fetch(`/api/labkom/ploting/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        notify('Posisi PC/Kursi dikosongkan.', 'info');
      }
    } catch {
      notify('Gagal mengosongkan posisi.', 'error');
    }
  };

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterNilai.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategori: masterKategori, nilai: masterNilai }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal menambah master data.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setMasterNilai('');
      notify(`Master ${masterKategori} ditambahkan.`, 'success');
    } catch {
      notify('Kesalahan server saat menyimpan master.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMaster = async (id: string) => {
    if (!editingMasterVal.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/labkom/master/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nilai: editingMasterVal.trim(),
          cascade: masterCascadeEdit,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        setEditingMasterId(null);
        const totalUpdated =
          (data.updatedBookings || 0) + (data.updatedFixed || 0) + (data.updatedPlotings || 0);
        notify(
          totalUpdated > 0
            ? `Master data diperbarui & ${totalUpdated} data peminjaman/jadwal terkait ikut disesuaikan.`
            : 'Master data diperbarui.',
          'success',
        );
      } else {
        notify(data.error || 'Gagal memperbarui master.', 'error');
      }
    } catch {
      notify('Gagal memperbarui master.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMaster = async (id: string) => {
    try {
      const res = await fetch(`/api/labkom/master/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        notify('Master data dihapus.', 'info');
      }
    } catch {
      notify('Gagal menghapus master.', 'error');
    }
  };

  const handleSyncMastersFromBookings = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/master/sync-from-bookings', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal menarik master dari data peminjaman.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      notify(
        data.added > 0
          ? `${data.added} item baru berhasil ditarik dari data peminjaman sekarang (total ${data.total} master).`
          : `Semua nilai dari data peminjaman sudah tersedia di Master Data (${data.total} total).`,
        data.added > 0 ? 'success' : 'info',
      );
    } catch {
      notify('Gagal terhubung ke server saat sinkronisasi master.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadMasterTemplate = () => {
    if (!state) return;
    const res = downloadLabkomMasterTemplateClient({
      bookings: state.bookings,
      fixedSchedules: state.fixedSchedules,
      masters: state.masters,
    });
    notify(
      `Template Master Data (${res.totalItems} item, ${res.fromBookingsOnly} dari peminjaman) berhasil diunduh.`,
      'success',
    );
  };

  const handleParseMasterTemplateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      const WAKTU_SET = new Set(['PAGI', 'SIANG', 'SORE', 'MALAM']);
      const classifyLoc = (loc: string): 'LAB' | 'RUANGAN' =>
        loc.toUpperCase().includes('LAB') || loc.toUpperCase().includes('BIOKIM')
          ? 'LAB'
          : 'RUANGAN';
      const classifyJam = (jam: string): 'JAM' | 'WAKTU_RUANG' =>
        WAKTU_SET.has(jam.trim().toUpperCase()) ? 'WAKTU_RUANG' : 'JAM';

      const validCats = new Set<LabkomMasterKategori>([
        'GURU',
        'KELAS',
        'MAPEL',
        'LAB',
        'RUANGAN',
        'JAM',
        'WAKTU_RUANG',
      ]);

      const sheetCategoryMap: Record<string, LabkomMasterKategori> = {
        master_guru: 'GURU',
        master_kelas: 'KELAS',
        master_mapel: 'MAPEL',
      };

      const hasDedicatedSheets = wb.SheetNames.some((n) => {
        const lower = n.trim().toLowerCase();
        return (
          lower === 'master_guru' ||
          lower === 'master_kelas' ||
          lower === 'master_mapel' ||
          lower === 'master_ruang' ||
          lower === 'master_waktu'
        );
      });

      const parsedMap = new Map<
        string,
        { id?: string; kategori: LabkomMasterKategori; nilai: string; renameFrom?: string }
      >();

      const processSheet = (sheetName: string, priority: number) => {
        const lowerName = sheetName.trim().toLowerCase();
        if (lowerName === '0_panduan' || lowerName === 'panduan') return;
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (rows.length === 0) return;

        for (const r of rows) {
          const normRow: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) {
            normRow[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v ?? '').trim();
          }

          const rawId = normRow.id || '';
          const rawNilaiSekarang =
            normRow.nilai_sekarang || normRow.nilai || normRow.nama || normRow.value || '';
          const rawUbahMenjadi =
            normRow.ubah_menjadi || normRow.nilai_baru || normRow.penyesuaian || '';
          const rawKat = (normRow.kategori || '').toUpperCase();

          const targetNilai = rawUbahMenjadi || rawNilaiSekarang;
          if (!targetNilai || targetNilai === '-') continue;

          let kategori: LabkomMasterKategori | null = null;
          if (validCats.has(rawKat as LabkomMasterKategori)) {
            kategori = rawKat as LabkomMasterKategori;
          } else if (sheetCategoryMap[lowerName]) {
            kategori = sheetCategoryMap[lowerName];
          } else if (lowerName === 'master_ruang') {
            kategori = classifyLoc(targetNilai);
          } else if (lowerName === 'master_waktu') {
            kategori = classifyJam(targetNilai);
          } else if (!hasDedicatedSheets) {
            kategori = masterKategori;
          }
          if (!kategori) continue;

          let renameFrom = '';
          if (
            rawUbahMenjadi &&
            rawNilaiSekarang &&
            rawUbahMenjadi.trim().toUpperCase() !== rawNilaiSekarang.trim().toUpperCase()
          ) {
            renameFrom = rawNilaiSekarang;
          } else if (rawId && state) {
            const existingById = state.masters.find(
              (m) => m.id === rawId && m.kategori === kategori,
            );
            if (
              existingById &&
              existingById.nilai.trim().toUpperCase() !== targetNilai.trim().toUpperCase()
            ) {
              renameFrom = existingById.nilai;
            }
          }

          const dedupeKey = `${kategori}|${(renameFrom || targetNilai).toUpperCase()}|${priority === 2 ? 'DED' : 'ALL'}`;
          const baseKey = `${kategori}|${(renameFrom || targetNilai).toUpperCase()}`;
          const existing = parsedMap.get(baseKey);
          if (!existing || renameFrom || !existing.renameFrom) {
            if (!existing || renameFrom) {
              parsedMap.set(baseKey, {
                id: rawId || undefined,
                kategori,
                nilai: targetNilai,
                renameFrom: renameFrom || undefined,
              });
            }
          }
          void dedupeKey;
        }
      };

      // Process Master_Data first (lower priority), then dedicated sheets (so user edits in Master_Guru etc. override)
      for (const sName of wb.SheetNames) {
        if (sName.trim().toLowerCase() === 'master_data') {
          processSheet(sName, 1);
        }
      }
      for (const sName of wb.SheetNames) {
        if (sName.trim().toLowerCase() !== 'master_data') {
          processSheet(sName, 2);
        }
      }

      const items = Array.from(parsedMap.values());
      if (items.length === 0) {
        notify(
          'Tidak ditemukan baris Master Data yang valid di file tersebut. Pastikan kolom Nilai_Sekarang / Nilai terisi.',
          'error',
        );
        return;
      }

      setMasterImportPreview({
        fileName: file.name,
        items,
        mode: 'merge',
        cascade: true,
      });
      notify(
        `${items.length} baris Master Data siap ditinjau dari "${file.name}".`,
        'info',
      );
    } catch {
      notify('Gagal membaca file template Excel/CSV Master Data.', 'error');
    }
  };

  const handleApplyMasterImport = async () => {
    if (!masterImportPreview) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/master/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: masterImportPreview.items,
          mode: masterImportPreview.mode,
          cascade: masterImportPreview.cascade,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal menerapkan template Master Data.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setMasterImportPreview(null);
      const totalCascade =
        (data.updatedBookings || 0) + (data.updatedFixed || 0) + (data.updatedPlotings || 0);
      notify(
        `Template Master diterapkan: ${data.added} ditambahkan, ${data.renamed} penyesuaian nama, ${totalCascade} data peminjaman/jadwal diperbarui.`,
        'success',
      );
    } catch {
      notify('Gagal terhubung ke server saat mengimpor template master.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkPasteMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = masterBulkPasteText
      .split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => Boolean(s) && s !== '-');
    if (lines.length === 0) {
      notify('Masukkan minimal satu baris nilai master data.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/master/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((nilai) => ({ kategori: masterKategori, nilai })),
          mode: 'merge',
          cascade: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal menyimpan daftar massal.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setMasterBulkPasteText('');
      setMasterBulkPasteOpen(false);
      notify(
        `${data.added} item baru ditambahkan ke kategori ${masterKategori}.`,
        'success',
      );
    } catch {
      notify('Kesalahan server saat menyimpan daftar massal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      const res = await fetch('/api/labkom/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcastTemplate: templateEditorVal }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        setTemplateModalOpen(false);
        notify('Template broadcast disimpan.', 'success');
      }
    } catch {
      notify('Gagal menyimpan template.', 'error');
    }
  };

  const handleSaveTelegramConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/labkom/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramBotToken: tgBotToken, telegramChatId: tgChatId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        setTgConfigOpen(false);
        notify('Konfigurasi Bot Telegram disimpan.', 'success');
      }
    } catch {
      notify('Gagal menyimpan konfigurasi Telegram.', 'error');
    }
  };

  const handleSendTelegram = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: broadcastDraft }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.message || 'Gagal mengirim ke Telegram.', 'error');
        if (data.needsConfig) setTgConfigOpen(true);
        return;
      }
      notify(data.message, 'success');
    } catch {
      notify('Gagal terhubung ke endpoint Telegram.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyBroadcast = async () => {
    try {
      await navigator.clipboard.writeText(broadcastDraft);
      notify('Teks broadcast berhasil disalin ke clipboard.', 'success');
    } catch {
      notify('Gagal menyalin otomatis. Pilih teks lalu salin manual.', 'info');
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!isAdmin) {
      notify('Hanya Admin Super / Admin SIM yang dapat menghapus log peminjaman.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/labkom/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        setConfirmDeleteId(null);
        setHistorySelectedIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        notify('Data peminjaman berhasil dihapus.', 'info');
      } else {
        notify(data.error || 'Gagal menghapus data peminjaman.', 'error');
      }
    } catch {
      notify('Gagal menghapus booking.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditBookingModal = (b: LabkomBooking) => {
    if (!isAdmin) {
      notify('Hanya Admin Super / Admin SIM yang dapat mengedit data peminjam.', 'error');
      return;
    }
    setEditingBooking(b);
    setEditKampus(b.kampus === 'PUTRI' ? 'PUTRI' : 'PUTRA');
    setEditEmail(b.email || '');
    setEditNamaPeminjam(b.namaPeminjam || '');
    setEditGuru(b.guru || '');
    setEditKelas(b.kelas || '-');
    setEditMapel(b.mapel || '-');
    setEditLab(b.lab || '');
    setEditTanggal(b.tanggal || getTodayDateStr());
    setEditJamKe(b.jamKe || '');
    setEditKeterangan(b.keterangan || '');
    setEditStatus(b.status || 'Disetujui');
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;
    if (!isAdmin) {
      notify('Akses ditolak: hanya Admin yang dapat mengedit.', 'error');
      return;
    }
    if (!editLab.trim() || !editTanggal.trim() || !editJamKe.trim()) {
      notify('Lokasi, Tanggal, dan Jam Ke wajib diisi.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/labkom/bookings/${encodeURIComponent(editingBooking.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kampus: editKampus,
          email: editEmail,
          namaPeminjam: editNamaPeminjam,
          guru: editGuru,
          kelas: editKelas,
          mapel: editMapel,
          lab: editLab,
          tanggal: editTanggal,
          jamKe: editJamKe,
          keterangan: editKeterangan,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal memperbarui data peminjaman.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setEditingBooking(null);
      notify('Perubahan data peminjam berhasil disimpan.', 'success');
    } catch {
      notify('Gagal terhubung ke server saat menyimpan perubahan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBulkHistory = async () => {
    if (!isAdmin) {
      notify('Hanya Admin Super / Admin SIM yang dapat menghapus massal.', 'error');
      return;
    }
    const ids = Array.from(historySelectedIds);
    if (ids.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/labkom/bookings/delete-many', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data.state);
        emitDataMutated();
        setHistorySelectedIds(new Set());
        setConfirmBulkDelete(false);
        notify(`${data.deleted} data booking dihapus.`, 'success');
      }
    } catch {
      notify('Gagal menghapus data terpilih.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportSpreadsheetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubmitting(true);
    try {
      const lowerName = file.name.toLowerCase();
      const hasFilePutra = lowerName.includes('putra') || lowerName.includes('ikhwan');
      const hasFilePutri =
        lowerName.includes('putri') || lowerName.includes('akhwat') || lowerName.includes('siswi');
      const fileHintKampus: 'AUTO' | 'PUTRA' | 'PUTRI' =
        hasFilePutra && hasFilePutri
          ? 'AUTO'
          : hasFilePutri
          ? 'PUTRI'
          : hasFilePutra
          ? 'PUTRA'
          : 'AUTO';

      if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) {
        const csvText = await file.text();
        if (
          csvText.includes('TEMPLATE LOG PEMINJAMAN LABKOM') &&
          csvText.includes('PETUNJUK PENGISIAN') &&
          !csvText.toLowerCase().includes('jam_ke')
        ) {
          notify(
            'File CSV ini hanya berisi sheet "0_Panduan" (petunjuk pengisian) karena Excel/Google Sheets hanya mengekspor sheet pertama saat Save As CSV. Unggah langsung file .xlsx atau ekspor khusus sheet "Data_Pinjam_Putri" / "Data_Pinjam"!',
            'error',
          );
          return;
        }
        const matrix = parseClientCsvMatrix(csvText);
        const validRows = extractLabkomRowsFromMatrix(
          matrix,
          fileHintKampus === 'AUTO' ? undefined : fileHintKampus,
        );
        if (validRows.length === 0) {
          notify(
            `Tidak ditemukan baris log valid pada ${file.name}. Pastikan ada kolom Lokasi/Lab, Tanggal, dan Jam_Ke.`,
            'error',
          );
          return;
        }
        setLogImportPreview({
          fileName: file.name,
          isCsv: true,
          csvText,
          rows: validRows,
          defaultKampus: fileHintKampus,
          mode: 'upsert',
          autoSyncMasters: true,
        });
        const cPutra = validRows.filter((r) => r.kampus !== 'PUTRI').length;
        const cPutri = validRows.length - cPutra;
        notify(
          `CSV terbaca (${validRows.length} baris: Putra ${cPutra}, Putri ${cPutri}). Klik "Terapkan Import" di kotak kuning untuk menyimpan!`,
          'info',
        );
        setTimeout(() => logPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const allRows: Array<Partial<LabkomBooking>> = [];
        for (const sName of wb.SheetNames) {
          const upper = sName.toUpperCase();
          if (
            upper.includes('PANDUAN') ||
            upper.includes('REFERENSI') ||
            upper.startsWith('MASTER') ||
            upper.includes('JADWAL_TETAP') ||
            upper.includes('PLOTING')
          ) {
            continue;
          }
          const ws = wb.Sheets[sName];
          if (!ws) continue;
          const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: '',
            raw: true,
          });
          const hasSheetPutra = upper.includes('PUTRA') || upper.includes('IKHWAN');
          const hasSheetPutri =
            upper.includes('PUTRI') || upper.includes('AKHWAT') || upper.includes('SISWI');
          const sheetHintKampus: LabkomKampus | undefined =
            hasSheetPutra && hasSheetPutri
              ? undefined
              : hasSheetPutri
              ? 'PUTRI'
              : hasSheetPutra
              ? 'PUTRA'
              : fileHintKampus === 'PUTRI'
              ? 'PUTRI'
              : fileHintKampus === 'PUTRA'
              ? 'PUTRA'
              : undefined;

          const parsedSheetRows = extractLabkomRowsFromMatrix(matrix, sheetHintKampus);
          allRows.push(...parsedSheetRows);
        }
        if (allRows.length === 0) {
          notify(
            `Tidak ditemukan baris log peminjaman valid di ${file.name} (${wb.SheetNames.length} sheet). Pastikan sheet Data_Pinjam / Data_Pinjam_Putri terisi kolom Lab, Tanggal, dan Jam_Ke.`,
            'error',
          );
          return;
        }
        setLogImportPreview({
          fileName: file.name,
          isCsv: false,
          rows: allRows,
          defaultKampus: fileHintKampus,
          mode: 'upsert',
          autoSyncMasters: true,
        });
        const cPutra = allRows.filter((r) => r.kampus !== 'PUTRI').length;
        const cPutri = allRows.length - cPutra;
        notify(
          `Excel terbaca (${allRows.length} baris: Putra ${cPutra}, Putri ${cPutri}). Klik "Terapkan Import" di kotak kuning untuk menyimpan!`,
          'info',
        );
        setTimeout(() => logPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
      }
    } catch {
      notify('Gagal membaca file CSV / Excel.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTidyAllData = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/system/tidy-data', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal merapikan data Putra & Putri.', 'error');
        return;
      }
      if (data.labkomState) setState(data.labkomState);
      emitDataMutated();
      const s = data.summary;
      notify(
        `Data Putra & Putri dirapikan! Labkom Putra: ${s.after.labkomPutra}, Putri: ${s.after.labkomPutri} · Duplikat dibersihkan: ${s.duplicatesRemoved} · Klasifikasi diperbaiki: ${s.genderReclassified}.`,
        'success',
      );
    } catch {
      notify('Gagal terhubung ke server saat merapikan data.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommitLogImport = async () => {
    if (!logImportPreview) return;
    setSubmitting(true);
    try {
      const payload = logImportPreview.isCsv
        ? {
            csvText: logImportPreview.csvText,
            kampus: logImportPreview.defaultKampus,
            mode: logImportPreview.mode,
            autoSyncMasters: logImportPreview.autoSyncMasters,
          }
        : {
            rows: logImportPreview.rows.map((r) => ({
              ...r,
              kampus:
                logImportPreview.defaultKampus !== 'AUTO'
                  ? logImportPreview.defaultKampus
                  : r.kampus || 'PUTRA',
            })),
            kampus: logImportPreview.defaultKampus,
            mode: logImportPreview.mode,
            autoSyncMasters: logImportPreview.autoSyncMasters,
          };

      const res = await fetch('/api/labkom/bookings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Gagal mengimpor log peminjaman.', 'error');
        return;
      }
      setState(data.state);
      emitDataMutated();
      setLogImportPreview(null);
      notify(
        `Import log selesai: ${data.added} ditambah, ${data.updated || 0} diperbarui, ${data.skipped} dilewati.`,
        'success',
      );
    } catch {
      notify('Terjadi kesalahan koneksi saat mengimpor log.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setHistoryPage(1);
  }, [
    historySearch,
    historyKampusFilter,
    historySemesterFilter,
    historyLabFilter,
    historyStatusFilter,
    historySortKey,
    historySortDir,
    historyPageSize,
  ]);

  const historyKampusCounts = useMemo(() => {
    const all = state?.bookings || [];
    let putra = 0;
    let putri = 0;
    for (const b of all) {
      if (b.kampus === 'PUTRI') putri++;
      else putra++;
    }
    return { all: all.length, putra, putri };
  }, [state]);

  const historyLabOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of state?.bookings || []) {
      const lab = String(b.lab || '').trim().toUpperCase();
      if (lab) set.add(lab);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [state]);

  const historyStatusOptions = useMemo(() => {
    const set = new Set<string>(['Disetujui', 'Menunggu', 'Selesai', 'Dibatalkan']);
    for (const b of state?.bookings || []) {
      const st = String(b.status || '').trim();
      if (st) set.add(st);
    }
    return Array.from(set);
  }, [state]);

  const toggleHistorySort = (
    key:
      | 'tanggal'
      | 'kampus'
      | 'namaPeminjam'
      | 'guru'
      | 'kelas'
      | 'mapel'
      | 'lab'
      | 'jamKe'
      | 'status',
  ) => {
    if (historySortKey === key) {
      setHistorySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setHistorySortKey(key);
      setHistorySortDir(key === 'tanggal' ? 'desc' : 'asc');
    }
  };

  // Filtered & Sorted History Rows (Detailed Data Grid)
  const filteredHistory = useMemo(() => {
    if (!state) return [];
    const q = historySearch.trim().toLowerCase();
    const dir = historySortDir === 'asc' ? 1 : -1;
    return state.bookings
      .filter((b) => {
        if (historyKampusFilter !== 'ALL' && b.kampus !== historyKampusFilter) return false;
        if (!matchesSemesterFilter(b.tanggal, historySemesterFilter)) return false;
        if (historyLabFilter !== 'ALL' && b.lab.trim().toUpperCase() !== historyLabFilter) {
          return false;
        }
        if (
          historyStatusFilter !== 'ALL' &&
          (b.status || 'Disetujui').toLowerCase() !== historyStatusFilter.toLowerCase()
        ) {
          return false;
        }
        if (q) {
          const hay = `${b.id} ${b.kampus} ${b.email} ${b.namaPeminjam} ${b.guru} ${b.kelas} ${b.mapel} ${b.lab} ${b.tanggal} ${b.jamKe} ${b.keterangan} ${b.status}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (historySortKey) {
          case 'tanggal':
            cmp =
              a.tanggal.localeCompare(b.tanggal) ||
              a.jamKe.localeCompare(b.jamKe, 'id', { numeric: true }) ||
              a.timestamp.localeCompare(b.timestamp);
            break;
          case 'jamKe':
            cmp = a.jamKe.localeCompare(b.jamKe, 'id', { numeric: true });
            break;
          case 'kampus':
            cmp = a.kampus.localeCompare(b.kampus);
            break;
          case 'namaPeminjam':
            cmp = (a.namaPeminjam || '').localeCompare(b.namaPeminjam || '', 'id');
            break;
          case 'guru':
            cmp = (a.guru || '').localeCompare(b.guru || '', 'id');
            break;
          case 'kelas':
            cmp = (a.kelas || '').localeCompare(b.kelas || '', 'id', { numeric: true });
            break;
          case 'mapel':
            cmp = (a.mapel || '').localeCompare(b.mapel || '', 'id');
            break;
          case 'lab':
            cmp = (a.lab || '').localeCompare(b.lab || '', 'id', { numeric: true });
            break;
          case 'status':
            cmp = (a.status || 'Disetujui').localeCompare(b.status || 'Disetujui', 'id');
            break;
        }
        if (cmp !== 0) return cmp * dir;
        return b.tanggal.localeCompare(a.tanggal) || b.timestamp.localeCompare(a.timestamp);
      });
  }, [
    state,
    historyKampusFilter,
    historySemesterFilter,
    historyLabFilter,
    historyStatusFilter,
    historySearch,
    historySortKey,
    historySortDir,
  ]);

  const historyPageMeta = useMemo(() => {
    const total = filteredHistory.length;
    if (historyPageSize === 'ALL') {
      return {
        rows: filteredHistory,
        page: 1,
        totalPages: 1,
        startNum: total === 0 ? 0 : 1,
        endNum: total,
      };
    }
    const perPage = historyPageSize;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(Math.max(1, historyPage), totalPages);
    const startIdx = (safePage - 1) * perPage;
    const rows = filteredHistory.slice(startIdx, startIdx + perPage);
    return {
      rows,
      page: safePage,
      totalPages,
      startNum: total === 0 ? 0 : startIdx + 1,
      endNum: Math.min(total, startIdx + rows.length),
    };
  }, [filteredHistory, historyPage, historyPageSize]);

  // Visual Analytics Summary for Log Peminjam (Putra & Putri)
  const historyVisualStats = useMemo(() => {
    let putra = 0;
    let putri = 0;
    const borrowerMap = new Map<
      string,
      { name: string; putra: number; putri: number; total: number; latestDate: string }
    >();
    const roomMap = new Map<string, { lab: string; putra: number; putri: number; total: number }>();
    const uniquePeople = new Set<string>();

    for (const b of filteredHistory) {
      if (b.kampus === 'PUTRI') putri++;
      else putra++;

      const personLabel =
        (b.namaPeminjam && b.namaPeminjam !== '-' ? b.namaPeminjam : b.guru) || 'Tanpa Nama';
      const pKey = personLabel.trim().toUpperCase();
      uniquePeople.add(pKey);
      const prevP = borrowerMap.get(pKey) || {
        name: personLabel.trim(),
        putra: 0,
        putri: 0,
        total: 0,
        latestDate: b.tanggal,
      };
      if (b.kampus === 'PUTRI') prevP.putri++;
      else prevP.putra++;
      prevP.total++;
      if (b.tanggal > prevP.latestDate) prevP.latestDate = b.tanggal;
      borrowerMap.set(pKey, prevP);

      const labKey = (b.lab || 'LAINNYA').trim().toUpperCase();
      const prevR = roomMap.get(labKey) || { lab: labKey, putra: 0, putri: 0, total: 0 };
      if (b.kampus === 'PUTRI') prevR.putri++;
      else prevR.putra++;
      prevR.total++;
      roomMap.set(labKey, prevR);
    }

    const total = filteredHistory.length;
    const putraPct = total > 0 ? Math.round((putra / total) * 100) : 0;
    const putriPct = total > 0 ? 100 - putraPct : 0;

    return {
      total,
      putra,
      putri,
      putraPct,
      putriPct,
      uniqueCount: uniquePeople.size,
      topBorrowers: Array.from(borrowerMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      roomStats: Array.from(roomMap.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    };
  }, [filteredHistory]);

  // Occupied slots helper for Single Booking form
  const formOccupiedMap = useMemo(() => {
    const map = new Map<string, { label: string; isFixed: boolean }>();
    const merged = getMergedSchedule(formTanggal, formKampus);
    for (const m of merged) {
      if (m.lab.toUpperCase() === formLab.toUpperCase()) {
        map.set(m.jamKe.toUpperCase(), {
          label: `${m.mapel} · ${m.guru}`,
          isFixed: m.keterangan === 'JADWAL TETAP / KBM',
        });
      }
    }
    return map;
  }, [getMergedSchedule, formTanggal, formKampus, formLab]);

  // Tab Gate: Admin/Guru tabs require login
  const ADMIN_TABS: LabkomTab[] = ['broadcast', 'massal', 'jadwal', 'history', 'master'];
  const requiresLogin = ADMIN_TABS.includes(tab) && !currentUser;

  const navItems: Array<{
    id: LabkomTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    activeCls: string;
    iconCls: string;
    adminOnly?: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'Status Visual',
      icon: LayoutGrid,
      activeCls: 'bg-blue-600 text-white shadow-sm',
      iconCls: 'text-blue-600',
    },
    {
      id: 'form',
      label: 'Booking',
      icon: CalendarPlus,
      activeCls: 'bg-emerald-600 text-white shadow-sm',
      iconCls: 'text-emerald-600',
    },
    {
      id: 'rekap',
      label: 'Rekap',
      icon: BarChart3,
      activeCls: 'bg-violet-600 text-white shadow-sm',
      iconCls: 'text-violet-600',
    },
    {
      id: 'ploting',
      label: 'Denah PC',
      icon: Monitor,
      activeCls: 'bg-cyan-600 text-white shadow-sm',
      iconCls: 'text-cyan-600',
    },
    {
      id: 'broadcast',
      label: 'Telegram',
      icon: Send,
      activeCls: 'bg-sky-600 text-white shadow-sm',
      iconCls: 'text-sky-600',
      adminOnly: true,
    },
    {
      id: 'massal',
      label: 'Massal',
      icon: CalendarRange,
      activeCls: 'bg-indigo-600 text-white shadow-sm',
      iconCls: 'text-indigo-600',
      adminOnly: true,
    },
    {
      id: 'jadwal',
      label: 'Jadwal Tetap',
      icon: Calendar,
      activeCls: 'bg-amber-600 text-white shadow-sm',
      iconCls: 'text-amber-600',
      adminOnly: true,
    },
    {
      id: 'history',
      label: 'Log & Visual',
      icon: History,
      activeCls: 'bg-rose-600 text-white shadow-sm',
      iconCls: 'text-rose-600',
      adminOnly: true,
    },
    {
      id: 'master',
      label: 'Master Data',
      icon: Database,
      activeCls: 'bg-teal-600 text-white shadow-sm',
      iconCls: 'text-teal-600',
      adminOnly: true,
    },
  ];

  const isLab = viewSub === 'lab';
  const matrixCols = getMaster(isLab ? 'LAB' : 'RUANGAN');
  const matrixRows = getMaster(isLab ? 'JAM' : 'WAKTU_RUANG');
  const bookingMap = useMemo(() => {
    const map = new Map<string, LabkomBooking>();
    const merged = getMergedSchedule(vDate, viewKampus);
    for (const b of merged) {
      map.set(`${b.lab.toUpperCase()}_${b.jamKe.toUpperCase()}`, b);
    }
    return map;
  }, [getMergedSchedule, vDate, viewKampus]);

  // Ploting student list for current viewKampus
  const plotingSiswaList = useMemo(() => {
    if (!state) return [];
    return viewKampus === 'PUTRI' ? state.siswaPutri : state.siswaPutra;
  }, [state, viewKampus]);

  const plotingClasses = useMemo(() => {
    const s = new Set<string>();
    for (const st of plotingSiswaList) {
      if (st.kelas && st.kelas !== '-') s.add(st.kelas);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [plotingSiswaList]);

  const themeAccent = viewKampus === 'PUTRA' ? 'bg-blue-600' : 'bg-fuchsia-600';

  // Weekly Dashboard Analytics (Current Week: Monday - Sunday) using Recharts
  const currentWeekDashboard = useMemo(() => {
    const todayStr = getTodayDateStr();
    const [y, m, d] = todayStr.split('-').map(Number);
    const base = new Date(y, (m || 1) - 1, d || 1);
    const day = base.getDay(); // 0=Sun..6=Sat
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const toIso = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate(),
      ).padStart(2, '0')}`;

    const weekStart = toIso(monday);
    const weekEnd = toIso(sunday);
    const rangeLabel = `${String(monday.getDate()).padStart(2, '0')} ${
      NAMA_BULAN_INDO[monday.getMonth()] || ''
    } – ${String(sunday.getDate()).padStart(2, '0')} ${
      NAMA_BULAN_INDO[sunday.getMonth()] || ''
    } ${sunday.getFullYear()}`;

    const weekBookings = (state?.bookings || []).filter(
      (b) => b.tanggal >= weekStart && b.tanggal <= weekEnd,
    );

    const byLabMap = new Map<
      string,
      { lab: string; Putra: number; Putri: number; Total: number }
    >();
    const canonicalLabs = (state?.masters || [])
      .filter((ms) => ms.kategori === 'LAB')
      .map((ms) => ms.nilai.trim().toUpperCase())
      .filter(Boolean);
    for (const lb of canonicalLabs) {
      if (!byLabMap.has(lb)) byLabMap.set(lb, { lab: lb, Putra: 0, Putri: 0, Total: 0 });
    }

    let putraTotal = 0;
    let putriTotal = 0;
    for (const b of weekBookings) {
      const labName = (b.lab || 'LAINNYA').trim().toUpperCase();
      const entry = byLabMap.get(labName) || { lab: labName, Putra: 0, Putri: 0, Total: 0 };
      if (b.kampus === 'PUTRI') {
        entry.Putri++;
        putriTotal++;
      } else {
        entry.Putra++;
        putraTotal++;
      }
      entry.Total++;
      byLabMap.set(labName, entry);
    }

    const byLabData = Array.from(byLabMap.values()).sort(
      (a, b) => b.Total - a.Total || a.lab.localeCompare(b.lab, 'id', { numeric: true }),
    );
    const byCampusData = [
      { name: 'Kampus Putra', value: putraTotal, color: '#2563eb' },
      { name: 'Kampus Putri', value: putriTotal, color: '#c026d3' },
    ];
    const topLab = byLabData[0] && byLabData[0].Total > 0 ? byLabData[0] : null;

    return {
      weekStart,
      weekEnd,
      rangeLabel,
      total: weekBookings.length,
      putraTotal,
      putriTotal,
      byLabData,
      byCampusData,
      topLab,
    };
  }, [state]);

  if (loading && !state) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
        <RefreshCw className="h-5 w-5 animate-spin text-teal-700 mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Memuat data Labkom &amp; Ruangan SMA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ====================================================== */}
      {/* 0. DASHBOARD MINGGU INI (RECHARTS: LAB & KAMPUS)       */}
      {/* ====================================================== */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                <BarChart3 className="h-4 w-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Dashboard Peminjaman Minggu Ini (Putra &amp; Putri)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-mono-num">
              Periode Senin–Minggu: {currentWeekDashboard.rangeLabel} ({currentWeekDashboard.weekStart} s.d.{' '}
              {currentWeekDashboard.weekEnd})
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-center sm:text-left">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Minggu Ini</div>
              <div className="text-sm sm:text-base font-bold text-slate-900 font-mono-num">
                {currentWeekDashboard.total.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-center sm:text-left">
              <div className="text-[10px] font-semibold text-blue-700 uppercase">Putra</div>
              <div className="text-sm sm:text-base font-bold text-blue-900 font-mono-num">
                {currentWeekDashboard.putraTotal.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/70 px-3 py-1.5 text-center sm:text-left">
              <div className="text-[10px] font-semibold text-fuchsia-700 uppercase">Putri</div>
              <div className="text-sm sm:text-base font-bold text-fuchsia-900 font-mono-num">
                {currentWeekDashboard.putriTotal.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Recharts BarChart: Total Bookings by Lab (Putra vs Putri) */}
          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-slate-50/40 p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Total Peminjaman per Labkom / Ruangan (Minggu Ini)
              </h4>
              {currentWeekDashboard.topLab && (
                <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded px-2 py-0.5 font-mono-num">
                  Teramai: {currentWeekDashboard.topLab.lab} ({currentWeekDashboard.topLab.Total})
                </span>
              )}
            </div>
            {currentWeekDashboard.byLabData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
                Belum ada data Lab untuk minggu ini.
              </div>
            ) : (
              <div className="h-[230px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={currentWeekDashboard.byLabData}
                    margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="lab"
                      tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      interval={0}
                      angle={currentWeekDashboard.byLabData.length > 6 ? -18 : 0}
                      textAnchor={currentWeekDashboard.byLabData.length > 6 ? 'end' : 'middle'}
                      height={currentWeekDashboard.byLabData.length > 6 ? 48 : 28}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: '12px',
                        borderRadius: '10px',
                        borderColor: '#cbd5e1',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                    <Bar dataKey="Putra" stackId="a" fill="#2563eb" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Putri" stackId="a" fill="#c026d3" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recharts PieChart + Breakdown: Total Bookings by Campus (Putra vs Putri) */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Perbandingan Kampus (Minggu Ini)
              </h4>
            </div>
            {currentWeekDashboard.total === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-slate-400 text-center px-4">
                Belum ada peminjaman tercatat pada minggu ini ({currentWeekDashboard.rangeLabel}).
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center">
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={currentWeekDashboard.byCampusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={44}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {currentWeekDashboard.byCampusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          fontSize: '12px',
                          borderRadius: '10px',
                          borderColor: '#cbd5e1',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {currentWeekDashboard.byCampusData.map((item) => {
                    const pct =
                      currentWeekDashboard.total > 0
                        ? Math.round((item.value / currentWeekDashboard.total) * 100)
                        : 0;
                    return (
                      <div
                        key={item.name}
                        className="rounded-lg bg-white border border-slate-200 px-2.5 py-2 flex items-center justify-between gap-1.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[11px] font-bold text-slate-700 truncate">
                            {item.name.replace('Kampus ', '')}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono-num font-bold text-slate-900 shrink-0">
                          {item.value} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-teal-800">
              <span>SIM Ruangan &amp; Labkom SMA</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span>Aktif: {todaySemester.labelLengkap}</span>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <span className="font-mono-num text-slate-600">
                {state?.bookings.length ?? 0} Record Peminjaman
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-slate-900">
              Peminjaman Labkom, Ruangan SMA &amp; Denah 40 PC
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchLabkomState}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sinkron Data</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!state) return;
                const fn = downloadLabkomExcelClient({
                  bookings: state.bookings,
                  fixedSchedules: state.fixedSchedules,
                  plotings: state.plotings,
                  masters: state.masters,
                });
                notify(`Excel ${fn} berhasil diunduh.`, 'success');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs (Fit HP 3x3, Tablet 5+4, Laptop 1 Baris Penuh) */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5 rounded-xl bg-slate-100 p-1.5 border border-slate-200/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            const locked = Boolean(item.adminOnly && !currentUser);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                title={item.label}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-0 ${
                  active
                    ? item.activeCls
                    : 'bg-white/75 text-slate-700 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : item.iconCls}`} />
                <span className="truncate">{item.label}</span>
                {locked && (
                  <Lock className={`h-3 w-3 shrink-0 ${active ? 'text-white/80' : 'text-slate-400'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Login Gate for Admin/Guru Management Tabs */}
      {requiresLogin ? (
        <div className="mx-auto max-w-lg bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Lock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">
              Login Guru atau Admin Diperlukan
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Menu Broadcast Telegram, Booking Massal, Jadwal Tetap KBM, Riwayat Hapus/Import, dan Master Data dapat diakses setelah login Guru atau Admin Super.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={onRequestLogin}
              className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
            >
              Login Sekarang
            </button>
            <button
              type="button"
              onClick={() => setTab('dashboard')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Kembali ke Status Visual
            </button>
          </div>
        </div>
      ) : null}

      {/* ====================================================== */}
      {/* 1. DASHBOARD STATUS VISUAL (MATRIX LABKOM & RUANGAN)   */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'dashboard' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-stretch sm:items-center bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200">
            <div className="grid grid-cols-2 sm:inline-flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewKampus('PUTRA')}
                className={`px-3 sm:px-5 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase transition-colors whitespace-nowrap ${
                  viewKampus === 'PUTRA'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white/80'
                }`}
              >
                Kampus Putra
              </button>
              <button
                type="button"
                onClick={() => setViewKampus('PUTRI')}
                className={`px-3 sm:px-5 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase transition-colors whitespace-nowrap ${
                  viewKampus === 'PUTRI'
                    ? 'bg-fuchsia-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white/80'
                }`}
              >
                Kampus Putri
              </button>
            </div>

            <div className="grid grid-cols-2 sm:inline-flex gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewSub('lab')}
                className={`px-3 sm:px-5 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase transition-colors whitespace-nowrap ${
                  isLab
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white/80'
                }`}
              >
                Jadwal Lab
              </button>
              <button
                type="button"
                onClick={() => setViewSub('ruang')}
                className={`px-3 sm:px-5 py-2 rounded-lg text-[11px] sm:text-xs font-bold uppercase transition-colors whitespace-nowrap ${
                  !isLab
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white/80'
                }`}
              >
                Jadwal Ruang
              </button>
            </div>
          </div>

          {/* Date & Semester Header */}
          <div
            className={`rounded-xl p-4 sm:p-5 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
              viewKampus === 'PUTRA'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
                : 'bg-gradient-to-r from-fuchsia-600 to-pink-600'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold text-white/85">
                {viewKampus} · {selectedDateSemester.labelLengkap}
              </div>
              <h3 className="text-lg sm:text-xl font-bold uppercase tracking-wide mt-0.5">
                Dasbor {isLab ? 'Labkom' : 'Ruangan'}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setVDate(shiftDateStr(vDate, -1))}
                className="h-10 w-10 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                aria-label="Hari sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="relative flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-lg px-4 h-10 min-w-[220px] flex-1 md:flex-initial cursor-pointer">
                <span className="text-xs font-bold uppercase tracking-wide">
                  {formatTanggalIndoLengkap(vDate)}
                </span>
                <input
                  type="date"
                  value={vDate}
                  onChange={(e) => {
                    if (e.target.value) setVDate(e.target.value);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Pilih tanggal jadwal"
                />
              </div>
              <button
                type="button"
                onClick={() => setVDate(shiftDateStr(vDate, 1))}
                className="h-10 w-10 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                aria-label="Hari berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setVDate(getTodayDateStr())}
                className="h-10 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
              >
                Hari Ini
              </button>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto p-3">
              <table className="w-full border-separate border-spacing-2 min-w-[880px]">
                <thead>
                  <tr>
                    <th className="py-3 px-3 w-28 bg-slate-50 rounded-lg text-slate-500 text-[11px] font-bold uppercase">
                      Waktu
                    </th>
                    {matrixCols.map((lb) => {
                      const cIdx = getColorIdx(lb.nilai);
                      return (
                        <th key={lb.id} className="py-3 px-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${ROOM_DOT_COLORS[cIdx]}`} />
                            <span className="text-xs font-bold uppercase text-slate-800">
                              {isLab && !lb.nilai.includes('LAB') && !lb.nilai.includes('BIOKIM')
                                ? `LAB ${lb.nilai}`
                                : lb.nilai}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((jm) => (
                    <tr key={jm.id}>
                      <td className="py-4 px-2 text-center font-bold text-slate-700 text-xs bg-slate-50 rounded-lg font-mono-num">
                        {jm.nilai}
                      </td>
                      {matrixCols.map((lb) => {
                        const booking = bookingMap.get(
                          `${lb.nilai.toUpperCase()}_${jm.nilai.toUpperCase()}`,
                        );
                        if (booking) {
                          const isFixed = booking.keterangan === 'JADWAL TETAP / KBM';
                          const cIdx = getColorIdx(lb.nilai);
                          return (
                            <td key={`${lb.id}_${jm.id}`} className="align-top">
                              <div
                                className={`${
                                  isFixed ? 'bg-slate-800' : ROOM_COLORS[cIdx]
                                } rounded-xl p-2.5 text-white h-full min-h-[104px] flex flex-col justify-between group relative`}
                              >
                                {!isFixed && isAdmin && (
                                  <div className="flex items-center justify-end gap-1 mb-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditBookingModal(booking)}
                                      title="Edit Peminjam"
                                      className="p-1 rounded bg-white/20 hover:bg-white/35 text-white transition-colors"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDeleteId((prev) =>
                                          prev === booking.id ? null : booking.id,
                                        )
                                      }
                                      title="Hapus Peminjam"
                                      className="p-1 rounded bg-rose-950/35 hover:bg-rose-600 text-white transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                                {confirmDeleteId === booking.id && isAdmin ? (
                                  <div className="bg-rose-950/85 rounded-lg p-2 text-center space-y-1.5">
                                    <div className="text-[10px] font-bold">Hapus slot ini?</div>
                                    <div className="flex justify-center gap-1">
                                      <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => handleDeleteBooking(booking.id)}
                                        className="px-2 py-0.5 rounded bg-rose-600 text-[10px] font-bold"
                                      >
                                        Ya
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(null)}
                                        className="px-2 py-0.5 rounded bg-white/20 text-[10px]"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex flex-col items-center text-center gap-1">
                                      <span className="font-bold text-xs uppercase leading-tight">
                                        {booking.mapel && booking.mapel !== '-'
                                          ? booking.mapel
                                          : booking.keterangan || 'TERPAKAI'}
                                      </span>
                                      <span className="text-[11px] font-medium text-white/90 truncate w-full">
                                        {booking.guru}
                                      </span>
                                    </div>
                                    <div className="text-center mt-2">
                                      <span className="inline-block text-[10px] font-bold bg-white/20 px-2.5 py-0.5 rounded">
                                        {isFixed ? 'KBM TETAP · ' : ''}
                                        {booking.kelas}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={`${lb.id}_${jm.id}`} className="align-top">
                            <button
                              type="button"
                              onClick={() => handleQuickBookCell(lb.nilai, jm.nilai)}
                              className="w-full h-full min-h-[104px] border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 font-semibold text-[11px] uppercase hover:bg-slate-50 hover:border-teal-300 hover:text-teal-700 transition-colors"
                            >
                              Tersedia
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visualisasi & Daftar Peminjam Hari Ini (Putra & Putri) */}
          {(() => {
            const isoVDate = parseFlexibleDateToIso(vDate) || vDate;
            const todayAll = (state?.bookings || []).filter((b) => b.tanggal === isoVDate);
            const todayPutra = todayAll.filter((b) => b.kampus === 'PUTRA').length;
            const todayPutri = todayAll.filter((b) => b.kampus === 'PUTRI').length;
            const globalPutra = (state?.bookings || []).filter((b) => b.kampus === 'PUTRA').length;
            const globalPutri = (state?.bookings || []).filter((b) => b.kampus === 'PUTRI').length;
            const visibleToday = todayAll.filter((b) =>
              dashBorrowerFilter === 'ALL' ? true : b.kampus === dashBorrowerFilter,
            );

            return (
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Users className="h-4 w-4 text-teal-600" />
                      <span>
                        Visualisasi Peminjam Tanggal {formatTanggalIndoLengkap(vDate)} (Putra &amp; Putri)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Total database: <span className="font-bold text-blue-700">Putra {globalPutra}</span> ·{' '}
                      <span className="font-bold text-fuchsia-700">Putri {globalPutri}</span>.{' '}
                      {isAdmin
                        ? 'Sebagai Admin, Anda dapat Edit atau Hapus peminjam langsung dari kartu di bawah.'
                        : 'Masuk sebagai Admin Super/SIM untuk mengedit atau menghapus data peminjam.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['ALL', 'PUTRA', 'PUTRI'] as const).map((k) => {
                      const cnt =
                        k === 'ALL' ? todayAll.length : k === 'PUTRA' ? todayPutra : todayPutri;
                      const active = dashBorrowerFilter === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setDashBorrowerFilter(k)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                            active
                              ? k === 'PUTRI'
                                ? 'bg-fuchsia-600 text-white'
                                : k === 'PUTRA'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {k === 'ALL' ? 'Semua' : k === 'PUTRA' ? 'Putra' : 'Putri'} ({cnt})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {visibleToday.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
                    Belum ada peminjaman langsung (non-jadwal-tetap) pada {formatTanggalIndoLengkap(vDate)} untuk filter ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visibleToday.map((b, idx) => (
                      <div
                        key={`${b.id}__${b.kampus}__${b.lab}__${b.tanggal}__${b.jamKe}__${idx}`}
                        className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50 hover:bg-white transition-colors flex flex-col justify-between gap-2.5"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                b.kampus === 'PUTRA'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-fuchsia-100 text-fuchsia-800'
                              }`}
                            >
                              {b.kampus}
                            </span>
                            <div className="flex items-center gap-1">
                              <span
                                className={`${
                                  ROOM_COLORS[getColorIdx(b.lab)]
                                } text-white text-[10px] font-bold px-2 py-0.5 rounded`}
                              >
                                {b.lab}
                              </span>
                              <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono-num">
                                JAM {b.jamKe}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {b.namaPeminjam || b.guru}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">
                              Guru: {b.guru} · Kelas: {b.kelas}
                            </div>
                            <div className="text-[11px] font-semibold text-teal-800 truncate">
                              {b.mapel}
                              {b.keterangan ? ` — ${b.keterangan}` : ''}
                            </div>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              {b.status || 'Disetujui'}
                            </span>
                            {confirmDeleteId === b.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-rose-700">Hapus?</span>
                                <button
                                  type="button"
                                  disabled={submitting}
                                  onClick={() => handleDeleteBooking(b.id)}
                                  className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold"
                                >
                                  Ya
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditBookingModal(b)}
                                  className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 text-[10px] font-bold hover:bg-amber-100"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(b.id)}
                                  className="inline-flex items-center gap-1 rounded bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 text-[10px] font-bold hover:bg-rose-100"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ====================================================== */}
      {/* 2. FORM BOOKING TUNGGAL                                */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'form' && (
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex gap-1.5 bg-white border border-slate-200 p-1.5 rounded-xl w-fit mx-auto">
            <button
              type="button"
              onClick={() => setViewSub('lab')}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                isLab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Form Labkom
            </button>
            <button
              type="button"
              onClick={() => setViewSub('ruang')}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                !isLab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Form Ruangan
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div
              className={`p-6 text-white ${
                formKampus === 'PUTRA'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
                  : 'bg-gradient-to-r from-fuchsia-600 to-pink-600'
              }`}
            >
              <div className="text-[11px] font-semibold text-white/85">
                {getAcademicSemester(formTanggal).labelLengkap}
              </div>
              <h3 className="text-xl font-bold uppercase mt-0.5">
                Booking {isLab ? 'Labkom' : 'Ruangan'} · {formKampus}
              </h3>
            </div>

            <form onSubmit={handleSubmitSingleBooking} className="p-6 space-y-5">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">
                  Kampus Area
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['PUTRA', 'PUTRI'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFormKampus(k)}
                      className={`p-3 rounded-lg border text-xs font-bold uppercase transition-colors ${
                        formKampus === k
                          ? k === 'PUTRA'
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-fuchsia-600 bg-fuchsia-50 text-fuchsia-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Kampus {k}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Email Aktif
                  </label>
                  <input
                    required
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="nama@assyifa.sch.id"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Nama Peminjam
                  </label>
                  <input
                    required
                    type="text"
                    value={formNama}
                    onChange={(e) => setFormNama(e.target.value)}
                    placeholder="Nama lengkap peminjam"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Guru Pengampu
                  </label>
                  <select
                    value={formGuru}
                    onChange={(e) => setFormGuru(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white outline-none focus:border-teal-600"
                  >
                    <option value="-">-</option>
                    {getMaster('GURU').map((g) => (
                      <option key={g.id} value={g.nilai}>
                        {g.nilai}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Kelas / Kegiatan
                  </label>
                  <select
                    value={formKelas}
                    onChange={(e) => setFormKelas(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white outline-none focus:border-teal-600"
                  >
                    <option value="-">Tanpa Kelas</option>
                    {getMaster('KELAS').map((k) => (
                      <option key={k.id} value={k.nilai}>
                        {k.nilai}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Lokasi {isLab ? 'Labkom' : 'Ruangan'}
                  </label>
                  <select
                    value={formLab}
                    onChange={(e) => setFormLab(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white outline-none focus:border-teal-600"
                  >
                    {matrixCols.map((l) => (
                      <option key={l.id} value={l.nilai}>
                        {l.nilai}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Mapel / Agenda
                  </label>
                  <select
                    value={formMapel}
                    onChange={(e) => setFormMapel(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white outline-none focus:border-teal-600"
                  >
                    <option value="-">Agenda Lain</option>
                    {getMaster('MAPEL').map((m) => (
                      <option key={m.id} value={m.nilai}>
                        {m.nilai}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                  Tanggal Booking
                </label>
                <input
                  required
                  type="date"
                  value={formTanggal}
                  onChange={(e) => setFormTanggal(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:border-teal-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="text-[11px] font-bold uppercase text-slate-700 block mb-2">
                  Pilih Slot Waktu (Bisa lebih dari 1)
                </label>
                <div className="flex flex-wrap gap-2">
                  {matrixRows.map((jm) => {
                    const occupied = formOccupiedMap.get(jm.nilai.toUpperCase());
                    const selected = selectedJams.includes(jm.nilai);
                    return (
                      <button
                        key={jm.id}
                        type="button"
                        disabled={Boolean(occupied)}
                        title={occupied ? occupied.label : 'Tersedia'}
                        onClick={() => toggleArrValue(selectedJams, jm.nilai, setSelectedJams)}
                        className={`px-3.5 py-2.5 rounded-lg text-xs font-bold border transition-colors min-w-[74px] flex-1 ${
                          occupied
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                            : selected
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-teal-500 hover:text-teal-700'
                        }`}
                      >
                        {isLab ? `JAM ${jm.nilai}` : jm.nilai}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                  Catatan Khusus (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={formKeterangan}
                  onChange={(e) => setFormKeterangan(e.target.value)}
                  placeholder="Keterangan tambahan kebutuhan perangkat atau agenda..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-medium outline-none focus:border-teal-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider transition-colors"
              >
                {submitting ? 'Memproses...' : 'Kirim Permintaan Booking'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* 3. REKAP & SEMESTER (GANJIL / GENAP + PDF)             */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'rekap' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col lg:flex-row gap-3 justify-between">
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
              {(['PUTRA', 'PUTRI'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setViewKampus(k)}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex-1 lg:flex-initial ${
                    viewKampus === k
                      ? k === 'PUTRA'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'bg-white text-fuchsia-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Data {k}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setViewSub('lab')}
                className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex-1 lg:flex-initial ${
                  isLab ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Rekap Lab
              </button>
              <button
                type="button"
                onClick={() => setViewSub('ruang')}
                className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex-1 lg:flex-initial ${
                  !isLab ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Rekap Ruangan
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value as SemesterFilter)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white text-slate-700 outline-none"
              >
                <option value="ALL">Semua Semester</option>
                <option value="GANJIL">Semester Ganjil (Jul–Des)</option>
                <option value="GENAP">Semester Genap (Jan–Jun)</option>
              </select>

              <select
                value={filterBulan}
                onChange={(e) => setFilterBulan(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white text-slate-700 outline-none"
              >
                <option value="ALL">Semua Bulan</option>
                {NAMA_BULAN_INDO.map((nama, idx) => {
                  const mm = String(idx + 1).padStart(2, '0');
                  return (
                    <option key={mm} value={mm}>
                      {mm} — {nama}
                    </option>
                  );
                })}
              </select>

              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 px-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeInformatika}
                  onChange={(e) => setExcludeInformatika(e.target.checked)}
                  className="accent-teal-600"
                />
                <span>Kecualikan Informatika</span>
              </label>
            </div>
          </div>

          {/* Summary Header */}
          <div className="bg-slate-900 rounded-xl p-6 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="text-xs font-semibold text-teal-300">
                {filterSemester === 'ALL'
                  ? 'Semua Semester'
                  : filterSemester === 'GANJIL'
                  ? 'Semester Ganjil (Jul–Des)'
                  : 'Semester Genap (Jan–Jun)'}{' '}
                · Bulan:{' '}
                {filterBulan === 'ALL'
                  ? 'Semua'
                  : NAMA_BULAN_INDO[parseInt(filterBulan, 10) - 1] || filterBulan}
              </div>
              <h3 className="text-xl font-bold uppercase mt-1">
                Analitik {isLab ? 'Labkom' : 'Ruangan'} {viewKampus}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-start md:justify-end">
              <div className="bg-white/10 px-4 py-2.5 rounded-lg text-center min-w-[96px]">
                <div className="text-2xl font-bold font-mono-num">{rekapData.guruAktif.length}</div>
                <div className="text-[10px] uppercase text-slate-300">Guru Aktif</div>
              </div>
              <div className="bg-white/10 px-4 py-2.5 rounded-lg text-center min-w-[96px]">
                <div className="text-2xl font-bold font-mono-num">{rekapData.totalPemakaian}</div>
                <div className="text-[10px] uppercase text-slate-300">
                  Total {isLab ? 'JP' : 'Sesi'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const semLabel =
                    filterSemester === 'ALL'
                      ? 'Semua Semester'
                      : filterSemester === 'GANJIL'
                      ? 'Semester Ganjil (Jul-Des)'
                      : 'Semester Genap (Jan-Jun)';
                  const blnLabel =
                    filterBulan === 'ALL'
                      ? 'Semua Bulan'
                      : NAMA_BULAN_INDO[parseInt(filterBulan, 10) - 1] || filterBulan;
                  const fn = downloadLabkomRekapPdf({
                    kampus: viewKampus,
                    isLab,
                    semesterLabel: semLabel,
                    bulanLabel: blnLabel,
                    excludeInformatika,
                    guruAktif: rekapData.guruAktif,
                    topItems: rekapData.topItems,
                    guruBelum: rekapData.guruBelum,
                  });
                  notify(`PDF ${fn} berhasil diunduh.`, 'success');
                }}
                className={`${themeAccent} hover:brightness-110 px-4 py-3 rounded-lg text-xs font-bold uppercase inline-flex items-center gap-1.5`}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Guru */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-[460px]">
              <h4 className="font-bold text-xs uppercase text-slate-800 mb-4">
                Top Guru ({isLab ? 'JP' : 'Sesi'})
              </h4>
              <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                {rekapData.guruAktif.length > 0 ? (
                  rekapData.guruAktif.map(([nama, count]) => {
                    const max = rekapData.guruAktif[0]?.[1] || 1;
                    return (
                      <div key={nama}>
                        <div className="flex justify-between text-xs font-semibold mb-1.5 gap-2">
                          <span className="truncate text-slate-800">{nama}</span>
                          <span
                            className={`font-mono-num shrink-0 ${
                              viewKampus === 'PUTRA' ? 'text-blue-700' : 'text-fuchsia-700'
                            }`}
                          >
                            {count} {isLab ? 'JP' : 'Sesi'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`${themeAccent} h-2 rounded-full`}
                            style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">Tidak ada data di periode ini.</p>
                )}
              </div>
            </div>

            {/* Top Mapel / Ruangan */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col h-[460px]">
              <h4 className="font-bold text-xs uppercase text-slate-800 mb-4">
                Top {isLab ? 'Mapel / Agenda' : 'Ruangan'}
              </h4>
              <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                {rekapData.topItems.length > 0 ? (
                  rekapData.topItems.map(([label, count]) => {
                    const max = rekapData.topItems[0]?.[1] || 1;
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs font-semibold mb-1.5 gap-2">
                          <span className="truncate text-slate-800">{label}</span>
                          <span className="font-mono-num shrink-0 text-emerald-700">
                            {count} {isLab ? 'JP' : 'Sesi'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">Tidak ada data di periode ini.</p>
                )}
              </div>
            </div>

            {/* Guru Belum Menggunakan */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[460px]">
              <div className="bg-rose-50 border-b border-rose-100 px-5 py-3.5 flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase text-rose-800">Belum Menggunakan</h4>
                <span className="text-xs font-bold font-mono-num text-rose-700">
                  {rekapData.guruBelum.length}
                </span>
              </div>
              <div className="overflow-y-auto flex-1 p-2 divide-y divide-slate-100">
                {rekapData.guruBelum.length > 0 ? (
                  rekapData.guruBelum.map((g) => (
                    <div key={g} className="p-2.5 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {g.charAt(0)}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 truncate">{g}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 p-4">Semua guru aktif menggunakan fasilitas.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* 4. DENAH PLOTING 40 PC / KURSI                         */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'ploting' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg shrink-0">
              {(['PUTRA', 'PUTRI'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setViewKampus(k)}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex-1 lg:flex-initial ${
                    viewKampus === k
                      ? k === 'PUTRA'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'bg-white text-fuchsia-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Kampus {k}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {[...getMaster('LAB'), ...getMaster('RUANGAN')].map((r, idx) => (
                <button
                  key={`${r.id}__${idx}`}
                  type="button"
                  onClick={() => setCurrentPlotingRuang(r.nilai)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase whitespace-nowrap transition-colors ${
                    currentPlotingRuang === r.nilai
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r.nilai}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`rounded-xl p-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
              viewKampus === 'PUTRA'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
                : 'bg-gradient-to-r from-fuchsia-600 to-pink-600'
            }`}
          >
            <div>
              <div className="text-[11px] font-semibold text-white/85">
                Ploting 40 PC / Kursi · Kampus {viewKampus}
              </div>
              <h3 className="text-xl font-bold uppercase mt-0.5">Denah {currentPlotingRuang}</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!state) return;
                const fn = downloadLabkomDenahPdf({
                  kampus: viewKampus,
                  lokasi: currentPlotingRuang,
                  plotings: state.plotings,
                });
                notify(`PDF ${fn} berhasil dicetak.`, 'success');
              }}
              className="bg-white text-slate-900 hover:bg-slate-100 px-4 py-2.5 rounded-lg text-xs font-bold uppercase inline-flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Cetak Denah PDF</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
            <div className="bg-slate-100 rounded-lg py-3 text-center mb-6 border border-slate-200">
              <span className="font-bold text-slate-500 uppercase tracking-[0.25em] text-xs">
                Papan Tulis / Meja Guru
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {Array.from({ length: 40 }, (_, i) => i + 1).map((pcNo) => {
                const entry = state?.plotings.find(
                  (p) =>
                    p.kampus === viewKampus &&
                    p.lokasi.toUpperCase() === currentPlotingRuang.toUpperCase() &&
                    p.noPc === pcNo,
                );
                if (entry) {
                  return (
                    <div key={pcNo} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          setPlotModalPc(pcNo);
                          setPlotSelectedKelas(entry.kelas || 'ALL');
                          setPlotSelectedSiswa(`${entry.namaSiswa}|${entry.kelas}`);
                          setPlotManualName(entry.namaSiswa);
                          setPlotManualKelas(entry.kelas);
                        }}
                        className={`w-full ${themeAccent} rounded-xl p-3 h-28 flex flex-col justify-between items-center text-center text-white hover:brightness-110 transition-all`}
                      >
                        <span className="bg-white/25 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] font-mono-num">
                          {pcNo}
                        </span>
                        <span className="text-xs font-bold uppercase leading-tight line-clamp-2 w-full">
                          {entry.namaSiswa}
                        </span>
                        <span className="text-[10px] font-semibold bg-black/25 px-2 py-0.5 rounded">
                          {entry.kelas}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePloting(entry.id)}
                        className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Kosongkan posisi"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    key={pcNo}
                    type="button"
                    onClick={() => {
                      setPlotModalPc(pcNo);
                      setPlotSelectedKelas('ALL');
                      setPlotSelectedSiswa('--KOSONGKAN--');
                      setPlotManualName('');
                      setPlotManualKelas('');
                    }}
                    className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-3 h-28 flex flex-col justify-center items-center text-center hover:bg-blue-50 hover:border-blue-300 transition-colors group"
                  >
                    <span className="text-slate-400 font-bold text-base font-mono-num group-hover:text-blue-600">
                      {pcNo}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase mt-1 group-hover:text-blue-600">
                      Kosong
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ploting Modal */}
          {plotModalPc !== null && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-base text-slate-900">
                      Ploting PC / Kursi #{plotModalPc}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {currentPlotingRuang} · Kampus {viewKampus}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlotModalPc(null)}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSavePloting} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                      1. Filter Kelas ({plotingSiswaList.length} Santri {viewKampus})
                    </label>
                    <select
                      value={plotSelectedKelas}
                      onChange={(e) => setPlotSelectedKelas(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-slate-50 outline-none"
                    >
                      <option value="ALL">-- Semua Kelas --</option>
                      {plotingClasses.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                      2. Pilih Nama Siswa
                    </label>
                    <select
                      value={plotSelectedSiswa}
                      onChange={(e) => setPlotSelectedSiswa(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white outline-none"
                    >
                      <option value="--KOSONGKAN--">-- Kosongkan Posisi Ini --</option>
                      <option value="--MANUAL--">-- Input Nama Manual --</option>
                      {plotingSiswaList
                        .filter((s) => plotSelectedKelas === 'ALL' || s.kelas === plotSelectedKelas)
                        .map((s, idx) => (
                          <option key={`${s.nama}_${idx}`} value={`${s.nama}|${s.kelas}`}>
                            {s.nama} ({s.kelas})
                          </option>
                        ))}
                    </select>
                  </div>

                  {plotSelectedSiswa === '--MANUAL--' && (
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        required
                        placeholder="Nama Siswa"
                        value={plotManualName}
                        onChange={(e) => setPlotManualName(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                      />
                      <input
                        type="text"
                        placeholder="Kelas (cth: 10 ABU)"
                        value={plotManualKelas}
                        onChange={(e) => setPlotManualKelas(e.target.value)}
                        className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPlotModalPc(null)}
                      className="flex-1 border border-slate-200 rounded-lg py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-2.5 text-xs font-bold uppercase"
                    >
                      Simpan Posisi
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* 5. BROADCAST TELEGRAM (GROUPING CONSECUTIVE HOURS)     */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'broadcast' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
              {(['PUTRA', 'PUTRI'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setViewKampus(k)}
                  className={`px-4 py-2 rounded-md text-xs font-bold uppercase flex-1 md:flex-initial ${
                    viewKampus === k
                      ? k === 'PUTRA'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'bg-white text-fuchsia-700 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Broadcast {k}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setViewSub('lab')}
                className={`px-4 py-2 rounded-md text-xs font-bold uppercase ${
                  isLab ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Labkom
              </button>
              <button
                type="button"
                onClick={() => setViewSub('ruang')}
                className={`px-4 py-2 rounded-md text-xs font-bold uppercase ${
                  !isLab ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                Ruangan
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5">
              <span className="text-[11px] font-bold uppercase text-slate-600">Tanggal:</span>
              <input
                type="date"
                value={vDate}
                onChange={(e) => {
                  if (e.target.value) setVDate(e.target.value);
                }}
                className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs font-semibold outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-12">
            <div className="md:col-span-4 bg-gradient-to-br from-cyan-600 to-blue-700 p-6 text-white flex flex-col justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold text-white/85">
                  Grouping Jam Otomatis &amp; Slot Kosong
                </div>
                <h3 className="text-xl font-bold uppercase mt-1">Broadcast Telegram</h3>
                <p className="text-xs text-white/85 mt-2 leading-relaxed">
                  Jam berurutan dengan agenda sama atau slot KOSONG otomatis digabung (misal: Jam 1 - 3).
                </p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(true)}
                  className="w-full bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-lg text-xs font-bold uppercase inline-flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTgConfigOpen((p) => !p)}
                  className="w-full bg-white/10 hover:bg-white/20 px-4 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>
                    {state?.telegramConfigured ? 'Bot Telegram Terkonfigurasi' : 'Atur Bot Telegram'}
                  </span>
                </button>
              </div>
            </div>

            <div className="md:col-span-8 p-6 space-y-4">
              {tgConfigOpen && (
                <form
                  onSubmit={handleSaveTelegramConfig}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3"
                >
                  <div className="text-xs font-bold text-slate-800">
                    Kredensial Bot Telegram (Disimpan aman di server)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="password"
                      placeholder="Bot Token (dari @BotFather)"
                      value={tgBotToken}
                      onChange={(e) => setTgBotToken(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
                    />
                    <input
                      type="text"
                      placeholder="Chat ID / Group ID (cth: -100123456)"
                      value={tgChatId}
                      onChange={(e) => setTgChatId(e.target.value)}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setTgConfigOpen(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Tutup
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                    >
                      Simpan Bot
                    </button>
                  </div>
                </form>
              )}

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                  Preview Teks (Dapat diedit manual sebelum dikirim)
                </label>
                <textarea
                  value={broadcastDraft}
                  onChange={(e) => setBroadcastDraft(e.target.value)}
                  className="w-full h-80 bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs outline-none focus:border-cyan-600"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCopyBroadcast}
                  className="flex-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-lg text-xs uppercase inline-flex items-center justify-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Teks</span>
                </button>
                <button
                  type="button"
                  onClick={handleSendTelegram}
                  disabled={submitting}
                  className="flex-1 bg-[#0088cc] hover:bg-[#0077b3] disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-lg text-xs uppercase inline-flex items-center justify-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Kirim ke Telegram</span>
                </button>
              </div>
            </div>
          </div>

          {templateModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm uppercase text-slate-900">
                    Edit Template Broadcast
                  </h4>
                  <button
                    type="button"
                    onClick={() => setTemplateModalOpen(false)}
                    className="p-1.5 rounded-lg bg-slate-100 text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Placeholder tersedia: <code>{'{{KAMPUS}}'}</code>, <code>{'{{TANGGAL}}'}</code>, dan{' '}
                  <code>{'{{DATA}}'}</code>
                </p>
                <textarea
                  rows={8}
                  value={templateEditorVal}
                  onChange={(e) => setTemplateEditorVal(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-3 font-mono text-xs outline-none focus:border-teal-600"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplateModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
                  >
                    Simpan Template
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================== */}
      {/* 6. BOOKING MASSAL (RENTANG TANGGAL + HARI + JAM)       */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'massal' && (
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex gap-1.5 bg-white border border-slate-200 p-1.5 rounded-xl w-fit mx-auto">
            <button
              type="button"
              onClick={() => setViewSub('lab')}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase ${
                isLab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Massal Labkom
            </button>
            <button
              type="button"
              onClick={() => setViewSub('ruang')}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase ${
                !isLab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Massal Ruangan
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-700 p-6 text-white">
              <h3 className="text-xl font-bold uppercase">Booking Massal Berulang</h3>
              <p className="text-xs text-white/85 mt-1">
                Otomatis memvalidasi bentrok dengan Jadwal Tetap &amp; Booking yang sudah ada sebelum menyimpan.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {(['PUTRA', 'PUTRI'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFormKampus(k)}
                    className={`p-3 rounded-lg border text-xs font-bold uppercase ${
                      formKampus === k
                        ? 'border-violet-600 bg-violet-50 text-violet-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Target: Kampus {k}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Guru
                  </label>
                  <select
                    value={formGuru}
                    onChange={(e) => setFormGuru(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white"
                  >
                    <option value="-">-</option>
                    {getMaster('GURU').map((g) => (
                      <option key={g.id} value={g.nilai}>
                        {g.nilai}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Kelas
                  </label>
                  <select
                    value={formKelas}
                    onChange={(e) => setFormKelas(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white"
                  >
                    <option value="-">Tanpa Kelas</option>
                    {getMaster('KELAS').map((k) => (
                      <option key={k.id} value={k.nilai}>
                        {k.nilai}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Lokasi
                  </label>
                  <select
                    value={formLab}
                    onChange={(e) => setFormLab(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white"
                  >
                    {matrixCols.map((l) => (
                      <option key={l.id} value={l.nilai}>
                        {l.nilai}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Mapel / Agenda
                  </label>
                  <select
                    value={formMapel}
                    onChange={(e) => setFormMapel(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white"
                  >
                    <option value="-">Agenda Lainnya</option>
                    {getMaster('MAPEL').map((m) => (
                      <option key={m.id} value={m.nilai}>
                        {m.nilai}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={bulkTglMulai}
                    onChange={(e) => setBulkTglMulai(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1.5">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={bulkTglSelesai}
                    onChange={(e) => setBulkTglSelesai(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">
                  2. Pilih Hari Aktif
                </label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((dNum) => {
                    const active = bulkDays.includes(dNum);
                    return (
                      <button
                        key={dNum}
                        type="button"
                        onClick={() => toggleArrValue(bulkDays, dNum, setBulkDays)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold border flex-1 min-w-[70px] ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-violet-500'
                        }`}
                      >
                        {HARI_MAP[dNum]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">
                  3. Pilih Jam / Waktu Aktif
                </label>
                <div className="flex flex-wrap gap-2">
                  {matrixRows.map((jm) => {
                    const active = bulkJams.includes(jm.nilai);
                    return (
                      <button
                        key={jm.id}
                        type="button"
                        onClick={() => toggleArrValue(bulkJams, jm.nilai, setBulkJams)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold border flex-1 min-w-[68px] ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-violet-500'
                        }`}
                      >
                        {jm.nilai}
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                rows={2}
                placeholder="Keterangan agenda..."
                value={formKeterangan}
                onChange={(e) => setFormKeterangan(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none"
              />

              {bulkConfirmOpen ? (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-violet-900">
                    Konfirmasi: Sistem akan memesan{' '}
                    <span className="font-mono-num font-bold">{bulkTargetDates.length} hari</span> ×{' '}
                    <span className="font-mono-num font-bold">{bulkJams.length} jam</span> ={' '}
                    <span className="font-mono-num font-bold">
                      {bulkTargetDates.length * bulkJams.length} slot
                    </span>
                    . Lanjutkan?
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBulkConfirmOpen(false)}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSubmitBulkBooking}
                      className="px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-xs font-bold uppercase"
                    >
                      {submitting ? 'Menyimpan...' : 'Ya, Proses Sekarang'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (bulkTargetDates.length === 0 || bulkJams.length === 0) {
                      notify('Lengkapi rentang tanggal, hari aktif, dan minimal 1 jam.', 'error');
                      return;
                    }
                    setBulkConfirmOpen(true);
                  }}
                  className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold py-3 rounded-lg text-xs uppercase tracking-wider"
                >
                  Proses Booking Massal ({bulkTargetDates.length} Hari Terpilih)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* 7. JADWAL TETAP / KBM                                  */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'jadwal' && (
        <div className="space-y-4">
          <div className="bg-amber-600 rounded-xl p-6 text-white">
            <h3 className="text-xl font-bold uppercase">Jadwal Tetap / KBM</h3>
            <p className="text-xs text-amber-100 mt-1">
              Slot waktu pada Jadwal Tetap otomatis memblokir peminjaman harian dan ditampilkan gelap di Dasbor Visual.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 h-fit">
              <h4 className="font-bold text-xs uppercase text-amber-700 mb-4">
                Tambah Jadwal Tetap
              </h4>
              <form onSubmit={handleSubmitFixedSchedule} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                      Kampus
                    </label>
                    <select
                      value={fixedKampus}
                      onChange={(e) => setFixedKampus(e.target.value as LabkomKampus)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                    >
                      <option value="PUTRA">PUTRA</option>
                      <option value="PUTRI">PUTRI</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                      Hari
                    </label>
                    <select
                      value={fixedHari}
                      onChange={(e) => setFixedHari(Number(e.target.value))}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <option key={d} value={d}>
                          {HARI_MAP[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                    Lokasi
                  </label>
                  <select
                    value={fixedLab}
                    onChange={(e) => setFixedLab(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                  >
                    {[...getMaster('LAB'), ...getMaster('RUANGAN')].map((l) => (
                      <option key={l.id} value={l.nilai}>
                        {l.nilai}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                      Guru
                    </label>
                    <select
                      value={fixedGuru}
                      onChange={(e) => setFixedGuru(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                    >
                      {getMaster('GURU').map((g) => (
                        <option key={g.id} value={g.nilai}>
                          {g.nilai}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                      Kelas
                    </label>
                    <select
                      value={fixedKelas}
                      onChange={(e) => setFixedKelas(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                    >
                      {getMaster('KELAS').map((k) => (
                        <option key={k.id} value={k.nilai}>
                          {k.nilai}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                    Mapel
                  </label>
                  <select
                    value={fixedMapel}
                    onChange={(e) => setFixedMapel(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white"
                  >
                    {getMaster('MAPEL').map((m) => (
                      <option key={m.id} value={m.nilai}>
                        {m.nilai}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-amber-700 block mb-1.5">
                    Pilih Jam (Multi-Select)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[...getMaster('JAM'), ...getMaster('WAKTU_RUANG')].map((jm) => {
                      const active = fixedJams.includes(jm.nilai);
                      return (
                        <button
                          key={jm.id}
                          type="button"
                          onClick={() => toggleArrValue(fixedJams, jm.nilai, setFixedJams)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-bold border ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {jm.nilai}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg text-xs uppercase"
                >
                  Simpan Jadwal Tetap
                </button>
              </form>
            </div>

            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 text-[11px] font-bold uppercase text-slate-500">
                        Area &amp; Hari
                      </th>
                      <th className="p-3.5 text-[11px] font-bold uppercase text-slate-500">
                        Lokasi / Waktu
                      </th>
                      <th className="p-3.5 text-[11px] font-bold uppercase text-slate-500">
                        Keterangan
                      </th>
                      <th className="p-3.5 text-[11px] font-bold uppercase text-slate-500 text-center">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(state?.fixedSchedules || []).length > 0 ? (
                      state!.fixedSchedules.map((r, idx) => (
                        <tr key={`${r.id}__${idx}`} className="hover:bg-slate-50">
                          <td className="p-3.5">
                            <div
                              className={`text-[10px] font-bold uppercase ${
                                r.kampus === 'PUTRA' ? 'text-blue-700' : 'text-fuchsia-700'
                              }`}
                            >
                              {r.kampus}
                            </div>
                            <div className="text-xs font-bold text-amber-700 uppercase">
                              {HARI_MAP[r.hari] || `Hari ${r.hari}`}
                            </div>
                          </td>
                          <td className="p-3.5 space-y-1">
                            <span
                              className={`inline-block ${
                                ROOM_COLORS[getColorIdx(r.lab)]
                              } text-white px-2.5 py-0.5 rounded text-[11px] font-bold`}
                            >
                              {r.lab}
                            </span>
                            <div className="text-xs font-bold text-slate-700 font-mono-num">
                              Jam {r.jamKe}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="text-xs font-bold text-slate-900 uppercase">
                              {r.mapel}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {r.guru} · {r.kelas}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteFixed(r.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 px-2.5 py-1.5 text-[11px] font-bold hover:bg-rose-100"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Hapus</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                          Belum ada Jadwal Tetap KBM tersimpan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* 8. LOG PEMINJAMAN PUTRA/PUTRI + VISUALISASI + ADMIN    */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'history' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-700 text-white rounded-xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold uppercase">
                Log Peminjaman &amp; Visualisasi Peminjam ({filteredHistory.length.toLocaleString('id-ID')} Data)
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">
                Kelola log peminjaman Labkom &amp; Ruangan Kampus Putra serta Putri lengkap dengan template upload, visualisasi grafik peminjam, dan fitur Edit / Hapus Admin.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!state) return;
                  const info = downloadLabkomLogTemplateClient({
                    bookings: state.bookings,
                    masters: state.masters,
                  });
                  notify(
                    `Template Log Putra (${info.putraCount}) & Putri (${info.putriCount}) berhasil diunduh: ${info.filename}`,
                    'success',
                  );
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white text-rose-700 hover:bg-rose-50 px-3.5 py-2 text-xs font-bold shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Template Log (Putra &amp; Putri)</span>
              </button>

              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3.5 py-2 text-xs font-semibold">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Log Excel / CSV</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportSpreadsheetFile}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                disabled={submitting}
                onClick={handleTidyAllData}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 px-3.5 py-2 text-xs font-bold shadow-xs disabled:opacity-50"
                title="Normalisasi huruf/tanggal, bersihkan duplikat, dan pisahkan Putra vs Putri secara rapi"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Rapikan Data Putra &amp; Putri</span>
              </button>

              {isAdmin &&
                historySelectedIds.size > 0 &&
                (confirmBulkDelete ? (
                  <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-400/50 rounded-lg px-2.5 py-1">
                    <span className="text-xs font-semibold">
                      Hapus {historySelectedIds.size} item?
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteBulkHistory}
                      className="bg-rose-600 px-2.5 py-1 rounded text-xs font-bold"
                    >
                      Ya
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBulkDelete(false)}
                      className="bg-white/20 px-2.5 py-1 rounded text-xs"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmBulkDelete(true)}
                    className="bg-rose-900/80 hover:bg-rose-950 text-white px-3.5 py-2 rounded-lg text-xs font-bold uppercase inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Hapus Terpilih ({historySelectedIds.size})</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Preview Upload Template Log Putra & Putri */}
          {logImportPreview && (() => {
            const pPutra = logImportPreview.rows.filter((r) =>
              logImportPreview.defaultKampus === 'PUTRI'
                ? false
                : logImportPreview.defaultKampus === 'PUTRA'
                ? true
                : r.kampus !== 'PUTRI',
            ).length;
            const pPutri = logImportPreview.rows.length - pPutra;

            return (
              <div ref={logPreviewRef} className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-amber-900 uppercase">
                      Pratinjau Upload Log: {logImportPreview.fileName}
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Terbaca <span className="font-bold">{logImportPreview.rows.length}</span> baris valid (
                      <span className="font-bold text-blue-800">Putra: {pPutra}</span> ·{' '}
                      <span className="font-bold text-fuchsia-800">Putri: {pPutri}</span>).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={logImportPreview.defaultKampus}
                      onChange={(e) =>
                        setLogImportPreview((prev) =>
                          prev
                            ? { ...prev, defaultKampus: e.target.value as 'AUTO' | 'PUTRA' | 'PUTRI' }
                            : null,
                        )
                      }
                      className="border border-amber-300 bg-white rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="AUTO">Kampus: Otomatis per Sheet/Baris</option>
                      <option value="PUTRA">Paksa Semua ke Kampus PUTRA</option>
                      <option value="PUTRI">Paksa Semua ke Kampus PUTRI</option>
                    </select>

                    <select
                      value={logImportPreview.mode}
                      onChange={(e) =>
                        setLogImportPreview((prev) =>
                          prev
                            ? {
                                ...prev,
                                mode: e.target.value as 'append' | 'upsert' | 'replace',
                              }
                            : null,
                        )
                      }
                      className="border border-amber-300 bg-white rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="upsert">Update &amp; Tambah Baru (Upsert)</option>
                      <option value="append">Tambah Baru Saja (Skip Duplikat)</option>
                      <option value="replace">Ganti Data Kampus Terkait</option>
                    </select>

                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-950 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logImportPreview.autoSyncMasters}
                        onChange={(e) =>
                          setLogImportPreview((prev) =>
                            prev ? { ...prev, autoSyncMasters: e.target.checked } : null,
                          )
                        }
                        className="accent-teal-600"
                      />
                      <span>Sinkron ke Master Data</span>
                    </label>
                  </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-lg border border-amber-200">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-amber-100/70 text-amber-950 font-bold">
                      <tr>
                        <th className="p-2">Kampus</th>
                        <th className="p-2">Nama Peminjam / Guru</th>
                        <th className="p-2">Kelas &amp; Mapel</th>
                        <th className="p-2">Lokasi &amp; Jam</th>
                        <th className="p-2">Tanggal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logImportPreview.rows.slice(0, 6).map((r, idx) => {
                        const effectiveK =
                          logImportPreview.defaultKampus !== 'AUTO'
                            ? logImportPreview.defaultKampus
                            : r.kampus || 'PUTRA';
                        return (
                          <tr key={idx}>
                            <td className="p-2">
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                  effectiveK === 'PUTRA'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-fuchsia-100 text-fuchsia-800'
                                }`}
                              >
                                {effectiveK}
                              </span>
                            </td>
                            <td className="p-2 font-semibold text-slate-800">
                              {r.namaPeminjam || '-'} ({r.guru || '-'})
                            </td>
                            <td className="p-2 text-slate-600">
                              {r.kelas || '-'} · {r.mapel || '-'}
                            </td>
                            <td className="p-2 font-semibold text-slate-800">
                              {r.lab} · Jam {r.jamKe}
                            </td>
                            <td className="p-2 font-mono-num text-slate-700">{r.tanggal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setLogImportPreview(null)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCommitLogImport}
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-xs font-bold text-white"
                  >
                    {submitting ? 'Memproses...' : `Terapkan Import (${logImportPreview.rows.length} Baris)`}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Search & Filters + Quick Campus Tabs */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80">
                {(
                  [
                    { id: 'ALL', label: 'Semua Log', count: historyKampusCounts.all },
                    { id: 'PUTRA', label: 'Kampus Putra', count: historyKampusCounts.putra },
                    { id: 'PUTRI', label: 'Kampus Putri', count: historyKampusCounts.putri },
                  ] as const
                ).map((item) => {
                  const active = historyKampusFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setHistoryKampusFilter(item.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                        active
                          ? item.id === 'PUTRI'
                            ? 'bg-fuchsia-600 text-white shadow-xs'
                            : item.id === 'PUTRA'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      {item.label}{' '}
                      <span className="font-mono-num opacity-85">
                        ({item.count.toLocaleString('id-ID')})
                      </span>
                    </button>
                  );
                })}
              </div>

              {(historySearch ||
                historyKampusFilter !== 'ALL' ||
                historySemesterFilter !== 'ALL' ||
                historyLabFilter !== 'ALL' ||
                historyStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryKampusFilter('ALL');
                    setHistorySemesterFilter('ALL');
                    setHistoryLabFilter('ALL');
                    setHistoryStatusFilter('ALL');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
              <div className="relative lg:col-span-5">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Cari ID, peminjam, email, guru, kelas, mapel, lokasi, jam, tanggal..."
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-xs font-medium outline-none focus:border-teal-600"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                    title="Reset pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select
                value={historyLabFilter}
                onChange={(e) => setHistoryLabFilter(e.target.value)}
                className="lg:col-span-3 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
              >
                <option value="ALL">Semua Lab / Ruangan</option>
                {historyLabOptions.map((lab) => (
                  <option key={lab} value={lab}>
                    {lab}
                  </option>
                ))}
              </select>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="lg:col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
              >
                <option value="ALL">Semua Status</option>
                {historyStatusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <select
                value={historySemesterFilter}
                onChange={(e) => setHistorySemesterFilter(e.target.value as SemesterFilter)}
                className="lg:col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
              >
                <option value="ALL">Semua Semester</option>
                <option value="GANJIL">Semester Ganjil (Jul–Des)</option>
                <option value="GENAP">Semester Genap (Jan–Jun)</option>
              </select>
            </div>
          </div>

          {/* Visualisasi Data Peminjam (Putra vs Putri, Top Peminjam, Penggunaan Ruangan) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-rose-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Visualisasi Data Peminjam (Putra &amp; Putri)
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">
                Klik batang grafik peminjam/ruang untuk memfilter tabel di bawah
              </span>
            </div>

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Total Log Terfilter</div>
                <div className="text-xl font-bold text-slate-900 font-mono-num mt-0.5">
                  {historyVisualStats.total.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                <div className="text-[11px] font-semibold text-blue-700">Kampus Putra</div>
                <div className="text-xl font-bold text-blue-900 font-mono-num mt-0.5">
                  {historyVisualStats.putra.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-semibold text-blue-600">
                    ({historyVisualStats.putraPct}%)
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/70 p-3">
                <div className="text-[11px] font-semibold text-fuchsia-700">Kampus Putri</div>
                <div className="text-xl font-bold text-fuchsia-900 font-mono-num mt-0.5">
                  {historyVisualStats.putri.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-semibold text-fuchsia-600">
                    ({historyVisualStats.putriPct}%)
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3">
                <div className="text-[11px] font-semibold text-teal-700">Peminjam Unik</div>
                <div className="text-xl font-bold text-teal-900 font-mono-num mt-0.5">
                  {historyVisualStats.uniqueCount.toLocaleString('id-ID')}
                </div>
              </div>
            </div>

            {/* Proporsi Bar Putra vs Putri */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-blue-700">Putra ({historyVisualStats.putraPct}%)</span>
                <span className="text-fuchsia-700">Putri ({historyVisualStats.putriPct}%)</span>
              </div>
              <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                <div
                  className="bg-blue-600 transition-all"
                  style={{ width: `${historyVisualStats.putraPct}%` }}
                />
                <div
                  className="bg-fuchsia-600 transition-all"
                  style={{ width: `${historyVisualStats.putriPct}%` }}
                />
              </div>
            </div>

            {/* 2 Interactive Bar Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
              {/* Chart 1: Top Peminjam */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  Peminjam / Guru Paling Aktif
                </div>
                {historyVisualStats.topBorrowers.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">Belum ada data</div>
                ) : (
                  <div className="space-y-2">
                    {historyVisualStats.topBorrowers.map((item) => {
                      const maxTotal = historyVisualStats.topBorrowers[0]?.total || 1;
                      const wPutra = (item.putra / maxTotal) * 100;
                      const wPutri = (item.putri / maxTotal) * 100;
                      const isSelected = historySearch.toLowerCase() === item.name.toLowerCase();
                      return (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() =>
                            setHistorySearch(isSelected ? '' : item.name)
                          }
                          className={`w-full text-left rounded-lg p-1.5 transition-colors ${
                            isSelected ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-800 truncate pr-2">
                              {item.name}
                            </span>
                            <span className="font-mono-num text-slate-600 shrink-0">
                              <span className="text-blue-700 font-bold">{item.putra}P</span>
                              {' / '}
                              <span className="text-fuchsia-700 font-bold">{item.putri}Pi</span>
                              {' · '}
                              <span className="font-bold text-slate-900">{item.total}</span>
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                            <div className="bg-blue-600" style={{ width: `${wPutra}%` }} />
                            <div className="bg-fuchsia-600" style={{ width: `${wPutri}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chart 2: Distribusi Lab & Ruangan */}
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  Penggunaan Labkom &amp; Ruangan (Putra + Putri)
                </div>
                {historyVisualStats.roomStats.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">Belum ada data</div>
                ) : (
                  <div className="space-y-2">
                    {historyVisualStats.roomStats.map((item) => {
                      const maxTotal = historyVisualStats.roomStats[0]?.total || 1;
                      const wPutra = (item.putra / maxTotal) * 100;
                      const wPutri = (item.putri / maxTotal) * 100;
                      const isSelected = historySearch.toLowerCase() === item.lab.toLowerCase();
                      return (
                        <button
                          key={item.lab}
                          type="button"
                          onClick={() => setHistorySearch(isSelected ? '' : item.lab)}
                          className={`w-full text-left rounded-lg p-1.5 transition-colors ${
                            isSelected ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-800 truncate pr-2">
                              {item.lab}
                            </span>
                            <span className="font-mono-num text-slate-600 shrink-0">
                              <span className="text-blue-700 font-bold">{item.putra}P</span>
                              {' / '}
                              <span className="text-fuchsia-700 font-bold">{item.putri}Pi</span>
                              {' · '}
                              <span className="font-bold text-slate-900">{item.total}</span>
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                            <div className="bg-blue-600" style={{ width: `${wPutra}%` }} />
                            <div className="bg-fuchsia-600" style={{ width: `${wPutri}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Data Grid (All Booking Logs Putra & Putri + Admin Edit & Delete) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  Data Grid Log Peminjaman (Putra &amp; Putri)
                </h4>
                <span className="text-[11px] font-semibold text-slate-600 font-mono-num">
                  Menampilkan {historyPageMeta.startNum.toLocaleString('id-ID')}–
                  {historyPageMeta.endNum.toLocaleString('id-ID')} dari{' '}
                  {filteredHistory.length.toLocaleString('id-ID')} log
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 text-[10px] font-bold font-mono-num">
                  Putra: {historyVisualStats.putra.toLocaleString('id-ID')}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200 px-2 py-0.5 text-[10px] font-bold font-mono-num">
                  Putri: {historyVisualStats.putri.toLocaleString('id-ID')}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  <span>Baris/hal:</span>
                  <select
                    value={String(historyPageSize)}
                    onChange={(e) =>
                      setHistoryPageSize(
                        e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                      )
                    }
                    className="border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold bg-white text-slate-800"
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="250">250</option>
                    <option value="ALL">Semua</option>
                  </select>
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setTab('form')}
                    className="inline-flex items-center gap-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 text-[11px] font-bold"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Tambah Booking</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1220px] border-collapse">
                <thead className="bg-slate-100/90 border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={
                            historyPageMeta.rows.length > 0 &&
                            historyPageMeta.rows.every((b) => historySelectedIds.has(b.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setHistorySelectedIds((prev) => {
                                const next = new Set(prev);
                                historyPageMeta.rows.forEach((v) => next.add(v.id));
                                return next;
                              });
                            } else {
                              setHistorySelectedIds((prev) => {
                                const next = new Set(prev);
                                historyPageMeta.rows.forEach((v) => next.delete(v.id));
                                return next;
                              });
                            }
                          }}
                          title="Pilih semua baris di halaman ini"
                          className="accent-teal-600"
                        />
                      )}
                    </th>
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase w-12 text-center">
                      No
                    </th>
                    <th className="p-3 text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">
                      ID &amp; Timestamp
                    </th>
                    {(
                      [
                        { key: 'kampus', label: 'Kampus' },
                        { key: 'namaPeminjam', label: 'Peminjam & Email' },
                        { key: 'guru', label: 'Guru' },
                        { key: 'kelas', label: 'Kelas' },
                        { key: 'mapel', label: 'Mapel / Kegiatan' },
                        { key: 'lab', label: 'Lokasi' },
                        { key: 'tanggal', label: 'Tanggal & Semester' },
                        { key: 'jamKe', label: 'Jam / Sesi' },
                      ] as const
                    ).map((col) => {
                      const activeSort = historySortKey === col.key;
                      return (
                        <th
                          key={col.key}
                          className="p-3 text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap"
                        >
                          <button
                            type="button"
                            onClick={() => toggleHistorySort(col.key)}
                            className={`inline-flex items-center gap-1 hover:text-teal-700 transition-colors ${
                              activeSort ? 'text-teal-700' : ''
                            }`}
                          >
                            <span>{col.label}</span>
                            {activeSort ? (
                              historySortDir === 'asc' ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        </th>
                      );
                    })}
                    <th className="p-3 text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">
                      Keterangan
                    </th>
                    <th className="p-3 text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleHistorySort('status')}
                        className={`inline-flex items-center gap-1 hover:text-teal-700 transition-colors ${
                          historySortKey === 'status' ? 'text-teal-700' : ''
                        }`}
                      >
                        <span>Status</span>
                        {historySortKey === 'status' ? (
                          historySortDir === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </th>
                    <th className="p-3 text-[11px] font-bold text-slate-600 uppercase text-center sticky right-0 bg-slate-100/95 border-l border-slate-200 whitespace-nowrap">
                      Aksi Admin
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyPageMeta.rows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-8 text-center text-xs text-slate-500">
                        Tidak ada log peminjaman yang sesuai dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    historyPageMeta.rows.map((r, idx) => {
                      const sem = getAcademicSemester(r.tanggal);
                      const rowNum = historyPageMeta.startNum + idx;
                      const statusLabel = r.status || 'Disetujui';
                      const statusCls =
                        statusLabel === 'Dibatalkan'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : statusLabel === 'Menunggu'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : statusLabel === 'Selesai'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      return (
                        <tr
                          key={`${r.id}__${r.kampus}__${r.lab}__${r.tanggal}__${r.jamKe}__${idx}`}
                          className="hover:bg-slate-50/90 transition-colors group"
                        >
                          <td className="p-3 text-center">
                            {isAdmin && (
                              <input
                                type="checkbox"
                                checked={historySelectedIds.has(r.id)}
                                onChange={() => {
                                  setHistorySelectedIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(r.id)) next.delete(r.id);
                                    else next.add(r.id);
                                    return next;
                                  });
                                }}
                                className="accent-teal-600"
                              />
                            )}
                          </td>
                          <td className="p-3 text-center text-[11px] font-mono-num text-slate-400">
                            {rowNum}
                          </td>
                          <td className="p-3 max-w-[170px]">
                            <div
                              className="text-[11px] font-mono-num font-semibold text-slate-700 truncate"
                              title={r.id}
                            >
                              {r.id}
                            </div>
                            <div className="text-[10px] font-mono-num text-slate-400 truncate">
                              {r.timestamp || '-'}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                r.kampus === 'PUTRA'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-fuchsia-100 text-fuchsia-800'
                              }`}
                            >
                              {r.kampus}
                            </span>
                          </td>
                          <td className="p-3 max-w-[200px]">
                            <div className="text-xs font-bold text-slate-900 truncate" title={r.namaPeminjam}>
                              {r.namaPeminjam || '-'}
                            </div>
                            {r.email && (
                              <div className="text-[10px] text-slate-400 truncate" title={r.email}>
                                {r.email}
                              </div>
                            )}
                          </td>
                          <td className="p-3 max-w-[160px]">
                            <div className="text-xs font-medium text-slate-800 truncate" title={r.guru}>
                              {r.guru || '-'}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {r.kelas || '-'}
                            </span>
                          </td>
                          <td className="p-3 max-w-[160px]">
                            <div className="text-xs font-semibold text-slate-700 truncate" title={r.mapel}>
                              {r.mapel || '-'}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`${
                                ROOM_COLORS[getColorIdx(r.lab)]
                              } text-white text-[10px] font-bold px-2 py-0.5 rounded inline-block`}
                            >
                              {r.lab}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <div className="text-xs font-mono-num font-bold text-slate-800">
                              {r.tanggal}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500">
                              {sem.semester} · {sem.tahunAjaran}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono-num">
                              JAM {r.jamKe}
                            </span>
                          </td>
                          <td className="p-3 max-w-[210px]">
                            <div
                              className="text-[11px] text-slate-600 truncate"
                              title={r.keterangan || '-'}
                            >
                              {r.keterangan || '—'}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`inline-block text-[10px] font-bold border px-2 py-0.5 rounded ${statusCls}`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="p-3 text-center sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-200 whitespace-nowrap">
                            {isAdmin ? (
                              confirmDeleteId === r.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => handleDeleteBooking(r.id)}
                                    className="rounded bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-[10px] font-bold"
                                  >
                                    Ya Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 text-[10px] font-semibold"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditBookingModal(r)}
                                    title="Edit data peminjaman ini"
                                    className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 text-[11px] font-bold hover:bg-amber-100"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(r.id)}
                                    title="Hapus data peminjaman ini"
                                    className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-100"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              )
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400">
                                Admin Only
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {historyPageSize !== 'ALL' && filteredHistory.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs text-slate-600 font-mono-num">
                  Halaman <span className="font-bold text-slate-900">{historyPageMeta.page}</span>{' '}
                  dari <span className="font-bold text-slate-900">{historyPageMeta.totalPages}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={historyPageMeta.page <= 1}
                    onClick={() => setHistoryPage(1)}
                    className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Awal
                  </button>
                  <button
                    type="button"
                    disabled={historyPageMeta.page <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <button
                    type="button"
                    disabled={historyPageMeta.page >= historyPageMeta.totalPages}
                    onClick={() =>
                      setHistoryPage((p) => Math.min(historyPageMeta.totalPages, p + 1))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={historyPageMeta.page >= historyPageMeta.totalPages}
                    onClick={() => setHistoryPage(historyPageMeta.totalPages)}
                    className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Akhir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* 9. MASTER DATA TERPISAH                                */}
      {/* ====================================================== */}
      {!requiresLogin && tab === 'master' && (() => {
        const WAKTU_SET = new Set(['PAGI', 'SIANG', 'SORE', 'MALAM']);
        const classifyLoc = (loc: string): 'LAB' | 'RUANGAN' =>
          loc.toUpperCase().includes('LAB') || loc.toUpperCase().includes('BIOKIM')
            ? 'LAB'
            : 'RUANGAN';
        const classifyJam = (jam: string): 'JAM' | 'WAKTU_RUANG' =>
          WAKTU_SET.has(jam.trim().toUpperCase()) ? 'WAKTU_RUANG' : 'JAM';

        const usageMap = new Map<string, number>();
        const bookingValuesByKey = new Set<string>();
        const incUsage = (kat: LabkomMasterKategori, raw: string) => {
          const clean = String(raw || '').trim();
          if (!clean || clean === '-' || clean.toUpperCase() === 'TANPA KELAS') return;
          const k = `${kat}|${clean.toUpperCase()}`;
          usageMap.set(k, (usageMap.get(k) || 0) + 1);
          bookingValuesByKey.add(k);
        };

        for (const b of state?.bookings || []) {
          if (b.guru) incUsage('GURU', b.guru);
          if (b.kelas) incUsage('KELAS', b.kelas);
          if (b.mapel) incUsage('MAPEL', b.mapel);
          if (b.lab) incUsage(classifyLoc(b.lab), b.lab);
          if (b.jamKe) incUsage(classifyJam(b.jamKe), b.jamKe);
        }
        for (const f of state?.fixedSchedules || []) {
          if (f.guru) incUsage('GURU', f.guru);
          if (f.kelas) incUsage('KELAS', f.kelas);
          if (f.mapel) incUsage('MAPEL', f.mapel);
          if (f.lab) incUsage(classifyLoc(f.lab), f.lab);
          if (f.jamKe) incUsage(classifyJam(f.jamKe), f.jamKe);
        }

        const existingMasterKeys = new Set(
          (state?.masters || []).map((m) => `${m.kategori}|${m.nilai.trim().toUpperCase()}`),
        );
        let unregisteredFromBookingsCount = 0;
        for (const bk of bookingValuesByKey) {
          if (!existingMasterKeys.has(bk)) unregisteredFromBookingsCount++;
        }

        const renamePreviewItems = masterImportPreview
          ? masterImportPreview.items.filter((i) => i.renameFrom)
          : [];
        const newPreviewItems = masterImportPreview
          ? masterImportPreview.items.filter(
              (i) => !i.renameFrom && !existingMasterKeys.has(`${i.kategori}|${i.nilai.toUpperCase()}`),
            )
          : [];

        const qMaster = masterSearch.trim().toLowerCase();

        return (
          <div className="space-y-4">
            {/* Master Header Bar */}
            <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-700 text-white rounded-xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight">
                  Master Data Peminjaman &amp; Penyesuaian Template
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-50 mt-1">
                  <span className="font-mono-num">
                    {(state?.masters || []).length.toLocaleString('id-ID')} item master
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    {(state?.bookings || []).length.toLocaleString('id-ID')} peminjaman aktif
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={unregisteredFromBookingsCount > 0 ? 'text-amber-200 font-semibold' : 'text-white font-semibold'}>
                    {unregisteredFromBookingsCount > 0
                      ? `${unregisteredFromBookingsCount} nilai dari peminjaman belum masuk master`
                      : 'Semua data peminjaman tersinkron'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSyncMastersFromBookings}
                  className="bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-xs"
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>Tarik dari Peminjaman</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMasterTemplate}
                  className="bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh Template (.xlsx)</span>
                </button>

                <label className="cursor-pointer bg-white text-slate-900 hover:bg-slate-100 px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Template</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleParseMasterTemplateFile}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={fetchLabkomState}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            {/* Template Upload Preview & Adjustment Confirmation */}
            {masterImportPreview && (
              <div className="bg-white rounded-xl border border-teal-300 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-xs font-semibold text-teal-700">
                      Pratinjau Template Master Data
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {masterImportPreview.fileName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 font-mono-num">
                      <span>{masterImportPreview.items.length} baris terbaca</span>
                      <span aria-hidden="true">·</span>
                      <span>{newPreviewItems.length} item baru</span>
                      <span aria-hidden="true">·</span>
                      <span className={renamePreviewItems.length > 0 ? 'text-amber-700 font-semibold' : ''}>
                        {renamePreviewItems.length} penyesuaian nama
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMasterImportPreview(null)}
                    className="self-start sm:self-center p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                    title="Tutup Pratinjau"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {renamePreviewItems.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                    <div className="text-xs font-bold text-amber-900">
                      Penyesuaian Nama Terdeteksi ({renamePreviewItems.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-amber-900">
                      {renamePreviewItems.slice(0, 8).map((r, idx) => (
                        <div key={idx} className="truncate font-mono-num">
                          <span className="font-semibold text-amber-700">{r.kategori}:</span>{' '}
                          <span className="line-through opacity-75">{r.renameFrom}</span>{' '}
                          <span>→</span>{' '}
                          <span className="font-bold">{r.nilai}</span>
                        </div>
                      ))}
                    </div>
                    {renamePreviewItems.length > 8 && (
                      <div className="text-[11px] text-amber-800">
                        +{renamePreviewItems.length - 8} penyesuaian nama lainnya...
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() =>
                          setMasterImportPreview((prev) =>
                            prev ? { ...prev, mode: 'merge' } : null,
                          )
                        }
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                          masterImportPreview.mode === 'merge'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Gabung &amp; Sesuaikan
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMasterImportPreview((prev) =>
                            prev ? { ...prev, mode: 'replace' } : null,
                          )
                        }
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                          masterImportPreview.mode === 'replace'
                            ? 'bg-white text-rose-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Timpa Kategori di File
                      </button>
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={masterImportPreview.cascade}
                        onChange={(e) =>
                          setMasterImportPreview((prev) =>
                            prev ? { ...prev, cascade: e.target.checked } : null,
                          )
                        }
                        className="accent-teal-600"
                      />
                      <span>Ikut sesuaikan data peminjaman &amp; jadwal tetap yang sudah ada</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMasterImportPreview(null)}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleApplyMasterImport}
                      className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap"
                    >
                      {submitting ? 'Memproses...' : 'Terapkan Template'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Quick Add & Bulk Paste */}
              <div className="md:col-span-4 space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h4 className="font-bold text-xs uppercase text-slate-800 mb-3">
                    Tambah Cepat Master
                  </h4>
                  <form onSubmit={handleSaveMaster} className="space-y-3.5">
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                        Kategori
                      </label>
                      <select
                        value={masterKategori}
                        onChange={(e) => setMasterKategori(e.target.value as LabkomMasterKategori)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold bg-white"
                      >
                        {(
                          ['GURU', 'KELAS', 'MAPEL', 'LAB', 'RUANGAN', 'JAM', 'WAKTU_RUANG'] as const
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                        Nilai (Nama)
                      </label>
                      <input
                        required
                        type="text"
                        value={masterNilai}
                        onChange={(e) => setMasterNilai(e.target.value)}
                        placeholder="Contoh: LABKOM D / 12 MIPA 4"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-xs uppercase inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Simpan Data</span>
                    </button>
                  </form>

                  <div className="border-t border-slate-100 mt-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setMasterBulkPasteOpen((p) => !p)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900"
                    >
                      <span>Tambah Massal (Tempel Daftar)</span>
                      <span className="text-slate-400">{masterBulkPasteOpen ? 'Tutup' : 'Buka'}</span>
                    </button>

                    {masterBulkPasteOpen && (
                      <form onSubmit={handleBulkPasteMaster} className="mt-3 space-y-2.5">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Tempel beberapa baris nilai untuk kategori{' '}
                          <span className="font-bold text-slate-700">{masterKategori}</span>{' '}
                          (pisahkan dengan baris baru atau koma).
                        </p>
                        <textarea
                          rows={5}
                          value={masterBulkPasteText}
                          onChange={(e) => setMasterBulkPasteText(e.target.value)}
                          placeholder={'Contoh:\n10 AL-FARABI\n10 IBNU SINA\n11 AL-KHWARIZMI'}
                          className="w-full border border-slate-200 rounded-lg p-2.5 text-xs font-medium outline-none focus:border-teal-600"
                        />
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-lg text-xs"
                        >
                          Simpan ke {masterKategori}
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
                  <div className="font-bold text-slate-800">Alur Penyesuaian Data</div>
                  <p>
                    1. Klik <strong>Tarik dari Peminjaman</strong> agar seluruh Guru, Kelas, Mapel,
                    dan Ruang dari riwayat peminjaman saat ini masuk ke Master Data.
                  </p>
                  <p>
                    2. Klik <strong>Unduh Template (.xlsx)</strong> untuk mengedit/menyeragamkan nama
                    secara massal di Excel lewat kolom <code>Ubah_Menjadi</code>, lalu unggah kembali.
                  </p>
                  <p>
                    3. Atau klik <strong>Edit</strong> langsung pada item di samping—riwayat
                    peminjaman terkait otomatis ikut disesuaikan.
                  </p>
                </div>
              </div>

              {/* Right Column: Search, Cascade Toggle & Category Cards */}
              <div className="md:col-span-8 space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={masterSearch}
                      onChange={(e) => setMasterSearch(e.target.value)}
                      placeholder="Cari nama guru, kelas, mapel, atau ruang..."
                      className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium outline-none focus:border-teal-600"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={masterCascadeEdit}
                      onChange={(e) => setMasterCascadeEdit(e.target.checked)}
                      className="accent-teal-600"
                    />
                    <span>Sesuaikan peminjaman saat Edit</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['GURU', 'KELAS', 'MAPEL', 'LAB', 'RUANGAN', 'JAM', 'WAKTU_RUANG'] as const).map(
                    (cat) => {
                      const rawList = getMaster(cat);
                      const list = qMaster
                        ? rawList.filter((m) => m.nilai.toLowerCase().includes(qMaster))
                        : rawList;
                      const catHeaderTheme: Record<LabkomMasterKategori, string> = {
                        GURU: 'bg-sky-50 border-sky-200/80 text-sky-900',
                        KELAS: 'bg-emerald-50 border-emerald-200/80 text-emerald-900',
                        MAPEL: 'bg-violet-50 border-violet-200/80 text-violet-900',
                        LAB: 'bg-blue-50 border-blue-200/80 text-blue-900',
                        RUANGAN: 'bg-indigo-50 border-indigo-200/80 text-indigo-900',
                        JAM: 'bg-amber-50 border-amber-200/80 text-amber-900',
                        WAKTU_RUANG: 'bg-rose-50 border-rose-200/80 text-rose-900',
                      };
                      return (
                        <div
                          key={cat}
                          className="bg-white rounded-xl border border-slate-200 flex flex-col h-72 overflow-hidden"
                        >
                          <div
                            className={`px-4 py-3 border-b flex justify-between items-center ${catHeaderTheme[cat]}`}
                          >
                            <span className="text-xs font-bold uppercase">{cat}</span>
                            <span className="text-xs font-bold font-mono-num opacity-80">
                              {qMaster ? `${list.length}/${rawList.length}` : rawList.length}
                            </span>
                          </div>
                          <div className="overflow-y-auto flex-1 p-2 divide-y divide-slate-100">
                            {list.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center px-4">
                                {qMaster
                                  ? 'Tidak ada data yang cocok.'
                                  : 'Belum ada data. Tarik dari peminjaman atau tambah baru.'}
                              </div>
                            ) : (
                              list.map((m, idx) => {
                                const usedCount =
                                  usageMap.get(`${cat}|${m.nilai.trim().toUpperCase()}`) || 0;
                                return (
                                  <div
                                    key={`${m.id}__${idx}`}
                                    className="p-2 flex justify-between items-center gap-2 hover:bg-slate-50 rounded-lg group"
                                  >
                                    {editingMasterId === m.id ? (
                                      <div className="flex items-center gap-1.5 w-full">
                                        <input
                                          type="text"
                                          value={editingMasterVal}
                                          onChange={(e) => setEditingMasterVal(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleUpdateMaster(m.id);
                                            } else if (e.key === 'Escape') {
                                              setEditingMasterId(null);
                                            }
                                          }}
                                          className="flex-1 border border-teal-500 rounded px-2 py-1 text-xs font-semibold outline-none"
                                        />
                                        <button
                                          type="button"
                                          disabled={submitting}
                                          onClick={() => handleUpdateMaster(m.id)}
                                          className="p-1 bg-teal-600 text-white rounded"
                                          title="Simpan Penyesuaian"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingMasterId(null)}
                                          className="p-1 bg-slate-200 text-slate-700 rounded"
                                          title="Batal"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                          <span className="text-xs font-semibold text-slate-800 truncate">
                                            {m.nilai}
                                          </span>
                                          {usedCount > 0 && (
                                            <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                                              {usedCount}×
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingMasterId(m.id);
                                              setEditingMasterVal(m.nilai);
                                            }}
                                            className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded text-[10px] font-bold"
                                          >
                                            Edit
                                          </button>
                                          {!m.id.startsWith('LM_T_') && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteMaster(m.id)}
                                              className="text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded text-[10px] font-bold"
                                            >
                                              Hapus
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====================================================== */}
      {/* MODAL ADMIN EDIT PEMINJAMAN LABKOM & RUANGAN            */}
      {/* ====================================================== */}
      {editingBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div
              className={`p-4 sm:p-5 text-white flex items-center justify-between ${
                editKampus === 'PUTRA'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-700'
                  : 'bg-gradient-to-r from-fuchsia-600 to-pink-600'
              }`}
            >
              <div>
                <div className="text-[11px] font-semibold text-white/80">
                  ID: {editingBooking.id}
                </div>
                <h3 className="text-base font-bold uppercase">
                  Edit Data Peminjam (Admin)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBooking(null)}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBooking} className="p-4 sm:p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                {(['PUTRA', 'PUTRI'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEditKampus(k)}
                    className={`py-2 rounded-lg text-xs font-bold uppercase border transition-colors ${
                      editKampus === k
                        ? k === 'PUTRA'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-fuchsia-600 text-white border-fuchsia-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Kampus {k}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nama Peminjam
                  </label>
                  <input
                    type="text"
                    required
                    value={editNamaPeminjam}
                    onChange={(e) => setEditNamaPeminjam(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Email Peminjam
                  </label>
                  <input
                    type="text"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Guru
                  </label>
                  <input
                    type="text"
                    list="edit-master-guru"
                    value={editGuru}
                    onChange={(e) => setEditGuru(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                  <datalist id="edit-master-guru">
                    {getMaster('GURU').map((g) => (
                      <option key={g.id} value={g.nilai} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Kelas
                  </label>
                  <input
                    type="text"
                    list="edit-master-kelas"
                    value={editKelas}
                    onChange={(e) => setEditKelas(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                  <datalist id="edit-master-kelas">
                    {getMaster('KELAS').map((k) => (
                      <option key={k.id} value={k.nilai} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Mapel
                  </label>
                  <input
                    type="text"
                    list="edit-master-mapel"
                    value={editMapel}
                    onChange={(e) => setEditMapel(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                  <datalist id="edit-master-mapel">
                    {getMaster('MAPEL').map((m) => (
                      <option key={m.id} value={m.nilai} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Lab / Ruangan
                  </label>
                  <input
                    type="text"
                    required
                    list="edit-master-lab"
                    value={editLab}
                    onChange={(e) => setEditLab(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                  <datalist id="edit-master-lab">
                    {[...getMaster('LAB'), ...getMaster('RUANGAN')].map((l) => (
                      <option key={l.id} value={l.nilai} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={editTanggal}
                    onChange={(e) => setEditTanggal(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Jam Ke / Sesi
                  </label>
                  <input
                    type="text"
                    required
                    list="edit-master-jam"
                    value={editJamKe}
                    onChange={(e) => setEditJamKe(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-teal-600"
                  />
                  <datalist id="edit-master-jam">
                    {[...getMaster('JAM'), ...getMaster('WAKTU_RUANG')].map((j) => (
                      <option key={j.id} value={j.nilai} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white outline-none focus:border-teal-600"
                  >
                    <option value="Disetujui">Disetujui</option>
                    <option value="Menunggu">Menunggu</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Dibatalkan">Dibatalkan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Keterangan
                  </label>
                  <input
                    type="text"
                    value={editKeterangan}
                    onChange={(e) => setEditKeterangan(e.target.value)}
                    placeholder="Catatan kegiatan / keperluan..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] text-slate-600">
                Sistem otomatis memvalidasi bentrok jadwal tetap KBM &amp; booking lain saat perubahan disimpan.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-xs font-bold text-white"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
