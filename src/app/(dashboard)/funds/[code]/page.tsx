'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useFundDetail } from '@/hooks/useFunds';
import { Badge, Button, Modal, Input, useToast, InstrumentLogo } from '@/components/ui';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';

export default function FundDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const code = resolvedParams.code.toUpperCase();
  const { showToast } = useToast();
  const { toggleWatchlist, isWatchlisted: checkWatchlisted } = useWatchlistStore();
  const { activePortfolioId, addTransaction, fetchLivePrices } = usePortfolioStore();

  const [days, setDays] = useState<number>(90);
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [lotCount, setLotCount] = useState<number>(100);
  const [isNameExpanded, setIsNameExpanded] = useState<boolean>(false);

  const { fund, loading, error } = useFundDetail(code, days);
  const isWatchlisted = checkWatchlisted(code);

  const handleWatchlistToggle = () => {
    const added = toggleWatchlist({
      symbol: code,
      name: fund?.name || code,
      assetType: 'fund',
      price: fund?.price || 1,
      changePercent: fund?.dailyReturn || 0,
      exchange: 'TEFAS',
    });

    showToast({
      type: 'success',
      title: added ? "Takip Listesine Eklendi " : 'Takip Listesinden Çıkarıldı',
      message: `${code} fonu favori listenize ${added ? 'eklendi' : 'çıkarıldı'}.`,
    });
  };

  const handleTradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = fund?.price || 1;
    const total = price * lotCount;

    await addTransaction({
      portfolioId: activePortfolioId,
      symbol: code,
      assetType: 'fund',
      transactionType: tradeType.toLowerCase() as 'buy' | 'sell',
      quantity: lotCount,
      price: price,
      commission: 0,
      currency: 'TRY',
      transactionDate: new Date().toISOString().split('T')[0],
      exchange: 'TEFAS',
      notes: `${code} TEFAS fon detayından hızlı işlem`,
    });

    showToast({
      type: 'success',
      title: `${tradeType === 'BUY' ? 'Fon Alımı' : 'Fon Satımı'} Kaydedildi!`,
      message: `${lotCount} adet ${code} payı ₺${price.toFixed(4)} fiyattan portföyünüze eklendi. Toplam: ₺${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
    });
    setIsTradeModalOpen(false);
    fetchLivePrices();
  };

  if (loading) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center text-text-muted space-y-3">
        <svg className="animate-spin h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>Fon detayları yükleniyor...</span>
      </div>
    );
  }

  if (error || !fund) {
    return (
      <div className="glass-card p-12 text-center space-y-4 max-w-xl mx-auto my-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 text-danger border border-danger/20 flex items-center justify-center mx-auto text-2xl font-bold">

        </div>
        <h2 className="text-xl font-bold text-text-primary">TEFAS Fonu Bulunamadı</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          <span className="font-bold text-text-primary font-mono">{code}</span> kodlu bir yatırım fonu TEFAS sisteminde kayıtlı değildir. TEFAS yatırım fonu kodları 3 karakterden oluşur (örn: <span className="text-accent font-mono font-semibold">THF, TI2, AFT, TP2, MAC</span>).
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/funds">
            <Button variant="primary" size="md">
              Tüm TEFAS Fonlarını İncele
            </Button>
          </Link>
          <Link href={`/stocks/${code}`}>
            <Button variant="secondary" size="md">
              {code} Hisselerde / Piyasada Ara &rarr;
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isDailyPos = fund.dailyReturn >= 0;

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-32 sm:pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <Link href="/funds" className="hover:text-text-primary transition-colors">
          TEFAS Fonları
        </Link>
        <span>/</span>
        <span className="text-text-primary font-semibold">{code}</span>
      </div>

      {/* Main Header - Prioritized Price & Clean Collapsible Name */}
      <div className="glass-card p-4 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <InstrumentLogo symbol={code} name={fund.name} size="lg" rounded="2xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary">{code}</h1>
                <Badge variant="purple" size="sm">
                  {fund.category}
                </Badge>
                <Badge variant={fund.riskValue <= 3 ? 'success' : fund.riskValue <= 5 ? 'warning' : 'danger'} size="sm">
                  Risk: {fund.riskValue}/7
                </Badge>
              </div>

              {/* Collapsible Fund Name */}
              <div className="mt-1">
                <p className={`text-xs sm:text-sm text-text-secondary leading-relaxed ${isNameExpanded ? '' : 'line-clamp-1 sm:line-clamp-2'}`}>
                  {fund.name}
                </p>
                {fund.name.length > 40 && (
                  <button
                    type="button"
                    onClick={() => setIsNameExpanded(!isNameExpanded)}
                    className="text-[11px] text-accent hover:underline font-semibold mt-0.5 cursor-pointer"
                  >
                    {isNameExpanded ? 'Daha az göster ▲' : 'Tam adı göster ▼'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">Kurucu: {fund.founder}</p>
            </div>
          </div>

          {/* Quick Actions (Desktop & Mobile) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleWatchlistToggle}
              aria-label={isWatchlisted ? 'Takip listesinden çıkar' : 'Takip listesine ekle'}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                isWatchlisted
                  ? 'bg-warning/20 border-warning text-warning'
                  : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'
              }`}
              title={isWatchlisted ? 'Takip Listesinde' : 'Takip Listesine Ekle'}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>

            <Link href={`/ai-assistant?prompt=${encodeURIComponent(`${code} TEFAS fonu hakkında detaylı analiz yap, getirilerini ve risk profilini değerlendir.`)}`}>
              <Button variant="secondary" size="sm" leftIcon={
                <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }>
                AI Analiz
              </Button>
            </Link>

            <Button variant="primary" size="sm" onClick={() => setIsTradeModalOpen(true)}>
              İşlem Yap
            </Button>
          </div>
        </div>

        {/* Priority Price & Daily Return Banner */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 pt-3 border-t border-border/60">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl sm:text-3xl font-black font-mono text-text-primary">
              ₺{fund.price.toFixed(4)}
            </span>
            <span
              className={`font-mono text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-lg ${
                isDailyPos ? 'text-success bg-success/15' : 'text-danger bg-danger/15'
              }`}
            >
              {isDailyPos ? '+' : ''}
              %{fund.dailyReturn.toFixed(2)} (Günlük)
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>TEFAS Gün Sonu Takas Fiyatı</span>
            {fund.lastSyncAt && <span>({new Date(fund.lastSyncAt).toLocaleDateString('tr-TR')})</span>}
          </div>
        </div>
      </div>

      {/* Interactive Price Trend Chart & Timeframe Selector */}
      <div className="glass-card p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-semibold text-text-primary">Fiyat Değişimi</h3>
          {/* Timeframe capsule pills */}
          <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-full border border-border">
            {[
              { label: '1A', days: 30 },
              { label: '3A', days: 90 },
              { label: '6A', days: 180 },
              { label: '1Y', days: 365 },
            ].map((tf) => (
              <button
                key={tf.days}
                type="button"
                onClick={() => setDays(tf.days)}
                className={`py-1 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  days === tf.days
                    ? 'bg-accent text-white shadow-sm shadow-accent/25'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Mini Trend Chart */}
        {fund.history && fund.history.length > 1 ? (
          <div className="h-44 sm:h-52 w-full pt-2">
            {(() => {
              const prices = fund.history.map((h) => h.price);
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              const range = maxPrice - minPrice || 1;
              const points = fund.history.map((h, i) => {
                const x = (i / (fund.history.length - 1)) * 100;
                const y = 90 - ((h.price - minPrice) / range) * 80;
                return `${x},${y}`;
              }).join(' ');

              const isNetPositive = fund.history[fund.history.length - 1].price >= fund.history[0].price;
              const strokeColor = isNetPositive ? '#10b981' : '#ef4444';
              const fillColor = isNetPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';

              const firstPoint = points.split(' ')[0];
              const lastPoint = points.split(' ')[points.split(' ').length - 1];
              const areaPoints = `${firstPoint.split(',')[0]},100 ${points} ${lastPoint.split(',')[0]},100`;

              return (
                <div className="relative w-full h-full flex flex-col justify-between">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-36">
                    <polygon fill={fillColor} points={areaPoints} />
                    <polyline
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points}
                    />
                  </svg>
                  <div className="flex items-center justify-between text-[11px] text-text-muted font-mono px-1">
                    <span>{fund.history[0]?.date ? new Date(fund.history[0].date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }) : ''} (₺{minPrice.toFixed(4)})</span>
                    <span>{fund.history[fund.history.length - 1]?.date ? new Date(fund.history[fund.history.length - 1].date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }) : ''} (₺{maxPrice.toFixed(4)})</span>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-xs text-text-muted bg-bg-secondary/40 rounded-xl">
            Bu dönem için geçmiş fiyat verisi hazırlanıyor...
          </div>
        )}
      </div>

      {/* Historical Performance Matrix */}
      <div className="glass-card p-5">
        <h3 className="text-base font-semibold text-text-primary mb-4">Tarihsel Getiriler</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
          {[
            { label: 'Günlük', val: fund.dailyReturn },
            { label: '1 Ay', val: fund.monthlyReturn },
            { label: '3 Ay', val: fund.return3m },
            { label: '6 Ay', val: fund.return6m },
            { label: 'Yılbaşı', val: fund.ytdReturn },
            { label: '1 Yıl', val: fund.yearlyReturn },
            { label: '3 Yıl', val: fund.return3y },
            { label: '5 Yıl', val: fund.return5y },
          ].map((item) => (
            <div key={item.label} className="bg-bg-tertiary/60 p-3 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">{item.label}</span>
              <span
                className={`text-sm font-bold font-mono mt-1 block ${
                  item.val >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {item.val >= 0 ? '+' : ''}
                {item.val.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Asset Allocation & Key Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Allocation */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h3 className="text-base font-semibold text-text-primary">Fon Varlık Dağılımı</h3>
            <span className="text-xs text-text-muted">Son Portföy Raporu</span>
          </div>

          <div className="space-y-3 pt-2">
            {fund.assetAllocation?.map((asset) => (
              <div key={asset.category} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-text-primary">{asset.category}</span>
                  <span className="font-mono text-accent font-bold">%{asset.percentage.toFixed(1)}</span>
                </div>
                <div className="w-full bg-bg-input h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-accent to-accent-secondary h-full rounded-full transition-all duration-500"
                    style={{ width: `${asset.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Statistics */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <h3 className="text-base font-semibold text-text-primary">Fon Genel Bilgileri</h3>
            <span className="text-xs text-text-muted">TEFAS Verileri</span>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Toplam Fon Büyüklüğü (AUM)</span>
              <span className="text-base font-bold font-mono text-text-primary mt-1 block">
                ₺{(fund.totalValue / 1e9).toFixed(2)} Milyar
              </span>
            </div>

            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Yatırımcı Sayısı</span>
              <span className="text-base font-bold font-mono text-text-primary mt-1 block">
                {fund.investorCount.toLocaleString('tr-TR')} Kişi
              </span>
            </div>

            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Yıllık Yönetim Ücreti</span>
              <span className="text-base font-bold font-mono text-text-primary mt-1 block">
                %{fund.managementFee.toFixed(2)}
              </span>
            </div>

            <div className="bg-bg-tertiary/60 p-4 rounded-xl border border-border/50">
              <span className="text-xs text-text-muted block">Risk Değeri</span>
              <span className="text-base font-bold font-mono text-warning mt-1 block">
                {fund.riskValue} / 7
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Trade Modal */}
      <Modal
        isOpen={isTradeModalOpen}
        onClose={() => setIsTradeModalOpen(false)}
        title={`${code} — TEFAS Fon İşlemi`}
        description="Portföyünüze fon alım veya satım işlemi ekleyin."
      >
        <form onSubmit={handleTradeSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-bg-secondary rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setTradeType('BUY')}
              className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                tradeType === 'BUY'
                  ? 'bg-success text-white shadow-md shadow-success/20'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              FON AL
            </button>
            <button
              type="button"
              onClick={() => setTradeType('SELL')}
              className={`py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                tradeType === 'SELL'
                  ? 'bg-danger text-white shadow-md shadow-danger/20'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              FON SAT
            </button>
          </div>

          <div className="bg-bg-tertiary p-3 rounded-xl border border-border">
            <span className="text-xs text-text-muted block">Birim Pay Fiyatı</span>
            <span className="text-lg font-bold font-mono text-text-primary">₺{fund.price.toFixed(4)}</span>
          </div>

          <Input
            label="Pay Adedi"
            type="number"
            min="1"
            value={lotCount}
            onChange={(e) => setLotCount(Number(e.target.value))}
            required
          />

          <div className="bg-bg-tertiary p-3 rounded-xl border border-border flex justify-between items-center text-sm">
            <span className="text-text-secondary">Toplam Tutar:</span>
            <span className="font-bold font-mono text-text-primary">
              ₺{(fund.price * lotCount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsTradeModalOpen(false)}
            >
              İptal
            </Button>
            <Button
              type="submit"
              variant={tradeType === 'BUY' ? 'success' : 'danger'}
            >
              {tradeType === 'BUY' ? 'Alış Emrini Tamamla' : 'Satış Emrini Tamamla'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
