-- ============================================================================
-- SIM PINTAR TERINTEGRASI — POSTGRESQL RELATIONAL DDL SCHEMA
-- ============================================================================

CREATE TYPE gender_enum AS ENUM ('Putra', 'Putri');
CREATE TYPE territory_scope_enum AS ENUM ('Putra', 'Putri', 'Semua');
CREATE TYPE user_role_enum AS ENUM (
  'ADMIN_SUPER',
  'ADMIN_SIM',
  'GURU_AKADEMIK',
  'WALI_KELAS',
  'MUSYRIF',
  'MUSYRIFAH',
  'PENGAMPU_ALQURAN'
);
CREATE TYPE presensi_type_enum AS ENUM ('Asrama', 'Belajar', 'Al-Quran', 'Ujian');
CREATE TYPE attendance_status_enum AS ENUM ('H', 'T', 'S', 'I', 'A');
CREATE TYPE followup_status_enum AS ENUM ('Selesai', 'Proses', 'Eskalasi');

CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  firebase_uid VARCHAR(128) UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  nama VARCHAR(120) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  jabatan VARCHAR(120) NOT NULL,
  primary_role user_role_enum NOT NULL DEFAULT 'GURU_AKADEMIK',
  additional_roles TEXT[] NOT NULL DEFAULT '{}',
  gender_scope territory_scope_enum NOT NULL DEFAULT 'Putra',
  wali_kelas_of VARCHAR(80),
  kamar_binaan TEXT[] NOT NULL DEFAULT '{}',
  kelompok_quran_binaan TEXT[] NOT NULL DEFAULT '{}',
  whatsapp VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rooms (
  id VARCHAR(64) PRIMARY KEY,
  kamar VARCHAR(80) NOT NULL UNIQUE,
  gender gender_enum NOT NULL,
  musyrif_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  musyrif_nama VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE students (
  id VARCHAR(64) PRIMARY KEY,
  nis VARCHAR(40) NOT NULL UNIQUE,
  tanggal_lahir VARCHAR(20) NOT NULL DEFAULT '2009-05-12',
  nama VARCHAR(120) NOT NULL,
  gender gender_enum NOT NULL,
  kelas VARCHAR(80) NOT NULL,
  room_id VARCHAR(64) REFERENCES rooms(id) ON DELETE SET NULL,
  kamar VARCHAR(80) NOT NULL,
  kelompok_quran VARCHAR(120) NOT NULL DEFAULT '-',
  pengampu_quran VARCHAR(120),
  wali_kelas_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  wali_kelas_nama VARCHAR(120) NOT NULL DEFAULT '-',
  musyrif_nama VARCHAR(120) DEFAULT '-',
  nama_ortu VARCHAR(120),
  wa_ortu VARCHAR(40),
  prioritas VARCHAR(24) NOT NULL DEFAULT 'Rutin',
  target_kampus VARCHAR(120),
  riwayat_penyakit VARCHAR(250),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedules (
  id VARCHAR(64) PRIMARY KEY,
  teacher_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  guru VARCHAR(120) NOT NULL,
  hari VARCHAR(24) NOT NULL,
  kelas VARCHAR(80) NOT NULL,
  mapel VARCHAR(120) NOT NULL,
  jam_ke VARCHAR(32) NOT NULL,
  jp_start INT NOT NULL DEFAULT 1,
  jp_end INT NOT NULL DEFAULT 2,
  gender gender_enum NOT NULL,
  kategori VARCHAR(24) NOT NULL DEFAULT 'Akademik',
  is_perubahan BOOLEAN NOT NULL DEFAULT FALSE,
  catatan_perubahan VARCHAR(250),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_clash_guru ON schedules (guru, hari, jp_start, jp_end);
CREATE INDEX idx_schedules_clash_kelas ON schedules (kelas, hari, jp_start, jp_end);

CREATE TABLE attendance_logs (
  id VARCHAR(64) PRIMARY KEY,
  tanggal VARCHAR(20) NOT NULL,
  jenis_presensi presensi_type_enum NOT NULL,
  gender gender_enum NOT NULL,
  kelas VARCHAR(80) NOT NULL,
  mapel VARCHAR(120) NOT NULL,
  student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  nama_siswa VARCHAR(120) NOT NULL,
  teacher_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  guru VARCHAR(120) NOT NULL,
  status attendance_status_enum NOT NULL,
  keterangan VARCHAR(250) NOT NULL DEFAULT '',
  materi VARCHAR(250),
  tilawah VARCHAR(120),
  murajaah VARCHAR(120),
  setoran VARCHAR(120),
  lampiran_url TEXT,
  lampiran_nama VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE coaching_records (
  id VARCHAR(64) PRIMARY KEY,
  tanggal VARCHAR(20) NOT NULL,
  bulan VARCHAR(24) NOT NULL,
  pekan_ke INT NOT NULL DEFAULT 1,
  student_id VARCHAR(64) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  nama_santri VARCHAR(120) NOT NULL,
  gender gender_enum NOT NULL,
  kelas VARCHAR(80) NOT NULL,
  kamar VARCHAR(80) NOT NULL,
  teacher_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  pembina_nama VARCHAR(120) NOT NULL,
  pembina_peran VARCHAR(40) NOT NULL,
  wali_kelas VARCHAR(120) NOT NULL,
  kategori VARCHAR(60) NOT NULL,
  catatan VARCHAR(500) NOT NULL,
  tindak_lanjut VARCHAR(500) NOT NULL,
  status_tindak_lanjut followup_status_enum NOT NULL DEFAULT 'Proses',
  poin INT NOT NULL DEFAULT 0,
  ibadah_subuh BOOLEAN NOT NULL DEFAULT TRUE,
  ibadah_dzuhur BOOLEAN NOT NULL DEFAULT TRUE,
  ibadah_ashar BOOLEAN NOT NULL DEFAULT TRUE,
  ibadah_maghrib BOOLEAN NOT NULL DEFAULT TRUE,
  ibadah_isya BOOLEAN NOT NULL DEFAULT TRUE,
  ibadah_tahajud BOOLEAN NOT NULL DEFAULT FALSE,
  ibadah_dhuha BOOLEAN NOT NULL DEFAULT FALSE,
  ibadah_tilawah BOOLEAN NOT NULL DEFAULT FALSE,
  lampiran_url TEXT,
  lampiran_nama VARCHAR(160),
  lampiran_tipe VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
