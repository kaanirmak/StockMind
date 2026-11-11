import { getMarketSessionStatus } from '@/lib/market/marketSession';

export type RefreshSurface =
  | 'portfolio'
  | 'market_overview'
  | 'watchlist_quotes'
  | 'watchlist_alerts'
  | 'watchlist_sync';

export type RefreshTrigger = 'initial' | 'interval' | 'visibility' | 'manual';

export type RefreshSkipReason =
  | 'active'
  | 'hidden_tab'
  | 'invalid_session'
  | 'market_closed';

export interface RefreshPolicyInput {
  surface: RefreshSurface;
  trigger?: RefreshTrigger;
  isDocumentHidden?: boolean;
  sessionValid?: boolean;
  exchanges?: Array<string | null | undefined>;
  baseIntervalMs: number;
  closedIntervalMs?: number;
  lastFetchAtMs?: number | null;
  now?: Date;
}

export interface RefreshPolicyDecision {
  shouldFetch: boolean;
  reason: RefreshSkipReason;
  nextDelayMs: number | null;
  isMarketOpen: boolean;
  throttled: boolean;
}

export interface SurfaceRefreshMetrics {
  evaluations: number;
  executed: number;
  skippedHiddenTab: number;
  skippedInvalidSession: number;
  throttledClosedMarket: number;
  skippedClosedCooldown: number;
  lastReason: RefreshSkipReason | null;
  lastDelayMs: number | null;
  lastEvaluatedAt: string | null;
}

export interface RefreshTelemetrySnapshot {
  totals: {
    evaluations: number;
    executed: number;
    skippedHiddenTab: number;
    skippedInvalidSession: number;
    throttledClosedMarket: number;
    skippedClosedCooldown: number;
    avoidedRequestsEstimate: number;
  };
  bySurface: Record<RefreshSurface, SurfaceRefreshMetrics>;
  sessionMarkedInvalid: boolean;
}

const TELEMETRY_STORAGE_KEY = 'stockmind_refresh_telemetry_v1';

const ALL_SURFACES: RefreshSurface[] = [
  'portfolio',
  'market_overview',
  'watchlist_quotes',
  'watchlist_alerts',
  'watchlist_sync',
];

function createEmptySurfaceMetrics(): SurfaceRefreshMetrics {
  return {
    evaluations: 0,
    executed: 0,
    skippedHiddenTab: 0,
    skippedInvalidSession: 0,
    throttledClosedMarket: 0,
    skippedClosedCooldown: 0,
    lastReason: null,
    lastDelayMs: null,
    lastEvaluatedAt: null,
  };
}

interface TelemetryState {
  bySurface: Record<RefreshSurface, SurfaceRefreshMetrics>;
  sessionMarkedInvalid: boolean;
}

function getTelemetryState(): TelemetryState {
  const g = globalThis as typeof globalThis & { __stockmindRefreshTelemetry?: TelemetryState };
  if (!g.__stockmindRefreshTelemetry) {
    const initial: Record<RefreshSurface, SurfaceRefreshMetrics> = {
      portfolio: createEmptySurfaceMetrics(),
      market_overview: createEmptySurfaceMetrics(),
      watchlist_quotes: createEmptySurfaceMetrics(),
      watchlist_alerts: createEmptySurfaceMetrics(),
      watchlist_sync: createEmptySurfaceMetrics(),
    };
    g.__stockmindRefreshTelemetry = {
      bySurface: initial,
      sessionMarkedInvalid: false,
    };
  }
  return g.__stockmindRefreshTelemetry;
}

