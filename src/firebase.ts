// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  initializeFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';
import type {
  AttendanceLog,
  Gender,
  PembinaanRecord,
  ScheduleItem,
  Student,
  TeacherPublic,
  UserRole,
} from './types';

// Your web app's Firebase configuration (synced directly with firebase-applet-config.json)
export const firebaseConfig = {
  ...firebaseAppletConfig,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

function createFirestoreClient(): Firestore {
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
      },
      databaseId
    );
  } catch {
    return getFirestore(app, databaseId);
  }
}

export const db: Firestore = createFirestoreClient();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firebase Analytics safely only when measurementId is configured
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {
      analytics = null;
    });
}

// ============================================================================
// Structured Firestore Error Handling (Mandatory per Firebase Integration Skill)
// ============================================================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ============================================================================
// Startup Connection Validation
// ============================================================================
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined' && navigator.onLine !== false) {
  testConnection();
}

// ============================================================================
// Defensive Payload Sanitization (Synchronized with firebase-blueprint.json)
// ============================================================================
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function sanitizeDocId(raw: string, prefix = 'DOC'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120);
  const candidate = cleaned || `${prefix}_${Date.now()}`;
  return ID_REGEX.test(candidate) ? candidate.slice(0, 128) : `${prefix}_${Date.now()}`;
}

function clampStr(val: unknown, maxLength: number, fallback = ''): string {
  const s = String(val ?? '').trim();
  const res = s.length > 0 ? s : fallback;
  return res.slice(0, maxLength);
}

const VALID_ROLES = new Set<string>([
  'Guru',
  'Wali Kelas',
  'Musyrif',
  'Musyrifah',
  'Admin SIM',
  'Admin Super',
]);

function clampRoleList(roles: unknown): UserRole[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((r) => clampStr(r, 32))
    .filter((r): r is UserRole => VALID_ROLES.has(r))
    .slice(0, 6);
}

function clampRoomList(rooms: unknown): string[] {
  if (!Array.isArray(rooms)) return [];
  return rooms
    .map((r) => clampStr(r, 80))
    .filter((r) => r.length > 0)
    .slice(0, 10);
}

// ============================================================================
// Auth & Firestore Cloud Sync Helpers for SIM PINTAR
// ============================================================================
export { onAuthStateChanged, signInWithPopup, signOut, type User };

export interface CloudSyncSnapshotPayload {
  students: Student[];
  teachers: TeacherPublic[];
  schedules: ScheduleItem[];
  attendanceLogs: AttendanceLog[];
  pembinaanRecords: PembinaanRecord[];
}

export interface CloudSyncSummary {
  studentsSynced: number;
  staffSynced: number;
  schedulesSynced: number;
  attendanceSynced: number;
  pembinaanSynced: number;
  syncedAt: string;
}

/**
 * Ensures the signed-in Bootstrapped Admin (`sahidin30@gmail.com`) is registered in `/admins/{uid}`
 */
