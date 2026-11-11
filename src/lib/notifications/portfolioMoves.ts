export type PortfolioMoveDirection = 'both' | 'gain' | 'loss';
export type PortfolioMoveFrequency = 'realtime' | 'hourly' | 'daily';

export interface PortfolioMoveAlertConfig {
  enabled: boolean;
  thresholdPct: number;
  direction: PortfolioMoveDirection;
  frequency: PortfolioMoveFrequency;
}

export const DEFAULT_PORTFOLIO_MOVE_CONFIG: PortfolioMoveAlertConfig = {
  enabled: true,
  thresholdPct: 3,
  direction: 'both',
  frequency: 'daily',
};

export interface VerifiedPortfolioValuationSnapshot {
  portfolioId: string;
  portfolioName: string;
  currency: 'TRY' | 'USD';
  dailyChangePct: number | null;
  dailyChangeValue: number | null;
  totalValue: number;
  verifiedHoldingsCount: number;
  totalHoldingsCount: number;
  missingPriceSymbols: readonly string[];
  isSampleSnapshot?: boolean;
  asOf?: string;
}

export interface PortfolioMoveDispatchRecord {
  portfolioId: string;
  lastSentAt: string;
  lastSentDayKey: string;
  lastDirection: 'gain' | 'loss';
  lastTriggeredPct: number;
  frequency: PortfolioMoveFrequency;
}

export type PortfolioMoveHistoryMap = Record<string, PortfolioMoveDispatchRecord>;

export interface PortfolioMoveTriggerEvent {
  portfolioId: string;
  portfolioName: string;
  direction: 'gain' | 'loss';
  dailyChangePct: number;
  dailyChangeValue: number | null;
  currency: 'TRY' | 'USD';
  thresholdPct: number;
  frequency: PortfolioMoveFrequency;
  verifiedHoldingsCount: number;
  asOf: string;
  title: string;
  body: string;
  route: string;
}

export interface PortfolioMoveEvaluationResult {
  triggered: PortfolioMoveTriggerEvent[];
  skipped: Array<{ portfolioId: string; reason: string }>;
  updatedHistory: PortfolioMoveHistoryMap;
}

const CONFIG_STORAGE_PREFIX = 'stockmind_portfolio_move_alert_cfg';
const HISTORY_STORAGE_PREFIX = 'stockmind_portfolio_move_alert_hist';

export const PORTFOLIO_MOVE_FREQUENCY_COOLDOWN_MS: Record<PortfolioMoveFrequency, number> = {
  realtime: 30 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

export const PORTFOLIO_MOVE_FREQUENCY_LABELS: Record<PortfolioMoveFrequency, string> = {
  realtime: 'Anlık (30 dk bekleme)',
  hourly: 'Saatlik en fazla 1 bildirim',
  daily: 'Günde en fazla 1 bildirim',
};

function getConfigKey(userId?: string | null): string {
  const id = typeof userId === 'string' && userId.trim() ? userId.trim() : 'guest';
  return `${CONFIG_STORAGE_PREFIX}:${id}`;
}

function getHistoryKey(userId?: string | null): string {
  const id = typeof userId === 'string' && userId.trim() ? userId.trim() : 'guest';
  return `${HISTORY_STORAGE_PREFIX}:${id}`;
}

export function normalizePortfolioMoveConfig(
  raw: Partial<PortfolioMoveAlertConfig> | null | undefined,
): PortfolioMoveAlertConfig {
  const threshold = Number(raw?.thresholdPct);
  const clampedThreshold =
    Number.isFinite(threshold) && threshold >= 0.5 && threshold <= 50
      ? Number(threshold.toFixed(1))
      : DEFAULT_PORTFOLIO_MOVE_CONFIG.thresholdPct;

  const direction: PortfolioMoveDirection =
    raw?.direction === 'gain' || raw?.direction === 'loss' || raw?.direction === 'both'
      ? raw.direction
      : DEFAULT_PORTFOLIO_MOVE_CONFIG.direction;

  const frequency: PortfolioMoveFrequency =
    raw?.frequency === 'realtime' || raw?.frequency === 'hourly' || raw?.frequency === 'daily'
      ? raw.frequency
      : DEFAULT_PORTFOLIO_MOVE_CONFIG.frequency;

  return {
    enabled:
      typeof raw?.enabled === 'boolean'
        ? raw.enabled
        : DEFAULT_PORTFOLIO_MOVE_CONFIG.enabled,
    thresholdPct: clampedThreshold,
    direction,
    frequency,
  };
}

export function readPortfolioMoveConfig(
  userId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): PortfolioMoveAlertConfig {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!store) return { ...DEFAULT_PORTFOLIO_MOVE_CONFIG };
  try {
    const raw = store.getItem(getConfigKey(userId));
    if (!raw) return { ...DEFAULT_PORTFOLIO_MOVE_CONFIG };
    return normalizePortfolioMoveConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PORTFOLIO_MOVE_CONFIG };
  }
}

