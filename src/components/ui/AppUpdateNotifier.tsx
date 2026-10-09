'use client';

import React, { useState, useEffect } from 'react';
import { isAndroidApp, sendPushNotification } from '@/lib/notifications/pushNotification';

interface VersionInfo {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
}

export function AppUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('1.0.0');
  const [dismissed, setDismissed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Only check if inside Android APK or on mobile device
    const checkUpdate = async () => {
      try {
        const isAndroid = isAndroidApp();
        let localVersionCode = 1;
        let localVersionName = '1.0.0';

        if (isAndroid && typeof window !== 'undefined') {
          const bridge = (window as any).StockMindAndroid;
          if (bridge) {
            if (typeof bridge.getAppVersionCode === 'function') {
              localVersionCode = Number(bridge.getAppVersionCode()) || 1;
            }
            if (typeof bridge.getAppVersion === 'function') {
              localVersionName = bridge.getAppVersion() || '1.0.0';
            }
          }
        }
        setCurrentVersion(localVersionName);

        const res = await fetch('/api/app/version');
        if (!res.ok) return;
        const data = await res.json();

        if (data && data.versionCode) {
          setVersionInfo(data);

          // ONLY trigger update notification if this device is outdated!
          if (isAndroid && localVersionCode < data.versionCode) {
            // Check if dismissed recently for the visual banner
            const dismissedUntil = localStorage.getItem('stockmind_update_dismissed_until');
            if (!dismissedUntil || Number(dismissedUntil) <= Date.now()) {
              setUpdateAvailable(true);
            }

            // Send native push notification to status bar/lock screen once per new release
            const notifSentKey = `stockmind_update_push_sent_${data.versionCode}`;
            if (!localStorage.getItem(notifSentKey)) {
              localStorage.setItem(notifSentKey, 'true');
              sendPushNotification(
                `🚀 Yeni StockMind Güncellemesi Mevcut (v${data.version})`,
                'StockMind yeni sürümü hazır! Performans, logolar ve kapalıyken fiyat alarmları için hemen güncelleyin.',
                '/settings'
              );
            }
          } else {
            // Up to date! Never show update banner or notification
            setUpdateAvailable(false);
          }

          // Check for global broadcast message (e.g. test notification sent to all devices)
          if (data && data.broadcast && data.broadcast.id && data.broadcast.message) {
            const bcKey = `stockmind_broadcast_seen_${data.broadcast.id}`;
            if (!localStorage.getItem(bcKey)) {
              localStorage.setItem(bcKey, 'true');
              sendPushNotification(
                data.broadcast.title || 'StockMind 📢',
                data.broadcast.message,
                data.broadcast.route || '/dashboard'
              );
            }
          }
        }
      } catch (err) {
        console.warn('App version check failed:', err);
      }
    };

    checkUpdate();
  }, []);

  if (!updateAvailable || dismissed || !versionInfo) {
    return null;
  }

  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownloadUpdate = () => {
    setIsDownloading(true);

    const bridge = typeof window !== 'undefined' ? (window as any).StockMindAndroid : null;
    if (bridge && typeof bridge.downloadAndInstallUpdate === 'function') {
      try {
        bridge.downloadAndInstallUpdate(versionInfo?.downloadUrl || '/api/download/apk');
      } catch (err) {
        console.warn('Native download bridge error:', err);
      }
    } else {
      // Trigger browser location
      try {
        const link = document.createElement('a');
        link.href = versionInfo?.downloadUrl || '/api/download/apk';
        link.download = 'StockMind.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (_) {}
    }

    // Always display the update helper modal so user is never left without guidance
    setShowModal(true);

    setTimeout(() => {
      setIsDownloading(false);
    }, 2500);
  };

  const handleCopyDownloadUrl = () => {
    if (typeof window === 'undefined') return;
    const fullUrl = `${window.location.origin}/StockMind.apk`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for 24 hours
    localStorage.setItem('stockmind_update_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
  };

  return (
    <>
      <div className="relative mx-3 sm:mx-4 lg:mx-6 mb-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-accent/20 via-purple-600/15 to-emerald-500/15 border border-accent/40 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0 text-lg shadow-inner">
              🚀
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-text-primary">
                  Yeni StockMind Güncellemesi Mevcut ({versionInfo.version})
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/30 text-accent border border-accent/40">
                  Yüklü: v{currentVersion}
                </span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {versionInfo.releaseNotes}
              </p>
              <p className="text-[11px] text-emerald-400 font-medium">
                💡 Mevcut uygulamayı silmenize gerek yoktur. Güncelleme oturum ve verilerinizi korur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
            >
              Daha Sonra
            </button>
            <button
              type="button"
              onClick={handleDownloadUpdate}
              disabled={isDownloading}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-accent to-purple-600 hover:from-accent-hover hover:to-purple-700 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isDownloading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Güncelleniyor...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Hemen Güncelle (APK)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* In-App Update Helper Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-card border border-border w-full max-w-md rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚀</span>
                <h3 className="text-base font-bold text-text-primary">
                  StockMind v{versionInfo.version} Güncellemesi
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <span>✅</span> İndirme başlatıldı!
              </p>
              <p className="text-[11px] text-text-secondary">
                Telefonunuzun üst bildirim çubuğunda indirme ilerlemesini görebilirsiniz. İndirme bittiğinde bildirime dokunarak <strong>Güncelle</strong> demeniz yeterlidir.
              </p>
            </div>

            {/* Direct Copy Button for older webviews or download blocks */}
            <div className="space-y-2 pt-1">
              <p className="text-xs text-text-muted">
                İndirme otomatik başlamadıysa aşağıdaki bağlantıyı kopyalayıp telefonunuzun <strong>Chrome</strong> tarayıcısına yapıştırın:
              </p>

              <button
                type="button"
                onClick={handleCopyDownloadUrl}
                className="w-full py-2.5 px-3 rounded-xl bg-accent text-white font-semibold text-xs flex items-center justify-center gap-2 hover:bg-accent-hover transition-all cursor-pointer shadow-md"
              >
                {copied ? (
                  <>
                    <span>✓</span>
                    <span>Bağlantı Kopyalandı! Chrome'a Yapıştırın</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    <span>Güncelleme Linkini Kopyala</span>
                  </>
                )}
              </button>

              <a
                href="/StockMind.apk"
                download="StockMind.apk"
                className="w-full py-2 px-3 rounded-xl bg-bg-secondary border border-border text-text-primary text-center block text-xs font-medium hover:bg-bg-hover transition-colors"
              >
                Tarayıcıda Doğrudan Aç & İndir (/StockMind.apk)
              </a>
            </div>

            {/* Step-by-Step Info */}
            <div className="p-3 rounded-xl bg-bg-secondary/60 border border-border/60 text-[11px] text-text-secondary space-y-1.5">
              <p className="font-semibold text-text-primary">📌 Güncelleme Adımları:</p>
              <ol className="list-decimal list-inside space-y-1 pl-1">
                <li>İndirilen <strong className="text-text-primary">StockMind.apk</strong> dosyasına dokunun.</li>
                <li>Ekrana gelen pencerede <strong className="text-emerald-400">Güncelle</strong> seçeneğini seçin.</li>
                <li>Eski uygulamayı <strong className="text-amber-400">kesinlikle silmeyin</strong>; tüm verileriniz ve portföyünüz %100 korunur.</li>
              </ol>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2 rounded-xl bg-bg-hover text-text-secondary text-xs font-semibold hover:text-text-primary transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
