'use client';

import { useEffect, useRef } from 'react';
import { useWatchlistStore, isPriceAlertTriggered } from '@/store/useWatchlistStore';
import { sendPushNotification, loadPushPreferences } from '@/lib/notifications/pushNotification';
import { marketJson } from '@/lib/api/clientCache';

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
        type Quote = { symbol?: string; code?: string; price: number; lastSyncAt?: string };
        const types = Array.from(new Set(activeAlertItems.map(item => item.assetType)));
        const results = await Promise.allSettled(types.map(type =>
          marketJson<{ data: Quote[] }>(type === 'fund' ? '/api/funds' : '/api/stocks?liveOnly=true', 60_000)
        ));
        const current = useWatchlistStore.getState();
        if (!active || current.currentUserId !== currentUserId) return;

        const priceMap = new Map<string, number>();
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled' || !Array.isArray(result.value.data)) return;
          const type = types[index];
          for (const quote of result.value.data) {
            const symbol = type === 'fund' ? quote.code : quote.symbol;
            if (symbol && Number.isFinite(quote.price) && quote.price > 0 &&
                (type !== 'fund' || quote.lastSyncAt)) {
              priceMap.set(`${type}:${symbol.toUpperCase()}`, quote.price);
            }
          }
        });

        const cooldowns = loadAlertCooldowns();
        let cooldownsDirty = false;

        for (const item of current.items) {
          const sym = item.symbol.toUpperCase();
          const livePrice = priceMap.get(`${item.assetType}:${sym}`);
          if (!livePrice || livePrice <= 0) continue;

          const check = isPriceAlertTriggered(item, livePrice);
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
      } catch (err) {
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
