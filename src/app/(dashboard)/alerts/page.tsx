'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  Input,
  InstrumentLogo,
  StateView,
  useToast,
} from '@/components/ui';
import { PriceAlertModal } from '@/components/stocks/PriceAlertModal';
import { marketJson } from '@/lib/api/clientCache';
import { buildScopedQuotesUrl } from '@/lib/market/symbolQuery';
import { formatAlertPrice } from '@/lib/market/alertForm';
import {
  describeAlertRule,
  isAlertPaused,
  partitionAlertRules,
  type AlertRuleStatusFilter,
} from '@/lib/market/alertRules';
import {
  ALERT_TELEMETRY_UPDATED_EVENT,
  buildAlertTelemetryKey,
  loadAlertTelemetryMap,
  type AlertTelemetryMap,
} from '@/lib/market/alertTelemetry';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlistStore, type WatchlistItem } from '@/store/useWatchlistStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import {
  DEFAULT_PORTFOLIO_MOVE_CONFIG,
  PORTFOLIO_MOVE_FREQUENCY_LABELS,
  evaluatePortfolioMoveAlerts,
  isVerifiedPortfolioValuation,
  readPortfolioMoveConfig,
  readPortfolioMoveHistory,
  writePortfolioMoveConfig,
  writePortfolioMoveHistory,
  type PortfolioMoveAlertConfig,
  type PortfolioMoveDirection,
  type PortfolioMoveFrequency,
} from '@/lib/notifications/portfolioMoves';
import { sendPushNotification } from '@/lib/notifications/pushNotification';