export async function ensureBootstrappedAdminDoc(user: User): Promise<void> {
  if (!user.emailVerified || user.email?.toLowerCase() !== 'sahidin30@gmail.com') {
    return;
  }
  const adminUid = sanitizeDocId(user.uid, 'ADM');
  const path = `admins/${adminUid}`;
  try {
    await setDoc(doc(db, 'admins', adminUid), {
      uid: adminUid,
      email: clampStr(user.email, 120, 'sahidin30@gmail.com'),
      role: 'Admin Super',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Pushes current SIM PINTAR master & operational data into Firestore (`sim-pintar`)
 * strictly adhering to `firebase-blueprint.json` and `firestore.rules`.
 */
export async function pushSnapshotToFirestore(
  snapshot: CloudSyncSnapshotPayload
): Promise<CloudSyncSummary> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan login dengan Google terlebih dahulu sebelum sinkronisasi ke Firebase.');
  }

  await ensureBootstrappedAdminDoc(currentUser);
  const authorId = sanitizeDocId(currentUser.uid, 'USR');
  const isBootstrappedAdmin =
    currentUser.emailVerified && currentUser.email?.toLowerCase() === 'sahidin30@gmail.com';

  // Map student names to sanitized student IDs so attendance & pembinaan logs reference valid student docs
  const studentIdByName = new Map<string, string>();

  // 1. Students (Admin only per security rules)
  let studentsSynced = 0;
  if (isBootstrappedAdmin && snapshot.students.length > 0) {
    const chunkSize = 400;
    for (let i = 0; i < snapshot.students.length; i += chunkSize) {
      const chunk = snapshot.students.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const st of chunk) {
        const sid = sanitizeDocId(st.id || st.nis || st.nama, 'STU');
        studentIdByName.set(st.nama.trim().toUpperCase(), sid);
        batch.set(doc(db, 'students', sid), {
          id: sid,
          nis: clampStr(st.nis || sid, 40, '0'),
          nama: clampStr(st.nama, 120, 'SANTRI'),
          gender: st.gender === 'Putri' ? 'Putri' : 'Putra',
          kelas: clampStr(st.kelas, 80, 'UMUM'),
          kamar: clampStr(st.kamar, 80, 'ASRAMA'),
          waliKelas: clampStr(st.waliKelas, 120, ''),
          musyrif: clampStr(st.musyrif, 120, ''),
          kelompokQuran: clampStr(st.kelompokQuran, 120, ''),
          pengampuQuran: clampStr(st.pengampuQuran, 120, ''),
          authorId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        studentsSynced++;
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'students');
      }
    }
  } else {
    for (const st of snapshot.students) {
      const sid = sanitizeDocId(st.id || st.nis || st.nama, 'STU');
      studentIdByName.set(st.nama.trim().toUpperCase(), sid);
    }
  }

  // 2. Staff Profiles + Isolated Private Contact Subcollection
  let staffSynced = 0;
  const nonSuperTeachers = snapshot.teachers.filter(
    (t) => isBootstrappedAdmin || (t.peran !== 'Admin Super' && t.peran !== 'Admin SIM')
  );
  if (nonSuperTeachers.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < nonSuperTeachers.length; i += chunkSize) {
      const chunk = nonSuperTeachers.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const t of chunk) {
        const staffId = sanitizeDocId(t.id || t.username || t.nama, 'STF');
        const peran: UserRole = VALID_ROLES.has(t.peran) ? t.peran : 'Guru';
        const genderScope =
          t.genderScope === 'Putra' || t.genderScope === 'Putri' ? t.genderScope : 'Semua';
        batch.set(doc(db, 'staff_profiles', staffId), {
          id: staffId,
          username: clampStr(t.username || staffId.toLowerCase(), 100, 'guru'),
          nama: clampStr(t.nama, 120, 'PEGAWAI'),
          jabatan: clampStr(t.jabatan || peran, 120, peran),
          peran,
          peranTambahan: clampRoleList(t.peranTambahan),
          genderScope,
          waliKelasOf: clampStr(t.waliKelasOf, 80, ''),
          kamarBinaan: clampRoomList(t.kamarBinaan),
          authorId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        staffSynced++;
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'staff_profiles');
      }

      // Sync isolated PII contact in separate batch after parent staff_profiles exist (Master Gate)
      const piiBatch = writeBatch(db);
      let hasPii = false;
      for (const t of chunk) {
        if (t.whatsapp && t.whatsapp.trim().length > 0) {
          const staffId = sanitizeDocId(t.id || t.username || t.nama, 'STF');
          piiBatch.set(doc(db, 'staff_profiles', staffId, 'private', 'contact'), {
            staffId,
            whatsapp: clampStr(t.whatsapp, 40, ''),
            ownerId: authorId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          hasPii = true;
        }
      }
      if (hasPii) {
        try {
          await piiBatch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'staff_profiles/private');
        }
      }
    }
  }

  // 3. Teaching Schedules
  let schedulesSynced = 0;
  if (snapshot.schedules.length > 0) {
    const chunkSize = 400;
    for (let i = 0; i < snapshot.schedules.length; i += chunkSize) {
      const chunk = snapshot.schedules.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const sch of chunk) {
        const schId = sanitizeDocId(sch.id, 'SCH');
        const kategori = sch.kategori === 'Al-Quran' ? 'Al-Quran' : 'Akademik';
        batch.set(doc(db, 'schedules', schId), {
          id: schId,
          guru: clampStr(sch.guru, 120, 'GURU'),
          hari: clampStr(sch.hari, 24, 'SENIN'),
          kelas: clampStr(sch.kelas, 80, 'KELAS'),
          mapel: clampStr(sch.mapel, 120, 'MAPEL'),
          jamKe: clampStr(sch.jamKe, 32, '1-2'),
          gender: sch.gender === 'Putri' ? 'Putri' : 'Putra',
          kategori,
          authorId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        schedulesSynced++;
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'schedules');
      }
    }
  }

  // 4. Attendance Logs (only for students that exist in Firestore per Global Consistency Invariant)
  let attendanceSynced = 0;
  if (studentsSynced > 0 && snapshot.attendanceLogs.length > 0) {
    const recentLogs = snapshot.attendanceLogs.slice(-400);
    const batch = writeBatch(db);
    for (const log of recentLogs) {
      const studentId = studentIdByName.get(log.namaSiswa.trim().toUpperCase());
      if (!studentId) continue;
      const logId = sanitizeDocId(log.id, 'ATT');
      const status = ['H', 'S', 'I', 'A', 'T'].includes(log.status) ? log.status : 'H';
      batch.set(doc(db, 'attendance_logs', logId), {
        id: logId,
        tanggal: clampStr(log.tanggal, 20, new Date().toISOString().slice(0, 10)),
        tipe: clampStr(log.jenisPresensi, 40, 'Belajar'),
        gender: log.gender === 'Putri' ? 'Putri' : 'Putra',
        kelas: clampStr(log.kelas, 80, 'UMUM'),
        kamar: '',
        studentId,
        studentName: clampStr(log.namaSiswa, 120, 'SANTRI'),
        status,
        catatan: clampStr(log.keterangan, 250, ''),
        petugas: clampStr(log.guru, 120, 'PETUGAS'),
        authorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      attendanceSynced++;
    }
    if (attendanceSynced > 0) {
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'attendance_logs');
      }
    }
  }

  // 5. Pembinaan Records (only for students that exist in Firestore per Global Consistency Invariant)
  let pembinaanSynced = 0;
  if (studentsSynced > 0 && snapshot.pembinaanRecords.length > 0) {
    const recentRecords = snapshot.pembinaanRecords.slice(-400);
    const batch = writeBatch(db);
    for (const rec of recentRecords) {
      const studentId = studentIdByName.get(rec.namaSantri.trim().toUpperCase());
      if (!studentId) continue;
      const recId = sanitizeDocId(rec.id, 'PMB');
      const statusTindakLanjut =
        rec.statusTindakLanjut === 'Selesai' ||
        rec.statusTindakLanjut === 'Proses' ||
        rec.statusTindakLanjut === 'Eskalasi'
          ? rec.statusTindakLanjut
          : 'Proses';
      const poinNum = Number.isFinite(rec.poin) ? Math.max(-1000, Math.min(1000, rec.poin)) : 0;
      batch.set(doc(db, 'pembinaan_records', recId), {
        id: recId,
        tanggal: clampStr(rec.tanggal, 20, new Date().toISOString().slice(0, 10)),
        gender: rec.gender === 'Putri' ? 'Putri' : 'Putra',
        kelas: clampStr(rec.kelas, 80, 'UMUM'),
        kamar: clampStr(rec.kamar, 80, ''),
        waliKelas: clampStr(rec.waliKelas || rec.pembinaNama, 120, 'PEMBINA'),
        studentId,
        studentName: clampStr(rec.namaSantri, 120, 'SANTRI'),
        kategori: clampStr(rec.kategori, 60, 'Pembinaan Karakter'),
        uraian: clampStr(rec.catatan, 500, 'Catatan pembinaan'),
        tindakLanjut: clampStr(rec.tindakLanjut, 500, '-'),
        statusTindakLanjut,
        poin: poinNum,
        authorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      pembinaanSynced++;
    }
    if (pembinaanSynced > 0) {
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'pembinaan_records');
      }
    }
  }

  return {
    studentsSynced,
    staffSynced,
    schedulesSynced,
    attendanceSynced,
    pembinaanSynced,
    syncedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

/**
 * Pulls synced SIM PINTAR records from Firestore (`sim-pintar`) using secure authorId-scoped queries.
 */
export async function pullSnapshotFromFirestore(): Promise<{
  students: Array<{
    nis: string;
    nama: string;
    kelas: string;
    kamar: string;
    kelompokQuran: string;
    pengampuQuran: string;
    gender: Gender;
  }>;
  teachers: Array<{
    nama: string;
    username: string;
    peran: UserRole;
    peranTambahan?: UserRole[];
    genderScope: 'Putra' | 'Putri' | 'Semua';
    waliKelasOf?: string;
    kamarBinaan?: string[];
  }>;
  schedules: Array<{
    guru: string;
    hari: string;
    kelas: string;
    mapel: string;
    jamKe: string;
    gender: Gender;
    kategori: 'Akademik' | 'Al-Quran';
  }>;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan login dengan Google terlebih dahulu sebelum menarik data dari Firebase.');
  }

  const authorId = sanitizeDocId(currentUser.uid, 'USR');

  const students: Array<{
    nis: string;
    nama: string;
    kelas: string;
    kamar: string;
    kelompokQuran: string;
    pengampuQuran: string;
    gender: Gender;
  }> = [];

  try {
    const stSnap = await getDocs(
      query(collection(db, 'students'), where('authorId', '==', authorId))
    );
    stSnap.forEach((d) => {
      const data = d.data();
      students.push({
        nis: String(data.nis || ''),
        nama: String(data.nama || ''),
        kelas: String(data.kelas || ''),
        kamar: String(data.kamar || ''),
        kelompokQuran: String(data.kelompokQuran || ''),
        pengampuQuran: String(data.pengampuQuran || ''),
        gender: data.gender === 'Putri' ? 'Putri' : 'Putra',
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
  }

  const teachers: Array<{
    nama: string;
    username: string;
    peran: UserRole;
    peranTambahan?: UserRole[];
    genderScope: 'Putra' | 'Putri' | 'Semua';
    waliKelasOf?: string;
    kamarBinaan?: string[];
  }> = [];

  try {
    const tfSnap = await getDocs(
      query(collection(db, 'staff_profiles'), where('authorId', '==', authorId))
    );
    tfSnap.forEach((d) => {
      const data = d.data();
      teachers.push({
        nama: String(data.nama || ''),
        username: String(data.username || ''),
        peran: (data.peran as UserRole) || 'Guru',
        peranTambahan: Array.isArray(data.peranTambahan) ? data.peranTambahan : [],
        genderScope:
          data.genderScope === 'Putra' || data.genderScope === 'Putri' ? data.genderScope : 'Semua',
        waliKelasOf: data.waliKelasOf ? String(data.waliKelasOf) : undefined,
        kamarBinaan: Array.isArray(data.kamarBinaan) ? data.kamarBinaan : [],
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'staff_profiles');
  }

  const schedules: Array<{
    guru: string;
    hari: string;
    kelas: string;
    mapel: string;
    jamKe: string;
    gender: Gender;
    kategori: 'Akademik' | 'Al-Quran';
  }> = [];

  try {
    const schSnap = await getDocs(
      query(collection(db, 'schedules'), where('authorId', '==', authorId))
    );
    schSnap.forEach((d) => {
      const data = d.data();
      schedules.push({
        guru: String(data.guru || ''),
        hari: String(data.hari || 'SENIN'),
        kelas: String(data.kelas || ''),
        mapel: String(data.mapel || ''),
        jamKe: String(data.jamKe || '1-2'),
        gender: data.gender === 'Putri' ? 'Putri' : 'Putra',
        kategori: data.kategori === 'Al-Quran' ? 'Al-Quran' : 'Akademik',
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'schedules');
  }

  return { students, teachers, schedules };
}
