import {
  calculateRSI,
  calculateSMA,
  filterValidCloseCandles,
  type Candle,
} from '@/lib/indicators/index';

export type IndicatorRuleKind =
  | 'rsi_below'
  | 'rsi_above'
  | 'sma_cross_above'
  | 'sma_cross_below';

export interface IndicatorAlertRuleSpec {
  id: string;
  symbol: string;
  kind: IndicatorRuleKind;
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  threshold: number;
  hysteresisBand?: number;
  cooldownBars?: number;
}

export interface IndicatorRuleEvaluation {
  ruleId: string;
  symbol: string;
  kind: IndicatorRuleKind;
  dataSource: string;
  triggered: boolean;
  status: 'triggered' | 'watching' | 'cooldown_suppressed' | 'insufficient_candles';
  signalBarTime: string | number | null;
  latestIndicatorValue: number | null;
  previousIndicatorValue: number | null;
  secondaryValue: number | null;
  threshold: number;
  hysteresisResetLevel: number | null;
  candlesUsed: number;
  reason: string;
}

export interface ListAlertRuleSpec {
  id: string;
  listName: string;
  symbols: readonly string[];
  kind: IndicatorRuleKind;
  period?: number;
  threshold: number;
  hysteresisBand?: number;
}

export interface ListAlertEvaluationResult {
  ruleId: string;
  listName: string;
  uniqueSymbolsCount: number;
  deduplicatedFromCount: number;
  providerCallsRequired: number;
  triggeredSymbols: string[];
  results: IndicatorRuleEvaluation[];
}

export interface BackgroundCostEstimate {
  uniqueSymbols: number;
  pollIntervalMinutes: number;
  candleRefreshMinutes: number;
  dailyCandleFetches: number;
  monthlyCandleFetches: number;
  estimatedWorkerCpuMsPerCycle: number;
  costTier: 'low' | 'moderate' | 'high';
}

export interface RuleArchitectureEvaluation {
  id: 'indicator_based' | 'list_based';
  title: string;
  dataSource: string;
  thresholdBehavior: string;
  backgroundCostModel: string;
  recommendedCacheTtlMinutes: number;
}

export const ALERT_RULE_DESIGN_MATRIX: readonly RuleArchitectureEvaluation[] = [
  {
    id: 'indicator_based',
    title: 'Gösterge Bazlı Alarmlar (RSI / SMA Kesişimi)',
    dataSource:
      'Kapanış teyitli OHLCV günlük/saatlik mum serisi (Yahoo Finance / TradingView geçmiş serisi). Eksik veya bozuk kapanışlı mumlar filtrelenir.',
    thresholdBehavior:
      'Yalnızca teyit edilmiş kapanışta eşik geçişini değerlendirir; histerezis bandı (ör. RSI 30 altı tetiklenince 35 üzerine çıkmadan tekrar etmez) ve bekleme süresiyle (cooldown) gürültü tetiklerini engeller.',
    backgroundCostModel:
      'Sembol başına günde/saatte tek mum serisi önbelleği (TTL >= 15 dk). Hesaplama saf bellek içi dizi işlemidir (<0.2 ms/sembol).',
    recommendedCacheTtlMinutes: 15,
  },
  {
    id: 'list_based',
    title: 'Liste Bazlı Alarmlar (İzleme Listesi / Portföy Kuralı)',
    dataSource:
      'Kullanıcının seçtiği liste veya portföydeki benzersiz semboller tekilleştirilerek ortak piyasa/mum deposundan toplu okunur.',
    thresholdBehavior:
      'Liste içindeki her sembol aynı şablon kuralla değerlendirilir; tetiklenen alt küme özet bildirime birleştirilir.',
    backgroundCostModel:
      'Maliyet kullanıcı sayısına değil sistem genelindeki benzersiz sembol sayısına göre ölçeklenir: O(uniqueSymbols).',
    recommendedCacheTtlMinutes: 15,
  },
];

function computeResetLevel(kind: IndicatorRuleKind, threshold: number, band: number): number | null {
  if (kind === 'rsi_below') return Number((threshold + band).toFixed(2));
  if (kind === 'rsi_above') return Number((threshold - band).toFixed(2));
  return null;
}

/**
 * Reproducibly evaluates an indicator rule over supplied OHLC/close candles.
 * Pure & deterministic: identical candles always produce the identical evaluation.
 */
