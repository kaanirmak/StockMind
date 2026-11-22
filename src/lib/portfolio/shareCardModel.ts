import type { Holding } from '@/types/portfolio';

export interface ShareCardAllocationSlice {
  label: string;
  percentage: number;
  color: string;
}

export interface ShareCardHoldingItem {
  symbol: string;
  weightPercent: number;
  pnlPercent: number;
  pnlPercentText: string;
  isPositive: boolean;
}

export interface PortfolioShareCardInput {
  portfolioName: string;
  periodLabel: string;
  totalValue: number;
  pnl: number;
  pnlPercent: number;
  pnlAvailable: boolean;
  maskValues?: boolean;
  allocation: Array<{ label: string; value?: number; percentage: number; color: string }>;
  holdings: Array<Pick<Holding, 'symbol' | 'weight' | 'pnlPercent' | 'currentValue'>>;
  generatedAt?: Date;
}

export interface PortfolioShareCardModel {
  portfolioName: string;
  periodLabel: string;
  maskValues: boolean;
  totalValueText: string;
  pnlAmountText: string;
  pnlPercentText: string;
  isPositive: boolean;
  pnlAvailable: boolean;
  topHoldings: ShareCardHoldingItem[];
  allocation: ShareCardAllocationSlice[];
  generatedAtLabel: string;
  disclaimer: string;
}

function formatSignedTry(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  const formatted = Math.abs(amount).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}₺${formatted}`;
}

export function formatSignedSharePercent(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '%0,00';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const formatted = Math.abs(value).toLocaleString('tr-TR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${sign}%${formatted}`;
}

export function buildPortfolioShareCardModel(
  input: PortfolioShareCardInput
): PortfolioShareCardModel {
  const maskValues = input.maskValues !== false;
  const safeTotal = Number.isFinite(input.totalValue) ? Math.max(0, input.totalValue) : 0;
  const safePnl = Number.isFinite(input.pnl) ? input.pnl : 0;
  const safePnlPct = Number.isFinite(input.pnlPercent) ? input.pnlPercent : 0;
  const isPositive = safePnl >= 0;

  const totalValueText = maskValues
    ? '₺••••••'
    : `₺${safeTotal.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

  const pnlAmountText = !input.pnlAvailable
    ? 'Veri eksik'
    : maskValues
      ? '•••• ₺'
      : formatSignedTry(safePnl);

  const pnlPercentText = !input.pnlAvailable
    ? 'Veri eksik'
    : formatSignedSharePercent(safePnlPct, 2);

  const totalHoldingsValue = input.holdings.reduce(
    (sum, item) => sum + (Number.isFinite(item.currentValue) && item.currentValue > 0 ? item.currentValue : 0),
    0
  );

  const topHoldings: ShareCardHoldingItem[] = [...input.holdings]
    .sort((a, b) => (b.weight || b.currentValue || 0) - (a.weight || a.currentValue || 0))
    .slice(0, 4)
    .map((holding) => {
      const weightPercent =
        Number.isFinite(holding.weight) && holding.weight > 0
          ? holding.weight
          : totalHoldingsValue > 0
            ? (Math.max(0, holding.currentValue) / totalHoldingsValue) * 100
            : 0;
      const pct = Number.isFinite(holding.pnlPercent) ? holding.pnlPercent : 0;
      return {
        symbol: holding.symbol.toUpperCase(),
        weightPercent: Number(weightPercent.toFixed(1)),
        pnlPercent: pct,
        pnlPercentText: formatSignedSharePercent(pct, 1),
        isPositive: pct >= 0,
      };
    });

  const allocation: ShareCardAllocationSlice[] = input.allocation
    .filter((slice) => Number.isFinite(slice.percentage) && slice.percentage > 0)
    .slice(0, 4)
    .map((slice) => ({
      label: slice.label,
      percentage: Number(slice.percentage.toFixed(1)),
      color: slice.color || '#7c3aed',
    }));

  const dateObj = input.generatedAt ?? new Date();
  const generatedAtLabel = dateObj.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    portfolioName: input.portfolioName.trim() || 'Ana Portföy',
    periodLabel: input.periodLabel.trim() || 'Günlük',
    maskValues,
    totalValueText,
    pnlAmountText,
    pnlPercentText,
    isPositive,
    pnlAvailable: input.pnlAvailable,
    topHoldings,
    allocation,
    generatedAtLabel,
    disclaimer: 'Yatırım tavsiyesi değildir. Gösterge verileri bilgilendirme amaçlıdır.',
  };
}

export function formatShareCardClipboardSummary(model: PortfolioShareCardModel): string {
  const lines = [
    `StockMind · ${model.portfolioName} (${model.periodLabel})`,
    `Portföy Değeri: ${model.totalValueText}`,
    `Getiri: ${model.pnlPercentText}${model.pnlAvailable ? ` (${model.pnlAmountText})` : ''}`,
  ];

  if (model.topHoldings.length > 0) {
    lines.push(
      `Öne Çıkan Pozisyonlar: ${model.topHoldings
        .map((h) => `${h.symbol} %${h.weightPercent.toFixed(1).replace('.', ',')} (${h.pnlPercentText})`)
        .join(' · ')}`
    );
  }

  lines.push(`Tarih: ${model.generatedAtLabel} · ${model.disclaimer}`);
  return lines.join('\n');
}
