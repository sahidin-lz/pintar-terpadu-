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
} from 'lucide-react';
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
import { loadSubTab, saveSubTab } from '../utils/sessionPersistence';

interface Props {
  options: ReportOptions | null;
  stats?: DashboardStats | null;
  initialStats?: DashboardStats | null;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

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
      const res = await fetch(`/api/monitoring?tanggal=${encodeURIComponent(tgl)}`);
      const data = await res.json();
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
      const [resAn, resSt] = await Promise.all([
        fetch(`/api/analisis?tanggal=${encodeURIComponent(tgl)}`),
        fetch(`/api/stats?wilayah=${encodeURIComponent(wilayah)}`),
      ]);
      const dataAn = await resAn.json();
      const dataSt = await resSt.json();
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
      const res = await fetch(`/api/laporan/ringkasan-bulanan?${qs.toString()}`);
      const data = await res.json();
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

  // Filtered student rows in Tab 2
  const filteredStudentRows = useMemo(() => {
    if (!monthlyReport) return [];
    let list = monthlyReport.studentRows;
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
    return list;
  }, [monthlyReport, studentSearch, studentQuickFilter]);

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
    const klsMap = new Map<string, MonitoringCell[]>();
    items.forEach((it) => {
      if (!klsMap.has(it.kelas)) klsMap.set(it.kelas, []);
      klsMap.get(it.kelas)!.push(it);
    });

