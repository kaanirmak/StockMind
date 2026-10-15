'use client';

import React, { useState } from 'react';
import { BROKERS, Broker } from '@/lib/data/brokers';
import { useToast } from '@/components/ui';

export interface BrokerDirectoryProps {
  selectedSymbol?: string;
  onSelectBroker?: (broker: Broker) => void;
  className?: string;
}

export const BrokerDirectory: React.FC<BrokerDirectoryProps> = ({
  selectedSymbol,
  onSelectBroker,
  className = '',
}) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    'ALL' | 'POPULAR' | 'Dijital / FinTech' | 'Banka İştiraki' | 'Bağımsız Kurum'
  >('ALL');

  const handleOpenBroker = (broker: Broker) => {
    if (onSelectBroker) {
      onSelectBroker(broker);
      return;
    }

    const symText = selectedSymbol ? `${selectedSymbol.toUpperCase()} alım-satım işlemi için ` : '';
    showToast({
      type: 'info',
      title: `${broker.shortName}'a Yönlendiriliyorsunuz`,
      message: `${symText}${broker.name} güvenli resmi platformu açılıyor...`,
    });
    window.open(broker.url, '_blank', 'noopener,noreferrer');
  };

  const filtered = BROKERS.filter((b) => {
    if (categoryFilter === 'POPULAR' && !b.popular) return false;
    if (
      categoryFilter !== 'ALL' &&
      categoryFilter !== 'POPULAR' &&
      b.category !== categoryFilter
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.shortName.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.badge.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Symbol Trading Hint Header */}
      {selectedSymbol && (
        <div className="p-3 bg-accent/10 border border-accent/25 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white font-mono font-bold text-xs shrink-0">
              {selectedSymbol.slice(0, 4)}
            </span>
            <div className="min-w-0">
              <span className="font-bold text-xs text-text-primary block font-mono">
                {selectedSymbol} İşlemi Yap
              </span>
              <p className="text-[11px] text-text-muted truncate">
                Emir iletimi için aşağıdaki aracı kurumlardan birini seçin
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20 shrink-0">
            Aracı Kurum Seçimi
          </span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Aracı kurum ara (Midas, Piapiri, Garanti, İş Yatırım vb.)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full py-2.5 pl-9 pr-8 bg-bg-secondary text-text-primary rounded-xl border border-border text-xs focus:outline-hidden focus:border-accent transition-colors placeholder:text-text-muted"
        />
        <svg
          className="w-4 h-4 text-text-muted absolute left-3 top-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary text-xs cursor-pointer p-1"
            title="Temizle"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-medium">
        <button
          type="button"
          onClick={() => setCategoryFilter('ALL')}
          className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
            categoryFilter === 'ALL'
              ? 'bg-accent text-white font-bold shadow-xs'
              : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
          }`}
        >
          Tümü ({BROKERS.length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('POPULAR')}
          className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
            categoryFilter === 'POPULAR'
              ? 'bg-accent text-white font-bold shadow-xs'
              : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
          }`}
        >
          ⭐ Popüler ({BROKERS.filter((b) => b.popular).length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('Dijital / FinTech')}
          className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
            categoryFilter === 'Dijital / FinTech'
              ? 'bg-accent text-white font-bold shadow-xs'
              : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
          }`}
        >
          ⚡ FinTech ({BROKERS.filter((b) => b.category === 'Dijital / FinTech').length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('Banka İştiraki')}
          className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
            categoryFilter === 'Banka İştiraki'
              ? 'bg-accent text-white font-bold shadow-xs'
              : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
          }`}
        >
          🏛️ Bankalar ({BROKERS.filter((b) => b.category === 'Banka İştiraki').length})
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('Bağımsız Kurum')}
          className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
            categoryFilter === 'Bağımsız Kurum'
              ? 'bg-accent text-white font-bold shadow-xs'
              : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border'
          }`}
        >
          🏢 Bağımsız ({BROKERS.filter((b) => b.category === 'Bağımsız Kurum').length})
        </button>
      </div>

      {/* Broker Cards List */}
      <div className="max-h-[340px] sm:max-h-[380px] overflow-y-auto pr-1 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-xs bg-bg-secondary/40 rounded-xl border border-dashed border-border">
            Aramanıza uygun aracı kurum bulunamadı.
          </div>
        ) : (
          filtered.map((b) => {
            const isMidas = b.id === 'midas';
            return (
              <div
                key={b.id}
                onClick={() => handleOpenBroker(b)}
                className={`group relative p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                  isMidas
                    ? 'border-indigo-500/50 bg-gradient-to-r from-bg-card via-indigo-950/20 to-bg-card hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                    : 'border-border/80 bg-gradient-to-r from-bg-card via-bg-secondary to-bg-card hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${b.gradient} flex items-center justify-center text-white font-black text-lg shadow-md shrink-0`}
                    >
                      {b.letter}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-text-primary group-hover:text-accent transition-colors">
                          {b.shortName}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isMidas
                              ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                              : 'bg-accent/10 text-accent border border-accent/20'
                          }`}
                        >
                          {b.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                        {b.description}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg-tertiary transition-all ${
                        isMidas
                          ? 'group-hover:bg-indigo-500 group-hover:text-white text-indigo-400'
                          : 'group-hover:bg-accent group-hover:text-white text-text-muted'
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SPK Disclaimer */}
      <div className="p-3 bg-bg-tertiary/60 rounded-xl border border-border/50 text-[11px] text-text-muted leading-relaxed flex items-start gap-2">
        <span className="text-sm shrink-0">🛡️</span>
        <span>
          <strong>Yasal Bilgilendirme:</strong> StockMind doğrudan emir iletimi veya aracılık yapmaz.
          Tüm işlemler seçtiğiniz SPK lisanslı yetkili aracı kurumun kendi resmi arayüzü üzerinden gerçekleştirilir.
        </span>
      </div>
    </div>
  );
};
