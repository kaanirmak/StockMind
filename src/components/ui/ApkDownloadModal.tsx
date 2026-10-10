'use client';

import React, { useState, useEffect } from 'react';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApkDownloadModal({ isOpen, onClose }: ApkDownloadModalProps) {
  const [downloadUrl, setDownloadUrl] = useState('/StockMind.apk');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDownloadUrl(`${window.location.origin}/StockMind.apk`);
    }
  }, []);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    downloadUrl
  )}&color=ffffff&bgcolor=18181b&margin=1`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg bg-[#0e131f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-in">
        {/* Glow gradients */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative p-6 sm:p-7 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400/20 via-teal-500/20 to-violet-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.997-3.459a.416.416 0 00-.152-.5684.417.417 0 00-.569.152l-2.0223 3.503C15.583 8.359 13.856 8 12 8s-3.583.359-5.1352.949L4.8425 5.446a.417.417 0 00-.569-.152.416.416 0 00-.152.5684l1.997 3.459C2.688 11.086 0 14.887 0 19.341h24c0-4.454-2.688-8.255-6.1185-10.0196" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">StockMind Android</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  v1.0.3 APK (Güncel)
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Resmi Android Mobil Uygulama Paketi (5.9 MB)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Direct Download & QR Hero */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-white/[0.03] border border-white/10 rounded-2xl p-4 sm:p-5">
            {/* QR Card */}
            <div className="flex flex-col items-center justify-center text-center p-3 bg-black/40 rounded-xl border border-white/5">
              <div className="w-36 h-36 rounded-lg bg-zinc-900 p-2 border border-white/10 shadow-inner flex items-center justify-center relative group">
                <img
                  src={qrImageUrl}
                  alt="StockMind APK QR Kodu"
                  className="w-full h-full object-contain rounded"
                  onError={(e) => {
                    // Fallback to text link if offline
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <span className="text-[11px] font-medium text-emerald-400 mt-2 flex items-center gap-1">
                <span>📱</span> Kamerayla Tara & İndir
              </span>
            </div>

            {/* Direct Actions */}
            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-1">
                  Doğrudan İndirme
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Android cihazınızdan doğrudan APK dosyasını indirip saniyeler içinde kurun.
                </p>
              </div>

              {/* Download APK Button */}
              <a
                href="/api/download/apk"
                download="StockMind.apk"
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Hemen APK İndir (5.9 MB)</span>
              </a>

              {/* Copy Link Button */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white text-xs font-medium flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span className="text-emerald-400 font-bold">Bağlantı Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    <span>İndirme Linkini Kopyala</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Installation Guide (3 Easy Steps) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>🛠️</span> 3 Adımda Kolay Kurulum
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <p className="text-xs font-bold text-text-primary">APK'yı İndirin</p>
                <p className="text-[11px] text-text-muted leading-tight">
                  Yukarıdaki butona tıklayın veya QR kodu telefonunuzla okutun.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <p className="text-xs font-bold text-text-primary">İzne Onay Verin</p>
                <p className="text-[11px] text-text-muted leading-tight">
                  Android uyarısında "Yine de indir" ve "Bilinmeyen kaynaklara izin ver"i seçin.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <p className="text-xs font-bold text-text-primary">Yükleyin veya Güncelleyin</p>
                <p className="text-[11px] text-text-muted leading-tight">
                  İndirilen dosyayı açıp "Güncelle" veya "Yükle"ye dokunun. Eski sürümü silmenize gerek yoktur; verileriniz korunur.
                </p>
              </div>
            </div>
          </div>

          {/* Highlights */}
          <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className="text-violet-200">
                Tam ekran akıcı deneyim, anlık BIST & TEFAS bildirimleri ve yapay zeka analizleri parmaklarınızın ucunda.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-xs text-text-muted">
          <span>Android 7.0 (Nougat) ve üzeri desteklenir</span>
          <button
            onClick={onClose}
            className="text-white hover:underline font-medium cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
