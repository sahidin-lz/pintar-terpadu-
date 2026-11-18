export type Gender = 'Putra' | 'Putri';
export type PresensiType = 'Asrama' | 'Belajar' | 'Al-Quran';
export type AttendanceStatus = 'H' | 'T' | 'S' | 'I' | 'A';

export type UserRole =
  | 'Guru'
  | 'Wali Kelas'
  | 'Musyrif'
  | 'Musyrifah'
  | 'Pengampu Al-Quran'
  | 'Admin SIM'
  | 'Admin Super';

export type PrioritasPembinaan = 'Mandiri' | 'Rutin' | 'Intensif' | '-';
export type LingkupPembinaan = 'Individu' | 'Klasikal';
export type LokasiPembinaan = 'Asrama' | 'Masjid' | 'Kelas' | 'Lapangan' | 'Ruang BK';
export type PihakKoordinasi = 'Musyrif/ah' | 'Wali Kelas' | 'BK / Ortu' | 'Kepala Sekolah';
export type StatusTindakLanjut = 'Selesai' | 'Proses' | 'Eskalasi';
export type AttachmentCategory =
  | 'Surat Sakit Dokter'
  | 'Sertifikat Lomba'
  | 'Bukti Pelanggaran'
  | 'Surat Izin Ortu'
  | 'Lainnya';

export interface Student {
  id: string;
  nis?: string;
  tanggalLahir?: string;
  nama: string;
  kelas: string;
  kamar: string;
  kelompokQuran: string;
  pengampuQuran?: string;
  gender: Gender;
  waliKelas: string;
  musyrif?: string;
  namaOrtu?: string;
  waOrtu?: string;
  gayaBelajar?: string;
  prioritas?: PrioritasPembinaan;
  golDarah?: string;
  riwayatPenyakit?: string;
  obatRutin?: string;
  targetKampus?: string;
}

export interface TeacherPublic {
  id: string;
  username: string;
  email?: string;
  nama: string;
  jabatan: string;
  peran: UserRole;
  peranTambahan?: UserRole[];
  genderScope: 'Putra' | 'Putri' | 'Semua';
  waliKelasOf?: string;
  kamarBinaan?: string[];
  kelompokQuranBinaan?: string[];
  whatsapp?: string;
}

export interface TeacherRecord extends TeacherPublic {
  pin: string;
}

export interface ScheduleItem {
  id: string;
  guru: string;
  hari: string;
  kelas: string;
  mapel: string;
  jamKe: string;
  gender: Gender;
  kategori?: 'Akademik' | 'Al-Quran';
  isPerubahan?: boolean;
  catatanPerubahan?: string;
  updatedAt?: string;
}

export interface ScheduleClashDetail {
  hasClash: boolean;
  clashType?: 'GURU' | 'KELAS';
  message?: string;
  conflictingSchedule?: ScheduleItem;
  overlappingJp?: number[];
}

export interface RoomMapping {
  kamar: string;
  musyrif: string;
  gender: Gender;
}

export interface AttendanceLog {
  id: string;
  timestamp: string;
  tanggal: string;
  guru: string;
  mapel: string;
  kelas: string;
  namaSiswa: string;
  status: AttendanceStatus;
  keterangan: string;
  materi?: string;
  tilawah?: string;
  murajaah?: string;
  setoran?: string;
  jenisPresensi: PresensiType;
  gender: Gender;
  lampiranUrl?: string;
  lampiranNama?: string;
  lampiranTipe?: AttachmentCategory;
}

export interface ExamLog {
  id: string;
  timestamp: string;
  tanggal: string;
  jenisUjian: string;
  ruangan: string;
  pengawas1: string;
  pengawas2: string;
  kelas: string;
  mapel: string;
  namaSiswa: string;
  status: AttendanceStatus;
  keterangan: string;
  gender: Gender;
}

export interface TeacherAbsenceLog {
  id: string;
  timestamp: string;
  tanggal: string;
  namaGuru: string;
  status: 'Sakit' | 'Izin' | 'Dinas Luar' | 'Tanpa Keterangan';
  keterangan: string;
}

