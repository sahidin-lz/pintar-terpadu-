import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Home,
  BookMarked,
  Save,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import type {
  AttendanceStatus,
  Gender,
  PresensiType,
  StudentFormEntry,
  TeacherPublic,
} from '../types';
import {
  ALASAN_ALFA,
  ALASAN_IZIN,
  ALASAN_SAKIT,
  getNamaHariFromDate,
  getTodayDateStr,
  shiftDateStr,
} from '../utils/exportHelpers';
import { loadScopedState, loadSubTab, saveScopedState, saveSubTab } from '../utils/sessionPersistence';

interface PresensiModuleProps {
  initialGuru?: string;
  loggedInUser?: TeacherPublic | null;
  onSaved?: () => void;
  onOpenJadwal?: () => void;
  onOpenImport?: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface TargetOption {
  value: string;
  label: string;
  grup: string;
  mapel: string;
}

export const PresensiModule: React.FC<PresensiModuleProps> = ({
  initialGuru,
  loggedInUser,
  onSaved,
  onOpenJadwal,
  onOpenImport,
  notify,
}) => {
  const [jenis, setJenis] = useState<PresensiType>(() =>
    loadSubTab(
      'pintar_presensi_jenis_v1',
      ['Asrama', 'Belajar', 'Al-Quran'] as const,
      loggedInUser?.peran === 'Musyrif' || loggedInUser?.peran === 'Musyrifah'
        ? 'Asrama'
        : loggedInUser?.peran === 'Guru'
        ? 'Belajar'
        : 'Asrama',
    ),
  );
  const [gender, setGender] = useState<Gender>(() =>
    loadSubTab(
      'pintar_presensi_gender_v1',
      ['Putra', 'Putri'] as const,
      loggedInUser?.genderScope === 'Putri' ? 'Putri' : loggedInUser?.genderScope === 'Putra' ? 'Putra' : 'Putri',
    ),
  );
  const [tanggal, setTanggal] = useState<string>(getTodayDateStr());
  const [teachers, setTeachers] = useState<TeacherPublic[]>([]);
  const [namaGuru, setNamaGuru] = useState<string>(
    () => initialGuru || loadScopedState<string>('pintar_presensi_guru_v1', '') || loggedInUser?.nama || '',
  );

  useEffect(() => {
    saveSubTab('pintar_presensi_jenis_v1', jenis);
  }, [jenis]);

  useEffect(() => {
    saveSubTab('pintar_presensi_gender_v1', gender);
  }, [gender]);

  useEffect(() => {
    if (namaGuru) saveScopedState('pintar_presensi_guru_v1', namaGuru);
  }, [namaGuru]);
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [loadingTargets, setLoadingTargets] = useState<boolean>(false);

  const [siswaList, setSiswaList] = useState<StudentFormEntry[]>([]);
  const [materi, setMateri] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [grupAktif, setGrupAktif] = useState<string>('');
  const [loadingSiswa, setLoadingSiswa] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [openReasonIdx, setOpenReasonIdx] = useState<number | null>(null);
  const [controlsMinimized, setControlsMinimized] = useState<boolean>(false);

  const hari = getNamaHariFromDate(tanggal);

  useEffect(() => {
    if (initialGuru) {
      setNamaGuru(initialGuru);
    } else if (loggedInUser?.nama && !namaGuru) {
      setNamaGuru(loggedInUser.nama);
      if (loggedInUser.genderScope === 'Putri' || loggedInUser.genderScope === 'Putra') {
        setGender(loggedInUser.genderScope);
      }
    }
  }, [initialGuru, loggedInUser, namaGuru]);

  // Load filtered teacher list whenever jenis or gender changes
  useEffect(() => {
    let active = true;
    fetch(`/api/presensi/teachers?jenis=${encodeURIComponent(jenis)}&gender=${encodeURIComponent(gender)}`)
      .then((r) => r.json())
      .then((list: TeacherPublic[]) => {
        if (!active) return;
        setTeachers(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [jenis, gender]);

  // Load target rooms / classes whenever guru, jenis, gender, or tanggal changes
  useEffect(() => {
    if (!namaGuru.trim() || !tanggal) {
      setTargetOptions([]);
      setSelectedTarget('');
      setSiswaList([]);
      return;
    }

    let active = true;
    setLoadingTargets(true);
    setSelectedTarget('');
    setSiswaList([]);
    setMateri('');
    setIsEditMode(false);

    const url = `/api/presensi/opsi?jenis=${encodeURIComponent(jenis)}&gender=${encodeURIComponent(gender)}&guru=${encodeURIComponent(namaGuru)}&hari=${encodeURIComponent(hari)}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        const opts: TargetOption[] = [];
        if (jenis === 'Asrama' && Array.isArray(data.rooms)) {
          if (data.rooms.length > 1) {
            opts.push({
              value: `${data.rooms.join(',')}|KELUAR ASRAMA`,
              label: `Semua Kamar Binaan (${data.rooms.length})`,
              grup: data.rooms.join(','),
              mapel: 'KELUAR ASRAMA',
            });
          }
          data.rooms.forEach((rm: string) => {
            opts.push({
              value: `${rm}|KELUAR ASRAMA`,
              label: rm,
              grup: rm,
              mapel: 'KELUAR ASRAMA',
            });
          });
        } else if (Array.isArray(data.jadwal)) {
          data.jadwal.forEach((j: { kelas: string; mapel: string; jamKe: string }) => {
            opts.push({
              value: `${j.kelas}|${j.mapel}`,
              label: `${j.kelas} — ${j.mapel} (Jam ${j.jamKe})`,
              grup: j.kelas,
              mapel: j.mapel,
            });
          });
        }
        setTargetOptions(opts);
        if (opts.length === 1) {
          setSelectedTarget(opts[0].value);
        }
      })
      .finally(() => {
        if (active) setLoadingTargets(false);
      });

    return () => {
      active = false;
    };
  }, [jenis, gender, namaGuru, tanggal, hari]);

  // Load student roster when selectedTarget changes
  useEffect(() => {
    if (!selectedTarget || !namaGuru.trim()) {
      setSiswaList([]);
      return;
    }
    const [targetGrup, mapel] = selectedTarget.split('|');
    let active = true;
    setLoadingSiswa(true);
    const url = `/api/presensi/siswa?tanggal=${encodeURIComponent(tanggal)}&guru=${encodeURIComponent(namaGuru)}&targetGrup=${encodeURIComponent(targetGrup)}&mapel=${encodeURIComponent(mapel)}&jenisPresensi=${encodeURIComponent(jenis)}&gender=${encodeURIComponent(gender)}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.error) {
          notify(data.error, 'error');
          return;
        }
        setSiswaList(data.siswa || []);
        setMateri(data.materi || '');
        setIsEditMode(Boolean(data.isEdit));
        setGrupAktif(data.grupAktif || targetGrup);
      })
      .finally(() => {
        if (active) setLoadingSiswa(false);
      });
    return () => {
      active = false;
    };
  }, [selectedTarget, tanggal, namaGuru, jenis, gender, notify]);

  const handleStatusChange = (idx: number, status: AttendanceStatus) => {
    setSiswaList((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              status,
              keterangan: status === 'H' || status === 'T' ? '' : item.keterangan,
              syncedFromAsrama: false,
            }
          : item
      )
    );
    if (status === 'S' || status === 'I' || status === 'A') {
      setOpenReasonIdx(idx);
    } else {
      setOpenReasonIdx(null);
    }
  };

  const handleFieldChange = (idx: number, field: keyof StudentFormEntry, value: string) => {
    setSiswaList((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const handleSave = async () => {
    if (!selectedTarget || !namaGuru.trim() || siswaList.length === 0) return;
    const [kelas, mapel] = selectedTarget.split('|');
    setSaving(true);
    try {
      const res = await fetch('/api/presensi/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenisPresensi: jenis,
          gender,
          tanggal,
          guru: namaGuru,
          kelas,
          mapel,
          materi,
          siswa: siswaList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Gagal menyimpan presensi.', 'error');
      } else {
        notify(data.message || 'Presensi berhasil disimpan.', 'success');
        setIsEditMode(true);
        onSaved?.();
      }
    } catch {
      notify('Terjadi kesalahan jaringan saat menyimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyQuickLink = () => {
    if (!namaGuru.trim()) {
      notify('Pilih nama guru terlebih dahulu untuk menyalin tautan cepat.', 'info');
      return;
    }
    const url = `${window.location.origin}/?guru=${encodeURIComponent(namaGuru.trim())}`;
    navigator.clipboard.writeText(url);
    notify(`Tautan cepat tanpa login untuk ${namaGuru} berhasil disalin.`, 'success');
  };

  const roleLabel =
    jenis === 'Asrama'
      ? gender === 'Putra'
        ? 'Musyrif Asrama'
        : 'Musyrifah Asrama'
      : jenis === 'Al-Quran'
      ? "Pengampu Al-Qur'an"
      : 'Guru Pengajar';

  const syncedCount = siswaList.filter((s) => s.syncedFromAsrama).length;
  const counts = siswaList.reduce(
    (acc, s) => {
      acc[s.status]++;
      return acc;
    },
    { H: 0, T: 0, S: 0, I: 0, A: 0 } as Record<AttendanceStatus, number>
  );

  const panelTint =
    jenis === 'Asrama'
      ? 'border-indigo-200 bg-gradient-to-b from-indigo-50/60 via-white to-white'
      : jenis === 'Al-Quran'
      ? 'border-emerald-200 bg-gradient-to-b from-emerald-50/60 via-white to-white'
      : 'border-sky-200 bg-gradient-to-b from-sky-50/60 via-white to-white';

  const saveBtnClass =
    jenis === 'Asrama'
      ? 'bg-indigo-600 hover:bg-indigo-700'
      : jenis === 'Al-Quran'
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : 'bg-sky-600 hover:bg-sky-700';

  return (
    <div className="space-y-6">
      {/* Division Switcher & Zero-Login Teacher Attribution Notice */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/80 w-full sm:w-auto">
          {(
            [
              {
                id: 'Asrama',
                label: 'Asrama',
                icon: Home,
                activeCls: 'bg-indigo-600 text-white shadow-sm',
                iconInactiveCls: 'text-indigo-600',
              },
              {
                id: 'Belajar',
                label: 'Akademik',
                icon: BookOpen,
                activeCls: 'bg-sky-600 text-white shadow-sm',
                iconInactiveCls: 'text-sky-600',
              },
              {
                id: 'Al-Quran',
                label: "Al-Qur'an",
                icon: BookMarked,
                activeCls: 'bg-emerald-600 text-white shadow-sm',
                iconInactiveCls: 'text-emerald-600',
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = jenis === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setJenis(tab.id)}
                className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap min-w-0 ${
                  active ? tab.activeCls : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-white' : tab.iconInactiveCls}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-semibold text-teal-700">
            <UserCheck className="h-4 w-4" />
            Input cepat tanpa login · Otomatis masuk ke rekapan akun guru
          </span>
          {namaGuru.trim() && (
            <button
              type="button"
              onClick={copyQuickLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap shrink-0"
            >
              <Copy className="h-3 w-3" />
              Salin Link Saya
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left / Minimized Control Panel */}
        {controlsMinimized ? (
          <div className={`lg:col-span-12 rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${panelTint}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
              <span className="font-bold text-slate-900">Kontrol Presensi:</span>
              <span className="font-semibold">{jenis}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold">{gender}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">{tanggal} ({hari})</span>
              {namaGuru && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-slate-900">{namaGuru}</span>
                </>
              )}
              {grupAktif && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-teal-800">{grupAktif}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {siswaList.length > 0 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm disabled:bg-slate-300 ${saveBtnClass}`}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Menyimpan...' : isEditMode ? 'Perbarui Presensi' : 'Simpan Presensi'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setControlsMinimized(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Tampilkan Kontrol
              </button>
            </div>
          </div>
        ) : (
        <div className={`lg:col-span-4 xl:col-span-3 rounded-xl border p-5 space-y-4 ${panelTint}`}>
          <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Kontrol Presensi</h2>
              <span className="text-[11px] font-semibold text-slate-500 font-mono-num">{hari}</span>
            </div>
            <button
              type="button"
              onClick={() => setControlsMinimized(true)}
              title="Minimize panel kontrol"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Minimize
            </button>
          </div>

          {/* Wilayah Putra / Putri */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Wilayah Asrama / Kelas</label>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
              {(['Putri', 'Putra'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`rounded-lg py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                    gender === g
                      ? g === 'Putri'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Wilayah {g}
                </button>
              ))}
            </div>
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal Presensi</label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTanggal((t) => shiftDateStr(t, -1))}
                aria-label="Hari sebelumnya"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-900 font-mono-num focus:border-teal-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setTanggal((t) => shiftDateStr(t, 1))}
                aria-label="Hari berikutnya"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Nama Guru */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{roleLabel}</label>
            <select
              value={namaGuru}
              onChange={(e) => setNamaGuru(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              <option value="">-- Pilih {roleLabel} --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.nama}>
                  {t.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Kamar / Kelas / Halaqah */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {jenis === 'Asrama' ? 'Kamar Binaan' : jenis === 'Al-Quran' ? "Kelompok Al-Qur'an" : 'Jadwal Kelas & Mapel'}
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              disabled={loadingTargets || targetOptions.length === 0}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:border-teal-600 focus:outline-none"
            >
              <option value="">
                {loadingTargets
                  ? 'Memuat jadwal...'
                  : !namaGuru
                  ? '-- Pilih guru dahulu --'
                  : targetOptions.length === 0
                  ? 'Tidak ada jadwal / kamar'
                  : '-- Pilih Target --'}
              </option>
              {targetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Materi / Catatan */}
          {jenis !== 'Al-Quran' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {jenis === 'Asrama' ? 'Catatan Asrama' : 'Materi Pembelajaran'}
              </label>
              <textarea
                rows={3}
                value={materi}
                onChange={(e) => setMateri(e.target.value.toUpperCase())}
                placeholder={jenis === 'Asrama' ? 'Catatan apel pagi / kebersihan...' : 'Pokok bahasan hari ini...'}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          )}

          {/* Save Button */}
          <button
            type="button"
            disabled={saving || siswaList.length === 0}
            onClick={handleSave}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300 transition-colors ${saveBtnClass}`}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan Batch...' : isEditMode ? 'Perbarui Presensi' : 'Simpan Presensi'}
          </button>
        </div>
        )}

        {/* Right Student Roster */}
        <div
          className={`${
            controlsMinimized ? 'lg:col-span-12' : 'lg:col-span-8 xl:col-span-9'
          } rounded-xl border border-slate-200 bg-white overflow-hidden`}
        >
          {/* Header Bar */}
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedTarget
                    ? `${jenis === 'Asrama' ? 'Kamar' : jenis === 'Al-Quran' ? 'Halaqah' : 'Kelas'} ${grupAktif}`
                    : `Daftar Santri · Wilayah ${gender}`}
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className={`font-semibold ${gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'}`}>
                    Wilayah {gender}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedTarget ? selectedTarget.split('|')[1] : 'Pilih guru dan jadwal di panel kontrol'}</span>
                  {siswaList.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num font-semibold text-slate-800">{siswaList.length} santri</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num font-bold text-emerald-700">H:{counts.H}</span>
                      <span className="font-mono-num font-bold text-amber-700">T:{counts.T}</span>
                      <span className="font-mono-num font-bold text-sky-700">S:{counts.S}</span>
                      <span className="font-mono-num font-bold text-violet-700">I:{counts.I}</span>
                      <span className="font-mono-num font-bold text-rose-700">A:{counts.A}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {isEditMode && (
                  <span className="font-semibold text-amber-700">Mode Edit (Data Tersimpan)</span>
                )}
                {syncedCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-sky-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {syncedCount} sinkron otomatis dari Asrama
                  </span>
                )}
              </div>
            </div>

            {siswaList.length > 0 && (
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden flex">
                <div style={{ width: `${(counts.H / siswaList.length) * 100}%` }} className="bg-emerald-500 transition-all" />
                <div style={{ width: `${(counts.T / siswaList.length) * 100}%` }} className="bg-amber-500 transition-all" />
                <div style={{ width: `${(counts.S / siswaList.length) * 100}%` }} className="bg-sky-500 transition-all" />
                <div style={{ width: `${(counts.I / siswaList.length) * 100}%` }} className="bg-violet-500 transition-all" />
                <div style={{ width: `${(counts.A / siswaList.length) * 100}%` }} className="bg-rose-500 transition-all" />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-5">
            {loadingSiswa ? (
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : siswaList.length === 0 ? (
              <div className="py-14 text-center space-y-3">
                <p className="text-sm font-medium text-slate-700">Belum ada daftar santri dimuat</p>
                <p className="mx-auto max-w-md text-xs text-slate-500">
                  Pilih nama guru/musyrif dan kamar atau jadwal di sebelah kiri. Jika jadwal belum ada atau data santri masih kosong, Anda dapat membuatnya atau mengimpor CSV.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {onOpenJadwal && (
                    <button
                      type="button"
                      onClick={onOpenJadwal}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      Buat / Ubah Jadwal Sendiri
                    </button>
                  )}
                  {onOpenImport && (
                    <button
                      type="button"
                      onClick={onOpenImport}
                      className="rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      Upload Data SIM (CSV)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={`grid grid-cols-1 gap-3 ${controlsMinimized ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}>
                {siswaList.map((s, idx) => {
                  const reasonList =
                    s.status === 'S' ? ALASAN_SAKIT : s.status === 'I' ? ALASAN_IZIN : s.status === 'A' ? ALASAN_ALFA : [];
                  return (
                    <div
                      key={s.nama}
                      className={`rounded-lg border p-3.5 transition-colors ${
                        s.status !== 'H' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-xs font-semibold text-slate-400">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="truncate text-sm font-semibold text-slate-900">{s.nama}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <span>{s.kelasAsli}</span>
                            {s.syncedFromAsrama && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-sky-700">Sinkron Asrama</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Segmented Controls */}
                        <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                          {(
                            [
                              { code: 'H', activeClass: 'bg-emerald-600 text-white' },
                              { code: 'T', activeClass: 'bg-slate-600 text-white' },
                              { code: 'S', activeClass: 'bg-amber-600 text-white' },
                              { code: 'I', activeClass: 'bg-sky-600 text-white' },
                              { code: 'A', activeClass: 'bg-rose-600 text-white' },
                            ] as const
                          ).map((st) => {
                            const selected = s.status === st.code;
                            return (
                              <button
                                key={st.code}
                                type="button"
                                onClick={() => handleStatusChange(idx, st.code)}
                                className={`h-8 w-8 rounded-md text-xs font-bold transition-colors ${
                                  selected ? st.activeClass : 'text-slate-500 hover:bg-slate-200/70'
                                }`}
                              >
                                {st.code}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Keterangan & Quick Reason Dropdown */}
                      <div className="mt-2.5">
                        <input
                          type="text"
                          value={s.keterangan}
                          onFocus={() => {
                            if (s.status === 'S' || s.status === 'I' || s.status === 'A') setOpenReasonIdx(idx);
                          }}
                          onChange={(e) => handleFieldChange(idx, 'keterangan', e.target.value)}
                          placeholder={
                            s.status === 'H' || s.status === 'T'
                              ? 'Catatan opsional...'
                              : 'Pilih alasan cepat atau ketik keterangan...'
                          }
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                        />

                        {openReasonIdx === idx && reasonList.length > 0 && (
                          <div className="mt-1.5 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-sm">
                            {reasonList.map((reason) => (
                              <button
                                key={reason}
                                type="button"
                                onClick={() => {
                                  handleFieldChange(idx, 'keterangan', reason);
                                  setOpenReasonIdx(null);
                                }}
                                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                              >
                                <span>{reason}</span>
                                {s.keterangan === reason && <Check className="h-3.5 w-3.5 text-teal-700" />}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setOpenReasonIdx(null)}
                              className="mt-1 w-full rounded bg-slate-100 py-1 text-center text-xs font-medium text-slate-600 hover:bg-slate-200"
                            >
                              Tutup Pilihan
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Al-Qur'an Extra Inputs */}
                      {jenis === 'Al-Quran' && (
                        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                          <input
                            type="text"
                            value={s.tilawah || ''}
                            onChange={(e) => handleFieldChange(idx, 'tilawah', e.target.value)}
                            placeholder="Tilawah"
                            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                          />
                          <input
                            type="text"
                            value={s.murajaah || ''}
                            onChange={(e) => handleFieldChange(idx, 'murajaah', e.target.value)}
                            placeholder="Murajaah"
                            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                          />
                          <input
                            type="text"
                            value={s.setoran || ''}
                            onChange={(e) => handleFieldChange(idx, 'setoran', e.target.value)}
                            placeholder="Setoran"
                            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 focus:border-teal-600 focus:bg-white focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
