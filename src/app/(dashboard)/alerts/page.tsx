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
import { formatAlertPrice } from '@/lib/market/alertForm';
import {
  describeAlertRule,
  isAlertPaused,
  partitionAlertRules,
  type AlertRuleStatusFilter,
} from '@/lib/market/alertRules';
import { useAuth } from '@/hooks/useAuth';
import { useWatchlistStore, type WatchlistItem } from '@/store/useWatchlistStore';

interface LiveQuoteEntry {
  price: number;
  changePercent?: number;
  currency?: string;
}

export default function AllAlertsPage() {
  const { items, toggleAlertPaused, removeAlert } = useWatchlistStore();
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<AlertRuleStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuoteEntry>>({});
  const [editingRule, setEditingRule] = useState<WatchlistItem | null>(null);

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
    const hasStocks = allRules.some((r) => r.assetType !== 'fund');
    const hasFunds = allRules.some((r) => r.assetType === 'fund');

    const loadQuotes = async () => {
      const next: Record<string, LiveQuoteEntry> = {};
      if (hasStocks) {
        try {
          const res = await marketJson<{ data?: Array<{ symbol?: string; price?: number; changePercent?: number; currency?: string }> }>(
            '/api/stocks?liveOnly=true',
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
      if (hasFunds) {
        try {
          const res = await marketJson<{ data?: Array<{ code?: string; symbol?: string; price?: number | null; dailyReturn?: number }> }>(
            '/api/funds',
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
