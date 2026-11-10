import type { MarketOverviewItem } from '@/types/stock';
import { formatNumber, getPnLColor, getPnLSign } from '@/lib/utils/format';

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function MarketQuoteValue({ item, flash = '' }: { item: MarketOverviewItem; flash?: string }) {
  if (item.value === null || !item.observation) {
    return <p className="text-xs font-medium text-text-muted">Veri alınamadı</p>;
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
      <p className="mt-1 text-[10px] leading-snug text-text-muted">
        {item.status === 'last-known' && <span className="block text-warning">Son alınan fiyat</span>}
        {source}<br />
        {asOf ? 'Veri' : 'Alındı'} <time dateTime={time}>{dateFormat.format(new Date(time))}</time>
      </p>
    </>
  );
}
