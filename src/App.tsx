/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BookCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  Info,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  ShieldCheck,
  Upload,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { AkunGuruModule } from './components/AkunGuruModule';
import { DasborTerpaduModule } from './components/DasborTerpaduModule';
import { ImportSimModule } from './components/ImportSimModule';
import { JadwalModule } from './components/JadwalModule';
import { LabkomRuangModule } from './components/LabkomRuangModule';
import { LoginPortal, type LoginPortalTab } from './components/LoginPortal';
import { MonitoringLaporanModule } from './components/MonitoringLaporanModule';
import { ParentPortalModule } from './components/ParentPortalModule';
import { PiketInvalModule } from './components/PiketInvalModule';
import { PresensiModule } from './components/PresensiModule';
import { QuotaBridgeModule } from './components/QuotaBridgeModule';
import { UjianModule } from './components/UjianModule';
import { WaliKelasModule } from './components/WaliKelasModule';
import type {
  DashboardStats,
  Gender,
  PembinaanJalur,
  PresensiType,
  ReportOptions,
  RoomMapping,
  SystemCounts,
  TeacherPublic,
  WilayahFilter,
} from './types';
import { getAcademicSemester } from './utils/semesterHelpers';
import {
  loadPersistedModule,
  loadPersistedQuickGuru,
  loadPersistedUser,
  savePersistedModule,
  savePersistedQuickGuru,
  savePersistedUser,
} from './utils/sessionPersistence';

const VALID_MODULES: readonly ActiveModule[] = [
  'presensi',
  'labkom',
  'walikelas',
  'dashboard',
  'jadwal',
  'akunguru',
  'ujian',
  'piket',
  'monitoring',
  'parentportal',
  'import',
  'quota',
];

type ActiveModule =
  | 'presensi'
  | 'labkom'
  | 'walikelas'
  | 'dashboard'
  | 'jadwal'
  | 'akunguru'
  | 'ujian'
  | 'piket'
  | 'monitoring'
  | 'parentportal'
  | 'import'
  | 'quota';

