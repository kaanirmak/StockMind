export type PortfolioDisplayPhase = 'loading' | 'empty' | 'zero_value' | 'active';

export interface PortfolioDisplayStateInput {
  authLoading: boolean;
  portfolioLoading: boolean;
  hasLoaded: boolean;
  isSampleMode?: boolean;
  transactionsCount: number;
  cashConfigured: boolean;
  holdingsCount: number;
  totalValue: number;
}

/**
 * Separates loading state, a truly empty portfolio (never initialized),
 * and an active portfolio whose current market value happens to equal zero.
 */
export function resolvePortfolioDisplayPhase(
  input: PortfolioDisplayStateInput,
): PortfolioDisplayPhase {
  if (input.isSampleMode) {
    return 'active';
  }
  if (input.authLoading || input.portfolioLoading || !input.hasLoaded) {
    return 'loading';
  }
  if (
    input.transactionsCount === 0 &&
    input.holdingsCount === 0 &&
    !input.cashConfigured
  ) {
    return 'empty';
  }
  if (Math.abs(input.totalValue) < 0.005) {
    return 'zero_value';
  }
  return 'active';
}
