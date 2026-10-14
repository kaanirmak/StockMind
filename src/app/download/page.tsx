'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DownloadPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<'android' | 'ios'>('android');
  const [downloadUrl, setDownloadUrl] = useState('/StockMind.apk');
  const [webAppUrl, setWebAppUrl] = useState('https://stockmind.app');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setDownloadUrl(`${origin}/StockMind.apk`);
      setWebAppUrl(`${origin}/dashboard`);

      // Detect iOS automatically
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIos) {
        setSelectedPlatform('ios');
      }
    }
  }, []);

  const handleCopyLink = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const activeUrl = selectedPlatform === 'android' ? downloadUrl : webAppUrl;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    activeUrl
  )}&color=ffffff&bgcolor=111827&margin=1`;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary relative overflow-hidden flex flex-col justify-between">
      {/* Background radial glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-purple-500/10 via-accent/10 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <img
            src="/logo-white.png"
            alt="StockMind"
            className="h-9 w-auto object-contain drop-shadow-[0_0_14px_rgba(168,85,247,0.4)]"
          />
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-text-secondary hover:text-white transition-all border border-white/10"
          >
            Web Uygulamasına Dön
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 py-8 flex-1 flex flex-col justify-center">
        {/* Platform Toggle Tabs */}
        <div className="flex justify-center mb-6">
          <div className="p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedPlatform('android')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                selectedPlatform === 'android'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <span>🤖 Android (APK)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlatform('ios')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                selectedPlatform === 'ios'
                  ? 'bg-gradient-to-r from-purple-500 to-accent text-white shadow-lg shadow-accent/25'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <span>🍎 iOS (iPhone & iPad)</span>
            </button>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-extrabold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            {selectedPlatform === 'android' ? 'RESMİ ANDROID UYGULAMASI (APK)' : 'RESMİ iOS SAFARI PWA DENEYİMİ'}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            StockMind Mobil Deneyimi <br />
            <span className="bg-gradient-to-r from-purple-400 via-accent to-teal-300 bg-clip-text text-transparent">
              {selectedPlatform === 'android' ? 'Android Cihazınızda' : 'iPhone & iPad Cebinizde'}
            </span>
          </h1>

          <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
            {selectedPlatform === 'android'
              ? 'Borsa İstanbul, TEFAS Fonları, AI Analiz Danışmanı ve gerçek zamanlı piyasaları Android cihazınızda tam ekran kullanın.'
              : 'App Store indirme beklemesi olmadan, Safari üzerinden "Ana Ekrana Ekle" özelliğiyle iPhone\'unuza yerel tam ekran uygulama olarak kurun.'}
          </p>
        </div>

        {/* Main Card */}
        <div className="mt-8 glass-card rounded-3xl border border-white/10 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Actions */}
            <div className="space-y-6">
              {selectedPlatform === 'android' ? (
                /* ANDROID VIEW */
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/15 shrink-0">
                      <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.997-3.459a.416.416 0 00-.152-.5684.417.417 0 00-.569.152l-2.0223 3.503C15.583 8.359 13.856 8 12 8s-3.583.359-5.1352.949L4.8425 5.446a.417.417 0 00-.569-.152.416.416 0 00-.152.5684l1.997 3.459C2.688 11.086 0 14.887 0 19.341h24c0-4.454-2.688-8.255-6.1185-10.0196" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">StockMind.apk</h2>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="text-emerald-400 font-semibold">v1.2.1</span>
                        <span>•</span>
                        <span>5.9 MB</span>
                        <span>•</span>
                        <span className="text-white/60">Android 7.0+</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <a
                      href="/api/download/apk"
                      download="StockMind.apk"
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/25 transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      <span>APK Dosyasını İndir</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(downloadUrl)}
                      className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
                    >
                      {copied ? '✅ Bağlantı Panoya Kopyalandı!' : '📋 İndirme Bağlantısını Kopyala'}
                    </button>
                  </div>
                </>
              ) : (
                /* IOS VIEW */
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/15 shrink-0 text-3xl">
                      🍎
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">StockMind iOS PWA</h2>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="text-purple-400 font-semibold">Safari WebClip</span>
                        <span>•</span>
                        <span>0 MB İndirme</span>
                        <span>•</span>
                        <span className="text-white/60">iOS 16.4+</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Link
                      href="/dashboard"
                      className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-purple-500 via-accent to-purple-600 hover:opacity-95 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-accent/25 transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>🚀 Safari'de Şimdi Başlat</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(webAppUrl)}
                      className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
                    >
                      {copied ? '✅ Web Bağlantısı Kopyalandı!' : '📋 Safari Açılış Linkini Kopyala'}
                    </button>
                  </div>
                </>
              )}

              {/* Feature Pills */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-text-secondary">
                  <span className="text-emerald-400 font-bold">✓</span> Tam Ekran Arayüz
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-text-secondary">
                  <span className="text-emerald-400 font-bold">✓</span> Anlık Portföy & Isı Haritası
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-text-secondary">
                  <span className="text-emerald-400 font-bold">✓</span> Canlı Fiyat Bildirimleri
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-2 text-text-secondary">
                  <span className="text-emerald-400 font-bold">✓</span> Güvenli & Reklamsız
                </div>
              </div>
            </div>

            {/* Right: QR Code */}
            <div className="flex flex-col items-center justify-center p-6 bg-black/40 rounded-2xl border border-white/10 text-center">
              <div className="w-52 h-52 bg-zinc-900 p-3 rounded-2xl border border-white/10 shadow-2xl flex items-center justify-center relative">
                <img
                  src={qrImageUrl}
                  alt="StockMind Mobil QR Kodu"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>

              <div className="mt-4 space-y-1">
                <p className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                  <span>📷</span> Telefonunuzun Kamerasıyla Taratın
                </p>
                <p className="text-xs text-text-muted max-w-xs">
                  {selectedPlatform === 'android'
                    ? 'QR kodu kameranızla okutarak APK dosyasını anında telefonunuza indirin.'
                    : 'iPhone kameranızla taratarak Safari üzerinden StockMind\'ı anında açın.'}
                </p>
              </div>
            </div>
          </div>

          {/* 3 Steps Guide */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">
              {selectedPlatform === 'android' ? 'Android Kurulum Adımları' : 'iPhone / iPad Kurulum Adımları (3 Basit Adım)'}
            </h3>

            {selectedPlatform === 'android' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <p className="text-sm font-bold text-white">APK'yı İndirin</p>
                  <p className="text-xs text-text-muted">
                    Yukarıdaki "APK Dosyasını İndir" butonuna dokunun veya QR kodu taratın.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <p className="text-sm font-bold text-white">Bilinmeyen Kaynaklar İzni</p>
                  <p className="text-xs text-text-muted">
                    Tarayıcınızın "Bilinmeyen uygulamaları yükle" veya "Yine de indir" uyarısını onaylayın.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/20 text-violet-400 font-bold text-xs flex items-center justify-center">
                    3
                  </div>
                  <p className="text-sm font-bold text-white">Yükleyin veya Güncelleyin</p>
                  <p className="text-xs text-text-muted">
                    İndirilen dosyaya dokunun ve "Yükle"ye basın. Eski sürümü silmenize gerek yoktur.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center">
                    1
                  </div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>🧭</span> Safari'de Açın
                  </p>
                  <p className="text-xs text-text-muted leading-relaxed">
                    StockMind'ı iPhone'unuzda <strong>Safari</strong> tarayıcısında açtığınızdan emin olun.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/20 text-accent font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>📤</span> "Paylaş" İkonuna Basın
                  </p>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Safari ekranının altındaki <strong>kutu içinden yukarı ok</strong> (Paylaş) simgesine dokunun.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                    3
                  </div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>📲</span> "Ana Ekrana Ekle"
                  </p>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Açılan menüde aşağı kaydırıp <strong>"Ana Ekrana Ekle"</strong> seçeneğini seçin ve sağ üstteki <strong>"Ekle"</strong> butonuna basın!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto w-full px-6 py-6 text-center text-xs text-text-muted border-t border-white/5">
        © 2026 StockMind Platform. Android & iOS PWA Engine v1.0.4.
      </footer>
    </div>
  );
}
