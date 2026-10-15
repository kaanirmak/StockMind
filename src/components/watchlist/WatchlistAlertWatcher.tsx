'use client';

import { useEffect, useRef } from 'react';
import { useWatchlistStore, isPriceAlertTriggered } from '@/store/useWatchlistStore';
import { sendPushNotification, loadPushPreferences } from '@/lib/notifications/pushNotification';

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

        for (const item of activeAlertItems) {
          const sym = item.symbol.toUpperCase();
          const livePrice = priceMap.get(sym);
          if (!livePrice || livePrice <= 0) continue;

          const check = isPriceAlertTriggered(item, livePrice);
          if (check.triggered) {
            const cooldownKey = `stockmind_alert_sent_${sym}_${(livePrice * 10).toFixed(0)}_${item.alertType || 'price'}`;
            if (!sessionStorage.getItem(cooldownKey)) {
              sessionStorage.setItem(cooldownKey, Date.now().toString());
              sendPushNotification(check.title, check.message, item.assetType === 'fund' ? `/funds/${item.symbol}` : `/stocks/${item.symbol}`);
            }
          }
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
