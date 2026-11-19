import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookCheck,
  BookMarked,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Home,
  Monitor,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AnalyticsTerpadu,
  PembinaanJalur,
  PresensiType,
  SystemCounts,
  TeacherPublic,
  WilayahFilter,
} from '../types';
import {
  downloadAnalyticsDashboardPdf,
  formatTanggalIndo,
  getTodayDateStr,
} from '../utils/exportHelpers';
import { loadSubTab, saveSubTab } from '../utils/sessionPersistence';

export type DashboardTargetModule =
  | 'dashboard'
  | 'presensi'
  | 'walikelas'
  | 'labkom'
  | 'jadwal'
  | 'akunguru'
  | 'ujian'
  | 'piket'
  | 'monitoring'
  | 'parentportal'
  | 'import'
  | 'quota';

interface DasborTerpaduModuleProps {
  currentUser: TeacherPublic | null;
  counts: SystemCounts | null;
  onNavigate: (
    mod: DashboardTargetModule,
    opts?: { presensiJenis?: PresensiType; pembinaanJalur?: PembinaanJalur; wilayah?: WilayahFilter }
  ) => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DasborTerpaduModule: React.FC<DasborTerpaduModuleProps> = ({
  currentUser,
  counts,
  onNavigate,
  notify,
}) => {
  const [wilayah, setWilayah] = useState<WilayahFilter>(() =>
    loadSubTab('pintar_dasbor_wilayah_v1', ['Semua', 'Putra', 'Putri'] as const, 'Semua')
  );
  const [tanggal, setTanggal] = useState<string>(getTodayDateStr());
  const [analisis, setAnalisis] = useState<AnalyticsTerpadu | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    saveSubTab('pintar_dasbor_wilayah_v1', wilayah);
  }, [wilayah]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analisis?tanggal=${encodeURIComponent(tanggal)}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as AnalyticsTerpadu;
      setAnalisis(data);
    } catch {
      notify('Gagal memuat ringkasan dasbor terpadu.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tanggal, notify]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const presensiChartData = useMemo(() => {
    if (!analisis) return [];
    const pa = analisis.divisiByWilayah.Putra;
    const pi = analisis.divisiByWilayah.Putri;
    return [
      {
        komponen: 'Asrama',
        Putra: pa.Asrama.persenHadir,
        Putri: pi.Asrama.persenHadir,
        SesiPutra: pa.Asrama.total,
        SesiPutri: pi.Asrama.total,
      },
      {
        komponen: "Al-Qur'an",
        Putra: pa.AlQuran.persenHadir,
        Putri: pi.AlQuran.persenHadir,
        SesiPutra: pa.AlQuran.total,
        SesiPutri: pi.AlQuran.total,
      },
      {
        komponen: 'Akademik',
        Putra: pa.Belajar.persenHadir,
        Putri: pi.Belajar.persenHadir,
        SesiPutra: pa.Belajar.total,
        SesiPutri: pi.Belajar.total,
      },
    ];
  }, [analisis]);

  const pembinaanTrackChartData = useMemo(() => {
    if (!analisis) return [];
    const pa = analisis.pembinaanAnalisis.Putra.jalurCounts || {
      waliKelasMingguan: 0,
      guruWaliTentatif: 0,
      roomVisitAsrama: 0,
    };
    const pi = analisis.pembinaanAnalisis.Putri.jalurCounts || {
      waliKelasMingguan: 0,
      guruWaliTentatif: 0,
      roomVisitAsrama: 0,
    };
    return [
      {
        jalur: 'Wali Kelas (Mingguan)',
        Putra: pa.waliKelasMingguan,
        Putri: pi.waliKelasMingguan,
      },
      {
        jalur: 'Guru Wali (Tentatif)',
        Putra: pa.guruWaliTentatif,
        Putri: pi.guruWaliTentatif,
      },
      {
        jalur: 'Room Visit (Tentatif)',
        Putra: pa.roomVisitAsrama,
        Putri: pi.roomVisitAsrama,
      },
    ];
  }, [analisis]);

  const labkomChartData = useMemo(() => {
    return analisis?.labkomRingkasan?.byLab || [];
  }, [analisis]);

  const showPutra = wilayah === 'Semua' || wilayah === 'Putra';
  const showPutri = wilayah === 'Semua' || wilayah === 'Putri';

  const activePembinaan = analisis?.pembinaanAnalisis[wilayah];
  const activeJalurCounts = activePembinaan?.jalurCounts || {
    waliKelasMingguan: 0,
    guruWaliTentatif: 0,
    roomVisitAsrama: 0,
  };

  const putraRooms = analisis?.waliAsramaSummary?.Putra || [];
  const putriRooms = analisis?.waliAsramaSummary?.Putri || [];
  const putraRoomsFilled = putraRooms.filter((r) => r.filledToday).length;
  const putriRoomsFilled = putriRooms.filter((r) => r.filledToday).length;

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
              Dasbor Terpadu SIM PINTAR · Wilayah Putra &amp; Putri Terpisah
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Pusat kendali 3 jalur <b>Absen Harian</b> (Asrama, Al-Qur&apos;an, Akademik), 3 jalur{' '}
              <b>Pembinaan</b> (Wali Kelas Mingguan, Guru Wali Tentatif, Room Visit Asrama Tentatif), dan{' '}
              <b>Peminjaman Labkom &amp; Ruang SMA</b>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
              {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWilayah(w)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    wilayah === w
                      ? w === 'Putri'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : w === 'Putra'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {w === 'Semua' ? 'Semua (Terpisah)' : `Wil. ${w}`}
                </button>
              ))}
            </div>

            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold font-mono-num text-slate-900 focus:border-teal-600 focus:outline-none"
            />

            <button
              type="button"
              onClick={loadAnalytics}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </button>

            <button
              type="button"
              disabled={!analisis || loading}
              onClick={() => {
                if (!analisis) return;
                downloadAnalyticsDashboardPdf(analisis, null, wilayah);
                notify('Laporan PDF Dasbor Terpadu berhasil diunduh.', 'success');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              Unduh PDF Dasbor
            </button>
          </div>
        </div>

        {/* Strict Wilayah Separation Summary Row */}
        <div className={`grid grid-cols-1 gap-4 ${showPutra && showPutri ? 'lg:grid-cols-2' : ''}`}>
          {showPutra && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-sky-200/70 pb-2.5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-900">
                    Wilayah Putra (Terisolasi)
                  </div>
                  <div className="text-[11px] text-sky-800/80 mt-0.5">
                    Data santri, kamar asrama, jadwal KBM, &amp; pembinaan khusus Putra
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-sky-900">
                  {counts?.byWilayah?.Putra.students ?? analisis?.pembinaanAnalisis.Putra.totalSantri ?? 0} Santri
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">Kamar &amp; Wali Asrama</div>
                  <div className="font-mono-num text-base font-bold text-slate-900">
                    {putraRoomsFilled}/{putraRooms.length || counts?.byWilayah?.Putra.rooms || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">Terisi {formatTanggalIndo(tanggal)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">KBM / Halaqah Hari Ini</div>
                  <div className="font-mono-num text-base font-bold text-slate-900">
                    {analisis?.monitoringRingkasan.Putra.diisiKbm ?? 0}/
                    {analisis?.monitoringRingkasan.Putra.totalJadwalKbm ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">Jadwal berjalan</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Catatan Pembinaan</div>
                  <div className="font-mono-num text-base font-bold text-violet-700">
                    {analisis?.pembinaanAnalisis.Putra.totalCatatan ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Wajib {analisis?.pembinaanAnalisis.Putra.persenSholatWajib ?? 0}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Peminjaman Labkom</div>
                  <div className="font-mono-num text-base font-bold text-blue-700">
                    {analisis?.labkomRingkasan?.putraTotal ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Hari ini: {analisis?.labkomRingkasan?.putraHariIni ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showPutri && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-rose-200/70 pb-2.5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-900">
                    Wilayah Putri (Terisolasi)
                  </div>
                  <div className="text-[11px] text-rose-800/80 mt-0.5">
                    Data santri, kamar asrama, jadwal KBM, &amp; pembinaan khusus Putri
                  </div>
                </div>
                <span className="font-mono-num text-xs font-bold text-rose-900">
                  {counts?.byWilayah?.Putri.students ?? analisis?.pembinaanAnalisis.Putri.totalSantri ?? 0} Santri
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">Kamar &amp; Wali Asrama</div>
                  <div className="font-mono-num text-base font-bold text-slate-900">
                    {putriRoomsFilled}/{putriRooms.length || counts?.byWilayah?.Putri.rooms || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">Terisi {formatTanggalIndo(tanggal)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">KBM / Halaqah Hari Ini</div>
                  <div className="font-mono-num text-base font-bold text-slate-900">
                    {analisis?.monitoringRingkasan.Putri.diisiKbm ?? 0}/
                    {analisis?.monitoringRingkasan.Putri.totalJadwalKbm ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">Jadwal berjalan</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Catatan Pembinaan</div>
                  <div className="font-mono-num text-base font-bold text-violet-700">
                    {analisis?.pembinaanAnalisis.Putri.totalCatatan ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Wajib {analisis?.pembinaanAnalisis.Putri.persenSholatWajib ?? 0}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Peminjaman Labkom</div>
                  <div className="font-mono-num text-base font-bold text-blue-700">
                    {analisis?.labkomRingkasan?.putriTotal ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Hari ini: {analisis?.labkomRingkasan?.putriHariIni ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1 & 2: ABSEN HARIAN & PEMBINAAN SANTRI */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        {/* Komponen 1: Absen Harian (3 Jalur) */}
        <div className="xl:col-span-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Komponen Absen Harian (Asrama · Al-Qur&apos;an · Akademik)
              </h3>
              <p className="text-xs text-slate-500">
                Capaian kehadiran (%) per jalur presensi yang dipisahkan antara Putra dan Putri.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('presensi')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
            >
              <BookCheck className="h-3.5 w-3.5" />
              Buka Input Presensi
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  onNavigate('presensi', {
                    presensiJenis: 'Asrama',
                    wilayah: wilayah === 'Semua' ? undefined : wilayah,
                  })
                }
                className="text-left rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
              >
                <div className="flex items-center justify-between text-indigo-700">
                  <span className="text-xs font-bold">Absen Asrama</span>
                  <Home className="h-3.5 w-3.5" />
                </div>
                <div className="mt-1.5 font-mono-num text-xs text-slate-700">
                  {showPutra && (
                    <div>
                      Putra: <b>{analisis?.divisiByWilayah.Putra.Asrama.persenHadir ?? 100}%</b> (
                      {analisis?.divisiByWilayah.Putra.Asrama.total ?? 0} log)
                    </div>
                  )}
                  {showPutri && (
                    <div>
                      Putri: <b>{analisis?.divisiByWilayah.Putri.Asrama.persenHadir ?? 100}%</b> (
                      {analisis?.divisiByWilayah.Putri.Asrama.total ?? 0} log)
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[11px] font-semibold text-indigo-700">Wali Asrama per Kamar →</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('presensi', {
                    presensiJenis: 'Al-Quran',
                    wilayah: wilayah === 'Semua' ? undefined : wilayah,
                  })
                }
                className="text-left rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors"
              >
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-xs font-bold">Absen Al-Qur&apos;an</span>
                  <BookMarked className="h-3.5 w-3.5" />
                </div>
                <div className="mt-1.5 font-mono-num text-xs text-slate-700">
                  {showPutra && (
                    <div>
                      Putra: <b>{analisis?.divisiByWilayah.Putra.AlQuran.persenHadir ?? 100}%</b> (
                      {analisis?.divisiByWilayah.Putra.AlQuran.total ?? 0} log)
                    </div>
                  )}
                  {showPutri && (
                    <div>
                      Putri: <b>{analisis?.divisiByWilayah.Putri.AlQuran.persenHadir ?? 100}%</b> (
                      {analisis?.divisiByWilayah.Putri.AlQuran.total ?? 0} log)
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[11px] font-semibold text-emerald-700">Halaqah &amp; Setoran →</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('presensi', {
                    presensiJenis: 'Belajar',
                    wilayah: wilayah === 'Semua' ? undefined : wilayah,
                  })
                }
                className="text-left rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:border-sky-300 hover:bg-sky-50/50 transition-colors"
              >
                <div className="flex items-center justify-between text-sky-700">
                  <span className="text-xs font-bold">Absen Akademik</span>
                  <BookOpen className="h-3.5 w-3.5" />
                </div>
                <div className="mt-1.5 font-mono-num text-xs text-slate-700">
                  {showPutra && (
                    <div>
                      Putra: <b>{analisis?.divisiByWilayah.Putra.Belajar.persenHadir ?? 100}%</b> (
                      {analisis?.divisiByWilayah.Putra.Belajar.total ?? 0} log)
                    </div>
                  )}
                  {showPutri && (
                    <div>
                      Putri: <b>{analisis?.divisiByWilayah.Putri.Belajar.persenHadir ?? 100}%</b> (
                      {analisis?.divisiByWilayah.Putri.Belajar.total ?? 0} log)
                    </div>
                  )}
                </div>
                <div className="mt-2 text-[11px] font-semibold text-sky-700">KBM Kelas per JP →</div>
              </button>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={presensiChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="komponen" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value ?? 0}%`, 'Kehadiran']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {showPutra && <Bar dataKey="Putra" name="Wilayah Putra (%)" fill="#0284c7" radius={[4, 4, 0, 0]} />}
                  {showPutri && <Bar dataKey="Putri" name="Wilayah Putri (%)" fill="#e11d48" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Komponen 2: Pembinaan Santri (Mingguan & Tentatif) */}
        <div className="xl:col-span-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Komponen Pembinaan Santri (Mingguan &amp; Tentatif)
              </h3>
              <p className="text-xs text-slate-500">
                Wali Kelas berjadwal <b>Mingguan</b> · Guru Wali &amp; Room Visit Asrama berjadwal <b>Tentatif</b>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('walikelas')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Buka Input Pembinaan
            </button>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() =>
                  onNavigate('walikelas', {
                    pembinaanJalur: 'Wali Kelas',
                    wilayah: wilayah === 'Semua' ? undefined : wilayah,
                  })
                }
                className="text-left rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:border-violet-300 hover:bg-violet-50/50 transition-colors"
              >
                <div className="text-xs font-bold text-violet-900">Pembinaan Wali Kelas</div>
                <div className="text-[11px] text-violet-700 font-semibold mt-0.5">Jadwal: Mingguan (Rutin)</div>
                <div className="mt-2 font-mono-num text-xl font-bold text-slate-900">
                  {activeJalurCounts.waliKelasMingguan}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-violet-700">Input Klasikal / Individu →</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('walikelas', {
                    pembinaanJalur: 'Guru Wali',
                    wilayah: wilayah === 'Semua' ? undefined : wilayah,
                  })
                }
                className="text-left rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
              >
                <div className="text-xs font-bold text-amber-900">Pembinaan Guru Wali</div>
                <div className="text-[11px] text-amber-700 font-semibold mt-0.5">Jadwal: Tentatif / Kesempatan</div>
                <div className="mt-2 font-mono-num text-xl font-bold text-slate-900">
                  {activeJalurCounts.guruWaliTentatif}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-amber-700">Pendampingan Personal →</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onNavigate('walikelas', {
                    pembinaanJalur: 'Room Visit Asrama',
                    wilayah: wilayah === 'Semua' ? undefined : wilayah,
                  })
                }
                className="text-left rounded-lg border border-slate-200 bg-slate-50/70 p-3 hover:border-teal-300 hover:bg-teal-50/50 transition-colors"
              >
                <div className="text-xs font-bold text-teal-900">Room Visit Asrama</div>
                <div className="text-[11px] text-teal-700 font-semibold mt-0.5">Jadwal: Tentatif · Wali Asrama</div>
                <div className="mt-2 font-mono-num text-xl font-bold text-slate-900">
                  {activeJalurCounts.roomVisitAsrama}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-teal-700">Kunjungan Kamar →</div>
              </button>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={pembinaanTrackChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="jalur" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {showPutra && <Bar dataKey="Putra" name="Wilayah Putra (Catatan)" fill="#0284c7" radius={[4, 4, 0, 0]} />}
                  {showPutri && <Bar dataKey="Putri" name="Wilayah Putri (Catatan)" fill="#e11d48" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: PEMINJAMAN LABKOM & MATRIKS WALI ASRAMA PER KAMAR */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
        {/* Komponen 3: Peminjaman Labkom & Ruang SMA */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Peminjaman Labkom &amp; Ruang SMA</h3>
              <p className="text-xs text-slate-500">
                Pemakaian laboratorium komputer &amp; ruang belajar terpisah Kampus Putra vs Putri.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('labkom')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Monitor className="h-3.5 w-3.5" />
              Kelola Labkom
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
                <div className="text-slate-600 font-medium">Booking Kampus Putra</div>
                <div className="mt-1 font-mono-num text-2xl font-bold text-sky-900">
                  {analisis?.labkomRingkasan?.putraTotal ?? 0}
                </div>
                <div className="text-[11px] text-sky-700 font-mono-num">
                  Hari ini: {analisis?.labkomRingkasan?.putraHariIni ?? 0} sesi
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                <div className="text-slate-600 font-medium">Booking Kampus Putri</div>
                <div className="mt-1 font-mono-num text-2xl font-bold text-rose-900">
                  {analisis?.labkomRingkasan?.putriTotal ?? 0}
                </div>
                <div className="text-[11px] text-rose-700 font-mono-num">
                  Hari ini: {analisis?.labkomRingkasan?.putriHariIni ?? 0} sesi
                </div>
              </div>
            </div>

            {labkomChartData.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center space-y-2">
                <Monitor className="h-6 w-6 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">
                  Data Peminjaman Labkom Saat Ini Kosong
                </div>
                <p className="text-[11px] text-slate-500">
                  Jadwal tetap, denah 40 PC, dan form peminjaman baru Putra/Putri siap digunakan di modul Labkom &amp; Ruang SMA.
                </p>
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={labkomChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="lab" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {showPutra && <Bar dataKey="putra" name="Kampus Putra" fill="#0284c7" radius={[4, 4, 0, 0]} />}
                    {showPutri && <Bar dataKey="putri" name="Kampus Putri" fill="#e11d48" radius={[4, 4, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Matriks Wali Asrama & Kamar Berbeda-Beda (Putra & Putri Terpisah) */}
        <div className="xl:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Penugasan Wali Asrama per Kamar (Berbeda per Kamar · Putra &amp; Putri Terpisah)
              </h3>
              <p className="text-xs text-slate-500">
                Setiap asrama/kamar dikelola oleh Wali Asrama (Musyrif / Musyrifah) masing-masing untuk absen asrama &amp; room visit.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('monitoring')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Monitoring Live
            </button>
          </div>

          <div className={`grid grid-cols-1 divide-y divide-slate-200 ${showPutra && showPutri ? 'md:grid-cols-2 md:divide-y-0 md:divide-x' : ''}`}>
            {showPutra && (
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sky-900">Asrama Wilayah Putra ({putraRooms.length} Kamar)</span>
                  <span className="font-mono-num font-semibold text-slate-600">
                    {putraRoomsFilled}/{putraRooms.length} terisi
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {putraRooms.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">Belum ada kamar Putra terdaftar.</div>
                  ) : (
                    putraRooms.map((rm) => (
                      <div key={`putra-${rm.kamar}`} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{rm.kamar}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            Wali Asrama: <span className="font-medium text-slate-700">{rm.waliAsrama}</span> ·{' '}
                            <span className="font-mono-num">{rm.studentCount} santri</span>
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ml-2 ${
                            rm.filledToday ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {rm.filledToday ? 'Sudah' : 'Belum'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {showPutri && (
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-900">Asrama Wilayah Putri ({putriRooms.length} Kamar)</span>
                  <span className="font-mono-num font-semibold text-slate-600">
                    {putriRoomsFilled}/{putriRooms.length} terisi
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
                  {putriRooms.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">Belum ada kamar Putri terdaftar.</div>
                  ) : (
                    putriRooms.map((rm) => (
                      <div key={`putri-${rm.kamar}`} className="flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{rm.kamar}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            Wali Asrama: <span className="font-medium text-slate-700">{rm.waliAsrama}</span> ·{' '}
                            <span className="font-mono-num">{rm.studentCount} santri</span>
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-semibold shrink-0 ml-2 ${
                            rm.filledToday ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {rm.filledToday ? 'Sudah' : 'Belum'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: PETA TUGAS, PERAN & DASBOR MASING-MASING KOMPONEN */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Peta Peran, Tugas &amp; Dasbor Masing-Masing Komponen
            </h3>
            <p className="text-xs text-slate-500">
              {currentUser
                ? `Masuk sebagai ${currentUser.nama} (${currentUser.peran} · Wilayah ${currentUser.genderScope})`
                : 'Pilih peran atau modul tugas di bawah untuk langsung masuk ke dasbor & halaman kerjanya.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('akunguru')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <UserCheck className="h-3.5 w-3.5 text-teal-700" />
            Buka Dasbor Peran Pribadi
          </button>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 lg:grid-cols-3 md:divide-y-0 md:gap-px md:bg-slate-200">
          {[
            {
              title: 'Wali Asrama (Musyrif / Musyrifah)',
              jadwal: 'Harian Asrama · Room Visit Tentatif',
              tugas: 'Mengisi absen kamar asrama berbeda per pembina serta mencatat kunjungan kamar (Room Visit) dan pemantauan ibadah.',
              cta: 'Input Absen Asrama',
              icon: Home,
              action: () => onNavigate('presensi', { presensiJenis: 'Asrama' }),
            },
            {
              title: 'Wali Kelas',
              jadwal: 'Pembinaan Mingguan (Rutin)',
              tugas: 'Melakukan pembinaan klasikal/individu pekanan per kelas, memantau portofolio ibadah 8 checklist, dan analisis kelas.',
              cta: 'Buka Pembinaan Mingguan',
              icon: ShieldCheck,
              action: () => onNavigate('walikelas', { pembinaanJalur: 'Wali Kelas' }),
            },
            {
              title: 'Guru Wali',
              jadwal: 'Pembinaan Tentatif / Kesempatan',
              tugas: 'Pendampingan personal fleksibel sesuai kesempatan bagi santri perwalian, koordinasi kasus dengan Wali Kelas & Asrama.',
              cta: 'Input Guru Wali',
              icon: Users,
              action: () => onNavigate('walikelas', { pembinaanJalur: 'Guru Wali' }),
            },
            {
              title: "Pengampu Al-Qur'an",
              jadwal: 'Harian Halaqah · Setoran & Murajaah',
              tugas: 'Mencatat kehadiran halaqah Putra/Putri, tilawah, murajaah, serta setoran ziyadah harian santri.',
              cta: "Input Absen Al-Qur'an",
              icon: BookMarked,
              action: () => onNavigate('presensi', { presensiJenis: 'Al-Quran' }),
            },
            {
              title: 'Guru Akademik & Jadwal JP',
              jadwal: 'Harian KBM per JP',
              tugas: 'Mengisi presensi kelas per mata pelajaran, mencatat materi pembelajaran, serta mengelola perubahan jadwal JP.',
              cta: 'Input Absen Akademik',
              icon: CalendarClock,
              action: () => onNavigate('presensi', { presensiJenis: 'Belajar' }),
            },
            {
              title: 'Pengelola Labkom, Ujian & Piket',
              jadwal: 'Peminjaman & Operasional Harian',
              tugas: 'Peminjaman Labkom & Ruang SMA Putra/Putri, berita acara ujian, serta piket guru inval & monitoring live.',
              cta: 'Buka Peminjaman Labkom',
              icon: Monitor,
              action: () => onNavigate('labkom'),
            },
          ].map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.title} className="bg-white p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold text-slate-900">{role.title}</div>
                    <Icon className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
                  </div>
                  <div className="text-[11px] font-semibold text-teal-700">{role.jadwal}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{role.tugas}</p>
                </div>
                <button
                  type="button"
                  onClick={role.action}
                  className="inline-flex items-center justify-between w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:border-teal-300 hover:bg-teal-50/70 hover:text-teal-900 transition-colors"
                >
                  <span>{role.cta}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Secondary operational links */}
        <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 font-medium">Layanan Terintegrasi Lainnya:</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('monitoring')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <BarChart3 className="h-3 w-3 text-indigo-600" />
              Monitoring &amp; Laporan Bulanan
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ujian')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ClipboardCheck className="h-3 w-3 text-amber-600" />
              Ujian &amp; Susulan
            </button>
            <button
              type="button"
              onClick={() => onNavigate('piket')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <UserX className="h-3 w-3 text-rose-600" />
              Piket &amp; Guru Inval
            </button>
            <button
              type="button"
              onClick={() => onNavigate('parentportal')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <CheckCircle2 className="h-3 w-3 text-teal-600" />
              Portal Wali Santri
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
