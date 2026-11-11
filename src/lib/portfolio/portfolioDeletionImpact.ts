import type { Portfolio, Transaction } from '@/types/portfolio';

export interface PortfolioDeletionImpact {
  portfolioId: string;
  portfolioName: string;
  transactionCount: number;
  distinctSymbolCount: number;
  impactSummary: string;
}

/**
 * Computes the user-visible deletion impact for a specific portfolio before confirmation.
 */
export function computePortfolioDeletionImpact(input: {
  portfolio: Pick<Portfolio, 'id' | 'name'>;
  transactions: ReadonlyArray<Pick<Transaction, 'portfolioId' | 'symbol'>>;
}): PortfolioDeletionImpact {
  const portfolioTransactions = input.transactions.filter(
    (tx) => tx.portfolioId === input.portfolio.id
  );
  const distinctSymbols = new Set(
    portfolioTransactions
      .map((tx) => String(tx.symbol || '').trim().toUpperCase())
      .filter(Boolean)
  );

  const transactionCount = portfolioTransactions.length;
  const distinctSymbolCount = distinctSymbols.size;

  const impactSummary = `"${input.portfolio.name}" portföyü silindiğinde ${transactionCount} adet işlem kaydı ve ${distinctSymbolCount} farklı varlığa ait tüm pozisyon geçmişi kalıcı olarak silinecektir.`;

  return {
    portfolioId: input.portfolio.id,
    portfolioName: input.portfolio.name,
    transactionCount,
    distinctSymbolCount,
    impactSummary,
  };
}
