import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookCheck,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Printer,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  AnalyticsTerpadu,
  Gender,
  IbadahChecklist,
  LingkupPembinaan,
  LokasiPembinaan,
  PembinaanKategori,
  PembinaanRecord,
  PihakKoordinasi,
  PortfolioSummary,
  PrioritasPembinaan,
  StatusTindakLanjut,
  Student,
  TeacherPublic,
  WilayahFilter,
} from '../types';
import {
  downloadCsv,
  formatTanggalIndo,
  getTodayDateStr,
  printHtmlDocument,
} from '../utils/exportHelpers';
import { emitDataMutated, loadSubTab, saveSubTab } from '../utils/sessionPersistence';

interface WaliKelasModuleProps {
  unlockedTeacher: TeacherPublic | null;
  teachers: TeacherPublic[];
  onOpenImport?: () => void;
  onRequestLogin?: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const DEFAULT_IBADAH: IbadahChecklist = {
  subuh: true,
  dzuhur: true,
  ashar: true,
  maghrib: true,
  isya: true,
  tahajud: false,
  dhuha: false,
  tilawah: true,
};

const IBADAH_FIELDS: Array<{ key: keyof IbadahChecklist; label: string; group: 'Wajib' | 'Sunnah' }> = [
  { key: 'subuh', label: 'Subuh', group: 'Wajib' },
  { key: 'dzuhur', label: 'Dzuhur', group: 'Wajib' },
  { key: 'ashar', label: 'Ashar', group: 'Wajib' },
  { key: 'maghrib', label: 'Maghrib', group: 'Wajib' },
  { key: 'isya', label: 'Isya', group: 'Wajib' },
  { key: 'tahajud', label: 'Tahajud', group: 'Sunnah' },
  { key: 'dhuha', label: 'Dhuha', group: 'Sunnah' },
  { key: 'tilawah', label: 'Tilawah', group: 'Sunnah' },
];

const BULAN_LIST = [
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
];

const LINGKUP_LIST: LingkupPembinaan[] = ['Individu', 'Klasikal'];
const LOKASI_LIST: LokasiPembinaan[] = ['Asrama', 'Masjid', 'Kelas', 'Lapangan', 'Ruang BK'];
const KOORDINASI_LIST: PihakKoordinasi[] = ['Musyrif/ah', 'Wali Kelas', 'BK / Ortu', 'Kepala Sekolah'];
const STATUS_LIST: StatusTindakLanjut[] = ['Selesai', 'Proses', 'Eskalasi'];
const KATEGORI_LIST: PembinaanKategori[] = [
  'Pemantauan Ibadah',
  'Pembinaan Karakter',
  'Kedisiplinan',
  'Prestasi',
  'Kesehatan',
];

const NAMA_BULAN_BY_INDEX = [
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

function getBulanFromDate(dateStr: string): string {
  const m = Number(dateStr.split('-')[1]);
  if (m >= 1 && m <= 12) return NAMA_BULAN_BY_INDEX[m - 1];
  return 'Juli';
}

const SPREADSHEET_FORMULAS = {
  gsCountWajib: `=IFERROR(SUMPRODUCT((DB_Klasikal_Tahunan!C2:C=B2)*(DB_Klasikal_Tahunan!I2:M=TRUE)) / (COUNTIF(DB_Klasikal_Tahunan!C2:C, B2)*5), 0)`,
  gsCountSunnah: `=IFERROR(SUMPRODUCT((DB_Klasikal_Tahunan!C2:C=B2)*(DB_Klasikal_Tahunan!N2:P=TRUE)) / (COUNTIF(DB_Klasikal_Tahunan!C2:C, B2)*3), 0)`,
  gsCountPelanggaran: `=COUNTIFS(DB_Klasikal_Tahunan!C2:C, B2, DB_Klasikal_Tahunan!F2:F, "Kedisiplinan")`,
  gsQueryHistory: `=IFERROR(QUERY(DB_Klasikal_Tahunan!A2:P, "SELECT A, B, D, E, F, G, H, I, J, K, L, M, N, O, P WHERE C = '" & B2 & "' ORDER BY A DESC", 0), "Belum ada riwayat pembinaan untuk santri ini.")`,
  excelFilterHistory: `=IFERROR(SORT(FILTER(DB_Klasikal_Tahunan!A2:P1000, DB_Klasikal_Tahunan!C2:C1000=B2), 1, -1), "Belum ada riwayat pembinaan.")`,
};

export const WaliKelasModule: React.FC<WaliKelasModuleProps> = ({
  unlockedTeacher,
  teachers,
  onOpenImport,
  onRequestLogin,
  notify,
}) => {
  const [subTab, setSubTab] = useState<'input' | 'database' | 'portofolio' | 'analisis' | 'panduan'>(() =>
    loadSubTab('pintar_walikelas_subtab_v1', ['input', 'database', 'portofolio', 'analisis', 'panduan'] as const, 'input'),
  );
  const [wilayahFilter, setWilayahFilter] = useState<WilayahFilter>(() =>
    loadSubTab('pintar_walikelas_wilayah_v1', ['Semua', 'Putra', 'Putri'] as const, 'Semua'),
  );

  useEffect(() => {
    saveSubTab('pintar_walikelas_subtab_v1', subTab);
  }, [subTab]);

  useEffect(() => {
    saveSubTab('pintar_walikelas_wilayah_v1', wilayahFilter);
  }, [wilayahFilter]);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<PembinaanRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [analisis, setAnalisis] = useState<AnalyticsTerpadu | null>(null);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);

  // Portfolio state
  const [selectedSantri, setSelectedSantri] = useState<string>('');
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

  // Input mode & Pembina identity
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single');
  const [metaMinimized, setMetaMinimized] = useState<boolean>(false);
  const [pembinaNama, setPembinaNama] = useState<string>(unlockedTeacher?.nama || '');
  const [pembinaPeran, setPembinaPeran] = useState<string>(unlockedTeacher?.peran || 'Wali Kelas');

  // Common metadata (aligned with Sistem_Pembinaan_Wali_Kelas_Terpadu_1_Tahun)
  const today = getTodayDateStr();
  const [formTanggal, setFormTanggal] = useState<string>(today);
  const [formBulan, setFormBulan] = useState<string>(getBulanFromDate(today));
  const [formPekan, setFormPekan] = useState<number>(1);
  const [formLingkup, setFormLingkup] = useState<LingkupPembinaan>('Individu');
  const [formLokasi, setFormLokasi] = useState<LokasiPembinaan>(
    unlockedTeacher?.peran === 'Musyrif' || unlockedTeacher?.peran === 'Musyrifah' ? 'Asrama' : 'Kelas'
  );
  const [formKoordinasi, setFormKoordinasi] = useState<PihakKoordinasi>('Wali Kelas');
  const [formStatus, setFormStatus] = useState<StatusTindakLanjut>('Selesai');

  // Single input state
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentFilterGroup, setStudentFilterGroup] = useState<string>('SEMUA');
  const [formSantri, setFormSantri] = useState<string>('');
  const [formKategori, setFormKategori] = useState<PembinaanKategori>('Pembinaan Karakter');
  const [formCatatan, setFormCatatan] = useState<string>('');
  const [formTindakLanjut, setFormTindakLanjut] = useState<string>('');
  const [formPoin, setFormPoin] = useState<number>(0);
  const [formIbadah, setFormIbadah] = useState<IbadahChecklist>({ ...DEFAULT_IBADAH });
  const [formLampiranTipe, setFormLampiranTipe] = useState<
    'Surat Sakit Dokter' | 'Sertifikat Lomba' | 'Bukti Pelanggaran' | 'Surat Izin Ortu' | 'Lainnya'
  >('Surat Sakit Dokter');
  const [formLampiranNama, setFormLampiranNama] = useState<string>('');
  const [formLampiranUrl, setFormLampiranUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Student profile inline editor
  const [editingProfile, setEditingProfile] = useState(false);
  const [profPrioritas, setProfPrioritas] = useState<PrioritasPembinaan>('-');
  const [profGayaBelajar, setProfGayaBelajar] = useState<string>('');
  const [profNamaOrtu, setProfNamaOrtu] = useState<string>('');
  const [profWaOrtu, setProfWaOrtu] = useState<string>('');
  const [profPenyakit, setProfPenyakit] = useState<string>('');
  const [profObat, setProfObat] = useState<string>('');
  const [profTarget, setProfTarget] = useState<string>('');

  // Batch (Klasikal / Kamar / Halaqah) input state
  const [batchGroupType, setBatchGroupType] = useState<'kelas' | 'kamar' | 'kelompokQuran'>(
    unlockedTeacher?.peran === 'Musyrif' || unlockedTeacher?.peran === 'Musyrifah' ? 'kamar' : 'kelas'
  );
  const [batchGroupValue, setBatchGroupValue] = useState<string>('');
  const [batchKategori, setBatchKategori] = useState<PembinaanKategori>('Pemantauan Ibadah');
  const [batchRows, setBatchRows] = useState<
    Array<{
      namaSantri: string;
      kelas: string;
      kamar: string;
      gender: Gender;
      ibadah: IbadahChecklist;
      catatan: string;
      poin: number;
    }>
  >([]);

  // Database table filters
  const [filterKelas, setFilterKelas] = useState<string>('SEMUA');
  const [filterKamar, setFilterKamar] = useState<string>('SEMUA');
  const [filterPeran, setFilterPeran] = useState<string>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<string>('SEMUA');

  useEffect(() => {
    if (unlockedTeacher) {
      setPembinaNama(unlockedTeacher.nama);
      setPembinaPeran(unlockedTeacher.peran);
      if (unlockedTeacher.peran === 'Musyrif' || unlockedTeacher.peran === 'Musyrifah') {
        setFormLokasi('Asrama');
        setBatchGroupType('kamar');
      } else {
        setFormLokasi('Kelas');
        setBatchGroupType('kelas');
      }
    }
  }, [unlockedTeacher]);

  const loadStudents = () => {
    fetch('/api/pembinaan/students')
      .then((r) => r.json())
      .then((list: Student[]) => {
        setStudents(list);
        if (list.length > 0) {
          setFormSantri((prev) => prev || list[0].nama);
          setSelectedSantri((prev) => prev || list[0].nama);
        }
      });
  };

  const loadRecords = () => {
    setLoadingRecords(true);
    const params = new URLSearchParams();
    if (wilayahFilter !== 'Semua') params.set('gender', wilayahFilter);
    if (filterKelas !== 'SEMUA') params.set('kelas', filterKelas);
    if (filterKamar !== 'SEMUA') params.set('kamar', filterKamar);
    if (filterPeran !== 'SEMUA') params.set('pembinaPeran', filterPeran);
    if (filterStatus !== 'SEMUA') params.set('statusTindakLanjut', filterStatus);
    fetch(`/api/pembinaan/list?${params.toString()}`)
      .then((r) => r.json())
      .then((data: PembinaanRecord[]) => setRecords(data))
      .finally(() => setLoadingRecords(false));
  };

  const loadAnalisis = () => {
    setLoadingAnalisis(true);
    fetch(`/api/analisis?tanggal=${encodeURIComponent(formTanggal)}`)
      .then((r) => r.json())
      .then((data: AnalyticsTerpadu) => setAnalisis(data))
      .finally(() => setLoadingAnalisis(false));
  };

  const loadPortfolio = (nama: string) => {
    if (!nama) {
      setPortfolio(null);
      return;
    }
    setLoadingPortfolio(true);
    fetch(`/api/pembinaan/portfolio?santri=${encodeURIComponent(nama)}`)
      .then((r) => r.json())
      .then((data: PortfolioSummary) => setPortfolio(data))
      .finally(() => setLoadingPortfolio(false));
  };

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [wilayahFilter, filterKelas, filterKamar, filterPeran, filterStatus]);

