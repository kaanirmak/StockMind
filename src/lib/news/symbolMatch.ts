export interface NewsAssetIdentity {
  symbol: string;
  exchange?: string | null;
  name?: string | null;
  aliases?: string[];
}

export interface NewsAssetMatchResult {
  matched: boolean;
  symbol: string;
  exchange?: string;
  matchedBy: 'exchange_ticker' | 'cashtag' | 'company_alias' | 'ticker' | null;
  matchedTerm?: string;
}

// Explicit company aliases avoid treating generic economic words as portfolio matches.
const COMPANY_ALIASES: Record<string, string[]> = {
  ASELS: ['aselsan'],
  THYAO: ['türk hava yolları', 'turkish airlines'],
  MGROS: ['migros'],
  FROTO: ['ford otosan'],
  CCOLA: ['coca cola içecek', 'coca-cola içecek'],
  SISE: ['şişecam', 'şişe cam'],
  BIMAS: ['bim birleşik mağazalar'],
  TUPRS: ['tüpraş'],
  GARAN: ['garanti bbva', 'garanti bankası'],
  KCHOL: ['koç holding'],
  ARCLK: ['arçelik'],
  QQQ: ['invesco qqq'],
  EREGL: ['ereğli demir çelik', 'erdemir'],
  ISCTR: ['türkiye iş bankası', 'iş bankası'],
  YKBNK: ['yapı kredi bankası', 'yapı ve kredi bankası'],
  TCELL: ['turkcell'],
  PGSUS: ['pegasus hava yolları'],
  ENKAI: ['enka inşaat'],
  SAHOL: ['sabancı holding'],
  AKBNK: ['akbank'],
  KRDMD: ['kardemir'],
  PETKM: ['petkim'],
  ASTOR: ['astor enerji'],
  KONTR: ['kontrolmatik'],
  MAVI: ['mavi giyim', 'mavi jeans'],
  LOGO: ['logo yazılım'],
  SASA: ['sasa polyester'],
  HALKB: ['halkbank', 'türkiye halk bankası'],
  VAKBN: ['vakıfbank', 'türkiye vakıflar bankası'],
  ULKER: ['ülker bisküvi'],
  TTKOM: ['türk telekom'],
  TOASO: ['tofaş'],
  KOZAL: ['koza altın'],
  AAPL: ['apple', 'apple inc'],
  NVDA: ['nvidia'],
  MSFT: ['microsoft'],
  TSLA: ['tesla', 'tesla motors'],
  AMZN: ['amazon.com'],
  GOOGL: ['alphabet inc', 'google'],
  META: ['meta platforms'],
};

const EXCHANGE_BY_SYMBOL: Record<string, string> = {
  ASELS: 'BIST', THYAO: 'BIST', MGROS: 'BIST', FROTO: 'BIST', CCOLA: 'BIST',
  SISE: 'BIST', BIMAS: 'BIST', TUPRS: 'BIST', GARAN: 'BIST', KCHOL: 'BIST',
  ARCLK: 'BIST', EREGL: 'BIST', ISCTR: 'BIST', YKBNK: 'BIST', TCELL: 'BIST',
  PGSUS: 'BIST', ENKAI: 'BIST', SAHOL: 'BIST', AKBNK: 'BIST', KRDMD: 'BIST',
  PETKM: 'BIST', ASTOR: 'BIST', KONTR: 'BIST', MAVI: 'BIST', LOGO: 'BIST',
  SASA: 'BIST', HALKB: 'BIST', VAKBN: 'BIST', ULKER: 'BIST', TTKOM: 'BIST',
  TOASO: 'BIST', KOZAL: 'BIST',
  AAPL: 'NASDAQ', NVDA: 'NASDAQ', MSFT: 'NASDAQ', TSLA: 'NASDAQ',
  AMZN: 'NASDAQ', GOOGL: 'NASDAQ', META: 'NASDAQ', QQQ: 'NASDAQ',
};

// Month names and ordinary words must never become ticker matches by uppercasing prose.
const AMBIGUOUS_WORD_SYMBOLS = new Set([
  'OCAK', 'SUBAT', 'MART', 'NISAN', 'MAYIS', 'HAZIRAN', 'TEMMUZ', 'AGUSTOS',
  'EYLUL', 'EKIM', 'KASIM', 'ARALIK',
  'ON', 'IT', 'ALL', 'ARE', 'FOR', 'THE', 'AND', 'NEW', 'ONE',
  'MAVI', 'LOGO', 'SMART', 'LINK', 'GOLD', 'CASH', 'FAST', 'GOOD', 'BEST',
]);

const GENERIC_COMPANY_SUFFIX_RE =
  /\b(?:t\.?a\.?s\.?|a\.?s\.?|inc\.?|corp\.?|corporation|ltd\.?|llc|plc|holding|yatirim|fonu)\b/gi;

