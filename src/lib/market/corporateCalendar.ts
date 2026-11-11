import type { UpcomingEventItem, UpcomingEventType } from './upcomingEvents';

export type CalendarScopeFilter = 'ALL' | 'PORTFOLIO' | 'WATCHLIST';
export type CalendarTypeFilter = 'ALL' | 'earnings' | 'dividend';

export interface AnnotatedCalendarEvent extends UpcomingEventItem {
  inPortfolio: boolean;
  inWatchlist: boolean;
}

export const DEFAULT_CALENDAR_SYMBOLS = [
  'THYAO.IS',
  'ASELS.IS',
  'TUPRS.IS',
  'BIMAS.IS',
  'GARAN.IS',
  'AAPL',
  'MSFT',
  'NVDA',
] as const;

export function normalizeCalendarSymbol(raw: string | null | undefined): string {
  const upper = (raw || '').trim().toUpperCase();
  if (!upper) return '';
  if (upper.includes(':')) {
    return upper.split(':').pop()?.trim() || upper;
  }
  return upper;
}

function symbolMatchesSet(symbol: string, set: Set<string>): boolean {
  const norm = normalizeCalendarSymbol(symbol);
  if (!norm) return false;
  if (set.has(norm)) return true;
  const base = norm.replace(/\.[A-Z0-9]+$/, '');
  if (base && set.has(base)) return true;
  for (const item of set) {
    if (item.replace(/\.[A-Z0-9]+$/, '') === base) {
      return true;
    }
  }
  return false;
}

export function collectCalendarTargetSymbols(params: {
  portfolioAssets: Array<{ symbol: string; exchange?: string | null; assetType?: string | null }>;
  watchlistAssets: Array<{ symbol: string; exchange?: string | null; assetType?: string | null }>;
  maxSymbols?: number;
}): string[] {
  const maxSymbols = params.maxSymbols ?? 16;
  const seen = new Set<string>();
  const targets: string[] = [];

  const pushAsset = (asset: { symbol: string; exchange?: string | null; assetType?: string | null }) => {
    if (asset.assetType === 'fund' || asset.exchange === 'TEFAS') return;
    if (asset.exchange && ['CRYPTO', 'FOREX', 'COMMODITY', 'INDEX'].includes(asset.exchange.toUpperCase())) {
      return;
    }
    const base = normalizeCalendarSymbol(asset.symbol);
    if (!base) return;
    const canonical =
      !base.includes('.') && asset.exchange?.toUpperCase() === 'BIST' ? `${base}.IS` : base;
    if (seen.has(canonical)) return;
    seen.add(canonical);
    targets.push(canonical);
  };

  for (const asset of params.portfolioAssets) {
    pushAsset(asset);
    if (targets.length >= maxSymbols) return targets;
  }
  for (const asset of params.watchlistAssets) {
    pushAsset(asset);
    if (targets.length >= maxSymbols) return targets;
  }
  if (targets.length === 0) {
    for (const sym of DEFAULT_CALENDAR_SYMBOLS) {
      if (!seen.has(sym)) {
        seen.add(sym);
        targets.push(sym);
      }
      if (targets.length >= maxSymbols) break;
    }
  }

  return targets;
}

function matchesCalendarTypeFilter(type: UpcomingEventType, filter: CalendarTypeFilter): boolean {
  if (filter === 'ALL') {
    return type === 'earnings' || type === 'ex_dividend' || type === 'dividend';
  }
  if (filter === 'earnings') {
    return type === 'earnings';
  }
  return type === 'ex_dividend' || type === 'dividend';
}

export function filterCorporateCalendarEvents(params: {
  events: readonly UpcomingEventItem[];
  scope: CalendarScopeFilter;
  typeFilter?: CalendarTypeFilter;
  portfolioSymbols: readonly string[];
  watchlistSymbols: readonly string[];
  searchQuery?: string;
}): AnnotatedCalendarEvent[] {
  const portSet = new Set(params.portfolioSymbols.map(normalizeCalendarSymbol).filter(Boolean));
  const watchSet = new Set(params.watchlistSymbols.map(normalizeCalendarSymbol).filter(Boolean));
  const typeFilter = params.typeFilter ?? 'ALL';
  const query = (params.searchQuery || '').trim().toLowerCase();

  const annotated: AnnotatedCalendarEvent[] = [];
  for (const ev of params.events) {
    if (!ev.verified) continue;
    if (!matchesCalendarTypeFilter(ev.type, typeFilter)) continue;

    const inPortfolio = symbolMatchesSet(ev.symbol, portSet);
    const inWatchlist = symbolMatchesSet(ev.symbol, watchSet);

    if (params.scope === 'PORTFOLIO' && !inPortfolio) continue;
    if (params.scope === 'WATCHLIST' && !inWatchlist) continue;

    if (query) {
      const haystack = `${ev.symbol} ${ev.title} ${ev.typeLabel} ${ev.source} ${ev.details || ''}`.toLowerCase();
      if (!haystack.includes(query)) continue;
    }

    annotated.push({
      ...ev,
      inPortfolio,
      inWatchlist,
    });
  }

  annotated.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.symbol.localeCompare(b.symbol));
  return annotated;
}
