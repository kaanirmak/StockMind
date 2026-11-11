'use client';
import { Icon as UIIcon } from '@/components/ui/Icon';


import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { Badge, Input, Button, StateView } from '@/components/ui';
import type { NewsArticle } from '@/app/api/news/route';
import { calculatePortfolioHoldings } from '@/lib/portfolio/calculations';
import { matchNewsAssetIdentity, mentionsNewsSymbol, normalizeNewsText, type NewsAssetIdentity } from '@/lib/news/symbolMatch';
import { normalizeNewsSortOrder, rankNews, type NewsSortOrder } from '@/lib/news/relevance';
import { buildNewsToneAndImpact, classifyNewsCardKind } from '@/lib/news/cardClassification';
import { mapNewsFetchErrorToTurkish, parseNewsApiResponse } from '@/lib/news/responseParser';
import { buildNewsAnalysisHref } from '@/lib/ai/newsAnalysisContext';
import {
  NEWS_CLIENT_SNAPSHOT_KEY,
  getNewsCategorySnapshot,
  upsertNewsCategorySnapshot,
} from '@/lib/news/clientSnapshot';
import type { NewsCoverageSummary } from '@/lib/news/sourceCoverage';
import { getProviderPolicy, KAP_ACCESS_TERMS } from '@/lib/market/providerPolicies';
import type { UpcomingEventItem } from '@/lib/market/upcomingEvents';
import {
  collectCalendarTargetSymbols,
  filterCorporateCalendarEvents,
  type CalendarScopeFilter,
  type CalendarTypeFilter,
} from '@/lib/market/corporateCalendar';
import { usePortfolioStore } from '@/store/usePortfolioStore';
import { useWatchlistStore } from '@/store/useWatchlistStore';

