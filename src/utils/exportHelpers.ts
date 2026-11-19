import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  AnalyticsTerpadu,
  Gender,
  LabkomBooking,
  LabkomFixedSchedule,
  LabkomKampus,
  LabkomMasterItem,
  LabkomMasterKategori,
  LabkomPloting,
  MonthlyWaliKelasReport,
  PimpinanExecutiveReport,
  RoomMapping,
  ScheduleItem,
  Student,
  TeacherPublic,
  WilayahFilter,
} from '../types';
import type { DatabaseWorkbookSpec, WorkbookSheetSpec } from './excelParser';

export const NAMA_HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const;

export const NAMA_BULAN_INDO = [
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
] as const;

export const ALASAN_SAKIT = [
  'Sakit - Demam / Panas',
  'Sakit - Batuk / Pilek / Flu',
  'Sakit - Perut / Pencernaan / Diare',
  'Sakit - Pusing / Sakit Kepala',
  'Sakit - Tipes / Demam Berdarah',
  'Sakit - Dirawat di RS / Klinik',
  'Sakit - Istirahat di UKS / Kamar Asrama',
  'Sakit - Cidera / Kecelakaan',
  'Sakit - Gatal / Alergi / Penyakit Kulit',
  'Sakit - Gigi / Mulut',
];

export const ALASAN_IZIN = [
  'Izin - Pulang / Keperluan Keluarga Mendadak',
  'Izin - Pulang / Keluarga Meninggal Dunia',
  'Izin - Lomba / Olimpiade / Pertandingan',
  'Izin - Mengikuti Ekstrakurikuler',
  'Izin - Mengurus Berkas / Administrasi',
  'Izin - Dinas Sekolah / Penugasan',
  'Izin - Keluar Asrama (Keperluan Mendesak)',
];

export const ALASAN_ALFA = [
  'Alfa - Terlambat Masuk Kelas',
  'Alfa - Terlambat Bangun',
  'Alfa - Bolos / Keluar Asrama Tanpa Izin',
  'Alfa - Ketiduran di Kamar / Masjid',
  'Alfa - Tanpa Keterangan (Tidak Ada Kabar)',
  'Alfa - Masih di Luar / Kantin',
  'Alfa - Izin Kadaluarsa (Belum Kembali)',
];

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDateStr(dateStr: string, offsetDays: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getNamaHariFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return isNaN(d.getTime()) ? '' : NAMA_HARI[d.getDay()];
}

export function formatTanggalIndo(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export function downloadCsv(filename: string, rows: string[][], extraSections?: string[][][]) {
  const escapeCell = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const lines: string[] = rows.map((r) => r.map(escapeCell).join(','));

  if (extraSections) {
    for (const section of extraSections) {
      lines.push('');
      for (const r of section) {
        lines.push(r.map(escapeCell).join(','));
      }
    }
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printHtmlDocument(title: string, htmlBody: string, landscape = false) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!doctype html>
    <html lang="id">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 14mm; }
        body { font-family: 'Times New Roman', Georgia, serif; color: #0f172a; margin: 0; font-size: 11px; line-height: 1.45; }
        .kop { border-bottom: 3px double #0f172a; padding-bottom: 10px; margin-bottom: 14px; text-align: center; }
        .kop h1 { font-size: 16px; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
        .kop p { font-size: 11px; margin: 2px 0 0 0; color: #334155; }
        .doc-title { text-align: center; margin: 12px 0 14px 0; }
        .doc-title h2 { font-size: 14px; margin: 0; text-transform: uppercase; text-decoration: underline; }
        .doc-title div { font-size: 11px; margin-top: 4px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #334155; padding: 5px 6px; text-align: center; vertical-align: middle; }
        th { background: #f1f5f9; font-weight: bold; font-size: 10px; text-transform: uppercase; }
        td.left { text-align: left; }
        .meta-table { border: none; margin-bottom: 12px; }
        .meta-table td { border: none; text-align: left; padding: 3px 4px; font-size: 12px; }
        .sign-grid { display: flex; justify-content: space-between; margin-top: 36px; text-align: center; font-size: 12px; }
        .sign-box { width: 42%; }
        .sign-space { height: 56px; }
      </style>
    </head>
    <body>
      <div class="kop">
        <h1>PINTAR TERINTEGRASI · BOARDING SCHOOL</h1>
        <p>Sistem Presensi Asrama, Akademik, Al-Qur'an, Ujian & Pembinaan Wali Kelas Terpadu</p>
      </div>
      ${htmlBody}
    </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}

// ==============================================================
// DIRECT PDF EXPORT UTILITIES (JSPDF + AUTOTABLE)
// ==============================================================

function getFinalY(doc: jsPDF, fallback: number): number {
  const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  return anyDoc.lastAutoTable?.finalY ?? fallback;
}

function drawSchoolHeader(doc: jsPDF, reportTitle: string, subtitle: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('SIM PINTAR TERINTEGRASI · BOARDING SCHOOL', pageWidth / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Sistem Presensi Asrama, Akademik, Al-Qur'an, Ujian & Pembinaan Wali Kelas Terpadu (Wilayah Putra & Putri)",
    pageWidth / 2,
    18,
    { align: 'center' },
  );

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(14, 21, pageWidth - 14, 21);
  doc.setLineWidth(0.2);
  doc.line(14, 22, pageWidth - 14, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle.toUpperCase(), pageWidth / 2, 28, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(subtitle, pageWidth / 2, 33, { align: 'center' });

  return 37;
}

function drawSignatureBlock(
  doc: jsPDF,
  startY: number,
  leftRole: string,
  leftName: string,
  rightRole: string,
  rightName: string,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY + 8;

  if (y + 32 > pageHeight - 10) {
    doc.addPage();
    y = 20;
  }

  const leftX = 48;
  const rightX = pageWidth - 48;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Dicetak pada: ${formatTanggalIndo(getTodayDateStr())}`, rightX, y - 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text(leftRole, leftX, y, { align: 'center' });
  doc.text(rightRole, rightX, y, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text(leftName || '( ........................................ )', leftX, y + 20, { align: 'center' });
  doc.text(rightName || '( ........................................ )', rightX, y + 20, { align: 'center' });
}

/**
 * 1. Direct PDF Export for Wali Kelas Monthly Summary (Presensi + Pembinaan + Ibadah)
 */
export function downloadWaliKelasMonthlyPdf(report: MonthlyWaliKelasReport) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const { meta, presensiSummary: ps, pembinaanSummary: pb, studentRows } = report;

  const wilayahLabel = meta.wilayah === 'Semua' ? 'Semua Wilayah (Putra & Putri)' : `Wilayah ${meta.wilayah}`;
  let y = drawSchoolHeader(
    doc,
    'LAPORAN RINGKASAN BULANAN WALI KELAS: PRESENSI & PEMBINAAN SANTRI',
    `${meta.bulanLabel} · ${wilayahLabel} · Kelas: ${meta.kelas} · Wali Kelas: ${meta.waliKelas}`,
  );

  // Section 1: Executive KPI Summary Table (Presensi + Pembinaan)
  const cakupanPct =
    meta.totalSantri === 0 ? 0 : Math.round((pb.santriDibina / meta.totalSantri) * 100);

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Indikator Presensi Bulanan',
        'Capaian Presensi',
        'Indikator Pembinaan & Ibadah',
        'Capaian Pembinaan',
      ],
    ],
    body: [
      [
        'Persentase Kehadiran Kumulatif (H+T)',
        `${ps.persenHadir}% (${ps.H + ps.T} dari ${ps.totalSesi} log sesi)`,
        'Cakupan Santri Terbina Bulan Ini',
        `${pb.santriDibina}/${meta.totalSantri} Santri (${cakupanPct}%) · ${pb.totalCatatan} Catatan`,
      ],
      [
        'Rincian Status Kehadiran (H / T / S / I / A)',
        `Hadir: ${ps.H} · Telat: ${ps.T} · Sakit: ${ps.S} · Izin: ${ps.I} · Alfa: ${ps.A}`,
        'Ketaatan Sholat Wajib 5 Waktu & Sunnah',
        `Sholat Wajib: ${pb.persenSholatWajib}% · Sunnah/Tilawah: ${pb.persenIbadahSunnah}%`,
      ],
      [
        "Kehadiran per Divisi (KBM / Al-Qur'an / Asrama)",
        `KBM: ${ps.byDivisi.Akademik.persenHadir}% · Al-Qur'an: ${ps.byDivisi.AlQuran.persenHadir}% · Asrama: ${ps.byDivisi.Asrama.persenHadir}%`,
        'Rekap Poin Karakter & Tindak Lanjut',
        `Net Poin: ${pb.netPoin > 0 ? `+${pb.netPoin}` : pb.netPoin} (Prestasi: ${pb.totalPrestasi}, Pelanggaran: ${pb.totalPelanggaran}) · Eskalasi: ${pb.statusCounts.Eskalasi}`,
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 64 },
      1: { cellWidth: 70 },
      2: { fontStyle: 'bold', cellWidth: 64 },
      3: { cellWidth: 71 },
    },
  });

  y = getFinalY(doc, y + 25) + 5;

  // Section 2: Per-Student Monthly Recap Table (Presensi + Pembinaan + Ibadah)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `DAFTAR REKAPITULASI BULANAN PER SANTRI (${studentRows.length} SANTRI) — PRESENSI & PEMBINAAN TERPADU`,
    14,
    y,
  );

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        'No',
        'NIS',
        'Nama Santri',
        'Kelas',
        'Kamar',
        'H+T',
        'S/I/A',
        '% Hadir',
        'Binaan',
        'Wajib %',
        'Sunnah %',
        'Poin',
        'Status',
        'Catatan Pembinaan / Tindak Lanjut Terakhir',
      ],
    ],
    body:
      studentRows.length > 0
        ? studentRows.map((st, idx) => [
            String(idx + 1),
            st.nis || '-',
            st.nama,
            st.kelas,
            st.kamar,
            `${st.presensi.H + st.presensi.T} (${st.presensi.H}/${st.presensi.T})`,
            `${st.presensi.S}/${st.presensi.I}/${st.presensi.A}`,
            `${st.presensi.persenHadir}%`,
            `${st.pembinaan.totalCatatan}x`,
            `${st.pembinaan.wajibPct}%`,
            `${st.pembinaan.sunnahPct}%`,
            st.pembinaan.netPoin > 0 ? `+${st.pembinaan.netPoin}` : String(st.pembinaan.netPoin),
            st.pembinaan.statusTerakhir,
            st.pembinaan.catatanTerakhir || '-',
          ])
        : [['-', '-', 'Belum ada data santri pada kelas/filter ini', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.6, textColor: [15, 23, 42], valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 16 },
      2: { halign: 'left', fontStyle: 'bold', cellWidth: 42 },
      3: { halign: 'left', cellWidth: 26 },
      4: { halign: 'left', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 15 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      8: { halign: 'center', cellWidth: 12 },
      9: { halign: 'center', cellWidth: 14 },
      10: { halign: 'center', cellWidth: 15 },
      11: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      12: { halign: 'center', cellWidth: 15 },
      13: { halign: 'left', cellWidth: 42 },
    },
  });

  const finalY = getFinalY(doc, y + 40);
  drawSignatureBlock(
    doc,
    finalY,
    'Mengetahui, Kepala Sekolah / Kesantrian',
    '( ........................................ )',
    `Wali Kelas (${meta.kelas})`,
    meta.waliKelas !== 'Semua Wali Kelas' ? meta.waliKelas : '( ........................................ )',
  );

  const safeClass = meta.kelas.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeMonth = meta.bulanLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Ringkasan_Bulanan_Wali_Kelas_${safeClass}_${safeMonth}.pdf`);
}

/**
 * 2. Direct PDF Export for Integrated Data Analytics Dashboard (Dasbor Analisis Data)
 */
export function downloadAnalyticsDashboardPdf(
  analisis: AnalyticsTerpadu,
  monthlyReport: MonthlyWaliKelasReport | null,
  wilayah: WilayahFilter,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const wilayahLabel = wilayah === 'Semua' ? 'Semua Wilayah (Putra & Putri)' : `Wilayah ${wilayah}`;
  const periodeLabel = monthlyReport?.meta.bulanLabel || `Tanggal: ${formatTanggalIndo(analisis.tanggal)}`;

  let y = drawSchoolHeader(
    doc,
    'LAPORAN DASBOR ANALISIS DATA PRESENSI & PEMBINAAN TERPADU',
    `${wilayahLabel} · Periode: ${periodeLabel} · Dicetak: ${formatTanggalIndo(getTodayDateStr())}`,
  );

  // Table 1: Comparative Division Attendance (Putra vs Putri)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. ANALISIS KEHADIRAN PER DIVISI (WILAYAH PUTRA VS WILAYAH PUTRI)', 14, y);

  const divRows = (
    [
      { key: 'Asrama', label: 'Asrama / Kesantrian' },
      { key: 'Belajar', label: 'Akademik (KBM Kelas)' },
      { key: 'AlQuran', label: "Al-Qur'an / Halaqah" },
      { key: 'Ujian', label: 'Ujian Sekolah' },
    ] as const
  ).map((d) => {
    const pa = analisis.divisiByWilayah.Putra[d.key];
    const pi = analisis.divisiByWilayah.Putri[d.key];
    return [
      d.label,
      `${pa.persenHadir}% (${pa.H + pa.T}/${pa.total})`,
      `H:${pa.H} · T:${pa.T} · S:${pa.S} · I:${pa.I} · A:${pa.A}`,
      `${pi.persenHadir}% (${pi.H + pi.T}/${pi.total})`,
      `H:${pi.H} · T:${pi.T} · S:${pi.S} · I:${pi.I} · A:${pi.A}`,
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        'Divisi Presensi',
        'Putra (% Hadir)',
        'Rincian Log Putra',
        'Putri (% Hadir)',
        'Rincian Log Putri',
      ],
    ],
    body: divRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
  });

  y = getFinalY(doc, y + 30) + 5;

  // Table 2: Pembinaan & Ibadah Analytics Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2. ANALISIS PEMBINAAN KARAKTER, IBADAH & TINDAK LANJUT SANTRI', 14, y);

  const pbPa = analisis.pembinaanAnalisis.Putra;
  const pbPi = analisis.pembinaanAnalisis.Putri;
  const pbAll = analisis.pembinaanAnalisis.Semua;

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        'Wilayah',
        'Santri Terdaftar',
        'Santri Terbina',
        'Total Catatan',
        'Sholat Wajib %',
        'Sunnah %',
        'Prestasi / Pelanggaran',
        'Net Poin',
        'Status (Selesai / Proses / Eskalasi)',
      ],
    ],
    body: [
      [
        'Wilayah Putra',
        String(pbPa.totalSantri),
        `${pbPa.santriDibina} (${pbPa.totalSantri ? Math.round((pbPa.santriDibina / pbPa.totalSantri) * 100) : 0}%)`,
        String(pbPa.totalCatatan),
        `${pbPa.persenSholatWajib}%`,
        `${pbPa.persenIbadahSunnah}%`,
        `${pbPa.totalPrestasi} / ${pbPa.totalPelanggaran}`,
        pbPa.netPoin > 0 ? `+${pbPa.netPoin}` : String(pbPa.netPoin),
        `${pbPa.statusCounts.Selesai} / ${pbPa.statusCounts.Proses} / ${pbPa.statusCounts.Eskalasi}`,
      ],
      [
        'Wilayah Putri',
        String(pbPi.totalSantri),
        `${pbPi.santriDibina} (${pbPi.totalSantri ? Math.round((pbPi.santriDibina / pbPi.totalSantri) * 100) : 0}%)`,
        String(pbPi.totalCatatan),
        `${pbPi.persenSholatWajib}%`,
        `${pbPi.persenIbadahSunnah}%`,
        `${pbPi.totalPrestasi} / ${pbPi.totalPelanggaran}`,
        pbPi.netPoin > 0 ? `+${pbPi.netPoin}` : String(pbPi.netPoin),
        `${pbPi.statusCounts.Selesai} / ${pbPi.statusCounts.Proses} / ${pbPi.statusCounts.Eskalasi}`,
      ],
      [
        'Total Terpadu',
        String(pbAll.totalSantri),
        `${pbAll.santriDibina} (${pbAll.totalSantri ? Math.round((pbAll.santriDibina / pbAll.totalSantri) * 100) : 0}%)`,
        String(pbAll.totalCatatan),
        `${pbAll.persenSholatWajib}%`,
        `${pbAll.persenIbadahSunnah}%`,
        `${pbAll.totalPrestasi} / ${pbAll.totalPelanggaran}`,
        pbAll.netPoin > 0 ? `+${pbAll.netPoin}` : String(pbAll.netPoin),
        `${pbAll.statusCounts.Selesai} / ${pbAll.statusCounts.Proses} / ${pbAll.statusCounts.Eskalasi}`,
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.8, cellPadding: 2, textColor: [15, 23, 42], halign: 'center' },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
  });

  y = getFinalY(doc, y + 28) + 5;

  // Table 3: Per-Class Comparison (from monthlyReport if available)
  if (monthlyReport && monthlyReport.classComparison.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      `3. MATRIKS PERBANDINGAN KINERJA ANTAR KELAS (${monthlyReport.classComparison.length} KELAS)`,
      14,
      y,
    );

    autoTable(doc, {
      startY: y + 2,
      head: [
        [
          'No',
          'Kelas',
          'Wilayah',
          'Wali Kelas',
          'Jml Santri',
          '% Kehadiran',
          'Hadir / Absen',
          'Cakupan Pembinaan',
          'Sholat Wajib %',
          'Sunnah %',
          'Net Poin',
          'Kasus Aktif',
        ],
      ],
      body: monthlyReport.classComparison.map((c, idx) => [
        String(idx + 1),
        c.kelas,
        c.gender,
        c.waliKelas,
        String(c.totalSantri),
        `${c.persenHadir}%`,
        `${c.totalHadir} / ${c.totalAbsen}`,
        `${c.santriDibina}/${c.totalSantri} (${c.cakupanPembinaanPct}%)`,
        `${c.wajibPct}%`,
        `${c.sunnahPct}%`,
        c.netPoin > 0 ? `+${c.netPoin}` : String(c.netPoin),
        String(c.kasusAktif),
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.6, textColor: [15, 23, 42], halign: 'center' },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { halign: 'left', fontStyle: 'bold' },
        3: { halign: 'left' },
      },
    });

    y = getFinalY(doc, y + 35) + 4;
  }

  drawSignatureBlock(
    doc,
    y,
    'Mengetahui, Kepala Sekolah',
    '( ........................................ )',
    'Koordinator Pusat Data & SIM PINTAR',
    '( ........................................ )',
  );

  doc.save(`Dasbor_Analisis_Data_${wilayah}_${analisis.tanggal}.pdf`);
}

/**
 * 3. Direct PDF Export for any Tabular Report in Pusat Unduh (Tab 3) & Component Reports
 */
export function downloadTableReportPdf(params: {
  title: string;
  subtitle: string;
  metaRows?: Array<[string, string] | { label: string; value: string }>;
  headers: string[];
  rows: string[][];
  materiRows?: Array<{ no: number; tanggal: string; mapel: string; materi: string }>;
  signatures?: Array<{ role: string; name: string }>;
  filename: string;
  landscape?: boolean;
  orientation?: 'portrait' | 'landscape';
}) {
  const isLandscape = params.landscape || params.orientation === 'landscape';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = drawSchoolHeader(doc, params.title, params.subtitle);

  if (params.metaRows && params.metaRows.length > 0) {
    const normalizedMeta: Array<[string, string]> = params.metaRows.map((m) =>
      Array.isArray(m) ? m : [m.label, m.value],
    );
    autoTable(doc, {
      startY: y,
      body: normalizedMeta,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 1.2, textColor: [15, 23, 42] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 48 },
      },
    });
    y = getFinalY(doc, y + 12) + 3;
  }

  autoTable(doc, {
    startY: y,
    head: [params.headers],
    body: params.rows,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [15, 23, 42], valign: 'middle' },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
  });

  y = getFinalY(doc, y + 30) + 5;

  if (params.materiRows && params.materiRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('JURNAL MATERI PEMBELAJARAN TERCATAT', 14, y);

    autoTable(doc, {
      startY: y + 2,
      head: [['No', 'Tanggal', 'Mata Pelajaran', 'Ringkasan Materi Pembelajaran']],
      body: params.materiRows.map((m) => [String(m.no), m.tanggal, m.mapel, m.materi]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    });
    y = getFinalY(doc, y + 25) + 4;
  }

  const leftSig = params.signatures?.[0];
  const rightSig = params.signatures?.[1];

  drawSignatureBlock(
    doc,
    y,
    leftSig?.role || 'Mengetahui, Kepala Sekolah',
    leftSig?.name || '( ........................................ )',
    rightSig?.role || 'Petugas / Wali Kelas',
    rightSig?.name || '( ........................................ )',
  );

  doc.save(params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`);
}

