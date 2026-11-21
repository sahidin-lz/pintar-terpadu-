import type {
  BootstrapPayload,
  ReportOptionsScope,
  RoomMapping,
  ScheduleItem,
  Student,
  TeacherPublic,
} from '../types';

const SESSION_USER_KEY = 'pintar_unlocked_teacher_v1';
const LAST_MODULE_KEY = 'pintar_last_module_v1';
const QUICK_GURU_KEY = 'pintar_quick_guru_v1';

export function loadPersistedUser(): TeacherPublic | null {
  try {
    const raw =
      sessionStorage.getItem(SESSION_USER_KEY) || localStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeacherPublic;
    return parsed && parsed.nama ? parsed : null;
  } catch {
    return null;
  }
}

export function savePersistedUser(teacher: TeacherPublic | null): void {
  try {
    if (teacher) {
      const serialized = JSON.stringify(teacher);
      sessionStorage.setItem(SESSION_USER_KEY, serialized);
      localStorage.setItem(SESSION_USER_KEY, serialized);
    } else {
      sessionStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
    }
  } catch {
    // Ignore storage quota or private mode issues
  }
}

export function loadPersistedModule<T extends string>(validModules: readonly T[], fallback: T): T {
  try {
    const hash = window.location.hash.replace(/^#\/?/, '').trim() as T;
    if (hash && validModules.includes(hash)) {
      return hash;
    }
    const saved = localStorage.getItem(LAST_MODULE_KEY) as T | null;
    if (saved && validModules.includes(saved)) {
      return saved;
    }
  } catch {
    // Ignore
  }
  return fallback;
}

export function savePersistedModule(moduleId: string): void {
  try {
    localStorage.setItem(LAST_MODULE_KEY, moduleId);
    if (typeof window !== 'undefined' && window.location.hash !== `#${moduleId}`) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${moduleId}`);
    }
  } catch {
    // Ignore
  }
}

export function cleanGuruDisplayName(nama?: string | null): string {
  if (!nama) return '';
  return nama
    .replace(/\(\s*ADMIN\s+SUPER\s*\)/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isAdminSuperName(nama?: string | null): boolean {
  const up = cleanGuruDisplayName(nama).toUpperCase();
  return !up || up === 'ADMIN SUPER' || up === 'ADMIN SIM' || up === 'ADMIN';
}

function stripHonorificClient(val?: string | null): string {
  const raw = cleanGuruDisplayName(val)
    .toLowerCase()
    .replace(/["'`]/g, '');
  if (!raw || raw === '-') return '';
  const withoutDegrees = raw.split(',')[0] || raw;
  return withoutDegrees
    .replace(/^(ustadzah|ustadz|ustz|ust|bpk|ibu|pak|bu|dr|drs|hj|h|kh)\.?\s+/i, '')
    .replace(/^(ustadzah|ustadz|ustz|ust)\.?\s+/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchTeacherClient(a?: string | null, b?: string | null): boolean {
  const na = cleanGuruDisplayName(a).toLowerCase();
  const nb = cleanGuruDisplayName(b).toLowerCase();
  if (!na || !nb || na === '-' || nb === '-') return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ca = stripHonorificClient(a);
  const cb = stripHonorificClient(b);
  if (!ca || !cb || ca.length < 3 || cb.length < 3) return false;
  return ca === cb || ca.includes(cb) || cb.includes(ca);
}

export function normGroupClient(raw?: string | null): string {
  const s = String(raw || '').trim().toUpperCase();
  if (!s || s === '-' || s === 'KOSONG') return '';
  return s
    .replace(/^(KELAS|KAMAR|ASRAMA|HUJROH|KELOMPOK|KELP\.?|HALAQAH)\s+/i, '')
    .replace(/\bXII\b/g, '12')
    .replace(/\bXI\b/g, '11')
    .replace(/\bX\b/g, '10')
    .replace(/\b0+(\d+)\b/g, '$1')
    .replace(/[\-_.\/]+/g, '.')
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchGroupClient(a?: string | null, b?: string | null): boolean {
  const rawA = String(a || '').trim().toUpperCase();
  const rawB = String(b || '').trim().toUpperCase();
  if (!rawA || !rawB || rawA === '-' || rawB === '-') return false;
  if (rawA === rawB) return true;
  const na = normGroupClient(rawA);
  const nb = normGroupClient(rawB);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const stripG = (v: string) =>
    v
      .replace(/\b(PUTRA|PUTRI|IKHWAN|AKHWAT)\b/g, '')
      .replace(/\s*\.\s*/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const baseA = stripG(na);
  const baseB = stripG(nb);
  if (!baseA || !baseB) return false;
  if (baseA === baseB) return true;
  const numsA = (baseA.match(/\d+/g) || []).join('.');
  const numsB = (baseB.match(/\d+/g) || []).join('.');
  if (numsA !== numsB) return false;
  if (/[A-Z]{3,}/.test(baseA) && /[A-Z]{3,}/.test(baseB)) {
    return (
      baseA.startsWith(baseB + ' ') ||
      baseB.startsWith(baseA + ' ') ||
      baseA.startsWith(baseB + '.') ||
      baseB.startsWith(baseA + '.')
    );
  }
  return false;
}

export function loadPersistedQuickGuru(fallback = ''): string {
  try {
    const saved = cleanGuruDisplayName(localStorage.getItem(QUICK_GURU_KEY));
    if (saved && !isAdminSuperName(saved)) return saved;
    if (saved && isAdminSuperName(saved)) {
      localStorage.removeItem(QUICK_GURU_KEY);
    }
  } catch {
    // Ignore
  }
  const cleanFallback = cleanGuruDisplayName(fallback);
  return isAdminSuperName(cleanFallback) ? '' : cleanFallback;
}

export function savePersistedQuickGuru(nama: string): void {
  try {
    const clean = cleanGuruDisplayName(nama);
    if (clean && !isAdminSuperName(clean)) {
      localStorage.setItem(QUICK_GURU_KEY, clean);
    } else {
      localStorage.removeItem(QUICK_GURU_KEY);
    }
  } catch {
    // Ignore
  }
}

export function loadSubTab<T extends string>(storageKey: string, valid: readonly T[], fallback: T): T {
  try {
    const val = localStorage.getItem(storageKey) as T | null;
    if (val && valid.includes(val)) return val;
  } catch {
    // Ignore
  }
  return fallback;
}

export function saveSubTab(storageKey: string, value: string): void {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // Ignore
  }
}

export function loadScopedState<T>(storageKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveScopedState<T>(storageKey: string, value: T): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Ignore
  }
}

export function emitDataMutated(): void {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pintar:data-mutated'));
    }
  } catch {
    // Ignore
  }
}