export default function NewsPage() {
  const {
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    transactions,
    fetchPortfoliosAndTransactions,
  } = usePortfolioStore();
  const { items: watchlistItems, refreshFromServer: refreshWatchlist } = useWatchlistStore();

  const requestRef = useRef<AbortController | null>(null);
  const [newsError, setNewsError] = useState('');
  const [newsWarning, setNewsWarning] = useState('');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<UpcomingEventItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarScope, setCalendarScope] = useState<CalendarScopeFilter>('ALL');
  const [calendarTypeFilter, setCalendarTypeFilter] = useState<CalendarTypeFilter>('ALL');
  const [sourceCoverage, setSourceCoverage] = useState<NewsCoverageSummary | null>(null);
  const [showCoverageDetails, setShowCoverageDetails] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [showingCachedSnapshot, setShowingCachedSnapshot] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<NewsSortOrder>('important');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('stockmind_news_sort_order');
      if (saved) setSortOrder(normalizeNewsSortOrder(saved));
    } catch {
      // Ignore storage access errors in private browsing
    }
  }, []);

  const handleSortOrderChange = (next: NewsSortOrder) => {
    setSortOrder(next);
    try {
      window.localStorage.setItem('stockmind_news_sort_order', next);
    } catch {
      // Ignore storage quota / security errors
    }
  };
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSymbolFilter, setSelectedSymbolFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchPortfoliosAndTransactions();
    void refreshWatchlist();
  }, [fetchPortfoliosAndTransactions, refreshWatchlist]);

  // Extract unique portfolio asset identities (symbol + exchange)
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) || portfolios[0];
  const portfolioIdentities = useMemo<NewsAssetIdentity[]>(() => {
    const activeTransactions = transactions.filter(t => t.portfolioId === activePortfolio?.id);
    const bySym = new Map<string, NewsAssetIdentity>();
    for (const holding of calculatePortfolioHoldings(activeTransactions)) {
      if (holding.totalQuantity <= 0) continue;
      const sym = holding.symbol.toUpperCase().trim();
      if (!sym || bySym.has(sym)) continue;
      const matchingTx = activeTransactions.find((t) => t.symbol.toUpperCase().trim() === sym && t.exchange);
      bySym.set(sym, {
        symbol: sym,
        exchange: matchingTx?.exchange || (holding.assetType === 'fund' ? 'TEFAS' : undefined),
      });
    }
    return Array.from(bySym.values());
  }, [activePortfolio?.id, transactions]);

  const portfolioSymbols = useMemo(
    () => portfolioIdentities.map((id) => id.symbol),
    [portfolioIdentities]
  );

  const portfolioQuerySymbols = useMemo(
    () => portfolioIdentities.map((id) => (id.exchange ? `${id.exchange}:${id.symbol}` : id.symbol)),
    [portfolioIdentities]
  );

  const fetchNews = async (isManualRefresh = false) => {
    if (selectedCategory === 'CALENDAR') {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setNewsError('');
      setNewsWarning('');
      setLoading(false);
      setCalendarLoading(true);
      if (isManualRefresh) setIsRefreshing(true);
      try {
        const targets = collectCalendarTargetSymbols({
          portfolioAssets: portfolioIdentities.map((p) => ({
            symbol: p.symbol,
            exchange: p.exchange,
            assetType: p.exchange === 'TEFAS' ? 'fund' : 'stock',
          })),
          watchlistAssets: watchlistItems.map((w) => ({
            symbol: w.symbol,
            exchange: w.exchange,
            assetType: w.assetType,
          })),
          maxSymbols: 16,
        });
        const settled = await Promise.allSettled(
          targets.map(async (sym) => {
            const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}/events`, {
              signal: controller.signal,
            });
            if (!res.ok) return [] as UpcomingEventItem[];
            const payload = (await res.json()) as { events?: UpcomingEventItem[] };
            return Array.isArray(payload.events) ? payload.events : [];
          })
        );
        if (requestRef.current !== controller) return;
        const aggregated = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
        setCalendarEvents(aggregated);
      } catch {
        if (requestRef.current !== controller) return;
        setNewsError('Yaklaşan bilanço ve temettü takvimi yüklenemedi.');
      } finally {
        if (requestRef.current === controller) {
          setCalendarLoading(false);
          setIsRefreshing(false);
        }
      }
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setNewsError(''); setNewsWarning('');
    try {
      if (isManualRefresh) setIsRefreshing(true);
      else {
        setNews([]);
        setLoading(true);
      }

      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') {
        params.append('category', selectedCategory);
      }

      if (selectedCategory === 'PORTFOLIO' && portfolioQuerySymbols.length > 0) {
        params.append('symbols', portfolioQuerySymbols.join(','));
      }

      const res = await fetch(`/api/news?${params.toString()}`, { signal: controller.signal });
      const parsed = await parseNewsApiResponse<{
        success?: boolean;
        data?: NewsArticle[];
        warning?: string;
        collectedAt?: string;
        sourceCoverage?: NewsCoverageSummary;
        error?: string;
      }>(res);
      if (parsed.payload?.sourceCoverage) {
        setSourceCoverage(parsed.payload.sourceCoverage);
      }
      if (!parsed.ok || !parsed.payload || !Array.isArray(parsed.payload.data)) {
        throw new Error(parsed.errorMessage || 'Haberler yüklenemedi. Lütfen tekrar deneyin.');
      }
      const data = parsed.payload;
      const articles = parsed.payload.data;
      if (requestRef.current !== controller) return;
      const normalizedArticles = articles.map((article: NewsArticle) => ({
        ...article,
        relatedSymbols: article.relatedSymbols?.filter((symbol) =>
          mentionsNewsSymbol(`${article.title} ${article.summary}`, symbol)
        ),
      }));
      const savedAt = data.collectedAt || new Date().toISOString();
      setNews(normalizedArticles);
      setLastSuccessAt(savedAt);
      setShowingCachedSnapshot(false);
      setNewsWarning(data.warning ? `${data.warning}${savedAt ? ` Son güncelleme: ${new Date(savedAt).toLocaleString('tr-TR')}` : ''}` : '');

      try {
        const existingRaw = window.localStorage.getItem(NEWS_CLIENT_SNAPSHOT_KEY);
        const existingParsed = existingRaw ? JSON.parse(existingRaw) : null;
        const nextMap = upsertNewsCategorySnapshot(existingParsed, selectedCategory, normalizedArticles, savedAt);
        window.localStorage.setItem(NEWS_CLIENT_SNAPSHOT_KEY, JSON.stringify(nextMap));
      } catch {
        // Ignore storage quota errors
      }
    } catch (err) {
      if (requestRef.current !== controller) return;
      const friendlyError = mapNewsFetchErrorToTurkish(err, {
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        aborted: controller.signal.aborted,
      });
      setNewsError(friendlyError);

      try {
        const storedRaw = window.localStorage.getItem(NEWS_CLIENT_SNAPSHOT_KEY);
        const storedParsed = storedRaw ? JSON.parse(storedRaw) : null;
        const fallbackSnapshot = getNewsCategorySnapshot(storedParsed, selectedCategory);
        if (fallbackSnapshot && fallbackSnapshot.articles.length > 0) {
          setNews(fallbackSnapshot.articles);
          setLastSuccessAt(fallbackSnapshot.savedAt);
          setShowingCachedSnapshot(true);
        }
      } catch {
        // Keep in-memory articles if already loaded
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) { setLoading(false); setIsRefreshing(false); }
    }
  };

  useEffect(() => {
    fetchNews();
    setSelectedSymbolFilter('ALL');
    return () => {
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [selectedCategory, portfolioSymbols.join(','), watchlistItems.length]);

  const watchlistSymbols = useMemo(
    () => watchlistItems.map((w) => w.symbol.toUpperCase().trim()).filter(Boolean),
    [watchlistItems]
  );

  const filteredCalendarEvents = useMemo(
    () =>
      filterCorporateCalendarEvents({
        events: calendarEvents,
        scope: calendarScope,
        typeFilter: calendarTypeFilter,
        portfolioSymbols,
        watchlistSymbols,
        searchQuery,
      }),
    [calendarEvents, calendarScope, calendarTypeFilter, portfolioSymbols, watchlistSymbols, searchQuery]
  );

  const filteredNews = useMemo(() => {
    const matches = news.filter((item) => {
      // Filter by specific symbol chip if selected
      if (selectedSymbolFilter !== 'ALL') {
        const sym = selectedSymbolFilter.toUpperCase();
        const identity = portfolioIdentities.find((p) => p.symbol === sym) || sym;
        const hasSym =
          item.relatedSymbols?.includes(sym) ||
          matchNewsAssetIdentity(`${item.title} ${item.summary}`, identity, { category: item.category, source: item.source }).matched;
        if (!hasSym) return false;
      }

      // Filter by search text query
      if (!searchQuery.trim()) return true;
      const q = normalizeNewsText(searchQuery.trim());
      return (
        normalizeNewsText(item.title).includes(q) ||
        normalizeNewsText(item.summary).includes(q) ||
        normalizeNewsText(item.source).includes(q) ||
        item.relatedSymbols?.some(symbol => normalizeNewsText(symbol).includes(q))
      );
    });
    return rankNews(
      matches,
      portfolioIdentities.length > 0 ? portfolioIdentities : portfolioSymbols,
      sortOrder === 'important',
    );
  }, [news, searchQuery, selectedSymbolFilter, portfolioIdentities, portfolioSymbols, sortOrder]);

  const categories = [
    { id: 'ALL', label: 'Tüm Haberler' },
    {
      id: 'PORTFOLIO',
      label: ` Portföyümdeki Varlıklar${portfolioSymbols.length > 0 ? ` (${portfolioSymbols.length})` : ''}`,
      highlight: true,
    },
    { id: 'BIST', label: " BIST & Şirketler" },
    { id: 'KAP', label: " KAP Bildirimleri" },
    { id: 'CALENDAR', label: " Bilanço & Temettü" },
    { id: 'GLOBAL', label: " Küresel Piyasalar" },
    { id: 'MACRO', label: " Makroekonomi & Emtia" },
  ];

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in pb-12">
      <h1 className="sr-only">Piyasa Haberleri & KAP</h1>
      {/* Filter & Search Bar */}
      <div className="glass-card p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">
        <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-4 items-stretch lg:items-center justify-between">
          <select aria-label="Haber kategorisi" value={selectedCategory} onChange={event => setSelectedCategory(event.target.value)} className="sm:hidden w-full min-w-0 h-11 px-3 rounded-xl border border-border bg-bg-input text-sm text-text-primary">
            {categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
          <div className="hidden sm:flex min-w-0 items-center gap-1.5 p-1 bg-bg-secondary rounded-xl border border-border overflow-x-auto">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? cat.id === 'PORTFOLIO'
                        ? 'bg-emerald-600 text-white shadow-md font-bold'
                        : 'bg-accent text-white shadow font-bold'
                      : cat.id === 'PORTFOLIO'
                      ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex w-full min-w-0 lg:w-80 items-center gap-2">
            <div className="min-w-0 flex-1">
            <Input
              type="search"
              aria-label="Haber, hisse veya kaynak ara"
              placeholder="Haber, hisse veya kaynak ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            </div>
          <Button
            variant="outline"
            size="sm"
            aria-label={isRefreshing ? 'Haberler yenileniyor' : 'Haberleri yenile'}
            title="Haberleri yenile"
            className="shrink-0 !h-11 !w-11 !min-w-11 !p-0 sm:!w-auto sm:!px-3"
            onClick={() => fetchNews(true)}
            disabled={isRefreshing || loading}
            leftIcon={
              <svg
                className={`w-3.5 h-3.5 text-accent ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            }
          >
            <span className="hidden sm:inline">{isRefreshing ? 'Yenileniyor...' : 'Yenile'}</span>
          </Button>
          </div>
        </div>
          {portfolios.length > 1 && (
            <select
              value={activePortfolioId}
              onChange={(e) => setActivePortfolioId(e.target.value)}
              className="bg-bg-secondary text-text-primary text-xs font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:border-accent"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            data-testid="news-sort-controls"
            role="group"
            aria-label="Haber sıralaması"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-bg-secondary p-1"
          >
            <button
              type="button"
              data-testid="news-sort-important"
              aria-pressed={sortOrder === 'important'}
              onClick={() => handleSortOrderChange('important')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                sortOrder === 'important'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              Öne Çıkanlar
            </button>
            <button
              type="button"
              data-testid="news-sort-recent"
              aria-pressed={sortOrder === 'recent'}
              onClick={() => handleSortOrderChange('recent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                sortOrder === 'recent'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              En Yeni
            </button>
          </div>
          <span data-testid="news-sort-hint" className="text-[11px] text-text-muted">
            {sortOrder === 'important'
              ? 'Son 48 saatlik portföy ve kritik olaylar üstte; daha eski haberler kronolojik sıraya döner.'
              : 'Tüm haberler yayın saatine göre en yeniden eskiye sıralanır.'}
          </span>
        </div>

        {/* Portfolio symbols quick filter chips */}
        {selectedCategory === 'PORTFOLIO' && portfolioSymbols.length > 0 && (
          <div className="pt-2 border-t border-border/40 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-text-muted font-medium whitespace-nowrap">Varlık Filtrele:</span>
            <button
              onClick={() => setSelectedSymbolFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedSymbolFilter === 'ALL'
                  ? 'bg-accent/20 text-accent border border-accent/40'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              Tümü ({news.length})
            </button>
            {portfolioSymbols.map((sym) => {
              const count = news.filter(
                (n) =>
                  n.relatedSymbols?.includes(sym) ||
                  mentionsNewsSymbol(`${n.title} ${n.summary}`, sym)
              ).length;
              return (
                <button
                  key={`filter-sym-${sym}`}
                  onClick={() => setSelectedSymbolFilter(sym)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                    selectedSymbolFilter === sym
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span>${sym}</span>
                  {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {newsError && (
        <StateView
          kind="error"
          compact
          title="Haber akışı yüklenemedi"
          description={
            news.length > 0
              ? `${newsError}${lastSuccessAt ? ` Son başarılı haber listesi (${new Date(lastSuccessAt).toLocaleString('tr-TR')}) korunuyor.` : ' Son yüklenen haberler aşağıda gösteriliyor.'}`
              : newsError
          }
          action={
            <Button variant="secondary" size="sm" onClick={() => fetchNews(true)} disabled={isRefreshing}>
              Tekrar Dene
            </Button>
          }
        />
      )}
      {!newsError && lastSuccessAt && news.length > 0 && (
        <p data-testid="news-last-updated" className="text-[11px] text-text-muted">
          {showingCachedSnapshot ? 'Önbellek listesi · ' : ''}Son başarılı alım:{' '}
          <time dateTime={lastSuccessAt}>{new Date(lastSuccessAt).toLocaleString('tr-TR')}</time>
        </p>
      )}
      {newsWarning && <p role="status" className="text-xs text-warning">{newsWarning}</p>}

      {sourceCoverage && sourceCoverage.sources.length > 0 && (
        <div
          data-testid="news-source-coverage"
          className="rounded-xl border border-border/60 bg-bg-secondary/40 px-3 py-2 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary">Kaynak Kapsamı</span>
              <span className="text-text-muted">
                {sourceCoverage.healthySources}/{sourceCoverage.totalSources} kaynak aktif
              </span>
              {sourceCoverage.failedSources > 0 && (
                <Badge variant="warning" size="sm">
                  {sourceCoverage.failedSources} hata
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCoverageDetails((prev) => !prev)}
              aria-expanded={showCoverageDetails}
              className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
            >
              {showCoverageDetails ? 'Kaynak detaylarını gizle' : 'Kaynak durumunu göster'}
            </button>
          </div>

          {showCoverageDetails && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {sourceCoverage.sources.map((src) => {
                const statusVariant =
                  src.status === 'live'
                    ? 'success'
                    : src.status === 'snapshot'
                    ? 'info'
                    : src.status === 'stale_fallback'
                    ? 'warning'
                    : 'danger';
                const statusText =
                  src.status === 'live'
                    ? 'Canlı'
                    : src.status === 'snapshot'
                    ? 'Önbellek'
                    : src.status === 'stale_fallback'
                    ? 'Yedek Önbellek'
                    : 'Hata';

                return (
                  <div
                    key={src.feedId}
                    className="rounded-lg border border-border/50 bg-bg-card/80 p-2.5 text-[11px] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-semibold text-text-primary truncate">
                        {src.sourceName}
                      </span>
                      <Badge variant={statusVariant} size="sm">
                        {statusText}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Haber: {src.articleCount}</span>
                      <span>
                        {src.lastSuccessAt
                          ? new Date(src.lastSuccessAt).toLocaleString('tr-TR')
                          : 'Alım yok'}
                      </span>
                    </div>
                    {src.errorReason && (
                      <p className="text-danger text-[10px] truncate" title={src.errorReason}>
                        Hata: {src.errorReason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedCategory === 'KAP' && !loading && (() => {
        const kapPolicy = getProviderPolicy('kap');
        return (
          <div
            data-testid="kap-terms-notice"
            className="rounded-xl border border-line bg-surface-muted/40 p-4 space-y-2.5 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="accent">Resmî Kaynak Koşulları</Badge>
                <span className="font-semibold text-ink">
                  {kapPolicy?.name ?? 'Kamuyu Aydınlatma Platformu (KAP)'}
                </span>
              </div>
              <a
                className="font-semibold text-accent underline text-xs"
                href="https://www.kap.org.tr/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Resmî KAP bildirimlerini aç
              </a>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              {KAP_ACCESS_TERMS.delayNotice}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-ink-secondary">
              <div>
                <span className="font-semibold text-ink">Kapsam: </span>
                {KAP_ACCESS_TERMS.scope.join(', ')}
              </div>
              <div>
                <span className="font-semibold text-ink">Gösterim Koşulu: </span>
                {KAP_ACCESS_TERMS.displayRules.join(' ')}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Portfolio Empty State */}
      {selectedCategory === 'CALENDAR' ? (
        <div data-testid="corporate-calendar-panel" className="space-y-4">
          <div className="glass-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Takvim kapsam filtresi">
              {[
                { id: 'ALL' as const, label: 'Tümü' },
                { id: 'PORTFOLIO' as const, label: `Portföyüm (${portfolioSymbols.length})` },
                { id: 'WATCHLIST' as const, label: `Takip Listem (${watchlistSymbols.length})` },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCalendarScope(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    calendarScope === opt.id
                      ? 'bg-accent text-white'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Olay türü filtresi">
              {[
                { id: 'ALL' as const, label: 'Tüm Olaylar' },
                { id: 'earnings' as const, label: 'Bilanço' },
                { id: 'dividend' as const, label: 'Temettü' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCalendarTypeFilter(opt.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    calendarTypeFilter === opt.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {calendarLoading ? (
            <StateView
              kind="loading"
              title="Bilanço ve temettü takvimi yükleniyor"
              description="Portföy ve takip listenizdeki varlıklar için doğrulanmış tarihler taranıyor."
            />
          ) : filteredCalendarEvents.length === 0 ? (
            <StateView
              kind="empty"
              title="Seçili kapsamda doğrulanmış bilanço veya temettü tarihi bulunamadı"
              description="Sağlayıcıdan doğrulanan yaklaşan tarih yoksa tahmini tarih gösterilmez."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCalendarEvents.map((ev) => (
                <div
                  key={ev.id}
                  data-testid="corporate-calendar-card"
                  className="glass-card p-4 rounded-2xl border border-border/70 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={ev.type === 'earnings' ? 'info' : 'success'} size="sm">
                        {ev.typeLabel}
                      </Badge>
                      <Link href={`/stocks/${ev.symbol}`} className="font-mono font-bold text-accent hover:underline">
                        {ev.symbol}
                      </Link>
                      {ev.inPortfolio && <Badge variant="success" size="sm">Portföyüm</Badge>}
                      {ev.inWatchlist && <Badge variant="warning" size="sm">Takip Listesi</Badge>}
                    </div>
                    <time dateTime={ev.eventDate} className="font-mono font-semibold text-text-primary">
                      {new Date(`${ev.eventDate}T00:00:00Z`).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </div>
                  <p className="text-sm font-semibold text-text-primary">{ev.title}</p>
                  {ev.details && <p className="text-xs text-text-secondary">{ev.details}</p>}
                  <div className="flex items-center justify-between text-[11px] text-text-muted pt-1 border-t border-border/50">
                    <span>Kaynak: {ev.source}</span>
                    {ev.sourceUrl && (
                      <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                        Resmî Bağlantı
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : selectedCategory === 'PORTFOLIO' && portfolioSymbols.length === 0 && !loading ? (
        <StateView
          kind="empty"
          statusLabel="Portföy Boş"
          title="Portföyünüzde henüz varlık bulunmuyor"
          description="Varlık eklediğinizde bağlı haber kaynaklarındaki ilgili başlıkları burada görebilirsiniz."
          action={
            <Link href="/portfolio">
              <Button variant="primary" size="md">
                + Portföye Varlık Ekle
              </Button>
            </Link>
          }
        />
      ) : loading ? (
        <StateView
          kind="loading"
          title="Haber kaynakları yükleniyor"
          description="Bağlı finansal RSS ve piyasa bültenleri taranıyor."
        />
      ) : (selectedCategory === 'KAP' && news.length === 0) || (newsError && news.length === 0) ? null : filteredNews.length === 0 ? (
        <StateView
          kind="empty"
          title={
            selectedCategory === 'PORTFOLIO' && !searchQuery && selectedSymbolFilter === 'ALL'
              ? 'Bağlı kaynaklarda portföy varlıklarınızla eşleşen haber bulunamadı'
              : 'Aradığınız kriterlere uygun haber bulunamadı'
          }
          description={
            selectedCategory === 'PORTFOLIO'
              ? 'Investing.com BİST, şirket ve borsa haberleri; TRT Haber ekonomi ve ECB bültenleri taranıyor.'
              : 'Farklı bir arama terimi deneyebilir veya aktif filtreleri temizleyebilirsiniz.'
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedSymbolFilter('ALL');
                setSelectedCategory('ALL');
              }}
            >
              Filtreleri Temizle
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredNews.map(({ article: item, matchedSymbols, matchDetails, event, eventTypeLabel }, idx) => {
            const cardKind = classifyNewsCardKind(item);
            const toneAndImpact = buildNewsToneAndImpact({
              sentiment: item.sentiment,
              sentimentReason: item.sentimentReason,
              matchedSymbols,
              event,
              cardKind: cardKind.kind,
            });
            const sentimentBadge =
              item.sentiment === 'positive' ? (
                <Badge variant="success" size="sm">
                  Ton: Olumlu
                </Badge>
              ) : item.sentiment === 'negative' ? (
                <Badge variant="danger" size="sm">
                  Ton: Olumsuz
                </Badge>
              ) : (
                <Badge variant="warning" size="sm">
                  Ton: Nötr
                </Badge>
              );

            // Identify if this news relates to any of the user's portfolio holdings
            const isPortfolioRelated = matchedSymbols.length > 0;

            const isDuplicateSummary =
              !item.summary ||
              item.summary.trim().toLowerCase() === item.title.trim().toLowerCase() ||
              item.title.trim().toLowerCase().startsWith(item.summary.trim().toLowerCase().slice(0, 30));

            return (
              <div
                key={item.id || `news-card-${idx}`}
                data-testid={item.category === 'KAP' ? 'kap-disclosure-card' : undefined}
                className={`glass-card p-3.5 sm:p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between space-y-2.5 hover:border-accent/40 ${
                  isPortfolioRelated ? 'border-emerald-500/40 bg-emerald-500/[0.02]' : ''
                }`}
              >
                <div className="space-y-2">
                  {/* Single Clean Row: Source, Card Type, Date, and Tone Badge */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="font-semibold text-accent truncate text-[11px] sm:text-xs">
                        {item.sourceId ? `${item.sourceId} • ` : ''}{item.source}
                      </span>
                      <Badge
                        variant={cardKind.badgeVariant}
                        size="sm"
                        data-testid="news-card-type"
                      >
                        {cardKind.label}
                      </Badge>
                      {item.companyName && (
                        <span className="text-[11px] font-semibold text-text-primary truncate max-w-[180px]">
                          {item.companyName}{item.symbol ? ` (${item.symbol})` : ''}
                        </span>
                      )}
                      <span className="text-text-muted text-[10px]">•</span>
                      <span className="text-[11px] text-text-muted whitespace-nowrap">
                        {new Date(item.publishedAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isPortfolioRelated && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Portföyüm
                        </span>
                      )}
                    </div>
                    <div className="shrink-0" title={`Haberin metin tonu. ${toneAndImpact.toneSummary}`}>
                      {sentimentBadge}
                    </div>
                  </div>

                  {event && <Badge variant="info" size="sm">{event}</Badge>}

                  {/* Title */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <h3 className="text-sm sm:text-base font-bold text-text-primary leading-snug group-hover:text-accent transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                  </a>

                  {/* Summary (Omitted if it just duplicates the title) */}
                  {!isDuplicateSummary && (
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {item.summary}
                    </p>
                  )}

                  <div
                    data-testid="news-tone-vs-impact"
                    className="rounded-xl border border-border/60 bg-bg-secondary/50 px-2.5 py-2 text-[11px] space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-text-secondary">
                        <span className="font-semibold text-text-primary">Haber Tonu:</span>{' '}
                        {toneAndImpact.toneLabel} — {toneAndImpact.toneSummary}
                      </span>
                    </div>
                    <p className="text-text-secondary">
                      <span className="font-semibold text-text-primary">Olası Portföy Etkisi:</span>{' '}
                      <span className="font-medium text-accent">{toneAndImpact.impactScopeLabel}.</span>{' '}
                      {toneAndImpact.impactNote}
                    </p>
                  </div>

                  {matchDetails.length > 0 && (
                    <div
                      data-testid="news-portfolio-reason"
                      className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-2.5 py-2 text-[11px] space-y-1"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-semibold text-emerald-300">
                          Portföy Bağlantısı:{' '}
                          <span className="font-mono text-text-primary">
                            {matchDetails
                              .map((d) => (d.exchange ? `${d.symbol} (${d.exchange})` : d.symbol))
                              .join(', ')}
                          </span>
                        </span>
                        <span className="rounded bg-bg-secondary/80 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary border border-border/60">
                          Olay: {eventTypeLabel}
                        </span>
                      </div>
                      <ul className="space-y-0.5 text-text-secondary">
                        {matchDetails.map((detail) => (
                          <li key={`reason-${item.id || idx}-${detail.symbol}`}>
                            • {detail.symbol}: {detail.reasonText}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Footer: Related Symbols & Action Links */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {item.relatedSymbols?.slice(0, 4).map((sym, sIdx) => {
                      const inPort = portfolioSymbols.includes(sym.toUpperCase());
                      return (
                        <Link key={`sym-${item.id || idx}-${sym}-${sIdx}`} href={`/stocks/${sym}`}>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              inPort
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-bg-tertiary text-text-muted hover:text-text-primary border border-border/60'
                            }`}
                          >
                            {sym}
                          </span>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors flex items-center gap-0.5"
                      title={item.category === 'KAP' ? 'Orijinal KAP Belgesini Aç' : 'Haberi Kaynağında Aç'}
                    >
                      <span>{item.category === 'KAP' ? 'Orijinal Belge' : 'Kaynak'}</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>

                    <Link
                      href={buildNewsAnalysisHref(
                        {
                          title: item.title,
                          summary: item.summary,
                          source: item.source,
                          publishedAt: item.publishedAt,
                          url: item.url,
                          relatedSymbols: matchedSymbols,
                        },
                        false
                      )}
                      data-testid="news-ai-analyze-link"
                      className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                    >
                      <span>AI Analiz</span>
                      <span>&rarr;</span>
                    </Link>

                    {isPortfolioRelated && (
                      <Link
                        href={buildNewsAnalysisHref(
                          {
                            title: item.title,
                            summary: item.summary,
                            source: item.source,
                            publishedAt: item.publishedAt,
                            url: item.url,
                            relatedSymbols: matchedSymbols,
                          },
                          true
                        )}
                        data-testid="news-ai-portfolio-link"
                        className="text-[11px] font-semibold text-emerald-500 hover:underline flex items-center gap-0.5"
                        title="Portföy bağlamını ekleyerek analiz et"
                      >
                        <span>Portföyümle</span>
                        <span>&rarr;</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
