/**
 * Turkish and Global Fuzzy Search & Typo Matching Utilities
 */

// Turkish character mapping for normalization
const TR_CHAR_MAP: Record<string, string> = {
  ç: 'c',
  Ç: 'c',
  ğ: 'g',
  Ğ: 'g',
  ı: 'i',
  I: 'i',
  İ: 'i',
  i: 'i',
  ö: 'o',
  Ö: 'o',
  ş: 's',
  Ş: 's',
  ü: 'u',
  Ü: 'u',
};

/**
 * Normalize string by removing Turkish accents, lowercase, and trimming
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .split('')
    .map((char) => TR_CHAR_MAP[char] || char)
    .join('')
    .toLowerCase()
    .trim();
}

/**
 * Compute Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Common ticker aliases and phonetic/typo mappings (Turkish & English)
 */
export const POPULAR_ALIASES: Record<string, string[]> = {
  AAPL: ['apple', 'aple', 'aplib', 'appl', 'apll', 'aple', 'app'],
  THYAO: ['thy', 'turk hava yollari', 'turkhavayollari', 'hava', 'havayolu', 'turkish airlines', 'haa'],
  KCHOL: ['koc', 'kocholding', 'koc holding', 'kchol', 'koc holding a.s.'],
  TUPRS: ['tupras', 'tupra', 'tupr', 'tupras rafinerileri', 'rafineri'],
  GARAN: ['garanti', 'garantibbva', 'garanti bankasi', 'bbva'],
  ISCTR: ['isbank', 'isbankasi', 'is bankasi', 'is c', 'is bank'],
  AKBNK: ['akbank', 'ak bank', 'akbnk'],
  YKBNK: ['yapikredi', 'yapi kredi', 'yapi kredi bankasi', 'ykb'],
  VAKBN: ['vakif', 'vakifbank', 'vakif bank', 'vakiflar'],
  HALKB: ['halk', 'halkbank', 'halk bankasi', 'haa', 'halkb'],
  ASELS: ['aselsan', 'aselsan elektronik', 'savunma', 'asels'],
  EREGL: ['eregli', 'erdemir', 'eregli demir celik', 'demir celik'],
  SISE: ['sise', 'sisecam', 'turkiye sise ve cam'],
  BIMAS: ['bim', 'bim magazalar', 'bimas'],
  MGROS: ['migros', 'migros ticaret'],
  SASA: ['sasa', 'sasa polyester'],
  HEKTS: ['hektas', 'hektas ticaret'],
  KONTR: ['kontr', 'kontrolmatik', 'kontrolmatik teknoloji'],
  ASTOR: ['astor', 'astor enerji', 'transformator'],
  REEDR: ['reeder', 'reeder teknoloji'],
  TCELL: ['turkcell', 'turkcell iletisim'],
  TTKOM: ['turk telekom', 'turktelekom', 'telekom'],
  PETKM: ['petkim', 'petrokimya'],
  TSLA: ['tesla', 'tesla motors', 'elon'],
  NVDA: ['nvidia', 'nvdia', 'cip', 'ekran karti', 'gpu'],
  MSFT: ['microsoft', 'windows', 'xbox'],
  GOOGL: ['google', 'alphabet', 'goog'],
  AMZN: ['amazon', 'aws', 'e-ticaret'],
  META: ['meta', 'facebook', 'instagram', 'whatsapp'],
  PLTR: ['palantir', 'palantir tech'],
  COIN: ['coinbase', 'crypto'],
  MSTR: ['microstrategy', 'bitcoin holding', 'saylor'],
  THF: ['tera hisse', 'tera portfoy', 'tera hisse senedi'],
  TI2: ['is portfoy bist 100 disi', 'is portfoy ti2', 'ti2'],
  AFT: ['ak portfoy amerika', 'ak amerika', 'aft'],
  YAY: ['yapi kredi teknoloji', 'yay fonu', 'yabanci teknoloji'],
  TP2: ['tera para piyasasi', 'tera ppf', 'tp2'],
};

/**
 * Calculate match score between item and user query (0 = no match, 100 = perfect match)
 */
export function calculateFuzzyScore(
  query: string,
  symbol: string,
  name: string,
  extraKeywords?: string[]
): number {
  const normQuery = normalizeText(query);
  if (!normQuery) return 0;

  const normSymbol = normalizeText(symbol);
  const normName = normalizeText(name);

  // 1. Exact Symbol Match
  if (normSymbol === normQuery) {
    return 100;
  }

  // 2. Exact Aliases Match (e.g., query 'aplib' -> 'AAPL')
  const aliases = POPULAR_ALIASES[symbol.toUpperCase()] || [];
  for (const alias of aliases) {
    const normAlias = normalizeText(alias);
    if (normAlias === normQuery) {
      return 98;
    }
    if (normAlias.startsWith(normQuery) || normQuery.startsWith(normAlias)) {
      return 92;
    }
    if (normQuery.length >= 3 && levenshteinDistance(normQuery, normAlias) <= 1) {
      return 88;
    }
  }

  // 3. Symbol starts with query (e.g., query 'th' -> 'THYAO', 'ap' -> 'AAPL')
  if (normSymbol.startsWith(normQuery)) {
    return 95 - (normSymbol.length - normQuery.length);
  }

  // 4. Symbol contains query (e.g., query 'ya' -> 'THYAO')
  if (normSymbol.includes(normQuery)) {
    return 85;
  }

  // 5. Name starts with query
  if (normName.startsWith(normQuery)) {
    return 80;
  }

  // 6. Name contains any word that starts with query (e.g. query 'apple' in 'Apple Inc.')
  const words = normName.split(/\s+/);
  for (const word of words) {
    if (word === normQuery) return 82;
    if (word.startsWith(normQuery)) return 76;
  }

  // 7. Name contains query substring
  if (normName.includes(normQuery)) {
    return 65;
  }

  // 8. Extra keywords (e.g., category, founder)
  if (extraKeywords) {
    for (const kw of extraKeywords) {
      const normKw = normalizeText(kw);
      if (normKw.includes(normQuery)) {
        return 60;
      }
    }
  }

  // 9. Levenshtein Typo Tolerance on Symbol (e.g. 'aplib' vs 'aapl', 'haa' vs 'halkb')
  if (normQuery.length >= 3) {
    const dist = levenshteinDistance(normQuery, normSymbol);
    if (dist <= 1) {
      return 75;
    }
    if (dist === 2 && normQuery.length >= 4) {
      return 60;
    }

    // Typo match on any word in the name
    for (const word of words) {
      if (word.length >= 4) {
        const wordDist = levenshteinDistance(normQuery, word);
        if (wordDist <= 1) return 68;
        if (wordDist === 2 && normQuery.length >= 5) return 55;
      }
    }
  }

  return 0;
}
