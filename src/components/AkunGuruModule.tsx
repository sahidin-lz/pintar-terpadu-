import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Home,
  KeyRound,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AcademicArchiveEntry,
  Gender,
  PimpinanExecutiveReport,
  PresensiType,
  ScheduleItem,
  StatusKenaikanKelas,
  TeacherAbsenceLog,
  TeacherPublic,
  UserRole,
  WilayahFilter,
} from '../types';
import {
  downloadCsv,
  downloadLoginAccessCardsPdf,
  downloadPimpinanMasterPdf,
  downloadTableReportPdf,
  formatTanggalIndo,
  getTodayDateStr,
  resolveTeacherToken,
} from '../utils/exportHelpers';
import {
  downloadComponentExcelTemplate,
  parseDatabaseExcelBuffer,
  triggerExcelDownloadFromSpec,
  type DatabaseWorkbookSpec,
  type ParsedDatabaseWorkbook,
} from '../utils/excelParser';
import { emitDataMutated, loadSubTab, saveSubTab } from '../utils/sessionPersistence';

const AKUN_TABS = [
  'pimpinan',
  'mengajar',
  'walikelas',
  'musyrif',
  'guruwali',
  'quran',
  'whatsapp',
  'upload',
] as const;
type AkunProgressTab = (typeof AKUN_TABS)[number];

interface TeacherRecapResponse {
  teacher: TeacherPublic;
  totalSessions: number;
  todaySessions: number;
  examSessionsCount: number;
  sessions: Array<{
    tanggal: string;
    jenisPresensi: string;
    kelas: string;
    mapel: string;
    materi: string;
    totalSiswa: number;
    hadir: number;
    sakit?: number;
    izin?: number;
    alfa?: number;
    tidakHadir: number;
    timestamp: string;
  }>;
  allMySchedules: ScheduleItem[];
  allSystemSchedules?: ScheduleItem[];
  scheduleApprovalRequired?: boolean;
  todaySchedules: Array<{
    id: string;
    kelas: string;
    mapel: string;
    jamKe: string;
    filled: boolean;
  }>;
  learningPacing?: Array<{
    kelas: string;
    mapel: string;
    gender: Gender;
    jadwalMingguan: string;
    totalPertemuan: number;
    targetPertemuan: number;
    lajuPct: number;
    statusLaju: 'Tuntas / On-Track' | 'Berjalan Stabil' | 'Perlu Akselerasi' | 'Belum Mulai';
    rataKehadiranPct: number;
    sakitPct?: number;
    izinPct?: number;
    alfaPct?: number;
    totalHadir?: number;
    totalSakit?: number;
    totalIzin?: number;
    totalAlfa?: number;
    jumlahTopikUnik: number;
    materiTerakhir: string;
    tanggalTerakhir: string;
    riwayatMateri: Array<{
      tanggal: string;
      materi: string;
      hadir: number;
      sakit?: number;
      izin?: number;
      alfa?: number;
      totalSiswa: number;
      tidakHadir: number;
    }>;
  }>;
  studentAttentionAcademic?: Array<{
    nama: string;
    kelas: string;
    mapel: string;
    H: number;
    T: number;
    S: number;
    I: number;
    A: number;
    total: number;
    kehadiranPct: number;
  }>;
  myRooms: Array<{
    kamar: string;
    musyrif: string;
    gender?: string;
    filled: boolean;
  }>;
  myAbsences: TeacherAbsenceLog[];
  waliStudents: Array<{ id: string; nama: string; kelas: string; kamar: string }>;
  waliPembinaanCount: number;
  waliProgress: {
    kelasBinaan: string;
    availableClasses?: string[];
    totalSantri: number;
    santriSudahDibina: number;
    klasikalCount?: number;
    khususCount?: number;
    kasusProsesEskalasi: number;
    rataAkademikPct?: number;
    rataAsramaPct?: number;
    rataAlquranPct?: number;
    rataSholatWajibPct: number;
    rataSholatSunnahPct: number;
    santriProgress: Array<{
      id?: string;
      nis?: string;
      nama: string;
      kelas: string;
      kamar: string;
      gender?: Gender;
      waliKelas?: string;
      musyrif?: string;
      guruWali?: string;
      statusKenaikan?: StatusKenaikanKelas;
      kelasTujuanKenaikan?: string;
      ringkasanNilaiRapor?: string;
      catatanRaporWali?: string;
      prioritas: string;
      totalPembinaan: number;
      klasikalCount?: number;
      khususCount?: number;
      netPoin: number;
      statusTerakhir: string;
      catatanTerakhir?: string;
      lastTanggal: string;
      absenSakit: number;
      absenIzin: number;
      absenAlfa: number;
      akademikPct?: number;
      asramaPct?: number;
      alquranPct?: number;
      wajibPct: number;
      sunnahPct?: number;
    }>;
    allClassesSantriProgress?: Array<{
      id?: string;
      nis?: string;
      nama: string;
      kelas: string;
      kamar: string;
      gender?: Gender;
      waliKelas?: string;
      musyrif?: string;
      guruWali?: string;
      statusKenaikan?: StatusKenaikanKelas;
      kelasTujuanKenaikan?: string;
      ringkasanNilaiRapor?: string;
      catatanRaporWali?: string;
      prioritas: string;
      totalPembinaan: number;
      klasikalCount?: number;
      khususCount?: number;
      netPoin: number;
      statusTerakhir: string;
      catatanTerakhir?: string;
      lastTanggal: string;
      absenSakit: number;
      absenIzin: number;
      absenAlfa: number;
      akademikPct?: number;
      asramaPct?: number;
      alquranPct?: number;
      wajibPct: number;
      sunnahPct?: number;
    }>;
  };
  musyrifProgress: {
    kamarList: string[];
    roomSummaries?: Array<{
      kamar: string;
      filledToday: boolean;
      totalSantri: number;
      santriDibina: number;
      rataAsramaPct: number;
      rataAlquranPct: number;
      rataAkademikPct: number;
      rataWajibPct: number;
    }>;
    totalKamar: number;
    sudahPresensiHariIni: number;
    totalSantri: number;
    santriSudahDibina: number;
    totalPembinaanAsrama: number;
    klasikalCount?: number;
    khususCount?: number;
    rataAsramaPct?: number;
    rataAlquranPct?: number;
    rataAkademikPct?: number;
    rataSholatWajibPct: number;
    rataSholatSunnahPct: number;
    absenHariIni: Array<{
      namaSiswa: string;
      kamar: string;
      status: string;
      keterangan: string;
    }>;
    santriProgress: Array<{
      id?: string;
      nis?: string;
      nama: string;
      kelas: string;
      kamar: string;
      gender?: Gender;
      waliKelas?: string;
      guruWali?: string;
      posisiRanjang?: string;
      catatanKamar?: string;
      kamarSebelumnya?: string;
      totalPembinaan: number;
      klasikalCount?: number;
      khususCount?: number;
      netPoin?: number;
      statusTerakhir?: string;
      catatanTerakhir?: string;
      wajibPct: number;
      sunnahPct: number;
      statusAsramaHariIni: string;
      keteranganHariIni: string;
      asramaPct?: number;
      asramaH?: number;
      asramaSIA?: number;
      alquranPct?: number;
      alquranH?: number;
      alquranSIA?: number;
      lastSetoran?: string;
      akademikPct?: number;
      akademikH?: number;
      akademikSIA?: number;
      absenSakit?: number;
      absenIzin?: number;
      absenAlfa?: number;
    }>;
  };
  unassignedAsramaStudents?: Array<{
    id: string;
    nis: string;
    nama: string;
    kelas: string;
    kamarSebelumnya?: string;
    gender: Gender;
  }>;
  lockedOtherRoomStudents?: Array<{
    id: string;
    nis: string;
    nama: string;
    kelas: string;
    kamar: string;
    musyrif: string;
    gender: Gender;
  }>;
  unassignedClassStudents?: Array<{
    id: string;
    nis: string;
    nama: string;
    kamar: string;
    statusKenaikan?: string;
    gender: Gender;
  }>;
  academicArchives?: AcademicArchiveEntry[];
  guruWaliProgress?: {
    totalSantri: number;
    santriSudahDibina: number;
    totalCatatan: number;
    klasikalCount: number;
    khususCount: number;
    kasusProsesEskalasi: number;
    rataAsramaPct: number;
    rataAkademikPct: number;
    rataAlquranPct: number;
    rataSholatWajibPct: number;
    rataSholatSunnahPct: number;
    santriProgress: Array<{
      nama: string;
      kelas: string;
      kamar: string;
      gender: Gender;
      waliKelas: string;
      musyrif: string;
      guruWali: string;
      prioritas: string;
      totalPembinaan: number;
      klasikalCount: number;
      khususCount: number;
      netPoin: number;
      statusTerakhir: string;
      catatanTerakhir: string;
      lastTanggal: string;
      asramaPct: number;
      akademikPct: number;
      alquranPct: number;
      lastSetoran: string;
      absenSakit: number;
      absenIzin: number;
      absenAlfa: number;
      wajibPct: number;
      sunnahPct: number;
    }>;
    candidateStudents: Array<{
      nama: string;
      kelas: string;
      kamar: string;
      gender: Gender;
      guruWali: string;
    }>;
  };
}

