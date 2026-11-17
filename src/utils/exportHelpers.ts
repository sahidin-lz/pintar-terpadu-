import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AnalyticsTerpadu,
  MonthlyWaliKelasReport,
  WilayahFilter,
} from '../types';

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
 * 3. Direct PDF Export for any Tabular Report in Pusat Unduh (Tab 3)
 */
export function downloadTableReportPdf(params: {
  title: string;
  subtitle: string;
  metaRows?: Array<[string, string]>;
  headers: string[];
  rows: string[][];
  materiRows?: Array<{ no: number; tanggal: string; mapel: string; materi: string }>;
  filename: string;
  landscape?: boolean;
}) {
  const doc = new jsPDF({
    orientation: params.landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let y = drawSchoolHeader(doc, params.title, params.subtitle);

  if (params.metaRows && params.metaRows.length > 0) {
    autoTable(doc, {
      startY: y,
      body: params.metaRows,
      theme: 'plain',
      styles: { fontSize: 8.5, cellPadding: 1.2, textColor: [15, 23, 42] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
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

  drawSignatureBlock(
    doc,
    y,
    'Mengetahui, Kepala Sekolah',
    '( ........................................ )',
    'Petugas / Wali Kelas',
    '( ........................................ )',
  );

  doc.save(params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`);
}
