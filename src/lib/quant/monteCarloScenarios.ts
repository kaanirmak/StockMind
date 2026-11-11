export const MONTE_CARLO_SCENARIO_STORAGE_KEY = 'stockmind.quant.mcScenarios.v1';

export interface SavedMonteCarloScenario {
  id: string;
  label: string;
  symbol: string;
  initialPrice: number;
  currency: 'TRY' | 'USD';
  timeHorizonDays: number;
  volatilityPercent: number;
  driftPercent: number;
  simulationsCount: number;
  seed: number;
  medianPrice: number;
  var5Percentile: number;
  best95Percentile: number;
  createdAt: string;
}

export interface MonteCarloStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function getStorage(storage?: MonteCarloStorageLike | null): MonteCarloStorageLike | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function sanitizeMonteCarloScenario(raw: unknown): SavedMonteCarloScenario | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== 'string' ||
    !r.id.trim() ||
    typeof r.symbol !== 'string' ||
    !r.symbol.trim() ||
    typeof r.timeHorizonDays !== 'number' ||
    !Number.isFinite(r.timeHorizonDays) ||
    typeof r.volatilityPercent !== 'number' ||
    !Number.isFinite(r.volatilityPercent) ||
    typeof r.driftPercent !== 'number' ||
    !Number.isFinite(r.driftPercent) ||
    typeof r.simulationsCount !== 'number' ||
    !Number.isFinite(r.simulationsCount) ||
    typeof r.seed !== 'number' ||
    !Number.isFinite(r.seed) ||
    typeof r.initialPrice !== 'number' ||
    !Number.isFinite(r.initialPrice) ||
    typeof r.medianPrice !== 'number' ||
    !Number.isFinite(r.medianPrice) ||
    typeof r.var5Percentile !== 'number' ||
    !Number.isFinite(r.var5Percentile) ||
    typeof r.best95Percentile !== 'number' ||
    !Number.isFinite(r.best95Percentile)
  ) {
    return null;
  }

  return {
    id: r.id.trim(),
    label:
      typeof r.label === 'string' && r.label.trim()
        ? r.label.trim()
        : `${r.symbol.trim().toUpperCase()} • ${r.timeHorizonDays}g • Seed ${r.seed}`,
    symbol: r.symbol.trim().toUpperCase(),
    initialPrice: Number(r.initialPrice),
    currency: r.currency === 'USD' ? 'USD' : 'TRY',
    timeHorizonDays: Math.round(r.timeHorizonDays),
    volatilityPercent: Number(r.volatilityPercent),
    driftPercent: Number(r.driftPercent),
    simulationsCount: Math.round(r.simulationsCount),
    seed: Math.trunc(r.seed),
    medianPrice: Number(r.medianPrice),
    var5Percentile: Number(r.var5Percentile),
    best95Percentile: Number(r.best95Percentile),
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
  };
}

export function listMonteCarloScenarios(storage?: MonteCarloStorageLike | null): SavedMonteCarloScenario[] {
  const store = getStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(MONTE_CARLO_SCENARIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeMonteCarloScenario(item))
      .filter((item): item is SavedMonteCarloScenario => item !== null)
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function saveMonteCarloScenario(
  input: Omit<SavedMonteCarloScenario, 'id' | 'createdAt' | 'label'> & { label?: string },
  storage?: MonteCarloStorageLike | null
): SavedMonteCarloScenario[] {
  const existing = listMonteCarloScenarios(storage);
  const symbol = input.symbol.trim().toUpperCase();
  const entry: SavedMonteCarloScenario = {
    id: `mc-${Date.now()}-${Math.trunc(input.seed)}`,
    label:
      input.label?.trim() ||
      `${symbol} • ${input.timeHorizonDays}g • σ%${input.volatilityPercent} • μ%${input.driftPercent} • N=${input.simulationsCount} • Tohum ${Math.trunc(input.seed)}`,
    symbol,
    initialPrice: Number(input.initialPrice),
    currency: input.currency === 'USD' ? 'USD' : 'TRY',
    timeHorizonDays: Math.round(input.timeHorizonDays),
    volatilityPercent: Number(input.volatilityPercent),
    driftPercent: Number(input.driftPercent),
    simulationsCount: Math.round(input.simulationsCount),
    seed: Math.trunc(input.seed),
    medianPrice: Number(input.medianPrice),
    var5Percentile: Number(input.var5Percentile),
    best95Percentile: Number(input.best95Percentile),
    createdAt: new Date().toISOString(),
  };

  const next = [entry, ...existing.filter((item) => item.id !== entry.id)].slice(0, 12);
  const store = getStorage(storage);
  if (store) {
    try {
      store.setItem(MONTE_CARLO_SCENARIO_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  return next;
}

export function deleteMonteCarloScenario(
  id: string,
  storage?: MonteCarloStorageLike | null
): SavedMonteCarloScenario[] {
  const next = listMonteCarloScenarios(storage).filter((item) => item.id !== id);
  const store = getStorage(storage);
  if (store) {
    try {
      store.setItem(MONTE_CARLO_SCENARIO_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  return next;
}

