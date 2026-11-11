'use client';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useEffect } from 'react';
import { buildWidgetShareDescriptor, type WidgetShareMode } from '@/lib/widgets/widgetSharePolicy';

interface WidgetEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWidget?: 'portfolio' | 'heatmap';
}

export default function WidgetEmbedModal({
  isOpen,
  onClose,
  initialWidget = 'portfolio',
}: WidgetEmbedModalProps) {
  const [selectedWidget, setSelectedWidget] = useState<'portfolio' | 'heatmap'>(initialWidget);
  const [theme, setTheme] = useState<'dark' | 'light' | 'transparent'>('dark');
  const [sizePreset, setSizePreset] = useState<'compact' | 'medium' | 'responsive'>('compact');
  const [shareMode, setShareMode] = useState<WidgetShareMode>('demo');
  const [personalConsent, setPersonalConsent] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setSelectedWidget(initialWidget);
  }, [initialWidget]);

  useEffect(() => {
    if (isOpen) {
      setShareMode('demo');
      setPersonalConsent(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const descriptor = buildWidgetShareDescriptor({
    widget: selectedWidget,
    theme,
    shareMode,
    personalConsent,
    hideAmounts,
    origin,
  });
  const fullWidgetUrl = descriptor.url;

  const dimensions =
    sizePreset === 'compact'
      ? { width: '380', height: selectedWidget === 'portfolio' ? '280' : '320' }
      : sizePreset === 'medium'
      ? { width: '540', height: '360' }
      : { width: '100%', height: '320' };

  const iframeCode = `<iframe src="${fullWidgetUrl}" width="${dimensions.width}" height="${dimensions.height}" frameborder="0" style="border-radius: 24px; overflow: hidden;" title="StockMind Widget"></iframe>`;

  const handleCopyCode = async () => {
    if (!descriptor.canExport) return;
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  };

  const handleCopyUrl = async () => {
    if (!descriptor.canExport) return;
    try {
      await navigator.clipboard.writeText(fullWidgetUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {}
  };

  const handleOpenDesktopWindow = () => {
    if (!descriptor.canExport) return;
    const w = parseInt(dimensions.width, 10) || 400;
    const h = parseInt(dimensions.height, 10) || 320;
    window.open(
      fullWidgetUrl,
      `StockMind_Widget_${selectedWidget}`,
      `width=${w},height=${h},top=100,left=100,toolbar=no,menubar=no,location=no,status=no,resizable=yes`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-[var(--palette-color0f1422)] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 text-accent flex items-center justify-center text-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Widget Gömme & Masaüstü Paylaşımı</h3>
              <p className="text-xs text-text-muted">Notion, kişisel web siteniz veya masaüstü penceresi için kod üretin</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Widget Selector */}
          <div>
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
              Widget Seçin
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedWidget('portfolio')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedWidget === 'portfolio'
                    ? 'bg-accent/15 border-accent text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/10 text-text-muted hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span><UIIcon name="sparkles" className="w-4 h-4" /></span> Portföy Durumu (Günlük/Aylık)
                </div>
                <p className="text-[10px] text-text-muted mt-1">Toplam varlık, günlük getiri & aylık oran</p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedWidget('heatmap')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedWidget === 'heatmap'
                    ? 'bg-accent/15 border-accent text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/10 text-text-muted hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span><UIIcon name="chart" className="w-4 h-4" /></span> Isı Haritası (Heatmap)
                </div>
                <p className="text-[10px] text-text-muted mt-1">Hisse kutuları & ağırlık oranları</p>
              </button>
            </div>
          </div>

          {/* Configuration Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Theme */}
            <div>
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                Tema / Görünüm
              </label>
              <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/10">
                {[
                  { key: 'dark', label: " Koyu" },
                  { key: 'light', label: " Açık" },
                  { key: 'transparent', label: " Şeffaf" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTheme(t.key as any)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      theme === t.key
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-text-muted hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Preset */}
            <div>
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-2">
                Boyut Şablonu
              </label>
              <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/10">
                {[
                  { key: 'compact', label: 'Kompakt' },
                  { key: 'medium', label: 'Orta' },
                  { key: 'responsive', label: 'Tam Genişlik' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSizePreset(s.key as any)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      sizePreset === s.key
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-text-muted hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Data Sharing Scope & Explicit Consent */}
          <div className="space-y-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">
              Veri Paylaşım Sınırı
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="widget-share-mode-demo"
                onClick={() => {
                  setShareMode('demo');
                  setPersonalConsent(false);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  shareMode === 'demo'
                    ? 'bg-amber-500/15 border-amber-400/50 text-white'
                    : 'bg-white/[0.02] border-white/10 text-text-muted hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">Örnek Veri (Güvenli Mod)</div>
                <p className="text-[10px] text-text-muted mt-1">
                  Kişisel tutar içermez; harici Notion/web gömmeleri için önerilir.
                </p>
              </button>

              <button
                type="button"
                data-testid="widget-share-mode-personal"
                onClick={() => setShareMode('personal')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  shareMode === 'personal'
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-white'
                    : 'bg-white/[0.02] border-white/10 text-text-muted hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">Kişisel Değerler</div>
                <p className="text-[10px] text-text-muted mt-1">
                  Yalnızca oturum açtığınız kendi tarayıcınızda kişisel değerleri gösterir.
                </p>
              </button>
            </div>

            {shareMode === 'personal' && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <label className="flex items-start gap-2.5 text-xs text-white/90 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="widget-personal-consent-checkbox"
                    checked={personalConsent}
                    onChange={(e) => setPersonalConsent(e.target.checked)}
                    className="mt-0.5 accent-accent cursor-pointer"
                  />
                  <span>
                    Kişisel portföy değerlerimin bu widget penceresinde yalnızca aktif tarayıcı oturumumla görünmesini açıkça onaylıyorum.
                  </span>
                </label>

                {selectedWidget === 'portfolio' && (
                  <label className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="widget-hide-amounts-checkbox"
                      checked={hideAmounts}
                      onChange={(e) => setHideAmounts(e.target.checked)}
                      className="accent-accent cursor-pointer"
                    />
                    <span>Parasal tutarları gizle (yalnızca yüzde ve maskelenmiş tutar göster)</span>
                  </label>
                )}
              </div>
            )}

            {/* Boundary Preview Card */}
            <div
              data-testid="widget-share-boundary-preview"
              className={`p-3 rounded-xl border text-xs space-y-2 ${
                descriptor.requiresConsentConfirmation
                  ? 'bg-rose-500/10 border-rose-400/30 text-rose-200'
                  : 'bg-black/30 border-white/10 text-text-secondary'
              }`}
            >
              <div className="font-bold text-white flex items-center justify-between gap-2">
                <span>{descriptor.headline}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                  {descriptor.effectiveMode === 'personal' ? 'Kişisel' : 'Örnek'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-text-muted">{descriptor.boundaryNote}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <div className="font-semibold text-emerald-300 mb-1">Gösterilen Veri</div>
                  <ul className="space-y-0.5 list-disc list-inside text-text-secondary">
                    {descriptor.sharedFields.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-semibold text-amber-300 mb-1">Paylaşım Dışı</div>
                  <ul className="space-y-0.5 list-disc list-inside text-text-muted">
                    {descriptor.neverShared.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Mini-Window Launcher */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-600/15 via-accent/15 to-emerald-500/15 border border-accent/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span><UIIcon name="sparkles" className="w-4 h-4" /></span> Yüzen Masaüstü Penceresi Olarak Başlat
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">
                Tarayıcı kenarında veya ikinci monitörde mini widget penceresi olarak açık kalsın.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenDesktopWindow}
              disabled={!descriptor.canExport}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent/25 transition-all cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span> Pencereyi Aç</span>
            </button>
          </div>

          {/* iFrame Code Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-text-muted uppercase tracking-wider">
                HTML iFrame Kodu
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                disabled={!descriptor.canExport}
                className="text-accent hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copiedCode ? '✓ Kopyalandı!' : 'Kodu Kopyala'}
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-black/50 border border-white/10 text-[11px] text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap select-all">
              {descriptor.requiresConsentConfirmation
                ? 'Kişisel değer paylaşım kodunu oluşturmak için yukarıdaki açık onay kutusunu işaretleyin.'
                : iframeCode}
            </pre>
          </div>

          {/* Direct Link (For Notion Embed) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-text-muted uppercase tracking-wider">
                Doğrudan URL (Notion / Web)
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                disabled={!descriptor.canExport}
                className="text-accent hover:underline font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copiedUrl ? '✓ Kopyalandı!' : 'Bağlantıyı Kopyala'}
              </button>
            </div>
            <input
              type="text"
              readOnly
              aria-label="Widget yerleştirme URL bağlantısı"
              value={descriptor.requiresConsentConfirmation ? 'Önce yukarıdaki açık onayı işaretleyin' : fullWidgetUrl}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-text-secondary font-mono select-all focus:outline-none"
            />
            <p className="text-[11px] text-text-muted">
               <strong>Notion / Web Kullanıcıları:</strong> Harici ortamlara gömerken yalnızca <code className="text-accent">Örnek Veri</code> bağlantısı kişisel bilgi içermez; kişisel değerler yalnızca oturumunuzun açık olduğu tarayıcıda görüntülenir.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-xs text-text-muted">
          <span>{descriptor.effectiveMode === 'personal' ? 'Oturuma bağlı kişisel mod' : 'Örnek veri modu (kişisel veri dışa aktarılmaz)'}</span>
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
