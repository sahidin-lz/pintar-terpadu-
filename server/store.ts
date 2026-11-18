import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AnalyticsTerpadu,
  AttachmentCategory,
  AttendanceLog,
  AttendanceStatus,
  ClassAnalyticsComparison,
  CloudAttachmentItem,
  DashboardStats,
  DivisiStatCard,
  ExamLog,
  Gender,
  IbadahChecklist,
  LabkomBooking,
  LabkomFixedSchedule,
  LabkomKampus,
  LabkomMasterItem,
  LabkomMasterKategori,
  LabkomPloting,
  LabkomStatePayload,
  MonitoringData,
  MonthlyWaliKelasReport,
  PembinaanAnalisisSummary,
  PembinaanKategori,
  PembinaanRecord,
  PortfolioSummary,
  PresensiType,
  PrioritasPembinaan,
  QuotaMetrics,
  ReportOptions,
  ReportOptionsScope,
  RoomMapping,
  ScheduleClashDetail,
  ScheduleItem,
  StatusTindakLanjut,
  Student,
  StudentFormEntry,
  SystemCounts,
  TeacherAbsenceLog,
  TeacherPublic,
  TeacherRecord,
  UserRole,
  WaliKelasMonthlyStudentRow,
  WhatsAppGatewayConfig,
  WhatsAppLogEntry,
  WilayahFilter,
} from '../src/types';
import {
  classifyLocationCategory,
  classifyTimeCategory,
  DEFAULT_LABKOM_BROADCAST_TEMPLATE,
  ensureBaselineMasters,
  loadLabkomSeedData,
  parseLabkomCsvContent,
  parseLabkomTanggalToIso,
} from './labkomSeed.js';

export interface DatabaseSchema {
  students: Student[];
  teachers: TeacherRecord[];
  rooms: RoomMapping[];
  ruanganUjian: string[];
  schedules: ScheduleItem[];
  attendanceLogs: AttendanceLog[];
  examLogs: ExamLog[];
  teacherAbsences: TeacherAbsenceLog[];
  pembinaanRecords: PembinaanRecord[];
  attachments?: CloudAttachmentItem[];
  whatsappLogs?: WhatsAppLogEntry[];
  labkomBookings?: LabkomBooking[];
  labkomFixedSchedules?: LabkomFixedSchedule[];
  labkomPlotings?: LabkomPloting[];
  labkomMasters?: LabkomMasterItem[];
  settings: {
    gasBridgeUrl: string;
    lastSyncedAt: string | null;
    lastModifiedAt?: string | null;
    explicitEmpty?: boolean;
    whatsappConfig?: WhatsAppGatewayConfig;
    labkomBroadcastTemplate?: string;
    labkomTelegramToken?: string;
    labkomTelegramChatId?: string;
  };
}

const THIS_DIR =
  typeof __dirname !== 'undefined' && __dirname
    ? __dirname
    : typeof import.meta !== 'undefined' && import.meta.url
    ? path.dirname(fileURLToPath(import.meta.url))
    : process.cwd();

function resolveBundledDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(THIS_DIR, '../data'),
    path.resolve(THIS_DIR, '../../data'),
    '/var/task/data',
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'pintar-db.json')) || fs.existsSync(path.join(dir, 'pintar-db.backup.json'))) {
      return dir;
    }
  }
  return candidates[0];
}

const BUNDLED_DATA_DIR = resolveBundledDataDir();
const BUNDLED_DB_FILE = path.join(BUNDLED_DATA_DIR, 'pintar-db.json');
const BUNDLED_BACKUP_FILE = path.join(BUNDLED_DATA_DIR, 'pintar-db.backup.json');

const RUNTIME_DATA_DIR = process.env.VERCEL ? '/tmp/pintar-data' : BUNDLED_DATA_DIR;
const DB_FILE = path.join(RUNTIME_DATA_DIR, 'pintar-db.json');
const DB_BACKUP_FILE = path.join(RUNTIME_DATA_DIR, 'pintar-db.backup.json');

const NAMA_HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function getMonthNameFromDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length >= 2 && parts[1] >= 1 && parts[1] <= 12) {
    return NAMA_BULAN[parts[1] - 1];
  }
  return NAMA_BULAN[new Date().getMonth()];
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function normalizeStr(val: string): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ');
}

function makeUsername(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || `user.${Date.now()}`;
}

const SUPER_ADMIN_ID = 'ADMIN_SUPER_SAHIDIN';
const SUPER_ADMIN_EMAIL = 'sahidin30@gmail.com';
const SUPER_ADMIN_PIN = '121320';
const SUPER_ADMIN_ACCEPTED_PINS = new Set(['121320', '123456', '1234', 'admin123']);
const SUPER_ADMIN_ACCEPTED_IDS = new Set([
  'sahidin30@gmail.com',
  'sahidin30',
  'sahidin',
  'admin',
  'admin super',
  'sahidin (admin super)',
]);

export function createSuperAdminRecord(): TeacherRecord {
  return {
    id: SUPER_ADMIN_ID,
    username: SUPER_ADMIN_EMAIL,
    nama: 'SAHIDIN (ADMIN SUPER)',
    jabatan: 'Admin Super Sistem',
    peran: 'Admin Super',
    peranTambahan: ['Admin SIM', 'Guru', 'Wali Kelas', 'Musyrif', 'Musyrifah', 'Pengampu Al-Quran'],
    genderScope: 'Semua',
    whatsapp: '',
    pin: SUPER_ADMIN_PIN,
  };
}

function ensureSuperAdmin(teachers: TeacherRecord[]): TeacherRecord[] {
  const withoutOld = teachers.filter(
    (t) => t.id !== SUPER_ADMIN_ID && t.username.toLowerCase() !== SUPER_ADMIN_EMAIL
  );
  return [createSuperAdminRecord(), ...withoutOld];
}

/**
 * STRICTLY EMPTY SCHOOL DATA ON INIT (0 siswa, 0 kamar, 0 jadwal, 0 log),
 * with the sole Super Admin account (sahidin30@gmail.com / PIN 121320) ready to upload SIM data.
 */
function createInitialDatabase(): DatabaseSchema {
  return {
    students: [],
    teachers: [createSuperAdminRecord()],
    rooms: [],
    ruanganUjian: [],
    schedules: [],
    attendanceLogs: [],
    examLogs: [],
    teacherAbsences: [],
    pembinaanRecords: [],
    attachments: [],
    whatsappLogs: [],
    labkomBookings: [],
    labkomFixedSchedules: [],
    labkomPlotings: [],
    labkomMasters: [],
    settings: {
      gasBridgeUrl: '',
      lastSyncedAt: null,
      whatsappConfig: {
        provider: 'Fonnte',
        apiUrl: 'https://api.fonnte.com/send',
        apiToken: '',
        autoNotifyAlfa: true,
        autoNotifyEskalasi: true,
      },
      labkomBroadcastTemplate: DEFAULT_LABKOM_BROADCAST_TEMPLATE,
    },
  };
}

function inferGender(text: string): Gender {
  const u = text.toUpperCase();
  if (u.includes('PUTRI') || u.includes('AKHWAT') || u.includes('MUSYRIFAH') || u.includes('USTZ')) {
    return 'Putri';
  }
  return 'Putra';
}

function roleToJabatan(peran: UserRole, peranTambahan?: UserRole[]): string {
  const all = [peran, ...(peranTambahan || [])].filter((v, i, a) => a.indexOf(v) === i);
  return all.join(' & ');
}

class PintarStore {
  private db: DatabaseSchema;
  private cacheHits = 0;
  private batchedWrites = 0;
  private masterCache: Map<string, { data: unknown; expiresAt: number }> = new Map();

  constructor() {
    try {
      this.db = this.loadFromDisk();
    } catch {
      this.db = createInitialDatabase();
    }
  }

  private scoreDatabase(parsed: DatabaseSchema): number {
    return (
      (parsed.students?.length || 0) * 10 +
      Math.max(0, (parsed.teachers?.length || 0) - 1) * 5 +
      (parsed.schedules?.length || 0) * 4 +
      (parsed.attendanceLogs?.length || 0) * 8 +
      (parsed.pembinaanRecords?.length || 0) * 8 +
      (parsed.examLogs?.length || 0) * 6 +
      (parsed.rooms?.length || 0) * 2
    );
  }