function formatTelemetryTime(iso?: string): string {
  if (!iso) return 'Henüz yok';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return 'Bilinmiyor';
  return new Date(parsed).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface LiveQuoteEntry {
  price: number;
  changePercent?: number;
  currency?: string;
}

export default function AllAlertsPage() {
  const { items, currentUserId, toggleAlertPaused, removeAlert } = useWatchlistStore();
  const { portfolios, activePortfolioId, isSampleMode, getSummary } = usePortfolioStore();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<AlertRuleStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuoteEntry>>({});
  const [telemetryMap, setTelemetryMap] = useState<AlertTelemetryMap>({});
  const [editingRule, setEditingRule] = useState<WatchlistItem | null>(null);
  const [moveConfig, setMoveConfig] = useState<PortfolioMoveAlertConfig>(DEFAULT_PORTFOLIO_MOVE_CONFIG);

  useEffect(() => {
    setMoveConfig(readPortfolioMoveConfig(currentUserId));
  }, [currentUserId]);

  const portfolioSnapshot = useMemo(() => {
    const summary = getSummary();
    const activePortfolio =
      portfolios.find((p) => p.id === activePortfolioId) ?? portfolios[0];
    if (!activePortfolio) return null;
    const missingSymbols = [
      ...(summary.valuationStatus?.missingPrices ?? []),
      ...(summary.valuationStatus?.missingFx ? ['USDTRY'] : []),
    ];
    return {
      portfolioId: activePortfolio.id,
      portfolioName: activePortfolio.name,
      currency: 'TRY' as const,
      dailyChangePct: summary.dailyPnLPercent,
      dailyChangeValue: summary.dailyPnL,
      totalValue: summary.totalValue,
      verifiedHoldingsCount: Math.max(
        0,
        summary.holdings.length - (summary.valuationStatus?.missingPrices?.length ?? 0),
      ),
      totalHoldingsCount: summary.holdings.length,
      missingPriceSymbols: missingSymbols,
      isSampleSnapshot: isSampleMode,
    };
  }, [getSummary, portfolios, activePortfolioId, isSampleMode]);

  const portfolioVerdict = useMemo(
    () =>
      portfolioSnapshot
        ? isVerifiedPortfolioValuation(portfolioSnapshot)
        : { verified: false, reason: 'no-portfolio' },
    [portfolioSnapshot],
  );

  const handleSaveMoveConfig = (next: PortfolioMoveAlertConfig) => {
    const saved = writePortfolioMoveConfig(next, currentUserId);
    setMoveConfig(saved);
    showToast({
      type: 'success',
      title: 'Portföy Hareketi Kuralı Kaydedildi',
      message: saved.enabled
        ? `%${saved.thresholdPct} eşik · ${PORTFOLIO_MOVE_FREQUENCY_LABELS[saved.frequency]}`
        : 'Portföy hareketi bildirimleri duraklatıldı.',
    });
  };

  const handleEvaluatePortfolioNow = () => {
    if (!portfolioSnapshot) {
      showToast({
        type: 'info',
        title: 'Portföy Bulunamadı',
        message: 'Önce gerçek portföy işlemleri ekleyin.',
      });
      return;
    }
    const history = readPortfolioMoveHistory(currentUserId);
    const result = evaluatePortfolioMoveAlerts({
      config: moveConfig,
      snapshots: [portfolioSnapshot],
      history,
    });
    if (result.triggered.length > 0) {
      for (const ev of result.triggered) {
        sendPushNotification(ev.title, ev.body, ev.route);
      }
      writePortfolioMoveHistory(result.updatedHistory, currentUserId);
      showToast({
        type: 'success',
        title: 'Portföy Hareketi Bildirimi Tetiklendi',
        message: result.triggered[0].body,
      });
    } else {
      const skipReason = result.skipped[0]?.reason ?? 'unknown';
      const skipMap: Record<string, string> = {
        disabled: 'Portföy hareketi bildirimleri kapalı.',
        'sample-snapshot': 'Örnek (demo) portföy verisinde hareket bildirimi tetiklenmez.',
        'incomplete-price-coverage': 'Tüm varlık fiyatları doğrulanmadığı için sahte eşik uyarısı atlandı.',
        'no-verified-holdings': 'Doğrulanmış açık pozisyon bulunamadı.',
        'below-threshold': `Mevcut günlük değişim %${moveConfig.thresholdPct} eşiğinin altında.`,
        'direction-filtered': 'Mevcut hareket seçili yön filtresinin dışında.',
        'throttled-by-frequency': 'Seçili sıklık sınırı içinde zaten bildirim gönderildi.',
      };
      showToast({
        type: 'info',
        title: 'Tetikleme Koşulu Oluşmadı',
        message: skipMap[skipReason] || `Durum: ${skipReason}`,
      });
    }
  };

  useEffect(() => {
    const syncTelemetry = () => {
      setTelemetryMap(loadAlertTelemetryMap(currentUserId));
    };
    syncTelemetry();
    window.addEventListener(ALERT_TELEMETRY_UPDATED_EVENT, syncTelemetry);
    return () => {
      window.removeEventListener(ALERT_TELEMETRY_UPDATED_EVENT, syncTelemetry);
    };
  }, [currentUserId]);

  const isPro = Boolean(
    user?.app_metadata?.plan === 'pro' ||
      user?.app_metadata?.is_pro === true ||
      profile?.isPro,
  );

  const { allRules, activeRules, pausedRules, filteredRules } = useMemo(
    () => partitionAlertRules(items, statusFilter, searchQuery),
    [items, statusFilter, searchQuery],
  );

  useEffect(() => {
    if (allRules.length === 0) return;
    let active = true;
    const stockSymbols = allRules.filter((r) => r.assetType !== 'fund').map((r) => r.symbol);
    const fundSymbols = allRules.filter((r) => r.assetType === 'fund').map((r) => r.symbol);
    const stockUrl = buildScopedQuotesUrl('stock', stockSymbols, { liveOnly: true });
    const fundUrl = buildScopedQuotesUrl('fund', fundSymbols);

    const loadQuotes = async () => {
      const next: Record<string, LiveQuoteEntry> = {};
      if (stockUrl) {
        try {
          const res = await marketJson<{ data?: Array<{ symbol?: string; price?: number; changePercent?: number; currency?: string }> }>(
            stockUrl,
            30_000,
          );
          for (const row of res.data || []) {
            if (row.symbol && typeof row.price === 'number' && row.price > 0) {
              next[row.symbol.toUpperCase()] = {
                price: row.price,
                changePercent: row.changePercent,
                currency: row.currency,
              };
            }
          }
        } catch {
          // Non-fatal; existing item quote remains fallback
        }
      }
      if (fundUrl) {
        try {
          const res = await marketJson<{ data?: Array<{ code?: string; symbol?: string; price?: number | null; dailyReturn?: number }> }>(
            fundUrl,
            60_000,
          );
          for (const row of res.data || []) {
            const sym = (row.code || row.symbol || '').toUpperCase();
            if (sym && typeof row.price === 'number' && row.price > 0) {
              next[sym] = {
                price: row.price,
                changePercent: row.dailyReturn,
                currency: 'TRY',
              };
            }
          }
        } catch {
          // Non-fatal
        }
      }
      if (active && Object.keys(next).length > 0) {
        setLiveQuotes((prev) => ({ ...prev, ...next }));
      }
    };

    void loadQuotes();
    return () => {
      active = false;
    };
  }, [allRules.length]);

  const handleTogglePause = (rule: WatchlistItem) => {
    const currentlyPaused = isAlertPaused(rule);
    if (currentlyPaused && !isPro && activeRules.length >= 3) {
      showToast({
        type: 'warning',
        title: 'Aktif Alarm Kotası Dolu',
        message: 'Standart hesaplarda en fazla 3 aktif alarm aynı anda açık tutulabilir.',
      });
      return;
    }

    toggleAlertPaused(rule.symbol, !currentlyPaused);
    showToast({
      type: 'info',
      title: currentlyPaused ? 'Alarm Devam Ettirildi' : 'Alarm Duraklatıldı',
      message: `${rule.symbol} kuralı ${currentlyPaused ? 'yeniden aktif edildi' : 'duraklatıldı'}.`,
    });
  };

  const handleDeleteRule = (rule: WatchlistItem) => {
    removeAlert(rule.symbol);
    showToast({
      type: 'info',
      title: 'Alarm Silindi',
      message: `${rule.symbol} için tanımlı alarm kaldırıldı.`,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="glass-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Tüm Alarmlar</h1>
            <Badge variant={isPro ? 'warning' : 'default'} size="sm">
              {isPro ? 'Sınırsız Pro' : `${activeRules.length} / 3 Aktif Kota`}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Aktif ve duraklatılmış tüm fiyat ve yüzde eşik kurallarınızı tek ekrandan yönetin, düzenleyin veya duraklatın.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/watchlist">
            <Button variant="secondary" size="sm">
              Takip Listesi
            </Button>
          </Link>
          <Link href="/settings#notifications">
            <Button variant="outline" size="sm">
              Bildirim &amp; Cihazlar
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
            Toplam Kural
          </span>
          <span className="text-lg sm:text-2xl font-extrabold font-mono text-text-primary">
            {allRules.length}
          </span>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">
            Aktif İzlenen
          </span>
          <span className="text-lg sm:text-2xl font-extrabold font-mono text-emerald-400">
            {activeRules.length}
          </span>
        </div>
        <div className="glass-card p-3 sm:p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block">
            Duraklatılmış
          </span>
          <span className="text-lg sm:text-2xl font-extrabold font-mono text-amber-400">
            {pausedRules.length}
          </span>
        </div>
      </div>

      {/* Portfolio Movement Notifications (ALR-11) */}
      <div
        data-testid="portfolio-move-alert-panel"
        className="glass-card p-4 space-y-3 border border-border/60"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-text-primary">
              Portföy Günlük Hareketi Bildirimleri
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Yalnızca tüm varlık fiyatları doğrulanmış gerçek portföy değerlemesine göre tetiklenir; tekrarlar seçtiğiniz sıklıkla sınırlandırılır.
            </p>
          </div>
          <Badge variant={portfolioVerdict.verified ? 'success' : 'warning'} size="sm">
            {portfolioVerdict.verified
              ? `Doğrulanmış (${portfolioSnapshot?.verifiedHoldingsCount ?? 0}/${portfolioSnapshot?.totalHoldingsCount ?? 0})`
              : portfolioSnapshot?.isSampleSnapshot
                ? 'Örnek Portföy (Tetiklenmez)'
                : 'Eksik Fiyat / Doğrulama Bekliyor'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-bg-secondary/60 border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={moveConfig.enabled}
              onChange={(e) =>
                setMoveConfig((prev) => ({ ...prev, enabled: e.target.checked }))
              }
              className="w-4 h-4 accent-accent"
            />
            <span className="font-medium text-text-primary">Hareket Bildirimi Açık</span>
          </label>

          <label className="space-y-1">
            <span className="text-text-muted block">Günlük Eşik (%)</span>
            <input
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={moveConfig.thresholdPct}
              onChange={(e) =>
                setMoveConfig((prev) => ({
                  ...prev,
                  thresholdPct: Number(e.target.value) || 3,
                }))
              }
              className="w-full h-9 rounded-xl border border-border bg-bg-secondary px-3 text-xs text-text-primary"
            />
          </label>

          <label className="space-y-1">
            <span className="text-text-muted block">Yön</span>
            <select
              value={moveConfig.direction}
              onChange={(e) =>
                setMoveConfig((prev) => ({
                  ...prev,
                  direction: e.target.value as PortfolioMoveDirection,
                }))
              }
              className="w-full h-9 rounded-xl border border-border bg-bg-secondary px-2.5 text-xs text-text-primary"
            >
              <option value="both">Yükseliş ve Düşüş</option>
              <option value="gain">Yalnızca Yükseliş (+)</option>
              <option value="loss">Yalnızca Düşüş (-)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-text-muted block">Bildirim Sıklığı</span>
            <select
              value={moveConfig.frequency}
              onChange={(e) =>
                setMoveConfig((prev) => ({
                  ...prev,
                  frequency: e.target.value as PortfolioMoveFrequency,
                }))
              }
              className="w-full h-9 rounded-xl border border-border bg-bg-secondary px-2.5 text-xs text-text-primary"
            >
              <option value="realtime">{PORTFOLIO_MOVE_FREQUENCY_LABELS.realtime}</option>
              <option value="hourly">{PORTFOLIO_MOVE_FREQUENCY_LABELS.hourly}</option>
              <option value="daily">{PORTFOLIO_MOVE_FREQUENCY_LABELS.daily}</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleEvaluatePortfolioNow}
          >
            Mevcut Portföyü Kontrol Et
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleSaveMoveConfig(moveConfig)}
          >
            Hareket Kuralını Kaydet
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          data-testid="alerts-filter-tabs"
          role="tablist"
          aria-label="Alarm durumu filtresi"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-bg-secondary border border-border"
        >
          {[
            { id: 'all' as const, label: `Tümü (${allRules.length})` },
            { id: 'active' as const, label: `Aktif (${activeRules.length})` },
            { id: 'paused' as const, label: `Duraklatılmış (${pausedRules.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <Input
            type="search"
            aria-label="Alarm sembolü veya varlık adı ara"
            placeholder="Sembol veya varlık adı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Rules List */}
      {allRules.length === 0 ? (
        <StateView
          kind="empty"
          title="Henüz tanımlı alarmınız yok"
          description="Piyasalar veya varlık detay sayfalarından herhangi bir hisse ya da TEFAS fonu için hızlı fiyat/yüzde alarmı kurabilirsiniz."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/piyasalar">
                <Button variant="primary" size="sm">
                  Piyasalara Göz At
                </Button>
              </Link>
              <Link href="/watchlist">
                <Button variant="secondary" size="sm">
                  Takip Listesini Aç
                </Button>
              </Link>
            </div>
          }
        />
      ) : filteredRules.length === 0 ? (
        <StateView
          kind="empty"
          title="Bu filtrede alarm bulunamadı"
          description="Durum sekmesini veya arama metnini değiştirerek diğer kurallarınızı görebilirsiniz."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
            >
              Filtreyi Sıfırla
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => {
            const paused = isAlertPaused(rule);
            const desc = describeAlertRule(rule);
            const live = liveQuotes[rule.symbol.toUpperCase()];
            const displayPrice = live?.price && live.price > 0 ? live.price : rule.price;
            const telemetry = telemetryMap[buildAlertTelemetryKey(rule.assetType, rule.symbol)];
            const observedPriceValue = telemetry?.observedPrice ?? (displayPrice > 0 ? displayPrice : null);
            const telemetryCurrency = telemetry?.currency || desc.currency;
            const detailHref =
              rule.assetType === 'fund' ? `/funds/${rule.symbol}` : `/stocks/${rule.symbol}`;

            return (
              <div
                key={rule.id || rule.symbol}
                data-testid="alert-rule-row"
                className={`glass-card p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all ${
                  paused ? 'opacity-85 border-amber-500/30 bg-amber-500/[0.02]' : 'border-emerald-500/25'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <InstrumentLogo symbol={rule.symbol} name={rule.name} size="md" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={detailHref}
                        className="font-mono font-bold text-sm sm:text-base text-text-primary hover:text-accent transition-colors"
                      >
                        {rule.symbol}
                      </Link>
                      {rule.exchange && (
                        <Badge variant="default" size="sm">
                          {rule.exchange}
                        </Badge>
                      )}
                      <Badge variant={paused ? 'warning' : 'success'} size="sm">
                        {paused ? 'Duraklatıldı' : 'Aktif'}
                      </Badge>
                      <Badge variant="info" size="sm">
                        {desc.modeLabel}
                      </Badge>
                      <span className="text-[11px] font-semibold text-text-muted">
                        {desc.directionLabel} • {desc.currency}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary truncate">{rule.name}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="font-medium text-text-primary">{desc.conditionText}</span>
                      {displayPrice > 0 && (
                        <span className="text-text-muted font-mono">
                          Güncel Referans: {formatAlertPrice(displayPrice, desc.currency, rule.assetType)}
                        </span>
                      )}
                    </div>

                    <div
                      data-testid="alert-rule-telemetry"
                      className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border/60 bg-bg-secondary/50 px-2.5 py-1.5 text-[11px] text-text-secondary"
                    >
                      <span>
                        <span className="text-text-muted">Son Kontrol:</span>{' '}
                        <strong className="font-medium text-text-primary">
                          {telemetry?.lastCheckedAt ? formatTelemetryTime(telemetry.lastCheckedAt) : 'Henüz kontrol edilmedi'}
                        </strong>
                      </span>
                      <span>
                        <span className="text-text-muted">Görülen Fiyat:</span>{' '}
                        <strong className="font-mono text-text-primary">
                          {observedPriceValue !== null
                            ? formatAlertPrice(observedPriceValue, telemetryCurrency, rule.assetType)
                            : 'Alınamadı'}
                        </strong>
                        {telemetry?.priceStatus === 'deferred' && (
                          <span className="ml-1 text-amber-400">(Ertelendi)</span>
                        )}
                      </span>
                      <span>
                        <span className="text-text-muted">Son Tetikleme:</span>{' '}
                        <strong className="font-medium text-text-primary">
                          {telemetry?.lastTriggeredAt
                            ? `${formatTelemetryTime(telemetry.lastTriggeredAt)}${
                                typeof telemetry.lastTriggeredPrice === 'number'
                                  ? ` (${formatAlertPrice(telemetry.lastTriggeredPrice, telemetryCurrency, rule.assetType)})`
                                  : ''
                              }`
                            : 'Henüz tetiklenmedi'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    data-testid="alert-edit-btn"
                    onClick={() =>
                      setEditingRule({
                        ...rule,
                        price: displayPrice > 0 ? displayPrice : rule.alertBasePrice || 0,
                        changePercent: live?.changePercent ?? rule.changePercent,
                      })
                    }
                  >
                    Düzenle
                  </Button>

                  <Button
                    type="button"
                    variant={paused ? 'primary' : 'outline'}
                    size="sm"
                    data-testid="alert-pause-toggle-btn"
                    onClick={() => handleTogglePause(rule)}
                  >
                    {paused ? 'Devam Et' : 'Duraklat'}
                  </Button>

                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    data-testid="alert-delete-btn"
                    onClick={() => handleDeleteRule(rule)}
                  >
                    Sil
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PriceAlertModal
        isOpen={Boolean(editingRule)}
        onClose={() => setEditingRule(null)}
        stock={
          editingRule
            ? {
                symbol: editingRule.symbol,
                name: editingRule.name,
                price:
                  liveQuotes[editingRule.symbol.toUpperCase()]?.price ||
                  editingRule.price ||
                  editingRule.alertBasePrice ||
                  0,
                changePercent:
                  liveQuotes[editingRule.symbol.toUpperCase()]?.changePercent ??
                  editingRule.changePercent,
                exchange: editingRule.exchange,
                currency:
                  liveQuotes[editingRule.symbol.toUpperCase()]?.currency ||
                  editingRule.alertCurrency,
                assetType: editingRule.assetType,
              }
            : null
        }
      />
    </div>
  );
}