export function evaluateIndicatorAlertRule(
  rule: IndicatorAlertRuleSpec,
  candles: readonly Candle[],
  options?: { lastTriggeredBarIndex?: number | null; dataSource?: string },
): IndicatorRuleEvaluation {
  const symbol = String(rule.symbol || '').trim().toUpperCase();
  const dataSource = options?.dataSource || 'ohlcv_closed_candles';
  const validCandles = filterValidCloseCandles([...candles]);
  const hysteresisBand = rule.hysteresisBand ?? 5;
  const cooldownBars = rule.cooldownBars ?? 3;
  const resetLevel = computeResetLevel(rule.kind, rule.threshold, hysteresisBand);

  if (rule.kind === 'rsi_below' || rule.kind === 'rsi_above') {
    const period = rule.period ?? 14;
    const rsiSeries = calculateRSI(validCandles, period);
    if (rsiSeries.length < 2) {
      return {
        ruleId: rule.id,
        symbol,
        kind: rule.kind,
        dataSource,
        triggered: false,
        status: 'insufficient_candles',
        signalBarTime: null,
        latestIndicatorValue: rsiSeries[rsiSeries.length - 1]?.value ?? null,
        previousIndicatorValue: null,
        secondaryValue: null,
        threshold: rule.threshold,
        hysteresisResetLevel: resetLevel,
        candlesUsed: validCandles.length,
        reason: `RSI(${period}) için en az ${period + 2} geçerli mum gerekir (mevcut: ${validCandles.length}).`,
      };
    }

    const latest = rsiSeries[rsiSeries.length - 1];
    const previous = rsiSeries[rsiSeries.length - 2];
    const latestVal = latest.value ?? 0;
    const prevVal = previous.value ?? 0;

    const crossed =
      rule.kind === 'rsi_below'
        ? prevVal > rule.threshold && latestVal <= rule.threshold
        : prevVal < rule.threshold && latestVal >= rule.threshold;

    const lastIdx = options?.lastTriggeredBarIndex ?? null;
    const barsSinceLastTrigger =
      lastIdx !== null && lastIdx >= 0 ? validCandles.length - 1 - lastIdx : Infinity;

    if (barsSinceLastTrigger < cooldownBars && (crossed || (rule.kind === 'rsi_below' ? latestVal <= rule.threshold : latestVal >= rule.threshold))) {
      return {
        ruleId: rule.id,
        symbol,
        kind: rule.kind,
        dataSource,
        triggered: false,
        status: 'cooldown_suppressed',
        signalBarTime: latest.time,
        latestIndicatorValue: latestVal,
        previousIndicatorValue: prevVal,
        secondaryValue: null,
        threshold: rule.threshold,
        hysteresisResetLevel: resetLevel,
        candlesUsed: validCandles.length,
        reason: `Bekleme süresi/histerezis aktif (${barsSinceLastTrigger} < ${cooldownBars} bar); mükerrer uyarı bastırıldı.`,
      };
    }

    const stillInZoneOnCooldown =
      lastIdx !== null &&
      barsSinceLastTrigger >= cooldownBars &&
      resetLevel !== null &&
      ((rule.kind === 'rsi_below' && prevVal < resetLevel && latestVal <= rule.threshold) ||
        (rule.kind === 'rsi_above' && prevVal > resetLevel && latestVal >= rule.threshold));

    if (crossed && !stillInZoneOnCooldown) {
      return {
        ruleId: rule.id,
        symbol,
        kind: rule.kind,
        dataSource,
        triggered: true,
        status: 'triggered',
        signalBarTime: latest.time,
        latestIndicatorValue: latestVal,
        previousIndicatorValue: prevVal,
        secondaryValue: null,
        threshold: rule.threshold,
        hysteresisResetLevel: resetLevel,
        candlesUsed: validCandles.length,
        reason: `RSI(${period}) değeri ${prevVal} -> ${latestVal} ile ${rule.threshold} eşiğini geçti.`,
      };
    }

    return {
      ruleId: rule.id,
      symbol,
      kind: rule.kind,
      dataSource,
      triggered: false,
      status: stillInZoneOnCooldown ? 'cooldown_suppressed' : 'watching',
      signalBarTime: latest.time,
      latestIndicatorValue: latestVal,
      previousIndicatorValue: prevVal,
      secondaryValue: null,
      threshold: rule.threshold,
      hysteresisResetLevel: resetLevel,
      candlesUsed: validCandles.length,
      reason: stillInZoneOnCooldown
        ? `Histerezis sıfırlama seviyesine (${resetLevel}) dönülmeden yeni tetik üretilmez.`
        : `RSI(${period})=${latestVal}; eşik ${rule.threshold} bekleniyor.`,
    };
  }

  // SMA crossover rules
  const fastPeriod = rule.fastPeriod ?? 20;
  const slowPeriod = rule.slowPeriod ?? 50;
  const fastSeries = calculateSMA(validCandles, fastPeriod);
  const slowSeries = calculateSMA(validCandles, slowPeriod);
  const slowByTime = new Map(slowSeries.map((item) => [String(item.time), item.value]));
  const alignedPairs: Array<{ time: string | number; fast: number; slow: number }> = [];

  for (const fastPt of fastSeries) {
    const slowVal = slowByTime.get(String(fastPt.time));
    if (typeof fastPt.value === 'number' && typeof slowVal === 'number') {
      alignedPairs.push({ time: fastPt.time, fast: fastPt.value, slow: slowVal });
    }
  }

  if (alignedPairs.length < 2) {
    return {
      ruleId: rule.id,
      symbol,
      kind: rule.kind,
      dataSource,
      triggered: false,
      status: 'insufficient_candles',
      signalBarTime: null,
      latestIndicatorValue: alignedPairs[alignedPairs.length - 1]?.fast ?? null,
      previousIndicatorValue: null,
      secondaryValue: alignedPairs[alignedPairs.length - 1]?.slow ?? null,
      threshold: 0,
      hysteresisResetLevel: null,
      candlesUsed: validCandles.length,
      reason: `SMA(${fastPeriod}/${slowPeriod}) kesişimi için en az ${Math.max(fastPeriod, slowPeriod) + 1} mum gerekir.`,
    };
  }

  const prevPair = alignedPairs[alignedPairs.length - 2];
  const latestPair = alignedPairs[alignedPairs.length - 1];
  const crossed =
    rule.kind === 'sma_cross_above'
      ? prevPair.fast <= prevPair.slow && latestPair.fast > latestPair.slow
      : prevPair.fast >= prevPair.slow && latestPair.fast < latestPair.slow;

  return {
    ruleId: rule.id,
    symbol,
    kind: rule.kind,
    dataSource,
    triggered: crossed,
    status: crossed ? 'triggered' : 'watching',
    signalBarTime: latestPair.time,
    latestIndicatorValue: latestPair.fast,
    previousIndicatorValue: prevPair.fast,
    secondaryValue: latestPair.slow,
    threshold: latestPair.slow,
    hysteresisResetLevel: null,
    candlesUsed: validCandles.length,
    reason: crossed
      ? `SMA(${fastPeriod})=${latestPair.fast}, SMA(${slowPeriod})=${latestPair.slow} çizgisini kesti.`
      : `SMA(${fastPeriod})=${latestPair.fast}, SMA(${slowPeriod})=${latestPair.slow}; kesişim bekleniyor.`,
  };
}