// ==============================================================
// 4. CLIENT-SIDE 11-SHEET DATABASE EXCEL BUILDER & DOWNLOADER
// (100% berjalan di browser pengguna — bebas timeout Vercel 10 detik)
// ==============================================================

export interface ClientTemplateContext {
  students: Student[];
  rooms: RoomMapping[];
  teachers: TeacherPublic[];
  schedules: ScheduleItem[];
  ruanganUjian?: string[];
}

interface ClientRosterRow {
  no: string;
  nama: string;
  kelas: string;
  kamar: string;
  kelompokQuran: string;
  pengampuQuran: string;
  gender: Gender;
}

const CLIENT_FALLBACK_PUTRA_ROSTER: ClientRosterRow[] = [
  { no: '1', nama: 'ABDUL GHOFAR RAHMAN', kelas: '10 ABU BAKAR AS-SHIDDIQ', kamar: '10.6 Putra', kelompokQuran: '10-03 Putra', pengampuQuran: 'UST. NUR FAIZIN', gender: 'Putra' },
  { no: '2', nama: 'ACHMAD RASYA FARID', kelas: '10 ABU BAKAR AS-SHIDDIQ', kamar: '10.4 Putra', kelompokQuran: '10-08 Putra', pengampuQuran: 'UST. DAFFA M Z', gender: 'Putra' },
  { no: '7', nama: 'ARDANA PRANA SATRIA RAMADAN', kelas: '10 ABU BAKAR AS-SHIDDIQ', kamar: '10.8 Putra', kelompokQuran: '10-08 Putra', pengampuQuran: 'UST. DAFFA M Z', gender: 'Putra' },
  { no: '34', nama: 'ARIF AHKAM MAULANA', kelas: '10 ALI BIN ABI THALIB', kamar: '10.1 Putra', kelompokQuran: '10-09 Putra', pengampuQuran: 'UST. SOFYAN IMAM KELSABA', gender: 'Putra' },
  { no: '73', nama: 'GHAISAN WIDRATAMA AHLAM', kelas: '10 UMAR BIN KHATTAB', kamar: '10.9 Putra', kelompokQuran: '10-08 Putra', pengampuQuran: 'UST. DAFFA M Z', gender: 'Putra' },
  { no: '96', nama: 'AHMAD SYAKIR IHSAN', kelas: '10 UTSMAN BIN AFFAN', kamar: '10.5 Putra', kelompokQuran: '10-09 Putra', pengampuQuran: 'UST. SOFYAN IMAM KELSABA', gender: 'Putra' },
];