interface BootstrapPayload {
  teachers: TeacherPublic[];
  rooms: RoomMapping[];
  options: ReportOptions;
  stats: DashboardStats;
  counts: SystemCounts;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const MODULE_META: Record<
  ActiveModule,
  {
    title: string;
    group: string;
    tileBg: string;
    tileActive: string;
    rowActive: string;
    headerAccent: string;
  }
> = {
  dashboard: {
    title: 'Dasbor Terpadu (Absen Harian, Pembinaan & Labkom)',
    group: 'Dasbor & Pemantauan',
    tileBg: 'bg-teal-50 text-teal-700',
    tileActive: 'bg-teal-600 text-white',
    rowActive: 'bg-teal-50/90 text-teal-950 border-teal-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-teal-600',
  },
  presensi: {
    title: 'Input Presensi Harian (Tanpa Login)',
    group: 'Halaman Tanpa Login',
    tileBg: 'bg-emerald-50 text-emerald-700',
    tileActive: 'bg-emerald-600 text-white',
    rowActive: 'bg-emerald-50/90 text-emerald-950 border-emerald-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-emerald-500',
  },
  walikelas: {
    title: 'Input Pembinaan Santri (Tanpa Login)',
    group: 'Halaman Tanpa Login',
    tileBg: 'bg-violet-50 text-violet-700',
    tileActive: 'bg-violet-600 text-white',
    rowActive: 'bg-violet-50/90 text-violet-950 border-violet-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-violet-500',
  },
  labkom: {
    title: 'Peminjaman Labkom, Ruang SMA & Denah 40 PC',
    group: 'Halaman Tanpa Login',
    tileBg: 'bg-blue-50 text-blue-700',
    tileActive: 'bg-blue-600 text-white',
    rowActive: 'bg-blue-50/90 text-blue-950 border-blue-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-blue-500',
  },
  monitoring: {
    title: 'Monitoring Live, Analisis & Laporan Progres',
    group: 'Halaman Tanpa Login',
    tileBg: 'bg-indigo-50 text-indigo-700',
    tileActive: 'bg-indigo-600 text-white',
    rowActive: 'bg-indigo-50/90 text-indigo-950 border-indigo-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-indigo-500',
  },
  parentportal: {
    title: 'Portal Wali Santri (Cek NIS & Tanggal Lahir - Read Only)',
    group: 'Halaman Tanpa Login',
    tileBg: 'bg-teal-50 text-teal-700',
    tileActive: 'bg-teal-700 text-white',
    rowActive: 'bg-teal-50/90 text-teal-950 border-teal-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-teal-600',
  },
  ujian: {
    title: 'Ujian & Berita Acara',
    group: 'Halaman Tanpa Login',
    tileBg: 'bg-amber-50 text-amber-700',
    tileActive: 'bg-amber-600 text-white',
    rowActive: 'bg-amber-50/90 text-amber-950 border-amber-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-amber-500',
  },
  piket: {
    title: 'Piket Guru & Inval',
    group: 'Halaman Tanpa Login',
    tileBg: 'bg-rose-50 text-rose-700',
    tileActive: 'bg-rose-600 text-white',
    rowActive: 'bg-rose-50/90 text-rose-950 border-rose-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-rose-500',
  },
  jadwal: {
    title: 'Jadwal Mengajar, Perubahan JP & Pindah Kelas',
    group: 'Area Login (Guru & Admin)',
    tileBg: 'bg-cyan-50 text-cyan-700',
    tileActive: 'bg-cyan-600 text-white',
    rowActive: 'bg-cyan-50/90 text-cyan-950 border-cyan-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-cyan-500',
  },
  akunguru: {
    title: "Dashboard RBAC: Guru, Wali Kelas, Musyrif & Pengampu Al-Qur'an",
    group: 'Area Login (Guru & Admin)',
    tileBg: 'bg-sky-50 text-sky-700',
    tileActive: 'bg-sky-600 text-white',
    rowActive: 'bg-sky-50/90 text-sky-950 border-sky-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-sky-500',
  },
  import: {
    title: 'Admin Super, Template & Upload SIM',
    group: 'Area Login (Guru & Admin)',
    tileBg: 'bg-teal-50 text-teal-700',
    tileActive: 'bg-teal-600 text-white',
    rowActive: 'bg-teal-50/90 text-teal-950 border-teal-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-teal-500',
  },
  quota: {
    title: 'Arsitektur Anti-Kuota & Google Sheets',
    group: 'Area Login (Guru & Admin)',
    tileBg: 'bg-orange-50 text-orange-700',
    tileActive: 'bg-orange-600 text-white',
    rowActive: 'bg-orange-50/90 text-orange-950 border-orange-200 shadow-xs',
    headerAccent: 'border-t-2 border-t-orange-500',
  },
};

const DB_MIRROR_KEY = 'pintar_db_template_only_v2';
const LEGACY_BUNDLED_MIRROR_KEY = 'pintar_db_mirror_v1';
const DB_EXPLICIT_EMPTY_KEY = 'pintar_db_explicit_empty_v1';

function scoreCounts(c?: SystemCounts | null): number {
  if (!c) return 0;
  return (
    (c.students || 0) * 10 +
    Math.max(0, (c.teachers || 0) - 1) * 5 +
    (c.schedules || 0) * 4 +
    (c.attendanceLogs || 0) * 8 +
    (c.pembinaanRecords || 0) * 8 +
    (c.examLogs || 0) * 6 +
    (c.rooms || 0) * 2
  );
}

function scoreSnapshot(snap: Record<string, unknown> | null): number {
  if (!snap) return 0;
  const arrLen = (k: string) => (Array.isArray(snap[k]) ? (snap[k] as unknown[]).length : 0);
  return (
    arrLen('students') * 10 +
    Math.max(0, arrLen('teachers') - 1) * 5 +
    arrLen('schedules') * 4 +
    arrLen('attendanceLogs') * 8 +
    arrLen('pembinaanRecords') * 8 +
    arrLen('examLogs') * 6 +
    arrLen('rooms') * 2
  );
}

export default function App() {
  // Halaman depan langsung terbuka untuk input presensi & pembinaan tanpa login,
  // atau kembali ke halaman terakhir yang diakses saat refresh.
  const [entryMode, setEntryMode] = useState<'app' | 'login'>('app');
  const [loginTab, setLoginTab] = useState<LoginPortalTab>('guru');
  const [activeModule, setActiveModule] = useState<ActiveModule>(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (params?.get('guru')) return 'presensi';
    return loadPersistedModule(VALID_MODULES, 'presensi');
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'Akademik & Operasional': true,
    'Akun Peran & Admin': true,
  });
  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [unlockedTeacher, setUnlockedTeacher] = useState<TeacherPublic | null>(() =>
    loadPersistedUser(),
  );
  const [quickGuru, setQuickGuru] = useState<string>(() => {
    const u = loadPersistedUser();
    const fallbackName =
      u && u.peran !== 'Admin Super' && u.peran !== 'Admin SIM' ? u.nama : '';
    return loadPersistedQuickGuru(fallbackName);
  });
  const [presensiPreset, setPresensiPreset] = useState<{
    key: number;
    jenis?: PresensiType;
    gender?: Gender;
  }>({ key: 0 });
  const [pembinaanPreset, setPembinaanPreset] = useState<{
    key: number;
    jalur?: PembinaanJalur;
    wilayah?: WilayahFilter;
  }>({ key: 0 });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const restoredOnceRef = useRef<boolean>(false);

