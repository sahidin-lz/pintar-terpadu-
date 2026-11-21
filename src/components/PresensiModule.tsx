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
  RoomMapping,
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
import {
  cleanGuruDisplayName,
  emitDataMutated,
  ensureServerHydratedFromMirror,
  isAdminSuperName,
  loadScopedState,
  loadSubTab,
  matchGroupClient,
  matchTeacherClient,
  saveScopedState,
  saveSubTab,
} from '../utils/sessionPersistence';

interface PresensiModuleProps {
  initialGuru?: string;
  initialJenis?: PresensiType;
  initialGender?: Gender;
  initialTarget?: string;
  presetKey?: number;
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
  filledToday?: boolean;
  isBatchAll?: boolean;
}

interface EnrichedRoomDetail extends RoomMapping {
  filledToday?: boolean;
  studentCount?: number;
}

export const PresensiModule: React.FC<PresensiModuleProps> = ({
  initialGuru,
  initialJenis,
  initialGender,
  initialTarget,
  presetKey,
  loggedInUser,
  onSaved,
  onOpenJadwal,
  onOpenImport,
  notify,
}) => {
  const [jenis, setJenis] = useState<PresensiType>(() =>
    initialJenis ||
    loadSubTab(
      'pintar_presensi_jenis_v1',
      ['Asrama', 'Belajar', 'Al-Quran'] as const,
      loggedInUser?.peran === 'Musyrif' || loggedInUser?.peran === 'Musyrifah' || loggedInUser?.peran === 'Wali Asrama'
        ? 'Asrama'
        : loggedInUser?.peran === 'Guru'
        ? 'Belajar'
        : 'Asrama',
    ),
  );
  const [gender, setGender] = useState<Gender>(() =>
    initialGender ||
    loadSubTab(
      'pintar_presensi_gender_v1',
      ['Putra', 'Putri'] as const,
      loggedInUser?.genderScope === 'Putri' ? 'Putri' : loggedInUser?.genderScope === 'Putra' ? 'Putra' : 'Putri',
    ),
  );
  const [tanggal, setTanggal] = useState<string>(getTodayDateStr());
  const [teachers, setTeachers] = useState<TeacherPublic[]>([]);
  const isRealTeachingUser = (u?: TeacherPublic | null): boolean =>
    Boolean(u?.nama && !isAdminSuperName(u.nama));

  const isValidGuruName = (name?: string | null): boolean =>
    Boolean(name && !isAdminSuperName(name));

  const [namaGuru, setNamaGuru] = useState<string>(() => {
    if (isValidGuruName(initialGuru)) return cleanGuruDisplayName(initialGuru);
    const saved = cleanGuruDisplayName(loadScopedState<string>('pintar_presensi_guru_v1', ''));
    if (isValidGuruName(saved)) return saved;
    return isRealTeachingUser(loggedInUser) ? cleanGuruDisplayName(loggedInUser!.nama) : '';
  });

  useEffect(() => {
    saveSubTab('pintar_presensi_jenis_v1', jenis);
  }, [jenis]);

  useEffect(() => {
    saveSubTab('pintar_presensi_gender_v1', gender);
  }, [gender]);

  useEffect(() => {
    if (isValidGuruName(namaGuru)) {
      saveScopedState('pintar_presensi_guru_v1', cleanGuruDisplayName(namaGuru));
    }
  }, [namaGuru]);
  const [targetOptions, setTargetOptions] = useState<TargetOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>(initialTarget || '');
  const [loadingTargets, setLoadingTargets] = useState<boolean>(false);
  const [targetRefreshTick, setTargetRefreshTick] = useState<number>(0);

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
    if (presetKey && initialJenis) setJenis(initialJenis);
    if (presetKey && initialGender) setGender(initialGender);
    if (presetKey && initialTarget) setSelectedTarget(initialTarget);
  }, [presetKey, initialJenis, initialGender, initialTarget]);

  // Sync only when external initialGuru or loggedInUser prop changes — never fight user dropdown clicks
  useEffect(() => {
    if (isValidGuruName(initialGuru)) {
      setNamaGuru(cleanGuruDisplayName(initialGuru));
    } else if (isRealTeachingUser(loggedInUser)) {
      setNamaGuru((prev) => (isValidGuruName(prev) ? prev : cleanGuruDisplayName(loggedInUser!.nama)));
      if (loggedInUser!.genderScope === 'Putri' || loggedInUser!.genderScope === 'Putra') {
        setGender(loggedInUser!.genderScope);
      }
    } else {
      setNamaGuru((prev) => (isValidGuruName(prev) ? prev : ''));
    }
  }, [initialGuru, loggedInUser]);

  useEffect(() => {
    const onSync = () => {
      setTargetRefreshTick((n) => n + 1);
    };
    window.addEventListener('pintar:data-restored', onSync);
    window.addEventListener('pintar:data-mutated', onSync);
    return () => {
      window.removeEventListener('pintar:data-restored', onSync);
      window.removeEventListener('pintar:data-mutated', onSync);
    };
  }, []);

  // Load filtered teacher list whenever jenis, gender, hari (for Belajar & Al-Quran), or targetRefreshTick changes
  useEffect(() => {
    let active = true;
    const hariQuery =
      (jenis === 'Belajar' || jenis === 'Al-Quran') && hari ? `&hari=${encodeURIComponent(hari)}` : '';

    const loadTeachersForPresensi = async () => {
      try {
        const res = await fetch(
          `/api/presensi/teachers?jenis=${encodeURIComponent(jenis)}&gender=${encodeURIComponent(gender)}${hariQuery}`,
        );
        let list: TeacherPublic[] = res.ok ? await res.json() : [];

        // If serverless container or dev server cold-started empty, auto-restore from localStorage mirror
        if (list.length === 0) {
          const restored = await ensureServerHydratedFromMirror();
          if (restored) {
            const retryRes = await fetch(
              `/api/presensi/teachers?jenis=${encodeURIComponent(jenis)}&gender=${encodeURIComponent(gender)}${hariQuery}`,
            );
            if (retryRes.ok) {
              list = await retryRes.json();
            }
          }
        }

        // If current gender has 0 teachers but the other Wilayah has scheduled teachers on this day, switch automatically
        if (list.length === 0) {
          const otherGender: Gender = gender === 'Putri' ? 'Putra' : 'Putri';
          const otherRes = await fetch(
            `/api/presensi/teachers?jenis=${encodeURIComponent(jenis)}&gender=${encodeURIComponent(otherGender)}${hariQuery}`,
          );
          const otherList: TeacherPublic[] = otherRes.ok ? await otherRes.json() : [];
          if (active && otherList.length > 0) {
            setGender(otherGender);
            return;
          }
        }

        if (!active) return;
        setTeachers(Array.isArray(list) ? list : []);

        if (Array.isArray(list) && list.length > 0) {
          setNamaGuru((prev) => {
            if (prev) {
              const exactOrFlexMatch =
                list.find((t) => cleanGuruDisplayName(t.nama).toUpperCase() === cleanGuruDisplayName(prev).toUpperCase()) ||
                list.find((t) => matchTeacherClient(t.nama, prev));
              if (exactOrFlexMatch) return exactOrFlexMatch.nama;
            }
            if (isRealTeachingUser(loggedInUser)) {
              const matchedUser =
                list.find((t) => cleanGuruDisplayName(t.nama).toUpperCase() === cleanGuruDisplayName(loggedInUser!.nama).toUpperCase()) ||
                list.find((t) => matchTeacherClient(t.nama, loggedInUser!.nama));
              if (matchedUser) return matchedUser.nama;
            }
            return list[0].nama;
          });
        } else if (jenis === 'Belajar' || jenis === 'Al-Quran') {
          setNamaGuru('');
        } else {
          setNamaGuru((prev) => (isAdminSuperName(prev) ? '' : cleanGuruDisplayName(prev)));
        }
      } catch {
        // Ignore network errors
      }
    };

    loadTeachersForPresensi();
    return () => {
      active = false;
    };
  }, [jenis, gender, hari, loggedInUser, targetRefreshTick]);

  // Load target rooms / classes whenever guru, jenis, gender, tanggal, or targetRefreshTick changes
  useEffect(() => {
    if (!isValidGuruName(namaGuru) || !tanggal) {
      setLoadingTargets(false);
      setTargetOptions([]);
      setSelectedTarget('');
      setSiswaList([]);
      return;
    }

    let active = true;
    setLoadingTargets(true);

    const url = `/api/presensi/opsi?jenis=${encodeURIComponent(jenis)}&gender=${encodeURIComponent(gender)}&guru=${encodeURIComponent(namaGuru)}&hari=${encodeURIComponent(hari)}&tanggal=${encodeURIComponent(tanggal)}`;

    const fetchAndBuildTargets = async () => {
      try {
        let res = await fetch(url);
        let data = res.ok ? await res.json() : {};
        const isEmpty =
          jenis === 'Asrama'
            ? !Array.isArray(data.rooms) || data.rooms.length === 0
            : !Array.isArray(data.jadwal) || data.jadwal.length === 0;

        if (isEmpty) {
          const restored = await ensureServerHydratedFromMirror();
          if (restored) {
            res = await fetch(url);
            data = res.ok ? await res.json() : {};
          }
        }

        if (!active) return;
        const opts: TargetOption[] = [];
        if (jenis === 'Asrama' && Array.isArray(data.rooms)) {
          const details: EnrichedRoomDetail[] = Array.isArray(data.roomDetails) ? data.roomDetails : [];
          const detailMap = new Map(
            details.map((d) => [d.kamar.trim().toUpperCase(), d]),
          );
          const allFilled = details.length > 0 && details.every((d) => Boolean(d.filledToday));
          if (data.rooms.length > 1) {
            const filledCount = details.filter((d) => d.filledToday).length;
            opts.push({
              value: `${data.rooms.join(',')}|KELUAR ASRAMA`,
              label: `Semua Kamar Binaan (${data.rooms.length})${filledCount > 0 ? ` · ${filledCount}/${data.rooms.length} Sudah Diisi` : ''}`,
              grup: data.rooms.join(','),
              mapel: 'KELUAR ASRAMA',
              filledToday: allFilled,
              isBatchAll: true,
            });
          }
          data.rooms.forEach((rm: string) => {
            const detail = detailMap.get(rm.trim().toUpperCase());
            const wali = detail?.musyrif || namaGuru;
            const filledBadge = detail?.filledToday ? ' ✓ Sudah Presensi' : '';
            opts.push({
              value: `${rm}|KELUAR ASRAMA`,
              label: `${rm} — Wali Asrama: ${wali}${filledBadge}`,
              grup: rm,
              mapel: 'KELUAR ASRAMA',
              filledToday: Boolean(detail?.filledToday),
            });
          });
        } else if (Array.isArray(data.jadwal)) {
          data.jadwal.forEach((j: { kelas: string; mapel: string; jamKe: string; filledToday?: boolean }) => {
            const jamLabel =
              j.jamKe.toLowerCase().includes('jam') ||
              j.jamKe.toLowerCase().includes('halaqah') ||
              j.jamKe.toLowerCase().includes('harian') ||
              j.jamKe.toLowerCase().includes('kelompok') ||
              j.jamKe.toLowerCase().includes('pengampu') ||
              j.jamKe.toLowerCase().includes('kode')
                ? j.jamKe
                : `Jam ${j.jamKe}`;
            const filledBadge = j.filledToday ? ' ✓ Sudah Presensi' : '';
            opts.push({
              value: `${j.kelas}|${j.mapel}`,
              label: `${j.kelas} — ${j.mapel} (${jamLabel})${filledBadge}`,
              grup: j.kelas,
              mapel: j.mapel,
              filledToday: Boolean(j.filledToday),
              isBatchAll: j.kelas.includes(','),
            });
          });
        }
        setTargetOptions(opts);
        setSelectedTarget((prev) => {
          const desired = initialTarget || prev;
          if (desired) {
            const exact = opts.find((o) => o.value.toUpperCase() === desired.toUpperCase());
            if (exact) return exact.value;
            const [dGrup, dMapel] = desired.split('|');
            const byGroup = opts.find(
              (o) =>
                matchGroupClient(o.grup, dGrup) &&
                (!dMapel || o.mapel.toUpperCase() === dMapel.toUpperCase()),
            );
            if (byGroup) return byGroup.value;
          }
          if (prev && opts.some((o) => o.value === prev)) {
            return prev;
          }
          return opts.length >= 1 ? opts[0].value : '';
        });
      } finally {
        if (active) setLoadingTargets(false);
      }
    };

    fetchAndBuildTargets();

    return () => {
      active = false;
    };
  }, [jenis, gender, namaGuru, tanggal, hari, targetRefreshTick, initialTarget]);

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

    const fetchRoster = async () => {
      try {
        let res = await fetch(url);
        let data = res.ok ? await res.json() : {};
        if (!Array.isArray(data.siswa) || data.siswa.length === 0) {
          const restored = await ensureServerHydratedFromMirror();
          if (restored) {
            res = await fetch(url);
            data = res.ok ? await res.json() : {};
          }
        }
        if (!active) return;
        if (data.error) {
          notify(data.error, 'error');
          return;
        }
        setSiswaList(data.siswa || []);
        setMateri(data.materi || '');
        setIsEditMode(Boolean(data.isEdit));
        setGrupAktif(data.grupAktif || targetGrup);
      } finally {
        if (active) setLoadingSiswa(false);
      }
    };

    fetchRoster();
    return () => {
      active = false;
    };
  }, [selectedTarget, tanggal, namaGuru, jenis, gender, targetRefreshTick, notify]);

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
        setTargetRefreshTick((n) => n + 1);
        emitDataMutated();
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
        ? 'Wali Asrama (Musyrif Putra)'
        : 'Wali Asrama (Musyrifah Putri)'
      : jenis === 'Al-Quran'
      ? "Pengampu Al-Qur'an"
      : 'Guru Akademik';

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
              <option value="">
                {jenis === 'Belajar' && teachers.length === 0
                  ? `-- Tidak ada guru akademik terjadwal hari ${hari} --`
                  : jenis === 'Al-Quran' && teachers.length === 0
                  ? `-- Tidak ada guru Al-Qur'an terjadwal hari ${hari} --`
                  : `-- Pilih ${roleLabel} --`}
              </option>
              {teachers.map((t) => {
                const hint =
                  jenis === 'Asrama' && t.kamarBinaan?.length
                    ? ` (${t.kamarBinaan.join(', ')})`
                    : jenis === 'Al-Quran' && t.kelompokQuranBinaan?.length
                    ? ` (${t.kelompokQuranBinaan.join(', ')})`
                    : jenis === 'Belajar' && t.waliKelasOf
                    ? ` (Wali Kelas ${t.waliKelasOf})`
                    : '';
                return (
                  <option key={t.id} value={t.nama}>
                    {t.nama}
                    {hint}
                  </option>
                );
              })}
            </select>
            {namaGuru && (() => {
              const activeT = teachers.find((t) => t.nama === namaGuru);
              if (!activeT) return null;
              const allRoles = Array.from(new Set([activeT.peran, ...(activeT.peranTambahan || [])]));
              return (
                <div className="mt-1.5 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] text-slate-600 space-y-0.5">
                  <div className="font-semibold text-slate-800">
                    Peran: {allRoles.join(' · ')}
                  </div>
                  {activeT.waliKelasOf && (
                    <div>Wali Kelas: <span className="font-semibold text-sky-800">{activeT.waliKelasOf}</span></div>
                  )}
                  {activeT.kamarBinaan && activeT.kamarBinaan.length > 0 && (
                    <div>Kamar Binaan: <span className="font-semibold text-indigo-800">{activeT.kamarBinaan.join(', ')}</span></div>
                  )}
                  {activeT.kelompokQuranBinaan && activeT.kelompokQuranBinaan.length > 0 && (
                    <div>Kode Kelas Al-Qur&apos;an: <span className="font-semibold text-emerald-800">{activeT.kelompokQuranBinaan.join(', ')}</span></div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Kamar / Kelas / Halaqah */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {jenis === 'Asrama'
                  ? 'Kamar Binaan (Semua / Per Kamar)'
                  : jenis === 'Al-Quran'
                  ? "Jadwal & Kode Kelas Al-Qur'an"
                  : 'Jadwal Kelas & Mapel'}
              </label>
              {(() => {
                const singleOpts = targetOptions.filter((o) => !o.isBatchAll);
                if (singleOpts.length === 0) return null;
                const filledCount = singleOpts.filter((o) => o.filledToday).length;
                return (
                  <span
                    className={`text-[11px] font-bold font-mono-num ${
                      filledCount === singleOpts.length && singleOpts.length > 0
                        ? 'text-emerald-700'
                        : filledCount > 0
                        ? 'text-teal-700'
                        : 'text-slate-500'
                    }`}
                  >
                    Progres: {filledCount}/{singleOpts.length} Selesai
                  </span>
                );
              })()}
            </div>
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
                  ? jenis === 'Belajar'
                    ? `Tidak ada jadwal akademik hari ${hari}`
                    : jenis === 'Al-Quran'
                    ? `Tidak ada jadwal Al-Qur'an hari ${hari}`
                    : 'Tidak ada jadwal / kamar'
                  : '-- Pilih Target --'}
              </option>
              {targetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Quick Clickable Progress Chips per Kamar / Jadwal */}
            {(() => {
              const singleOpts = targetOptions.filter((o) => !o.isBatchAll);
              if (singleOpts.length === 0) return null;
              return (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {singleOpts.map((opt) => {
                    const isSelected = selectedTarget === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedTarget(opt.value)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                          opt.filledToday
                            ? isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : isSelected
                            ? 'border-slate-700 bg-slate-800 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt.filledToday && <Check className="h-3 w-3 shrink-0" />}
                        <span>{opt.grup}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
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
                    ? `${jenis === 'Asrama' ? 'Kamar' : jenis === 'Al-Quran' ? 'Kode Kelas Al-Qur’an' : 'Kelas'} ${grupAktif}`
                    : `Daftar Santri · Wilayah ${gender}`}
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className={`font-semibold ${gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'}`}>
                    Wilayah {gender}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedTarget ? selectedTarget.split('|')[1] : 'Pilih guru dan jadwal di panel kontrol'}</span>
                  {isValidGuruName(namaGuru) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-800">Pengampu/Pembina: {namaGuru}</span>
                    </>
                  )}
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

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {isEditMode ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
                    <Check className="h-3.5 w-3.5" />
                    Tersimpan · Terhubung ke Monitoring & Akun Guru
                  </span>
                ) : siswaList.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                    Belum Disimpan Hari Ini
                  </span>
                ) : null}
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
                  Pilih nama guru/musyrif dan kamar atau jadwal di sebelah kiri. Jika jadwal belum ada atau data santri masih kosong, Anda dapat membuatnya atau mengimpor template.
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
                      Upload Data SIM (Excel)
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
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">{s.kelasAsli}</span>
                            {jenis !== 'Belajar' && s.kelas && s.kelas !== '-' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Kls: {s.kelas}</span>
                              </>
                            )}
                            {jenis !== 'Asrama' && s.kamar && s.kamar !== '-' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Kmr: {s.kamar}</span>
                              </>
                            )}
                            {jenis === 'Al-Quran' && s.pengampuQuran && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-700 font-medium">Pengampu: {s.pengampuQuran}</span>
                              </>
                            )}
                            {s.waliKelas && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>WK: {s.waliKelas}</span>
                              </>
                            )}
                            {s.guruWali && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-violet-700 font-medium">GW: {s.guruWali}</span>
                              </>
                            )}
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
