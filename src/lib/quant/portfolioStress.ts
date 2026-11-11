import {
  calculateMacroStressTests,
  getFinancialProfile,
  type StressShockInputs,
} from '@/lib/quant/models';

export type PortfolioShockMode = 'combined' | 'fx' | 'rate' | 'market';

export interface PortfolioStressHoldingInput {
  symbol: string;
  assetType?: 'stock' | 'fund';
  exchange?: string | null;
  currency?: string;
  originalCurrency?: string;
  currentValue: number;
  weight?: number;
  priceMissing?: boolean;
}

export interface PortfolioStressInput {
  holdings: PortfolioStressHoldingInput[];
  mode?: PortfolioShockMode;
  fxShockPercent?: number;
  rateShockBps?: number;
  marketShockPercent?: number;
}

export interface PortfolioStressPosition {
  symbol: string;
  assetType: 'stock' | 'fund';
  exchange: string;
  currency: string;
  currentValueTry: number;
  weightPercent: number;
  shockImpactPercent: number;
  contributionTry: number;
  portfolioImpactPp: number;
  stressedValueTry: number;
  assumptions: string[];
}

export interface PortfolioStressReport {
  mode: PortfolioShockMode;
  appliedShocks: {
    fxShockPercent: number;
    rateShockBps: number;
    marketShockPercent: number;
  };
  totalCurrentValueTry: number;
  totalStressedValueTry: number;
  totalImpactTry: number;
  totalImpactPercent: number;
  pricedCount: number;
  unpricedSymbols: string[];
  portfolioAssumptions: string[];
  positions: PortfolioStressPosition[];
}

function resolveMarketBeta(symbol: string, assetType: 'stock' | 'fund', exchange: string, sector: string): {
  beta: number;
  reason: string;
} {
  const cleanSym = symbol.trim().toUpperCase();
  const s = sector.toLowerCase();
  if (cleanSym === 'GRAM_ALTIN') {
    return { beta: 0.25, reason: 'Emtia/Altın düşük hisse betası varsayımı (0.25x)' };
  }
  if (assetType === 'fund') {
    return { beta: 0.75, reason: 'TEFAS fon karma varlık piyasa betası varsayımı (0.75x)' };
  }
  if (exchange === 'NASDAQ' || exchange === 'NYSE') {
    return { beta: 1.15, reason: 'ABD/küresel büyüme hissesi piyasa betası varsayımı (1.15x)' };
  }
  if (exchange === 'CRYPTO') {
    return { beta: 1.6, reason: 'Kripto yüksek piyasa betası varsayımı (1.60x)' };
  }
  if (s.includes('bankacılık') || s.includes('holding') || s.includes('havacılık')) {
    return { beta: 1.1, reason: `${sector} sektörü piyasa betası varsayımı (1.10x)` };
  }
  if (s.includes('telekom') || s.includes('gıda') || s.includes('enerji')) {
    return { beta: 0.85, reason: `${sector} defansif/dengeli piyasa betası varsayımı (0.85x)` };
  }
  return { beta: 1.0, reason: 'Standart hisse piyasa betası varsayımı (1.00x)' };
}