  useEffect(() => {
    if (subTab === 'analisis') loadAnalisis();
  }, [subTab, formTanggal]);

  useEffect(() => {
    if (selectedSantri) {
      loadPortfolio(selectedSantri);
    }
  }, [selectedSantri]);

  const scopedStudents = useMemo(
    () => (wilayahFilter === 'Semua' ? students : students.filter((s) => s.gender === wilayahFilter)),
    [students, wilayahFilter]
  );

  useEffect(() => {
    if (scopedStudents.length === 0) {
      setFormSantri('');
      setSelectedSantri('');
      return;
    }
    if (!scopedStudents.some((s) => s.nama === formSantri)) {
      setFormSantri(scopedStudents[0].nama);
    }
    if (!scopedStudents.some((s) => s.nama === selectedSantri)) {
      setSelectedSantri(scopedStudents[0].nama);
    }
  }, [scopedStudents, formSantri, selectedSantri]);

  const uniqueClasses = useMemo(
    () => Array.from(new Set(scopedStudents.map((s) => s.kelas).filter((k) => k && k !== '-'))).sort(),
    [scopedStudents]
  );
  const uniqueRooms = useMemo(
    () => Array.from(new Set(scopedStudents.map((s) => s.kamar).filter((k) => k && k !== '-'))).sort(),
    [scopedStudents]
  );
  const uniqueHalaqah = useMemo(
    () => Array.from(new Set(scopedStudents.map((s) => s.kelompokQuran).filter((k) => k && k !== '-'))).sort(),
    [scopedStudents]
  );

  // Batch group options
  const batchGroupOptions =
    batchGroupType === 'kelas'
      ? uniqueClasses
      : batchGroupType === 'kamar'
      ? uniqueRooms
      : uniqueHalaqah;

  useEffect(() => {
    if (batchGroupOptions.length > 0 && !batchGroupOptions.includes(batchGroupValue)) {
      if (batchGroupType === 'kelas' && unlockedTeacher?.waliKelasOf && batchGroupOptions.includes(unlockedTeacher.waliKelasOf)) {
        setBatchGroupValue(unlockedTeacher.waliKelasOf);
      } else if (batchGroupType === 'kamar' && unlockedTeacher?.kamarBinaan?.[0] && batchGroupOptions.includes(unlockedTeacher.kamarBinaan[0])) {
        setBatchGroupValue(unlockedTeacher.kamarBinaan[0]);
      } else {
        setBatchGroupValue(batchGroupOptions[0]);
      }
    } else if (batchGroupOptions.length === 0) {
      setBatchGroupValue('');
    }
  }, [batchGroupType, batchGroupOptions, unlockedTeacher, batchGroupValue]);

  // Populate batchRows whenever batchGroupValue changes
  useEffect(() => {
    if (!batchGroupValue) {
      setBatchRows([]);
      return;
    }
    const groupStudents = scopedStudents.filter((s) => {
      if (batchGroupType === 'kelas') return s.kelas === batchGroupValue;
      if (batchGroupType === 'kamar') return s.kamar === batchGroupValue;
      return s.kelompokQuran === batchGroupValue;
    });
    setBatchRows(
      groupStudents.map((s) => ({
        namaSantri: s.nama,
        kelas: s.kelas,
        kamar: s.kamar,
        gender: s.gender,
        ibadah: { ...DEFAULT_IBADAH },
        catatan: 'Pemantauan rutin pekanan',
        poin: 0,
      }))
    );
  }, [batchGroupValue, batchGroupType, scopedStudents]);