const CLIENT_DEFAULT_PUTRI_ROSTER: ClientRosterRow[] = [
  { no: 'P-01', nama: 'AISYAH HUMAIRA ZAHRA', kelas: '10 KHADIJAH BINTI KHUWAILID', kamar: '10.1 Putri', kelompokQuran: '10-01 Putri', pengampuQuran: 'USTZ. SITI MARIYAM', gender: 'Putri' },
  { no: 'P-02', nama: 'FATIMAH AZ-ZAHRA', kelas: '10 KHADIJAH BINTI KHUWAILID', kamar: '10.1 Putri', kelompokQuran: '10-01 Putri', pengampuQuran: 'USTZ. SITI MARIYAM', gender: 'Putri' },
  { no: 'P-03', nama: 'KHANSA ADILA RAHMAH', kelas: '10 AISYAH BINTI ABU BAKAR', kamar: '10.2 Putri', kelompokQuran: '10-02 Putri', pengampuQuran: 'USTZ. HANIFAH', gender: 'Putri' },
  { no: 'P-04', nama: 'NAYLA SALSABILA PUTRI', kelas: '10 AISYAH BINTI ABU BAKAR', kamar: '10.2 Putri', kelompokQuran: '10-02 Putri', pengampuQuran: 'USTZ. HANIFAH', gender: 'Putri' },
  { no: 'P-05', nama: 'HAFSHAH MUTIARA QOLBI', kelas: '11 FATIMAH AZ-ZAHRA', kamar: '11.1 Putri', kelompokQuran: '11-01 Putri', pengampuQuran: 'USTZ. MARYAM AL-HAFIDZAH', gender: 'Putri' },
  { no: 'P-06', nama: 'SALMA NURUL AINI', kelas: '12 RUQAYYAH BINTI MUHAMMAD', kamar: '12.1 Putri', kelompokQuran: '12-01 Putri', pengampuQuran: 'USTZ. MARYAM AL-HAFIDZAH', gender: 'Putri' },
];

function inferGenderClient(text: string): Gender {
  const up = text.toUpperCase();
  if (
    up.includes('PUTRI') ||
    up.includes('AKHWAT') ||
    up.includes('KHADIJAH') ||
    up.includes('AISYAH') ||
    up.includes('FATIMAH') ||
    up.includes('HAFSHAH') ||
    up.includes('RUQAYYAH') ||
    up.includes('USTZ') ||
    up.includes('MUSYRIFAH')
  ) {
    return 'Putri';
  }
  return 'Putra';
}

function makeUsernameClient(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/^(ust\.|ustadz\.|ustz\.|ustadzah\.|ust,)\s*/i, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 24) || 'user'
  );
}

