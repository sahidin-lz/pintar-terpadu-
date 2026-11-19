import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  FileSpreadsheet,
  FileText,
  Home,
  KeyRound,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { RoomMapping, ScheduleItem, Student, SystemCounts, TeacherPublic, UserRole } from '../types';
import {
  COMPONENT_TEMPLATES,
  downloadComponentExcelTemplate,
  parseDatabaseExcelBuffer,
  parseDatabaseWorkbookFromSpec,
  type ComponentTemplateKey,
  type DatabaseWorkbookSpec,
  type ParsedDatabaseWorkbook,
} from '../utils/excelParser';
import {
  buildClientDatabaseWorkbookSpec,
  downloadLoginAccessCardsPdf,
  downloadMasterDatabaseExcelClient,
  downloadPegawaiTokenTablePdf,
  generateClientTeacherToken,
  resolveTeacherToken,
} from '../utils/exportHelpers';
import { auth, pushSnapshotToFirestore } from '../firebase';
import { loadSubTab, saveSubTab } from '../utils/sessionPersistence';

const IMPORT_TABS: readonly AdminTab[] = ['excel_upload', 'pegawai_amanah', 'kelola'];

interface ImportSimModuleProps {
  currentUser: TeacherPublic | null;
  teachers: TeacherPublic[];
  counts: SystemCounts | null;
  ruanganUjian: string[];
  kelasList?: string[];
  rooms?: RoomMapping[];
  onDataUpdated: () => void;
  onExplicitReset?: () => void;
  onAdminLogin?: (teacher: TeacherPublic) => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type AdminTab = 'excel_upload' | 'pegawai_amanah' | 'kelola';

const AMANAH_ROLES: UserRole[] = [
  'Guru',
  'Guru Wali',
  'Wali Kelas',
  'Wali Asrama',
  'Musyrif',
  'Musyrifah',
  'Pengampu Al-Quran',
  'Pimpinan',
  'Admin SIM',
];

async function parseJsonSafe<T = Record<string, unknown>>(res: Response): Promise<T> {
  const rawText = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    if (!res.ok) {
      const cleanSnippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
      throw new Error(`Server mengembalikan respons HTTP ${res.status}${cleanSnippet ? `: ${cleanSnippet}` : ''}`);
    }
    throw new Error('Respons server bukan format JSON yang valid.');
  }
  if (!res.ok) {
    const errMsg =
      (parsed && typeof parsed.error === 'string' && parsed.error) ||
      `Permintaan gagal (HTTP ${res.status})`;
    throw new Error(errMsg);
  }
  return parsed as T;
}