export function normalizeNewsText(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseIdentity(input: NewsAssetIdentity | string): {
  symbol: string;
  exchange?: string;
  aliases: string[];
} {
  if (typeof input === 'string') {
    const trimmed = input.trim().toUpperCase();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const ex = trimmed.slice(0, colonIdx).trim();
      const sym = trimmed.slice(colonIdx + 1).replace(/\.IS$/, '').trim();
      return { symbol: sym, exchange: ex, aliases: COMPANY_ALIASES[sym] || [] };
    }
    const sym = trimmed.replace(/\.IS$/, '');
    return {
      symbol: sym,
      exchange: trimmed.endsWith('.IS') ? 'BIST' : EXCHANGE_BY_SYMBOL[sym],
      aliases: COMPANY_ALIASES[sym] || [],
    };
  }

  const rawSym = input.symbol.trim().toUpperCase();
  const cleanSym = rawSym.includes(':') ? rawSym.split(':', 2)[1] : rawSym;
  const sym = cleanSym.replace(/\.IS$/, '').trim();
  const exchange = (input.exchange || (rawSym.endsWith('.IS') ? 'BIST' : EXCHANGE_BY_SYMBOL[sym]) || '')
    .trim()
    .toUpperCase() || undefined;

  const extraAliases: string[] = [...(COMPANY_ALIASES[sym] || []), ...(input.aliases || [])];
  if (input.name && input.name.trim().length > 0) {
    const cleaned = input.name.replace(GENERIC_COMPANY_SUFFIX_RE, ' ').replace(/\s+/g, ' ').trim();
    const normCleaned = normalizeNewsText(cleaned);
    if (normCleaned.length >= 5 && !AMBIGUOUS_WORD_SYMBOLS.has(normCleaned.toUpperCase())) {
      extraAliases.push(cleaned);
    }
  }

  return {
    symbol: sym,
    exchange,
    aliases: Array.from(new Set(extraAliases)),
  };
}

function areExchangesCompatible(targetExchange: string | undefined, detectedExchange: string): boolean {
  if (!targetExchange) return true;
  const target = targetExchange.toUpperCase();
  const detected = detectedExchange.toUpperCase();
  if (target === detected) return true;
  if (target === 'ABD' && (detected === 'NASDAQ' || detected === 'NYSE')) return true;
  if ((target === 'NASDAQ' || target === 'NYSE') && detected === 'ABD') return true;
  return false;
}

export function matchNewsAssetIdentity(
  text: string,
  identity: NewsAssetIdentity | string,
  articleMeta?: { category?: string | null; source?: string | null }
): NewsAssetMatchResult {
  const parsed = parseIdentity(identity);
  const { symbol, exchange, aliases } = parsed;

  if (!/^[A-Z0-9_.:=^/-]{1,40}$/.test(symbol)) {
    return { matched: false, symbol, exchange, matchedBy: null };
  }

  const escaped = escapeRegExp(symbol);
  const explicitExMatches = Array.from(
    text.matchAll(new RegExp(`\\b(BIST|NASDAQ|NYSE|TEFAS|CRYPTO)\\s*:\\s*${escaped}(?![\\p{L}\\p{N}_])`, 'giu'))
  );
  const hasBistDotIs = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}\\.IS(?![\\p{L}\\p{N}_])`, 'u').test(text);

  if (explicitExMatches.length > 0 || hasBistDotIs) {
    const detectedExchanges = [
      ...explicitExMatches.map((m) => m[1].toUpperCase()),
      ...(hasBistDotIs ? ['BIST'] : []),
    ];
    if (detectedExchanges.some((det) => areExchangesCompatible(exchange, det))) {
      return {
        matched: true,
        symbol,
        exchange,
        matchedBy: 'exchange_ticker',
        matchedTerm: hasBistDotIs ? `${symbol}.IS` : explicitExMatches[0][0],
      };
    }
    // Text explicitly attaches this ticker to a different exchange (e.g., NASDAQ:XYZ vs BIST:XYZ)
    return { matched: false, symbol, exchange, matchedBy: null };
  }

  // Cashtag or hashtag ($THYAO, #ASELS) always identifies an explicit ticker mention
  const cashtagMatch = text.match(new RegExp(`[$#]${escaped}(?![\\p{L}\\p{N}_])`, 'u'));
  if (cashtagMatch) {
    return {
      matched: true,
      symbol,
      exchange,
      matchedBy: 'cashtag',
      matchedTerm: cashtagMatch[0],
    };
  }

  // Normalized company alias check
  const normalizedText = normalizeNewsText(text);
  for (const alias of aliases) {
    const normAlias = normalizeNewsText(alias);
    if (!normAlias) continue;
    const pattern = escapeRegExp(normAlias);
    if (new RegExp(`(^|[^\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, 'u').test(normalizedText)) {
      return {
        matched: true,
        symbol,
        exchange,
        matchedBy: 'company_alias',
        matchedTerm: alias,
      };
    }
  }

  // Reject ambiguous prose/month symbols unless explicit cashtag/exchange/alias matched above
  if (AMBIGUOUS_WORD_SYMBOLS.has(symbol)) {
    return { matched: false, symbol, exchange, matchedBy: null };
  }

  // Guard against bare-ticker cross-exchange collisions when text explicitly pins another exchange
  if (exchange) {
    const mentionsUsVenue = /\b(?:NASDAQ|NYSE|WALL STREET|S&P\s*500)\b/i.test(text);
    const mentionsTrVenue = /\b(?:BIST|BORSA İSTANBUL|BORSA ISTANBUL|KAP)\b/i.test(text);

    if (exchange === 'BIST' && mentionsUsVenue && !mentionsTrVenue) {
      return { matched: false, symbol, exchange, matchedBy: null };
    }
    if ((exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'ABD') && mentionsTrVenue && !mentionsUsVenue) {
      return { matched: false, symbol, exchange, matchedBy: null };
    }
    if (articleMeta?.category === 'BIST' && (exchange === 'NASDAQ' || exchange === 'NYSE')) {
      // Bare ticker matching in a strictly domestic BIST article must match only if US context appears
      if (!mentionsUsVenue && symbol.length <= 4) {
        return { matched: false, symbol, exchange, matchedBy: null };
      }
    }
  }

  if (symbol.length >= 3 && new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(text)) {
    return {
      matched: true,
      symbol,
      exchange,
      matchedBy: 'ticker',
      matchedTerm: symbol,
    };
  }

  return { matched: false, symbol, exchange, matchedBy: null };
}

export function mentionsNewsSymbol(text: string, symbol: string): boolean {
  return matchNewsAssetIdentity(text, symbol).matched;
}