/**
 * Evaluates a single rule template across a watchlist/portfolio list while deduplicating symbols
 * so background upstream fetches scale linearly with unique symbols.
 */
export function evaluateListAlertRule(params: {
  rule: ListAlertRuleSpec;
  candlesBySymbol: Record<string, readonly Candle[]>;
}): ListAlertEvaluationResult {
  const uniqueSymbols: string[] = [];
  const seen = new Set<string>();
  for (const rawSym of params.rule.symbols) {
    const clean = String(rawSym || '').trim().toUpperCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      uniqueSymbols.push(clean);
    }
  }

  const results = uniqueSymbols.map((sym) =>
    evaluateIndicatorAlertRule(
      {
        id: `${params.rule.id}:${sym}`,
        symbol: sym,
        kind: params.rule.kind,
        period: params.rule.period,
        threshold: params.rule.threshold,
        hysteresisBand: params.rule.hysteresisBand,
      },
      params.candlesBySymbol[sym] || [],
    ),
  );

  return {
    ruleId: params.rule.id,
    listName: params.rule.listName,
    uniqueSymbolsCount: uniqueSymbols.length,
    deduplicatedFromCount: params.rule.symbols.length,
    providerCallsRequired: uniqueSymbols.length,
    triggeredSymbols: results.filter((r) => r.triggered).map((r) => r.symbol),
    results,
  };
}

export function estimateAlertBackgroundCost(input: {
  uniqueSymbols: number;
  pollIntervalMinutes: number;
  candleRefreshMinutes?: number;
}): BackgroundCostEstimate {
  const uniqueSymbols = Math.max(0, Math.floor(input.uniqueSymbols));
  const pollIntervalMinutes = Math.max(1, input.pollIntervalMinutes);
  const candleRefreshMinutes = Math.max(pollIntervalMinutes, input.candleRefreshMinutes ?? 15);
  const cyclesPerDay = Math.floor((24 * 60) / candleRefreshMinutes);
  const dailyCandleFetches = uniqueSymbols * cyclesPerDay;
  const monthlyCandleFetches = dailyCandleFetches * 30;
  const estimatedWorkerCpuMsPerCycle = Number((uniqueSymbols * 0.18).toFixed(2));
  const costTier: BackgroundCostEstimate['costTier'] =
    dailyCandleFetches <= 5000 ? 'low' : dailyCandleFetches <= 25000 ? 'moderate' : 'high';

  return {
    uniqueSymbols,
    pollIntervalMinutes,
    candleRefreshMinutes,
    dailyCandleFetches,
    monthlyCandleFetches,
    estimatedWorkerCpuMsPerCycle,
    costTier,
  };
}

