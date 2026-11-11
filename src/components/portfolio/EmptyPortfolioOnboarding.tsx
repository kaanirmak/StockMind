'use client';

import React from 'react';
import { Button } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { EMPTY_PORTFOLIO_ACTIONS } from '@/lib/portfolio/emptyOnboarding';

export interface EmptyPortfolioOnboardingProps {
  onAddTransaction: () => void;
  onImportExcel?: () => void;
  onExploreSamplePortfolio?: () => void;
}

export const EmptyPortfolioOnboarding: React.FC<EmptyPortfolioOnboardingProps> = ({
  onAddTransaction,
  onImportExcel,
  onExploreSamplePortfolio,
}) => {
  const handlers: Record<(typeof EMPTY_PORTFOLIO_ACTIONS)[number]['id'], (() => void) | undefined> = {
    first_trade: onAddTransaction,
    excel_import: onImportExcel,
    sample_portfolio: onExploreSamplePortfolio,
  };

  const icons: Record<(typeof EMPTY_PORTFOLIO_ACTIONS)[number]['id'], 'plus' | 'download' | 'sparkles'> = {
    first_trade: 'plus',
    excel_import: 'download',
    sample_portfolio: 'sparkles',
  };

  return (
    <section
      data-testid="empty-portfolio-onboarding"
      aria-label="Portföy başlangıç seçenekleri"
      className="glass-card p-5 sm:p-8 space-y-5 border border-border/80"
    >
      <div className="text-center max-w-xl mx-auto space-y-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/25 text-[11px] font-semibold">
          Hızlı Başlangıç
        </span>
        <h3 className="text-lg sm:text-xl font-bold text-text-primary">
          Portföyünüzü oluşturmaya nasıl başlamak istersiniz?
        </h3>
        <p className="text-xs sm:text-sm text-text-muted">
          İlk işleminizi kaydedebilir, Excel ekstrenizi yükleyebilir veya kayıtlarınıza dokunmadan örnek portföyü inceleyebilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {EMPTY_PORTFOLIO_ACTIONS.map((action) => {
          const handler = handlers[action.id];
          const isPrimary = action.id === 'first_trade';
          return (
            <div
              key={action.id}
              data-testid={`empty-action-${action.id}`}
              className={`rounded-2xl p-4 flex flex-col justify-between gap-4 border transition-colors ${
                isPrimary
                  ? 'bg-accent/10 border-accent/35'
                  : 'bg-bg-secondary/60 border-border/70 hover:border-border'
              }`}
            >
              <div className="space-y-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                    isPrimary
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg-tertiary text-accent border-border'
                  }`}
                >
                  <Icon name={icons[action.id]} className="w-4 h-4" />
                </div>
                <h4 className="text-sm sm:text-base font-bold text-text-primary">
                  {action.title}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  {action.description}
                </p>
              </div>

              {handler ? (
                <Button
                  type="button"
                  size="sm"
                  variant={isPrimary ? 'primary' : 'outline'}
                  onClick={handler}
                  className="w-full justify-center"
                >
                  {action.ctaLabel}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled
                  className="w-full justify-center"
                >
                  {action.ctaLabel}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
