'use client';

import React from 'react';
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

      {/* Broker Cards List */}
      <div className="space-y-2.5">
        {BROKERS.map((b) => {
            const isMidas = b.id === 'midas';
            return (
              <button
                type="button"
                key={b.id}
                onClick={() => handleOpenBroker(b)}
                className={`w-full text-left group relative p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer overflow-hidden ${
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
              </button>
            );
          })}
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