  const persistSessionUser = useCallback((teacher: TeacherPublic | null) => {
    savePersistedUser(teacher);
  }, []);

  useEffect(() => {
    savePersistedModule(activeModule);
  }, [activeModule]);

  useEffect(() => {
    savePersistedQuickGuru(quickGuru);
  }, [quickGuru]);

  const toggleGroupCollapsed = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const syncBrowserMirror = useCallback(async () => {
    try {
      const res = await fetch('/api/system/snapshot');
      if (!res.ok) return;
      const snap = (await res.json()) as Record<string, unknown>;
      if (scoreSnapshot(snap) <= 0) return;

      // Strip oversized inline base64 attachments (>64KB) so localStorage stays lightweight
      const compactAttachments = Array.isArray(snap.attachments)
        ? snap.attachments.slice(0, 50).map((att: Record<string, unknown>) => ({
            ...att,
            url:
              typeof att.url === 'string' && att.url.length > 65536
                ? ''
                : att.url,
          }))
        : [];

      const compactSnap = { ...snap, attachments: compactAttachments };
      localStorage.setItem(DB_MIRROR_KEY, JSON.stringify(compactSnap));
      localStorage.removeItem(LEGACY_BUNDLED_MIRROR_KEY);
      localStorage.removeItem(DB_EXPLICIT_EMPTY_KEY);
    } catch {
      // Ignore localStorage quota or transient network errors
    }
  }, []);

  const handleExplicitReset = useCallback(() => {
    try {
      localStorage.removeItem(DB_MIRROR_KEY);
      localStorage.removeItem(LEGACY_BUNDLED_MIRROR_KEY);
      localStorage.setItem(DB_EXPLICIT_EMPTY_KEY, '1');
    } catch {
      // Ignore
    }
  }, []);

