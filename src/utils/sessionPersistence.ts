import type { TeacherPublic } from '../types';

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

export function isAdminSuperName(nama?: string | null): boolean {
  if (!nama) return false;
  const up = nama.trim().toUpperCase();
  return up.includes('ADMIN SUPER') || up === 'ADMIN SIM';
}

export function loadPersistedQuickGuru(fallback = ''): string {
  try {
    const saved = localStorage.getItem(QUICK_GURU_KEY);
    if (saved && !isAdminSuperName(saved)) return saved;
    if (saved && isAdminSuperName(saved)) {
      localStorage.removeItem(QUICK_GURU_KEY);
    }
  } catch {
    // Ignore
  }
  return isAdminSuperName(fallback) ? '' : fallback;
}

export function savePersistedQuickGuru(nama: string): void {
  try {
    if (nama && !isAdminSuperName(nama)) {
      localStorage.setItem(QUICK_GURU_KEY, nama);
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

export function ensureServerHydratedFromMirror(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (hasHydratedInSession) return Promise.resolve(false);
  if (hydrationInFlight) return hydrationInFlight;

  hydrationInFlight = (async () => {
    try {
      const mirrorRaw =
        localStorage.getItem(DB_MIRROR_KEY) || localStorage.getItem(LEGACY_BUNDLED_MIRROR_KEY);
      if (!mirrorRaw) {
        hasHydratedInSession = true;
        return false;
      }

      const mirrorSnap = JSON.parse(mirrorRaw) as Record<string, unknown>;
      const mirrorScore = scoreSnapshotObject(mirrorSnap);
      if (mirrorScore <= 0) {
        hasHydratedInSession = true;
        return false;
      }

      // If a valid non-empty mirror exists in localStorage, clear any stale explicitEmpty flag
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

      if (restoreRes.ok) {
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      hydrationInFlight = null;
    }
  })();

  return hydrationInFlight;
}

