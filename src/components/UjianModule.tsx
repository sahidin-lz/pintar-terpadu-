import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Printer, RefreshCw, Save } from 'lucide-react';
import type { AttendanceStatus, Gender, StudentFormEntry, TeacherPublic } from '../types';
import { formatTanggalIndo, getTodayDateStr, printHtmlDocument } from '../utils/exportHelpers';
import { emitDataMutated, loadSubTab, saveSubTab } from '../utils/sessionPersistence';

interface UjianModuleProps {
  teachers: TeacherPublic[];
  ruanganUjian: string[];
  kelasList: string[];
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UjianModule: React.FC<UjianModuleProps> = ({
  teachers,
  ruanganUjian,
  kelasList,
  notify,
}) => {
  const [subTab, setSubTab] = useState<'pelaksanaan' | 'susulan'>(() =>
    loadSubTab('pintar_ujian_subtab_v1', ['pelaksanaan', 'susulan'] as const, 'pelaksanaan'),
  );
  const [gender, setGender] = useState<Gender>(() =>
    loadSubTab('pintar_ujian_gender_v1', ['Putra', 'Putri'] as const, 'Putri'),
  );
  useEffect(() => {
    saveSubTab('pintar_ujian_subtab_v1', subTab);
  }, [subTab]);
  useEffect(() => {
    saveSubTab('pintar_ujian_gender_v1', gender);
  }, [gender]);
  const [tanggal, setTanggal] = useState<string>(getTodayDateStr());
  const [jenisUjian, setJenisUjian] = useState<string>('ASTS GANJIL');
  const [ruangan, setRuangan] = useState<string>(ruanganUjian[0] || '');
  const [kelas, setKelas] = useState<string>('');
  const [mapel, setMapel] = useState<string>('BAHASA INDONESIA');
  const [pengawas1, setPengawas1] = useState<string>('');
  const [pengawas2, setPengawas2] = useState<string>('');

  const [siswaUjian, setSiswaUjian] = useState<StudentFormEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [riwayat, setRiwayat] = useState<
    Array<{
      ruang: string;
      pengawas: string;
      pengawas2: string;
      jenisUjian: string;
      kelas: string;
      mapel: string;
      totalSiswa: number;
      hadir: number;
    }>
  >([]);
  const [susulan, setSusulan] = useState<
    Array<{
      tgl: string;
      jenis: string;
      nama: string;
      kelas: string;
      mapel: string;
      status: AttendanceStatus;
      keterangan: string;
    }>
  >([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(false);

  const filteredRuangan = ruanganUjian.filter((r) => {
    const up = r.toUpperCase();
    const other = gender === 'Putra' ? 'PUTRI' : 'PUTRA';
    return !up.includes(other);
  });

  useEffect(() => {
    if (filteredRuangan.length > 0 && !filteredRuangan.includes(ruangan)) {
      setRuangan(filteredRuangan[0]);
    } else if (filteredRuangan.length === 0 && ruanganUjian.length > 0 && !ruangan) {
      setRuangan(ruanganUjian[0]);
    }
  }, [gender, ruanganUjian, filteredRuangan, ruangan]);

  useEffect(() => {
    const filtered = kelasList.filter((k) => k.toUpperCase().includes(gender.toUpperCase()));
    if (filtered.length > 0) setKelas(filtered[0]);
    else if (kelasList.length > 0) setKelas(kelasList[0]);
  }, [gender, kelasList]);

  useEffect(() => {
    if (!pengawas1 && teachers.length > 0) {
      setPengawas1(teachers[0].nama);
    }
  }, [teachers, pengawas1]);

  const loadRiwayatDanSusulan = () => {
    setLoadingRiwayat(true);
    fetch(`/api/ujian/riwayat?tanggal=${encodeURIComponent(tanggal)}&gender=${encodeURIComponent(gender)}`)
      .then((r) => r.json())
      .then((data) => {
        setRiwayat(data.riwayat || []);
        setSusulan(data.susulan || []);
      })
      .finally(() => setLoadingRiwayat(false));
  };

  useEffect(() => {
    if (subTab === 'susulan') loadRiwayatDanSusulan();
  }, [subTab, tanggal, gender]);

  const handleTarikPeserta = async () => {
    if (!ruangan || !kelas || !mapel.trim() || !pengawas1.trim()) {
      notify('Lengkapi Ruang, Kelas, Mata Pelajaran, dan Pengawas 1.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ujian/siswa?tanggal=${encodeURIComponent(tanggal)}&kelas=${encodeURIComponent(kelas)}&mapel=${encodeURIComponent(mapel)}&gender=${encodeURIComponent(gender)}`
      );
      const data = await res.json();
      setSiswaUjian(data.siswa || []);
      notify(`${(data.siswa || []).length} peserta ujian dimuat.`, 'success');
    } catch {
      notify('Gagal menarik daftar peserta ujian.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUjian = async () => {
    if (siswaUjian.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ujian/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender,
          tanggal,
          jenisUjian,
          ruangan,
          kelas,
          mapel,
          pengawas1,
          pengawas2,
          siswa: siswaUjian,
        }),
      });
      const data = await res.json();
      emitDataMutated();
      notify(data.message || 'Kehadiran ujian disimpan.', 'success');
    } catch {
      notify('Gagal menyimpan kehadiran ujian.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintBeritaAcara = () => {
    if (siswaUjian.length === 0) return;
    const hadir = siswaUjian.filter((s) => s.status === 'H' || s.status === 'T').length;
    const absenList = siswaUjian.filter((s) => s.status !== 'H' && s.status !== 'T');

    const rowsHtml =
      absenList.length === 0
        ? '<tr><td colspan="5">NIHIL / SELURUH PESERTA HADIR</td></tr>'
        : absenList
            .map(
              (s, i) => `<tr>
                <td>${i + 1}</td>
                <td class="left">${s.nama}</td>
                <td>${s.kelasAsli}</td>
                <td><b>${s.status}</b></td>
                <td class="left">${s.keterangan || '-'}</td>
              </tr>`
            )
            .join('');

    printHtmlDocument(
      `Berita_Acara_Wilayah_${gender}_${ruangan}_${mapel}`,
      `
      <div class="doc-title">
        <h2>BERITA ACARA PELAKSANAAN UJIAN (${jenisUjian}) · WILAYAH ${gender.toUpperCase()}</h2>
      </div>
      <table class="meta-table">
        <tr><td style="width:24%">Wilayah / Hari, Tanggal</td><td>: <b>Wilayah ${gender}</b> · <b>${formatTanggalIndo(tanggal)}</b></td></tr>
        <tr><td>Mata Pelajaran</td><td>: <b>${mapel.toUpperCase()}</b></td></tr>
        <tr><td>Kelas / Ruang</td><td>: ${kelas.toUpperCase()} / ${ruangan.toUpperCase()}</td></tr>
        <tr><td>Jumlah Peserta</td><td>: ${siswaUjian.length} Orang (Hadir: ${hadir} · Tidak Hadir: ${absenList.length})</td></tr>
      </table>
      <div style="font-weight:bold; margin: 12px 0 6px 0;">Catatan Peserta Tidak Hadir (Daftar Susulan):</div>
      <table>
        <thead>
          <tr><th style="width:6%">No</th><th style="width:34%">Nama Peserta</th><th style="width:16%">Kelas</th><th style="width:10%">Status</th><th style="width:34%">Keterangan</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="sign-grid">
        <div class="sign-box">Pengawas 1,<div class="sign-space"></div><b>${pengawas1.toUpperCase()}</b></div>
        <div class="sign-box">Pengawas 2,<div class="sign-space"></div><b>${(pengawas2 || '-').toUpperCase()}</b></div>
      </div>
      `
    );
  };

  const openFromHistory = async (item: (typeof riwayat)[number]) => {
    setRuangan(item.ruang);
    setKelas(item.kelas);
    setMapel(item.mapel);
    setPengawas1(item.pengawas);
    setPengawas2(item.pengawas2);
    setSubTab('pelaksanaan');
    setLoading(true);
    try {
      const res = await fetch(
        `/api/ujian/siswa?tanggal=${encodeURIComponent(tanggal)}&kelas=${encodeURIComponent(item.kelas)}&mapel=${encodeURIComponent(item.mapel)}&gender=${encodeURIComponent(gender)}`
      );
      const data = await res.json();
      setSiswaUjian(data.siswa || []);
    } finally {
      setLoading(false);
    }
  };

  const filteredKelas = kelasList.filter((k) => k.toUpperCase().includes(gender.toUpperCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="grid grid-cols-2 sm:inline-flex gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSubTab('pelaksanaan')}
            className={`rounded-lg px-2.5 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate ${
              subTab === 'pelaksanaan'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            Pelaksanaan Ujian
          </button>
          <button
            type="button"
            onClick={() => setSubTab('susulan')}
            className={`rounded-lg px-2.5 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate ${
              subTab === 'susulan'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
            }`}
          >
            Rekap &amp; Susulan
          </button>
        </div>

        <div className="grid grid-cols-2 sm:inline-flex gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80 w-full sm:w-auto">
          {(['Putri', 'Putra'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                gender === g
                  ? g === 'Putri'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
              }`}
            >
              Wilayah {g}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'pelaksanaan' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left Controls */}
          <div className="lg:col-span-4 xl:col-span-3 rounded-xl border border-slate-200 bg-white p-5 space-y-3.5">
            <h3 className="text-sm font-semibold text-slate-900">Kontrol Ruang Ujian</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Ujian</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Ujian</label>
              <select
                value={jenisUjian}
                onChange={(e) => setJenisUjian(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              >
                <option value="ASTS GANJIL">ASTS GANJIL</option>
                <option value="ASAS GANJIL">ASAS GANJIL</option>
                <option value="ASTS GENAP">ASTS GENAP</option>
                <option value="ASAS GENAP">ASAS GENAP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ruangan</label>
              <select
                value={ruangan}
                onChange={(e) => setRuangan(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              >
                {(filteredRuangan.length > 0 ? filteredRuangan : ruanganUjian).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas Peserta</label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              >
                {(filteredKelas.length > 0 ? filteredKelas : kelasList).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
              <input
                type="text"
                value={mapel}
                onChange={(e) => setMapel(e.target.value.toUpperCase())}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pengawas 1</label>
              <select
                value={pengawas1}
                onChange={(e) => setPengawas1(e.target.value)}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Pengawas 2 (Opsional)</label>
              <select
                value={pengawas2}
                onChange={(e) => setPengawas2(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs font-medium"
              >
                <option value="">-- Tidak ada --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.nama}>
                    {t.nama}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleTarikPeserta}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <ClipboardCheck className="h-4 w-4" />
              {loading ? 'Memuat...' : 'Tarik Daftar Peserta'}
            </button>
          </div>

          {/* Right Roster */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Peserta Ujian {kelas ? `· ${kelas}` : ''}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {ruangan} · {mapel} · Sinkronisasi otomatis status Asrama pagi
                  </p>
                </div>
                <span className="font-mono-num text-xs text-slate-600">{siswaUjian.length} peserta</span>
              </div>

              <div className="p-5">
                {siswaUjian.length === 0 ? (
                  <div className="py-14 text-center text-xs text-slate-500">
                    Lengkapi kontrol ruang ujian di sebelah kiri lalu klik <b>Tarik Daftar Peserta</b>.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {siswaUjian.map((s, idx) => (
                      <div
                        key={s.nama}
                        className={`rounded-lg border p-3.5 ${
                          s.status !== 'H' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-900">
                              {idx + 1}. {s.nama}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {s.kelasAsli}
                              {s.syncedFromAsrama ? ' · Sinkron Asrama' : ''}
                            </div>
                          </div>
                          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
                            {(['H', 'S', 'I', 'A'] as const).map((code) => (
                              <button
                                key={code}
                                type="button"
                                onClick={() =>
                                  setSiswaUjian((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            status: code,
                                            keterangan: code === 'H' ? '' : item.keterangan,
                                          }
                                        : item
                                    )
                                  )
                                }
                                className={`h-7 w-7 rounded text-xs font-bold ${
                                  s.status === code
                                    ? code === 'H'
                                      ? 'bg-emerald-600 text-white'
                                      : code === 'S'
                                      ? 'bg-amber-600 text-white'
                                      : code === 'I'
                                      ? 'bg-sky-600 text-white'
                                      : 'bg-rose-600 text-white'
                                    : 'text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                {code}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="text"
                          value={s.keterangan}
                          onChange={(e) =>
                            setSiswaUjian((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, keterangan: e.target.value } : item))
                            )
                          }
                          placeholder="Keterangan ujian..."
                          className="mt-2 h-8 w-full rounded border border-slate-200 px-2.5 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={saving || siswaUjian.length === 0}
                onClick={handleSaveUjian}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Menyimpan...' : 'Simpan Kehadiran Ujian'}
              </button>
              <button
                type="button"
                disabled={siswaUjian.length === 0}
                onClick={handlePrintBeritaAcara}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
              >
                <Printer className="h-4 w-4" />
                Cetak Berita Acara (PDF)
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Rekap Tersimpan & Daftar Susulan */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Data Ujian Tersimpan ({formatTanggalIndo(tanggal)})
                </h3>
                <p className="text-xs text-slate-500">Klik Buka BA untuk mencetak Berita Acara</p>
              </div>
              <button
                type="button"
                onClick={loadRiwayatDanSusulan}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingRiwayat ? 'animate-spin' : ''}`} />
                Muat Ulang
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Kelas & Mapel</th>
                    <th className="px-3 py-3 font-semibold">Ruang & Pengawas</th>
                    <th className="px-4 py-3 text-right font-semibold">Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {riwayat.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        Belum ada data ujian tersimpan untuk tanggal dan gender ini.
                      </td>
                    </tr>
                  ) : (
                    riwayat.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{item.kelas}</div>
                          <div className="text-slate-600">{item.mapel}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-800">{item.ruang}</div>
                          <div className="text-[11px] text-slate-500">{item.pengawas}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-mono-num font-semibold text-emerald-700 mb-1">
                            {item.hadir}/{item.totalSiswa} Hadir
                          </div>
                          <button
                            type="button"
                            onClick={() => openFromHistory(item)}
                            className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                          >
                            Buka BA
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Daftar Susulan Ujian Otomatis ({gender})
              </h3>
              <p className="text-xs text-slate-500">
                Santri dengan status Sakit, Izin, atau Alfa otomatis terdeteksi di sini.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal & Jenis</th>
                    <th className="px-3 py-3 font-semibold">Nama Santri</th>
                    <th className="px-3 py-3 font-semibold">Kelas & Mapel</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {susulan.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        Tidak ada santri susulan yang tercatat.
                      </td>
                    </tr>
                  ) : (
                    susulan.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-mono-num font-medium">{s.tgl}</div>
                          <div className="text-[11px] text-slate-500">{s.jenis}</div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{s.nama}</td>
                        <td className="px-3 py-3">
                          <div>{s.kelas}</div>
                          <div className="text-[11px] font-medium text-rose-700">{s.mapel}</div>
                        </td>
                        <td className="px-4 py-3 text-rose-700">{s.keterangan}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
