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
  getDoc,
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
  type Timestamp,
} from 'firebase/firestore';
import firebaseAppletConfig from '../firebase-applet-config.json';
import type {
  AttendanceLog,
  AttendanceStatus,
  Gender,
  PembinaanKategori,
  PembinaanRecord,
  PresensiType,
  RoomMapping,
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
  'Guru Wali',
  'Wali Kelas',
  'Wali Asrama',
  'Musyrif',
  'Musyrifah',
  'Pengampu Al-Quran',
  'Pimpinan',
  'Admin SIM',
  'Admin Super',
]);

const VALID_KATEGORI = new Set<string>([
  'Pemantauan Ibadah',
  'Pembinaan Karakter',
  'Kedisiplinan',
  'Prestasi',
  'Kesehatan',
]);

function clampRoleList(roles: unknown): UserRole[] {
  if (!Array.isArray(roles)) return [];
  const seen = new Set<string>();
  const out: UserRole[] = [];
  for (const r of roles) {
    const clean = clampStr(r, 32);
    if (VALID_ROLES.has(clean) && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean as UserRole);
      if (out.length >= 6) break;
    }
  }
  return out;
}

function clampBoundedStringList(items: unknown, maxItems = 10, maxLen = 80): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = clampStr(item, maxLen);
    if (clean.length > 0 && !seen.has(clean.toUpperCase())) {
      seen.add(clean.toUpperCase());
      out.push(clean);
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

function isBootstrappedAdminUser(user: User | null): boolean {
  return Boolean(user?.emailVerified && user.email?.toLowerCase() === 'sahidin30@gmail.com');
}

function formatFirestoreTimestamp(val: unknown, fallbackDate: string): string {
  if (val && typeof (val as Timestamp).toDate === 'function') {
    try {
      return (val as Timestamp).toDate().toISOString().replace('T', ' ').slice(0, 19);
    } catch {
      // fallback
    }
  }
  return `${fallbackDate} 07:00:00`;
}

// ============================================================================
// Auth & Firestore Cloud Sync Helpers for SIM PINTAR
// ============================================================================
export { onAuthStateChanged, signInWithPopup, signOut, type User };

export interface CloudSyncSnapshotPayload {
  students: Student[];
  teachers: TeacherPublic[];
  rooms?: RoomMapping[];
  schedules: ScheduleItem[];
  attendanceLogs: AttendanceLog[];
  pembinaanRecords: PembinaanRecord[];
}

export interface CloudSyncSummary {
  studentsSynced: number;
  staffSynced: number;
  roomsSynced: number;
  schedulesSynced: number;
  attendanceSynced: number;
  pembinaanSynced: number;
  syncedAt: string;
}

export interface PulledCloudSnapshot {
  students: Student[];
  teachers: TeacherPublic[];
  rooms: RoomMapping[];
  schedules: ScheduleItem[];
  attendanceLogs: AttendanceLog[];
  pembinaanRecords: PembinaanRecord[];
}

/**
 * Fetches existing document IDs -> original `createdAt` timestamps for an author-owned collection,
 * so subsequent updates ALWAYS preserve `createdAt` and satisfy `firestore.rules` Temporal Integrity.
 */
async function fetchExistingCreatedAtMap(
  collectionName: string,
  authorId: string
): Promise<Map<string, Timestamp>> {
  const map = new Map<string, Timestamp>();
  try {
    const snap = await getDocs(
      query(collection(db, collectionName), where('authorId', '==', authorId))
    );
    snap.forEach((d) => {
      const data = d.data();
      if (data && data.createdAt) {
        map.set(d.id, data.createdAt as Timestamp);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collectionName);
  }
  return map;
}

/**
 * Deletes stale documents from a collection (when replacing authoritative master lists).
 */
async function deleteStaleDocs(
  collectionName: string,
  existingIds: Iterable<string>,
  keepIds: Set<string>
): Promise<void> {
  const toDelete: string[] = [];
  for (const id of existingIds) {
    if (!keepIds.has(id)) {
      toDelete.push(id);
    }
  }
  if (toDelete.length === 0) return;

  const chunkSize = 400;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.delete(doc(db, collectionName, id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
    }
  }
}

/**
 * Ensures the signed-in Bootstrapped Admin (`sahidin30@gmail.com`) is registered in `/admins/{uid}`
 * without violating `createdAt` immutability on repeat syncs.
 */
export async function ensureBootstrappedAdminDoc(user: User): Promise<void> {
  if (!isBootstrappedAdminUser(user)) {
    return;
  }
  const adminUid = sanitizeDocId(user.uid, 'ADM');
  const adminRef = doc(db, 'admins', adminUid);
  const path = `admins/${adminUid}`;
  try {
    const existingSnap = await getDoc(adminRef);
    if (existingSnap.exists()) {
      return;
    }
    await setDoc(adminRef, {
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
 * Preserves `createdAt` for existing documents so repeat syncs succeed reliably.
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
  const isBootstrappedAdmin = isBootstrappedAdminUser(currentUser);

  // Map student names -> sanitized student IDs & rooms so attendance/pembinaan reference valid student docs
  const studentIdByName = new Map<string, string>();
  const studentRoomByName = new Map<string, string>();

  // 1. Students (Admin only per security rules)
  let studentsSynced = 0;
  const students = Array.isArray(snapshot.students) ? snapshot.students : [];
  if (isBootstrappedAdmin && students.length > 0) {
    const existingStudents = await fetchExistingCreatedAtMap('students', authorId);
    const activeStudentIds = new Set<string>();
    const chunkSize = 400;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const st of chunk) {
        const sid = sanitizeDocId(st.id || st.nis || st.nama, 'STU');
        activeStudentIds.add(sid);
        const upperName = st.nama.trim().toUpperCase();
        studentIdByName.set(upperName, sid);
        studentRoomByName.set(upperName, clampStr(st.kamar, 80, ''));
        const existingCreatedAt = existingStudents.get(sid);
        batch.set(doc(db, 'students', sid), {
          id: sid,
          nis: clampStr(st.nis || sid, 40, '0'),
          nama: clampStr(st.nama, 120, 'SANTRI'),
          gender: st.gender === 'Putri' ? 'Putri' : 'Putra',
          kelas: clampStr(st.kelas, 80, 'UMUM'),
          kamar: clampStr(st.kamar, 80, 'ASRAMA'),
          waliKelas: clampStr(st.waliKelas, 120, ''),
          guruWali: clampStr(st.guruWali, 120, ''),
          musyrif: clampStr(st.musyrif, 120, ''),
          kelompokQuran: clampStr(st.kelompokQuran, 120, ''),
          pengampuQuran: clampStr(st.pengampuQuran, 120, ''),
          authorId,
          createdAt: existingCreatedAt ?? serverTimestamp(),
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
    await deleteStaleDocs('students', existingStudents.keys(), activeStudentIds);
  } else {
    for (const st of students) {
      const sid = sanitizeDocId(st.id || st.nis || st.nama, 'STU');
      const upperName = st.nama.trim().toUpperCase();
      studentIdByName.set(upperName, sid);
      studentRoomByName.set(upperName, clampStr(st.kamar, 80, ''));
    }
  }

  // 2. Staff Profiles + Isolated Private Contact Subcollection
  let staffSynced = 0;
  const teachers = Array.isArray(snapshot.teachers) ? snapshot.teachers : [];
  const allowedTeachers = teachers.filter(
    (t) => isBootstrappedAdmin || (t.peran !== 'Admin Super' && t.peran !== 'Admin SIM')
  );
  if (allowedTeachers.length > 0) {
    const existingStaff = await fetchExistingCreatedAtMap('staff_profiles', authorId);
    const activeStaffIds = new Set<string>();
    const chunkSize = 200;
    for (let i = 0; i < allowedTeachers.length; i += chunkSize) {
      const chunk = allowedTeachers.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const t of chunk) {
        const staffId = sanitizeDocId(t.id || t.username || t.nama, 'STF');
        activeStaffIds.add(staffId);
        const peran: UserRole = VALID_ROLES.has(t.peran) ? t.peran : 'Guru';
        const genderScope =
          t.genderScope === 'Putra' || t.genderScope === 'Putri' ? t.genderScope : 'Semua';
        const existingCreatedAt = existingStaff.get(staffId);
        batch.set(doc(db, 'staff_profiles', staffId), {
          id: staffId,
          username: clampStr(t.username || staffId.toLowerCase(), 100, 'guru'),
          nama: clampStr(t.nama, 120, 'PEGAWAI'),
          jabatan: clampStr(t.jabatan || peran, 120, peran),
          peran,
          peranTambahan: clampRoleList(t.peranTambahan),
          genderScope,
          waliKelasOf: clampStr(t.waliKelasOf, 80, ''),
          kamarBinaan: clampBoundedStringList(t.kamarBinaan, 10, 80),
          kelompokQuranBinaan: clampBoundedStringList(t.kelompokQuranBinaan, 10, 80),
          authorId,
          createdAt: existingCreatedAt ?? serverTimestamp(),
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
      const withWhatsapp = chunk.filter((t) => t.whatsapp && t.whatsapp.trim().length > 0);
      if (withWhatsapp.length > 0) {
        const piiBatch = writeBatch(db);
        for (const t of withWhatsapp) {
          const staffId = sanitizeDocId(t.id || t.username || t.nama, 'STF');
          const piiRef = doc(db, 'staff_profiles', staffId, 'private', 'contact');
          let existingPiiCreatedAt: Timestamp | undefined;
          try {
            const piiSnap = await getDoc(piiRef);
            if (piiSnap.exists()) {
              existingPiiCreatedAt = piiSnap.data().createdAt as Timestamp | undefined;
            }
          } catch {
            // If not yet created or unreadable, treat as create
          }
          piiBatch.set(piiRef, {
            staffId,
            whatsapp: clampStr(t.whatsapp, 40, ''),
            ownerId: authorId,
            createdAt: existingPiiCreatedAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        try {
          await piiBatch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'staff_profiles/private');
        }
      }
    }
    if (isBootstrappedAdmin) {
      await deleteStaleDocs('staff_profiles', existingStaff.keys(), activeStaffIds);
    }
  }

  // 3. Dormitory Rooms (Admin only per security rules)
  let roomsSynced = 0;
  const rooms = Array.isArray(snapshot.rooms) ? snapshot.rooms : [];
  if (isBootstrappedAdmin && rooms.length > 0) {
    const existingRooms = await fetchExistingCreatedAtMap('rooms', authorId);
    const activeRoomIds = new Set<string>();
    const chunkSize = 400;
    for (let i = 0; i < rooms.length; i += chunkSize) {
      const chunk = rooms.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const rm of chunk) {
        if (!rm?.kamar) continue;
        const gender = rm.gender === 'Putri' ? 'Putri' : 'Putra';
        const roomId = sanitizeDocId(`${gender}_${rm.kamar}`, 'RM');
        activeRoomIds.add(roomId);
        const existingCreatedAt = existingRooms.get(roomId);
        batch.set(doc(db, 'rooms', roomId), {
          id: roomId,
          kamar: clampStr(rm.kamar, 80, 'KAMAR'),
          musyrif: clampStr(rm.musyrif, 120, ''),
          gender,
          authorId,
          createdAt: existingCreatedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        roomsSynced++;
      }
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'rooms');
      }
    }
    await deleteStaleDocs('rooms', existingRooms.keys(), activeRoomIds);
  }

  // 4. Teaching Schedules (Akademik & Al-Quran)
  let schedulesSynced = 0;
  const schedules = Array.isArray(snapshot.schedules) ? snapshot.schedules : [];
  if (schedules.length > 0) {
    const existingSchedules = await fetchExistingCreatedAtMap('schedules', authorId);
    const activeScheduleIds = new Set<string>();
    const chunkSize = 400;
    for (let i = 0; i < schedules.length; i += chunkSize) {
      const chunk = schedules.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const sch of chunk) {
        const schId = sanitizeDocId(sch.id, 'SCH');
        activeScheduleIds.add(schId);
        const kategori = sch.kategori === 'Al-Quran' ? 'Al-Quran' : 'Akademik';
        const existingCreatedAt = existingSchedules.get(schId);
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
          createdAt: existingCreatedAt ?? serverTimestamp(),
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
    if (isBootstrappedAdmin) {
      await deleteStaleDocs('schedules', existingSchedules.keys(), activeScheduleIds);
    }
  }

  // 5. Attendance Logs (only for students that exist in Firestore per Global Consistency Invariant)
  let attendanceSynced = 0;
  const attendanceLogs = Array.isArray(snapshot.attendanceLogs) ? snapshot.attendanceLogs : [];
  if ((studentsSynced > 0 || studentIdByName.size > 0) && attendanceLogs.length > 0) {
    const existingLogs = await fetchExistingCreatedAtMap('attendance_logs', authorId);
    const recentLogs = attendanceLogs.slice(-2000);
    const chunkSize = 400;
    for (let i = 0; i < recentLogs.length; i += chunkSize) {
      const chunk = recentLogs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      let chunkCount = 0;
      for (const log of chunk) {
        const upperStudent = (log.namaSiswa || '').trim().toUpperCase();
        const studentId = studentIdByName.get(upperStudent);
        if (!studentId) continue;
        const logId = sanitizeDocId(log.id, 'ATT');
        const status = ['H', 'S', 'I', 'A', 'T'].includes(log.status) ? log.status : 'H';
        const existingCreatedAt = existingLogs.get(logId);
        batch.set(doc(db, 'attendance_logs', logId), {
          id: logId,
          tanggal: clampStr(log.tanggal, 20, new Date().toISOString().slice(0, 10)),
          tipe: clampStr(log.jenisPresensi, 40, 'Belajar'),
          gender: log.gender === 'Putri' ? 'Putri' : 'Putra',
          kelas: clampStr(log.kelas, 80, 'UMUM'),
          kamar: studentRoomByName.get(upperStudent) || '',
          studentId,
          studentName: clampStr(log.namaSiswa, 120, 'SANTRI'),
          status,
          catatan: clampStr(log.keterangan, 250, ''),
          mapel: clampStr(log.mapel, 120, ''),
          materi: clampStr(log.materi, 250, ''),
          petugas: clampStr(log.guru, 120, 'PETUGAS'),
          authorId,
          createdAt: existingCreatedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        chunkCount++;
        attendanceSynced++;
      }
      if (chunkCount > 0) {
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'attendance_logs');
        }
      }
    }
  }

  // 6. Pembinaan Records (only for students that exist in Firestore per Global Consistency Invariant)
  let pembinaanSynced = 0;
  const pembinaanRecords = Array.isArray(snapshot.pembinaanRecords)
    ? snapshot.pembinaanRecords
    : [];
  if ((studentsSynced > 0 || studentIdByName.size > 0) && pembinaanRecords.length > 0) {
    const existingRecords = await fetchExistingCreatedAtMap('pembinaan_records', authorId);
    const recentRecords = pembinaanRecords.slice(-2000);
    const chunkSize = 400;
    for (let i = 0; i < recentRecords.length; i += chunkSize) {
      const chunk = recentRecords.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      let chunkCount = 0;
      for (const rec of chunk) {
        const studentId = studentIdByName.get((rec.namaSantri || '').trim().toUpperCase());
        if (!studentId) continue;
        const recId = sanitizeDocId(rec.id, 'PMB');
        const statusTindakLanjut =
          rec.statusTindakLanjut === 'Selesai' ||
          rec.statusTindakLanjut === 'Proses' ||
          rec.statusTindakLanjut === 'Eskalasi'
            ? rec.statusTindakLanjut
            : 'Proses';
        const poinNum = Number.isFinite(rec.poin) ? Math.max(-1000, Math.min(1000, rec.poin)) : 0;
        const existingCreatedAt = existingRecords.get(recId);
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
          createdAt: existingCreatedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        chunkCount++;
        pembinaanSynced++;
      }
      if (chunkCount > 0) {
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'pembinaan_records');
        }
      }
    }
  }

  return {
    studentsSynced,
    staffSynced,
    roomsSynced,
    schedulesSynced,
    attendanceSynced,
    pembinaanSynced,
    syncedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

/**
 * Pulls ALL synced SIM PINTAR records from Firestore (`sim-pintar`) using secure queries.
 * Restores students, teachers (with all roles & binaan), rooms, schedules, attendance logs, and pembinaan records.
 */
export async function pullSnapshotFromFirestore(): Promise<PulledCloudSnapshot> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Silakan login dengan Google terlebih dahulu sebelum menarik data dari Firebase.');
  }

  const authorId = sanitizeDocId(currentUser.uid, 'USR');
  const isBootstrappedAdmin = isBootstrappedAdminUser(currentUser);

  const buildCollectionQuery = (colName: string) =>
    isBootstrappedAdmin
      ? collection(db, colName)
      : query(collection(db, colName), where('authorId', '==', authorId));

  const students: Student[] = [];
  try {
    const stSnap = await getDocs(buildCollectionQuery('students'));
    stSnap.forEach((d) => {
      const data = d.data();
      students.push({
        id: String(data.id || d.id),
        nis: String(data.nis || ''),
        nama: String(data.nama || ''),
        kelas: String(data.kelas || ''),
        kamar: String(data.kamar || ''),
        waliKelas: String(data.waliKelas || ''),
        guruWali: String(data.guruWali || ''),
        musyrif: String(data.musyrif || ''),
        kelompokQuran: String(data.kelompokQuran || ''),
        pengampuQuran: String(data.pengampuQuran || ''),
        gender: data.gender === 'Putri' ? 'Putri' : 'Putra',
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'students');
  }

  const teachers: TeacherPublic[] = [];
  try {
    const tfSnap = await getDocs(buildCollectionQuery('staff_profiles'));
    tfSnap.forEach((d) => {
      const data = d.data();
      const rawPeran = String(data.peran || 'Guru');
      const peran: UserRole = VALID_ROLES.has(rawPeran) ? (rawPeran as UserRole) : 'Guru';
      teachers.push({
        id: String(data.id || d.id),
        nama: String(data.nama || ''),
        username: String(data.username || ''),
        jabatan: String(data.jabatan || peran),
        peran,
        peranTambahan: Array.isArray(data.peranTambahan)
          ? (data.peranTambahan.filter((r: unknown) => VALID_ROLES.has(String(r))) as UserRole[])
          : [],
        genderScope:
          data.genderScope === 'Putra' || data.genderScope === 'Putri' ? data.genderScope : 'Semua',
        waliKelasOf: data.waliKelasOf ? String(data.waliKelasOf) : undefined,
        kamarBinaan: Array.isArray(data.kamarBinaan) ? data.kamarBinaan.map(String) : [],
        kelompokQuranBinaan: Array.isArray(data.kelompokQuranBinaan)
          ? data.kelompokQuranBinaan.map(String)
          : [],
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'staff_profiles');
  }

  const rooms: RoomMapping[] = [];
  try {
    const rmSnap = await getDocs(buildCollectionQuery('rooms'));
    rmSnap.forEach((d) => {
      const data = d.data();
      rooms.push({
        kamar: String(data.kamar || ''),
        musyrif: String(data.musyrif || ''),
        gender: data.gender === 'Putri' ? 'Putri' : 'Putra',
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'rooms');
  }

  const schedules: ScheduleItem[] = [];
  try {
    const schSnap = await getDocs(buildCollectionQuery('schedules'));
    schSnap.forEach((d) => {
      const data = d.data();
      schedules.push({
        id: String(data.id || d.id),
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

  const attendanceLogs: AttendanceLog[] = [];
  try {
    const attSnap = await getDocs(buildCollectionQuery('attendance_logs'));
    attSnap.forEach((d) => {
      const data = d.data();
      const tanggal = String(data.tanggal || new Date().toISOString().slice(0, 10));
      const rawTipe = String(data.tipe || 'Belajar');
      const jenisPresensi: PresensiType =
        rawTipe === 'Asrama' || rawTipe === 'Al-Quran' ? rawTipe : 'Belajar';
      const rawStatus = String(data.status || 'H');
      const status: AttendanceStatus = ['H', 'T', 'S', 'I', 'A'].includes(rawStatus)
        ? (rawStatus as AttendanceStatus)
        : 'H';
      attendanceLogs.push({
        id: String(data.id || d.id),
        timestamp: formatFirestoreTimestamp(data.updatedAt || data.createdAt, tanggal),
        tanggal,
        guru: String(data.petugas || ''),
        mapel: String(data.mapel || (jenisPresensi === 'Asrama' ? 'Kegiatan Asrama' : jenisPresensi)),
        kelas: String(data.kelas || ''),
        namaSiswa: String(data.studentName || ''),
        status,
        keterangan: String(data.catatan || ''),
        materi: data.materi ? String(data.materi) : undefined,
        jenisPresensi,
        gender: data.gender === 'Putri' ? 'Putri' : 'Putra',
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'attendance_logs');
  }

  const pembinaanRecords: PembinaanRecord[] = [];
  try {
    const pmbSnap = await getDocs(buildCollectionQuery('pembinaan_records'));
    pmbSnap.forEach((d) => {
      const data = d.data();
      const tanggal = String(data.tanggal || new Date().toISOString().slice(0, 10));
      const dayNum = Number(tanggal.slice(8, 10)) || 1;
      const pekanKe = Math.min(5, Math.max(1, Math.ceil(dayNum / 7)));
      const rawKat = String(data.kategori || 'Pembinaan Karakter');
      const kategori: PembinaanKategori = VALID_KATEGORI.has(rawKat)
        ? (rawKat as PembinaanKategori)
        : 'Pembinaan Karakter';
      const rawStatus = String(data.statusTindakLanjut || 'Proses');
      const statusTindakLanjut =
        rawStatus === 'Selesai' || rawStatus === 'Proses' || rawStatus === 'Eskalasi'
          ? rawStatus
          : 'Proses';
      pembinaanRecords.push({
        id: String(data.id || d.id),
        timestamp: formatFirestoreTimestamp(data.updatedAt || data.createdAt, tanggal),
        tanggal,
        bulan: tanggal.slice(0, 7),
        pekanKe,
        namaSantri: String(data.studentName || ''),
        kelas: String(data.kelas || ''),
        kamar: String(data.kamar || ''),
        gender: data.gender === 'Putri' ? 'Putri' : 'Putra',
        pembinaNama: String(data.waliKelas || ''),
        pembinaPeran: 'Wali Kelas',
        waliKelas: String(data.waliKelas || ''),
        lingkup: 'Individu',
        lokasi: 'Kelas',
        pihakKoordinasi: 'Wali Kelas',
        statusTindakLanjut,
        kategori,
        catatan: String(data.uraian || ''),
        tindakLanjut: String(data.tindakLanjut || '-'),
        poin: Number.isFinite(Number(data.poin)) ? Number(data.poin) : 0,
        ibadah: {
          subuh: true,
          dzuhur: true,
          ashar: true,
          maghrib: true,
          isya: true,
          tahajud: false,
          dhuha: false,
          tilawah: true,
        },
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'pembinaan_records');
  }

  return { students, teachers, rooms, schedules, attendanceLogs, pembinaanRecords };
}
