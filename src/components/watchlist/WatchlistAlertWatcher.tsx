'use client';

import { useEffect, useRef } from 'react';
import { useWatchlistStore, isPriceAlertTriggered } from '@/store/useWatchlistStore';
import { sendPushNotification, loadPushPreferences } from '@/lib/notifications/pushNotification';
import { marketJson } from '@/lib/api/clientCache';
import {
  evaluateAlertPriceFreshness,
  recordDeferredAlert,
  clearDeferredAlert,
  type AlertDeferralReason,
  type AlertPriceQuote,
} from '@/lib/market/alertFreshness';
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
    const checkAlerts = async () => {
      const prefs = loadPushPreferences();
      if (isCheckingRef.current || document.hidden || !prefs.priceAlerts || (!prefs.enabled && !prefs.inAppEnabled)) return;
      const { items, currentUserId } = useWatchlistStore.getState();
      const activeAlertItems = items.filter(
        (i) => (i.targetPrice && i.targetPrice > 0) || (i.alertPercent && i.alertPercent > 0)
      );

      if (activeAlertItems.length === 0) return;

      isCheckingRef.current = true;
      try {
        const types = Array.from(new Set(activeAlertItems.map(item => item.assetType)));
        const results = await Promise.allSettled(types.map(type =>
          marketJson<{ data: QuotePayload[] }>(type === 'fund' ? '/api/funds' : '/api/stocks?liveOnly=true', 60_000)
        ));
        const current = useWatchlistStore.getState();
        if (!active || current.currentUserId !== currentUserId) return;

        const quoteMap = new Map<string, AlertPriceQuote>();
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled' || !Array.isArray(result.value.data)) return;
          const type = types[index];
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
        const configuredItems = current.items.filter(
          (i) => (i.targetPrice && i.targetPrice > 0) || (i.alertPercent && i.alertPercent > 0)
        );

        for (const item of configuredItems) {
          const sym = item.symbol.toUpperCase();
          const quote = quoteMap.get(`${item.assetType}:${sym}`);
          const freshness = evaluateAlertPriceFreshness(quote);

          if (!freshness.eligible) {
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
              deferredAt: new Date().toISOString(),
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
              item.assetType === 'fund' ? `/funds/${encodeURIComponent(sym)}` : `/stocks/${encodeURIComponent(sym)}`
            );
            if (!delivered) continue;

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
      } catch {
        // Silently catch background poll error
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Run check on mount and every 60s
    checkAlerts();
    const interval = setInterval(checkAlerts, 60_000);

    const handleFocus = () => {
      checkAlerts();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  return null;
}

export default WatchlistAlertWatcher;
