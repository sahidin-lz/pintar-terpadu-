import type { Request, Response } from 'express';
import { store } from '../store.ts';

/**
 * Helper: Mengurai rentang Jam Pelajaran (misal "1-2", "3,4", atau "5")
 * menjadi array angka slot JP [1, 2] serta batas jpStart & jpEnd.
 */
export function parseJpRangeToBounds(jamKe: string, maxJp = 9): {
  slots: number[];
  jpStart: number;
  jpEnd: number;
} {
  const clean = String(jamKe || '').trim();
  const parts = clean
    .split(/[-–,]/)
    .map((p) => Number.parseInt(p.replace(/[^\d]/g, ''), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= maxJp);

  if (parts.length === 0) {
    return { slots: [], jpStart: 0, jpEnd: 0 };
  }
  const jpStart = Math.min(...parts);
  const jpEnd = Math.max(...parts);
  const slots: number[] = [];
  for (let jp = jpStart; jp <= jpEnd; jp++) {
    slots.push(jp);
  }
  return { slots, jpStart, jpEnd };
}

/**
 * Express Controller: Validasi Bentrok Jadwal (Clash Detection)
 * Mencegah seorang guru dijadwalkan di dua kelas berbeda pada hari & rentang JP yang beririsan,
 * serta mencegah satu kelas diisi dua guru berbeda pada hari & JP yang sama.
 */
export const checkScheduleClashHandler = (req: Request, res: Response) => {
  const { excludeId, guru, hari, kelas, jamKe } = req.body || {};
  const clash = store.checkScheduleClash({
    excludeId: excludeId ? String(excludeId) : undefined,
    guru: String(guru || ''),
    hari: String(hari || ''),
    kelas: String(kelas || ''),
    jamKe: String(jamKe || ''),
  });
  return res.status(200).json(clash);
};

/**
 * Express Controller: Membuat Jadwal Baru dengan Proteksi Anti-Bentrok (Clash Detection)
 */
export const createScheduleWithClashGuard = (req: Request, res: Response) => {
  const { guru, hari, kelas, mapel, jamKe, gender, kategori, isPerubahan, catatanPerubahan, allowOverride } =
    req.body || {};

  if (!guru || !hari || !kelas || !mapel || !jamKe || !gender) {
    return res.status(400).json({
      error: 'Lengkapi Guru, Hari, Kelas/Halaqah, Mata Pelajaran, Jam Ke, dan Wilayah.',
    });
  }

  const clash = store.checkScheduleClash({
    guru: String(guru),
    hari: String(hari),
    kelas: String(kelas),
    jamKe: String(jamKe),
  });

  if (clash.hasClash && !allowOverride) {
    return res.status(409).json({
      error: clash.message || 'Jadwal bentrok dengan jadwal lain pada hari dan JP yang sama.',
      clash,
    });
  }

  const created = store.createSchedule({
    guru: String(guru),
    hari: String(hari),
    kelas: String(kelas),
    mapel: String(mapel),
    jamKe: String(jamKe),
    gender,
    kategori,
    isPerubahan: Boolean(isPerubahan),
    catatanPerubahan: catatanPerubahan ? String(catatanPerubahan) : undefined,
  });

  return res.status(201).json({
    schedule: created,
    clash,
    counts: store.getSystemCounts(),
  });
};

/**
 * Express Controller: Memperbarui Jadwal (Revisi Kelas / Tukar JP Pertengahan Semester)
 * lengkap dengan Clash Detection yang mengecualikan ID jadwal yang sedang diedit.
 */
export const updateScheduleWithClashGuard = (req: Request, res: Response) => {
  const scheduleId = String(req.params.id || '');
  const { guru, hari, kelas, jamKe, allowOverride } = req.body || {};

  if (guru && hari && kelas && jamKe) {
    const clash = store.checkScheduleClash({
      excludeId: scheduleId,
      guru: String(guru),
      hari: String(hari),
      kelas: String(kelas),
      jamKe: String(jamKe),
    });

    if (clash.hasClash && !allowOverride) {
      return res.status(409).json({
        error: clash.message || 'Perubahan jadwal menyebabkan bentrok.',
        clash,
      });
    }
  }

  const updated = store.updateSchedule(scheduleId, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
  }

  return res.status(200).json({ schedule: updated });
};
