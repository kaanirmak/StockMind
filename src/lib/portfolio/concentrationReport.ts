import type { Holding, PortfolioSummary } from '@/types/portfolio';
import { cleanSymbol } from '@/lib/portfolio/calculations';

export interface ConcentrationBucket {
  label: string;
  valueTry: number;
  weightPct: number;
  count: number;
}

export interface TopPositionItem {
  symbol: string;
  assetTypeLabel: string;
  sector: string;
  country: string;
  valueTry: number;
  weightPct: number;
}

export type ConcentrationLevel = 'high' | 'moderate' | 'diversified';

export interface PortfolioConcentrationReport {
  totalAnalyzedValue: number;
  positionCount: number;
  hhiIndex: number; // 0..10000
  effectivePositions: number;
  concentrationLevel: ConcentrationLevel;
  concentrationLabel: string;
  top1WeightPct: number;
  top3WeightPct: number;
  top5WeightPct: number;
  topPositions: TopPositionItem[];
  sectorBreakdown: ConcentrationBucket[];
  countryBreakdown: ConcentrationBucket[];
  assetTypeBreakdown: ConcentrationBucket[];
  warnings: string[];
}

export interface AssetMetadataResolver {
  getStockSector?: (symbol: string) => string | null | undefined;
  getFundCategory?: (code: string) => string | null | undefined;
}

function resolveCountryLabel(holding: Holding): string {
  const cleaned = cleanSymbol(holding.symbol);
  const ex = (holding.exchange || cleaned.exchange || '').toUpperCase();
  if (holding.assetType === 'fund' || ex === 'TEFAS' || ex === 'BIST') {
    return 'Türkiye';
  }
  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'AMEX') {
    return 'ABD';
  }
  if (ex === 'CRYPTO' || ex === 'COMMODITY' || ex === 'FOREX' || ex === 'FX') {
    return 'Küresel / Emtia & Döviz';
  }
  if ((holding.originalCurrency || holding.currency || '').toUpperCase() === 'USD') {
    return 'ABD / Küresel (USD)';
  }
  return 'Belirtilmemiş';
}

function resolveAssetTypeLabel(holding: Holding): string {
  const cleaned = cleanSymbol(holding.symbol);
  const ex = (holding.exchange || cleaned.exchange || '').toUpperCase();
  if (holding.assetType === 'fund' || ex === 'TEFAS') return 'TEFAS Fonu';
  if (ex === 'BIST') return 'BIST Hisse Senedi';
  if (ex === 'NASDAQ' || ex === 'NYSE' || ex === 'AMEX') return 'ABD Hisse Senedi';
  if (ex === 'CRYPTO') return 'Kripto Varlık';
  if (ex === 'COMMODITY') return 'Emtia';
  return 'Diğer Varlık';
}

function addBucket(
  map: Map<string, { value: number; count: number }>,
  label: string,
  value: number
) {
  const cur = map.get(label) ?? { value: 0, count: 0 };
  cur.value += value;
  cur.count += 1;
  map.set(label, cur);
}

function finalizeBuckets(
  map: Map<string, { value: number; count: number }>,
  totalValue: number
): ConcentrationBucket[] {
  return Array.from(map.entries())
    .map(([label, item]) => ({
      label,
      valueTry: Number(item.value.toFixed(2)),
      weightPct: totalValue > 0 ? Number(((item.value / totalValue) * 100).toFixed(2)) : 0,
      count: item.count,
    }))
    .sort((a, b) => b.valueTry - a.valueTry || a.label.localeCompare(b.label, 'tr-TR'));
}

/**
 * Generates a single unified concentration & diversification report covering largest holdings,
 * sector distribution, country exposure, and asset-class mix.
 */
