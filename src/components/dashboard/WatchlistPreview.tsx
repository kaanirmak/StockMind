'use client';

import Link from 'next/link';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { getPnLColor, getPnLSign } from '@/lib/utils/format';

export default function WatchlistPreview() {
  const { items } = useWatchlistStore();
  const previewItems = items.slice(0, 5);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text-primary">Takip Listesi</h3>
        <Link href="/watchlist" className="text-xs text-accent hover:text-accent-hover transition-colors">
          Tümünü Gör →
        </Link>
      </div>

      {previewItems.length === 0 ? (
        <div className="text-center py-8 text-text-muted space-y-2">
          <p className="text-xs">Takip listenizde henüz varlık yok.</p>
          <Link
            href="/stocks"
            className="inline-block text-xs text-accent hover:underline font-medium"
          >
            + Hisseleri Keşfet ve Ekle
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {previewItems.map((item) => {
            const link = item.assetType === 'stock' ? `/stocks/${item.symbol}` : `/funds/${item.symbol}`;

            return (
              <Link
                key={item.id}
                href={link}
                className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-bg-hover transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-sm font-semibold text-text-primary">{item.symbol}</p>
                  <p className="text-xs text-text-muted truncate max-w-[120px]">{item.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-text-primary">₺{item.price.toFixed(2)}</p>
                  <p className={`text-xs font-medium ${getPnLColor(item.changePercent)}`}>
                    {getPnLSign(item.changePercent)}{Math.abs(item.changePercent).toFixed(2)}%
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
