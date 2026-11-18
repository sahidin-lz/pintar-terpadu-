import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Edit3,
  FileSpreadsheet,
  Grid3X3,
  Home,
  List,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type {
  Gender,
  RoomMapping,
  ScheduleItem,
  Student,
  TeacherPublic,
  WilayahFilter,
} from '../types';
import {
  downloadComponentExcelTemplate,
  parseDatabaseExcelBuffer,
  triggerExcelDownloadFromSpec,
} from '../utils/excelParser';
import { loadSubTab, saveSubTab } from '../utils/sessionPersistence';

interface JadwalModuleProps {
  currentUser: TeacherPublic | null;
  teachers: TeacherPublic[];
  kelasList: string[];
  kelompokList: string[];
  rooms: RoomMapping[];
  onChanged: () => void;
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const HARI_CONFIG: Array<{ hari: string; maxJp: number }> = [
  { hari: 'SENIN', maxJp: 6 },
  { hari: 'SELASA', maxJp: 9 },
  { hari: 'RABU', maxJp: 9 },
  { hari: 'KAMIS', maxJp: 9 },
  { hari: 'JUMAT', maxJp: 6 },
  { hari: 'SABTU', maxJp: 7 },
];

const HARI_LIST = HARI_CONFIG.map((h) => h.hari);

function getMaxJpForDay(hari: string): number {
  const found = HARI_CONFIG.find((h) => h.hari === hari.toUpperCase());
  return found ? found.maxJp : 6;
}

function parseJamRange(jamStr: string, maxJp: number): number[] {
  const clean = String(jamStr || '').trim();
  if (!clean) return [];
  const parts = clean.split(/[-–,]/).map((p) => Number.parseInt(p.replace(/[^\d]/g, ''), 10));
  if (parts.length === 1 && Number.isFinite(parts[0])) {
    const n = parts[0];
    return n >= 1 && n <= maxJp ? [n] : [];
  }
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    const start = Math.max(1, Math.min(parts[0], parts[1]));
    const end = Math.min(maxJp, Math.max(parts[0], parts[1]));
    const out: number[] = [];
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }
  return [];
}

function inferClassGender(kelasName: string): Gender {
  const up = kelasName.toUpperCase();
  if (
    up.includes('PUTRI') ||
    up.includes('AKHWAT') ||
    up.includes('KHADIJAH') ||
    up.includes('AISYAH') ||
    up.includes('FATIMAH') ||
    up.includes('HAFSHAH') ||
    up.includes('RUQAYYAH')
  ) {
    return 'Putri';
  }
  return 'Putra';
}

