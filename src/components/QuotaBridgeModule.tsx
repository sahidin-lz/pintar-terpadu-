import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  Database,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  auth,
  firebaseConfig,
  googleProvider,
  onAuthStateChanged,
  pullSnapshotFromFirestore,
  pushSnapshotToFirestore,
  signInWithPopup,
  signOut,
  type CloudSyncSummary,
  type User,
} from '../firebase';
import type { QuotaMetrics } from '../types';

interface QuotaBridgeModuleProps {
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const OPTIMIZED_GAS_SNIPPET = `// POLA ANTI-HABIS KUOTA UNTUK GOOGLE APPS SCRIPT (Code.gs)
// 1. Gunakan CacheService 6 jam (21600 detik) untuk Master Data agar tidak membaca sheet berulang kali
function getMasterDataCached(sheetName) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(sheetName);
  if (cached) return JSON.parse(cached);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 4500) cache.put(sheetName, JSON.stringify(data), 21600);
  return data;
}

// 2. Gunakan LockService + 1x Batch setValues (JANGAN deleteRow satu per satu dalam loop)
function simpanBatchHematKuota(sheetName, rowsToAppend) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length)
           .setValues(rowsToAppend);
    }
    CacheService.getScriptCache().remove(sheetName);
  } finally {
    lock.releaseLock();
  }
}`;

export const QuotaBridgeModule: React.FC<QuotaBridgeModuleProps> = ({ notify }) => {
  const [metrics, setMetrics] = useState<QuotaMetrics | null>(null);
  const [gasUrl, setGasUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Firebase Auth & Cloud Sync state
  const [fbUser, setFbUser] = useState<User | null>(auth.currentUser);
  const [pushingCloud, setPushingCloud] = useState(false);
  const [pullingCloud, setPullingCloud] = useState(false);
  const [lastCloudSummary, setLastCloudSummary] = useState<CloudSyncSummary | null>(null);

  const loadMetrics = () => {
    fetch('/api/quota-metrics')
      .then((r) => r.json())
      .then((data: QuotaMetrics) => {
        setMetrics(data);
        setGasUrl(data.gasBridgeUrl || '');
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadMetrics();
    const unsub = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
    });
    return () => unsub();
  }, []);

  const handleFirebaseLogin = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      setFbUser(res.user);
      notify(`Terhubung ke Firebase (${firebaseConfig.projectId}) sebagai ${res.user.email}.`, 'success');
    } catch (err) {
      notify(`Gagal masuk Google Firebase: ${(err as Error).message}`, 'error');
    }
  };

  const handleFirebaseLogout = async () => {
    await signOut(auth);
    setFbUser(null);
    notify('Sesi Google Firebase diputus.', 'info');
  };

  const handlePushToFirebase = async () => {
    if (!fbUser) {
      notify('Silakan masuk dengan Google terlebih dahulu untuk sinkronisasi ke Firestore.', 'error');
      return;
    }
    setPushingCloud(true);
    try {
      const snapRes = await fetch('/api/firebase/snapshot');
      if (!snapRes.ok) throw new Error('Gagal mengambil snapshot lokal.');
      const snapshot = await snapRes.json();
      const summary = await pushSnapshotToFirestore(snapshot);
      setLastCloudSummary(summary);
      const markRes = await fetch('/api/firebase/mark-synced', { method: 'POST' });
      if (markRes.ok) {
        const nextMetrics = await markRes.json();
        setMetrics(nextMetrics);
      }
      notify(
        `Berhasil sinkron ke Firebase (${firebaseConfig.projectId}): ${summary.studentsSynced} santri, ${summary.staffSynced} pegawai, ${summary.schedulesSynced} jadwal.`,
        'success'
      );
    } catch (err) {
      notify(`Gagal sinkronisasi ke Firebase: ${(err as Error).message}`, 'error');
    } finally {
      setPushingCloud(false);
    }
  };

  const handlePullFromFirebase = async () => {
    if (!fbUser) {
      notify('Silakan masuk dengan Google terlebih dahulu untuk menarik data dari Firestore.', 'error');
      return;
    }
    setPullingCloud(true);
    try {
      const cloudData = await pullSnapshotFromFirestore();
      const totalPulled =
        cloudData.students.length + cloudData.teachers.length + cloudData.schedules.length;
      if (totalPulled === 0) {
        notify('Belum ada dokumen santri/pegawai/jadwal di Firestore untuk akun ini.', 'info');
        return;
      }
      const importRes = await fetch('/api/import/all-in-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          santriRows: cloudData.students,
          teacherRows: cloudData.teachers,
          scheduleRows: cloudData.schedules,
        }),
      });
      if (!importRes.ok) {
        const errData = await importRes.json();
        throw new Error(errData.error || 'Gagal menyimpan data dari Firebase ke server.');
      }
      loadMetrics();
      notify(
        `Berhasil menarik ${cloudData.students.length} santri, ${cloudData.teachers.length} pegawai, dan ${cloudData.schedules.length} jadwal dari Firebase.`,
        'success'
      );
    } catch (err) {
      notify(`Gagal menarik data dari Firebase: ${(err as Error).message}`, 'error');
    } finally {
      setPullingCloud(false);
    }
  };

  const handleSaveBridge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings/gas-bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasBridgeUrl: gasUrl }),
      });
      const data = await res.json();
      setMetrics(data);
      notify('Konfigurasi Bridge Google Apps Script disimpan.', 'success');
    } catch {
      notify('Gagal menyimpan URL bridge.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/settings/gas-sync-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasBridgeUrl: gasUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Gagal menyinkronkan ke GAS.', 'error');
      } else {
        setMetrics(data.metrics);
        notify(data.message || 'Sinkronisasi berhasil.', 'success');
      }
    } catch {
      notify('Gagal menghubungi endpoint sinkronisasi.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Quota Health */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Kuota Eksternal Terpakai Hari Ini</div>
          <div className="mt-2 font-mono-num text-3xl font-bold text-emerald-700">
            {metrics?.externalQuotaUsedToday ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Hemat kuota dengan batch &amp; cache</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">RAM Cache Hits</div>
          <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
            {metrics?.cacheHitCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Permintaan dilayani dari memori</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Operasi Batch Save</div>
          <div className="mt-2 font-mono-num text-3xl font-bold text-teal-700">
            {metrics?.batchedWritesCount ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">1 penulisan per kelas/sesi</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Total Rekaman Lokal</div>
          <div className="mt-2 font-mono-num text-3xl font-bold text-slate-900">
            {metrics?.totalRecordsStored ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Tersimpan persisten di server</div>
        </div>
      </div>

      {/* Active Firebase Project Card (sim-pintar) */}
      <div className="rounded-xl border border-teal-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <Cloud className="h-5 w-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Integrasi Firebase Cloud &amp; Firestore ({firebaseConfig.projectId})
                </h3>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  Terhubung · Analytics {firebaseConfig.measurementId}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Auth Domain: <span className="font-mono-num font-semibold">{firebaseConfig.authDomain}</span> · Storage:{' '}
                <span className="font-mono-num font-semibold">{firebaseConfig.storageBucket}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {fbUser ? (
              <>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {fbUser.email}
                </span>
                <button
                  type="button"
                  onClick={handleFirebaseLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Keluar Google
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleFirebaseLogin}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800"
              >
                <LogIn className="h-3.5 w-3.5" />
                Login Google (Firebase Auth)
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2">
          <button
            type="button"
            disabled={pushingCloud || !fbUser}
            onClick={handlePushToFirebase}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
          >
            <CloudUpload className="h-4 w-4 text-teal-300" />
            {pushingCloud
              ? 'Menyinkronkan ke Firestore...'
              : 'Sinkronkan Database ke Firebase (Batch Write)'}
          </button>

          <button
            type="button"
            disabled={pullingCloud || !fbUser}
            onClick={handlePullFromFirebase}
            className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
          >
            <CloudDownload className="h-4 w-4 text-teal-700" />
            {pullingCloud
              ? 'Menarik dari Firestore...'
              : 'Tarik Data dari Firebase ke Aplikasi'}
          </button>
        </div>

        {lastCloudSummary && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
            <span>
              Tersinkron ke Firestore (<b>{firebaseConfig.projectId}</b>):{' '}
              <b>{lastCloudSummary.studentsSynced}</b> santri,{' '}
              <b>{lastCloudSummary.staffSynced}</b> pegawai,{' '}
              <b>{lastCloudSummary.schedulesSynced}</b> jadwal,{' '}
              <b>{lastCloudSummary.attendanceSynced}</b> log presensi,{' '}
              <b>{lastCloudSummary.pembinaanSynced}</b> pembinaan.
            </span>
            <span className="font-mono-num text-[11px] font-semibold">
              {lastCloudSummary.syncedAt}
            </span>
          </div>
        )}
      </div>

      {/* Why quota never runs out */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Database className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Mengapa Sistem Ini Tidak Menghabiskan Kuota Gratis dalam Sehari
            </h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Pada arsitektur lama berbasis Google Apps Script langsung + 32 sheet mingguan, setiap guru membuka form atau dasbor monitoring memicu pembacaan ulang ribuan baris Google Sheets dan penulisan baris satu per satu. Aplikasi ini memutus bottleneck tersebut dengan 4 lapisan efisiensi:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2">
          {[
            {
              title: '1. Server-Side Store & RAM Cache (0 Read Quota)',
              desc: 'Master Siswa, Guru, Jadwal, dan Log Presensi dibaca dari memori server dalam <5ms tanpa memanggil Google Sheets atau Firestore per klik.',
            },
            {
              title: '2. Single-Batch Write ke Firestore & Kelas',
              desc: 'Menyimpan presensi 30 santri atau sinkronisasi ke Firebase Firestore dilakukan secara batch terkompresi, bukan request terpisah per klik.',
            },
            {
              title: '3. Sentralisasi DB_Klasikal_Tahunan',
              desc: 'Menghapus 32 sheet Pekan_01–32 menjadi 1 tabel log terpusat memangkas 90% beban kalkulasi ulang dan waktu muat.',
            },
            {
              title: '4. Tanpa Auto-Polling Latar Belakang',
              desc: 'Monitoring dan Statistik dimuat sesuai permintaan (on-demand) + tombol refresh manual, sehingga tidak membakar kuota saat tab dibiarkan terbuka.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                {item.title}
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Optional GAS Bridge */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Bridge Opsional ke Google Apps Script (Manual Batch Sync)
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Jika sekolah tetap ingin mencerminkan data ke Google Sheets lama, tempel URL Web App `Code.gs` di bawah ini dan lakukan sinkronisasi manual kapan pun dibutuhkan.
          </p>
        </div>

        <form onSubmit={handleSaveBridge} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={gasUrl}
            onChange={(e) => setGasUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-xs font-mono-num"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            {saving ? 'Menyimpan...' : 'Simpan URL Bridge'}
          </button>
          <button
            type="button"
            onClick={handleManualSync}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Uji Sinkronisasi
          </button>
        </form>

        {metrics?.lastSyncedAt && (
          <div className="text-xs text-emerald-700 font-medium">
            Terakhir tersinkronisasi: {metrics.lastSyncedAt}
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Snippet Optimasi Code.gs (CacheService 6 Jam + LockService)
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(OPTIMIZED_GAS_SNIPPET);
                notify('Snippet optimasi Code.gs disalin.', 'success');
              }}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-3 w-3" />
              Salin Kode
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3.5 text-[11px] font-mono-num text-emerald-300 leading-relaxed">
            {OPTIMIZED_GAS_SNIPPET}
          </pre>
        </div>
      </div>
    </div>
  );
};
