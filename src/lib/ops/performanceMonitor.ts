export type ClientPlatform = 'mobile' | 'desktop';

export interface CriticalApiTimingInput {
  endpoint: string;
  durationMs: number;
  status?: number;
}

export interface CriticalApiTiming {
  endpoint: string;
  durationMs: number;
  status: number;
}

export interface PerformanceSample {
  platform: ClientPlatform;
  route: string;
  lcpMs: number | null;
  inpMs: number | null;
  clsScore: number | null;
  initialPayloadKb: number | null;
  criticalApiTimings: CriticalApiTiming[];
  recordedAt: string;
}

export interface MetricSummary {
  sampleCount: number;
  avg: number | null;
  p75: number | null;
  max: number | null;
  goodRatio: number | null;
}

export interface ApiEndpointSummary {
  endpoint: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface PlatformPerformanceReport {
  platform: ClientPlatform;
  sampleCount: number;
  lcpMs: MetricSummary;
  inpMs: MetricSummary;
  clsScore: MetricSummary;
  initialPayloadKb: MetricSummary;
  criticalApis: ApiEndpointSummary[];
  routes: string[];
}

export interface PlatformPerformanceSummary {
  overallSampleCount: number;
  mobile: PlatformPerformanceReport;
  desktop: PlatformPerformanceReport;
  updatedAt: string | null;
}

export const WEB_VITALS_THRESHOLDS = {
  lcpMs: 2500,
  inpMs: 200,
  clsScore: 0.1,
} as const;

const MAX_PERF_SAMPLES = 300;
const CRITICAL_API_PREFIXES = ['/api/stocks', '/api/funds', '/api/markets', '/api/news', '/api/quant', '/api/ai'] as const;

function getPerformanceStore(): PerformanceSample[] {
  const g = globalThis as typeof globalThis & { __stockmindPerfSamples?: PerformanceSample[] };
  if (!g.__stockmindPerfSamples) {
    g.__stockmindPerfSamples = [];
  }
  return g.__stockmindPerfSamples;
}

export function clearPerformanceSamples(): void {
  const store = getPerformanceStore();
  store.length = 0;
}

export function detectClientPlatform(input?: {
  userAgent?: string | null;
  viewportWidth?: number | null;
}): ClientPlatform {
  const ua = String(input?.userAgent || '');
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|StockMindAndroid/i.test(ua)) {
    return 'mobile';
  }
  if (typeof input?.viewportWidth === 'number' && Number.isFinite(input.viewportWidth) && input.viewportWidth > 0 && input.viewportWidth < 768) {
    return 'mobile';
  }
  return 'desktop';
}

export function normalizeTelemetryRoute(rawRoute: unknown): string {
  const text = String(rawRoute || '/').trim();
  const pathOnly = text.split('?')[0].split('#')[0] || '/';
  const cleaned = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  if (cleaned.startsWith('/stocks/')) return '/stocks/[symbol]';
  if (cleaned.startsWith('/funds/')) return '/funds/[code]';
  if (cleaned.startsWith('/widgets/')) return '/widgets/[id]';
  return cleaned.slice(0, 80);
}

export function normalizeCriticalApiEndpoint(rawUrl: unknown): string | null {
  const raw = String(rawUrl || '').trim();
  if (!raw) return null;
  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    pathname = raw.replace(/^https?:\/\/[^/?#]+/i, '') || '/';
  }
  pathname = pathname.split('?')[0].split('#')[0];

  for (const prefix of CRITICAL_API_PREFIXES) {
    if (pathname === prefix) return prefix;
    if (pathname.startsWith(`${prefix}/`)) {
      if (prefix === '/api/stocks') return '/api/stocks/[symbol]';
      if (prefix === '/api/funds') return '/api/funds/[code]';
      if (prefix === '/api/markets') return pathname.slice(0, 48);
      if (prefix === '/api/ai') return pathname.slice(0, 48);
      if (prefix === '/api/quant') return pathname.slice(0, 48);
      return prefix;
    }
  }
  return null;
}

function clampMetric(value: unknown, min: number, max: number, precision: number = 2): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

/**
 * Validates and strips any sensitive identifiers from incoming performance telemetry.
 */
export function sanitizePerformanceSample(raw: unknown): PerformanceSample | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const platform: ClientPlatform = record.platform === 'mobile' ? 'mobile' : 'desktop';
  const route = normalizeTelemetryRoute(record.route);

  const lcpMs = clampMetric(record.lcpMs, 0, 60_000, 1);
  const inpMs = clampMetric(record.inpMs, 0, 60_000, 1);
  const clsScore = clampMetric(record.clsScore, 0, 10, 4);
  const initialPayloadKb = clampMetric(record.initialPayloadKb, 0, 50_000, 1);

  const rawApis = Array.isArray(record.criticalApiTimings) ? record.criticalApiTimings : [];
  const criticalApiTimings: CriticalApiTiming[] = [];
  for (const item of rawApis.slice(0, 15)) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const endpoint = normalizeCriticalApiEndpoint(entry.endpoint);
    const durationMs = clampMetric(entry.durationMs, 0, 60_000, 1);
    if (!endpoint || durationMs === null) continue;
    const rawStatus = Number(entry.status);
    const status = Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : 200;
    criticalApiTimings.push({ endpoint, durationMs, status });
  }

  if (
    lcpMs === null &&
    inpMs === null &&
    clsScore === null &&
    initialPayloadKb === null &&
    criticalApiTimings.length === 0
  ) {
    return null;
  }

  return {
    platform,
    route,
    lcpMs,
    inpMs,
    clsScore,
    initialPayloadKb,
    criticalApiTimings,
    recordedAt:
      typeof record.recordedAt === 'string' && Number.isFinite(Date.parse(record.recordedAt))
        ? new Date(record.recordedAt).toISOString()
        : new Date().toISOString(),
  };
}

