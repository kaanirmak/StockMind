'use client';

import React, { useState } from 'react';
import PortfolioStatusWidget from '@/components/widgets/PortfolioStatusWidget';
import HeatmapWidget from '@/components/widgets/HeatmapWidget';
import WidgetEmbedModal from '@/components/widgets/WidgetEmbedModal';
import ApkDownloadModal from '@/components/ui/ApkDownloadModal';

export default function WidgetsHubPage() {
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [selectedWidgetForModal, setSelectedWidgetForModal] = useState<'portfolio' | 'heatmap'>('portfolio');
  const [apkModalOpen, setApkModalOpen] = useState(false);

  const openDesktopWindow = (widget: 'portfolio' | 'heatmap') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (widget === 'portfolio') {
      window.open(
        `${origin}/widgets/portfolio`,
        'StockMind_Portfolio_Widget',
        'width=400,height=320,top=120,left=120,toolbar=no,menubar=no,location=no,status=no,resizable=yes'
      );
    } else {
      window.open(
        `${origin}/widgets/heatmap`,
        'StockMind_Heatmap_Widget',
        'width=560,height=420,top=120,left=120,toolbar=no,menubar=no,location=no,status=no,resizable=yes'
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
            <span>✨</span> CANLI STOCKMIND WIDGET MERKEZİ
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
            <span>📱 APK İndir (5.9 MB)</span>
          </button>

          <button
            type="button"
            onClick={() => openEmbedModal('portfolio')}
            className="px-4 py-2.5 rounded-xl bg-accent text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-accent/25 hover:opacity-90 transition-all cursor-pointer"
          >
            <span>🧩 Gömme Kodu Al</span>
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
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-base">
                  💼
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Portföy Durumu Widget'ı</h2>
                  <p className="text-xs text-text-muted">Günlük & Aylık Performans, Toplam Varlık Değeri</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
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
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => openDesktopWindow('portfolio')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>🖥️ Masaüstü Penceresi Olarak Aç</span>
            </button>

            <button
              type="button"
              onClick={() => openEmbedModal('portfolio')}
              className="py-2.5 px-3.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>📋 iFrame / Notion Kodu</span>
            </button>
          </div>
        </div>

        {/* WIDGET 2: Isı Haritası (Heatmap) */}
        <div className="glass-card rounded-3xl border border-border p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-base">
                  📊
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
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => openDesktopWindow('heatmap')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>🖥️ Masaüstü Penceresi Olarak Aç</span>
            </button>

            <button
              type="button"
              onClick={() => openEmbedModal('heatmap')}
              className="py-2.5 px-3.5 rounded-xl bg-bg-secondary hover:bg-bg-hover border border-border text-text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>📋 iFrame / Notion Kodu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Integration Guide Section */}
      <div className="glass-card rounded-3xl border border-border p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-text-primary">Widget'ları Nasıl Kullanabilirsiniz?</h3>
          <p className="text-xs text-text-muted mt-1">İhtiyacınıza göre en uygun entegrasyon yöntemini seçin</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Guide 1: Desktop Floating Window */}
          <div className="p-5 rounded-2xl bg-bg-secondary/60 border border-border space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent border border-accent/25 flex items-center justify-center text-lg">
              🖥️
            </div>
            <h4 className="text-sm font-bold text-text-primary">Masaüstü Yüzen Widget</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              "Masaüstü Penceresi Olarak Aç" butonuna basarak seans süresince ekranınızın bir köşesinde sürekli duracak
              kompakt bir mini widget penceresi açabilirsiniz.
            </p>
          </div>

          {/* Guide 2: Notion & Websites */}
          <div className="p-5 rounded-2xl bg-bg-secondary/60 border border-border space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center justify-center text-lg">
              📝
            </div>
            <h4 className="text-sm font-bold text-text-primary">Notion & Web Sitesi Embed</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Notion sayfanızda <code className="px-1.5 py-0.5 rounded bg-black/40 text-accent font-mono text-[11px]">/embed</code> yazıp
              widget bağlantısını yapıştırın veya HTML web sitenize iframe kodunu doğrudan ekleyin.
            </p>
          </div>

          {/* Guide 3: Android Home Screen */}
          <div className="p-5 rounded-2xl bg-bg-secondary/60 border border-border space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center text-lg">
              📱
            </div>
            <h4 className="text-sm font-bold text-text-primary">Telefon Ana Ekranına Ekleme</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              Android cihazınızda Chrome veya StockMind uygulamasında "Ana Ekrana Ekle" diyerek portföy ve ısı haritasını
              telefonunuzun ana ekranından anında görüntüleyin.
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
