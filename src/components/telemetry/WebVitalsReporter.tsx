'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  detectClientPlatform,
  normalizeCriticalApiEndpoint,
  normalizeTelemetryRoute,
  type CriticalApiTimingInput,
} from '@/lib/ops/performanceMonitor';
import { trackRepeatActiveDay } from '@/lib/analytics/usageMetrics';

/**
 * Passively collects LCP, INP, CLS, initial JS/CSS/document transfer weight, and critical API latencies
 * per platform (`mobile` | `desktop`) and reports sanitized samples on background/pagehide.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();
  const flushedRef = useRef(false);

  useEffect(() => {
    trackRepeatActiveDay();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
    flushedRef.current = false;

    let lcpMs: number | null = null;
    let inpMs: number | null = null;
    let clsValue = 0;
    let sessionClsValue = 0;
    let sessionGapStart = 0;
    let sessionWindowStart = 0;
    const apiTimings: CriticalApiTimingInput[] = [];
    const seenApiNames = new Set<string>();
    const observers: PerformanceObserver[] = [];

    const observeSafe = (options: PerformanceObserverInit, onEntries: (list: PerformanceObserverEntryList) => void) => {
      try {
        const obs = new PerformanceObserver(onEntries);
        obs.observe(options);
        observers.push(obs);
      } catch {
        // Unsupported entry type in current browser/WebView
      }
    };

    observeSafe({ type: 'largest-contentful-paint', buffered: true }, (list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last && Number.isFinite(last.startTime)) {
        lcpMs = Math.round(last.startTime * 10) / 10;
      }
    });

    observeSafe({ type: 'layout-shift', buffered: true }, (list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
        if (entry.hadRecentInput || typeof entry.value !== 'number') continue;
        const firstGap = entry.startTime - sessionGapStart;
        const span = entry.startTime - sessionWindowStart;
        if (sessionClsValue > 0 && firstGap < 1000 && span < 5000) {
          sessionClsValue += entry.value;
        } else {
          sessionWindowStart = entry.startTime;
          sessionClsValue = entry.value;
        }
        sessionGapStart = entry.startTime + entry.duration;
        if (sessionClsValue > clsValue) {
          clsValue = sessionClsValue;
        }
      }
    });

    observeSafe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit, (list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { interactionId?: number }>) {
        if (entry.interactionId && entry.interactionId > 0 && Number.isFinite(entry.duration)) {
          if (inpMs === null || entry.duration > inpMs) {
            inpMs = Math.round(entry.duration * 10) / 10;
          }
        }
      }
    });

    observeSafe({ type: 'resource', buffered: true }, (list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (seenApiNames.has(`${entry.name}@${entry.startTime}`)) continue;
        const normalized = normalizeCriticalApiEndpoint(entry.name);
        if (!normalized || !Number.isFinite(entry.duration)) continue;
        seenApiNames.add(`${entry.name}@${entry.startTime}`);
        apiTimings.push({
          endpoint: normalized,
          durationMs: Math.round(entry.duration * 10) / 10,
          status: typeof (entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus === 'number'
            ? (entry as PerformanceResourceTiming & { responseStatus?: number }).responseStatus
            : 200,
        });
      }
    });

    const computeInitialPayloadKb = (): number | null => {
      try {
        let totalBytes = 0;
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav) {
          totalBytes += nav.transferSize || nav.encodedBodySize || 0;
        }
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        for (const res of resources) {
          if (res.initiatorType === 'script' || res.initiatorType === 'link') {
            totalBytes += res.transferSize || res.encodedBodySize || 0;
          }
        }
        return totalBytes > 0 ? Math.round((totalBytes / 1024) * 10) / 10 : null;
      } catch {
        return null;
      }
    };

    const flush = () => {
      if (flushedRef.current) return;
      const initialPayloadKb = computeInitialPayloadKb();
      if (lcpMs === null && inpMs === null && initialPayloadKb === null && apiTimings.length === 0) return;

      flushedRef.current = true;
      const payload = JSON.stringify({
        platform: detectClientPlatform({
          userAgent: navigator.userAgent,
          viewportWidth: window.innerWidth,
        }),
        viewportWidth: window.innerWidth,
        route: normalizeTelemetryRoute(pathname),
        lcpMs,
        inpMs,
        clsScore: Math.round(clsValue * 10_000) / 10_000,
        initialPayloadKb,
        criticalApiTimings: apiTimings.slice(-15),
        recordedAt: new Date().toISOString(),
      });

      try {
        if (typeof navigator.sendBeacon === 'function') {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/ops/performance', blob);
          return;
        }
      } catch {
        // Fall through to keepalive fetch
      }

      void fetch('/api/ops/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    const onVisibility = () => {
      if (document.hidden) flush();
    };
    const onPageHide = () => flush();
    const initialFlushTimer = setTimeout(flush, 6500);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearTimeout(initialFlushTimer);
      flush();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      for (const obs of observers) obs.disconnect();
    };
  }, [pathname]);

  return null;
}
