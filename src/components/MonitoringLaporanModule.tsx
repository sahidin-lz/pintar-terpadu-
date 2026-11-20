import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  UserX,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  Users,
  BookOpen,
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
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
  AnalyticsTerpadu,
  DashboardStats,
  Gender,
  MonitoringCell,
  MonitoringData,
  MonthlyWaliKelasReport,
  ReportOptions,
  WilayahFilter,
} from '../types';
import {
  downloadAnalyticsDashboardPdf,
  downloadCsv,
  downloadTableReportPdf,
  downloadWaliKelasMonthlyPdf,
  formatTanggalIndo,
  getNamaHariFromDate,
  getTodayDateStr,
  NAMA_BULAN_INDO,
  printHtmlDocument,
  shiftDateStr,
} from '../utils/exportHelpers';
import { getAcademicSemester } from '../utils/semesterHelpers';
import {
  ensureServerHydratedFromMirror,
  loadSubTab,
  saveSubTab,
} from '../utils/sessionPersistence';

interface Props {
  options: ReportOptions | null;
  stats?: DashboardStats | null;
  initialStats?: DashboardStats | null;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type ClassSortKey =
  | 'kelas'
  | 'gender'
  | 'waliKelas'
  | 'totalSantri'
  | 'persenHadir'
  | 'cakupanPembinaanPct'
  | 'wajibPct'
  | 'netPoin';

type StudentSortKey =
  | 'nama'
  | 'kelas'
  | 'ht'
  | 'sia'
  | 'persenHadir'
  | 'totalCatatan'
  | 'wajibPct'
  | 'sunnahPct'
  | 'netPoin';

export const MonitoringLaporanModule: React.FC<Props> = ({
  options,
  stats: propStats,
  initialStats,
  notify,
}) => {
  const [subTab, setSubTab] = useState<'monitoring' | 'statistik' | 'download'>(() =>
    loadSubTab('pintar_monitoring_subtab_v1', ['monitoring', 'statistik', 'download'] as const, 'monitoring'),
  );

  // Monitoring state
  const [tglMonitoring, setTglMonitoring] = useState(getTodayDateStr());
  const [monGender, setMonGender] = useState<'putri' | 'putra'>(() =>
    loadSubTab('pintar_monitoring_gender_v1', ['putri', 'putra'] as const, 'putra'),
  );
  const [monDiv, setMonDiv] = useState<'akademik' | 'alquran' | 'asrama'>(() =>
    loadSubTab('pintar_monitoring_div_v1', ['akademik', 'alquran', 'asrama'] as const, 'akademik'),
  );
  const [monStatusFilter, setMonStatusFilter] = useState<'ALL' | 'HADIR' | 'BELUM' | 'GURU_ABSEN'>('ALL');
  const [monSearch, setMonSearch] = useState('');

  useEffect(() => {
    saveSubTab('pintar_monitoring_subtab_v1', subTab);
  }, [subTab]);

  useEffect(() => {
    saveSubTab('pintar_monitoring_gender_v1', monGender);
  }, [monGender]);

  useEffect(() => {
    saveSubTab('pintar_monitoring_div_v1', monDiv);
  }, [monDiv]);
  const [monData, setMonData] = useState<MonitoringData | null>(null);
  const [loadingMon, setLoadingMon] = useState(false);

  // Statistik & Analisis Terpadu + Ringkasan Bulanan Wali Kelas state
  const [statsWilayah, setStatsWilayah] = useState<WilayahFilter>('Semua');
  const [statsBulan, setStatsBulan] = useState<string>('SEMUA');
  const [statsKelas, setStatsKelas] = useState<string>('SEMUA');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentQuickFilter, setStudentQuickFilter] = useState<'all' | 'attention' | 'unmentored'>('all');

  // Interactive Chart & Table states
  const [divisiChartMode, setDivisiChartMode] = useState<'persen' | 'volume'>('persen');
  const [rightChartMode, setRightChartMode] = useState<'pembinaan' | 'komposisi'>('pembinaan');
  const [classChartMetric, setClassChartMetric] = useState<'kehadiran' | 'santri' | 'ibadah'>('kehadiran');
  const [classSearch, setClassSearch] = useState<string>('');
  const [classSort, setClassSort] = useState<{ key: ClassSortKey; dir: 'asc' | 'desc' }>({
    key: 'kelas',
    dir: 'asc',
  });
  const [studentSort, setStudentSort] = useState<{ key: StudentSortKey; dir: 'asc' | 'desc' }>({
    key: 'nama',
    dir: 'asc',
  });
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(propStats ?? initialStats ?? null);
  const [analisis, setAnalisis] = useState<AnalyticsTerpadu | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyWaliKelasReport | null>(null);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [tglAnalisis, setTglAnalisis] = useState(getTodayDateStr());