export function calculatePortfolioStressTest(input: PortfolioStressInput): PortfolioStressReport {
  const mode: PortfolioShockMode = input.mode ?? 'combined';
  const rawFx = typeof input.fxShockPercent === 'number' && Number.isFinite(input.fxShockPercent)
    ? input.fxShockPercent
    : 20;
  const rawRate = typeof input.rateShockBps === 'number' && Number.isFinite(input.rateShockBps)
    ? input.rateShockBps
    : 500;
  const rawMarket = typeof input.marketShockPercent === 'number' && Number.isFinite(input.marketShockPercent)
    ? input.marketShockPercent
    : -15;

  const effectiveFx = mode === 'combined' || mode === 'fx' ? rawFx : 0;
  const effectiveRate = mode === 'combined' || mode === 'rate' ? rawRate : 0;
  const effectiveMarket = mode === 'combined' || mode === 'market' ? rawMarket : 0;

  const pricedHoldings: PortfolioStressHoldingInput[] = [];
  const unpricedSymbols: string[] = [];

  for (const h of input.holdings) {
    const cleanSym = (h.symbol || '').trim().toUpperCase();
    if (!cleanSym) continue;
    if (h.priceMissing || !Number.isFinite(h.currentValue) || h.currentValue <= 0) {
      unpricedSymbols.push(cleanSym);
      continue;
    }
    pricedHoldings.push({ ...h, symbol: cleanSym });
  }

  const totalCurrentValueTry = pricedHoldings.reduce((sum, h) => sum + h.currentValue, 0);

  const positions: PortfolioStressPosition[] = pricedHoldings.map((h) => {
    const assetType = h.assetType ?? 'stock';
    const exchange = (h.exchange || 'BIST').toUpperCase();
    const nativeCurrency = (h.originalCurrency || h.currency || (exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'CRYPTO' ? 'USD' : 'TRY')).toUpperCase();
    const profile = getFinancialProfile(h.symbol);

    const stressCards = calculateMacroStressTests({
      symbol: h.symbol,
      profile,
      shocks: {
        fxShockPercent: effectiveFx,
        rateShockBps: effectiveRate,
        demandShockPercent: effectiveMarket,
      } satisfies Partial<StressShockInputs>,
    });

    const fxCard = stressCards.find((c) => c.id === 'fx');
    const rateCard = stressCards.find((c) => c.id === 'rate');

    let fxComponentPercent = 0;
    const assumptions: string[] = [];

    if (effectiveFx !== 0) {
      if (nativeCurrency === 'USD') {
        // USD-denominated assets gain direct TRY translation value plus operational sensitivity
        const opImpact = fxCard ? fxCard.impactPercent * 0.25 : 0;
        fxComponentPercent = effectiveFx + opImpact;
        assumptions.push(
          `Kur çevirim etkisi (${nativeCurrency}/TRY): ${effectiveFx >= 0 ? '+' : ''}${effectiveFx}%`
        );
      } else {
        fxComponentPercent = fxCard ? fxCard.impactPercent : 0;
        assumptions.push(...(fxCard?.assumptions.slice(0, 2) ?? []));
      }
    }

    let rateComponentPercent = 0;
    if (effectiveRate !== 0) {
      rateComponentPercent = rateCard ? rateCard.impactPercent : 0;
      assumptions.push(...(rateCard?.assumptions.slice(0, 2) ?? []));
    }

    let marketComponentPercent = 0;
    if (effectiveMarket !== 0) {
      const betaMeta = resolveMarketBeta(h.symbol, assetType, exchange, profile.sector);
      marketComponentPercent = Number((effectiveMarket * betaMeta.beta).toFixed(2));
      assumptions.push(`${betaMeta.reason} × ${effectiveMarket}% piyasa şoku`);
    }

    const combinedImpact = Math.max(
      -95,
      Math.min(250, Number((fxComponentPercent + rateComponentPercent + marketComponentPercent).toFixed(2)))
    );
    const contributionTry = Number(((h.currentValue * combinedImpact) / 100).toFixed(2));
    const stressedValueTry = Math.max(0, Number((h.currentValue + contributionTry).toFixed(2)));
    const weightPercent =
      totalCurrentValueTry > 0
        ? Number(((h.currentValue / totalCurrentValueTry) * 100).toFixed(1))
        : 0;
    const portfolioImpactPp =
      totalCurrentValueTry > 0
        ? Number(((contributionTry / totalCurrentValueTry) * 100).toFixed(2))
        : 0;

    return {
      symbol: h.symbol,
      assetType,
      exchange,
      currency: nativeCurrency,
      currentValueTry: Number(h.currentValue.toFixed(2)),
      weightPercent,
      shockImpactPercent: combinedImpact,
      contributionTry,
      portfolioImpactPp,
      stressedValueTry,
      assumptions,
    };
  });

  positions.sort((a, b) => Math.abs(b.contributionTry) - Math.abs(a.contributionTry));

  const totalStressedValueTry = Number(
    positions.reduce((sum, p) => sum + p.stressedValueTry, 0).toFixed(2)
  );
  const totalImpactTry = Number((totalStressedValueTry - totalCurrentValueTry).toFixed(2));
  const totalImpactPercent =
    totalCurrentValueTry > 0
      ? Number(((totalImpactTry / totalCurrentValueTry) * 100).toFixed(2))
      : 0;

  const portfolioAssumptions: string[] = [
    `Kur şoku (USD/TRY): ${effectiveFx >= 0 ? '+' : ''}${effectiveFx}%${mode === 'fx' || mode === 'combined' ? ' (aktif)' : ' (devre dışı)'}`,
    `Faiz şoku: ${effectiveRate >= 0 ? '+' : ''}${effectiveRate} bps${mode === 'rate' || mode === 'combined' ? ' (aktif)' : ' (devre dışı)'}`,
    `Piyasa şoku (endeks/piyasa hareketi): ${effectiveMarket >= 0 ? '+' : ''}${effectiveMarket}%${mode === 'market' || mode === 'combined' ? ' (aktif)' : ' (devre dışı)'}`,
    'Pozisyon etkileri lineer duyarlılık, kaldıraç ve sektör/varlık betası örnek varsayımlarına göre hesaplanır.',
  ];
  if (unpricedSymbols.length > 0) {
    portfolioAssumptions.push(
      `Fiyatı eksik olduğu için hariç tutulan pozisyonlar: ${unpricedSymbols.join(', ')}`
    );
  }

  return {
    mode,
    appliedShocks: {
      fxShockPercent: effectiveFx,
      rateShockBps: effectiveRate,
      marketShockPercent: effectiveMarket,
    },
    totalCurrentValueTry: Number(totalCurrentValueTry.toFixed(2)),
    totalStressedValueTry,
    totalImpactTry,
    totalImpactPercent,
    pricedCount: positions.length,
    unpricedSymbols,
    portfolioAssumptions,
    positions,
  };
}