export function resetRefreshTelemetry(): void {
  const state = getTelemetryState();
  for (const s of ALL_SURFACES) {
    state.bySurface[s] = createEmptySurfaceMetrics();
  }
  state.sessionMarkedInvalid = false;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(TELEMETRY_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export function markSessionInvalid(invalid: boolean = true): void {
  getTelemetryState().sessionMarkedInvalid = invalid;
}

export function isSessionMarkedInvalid(): boolean {
  return getTelemetryState().sessionMarkedInvalid;
}

export function areTrackedMarketsOpen(
  exchanges?: Array<string | null | undefined>,
  now: Date = new Date()
): boolean {
  const normalized = (exchanges || [])
    .map((ex) => (typeof ex === 'string' ? ex.trim().toUpperCase() : ''))
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized.some((exchange) => getMarketSessionStatus({ exchange, now }).isOpen);
  }

  return (
    getMarketSessionStatus({ exchange: 'BIST', now }).isOpen ||
    getMarketSessionStatus({ exchange: 'NASDAQ', now }).isOpen
  );
}

/**
 * Evaluates whether a client surface should poll live quotes immediately and computes the adaptive next delay.
 * Pauses on hidden tabs or invalid sessions, and throttles background refreshes when tracked markets are closed.
 */
export function evaluateRefreshPolicy(input: RefreshPolicyInput): RefreshPolicyDecision {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const trigger = input.trigger ?? 'interval';
  const hidden =
    input.isDocumentHidden !== undefined
      ? input.isDocumentHidden
      : typeof document !== 'undefined'
        ? document.hidden
        : false;

  const sessionValid =
    input.sessionValid !== undefined
      ? input.sessionValid && !isSessionMarkedInvalid()
      : !isSessionMarkedInvalid();

  const isMarketOpen = areTrackedMarketsOpen(input.exchanges, now);
  const closedIntervalMs = Math.max(input.closedIntervalMs ?? input.baseIntervalMs * 4, 180_000);

  if (hidden) {
    const decision: RefreshPolicyDecision = {
      shouldFetch: false,
      reason: 'hidden_tab',
      nextDelayMs: null,
      isMarketOpen,
      throttled: true,
    };
    recordRefreshDecision(input.surface, decision, now);
    return decision;
  }

  if (!sessionValid) {
    const decision: RefreshPolicyDecision = {
      shouldFetch: false,
      reason: 'invalid_session',
      nextDelayMs: null,
      isMarketOpen,
      throttled: true,
    };
    recordRefreshDecision(input.surface, decision, now);
    return decision;
  }

  if (!isMarketOpen) {
    const lastMs = typeof input.lastFetchAtMs === 'number' && Number.isFinite(input.lastFetchAtMs) ? input.lastFetchAtMs : null;
    const elapsedSinceLast = lastMs != null ? Math.max(0, nowMs - lastMs) : null;
    const withinClosedCooldown =
      elapsedSinceLast != null && elapsedSinceLast < closedIntervalMs * 0.9;

    const shouldFetch =
      trigger === 'manual' ||
      trigger === 'initial' ||
      (trigger === 'visibility' && !withinClosedCooldown) ||
      (trigger === 'interval' && !withinClosedCooldown);

    const decision: RefreshPolicyDecision = {
      shouldFetch,
      reason: 'market_closed',
      nextDelayMs: closedIntervalMs,
      isMarketOpen: false,
      throttled: true,
    };
    recordRefreshDecision(input.surface, decision, now, !shouldFetch);
    return decision;
  }

  const decision: RefreshPolicyDecision = {
    shouldFetch: true,
    reason: 'active',
    nextDelayMs: input.baseIntervalMs,
    isMarketOpen: true,
    throttled: false,
  };
  recordRefreshDecision(input.surface, decision, now);
  return decision;
}

export function recordRefreshDecision(
  surface: RefreshSurface,
  decision: RefreshPolicyDecision,
  now: Date = new Date(),
  skippedClosedCooldown: boolean = false
): void {
  const state = getTelemetryState();
  const metric = state.bySurface[surface];
  if (!metric) return;

  metric.evaluations += 1;
  if (decision.shouldFetch) {
    metric.executed += 1;
  }
  if (decision.reason === 'hidden_tab') {
    metric.skippedHiddenTab += 1;
  } else if (decision.reason === 'invalid_session') {
    metric.skippedInvalidSession += 1;
  } else if (decision.reason === 'market_closed') {
    metric.throttledClosedMarket += 1;
    if (skippedClosedCooldown) {
      metric.skippedClosedCooldown += 1;
    }
  }
  metric.lastReason = decision.reason;
  metric.lastDelayMs = decision.nextDelayMs;
  metric.lastEvaluatedAt = now.toISOString();

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(getRefreshTelemetry()));
    } catch {
      // Ignore storage write quota errors
    }
  }
}

export function getRefreshTelemetry(): RefreshTelemetrySnapshot {
  const state = getTelemetryState();
  const totals = {
    evaluations: 0,
    executed: 0,
    skippedHiddenTab: 0,
    skippedInvalidSession: 0,
    throttledClosedMarket: 0,
    skippedClosedCooldown: 0,
    avoidedRequestsEstimate: 0,
  };

  const copyBySurface = {} as Record<RefreshSurface, SurfaceRefreshMetrics>;
  for (const s of ALL_SURFACES) {
    const m = { ...state.bySurface[s] };
    copyBySurface[s] = m;
    totals.evaluations += m.evaluations;
    totals.executed += m.executed;
    totals.skippedHiddenTab += m.skippedHiddenTab;
    totals.skippedInvalidSession += m.skippedInvalidSession;
    totals.throttledClosedMarket += m.throttledClosedMarket;
    totals.skippedClosedCooldown += m.skippedClosedCooldown;
  }

  totals.avoidedRequestsEstimate =
    totals.skippedHiddenTab + totals.skippedInvalidSession + totals.skippedClosedCooldown;

  return {
    totals,
    bySurface: copyBySurface,
    sessionMarkedInvalid: state.sessionMarkedInvalid,
  };
}
