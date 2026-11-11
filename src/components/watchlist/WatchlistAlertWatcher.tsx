'use client';

import { useEffect, useRef } from 'react';
import { useWatchlistStore, isPriceAlertTriggered } from '@/store/useWatchlistStore';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { sendPushNotification, loadPushPreferences } from '@/lib/notifications/pushNotification';
import {
  evaluatePortfolioMoveAlerts,
  readPortfolioMoveConfig,
  readPortfolioMoveHistory,
  writePortfolioMoveHistory,
} from '@/lib/notifications/portfolioMoves';
import { marketJson } from '@/lib/api/clientCache';
import { buildScopedQuoteRequests } from '@/lib/market/symbolQuery';
import { evaluateRefreshPolicy } from '@/lib/market/refreshPolicy';
import {
  buildAlertAssetRoute,
  evaluateAlertPriceFreshness,
  recordDeferredAlert,
  clearDeferredAlert,
  type AlertDeferralReason,
  type AlertPriceQuote,
} from '@/lib/market/alertFreshness';
import { inferAssetAlertCurrency } from '@/lib/market/alertForm';
import { recordAlertCheck, recordAlertTrigger } from '@/lib/market/alertTelemetry';
import type { MarketPriceObservation } from '@/types/stock';

/** localStorage-based cooldown per symbol to survive WebView restarts */
const ALERT_COOLDOWN_KEY = 'stockmind_alert_cooldowns';
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function loadAlertCooldowns(): Record<string, number> {
  try {
    const raw = localStorage.getItem(ALERT_COOLDOWN_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveAlertCooldowns(cache: Record<string, number>): void {
  try {
    const now = Date.now();
    const pruned: Record<string, number> = {};
    for (const [key, ts] of Object.entries(cache)) {
      if (now - ts < ALERT_COOLDOWN_MS) pruned[key] = ts;
    }
    localStorage.setItem(ALERT_COOLDOWN_KEY, JSON.stringify(pruned));
  } catch { /* ignore */ }
}

type QuotePayload = {
  symbol?: string;
  code?: string;
  price?: number | null;
  exchange?: string | null;
  isLastKnown?: boolean;
  lastSyncAt?: string | null;
  navDate?: string | null;
  observation?: MarketPriceObservation | null;
};

export function WatchlistAlertWatcher() {
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let lastCheckAtMs: number | null = null;

    const scheduleNext = (delayMs: number | null) => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      if (delayMs != null && active) {
        pollTimer = setTimeout(() => {
          void checkAlerts('interval');
        }, delayMs);
      }
    };

    const checkAlerts = async (trigger: 'initial' | 'interval' | 'visibility' = 'interval') => {
      const prefs = loadPushPreferences();
      const { items, currentUserId } = useWatchlistStore.getState();
      const activeAlertItems = items.filter(
        (i) => !i.alertPaused && ((i.targetPrice && i.targetPrice > 0) || (i.alertPercent && i.alertPercent > 0))
      );
      const exchanges = activeAlertItems.map((i) => i.exchange || (i.assetType === 'fund' ? 'TEFAS' : 'BIST'));
      const policyEligible = prefs.priceAlerts && (prefs.enabled || prefs.inAppEnabled) && activeAlertItems.length > 0;
      const decision = evaluateRefreshPolicy({
        surface: 'watchlist_alerts',
        trigger,
        isDocumentHidden: typeof document !== 'undefined' ? document.hidden : false,
        sessionValid: policyEligible && Boolean(currentUserId),
        exchanges,
        baseIntervalMs: 60_000,
        closedIntervalMs: 300_000,
        lastFetchAtMs: lastCheckAtMs,
      });
      scheduleNext(decision.nextDelayMs);

      if (isCheckingRef.current || !policyEligible || !decision.shouldFetch) return;
      lastCheckAtMs = Date.now();

      isCheckingRef.current = true;
      try {
        const requests = buildScopedQuoteRequests(activeAlertItems, { liveOnly: true });
        if (requests.length === 0) return;

        const results = await Promise.allSettled(
          requests.map((req) => marketJson<{ data: QuotePayload[] }>(req.url, 60_000))
        );
        const current = useWatchlistStore.getState();
        if (!active || current.currentUserId !== currentUserId) return;

        const quoteMap = new Map<string, AlertPriceQuote>();
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled' || !Array.isArray(result.value.data)) return;
          const type = requests[index].kind;
          for (const quote of result.value.data) {
            const symbol = type === 'fund' ? quote.code : quote.symbol;
            if (symbol) {
              quoteMap.set(`${type}:${symbol.toUpperCase()}`, {
                price: quote.price,
                observation: quote.observation,
                exchange: quote.exchange || (type === 'fund' ? 'TEFAS' : undefined),
                isLastKnown: quote.isLastKnown,
                assetType: type,
                lastSyncAt: quote.lastSyncAt,
                navDate: quote.navDate,
              });
            }
          }
        });

        const cooldowns = loadAlertCooldowns();
        let cooldownsDirty = false;
        const checkedAtIso = new Date().toISOString();
        const configuredItems = current.items.filter(
          (i) => !i.alertPaused && ((i.targetPrice && i.targetPrice > 0) || (i.alertPercent && i.alertPercent > 0))
        );

        for (const item of configuredItems) {
          const sym = item.symbol.toUpperCase();
          const quote = quoteMap.get(`${item.assetType}:${sym}`);
          const freshness = evaluateAlertPriceFreshness(quote);
          const itemCurrency = item.alertCurrency || inferAssetAlertCurrency({
            exchange: item.exchange,
            assetType: item.assetType,
            symbol: sym,
          });

          if (!freshness.eligible) {
            recordAlertCheck({
              userId: currentUserId,
              symbol: sym,
              assetType: item.assetType,
              checkedAt: checkedAtIso,
              observedPrice: typeof quote?.price === 'number' ? quote.price : null,
              currency: itemCurrency,
              priceStatus: quote?.price ? 'deferred' : 'unavailable',
              deferralDescription: freshness.description,
              exchange: item.exchange,
            });
            recordDeferredAlert({
              symbol: sym,
              assetType: item.assetType,
              alertType: item.alertType || 'price',
              targetPrice: item.targetPrice,
              alertPercent: item.alertPercent,
              reason: freshness.reason as Exclude<AlertDeferralReason, 'ok'>,
              description: freshness.description,
              status: freshness.status,
              source: freshness.source,
              observedAt: freshness.observedAt,
              deferredAt: checkedAtIso,
            });
            const logKey = `defer:${currentUserId}:${item.assetType}:${sym}:${freshness.reason}`;
            if (Date.now() - (cooldowns[logKey] || 0) >= ALERT_COOLDOWN_MS) {
              console.warn(`[WatchlistAlertWatcher] ${sym} alarmı ertelendi (${freshness.reason}): ${freshness.description}`);
              cooldowns[logKey] = Date.now();
              cooldownsDirty = true;
            }
            continue;
          }

          clearDeferredAlert(sym, item.assetType);
          const livePrice = quote!.price!;
          recordAlertCheck({
            userId: currentUserId,
            symbol: sym,
            assetType: item.assetType,
            checkedAt: checkedAtIso,
            observedPrice: livePrice,
            currency: itemCurrency,
            priceStatus: 'live',
            exchange: item.exchange,
          });
          const check = isPriceAlertTriggered(item, livePrice, quote);
          if (check.triggered) {
            // Per-symbol + alert-type cooldown key (not price-dependent)
            const cooldownKey = JSON.stringify([currentUserId, item.assetType, sym, item.alertType, item.targetPrice, item.alertPercent]);
            const lastFired = cooldowns[cooldownKey] || 0;

            if (Date.now() - lastFired < ALERT_COOLDOWN_MS) {
              // Still in cooldown window – skip
              continue;
            }

            const delivered = sendPushNotification(
              check.title,
              check.message,
              buildAlertAssetRoute(item.assetType, sym)
            );
            if (!delivered) continue;

            recordAlertTrigger({
              userId: currentUserId,
              symbol: sym,
              assetType: item.assetType,
              triggeredAt: checkedAtIso,
              triggeredPrice: livePrice,
              triggeredTitle: check.title,
              currency: itemCurrency,
              exchange: item.exchange,
            });
            cooldowns[cooldownKey] = Date.now();
            cooldownsDirty = true;
            if (item.alertType && item.alertType !== 'price') {
              useWatchlistStore.getState().updateAlertBasePrice(sym, livePrice);
            }
          }
        }

        if (cooldownsDirty) {
          saveAlertCooldowns(cooldowns);
        }

        // ALR-11: Evaluate portfolio daily movement alerts strictly on verified valuations
        if (prefs.portfolioMoves && (prefs.enabled || prefs.inAppEnabled)) {
          const portfolioState = usePortfolioStore.getState();
          const summary = portfolioState.getSummary();
          const activePortfolio =
            portfolioState.portfolios.find((p) => p.id === portfolioState.activePortfolioId) ??
            portfolioState.portfolios[0];
          if (activePortfolio && summary.holdings.length > 0) {
            const missingSymbols = [
              ...(summary.valuationStatus?.missingPrices ?? []),
              ...(summary.valuationStatus?.missingFx ? ['USDTRY'] : []),
            ];
            const moveConfig = readPortfolioMoveConfig(currentUserId);
            const moveHistory = readPortfolioMoveHistory(currentUserId);
            const moveResult = evaluatePortfolioMoveAlerts({
              config: moveConfig,
              history: moveHistory,
              snapshots: [
                {
                  portfolioId: activePortfolio.id,
                  portfolioName: activePortfolio.name,
                  currency: 'TRY',
                  dailyChangePct: summary.dailyPnLPercent,
                  dailyChangeValue: summary.dailyPnL,
                  totalValue: summary.totalValue,
                  verifiedHoldingsCount: Math.max(
                    0,
                    summary.holdings.length - (summary.valuationStatus?.missingPrices?.length ?? 0),
                  ),
                  totalHoldingsCount: summary.holdings.length,
                  missingPriceSymbols: missingSymbols,
                  isSampleSnapshot: portfolioState.isSampleMode,
                  asOf: checkedAtIso,
                },
              ],
            });

            if (moveResult.triggered.length > 0) {
              for (const event of moveResult.triggered) {
                sendPushNotification(event.title, event.body, event.route);
              }
              writePortfolioMoveHistory(moveResult.updatedHistory, currentUserId);
            }
          }
        }
      } catch {
        // Silently catch background poll error
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Run adaptive visibility/market-aware check
    void checkAlerts('initial');

    const handleFocus = () => {
      void checkAlerts('visibility');
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      active = false;
      if (pollTimer) clearTimeout(pollTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  return null;
}

export default WatchlistAlertWatcher;