export const DB_MIRROR_KEY = 'pintar_db_template_only_v2';
export const LEGACY_BUNDLED_MIRROR_KEY = 'pintar_db_mirror_v1';
export const DB_EXPLICIT_EMPTY_KEY = 'pintar_db_explicit_empty_v1';

export function scoreSnapshotObject(snap: Record<string, unknown> | null | undefined): number {
  if (!snap) return 0;
  const arrLen = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return (
    arrLen(snap.students) * 5 +
    Math.max(0, arrLen(snap.teachers) - 1) * 3 +
    arrLen(snap.schedules) * 2 +
    arrLen(snap.rooms) +
    arrLen(snap.attendanceLogs) * 3 +
    arrLen(snap.pembinaanRecords) * 3 +
    arrLen(snap.examLogs) * 2
  );
}

export function saveSnapshotToLocalMirror(snap: Record<string, unknown> | null | undefined): boolean {
  if (!snap || scoreSnapshotObject(snap) <= 0) return false;
  try {
    localStorage.removeItem(DB_EXPLICIT_EMPTY_KEY);
    localStorage.removeItem(LEGACY_BUNDLED_MIRROR_KEY);
  } catch {
    // Ignore
  }

  const compactAttachments = Array.isArray(snap.attachments)
    ? snap.attachments.slice(0, 50).map((att: Record<string, unknown>) => ({
        ...att,
        url: typeof att.url === 'string' && att.url.length > 65536 ? '' : att.url,
      }))
    : [];

  try {
    const compactSnap = { ...snap, attachments: compactAttachments };
    localStorage.setItem(DB_MIRROR_KEY, JSON.stringify(compactSnap));
    return true;
  } catch {
    // Fallback if localStorage quota is tight: strip attachments & whatsappLogs
    try {
      const slimSnap = { ...snap, attachments: [], whatsappLogs: [] };
      localStorage.setItem(DB_MIRROR_KEY, JSON.stringify(slimSnap));
      return true;
    } catch {
      return false;
    }
  }
}

let hydrationInFlight: Promise<boolean> | null = null;
let hasHydratedInSession = false;