function sanitizeExcelText(val: unknown): string {
  return String(val ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

function autoFitColumnsClient(rows: string[][], minWidth = 12, maxWidth = 38): XLSX.ColInfo[] {
  if (rows.length === 0) return [];
  const colCount = Math.max(...rows.map((r) => r.length));
  const widths: number[] = Array(colCount).fill(minWidth);
  for (let r = 0; r < Math.min(rows.length, 250); r++) {
    const row = rows[r];
    for (let c = 0; c < colCount; c++) {
      const len = String(row[c] ?? '').length + 3;
      if (len > widths[c]) widths[c] = Math.min(maxWidth, len);
    }
  }
  return widths.map((wch) => ({ wch: Math.round(wch) }));
}

function buildCombinedRosterForClient(ctx: ClientTemplateContext): {
  putraRoster: ClientRosterRow[];
  putriRoster: ClientRosterRow[];
  putraSourceNote: string;
  putriSourceNote: string;
} {
  const livePutra = ctx.students.filter((s) => s.gender === 'Putra');
  const livePutri = ctx.students.filter((s) => s.gender === 'Putri');

  const putraRoster: ClientRosterRow[] = livePutra.map((s, idx) => ({
    no: s.nis || String(idx + 1),
    nama: s.nama,
    kelas: s.kelas,
    kamar: s.kamar,
    kelompokQuran: s.kelompokQuran,
    pengampuQuran: s.pengampuQuran || '',
    gender: 'Putra',
  }));

  const putriRoster: ClientRosterRow[] = livePutri.map((s, idx) => ({
    no: s.nis || `P-${idx + 1}`,
    nama: s.nama,
    kelas: s.kelas,
    kamar: s.kamar,
    kelompokQuran: s.kelompokQuran,
    pengampuQuran: s.pengampuQuran || '',
    gender: 'Putri',
  }));

  return {
    putraRoster,
    putriRoster,
    putraSourceNote: livePutra.length > 0 ? 'Data Upload Template' : 'Kosong — Siap Upload Template',
    putriSourceNote: livePutri.length > 0 ? 'Data Upload Template' : 'Kosong — Siap Upload Template',
  };
}

/**
 * Membangun spesifikasi lengkap 11 sheet database Excel SIM PINTAR 100% di browser klien,
 * identik persis dengan struktur tabel, kolom, header, dan nama sheet aslinya.
 */
export function buildClientDatabaseWorkbookSpec(ctx: ClientTemplateContext): DatabaseWorkbookSpec {
  const { putraRoster, putriRoster, putraSourceNote, putriSourceNote } =
    buildCombinedRosterForClient(ctx);

  const roster = [...putraRoster, ...putriRoster];
  const putraCount = putraRoster.length;
  const putriCount = putriRoster.length;

  const sourceLabel = `Putra: ${putraCount} (${putraSourceNote}) · Putri: ${putriCount} (${putriSourceNote})`;

  const studentHeader = [
    'No / NIS',
    'Nama',
    'Wilayah (Putra/Putri)',
    'Nama Kelas',
    'Kamar',
    'Kelp. Al-Quran',
    'Pengampu Al-Quran',
  ];

  const sortRoster = (arr: ClientRosterRow[]) =>
    [...arr].sort(
      (a, b) =>
        a.kelas.localeCompare(b.kelas, 'id', { numeric: true }) ||
        a.nama.localeCompare(b.nama),
    );

  // Sheet 1A: Master Siswa Wilayah Putra
  const santriPutraRows: string[][] = [
    studentHeader,
    ...sortRoster(putraRoster).map((r) => [
      sanitizeExcelText(r.no),
      sanitizeExcelText(r.nama),
      'Putra',
      sanitizeExcelText(r.kelas),
      sanitizeExcelText(r.kamar),
      sanitizeExcelText(r.kelompokQuran),
      sanitizeExcelText(r.pengampuQuran),
    ]),
  ];

  // Sheet 1B: Master Siswa Wilayah Putri
  const santriPutriRows: string[][] = [
    studentHeader,
    ...sortRoster(putriRoster).map((r) => [
      sanitizeExcelText(r.no),
      sanitizeExcelText(r.nama),
      'Putri',
      sanitizeExcelText(r.kelas),
      sanitizeExcelText(r.kamar),
      sanitizeExcelText(r.kelompokQuran),
      sanitizeExcelText(r.pengampuQuran),
    ]),
  ];

  // Sheet 2A & 2B: Tabel Terpisah Musyrif (Putra) dan Musyrifah (Putri)
  const roomGenderMap = new Map<string, Gender>();
  for (const r of roster) {
    if (r.kamar) roomGenderMap.set(r.kamar, r.gender);
  }
  for (const rm of ctx.rooms) {
    if (rm.kamar) roomGenderMap.set(rm.kamar, rm.gender);
  }
  const sortedRooms = Array.from(roomGenderMap.keys()).sort(
    (a, b) =>
      (roomGenderMap.get(a) || 'Putra').localeCompare(roomGenderMap.get(b) || 'Putra') ||
      a.localeCompare(b, 'id', { numeric: true }),
  );

  const musyrifPutraBody: string[][] = [];
  const musyrifahPutriBody: string[][] = [];
  const coveredRooms = new Set<string>();

  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    if ((t.kamarBinaan && t.kamarBinaan.length > 0) || t.peran === 'Musyrif' || t.peran === 'Musyrifah') {
      const isPutri =
        t.genderScope === 'Putri' ||
        t.peran === 'Musyrifah' ||
        (t.kamarBinaan || []).some((km) => inferGenderClient(km) === 'Putri');
      const targetBody = isPutri ? musyrifahPutriBody : musyrifPutraBody;
      targetBody.push([
        String(targetBody.length + 1),
        sanitizeExcelText(t.nama),
        sanitizeExcelText((t.kamarBinaan || []).join('; ')),
        isPutri ? 'Putri' : 'Putra',
        sanitizeExcelText(t.whatsapp || '628'),
        sanitizeExcelText(t.username),
        sanitizeExcelText(t.pin || generateClientTeacherToken(t.nama)),
      ]);
      (t.kamarBinaan || []).forEach((km) => coveredRooms.add(km.toUpperCase()));
    }
  }

  // Tidak menyisipkan data dummy Musyrif/Musyrifah; semua berasal dari upload template

  for (const rm of sortedRooms) {
    if (coveredRooms.has(rm.toUpperCase())) continue;
    const roomGender = roomGenderMap.get(rm) || inferGenderClient(rm);
    const isPutri = roomGender === 'Putri';
    const targetBody = isPutri ? musyrifahPutriBody : musyrifPutraBody;
    targetBody.push([
      String(targetBody.length + 1),
      '(Belum Ditentukan)',
      sanitizeExcelText(rm),
      isPutri ? 'Putri' : 'Putra',
      '',
      '',
      '',
    ]);
  }

  const musyrifPutraRows: string[][] = [
    ['No', 'Nama Musyrif', 'Kamar Binaan (pisah ;)', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...musyrifPutraBody,
  ];

  const musyrifahPutriRows: string[][] = [
    ['No', 'Nama Musyrifah', 'Kamar Binaan (pisah ;)', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...musyrifahPutriBody,
  ];

  // Sheet 3A, 3B & 3C: Tabel Terpisah Wali Kelas Putra, Wali Kelas Putri, dan Guru Pengampu
  const classGenderMap = new Map<string, Gender>();
  const pengampuMap = new Map<string, Gender>();
  for (const r of roster) {
    if (r.kelas) classGenderMap.set(r.kelas, r.gender);
    if (r.pengampuQuran) pengampuMap.set(r.pengampuQuran.toUpperCase(), r.gender);
  }
  const sortedClasses = Array.from(classGenderMap.keys()).sort(
    (a, b) =>
      (classGenderMap.get(a) || 'Putra').localeCompare(classGenderMap.get(b) || 'Putra') ||
      a.localeCompare(b, 'id', { numeric: true }),
  );
  const waliByClass = new Map<string, TeacherPublic>();
  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    if (t.waliKelasOf) waliByClass.set(t.waliKelasOf.toUpperCase(), t);
  }

  const waliPutraBody: string[][] = [];
  const waliPutriBody: string[][] = [];
  const addedWaliNames = new Set<string>();

  for (const kls of sortedClasses) {
    const existing = waliByClass.get(kls.toUpperCase());
    const classGender = classGenderMap.get(kls) || inferGenderClient(kls);
    const isPutri = classGender === 'Putri';
    const targetBody = isPutri ? waliPutriBody : waliPutraBody;
    if (existing) {
      targetBody.push([
        String(targetBody.length + 1),
        sanitizeExcelText(existing.nama),
        sanitizeExcelText(kls),
        isPutri ? 'Putri' : 'Putra',
        sanitizeExcelText(existing.whatsapp || '628'),
        sanitizeExcelText(existing.username),
        sanitizeExcelText(existing.pin || generateClientTeacherToken(existing.nama)),
      ]);
      addedWaliNames.add(existing.nama.toUpperCase());
    } else {
      targetBody.push([
        String(targetBody.length + 1),
        '(Belum Ditentukan)',
        sanitizeExcelText(kls),
        isPutri ? 'Putri' : 'Putra',
        '',
        '',
        '',
      ]);
    }
  }

  const waliPutraRows: string[][] = [
    ['No', 'Nama Wali Kelas', 'Kelas Binaan', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...waliPutraBody,
  ];

  const waliPutriRows: string[][] = [
    ['No', 'Nama Wali Kelas', 'Kelas Binaan', 'Wilayah', 'WhatsApp', 'Username / Email', 'PIN'],
    ...waliPutriBody,
  ];

  // Sheet 3C: Guru Mapel & Pengampu Al-Qur'an
  const guruBody: string[][] = [];
  const addedGuruNames = new Set<string>();
  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    if (t.peran === 'Guru') {
      guruBody.push([
        String(guruBody.length + 1),
        sanitizeExcelText(t.nama),
        'Guru',
        sanitizeExcelText(t.genderScope || 'Semua'),
        sanitizeExcelText(t.whatsapp || '628'),
        sanitizeExcelText(t.username),
        sanitizeExcelText(t.pin || generateClientTeacherToken(t.nama)),
      ]);
      addedGuruNames.add(t.nama.toUpperCase());
    }
  }
  for (const [pengampu, g] of Array.from(pengampuMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (addedGuruNames.has(pengampu) || addedWaliNames.has(pengampu)) continue;
    guruBody.push([
      String(guruBody.length + 1),
      sanitizeExcelText(pengampu),
      'Guru / Pengampu Al-Quran',
      g,
      '628',
      makeUsernameClient(pengampu),
      '1234',
    ]);
    addedGuruNames.add(pengampu);
  }
  const guruRows: string[][] = [
    ['No', 'Nama Guru / Pengampu', 'Peran / Bidang', 'Wilayah (Putra/Putri/Semua)', 'WhatsApp', 'Username / Email', 'PIN'],
    ...guruBody,
  ];

  // Sheet Master_Pegawai: Daftar seluruh Pegawai / Ustadz / Ustadzah
  const pegawaiMap = new Map<
    string,
    {
      nama: string;
      wilayah: 'Putra' | 'Putri' | 'Semua';
      amanahUtama: string;
      amanahTambahan: string[];
      kelasBinaan: string;
      kamarBinaan: string;
      whatsapp: string;
      username: string;
      pin: string;
    }
  >();

  for (const t of ctx.teachers) {
    if (t.peran === 'Admin Super') continue;
    pegawaiMap.set(t.nama.toUpperCase(), {
      nama: sanitizeExcelText(t.nama),
      wilayah: t.genderScope || 'Semua',
      amanahUtama: t.peran,
      amanahTambahan: (t.peranTambahan || []).filter((p) => p !== t.peran),
      kelasBinaan: sanitizeExcelText(t.waliKelasOf || ''),
      kamarBinaan: sanitizeExcelText((t.kamarBinaan || []).join('; ')),
      whatsapp: sanitizeExcelText(t.whatsapp || '628'),
      username: sanitizeExcelText(t.username),
      pin: sanitizeExcelText(t.pin || generateClientTeacherToken(t.nama)),
    });
  }

  const upsertTemplatePegawai = (
    nama: string,
    wilayah: 'Putra' | 'Putri' | 'Semua',
    role: string,
    opts: { kelas?: string; kamar?: string; wa?: string; user?: string },
  ) => {
    const key = nama.trim().toUpperCase();
    if (!key || key === '(BELUM DITENTUKAN)' || key === 'BELUM DIATUR') return;
    const prev = pegawaiMap.get(key);
    if (prev) {
      if (prev.amanahUtama !== role && !prev.amanahTambahan.includes(role)) {
        prev.amanahTambahan.push(role);
      }
      if (!prev.kelasBinaan && opts.kelas) prev.kelasBinaan = opts.kelas;
      if (!prev.kamarBinaan && opts.kamar) prev.kamarBinaan = opts.kamar;
      if ((!prev.whatsapp || prev.whatsapp === '628') && opts.wa) prev.whatsapp = opts.wa;
      if (!prev.username && opts.user) prev.username = opts.user;
    } else {
      pegawaiMap.set(key, {
        nama: sanitizeExcelText(nama),
        wilayah,
        amanahUtama: role,
        amanahTambahan: [],
        kelasBinaan: sanitizeExcelText(opts.kelas || ''),
        kamarBinaan: sanitizeExcelText(opts.kamar || ''),
        whatsapp: sanitizeExcelText(opts.wa || '628'),
        username: sanitizeExcelText(opts.user || makeUsernameClient(nama)),
        pin: '1234',
      });
    }
  };

  for (const r of musyrifPutraBody) {
    upsertTemplatePegawai(r[1], 'Putra', 'Musyrif', { kamar: r[2], wa: r[4], user: r[5] });
  }
  for (const r of musyrifahPutriBody) {
    upsertTemplatePegawai(r[1], 'Putri', 'Musyrifah', { kamar: r[2], wa: r[4], user: r[5] });
  }
  for (const r of waliPutraBody) {
    upsertTemplatePegawai(r[1], 'Putra', 'Wali Kelas', { kelas: r[2], wa: r[4], user: r[5] });
  }
  for (const r of waliPutriBody) {
    upsertTemplatePegawai(r[1], 'Putri', 'Wali Kelas', { kelas: r[2], wa: r[4], user: r[5] });
  }
  for (const r of guruBody) {
    const w: 'Putra' | 'Putri' | 'Semua' =
      r[3] === 'Putri' ? 'Putri' : r[3] === 'Putra' ? 'Putra' : 'Semua';
    upsertTemplatePegawai(r[1], w, 'Guru', { wa: r[4], user: r[5] });
  }

  const masterPegawaiBody: string[][] = Array.from(pegawaiMap.values())
    .sort((a, b) => a.wilayah.localeCompare(b.wilayah) || a.nama.localeCompare(b.nama))
    .map((p, idx) => [
      String(idx + 1),
      p.nama,
      p.wilayah,
      p.amanahUtama,
      p.amanahTambahan.join('; '),
      p.kelasBinaan,
      p.kamarBinaan,
      p.whatsapp,
      p.username,
      p.pin,
    ]);

  const masterPegawaiRows: string[][] = [
    [
      'No',
      'Nama Pegawai',
      'Wilayah (Putra/Putri/Semua)',
      'Amanah Utama (Guru/Wali Kelas/Musyrif/Musyrifah)',
      'Amanah Tambahan (pisah ;)',
      'Kelas Binaan',
      'Kamar Binaan (pisah ;)',
      'WhatsApp',
      'Username / Email',
      'PIN',
    ],
    ...masterPegawaiBody,
  ];

  // Sheet 4: Jadwal Mengajar & Halaqah (Putra & Putri) — murni dari data yang diupload
  const jadwalBody: string[][] = ctx.schedules.map((s) => [
    sanitizeExcelText(s.guru),
    sanitizeExcelText(s.hari),
    sanitizeExcelText(s.kelas),
    sanitizeExcelText(s.mapel),
    sanitizeExcelText(s.jamKe),
    sanitizeExcelText(s.gender),
  ]);
  const jadwalRows: string[][] = [
    ['Guru', 'Hari', 'Kelas / Halaqah', 'Mata Pelajaran', 'Jam Ke', 'Wilayah (Putra/Putri)'],
    ...jadwalBody,
  ];

  // Sheet 5: Ruang Ujian Putra & Putri — murni dari data yang diupload
  const existingRooms = ctx.ruanganUjian && ctx.ruanganUjian.length > 0 ? ctx.ruanganUjian : [];
  const ruangRows: string[][] = [
    ['Nama Ruangan Ujian', 'Wilayah (Putra/Putri/Semua)'],
    ...existingRooms.map((r) => [
      sanitizeExcelText(r),
      r.toUpperCase().includes('PUTRI') ? 'Putri' : r.toUpperCase().includes('PUTRA') ? 'Putra' : 'Semua',
    ]),
  ];

  // Sheet 0: Panduan Singkat + Ringkasan Tabel Terpisah
  const guideRows: string[][] = [
    ['TEMPLATE DATABASE MASTER SEKOLAH (.XLSX) - PINTAR TERPADU (WILAYAH PUTRA & PUTRI)'],
    ['TIPS CEPAT: Anda TIDAK harus mengisi semua sheet. Cukup upload Sheet Master_Pegawai (bahkan hanya Nama Pegawai saja), lalu di aplikasi Admin Super klik Nama Pegawai -> klik Amanah Kamar / Wali Kelas / Musyrif / Guru!'],
    ['Pemisahan Sheet: Siswa (1A/1B), Master_Pegawai, Musyrif Putra (2A), Musyrifah Putri (2B), Wali Kelas Putra (3A), Wali Kelas Putri (3B), dan Guru Pengampu (3C).'],
    [''],
    ['Nama Sheet', 'Isi Tabel Khusus', 'Jumlah Baris', 'Kolom Utama & Keterangan'],
    ['1A_Siswa_Putra', 'Master Santri Wilayah Putra', String(santriPutraRows.length - 1), `${putraCount} santri Putra (${putraSourceNote}).`],
    ['1B_Siswa_Putri', 'Master Santri Wilayah Putri', String(santriPutriRows.length - 1), `${putriCount} santri Putri (${putriSourceNote}).`],
    ['Master_Pegawai', 'Daftar Induk Seluruh Pegawai', String(masterPegawaiRows.length - 1), 'Boleh isi Nama Pegawai saja dulu, lalu klik amanah kamar/kelas di aplikasi!'],
    ['2A_Musyrif_Putra', 'Tabel Musyrif Asrama Putra', String(musyrifPutraRows.length - 1), 'No | Nama Musyrif | Kamar Binaan (pisah ;) | Wilayah | WhatsApp | Username | PIN'],
    ['2B_Musyrifah_Putri', 'Tabel Musyrifah Asrama Putri', String(musyrifahPutriRows.length - 1), 'No | Nama Musyrifah | Kamar Binaan (pisah ;) | Wilayah | WhatsApp | Username | PIN'],
    ['3A_Wali_Kelas_Putra', 'Tabel Wali Kelas Wilayah Putra', String(waliPutraRows.length - 1), 'No | Nama Wali Kelas | Kelas Binaan | Wilayah | WhatsApp | Username | PIN'],
    ['3B_Wali_Kelas_Putri', 'Tabel Wali Kelas Wilayah Putri', String(waliPutriRows.length - 1), 'No | Nama Wali Kelas | Kelas Binaan | Wilayah | WhatsApp | Username | PIN'],
    ['3C_Guru_Pengampu', 'Tabel Guru Mapel & Pengampu Qur’an', String(guruRows.length - 1), 'No | Nama Guru | Peran | Wilayah (Putra/Putri/Semua) | WhatsApp | Username | PIN'],
    ['4_Jadwal_Mengajar', 'Jadwal Akademik & Halaqah Putra/Putri', String(jadwalRows.length - 1), 'Hari: SENIN-SABTU (Senin/Jumat 6 JP, Sel-Kam 9 JP, Sabtu 7 JP).'],
    ['5_Ruang_Ujian', 'Daftar Ruangan Ujian Putra & Putri', String(ruangRows.length - 1), 'Tandai ruangan Putra / Putri / Semua.'],
    [''],
    ['CARA PRAKTIS:'],
    ['1. Upload Sheet Master_Pegawai (atau paste daftar nama di panel Admin Super -> tab 2. Master Pegawai & Amanah).'],
    ['2. Klik nama pegawai yang sudah masuk, lalu klik amanah Kamar Asrama, Kelas Wali, Musyrif/ah, atau Guru langsung dari aplikasi.'],
  ];

  const sheets: WorkbookSheetSpec[] = [
    { name: '0_Panduan', label: 'Panduan & Peta Sheet', rows: guideRows },
    { name: '1A_Siswa_Putra', label: 'Santri Wilayah Putra', rows: santriPutraRows },
    { name: '1B_Siswa_Putri', label: 'Santri Wilayah Putri', rows: santriPutriRows },
    { name: 'Master_Pegawai', label: 'Daftar Induk Pegawai', rows: masterPegawaiRows },
    { name: '2A_Musyrif_Putra', label: 'Musyrif Asrama Putra', rows: musyrifPutraRows },
    { name: '2B_Musyrifah_Putri', label: 'Musyrifah Asrama Putri', rows: musyrifahPutriRows },
    { name: '3A_Wali_Kelas_Putra', label: 'Wali Kelas Putra', rows: waliPutraRows },
    { name: '3B_Wali_Kelas_Putri', label: 'Wali Kelas Putri', rows: waliPutriRows },
    { name: '3C_Guru_Pengampu', label: 'Guru & Pengampu Qur’an', rows: guruRows },
    { name: '4_Jadwal_Mengajar', label: 'Jadwal Putra & Putri', rows: jadwalRows },
    { name: '5_Ruang_Ujian', label: 'Ruang Ujian Putra/Putri', rows: ruangRows },
  ];

  return {
    filename: 'Template_Database_PINTAR_SIM.xlsx',
    sourceLabel,
    sheets,
  };
}

function buildSheetWithTextCellsClient(rows: string[][]): XLSX.WorkSheet {
  const cleanRows = rows.map((r) =>
    r.map((cell) => sanitizeExcelText(cell)),
  );
  const ws = XLSX.utils.aoa_to_sheet(cleanRows);
  ws['!cols'] = autoFitColumnsClient(cleanRows);
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
  if (range) {
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
          cell.t = 's';
          cell.z = '@';
          cell.v = String(cell.v ?? '');
        }
      }
    }
  }
  return ws;
}