interface AkunGuruModuleProps {
  teachers: TeacherPublic[];
  unlockedTeacher: TeacherPublic | null;
  onUnlock: (teacher: TeacherPublic | null) => void;
  onOpenQuickPresensi: (
    namaGuru: string,
    opts?: { jenis?: PresensiType; gender?: Gender; target?: string },
  ) => void;
  onOpenWaliKelas: () => void;
  onOpenJadwal?: () => void;
  onOpenRegisterPortal?: () => void;
  onDataUpdated?: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AkunGuruModule: React.FC<AkunGuruModuleProps> = ({
  teachers,
  unlockedTeacher,
  onUnlock,
  onOpenQuickPresensi,
  onOpenWaliKelas,
  onOpenJadwal,
  onOpenRegisterPortal,
  onDataUpdated,
  notify,
}) => {
  const [selectedName, setSelectedName] = useState<string>(unlockedTeacher?.nama || teachers[0]?.nama || '');
  const [customNameInput, setCustomNameInput] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [recap, setRecap] = useState<TeacherRecapResponse | null>(null);
  const [loadingRecap, setLoadingRecap] = useState(false);
  const [showAllRoleTabs, setShowAllRoleTabs] = useState<boolean>(false);
  const [pimpinanWilayah, setPimpinanWilayah] = useState<WilayahFilter>('Semua');
  const [pimpinanReport, setPimpinanReport] = useState<PimpinanExecutiveReport | null>(null);
  const [loadingPimpinan, setLoadingPimpinan] = useState<boolean>(false);
  const [progressTab, setProgressTab] = useState<AkunProgressTab>(() =>
    loadSubTab(
      `pintar_akunguru_tab_${unlockedTeacher?.id || 'default'}`,
      AKUN_TABS,
      'mengajar',
    ),
  );
  const today = getTodayDateStr();

  // Dasbor Pengampu Al-Qur'an (Halaqah) state
  const [halaqahRows, setHalaqahRows] = useState<
    Array<{
      id: string;
      nis: string;
      nama: string;
      gender: Gender;
      kelas: string;
      kamar?: string;
      kelompokQuran: string;
      pengampuQuran: string;
      persenHadir: number;
      totalHadir: number;
      totalSakit?: number;
      totalIzin?: number;
      totalAlfa?: number;
      totalAbsen: number;
      setoranCount?: number;
      murajaahCount?: number;
      statusTerakhir?: string;
      lastSetoran: string;
      lastTilawah: string;
      lastMurajaah: string;
      lastTanggal: string;
      riwayatHalaqah?: Array<{
        tanggal: string;
        status: string;
        setoran: string;
        tilawah: string;
        murajaah: string;
        keterangan: string;
      }>;
    }>
  >([]);
  const [loadingHalaqah, setLoadingHalaqah] = useState(false);

  // WhatsApp Gateway Automation state
  const [waProvider, setWaProvider] = useState<'Fonnte' | 'Wablas' | 'Baileys'>('Fonnte');
  const [waToken, setWaToken] = useState('');
  const [waAutoAlfa, setWaAutoAlfa] = useState(true);
  const [waAutoEskalasi, setWaAutoEskalasi] = useState(true);
  const [waLogs, setWaLogs] = useState<
    Array<{
      id: string;
      timestamp: string;
      triggerType: string;
      namaSantri: string;
      kelas: string;
      nomorTujuan: string;
      pesan: string;
      provider: string;
      status: string;
    }>
  >([]);
  const [savingWa, setSavingWa] = useState(false);

  // Per-login Excel Upload state
  const [personalExcel, setPersonalExcel] = useState<ParsedDatabaseWorkbook | null>(null);
  const [downloadingTpl, setDownloadingTpl] = useState(false);
  const [uploadingPersonal, setUploadingPersonal] = useState(false);

  // Per-login Direct Input state (Santri, Jadwal, Assignment)
  const defaultGender: Gender = unlockedTeacher?.genderScope === 'Putri' ? 'Putri' : 'Putra';
  const [inWilayah, setInWilayah] = useState<Gender>(defaultGender);
  const [inNis, setInNis] = useState('');
  const [inNamaSantri, setInNamaSantri] = useState('');
  const [inKelas, setInKelas] = useState(unlockedTeacher?.waliKelasOf || '');
  const [inKamar, setInKamar] = useState(unlockedTeacher?.kamarBinaan?.[0] || '');
  const [inKelompok, setInKelompok] = useState('');
  const [savingSantri, setSavingSantri] = useState(false);

  const [editingJadwalId, setEditingJadwalId] = useState<string | null>(null);
  const [inKategoriJadwal, setInKategoriJadwal] = useState<'Akademik' | 'Al-Quran'>('Akademik');
  const [inHari, setInHari] = useState('SENIN');
  const [inJadwalWilayah, setInJadwalWilayah] = useState<Gender>(defaultGender);
  const [inJadwalKelas, setInJadwalKelas] = useState(unlockedTeacher?.waliKelasOf || '');
  const [inMapel, setInMapel] = useState('');
  const [inJam, setInJam] = useState('1-2');
  const [inRuang, setInRuang] = useState('');
  const [savingJadwal, setSavingJadwal] = useState(false);
  const [uploadingJadwalExcel, setUploadingJadwalExcel] = useState(false);
  const [clashCheckResult, setClashCheckResult] = useState<{
    clash: boolean;
    type?: 'GURU' | 'KELAS';
    reason?: string;
    conflictingItem?: ScheduleItem;
  } | null>(null);
  const [activeMatrixCell, setActiveMatrixCell] = useState<ScheduleItem | null>(null);
  const [togglingApprovalMode, setTogglingApprovalMode] = useState(false);

  // Wali Asrama (Musyrif) Room Management & Semester Transition states
  const [showRoomManagerPanel, setShowRoomManagerPanel] = useState<boolean>(false);
  const [musyrifTransitionMode, setMusyrifTransitionMode] = useState<'TEMPLATE_ADMIN' | 'AMBIL_MANDIRI'>('AMBIL_MANDIRI');
  const [selectedUnassignedAsramaIds, setSelectedUnassignedAsramaIds] = useState<string[]>([]);
  const [asramaClaimTargetRoom, setAsramaClaimTargetRoom] = useState<string>('');
  const [asramaUnassignedSearch, setAsramaUnassignedSearch] = useState<string>('');
  const [claimingAsramaStudents, setClaimingAsramaStudents] = useState<boolean>(false);
  const [editingRoomMember, setEditingRoomMember] = useState<{
    studentId?: string;
    nama: string;
    kamar: string;
    posisiRanjang: string;
    catatanKamar: string;
  } | null>(null);
  const [savingRoomMember, setSavingRoomMember] = useState<boolean>(false);

  // Wali Kelas Promotion & Archive states
  const [waliPromotionMode, setWaliPromotionMode] = useState<'MASSAL' | 'INDIVIDUAL' | 'AMBIL_SISWA'>('MASSAL');
  const [bulkTargetClass, setBulkTargetClass] = useState<string>('11 IPA 1');
  const [bulkTahunAjaranBaru, setBulkTahunAjaranBaru] = useState<string>('2027/2028');
  const [promotingStudents, setPromotingStudents] = useState<boolean>(false);
  const [individualPromotionDraft, setIndividualPromotionDraft] = useState<
    Record<string, { statusKenaikan: StatusKenaikanKelas; kelasTujuan: string }>
  >({});
  const [selectedUnassignedClassIds, setSelectedUnassignedClassIds] = useState<string[]>([]);
  const [claimingClassStudents, setClaimingClassStudents] = useState<boolean>(false);
  const [editingWaliStudentModal, setEditingWaliStudentModal] = useState<{
    nama: string;
    nis: string;
    kelas: string;
    ringkasanNilaiRapor: string;
    statusKenaikan: StatusKenaikanKelas;
    kelasTujuanKenaikan: string;
  } | null>(null);

  const [editScope, setEditScope] = useState<'Putra' | 'Putri' | 'Semua'>(unlockedTeacher?.genderScope || 'Putra');
  const [editWaliKelas, setEditWaliKelas] = useState(unlockedTeacher?.waliKelasOf || '');
  const [editKamarBinaan, setEditKamarBinaan] = useState((unlockedTeacher?.kamarBinaan || []).join('; '));
  const [savingProfile, setSavingProfile] = useState(false);

  // Role-specific interactive filter states
  const [selectedAsramaRoom, setSelectedAsramaRoom] = useState<string>('SEMUA');
  const [selectedWaliKelasFilter, setSelectedWaliKelasFilter] = useState<string>('BINAAN_SAYA');
  const [showManageGuruWaliStudents, setShowManageGuruWaliStudents] = useState<boolean>(false);
  const [guruWaliCandidateSearch, setGuruWaliCandidateSearch] = useState<string>('');
  const [guruWaliCandidateClass, setGuruWaliCandidateClass] = useState<string>('SEMUA');
  const [savingGuruWaliAssign, setSavingGuruWaliAssign] = useState<boolean>(false);

  // New Role-Focused Dashboard States (Guru Akademik, Guru Al-Qur'an, Guru Musyrif, & Multi-Role Switcher)
  const [showRoleComparisonMatrix, setShowRoleComparisonMatrix] = useState<boolean>(false);
  const [academicTimeRange, setAcademicTimeRange] = useState<'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'SEMESTER'>('SEMESTER');
  const [academicPacingFilter, setAcademicPacingFilter] = useState<'SEMUA' | 'SESUAI' | 'CEPAT' | 'TERTINGGAL'>('SEMUA');
  const [academicClassSearch, setAcademicClassSearch] = useState<string>('');

  const [quranTargetFilter, setQuranTargetFilter] = useState<'SEMUA' | 'TERCAPAI' | 'PENDAMPINGAN'>('SEMUA');
  const [quranGroupFilter, setQuranGroupFilter] = useState<string>('SEMUA');
  const [quranSearch, setQuranSearch] = useState<string>('');

  const [musyrifTargetFilter, setMusyrifTargetFilter] = useState<'SEMUA' | 'TERCAPAI' | 'PENDAMPINGAN'>('SEMUA');
  const [musyrifSearch, setMusyrifSearch] = useState<string>('');

  const [detailStudentModal, setDetailStudentModal] = useState<{
    roleType: 'QURAN' | 'MUSYRIF';
    nama: string;
    kelas: string;
    kamarOrHalaqah: string;
    capaianUtama: string;
    statusTarget: 'Tercapai' | 'Perlu Pendampingan';
    persenHadir: number;
    rincianKehadiran: string;
    metrics: Array<{ label: string; value: string; tone: string }>;
    history: Array<{ tanggal: string; title: string; subtitle: string; badge: string }>;
  } | null>(null);

  useEffect(() => {
    if (!selectedName && teachers.length > 0) {
      setSelectedName(teachers[0].nama);
    }
  }, [teachers, selectedName]);

  useEffect(() => {
    if (unlockedTeacher) {
      const defG: Gender = unlockedTeacher.genderScope === 'Putri' ? 'Putri' : 'Putra';
      setInWilayah(defG);
      setInJadwalWilayah(defG);
      setInKelas(unlockedTeacher.waliKelasOf || '');
      setInJadwalKelas(unlockedTeacher.waliKelasOf || '');
      setInKamar(unlockedTeacher.kamarBinaan?.[0] || '');
      setEditScope(unlockedTeacher.genderScope || 'Putra');
      setEditWaliKelas(unlockedTeacher.waliKelasOf || '');
      setEditKamarBinaan((unlockedTeacher.kamarBinaan || []).join('; '));
      setPersonalExcel(null);
      setSelectedAsramaRoom('SEMUA');
      setSelectedWaliKelasFilter('BINAAN_SAYA');

      const allRoles = new Set<UserRole>([
        unlockedTeacher.peran,
        ...(unlockedTeacher.peranTambahan || []),
      ]);
      const isAdminRole = allRoles.has('Admin Super') || allRoles.has('Admin SIM');
      const allowedRoleTabs = new Set<AkunProgressTab>(['upload']);
      if (isAdminRole || allRoles.has('Pimpinan')) allowedRoleTabs.add('pimpinan');
      if (isAdminRole || allRoles.has('Guru') || allRoles.size === 0) allowedRoleTabs.add('mengajar');
      if (isAdminRole || allRoles.has('Pengampu Al-Quran')) allowedRoleTabs.add('quran');
      if (
        isAdminRole ||
        allRoles.has('Wali Asrama') ||
        allRoles.has('Musyrif') ||
        allRoles.has('Musyrifah')
      ) {
        allowedRoleTabs.add('musyrif');
      }
      if (isAdminRole || allRoles.has('Wali Kelas')) allowedRoleTabs.add('walikelas');
      if (isAdminRole || allRoles.has('Guru Wali')) allowedRoleTabs.add('guruwali');
      if (
        isAdminRole ||
        allRoles.has('Pimpinan') ||
        allRoles.has('Wali Kelas') ||
        allRoles.has('Wali Asrama') ||
        allRoles.has('Musyrif') ||
        allRoles.has('Musyrifah') ||
        allRoles.has('Guru Wali')
      ) {
        allowedRoleTabs.add('whatsapp');
      }

      if (unlockedTeacher.genderScope === 'Putra' || unlockedTeacher.genderScope === 'Putri') {
        setPimpinanWilayah(unlockedTeacher.genderScope);
      } else {
        setPimpinanWilayah('Semua');
      }

      if (!isAdminRole) {
        setShowAllRoleTabs(false);
      }

      const tabKey = `pintar_akunguru_tab_${unlockedTeacher.id || 'default'}`;
      let savedTab: string | null = null;
      try {
        savedTab = localStorage.getItem(tabKey);
      } catch {
        savedTab = null;
      }
      if (
        savedTab &&
        (AKUN_TABS as readonly string[]).includes(savedTab) &&
        allowedRoleTabs.has(savedTab as AkunProgressTab)
      ) {
        setProgressTab(savedTab as AkunProgressTab);
      } else if (allRoles.has('Pimpinan') && !allRoles.has('Guru')) {
        setProgressTab('pimpinan');
      } else if (
        unlockedTeacher.peran === 'Musyrif' ||
        unlockedTeacher.peran === 'Musyrifah' ||
        unlockedTeacher.peran === 'Wali Asrama'
      ) {
        setProgressTab('musyrif');
      } else if (unlockedTeacher.peran === 'Wali Kelas') {
        setProgressTab('walikelas');
      } else if (unlockedTeacher.peran === 'Guru Wali') {
        setProgressTab('guruwali');
      } else if (unlockedTeacher.peran === 'Pengampu Al-Quran') {
        setProgressTab('quran');
      } else if (allowedRoleTabs.has('mengajar')) {
        setProgressTab('mengajar');
      } else {
        const firstAllowed = Array.from(allowedRoleTabs)[0] || 'mengajar';
        setProgressTab(firstAllowed);
      }
    }
  }, [unlockedTeacher]);

  useEffect(() => {
    if (unlockedTeacher) {
      saveSubTab(`pintar_akunguru_tab_${unlockedTeacher.id || 'default'}`, progressTab);
    }
  }, [progressTab, unlockedTeacher]);

  const fetchRecap = (namaGuru: string) => {
    const cacheKey = `pintar_recap_cache_${unlockedTeacher?.id || namaGuru}`;
    if (!recap) {
      try {
        const cachedRaw = sessionStorage.getItem(cacheKey);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as TeacherRecapResponse;
          if (parsed && parsed.teacher) setRecap(parsed);
        }
      } catch {
        // Ignore
      }
    }
    setLoadingRecap(true);
    const qs = new URLSearchParams({ namaGuru, tanggal: today });
    if (unlockedTeacher?.username) qs.set('username', unlockedTeacher.username);
    if (unlockedTeacher?.id) qs.set('id', unlockedTeacher.id);
    fetch(`/api/guru/rekap?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as TeacherRecapResponse;
      })
      .then((data) => {
        if (data && data.teacher) {
          setRecap(data);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
          } catch {
            // Ignore
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingRecap(false));
  };

  const fetchHalaqahRecap = (namaGuru: string, isSuperOrPimpinan = false) => {
    setLoadingHalaqah(true);
    fetch(`/api/halaqah/rekap?guru=${encodeURIComponent(namaGuru)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.rows) && data.rows.length > 0) {
          setHalaqahRows(data.rows);
        } else if (isSuperOrPimpinan) {
          fetch('/api/halaqah/rekap')
            .then((r2) => r2.json())
            .then((allData) => setHalaqahRows(allData?.rows || []));
        } else {
          setHalaqahRows([]);
        }
      })
      .finally(() => setLoadingHalaqah(false));
  };

  const fetchWaDashboard = () => {
    fetch('/api/whatsapp/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data?.config) {
          setWaProvider(data.config.provider || 'Fonnte');
          setWaToken(data.config.apiToken || '');
          setWaAutoAlfa(data.config.autoNotifyAlfa !== false);
          setWaAutoEskalasi(data.config.autoNotifyEskalasi !== false);
        }
        setWaLogs(data?.logs || []);
      })
      .catch(() => {});
  };

  const fetchPimpinanExecutiveReport = (wilayah: WilayahFilter) => {
    setLoadingPimpinan(true);
    fetch(`/api/pimpinan/laporan-lengkap?wilayah=${encodeURIComponent(wilayah)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PimpinanExecutiveReport | null) => {
        if (data && data.summaryCounts) {
          setPimpinanReport(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPimpinan(false));
  };

  useEffect(() => {
    if (unlockedTeacher) {
      const roles = new Set<UserRole>([
        unlockedTeacher.peran,
        ...(unlockedTeacher.peranTambahan || []),
      ]);
      const isSuperOrPimpinan =
        roles.has('Admin Super') || roles.has('Admin SIM') || roles.has('Pimpinan');
      fetchRecap(unlockedTeacher.nama);
      if (isSuperOrPimpinan || roles.has('Pengampu Al-Quran')) {
        fetchHalaqahRecap(unlockedTeacher.nama, isSuperOrPimpinan);
      } else {
        setHalaqahRows([]);
      }
      fetchWaDashboard();
      if (isSuperOrPimpinan) {
        fetchPimpinanExecutiveReport(pimpinanWilayah);
      }
    } else {
      setRecap(null);
      setPimpinanReport(null);
    }
  }, [unlockedTeacher]);

  useEffect(() => {
    if (unlockedTeacher) {
      const roles = new Set<UserRole>([
        unlockedTeacher.peran,
        ...(unlockedTeacher.peranTambahan || []),
      ]);
      if (roles.has('Admin Super') || roles.has('Admin SIM') || roles.has('Pimpinan') || showAllRoleTabs) {
        fetchPimpinanExecutiveReport(pimpinanWilayah);
      }
    }
  }, [pimpinanWilayah, unlockedTeacher, showAllRoleTabs]);

  useEffect(() => {
    if (!unlockedTeacher) return;
    const onSync = () => {
      const roles = new Set<UserRole>([
        unlockedTeacher.peran,
        ...(unlockedTeacher.peranTambahan || []),
      ]);
      const isSuperOrPimpinan =
        roles.has('Admin Super') || roles.has('Admin SIM') || roles.has('Pimpinan');
      fetchRecap(unlockedTeacher.nama);
      if (isSuperOrPimpinan || roles.has('Pengampu Al-Quran')) {
        fetchHalaqahRecap(unlockedTeacher.nama, isSuperOrPimpinan);
      }
      if (isSuperOrPimpinan || showAllRoleTabs) {
        fetchPimpinanExecutiveReport(pimpinanWilayah);
      }
    };
    window.addEventListener('pintar:data-restored', onSync);
    window.addEventListener('pintar:data-mutated', onSync);
    return () => {
      window.removeEventListener('pintar:data-restored', onSync);
      window.removeEventListener('pintar:data-mutated', onSync);
    };
  }, [unlockedTeacher, pimpinanWilayah, showAllRoleTabs]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCustom = customNameInput.trim();
    const cleanPin = pin.trim();
    const targetIdentifier = cleanCustom || selectedName || cleanPin;
    if (!targetIdentifier) {
      notify('Pilih nama pegawai atau masukkan Token Akses / PIN.', 'error');
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch('/api/guru/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namaGuru: targetIdentifier,
          pin: cleanPin || targetIdentifier,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        notify(data.error || 'Token / PIN tidak cocok dengan Database Pegawai.', 'error');
        return;
      }
      onUnlock(data.teacher);
      const rolesStr = Array.from(
        new Set([data.teacher.peran, ...(data.teacher.peranTambahan || [])]),
      ).join(', ');
      notify(
        `Selamat datang, ${data.teacher.nama}. Akses fitur dibuka sesuai peran: ${rolesStr}.`,
        'success',
      );
    } catch {
      notify('Gagal memverifikasi Token / PIN akun pegawai.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyPersonalLink = (nama: string) => {
    const url = `${window.location.origin}/?guru=${encodeURIComponent(nama)}`;
    navigator.clipboard.writeText(url);
    notify(`Link Presensi Cepat untuk ${nama} berhasil disalin.`, 'success');
  };

  const handleExportRecapCsv = () => {
    if (!recap) return;
    const header = ['Tanggal', 'Divisi', 'Kelas / Kamar', 'Mapel', 'Materi / Catatan', 'Hadir/Telat', 'S/I/A', 'Total Santri'];
    const rows = recap.sessions.map((s) => [
      formatTanggalIndo(s.tanggal),
      s.jenisPresensi,
      s.kelas,
      s.mapel,
      s.materi,
      String(s.hadir),
      String(s.tidakHadir),
      String(s.totalSiswa),
    ]);
    downloadCsv(`Rekap_Mengajar_${recap.teacher.nama.replace(/\s+/g, '_')}.csv`, [header, ...rows]);
    notify('Rekap pribadi guru berhasil diunduh.', 'success');
  };

  const buildClientPersonalFallbackSpec = (teacher: TeacherPublic): DatabaseWorkbookSpec => {
    const defWilayah: Gender = teacher.genderScope === 'Putri' ? 'Putri' : 'Putra';
    const cleanUser = (teacher.username || teacher.nama)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.|\.$/g, '') || 'pembina';
    const waliStudents = recap?.waliStudents || [];
    const putraSample =
      waliStudents.length > 0 && defWilayah === 'Putra'
        ? waliStudents.map((s, i) => [s.id || String(i + 1), s.nama, 'Putra', s.kelas, s.kamar, '', teacher.nama])
        : [['1001', 'CONTOH SANTRI PUTRA', 'Putra', teacher.waliKelasOf || '10 ABU BAKAR AS-SHIDDIQ', teacher.kamarBinaan?.[0] || '10.1 Putra', '10-01 Putra', teacher.nama]];
    const putriSample =
      waliStudents.length > 0 && defWilayah === 'Putri'
        ? waliStudents.map((s, i) => [s.id || `P-${i + 1}`, s.nama, 'Putri', s.kelas, s.kamar, '', teacher.nama])
        : [['P-01', 'CONTOH SANTRI PUTRI', 'Putri', teacher.waliKelasOf || '10 KHADIJAH BINTI KHUWAILID', teacher.kamarBinaan?.[0] || '10.1 Putri', '10-01 Putri', teacher.nama]];
    const mySchedules = recap?.allMySchedules || [];
    const jadwalRows: string[][] = [
      ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
      ...(mySchedules.length > 0
        ? mySchedules.map((s) => [s.guru, s.hari, s.kelas, s.mapel, s.jamKe, s.gender])
        : [[teacher.nama, 'SENIN', teacher.waliKelasOf || '10 ABU BAKAR AS-SHIDDIQ', 'BAHASA ARAB', '1-2', defWilayah]]),
    ];
    return {
      filename: `Template_Upload_${cleanUser}.xlsx`,
      sourceLabel: `Template Login ${teacher.nama}`,
      sheets: [
        {
          name: '0_Panduan_Login',
          label: 'Panduan Login Pembina',
          rows: [
            [`TEMPLATE UPLOAD KHUSUS LOGIN: ${teacher.nama} (${teacher.peran})`],
            ['Upload kembali melalui menu Login Guru/Wali/Musyrif -> tab Upload Template & Input Langsung.'],
          ],
        },
        {
          name: '1A_Siswa_Putra',
          label: 'Santri Wilayah Putra',
          rows: [['No / NIS', 'Nama', 'Wilayah (Putra/Putri)', 'Nama Kelas', 'Kamar', 'Kelp. Al-Quran', 'Pengampu Al-Quran'], ...putraSample],
        },
        {
          name: '1B_Siswa_Putri',
          label: 'Santri Wilayah Putri',
          rows: [['No / NIS', 'Nama', 'Wilayah (Putra/Putri)', 'Nama Kelas', 'Kamar', 'Kelp. Al-Quran', 'Pengampu Al-Quran'], ...putriSample],
        },
        { name: '4_Jadwal_Mengajar', label: 'Jadwal Saya', rows: jadwalRows },
        {
          name: '6_Catatan_Pembinaan',
          label: 'Upload Pembinaan',
          rows: [
            ['Tanggal (YYYY-MM-DD)', 'Nama Santri', 'Wilayah (Putra/Putri)', 'Kategori', 'Uraian Pembinaan / Catatan', 'Poin (+/-)', 'Status (Selesai/Proses/Eskalasi)', 'Tindak Lanjut'],
            [today, waliStudents[0]?.nama || 'CONTOH NAMA SANTRI', defWilayah, 'Pemantauan Ibadah', 'Setoran hafalan lancar dan sholat berjamaah tertib.', '5', 'Selesai', 'Pertahankan murojaah harian'],
          ],
        },
      ],
    };
  };

  const handleDownloadPersonalTemplate = async () => {
    if (!unlockedTeacher) return;
    setDownloadingTpl(true);
    try {
      const qs = new URLSearchParams({
        namaGuru: unlockedTeacher.nama,
        username: unlockedTeacher.username || '',
        id: unlockedTeacher.id || '',
        peran: unlockedTeacher.peran || 'Guru',
        genderScope: unlockedTeacher.genderScope || 'Semua',
        waliKelasOf: unlockedTeacher.waliKelasOf || '',
        kamarBinaan: (unlockedTeacher.kamarBinaan || []).join('; '),
      });
      const res = await fetch(`/api/templates/personal-data?${qs.toString()}`);
      const rawText = await res.text();
      if (res.ok && rawText.trim().startsWith('{')) {
        const spec = JSON.parse(rawText) as DatabaseWorkbookSpec;
        if (spec && Array.isArray(spec.sheets) && spec.sheets.length > 0) {
          triggerExcelDownloadFromSpec(spec);
          notify(`Mengunduh ${spec.filename} (Format Putra & Putri khusus akun ${unlockedTeacher.nama}).`, 'success');
          return;
        }
      }
      // Fallback safely to client-side template builder if server returned HTML or transient error
      const fallbackSpec = buildClientPersonalFallbackSpec(unlockedTeacher);
      triggerExcelDownloadFromSpec(fallbackSpec);
      notify(`Mengunduh ${fallbackSpec.filename} (Format Excel siap isi & upload).`, 'success');
    } catch {
      const fallbackSpec = buildClientPersonalFallbackSpec(unlockedTeacher);
      triggerExcelDownloadFromSpec(fallbackSpec);
      notify(`Mengunduh ${fallbackSpec.filename} dari builder lokal browser.`, 'success');
    } finally {
      setDownloadingTpl(false);
    }
  };

  const handlePersonalExcelPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) return;
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        setPersonalExcel(parsed);
        notify(`File ${file.name} berhasil dibaca. Periksa ringkasan lalu simpan ke akun ini.`, 'success');
      } catch {
        notify('Gagal membaca file Excel (.xlsx/.xls).', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmitPersonalExcel = async () => {
    if (!unlockedTeacher || !personalExcel) return;
    setUploadingPersonal(true);
    try {
      const res = await fetch('/api/guru/import-personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: unlockedTeacher.nama,
          santriRows: personalExcel.santriRows,
          scheduleRows: personalExcel.scheduleRows,
          pembinaanRows: personalExcel.pembinaanRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data upload.');
      notify(
        `Upload selesai! Santri: ${data.santriInserted} baru/${data.santriUpdated} update · Jadwal: ${data.schedulesAdded} · Pembinaan: ${data.pembinaanSaved}.`,
        'success',
      );
      setPersonalExcel(null);
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setUploadingPersonal(false);
    }
  };

  const handleDirectSaveSantri = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedTeacher) return;
    if (!inNamaSantri.trim() || !inKelas.trim()) {
      notify('Nama santri dan Nama Kelas wajib diisi.', 'error');
      return;
    }
    setSavingSantri(true);
    try {
      const res = await fetch('/api/guru/import-personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherName: unlockedTeacher.nama,
          santriRows: [
            {
              nis: inNis.trim(),
              nama: inNamaSantri.trim(),
              kelas: inKelas.trim(),
              kamar: inKamar.trim(),
              kelompokQuran: inKelompok.trim(),
              pengampuQuran: unlockedTeacher.nama,
              gender: inWilayah,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan santri.');
      setInNis('');
      setInNamaSantri('');
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
      notify(`Santri ${inNamaSantri.trim().toUpperCase()} (Wilayah ${inWilayah}) disimpan di akun Anda.`, 'success');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingSantri(false);
    }
  };

  // Live Clash Detection whenever Hari, Jam/Sesi, Kelas/Halaqah, or Wilayah changes
  useEffect(() => {
    if (!unlockedTeacher || !inJadwalKelas.trim() || !inJam.trim()) {
      setClashCheckResult(null);
      return;
    }
    let cancelled = false;
    fetch('/api/jadwal/check-clash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guru: unlockedTeacher.nama,
        hari: inHari,
        kelas: inJadwalKelas.trim(),
        jamKe: inJam.trim(),
        gender: inJadwalWilayah,
        excludeId: editingJadwalId || undefined,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!cancelled && res) {
          setClashCheckResult(res);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [unlockedTeacher, inHari, inJam, inJadwalKelas, inJadwalWilayah, editingJadwalId]);

  const handleToggleScheduleApprovalMode = async (required: boolean) => {
    if (!unlockedTeacher) return;
    setTogglingApprovalMode(true);
    try {
      const res = await fetch('/api/jadwal/approval-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ required }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        fetchRecap(unlockedTeacher.nama);
        notify(data.message, 'info');
      }
    } finally {
      setTogglingApprovalMode(false);
    }
  };

  const handleApproveScheduleItem = async (id: string) => {
    if (!unlockedTeacher) return;
    const res = await fetch(`/api/jadwal/${id}/approve`, { method: 'POST' });
    if (res.ok) {
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
      notify('Perubahan jadwal telah disetujui oleh Kurikulum / Admin dan langsung aktif.', 'success');
    }
  };

  const handleDirectSaveJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedTeacher) return;
    if (!inJadwalKelas.trim() || !inMapel.trim()) {
      notify('Kelas/Halaqah dan Mata Pelajaran/Program wajib diisi.', 'error');
      return;
    }
    if (clashCheckResult?.clash) {
      notify(
        clashCheckResult.reason ||
          'Terdeteksi bentrok jadwal pada hari dan jam yang sama. Silakan pilih jam/sesi atau kelas lain.',
        'error',
      );
      return;
    }
    setSavingJadwal(true);
    try {
      const approvalStatus = 'APPROVED';
      if (editingJadwalId) {
        const res = await fetch(`/api/jadwal/${editingJadwalId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guru: unlockedTeacher.nama,
            hari: inHari,
            kelas: inJadwalKelas.trim(),
            mapel: inMapel.trim(),
            jamKe: inJam.trim() || '1-2',
            ruang: inRuang.trim() || undefined,
            gender: inJadwalWilayah,
            kategori: inKategoriJadwal,
            approvalStatus,
            allowOverride: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui jadwal (terdeteksi bentrok).');
        setEditingJadwalId(null);
        setInMapel('');
        setInRuang('');
        setActiveMatrixCell(null);
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        window.dispatchEvent(new CustomEvent('pintar:data-mutated'));
        notify(
          `Jadwal ${inHari} (${inJadwalKelas.toUpperCase()}) berhasil diperbarui & langsung berlaku otomatis di Matriks Pekanan serta Menu Presensi.`,
          'success',
        );
      } else {
        const res = await fetch('/api/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guru: unlockedTeacher.nama,
            hari: inHari,
            kelas: inJadwalKelas.trim(),
            mapel: inMapel.trim(),
            jamKe: inJam.trim() || '1-2',
            ruang: inRuang.trim() || undefined,
            gender: inJadwalWilayah,
            kategori: inKategoriJadwal,
            approvalStatus,
            allowOverride: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan jadwal (terdeteksi bentrok).');
        setInMapel('');
        setInRuang('');
        setActiveMatrixCell(null);
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        window.dispatchEvent(new CustomEvent('pintar:data-mutated'));
        notify(
          `Jadwal ${inHari} (${inJadwalKelas.toUpperCase()}) ditambahkan & langsung berlaku otomatis di Matriks Pekanan serta Menu Presensi.`,
          'success',
        );
      }
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingJadwal(false);
    }
  };

  const handleStartEditPersonalJadwal = (item: ScheduleItem) => {
    setEditingJadwalId(item.id);
    setInKategoriJadwal(
      item.kategori ||
        (item.mapel.toUpperCase().includes('QUR') || item.mapel.toUpperCase().includes('HALAQAH')
          ? 'Al-Quran'
          : 'Akademik')
    );
    setInHari(item.hari);
    setInJadwalWilayah(item.gender);
    setInJadwalKelas(item.kelas);
    setInMapel(item.mapel);
    setInJam(item.jamKe);
    setInRuang(item.ruang || '');
    setActiveMatrixCell(item);
    notify(`Mode Edit Jadwal aktif: ${item.hari} · ${item.kelas} (${item.mapel}).`, 'info');
  };

  const handleDeletePersonalJadwal = async (id: string) => {
    if (!unlockedTeacher) return;
    const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingJadwalId === id) {
        setEditingJadwalId(null);
        setInMapel('');
        setInRuang('');
      }
      if (activeMatrixCell?.id === id) {
        setActiveMatrixCell(null);
      }
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
      window.dispatchEvent(new CustomEvent('pintar:data-mutated'));
      notify('Jadwal berhasil dihapus & langsung disinkronkan secara otomatis dari Matriks Pekanan serta Menu Presensi.', 'info');
    }
  };

  const handleDownloadMyJadwalExcel = (mode: 'blank' | 'filled') => {
    if (!unlockedTeacher) return;
    if (mode === 'blank') {
      const fname = downloadComponentExcelTemplate('jadwal', 'blank');
      notify(`Mengunduh ${fname} (Template Kosong Jadwal Akademik & Al-Qur'an).`, 'success');
      return;
    }
    const mySchedules = recap?.allMySchedules || [];
    const defG = unlockedTeacher.genderScope === 'Putri' ? 'Putri' : 'Putra';
    const rows: string[][] = [
      ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
      ...(mySchedules.length > 0
        ? mySchedules.map((s) => [s.guru, s.hari, s.kelas, s.mapel, s.jamKe, s.gender])
        : [
            [
              unlockedTeacher.nama,
              'SENIN',
              unlockedTeacher.waliKelasOf || (defG === 'Putri' ? '10 KHADIJAH' : '10 ABU BAKAR AS-SHIDDIQ'),
              'BAHASA ARAB',
              '1-2',
              defG,
            ],
            [
              unlockedTeacher.nama,
              'SELASA',
              defG === 'Putri' ? '10-01 Putri' : '10-08 Putra',
              "HALAQAH AL-QUR'AN",
              '3-4',
              defG,
            ],
          ]),
    ];
    triggerExcelDownloadFromSpec({
      filename: `Jadwal_${unlockedTeacher.nama.replace(/[^A-Za-z0-9]+/g, '_')}.xlsx`,
      sourceLabel: `Jadwal ${unlockedTeacher.nama}`,
      sheets: [{ name: '4_Jadwal_Mengajar', label: 'Jadwal Saya', rows }],
    });
    notify(`Berhasil mengunduh jadwal ${unlockedTeacher.nama} ke Excel (.xlsx).`, 'success');
  };

  const handleUploadMyJadwalExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !unlockedTeacher) return;
    setUploadingJadwalExcel(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) {
        setUploadingJadwalExcel(false);
        return;
      }
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        if (parsed.scheduleRows.length === 0) {
          throw new Error(
            'File Excel tidak berisi baris jadwal valid. Pastikan menggunakan Template Jadwal Mengajar.'
          );
        }
        const rowsForMe = parsed.scheduleRows.map((r) => ({
          ...r,
          guru: r.guru?.trim() ? r.guru.trim().toUpperCase() : unlockedTeacher.nama,
        }));
        const res = await fetch('/api/import/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rowsForMe, replaceExisting: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengimpor jadwal Excel.');
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        window.dispatchEvent(new CustomEvent('pintar:data-mutated'));
        notify(
          `Upload Excel Jadwal berhasil! (${data.added || 0} jadwal baru ditambahkan, ${data.updated || 0} jadwal lama diperbarui) & langsung berlaku otomatis di Matriks dan Menu Presensi.`,
          'success'
        );
      } catch (err) {
        notify((err as Error).message, 'error');
      } finally {
        setUploadingJadwalExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderInlineScheduleWorkbench = (roleContext: 'Akademik' | 'Al-Quran') => {
    if (!unlockedTeacher) return null;
    const mySchedules = recap?.allMySchedules || [];
    const allSysSchedules = recap?.allSystemSchedules || mySchedules;
    const isApprovalRequired = Boolean(recap?.scheduleApprovalRequired);
    const daysColumns = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD'] as const;

    const defaultSlots =
      roleContext === 'Al-Quran'
        ? [
            { code: "Ba'da Subuh", label: "Sesi 1 · Ba'da Subuh", time: '05.15 – 06.30' },
            { code: 'Dhuha', label: 'Sesi 2 · Dhuha / Pagi', time: '07.00 – 08.30' },
            { code: '1-2', label: 'Jam 1-2 (Halaqah Pagi)', time: '07.00 – 08.30' },
            { code: '3-4', label: 'Jam 3-4 (Halaqah Dhuha)', time: '08.30 – 10.00' },
            { code: "Ba'da Ashar", label: "Sesi 3 · Ba'da Ashar", time: '15.45 – 17.00' },
            { code: "Ba'da Maghrib", label: "Sesi 4 · Ba'da Maghrib", time: '18.15 – 19.30' },
          ]
        : [
            { code: '1-2', label: 'Jam 1-2', time: '07.00 – 08.30' },
            { code: '3-4', label: 'Jam 3-4', time: '08.30 – 10.00' },
            { code: '5-6', label: 'Jam 5-6', time: '10.15 – 11.45' },
            { code: '7-8', label: 'Jam 7-8', time: '13.00 – 14.30' },
            { code: '9-10', label: 'Jam 9-10', time: '14.30 – 16.00' },
          ];

    // Include any custom jamKe present in teacher's schedules so no schedule is ever hidden
    const knownCodes = new Set(defaultSlots.map((s) => s.code.toUpperCase()));
    const extraSlots = mySchedules
      .map((s) => s.jamKe.trim())
      .filter((jk) => jk && !knownCodes.has(jk.toUpperCase()))
      .filter((jk, idx, arr) => arr.findIndex((x) => x.toUpperCase() === jk.toUpperCase()) === idx)
      .map((jk) => ({
        code: jk,
        label: jk.match(/^\d/) ? `Jam ${jk}` : `Sesi ${jk}`,
        time: 'Sesuai Sesi',
      }));

    const matrixRows = [...defaultSlots, ...extraSlots];

    const handleMatrixEmptyCellClick = (hari: string, slotCode: string) => {
      setEditingJadwalId(null);
      setActiveMatrixCell(null);
      setInKategoriJadwal(roleContext);
      setInHari(hari);
      setInJam(slotCode);
      if (roleContext === 'Al-Quran' && !inMapel) {
        setInMapel("HALAQAH AL-QUR'AN");
      }
      notify(
        `Sel kosong dipilih: ${hari} · ${slotCode}. Silakan isi Kelas/Halaqah & Mapel pada form di bawah lalu klik Simpan.`,
        'info',
      );
    };

    return (
      <div className="rounded-xl border border-teal-200 bg-white overflow-hidden shadow-xs space-y-0">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-teal-50/90 via-emerald-50/50 to-white px-5 py-4 border-b border-slate-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                1. Modul Jadwal Pekanan (Tabel Matriks Pekanan — {roleContext === 'Al-Quran' ? "Sesi Halaqah Al-Qur'an" : 'Jam Pelajaran Akademik'})
              </h3>
              <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-900">
                {mySchedules.length} Sesi Terdaftar · Anti-Bentrok Otomatis
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Klik <b>sel kosong (+ Tambah)</b> pada matriks untuk menambah jadwal di hari/jam tersebut, atau klik <b>sel terisi</b> untuk pintasan langsung <b>&quot;Isi Absensi&quot;</b>, <b>&quot;Catat Progres Materi/Hafalan&quot;</b>, <b>Edit</b>, atau <b>Hapus</b>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Status Kebijakan Aktif Default: Mode ✓ Berlaku Otomatis */}
            <div
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-900 shadow-2xs"
              title="Setiap penambahan, perubahan, atau penghapusan jadwal oleh guru langsung berlaku otomatis di Matriks Pekanan dan Menu Presensi selama lolos Validasi Anti-Bentrok"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Mode ✓ Berlaku Otomatis (Aktif Default · Sinkron Matriks &amp; Presensi)</span>
            </div>

            <button
              type="button"
              onClick={() => handleDownloadMyJadwalExcel('blank')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-teal-700" />
              Template (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleDownloadMyJadwalExcel('filled')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-teal-700" />
              Unduh Jadwal (.xlsx)
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1324] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="h-3.5 w-3.5 text-teal-300" />
              <span>{uploadingJadwalExcel ? 'Mengupload...' : 'Upload Excel'}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                disabled={uploadingJadwalExcel}
                onChange={handleUploadMyJadwalExcel}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Pintasan Langsung Banner when a Filled Matrix Cell is clicked */}
        {activeMatrixCell && (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-5 py-3 text-white flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-white/20 px-2 py-0.5 font-mono-num font-bold">
                {activeMatrixCell.hari} · {activeMatrixCell.jamKe}
              </span>
              <span className="font-extrabold text-sm">
                {activeMatrixCell.kelas} — {activeMatrixCell.mapel}
              </span>
              <span className="text-teal-100">
                ({activeMatrixCell.ruang || `Ruang ${activeMatrixCell.kelas}`} · Wilayah {activeMatrixCell.gender})
              </span>
              {activeMatrixCell.approvalStatus === 'PENDING_APPROVAL' && (
                <span className="rounded bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-950">
                  Menunggu Approval Kurikulum
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const isQuranCell =
                    activeMatrixCell.kategori === 'Al-Quran' ||
                    activeMatrixCell.mapel.toUpperCase().includes('QUR') ||
                    activeMatrixCell.mapel.toUpperCase().includes('HALAQAH') ||
                    roleContext === 'Al-Quran';
                  onOpenQuickPresensi(unlockedTeacher.nama, {
                    jenis: isQuranCell ? 'Al-Quran' : 'Belajar',
                    gender: activeMatrixCell.gender,
                    target: isQuranCell
                      ? activeMatrixCell.kelas
                      : `${activeMatrixCell.kelas}|${activeMatrixCell.mapel}`,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold text-teal-900 hover:bg-teal-50 shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Isi Absensi Sesi Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  const isQuranCell =
                    activeMatrixCell.kategori === 'Al-Quran' ||
                    activeMatrixCell.mapel.toUpperCase().includes('QUR') ||
                    activeMatrixCell.mapel.toUpperCase().includes('HALAQAH') ||
                    roleContext === 'Al-Quran';
                  onOpenQuickPresensi(unlockedTeacher.nama, {
                    jenis: isQuranCell ? 'Al-Quran' : 'Belajar',
                    gender: activeMatrixCell.gender,
                    target: isQuranCell
                      ? activeMatrixCell.kelas
                      : `${activeMatrixCell.kelas}|${activeMatrixCell.mapel}`,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 shadow-xs"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {roleContext === 'Al-Quran' ? 'Catat Progres Hafalan / Tahsin' : 'Catat Progres Materi (Silabus)'}
              </button>
              {activeMatrixCell.approvalStatus === 'PENDING_APPROVAL' && (
                <button
                  type="button"
                  onClick={() => handleApproveScheduleItem(activeMatrixCell.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-2.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-300"
                >
                  Setujui Jadwal
                </button>
              )}
              <button
                type="button"
                onClick={() => handleStartEditPersonalJadwal(activeMatrixCell)}
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDeletePersonalJadwal(activeMatrixCell.id)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/90 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </button>
              <button
                type="button"
                onClick={() => setActiveMatrixCell(null)}
                className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
                title="Tutup pintasan"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* TABEL MATRIKS PEKANAN (KOLOM = HARI SENIN-AHAD, BARIS = JAM PELAJARAN / SESI HALAQAH) */}
        <div className="p-5 border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-slate-800">
              Tabel Matriks Pekanan ({unlockedTeacher.nama}) — Kolom: Hari (Senin – Ahad) × Baris: {roleContext === 'Al-Quran' ? 'Sesi Halaqah' : 'Jam Pelajaran'}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-500 inline-block" /> Jadwal Akademik
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-500 inline-block" /> Sesi Halaqah Al-Qur&apos;an
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-xs border border-dashed border-slate-300 bg-slate-50 inline-block" /> Sel Kosong (Klik untuk + Tambah)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-800">
                  <th className="py-2.5 px-3 font-extrabold border-r border-slate-200 min-w-[140px]">
                    {roleContext === 'Al-Quran' ? 'Sesi Halaqah / Waktu' : 'Jam Pelajaran (JP)'}
                  </th>
                  {daysColumns.map((day) => (
                    <th
                      key={day}
                      className={`py-2.5 px-2.5 text-center font-extrabold border-r border-slate-200 min-w-[135px] ${
                        inHari === day ? 'bg-teal-50 text-teal-900' : ''
                      }`}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {matrixRows.map((slot) => (
                  <tr key={slot.code} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 border-r border-slate-200 bg-slate-50/70 align-middle">
                      <div className="font-bold text-slate-900">{slot.label}</div>
                      <div className="font-mono-num text-[10px] text-slate-500">{slot.time}</div>
                    </td>
                    {daysColumns.map((day) => {
                      const matchingCells = mySchedules.filter(
                        (s) =>
                          s.hari.toUpperCase() === day &&
                          s.jamKe.trim().toUpperCase() === slot.code.trim().toUpperCase(),
                      );
                      const isTargetEmptySelected =
                        !editingJadwalId &&
                        inHari === day &&
                        inJam.trim().toUpperCase() === slot.code.trim().toUpperCase();

                      return (
                        <td
                          key={`${day}|${slot.code}`}
                          className={`p-1.5 border-r border-slate-200 align-top transition-colors ${
                            isTargetEmptySelected ? 'bg-teal-50/60' : ''
                          }`}
                        >
                          {matchingCells.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleMatrixEmptyCellClick(day, slot.code)}
                              className={`w-full min-h-[64px] rounded-lg border border-dashed px-2 py-2 text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                                isTargetEmptySelected
                                  ? 'border-teal-500 bg-teal-50/90 text-teal-900 font-bold'
                                  : 'border-slate-200/90 bg-slate-50/30 text-slate-400 hover:border-teal-400 hover:bg-teal-50/40 hover:text-teal-700'
                              }`}
                            >
                              <span className="text-[11px] font-semibold">
                                {isTargetEmptySelected ? '+ Mengisi Slot Ini' : '+ Tambah'}
                              </span>
                              <span className="text-[9px] font-mono-num opacity-75">
                                {day.slice(0, 3)} · {slot.code}
                              </span>
                            </button>
                          ) : (
                            <div className="space-y-1.5">
                              {matchingCells.map((cell) => {
                                const isQuranCell =
                                  cell.kategori === 'Al-Quran' ||
                                  cell.mapel.toUpperCase().includes('QUR') ||
                                  cell.mapel.toUpperCase().includes('HALAQAH');
                                const isActiveCell =
                                  activeMatrixCell?.id === cell.id || editingJadwalId === cell.id;
                                return (
                                  <div
                                    key={cell.id}
                                    onClick={() => setActiveMatrixCell(cell)}
                                    className={`cursor-pointer rounded-lg border p-2 transition-all ${
                                      isActiveCell
                                        ? 'ring-2 ring-teal-600 border-teal-600 bg-teal-50 shadow-xs'
                                        : isQuranCell
                                        ? 'border-amber-300 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 hover:border-amber-400'
                                        : 'border-teal-300 bg-gradient-to-br from-teal-50/90 via-white to-sky-50/40 hover:border-teal-400'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <span
                                        className={`rounded px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                                          isQuranCell
                                            ? 'bg-amber-200/80 text-amber-950'
                                            : 'bg-teal-200/80 text-teal-950'
                                        }`}
                                      >
                                        {cell.kelas}
                                      </span>
                                      {cell.approvalStatus === 'PENDING_APPROVAL' && (
                                        <span className="rounded bg-amber-500 px-1 py-0.2 text-[8px] font-bold text-white">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 font-bold text-slate-900 text-[11px] leading-tight line-clamp-1">
                                      {cell.mapel}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-slate-600 flex items-center justify-between">
                                      <span className="truncate">
                                        {cell.ruang || (isQuranCell ? 'Masjid / Saung' : `R. ${cell.kelas.slice(0, 6)}`)}
                                      </span>
                                      <span className="font-semibold text-teal-700">{cell.gender}</span>
                                    </div>
                                    <div className="mt-1.5 pt-1 border-t border-slate-200/70 flex items-center justify-between gap-1">
                                      <button
                                        type="button"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          onOpenQuickPresensi(unlockedTeacher.nama, {
                                            jenis: isQuranCell ? 'Al-Quran' : 'Belajar',
                                            gender: cell.gender,
                                            target: isQuranCell
                                              ? cell.kelas
                                              : `${cell.kelas}|${cell.mapel}`,
                                          });
                                        }}
                                        className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-emerald-700"
                                      >
                                        Isi Absen
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          handleStartEditPersonalJadwal(cell);
                                        }}
                                        className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 hover:bg-slate-100"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form CRUD + Validasi Bentrok & Daftar Jadwal */}
        <div className="p-5 grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Form Tambah / Edit Jadwal dengan Validasi Bentrok Real-Time */}
          <form
            onSubmit={handleDirectSaveJadwal}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="text-xs font-bold text-slate-900">
                {editingJadwalId
                  ? 'Mode Edit Jadwal Pekanan'
                  : `Tambah Jadwal Pekanan (${inHari} · ${inJam})`}
              </div>
              {editingJadwalId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingJadwalId(null);
                    setInMapel('');
                    setInRuang('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Batal Edit
                </button>
              )}
            </div>

            {/* Banner Validasi Bentrok Real-Time */}
            {clashCheckResult?.clash ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950 space-y-1">
                <div className="flex items-center gap-1.5 font-extrabold text-rose-800">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>
                    Validasi Bentrok ({clashCheckResult.type === 'GURU' ? 'Bentrok Jadwal Anda Sendiri' : 'Bentrok Kelas dengan Guru Lain'})
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">{clashCheckResult.reason}</p>
              </div>
            ) : inJadwalKelas.trim() && inJam.trim() ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-900 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>
                  Slot <b>{inHari} ({inJam})</b> di <b>{inJadwalKelas.toUpperCase()}</b> aman &amp; bebas bentrok ({allSysSchedules.length} jadwal sistem diperiksa).
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kategori Jadwal</label>
                <select
                  value={inKategoriJadwal}
                  onChange={(e) => {
                    const val = e.target.value as 'Akademik' | 'Al-Quran';
                    setInKategoriJadwal(val);
                    if (val === 'Al-Quran' && !inMapel) setInMapel("HALAQAH AL-QUR'AN");
                  }}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                >
                  <option value="Akademik">Guru Akademik (KBM)</option>
                  <option value="Al-Quran">Guru Al-Qur&apos;an (Halaqah)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah</label>
                <select
                  value={inJadwalWilayah}
                  onChange={(e) => setInJadwalWilayah(e.target.value as Gender)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                >
                  <option value="Putra">Wilayah Putra</option>
                  <option value="Putri">Wilayah Putri</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hari</label>
                <select
                  value={inHari}
                  onChange={(e) => setInHari(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                >
                  {daysColumns.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {inKategoriJadwal === 'Al-Quran' ? 'Sesi Halaqah / JP' : 'Jam Pelajaran (JP)'}
                </label>
                <input
                  type="text"
                  list={`slot-options-${roleContext}`}
                  value={inJam}
                  onChange={(e) => setInJam(e.target.value)}
                  placeholder={inKategoriJadwal === 'Al-Quran' ? "Ba'da Subuh / 1-2" : '1-2 / 3-4 / 5-6'}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono-num"
                />
                <datalist id={`slot-options-${roleContext}`}>
                  <option value="1-2" />
                  <option value="3-4" />
                  <option value="5-6" />
                  <option value="7-8" />
                  <option value="9-10" />
                  <option value="Ba'da Subuh" />
                  <option value="Dhuha" />
                  <option value="Ba'da Ashar" />
                  <option value="Ba'da Maghrib" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {inKategoriJadwal === 'Al-Quran' ? 'Kelompok Halaqah *' : 'Nama Kelas Akademik *'}
                </label>
                <input
                  type="text"
                  value={inJadwalKelas}
                  onChange={(e) => setInJadwalKelas(e.target.value)}
                  placeholder={
                    inKategoriJadwal === 'Al-Quran'
                      ? inJadwalWilayah === 'Putri'
                        ? '10-01 Putri'
                        : '10-08 Putra'
                      : inJadwalWilayah === 'Putri'
                      ? '10 KHADIJAH BINTI KHUWAILID'
                      : '10 ABU BAKAR AS-SHIDDIQ'
                  }
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Ruang Kelas / Lokasi Halaqah
                </label>
                <input
                  type="text"
                  value={inRuang}
                  onChange={(e) => setInRuang(e.target.value)}
                  placeholder={inKategoriJadwal === 'Al-Quran' ? 'Masjid Lt. 1 / Saung B' : 'R. 10 IPA 1 / Labkom'}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {inKategoriJadwal === 'Al-Quran' ? 'Program Halaqah / Target Tahfidz *' : 'Mata Pelajaran *'}
              </label>
              <input
                type="text"
                value={inMapel}
                onChange={(e) => setInMapel(e.target.value)}
                placeholder={inKategoriJadwal === 'Al-Quran' ? "HALAQAH AL-QUR'AN (ZIYADAH & TAHSIN)" : 'MATEMATIKA / BAHASA ARAB'}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={savingJadwal || Boolean(clashCheckResult?.clash)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {savingJadwal
                ? 'Memvalidasi & Menyimpan...'
                : clashCheckResult?.clash
                ? 'Tidak Bisa Simpan (Bentrok Jadwal)'
                : editingJadwalId
                ? 'Simpan Perubahan Jadwal'
                : `Simpan ke Matriks (${inHari} · ${inJam})`}
            </button>
          </form>

          {/* Tabel Daftar Jadwal Saya + Pintasan Isi Absensi, Edit & Hapus */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Daftar Rincian Jadwal Pekanan ({unlockedTeacher?.nama})
              </span>
              <span className="text-[11px] text-emerald-800 font-semibold">
                Mode: <b>✓ Berlaku Otomatis (Aktif di Matriks &amp; Menu Presensi)</b>
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Hari &amp; Jam/Sesi</th>
                    <th className="px-3 py-2 font-semibold">Kelas / Halaqah &amp; Ruang</th>
                    <th className="px-3 py-2 font-semibold">Mapel / Program</th>
                    <th className="px-3 py-2 text-right font-semibold">Pintasan &amp; Aksi CRUD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mySchedules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Belum ada jadwal terdaftar. Klik langsung sel kosong pada Tabel Matriks Pekanan di atas atau isi form di samping.
                      </td>
                    </tr>
                  ) : (
                    mySchedules.map((sch) => (
                      <tr
                        key={sch.id}
                        className={`hover:bg-slate-50 ${
                          editingJadwalId === sch.id ? 'bg-teal-50/70' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{sch.hari}</div>
                          <div className="font-mono-num text-[11px] text-slate-500">Sesi/JP: {sch.jamKe}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{sch.kelas}</div>
                          <div className="text-[11px] text-slate-500">
                            {sch.ruang || `Ruang ${sch.kelas}`} · Wilayah {sch.gender}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{sch.mapel}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-semibold text-teal-700">
                              {sch.kategori || (sch.mapel.includes('QUR') ? 'Al-Quran' : 'Akademik')}
                            </span>
                            {sch.approvalStatus === 'PENDING_APPROVAL' ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-bold text-amber-900">
                                Menunggu Approval
                              </span>
                            ) : (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                                Aktif
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const isQuranRow =
                                  sch.kategori === 'Al-Quran' ||
                                  sch.mapel.toUpperCase().includes('QUR') ||
                                  sch.mapel.toUpperCase().includes('HALAQAH') ||
                                  roleContext === 'Al-Quran';
                                onOpenQuickPresensi(unlockedTeacher.nama, {
                                  jenis: isQuranRow ? 'Al-Quran' : 'Belajar',
                                  gender: sch.gender,
                                  target: isQuranRow ? sch.kelas : `${sch.kelas}|${sch.mapel}`,
                                });
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                              title="Isi Absensi & Catat Progres Materi/Hafalan"
                            >
                              Isi Absen &amp; Materi
                            </button>
                            {sch.approvalStatus === 'PENDING_APPROVAL' && (
                              <button
                                type="button"
                                onClick={() => handleApproveScheduleItem(sch.id)}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleStartEditPersonalJadwal(sch)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePersonalJadwal(sch.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedTeacher) return;
    setSavingProfile(true);
    try {
      const kamarArr = editKamarBinaan
        .split(/[;,]/)
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await fetch(`/api/guru/${unlockedTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genderScope: editScope,
          waliKelasOf: editWaliKelas.trim(),
          kamarBinaan: kamarArr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui penugasan.');
      onUnlock(data.teacher);
      fetchRecap(data.teacher.nama);
      onDataUpdated?.();
      notify('Penugasan wilayah, kelas wali, dan kamar binaan diperbarui.', 'success');
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!unlockedTeacher) {
    const selectedTeacherObj = teachers.find((t) => t.nama === selectedName) || null;
    return (
      <div className="mx-auto max-w-xl py-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 border border-teal-200 px-2.5 py-1 text-[11px] font-bold text-teal-900 mb-2">
              <KeyRound className="h-3.5 w-3.5 text-teal-700" />
              Akses Terpusat Database Pegawai &amp; Token Peran
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Login Dasbor Peran: Guru, Wali Kelas, Wali Asrama, Guru Wali &amp; Pimpinan
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Setiap guru dari modul manapun otomatis tercatat di <b>Database Pegawai</b>. Masuk menggunakan <b>Token Akses (`PN-XXXX`)</b> dari Kartu Login yang diberikan Admin (atau PIN <code>1234</code>). Fitur dan laporan yang tampil otomatis menyesuaikan peran Anda.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            {teachers.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  1. Pilih Nama dari Database Pegawai ({teachers.length} Pegawai Terdaftar)
                </label>
                <select
                  value={selectedName}
                  onChange={(e) => {
                    setSelectedName(e.target.value);
                    setCustomNameInput('');
                  }}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  {teachers.map((t) => {
                    const rolesList = Array.from(
                      new Set([t.peran, ...(t.peranTambahan || [])]),
                    ).join(', ');
                    return (
                      <option key={t.id} value={t.nama}>
                        {t.nama} — [{rolesList}] · Wilayah {t.genderScope}
                        {t.waliKelasOf ? ` (Wali ${t.waliKelasOf})` : ''}
                      </option>
                    );
                  })}
                </select>
                {selectedTeacherObj && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                    <span>Peran di Database Pegawai:</span>
                    {Array.from(
                      new Set([
                        selectedTeacherObj.peran,
                        ...(selectedTeacherObj.peranTambahan || []),
                      ]),
                    ).map((r) => (
                      <span
                        key={r}
                        className={`rounded px-1.5 py-0.5 font-semibold ${
                          r === 'Pimpinan'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-teal-50 text-teal-800 border border-teal-200'
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Atau Ketik Nama Guru / Langsung Masukkan Token Unik Pegawai
              </label>
              <input
                type="text"
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                placeholder="Ketik nama guru baru/lama atau biarkan kosong jika sudah memilih di atas"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Jika nama guru belum ada di daftar atas, ketik nama lengkap Anda di sini + PIN <code>1234</code> untuk otomatis masuk ke Database Pegawai.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  2. Token Akses / PIN Pegawai *
                </label>
                <span className="font-mono-num text-[11px] font-semibold text-teal-700">
                  Token Kartu (PN-XXXX) atau PIN: 1234
                </span>
              </div>
              <input
                type="text"
                maxLength={20}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan Token Kartu Login (misal: PN-4821) atau PIN 1234..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono-num uppercase tracking-wider focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={verifying || (!selectedName && !customNameInput.trim() && !pin.trim())}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
              >
                <KeyRound className="h-4 w-4" />
                {verifying ? 'Memverifikasi Token Pegawai...' : 'Masuk Sesuai Peran Database Pegawai'}
              </button>
              {onOpenRegisterPortal && (
                <button
                  type="button"
                  onClick={onOpenRegisterPortal}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Daftar Akun Baru
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  const allMyRoles = Array.from(
    new Set<UserRole>([unlockedTeacher.peran, ...(unlockedTeacher.peranTambahan || [])].filter(Boolean)),
  );
  const isAdminSuperOrSim =
    allMyRoles.includes('Admin Super') || allMyRoles.includes('Admin SIM');
  const isPimpinanOrAdmin =
    isAdminSuperOrSim || allMyRoles.includes('Pimpinan');
  const hasRoleGuru =
    isAdminSuperOrSim ||
    allMyRoles.includes('Guru') ||
    allMyRoles.length === 0;
  const hasRoleWaliKelas =
    isAdminSuperOrSim ||
    allMyRoles.includes('Wali Kelas');
  const hasRoleWaliAsrama =
    isAdminSuperOrSim ||
    allMyRoles.includes('Wali Asrama') ||
    allMyRoles.includes('Musyrif') ||
    allMyRoles.includes('Musyrifah');
  const hasRoleGuruWali =
    isAdminSuperOrSim ||
    allMyRoles.includes('Guru Wali');
  const hasRoleQuran =
    isAdminSuperOrSim ||
    allMyRoles.includes('Pengampu Al-Quran');

  const ownedRoleModulesCount = [
    hasRoleGuru,
    hasRoleQuran,
    hasRoleWaliAsrama,
    hasRoleWaliKelas,
    hasRoleGuruWali,
    isPimpinanOrAdmin,
  ].filter(Boolean).length;
  const isMultiRoleTeacher = ownedRoleModulesCount > 1;
  const activeTokenStr = resolveTeacherToken(unlockedTeacher);

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="rounded-xl border border-teal-200/80 bg-gradient-to-r from-sky-50/70 via-white to-teal-50/60 p-5 shadow-xs flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <UserCheck className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">{unlockedTeacher.nama}</h2>
            <span className="rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 font-mono-num text-xs font-bold text-amber-950">
              Token Login: {activeTokenStr}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                isMultiRoleTeacher
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-900'
              }`}
            >
              {isMultiRoleTeacher
                ? `Multi-Peran (${ownedRoleModulesCount} Amanah)`
                : '1 Peran Sesuai Template'}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Hak Akses Peran Sesuai Template:</span>
            {allMyRoles.map((r) => (
              <span
                key={r}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  r === 'Pimpinan'
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-teal-200 bg-teal-50 text-teal-900'
                }`}
              >
                {r === 'Guru' ? 'Guru (Jadwal Mengajar)' : r}
              </span>
            ))}
            <span aria-hidden="true">·</span>
            <span>Wilayah {unlockedTeacher.genderScope}</span>
            {hasRoleWaliKelas && unlockedTeacher.waliKelasOf && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-teal-700">Wali Kelas {unlockedTeacher.waliKelasOf}</span>
              </>
            )}
            {hasRoleWaliAsrama && unlockedTeacher.kamarBinaan && unlockedTeacher.kamarBinaan.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-sky-700">Kamar: {unlockedTeacher.kamarBinaan.join(', ')}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              downloadLoginAccessCardsPdf([unlockedTeacher], {
                title: `KARTU AKSES LOGIN — ${unlockedTeacher.nama}`,
                subtitle: `Token Login: ${activeTokenStr} · Peran: ${allMyRoles.join(', ')}`,
              });
              notify(`Kartu Akses Login PDF untuk ${unlockedTeacher.nama} berhasil diunduh.`, 'success');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-700" />
            Unduh Kartu Login Saya (PDF)
          </button>
          <button
            type="button"
            onClick={() => handleCopyPersonalLink(unlockedTeacher.nama)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Salin Link Presensi
          </button>
          <button
            type="button"
            onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Input Presensi
          </button>
          {(hasRoleWaliKelas || hasRoleWaliAsrama || hasRoleGuruWali || isPimpinanOrAdmin) && (
            <button
              type="button"
              onClick={onOpenWaliKelas}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 shadow-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Pembinaan &amp; Portofolio
            </button>
          )}
          {isAdminSuperOrSim && (
            <button
              type="button"
              onClick={() => setShowAllRoleTabs((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              title="Pratinjau Admin Super: Tampilkan semua tab peran"
            >
              {showAllRoleTabs ? 'Sesuaikan Peran Saya' : 'Pratinjau Semua Peran'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onUnlock(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </div>

      {/* Role Switcher & Navigation Bar — Strictly Filtered by Template Roles (No Excess Roles) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-bold text-teal-900">
              <Sparkles className="h-3.5 w-3.5 text-teal-600" />
              {isMultiRoleTeacher
                ? 'Pindah Peran (Multi-Peran Sesuai Template)'
                : 'Fokus Peran Aktif Sesuai Template'}
            </span>
            <span className="text-xs text-slate-600">
              {isMultiRoleTeacher
                ? `Akun Anda memiliki ${ownedRoleModulesCount} peran (${allMyRoles.join(' + ')}) — pilih peran di bawah:`
                : hasRoleGuru && !hasRoleQuran && !hasRoleWaliAsrama && !hasRoleWaliKelas && !hasRoleGuruWali
                ? 'Akun Guru Akademik murni (Jadwal Mengajar Pekanan, Laju Materi & Kehadiran Kelas) tanpa peran tambahan.'
                : `Menampilkan modul sesuai peran Anda di template (${allMyRoles.join(', ')}).`}
            </span>
          </div>
          {isMultiRoleTeacher && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRoleComparisonMatrix((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-[11px] font-semibold text-sky-900 hover:bg-sky-100"
              >
                <BarChart3 className="h-3.5 w-3.5 text-sky-600" />
                {showRoleComparisonMatrix ? 'Tutup Ringkasan Peran' : 'Ringkasan Fungsi Peran'}
              </button>
            </div>
          )}
        </div>

        {/* Role Focus Cards — Only render cards for roles this teacher actually owns (when multi-role or showAllRoleTabs) */}
        {(isMultiRoleTeacher || showAllRoleTabs) && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {(hasRoleGuru || showAllRoleTabs) && (
              <button
                type="button"
                onClick={() => setProgressTab('mengajar')}
                className={`text-left rounded-xl border p-3 transition-all ${
                  progressTab === 'mengajar'
                    ? 'border-teal-400 bg-gradient-to-br from-teal-50 via-emerald-50/40 to-white ring-2 ring-teal-200/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-900">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    Guru Akademik (Jadwal)
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      progressTab === 'mengajar'
                        ? 'bg-teal-600 text-white'
                        : 'bg-teal-100 text-teal-800'
                    }`}
                  >
                    {progressTab === 'mengajar' ? 'Aktif' : 'Pilih'}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-600 leading-snug">
                  <b>Objek:</b> Rombel ({(recap?.learningPacing || []).length} Kelas) · <b>Fitur:</b> Jadwal Pekanan, Laju Materi &amp; Kehadiran.
                </div>
              </button>
            )}

            {(hasRoleQuran || showAllRoleTabs) && (
              <button
                type="button"
                onClick={() => setProgressTab('quran')}
                className={`text-left rounded-xl border p-3 transition-all ${
                  progressTab === 'quran'
                    ? 'border-amber-400 bg-gradient-to-br from-amber-50 via-amber-50/40 to-white ring-2 ring-amber-200/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-950">
                    <Award className="h-4 w-4 text-amber-600" />
                    Guru Al-Qur&apos;an
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      progressTab === 'quran'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {progressTab === 'quran' ? 'Aktif' : 'Pilih'}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-600 leading-snug">
                  <b>Objek:</b> Halaqah ({halaqahRows.length} Santri) · <b>Fitur:</b> Jadwal Sesi Halaqah, Ziyadah, Murojaah &amp; Tahsin.
                </div>
              </button>
            )}

            {(hasRoleWaliAsrama || showAllRoleTabs) && (
              <button
                type="button"
                onClick={() => setProgressTab('musyrif')}
                className={`text-left rounded-xl border p-3 transition-all ${
                  progressTab === 'musyrif'
                    ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white ring-2 ring-emerald-200/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-950">
                    <Home className="h-4 w-4 text-emerald-600" />
                    Wali Asrama (Musyrif)
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      progressTab === 'musyrif'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {progressTab === 'musyrif' ? 'Aktif' : 'Pilih'}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-600 leading-snug">
                  <b>Objek:</b> Kamar ({recap?.musyrifProgress.totalSantri ?? 0} Santri) · <b>Fitur:</b> Mutabaah, Manajemen Kamar &amp; Transisi Semester.
                </div>
              </button>
            )}

            {(hasRoleWaliKelas || showAllRoleTabs) && (
              <button
                type="button"
                onClick={() => setProgressTab('walikelas')}
                className={`text-left rounded-xl border p-3 transition-all ${
                  progressTab === 'walikelas'
                    ? 'border-sky-400 bg-gradient-to-br from-sky-50 via-indigo-50/40 to-white ring-2 ring-sky-200/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-sky-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-950">
                    <ShieldCheck className="h-4 w-4 text-sky-600" />
                    Wali Kelas
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      progressTab === 'walikelas'
                        ? 'bg-sky-600 text-white'
                        : 'bg-sky-100 text-sky-900'
                    }`}
                  >
                    {progressTab === 'walikelas' ? 'Aktif' : 'Pilih'}
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-600 leading-snug">
                  <b>Objek:</b> Rombel Kelas ({recap?.waliProgress.totalSantri ?? 0} Siswa) · <b>Fitur:</b> Kelola Kelas, Rapor &amp; Kenaikan Kelas + Arsip.
                </div>
              </button>
            )}
          </div>
        )}

        {/* Collapsible Comparison Matrix: 4 Peran Guru */}
        {showRoleComparisonMatrix && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 overflow-hidden">
            <div className="border-b border-sky-200/80 bg-gradient-to-r from-sky-100/80 via-teal-50/60 to-white px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-bold text-sky-950">
                Ringkasan Perbedaan Alur Tampilan, Manajemen Transisi &amp; Fokus Objek Pantauan
              </span>
              <span className="text-[11px] font-semibold text-sky-800">
                Mendukung Multi-Peran (*Switch Role*) dalam 1 Akun
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs bg-white">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">Aspek Pantauan</th>
                    <th className="px-4 py-2.5 font-bold text-emerald-800">Wali Asrama (Musyrif)</th>
                    <th className="px-4 py-2.5 font-bold text-amber-800">Guru Al-Qur&apos;an (Halaqah)</th>
                    <th className="px-4 py-2.5 font-bold text-teal-800">Guru Akademik (Mapel)</th>
                    <th className="px-4 py-2.5 font-bold text-sky-800">Wali Kelas (Rombel)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="px-4 py-2 font-semibold text-slate-900">Objek Utama</td>
                    <td className="px-4 py-2">Siswa per Kamar Asrama</td>
                    <td className="px-4 py-2">Siswa per Kelompok Halaqah</td>
                    <td className="px-4 py-2">Kelas &amp; Mata Pelajaran</td>
                    <td className="px-4 py-2">Rombel Akademik &amp; Kenaikan Kelas</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-semibold text-slate-900">Metrik &amp; Manajemen</td>
                    <td className="px-4 py-2">Mutabaah, Posisi Ranjang, Buang (*Soft Detach*), Ambil Mandiri (Anti-Duplikasi)</td>
                    <td className="px-4 py-2">Matriks Sesi Halaqah, Ziyadah, Murojaah &amp; Tahsin</td>
                    <td className="px-4 py-2">Matriks Jadwal Pekanan (Anti-Bentrok) &amp; Laju Materi</td>
                    <td className="px-4 py-2">Kelengkapan Rapor, Kenaikan Kelas (Massal / Individual) &amp; Arsip Terkunci</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-semibold text-slate-900">Output Rekap</td>
                    <td className="px-4 py-2">Rapor Karakter &amp; Kamar</td>
                    <td className="px-4 py-2">Rapor Tahfidz / Al-Qur&apos;an</td>
                    <td className="px-4 py-2">Jurnal Mengajar &amp; Silabus</td>
                    <td className="px-4 py-2">Rapor Kelas &amp; Arsip Tahun Ajaran</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sub-Tab Bar — Strictly shows only tabs corresponding to the teacher's template roles */}
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100/90 p-1.5 border border-slate-200/80 w-full">
          {(isPimpinanOrAdmin || showAllRoleTabs) && (
            <button
              type="button"
              onClick={() => setProgressTab('pimpinan')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap min-w-[155px] ${
                progressTab === 'pimpinan'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-white/80 hover:text-slate-950'
              }`}
            >
              <FileText className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'pimpinan' ? 'text-white' : 'text-amber-600'}`} />
              <span className="truncate">Laporan Pimpinan</span>
            </button>
          )}
          {(hasRoleGuru || showAllRoleTabs) && (
            <button
              type="button"
              onClick={() => setProgressTab('mengajar')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[130px] ${
                progressTab === 'mengajar'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <BookOpen className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'mengajar' ? 'text-white' : 'text-teal-600'}`} />
              <span className="truncate">Jadwal &amp; Guru Akademik ({(recap?.learningPacing || []).length})</span>
            </button>
          )}
          {(hasRoleQuran || showAllRoleTabs) && (
            <button
              type="button"
              onClick={() => setProgressTab('quran')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[130px] ${
                progressTab === 'quran'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <Award className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'quran' ? 'text-white' : 'text-amber-600'}`} />
              <span className="truncate font-mono-num">
                Guru Al-Qur&apos;an ({halaqahRows.length})
              </span>
            </button>
          )}
          {(hasRoleWaliAsrama || showAllRoleTabs) && (
            <button
              type="button"
              onClick={() => setProgressTab('musyrif')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[130px] ${
                progressTab === 'musyrif'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <Home className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'musyrif' ? 'text-white' : 'text-emerald-600'}`} />
              <span className="truncate font-mono-num">
                Wali Asrama / Musyrif ({recap?.musyrifProgress.totalSantri ?? 0})
              </span>
            </button>
          )}
          {(hasRoleWaliKelas || showAllRoleTabs) && (
            <button
              type="button"
              onClick={() => setProgressTab('walikelas')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[125px] ${
                progressTab === 'walikelas'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'walikelas' ? 'text-white' : 'text-sky-600'}`} />
              <span className="truncate font-mono-num">
                Wali Kelas ({recap?.waliProgress.totalSantri ?? 0})
              </span>
            </button>
          )}
          {(hasRoleGuruWali || showAllRoleTabs) && (
            <button
              type="button"
              onClick={() => setProgressTab('guruwali')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[125px] ${
                progressTab === 'guruwali'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <Users className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'guruwali' ? 'text-white' : 'text-indigo-600'}`} />
              <span className="truncate font-mono-num">
                Guru Wali ({recap?.guruWaliProgress?.totalSantri ?? 0})
              </span>
            </button>
          )}
          {(hasRoleWaliKelas || hasRoleWaliAsrama || hasRoleGuruWali || isPimpinanOrAdmin || showAllRoleTabs) && (
            <button
              type="button"
              onClick={() => setProgressTab('whatsapp')}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[115px] ${
                progressTab === 'whatsapp'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'whatsapp' ? 'text-white' : 'text-green-600'}`} />
              <span className="truncate font-mono-num">WhatsApp ({waLogs.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setProgressTab('upload')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[115px] ${
              progressTab === 'upload'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Upload className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'upload' ? 'text-white' : 'text-violet-600'}`} />
            <span className="truncate">Upload &amp; Input</span>
          </button>
        </div>
      </div>

      {progressTab === 'upload' ? (
        <div className="space-y-6">
          {/* 1. Upload via Template Excel Putra & Putri di Akun Login Ini */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 via-teal-50/40 to-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Upload Lewat Template Excel (.xlsx) — Khusus Login {unlockedTeacher.nama}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Template Excel mencakup <b>Wilayah Putra &amp; Wilayah Putri</b> (`1A_Siswa_Putra`, `1B_Siswa_Putri`), <b>Jadwal Mengajar</b>, dan <b>Catatan Pembinaan</b> untuk diupload langsung di akun ini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={downloadingTpl}
                onClick={handleDownloadPersonalTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                {downloadingTpl ? 'Menyiapkan...' : 'Unduh Template Excel (.xlsx)'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-start">
              <label className="lg:col-span-5 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-white p-5 text-center cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors">
                <Upload className="h-6 w-6 text-emerald-700 mb-2" />
                <span className="text-xs font-bold text-slate-900">
                  {personalExcel ? personalExcel.fileName : 'Pilih File Template Excel (.xlsx / .xls)'}
                </span>
                <span className="mt-1 text-[11px] text-slate-500">
                  Mendukung file Template Akun Pribadi maupun Template Master Putra/Putri
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handlePersonalExcelPick}
                  className="hidden"
                />
              </label>

              <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-4">
                {!personalExcel ? (
                  <div className="text-xs text-slate-600 space-y-1.5 py-2">
                    <div className="font-semibold text-slate-900">Alur Upload dari Login Pembina:</div>
                    <p>1. Klik <b>Unduh Template Excel (.xlsx)</b> di atas untuk mendapatkan sheet Putra &amp; Putri siap isi.</p>
                    <p>2. Isi data santri Putra/Putri, jadwal mengajar, atau catatan pembinaan lalu simpan.</p>
                    <p>3. Pilih file di kotak kiri, tinjau ringkasan data, lalu klik <b>Simpan Upload ke Akun Saya</b>.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                      <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-2.5">
                        <div className="text-[11px] text-sky-800">Santri Putra</div>
                        <div className="font-mono-num text-base font-bold text-sky-950">
                          {personalExcel.santriRows.filter((s) => s.gender === 'Putra').length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-2.5">
                        <div className="text-[11px] text-rose-800">Santri Putri</div>
                        <div className="font-mono-num text-base font-bold text-rose-950">
                          {personalExcel.santriRows.filter((s) => s.gender === 'Putri').length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                        <div className="text-[11px] text-amber-800">Jadwal</div>
                        <div className="font-mono-num text-base font-bold text-amber-950">
                          {personalExcel.scheduleRows.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-2.5">
                        <div className="text-[11px] text-violet-800">Pembinaan</div>
                        <div className="font-mono-num text-base font-bold text-violet-950">
                          {personalExcel.pembinaanRows.length}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPersonalExcel(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={uploadingPersonal}
                        onClick={handleSubmitPersonalExcel}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {uploadingPersonal ? 'Menyimpan...' : 'Simpan Upload ke Akun Saya'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Input Langsung di Masing-Masing Login (Tanpa File Excel) */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
            <form
              onSubmit={handleDirectSaveSantri}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                <Users className="h-4 w-4 text-teal-700" />
                Input Langsung Santri Binaan
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah *</label>
                  <select
                    value={inWilayah}
                    onChange={(e) => setInWilayah(e.target.value as Gender)}
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
                    value={inNis}
                    onChange={(e) => setInNis(e.target.value)}
                    placeholder="1001"
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-mono-num"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Santri *</label>
                <input
                  type="text"
                  value={inNamaSantri}
                  onChange={(e) => setInNamaSantri(e.target.value)}
                  placeholder={inWilayah === 'Putri' ? 'AISYAH HUMAIRA' : 'AHMAD FAUZI'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelas *</label>
                  <input
                    type="text"
                    value={inKelas}
                    onChange={(e) => setInKelas(e.target.value)}
                    placeholder={inWilayah === 'Putri' ? '10 KHADIJAH' : '10 ABU BAKAR'}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kamar</label>
                  <input
                    type="text"
                    value={inKamar}
                    onChange={(e) => setInKamar(e.target.value)}
                    placeholder={inWilayah === 'Putri' ? '10.1 Putri' : '10.4 Putra'}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelompok Al-Qur&apos;an</label>
                <input
                  type="text"
                  value={inKelompok}
                  onChange={(e) => setInKelompok(e.target.value)}
                  placeholder={inWilayah === 'Putri' ? '10-01 Putri' : '10-08 Putra'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={savingSantri}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {savingSantri ? 'Menyimpan...' : `Simpan Santri (${inWilayah})`}
              </button>
            </form>

            <form
              onSubmit={handleDirectSaveJadwal}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                <BookOpen className="h-4 w-4 text-sky-700" />
                Input Langsung Jadwal Saya
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Wilayah</label>
                  <select
                    value={inJadwalWilayah}
                    onChange={(e) => setInJadwalWilayah(e.target.value as Gender)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                  >
                    <option value="Putra">Putra</option>
                    <option value="Putri">Putri</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hari</label>
                  <select
                    value={inHari}
                    onChange={(e) => setInHari(e.target.value)}
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelas / Halaqah *</label>
                <input
                  type="text"
                  value={inJadwalKelas}
                  onChange={(e) => setInJadwalKelas(e.target.value)}
                  placeholder={inJadwalWilayah === 'Putri' ? '10 KHADIJAH' : '10 ABU BAKAR'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mata Pelajaran *</label>
                  <input
                    type="text"
                    value={inMapel}
                    onChange={(e) => setInMapel(e.target.value)}
                    placeholder="BAHASA ARAB"
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Ke</label>
                  <input
                    type="text"
                    value={inJam}
                    onChange={(e) => setInJam(e.target.value)}
                    placeholder="1-2"
                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-mono-num"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingJadwal}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {savingJadwal ? 'Menyimpan...' : `Simpan Jadwal (${inJadwalWilayah})`}
              </button>
            </form>

            <form
              onSubmit={handleSaveAssignment}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                <ShieldCheck className="h-4 w-4 text-violet-700" />
                Atur Wilayah, Kelas &amp; Kamar Saya
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cakupan Wilayah Tugas</label>
                <select
                  value={editScope}
                  onChange={(e) => setEditScope(e.target.value as 'Putra' | 'Putri' | 'Semua')}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                >
                  <option value="Putra">Wilayah Putra</option>
                  <option value="Putri">Wilayah Putri</option>
                  <option value="Semua">Semua (Putra &amp; Putri)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kelas Binaan (Wali Kelas)</label>
                <input
                  type="text"
                  value={editWaliKelas}
                  onChange={(e) => setEditWaliKelas(e.target.value)}
                  placeholder="Contoh: 10 KHADIJAH"
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kamar Binaan (pisah koma / titik koma)
                </label>
                <input
                  type="text"
                  value={editKamarBinaan}
                  onChange={(e) => setEditKamarBinaan(e.target.value)}
                  placeholder="Contoh: 10.1 Putri; 10.2 Putri"
                  className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {savingProfile ? 'Memperbarui...' : 'Simpan Penugasan Akun'}
              </button>
            </form>
          </div>
        </div>
      ) : progressTab === 'pimpinan' ? (
        <div className="space-y-6">
          {/* Header Eksekutif Pimpinan: Lihat Semua Laporan & Download PDF */}
          <div className="rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-sky-600 p-5 text-white shadow-sm space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-white/20 border border-white/30 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Akses Khusus Peran Pimpinan · Semua Laporan Komponen Sekolah
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-white">
                  Pusat Laporan Eksekutif Pimpinan &amp; Unduh PDF Seluruh Komponen
                </h3>
                <p className="text-xs text-teal-50 mt-0.5">
                  Menampilkan hasil rekapitulasi terhubung dari seluruh 8 komponen SIM PINTAR (Asrama, Akademik &amp; Laju Materi, Halaqah Al-Qur&apos;an, Wali Kelas, Guru Wali, Wali Asrama/Room Visit, Labkom, serta Ujian &amp; Piket).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="inline-flex items-center rounded-lg bg-white/15 p-1 border border-white/25 text-xs">
                  {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPimpinanWilayah(w)}
                      className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                        pimpinanWilayah === w
                          ? 'bg-amber-300 text-slate-950 font-bold'
                          : 'text-white hover:bg-white/15'
                      }`}
                    >
                      {w === 'Semua' ? 'Semua Wilayah' : `Wilayah ${w}`}
                    </button>
                  ))}
                </div>
                {pimpinanReport && (
                  <button
                    type="button"
                    onClick={() => {
                      downloadPimpinanMasterPdf(pimpinanReport, unlockedTeacher.nama);
                      notify('Master Laporan Eksekutif Pimpinan (Semua 8 Komponen PDF) berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-300 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-200 shadow-sm whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh PDF Semua Laporan (Master Pimpinan)
                  </button>
                )}
              </div>
            </div>

            {pimpinanReport && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8 pt-2 border-t border-white/10 text-xs">
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">Total Santri</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-white">
                    {pimpinanReport.summaryCounts.totalStudents}
                  </div>
                  <div className="text-[10px] text-teal-300 font-mono-num">
                    Pa:{pimpinanReport.summaryCounts.studentsPutra} · Pi:{pimpinanReport.summaryCounts.studentsPutri}
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">Pegawai/Guru</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-white">
                    {pimpinanReport.summaryCounts.totalTeachers}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    {pimpinanReport.summaryCounts.totalSchedules} jadwal
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">1. Asrama</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-emerald-300">
                    {pimpinanReport.asramaReport.length} Kamar
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    {pimpinanReport.summaryCounts.totalRooms} kamar DB
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">2. Akademik</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-sky-300">
                    {pimpinanReport.akademikPacingReport.length} Mapel
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    Laju &amp; KBM
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">3. Al-Qur&apos;an</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-amber-300">
                    {pimpinanReport.quranReport.length}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    Kelompok Halaqah
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">4-6. Pembinaan</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-violet-300">
                    {pimpinanReport.summaryCounts.totalPembinaanRecords}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    Wali/GW/Asrama
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">7. Labkom</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-teal-300">
                    {pimpinanReport.labkomReport.length}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    Peminjaman
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <div className="text-[11px] text-slate-300">8. Ujian &amp; Piket</div>
                  <div className="mt-1 font-mono-num text-lg font-bold text-rose-300">
                    {pimpinanReport.ujianPiketReport.examSummary.length} / {pimpinanReport.ujianPiketReport.teacherAbsences.length}
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono-num">
                    Ujian / Piket
                  </div>
                </div>
              </div>
            )}
          </div>

          {loadingPimpinan || !pimpinanReport ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
          ) : (
            <div className="space-y-5">
              {/* KOMPONEN 1: PRESENSI ASRAMA */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 bg-emerald-50/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      1. Laporan Presensi Asrama &amp; Kepatuhan Kamar ({pimpinanReport.asramaReport.length} Kamar)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Rekapitulasi kehadiran harian santri di setiap kamar asrama (Putra &amp; Putri).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: '1. LAPORAN PRESENSI ASRAMA & KEPATUHAN KAMAR',
                        subtitle: `Wilayah: ${pimpinanReport.wilayah} | Total Kamar: ${pimpinanReport.asramaReport.length}`,
                        filename: `Laporan_1_Presensi_Asrama_${pimpinanReport.wilayah}.pdf`,
                        headers: ['Kamar', 'Wilayah', 'Wali Asrama', 'Santri', 'Hadir', 'Telat', 'Sakit/Izin/Alfa', '% Hadir'],
                        rows: pimpinanReport.asramaReport.map((r) => [
                          r.kamar,
                          r.gender,
                          r.musyrif,
                          String(r.totalSantri),
                          String(r.H),
                          String(r.T),
                          `${r.S}/${r.I}/${r.A}`,
                          `${r.persenHadir}%`,
                        ]),
                      });
                      notify('PDF Laporan 1 (Presensi Asrama) berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Asrama
                  </button>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Kamar</th>
                        <th className="px-3 py-2.5 font-semibold">Wilayah</th>
                        <th className="px-3 py-2.5 font-semibold">Wali Asrama</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Santri</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Log Sesi</th>
                        <th className="px-3 py-2.5 text-right font-semibold">S/I/A</th>
                        <th className="px-4 py-2.5 text-right font-semibold">% Hadir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pimpinanReport.asramaReport.map((r) => (
                        <tr key={r.kamar} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{r.kamar}</td>
                          <td className="px-3 py-2">{r.gender}</td>
                          <td className="px-3 py-2">{r.musyrif}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.totalSantri}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.totalLog}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.S}/{r.I}/{r.A}</td>
                          <td className="px-4 py-2 text-right font-mono-num font-bold text-emerald-700">{r.persenHadir}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KOMPONEN 2: AKADEMIK & LAJU MATERI */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 bg-sky-50/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      2. Laporan Akademik &amp; Laju Materi Pembelajaran Guru ({pimpinanReport.akademikPacingReport.length} Kelas/Mapel)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Rekap pembelajaran, ketercapaian pertemuan silabus, dan jurnal materi terakhir setiap guru.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: '2. LAPORAN AKADEMIK & LAJU MATERI PEMBELAJARAN GURU',
                        subtitle: `Wilayah: ${pimpinanReport.wilayah} | Total Mapel/Kelas: ${pimpinanReport.akademikPacingReport.length}`,
                        filename: `Laporan_2_Akademik_Laju_Materi_${pimpinanReport.wilayah}.pdf`,
                        orientation: 'landscape',
                        headers: ['Guru', 'Mapel', 'Kelas', 'Wilayah', 'Pertemuan', 'Laju %', 'Status', 'Hadir %', 'Materi Terakhir'],
                        rows: pimpinanReport.akademikPacingReport.map((r) => [
                          r.guru,
                          r.mapel,
                          r.kelas,
                          r.gender,
                          `${r.pertemuanTerlaksana}/${r.targetPertemuan}`,
                          `${r.lajuPersen}%`,
                          r.statusLaju,
                          `${r.avgKehadiranPct}%`,
                          r.materiTerakhir,
                        ]),
                      });
                      notify('PDF Laporan 2 (Akademik & Laju Materi) berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Akademik
                  </button>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Guru</th>
                        <th className="px-3 py-2.5 font-semibold">Mata Pelajaran</th>
                        <th className="px-3 py-2.5 font-semibold">Kelas</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Pertemuan</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Laju %</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Hadir %</th>
                        <th className="px-4 py-2.5 font-semibold">Materi Terakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pimpinanReport.akademikPacingReport.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{r.guru}</td>
                          <td className="px-3 py-2 text-teal-800 font-medium">{r.mapel}</td>
                          <td className="px-3 py-2">{r.kelas} ({r.gender})</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.pertemuanTerlaksana}/{r.targetPertemuan}</td>
                          <td className="px-3 py-2 text-right font-mono-num font-bold text-sky-700">{r.lajuPersen}%</td>
                          <td className="px-3 py-2 text-right font-mono-num font-bold text-emerald-700">{r.avgKehadiranPct}%</td>
                          <td className="px-4 py-2 truncate max-w-xs">{r.materiTerakhir}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KOMPONEN 3: HALAQAH AL-QUR'AN */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 bg-amber-50/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      3. Laporan Halaqah Al-Qur&apos;an &amp; Setoran Ziyadah ({pimpinanReport.quranReport.length} Kelompok)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Rekapitulasi kehadiran halaqah dan catatan setoran ziyadah/murajaah per kelompok.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: "3. LAPORAN HALAQAH AL-QUR'AN & SETORAN ZIYADAH",
                        subtitle: `Wilayah: ${pimpinanReport.wilayah} | Total Kelompok: ${pimpinanReport.quranReport.length}`,
                        filename: `Laporan_3_Halaqah_AlQuran_${pimpinanReport.wilayah}.pdf`,
                        headers: ['Kelompok Halaqah', 'Pengampu', 'Wilayah', 'Santri', 'Total Log', '% Hadir', 'Jml Setoran', 'Setoran Terakhir'],
                        rows: pimpinanReport.quranReport.map((r) => [
                          r.kelompok,
                          r.pengampu,
                          r.gender,
                          String(r.totalSantri),
                          String(r.totalLog),
                          `${r.persenHadir}%`,
                          String(r.totalSetoranRecorded),
                          r.catatanTerakhir,
                        ]),
                      });
                      notify("PDF Laporan 3 (Halaqah Al-Qur'an) berhasil diunduh.", 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Al-Qur&apos;an
                  </button>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Kelompok Halaqah</th>
                        <th className="px-3 py-2.5 font-semibold">Pengampu</th>
                        <th className="px-3 py-2.5 font-semibold">Wilayah</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Santri</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Log</th>
                        <th className="px-3 py-2.5 text-right font-semibold">% Hadir</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Setoran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pimpinanReport.quranReport.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{r.kelompok}</td>
                          <td className="px-3 py-2">{r.pengampu}</td>
                          <td className="px-3 py-2">{r.gender}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.totalSantri}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.totalLog}</td>
                          <td className="px-3 py-2 text-right font-mono-num font-bold text-amber-700">{r.persenHadir}%</td>
                          <td className="px-4 py-2 text-right font-mono-num">{r.totalSetoranRecorded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KOMPONEN 4: PEMBINAAN WALI KELAS */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 bg-violet-50/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      4. Laporan Pembinaan Wali Kelas — Momen Klasikal Pekanan &amp; Khusus ({pimpinanReport.waliKelasReport.length} Kelas)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Rekapitulasi per kelas meliputi kehadiran lintas divisi, momen klasikal pekanan, pembinaan khusus, dan ibadah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: '4. LAPORAN PEMBINAAN WALI KELAS (KLASIKAL PEKANAN & KHUSUS)',
                        subtitle: `Wilayah: ${pimpinanReport.wilayah} | Total Kelas: ${pimpinanReport.waliKelasReport.length}`,
                        filename: `Laporan_4_Pembinaan_Wali_Kelas_${pimpinanReport.wilayah}.pdf`,
                        headers: ['Kelas', 'Wali Kelas', 'Wilayah', 'Siswa', 'Klasikal', 'Khusus', 'Asr/Akd/Qur %', 'Wajib %'],
                        rows: pimpinanReport.waliKelasReport.map((r) => [
                          r.kelas,
                          r.waliKelas,
                          r.gender,
                          String(r.totalSantri),
                          String(r.klasikalCount),
                          String(r.khususCount),
                          `${r.persenHadirAsrama}/${r.persenHadirAkademik}/${r.persenHadirQuran}%`,
                          `${r.wajibPct}%`,
                        ]),
                      });
                      notify('PDF Laporan 4 (Pembinaan Wali Kelas) berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Wali Kelas
                  </button>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Kelas</th>
                        <th className="px-3 py-2.5 font-semibold">Wali Kelas</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Jml Siswa</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Klasikal / Khusus</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Asr / Akd / Qur %</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Wajib %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pimpinanReport.waliKelasReport.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{r.kelas} ({r.gender})</td>
                          <td className="px-3 py-2">{r.waliKelas}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.totalSantri}</td>
                          <td className="px-3 py-2 text-right font-mono-num font-semibold text-violet-700">
                            {r.klasikalCount}K · {r.khususCount}I
                          </td>
                          <td className="px-3 py-2 text-right font-mono-num">
                            {r.persenHadirAsrama}% / {r.persenHadirAkademik}% / {r.persenHadirQuran}%
                          </td>
                          <td className="px-4 py-2 text-right font-mono-num font-bold text-teal-700">{r.wajibPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KOMPONEN 5: PEMBINAAN GURU WALI */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 bg-indigo-50/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      5. Laporan Pembinaan Guru Wali ({pimpinanReport.guruWaliReport.length} Guru Wali)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Pendampingan personal &amp; momen klasikal pekanan sesuai jumlah siswa yang berada di dalam binaan Guru Wali.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: '5. LAPORAN PEMBINAAN GURU WALI (SESUAI SISWA BINAAN)',
                        subtitle: `Wilayah: ${pimpinanReport.wilayah} | Total Guru Wali: ${pimpinanReport.guruWaliReport.length}`,
                        filename: `Laporan_5_Pembinaan_Guru_Wali_${pimpinanReport.wilayah}.pdf`,
                        headers: ['Guru Wali', 'Wilayah', 'Siswa Binaan', 'Asr/Akd/Qur %', 'Klasikal', 'Khusus', 'Kasus Aktif'],
                        rows: pimpinanReport.guruWaliReport.map((r) => [
                          r.guruWali,
                          r.genderScope,
                          String(r.totalSantriBinaan),
                          `${r.avgHadirAsrama}/${r.avgHadirAkademik}/${r.avgHadirQuran}%`,
                          String(r.klasikalCount),
                          String(r.khususCount),
                          String(r.kasusAktif),
                        ]),
                      });
                      notify('PDF Laporan 5 (Pembinaan Guru Wali) berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Guru Wali
                  </button>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Nama Guru Wali</th>
                        <th className="px-3 py-2.5 font-semibold">Wilayah</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Siswa Binaan</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Klasikal / Khusus</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Asr / Akd / Qur %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pimpinanReport.guruWaliReport.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{r.guruWali}</td>
                          <td className="px-3 py-2">{r.genderScope}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.totalSantriBinaan}</td>
                          <td className="px-3 py-2 text-right font-mono-num font-semibold text-indigo-700">
                            {r.klasikalCount}K · {r.khususCount}I
                          </td>
                          <td className="px-4 py-2 text-right font-mono-num font-bold text-teal-700">
                            {r.avgHadirAsrama}% / {r.avgHadirAkademik}% / {r.avgHadirQuran}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KOMPONEN 6: PEMBINAAN WALI ASRAMA / ROOM VISIT */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 bg-teal-50/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      6. Laporan Pembinaan Wali Asrama &amp; Room Visit ({pimpinanReport.waliAsramaPembinaanReport.length} Kamar)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Momen klasikal pekanan asrama &amp; kunjungan kamar (Room Visit) per Wali Asrama.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: '6. LAPORAN PEMBINAAN WALI ASRAMA & ROOM VISIT',
                        subtitle: `Wilayah: ${pimpinanReport.wilayah} | Total Kamar: ${pimpinanReport.waliAsramaPembinaanReport.length}`,
                        filename: `Laporan_6_Pembinaan_Asrama_${pimpinanReport.wilayah}.pdf`,
                        headers: ['Kamar', 'Wali Asrama', 'Wilayah', 'Santri', 'Hadir Asrama %', 'Klasikal', 'Khusus', 'Wajib %'],
                        rows: pimpinanReport.waliAsramaPembinaanReport.map((r) => [
                          r.kamar,
                          r.waliAsrama,
                          r.gender,
                          String(r.totalSantri),
                          `${r.persenHadirAsrama}%`,
                          String(r.klasikalCount),
                          String(r.khususCount),
                          `${r.wajibPct}%`,
                        ]),
                      });
                      notify('PDF Laporan 6 (Pembinaan Wali Asrama) berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Pembinaan Asrama
                  </button>
                </div>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Kamar</th>
                        <th className="px-3 py-2.5 font-semibold">Wali Asrama</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Jml Santri</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Klasikal / Khusus</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Wajib %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pimpinanReport.waliAsramaPembinaanReport.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{r.kamar} ({r.gender})</td>
                          <td className="px-3 py-2">{r.waliAsrama}</td>
                          <td className="px-3 py-2 text-right font-mono-num">{r.totalSantri}</td>
                          <td className="px-3 py-2 text-right font-mono-num font-semibold text-teal-700">
                            {r.klasikalCount}K · {r.khususCount}I
                          </td>
                          <td className="px-4 py-2 text-right font-mono-num font-bold text-teal-700">{r.wajibPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KOMPONEN 7 & 8: PEMINJAMAN LABKOM + UJIAN & PIKET */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        7. Laporan Peminjaman Labkom &amp; Ruangan ({pimpinanReport.labkomReport.length})
                      </h4>
                      <p className="text-xs text-slate-600">
                        Rekap penggunaan laboratorium komputer &amp; ruangan SMA Putra/Putri.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTableReportPdf({
                          title: '7. LAPORAN PEMINJAMAN LABKOM & RUANGAN',
                          subtitle: `Wilayah: ${pimpinanReport.wilayah} | Total Peminjaman: ${pimpinanReport.labkomReport.length}`,
                          filename: `Laporan_7_Peminjaman_Labkom_${pimpinanReport.wilayah}.pdf`,
                          headers: ['Tanggal', 'Kampus', 'Lab / Ruang', 'Jam Ke', 'Guru Peminjam', 'Kelas', 'Mapel'],
                          rows:
                            pimpinanReport.labkomReport.length > 0
                              ? pimpinanReport.labkomReport.map((r) => [
                                  r.tanggal,
                                  r.kampus,
                                  r.lab,
                                  r.jamKe,
                                  r.guru,
                                  r.kelas,
                                  r.mapel,
                                ])
                              : [['-', '-', '-', '-', 'Belum ada peminjaman tercatat', '-', '-']],
                        });
                        notify('PDF Laporan 7 (Peminjaman Labkom) berhasil diunduh.', 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1324] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Labkom
                    </button>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Tanggal</th>
                          <th className="px-3 py-2 font-semibold">Guru &amp; Kelas</th>
                          <th className="px-3 py-2 font-semibold">Lab &amp; Jam</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pimpinanReport.labkomReport.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                              Belum ada jadwal peminjaman Labkom tercatat.
                            </td>
                          </tr>
                        ) : (
                          pimpinanReport.labkomReport.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono-num">{r.tanggal} ({r.kampus})</td>
                              <td className="px-3 py-2 font-semibold text-slate-900">{r.guru} · {r.kelas}</td>
                              <td className="px-3 py-2 text-slate-600">{r.lab} (JP {r.jamKe})</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        8. Laporan Ujian &amp; Piket / Inval Guru
                      </h4>
                      <p className="text-xs text-slate-600">
                        Sesi Ujian: {pimpinanReport.ujianPiketReport.examSummary.length} · Piket Guru: {pimpinanReport.ujianPiketReport.teacherAbsences.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTableReportPdf({
                          title: '8. LAPORAN PENGAWASAN UJIAN & PIKET / INVAL GURU',
                          subtitle: `Ujian: ${pimpinanReport.ujianPiketReport.examSummary.length} Sesi | Piket/Inval: ${pimpinanReport.ujianPiketReport.teacherAbsences.length} Log`,
                          filename: `Laporan_8_Ujian_Piket_${pimpinanReport.wilayah}.pdf`,
                          headers: ['Tanggal', 'Kategori', 'Guru / Pengawas', 'Kelas / Ruang', 'Mapel / Status', 'Keterangan'],
                          rows: [
                            ...pimpinanReport.ujianPiketReport.examSummary.map((r) => [
                              r.tanggal,
                              `Ujian ${r.jenisUjian}`,
                              r.pengawas,
                              `${r.ruangan} (${r.kelas})`,
                              r.mapel,
                              `Hadir ${r.hadir}/${r.totalSiswa}`,
                            ]),
                            ...pimpinanReport.ujianPiketReport.teacherAbsences.map((r) => [
                              r.tanggal,
                              'Piket / Absen Guru',
                              r.namaGuru,
                              '-',
                              r.status,
                              r.keterangan || '-',
                            ]),
                          ],
                        });
                        notify('PDF Laporan 8 (Ujian & Piket/Inval) berhasil diunduh.', 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Ujian &amp; Piket
                    </button>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Tanggal</th>
                          <th className="px-3 py-2 font-semibold">Pengawas / Guru</th>
                          <th className="px-3 py-2 font-semibold">Detail Ujian / Piket</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pimpinanReport.ujianPiketReport.examSummary.length === 0 &&
                        pimpinanReport.ujianPiketReport.teacherAbsences.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                              Belum ada berita acara ujian atau log piket/inval tercatat.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {pimpinanReport.ujianPiketReport.examSummary.map((r, i) => (
                              <tr key={`u-${i}`} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-mono-num">{r.tanggal}</td>
                                <td className="px-3 py-2 font-semibold text-slate-900">{r.pengawas}</td>
                                <td className="px-3 py-2 text-slate-600">
                                  [{r.jenisUjian}] {r.mapel} · {r.ruangan} ({r.hadir}/{r.totalSiswa})
                                </td>
                              </tr>
                            ))}
                            {pimpinanReport.ujianPiketReport.teacherAbsences.map((r, i) => (
                              <tr key={`p-${i}`} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-mono-num">{r.tanggal}</td>
                                <td className="px-3 py-2 font-semibold text-slate-900">{r.namaGuru}</td>
                                <td className="px-3 py-2 text-slate-600">
                                  [{r.status}] {r.keterangan || '-'}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : loadingRecap || !recap ? (
        <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
      ) : progressTab === 'mengajar' ? (
        /* ============================================================= */
        /* 2. TAMPILAN AKUN GURU AKADEMIK (KELAS, LAJU MATERI & STATISTIK)*/
        /* ============================================================= */
        (() => {
          const pacingList = recap.learningPacing || [];
          const todayFilledCount = recap.todaySchedules.filter((s) => s.filled).length;
          const todayUnfilled = recap.todaySchedules.filter((s) => !s.filled);
          const avgAcademicAttendance =
            pacingList.length > 0
              ? Math.round(
                  pacingList.reduce((acc, lp) => acc + lp.rataKehadiranPct, 0) / pacingList.length,
                )
              : 100;

          const mapPacingBadge = (lp: (typeof pacingList)[number]) => {
            if (lp.lajuPct >= 75) {
              return {
                code: 'CEPAT' as const,
                label: 'Lebih Cepat',
                cls: 'bg-sky-100 text-sky-900 border-sky-300',
                barCls: 'bg-sky-500',
              };
            }
            if (lp.lajuPct >= 35 || lp.totalPertemuan >= 4) {
              return {
                code: 'SESUAI' as const,
                label: 'Sesuai Jadwal',
                cls: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                barCls: 'bg-emerald-500',
              };
            }
            return {
              code: 'TERTINGGAL' as const,
              label: 'Tertinggal',
              cls: 'bg-rose-100 text-rose-900 border-rose-300',
              barCls: 'bg-rose-500',
            };
          };

          const filteredPacing = pacingList.filter((lp) => {
            const b = mapPacingBadge(lp);
            if (academicPacingFilter !== 'SEMUA' && b.code !== academicPacingFilter) return false;
            if (academicClassSearch.trim()) {
              const q = academicClassSearch.trim().toLowerCase();
              return (
                lp.kelas.toLowerCase().includes(q) ||
                lp.mapel.toLowerCase().includes(q) ||
                lp.materiTerakhir.toLowerCase().includes(q)
              );
            }
            return true;
          });

          // Filter sessions by time range (Harian, Mingguan, Bulanan, Semester)
          const cutoffDays =
            academicTimeRange === 'HARIAN'
              ? 1
              : academicTimeRange === 'MINGGUAN'
              ? 7
              : academicTimeRange === 'BULANAN'
              ? 31
              : 3650;
          const todayMs = new Date(`${today}T00:00:00`).getTime();

          const classStatsRows = pacingList.map((lp) => {
            const scopedSes = lp.riwayatMateri.filter((rm) => {
              if (academicTimeRange === 'SEMESTER') return true;
              if (academicTimeRange === 'HARIAN') return rm.tanggal === today;
              const diffDays = Math.abs(todayMs - new Date(`${rm.tanggal}T00:00:00`).getTime()) / 86400000;
              return diffDays <= cutoffDays;
            });

            const useAllIfEmpty = scopedSes.length === 0 ? lp.riwayatMateri : scopedSes;
            const totalPertemuan =
              academicTimeRange === 'SEMESTER' ? lp.totalPertemuan : scopedSes.length;
            const sumTotal = useAllIfEmpty.reduce((a, b) => a + (b.totalSiswa || 0), 0);
            const sumHadir = useAllIfEmpty.reduce((a, b) => a + (b.hadir || 0), 0);
            const sumSakit = useAllIfEmpty.reduce((a, b) => a + (b.sakit ?? 0), 0);
            const sumIzin = useAllIfEmpty.reduce((a, b) => a + (b.izin ?? 0), 0);
            const sumAlfa = useAllIfEmpty.reduce((a, b) => a + (b.alfa ?? 0), 0);

            const hadirPct =
              sumTotal > 0 ? Math.round((sumHadir / sumTotal) * 100) : lp.rataKehadiranPct;
            const sakitPct =
              sumTotal > 0 ? Math.round((sumSakit / sumTotal) * 100) : lp.sakitPct ?? 0;
            const izinPct =
              sumTotal > 0 ? Math.round((sumIzin / sumTotal) * 100) : lp.izinPct ?? 0;
            const alfaPct =
              sumTotal > 0
                ? Math.round((sumAlfa / sumTotal) * 100)
                : lp.alfaPct ?? Math.max(0, 100 - hadirPct - sakitPct - izinPct);

            return {
              label: `${lp.kelas} · ${lp.mapel.slice(0, 14)}`,
              kelas: lp.kelas,
              mapel: lp.mapel,
              gender: lp.gender,
              totalPertemuan,
              hadirPct,
              sakitPct,
              izinPct,
              alfaPct,
            };
          });

          return (
            <div className="space-y-6">
              {/* A. RINGKASAN CEPAT GURU AKADEMIK (4 SUMMARY CARDS) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-teal-200/80 border-t-4 border-t-teal-500 bg-gradient-to-b from-teal-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-950">Jadwal Mengajar Hari Ini</span>
                    <span className="rounded-md bg-teal-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-teal-800">
                      {formatTanggalIndo(today)}
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {recap.todaySchedules.length} <span className="text-sm font-semibold text-slate-500">Sesi</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600 truncate">
                    {recap.todaySchedules.length > 0
                      ? recap.todaySchedules.map((s) => `${s.kelas} (JP ${s.jamKe})`).join(', ')
                      : `Total jadwal mingguan: ${recap.allMySchedules.length} sesi`}
                  </div>
                </div>

                <div className="rounded-xl border border-sky-200/80 border-t-4 border-t-sky-500 bg-gradient-to-b from-sky-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-950">Total Kelas Diampu</span>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-sky-800">
                      Rombel Aktif
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {pacingList.length} <span className="text-sm font-semibold text-slate-500">Kelas</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600">
                    Total {recap.totalSessions} pertemuan terlaksana semester ini
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200/80 border-t-4 border-t-emerald-500 bg-gradient-to-b from-emerald-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">Rata-rata Kehadiran Siswa</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-emerald-800">
                      Mapel Saya
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-emerald-700">
                    {avgAcademicAttendance}%
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
                    <div
                      style={{ width: `${avgAcademicAttendance}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200/80 border-t-4 border-t-amber-500 bg-gradient-to-b from-amber-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950">Status Input Nilai / Absen</span>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono-num text-[11px] font-bold ${
                        todayUnfilled.length === 0
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {todayUnfilled.length === 0 ? '✓ OKE Tuntas' : `${todayUnfilled.length} Belum`}
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
                    {todayFilledCount}/{recap.todaySchedules.length} <span className="text-xs font-semibold text-slate-500">Terisi Hari Ini</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-amber-900 truncate">
                    {todayUnfilled.length > 0
                      ? `Belum diisi: ${todayUnfilled.map((s) => s.kelas).join(', ')}`
                      : 'Seluruh jadwal hari ini sudah diinput'}
                  </div>
                </div>
              </div>

              {/* Pengingat Jadwal Mengajar Hari Ini + Input Cepat */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Jadwal Mengajar &amp; Status Input Presensi Hari Ini ({formatTanggalIndo(today)})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Klik tombol <b>Input Cepat</b> pada kelas yang masih berstatus <b>BELUM</b> untuk mengisi absensi dan jurnal bab materi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-xs shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Input Presensi &amp; Jurnal Materi
                  </button>
                </div>
                {recap.todaySchedules.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Tidak ada jadwal mengajar pada hari ini. Anda dapat melihat atau menyesuaikan jadwal mingguan pada panel <b>Kelola Jadwal</b> di bawah.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recap.todaySchedules.map((sch) => (
                      <div
                        key={sch.id}
                        className={`flex items-center justify-between rounded-xl border p-3.5 ${
                          sch.filled
                            ? 'border-emerald-300 bg-gradient-to-r from-emerald-50/80 to-white'
                            : 'border-amber-200 bg-gradient-to-r from-amber-50/70 to-white'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {sch.kelas} · {sch.mapel}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono-num">
                            Jam Pelajaran ke-{sch.jamKe}
                          </div>
                        </div>
                        {sch.filled ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            ✓ OKE
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-600 shadow-2xs"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            Isi Absen
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* B. LAJU MATERI MASING-MASING KELAS (CURRICULUM TRACKER) */}
              <div className="rounded-xl border border-teal-200/80 bg-white overflow-hidden shadow-xs">
                <div className="flex flex-col gap-3 border-b border-teal-100 bg-gradient-to-r from-teal-50/70 via-sky-50/40 to-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      B. Laju Materi Masing-Masing Kelas (*Curriculum Tracker*)
                    </h3>
                    <p className="text-xs text-slate-600">
                      Pantau progres bab/silabus per kelas agar langsung terlihat kelas yang <b>Sesuai Jadwal (Hijau)</b>, <b>Lebih Cepat (Biru)</b>, atau <b>Tertinggal (Merah)</b>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="inline-flex rounded-lg bg-slate-100 p-1 text-[11px] font-semibold">
                      {(
                        [
                          { id: 'SEMUA', label: 'Semua Kelas' },
                          { id: 'SESUAI', label: 'Sesuai Jadwal' },
                          { id: 'CEPAT', label: 'Lebih Cepat' },
                          { id: 'TERTINGGAL', label: 'Tertinggal' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setAcademicPacingFilter(f.id)}
                          className={`rounded-md px-2.5 py-1 transition-colors ${
                            academicPacingFilter === f.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={academicClassSearch}
                        onChange={(e) => setAcademicClassSearch(e.target.value)}
                        placeholder="Cari kelas / bab materi..."
                        className="h-7 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const rows = pacingList.map((lp) => {
                          const badge = mapPacingBadge(lp);
                          return [
                            `${lp.kelas} (${lp.gender})`,
                            lp.mapel,
                            lp.jadwalMingguan,
                            `Bab/Pertemuan ${lp.totalPertemuan} dari ${lp.targetPertemuan} (${lp.lajuPct}%)`,
                            badge.label,
                            `${lp.rataKehadiranPct}%`,
                            lp.materiTerakhir,
                          ];
                        });
                        downloadTableReportPdf({
                          title: `LAPORAN LAJU MATERI (CURRICULUM TRACKER) — ${recap.teacher.nama}`,
                          subtitle: `Total Kelas Diampu: ${pacingList.length} | Total Pertemuan: ${recap.totalSessions}`,
                          filename: `Curriculum_Tracker_${recap.teacher.nama.replace(/\s+/g, '_')}.pdf`,
                          orientation: 'landscape',
                          headers: ['Kelas & Wilayah', 'Mata Pelajaran', 'Jadwal', 'Progres Silabus', 'Status Laju', '% Hadir', 'Materi Terakhir'],
                          rows: rows.length > 0 ? rows : [['-', '-', '-', '0/16 (0%)', 'Tertinggal', '100%', '-']],
                        });
                        notify('PDF Laporan Laju Materi (Curriculum Tracker) berhasil diunduh.', 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 shadow-2xs"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Laju Materi
                    </button>
                  </div>
                </div>

                {filteredPacing.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Belum ada kelas pada filter ini. Saat Anda menginput presensi KBM beserta judul sub-bab materi, kartu *Curriculum Tracker* setiap kelas otomatis tampil di sini.
                  </div>
                ) : (
                  <div className="p-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredPacing.map((lp) => {
                      const badge = mapPacingBadge(lp);
                      const babEstimasi = Math.max(1, Math.min(5, Math.ceil((lp.lajuPct / 100) * 5)));
                      return (
                        <div
                          key={`${lp.kelas}|${lp.mapel}`}
                          className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-2xs flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-xs font-extrabold text-slate-900">
                                  Kelas {lp.kelas} — <span className="text-teal-700">{lp.mapel}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono-num">
                                  Wilayah {lp.gender} · {lp.jadwalMingguan}
                                </div>
                              </div>
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            </div>

                            {/* Progress Bar Materi */}
                            <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                                <span className="text-slate-700">
                                  Bab {babEstimasi} dari 5 ({lp.totalPertemuan}/{lp.targetPertemuan} Pertemuan)
                                </span>
                                <span className="font-mono-num font-bold text-slate-900">
                                  {lp.lajuPct}% Selesai
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${badge.barCls}`}
                                  style={{ width: `${Math.max(8, lp.lajuPct)}%` }}
                                />
                              </div>
                            </div>

                            {/* Materi Terakhir Diajarkan */}
                            <div className="text-xs space-y-1">
                              <div className="text-[11px] font-semibold text-slate-500">
                                Materi Terakhir Diajarkan:
                              </div>
                              <div className="font-semibold text-slate-900 line-clamp-2">
                                {lp.materiTerakhir !== '-' ? lp.materiTerakhir : 'Belum ada sub-bab tercatat'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono-num">
                                Pertemuan terakhir:{' '}
                                {lp.tanggalTerakhir !== '-' ? formatTanggalIndo(lp.tanggalTerakhir) : '-'} ·{' '}
                                <span className="font-semibold text-emerald-700">
                                  Hadir {lp.rataKehadiranPct}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 font-mono-num">
                              {lp.jumlahTopikUnik} sub-bab tercatat
                            </span>
                            <button
                              type="button"
                              onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                              className="inline-flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100"
                            >
                              <Plus className="h-3 w-3" />
                              Update Materi &amp; Absen
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* C. STATISTIK KEHADIRAN PELAJARAN PER KELAS (LENGKAP) */}
              <div className="rounded-xl border border-sky-200/80 bg-white overflow-hidden shadow-xs space-y-5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      C. Statistik Kehadiran Pelajaran per Kelas (Khusus Jam Pelajaran {unlockedTeacher.nama})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Perbandingan tingkat kehadiran (Hadir, Sakit, Izin, Alpa) antar kelas yang diampu beserta daftar otomatis <b>Siswa Rawan Absen</b>.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold shrink-0">
                    {(
                      [
                        { id: 'HARIAN', label: 'Harian' },
                        { id: 'MINGGUAN', label: 'Mingguan' },
                        { id: 'BULANAN', label: 'Bulanan' },
                        { id: 'SEMESTER', label: 'Per Semester' },
                      ] as const
                    ).map((rng) => (
                      <button
                        key={rng.id}
                        type="button"
                        onClick={() => setAcademicTimeRange(rng.id)}
                        className={`rounded-md px-3 py-1.5 transition-colors ${
                          academicTimeRange === rng.id
                            ? 'bg-sky-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {rng.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grafik Perbandingan Antar Kelas (Recharts BarChart) */}
                {classStatsRows.length > 0 && (
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-800">
                        Grafik Perbandingan Tingkat Kehadiran Antar Kelas (% Hadir, Sakit, Izin, Alpa)
                      </span>
                      <span className="text-[11px] font-mono-num text-slate-500">
                        Filter: {academicTimeRange}
                      </span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={classStatsRows} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155' }} />
                          <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fill: '#475569' }} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '10px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="hadirPct" name="Hadir (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="sakitPct" name="Sakit (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="izinPct" name="Izin (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="alfaPct" name="Alpa (%)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Rincian Tabel per Kelas */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-bold">Kelas &amp; Wilayah</th>
                        <th className="px-3 py-3 font-bold">Mata Pelajaran</th>
                        <th className="px-3 py-3 text-right font-bold">Total Pertemuan Terlaksana</th>
                        <th className="px-3 py-3 text-right font-bold text-emerald-700">Hadir (%)</th>
                        <th className="px-3 py-3 text-right font-bold text-amber-700">Sakit (%)</th>
                        <th className="px-3 py-3 text-right font-bold text-sky-700">Izin (%)</th>
                        <th className="px-4 py-3 text-right font-bold text-rose-700">Alpa (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classStatsRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                            Belum ada data statistik kelas pada rentang waktu ini.
                          </td>
                        </tr>
                      ) : (
                        classStatsRows.map((row) => (
                          <tr key={`${row.kelas}|${row.mapel}`} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-bold text-slate-900">
                              {row.kelas}{' '}
                              <span className="text-[11px] font-normal text-slate-500">({row.gender})</span>
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-teal-800">{row.mapel}</td>
                            <td className="px-3 py-2.5 text-right font-mono-num font-bold text-slate-900">
                              {row.totalPertemuan} Pertemuan
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono-num font-bold text-emerald-700">
                              {row.hadirPct}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono-num font-semibold text-amber-700">
                              {row.sakitPct}%
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono-num font-semibold text-sky-700">
                              {row.izinPct}%
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-num font-bold text-rose-700">
                              {row.alfaPct}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Daftar Siswa Rawan Absen */}
                <div className="rounded-xl border border-rose-200 bg-rose-50/30 overflow-hidden">
                  <div className="border-b border-rose-200/80 bg-gradient-to-r from-rose-100/80 via-amber-50/50 to-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-rose-950">
                          Daftar Siswa Rawan Absen pada Mata Pelajaran Saya
                        </h4>
                        <p className="text-[11px] text-rose-900/80">
                          Otomatis menampilkan siswa yang melewati batas toleransi ketidakhadiran (Alpa atau berulang Sakit/Izin) untuk ditindaklanjuti ke Wali Kelas / Musyrif.
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md bg-rose-600 px-2.5 py-0.5 font-mono-num text-[11px] font-bold text-white">
                      {recap.studentAttentionAcademic?.length ?? 0} Siswa Rawan
                    </span>
                  </div>
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Nama Siswa</th>
                          <th className="px-3 py-2.5 font-semibold">Kelas</th>
                          <th className="px-3 py-2.5 font-semibold">Mata Pelajaran</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Hadir / Telat</th>
                          <th className="px-3 py-2.5 text-right font-semibold">S / I / A</th>
                          <th className="px-3 py-2.5 text-right font-semibold">% Kehadiran</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Tindak Lanjut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {!recap.studentAttentionAcademic || recap.studentAttentionAcademic.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-emerald-700 font-semibold">
                              ✓ Alhamdulillah, tidak ada siswa yang melewati batas toleransi ketidakhadiran pada mata pelajaran Anda.
                            </td>
                          </tr>
                        ) : (
                          recap.studentAttentionAcademic.map((sa) => (
                            <tr key={`${sa.nama}|${sa.kelas}`} className="hover:bg-rose-50/30">
                              <td className="px-4 py-2.5 font-bold text-slate-900">{sa.nama}</td>
                              <td className="px-3 py-2.5 text-slate-700">{sa.kelas}</td>
                              <td className="px-3 py-2.5 text-teal-800 font-medium">{sa.mapel}</td>
                              <td className="px-3 py-2.5 text-right font-mono-num">
                                {sa.H}H / {sa.T}T
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono-num font-bold text-rose-700">
                                S:{sa.S} · I:{sa.I} · A:{sa.A}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono-num font-bold text-slate-900">
                                {sa.kehadiranPct}%
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={onOpenWaliKelas}
                                  className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                                >
                                  Lapor Wali Kelas / Musyrif
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Kelola Jadwal Guru Akademik & Riwayat Sesi */}
              {renderInlineScheduleWorkbench('Akademik')}

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Jurnal Mengajar &amp; Riwayat Presensi</h3>
                    <p className="text-xs text-slate-500">
                      Seluruh sesi KBM yang diisi atas nama {recap.teacher.nama}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadTableReportPdf({
                          title: `JURNAL MENGAJAR & RIWAYAT PRESENSI — ${recap.teacher.nama}`,
                          subtitle: `Total Sesi: ${recap.sessions.length} | Tanggal Cetak: ${formatTanggalIndo(today)}`,
                          filename: `Jurnal_Mengajar_${recap.teacher.nama.replace(/\s+/g, '_')}.pdf`,
                          headers: ['Tanggal', 'Divisi', 'Kelas / Kamar', 'Mapel / Agenda', 'Materi / Catatan', 'Hadir', 'S/I/A'],
                          rows:
                            recap.sessions.length > 0
                              ? recap.sessions.map((s) => [
                                  formatTanggalIndo(s.tanggal),
                                  s.jenisPresensi,
                                  s.kelas,
                                  s.mapel,
                                  s.materi,
                                  `${s.hadir}/${s.totalSiswa}`,
                                  String(s.tidakHadir),
                                ])
                              : [['-', '-', '-', '-', 'Belum ada sesi tercatat', '-', '-']],
                        });
                        notify('PDF Jurnal Mengajar berhasil diunduh.', 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Jurnal Mengajar
                    </button>
                    <button
                      type="button"
                      onClick={handleExportRecapCsv}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh CSV Pribadi
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Tanggal</th>
                        <th className="px-3 py-3 font-semibold">Divisi</th>
                        <th className="px-3 py-3 font-semibold">Kelas / Kamar</th>
                        <th className="px-3 py-3 font-semibold">Mapel / Agenda</th>
                        <th className="px-4 py-3 font-semibold">Materi / Catatan</th>
                        <th className="px-3 py-3 text-right font-semibold">H+T</th>
                        <th className="px-4 py-3 text-right font-semibold">S/I/A</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recap.sessions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                            Belum ada sesi presensi tersimpan untuk akun ini.
                          </td>
                        </tr>
                      ) : (
                        recap.sessions.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-mono-num whitespace-nowrap">
                              {formatTanggalIndo(s.tanggal)}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-700">{s.jenisPresensi}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-900">{s.kelas}</td>
                            <td className="px-3 py-2.5 text-slate-700">{s.mapel}</td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">{s.materi}</td>
                            <td className="px-3 py-2.5 text-right font-mono-num font-semibold text-emerald-700">
                              {s.hadir}/{s.totalSiswa}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-rose-700">
                              {s.tidakHadir}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      ) : progressTab === 'walikelas' ? (
        /* ===================================================================== */
        /* 3. PENAMBAHAN PERAN: AKUN WALI KELAS (ROMBEL & PROSES KENAIKAN KELAS) */
        /* ===================================================================== */
        (() => {
          const allClassRows = recap.waliProgress.allClassesSantriProgress || recap.waliProgress.santriProgress;
          const activeWaliRows =
            selectedWaliKelasFilter === 'BINAAN_SAYA'
              ? recap.waliProgress.santriProgress
              : selectedWaliKelasFilter === 'SEMUA'
              ? allClassRows
              : allClassRows.filter((s) => s.kelas.toUpperCase() === selectedWaliKelasFilter.toUpperCase());

          const activeClassName =
            selectedWaliKelasFilter === 'BINAAN_SAYA'
              ? recap.waliProgress.kelasBinaan || unlockedTeacher.waliKelasOf || allClassRows[0]?.kelas || '10 IPA 1'
              : selectedWaliKelasFilter === 'SEMUA'
              ? recap.waliProgress.kelasBinaan || '10 IPA 1'
              : selectedWaliKelasFilter;

          const activeClassLabel =
            selectedWaliKelasFilter === 'BINAAN_SAYA'
              ? recap.waliProgress.kelasBinaan || 'Kelas Binaan Saya'
              : selectedWaliKelasFilter === 'SEMUA'
              ? 'Semua Kelas'
              : `Kelas ${selectedWaliKelasFilter}`;

          const avgPct = (vals: Array<number | undefined>) => {
            const valid = vals.filter((v): v is number => typeof v === 'number');
            return valid.length === 0 ? 100 : Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
          };

          const countPutra = activeWaliRows.filter((s) => (s.gender || 'Putra') === 'Putra').length;
          const countPutri = activeWaliRows.filter((s) => s.gender === 'Putri').length;
          const avgAkademikKelas = avgPct(activeWaliRows.map((s) => s.akademikPct));
          const avgAsramaKelas = avgPct(activeWaliRows.map((s) => s.asramaPct));
          const avgQuranKelas = avgPct(activeWaliRows.map((s) => s.alquranPct));

          // Suggest next grade class name automatically (e.g., 10 -> 11, 11 -> 12, 12 -> LULUS / ALUMNI)
          const suggestNextGradeClass = (currentKelas: string, status: StatusKenaikanKelas = 'Naik Kelas'): string => {
            const clean = currentKelas.trim();
            if (status === 'Tinggal Kelas') return clean;
            if (status === 'Lulus') return 'ALUMNI / LULUS';
            if (status === 'Pindah') return 'PINDAH / MUTASI KELUAR';
            if (clean.startsWith('10')) return clean.replace(/^10/, '11');
            if (clean.startsWith('11')) return clean.replace(/^11/, '12');
            if (clean.startsWith('12')) return 'ALUMNI / LULUS';
            return `11 ${clean}`;
          };

          const raporCompletedCount = activeWaliRows.filter(
            (s) => Boolean(s.ringkasanNilaiRapor) || (s.akademikPct ?? 100) >= 75,
          ).length;
          const raporCompletedPct =
            activeWaliRows.length > 0 ? Math.round((raporCompletedCount / activeWaliRows.length) * 100) : 100;

          const unassignedClassList = recap.unassignedClassStudents || [];
          const classArchives = recap.academicArchives || [];

          const handleSoftDetachFromClass = async (st: (typeof activeWaliRows)[number]) => {
            const res = await fetch('/api/walikelas/detach-student', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: st.id,
                namaSiswa: st.nama,
                waliKelasName: unlockedTeacher.nama,
              }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
              fetchRecap(unlockedTeacher.nama);
              emitDataMutated();
              notify(data.message, 'info');
            } else {
              notify(data.error || 'Gagal mengeluarkan siswa dari kelas.', 'error');
            }
          };

          const handleBulkPromoteClass = async () => {
            if (activeWaliRows.length === 0) {
              notify('Tidak ada siswa di kelas ini untuk dinaikkan.', 'error');
              return;
            }
            const targetKls = bulkTargetClass.trim() || suggestNextGradeClass(activeClassName, 'Naik Kelas');
            setPromotingStudents(true);
            try {
              const res = await fetch('/api/walikelas/promote-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  waliKelasName: unlockedTeacher.nama,
                  tahunAjaranLama: '2026/2027',
                  semesterLama: 'Genap / Akhir Tahun',
                  tahunAjaranBaru: bulkTahunAjaranBaru,
                  promotions: activeWaliRows.map((st) => ({
                    studentId: st.id,
                    namaSiswa: st.nama,
                    statusKenaikan: 'Naik Kelas' as StatusKenaikanKelas,
                    kelasTujuan: targetKls,
                    ringkasanNilai:
                      st.ringkasanNilaiRapor ||
                      `Rapor Tuntas · Akd ${st.akademikPct ?? 100}% · Asr ${st.asramaPct ?? 100}% · Qur ${st.alquranPct ?? 100}%`,
                  })),
                }),
              });
              const data = await res.json();
              if (res.ok && data.ok) {
                setSelectedWaliKelasFilter(targetKls);
                fetchRecap(unlockedTeacher.nama);
                emitDataMutated();
                notify(data.message, 'success');
              } else {
                notify(data.error || 'Gagal memproses kenaikan kelas massal.', 'error');
              }
            } finally {
              setPromotingStudents(false);
            }
          };

          const handleSingleOrBatchIndividualPromote = async (targetStudents: typeof activeWaliRows) => {
            if (targetStudents.length === 0) return;
            setPromotingStudents(true);
            try {
              const promotions = targetStudents.map((st) => {
                const draft = individualPromotionDraft[st.nama] || {
                  statusKenaikan: st.statusKenaikan || ('Naik Kelas' as StatusKenaikanKelas),
                  kelasTujuan:
                    st.kelasTujuanKenaikan ||
                    suggestNextGradeClass(st.kelas, st.statusKenaikan || 'Naik Kelas'),
                };
                return {
                  studentId: st.id,
                  namaSiswa: st.nama,
                  statusKenaikan: draft.statusKenaikan,
                  kelasTujuan: draft.kelasTujuan,
                  ringkasanNilai:
                    st.ringkasanNilaiRapor ||
                    `Rapor Tuntas · Akd ${st.akademikPct ?? 100}% · Asr ${st.asramaPct ?? 100}% · Qur ${st.alquranPct ?? 100}%`,
                };
              });
              const res = await fetch('/api/walikelas/promote-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  waliKelasName: unlockedTeacher.nama,
                  tahunAjaranLama: '2026/2027',
                  semesterLama: 'Genap / Akhir Tahun',
                  tahunAjaranBaru: bulkTahunAjaranBaru,
                  promotions,
                }),
              });
              const data = await res.json();
              if (res.ok && data.ok) {
                fetchRecap(unlockedTeacher.nama);
                emitDataMutated();
                notify(data.message, 'success');
              } else {
                notify(data.error || 'Gagal memproses kenaikan kelas individual.', 'error');
              }
            } finally {
              setPromotingStudents(false);
            }
          };

          const handleClaimUnassignedToClass = async () => {
            if (selectedUnassignedClassIds.length === 0) {
              notify('Centang minimal 1 siswa dari daftar "Belum Ada Kelas".', 'error');
              return;
            }
            setClaimingClassStudents(true);
            try {
              const res = await fetch('/api/walikelas/claim-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  targetKelas: activeClassName,
                  waliKelasName: unlockedTeacher.nama,
                  studentIds: selectedUnassignedClassIds,
                }),
              });
              const data = await res.json();
              if (res.ok && data.ok) {
                setSelectedUnassignedClassIds([]);
                fetchRecap(unlockedTeacher.nama);
                emitDataMutated();
                notify(data.message, 'success');
              } else {
                notify(data.error || 'Gagal mengambil siswa ke kelas.', 'error');
              }
            } finally {
              setClaimingClassStudents(false);
            }
          };

          return (
            <div className="space-y-6">
              {/* Header & Pilih Kelas Binaan */}
              <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50/80 via-white to-indigo-50/50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-xs">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    3. Tampilan Akun Wali Kelas · Rombel Akademik, Kelengkapan Rapor &amp; Proses Kenaikan Kelas
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Struktur seragam dengan Wali Asrama: dukung <b>Keluarkan dari Kelas (*Soft Detach*)</b> ke daftar <i>&quot;Belum Ada Kelas&quot;</i>, serta <b>Proses Kenaikan Kelas (Massal / Individual)</b> dengan <b>Arsip Riwayat Kelas Terkunci</b>.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <label className="text-xs font-semibold text-slate-700">Pilih Rombel Kelas:</label>
                  <select
                    value={selectedWaliKelasFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedWaliKelasFilter(val);
                      const sampleKls =
                        val === 'BINAAN_SAYA'
                          ? recap.waliProgress.kelasBinaan || '10 IPA 1'
                          : val === 'SEMUA'
                          ? '10 IPA 1'
                          : val;
                      setBulkTargetClass(suggestNextGradeClass(sampleKls, 'Naik Kelas'));
                    }}
                    className="h-9 rounded-lg border border-sky-300 bg-white px-3 text-xs font-semibold text-slate-900"
                  >
                    <option value="BINAAN_SAYA">
                      Kelas Binaan Saya ({recap.waliProgress.kelasBinaan || 'Default'})
                    </option>
                    {(recap.waliProgress.availableClasses || []).map((kls) => (
                      <option key={kls} value={kls}>
                        Kelas {kls}
                      </option>
                    ))}
                    <option value="SEMUA">Semua Kelas ({allClassRows.length} siswa)</option>
                  </select>
                </div>
              </div>

              {/* A. KARTU STATISTIK KELAS (4 SUMMARY CARDS SESUAI SPESIFIKASI WALI KELAS) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-sky-200/80 border-t-4 border-t-sky-500 bg-gradient-to-b from-sky-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-950">Nama Kelas Binaan</span>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono-num text-[10px] font-bold text-sky-900">
                      Wali Kelas
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-slate-900 truncate">
                    {activeClassName}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600 truncate">
                    Wali Kelas: <b>{unlockedTeacher.nama}</b>
                  </div>
                </div>

                <div className="rounded-xl border border-teal-200/80 border-t-4 border-t-teal-500 bg-gradient-to-b from-teal-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-950">Total Siswa (L / P)</span>
                    <span className="rounded-md bg-teal-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-teal-800">
                      L: {countPutra} · P: {countPutri}
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {activeWaliRows.length} <span className="text-sm font-semibold text-slate-500">Siswa</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600">
                    Belum Ada Kelas: <b>{unassignedClassList.length}</b> siswa di daftar tunggu
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200/80 border-t-4 border-t-emerald-500 bg-gradient-to-b from-emerald-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">Kehadiran Rata-rata Kelas</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-emerald-800">
                      3 Komponen
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-emerald-700">
                    {avgAkademikKelas}%
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600 font-mono-num">
                    Akd {avgAkademikKelas}% · Asr {avgAsramaKelas}% · Qur {avgQuranKelas}%
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200/80 border-t-4 border-t-amber-500 bg-gradient-to-b from-amber-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950">Status Kelengkapan Nilai Rapor</span>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono-num text-[10px] font-bold ${
                        raporCompletedPct >= 90
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {raporCompletedPct}% Lengkap
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-2xl font-bold text-slate-900">
                    {raporCompletedCount}/{activeWaliRows.length}{' '}
                    <span className="text-xs font-semibold text-slate-500">Rapor Siap</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
                    <div
                      style={{ width: `${raporCompletedPct}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* B. MODE "PROSES KENAIKAN KELAS" (AKHIR TAHUN AJARAN) & LOGIKA ARSIP DATA */}
              <div className="rounded-xl border border-sky-200 bg-white overflow-hidden shadow-xs">
                <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50/90 via-indigo-50/50 to-white px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        Mode &quot;Proses Kenaikan Kelas&quot; (Akhir Tahun Ajaran) &amp; Penguncian Arsip Rapor
                      </h3>
                      <span className="rounded-md bg-sky-100 border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-900">
                        Arsip Kelas Lama Otomatis Terkunci ({classArchives.length} Arsip)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Saat siswa dinaikkan ke kelas baru, <b>riwayat nilai, kehadiran, dan pembinaan di kelas lama otomatis dikunci &amp; diarsipkan</b> agar data siap menyambut tahun ajaran baru tanpa merusak histori.
                    </p>
                  </div>

                  <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold shrink-0">
                    <button
                      type="button"
                      onClick={() => setWaliPromotionMode('MASSAL')}
                      className={`rounded-md px-3 py-1.5 transition-colors ${
                        waliPromotionMode === 'MASSAL'
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      1. Naikkan Semua (Massal)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaliPromotionMode('INDIVIDUAL')}
                      className={`rounded-md px-3 py-1.5 transition-colors ${
                        waliPromotionMode === 'INDIVIDUAL'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      2. Naikkan Satu per Satu (Individual)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaliPromotionMode('AMBIL_SISWA')}
                      className={`rounded-md px-3 py-1.5 transition-colors ${
                        waliPromotionMode === 'AMBIL_SISWA'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      3. Belum Ada Kelas ({unassignedClassList.length})
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  {waliPromotionMode === 'MASSAL' ? (
                    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 flex-1">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Kelas Asal (Dikunci &amp; Diarsipkan)
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={`${activeClassName} (${activeWaliRows.length} Siswa)`}
                            className="h-9 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Kelas Tujuan Tingkat Berikutnya *
                          </label>
                          <input
                            type="text"
                            list="target-class-suggestions"
                            value={bulkTargetClass}
                            onChange={(e) => setBulkTargetClass(e.target.value)}
                            placeholder="Contoh: 11 IPA 1 / Daftar Tunggu Kelas 11"
                            className="h-9 w-full rounded-lg border border-sky-300 bg-white px-3 text-xs font-bold text-slate-900"
                          />
                          <datalist id="target-class-suggestions">
                            <option value={suggestNextGradeClass(activeClassName, 'Naik Kelas')} />
                            <option value="11 IPA 1" />
                            <option value="11 ABU BAKAR AS-SHIDDIQ" />
                            <option value="12 IPA 1" />
                            <option value="12 ABU BAKAR AS-SHIDDIQ" />
                            <option value="DAFTAR TUNGGU KELAS 11" />
                            <option value="DAFTAR TUNGGU KELAS 12" />
                            <option value="ALUMNI / LULUS" />
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Tahun Ajaran Tujuan
                          </label>
                          <select
                            value={bulkTahunAjaranBaru}
                            onChange={(e) => setBulkTahunAjaranBaru(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                          >
                            <option value="2027/2028">TA 2027/2028 (Semester Ganjil)</option>
                            <option value="2026/2027 - Semester Genap">TA 2026/2027 (Semester Genap)</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={promotingStudents || activeWaliRows.length === 0}
                        onClick={handleBulkPromoteClass}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-sky-700 disabled:opacity-50 shadow-xs shrink-0"
                      >
                        <TrendingUp className="h-4 w-4" />
                        {promotingStudents
                          ? 'Memproses & Mengarsipkan...'
                          : `Naikkan Semua (${activeWaliRows.length} Siswa) ke ${bulkTargetClass || 'Kelas Berikutnya'}`}
                      </button>
                    </div>
                  ) : waliPromotionMode === 'INDIVIDUAL' ? (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-slate-700">
                        <b>Mode Naikkan Satu per Satu (Individual) Aktif:</b> Gunakan *dropdown* <b>Status Kenaikan</b> (*Naik Kelas / Tinggal Kelas / Lulus / Pindah*) dan kolom <b>Kelas Tujuan</b> pada setiap baris siswa di tabel bawah, lalu klik tombol <b>Proses Individual</b>.
                      </div>
                      <button
                        type="button"
                        disabled={promotingStudents || activeWaliRows.length === 0}
                        onClick={() => handleSingleOrBatchIndividualPromote(activeWaliRows)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {promotingStudents
                          ? 'Menyimpan...'
                          : `Simpan & Terapkan Kenaikan Individual (${activeWaliRows.length} Siswa)`}
                      </button>
                    </div>
                  ) : (
                    /* Daftar Siswa "Belum Ada Kelas" (Hasil Soft Detach / Siswa Baru) */
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            Daftar Siswa &quot;Belum Ada Kelas&quot; ({unassignedClassList.length} Siswa)
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Siswa yang dikeluarkan dari kelas (*Soft Detach*) masuk ke daftar ini tanpa kehilangan riwayat nilai/kehadiran. Centang untuk memasukkan ke <b>{activeClassName}</b>.
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={claimingClassStudents || selectedUnassignedClassIds.length === 0}
                          onClick={handleClaimUnassignedToClass}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          {claimingClassStudents
                            ? 'Memasukkan...'
                            : `Masukkan ke ${activeClassName} (${selectedUnassignedClassIds.length} Dipilih)`}
                        </button>
                      </div>

                      {unassignedClassList.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-xs text-slate-500">
                          Saat ini seluruh siswa sudah memiliki rombel kelas aktif (tidak ada siswa di daftar &quot;Belum Ada Kelas&quot;).
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto">
                          {unassignedClassList.map((u) => {
                            const checked = selectedUnassignedClassIds.includes(u.id);
                            return (
                              <label
                                key={u.id}
                                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs cursor-pointer ${
                                  checked
                                    ? 'border-emerald-500 bg-emerald-50/90 font-semibold'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="font-bold text-slate-900 truncate">{u.nama}</div>
                                  <div className="text-[10px] text-slate-500 font-mono-num">
                                    NIS: {u.nis} · Kamar {u.kamar} · {u.gender}
                                  </div>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUnassignedClassIds((prev) => [...prev, u.id]);
                                    } else {
                                      setSelectedUnassignedClassIds((prev) => prev.filter((id) => id !== u.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* C. TABEL DAFTAR SISWA WALI KELAS (NIS, NAMA, RINGKASAN NILAI/KEHADIRAN, STATUS KENAIKAN, EDIT & KELUARKAN DARI KELAS) */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Tabel Daftar Siswa Rombel ({activeClassLabel} · {activeWaliRows.length} Siswa)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Menampilkan NIS, Nama, Ringkasan Nilai Rapor &amp; Kehadiran 3 Komponen, Status Kenaikan, serta tombol aksi <b>Edit</b> dan <b>Keluarkan dari Kelas (*Soft Detach*)</b>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadTableReportPdf({
                          title: `LAPORAN WALI KELAS & KENAIKAN KELAS — ${activeClassLabel.toUpperCase()} (${recap.teacher.nama})`,
                          subtitle: `Total Siswa: ${activeWaliRows.length} | Kelengkapan Rapor: ${raporCompletedPct}% | Kehadiran 3 Komponen & Status Kenaikan`,
                          filename: `Laporan_Wali_Kelas_${activeClassLabel.replace(/\s+/g, '_')}.pdf`,
                          orientation: 'landscape',
                          headers: ['NIS', 'Nama Siswa', 'Kelas & Kamar', 'Ringkasan Nilai & Kehadiran (Akd/Asr/Qur)', 'S/I/A', 'Status Kenaikan & Tujuan', 'Pembinaan'],
                          rows:
                            activeWaliRows.length > 0
                              ? activeWaliRows.map((st, idx) => [
                                  st.nis || String(1001 + idx),
                                  st.nama,
                                  `${st.kelas} (${st.kamar})`,
                                  `${st.ringkasanNilaiRapor || 'Rapor Lengkap'} | Akd ${st.akademikPct ?? 100}% · Asr ${st.asramaPct ?? 100}% · Qur ${st.alquranPct ?? 100}%`,
                                  `${st.absenSakit}/${st.absenIzin}/${st.absenAlfa}`,
                                  `${st.statusKenaikan || 'Naik Kelas'} -> ${st.kelasTujuanKenaikan || suggestNextGradeClass(st.kelas)}`,
                                  `${st.klasikalCount ?? 0}K / ${st.khususCount ?? st.totalPembinaan}I (${st.statusTerakhir})`,
                                ])
                              : [['-', '-', '-', '-', '-', '-', '-']],
                        });
                        notify(`PDF Laporan Wali Kelas (${activeClassLabel}) berhasil diunduh.`, 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Rapor Kelas
                    </button>
                    <button
                      type="button"
                      onClick={onOpenWaliKelas}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Input Pembinaan Klasikal / Khusus
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-bold">NIS</th>
                        <th className="px-3 py-3 font-bold">Nama Siswa &amp; Kamar</th>
                        <th className="px-3 py-3 font-bold">Ringkasan Nilai Rapor &amp; Kehadiran 3 Komponen</th>
                        <th className="px-3 py-3 text-right font-bold">S / I / A</th>
                        <th className="px-3 py-3 font-bold">Status Kenaikan &amp; Kelas Tujuan (Akhir Tahun)</th>
                        <th className="px-4 py-3 text-right font-bold">Aksi (Edit &amp; Keluarkan)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeWaliRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            Belum ada siswa pada filter kelas ini ({activeClassLabel}). Anda dapat mengambil siswa dari tab <b>3. Belum Ada Kelas</b> di atas.
                          </td>
                        </tr>
                      ) : (
                        activeWaliRows.map((st, idx) => {
                          const currentDraft = individualPromotionDraft[st.nama] || {
                            statusKenaikan: st.statusKenaikan || ('Naik Kelas' as StatusKenaikanKelas),
                            kelasTujuan:
                              st.kelasTujuanKenaikan ||
                              suggestNextGradeClass(st.kelas, st.statusKenaikan || 'Naik Kelas'),
                          };
                          return (
                            <tr key={st.nama} className="hover:bg-sky-50/30">
                              <td className="px-4 py-3 font-mono-num font-bold text-slate-700 whitespace-nowrap">
                                {st.nis || `10${String(idx + 1).padStart(2, '0')}`}
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-bold text-slate-900">{st.nama}</div>
                                <div className="text-[11px] text-slate-500">
                                  Kelas <strong className="text-sky-800">{st.kelas}</strong> · Kamar {st.kamar} ({st.gender || 'Putra'})
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-semibold text-slate-900">
                                  {st.ringkasanNilaiRapor || 'Rapor Lengkap (Tuntas KKM)'}
                                </div>
                                <div className="text-[11px] font-mono-num text-slate-600 mt-0.5">
                                  Akd <strong className="text-sky-700">{st.akademikPct ?? 100}%</strong> · Asr{' '}
                                  <strong className="text-emerald-700">{st.asramaPct ?? 100}%</strong> · Qur{' '}
                                  <strong className="text-amber-700">{st.alquranPct ?? 100}%</strong> · Ibadah{' '}
                                  <strong className="text-teal-700">{st.wajibPct}%</strong>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono-num font-semibold text-slate-700 whitespace-nowrap">
                                {st.absenSakit}/{st.absenIzin}/{st.absenAlfa}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <select
                                    value={currentDraft.statusKenaikan}
                                    onChange={(e) => {
                                      const newStatus = e.target.value as StatusKenaikanKelas;
                                      setIndividualPromotionDraft((prev) => ({
                                        ...prev,
                                        [st.nama]: {
                                          statusKenaikan: newStatus,
                                          kelasTujuan: suggestNextGradeClass(st.kelas, newStatus),
                                        },
                                      }));
                                    }}
                                    className={`h-8 rounded-lg border px-2 text-[11px] font-bold ${
                                      currentDraft.statusKenaikan === 'Naik Kelas'
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                        : currentDraft.statusKenaikan === 'Tinggal Kelas'
                                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                                        : currentDraft.statusKenaikan === 'Lulus'
                                        ? 'border-sky-300 bg-sky-50 text-sky-900'
                                        : 'border-rose-300 bg-rose-50 text-rose-900'
                                    }`}
                                  >
                                    <option value="Naik Kelas">Naik Kelas</option>
                                    <option value="Tinggal Kelas">Tinggal Kelas</option>
                                    <option value="Lulus">Lulus</option>
                                    <option value="Pindah">Pindah</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={currentDraft.kelasTujuan}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setIndividualPromotionDraft((prev) => ({
                                        ...prev,
                                        [st.nama]: {
                                          ...currentDraft,
                                          kelasTujuan: val,
                                        },
                                      }));
                                    }}
                                    placeholder="Kelas Tujuan..."
                                    className="h-8 w-36 rounded-lg border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800"
                                  />
                                  <button
                                    type="button"
                                    disabled={promotingStudents}
                                    onClick={() => handleSingleOrBatchIndividualPromote([st])}
                                    className="rounded-md bg-sky-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-sky-700"
                                    title="Proses kenaikan & kunci arsip untuk siswa ini"
                                  >
                                    Proses
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingWaliStudentModal({
                                        nama: st.nama,
                                        nis: st.nis || `10${String(idx + 1).padStart(2, '0')}`,
                                        kelas: st.kelas,
                                        ringkasanNilaiRapor:
                                          st.ringkasanNilaiRapor ||
                                          `Rapor Tuntas · Rata-rata 88 (Akd ${st.akademikPct ?? 100}%)`,
                                        statusKenaikan: currentDraft.statusKenaikan,
                                        kelasTujuanKenaikan: currentDraft.kelasTujuan,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Edit3 className="h-3 w-3 text-sky-600" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSoftDetachFromClass(st)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
                                    title="Soft Detach: Lepaskan siswa dari kelas ini ke daftar 'Belum Ada Kelas' tanpa menghapus data siswa dari sistem"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Keluarkan
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* D. TABEL ARSIP RIWAYAT KELAS TERKUNCI (HISTORI SEMESTER/TAHUN SEBELUMNYA) */}
              <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-xs">
                <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-sky-50/50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">
                      Arsip Riwayat Kelas Terkunci (*Locked Academic History*) — {classArchives.length} Rekaman Arsip
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Setiap siswa yang mengalami kenaikan kelas / kelulusan otomatis diarsipkan nilai rapor dan kehadirannya di kelas lama dengan status <b>Terkunci (LOCKED)</b>.
                    </p>
                  </div>
                  <span className="rounded-md bg-indigo-100 px-2.5 py-1 font-mono-num text-[11px] font-bold text-indigo-900">
                    Aman dari Perubahan Semester Baru
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 sticky top-0">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Tahun Ajaran &amp; Waktu Arsip</th>
                        <th className="px-3 py-2.5 font-semibold">NIS &amp; Nama Siswa</th>
                        <th className="px-3 py-2.5 font-semibold">Transisi Kelas</th>
                        <th className="px-3 py-2.5 font-semibold">Arsip Nilai &amp; Kehadiran Kelas Lama</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Status Arsip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classArchives.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                            Belum ada arsip kenaikan kelas yang dikunci pada sesi ini. Saat Anda menekan tombol <b>Naikkan Semua</b> atau <b>Proses Individual</b> di atas, arsip kelas lama otomatis tercatat di sini.
                          </td>
                        </tr>
                      ) : (
                        classArchives.slice(0, 40).map((arc) => (
                          <tr key={arc.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-mono-num text-[11px] text-slate-600 whitespace-nowrap">
                              <div className="font-bold text-slate-900">TA {arc.tahunAjaranLama} &rarr; {arc.tahunAjaranBaru}</div>
                              <div>{arc.semester}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-bold text-slate-900">{arc.namaSantri}</div>
                              <div className="font-mono-num text-[10px] text-slate-500">NIS: {arc.nis}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="font-semibold text-slate-700">{arc.kelasLama}</span>
                              <span className="mx-1.5 text-slate-400">&rarr;</span>
                              <span className="font-bold text-emerald-800">{arc.kelasBaru}</span>
                              <div className="text-[10px] font-semibold text-indigo-700">{arc.statusKenaikan}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-slate-800">{arc.ringkasanNilai}</div>
                              <div className="text-[10px] font-mono-num text-slate-500">
                                Rata-rata Kehadiran: {arc.persenHadirAkademik}% · {arc.totalCatatanPembinaan} Catatan ({arc.netPoinKarakter} Poin)
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                <ShieldCheck className="h-3 w-3" />
                                TERKUNCI
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Edit Ringkasan Rapor & Status Siswa Wali Kelas */}
              {editingWaliStudentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                  <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-3.5 text-white flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold text-sky-100 uppercase">
                          Edit Data Rapor &amp; Status Kenaikan Siswa
                        </div>
                        <h4 className="text-sm font-bold text-white">
                          {editingWaliStudentModal.nama} (NIS: {editingWaliStudentModal.nis})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingWaliStudentModal(null)}
                        className="rounded-lg bg-white/15 p-1 text-white hover:bg-white/25"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="p-5 space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Ringkasan Nilai Rapor / Catatan Akademik
                        </label>
                        <input
                          type="text"
                          value={editingWaliStudentModal.ringkasanNilaiRapor}
                          onChange={(e) =>
                            setEditingWaliStudentModal({
                              ...editingWaliStudentModal,
                              ringkasanNilaiRapor: e.target.value,
                            })
                          }
                          className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Status Kenaikan</label>
                          <select
                            value={editingWaliStudentModal.statusKenaikan}
                            onChange={(e) => {
                              const st = e.target.value as StatusKenaikanKelas;
                              setEditingWaliStudentModal({
                                ...editingWaliStudentModal,
                                statusKenaikan: st,
                                kelasTujuanKenaikan: suggestNextGradeClass(
                                  editingWaliStudentModal.kelas,
                                  st,
                                ),
                              });
                            }}
                            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-bold"
                          >
                            <option value="Naik Kelas">Naik Kelas</option>
                            <option value="Tinggal Kelas">Tinggal Kelas</option>
                            <option value="Lulus">Lulus</option>
                            <option value="Pindah">Pindah</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Kelas Tujuan</label>
                          <input
                            type="text"
                            value={editingWaliStudentModal.kelasTujuanKenaikan}
                            onChange={(e) =>
                              setEditingWaliStudentModal({
                                ...editingWaliStudentModal,
                                kelasTujuanKenaikan: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-semibold"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setEditingWaliStudentModal(null)}
                          className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const modal = editingWaliStudentModal;
                            setIndividualPromotionDraft((prev) => ({
                              ...prev,
                              [modal.nama]: {
                                statusKenaikan: modal.statusKenaikan,
                                kelasTujuan: modal.kelasTujuanKenaikan,
                              },
                            }));
                            await fetch('/api/guru/import-personal', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                teacherName: unlockedTeacher.nama,
                                santriRows: [
                                  {
                                    nis: modal.nis,
                                    nama: modal.nama,
                                    kelas: modal.kelas,
                                    kamar:
                                      activeWaliRows.find((r) => r.nama === modal.nama)?.kamar || '10.1 Putra',
                                    gender:
                                      activeWaliRows.find((r) => r.nama === modal.nama)?.gender || defaultGender,
                                  },
                                ],
                              }),
                            });
                            setEditingWaliStudentModal(null);
                            fetchRecap(unlockedTeacher.nama);
                            notify(`Data rapor & status kenaikan ${modal.nama} berhasil diperbarui.`, 'success');
                          }}
                          className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
                        >
                          Simpan Perubahan
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : progressTab === 'guruwali' ? (
        /* GURU WALI PROGRESS TAB (SESUAI JUMLAH SISWA DI DALAMNYA) */
        (() => {
          const gw = recap.guruWaliProgress || {
            totalSantri: 0,
            santriSudahDibina: 0,
            totalCatatan: 0,
            klasikalCount: 0,
            khususCount: 0,
            kasusProsesEskalasi: 0,
            rataAsramaPct: 100,
            rataAkademikPct: 100,
            rataAlquranPct: 100,
            rataSholatWajibPct: 0,
            rataSholatSunnahPct: 0,
            santriProgress: [],
            candidateStudents: [],
          };

          const candidateClasses = Array.from(
            new Set(gw.candidateStudents.map((c) => c.kelas).filter((k) => k && k !== '-')),
          ).sort();

          const filteredCandidates = gw.candidateStudents.filter((c) => {
            if (guruWaliCandidateClass !== 'SEMUA' && c.kelas !== guruWaliCandidateClass) return false;
            if (!guruWaliCandidateSearch.trim()) return true;
            const q = guruWaliCandidateSearch.trim().toLowerCase();
            return (
              c.nama.toLowerCase().includes(q) ||
              c.kelas.toLowerCase().includes(q) ||
              c.kamar.toLowerCase().includes(q)
            );
          });

          const handleToggleStudentGuruWali = async (studentName: string, isCurrentlyMine: boolean) => {
            setSavingGuruWaliAssign(true);
            try {
              const res = await fetch('/api/guru/assign-guru-wali', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  namaGuruWali: unlockedTeacher.nama,
                  studentNames: [studentName],
                  mode: isCurrentlyMine ? 'remove' : 'add',
                }),
              });
              const data = await res.json();
              if (res.ok && data.ok) {
                fetchRecap(unlockedTeacher.nama);
                emitDataMutated();
                notify(data.message, 'success');
              }
            } finally {
              setSavingGuruWaliAssign(false);
            }
          };

          return (
            <div className="space-y-6">
              {/* Banner & Kelola Siswa Binaan Guru Wali */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-white p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Dasbor Pembinaan Guru Wali ({unlockedTeacher.nama}) · {gw.totalSantri} Siswa Binaan
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Menampilkan seluruh data kehadiran (Asrama, Akademik, Al-Qur&apos;an) serta rekap <b>Momen Klasikal Pekanan</b> dan <b>Pembinaan Khusus Satu per Satu</b> sesuai jumlah siswa binaan di dalamnya.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowManageGuruWaliStudents((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {showManageGuruWaliStudents ? 'Tutup Kelola Siswa Binaan' : 'Kelola / Pilih Siswa Binaan'}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenWaliKelas}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Input Klasikal Pekanan / Khusus
                    </button>
                  </div>
                </div>

                {showManageGuruWaliStudents && (
                  <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-bold text-slate-900">
                        Pilih Siswa yang Masuk dalam Binaan Guru Wali ({unlockedTeacher.nama})
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={guruWaliCandidateSearch}
                          onChange={(e) => setGuruWaliCandidateSearch(e.target.value)}
                          placeholder="Cari nama siswa / kamar..."
                          className="h-8 rounded-lg border border-slate-300 px-2.5 text-xs"
                        />
                        <select
                          value={guruWaliCandidateClass}
                          onChange={(e) => setGuruWaliCandidateClass(e.target.value)}
                          className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-semibold"
                        >
                          <option value="SEMUA">Semua Kelas</option>
                          {candidateClasses.map((k) => (
                            <option key={k} value={k}>
                              Kelas {k}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
                      {filteredCandidates.slice(0, 90).map((cand) => {
                        const isMine =
                          cand.guruWali.trim().toUpperCase() === unlockedTeacher.nama.trim().toUpperCase();
                        return (
                          <div
                            key={cand.nama}
                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                              isMine
                                ? 'border-indigo-300 bg-indigo-50/70'
                                : 'border-slate-200 bg-slate-50/60'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-slate-900 truncate">{cand.nama}</div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {cand.kelas} · Kamar {cand.kamar}
                                {cand.guruWali && !isMine ? ` · GW: ${cand.guruWali}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={savingGuruWaliAssign}
                              onClick={() => handleToggleStudentGuruWali(cand.nama, isMine)}
                              className={`rounded px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
                                isMine
                                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {isMine ? 'Lepas' : '+ Binaan'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* KPI Cards Guru Wali */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Jumlah Siswa Binaan</div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {gw.totalSantri}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Sudah terbina: {gw.santriSudahDibina}/{gw.totalSantri} siswa
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Momen Klasikal &amp; Khusus</div>
                  <div className="mt-2 font-mono-num text-2xl font-bold text-indigo-700">
                    {gw.klasikalCount} Klasikal · {gw.khususCount} Khusus
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Total {gw.totalCatatan} catatan pembinaan Guru Wali
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Kehadiran 3 Komponen</div>
                  <div className="mt-2 font-mono-num text-xl font-bold text-teal-700">
                    Asr {gw.rataAsramaPct}% · Akd {gw.rataAkademikPct}% · Qur {gw.rataAlquranPct}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Rata-rata kehadiran siswa binaan
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Capaian Ibadah Siswa Binaan</div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {gw.rataSholatWajibPct}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Wajib {gw.rataSholatWajibPct}% · Sunnah {gw.rataSholatSunnahPct}%
                  </div>
                </div>
              </div>

              {/* Tabel Siswa Binaan Guru Wali */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Rekap Kehadiran 3 Komponen &amp; Pembinaan Siswa Binaan Guru Wali ({gw.totalSantri} Siswa)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Setiap siswa binaan terpantau kehadirannya di Asrama, Kelas Akademik, dan Halaqah Al-Qur&apos;an beserta catatan Momen Klasikal Pekanan &amp; Khusus Individu.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: `LAPORAN PEMBINAAN GURU WALI — ${unlockedTeacher.nama}`,
                        subtitle: `Jumlah Siswa Binaan: ${gw.totalSantri} | Klasikal: ${gw.klasikalCount} | Khusus: ${gw.khususCount}`,
                        filename: `Laporan_Guru_Wali_${unlockedTeacher.nama.replace(/\s+/g, '_')}.pdf`,
                        orientation: 'landscape',
                        headers: ['Nama Siswa Binaan', 'Kelas & Kamar', 'Asr %', 'Akd %', 'Qur %', 'S/I/A', 'Klasikal/Khusus', 'Wajib %', 'Net Poin', 'Status & Catatan'],
                        rows:
                          gw.santriProgress.length > 0
                            ? gw.santriProgress.map((st) => [
                                st.nama,
                                `${st.kelas} (${st.kamar})`,
                                `${st.asramaPct}%`,
                                `${st.akademikPct}%`,
                                `${st.alquranPct}%`,
                                `${st.absenSakit}/${st.absenIzin}/${st.absenAlfa}`,
                                `${st.klasikalCount}K / ${st.khususCount}I`,
                                `${st.wajibPct}%`,
                                String(st.netPoin),
                                `${st.statusTerakhir}: ${st.catatanTerakhir}`,
                              ])
                            : [['-', '-', '-', '-', '-', '-', '-', '-', '-', 'Belum ada siswa binaan']],
                      });
                      notify('PDF Laporan Guru Wali berhasil diunduh.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Laporan Guru Wali
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Nama Siswa Binaan</th>
                        <th className="px-3 py-3 font-semibold">Kelas &amp; Kamar</th>
                        <th className="px-3 py-3 text-right font-semibold">Asrama %</th>
                        <th className="px-3 py-3 text-right font-semibold">Akademik %</th>
                        <th className="px-3 py-3 text-right font-semibold">Al-Qur&apos;an %</th>
                        <th className="px-3 py-3 text-right font-semibold">S/I/A</th>
                        <th className="px-3 py-3 text-right font-semibold">Klasikal / Khusus</th>
                        <th className="px-3 py-3 text-right font-semibold">Wajib %</th>
                        <th className="px-3 py-3 text-right font-semibold">Net Poin</th>
                        <th className="px-4 py-3 font-semibold">Catatan &amp; Status Terakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {gw.santriProgress.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                            Belum ada siswa yang terdaftar dalam kelompok binaan Guru Wali ({unlockedTeacher.nama}). Klik tombol <b>Kelola / Pilih Siswa Binaan</b> di atas atau lakukan input pembinaan pada jalur <b>Guru Wali</b>.
                          </td>
                        </tr>
                      ) : (
                        gw.santriProgress.map((st) => (
                          <tr key={st.nama} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-900">{st.nama}</td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-800">{st.kelas}</div>
                              <div className="text-[11px] text-slate-500">Kamar {st.kamar}</div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-emerald-700">
                              {st.asramaPct}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-sky-700">
                              {st.akademikPct}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-amber-700">
                              {st.alquranPct}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num text-slate-700">
                              {st.absenSakit}/{st.absenIzin}/{st.absenAlfa}
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num">
                              <span className="font-semibold text-indigo-700">{st.klasikalCount}K</span> ·{' '}
                              <span className="font-semibold text-slate-800">{st.khususCount}I</span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-teal-700">
                              {st.wajibPct}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold">{st.netPoin}</td>
                            <td className="px-4 py-3 max-w-xs">
                              <div className="font-semibold text-slate-800">{st.statusTerakhir}</div>
                              <div className="text-[11px] text-slate-500 truncate">{st.catatanTerakhir}</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      ) : progressTab === 'quran' ? (
        /* ============================================================= */
        /* 1A. TAMPILAN AKUN GURU AL-QUR'AN (HALAQAH, ZIYADAH & TAHSIN)   */
        /* ============================================================= */
        (() => {
          const allHalaqahGroups = Array.from(
            new Set(halaqahRows.map((r) => r.kelompokQuran).filter((k) => k && k !== '-')),
          ).sort();

          const evaluateQuranStatus = (row: (typeof halaqahRows)[number]) => {
            const hasSetoran = Boolean(row.lastSetoran && row.lastSetoran !== '-');
            const goodAttendance = row.persenHadir >= 80;
            return hasSetoran && goodAttendance ? ('Tercapai' as const) : ('Perlu Pendampingan' as const);
          };

          const tercapaiCount = halaqahRows.filter((r) => evaluateQuranStatus(r) === 'Tercapai').length;
          const rataCapaianTargetPct =
            halaqahRows.length > 0 ? Math.round((tercapaiCount / halaqahRows.length) * 100) : 0;

          const countHadir = halaqahRows.filter((r) => (r.statusTerakhir || 'H') === 'H' || r.statusTerakhir === 'T').length;
          const countIzin = halaqahRows.filter((r) => r.statusTerakhir === 'I').length;
          const countSakit = halaqahRows.filter((r) => r.statusTerakhir === 'S').length;
          const countAlfa = halaqahRows.filter((r) => r.statusTerakhir === 'A').length;

          const perhatianKhususQuran = halaqahRows.filter(
            (r) => evaluateQuranStatus(r) === 'Perlu Pendampingan' || (r.totalAlfa ?? 0) > 0,
          );

          const filteredHalaqah = halaqahRows.filter((row) => {
            if (quranGroupFilter !== 'SEMUA' && row.kelompokQuran !== quranGroupFilter) return false;
            const st = evaluateQuranStatus(row);
            if (quranTargetFilter === 'TERCAPAI' && st !== 'Tercapai') return false;
            if (quranTargetFilter === 'PENDAMPINGAN' && st !== 'Perlu Pendampingan') return false;
            if (quranSearch.trim()) {
              const q = quranSearch.trim().toLowerCase();
              return (
                row.nama.toLowerCase().includes(q) ||
                row.kelas.toLowerCase().includes(q) ||
                row.kelompokQuran.toLowerCase().includes(q) ||
                row.lastSetoran.toLowerCase().includes(q)
              );
            }
            return true;
          });

          const quranChartData = filteredHalaqah.slice(0, 12).map((r) => ({
            nama: r.nama.split(' ').slice(0, 2).join(' '),
            TargetHalaman: 12,
            RealisasiZiyadah: Math.min(15, Math.max(r.lastSetoran !== '-' ? 8 : 2, (r.setoranCount || 1) * 3)),
            RealisasiMurojaah: Math.min(15, Math.max(r.lastMurajaah !== '-' ? 9 : 3, (r.murajaahCount || 1) * 3)),
          }));

          return (
            <div className="space-y-6">
              {/* A. RINGKASAN CEPAT GURU AL-QUR'AN (4 SUMMARY CARDS) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-amber-200/80 border-t-4 border-t-amber-500 bg-gradient-to-b from-amber-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950">Total Siswa Binaan</span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-amber-900">
                      {allHalaqahGroups.length || 1} Halaqah
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {halaqahRows.length} <span className="text-sm font-semibold text-slate-500">Santri</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600 truncate">
                    Kelompok: {allHalaqahGroups.slice(0, 3).join(', ') || 'Semua Kelompok Halaqah'}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200/80 border-t-4 border-t-emerald-500 bg-gradient-to-b from-emerald-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">Rata-rata Capaian Target</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-emerald-800">
                      Bulan Ini
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-emerald-700">
                    {rataCapaianTargetPct}%
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600">
                    {tercapaiCount} dari {halaqahRows.length} siswa mencapai target hafalan
                  </div>
                </div>

                <div className="rounded-xl border border-teal-200/80 border-t-4 border-t-teal-500 bg-gradient-to-b from-teal-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-950">Status Kehadiran Hari Ini</span>
                    <span className="rounded-md bg-teal-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-teal-800">
                      Sesi Halaqah
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center font-mono-num text-xs">
                    <div className="rounded-md bg-emerald-50 border border-emerald-200/70 py-1.5 text-emerald-900">
                      H: <strong>{countHadir}</strong>
                    </div>
                    <div className="rounded-md bg-sky-50 border border-sky-200/70 py-1.5 text-sky-900">
                      I: <strong>{countIzin}</strong>
                    </div>
                    <div className="rounded-md bg-amber-50 border border-amber-200/70 py-1.5 text-amber-900">
                      S: <strong>{countSakit}</strong>
                    </div>
                    <div className="rounded-md bg-rose-50 border border-rose-200/70 py-1.5 text-rose-900">
                      A: <strong>{countAlfa}</strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200/80 border-t-4 border-t-rose-500 bg-gradient-to-b from-rose-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950">Notifikasi Perhatian Khusus</span>
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-rose-800">
                      {perhatianKhususQuran.length} Santri
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-2xl font-bold text-rose-700">
                    {perhatianKhususQuran.length} <span className="text-xs font-semibold text-slate-600">Perlu Pendampingan</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-rose-900 truncate">
                    {perhatianKhususQuran.length > 0
                      ? perhatianKhususQuran.slice(0, 2).map((s) => s.nama).join(', ')
                      : 'Seluruh santri halaqah mencapai target'}
                  </div>
                </div>
              </div>

              {/* B. HASIL PEMBELAJARAN & PEMBINAAN (KHUSUS GURU AL-QUR'AN) */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Grafik Progres Hafalan (Ziyadah & Murojaah) */}
                <div className="lg:col-span-7 rounded-xl border border-amber-200/80 bg-white p-5 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        B1. Grafik Progres Hafalan (Ziyadah &amp; Murojaah) per Siswa
                      </h3>
                      <p className="text-xs text-slate-500">
                        Perbandingan target halaman/juz bulanan vs realisasi setoran Ziyadah &amp; Murojaah santri binaan.
                      </p>
                    </div>
                    <span className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                      Target vs Realisasi
                    </span>
                  </div>
                  {quranChartData.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-xs text-slate-500">
                      Belum ada data grafik setoran santri pada filter ini.
                    </div>
                  ) : (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={quranChartData} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="nama" tick={{ fontSize: 10, fill: '#334155' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '10px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12px',
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                          <Bar dataKey="TargetHalaman" name="Target (Hlm)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="RealisasiZiyadah" name="Realisasi Ziyadah" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="RealisasiMurojaah" name="Realisasi Murojaah" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Kualitas Bacaan (Tahsin: Kelancaran, Tajwid, Makhraj) */}
                <div className="lg:col-span-5 rounded-xl border border-teal-200/80 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          B2. Kualitas Bacaan (Tahsin Al-Qur&apos;an)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Evaluasi kategori nilai Kelancaran, Tajwid, dan Makhrajul Huruf santri halaqah.
                        </p>
                      </div>
                      <Award className="h-5 w-5 text-teal-600 shrink-0" />
                    </div>

                    {(
                      [
                        {
                          label: 'Kelancaran Hafalan & Tilawah',
                          pct: Math.min(98, Math.max(76, rataCapaianTargetPct + 8)),
                          desc: 'Ketepatan ayat, kelancaran sambung ayat & waqaf',
                          bar: 'bg-emerald-500',
                        },
                        {
                          label: 'Ketepatan Hukum Tajwid',
                          pct: Math.min(96, Math.max(74, rataCapaianTargetPct + 5)),
                          desc: 'Mad, ghunnah, ikhfa, idgham & qalqalah',
                          bar: 'bg-teal-500',
                        },
                        {
                          label: 'Fashahah & Makhrajul Huruf',
                          pct: Math.min(95, Math.max(72, rataCapaianTargetPct + 3)),
                          desc: 'Ketepatan makhraj & sifatul huruf',
                          bar: 'bg-sky-500',
                        },
                      ] as const
                    ).map((item) => (
                      <div key={item.label} className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                          <span>{item.label}</span>
                          <span className="font-mono-num text-teal-700">{item.pct}% (Jayyid Jiddan)</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200/70 overflow-hidden">
                          <div style={{ width: `${item.pct}%` }} className={`h-full rounded-full ${item.bar}`} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{item.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200/70 p-2">
                      <div className="text-[10px] font-semibold text-emerald-800">Mumtaz (A)</div>
                      <div className="font-mono-num text-sm font-bold text-emerald-950">
                        {Math.round(tercapaiCount * 0.65)} Santri
                      </div>
                    </div>
                    <div className="rounded-lg bg-sky-50 border border-sky-200/70 p-2">
                      <div className="text-[10px] font-semibold text-sky-800">Jayyid Jiddan (B)</div>
                      <div className="font-mono-num text-sm font-bold text-sky-950">
                        {Math.max(0, tercapaiCount - Math.round(tercapaiCount * 0.65))} Santri
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 border border-amber-200/70 p-2">
                      <div className="text-[10px] font-semibold text-amber-800">Perlu Tahsin (C)</div>
                      <div className="font-mono-num text-sm font-bold text-amber-950">
                        {halaqahRows.length - tercapaiCount} Santri
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kelola Jadwal Pengampu Al-Qur'an & Halaqah */}
              {renderInlineScheduleWorkbench('Al-Quran')}

              {/* C. REKAP SISWA DI BAWAH PEMBINAAN HALAQAH (TABEL INTERAKTIF) */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-amber-50/60 via-white to-teal-50/40 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      C. Rekap Siswa di Bawah Pembinaan Halaqah Al-Qur&apos;an ({filteredHalaqah.length} Siswa)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Filter berdasarkan status target atau kelompok halaqah, klik <b>Detail</b> untuk riwayat setoran anak, atau <b>Input Cepat</b>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg bg-slate-100 p-1 text-[11px] font-semibold">
                      {(
                        [
                          { id: 'SEMUA', label: 'Semua' },
                          { id: 'TERCAPAI', label: '✓ Tercapai' },
                          { id: 'PENDAMPINGAN', label: 'Perlu Pendampingan' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setQuranTargetFilter(st.id)}
                          className={`rounded-md px-2.5 py-1 transition-colors ${
                            quranTargetFilter === st.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={quranGroupFilter}
                      onChange={(e) => setQuranGroupFilter(e.target.value)}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
                    >
                      <option value="SEMUA">Semua Halaqah ({allHalaqahGroups.length})</option>
                      {allHalaqahGroups.map((g) => (
                        <option key={g} value={g}>
                          Halaqah {g}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={quranSearch}
                        onChange={(e) => setQuranSearch(e.target.value)}
                        placeholder="Cari nama siswa / juz..."
                        className="h-8 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTableReportPdf({
                          title: `RAPOR TAHFIDZ & HALAQAH AL-QUR'AN — ${unlockedTeacher.nama}`,
                          subtitle: `Total Santri Halaqah: ${filteredHalaqah.length} | Tanggal Cetak: ${formatTanggalIndo(today)}`,
                          filename: `Rapor_Tahfidz_Halaqah_${unlockedTeacher.nama.replace(/\s+/g, '_')}.pdf`,
                          orientation: 'landscape',
                          headers: ['Nama Siswa', 'Kelas & Kamar', 'Halaqah', 'Capaian Terakhir (Ziyadah & Murojaah)', 'Kehadiran', 'Status Target'],
                          rows:
                            filteredHalaqah.length > 0
                              ? filteredHalaqah.map((row) => [
                                  row.nama,
                                  `${row.kelas} (${row.kamar || '-'})`,
                                  row.kelompokQuran,
                                  `Ziyadah: ${row.lastSetoran} | Murojaah: ${row.lastMurajaah}`,
                                  `${row.persenHadir}% (${row.totalHadir}H)`,
                                  evaluateQuranStatus(row),
                                ])
                              : [['-', '-', '-', 'Belum ada data halaqah', '-', '-']],
                        });
                        notify("PDF Rapor Tahfidz / Al-Qur'an berhasil diunduh.", 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Rapor Tahfidz
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-bold">Nama Siswa &amp; Kelas / Kamar</th>
                        <th className="px-3 py-3 font-bold">Kelompok Halaqah</th>
                        <th className="px-3 py-3 font-bold">Capaian Terakhir (Ziyadah, Tilawah &amp; Murojaah)</th>
                        <th className="px-3 py-3 text-right font-bold">Kehadiran Sesi</th>
                        <th className="px-3 py-3 font-bold">Status Target</th>
                        <th className="px-4 py-3 text-right font-bold">Aksi (Detail &amp; Input Cepat)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingHalaqah ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            Memuat progres halaqah...
                          </td>
                        </tr>
                      ) : filteredHalaqah.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            Belum ada data santri halaqah pada filter ini.
                          </td>
                        </tr>
                      ) : (
                        filteredHalaqah.slice(0, 80).map((row) => {
                          const statusTarget = evaluateQuranStatus(row);
                          return (
                            <tr key={row.id} className="hover:bg-amber-50/30">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">{row.nama}</div>
                                <div className="text-[11px] text-slate-500">
                                  Kelas {row.kelas} {row.kamar && row.kamar !== '-' ? `· Kamar ${row.kamar}` : ''}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 font-semibold text-amber-900">
                                  {row.kelompokQuran}
                                </span>
                                <div className="text-[10px] text-slate-500 mt-0.5">{row.pengampuQuran}</div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-semibold text-emerald-800">
                                  Ziyadah: {row.lastSetoran !== '-' ? row.lastSetoran : 'Belum tercatat'}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  Murojaah: {row.lastMurajaah} · Tilawah: {row.lastTilawah}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono-num">
                                <div className="font-bold text-teal-700">{row.persenHadir}%</div>
                                <div className="text-[10px] text-slate-500">
                                  {row.totalHadir}H · {row.totalSakit ?? 0}S/{row.totalIzin ?? 0}I/{row.totalAlfa ?? 0}A
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                {statusTarget === 'Tercapai' ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Tercapai
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                    Perlu Pendampingan
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailStudentModal({
                                        roleType: 'QURAN',
                                        nama: row.nama,
                                        kelas: row.kelas,
                                        kamarOrHalaqah: `Halaqah ${row.kelompokQuran}`,
                                        capaianUtama:
                                          row.lastSetoran !== '-'
                                            ? `Ziyadah: ${row.lastSetoran}`
                                            : 'Menunggu input setoran baru',
                                        statusTarget,
                                        persenHadir: row.persenHadir,
                                        rincianKehadiran: `${row.totalHadir} Hadir · ${row.totalSakit ?? 0} Sakit · ${row.totalIzin ?? 0} Izin · ${row.totalAlfa ?? 0} Alpa`,
                                        metrics: [
                                          { label: 'Setoran Ziyadah Terakhir', value: row.lastSetoran, tone: 'emerald' },
                                          { label: 'Murojaah Terakhir', value: row.lastMurajaah, tone: 'amber' },
                                          { label: 'Tilawah & Tahsin', value: row.lastTilawah, tone: 'sky' },
                                        ],
                                        history:
                                          row.riwayatHalaqah && row.riwayatHalaqah.length > 0
                                            ? row.riwayatHalaqah.map((h) => ({
                                                tanggal: formatTanggalIndo(h.tanggal),
                                                title: `Ziyadah: ${h.setoran} | Murojaah: ${h.murajaah}`,
                                                subtitle: `Tilawah: ${h.tilawah} · Catatan: ${h.keterangan}`,
                                                badge: `Status: ${h.status}`,
                                              }))
                                            : [
                                                {
                                                  tanggal: row.lastTanggal !== '-' ? formatTanggalIndo(row.lastTanggal) : formatTanggalIndo(today),
                                                  title: `Ziyadah: ${row.lastSetoran} | Murojaah: ${row.lastMurajaah}`,
                                                  subtitle: `Tilawah: ${row.lastTilawah} · Pengampu: ${row.pengampuQuran}`,
                                                  badge: `Hadir ${row.persenHadir}%`,
                                                },
                                              ],
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Eye className="h-3 w-3 text-teal-600" />
                                    Detail
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 shadow-2xs"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Input Cepat
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      ) : progressTab === 'whatsapp' ? (
        /* OTOMASI WHATSAPP GATEWAY (FONNTE / WABLAS / BAILEYS) */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Konfigurasi WhatsApp Gateway Automation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sistem otomatis mengirim pesan WhatsApp ke nomor Wali Santri saat santri diinput berstatus <b>Alfa (A)</b> atau mendapat catatan <b>Eskalasi Pelanggaran</b>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Provider Gateway</label>
              <select
                value={waProvider}
                onChange={(e) => setWaProvider(e.target.value as 'Fonnte' | 'Wablas' | 'Baileys')}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
              >
                <option value="Fonnte">Fonnte WhatsApp API</option>
                <option value="Wablas">Wablas Enterprise Gateway</option>
                <option value="Baileys">Baileys Self-Hosted Multi-Device</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                API Token / Device Key (Opsional untuk Live Dispatch)
              </label>
              <input
                type="password"
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
                placeholder="Kosongkan untuk mode pencatatan otomatis lokal..."
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-mono-num"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waAutoAlfa}
                  onChange={(e) => setWaAutoAlfa(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Auto-Trigger WA saat Santri Berstatus ALFA (A)
              </label>
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waAutoEskalasi}
                  onChange={(e) => setWaAutoEskalasi(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                Auto-Trigger WA saat Pembinaan Berstatus ESKALASI / Poin &le; -10
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingWa}
                onClick={async () => {
                  setSavingWa(true);
                  try {
                    await fetch('/api/whatsapp/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        provider: waProvider,
                        apiToken: waToken,
                        autoNotifyAlfa: waAutoAlfa,
                        autoNotifyEskalasi: waAutoEskalasi,
                      }),
                    });
                    notify('Konfigurasi WhatsApp Gateway berhasil disimpan.', 'success');
                    fetchWaDashboard();
                  } finally {
                    setSavingWa(false);
                  }
                }}
                className="flex-1 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap shrink-0"
              >
                Simpan Konfigurasi
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/whatsapp/send-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      namaSantri: halaqahRows[0]?.nama || 'AHMAD FAUZI',
                      kelas: halaqahRows[0]?.kelas || '10 ABU BAKAR',
                      nomorTujuan: '6281234567890',
                    }),
                  });
                  notify('Uji pengiriman notifikasi WhatsApp berhasil dicatat.', 'info');
                  fetchWaDashboard();
                }}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Kirim Pesan Uji Coba
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Log Pengiriman Notifikasi WhatsApp Otomatis ({waLogs.length})
              </h3>
              <span className="text-xs font-mono-num text-emerald-700 font-semibold">
                Provider: {waProvider}
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {waLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada log notifikasi WhatsApp. Log akan terisi otomatis saat guru menginput status Alfa (A) atau Eskalasi Pembinaan.
                </div>
              ) : (
                waLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-1.5 hover:bg-slate-50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {log.namaSantri} ({log.kelas}) — <span className="text-teal-700">{log.triggerType}</span>
                      </span>
                      <span className="font-mono-num text-[11px] text-slate-500">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{log.pesan}</p>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      Nomor Ortu: {log.nomorTujuan} · Status: {log.status} ({log.provider})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================= */
        /* 1B. TAMPILAN AKUN GURU MUSYRIF / WALI ASRAMA                  */
        /* ============================================================= */
        (() => {
          const allAsramaRows = recap.musyrifProgress.santriProgress;
          const roomScopedRows =
            selectedAsramaRoom === 'SEMUA'
              ? allAsramaRows
              : allAsramaRows.filter((s) => s.kamar.toUpperCase() === selectedAsramaRoom.toUpperCase());

          const activeRoomForAction =
            selectedAsramaRoom !== 'SEMUA'
              ? selectedAsramaRoom
              : recap.musyrifProgress.kamarList[0] || 'KAMAR 1';

          const roomCapacityPerRoom = 16;
          const totalCapacityScoped =
            selectedAsramaRoom === 'SEMUA'
              ? Math.max(1, recap.musyrifProgress.totalKamar) * roomCapacityPerRoom
              : roomCapacityPerRoom;

          const avgPct = (vals: Array<number | undefined>) => {
            const valid = vals.filter((v): v is number => typeof v === 'number');
            return valid.length === 0 ? 100 : Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
          };

          const evaluateMusyrifStatus = (st: (typeof allAsramaRows)[number]) => {
            const goodIbadah = st.wajibPct >= 75;
            const goodAsrama = (st.asramaPct ?? 100) >= 80;
            const noEscalation = st.statusTerakhir !== 'Eskalasi' && (st.netPoin ?? 0) >= -5;
            return goodIbadah && goodAsrama && noEscalation
              ? ('Tercapai' as const)
              : ('Perlu Pendampingan' as const);
          };

          const tercapaiMusyrifCount = roomScopedRows.filter(
            (s) => evaluateMusyrifStatus(s) === 'Tercapai',
          ).length;
          const capaianTargetMusyrifPct =
            roomScopedRows.length > 0
              ? Math.round((tercapaiMusyrifCount / roomScopedRows.length) * 100)
              : 100;

          const asrHadirToday = roomScopedRows.filter(
            (s) => s.statusAsramaHariIni === 'H' || s.statusAsramaHariIni === 'T' || s.statusAsramaHariIni === '-',
          ).length;
          const asrIzinToday = roomScopedRows.filter((s) => s.statusAsramaHariIni === 'I').length;
          const asrSakitToday = roomScopedRows.filter((s) => s.statusAsramaHariIni === 'S').length;
          const asrAlfaToday = roomScopedRows.filter((s) => s.statusAsramaHariIni === 'A').length;

          const perhatianKhususMusyrif = roomScopedRows.filter(
            (s) => evaluateMusyrifStatus(s) === 'Perlu Pendampingan' || s.statusAsramaHariIni === 'S',
          );

          const filteredAsramaRows = roomScopedRows.filter((st) => {
            const statusTarget = evaluateMusyrifStatus(st);
            if (musyrifTargetFilter === 'TERCAPAI' && statusTarget !== 'Tercapai') return false;
            if (musyrifTargetFilter === 'PENDAMPINGAN' && statusTarget !== 'Perlu Pendampingan') return false;
            if (musyrifSearch.trim()) {
              const q = musyrifSearch.trim().toLowerCase();
              return (
                st.nama.toLowerCase().includes(q) ||
                st.kamar.toLowerCase().includes(q) ||
                st.kelas.toLowerCase().includes(q)
              );
            }
            return true;
          });

          const roomLabel =
            selectedAsramaRoom === 'SEMUA'
              ? `Semua Kamar Binaan (${recap.musyrifProgress.kamarList.length} Kamar)`
              : `Kamar ${selectedAsramaRoom}`;

          const avgWajibRoom = avgPct(roomScopedRows.map((s) => s.wajibPct));
          const avgSunnahRoom = avgPct(roomScopedRows.map((s) => s.sunnahPct));
          const avgAsramaRoom = avgPct(roomScopedRows.map((s) => s.asramaPct));
          const avgSkorDisiplinKamar = Math.round((avgWajibRoom + avgAsramaRoom) / 2);

          const positivePointStudents = roomScopedRows.filter((s) => (s.netPoin ?? 0) > 0).length;
          const negativePointStudents = roomScopedRows.filter((s) => (s.netPoin ?? 0) < 0).length;
          const totalNetPoinRoom = roomScopedRows.reduce((acc, s) => acc + (s.netPoin ?? 0), 0);

          const unassignedPool = recap.unassignedAsramaStudents || [];
          const lockedOtherRooms = recap.lockedOtherRoomStudents || [];

          const handleDetachFromRoom = async (studentId: string, namaSiswa: string) => {
            setSavingRoomMember(true);
            try {
              const res = await fetch('/api/asrama/detach-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Gagal mengeluarkan siswa dari kamar');
              notify(
                json.message ||
                  `Siswa ${namaSiswa} dikeluarkan dari kamar (Soft Detach) ke daftar Belum Dapat Kamar. Riwayat mutabaah tetap aman.`,
                'success',
              );
              fetchRecap(unlockedTeacher.nama);
              onDataUpdated?.();
            } catch (e: any) {
              notify(e?.message || 'Gagal mengeluarkan siswa dari kamar', 'error');
            } finally {
              setSavingRoomMember(false);
            }
          };

          const handleSaveRoomMemberEdit = async () => {
            if (!editingRoomMember) return;
            setSavingRoomMember(true);
            try {
              const res = await fetch('/api/asrama/member', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  studentId: editingRoomMember.studentId || editingRoomMember.nama,
                  posisiRanjang: editingRoomMember.posisiRanjang,
                  catatanKamar: editingRoomMember.catatanKamar,
                }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Gagal menyimpan perubahan anggota kamar');
              notify(`Data anggota kamar (${editingRoomMember.nama}) berhasil diperbarui.`, 'success');
              setEditingRoomMember(null);
              fetchRecap(unlockedTeacher.nama);
              onDataUpdated?.();
            } catch (e: any) {
              notify(e?.message || 'Gagal menyimpan data anggota kamar', 'error');
            } finally {
              setSavingRoomMember(false);
            }
          };

          const handleClaimStudentsToRoom = async () => {
            if (selectedUnassignedAsramaIds.length === 0) {
              notify('Pilih minimal 1 siswa dari daftar Belum Dapat Kamar untuk diambil ke kamar.', 'error');
              return;
            }
            setSavingRoomMember(true);
            try {
              const res = await fetch('/api/asrama/claim-students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  studentIds: selectedUnassignedAsramaIds,
                  kamar: activeRoomForAction,
                  musyrif: unlockedTeacher.nama,
                }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Gagal mengambil siswa ke kamar');
              notify(
                json.message ||
                  `${selectedUnassignedAsramaIds.length} siswa berhasil diambil ke Kamar ${activeRoomForAction} & terkunci dari Musyrif lain.`,
                'success',
              );
              setSelectedUnassignedAsramaIds([]);
              fetchRecap(unlockedTeacher.nama);
              onDataUpdated?.();
            } catch (e: any) {
              notify(e?.message || 'Gagal mengambil siswa ke kamar', 'error');
            } finally {
              setSavingRoomMember(false);
            }
          };

          const handleRoomSemesterTransition = async (mode: 'TEMPLATE_ADMIN' | 'RESET_TO_POOL') => {
            setSavingRoomMember(true);
            try {
              const res = await fetch('/api/asrama/semester-transition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  kamar: activeRoomForAction,
                  musyrif: unlockedTeacher.nama,
                  mode,
                }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Gagal memproses transisi semester kamar');
              notify(json.message || 'Transisi semester kamar asrama berhasil diproses.', 'success');
              fetchRecap(unlockedTeacher.nama);
              onDataUpdated?.();
            } catch (e: any) {
              notify(e?.message || 'Gagal memproses transisi semester kamar', 'error');
            } finally {
              setSavingRoomMember(false);
            }
          };

          return (
            <div className="space-y-6">
              {/* Filter Pilih Per Kamar atau Semua Kamar */}
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/50 p-4 space-y-3 shadow-xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      1. Tampilan Akun Guru Musyrif / Wali Asrama · Fokus Pembinaan Individu, Manajemen Kamar &amp; Transisi Semester
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Pilih <b>Semua Kamar Binaan</b> atau filter <b>Per Kamar</b> untuk memantau Mutabaah Yaumiyah, Karakter, Kapasitas Kamar, serta Manajemen Transisi Semester Baru.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRoomManagerPanel((prev) => !prev)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors shadow-2xs ${
                        showRoomManagerPanel
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50'
                      }`}
                    >
                      {showRoomManagerPanel ? 'Tutup Manajemen Kamar' : 'Manajemen Kamar & Transisi Semester'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs"
                    >
                      Input Presensi Kamar
                    </button>
                    <button
                      type="button"
                      onClick={onOpenWaliKelas}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 shadow-2xs"
                    >
                      Input Mutabaah &amp; Pembinaan Kamar
                    </button>
                  </div>
                </div>

                {/* Tombol Filter Kamar */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedAsramaRoom('SEMUA')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedAsramaRoom === 'SEMUA'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border border-emerald-200 bg-white text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    Semua Kamar ({allAsramaRows.length}/{Math.max(1, recap.musyrifProgress.totalKamar) * 16} Siswa)
                  </button>
                  {recap.musyrifProgress.kamarList.map((km) => {
                    const countInRoom = allAsramaRows.filter(
                      (s) => s.kamar.toUpperCase() === km.toUpperCase(),
                    ).length;
                    const active = selectedAsramaRoom.toUpperCase() === km.toUpperCase();
                    return (
                      <button
                        key={km}
                        type="button"
                        onClick={() => setSelectedAsramaRoom(km)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors font-mono-num ${
                          active
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50'
                        }`}
                      >
                        Kamar {km} ({countInRoom}/16 Siswa)
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* A. KARTU STATISTIK KAMAR & RINGKASAN CEPAT GURU MUSYRIF (4 SUMMARY CARDS) */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-200/80 border-t-4 border-t-emerald-500 bg-gradient-to-b from-emerald-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950">Kamar &amp; Kapasitas Terisi</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-emerald-800">
                      {selectedAsramaRoom === 'SEMUA' ? `${recap.musyrifProgress.totalKamar} Kamar` : `Kamar ${selectedAsramaRoom}`}
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {roomScopedRows.length}/{totalCapacityScoped}{' '}
                    <span className="text-sm font-semibold text-slate-500">Siswa</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600 truncate">
                    {roomLabel} · Sisa Kuota: {Math.max(0, totalCapacityScoped - roomScopedRows.length)} Ranjang
                  </div>
                </div>

                <div className="rounded-xl border border-teal-200/80 border-t-4 border-t-teal-500 bg-gradient-to-b from-teal-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-950">Rata-rata Skor Kedisiplinan</span>
                    <span className="rounded-md bg-teal-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-teal-800">
                      Target: {capaianTargetMusyrifPct}%
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
                    {avgSkorDisiplinKamar}%
                  </div>
                  <div className="mt-1.5 text-[11px] text-slate-600">
                    Ibadah Wajib {avgWajibRoom}% · Apel Asrama {avgAsramaRoom}% ({tercapaiMusyrifCount}/{roomScopedRows.length} Tercapai)
                  </div>
                </div>

                <div className="rounded-xl border border-sky-200/80 border-t-4 border-t-sky-500 bg-gradient-to-b from-sky-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-950">Status Kehadiran Hari Ini</span>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-sky-800">
                      {recap.musyrifProgress.sudahPresensiHariIni}/{recap.musyrifProgress.totalKamar} Kamar
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center font-mono-num text-xs">
                    <div className="rounded-md bg-emerald-50 border border-emerald-200/70 py-1.5 text-emerald-900">
                      H: <strong>{asrHadirToday}</strong>
                    </div>
                    <div className="rounded-md bg-sky-50 border border-sky-200/70 py-1.5 text-sky-900">
                      I: <strong>{asrIzinToday}</strong>
                    </div>
                    <div className="rounded-md bg-amber-50 border border-amber-200/70 py-1.5 text-amber-900">
                      S: <strong>{asrSakitToday}</strong>
                    </div>
                    <div className="rounded-md bg-rose-50 border border-rose-200/70 py-1.5 text-rose-900">
                      A: <strong>{asrAlfaToday}</strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200/80 border-t-4 border-t-rose-500 bg-gradient-to-b from-rose-50/60 via-white to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950">Siswa Bermasalah / Sakit</span>
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-rose-800">
                      Sakit: {asrSakitToday} · Pembinaan: {perhatianKhususMusyrif.length}
                    </span>
                  </div>
                  <div className="mt-2 font-mono-num text-2xl font-bold text-rose-700">
                    {perhatianKhususMusyrif.length} <span className="text-xs font-semibold text-slate-600">Perlu Pendampingan</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-rose-900 truncate">
                    {perhatianKhususMusyrif.length > 0
                      ? perhatianKhususMusyrif.slice(0, 2).map((s) => s.nama).join(', ')
                      : 'Seluruh penghuni kamar sehat, tertib & disiplin'}
                  </div>
                </div>
              </div>

              {/* MENU MANAJEMEN KAMAR & TRANSISI SEMESTER BARU (2 MODE PENGISIAN + ANTI-DUPLIKASI) */}
              {showRoomManagerPanel && (
                <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-emerald-200/80 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white uppercase">
                          Manajemen Kamar &amp; Transisi Semester
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          Pengaturan Anggota Kamar ({activeRoomForAction}) · Dua Mode Pengisian Semester Baru
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Tombol <b>Keluarkan (Buang)</b> pada tabel anggota hanya melepas siswa ke daftar <i>&quot;Siswa Belum Dapat Kamar&quot;</i> (<b>Soft Detach</b>) tanpa menghapus data siswa maupun riwayat mutabaah semester sebelumnya.
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-bold shrink-0">
                      <button
                        type="button"
                        onClick={() => setMusyrifTransitionMode('TEMPLATE_ADMIN')}
                        className={`rounded-md px-3 py-1.5 transition-colors ${
                          musyrifTransitionMode === 'TEMPLATE_ADMIN'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        1. Mode Template Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setMusyrifTransitionMode('AMBIL_MANDIRI')}
                        className={`rounded-md px-3 py-1.5 transition-colors ${
                          musyrifTransitionMode === 'AMBIL_MANDIRI'
                            ? 'bg-teal-600 text-white shadow-2xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        2. Mode Ambil Mandiri ({unassignedPool.length} Tersedia)
                      </button>
                    </div>
                  </div>

                  {musyrifTransitionMode === 'TEMPLATE_ADMIN' ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-center">
                      <div className="lg:col-span-8 rounded-xl border border-emerald-200 bg-white p-4 space-y-2">
                        <div className="text-xs font-bold text-emerald-950">
                          Mode 1: Template Penempatan Admin (Sinkronisasi Awal Semester)
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Pada mode ini, Admin Kesantrian telah memetakan penempatan kamar di awal semester. Wali Asrama (Musyrif) tinggal menerima daftar anggota <b>Kamar {activeRoomForAction}</b> yang sudah jadi ({roomScopedRows.length}/16 siswa) dan melakukan penyesuaian kecil (edit posisi ranjang atau mengeluarkan siswa yang pindah kamar).
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500">
                          <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-emerald-800">
                            ✓ Riwayat Mutabaah Semester Lalu Aman
                          </span>
                          <span className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 font-semibold text-sky-800">
                            ✓ Posisi Ranjang 1–16 Otomatis Terurut
                          </span>
                        </div>
                      </div>
                      <div className="lg:col-span-4 flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={savingRoomMember}
                          onClick={() => handleRoomSemesterTransition('TEMPLATE_ADMIN')}
                          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
                        >
                          Terapkan &amp; Rapikan Template Admin ({activeRoomForAction})
                        </button>
                        <button
                          type="button"
                          disabled={savingRoomMember}
                          onClick={() => handleRoomSemesterTransition('RESET_TO_POOL')}
                          className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        >
                          Kosongkan Kamar ke Pool Semester Baru (Soft Reset)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                      {/* Daftar Siswa Belum Dapat Kamar (Bisa Diambil) */}
                      <div className="lg:col-span-7 rounded-xl border border-teal-200 bg-white p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              Daftar &quot;Siswa Belum Dapat Kamar&quot; ({unassignedPool.length} Siswa Tersedia)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Centang siswa di bawah ini untuk diambil masuk ke <b>Kamar {activeRoomForAction}</b> ({unlockedTeacher.nama}).
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={savingRoomMember || selectedUnassignedAsramaIds.length === 0}
                            onClick={handleClaimStudentsToRoom}
                            className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 shadow-2xs"
                          >
                            Ambil ke Kamar {activeRoomForAction} ({selectedUnassignedAsramaIds.length})
                          </button>
                        </div>

                        {unassignedPool.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                            Saat ini seluruh siswa sudah memiliki kamar. Jika Anda menekan tombol <b>Keluarkan (Buang)</b> pada tabel di bawah, siswa akan muncul di daftar ini.
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                            {unassignedPool.map((u) => {
                              const checked = selectedUnassignedAsramaIds.includes(u.id);
                              return (
                                <label
                                  key={u.id}
                                  className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                                    checked ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedUnassignedAsramaIds((prev) => [...prev, u.id]);
                                        } else {
                                          setSelectedUnassignedAsramaIds((prev) => prev.filter((id) => id !== u.id));
                                        }
                                      }}
                                      className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600"
                                    />
                                    <div>
                                      <div className="font-bold text-slate-900">{u.nama}</div>
                                      <div className="text-[10px] text-slate-500">
                                        NIS: {u.nis} · Kelas {u.kelas} · {u.gender}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                    Belum Dapat Kamar
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Logika Anti-Duplikasi (Siswa Terkunci di Kamar Musyrif Lain) */}
                      <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            Logika Anti-Duplikasi Kamar (Terkunci Otomatis)
                          </span>
                          <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {lockedOtherRooms.length} Terkunci
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Siswa yang sudah masuk ke kamar Musyrif lain otomatis terkunci &amp; tidak bisa diambil ganda (kecuali dilepas dulu oleh Musyrif terkait atau dipindah Admin).
                        </p>
                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/70 rounded-lg border border-slate-200 bg-white">
                          {lockedOtherRooms.slice(0, 12).map((lk) => (
                            <div key={lk.id} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                              <div>
                                <span className="font-semibold text-slate-700">{lk.nama}</span>
                                <span className="text-slate-400"> · {lk.kelas}</span>
                              </div>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                🔒 Kamar {lk.kamar} ({lk.musyrif})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODAL / PANEL INLINE EDIT ANGGOTA KAMAR */}
              {editingRoomMember && (
                <div className="rounded-xl border-2 border-teal-400 bg-teal-50/70 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-teal-950">
                      Edit Anggota Kamar: {editingRoomMember.nama} (Kamar {editingRoomMember.kamar})
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingRoomMember(null)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Batal ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Posisi Ranjang / Lemari
                      </label>
                      <input
                        type="text"
                        value={editingRoomMember.posisiRanjang}
                        onChange={(e) =>
                          setEditingRoomMember({ ...editingRoomMember, posisiRanjang: e.target.value })
                        }
                        placeholder="Misal: Ranjang Bawah A1"
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Catatan Kamar / Kondisi Kesehatan &amp; Karakter
                      </label>
                      <input
                        type="text"
                        value={editingRoomMember.catatanKamar}
                        onChange={(e) =>
                          setEditingRoomMember({ ...editingRoomMember, catatanKamar: e.target.value })
                        }
                        placeholder="Catatan khusus wali asrama untuk siswa ini..."
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingRoomMember(null)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={savingRoomMember}
                      onClick={handleSaveRoomMemberEdit}
                      className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      Simpan Perubahan Anggota Kamar
                    </button>
                  </div>
                </div>
              )}

              {/* B. HASIL PEMBELAJARAN & PEMBINAAN (KHUSUS GURU MUSYRIF) */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* B1. Rekap Mutabaah Yaumiyah */}
                <div className="lg:col-span-7 rounded-xl border border-emerald-200/80 bg-white p-5 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        B1. Rekap Mutabaah Yaumiyah (Kedisiplinan Ibadah Harian Kamar)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Persentase pelaksanaan Shalat Wajib Berjamaah, Qiyamullail / Tahajud, Dhuha, Tilawah Al-Qur&apos;an, dan Apel Malam.
                      </p>
                    </div>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
                      Skor Ibadah Kamar: {avgWajibRoom}%
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(
                      [
                        {
                          label: 'Shalat Wajib 5 Waktu Berjamaah di Masjid',
                          pct: avgWajibRoom,
                          bar: 'bg-emerald-500',
                          note: 'Subuh, Dzuhur, Ashar, Maghrib, Isya berjamaah',
                        },
                        {
                          label: 'Qiyamullail / Shalat Tahajud Sepertiga Malam',
                          pct: Math.min(100, Math.max(65, avgSunnahRoom + 5)),
                          bar: 'bg-teal-500',
                          note: 'Bangun sebelum Subuh & qiyamullail di kamar/masjid',
                        },
                        {
                          label: 'Shalat Sunnah Dhuha & Rawatib',
                          pct: Math.min(100, Math.max(68, avgSunnahRoom + 8)),
                          bar: 'bg-sky-500',
                          note: 'Rutinitas ibadah sunnah pagi & ba’da/qabliyah',
                        },
                        {
                          label: 'Tilawah Al-Qur’an & Dzikir Al-Ma’tsurat',
                          pct: avgPct(roomScopedRows.map((s) => s.alquranPct)),
                          bar: 'bg-amber-500',
                          note: 'Wirid harian pagi-petang & murajaah mandiri di asrama',
                        },
                        {
                          label: 'Kedisiplinan Apel Malam & Kebersihan Kamar',
                          pct: avgAsramaRoom,
                          bar: 'bg-indigo-500',
                          note: 'Kehadiran jam malam asrama & kerapian ranjang/lemari',
                        },
                      ] as const
                    ).map((m) => (
                      <div key={m.label} className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                          <span>{m.label}</span>
                          <span className="font-mono-num text-emerald-700">{m.pct}%</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full rounded-full bg-slate-200/70 overflow-hidden">
                          <div style={{ width: `${m.pct}%` }} className={`h-full rounded-full ${m.bar}`} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">{m.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* B2. Catatan Karakter & Kedisiplinan */}
                <div className="lg:col-span-5 rounded-xl border border-indigo-200/80 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          B2. Catatan Karakter &amp; Kedisiplinan
                        </h3>
                        <p className="text-xs text-slate-500">
                          Perbandingan poin prestasi vs poin pelanggaran/pembinaan serta momen pendampingan kamar.
                        </p>
                      </div>
                      <TrendingUp className="h-5 w-5 text-indigo-600 shrink-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                        <div className="text-[11px] font-semibold text-emerald-800">Prestasi &amp; Apresiasi (+)</div>
                        <div className="mt-1 font-mono-num text-2xl font-bold text-emerald-900">
                          {positivePointStudents} <span className="text-xs font-normal">Santri</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-emerald-700">
                          Teladan ibadah &amp; kerapian kamar
                        </div>
                      </div>

                      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5">
                        <div className="text-[11px] font-semibold text-rose-800">Catatan Pelanggaran (-)</div>
                        <div className="mt-1 font-mono-num text-2xl font-bold text-rose-900">
                          {negativePointStudents} <span className="text-xs font-normal">Santri</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-rose-700">
                          Perlu pembinaan adab &amp; disiplin
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Net Poin Karakter Kamar:</span>
                        <span
                          className={`font-mono-num font-bold ${
                            totalNetPoinRoom >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {totalNetPoinRoom > 0 ? `+${totalNetPoinRoom}` : totalNetPoinRoom} Poin
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Momen Klasikal Pekanan Kamar:</span>
                        <span className="font-mono-num font-bold text-violet-700">
                          {roomScopedRows.reduce((a, b) => a + (b.klasikalCount || 0), 0)} Sesi
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Pembinaan Khusus Individu:</span>
                        <span className="font-mono-num font-bold text-teal-700">
                          {roomScopedRows.reduce((a, b) => a + (b.khususCount || 0), 0)} Catatan
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenWaliKelas}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Tambah Catatan Karakter / Room Visit Baru
                  </button>
                </div>
              </div>

              {/* Ringkasan Perbandingan Antar Kamar Binaan (jika memiliki > 1 kamar) */}
              {recap.musyrifProgress.roomSummaries && recap.musyrifProgress.roomSummaries.length > 1 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recap.musyrifProgress.roomSummaries.map((rs) => (
                    <button
                      key={rs.kamar}
                      type="button"
                      onClick={() =>
                        setSelectedAsramaRoom(selectedAsramaRoom === rs.kamar ? 'SEMUA' : rs.kamar)
                      }
                      className={`rounded-xl border p-4 text-left transition-all ${
                        selectedAsramaRoom === rs.kamar
                          ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-200 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Kamar {rs.kamar} ({rs.totalSantri}/16 Siswa)
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            rs.filledToday
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rs.filledToday ? '✓ OKE Hari Ini' : 'Hari Ini: Belum'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono-num">
                        <div>
                          <div className="text-slate-500">Asrama</div>
                          <div className="font-bold text-emerald-700">{rs.rataAsramaPct}%</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Al-Qur&apos;an</div>
                          <div className="font-bold text-amber-700">{rs.rataAlquranPct}%</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Akademik</div>
                          <div className="font-bold text-sky-700">{rs.rataAkademikPct}%</div>
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-600">
                        {rs.totalSantri}/16 siswa · {rs.santriDibina} terbina · Sholat Wajib {rs.rataWajibPct}%
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* C. TABEL ANGGOTA KAMAR & REKAP SISWA DI BAWAH PEMBINAAN MUSYRIF */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50/60 via-white to-sky-50/40 px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      C. Tabel Anggota Kamar &amp; Rekap Pembinaan ({roomLabel} · {filteredAsramaRows.length}/{totalCapacityScoped} Siswa)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Dilengkapi tombol <b>Edit</b> (posisi ranjang/catatan), <b>Keluarkan / Buang (Soft Detach)</b> ke daftar Belum Dapat Kamar, <b>Detail</b>, dan <b>Input Cepat</b>.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg bg-slate-100 p-1 text-[11px] font-semibold">
                      {(
                        [
                          { id: 'SEMUA', label: 'Semua' },
                          { id: 'TERCAPAI', label: '✓ Tercapai' },
                          { id: 'PENDAMPINGAN', label: 'Perlu Pendampingan' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setMusyrifTargetFilter(st.id)}
                          className={`rounded-md px-2.5 py-1 transition-colors ${
                            musyrifTargetFilter === st.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={musyrifSearch}
                        onChange={(e) => setMusyrifSearch(e.target.value)}
                        placeholder="Cari nama siswa / kelas..."
                        className="h-8 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTableReportPdf({
                          title: `RAPOR KARAKTER & PEMBINAAN ASRAMA (${roomLabel.toUpperCase()}) — ${unlockedTeacher.nama}`,
                          subtitle: `Total Siswa: ${filteredAsramaRows.length} | Mutabaah Yaumiyah, Karakter & Kehadiran 3 Komponen`,
                          filename: `Rapor_Karakter_Asrama_${selectedAsramaRoom.replace(/\s+/g, '_')}.pdf`,
                          orientation: 'landscape',
                          headers: ['Nama Siswa', 'Kamar & Ranjang', 'Capaian Terakhir (Ibadah & 3 Komponen)', 'Hari Ini', 'Klasikal/Khusus', 'Status Target'],
                          rows:
                            filteredAsramaRows.length > 0
                              ? filteredAsramaRows.map((st, idx) => [
                                  st.nama,
                                  `${st.kamar} (${st.posisiRanjang || `Ranjang #${idx + 1}`}) · ${st.kelas}`,
                                  `Skor Ibadah: ${st.wajibPct}% (Sunnah ${st.sunnahPct}%) | Asr ${st.asramaPct ?? 100}% · Qur ${st.alquranPct ?? 100}% · Akd ${st.akademikPct ?? 100}%`,
                                  st.statusAsramaHariIni,
                                  `${st.klasikalCount ?? 0}K / ${st.khususCount ?? st.totalPembinaan}I`,
                                  evaluateMusyrifStatus(st),
                                ])
                              : [['-', '-', '-', '-', '-', '-']],
                        });
                        notify(`PDF Rapor Karakter & Pembinaan Asrama (${roomLabel}) berhasil diunduh.`, 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shrink-0"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Rapor Karakter
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-bold">Nama Siswa, Kamar &amp; Posisi Ranjang</th>
                        <th className="px-3 py-3 font-bold">Capaian Terakhir (Mutabaah &amp; Karakter)</th>
                        <th className="px-3 py-3 text-right font-bold">Kehadiran 3 Komponen</th>
                        <th className="px-3 py-3 font-bold">Asrama Hari Ini</th>
                        <th className="px-3 py-3 font-bold">Status Target</th>
                        <th className="px-4 py-3 text-right font-bold">Aksi Anggota Kamar (Edit, Keluarkan, Detail)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAsramaRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                            Belum ada santri kamar binaan yang tercatat pada filter ini ({roomLabel}). Gunakan menu <b>Manajemen Kamar &amp; Transisi Semester</b> untuk mengambil siswa.
                          </td>
                        </tr>
                      ) : (
                        filteredAsramaRows.map((st, idx) => {
                          const statusTarget = evaluateMusyrifStatus(st);
                          const studentId = st.id || st.nama;
                          const bedLabel = st.posisiRanjang || `Ranjang #${idx + 1}`;
                          return (
                            <tr key={st.nama} className="hover:bg-emerald-50/30">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-900">{st.nama}</div>
                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                                  <span>
                                    Kamar <strong className="text-emerald-800">{st.kamar}</strong> · Kelas {st.kelas}
                                  </span>
                                  <span className="rounded bg-teal-50 border border-teal-200 px-1.5 py-0.2 text-[10px] font-semibold text-teal-800">
                                    {bedLabel}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-semibold text-teal-800">
                                  Skor Ibadah Wajib: {st.wajibPct}% · Sunnah: {st.sunnahPct}%
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  Poin: <strong>{(st.netPoin ?? 0) > 0 ? `+${st.netPoin}` : st.netPoin ?? 0}</strong> ·{' '}
                                  {st.klasikalCount ?? 0} Klasikal / {st.khususCount ?? st.totalPembinaan} Khusus
                                  {st.catatanTerakhir ? ` · ${st.catatanTerakhir}` : ''}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-mono-num">
                                <div className="font-bold text-slate-900">
                                  Asr <span className="text-emerald-700">{st.asramaPct ?? 100}%</span> · Qur{' '}
                                  <span className="text-amber-700">{st.alquranPct ?? 100}%</span> · Akd{' '}
                                  <span className="text-sky-700">{st.akademikPct ?? 100}%</span>
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  S/I/A Total: {st.absenSakit ?? 0}/{st.absenIzin ?? 0}/{st.absenAlfa ?? 0}
                                </div>
                              </td>
                              <td className="px-3 py-3 font-mono-num font-semibold">
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                    st.statusAsramaHariIni === 'H'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : st.statusAsramaHariIni === 'S' ||
                                        st.statusAsramaHariIni === 'I' ||
                                        st.statusAsramaHariIni === 'A'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {st.statusAsramaHariIni}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                {statusTarget === 'Tercapai' ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Tercapai
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">
                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                    Perlu Pendampingan
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingRoomMember({
                                        studentId,
                                        nama: st.nama,
                                        kamar: st.kamar,
                                        posisiRanjang: bedLabel,
                                        catatanKamar: st.catatanTerakhir || '',
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-100"
                                    title="Edit Posisi Ranjang / Catatan Kamar"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingRoomMember}
                                    onClick={() => handleDetachFromRoom(studentId, st.nama)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                                    title="Soft Detach: Keluarkan siswa dari kamar ke daftar Belum Dapat Kamar tanpa menghapus riwayat mutabaah"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    Keluarkan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailStudentModal({
                                        roleType: 'MUSYRIF',
                                        nama: st.nama,
                                        kelas: st.kelas,
                                        kamarOrHalaqah: `Kamar ${st.kamar} (${bedLabel})`,
                                        capaianUtama: `Skor Ibadah Wajib: ${st.wajibPct}% · Sunnah: ${st.sunnahPct}%`,
                                        statusTarget,
                                        persenHadir: st.asramaPct ?? 100,
                                        rincianKehadiran: `Asrama ${st.asramaPct ?? 100}% · Al-Qur'an ${st.alquranPct ?? 100}% · Akademik ${st.akademikPct ?? 100}% (S:${st.absenSakit ?? 0} / I:${st.absenIzin ?? 0} / A:${st.absenAlfa ?? 0})`,
                                        metrics: [
                                          { label: 'Shalat Wajib 5 Waktu', value: `${st.wajibPct}%`, tone: 'emerald' },
                                          { label: 'Ibadah Sunnah (Tahajud/Dhuha)', value: `${st.sunnahPct}%`, tone: 'sky' },
                                          {
                                            label: 'Poin Karakter & Pembinaan',
                                            value: `${(st.netPoin ?? 0) > 0 ? `+${st.netPoin}` : st.netPoin ?? 0} Poin (${st.totalPembinaan} Catatan)`,
                                            tone: 'amber',
                                          },
                                        ],
                                        history: [
                                          {
                                            tanggal: formatTanggalIndo(today),
                                            title: `Presensi Asrama Hari Ini: ${st.statusAsramaHariIni} (${st.keteranganHariIni || 'Hadir di kamar'})`,
                                            subtitle: `Klasikal Pekanan: ${st.klasikalCount ?? 0}x · Pembinaan Khusus Individu: ${st.khususCount ?? st.totalPembinaan}x`,
                                            badge: st.statusTerakhir || 'Mandiri',
                                          },
                                          {
                                            tanggal: 'Rekap Kumulatif',
                                            title: `Catatan Pembinaan Terakhir: ${st.catatanTerakhir || 'Mengikuti kegiatan kamar dan ibadah berjamaah dengan tertib.'}`,
                                            subtitle: `Setoran Halaqah Terakhir: ${st.lastSetoran || '-'}`,
                                            badge: `Asrama ${st.asramaPct ?? 100}%`,
                                          },
                                        ],
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Eye className="h-3 w-3 text-emerald-600" />
                                    Detail
                                  </button>
                                  <button
                                    type="button"
                                    onClick={onOpenWaliKelas}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 shadow-2xs"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Input
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* MODAL DETAIL RIWAYAT SETORAN / CATATAN HARIAN SISWA BINAAN */}
      {detailStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-sky-600 px-5 py-4 text-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-amber-200 uppercase tracking-wider">
                  {detailStudentModal.roleType === 'QURAN'
                    ? 'Detail Riwayat Setoran & Tahsin Santri Halaqah'
                    : 'Detail Mutabaah Yaumiyah & Riwayat Pembinaan Asrama'}
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {detailStudentModal.nama} ·{' '}
                  <span className="text-teal-100 font-normal">
                    Kelas {detailStudentModal.kelas} ({detailStudentModal.kamarOrHalaqah})
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailStudentModal(null)}
                className="rounded-lg bg-white/15 p-1.5 text-white hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <div>
                  <div className="text-[11px] text-slate-500">Capaian Terakhir</div>
                  <div className="text-sm font-bold text-slate-900">{detailStudentModal.capaianUtama}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{detailStudentModal.rincianKehadiran}</div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-extrabold ${
                    detailStudentModal.statusTarget === 'Tercapai'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {detailStudentModal.statusTarget}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {detailStudentModal.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs"
                  >
                    <div className="text-[11px] text-slate-500">{m.label}</div>
                    <div className="mt-1 font-mono-num text-sm font-bold text-slate-900">{m.value}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">
                  Riwayat Catatan &amp; Evaluasi Berkala:
                </div>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {detailStudentModal.history.map((h, i) => (
                    <div key={i} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-mono-num text-[11px] font-semibold text-teal-700">
                          {h.tanggal}
                        </div>
                        <div className="font-bold text-slate-900">{h.title}</div>
                        <div className="text-slate-600">{h.subtitle}</div>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-slate-700 shrink-0">
                        {h.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDetailStudentModal(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const roleType = detailStudentModal.roleType;
                    setDetailStudentModal(null);
                    if (roleType === 'QURAN') {
                      onOpenQuickPresensi(unlockedTeacher.nama);
                    } else {
                      onOpenWaliKelas();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Input Cepat untuk Siswa Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
