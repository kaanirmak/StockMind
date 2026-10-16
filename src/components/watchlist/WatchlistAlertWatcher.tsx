'use client';

import { useEffect, useRef } from 'react';
import { useWatchlistStore, isPriceAlertTriggered } from '@/store/useWatchlistStore';
import { sendPushNotification, loadPushPreferences } from '@/lib/notifications/pushNotification';

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

    const checkAlerts = async () => {
      if (isCheckingRef.current || document.hidden || !loadPushPreferences().priceAlerts) return;
      const { items } = useWatchlistStore.getState();
      const activeAlertItems = items.filter(
        (i) => (i.targetPrice && i.targetPrice > 0) || (i.alertPercent && i.alertPercent > 0)
      );

      if (activeAlertItems.length === 0) return;

      isCheckingRef.current = true;
      try {
        const res = await fetch('/api/stocks', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const stockList: Array<{ symbol: string; price: number }> = json?.data || [];
        if (!Array.isArray(stockList) || stockList.length === 0) return;

        const priceMap = new Map<string, number>();
        for (const s of stockList) {
          if (s.symbol && typeof s.price === 'number') {
            priceMap.set(s.symbol.toUpperCase(), s.price);
          }
        }

        const cooldowns = loadAlertCooldowns();
        let cooldownsDirty = false;

        for (const item of activeAlertItems) {
          const sym = item.symbol.toUpperCase();
          const livePrice = priceMap.get(sym);
          if (!livePrice || livePrice <= 0) continue;

          const check = isPriceAlertTriggered(item, livePrice);
          if (check.triggered) {
            // Per-symbol + alert-type cooldown key (not price-dependent)
            const cooldownKey = `${sym}_${item.alertType || 'price'}`;
            const lastFired = cooldowns[cooldownKey] || 0;

            if (Date.now() - lastFired < ALERT_COOLDOWN_MS) {
              // Still in cooldown window – skip
              continue;
            }

            // Mark cooldown
            cooldowns[cooldownKey] = Date.now();
            cooldownsDirty = true;

            // Send the notification
            sendPushNotification(
              check.title,
              check.message,
              item.assetType === 'fund' ? `/funds/${item.symbol}` : `/stocks/${item.symbol}`
            );

            // KEY FIX: Update the base price to the current live price so the
            // same threshold doesn't re-trigger on the next poll cycle.
            // The alarm stays active but is now anchored to the new price.
            useWatchlistStore.getState().updateAlertBasePrice(sym, livePrice);
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

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return null;
}

export default WatchlistAlertWatcher;