export function getLocalMirrorSnapshot(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const mirrorRaw =
      localStorage.getItem(DB_MIRROR_KEY) || localStorage.getItem(LEGACY_BUNDLED_MIRROR_KEY);
    if (!mirrorRaw) return null;
    const parsed = JSON.parse(mirrorRaw) as Record<string, unknown>;
    return scoreSnapshotObject(parsed) > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function buildInstantBootstrapFromMirror(): BootstrapPayload | null {
  const snap = getLocalMirrorSnapshot();
  if (!snap) return null;
  try {
    const students = (Array.isArray(snap.students) ? snap.students : []) as Student[];
    const teachers = (Array.isArray(snap.teachers) ? snap.teachers : []) as TeacherPublic[];
    const rooms = (Array.isArray(snap.rooms) ? snap.rooms : []) as RoomMapping[];
    const schedules = (Array.isArray(snap.schedules) ? snap.schedules : []) as ScheduleItem[];
    const ruanganUjian = (Array.isArray(snap.ruanganUjian) ? snap.ruanganUjian : []) as string[];
    const attendanceLogs = Array.isArray(snap.attendanceLogs) ? snap.attendanceLogs : [];
    const examLogs = Array.isArray(snap.examLogs) ? snap.examLogs : [];
    const pembinaanRecords = Array.isArray(snap.pembinaanRecords) ? snap.pembinaanRecords : [];
    const labkomBookings = Array.isArray(snap.labkomBookings) ? snap.labkomBookings : [];

    const sortNat = (arr: Array<string | undefined | null>) =>
      Array.from(new Set(arr.filter((v): v is string => Boolean(v) && v !== '-'))).sort((a, b) =>
        a.localeCompare(b, 'id', { numeric: true })
      );

    const buildScope = (gender?: 'Putra' | 'Putri'): ReportOptionsScope => {
      const scopedStudents = gender ? students.filter((s) => s.gender === gender) : students;
      const scopedRooms = gender ? rooms.filter((r) => r.gender === gender) : rooms;
      const scopedSchedules = gender ? schedules.filter((s) => s.gender === gender) : schedules;
      return {
        akademik: {
          kelas: sortNat([...scopedStudents.map((s) => s.kelas), ...scopedSchedules.map((s) => s.kelas)]),
          mapel: sortNat(scopedSchedules.map((s) => s.mapel)),
        },
        asrama: {
          kamar: sortNat([...scopedStudents.map((s) => s.kamar), ...scopedRooms.map((r) => r.kamar)]),
          musyrif: sortNat([...scopedRooms.map((r) => r.musyrif), ...scopedStudents.map((s) => s.musyrif)]),
        },
        alquran: {
          kelompok: sortNat(scopedStudents.map((s) => s.kelompokQuran)),
        },
        ruanganUjian: sortNat(ruanganUjian),
        students: sortNat(scopedStudents.map((s) => s.nama)),
      };
    };

    const emptyStats = () => ({ H: 0, T: 0, S: 0, I: 0, A: 0 });

    return {
      options: {
        ...buildScope(),
        byWilayah: {
          Putra: buildScope('Putra'),
          Putri: buildScope('Putri'),
        },
      },
      rooms,
      teachers,
      stats: {
        hari: emptyStats(),
        bulan: emptyStats(),
        semester: emptyStats(),
      },
      counts: {
        students: students.length,
        teachers: teachers.length,
        rooms: rooms.length,
        schedules: schedules.length,
        attendanceLogs: attendanceLogs.length,
        pembinaanRecords: pembinaanRecords.length,
        examLogs: examLogs.length,
        labkomBookings: labkomBookings.length,
      },
    };
  } catch {
    return null;
  }
}

export function ensureServerHydratedFromMirror(forceIfServerEmpty = false): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (hydrationInFlight) return hydrationInFlight;
  if (hasHydratedInSession && !forceIfServerEmpty) {
    return Promise.resolve(false);
  }

  hydrationInFlight = (async () => {
    try {
      const mirrorSnap = getLocalMirrorSnapshot();
      if (!mirrorSnap) {
        hasHydratedInSession = true;
        return false;
      }

      try {
        localStorage.removeItem(DB_EXPLICIT_EMPTY_KEY);
      } catch {
        // Ignore
      }

      hasHydratedInSession = true;
      const restoreRes = await fetch('/api/system/restore-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: mirrorSnap, mode: 'merge' }),
      });

      if (restoreRes.ok && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pintar:data-restored'));
      }

      return restoreRes.ok;
    } catch {
      return false;
    } finally {
      hydrationInFlight = null;
    }
  })();

  return hydrationInFlight;
}