  const loadBootstrap = useCallback(async (options?: { skipMirrorWrite?: boolean }) => {
    try {
      try {
        localStorage.removeItem(LEGACY_BUNDLED_MIRROR_KEY);
      } catch {
        // Ignore
      }
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BootstrapPayload;

      // Whenever a Vercel/GitHub deployment cold-starts empty (or with fewer records than the user's uploaded template mirror),
      // automatically restore the user's uploaded template data to the server.
      const serverScore = scoreCounts(data.counts);
      if (!restoredOnceRef.current || serverScore === 0) {
        restoredOnceRef.current = true;
        try {
          const explicitEmpty = localStorage.getItem(DB_EXPLICIT_EMPTY_KEY) === '1';
          const mirrorRaw = localStorage.getItem(DB_MIRROR_KEY);
          if (!explicitEmpty && mirrorRaw) {
            const mirrorSnap = JSON.parse(mirrorRaw) as Record<string, unknown>;
            const mirrorScore = scoreSnapshot(mirrorSnap);
            const mirrorHasLogs =
              (Array.isArray(mirrorSnap.attendanceLogs) && mirrorSnap.attendanceLogs.length > (data.counts.attendanceLogs || 0)) ||
              (Array.isArray(mirrorSnap.pembinaanRecords) && mirrorSnap.pembinaanRecords.length > (data.counts.pembinaanRecords || 0)) ||
              (Array.isArray(mirrorSnap.examLogs) && mirrorSnap.examLogs.length > (data.counts.examLogs || 0));

            if (mirrorScore > serverScore || mirrorHasLogs) {
              const restoreMode = serverScore === 0 ? 'replace' : 'merge';
              const restoreRes = await fetch('/api/system/restore-snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshot: mirrorSnap, mode: restoreMode }),
              });
              if (restoreRes.ok) {
                const refreshed = await fetch('/api/bootstrap');
                if (refreshed.ok) {
                  const refreshedData = (await refreshed.json()) as BootstrapPayload;
                  setBootstrap(refreshedData);
                  notify('Data hasil upload template Anda dipulihkan otomatis setelah pembaruan server.', 'info');
                  return;
                }
              }
            }
          }
        } catch {
          // Proceed with live bootstrap data
        }
      }

      setBootstrap(data);
      setUnlockedTeacher((prev) => {
        if (!prev) return prev;
        const fresh = data.teachers.find(
          (t) =>
            t.id === prev.id ||
            t.username.toLowerCase() === prev.username.toLowerCase() ||
            t.nama.toUpperCase() === prev.nama.toUpperCase(),
        );
        if (fresh) {
          persistSessionUser(fresh);
          return fresh;
        }
        return prev;
      });
      if (!options?.skipMirrorWrite && scoreCounts(data.counts) > 0) {
        syncBrowserMirror();
      }
    } catch {
      notify('Gagal memuat data master dari server.', 'error');
    }
  }, [notify, persistSessionUser, syncBrowserMirror]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guruParam = params.get('guru');
    if (guruParam) {
      setQuickGuru(guruParam);
      setActiveModule('presensi');
      setEntryMode('app');
    }
    loadBootstrap();
  }, [loadBootstrap]);

  // Sync browser mirror whenever any module emits pintar:data-mutated or when tab is backgrounded/refreshed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let syncTimer: number | null = null;

    const scheduleMirrorSync = () => {
      if (syncTimer) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => {
        syncBrowserMirror();
      }, 200);
    };

    const onVisibilityOrHide = () => {
      if (document.visibilityState === 'hidden') {
        syncBrowserMirror();
      }
    };

    window.addEventListener('pintar:data-mutated', scheduleMirrorSync);
    window.addEventListener('pagehide', syncBrowserMirror);
    document.addEventListener('visibilitychange', onVisibilityOrHide);
    return () => {
      window.removeEventListener('pintar:data-mutated', scheduleMirrorSync);
      window.removeEventListener('pagehide', syncBrowserMirror);
      document.removeEventListener('visibilitychange', onVisibilityOrHide);
      if (syncTimer) window.clearTimeout(syncTimer);
    };
  }, [syncBrowserMirror]);

  const navGroups: Array<{
    group: string;
    badge: string;
    cardTone: string;
    headerTone: string;
    badgeTone: string;
    items: Array<{
      id: ActiveModule;
      label: string;
      sub: string;
      icon: React.ComponentType<{ className?: string }>;
      requiresLogin?: boolean;
    }>;
  }> = [
    {
      group: 'Menu Utama',
      badge: 'Utama',
      cardTone: 'border-emerald-200/90 bg-gradient-to-b from-emerald-50/70 via-white to-white',
      headerTone: 'text-emerald-950 hover:text-emerald-700',
      badgeTone: 'text-emerald-700',
      items: [
        { id: 'presensi', label: 'Presensi Harian', sub: "Asrama · Al-Qur'an · Kelas", icon: BookCheck },
        { id: 'labkom', label: 'Peminjaman Labkom', sub: 'Lab Komputer & Ruang SMA', icon: Monitor },
      ],
    },
    {
      group: 'Pembinaan & Wali',
      badge: 'Santri',
      cardTone: 'border-violet-200/90 bg-gradient-to-b from-violet-50/70 via-white to-white',
      headerTone: 'text-violet-950 hover:text-violet-700',
      badgeTone: 'text-violet-700',
      items: [
        { id: 'walikelas', label: 'Pembinaan Santri', sub: 'Wali Kelas · Guru Wali · Room Visit', icon: ShieldCheck },
        { id: 'parentportal', label: 'Portal Wali Santri', sub: 'Cek Progres via NIS', icon: Users },
      ],
    },
    {
      group: 'Dasbor & Monitoring',
      badge: 'Visual',
      cardTone: 'border-indigo-200/90 bg-gradient-to-b from-indigo-50/70 via-white to-white',
      headerTone: 'text-indigo-950 hover:text-indigo-700',
      badgeTone: 'text-indigo-700',
      items: [
        { id: 'dashboard', label: 'Dasbor Terpadu', sub: 'Grafik Putra & Putri', icon: LayoutDashboard },
        { id: 'monitoring', label: 'Monitoring & Laporan', sub: 'Live KBM, Kamar & Bulanan', icon: BarChart3 },
      ],
    },
    {
      group: 'Akademik & Operasional',
      badge: 'KBM',
      cardTone: 'border-amber-200/90 bg-gradient-to-b from-amber-50/60 via-white to-white',
      headerTone: 'text-amber-950 hover:text-amber-700',
      badgeTone: 'text-amber-700',
      items: [
        { id: 'ujian', label: 'Ujian & Berita Acara', sub: 'Presensi & Susulan Ujian', icon: ClipboardCheck },
        { id: 'piket', label: 'Piket & Guru Inval', sub: 'Guru Absen & Pengganti', icon: UserX },
        { id: 'jadwal', label: 'Jadwal & Perubahan JP', sub: 'Atur JP & Pindah Kelas', icon: CalendarClock, requiresLogin: true },
      ],
    },
    {
      group: 'Akun Peran & Admin',
      badge: 'Login',
      cardTone: 'border-sky-200/90 bg-gradient-to-b from-sky-50/70 via-white to-white',
      headerTone: 'text-sky-950 hover:text-sky-700',
      badgeTone: 'text-sky-700',
      items: [
        { id: 'akunguru', label: 'Dasbor Peran Guru/Wali', sub: 'Rekap Mengajar & Asrama', icon: UserCheck, requiresLogin: true },
        { id: 'import', label: 'Admin Super & Upload', sub: 'Template Excel & Database', icon: Upload, requiresLogin: true },
        { id: 'quota', label: 'Anti-Kuota & Sheets', sub: 'Sinkronisasi Cloud', icon: Database, requiresLogin: true },
      ],
    },
  ];

  const openLoginPortal = (tab: LoginPortalTab) => {
    setLoginTab(tab);
    setMenuOpen(false);
    setEntryMode('login');
  };

  const handleSelectModule = (id: ActiveModule) => {
    setActiveModule(id);
    setMenuOpen(false);
  };

  const handleNavigateFromDashboard = useCallback(
    (
      mod: ActiveModule,
      opts?: { presensiJenis?: PresensiType; pembinaanJalur?: PembinaanJalur; wilayah?: WilayahFilter }
    ) => {
      if (mod === 'presensi' && (opts?.presensiJenis || opts?.wilayah)) {
        setPresensiPreset({
          key: Date.now(),
          jenis: opts.presensiJenis,
          gender: opts.wilayah === 'Putra' || opts.wilayah === 'Putri' ? opts.wilayah : undefined,
        });
      }
      if (mod === 'walikelas' && (opts?.pembinaanJalur || opts?.wilayah)) {
        setPembinaanPreset({
          key: Date.now(),
          jalur: opts.pembinaanJalur,
          wilayah: opts.wilayah,
        });
      }
      setActiveModule(mod);
      setMenuOpen(false);
    },
    []
  );

  const handleLoginSuccess = (teacher: TeacherPublic) => {
    setUnlockedTeacher(teacher);
    persistSessionUser(teacher);
    const isAdmin = teacher.peran === 'Admin Super' || teacher.peran === 'Admin SIM';
    setQuickGuru(isAdmin ? '' : teacher.nama);
    setActiveModule(isAdmin ? 'import' : 'akunguru');
    setEntryMode('app');
    loadBootstrap();
  };

  const handleAccountCreated = (teacher: TeacherPublic) => {
    setUnlockedTeacher(teacher);
    persistSessionUser(teacher);
    const isAdmin = teacher.peran === 'Admin Super' || teacher.peran === 'Admin SIM';
    setQuickGuru(isAdmin ? '' : teacher.nama);
    setActiveModule(isAdmin ? 'import' : 'akunguru');
    setEntryMode('app');
    loadBootstrap();
  };

  const handleLogout = () => {
    setUnlockedTeacher(null);
    persistSessionUser(null);
    setQuickGuru('');
    if (
      activeModule === 'akunguru' ||
      activeModule === 'import' ||
      activeModule === 'quota' ||
      activeModule === 'jadwal'
    ) {
      setActiveModule('presensi');
    }
  };

  const toastLayer = (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium shadow-md ${
            t.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : t.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : t.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );

  if (entryMode === 'login') {
    return (
      <>
        <LoginPortal
          initialTab={loginTab}
          teachers={bootstrap?.teachers || []}
          counts={bootstrap?.counts || null}
          onLoginSuccess={handleLoginSuccess}
          onAccountCreated={handleAccountCreated}
          onBackToPublic={(target = 'presensi') => {
            setActiveModule(target);
            setEntryMode('app');
          }}
          notify={notify}
        />
        {toastLayer}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Click-to-open Menu Backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[1px]"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* SIM PINTAR Professional Slide-Out Menu Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-slate-200 shadow-2xl text-slate-800 flex flex-col transition-transform duration-200 ease-out ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white shadow-sm shrink-0">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-base font-bold tracking-tight text-white truncate">
                SIM PINTAR
              </div>
              <div className="text-[11px] font-medium text-teal-200 truncate">
                Wilayah Putra &amp; Putri Terpisah
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="rounded-lg border border-white/15 bg-white/10 p-1.5 text-slate-200 hover:bg-white/20 hover:text-white transition-colors"
            aria-label="Tutup menu SIM PINTAR"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/80 bg-slate-50 text-xs">
          <span className="font-display font-semibold tracking-tight text-slate-700">
            Kelompok Menu
          </span>
          <button
            type="button"
            onClick={() => {
              const anyCollapsed = navGroups.some((g) => collapsedGroups[g.group]);
              if (anyCollapsed) {
                setCollapsedGroups({});
              } else {
                setCollapsedGroups({
                  'Dasbor & Monitoring': true,
                  'Akademik & Operasional': true,
                  'Akun Peran & Admin': true,
                });
              }
            }}
            className="font-display font-semibold text-teal-700 hover:text-teal-900 hover:underline"
          >
            {navGroups.some((g) => collapsedGroups[g.group]) ? 'Buka Semua' : 'Ringkas Menu'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
          {navGroups.map((grp) => {
            const hasActiveItem = grp.items.some((it) => it.id === activeModule);
            const isGroupCollapsed = Boolean(collapsedGroups[grp.group]) && !hasActiveItem;
            return (
              <div
                key={grp.group}
                className={`rounded-xl border p-2 shadow-2xs transition-colors ${grp.cardTone}`}
              >
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(grp.group)}
                  className={`flex w-full items-center justify-between px-2 py-1 font-display text-xs font-bold tracking-tight transition-colors ${grp.headerTone}`}
                  title={isGroupCollapsed ? `Tampilkan ${grp.group}` : `Ringkas ${grp.group}`}
                >
                  <span className="truncate">{grp.group}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${grp.badgeTone}`}>
                      {grp.badge}
                    </span>
                    {isGroupCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    )}
                  </span>
                </button>

                {!isGroupCollapsed && (
                  <div className="mt-1.5 space-y-1">
                    {grp.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeModule === item.id;
                      const meta = MODULE_META[item.id];
                      const locked =
                        item.id === 'import' || item.id === 'quota'
                          ? !unlockedTeacher ||
                            (unlockedTeacher.peran !== 'Admin Super' && unlockedTeacher.peran !== 'Admin SIM')
                          : Boolean(item.requiresLogin && !unlockedTeacher);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={`${item.label} — ${item.sub}`}
                          onClick={() => handleSelectModule(item.id)}
                          className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left border transition-all ${
                            active
                              ? `${meta.rowActive} ring-1 ring-black/5`
                              : 'border-slate-200/70 bg-white/95 text-slate-800 hover:bg-white hover:border-slate-300 hover:shadow-2xs'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors ${
                                active ? meta.tileActive : meta.tileBg
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block font-display text-[13px] font-semibold tracking-tight leading-snug text-slate-900 truncate">
                                {item.label}
                              </span>
                              <span className="block text-[11px] font-medium text-slate-500 truncate">
                                {item.sub}
                              </span>
                            </span>
                          </span>
                          {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3.5 bg-slate-900 text-slate-200 space-y-1">
          <div className="font-display text-xs font-semibold tracking-tight text-white">
            Ringkasan Database Aktif
          </div>
          <div className="font-mono-num text-xs text-teal-300 font-semibold">
            {bootstrap?.counts?.students ?? 0} Santri · {bootstrap?.counts?.teachers ?? 0} Pembina
          </div>
          <div className="font-mono-num text-[11px] text-slate-300">
            Putra: {bootstrap?.counts?.byWilayah?.Putra.students ?? 0} · Putri:{' '}
            {bootstrap?.counts?.byWilayah?.Putri.students ?? 0} · Labkom:{' '}
            {bootstrap?.counts?.labkomBookings ?? 0}
          </div>
          <div className="text-[11px] font-medium text-slate-400">
            {getAcademicSemester().labelLengkap}
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Clear: Hanya tombol Menu di kiri & Login Guru / Admin Super di kanan */}
        <header
          className={`sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm px-3 sm:px-6 lg:px-8 ${MODULE_META[activeModule].headerAccent}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-800 transition-colors shrink-0"
              aria-label="Buka menu SIM PINTAR"
            >
              <Menu className="h-4 w-4" />
              <span>Menu</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`hidden sm:flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${MODULE_META[activeModule].tileActive}`}
              >
                {activeModule === 'dashboard' ? (
                  <LayoutDashboard className="h-3.5 w-3.5" />
                ) : activeModule === 'walikelas' ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : activeModule === 'labkom' ? (
                  <Monitor className="h-3.5 w-3.5" />
                ) : activeModule === 'import' ? (
                  <Upload className="h-3.5 w-3.5" />
                ) : activeModule === 'jadwal' ? (
                  <CalendarClock className="h-3.5 w-3.5" />
                ) : activeModule === 'monitoring' ? (
                  <BarChart3 className="h-3.5 w-3.5" />
                ) : (
                  <BookCheck className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                <span className="hidden md:inline text-slate-400 whitespace-nowrap">
                  SIM PINTAR
                </span>
                <span className="hidden md:inline text-slate-300" aria-hidden="true">
                  /
                </span>
                <h1 className="font-display font-semibold text-slate-900 truncate">
                  {MODULE_META[activeModule].title}
                </h1>
                <span className="hidden xl:inline text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="hidden xl:inline text-xs font-medium text-teal-700 whitespace-nowrap">
                  {getAcademicSemester().labelLengkap}
                </span>
              </div>
            </div>
          </div>

          {/* Atas Clear: Hanya Login Guru & Admin Super (atau akun aktif saat login) */}
          <div className="flex items-center gap-2 shrink-0">
            {unlockedTeacher ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveModule(
                      unlockedTeacher.peran === 'Admin Super' || unlockedTeacher.peran === 'Admin SIM'
                        ? 'import'
                        : 'akunguru'
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 whitespace-nowrap"
                >
                  <UserCheck className="h-3.5 w-3.5 text-teal-700" />
                  <span className="max-w-[150px] truncate">{unlockedTeacher.nama}</span>
                  <span className="hidden md:inline text-teal-600">· {unlockedTeacher.peran}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openLoginPortal('guru')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap transition-colors"
                >
                  <UserCheck className="h-3.5 w-3.5 text-teal-700" />
                  <span>Login Guru</span>
                </button>
                <button
                  type="button"
                  onClick={() => openLoginPortal('admin')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap transition-colors shadow-xs"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Admin Super</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Workspace Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-5">
          {activeModule === 'dashboard' && (
            <DasborTerpaduModule
              currentUser={unlockedTeacher}
              counts={bootstrap?.counts || null}
              onNavigate={handleNavigateFromDashboard}
              notify={notify}
            />
          )}

          {activeModule === 'presensi' && (
            <PresensiModule
              initialGuru={quickGuru}
              initialJenis={presensiPreset.jenis}
              initialGender={presensiPreset.gender}
              presetKey={presensiPreset.key}
              loggedInUser={unlockedTeacher}
              onSaved={loadBootstrap}
              onOpenJadwal={() => setActiveModule('jadwal')}
              onOpenImport={() => setActiveModule('import')}
              notify={notify}
            />
          )}

          {activeModule === 'walikelas' && (
            <WaliKelasModule
              unlockedTeacher={unlockedTeacher}
              teachers={bootstrap?.teachers || []}
              initialJalur={pembinaanPreset.jalur}
              initialWilayah={pembinaanPreset.wilayah}
              presetKey={pembinaanPreset.key}
              onOpenImport={() => setActiveModule('import')}
              onRequestLogin={() => openLoginPortal('guru')}
              notify={notify}
            />
          )}

          {activeModule === 'labkom' && (
            <LabkomRuangModule
              currentUser={unlockedTeacher}
              onRequestLogin={() => openLoginPortal('guru')}
              notify={notify}
            />
          )}

          {activeModule === 'jadwal' &&
            (unlockedTeacher ? (
              <JadwalModule
                currentUser={unlockedTeacher}
                teachers={bootstrap?.teachers || []}
                kelasList={bootstrap?.options.akademik.kelas || []}
                kelompokList={bootstrap?.options.alquran.kelompok || []}
                rooms={bootstrap?.rooms || []}
                onChanged={loadBootstrap}
                notify={notify}
              />
            ) : (
              <div className="mx-auto max-w-xl py-8">
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4 shadow-xs">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Login Diperlukan untuk Akses Jadwal &amp; Perubahan
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pengaturan jadwal pelajaran per JP (Senin 6 JP, Selasa–Kamis 9 JP, Jumat 6 JP, Sabtu 7 JP), perubahan jadwal mengajar, serta pindah kelas santri hanya dapat diakses setelah Guru, Wali Kelas, Musyrif, atau Admin Super melakukan login.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openLoginPortal('guru')}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Login Guru / Wali / Musyrif
                    </button>
                    <button
                      type="button"
                      onClick={() => openLoginPortal('admin')}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <LogIn className="h-3.5 w-3.5 text-teal-700" />
                      Login Admin Super
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('presensi')}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Kembali ke Input Presensi
                    </button>
                  </div>
                </div>
              </div>
            ))}

          {activeModule === 'akunguru' && (
            <AkunGuruModule
              teachers={bootstrap?.teachers || []}
              unlockedTeacher={unlockedTeacher}
              onUnlock={(t) => {
                setUnlockedTeacher(t);
                persistSessionUser(t);
                if (t && t.peran !== 'Admin Super' && t.peran !== 'Admin SIM') {
                  setQuickGuru(t.nama);
                }
              }}
              onOpenQuickPresensi={(nama) => {
                setQuickGuru(nama);
                setActiveModule('presensi');
              }}
              onOpenWaliKelas={() => setActiveModule('walikelas')}
              onOpenJadwal={() => setActiveModule('jadwal')}
              onOpenRegisterPortal={() => openLoginPortal('register')}
              onDataUpdated={loadBootstrap}
              notify={notify}
            />
          )}

          {activeModule === 'ujian' && (
            <UjianModule
              teachers={bootstrap?.teachers || []}
              ruanganUjian={bootstrap?.options.ruanganUjian || []}
              kelasList={bootstrap?.options.akademik.kelas || []}
              notify={notify}
            />
          )}

          {activeModule === 'piket' && (
            <PiketInvalModule
              teachers={bootstrap?.teachers || []}
              notify={notify}
            />
          )}

          {activeModule === 'monitoring' && (
            <MonitoringLaporanModule
              stats={bootstrap?.stats || null}
              options={bootstrap?.options || null}
              notify={notify}
            />
          )}

          {activeModule === 'parentportal' && <ParentPortalModule />}

          {activeModule === 'import' && (
            <ImportSimModule
              currentUser={unlockedTeacher}
              teachers={bootstrap?.teachers || []}
              counts={bootstrap?.counts || null}
              ruanganUjian={bootstrap?.options.ruanganUjian || []}
              kelasList={bootstrap?.options.akademik.kelas || []}
              rooms={bootstrap?.rooms || []}
              onDataUpdated={loadBootstrap}
              onExplicitReset={handleExplicitReset}
              onAdminLogin={(t) => {
                setUnlockedTeacher(t);
                persistSessionUser(t);
                setQuickGuru(t.nama);
                loadBootstrap();
              }}
              notify={notify}
            />
          )}

          {activeModule === 'quota' &&
            (unlockedTeacher?.peran === 'Admin Super' || unlockedTeacher?.peran === 'Admin SIM' ? (
              <QuotaBridgeModule notify={notify} />
            ) : (
              <div className="mx-auto max-w-xl py-6">
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-slate-900">
                      Login Admin Super Diperlukan
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pengaturan arsitektur kuota dan integrasi Google Sheets dikelola melalui akun Admin Super.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => openLoginPortal('admin')}
                      className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      Login Admin Super
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModule('monitoring')}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Kembali ke Monitoring &amp; Laporan
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </main>
      </div>

      {toastLayer}
    </div>
  );
}