/**
 * Merakit dan mengunduh file Excel database 11 sheet (.xlsx) sepenuhnya di browser pengguna
 * tanpa memanggil endpoint /api/ backend (terbebas dari timeout Vercel 10 detik).
 */
export function downloadMasterDatabaseExcelClient(ctx: ClientTemplateContext): DatabaseWorkbookSpec {
  const spec = buildClientDatabaseWorkbookSpec(ctx);
  const wb = XLSX.utils.book_new();
  for (const sheet of spec.sheets) {
    const ws = buildSheetWithTextCellsClient(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const out = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = spec.filename || 'Template_Database_PINTAR_SIM.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return spec;
}

// ==============================================================
// LABKOM & RUANG SMA — DIRECT PDF & EXCEL EXPORTS (CLIENT-SIDE)
// ==============================================================

export function downloadLabkomRekapPdf(params: {
  kampus: LabkomKampus;
  isLab: boolean;
  semesterLabel: string;
  bulanLabel: string;
  excludeInformatika: boolean;
  guruAktif: Array<[string, number]>;
  topItems: Array<[string, number]>;
  guruBelum: string[];
}): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const unitLabel = params.isLab ? 'JP' : 'Sesi';
  const tipeLabel = params.isLab ? 'LABKOM' : 'RUANGAN';
  const yStart = drawSchoolHeader(
    doc,
    `REKAP PEMINJAMAN ${tipeLabel} · KAMPUS ${params.kampus}`,
    `Periode: ${params.semesterLabel} · Bulan: ${params.bulanLabel}${params.excludeInformatika ? ' (Non-Informatika)' : ''}`,
  );

  const totalUnit = params.guruAktif.reduce((acc, g) => acc + g[1], 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Guru Aktif: ${params.guruAktif.length}   |   Belum Menggunakan: ${params.guruBelum.length}   |   Total Pemakaian: ${totalUnit} ${unitLabel}`,
    14,
    yStart + 2,
  );

  autoTable(doc, {
    startY: yStart + 6,
    head: [['No', 'Nama Guru / Pembina', `Jumlah ${unitLabel}`]],
    body:
      params.guruAktif.length > 0
        ? params.guruAktif.map(([nama, count], idx) => [String(idx + 1), nama, `${count} ${unitLabel}`])
        : [['-', 'Belum ada penggunaan pada filter periode ini.', '-']],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', cellWidth: 32 },
    },
  });

  const yAfterGuru = getFinalY(doc, yStart + 40) + 6;
  autoTable(doc, {
    startY: yAfterGuru,
    head: [['No', params.isLab ? 'Mata Pelajaran / Agenda' : 'Nama Ruangan', `Total ${unitLabel}`]],
    body:
      params.topItems.length > 0
        ? params.topItems.map(([label, count], idx) => [String(idx + 1), label, `${count} ${unitLabel}`])
        : [['-', 'Tidak ada data pada filter ini.', '-']],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      2: { halign: 'center', cellWidth: 32 },
    },
  });

  if (params.guruBelum.length > 0) {
    const yAfterTop = getFinalY(doc, yAfterGuru + 30) + 6;
    autoTable(doc, {
      startY: yAfterTop,
      head: [['No', 'Guru Belum Menggunakan Pada Periode Ini']],
      body: params.guruBelum.map((nama, idx) => [String(idx + 1), nama]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [190, 18, 60], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'center', cellWidth: 14 } },
    });
  }

  const filename = `Rekap_${tipeLabel}_${params.kampus}_${getTodayDateStr()}.pdf`;
  doc.save(filename);
  return filename;
}

export function downloadLabkomDenahPdf(params: {
  kampus: LabkomKampus;
  lokasi: string;
  plotings: LabkomPloting[];
}): string {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`DENAH PLOTING ${params.lokasi} — KAMPUS ${params.kampus}`, pageW / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`SIM PINTAR · Ruangan & Labkom SMA As-Syifa · Dicetak ${formatTanggalIndo(getTodayDateStr())}`, pageW / 2, 18.5, { align: 'center' });

  // Papan tulis bar
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 23, pageW - 28, 10, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('P A P A N   T U L I S   /   M E J A   G U R U', pageW / 2, 29.5, { align: 'center' });

  const plotMap = new Map<number, LabkomPloting>();
  for (const p of params.plotings) {
    if (p.kampus === params.kampus && p.lokasi.toUpperCase() === params.lokasi.toUpperCase()) {
      plotMap.set(p.noPc, p);
    }
  }

  const palette: Array<[number, number, number]> = [
    [37, 99, 235],
    [5, 150, 105],
    [124, 58, 237],
    [225, 29, 72],
    [217, 119, 6],
    [8, 145, 178],
    [192, 38, 211],
  ];

  const marginX = 14;
  const gap = 3;
  const cols = 8;
  const rows = 5;
  const cellW = (pageW - marginX * 2 - gap * (cols - 1)) / cols;
  const cellH = 29;
  const startY = 38;

  let pc = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginX + c * (cellW + gap);
      const y = startY + r * (cellH + gap);
      const entry = plotMap.get(pc);

      if (entry) {
        let hash = 0;
        for (let k = 0; k < entry.namaSiswa.length; k++) {
          hash = entry.namaSiswa.charCodeAt(k) + ((hash << 5) - hash);
        }
        const [cr, cg, cb] = palette[Math.abs(hash) % palette.length];
        doc.setFillColor(cr, cg, cb);
        doc.roundedRect(x, y, cellW, cellH, 2.5, 2.5, 'F');

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x + cellW / 2 - 4.5, y + 2.5, 9, 5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(cr, cg, cb);
        doc.text(String(pc), x + cellW / 2, y + 6.2, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        const nameLines = doc.splitTextToSize(entry.namaSiswa.toUpperCase(), cellW - 3).slice(0, 2);
        doc.text(nameLines, x + cellW / 2, y + 13, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(entry.kelas || '-', x + cellW / 2, y + 25.5, { align: 'center' });
      } else {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, y, cellW, cellH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(148, 163, 184);
        doc.text(String(pc), x + cellW / 2, y + 14.5, { align: 'center' });
        doc.setFontSize(6.5);
        doc.text('KOSONG', x + cellW / 2, y + 21, { align: 'center' });
      }
      pc++;
    }
  }

  const filename = `Denah_${params.lokasi.replace(/\s+/g, '_')}_${params.kampus}.pdf`;
  doc.save(filename);
  return filename;
}

export function downloadLabkomExcelClient(params: {
  bookings: LabkomBooking[];
  fixedSchedules: LabkomFixedSchedule[];
  plotings: LabkomPloting[];
  masters: LabkomMasterItem[];
}): string {
  const wb = XLSX.utils.book_new();
  const bookingHeader = [
    'ID',
    'Timestamp',
    'Kampus',
    'Email',
    'Nama Peminjam',
    'Guru',
    'Kelas',
    'Mapel',
    'Lab',
    'Tanggal',
    'Jam_Ke',
    'Keterangan',
    'Status',
  ];
  const toBookingRow = (b: LabkomBooking) => [
    b.id,
    b.timestamp,
    b.kampus,
    b.email,
    b.namaPeminjam,
    b.guru,
    b.kelas,
    b.mapel,
    b.lab,
    b.tanggal,
    b.jamKe,
    b.keterangan,
    b.status,
  ];

  const putraBookings = params.bookings.filter((b) => b.kampus === 'PUTRA').map(toBookingRow);
  const putriBookings = params.bookings.filter((b) => b.kampus === 'PUTRI').map(toBookingRow);

  const fixedRows = [
    ['ID', 'Hari', 'Kampus', 'Guru', 'Kelas', 'Mapel', 'Lab', 'Jam_Ke'],
    ...params.fixedSchedules.map((f) => [
      f.id,
      String(f.hari),
      f.kampus,
      f.guru,
      f.kelas,
      f.mapel,
      f.lab,
      f.jamKe,
    ]),
  ];

  const plotRows = [
    ['ID', 'Kampus', 'Lokasi', 'No_PC', 'Nama Siswa', 'Kelas'],
    ...params.plotings.map((p) => [
      p.id,
      p.kampus,
      p.lokasi,
      String(p.noPc),
      p.namaSiswa,
      p.kelas,
    ]),
  ];

  const mBy = (kat: string) =>
    params.masters.filter((m) => m.kategori === kat).map((m) => [m.id, m.nilai]);

  const sheets: Array<{ name: string; rows: string[][] }> = [
    { name: 'Data_Pinjam', rows: [bookingHeader, ...putraBookings] },
    { name: 'Data_Pinjam_Putri', rows: [bookingHeader, ...putriBookings] },
    { name: 'Jadwal_Tetap', rows: fixedRows },
    { name: 'Data_Ploting', rows: plotRows },
    { name: 'Master_Guru', rows: [['ID', 'Nilai'], ...mBy('GURU')] },
    { name: 'Master_Kelas', rows: [['ID', 'Nilai'], ...mBy('KELAS')] },
    { name: 'Master_Mapel', rows: [['ID', 'Nilai'], ...mBy('MAPEL')] },
    {
      name: 'Master_Ruang',
      rows: [
        ['ID', 'Kategori', 'Nilai'],
        ...params.masters
          .filter((m) => m.kategori === 'LAB' || m.kategori === 'RUANGAN')
          .map((m) => [m.id, m.kategori, m.nilai]),
      ],
    },
    {
      name: 'Master_Waktu',
      rows: [
        ['ID', 'Kategori', 'Nilai'],
        ...params.masters
          .filter((m) => m.kategori === 'JAM' || m.kategori === 'WAKTU_RUANG')
          .map((m) => [m.id, m.kategori, m.nilai]),
      ],
    },
  ];

  for (const sh of sheets) {
    const ws = buildSheetWithTextCellsClient(sh.rows);
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  }

  const filename = `SIM_Ruangan_Labkom_SMA_${getTodayDateStr()}.xlsx`;
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}

export function downloadLabkomMasterTemplateClient(params: {
  bookings: LabkomBooking[];
  fixedSchedules: LabkomFixedSchedule[];
  masters: LabkomMasterItem[];
}): { filename: string; totalItems: number; fromBookingsOnly: number } {
  const WAKTU_SET = new Set(['PAGI', 'SIANG', 'SORE', 'MALAM']);
  const classifyLoc = (loc: string): 'LAB' | 'RUANGAN' => {
    const u = loc.toUpperCase();
    return u.includes('LAB') || u.includes('BIOKIM') ? 'LAB' : 'RUANGAN';
  };
  const classifyJam = (jam: string): 'JAM' | 'WAKTU_RUANG' =>
    WAKTU_SET.has(jam.trim().toUpperCase()) ? 'WAKTU_RUANG' : 'JAM';

  type MasterAggRow = {
    id: string;
    kategori: LabkomMasterKategori;
    nilai: string;
    dipakaiCount: number;
    fromBookingOnly: boolean;
  };

  const map = new Map<string, MasterAggRow>();
  const upsert = (
    kategori: LabkomMasterKategori,
    rawVal: string,
    existingId?: string,
    incrementUsage = false,
  ) => {
    const clean = String(rawVal || '').trim();
    if (!clean || clean === '-' || clean.toUpperCase() === 'TANPA KELAS') return;
    const normVal =
      kategori === 'LAB' ||
      kategori === 'RUANGAN' ||
      kategori === 'JAM' ||
      kategori === 'WAKTU_RUANG'
        ? clean.toUpperCase()
        : clean;
    const key = `${kategori}|${normVal.toUpperCase()}`;
    const existing = map.get(key);
    if (existing) {
      if (existingId && existing.fromBookingOnly) {
        existing.id = existingId;
        existing.fromBookingOnly = false;
      }
      if (incrementUsage) existing.dipakaiCount++;
    } else {
      map.set(key, {
        id: existingId || 'BARU_DARI_PINJAM',
        kategori,
        nilai: normVal,
        dipakaiCount: incrementUsage ? 1 : 0,
        fromBookingOnly: !existingId,
      });
    }
  };

  for (const m of params.masters) {
    upsert(m.kategori, m.nilai, m.id, false);
  }
  for (const b of params.bookings) {
    if (b.guru) upsert('GURU', b.guru, undefined, true);
    if (b.kelas) upsert('KELAS', b.kelas, undefined, true);
    if (b.mapel) upsert('MAPEL', b.mapel, undefined, true);
    if (b.lab) upsert(classifyLoc(b.lab), b.lab, undefined, true);
    if (b.jamKe) upsert(classifyJam(b.jamKe), b.jamKe, undefined, true);
  }
  for (const f of params.fixedSchedules) {
    if (f.guru) upsert('GURU', f.guru, undefined, true);
    if (f.kelas) upsert('KELAS', f.kelas, undefined, true);
    if (f.mapel) upsert('MAPEL', f.mapel, undefined, true);
    if (f.lab) upsert(classifyLoc(f.lab), f.lab, undefined, true);
    if (f.jamKe) upsert(classifyJam(f.jamKe), f.jamKe, undefined, true);
  }

  const allRows = Array.from(map.values()).sort(
    (a, b) =>
      a.kategori.localeCompare(b.kategori) ||
      a.nilai.localeCompare(b.nilai, 'id', { numeric: true }),
  );
  const fromBookingsOnly = allRows.filter((r) => r.fromBookingOnly).length;

  const byCat = (kat: LabkomMasterKategori) => allRows.filter((r) => r.kategori === kat);
  const countKat = (kat: LabkomMasterKategori) => String(byCat(kat).length);

  const bookingHeader = [
    'ID',
    'Timestamp',
    'Kampus',
    'Email',
    'Nama Peminjam',
    'Guru',
    'Kelas',
    'Mapel',
    'Lab',
    'Tanggal',
    'Jam_Ke',
    'Keterangan',
    'Status',
  ];
  const sortNewest = (arr: LabkomBooking[]) =>
    [...arr].sort(
      (a, b) => b.tanggal.localeCompare(a.tanggal) || b.timestamp.localeCompare(a.timestamp),
    );
  const toBookingRow = (b: LabkomBooking): string[] => [
    b.id,
    b.timestamp,
    b.kampus,
    b.email,
    b.namaPeminjam,
    b.guru,
    b.kelas,
    b.mapel,
    b.lab,
    b.tanggal,
    b.jamKe,
    b.keterangan,
    b.status,
  ];
  const putraBookingRows = sortNewest(
    params.bookings.filter((b) => b.kampus === 'PUTRA'),
  ).map(toBookingRow);
  const putriBookingRows = sortNewest(
    params.bookings.filter((b) => b.kampus === 'PUTRI'),
  ).map(toBookingRow);

  const wb = XLSX.utils.book_new();
  const sheets: Array<{ name: string; rows: string[][] }> = [
    {
      name: '0_Panduan',
      rows: [
        ['PANDUAN TEMPLATE MASTER DATA PEMINJAMAN LABKOM & RUANGAN SMA'],
        ['Tanggal Unduh', getTodayDateStr()],
        ['Total Data Peminjaman Saat Ini', String(params.bookings.length)],
        ['Total Jadwal Tetap Saat Ini', String(params.fixedSchedules.length)],
        ['Total Item Master Unik', String(allRows.length)],
        ['Item Baru Terdeteksi dari Peminjaman', String(fromBookingsOnly)],
        [''],
        ['CARA PENGGUNAAN'],
        [
          '1. Template ini sudah terisi otomatis dari data peminjaman & jadwal tetap yang sekarang ada di sistem.',
        ],
        [
          '2. Untuk MENYESUAIKAN NAMA yang salah ketik/tidak seragam (misal guru/kelas/mapel/ruang): isi kolom "Ubah_Menjadi" ATAU ubah langsung kolom "Nilai_Sekarang" tanpa menghapus kolom ID.',
        ],
        [
          '3. Saat template diunggah kembali dengan opsi "Ikut sesuaikan data peminjaman", seluruh riwayat peminjaman & jadwal tetap yang memakai nama lama otomatis ikut diperbarui.',
        ],
        ['4. Untuk menambah item baru: tambah baris di bawahnya (biarkan kolom ID kosong).'],
        [''],
        ['RINGKASAN PER KATEGORI', 'Jumlah Item'],
        ['GURU', countKat('GURU')],
        ['KELAS', countKat('KELAS')],
        ['MAPEL', countKat('MAPEL')],
        ['LAB', countKat('LAB')],
        ['RUANGAN', countKat('RUANGAN')],
        ['JAM', countKat('JAM')],
        ['WAKTU_RUANG', countKat('WAKTU_RUANG')],
      ],
    },
    {
      name: 'Master_Data',
      rows: [
        ['ID', 'Kategori', 'Nilai_Sekarang', 'Ubah_Menjadi', 'Dipakai_Di_Peminjaman'],
        ...allRows.map((r) => [r.id, r.kategori, r.nilai, '', String(r.dipakaiCount)]),
      ],
    },
    {
      name: 'Master_Guru',
      rows: [
        ['ID', 'Nilai_Sekarang', 'Ubah_Menjadi', 'Dipakai_Di_Peminjaman'],
        ...byCat('GURU').map((r) => [r.id, r.nilai, '', String(r.dipakaiCount)]),
      ],
    },
    {
      name: 'Master_Kelas',
      rows: [
        ['ID', 'Nilai_Sekarang', 'Ubah_Menjadi', 'Dipakai_Di_Peminjaman'],
        ...byCat('KELAS').map((r) => [r.id, r.nilai, '', String(r.dipakaiCount)]),
      ],
    },
    {
      name: 'Master_Mapel',
      rows: [
        ['ID', 'Nilai_Sekarang', 'Ubah_Menjadi', 'Dipakai_Di_Peminjaman'],
        ...byCat('MAPEL').map((r) => [r.id, r.nilai, '', String(r.dipakaiCount)]),
      ],
    },
    {
      name: 'Master_Ruang',
      rows: [
        ['ID', 'Kategori', 'Nilai_Sekarang', 'Ubah_Menjadi', 'Dipakai_Di_Peminjaman'],
        ...[...byCat('LAB'), ...byCat('RUANGAN')].map((r) => [
          r.id,
          r.kategori,
          r.nilai,
          '',
          String(r.dipakaiCount),
        ]),
      ],
    },
    {
      name: 'Master_Waktu',
      rows: [
        ['ID', 'Kategori', 'Nilai_Sekarang', 'Ubah_Menjadi', 'Dipakai_Di_Peminjaman'],
        ...[...byCat('JAM'), ...byCat('WAKTU_RUANG')].map((r) => [
          r.id,
          r.kategori,
          r.nilai,
          '',
          String(r.dipakaiCount),
        ]),
      ],
    },
    {
      name: 'Data_Pinjam_Putra',
      rows: [bookingHeader, ...putraBookingRows],
    },
    {
      name: 'Data_Pinjam_Putri',
      rows: [bookingHeader, ...putriBookingRows],
    },
  ];

  for (const sh of sheets) {
    const ws = buildSheetWithTextCellsClient(sh.rows);
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  }

  const filename = `Template_Master_Data_Labkom_${getTodayDateStr()}.xlsx`;
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { filename, totalItems: allRows.length, fromBookingsOnly };
}

export function downloadLabkomLogTemplateClient(params: {
  bookings: LabkomBooking[];
  masters: LabkomMasterItem[];
}): { filename: string; putraCount: number; putriCount: number } {
  const today = getTodayDateStr();
  const tsNow = `${today} 08:00:00`;
  const bookingHeader = [
    'ID',
    'Timestamp',
    'Kampus',
    'Email',
    'Nama Peminjam',
    'Guru',
    'Kelas',
    'Mapel',
    'Lab',
    'Tanggal',
    'Jam_Ke',
    'Keterangan',
    'Status',
  ];

  const sortNewest = (arr: LabkomBooking[]) =>
    [...arr].sort(
      (a, b) => b.tanggal.localeCompare(a.tanggal) || b.timestamp.localeCompare(a.timestamp),
    );

  const toBookingRow = (b: LabkomBooking): string[] => [
    b.id,
    b.timestamp,
    b.kampus,
    b.email,
    b.namaPeminjam,
    b.guru,
    b.kelas,
    b.mapel,
    b.lab,
    b.tanggal,
    b.jamKe,
    b.keterangan,
    b.status,
  ];

  const existingPutra = sortNewest(params.bookings.filter((b) => b.kampus === 'PUTRA'));
  const existingPutri = sortNewest(params.bookings.filter((b) => b.kampus === 'PUTRI'));

  const firstLab =
    params.masters.find((m) => m.kategori === 'LAB')?.nilai || 'LABKOM A';
  const secondLab =
    params.masters.find((m) => m.kategori === 'LAB' && m.nilai !== firstLab)?.nilai || 'LABKOM B';
  const firstGuru =
    params.masters.find((m) => m.kategori === 'GURU')?.nilai || 'Ustadz Ahmad';
  const firstMapel =
    params.masters.find((m) => m.kategori === 'MAPEL')?.nilai || 'INFORMATIKA';

  const putraRows: string[][] =
    existingPutra.length > 0
      ? existingPutra.map(toBookingRow)
      : [
          [
            '',
            tsNow,
            'PUTRA',
            'guru.putra@assyifa.sch.id',
            firstGuru,
            firstGuru,
            'X-A',
            firstMapel,
            firstLab,
            today,
            '1',
            'Contoh Log Peminjaman Kampus Putra',
            'Disetujui',
          ],
          [
            '',
            tsNow,
            'PUTRA',
            'guru.putra@assyifa.sch.id',
            firstGuru,
            firstGuru,
            'X-A',
            firstMapel,
            firstLab,
            today,
            '2',
            'Contoh Log Peminjaman Kampus Putra',
            'Disetujui',
          ],
        ];

  const putriRows: string[][] =
    existingPutri.length > 0
      ? existingPutri.map(toBookingRow)
      : [
          [
            '',
            tsNow,
            'PUTRI',
            'guru.putri@assyifa.sch.id',
            'Ustadzah Aisyah',
            'Ustadzah Aisyah',
            'X-PUTRI-1',
            firstMapel,
            secondLab,
            today,
            '3',
            'Contoh Log Peminjaman Kampus Putri',
            'Disetujui',
          ],
          [
            '',
            tsNow,
            'PUTRI',
            'guru.putri@assyifa.sch.id',
            'Ustadzah Aisyah',
            'Ustadzah Aisyah',
            'X-PUTRI-1',
            firstMapel,
            secondLab,
            today,
            '4',
            'Contoh Log Peminjaman Kampus Putri',
            'Disetujui',
          ],
        ];

  const refRows: string[][] = [
    ['Kategori', 'Nilai_Referensi'],
    ...[...params.masters]
      .sort(
        (a, b) =>
          a.kategori.localeCompare(b.kategori) ||
          a.nilai.localeCompare(b.nilai, 'id', { numeric: true }),
      )
      .map((m) => [m.kategori, m.nilai]),
  ];

  const wb = XLSX.utils.book_new();
  const sheets: Array<{ name: string; rows: string[][] }> = [
    { name: 'Data_Pinjam', rows: [bookingHeader, ...putraRows] },
    { name: 'Data_Pinjam_Putri', rows: [bookingHeader, ...putriRows] },
    { name: 'Referensi_Master', rows: refRows },
    {
      name: '0_Panduan',
      rows: [
        ['TEMPLATE LOG PEMINJAMAN LABKOM & RUANGAN SMA (PUTRA & PUTRI)'],
        ['Tanggal Unduh', today],
        ['Log Putra Saat Ini', String(existingPutra.length)],
        ['Log Putri Saat Ini', String(existingPutri.length)],
        [''],
        ['PETUNJUK PENGISIAN & UPLOAD'],
        ['1. Sheet "Data_Pinjam" digunakan untuk log peminjaman Kampus PUTRA.'],
        ['2. Sheet "Data_Pinjam_Putri" digunakan untuk log peminjaman Kampus PUTRI.'],
        ['3. PENTING: Unggah langsung file .xlsx ini tanpa mengubahnya ke .csv agar kedua sheet (Putra & Putri) terbaca sekaligus. Jika menyimpan sebagai .csv, hanya sheet aktif yang tersimpan.'],
        ['4. Untuk menambah baris baru, biarkan kolom ID kosong (sistem membuat ID otomatis).'],
        ['5. Untuk mengedit baris yang sudah ada via upload, pertahankan nilai kolom ID lalu pilih mode "Update & Tambah (Upsert)" saat upload.'],
        ['6. Format kolom Tanggal yang didukung: YYYY-MM-DD (misal 2026-11-18) atau DD/MM/YYYY.'],
        ['7. Nilai kolom Kampus harus PUTRA atau PUTRI. Jam_Ke dapat diisi angka jam (1..10) atau sesi ruang (PAGI/SIANG/SORE/MALAM).'],
        ['8. Gunakan sheet "Referensi_Master" untuk menyalin nama Guru, Kelas, Mapel, dan Lab/Ruangan yang seragam.'],
      ],
    },
  ];

  for (const sh of sheets) {
    const ws = buildSheetWithTextCellsClient(sh.rows);
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  }

  const filename = `Template_Log_Peminjaman_Labkom_Putra_Putri_${today}.xlsx`;
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return {
    filename,
    putraCount: existingPutra.length,
    putriCount: existingPutri.length,
  };
}

// ==============================================================
// 6. KARTU AKSES LOGIN PEGAWAI (PDF) & LAPORAN EKSEKUTIF PIMPINAN (PDF)
// ==============================================================

export function generateClientTeacherToken(nama: string): string {
  const clean = String(nama || '')
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ');
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let code = (Math.abs(hash) % 8900) + 1000;
  if (code === 1234) code = 2468;
  return `PN-${code}`;
}

export function resolveTeacherToken(teacher: Pick<TeacherPublic, 'nama' | 'pin' | 'peran'>): string {
  if (teacher.peran === 'Admin Super') {
    return teacher.pin || '121320';
  }
  if (teacher.pin && teacher.pin.trim() && teacher.pin.trim() !== '1234') {
    return teacher.pin.trim();
  }
  return generateClientTeacherToken(teacher.nama);
}

/**
 * Download Kartu Akses Login Pegawai / Guru dalam bentuk PDF (Grid 2x4 Kartu Siap Cetak per Halaman A4)
 */
export function downloadLoginAccessCardsPdf(
  teachersOrParams:
    | TeacherPublic[]
    | {
        teachers: TeacherPublic[];
        wilayahLabel?: string;
        singleTeacher?: boolean;
      },
  wilayahOrOptions?: string | { title?: string; subtitle?: string },
) {
  const resolvedLabel =
    typeof wilayahOrOptions === 'string'
      ? wilayahOrOptions
      : wilayahOrOptions?.subtitle || wilayahOrOptions?.title;
  const params = Array.isArray(teachersOrParams)
    ? {
        teachers: teachersOrParams,
        wilayahLabel: resolvedLabel,
        singleTeacher: teachersOrParams.length === 1,
      }
    : teachersOrParams;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const list = params.teachers;
  if (list.length === 0) return '';

  const pageWidth = doc.internal.pageSize.getWidth();
  const cardsPerPage = 8; // 2 columns x 4 rows
  const cardW = 88;
  const cardH = 56;
  const marginX = 13;
  const gapX = 8;
  const startYFirst = 32;
  const gapY = 6;

  list.forEach((t, idx) => {
    const slotInPage = idx % cardsPerPage;
    if (idx > 0 && slotInPage === 0) {
      doc.addPage();
    }

    if (slotInPage === 0) {
      // Draw Page Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        'KARTU AKSES LOGIN PEGAWAI & GURU — SIM PINTAR BOARDING SCHOOL',
        pageWidth / 2,
        12,
        { align: 'center' },
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Database Pegawai Terpadu (${params.wilayahLabel || 'Semua Wilayah'}) · Dicetak: ${formatTanggalIndo(getTodayDateStr())} · Gunting mengikuti garis kartu`,
        pageWidth / 2,
        17,
        { align: 'center' },
      );
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.4);
      doc.line(13, 20, pageWidth - 13, 20);
    }

    const col = slotInPage % 2;
    const row = Math.floor(slotInPage / 2);
    const x = marginX + col * (cardW + gapX);
    const y = startYFirst + row * (cardH + gapY);

    const token = resolveTeacherToken(t);
    const allRoles = Array.from(new Set([t.peran, ...(t.peranTambahan || [])]));
    const rolesText = allRoles.join(' · ');

    // Card outer border
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'S');

    // Card dark top banner
    doc.setFillColor(11, 19, 36);
    doc.roundedRect(x, y, cardW, 12, 2.5, 2.5, 'F');
    doc.rect(x, y + 8, cardW, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(94, 234, 212);
    doc.text('SIM PINTAR · KARTU AKSES LOGIN', x + 3.5, y + 5.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(226, 232, 240);
    doc.text(`Wilayah: ${t.genderScope || 'Semua'}`, x + 3.5, y + 9.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(`#${idx + 1}`, x + cardW - 3.5, y + 7.5, { align: 'right' });

    // Teacher Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    const truncName = t.nama.length > 32 ? `${t.nama.slice(0, 30)}...` : t.nama;
    doc.text(truncName, x + 3.5, y + 18);

    // Roles / Hak Akses Fitur
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 118, 110);
    const truncRoles = rolesText.length > 48 ? `${rolesText.slice(0, 46)}...` : rolesText;
    doc.text(`Hak Akses: ${truncRoles}`, x + 3.5, y + 22.8);

    // Assignment Details (Wali Kelas / Kamar)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    const details: string[] = [];
    if (t.waliKelasOf) details.push(`Kelas: ${t.waliKelasOf}`);
    if (t.kamarBinaan && t.kamarBinaan.length > 0) details.push(`Kamar: ${t.kamarBinaan.join(', ')}`);
    if (t.kelompokQuranBinaan && t.kelompokQuranBinaan.length > 0) {
      details.push(`Halaqah: ${t.kelompokQuranBinaan.join(', ')}`);
    }
    const detailLine = details.length > 0 ? details.join(' | ') : 'Akses Fitur Sesuai Peran di Database Pegawai';
    const truncDetail = detailLine.length > 52 ? `${detailLine.slice(0, 50)}...` : detailLine;
    doc.text(truncDetail, x + 3.5, y + 27);

    // Credentials Box (Username + Token/PIN)
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 3.5, y + 30, cardW - 7, 17, 1.8, 1.8, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('USERNAME / NAMA LOGIN', x + 6, y + 34.5);
    doc.text('TOKEN / PIN MASUK', x + cardW - 6, y + 34.5, { align: 'right' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    const uName = (t.username || t.nama).slice(0, 22);
    doc.text(uName, x + 6, y + 40.5);

    // Highlighted Token Badge
    doc.setFillColor(15, 118, 110);
    doc.roundedRect(x + cardW - 31, y + 36.2, 26, 8.2, 1.5, 1.5, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(token, x + cardW - 18, y + 41.7, { align: 'center' });

    // Footer instruction on card
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Masuk di menu Login Guru / Dasbor Peran menggunakan Nama/Username & Token PIN di atas.',
      x + 3.5,
      y + 52.5,
    );
  });

  const slug = params.singleTeacher && list.length === 1
    ? list[0].nama.replace(/[^A-Za-z0-9]+/g, '_')
    : (params.wilayahLabel || 'Semua_Pegawai').replace(/[^A-Za-z0-9]+/g, '_');
  const filename = `Kartu_Akses_Login_SIM_PINTAR_${slug}_${getTodayDateStr()}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Download Tabel Rekapitulasi Akun & Token Login Pegawai untuk Arsip Admin (PDF)
 */
export function downloadPegawaiTokenTablePdf(
  teachersOrParams:
    | TeacherPublic[]
    | {
        teachers: TeacherPublic[];
        wilayahLabel?: string;
      },
  wilayahLabelArg?: string,
) {
  const params = Array.isArray(teachersOrParams)
    ? { teachers: teachersOrParams, wilayahLabel: wilayahLabelArg }
    : teachersOrParams;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const y = drawSchoolHeader(
    doc,
    'DAFTAR MASTER DATABASE PEGAWAI, HAK AKSES PERAN & TOKEN LOGIN',
    `Wilayah: ${params.wilayahLabel || 'Semua Wilayah (Putra & Putri)'} · Total Pegawai: ${params.teachers.length} Akun · Dicetak: ${formatTanggalIndo(getTodayDateStr())}`,
  );

  autoTable(doc, {
    startY: y,
    head: [
      [
        'No',
        'Nama Lengkap Pegawai / Guru',
        'Wilayah',
        'Peran Utama',
        'Peran Tambahan (Hak Fitur)',
        'Kelas / Kamar Binaan',
        'Username Login',
        'Token / PIN Akses',
      ],
    ],
    body: params.teachers.map((t, idx) => {
      const token = resolveTeacherToken(t);
      const extras = (t.peranTambahan || []).filter((r) => r !== t.peran).join(', ') || '-';
      const binaan = [
        t.waliKelasOf ? `Kelas: ${t.waliKelasOf}` : '',
        t.kamarBinaan && t.kamarBinaan.length > 0 ? `Kamar: ${t.kamarBinaan.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' | ') || '-';
      return [
        String(idx + 1),
        t.nama,
        t.genderScope || 'Semua',
        t.peran,
        extras,
        binaan,
        t.username,
        token,
      ];
    }),
    theme: 'grid',
    styles: { fontSize: 7.8, cellPadding: 2, textColor: [15, 23, 42], valign: 'middle' },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 52 },
      2: { halign: 'center', cellWidth: 18 },
      3: { fontStyle: 'bold', cellWidth: 28 },
      4: { cellWidth: 44 },
      5: { cellWidth: 52 },
      6: { font: 'courier', cellWidth: 36 },
      7: { font: 'courier', fontStyle: 'bold', halign: 'center', cellWidth: 28, fillColor: [240, 253, 250] },
    },
  });

  const finalY = getFinalY(doc, y + 30);
  drawSignatureBlock(
    doc,
    finalY,
    'Mengetahui, Pimpinan / Kepala Sekolah',
    '( ........................................ )',
    'Admin Super SIM PINTAR',
    'SAHIDIN (ADMIN SUPER)',
  );

  const filename = `Daftar_Token_Login_Pegawai_${(params.wilayahLabel || 'Semua').replace(/[^A-Za-z0-9]+/g, '_')}_${getTodayDateStr()}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Download Laporan Lengkap Eksekutif Pimpinan (Semua Komponen Sekolah dalam 1 File PDF)
 */
export function downloadPimpinanMasterPdf(report: PimpinanExecutiveReport, pimpinanName?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageHeight = doc.internal.pageSize.getHeight();
  const wilayahLabel =
    report.wilayah === 'Semua' ? 'Semua Wilayah (Putra & Putri)' : `Wilayah ${report.wilayah}`;

  let y = drawSchoolHeader(
    doc,
    'LAPORAN EKSEKUTIF PIMPINAN: REKAPITULASI TERPADU SELURUH KOMPONEN SEKOLAH',
    `${wilayahLabel} · Tanggal Cetak: ${formatTanggalIndo(getTodayDateStr())} · Dicetak oleh: ${pimpinanName || 'Pimpinan Sekolah'}`,
  );

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }
  };

  // Ringkasan Eksekutif
  const sc = report.summaryCounts;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('RINGKASAN EKSEKUTIF INVENTARIS & AKTIVITAS SISTEM', 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        'Total Santri (Pa / Pi)',
        'Database Pegawai',
        'Kamar Asrama',
        'Jadwal Aktif',
        'Log Presensi',
        'Catatan Pembinaan',
        'Peminjaman Labkom',
        'Log Ujian & Piket',
      ],
    ],
    body: [
      [
        `${sc.totalStudents} (${sc.studentsPutra} Pa / ${sc.studentsPutri} Pi)`,
        `${sc.totalTeachers} Pegawai`,
        `${sc.totalRooms} Kamar`,
        `${sc.totalSchedules} Jadwal`,
        `${sc.totalAttendanceLogs} Log`,
        `${sc.totalPembinaanRecords} Catatan`,
        `${sc.totalLabkomBookings} Peminjaman`,
        `${sc.totalExamLogs} Ujian / ${sc.totalTeacherAbsences} Piket`,
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.8, cellPadding: 2, halign: 'center', fontStyle: 'bold' },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 18) + 6;

  // 1. Komponen Presensi Asrama
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`1. LAPORAN KOMPONEN PRESENSI ASRAMA (${report.asramaReport.length} KAMAR)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Kamar Asrama', 'Wilayah', 'Wali Asrama / Musyrif', 'Santri', 'Hadir', 'Telat', 'Sakit', 'Izin', 'Alfa', '% Hadir']],
    body:
      report.asramaReport.length > 0
        ? report.asramaReport.map((r, i) => [
            String(i + 1),
            r.kamar,
            r.gender,
            r.musyrif,
            String(r.totalSantri),
            String(r.H),
            String(r.T),
            String(r.S),
            String(r.I),
            String(r.A),
            `${r.persenHadir}%`,
          ])
        : [['-', 'Belum ada data kamar asrama', '-', '-', '0', '0', '0', '0', '0', '0', '0%']],
    theme: 'grid',
    styles: { fontSize: 7.4, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 6;

  // 2. Komponen Presensi Akademik & Laju Materi Guru
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`2. LAPORAN KOMPONEN AKADEMIK & LAJU MATERI GURU (${report.akademikPacingReport.length} KELAS/MAPEL)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Guru Pengampu', 'Wilayah', 'Kelas', 'Mata Pelajaran', 'Pertemuan', '% Laju Materi', 'Status Laju', '% Kehadiran', 'Materi Terakhir']],
    body:
      report.akademikPacingReport.length > 0
        ? report.akademikPacingReport.map((r, i) => [
            String(i + 1),
            r.guru,
            r.gender,
            r.kelas,
            r.mapel,
            `${r.pertemuanTerlaksana}/${r.targetPertemuan}`,
            `${r.lajuPersen}%`,
            r.statusLaju,
            `${r.avgKehadiranPct}%`,
            r.materiTerakhir,
          ])
        : [['-', 'Belum ada data pembelajaran akademik', '-', '-', '-', '0/16', '0%', '-', '0%', '-']],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.6 },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 6;

  // 3. Komponen Presensi & Halaqah Al-Qur'an
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`3. LAPORAN KOMPONEN HALAQAH AL-QUR'AN (${report.quranReport.length} KELOMPOK)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Kelompok Halaqah', 'Wilayah', 'Pengampu Al-Qur\'an', 'Jml Santri', 'Total Log', '% Kehadiran', 'Jml Setoran', 'Setoran / Tilawah Terakhir']],
    body:
      report.quranReport.length > 0
        ? report.quranReport.map((r, i) => [
            String(i + 1),
            r.kelompok,
            r.gender,
            r.pengampu,
            String(r.totalSantri),
            String(r.totalLog),
            `${r.persenHadir}%`,
            String(r.totalSetoranRecorded),
            r.catatanTerakhir,
          ])
        : [['-', 'Belum ada data kelompok Al-Qur\'an', '-', '-', '0', '0', '0%', '0', '-']],
    theme: 'grid',
    styles: { fontSize: 7.4, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 6;

  // 4. Komponen Pembinaan Wali Kelas
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`4. LAPORAN KOMPONEN PEMBINAAN WALI KELAS PER KELAS (${report.waliKelasReport.length} KELAS)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Kelas', 'Wilayah', 'Wali Kelas', 'Santri', 'Akademik %', 'Asrama %', 'Al-Qur\'an %', 'Klasikal / Khusus', 'Wajib %', 'Net Poin', 'Kasus Aktif']],
    body:
      report.waliKelasReport.length > 0
        ? report.waliKelasReport.map((r, i) => [
            String(i + 1),
            r.kelas,
            r.gender,
            r.waliKelas,
            String(r.totalSantri),
            `${r.persenHadirAkademik}%`,
            `${r.persenHadirAsrama}%`,
            `${r.persenHadirQuran}%`,
            `${r.klasikalCount}x / ${r.khususCount}x`,
            `${r.wajibPct}%`,
            r.netPoin > 0 ? `+${r.netPoin}` : String(r.netPoin),
            String(r.kasusAktif),
          ])
        : [['-', 'Belum ada data kelas', '-', '-', '0', '0%', '0%', '0%', '0x / 0x', '0%', '0', '0']],
    theme: 'grid',
    styles: { fontSize: 7.4, cellPadding: 1.6 },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 6;

  // 5. Komponen Pembinaan Guru Wali
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`5. LAPORAN KOMPONEN PEMBINAAN GURU WALI (${report.guruWaliReport.length} GURU WALI)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Nama Guru Wali', 'Wilayah', 'Jml Siswa Binaan', 'Asrama %', 'Akademik %', 'Al-Qur\'an %', 'Momen Klasikal', 'Pembinaan Khusus', 'Kasus Aktif']],
    body:
      report.guruWaliReport.length > 0
        ? report.guruWaliReport.map((r, i) => [
            String(i + 1),
            r.guruWali,
            r.genderScope,
            `${r.totalSantriBinaan} Siswa`,
            `${r.avgHadirAsrama}%`,
            `${r.avgHadirAkademik}%`,
            `${r.avgHadirQuran}%`,
            `${r.klasikalCount}x`,
            `${r.khususCount}x`,
            String(r.kasusAktif),
          ])
        : [['-', 'Belum ada data Guru Wali', '-', '0', '0%', '0%', '0%', '0x', '0x', '0']],
    theme: 'grid',
    styles: { fontSize: 7.4, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 6;

  // 6. Komponen Pembinaan Wali Asrama / Room Visit
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`6. LAPORAN KOMPONEN PEMBINAAN WALI ASRAMA & ROOM VISIT (${report.waliAsramaPembinaanReport.length} KAMAR)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Kamar Asrama', 'Wilayah', 'Wali Asrama', 'Jml Santri', '% Hadir Asrama', 'Momen Klasikal', 'Room Visit Khusus', 'Sholat Wajib %', 'Net Poin']],
    body:
      report.waliAsramaPembinaanReport.length > 0
        ? report.waliAsramaPembinaanReport.map((r, i) => [
            String(i + 1),
            r.kamar,
            r.gender,
            r.waliAsrama,
            String(r.totalSantri),
            `${r.persenHadirAsrama}%`,
            `${r.klasikalCount}x`,
            `${r.khususCount}x`,
            `${r.wajibPct}%`,
            r.netPoin > 0 ? `+${r.netPoin}` : String(r.netPoin),
          ])
        : [['-', 'Belum ada data pembinaan kamar', '-', '-', '0', '0%', '0x', '0x', '0%', '0']],
    theme: 'grid',
    styles: { fontSize: 7.4, cellPadding: 1.6 },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 6;

  // 7. Komponen Peminjaman Labkom
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`7. LAPORAN KOMPONEN PEMINJAMAN LABKOM & RUANGAN (${report.labkomReport.length} LOG)`, 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Tanggal', 'Kampus', 'Lab / Ruang', 'Jam Ke', 'Guru Pengampu', 'Kelas', 'Mata Pelajaran', 'Status']],
    body:
      report.labkomReport.length > 0
        ? report.labkomReport.slice(0, 60).map((b, i) => [
            String(i + 1),
            formatTanggalIndo(b.tanggal),
            b.kampus,
            b.lab,
            b.jamKe,
            b.guru,
            b.kelas,
            b.mapel,
            b.status,
          ])
        : [['-', '-', '-', 'Belum ada log peminjaman Labkom', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 6;

  // 8. Komponen Ujian & Piket Guru
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `8. LAPORAN KOMPONEN PRESENSI UJIAN (${report.ujianPiketReport.examSummary.length} SESI) & PIKET GURU (${report.ujianPiketReport.teacherAbsences.length} LOG)`,
    14,
    y,
  );
  autoTable(doc, {
    startY: y + 2,
    head: [['No', 'Tanggal', 'Jenis Ujian', 'Wilayah', 'Ruang', 'Kelas', 'Mapel', 'Pengawas', 'Hadir / Total']],
    body:
      report.ujianPiketReport.examSummary.length > 0
        ? report.ujianPiketReport.examSummary.slice(0, 40).map((ex, i) => [
            String(i + 1),
            formatTanggalIndo(ex.tanggal),
            ex.jenisUjian,
            ex.gender,
            ex.ruangan,
            ex.kelas,
            ex.mapel,
            ex.pengawas,
            `${ex.hadir}/${ex.totalSiswa} (Absen: ${ex.absen})`,
          ])
        : [['-', '-', '-', '-', '-', 'Belum ada berita acara ujian tercatat', '-', '-', '-']],
    theme: 'grid',
    styles: { fontSize: 7.2, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
  });
  y = getFinalY(doc, y + 25) + 4;

  drawSignatureBlock(
    doc,
    y,
    'Mengetahui, Pimpinan / Kepala Sekolah',
    pimpinanName || '( ........................................ )',
    'Koordinator Pusat Data SIM PINTAR',
    '( ........................................ )',
  );

  const filename = `Laporan_Eksekutif_Pimpinan_Semua_Komponen_${report.wilayah}_${getTodayDateStr()}.pdf`;
  doc.save(filename);
  return filename;
}