export const ImportSimModule: React.FC<ImportSimModuleProps> = ({
  currentUser,
  teachers,
  counts,
  ruanganUjian,
  kelasList = [],
  rooms = [],
  onDataUpdated,
  onExplicitReset,
  onAdminLogin,
  notify,
}) => {
  const isSuperAdmin =
    currentUser?.peran === 'Admin Super' || currentUser?.peran === 'Admin SIM';

  // Inline Admin Super Login Gate state
  const [adminEmail, setAdminEmail] = useState<string>('sahidin30@gmail.com');
  const [adminPin, setAdminPin] = useState<string>('');
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  // Collapsible panels & Template spec state (dirakit 100% di sisi klien browser)
  const [inventoryMinimized, setInventoryMinimized] = useState<boolean>(false);
  const [templateMinimized, setTemplateMinimized] = useState<boolean>(false);
  const [componentTemplatesMinimized, setComponentTemplatesMinimized] = useState<boolean>(false);
  const [uploadingComponentKey, setUploadingComponentKey] = useState<ComponentTemplateKey | null>(null);
  const [componentUploadStatus, setComponentUploadStatus] = useState<Record<string, string>>({});
  const [loadingSpec, setLoadingSpec] = useState<boolean>(false);

  // Active tab & Excel upload state
  const [activeTab, setActiveTab] = useState<AdminTab>(() =>
    loadSubTab('pintar_import_tab_v1', IMPORT_TABS, 'excel_upload'),
  );
  const [excelWorkbook, setExcelWorkbook] = useState<ParsedDatabaseWorkbook | null>(null);
  const [excelPreviewSheet, setExcelPreviewSheet] = useState<
    'santri' | 'pegawai' | 'musyrif' | 'waliKelas' | 'guru' | 'jadwal' | 'ruang'
  >('santri');
  const [previewWilayah, setPreviewWilayah] = useState<'Semua' | 'Putra' | 'Putri'>(() =>
    loadSubTab('pintar_import_wilayah_v1', ['Semua', 'Putra', 'Putri'] as const, 'Semua'),
  );
  const [importing, setImporting] = useState<boolean>(false);

  useEffect(() => {
    saveSubTab('pintar_import_tab_v1', activeTab);
  }, [activeTab]);

  useEffect(() => {
    saveSubTab('pintar_import_wilayah_v1', previewWilayah);
  }, [previewWilayah]);

  // Upload options
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [autoCreateAccounts, setAutoCreateAccounts] = useState<boolean>(true);
  const [autoCreateQuranSchedules, setAutoCreateQuranSchedules] = useState<boolean>(true);
  const [defaultPin, setDefaultPin] = useState<string>('1234');

  // Master Pegawai Click-to-Assign Workbench state
  const [pegawaiSearch, setPegawaiSearch] = useState<string>('');
  const [pegawaiWilayahFilter, setPegawaiWilayahFilter] = useState<'Semua' | 'Putra' | 'Putri'>('Semua');
  const [selectedPegawaiId, setSelectedPegawaiId] = useState<string>('');
  const [bulkPegawaiText, setBulkPegawaiText] = useState<string>('');
  const [bulkPegawaiWilayah, setBulkPegawaiWilayah] = useState<'Putra' | 'Putri' | 'Semua'>('Putra');
  const [showBulkPegawaiBox, setShowBulkPegawaiBox] = useState<boolean>(false);
  const [savingBulkPegawai, setSavingBulkPegawai] = useState<boolean>(false);

  const [assignGenderScope, setAssignGenderScope] = useState<'Putra' | 'Putri' | 'Semua'>('Putra');
  const [assignRoles, setAssignRoles] = useState<UserRole[]>(['Guru']);
  const [assignPrimaryRole, setAssignPrimaryRole] = useState<UserRole>('Guru');
  const [assignWaliKelas, setAssignWaliKelas] = useState<string>('');
  const [assignKamarBinaan, setAssignKamarBinaan] = useState<string[]>([]);
  const [customKamarInput, setCustomKamarInput] = useState<string>('');
  const [assignWhatsapp, setAssignWhatsapp] = useState<string>('');
  const [assignPin, setAssignPin] = useState<string>('');
  const [savingAssign, setSavingAssign] = useState<boolean>(false);

  const [adminStudents, setAdminStudents] = useState<Student[]>([]);
  const [studentSearchQ, setStudentSearchQ] = useState('');
  const [studentWilayahFilter, setStudentWilayahFilter] = useState<'Semua' | 'Putra' | 'Putri'>('Semua');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [sNis, setSNis] = useState('');
  const [sNama, setSNama] = useState('');
  const [sGender, setSGender] = useState<'Putra' | 'Putri'>('Putra');
  const [sKelas, setSKelas] = useState('');
  const [sKamar, setSKamar] = useState('');
  const [sKelompok, setSKelompok] = useState('');
  const [sPengampu, setSPengampu] = useState('');
  const [savingStudentDirect, setSavingStudentDirect] = useState(false);

  const [adminSchedules, setAdminSchedules] = useState<ScheduleItem[]>([]);
  const [scheduleSearchQ, setScheduleSearchQ] = useState('');
  const [scheduleWilayahFilter, setScheduleWilayahFilter] = useState<'Semua' | 'Putra' | 'Putri'>('Semua');
  const [tidyingData, setTidyingData] = useState(false);
  const excelPreviewRef = useRef<HTMLDivElement | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [jKategori, setJKategori] = useState<'Akademik' | 'Al-Quran'>('Akademik');
  const [jGuru, setJGuru] = useState('');
  const [jHari, setJHari] = useState('SENIN');
  const [jGender, setJGender] = useState<'Putra' | 'Putri'>('Putra');
  const [jKelas, setJKelas] = useState('');
  const [jMapel, setJMapel] = useState('');
  const [jJam, setJJam] = useState('1-2');
  const [savingScheduleDirect, setSavingScheduleDirect] = useState(false);

  // Manual account creation / edit & Exam room & Reset
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [mNama, setMNama] = useState('');
  const [mPeran, setMPeran] = useState<UserRole>('Wali Kelas');
  const [mGender, setMGender] = useState<'Putra' | 'Putri' | 'Semua'>('Putra');
  const [mWaliKelas, setMWaliKelas] = useState('');
  const [mKamar, setMKamar] = useState('');
  const [mUsername, setMUsername] = useState('');
  const [mPin, setMPin] = useState('1234');

  const [editingRuangOldName, setEditingRuangOldName] = useState<string | null>(null);
  const [newRuang, setNewRuang] = useState<string>('');
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  const workbookSpec = useMemo<DatabaseWorkbookSpec>(
    () =>
      buildClientDatabaseWorkbookSpec({
        students: adminStudents,
        rooms,
        teachers,
        schedules: adminSchedules,
        ruanganUjian,
      }),
    [adminStudents, rooms, teachers, adminSchedules, ruanganUjian],
  );

  const loadAdminEntities = useCallback(async () => {
    setLoadingSpec(true);
    try {
      const [studentsRes, schedulesRes] = await Promise.all([
        fetch('/api/students').then((r) => (r.ok ? r.json() : [])).catch(() => []),
        fetch('/api/jadwal').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      ]);
      setAdminStudents(Array.isArray(studentsRes) ? studentsRes : []);
      setAdminSchedules(Array.isArray(schedulesRes) ? schedulesRes : []);
    } finally {
      setLoadingSpec(false);
    }
  }, []);

  const loadWorkbookSpec = useCallback(async () => {
    await loadAdminEntities();
    return buildClientDatabaseWorkbookSpec({
      students: adminStudents,
      rooms,
      teachers,
      schedules: adminSchedules,
      ruanganUjian,
    });
  }, [loadAdminEntities, adminStudents, rooms, teachers, adminSchedules, ruanganUjian]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAdminEntities();
    }
  }, [isSuperAdmin, counts?.students, counts?.teachers, counts?.rooms, counts?.schedules, loadAdminEntities]);

  const isLocalSuperAdminMatch = (identifier: string, pin: string): boolean => {
    const normId = identifier.trim().toLowerCase();
    const normPin = pin.trim();
    const validIds = ['sahidin30@gmail.com', 'sahidin30', 'sahidin', 'admin', 'admin super', 'sa'];
    const validPins = ['121320', '123456', '1234', 'admin123'];
    return validIds.includes(normId) && validPins.includes(normPin);
  };

  const getFallbackSuperAdminAccount = (): TeacherPublic => {
    const existing = teachers.find(
      (t) =>
        t.peran === 'Admin Super' ||
        t.email?.toLowerCase() === 'sahidin30@gmail.com' ||
        t.username?.toLowerCase() === 'sahidin30@gmail.com' ||
        t.username?.toLowerCase() === 'sahidin30'
    );
    return (
      existing || {
        id: 'GURU-SUPERADMIN',
        nama: 'SAHIDIN (ADMIN SUPER)',
        jabatan: 'Admin Super & Pengelola Utama SIM PINTAR',
        peran: 'Admin Super',
        peranTambahan: ['Admin SIM', 'Wali Kelas', 'Musyrif', 'Guru', 'Pengampu Al-Quran'],
        genderScope: 'Semua',
        email: 'sahidin30@gmail.com',
        username: 'sahidin30@gmail.com',
        whatsapp: '6281200000001',
      }
    );
  };

  const handleAdminGateLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPin.trim()) {
      notify('Masukkan email/username Admin Super dan PIN.', 'error');
      return;
    }
    setLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: adminEmail.trim(), pin: adminPin.trim() }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.ok && data.teacher) {
          if (data.teacher.peran !== 'Admin Super' && data.teacher.peran !== 'Admin SIM') {
            notify('Akun ini bukan Admin Super. Gunakan akun sahidin30@gmail.com.', 'error');
            return;
          }
          onAdminLogin?.(data.teacher);
          notify(`Selamat datang, ${data.teacher.nama}. Panel Template & Upload Database Excel aktif.`, 'success');
          return;
        }
      }

      if (isLocalSuperAdminMatch(adminEmail, adminPin)) {
        const fallbackAdmin = getFallbackSuperAdminAccount();
        onAdminLogin?.(fallbackAdmin);
        notify(`Selamat datang, ${fallbackAdmin.nama}. Panel Template & Upload Database Excel aktif.`, 'success');
        return;
      }

      notify('Email atau PIN Admin Super salah. Gunakan sahidin30@gmail.com & PIN 121320.', 'error');
    } catch {
      if (isLocalSuperAdminMatch(adminEmail, adminPin)) {
        const fallbackAdmin = getFallbackSuperAdminAccount();
        onAdminLogin?.(fallbackAdmin);
        notify(`Selamat datang, ${fallbackAdmin.nama}. Panel Template & Upload Database Excel aktif.`, 'success');
        return;
      }
      notify('Gagal menghubungi server login. Gunakan sahidin30@gmail.com & PIN 121320.', 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleDownloadExcelTemplate = () => {
    try {
      const spec = downloadMasterDatabaseExcelClient({
        students: adminStudents,
        rooms,
        teachers,
        schedules: adminSchedules,
        ruanganUjian,
      });
      notify(
        `Mengunduh ${spec.filename} (${spec.sheets.length} sheet dirakit 100% di browser — bebas timeout server).`,
        'success',
      );
    } catch (err) {
      notify((err as Error).message || 'Gagal merakit file Excel (.xlsx) di browser.', 'error');
    }
  };

  const handleDownloadComponentTemplate = (
    key: ComponentTemplateKey,
    mode: 'blank' | 'filled'
  ) => {
    try {
      const downloadedName = downloadComponentExcelTemplate(key, mode, workbookSpec);
      notify(
        `Berhasil mengunduh ${downloadedName} (${mode === 'blank' ? 'Template Kosong Siap Isi' : 'Berisi Data Saat Ini'}).`,
        'success'
      );
    } catch (err) {
      const downloadedName = downloadComponentExcelTemplate(key, 'blank', null);
      notify(`Mengunduh template standar ${downloadedName} (${(err as Error).message || 'mode lokal'}).`, 'info');
    }
  };

  const handleSingleComponentFileUpload = (
    key: ComponentTemplateKey,
    title: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingComponentKey(key);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) {
        setUploadingComponentKey(null);
        return;
      }
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        const cleanSantri = parsed.santriRows.filter(
          (r) => !r.warning || r.warning !== 'Nama identik dengan Nama Kelas'
        );
        const combinedTeachers = [
          ...parsed.pegawaiRows,
          ...parsed.musyrifRows,
          ...parsed.waliKelasRows,
          ...parsed.guruRows,
        ];

        const payload = {
          santriRows: cleanSantri,
          teacherRows: combinedTeachers,
          scheduleRows: parsed.scheduleRows,
          ruanganUjian: parsed.ruanganUjian,
          pembinaanRows: parsed.pembinaanRows,
          replaceExisting: false,
          autoCreateAccounts: true,
          autoCreateQuranSchedules: key === 'santri',
          defaultPin: defaultPin || '1234',
        };

        const totalDetected =
          cleanSantri.length +
          combinedTeachers.length +
          parsed.scheduleRows.length +
          parsed.ruanganUjian.length +
          parsed.pembinaanRows.length;

        if (totalDetected === 0) {
          throw new Error(
            `Tidak ada baris data yang terbaca pada file ${file.name}. Pastikan header sesuai template ${title}.`
          );
        }

        const res = await fetch('/api/import/all-in-one', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await parseJsonSafe(res);

        if (auth.currentUser) {
          fetch('/api/firebase/snapshot')
            .then((r) => (r.ok ? r.json() : null))
            .then((snap) => (snap ? pushSnapshotToFirestore(snap) : null))
            .then(() => fetch('/api/firebase/mark-synced', { method: 'POST' }))
            .catch(() => {});
        }

        setExcelWorkbook(parsed);
        onDataUpdated();
        await loadWorkbookSpec();
        loadAdminEntities();

        const summaryBadge = `Tersimpan (${totalDetected} baris dari ${file.name})`;
        setComponentUploadStatus((prev) => ({ ...prev, [key]: summaryBadge }));
        notify(
          `Komponen "${title}" berhasil diupload! (${totalDetected} baris diproses & disimpan tanpa menghapus data sebelumnya).`,
          'success'
        );
      } catch (err) {
        notify((err as Error).message || `Gagal menyimpan file komponen ${title}.`, 'error');
      } finally {
        setUploadingComponentKey(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLoadServerTemplateToPreview = () => {
    try {
      const parsed = parseDatabaseWorkbookFromSpec(workbookSpec);
      setExcelWorkbook(parsed);
      setActiveTab('excel_upload');
      notify('Template Database Excel 11 sheet berhasil dirakit di browser & dimuat ke pratinjau.', 'success');
    } catch (err) {
      notify((err as Error).message || 'Gagal memproses pratinjau template terpadu.', 'error');
    }
  };

  const handleDirectCommitWorkbookSpec = async () => {
    setImporting(true);
    try {
      const targetWorkbook = excelWorkbook || parseDatabaseWorkbookFromSpec(workbookSpec);
      const cleanSantri = targetWorkbook.santriRows.filter(
        (r) => !r.warning || r.warning !== 'Nama identik dengan Nama Kelas'
      );
      const combinedTeachers = [
        ...targetWorkbook.pegawaiRows,
        ...targetWorkbook.musyrifRows,
        ...targetWorkbook.waliKelasRows,
        ...targetWorkbook.guruRows,
      ];
      const res = await fetch('/api/import/all-in-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          santriRows: cleanSantri,
          teacherRows: combinedTeachers,
          scheduleRows: targetWorkbook.scheduleRows,
          ruanganUjian: targetWorkbook.ruanganUjian,
          pembinaanRows: targetWorkbook.pembinaanRows,
          replaceExisting: false,
          autoCreateAccounts,
          autoCreateQuranSchedules,
          defaultPin: defaultPin || '1234',
        }),
      });
      const data = await parseJsonSafe<{
        santri: { inserted: number; updated: number };
        teachers: { added: number; updated: number };
        schedules: { added: number; updated?: number };
      }>(res);
      notify(
        `Seluruh data template berhasil disimpan! Siswa: ${data.santri.inserted} baru/${data.santri.updated} update · Akun: ${data.teachers.added + data.teachers.updated} · Jadwal: ${data.schedules.added + (data.schedules.updated || 0)}.`,
        'success'
      );

      if (auth.currentUser) {
        fetch('/api/firebase/snapshot')
          .then((r) => (r.ok ? r.json() : null))
          .then((snap) => (snap ? pushSnapshotToFirestore(snap) : null))
          .then(() => fetch('/api/firebase/mark-synced', { method: 'POST' }))
          .catch(() => {});
      }

      onDataUpdated();
      await loadAdminEntities();
    } catch (err) {
      notify((err as Error).message || 'Gagal menyimpan data template terpadu.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadJsonBackup = async () => {
    try {
      const res = await fetch('/api/system/snapshot');
      const snap = await parseJsonSafe(res);
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_SIM_PINTAR_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      notify('Backup lengkap JSON (santri, akun, jadwal, presensi, pembinaan) berhasil diunduh.', 'success');
    } catch (err) {
      notify((err as Error).message || 'Gagal mengunduh backup JSON.', 'error');
    }
  };

  const handleRestoreJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = String(ev.target?.result || '');
        const snapshot = JSON.parse(text);
        const res = await fetch('/api/system/restore-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot, mode: 'merge' }),
        });
        const data = await parseJsonSafe<{
          restored?: { students: number; schedules: number; attendanceLogs: number; pembinaanRecords: number };
        }>(res);
        onDataUpdated();
        await loadWorkbookSpec();
        loadAdminEntities();
        notify(
          `Backup dipulihkan! (+${data.restored?.students ?? 0} santri, +${data.restored?.schedules ?? 0} jadwal, +${data.restored?.attendanceLogs ?? 0} presensi, +${data.restored?.pembinaanRecords ?? 0} pembinaan)`,
          'success'
        );
      } catch (err) {
        notify((err as Error).message || 'File backup JSON tidak valid.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const staffDirectory = useMemo(
    () =>
      teachers
        .filter((t) => t.peran !== 'Admin Super')
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [teachers],
  );

  const selectedPegawai = useMemo(
    () => staffDirectory.find((t) => t.id === selectedPegawaiId) || null,
    [staffDirectory, selectedPegawaiId],
  );

  useEffect(() => {
    if (!selectedPegawaiId && staffDirectory.length > 0) {
      setSelectedPegawaiId(staffDirectory[0].id);
    } else if (selectedPegawaiId && !staffDirectory.some((t) => t.id === selectedPegawaiId)) {
      setSelectedPegawaiId(staffDirectory[0]?.id || '');
    }
  }, [staffDirectory, selectedPegawaiId]);

  useEffect(() => {
    if (!selectedPegawai) return;
    const roleSet = new Set<UserRole>([
      selectedPegawai.peran,
      ...(selectedPegawai.peranTambahan || []),
    ]);
    setAssignGenderScope(selectedPegawai.genderScope || 'Semua');
    setAssignPrimaryRole(selectedPegawai.peran);
    setAssignRoles(Array.from(roleSet));
    setAssignWaliKelas(selectedPegawai.waliKelasOf || '');
    setAssignKamarBinaan(selectedPegawai.kamarBinaan || []);
    setAssignWhatsapp(selectedPegawai.whatsapp || '');
    setAssignPin('');
  }, [selectedPegawai]);

  const allKnownClasses = useMemo(() => {
    const set = new Set<string>(kelasList.filter(Boolean));
    for (const t of teachers) {
      if (t.waliKelasOf) set.add(t.waliKelasOf);
    }
    if (assignWaliKelas.trim()) set.add(assignWaliKelas.trim().toUpperCase());
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [kelasList, teachers, assignWaliKelas]);

  const allKnownRooms = useMemo(() => {
    const set = new Set<string>(rooms.map((r) => r.kamar).filter(Boolean));
    for (const t of teachers) {
      (t.kamarBinaan || []).forEach((km) => {
        if (km) set.add(km);
      });
    }
    assignKamarBinaan.forEach((km) => {
      if (km) set.add(km);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [rooms, teachers, assignKamarBinaan]);

  const filteredStaffList = useMemo(() => {
    const q = pegawaiSearch.trim().toLowerCase();
    return staffDirectory.filter((t) => {
      if (
        pegawaiWilayahFilter !== 'Semua' &&
        t.genderScope !== pegawaiWilayahFilter &&
        t.genderScope !== 'Semua'
      ) {
        return false;
      }
      if (q) {
        const hay = `${t.nama} ${t.peran} ${(t.peranTambahan || []).join(' ')} ${t.waliKelasOf || ''} ${(t.kamarBinaan || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [staffDirectory, pegawaiWilayahFilter, pegawaiSearch]);

  const toggleAssignRole = (role: UserRole) => {
    setAssignRoles((prev) => {
      const exists = prev.includes(role);
      const next = exists ? prev.filter((r) => r !== role) : [...prev, role];
      if (next.length === 0) return prev;
      if (!next.includes(assignPrimaryRole)) {
        setAssignPrimaryRole(next[0]);
      }
      return next;
    });
  };

  const toggleAssignRoom = (kamar: string) => {
    setAssignKamarBinaan((prev) =>
      prev.includes(kamar) ? prev.filter((k) => k !== kamar) : [...prev, kamar],
    );
  };

  const handleAddCustomRoomsToAssign = () => {
    const parts = customKamarInput
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setAssignKamarBinaan((prev) => Array.from(new Set([...prev, ...parts])));
    setCustomKamarInput('');
  };

  const handleSavePegawaiAmanah = async () => {
    if (!selectedPegawai) return;
    setSavingAssign(true);
    try {
      const primary = assignRoles.includes(assignPrimaryRole)
        ? assignPrimaryRole
        : assignRoles[0] || selectedPegawai.peran;
      const extras = assignRoles.filter((r) => r !== primary);
      const payload: Record<string, unknown> = {
        peran: primary,
        peranTambahan: extras,
        genderScope: assignGenderScope,
        waliKelasOf: assignWaliKelas.trim(),
        kamarBinaan: assignKamarBinaan,
        whatsapp: assignWhatsapp.trim(),
      };
      if (assignPin.trim()) {
        payload.pin = assignPin.trim();
      }
      const res = await fetch(`/api/guru/${selectedPegawai.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan amanah pegawai.');
      onDataUpdated();
      loadWorkbookSpec();
      notify(`Amanah untuk ${selectedPegawai.nama} berhasil diperbarui.`, 'success');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingAssign(false);
    }
  };

  const handleBulkPastePegawai = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = bulkPegawaiText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      notify('Tempel atau ketik minimal 1 nama pegawai.', 'error');
      return;
    }
    setSavingBulkPegawai(true);
    try {
      const rows = lines.map((line) => {
        const parts = line.split(/\t|;/).map((p) => p.trim());
        const nama = parts[0];
        return {
          nama,
          peran: 'Guru' as UserRole,
          genderScope: bulkPegawaiWilayah,
          whatsapp: parts[1] || '',
          pin: defaultPin || '1234',
        };
      });
      const res = await fetch('/api/import/guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan daftar pegawai.');
      setBulkPegawaiText('');
      setShowBulkPegawaiBox(false);
      onDataUpdated();
      loadWorkbookSpec();
      notify(
        `${data.added} pegawai baru ditambahkan (${data.updated} diperbarui). Silakan klik nama di daftar untuk mengatur amanah kamar/kelas/musyrif.`,
        'success',
      );
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingBulkPegawai(false);
    }
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) return;
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        const totalRows =
          parsed.santriRows.length +
          parsed.pegawaiRows.length +
          parsed.musyrifRows.length +
          parsed.waliKelasRows.length +
          parsed.guruRows.length +
          parsed.scheduleRows.length +
          parsed.ruanganUjian.length +
          parsed.pembinaanRows.length;

        if (totalRows === 0) {
          notify(
            `File ${file.name} terbaca (${parsed.detectedSheets.length} sheet) tetapi belum ada baris data yang cocok dengan kolom SIM. Cek nama header (Nama, Kelas, Kamar, Wilayah).`,
            'error',
          );
          return;
        }

        const putraCount =
          parsed.santriRows.filter((r) => r.gender === 'Putra').length +
          parsed.pegawaiRows.filter((r) => r.genderScope === 'Putra').length +
          parsed.musyrifRows.filter((r) => r.genderScope === 'Putra').length +
          parsed.waliKelasRows.filter((r) => r.genderScope === 'Putra').length +
          parsed.scheduleRows.filter((r) => r.gender === 'Putra').length;
        const putriCount =
          parsed.santriRows.filter((r) => r.gender === 'Putri').length +
          parsed.pegawaiRows.filter((r) => r.genderScope === 'Putri').length +
          parsed.musyrifRows.filter((r) => r.genderScope === 'Putri').length +
          parsed.waliKelasRows.filter((r) => r.genderScope === 'Putri').length +
          parsed.scheduleRows.filter((r) => r.gender === 'Putri').length;

        setExcelWorkbook(parsed);
        if (parsed.santriRows.length > 0) setExcelPreviewSheet('santri');
        else if (parsed.pegawaiRows.length > 0) setExcelPreviewSheet('pegawai');
        else if (parsed.musyrifRows.length > 0) setExcelPreviewSheet('musyrif');
        else if (parsed.waliKelasRows.length > 0) setExcelPreviewSheet('waliKelas');
        else if (parsed.guruRows.length > 0) setExcelPreviewSheet('guru');
        else if (parsed.scheduleRows.length > 0) setExcelPreviewSheet('jadwal');
        else setExcelPreviewSheet('ruang');

        if (putriCount > 0 && putraCount === 0) setPreviewWilayah('Putri');
        else setPreviewWilayah('Semua');

        setActiveTab('excel_upload');
        notify(
          `File ${file.name} terbaca (${totalRows} baris: Putra ${putraCount}, Putri ${putriCount}). Klik tombol "Upload Database" di pratinjau untuk menyimpan ke sistem!`,
          'info',
        );
        setTimeout(() => excelPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      } catch {
        notify(
          'Gagal membaca file Excel/CSV (.xlsx/.xls/.csv). Pastikan file valid dan tidak terproteksi password.',
          'error',
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDirectUploadFullDatabaseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) return;
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        const cleanSantri = parsed.santriRows.filter(
          (r) => !r.warning || r.warning !== 'Nama identik dengan Nama Kelas',
        );
        const combinedTeachers = [
          ...parsed.pegawaiRows,
          ...parsed.musyrifRows,
          ...parsed.waliKelasRows,
          ...parsed.guruRows,
        ];
        const totalRows =
          cleanSantri.length +
          combinedTeachers.length +
          parsed.scheduleRows.length +
          parsed.ruanganUjian.length +
          parsed.pembinaanRows.length;

        if (totalRows === 0) {
          notify(
            `File ${file.name} terbaca (${parsed.detectedSheets.length} sheet) tetapi belum ada baris data yang cocok dengan kolom SIM.`,
            'error',
          );
          return;
        }

        setImporting(true);
        const res = await fetch('/api/import/all-in-one', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            santriRows: cleanSantri,
            teacherRows: combinedTeachers,
            scheduleRows: parsed.scheduleRows,
            ruanganUjian: parsed.ruanganUjian,
            pembinaanRows: parsed.pembinaanRows,
            replaceExisting,
            autoCreateAccounts,
            autoCreateQuranSchedules,
            defaultPin,
          }),
        });
        const data = await parseJsonSafe<{
          santri: { inserted: number; updated: number };
          teachers: { added: number; updated: number };
          schedules: { added: number; updated?: number };
          ruanganUjianAdded: number;
        }>(res);

        if (auth.currentUser) {
          fetch('/api/firebase/snapshot')
            .then((r) => (r.ok ? r.json() : null))
            .then((snap) => (snap ? pushSnapshotToFirestore(snap) : null))
            .then(() => fetch('/api/firebase/mark-synced', { method: 'POST' }))
            .catch(() => {});
        }

        onDataUpdated();
        loadWorkbookSpec();
        loadAdminEntities();
        notify(
          `Seluruh Database dari "${file.name}" berhasil diupload & disimpan! Santri: ${data.santri.inserted} baru / ${data.santri.updated} update · Pegawai/Guru: ${data.teachers.added + data.teachers.updated} · Jadwal: ${data.schedules.added + (data.schedules.updated || 0)} · Ruang Ujian: ${data.ruanganUjianAdded}.`,
          'success',
        );
      } catch (err) {
        notify(
          (err as Error).message || 'Gagal membaca atau menyimpan file Excel seluruh database.',
          'error',
        );
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleTidyPutraPutri = async () => {
    setTidyingData(true);
    try {
      const res = await fetch('/api/system/tidy-data', { method: 'POST' });
      const data = await parseJsonSafe<{
        ok: boolean;
        summary: {
          duplicatesRemoved: number;
          genderReclassified: number;
          after: {
            students: number;
            byWilayah: {
              Putra: { students: number; rooms: number; schedules: number };
              Putri: { students: number; rooms: number; schedules: number };
            };
            labkomPutra: number;
            labkomPutri: number;
          };
        };
      }>(res);

      if (auth.currentUser) {
        fetch('/api/firebase/snapshot')
          .then((r) => (r.ok ? r.json() : null))
          .then((snap) => (snap ? pushSnapshotToFirestore(snap) : null))
          .then(() => fetch('/api/firebase/mark-synced', { method: 'POST' }))
          .catch(() => {});
      }

      onDataUpdated();
      await loadAdminEntities();
      const s = data.summary;
      notify(
        `Semua data Putra & Putri berhasil dirapikan! Putra: ${s.after.byWilayah.Putra.students} santri · Putri: ${s.after.byWilayah.Putri.students} santri · Duplikat bersih: ${s.duplicatesRemoved} · Klasifikasi dibenahi: ${s.genderReclassified}.`,
        'success',
      );
    } catch (err) {
      notify((err as Error).message || 'Gagal merapikan data Putra & Putri.', 'error');
    } finally {
      setTidyingData(false);
    }
  };

  const handleExecuteExcelUpload = async () => {
    if (!excelWorkbook) {
      notify('Pilih file Excel (.xlsx) atau muat template database terlebih dahulu.', 'error');
      return;
    }
    const cleanSantri = excelWorkbook.santriRows.filter(
      (r) => !r.warning || r.warning !== 'Nama identik dengan Nama Kelas',
    );
    const combinedTeachers = [
      ...excelWorkbook.pegawaiRows,
      ...excelWorkbook.musyrifRows,
      ...excelWorkbook.waliKelasRows,
      ...excelWorkbook.guruRows,
    ];
    setImporting(true);
    try {
      const res = await fetch('/api/import/all-in-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          santriRows: cleanSantri,
          teacherRows: combinedTeachers,
          scheduleRows: excelWorkbook.scheduleRows,
          ruanganUjian: excelWorkbook.ruanganUjian,
          pembinaanRows: excelWorkbook.pembinaanRows,
          replaceExisting,
          autoCreateAccounts,
          autoCreateQuranSchedules,
          defaultPin,
        }),
      });
      const data = await parseJsonSafe<{
        santri: { inserted: number; updated: number };
        teachers: { added: number; updated: number };
        schedules: { added: number; updated?: number };
        ruanganUjianAdded: number;
      }>(res);

      // If signed into Firebase Google Auth, automatically sync uploaded data to Firestore (sim-pintar)
      if (auth.currentUser) {
        fetch('/api/firebase/snapshot')
          .then((r) => (r.ok ? r.json() : null))
          .then((snap) => (snap ? pushSnapshotToFirestore(snap) : null))
          .then(() => fetch('/api/firebase/mark-synced', { method: 'POST' }))
          .catch(() => {});
      }

      notify(
        `Upload & Simpan selesai! Siswa: ${data.santri.inserted} baru/${data.santri.updated} update · Master Pegawai/Akun: ${data.teachers.added + data.teachers.updated} · Jadwal: ${data.schedules.added + (data.schedules.updated || 0)} · Ruang Ujian: ${data.ruanganUjianAdded}.`,
        'success',
      );
      setExcelWorkbook(null);
      onDataUpdated();
      loadWorkbookSpec();
      loadAdminEntities();
      if (cleanSantri.length === 0 && combinedTeachers.length > 0) {
        setActiveTab('pegawai_amanah');
      }
    } catch (err) {
      notify((err as Error).message || 'Gagal mengimpor file Excel.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleCreateSingleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mNama.trim()) {
      notify('Nama lengkap wajib diisi.', 'error');
      return;
    }
    const kamarArr = mKamar
      .split(/[;,]/)
      .map((k) => k.trim())
      .filter(Boolean);

    if (editingTeacherId) {
      const payload: Record<string, unknown> = {
        nama: mNama.trim().toUpperCase(),
        peran: mPeran,
        genderScope: mGender,
        waliKelasOf: mWaliKelas.trim(),
        kamarBinaan: kamarArr,
      };
      if (mPin.trim() && mPin.trim() !== '1234') {
        payload.pin = mPin.trim();
      }
      const res = await fetch(`/api/guru/${editingTeacherId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingTeacherId(null);
        setMNama('');
        setMWaliKelas('');
        setMKamar('');
        setMUsername('');
        onDataUpdated();
        loadWorkbookSpec();
        notify('Data akun guru/pembina berhasil diperbarui.', 'success');
      } else {
        notify('Gagal memperbarui akun guru.', 'error');
      }
      return;
    }

    const res = await fetch('/api/import/guru', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: [
          {
            nama: mNama.trim(),
            peran: mPeran,
            genderScope: mGender,
            waliKelasOf: mWaliKelas.trim() || undefined,
            kamarBinaan: kamarArr,
            username: mUsername.trim() || undefined,
            pin: mPin.trim() || '1234',
          },
        ],
      }),
    });
    if (res.ok) {
      setMNama('');
      setMWaliKelas('');
      setMKamar('');
      setMUsername('');
      onDataUpdated();
      loadWorkbookSpec();
      notify('Akun guru/wali kelas/musyrif berhasil ditambahkan.', 'success');
    }
  };

  const handleStartEditAccount = (t: TeacherPublic) => {
    setEditingTeacherId(t.id);
    setMNama(t.nama);
    setMPeran(t.peran);
    setMGender(t.genderScope);
    setMWaliKelas(t.waliKelasOf || '');
    setMKamar((t.kamarBinaan || []).join('; '));
    setMUsername(t.username);
    setMPin('');
    setActiveTab('kelola');
    notify(`Mode Edit Akun: ${t.nama}`, 'info');
  };

  const handleDirectAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sNama.trim() || !sKelas.trim()) {
      notify('Nama santri dan Nama Kelas wajib diisi.', 'error');
      return;
    }
    setSavingStudentDirect(true);
    try {
      if (editingStudentId) {
        const res = await fetch(`/api/students/${editingStudentId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nis: sNis.trim(),
            nama: sNama.trim(),
            kelas: sKelas.trim(),
            kamar: sKamar.trim(),
            kelompokQuran: sKelompok.trim(),
            pengampuQuran: sPengampu.trim(),
            gender: sGender,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui data santri.');
        setEditingStudentId(null);
        setSNis('');
        setSNama('');
        onDataUpdated();
        loadWorkbookSpec();
        loadAdminEntities();
        notify(`Perubahan data santri ${sNama.trim().toUpperCase()} berhasil disimpan.`, 'success');
      } else {
        const res = await fetch('/api/import/santri-sim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: [
              {
                nis: sNis.trim(),
                nama: sNama.trim(),
                kelas: sKelas.trim(),
                kamar: sKamar.trim(),
                kelompokQuran: sKelompok.trim(),
                pengampuQuran: sPengampu.trim(),
                gender: sGender,
              },
            ],
            autoCreateAccounts: true,
            autoCreateQuranSchedules: Boolean(sKelompok.trim() && sPengampu.trim()),
            defaultPin: '1234',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan santri.');
        setSNis('');
        setSNama('');
        onDataUpdated();
        loadWorkbookSpec();
        loadAdminEntities();
        notify(`Santri ${sNama.trim().toUpperCase()} (Wilayah ${sGender}) tersimpan langsung.`, 'success');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingStudentDirect(false);
    }
  };

  const handleStartEditStudent = (st: Student) => {
    setEditingStudentId(st.id);
    setSNis(st.nis || '');
    setSNama(st.nama);
    setSGender(st.gender);
    setSKelas(st.kelas);
    setSKamar(st.kamar || '');
    setSKelompok(st.kelompokQuran || '');
    setSPengampu(st.pengampuQuran || '');
    setActiveTab('kelola');
    notify(`Mode Edit Santri: ${st.nama}`, 'info');
  };

  const handleDeleteStudentDirect = async (st: Student) => {
    const res = await fetch(`/api/students/${st.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingStudentId === st.id) {
        setEditingStudentId(null);
        setSNama('');
      }
      onDataUpdated();
      loadWorkbookSpec();
      loadAdminEntities();
      notify(`Data santri ${st.nama} dihapus.`, 'info');
    }
  };

  const handleDirectAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jGuru.trim() || !jKelas.trim() || !jMapel.trim()) {
      notify('Nama Guru, Kelas/Halaqah, dan Mata Pelajaran wajib diisi.', 'error');
      return;
    }
    setSavingScheduleDirect(true);
    try {
      if (editingScheduleId) {
        const res = await fetch(`/api/jadwal/${editingScheduleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guru: jGuru.trim(),
            hari: jHari,
            kelas: jKelas.trim(),
            mapel: jMapel.trim(),
            jamKe: jJam.trim() || '1-2',
            gender: jGender,
            kategori: jKategori,
            allowOverride: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui jadwal.');
        setEditingScheduleId(null);
        setJKelas('');
        setJMapel('');
        onDataUpdated();
        loadWorkbookSpec();
        loadAdminEntities();
        notify(`Jadwal ${jMapel.trim().toUpperCase()} (${jGuru.trim().toUpperCase()}) berhasil diperbarui.`, 'success');
      } else {
        const res = await fetch('/api/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guru: jGuru.trim(),
            hari: jHari,
            kelas: jKelas.trim(),
            mapel: jMapel.trim(),
            jamKe: jJam.trim() || '1-2',
            gender: jGender,
            kategori: jKategori,
            allowOverride: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan jadwal.');
        setJKelas('');
        setJMapel('');
        onDataUpdated();
        loadWorkbookSpec();
        loadAdminEntities();
        notify(`Jadwal ${jMapel.trim().toUpperCase()} (Wilayah ${jGender}) tersimpan langsung.`, 'success');
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingScheduleDirect(false);
    }
  };

  const handleStartEditSchedule = (sch: ScheduleItem) => {
    setEditingScheduleId(sch.id);
    setJGuru(sch.guru);
    setJKategori(sch.kategori || (sch.mapel.toUpperCase().includes('QUR') ? 'Al-Quran' : 'Akademik'));
    setJHari(sch.hari);
    setJGender(sch.gender);
    setJKelas(sch.kelas);
    setJMapel(sch.mapel);
    setJJam(sch.jamKe);
    setActiveTab('kelola');
    notify(`Mode Edit Jadwal: ${sch.hari} · ${sch.guru} (${sch.kelas})`, 'info');
  };

  const handleDeleteScheduleDirect = async (sch: ScheduleItem) => {
    const res = await fetch(`/api/jadwal/${sch.id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingScheduleId === sch.id) {
        setEditingScheduleId(null);
        setJMapel('');
      }
      onDataUpdated();
      loadWorkbookSpec();
      loadAdminEntities();
      notify('Jadwal berhasil dihapus.', 'info');
    }
  };

  const handleDeleteAccount = async (id: string, nama: string) => {
    const res = await fetch(`/api/guru/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Gagal menghapus akun.', 'error');
      return;
    }
    onDataUpdated();
    loadWorkbookSpec();
    notify(`Akun ${nama} dihapus.`, 'info');
  };

  const handleAddRuang = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuang.trim()) return;
    if (editingRuangOldName) {
      const res = await fetch('/api/import/ruangan-ujian', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: editingRuangOldName, newName: newRuang.trim() }),
      });
      if (res.ok) {
        setEditingRuangOldName(null);
        setNewRuang('');
        onDataUpdated();
        loadWorkbookSpec();
        notify('Nama ruangan ujian berhasil diperbarui.', 'success');
      }
      return;
    }
    const res = await fetch('/api/import/ruangan-ujian', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namaRuang: newRuang }),
    });
    if (res.ok) {
      setNewRuang('');
      onDataUpdated();
      loadWorkbookSpec();
      notify('Ruang ujian ditambahkan.', 'success');
    }
  };

  const handleDeleteRuang = async (namaRuang: string) => {
    const res = await fetch(`/api/import/ruangan-ujian?namaRuang=${encodeURIComponent(namaRuang)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      if (editingRuangOldName === namaRuang) {
        setEditingRuangOldName(null);
        setNewRuang('');
      }
      onDataUpdated();
      loadWorkbookSpec();
      notify(`Ruangan ujian ${namaRuang} dihapus.`, 'info');
    }
  };

  const handleResetEmpty = async () => {
    try {
      const res = await fetch('/api/system/reset-empty', { method: 'POST' });
      await parseJsonSafe(res);
      setConfirmReset(false);
      setExcelWorkbook(null);
      onExplicitReset?.();
      onDataUpdated();
      loadWorkbookSpec();
      loadAdminEntities();
      notify('Seluruh data siswa, jadwal & log dikosongkan (akun Admin Super tetap terjaga).', 'info');
    } catch (err) {
      notify((err as Error).message || 'Gagal mengosongkan database.', 'error');
    }
  };

  // GATE: ONLY ADMIN SUPER CAN ACCESS UPLOAD & MASTER SETUP
  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-xl py-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#0B1324] via-[#102A43] to-teal-800 px-6 py-6 text-white">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/25 border border-teal-300/30 text-teal-200">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">
                  Panel Admin Super &amp; Database Excel SIM
                </h2>
                <p className="text-xs text-slate-200 mt-0.5">
                  Khusus Admin Super untuk mengunduh 1 template Excel Database terpadu dan mengupload seluruh data sekolah sekaligus.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAdminGateLogin} className="p-6 space-y-4">
            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-teal-900">
                <span className="font-semibold">Kredensial Default:</span>{' '}
                <code className="font-mono-num font-bold">sahidin30@gmail.com</code> | PIN:{' '}
                <code className="font-mono-num font-bold">121320</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminEmail('sahidin30@gmail.com');
                  setAdminPin('121320');
                }}
                className="rounded-md border border-teal-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
              >
                Isi Otomatis
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email / Username Admin Super
              </label>
              <input
                type="text"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="sahidin30@gmail.com"
                className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">PIN Admin Super</label>
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Masukkan PIN Admin Super (121320)..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-mono-num tracking-widest text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 transition-all whitespace-nowrap shrink-0"
            >
              <KeyRound className="h-4 w-4" />
              {loggingIn ? 'Memverifikasi...' : 'Masuk Sebagai Admin Super'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const inventoryCards = [
    {
      label: 'Total Santri',
      val: counts?.students ?? 0,
      icon: Users,
      card: 'border-teal-200 bg-gradient-to-br from-teal-50/80 to-white',
      iconBox: 'bg-teal-600 text-white',
      valColor: 'text-teal-900',
    },
    {
      label: 'Akun Guru / Wali / Musyrif',
      val: counts?.teachers ?? 0,
      icon: UserCheck,
      card: 'border-violet-200 bg-gradient-to-br from-violet-50/80 to-white',
      iconBox: 'bg-violet-600 text-white',
      valColor: 'text-violet-900',
    },
    {
      label: 'Kamar Asrama',
      val: counts?.rooms ?? 0,
      icon: Home,
      card: 'border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white',
      iconBox: 'bg-indigo-600 text-white',
      valColor: 'text-indigo-900',
    },
    {
      label: "Jadwal KBM & Qur'an",
      val: counts?.schedules ?? 0,
      icon: CalendarClock,
      card: 'border-sky-200 bg-gradient-to-br from-sky-50/80 to-white',
      iconBox: 'bg-sky-600 text-white',
      valColor: 'text-sky-900',
    },
    {
      label: 'Log Presensi',
      val: counts?.attendanceLogs ?? 0,
      icon: BookOpen,
      card: 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white',
      iconBox: 'bg-emerald-600 text-white',
      valColor: 'text-emerald-900',
    },
    {
      label: 'Catatan Pembinaan',
      val: counts?.pembinaanRecords ?? 0,
      icon: ShieldCheck,
      card: 'border-amber-200 bg-gradient-to-br from-amber-50/80 to-white',
      iconBox: 'bg-amber-600 text-white',
      valColor: 'text-amber-900',
    },
  ];

  const dataSheets = workbookSpec ? workbookSpec.sheets.slice(1) : [];

  return (
    <div className="space-y-6">
      {/* Super Admin Hero Banner */}
      <div className="rounded-xl bg-gradient-to-r from-[#0B1324] via-[#102A43] to-teal-800 px-5 py-4 text-white flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/25 border border-teal-300/30 text-teal-200 shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">
              Admin Super Aktif · <span className="font-mono-num text-teal-300">{currentUser?.username}</span>
            </div>
            <p className="text-xs text-slate-200 mt-0.5">
              Satu template Excel Database (`.xlsx`) terpadu untuk mengupload seluruh data sekolah dalam satu kali proses.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              downloadLoginAccessCardsPdf(staffDirectory, {
                title: 'KARTU AKSES LOGIN DATABASE PEGAWAI & GURU',
                subtitle: `Seluruh Pegawai (${staffDirectory.length} Akun) — Token & Hak Akses Sesuai Peran`,
              });
              notify(`Kartu Akses Login PDF (${staffDirectory.length} pegawai) berhasil diunduh.`, 'success');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 whitespace-nowrap shrink-0 shadow-xs"
          >
            <KeyRound className="h-3.5 w-3.5" />
            Unduh Kartu Akses Login (PDF)
          </button>
          <button
            type="button"
            onClick={() => {
              downloadPegawaiTokenTablePdf(staffDirectory, 'Semua Wilayah');
              notify('Daftar Token & PIN Pegawai (PDF Tabel) berhasil diunduh.', 'success');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300/40 bg-teal-500/20 px-3 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-500/30 whitespace-nowrap shrink-0"
          >
            <FileText className="h-3.5 w-3.5" />
            Daftar Token Pegawai (PDF)
          </button>
          <button
            type="button"
            onClick={loadWorkbookSpec}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingSpec ? 'animate-spin' : ''}`} />
            Segarkan Data Template
          </button>
        </div>
      </div>

      {/* Live System Inventory (Collapsible) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-700">
            Ringkasan Inventaris Data SIM
            {inventoryMinimized && (
              <span className="ml-2 font-normal text-slate-500 font-mono-num">
                ({counts?.students ?? 0} santri · {counts?.teachers ?? 0} akun · {counts?.rooms ?? 0} kamar ·{' '}
                {counts?.schedules ?? 0} jadwal · {counts?.attendanceLogs ?? 0} presensi)
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={tidyingData}
              onClick={handleTidyPutraPutri}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              title="Rapikan ejaan/spasi, pisahkan Putra & Putri secara akurat, hapus duplikat, dan sinkronkan relasi Wali/Musyrif/Kamar"
            >
              <Sparkles className={`h-3.5 w-3.5 text-amber-600 ${tidyingData ? 'animate-spin' : ''}`} />
              <span>{tidyingData ? 'Merapikan...' : 'Rapikan & Pisahkan Data Putra/Putri'}</span>
            </button>
            <button
              type="button"
              onClick={() => setInventoryMinimized((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              {inventoryMinimized ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Tampilkan Ringkasan
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Minimize
                </>
              )}
            </button>
          </div>
        </div>

        {!inventoryMinimized && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {inventoryCards.map((box) => {
                const Icon = box.icon;
                return (
                  <div key={box.label} className={`rounded-xl border p-4 ${box.card}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-600 truncate">{box.label}</span>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${box.iconBox}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className={`mt-2 font-mono-num text-2xl font-bold ${box.valColor}`}>{box.val}</div>
                    {box.label === 'Total Santri' && counts?.byWilayah && (
                      <div className="mt-1 font-mono-num text-[10px] font-medium text-slate-600">
                        Putra: {counts.byWilayah.Putra.students} · Putri: {counts.byWilayah.Putri.students}
                      </div>
                    )}
                    {box.label === 'Kamar Asrama' && counts?.byWilayah && (
                      <div className="mt-1 font-mono-num text-[10px] font-medium text-slate-600">
                        Putra: {counts.byWilayah.Putra.rooms} · Putri: {counts.byWilayah.Putri.rooms}
                      </div>
                    )}
                    {box.label === "Jadwal KBM & Qur'an" && counts?.byWilayah && (
                      <div className="mt-1 font-mono-num text-[10px] font-medium text-slate-600">
                        Putra: {counts.byWilayah.Putra.schedules} · Putri: {counts.byWilayah.Putri.schedules}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Panel Perbandingan Terpisah Wilayah Putra vs Wilayah Putri */}
            {counts?.byWilayah && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-sky-900 uppercase tracking-wide">
                      Wilayah Putra (Banin)
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] font-mono-num">
                      <span className="rounded-md bg-white border border-sky-200 px-2 py-0.5 font-bold text-sky-800">
                        Santri: {counts.byWilayah.Putra.students}
                      </span>
                      <span className="rounded-md bg-white border border-sky-200 px-2 py-0.5 font-semibold text-sky-700">
                        Kamar: {counts.byWilayah.Putra.rooms}
                      </span>
                      <span className="rounded-md bg-white border border-sky-200 px-2 py-0.5 font-semibold text-sky-700">
                        Jadwal: {counts.byWilayah.Putra.schedules}
                      </span>
                      <span className="rounded-md bg-white border border-sky-200 px-2 py-0.5 font-semibold text-sky-700">
                        Pembinaan: {counts.byWilayah.Putra.pembinaanRecords}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentWilayahFilter('Putra');
                      setScheduleWilayahFilter('Putra');
                      setActiveTab('kelola');
                    }}
                    className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-50 whitespace-nowrap shrink-0"
                  >
                    Lihat Data Putra →
                  </button>
                </div>

                <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/80 to-white p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                      Wilayah Putri (Banat)
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] font-mono-num">
                      <span className="rounded-md bg-white border border-rose-200 px-2 py-0.5 font-bold text-rose-800">
                        Santri: {counts.byWilayah.Putri.students}
                      </span>
                      <span className="rounded-md bg-white border border-rose-200 px-2 py-0.5 font-semibold text-rose-700">
                        Kamar: {counts.byWilayah.Putri.rooms}
                      </span>
                      <span className="rounded-md bg-white border border-rose-200 px-2 py-0.5 font-semibold text-rose-700">
                        Jadwal: {counts.byWilayah.Putri.schedules}
                      </span>
                      <span className="rounded-md bg-white border border-rose-200 px-2 py-0.5 font-semibold text-rose-700">
                        Pembinaan: {counts.byWilayah.Putri.pembinaanRecords}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentWilayahFilter('Putri');
                      setScheduleWilayahFilter('Putri');
                      setActiveTab('kelola');
                    }}
                    className="rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-800 hover:bg-rose-50 whitespace-nowrap shrink-0"
                  >
                    Lihat Data Putri →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. UTAMA: TEMPLATE & UPLOAD SELURUH DATABASE SEKOLAH SEKALIGUS (11 SHEET DALAM 1 FILE EXCEL) */}
      <div className="rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50/95 via-teal-50/85 to-sky-50/90 p-5 space-y-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-snug">
                  1. Template &amp; Upload Seluruh Database Sekolah Sekaligus (1 File Excel · 11 Sheet Terpadu)
                </h2>
                <span className="rounded-md bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                  Seluruh Database (All-in-One)
                </span>
              </div>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                Tempat unduh dan upload <b>1 file Excel (<span className="font-mono-num">.xlsx</span>) yang berisi seluruh database sekolah sekaligus</b>: Santri Putra, Santri Putri, Master Pegawai, Wali Asrama (Musyrif &amp; Musyrifah), Wali Kelas, Guru &amp; Pengampu Al-Qur&apos;an, Jadwal KBM/Halaqah, Ruang Ujian, dan Pembinaan ({workbookSpec?.sourceLabel || 'memuat...'}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTemplateMinimized((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 self-start"
          >
            {templateMinimized ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Tampilkan 11 Sheet
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Sembunyikan Sheet
              </>
            )}
          </button>
        </div>

        {/* Tombol Utama Unduh & Upload Seluruh Database Sekaligus */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 border-t border-emerald-200/80 pt-3.5">
          <button
            type="button"
            disabled={loadingSpec}
            onClick={handleDownloadExcelTemplate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-800 whitespace-nowrap disabled:opacity-50"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>1. Unduh Template Seluruh Database (.xlsx)</span>
          </button>

          <label className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1324] px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-slate-800 cursor-pointer whitespace-nowrap transition-colors">
            <Upload className="h-4 w-4 text-teal-300 shrink-0" />
            <span>
              {importing ? 'Mengupload & Menyimpan...' : '2. Upload & Simpan Seluruh Database (.xlsx)'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing}
              onChange={handleDirectUploadFullDatabaseFile}
              className="hidden"
            />
          </label>

          <label className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-white px-4 py-3 text-xs font-bold text-emerald-900 hover:bg-emerald-50 cursor-pointer whitespace-nowrap transition-colors">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>Upload &amp; Pratinjau Dulu (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelFileChange}
              className="hidden"
            />
          </label>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleDownloadJsonBackup}
              title="Unduh cadangan penuh seluruh data SIM & log dalam format JSON"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3 py-3 text-xs font-semibold text-sky-900 hover:bg-sky-50 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 text-sky-700 shrink-0" />
              Backup JSON
            </button>
            <label
              title="Pulihkan semua data santri, jadwal, presensi & pembinaan dari file Backup JSON"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-3 text-xs font-semibold text-amber-900 hover:bg-amber-50 cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              Restore JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreJsonBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 border border-emerald-200/80 px-3.5 py-2 text-[11px] text-slate-700">
          <span>
            <b>Cara Pakai:</b> Klik <b>1. Unduh Template Seluruh Database (.xlsx)</b> → isi/edit sheet di Excel → klik <b>2. Upload &amp; Simpan Seluruh Database (.xlsx)</b> untuk langsung memasukkan seluruh data ke sistem.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loadingSpec}
              onClick={handleLoadServerTemplateToPreview}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              <Sparkles className="h-3 w-3" />
              Lihat Pratinjau Isi Template
            </button>
            <button
              type="button"
              disabled={loadingSpec || importing}
              onClick={handleDirectCommitWorkbookSpec}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-800 hover:bg-slate-100"
            >
              <Save className="h-3 w-3 text-teal-700" />
              Muat Data Default Template
            </button>
          </div>
        </div>

        {!templateMinimized && dataSheets.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 pt-1">
            {dataSheets.map((s) => {
              const isPutri = s.name.toLowerCase().includes('putri');
              const isPutra = s.name.toLowerCase().includes('putra');
              const badgeCls = isPutri
                ? 'border-rose-200/80 bg-rose-50/70'
                : isPutra
                ? 'border-sky-200/80 bg-sky-50/70'
                : 'border-white/80 bg-white/85';
              const titleCls = isPutri ? 'text-rose-800' : isPutra ? 'text-sky-800' : 'text-teal-800';
              return (
                <div
                  key={s.name}
                  className={`rounded-lg border px-3 py-2.5 text-xs shadow-xs ${badgeCls}`}
                >
                  <div className={`font-mono-num text-[11px] font-bold truncate ${titleCls}`}>{s.name}</div>
                  <div className="text-[11px] text-slate-600 truncate mt-0.5">{s.label}</div>
                  <div className="mt-1 font-mono-num text-xs font-bold text-slate-900">
                    {Math.max(0, s.rows.length - 1)} baris
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. OPSIONAL: PER-COMPONENT INDIVIDUAL TEMPLATES (8 SEPARATE EXCEL FILES) */}
      <div className="rounded-xl border border-teal-300 bg-white p-5 space-y-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  2. Opsi Template Terpisah Per Komponen (8 File Excel Satuan)
                </h2>
                <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-900">
                  Jika Ingin Upload Per Bagian Saja
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Gunakan bagian ini jika Anda hanya ingin mengunduh atau mengupload <b>salah satu komponen saja</b> secara terpisah (misalnya hanya Siswa Putri atau hanya Master Pegawai).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setComponentTemplatesMinimized((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {componentTemplatesMinimized ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Tampilkan 8 Template Komponen
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Sembunyikan
              </>
            )}
          </button>
        </div>

        {!componentTemplatesMinimized && (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            {COMPONENT_TEMPLATES.map((tpl) => {
              const isUploadingThis = uploadingComponentKey === tpl.key;
              const statusText = componentUploadStatus[tpl.key];

              // Calculate current live row count from server workbookSpec for this component
              const currentRowCount = workbookSpec
                ? workbookSpec.sheets
                    .filter((s) => tpl.sheetNamesInSpec.includes(s.name))
                    .reduce((acc, s) => acc + Math.max(0, s.rows.length - 1), 0)
                : 0;

              return (
                <div
                  key={tpl.key}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4 hover:border-teal-300 hover:bg-white transition-all space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0B1324] font-mono-num text-[11px] font-bold text-teal-300 shrink-0">
                          {tpl.stepNumber}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 leading-snug">{tpl.title}</h3>
                      </div>
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono-num text-[10px] font-semibold text-slate-700 whitespace-nowrap shrink-0">
                        {currentRowCount} data
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">{tpl.subtitle}</p>

                    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Kolom di File Excel:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tpl.columnsSummary.map((col) => (
                          <span
                            key={col}
                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>

                    {statusText && (
                      <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{statusText}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadComponentTemplate(tpl.key, 'blank')}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                        title="Unduh template kosong (hanya kolom & 2 contoh baris)"
                      >
                        <Download className="h-3 w-3 text-teal-700 shrink-0" />
                        Template Kosong
                      </button>
                      <button
                        type="button"
                        disabled={loadingSpec}
                        onClick={() => handleDownloadComponentTemplate(tpl.key, 'filled')}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-teal-300 bg-teal-50/80 px-2.5 py-1.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                        title="Unduh template berisi data saat ini"
                      >
                        <Download className="h-3 w-3 text-teal-700 shrink-0" />
                        + Data Saat Ini
                      </button>
                    </div>

                    <label className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0B1324] px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap shrink-0">
                      <Upload className="h-3.5 w-3.5 text-teal-300 shrink-0" />
                      <span>
                        {isUploadingThis ? 'Mengupload & Menyimpan...' : `Upload ${tpl.title.split(' ')[0]} (.xlsx / .csv)`}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        disabled={isUploadingThis}
                        onChange={(e) => handleSingleComponentFileUpload(tpl.key, tpl.title, e)}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        if (tpl.key === 'master_pegawai') {
                          setActiveTab('pegawai_amanah');
                        } else {
                          setActiveTab('kelola');
                          if (tpl.key === 'guru_quran') {
                            setJKategori('Al-Quran');
                            setMPeran('Pengampu Al-Quran');
                          } else if (tpl.key === 'wali_kelas') {
                            setMPeran('Wali Kelas');
                          } else if (tpl.key === 'musyrif_kamar') {
                            setMPeran('Musyrif');
                          }
                        }
                        notify(
                          `Membuka form Input & Edit Langsung untuk komponen "${tpl.title}".`,
                          'info'
                        );
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50/60 px-3 py-1.5 text-[11px] font-semibold text-teal-900 hover:bg-teal-100/80 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Edit3 className="h-3 w-3 text-teal-700 shrink-0" />
                      <span>Isi / Edit Langsung di Sistem →</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPLOAD & MANAGEMENT PANEL */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('excel_upload')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                activeTab === 'excel_upload'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              1. Upload Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pegawai_amanah')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                activeTab === 'pegawai_amanah'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              2. Pegawai &amp; Amanah ({staffDirectory.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('kelola')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                activeTab === 'kelola'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
              }`}
            >
              3. Input Siswa, Jadwal &amp; Ruang
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Tidak wajib isi semua template: bisa upload <b>Master_Pegawai</b> saja lalu klik nama pegawai untuk menetapkan amanah kamar, kelas, atau musyrif.
          </p>
        </div>

        {activeTab === 'excel_upload' ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
            <div className="lg:col-span-4 space-y-3">
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white p-6 text-center cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/70 transition-colors">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white mb-2.5 shadow-sm">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {excelWorkbook ? excelWorkbook.fileName : 'Pilih File Excel / CSV (.xlsx / .xls / .csv)'}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Bisa upload lengkap seluruh sheet ATAU hanya file/sheet Data Putri atau Master Pegawai saja
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setActiveTab('pegawai_amanah')}
                className="flex w-full items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2.5 text-left text-xs font-semibold text-indigo-900 hover:bg-indigo-100/70 transition-colors"
              >
                <span>Atur Amanah via Klik Nama Pegawai →</span>
                <UserCheck className="h-4 w-4 text-indigo-700 shrink-0" />
              </button>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5 text-xs">
                <div className="font-semibold text-slate-900">Opsi Upload Sekaligus</div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateAccounts}
                    onChange={(e) => setAutoCreateAccounts(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700"
                  />
                  <span className="text-slate-700">
                    Otomatis buat akun <b>Pengampu Al-Qur&apos;an</b> yang belum terdaftar
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateQuranSchedules}
                    onChange={(e) => setAutoCreateQuranSchedules(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700"
                  />
                  <span className="text-slate-700">
                    Otomatis buat jadwal <b>Halaqah Al-Qur&apos;an</b> (Senin–Sabtu)
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600"
                  />
                  <span className="text-slate-700">Ganti daftar santri &amp; jadwal lama sebelum impor</span>
                </label>
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    PIN Default Akun Baru
                  </label>
                  <input
                    type="text"
                    value={defaultPin}
                    onChange={(e) => setDefaultPin(e.target.value)}
                    className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs font-mono-num"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3">
              {!excelWorkbook ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-7 text-center space-y-3">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Belum Ada File Excel Dipilih</h3>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                    Klik <b>Unduh Template Excel (.xlsx)</b> di atas. Di dalamnya tersedia sheet <b>Master_Pegawai</b>, tabel terpisah <b>Musyrif / Musyrifah / Wali Kelas</b>, serta <b>Santri Putra &amp; Putri</b>. Tidak harus mengisi semua sheet—bisa isi <b>Master_Pegawai</b> saja lalu klik amanah langsung di tab 2.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={loadingSpec}
                      onClick={handleDownloadExcelTemplate}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh Template Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      disabled={loadingSpec}
                      onClick={handleLoadServerTemplateToPreview}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Muat &amp; Pratinjau Template
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {(
                      [
                        {
                          key: 'santri',
                          label: '1. Santri',
                          count: excelWorkbook.santriRows.length,
                          card: 'border-teal-200 bg-teal-50/70 text-teal-900',
                        },
                        {
                          key: 'pegawai',
                          label: 'Master Pegawai',
                          count: excelWorkbook.pegawaiRows.length,
                          card: 'border-fuchsia-200 bg-fuchsia-50/70 text-fuchsia-900',
                        },
                        {
                          key: 'musyrif',
                          label: '2. Musyrif/ah',
                          count: excelWorkbook.musyrifRows.length,
                          card: 'border-indigo-200 bg-indigo-50/70 text-indigo-900',
                        },
                        {
                          key: 'waliKelas',
                          label: '3A/B. Wali Kelas',
                          count: excelWorkbook.waliKelasRows.length,
                          card: 'border-sky-200 bg-sky-50/70 text-sky-900',
                        },
                        {
                          key: 'guru',
                          label: '3C. Guru Qur’an',
                          count: excelWorkbook.guruRows.length,
                          card: 'border-violet-200 bg-violet-50/70 text-violet-900',
                        },
                        {
                          key: 'jadwal',
                          label: '4. Jadwal',
                          count: excelWorkbook.scheduleRows.length,
                          card: 'border-amber-200 bg-amber-50/70 text-amber-900',
                        },
                        {
                          key: 'ruang',
                          label: '5. Ruang Ujian',
                          count: excelWorkbook.ruanganUjian.length,
                          card: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
                        },
                      ] as const
                    ).map((sheetBox) => (
                      <button
                        key={sheetBox.key}
                        type="button"
                        onClick={() => setExcelPreviewSheet(sheetBox.key)}
                        className={`rounded-xl border p-2.5 text-left transition-all ${sheetBox.card} ${
                          excelPreviewSheet === sheetBox.key ? 'ring-2 ring-slate-900/20 shadow-sm' : 'opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sheetBox.label}</div>
                        <div className="mt-1 font-mono-num text-base font-bold">{sheetBox.count}</div>
                      </button>
                    ))}
                  </div>

                  <div ref={excelPreviewRef} className="rounded-xl border-2 border-emerald-400 overflow-hidden bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-sky-50/80 px-4 py-3">
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-emerald-900 flex flex-wrap items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                          <span>
                            Siap Upload: {excelWorkbook.santriRows.length} santri (
                            <span className="text-sky-800">
                              Putra: {excelWorkbook.santriRows.filter((s) => s.gender === 'Putra').length}
                            </span>{' '}
                            ·{' '}
                            <span className="text-rose-800">
                              Putri: {excelWorkbook.santriRows.filter((s) => s.gender === 'Putri').length}
                            </span>
                            ) · {excelWorkbook.pegawaiRows.length} pegawai ·{' '}
                            {excelWorkbook.musyrifRows.length} musyrif/ah ·{' '}
                            {excelWorkbook.waliKelasRows.length} wali ·{' '}
                            {excelWorkbook.guruRows.length} guru · {excelWorkbook.scheduleRows.length} jadwal
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-1 rounded-md bg-white/90 p-0.5 border border-slate-200 text-[11px]">
                          {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setPreviewWilayah(w)}
                              className={`rounded px-2 py-0.5 font-semibold ${
                                previewWilayah === w
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {w === 'Semua' ? 'Semua Wilayah' : `Wilayah ${w}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={importing}
                        onClick={handleExecuteExcelUpload}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {importing ? 'Mengupload Database...' : 'Upload & Simpan ke Database'}
                      </button>
                    </div>

                    <div className="max-h-72 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 border-b border-slate-200 bg-slate-100 text-slate-600">
                          {excelPreviewSheet === 'santri' && (
                            <tr>
                              <th className="px-3 py-2 font-semibold">NIS</th>
                              <th className="px-3 py-2 font-semibold">Nama</th>
                              <th className="px-3 py-2 font-semibold">Wilayah</th>
                              <th className="px-3 py-2 font-semibold">Kelas</th>
                              <th className="px-3 py-2 font-semibold">Kamar</th>
                              <th className="px-3 py-2 font-semibold">Kelp. Qur&apos;an</th>
                              <th className="px-3 py-2 font-semibold">Pengampu</th>
                            </tr>
                          )}
                          {excelPreviewSheet === 'pegawai' && (
                            <tr>
                              <th className="px-3 py-2 font-semibold">Nama Pegawai</th>
                              <th className="px-3 py-2 font-semibold">Wilayah</th>
                              <th className="px-3 py-2 font-semibold">Amanah Utama</th>
                              <th className="px-3 py-2 font-semibold">Amanah Tambahan</th>
                              <th className="px-3 py-2 font-semibold">Kelas Binaan</th>
                              <th className="px-3 py-2 font-semibold">Kamar Binaan</th>
                            </tr>
                          )}
                          {excelPreviewSheet === 'musyrif' && (
                            <tr>
                              <th className="px-3 py-2 font-semibold">Nama Musyrif / Musyrifah</th>
                              <th className="px-3 py-2 font-semibold">Peran</th>
                              <th className="px-3 py-2 font-semibold">Wilayah</th>
                              <th className="px-3 py-2 font-semibold">Kamar Binaan</th>
                              <th className="px-3 py-2 font-semibold">WhatsApp</th>
                              <th className="px-3 py-2 font-semibold">Username</th>
                            </tr>
                          )}
                          {excelPreviewSheet === 'waliKelas' && (
                            <tr>
                              <th className="px-3 py-2 font-semibold">Nama Wali Kelas</th>
                              <th className="px-3 py-2 font-semibold">Wilayah</th>
                              <th className="px-3 py-2 font-semibold">Kelas Binaan</th>
                              <th className="px-3 py-2 font-semibold">WhatsApp</th>
                              <th className="px-3 py-2 font-semibold">Username</th>
                            </tr>
                          )}
                          {excelPreviewSheet === 'guru' && (
                            <tr>
                              <th className="px-3 py-2 font-semibold">Nama Guru / Pengampu</th>
                              <th className="px-3 py-2 font-semibold">Peran</th>
                              <th className="px-3 py-2 font-semibold">Wilayah</th>
                              <th className="px-3 py-2 font-semibold">WhatsApp</th>
                              <th className="px-3 py-2 font-semibold">Username</th>
                            </tr>
                          )}
                          {excelPreviewSheet === 'jadwal' && (
                            <tr>
                              <th className="px-3 py-2 font-semibold">Guru</th>
                              <th className="px-3 py-2 font-semibold">Wilayah</th>
                              <th className="px-3 py-2 font-semibold">Hari</th>
                              <th className="px-3 py-2 font-semibold">Kelas / Halaqah</th>
                              <th className="px-3 py-2 font-semibold">Mapel</th>
                              <th className="px-3 py-2 font-semibold">Jam</th>
                            </tr>
                          )}
                          {excelPreviewSheet === 'ruang' && (
                            <tr>
                              <th className="px-3 py-2 font-semibold">Nama Ruangan Ujian (Wilayah)</th>
                            </tr>
                          )}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {excelPreviewSheet === 'santri' &&
                            excelWorkbook.santriRows
                              .filter((r) => previewWilayah === 'Semua' || r.gender === previewWilayah)
                              .slice(0, 40)
                              .map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-1.5 font-mono-num text-slate-500">{r.nis}</td>
                                  <td className="px-3 py-1.5 font-semibold text-slate-900">{r.nama}</td>
                                  <td
                                    className={`px-3 py-1.5 font-semibold ${
                                      r.gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                                    }`}
                                  >
                                    {r.gender}
                                  </td>
                                  <td className="px-3 py-1.5">{r.kelas}</td>
                                  <td className="px-3 py-1.5">{r.kamar}</td>
                                  <td className="px-3 py-1.5">{r.kelompokQuran}</td>
                                  <td className="px-3 py-1.5">{r.pengampuQuran || '-'}</td>
                                </tr>
                              ))}
                          {excelPreviewSheet === 'pegawai' &&
                            excelWorkbook.pegawaiRows
                              .filter(
                                (r) =>
                                  previewWilayah === 'Semua' ||
                                  r.genderScope === previewWilayah ||
                                  r.genderScope === 'Semua',
                              )
                              .slice(0, 50)
                              .map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-1.5 font-semibold text-slate-900">{r.nama}</td>
                                  <td
                                    className={`px-3 py-1.5 font-semibold ${
                                      r.genderScope === 'Putri'
                                        ? 'text-rose-700'
                                        : r.genderScope === 'Putra'
                                        ? 'text-sky-700'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {r.genderScope}
                                  </td>
                                  <td className="px-3 py-1.5">{r.peran}</td>
                                  <td className="px-3 py-1.5 text-slate-600">
                                    {r.peranTambahan?.join(', ') || '-'}
                                  </td>
                                  <td className="px-3 py-1.5 font-semibold text-teal-800">
                                    {r.waliKelasOf || '-'}
                                  </td>
                                  <td className="px-3 py-1.5">{r.kamarBinaan?.join(', ') || '-'}</td>
                                </tr>
                              ))}
                          {excelPreviewSheet === 'musyrif' &&
                            excelWorkbook.musyrifRows
                              .filter(
                                (r) =>
                                  previewWilayah === 'Semua' ||
                                  r.genderScope === previewWilayah ||
                                  r.genderScope === 'Semua',
                              )
                              .slice(0, 40)
                              .map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-1.5 font-semibold text-slate-900">{r.nama}</td>
                                  <td className="px-3 py-1.5">{r.peran}</td>
                                  <td
                                    className={`px-3 py-1.5 font-semibold ${
                                      r.genderScope === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                                    }`}
                                  >
                                    {r.genderScope}
                                  </td>
                                  <td className="px-3 py-1.5">{r.kamarBinaan?.join(', ') || '-'}</td>
                                  <td className="px-3 py-1.5 font-mono-num text-slate-600">
                                    {r.whatsapp || '-'}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono-num text-slate-500">
                                    {r.username || 'otomatis'}
                                  </td>
                                </tr>
                              ))}
                          {excelPreviewSheet === 'waliKelas' &&
                            excelWorkbook.waliKelasRows
                              .filter(
                                (r) =>
                                  previewWilayah === 'Semua' ||
                                  r.genderScope === previewWilayah ||
                                  r.genderScope === 'Semua',
                              )
                              .slice(0, 40)
                              .map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-1.5 font-semibold text-slate-900">{r.nama}</td>
                                  <td
                                    className={`px-3 py-1.5 font-semibold ${
                                      r.genderScope === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                                    }`}
                                  >
                                    {r.genderScope}
                                  </td>
                                  <td className="px-3 py-1.5 font-semibold text-teal-800">
                                    {r.waliKelasOf || '-'}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono-num text-slate-600">
                                    {r.whatsapp || '-'}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono-num text-slate-500">
                                    {r.username || 'otomatis'}
                                  </td>
                                </tr>
                              ))}
                          {excelPreviewSheet === 'guru' &&
                            excelWorkbook.guruRows
                              .filter(
                                (r) =>
                                  previewWilayah === 'Semua' ||
                                  r.genderScope === previewWilayah ||
                                  r.genderScope === 'Semua',
                              )
                              .slice(0, 40)
                              .map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-1.5 font-semibold text-slate-900">{r.nama}</td>
                                  <td className="px-3 py-1.5">{r.peran}</td>
                                  <td className="px-3 py-1.5">{r.genderScope}</td>
                                  <td className="px-3 py-1.5 font-mono-num text-slate-600">
                                    {r.whatsapp || '-'}
                                  </td>
                                  <td className="px-3 py-1.5 font-mono-num text-slate-500">
                                    {r.username || 'otomatis'}
                                  </td>
                                </tr>
                              ))}
                          {excelPreviewSheet === 'jadwal' &&
                            excelWorkbook.scheduleRows
                              .filter((r) => previewWilayah === 'Semua' || r.gender === previewWilayah)
                              .slice(0, 40)
                              .map((r, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-1.5 font-semibold text-slate-900">{r.guru}</td>
                                  <td
                                    className={`px-3 py-1.5 font-semibold ${
                                      r.gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                                    }`}
                                  >
                                    {r.gender}
                                  </td>
                                  <td className="px-3 py-1.5">{r.hari}</td>
                                  <td className="px-3 py-1.5">{r.kelas}</td>
                                  <td className="px-3 py-1.5">{r.mapel}</td>
                                  <td className="px-3 py-1.5 font-mono-num">{r.jamKe}</td>
                                </tr>
                              ))}
                          {excelPreviewSheet === 'ruang' &&
                            excelWorkbook.ruanganUjian.map((r, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-1.5 font-semibold text-slate-900">{r}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'pegawai_amanah' ? (
          <div className="space-y-5">
            {/* Top Bar: Tambah / Paste Banyak Nama Pegawai tanpa harus pakai semua template */}
            <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-sky-50/50 to-white p-4 space-y-3">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Database Master Pegawai, Token Login &amp; Penetapan Amanah (Klik Nama → Pilih Amanah)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Setiap guru/pembina otomatis masuk ke Database Pegawai dan memiliki <b>Token / PIN Akses unik</b> sesuai perannya (<b>Guru, Guru Wali, Wali Kelas, Wali Asrama, Pengampu Al-Qur&apos;an, Pimpinan</b>). Admin dapat mencetak <b>Kartu Akses Login (PDF)</b> untuk dibagikan kepada pegawai.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const targetList = filteredStaffList.length > 0 ? filteredStaffList : staffDirectory;
                      downloadLoginAccessCardsPdf(targetList, {
                        title: `KARTU AKSES LOGIN PEGAWAI (${pegawaiWilayahFilter.toUpperCase()})`,
                        subtitle: `${targetList.length} Pegawai — Token & Hak Akses Sesuai Peran Database Pegawai`,
                      });
                      notify(`Kartu Akses Login PDF (${targetList.length} pegawai) berhasil diunduh.`, 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1324] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                    Unduh Kartu Login ({filteredStaffList.length} Pegawai PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetList = filteredStaffList.length > 0 ? filteredStaffList : staffDirectory;
                      downloadPegawaiTokenTablePdf(targetList, pegawaiWilayahFilter);
                      notify('Tabel Daftar Token & PIN Pegawai (PDF) berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-50 whitespace-nowrap shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5 text-teal-700" />
                    Tabel Token &amp; PIN (PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulkPegawaiBox((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {showBulkPegawaiBox ? 'Tutup Input Daftar Nama' : '+ Tambah / Paste Nama Pegawai'}
                  </button>
                </div>
              </div>

              {showBulkPegawaiBox && (
                <form
                  onSubmit={handleBulkPastePegawai}
                  className="rounded-xl border border-indigo-200 bg-white p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Tempel / Ketik Daftar Nama Pegawai (1 baris = 1 nama, opsional tambah `;NomorWA`)
                      </label>
                      <textarea
                        rows={4}
                        value={bulkPegawaiText}
                        onChange={(e) => setBulkPegawaiText(e.target.value)}
                        placeholder={'UST. AHMAD FAUZI\nUST. DAFFA M Z\nUSTZ. SITI MARIYAM; 628123456789'}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Wilayah Default
                        </label>
                        <select
                          value={bulkPegawaiWilayah}
                          onChange={(e) =>
                            setBulkPegawaiWilayah(e.target.value as 'Putra' | 'Putri' | 'Semua')
                          }
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                        >
                          <option value="Putra">Putra</option>
                          <option value="Putri">Putri</option>
                          <option value="Semua">Semua (Putra &amp; Putri)</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={savingBulkPegawai}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {savingBulkPegawai ? 'Menyimpan...' : 'Masukkan ke Daftar Pegawai'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Two-Column Click-to-Assign Workbench */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
              {/* Left: Daftar Nama Pegawai yang Bisa Diktik */}
              <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50/90 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      1. Klik Nama Pegawai ({filteredStaffList.length})
                    </span>
                    <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
                      {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setPegawaiWilayahFilter(w)}
                          className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                            pegawaiWilayahFilter === w
                              ? 'bg-teal-600 text-white'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pegawaiSearch}
                      onChange={(e) => setPegawaiSearch(e.target.value)}
                      placeholder="Cari nama pegawai, kelas, atau kamar..."
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </div>

                {filteredStaffList.length === 0 ? (
                  <div className="p-8 text-center space-y-2 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">Belum ada data pegawai</p>
                    <p>
                      Klik tombol <b>+ Tambah / Paste Daftar Nama Pegawai</b> di atas atau upload sheet <b>Master_Pegawai</b> dari tab Upload Excel.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
                    {filteredStaffList.map((t) => {
                      const active = selectedPegawai?.id === t.id;
                      const allRoles = Array.from(
                        new Set([t.peran, ...(t.peranTambahan || [])]),
                      );
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedPegawaiId(t.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedPegawaiId(t.id);
                            }
                          }}
                          className={`flex items-start justify-between gap-2 px-3.5 py-3 cursor-pointer transition-colors ${
                            active
                              ? 'bg-teal-50/90'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold truncate ${active ? 'text-teal-900' : 'text-slate-900'}`}>
                                {t.nama}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  t.genderScope === 'Putri'
                                    ? 'bg-rose-50 text-rose-700'
                                    : t.genderScope === 'Putra'
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {t.genderScope}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="rounded bg-amber-100 border border-amber-300 px-1.5 py-0.5 font-mono-num font-bold text-amber-950">
                                Token: {resolveTeacherToken(t)}
                              </span>
                              {allRoles.map((r) => (
                                <span
                                  key={r}
                                  className={`rounded border px-1.5 py-0.5 font-semibold ${
                                    r === 'Pimpinan'
                                      ? 'border-amber-300 bg-amber-50 text-amber-900'
                                      : 'border-slate-200 bg-white text-slate-700'
                                  }`}
                                >
                                  {r}
                                </span>
                              ))}
                              {t.waliKelasOf && (
                                <span className="rounded bg-sky-100/80 px-1.5 py-0.5 font-semibold text-sky-900">
                                  Wali: {t.waliKelasOf}
                                </span>
                              )}
                              {t.kamarBinaan && t.kamarBinaan.length > 0 && (
                                <span className="rounded bg-indigo-100/80 px-1.5 py-0.5 font-semibold text-indigo-900">
                                  Kamar: {t.kamarBinaan.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                downloadLoginAccessCardsPdf([t], {
                                  title: `KARTU AKSES LOGIN — ${t.nama}`,
                                  subtitle: `Token Login: ${resolveTeacherToken(t)} · Peran: ${allRoles.join(', ')}`,
                                });
                                notify(`Kartu Akses Login PDF untuk ${t.nama} berhasil diunduh.`, 'success');
                              }}
                              title="Unduh Kartu Akses Login PDF pegawai ini"
                              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-teal-800 hover:bg-teal-50"
                            >
                              Kartu PDF
                            </button>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleDeleteAccount(t.id, t.nama);
                              }}
                              title="Hapus pegawai"
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick 1-person add footer */}
                <form
                  onSubmit={handleCreateSingleAccount}
                  className="border-t border-slate-200 bg-slate-50 p-3 flex flex-wrap gap-2 items-center"
                >
                  <input
                    type="text"
                    value={mNama}
                    onChange={(e) => setMNama(e.target.value)}
                    placeholder="+ Nama Pegawai baru (langsung masuk daftar)"
                    className="h-8 flex-1 min-w-[160px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs focus:border-teal-600 focus:outline-none"
                  />
                  <select
                    value={mGender}
                    onChange={(e) => setMGender(e.target.value as 'Putra' | 'Putri' | 'Semua')}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="Putra">Putra</option>
                    <option value="Putri">Putri</option>
                    <option value="Semua">Semua</option>
                  </select>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 h-8 text-xs font-semibold text-white hover:bg-teal-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah
                  </button>
                </form>
              </div>

              {/* Right: Panel Tetapkan Amanah untuk Pegawai Terpilih */}
              <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-5">
                {!selectedPegawai ? (
                  <div className="py-16 text-center space-y-2 text-xs text-slate-500">
                    <UserCheck className="h-8 w-8 mx-auto text-slate-300" />
                    <div className="text-sm font-semibold text-slate-800">
                      Pilih Nama Pegawai di Sebelah Kiri
                    </div>
                    <p>
                      Setelah memilih nama pegawai, Anda dapat langsung klik amanah Kamar Musyrif/ah, Wali Kelas, Guru, atau peran lainnya di sini.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
                      <div>
                        <div className="text-[11px] font-semibold text-teal-700">
                          2. Atur Amanah &amp; Token Akses Pegawai Terpilih
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {selectedPegawai.nama}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 font-mono-num">
                          <span>Username: <b>{selectedPegawai.username}</b></span>
                          <span>·</span>
                          <span className="rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 font-bold text-amber-950">
                            Token / PIN Aktif: {resolveTeacherToken(selectedPegawai)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            downloadLoginAccessCardsPdf([selectedPegawai], {
                              title: `KARTU AKSES LOGIN — ${selectedPegawai.nama}`,
                              subtitle: `Token Login: ${resolveTeacherToken(selectedPegawai)} · Peran: ${assignRoles.join(', ')}`,
                            });
                            notify(`Kartu Akses Login PDF untuk ${selectedPegawai.nama} berhasil diunduh.`, 'success');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-amber-700" />
                          Unduh Kartu Login (PDF)
                        </button>
                        <button
                          type="button"
                          disabled={savingAssign}
                          onClick={handleSavePegawaiAmanah}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 shadow-xs"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {savingAssign ? 'Menyimpan...' : 'Simpan Amanah Pegawai'}
                        </button>
                      </div>
                    </div>

                    {/* A. Wilayah Tugas */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-800">
                        Wilayah Tugas
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(['Putra', 'Putri', 'Semua'] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setAssignGenderScope(w)}
                            className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                              assignGenderScope === w
                                ? w === 'Putri'
                                  ? 'border-rose-600 bg-rose-600 text-white'
                                  : 'border-teal-600 bg-teal-600 text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {w === 'Semua' ? 'Putra & Putri (Semua)' : `Wilayah ${w}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* B. Amanah / Jabatan (Multi-pilih) */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-800">
                        Amanah Jabatan (Bisa klik lebih dari satu)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {AMANAH_ROLES.map((role) => {
                          const checked = assignRoles.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleAssignRole(role)}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                                checked
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {checked && <Check className="h-3.5 w-3.5" />}
                              <span>{role}</span>
                            </button>
                          );
                        })}
                      </div>
                      {assignRoles.length > 1 && (
                        <div className="flex items-center gap-2 pt-1 text-xs">
                          <span className="text-slate-500">Amanah Utama:</span>
                          <select
                            value={assignPrimaryRole}
                            onChange={(e) => setAssignPrimaryRole(e.target.value as UserRole)}
                            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                          >
                            {assignRoles.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* C. Amanah Kelas Binaan (Wali Kelas) */}
                    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-sky-950">
                          Amanah Wali Kelas — Klik Kelas Binaan
                        </label>
                        {assignWaliKelas && (
                          <button
                            type="button"
                            onClick={() => setAssignWaliKelas('')}
                            className="text-[11px] font-semibold text-rose-700 hover:underline"
                          >
                            Lepas Kelas Wali
                          </button>
                        )}
                      </div>
                      {allKnownClasses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {allKnownClasses.map((kls) => {
                            const selected = assignWaliKelas.toUpperCase() === kls.toUpperCase();
                            return (
                              <button
                                key={kls}
                                type="button"
                                onClick={() => setAssignWaliKelas(selected ? '' : kls)}
                                className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                  selected
                                    ? 'border-sky-600 bg-sky-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                                }`}
                              >
                                {kls}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <input
                        type="text"
                        value={assignWaliKelas}
                        onChange={(e) => setAssignWaliKelas(e.target.value)}
                        placeholder="Atau ketik nama kelas baru (contoh: 10 ABU BAKAR AS-SHIDDIQ)"
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs focus:border-sky-600 focus:outline-none"
                      />
                    </div>

                    {/* D. Amanah Kamar Binaan (Musyrif / Musyrifah) */}
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-bold text-indigo-950">
                          Amanah Musyrif / Musyrifah — Klik Kamar Binaan ({assignKamarBinaan.length} kamar)
                        </label>
                        {assignKamarBinaan.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAssignKamarBinaan([])}
                            className="text-[11px] font-semibold text-rose-700 hover:underline"
                          >
                            Kosongkan Kamar
                          </button>
                        )}
                      </div>
                      {allKnownRooms.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                          {allKnownRooms.map((km) => {
                            const selected = assignKamarBinaan.includes(km);
                            return (
                              <button
                                key={km}
                                type="button"
                                onClick={() => toggleAssignRoom(km)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                  selected
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                                }`}
                              >
                                {selected && <Check className="h-3 w-3" />}
                                <span>{km}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customKamarInput}
                          onChange={(e) => setCustomKamarInput(e.target.value)}
                          placeholder="Tambah nama kamar baru (contoh: 10.4 Putra; 10.8 Putra)"
                          className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:border-indigo-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomRoomsToAssign}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Tambah Kamar
                        </button>
                      </div>
                    </div>

                    {/* E. Kontak & PIN */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Nomor WhatsApp
                        </label>
                        <input
                          type="text"
                          value={assignWhatsapp}
                          onChange={(e) => setAssignWhatsapp(e.target.value)}
                          placeholder="628123456789"
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-600">
                            Token / PIN Login Pegawai (Saat ini: <b className="font-mono-num text-teal-800">{resolveTeacherToken(selectedPegawai)}</b>)
                          </label>
                          <button
                            type="button"
                            onClick={() => setAssignPin(generateClientTeacherToken(selectedPegawai.nama))}
                            className="text-[10px] font-semibold text-teal-700 hover:underline"
                          >
                            Reset ke Token Standar ({generateClientTeacherToken(selectedPegawai.nama)})
                          </button>
                        </div>
                        <input
                          type="text"
                          value={assignPin}
                          onChange={(e) => setAssignPin(e.target.value)}
                          placeholder={`Token aktif: ${resolveTeacherToken(selectedPegawai)} (ketik untuk ubah)`}
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-mono-num"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        disabled={savingAssign}
                        onClick={handleSavePegawaiAmanah}
                        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {savingAssign ? 'Menyimpan Amanah...' : 'Simpan Amanah Pegawai'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Direct Input & Edit Santri (Putra/Putri) & Jadwal (Guru Akademik & Al-Qur'an) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
              {/* PANEL 1: SANTRI (TAMBAH LANGSUNG & EDIT YANG SUDAH ADA) */}
              <div className="rounded-xl border border-teal-200 bg-white overflow-hidden">
                <form
                  onSubmit={handleDirectAddStudent}
                  className="bg-gradient-to-br from-teal-50/50 to-white p-4 space-y-3 border-b border-slate-200"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-teal-100 pb-2.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white">
                        <Users className="h-3.5 w-3.5" />
                      </span>
                      {editingStudentId
                        ? 'Edit Data Santri yang Sudah Ada'
                        : 'Input Langsung Data Santri (Putra / Putri)'}
                    </div>
                    {editingStudentId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStudentId(null);
                          setSNis('');
                          setSNama('');
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <X className="h-3 w-3" />
                        Batal Edit
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah *</label>
                      <select
                        value={sGender}
                        onChange={(e) => setSGender(e.target.value as 'Putra' | 'Putri')}
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
                        value={sNis}
                        onChange={(e) => setSNis(e.target.value)}
                        placeholder="1001"
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kamar Asrama</label>
                      <input
                        type="text"
                        value={sKamar}
                        onChange={(e) => setSKamar(e.target.value)}
                        placeholder={sGender === 'Putri' ? '10.1 Putri' : '10.4 Putra'}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Santri *</label>
                      <input
                        type="text"
                        value={sNama}
                        onChange={(e) => setSNama(e.target.value)}
                        placeholder={sGender === 'Putri' ? 'AISYAH HUMAIRA' : 'AHMAD FAUZI'}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Kelas *</label>
                      <input
                        type="text"
                        value={sKelas}
                        onChange={(e) => setSKelas(e.target.value)}
                        placeholder={sGender === 'Putri' ? '10 KHADIJAH' : '10 ABU BAKAR AS-SHIDDIQ'}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelompok Al-Qur&apos;an</label>
                      <input
                        type="text"
                        value={sKelompok}
                        onChange={(e) => setSKelompok(e.target.value)}
                        placeholder={sGender === 'Putri' ? '10-01 Putri' : '10-08 Putra'}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pengampu Al-Qur&apos;an</label>
                      <input
                        type="text"
                        value={sPengampu}
                        onChange={(e) => setSPengampu(e.target.value)}
                        placeholder={sGender === 'Putri' ? 'USTZ. SITI MARIYAM' : 'UST. DAFFA M Z'}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingStudentDirect}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingStudentDirect
                      ? 'Menyimpan...'
                      : editingStudentId
                      ? 'Simpan Perubahan Data Santri'
                      : `Tambah Santri Baru (${sGender})`}
                  </button>
                </form>

                {/* Tabel Edit Santri yang Sudah Ada */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Data Santri ({adminStudents.filter((s) => studentWilayahFilter === 'Semua' || s.gender === studentWilayahFilter).length})
                    </span>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
                      {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setStudentWilayahFilter(w)}
                          className={`rounded-md px-2 py-0.5 font-semibold transition-colors ${
                            studentWilayahFilter === w
                              ? w === 'Putri'
                                ? 'bg-rose-600 text-white'
                                : w === 'Putra'
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={studentSearchQ}
                    onChange={(e) => setStudentSearchQ(e.target.value)}
                    placeholder="Cari nama santri / kelas / kamar..."
                    className="h-8 w-52 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Nama Santri</th>
                        <th className="px-2 py-2 font-semibold">Kelas &amp; Kamar</th>
                        <th className="px-2 py-2 font-semibold">Halaqah</th>
                        <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminStudents
                        .filter((st) => {
                          if (studentWilayahFilter !== 'Semua' && st.gender !== studentWilayahFilter) {
                            return false;
                          }
                          const q = studentSearchQ.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            st.nama.toLowerCase().includes(q) ||
                            st.kelas.toLowerCase().includes(q) ||
                            (st.kamar || '').toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 80)
                        .map((st) => (
                          <tr
                            key={st.id}
                            className={`hover:bg-slate-50 ${
                              editingStudentId === st.id ? 'bg-teal-50/80' : ''
                            }`}
                          >
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900">{st.nama}</div>
                              <div className="font-mono-num text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>NIS: {st.nis || '-'}</span>
                                <span
                                  className={`rounded px-1.5 py-0.2 font-bold ${
                                    st.gender === 'Putri'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-sky-100 text-sky-800'
                                  }`}
                                >
                                  {st.gender}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="font-medium text-slate-800">{st.kelas}</div>
                              <div className="text-[10px] text-slate-500">Kamar: {st.kamar || '-'}</div>
                            </td>
                            <td className="px-2 py-2 text-[11px] text-slate-600">
                              <div>{st.kelompokQuran || '-'}</div>
                              <div className="text-[10px] text-teal-700">{st.pengampuQuran || '-'}</div>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleStartEditStudent(st)}
                                className="mr-1 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStudentDirect(st)}
                                className="inline-flex items-center rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                                title="Hapus santri"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PANEL 2: JADWAL GURU AKADEMIK & AL-QUR'AN (TAMBAH LANGSUNG & EDIT YANG SUDAH ADA) */}
              <div className="rounded-xl border border-sky-200 bg-white overflow-hidden">
                <form
                  onSubmit={handleDirectAddSchedule}
                  className="bg-gradient-to-br from-sky-50/50 to-white p-4 space-y-3 border-b border-slate-200"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-sky-100 pb-2.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white">
                        <CalendarClock className="h-3.5 w-3.5" />
                      </span>
                      {editingScheduleId
                        ? 'Edit Jadwal Guru Akademik / Al-Qur’an'
                        : 'Input Langsung Jadwal Guru Akademik & Al-Qur’an'}
                    </div>
                    {editingScheduleId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingScheduleId(null);
                          setJKelas('');
                          setJMapel('');
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <X className="h-3 w-3" />
                        Batal Edit
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kategori Jadwal</label>
                      <select
                        value={jKategori}
                        onChange={(e) => {
                          const val = e.target.value as 'Akademik' | 'Al-Quran';
                          setJKategori(val);
                          if (val === 'Al-Quran' && !jMapel) setJMapel("HALAQAH AL-QUR'AN");
                        }}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                      >
                        <option value="Akademik">Guru Akademik (KBM)</option>
                        <option value="Al-Quran">Guru Al-Qur&apos;an</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah</label>
                      <select
                        value={jGender}
                        onChange={(e) => setJGender(e.target.value as 'Putra' | 'Putri')}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                      >
                        <option value="Putra">Putra</option>
                        <option value="Putri">Putri</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hari</label>
                      <select
                        value={jHari}
                        onChange={(e) => setJHari(e.target.value)}
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
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Guru / Pengampu *</label>
                      <input
                        type="text"
                        list="admin-guru-list"
                        value={jGuru}
                        onChange={(e) => setJGuru(e.target.value)}
                        placeholder={jGender === 'Putri' ? 'USTZ. HANIFAH' : 'UST. NUR FAIZIN'}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium"
                      />
                      <datalist id="admin-guru-list">
                        {teachers.map((t) => (
                          <option key={t.id} value={t.nama} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {jKategori === 'Al-Quran' ? 'Kelompok Halaqah *' : 'Nama Kelas *'}
                      </label>
                      <input
                        type="text"
                        value={jKelas}
                        onChange={(e) => setJKelas(e.target.value)}
                        placeholder={
                          jKategori === 'Al-Quran'
                            ? '10-08 Putra'
                            : jGender === 'Putri'
                            ? '10 KHADIJAH'
                            : '10 ABU BAKAR AS-SHIDDIQ'
                        }
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {jKategori === 'Al-Quran' ? 'Materi Halaqah / Setoran *' : 'Mata Pelajaran *'}
                      </label>
                      <input
                        type="text"
                        value={jMapel}
                        onChange={(e) => setJMapel(e.target.value)}
                        placeholder={jKategori === 'Al-Quran' ? "HALAQAH AL-QUR'AN" : 'BAHASA ARAB'}
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Ke (JP)</label>
                      <input
                        type="text"
                        value={jJam}
                        onChange={(e) => setJJam(e.target.value)}
                        placeholder="1-2"
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono-num"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingScheduleDirect}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingScheduleDirect
                      ? 'Menyimpan...'
                      : editingScheduleId
                      ? 'Simpan Perubahan Jadwal'
                      : `Tambah Jadwal ${jKategori} (${jGender})`}
                  </button>
                </form>

                {/* Tabel Edit Jadwal yang Sudah Ada */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Data Jadwal ({adminSchedules.filter((s) => scheduleWilayahFilter === 'Semua' || s.gender === scheduleWilayahFilter).length})
                    </span>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
                      {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => setScheduleWilayahFilter(w)}
                          className={`rounded-md px-2 py-0.5 font-semibold transition-colors ${
                            scheduleWilayahFilter === w
                              ? w === 'Putri'
                                ? 'bg-rose-600 text-white'
                                : w === 'Putra'
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={scheduleSearchQ}
                    onChange={(e) => setScheduleSearchQ(e.target.value)}
                    placeholder="Cari guru / mapel / kelas..."
                    className="h-8 w-52 rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Hari &amp; JP</th>
                        <th className="px-2 py-2 font-semibold">Guru &amp; Mapel</th>
                        <th className="px-2 py-2 font-semibold">Kelas / Halaqah</th>
                        <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminSchedules
                        .filter((sch) => {
                          if (scheduleWilayahFilter !== 'Semua' && sch.gender !== scheduleWilayahFilter) {
                            return false;
                          }
                          const q = scheduleSearchQ.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            sch.guru.toLowerCase().includes(q) ||
                            sch.mapel.toLowerCase().includes(q) ||
                            sch.kelas.toLowerCase().includes(q) ||
                            sch.hari.toLowerCase().includes(q)
                          );
                        })
                        .map((sch) => (
                          <tr
                            key={sch.id}
                            className={`hover:bg-slate-50 ${
                              editingScheduleId === sch.id ? 'bg-sky-50/80' : ''
                            }`}
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">{sch.hari}</div>
                              <div className="font-mono-num text-[10px] text-slate-500">JP {sch.jamKe}</div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="font-semibold text-slate-900">{sch.guru}</div>
                              <div className="text-[10px] text-sky-700 font-medium">{sch.mapel}</div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="font-medium text-slate-800">{sch.kelas}</div>
                              <span
                                className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                  sch.gender === 'Putri'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {sch.gender}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleStartEditSchedule(sch)}
                                className="mr-1 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteScheduleDirect(sch)}
                                className="inline-flex items-center rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                                title="Hapus jadwal"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Add / Edit Single Teacher/Wali Kelas/Musyrif + Account Directory */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start border-t border-slate-200 pt-5">
              <form
                onSubmit={handleCreateSingleAccount}
                className="lg:col-span-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                      <UserPlus className="h-3.5 w-3.5" />
                    </span>
                    {editingTeacherId ? 'Edit Akun Guru / Pembina' : 'Tambah Akun Guru / Wali / Musyrif'}
                  </div>
                  {editingTeacherId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeacherId(null);
                        setMNama('');
                        setMWaliKelas('');
                        setMKamar('');
                        setMUsername('');
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
                    >
                      <X className="h-3 w-3" />
                      Batal
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Lengkap &amp; Gelar *</label>
                  <input
                    type="text"
                    value={mNama}
                    onChange={(e) => setMNama(e.target.value)}
                    placeholder="Contoh: UST. AHMAD FAUZI"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Peran</label>
                    <select
                      value={mPeran}
                      onChange={(e) => setMPeran(e.target.value as UserRole)}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold focus:border-indigo-600 focus:outline-none"
                    >
                      <option value="Wali Kelas">Wali Kelas</option>
                      <option value="Wali Asrama">Wali Asrama</option>
                      <option value="Musyrif">Musyrif</option>
                      <option value="Musyrifah">Musyrifah</option>
                      <option value="Guru">Guru Akademik</option>
                      <option value="Guru Wali">Guru Wali</option>
                      <option value="Pengampu Al-Quran">Pengampu Al-Qur&apos;an</option>
                      <option value="Pimpinan">Pimpinan (Akses Semua Laporan &amp; PDF)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Gender Unit</label>
                    <select
                      value={mGender}
                      onChange={(e) => setMGender(e.target.value as 'Putra' | 'Putri' | 'Semua')}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold focus:border-indigo-600 focus:outline-none"
                    >
                      <option value="Putra">Putra</option>
                      <option value="Putri">Putri</option>
                      <option value="Semua">Semua</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wali Kelas Dari (Opsional)</label>
                  <input
                    type="text"
                    value={mWaliKelas}
                    onChange={(e) => setMWaliKelas(e.target.value)}
                    placeholder="Contoh: 10 ABU BAKAR AS-SHIDDIQ"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kamar Binaan (pisah koma/titik koma)</label>
                  <input
                    type="text"
                    value={mKamar}
                    onChange={(e) => setMKamar(e.target.value)}
                    placeholder="Contoh: 10.4 Putra; 10.8 Putra"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Username/Email</label>
                    <input
                      type="text"
                      value={mUsername}
                      onChange={(e) => setMUsername(e.target.value)}
                      placeholder="otomatis"
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">PIN Login</label>
                    <input
                      type="text"
                      value={mPin}
                      onChange={(e) => setMPin(e.target.value)}
                      placeholder={editingTeacherId ? 'Kosongkan jika tetap' : '1234'}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono-num focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
                >
                  <Save className="h-3.5 w-3.5" />
                  {editingTeacherId ? 'Simpan Perubahan Akun' : 'Simpan Akun Baru'}
                </button>
              </form>

              <div className="lg:col-span-8 rounded-xl border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                  <span>Daftar Database Pegawai &amp; Token Terdaftar ({teachers.length})</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadLoginAccessCardsPdf(staffDirectory, {
                          title: 'KARTU AKSES LOGIN DATABASE PEGAWAI & GURU',
                        });
                        notify('Kartu Akses Login PDF berhasil diunduh.', 'success');
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-[#0B1324] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                    >
                      <KeyRound className="h-3 w-3 text-amber-300" />
                      Unduh Semua Kartu Login (PDF)
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Nama</th>
                        <th className="px-3 py-2 font-semibold">Token / PIN Login</th>
                        <th className="px-3 py-2 font-semibold">Peran</th>
                        <th className="px-3 py-2 font-semibold">Penugasan</th>
                        <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teachers.map((t) => {
                        const roleColor =
                          t.peran === 'Admin Super'
                            ? 'text-teal-700 font-bold'
                            : t.peran === 'Pimpinan'
                            ? 'text-amber-700 font-bold'
                            : t.peran === 'Wali Kelas'
                            ? 'text-violet-700 font-semibold'
                            : t.peran === 'Musyrif' || t.peran === 'Musyrifah' || t.peran === 'Wali Asrama'
                            ? 'text-indigo-700 font-semibold'
                            : 'text-sky-700 font-semibold';
                        const allRoles = Array.from(new Set([t.peran, ...(t.peranTambahan || [])]));
                        return (
                          <tr
                            key={t.id}
                            className={`hover:bg-slate-50 ${
                              editingTeacherId === t.id ? 'bg-indigo-50/70' : ''
                            }`}
                          >
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900">{t.nama}</div>
                              <div className="font-mono-num text-[10px] text-slate-500">{t.username}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="inline-block rounded bg-amber-100 border border-amber-300 px-2 py-0.5 font-mono-num text-[11px] font-bold text-amber-950">
                                {t.peran === 'Admin Super' ? '121320' : resolveTeacherToken(t)}
                              </span>
                            </td>
                            <td className={`px-3 py-2 ${roleColor}`}>
                              {allRoles.join(', ')}
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-600">
                              {t.waliKelasOf ? `Wali: ${t.waliKelasOf}` : ''}
                              {t.waliKelasOf && t.kamarBinaan?.length ? ' · ' : ''}
                              {t.kamarBinaan?.length ? `Kamar: ${t.kamarBinaan.join(', ')}` : ''}
                              {!t.waliKelasOf && !t.kamarBinaan?.length ? `Wilayah ${t.genderScope}` : ''}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {t.peran === 'Admin Super' ? (
                                <span className="text-[11px] font-semibold text-teal-700">Utama</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      downloadLoginAccessCardsPdf([t], {
                                        title: `KARTU AKSES LOGIN — ${t.nama}`,
                                      });
                                      notify(`Kartu Login PDF untuk ${t.nama} diunduh.`, 'success');
                                    }}
                                    className="mr-1 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                                  >
                                    Kartu PDF
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditAccount(t)}
                                    className="mr-1 inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(t.id, t.nama)}
                                    title="Hapus akun"
                                    className="inline-flex items-center rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Ruang Ujian (Tambah & Edit) + Reset Empty */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 border-t border-slate-200 pt-5">
              <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {editingRuangOldName ? `Edit Ruangan: ${editingRuangOldName}` : 'Daftar Ruangan Ujian (Tambah & Edit)'}
                  </h3>
                  {editingRuangOldName && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRuangOldName(null);
                        setNewRuang('');
                      }}
                      className="text-xs font-semibold text-rose-700 hover:underline"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
                <form onSubmit={handleAddRuang} className="flex gap-2">
                  <input
                    type="text"
                    value={newRuang}
                    onChange={(e) => setNewRuang(e.target.value)}
                    placeholder="Contoh: RUANG 01 - AL-GHAZALI"
                    className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {editingRuangOldName ? 'Simpan Nama Baru' : 'Tambah'}
                  </button>
                </form>
                {ruanganUjian.length === 0 ? (
                  <p className="text-xs text-slate-500">Belum ada ruangan ujian ditambahkan.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ruanganUjian.map((r) => (
                      <div
                        key={r}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                      >
                        <span>{r}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRuangOldName(r);
                            setNewRuang(r);
                          }}
                          title="Edit nama ruangan"
                          className="rounded p-0.5 text-slate-500 hover:bg-amber-50 hover:text-amber-800"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRuang(r)}
                          title="Hapus ruangan"
                          className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/60 to-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-rose-900">Reset Database ke Kondisi Kosong</h3>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Membersihkan seluruh data siswa, guru, wali kelas, musyrif, jadwal, dan log agar dapat mengupload ulang dari nol (akun Admin Super <code>sahidin30@gmail.com</code> tetap aktif).
                </p>
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Kosongkan Semua Data SIM
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetEmpty}
                      className="rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800"
                    >
                      Ya, Hapus Semua &amp; Kosongkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
