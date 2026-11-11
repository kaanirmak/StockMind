import type { BulletinScheduleSummary } from '@/lib/email/scheduleMonitor';

export type ProviderHealthChannel = 'stocks' | 'funds' | 'news' | 'alerts';
export type ChannelStatus = 'healthy' | 'degraded' | 'unknown';
export type BulletinDelayStatus = 'on_time' | 'delayed' | 'missed' | 'no_runs';

export interface ProviderChannelSnapshot {
  channel: ProviderHealthChannel;
  label: string;
  status: ChannelStatus;
  lastSuccessAt: string | null;
  lastProvider: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  successCount: number;
  errorCount: number;
}

export interface AlertErrorEventSummary {
  at: string;
  code: string;
  summary: string;
}

export interface OperationalHealthSummary {
  generatedAt: string;
  overallStatus: 'healthy' | 'degraded' | 'unknown';
  channels: Record<ProviderHealthChannel, ProviderChannelSnapshot>;
  bulletin: {
    status: BulletinDelayStatus;
    latestBulletinDate: string | null;
    scheduleDelayMs: number | null;
    durationMs: number | null;
    missedCount: number;
    missedDates: string[];
  };
  recentAlertErrors: AlertErrorEventSummary[];
}

const CHANNEL_LABELS: Record<ProviderHealthChannel, string> = {
  stocks: 'Hisse Fiyat Sağlayıcı',
  funds: 'TEFAS Fon Sağlayıcı',
  news: 'Haber & KAP Akışı',
  alerts: 'Alarm Değerlendirme & Gönderim',
};

const BULLETIN_DELAY_WARN_MS = 15 * 60 * 1000;
const MAX_ALERT_ERROR_HISTORY = 12;

interface ProviderHealthState {
  channels: Record<ProviderHealthChannel, ProviderChannelSnapshot>;
  recentAlertErrors: AlertErrorEventSummary[];
}

function createEmptyChannel(channel: ProviderHealthChannel): ProviderChannelSnapshot {
  return {
    channel,
    label: CHANNEL_LABELS[channel],
    status: 'unknown',
    lastSuccessAt: null,
    lastProvider: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorSummary: null,
    successCount: 0,
    errorCount: 0,
  };
}

function getHealthState(): ProviderHealthState {
  const g = globalThis as typeof globalThis & { __stockmindProviderHealth?: ProviderHealthState };
  if (!g.__stockmindProviderHealth) {
    g.__stockmindProviderHealth = {
      channels: {
        stocks: createEmptyChannel('stocks'),
        funds: createEmptyChannel('funds'),
        news: createEmptyChannel('news'),
        alerts: createEmptyChannel('alerts'),
      },
      recentAlertErrors: [],
    };
  }
  return g.__stockmindProviderHealth;
}

export function resetProviderHealthTelemetry(): void {
  const state = getHealthState();
  state.channels = {
    stocks: createEmptyChannel('stocks'),
    funds: createEmptyChannel('funds'),
    news: createEmptyChannel('news'),
    alerts: createEmptyChannel('alerts'),
  };
  state.recentAlertErrors = [];
}

/**
 * Strips emails, credentials, bearer/API tokens, connection strings, and query secrets
 * so operational diagnostics remain non-sensitive.
 */
export function sanitizeOperationalNote(raw: unknown, maxLen: number = 140): string {
  const text = raw instanceof Error ? raw.message : String(raw || '');
  const sanitized = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(/\b(?:sk-|pk_|sb_|AIza|ghp_|re_)[A-Za-z0-9_-]{6,}\b/g, '[REDACTED_KEY]')
    .replace(/\b([a-z]+:\/\/)[^@\s]+@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:key|apikey|api_key|token|secret|password|pass|auth)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return 'Bilinmeyen servis hatası';
  return sanitized.length > maxLen ? `${sanitized.slice(0, maxLen - 3)}...` : sanitized;
}

function sanitizeErrorCode(code: unknown): string {
  const raw = String(code || 'PROVIDER_ERROR').toUpperCase().replace(/[^A-Z0-9_:-]/g, '_');
  return (raw || 'PROVIDER_ERROR').slice(0, 48);
}

export function recordProviderSuccess(
  channel: ProviderHealthChannel,
  providerLabel?: string | null,
  at: Date = new Date()
): ProviderChannelSnapshot {
  const state = getHealthState();
  const entry = state.channels[channel];
  entry.successCount += 1;
  entry.lastSuccessAt = at.toISOString();
  entry.lastProvider = providerLabel ? sanitizeOperationalNote(providerLabel, 48) : entry.lastProvider;
  entry.status = 'healthy';
  return { ...entry };
}

export function recordProviderFailure(
  channel: ProviderHealthChannel,
  error: unknown,
  code: string = 'UPSTREAM_ERROR',
  at: Date = new Date()
): ProviderChannelSnapshot {
  const state = getHealthState();
  const entry = state.channels[channel];
  const atIso = at.toISOString();
  const safeCode = sanitizeErrorCode(code);
  const safeSummary = sanitizeOperationalNote(error);

  entry.errorCount += 1;
  entry.lastErrorAt = atIso;
  entry.lastErrorCode = safeCode;
  entry.lastErrorSummary = safeSummary;
  entry.status = 'degraded';

  if (channel === 'alerts') {
    state.recentAlertErrors.unshift({
      at: atIso,
      code: safeCode,
      summary: safeSummary,
    });
    if (state.recentAlertErrors.length > MAX_ALERT_ERROR_HISTORY) {
      state.recentAlertErrors.length = MAX_ALERT_ERROR_HISTORY;
    }
  }

  return { ...entry };
}

export function buildOperationalHealthSummary(input?: {
  bulletinScheduleSummary?: BulletinScheduleSummary | null;
  now?: Date;
}): OperationalHealthSummary {
  const state = getHealthState();
  const now = input?.now ?? new Date();
  const sched = input?.bulletinScheduleSummary ?? null;

  let bulletinStatus: BulletinDelayStatus = 'no_runs';
  if (sched && sched.missedCount > 0) {
    bulletinStatus = 'missed';
  } else if (sched?.latestRun) {
    const delay = sched.latestRun.scheduleDelayMs ?? 0;
    bulletinStatus =
      sched.latestRun.status === 'failed' || delay > BULLETIN_DELAY_WARN_MS
        ? 'delayed'
        : 'on_time';
  }

  const channelsCopy: Record<ProviderHealthChannel, ProviderChannelSnapshot> = {
    stocks: { ...state.channels.stocks },
    funds: { ...state.channels.funds },
    news: { ...state.channels.news },
    alerts: { ...state.channels.alerts },
  };

  const statuses = Object.values(channelsCopy).map((c) => c.status);
  const hasDegraded =
    statuses.includes('degraded') ||
    bulletinStatus === 'missed' ||
    bulletinStatus === 'delayed';
  const hasHealthy = statuses.includes('healthy') || bulletinStatus === 'on_time';

  return {
    generatedAt: now.toISOString(),
    overallStatus: hasDegraded ? 'degraded' : hasHealthy ? 'healthy' : 'unknown',
    channels: channelsCopy,
    bulletin: {
      status: bulletinStatus,
      latestBulletinDate: sched?.latestRun?.bulletinDate ?? null,
      scheduleDelayMs: sched?.latestRun?.scheduleDelayMs ?? null,
      durationMs: sched?.latestRun?.durationMs ?? null,
      missedCount: sched?.missedCount ?? 0,
      missedDates: sched?.missedDates ? [...sched.missedDates] : [],
    },
    recentAlertErrors: state.recentAlertErrors.map((item) => ({ ...item })),
  };
}
