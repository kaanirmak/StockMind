export interface SearchResultMetaInput {
  symbol?: string | null;
  code?: string | null;
  name?: string | null;
  exchange?: string | null;
  currency?: string | null;
  assetType?: string | null;
  kind?: string | null;
  isIndex?: boolean;
}

export interface SearchResultDescriptor {
  symbol: string;
  name: string;
  exchange: string;
  assetTypeLabel: string;
  currency: string;
}

export function describeSearchResult(input: SearchResultMetaInput): SearchResultDescriptor {
  const rawSym = (input.symbol || input.code || '').trim().toUpperCase();
  const symbol = rawSym.endsWith('.IS') ? rawSym.slice(0, -3) : rawSym;
  const name = (input.name || symbol).trim();

  const rawType = (input.assetType || '').trim().toLowerCase();
  const rawKind = (input.kind || '').trim().toLowerCase();
  const rawExchange = (input.exchange || '').trim().toUpperCase();
  const isFund = rawType === 'fund' || rawKind === 'fon' || rawExchange === 'TEFAS';

  let exchange = rawExchange;
  if (isFund) {
    exchange = 'TEFAS';
  } else if (!exchange) {
    exchange = rawSym.endsWith('.IS') ? 'BIST' : 'ABD';
  }

  let assetTypeLabel = 'Hisse';
  if (isFund) {
    assetTypeLabel = 'Fon';
  } else if (exchange === 'CRYPTO') {
    assetTypeLabel = 'Kripto';
  } else if (exchange === 'COMMODITY') {
    assetTypeLabel = 'Emtia';
  } else if (exchange === 'FOREX') {
    assetTypeLabel = 'Döviz';
  } else if (exchange === 'INDEX' || input.isIndex) {
    assetTypeLabel = 'Endeks';
  }

  let currency = (input.currency || '').trim().toUpperCase();
  if (!currency) {
    currency = exchange === 'BIST' || exchange === 'TEFAS' ? 'TRY' : 'USD';
  }

  return {
    symbol,
    name,
    exchange,
    assetTypeLabel,
    currency,
  };
}
