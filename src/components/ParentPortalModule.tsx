import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Home,
  MessageSquare,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type {
  AttendanceStatus,
  CloudAttachmentItem,
  PembinaanRecord,
  PortfolioSummary,
  WhatsAppLogEntry,
} from '../types';

interface SampleStudent {
  nis: string;
  nama: string;
  kelas: string;
  kamar: string;
  gender: 'Putra' | 'Putri';
  tanggalLahir: string;
}

interface ParentPortalResponse {
  ok: boolean;
  error?: string;
  portfolio: PortfolioSummary;
  halaqahLogs: Array<{
    tanggal: string;
    guru: string;
    kelompok: string;
    status: AttendanceStatus;
    tilawah: string;
    murajaah: string;
    setoran: string;
  }>;
  attachments: CloudAttachmentItem[];
  whatsappAlerts: WhatsAppLogEntry[];
}

export const ParentPortalModule: React.FC = () => {
  const [nisOrName, setNisOrName] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('2009-05-12');
  const [samples, setSamples] = useState<SampleStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ParentPortalResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'presensi' | 'quran' | 'pembinaan' | 'lampiran'>('ringkasan');

  const handleLookup = async (customNis?: string, customDob?: string) => {
    const queryVal = (customNis ?? nisOrName).trim();
    const dobVal = (customDob ?? tanggalLahir).trim();
    if (!queryVal) {
      setError('Masukkan Nomor Induk Santri (NIS) atau Nama Lengkap Santri.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/parent-portal/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nisOrName: queryVal,
          tanggalLahir: dobVal,
        }),
      });
      const data: ParentPortalResponse = await r.json();
      if (!r.ok || !data.ok) {
        throw new Error(data.error || 'Data santri tidak ditemukan.');
      }
      setResult(data);
    } catch (err) {
      setError((err as Error).message || 'Data santri tidak ditemukan.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/parent-portal/samples')
      .then((r) => r.json())
      .then((res: { samples: SampleStudent[] }) => {
        const list = res.samples || [];
        setSamples(list);
        if (list.length > 0) {
          const firstNis = list[0].nis || list[0].nama;
          const firstDob = list[0].tanggalLahir || '2009-05-12';
          setNisOrName(firstNis);
          setTanggalLahir(firstDob);
          handleLookup(firstNis, firstDob);
        }
      })
      .catch(() => {});
  }, []);

  const portfolio = result?.portfolio;
  const student = portfolio?.santri;

  const computeOverallPct = () => {
    if (!portfolio) return 100;
    const divs = [
      portfolio.rekapPresensi.akademik,
      portfolio.rekapPresensi.asrama,
      portfolio.rekapPresensi.alquran,
      portfolio.rekapPresensi.ujian,
    ];
    let hadir = 0;
    let total = 0;
    for (const d of divs) {
      hadir += (d.H || 0) + (d.T || 0);
      total += (d.H || 0) + (d.T || 0) + (d.S || 0) + (d.I || 0) + (d.A || 0);
    }
    return total > 0 ? Math.round((hadir / total) * 100) : 100;
  };

  const overallPct = computeOverallPct();
  const halaqahLogs = result?.halaqahLogs || [];
  const attachments = result?.attachments || [];
  const whatsappAlerts = result?.whatsappAlerts || [];

  return (
    <div className="space-y-6">
      {/* Header & Form Verifikasi Wali Santri */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Portal Wali Santri (Read-Only Real-Time)
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Pantau Kehadiran, Halaqah Al-Qur&apos;an &amp; Rekam Jejak Pembinaan Anak
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Masukkan <strong>Nomor Induk Santri (NIS)</strong> dan <strong>Tanggal Lahir</strong> untuk melihat portofolio real-time lintas divisi (Akademik, Asrama, Halaqah, dan Kedisiplinan).
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600 max-w-xs">
            <div className="font-bold text-slate-800 mb-0.5">Akses Aman Tanpa Login Guru</div>
            Data ditampilkan dalam mode baca saja (Read-Only) dan tersinkronisasi otomatis dengan input Wali Kelas, Guru Mapel, dan Musyrif/ah.
          </div>
        </div>

        {/* Form Lookup */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-5 items-end"
        >
          <div className="md:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              NIS atau Nama Lengkap Santri
            </label>
            <input
              type="text"
              value={nisOrName}
              onChange={(e) => setNisOrName(e.target.value)}
              placeholder="Contoh: 1001 atau Nama Santri..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white font-medium text-slate-900"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Tanggal Lahir Santri
            </label>
            <input
              type="date"
              value={tanggalLahir}
              onChange={(e) => setTanggalLahir(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white font-mono-num text-slate-900"
            />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Memuat Portofolio...' : 'Lihat Portofolio Anak'}
            </button>
          </div>
        </form>

        {/* Quick Sample Selector Chips for Immediate Testing */}
        {samples.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Pilih Cepat Santri Terdaftar:
            </span>
            {samples.map((s) => (
              <button
                key={`${s.nis}-${s.nama}`}
                type="button"
                onClick={() => {
                  const q = s.nis || s.nama;
                  const dob = s.tanggalLahir || '2009-05-12';
                  setNisOrName(q);
                  setTanggalLahir(dob);
                  handleLookup(q, dob);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                  student?.nama === s.nama
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                }`}
              >
                <span className="font-mono-num">{s.nis}</span> — {s.nama} ({s.kelas})
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Hasil Portofolio Santri */}
      {student && portfolio && (
        <div className="space-y-6">
          {/* Kartu Identitas & Ringkasan Indikator Utama */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {student.nama.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{student.nama}</h3>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-800 border border-slate-200 font-mono-num">
                      NIS: {student.nis || student.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-md border ${
                        student.gender === 'Putra'
                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      Wilayah {student.gender}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 mt-2 text-xs text-slate-600">
                    <div>
                      Kelas: <strong className="text-slate-900">{student.kelas}</strong>
                    </div>
                    <div>
                      Wali Kelas: <strong className="text-slate-900">{student.waliKelas || '-'}</strong>
                    </div>
                    <div>
                      Kamar Asrama: <strong className="text-slate-900">{student.kamar || '-'}</strong>
                    </div>
                    <div>
                      Musyrif/ah: <strong className="text-slate-900">{student.musyrif || '-'}</strong>
                    </div>
                    <div>
                      Halaqah Qur&apos;an: <strong className="text-slate-900">{student.kelompokQuran || '-'}</strong>
                    </div>
                    <div>
                      Pengampu: <strong className="text-slate-900">{student.pengampuQuran || '-'}</strong>
                    </div>
                    <div>
                      Tgl Lahir:{' '}
                      <strong className="text-slate-900 font-mono-num">{student.tanggalLahir || '2009-05-12'}</strong>
                    </div>
                    <div>
                      WA Ortu: <strong className="text-slate-900 font-mono-num">{student.waOrtu || 'Terdaftar'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-right">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Kehadiran Lintas Divisi
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-900 font-mono-num">{overallPct}%</div>
                </div>
                <div
                  className={`px-4 py-2.5 rounded-lg border text-right ${
                    portfolio.netPoin >= 0
                      ? 'bg-sky-50 border-sky-200 text-sky-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider">Saldo Poin Karakter</div>
                  <div className="text-2xl font-extrabold font-mono-num">
                    {portfolio.netPoin > 0 ? `+${portfolio.netPoin}` : portfolio.netPoin}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Metrik Presensi Lintas Divisi + Ibadah */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-5">
              {(
                [
                  { label: 'KBM Akademik', key: 'akademik', icon: BookOpen },
                  { label: 'Kamar Asrama', key: 'asrama', icon: Home },
                  { label: "Halaqah Al-Qur'an", key: 'alquran', icon: Award },
                  { label: 'Presensi Ujian', key: 'ujian', icon: Calendar },
                ] as const
              ).map((item) => {
                const stat = portfolio.rekapPresensi[item.key];
                const Icon = item.icon;
                return (
                  <div key={item.key} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                      <span>{item.label}</span>
                      <Icon className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div className="bg-white border border-slate-200 rounded py-1">
                        <div className="text-[10px] font-bold text-emerald-700">H</div>
                        <div className="text-xs font-extrabold font-mono-num text-slate-900">
                          {(stat.H || 0) + (stat.T || 0)}
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded py-1">
                        <div className="text-[10px] font-bold text-amber-700">S</div>
                        <div className="text-xs font-extrabold font-mono-num text-slate-900">{stat.S || 0}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded py-1">
                        <div className="text-[10px] font-bold text-sky-700">I</div>
                        <div className="text-xs font-extrabold font-mono-num text-slate-900">{stat.I || 0}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded py-1">
                        <div className="text-[10px] font-bold text-rose-700">A</div>
                        <div className="text-xs font-extrabold font-mono-num text-slate-900">{stat.A || 0}</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-900 mb-2">
                  <span>Rata-rata Ibadah</span>
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Sholat Wajib:</span>
                    <span className="font-bold text-emerald-900 font-mono-num">{portfolio.persenSholatWajib}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Amalan Sunnah:</span>
                    <span className="font-bold text-emerald-900 font-mono-num">{portfolio.persenSholatSunnah}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigasi Portofolio */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {[
              { id: 'ringkasan', label: 'Ringkasan & Notifikasi WA', icon: MessageSquare },
              {
                id: 'presensi',
                label: `Catatan Ketidakhadiran (${portfolio.recentAbsenIssues.length})`,
                icon: CheckCircle2,
              },
              { id: 'quran', label: `Progres Halaqah Al-Qur'an (${halaqahLogs.length})`, icon: BookOpen },
              {
                id: 'pembinaan',
                label: `Catatan Pembinaan & Poin (${portfolio.riwayatPembinaan.length})`,
                icon: FileText,
              },
              { id: 'lampiran', label: `Dokumen & Bukti Lampiran (${attachments.length})`, icon: Paperclip },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 border ${
                    activeTab === t.id
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Konten Tab */}
          {activeTab === 'ringkasan' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pembinaan Terakhir */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Rekam Jejak Pembinaan &amp; Karakter Terbaru</span>
                  <span className="text-xs font-mono-num text-slate-500">
                    {portfolio.riwayatPembinaan.length} Catatan
                  </span>
                </h4>
                {portfolio.riwayatPembinaan.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    Belum ada catatan pembinaan khusus untuk santri ini. Alhamdulillah kondisi kondusif.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {portfolio.riwayatPembinaan.slice(0, 5).map((rec: PembinaanRecord) => (
                      <div key={rec.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {rec.kategori} — <span className="font-mono-num text-slate-600">{rec.tanggal}</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-bold rounded border font-mono-num ${
                              rec.poin >= 0
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {rec.poin > 0 ? `+${rec.poin}` : rec.poin} Poin
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{rec.catatan}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/70">
                          <span>
                            Pembina: {rec.pembinaNama} ({rec.pembinaPeran})
                          </span>
                          <span className="font-semibold text-slate-700">Status: {rec.statusTindakLanjut}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log Notifikasi WhatsApp Otomatis ke Orang Tua */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>Riwayat Notifikasi WhatsApp Gateway ke Wali Santri</span>
                  <span className="text-xs font-mono-num text-emerald-700 font-semibold">Auto-Trigger Aktif</span>
                </h4>
                {whatsappAlerts.length === 0 ? (
                  <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-1">
                    <div className="text-xs font-semibold text-slate-700">
                      Tidak Ada Peringatan Alfa / Eskalasi Pelanggaran
                    </div>
                    <p className="text-xs text-slate-500">
                      Notifikasi WhatsApp otomatis dikirimkan ke nomor orang tua apabila santri tercatat berstatus{' '}
                      <strong>Alfa (A)</strong> atau mendapat <strong>Eskalasi Pembinaan</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {whatsappAlerts.map((w) => (
                      <div key={w.id} className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-950">{w.triggerType}</span>
                          <span className="font-mono-num text-[11px] text-slate-500">{w.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-line">{w.pesan}</p>
                        <div className="text-[11px] text-emerald-800 font-mono-num">
                          Tujuan: {w.nomorTujuan} • Status: {w.status} ({w.provider})
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'presensi' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">
                  Riwayat Ketidakhadiran (Sakit / Izin / Alfa) Lintas Divisi
                </h4>
                <span className="text-xs text-slate-500 font-mono-num">
                  {portfolio.recentAbsenIssues.length} catatan
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                      <th className="py-3 px-4 font-bold">Tanggal</th>
                      <th className="py-3 px-4 font-bold">Divisi</th>
                      <th className="py-3 px-4 font-bold">Konteks / Mata Pelajaran</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {portfolio.recentAbsenIssues.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Alhamdulillah, tidak ada catatan Sakit, Izin, atau Alfa pada santri ini.
                        </td>
                      </tr>
                    ) : (
                      portfolio.recentAbsenIssues.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono-num font-semibold text-slate-900">{log.tanggal}</td>
                          <td className="py-2.5 px-4 font-semibold text-slate-700">{log.divisi}</td>
                          <td className="py-2.5 px-4 text-slate-800 font-medium">{log.konteks}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded font-bold font-mono-num border ${
                                log.status === 'S'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : log.status === 'I'
                                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{log.keterangan || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'quran' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Rekam Jejak Halaqah Al-Qur&apos;an (Ziyadah, Tilawah &amp; Murajaah)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Kelompok Halaqah: <strong>{student.kelompokQuran || '-'}</strong> • Pengampu:{' '}
                    <strong>{student.pengampuQuran || '-'}</strong>
                  </p>
                </div>
              </div>
              {halaqahLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Belum ada catatan setoran halaqah spesifik pada periode ini.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                        <th className="py-2.5 px-4 font-bold">Tanggal</th>
                        <th className="py-2.5 px-4 font-bold">Kelompok</th>
                        <th className="py-2.5 px-4 font-bold">Pengampu</th>
                        <th className="py-2.5 px-4 font-bold">Kehadiran</th>
                        <th className="py-2.5 px-4 font-bold">Setoran Ziyadah</th>
                        <th className="py-2.5 px-4 font-bold">Tilawah</th>
                        <th className="py-2.5 px-4 font-bold">Murajaah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {halaqahLogs.map((q, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono-num font-semibold">{q.tanggal}</td>
                          <td className="py-2.5 px-4">{q.kelompok}</td>
                          <td className="py-2.5 px-4">{q.guru}</td>
                          <td className="py-2.5 px-4 font-bold">{q.status}</td>
                          <td className="py-2.5 px-4 font-medium text-emerald-800">{q.setoran}</td>
                          <td className="py-2.5 px-4 text-slate-700">{q.tilawah}</td>
                          <td className="py-2.5 px-4 text-slate-700">{q.murajaah}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pembinaan' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 mb-3">
                Daftar Lengkap Pembinaan, Prestasi &amp; Kedisiplinan Santri
              </h4>
              {portfolio.riwayatPembinaan.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Belum ada catatan pembinaan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase">
                        <th className="py-2.5 px-3 font-bold">Tanggal</th>
                        <th className="py-2.5 px-3 font-bold">Kategori</th>
                        <th className="py-2.5 px-3 font-bold">Uraian Catatan</th>
                        <th className="py-2.5 px-3 font-bold">Tindak Lanjut</th>
                        <th className="py-2.5 px-3 font-bold">Poin</th>
                        <th className="py-2.5 px-3 font-bold">Status</th>
                        <th className="py-2.5 px-3 font-bold">Pembina</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {portfolio.riwayatPembinaan.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono-num">{rec.tanggal}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{rec.kategori}</td>
                          <td className="py-2.5 px-3 text-slate-700">{rec.catatan}</td>
                          <td className="py-2.5 px-3 text-slate-600">{rec.tindakLanjut}</td>
                          <td className="py-2.5 px-3 font-mono-num font-bold">
                            {rec.poin > 0 ? `+${rec.poin}` : rec.poin}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">{rec.statusTindakLanjut}</td>
                          <td className="py-2.5 px-3 text-slate-600">{rec.pembinaNama}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lampiran' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 mb-3">
                Arsip Bukti Lampiran Cloud (Surat Sakit Dokter, Sertifikat Lomba, Surat Izin)
              </h4>
              {attachments.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Belum ada file lampiran bukti yang diunggah untuk santri ini.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attachments.map((att) => (
                    <div key={att.id} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">
                          {att.kategoriLampiran}
                        </span>
                        <span className="font-mono-num text-slate-500">{att.timestamp}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate">{att.fileName}</div>
                      {att.url.startsWith('data:image') && (
                        <img
                          src={att.url}
                          alt={att.fileName}
                          className="w-full h-36 object-cover rounded border border-slate-200 bg-white"
                        />
                      )}
                      <div className="text-[11px] text-slate-500">
                        Diunggah oleh: {att.uploadedBy} ({att.storageProvider})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
