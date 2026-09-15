// Technical Analysis Indicator Calculations

export interface Candle {
  time: string | number; // timestamp or YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface IndicatorResult {
  time: string | number;
  value?: number;
  [key: string]: string | number | undefined;
}

/**
 * Simple Moving Average (SMA)
 */
export function calculateSMA(data: Candle[], period: number = 20): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      continue;
    }
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, c) => acc + c.close, 0);
    result.push({
      time: data[i].time,
      value: Number((sum / period).toFixed(2)),
    });
  }
  return result;
}

/**
 * Exponential Moving Average (EMA)
 */
export function calculateEMA(data: Candle[], period: number = 20): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);

  // Initial SMA as first EMA
  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += data[i].close;
  }
  let prevEMA = initialSum / period;
  result.push({
    time: data[period - 1].time,
    value: Number(prevEMA.toFixed(2)),
  });

  for (let i = period; i < data.length; i++) {
    const currentEMA = (data[i].close - prevEMA) * multiplier + prevEMA;
    result.push({
      time: data[i].time,
      value: Number(currentEMA.toFixed(2)),
    });
    prevEMA = currentEMA;
  }

  return result;
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(data: Candle[], period: number = 14): IndicatorResult[] {
  const result: IndicatorResult[] = [];
  if (data.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);

  result.push({
    time: data[period].time,
    value: Number(rsi.toFixed(2)),
  });

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);

    result.push({
      time: data[i].time,
      value: Number(rsi.toFixed(2)),
    });
  }

  return result;
}

/**
 * Bollinger Bands
 */
export interface BollingerBandsResult {
  time: string | number;
  upper: number;
  middle: number;
  lower: number;
}

export function calculateBollingerBands(
  data: Candle[],
  period: number = 20,
  multiplier: number = 2
): BollingerBandsResult[] {
  const result: BollingerBandsResult[] = [];
  if (data.length < period) return result;

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    const mean = sum / period;

    const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    result.push({
      time: data[i].time,
      upper: Number((mean + multiplier * stdDev).toFixed(2)),
      middle: Number(mean.toFixed(2)),
      lower: Number((mean - multiplier * stdDev).toFixed(2)),
    });
  }

  return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export interface MACDResult {
  time: string | number;
  macd: number;
  signal: number;
  histogram: number;
}

export function calculateMACD(
  data: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult[] {
  const result: MACDResult[] = [];
  if (data.length < slowPeriod + signalPeriod) return result;

  // Calculate EMA fast and slow
  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);

  // Align dates for MACD line (fast - slow)
  const macdLine: { time: string | number; value: number }[] = [];
  const fastMap = new Map(emaFast.map((e) => [e.time, e.value!]));

  emaSlow.forEach((slow) => {
    const fastVal = fastMap.get(slow.time);
    if (fastVal !== undefined) {
      macdLine.push({
        time: slow.time,
        value: fastVal - slow.value!,
      });
    }
  });

  // Calculate Signal Line (EMA of MACD line)
  if (macdLine.length < signalPeriod) return result;

  const multiplier = 2 / (signalPeriod + 1);
  let initialSignalSum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    initialSignalSum += macdLine[i].value;
  }
  let prevSignal = initialSignalSum / signalPeriod;

  result.push({
    time: macdLine[signalPeriod - 1].time,
    macd: Number(macdLine[signalPeriod - 1].value.toFixed(2)),
    signal: Number(prevSignal.toFixed(2)),
    histogram: Number((macdLine[signalPeriod - 1].value - prevSignal).toFixed(2)),
  });

  for (let i = signalPeriod; i < macdLine.length; i++) {
    const currentSignal = (macdLine[i].value - prevSignal) * multiplier + prevSignal;
    const hist = macdLine[i].value - currentSignal;

    result.push({
      time: macdLine[i].time,
      macd: Number(macdLine[i].value.toFixed(2)),
      signal: Number(currentSignal.toFixed(2)),
      histogram: Number(hist.toFixed(2)),
    });
    prevSignal = currentSignal;
  }

  return result;
}

/**
 * Stochastic RSI
 */
export interface StochRSIResult {
  time: string | number;
  k: number;
  d: number;
}

export function calculateStochRSI(
  data: Candle[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14,
  kPeriod: number = 3,
  dPeriod: number = 3
): StochRSIResult[] {
  const rsiValues = calculateRSI(data, rsiPeriod);
  const result: StochRSIResult[] = [];
  if (rsiValues.length < stochPeriod + kPeriod + dPeriod) return result;

  const rawStoch: { time: string | number; value: number }[] = [];

  for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
    const slice = rsiValues.slice(i - stochPeriod + 1, i + 1).map((r) => r.value!);
    const minRsi = Math.min(...slice);
    const maxRsi = Math.max(...slice);
    const currentRsi = rsiValues[i].value!;

    const stochVal = maxRsi === minRsi ? 50 : ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100;
    rawStoch.push({
      time: rsiValues[i].time,
      value: stochVal,
    });
  }

  // Smooth K
  const smoothedK: { time: string | number; value: number }[] = [];
  for (let i = kPeriod - 1; i < rawStoch.length; i++) {
    const kSlice = rawStoch.slice(i - kPeriod + 1, i + 1);
    const avgK = kSlice.reduce((acc, item) => acc + item.value, 0) / kPeriod;
    smoothedK.push({
      time: rawStoch[i].time,
      value: avgK,
    });
  }

  // Smooth D (SMA of K)
  for (let i = dPeriod - 1; i < smoothedK.length; i++) {
    const dSlice = smoothedK.slice(i - dPeriod + 1, i + 1);
    const avgD = dSlice.reduce((acc, item) => acc + item.value, 0) / dPeriod;
    result.push({
      time: smoothedK[i].time,
      k: Number(smoothedK[i].value.toFixed(2)),
      d: Number(avgD.toFixed(2)),
    });
  }

  return result;
}
