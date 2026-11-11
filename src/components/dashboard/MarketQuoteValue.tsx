import type { MarketOverviewItem } from '@/types/stock';
import { formatNumber, getPnLColor, getPnLSign } from '@/lib/utils/format';
import { classifyPriceStatus } from '@/lib/market/priceStatus';
import { PriceStatusBadge } from '@/components/ui/PriceStatusBadge';

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function inferOverviewExchange(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s === 'BTC' || s.startsWith('BTC')) return 'CRYPTO';
  if (s === 'USDTRY' || s === 'EURTRY') return 'FOREX';
  if (s === 'GA' || s === 'BRENT') return 'COMMODITY';
  if (s === 'XU100') return 'INDEX';
  return 'BIST';
}

export function MarketQuoteValue({ item, flash = '' }: { item: MarketOverviewItem; flash?: string }) {
  const statusInfo = classifyPriceStatus({
    price: item.value,
    observation: item.observation,
    exchange: inferOverviewExchange(item.symbol),
    isLastKnown: item.status === 'last-known',
  });

  if (item.value === null || !item.observation) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-text-muted">Veri alınamadı</p>
        <PriceStatusBadge statusInfo={statusInfo} />
      </div>
    );
  }

  const { source, asOf, fetchedAt } = item.observation;
  const time = asOf ?? fetchedAt;
  const value = formatNumber(item.value);
  const price = item.unit === 'points'
    ? `${value} puan`
    : item.currency === 'USDT'
      ? `${value} USDT`
      : `${item.currency === 'TRY' ? '₺' : '$'}${value}`;

  return (
    <>
      <div className={`text-sm sm:text-base font-bold font-mono text-text-primary whitespace-nowrap ${flash}`}>{price}</div>
      {item.change !== null && (
        <p className={`mt-0.5 text-xs font-semibold font-mono ${getPnLColor(item.change)}`}>
          {getPnLSign(item.change)}{formatNumber(Math.abs(item.change))}%
        </p>
      )}
      <div className="mt-1.5 space-y-1 text-[10px] leading-snug text-text-muted">
        <PriceStatusBadge statusInfo={statusInfo} />
        <p>
          {source}<br />
          {asOf ? 'Veri' : 'Alındı'} <time dateTime={time}>{dateFormat.format(new Date(time))}</time>
        </p>
      </div>
    </>
  );
}
