'use client';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState } from 'react';
import PortfolioStatusWidget from '@/components/widgets/PortfolioStatusWidget';
import HeatmapWidget from '@/components/widgets/HeatmapWidget';
import WidgetEmbedModal from '@/components/widgets/WidgetEmbedModal';
import ApkDownloadModal from '@/components/ui/ApkDownloadModal';

export default function WidgetsHubPage() {
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [selectedWidgetForModal, setSelectedWidgetForModal] = useState<'portfolio' | 'heatmap'>('portfolio');
  const [apkModalOpen, setApkModalOpen] = useState(false);

  const openDesktopWindow = (widget: 'portfolio' | 'heatmap', platform: 'mac' | 'win' = 'mac') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const isMac = platform === 'mac';
    if (widget === 'portfolio') {
      window.open(
        `${origin}/widgets/portfolio`,
        'StockMind_Portfolio_Widget',
        isMac
          ? 'width=390,height=330,top=100,left=100,toolbar=no,menubar=no,location=no,status=no,resizable=yes'
          : 'width=420,height=340,top=120,left=120,toolbar=no,menubar=no,location=no,status=no,resizable=yes'
      );
    } else {
      window.open(
        `${origin}/widgets/heatmap`,
        'StockMind_Heatmap_Widget',
        isMac
          ? 'width=560,height=420,top=100,left=100,toolbar=no,menubar=no,location=no,status=no,resizable=yes'
          : 'width=590,height=440,top=120,left=120,toolbar=no,menubar=no,location=no,status=no,resizable=yes'
      );
    }
  };

  const openEmbedModal = (widget: 'portfolio' | 'heatmap') => {
    setSelectedWidgetForModal(widget);
    setEmbedModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-900/20 via-accent/10 to-teal-900/20 border border-border backdrop-blur-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent text-xs font-bold">
            <span><UIIcon name="sparkles" className="w-4 h-4" /></span> CANLI STOCKMIND WIDGET MERKEZİ
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-text-primary tracking-tight">
            Piyasayı ve Portföyünüzü <br />
            <span className="gradient-text">Her Yerden Anlık İzleyin</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            StockMind widget'larını Notion sayfalarınıza veya kendi web sitelerinize gömün,
            masaüstünüzde yüzen bağımsız mini pencere olarak çalıştırın ya da Android telefonunuzdan takip edin.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setApkModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.997-3.459a.416.416 0 00-.152-.5684.417.417 0 00-.569.152l-2.0223 3.503C15.583 8.359 13.856 8 12 8s-3.583.359-5.1352.949L4.8425 5.446a.417.417 0 00-.569-.152.416.416 0 00-.152.5684l1.997 3.459C2.688 11.086 0 14.887 0 19.341h24c0-4.454-2.688-8.255-6.1185-10.0196" />
            </svg>
            <span> APK İndir (5.9 MB)</span>
          </button>

          <button
            type="button"
            onClick={() => openEmbedModal('portfolio')}
            className="px-4 py-2.5 rounded-xl bg-accent text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-accent/25 hover:opacity-90 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <span>Gömme Kodu Al</span>
          </button>
        </div>
      </div>

      {/* Widget Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WIDGET 1: Portföy Durumu (Günlük & Aylık) */}
        <div className="glass-card rounded-3xl border border-border p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Portföy Durumu Widget'ı</h2>
                  <p className="text-xs text-text-muted">Günlük & Aylık Performans, Toplam Varlık Değeri</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                WIDGET #1
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Ana ekrandaki portföy kartının bağımsız kompakt sürümüdür. Tek tıkla günlük ve aylık getiri arasında geçiş yapabilir,
              tutarları gizleyip gösterebilir ve anlık USD karşılığını görebilirsiniz.
            </p>
          </div>

          {/* Live Preview Container */}
          <div className="p-2 sm:p-3 rounded-2xl bg-black/30 border border-border/80">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>CANLI ÖNİZLEME</span>
              <span className="text-emerald-400 flex items-center gap-1">● Aktif</span>
            </div>
            <PortfolioStatusWidget standalone initialPeriod="daily" />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => openDesktopWindow('portfolio', 'mac')}
              className="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.07 7.18 8.73 7.15C10.01 7.13 11.22 8.01 12.01 8.01C12.79 8.01 14.25 6.95 15.79 7.13C16.43 7.16 18.17 7.4 19.28 9.02C19.19 9.08 16.97 10.37 17 13.11C17.03 16.41 19.8 17.47 19.83 17.48C19.81 17.55 19.39 18.92 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.09 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
              </svg>
              <span>Mac Glass</span>
            </button>

            <button
              type="button"
              onClick={() => openDesktopWindow('portfolio', 'win')}
              className="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
              </svg>
              <span>Windows 11</span>
            </button>

            <button
              type="button"
              onClick={() => openEmbedModal('portfolio')}
              className="py-2.5 px-3.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              <span>iFrame</span>
            </button>
          </div>
        </div>

        {/* WIDGET 2: Isı Haritası (Heatmap) */}
        <div className="glass-card rounded-3xl border border-border p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Portföy Isı Haritası Widget'ı</h2>
                  <p className="text-xs text-text-muted">Treemap Ağırlık Dağılımı & Günlük/Toplam Getiri</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-teal-500/15 text-teal-400 border border-teal-500/30">
                WIDGET #2
              </span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Varlıkların portföyünüzdeki ağırlığına göre boyutlanan, getiri performansına göre yeşil ve kırmızı gradyanlarla
              renklenen dinamik ısı haritası. Tıklanan hissenin piyasa detayına anında götürür.
            </p>
          </div>

          {/* Live Preview Container */}
          <div className="p-2 sm:p-3 rounded-2xl bg-black/30 border border-border/80">
            <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>CANLI ÖNİZLEME</span>
              <span className="text-teal-400 flex items-center gap-1">● Aktif</span>
            </div>
            <HeatmapWidget standalone defaultMetric="daily" height={260} />
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => openDesktopWindow('heatmap', 'mac')}
              className="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.07 7.18 8.73 7.15C10.01 7.13 11.22 8.01 12.01 8.01C12.79 8.01 14.25 6.95 15.79 7.13C16.43 7.16 18.17 7.4 19.28 9.02C19.19 9.08 16.97 10.37 17 13.11C17.03 16.41 19.8 17.47 19.83 17.48C19.81 17.55 19.39 18.92 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.09 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
              </svg>
              <span>Mac Glass</span>
            </button>

            <button
              type="button"
              onClick={() => openDesktopWindow('heatmap', 'win')}
              className="flex-1 min-w-[120px] py-2.5 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
              </svg>
              <span>Windows 11</span>
            </button>

            <button
              type="button"
              onClick={() => openEmbedModal('heatmap')}
              className="py-2.5 px-3.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              <span>iFrame</span>
            </button>
          </div>
        </div>
      </div>

      {/* Integration Guide Section */}
      <div className="glass-card rounded-3xl border border-border p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-text-primary">Widget'ları Nasıl Kullanabilirsiniz?</h3>
          <p className="text-xs text-text-muted mt-1">İhtiyacınıza göre en uygun masaüstü veya mobil entegrasyon yöntemini seçin</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Guide 1: macOS Sonoma/Sequoia */}
          <div className="p-5 rounded-2xl bg-bg-secondary/60 border border-border space-y-2.5 hover:border-purple-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.99 2.97 12.5 4.7 9.56C5.55 8.1 7.07 7.18 8.73 7.15C10.01 7.13 11.22 8.01 12.01 8.01C12.79 8.01 14.25 6.95 15.79 7.13C16.43 7.16 18.17 7.4 19.28 9.02C19.19 9.08 16.97 10.37 17 13.11C17.03 16.41 19.8 17.47 19.83 17.48C19.81 17.55 19.39 18.92 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.09 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/>
              </svg>
            </div>
            <h4 className="text-sm font-bold text-text-primary">macOS Sonoma / Sequoia</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              &quot;Mac Glass&quot; ile seans boyunca masaüstünüzün köşesinde duracak akrilik pencere açın veya Safari'de &quot;Masaüstüne Web Uygulaması Olarak Ekle&quot; seçeneğini kullanın.
            </p>
          </div>

          {/* Guide 2: Windows 11 Widget Board */}
          <div className="p-5 rounded-2xl bg-bg-secondary/60 border border-border space-y-2.5 hover:border-blue-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
              </svg>
            </div>
            <h4 className="text-sm font-bold text-text-primary">Windows 11 Widget Board</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              PWA Manifest desteğimiz sayesinde Windows 11 Widget Panosuna (<code className="px-1 py-0.5 rounded bg-black/40 text-blue-400 text-[10px] font-mono">Win + W</code>) sabitleyebilir veya bağımsız akrilik mini pencere çalıştırabilirsiniz.
            </p>
          </div>

          {/* Guide 3: iOS & Android Mobile */}
          <div className="p-5 rounded-2xl bg-bg-secondary/60 border border-border space-y-2.5 hover:border-emerald-500/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-text-primary">iOS & Android Ana Ekran</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              iPhone'da Safari &quot;Paylaş → Ana Ekrana Ekle&quot;, Android'de resmi APK veya Chrome üzerinden tek dokunuşla tam ekran portföy takibi yapın.
            </p>
          </div>

          {/* Guide 4: Notion & Websites */}
          <div className="p-5 rounded-2xl bg-bg-secondary/60 border border-border space-y-2.5 hover:border-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent border border-accent/25 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-text-primary">Notion & Web Embed</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Notion sayfanızda <code className="px-1 py-0.5 rounded bg-black/40 text-accent font-mono text-[10px]">/embed</code> yazıp bağlantıyı yapıştırın veya iframe kodunu doğrudan kendi sitenize gömün.
            </p>
          </div>
        </div>
      </div>

      {/* Embed Modal */}
      <WidgetEmbedModal
        isOpen={embedModalOpen}
        onClose={() => setEmbedModalOpen(false)}
        initialWidget={selectedWidgetForModal}
      />

      {/* APK Modal */}
      <ApkDownloadModal
        isOpen={apkModalOpen}
        onClose={() => setApkModalOpen(false)}
      />
    </div>
  );
}