    if (klsMap.size === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h4>
          <p className="mt-2 text-xs text-slate-500">Tidak ada jadwal aktif pada hari ini.</p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</h4>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from(klsMap.entries()).map(([kls, cells]) => (
            <div key={kls} className="p-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="w-36 shrink-0 font-semibold text-xs text-slate-900">{kls}</div>
              <div className="flex flex-wrap gap-2">
                {cells.map((c, idx) => {
                  const style =
                    c.status === 'HADIR'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : c.status === 'GURU_ABSEN'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900';
                  return (
                    <div key={idx} className={`rounded-lg border px-3 py-2 text-xs ${style}`}>
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
                      <div className="mt-0.5 text-[11px] opacity-80">{c.guru}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
                const active = monGender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setMonGender(g)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      active
                        ? g === 'putri'
                          ? 'border-rose-300 bg-rose-50/50'
                          : 'border-sky-300 bg-sky-50/50'
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
                        <div className="text-[10px] text-slate-500">Akademik</div>
                        <div className="font-bold text-slate-900">
                          {akHadir}/{akCells.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <div className="text-[10px] text-slate-500">Al-Qur&apos;an</div>
                        <div className="font-bold text-slate-900">
                          {qHadir}/{qCells.length}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                        <div className="text-[10px] text-slate-500">Kamar Asrama</div>
                        <div className="font-bold text-slate-900">
                          {asrHadir}/{asr.length}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                {(['putri', 'putra'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setMonGender(g)}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-semibold ${
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
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
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
              <span className="ml-2 text-xs font-semibold text-slate-600">
                {getNamaHariFromDate(tglMonitoring)}
              </span>
            </div>
          </div>

          {loadingMon || !monData ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-200" />
          ) : monDiv === 'asrama' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {monData[monGender].asrama.map((rm) => (
                <div key={rm.kamar} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">{rm.kamar}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{rm.musyrif}</div>
                  <div className="mt-3 text-xs font-semibold">
                    {rm.status === 'HADIR' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Sudah Diisi
                      </span>
                    ) : rm.status === 'GURU_ABSEN' ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <UserX className="h-3.5 w-3.5" />
                        Musyrif Absen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700">
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
              <div className="rounded-xl border border-slate-200 bg-white p-4">
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
              <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Wali:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[160px]">
                    {monthlyReport.meta.waliKelas}
                  </span>
                </div>
              </div>

              {/* Card 3: Ketaatan Sholat Wajib & Ibadah Sunnah */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-center font-mono-num text-[10px]">
                  <div className="rounded-md bg-slate-100 py-1 text-slate-700">
                    Mandiri: <strong>{monthlyReport.pembinaanSummary.prioritasCounts.Mandiri}</strong>
                  </div>
                  <div className="rounded-md bg-slate-100 py-1 text-slate-700">
                    Rutin: <strong>{monthlyReport.pembinaanSummary.prioritasCounts.Rutin}</strong>
                  </div>
                  <div className="rounded-md bg-rose-50 py-1 text-rose-800">
                    Intensif: <strong>{monthlyReport.pembinaanSummary.prioritasCounts.Intensif}</strong>
                  </div>
                </div>
              </div>

              {/* Card 4: Poin Karakter & Status Tindak Lanjut */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">Poin &amp; Tindak Lanjut</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono-num text-[11px] font-semibold text-slate-700">
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

          {/* SECTION 2: VISUAL ANALYTICS DASHBOARD (DIVISI PRESENSI & KATEGORI PEMBINAAN) */}
          {monthlyReport && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left: Presensi per Divisi */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Analisis Kehadiran per Divisi ({monthlyReport.meta.kelas})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Perbandingan capaian kehadiran Akademik (KBM), Al-Qur&apos;an, Asrama, dan Ujian.
                    </p>
                  </div>
                  <BarChart3 className="h-4 w-4 text-teal-700" />
                </div>

                <div className="space-y-3.5">
                  {(
                    [
                      { key: 'Akademik', label: 'Akademik (KBM Kelas)', data: monthlyReport.presensiSummary.byDivisi.Akademik },
                      { key: 'AlQuran', label: "Al-Qur'an / Halaqah", data: monthlyReport.presensiSummary.byDivisi.AlQuran },
                      { key: 'Asrama', label: 'Asrama / Kesantrian', data: monthlyReport.presensiSummary.byDivisi.Asrama },
                      { key: 'Ujian', label: 'Ujian Sekolah', data: monthlyReport.presensiSummary.byDivisi.Ujian },
                    ] as const
                  ).map((row) => {
                    const ht = row.data.H + row.data.T;
                    const total = Math.max(1, row.data.total);
                    const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
                    return (
                      <div key={row.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{row.label}</span>
                          <span className="font-mono-num text-slate-600">
                            <strong>{row.data.persenHadir}% Hadir</strong> ({ht}/{row.data.total}) · S:{row.data.S} · I:{row.data.I} · A:{row.data.A}
                          </span>
                        </div>
                        <div className="flex h-3.5 w-full overflow-hidden rounded-md bg-slate-100">
                          <div style={{ width: pct(ht) }} className="bg-emerald-600" title={`Hadir+Telat: ${ht}`} />
                          <div style={{ width: pct(row.data.S) }} className="bg-amber-500" title={`Sakit: ${row.data.S}`} />
                          <div style={{ width: pct(row.data.I) }} className="bg-sky-500" title={`Izin: ${row.data.I}`} />
                          <div style={{ width: pct(row.data.A) }} className="bg-rose-600" title={`Alfa: ${row.data.A}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Distribusi Kategori Pembinaan */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Distribusi Kategori Pembinaan &amp; Karakter
                    </h3>
                    <p className="text-xs text-slate-500">
                      Proporsi catatan pembinaan berdasarkan fokus pengawasan Wali Kelas &amp; Musyrif/ah.
                    </p>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-teal-700" />
                </div>

                <div className="space-y-3">
                  {monthlyReport.pembinaanSummary.kategoriCounts.map((kat) => {
                    const totalCat = Math.max(1, monthlyReport.pembinaanSummary.totalCatatan);
                    const pctNum = Math.round((kat.count / totalCat) * 100);
                    const barColor =
                      kat.kategori === 'Kedisiplinan'
                        ? 'bg-rose-600'
                        : kat.kategori === 'Prestasi'
                        ? 'bg-emerald-600'
                        : kat.kategori === 'Kesehatan'
                        ? 'bg-amber-500'
                        : kat.kategori === 'Pemantauan Ibadah'
                        ? 'bg-teal-600'
                        : 'bg-sky-600';
                    return (
                      <div key={kat.kategori} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">{kat.kategori}</span>
                          <span className="font-mono-num text-slate-600">
                            {kat.count} catatan ({pctNum}%)
                          </span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-md bg-slate-100">
                          <div style={{ width: `${pctNum}%` }} className={`h-full ${barColor}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: MATRIKS PERBANDINGAN ANTAR KELAS (DASBOR ANALISIS KELAS) */}
          {monthlyReport && monthlyReport.classComparison.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Matriks Analisis Perbandingan Antar Kelas ({monthlyReport.classComparison.length} Kelas)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Klik tombol <strong>Pilih Kelas</strong> untuk memfilter tabel santri di bawah atau <strong>Unduh PDF</strong> untuk langsung mengunduh laporan bulanan Wali Kelas.
                  </p>
                </div>
                {statsKelas !== 'SEMUA' && (
                  <button
                    type="button"
                    onClick={() => setStatsKelas('SEMUA')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                  >
                    Tampilkan Semua Kelas
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Kelas</th>
                      <th className="px-3 py-3 font-semibold">Wilayah</th>
                      <th className="px-3 py-3 font-semibold">Wali Kelas</th>
                      <th className="px-3 py-3 text-right font-semibold">Santri</th>
                      <th className="px-3 py-3 text-right font-semibold">% Hadir</th>
                      <th className="px-3 py-3 text-right font-semibold">Cakupan Binaan</th>
                      <th className="px-3 py-3 text-right font-semibold">Sholat Wajib</th>
                      <th className="px-3 py-3 text-right font-semibold">Net Poin</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi Wali Kelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono-num">
                    {monthlyReport.classComparison.map((c) => {
                      const isSelected = statsKelas === c.kelas;
                      return (
                        <tr
                          key={c.kelas}
                          className={isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'}
                        >
                          <td className="px-4 py-2.5 font-sans font-bold text-slate-900">{c.kelas}</td>
                          <td className="px-3 py-2.5 font-sans">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                c.gender === 'Putri'
                                  ? 'bg-rose-50 text-rose-800'
                                  : 'bg-sky-50 text-sky-800'
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
                            <span className="font-bold text-emerald-700">{c.persenHadir}%</span>
                            <span className="ml-1 text-[11px] text-slate-400">
                              ({c.totalHadir}/{c.totalHadir + c.totalAbsen})
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-semibold text-teal-800">{c.cakupanPembinaanPct}%</span>
                            <span className="ml-1 text-[11px] text-slate-400">
                              ({c.santriDibina}/{c.totalSantri})
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                            {c.wajibPct}%
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-bold ${
                              c.netPoin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {c.netPoin > 0 ? `+${c.netPoin}` : c.netPoin}
                          </td>
                          <td className="px-4 py-2.5 text-right font-sans">
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

          {/* SECTION 4: TABEL RINGKASAN BULANAN WALI KELAS PER SANTRI (PRESENSI + PEMBINAAN) */}
          {monthlyReport && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Tabel Ringkasan Bulanan Wali Kelas: Presensi &amp; Pembinaan Santri ({filteredStudentRows.length} Santri)
                  </h3>
                  <p className="text-xs text-slate-500">
                    {monthlyReport.meta.bulanLabel} · Kelas: <strong>{monthlyReport.meta.kelas}</strong> · Wali Kelas: <strong>{monthlyReport.meta.waliKelas}</strong>
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

              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">No</th>
                      <th className="px-3 py-2.5 font-semibold">NIS</th>
                      <th className="px-3 py-2.5 font-semibold">Nama Santri</th>
                      <th className="px-3 py-2.5 font-semibold">Kelas &amp; Kamar</th>
                      <th className="px-3 py-2.5 text-right font-semibold">H+T</th>
                      <th className="px-3 py-2.5 text-right font-semibold">S/I/A</th>
                      <th className="px-3 py-2.5 text-right font-semibold">% Hadir</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Binaan</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Wajib %</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Sunnah %</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Poin</th>
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
                      filteredStudentRows.map((st, idx) => (
                        <tr key={st.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2.5 text-slate-600">{st.nis}</td>
                          <td className="px-3 py-2.5 font-sans font-semibold text-slate-900">
                            <div>{st.nama}</div>
                            <div className="text-[10px] font-normal text-slate-500">
                              Wali: {st.waliKelas}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            <div className="font-semibold text-slate-800">{st.kelas}</div>
                            <div className="text-[10px] text-slate-500">{st.kamar}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                            {st.presensi.H + st.presensi.T}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600">
                            {st.presensi.S}/{st.presensi.I}/
                            <span className={st.presensi.A > 0 ? 'font-bold text-rose-700' : ''}>
                              {st.presensi.A}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                            {st.presensi.persenHadir}%
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-teal-800">
                            {st.pembinaan.totalCatatan}x
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
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
                                    ? 'bg-rose-50 text-rose-800'
                                    : st.pembinaan.statusTerakhir === 'Proses'
                                    ? 'bg-amber-50 text-amber-800'
                                    : st.pembinaan.statusTerakhir === 'Selesai'
                                    ? 'bg-emerald-50 text-emerald-800'
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
                      ))
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
                  <div key={w} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
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
