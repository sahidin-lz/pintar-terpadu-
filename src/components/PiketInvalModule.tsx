import React, { useEffect, useState } from 'react';
import { Copy, Megaphone, Search, Send, UserX } from 'lucide-react';
import type { Gender, TeacherAbsenceLog, TeacherPublic } from '../types';
import { formatTanggalIndo, getNamaHariFromDate, getTodayDateStr } from '../utils/exportHelpers';
import { emitDataMutated, loadSubTab, saveSubTab } from '../utils/sessionPersistence';

interface PiketInvalModuleProps {
  teachers: TeacherPublic[];
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PiketInvalModule: React.FC<PiketInvalModuleProps> = ({ teachers, notify }) => {
  const [subTab, setSubTab] = useState<'piket' | 'inval'>(() =>
    loadSubTab('pintar_piket_subtab_v1', ['piket', 'inval'] as const, 'piket'),
  );
  useEffect(() => {
    saveSubTab('pintar_piket_subtab_v1', subTab);
  }, [subTab]);

  // Piket state
  const [tglPiket, setTglPiket] = useState<string>(getTodayDateStr());
  const [namaGuruPiket, setNamaGuruPiket] = useState<string>(teachers[0]?.nama || '');
  const [statusPiket, setStatusPiket] = useState<TeacherAbsenceLog['status']>('Sakit');
  const [ketPiket, setKetPiket] = useState<string>('');
  const [savingPiket, setSavingPiket] = useState(false);
  const [absentList, setAbsentList] = useState<TeacherAbsenceLog[]>([]);

  // Broadcast state
  const [bcGender, setBcGender] = useState<Gender>('Putri');
  const [broadcastText, setBroadcastText] = useState<string>('');
  const [generatingBc, setGeneratingBc] = useState(false);

  // Inval state
  const [tglInval, setTglInval] = useState<string>(getTodayDateStr());
  const [genderInval, setGenderInval] = useState<string>('SEMUA');
  const [jenjangInval, setJenjangInval] = useState<string>('SEMUA');
  const [selectedJams, setSelectedJams] = useState<number[]>([1, 2]);
  const [invalList, setInvalList] = useState<Array<{ nama: string; jabatan: string; whatsapp: string }>>([]);
  const [searchingInval, setSearchingInval] = useState(false);
  const [searchedInval, setSearchedInval] = useState(false);

  const loadAbsentTeachers = () => {
    fetch(`/api/piket?tanggal=${encodeURIComponent(tglPiket)}`)
      .then((r) => r.json())
      .then((data: TeacherAbsenceLog[]) => setAbsentList(data))
      .catch(() => {});
  };

  useEffect(() => {
    loadAbsentTeachers();
  }, [tglPiket]);

  useEffect(() => {
    if (!namaGuruPiket && teachers.length > 0) setNamaGuruPiket(teachers[0].nama);
  }, [teachers, namaGuruPiket]);

  const handleSavePiket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaGuruPiket) {
      notify('Pilih nama guru yang tidak hadir.', 'error');
      return;
    }
    setSavingPiket(true);
    try {
      const res = await fetch('/api/piket/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: tglPiket,
          namaGuru: namaGuruPiket,
          status: statusPiket,
          keterangan: ketPiket,
        }),
      });
      const data = await res.json();
      emitDataMutated();
      notify(data.message || 'Data piket guru disimpan.', 'success');
      setKetPiket('');
      loadAbsentTeachers();
    } catch {
      notify('Gagal menyimpan data piket.', 'error');
    } finally {
      setSavingPiket(false);
    }
  };

  const handleGenerateBroadcast = async () => {
    setGeneratingBc(true);
    try {
      const res = await fetch(
        `/api/piket/broadcast?tanggal=${encodeURIComponent(tglPiket)}&gender=${encodeURIComponent(bcGender)}`
      );
      const data = await res.json();
      setBroadcastText(data.text || '');
      notify(`Teks broadcast WhatsApp (${bcGender}) berhasil dibuat.`, 'success');
    } catch {
      notify('Gagal membuat teks broadcast.', 'error');
    } finally {
      setGeneratingBc(false);
    }
  };

  const handleCopyBroadcast = () => {
    if (!broadcastText) return;
    navigator.clipboard.writeText(broadcastText);
    notify('Teks broadcast disalin! Siap ditempel ke WhatsApp Wali Murid.', 'success');
  };

  const toggleJam = (jam: number) => {
    setSelectedJams((prev) =>
      prev.includes(jam) ? prev.filter((j) => j !== jam) : [...prev, jam].sort((a, b) => a - b)
    );
  };

  const handleSearchInval = async () => {
    if (selectedJams.length === 0) {
      notify('Pilih minimal satu jam pelajaran untuk mencari guru inval.', 'error');
      return;
    }
    setSearchingInval(true);
    try {
      const res = await fetch(
        `/api/inval?tanggal=${encodeURIComponent(tglInval)}&jam=${encodeURIComponent(selectedJams.join(','))}&gender=${encodeURIComponent(genderInval)}&jenjang=${encodeURIComponent(jenjangInval)}`
      );
      const data = await res.json();
      setInvalList(data || []);
      setSearchedInval(true);
    } catch {
      notify('Gagal menganalisis jadwal guru inval.', 'error');
    } finally {
      setSearchingInval(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="grid grid-cols-2 sm:inline-flex gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSubTab('piket')}
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-0 ${
              subTab === 'piket'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <UserX className={`h-3.5 w-3.5 shrink-0 ${subTab === 'piket' ? 'text-white' : 'text-rose-600'}`} />
            <span className="truncate">Piket &amp; Broadcast WA</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('inval')}
            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap min-w-0 ${
              subTab === 'inval'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            <Search className={`h-3.5 w-3.5 shrink-0 ${subTab === 'inval' ? 'text-white' : 'text-cyan-600'}`} />
            <span className="truncate">Cari Guru Inval</span>
          </button>
        </div>
      </div>

      {subTab === 'piket' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Input Guru Tidak Hadir */}
          <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Input Guru Tidak Hadir</h3>
              <p className="text-xs text-slate-500">
                Hari {getNamaHariFromDate(tglPiket)} · {formatTanggalIndo(tglPiket)}
              </p>
            </div>
            <form onSubmit={handleSavePiket} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Piket</label>
                <input
                  type="date"
                  value={tglPiket}
                  onChange={(e) => setTglPiket(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Guru / Musyrif</label>
                <select
                  value={namaGuruPiket}
                  onChange={(e) => setNamaGuruPiket(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.nama}>
                      {t.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Ketidakhadiran</label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {(['Sakit', 'Izin', 'Dinas Luar', 'Tanpa Keterangan'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusPiket(st)}
                      className={`rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors ${
                        statusPiket === st
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {st === 'Tanpa Keterangan' ? 'Alfa' : st}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan Tambahan</label>
                <textarea
                  rows={2}
                  value={ketPiket}
                  onChange={(e) => setKetPiket(e.target.value)}
                  placeholder="Contoh: Tugas pengganti sudah dikirim ke kelas..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={savingPiket}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                <Send className="h-3.5 w-3.5" />
                {savingPiket ? 'Menyimpan...' : 'Simpan Laporan Piket Guru'}
              </button>
            </form>

            {/* Daftar Guru Absen Hari Ini */}
            <div className="border-t border-slate-200 pt-4">
              <div className="text-xs font-semibold text-slate-800 mb-2">
                Guru Tidak Hadir ({formatTanggalIndo(tglPiket)})
              </div>
              {absentList.length === 0 ? (
                <p className="text-xs text-slate-500">Belum ada guru tercatat tidak hadir pada tanggal ini.</p>
              ) : (
                <div className="space-y-2">
                  {absentList.map((a) => (
                    <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{a.namaGuru}</span>
                        <span className="text-rose-700">{a.status}</span>
                      </div>
                      {a.keterangan && <div className="mt-0.5 text-slate-600">{a.keterangan}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Broadcast Generator */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Generator Broadcast Info Harian (WhatsApp)</h3>
                <p className="text-xs text-slate-500">
                  Menghimpun santri Sakit/Izin/Alfa dari presensi Asrama pagi, dikelompokkan per kelas akademik (daftar guru absen dirahasiakan).
                </p>
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 p-1 shrink-0">
                {(['Putri', 'Putra'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setBcGender(g)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                      bcGender === g
                        ? g === 'Putri'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    Wilayah {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerateBroadcast}
                disabled={generatingBc}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <Megaphone className="h-3.5 w-3.5" />
                {generatingBc ? 'Menyusun Teks...' : `Buat Teks Broadcast (${bcGender})`}
              </button>
              {broadcastText && (
                <button
                  type="button"
                  onClick={handleCopyBroadcast}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Salin ke Clipboard
                </button>
              )}
            </div>

            <textarea
              rows={13}
              readOnly
              value={broadcastText}
              placeholder="Klik 'Buat Teks Broadcast' untuk menyusun pesan otomatis berdasarkan Log_Asrama hari ini..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono-num text-slate-800 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        /* Analisis Guru Inval */
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Analisis Guru Inval (Jadwal Kosong)</h3>
            <p className="text-xs text-slate-500">
              Menampilkan guru yang tidak memiliki jadwal mengajar dan tidak sedang izin pada tanggal & jam ke- tertentu.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tanggal ({getNamaHariFromDate(tglInval)})
              </label>
              <input
                type="date"
                value={tglInval}
                onChange={(e) => setTglInval(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Filter Wilayah</label>
              <select
                value={genderInval}
                onChange={(e) => setGenderInval(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              >
                <option value="SEMUA">Semua Wilayah</option>
                <option value="PUTRA">Wilayah Putra Saja</option>
                <option value="PUTRI">Wilayah Putri Saja</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Filter Jenjang Kelas</label>
              <select
                value={jenjangInval}
                onChange={(e) => setJenjangInval(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              >
                <option value="SEMUA">Semua Jenjang</option>
                <option value="10">Kelas 10</option>
                <option value="11">Kelas 11</option>
                <option value="12">Kelas 12</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pilih Jam Pelajaran Ke-</label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((jam) => {
                const active = selectedJams.includes(jam);
                return (
                  <button
                    key={jam}
                    type="button"
                    onClick={() => toggleJam(jam)}
                    className={`h-9 w-11 rounded-lg border font-mono-num text-xs font-bold transition-colors ${
                      active
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {jam}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleSearchInval}
                disabled={searchingInval}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Search className="h-3.5 w-3.5" />
                {searchingInval ? 'Menganalisis...' : 'Cari Guru Kosong'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold w-12">No</th>
                  <th className="px-4 py-3 font-semibold">Nama Guru Tersedia</th>
                  <th className="px-4 py-3 font-semibold">Jabatan</th>
                  <th className="px-4 py-3 text-right font-semibold">Kontak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!searchedInval ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Pilih tanggal dan jam pelajaran lalu klik <b>Cari Guru Kosong</b>.
                    </td>
                  </tr>
                ) : invalList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-rose-700 font-medium">
                      Tidak ada guru yang kosong sesuai filter pada jam tersebut.
                    </td>
                  </tr>
                ) : (
                  invalList.map((g, i) => (
                    <tr key={g.nama} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono-num text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{g.nama}</td>
                      <td className="px-4 py-3 text-slate-600">{g.jabatan}</td>
                      <td className="px-4 py-3 text-right font-mono-num text-teal-700">
                        {g.whatsapp ? `WA ${g.whatsapp}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