  // Filtered student options for single input
  const filteredSingleStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return scopedStudents.filter((s) => {
      if (studentFilterGroup !== 'SEMUA' && s.kelas !== studentFilterGroup && s.kamar !== studentFilterGroup) {
        return false;
      }
      if (!q) return true;
      return (
        s.nama.toLowerCase().includes(q) ||
        s.kelas.toLowerCase().includes(q) ||
        s.kamar.toLowerCase().includes(q) ||
        (s.nis || '').toLowerCase().includes(q)
      );
    });
  }, [scopedStudents, studentSearch, studentFilterGroup]);

  const activeSingleStudent = useMemo(
    () => scopedStudents.find((s) => s.nama === formSantri) || null,
    [scopedStudents, formSantri]
  );

  // Sync profile editor fields when activeSingleStudent changes
  useEffect(() => {
    if (activeSingleStudent) {
      setProfPrioritas(activeSingleStudent.prioritas || '-');
      setProfGayaBelajar(activeSingleStudent.gayaBelajar || '');
      setProfNamaOrtu(activeSingleStudent.namaOrtu || '');
      setProfWaOrtu(activeSingleStudent.waOrtu || '');
      setProfPenyakit(activeSingleStudent.riwayatPenyakit || '');
      setProfObat(activeSingleStudent.obatRutin || '');
      setProfTarget(activeSingleStudent.targetKampus || '');
    }
  }, [activeSingleStudent]);

  const handleSaveStudentProfile = async () => {
    if (!activeSingleStudent) return;
    const res = await fetch('/api/pembinaan/student-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namaSantri: activeSingleStudent.nama,
        updates: {
          prioritas: profPrioritas,
          gayaBelajar: profGayaBelajar,
          namaOrtu: profNamaOrtu,
          waOrtu: profWaOrtu,
          riwayatPenyakit: profPenyakit,
          obatRutin: profObat,
          targetKampus: profTarget,
        },
      }),
    });
    if (res.ok) {
      setEditingProfile(false);
      loadStudents();
      if (selectedSantri === activeSingleStudent.nama) loadPortfolio(selectedSantri);
      emitDataMutated();
      notify(`Profil pembinaan ${activeSingleStudent.nama} diperbarui.`, 'success');
    }
  };

  const handleFileAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      notify('Ukuran file maksimal 4 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setFormLampiranNama(file.name);
      setFormLampiranUrl(dataUrl);
      notify(`Lampiran "${file.name}" siap diunggah ke Cloud Storage.`, 'info');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSantri || !formCatatan.trim()) {
      notify('Pilih santri dan isi catatan / kasus pembinaan.', 'error');
      return;
    }
    const target = students.find((s) => s.nama === formSantri);
    setSaving(true);
    try {
      const res = await fetch('/api/pembinaan/simpan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: formTanggal,
          bulan: formBulan,
          pekanKe: formPekan,
          namaSantri: formSantri,
          kelas: target?.kelas || '-',
          kamar: target?.kamar || '-',
          gender: target?.gender || 'Putra',
          pembinaNama: pembinaNama.trim() || unlockedTeacher?.nama || 'PEMBINA',
          pembinaPeran: pembinaPeran || unlockedTeacher?.peran || 'Wali Kelas',
          waliKelas: target?.waliKelas || '-',
          lingkup: formLingkup,
          lokasi: formLokasi,
          pihakKoordinasi: formKoordinasi,
          statusTindakLanjut: formStatus,
          kategori: formKategori,
          catatan: formCatatan.trim(),
          tindakLanjut: formTindakLanjut.trim() || '-',
          poin: Number(formPoin) || 0,
          ibadah: formIbadah,
          lampiranUrl: formLampiranUrl || undefined,
          lampiranNama: formLampiranNama || undefined,
          lampiranTipe: formLampiranUrl ? formLampiranTipe : undefined,
        }),
      });
      if (!res.ok) throw new Error();

      if (formLampiranUrl && formLampiranNama) {
        await fetch('/api/attachments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            namaSantri: formSantri,
            kelas: target?.kelas || '-',
            kategori: formLampiranTipe,
            fileName: formLampiranNama,
            mimeType: formLampiranUrl.startsWith('data:image') ? 'image/jpeg' : 'application/pdf',
            fileSizeKb: Math.max(12, Math.round((formLampiranUrl.length * 0.75) / 1024)),
            dataUrl: formLampiranUrl,
            uploadedBy: pembinaNama.trim() || unlockedTeacher?.nama || 'Wali Kelas',
            keterangan: formCatatan.trim(),
          }),
        });
      }

      const isEscalated = formStatus === 'Eskalasi' || Number(formPoin) <= -10;
      notify(
        isEscalated
          ? 'Catatan disimpan & Notifikasi WhatsApp Otomatis telah dikirim ke Orang Tua Santri.'
          : 'Catatan pembinaan berhasil disimpan ke DB_Klasikal_Tahunan.',
        'success'
      );
      setFormCatatan('');
      setFormTindakLanjut('');
      setFormPoin(0);
      setFormLampiranNama('');
      setFormLampiranUrl('');
      loadRecords();
      if (selectedSantri === formSantri) loadPortfolio(selectedSantri);
      emitDataMutated();
    } catch {
      notify('Gagal menyimpan catatan pembinaan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBatch = async () => {
    if (batchRows.length === 0) return;
    setSaving(true);
    try {
      const payload = batchRows.map((row) => ({
        tanggal: formTanggal,
        bulan: formBulan,
        pekanKe: formPekan,
        namaSantri: row.namaSantri,
        kelas: row.kelas,
        kamar: row.kamar,
        gender: row.gender,
        pembinaNama: pembinaNama.trim() || unlockedTeacher?.nama || 'PEMBINA',
        pembinaPeran: pembinaPeran || unlockedTeacher?.peran || 'Wali Kelas',
        waliKelas: '-',
        lingkup: 'Klasikal' as LingkupPembinaan,
        lokasi: formLokasi,
        pihakKoordinasi: formKoordinasi,
        statusTindakLanjut: formStatus,
        kategori: batchKategori,
        catatan: row.catatan,
        tindakLanjut: 'Pemantauan klasikal/asrama',
        poin: Number(row.poin) || 0,
        ibadah: row.ibadah,
      }));
      const res = await fetch('/api/pembinaan/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      notify(`${data.saved} baris pembinaan ${batchGroupValue} berhasil disimpan dalam 1 batch.`, 'success');
      loadRecords();
      if (selectedSantri) loadPortfolio(selectedSantri);
      emitDataMutated();
    } catch {
      notify('Gagal menyimpan pembinaan klasikal.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: StatusTindakLanjut) => {
    const res = await fetch(`/api/pembinaan/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusTindakLanjut: nextStatus }),
    });
    if (res.ok) {
      loadRecords();
      if (selectedSantri) loadPortfolio(selectedSantri);
      emitDataMutated();
      notify(`Status tindak lanjut diubah menjadi ${nextStatus}.`, 'info');
    }
  };

  const handleDeleteRecord = async (id: string) => {
    const res = await fetch(`/api/pembinaan/${id}`, { method: 'DELETE' });
    if (res.ok) {
      notify('Baris catatan dihapus.', 'info');
      loadRecords();
      if (selectedSantri) loadPortfolio(selectedSantri);
      emitDataMutated();
    }
  };

  const handleExportDbCsv = () => {
    const header = [
      'Tanggal',
      'Bulan',
      'Pekan',
      'Wilayah',
      'Nama Santri',
      'Kelas',
      'Kamar',
      'Pembina',
      'Peran Pembina',
      'Lingkup',
      'Lokasi',
      'Koordinasi',
      'Status Tindak Lanjut',
      'Kategori',
      'Catatan Pembinaan',
      'Tindak Lanjut',
      'Poin',
      'Subuh',
      'Dzuhur',
      'Ashar',
      'Maghrib',
      'Isya',
      'Tahajud',
      'Dhuha',
      'Tilawah',
    ];
    const rows = records.map((r) => [
      formatTanggalIndo(r.tanggal),
      r.bulan,
      String(r.pekanKe),
      `Wilayah ${r.gender}`,
      r.namaSantri,
      r.kelas,
      r.kamar,
      r.pembinaNama,
      r.pembinaPeran,
      r.lingkup,
      r.lokasi,
      r.pihakKoordinasi,
      r.statusTindakLanjut,
      r.kategori,
      r.catatan,
      r.tindakLanjut,
      String(r.poin),
      r.ibadah.subuh ? 'TRUE' : 'FALSE',
      r.ibadah.dzuhur ? 'TRUE' : 'FALSE',
      r.ibadah.ashar ? 'TRUE' : 'FALSE',
      r.ibadah.maghrib ? 'TRUE' : 'FALSE',
      r.ibadah.isya ? 'TRUE' : 'FALSE',
      r.ibadah.tahajud ? 'TRUE' : 'FALSE',
      r.ibadah.dhuha ? 'TRUE' : 'FALSE',
      r.ibadah.tilawah ? 'TRUE' : 'FALSE',
    ]);
    const wSlug = wilayahFilter === 'Semua' ? 'PutraPutri' : `Wilayah_${wilayahFilter}`;
    downloadCsv(`DB_Klasikal_Tahunan_${wSlug}_${getTodayDateStr()}.csv`, [header, ...rows]);
    notify('DB_Klasikal_Tahunan berhasil diunduh sebagai CSV.', 'success');
  };

  const handlePrintDbPdf = () => {
    const rowsHtml =
      records.length === 0
        ? '<tr><td colspan="7">Belum ada data pembinaan pada filter wilayah ini.</td></tr>'
        : records
            .map(
              (r, idx) => `<tr>
              <td>${idx + 1}</td>
              <td>${formatTanggalIndo(r.tanggal)}<br><small>${r.bulan} · P${r.pekanKe}</small></td>
              <td><b>Wilayah ${r.gender}</b></td>
              <td class="left"><b>${r.namaSantri}</b><br><small>${r.kelas} · ${r.kamar}</small></td>
              <td class="left">${r.pembinaNama}<br><small>${r.pembinaPeran} · ${r.lokasi}</small></td>
              <td class="left"><b>${r.kategori}</b> (${r.statusTindakLanjut})<br>${r.catatan}</td>
              <td>${r.poin > 0 ? `+${r.poin}` : r.poin}</td>
            </tr>`
            )
            .join('');
    const wTitle = wilayahFilter === 'Semua' ? 'SEMUA WILAYAH (PUTRA & PUTRI)' : `WILAYAH ${wilayahFilter.toUpperCase()}`;
    printHtmlDocument(
      `Laporan_Pembinaan_${wilayahFilter}_${getTodayDateStr()}`,
      `
      <div class="doc-title">
        <h2>LAPORAN REKAPITULASI PEMBINAAN SANTRI · ${wTitle}</h2>
        <div>Total Catatan: ${records.length} · Kelas: ${filterKelas} · Kamar: ${filterKamar}</div>
      </div>
      <table>
        <thead><tr><th>No</th><th>Tanggal</th><th>Wilayah</th><th>Santri</th><th>Pembina</th><th>Kategori &amp; Catatan</th><th>Poin</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      `,
      true
    );
  };

  const handlePrintAnalisisPembinaan = () => {
    if (!analisis) return;
    const pa = analisis.pembinaanAnalisis.Putra;
    const pi = analisis.pembinaanAnalisis.Putri;
    const katRows = pa.kategoriCounts
      .map((k, idx) => {
        const piCount = pi.kategoriCounts[idx]?.count ?? 0;
        return `<tr><td class="left"><b>${k.kategori}</b></td><td>${k.count}</td><td>${piCount}</td><td>${k.count + piCount}</td></tr>`;
      })
      .join('');

    printHtmlDocument(
      `Analisis_Pembinaan_Putra_Putri_${getTodayDateStr()}`,
      `
      <div class="doc-title">
        <h2>HASIL ANALISIS SISTEM PEMBINAAN TERPADU (WILAYAH PUTRA VS PUTRI)</h2>
        <div>Dicetak pada ${formatTanggalIndo(getTodayDateStr())}</div>
      </div>
      <table>
        <thead><tr><th>Indikator Pembinaan</th><th>Wilayah Putra</th><th>Wilayah Putri</th></tr></thead>
        <tbody>
          <tr><td class="left">Jumlah Santri / Santri Terbina</td><td>${pa.totalSantri} / ${pa.santriDibina} santri</td><td>${pi.totalSantri} / ${pi.santriDibina} santri</td></tr>
          <tr><td class="left">Total Catatan Pembinaan</td><td>${pa.totalCatatan} catatan</td><td>${pi.totalCatatan} catatan</td></tr>
          <tr><td class="left">Capaian Sholat Wajib (5 Waktu)</td><td><b>${pa.persenSholatWajib}%</b></td><td><b>${pi.persenSholatWajib}%</b></td></tr>
          <tr><td class="left">Capaian Ibadah Sunnah &amp; Tilawah</td><td><b>${pa.persenIbadahSunnah}%</b></td><td><b>${pi.persenIbadahSunnah}%</b></td></tr>
          <tr><td class="left">Kasus Kedisiplinan / Prestasi</td><td>${pa.totalPelanggaran} pelanggaran · ${pa.totalPrestasi} prestasi</td><td>${pi.totalPelanggaran} pelanggaran · ${pi.totalPrestasi} prestasi</td></tr>
          <tr><td class="left">Status Tindak Lanjut (Selesai / Proses / Eskalasi)</td><td>${pa.statusCounts.Selesai} / ${pa.statusCounts.Proses} / ${pa.statusCounts.Eskalasi}</td><td>${pi.statusCounts.Selesai} / ${pi.statusCounts.Proses} / ${pi.statusCounts.Eskalasi}</td></tr>
        </tbody>
      </table>
      <h3 style="font-size:12px; margin:14px 0 6px 0;">Sebaran Kategori Pembinaan</h3>
      <table>
        <thead><tr><th>Kategori</th><th>Wilayah Putra</th><th>Wilayah Putri</th><th>Total</th></tr></thead>
        <tbody>${katRows}</tbody>
      </table>
      `
    );
  };

  const handlePrintPortfolio = () => {
    if (!portfolio?.santri) return;
    const s = portfolio.santri;
    const rowsHtml =
      portfolio.riwayatPembinaan.length === 0
        ? '<tr><td colspan="7">Belum ada riwayat pembinaan.</td></tr>'
        : portfolio.riwayatPembinaan
            .map((r, i) => {
              const wajibCount = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'].filter(
                (k) => r.ibadah[k as keyof IbadahChecklist]
              ).length;
              const sunnahCount = ['tahajud', 'dhuha', 'tilawah'].filter(
                (k) => r.ibadah[k as keyof IbadahChecklist]
              ).length;
              return `<tr>
                <td>${i + 1}</td>
                <td>${formatTanggalIndo(r.tanggal)}<br><small>${r.bulan} · P${r.pekanKe}</small></td>
                <td>${r.pembinaNama}<br><small>${r.pembinaPeran} · ${r.lokasi}</small></td>
                <td>${r.kategori}<br><small>${r.statusTindakLanjut}</small></td>
                <td class="left">${r.catatan}<br><small>Tindak lanjut (${r.pihakKoordinasi}): ${r.tindakLanjut}</small></td>
                <td>Wajib ${wajibCount}/5 · Sunnah ${sunnahCount}/3</td>
                <td>${r.poin > 0 ? `+${r.poin}` : r.poin}</td>
              </tr>`;
            })
            .join('');

    printHtmlDocument(
      `Portofolio_Wilayah_${s.gender}_${s.nama}`,
      `
      <div class="doc-title">
        <h2>PORTOFOLIO PEMBINAAN & IBADAH SANTRI · WILAYAH ${s.gender.toUpperCase()}</h2>
        <div>${s.nama} · Wilayah ${s.gender} · ${s.kelas} · Kamar ${s.kamar}</div>
      </div>
      <table class="meta-table">
        <tr><td style="width:22%">NIS / Nama</td><td>: <b>${s.nis || '-'} — ${s.nama}</b> (Wilayah ${s.gender})</td><td style="width:22%">Musyrif / Wali Kelas</td><td>: ${s.musyrif || '-'} / ${s.waliKelas || '-'}</td></tr>
        <tr><td>Kelas / Kamar</td><td>: ${s.kelas} · ${s.kamar}</td><td>Prioritas / Gaya Belajar</td><td>: ${s.prioritas || '-'} · ${s.gayaBelajar || '-'}</td></tr>
        <tr><td>Capaian Sholat Wajib</td><td>: <b>${portfolio.persenSholatWajib}%</b></td><td>Capaian Ibadah Sunnah</td><td>: <b>${portfolio.persenSholatSunnah}%</b></td></tr>
        <tr><td>Total Pelanggaran</td><td>: ${portfolio.totalPelanggaran} catatan</td><td>Net Poin Pembinaan</td><td>: <b>${portfolio.netPoin}</b></td></tr>
      </table>
      <table>
        <thead>
          <tr><th>No</th><th>Tanggal</th><th>Pembina & Lokasi</th><th>Kategori & Status</th><th>Catatan & Tindak Lanjut</th><th>Ibadah</th><th>Poin</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="sign-grid">
        <div class="sign-box">Mengetahui,<br/>Musyrif/ah &amp; Pengasuhan<div class="sign-space"></div><b>${s.musyrif || '_______________________'}</b></div>
        <div class="sign-box">Wali Kelas,<div class="sign-space"></div><b>${s.waliKelas || '_______________________'}</b></div>
      </div>
      `
    );
  };

  const setAllBatchIbadah = (mode: 'wajib' | 'all' | 'none') => {
    setBatchRows((prev) =>
      prev.map((row) => ({
        ...row,
        ibadah: {
          subuh: mode !== 'none',
          dzuhur: mode !== 'none',
          ashar: mode !== 'none',
          maghrib: mode !== 'none',
          isya: mode !== 'none',
          tahajud: mode === 'all',
          dhuha: mode === 'all',
          tilawah: mode === 'all',
        },
      }))
    );
  };

  if (students.length === 0 && subTab !== 'panduan') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            type="button"
            onClick={() => setSubTab('input')}
            className="rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 shadow-sm"
          >
            Input Pembinaan
          </button>
          <button
            type="button"
            onClick={() => setSubTab('panduan')}
            className="rounded-md px-3.5 py-2 text-xs font-semibold text-slate-600"
          >
            Rumus Sheets &amp; Proteksi
          </button>
        </div>

        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 via-white to-sky-50/50 p-10 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Belum Ada Data Santri di SIM</h3>
          <p className="mx-auto max-w-lg text-xs text-slate-600 leading-relaxed">
            Database saat ini kosong. Unduh template sesuai nama siswa, Musyrif, &amp; Wali Kelas lalu unggah di menu <b>Admin Super &amp; Upload SIM</b> agar Wali Kelas, Musyrif, Musyrifah, dan Guru dapat langsung melakukan pembinaan.
          </p>
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-violet-700 hover:to-indigo-700"
            >
              Buka Pusat Template &amp; Upload Admin Super
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-navigation + Wilayah Switcher */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSubTab('input')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'input' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              Isi Pembinaan (Wali Kelas &amp; Musyrif/ah)
            </button>
            <button
              type="button"
              onClick={() => setSubTab('portofolio')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'portofolio' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              5_Portofolio_Individu_Otomatis
            </button>
            <button
              type="button"
              onClick={() => setSubTab('database')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'database' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              DB_Klasikal_Tahunan ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('analisis')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'analisis' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Hasil Analisis Pembinaan
            </button>
            <button
              type="button"
              onClick={() => setSubTab('panduan')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                subTab === 'panduan' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Rumus Sheets &amp; Proteksi
            </button>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit shrink-0">
            {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWilayahFilter(w)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  wilayahFilter === w
                    ? w === 'Putri'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : w === 'Putra'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {w === 'Semua' ? 'Semua Wilayah' : `Wilayah ${w}`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            Pembina aktif:{' '}
            <span className="font-semibold text-violet-800">
              {pembinaNama || 'Belum Dipilih'} ({pembinaPeran})
            </span>
          </div>
          <div className="font-mono-num">
            Cakupan:{' '}
            <span className="font-semibold text-slate-900">
              {wilayahFilter === 'Semua' ? 'Wilayah Putra & Putri' : `Wilayah ${wilayahFilter}`}
            </span>{' '}
            ({scopedStudents.length} santri)
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CARA MEMASUKAN & MENGISI PEMBINAAN YANG DIROMBAK               */}
      {/* ===================================================================== */}
      {subTab === 'input' && (
        <div className="space-y-6">
          {/* Header Mode & Pembina Context */}
          <div className="rounded-xl border border-violet-200 bg-gradient-to-b from-violet-50/50 via-white to-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-violet-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Formulir Pembinaan Terpadu Boarding School
                </h2>
                <p className="text-xs text-slate-500">
                  Pilih mode <b>Pembinaan Individu</b> untuk konseling/kasus santri atau <b>Klasikal / Asrama</b> untuk pemantauan 1 kelas/kamar sekaligus.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('single');
                      setFormLingkup('Individu');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      inputMode === 'single' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Pembinaan Individu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('batch');
                      setFormLingkup('Klasikal');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${
                      inputMode === 'batch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Input Klasikal / Kamar
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMetaMinimized((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50 whitespace-nowrap"
                >
                  {metaMinimized ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Perluas Info
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Minimize
                    </>
                  )}
                </button>
              </div>
            </div>

            {metaMinimized ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white/80 px-3 py-2 text-xs text-slate-700">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-violet-900">
                    {pembinaNama || 'Pembina Belum Diisi'} ({pembinaPeran})
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="font-mono-num">{formTanggal}</span>
                  <span className="text-slate-400">·</span>
                  <span>
                    {formBulan} (Pekan {formPekan})
                  </span>
                  <span className="text-slate-400">·</span>
                  <span>{formLokasi}</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-semibold text-slate-900">Status: {formStatus}</span>
                </div>
              </div>
            ) : (
              /* Metadata Bar: Pembina, Tanggal, Bulan, Pekan, Lokasi, Koordinasi, Status */
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Pembina &amp; Peran</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      list="pembina-datalist"
                      value={pembinaNama}
                      onChange={(e) => setPembinaNama(e.target.value)}
                      placeholder="Nama Pembina..."
                      className="h-9 flex-1 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold"
                    />
                    <datalist id="pembina-datalist">
                      {teachers.map((t) => (
                        <option key={t.id} value={t.nama} />
                      ))}
                    </datalist>
                    <select
                      value={pembinaPeran}
                      onChange={(e) => setPembinaPeran(e.target.value)}
                      className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-semibold"
                    >
                      <option value="Wali Kelas">Wali Kelas</option>
                      <option value="Musyrif">Musyrif</option>
                      <option value="Musyrifah">Musyrifah</option>
                      <option value="Guru">Guru</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={formTanggal}
                    onChange={(e) => {
                      setFormTanggal(e.target.value);
                      setFormBulan(getBulanFromDate(e.target.value));
                    }}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bulan</label>
                  <select
                    value={formBulan}
                    onChange={(e) => setFormBulan(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium"
                  >
                    {BULAN_LIST.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pekan (1–32)</label>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={formPekan}
                    onChange={(e) => setFormPekan(Number(e.target.value))}
                    className="h-9 w-full rounded-lg border border-slate-300 px-2 text-xs font-mono-num"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lokasi</label>
                  <select
                    value={formLokasi}
                    onChange={(e) => setFormLokasi(e.target.value as LokasiPembinaan)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium"
                  >
                    {LOKASI_LIST.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pihak Koordinasi</label>
                  <select
                    value={formKoordinasi}
                    onChange={(e) => setFormKoordinasi(e.target.value as PihakKoordinasi)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium"
                  >
                    {KOORDINASI_LIST.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status Tindak Lanjut</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as StatusTindakLanjut)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold"
                  >
                    {STATUS_LIST.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {inputMode === 'single' ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* Left: Santri Selector + Profil Pembinaan */}
              <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Cari &amp; Pilih Santri</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Ketik nama, NIS, atau kamar..."
                        className="h-9 w-full rounded-lg border border-slate-300 pl-8 pr-3 text-xs"
                      />
                    </div>
                    <select
                      value={studentFilterGroup}
                      onChange={(e) => setStudentFilterGroup(e.target.value)}
                      className="h-9 max-w-[160px] rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-medium"
                    >
                      <option value="SEMUA">Semua Kelas/Kamar</option>
                      {uniqueClasses.map((k) => (
                        <option key={k} value={k}>
                          Kelas: {k}
                        </option>
                      ))}
                      {uniqueRooms.map((r) => (
                        <option key={r} value={r}>
                          Kamar: {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={formSantri}
                    onChange={(e) => setFormSantri(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-900"
                  >
                    {filteredSingleStudents.map((s) => (
                      <option key={s.id} value={s.nama}>
                        {s.nama} — {s.kelas} · {s.kamar}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Student Profile Quick Card */}
                {activeSingleStudent && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div>
                        <div className="font-semibold text-slate-900">{activeSingleStudent.nama}</div>
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          NIS: {activeSingleStudent.nis || '-'} · {activeSingleStudent.gender}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingProfile((v) => !v)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 className="h-3 w-3" />
                        {editingProfile ? 'Tutup Edit' : 'Lengkapi Profil'}
                      </button>
                    </div>

                    {!editingProfile ? (
                      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px]">
                        <div>
                          <span className="text-slate-500">Kelas:</span>{' '}
                          <span className="font-semibold text-slate-800">{activeSingleStudent.kelas}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Kamar:</span>{' '}
                          <span className="font-semibold text-slate-800">{activeSingleStudent.kamar}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Musyrif/ah:</span>{' '}
                          <span className="font-semibold text-slate-800">{activeSingleStudent.musyrif || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Prioritas:</span>{' '}
                          <span
                            className={`font-semibold ${
                              activeSingleStudent.prioritas === 'Intensif'
                                ? 'text-rose-700'
                                : activeSingleStudent.prioritas === 'Rutin'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {activeSingleStudent.prioritas || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Gaya Belajar:</span>{' '}
                          <span className="font-medium text-slate-800">{activeSingleStudent.gayaBelajar || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Target Kampus:</span>{' '}
                          <span className="font-medium text-slate-800">{activeSingleStudent.targetKampus || '-'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500">Ortu / WA:</span>{' '}
                          <span className="font-medium text-slate-800">
                            {activeSingleStudent.namaOrtu || '-'} ({activeSingleStudent.waOrtu || '-'})
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500">Riwayat Kesehatan / Obat:</span>{' '}
                          <span className="font-medium text-slate-800">
                            {activeSingleStudent.riwayatPenyakit || '-'} / {activeSingleStudent.obatRutin || '-'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Prioritas</label>
                            <select
                              value={profPrioritas}
                              onChange={(e) => setProfPrioritas(e.target.value as PrioritasPembinaan)}
                              className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                            >
                              <option value="-">-</option>
                              <option value="Mandiri">Mandiri</option>
                              <option value="Rutin">Rutin</option>
                              <option value="Intensif">Intensif</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Gaya Belajar</label>
                            <input
                              type="text"
                              value={profGayaBelajar}
                              onChange={(e) => setProfGayaBelajar(e.target.value)}
                              placeholder="Visual / Auditori / Kinestetik"
                              className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={profNamaOrtu}
                            onChange={(e) => setProfNamaOrtu(e.target.value)}
                            placeholder="Nama Ortu/Wali"
                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                          />
                          <input
                            type="text"
                            value={profWaOrtu}
                            onChange={(e) => setProfWaOrtu(e.target.value)}
                            placeholder="WA Ortu (628...)"
                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-mono-num"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={profPenyakit}
                            onChange={(e) => setProfPenyakit(e.target.value)}
                            placeholder="Riwayat Penyakit/Alergi"
                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                          />
                          <input
                            type="text"
                            value={profObat}
                            onChange={(e) => setProfObat(e.target.value)}
                            placeholder="Obat Rutin"
                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                          />
                        </div>
                        <input
                          type="text"
                          value={profTarget}
                          onChange={(e) => setProfTarget(e.target.value)}
                          placeholder="Target Kampus / Cita-cita"
                          className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleSaveStudentProfile}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Simpan Profil Santri
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Pembinaan Form */}
              <form
                onSubmit={handleSaveSingle}
                className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lingkup</label>
                    <select
                      value={formLingkup}
                      onChange={(e) => setFormLingkup(e.target.value as LingkupPembinaan)}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                    >
                      {LINGKUP_LIST.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Pembinaan</label>
                    <select
                      value={formKategori}
                      onChange={(e) => setFormKategori(e.target.value as PembinaanKategori)}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                    >
                      {KATEGORI_LIST.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Poin (-/+)</label>
                    <input
                      type="number"
                      value={formPoin}
                      onChange={(e) => setFormPoin(Number(e.target.value))}
                      className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-mono-num"
                    />
                  </div>
                </div>

                {/* Preset Point Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 mr-1">Preset Poin:</span>
                  {[
                    { label: '+10 Prestasi/Teladan', val: 10 },
                    { label: '0 Pembinaan Rutin', val: 0 },
                    { label: '-5 Pelanggaran Ringan', val: -5 },
                    { label: '-15 Pelanggaran Sedang', val: -15 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setFormPoin(p.val)}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan / Temuan / Kasus Pembinaan *
                  </label>
                  <textarea
                    rows={3}
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="Tuliskan hasil pemantauan, capaian hafalan/karakter, atau kendala santri..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tindak Lanjut &amp; Rencana Koordinasi
                  </label>
                  <input
                    type="text"
                    value={formTindakLanjut}
                    onChange={(e) => setFormTindakLanjut(e.target.value)}
                    placeholder="Contoh: Konseling asrama bersama musyrif / Hubungi wali santri..."
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs focus:border-teal-600 focus:outline-none"
                  />
                </div>

                {/* 8 Worship Checkboxes with Quick Controls */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Pemantauan Ibadah Harian (8 Checkbox)
                    </span>
                    <div className="flex gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setFormIbadah({
                            subuh: true,
                            dzuhur: true,
                            ashar: true,
                            maghrib: true,
                            isya: true,
                            tahajud: false,
                            dhuha: false,
                            tilawah: false,
                          })
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Wajib (5)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFormIbadah({
                            subuh: true,
                            dzuhur: true,
                            ashar: true,
                            maghrib: true,
                            isya: true,
                            tahajud: true,
                            dhuha: true,
                            tilawah: true,
                          })
                        }
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 font-medium text-teal-700 hover:bg-teal-50"
                      >
                        Semua (8)
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {IBADAH_FIELDS.map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={formIbadah[item.key]}
                          onChange={(e) =>
                            setFormIbadah((prev) => ({ ...prev, [item.key]: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-teal-700"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Cloud Storage Lampiran Bukti (Surat Sakit / Sertifikat / Bukti Pelanggaran) */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Lampiran Bukti Cloud Storage (Opsional: Foto Surat Sakit / Sertifikat / Bukti)
                    </span>
                    {formLampiranNama && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormLampiranNama('');
                          setFormLampiranUrl('');
                        }}
                        className="text-[11px] font-semibold text-rose-700 hover:underline"
                      >
                        Hapus Lampiran ({formLampiranNama})
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <select
                      value={formLampiranTipe}
                      onChange={(e) =>
                        setFormLampiranTipe(
                          e.target.value as
                            | 'Surat Sakit Dokter'
                            | 'Sertifikat Lomba'
                            | 'Bukti Pelanggaran'
                            | 'Surat Izin Ortu'
                            | 'Lainnya'
                        )
                      }
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                    >
                      <option value="Surat Sakit Dokter">Surat Sakit Dokter</option>
                      <option value="Sertifikat Lomba">Sertifikat Lomba / Prestasi</option>
                      <option value="Bukti Pelanggaran">Bukti Pelanggaran</option>
                      <option value="Surat Izin Ortu">Surat Izin Orang Tua</option>
                      <option value="Lainnya">Dokumen Lainnya</option>
                    </select>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileAttachmentChange}
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-teal-50 file:px-2 file:py-0.5 file:text-xs file:font-semibold file:text-teal-800"
                    />
                  </div>
                  {formLampiranUrl && formLampiranUrl.startsWith('data:image') && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={formLampiranUrl}
                        alt={formLampiranNama}
                        className="h-14 w-20 rounded border border-slate-300 object-cover bg-white"
                      />
                      <div className="text-[11px] text-slate-600">
                        <div className="font-semibold text-slate-900">{formLampiranNama}</div>
                        <div>Kategori: {formLampiranTipe} · Siap disimpan ke Cloud Storage</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSantri(formSantri);
                      setSubTab('portofolio');
                    }}
                    className="text-xs font-semibold text-teal-700 hover:underline"
                  >
                    Lihat Portofolio {formSantri} →
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formSantri}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300 whitespace-nowrap shrink-0"
                  >
                    <BookCheck className="h-4 w-4" />
                    {saving ? 'Menyimpan...' : 'Simpan Catatan Pembinaan'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Mode B: Batch 1 Kelas / 1 Kamar / 1 Halaqah */
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kelompokkan Berdasarkan</label>
                  <select
                    value={batchGroupType}
                    onChange={(e) => setBatchGroupType(e.target.value as 'kelas' | 'kamar' | 'kelompokQuran')}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                  >
                    <option value="kelas">Per Kelas (Wali Kelas / Guru)</option>
                    <option value="kamar">Per Kamar (Musyrif / Musyrifah)</option>
                    <option value="kelompokQuran">Per Kelompok Al-Qur&apos;an</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Target</label>
                  <select
                    value={batchGroupValue}
                    onChange={(e) => setBatchGroupValue(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-semibold"
                  >
                    {batchGroupOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Default</label>
                  <select
                    value={batchKategori}
                    onChange={(e) => setBatchKategori(e.target.value as PembinaanKategori)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                  >
                    {KATEGORI_LIST.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
                <span className="font-semibold text-slate-700">
                  Aksi Cepat Ibadah ({batchRows.length} santri di {batchGroupValue || '-'}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllBatchIbadah('wajib')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Centang Wajib Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllBatchIbadah('all')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-teal-700 hover:bg-teal-50"
                  >
                    Centang Semua 8 Ibadah
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllBatchIbadah('none')}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Kosongkan Centang
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Nama Santri</th>
                      {IBADAH_FIELDS.map((f) => (
                        <th key={f.key} className="px-2 py-2.5 text-center font-semibold">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 font-semibold">Catatan Singkat</th>
                      <th className="px-2 py-2.5 font-semibold text-right">Poin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                          Tidak ada santri pada kelompok ini.
                        </td>
                      </tr>
                    ) : (
                      batchRows.map((row, idx) => (
                        <tr key={row.namaSantri} className="hover:bg-slate-50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{row.namaSantri}</div>
                            <div className="text-[10px] text-slate-500">
                              {row.kelas} · {row.kamar}
                            </div>
                          </td>
                          {IBADAH_FIELDS.map((f) => (
                            <td key={f.key} className="px-2 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={row.ibadah[f.key]}
                                onChange={(e) =>
                                  setBatchRows((prev) =>
                                    prev.map((item, i) =>
                                      i === idx
                                        ? { ...item, ibadah: { ...item.ibadah, [f.key]: e.target.checked } }
                                        : item
                                    )
                                  )
                                }
                                className="h-4 w-4 rounded border-slate-300 text-teal-700"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={row.catatan}
                              onChange={(e) =>
                                setBatchRows((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, catatan: e.target.value } : item))
                                )
                              }
                              className="h-7 w-full min-w-[160px] rounded border border-slate-200 px-2 text-xs"
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <input
                              type="number"
                              value={row.poin}
                              onChange={(e) =>
                                setBatchRows((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, poin: Number(e.target.value) } : item))
                                )
                              }
                              className="h-7 w-14 rounded border border-slate-200 px-1.5 text-right text-xs font-mono-num"
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Disimpan dalam 1 permintaan batch (hemat kuota &amp; atomik).
                </span>
                <button
                  type="button"
                  disabled={saving || batchRows.length === 0}
                  onClick={handleSaveBatch}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
                >
                  <BookCheck className="h-4 w-4" />
                  {saving ? 'Menyimpan Batch...' : `Simpan Pembinaan ${batchGroupValue}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: 5_Portofolio_Individu_Otomatis (Perlu Login)                   */}
      {/* ===================================================================== */}
      {subTab === 'portofolio' && !unlockedTeacher && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <h3 className="text-base font-semibold text-slate-900">
            Login Diperlukan untuk Melihat Portofolio &amp; Progres Santri
          </h3>
          <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
            Pengisian pembinaan dapat dilakukan langsung tanpa login di tab <b>Isi Pembinaan</b>. Untuk membuka rekapan portofolio individu dan progres pembinaan, silakan masuk akun terlebih dahulu.
          </p>
          {onRequestLogin && (
            <button
              type="button"
              onClick={onRequestLogin}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Masuk Akun Guru / Wali Kelas / Musyrif
            </button>
          )}
        </div>
      )}
      {subTab === 'portofolio' && unlockedTeacher && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1 max-w-md">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Pilih Nama Santri (5_Portofolio_Individu_Otomatis)
                </label>
                <select
                  value={selectedSantri}
                  onChange={(e) => setSelectedSantri(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                >
                  {scopedStudents.map((s) => (
                    <option key={s.id} value={s.nama}>
                      {s.nama} — {s.gender} · {s.kelas} ({s.kamar})
                    </option>
                  ))}
                </select>
              </div>

              {portfolio?.santri && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
                  <div className="space-y-0.5 text-xs text-slate-600">
                    <div className="font-semibold text-slate-900">
                      {portfolio.santri.nama} · NIS {portfolio.santri.nis || '-'}
                    </div>
                    <div>
                      Kelas {portfolio.santri.kelas} · Kamar {portfolio.santri.kamar} · Prioritas:{' '}
                      <b>{portfolio.santri.prioritas || '-'}</b>
                    </div>
                    <div>
                      Musyrif/ah: {portfolio.santri.musyrif || '-'} · Wali Kelas: {portfolio.santri.waliKelas || '-'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrintPortfolio}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Cetak Portofolio
                  </button>
                </div>
              )}
            </div>
          </div>

          {loadingPortfolio || !portfolio ? (
            <div className="h-32 animate-pulse rounded-xl bg-slate-200" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Capaian Sholat Wajib (5 Waktu)</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-mono-num text-3xl font-bold text-emerald-700">
                      {portfolio.persenSholatWajib}%
                    </span>
                    <span className="text-xs text-slate-500 font-mono-num">{portfolio.totalCatatan} entri</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-emerald-600" style={{ width: `${portfolio.persenSholatWajib}%` }} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Capaian Ibadah Sunnah &amp; Tilawah</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-mono-num text-3xl font-bold text-teal-700">
                      {portfolio.persenSholatSunnah}%
                    </span>
                    <span className="text-xs text-slate-500">Tahajud · Dhuha · Tilawah</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-teal-600" style={{ width: `${portfolio.persenSholatSunnah}%` }} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Pelanggaran &amp; Prestasi</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="font-mono-num text-3xl font-bold text-slate-900">
                      {portfolio.totalPelanggaran}
                    </span>
                    <span className="text-xs text-slate-500 font-mono-num">
                      {portfolio.totalPrestasi} prestasi · {portfolio.totalCatatan} total
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-600">
                    Net Poin:{' '}
                    <span
                      className={`font-mono-num font-bold ${
                        portfolio.netPoin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {portfolio.netPoin > 0 ? `+${portfolio.netPoin}` : portfolio.netPoin}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-xs font-medium text-slate-500">Presensi Terpadu</div>
                  <div className="mt-2 space-y-1 text-xs font-mono-num">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Akademik</span>
                      <span>
                        H:{portfolio.rekapPresensi.akademik.H} S/I/A:
                        {portfolio.rekapPresensi.akademik.S +
                          portfolio.rekapPresensi.akademik.I +
                          portfolio.rekapPresensi.akademik.A}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Asrama</span>
                      <span>
                        H:{portfolio.rekapPresensi.asrama.H} S/I/A:
                        {portfolio.rekapPresensi.asrama.S +
                          portfolio.rekapPresensi.asrama.I +
                          portfolio.rekapPresensi.asrama.A}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Qur&apos;an &amp; Ujian</span>
                      <span>
                        Q:{portfolio.rekapPresensi.alquran.H} · U:{portfolio.rekapPresensi.ujian.H}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Riwayat Pembinaan Wali Kelas &amp; Musyrif/ah ({portfolio.riwayatPembinaan.length} baris)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Tanggal &amp; Bulan</th>
                        <th className="px-3 py-3 font-semibold">Pembina &amp; Lokasi</th>
                        <th className="px-3 py-3 font-semibold">Kategori &amp; Status</th>
                        <th className="px-4 py-3 font-semibold">Catatan &amp; Tindak Lanjut</th>
                        <th className="px-3 py-3 text-center font-semibold">Ibadah</th>
                        <th className="px-4 py-3 text-right font-semibold">Poin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {portfolio.riwayatPembinaan.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                            Belum ada riwayat pembinaan untuk santri ini.
                          </td>
                        </tr>
                      ) : (
                        portfolio.riwayatPembinaan.map((r) => {
                          const wCount = (['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'] as const).filter(
                            (k) => r.ibadah[k]
                          ).length;
                          const sCount = (['tahajud', 'dhuha', 'tilawah'] as const).filter((k) => r.ibadah[k]).length;
                          return (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-mono-num font-semibold text-slate-900">
                                  {formatTanggalIndo(r.tanggal)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {r.bulan} · Pekan {r.pekanKe}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-semibold text-slate-800">{r.pembinaNama}</div>
                                <div className="text-[11px] text-slate-500">
                                  {r.pembinaPeran} · {r.lokasi} ({r.lingkup})
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="font-medium text-slate-800">{r.kategori}</div>
                                <div
                                  className={`text-[11px] font-semibold ${
                                    r.statusTindakLanjut === 'Eskalasi'
                                      ? 'text-rose-700'
                                      : r.statusTindakLanjut === 'Proses'
                                      ? 'text-amber-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {r.statusTindakLanjut} ({r.pihakKoordinasi})
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900">{r.catatan}</div>
                                <div className="text-[11px] text-slate-500">Tindak lanjut: {r.tindakLanjut}</div>
                              </td>
                              <td className="px-3 py-3 text-center font-mono-num">
                                <span className="font-semibold text-emerald-700">{wCount}/5</span> ·{' '}
                                <span className="font-semibold text-teal-700">{sCount}/3</span>
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono-num font-bold ${
                                  r.poin > 0 ? 'text-emerald-700' : r.poin < 0 ? 'text-rose-700' : 'text-slate-500'
                                }`}
                              >
                                {r.poin > 0 ? `+${r.poin}` : r.poin}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: DB_Klasikal_Tahunan (Database Log Terpusat - Perlu Login)      */}
      {/* ===================================================================== */}
      {subTab === 'database' && !unlockedTeacher && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <h3 className="text-base font-semibold text-slate-900">
            Login Diperlukan untuk Melihat Rekapan Database Pembinaan
          </h3>
          <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
            Input pembinaan di tab pertama terbuka tanpa login. Untuk melihat dan mengunduh rekapan <b>DB_Klasikal_Tahunan</b>, silakan masuk akun Guru, Wali Kelas, atau Musyrif/ah.
          </p>
          {onRequestLogin && (
            <button
              type="button"
              onClick={onRequestLogin}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Masuk Akun Guru / Wali Kelas / Musyrif
            </button>
          )}
        </div>
      )}
      {subTab === 'database' && unlockedTeacher && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Database Pembinaan Terpusat (DB_Klasikal_Tahunan)
              </h3>
              <p className="text-xs text-slate-500 font-mono-num">{records.length} catatan pembinaan</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium"
              >
                <option value="SEMUA">Semua Kelas</option>
                {uniqueClasses.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <select
                value={filterKamar}
                onChange={(e) => setFilterKamar(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium"
              >
                <option value="SEMUA">Semua Kamar</option>
                {uniqueRooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={filterPeran}
                onChange={(e) => setFilterPeran(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium"
              >
                <option value="SEMUA">Semua Peran</option>
                <option value="Wali Kelas">Wali Kelas</option>
                <option value="Musyrif">Musyrif</option>
                <option value="Musyrifah">Musyrifah</option>
                <option value="Guru">Guru</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium"
              >
                <option value="SEMUA">Semua Status</option>
                {STATUS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handlePrintDbPdf}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak PDF
              </button>
              <button
                type="button"
                onClick={handleExportDbCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Tanggal / Bulan</th>
                  <th className="px-3 py-2.5 font-semibold">Santri &amp; Wilayah</th>
                  <th className="px-3 py-2.5 font-semibold">Pembina &amp; Lokasi</th>
                  <th className="px-3 py-2.5 font-semibold">Catatan &amp; Koordinasi</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Poin</th>
                  <th className="px-2 py-2.5 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingRecords ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Memuat DB_Klasikal_Tahunan...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      Belum ada catatan pembinaan tersimpan untuk wilayah ini. Mulai isi di tab <b>Isi Pembinaan</b>.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-mono-num font-semibold text-slate-900">{formatTanggalIndo(r.tanggal)}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.bulan} · P{r.pekanKe}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSantri(r.namaSantri);
                            setSubTab('portofolio');
                          }}
                          className="font-semibold text-teal-800 hover:underline text-left"
                        >
                          {r.namaSantri}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          <span className={`font-semibold ${r.gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'}`}>
                            Wilayah {r.gender}
                          </span>{' '}
                          · {r.kelas} · {r.kamar}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-800">{r.pembinaNama}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.pembinaPeran} · {r.lokasi}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 max-w-xs">
                        <div className="font-semibold text-slate-800">{r.kategori}</div>
                        <div className="text-slate-600 truncate" title={r.catatan}>
                          {r.catatan}
                        </div>
                        <div className="text-[10px] text-slate-400">Koordinasi: {r.pihakKoordinasi}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={r.statusTindakLanjut}
                          onChange={(e) => handleUpdateStatus(r.id, e.target.value as StatusTindakLanjut)}
                          className="h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] font-semibold"
                        >
                          {STATUS_LIST.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className={`px-2 py-2.5 text-right font-mono-num font-bold ${
                          r.poin > 0 ? 'text-emerald-700' : r.poin < 0 ? 'text-rose-700' : 'text-slate-500'
                        }`}
                      >
                        {r.poin > 0 ? `+${r.poin}` : r.poin}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r.id)}
                          title="Hapus baris"
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: HASIL ANALISIS PEMBINAAN (Wilayah Putra vs Putri - Perlu Login) */}
      {/* ===================================================================== */}
      {subTab === 'analisis' && !unlockedTeacher && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <h3 className="text-base font-semibold text-slate-900">
            Login Diperlukan untuk Melihat Hasil Analisis Pembinaan
          </h3>
          <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
            Pengisian pembinaan di tab pertama terbuka tanpa login. Untuk membuka hasil analisis pembinaan Wilayah Putra &amp; Wilayah Putri, silakan masuk akun terlebih dahulu.
          </p>
          {onRequestLogin && (
            <button
              type="button"
              onClick={onRequestLogin}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Masuk Akun Guru / Wali Kelas / Musyrif
            </button>
          )}
        </div>
      )}

      {subTab === 'analisis' && unlockedTeacher && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Hasil Analisis Sistem Pembinaan ({wilayahFilter === 'Semua' ? 'Putra & Putri' : `Wilayah ${wilayahFilter}`})
              </h3>
              <p className="text-xs text-slate-500">
                Evaluasi otomatis capaian ibadah, sebaran kategori pembinaan, prioritas pendampingan, dan kasus eskalasi per wilayah.
              </p>
            </div>
            <button
              type="button"
              disabled={!analisis || loadingAnalisis}
              onClick={handlePrintAnalisisPembinaan}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak Analisis Pembinaan (PDF)
            </button>
          </div>

          {loadingAnalisis || !analisis ? (
            <div className="h-44 animate-pulse rounded-xl bg-slate-200" />
          ) : (() => {
            const activeSummary = analisis.pembinaanAnalisis[wilayahFilter];
            return (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold text-slate-500">Santri Terbina</div>
                    <div className="mt-1.5 font-mono-num text-2xl font-bold text-slate-900">
                      {activeSummary.santriDibina}/{activeSummary.totalSantri}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold text-slate-500">Total Catatan</div>
                    <div className="mt-1.5 font-mono-num text-2xl font-bold text-violet-700">
                      {activeSummary.totalCatatan}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold text-slate-500">Sholat Wajib</div>
                    <div className="mt-1.5 font-mono-num text-2xl font-bold text-emerald-700">
                      {activeSummary.persenSholatWajib}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold text-slate-500">Ibadah Sunnah</div>
                    <div className="mt-1.5 font-mono-num text-2xl font-bold text-teal-700">
                      {activeSummary.persenIbadahSunnah}%
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold text-slate-500">Pelanggaran</div>
                    <div className="mt-1.5 font-mono-num text-2xl font-bold text-amber-700">
                      {activeSummary.totalPelanggaran}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold text-slate-500">Status Eskalasi</div>
                    <div className="mt-1.5 font-mono-num text-2xl font-bold text-rose-700">
                      {activeSummary.statusCounts.Eskalasi}
                    </div>
                  </div>
                </div>

                {/* Comparison cards Putra vs Putri */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {(['Putra', 'Putri'] as const).map((w) => {
                    const sum = analisis.pembinaanAnalisis[w];
                    return (
                      <div key={w} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h4 className={`text-sm font-bold ${w === 'Putri' ? 'text-rose-800' : 'text-sky-800'}`}>
                            Wilayah {w}
                          </h4>
                          <span className="font-mono-num text-xs text-slate-600">
                            {sum.santriDibina}/{sum.totalSantri} santri · {sum.totalCatatan} catatan
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono-num">
                          <div className="rounded-lg bg-emerald-50 p-3">
                            <div className="text-[11px] font-sans text-emerald-800">Sholat Wajib 5 Waktu</div>
                            <div className="mt-0.5 text-lg font-bold text-emerald-700">{sum.persenSholatWajib}%</div>
                          </div>
                          <div className="rounded-lg bg-teal-50 p-3">
                            <div className="text-[11px] font-sans text-teal-800">Sunnah &amp; Tilawah</div>
                            <div className="mt-0.5 text-lg font-bold text-teal-700">{sum.persenIbadahSunnah}%</div>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="font-semibold text-slate-700">Sebaran Kategori</div>
                          {sum.kategoriCounts.map((kat) => (
                            <div key={kat.kategori} className="flex items-center justify-between text-slate-600">
                              <span>{kat.kategori}</span>
                              <span className="font-mono-num font-bold text-slate-900">{kat.count}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-slate-100 pt-2.5 text-[11px] text-slate-600 font-mono-num flex flex-wrap gap-x-3 gap-y-1">
                          <span>Tindak Lanjut: Selesai {sum.statusCounts.Selesai}</span>
                          <span>· Proses {sum.statusCounts.Proses}</span>
                          <span className="text-rose-700 font-semibold">· Eskalasi {sum.statusCounts.Eskalasi}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Prioritas Perhatian */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Daftar Santri Prioritas Pendampingan ({wilayahFilter === 'Semua' ? 'Semua Wilayah' : `Wilayah ${wilayahFilter}`})
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5 font-semibold">Nama Santri</th>
                          <th className="px-3 py-2.5 font-semibold">Wilayah</th>
                          <th className="px-3 py-2.5 font-semibold">Kelas / Kamar</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Catatan</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Pelanggaran</th>
                          <th className="px-3 py-2.5 text-right font-semibold">Wajib %</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Net Poin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeSummary.topAttentionStudents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                              Belum ada data analisis pembinaan untuk wilayah ini.
                            </td>
                          </tr>
                        ) : (
                          activeSummary.topAttentionStudents.map((st) => (
                            <tr key={st.nama} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSantri(st.nama);
                                    setSubTab('portofolio');
                                  }}
                                  className="font-semibold text-teal-800 hover:underline text-left"
                                >
                                  {st.nama}
                                </button>
                              </td>
                              <td
                                className={`px-3 py-2.5 font-semibold ${
                                  st.gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                                }`}
                              >
                                Wilayah {st.gender}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600">
                                {st.kelas} · {st.kamar}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono-num">{st.totalCatatan}</td>
                              <td className="px-3 py-2.5 text-right font-mono-num font-semibold text-rose-700">
                                {st.pelanggaran}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono-num">{st.wajibPct}%</td>
                              <td
                                className={`px-4 py-2.5 text-right font-mono-num font-bold ${
                                  st.netPoin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {st.netPoin > 0 ? `+${st.netPoin}` : st.netPoin}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: PANDUAN RUMUS SPREADSHEET                                     */}
      {/* ===================================================================== */}
      {subTab === 'panduan' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Panduan Rumus Spreadsheet Pembinaan Wali Kelas (Google Sheets &amp; Excel)
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Jika Bapak/Ibu juga memelihara file spreadsheet cadangan, gunakan rumus bebas-script berikut.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { title: 'Persentase Sholat Wajib (Subuh–Isya, Kolom I:M)', formula: SPREADSHEET_FORMULAS.gsCountWajib },
              { title: 'Persentase Sholat Sunnah & Tilawah (Kolom N:P)', formula: SPREADSHEET_FORMULAS.gsCountSunnah },
              { title: 'Total Kedisiplinan / Pelanggaran', formula: SPREADSHEET_FORMULAS.gsCountPelanggaran },
              { title: 'Penarikan Riwayat Otomatis Google Sheets (=QUERY)', formula: SPREADSHEET_FORMULAS.gsQueryHistory },
              { title: 'Alternatif Excel 365 (=SORT(FILTER(...)))', formula: SPREADSHEET_FORMULAS.excelFilterHistory },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-slate-800">{item.title}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(item.formula);
                      notify(`Rumus "${item.title}" disalin.`, 'success');
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 shrink-0"
                  >
                    <Copy className="h-3 w-3" />
                    Salin
                  </button>
                </div>
                <pre className="overflow-x-auto rounded bg-slate-900 p-2.5 text-[11px] font-mono-num text-emerald-300">
                  {item.formula}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
