'use client';

import React, { useState, useEffect } from 'react';
import { isAndroidApp } from '@/lib/notifications/pushNotification';

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

        // Check if dismissed recently
        const dismissedUntil = localStorage.getItem('stockmind_update_dismissed_until');
        if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
          return;
        }

        const res = await fetch('/api/app/version');
        if (!res.ok) return;
        const data = await res.json();

        if (data && data.versionCode) {
          setVersionInfo(data);
          // If running inside Android app and installed version code is less than server
          if (isAndroid && localVersionCode < data.versionCode) {
            setUpdateAvailable(true);
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

  const handleDownloadUpdate = () => {
    setIsDownloading(true);
    // Direct link to download the updated APK
    window.location.href = versionInfo.downloadUrl || '/api/download/apk';
    setTimeout(() => {
      setIsDownloading(false);
    }, 4000);
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Dismiss for 24 hours
    localStorage.setItem('stockmind_update_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
  };

  return (
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
                <span>İndiriliyor...</span>
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
  );
}