export const JadwalModule: React.FC<JadwalModuleProps> = ({
  currentUser,
  teachers,
  kelasList,
  kelompokList,
  rooms,
  onChanged,
  notify,
}) => {
  const [subTab, setSubTab] = useState<'mengajar' | 'pindah' | 'asrama'>(() =>
    loadSubTab('pintar_jadwal_subtab_v1', ['mengajar', 'pindah', 'asrama'] as const, 'mengajar'),
  );
  const [viewMode, setViewMode] = useState<'matriks' | 'tabel'>(() =>
    loadSubTab('pintar_jadwal_view_v1', ['matriks', 'tabel'] as const, 'matriks'),
  );
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [formMinimized, setFormMinimized] = useState<boolean>(false);

  const [scopeFilter, setScopeFilter] = useState<'mine' | 'all'>('all');
  const [selectedDayMatrix, setSelectedDayMatrix] = useState<string>(() =>
    loadSubTab('pintar_jadwal_day_v1', ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const, 'SENIN'),
  );
  const [filterHari, setFilterHari] = useState<string>('SEMUA');
  const [filterWilayah, setFilterWilayah] = useState<WilayahFilter>('Semua');

  useEffect(() => {
    saveSubTab('pintar_jadwal_subtab_v1', subTab);
  }, [subTab]);

  useEffect(() => {
    saveSubTab('pintar_jadwal_view_v1', viewMode);
  }, [viewMode]);

  useEffect(() => {
    saveSubTab('pintar_jadwal_day_v1', selectedDayMatrix);
  }, [selectedDayMatrix]);

  // Form state (create or edit schedule)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formGuru, setFormGuru] = useState<string>(currentUser?.nama || '');
  const [formKategori, setFormKategori] = useState<'Akademik' | 'Al-Quran'>('Akademik');
  const [formHari, setFormHari] = useState<string>('SENIN');
  const [formJamKe, setFormJamKe] = useState<string>('1-2');
  const [formGender, setFormGender] = useState<Gender>(
    currentUser?.genderScope === 'Putri' ? 'Putri' : 'Putra',
  );
  const [formKelas, setFormKelas] = useState<string>('');
  const [formMapel, setFormMapel] = useState<string>('');
  const [formIsPerubahan, setFormIsPerubahan] = useState<boolean>(false);
  const [formCatatan, setFormCatatan] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  // Move Class / Student Transfer state
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentWilayahFilter, setStudentWilayahFilter] = useState<WilayahFilter>('Semua');
  const [studentKelasFilter, setStudentKelasFilter] = useState<string>('SEMUA');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetKelas, setTargetKelas] = useState<string>('');
  const [targetKamar, setTargetKamar] = useState<string>('');
  const [targetKelompok, setTargetKelompok] = useState<string>('');
  const [targetGender, setTargetGender] = useState<'' | Gender>('');
  const [movingStudents, setMovingStudents] = useState(false);

  // Musyrif Room Assignment state
  const [roomName, setRoomName] = useState<string>('');
  const [roomMusyrif, setRoomMusyrif] = useState<string>(currentUser?.nama || '');
  const [roomGender, setRoomGender] = useState<Gender>(
    currentUser?.genderScope === 'Putri' ? 'Putri' : 'Putra',
  );

  useEffect(() => {
    if (currentUser?.nama) {
      if (!formGuru) setFormGuru(currentUser.nama);
      if (!roomMusyrif) setRoomMusyrif(currentUser.nama);
    }
  }, [currentUser, formGuru, roomMusyrif]);

  const loadSchedules = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (scopeFilter === 'mine' && currentUser?.nama) {
      params.set('guru', currentUser.nama);
    }
    if (viewMode === 'tabel' && filterHari !== 'SEMUA') {
      params.set('hari', filterHari);
    }
    fetch(`/api/jadwal?${params.toString()}`)
      .then((r) => r.json())
      .then((data: ScheduleItem[]) => setSchedules(data))
      .finally(() => setLoading(false));
  }, [scopeFilter, filterHari, viewMode, currentUser]);

  const loadStudents = useCallback(() => {
    setLoadingStudents(true);
    fetch('/api/students')
      .then((r) => r.json())
      .then((data: Student[]) => setStudents(data))
      .finally(() => setLoadingStudents(false));
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    if (subTab === 'pindah') {
      loadStudents();
    }
  }, [subTab, loadStudents]);

  const resetForm = () => {
    setEditingId(null);
    setFormGuru(currentUser?.nama || teachers[0]?.nama || '');
    setFormKategori('Akademik');
    setFormHari(selectedDayMatrix);
    setFormJamKe('1-2');
    setFormGender(currentUser?.genderScope === 'Putri' ? 'Putri' : 'Putra');
    setFormKelas('');
    setFormMapel('');
    setFormIsPerubahan(false);
    setFormCatatan('');
  };

  const handleStartEdit = (item: ScheduleItem) => {
    setFormMinimized(false);
    setEditingId(item.id);
    setFormGuru(item.guru);
    setFormKategori(item.kategori || (item.mapel.includes('QUR') ? 'Al-Quran' : 'Akademik'));
    setFormHari(item.hari);
    setFormJamKe(item.jamKe);
    setFormGender(item.gender);
    setFormKelas(item.kelas);
    setFormMapel(item.mapel);
    setFormIsPerubahan(true);
    setFormCatatan(item.catatanPerubahan || 'Perubahan jadwal / tukar kelas & JP');
  };

  const handleQuickFillSlot = (hari: string, jp: number, kelasName?: string, g?: Gender) => {
    setFormMinimized(false);
    setEditingId(null);
    setFormHari(hari);
    setFormJamKe(String(jp));
    if (kelasName) setFormKelas(kelasName);
    if (g) setFormGender(g);
    setFormIsPerubahan(false);
    setFormCatatan('');
  };

  const toggleFormJp = (jp: number) => {
    const maxJp = getMaxJpForDay(formHari);
    const currentSet = new Set(parseJamRange(formJamKe, maxJp));
    if (currentSet.has(jp)) currentSet.delete(jp);
    else currentSet.add(jp);
    const sorted = Array.from(currentSet).sort((a, b) => a - b);
    if (sorted.length === 0) {
      setFormJamKe('');
      return;
    }
    if (sorted.length === 1) {
      setFormJamKe(String(sorted[0]));
      return;
    }
    const isContiguous = sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
    setFormJamKe(isContiguous ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(','));
  };

  const [allowClashOverride, setAllowClashOverride] = useState<boolean>(false);

  const liveClashConflicts = useMemo(() => {
    const g = formGuru.trim().toUpperCase();
    const h = formHari.trim().toUpperCase();
    const k = formKelas.trim().toUpperCase();
    const maxJp = getMaxJpForDay(formHari);
    const targetSlots = parseJamRange(formJamKe, maxJp);
    if (!h || targetSlots.length === 0 || (!g && !k)) return [];

    const conflicts: Array<{
      type: 'GURU' | 'KELAS';
      overlappingJps: number[];
      item: ScheduleItem;
    }> = [];

    for (const s of schedules) {
      if (editingId && s.id === editingId) continue;
      if (s.hari.trim().toUpperCase() !== h) continue;
      const existingSlots = parseJamRange(s.jamKe, maxJp);
      const overlap = targetSlots.filter((jp) => existingSlots.includes(jp));
      if (overlap.length === 0) continue;

      if (g && s.guru.trim().toUpperCase() === g && (!k || s.kelas.trim().toUpperCase() !== k)) {
        conflicts.push({ type: 'GURU', overlappingJps: overlap, item: s });
      } else if (k && s.kelas.trim().toUpperCase() === k && (!g || s.guru.trim().toUpperCase() !== g)) {
        conflicts.push({ type: 'KELAS', overlappingJps: overlap, item: s });
      } else if (g && k && s.guru.trim().toUpperCase() === g && s.kelas.trim().toUpperCase() === k) {
        conflicts.push({ type: 'GURU', overlappingJps: overlap, item: s });
      }
    }
    return conflicts;
  }, [schedules, editingId, formGuru, formHari, formKelas, formJamKe]);

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGuru.trim() || !formKelas.trim() || !formMapel.trim() || !formJamKe.trim()) {
      notify('Lengkapi Guru, Kelas/Kelompok, Mata Pelajaran, dan Jam Ke.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        guru: formGuru,
        hari: formHari,
        kelas: formKelas,
        mapel: formMapel,
        jamKe: formJamKe,
        gender: formGender,
        kategori: formKategori,
        isPerubahan: formIsPerubahan,
        catatanPerubahan: formCatatan,
        allowOverride: allowClashOverride,
      };
      const res = await fetch(editingId ? `/api/jadwal/${editingId}` : '/api/jadwal', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      notify(
        editingId
          ? 'Perubahan jadwal berhasil disimpan & langsung aktif di Presensi.'
          : 'Jadwal pembelajaran baru berhasil ditambahkan (Validasi Anti-Bentrok Lolos).',
        'success',
      );
      setSelectedDayMatrix(formHari);
      setAllowClashOverride(false);
      resetForm();
      loadSchedules();
      onChanged();
    } catch (err) {
      notify((err as Error).message || 'Gagal menyimpan jadwal.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const [uploadingExcelJadwal, setUploadingExcelJadwal] = useState(false);

  const handleDownloadBlankJadwalExcel = () => {
    try {
      const fname = downloadComponentExcelTemplate('jadwal', 'blank');
      notify(`Mengunduh ${fname} (Template Kosong Jadwal Akademik & Al-Qur'an).`, 'success');
    } catch {
      notify('Gagal mengunduh template kosong jadwal.', 'error');
    }
  };

  const handleDownloadExistingJadwalExcel = () => {
    try {
      const targetList = visibleSchedules.length > 0 ? visibleSchedules : schedules;
      const rows: string[][] = [
        ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
        ...(targetList.length > 0
          ? targetList.map((s) => [s.guru, s.hari, s.kelas, s.mapel, s.jamKe, s.gender])
          : [
              [
                currentUser?.nama || 'UST. NUR FAIZIN',
                'SENIN',
                '10 ABU BAKAR AS-SHIDDIQ',
                'FIQIH IBADAH',
                '1-2',
                'Putra',
              ],
              [
                currentUser?.nama || 'UST. DAFFA M Z',
                'SELASA',
                '10-08 Putra',
                "HALAQAH AL-QUR'AN",
                '3-4',
                'Putra',
              ],
            ]),
      ];
      triggerExcelDownloadFromSpec({
        filename: 'Template_Jadwal_Mengajar_Saat_Ini.xlsx',
        sourceLabel: 'Jadwal Mengajar Akademik & Al-Quran',
        sheets: [
          {
            name: '4_Jadwal_Mengajar',
            label: 'Jadwal Putra & Putri',
            rows,
          },
        ],
      });
      notify(
        `Berhasil mengunduh ${targetList.length} jadwal yang sudah ada ke Excel (.xlsx). Silakan edit lalu upload kembali.`,
        'success'
      );
    } catch {
      notify('Gagal mengekspor jadwal ke Excel.', 'error');
    }
  };

  const handleUploadJadwalExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingExcelJadwal(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      if (!buf) {
        setUploadingExcelJadwal(false);
        return;
      }
      try {
        const parsed = parseDatabaseExcelBuffer(buf, file.name);
        if (parsed.scheduleRows.length === 0) {
          throw new Error(
            'Tidak ada baris jadwal yang ditemukan di file Excel. Pastikan kolom: Guru | Hari | Kelas / Halaqah | Mata Pelajaran | Jam Ke | Wilayah.'
          );
        }
        const res = await fetch('/api/import/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: parsed.scheduleRows,
            replaceExisting: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengimpor jadwal dari Excel.');
        loadSchedules();
        onChanged();
        notify(
          `Berhasil memproses ${parsed.scheduleRows.length} baris jadwal dari Excel (${data.added || 0} baru ditambahkan, ${data.updated || 0} jadwal lama diperbarui).`,
          'success'
        );
      } catch (err) {
        notify((err as Error).message, 'error');
      } finally {
        setUploadingExcelJadwal(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDeleteSchedule = async (id: string) => {
    const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });
    if (res.ok) {
      notify('Jadwal dihapus.', 'info');
      if (editingId === id) resetForm();
      loadSchedules();
      onChanged();
    }
  };

  const handleMoveStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      notify('Pilih minimal 1 siswa yang ingin dipindahkan kelasnya.', 'error');
      return;
    }
    if (!targetKelas.trim() && !targetKamar.trim() && !targetKelompok.trim() && !targetGender) {
      notify('Isi Kelas tujuan, Kamar tujuan, Kelompok Qur’an, atau Wilayah baru.', 'error');
      return;
    }
    setMovingStudents(true);
    try {
      const res = await fetch('/api/students/move-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          targetKelas: targetKelas.trim() || undefined,
          targetKamar: targetKamar.trim() || undefined,
          targetKelompok: targetKelompok.trim() || undefined,
          targetGender: targetGender || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memindahkan siswa.');
      notify(`${data.moved} siswa berhasil dipindahkan / diperbarui.`, 'success');
      setSelectedStudentIds([]);
      setTargetKelas('');
      setTargetKamar('');
      setTargetKelompok('');
      setTargetGender('');
      loadStudents();
      onChanged();
    } catch (err) {
      notify((err as Error).message, 'error');
    } finally {
      setMovingStudents(false);
    }
  };

  const handleAssignRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !roomMusyrif.trim()) {
      notify('Isi nama kamar dan nama Musyrif/Musyrifah.', 'error');
      return;
    }
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kamar: roomName, musyrif: roomMusyrif, gender: roomGender }),
    });
    if (res.ok) {
      notify(`Kamar ${roomName} berhasil ditetapkan ke ${roomMusyrif}.`, 'success');
      setRoomName('');
      onChanged();
    }
  };

  const handleDeleteRoom = async (kamar: string) => {
    const res = await fetch(`/api/rooms?kamar=${encodeURIComponent(kamar)}`, { method: 'DELETE' });
    if (res.ok) {
      notify(`Pemetaan kamar ${kamar} dihapus.`, 'info');
      onChanged();
    }
  };

  const classSuggestions = formKategori === 'Al-Quran' ? kelompokList : kelasList;

  const visibleSchedules = useMemo(
    () => (filterWilayah === 'Semua' ? schedules : schedules.filter((s) => s.gender === filterWilayah)),
    [schedules, filterWilayah],
  );

  // Matrix columns & slots for selectedDayMatrix
  const dayMaxJp = getMaxJpForDay(selectedDayMatrix);
  const daySchedules = useMemo(
    () => visibleSchedules.filter((s) => s.hari.toUpperCase() === selectedDayMatrix),
    [visibleSchedules, selectedDayMatrix],
  );

  const matrixClasses = useMemo(() => {
    const map = new Map<string, Gender>();
    for (const s of daySchedules) {
      map.set(s.kelas, s.gender);
    }
    for (const k of kelasList) {
      const g = inferClassGender(k);
      if (filterWilayah === 'Semua' || g === filterWilayah) {
        if (!map.has(k)) map.set(k, g);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0], 'id', { numeric: true }))
      .map(([kelas, gender]) => ({ kelas, gender }));
  }, [daySchedules, kelasList, filterWilayah]);

  const visibleRooms =
    filterWilayah === 'Semua' ? rooms : rooms.filter((r) => r.gender === filterWilayah);

  // Student directory filtered for Move Class tab
  const availableStudentClasses = useMemo(
    () =>
      Array.from(
        new Set(
          students
            .filter((s) => studentWilayahFilter === 'Semua' || s.gender === studentWilayahFilter)
            .map((s) => s.kelas),
        ),
      ).sort((a, b) => a.localeCompare(b, 'id', { numeric: true })),
    [students, studentWilayahFilter],
  );

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (studentWilayahFilter !== 'Semua' && s.gender !== studentWilayahFilter) return false;
      if (studentKelasFilter !== 'SEMUA' && s.kelas !== studentKelasFilter) return false;
      if (
        q &&
        !s.nama.toLowerCase().includes(q) &&
        !s.kelas.toLowerCase().includes(q) &&
        !s.kamar.toLowerCase().includes(q) &&
        !(s.nis || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [students, studentWilayahFilter, studentKelasFilter, studentSearch]);

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAllFiltered = () => {
    const visibleIds = filteredStudents.map((s) => s.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      setSelectedStudentIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const formDayMaxJp = getMaxJpForDay(formHari);
  const selectedFormJps = parseJamRange(formJamKe, formDayMaxJp);

  return (
    <div className="space-y-6">
      {/* Sub-navigation (Area Terproteksi Guru & Admin) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('mengajar')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'mengajar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarPlus className="h-3.5 w-3.5 text-teal-700" />
            Peta Jadwal JP &amp; Perubahan
          </button>
          <button
            type="button"
            onClick={() => setSubTab('pindah')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'pindah' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-violet-700" />
            Pindah Kelas Siswa
          </button>
          <button
            type="button"
            onClick={() => setSubTab('asrama')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'asrama' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Home className="h-3.5 w-3.5 text-sky-700" />
            Penugasan Kamar Musyrif/ah
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Khusus Guru &amp; Admin login · Senin &amp; Jumat 6 JP, Selasa–Kamis 9 JP, Sabtu 7 JP.
        </p>
      </div>

      {subTab === 'mengajar' ? (
        <div className="space-y-5">
          {/* Hybrid Schedule Toolbar: Template Excel vs Sistem (Guru Akademik & Al-Qur'an) */}
          <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-white p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shrink-0">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900">
                    Kelola Jadwal Guru Akademik &amp; Al-Qur&apos;an (Lewat Sistem, Edit Jadwal, atau Template Excel)
                  </h3>
                  <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-900">
                    Hybrid Input &amp; Edit
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Anda dapat menambah/mengedit jadwal secara langsung lewat form sistem di bawah, <b>klik tombol pensil (Edit)</b> pada jadwal yang sudah ada, atau <b>Unduh &amp; Upload Template Excel (.xlsx)</b>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFormMinimized(false);
                  setEditingId(null);
                  setFormKategori('Akademik');
                  if (currentUser?.nama) setFormGuru(currentUser.nama);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                + Jadwal Akademik (Sistem)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormMinimized(false);
                  setEditingId(null);
                  setFormKategori('Al-Quran');
                  setFormMapel("HALAQAH AL-QUR'AN");
                  if (currentUser?.nama) setFormGuru(currentUser.nama);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                + Jadwal Al-Qur&apos;an (Sistem)
              </button>
              <button
                type="button"
                onClick={handleDownloadBlankJadwalExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 text-teal-700" />
                Template Kosong (.xlsx)
              </button>
              <button
                type="button"
                onClick={handleDownloadExistingJadwalExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 text-teal-700" />
                Unduh &amp; Edit Jadwal Saat Ini (.xlsx)
              </button>
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1324] px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="h-3.5 w-3.5 text-teal-300" />
                <span>{uploadingExcelJadwal ? 'Mengupload...' : 'Upload Excel Jadwal (.xlsx)'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={uploadingExcelJadwal}
                  onChange={handleUploadJadwalExcel}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Create / Edit Form (Collapsible) */}
          {formMinimized ? (
            <div className="lg:col-span-12 rounded-xl border border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">
                  {editingId ? 'Ubah / Revisi Jadwal' : 'Buat / Ubah Jadwal Pembelajaran'}
                </span>
                <span className="text-slate-300">·</span>
                <span>{formGuru || 'Guru belum dipilih'}</span>
                <span className="text-slate-300">·</span>
                <span>{formHari} (JP {formJamKe || '-'})</span>
                <span className="text-slate-300">·</span>
                <span>{formKelas || 'Pilih kelas'}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormMinimized(false)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Buka Form Jadwal
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmitSchedule}
              className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {editingId ? 'Ubah Kelas / Mapel / Jam Ke' : 'Tambah / Atur Jadwal JP'}
                </h2>
                <div className="flex items-center gap-1.5">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                    >
                      <X className="h-3.5 w-3.5" />
                      Batal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFormMinimized(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Minimize
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Guru / Pengampu *</label>
                <input
                  type="text"
                  list="guru-datalist"
                  value={formGuru}
                  onChange={(e) => setFormGuru(e.target.value)}
                  placeholder="Ketik atau pilih nama guru..."
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium focus:border-teal-600 focus:outline-none"
                />
                <datalist id="guru-datalist">
                  {teachers.map((t) => (
                    <option key={t.id} value={t.nama} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={formKategori}
                    onChange={(e) => setFormKategori(e.target.value as 'Akademik' | 'Al-Quran')}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                  >
                    <option value="Akademik">Akademik</option>
                    <option value="Al-Quran">Al-Qur&apos;an</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Wilayah</label>
                  <select
                    value={formGender}
                    onChange={(e) => setFormGender(e.target.value as Gender)}
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                  >
                    <option value="Putra">Wilayah Putra</option>
                    <option value="Putri">Wilayah Putri</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hari &amp; Kapasitas Jam Pelajaran *
                </label>
                <select
                  value={formHari}
                  onChange={(e) => {
                    setFormHari(e.target.value);
                    setSelectedDayMatrix(e.target.value);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
                >
                  {HARI_CONFIG.map((h) => (
                    <option key={h.hari} value={h.hari}>
                      {h.hari} (Maks {h.maxJp} JP)
                    </option>
                  ))}
                </select>
              </div>

              {/* Interactive JP Slot Picker */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    Pilih Jam Ke- ({formHari}: 1–{formDayMaxJp} JP)
                  </span>
                  <span className="font-mono-num text-[11px] font-bold text-teal-700">
                    JP {formJamKe || '-'}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: formDayMaxJp }, (_, idx) => idx + 1).map((jp) => {
                    const active = selectedFormJps.includes(jp);
                    return (
                      <button
                        key={jp}
                        type="button"
                        onClick={() => toggleFormJp(jp)}
                        className={`h-8 rounded-md font-mono-num text-xs font-semibold border transition-colors ${
                          active
                            ? 'border-teal-700 bg-teal-700 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-400'
                        }`}
                      >
                        JP {jp}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={formJamKe}
                  onChange={(e) => setFormJamKe(e.target.value)}
                  placeholder="Atau ketik manual misal: 1-2 atau 4"
                  className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs font-mono-num"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {formKategori === 'Al-Quran' ? "Di mana Kelompok Al-Qur'an *" : 'Di mana Nama Kelas *'}
                </label>
                <input
                  type="text"
                  list="kelas-datalist"
                  value={formKelas}
                  onChange={(e) => setFormKelas(e.target.value)}
                  placeholder={formKategori === 'Al-Quran' ? 'Contoh: 10-08 Putra' : 'Contoh: 10 ABU BAKAR AS-SHIDDIQ'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium focus:border-teal-600 focus:outline-none"
                />
                <datalist id="kelas-datalist">
                  {classSuggestions.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran / Agenda *</label>
                <input
                  type="text"
                  value={formMapel}
                  onChange={(e) => setFormMapel(e.target.value)}
                  placeholder={formKategori === 'Al-Quran' ? "Contoh: TAHFIDZ AL-QUR'AN" : 'Contoh: MATEMATIKA'}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPerubahan}
                    onChange={(e) => setFormIsPerubahan(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600"
                  />
                  Tandai sebagai Perubahan / Pergantian JP &amp; Kelas
                </label>
                {formIsPerubahan && (
                  <input
                    type="text"
                    value={formCatatan}
                    onChange={(e) => setFormCatatan(e.target.value)}
                    placeholder="Contoh: Pindah ruang kelas / tukar JP pertengahan semester"
                    className="h-8 w-full rounded border border-slate-300 bg-white px-2.5 text-xs"
                  />
                )}
              </div>

              {liveClashConflicts.length > 0 && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 space-y-2">
                  <div className="text-xs font-bold text-rose-900">
                    Peringatan Bentrok Jadwal Terdeteksi ({liveClashConflicts.length} Konflik):
                  </div>
                  <div className="space-y-1 text-[11px] text-rose-800">
                    {liveClashConflicts.map((c, idx) => (
                      <div key={idx} className="leading-snug">
                        •{' '}
                        {c.type === 'GURU' ? (
                          <span>
                            <strong>Bentrok Guru:</strong> {c.item.guru} sudah mengajar{' '}
                            <strong>{c.item.mapel}</strong> di kelas <strong>{c.item.kelas}</strong> pada{' '}
                            {c.item.hari} JP {c.overlappingJps.join(', ')}.
                          </span>
                        ) : (
                          <span>
                            <strong>Bentrok Kelas:</strong> Kelas <strong>{c.item.kelas}</strong> sudah diisi{' '}
                            <strong>{c.item.guru}</strong> ({c.item.mapel}) pada {c.item.hari} JP{' '}
                            {c.overlappingJps.join(', ')}.
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 pt-1 border-t border-rose-200 text-[11px] font-semibold text-rose-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowClashOverride}
                      onChange={(e) => setAllowClashOverride(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-rose-400 text-rose-700"
                    />
                    Izinkan Override (Khusus Team Teaching / Kelas Gabungan)
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || (liveClashConflicts.length > 0 && !allowClashOverride)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300 whitespace-nowrap shrink-0"
              >
                {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saving
                  ? 'Menyimpan...'
                  : liveClashConflicts.length > 0 && !allowClashOverride
                  ? 'Jadwal Bentrok (Ubah JP atau Centang Override)'
                  : editingId
                  ? 'Simpan Perubahan Jadwal'
                  : 'Tambahkan ke Jadwal'}
              </button>
            </form>
          )}

          {/* Visual Timetable Matrix & Table View */}
          <div
            className={`${
              formMinimized ? 'lg:col-span-12' : 'lg:col-span-8'
            } space-y-4`}
          >
            {/* Controls Header Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Peta Jadwal Pembelajaran ({visibleSchedules.length} slot aktif)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tampilan jelas Mapel, Kelas, Guru &amp; Jam Ke- untuk memudahkan pergantian kelas atau JP di pertengahan.
                  </p>
                </div>

                <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('matriks')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold ${
                      viewMode === 'matriks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <Grid3X3 className="h-3.5 w-3.5 text-teal-700" />
                    Matriks JP
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('tabel')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold ${
                      viewMode === 'tabel' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    <List className="h-3.5 w-3.5 text-sky-700" />
                    Daftar Tabel
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="inline-flex flex-wrap rounded-md bg-slate-100 p-0.5 text-xs">
                  {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setFilterWilayah(w)}
                      className={`rounded px-2.5 py-1 font-semibold ${
                        filterWilayah === w ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      {w === 'Semua' ? 'Semua Wilayah' : `Wilayah ${w}`}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentUser && (
                    <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setScopeFilter('mine')}
                        className={`rounded px-2.5 py-1 font-semibold ${
                          scopeFilter === 'mine' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Jadwal Saya
                      </button>
                      <button
                        type="button"
                        onClick={() => setScopeFilter('all')}
                        className={`rounded px-2.5 py-1 font-semibold ${
                          scopeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Semua Guru
                      </button>
                    </div>
                  )}

                  {viewMode === 'tabel' && (
                    <select
                      value={filterHari}
                      onChange={(e) => setFilterHari(e.target.value)}
                      className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium"
                    >
                      <option value="SEMUA">Semua Hari</option>
                      {HARI_LIST.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {viewMode === 'matriks' ? (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Day Selector Bar with exact JP counts */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {HARI_CONFIG.map((cfg) => {
                      const active = selectedDayMatrix === cfg.hari;
                      const countForDay = visibleSchedules.filter((s) => s.hari === cfg.hari).length;
                      return (
                        <button
                          key={cfg.hari}
                          type="button"
                          onClick={() => setSelectedDayMatrix(cfg.hari)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-teal-700 bg-teal-700 text-white shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{cfg.hari}</span>
                          <span
                            className={`font-mono-num text-[11px] ${
                              active ? 'text-teal-100' : 'text-slate-500'
                            }`}
                          >
                            ({cfg.maxJp} JP{countForDay > 0 ? ` · ${countForDay}` : ''})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Visual JP Matrix Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700">
                        <th className="sticky left-0 z-10 w-24 border-r border-slate-200 bg-slate-100 px-3 py-3 font-semibold">
                          Jam Ke-
                        </th>
                        {matrixClasses.length === 0 ? (
                          <th className="px-4 py-3 font-semibold text-slate-500">
                            Slot Jadwal Hari {selectedDayMatrix} (Belum Ada Kelas Terdaftar — Klik + Isi JP untuk Membuat)
                          </th>
                        ) : (
                          matrixClasses.map((col) => (
                            <th
                              key={col.kelas}
                              className="min-w-[190px] border-r border-slate-200 px-3 py-3 font-semibold"
                            >
                              <div className="text-slate-900">{col.kelas}</div>
                              <div
                                className={`text-[11px] font-medium ${
                                  col.gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                                }`}
                              >
                                Wilayah {col.gender}
                              </div>
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.from({ length: dayMaxJp }, (_, idx) => idx + 1).map((jp) => (
                        <tr key={jp} className="align-top hover:bg-slate-50/50">
                          <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 py-3 font-mono-num font-bold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-teal-700" />
                              JP {jp}
                            </div>
                          </td>

                          {matrixClasses.length === 0 ? (
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={() => handleQuickFillSlot(selectedDayMatrix, jp)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-teal-600 hover:bg-teal-50/40 hover:text-teal-800"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Isi Jadwal {selectedDayMatrix} JP {jp}
                              </button>
                            </td>
                          ) : (
                            matrixClasses.map((col) => {
                              const matched = daySchedules.filter(
                                (s) =>
                                  s.kelas.toUpperCase() === col.kelas.toUpperCase() &&
                                  parseJamRange(s.jamKe, dayMaxJp).includes(jp),
                              );

                              if (matched.length === 0) {
                                return (
                                  <td
                                    key={col.kelas}
                                    className="border-r border-slate-200 p-2 align-middle"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleQuickFillSlot(selectedDayMatrix, jp, col.kelas, col.gender)
                                      }
                                      className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 px-2 py-2 text-[11px] font-medium text-slate-400 hover:border-teal-500 hover:bg-teal-50/50 hover:text-teal-700 transition-colors"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Isi JP {jp}
                                    </button>
                                  </td>
                                );
                              }

                              return (
                                <td key={col.kelas} className="border-r border-slate-200 p-2 space-y-1.5">
                                  {matched.map((item) => (
                                    <div
                                      key={item.id}
                                      className={`rounded-lg border p-2.5 space-y-1 ${
                                        item.isPerubahan
                                          ? 'border-amber-300 bg-amber-50/70'
                                          : item.gender === 'Putri'
                                          ? 'border-rose-200 bg-rose-50/40'
                                          : 'border-sky-200 bg-sky-50/40'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-1.5">
                                        <span className="font-bold text-slate-900 leading-tight">
                                          {item.mapel}
                                        </span>
                                        <span className="font-mono-num text-[10px] font-semibold text-slate-600 shrink-0">
                                          JP {item.jamKe}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-700 font-medium truncate">
                                        {item.guru}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {item.kelas} · Wilayah {item.gender}
                                      </div>
                                      {item.isPerubahan && (
                                        <div className="text-[10px] font-semibold text-amber-800">
                                          Perubahan{item.catatanPerubahan ? `: ${item.catatanPerubahan}` : ''}
                                        </div>
                                      )}
                                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-black/5">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEdit(item)}
                                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 hover:bg-white"
                                        >
                                          <Edit3 className="h-3 w-3" />
                                          Ubah / Tukar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSchedule(item.id)}
                                          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-rose-700"
                                          title="Hapus slot"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </td>
                              );
                            })
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Table View */
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Hari &amp; Jam</th>
                        <th className="px-3 py-3 font-semibold">Guru / Pengampu</th>
                        <th className="px-3 py-3 font-semibold">Kelas / Halaqah</th>
                        <th className="px-3 py-3 font-semibold">Mapel</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                            Memuat jadwal...
                          </td>
                        </tr>
                      ) : visibleSchedules.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                            Belum ada jadwal pembelajaran untuk filter wilayah ini.
                          </td>
                        </tr>
                      ) : (
                        visibleSchedules.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-semibold text-slate-900">{item.hari}</div>
                              <div className="font-mono-num text-[11px] text-slate-500">JP {item.jamKe}</div>
                            </td>
                            <td className="px-3 py-3 font-medium text-slate-800">{item.guru}</td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-900">{item.kelas}</div>
                              <div className="text-[11px] text-slate-500">
                                Wilayah {item.gender} · {item.kategori || 'Akademik'}
                              </div>
                            </td>
                            <td className="px-3 py-3 font-medium text-slate-800">{item.mapel}</td>
                            <td className="px-3 py-3">
                              {item.isPerubahan ? (
                                <div className="text-amber-700 font-semibold">
                                  Perubahan
                                  {item.catatanPerubahan && (
                                    <div className="text-[11px] font-normal text-slate-500">{item.catatanPerubahan}</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-600 font-medium">Jadwal Tetap</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item)}
                                title="Ubah jadwal"
                                className="mr-1 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-700"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSchedule(item.id)}
                                title="Hapus jadwal"
                                className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
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
          </div>
          </div>
        </div>
      ) : subTab === 'pindah' ? (
        /* TAB 2: PINDAH KELAS / KOREKSI DATA SISWA */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <form
            onSubmit={handleMoveStudents}
            className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <ArrowRightLeft className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Pindahkan Siswa ke Kelas Baru</h2>
                <p className="text-[11px] text-slate-500">
                  Koreksi siswa jika salah input kelas, kamar, atau wilayah.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
              <span className="text-slate-600">Siswa dipilih: </span>
              <span className="font-mono-num font-bold text-violet-800">{selectedStudentIds.length} santri</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kelas Tujuan Baru
              </label>
              <input
                type="text"
                list="target-kelas-list"
                value={targetKelas}
                onChange={(e) => setTargetKelas(e.target.value)}
                placeholder="Pilih atau ketik nama kelas baru..."
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium focus:border-violet-600 focus:outline-none"
              />
              <datalist id="target-kelas-list">
                {kelasList.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kamar Baru (Opsional)
              </label>
              <input
                type="text"
                list="target-kamar-list"
                value={targetKamar}
                onChange={(e) => setTargetKamar(e.target.value)}
                placeholder="Kosongkan jika kamar tetap"
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs focus:border-violet-600 focus:outline-none"
              />
              <datalist id="target-kamar-list">
                {rooms.map((r) => (
                  <option key={r.kamar} value={r.kamar} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kelompok Al-Qur&apos;an Baru (Opsional)
              </label>
              <input
                type="text"
                list="target-kelompok-list"
                value={targetKelompok}
                onChange={(e) => setTargetKelompok(e.target.value)}
                placeholder="Kosongkan jika kelompok tetap"
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs focus:border-violet-600 focus:outline-none"
              />
              <datalist id="target-kelompok-list">
                {kelompokList.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Koreksi Wilayah Putra / Putri (Opsional)
              </label>
              <select
                value={targetGender}
                onChange={(e) => setTargetGender(e.target.value as '' | Gender)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
              >
                <option value="">-- Tetap Sesuai Data Lama --</option>
                <option value="Putra">Ubah ke Wilayah Putra</option>
                <option value="Putri">Ubah ke Wilayah Putri</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={movingStudents || selectedStudentIds.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-800 disabled:bg-slate-300"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {movingStudents ? 'Memindahkan...' : `Pindahkan ${selectedStudentIds.length} Siswa`}
            </button>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Daftar Siswa Terdaftar ({filteredStudents.length})
                  </h3>
                </div>
                <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
                  {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        setStudentWilayahFilter(w);
                        setStudentKelasFilter('SEMUA');
                      }}
                      className={`rounded px-2.5 py-1 font-semibold ${
                        studentWilayahFilter === w ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      {w === 'Semua' ? 'Semua Wilayah' : `Wilayah ${w}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Cari nama siswa, kelas, kamar, atau NIS..."
                    className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-xs focus:border-violet-600 focus:outline-none"
                  />
                </div>
                <select
                  value={studentKelasFilter}
                  onChange={(e) => setStudentKelasFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold"
                >
                  <option value="SEMUA">Semua Kelas</option>
                  {availableStudentClasses.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-violet-700" />
                  Pilih Semua ({filteredStudents.length})
                </button>
              </div>
            </div>

            <div className="max-h-[440px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <span className="sr-only">Pilih</span>
                    </th>
                    <th className="px-3 py-3 font-semibold">Nama Siswa</th>
                    <th className="px-3 py-3 font-semibold">Wilayah</th>
                    <th className="px-3 py-3 font-semibold">Kelas Saat Ini</th>
                    <th className="px-3 py-3 font-semibold">Kamar</th>
                    <th className="px-4 py-3 font-semibold">Kelp. Qur&apos;an</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Memuat daftar siswa...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                        Tidak ada siswa sesuai filter. Tambahkan data siswa melalui Template Excel atau Input Langsung.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st) => {
                      const checked = selectedStudentIds.includes(st.id);
                      return (
                        <tr
                          key={st.id}
                          onClick={() => toggleStudentSelection(st.id)}
                          className={`cursor-pointer transition-colors ${
                            checked ? 'bg-violet-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStudentSelection(st.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-slate-300 text-violet-700"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900">{st.nama}</div>
                            {st.nis && <div className="font-mono-num text-[11px] text-slate-500">NIS: {st.nis}</div>}
                          </td>
                          <td
                            className={`px-3 py-2.5 font-semibold ${
                              st.gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                            }`}
                          >
                            {st.gender}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">{st.kelas}</td>
                          <td className="px-3 py-2.5 text-slate-600">{st.kamar}</td>
                          <td className="px-4 py-2.5 text-slate-600">{st.kelompokQuran}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 3: MUSYRIF / MUSYRIFAH ROOM ASSIGNMENT */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <form
            onSubmit={handleAssignRoom}
            className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4"
          >
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Atur Kamar Binaan Musyrif / Musyrifah
            </h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kamar *</label>
              <input
                type="text"
                list="rooms-datalist"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Contoh: 10.4 Putra"
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium"
              />
              <datalist id="rooms-datalist">
                {rooms.map((r) => (
                  <option key={r.kamar} value={r.kamar} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Musyrif / Musyrifah *</label>
              <input
                type="text"
                list="guru-datalist-room"
                value={roomMusyrif}
                onChange={(e) => setRoomMusyrif(e.target.value)}
                placeholder="Nama Musyrif/ah"
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs font-medium"
              />
              <datalist id="guru-datalist-room">
                {teachers.map((t) => (
                  <option key={t.id} value={t.nama} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Wilayah Asrama</label>
              <select
                value={roomGender}
                onChange={(e) => setRoomGender(e.target.value as Gender)}
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold"
              >
                <option value="Putra">Wilayah Putra</option>
                <option value="Putri">Wilayah Putri</option>
              </select>
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <Save className="h-4 w-4" />
              Simpan Pemetaan Kamar
            </button>
          </form>

          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Daftar Kamar Asrama &amp; Pembina ({visibleRooms.length})
              </h3>
              <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-xs">
                {(['Semua', 'Putra', 'Putri'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setFilterWilayah(w)}
                    className={`rounded px-2.5 py-1 font-semibold ${
                      filterWilayah === w ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {w === 'Semua' ? 'Semua Wilayah' : `Wilayah ${w}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama Kamar</th>
                    <th className="px-3 py-3 font-semibold">Wilayah</th>
                    <th className="px-3 py-3 font-semibold">Musyrif / Musyrifah</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRooms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        Belum ada daftar kamar untuk wilayah ini. Upload template Excel atau tambah manual di sebelah kiri.
                      </td>
                    </tr>
                  ) : (
                    visibleRooms.map((rm) => (
                      <tr key={rm.kamar} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{rm.kamar}</td>
                        <td
                          className={`px-3 py-3 font-semibold ${
                            rm.gender === 'Putri' ? 'text-rose-700' : 'text-sky-700'
                          }`}
                        >
                          Wilayah {rm.gender}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {rm.musyrif || <span className="text-amber-700">Belum ditetapkan</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRoom(rm.kamar)}
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
        </div>
      )}
    </div>
  );
};