export interface IbadahChecklist {
  subuh: boolean;
  dzuhur: boolean;
  ashar: boolean;
  maghrib: boolean;
  isya: boolean;
  tahajud: boolean;
  dhuha: boolean;
  tilawah: boolean;
}

export type PembinaanKategori =
  | 'Pemantauan Ibadah'
  | 'Pembinaan Karakter'
  | 'Kedisiplinan'
  | 'Prestasi'
  | 'Kesehatan';

export interface PembinaanRecord {
  id: string;
  timestamp: string;
  tanggal: string;
  bulan: string;
  pekanKe: number;
  namaSantri: string;
  kelas: string;
  kamar: string;
  gender: Gender;
  pembinaNama: string;
  pembinaPeran: UserRole | string;
  waliKelas: string;
  lingkup: LingkupPembinaan;
  lokasi: LokasiPembinaan;
  pihakKoordinasi: PihakKoordinasi;
  statusTindakLanjut: StatusTindakLanjut;
  kategori: PembinaanKategori;
  catatan: string;
  tindakLanjut: string;
  poin: number;
  ibadah: IbadahChecklist;
  lampiranUrl?: string;
  lampiranNama?: string;
  lampiranTipe?: AttachmentCategory;
}

export interface WhatsAppGatewayConfig {
  provider: 'Fonnte' | 'Wablas' | 'Baileys';
  apiUrl: string;
  apiToken: string;
  autoNotifyAlfa: boolean;
  autoNotifyEskalasi: boolean;
}

export interface WhatsAppLogEntry {
  id: string;
  timestamp: string;
  triggerType: 'ALFA_PRESENSI' | 'ESKALASI_PEMBINAAN' | 'BROADCAST_MANUAL';
  namaSantri: string;
  kelas: string;
  nomorTujuan: string;
  pesan: string;
  provider: 'Fonnte' | 'Wablas' | 'Baileys';
  status: 'Terkirim' | 'Simulasi Lokal' | 'Gagal';
}

export interface CloudAttachmentItem {
  id: string;
  timestamp: string;
  namaSantri: string;
  kelas: string;
  kategoriLampiran: AttachmentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: 'Firebase Storage' | 'Cloudinary / S3' | 'Inline Data URL';
  url: string;
  uploadedBy: string;
}

export type WilayahFilter = 'Semua' | Gender;

export interface DashboardStats {
  hari: Record<AttendanceStatus, number>;
  bulan: Record<AttendanceStatus, number>;
  semester: Record<AttendanceStatus, number>;
}

export interface ReportOptionsScope {
  akademik: { kelas: string[]; mapel: string[] };
  asrama: { kamar: string[]; musyrif: string[] };
  alquran: { kelompok: string[] };
  ruanganUjian: string[];
  students: string[];
}

export interface ReportOptions extends ReportOptionsScope {
  byWilayah?: {
    Putra: ReportOptionsScope;
    Putri: ReportOptionsScope;
  };
}

export interface DivisiStatCard {
  H: number;
  T: number;
  S: number;
  I: number;
  A: number;
  total: number;
  persenHadir: number;
}

export interface PembinaanAnalisisSummary {
  totalSantri: number;
  santriDibina: number;
  totalCatatan: number;
  totalPelanggaran: number;
  totalPrestasi: number;
  netPoin: number;
  persenSholatWajib: number;
  persenIbadahSunnah: number;
  statusCounts: Record<StatusTindakLanjut, number>;
  prioritasCounts: { Mandiri: number; Rutin: number; Intensif: number; BelumDiatur: number };
  kategoriCounts: Array<{ kategori: PembinaanKategori; count: number }>;
  topAttentionStudents: Array<{
    nama: string;
    gender: Gender;
    kelas: string;
    kamar: string;
    totalCatatan: number;
    pelanggaran: number;
    netPoin: number;
    wajibPct: number;
    statusTerakhir: string;
  }>;
}

