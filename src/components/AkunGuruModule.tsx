import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Home,
  KeyRound,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  Gender,
  PimpinanExecutiveReport,
  ScheduleItem,
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
    tidakHadir: number;
    timestamp: string;
  }>;
  allMySchedules: ScheduleItem[];
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
    jumlahTopikUnik: number;
    materiTerakhir: string;
    tanggalTerakhir: string;
    riwayatMateri: Array<{
      tanggal: string;
      materi: string;
      hadir: number;
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
      nama: string;
      kelas: string;
      kamar: string;
      gender?: Gender;
      waliKelas?: string;
      musyrif?: string;
      guruWali?: string;
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
      nama: string;
      kelas: string;
      kamar: string;
      gender?: Gender;
      waliKelas?: string;
      musyrif?: string;
      guruWali?: string;
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
      nama: string;
      kelas: string;
      kamar: string;
      gender?: Gender;
      waliKelas?: string;
      guruWali?: string;
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
  onOpenQuickPresensi: (namaGuru: string) => void;
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
      kelompokQuran: string;
      pengampuQuran: string;
      persenHadir: number;
      totalHadir: number;
      totalAbsen: number;
      lastSetoran: string;
      lastTilawah: string;
      lastMurajaah: string;
      lastTanggal: string;
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
  const [savingJadwal, setSavingJadwal] = useState(false);
  const [uploadingJadwalExcel, setUploadingJadwalExcel] = useState(false);

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
      if (unlockedTeacher.genderScope === 'Putra' || unlockedTeacher.genderScope === 'Putri') {
        setPimpinanWilayah(unlockedTeacher.genderScope);
      } else {
        setPimpinanWilayah('Semua');
      }

      const tabKey = `pintar_akunguru_tab_${unlockedTeacher.id || 'default'}`;
      let savedTab: string | null = null;
      try {
        savedTab = localStorage.getItem(tabKey);
      } catch {
        savedTab = null;
      }
      if (allRoles.has('Pimpinan')) {
        setProgressTab('pimpinan');
      } else if (savedTab && (AKUN_TABS as readonly string[]).includes(savedTab)) {
        setProgressTab(savedTab as AkunProgressTab);
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
      } else {
        setProgressTab('mengajar');
      }
    }
  }, [unlockedTeacher]);

  useEffect(() => {
    if (unlockedTeacher) {
      saveSubTab(`pintar_akunguru_tab_${unlockedTeacher.id || 'default'}`, progressTab);
    }
  }, [progressTab, unlockedTeacher]);

  const fetchRecap = (namaGuru: string) => {
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
        if (data && data.teacher) setRecap(data);
      })
      .catch(() => {})
      .finally(() => setLoadingRecap(false));
  };

  const fetchHalaqahRecap = (namaGuru: string) => {
    setLoadingHalaqah(true);
    fetch(`/api/halaqah/rekap?guru=${encodeURIComponent(namaGuru)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.rows) && data.rows.length > 0) {
          setHalaqahRows(data.rows);
        } else {
          fetch('/api/halaqah/rekap')
            .then((r2) => r2.json())
            .then((allData) => setHalaqahRows(allData?.rows || []));
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
      fetchRecap(unlockedTeacher.nama);
      fetchHalaqahRecap(unlockedTeacher.nama);
      fetchWaDashboard();
      fetchPimpinanExecutiveReport(pimpinanWilayah);
    } else {
      setRecap(null);
      setPimpinanReport(null);
    }
  }, [unlockedTeacher]);

  useEffect(() => {
    if (unlockedTeacher) {
      fetchPimpinanExecutiveReport(pimpinanWilayah);
    }
  }, [pimpinanWilayah, unlockedTeacher]);

  useEffect(() => {
    if (!unlockedTeacher) return;
    const onSync = () => {
      fetchRecap(unlockedTeacher.nama);
      fetchHalaqahRecap(unlockedTeacher.nama);
      fetchPimpinanExecutiveReport(pimpinanWilayah);
    };
    window.addEventListener('pintar:data-restored', onSync);
    window.addEventListener('pintar:data-mutated', onSync);
    return () => {
      window.removeEventListener('pintar:data-restored', onSync);
      window.removeEventListener('pintar:data-mutated', onSync);
    };
  }, [unlockedTeacher, pimpinanWilayah]);

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

  const handleDirectSaveJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedTeacher) return;
    if (!inJadwalKelas.trim() || !inMapel.trim()) {
      notify('Kelas/Halaqah dan Mata Pelajaran wajib diisi.', 'error');
      return;
    }
    setSavingJadwal(true);
    try {
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
            gender: inJadwalWilayah,
            kategori: inKategoriJadwal,
            allowOverride: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui jadwal.');
        setEditingJadwalId(null);
        setInMapel('');
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        notify(`Jadwal ${inHari} (${inJadwalKelas.toUpperCase()}) berhasil diperbarui.`, 'success');
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
            gender: inJadwalWilayah,
            kategori: inKategoriJadwal,
            allowOverride: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menambahkan jadwal.');
        setInMapel('');
        fetchRecap(unlockedTeacher.nama);
        onDataUpdated?.();
        notify(`Jadwal ${inHari} (${inJadwalKelas.toUpperCase()}) ditambahkan ke akun Anda.`, 'success');
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
    notify(`Mode Edit Jadwal aktif: ${item.hari} · ${item.kelas} (${item.mapel}).`, 'info');
  };

  const handleDeletePersonalJadwal = async (id: string) => {
    if (!unlockedTeacher) return;
    const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (editingJadwalId === id) {
        setEditingJadwalId(null);
        setInMapel('');
      }
      fetchRecap(unlockedTeacher.nama);
      onDataUpdated?.();
      notify('Jadwal berhasil dihapus.', 'info');
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
        notify(
          `Upload Excel Jadwal berhasil! (${data.added || 0} jadwal baru ditambahkan, ${data.updated || 0} jadwal lama diperbarui).`,
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
    const mySchedules = recap?.allMySchedules || [];
    return (
      <div className="rounded-xl border border-teal-200 bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-teal-50/90 via-emerald-50/50 to-white px-5 py-4 border-b border-slate-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Kelola Jadwal {roleContext === 'Al-Quran' ? "Halaqah Al-Qur'an & Mengajar" : 'Guru Akademik & Al-Qur’an'} ({mySchedules.length} Jadwal)
              </h3>
              <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
                Tambah Sistem · Edit Jadwal · Template Excel
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Anda bisa menambah jadwal baru lewat form sistem di bawah, klik <b>Edit</b> pada jadwal yang sudah ada, atau <b>Unduh &amp; Upload Template Excel Jadwal (.xlsx)</b>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleDownloadMyJadwalExcel('blank')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-teal-700" />
              Template Kosong (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleDownloadMyJadwalExcel('filled')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-teal-700" />
              Unduh &amp; Edit Jadwal Saya (.xlsx)
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1324] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="h-3.5 w-3.5 text-teal-300" />
              <span>{uploadingJadwalExcel ? 'Mengupload...' : 'Upload Excel Jadwal (.xlsx)'}</span>
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

        <div className="p-5 grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          {/* Form Tambah / Edit Jadwal */}
          <form
            onSubmit={handleDirectSaveJadwal}
            className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="text-xs font-bold text-slate-900">
                {editingJadwalId ? 'Mode Edit Jadwal Saya' : 'Tambah Jadwal Baru via Sistem'}
              </div>
              {editingJadwalId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingJadwalId(null);
                    setInMapel('');
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Batal Edit
                </button>
              )}
            </div>

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
                  {['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Pelajaran (JP)</label>
                <input
                  type="text"
                  value={inJam}
                  onChange={(e) => setInJam(e.target.value)}
                  placeholder="Contoh: 1-2 atau 5-6"
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                {inKategoriJadwal === 'Al-Quran' ? 'Kelompok Halaqah Al-Qur’an *' : 'Nama Kelas Akademik *'}
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
                {inKategoriJadwal === 'Al-Quran' ? 'Agenda Halaqah / Target Tahfidz *' : 'Mata Pelajaran *'}
              </label>
              <input
                type="text"
                value={inMapel}
                onChange={(e) => setInMapel(e.target.value)}
                placeholder={inKategoriJadwal === 'Al-Quran' ? "HALAQAH AL-QUR'AN" : 'BAHASA ARAB / FIQIH'}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={savingJadwal}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {savingJadwal
                ? 'Menyimpan...'
                : editingJadwalId
                ? 'Simpan Perubahan Jadwal'
                : `Tambah Jadwal ${inKategoriJadwal}`}
            </button>
          </form>

          {/* Tabel Daftar Jadwal Saya + Tombol Edit & Hapus */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                Daftar Jadwal Aktif ({unlockedTeacher?.nama})
              </span>
              <span className="text-[11px] text-slate-500">Klik Edit untuk mengubah jadwal yang sudah ada</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Hari &amp; JP</th>
                    <th className="px-3 py-2 font-semibold">Kelas / Halaqah</th>
                    <th className="px-3 py-2 font-semibold">Mapel / Kategori</th>
                    <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mySchedules.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Belum ada jadwal terdaftar. Tambahkan lewat form di samping atau upload Template Excel.
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
                          <div className="font-mono-num text-[11px] text-slate-500">JP {sch.jamKe}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{sch.kelas}</div>
                          <div className="text-[11px] text-slate-500">Wilayah {sch.gender}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{sch.mapel}</div>
                          <div className="text-[10px] font-semibold text-teal-700">
                            {sch.kategori || (sch.mapel.includes('QUR') ? 'Al-Quran' : 'Akademik')}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleStartEditPersonalJadwal(sch)}
                            className="mr-1.5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
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
    new Set<UserRole>([unlockedTeacher.peran, ...(unlockedTeacher.peranTambahan || [])]),
  );
  const isPimpinanOrAdmin =
    allMyRoles.includes('Pimpinan') ||
    allMyRoles.includes('Admin Super') ||
    allMyRoles.includes('Admin SIM');
  const hasRoleGuru =
    isPimpinanOrAdmin ||
    allMyRoles.includes('Guru') ||
    (recap?.allMySchedules?.length ?? 0) > 0 ||
    (recap?.sessions?.length ?? 0) > 0;
  const hasRoleWaliKelas =
    isPimpinanOrAdmin ||
    allMyRoles.includes('Wali Kelas') ||
    Boolean(unlockedTeacher.waliKelasOf);
  const hasRoleWaliAsrama =
    isPimpinanOrAdmin ||
    allMyRoles.includes('Wali Asrama') ||
    allMyRoles.includes('Musyrif') ||
    allMyRoles.includes('Musyrifah') ||
    (unlockedTeacher.kamarBinaan?.length ?? 0) > 0 ||
    (recap?.musyrifProgress?.totalKamar ?? 0) > 0;
  const hasRoleGuruWali =
    isPimpinanOrAdmin ||
    allMyRoles.includes('Guru Wali') ||
    (recap?.guruWaliProgress?.totalSantri ?? 0) > 0;
  const hasRoleQuran =
    isPimpinanOrAdmin ||
    allMyRoles.includes('Pengampu Al-Quran') ||
    (recap?.allMySchedules?.some(
      (s) => s.kategori === 'Al-Quran' || s.mapel.toUpperCase().includes('QUR'),
    ) ??
      false);
  const activeTokenStr = resolveTeacherToken(unlockedTeacher);

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <UserCheck className="h-5 w-5 text-teal-700" />
            <h2 className="text-lg font-semibold text-slate-900">{unlockedTeacher.nama}</h2>
            <span className="rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 font-mono-num text-xs font-bold text-amber-950">
              Token Login: {activeTokenStr}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Hak Akses Peran:</span>
            {allMyRoles.map((r) => (
              <span
                key={r}
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  r === 'Pimpinan'
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-teal-200 bg-teal-50 text-teal-900'
                }`}
              >
                {r}
              </span>
            ))}
            <span aria-hidden="true">·</span>
            <span>Wilayah {unlockedTeacher.genderScope}</span>
            {unlockedTeacher.waliKelasOf && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-teal-700">Wali Kelas {unlockedTeacher.waliKelasOf}</span>
              </>
            )}
            {unlockedTeacher.kamarBinaan && unlockedTeacher.kamarBinaan.length > 0 && (
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Input Presensi
          </button>
          <button
            type="button"
            onClick={onOpenWaliKelas}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Pembinaan &amp; Portofolio
          </button>
          <button
            type="button"
            onClick={() => setShowAllRoleTabs((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            title="Tampilkan atau sembunyikan tab peran di luar amanah utama Anda"
          >
            {showAllRoleTabs ? 'Sesuaikan Peran Saya' : 'Tampilkan Semua Tab'}
          </button>
          <button
            type="button"
            onClick={() => onUnlock(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </div>
      </div>

      {/* Role Progress Tabs — Automatically filtered by employee roles in Database Pegawai */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1.5 border border-slate-200/80 w-full">
        {(isPimpinanOrAdmin || showAllRoleTabs) && (
          <button
            type="button"
            onClick={() => setProgressTab('pimpinan')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap min-w-[160px] ${
              progressTab === 'pimpinan'
                ? 'bg-[#0B1324] text-amber-300 shadow-sm'
                : 'text-slate-700 hover:bg-white/80 hover:text-slate-950'
            }`}
          >
            <FileText className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'pimpinan' ? 'text-amber-300' : 'text-amber-600'}`} />
            <span className="truncate">Laporan Pimpinan (Semua PDF)</span>
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
            <span className="truncate">Guru Akademik</span>
          </button>
        )}
        {(hasRoleWaliKelas || showAllRoleTabs) && (
          <button
            type="button"
            onClick={() => setProgressTab('walikelas')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[130px] ${
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
              Wali Asrama ({recap?.musyrifProgress.totalKamar ?? 0})
            </span>
          </button>
        )}
        {(hasRoleGuruWali || showAllRoleTabs) && (
          <button
            type="button"
            onClick={() => setProgressTab('guruwali')}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[130px] ${
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
            <BookOpen className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'quran' ? 'text-white' : 'text-amber-600'}`} />
            <span className="truncate font-mono-num">
              Al-Qur&apos;an ({halaqahRows.length})
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setProgressTab('whatsapp')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[120px] ${
            progressTab === 'whatsapp'
              ? 'bg-green-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'whatsapp' ? 'text-white' : 'text-green-600'}`} />
          <span className="truncate font-mono-num">WhatsApp ({waLogs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setProgressTab('upload')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-[120px] ${
            progressTab === 'upload'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
          }`}
        >
          <Upload className={`h-3.5 w-3.5 shrink-0 ${progressTab === 'upload' ? 'text-white' : 'text-violet-600'}`} />
          <span className="truncate">Upload &amp; Input</span>
        </button>
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
          <div className="rounded-xl bg-gradient-to-r from-[#0B1324] via-[#102A43] to-teal-900 p-5 text-white space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-400/20 border border-amber-300/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Akses Khusus Peran Pimpinan · Semua Laporan Komponen Sekolah
                </div>
                <h3 className="mt-1.5 text-lg font-bold text-white">
                  Pusat Laporan Eksekutif Pimpinan &amp; Unduh PDF Seluruh Komponen
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Menampilkan hasil rekapitulasi terhubung dari seluruh 8 komponen SIM PINTAR (Asrama, Akademik &amp; Laju Materi, Halaqah Al-Qur&apos;an, Wali Kelas, Guru Wali, Wali Asrama/Room Visit, Labkom, serta Ujian &amp; Piket).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="inline-flex items-center rounded-lg bg-white/10 p-1 border border-white/15 text-xs">
                  {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPimpinanWilayah(w)}
                      className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                        pimpinanWilayah === w
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'text-slate-200 hover:bg-white/10'
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300 shadow-sm whitespace-nowrap shrink-0"
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
        <div className="space-y-6">
          {/* Summary Stats Guru Mengajar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Sesi Presensi Diisi</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{recap.totalSessions}</div>
              <div className="mt-1 text-xs text-slate-500">Rekam jejak dari input halaman depan</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Progres Mengajar Hari Ini</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
                {recap.todaySchedules.filter((s) => s.filled).length}/{recap.todaySchedules.length}
              </div>
              <div className="mt-1 text-xs text-slate-500 font-mono-num">{formatTanggalIndo(today)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Jadwal Mingguan</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{recap.allMySchedules.length}</div>
              <div className="mt-1 text-xs text-slate-500">Akademik &amp; Halaqah Al-Qur&apos;an</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Pengawasan Ujian</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{recap.examSessionsCount}</div>
              <div className="mt-1 text-xs text-slate-500">Sesi berita acara tercatat</div>
            </div>
          </div>

          {/* Today's Checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Target Mengajar Hari Ini ({formatTanggalIndo(today)})
            </h3>
            {recap.todaySchedules.length === 0 ? (
              <p className="text-xs text-slate-500">
                Tidak ada jadwal mengajar terjadwal pada hari ini. Anda dapat menambah atau menyesuaikan jadwal di menu <b>Jadwal &amp; Perubahan</b>.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recap.todaySchedules.map((sch) => (
                  <div
                    key={sch.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      sch.filled ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        {sch.kelas} · {sch.mapel}
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono-num">Jam ke-{sch.jamKe}</div>
                    </div>
                    {sch.filled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Sudah
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <Clock className="h-4 w-4" />
                        Belum
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* REKAP PEMBELAJARAN & RISET LAJU MATERI (KHUSUS PERAN GURU AKADEMIK) */}
          <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/40 via-white to-white overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-teal-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Rekap Pembelajaran &amp; Analisis Laju Materi per Kelas / Mata Pelajaran
                </h3>
                <p className="text-xs text-slate-500">
                  Setiap input presensi KBM &amp; topik materi otomatis terhubung menjadi peta ketercapaian silabus (target 16 pekan efektif/semester), rata-rata kehadiran kelas, dan log bab yang sudah diajarkan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const rows = (recap.learningPacing || []).map((lp) => [
                      `${lp.kelas} (${lp.gender})`,
                      lp.mapel,
                      lp.jadwalMingguan,
                      `${lp.totalPertemuan}/${lp.targetPertemuan} (${lp.lajuPct}%)`,
                      lp.statusLaju,
                      `${lp.rataKehadiranPct}%`,
                      lp.materiTerakhir,
                    ]);
                    downloadTableReportPdf({
                      title: `LAPORAN PEMBELAJARAN & LAJU MATERI GURU — ${recap.teacher.nama}`,
                      subtitle: `Total Jadwal: ${recap.allMySchedules.length} | Total Sesi Diisi: ${recap.totalSessions}`,
                      filename: `Laporan_Pembelajaran_Laju_Materi_${recap.teacher.nama.replace(/\s+/g, '_')}.pdf`,
                      orientation: 'landscape',
                      headers: ['Kelas & Wilayah', 'Mata Pelajaran', 'Jadwal', 'Pertemuan & Laju', 'Status', '% Hadir', 'Materi Terakhir'],
                      rows: rows.length > 0 ? rows : [['-', '-', '-', '0/16 (0%)', 'Belum Mulai', '100%', '-']],
                    });
                    notify('PDF Laporan Pembelajaran & Laju Materi berhasil diunduh.', 'success');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1324] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <FileText className="h-3.5 w-3.5 text-teal-300" />
                  Unduh PDF Laju Materi
                </button>
                <span className="inline-flex items-center rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shrink-0 font-mono-num">
                  {(recap.learningPacing || []).length} Kelas / Mapel Diampu
                </span>
              </div>
            </div>

            {(!recap.learningPacing || recap.learningPacing.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Belum ada jadwal atau sesi pembelajaran akademik tercatat. Saat Anda menginput presensi harian Akademik beserta topik materi, laju materi per kelas akan muncul otomatis di sini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Kelas &amp; Wilayah</th>
                      <th className="px-3 py-3 font-semibold">Mata Pelajaran</th>
                      <th className="px-3 py-3 font-semibold">Jadwal Mingguan</th>
                      <th className="px-3 py-3 font-semibold">Laju Pertemuan &amp; Silabus</th>
                      <th className="px-3 py-3 text-right font-semibold">Rata-rata Hadir</th>
                      <th className="px-4 py-3 font-semibold">Materi / Topik Terakhir &amp; Riwayat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recap.learningPacing.map((lp) => (
                      <tr key={`${lp.kelas}|${lp.mapel}`} className="hover:bg-slate-50 align-top">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{lp.kelas}</div>
                          <div className="text-[11px] text-slate-500">Wilayah {lp.gender}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-teal-800">{lp.mapel}</div>
                          <div className="text-[11px] text-slate-500 font-mono-num">
                            {lp.jumlahTopikUnik} topik materi tercatat
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600 font-mono-num text-[11px]">
                          {lp.jadwalMingguan}
                        </td>
                        <td className="px-3 py-3 min-w-[180px]">
                          <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                            <span className="font-mono-num text-slate-900">
                              {lp.totalPertemuan} / {lp.targetPertemuan} Pekan ({lp.lajuPct}%)
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                lp.statusLaju === 'Tuntas / On-Track'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : lp.statusLaju === 'Berjalan Stabil'
                                  ? 'bg-sky-100 text-sky-800'
                                  : lp.statusLaju === 'Perlu Akselerasi'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {lp.statusLaju}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                lp.lajuPct >= 75
                                  ? 'bg-emerald-600'
                                  : lp.lajuPct >= 35
                                  ? 'bg-sky-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.max(6, lp.lajuPct)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono-num">
                          <span
                            className={`font-bold ${
                              lp.rataKehadiranPct >= 90
                                ? 'text-emerald-700'
                                : lp.rataKehadiranPct >= 75
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {lp.rataKehadiranPct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          <div className="font-semibold text-slate-900">{lp.materiTerakhir}</div>
                          {lp.tanggalTerakhir !== '-' && (
                            <div className="text-[11px] text-slate-500 font-mono-num">
                              Pertemuan terakhir: {formatTanggalIndo(lp.tanggalTerakhir)}
                            </div>
                          )}
                          {lp.riwayatMateri.length > 1 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {lp.riwayatMateri.slice(0, 4).map((rm, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600"
                                >
                                  {rm.tanggal.slice(5)}: {rm.materi}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SISWA PERLU PERHATIAN AKADEMIK PADA MAPEL GURU INI */}
          {recap.studentAttentionAcademic && recap.studentAttentionAcademic.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-white overflow-hidden">
              <div className="border-b border-amber-100 bg-amber-50/50 px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pemantauan Siswa Perlu Perhatian pada Mata Pelajaran Saya
                  </h3>
                  <p className="text-xs text-slate-600">
                    Daftar siswa yang tercatat Alfa (A) atau berulang kali Sakit/Izin/Terlambat pada sesi KBM yang Anda ampu.
                  </p>
                </div>
                <span className="font-mono-num text-xs font-semibold text-amber-800">
                  {recap.studentAttentionAcademic.length} Siswa
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Nama Siswa</th>
                      <th className="px-3 py-2.5 font-semibold">Kelas</th>
                      <th className="px-3 py-2.5 font-semibold">Mata Pelajaran</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Hadir / Telat</th>
                      <th className="px-3 py-2.5 text-right font-semibold">S / I / A</th>
                      <th className="px-4 py-2.5 text-right font-semibold">% Kehadiran Mapel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recap.studentAttentionAcademic.map((sa) => (
                      <tr key={`${sa.nama}|${sa.kelas}`} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{sa.nama}</td>
                        <td className="px-3 py-2.5 text-slate-700">{sa.kelas}</td>
                        <td className="px-3 py-2.5 text-teal-800 font-medium">{sa.mapel}</td>
                        <td className="px-3 py-2.5 text-right font-mono-num">
                          {sa.H}H / {sa.T}T
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono-num font-semibold text-rose-700">
                          {sa.S}/{sa.I}/{sa.A}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono-num font-bold text-slate-900">
                          {sa.kehadiranPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kelola Jadwal Guru Akademik & Al-Qur'an (Sistem, Edit, atau Template Excel) */}
          {renderInlineScheduleWorkbench('Akademik')}

          {/* Personal Session History */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Riwayat Rekapan Mengajar &amp; Presensi</h3>
                <p className="text-xs text-slate-500">
                  Seluruh sesi yang diisi atas nama {recap.teacher.nama}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadTableReportPdf({
                      title: `LAPORAN RIWAYAT SESI MENGAJAR & PRESENSI — ${recap.teacher.nama}`,
                      subtitle: `Total Sesi: ${recap.sessions.length} | Tanggal Cetak: ${formatTanggalIndo(today)}`,
                      filename: `Laporan_Sesi_Mengajar_${recap.teacher.nama.replace(/\s+/g, '_')}.pdf`,
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
                    notify('PDF Laporan Riwayat Mengajar berhasil diunduh.', 'success');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Unduh PDF Riwayat Mengajar
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
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
                        <td className="px-4 py-3 font-mono-num whitespace-nowrap">
                          {formatTanggalIndo(s.tanggal)}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-700">{s.jenisPresensi}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{s.kelas}</td>
                        <td className="px-3 py-3 text-slate-700">{s.mapel}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{s.materi}</td>
                        <td className="px-3 py-3 text-right font-mono-num font-semibold text-emerald-700">
                          {s.hadir}/{s.totalSiswa}
                        </td>
                        <td className="px-4 py-3 text-right font-mono-num font-semibold text-rose-700">
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
      ) : progressTab === 'walikelas' ? (
        /* WALI KELAS PROGRESS TAB (TAMPIL PER KELAS & KEHADIRAN 3 KOMPONEN) */
        (() => {
          const allClassRows = recap.waliProgress.allClassesSantriProgress || recap.waliProgress.santriProgress;
          const activeWaliRows =
            selectedWaliKelasFilter === 'BINAAN_SAYA'
              ? recap.waliProgress.santriProgress
              : selectedWaliKelasFilter === 'SEMUA'
              ? allClassRows
              : allClassRows.filter((s) => s.kelas.toUpperCase() === selectedWaliKelasFilter.toUpperCase());

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

          return (
            <div className="space-y-6">
              {/* Filter Pilih Per Kelas */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Monitoring Wali Kelas Per Kelas · Kehadiran 3 Komponen &amp; Pembinaan (Klasikal Pekanan &amp; Khusus)
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Menampilkan keterhubungan data presensi Akademik, Asrama, dan Al-Qur&apos;an beserta pembinaan Momen Klasikal Pekanan dan Pembinaan Khusus Satu per Satu untuk setiap siswa di kelas.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-xs font-semibold text-slate-700">Pilih Kelas:</label>
                  <select
                    value={selectedWaliKelasFilter}
                    onChange={(e) => setSelectedWaliKelasFilter(e.target.value)}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Siswa di {activeClassLabel}</div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {activeWaliRows.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Terbina: {activeWaliRows.filter((s) => s.totalPembinaan > 0).length} siswa
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Kehadiran 3 Komponen Kelas</div>
                  <div className="mt-2 font-mono-num text-xl font-bold text-teal-700">
                    Akd {avgPct(activeWaliRows.map((s) => s.akademikPct))}% · Asr {avgPct(activeWaliRows.map((s) => s.asramaPct))}% · Qur {avgPct(activeWaliRows.map((s) => s.alquranPct))}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Rata-rata kehadiran Akademik, Asrama &amp; Al-Qur&apos;an
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Momen Klasikal &amp; Khusus</div>
                  <div className="mt-2 font-mono-num text-2xl font-bold text-violet-700">
                    {activeWaliRows.reduce((a, b) => a + (b.klasikalCount || 0), 0)} Klasikal ·{' '}
                    {activeWaliRows.reduce((a, b) => a + (b.khususCount || 0), 0)} Khusus
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Pekanan klasikal &amp; pendampingan satu per satu
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Rata-rata Ibadah Kelas</div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {avgPct(activeWaliRows.map((s) => s.wajibPct))}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Sholat Wajib 5 Waktu &amp; Sunnah
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Rekap Terpadu Siswa Per Kelas ({activeClassLabel} · Wilayah {recap.teacher.genderScope})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Menghubungkan data kehadiran Akademik, Asrama, Al-Qur&apos;an dengan Pembinaan Klasikal Pekanan &amp; Khusus Individu.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadTableReportPdf({
                          title: `LAPORAN WALI KELAS — ${activeClassLabel.toUpperCase()} (${recap.teacher.nama})`,
                          subtitle: `Total Siswa: ${activeWaliRows.length} | Kehadiran Akademik, Asrama, Al-Qur'an & Pembinaan Klasikal/Khusus`,
                          filename: `Laporan_Wali_Kelas_${activeClassLabel.replace(/\s+/g, '_')}.pdf`,
                          orientation: 'landscape',
                          headers: ['Nama Santri', 'Kelas & Kamar', 'Wali Asrama & GW', 'Akd %', 'Asr %', 'Qur %', 'S/I/A', 'Klasikal/Khusus', 'Wajib %', 'Net Poin', 'Status'],
                          rows:
                            activeWaliRows.length > 0
                              ? activeWaliRows.map((st) => [
                                  st.nama,
                                  `${st.kelas} (${st.kamar})`,
                                  `Asr: ${st.musyrif || '-'} | GW: ${st.guruWali || '-'}`,
                                  `${st.akademikPct ?? 100}%`,
                                  `${st.asramaPct ?? 100}%`,
                                  `${st.alquranPct ?? 100}%`,
                                  `${st.absenSakit}/${st.absenIzin}/${st.absenAlfa}`,
                                  `${st.klasikalCount ?? 0}K / ${st.khususCount ?? st.totalPembinaan}I`,
                                  `${st.wajibPct}%`,
                                  String(st.netPoin),
                                  st.statusTerakhir,
                                ])
                              : [['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
                        });
                        notify(`PDF Laporan Wali Kelas (${activeClassLabel}) berhasil diunduh.`, 'success');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Unduh PDF Laporan Wali Kelas
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
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Nama Santri</th>
                        <th className="px-3 py-3 font-semibold">Kelas &amp; Kamar</th>
                        <th className="px-3 py-3 font-semibold">Wali Asrama &amp; Guru Wali</th>
                        <th className="px-3 py-3 text-right font-semibold">Akademik</th>
                        <th className="px-3 py-3 text-right font-semibold">Asrama</th>
                        <th className="px-3 py-3 text-right font-semibold">Al-Qur&apos;an</th>
                        <th className="px-3 py-3 text-right font-semibold">S/I/A</th>
                        <th className="px-3 py-3 text-right font-semibold">Klasikal / Khusus</th>
                        <th className="px-3 py-3 text-right font-semibold">Wajib %</th>
                        <th className="px-3 py-3 text-right font-semibold">Net Poin</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeWaliRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                            Belum ada santri pada filter kelas ini ({activeClassLabel}). Pilih kelas di bagian kanan atas atau atur Kelas Binaan pada tab Upload &amp; Input.
                          </td>
                        </tr>
                      ) : (
                        activeWaliRows.map((st) => (
                          <tr key={st.nama} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-900">{st.nama}</td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-800">{st.kelas}</div>
                              <div className="text-[11px] text-slate-500">Kamar {st.kamar}</div>
                            </td>
                            <td className="px-3 py-3 text-[11px]">
                              <div className="text-slate-700">Asr: {st.musyrif || '-'}</div>
                              <div className="text-violet-700 font-medium">GW: {st.guruWali || '-'}</div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-sky-700">
                              {st.akademikPct ?? 100}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-emerald-700">
                              {st.asramaPct ?? 100}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-amber-700">
                              {st.alquranPct ?? 100}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num text-slate-700">
                              {st.absenSakit}/{st.absenIzin}/{st.absenAlfa}
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num">
                              <span className="font-semibold text-violet-700">{st.klasikalCount ?? 0}K</span> ·{' '}
                              <span className="font-semibold text-slate-800">{st.khususCount ?? st.totalPembinaan}I</span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-teal-700">
                              {st.wajibPct}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold">{st.netPoin}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-semibold ${
                                  st.statusTerakhir === 'Eskalasi'
                                    ? 'text-rose-700'
                                    : st.statusTerakhir === 'Proses'
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {st.statusTerakhir}
                              </span>
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
        /* DASBOR PENGAMPU AL-QUR'AN (HALAQAH, SETORAN ZIYADAH, TILAWAH & MURAJAAH) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Total Santri Halaqah</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">{halaqahRows.length}</div>
              <div className="mt-1 text-xs text-slate-500">Terdaftar pada kelompok Al-Qur&apos;an</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Rata-rata Kehadiran Mengaji</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
                {halaqahRows.length > 0
                  ? Math.round(halaqahRows.reduce((acc, r) => acc + r.persenHadir, 0) / halaqahRows.length)
                  : 100}
                %
              </div>
              <div className="mt-1 text-xs text-slate-500">Halaqah Pagi &amp; Petang</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Sudah Setor Ziyadah</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-emerald-700">
                {halaqahRows.filter((r) => r.lastSetoran && r.lastSetoran !== '-').length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Santri memiliki rekam setoran aktif</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="text-xs font-medium text-slate-500">Aktif Murajaah &amp; Tilawah</div>
              <div className="mt-2 font-mono-num text-3xl font-bold text-amber-700">
                {halaqahRows.filter((r) => (r.lastTilawah && r.lastTilawah !== '-') || (r.lastMurajaah && r.lastMurajaah !== '-')).length}
              </div>
              <div className="mt-1 text-xs text-slate-500">Evaluasi berkala pengampu</div>
            </div>
          </div>

          {/* Kelola Jadwal Pengampu Al-Qur'an & Halaqah (Sistem, Edit, atau Template Excel) */}
          {renderInlineScheduleWorkbench('Al-Quran')}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Monitoring Halaqah Al-Qur&apos;an: Target Ziyadah, Tilawah &amp; Murajaah
                </h3>
                <p className="text-xs text-slate-500">
                  Rekapitulasi kehadiran mengaji dan progres setoran hafalan santri per kelompok halaqah.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    downloadTableReportPdf({
                      title: `LAPORAN HALAQAH AL-QUR'AN & SETORAN ZIYADAH — ${unlockedTeacher.nama}`,
                      subtitle: `Total Santri Halaqah: ${halaqahRows.length} | Tanggal Cetak: ${formatTanggalIndo(today)}`,
                      filename: `Laporan_Halaqah_AlQuran_${unlockedTeacher.nama.replace(/\s+/g, '_')}.pdf`,
                      orientation: 'landscape',
                      headers: ['Nama Santri', 'Kelas', 'Kelompok Halaqah', 'Pengampu', 'Kehadiran', 'Setoran Ziyadah', 'Tilawah', 'Murajaah'],
                      rows:
                        halaqahRows.length > 0
                          ? halaqahRows.map((row) => [
                              row.nama,
                              row.kelas,
                              row.kelompokQuran,
                              row.pengampuQuran,
                              `${row.persenHadir}% (${row.totalHadir}H)`,
                              row.lastSetoran,
                              row.lastTilawah,
                              row.lastMurajaah,
                            ])
                          : [['-', '-', '-', '-', '-', 'Belum ada data halaqah', '-', '-']],
                    });
                    notify("PDF Laporan Halaqah Al-Qur'an berhasil diunduh.", 'success');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Unduh PDF Laporan Al-Qur&apos;an
                </button>
                <button
                  type="button"
                  onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Input Setoran &amp; Presensi Halaqah
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama Santri</th>
                    <th className="px-3 py-3 font-semibold">Kelas</th>
                    <th className="px-3 py-3 font-semibold">Kelompok Halaqah</th>
                    <th className="px-3 py-3 font-semibold">Pengampu</th>
                    <th className="px-3 py-3 text-right font-semibold">Kehadiran</th>
                    <th className="px-3 py-3 font-semibold">Setoran Ziyadah Terakhir</th>
                    <th className="px-3 py-3 font-semibold">Tilawah</th>
                    <th className="px-4 py-3 font-semibold">Murajaah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHalaqah ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Memuat progres halaqah...
                      </td>
                    </tr>
                  ) : halaqahRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Belum ada data santri halaqah.
                      </td>
                    </tr>
                  ) : (
                    halaqahRows.slice(0, 60).map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.nama}</td>
                        <td className="px-3 py-3 text-slate-600">{row.kelas}</td>
                        <td className="px-3 py-3 font-semibold text-amber-800">{row.kelompokQuran}</td>
                        <td className="px-3 py-3 text-slate-700">{row.pengampuQuran}</td>
                        <td className="px-3 py-3 text-right font-mono-num font-bold text-teal-700">
                          {row.persenHadir}% ({row.totalHadir}H)
                        </td>
                        <td className="px-3 py-3 font-medium text-emerald-800">{row.lastSetoran}</td>
                        <td className="px-3 py-3 text-slate-700">{row.lastTilawah}</td>
                        <td className="px-4 py-3 text-slate-700">{row.lastMurajaah}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
                className="flex-1 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
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
        /* WALI ASRAMA (MUSYRIF / MUSYRIFAH) PROGRESS TAB: PILIH PER KAMAR ATAU SEMUA KAMAR + KEHADIRAN 3 KOMPONEN */
        (() => {
          const allAsramaRows = recap.musyrifProgress.santriProgress;
          const filteredAsramaRows =
            selectedAsramaRoom === 'SEMUA'
              ? allAsramaRows
              : allAsramaRows.filter((s) => s.kamar.toUpperCase() === selectedAsramaRoom.toUpperCase());

          const avgPct = (vals: Array<number | undefined>) => {
            const valid = vals.filter((v): v is number => typeof v === 'number');
            return valid.length === 0 ? 100 : Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
          };

          const roomLabel =
            selectedAsramaRoom === 'SEMUA'
              ? `Semua Kamar Binaan (${recap.musyrifProgress.kamarList.length} Kamar)`
              : `Kamar ${selectedAsramaRoom}`;

          return (
            <div className="space-y-6">
              {/* Filter Pilih Per Kamar atau Semua Kamar */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Dasbor Wali Asrama · Data Kehadiran Seluruh Siswa di Setiap Komponen (Asrama · Al-Qur&apos;an · Akademik)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Pilih <b>Semua Kamar Binaan</b> atau filter <b>Per Kamar</b> yang Anda pegang untuk memantau kehadiran 3 komponen dan pembinaan kamar (Klasikal Pekanan &amp; Khusus Individu).
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenQuickPresensi(unlockedTeacher.nama)}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      Input Presensi Kamar
                    </button>
                    <button
                      type="button"
                      onClick={onOpenWaliKelas}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Input Klasikal / Khusus Kamar
                    </button>
                  </div>
                </div>

                {/* Pill Buttons: Semua Kamar vs Per Kamar */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedAsramaRoom('SEMUA')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      selectedAsramaRoom === 'SEMUA'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'border border-emerald-200 bg-white text-slate-700 hover:bg-emerald-50'
                    }`}
                  >
                    Semua Kamar ({allAsramaRows.length} Siswa)
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
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-emerald-50'
                        }`}
                      >
                        Kamar {km} ({countInRoom})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* KPI Cards for Selected Room / All Rooms */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Cakupan Kamar &amp; Siswa</div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {filteredAsramaRows.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {roomLabel} · Presensi Hari Ini: {recap.musyrifProgress.sudahPresensiHariIni}/{recap.musyrifProgress.totalKamar} kamar
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Kehadiran 3 Komponen Kamar</div>
                  <div className="mt-2 font-mono-num text-xl font-bold text-emerald-700">
                    Asr {avgPct(filteredAsramaRows.map((s) => s.asramaPct))}% · Qur {avgPct(filteredAsramaRows.map((s) => s.alquranPct))}% · Akd {avgPct(filteredAsramaRows.map((s) => s.akademikPct))}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Rata-rata kehadiran siswa di kamar terpilih
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Momen Klasikal &amp; Khusus Kamar</div>
                  <div className="mt-2 font-mono-num text-2xl font-bold text-violet-700">
                    {filteredAsramaRows.reduce((a, b) => a + (b.klasikalCount || 0), 0)} Klasikal ·{' '}
                    {filteredAsramaRows.reduce((a, b) => a + (b.khususCount || 0), 0)} Khusus
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Terbina: {filteredAsramaRows.filter((s) => s.totalPembinaan > 0).length}/{filteredAsramaRows.length} siswa
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Rata-rata Ibadah Kamar</div>
                  <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
                    {avgPct(filteredAsramaRows.map((s) => s.wajibPct))}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Wajib {avgPct(filteredAsramaRows.map((s) => s.wajibPct))}% · Sunnah {avgPct(filteredAsramaRows.map((s) => s.sunnahPct))}%
                  </div>
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
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Kamar {rs.kamar}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            rs.filledToday
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {rs.filledToday ? 'Presensi Hari Ini: Sudah' : 'Hari Ini: Belum'}
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
                        {rs.totalSantri} siswa · {rs.santriDibina} terbina · Sholat Wajib {rs.rataWajibPct}%
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Tabel Lengkap Kehadiran Seluruh Siswa di Setiap Komponen per Kamar */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Data Kehadiran Seluruh Siswa di Setiap Komponen &amp; Pembinaan ({roomLabel})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Menampilkan kehadiran Asrama, Halaqah Al-Qur&apos;an, dan KBM Akademik beserta Momen Klasikal Pekanan &amp; Pembinaan Khusus untuk setiap penghuni kamar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      downloadTableReportPdf({
                        title: `LAPORAN WALI ASRAMA (${roomLabel.toUpperCase()}) — ${unlockedTeacher.nama}`,
                        subtitle: `Total Siswa: ${filteredAsramaRows.length} | Kehadiran Asrama, Al-Qur'an, Akademik & Pembinaan Kamar`,
                        filename: `Laporan_Wali_Asrama_${selectedAsramaRoom.replace(/\s+/g, '_')}.pdf`,
                        orientation: 'landscape',
                        headers: ['Nama Santri', 'Kamar & Kelas', 'Hari Ini', 'Asrama %', 'Al-Quran %', 'Akademik %', 'S/I/A', 'Klasikal/Khusus', 'Wajib %', 'Sunnah %'],
                        rows:
                          filteredAsramaRows.length > 0
                            ? filteredAsramaRows.map((st) => [
                                st.nama,
                                `${st.kamar} (${st.kelas})`,
                                st.statusAsramaHariIni,
                                `${st.asramaPct ?? 100}%`,
                                `${st.alquranPct ?? 100}%`,
                                `${st.akademikPct ?? 100}%`,
                                `${st.absenSakit ?? 0}/${st.absenIzin ?? 0}/${st.absenAlfa ?? 0}`,
                                `${st.klasikalCount ?? 0}K / ${st.khususCount ?? st.totalPembinaan}I`,
                                `${st.wajibPct}%`,
                                `${st.sunnahPct}%`,
                              ])
                            : [['-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
                      });
                      notify(`PDF Laporan Wali Asrama (${roomLabel}) berhasil diunduh.`, 'success');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shrink-0"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Unduh PDF Laporan Wali Asrama
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Nama Santri</th>
                        <th className="px-3 py-3 font-semibold">Kamar &amp; Kelas</th>
                        <th className="px-3 py-3 font-semibold">Asrama Hari Ini</th>
                        <th className="px-3 py-3 text-right font-semibold">Hadir Asrama</th>
                        <th className="px-3 py-3 text-right font-semibold">Hadir Al-Qur&apos;an</th>
                        <th className="px-3 py-3 text-right font-semibold">Hadir Akademik</th>
                        <th className="px-3 py-3 text-right font-semibold">Total S/I/A</th>
                        <th className="px-3 py-3 text-right font-semibold">Klasikal / Khusus</th>
                        <th className="px-3 py-3 text-right font-semibold">Wajib %</th>
                        <th className="px-4 py-3 text-right font-semibold">Sunnah %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAsramaRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                            Belum ada santri kamar binaan yang tercatat pada filter ini ({roomLabel}).
                          </td>
                        </tr>
                      ) : (
                        filteredAsramaRows.map((st) => (
                          <tr key={st.nama} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">{st.nama}</div>
                              {st.lastSetoran && st.lastSetoran !== '-' && (
                                <div className="text-[10px] text-amber-800 truncate max-w-[180px]">
                                  Setoran: {st.lastSetoran}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-emerald-800">{st.kamar}</div>
                              <div className="text-[11px] text-slate-500">{st.kelas}</div>
                            </td>
                            <td className="px-3 py-3 font-mono-num font-semibold">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] ${
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
                            <td className="px-3 py-3 text-right font-mono-num">
                              <div className="font-bold text-emerald-700">{st.asramaPct ?? 100}%</div>
                              <div className="text-[10px] text-slate-500">
                                {st.asramaH ?? 0}H / {st.asramaSIA ?? 0}A
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num">
                              <div className="font-bold text-amber-700">{st.alquranPct ?? 100}%</div>
                              <div className="text-[10px] text-slate-500">
                                {st.alquranH ?? 0}H / {st.alquranSIA ?? 0}A
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num">
                              <div className="font-bold text-sky-700">{st.akademikPct ?? 100}%</div>
                              <div className="text-[10px] text-slate-500">
                                {st.akademikH ?? 0}H / {st.akademikSIA ?? 0}A
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num text-slate-700">
                              {st.absenSakit ?? 0}/{st.absenIzin ?? 0}/{st.absenAlfa ?? 0}
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num">
                              <span className="font-semibold text-violet-700">{st.klasikalCount ?? 0}K</span> ·{' '}
                              <span className="font-semibold text-slate-800">{st.khususCount ?? st.totalPembinaan}I</span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono-num font-semibold text-teal-700">
                              {st.wajibPct}%
                            </td>
                            <td className="px-4 py-3 text-right font-mono-num text-sky-700">{st.sunnahPct}%</td>
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
      )}
    </div>
  );
};