  // Report Download state (Tab 3)
  const [repWilayah, setRepWilayah] = useState<WilayahFilter>('Semua');
  const [repJenis, setRepJenis] = useState('ringkasan_bulanan_wali');
  const [repDivisi, setRepDivisi] = useState('Akademik');
  const [repParam1, setRepParam1] = useState('SEMUA');
  const [repParam2, setRepParam2] = useState('SEMUA MAPEL');
  const [repSemester, setRepSemester] = useState(() =>
    getAcademicSemester().semester === 'Ganjil' ? 'Ganjil (Jul-Des)' : 'Genap (Jan-Jun)',
  );
  const [individuStudents, setIndividuStudents] = useState<string[]>([]);
  const [reportResult, setReportResult] = useState<{
    laporan: string[][];
    materi: Array<{ no: number; tanggal: string; mapel: string; materi: string }>;
  } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportFilterMinimized, setReportFilterMinimized] = useState(false);

  const scopedOptions = useMemo(() => {
    if (!options) return null;
    if (repWilayah === 'Putra' && options.byWilayah?.Putra) return options.byWilayah.Putra;
    if (repWilayah === 'Putri' && options.byWilayah?.Putri) return options.byWilayah.Putri;
    return options;
  }, [options, repWilayah]);

  const statsScopedClasses = useMemo(() => {
    if (!options) return [];
    if (statsWilayah === 'Putra' && options.byWilayah?.Putra) return options.byWilayah.Putra.akademik.kelas;
    if (statsWilayah === 'Putri' && options.byWilayah?.Putri) return options.byWilayah.Putri.akademik.kelas;
    return options.akademik.kelas;
  }, [options, statsWilayah]);

  const fetchMonitoring = async (tgl: string) => {
    setLoadingMon(true);
    try {
      let res = await fetch(`/api/monitoring?tanggal=${encodeURIComponent(tgl)}`);
      let data = await res.json();
      if (
        (!data?.putra?.asrama || data.putra.asrama.length === 0) &&
        (!data?.putri?.asrama || data.putri.asrama.length === 0)
      ) {
        const restored = await ensureServerHydratedFromMirror();
        if (restored) {
          res = await fetch(`/api/monitoring?tanggal=${encodeURIComponent(tgl)}`);
          data = await res.json();
        }
      }
      setMonData(data);
    } catch {
      notify('Gagal memuat matriks monitoring.', 'error');
    } finally {
      setLoadingMon(false);
    }
  };

  const fetchAnalisis = async (tgl: string, wilayah: WilayahFilter) => {
    setLoadingAnalisis(true);
    try {
      let [resAn, resSt] = await Promise.all([
        fetch(`/api/analisis?tanggal=${encodeURIComponent(tgl)}`),
        fetch(`/api/stats?wilayah=${encodeURIComponent(wilayah)}`),
      ]);
      let dataAn = await resAn.json();
      let dataSt = await resSt.json();
      const totalSantriAn =
        (dataAn?.pembinaanAnalisis?.Putra?.totalSantri || 0) +
        (dataAn?.pembinaanAnalisis?.Putri?.totalSantri || 0);
      const totalKbmAn =
        (dataAn?.monitoringRingkasan?.Putra?.totalJadwalKbm || 0) +
        (dataAn?.monitoringRingkasan?.Putri?.totalJadwalKbm || 0);
      if (totalSantriAn === 0 && totalKbmAn === 0) {
        const restored = await ensureServerHydratedFromMirror();
        if (restored) {
          [resAn, resSt] = await Promise.all([
            fetch(`/api/analisis?tanggal=${encodeURIComponent(tgl)}`),
            fetch(`/api/stats?wilayah=${encodeURIComponent(wilayah)}`),
          ]);
          dataAn = await resAn.json();
          dataSt = await resSt.json();
        }
      }
      setAnalisis(dataAn);
      setStats(dataSt);
    } catch {
      notify('Gagal memuat hasil analisis terpadu.', 'error');
    } finally {
      setLoadingAnalisis(false);
    }
  };

  const fetchMonthlySummary = async (bulan: string, wilayah: WilayahFilter, kelas: string) => {
    setLoadingMonthly(true);
    try {
      const qs = new URLSearchParams({
        bulan,
        wilayah,
        kelas,
      });
      let res = await fetch(`/api/laporan/ringkasan-bulanan?${qs.toString()}`);
      let data = await res.json();
      if (
        (data?.meta?.totalSantri || 0) === 0 &&
        (data?.presensiSummary?.totalSesi || 0) === 0 &&
        (!data?.classComparison || data.classComparison.length === 0)
      ) {
        const restored = await ensureServerHydratedFromMirror();
        if (restored) {
          res = await fetch(`/api/laporan/ringkasan-bulanan?${qs.toString()}`);
          data = await res.json();
        }
      }
      setMonthlyReport(data);
    } catch {
      notify('Gagal memuat ringkasan bulanan wali kelas.', 'error');
    } finally {
      setLoadingMonthly(false);
    }
  };

  useEffect(() => {
    fetchMonitoring(tglMonitoring);
  }, [tglMonitoring]);

  useEffect(() => {
    fetchAnalisis(tglAnalisis, statsWilayah);
  }, [tglAnalisis, statsWilayah]);

  useEffect(() => {
    fetchMonthlySummary(statsBulan, statsWilayah, statsKelas);
  }, [statsBulan, statsWilayah, statsKelas]);

  useEffect(() => {
    const onSync = () => {
      fetchMonitoring(tglMonitoring);
      fetchAnalisis(tglAnalisis, statsWilayah);
      fetchMonthlySummary(statsBulan, statsWilayah, statsKelas);
    };
    window.addEventListener('pintar:data-restored', onSync);
    window.addEventListener('pintar:data-mutated', onSync);
    return () => {
      window.removeEventListener('pintar:data-restored', onSync);
      window.removeEventListener('pintar:data-mutated', onSync);
    };
  }, [tglMonitoring, tglAnalisis, statsWilayah, statsBulan, statsKelas]);

  // Reset statsKelas if not in statsScopedClasses
  useEffect(() => {
    if (statsKelas !== 'SEMUA' && statsScopedClasses.length > 0 && !statsScopedClasses.includes(statsKelas)) {
      setStatsKelas('SEMUA');
    }
  }, [statsWilayah, statsScopedClasses, statsKelas]);

  // Update param1 options when division, jenis, or wilayah changes in Tab 3
  useEffect(() => {
    if (!scopedOptions) return;
    if (repJenis === 'ringkasan_bulanan_wali') {
      setRepParam1('SEMUA');
    } else if (repJenis === 'blacklist' && (repDivisi === 'Akademik' || repDivisi === 'Terpadu')) {
      setRepParam1('KELAS 10');
    } else if (repJenis === 'susulan_ujian') {
      setRepParam1('SEMUA');
    } else if (repJenis === 'rekap_musyrif') {
      setRepDivisi('Asrama');
      setRepParam1(scopedOptions.asrama.musyrif[0] || '');
    } else if (repDivisi === 'Asrama') {
      setRepParam1(scopedOptions.asrama.kamar[0] || '');
    } else if (repDivisi === 'Al-Quran') {
      setRepParam1(scopedOptions.alquran.kelompok[0] || '');
    } else {
      setRepParam1(scopedOptions.akademik.kelas[0] || '');
    }
  }, [repJenis, repDivisi, scopedOptions]);

  useEffect(() => {
    if (repJenis === 'individu' && repParam1) {
      fetch(
        `/api/laporan/siswa-by-group?group=${encodeURIComponent(repParam1)}&divisi=${encodeURIComponent(repDivisi)}&wilayah=${encodeURIComponent(repWilayah)}`
      )
        .then((r) => r.json())
        .then((list: string[]) => {
          setIndividuStudents(list);
          setRepParam2(list[0] || '');
        })
        .catch(() => setIndividuStudents([]));
    }
  }, [repJenis, repParam1, repDivisi, repWilayah]);

  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const targetP1 = repJenis === 'individu' ? repParam2 : repParam1;
      const qs = new URLSearchParams({
        jenis: repJenis,
        param1: targetP1,
        param2: repParam2,
        semester: repSemester,
        divisi: repDivisi,
        wilayah: repWilayah,
      });
      const res = await fetch(`/api/laporan?${qs.toString()}`);
      const data = await res.json();
      setReportResult(data);
    } catch {
      notify('Gagal memuat laporan.', 'error');
    } finally {
      setLoadingReport(false);
    }
  };

  // Live Monitoring metrics per division (respecting statsWilayah) to enrich charts
  const liveDivisionMetrics = useMemo(() => {
    if (!monData) {
      return {
        Akademik: { diisi: 0, total: 0, pct: 0 },
        AlQuran: { diisi: 0, total: 0, pct: 0 },
        Asrama: { diisi: 0, total: 0, pct: 0 },
      };
    }
    const sides =
      statsWilayah === 'Putra'
        ? [monData.putra]
        : statsWilayah === 'Putri'
        ? [monData.putri]
        : [monData.putra, monData.putri];

    let akDiisi = 0;
    let akTotal = 0;
    let qDiisi = 0;
    let qTotal = 0;
    let asrDiisi = 0;
    let asrTotal = 0;

    sides.forEach((s) => {
      if (!s) return;
      const ak = [...s.akademik.kelas10, ...s.akademik.kelas11, ...s.akademik.kelas12];
      const q = [...s.alquran.kelas10, ...s.alquran.kelas11, ...s.alquran.kelas12];
      const asr = s.asrama || [];
      akTotal += ak.length;
      akDiisi += ak.filter((c) => c.status === 'HADIR').length;
      qTotal += q.length;
      qDiisi += q.filter((c) => c.status === 'HADIR').length;
      asrTotal += asr.length;
      asrDiisi += asr.filter((r) => r.status === 'HADIR').length;
    });

    return {
      Akademik: {
        diisi: akDiisi,
        total: akTotal,
        pct: akTotal > 0 ? Math.round((akDiisi / akTotal) * 100) : 0,
      },
      AlQuran: {
        diisi: qDiisi,
        total: qTotal,
        pct: qTotal > 0 ? Math.round((qDiisi / qTotal) * 100) : 0,
      },
      Asrama: {
        diisi: asrDiisi,
        total: asrTotal,
        pct: asrTotal > 0 ? Math.round((asrDiisi / asrTotal) * 100) : 0,
      },
    };
  }, [monData, statsWilayah]);

  // Chart data for Left Panel: Kehadiran & Keterisian per Divisi
  const divisiChartData = useMemo(() => {
    if (!monthlyReport) return [];
    const byDiv = monthlyReport.presensiSummary.byDivisi;
    return [
      {
        name: 'Akademik',
        fullLabel: 'Akademik (KBM Kelas)',
        persenHadir: byDiv.Akademik.persenHadir,
        keterisianPct: liveDivisionMetrics.Akademik.pct,
        hadirLog: byDiv.Akademik.H + byDiv.Akademik.T,
        absenLog: byDiv.Akademik.S + byDiv.Akademik.I + byDiv.Akademik.A,
        totalLog: byDiv.Akademik.total,
        jadwalAktif: liveDivisionMetrics.Akademik.total,
        jadwalTerisi: liveDivisionMetrics.Akademik.diisi,
        S: byDiv.Akademik.S,
        I: byDiv.Akademik.I,
        A: byDiv.Akademik.A,
        color: '#0d9488',
      },
      {
        name: "Al-Qur'an",
        fullLabel: "Al-Qur'an / Halaqah",
        persenHadir: byDiv.AlQuran.persenHadir,
        keterisianPct: liveDivisionMetrics.AlQuran.pct,
        hadirLog: byDiv.AlQuran.H + byDiv.AlQuran.T,
        absenLog: byDiv.AlQuran.S + byDiv.AlQuran.I + byDiv.AlQuran.A,
        totalLog: byDiv.AlQuran.total,
        jadwalAktif: liveDivisionMetrics.AlQuran.total,
        jadwalTerisi: liveDivisionMetrics.AlQuran.diisi,
        S: byDiv.AlQuran.S,
        I: byDiv.AlQuran.I,
        A: byDiv.AlQuran.A,
        color: '#4f46e5',
      },
      {
        name: 'Asrama',
        fullLabel: 'Asrama / Kesantrian',
        persenHadir: byDiv.Asrama.persenHadir,
        keterisianPct: liveDivisionMetrics.Asrama.pct,
        hadirLog: byDiv.Asrama.H + byDiv.Asrama.T,
        absenLog: byDiv.Asrama.S + byDiv.Asrama.I + byDiv.Asrama.A,
        totalLog: byDiv.Asrama.total,
        jadwalAktif: liveDivisionMetrics.Asrama.total,
        jadwalTerisi: liveDivisionMetrics.Asrama.diisi,
        S: byDiv.Asrama.S,
        I: byDiv.Asrama.I,
        A: byDiv.Asrama.A,
        color: '#10b981',
      },
      {
        name: 'Ujian',
        fullLabel: 'Ujian Sekolah',
        persenHadir: byDiv.Ujian.persenHadir,
        keterisianPct: byDiv.Ujian.persenHadir,
        hadirLog: byDiv.Ujian.H + byDiv.Ujian.T,
        absenLog: byDiv.Ujian.S + byDiv.Ujian.I + byDiv.Ujian.A,
        totalLog: byDiv.Ujian.total,
        jadwalAktif: byDiv.Ujian.total > 0 ? Math.ceil(byDiv.Ujian.total / 20) : 12,
        jadwalTerisi: byDiv.Ujian.total > 0 ? Math.ceil((byDiv.Ujian.H + byDiv.Ujian.T) / 20) : 0,
        S: byDiv.Ujian.S,
        I: byDiv.Ujian.I,
        A: byDiv.Ujian.A,
        color: '#f59e0b',
      },
    ];
  }, [monthlyReport, liveDivisionMetrics]);

  // Chart data for Right Panel: Distribusi Pembinaan OR Komposisi Kelas/Wilayah
  const rightDistributionData = useMemo(() => {
    if (!monthlyReport) return { mode: 'komposisi' as const, items: [], total: 0 };
    const totalCat = monthlyReport.pembinaanSummary.totalCatatan;
    const COLORS = ['#0d9488', '#4f46e5', '#f43f5e', '#10b981', '#f59e0b', '#0284c7'];

    if (rightChartMode === 'pembinaan' && totalCat > 0) {
      const items = monthlyReport.pembinaanSummary.kategoriCounts.map((k, idx) => ({
        name: k.kategori,
        value: k.count,
        pct: Math.round((k.count / Math.max(1, totalCat)) * 100),
        color: COLORS[idx % COLORS.length],
        unit: 'catatan',
      }));
      return { mode: 'pembinaan' as const, items, total: totalCat };
    }

    // Build colorful composition breakdown across Tingkat & Wilayah from classComparison or statsScopedClasses
    const groups = new Map<string, number>();
    const classes = monthlyReport.classComparison || [];
    if (classes.length > 0) {
      classes.forEach((c) => {
        const tingkat = c.kelas.startsWith('10')
          ? 'Kelas 10'
          : c.kelas.startsWith('11')
          ? 'Kelas 11'
          : c.kelas.startsWith('12')
          ? 'Kelas 12'
          : 'Kelas Lain';
        const key = `${tingkat} ${c.gender}`;
        const val = c.totalSantri > 0 ? c.totalSantri : 1;
        groups.set(key, (groups.get(key) || 0) + val);
      });
    } else {
      statsScopedClasses.forEach((kls) => {
        const tingkat = kls.startsWith('10')
          ? 'Kelas 10'
          : kls.startsWith('11')
          ? 'Kelas 11'
          : kls.startsWith('12')
          ? 'Kelas 12'
          : 'Kelas';
        groups.set(tingkat, (groups.get(tingkat) || 0) + 1);
      });
    }

    const totalVal = Array.from(groups.values()).reduce((a, b) => a + b, 0) || 1;
    const unitLabel = classes.some((c) => c.totalSantri > 0) ? 'santri' : 'kelas';
    const items = Array.from(groups.entries()).map(([name, value], idx) => ({
      name,
      value,
      pct: Math.round((value / totalVal) * 100),
      color: COLORS[idx % COLORS.length],
      unit: unitLabel,
    }));

    return { mode: 'komposisi' as const, items, total: totalVal };
  }, [monthlyReport, rightChartMode, statsScopedClasses]);

  // Sorted & filtered classComparison for Section 3
  const sortedClassComparison = useMemo(() => {
    if (!monthlyReport) return [];
    let list = [...monthlyReport.classComparison];
    if (classSearch.trim()) {
      const q = classSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.kelas.toLowerCase().includes(q) ||
          c.waliKelas.toLowerCase().includes(q) ||
          c.gender.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const dir = classSort.dir === 'asc' ? 1 : -1;
      switch (classSort.key) {
        case 'kelas':
          return a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) * dir;
        case 'gender':
          return a.gender.localeCompare(b.gender) * dir;
        case 'waliKelas':
          return a.waliKelas.localeCompare(b.waliKelas) * dir;
        case 'totalSantri':
          return (a.totalSantri - b.totalSantri) * dir;
        case 'persenHadir':
          return (a.persenHadir - b.persenHadir) * dir;
        case 'cakupanPembinaanPct':
          return (a.cakupanPembinaanPct - b.cakupanPembinaanPct) * dir;
        case 'wajibPct':
          return (a.wajibPct - b.wajibPct) * dir;
        case 'netPoin':
          return (a.netPoin - b.netPoin) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [monthlyReport, classSearch, classSort]);

  // Filtered & sorted student rows in Tab 2
  const filteredStudentRows = useMemo(() => {
    if (!monthlyReport) return [];
    let list = [...monthlyReport.studentRows];
    if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.nama.toLowerCase().includes(q) ||
          r.nis.toLowerCase().includes(q) ||
          r.kelas.toLowerCase().includes(q) ||
          r.kamar.toLowerCase().includes(q) ||
          r.waliKelas.toLowerCase().includes(q)
      );
    }
    if (studentQuickFilter === 'attention') {
      list = list.filter(
        (r) =>
          r.presensi.A > 0 ||
          r.pembinaan.netPoin < 0 ||
          r.pembinaan.totalPelanggaran > 0 ||
          (r.pembinaan.statusTerakhir !== '-' && r.pembinaan.statusTerakhir !== 'Selesai')
      );
    } else if (studentQuickFilter === 'unmentored') {
      list = list.filter((r) => r.pembinaan.totalCatatan === 0);
    }
    list.sort((a, b) => {
      const dir = studentSort.dir === 'asc' ? 1 : -1;
      switch (studentSort.key) {
        case 'nama':
          return a.nama.localeCompare(b.nama, 'id') * dir;
        case 'kelas':
          return a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) * dir;
        case 'ht':
          return (a.presensi.H + a.presensi.T - (b.presensi.H + b.presensi.T)) * dir;
        case 'sia':
          return (
            a.presensi.S + a.presensi.I + a.presensi.A - (b.presensi.S + b.presensi.I + b.presensi.A)
          ) * dir;
        case 'persenHadir':
          return (a.presensi.persenHadir - b.presensi.persenHadir) * dir;
        case 'totalCatatan':
          return (a.pembinaan.totalCatatan - b.pembinaan.totalCatatan) * dir;
        case 'wajibPct':
          return (a.pembinaan.wajibPct - b.pembinaan.wajibPct) * dir;
        case 'sunnahPct':
          return (a.pembinaan.sunnahPct - b.pembinaan.sunnahPct) * dir;
        case 'netPoin':
          return (a.pembinaan.netPoin - b.pembinaan.netPoin) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [monthlyReport, studentSearch, studentQuickFilter, studentSort]);

  const toggleClassSort = (key: ClassSortKey) => {
    setClassSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    );
  };

  const toggleStudentSort = (key: StudentSortKey) => {
    setStudentSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    );
  };

  const renderSortIcon = (active: boolean, dir: 'asc' | 'desc') => {
    if (!active) return <ArrowUpDown className="h-3 w-3 text-slate-400 inline ml-1" />;
    return dir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-indigo-600 inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-indigo-600 inline ml-1" />
    );
  };

  // Direct PDF Download for Wali Kelas Monthly Summary
  const handleDownloadMonthlyWaliPdf = async (overrideKelas?: string) => {
    try {
      if (overrideKelas && overrideKelas !== statsKelas) {
        const qs = new URLSearchParams({
          bulan: statsBulan,
          wilayah: statsWilayah,
          kelas: overrideKelas,
        });
        const res = await fetch(`/api/laporan/ringkasan-bulanan?${qs.toString()}`);
        const data: MonthlyWaliKelasReport = await res.json();
        downloadWaliKelasMonthlyPdf(data);
        notify(`PDF Ringkasan Bulanan Kelas ${overrideKelas} berhasil diunduh.`);
        return;
      }
      if (!monthlyReport) {
        notify('Data ringkasan bulanan sedang dimuat.', 'error');
        return;
      }
      downloadWaliKelasMonthlyPdf(monthlyReport);
      notify(`PDF Ringkasan Bulanan (${monthlyReport.meta.kelas}) berhasil diunduh.`);
    } catch {
      notify('Gagal mengunduh PDF Ringkasan Bulanan.', 'error');
    }
  };

  // Direct PDF Download for Dasbor Analisis Data
  const handleDownloadAnalyticsPdf = () => {
    if (!analisis) {
      notify('Data analisis sedang dimuat.', 'error');
      return;
    }
    downloadAnalyticsDashboardPdf(analisis, monthlyReport, statsWilayah);
    notify('PDF Dasbor Analisis Data berhasil diunduh.');
  };

  // Direct CSV Download for Wali Kelas Monthly Summary in Tab 2
  const handleDownloadMonthlyCsv = () => {
    if (!monthlyReport) return;
    const rows: string[][] = [
      [
        'No',
        'NIS',
        'Nama Santri',
        'Wilayah',
        'Kelas',
        'Kamar',
        'Wali Kelas',
        'Musyrif/ah',
        'Hadir',
        'Telat',
        'Sakit',
        'Izin',
        'Alfa',
        '% Kehadiran',
        'Jml Pembinaan',
        'Sholat Wajib %',
        'Sunnah %',
        'Net Poin',
        'Status Tindak Lanjut',
        'Catatan Terakhir',
      ],
      ...filteredStudentRows.map((r, idx) => [
        String(idx + 1),
        r.nis,
        r.nama,
        r.gender,
        r.kelas,
        r.kamar,
        r.waliKelas,
        r.musyrif,
        String(r.presensi.H),
        String(r.presensi.T),
        String(r.presensi.S),
        String(r.presensi.I),
        String(r.presensi.A),
        `${r.presensi.persenHadir}%`,
        String(r.pembinaan.totalCatatan),
        `${r.pembinaan.wajibPct}%`,
        `${r.pembinaan.sunnahPct}%`,
        String(r.pembinaan.netPoin),
        r.pembinaan.statusTerakhir,
        r.pembinaan.catatanTerakhir,
      ]),
    ];
    const safeClass = monthlyReport.meta.kelas.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeMonth = monthlyReport.meta.bulanLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadCsv(`Ringkasan_Bulanan_Wali_Kelas_${safeClass}_${safeMonth}.csv`, rows);
    notify('File CSV Ringkasan Bulanan berhasil diunduh.');
  };

  // Direct PDF Download in Tab 3 (Pusat Unduh)
  const handleDownloadReportPdfDirect = async () => {
    let current = reportResult;
    if (!current) {
      setLoadingReport(true);
      try {
        const targetP1 = repJenis === 'individu' ? repParam2 : repParam1;
        const qs = new URLSearchParams({
          jenis: repJenis,
          param1: targetP1,
          param2: repParam2,
          semester: repSemester,
          divisi: repDivisi,
          wilayah: repWilayah,
        });
        const res = await fetch(`/api/laporan?${qs.toString()}`);
        current = await res.json();
        setReportResult(current);
      } catch {
        setLoadingReport(false);
        notify('Gagal memuat laporan untuk PDF.', 'error');
        return;
      }
      setLoadingReport(false);
    }
    if (!current || !current.laporan.length) return;

    if (repJenis === 'ringkasan_bulanan_wali') {
      const qs = new URLSearchParams({
        bulan: repSemester,
        wilayah: repWilayah,
        kelas: repParam1 || 'SEMUA',
      });
      const res = await fetch(`/api/laporan/ringkasan-bulanan?${qs.toString()}`);
      const monthlyData: MonthlyWaliKelasReport = await res.json();
      downloadWaliKelasMonthlyPdf(monthlyData);
      notify('PDF Ringkasan Bulanan Wali Kelas berhasil diunduh.');
      return;
    }

    const wilayahLabel = repWilayah === 'Semua' ? 'Semua Wilayah (Putra & Putri)' : `Wilayah ${repWilayah}`;
    const headers = current.laporan[0];
    const bodyRows = current.laporan.slice(1);

    downloadTableReportPdf({
      title: `LAPORAN PRESENSI & PEMBINAAN (${repDivisi.toUpperCase()})`,
      subtitle: `${wilayahLabel} · Target: ${repJenis === 'individu' ? repParam2 : repParam1 || 'Semua'} · Periode: ${repSemester}`,
      metaRows: [
        ['Wilayah Laporan', wilayahLabel],
        ['Divisi / Bidang', repDivisi],
        ['Target Kelas / Santri', repJenis === 'individu' ? repParam2 : repParam1 || 'Semua Data'],
        ['Periode Akademik', repSemester],
      ],
      headers,
      rows: bodyRows,
      materiRows: current.materi,
      filename: `Laporan_${repWilayah}_${repDivisi}_${repJenis}_${repSemester.replace(/\s+/g, '_')}.pdf`,
      landscape: repJenis === 'matrix' || headers.length > 7,
    });
    notify('Dokumen PDF berhasil diunduh.');
  };

  const handlePrintPdf = async () => {
    let current = reportResult;
    if (!current) {
      const targetP1 = repJenis === 'individu' ? repParam2 : repParam1;
      const qs = new URLSearchParams({
        jenis: repJenis,
        param1: targetP1,
        param2: repParam2,
        semester: repSemester,
        divisi: repDivisi,
        wilayah: repWilayah,
      });
      const res = await fetch(`/api/laporan?${qs.toString()}`);
      current = await res.json();
      setReportResult(current);
    }
    if (!current || !current.laporan.length) return;

    const head = current.laporan[0];
    const rows = current.laporan.slice(1);
    const wilayahLabel = repWilayah === 'Semua' ? 'Semua Wilayah (Putra & Putri)' : `Wilayah ${repWilayah}`;

    const tableHtml = `
      <div class="doc-title">
        <h2>LAPORAN PRESENSI &amp; REKAPITULASI (${repDivisi.toUpperCase()})</h2>
        <div>${wilayahLabel} · Periode: ${repSemester}</div>
      </div>
      <table class="meta-table">
        <tr>
          <td width="16%"><strong>Wilayah</strong></td>
          <td width="34%">: ${wilayahLabel}</td>
          <td width="16%"><strong>Periode</strong></td>
          <td width="34%">: ${repSemester}</td>
        </tr>
        <tr>
          <td><strong>Target / Grup</strong></td>
          <td>: ${repJenis === 'individu' ? repParam2 : repParam1 || 'Semua Data'}</td>
          <td><strong>Tanggal Cetak</strong></td>
          <td>: ${formatTanggalIndo(getTodayDateStr())}</td>
        </tr>
      </table>
      <table>
        <thead>
          <tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr>${r
                  .map((c, idx) => `<td class="${idx === 1 ? 'left' : ''}">${c}</td>`)
                  .join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
      <div class="sign-grid">
        <div class="sign-box">
          <div>Mengetahui, Kepala Sekolah</div>
          <div class="sign-space"></div>
          <div><strong>( ............................................ )</strong></div>
        </div>
        <div class="sign-box">
          <div>Wali Kelas / Koordinator Laporan</div>
          <div class="sign-space"></div>
          <div><strong>( ............................................ )</strong></div>
        </div>
      </div>
    `;
    printHtmlDocument(`Laporan_${repWilayah}_${repDivisi}_${repJenis}`, tableHtml, repJenis === 'matrix' || head.length > 7);
  };

  const handlePrintAnalisis = () => {
    if (!analisis) return;
    const html = `
      <div class="doc-title">
        <h2>LAPORAN HASIL ANALISIS PRESENSI &amp; PEMBINAAN TERPADU</h2>
        <div>Wilayah Putra &amp; Wilayah Putri · Tanggal Analisis: ${formatTanggalIndo(analisis.tanggal)}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Divisi Presensi</th>
            <th>Wilayah Putra (% Hadir)</th>
            <th>Rincian Putra (H/T/S/I/A)</th>
            <th>Wilayah Putri (% Hadir)</th>
            <th>Rincian Putri (H/T/S/I/A)</th>
          </tr>
        </thead>
        <tbody>
          ${(['Asrama', 'Belajar', 'AlQuran', 'Ujian'] as const)
            .map((k) => {
              const pa = analisis.divisiByWilayah.Putra[k];
              const pi = analisis.divisiByWilayah.Putri[k];
              return `
                <tr>
                  <td class="left"><strong>${k === 'Belajar' ? 'Akademik (KBM)' : k}</strong></td>
                  <td><strong>${pa.persenHadir}%</strong> (${pa.total} log)</td>
                  <td>${pa.H}/${pa.T}/${pa.S}/${pa.I}/${pa.A}</td>
                  <td><strong>${pi.persenHadir}%</strong> (${pi.total} log)</td>
                  <td>${pi.H}/${pi.T}/${pi.S}/${pi.I}/${pi.A}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
      <div class="sign-grid">
        <div class="sign-box">
          <div>Mengetahui, Kepala Sekolah</div>
          <div class="sign-space"></div>
          <div><strong>( ............................................ )</strong></div>
        </div>
        <div class="sign-box">
          <div>Koordinator Pusat Data &amp; Pembinaan</div>
          <div class="sign-space"></div>
          <div><strong>( ............................................ )</strong></div>
        </div>
      </div>
    `;
    printHtmlDocument(`Hasil_Analisis_Putra_Putri_${analisis.tanggal}`, html, true);
  };

  const handleDownloadCsv = async () => {
    let current = reportResult;
    if (!current) {
      const targetP1 = repJenis === 'individu' ? repParam2 : repParam1;
      const qs = new URLSearchParams({
        jenis: repJenis,
        param1: targetP1,
        param2: repParam2,
        semester: repSemester,
        divisi: repDivisi,
        wilayah: repWilayah,
      });
      const res = await fetch(`/api/laporan?${qs.toString()}`);
      current = await res.json();
      setReportResult(current);
    }
    if (!current || !current.laporan.length) return;

    const extra: string[][][] = [];
    if (current.materi && current.materi.length > 0) {
      extra.push([
        ['No', 'Tanggal', 'Mata Pelajaran', 'Materi Pembelajaran'],
        ...current.materi.map((m) => [String(m.no), m.tanggal, m.mapel, m.materi]),
      ]);
    }
    downloadCsv(`Laporan_${repWilayah}_${repDivisi}_${repJenis}.csv`, current.laporan, extra);
    notify('File CSV berhasil diunduh.');
  };

  const renderMatrixTable = (title: string, items: MonitoringCell[]) => {
    const filteredItems = items.filter((it) => {
      if (monStatusFilter !== 'ALL' && it.status !== monStatusFilter) return false;
      if (monSearch.trim()) {
        const q = monSearch.trim().toLowerCase();
        return (
          it.kelas.toLowerCase().includes(q) ||
          it.mapel.toLowerCase().includes(q) ||
          it.guru.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const klsMap = new Map<string, MonitoringCell[]>();
    filteredItems.forEach((it) => {
      if (!klsMap.has(it.kelas)) klsMap.set(it.kelas, []);
      klsMap.get(it.kelas)!.push(it);
    });

    const hadirCount = filteredItems.filter((c) => c.status === 'HADIR').length;
    const totalCount = filteredItems.length;
    const pct = totalCount > 0 ? Math.round((hadirCount / totalCount) * 100) : 0;

    if (klsMap.size === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
          <p className="mt-2 text-xs text-slate-500">
            Tidak ada jadwal yang sesuai filter pada hari ini.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</h4>
          <div className="flex items-center gap-2 text-xs font-mono-num">
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
              Terisi: {hadirCount}/{totalCount} ({pct}%)
            </span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from(klsMap.entries()).map(([kls, cells]) => {
            const klsHadir = cells.filter((c) => c.status === 'HADIR').length;
            return (
              <div key={kls} className="p-4 flex flex-col gap-2.5 sm:flex-row sm:items-center hover:bg-slate-50/70 transition-colors">
                <div className="w-40 shrink-0">
                  <div className="font-bold text-xs text-slate-900">{kls}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                      <div
                        style={{ width: `${cells.length > 0 ? Math.round((klsHadir / cells.length) * 100) : 0}%` }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                    <span className="font-mono-num text-[10px] font-semibold text-slate-500">
                      {klsHadir}/{cells.length}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cells.map((c, idx) => {
                    const style =
                      c.status === 'HADIR'
                        ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950 shadow-2xs'
                        : c.status === 'GURU_ABSEN'
                        ? 'border-amber-300 bg-amber-50/90 text-amber-950'
                        : 'border-rose-200 bg-rose-50/80 text-rose-950';
                    return (
                      <div key={idx} className={`rounded-lg border px-3 py-2 text-xs transition-transform hover:-translate-y-0.5 ${style}`}>
                        <div className="font-mono-num font-bold flex items-center gap-1.5">
                          {c.status === 'HADIR' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : c.status === 'GURU_ABSEN' ? (
                            <UserX className="h-3.5 w-3.5 text-amber-600" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                          )}
                          Jam {c.jam} · {c.mapel}
                        </div>
                        <div className="mt-0.5 text-[11px] opacity-85">{c.guru}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Monitoring, Dasbor Analisis Data &amp; Ekspor Laporan PDF
          </h2>
          <p className="text-xs text-slate-600">
            Pantau keterisian presensi real-time, analisis data bulanan per kelas/wilayah, dan unduh ringkasan PDF Wali Kelas.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-full sm:w-auto">
          {[
            {
              id: 'monitoring',
              label: 'Matriks Live',
              activeCls: 'bg-teal-600 text-white shadow-sm',
            },
            {
              id: 'statistik',
              label: 'Analisis Bulanan',
              activeCls: 'bg-indigo-600 text-white shadow-sm',
            },
            {
              id: 'download',
              label: 'Unduh PDF/CSV',
              activeCls: 'bg-emerald-600 text-white shadow-sm',
            },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as typeof subTab)}
              className={`rounded-lg px-2 sm:px-3.5 py-2 text-[11px] sm:text-xs font-semibold whitespace-nowrap truncate transition-colors ${
                subTab === t.id
                  ? t.activeCls
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================= */}
      {/* VIEW 1: MONITORING REAL-TIME PUTRA & PUTRI                    */}
      {/* ============================================================= */}
      {subTab === 'monitoring' && (
        <div className="space-y-4">
          {monData && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['putra', 'putri'] as const).map((g) => {
                const side = monData[g];
                const akCells = [...side.akademik.kelas10, ...side.akademik.kelas11, ...side.akademik.kelas12];
                const qCells = [...side.alquran.kelas10, ...side.alquran.kelas11, ...side.alquran.kelas12];
                const asr = side.asrama;
                const akHadir = akCells.filter((c) => c.status === 'HADIR').length;
                const qHadir = qCells.filter((c) => c.status === 'HADIR').length;
                const asrHadir = asr.filter((r) => r.status === 'HADIR').length;
                const akPct = akCells.length > 0 ? Math.round((akHadir / akCells.length) * 100) : 0;
                const qPct = qCells.length > 0 ? Math.round((qHadir / qCells.length) * 100) : 0;
                const asrPct = asr.length > 0 ? Math.round((asrHadir / asr.length) * 100) : 0;
                const active = monGender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setMonGender(g)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      active
                        ? g === 'putri'
                          ? 'border-rose-300 bg-rose-50/50 ring-2 ring-rose-200/60'
                          : 'border-sky-300 bg-sky-50/50 ring-2 ring-sky-200/60'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          g === 'putri' ? 'text-rose-800' : 'text-sky-800'
                        }`}
                      >
                        Ringkasan Monitoring Wilayah {g === 'putri' ? 'Putri' : 'Putra'}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {active ? 'Sedang Ditampilkan' : 'Klik untuk Lihat'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 font-mono-num text-xs">
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Akademik</span>
                          <span className="font-bold text-teal-700">{akPct}%</span>
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {akHadir}/{akCells.length}
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div style={{ width: `${akPct}%` }} className="h-full bg-teal-600" />
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Al-Qur&apos;an</span>
                          <span className="font-bold text-indigo-700">{qPct}%</span>
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {qHadir}/{qCells.length}
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div style={{ width: `${qPct}%` }} className="h-full bg-indigo-600" />
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Kamar Asrama</span>
                          <span className="font-bold text-emerald-700">{asrPct}%</span>
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {asrHadir}/{asr.length}
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div style={{ width: `${asrPct}%` }} className="h-full bg-emerald-600" />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg bg-slate-100 p-1">
                  {(['putri', 'putra'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setMonGender(g)}
                      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                        monGender === g
                          ? g === 'putri'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-sky-600 text-white shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      Wilayah {g === 'putri' ? 'Putri' : 'Putra'}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-lg bg-slate-100 p-1">
                  {(
                    [
                      { id: 'akademik', label: 'Akademik' },
                      { id: 'alquran', label: "Al-Qur'an" },
                      { id: 'asrama', label: 'Asrama' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setMonDiv(d.id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                        monDiv === d.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTglMonitoring((d) => shiftDateStr(d, -1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <input
                  type="date"
                  value={tglMonitoring}
                  onChange={(e) => setTglMonitoring(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-mono-num font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setTglMonitoring((d) => shiftDateStr(d, 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="ml-2 text-xs font-semibold text-slate-600 whitespace-nowrap">
                  {getNamaHariFromDate(tglMonitoring)}
                </span>
              </div>
            </div>

            {/* Interactive Filter & Search Bar for Matriks Live */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1 gap-1">
                {(
                  [
                    { id: 'ALL', label: 'Semua Status' },
                    { id: 'HADIR', label: 'Sudah Diisi' },
                    { id: 'BELUM', label: 'Belum Diisi' },
                    { id: 'GURU_ABSEN', label: 'Guru/Musyrif Absen' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setMonStatusFilter(st.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                      monStatusFilter === st.id
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
                  value={monSearch}
                  onChange={(e) => setMonSearch(e.target.value)}
                  placeholder="Cari kelas, mapel, guru, kamar..."
                  className="h-7 w-full sm:w-64 rounded-lg border border-slate-200 pl-8 pr-3 text-xs"
                />
              </div>
            </div>
          </div>

          {loadingMon || !monData ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
          ) : monDiv === 'asrama' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {monData[monGender].asrama
                .filter((rm) => {
                  if (monStatusFilter !== 'ALL' && rm.status !== monStatusFilter) return false;
                  if (monSearch.trim()) {
                    const q = monSearch.trim().toLowerCase();
                    return rm.kamar.toLowerCase().includes(q) || rm.musyrif.toLowerCase().includes(q);
                  }
                  return true;
                })
                .map((rm) => (
                  <div
                    key={rm.kamar}
                    className={`rounded-xl border p-4 transition-all ${
                      rm.status === 'HADIR'
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : rm.status === 'GURU_ABSEN'
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{rm.kamar}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{rm.musyrif}</div>
                    <div className="mt-3 text-xs font-semibold">
                      {rm.status === 'HADIR' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Sudah Diisi
                        </span>
                      ) : rm.status === 'GURU_ABSEN' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">
                          <UserX className="h-3.5 w-3.5" />
                          Musyrif Absen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-rose-800">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Belum Diisi
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-4">
              {renderMatrixTable(
                `Kelas 10 · ${monDiv === 'akademik' ? 'Akademik' : "Al-Qur'an"} (Wilayah ${monGender === 'putri' ? 'Putri' : 'Putra'})`,
                monData[monGender][monDiv].kelas10
              )}
              {renderMatrixTable(
                `Kelas 11 · ${monDiv === 'akademik' ? 'Akademik' : "Al-Qur'an"} (Wilayah ${monGender === 'putri' ? 'Putri' : 'Putra'})`,
                monData[monGender][monDiv].kelas11
              )}
              {renderMatrixTable(
                `Kelas 12 · ${monDiv === 'akademik' ? 'Akademik' : "Al-Qur'an"} (Wilayah ${monGender === 'putri' ? 'Putri' : 'Putra'})`,
                monData[monGender][monDiv].kelas12
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW 2: DASBOR ANALISIS DATA & RINGKASAN BULANAN WALI KELAS   */}
      {/* ============================================================= */}
      {subTab === 'statistik' && (
        <div className="space-y-6">
          {/* Control & PDF Export Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Dasbor Analisis Data &amp; Ringkasan Bulanan Wali Kelas
                </h3>
                <p className="text-xs text-slate-500">
                  Pilih Wilayah, Periode Bulan, dan Kelas Binaan untuk menganalisis serta mengunduh laporan PDF Presensi &amp; Pembinaan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!monthlyReport || loadingMonthly}
                  onClick={() => handleDownloadMonthlyWaliPdf()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Unduh PDF Ringkasan Bulanan
                </button>
                <button
                  type="button"
                  disabled={!analisis || loadingAnalisis}
                  onClick={handleDownloadAnalyticsPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh PDF Dasbor Analisis
                </button>
                <button
                  type="button"
                  disabled={!monthlyReport || loadingMonthly}
                  onClick={handleDownloadMonthlyCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                  Unduh CSV
                </button>
                <button
                  type="button"
                  disabled={!analisis || loadingAnalisis}
                  onClick={handlePrintAnalisis}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Filter Wilayah
                </label>
                <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
                  {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setStatsWilayah(w)}
                      className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        statsWilayah === w
                          ? w === 'Putri'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : w === 'Putra'
                            ? 'bg-sky-600 text-white shadow-sm'
                            : 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {w === 'Semua' ? 'Semua' : w}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Periode Bulan / Semester
                </label>
                <select
                  value={statsBulan}
                  onChange={(e) => setStatsBulan(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
                >
                  <option value="SEMUA">Semua Bulan (Kumulatif)</option>
                  <option value="Ganjil (Jul-Des)">Semester Ganjil (Jul - Des)</option>
                  <option value="Genap (Jan-Jun)">Semester Genap (Jan - Jun)</option>
                  {NAMA_BULAN_INDO.map((bln, idx) => (
                    <option key={bln} value={`Bulan ${idx + 1}`}>
                      Bulan {bln}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kelas Binaan (Wali Kelas)
                </label>
                <select
                  value={statsKelas}
                  onChange={(e) => setStatsKelas(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800"
                >
                  <option value="SEMUA">Semua Kelas ({statsScopedClasses.length} Kelas)</option>
                  {statsScopedClasses.map((kls) => (
                    <option key={kls} value={kls}>
                      {kls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tanggal Referensi Harian
                </label>
                <input
                  type="date"
                  value={tglAnalisis}
                  onChange={(e) => setTglAnalisis(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-mono-num font-semibold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* SECTION 1: 4 EXECUTIVE KPI CARDS (PRESENSI & PEMBINAAN BULANAN) */}
          {loadingMonthly || !monthlyReport ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-32 animate-pulse rounded-xl bg-slate-200" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Kehadiran Kumulatif */}
              <div className="rounded-xl border border-slate-200 border-t-4 border-t-emerald-500 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Tingkat Kehadiran</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-emerald-800">
                    {monthlyReport.presensiSummary.totalSesi} sesi log
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="font-mono-num text-2xl font-bold text-slate-900">
                    {monthlyReport.presensiSummary.persenHadir}%
                  </div>
                  <div className="font-mono-num text-xs font-semibold text-emerald-700">
                    H+T: {monthlyReport.presensiSummary.H + monthlyReport.presensiSummary.T}
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{ width: `${monthlyReport.presensiSummary.persenHadir}%` }}
                    className="h-full bg-emerald-500 transition-all"
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono-num text-[11px]">
                  <div className="rounded-md bg-amber-50 py-1 text-amber-800">
                    S: <strong>{monthlyReport.presensiSummary.S}</strong>
                  </div>
                  <div className="rounded-md bg-sky-50 py-1 text-sky-800">
                    I: <strong>{monthlyReport.presensiSummary.I}</strong>
                  </div>
                  <div className="rounded-md bg-rose-50 py-1 text-rose-800">
                    A: <strong>{monthlyReport.presensiSummary.A}</strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Cakupan Pembinaan Wali Kelas */}
              <div className="rounded-xl border border-slate-200 border-t-4 border-t-teal-600 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Cakupan Pembinaan</span>
                  <span className="rounded-md bg-teal-50 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-teal-800">
                    {monthlyReport.pembinaanSummary.totalCatatan} catatan
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="font-mono-num text-2xl font-bold text-slate-900">
                    {monthlyReport.meta.totalSantri === 0
                      ? 0
                      : Math.round(
                          (monthlyReport.pembinaanSummary.santriDibina / monthlyReport.meta.totalSantri) * 100
                        )}
                    %
                  </div>
                  <div className="font-mono-num text-xs font-semibold text-teal-700">
                    {monthlyReport.pembinaanSummary.santriDibina}/{monthlyReport.meta.totalSantri} santri
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{
                      width: `${
                        monthlyReport.meta.totalSantri === 0
                          ? 0
                          : Math.round(
                              (monthlyReport.pembinaanSummary.santriDibina / monthlyReport.meta.totalSantri) * 100
                            )
                      }%`,
                    }}
                    className="h-full bg-teal-600 transition-all"
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Wali:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[160px]">
                    {monthlyReport.meta.waliKelas}
                  </span>
                </div>
              </div>

              {/* Card 3: Ketaatan Sholat Wajib & Ibadah Sunnah */}
              <div className="rounded-xl border border-slate-200 border-t-4 border-t-sky-500 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Indeks Ibadah Santri</span>
                  <span className="rounded-md bg-sky-50 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-sky-800">
                    5 Waktu &amp; Sunnah
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="font-mono-num text-2xl font-bold text-emerald-700">
                    {monthlyReport.pembinaanSummary.persenSholatWajib}%
                  </div>
                  <div className="font-mono-num text-xs font-semibold text-slate-600">
                    Sunnah: {monthlyReport.pembinaanSummary.persenIbadahSunnah}%
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{ width: `${monthlyReport.pembinaanSummary.persenSholatWajib}%` }}
                    className="h-full bg-sky-500 transition-all"
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono-num text-[10px]">
                  <div className="rounded-md bg-emerald-50 py-1 text-emerald-800">
                    Mandiri: <strong>{monthlyReport.pembinaanSummary.prioritasCounts.Mandiri}</strong>
                  </div>
                  <div className="rounded-md bg-sky-50 py-1 text-sky-800">
                    Rutin: <strong>{monthlyReport.pembinaanSummary.prioritasCounts.Rutin}</strong>
                  </div>
                  <div className="rounded-md bg-rose-50 py-1 text-rose-800">
                    Intensif: <strong>{monthlyReport.pembinaanSummary.prioritasCounts.Intensif}</strong>
                  </div>
                </div>
              </div>

              {/* Card 4: Poin Karakter & Status Tindak Lanjut */}
              <div className="rounded-xl border border-slate-200 border-t-4 border-t-indigo-600 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Poin &amp; Tindak Lanjut</span>
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-indigo-800">
                    Karakter
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div
                    className={`font-mono-num text-2xl font-bold ${
                      monthlyReport.pembinaanSummary.netPoin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {monthlyReport.pembinaanSummary.netPoin > 0
                      ? `+${monthlyReport.pembinaanSummary.netPoin}`
                      : monthlyReport.pembinaanSummary.netPoin}
                  </div>
                  <div className="font-mono-num text-xs text-slate-600">
                    +{monthlyReport.pembinaanSummary.totalPrestasi} / -{monthlyReport.pembinaanSummary.totalPelanggaran}
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          15,
                          50 + monthlyReport.pembinaanSummary.netPoin
                        )
                      )}%`,
                    }}
                    className={`h-full ${
                      monthlyReport.pembinaanSummary.netPoin >= 0 ? 'bg-indigo-600' : 'bg-rose-500'
                    }`}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono-num text-[10px]">
                  <div className="rounded-md bg-emerald-50 py-1 text-emerald-800">
                    Selesai: <strong>{monthlyReport.pembinaanSummary.statusCounts.Selesai}</strong>
                  </div>
                  <div className="rounded-md bg-amber-50 py-1 text-amber-800">
                    Proses: <strong>{monthlyReport.pembinaanSummary.statusCounts.Proses}</strong>
                  </div>
                  <div className="rounded-md bg-rose-50 py-1 text-rose-800">
                    Eskalasi: <strong>{monthlyReport.pembinaanSummary.statusCounts.Eskalasi}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: VISUAL ANALYTICS DASHBOARD WITH RECHARTS (DIVISI PRESENSI & DISTRIBUSI) */}
          {monthlyReport && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left: Presensi & Keterisian per Divisi with Recharts BarChart */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Analisis Kehadiran &amp; Jadwal per Divisi ({monthlyReport.meta.kelas})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Grafik capaian kehadiran santri &amp; target sesi jadwal Akademik, Al-Qur&apos;an, Asrama, dan Ujian.
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 self-start sm:self-auto">
                    {(
                      [
                        { id: 'persen', label: '% Capaian' },
                        { id: 'volume', label: 'Volume Sesi' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDivisiChartMode(m.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                          divisiChartMode === m.id
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recharts BarChart */}
                <div className="h-56 w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    {divisiChartMode === 'persen' ? (
                      <BarChart data={divisiChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="persenHadir" name="% Hadir Santri" radius={[6, 6, 0, 0]}>
                          {divisiChartData.map((entry, idx) => (
                            <Cell key={`cell-hadir-${idx}`} fill={entry.color} />
                          ))}
                        </Bar>
                        <Bar
                          dataKey="keterisianPct"
                          name="% Jadwal/Kamar Terisi"
                          fill="#0ea5e9"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    ) : (
                      <BarChart data={divisiChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="jadwalAktif" name="Target Jadwal/Kamar" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="jadwalTerisi" name="Sesi Terisi Hari Ini" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="hadirLog" name="Log Hadir Santri" fill="#0d9488" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Detailed Colorful Progress Rows */}
                <div className="space-y-3">
                  {divisiChartData.map((row) => {
                    const displayPct = row.totalLog > 0 ? row.persenHadir : row.keterisianPct;
                    return (
                      <div key={row.name} className="space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: row.color }}
                            />
                            <span className="font-semibold text-slate-800">{row.fullLabel}</span>
                          </div>
                          <span className="font-mono-num text-slate-600 text-[11px]">
                            <strong className="text-slate-900">{row.persenHadir}% Hadir</strong> ({row.hadirLog}/
                            {row.totalLog} log) · Jadwal:{' '}
                            <strong className="text-teal-700">
                              {row.jadwalTerisi}/{row.jadwalAktif}
                            </strong>{' '}
                            · S:{row.S} I:{row.I} A:{row.A}
                          </span>
                        </div>
                        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            style={{
                              width: `${Math.max(displayPct, row.jadwalAktif > 0 ? 6 : 0)}%`,
                              backgroundColor: row.color,
                            }}
                            className="transition-all"
                            title={`${row.fullLabel}: ${displayPct}%`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Distribusi Kategori Pembinaan & Komposisi Santri with Recharts Donut Chart */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Distribusi Pembinaan, Karakter &amp; Komposisi Kelas
                    </h3>
                    <p className="text-xs text-slate-500">
                      {rightDistributionData.mode === 'pembinaan'
                        ? 'Proporsi catatan pembinaan berdasarkan fokus pengawasan Wali Kelas & Musyrif/ah.'
                        : 'Distribusi populasi santri & kelas binaan per tingkat dan wilayah asrama.'}
                    </p>
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 self-start sm:self-auto">
                    {(
                      [
                        { id: 'pembinaan', label: 'Kategori Binaan' },
                        { id: 'komposisi', label: 'Komposisi Kelas' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setRightChartMode(m.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                          rightChartMode === m.id
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recharts Donut Chart + Legend List */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-center rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <div className="h-52 sm:col-span-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={rightDistributionData.items}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={74}
                          paddingAngle={3}
                        >
                          {rightDistributionData.items.map((entry, index) => (
                            <Cell key={`pie-cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="sm:col-span-6 space-y-2">
                    {rightDistributionData.items.map((item) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-semibold text-slate-800 truncate">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            {item.name}
                          </span>
                          <span className="font-mono-num text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                            {item.value} {item.unit} ({item.pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                          <div
                            style={{ width: `${Math.max(item.pct, 4)}%`, backgroundColor: item.color }}
                            className="h-full rounded-full transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category breakdown bars for Pembinaan */}
                <div className="space-y-2.5">
                  {monthlyReport.pembinaanSummary.kategoriCounts.map((kat, idx) => {
                    const totalCat = Math.max(1, monthlyReport.pembinaanSummary.totalCatatan);
                    const pctNum = Math.round((kat.count / totalCat) * 100);
                    const colors = ['bg-teal-600', 'bg-sky-600', 'bg-rose-600', 'bg-emerald-600', 'bg-amber-500'];
                    const barColor = colors[idx % colors.length];
                    return (
                      <div key={kat.kategori} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{kat.kategori}</span>
                          <span className="font-mono-num text-slate-600">
                            {kat.count} catatan ({pctNum}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            style={{ width: `${kat.count > 0 ? Math.max(pctNum, 5) : 3}%` }}
                            className={`h-full ${barColor} opacity-${kat.count > 0 ? '100' : '30'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {monthlyReport.pembinaanSummary.jalurCounts && (
                  <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-2.5 py-2">
                      <div className="text-[10px] font-semibold text-teal-800">Wali Kelas (Mingguan)</div>
                      <div className="font-mono-num font-bold text-teal-950">
                        {monthlyReport.pembinaanSummary.jalurCounts.waliKelasMingguan}
                      </div>
                    </div>
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-2.5 py-2">
                      <div className="text-[10px] font-semibold text-indigo-800">Guru Wali (Tentatif)</div>
                      <div className="font-mono-num font-bold text-indigo-950">
                        {monthlyReport.pembinaanSummary.jalurCounts.guruWaliTentatif}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2">
                      <div className="text-[10px] font-semibold text-amber-800">Room Visit (Tentatif)</div>
                      <div className="font-mono-num font-bold text-amber-950">
                        {monthlyReport.pembinaanSummary.jalurCounts.roomVisitAsrama}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION 3: GRAFIK & MATRIKS INTERAKTIF PERBANDINGAN ANTAR KELAS */}
          {monthlyReport && monthlyReport.classComparison.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Grafik &amp; Matriks Interaktif Perbandingan Antar Kelas ({sortedClassComparison.length} Kelas)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Klik batang grafik atau baris tabel untuk memfilter santri per kelas, atau klik judul kolom untuk mengurutkan data.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                    {(
                      [
                        { id: 'kehadiran', label: '% Hadir & Binaan' },
                        { id: 'santri', label: 'Populasi Santri' },
                        { id: 'ibadah', label: '% Sholat Wajib' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setClassChartMetric(m.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                          classChartMetric === m.id
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={classSearch}
                      onChange={(e) => setClassSearch(e.target.value)}
                      placeholder="Cari kelas / wali kelas..."
                      className="h-7 rounded-lg border border-slate-200 pl-8 pr-3 text-xs"
                    />
                  </div>
                  {statsKelas !== 'SEMUA' && (
                    <button
                      type="button"
                      onClick={() => setStatsKelas('SEMUA')}
                      className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap shrink-0"
                    >
                      Reset Filter ({statsKelas})
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Full-Width Recharts BarChart for Class Comparison */}
              <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sortedClassComparison}
                      margin={{ top: 10, right: 16, left: -16, bottom: 20 }}
                      onClick={(state) => {
                        const clicked = (state as { activeLabel?: string } | null)?.activeLabel;
                        if (clicked) {
                          setStatsKelas((prev) => (prev === clicked ? 'SEMUA' : clicked));
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="kelas"
                        tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
                        angle={-25}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        domain={classChartMetric === 'santri' ? [0, 'auto'] : [0, 100]}
                        unit={classChartMetric === 'santri' ? '' : '%'}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      {classChartMetric === 'kehadiran' && (
                        <>
                          <Bar dataKey="persenHadir" name="% Kehadiran" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar
                            dataKey="cakupanPembinaanPct"
                            name="% Cakupan Binaan"
                            fill="#0d9488"
                            radius={[4, 4, 0, 0]}
                          />
                        </>
                      )}
                      {classChartMetric === 'santri' && (
                        <>
                          <Bar dataKey="totalSantri" name="Total Santri" radius={[4, 4, 0, 0]}>
                            {sortedClassComparison.map((entry, idx) => (
                              <Cell
                                key={`cls-cell-${idx}`}
                                fill={entry.gender === 'Putri' ? '#e11d48' : '#0284c7'}
                              />
                            ))}
                          </Bar>
                          <Bar dataKey="santriDibina" name="Santri Terbina" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </>
                      )}
                      {classChartMetric === 'ibadah' && (
                        <Bar dataKey="wajibPct" name="% Sholat Wajib 5 Waktu" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('kelas')}
                          className="inline-flex items-center font-semibold hover:text-slate-900"
                        >
                          Kelas {renderSortIcon(classSort.key === 'kelas', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('gender')}
                          className="inline-flex items-center font-semibold hover:text-slate-900"
                        >
                          Wilayah {renderSortIcon(classSort.key === 'gender', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('waliKelas')}
                          className="inline-flex items-center font-semibold hover:text-slate-900"
                        >
                          Wali Kelas {renderSortIcon(classSort.key === 'waliKelas', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('totalSantri')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Santri {renderSortIcon(classSort.key === 'totalSantri', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('persenHadir')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          % Hadir {renderSortIcon(classSort.key === 'persenHadir', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('cakupanPembinaanPct')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Cakupan Binaan {renderSortIcon(classSort.key === 'cakupanPembinaanPct', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('wajibPct')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Sholat Wajib {renderSortIcon(classSort.key === 'wajibPct', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleClassSort('netPoin')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Net Poin {renderSortIcon(classSort.key === 'netPoin', classSort.dir)}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi Wali Kelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-num">
                    {sortedClassComparison.map((c) => {
                      const isSelected = statsKelas === c.kelas;
                      return (
                        <tr
                          key={c.kelas}
                          onClick={() => setStatsKelas(isSelected ? 'SEMUA' : c.kelas)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-teal-50/90 font-semibold' : 'hover:bg-indigo-50/40'
                          }`}
                        >
                          <td className="px-4 py-2.5 font-sans font-bold text-slate-900">{c.kelas}</td>
                          <td className="px-3 py-2.5 font-sans">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                c.gender === 'Putri'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {c.gender}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-sans text-slate-700">{c.waliKelas}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                            {c.totalSantri}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden sm:block h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  style={{ width: `${c.persenHadir}%` }}
                                  className="h-full bg-emerald-500"
                                />
                              </div>
                              <span className="font-bold text-emerald-700">{c.persenHadir}%</span>
                              <span className="text-[11px] text-slate-400">
                                ({c.totalHadir}/{c.totalHadir + c.totalAbsen})
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden sm:block h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  style={{ width: `${c.cakupanPembinaanPct}%` }}
                                  className="h-full bg-teal-600"
                                />
                              </div>
                              <span className="font-semibold text-teal-800">{c.cakupanPembinaanPct}%</span>
                              <span className="text-[11px] text-slate-400">
                                ({c.santriDibina}/{c.totalSantri})
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-indigo-700">
                            {c.wajibPct}%
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-bold ${
                              c.netPoin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {c.netPoin > 0 ? `+${c.netPoin}` : c.netPoin}
                          </td>
                          <td
                            className="px-4 py-2.5 text-right font-sans"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setStatsKelas(isSelected ? 'SEMUA' : c.kelas)}
                                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                                  isSelected
                                    ? 'bg-teal-700 text-white'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {isSelected ? 'Terpilih' : 'Pilih Kelas'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadMonthlyWaliPdf(c.kelas)}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                              >
                                <Download className="h-3 w-3" />
                                PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 4: TABEL INTERAKTIF RINGKASAN BULANAN WALI KELAS PER SANTRI */}
          {monthlyReport && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tabel Interaktif Ringkasan Bulanan Wali Kelas: Presensi &amp; Pembinaan Santri ({filteredStudentRows.length} Santri)
                  </h3>
                  <p className="text-xs text-slate-500">
                    {monthlyReport.meta.bulanLabel} · Kelas: <strong>{monthlyReport.meta.kelas}</strong> · Wali Kelas: <strong>{monthlyReport.meta.waliKelas}</strong> · Klik baris santri untuk melihat rincian per divisi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Cari nama, NIS, kamar..."
                      className="h-8 rounded-lg border border-slate-200 pl-8 pr-3 text-xs"
                    />
                  </div>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                    {(
                      [
                        { id: 'all', label: 'Semua' },
                        { id: 'attention', label: 'Perlu Perhatian' },
                        { id: 'unmentored', label: 'Belum Dibina' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStudentQuickFilter(f.id)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                          studentQuickFilter === f.id
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadMonthlyWaliPdf()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh PDF Kelas Ini
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[560px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">No</th>
                      <th className="px-3 py-2.5 font-semibold">NIS</th>
                      <th className="px-3 py-2.5 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('nama')}
                          className="inline-flex items-center font-semibold hover:text-slate-900"
                        >
                          Nama Santri {renderSortIcon(studentSort.key === 'nama', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('kelas')}
                          className="inline-flex items-center font-semibold hover:text-slate-900"
                        >
                          Kelas &amp; Kamar {renderSortIcon(studentSort.key === 'kelas', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('ht')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          H+T {renderSortIcon(studentSort.key === 'ht', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('sia')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          S/I/A {renderSortIcon(studentSort.key === 'sia', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('persenHadir')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          % Hadir {renderSortIcon(studentSort.key === 'persenHadir', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('totalCatatan')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Binaan {renderSortIcon(studentSort.key === 'totalCatatan', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('wajibPct')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Wajib % {renderSortIcon(studentSort.key === 'wajibPct', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('sunnahPct')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Sunnah % {renderSortIcon(studentSort.key === 'sunnahPct', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleStudentSort('netPoin')}
                          className="inline-flex items-center justify-end font-semibold hover:text-slate-900"
                        >
                          Poin {renderSortIcon(studentSort.key === 'netPoin', studentSort.dir)}
                        </button>
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Status &amp; Catatan Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-num">
                    {filteredStudentRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center font-sans text-xs text-slate-500">
                          Tidak ada santri yang sesuai dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredStudentRows.map((st, idx) => {
                        const isExpanded = expandedStudentId === st.id;
                        return (
                          <React.Fragment key={st.id}>
                            <tr
                              onClick={() => setExpandedStudentId(isExpanded ? null : st.id)}
                              className={`cursor-pointer transition-colors ${
                                isExpanded ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                              <td className="px-3 py-2.5 text-slate-600">{st.nis}</td>
                              <td className="px-3 py-2.5 font-sans font-semibold text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <span>{st.nama}</span>
                                  <Eye className="h-3 w-3 text-indigo-500 opacity-75 shrink-0" />
                                </div>
                                <div className="text-[10px] font-normal text-slate-500">
                                  Wali: {st.waliKelas}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-sans">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    st.gender === 'Putri'
                                      ? 'bg-rose-50 text-rose-800'
                                      : 'bg-sky-50 text-sky-800'
                                  }`}
                                >
                                  {st.kelas}
                                </span>
                                <div className="text-[10px] text-slate-500 mt-0.5">{st.kamar}</div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                                {st.presensi.H + st.presensi.T}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-600">
                                <span className="text-amber-700">{st.presensi.S}</span>/
                                <span className="text-sky-700">{st.presensi.I}</span>/
                                <span className={st.presensi.A > 0 ? 'font-bold text-rose-700' : ''}>
                                  {st.presensi.A}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="hidden sm:block h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      style={{ width: `${st.presensi.persenHadir}%` }}
                                      className={`h-full ${
                                        st.presensi.persenHadir >= 85
                                          ? 'bg-emerald-500'
                                          : st.presensi.persenHadir >= 70
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`}
                                    />
                                  </div>
                                  <span className="font-bold text-slate-900">{st.presensi.persenHadir}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-teal-800">
                                {st.pembinaan.totalCatatan}x
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-indigo-700">
                                {st.pembinaan.wajibPct}%
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-600">
                                {st.pembinaan.sunnahPct}%
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right font-bold ${
                                  st.pembinaan.netPoin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {st.pembinaan.netPoin > 0 ? `+${st.pembinaan.netPoin}` : st.pembinaan.netPoin}
                              </td>
                              <td className="px-3 py-2.5 font-sans">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                      st.pembinaan.statusTerakhir === 'Eskalasi'
                                        ? 'bg-rose-100 text-rose-800'
                                        : st.pembinaan.statusTerakhir === 'Proses'
                                        ? 'bg-amber-100 text-amber-800'
                                        : st.pembinaan.statusTerakhir === 'Selesai'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {st.pembinaan.statusTerakhir}
                                  </span>
                                  <span className="truncate max-w-[200px] text-[11px] text-slate-600">
                                    {st.pembinaan.catatanTerakhir}
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-indigo-50/30 font-sans">
                                <td colSpan={12} className="px-4 py-3">
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
                                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase">
                                        Presensi per Divisi
                                      </div>
                                      <div className="mt-1.5 flex items-center justify-between font-mono-num">
                                        <span>Akademik: <strong>{st.presensi.akademikPct}%</strong></span>
                                        <span>Al-Qur&apos;an: <strong>{st.presensi.alquranPct}%</strong></span>
                                        <span>Asrama: <strong>{st.presensi.asramaPct}%</strong></span>
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase">
                                        Pembimbing &amp; Asrama
                                      </div>
                                      <div className="mt-1 text-slate-800">
                                        Wali Kelas: <strong>{st.waliKelas}</strong>
                                      </div>
                                      <div className="text-slate-600 text-[11px]">
                                        Musyrif/ah: <strong>{st.musyrif}</strong> ({st.kamar})
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase">
                                        Status &amp; Poin Karakter
                                      </div>
                                      <div className="mt-1 flex items-center gap-2 font-mono-num">
                                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                                          Status: {st.pembinaan.statusTerakhir}
                                        </span>
                                        <span className="text-emerald-700">+{st.pembinaan.totalPrestasi}</span>
                                        <span className="text-rose-700">-{st.pembinaan.totalPelanggaran}</span>
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                                      <div className="text-[10px] font-semibold text-slate-500 uppercase">
                                        Catatan Pembinaan Terakhir ({st.pembinaan.totalCatatan}x)
                                      </div>
                                      <div className="mt-1 text-slate-700 text-[11px]">
                                        {st.pembinaan.catatanTerakhir}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 5: COMPARATIVE WILAYAH PUTRA VS PUTRI SUMMARY */}
          {!loadingAnalisis && analisis && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(['Putra', 'Putri'] as const).map((w) => {
                const mon = analisis.monitoringRingkasan[w];
                const pem = analisis.pembinaanAnalisis[w];
                const topAbsen = analisis.topAbsenPerWilayah[w];
                return (
                  <div
                    key={w}
                    className={`rounded-xl border border-slate-200 border-t-4 ${
                      w === 'Putri' ? 'border-t-rose-500' : 'border-t-sky-500'
                    } bg-white p-5 space-y-4`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className={`text-sm font-bold ${w === 'Putri' ? 'text-rose-800' : 'text-sky-800'}`}>
                          Ringkasan Eksekutif Wilayah {w}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono-num">
                          {pem.totalSantri} santri terdaftar · {pem.santriDibina} santri terbina ({pem.totalCatatan} catatan)
                        </p>
                      </div>
                      <span className="font-mono-num text-xs font-semibold text-slate-700">
                        Net Poin: {pem.netPoin > 0 ? `+${pem.netPoin}` : pem.netPoin}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono-num">
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <div className="text-[10px] text-slate-500 font-sans">KBM Hari Ini</div>
                        <div className="font-bold text-slate-900">
                          {mon.diisiKbm}/{mon.totalJadwalKbm}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <div className="text-[10px] text-slate-500 font-sans">Kamar Hari Ini</div>
                        <div className="font-bold text-slate-900">
                          {mon.diisiKamar}/{mon.totalKamar}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2.5">
                        <div className="text-[10px] text-slate-500 font-sans">Ibadah Wajib</div>
                        <div className="font-bold text-emerald-700">{pem.persenSholatWajib}%</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-800 mb-2">
                        Santri Ketidakhadiran Tertinggi (Wilayah {w})
                      </div>
                      {topAbsen.length === 0 ? (
                        <p className="text-xs text-slate-500">Belum ada catatan sakit/izin/alfa.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-100">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-2.5 py-1.5 font-semibold">Santri</th>
                                <th className="px-2 py-1.5 font-semibold">Kelas</th>
                                <th className="px-2 py-1.5 text-right font-semibold">S/I/A</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {topAbsen.slice(0, 5).map((st) => (
                                <tr key={st.nama}>
                                  <td className="px-2.5 py-1.5 font-semibold text-slate-800">{st.nama}</td>
                                  <td className="px-2.5 py-1.5 text-slate-500">{st.kelas}</td>
                                  <td className="px-2.5 py-1.5 text-right font-mono-num text-rose-700 font-semibold">
                                    {st.S}/{st.I}/{st.A} ({st.total})
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* VIEW 3: PUSAT UNDUH (PDF & CSV)                               */}
      {/* ============================================================= */}
      {subTab === 'download' && scopedOptions && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Pusat Unduh &amp; Pratinjau Laporan PDF / CSV</h3>
                {reportFilterMinimized && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {repWilayah === 'Semua' ? 'Semua Wilayah' : `Wilayah ${repWilayah}`} · {repJenis} · {repDivisi} · {repParam1 || 'Semua'} · {repSemester}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setReportFilterMinimized((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {reportFilterMinimized ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Buka Filter
                  </>
                ) : (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Minimize
                  </>
                )}
              </button>
            </div>
            {!reportFilterMinimized && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Wilayah</label>
                  <select
                    value={repWilayah}
                    onChange={(e) => setRepWilayah(e.target.value as WilayahFilter)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-semibold"
                  >
                    <option value="Semua">Semua Wilayah (Putra &amp; Putri)</option>
                    <option value="Putra">Wilayah Putra</option>
                    <option value="Putri">Wilayah Putri</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Laporan</label>
                  <select
                    value={repJenis}
                    onChange={(e) => setRepJenis(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
                  >
                    <option value="ringkasan_bulanan_wali">Ringkasan Bulanan Wali Kelas (Presensi &amp; Pembinaan)</option>
                    <option value="social">Rekap Total Kelas</option>
                    <option value="matrix">Detail per Mapel (Matriks)</option>
                    <option value="individu">Detail Individu (Santri)</option>
                    <option value="susulan_ujian">Daftar Susulan Ujian</option>
                    <option value="blacklist">Daftar Hitam (Top 25 Absen)</option>
                    <option value="guru_alpha">Guru Belum Presensi</option>
                    <option value="rekap_musyrif">Rekap Wali Asrama</option>
                    <option value="penanganan_khusus">Siswa Perlu Penanganan (Terpadu)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Divisi</label>
                  <select
                    value={repDivisi}
                    onChange={(e) => setRepDivisi(e.target.value)}
                    disabled={repJenis === 'ringkasan_bulanan_wali'}
                    className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="Akademik">Akademik</option>
                    <option value="Asrama">Asrama</option>
                    <option value="Al-Quran">Al-Qur&apos;an</option>
                    <option value="Terpadu">Semua Bidang (Terpadu)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Grup / Kelas</label>
                  {repJenis === 'penanganan_khusus' || repJenis === 'guru_alpha' ? (
                    <input
                      type="text"
                      readOnly
                      value="Semua Data"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-slate-100 px-2.5 text-xs text-slate-500"
                    />
                  ) : repJenis === 'blacklist' && (repDivisi === 'Akademik' || repDivisi === 'Terpadu') ? (
                    <select
                      value={repParam1}
                      onChange={(e) => setRepParam1(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
                    >
                      <option value="KELAS 10">Angkatan Kelas 10</option>
                      <option value="KELAS 11">Angkatan Kelas 11</option>
                      <option value="KELAS 12">Angkatan Kelas 12</option>
                    </select>
                  ) : repJenis === 'rekap_musyrif' ? (
                    <select
                      value={repParam1}
                      onChange={(e) => setRepParam1(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
                    >
                      {scopedOptions.asrama.musyrif.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={repParam1}
                      onChange={(e) => setRepParam1(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
                    >
                      {(repJenis === 'susulan_ujian' || repJenis === 'ringkasan_bulanan_wali') && (
                        <option value="SEMUA">Semua Kelas</option>
                      )}
                      {(repDivisi === 'Asrama' && repJenis !== 'ringkasan_bulanan_wali'
                        ? scopedOptions.asrama.kamar
                        : repDivisi === 'Al-Quran' && repJenis !== 'ringkasan_bulanan_wali'
                        ? scopedOptions.alquran.kelompok
                        : scopedOptions.akademik.kelas
                      ).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {repJenis === 'individu' ? 'Nama Santri' : 'Filter Mapel'}
                  </label>
                  {repJenis === 'individu' ? (
                    <select
                      value={repParam2}
                      onChange={(e) => setRepParam2(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
                    >
                      {individuStudents.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={repParam2}
                      onChange={(e) => setRepParam2(e.target.value)}
                      disabled={repJenis !== 'matrix' || repDivisi !== 'Akademik'}
                      className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="SEMUA MAPEL">Semua Mapel</option>
                      {scopedOptions.akademik.mapel.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Periode</label>
                  <select
                    value={repSemester}
                    onChange={(e) => setRepSemester(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
                  >
                    <option value="Semua Semester">Semua Semester (Ganjil &amp; Genap)</option>
                    <option value="Ganjil (Jul-Des)">Ganjil (Jul - Des)</option>
                    <option value="Genap (Jan-Jun)">Genap (Jan - Jun)</option>
                    {NAMA_BULAN_INDO.map((bln, i) => (
                      <option key={bln} value={`Bulan ${i + 1}`}>
                        Bulan {bln}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={fetchReport}
                disabled={loadingReport}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                {loadingReport ? 'Memuat...' : 'Tampilkan Pratinjau'}
              </button>
              <button
                type="button"
                onClick={handleDownloadReportPdfDirect}
                disabled={loadingReport}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <FileText className="h-3.5 w-3.5" />
                Unduh PDF
              </button>
              <button
                type="button"
                onClick={handlePrintPdf}
                disabled={loadingReport}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak Dokumen
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={loadingReport}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh CSV (Excel)
              </button>
            </div>
          </div>

          {reportResult && reportResult.laporan.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-700">
                Pratinjau Data Laporan ({Math.max(0, reportResult.laporan.length - 1)} baris)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <tr>
                      {reportResult.laporan[0].map((th, idx) => (
                        <th key={idx} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                          {th}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportResult.laporan.slice(1).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2.5 ${cIdx === 0 ? 'font-mono-num text-slate-500' : 'text-slate-800'}`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