export interface AnalyticsTerpadu {
  tanggal: string;
  presensiByWilayah: {
    Semua: DashboardStats;
    Putra: DashboardStats;
    Putri: DashboardStats;
  };
  divisiByWilayah: {
    Putra: {
      Asrama: DivisiStatCard;
      Belajar: DivisiStatCard;
      AlQuran: DivisiStatCard;
      Ujian: DivisiStatCard;
    };
    Putri: {
      Asrama: DivisiStatCard;
      Belajar: DivisiStatCard;
      AlQuran: DivisiStatCard;
      Ujian: DivisiStatCard;
    };
  };
  monitoringRingkasan: {
    Putra: { totalJadwalKbm: number; diisiKbm: number; totalKamar: number; diisiKamar: number; guruAbsen: number };
    Putri: { totalJadwalKbm: number; diisiKbm: number; totalKamar: number; diisiKamar: number; guruAbsen: number };
  };
  topAbsenPerWilayah: {
    Putra: Array<{ nama: string; kelas: string; kamar: string; S: number; I: number; A: number; total: number }>;
    Putri: Array<{ nama: string; kelas: string; kamar: string; S: number; I: number; A: number; total: number }>;
  };
  pembinaanAnalisis: {
    Semua: PembinaanAnalisisSummary;
    Putra: PembinaanAnalisisSummary;
    Putri: PembinaanAnalisisSummary;
  };
}

export interface WaliKelasMonthlyStudentRow {
  id: string;
  nis: string;
  nama: string;
  gender: Gender;
  kelas: string;
  kamar: string;
  waliKelas: string;
  musyrif: string;
  prioritas: PrioritasPembinaan;
  presensi: {
    H: number;
    T: number;
    S: number;
    I: number;
    A: number;
    total: number;
    persenHadir: number;
    akademikPct: number;
    asramaPct: number;
    alquranPct: number;
  };
  pembinaan: {
    totalCatatan: number;
    wajibPct: number;
    sunnahPct: number;
    totalPrestasi: number;
    totalPelanggaran: number;
    netPoin: number;
    statusTerakhir: StatusTindakLanjut | '-';
    catatanTerakhir: string;
  };
}

export interface ClassAnalyticsComparison {
  kelas: string;
  gender: Gender;
  waliKelas: string;
  totalSantri: number;
  santriDibina: number;
  cakupanPembinaanPct: number;
  persenHadir: number;
  totalHadir: number;
  totalAbsen: number;
  wajibPct: number;
  sunnahPct: number;
  netPoin: number;
  kasusAktif: number;
}

export interface MonthlyWaliKelasReport {
  meta: {
    bulan: string;
    bulanLabel: string;
    wilayah: WilayahFilter;
    kelas: string;
    waliKelas: string;
    totalSantri: number;
    tanggalCetak: string;
  };
  presensiSummary: {
    H: number;
    T: number;
    S: number;
    I: number;
    A: number;
    totalSesi: number;
    persenHadir: number;
    byDivisi: {
      Akademik: DivisiStatCard;
      Asrama: DivisiStatCard;
      AlQuran: DivisiStatCard;
      Ujian: DivisiStatCard;
    };
  };
  pembinaanSummary: PembinaanAnalisisSummary;
  classComparison: ClassAnalyticsComparison[];
  studentRows: WaliKelasMonthlyStudentRow[];
}

export interface StudentFormEntry {
  nama: string;
  status: AttendanceStatus;
  keterangan: string;
  tilawah?: string;
  murajaah?: string;
  setoran?: string;
  kelasAsli: string;
  syncedFromAsrama?: boolean;
}

export interface MonitoringCell {
  guru: string;
  kelas: string;
  mapel: string;
  jam: string;
  status: 'HADIR' | 'GURU_ABSEN' | 'KOSONG';
}

export interface MonitoringRoom {
  kamar: string;
  musyrif: string;
  status: 'HADIR' | 'GURU_ABSEN' | 'KOSONG';
}

