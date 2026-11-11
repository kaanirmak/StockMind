export type LoadProfileName = 'typical' | 'heavy';

export interface LoadTestProfile {
  name: LoadProfileName;
  label: string;
  concurrency: number;
  iterationsPerTarget: number;
  maxP95Ms: number;
  maxErrorRate: number;
  description: string;
}

export interface LoadTargetSpec {
  id: string;
  category: 'market' | 'portfolio';
  method: 'GET';
  path: string;
  description: string;
}

export interface EndpointInvocationResult {
  ok: boolean;
  status: number;
  durationMs: number;
  providerCalls: number;
  cacheHit?: boolean;
  error?: string;
}

export interface LatencyPercentiles {
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface TargetLoadReport {
  targetId: string;
  category: 'market' | 'portfolio';
  path: string;
  requests: number;
  successes: number;
  failures: number;
  errorRate: number;
  cacheHits: number;
  providerCalls: number;
  providerCallsPerRequest: number;
  latencyMs: LatencyPercentiles;
}

export interface ProfileLoadReport {
  profile: LoadTestProfile;
  totalRequests: number;
  succeededRequests: number;
  failedRequests: number;
  errorRate: number;
  totalDurationMs: number;
  throughputRps: number;
  totalProviderCalls: number;
  providerCallsPerRequest: number;
  dedupSavingsRatio: number;
  latencyMs: LatencyPercentiles;
  byTarget: TargetLoadReport[];
  slaPassed: boolean;
  slaViolations: string[];
}

export interface ApiLoadTestReport {
  generatedAt: string;
  mode: 'live-http' | 'instrumented-local';
  baseUrl?: string;
  targets: LoadTargetSpec[];
  profiles: ProfileLoadReport[];
  overallPassed: boolean;
}

export const DEFAULT_LOAD_PROFILES: Record<LoadProfileName, LoadTestProfile> = {
  typical: {
    name: 'typical',
    label: 'Tipik Kullanım',
    concurrency: 8,
    iterationsPerTarget: 4,
    maxP95Ms: 800,
    maxErrorRate: 0.02,
    description: 'Seans içi çoklu sayfa gezintisi ve portföy özet yenilemesi (8 eşzamanlı istek).',
  },
  heavy: {
    name: 'heavy',
    label: 'Yoğun Kullanım',
    concurrency: 32,
    iterationsPerTarget: 4,
    maxP95Ms: 1800,
    maxErrorRate: 0.03,
    description: 'Piyasa açılışı veya alarm dalgası sırasında eşzamanlı istek yükü (32 eşzamanlı istek).',
  },
};

export const MARKET_AND_PORTFOLIO_TARGETS: LoadTargetSpec[] = [
  {
    id: 'market-stocks-bist',
    category: 'market',
    method: 'GET',
    path: '/api/stocks?exchange=BIST&page=1&limit=25',
    description: 'BIST hisse listesi sayfalı piyasa sorgusu',
  },
  {
    id: 'market-overview',
    category: 'market',
    method: 'GET',
    path: '/api/markets/overview',
    description: 'Piyasa özeti (endeks, döviz, emtia, kripto)',
  },
  {
    id: 'market-funds-list',
    category: 'market',
    method: 'GET',
    path: '/api/funds?page=1&limit=25',
    description: 'TEFAS fon rehberi sayfalı listesi',
  },
  {
    id: 'portfolio-scoped-stocks',
    category: 'portfolio',
    method: 'GET',
    path: '/api/stocks?symbols=THYAO,GARAN,ASELS,AAPL&liveOnly=true',
    description: 'Portföy varlıkları için kapsamlı hisse fiyat yenilemesi',
  },
  {
    id: 'portfolio-scoped-funds',
    category: 'portfolio',
    method: 'GET',
    path: '/api/funds?symbols=TTE,AFT,YAS',
    description: 'Portföy fonları için kapsamlı TEFAS fiyat yenilemesi',
  },
];

function nowMs(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePercentile(sortedAsc: number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return round2(sortedAsc[0]);
  const rank = (Math.min(100, Math.max(0, pct)) / 100) * (sortedAsc.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return round2(sortedAsc[low]);
  const frac = rank - low;
  return round2(sortedAsc[low] + (sortedAsc[high] - sortedAsc[low]) * frac);
}

export function summarizeLatencies(samples: number[]): LatencyPercentiles {
  if (samples.length === 0) {
    return { min: 0, avg: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: round2(sorted[0]),
    avg: round2(sum / sorted.length),
    p50: computePercentile(sorted, 50),
    p95: computePercentile(sorted, 95),
    p99: computePercentile(sorted, 99),
    max: round2(sorted[sorted.length - 1]),
  };
}

/**
 * Instrumented in-process cache + single-flight coalescer modeling StockMind's
 * shared market/portfolio deduplication behavior under concurrent API load.
 */
export function createInstrumentedCoalescingExecutor(options?: {
  ttlMs?: number;
  baseProviderLatencyMs?: number;
  failureRate?: number;
}) {
  const ttlMs = options?.ttlMs ?? 30_000;
  const baseProviderLatencyMs = options?.baseProviderLatencyMs ?? 12;
  const failureRate = options?.failureRate ?? 0;

  const cache = new Map<string, { expiresAt: number; payloadSize: number }>();
  const inFlight = new Map<string, Promise<{ payloadSize: number; ok: boolean; status: number }>>();
  let sequence = 0;

  return async (target: LoadTargetSpec): Promise<EndpointInvocationResult> => {
    const start = nowMs();
    const now = Date.now();
    const cached = cache.get(target.path);
    if (cached && cached.expiresAt > now) {
      return {
        ok: true,
        status: 200,
        durationMs: Math.max(0.05, nowMs() - start),
        providerCalls: 0,
        cacheHit: true,
      };
    }

    let providerCallsForThisRequest = 0;
    let pending = inFlight.get(target.path);
    if (!pending) {
      providerCallsForThisRequest = 1;
      const callIndex = ++sequence;
      pending = (async () => {
        await new Promise((resolve) => setTimeout(resolve, baseProviderLatencyMs));
        const shouldFail =
          failureRate > 0 && ((callIndex * 2654435761) % 1000) / 1000 < failureRate;
        if (shouldFail) {
          return { payloadSize: 0, ok: false, status: 503 };
        }
        const payloadSize = target.category === 'portfolio' ? 4 : 25;
        cache.set(target.path, { expiresAt: Date.now() + ttlMs, payloadSize });
        return { payloadSize, ok: true, status: 200 };
      })().finally(() => {
        inFlight.delete(target.path);
      });
      inFlight.set(target.path, pending);
    }

    const res = await pending;
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Math.max(0.05, nowMs() - start),
      providerCalls: providerCallsForThisRequest,
      cacheHit: false,
      error: res.ok ? undefined : `Upstream status ${res.status}`,
    };
  };
}

export async function runLoadProfile(params: {
  profile: LoadTestProfile;
  targets: LoadTargetSpec[];
  executeTarget: (target: LoadTargetSpec) => Promise<EndpointInvocationResult>;
}): Promise<ProfileLoadReport> {
  const { profile, targets, executeTarget } = params;
  const totalWorkItems: LoadTargetSpec[] = [];
  for (let round = 0; round < profile.iterationsPerTarget; round++) {
    for (const target of targets) {
      totalWorkItems.push(target);
    }
  }

  // Ensure each concurrent wave exercises overlapping endpoints simultaneously
  while (totalWorkItems.length < profile.concurrency * targets.length) {
    for (const target of targets) {
      totalWorkItems.push(target);
    }
  }

  const resultsByTarget = new Map<string, EndpointInvocationResult[]>();
  for (const target of targets) {
    resultsByTarget.set(target.id, []);
  }

  let cursor = 0;
  const wallStart = nowMs();

  const workers = Array.from({ length: Math.max(1, profile.concurrency) }, async () => {
    while (cursor < totalWorkItems.length) {
      const idx = cursor++;
      const target = totalWorkItems[idx];
      if (!target) break;
      try {
        const res = await executeTarget(target);
        resultsByTarget.get(target.id)?.push(res);
      } catch (err) {
        resultsByTarget.get(target.id)?.push({
          ok: false,
          status: 500,
          durationMs: 0,
          providerCalls: 1,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  });

  await Promise.all(workers);
  const totalDurationMs = Math.max(0.1, round2(nowMs() - wallStart));

  const allLatencies: number[] = [];
  let totalRequests = 0;
  let succeededRequests = 0;
  let failedRequests = 0;
  let totalProviderCalls = 0;

  const byTarget: TargetLoadReport[] = targets.map((target) => {
    const samples = resultsByTarget.get(target.id) || [];
    const latencies = samples.map((s) => s.durationMs);
    allLatencies.push(...latencies);

    const successes = samples.filter((s) => s.ok).length;
    const failures = samples.length - successes;
    const cacheHits = samples.filter((s) => s.cacheHit).length;
    const providerCalls = samples.reduce((sum, s) => sum + (s.providerCalls || 0), 0);

    totalRequests += samples.length;
    succeededRequests += successes;
    failedRequests += failures;
    totalProviderCalls += providerCalls;

    return {
      targetId: target.id,
      category: target.category,
      path: target.path,
      requests: samples.length,
      successes,
      failures,
      errorRate: samples.length > 0 ? round2((failures / samples.length) * 100) / 100 : 0,
      cacheHits,
      providerCalls,
      providerCallsPerRequest: samples.length > 0 ? round2(providerCalls / samples.length) : 0,
      latencyMs: summarizeLatencies(latencies),
    };
  });

  const latencyMs = summarizeLatencies(allLatencies);
  const errorRate = totalRequests > 0 ? round2((failedRequests / totalRequests) * 10000) / 10000 : 0;
  const providerCallsPerRequest = totalRequests > 0 ? round2(totalProviderCalls / totalRequests) : 0;
  const dedupSavingsRatio =
    totalRequests > 0 ? round2(Math.max(0, 1 - totalProviderCalls / totalRequests) * 1000) / 1000 : 0;

  const slaViolations: string[] = [];
  if (errorRate > profile.maxErrorRate) {
    slaViolations.push(
      `Hata oranı ${(errorRate * 100).toFixed(2)}% > eşik ${(profile.maxErrorRate * 100).toFixed(2)}%`,
    );
  }
  if (latencyMs.p95 > profile.maxP95Ms) {
    slaViolations.push(`p95 gecikme ${latencyMs.p95}ms > eşik ${profile.maxP95Ms}ms`);
  }

  return {
    profile,
    totalRequests,
    succeededRequests,
    failedRequests,
    errorRate,
    totalDurationMs,
    throughputRps: round2((totalRequests / totalDurationMs) * 1000),
    totalProviderCalls,
    providerCallsPerRequest,
    dedupSavingsRatio,
    latencyMs,
    byTarget,
    slaPassed: slaViolations.length === 0,
    slaViolations,
  };
}

export async function runApiLoadTestSuite(options?: {
  profiles?: LoadTestProfile[];
  targets?: LoadTargetSpec[];
  mode?: 'live-http' | 'instrumented-local';
  baseUrl?: string;
  executeTarget?: (target: LoadTargetSpec) => Promise<EndpointInvocationResult>;
  createExecutorForProfile?: (profile: LoadTestProfile) => (target: LoadTargetSpec) => Promise<EndpointInvocationResult>;
}): Promise<ApiLoadTestReport> {
  const profiles = options?.profiles ?? [
    DEFAULT_LOAD_PROFILES.typical,
    DEFAULT_LOAD_PROFILES.heavy,
  ];
  const targets = options?.targets ?? MARKET_AND_PORTFOLIO_TARGETS;

  const profileReports: ProfileLoadReport[] = [];
  for (const profile of profiles) {
    const executeTarget =
      options?.executeTarget ??
      options?.createExecutorForProfile?.(profile) ??
      createInstrumentedCoalescingExecutor();
    const report = await runLoadProfile({
      profile,
      targets,
      executeTarget,
    });
    profileReports.push(report);
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: options?.mode ?? 'instrumented-local',
    baseUrl: options?.baseUrl,
    targets,
    profiles: profileReports,
    overallPassed: profileReports.every((p) => p.slaPassed),
  };
}