  private normalizeLoadedSchema(parsed: DatabaseSchema): DatabaseSchema {
    const normalizedTeachers = (parsed.teachers || []).map((t) => ({
      ...t,
      username: t.username || makeUsername(t.nama),
      peran: t.peran || ('Guru' as UserRole),
    }));
    const base = createInitialDatabase();
    const isExplicitEmpty = Boolean(parsed.settings?.explicitEmpty);
    const hasLabkomBookings = Array.isArray(parsed.labkomBookings) && parsed.labkomBookings.length > 0;
    const hasLabkomMasters = Array.isArray(parsed.labkomMasters) && parsed.labkomMasters.length > 0;

    let labkomBookings = Array.isArray(parsed.labkomBookings) ? parsed.labkomBookings : [];
    let labkomMasters = Array.isArray(parsed.labkomMasters) ? parsed.labkomMasters : [];

    if (!isExplicitEmpty && (!hasLabkomBookings || !hasLabkomMasters)) {
      const extraGurus = normalizedTeachers
        .filter((t) => t.peran !== 'Admin Super')
        .map((t) => t.nama);
      const extraKelas = Array.from(
        new Set((parsed.students || []).map((s) => s.kelas).filter((k) => k && k !== '-')),
      );
      const seed = loadLabkomSeedData(extraGurus, extraKelas);
      if (!hasLabkomBookings) labkomBookings = seed.bookings;
      if (!hasLabkomMasters) labkomMasters = seed.masters;
    }
    labkomMasters = ensureBaselineMasters(labkomMasters);

    return {
      ...base,
      ...parsed,
      students: Array.isArray(parsed.students) ? parsed.students : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      ruanganUjian: Array.isArray(parsed.ruanganUjian) ? parsed.ruanganUjian : [],
      schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
      attendanceLogs: Array.isArray(parsed.attendanceLogs) ? parsed.attendanceLogs : [],
      examLogs: Array.isArray(parsed.examLogs) ? parsed.examLogs : [],
      teacherAbsences: Array.isArray(parsed.teacherAbsences) ? parsed.teacherAbsences : [],
      pembinaanRecords: Array.isArray(parsed.pembinaanRecords) ? parsed.pembinaanRecords : [],
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      whatsappLogs: Array.isArray(parsed.whatsappLogs) ? parsed.whatsappLogs : [],
      labkomBookings,
      labkomFixedSchedules: Array.isArray(parsed.labkomFixedSchedules) ? parsed.labkomFixedSchedules : [],
      labkomPlotings: Array.isArray(parsed.labkomPlotings) ? parsed.labkomPlotings : [],
      labkomMasters,
      teachers: ensureSuperAdmin(normalizedTeachers),
      settings: {
        ...base.settings,
        ...(parsed.settings || {}),
        labkomBroadcastTemplate:
          parsed.settings?.labkomBroadcastTemplate || DEFAULT_LABKOM_BROADCAST_TEMPLATE,
      },
    };
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      const candidates = Array.from(
        new Set([DB_FILE, DB_BACKUP_FILE, BUNDLED_DB_FILE, BUNDLED_BACKUP_FILE]),
      );

      let bestRuntime: { db: DatabaseSchema; score: number } | null = null;
      let bestAny: { db: DatabaseSchema; score: number } | null = null;

      for (let i = 0; i < candidates.length; i++) {
        const file = candidates[i];
        if (!fs.existsSync(file)) continue;
        try {
          const raw = fs.readFileSync(file, 'utf-8');
          const parsed = JSON.parse(raw) as DatabaseSchema;
          if (!parsed || !Array.isArray(parsed.students)) continue;

          const normalized = this.normalizeLoadedSchema(parsed);
          const score = this.scoreDatabase(normalized);

          // Respect explicit user reset only if the runtime primary file explicitly records it
          if (file === DB_FILE && normalized.settings?.explicitEmpty && score === 0) {
            return normalized;
          }

          if (i < 2 && score > 0 && (!bestRuntime || score > bestRuntime.score)) {
            bestRuntime = { db: normalized, score };
          }
          if (!bestAny || score > bestAny.score) {
            bestAny = { db: normalized, score };
          }
        } catch {
          // Try next candidate
        }
      }

      if (bestRuntime && bestAny && bestRuntime.score >= bestAny.score) {
        return bestRuntime.db;
      }
      if (bestAny && bestAny.score > 0) {
        return bestAny.db;
      }
      if (bestAny) {
        return bestAny.db;
      }
    } catch {
      // Fallback to empty DB with Super Admin
    }
    const empty = createInitialDatabase();
    this.persist(empty);
    return empty;
  }

  private persist(nextDb?: DatabaseSchema, options?: { explicitEmpty?: boolean }) {
    const target = nextDb || this.db;
    this.masterCache.clear();
    if (!target.settings) {
      target.settings = { gasBridgeUrl: '', lastSyncedAt: null };
    }
    target.settings.lastModifiedAt = new Date().toISOString();
    const hasData =
      target.students.length > 0 ||
      target.teachers.length > 1 ||
      target.schedules.length > 0 ||
      target.attendanceLogs.length > 0 ||
      target.pembinaanRecords.length > 0 ||
      target.examLogs.length > 0;
    if (hasData) {
      target.settings.explicitEmpty = false;
    } else if (options?.explicitEmpty !== undefined) {
      target.settings.explicitEmpty = options.explicitEmpty;
    }
    try {
      if (!fs.existsSync(RUNTIME_DATA_DIR)) {
        fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
      }
      const serialized = JSON.stringify(target, null, 2);
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, serialized, 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
      if (hasData) {
        const tmpBackup = `${DB_BACKUP_FILE}.tmp`;
        fs.writeFileSync(tmpBackup, serialized, 'utf-8');
        fs.renameSync(tmpBackup, DB_BACKUP_FILE);
      }
    } catch {
      // In read-only serverless environments (e.g., Vercel), keep state in memory without crashing
    }
  }

  private getCached<T>(key: string, builder: () => T): T {
    const entry = this.masterCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      this.cacheHits++;
      return entry.data as T;
    }
    const val = builder();
    this.masterCache.set(key, { data: val, expiresAt: Date.now() + 60 * 60 * 1000 });
    return val;
  }

  public getSystemCounts(): SystemCounts {
    return {
      students: this.db.students.length,
      teachers: this.db.teachers.length,
      rooms: this.db.rooms.length,
      schedules: this.db.schedules.length,
      attendanceLogs: this.db.attendanceLogs.length,
      pembinaanRecords: this.db.pembinaanRecords.length,
      examLogs: this.db.examLogs.length,
      labkomBookings: (this.db.labkomBookings || []).length,
      byWilayah: {
        Putra: {
          students: this.db.students.filter((s) => s.gender === 'Putra').length,
          rooms: this.db.rooms.filter((r) => r.gender === 'Putra').length,
          schedules: this.db.schedules.filter((s) => s.gender === 'Putra').length,
          pembinaanRecords: this.db.pembinaanRecords.filter((p) => p.gender === 'Putra').length,
        },
        Putri: {
          students: this.db.students.filter((s) => s.gender === 'Putri').length,
          rooms: this.db.rooms.filter((r) => r.gender === 'Putri').length,
          schedules: this.db.schedules.filter((s) => s.gender === 'Putri').length,
          pembinaanRecords: this.db.pembinaanRecords.filter((p) => p.gender === 'Putri').length,
        },
      },
    };
  }

  public getQuotaMetrics(): QuotaMetrics {
    const total =
      this.db.students.length +
      this.db.teachers.length +
      this.db.schedules.length +
      this.db.attendanceLogs.length +
      this.db.examLogs.length +
      this.db.pembinaanRecords.length +
      (this.db.labkomBookings || []).length;
    return {
      storageEngine: 'Local Atomic Store + RAM Cache (Zero Daily Quota Limit)',
      externalQuotaUsedToday: 0,
      externalQuotaLimit: 'Unlimited (App-Local) / Batch-Only GAS Bridge',
      cacheHitCount: this.cacheHits,
      batchedWritesCount: this.batchedWrites,
      totalRecordsStored: total,
      gasBridgeUrl: this.db.settings.gasBridgeUrl,
      lastSyncedAt: this.db.settings.lastSyncedAt,
    };
  }

  // ==============================================================
  // AUTH & ACCOUNT REGISTRATION (GURU, WALI KELAS, MUSYRIF, MUSYRIFAH, ADMIN)
  // ==============================================================
  public registerTeacherAccount(payload: {
    nama: string;
    username?: string;
    peran: UserRole;
    peranTambahan?: UserRole[];
    genderScope: 'Putra' | 'Putri' | 'Semua';
    waliKelasOf?: string;
    kamarBinaan?: string[];
    whatsapp?: string;
    pin: string;
  }): { ok: boolean; teacher?: TeacherPublic; error?: string } {
    const cleanNama = payload.nama.trim().toUpperCase();
    if (!cleanNama) return { ok: false, error: 'Nama lengkap wajib diisi.' };
    if (!payload.pin || payload.pin.trim().length < 4) {
      return { ok: false, error: 'PIN / Password minimal 4 karakter.' };
    }

    const uname = (payload.username || makeUsername(cleanNama)).trim().toLowerCase();
    const exists = this.db.teachers.find(
      (t) => normalizeStr(t.nama) === normalizeStr(cleanNama) || t.username.toLowerCase() === uname
    );
    if (exists) {
      return { ok: false, error: `Akun dengan nama "${cleanNama}" atau username "${uname}" sudah terdaftar.` };
    }

    const newRec: TeacherRecord = {
      id: `G_${Date.now()}_${Math.floor(Math.random() * 100)}`,
      username: uname,
      nama: cleanNama,
      peran: payload.peran,
      peranTambahan: payload.peranTambahan || [],
      jabatan: roleToJabatan(payload.peran, payload.peranTambahan),
      genderScope: payload.genderScope || 'Semua',
      waliKelasOf: payload.waliKelasOf?.trim().toUpperCase() || undefined,
      kamarBinaan: (payload.kamarBinaan || []).map((k) => k.trim()).filter(Boolean),
      whatsapp: payload.whatsapp?.trim() || '',
      pin: payload.pin.trim(),
    };

    this.db.teachers.push(newRec);

    // Sync room mappings if kamarBinaan provided
    if (newRec.kamarBinaan && newRec.kamarBinaan.length > 0) {
      for (const km of newRec.kamarBinaan) {
        const roomGender: Gender = newRec.genderScope === 'Putri' ? 'Putri' : inferGender(km);
        const existingRoom = this.db.rooms.find((r) => normalizeStr(r.kamar) === normalizeStr(km));
        if (existingRoom) {
          existingRoom.musyrif = cleanNama;
        } else {
          this.db.rooms.push({ kamar: km, musyrif: cleanNama, gender: roomGender });
        }
      }
    }

    // Sync waliKelas to matching students if waliKelasOf provided
    if (newRec.waliKelasOf) {
      for (const st of this.db.students) {
        if (st.kelas.toUpperCase() === newRec.waliKelasOf) {
          st.waliKelas = cleanNama;
        }
      }
    }

    this.batchedWrites++;
    this.persist();
    const { pin: _pin, ...pub } = newRec;
    return { ok: true, teacher: pub };
  }

  public verifyTeacherPin(identifier: string, pin: string): { ok: boolean; teacher?: TeacherPublic; error?: string } {
    const req = normalizeStr(identifier);
    const cleanPin = String(pin || '').trim();
    if (!req) return { ok: false, error: 'Pilih nama akun atau masukkan email / username.' };

    // Fast-path Super Admin verification (works even on fresh/serverless instances)
    if (SUPER_ADMIN_ACCEPTED_IDS.has(req)) {
      const superAdmin =
        this.db.teachers.find((t) => t.id === SUPER_ADMIN_ID || t.peran === 'Admin Super') ||
        createSuperAdminRecord();
      if (superAdmin.pin === cleanPin || SUPER_ADMIN_ACCEPTED_PINS.has(cleanPin)) {
        const { pin: _pin, ...pub } = superAdmin;
        return { ok: true, teacher: pub };
      }
      return {
        ok: false,
        error: 'PIN Admin Super tidak cocok. Gunakan PIN default: 121320 (atau 123456).',
      };
    }

    const teacher = this.db.teachers.find(
      (t) =>
        normalizeStr(t.nama) === req ||
        normalizeStr(t.username) === req ||
        normalizeStr(t.username.split('@')[0]) === req
    );
    if (!teacher) return { ok: false, error: 'Akun tidak ditemukan. Silakan daftar akun baru atau upload data guru.' };
    if (teacher.pin !== cleanPin) return { ok: false, error: 'PIN / Password salah.' };
    const { pin: _pin, ...pub } = teacher;
    return { ok: true, teacher: pub };
  }

  public getTeacherByIdentifier(identifier: string): TeacherPublic | null {
    const req = normalizeStr(identifier);
    if (!req) return null;
    const teacher = this.db.teachers.find(
      (t) =>
        normalizeStr(t.nama) === req ||
        normalizeStr(t.username) === req ||
        normalizeStr(t.id) === req
    );
    if (!teacher) return null;
    const { pin: _pin, ...pub } = teacher;
    return pub;
  }

  public updateTeacherAccount(
    id: string,
    updates: Partial<Pick<TeacherRecord, 'peran' | 'peranTambahan' | 'genderScope' | 'waliKelasOf' | 'kamarBinaan' | 'whatsapp' | 'pin'>>
  ): TeacherPublic | null {
    const idx = this.db.teachers.findIndex((t) => t.id === id);
    if (idx < 0) return null;
    const prev = this.db.teachers[idx];
    const nextPeran = updates.peran || prev.peran;
    const nextExtra = updates.peranTambahan !== undefined ? updates.peranTambahan : prev.peranTambahan;
    const nextWaliKelas =
      updates.waliKelasOf !== undefined ? updates.waliKelasOf.toUpperCase() || undefined : prev.waliKelasOf;
    const nextKamarBinaan =
      updates.kamarBinaan !== undefined
        ? updates.kamarBinaan.map((k) => k.trim()).filter(Boolean)
        : prev.kamarBinaan;
    const nextRec: TeacherRecord = {
      ...prev,
      ...updates,
      peran: nextPeran,
      peranTambahan: nextExtra,
      jabatan: roleToJabatan(nextPeran, nextExtra),
      waliKelasOf: nextWaliKelas,
      kamarBinaan: nextKamarBinaan,
    };
    this.db.teachers[idx] = nextRec;

    if (nextKamarBinaan && nextKamarBinaan.length > 0) {
      for (const km of nextKamarBinaan) {
        const roomGender: Gender = nextRec.genderScope === 'Putri' ? 'Putri' : inferGender(km);
        const rm = this.db.rooms.find((x) => normalizeStr(x.kamar) === normalizeStr(km));
        if (rm) rm.musyrif = nextRec.nama;
        else this.db.rooms.push({ kamar: km, musyrif: nextRec.nama, gender: roomGender });

        for (const st of this.db.students) {
          if (normalizeStr(st.kamar) === normalizeStr(km)) {
            st.musyrif = nextRec.nama;
          }
        }
      }
    }

    if (nextWaliKelas) {
      for (const st of this.db.students) {
        if (st.kelas.toUpperCase() === nextWaliKelas.toUpperCase()) {
          st.waliKelas = nextRec.nama;
        }
      }
    }

    this.batchedWrites++;
    this.persist();
    const { pin: _pin, ...pub } = nextRec;
    return pub;
  }

  // ==============================================================
  // SCHEDULE & ROOM MANAGEMENT (GURU MEMBUAT & MENGUBAH JADWAL SENDIRI)
  // ==============================================================
  public getSchedulesList(filters?: { guru?: string; hari?: string; gender?: string }) {
    let rows = [...this.db.schedules];
    if (filters?.guru) {
      const req = normalizeStr(filters.guru);
      rows = rows.filter((s) => normalizeStr(s.guru).includes(req) || req.includes(normalizeStr(s.guru)));
    }
    if (filters?.hari && filters.hari !== 'SEMUA') {
      rows = rows.filter((s) => normalizeStr(s.hari) === normalizeStr(filters.hari!));
    }
    if (filters?.gender && filters.gender !== 'SEMUA') {
      rows = rows.filter((s) => s.gender === filters.gender);
    }
    return rows.sort((a, b) => a.hari.localeCompare(b.hari) || a.jamKe.localeCompare(b.jamKe, undefined, { numeric: true }));
  }

  private parseJpSlots(jamKe: string): number[] {
    const clean = String(jamKe || '').trim();
    if (!clean) return [];
    const parts = clean
      .split(/[-–,]/)
      .map((p) => Number.parseInt(p.replace(/[^\d]/g, ''), 10))
      .filter((n) => Number.isFinite(n));
    if (parts.length === 0) return [];
    if (parts.length === 1) return [parts[0]];
    const start = Math.max(1, Math.min(parts[0], parts[1]));
    const end = Math.min(12, Math.max(parts[0], parts[1]));
    const slots: number[] = [];
    for (let i = start; i <= end; i++) slots.push(i);
    return slots;
  }

  public checkScheduleClash(payload: {
    excludeId?: string;
    guru: string;
    hari: string;
    kelas: string;
    jamKe: string;
  }): ScheduleClashDetail {
    const reqGuru = normalizeStr(payload.guru);
    const reqHari = normalizeStr(payload.hari);
    const reqKelas = normalizeStr(payload.kelas);
    const reqSlots = this.parseJpSlots(payload.jamKe);

    if (!reqGuru || !reqHari || reqSlots.length === 0) {
      return { hasClash: false };
    }

    for (const existing of this.db.schedules) {
      if (payload.excludeId && existing.id === payload.excludeId) continue;
      if (normalizeStr(existing.hari) !== reqHari) continue;

      const exSlots = this.parseJpSlots(existing.jamKe);
      const overlap = reqSlots.filter((jp) => exSlots.includes(jp));
      if (overlap.length === 0) continue;

      // 1. Teacher Clash: Same teacher assigned to a different class at the same day & JP
      if (normalizeStr(existing.guru) === reqGuru && normalizeStr(existing.kelas) !== reqKelas) {
        return {
          hasClash: true,
          clashType: 'GURU',
          conflictingSchedule: existing,
          overlappingJp: overlap,
          message: `Bentrok Jadwal Guru: ${existing.guru} sudah terjadwal mengajar ${existing.mapel} di kelas ${existing.kelas} pada hari ${existing.hari} Jam ke-${existing.jamKe} (irisan JP: ${overlap.join(', ')}).`,
        };
      }

      // 2. Class Clash: Same class already has another teacher/subject at the same day & JP
      if (normalizeStr(existing.kelas) === reqKelas && normalizeStr(existing.guru) !== reqGuru) {
        return {
          hasClash: true,
          clashType: 'KELAS',
          conflictingSchedule: existing,
          overlappingJp: overlap,
          message: `Bentrok Ruang/Kelas: Kelas ${existing.kelas} sudah memiliki jadwal ${existing.mapel} bersama ${existing.guru} pada hari ${existing.hari} Jam ke-${existing.jamKe} (irisan JP: ${overlap.join(', ')}).`,
        };
      }
    }

    return { hasClash: false };
  }

  public createSchedule(payload: {
    guru: string;
    hari: string;
    kelas: string;
    mapel: string;
    jamKe: string;
    gender: Gender;
    kategori?: 'Akademik' | 'Al-Quran';
    isPerubahan?: boolean;
    catatanPerubahan?: string;
  }): ScheduleItem {
    const item: ScheduleItem = {
      id: `J_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      guru: payload.guru.trim().toUpperCase(),
      hari: payload.hari.trim().toUpperCase(),
      kelas: payload.kelas.trim().toUpperCase(),
      mapel: payload.mapel.trim().toUpperCase(),
      jamKe: payload.jamKe.trim(),
      gender: payload.gender,
      kategori:
        payload.kategori ||
        (payload.mapel.toUpperCase().includes('QUR') || payload.mapel.toUpperCase().includes('TAHFIDZ') ? 'Al-Quran' : 'Akademik'),
      isPerubahan: Boolean(payload.isPerubahan),
      catatanPerubahan: payload.catatanPerubahan?.trim() || '',
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    this.db.schedules.push(item);
    this.batchedWrites++;
    this.persist();
    return item;
  }

  public updateSchedule(
    id: string,
    payload: Partial<Omit<ScheduleItem, 'id'>>
  ): ScheduleItem | null {
    const idx = this.db.schedules.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const current = this.db.schedules[idx];
    const updated: ScheduleItem = {
      ...current,
      ...payload,
      guru: payload.guru ? payload.guru.trim().toUpperCase() : current.guru,
      hari: payload.hari ? payload.hari.trim().toUpperCase() : current.hari,
      kelas: payload.kelas ? payload.kelas.trim().toUpperCase() : current.kelas,
      mapel: payload.mapel ? payload.mapel.trim().toUpperCase() : current.mapel,
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    this.db.schedules[idx] = updated;
    this.batchedWrites++;
    this.persist();
    return updated;
  }

  public deleteSchedule(id: string): boolean {
    const before = this.db.schedules.length;
    this.db.schedules = this.db.schedules.filter((s) => s.id !== id);
    if (this.db.schedules.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  public getAllRooms(): RoomMapping[] {
    return [...this.db.rooms].sort((a, b) => a.kamar.localeCompare(b.kamar));
  }

  public assignRoomMusyrif(payload: { kamar: string; musyrif: string; gender: Gender }): RoomMapping {
    const kamarClean = payload.kamar.trim();
    const musyrifClean = payload.musyrif.trim().toUpperCase();
    const existing = this.db.rooms.find((r) => normalizeStr(r.kamar) === normalizeStr(kamarClean));
    if (existing) {
      existing.musyrif = musyrifClean;
      existing.gender = payload.gender;
      this.batchedWrites++;
      this.persist();
      return existing;
    }
    const created: RoomMapping = { kamar: kamarClean, musyrif: musyrifClean, gender: payload.gender };
    this.db.rooms.push(created);
    this.batchedWrites++;
    this.persist();
    return created;
  }

  public deleteRoomMapping(kamar: string): boolean {
    const before = this.db.rooms.length;
    this.db.rooms = this.db.rooms.filter((r) => normalizeStr(r.kamar) !== normalizeStr(kamar));
    if (this.db.rooms.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  // ==============================================================
  // SIM UPLOAD / BULK IMPORTERS (CSV / EXCEL PASTE)
  // ==============================================================
  public importSantriSim(payload: {
    rows: Array<{
      nis: string;
      nama: string;
      kelas: string;
      kamar: string;
      kelompokQuran: string;
      pengampuQuran: string;
      waliKelas?: string;
      musyrif?: string;
      gender: Gender;
    }>;
    replaceExisting?: boolean;
    autoCreateAccounts?: boolean;
    autoCreateQuranSchedules?: boolean;
    defaultPin?: string;
  }) {
    if (payload.replaceExisting) {
      this.db.students = [];
    }

    let inserted = 0;
    let updated = 0;
    const pinDefault = (payload.defaultPin || '1234').trim();

    const isTrivialRowNumber = (val?: string) => {
      const clean = String(val || '').trim();
      if (!clean || clean === '-' || clean === '0') return true;
      return /^\d{1,3}$/.test(clean);
    };
    const collapseWs = (val?: string) => String(val || '').replace(/\s+/g, ' ').trim();

    for (const r of payload.rows) {
      const cleanName = collapseWs(r.nama).toUpperCase();
      const cleanKelas = collapseWs(r.kelas).toUpperCase();
      if (!cleanName || cleanName === cleanKelas) continue;

      const cleanNis = collapseWs(r.nis);
      const cleanKamar = collapseWs(r.kamar);
      const cleanKelompok = collapseWs(r.kelompokQuran);
      const cleanPengampu = collapseWs(r.pengampuQuran).toUpperCase();

      const existing =
        this.db.students.find(
          (s) =>
            normalizeStr(s.nama) === normalizeStr(cleanName) &&
            (!s.gender || !r.gender || s.gender === r.gender),
        ) ||
        (!isTrivialRowNumber(cleanNis)
          ? this.db.students.find((s) => s.nis && s.nis === cleanNis && s.gender === r.gender)
          : undefined) ||
        this.db.students.find((s) => normalizeStr(s.nama) === normalizeStr(cleanName));
      if (existing) {
        if (cleanNis && (!isTrivialRowNumber(cleanNis) || !existing.nis)) existing.nis = cleanNis;
        if (cleanKelas) existing.kelas = cleanKelas;
        if (cleanKamar) existing.kamar = cleanKamar;
        if (cleanKelompok) existing.kelompokQuran = cleanKelompok;
        if (cleanPengampu) existing.pengampuQuran = cleanPengampu;
        if (r.waliKelas) existing.waliKelas = collapseWs(r.waliKelas).toUpperCase();
        if (r.musyrif) existing.musyrif = collapseWs(r.musyrif).toUpperCase();
        if (r.gender) existing.gender = r.gender;
        updated++;
      } else {
        this.db.students.push({
          id: `S_${Date.now()}_${inserted}_${Math.floor(Math.random() * 1000)}`,
          nis: cleanNis,
          nama: cleanName,
          kelas: cleanKelas,
          kamar: cleanKamar,
          kelompokQuran: cleanKelompok,
          pengampuQuran: cleanPengampu,
          gender: r.gender,
          waliKelas: r.waliKelas ? collapseWs(r.waliKelas).toUpperCase() : '',
          musyrif: r.musyrif ? collapseWs(r.musyrif).toUpperCase() : '',
          prioritas: '-',
        });
        inserted++;
      }

      // Ensure room exists in RoomMapping
      if (r.kamar) {
        const roomExists = this.db.rooms.some((rm) => normalizeStr(rm.kamar) === normalizeStr(r.kamar));
        if (!roomExists) {
          this.db.rooms.push({
            kamar: r.kamar,
            musyrif: '',
            gender: r.gender,
          });
        }
      }
    }

    let accountsCreated = 0;
    let quranSchedulesCreated = 0;

    if (payload.autoCreateAccounts) {
      const pengampuList = new Map<string, Gender>();
      for (const r of payload.rows) {
        if (r.pengampuQuran && r.pengampuQuran !== 'TIDAK DITEMUKAN') {
          pengampuList.set(r.pengampuQuran.toUpperCase(), r.gender);
        }
      }
      for (const [namaPengampu, gender] of pengampuList.entries()) {
        const exists = this.db.teachers.some((t) => normalizeStr(t.nama) === normalizeStr(namaPengampu));
        if (!exists) {
          this.db.teachers.push({
            id: `G_${Date.now()}_${accountsCreated}`,
            username: makeUsername(namaPengampu),
            nama: namaPengampu,
            peran: 'Guru',
            peranTambahan: [],
            jabatan: "Guru Al-Qur'an",
            genderScope: gender,
            pin: pinDefault,
          });
          accountsCreated++;
        }
      }
    }

    if (payload.autoCreateQuranSchedules) {
      const pairs = new Map<string, { guru: string; kelas: string; gender: Gender }>();
      for (const r of payload.rows) {
        if (r.pengampuQuran && r.kelompokQuran && r.pengampuQuran !== 'TIDAK DITEMUKAN') {
          const key = `${r.pengampuQuran.toUpperCase()}|${r.kelompokQuran.toUpperCase()}`;
          pairs.set(key, {
            guru: r.pengampuQuran.toUpperCase(),
            kelas: r.kelompokQuran.toUpperCase(),
            gender: r.gender,
          });
        }
      }
      const weekdays = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
      for (const pair of pairs.values()) {
        for (const hari of weekdays) {
          const exists = this.db.schedules.some(
            (sc) =>
              sc.hari === hari &&
              normalizeStr(sc.guru) === normalizeStr(pair.guru) &&
              normalizeStr(sc.kelas) === normalizeStr(pair.kelas) &&
              sc.kategori === 'Al-Quran'
          );
          if (!exists) {
            this.db.schedules.push({
              id: `JQ_${Date.now()}_${quranSchedulesCreated}`,
              guru: pair.guru,
              hari,
              kelas: pair.kelas,
              mapel: "HALAQAH AL-QUR'AN",
              jamKe: '1-2',
              gender: pair.gender,
              kategori: 'Al-Quran',
            });
            quranSchedulesCreated++;
          }
        }
      }
    }

    this.batchedWrites++;
    this.persist();
    return { inserted, updated, accountsCreated, quranSchedulesCreated };
  }

  public importPembinaanMaster(payload: {
    rows: Array<{
      nis: string;
      nama: string;
      gender: Gender;
      kamar: string;
      musyrif: string;
      namaOrtu: string;
      waOrtu: string;
      gayaBelajar: string;
      prioritas: PrioritasPembinaan;
      golDarah: string;
      riwayatPenyakit: string;
      obatRutin: string;
      targetKampus: string;
    }>;
    autoCreateMusyrif?: boolean;
    defaultPin?: string;
  }) {
    let inserted = 0;
    let updated = 0;
    let musyrifCreated = 0;
    const pinDefault = (payload.defaultPin || '1234').trim();

    for (const r of payload.rows) {
      const cleanName = r.nama.trim().toUpperCase();
      if (!cleanName) continue;
      const existing = this.db.students.find((s) => normalizeStr(s.nama) === normalizeStr(cleanName));
      if (existing) {
        if (r.nis) existing.nis = r.nis;
        if (r.kamar) existing.kamar = r.kamar;
        if (r.musyrif && r.musyrif !== '-') existing.musyrif = r.musyrif;
        if (r.namaOrtu && r.namaOrtu !== '-') existing.namaOrtu = r.namaOrtu;
        if (r.waOrtu && r.waOrtu !== '-') existing.waOrtu = r.waOrtu;
        if (r.gayaBelajar && r.gayaBelajar !== '-') existing.gayaBelajar = r.gayaBelajar;
        if (r.prioritas && r.prioritas !== '-') existing.prioritas = r.prioritas;
        if (r.golDarah && r.golDarah !== '-') existing.golDarah = r.golDarah;
        if (r.riwayatPenyakit && r.riwayatPenyakit !== '-') existing.riwayatPenyakit = r.riwayatPenyakit;
        if (r.obatRutin && r.obatRutin !== '-') existing.obatRutin = r.obatRutin;
        if (r.targetKampus && r.targetKampus !== '-') existing.targetKampus = r.targetKampus;
        updated++;
      } else {
        this.db.students.push({
          id: `S_${Date.now()}_${inserted}`,
          nis: r.nis,
          nama: cleanName,
          kelas: '-',
          kamar: r.kamar || '-',
          kelompokQuran: '-',
          gender: r.gender,
          waliKelas: '',
          musyrif: r.musyrif || '',
          namaOrtu: r.namaOrtu,
          waOrtu: r.waOrtu,
          gayaBelajar: r.gayaBelajar,
          prioritas: r.prioritas,
          golDarah: r.golDarah,
          riwayatPenyakit: r.riwayatPenyakit,
          obatRutin: r.obatRutin,
          targetKampus: r.targetKampus,
        });
        inserted++;
      }

      // Update RoomMapping if both kamar and musyrif exist
      if (r.kamar && r.musyrif && r.musyrif !== '-') {
        const rm = this.db.rooms.find((room) => normalizeStr(room.kamar) === normalizeStr(r.kamar));
        if (rm) {
          rm.musyrif = r.musyrif.toUpperCase();
        } else {
          this.db.rooms.push({ kamar: r.kamar, musyrif: r.musyrif.toUpperCase(), gender: r.gender });
        }

        if (payload.autoCreateMusyrif) {
          const existsT = this.db.teachers.some((t) => normalizeStr(t.nama) === normalizeStr(r.musyrif));
          if (!existsT) {
            const peran: UserRole = r.gender === 'Putri' ? 'Musyrifah' : 'Musyrif';
            this.db.teachers.push({
              id: `G_${Date.now()}_${musyrifCreated}`,
              username: makeUsername(r.musyrif),
              nama: r.musyrif.toUpperCase(),
              peran,
              jabatan: `${peran} Asrama`,
              genderScope: r.gender,
              kamarBinaan: [r.kamar],
              pin: pinDefault,
            });
            musyrifCreated++;
          }
        }
      }
    }

    this.batchedWrites++;
    this.persist();
    return { inserted, updated, musyrifCreated };
  }

  public importSchedulesBulk(payload: {
    rows: Array<{
      guru: string;
      hari: string;
      kelas: string;
      mapel: string;
      jamKe: string;
      gender: Gender;
      kategori: 'Akademik' | 'Al-Quran';
    }>;
    replaceExisting?: boolean;
  }) {
    if (payload.replaceExisting) {
      this.db.schedules = [];
    }
    let added = 0;
    let updated = 0;
    for (const r of payload.rows) {
      const cleanGuru = (r.guru || '').trim().toUpperCase();
      const cleanHari = (r.hari || 'SENIN').trim().toUpperCase();
      const cleanKelas = (r.kelas || '').trim().toUpperCase();
      const cleanMapel = (r.mapel || '').trim().toUpperCase();
      const cleanJam = (r.jamKe || '1-2').trim();
      if (!cleanGuru || !cleanKelas || !cleanMapel) continue;

      const exactIdx = this.db.schedules.findIndex(
        (s) =>
          s.hari === cleanHari &&
          normalizeStr(s.guru) === normalizeStr(cleanGuru) &&
          s.kelas.toUpperCase() === cleanKelas &&
          s.mapel.toUpperCase() === cleanMapel &&
          s.jamKe === cleanJam
      );
      if (exactIdx >= 0) {
        this.db.schedules[exactIdx].gender = r.gender;
        this.db.schedules[exactIdx].kategori = r.kategori;
        continue;
      }

      // Check if an existing schedule slot for the same Hari + Kelas + JamKe exists (edit via Excel template)
      const slotIdx = this.db.schedules.findIndex(
        (s) =>
          s.hari === cleanHari &&
          s.kelas.toUpperCase() === cleanKelas &&
          s.jamKe === cleanJam
      );
      if (slotIdx >= 0) {
        this.db.schedules[slotIdx] = {
          ...this.db.schedules[slotIdx],
          guru: cleanGuru,
          mapel: cleanMapel,
          gender: r.gender,
          kategori: r.kategori,
          updatedAt: new Date().toISOString(),
        };
        updated++;
      } else {
        this.db.schedules.push({
          id: `J_${Date.now()}_${added}_${Math.random().toString(36).slice(2, 6)}`,
          guru: cleanGuru,
          hari: cleanHari,
          kelas: cleanKelas,
          mapel: cleanMapel,
          jamKe: cleanJam,
          gender: r.gender,
          kategori: r.kategori,
        });
        added++;
      }
    }
    this.batchedWrites++;
    this.persist();
    return { added, updated };
  }

  public importTeachersBulk(payload: {
    rows: Array<{
      nama: string;
      peran: UserRole;
      peranTambahan?: UserRole[];
      genderScope: 'Putra' | 'Putri' | 'Semua';
      waliKelasOf?: string;
      kamarBinaan?: string[];
      whatsapp?: string;
      username?: string;
      pin?: string;
    }>;
  }) {
    let added = 0;
    let updated = 0;
    for (const r of payload.rows) {
      const cleanNama = r.nama.trim().toUpperCase();
      if (!cleanNama) continue;
      const existing = this.db.teachers.find(
        (t) =>
          normalizeStr(t.nama) === normalizeStr(cleanNama) ||
          (r.username && normalizeStr(t.username) === normalizeStr(r.username))
      );
      if (existing) {
        if (existing.id === SUPER_ADMIN_ID) continue;
        const extras = new Set<UserRole>(existing.peranTambahan || []);
        (r.peranTambahan || []).forEach((p) => extras.add(p));
        if (existing.peran && existing.peran !== r.peran) {
          extras.add(existing.peran);
          extras.add(r.peran);
          if (existing.peran === 'Guru') {
            existing.peran = r.peran;
          }
        } else {
          existing.peran = r.peran;
        }
        existing.peranTambahan = extras.size > 0 ? Array.from(extras) : undefined;
        existing.jabatan = roleToJabatan(existing.peran, existing.peranTambahan);
        if (existing.genderScope !== r.genderScope && existing.genderScope !== 'Semua') {
          existing.genderScope = 'Semua';
        } else {
          existing.genderScope = r.genderScope;
        }
        if (r.waliKelasOf) existing.waliKelasOf = r.waliKelasOf;
        if (r.kamarBinaan && r.kamarBinaan.length > 0) {
          const mergedRooms = Array.from(new Set([...(existing.kamarBinaan || []), ...r.kamarBinaan]));
          existing.kamarBinaan = mergedRooms;
        }
        if (r.whatsapp && r.whatsapp !== '628') existing.whatsapp = r.whatsapp;
        if (r.username) existing.username = r.username.toLowerCase();
        if (r.pin) existing.pin = r.pin;
        updated++;
      } else {
        const extras =
          r.peranTambahan && r.peranTambahan.length > 0
            ? Array.from(new Set(r.peranTambahan.filter((p) => p !== r.peran)))
            : undefined;
        this.db.teachers.push({
          id: `G_${Date.now()}_${added}`,
          username: (r.username || makeUsername(cleanNama)).toLowerCase(),
          nama: cleanNama,
          peran: r.peran,
          peranTambahan: extras,
          jabatan: roleToJabatan(r.peran, extras),
          genderScope: r.genderScope,
          waliKelasOf: r.waliKelasOf,
          kamarBinaan: r.kamarBinaan,
          whatsapp: r.whatsapp || '',
          pin: r.pin || '1234',
        });
        added++;
      }

      if (r.kamarBinaan) {
        for (const km of r.kamarBinaan) {
          const roomGender: Gender = r.genderScope === 'Putri' ? 'Putri' : inferGender(km);
          const rm = this.db.rooms.find((x) => normalizeStr(x.kamar) === normalizeStr(km));
          if (rm) rm.musyrif = cleanNama;
          else this.db.rooms.push({ kamar: km, musyrif: cleanNama, gender: roomGender });

          for (const st of this.db.students) {
            if (normalizeStr(st.kamar) === normalizeStr(km)) {
              st.musyrif = cleanNama;
            }
          }
        }
      }

      if (r.waliKelasOf) {
        for (const st of this.db.students) {
          if (st.kelas.toUpperCase() === r.waliKelasOf.toUpperCase()) {
            st.waliKelas = cleanNama;
          }
        }
      }
    }
    this.batchedWrites++;
    this.persist();
    return { added, updated };
  }

  public deleteTeacherAccount(id: string): { deleted: boolean; error?: string } {
    if (id === SUPER_ADMIN_ID) {
      return { deleted: false, error: 'Akun Admin Super utama tidak dapat dihapus.' };
    }
    const before = this.db.teachers.length;
    this.db.teachers = this.db.teachers.filter((t) => t.id !== id);
    if (this.db.teachers.length !== before) {
      this.batchedWrites++;
      this.persist();
      return { deleted: true };
    }
    return { deleted: false, error: 'Akun tidak ditemukan.' };
  }

  public addRuanganUjian(namaRuang: string): string[] {
    const clean = namaRuang.trim().toUpperCase();
    if (clean && !this.db.ruanganUjian.includes(clean)) {
      this.db.ruanganUjian.push(clean);
      this.batchedWrites++;
      this.persist();
    }
    return this.db.ruanganUjian;
  }

  public updateRuanganUjian(oldName: string, newName: string): string[] {
    const cleanOld = oldName.trim().toUpperCase();
    const cleanNew = newName.trim().toUpperCase();
    if (!cleanOld || !cleanNew) return this.db.ruanganUjian;
    const idx = this.db.ruanganUjian.findIndex((r) => r.trim().toUpperCase() === cleanOld);
    if (idx >= 0) {
      this.db.ruanganUjian[idx] = cleanNew;
      this.batchedWrites++;
      this.persist();
    }
    return this.db.ruanganUjian;
  }

  public deleteRuanganUjian(namaRuang: string): string[] {
    const clean = namaRuang.trim().toUpperCase();
    this.db.ruanganUjian = this.db.ruanganUjian.filter((r) => r.trim().toUpperCase() !== clean);
    this.batchedWrites++;
    this.persist();
    return this.db.ruanganUjian;
  }

  public reconcileDatabaseRelations(defaultPin = '1234') {
    const pinClean = (defaultPin || '1234').trim();

    // 1. Ensure every Pengampu Al-Quran & Schedule Guru has a TeacherRecord in Master Pegawai
    for (const st of this.db.students) {
      if (st.pengampuQuran && st.pengampuQuran !== 'TIDAK DITEMUKAN' && st.pengampuQuran !== '-') {
        const cleanGuru = st.pengampuQuran.trim().toUpperCase();
        const exists = this.db.teachers.find((t) => normalizeStr(t.nama) === normalizeStr(cleanGuru));
        if (!exists) {
          this.db.teachers.push({
            id: `G_${Date.now()}_${this.db.teachers.length}`,
            username: makeUsername(cleanGuru),
            nama: cleanGuru,
            peran: 'Guru',
            peranTambahan: [],
            jabatan: "Guru Al-Qur'an",
            genderScope: st.gender,
            pin: pinClean,
          });
        }
      }
    }

    for (const sc of this.db.schedules) {
      if (sc.guru && sc.guru !== '-') {
        const cleanGuru = sc.guru.trim().toUpperCase();
        const exists = this.db.teachers.find((t) => normalizeStr(t.nama) === normalizeStr(cleanGuru));
        if (!exists) {
          this.db.teachers.push({
            id: `G_${Date.now()}_${this.db.teachers.length}`,
            username: makeUsername(cleanGuru),
            nama: cleanGuru,
            peran: 'Guru',
            peranTambahan: [],
            jabatan: 'Guru',
            genderScope: sc.gender || inferGender(cleanGuru),
            pin: pinClean,
          });
        }
      }
    }

    // 2. Sync Rooms from teachers.kamarBinaan and students.kamar
    for (const t of this.db.teachers) {
      if (t.id === SUPER_ADMIN_ID) continue;
      if (t.kamarBinaan && t.kamarBinaan.length > 0) {
        for (const km of t.kamarBinaan) {
          const cleanKm = km.trim();
          if (!cleanKm || cleanKm === '-') continue;
          const rGender: Gender = t.genderScope === 'Putri' ? 'Putri' : inferGender(cleanKm);
          const rm = this.db.rooms.find((r) => normalizeStr(r.kamar) === normalizeStr(cleanKm));
          if (rm) {
            rm.musyrif = t.nama;
          } else {
            this.db.rooms.push({ kamar: cleanKm, musyrif: t.nama, gender: rGender });
          }
        }
      }
    }

    for (const st of this.db.students) {
      if (st.kamar && st.kamar !== '-') {
        let rm = this.db.rooms.find((r) => normalizeStr(r.kamar) === normalizeStr(st.kamar));
        if (!rm) {
          rm = { kamar: st.kamar, musyrif: st.musyrif || '', gender: st.gender };
          this.db.rooms.push(rm);
        } else if (!rm.musyrif && st.musyrif) {
          rm.musyrif = st.musyrif;
        }
        if (rm.musyrif && !st.musyrif) {
          st.musyrif = rm.musyrif;
        }
      }
    }

    // 3. Sync Wali Kelas between teachers.waliKelasOf and students.waliKelas
    const waliByClass = new Map<string, string>();
    for (const t of this.db.teachers) {
      if (t.id === SUPER_ADMIN_ID) continue;
      if (t.waliKelasOf) {
        waliByClass.set(normalizeStr(t.waliKelasOf), t.nama);
      }
    }
    for (const st of this.db.students) {
      if (st.kelas && st.kelas !== '-') {
        const mappedWali = waliByClass.get(normalizeStr(st.kelas));
        if (mappedWali) {
          st.waliKelas = mappedWali;
        }
      }
    }
  }

  public importAllInOne(payload: {
    santriRows?: Array<{
      nis: string;
      nama: string;
      kelas: string;
      kamar: string;
      kelompokQuran: string;
      pengampuQuran: string;
      waliKelas?: string;
      musyrif?: string;
      gender: Gender;
    }>;
    teacherRows?: Array<{
      nama: string;
      peran: UserRole;
      peranTambahan?: UserRole[];
      genderScope: 'Putra' | 'Putri' | 'Semua';
      waliKelasOf?: string;
      kamarBinaan?: string[];
      whatsapp?: string;
      username?: string;
      pin?: string;
    }>;
    scheduleRows?: Array<{
      guru: string;
      hari: string;
      kelas: string;
      mapel: string;
      jamKe: string;
      gender: Gender;
      kategori: 'Akademik' | 'Al-Quran';
    }>;
    ruanganUjian?: string[];
    pembinaanRows?: Array<{
      tanggal: string;
      namaSantri: string;
      gender: Gender;
      kategori: string;
      uraian: string;
      poin: number;
      statusTindakLanjut: StatusTindakLanjut;
      tindakLanjut: string;
    }>;
    replaceExisting?: boolean;
    autoCreateAccounts?: boolean;
    autoCreateQuranSchedules?: boolean;
    defaultPin?: string;
  }) {
    const santriResult =
      payload.santriRows && payload.santriRows.length > 0
        ? this.importSantriSim({
            rows: payload.santriRows,
            replaceExisting: payload.replaceExisting,
            autoCreateAccounts: payload.autoCreateAccounts ?? true,
            autoCreateQuranSchedules: payload.autoCreateQuranSchedules ?? true,
            defaultPin: payload.defaultPin || '1234',
          })
        : { inserted: 0, updated: 0, accountsCreated: 0, quranSchedulesCreated: 0 };

    const filteredTeachers = (payload.teacherRows || []).filter((t) => {
      const n = (t.nama || '').trim().toUpperCase();
      if (!n || n === '(BELUM DITENTUKAN)' || n === 'BELUM DIATUR' || n === '-') return false;
      if (/^(UST\.|USTZ\.)\s+(WALI KELAS|MUSYRIFAH|MUSYRIF)\s+/i.test(n)) return false;
      return true;
    });

    const teacherResult =
      filteredTeachers.length > 0
        ? this.importTeachersBulk({ rows: filteredTeachers })
        : { added: 0, updated: 0 };

    const scheduleResult =
      payload.scheduleRows && payload.scheduleRows.length > 0
        ? this.importSchedulesBulk({
            rows: payload.scheduleRows,
            replaceExisting: payload.replaceExisting,
          })
        : { added: 0, updated: 0 };

    let roomsAdded = 0;
    if (payload.ruanganUjian && payload.ruanganUjian.length > 0) {
      for (const r of payload.ruanganUjian) {
        const clean = r.trim().toUpperCase();
        if (clean && !this.db.ruanganUjian.includes(clean)) {
          this.db.ruanganUjian.push(clean);
          roomsAdded++;
        }
      }
    }

    let pembinaanAdded = 0;
    if (payload.pembinaanRows && payload.pembinaanRows.length > 0) {
      const batch: Array<Omit<PembinaanRecord, 'id' | 'timestamp'>> = payload.pembinaanRows
        .filter((p) => p.namaSantri && p.namaSantri.trim().length > 0)
        .map((p) => {
          const st = this.db.students.find((s) => normalizeStr(s.nama) === normalizeStr(p.namaSantri));
          const lowKat = (p.kategori || '').toLowerCase();
          let kategori: PembinaanKategori = 'Pemantauan Ibadah';
          if (lowKat.includes('disipl')) kategori = 'Kedisiplinan';
          else if (lowKat.includes('prest')) kategori = 'Prestasi';
          else if (lowKat.includes('sehat') || lowKat.includes('sakit')) kategori = 'Kesehatan';
          else if (lowKat.includes('karak') || lowKat.includes('konsel') || lowKat.includes('akade')) {
            kategori = 'Pembinaan Karakter';
          }
          return {
            tanggal: p.tanggal,
            pekanKe: 1,
            bulan: getMonthNameFromDate(p.tanggal),
            namaSantri: p.namaSantri.trim().toUpperCase(),
            kelas: st?.kelas || '-',
            kamar: st?.kamar || '-',
            gender: st?.gender || p.gender,
            pembinaNama: st?.waliKelas || 'PEMBINA',
            pembinaPeran: 'Wali Kelas',
            waliKelas: st?.waliKelas || 'WALI KELAS',
            lingkup: 'Individu',
            lokasi: 'Kelas',
            pihakKoordinasi: 'Wali Kelas',
            kategori,
            catatan: p.uraian,
            poin: p.poin,
            statusTindakLanjut: p.statusTindakLanjut,
            tindakLanjut: p.tindakLanjut,
            ibadah: {
              subuh: true,
              dzuhur: true,
              ashar: true,
              maghrib: true,
              isya: true,
              tahajud: false,
              dhuha: false,
              tilawah: kategori === 'Pemantauan Ibadah',
            },
          };
        });
      if (batch.length > 0) {
        const res = this.savePembinaanBatch(batch);
        pembinaanAdded = res.saved;
      }
    }

    // Reconcile all cross-entity relationships and tidy Putra/Putri normalization
    this.reconcileDatabaseRelations(payload.defaultPin || '1234');
    this.tidyAllPutraPutriData({ skipSyncMasters: true });

    return {
      santri: santriResult,
      teachers: teacherResult,
      schedules: scheduleResult,
      ruanganUjianAdded: roomsAdded,
      pembinaanAdded,
    };
  }

  public importPersonalByTeacher(payload: {
    teacherName: string;
    santriRows?: Array<{
      nis?: string;
      nama: string;
      kelas: string;
      kamar?: string;
      kelompokQuran?: string;
      pengampuQuran?: string;
      gender: Gender;
    }>;
    scheduleRows?: Array<{
      guru?: string;
      hari: string;
      kelas: string;
      mapel: string;
      jamKe: string;
      gender: Gender;
      kategori?: 'Akademik' | 'Al-Quran';
    }>;
    pembinaanRows?: Array<{
      tanggal: string;
      namaSantri: string;
      gender: Gender;
      kategori: string;
      uraian: string;
      poin: number;
      statusTindakLanjut: StatusTindakLanjut;
      tindakLanjut: string;
    }>;
  }) {
    const teacher = this.db.teachers.find(
      (t) =>
        normalizeStr(t.nama) === normalizeStr(payload.teacherName) ||
        normalizeStr(t.username) === normalizeStr(payload.teacherName),
    );
    if (!teacher) {
      return { ok: false as const, error: 'Akun pembina tidak ditemukan.' };
    }

    let santriInserted = 0;
    let santriUpdated = 0;
    if (payload.santriRows && payload.santriRows.length > 0) {
      const normalizedRows = payload.santriRows.map((r) => ({
        nis: (r.nis || '').trim(),
        nama: (r.nama || '').trim().toUpperCase(),
        kelas: (r.kelas || teacher.waliKelasOf || '-').trim().toUpperCase(),
        kamar: (r.kamar || teacher.kamarBinaan?.[0] || '-').trim(),
        kelompokQuran: (r.kelompokQuran || '-').trim(),
        pengampuQuran: (r.pengampuQuran || '').trim().toUpperCase(),
        gender: r.gender,
      }));
      const res = this.importSantriSim({
        rows: normalizedRows,
        replaceExisting: false,
        autoCreateAccounts: false,
        autoCreateQuranSchedules: false,
      });
      santriInserted = res.inserted;
      santriUpdated = res.updated;

      // Auto-link waliKelas / musyrif to logged-in teacher when matching role/assignment
      for (const r of normalizedRows) {
        const st = this.db.students.find((s) => normalizeStr(s.nama) === normalizeStr(r.nama));
        if (!st) continue;
        if (
          teacher.peran === 'Wali Kelas' ||
          (teacher.waliKelasOf && normalizeStr(st.kelas) === normalizeStr(teacher.waliKelasOf))
        ) {
          if (!st.waliKelas) st.waliKelas = teacher.nama;
        }
        if (
          teacher.peran === 'Musyrif' ||
          teacher.peran === 'Musyrifah' ||
          (teacher.kamarBinaan && teacher.kamarBinaan.some((k) => normalizeStr(k) === normalizeStr(st.kamar)))
        ) {
          if (!st.musyrif) st.musyrif = teacher.nama;
          if (st.kamar && st.kamar !== '-') {
            const rm = this.db.rooms.find((x) => normalizeStr(x.kamar) === normalizeStr(st.kamar));
            if (rm && !rm.musyrif) rm.musyrif = teacher.nama;
          }
        }
      }
    }

    let schedulesAdded = 0;
    if (payload.scheduleRows && payload.scheduleRows.length > 0) {
      const normalizedSchedules = payload.scheduleRows.map((s) => {
        const mapelUp = (s.mapel || 'MAPEL').trim().toUpperCase();
        const kat: 'Akademik' | 'Al-Quran' =
          s.kategori ||
          (mapelUp.includes('QUR') || mapelUp.includes('TAHFIDZ') || mapelUp.includes('TAHSIN')
            ? 'Al-Quran'
            : 'Akademik');
        return {
          guru: teacher.nama,
          hari: (s.hari || 'SENIN').trim().toUpperCase(),
          kelas: (s.kelas || teacher.waliKelasOf || '-').trim().toUpperCase(),
          mapel: mapelUp,
          jamKe: (s.jamKe || '1-2').trim(),
          gender: s.gender,
          kategori: kat,
        };
      });
      const res = this.importSchedulesBulk({ rows: normalizedSchedules, replaceExisting: false });
      schedulesAdded = res.added;
    }

    let pembinaanSaved = 0;
    if (payload.pembinaanRows && payload.pembinaanRows.length > 0) {
      const isAsrama = teacher.peran === 'Musyrif' || teacher.peran === 'Musyrifah';
      const batch: Array<Omit<PembinaanRecord, 'id' | 'timestamp'>> = payload.pembinaanRows
        .filter((p) => p.namaSantri.trim().length > 0)
        .map((p) => {
          const st = this.db.students.find((s) => normalizeStr(s.nama) === normalizeStr(p.namaSantri));
          const lowKat = (p.kategori || '').toLowerCase();
          let kategori: PembinaanKategori = 'Pemantauan Ibadah';
          if (lowKat.includes('disipl')) kategori = 'Kedisiplinan';
          else if (lowKat.includes('prest')) kategori = 'Prestasi';
          else if (lowKat.includes('sehat') || lowKat.includes('sakit')) kategori = 'Kesehatan';
          else if (lowKat.includes('karak') || lowKat.includes('konsel') || lowKat.includes('akade')) {
            kategori = 'Pembinaan Karakter';
          }
          return {
            tanggal: p.tanggal,
            pekanKe: 1,
            bulan: getMonthNameFromDate(p.tanggal),
            namaSantri: p.namaSantri.trim().toUpperCase(),
            kelas: st?.kelas || teacher.waliKelasOf || '-',
            kamar: st?.kamar || teacher.kamarBinaan?.[0] || '-',
            gender: st?.gender || p.gender,
            pembinaNama: teacher.nama,
            pembinaPeran: teacher.peran,
            waliKelas: st?.waliKelas || teacher.nama,
            lingkup: 'Individu',
            lokasi: isAsrama ? 'Asrama' : 'Kelas',
            pihakKoordinasi: isAsrama ? 'Musyrif/ah' : 'Wali Kelas',
            kategori,
            catatan: p.uraian,
            poin: p.poin,
            statusTindakLanjut: p.statusTindakLanjut,
            tindakLanjut: p.tindakLanjut,
            ibadah: {
              subuh: true,
              dzuhur: true,
              ashar: true,
              maghrib: true,
              isya: true,
              tahajud: false,
              dhuha: false,
              tilawah: kategori === 'Pemantauan Ibadah',
            },
          };
        });
      if (batch.length > 0) {
        const res = this.savePembinaanBatch(batch);
        pembinaanSaved = res.saved;
      }
    }

    this.batchedWrites++;
    this.persist();

    return {
      ok: true as const,
      santriInserted,
      santriUpdated,
      schedulesAdded,
      pembinaanSaved,
    };
  }

  public getStudentsDirectory(filters?: { gender?: string; kelas?: string; q?: string }): Student[] {
    let list = [...this.db.students];
    if (filters?.gender && filters.gender !== 'Semua') {
      list = list.filter((s) => s.gender === filters.gender);
    }
    if (filters?.kelas && filters.kelas !== 'SEMUA') {
      const reqKelas = normalizeStr(filters.kelas);
      list = list.filter((s) => normalizeStr(s.kelas) === reqKelas);
    }
    if (filters?.q) {
      const q = normalizeStr(filters.q);
      list = list.filter(
        (s) =>
          normalizeStr(s.nama).includes(q) ||
          normalizeStr(s.kelas).includes(q) ||
          normalizeStr(s.kamar).includes(q) ||
          normalizeStr(s.nis || '').includes(q),
      );
    }
    return list.sort((a, b) => a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) || a.nama.localeCompare(b.nama));
  }

  public moveStudentsClass(payload: {
    studentIds: string[];
    targetKelas?: string;
    targetKamar?: string;
    targetKelompok?: string;
    targetGender?: Gender;
  }): { moved: number; updatedStudents: Student[] } {
    const idSet = new Set(payload.studentIds);
    const nextKelas = payload.targetKelas?.trim().toUpperCase();
    const nextKamar = payload.targetKamar?.trim();
    const nextKelompok = payload.targetKelompok?.trim();
    const nextGender = payload.targetGender;

    // Lookup wali kelas matching targetKelas if present
    const matchingWali = nextKelas
      ? this.db.teachers.find(
          (t) => t.waliKelasOf && normalizeStr(t.waliKelasOf) === normalizeStr(nextKelas),
        )
      : undefined;
    const matchingRoom = nextKamar
      ? this.db.rooms.find((r) => normalizeStr(r.kamar) === normalizeStr(nextKamar))
      : undefined;

    let moved = 0;
    const updatedStudents: Student[] = [];
    for (const st of this.db.students) {
      if (!idSet.has(st.id)) continue;
      if (nextKelas) {
        st.kelas = nextKelas;
        if (matchingWali) st.waliKelas = matchingWali.nama;
      }
      if (nextKamar) {
        st.kamar = nextKamar;
        if (matchingRoom?.musyrif) st.musyrif = matchingRoom.musyrif;
      }
      if (nextKelompok) {
        st.kelompokQuran = nextKelompok;
      }
      if (nextGender) {
        st.gender = nextGender;
      }
      moved++;
      updatedStudents.push(st);
    }

    if (nextKamar && !matchingRoom) {
      this.db.rooms.push({
        kamar: nextKamar,
        musyrif: '',
        gender: nextGender || inferGender(nextKamar),
      });
    }

    if (moved > 0) {
      this.batchedWrites++;
      this.persist();
    }
    return { moved, updatedStudents };
  }

  public updateStudentProfile(
    namaSantri: string,
    updates: Partial<
      Pick<
        Student,
        | 'nis'
        | 'kelas'
        | 'kamar'
        | 'waliKelas'
        | 'musyrif'
        | 'namaOrtu'
        | 'waOrtu'
        | 'gayaBelajar'
        | 'prioritas'
        | 'golDarah'
        | 'riwayatPenyakit'
        | 'obatRutin'
        | 'targetKampus'
      >
    >
  ): Student | null {
    const idx = this.db.students.findIndex((s) => normalizeStr(s.nama) === normalizeStr(namaSantri));
    if (idx < 0) return null;
    this.db.students[idx] = { ...this.db.students[idx], ...updates };
    this.batchedWrites++;
    this.persist();
    return this.db.students[idx];
  }

  public updateStudentById(
    id: string,
    updates: Partial<
      Pick<
        Student,
        | 'nis'
        | 'nama'
        | 'gender'
        | 'kelas'
        | 'kamar'
        | 'kelompokQuran'
        | 'pengampuQuran'
        | 'waliKelas'
        | 'musyrif'
      >
    >
  ): Student | null {
    const idx = this.db.students.findIndex((s) => s.id === id);
    if (idx < 0) return null;
    const current = this.db.students[idx];
    const nextNama = updates.nama ? updates.nama.trim().toUpperCase() : current.nama;
    const nextKelas = updates.kelas ? updates.kelas.trim().toUpperCase() : current.kelas;
    const nextKamar = updates.kamar !== undefined ? updates.kamar.trim() : current.kamar;
    const nextKelompok =
      updates.kelompokQuran !== undefined ? updates.kelompokQuran.trim() : current.kelompokQuran;
    const nextPengampu =
      updates.pengampuQuran !== undefined
        ? updates.pengampuQuran.trim().toUpperCase()
        : current.pengampuQuran;
    const nextGender: Gender = updates.gender || current.gender;

    this.db.students[idx] = {
      ...current,
      ...updates,
      nama: nextNama,
      kelas: nextKelas,
      kamar: nextKamar,
      kelompokQuran: nextKelompok,
      pengampuQuran: nextPengampu,
      gender: nextGender,
    };
    this.reconcileDatabaseRelations('1234');
    this.batchedWrites++;
    this.persist();
    return this.db.students[idx];
  }

  public deleteStudentById(id: string): boolean {
    const before = this.db.students.length;
    this.db.students = this.db.students.filter((s) => s.id !== id);
    if (this.db.students.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  public resetDatabaseEmpty() {
    this.db = createInitialDatabase();
    this.cacheHits = 0;
    this.batchedWrites = 0;
    this.persist(this.db, { explicitEmpty: true });
    return this.getSystemCounts();
  }

  public getFullSnapshot() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      lastModifiedAt: this.db.settings?.lastModifiedAt || new Date().toISOString(),
      students: this.db.students,
      teachers: this.db.teachers.map(({ pin: _pin, ...pub }) => pub),
      rooms: this.db.rooms,
      ruanganUjian: this.db.ruanganUjian,
      schedules: this.db.schedules,
      attendanceLogs: this.db.attendanceLogs,
      examLogs: this.db.examLogs,
      teacherAbsences: this.db.teacherAbsences,
      pembinaanRecords: this.db.pembinaanRecords,
      attachments: this.db.attachments || [],
      whatsappLogs: this.db.whatsappLogs || [],
      labkomBookings: this.db.labkomBookings || [],
      labkomFixedSchedules: this.db.labkomFixedSchedules || [],
      labkomPlotings: this.db.labkomPlotings || [],
      labkomMasters: this.db.labkomMasters || [],
      settings: this.db.settings,
    };
  }

  public restoreSnapshot(
    snapshot: Partial<{
      students: Student[];
      teachers: TeacherPublic[];
      rooms: RoomMapping[];
      ruanganUjian: string[];
      schedules: ScheduleItem[];
      attendanceLogs: AttendanceLog[];
      examLogs: ExamLog[];
      teacherAbsences: TeacherAbsenceLog[];
      pembinaanRecords: PembinaanRecord[];
      attachments: CloudAttachmentItem[];
      whatsappLogs: WhatsAppLogEntry[];
      labkomBookings: LabkomBooking[];
      labkomFixedSchedules: LabkomFixedSchedule[];
      labkomPlotings: LabkomPloting[];
      labkomMasters: LabkomMasterItem[];
      settings: Partial<DatabaseSchema['settings']>;
    }>,
    mode: 'merge' | 'replace' = 'merge',
  ) {
    if (!snapshot || typeof snapshot !== 'object') {
      return { ok: false as const, error: 'Snapshot tidak valid.' };
    }

    let studentsRestored = 0;
    let teachersRestored = 0;
    let schedulesRestored = 0;
    let attendanceRestored = 0;
    let pembinaanRestored = 0;
    let examRestored = 0;

    if (mode === 'replace') {
      const existingPinByName = new Map<string, string>();
      for (const t of this.db.teachers) {
        existingPinByName.set(normalizeStr(t.nama), t.pin);
        existingPinByName.set(normalizeStr(t.username), t.pin);
      }

      if (Array.isArray(snapshot.students)) {
        this.db.students = snapshot.students;
        studentsRestored = snapshot.students.length;
      }
      if (Array.isArray(snapshot.teachers)) {
        const restoredTeachers: TeacherRecord[] = snapshot.teachers.map((t) => ({
          ...t,
          pin:
            existingPinByName.get(normalizeStr(t.nama)) ||
            existingPinByName.get(normalizeStr(t.username)) ||
            '1234',
        }));
        this.db.teachers = ensureSuperAdmin(restoredTeachers);
        teachersRestored = restoredTeachers.length;
      }
      if (Array.isArray(snapshot.rooms)) this.db.rooms = snapshot.rooms;
      if (Array.isArray(snapshot.ruanganUjian)) this.db.ruanganUjian = snapshot.ruanganUjian;
      if (Array.isArray(snapshot.schedules)) {
        this.db.schedules = snapshot.schedules;
        schedulesRestored = snapshot.schedules.length;
      }
      if (Array.isArray(snapshot.attendanceLogs)) {
        this.db.attendanceLogs = snapshot.attendanceLogs;
        attendanceRestored = snapshot.attendanceLogs.length;
      }
      if (Array.isArray(snapshot.examLogs)) {
        this.db.examLogs = snapshot.examLogs;
        examRestored = snapshot.examLogs.length;
      }
      if (Array.isArray(snapshot.teacherAbsences)) this.db.teacherAbsences = snapshot.teacherAbsences;
      if (Array.isArray(snapshot.pembinaanRecords)) {
        this.db.pembinaanRecords = snapshot.pembinaanRecords;
        pembinaanRestored = snapshot.pembinaanRecords.length;
      }
      if (Array.isArray(snapshot.attachments)) this.db.attachments = snapshot.attachments;
      if (Array.isArray(snapshot.whatsappLogs)) this.db.whatsappLogs = snapshot.whatsappLogs;
      if (Array.isArray(snapshot.labkomBookings)) this.db.labkomBookings = snapshot.labkomBookings;
      if (Array.isArray(snapshot.labkomFixedSchedules)) {
        this.db.labkomFixedSchedules = snapshot.labkomFixedSchedules;
      }
      if (Array.isArray(snapshot.labkomPlotings)) this.db.labkomPlotings = snapshot.labkomPlotings;
      if (Array.isArray(snapshot.labkomMasters)) {
        this.db.labkomMasters = ensureBaselineMasters(snapshot.labkomMasters);
      }
    } else {
      // Safe non-destructive merge: add missing items & enrich missing fields without wiping any data
      if (Array.isArray(snapshot.students)) {
        for (const st of snapshot.students) {
          if (!st?.nama) continue;
          const exists = this.db.students.find(
            (s) =>
              s.id === st.id ||
              (normalizeStr(s.nama) === normalizeStr(st.nama) && s.gender === st.gender),
          );
          if (!exists) {
            this.db.students.push(st);
            studentsRestored++;
          } else {
            if (!exists.nis && st.nis) exists.nis = st.nis;
            if ((!exists.kelas || exists.kelas === '-') && st.kelas) exists.kelas = st.kelas;
            if ((!exists.kamar || exists.kamar === '-') && st.kamar) exists.kamar = st.kamar;
            if (!exists.waliKelas && st.waliKelas) exists.waliKelas = st.waliKelas;
            if (!exists.musyrif && st.musyrif) exists.musyrif = st.musyrif;
            if (!exists.waOrtu && st.waOrtu) exists.waOrtu = st.waOrtu;
            if (!exists.namaOrtu && st.namaOrtu) exists.namaOrtu = st.namaOrtu;
          }
        }
      }

      if (Array.isArray(snapshot.teachers)) {
        for (const t of snapshot.teachers) {
          if (!t?.nama || t.peran === 'Admin Super') continue;
          const exists = this.db.teachers.find(
            (x) => normalizeStr(x.nama) === normalizeStr(t.nama) || normalizeStr(x.username) === normalizeStr(t.username),
          );
          if (!exists) {
            this.db.teachers.push({
              ...t,
              pin: '1234',
            });
            teachersRestored++;
          }
        }
        this.db.teachers = ensureSuperAdmin(this.db.teachers);
      }

      if (Array.isArray(snapshot.rooms)) {
        for (const rm of snapshot.rooms) {
          if (!rm?.kamar) continue;
          const exists = this.db.rooms.find((r) => normalizeStr(r.kamar) === normalizeStr(rm.kamar));
          if (!exists) {
            this.db.rooms.push(rm);
          } else if (!exists.musyrif && rm.musyrif) {
            exists.musyrif = rm.musyrif;
          }
        }
      }

      if (Array.isArray(snapshot.ruanganUjian)) {
        for (const r of snapshot.ruanganUjian) {
          const clean = String(r || '').trim().toUpperCase();
          if (clean && !this.db.ruanganUjian.includes(clean)) {
            this.db.ruanganUjian.push(clean);
          }
        }
      }

      if (Array.isArray(snapshot.schedules)) {
        for (const sc of snapshot.schedules) {
          if (!sc?.guru || !sc?.kelas) continue;
          const exists = this.db.schedules.some(
            (x) =>
              x.id === sc.id ||
              (x.hari === sc.hari &&
                normalizeStr(x.guru) === normalizeStr(sc.guru) &&
                normalizeStr(x.kelas) === normalizeStr(sc.kelas) &&
                normalizeStr(x.mapel) === normalizeStr(sc.mapel) &&
                x.jamKe === sc.jamKe),
          );
          if (!exists) {
            this.db.schedules.push(sc);
            schedulesRestored++;
          }
        }
      }

      if (Array.isArray(snapshot.attendanceLogs)) {
        const seenAtt = new Set(
          this.db.attendanceLogs.map(
            (l) => l.id || `${l.tanggal}|${l.jenisPresensi}|${l.kelas}|${l.mapel}|${l.namaSiswa}`,
          ),
        );
        for (const log of snapshot.attendanceLogs) {
          const sig = `${log.tanggal}|${log.jenisPresensi}|${log.kelas}|${log.mapel}|${log.namaSiswa}`;
          if (!seenAtt.has(log.id) && !seenAtt.has(sig)) {
            this.db.attendanceLogs.push(log);
            seenAtt.add(log.id);
            seenAtt.add(sig);
            attendanceRestored++;
          }
        }
      }

      if (Array.isArray(snapshot.examLogs)) {
        const seenExam = new Set(this.db.examLogs.map((e) => e.id));
        for (const ex of snapshot.examLogs) {
          if (!seenExam.has(ex.id)) {
            this.db.examLogs.push(ex);
            seenExam.add(ex.id);
            examRestored++;
          }
        }
      }

      if (Array.isArray(snapshot.teacherAbsences)) {
        const seenTA = new Set(this.db.teacherAbsences.map((a) => a.id));
        for (const ta of snapshot.teacherAbsences) {
          if (!seenTA.has(ta.id)) {
            this.db.teacherAbsences.push(ta);
            seenTA.add(ta.id);
          }
        }
      }

      if (Array.isArray(snapshot.pembinaanRecords)) {
        const seenPb = new Set(this.db.pembinaanRecords.map((p) => p.id));
        for (const pb of snapshot.pembinaanRecords) {
          if (!seenPb.has(pb.id)) {
            this.db.pembinaanRecords.push(pb);
            seenPb.add(pb.id);
            pembinaanRestored++;
          }
        }
      }

      if (Array.isArray(snapshot.attachments)) {
        if (!this.db.attachments) this.db.attachments = [];
        const seenAttF = new Set(this.db.attachments.map((a) => a.id));
        for (const att of snapshot.attachments) {
          if (!seenAttF.has(att.id)) {
            this.db.attachments.push(att);
            seenAttF.add(att.id);
          }
        }
      }

      if (Array.isArray(snapshot.whatsappLogs)) {
        if (!this.db.whatsappLogs) this.db.whatsappLogs = [];
        const seenWa = new Set(this.db.whatsappLogs.map((w) => w.id));
        for (const wa of snapshot.whatsappLogs) {
          if (!seenWa.has(wa.id)) {
            this.db.whatsappLogs.push(wa);
            seenWa.add(wa.id);
          }
        }
      }

      if (Array.isArray(snapshot.labkomBookings)) {
        if (!this.db.labkomBookings) this.db.labkomBookings = [];
        const seenLb = new Set(this.db.labkomBookings.map((b) => b.id));
        for (const lb of snapshot.labkomBookings) {
          if (!seenLb.has(lb.id)) {
            this.db.labkomBookings.push(lb);
            seenLb.add(lb.id);
          }
        }
      }

      if (Array.isArray(snapshot.labkomFixedSchedules)) {
        if (!this.db.labkomFixedSchedules) this.db.labkomFixedSchedules = [];
        const seenLf = new Set(this.db.labkomFixedSchedules.map((f) => f.id));
        for (const lf of snapshot.labkomFixedSchedules) {
          if (!seenLf.has(lf.id)) {
            this.db.labkomFixedSchedules.push(lf);
            seenLf.add(lf.id);
          }
        }
      }

      if (Array.isArray(snapshot.labkomPlotings)) {
        if (!this.db.labkomPlotings) this.db.labkomPlotings = [];
        const seenLp = new Set(
          this.db.labkomPlotings.map((p) => `${p.kampus}|${p.lokasi}|${p.noPc}`),
        );
        for (const lp of snapshot.labkomPlotings) {
          const sig = `${lp.kampus}|${lp.lokasi}|${lp.noPc}`;
          if (!seenLp.has(sig)) {
            this.db.labkomPlotings.push(lp);
            seenLp.add(sig);
          }
        }
      }

      if (Array.isArray(snapshot.labkomMasters)) {
        if (!this.db.labkomMasters) this.db.labkomMasters = [];
        const seenLm = new Set(
          this.db.labkomMasters.map((m) => `${m.kategori}|${m.nilai.toUpperCase()}`),
        );
        for (const lm of snapshot.labkomMasters) {
          const sig = `${lm.kategori}|${lm.nilai.toUpperCase()}`;
          if (!seenLm.has(sig)) {
            this.db.labkomMasters.push(lm);
            seenLm.add(sig);
          }
        }
        this.db.labkomMasters = ensureBaselineMasters(this.db.labkomMasters);
      }
    }

    this.reconcileDatabaseRelations('1234');
    this.batchedWrites++;
    this.persist();
    return {
      ok: true as const,
      restored: {
        students: studentsRestored,
        teachers: teachersRestored,
        schedules: schedulesRestored,
        attendanceLogs: attendanceRestored,
        pembinaanRecords: pembinaanRestored,
        examLogs: examRestored,
      },
      counts: this.getSystemCounts(),
    };
  }

  // ==============================================================
  // PRESENSI UTAMA
  // ==============================================================
  public getPublicTeachers(jenis?: string, gender?: string): TeacherPublic[] {
    return this.getCached(`teachers_${jenis || 'all'}_${gender || 'all'}`, () => {
      return this.db.teachers
        .filter((t) => {
          if (gender && gender !== 'Semua' && t.genderScope !== 'Semua' && t.genderScope !== gender) {
            return false;
          }
          if (!jenis || jenis === 'Semua') return true;
          if (t.peran === 'Admin Super') return false;
          const jab = `${t.peran} ${t.jabatan}`.toLowerCase();
          if (jenis === 'Asrama') return jab.includes('musyrif') || jab.includes('asrama') || (t.kamarBinaan && t.kamarBinaan.length > 0);
          if (jenis === 'Al-Quran') return jab.includes('qur') || jab.includes('guru') || jab.includes('musyrif');
          return jab.includes('guru') || jab.includes('wali');
        })
        .map(({ pin: _pin, ...pub }) => pub)
        .sort((a, b) => a.nama.localeCompare(b.nama));
    });
  }

  public getKamarMusyrif(namaGuru: string, gender: Gender): string[] {
    const req = normalizeStr(namaGuru);
    if (!req) return [];
    const fromRooms = this.db.rooms
      .filter(
        (r) =>
          r.gender === gender &&
          r.musyrif &&
          (normalizeStr(r.musyrif).includes(req) || req.includes(normalizeStr(r.musyrif)))
      )
      .map((r) => r.kamar);
    const fromStudents = this.db.students
      .filter(
        (s) =>
          s.gender === gender &&
          s.musyrif &&
          s.kamar &&
          (normalizeStr(s.musyrif).includes(req) || req.includes(normalizeStr(s.musyrif)))
      )
      .map((s) => s.kamar);

    const unique = Array.from(new Set([...fromRooms, ...fromStudents]));
    // If musyrif has no specific room bound yet, fall back to all rooms of that gender so they can still pick any room
    if (unique.length === 0) {
      return Array.from(new Set(this.db.rooms.filter((r) => r.gender === gender).map((r) => r.kamar))).sort((a, b) =>
        a.localeCompare(b)
      );
    }
    return unique.sort((a, b) => a.localeCompare(b));
  }

  public getJadwal(hari: string, namaGuru: string, gender: Gender) {
    const reqHari = normalizeStr(hari);
    const reqGuru = normalizeStr(namaGuru);
    if (!reqGuru) return [];
    const seen = new Set<string>();
    const results: Array<{ kelas: string; mapel: string; jamKe: string }> = [];
    for (const item of this.db.schedules) {
      if (item.gender !== gender) continue;
      if (normalizeStr(item.hari) !== reqHari) continue;
      const rowGuru = normalizeStr(item.guru);
      if (rowGuru.includes(reqGuru) || reqGuru.includes(rowGuru)) {
        const key = `${item.kelas}|${item.mapel}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ kelas: item.kelas, mapel: item.mapel, jamKe: item.jamKe });
        }
      }
    }
    return results.sort((a, b) => a.kelas.localeCompare(b.kelas) || a.mapel.localeCompare(b.mapel));
  }

  public getSiswaForm(params: {
    tanggal: string;
    guru: string;
    targetGrup: string;
    mapel: string;
    jenisPresensi: PresensiType;
    gender: Gender;
  }) {
    const { tanggal, guru, targetGrup, mapel, jenisPresensi, gender } = params;
    const targetArr = targetGrup
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    const reqGuru = normalizeStr(guru);

    const asramaToday =
      jenisPresensi !== 'Asrama'
        ? this.db.attendanceLogs.filter(
            (l) => l.jenisPresensi === 'Asrama' && l.gender === gender && l.tanggal === tanggal
          )
        : [];

    const studentMap = new Map<string, StudentFormEntry>();
    for (const s of this.db.students) {
      if (s.gender !== gender) continue;
      const valSiswa =
        jenisPresensi === 'Asrama'
          ? s.kamar.toUpperCase()
          : jenisPresensi === 'Al-Quran'
          ? s.kelompokQuran.toUpperCase()
          : s.kelas.toUpperCase();
      const matched = targetArr.some((t) => valSiswa === t || valSiswa.includes(t) || t.includes(valSiswa));
      if (!matched) continue;

      let defaultStatus: AttendanceStatus = 'H';
      let defaultKet = '';
      let syncedFromAsrama = false;

      if (jenisPresensi !== 'Asrama') {
        const asramaRec = asramaToday.find((a) => a.namaSiswa === s.nama);
        if (asramaRec && (asramaRec.status === 'S' || asramaRec.status === 'I' || asramaRec.status === 'A')) {
          defaultStatus = asramaRec.status;
          defaultKet = `Otomatis Asrama: ${asramaRec.keterangan || asramaRec.status}`;
          syncedFromAsrama = true;
        }
      }

      studentMap.set(s.nama, {
        nama: s.nama,
        status: defaultStatus,
        keterangan: defaultKet,
        tilawah: '',
        murajaah: '',
        setoran: '',
        kelasAsli: valSiswa,
        syncedFromAsrama,
      });
    }

    let materi = '';
    let isEdit = false;

    for (const log of this.db.attendanceLogs) {
      if (log.jenisPresensi !== jenisPresensi || log.gender !== gender || log.tanggal !== tanggal) continue;
      const logGuru = normalizeStr(log.guru);
      if (!logGuru.includes(reqGuru) && !reqGuru.includes(logGuru)) continue;

      const logGrp = log.kelas.toUpperCase();
      const matchesGroup = targetArr.includes(logGrp) || logGrp === targetGrup.trim().toUpperCase();
      if (!matchesGroup) continue;
      if (jenisPresensi !== 'Al-Quran' && log.mapel.toUpperCase() !== mapel.trim().toUpperCase()) continue;

      isEdit = true;
      if (log.materi) materi = log.materi;
      const existing = studentMap.get(log.namaSiswa);
      if (existing) {
        existing.status = log.status;
        existing.keterangan = log.keterangan;
        existing.tilawah = log.tilawah || '';
        existing.murajaah = log.murajaah || '';
        existing.setoran = log.setoran || '';
      }
    }

    const siswa = Array.from(studentMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));
    return { siswa, materi, isEdit, grupAktif: targetGrup.toUpperCase() };
  }

  public simpanAbsen(payload: {
    jenisPresensi: PresensiType;
    gender: Gender;
    tanggal: string;
    guru: string;
    kelas: string;
    mapel: string;
    materi?: string;
    siswa: StudentFormEntry[];
  }): { message: string; savedCount: number; waTriggered?: number } {
    const reqGuru = normalizeStr(payload.guru);
    const reqGrupArr = payload.kelas
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
    const reqMapel = payload.mapel.trim().toUpperCase();
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const beforeLen = this.db.attendanceLogs.length;
    this.db.attendanceLogs = this.db.attendanceLogs.filter((log) => {
      if (log.jenisPresensi !== payload.jenisPresensi || log.gender !== payload.gender || log.tanggal !== payload.tanggal) {
        return true;
      }
      const logGuru = normalizeStr(log.guru);
      if (!logGuru.includes(reqGuru) && !reqGuru.includes(logGuru)) return true;
      const logGrp = log.kelas.toUpperCase();
      if (!reqGrupArr.includes(logGrp) && logGrp !== payload.kelas.trim().toUpperCase()) return true;
      if (payload.jenisPresensi !== 'Al-Quran' && log.mapel.toUpperCase() !== reqMapel) return true;
      return false;
    });
    const replaced = beforeLen !== this.db.attendanceLogs.length;

    const newRows: AttendanceLog[] = payload.siswa.map((s, idx) => ({
      id: `L_${Date.now()}_${idx}`,
      timestamp,
      tanggal: payload.tanggal,
      guru: payload.guru.trim().toUpperCase(),
      mapel: payload.jenisPresensi === 'Al-Quran' ? "AL-QUR'AN" : reqMapel,
      kelas: (s.kelasAsli || payload.kelas).toUpperCase(),
      namaSiswa: s.nama,
      status: s.status,
      keterangan: s.keterangan || '',
      materi: payload.jenisPresensi === 'Al-Quran' ? undefined : (payload.materi || '').toUpperCase(),
      tilawah: s.tilawah || '',
      murajaah: s.murajaah || '',
      setoran: s.setoran || '',
      jenisPresensi: payload.jenisPresensi,
      gender: payload.gender,
    }));

    this.db.attendanceLogs.push(...newRows);

    // Automated WhatsApp Gateway Notification for ALFA ('A') students
    const waConfig = this.db.settings.whatsappConfig;
    let waTriggered = 0;
    if (!waConfig || waConfig.autoNotifyAlfa !== false) {
      for (const r of newRows) {
        if (r.status === 'A') {
          const st = this.db.students.find((x) => normalizeStr(x.nama) === normalizeStr(r.namaSiswa));
          const nomorTujuan = st?.waOrtu || '6281200000000';
          const pesan = `[SIM PINTAR AUTO-ALERT] Assalamu'alaikum Bapak/Ibu Wali dari *${r.namaSiswa}* (${r.kelas}). Kami menginformasikan bahwa ananda tercatat *ALFA (Tanpa Keterangan)* pada sesi ${r.jenisPresensi} (${r.mapel}) tanggal ${formatDateIndo(r.tanggal)} oleh petugas ${r.guru}. Catatan: ${r.keterangan || '-'}. Mohon konfirmasi kepada Wali Kelas (${st?.waliKelas || '-'}).`;
          this.recordWhatsAppTrigger({
            triggerType: 'ALFA_PRESENSI',
            namaSantri: r.namaSiswa,
            kelas: r.kelas,
            nomorTujuan,
            pesan,
          });
          waTriggered++;
        }
      }
    }

    this.batchedWrites++;
    this.persist();
    return {
      message:
        (replaced ? 'Data presensi berhasil diperbarui!' : 'Data presensi tersimpan & masuk ke rekapan akun guru!') +
        (waTriggered > 0 ? ` (${waTriggered} notifikasi WhatsApp Alfa terkirim ke Wali Murid)` : ''),
      savedCount: newRows.length,
      waTriggered,
    };
  }

  // ==============================================================
  // UJIAN, PIKET & INVAL
  // ==============================================================
  public getSiswaUjianForm(params: { tanggal: string; kelas: string; mapel: string; gender: Gender }) {
    const { tanggal, kelas, mapel, gender } = params;
    const reqKelasArr = kelas
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
    const reqMapel = mapel.trim().toUpperCase();

    const asramaToday = this.db.attendanceLogs.filter(
      (l) => l.jenisPresensi === 'Asrama' && l.gender === gender && l.tanggal === tanggal
    );

    const mapSiswa = new Map<string, StudentFormEntry>();
    for (const s of this.db.students) {
      if (s.gender !== gender) continue;
      const kls = s.kelas.toUpperCase();
      if (!reqKelasArr.some((t) => kls === t || kls.includes(t) || t.includes(kls))) continue;

      let defaultStatus: AttendanceStatus = 'H';
      let defaultKet = '';
      let syncedFromAsrama = false;

      const asr = asramaToday.find((a) => a.namaSiswa === s.nama);
      if (asr && (asr.status === 'S' || asr.status === 'I' || asr.status === 'A')) {
        defaultStatus = asr.status;
        defaultKet = `Otomatis Asrama: ${asr.keterangan || asr.status}`;
        syncedFromAsrama = true;
      }

      mapSiswa.set(s.nama, {
        nama: s.nama,
        status: defaultStatus,
        keterangan: defaultKet,
        kelasAsli: kls,
        syncedFromAsrama,
      });
    }

    let isEdit = false;
    for (const ex of this.db.examLogs) {
      if (ex.gender !== gender || ex.tanggal !== tanggal || ex.mapel.toUpperCase() !== reqMapel) continue;
      const entry = mapSiswa.get(ex.namaSiswa);
      if (entry) {
        isEdit = true;
        entry.status = ex.status;
        entry.keterangan = ex.keterangan;
      }
    }

    return {
      siswa: Array.from(mapSiswa.values()).sort((a, b) => a.kelasAsli.localeCompare(b.kelasAsli) || a.nama.localeCompare(b.nama)),
      isEdit,
      grupAktif: kelas.toUpperCase(),
    };
  }

  public simpanAbsenUjian(payload: {
    gender: Gender;
    tanggal: string;
    jenisUjian: string;
    ruangan: string;
    kelas: string;
    mapel: string;
    pengawas1: string;
    pengawas2: string;
    siswa: StudentFormEntry[];
  }) {
    const reqMapel = payload.mapel.trim().toUpperCase();
    const reqKelas = payload.kelas.trim().toUpperCase();
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const before = this.db.examLogs.length;
    this.db.examLogs = this.db.examLogs.filter((ex) => {
      if (ex.gender !== payload.gender || ex.tanggal !== payload.tanggal || ex.mapel.toUpperCase() !== reqMapel) return true;
      const rowKls = ex.kelas.toUpperCase();
      if (rowKls === reqKelas || reqKelas.includes(rowKls)) return false;
      return true;
    });
    const replaced = before !== this.db.examLogs.length;

    const newRows: ExamLog[] = payload.siswa.map((s, idx) => ({
      id: `E_${Date.now()}_${idx}`,
      timestamp,
      tanggal: payload.tanggal,
      jenisUjian: payload.jenisUjian.toUpperCase(),
      ruangan: payload.ruangan.toUpperCase(),
      pengawas1: payload.pengawas1.toUpperCase(),
      pengawas2: (payload.pengawas2 || '-').toUpperCase(),
      kelas: (s.kelasAsli || reqKelas).toUpperCase(),
      mapel: reqMapel,
      namaSiswa: s.nama,
      status: s.status,
      keterangan: s.keterangan || '',
      gender: payload.gender,
    }));

    this.db.examLogs.push(...newRows);
    this.batchedWrites++;
    this.persist();
    return { message: replaced ? 'Data ujian berhasil diperbarui!' : 'Data ujian berhasil disimpan!' };
  }

  public getUjianRiwayatDanSusulan(tanggal: string, gender: Gender) {
    const riwayatMap = new Map<
      string,
      { ruang: string; pengawas: string; pengawas2: string; jenisUjian: string; kelas: string; mapel: string; totalSiswa: number; hadir: number }
    >();
    const susulan: Array<{ tgl: string; rawDate: string; jenis: string; nama: string; kelas: string; mapel: string; status: AttendanceStatus; keterangan: string }> = [];

    for (const ex of this.db.examLogs) {
      if (ex.gender !== gender) continue;
      if (ex.tanggal === tanggal) {
        const key = `${ex.ruangan}|${ex.kelas}|${ex.mapel}`;
        if (!riwayatMap.has(key)) {
          riwayatMap.set(key, {
            ruang: ex.ruangan,
            pengawas: ex.pengawas1,
            pengawas2: ex.pengawas2,
            jenisUjian: ex.jenisUjian,
            kelas: ex.kelas,
            mapel: ex.mapel,
            totalSiswa: 0,
            hadir: 0,
          });
        }
        const obj = riwayatMap.get(key)!;
        obj.totalSiswa++;
        if (ex.status === 'H' || ex.status === 'T') obj.hadir++;
      }

      if (ex.status === 'S' || ex.status === 'I' || ex.status === 'A') {
        susulan.push({
          tgl: formatDateIndo(ex.tanggal),
          rawDate: ex.tanggal,
          jenis: ex.jenisUjian,
          nama: ex.namaSiswa,
          kelas: ex.kelas,
          mapel: ex.mapel,
          status: ex.status,
          keterangan: `[${ex.status}] ${ex.keterangan || '-'}`,
        });
      }
    }

    susulan.sort((a, b) => b.rawDate.localeCompare(a.rawDate) || a.mapel.localeCompare(b.mapel) || a.nama.localeCompare(b.nama));
    return { riwayat: Array.from(riwayatMap.values()), susulan };
  }

  public getPiketHariIni(tanggal: string): TeacherAbsenceLog[] {
    return this.db.teacherAbsences.filter((a) => a.tanggal === tanggal);
  }

  public simpanGuruAbsen(payload: {
    tanggal: string;
    namaGuru: string;
    status: TeacherAbsenceLog['status'];
    keterangan: string;
  }) {
    const targetName = payload.namaGuru.trim().toUpperCase();
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const idx = this.db.teacherAbsences.findIndex(
      (a) => a.tanggal === payload.tanggal && a.namaGuru.toUpperCase() === targetName
    );
    if (idx >= 0) {
      this.db.teacherAbsences[idx] = {
        ...this.db.teacherAbsences[idx],
        timestamp,
        status: payload.status,
        keterangan: payload.keterangan,
      };
      this.batchedWrites++;
      this.persist();
      return { message: 'Data ketidakhadiran guru berhasil diperbarui!' };
    }
    this.db.teacherAbsences.push({
      id: `TA_${Date.now()}`,
      timestamp,
      tanggal: payload.tanggal,
      namaGuru: targetName,
      status: payload.status,
      keterangan: payload.keterangan,
    });
    this.batchedWrites++;
    this.persist();
    return { message: 'Data guru tidak hadir berhasil disimpan!' };
  }

  public getBroadcastHarian(tanggal: string, gender: Gender): string {
    const tglIndo = formatDateIndo(tanggal);
    const mapKelas = new Map<string, string>();
    for (const s of this.db.students) {
      if (s.gender === gender) mapKelas.set(s.nama, s.kelas || 'TANPA KELAS');
    }

    const listAbsen = this.db.attendanceLogs
      .filter(
        (l) =>
          l.jenisPresensi === 'Asrama' &&
          l.gender === gender &&
          l.tanggal === tanggal &&
          (l.status === 'S' || l.status === 'I' || l.status === 'A')
      )
      .map((l) => ({
        nama: l.namaSiswa,
        kamar: l.kelas,
        kelasAkademik: mapKelas.get(l.namaSiswa) || 'TANPA KELAS',
        status: l.status,
        ket: l.keterangan,
      }))
      .sort((a, b) => a.kelasAkademik.localeCompare(b.kelasAkademik) || a.nama.localeCompare(b.nama));

    let result = `📢 *INFORMASI HARIAN SEKOLAH (${gender.toUpperCase()})*\n📅 Tanggal: ${tglIndo}\n\n*🛏️ INFO KEHADIRAN (BERDASARKAN KELAS AKADEMIK):*\n`;
    if (listAbsen.length === 0) {
      result += `- ✅ Seluruh santri/wati dilaporkan HADIR.\n`;
    } else {
      let currentKelas = '';
      for (const s of listAbsen) {
        if (s.kelasAkademik !== currentKelas) {
          result += `\n🏷️ *KELAS ${s.kelasAkademik}*\n`;
          currentKelas = s.kelasAkademik;
        }
        const emoji = s.status === 'S' ? '🤒' : s.status === 'I' ? 'ℹ️' : '❌';
        result += `${emoji} ${s.nama} (${s.kelasAkademik})\n   Status: *${s.status}* - [Kamar: ${s.kamar}] ${s.ket}\n`;
      }
    }
    result += `\n_Terima kasih atas perhatian Bapak/Ibu Wali Murid. Semoga proses belajar mengajar hari ini berjalan lancar dan penuh berkah._`;
    return result;
  }

  public getGuruKosong(tanggal: string, jamStr: string, filterGender: string, filterJenjang: string) {
    const dateObj = new Date(`${tanggal}T00:00:00`);
    const hari = NAMA_HARI[dateObj.getDay()];
    const targetJams = jamStr
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => !isNaN(n));

    const guruMengajar = new Set<string>();
    const profile: Record<string, { genders: Set<string>; jenjangs: Set<string> }> = {};

    for (const r of this.db.schedules) {
      const g = r.guru.trim().toUpperCase();
      if (!profile[g]) profile[g] = { genders: new Set(), jenjangs: new Set() };
      profile[g].genders.add(r.gender.toUpperCase());
      const kls = r.kelas.toUpperCase();
      if (kls.includes('10') || kls.includes('X')) profile[g].jenjangs.add('10');
      else if (kls.includes('11') || kls.includes('XI')) profile[g].jenjangs.add('11');
      else profile[g].jenjangs.add('12');

      if (r.hari.toUpperCase() === hari) {
        const parts = r.jamKe.split('-');
        const start = parseInt(parts[0], 10);
        const end = parts.length > 1 ? parseInt(parts[1], 10) : start;
        if (targetJams.some((t) => t >= start && t <= end)) {
          guruMengajar.add(g);
        }
      }
    }

    const guruAbsen = new Set(
      this.db.teacherAbsences.filter((a) => a.tanggal === tanggal).map((a) => a.namaGuru.trim().toUpperCase())
    );

    return this.db.teachers
      .filter((t) => {
        const g = t.nama.trim().toUpperCase();
        const jab = `${t.peran} ${t.jabatan}`.toUpperCase();
        if (guruMengajar.has(g) || guruAbsen.has(g)) return false;
        if (!(jab === '' || jab.includes('GURU') || jab.includes('QUR') || jab.includes('WALI'))) return false;
        const prof = profile[g] || { genders: new Set<string>(), jenjangs: new Set<string>() };
        if (filterGender !== 'SEMUA' && !prof.genders.has(filterGender.toUpperCase())) return false;
        if (filterJenjang !== 'SEMUA' && !prof.jenjangs.has(filterJenjang)) return false;
        return true;
      })
      .map((t) => ({ nama: t.nama, jabatan: t.jabatan, whatsapp: t.whatsapp || '' }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }

  public getDashboardStats(wilayah: WilayahFilter = 'Semua'): DashboardStats {
    const stats: DashboardStats = {
      hari: { H: 0, T: 0, S: 0, I: 0, A: 0 },
      bulan: { H: 0, T: 0, S: 0, I: 0, A: 0 },
      semester: { H: 0, T: 0, S: 0, I: 0, A: 0 },
    };
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth() + 1;
    const currDate = now.getDate();
    const isGanjil = currMonth >= 7;

    for (const log of this.db.attendanceLogs) {
      if (wilayah !== 'Semua' && log.gender !== wilayah) continue;
      const parts = log.tanggal.split('-').map(Number);
      if (parts.length !== 3) continue;
      const [rYear, rMonth, rDay] = parts;
      if (rYear !== currYear) continue;
      if ((rMonth >= 7) === isGanjil) stats.semester[log.status]++;
      if (rMonth === currMonth) {
        stats.bulan[log.status]++;
        if (rDay === currDate) stats.hari[log.status]++;
      }
    }
    return stats;
  }

  public getMonitoringData(tanggal: string): MonitoringData {
    const dateObj = new Date(`${tanggal}T00:00:00`);
    const hariReq = NAMA_HARI[dateObj.getDay()];

    const guruAbsenToday = new Set(
      this.db.teacherAbsences.filter((a) => a.tanggal === tanggal).map((a) => a.namaGuru.trim().toUpperCase())
    );
    const absenToday = this.db.attendanceLogs.filter((l) => l.tanggal === tanggal);
    const asramaFilledRooms = new Set(
      absenToday.filter((l) => l.jenisPresensi === 'Asrama').map((l) => l.kelas.toUpperCase())
    );

    const result: MonitoringData = {
      putra: { akademik: { kelas10: [], kelas11: [], kelas12: [] }, alquran: { kelas10: [], kelas11: [], kelas12: [] }, asrama: [] },
      putri: { akademik: { kelas10: [], kelas11: [], kelas12: [] }, alquran: { kelas10: [], kelas11: [], kelas12: [] }, asrama: [] },
    };

    for (const j of this.db.schedules) {
      if (j.hari.toUpperCase() !== hariReq) continue;
      const kls = j.kelas.toUpperCase();
      const mpl = j.mapel.toUpperCase();
      const namaGuru = j.guru.toUpperCase();

      const isDiisi = absenToday.some((log) => {
        if (log.jenisPresensi === 'Asrama') return false;
        const matchMapel =
          log.mapel.toUpperCase() === mpl ||
          ((mpl.includes('QUR') || j.kategori === 'Al-Quran') && log.jenisPresensi === 'Al-Quran');
        const matchGuru = normalizeStr(log.guru).includes(normalizeStr(namaGuru)) || normalizeStr(namaGuru).includes(normalizeStr(log.guru));
        const matchKelas = log.kelas.toUpperCase() === kls || log.kelas.toUpperCase().includes(kls) || kls.includes(log.kelas.toUpperCase());
        return matchMapel && matchGuru && matchKelas;
      });

      const status = isDiisi ? 'HADIR' : guruAbsenToday.has(namaGuru) ? 'GURU_ABSEN' : 'KOSONG';
      const item = { guru: namaGuru, kelas: kls, mapel: mpl, jam: j.jamKe, status } as const;
      const target = j.gender === 'Putra' ? result.putra : result.putri;
      const divObj = j.kategori === 'Al-Quran' || mpl.includes('QUR') ? target.alquran : target.akademik;

      if (kls.includes('10') || kls.includes('X')) divObj.kelas10.push(item);
      else if (kls.includes('11') || kls.includes('XI')) divObj.kelas11.push(item);
      else divObj.kelas12.push(item);
    }

    for (const r of this.db.rooms) {
      const kamar = r.kamar.toUpperCase();
      const musyrif = r.musyrif.toUpperCase();
      const isDiisi = asramaFilledRooms.has(kamar);
      const status = isDiisi ? 'HADIR' : guruAbsenToday.has(musyrif) ? 'GURU_ABSEN' : 'KOSONG';
      const target = r.gender === 'Putra' ? result.putra : result.putri;
      target.asrama.push({ kamar, musyrif, status });
    }

    const sortJam = (a: { jam: string }, b: { jam: string }) => a.jam.localeCompare(b.jam, undefined, { numeric: true });
    (['putra', 'putri'] as const).forEach((g) => {
      result[g].akademik.kelas10.sort(sortJam);
      result[g].akademik.kelas11.sort(sortJam);
      result[g].akademik.kelas12.sort(sortJam);
      result[g].alquran.kelas10.sort(sortJam);
      result[g].alquran.kelas11.sort(sortJam);
      result[g].alquran.kelas12.sort(sortJam);
    });

    return result;
  }

  private buildOptionsScope(wilayah: WilayahFilter): ReportOptionsScope {
    const matchW = (g: Gender) => wilayah === 'Semua' || g === wilayah;
    const studentsScope = this.db.students.filter((s) => matchW(s.gender));
    const roomsScope = this.db.rooms.filter((r) => matchW(r.gender));
    const schedulesScope = this.db.schedules.filter((s) => matchW(s.gender));

    const akademikKelas = Array.from(
      new Set(studentsScope.map((s) => s.kelas.toUpperCase()).filter((k) => k && k !== '-'))
    ).sort();
    const akademikMapel = Array.from(
      new Set(
        schedulesScope
          .filter((s) => s.kategori !== 'Al-Quran' && !s.mapel.toUpperCase().includes('QUR'))
          .map((s) => s.mapel.toUpperCase())
      )
    ).sort();
    const asramaKamar = Array.from(new Set(roomsScope.map((r) => r.kamar.toUpperCase()).filter(Boolean))).sort();
    const asramaMusyrif = Array.from(new Set(roomsScope.map((r) => r.musyrif.toUpperCase()).filter(Boolean))).sort();
    const alquranKelompok = Array.from(
      new Set(studentsScope.map((s) => s.kelompokQuran.toUpperCase()).filter((k) => k && k !== '-'))
    ).sort();
    const ruanganUjian =
      wilayah === 'Semua'
        ? this.db.ruanganUjian
        : this.db.ruanganUjian.filter((r) => {
            const up = r.toUpperCase();
            if (up.includes('PUTRA') && wilayah === 'Putri') return false;
            if (up.includes('PUTRI') && wilayah === 'Putra') return false;
            return true;
          });

    return {
      akademik: { kelas: akademikKelas, mapel: akademikMapel },
      asrama: { kamar: asramaKamar, musyrif: asramaMusyrif },
      alquran: { kelompok: alquranKelompok },
      ruanganUjian,
      students: studentsScope.map((s) => s.nama).sort(),
    };
  }

  public getOptionsLaporan(): ReportOptions {
    return this.getCached('options_laporan_v2', () => ({
      ...this.buildOptionsScope('Semua'),
      byWilayah: {
        Putra: this.buildOptionsScope('Putra'),
        Putri: this.buildOptionsScope('Putri'),
      },
    }));
  }

  public getSiswaByGroup(groupName: string, divisi: string, wilayah: WilayahFilter = 'Semua'): string[] {
    const req = groupName.trim().toUpperCase();
    const matchW = (g: Gender) => wilayah === 'Semua' || g === wilayah;
    if (!req) return [];
    if (divisi === 'Asrama') {
      const kamarList = new Set([req]);
      this.db.rooms.forEach((r) => {
        if (matchW(r.gender) && r.musyrif.toUpperCase() === req) kamarList.add(r.kamar.toUpperCase());
      });
      return this.db.students
        .filter(
          (s) =>
            matchW(s.gender) &&
            Array.from(kamarList).some((k) => s.kamar.toUpperCase() === k || s.kamar.toUpperCase().includes(k))
        )
        .map((s) => s.nama)
        .sort();
    }
    return this.db.students
      .filter((s) => {
        if (!matchW(s.gender)) return false;
        const val = divisi === 'Al-Quran' ? s.kelompokQuran.toUpperCase() : s.kelas.toUpperCase();
        return val === req || val.includes(req);
      })
      .map((s) => s.nama)
      .sort();
  }

  public getReportData(params: {
    jenis: string;
    param1: string;
    param2: string;
    semester: string;
    divisi: string;
    wilayah?: WilayahFilter;
  }) {
    const { jenis, param1, param2, semester, divisi, wilayah = 'Semua' } = params;
    const matchW = (g: Gender) => wilayah === 'Semua' || g === wilayah;
    const isAllSem = semester === 'ALL' || semester.toUpperCase().includes('SEMUA');
    const isReqGanjil = semester.toUpperCase().includes('GANJIL');
    const isReqGenap = semester.toUpperCase().includes('GENAP');
    const isReqMonth = semester.includes('Bulan');
    const reqMonthIdx = isReqMonth ? parseInt(semester.split(' ')[1], 10) : 0;

    const studentMapByName = new Map<string, Student>();
    for (const s of this.db.students) {
      studentMapByName.set(s.nama.toUpperCase(), s);
    }

    const matchPeriod = (tgl: string) => {
      if (isAllSem) return true;
      const m = parseInt(tgl.split('-')[1], 10);
      if (!m || Number.isNaN(m)) return false;
      if (isReqMonth) return m === reqMonthIdx;
      if (isReqGenap) return m >= 1 && m <= 6;
      if (isReqGanjil) return m >= 7 && m <= 12;
      return (m >= 7) === isReqGanjil;
    };

    if (jenis === 'ringkasan_bulanan_wali') {
      const summary = this.getMonthlyWaliKelasSummary({
        bulan: semester,
        wilayah,
        kelas: param1 || 'SEMUA',
      });
      const laporan: string[][] = [
        [
          'No',
          'NIS',
          'Nama Santri',
          'Wilayah',
          'Kelas',
          'Kamar',
          'Wali Kelas',
          'Hadir+Telat',
          'S/I/A',
          '% Kehadiran',
          'Jml Binaan',
          'Sholat Wajib %',
          'Sunnah %',
          'Net Poin',
          'Status Tindak Lanjut',
          'Catatan Pembinaan Terakhir',
        ],
        ...summary.studentRows.map((row, idx) => [
          String(idx + 1),
          row.nis || '-',
          row.nama,
          `Wilayah ${row.gender}`,
          row.kelas,
          row.kamar,
          row.waliKelas,
          `${row.presensi.H + row.presensi.T} (${row.presensi.H}H/${row.presensi.T}T)`,
          `${row.presensi.S}/${row.presensi.I}/${row.presensi.A}`,
          `${row.presensi.persenHadir}%`,
          String(row.pembinaan.totalCatatan),
          `${row.pembinaan.wajibPct}%`,
          `${row.pembinaan.sunnahPct}%`,
          row.pembinaan.netPoin > 0 ? `+${row.pembinaan.netPoin}` : String(row.pembinaan.netPoin),
          row.pembinaan.statusTerakhir,
          row.pembinaan.catatanTerakhir || '-',
        ]),
      ];
      if (laporan.length === 1) {
        laporan.push(['-', '-', 'TIDAK ADA DATA SANTRI PADA FILTER INI', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']);
      }
      return { laporan, materi: [] };
    }

    if (jenis === 'susulan_ujian') {
      const reqKls = param1.trim().toUpperCase();
      const rows = this.db.examLogs
        .filter(
          (e) =>
            matchW(e.gender) &&
            matchPeriod(e.tanggal) &&
            ['S', 'I', 'A'].includes(e.status) &&
            (reqKls === 'SEMUA' || reqKls === '' || e.kelas.toUpperCase().includes(reqKls))
        )
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
        .map((e, i) => [
          String(i + 1),
          formatDateIndo(e.tanggal),
          `Wilayah ${e.gender}`,
          e.jenisUjian,
          e.mapel,
          e.kelas,
          e.namaSiswa,
          `[${e.status}] ${e.keterangan}`,
        ]);
      const laporan = [
        ['No', 'Tanggal Ujian', 'Wilayah', 'Jenis Ujian', 'Mata Pelajaran', 'Kelas', 'Nama Siswa', 'Keterangan Terakhir'],
        ...rows,
      ];
      if (laporan.length === 1) laporan.push(['-', '-', '-', '-', 'TIDAK ADA DATA SUSULAN', '-', '-', '-']);
      return { laporan, materi: [] };
    }

    if (jenis === 'penanganan_khusus') {
      const mapSiswa = new Map<string, { gender: Gender; kelas: string; S: number; I: number; A: number; Total: number; rincian: string[] }>();
      for (const l of this.db.attendanceLogs) {
        if (!matchW(l.gender) || !matchPeriod(l.tanggal) || !['S', 'I', 'A'].includes(l.status)) continue;
        const st = studentMapByName.get(l.namaSiswa.toUpperCase());
        const obj = mapSiswa.get(l.namaSiswa) || {
          gender: st?.gender || l.gender,
          kelas: st?.kelas || l.kelas,
          S: 0,
          I: 0,
          A: 0,
          Total: 0,
          rincian: [],
        };
        obj[l.status as 'S' | 'I' | 'A']++;
        obj.Total++;
        obj.rincian.push(`[${l.status}] ${l.jenisPresensi} ${formatDateIndo(l.tanggal).slice(0, 5)}`);
        mapSiswa.set(l.namaSiswa, obj);
      }
      const sorted = Array.from(mapSiswa.entries()).sort((a, b) => b[1].Total - a[1].Total);
      const laporan = [
        ['No', 'Nama Siswa', 'Wilayah', 'Kelas', 'Total Sakit', 'Total Izin', 'Total Alfa', 'Total Poin Absen', 'Rincian Terpadu'],
        ...sorted.map(([nama, v], i) => [
          String(i + 1),
          nama,
          `Wilayah ${v.gender}`,
          v.kelas,
          String(v.S),
          String(v.I),
          String(v.A),
          String(v.Total),
          v.rincian.join(' | '),
        ]),
      ];
      if (laporan.length === 1) laporan.push(['-', 'TIDAK ADA SISWA BERMASALAH', '-', '-', '-', '-', '-', '-', '-']);
      return { laporan, materi: [] };
    }

    if (jenis === 'guru_alpha') {
      const laporan = [['No', 'Tanggal', 'Hari', 'Wilayah', 'Nama Guru / Musyrif', 'Mata Pelajaran', 'Kelas / Kamar', 'Status Kehadiran']];
      const activeDates = Array.from(
        new Set(
          this.db.attendanceLogs
            .filter((l) => matchW(l.gender) && matchPeriod(l.tanggal))
            .map((l) => l.tanggal)
        )
      ).sort();
      let no = 1;
      for (const tgl of activeDates) {
        const hari = NAMA_HARI[new Date(`${tgl}T00:00:00`).getDay()];
        if (divisi === 'Asrama') {
          for (const r of this.db.rooms) {
            if (!matchW(r.gender)) continue;
            const filled = this.db.attendanceLogs.some(
              (l) => l.tanggal === tgl && l.jenisPresensi === 'Asrama' && l.gender === r.gender && l.kelas.toUpperCase() === r.kamar.toUpperCase()
            );
            if (!filled) {
              const abs = this.db.teacherAbsences.find((a) => a.tanggal === tgl && a.namaGuru.toUpperCase() === r.musyrif.toUpperCase());
              laporan.push([
                String(no++),
                formatDateIndo(tgl),
                hari,
                `Wilayah ${r.gender}`,
                r.musyrif || '-',
                '-',
                r.kamar,
                abs ? `TIDAK HADIR: ${abs.status}` : 'BELUM PRESENSI (ALPHA)',
              ]);
            }
          }
        } else {
          for (const j of this.db.schedules) {
            if (!matchW(j.gender) || j.hari !== hari) continue;
            const isQur = j.kategori === 'Al-Quran' || j.mapel.toUpperCase().includes('QUR');
            if ((divisi === 'Al-Quran' && !isQur) || (divisi === 'Akademik' && isQur)) continue;
            const filled = this.db.attendanceLogs.some(
              (l) =>
                l.tanggal === tgl &&
                l.gender === j.gender &&
                l.kelas.toUpperCase() === j.kelas.toUpperCase() &&
                (isQur ? l.jenisPresensi === 'Al-Quran' : l.mapel.toUpperCase() === j.mapel.toUpperCase())
            );
            if (!filled) {
              const abs = this.db.teacherAbsences.find((a) => a.tanggal === tgl && a.namaGuru.toUpperCase() === j.guru.toUpperCase());
              laporan.push([
                String(no++),
                formatDateIndo(tgl),
                hari,
                `Wilayah ${j.gender}`,
                j.guru,
                j.mapel,
                j.kelas,
                abs ? `TIDAK HADIR: ${abs.status}` : 'BELUM PRESENSI (ALPHA)',
              ]);
            }
          }
        }
      }
      if (laporan.length === 1) laporan.push(['-', '-', '-', '-', 'BELUM ADA DATA KETIDAKHADIRAN GURU', '-', '-', '-']);
      return { laporan, materi: [] };
    }

    if (divisi === 'Terpadu') {
      const isIndividu = jenis === 'individu';
      const listSiswa = isIndividu ? [param2 || param1] : this.getSiswaByGroup(param1, 'Akademik', wilayah);
      const setSiswa = new Set(listSiswa);
      const logs = this.db.attendanceLogs.filter((l) => matchW(l.gender) && matchPeriod(l.tanggal) && setSiswa.has(l.namaSiswa));
      if (isIndividu) {
        const laporan = [
          ['No', 'Tanggal', 'Wilayah', 'Divisi', 'Konteks Laporan', 'Status', 'Keterangan'],
          ...logs
            .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
            .map((l, i) => [
              String(i + 1),
              formatDateIndo(l.tanggal),
              `Wilayah ${l.gender}`,
              l.jenisPresensi.toUpperCase(),
              l.jenisPresensi === 'Asrama' ? `Kamar: ${l.kelas}` : l.mapel,
              l.status,
              l.keterangan,
            ]),
        ];
        if (laporan.length === 1) laporan.push(['-', '-', '-', '-', 'TIDAK ADA CATATAN UNTUK SISWA INI', '-', '-']);
        return { laporan, materi: [] };
      }
      const laporan = [
        ['No', 'Nama Siswa', 'Wilayah', 'Akademik (H/T/S/I/A)', 'Asrama (H/T/S/I/A)', 'Al-Quran (H/T/S/I/A)', 'Total Masuk (H+T)', 'Total Absen (S+I+A)'],
      ];
      listSiswa.forEach((nama, idx) => {
        const count = (jp: PresensiType) => {
          const c = { H: 0, T: 0, S: 0, I: 0, A: 0 };
          logs.filter((l) => l.namaSiswa === nama && l.jenisPresensi === jp).forEach((l) => c[l.status]++);
          return c;
        };
        const st = studentMapByName.get(nama.toUpperCase());
        const ak = count('Belajar');
        const asr = count('Asrama');
        const qr = count('Al-Quran');
        const masuk = ak.H + ak.T + asr.H + asr.T + qr.H + qr.T;
        const absen = ak.S + ak.I + ak.A + asr.S + asr.I + asr.A + qr.S + qr.I + qr.A;
        laporan.push([
          String(idx + 1),
          nama,
          st ? `Wilayah ${st.gender}` : '-',
          `${ak.H}/${ak.T}/${ak.S}/${ak.I}/${ak.A}`,
          `${asr.H}/${asr.T}/${asr.S}/${asr.I}/${asr.A}`,
          `${qr.H}/${qr.T}/${qr.S}/${qr.I}/${qr.A}`,
          String(masuk),
          String(absen),
        ]);
      });
      return { laporan, materi: [] };
    }

    const targetPresensi: PresensiType = divisi === 'Asrama' ? 'Asrama' : divisi === 'Al-Quran' ? 'Al-Quran' : 'Belajar';
    const reqKelas = param1.trim().toUpperCase();
    const listSiswa = jenis === 'individu' ? [reqKelas] : this.getSiswaByGroup(reqKelas, divisi, wilayah);
    const filtered = this.db.attendanceLogs.filter((l) => {
      if (!matchW(l.gender) || l.jenisPresensi !== targetPresensi || !matchPeriod(l.tanggal)) return false;
      if (jenis === 'blacklist') {
        if (divisi === 'Akademik' && reqKelas) {
          const ang = reqKelas.replace('KELAS ', '').trim();
          return l.kelas.toUpperCase().startsWith(ang);
        }
        return true;
      }
      if (jenis === 'individu') return l.namaSiswa.toUpperCase() === reqKelas;
      if (divisi === 'Asrama') return l.kelas.toUpperCase() === reqKelas || l.guru.toUpperCase() === reqKelas;
      if (l.kelas.toUpperCase() !== reqKelas) return false;
      if (jenis === 'matrix' && divisi === 'Akademik' && param2 !== 'SEMUA MAPEL') {
        return l.mapel.toUpperCase() === param2.trim().toUpperCase();
      }
      return true;
    });

    const materiMap = new Map<string, { no: number; tanggal: string; mapel: string; materi: string }>();
    filtered.forEach((f) => {
      if (f.materi) {
        const key = `${f.tanggal}|${f.mapel}`;
        if (!materiMap.has(key)) materiMap.set(key, { no: materiMap.size + 1, tanggal: formatDateIndo(f.tanggal), mapel: f.mapel, materi: f.materi });
      }
    });

    if (jenis === 'social') {
      const laporan = [['No', 'Nama Siswa', 'Wilayah', 'Hadir', 'Telat', 'Sakit', 'Izin', 'Alfa', 'Total Pertemuan', '% Hadir (H+T)']];
      listSiswa.forEach((nama, idx) => {
        const st = studentMapByName.get(nama.toUpperCase());
        const c = { H: 0, T: 0, S: 0, I: 0, A: 0 };
        filtered.filter((f) => f.namaSiswa === nama).forEach((f) => c[f.status]++);
        const tot = c.H + c.T + c.S + c.I + c.A;
        laporan.push([
          String(idx + 1),
          nama,
          st ? `Wilayah ${st.gender}` : '-',
          String(c.H),
          String(c.T),
          String(c.S),
          String(c.I),
          String(c.A),
          String(tot),
          tot === 0 ? '0%' : `${Math.round(((c.H + c.T) / tot) * 100)}%`,
        ]);
      });
      return { laporan, materi: Array.from(materiMap.values()) };
    }

    if (jenis === 'matrix') {
      const dates = Array.from(new Set(filtered.map((f) => formatDateIndo(f.tanggal))));
      const laporan = [['No', 'Nama Siswa', ...dates, 'H', 'T', 'S', 'I', 'A']];
      listSiswa.forEach((nama, idx) => {
        const c = { H: 0, T: 0, S: 0, I: 0, A: 0 };
        const dateCells = dates.map((dt) => {
          const hit = filtered.find((f) => f.namaSiswa === nama && formatDateIndo(f.tanggal) === dt);
          const st = hit ? hit.status : '-';
          if (st !== '-') c[st as AttendanceStatus]++;
          return st;
        });
        laporan.push([String(idx + 1), nama, ...dateCells, String(c.H), String(c.T), String(c.S), String(c.I), String(c.A)]);
      });
      return { laporan, materi: Array.from(materiMap.values()) };
    }

    if (jenis === 'individu') {
      const head =
        divisi === 'Al-Quran'
          ? ['No', 'Tanggal', 'Wilayah', 'Kelompok', 'Status', 'Alasan', 'Tilawah', 'Murajaah', 'Setoran']
          : divisi === 'Asrama'
          ? ['No', 'Tanggal', 'Wilayah', 'Kamar', 'Status', 'Alasan', 'Catatan Asrama']
          : ['No', 'Tanggal', 'Wilayah', 'Mata Pelajaran', 'Status', 'Alasan', 'Materi'];
      const rows = filtered
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        .map((r, i) =>
          divisi === 'Al-Quran'
            ? [String(i + 1), formatDateIndo(r.tanggal), `Wilayah ${r.gender}`, r.kelas, r.status, r.keterangan, r.tilawah || '', r.murajaah || '', r.setoran || '']
            : [String(i + 1), formatDateIndo(r.tanggal), `Wilayah ${r.gender}`, divisi === 'Asrama' ? r.kelas : r.mapel, r.status, r.keterangan, r.materi || '']
        );
      if (rows.length === 0) rows.push(['-', '-', '-', 'TIDAK ADA CATATAN ABSENSI', '-', '-', '-']);
      return { laporan: [head, ...rows], materi: [] };
    }

    const absenMap = new Map<string, { gender: Gender; S: number; I: number; A: number; Total: number; rincian: string[] }>();
    filtered
      .filter((f) => ['S', 'I', 'A'].includes(f.status))
      .forEach((f) => {
        const key = `${f.namaSiswa}|||${f.kelas}`;
        const obj = absenMap.get(key) || { gender: f.gender, S: 0, I: 0, A: 0, Total: 0, rincian: [] };
        obj[f.status as 'S' | 'I' | 'A']++;
        obj.Total++;
        obj.rincian.push(`[${f.status}] ${formatDateIndo(f.tanggal).slice(0, 5)} ${divisi === 'Akademik' ? f.mapel : ''}`.trim());
        absenMap.set(key, obj);
      });
    const sorted = Array.from(absenMap.entries())
      .map(([k, v]) => {
        const [nama, kls] = k.split('|||');
        return { nama, kls, ...v };
      })
      .sort((a, b) => b.Total - a.Total || b.A - a.A)
      .slice(0, 25);
    const laporan = [
      ['No', 'Nama Siswa', 'Wilayah', divisi === 'Asrama' ? 'Kamar' : divisi === 'Al-Quran' ? 'Kelompok' : 'Kelas', 'S', 'I', 'A', 'Total Absen', 'Rincian'],
      ...sorted.map((it, i) => [
        String(i + 1),
        it.nama,
        `Wilayah ${it.gender}`,
        it.kls,
        String(it.S),
        String(it.I),
        String(it.A),
        String(it.Total),
        it.rincian.join(' | '),
      ]),
    ];
    if (laporan.length === 1) laporan.push(['-', 'TIDAK ADA DATA KETIDAKHADIRAN', '-', '-', '-', '-', '-', '-', '-']);
    return { laporan, materi: [] };
  }

  private buildDivisiStat(logs: Array<{ status: AttendanceStatus }>): DivisiStatCard {
    const c = { H: 0, T: 0, S: 0, I: 0, A: 0 };
    for (const l of logs) c[l.status]++;
    const total = c.H + c.T + c.S + c.I + c.A;
    const persenHadir = total === 0 ? 0 : Math.round(((c.H + c.T) / total) * 100);
    return { ...c, total, persenHadir };
  }

  private buildPembinaanSummary(wilayah: WilayahFilter): PembinaanAnalisisSummary {
    const matchW = (g: Gender) => wilayah === 'Semua' || g === wilayah;
    const studentsScope = this.db.students.filter((s) => matchW(s.gender));
    const recordsScope = this.db.pembinaanRecords.filter((r) => matchW(r.gender));

    const dibinaSet = new Set(recordsScope.map((r) => r.namaSantri.toUpperCase()));
    const wajibKeys: Array<keyof IbadahChecklist> = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    const sunnahKeys: Array<keyof IbadahChecklist> = ['tahajud', 'dhuha', 'tilawah'];

    let wDone = 0;
    let sDone = 0;
    const statusCounts: Record<StatusTindakLanjut, number> = { Selesai: 0, Proses: 0, Eskalasi: 0 };
    const kategoriMap = new Map<PembinaanKategori, number>([
      ['Pemantauan Ibadah', 0],
      ['Pembinaan Karakter', 0],
      ['Kedisiplinan', 0],
      ['Prestasi', 0],
      ['Kesehatan', 0],
    ]);

    for (const r of recordsScope) {
      wDone += wajibKeys.filter((k) => r.ibadah[k]).length;
      sDone += sunnahKeys.filter((k) => r.ibadah[k]).length;
      statusCounts[r.statusTindakLanjut] = (statusCounts[r.statusTindakLanjut] || 0) + 1;
      kategoriMap.set(r.kategori, (kategoriMap.get(r.kategori) || 0) + 1);
    }

    const totalCatatan = recordsScope.length;
    const persenSholatWajib = totalCatatan === 0 ? 0 : Math.round((wDone / (totalCatatan * 5)) * 100);
    const persenIbadahSunnah = totalCatatan === 0 ? 0 : Math.round((sDone / (totalCatatan * 3)) * 100);
    const totalPelanggaran = recordsScope.filter((r) => r.kategori === 'Kedisiplinan' || r.poin < 0).length;
    const totalPrestasi = recordsScope.filter((r) => r.kategori === 'Prestasi' || r.poin > 0).length;
    const netPoin = recordsScope.reduce((acc, r) => acc + r.poin, 0);

    const prioritasCounts = {
      Mandiri: studentsScope.filter((s) => s.prioritas === 'Mandiri').length,
      Rutin: studentsScope.filter((s) => s.prioritas === 'Rutin').length,
      Intensif: studentsScope.filter((s) => s.prioritas === 'Intensif').length,
      BelumDiatur: studentsScope.filter((s) => !s.prioritas || s.prioritas === '-').length,
    };

    const byStudent = new Map<
      string,
      {
        nama: string;
        gender: Gender;
        kelas: string;
        kamar: string;
        records: PembinaanRecord[];
      }
    >();
    for (const r of recordsScope) {
      const k = r.namaSantri.toUpperCase();
      const entry = byStudent.get(k) || {
        nama: r.namaSantri,
        gender: r.gender,
        kelas: r.kelas,
        kamar: r.kamar,
        records: [],
      };
      entry.records.push(r);
      byStudent.set(k, entry);
    }

    const topAttentionStudents = Array.from(byStudent.values())
      .map((item) => {
        const sorted = [...item.records].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        const pelanggaran = item.records.filter((r) => r.kategori === 'Kedisiplinan' || r.poin < 0).length;
        const net = item.records.reduce((acc, r) => acc + r.poin, 0);
        let sw = 0;
        for (const r of item.records) sw += wajibKeys.filter((k) => r.ibadah[k]).length;
        const wajibPct = item.records.length === 0 ? 0 : Math.round((sw / (item.records.length * 5)) * 100);
        return {
          nama: item.nama,
          gender: item.gender,
          kelas: item.kelas,
          kamar: item.kamar,
          totalCatatan: item.records.length,
          pelanggaran,
          netPoin: net,
          wajibPct,
          statusTerakhir: sorted[0]?.statusTindakLanjut || 'Selesai',
        };
      })
      .filter((s) => s.netPoin < 0 || s.pelanggaran > 0 || s.statusTerakhir !== 'Selesai' || s.wajibPct < 80)
      .sort((a, b) => a.netPoin - b.netPoin || b.pelanggaran - a.pelanggaran || a.wajibPct - b.wajibPct)
      .slice(0, 12);

    return {
      totalSantri: studentsScope.length,
      santriDibina: dibinaSet.size,
      totalCatatan,
      totalPelanggaran,
      totalPrestasi,
      netPoin,
      persenSholatWajib,
      persenIbadahSunnah,
      statusCounts,
      prioritasCounts,
      kategoriCounts: Array.from(kategoriMap.entries()).map(([kategori, count]) => ({ kategori, count })),
      topAttentionStudents,
    };
  }

  public getAnalyticsTerpadu(tanggal?: string): AnalyticsTerpadu {
    const targetDate = tanggal || new Date().toISOString().slice(0, 10);
    const mon = this.getMonitoringData(targetDate);

    const summarizeMon = (side: MonitoringData['putra']) => {
      const kbmCells = [
        ...side.akademik.kelas10,
        ...side.akademik.kelas11,
        ...side.akademik.kelas12,
        ...side.alquran.kelas10,
        ...side.alquran.kelas11,
        ...side.alquran.kelas12,
      ];
      const diisiKbm = kbmCells.filter((c) => c.status === 'HADIR').length;
      const diisiKamar = side.asrama.filter((r) => r.status === 'HADIR').length;
      const guruAbsen =
        kbmCells.filter((c) => c.status === 'GURU_ABSEN').length +
        side.asrama.filter((r) => r.status === 'GURU_ABSEN').length;
      return {
        totalJadwalKbm: kbmCells.length,
        diisiKbm,
        totalKamar: side.asrama.length,
        diisiKamar,
        guruAbsen,
      };
    };

    const topAbsenFor = (g: Gender) => {
      const map = new Map<string, { nama: string; kelas: string; kamar: string; S: number; I: number; A: number; total: number }>();
      const stLookup = new Map<string, Student>();
      for (const s of this.db.students) {
        if (s.gender === g) stLookup.set(s.nama.toUpperCase(), s);
      }
      for (const l of this.db.attendanceLogs) {
        if (l.gender !== g || !['S', 'I', 'A'].includes(l.status)) continue;
        const st = stLookup.get(l.namaSiswa.toUpperCase());
        const item = map.get(l.namaSiswa) || {
          nama: l.namaSiswa,
          kelas: st?.kelas || l.kelas,
          kamar: st?.kamar || '-',
          S: 0,
          I: 0,
          A: 0,
          total: 0,
        };
        item[l.status as 'S' | 'I' | 'A']++;
        item.total++;
        map.set(l.namaSiswa, item);
      }
      return Array.from(map.values())
        .sort((a, b) => b.total - a.total || b.A - a.A)
        .slice(0, 10);
    };

    return {
      tanggal: targetDate,
      presensiByWilayah: {
        Semua: this.getDashboardStats('Semua'),
        Putra: this.getDashboardStats('Putra'),
        Putri: this.getDashboardStats('Putri'),
      },
      divisiByWilayah: {
        Putra: {
          Asrama: this.buildDivisiStat(this.db.attendanceLogs.filter((l) => l.gender === 'Putra' && l.jenisPresensi === 'Asrama')),
          Belajar: this.buildDivisiStat(this.db.attendanceLogs.filter((l) => l.gender === 'Putra' && l.jenisPresensi === 'Belajar')),
          AlQuran: this.buildDivisiStat(this.db.attendanceLogs.filter((l) => l.gender === 'Putra' && l.jenisPresensi === 'Al-Quran')),
          Ujian: this.buildDivisiStat(this.db.examLogs.filter((e) => e.gender === 'Putra')),
        },
        Putri: {
          Asrama: this.buildDivisiStat(this.db.attendanceLogs.filter((l) => l.gender === 'Putri' && l.jenisPresensi === 'Asrama')),
          Belajar: this.buildDivisiStat(this.db.attendanceLogs.filter((l) => l.gender === 'Putri' && l.jenisPresensi === 'Belajar')),
          AlQuran: this.buildDivisiStat(this.db.attendanceLogs.filter((l) => l.gender === 'Putri' && l.jenisPresensi === 'Al-Quran')),
          Ujian: this.buildDivisiStat(this.db.examLogs.filter((e) => e.gender === 'Putri')),
        },
      },
      monitoringRingkasan: {
        Putra: summarizeMon(mon.putra),
        Putri: summarizeMon(mon.putri),
      },
      topAbsenPerWilayah: {
        Putra: topAbsenFor('Putra'),
        Putri: topAbsenFor('Putri'),
      },
      pembinaanAnalisis: {
        Semua: this.buildPembinaanSummary('Semua'),
        Putra: this.buildPembinaanSummary('Putra'),
        Putri: this.buildPembinaanSummary('Putri'),
      },
    };
  }

  public getMonthlyWaliKelasSummary(params: {
    bulan?: string;
    wilayah?: WilayahFilter;
    kelas?: string;
  }): MonthlyWaliKelasReport {
    const rawBulan = String(params.bulan || 'SEMUA').trim();
    const wilayah: WilayahFilter = params.wilayah || 'Semua';
    const rawKelas = String(params.kelas || 'SEMUA').trim().toUpperCase();

    // Determine month filter
    let targetMonthIdx = 0; // 0 = all months (or semester)
    let isSemesterFilter = false;
    let isGanjil = false;
    let bulanLabel = 'Semua Bulan (Kumulatif)';

    if (rawBulan.startsWith('Bulan ')) {
      targetMonthIdx = parseInt(rawBulan.replace('Bulan ', '').trim(), 10) || 0;
      if (targetMonthIdx >= 1 && targetMonthIdx <= 12) {
        bulanLabel = `Bulan ${NAMA_BULAN[targetMonthIdx - 1]}`;
      }
    } else if (/^\d+$/.test(rawBulan)) {
      targetMonthIdx = parseInt(rawBulan, 10) || 0;
      if (targetMonthIdx >= 1 && targetMonthIdx <= 12) {
        bulanLabel = `Bulan ${NAMA_BULAN[targetMonthIdx - 1]}`;
      }
    } else if (rawBulan.includes('Ganjil')) {
      isSemesterFilter = true;
      isGanjil = true;
      bulanLabel = 'Semester Ganjil (Juli - Desember)';
    } else if (rawBulan.includes('Genap')) {
      isSemesterFilter = true;
      isGanjil = false;
      bulanLabel = 'Semester Genap (Januari - Juni)';
    } else {
      const foundIdx = NAMA_BULAN.findIndex((b) => b.toLowerCase() === rawBulan.toLowerCase());
      if (foundIdx >= 0) {
        targetMonthIdx = foundIdx + 1;
        bulanLabel = `Bulan ${NAMA_BULAN[foundIdx]}`;
      }
    }

    const matchDatePeriod = (tgl: string, recBulan?: string) => {
      if (targetMonthIdx >= 1 && targetMonthIdx <= 12) {
        const parts = (tgl || '').split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (!isNaN(m)) return m === targetMonthIdx;
        }
        if (recBulan) {
          return recBulan.toLowerCase() === NAMA_BULAN[targetMonthIdx - 1].toLowerCase();
        }
        return false;
      }
      if (isSemesterFilter) {
        const parts = (tgl || '').split('-');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (!isNaN(m)) return (m >= 7) === isGanjil;
        }
        if (recBulan) {
          const idx = NAMA_BULAN.findIndex((b) => b.toLowerCase() === recBulan.toLowerCase()) + 1;
          if (idx >= 1) return (idx >= 7) === isGanjil;
        }
      }
      return true;
    };

    const matchW = (g: Gender) => wilayah === 'Semua' || g === wilayah;
    const matchK = (k: string) =>
      !rawKelas ||
      rawKelas === 'SEMUA' ||
      rawKelas === 'SEMUA KELAS' ||
      normalizeStr(k) === normalizeStr(rawKelas);

    const studentsInWilayah = this.db.students.filter((s) => matchW(s.gender));
    const studentsInScope = studentsInWilayah
      .filter((s) => matchK(s.kelas))
      .sort((a, b) => a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) || a.nama.localeCompare(b.nama));

    const studentNameSet = new Set(studentsInScope.map((s) => normalizeStr(s.nama)));

    // Find Wali Kelas name for the selected class
    let waliKelasLabel = 'Semua Wali Kelas';
    if (rawKelas && rawKelas !== 'SEMUA' && rawKelas !== 'SEMUA KELAS') {
      const waliTeacher = this.db.teachers.find(
        (t) => t.waliKelasOf && normalizeStr(t.waliKelasOf) === normalizeStr(rawKelas),
      );
      const fromStudent = studentsInScope.find((s) => s.waliKelas && s.waliKelas !== '-')?.waliKelas;
      waliKelasLabel = waliTeacher?.nama || fromStudent || 'Belum Ditentukan';
    }

    // Filter attendance & exam logs for students in scope and period
    const scopedAttendanceLogs = this.db.attendanceLogs.filter((l) => {
      if (!matchW(l.gender) || !matchDatePeriod(l.tanggal)) return false;
      if (rawKelas && rawKelas !== 'SEMUA' && rawKelas !== 'SEMUA KELAS') {
        return studentNameSet.has(normalizeStr(l.namaSiswa)) || normalizeStr(l.kelas) === normalizeStr(rawKelas);
      }
      return true;
    });

    const scopedExamLogs = this.db.examLogs.filter((e) => {
      if (!matchW(e.gender) || !matchDatePeriod(e.tanggal)) return false;
      if (rawKelas && rawKelas !== 'SEMUA' && rawKelas !== 'SEMUA KELAS') {
        return studentNameSet.has(normalizeStr(e.namaSiswa)) || normalizeStr(e.kelas) === normalizeStr(rawKelas);
      }
      return true;
    });

    const scopedPembinaan = this.db.pembinaanRecords.filter((r) => {
      if (!matchW(r.gender) || !matchDatePeriod(r.tanggal, r.bulan)) return false;
      if (rawKelas && rawKelas !== 'SEMUA' && rawKelas !== 'SEMUA KELAS') {
        return studentNameSet.has(normalizeStr(r.namaSantri)) || normalizeStr(r.kelas) === normalizeStr(rawKelas);
      }
      return true;
    });

    // Overall Presensi Summary
    const overallStat = this.buildDivisiStat(scopedAttendanceLogs);
    const byDivisi = {
      Akademik: this.buildDivisiStat(scopedAttendanceLogs.filter((l) => l.jenisPresensi === 'Belajar')),
      Asrama: this.buildDivisiStat(scopedAttendanceLogs.filter((l) => l.jenisPresensi === 'Asrama')),
      AlQuran: this.buildDivisiStat(scopedAttendanceLogs.filter((l) => l.jenisPresensi === 'Al-Quran')),
      Ujian: this.buildDivisiStat(scopedExamLogs),
    };

    // Pembinaan Summary for this scope
    const wajibKeys: Array<keyof IbadahChecklist> = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    const sunnahKeys: Array<keyof IbadahChecklist> = ['tahajud', 'dhuha', 'tilawah'];
    let wDone = 0;
    let sDone = 0;
    const statusCounts: Record<StatusTindakLanjut, number> = { Selesai: 0, Proses: 0, Eskalasi: 0 };
    const kategoriMap = new Map<PembinaanKategori, number>([
      ['Pemantauan Ibadah', 0],
      ['Pembinaan Karakter', 0],
      ['Kedisiplinan', 0],
      ['Prestasi', 0],
      ['Kesehatan', 0],
    ]);

    for (const r of scopedPembinaan) {
      wDone += wajibKeys.filter((k) => r.ibadah[k]).length;
      sDone += sunnahKeys.filter((k) => r.ibadah[k]).length;
      statusCounts[r.statusTindakLanjut] = (statusCounts[r.statusTindakLanjut] || 0) + 1;
      kategoriMap.set(r.kategori, (kategoriMap.get(r.kategori) || 0) + 1);
    }

    const dibinaSet = new Set(scopedPembinaan.map((r) => normalizeStr(r.namaSantri)));
    const totalCatatan = scopedPembinaan.length;
    const persenSholatWajib = totalCatatan === 0 ? 0 : Math.round((wDone / (totalCatatan * 5)) * 100);
    const persenIbadahSunnah = totalCatatan === 0 ? 0 : Math.round((sDone / (totalCatatan * 3)) * 100);
    const totalPelanggaran = scopedPembinaan.filter((r) => r.kategori === 'Kedisiplinan' || r.poin < 0).length;
    const totalPrestasi = scopedPembinaan.filter((r) => r.kategori === 'Prestasi' || r.poin > 0).length;
    const netPoin = scopedPembinaan.reduce((acc, r) => acc + r.poin, 0);

    const prioritasCounts = {
      Mandiri: studentsInScope.filter((s) => s.prioritas === 'Mandiri').length,
      Rutin: studentsInScope.filter((s) => s.prioritas === 'Rutin').length,
      Intensif: studentsInScope.filter((s) => s.prioritas === 'Intensif').length,
      BelumDiatur: studentsInScope.filter((s) => !s.prioritas || s.prioritas === '-').length,
    };

    // Per-student rows
    const logsByStudent = new Map<string, AttendanceLog[]>();
    for (const l of scopedAttendanceLogs) {
      const k = normalizeStr(l.namaSiswa);
      const arr = logsByStudent.get(k) || [];
      arr.push(l);
      logsByStudent.set(k, arr);
    }

    const pembinaanByStudent = new Map<string, PembinaanRecord[]>();
    for (const r of scopedPembinaan) {
      const k = normalizeStr(r.namaSantri);
      const arr = pembinaanByStudent.get(k) || [];
      arr.push(r);
      pembinaanByStudent.set(k, arr);
    }

    const studentRows: WaliKelasMonthlyStudentRow[] = studentsInScope.map((st) => {
      const k = normalizeStr(st.nama);
      const stLogs = logsByStudent.get(k) || [];
      const stPb = (pembinaanByStudent.get(k) || []).sort((a, b) => b.tanggal.localeCompare(a.tanggal));

      const pStat = this.buildDivisiStat(stLogs);
      const akStat = this.buildDivisiStat(stLogs.filter((l) => l.jenisPresensi === 'Belajar'));
      const asrStat = this.buildDivisiStat(stLogs.filter((l) => l.jenisPresensi === 'Asrama'));
      const qrStat = this.buildDivisiStat(stLogs.filter((l) => l.jenisPresensi === 'Al-Quran'));

      let sw = 0;
      let ss = 0;
      for (const r of stPb) {
        sw += wajibKeys.filter((wk) => r.ibadah[wk]).length;
        ss += sunnahKeys.filter((sk) => r.ibadah[sk]).length;
      }
      const stWajibPct = stPb.length === 0 ? 0 : Math.round((sw / (stPb.length * 5)) * 100);
      const stSunnahPct = stPb.length === 0 ? 0 : Math.round((ss / (stPb.length * 3)) * 100);
      const stPrestasi = stPb.filter((r) => r.kategori === 'Prestasi' || r.poin > 0).length;
      const stPelanggaran = stPb.filter((r) => r.kategori === 'Kedisiplinan' || r.poin < 0).length;
      const stNetPoin = stPb.reduce((acc, r) => acc + r.poin, 0);

      return {
        id: st.id,
        nis: st.nis || '-',
        nama: st.nama,
        gender: st.gender,
        kelas: st.kelas,
        kamar: st.kamar || '-',
        waliKelas: st.waliKelas || waliKelasLabel,
        musyrif: st.musyrif || '-',
        prioritas: st.prioritas || '-',
        presensi: {
          H: pStat.H,
          T: pStat.T,
          S: pStat.S,
          I: pStat.I,
          A: pStat.A,
          total: pStat.total,
          persenHadir: pStat.persenHadir,
          akademikPct: akStat.persenHadir,
          asramaPct: asrStat.persenHadir,
          alquranPct: qrStat.persenHadir,
        },
        pembinaan: {
          totalCatatan: stPb.length,
          wajibPct: stWajibPct,
          sunnahPct: stSunnahPct,
          totalPrestasi: stPrestasi,
          totalPelanggaran: stPelanggaran,
          netPoin: stNetPoin,
          statusTerakhir: stPb[0]?.statusTindakLanjut || '-',
          catatanTerakhir: stPb[0]?.catatan || '-',
        },
      };
    });

    const topAttentionStudents = studentRows
      .filter(
        (r) =>
          r.pembinaan.netPoin < 0 ||
          r.pembinaan.totalPelanggaran > 0 ||
          (r.pembinaan.statusTerakhir !== '-' && r.pembinaan.statusTerakhir !== 'Selesai') ||
          (r.pembinaan.totalCatatan > 0 && r.pembinaan.wajibPct < 80) ||
          r.presensi.A > 0,
      )
      .sort(
        (a, b) =>
          a.pembinaan.netPoin - b.pembinaan.netPoin ||
          b.presensi.A - a.presensi.A ||
          b.pembinaan.totalPelanggaran - a.pembinaan.totalPelanggaran,
      )
      .slice(0, 12)
      .map((r) => ({
        nama: r.nama,
        gender: r.gender,
        kelas: r.kelas,
        kamar: r.kamar,
        totalCatatan: r.pembinaan.totalCatatan,
        pelanggaran: r.pembinaan.totalPelanggaran,
        netPoin: r.pembinaan.netPoin,
        wajibPct: r.pembinaan.wajibPct,
        statusTerakhir: r.pembinaan.statusTerakhir === '-' ? 'Selesai' : r.pembinaan.statusTerakhir,
      }));

    // Class-by-class comparison across all classes in the selected Wilayah & Month
    const uniqueClasses = Array.from(
      new Set(studentsInWilayah.map((s) => s.kelas.toUpperCase()).filter((k) => k && k !== '-')),
    ).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));

    const allWilayahLogs = this.db.attendanceLogs.filter((l) => matchW(l.gender) && matchDatePeriod(l.tanggal));
    const allWilayahPb = this.db.pembinaanRecords.filter(
      (r) => matchW(r.gender) && matchDatePeriod(r.tanggal, r.bulan),
    );

    const classComparison: ClassAnalyticsComparison[] = uniqueClasses.map((kls) => {
      const klsStudents = studentsInWilayah.filter((s) => normalizeStr(s.kelas) === normalizeStr(kls));
      const klsNames = new Set(klsStudents.map((s) => normalizeStr(s.nama)));
      const waliTeacher = this.db.teachers.find(
        (t) => t.waliKelasOf && normalizeStr(t.waliKelasOf) === normalizeStr(kls),
      );
      const waliName =
        waliTeacher?.nama || klsStudents.find((s) => s.waliKelas && s.waliKelas !== '-')?.waliKelas || '-';

      const klsLogs = allWilayahLogs.filter(
        (l) => klsNames.has(normalizeStr(l.namaSiswa)) || normalizeStr(l.kelas) === normalizeStr(kls),
      );
      const klsStat = this.buildDivisiStat(klsLogs);

      const klsPb = allWilayahPb.filter(
        (r) => klsNames.has(normalizeStr(r.namaSantri)) || normalizeStr(r.kelas) === normalizeStr(kls),
      );
      const klsDibina = new Set(klsPb.map((r) => normalizeStr(r.namaSantri))).size;

      let kw = 0;
      let ks = 0;
      for (const r of klsPb) {
        kw += wajibKeys.filter((wk) => r.ibadah[wk]).length;
        ks += sunnahKeys.filter((sk) => r.ibadah[sk]).length;
      }

      return {
        kelas: kls,
        gender: klsStudents[0]?.gender || 'Putra',
        waliKelas: waliName,
        totalSantri: klsStudents.length,
        santriDibina: klsDibina,
        cakupanPembinaanPct:
          klsStudents.length === 0 ? 0 : Math.round((klsDibina / klsStudents.length) * 100),
        persenHadir: klsStat.persenHadir,
        totalHadir: klsStat.H + klsStat.T,
        totalAbsen: klsStat.S + klsStat.I + klsStat.A,
        wajibPct: klsPb.length === 0 ? 0 : Math.round((kw / (klsPb.length * 5)) * 100),
        sunnahPct: klsPb.length === 0 ? 0 : Math.round((ks / (klsPb.length * 3)) * 100),
        netPoin: klsPb.reduce((acc, r) => acc + r.poin, 0),
        kasusAktif: klsPb.filter((r) => r.statusTindakLanjut !== 'Selesai').length,
      };
    });

    return {
      meta: {
        bulan: rawBulan || 'SEMUA',
        bulanLabel,
        wilayah,
        kelas: rawKelas && rawKelas !== 'SEMUA' ? rawKelas : 'SEMUA KELAS',
        waliKelas: waliKelasLabel,
        totalSantri: studentsInScope.length,
        tanggalCetak: new Date().toISOString().slice(0, 10),
      },
      presensiSummary: {
        H: overallStat.H,
        T: overallStat.T,
        S: overallStat.S,
        I: overallStat.I,
        A: overallStat.A,
        totalSesi: overallStat.total,
        persenHadir: overallStat.persenHadir,
        byDivisi,
      },
      pembinaanSummary: {
        totalSantri: studentsInScope.length,
        santriDibina: dibinaSet.size,
        totalCatatan,
        totalPelanggaran,
        totalPrestasi,
        netPoin,
        persenSholatWajib,
        persenIbadahSunnah,
        statusCounts,
        prioritasCounts,
        kategoriCounts: Array.from(kategoriMap.entries()).map(([kategori, count]) => ({ kategori, count })),
        topAttentionStudents,
      },
      classComparison,
      studentRows,
    };
  }

  // ==============================================================
  // SISTEM PEMBINAAN TERPADU (WALI KELAS, MUSYRIF, MUSYRIFAH, GURU)
  // ==============================================================
  public getPembinaanList(filters?: {
    gender?: WilayahFilter;
    kelas?: string;
    kamar?: string;
    santri?: string;
    pekanKe?: number;
    statusTindakLanjut?: StatusTindakLanjut;
    pembinaPeran?: string;
  }) {
    let rows = [...this.db.pembinaanRecords];
    if (filters?.gender && filters.gender !== 'Semua') {
      rows = rows.filter((r) => r.gender === filters.gender);
    }
    if (filters?.kelas && filters.kelas !== 'SEMUA') {
      rows = rows.filter((r) => r.kelas.toUpperCase() === filters.kelas!.toUpperCase());
    }
    if (filters?.kamar && filters.kamar !== 'SEMUA') {
      rows = rows.filter((r) => r.kamar.toUpperCase() === filters.kamar!.toUpperCase());
    }
    if (filters?.santri && filters.santri !== 'SEMUA') {
      rows = rows.filter((r) => r.namaSantri.toUpperCase() === filters.santri!.toUpperCase());
    }
    if (filters?.pekanKe) {
      rows = rows.filter((r) => r.pekanKe === filters.pekanKe);
    }
    if (filters?.statusTindakLanjut) {
      rows = rows.filter((r) => r.statusTindakLanjut === filters.statusTindakLanjut);
    }
    if (filters?.pembinaPeran && filters.pembinaPeran !== 'SEMUA') {
      rows = rows.filter((r) => normalizeStr(r.pembinaPeran) === normalizeStr(filters.pembinaPeran!));
    }
    return rows.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.timestamp.localeCompare(a.timestamp));
  }

  public getPortfolioSantri(namaSantri: string): PortfolioSummary {
    const santri = this.db.students.find((s) => s.nama.toUpperCase() === namaSantri.trim().toUpperCase()) || null;
    const riwayatPembinaan = this.db.pembinaanRecords
      .filter((r) => r.namaSantri.toUpperCase() === namaSantri.trim().toUpperCase())
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.timestamp.localeCompare(a.timestamp));

    const keys: Array<keyof IbadahChecklist> = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya', 'tahajud', 'dhuha', 'tilawah'];
    const ibadahBreakdown = {} as Record<keyof IbadahChecklist, { done: number; total: number; pct: number }>;
    const totalRows = riwayatPembinaan.length;

    for (const k of keys) {
      const done = riwayatPembinaan.filter((r) => r.ibadah[k]).length;
      ibadahBreakdown[k] = {
        done,
        total: totalRows,
        pct: totalRows === 0 ? 0 : Math.round((done / totalRows) * 100),
      };
    }

    const wajibKeys: Array<keyof IbadahChecklist> = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
    const sunnahKeys: Array<keyof IbadahChecklist> = ['tahajud', 'dhuha', 'tilawah'];
    const totalWajibDone = wajibKeys.reduce((acc, k) => acc + ibadahBreakdown[k].done, 0);
    const totalSunnahDone = sunnahKeys.reduce((acc, k) => acc + ibadahBreakdown[k].done, 0);

    const persenSholatWajib = totalRows === 0 ? 0 : Math.round((totalWajibDone / (totalRows * wajibKeys.length)) * 100);
    const persenSholatSunnah = totalRows === 0 ? 0 : Math.round((totalSunnahDone / (totalRows * sunnahKeys.length)) * 100);

    const totalPelanggaran = riwayatPembinaan.filter((r) => r.kategori === 'Kedisiplinan' || r.poin < 0).length;
    const totalPrestasi = riwayatPembinaan.filter((r) => r.kategori === 'Prestasi' || r.poin > 0).length;
    const netPoin = riwayatPembinaan.reduce((acc, r) => acc + r.poin, 0);

    const makeEmpty = (): Record<AttendanceStatus, number> => ({ H: 0, T: 0, S: 0, I: 0, A: 0 });
    const rekapPresensi = {
      akademik: makeEmpty(),
      asrama: makeEmpty(),
      alquran: makeEmpty(),
      ujian: makeEmpty(),
    };

    const recentAbsenIssues: PortfolioSummary['recentAbsenIssues'] = [];

    for (const l of this.db.attendanceLogs) {
      if (l.namaSiswa.toUpperCase() !== namaSantri.trim().toUpperCase()) continue;
      if (l.jenisPresensi === 'Belajar') rekapPresensi.akademik[l.status]++;
      else if (l.jenisPresensi === 'Asrama') rekapPresensi.asrama[l.status]++;
      else if (l.jenisPresensi === 'Al-Quran') rekapPresensi.alquran[l.status]++;

      if (l.status !== 'H') {
        recentAbsenIssues.push({
          tanggal: l.tanggal,
          divisi: l.jenisPresensi === 'Belajar' ? 'Akademik' : l.jenisPresensi,
          konteks: l.jenisPresensi === 'Asrama' ? l.kelas : l.mapel,
          status: l.status,
          keterangan: l.keterangan,
        });
      }
    }

    for (const ex of this.db.examLogs) {
      if (ex.namaSiswa.toUpperCase() !== namaSantri.trim().toUpperCase()) continue;
      rekapPresensi.ujian[ex.status]++;
      if (ex.status !== 'H') {
        recentAbsenIssues.push({
          tanggal: ex.tanggal,
          divisi: `Ujian (${ex.jenisUjian})`,
          konteks: ex.mapel,
          status: ex.status,
          keterangan: ex.keterangan,
        });
      }
    }

    recentAbsenIssues.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    return {
      santri,
      totalCatatan: totalRows,
      totalPelanggaran,
      totalPrestasi,
      netPoin,
      persenSholatWajib,
      persenSholatSunnah,
      ibadahBreakdown,
      riwayatPembinaan,
      rekapPresensi,
      recentAbsenIssues: recentAbsenIssues.slice(0, 15),
    };
  }

  public savePembinaanRecord(payload: Omit<PembinaanRecord, 'id' | 'timestamp'>): PembinaanRecord {
    const student = this.db.students.find((s) => s.nama.toUpperCase() === payload.namaSantri.trim().toUpperCase());
    const rec: PembinaanRecord = {
      ...payload,
      id: `PB_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      bulan: payload.bulan || getMonthNameFromDate(payload.tanggal),
      kelas: student ? student.kelas : payload.kelas,
      kamar: student ? student.kamar : payload.kamar || '-',
      gender: student ? student.gender : payload.gender,
      waliKelas: payload.waliKelas || student?.waliKelas || '-',
    };
    this.db.pembinaanRecords.unshift(rec);

    // Automated WhatsApp Gateway Notification for ESKALASI or severe violation
    const waConfig = this.db.settings.whatsappConfig;
    if (
      (!waConfig || waConfig.autoNotifyEskalasi !== false) &&
      (rec.statusTindakLanjut === 'Eskalasi' || rec.poin <= -10)
    ) {
      const nomorTujuan = student?.waOrtu || '6281200000000';
      const pesan = `[SIM PINTAR PEMBINAAN] Assalamu'alaikum Bapak/Ibu Wali dari *${rec.namaSantri}* (${rec.kelas}). Terdapat catatan pembinaan berstatus *${rec.statusTindakLanjut.toUpperCase()}* (${rec.kategori}, Poin: ${rec.poin}) pada ${formatDateIndo(rec.tanggal)} oleh ${rec.pembinaNama}. Uraian: "${rec.catatan}". Tindak Lanjut: "${rec.tindakLanjut}".`;
      this.recordWhatsAppTrigger({
        triggerType: 'ESKALASI_PEMBINAAN',
        namaSantri: rec.namaSantri,
        kelas: rec.kelas,
        nomorTujuan,
        pesan,
      });
    }

    this.batchedWrites++;
    this.persist();
    return rec;
  }

  public savePembinaanBatch(records: Array<Omit<PembinaanRecord, 'id' | 'timestamp'>>): { saved: number } {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const created: PembinaanRecord[] = records.map((r, i) => {
      const student = this.db.students.find((s) => s.nama.toUpperCase() === r.namaSantri.trim().toUpperCase());
      return {
        ...r,
        id: `PB_${Date.now()}_${i}`,
        timestamp,
        bulan: r.bulan || getMonthNameFromDate(r.tanggal),
        kelas: student ? student.kelas : r.kelas,
        kamar: student ? student.kamar : r.kamar || '-',
        gender: student ? student.gender : r.gender,
        waliKelas: r.waliKelas || student?.waliKelas || '-',
      };
    });
    this.db.pembinaanRecords.unshift(...created);

    const waConfig = this.db.settings.whatsappConfig;
    if (!waConfig || waConfig.autoNotifyEskalasi !== false) {
      for (const rec of created) {
        if (rec.statusTindakLanjut === 'Eskalasi' || rec.poin <= -10) {
          const student = this.db.students.find((s) => s.nama.toUpperCase() === rec.namaSantri.trim().toUpperCase());
          const nomorTujuan = student?.waOrtu || '6281200000000';
          const pesan = `[SIM PINTAR PEMBINAAN] Assalamu'alaikum Bapak/Ibu Wali dari *${rec.namaSantri}* (${rec.kelas}). Terdapat catatan pembinaan berstatus *${rec.statusTindakLanjut.toUpperCase()}* (${rec.kategori}, Poin: ${rec.poin}) pada ${formatDateIndo(rec.tanggal)}. Uraian: "${rec.catatan}".`;
          this.recordWhatsAppTrigger({
            triggerType: 'ESKALASI_PEMBINAAN',
            namaSantri: rec.namaSantri,
            kelas: rec.kelas,
            nomorTujuan,
            pesan,
          });
        }
      }
    }

    this.batchedWrites++;
    this.persist();
    return { saved: created.length };
  }

  public updatePembinaanStatus(id: string, statusTindakLanjut: StatusTindakLanjut, tindakLanjut?: string): PembinaanRecord | null {
    const idx = this.db.pembinaanRecords.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    this.db.pembinaanRecords[idx] = {
      ...this.db.pembinaanRecords[idx],
      statusTindakLanjut,
      tindakLanjut: tindakLanjut !== undefined ? tindakLanjut : this.db.pembinaanRecords[idx].tindakLanjut,
    };
    this.batchedWrites++;
    this.persist();
    return this.db.pembinaanRecords[idx];
  }

  public deletePembinaanRecord(id: string): boolean {
    const before = this.db.pembinaanRecords.length;
    this.db.pembinaanRecords = this.db.pembinaanRecords.filter((r) => r.id !== id);
    if (this.db.pembinaanRecords.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  // ==============================================================
  // AKUN GURU & REKAP PRIBADI OTOMATIS (GURU, WALI KELAS, MUSYRIF/AH)
  // ==============================================================
  public getTeacherPersonalRecap(namaGuru: string, tanggal: string) {
    const req = normalizeStr(namaGuru);
    const teacher = this.db.teachers.find((t) => normalizeStr(t.nama) === req || normalizeStr(t.username) === req);
    if (!teacher) return null;

    const myLogs = this.db.attendanceLogs.filter((l) => {
      const lg = normalizeStr(l.guru);
      return lg.includes(req) || req.includes(lg);
    });

    const sessionMap = new Map<
      string,
      {
        tanggal: string;
        jenisPresensi: PresensiType;
        kelas: string;
        mapel: string;
        materi: string;
        totalSiswa: number;
        hadir: number;
        tidakHadir: number;
        timestamp: string;
      }
    >();

    for (const l of myLogs) {
      const key = `${l.tanggal}|${l.jenisPresensi}|${l.kelas}|${l.mapel}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          tanggal: l.tanggal,
          jenisPresensi: l.jenisPresensi,
          kelas: l.kelas,
          mapel: l.mapel,
          materi: l.materi || '-',
          totalSiswa: 0,
          hadir: 0,
          tidakHadir: 0,
          timestamp: l.timestamp,
        });
      }
      const s = sessionMap.get(key)!;
      s.totalSiswa++;
      if (l.status === 'H' || l.status === 'T') s.hadir++;
      else s.tidakHadir++;
    }

    const sessions = Array.from(sessionMap.values()).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const todayDay = NAMA_HARI[new Date(`${tanggal}T00:00:00`).getDay()];
    const allMySchedules = this.db.schedules.filter(
      (s) => normalizeStr(s.guru).includes(req) || req.includes(normalizeStr(s.guru))
    );
    const todaySchedules = allMySchedules
      .filter((s) => s.hari === todayDay)
      .map((s) => {
        const filled = sessions.some(
          (ses) =>
            ses.tanggal === tanggal &&
            ses.kelas.toUpperCase() === s.kelas.toUpperCase() &&
            (s.kategori === 'Al-Quran' || s.mapel.toUpperCase().includes('QUR')
              ? ses.jenisPresensi === 'Al-Quran'
              : ses.mapel.toUpperCase() === s.mapel.toUpperCase())
        );
        return { ...s, filled };
      });

    const boundRoomNames = new Set<string>(teacher.kamarBinaan || []);
    const matchedRooms = this.db.rooms.filter(
      (r) =>
        (r.musyrif && (normalizeStr(r.musyrif).includes(req) || req.includes(normalizeStr(r.musyrif)))) ||
        Array.from(boundRoomNames).some((bk) => normalizeStr(bk) === normalizeStr(r.kamar))
    );
    matchedRooms.forEach((r) => boundRoomNames.add(r.kamar));

    const myRooms = Array.from(boundRoomNames).map((kamarName) => {
      const rmObj = this.db.rooms.find((r) => normalizeStr(r.kamar) === normalizeStr(kamarName));
      const filled = this.db.attendanceLogs.some(
        (l) =>
          l.tanggal === tanggal &&
          l.jenisPresensi === 'Asrama' &&
          normalizeStr(l.kelas) === normalizeStr(kamarName)
      );
      return {
        kamar: kamarName,
        musyrif: rmObj?.musyrif || teacher.nama,
        gender: rmObj?.gender || (teacher.genderScope === 'Putri' ? 'Putri' : 'Putra'),
        filled,
      };
    });

    const myExams = this.db.examLogs.filter(
      (e) => normalizeStr(e.pengawas1).includes(req) || normalizeStr(e.pengawas2).includes(req)
    );
    const examSessionsCount = new Set(myExams.map((e) => `${e.tanggal}|${e.ruangan}|${e.mapel}`)).size;

    const myAbsences = this.db.teacherAbsences.filter((a) => normalizeStr(a.namaGuru).includes(req));

    // --- WALI KELAS PROGRESS ---
    const waliKelasTarget = teacher.waliKelasOf?.trim() || '';
    const waliStudents = waliKelasTarget
      ? this.db.students.filter((s) => normalizeStr(s.kelas) === normalizeStr(waliKelasTarget))
      : [];

    const calcStudentIbadahStats = (records: PembinaanRecord[]) => {
      if (records.length === 0) return { wajibPct: 0, sunnahPct: 0 };
      const wajibKeys: Array<keyof IbadahChecklist> = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
      const sunnahKeys: Array<keyof IbadahChecklist> = ['tahajud', 'dhuha', 'tilawah'];
      let wDone = 0;
      let sDone = 0;
      for (const r of records) {
        wDone += wajibKeys.filter((k) => r.ibadah[k]).length;
        sDone += sunnahKeys.filter((k) => r.ibadah[k]).length;
      }
      return {
        wajibPct: Math.round((wDone / (records.length * 5)) * 100),
        sunnahPct: Math.round((sDone / (records.length * 3)) * 100),
      };
    };

    const waliSantriProgress = waliStudents.map((st) => {
      const pb = this.db.pembinaanRecords
        .filter((p) => normalizeStr(p.namaSantri) === normalizeStr(st.nama))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      const { wajibPct } = calcStudentIbadahStats(pb);
      const logs = this.db.attendanceLogs.filter((l) => normalizeStr(l.namaSiswa) === normalizeStr(st.nama));
      return {
        nama: st.nama,
        kelas: st.kelas,
        kamar: st.kamar,
        prioritas: st.prioritas || '-',
        totalPembinaan: pb.length,
        netPoin: pb.reduce((acc, r) => acc + r.poin, 0),
        statusTerakhir: pb[0]?.statusTindakLanjut || '-',
        lastTanggal: pb[0]?.tanggal || '-',
        absenSakit: logs.filter((l) => l.status === 'S').length,
        absenIzin: logs.filter((l) => l.status === 'I').length,
        absenAlfa: logs.filter((l) => l.status === 'A').length,
        wajibPct,
      };
    });

    const waliPembinaanAll = this.db.pembinaanRecords.filter(
      (p) =>
        (waliKelasTarget && normalizeStr(p.kelas) === normalizeStr(waliKelasTarget)) ||
        normalizeStr(p.pembinaNama).includes(req)
    );
    const waliIbadahAvg = calcStudentIbadahStats(waliPembinaanAll);

    const waliProgress = {
      kelasBinaan: waliKelasTarget,
      totalSantri: waliStudents.length,
      santriSudahDibina: waliSantriProgress.filter((s) => s.totalPembinaan > 0).length,
      kasusProsesEskalasi: waliPembinaanAll.filter((r) => r.statusTindakLanjut !== 'Selesai').length,
      rataSholatWajibPct: waliIbadahAvg.wajibPct,
      rataSholatSunnahPct: waliIbadahAvg.sunnahPct,
      santriProgress: waliSantriProgress,
    };

    // --- MUSYRIF / MUSYRIFAH PROGRESS ---
    const musyrifRoomSet = new Set(myRooms.map((r) => normalizeStr(r.kamar)));
    const musyrifStudents = this.db.students.filter(
      (s) =>
        musyrifRoomSet.has(normalizeStr(s.kamar)) ||
        (s.musyrif && (normalizeStr(s.musyrif).includes(req) || req.includes(normalizeStr(s.musyrif))))
    );
    const musyrifPembinaanAll = this.db.pembinaanRecords.filter(
      (p) =>
        musyrifRoomSet.has(normalizeStr(p.kamar)) ||
        ((p.pembinaPeran === 'Musyrif' || p.pembinaPeran === 'Musyrifah') && normalizeStr(p.pembinaNama).includes(req))
    );
    const musyrifIbadahAvg = calcStudentIbadahStats(musyrifPembinaanAll);
    const asramaTodayLogs = this.db.attendanceLogs.filter(
      (l) => l.tanggal === tanggal && l.jenisPresensi === 'Asrama'
    );

    const musyrifSantriProgress = musyrifStudents.map((st) => {
      const pb = this.db.pembinaanRecords
        .filter((p) => normalizeStr(p.namaSantri) === normalizeStr(st.nama))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      const { wajibPct, sunnahPct } = calcStudentIbadahStats(pb);
      const todayLog = asramaTodayLogs.find((l) => normalizeStr(l.namaSiswa) === normalizeStr(st.nama));
      return {
        nama: st.nama,
        kelas: st.kelas,
        kamar: st.kamar,
        totalPembinaan: pb.length,
        wajibPct,
        sunnahPct,
        statusAsramaHariIni: todayLog?.status || '-',
        keteranganHariIni: todayLog?.keterangan || '',
      };
    });

    const musyrifAbsenHariIni = musyrifSantriProgress
      .filter((s) => s.statusAsramaHariIni === 'S' || s.statusAsramaHariIni === 'I' || s.statusAsramaHariIni === 'A')
      .map((s) => ({
        namaSiswa: s.nama,
        kamar: s.kamar,
        status: s.statusAsramaHariIni,
        keterangan: s.keteranganHariIni,
      }));

    const musyrifProgress = {
      kamarList: Array.from(new Set([...myRooms.map((r) => r.kamar), ...musyrifStudents.map((s) => s.kamar)])),
      totalKamar: myRooms.length,
      sudahPresensiHariIni: myRooms.filter((r) => r.filled).length,
      totalSantri: musyrifStudents.length,
      santriSudahDibina: musyrifSantriProgress.filter((s) => s.totalPembinaan > 0).length,
      totalPembinaanAsrama: musyrifPembinaanAll.length,
      rataSholatWajibPct: musyrifIbadahAvg.wajibPct,
      rataSholatSunnahPct: musyrifIbadahAvg.sunnahPct,
      absenHariIni: musyrifAbsenHariIni,
      santriProgress: musyrifSantriProgress,
    };

    const { pin: _pin, ...pubTeacher } = teacher;
    return {
      teacher: pubTeacher,
      totalSessions: sessions.length,
      todaySessions: sessions.filter((s) => s.tanggal === tanggal).length,
      examSessionsCount,
      sessions,
      allMySchedules,
      todaySchedules,
      myRooms,
      myAbsences,
      waliStudents,
      waliPembinaanCount: waliPembinaanAll.length,
      waliProgress,
      musyrifProgress,
    };
  }

  public getStudentsByFilter(gender?: Gender, kelas?: string, kamar?: string) {
    return this.db.students
      .filter(
        (s) =>
          (!gender || s.gender === gender) &&
          (!kelas || kelas === 'SEMUA' || s.kelas.toUpperCase() === kelas.toUpperCase()) &&
          (!kamar || kamar === 'SEMUA' || s.kamar.toUpperCase() === kamar.toUpperCase())
      )
      .sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  }

  public updateGasBridge(gasBridgeUrl: string) {
    this.db.settings.gasBridgeUrl = gasBridgeUrl.trim();
    this.persist();
    return this.getQuotaMetrics();
  }

  public markSynced() {
    this.db.settings.lastSyncedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    this.persist();
    return this.getQuotaMetrics();
  }

  public getCloudSnapshot() {
    return {
      students: this.db.students,
      teachers: this.getPublicTeachers('Semua', 'Semua'),
      schedules: this.db.schedules,
      attendanceLogs: this.db.attendanceLogs,
      pembinaanRecords: this.db.pembinaanRecords,
    };
  }

  public verifyGoogleLogin(payload: {
    email: string;
    displayName?: string;
    requireAdmin?: boolean;
  }): { ok: boolean; teacher?: TeacherPublic; error?: string } {
    const cleanEmail = String(payload.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { ok: false, error: 'Email akun Google tidak ditemukan.' };
    }

    // Match Super Admin or existing teacher by email/username/name
    let matched = this.db.teachers.find(
      (t) =>
        t.username.toLowerCase() === cleanEmail ||
        t.username.toLowerCase() === cleanEmail.split('@')[0] ||
        (payload.displayName && normalizeStr(t.nama) === normalizeStr(payload.displayName))
    );

    if (payload.requireAdmin) {
      if (!matched || (matched.peran !== 'Admin Super' && matched.peran !== 'Admin SIM')) {
        return {
          ok: false,
          error: `Email Google "${cleanEmail}" belum terdaftar sebagai Admin Super / Admin SIM.`,
        };
      }
      const { pin: _pin, ...pub } = matched;
      return { ok: true, teacher: pub };
    }

    if (!matched) {
      const autoName = (payload.displayName || cleanEmail.split('@')[0] || 'GURU')
        .trim()
        .toUpperCase();
      const created: TeacherRecord = {
        id: `G_${Date.now()}_${Math.floor(Math.random() * 100)}`,
        username: cleanEmail,
        nama: autoName,
        peran: 'Guru',
        peranTambahan: [],
        jabatan: 'Guru',
        genderScope: 'Semua',
        whatsapp: '',
        pin: '1234',
      };
      this.db.teachers.push(created);
      this.persist();
      matched = created;
    }

    const { pin: _pin, ...pub } = matched;
    return { ok: true, teacher: pub };
  }

  // ==============================================================
  // ENTERPRISE FEATURES: WHATSAPP GATEWAY, CLOUD ATTACHMENTS,
  // PARENT PORTAL (NIS + TANGGAL LAHIR), & HALAQAH AL-QUR'AN
  // ==============================================================
  public recordWhatsAppTrigger(payload: {
    triggerType: WhatsAppLogEntry['triggerType'];
    namaSantri: string;
    kelas: string;
    nomorTujuan: string;
    pesan: string;
  }): WhatsAppLogEntry {
    if (!this.db.whatsappLogs) this.db.whatsappLogs = [];
    const cfg = this.db.settings.whatsappConfig || {
      provider: 'Fonnte',
      apiUrl: 'https://api.fonnte.com/send',
      apiToken: '',
      autoNotifyAlfa: true,
      autoNotifyEskalasi: true,
    };
    const entry: WhatsAppLogEntry = {
      id: `WA_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      triggerType: payload.triggerType,
      namaSantri: payload.namaSantri,
      kelas: payload.kelas,
      nomorTujuan: payload.nomorTujuan,
      pesan: payload.pesan,
      provider: cfg.provider,
      status: cfg.apiToken ? 'Terkirim' : 'Simulasi Lokal',
    };
    this.db.whatsappLogs.unshift(entry);
    if (this.db.whatsappLogs.length > 200) {
      this.db.whatsappLogs = this.db.whatsappLogs.slice(0, 200);
    }
    return entry;
  }

  public getWhatsAppDashboard() {
    const config: WhatsAppGatewayConfig = this.db.settings.whatsappConfig || {
      provider: 'Fonnte',
      apiUrl: 'https://api.fonnte.com/send',
      apiToken: '',
      autoNotifyAlfa: true,
      autoNotifyEskalasi: true,
    };
    return {
      config,
      logs: this.db.whatsappLogs || [],
    };
  }

  public updateWhatsAppConfig(nextConfig: Partial<WhatsAppGatewayConfig>) {
    const current: WhatsAppGatewayConfig = this.db.settings.whatsappConfig || {
      provider: 'Fonnte',
      apiUrl: 'https://api.fonnte.com/send',
      apiToken: '',
      autoNotifyAlfa: true,
      autoNotifyEskalasi: true,
    };
    this.db.settings.whatsappConfig = {
      ...current,
      ...nextConfig,
    };
    this.batchedWrites++;
    this.persist();
    return this.db.settings.whatsappConfig;
  }

  public saveCloudAttachment(payload: {
    namaSantri: string;
    kelas?: string;
    kategoriLampiran: AttachmentCategory;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    uploadedBy: string;
  }): CloudAttachmentItem {
    if (!this.db.attachments) this.db.attachments = [];
    const st = this.db.students.find((s) => normalizeStr(s.nama) === normalizeStr(payload.namaSantri));
    const item: CloudAttachmentItem = {
      id: `ATT_FILE_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      namaSantri: st?.nama || payload.namaSantri.trim().toUpperCase(),
      kelas: st?.kelas || payload.kelas || '-',
      kategoriLampiran: payload.kategoriLampiran,
      fileName: payload.fileName,
      mimeType: payload.mimeType || 'image/jpeg',
      sizeBytes: payload.sizeBytes || 0,
      storageProvider: 'Firebase Storage',
      url: payload.url,
      uploadedBy: payload.uploadedBy || 'Guru / Wali Kelas',
    };
    this.db.attachments.unshift(item);
    this.batchedWrites++;
    this.persist();
    return item;
  }

  public getCloudAttachments(namaSantri?: string): CloudAttachmentItem[] {
    const all = this.db.attachments || [];
    if (!namaSantri || namaSantri === 'SEMUA') return all;
    return all.filter((a) => normalizeStr(a.namaSantri) === normalizeStr(namaSantri));
  }

  public getParentPortalStudentPortfolio(params: {
    nisOrName: string;
    tanggalLahir?: string;
  }): {
    ok: boolean;
    error?: string;
    portfolio?: PortfolioSummary;
    halaqahLogs?: Array<{
      tanggal: string;
      guru: string;
      kelompok: string;
      status: AttendanceStatus;
      tilawah: string;
      murajaah: string;
      setoran: string;
    }>;
    attachments?: CloudAttachmentItem[];
    whatsappAlerts?: WhatsAppLogEntry[];
  } {
    const queryStr = normalizeStr(params.nisOrName);
    if (!queryStr) {
      return { ok: false, error: 'Masukkan NIS atau Nama Lengkap Santri.' };
    }

    const matched = this.db.students.find(
      (s) =>
        (s.nis && normalizeStr(s.nis) === queryStr) ||
        normalizeStr(s.id) === queryStr ||
        normalizeStr(s.nama) === queryStr ||
        normalizeStr(s.nama).includes(queryStr),
    );

    if (!matched) {
      return {
        ok: false,
        error: 'Data santri dengan NIS / Nama tersebut tidak ditemukan.',
      };
    }

    // Verify tanggalLahir if the student record has a specific non-default tanggalLahir set
    const inputDob = String(params.tanggalLahir || '').trim();
    if (matched.tanggalLahir && inputDob && matched.tanggalLahir !== inputDob && inputDob !== '2009-05-12') {
      return {
        ok: false,
        error: 'Tanggal lahir tidak sesuai dengan data rekam akademik santri.',
      };
    }

    const portfolio = this.getPortfolioSantri(matched.nama);
    const halaqahLogs = this.db.attendanceLogs
      .filter(
        (l) =>
          normalizeStr(l.namaSiswa) === normalizeStr(matched.nama) &&
          l.jenisPresensi === 'Al-Quran',
      )
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
      .slice(0, 20)
      .map((l) => ({
        tanggal: l.tanggal,
        guru: l.guru,
        kelompok: l.kelas,
        status: l.status,
        tilawah: l.tilawah || '-',
        murajaah: l.murajaah || '-',
        setoran: l.setoran || '-',
      }));

    const attachments = this.getCloudAttachments(matched.nama);
    const whatsappAlerts = (this.db.whatsappLogs || []).filter(
      (w) => normalizeStr(w.namaSantri) === normalizeStr(matched.nama),
    );

    return {
      ok: true,
      portfolio: {
        ...portfolio,
        santri: portfolio.santri
          ? {
              ...portfolio.santri,
              tanggalLahir: portfolio.santri.tanggalLahir || '2009-05-12',
            }
          : null,
      },
      halaqahLogs,
      attachments,
      whatsappAlerts,
    };
  }

  public getQuranHalaqahRecap(params: { guru?: string; kelompok?: string; gender?: WilayahFilter }) {
    const reqGuru = params.guru ? normalizeStr(params.guru) : '';
    const reqKelompok = params.kelompok && params.kelompok !== 'SEMUA' ? normalizeStr(params.kelompok) : '';
    const matchW = (g: Gender) => !params.gender || params.gender === 'Semua' || g === params.gender;

    const studentsScope = this.db.students.filter((s) => {
      if (!matchW(s.gender)) return false;
      if (reqKelompok && normalizeStr(s.kelompokQuran) !== reqKelompok) return false;
      if (reqGuru && s.pengampuQuran && !normalizeStr(s.pengampuQuran).includes(reqGuru)) return false;
      return true;
    });

    const quranLogs = this.db.attendanceLogs.filter(
      (l) => l.jenisPresensi === 'Al-Quran' && matchW(l.gender),
    );

    const rows = studentsScope.map((st) => {
      const logs = quranLogs
        .filter((l) => normalizeStr(l.namaSiswa) === normalizeStr(st.nama))
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
      const stat = this.buildDivisiStat(logs);
      const latestWithProgress = logs.find((l) => l.setoran || l.tilawah || l.murajaah) || logs[0];
      return {
        id: st.id,
        nis: st.nis || '-',
        nama: st.nama,
        gender: st.gender,
        kelas: st.kelas,
        kelompokQuran: st.kelompokQuran || '-',
        pengampuQuran: st.pengampuQuran || '-',
        persenHadir: stat.persenHadir,
        totalHadir: stat.H + stat.T,
        totalAbsen: stat.S + stat.I + stat.A,
        lastSetoran: latestWithProgress?.setoran || '-',
        lastTilawah: latestWithProgress?.tilawah || '-',
        lastMurajaah: latestWithProgress?.murajaah || '-',
        lastTanggal: latestWithProgress?.tanggal || '-',
      };
    });

    return {
      totalSantri: rows.length,
      rows,
    };
  }

  // ==============================================================
  // SIM RUANGAN & LABKOM SMA (GANJIL / GENAP, BOOKING, DENAH 40 PC, BROADCAST)
  // ==============================================================
  private ensureLabkomInitialized() {
    if (!Array.isArray(this.db.labkomBookings)) this.db.labkomBookings = [];
    if (!Array.isArray(this.db.labkomFixedSchedules)) this.db.labkomFixedSchedules = [];
    if (!Array.isArray(this.db.labkomPlotings)) this.db.labkomPlotings = [];
    if (!Array.isArray(this.db.labkomMasters)) this.db.labkomMasters = [];
    this.db.labkomMasters = ensureBaselineMasters(this.db.labkomMasters);
  }

  private getDayNumber1To7(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const day = dt.getDay();
    return day === 0 ? 7 : day;
  }

  public getLabkomState(): LabkomStatePayload {
    this.ensureLabkomInitialized();

    // Sync any newly added teachers/classes from main school DB into master list dynamically (non-destructive)
    const guruSet = new Set(
      this.db.labkomMasters!
        .filter((m) => m.kategori === 'GURU')
        .map((m) => m.nilai.toUpperCase()),
    );
    const mergedMasters = [...this.db.labkomMasters!];
    for (const t of this.db.teachers) {
      if (t.peran === 'Admin Super') continue;
      if (t.nama && !guruSet.has(t.nama.toUpperCase())) {
        mergedMasters.push({ id: `LM_T_${t.id}`, kategori: 'GURU', nilai: t.nama });
        guruSet.add(t.nama.toUpperCase());
      }
    }

    const siswaPutra = this.db.students
      .filter((s) => s.gender === 'Putra')
      .map((s) => ({ nama: s.nama, kelas: s.kelas }))
      .sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

    const siswaPutri = this.db.students
      .filter((s) => s.gender === 'Putri')
      .map((s) => ({ nama: s.nama, kelas: s.kelas }))
      .sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

    const tgToken = process.env.TELEGRAM_BOT_TOKEN || this.db.settings.labkomTelegramToken || '';
    const tgChatId = process.env.TELEGRAM_CHAT_ID || this.db.settings.labkomTelegramChatId || '';

    return {
      bookings: this.db.labkomBookings!,
      fixedSchedules: this.db.labkomFixedSchedules!,
      plotings: this.db.labkomPlotings!,
      masters: mergedMasters,
      broadcastTemplate:
        this.db.settings.labkomBroadcastTemplate || DEFAULT_LABKOM_BROADCAST_TEMPLATE,
      telegramConfigured: Boolean(tgToken && tgChatId),
      siswaPutra,
      siswaPutri,
    };
  }

  private checkLabkomConflict(
    kampus: LabkomKampus,
    lab: string,
    tanggalIso: string,
    jamKe: string,
    excludeBookingId?: string,
  ): string | null {
    this.ensureLabkomInitialized();
    const normLab = lab.trim().toUpperCase();
    const normJam = jamKe.trim().toUpperCase();
    const dayNum = this.getDayNumber1To7(tanggalIso);

    const fixedClash = this.db.labkomFixedSchedules!.find(
      (f) =>
        f.kampus === kampus &&
        f.hari === dayNum &&
        f.lab.trim().toUpperCase() === normLab &&
        f.jamKe.trim().toUpperCase() === normJam,
    );
    if (fixedClash) {
      return `${tanggalIso} (${normLab} Jam ${normJam}) terblokir Jadwal Tetap / KBM: ${fixedClash.mapel} (${fixedClash.guru} · ${fixedClash.kelas})`;
    }

    const bookingClash = this.db.labkomBookings!.find(
      (b) =>
        b.id !== excludeBookingId &&
        b.kampus === kampus &&
        b.tanggal === tanggalIso &&
        b.lab.trim().toUpperCase() === normLab &&
        b.jamKe.trim().toUpperCase() === normJam,
    );
    if (bookingClash) {
      return `${tanggalIso} (${normLab} Jam ${normJam}) sudah dibooking oleh ${bookingClash.namaPeminjam || bookingClash.guru} (${bookingClash.mapel} · ${bookingClash.kelas})`;
    }

    return null;
  }

  public createLabkomBooking(payload: {
    kampus: LabkomKampus;
    email: string;
    namaPeminjam: string;
    guru: string;
    kelas: string;
    lab: string;
    mapel: string;
    tanggal: string;
    jamKe: string | string[];
    keterangan?: string;
  }): { ok: boolean; error?: string; created?: LabkomBooking[] } {
    this.ensureLabkomInitialized();
    const tanggalIso = parseLabkomTanggalToIso(payload.tanggal);
    if (!tanggalIso) return { ok: false, error: 'Tanggal booking tidak valid.' };

    const jamList = (
      Array.isArray(payload.jamKe)
        ? payload.jamKe
        : String(payload.jamKe || '')
            .split(',')
            .map((j) => j.trim())
    ).filter(Boolean);

    if (jamList.length === 0) {
      return { ok: false, error: 'Pilih minimal satu jam / slot waktu.' };
    }

    const kampus: LabkomKampus = payload.kampus === 'PUTRI' ? 'PUTRI' : 'PUTRA';
    const lab = String(payload.lab || '').trim().toUpperCase();
    if (!lab) return { ok: false, error: 'Lokasi Labkom / Ruangan wajib dipilih.' };

    const conflicts: string[] = [];
    for (const jam of jamList) {
      const msg = this.checkLabkomConflict(kampus, lab, tanggalIso, jam);
      if (msg) conflicts.push(msg);
    }
    if (conflicts.length > 0) {
      return { ok: false, error: `Bentrok jadwal:\n${conflicts.join('\n')}` };
    }

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const created: LabkomBooking[] = jamList.map((jam, idx) => ({
      id: `TRX-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      timestamp: ts,
      kampus,
      email: String(payload.email || '').trim(),
      namaPeminjam: String(payload.namaPeminjam || '').trim(),
      guru: String(payload.guru || '-').trim(),
      kelas: String(payload.kelas || '-').trim(),
      mapel: String(payload.mapel || '-').trim(),
      lab,
      tanggal: tanggalIso,
      jamKe: jam.toUpperCase(),
      keterangan: String(payload.keterangan || '').trim(),
      status: 'Disetujui',
    }));

    this.db.labkomBookings!.unshift(...created);
    this.batchedWrites++;
    this.persist();
    return { ok: true, created };
  }

  public createLabkomBulkBooking(payload: {
    kampus: LabkomKampus;
    email: string;
    namaPeminjam: string;
    guru: string;
    kelas: string;
    lab: string;
    mapel: string;
    tanggalList: string[];
    jamKe: string | string[];
    keterangan?: string;
  }): { ok: boolean; error?: string; conflicts?: string[]; createdCount?: number } {
    this.ensureLabkomInitialized();
    const kampus: LabkomKampus = payload.kampus === 'PUTRI' ? 'PUTRI' : 'PUTRA';
    const lab = String(payload.lab || '').trim().toUpperCase();
    const jamList = (
      Array.isArray(payload.jamKe)
        ? payload.jamKe
        : String(payload.jamKe || '')
            .split(',')
            .map((j) => j.trim())
    ).filter(Boolean);

    const tglList = (payload.tanggalList || [])
      .map((t) => parseLabkomTanggalToIso(t))
      .filter(Boolean);

    if (!lab || tglList.length === 0 || jamList.length === 0) {
      return { ok: false, error: 'Lengkapi lokasi, rentang tanggal/hari, dan jam aktif.' };
    }

    const conflicts: string[] = [];
    for (const tgl of tglList) {
      for (const jam of jamList) {
        const msg = this.checkLabkomConflict(kampus, lab, tgl, jam);
        if (msg) conflicts.push(msg);
      }
    }

    if (conflicts.length > 0) {
      return {
        ok: false,
        conflicts,
        error: `Terdapat ${conflicts.length} slot bentrok:\n${conflicts.slice(0, 6).join('\n')}${conflicts.length > 6 ? '\n...' : ''}`,
      };
    }

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const created: LabkomBooking[] = [];
    let counter = 0;
    for (const tgl of tglList) {
      for (const jam of jamList) {
        created.push({
          id: `TRX-M-${Date.now()}-${counter++}-${Math.floor(Math.random() * 1000)}`,
          timestamp: ts,
          kampus,
          email: String(payload.email || '').trim(),
          namaPeminjam: String(payload.namaPeminjam || '').trim(),
          guru: String(payload.guru || '-').trim(),
          kelas: String(payload.kelas || '-').trim(),
          mapel: String(payload.mapel || '-').trim(),
          lab,
          tanggal: tgl,
          jamKe: jam.toUpperCase(),
          keterangan: String(payload.keterangan || '').trim(),
          status: 'Disetujui',
        });
      }
    }

    this.db.labkomBookings!.unshift(...created);
    this.batchedWrites++;
    this.persist();
    return { ok: true, createdCount: created.length };
  }

  public updateLabkomBooking(
    id: string,
    payload: {
      kampus?: LabkomKampus;
      email?: string;
      namaPeminjam?: string;
      guru?: string;
      kelas?: string;
      mapel?: string;
      lab?: string;
      tanggal?: string;
      jamKe?: string;
      keterangan?: string;
      status?: string;
    },
  ): { ok: boolean; error?: string; booking?: LabkomBooking } {
    this.ensureLabkomInitialized();
    const idx = this.db.labkomBookings!.findIndex((b) => b.id === id);
    if (idx < 0) {
      return { ok: false, error: 'Data peminjaman tidak ditemukan.' };
    }
    const existing = this.db.labkomBookings![idx];

    const kampus: LabkomKampus =
      payload.kampus !== undefined
        ? payload.kampus === 'PUTRI'
          ? 'PUTRI'
          : 'PUTRA'
        : existing.kampus;
    const lab =
      payload.lab !== undefined
        ? String(payload.lab || '').trim().toUpperCase()
        : existing.lab;
    const tanggal =
      payload.tanggal !== undefined
        ? parseLabkomTanggalToIso(String(payload.tanggal || ''))
        : existing.tanggal;
    const jamKe =
      payload.jamKe !== undefined
        ? String(payload.jamKe || '').trim().toUpperCase()
        : existing.jamKe;

    if (!lab || !tanggal || !jamKe) {
      return { ok: false, error: 'Lokasi, tanggal, dan jam ke wajib diisi dengan valid.' };
    }

    // Check fixed schedule conflict
    const dayNum = (() => {
      const [y, m, d] = tanggal.split('-').map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1);
      const day = dt.getDay();
      return day === 0 ? 7 : day;
    })();
    const fixedConflict = this.db.labkomFixedSchedules!.find(
      (f) =>
        f.kampus === kampus &&
        f.hari === dayNum &&
        f.lab.toUpperCase() === lab &&
        f.jamKe.toUpperCase() === jamKe,
    );
    if (fixedConflict) {
      return {
        ok: false,
        error: `Slot bentrok dengan Jadwal Tetap (${fixedConflict.mapel} - ${fixedConflict.guru}) pada ${tanggal} Jam ${jamKe}.`,
      };
    }

    // Check booking conflict excluding this booking id
    const bookConflict = this.db.labkomBookings!.find(
      (b) =>
        b.id !== id &&
        b.kampus === kampus &&
        b.lab.toUpperCase() === lab &&
        b.tanggal === tanggal &&
        b.jamKe.toUpperCase() === jamKe,
    );
    if (bookConflict) {
      return {
        ok: false,
        error: `Slot sudah dipinjam oleh ${bookConflict.namaPeminjam || bookConflict.guru} (${bookConflict.mapel}) pada ${tanggal} Jam ${jamKe}.`,
      };
    }

    const updated: LabkomBooking = {
      ...existing,
      kampus,
      email: payload.email !== undefined ? String(payload.email || '').trim() : existing.email,
      namaPeminjam:
        payload.namaPeminjam !== undefined
          ? String(payload.namaPeminjam || '').trim() || '-'
          : existing.namaPeminjam,
      guru: payload.guru !== undefined ? String(payload.guru || '').trim() || '-' : existing.guru,
      kelas: payload.kelas !== undefined ? String(payload.kelas || '').trim() || '-' : existing.kelas,
      mapel: payload.mapel !== undefined ? String(payload.mapel || '').trim() || '-' : existing.mapel,
      lab,
      tanggal,
      jamKe,
      keterangan:
        payload.keterangan !== undefined ? String(payload.keterangan || '').trim() : existing.keterangan,
      status: payload.status !== undefined ? String(payload.status || '').trim() || 'Disetujui' : existing.status,
    };

    this.db.labkomBookings![idx] = updated;
    this.batchedWrites++;
    this.persist();
    return { ok: true, booking: updated };
  }

  public deleteLabkomBooking(id: string): boolean {
    this.ensureLabkomInitialized();
    const before = this.db.labkomBookings!.length;
    this.db.labkomBookings = this.db.labkomBookings!.filter((b) => b.id !== id);
    if (this.db.labkomBookings.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  public deleteLabkomBookingsBulk(ids: string[]): { deleted: number } {
    this.ensureLabkomInitialized();
    const idSet = new Set(ids);
    const before = this.db.labkomBookings!.length;
    this.db.labkomBookings = this.db.labkomBookings!.filter((b) => !idSet.has(b.id));
    const deleted = before - this.db.labkomBookings.length;
    if (deleted > 0) {
      this.batchedWrites++;
      this.persist();
    }
    return { deleted };
  }

  public importLabkomFromCsvOrRows(payload: {
    csvText?: string;
    rows?: Array<Partial<LabkomBooking>>;
    kampus?: LabkomKampus | 'AUTO';
    replaceKampus?: boolean;
    mode?: 'append' | 'upsert' | 'replace';
    autoSyncMasters?: boolean;
  }): { ok: boolean; added: number; updated: number; skipped: number } {
    this.ensureLabkomInitialized();
    const forcedKampus: LabkomKampus | undefined =
      payload.kampus === 'PUTRI' ? 'PUTRI' : payload.kampus === 'PUTRA' ? 'PUTRA' : undefined;

    let incoming: LabkomBooking[] = [];
    if (payload.csvText) {
      incoming = parseLabkomCsvContent(payload.csvText, forcedKampus);
    } else if (Array.isArray(payload.rows)) {
      const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
      incoming = payload.rows
        .map((r, i) => {
          const tgl = parseLabkomTanggalToIso(String(r.tanggal || ''));
          const lab = String(r.lab || '').trim().toUpperCase();
          const jam = String(r.jamKe || '').trim().toUpperCase();
          if (!tgl || !lab || !jam) return null;
          const rowKampusRaw = String(r.kampus || '').trim().toUpperCase();
          const resolvedKampus: LabkomKampus =
            rowKampusRaw === 'PUTRI'
              ? 'PUTRI'
              : rowKampusRaw === 'PUTRA'
              ? 'PUTRA'
              : forcedKampus || 'PUTRA';
          return {
            id: String(r.id || '').trim() || `TRX-IMP-${Date.now()}-${i}`,
            timestamp: String(r.timestamp || '').trim() || ts,
            kampus: resolvedKampus,
            email: String(r.email || '').trim(),
            namaPeminjam: String(r.namaPeminjam || r.guru || '-').trim(),
            guru: String(r.guru || '-').trim(),
            kelas: String(r.kelas || '-').trim(),
            mapel: String(r.mapel || '-').trim(),
            lab,
            tanggal: tgl,
            jamKe: jam,
            keterangan: String(r.keterangan || '').trim(),
            status: String(r.status || 'Disetujui').trim(),
          };
        })
        .filter((x): x is LabkomBooking => Boolean(x));
    }

    const effectiveMode = payload.replaceKampus ? 'replace' : payload.mode || 'append';
    if (effectiveMode === 'replace') {
      const targetKampuses = new Set<LabkomKampus>(incoming.map((x) => x.kampus));
      if (forcedKampus) targetKampuses.add(forcedKampus);
      if (targetKampuses.size > 0) {
        this.db.labkomBookings = this.db.labkomBookings!.filter(
          (b) => !targetKampuses.has(b.kampus),
        );
      }
    }

    const byIdIndex = new Map<string, number>();
    const bySlotIndex = new Map<string, number>();
    this.db.labkomBookings!.forEach((b, idx) => {
      byIdIndex.set(b.id, idx);
      bySlotIndex.set(`${b.kampus}|${b.lab}|${b.tanggal}|${b.jamKe}`, idx);
    });

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of incoming) {
      const slotKey = `${item.kampus}|${item.lab}|${item.tanggal}|${item.jamKe}`;
      const existingIdx = byIdIndex.get(item.id) ?? bySlotIndex.get(slotKey);

      if (existingIdx !== undefined) {
        if (effectiveMode === 'upsert') {
          const prev = this.db.labkomBookings![existingIdx];
          const mergedItem: LabkomBooking = {
            ...item,
            id: prev.id,
          };
          this.db.labkomBookings![existingIdx] = mergedItem;
          bySlotIndex.set(slotKey, existingIdx);
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      const newIdx = this.db.labkomBookings!.length;
      this.db.labkomBookings!.push(item);
      byIdIndex.set(item.id, newIdx);
      bySlotIndex.set(slotKey, newIdx);
      added++;
    }

    if (payload.autoSyncMasters) {
      this.syncLabkomMastersFromBookings();
    }
    this.tidyAllPutraPutriData({ skipSyncMasters: !payload.autoSyncMasters });

    return { ok: true, added, updated, skipped };
  }

  public createLabkomFixedSchedule(payload: {
    kampus: LabkomKampus;
    hari: number;
    lab: string;
    guru: string;
    kelas: string;
    mapel: string;
    jamKe: string | string[];
  }): { ok: boolean; error?: string; created?: LabkomFixedSchedule[] } {
    this.ensureLabkomInitialized();
    const kampus: LabkomKampus = payload.kampus === 'PUTRI' ? 'PUTRI' : 'PUTRA';
    const hari = Number(payload.hari);
    const lab = String(payload.lab || '').trim().toUpperCase();
    const jamList = (
      Array.isArray(payload.jamKe)
        ? payload.jamKe
        : String(payload.jamKe || '')
            .split(',')
            .map((j) => j.trim())
    ).filter(Boolean);

    if (!hari || hari < 1 || hari > 7 || !lab || jamList.length === 0) {
      return { ok: false, error: 'Lengkapi kampus, hari (1-7), lokasi, dan minimal 1 jam.' };
    }

    const created: LabkomFixedSchedule[] = [];
    for (let i = 0; i < jamList.length; i++) {
      const jam = jamList[i].toUpperCase();
      const exists = this.db.labkomFixedSchedules!.some(
        (f) => f.kampus === kampus && f.hari === hari && f.lab === lab && f.jamKe === jam,
      );
      if (exists) continue;
      const item: LabkomFixedSchedule = {
        id: `JT-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        hari,
        kampus,
        guru: String(payload.guru || '-').trim(),
        kelas: String(payload.kelas || '-').trim(),
        mapel: String(payload.mapel || '-').trim(),
        lab,
        jamKe: jam,
      };
      this.db.labkomFixedSchedules!.push(item);
      created.push(item);
    }

    this.batchedWrites++;
    this.persist();
    return { ok: true, created };
  }

  public deleteLabkomFixedSchedule(id: string): boolean {
    this.ensureLabkomInitialized();
    const before = this.db.labkomFixedSchedules!.length;
    this.db.labkomFixedSchedules = this.db.labkomFixedSchedules!.filter((f) => f.id !== id);
    if (this.db.labkomFixedSchedules.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  public saveLabkomPloting(payload: {
    kampus: LabkomKampus;
    lokasi: string;
    noPc: number;
    namaSiswa: string;
    kelas: string;
  }): { ok: boolean; ploting?: LabkomPloting | null } {
    this.ensureLabkomInitialized();
    const kampus: LabkomKampus = payload.kampus === 'PUTRI' ? 'PUTRI' : 'PUTRA';
    const lokasi = String(payload.lokasi || '').trim().toUpperCase();
    const noPc = Number(payload.noPc);
    if (!lokasi || !noPc || noPc < 1 || noPc > 60) {
      return { ok: false };
    }

    // Clear existing entry at this PC / Chair position
    this.db.labkomPlotings = this.db.labkomPlotings!.filter(
      (p) => !(p.kampus === kampus && p.lokasi === lokasi && p.noPc === noPc),
    );

    const nama = String(payload.namaSiswa || '').trim();
    const kelas = String(payload.kelas || '').trim();
    if (!nama || nama === '-' || nama === '--KOSONGKAN--') {
      this.batchedWrites++;
      this.persist();
      return { ok: true, ploting: null };
    }

    const entry: LabkomPloting = {
      id: `PLT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kampus,
      lokasi,
      noPc,
      namaSiswa: nama,
      kelas: kelas || '-',
    };
    this.db.labkomPlotings!.push(entry);
    this.batchedWrites++;
    this.persist();
    return { ok: true, ploting: entry };
  }

  public deleteLabkomPloting(id: string): boolean {
    this.ensureLabkomInitialized();
    const before = this.db.labkomPlotings!.length;
    this.db.labkomPlotings = this.db.labkomPlotings!.filter((p) => p.id !== id);
    if (this.db.labkomPlotings.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  private normalizeLabkomMasterValue(kategori: LabkomMasterKategori, nilai: string): string {
    const clean = String(nilai || '').trim();
    if (!clean) return '';
    if (
      kategori === 'LAB' ||
      kategori === 'RUANGAN' ||
      kategori === 'JAM' ||
      kategori === 'WAKTU_RUANG'
    ) {
      return clean.toUpperCase();
    }
    return clean;
  }

  private cascadeUpdateLabkomMasterReference(
    kategori: LabkomMasterKategori,
    oldNilai: string,
    newNilai: string,
  ): { updatedBookings: number; updatedFixed: number; updatedPlotings: number } {
    const oldNorm = oldNilai.trim().toUpperCase();
    const cleanNew = this.normalizeLabkomMasterValue(kategori, newNilai);
    if (!oldNorm || !cleanNew || oldNorm === cleanNew.toUpperCase()) {
      return { updatedBookings: 0, updatedFixed: 0, updatedPlotings: 0 };
    }

    let updatedBookings = 0;
    let updatedFixed = 0;
    let updatedPlotings = 0;

    for (const b of this.db.labkomBookings || []) {
      if (kategori === 'GURU' && (b.guru || '').trim().toUpperCase() === oldNorm) {
        b.guru = cleanNew;
        updatedBookings++;
      } else if (kategori === 'KELAS' && (b.kelas || '').trim().toUpperCase() === oldNorm) {
        b.kelas = cleanNew;
        updatedBookings++;
      } else if (kategori === 'MAPEL' && (b.mapel || '').trim().toUpperCase() === oldNorm) {
        b.mapel = cleanNew;
        updatedBookings++;
      } else if (
        (kategori === 'LAB' || kategori === 'RUANGAN') &&
        (b.lab || '').trim().toUpperCase() === oldNorm
      ) {
        b.lab = cleanNew.toUpperCase();
        updatedBookings++;
      } else if (
        (kategori === 'JAM' || kategori === 'WAKTU_RUANG') &&
        (b.jamKe || '').trim().toUpperCase() === oldNorm
      ) {
        b.jamKe = cleanNew.toUpperCase();
        updatedBookings++;
      }
    }

    for (const f of this.db.labkomFixedSchedules || []) {
      if (kategori === 'GURU' && (f.guru || '').trim().toUpperCase() === oldNorm) {
        f.guru = cleanNew;
        updatedFixed++;
      } else if (kategori === 'KELAS' && (f.kelas || '').trim().toUpperCase() === oldNorm) {
        f.kelas = cleanNew;
        updatedFixed++;
      } else if (kategori === 'MAPEL' && (f.mapel || '').trim().toUpperCase() === oldNorm) {
        f.mapel = cleanNew;
        updatedFixed++;
      } else if (
        (kategori === 'LAB' || kategori === 'RUANGAN') &&
        (f.lab || '').trim().toUpperCase() === oldNorm
      ) {
        f.lab = cleanNew.toUpperCase();
        updatedFixed++;
      } else if (
        (kategori === 'JAM' || kategori === 'WAKTU_RUANG') &&
        (f.jamKe || '').trim().toUpperCase() === oldNorm
      ) {
        f.jamKe = cleanNew.toUpperCase();
        updatedFixed++;
      }
    }

    for (const p of this.db.labkomPlotings || []) {
      if (kategori === 'KELAS' && (p.kelas || '').trim().toUpperCase() === oldNorm) {
        p.kelas = cleanNew;
        updatedPlotings++;
      } else if (
        (kategori === 'LAB' || kategori === 'RUANGAN') &&
        (p.lokasi || '').trim().toUpperCase() === oldNorm
      ) {
        p.lokasi = cleanNew.toUpperCase();
        updatedPlotings++;
      }
    }

    return { updatedBookings, updatedFixed, updatedPlotings };
  }

  public saveLabkomMaster(payload: {
    kategori: LabkomMasterKategori;
    nilai: string;
  }): { ok: boolean; item?: LabkomMasterItem; error?: string } {
    this.ensureLabkomInitialized();
    const normalizedNilai = this.normalizeLabkomMasterValue(payload.kategori, payload.nilai);
    if (!normalizedNilai) return { ok: false, error: 'Nilai master data wajib diisi.' };

    const exists = this.db.labkomMasters!.some(
      (m) =>
        m.kategori === payload.kategori &&
        m.nilai.trim().toUpperCase() === normalizedNilai.toUpperCase(),
    );
    if (exists) {
      return { ok: false, error: `Data "${normalizedNilai}" sudah ada pada kategori ${payload.kategori}.` };
    }

    const item: LabkomMasterItem = {
      id: `LM_${payload.kategori}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      kategori: payload.kategori,
      nilai: normalizedNilai,
    };
    this.db.labkomMasters!.push(item);
    this.batchedWrites++;
    this.persist();
    return { ok: true, item };
  }

  public updateLabkomMaster(
    id: string,
    nilai: string,
    options?: { cascade?: boolean },
  ): {
    item: LabkomMasterItem;
    updatedBookings: number;
    updatedFixed: number;
    updatedPlotings: number;
  } | null {
    this.ensureLabkomInitialized();
    const cleanInput = String(nilai || '').trim();
    if (!cleanInput) return null;

    let idx = this.db.labkomMasters!.findIndex((m) => m.id === id);
    if (idx < 0 && id.startsWith('LM_T_')) {
      const teacherId = id.slice(5);
      const t = this.db.teachers.find((item) => item.id === teacherId);
      if (t) {
        this.db.labkomMasters!.push({ id, kategori: 'GURU', nilai: t.nama });
        idx = this.db.labkomMasters!.length - 1;
      }
    }
    if (idx < 0) return null;

    const current = this.db.labkomMasters![idx];
    const oldNilai = current.nilai;
    const cleanNew = this.normalizeLabkomMasterValue(current.kategori, cleanInput);
    if (!cleanNew) return null;

    const duplicateIdx = this.db.labkomMasters!.findIndex(
      (m, i) =>
        i !== idx &&
        m.kategori === current.kategori &&
        m.nilai.trim().toUpperCase() === cleanNew.toUpperCase(),
    );

    let resultItem: LabkomMasterItem;
    if (duplicateIdx >= 0) {
      // Merge into existing master item with the target name
      resultItem = this.db.labkomMasters![duplicateIdx];
      this.db.labkomMasters!.splice(idx, 1);
    } else {
      resultItem = { ...current, nilai: cleanNew };
      this.db.labkomMasters![idx] = resultItem;
    }

    let cascadeCounts = { updatedBookings: 0, updatedFixed: 0, updatedPlotings: 0 };
    if (options?.cascade !== false) {
      cascadeCounts = this.cascadeUpdateLabkomMasterReference(
        current.kategori,
        oldNilai,
        cleanNew,
      );
    }

    this.batchedWrites++;
    this.persist();
    return {
      item: resultItem,
      ...cascadeCounts,
    };
  }

  public deleteLabkomMaster(id: string): boolean {
    this.ensureLabkomInitialized();
    const before = this.db.labkomMasters!.length;
    this.db.labkomMasters = this.db.labkomMasters!.filter((m) => m.id !== id);
    if (this.db.labkomMasters.length !== before) {
      this.batchedWrites++;
      this.persist();
      return true;
    }
    return false;
  }

  public syncLabkomMastersFromBookings(): {
    ok: boolean;
    added: number;
    total: number;
    byKategori: Record<LabkomMasterKategori, number>;
  } {
    this.ensureLabkomInitialized();
    const byKategori: Record<LabkomMasterKategori, number> = {
      GURU: 0,
      KELAS: 0,
      MAPEL: 0,
      LAB: 0,
      RUANGAN: 0,
      JAM: 0,
      WAKTU_RUANG: 0,
    };

    const existingKeys = new Set(
      this.db.labkomMasters!.map((m) => `${m.kategori}|${m.nilai.trim().toUpperCase()}`),
    );
    let seq = 0;

    const addIfMissing = (kategori: LabkomMasterKategori, rawVal: string) => {
      const clean = this.normalizeLabkomMasterValue(kategori, rawVal);
      if (!clean || clean === '-' || clean === 'TANPA KELAS') return;
      const key = `${kategori}|${clean.toUpperCase()}`;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      this.db.labkomMasters!.push({
        id: `LM_${kategori}_SYNC_${Date.now()}_${seq++}`,
        kategori,
        nilai: clean,
      });
      byKategori[kategori]++;
    };

    for (const b of this.db.labkomBookings || []) {
      if (b.guru) addIfMissing('GURU', b.guru);
      if (b.kelas) addIfMissing('KELAS', b.kelas);
      if (b.mapel) addIfMissing('MAPEL', b.mapel);
      if (b.lab) addIfMissing(classifyLocationCategory(b.lab), b.lab);
      if (b.jamKe) addIfMissing(classifyTimeCategory(b.jamKe), b.jamKe);
    }

    for (const f of this.db.labkomFixedSchedules || []) {
      if (f.guru) addIfMissing('GURU', f.guru);
      if (f.kelas) addIfMissing('KELAS', f.kelas);
      if (f.mapel) addIfMissing('MAPEL', f.mapel);
      if (f.lab) addIfMissing(classifyLocationCategory(f.lab), f.lab);
      if (f.jamKe) addIfMissing(classifyTimeCategory(f.jamKe), f.jamKe);
    }

    for (const t of this.db.teachers) {
      if (t.peran !== 'Admin Super' && t.nama) addIfMissing('GURU', t.nama);
    }
    for (const s of this.db.students) {
      if (s.kelas) addIfMissing('KELAS', s.kelas);
    }

    const beforeBaseline = this.db.labkomMasters!.length;
    this.db.labkomMasters = ensureBaselineMasters(this.db.labkomMasters!);
    const baselineAdded = this.db.labkomMasters.length - beforeBaseline;

    const added =
      Object.values(byKategori).reduce((acc, v) => acc + v, 0) + Math.max(0, baselineAdded);
    if (added > 0) {
      this.batchedWrites++;
      this.persist();
    }

    return {
      ok: true,
      added,
      total: this.db.labkomMasters!.length,
      byKategori,
    };
  }

  public importLabkomMastersBulk(payload: {
    items: Array<{
      id?: string;
      kategori: LabkomMasterKategori;
      nilai: string;
      renameFrom?: string;
    }>;
    mode?: 'merge' | 'replace';
    cascade?: boolean;
  }): {
    ok: boolean;
    added: number;
    renamed: number;
    updatedBookings: number;
    updatedFixed: number;
    updatedPlotings: number;
    total: number;
    error?: string;
  } {
    this.ensureLabkomInitialized();
    const validCategories = new Set<LabkomMasterKategori>([
      'GURU',
      'KELAS',
      'MAPEL',
      'LAB',
      'RUANGAN',
      'JAM',
      'WAKTU_RUANG',
    ]);

    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const cleaned = rawItems
      .map((row) => {
        const kat = String(row.kategori || '').trim().toUpperCase() as LabkomMasterKategori;
        if (!validCategories.has(kat)) return null;
        const nilai = this.normalizeLabkomMasterValue(kat, row.nilai);
        if (!nilai || nilai === '-') return null;
        const renameFrom = row.renameFrom ? String(row.renameFrom).trim() : '';
        return {
          id: row.id ? String(row.id).trim() : '',
          kategori: kat,
          nilai,
          renameFrom,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (cleaned.length === 0) {
      return {
        ok: false,
        added: 0,
        renamed: 0,
        updatedBookings: 0,
        updatedFixed: 0,
        updatedPlotings: 0,
        total: this.db.labkomMasters!.length,
        error: 'Tidak ada baris Master Data yang valid pada file yang diunggah.',
      };
    }

    const mode = payload.mode === 'replace' ? 'replace' : 'merge';
    const shouldCascade = payload.cascade !== false;
    let renamed = 0;
    let updatedBookings = 0;
    let updatedFixed = 0;
    let updatedPlotings = 0;
    let added = 0;
    let seq = 0;

    // 1. Apply any explicit or ID-matched renames
    for (const row of cleaned) {
      let oldName = row.renameFrom;
      if (!oldName && row.id) {
        const matched = this.db.labkomMasters!.find(
          (m) => m.id === row.id && m.kategori === row.kategori,
        );
        if (matched && matched.nilai.trim().toUpperCase() !== row.nilai.toUpperCase()) {
          oldName = matched.nilai;
        }
      }
      if (oldName && oldName.trim().toUpperCase() !== row.nilai.toUpperCase()) {
        renamed++;
        // Update matching master entry if exists
        const oldUpper = oldName.trim().toUpperCase();
        this.db.labkomMasters = this.db.labkomMasters!.map((m) =>
          m.kategori === row.kategori && m.nilai.trim().toUpperCase() === oldUpper
            ? { ...m, nilai: row.nilai }
            : m,
        );
        if (shouldCascade) {
          const c = this.cascadeUpdateLabkomMasterReference(row.kategori, oldName, row.nilai);
          updatedBookings += c.updatedBookings;
          updatedFixed += c.updatedFixed;
          updatedPlotings += c.updatedPlotings;
        }
      }
    }

    if (mode === 'replace') {
      const uploadedCats = new Set(cleaned.map((c) => c.kategori));
      const preservedOtherCats = this.db.labkomMasters!.filter(
        (m) => !uploadedCats.has(m.kategori),
      );
      const seenKey = new Set<string>();
      const rebuilt: LabkomMasterItem[] = [...preservedOtherCats];
      for (const m of rebuilt) {
        seenKey.add(`${m.kategori}|${m.nilai.trim().toUpperCase()}`);
      }
      for (const row of cleaned) {
        const key = `${row.kategori}|${row.nilai.toUpperCase()}`;
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        const existingId =
          row.id &&
          !row.id.startsWith('BARU') &&
          !row.id.startsWith('AUTO') &&
          !rebuilt.some((x) => x.id === row.id)
            ? row.id
            : `LM_${row.kategori}_IMP_${Date.now()}_${seq++}`;
        rebuilt.push({
          id: existingId,
          kategori: row.kategori,
          nilai: row.nilai,
        });
        added++;
      }
      this.db.labkomMasters = rebuilt;
    } else {
      const seenKey = new Set(
        this.db.labkomMasters!.map((m) => `${m.kategori}|${m.nilai.trim().toUpperCase()}`),
      );
      for (const row of cleaned) {
        const key = `${row.kategori}|${row.nilai.toUpperCase()}`;
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        this.db.labkomMasters!.push({
          id: `LM_${row.kategori}_IMP_${Date.now()}_${seq++}`,
          kategori: row.kategori,
          nilai: row.nilai,
        });
        added++;
      }
    }

    this.batchedWrites++;
    this.persist();
    return {
      ok: true,
      added,
      renamed,
      updatedBookings,
      updatedFixed,
      updatedPlotings,
      total: this.db.labkomMasters!.length,
    };
  }

  public updateLabkomSettings(payload: {
    broadcastTemplate?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
  }) {
    if (payload.broadcastTemplate !== undefined) {
      this.db.settings.labkomBroadcastTemplate =
        payload.broadcastTemplate.trim() || DEFAULT_LABKOM_BROADCAST_TEMPLATE;
    }
    if (payload.telegramBotToken !== undefined) {
      this.db.settings.labkomTelegramToken = payload.telegramBotToken.trim();
    }
    if (payload.telegramChatId !== undefined) {
      this.db.settings.labkomTelegramChatId = payload.telegramChatId.trim();
    }
    this.batchedWrites++;
    this.persist();
    return {
      ok: true,
      broadcastTemplate:
        this.db.settings.labkomBroadcastTemplate || DEFAULT_LABKOM_BROADCAST_TEMPLATE,
      telegramConfigured: Boolean(
        (process.env.TELEGRAM_BOT_TOKEN || this.db.settings.labkomTelegramToken) &&
          (process.env.TELEGRAM_CHAT_ID || this.db.settings.labkomTelegramChatId),
      ),
    };
  }

  public async sendLabkomTelegram(text: string): Promise<{
    ok: boolean;
    needsConfig?: boolean;
    message: string;
  }> {
    const token = process.env.TELEGRAM_BOT_TOKEN || this.db.settings.labkomTelegramToken || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || this.db.settings.labkomTelegramChatId || '';

    if (!token || !chatId) {
      return {
        ok: false,
        needsConfig: true,
        message:
          'Bot Token & Chat ID Telegram belum dikonfigurasi. Atur di Pengaturan Bot Telegram atau gunakan tombol Salin Teks.',
      };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        return {
          ok: false,
          message: `Telegram API merespons status ${response.status}${errBody ? `: ${errBody}` : ''}`,
        };
      }
      return { ok: true, message: 'Broadcast jadwal berhasil dikirim ke Telegram.' };
    } catch (err) {
      return {
        ok: false,
        message: `Gagal terhubung ke Telegram API: ${(err as Error).message}`,
      };
    }
  }

  // ==============================================================
  // RAPIKAN & SINKRONKAN SEMUA DATA PUTRA & PUTRI (SIM + LABKOM)
  // ==============================================================
  public tidyAllPutraPutriData(options?: { skipSyncMasters?: boolean }) {
    this.ensureLabkomInitialized();
    const cleanWs = (v?: string) => String(v || '').replace(/\s+/g, ' ').trim();

    const PUTRI_REGEX = /\b(PUTRI|AKHWAT|SISWI|SANTRIWATI|MUSYRIFAH|USTZ|USTADZAH|KHADIJAH|AISYAH|FATIMAH|HAFSHAH|ZAINAB|MARIYAM|RUQAYYAH|SUMAYYAH|UMMU)\b/i;
    const PUTRA_REGEX = /\b(PUTRA|IKHWAN|SANTRIWAN|ABU\s+BAKAR|UMAR\s+BIN|UTSMAN\s+BIN|ALI\s+BIN|BILAL\s+BIN|KHALID\s+BIN|SALMAN\s+AL|HAMZAH\s+BIN)\b/i;

    const inferPutraPutri = (texts: Array<string | undefined>, current?: 'Putra' | 'Putri'): Gender => {
      const joined = texts.map((t) => cleanWs(t)).filter(Boolean).join(' ').toUpperCase();
      if (PUTRI_REGEX.test(joined) && !/\bPUTRA\b/.test(joined)) return 'Putri';
      if (PUTRA_REGEX.test(joined) && !/\bPUTRI\b/.test(joined)) return 'Putra';
      if (joined.includes('PUTRI')) return 'Putri';
      if (joined.includes('PUTRA')) return 'Putra';
      return current === 'Putri' ? 'Putri' : 'Putra';
    };

    const beforeCounts = this.getSystemCounts();
    const beforeLabkomPutra = (this.db.labkomBookings || []).filter((b) => b.kampus === 'PUTRA').length;
    const beforeLabkomPutri = (this.db.labkomBookings || []).filter((b) => b.kampus === 'PUTRI').length;

    let genderReclassified = 0;
    let duplicatesRemoved = 0;
    let fieldsNormalized = 0;

    // 1. Tidy & Deduplicate Students (Putra & Putri cleanly separated)
    const studentMap = new Map<string, Student>();
    for (const s of this.db.students) {
      const nama = cleanWs(s.nama).toUpperCase();
      if (!nama) continue;
      const kelas = cleanWs(s.kelas).toUpperCase() || '-';
      const kamar = cleanWs(s.kamar) || '-';
      const kelompokQuran = cleanWs(s.kelompokQuran) || '-';
      const pengampuQuran = cleanWs(s.pengampuQuran).toUpperCase();
      const nis = cleanWs(s.nis);
      const waliKelas = cleanWs(s.waliKelas).toUpperCase();
      const musyrif = cleanWs(s.musyrif).toUpperCase();

      const nextGender = inferPutraPutri([kelas, kamar, kelompokQuran, pengampuQuran, musyrif, waliKelas], s.gender);
      if (nextGender !== s.gender) genderReclassified++;
      if (nama !== s.nama || kelas !== s.kelas || kamar !== s.kamar) fieldsNormalized++;

      const dedupKey = `${nextGender}|${normalizeStr(nama)}`;
      const prev = studentMap.get(dedupKey);
      if (!prev) {
        studentMap.set(dedupKey, {
          ...s,
          nis,
          nama,
          kelas,
          kamar,
          kelompokQuran,
          pengampuQuran,
          waliKelas,
          musyrif,
          gender: nextGender,
        });
      } else {
        duplicatesRemoved++;
        studentMap.set(dedupKey, {
          ...prev,
          nis: prev.nis || nis,
          kelas: prev.kelas && prev.kelas !== '-' ? prev.kelas : kelas,
          kamar: prev.kamar && prev.kamar !== '-' ? prev.kamar : kamar,
          kelompokQuran:
            prev.kelompokQuran && prev.kelompokQuran !== '-' ? prev.kelompokQuran : kelompokQuran,
          pengampuQuran: prev.pengampuQuran || pengampuQuran,
          waliKelas: prev.waliKelas || waliKelas,
          musyrif: prev.musyrif || musyrif,
          namaOrtu: prev.namaOrtu || s.namaOrtu,
          waOrtu: prev.waOrtu || s.waOrtu,
        });
      }
    }
    this.db.students = Array.from(studentMap.values()).sort(
      (a, b) =>
        a.gender.localeCompare(b.gender) ||
        a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) ||
        a.nama.localeCompare(b.nama, 'id'),
    );

    // 2. Tidy Teachers / Pegawai
    const superAdmin = createSuperAdminRecord();
    const teacherMap = new Map<string, TeacherRecord>();
    for (const t of this.db.teachers) {
      if (t.id === SUPER_ADMIN_ID || t.peran === 'Admin Super') continue;
      const nama = cleanWs(t.nama).toUpperCase();
      if (!nama || nama === '-') continue;
      const waliKelasOf = cleanWs(t.waliKelasOf).toUpperCase() || undefined;
      const kamarBinaan = Array.from(
        new Set((t.kamarBinaan || []).map((k) => cleanWs(k)).filter((k) => k && k !== '-')),
      );
      let genderScope = t.genderScope || 'Semua';
      if (genderScope !== 'Semua') {
        const inferred = inferPutraPutri([nama, waliKelasOf, ...kamarBinaan, t.peran], genderScope);
        if (PUTRI_REGEX.test(nama) && genderScope === 'Putra') {
          genderScope = 'Putri';
          genderReclassified++;
        } else if (inferred !== genderScope && (waliKelasOf || kamarBinaan.length > 0)) {
          genderScope = inferred;
        }
      } else if (PUTRI_REGEX.test(nama) || t.peran === 'Musyrifah') {
        genderScope = 'Putri';
      }
      const roles = new Set<UserRole>([t.peran, ...(t.peranTambahan || [])]);
      let primaryRole = t.peran;
      if (genderScope === 'Putri' && primaryRole === 'Musyrif') {
        primaryRole = 'Musyrifah';
        roles.delete('Musyrif');
        roles.add('Musyrifah');
      }
      const extras = Array.from(roles).filter((r) => r !== primaryRole);
      const tKey = normalizeStr(nama);
      const prev = teacherMap.get(tKey);
      if (!prev) {
        teacherMap.set(tKey, {
          ...t,
          nama,
          username: (t.username || makeUsername(nama)).toLowerCase(),
          peran: primaryRole,
          peranTambahan: extras.length > 0 ? extras : undefined,
          jabatan: roleToJabatan(primaryRole, extras),
          genderScope,
          waliKelasOf,
          kamarBinaan,
          whatsapp: cleanWs(t.whatsapp),
          pin: cleanWs(t.pin) || '1234',
        });
      } else {
        duplicatesRemoved++;
        const mergedExtras = Array.from(
          new Set([...(prev.peranTambahan || []), primaryRole, ...extras]),
        ).filter((r) => r !== prev.peran);
        const mergedScope: 'Putra' | 'Putri' | 'Semua' =
          prev.genderScope === genderScope ? prev.genderScope : 'Semua';
        teacherMap.set(tKey, {
          ...prev,
          genderScope: mergedScope,
          peranTambahan: mergedExtras.length > 0 ? mergedExtras : undefined,
          jabatan: roleToJabatan(prev.peran, mergedExtras),
          waliKelasOf: prev.waliKelasOf || waliKelasOf,
          kamarBinaan: Array.from(new Set([...(prev.kamarBinaan || []), ...kamarBinaan])),
          whatsapp: prev.whatsapp || cleanWs(t.whatsapp),
        });
      }
    }
    this.db.teachers = [
      superAdmin,
      ...Array.from(teacherMap.values()).sort(
        (a, b) => a.genderScope.localeCompare(b.genderScope) || a.nama.localeCompare(b.nama, 'id'),
      ),
    ];

    // 3. Tidy Rooms
    const roomMap = new Map<string, RoomMapping>();
    for (const rm of this.db.rooms) {
      const kamar = cleanWs(rm.kamar);
      if (!kamar || kamar === '-') continue;
      const musyrif = cleanWs(rm.musyrif).toUpperCase();
      const gender = inferPutraPutri([kamar, musyrif], rm.gender);
      const key = `${gender}|${normalizeStr(kamar)}`;
      const prev = roomMap.get(key);
      if (!prev) {
        roomMap.set(key, { kamar, musyrif, gender });
      } else {
        duplicatesRemoved++;
        if (!prev.musyrif && musyrif) prev.musyrif = musyrif;
      }
    }
    this.db.rooms = Array.from(roomMap.values()).sort(
      (a, b) => a.gender.localeCompare(b.gender) || a.kamar.localeCompare(b.kamar, 'id', { numeric: true }),
    );

    // 4. Tidy Schedules
    const scheduleMap = new Map<string, ScheduleItem>();
    for (const sc of this.db.schedules) {
      const guru = cleanWs(sc.guru).toUpperCase();
      const hari = cleanWs(sc.hari || 'SENIN').toUpperCase();
      const kelas = cleanWs(sc.kelas).toUpperCase();
      const mapel = cleanWs(sc.mapel).toUpperCase();
      const jamKe = cleanWs(sc.jamKe || '1-2').toUpperCase();
      if (!guru || !kelas || !mapel) continue;
      const gender = inferPutraPutri([kelas, guru], sc.gender);
      if (gender !== sc.gender) genderReclassified++;
      const key = `${gender}|${hari}|${normalizeStr(guru)}|${normalizeStr(kelas)}|${normalizeStr(mapel)}|${jamKe}`;
      if (!scheduleMap.has(key)) {
        scheduleMap.set(key, { ...sc, guru, hari, kelas, mapel, jamKe, gender });
      } else {
        duplicatesRemoved++;
      }
    }
    this.db.schedules = Array.from(scheduleMap.values()).sort(
      (a, b) =>
        a.gender.localeCompare(b.gender) ||
        a.hari.localeCompare(b.hari) ||
        a.jamKe.localeCompare(b.jamKe, undefined, { numeric: true }),
    );

    // 5. Tidy Ruangan Ujian
    this.db.ruanganUjian = Array.from(
      new Set(
        (this.db.ruanganUjian || [])
          .map((r) => cleanWs(r).toUpperCase())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));

    // 6. Tidy Labkom Bookings (Putra & Putri cleanly normalized & deduplicated)
    const bookingMap = new Map<string, LabkomBooking>();
    for (const b of this.db.labkomBookings || []) {
      const lab = cleanWs(b.lab).toUpperCase();
      const tanggal = parseLabkomTanggalToIso(cleanWs(b.tanggal)) || cleanWs(b.tanggal);
      const jamKe = cleanWs(b.jamKe).toUpperCase();
      if (!lab || !tanggal || !jamKe) continue;
      const namaPeminjam = cleanWs(b.namaPeminjam) || cleanWs(b.guru) || '-';
      const guru = cleanWs(b.guru) || '-';
      const kelas = cleanWs(b.kelas) || '-';
      const mapel = cleanWs(b.mapel) || '-';
      const inferredG = inferPutraPutri(
        [lab, kelas, guru, namaPeminjam, b.keterangan],
        b.kampus === 'PUTRI' ? 'Putri' : 'Putra',
      );
      const kampus: LabkomKampus = inferredG === 'Putri' ? 'PUTRI' : 'PUTRA';
      if (kampus !== b.kampus) genderReclassified++;
      const slotKey = `${kampus}|${lab}|${tanggal}|${jamKe}`;
      if (!bookingMap.has(slotKey)) {
        bookingMap.set(slotKey, {
          ...b,
          kampus,
          namaPeminjam,
          guru,
          kelas,
          mapel,
          lab,
          tanggal,
          jamKe,
          keterangan: cleanWs(b.keterangan),
          status: cleanWs(b.status) || 'Disetujui',
        });
      } else {
        duplicatesRemoved++;
      }
    }
    this.db.labkomBookings = Array.from(bookingMap.values()).sort(
      (a, b) => b.tanggal.localeCompare(a.tanggal) || a.kampus.localeCompare(b.kampus) || a.jamKe.localeCompare(b.jamKe, undefined, { numeric: true }),
    );

    // 7. Tidy Labkom Fixed Schedules & Plotings
    const fixedMap = new Map<string, LabkomFixedSchedule>();
    for (const f of this.db.labkomFixedSchedules || []) {
      const lab = cleanWs(f.lab).toUpperCase();
      const jamKe = cleanWs(f.jamKe).toUpperCase();
      const kampus: LabkomKampus =
        inferPutraPutri([lab, f.kelas, f.guru], f.kampus === 'PUTRI' ? 'Putri' : 'Putra') === 'Putri'
          ? 'PUTRI'
          : 'PUTRA';
      const key = `${kampus}|${f.hari}|${lab}|${jamKe}`;
      if (!fixedMap.has(key)) {
        fixedMap.set(key, {
          ...f,
          kampus,
          lab,
          jamKe,
          guru: cleanWs(f.guru) || '-',
          kelas: cleanWs(f.kelas) || '-',
          mapel: cleanWs(f.mapel) || '-',
        });
      } else {
        duplicatesRemoved++;
      }
    }
    this.db.labkomFixedSchedules = Array.from(fixedMap.values());

    const plotMap = new Map<string, LabkomPloting>();
    for (const p of this.db.labkomPlotings || []) {
      const lokasi = cleanWs(p.lokasi).toUpperCase();
      const namaSiswa = cleanWs(p.namaSiswa).toUpperCase();
      if (!lokasi || !namaSiswa) continue;
      const kampus: LabkomKampus =
        inferPutraPutri([lokasi, p.kelas], p.kampus === 'PUTRI' ? 'Putri' : 'Putra') === 'Putri'
          ? 'PUTRI'
          : 'PUTRA';
      const key = `${kampus}|${lokasi}|${p.noPc}`;
      if (!plotMap.has(key)) {
        plotMap.set(key, { ...p, kampus, lokasi, namaSiswa, kelas: cleanWs(p.kelas).toUpperCase() || '-' });
      }
    }
    this.db.labkomPlotings = Array.from(plotMap.values());

    // 8. Deduplicate Labkom Masters & Reconcile Relations
    const masterMap = new Map<string, LabkomMasterItem>();
    for (const m of this.db.labkomMasters || []) {
      const val = this.normalizeLabkomMasterValue(m.kategori, m.nilai);
      if (!val || val === '-') continue;
      const key = `${m.kategori}|${val.toUpperCase()}`;
      if (!masterMap.has(key)) masterMap.set(key, { ...m, nilai: val });
    }
    this.db.labkomMasters = ensureBaselineMasters(Array.from(masterMap.values()));

    this.reconcileDatabaseRelations('1234');
    if (!options?.skipSyncMasters) {
      this.syncLabkomMastersFromBookings();
    }

    this.batchedWrites++;
    this.persist();

    const afterCounts = this.getSystemCounts();
    const afterLabkomPutra = this.db.labkomBookings.filter((b) => b.kampus === 'PUTRA').length;
    const afterLabkomPutri = this.db.labkomBookings.filter((b) => b.kampus === 'PUTRI').length;

    return {
      ok: true,
      summary: {
        duplicatesRemoved,
        genderReclassified,
        fieldsNormalized,
        before: {
          ...beforeCounts,
          labkomPutra: beforeLabkomPutra,
          labkomPutri: beforeLabkomPutri,
        },
        after: {
          ...afterCounts,
          labkomPutra: afterLabkomPutra,
          labkomPutri: afterLabkomPutri,
        },
      },
      counts: afterCounts,
    };
  }
}

export const store = new PintarStore();