export function writePortfolioMoveConfig(
  config: PortfolioMoveAlertConfig,
  userId?: string | null,
  storage?: Pick<Storage, 'setItem'> | null,
): PortfolioMoveAlertConfig {
  const normalized = normalizePortfolioMoveConfig(config);
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (store) {
    try {
      store.setItem(getConfigKey(userId), JSON.stringify(normalized));
    } catch {
      /* ignore */
    }
  }
  return normalized;
}

export function readPortfolioMoveHistory(
  userId?: string | null,
  storage?: Pick<Storage, 'getItem'> | null,
): PortfolioMoveHistoryMap {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!store) return {};
  try {
    const raw = store.getItem(getHistoryKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as PortfolioMoveHistoryMap)
      : {};
  } catch {
    return {};
  }
}

export function writePortfolioMoveHistory(
  history: PortfolioMoveHistoryMap,
  userId?: string | null,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;
  if (!store) return;
  try {
    store.setItem(getHistoryKey(userId), JSON.stringify(history));
  } catch {
    /* ignore */
  }
}

function getIstanbulDayKey(now: Date): string {
  try {
    return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isVerifiedPortfolioValuation(
  snapshot: VerifiedPortfolioValuationSnapshot,
): { verified: boolean; reason?: string } {
  if (snapshot.isSampleSnapshot) {
    return { verified: false, reason: 'sample-snapshot' };
  }
  if (snapshot.totalHoldingsCount <= 0 || snapshot.verifiedHoldingsCount <= 0) {
    return { verified: false, reason: 'no-verified-holdings' };
  }
  if (snapshot.missingPriceSymbols.length > 0 || snapshot.verifiedHoldingsCount < snapshot.totalHoldingsCount) {
    return { verified: false, reason: 'incomplete-price-coverage' };
  }
  if (!Number.isFinite(snapshot.totalValue) || snapshot.totalValue <= 0) {
    return { verified: false, reason: 'zero-or-invalid-valuation' };
  }
  if (typeof snapshot.dailyChangePct !== 'number' || !Number.isFinite(snapshot.dailyChangePct)) {
    return { verified: false, reason: 'missing-daily-change' };
  }
  return { verified: true };
}

export function evaluatePortfolioMoveAlerts(input: {
  config: PortfolioMoveAlertConfig;
  snapshots: readonly VerifiedPortfolioValuationSnapshot[];
  history?: PortfolioMoveHistoryMap;
  now?: Date;
}): PortfolioMoveEvaluationResult {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const dayKey = getIstanbulDayKey(now);
  const config = normalizePortfolioMoveConfig(input.config);
  const updatedHistory: PortfolioMoveHistoryMap = { ...(input.history ?? {}) };
  const triggered: PortfolioMoveTriggerEvent[] = [];
  const skipped: Array<{ portfolioId: string; reason: string }> = [];

  if (!config.enabled) {
    for (const snap of input.snapshots) {
      skipped.push({ portfolioId: snap.portfolioId, reason: 'disabled' });
    }
    return { triggered, skipped, updatedHistory };
  }

  const cooldownMs = PORTFOLIO_MOVE_FREQUENCY_COOLDOWN_MS[config.frequency];

  for (const snap of input.snapshots) {
    const verdict = isVerifiedPortfolioValuation(snap);
    if (!verdict.verified || snap.dailyChangePct == null) {
      skipped.push({
        portfolioId: snap.portfolioId,
        reason: verdict.reason || 'unverified-valuation',
      });
      continue;
    }

    const changePct = snap.dailyChangePct;
    const absPct = Math.abs(changePct);
    const moveDirection: 'gain' | 'loss' = changePct >= 0 ? 'gain' : 'loss';

    if (absPct < config.thresholdPct) {
      skipped.push({ portfolioId: snap.portfolioId, reason: 'below-threshold' });
      continue;
    }

    if (config.direction !== 'both' && config.direction !== moveDirection) {
      skipped.push({ portfolioId: snap.portfolioId, reason: 'direction-filtered' });
      continue;
    }

    const prev = updatedHistory[snap.portfolioId];
    if (prev) {
      const prevMs = Date.parse(prev.lastSentAt);
      const elapsed = Number.isFinite(prevMs) ? nowMs - prevMs : Number.POSITIVE_INFINITY;
      const sameDayDailyLimit = config.frequency === 'daily' && prev.lastSentDayKey === dayKey;
      const withinCooldown = elapsed < cooldownMs;
      const materialStepIncrease =
        prev.lastDirection === moveDirection &&
        absPct - Math.abs(prev.lastTriggeredPct) >= config.thresholdPct;

      if ((sameDayDailyLimit || withinCooldown) && !materialStepIncrease) {
        skipped.push({ portfolioId: snap.portfolioId, reason: 'throttled-by-frequency' });
        continue;
      }
    }

    const sign = changePct >= 0 ? '+' : '';
    const currencySymbol = snap.currency === 'USD' ? '$' : '₺';
    const valChangeText =
      typeof snap.dailyChangeValue === 'number' && Number.isFinite(snap.dailyChangeValue)
        ? ` (${snap.dailyChangeValue >= 0 ? '+' : '-'}${currencySymbol}${Math.abs(snap.dailyChangeValue).toLocaleString('tr-TR', { maximumFractionDigits: 0 })})`
        : '';

    const title = `Portföy Hareketi: ${snap.portfolioName} ${sign}${changePct.toFixed(2)}%`;
    const body = `${snap.portfolioName} günlük değişimi ${sign}${changePct.toFixed(2)}%${valChangeText} ile %${config.thresholdPct} eşiğini aştı (${snap.verifiedHoldingsCount}/${snap.totalHoldingsCount} doğrulanmış varlık).`;

    triggered.push({
      portfolioId: snap.portfolioId,
      portfolioName: snap.portfolioName,
      direction: moveDirection,
      dailyChangePct: Number(changePct.toFixed(2)),
      dailyChangeValue: snap.dailyChangeValue,
      currency: snap.currency,
      thresholdPct: config.thresholdPct,
      frequency: config.frequency,
      verifiedHoldingsCount: snap.verifiedHoldingsCount,
      asOf: snap.asOf || now.toISOString(),
      title,
      body,
      route: '/portfolio',
    });

    updatedHistory[snap.portfolioId] = {
      portfolioId: snap.portfolioId,
      lastSentAt: now.toISOString(),
      lastSentDayKey: dayKey,
      lastDirection: moveDirection,
      lastTriggeredPct: Number(changePct.toFixed(2)),
      frequency: config.frequency,
    };
  }

  return { triggered, skipped, updatedHistory };
}