export function buildPortfolioConcentrationReport(input: {
  summary: PortfolioSummary;
  metadata?: AssetMetadataResolver;
  topLimit?: number;
}): PortfolioConcentrationReport {
  const topLimit = Math.max(3, Math.min(20, input.topLimit ?? 8));
  const valuedHoldings = input.summary.holdings.filter(
    (h) => h.totalQuantity > 0 && Number.isFinite(h.currentValue) && h.currentValue > 0
  );

  const positiveCashRows =
    input.summary.cash?.configured
      ? input.summary.cash.balances.filter((b) => typeof b.value === 'number' && b.value > 0)
      : [];

  const holdingsSum = valuedHoldings.reduce((s, h) => s + h.currentValue, 0);
  const cashSum = positiveCashRows.reduce((s, b) => s + (b.value ?? 0), 0);
  const totalAnalyzedValue = Number((holdingsSum + cashSum).toFixed(2));

  const sectorMap = new Map<string, { value: number; count: number }>();
  const countryMap = new Map<string, { value: number; count: number }>();
  const assetTypeMap = new Map<string, { value: number; count: number }>();

  const enrichedPositions: TopPositionItem[] = [];

  for (const holding of valuedHoldings) {
    const sym = cleanSymbol(holding.symbol).symbol || holding.symbol.toUpperCase();
    const assetTypeLabel = resolveAssetTypeLabel(holding);
    const country = resolveCountryLabel(holding);
    const rawSector =
      holding.assetType === 'fund'
        ? input.metadata?.getFundCategory?.(sym)
        : input.metadata?.getStockSector?.(sym);
    const sector =
      rawSector && rawSector.trim()
        ? rawSector.trim()
        : holding.assetType === 'fund'
          ? 'Yatırım Fonu (Kategori Belirtilmemiş)'
          : 'Sektör Verisi Yok';

    addBucket(sectorMap, sector, holding.currentValue);
    addBucket(countryMap, country, holding.currentValue);
    addBucket(assetTypeMap, assetTypeLabel, holding.currentValue);

    enrichedPositions.push({
      symbol: sym,
      assetTypeLabel,
      sector,
      country,
      valueTry: Number(holding.currentValue.toFixed(2)),
      weightPct:
        totalAnalyzedValue > 0
          ? Number(((holding.currentValue / totalAnalyzedValue) * 100).toFixed(2))
          : 0,
    });
  }

  for (const cashRow of positiveCashRows) {
    const val = cashRow.value ?? 0;
    const cur = (cashRow.currency || 'TRY').toUpperCase();
    const cashCountry =
      cur === 'TRY' ? 'Türkiye' : cur === 'USD' ? 'ABD' : cur === 'EUR' ? 'Avrupa' : 'Küresel';
    addBucket(sectorMap, 'Nakit / Likidite', val);
    addBucket(countryMap, cashCountry, val);
    addBucket(assetTypeMap, `Nakit (${cur})`, val);
  }

  enrichedPositions.sort((a, b) => b.valueTry - a.valueTry);

  // HHI computed across individual equity/fund positions + cash as a single liquidity block
  const unitShares: number[] = enrichedPositions.map((p) =>
    totalAnalyzedValue > 0 ? p.valueTry / totalAnalyzedValue : 0
  );
  if (cashSum > 0 && totalAnalyzedValue > 0) {
    unitShares.push(cashSum / totalAnalyzedValue);
  }

  const sumSquared = unitShares.reduce((sum, s) => sum + s * s, 0);
  const hhiIndex = Math.round(sumSquared * 10_000);
  const effectivePositions = sumSquared > 0 ? Number((1 / sumSquared).toFixed(2)) : 0;

  const top1WeightPct = enrichedPositions[0]?.weightPct ?? 0;
  const top3WeightPct = Number(
    enrichedPositions.slice(0, 3).reduce((s, p) => s + p.weightPct, 0).toFixed(2)
  );
  const top5WeightPct = Number(
    enrichedPositions.slice(0, 5).reduce((s, p) => s + p.weightPct, 0).toFixed(2)
  );

  const sectorBreakdown = finalizeBuckets(sectorMap, totalAnalyzedValue);
  const countryBreakdown = finalizeBuckets(countryMap, totalAnalyzedValue);
  const assetTypeBreakdown = finalizeBuckets(assetTypeMap, totalAnalyzedValue);

  let concentrationLevel: ConcentrationLevel = 'diversified';
  let concentrationLabel = 'Dengeli Çeşitlilik';
  if (hhiIndex >= 2500 || top1WeightPct >= 40) {
    concentrationLevel = 'high';
    concentrationLabel = 'Yüksek Yoğunlaşma';
  } else if (hhiIndex >= 1500 || top3WeightPct >= 75) {
    concentrationLevel = 'moderate';
    concentrationLabel = 'Orta Yoğunlaşma';
  }

  const warnings: string[] = [];
  if (top1WeightPct >= 35 && enrichedPositions[0]) {
    warnings.push(
      `En büyük pozisyon (${enrichedPositions[0].symbol}) toplam portföyün %${top1WeightPct.toFixed(1)} oranını oluşturuyor.`
    );
  }
  const topSector = sectorBreakdown[0];
  if (topSector && topSector.weightPct >= 50 && topSector.label !== 'Nakit / Likidite') {
    warnings.push(
      `${topSector.label} sektörü portföyün %${topSector.weightPct.toFixed(1)} ağırlığına sahip.`
    );
  }
  const topCountry = countryBreakdown[0];
  if (topCountry && topCountry.weightPct >= 85 && valuedHoldings.length >= 2) {
    warnings.push(
      `Portföyün %${topCountry.weightPct.toFixed(1)} bölümü tek coğrafi pazarda (${topCountry.label}) toplanmış.`
    );
  }

  return {
    totalAnalyzedValue,
    positionCount: valuedHoldings.length,
    hhiIndex,
    effectivePositions,
    concentrationLevel,
    concentrationLabel,
    top1WeightPct,
    top3WeightPct,
    top5WeightPct,
    topPositions: enrichedPositions.slice(0, topLimit),
    sectorBreakdown,
    countryBreakdown,
    assetTypeBreakdown,
    warnings,
  };
}