export function recordPerformanceSample(raw: unknown): PerformanceSample | null {
  const sample = sanitizePerformanceSample(raw);
  if (!sample) return null;
  const store = getPerformanceStore();
  store.push(sample);
  if (store.length > MAX_PERF_SAMPLES) {
    store.splice(0, store.length - MAX_PERF_SAMPLES);
  }
  return sample;
}

export function getPerformanceSamples(): PerformanceSample[] {
  return [...getPerformanceStore()];
}

function percentile(sorted: readonly number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function summarizeNumericMetric(
  values: readonly number[],
  goodThreshold?: number,
  precision: number = 1
): MetricSummary {
  if (!values.length) {
    return { sampleCount: 0, avg: null, p75: null, max: null, goodRatio: null };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const factor = Math.pow(10, precision);
  const round = (v: number) => Math.round(v * factor) / factor;

  const avg = round(sum / sorted.length);
  const p75Raw = percentile(sorted, 75);
  const p75 = p75Raw !== null ? round(p75Raw) : null;
  const max = round(sorted[sorted.length - 1]);
  const goodRatio =
    goodThreshold !== undefined
      ? Math.round((sorted.filter((v) => v <= goodThreshold).length / sorted.length) * 1000) / 1000
      : null;

  return {
    sampleCount: sorted.length,
    avg,
    p75,
    max,
    goodRatio,
  };
}

function buildPlatformReport(
  platform: ClientPlatform,
  samples: readonly PerformanceSample[]
): PlatformPerformanceReport {
  const scoped = samples.filter((s) => s.platform === platform);
  const lcpVals = scoped.map((s) => s.lcpMs).filter((v): v is number => v !== null);
  const inpVals = scoped.map((s) => s.inpMs).filter((v): v is number => v !== null);
  const clsVals = scoped.map((s) => s.clsScore).filter((v): v is number => v !== null);
  const payloadVals = scoped.map((s) => s.initialPayloadKb).filter((v): v is number => v !== null);

  const apiBuckets = new Map<string, number[]>();
  const routesSet = new Set<string>();
  for (const s of scoped) {
    routesSet.add(s.route);
    for (const api of s.criticalApiTimings) {
      const list = apiBuckets.get(api.endpoint) || [];
      list.push(api.durationMs);
      apiBuckets.set(api.endpoint, list);
    }
  }

  const criticalApis: ApiEndpointSummary[] = Array.from(apiBuckets.entries())
    .map(([endpoint, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      return {
        endpoint,
        count: sorted.length,
        avgMs: Math.round((sum / sorted.length) * 10) / 10,
        p95Ms: Math.round((percentile(sorted, 95) ?? 0) * 10) / 10,
        maxMs: Math.round(sorted[sorted.length - 1] * 10) / 10,
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms);

  return {
    platform,
    sampleCount: scoped.length,
    lcpMs: summarizeNumericMetric(lcpVals, WEB_VITALS_THRESHOLDS.lcpMs, 1),
    inpMs: summarizeNumericMetric(inpVals, WEB_VITALS_THRESHOLDS.inpMs, 1),
    clsScore: summarizeNumericMetric(clsVals, WEB_VITALS_THRESHOLDS.clsScore, 4),
    initialPayloadKb: summarizeNumericMetric(payloadVals, undefined, 1),
    criticalApis,
    routes: Array.from(routesSet).sort(),
  };
}

export function summarizePerformanceByPlatform(
  samples: readonly PerformanceSample[]
): PlatformPerformanceSummary {
  const latest =
    samples.length > 0
      ? samples.reduce((maxIso, item) => (item.recordedAt > maxIso ? item.recordedAt : maxIso), samples[0].recordedAt)
      : null;

  return {
    overallSampleCount: samples.length,
    mobile: buildPlatformReport('mobile', samples),
    desktop: buildPlatformReport('desktop', samples),
    updatedAt: latest,
  };
}

export function getPlatformPerformanceReport(): PlatformPerformanceSummary {
  return summarizePerformanceByPlatform(getPerformanceStore());
}