export interface MonitoringData {
  putra: {
    akademik: { kelas10: MonitoringCell[]; kelas11: MonitoringCell[]; kelas12: MonitoringCell[] };
    alquran: { kelas10: MonitoringCell[]; kelas11: MonitoringCell[]; kelas12: MonitoringCell[] };
    asrama: MonitoringRoom[];
  };
  putri: {
    akademik: { kelas10: MonitoringCell[]; kelas11: MonitoringCell[]; kelas12: MonitoringCell[] };
    alquran: { kelas10: MonitoringCell[]; kelas11: MonitoringCell[]; kelas12: MonitoringCell[] };
    asrama: MonitoringRoom[];
  };
}

export interface PortfolioSummary {
  santri: Student | null;
  totalCatatan: number;
  totalPelanggaran: number;
  totalPrestasi: number;
  netPoin: number;
  persenSholatWajib: number;
  persenSholatSunnah: number;
  ibadahBreakdown: Record<keyof IbadahChecklist, { done: number; total: number; pct: number }>;
  riwayatPembinaan: PembinaanRecord[];
  rekapPresensi: {
    akademik: Record<AttendanceStatus, number>;
    asrama: Record<AttendanceStatus, number>;
    alquran: Record<AttendanceStatus, number>;
    ujian: Record<AttendanceStatus, number>;
  };
  recentAbsenIssues: Array<{
    tanggal: string;
    divisi: string;
    konteks: string;
    status: AttendanceStatus;
    keterangan: string;
  }>;
}

export interface QuotaMetrics {
  storageEngine: string;
  externalQuotaUsedToday: number;
  externalQuotaLimit: string;
  cacheHitCount: number;
  batchedWritesCount: number;
  totalRecordsStored: number;
  gasBridgeUrl: string;
  lastSyncedAt: string | null;
}

export interface SystemCounts {
  students: number;
  teachers: number;
  rooms: number;
  schedules: number;
  attendanceLogs: number;
  pembinaanRecords: number;
  examLogs: number;
  labkomBookings?: number;
  byWilayah?: {
    Putra: { students: number; rooms: number; schedules: number; pembinaanRecords: number };
    Putri: { students: number; rooms: number; schedules: number; pembinaanRecords: number };
  };
}

export type SemesterType = 'Ganjil' | 'Genap';
export type SemesterFilter = 'ALL' | 'GANJIL' | 'GENAP';

export type LabkomKampus = 'PUTRA' | 'PUTRI';
export type LabkomMasterKategori =
  | 'GURU'
  | 'KELAS'
  | 'MAPEL'
  | 'LAB'
  | 'RUANGAN'
  | 'JAM'
  | 'WAKTU_RUANG';

export interface LabkomMasterItem {
  id: string;
  kategori: LabkomMasterKategori;
  nilai: string;
}

export interface LabkomBooking {
  id: string;
  timestamp: string;
  kampus: LabkomKampus;
  email: string;
  namaPeminjam: string;
  guru: string;
  kelas: string;
  mapel: string;
  lab: string;
  tanggal: string; // YYYY-MM-DD
  jamKe: string;
  keterangan: string;
  status: string;
}

export interface LabkomFixedSchedule {
  id: string;
  hari: number; // 1=Senin .. 7=Minggu
  kampus: LabkomKampus;
  guru: string;
  kelas: string;
  mapel: string;
  lab: string;
  jamKe: string;
}

export interface LabkomPloting {
  id: string;
  kampus: LabkomKampus;
  lokasi: string;
  noPc: number; // 1..40
  namaSiswa: string;
  kelas: string;
}

export interface LabkomStudentOption {
  nama: string;
  kelas: string;
}

export interface LabkomStatePayload {
  bookings: LabkomBooking[];
  fixedSchedules: LabkomFixedSchedule[];
  plotings: LabkomPloting[];
  masters: LabkomMasterItem[];
  broadcastTemplate: string;
  telegramConfigured: boolean;
  siswaPutra: LabkomStudentOption[];
  siswaPutri: LabkomStudentOption[];
}

