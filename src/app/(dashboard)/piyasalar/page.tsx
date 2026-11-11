'use client';
import { MarketQuoteValue } from '@/components/dashboard/MarketQuoteValue';
import type { MarketOverviewItem } from '@/types/stock';
import { Icon as MarketIcon } from '@/components/ui/Icon';
import { WindowedRows } from '@/components/ui/WindowedRows';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useStocks, StockWithQuote } from '@/hooks/useStockData';
import { useFunds } from '@/hooks/useFunds';
import { Badge, Button, Input, TableSkeleton, useToast, InstrumentLogo, StateView, Modal, PriceStatusBadge } from '@/components/ui';
import { classifyFundPriceStatus, classifyStockPriceStatus } from '@/lib/market/priceStatus';
import { MARKET_CATALOG, MOBILE_PRIMARY_MARKETS, type MarketId } from '@/lib/market/marketSelector';
import { MARKET_PAGE_SIZE, paginateRecords, sortStockRecords } from '@/lib/market/pagination';
import { describeSearchResult } from '@/lib/market/searchResultDescriptor';
import {
  formatAssetUnitPrice,
  resolveAssetDisplayUnit,
} from '@/lib/market/assetClassification';
import {
  MARKET_FILTER_STORAGE_KEY,
  buildMarketSearchParams,
  resolveMarketStateWithPersistence,
  type FundSortKey,
  type PersistedMarketFilterState,
  type SortDirection,
  type StockSortKey,
} from '@/lib/market/marketFilterPersistence';
import {
  FUND_FEE_TIER_OPTIONS,
  FUND_RETURN_PERIOD_OPTIONS,
  FUND_RETURN_THRESHOLD_OPTIONS,
  FUND_RISK_RANGE_OPTIONS,
  countActiveFundFilters,
  deleteTefasFilterPreset,
  filterFundsCombinatorially,
  getFundPeriodReturn,
  readSavedTefasFilterPresets,
  saveTefasFilterPreset,
  sortFundsByField,
  type FundFeeTier,
  type FundReturnPeriod,
  type FundReturnThreshold,
  type FundRiskRange,
  type SavedTefasFilterPreset,
} from '@/lib/market/fundFilters';
import {
  DEFAULT_STOCK_SCREENER_CRITERIA,
  STOCK_DIVIDEND_TIER_OPTIONS,
  STOCK_MCAP_TIER_OPTIONS,
  STOCK_PE_BAND_OPTIONS,
  STOCK_PRICE_CHANGE_OPTIONS,
  deleteBistScreenerPreset,
  filterStocksByScreener,
  hasActiveStockScreenerFilter,
  readSavedBistScreeners,
  saveBistScreenerPreset,
  type SavedBistScreener,
  type StockDividendTier,
  type StockMarketCapTier,
  type StockPeBand,
  type StockPriceChangeFilter,
  type StockScreenerCriteria,
} from '@/lib/market/stockScreener';
import {
  DEFAULT_FUND_COLUMNS,
  DEFAULT_STOCK_COLUMNS,
  FUND_TABLE_COLUMNS,
  STOCK_TABLE_COLUMNS,
  buildFundScreenerCsv,
  buildStockScreenerCsv,
  readScreenerTablePrefs,
  toggleColumnSelection,
  writeScreenerTablePrefs,
  type FundColumnId,
  type StockColumnId,
} from '@/lib/market/screenerTable';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { formatDate, formatNumber, getPnLColor, getPnLSign } from '@/lib/utils/format';

const MARKETS = MARKET_CATALOG;

interface OverviewSections {
  commodity: StockWithQuote[];
  forex: StockWithQuote[];
  crypto: StockWithQuote[];
  indices: StockWithQuote[];
}

function PiyasalarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchParamsKey = searchParams.toString();

  const initialResolved = React.useMemo(
    () => resolveMarketStateWithPersistence(searchParams, null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [activeMarket, setActiveMarket] = useState<MarketId>(initialResolved.market);

  // Overview Data (for 'ALL' market tab)
  const [overviewData, setOverviewData] = useState<{
    tickers: MarketOverviewItem[];
    sections: OverviewSections | null;
  }>({ tickers: [], sections: null });
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Stocks state
  const [selectedSector, setSelectedSector] = useState<string>(initialResolved.sector);
  const [stockSearch, setStockSearch] = useState<string>(initialResolved.search);
  const [stockSortBy, setStockSortBy] = useState<StockSortKey>(initialResolved.stockSortBy);
  const [stockSortOrder, setStockSortOrder] = useState<SortDirection>(initialResolved.stockSortOrder);
  const [bistScreener, setBistScreener] = useState<Omit<StockScreenerCriteria, 'sector'>>({
    peBand: DEFAULT_STOCK_SCREENER_CRITERIA.peBand,
    dividendTier: DEFAULT_STOCK_SCREENER_CRITERIA.dividendTier,
    marketCapTier: DEFAULT_STOCK_SCREENER_CRITERIA.marketCapTier,
    priceChange: DEFAULT_STOCK_SCREENER_CRITERIA.priceChange,
    minPrice: null,
    maxPrice: null,
  });
  const [savedBistScreeners, setSavedBistScreeners] = useState<SavedBistScreener[]>([]);
  const [activeScreenerId, setActiveScreenerId] = useState<string | null>(null);
  const [screenerNameInput, setScreenerNameInput] = useState<string>('');
  const [showBistScreenerBar, setShowBistScreenerBar] = useState<boolean>(false);

  // Pagination state (server-backed limited page size for stocks & TEFAS funds)
  const [stockPage, setStockPage] = useState<number>(1);

  // Funds state
  const [selectedCategory, setSelectedCategory] = useState<string>(initialResolved.category);
  const [fundSearch, setFundSearch] = useState<string>(initialResolved.search);
  const [fundRiskRange, setFundRiskRange] = useState<FundRiskRange>('ALL');
  const [fundFeeTier, setFundFeeTier] = useState<FundFeeTier>('ALL');
  const [fundReturnPeriod, setFundReturnPeriod] = useState<FundReturnPeriod>('yearlyReturn');
  const [fundReturnThreshold, setFundReturnThreshold] = useState<FundReturnThreshold>('ALL');
  const [fundPage, setFundPage] = useState<number>(1);
  const [compareFundCodes, setCompareFundCodes] = useState<string[]>([]);
  const toggleCompareFund = (code: string) => {
    const upper = code.toUpperCase();
    setCompareFundCodes((prev) => {
      if (prev.includes(upper)) return prev.filter((c) => c !== upper);
      if (prev.length >= 4) {
        showToast({ type: 'info', title: 'Sınır Doldu', message: 'En fazla 4 TEFAS fonu yan yana karşılaştırılabilir.' });
        return prev;
      }
      return [...prev, upper];
    });
  };
  const [fundSortBy, setFundSortBy] = useState<FundSortKey>(initialResolved.fundSortBy);
  const [fundSortOrder, setFundSortOrder] = useState<SortDirection>(initialResolved.fundSortOrder);
  const [savedTefasPresets, setSavedTefasPresets] = useState<SavedTefasFilterPreset[]>([]);
  const [activeTefasPresetId, setActiveTefasPresetId] = useState<string | null>(null);
  const [tefasPresetNameInput, setTefasPresetNameInput] = useState<string>('');
  const [stockColumns, setStockColumns] = useState<StockColumnId[]>(DEFAULT_STOCK_COLUMNS);
  const [fundColumns, setFundColumns] = useState<FundColumnId[]>(DEFAULT_FUND_COLUMNS);
  const [showStockColumnMenu, setShowStockColumnMenu] = useState<boolean>(false);
  const [showFundColumnMenu, setShowFundColumnMenu] = useState<boolean>(false);
  const hasHydratedTablePrefsRef = useRef<boolean>(false);

  // Shared view mode
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(initialResolved.watchlistOnly);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(initialResolved.viewMode);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Hydrate persisted selection on mount (or when URL params change explicitly) without clobbering shared URLs
  const hasHydratedFiltersRef = useRef(false);
  const lastAppliedQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastAppliedQueryRef.current === searchParamsKey && hasHydratedFiltersRef.current) {
      return;
    }

    let storedRaw: unknown = null;
    try {
      const raw = window.localStorage.getItem(MARKET_FILTER_STORAGE_KEY);
      storedRaw = raw ? JSON.parse(raw) : null;
    } catch {
      storedRaw = null;
    }

    const resolved = resolveMarketStateWithPersistence(
      new URLSearchParams(searchParamsKey),
      storedRaw
    );
    setActiveMarket(resolved.market);
    setSelectedSector(resolved.sector);
    setSelectedCategory(resolved.category);
    setStockSearch(resolved.search);
    setFundSearch(resolved.search);
    setWatchlistOnly(resolved.watchlistOnly);
    setViewMode(resolved.viewMode);
    setStockSortBy(resolved.stockSortBy);
    setStockSortOrder(resolved.stockSortOrder);
    setFundSortBy(resolved.fundSortBy);
    setFundSortOrder(resolved.fundSortOrder);

    lastAppliedQueryRef.current = searchParamsKey;
    hasHydratedFiltersRef.current = true;
  }, [searchParamsKey]);

  // Persist current market and filters & keep shareable URL query synchronized
  useEffect(() => {
    if (!hasHydratedFiltersRef.current) return;

    const currentState: PersistedMarketFilterState = {
      market: activeMarket,
      sector: selectedSector,
      category: selectedCategory,
      search: activeMarket === 'TEFAS' ? fundSearch : stockSearch,
      watchlistOnly,
      viewMode,
      stockSortBy,
      stockSortOrder,
      fundSortBy,
      fundSortOrder,
    };

    try {
      window.localStorage.setItem(MARKET_FILTER_STORAGE_KEY, JSON.stringify(currentState));
    } catch {
      // Ignore storage quota / private mode failures
    }

    const nextQuery = buildMarketSearchParams(currentState);
    if (nextQuery !== searchParamsKey) {
      lastAppliedQueryRef.current = nextQuery;
      router.replace(nextQuery ? `/piyasalar?${nextQuery}` : '/piyasalar', { scroll: false });
    }
  }, [
    activeMarket,
    selectedSector,
    selectedCategory,
    stockSearch,
    fundSearch,
    watchlistOnly,
    viewMode,
    stockSortBy,
    stockSortOrder,
    fundSortBy,
    fundSortOrder,
    searchParamsKey,
    router,
  ]);

  const { showToast } = useToast();
  const { items: watchlistItems, toggleWatchlist, isWatchlisted: checkWatchlisted } = useWatchlistStore();

  const handleMarketChange = (market: MarketId) => {
    setActiveMarket(market);
    setSelectedSector('ALL');
    setSelectedCategory('ALL');
    setStockSearch('');
    setFundSearch('');
    setStockPage(1);
    setFundPage(1);
  };

  // Load saved BIST screeners, TEFAS filter presets, and table column/sort preferences on mount
  useEffect(() => {
    if (hasHydratedTablePrefsRef.current) return;
    setSavedBistScreeners(readSavedBistScreeners());
    setSavedTefasPresets(readSavedTefasFilterPresets());
    const tablePrefs = readScreenerTablePrefs();
    setStockColumns(tablePrefs.stockColumns);
    setFundColumns(tablePrefs.fundColumns);
    if (!searchParams.get('sort') && tablePrefs.stockSortBy) {
      setStockSortBy(tablePrefs.stockSortBy);
      if (tablePrefs.stockSortOrder) setStockSortOrder(tablePrefs.stockSortOrder);
    }
    if (!searchParams.get('sort') && tablePrefs.fundSortBy) {
      setFundSortBy(tablePrefs.fundSortBy);
      if (tablePrefs.fundSortOrder) setFundSortOrder(tablePrefs.fundSortOrder);
    }
    hasHydratedTablePrefsRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!hasHydratedTablePrefsRef.current) return;
    writeScreenerTablePrefs({
      stockColumns,
      fundColumns,
      stockSortBy,
      stockSortOrder,
      fundSortBy,
      fundSortOrder,
    });
  }, [stockColumns, fundColumns, stockSortBy, stockSortOrder, fundSortBy, fundSortOrder]);

  const handleSaveTefasPreset = () => {
    const result = saveTefasFilterPreset({
      name: tefasPresetNameInput,
      criteria: {
        category: selectedCategory,
        riskRange: fundRiskRange,
        feeTier: fundFeeTier,
        returnPeriod: fundReturnPeriod,
        returnThreshold: fundReturnThreshold,
      },
      sortBy: fundSortBy,
      sortOrder: fundSortOrder,
    });
    if (!result.ok) {
      showToast({ type: 'danger', title: 'Kayıt Başarısız', message: result.error });
      return;
    }
    setSavedTefasPresets(result.presets);
    setActiveTefasPresetId(result.saved.id);
    setTefasPresetNameInput('');
    showToast({
      type: 'success',
      title: 'TEFAS Filtre Seti Kaydedildi',
      message: `"${result.saved.name}" adlı fon filtresi kaydedildi.`,
    });
  };

  const handleApplyTefasPreset = (preset: SavedTefasFilterPreset) => {
    setSelectedCategory(preset.criteria.category || 'ALL');
    setFundRiskRange(preset.criteria.riskRange);
    setFundFeeTier(preset.criteria.feeTier);
    setFundReturnPeriod(preset.criteria.returnPeriod);
    setFundReturnThreshold(preset.criteria.returnThreshold);
    setFundSortBy(preset.sortBy);
    setFundSortOrder(preset.sortOrder);
    setActiveTefasPresetId(preset.id);
    setFundPage(1);
  };

  const handleDeleteTefasPreset = (id: string) => {
    const next = deleteTefasFilterPreset(id);
    setSavedTefasPresets(next);
    if (activeTefasPresetId === id) setActiveTefasPresetId(null);
  };

  // Reset pagination to page 1 when filters, search, or sorting change
  useEffect(() => {
    setStockPage(1);
  }, [
    activeMarket,
    selectedSector,
    stockSearch,
    stockSortBy,
    stockSortOrder,
    watchlistOnly,
    bistScreener,
  ]);

  useEffect(() => {
    setFundPage(1);
  }, [
    activeMarket,
    selectedCategory,
    fundSearch,
    fundRiskRange,
    fundFeeTier,
    fundReturnPeriod,
    fundReturnThreshold,
    fundSortBy,
    fundSortOrder,
    watchlistOnly,
  ]);

  // Fetch overview data when activeMarket is 'ALL'
  useEffect(() => {
    if (activeMarket !== 'ALL') return;
    let isMounted = true;
    async function fetchOverview() {
      try {
        setOverviewLoading(true);
        const res = await fetch('/api/markets/overview');
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.success) {
            setOverviewData({
              tickers: json.data || [],
              sections: json.sections || null,
            });
          }
        }
      } catch (e) {
        console.error('Error fetching overview data:', e);
      } finally {
        if (isMounted) setOverviewLoading(false);
      }
    }
    fetchOverview();
  }, [activeMarket]);

  // Stocks data (active when activeMarket is BIST, COMMODITY, CRYPTO, FOREX, INDEX, NASDAQ, or NYSE)
  const isStocksMarket = activeMarket !== 'TEFAS' && activeMarket !== 'ALL';
  const currentBistCriteria: StockScreenerCriteria = {
    sector: selectedSector,
    ...bistScreener,
  };
  const isBistScreenerActive =
    activeMarket === 'BIST' && hasActiveStockScreenerFilter(currentBistCriteria);

  const watchlistStockSymbols = React.useMemo(
    () => (watchlistOnly ? watchlistItems.filter((w) => w.assetType !== 'fund').map((w) => w.symbol) : undefined),
    [watchlistOnly, watchlistItems]
  );
  const {
    stocks,
    total: serverStocksTotal,
    totalPages: serverStocksTotalPages,
    loading: stocksLoading,
    error: stocksError,
    updatedAt: stocksUpdatedAt,
    refetch: refetchStocks,
  } = useStocks(
    isStocksMarket
      ? {
          exchange: activeMarket,
          sector: selectedSector,
          search: stockSearch,
          sortBy: stockSortBy,
          order: stockSortOrder,
          page: isBistScreenerActive ? 1 : stockPage,
          limit: isBistScreenerActive ? 200 : MARKET_PAGE_SIZE,
          symbols: watchlistStockSymbols && watchlistStockSymbols.length > 0 ? watchlistStockSymbols : undefined,
        }
      : undefined,
    { enabled: isStocksMarket && (!watchlistOnly || (watchlistStockSymbols?.length ?? 0) > 0) }
  );

  // If in 'ALL' tab, fetch only limited top BIST movers rather than the entire market list
  const { stocks: bistStocks } = useStocks(
    activeMarket === 'ALL'
      ? { exchange: 'BIST', sortBy: 'volume', order: 'desc', page: 1, limit: MARKET_PAGE_SIZE }
      : undefined,
    { enabled: activeMarket === 'ALL' }
  );

  const filteredStocksByWatchlist = stocks.filter(
    (s) => !watchlistOnly || checkWatchlisted(s.symbol)
  );
  const screenedStocks =
    activeMarket === 'BIST'
      ? filterStocksByScreener(filteredStocksByWatchlist, currentBistCriteria)
      : filteredStocksByWatchlist;
  const sortedStocks = sortStockRecords(
    screenedStocks,
    stockSortBy,
    stockSortOrder
  );

  const useClientStockPagination = watchlistOnly || isBistScreenerActive;
  const stockTotalCount = useClientStockPagination
    ? (watchlistOnly && watchlistStockSymbols?.length === 0 ? 0 : sortedStocks.length)
    : serverStocksTotal;
  const stockTotalPages = useClientStockPagination
    ? paginateRecords(sortedStocks, stockPage, MARKET_PAGE_SIZE).totalPages
    : Math.max(1, serverStocksTotalPages);
  const visibleStocks = useClientStockPagination
    ? paginateRecords(sortedStocks, stockPage, MARKET_PAGE_SIZE).items
    : sortedStocks;

  const handleSaveBistScreener = () => {
    const result = saveBistScreenerPreset({
      name: screenerNameInput,
      criteria: currentBistCriteria,
      sortBy: stockSortBy,
      sortOrder: stockSortOrder,
    });
    if (!result.ok) {
      showToast({ type: 'danger', title: 'Kayıt Başarısız', message: result.error });
      return;
    }
    setSavedBistScreeners(result.presets);
    setActiveScreenerId(result.saved.id);
    setScreenerNameInput('');
    showToast({
      type: 'success',
      title: 'BIST Tarayıcı Kaydedildi',
      message: `"${result.saved.name}" adlı tarayıcı kaydedildi.`,
    });
  };

  const handleApplyBistScreener = (preset: SavedBistScreener) => {
    setSelectedSector(preset.criteria.sector || 'ALL');
    setBistScreener({
      peBand: preset.criteria.peBand,
      dividendTier: preset.criteria.dividendTier,
      marketCapTier: preset.criteria.marketCapTier,
      priceChange: preset.criteria.priceChange,
      minPrice: preset.criteria.minPrice ?? null,
      maxPrice: preset.criteria.maxPrice ?? null,
    });
    setStockSortBy(preset.sortBy);
    setStockSortOrder(preset.sortOrder);
    setActiveScreenerId(preset.id);
    setShowBistScreenerBar(true);
    setStockPage(1);
  };

  const handleDeleteBistScreener = (id: string) => {
    const next = deleteBistScreenerPreset(id);
    setSavedBistScreeners(next);
    if (activeScreenerId === id) setActiveScreenerId(null);
  };

  const handleResetBistScreener = () => {
    setSelectedSector('ALL');
    setBistScreener({
      peBand: 'ALL',
      dividendTier: 'ALL',
      marketCapTier: 'ALL',
      priceChange: 'ALL',
      minPrice: null,
      maxPrice: null,
    });
    setActiveScreenerId(null);
    setStockPage(1);
  };

  const toggleStockSort = (column: 'changePercent' | 'price' | 'volume' | 'marketCap') => {
    if (stockSortBy === column) setStockSortOrder(stockSortOrder === 'desc' ? 'asc' : 'desc');
    else { setStockSortBy(column); setStockSortOrder('desc'); }
    setStockPage(1);
  };

  // Funds data
  const watchlistFundSymbols = React.useMemo(
    () => (watchlistOnly ? watchlistItems.filter((w) => w.assetType === 'fund').map((w) => w.symbol) : undefined),
    [watchlistOnly, watchlistItems]
  );
  const {
    funds,
    total: serverFundsTotal,
    totalPages: serverFundsTotalPages,
    loading: fundsLoading,
    error: fundsError,
    refetch: refetchFunds,
  } = useFunds(
    {
      category: selectedCategory,
      search: fundSearch,
      riskRange: fundRiskRange,
      feeTier: fundFeeTier,
      returnPeriod: fundReturnPeriod,
      returnThreshold: fundReturnThreshold,
      sortBy: fundSortBy,
      order: fundSortOrder,
      page: fundPage,
      limit: MARKET_PAGE_SIZE,
      symbols: watchlistFundSymbols && watchlistFundSymbols.length > 0 ? watchlistFundSymbols : undefined,
    },
    { enabled: activeMarket === 'TEFAS' && (!watchlistOnly || (watchlistFundSymbols?.length ?? 0) > 0) }
  );

  const filteredFunds = filterFundsCombinatorially(funds, {
    category: selectedCategory,
    search: fundSearch,
    riskRange: fundRiskRange,
    feeTier: fundFeeTier,
    returnPeriod: fundReturnPeriod,
    returnThreshold: fundReturnThreshold,
    watchlistOnly,
    isWatchlisted: checkWatchlisted,
  });

  const sortedFunds = sortFundsByField(filteredFunds, fundSortBy, fundSortOrder);
  const fundTotalCount = watchlistOnly
    ? (watchlistFundSymbols?.length === 0 ? 0 : sortedFunds.length)
    : serverFundsTotal;
  const fundTotalPages = watchlistOnly
    ? paginateRecords(sortedFunds, fundPage, MARKET_PAGE_SIZE).totalPages
    : Math.max(1, serverFundsTotalPages);
  const visibleFunds = watchlistOnly
    ? paginateRecords(sortedFunds, fundPage, MARKET_PAGE_SIZE).items
    : sortedFunds;
  const activeFundFilterCount = countActiveFundFilters({
    category: selectedCategory,
    search: fundSearch,
    riskRange: fundRiskRange,
    feeTier: fundFeeTier,
    returnPeriod: fundReturnPeriod,
    returnThreshold: fundReturnThreshold,
    watchlistOnly,
  });
  const selectedReturnPeriodMeta =
    FUND_RETURN_PERIOD_OPTIONS.find((opt) => opt.id === fundReturnPeriod) ??
    FUND_RETURN_PERIOD_OPTIONS[5];

  const triggerCsvDownload = (csvContent: string, filename: string, label: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: 'CSV Dışa Aktarıldı', message: label });
  };

  const handleExportStocksCsv = () => {
    if (sortedStocks.length === 0) return;
    const filterParts: string[] = [];
    if (selectedSector !== 'ALL') filterParts.push(`Sektör:${selectedSector}`);
    if (stockSearch.trim()) filterParts.push(`Arama:${stockSearch.trim()}`);
    if (watchlistOnly) filterParts.push('Takip Listesi');
    if (activeMarket === 'BIST') {
      if (bistScreener.peBand !== 'ALL') filterParts.push(`F/K:${bistScreener.peBand}`);
      if (bistScreener.dividendTier !== 'ALL') filterParts.push(`Temettü:${bistScreener.dividendTier}`);
      if (bistScreener.marketCapTier !== 'ALL') filterParts.push(`PiyasaDeğeri:${bistScreener.marketCapTier}`);
      if (bistScreener.priceChange !== 'ALL') filterParts.push(`Değişim:${bistScreener.priceChange}`);
    }
    const content = buildStockScreenerCsv({
      stocks: sortedStocks,
      columns: stockColumns,
      market: activeMarket,
      filterSummary: filterParts.join(' · ') || 'Yok',
      sortBy: stockSortBy,
      sortOrder: stockSortOrder,
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    triggerCsvDownload(
      content,
      `stockmind-${activeMarket.toLowerCase()}-${todayIso}.csv`,
      `${sortedStocks.length} kayıt, ${stockColumns.length} seçili sütun ile aktarıldı.`
    );
  };

  const handleExportFundsCsv = () => {
    if (sortedFunds.length === 0) return;
    const filterParts: string[] = [];
    if (selectedCategory !== 'ALL') filterParts.push(`Kategori:${selectedCategory}`);
    if (fundRiskRange !== 'ALL') filterParts.push(`Risk:${fundRiskRange}`);
    if (fundFeeTier !== 'ALL') filterParts.push(`Ücret:${fundFeeTier}`);
    if (fundReturnThreshold !== 'ALL') filterParts.push(`Getiri:${fundReturnThreshold}`);
    if (fundSearch.trim()) filterParts.push(`Arama:${fundSearch.trim()}`);
    if (watchlistOnly) filterParts.push('Takip Listesi');
    const content = buildFundScreenerCsv({
      funds: sortedFunds,
      columns: fundColumns,
      returnPeriod: fundReturnPeriod,
      returnPeriodLabel: selectedReturnPeriodMeta.shortLabel,
      filterSummary: filterParts.join(' · ') || 'Yok',
      sortBy: fundSortBy,
      sortOrder: fundSortOrder,
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    triggerCsvDownload(
      content,
      `stockmind-tefas-${todayIso}.csv`,
      `${sortedFunds.length} TEFAS fonu, ${fundColumns.length} seçili sütun ile aktarıldı.`
    );
  };
  const resetFundFilters = () => {
    setFundSearch('');
    setSelectedCategory('ALL');
    setFundRiskRange('ALL');
    setFundFeeTier('ALL');
    setFundReturnPeriod('yearlyReturn');
    setFundReturnThreshold('ALL');
    setWatchlistOnly(false);
    setFundPage(1);
  };

  const toggleFundSort = (column: typeof fundSortBy) => {
    if (fundSortBy === column) setFundSortOrder(fundSortOrder === 'desc' ? 'asc' : 'desc');
    else { setFundSortBy(column); setFundSortOrder('desc'); }
    setFundPage(1);
  };

  const indexCategories = [
    { id: 'ALL', label: 'Tüm Endeksler' },
    { id: 'BIST', label: " BIST Endeksleri" },
    { id: 'US', label: " ABD (S&P, Nasdaq, Dow)" },
    { id: 'EU', label: " Avrupa (DAX, FTSE, CAC)" },
    { id: 'ASIA', label: " Asya & Pasifik" },
  ];

  const commodityCategories = [
    { id: 'ALL', label: 'Tüm Emtialar' },
    { id: 'GOLD_TR', label: " Altın & Kıymetli (TL)" },
    { id: 'METALS', label: " Küresel Metaller ($)" },
    { id: 'ENERGY', label: " Enerji & Petrol" },
    { id: 'AGRI', label: " Tarım & Gıda" },
  ];

  const forexCategories = [
    { id: 'ALL', label: 'Tüm Kurlar' },
    { id: 'TRY', label: " Türk Lirası Kurları" },
    { id: 'MAJOR', label: " Majör Pariteler" },
  ];

  const cryptoCategories = [
    { id: 'ALL', label: 'Tüm Kriptolar' },
    { id: 'MAJOR', label: " Majör Kriptolar" },
    { id: 'ALT', label: " Altcoinler" },
  ];

  const sectors = ['ALL', 'Bankacılık', 'Havacılık', 'Savunma', 'Sanayi', 'Perakende', 'Teknoloji', 'Enerji', 'Holding'];

  const fundCategories = [
    { id: 'ALL', label: 'Tüm Fonlar' },
    { id: 'Hisse Senedi Fonu', label: " Hisse" },
    { id: 'Değişken Fon', label: " Değişken" },
    { id: 'Fon Sepeti Fonu', label: " Yabancı" },
    { id: 'Kıymetli Madenler Fonu', label: " Altın" },
    { id: 'Para Piyasası Fonu', label: " Para Piy." },
    { id: 'Borçlanma Araçları Fonu', label: " Borçlanma" },
  ];

  const getBadgeVariant = (ex: string) => {
    if (ex === 'BIST') return 'purple';
    if (ex === 'CRYPTO') return 'warning';
    if (ex === 'COMMODITY') return 'orange';
    if (ex === 'FOREX') return 'emerald';
    if (ex === 'INDEX') return 'info';
    return 'info';
  };

  const renderMiniAssetCard = (item: StockWithQuote, keyPrefix: string) => {
    const isPositive = (item.changePercent || 0) >= 0;
    const curr = (item.currency as string) === 'TRY' ? '₺' : (item.currency as string) === 'EUR' ? '€' : '$';
    const isStarred = checkWatchlisted(item.symbol);
    const isIndexItem = item.isIndex || item.exchange === 'INDEX';
    const statusInfo = classifyStockPriceStatus(item);
    const hasObservedPrice = statusInfo.status !== 'missing';

    return (
      <div
        key={`${keyPrefix}-${item.symbol}`}
        className="glass-card p-3 hover:border-accent/40 transition-all duration-200 flex items-center justify-between gap-2 group relative"
      >
        <Link href={`/stocks/${item.symbol}`} className="flex items-center gap-2.5 min-w-0 flex-1">
          <InstrumentLogo symbol={item.symbol} name={item.name} size="sm" />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-xs sm:text-sm text-text-primary block truncate group-hover:text-accent transition-colors">
              {item.symbol}
            </span>
            <span className="text-[11px] text-text-muted truncate block">
              {item.name}
            </span>
          </div>
        </Link>

        <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
          {hasObservedPrice ? (
            <>
              <span className="font-mono font-bold text-xs sm:text-sm text-text-primary block">
                {(() => {
                  const validP = item.price as number;
                  if (isIndexItem) {
                    return `${validP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Pts`;
                  }
                  return `${curr}${validP < 1 ? validP.toFixed(4) : validP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
                })()}
              </span>
              <span
                className={`font-mono text-[10px] sm:text-xs font-bold px-1.5 py-0.2 rounded ${
                  isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'
                }`}
              >
                {isPositive ? '+' : ''}{Number(item.changePercent || 0).toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-text-muted">Fiyat yok</span>
          )}
          <PriceStatusBadge statusInfo={statusInfo} />
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const added = toggleWatchlist({
              symbol: item.symbol,
              name: item.name,
              assetType: 'stock',
              price: item.price,
              changePercent: item.changePercent,
              exchange: item.exchange,
            });
            showToast({
              type: 'success',
              title: added ? "Takip Listesine Eklendi " : 'Listeden Çıkarıldı',
              message: `${item.symbol} ${added ? 'eklendi' : 'çıkarıldı'}.`,
            });
          }}
          className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors shrink-0 ${
            isStarred ? 'bg-warning/10 text-warning' : 'text-text-muted hover:bg-bg-hover hover:text-warning'
          }`}
          aria-label={`${item.symbol} ${isStarred ? 'takipten çıkar' : 'takibe al'}`} aria-pressed={isStarred}
        >
          <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in pb-12">
      {/* Page Header & Sticky Mobile Top Market Selector */}
      <div className="sticky top-0 z-20 -mx-3 px-3 py-2 bg-bg-primary/95 backdrop-blur-md border-b border-border/50 space-y-2 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-b-0 sm:space-y-0">
        {/* Mobile First-Fold Quick Market Selector (BIST, TEFAS, ABD, Tümü) */}
        <div
          data-testid="mobile-top-market-bar"
          role="tablist"
          aria-label="Hızlı pazar seçimi"
          className="grid grid-cols-4 gap-1.5 sm:hidden"
        >
          {MOBILE_PRIMARY_MARKETS.map((m) => {
            const isActive =
              activeMarket === m.id ||
              (m.id === 'ABD' && (activeMarket === 'NASDAQ' || activeMarket === 'NYSE'));
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleMarketChange(m.id)}
                className={`h-10 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center ${
                  isActive
                    ? 'bg-accent text-white border-accent shadow-sm shadow-accent/25'
                    : 'bg-bg-card text-text-secondary border-border hover:text-text-primary'
                }`}
              >
                {m.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <h1 className="hidden sm:block text-lg font-semibold text-text-primary">Piyasalar</h1>
          <div className="sm:hidden min-w-0 flex-1">
            <select
              aria-label="Piyasa seçimi"
              value={activeMarket}
              onChange={(e) => handleMarketChange(e.target.value as MarketId)}
              className="w-full min-w-0 h-10 rounded-xl border border-border bg-bg-card text-text-primary px-3 text-xs font-medium"
            >
              {MARKETS.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.label}
                </option>
              ))}
            </select>
          </div>
          {/* View Mode Toggle */}
          <div className="inline-flex items-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-accent/15 border-accent text-accent' : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'}`}
              aria-label="Tablo Görünümü" aria-pressed={viewMode === 'table'}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-accent/15 border-accent text-accent' : 'bg-bg-tertiary border-border text-text-muted hover:text-text-primary'}`}
              aria-label="Kart Görünümü" aria-pressed={viewMode === 'grid'}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>


      {/* ═══════════════════ TOUCH-FRIENDLY SCROLLABLE TABS BAR ═══════════════════ */}
      <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 w-full -mx-1 px-1 snap-x">
        {MARKETS.map((m) => {
          const isActive = activeMarket === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleMarketChange(m.id)}
              className={`shrink-0 snap-start whitespace-nowrap flex items-center gap-1.5 py-2.5 px-3.5 sm:px-4 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent text-white shadow-md shadow-accent/25'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border/60'
              }`}
            >
              <MarketIcon name={m.id === 'TEFAS' ? 'layers' : m.id === 'FOREX' ? 'wallet' : 'chart'} />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════ 1. TAB: 'ALL' (TÜM PİYASALAR ÖZETİ) ═══════════════════ */}
      {activeMarket === 'ALL' && (
        <div className="space-y-6">
          {/* Ticker Cards Bar */}
          {overviewData.tickers.length > 0 && (
            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x pb-1 sm:grid sm:grid-cols-3 lg:grid-cols-6">
              {overviewData.tickers.map((t) => {
                return (
                  <button
                    type="button"
                    key={t.symbol}
                    onClick={() => {
                      if (t.symbol === 'XU100') handleMarketChange('BIST');
                      else if (t.symbol === 'GA' || t.symbol === 'BRENT') handleMarketChange('COMMODITY');
                      else if (t.symbol === 'USDTRY' || t.symbol === 'EURTRY') handleMarketChange('FOREX');
                      else if (t.symbol === 'BTC') handleMarketChange('CRYPTO');
                      else handleMarketChange('INDEX');
                    }}
                    className="glass-card min-w-[148px] snap-start p-3.5 text-left hover:border-accent/40 transition-all cursor-pointer group sm:min-w-0"
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <MarketIcon name="chart" />
                      <span className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                        {t.name}
                      </span>
                    </div>
                    <MarketQuoteValue item={t} />
                  </button>
                );
              })}
            </div>
          )}

          {overviewLoading && !overviewData.sections ? (
            <div className="glass-card p-8"><TableSkeleton rows={6} cols={4} /></div>
          ) : (
            <div className="space-y-6">
              {/* Block 1: Kıymetli Madenler & Emtia */}
              {overviewData.sections?.commodity && overviewData.sections.commodity.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span> Kıymetli Madenler & Altın</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('COMMODITY')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (12) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.commodity.map((item) => renderMiniAssetCard(item, 'comm'))}
                  </div>
                </div>
              )}

              {/* Block 2: Döviz & Kurlar */}
              {overviewData.sections?.forex && overviewData.sections.forex.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span> Döviz & Para Kurları</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('FOREX')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (9) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.forex.map((item) => renderMiniAssetCard(item, 'fx'))}
                  </div>
                </div>
              )}

              {/* Block 3: Kripto Paralar */}
              {overviewData.sections?.crypto && overviewData.sections.crypto.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span>₿ Popüler Kripto Paralar</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('CRYPTO')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (14) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.crypto.map((item) => renderMiniAssetCard(item, 'crypto'))}
                  </div>
                </div>
              )}

              {/* Block 4: Küresel Borsa Endeksleri */}
              {overviewData.sections?.indices && overviewData.sections.indices.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span> Küresel Borsa Endeksleri</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('INDEX')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tümünü Gör (8) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {overviewData.sections.indices.map((item) => renderMiniAssetCard(item, 'idx'))}
                  </div>
                </div>
              )}

              {/* Block 5: BIST 100 Trend Hisseleri */}
              {bistStocks && bistStocks.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-text-primary flex items-center gap-2">
                      <span> Borsa İstanbul Trend Hisseleri</span>
                    </h3>
                    <button
                      onClick={() => handleMarketChange('BIST')}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Tüm BIST Hisseleri ({bistStocks.length}) &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {[...bistStocks]
                      .filter((s) => (s.volume || 0) > 1_000_000)
                      .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
                      .slice(0, 6)
                      .map((item) => renderMiniAssetCard(item, 'bist-trend'))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ 2. SPECIFIC STOCKS & MARKETS TABS ═══════════════════ */}
      {isStocksMarket && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={watchlistOnly} onClick={() => setWatchlistOnly(!watchlistOnly)} className={`px-3 py-1 rounded-xl border ${watchlistOnly ? 'bg-accent/15 border-accent text-accent' : 'border-border'}`}>Takip Ettiklerim</button>
              <button
                type="button"
                aria-expanded={showStockColumnMenu}
                onClick={() => setShowStockColumnMenu((prev) => !prev)}
                className={`px-3 py-1 rounded-xl border transition-colors cursor-pointer ${showStockColumnMenu ? 'bg-accent/15 border-accent text-accent font-medium' : 'border-border hover:text-text-primary'}`}
              >
                Sütunlar ({stockColumns.length}/{STOCK_TABLE_COLUMNS.length})
              </button>
              <button
                type="button"
                data-testid="stock-csv-export"
                onClick={handleExportStocksCsv}
                disabled={sortedStocks.length === 0}
                className="px-3 py-1 rounded-xl border border-border hover:border-accent/50 hover:text-text-primary disabled:opacity-50 transition-colors cursor-pointer"
              >
                CSV İndir ({sortedStocks.length})
              </button>
            </div>
            <span className="hidden sm:inline">{stocksUpdatedAt ? `Son kontrol: ${stocksUpdatedAt.toLocaleTimeString('tr-TR')}` : 'Fiyatlar yükleniyor'}</span>
          </div>
          {showStockColumnMenu && (
            <div
              data-testid="stock-column-picker"
              className="glass-card p-2.5 flex flex-wrap items-center gap-1.5 !bg-bg-card"
            >
              <span className="text-[11px] font-medium text-text-muted mr-1">Görünür Sütunlar:</span>
              {STOCK_TABLE_COLUMNS.map((col) => {
                const active = stockColumns.includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    aria-pressed={active}
                    disabled={col.locked}
                    onClick={() =>
                      setStockColumns((prev) =>
                        toggleColumnSelection(
                          prev,
                          col.id,
                          ['symbol'],
                          STOCK_TABLE_COLUMNS,
                        ),
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                      col.locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      active
                        ? 'bg-accent/15 border-accent text-accent font-semibold'
                        : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {col.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setStockColumns(DEFAULT_STOCK_COLUMNS)}
                className="ml-auto text-[11px] font-medium text-accent hover:underline cursor-pointer"
              >
                Varsayılana Dön
              </button>
            </div>
          )}
          {/* Filters Bar */}
          <div className="glass-card p-2 sm:p-3 space-y-2 !bg-bg-card">
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="flex-1 min-w-0">
                <Input
                  type="search"
                  aria-label={`${MARKETS.find((m) => m.id === activeMarket)?.name || activeMarket} pazarında ara`}
                  placeholder={`${MARKETS.find((m) => m.id === activeMarket)?.name || activeMarket} ara...`}
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  leftIcon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                />
              </div>

              {/* Mobile Filter & Sort Drawer Button */}
              <button
                type="button"
                onClick={() => setShowFilterSheet(true)}
                className="sm:hidden flex items-center gap-1.5 h-10 px-3 rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover text-xs font-semibold text-text-primary shrink-0 transition-colors cursor-pointer"
                aria-label="Filtre ve Sıralama"
              >
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filtre</span>
                {(selectedSector !== 'ALL' || stockSortBy !== 'marketCap' || watchlistOnly) && (
                  <span className="w-2 h-2 rounded-full bg-accent" />
                )}
              </button>

              {/* Desktop Quick Sort Options */}
              <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 bg-bg-tertiary/50 p-1 rounded-xl border border-border/60">
                <span className="text-[11px] text-text-muted px-2 font-medium shrink-0">Sırala:</span>
                <button
                  onClick={() => toggleStockSort('marketCap')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    stockSortBy === 'marketCap'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Piyasa Değeri {stockSortBy === 'marketCap' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  onClick={() => toggleStockSort('changePercent')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    stockSortBy === 'changePercent'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Değişim {stockSortBy === 'changePercent' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  onClick={() => toggleStockSort('volume')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    stockSortBy === 'volume'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Hacim {stockSortBy === 'volume' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                </button>
                <button
                  onClick={() => toggleStockSort('price')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    stockSortBy === 'price'
                      ? 'bg-accent text-white shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Fiyat {stockSortBy === 'price' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                </button>
              </div>
            </div>

            {/* Desktop Category / Sector Chips */}
            <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
              {['BIST', 'ABD', 'NASDAQ', 'NYSE'].includes(activeMarket) && sectors.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSector(s)}
                  className={`px-2.5 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] ${
                    selectedSector === s ? 'bg-accent/20 border-accent text-accent font-semibold' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'
                  }`}
                >
                  {s === 'ALL' ? 'Tüm Sektörler' : s}
                </button>
              ))}
              {activeMarket === 'INDEX' && indexCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedSector(c.id)}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] ${
                    selectedSector === c.id ? 'bg-accent/20 border-accent text-accent font-bold shadow-xs' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {activeMarket === 'COMMODITY' && commodityCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedSector(c.id)}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] ${
                    selectedSector === c.id ? 'bg-accent/20 border-accent text-accent font-bold shadow-xs' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {activeMarket === 'FOREX' && forexCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedSector(c.id)}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] ${
                    selectedSector === c.id ? 'bg-accent/20 border-accent text-accent font-bold shadow-xs' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              {activeMarket === 'CRYPTO' && cryptoCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedSector(c.id)}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer shrink-0 text-[11px] ${
                    selectedSector === c.id ? 'bg-accent/20 border-accent text-accent font-bold shadow-xs' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {activeMarket === 'BIST' && (
              <div className="pt-2 border-t border-border/50 space-y-2.5" data-testid="bist-screener-panel">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      data-testid="bist-screener-toggle"
                      aria-expanded={showBistScreenerBar}
                      onClick={() => setShowBistScreenerBar((v) => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        showBistScreenerBar || isBistScreenerActive
                          ? 'bg-accent/15 border-accent text-accent'
                          : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <span>BIST Temel & Fiyat Tarayıcısı</span>
                      {isBistScreenerActive && (
                        <Badge variant="purple" size="sm">Aktif</Badge>
                      )}
                    </button>

                    {savedBistScreeners.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap" data-testid="saved-bist-screeners">
                        {savedBistScreeners.map((preset) => (
                          <div
                            key={preset.id}
                            className={`inline-flex items-center rounded-lg border text-[11px] ${
                              activeScreenerId === preset.id
                                ? 'bg-accent/20 border-accent text-accent font-semibold'
                                : 'bg-bg-tertiary/60 border-border text-text-secondary'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleApplyBistScreener(preset)}
                              className="px-2.5 py-1 hover:text-text-primary cursor-pointer"
                            >
                              {preset.name}
                            </button>
                            <button
                              type="button"
                              aria-label={`${preset.name} tarayıcısını sil`}
                              onClick={() => handleDeleteBistScreener(preset.id)}
                              className="px-1.5 py-1 text-text-muted hover:text-danger cursor-pointer border-l border-border/50"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isBistScreenerActive && (
                    <button
                      type="button"
                      onClick={handleResetBistScreener}
                      className="text-xs text-text-muted hover:text-text-primary underline cursor-pointer"
                    >
                      Tarayıcıyı Sıfırla
                    </button>
                  )}
                </div>

                {showBistScreenerBar && (
                  <div className="p-3 rounded-xl bg-bg-secondary/70 border border-border/70 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
                      <label className="space-y-1">
                        <span className="text-[11px] font-medium text-text-muted block">F/K Oranı</span>
                        <select
                          aria-label="BIST F/K filtresi"
                          value={bistScreener.peBand}
                          onChange={(e) => {
                            setActiveScreenerId(null);
                            setBistScreener((prev) => ({ ...prev, peBand: e.target.value as StockPeBand }));
                          }}
                          className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs text-text-primary"
                        >
                          {STOCK_PE_BAND_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[11px] font-medium text-text-muted block">Temettü Verimi</span>
                        <select
                          aria-label="BIST temettü filtresi"
                          value={bistScreener.dividendTier}
                          onChange={(e) => {
                            setActiveScreenerId(null);
                            setBistScreener((prev) => ({ ...prev, dividendTier: e.target.value as StockDividendTier }));
                          }}
                          className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs text-text-primary"
                        >
                          {STOCK_DIVIDEND_TIER_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[11px] font-medium text-text-muted block">Piyasa Değeri</span>
                        <select
                          aria-label="BIST piyasa değeri filtresi"
                          value={bistScreener.marketCapTier}
                          onChange={(e) => {
                            setActiveScreenerId(null);
                            setBistScreener((prev) => ({ ...prev, marketCapTier: e.target.value as StockMarketCapTier }));
                          }}
                          className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs text-text-primary"
                        >
                          {STOCK_MCAP_TIER_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-[11px] font-medium text-text-muted block">Günlük Fiyat Hareketi</span>
                        <select
                          aria-label="BIST fiyat hareketi filtresi"
                          value={bistScreener.priceChange}
                          onChange={(e) => {
                            setActiveScreenerId(null);
                            setBistScreener((prev) => ({ ...prev, priceChange: e.target.value as StockPriceChangeFilter }));
                          }}
                          className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs text-text-primary"
                        >
                          {STOCK_PRICE_CHANGE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                          ))}
                        </select>
                      </label>

                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-text-muted block">Fiyat Aralığı (₺)</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Min"
                            aria-label="Minimum hisse fiyatı"
                            value={bistScreener.minPrice ?? ''}
                            onChange={(e) => {
                              setActiveScreenerId(null);
                              const v = e.target.value === '' ? null : Number(e.target.value);
                              setBistScreener((prev) => ({ ...prev, minPrice: Number.isFinite(v) ? v : null }));
                            }}
                            className="w-full h-9 rounded-lg border border-border bg-bg-card px-2 text-xs text-text-primary"
                          />
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Max"
                            aria-label="Maksimum hisse fiyatı"
                            value={bistScreener.maxPrice ?? ''}
                            onChange={(e) => {
                              setActiveScreenerId(null);
                              const v = e.target.value === '' ? null : Number(e.target.value);
                              setBistScreener((prev) => ({ ...prev, maxPrice: Number.isFinite(v) ? v : null }));
                            }}
                            className="w-full h-9 rounded-lg border border-border bg-bg-card px-2 text-xs text-text-primary"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <input
                          type="text"
                          value={screenerNameInput}
                          onChange={(e) => setScreenerNameInput(e.target.value)}
                          placeholder="Tarayıcı adı (ör. Ucuz Temettü)"
                          aria-label="Kaydedilecek BIST tarayıcı adı"
                          className="flex-1 h-9 rounded-lg border border-border bg-bg-card px-3 text-xs text-text-primary"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSaveBistScreener}
                        >
                          Kaydet
                        </Button>
                      </div>
                      <span className="text-[11px] text-text-muted">
                        Eşleşen: <strong className="font-mono text-text-primary">{sortedStocks.length}</strong> hisse
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stocks Content */}
          {stocksLoading ? (
            <div className="glass-card p-6"><TableSkeleton rows={8} cols={6} /></div>
          ) : stocksError ? (
            <StateView kind="error" title="Fiyatlar yüklenemedi" description={stocksError} action={<Button onClick={() => void refetchStocks()}>Tekrar Dene</Button>} />
          ) : sortedStocks.length === 0 ? (
            <StateView
              kind="empty"
              title="Kriterlere uygun varlık bulunamadı"
              description="Aktif arama veya sektör filtresiyle eşleşen hisse bulunmuyor."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStockSearch('');
                    setWatchlistOnly(false);
                    handleResetBistScreener();
                  }}
                >
                  Filtreleri Temizle
                </Button>
              }
            />
          ) : viewMode === 'table' ? (
            /* Stocks Table with Lazy Load */
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-secondary/80 text-text-muted text-[11px] sm:text-xs uppercase tracking-wider border-b border-border/80">
                    <tr>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold">Sembol</th>
                      {stockColumns.includes('market') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold hidden sm:table-cell">Piyasa</th>
                      )}
                      {stockColumns.includes('sector') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold hidden md:table-cell">Sektör</th>
                      )}
                      {stockColumns.includes('price') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleStockSort('price')}>
                          {activeMarket === 'INDEX' ? 'Puan / Değer' : 'Fiyat'} {stockSortBy === 'price' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {stockColumns.includes('changePercent') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleStockSort('changePercent')}>
                          Değişim {stockSortBy === 'changePercent' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {stockColumns.includes('volume') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden md:table-cell" onClick={() => toggleStockSort('volume')}>
                          Hacim {stockSortBy === 'volume' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {stockColumns.includes('marketCap') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden lg:table-cell" onClick={() => toggleStockSort('marketCap')}>
                          {activeMarket === 'INDEX' ? 'Endeks Büyüklüğü' : 'Piyasa Değeri'} {stockSortBy === 'marketCap' && (stockSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {stockColumns.includes('peRatio') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right hidden lg:table-cell">F/K</th>
                      )}
                      {stockColumns.includes('dividendYield') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right hidden lg:table-cell">Temettü %</th>
                      )}
                      <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <WindowedRows columns={stockColumns.length + 1}>{visibleStocks.map((stock) => {
                      const isPositive = (stock.changePercent || 0) >= 0;
                      const curr = (stock.currency as string) === 'TRY' ? '₺' : (stock.currency as string) === 'EUR' ? '€' : '$';
                      const badgeVariant = getBadgeVariant(stock.exchange);
                      const desc = describeSearchResult(stock);

                      return (
                        <tr key={stock.symbol} className="hover:bg-bg-hover/60 transition-colors group cursor-pointer">
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-2 sm:gap-2.5">
                              <InstrumentLogo symbol={stock.symbol} name={stock.name} size="sm" />
                              <div>
                                <span className="font-bold text-text-primary block group-hover:text-accent transition-colors text-xs sm:text-sm">{desc.symbol}</span>
                                <span className="text-[11px] text-text-muted line-clamp-1 hidden sm:block">{desc.name}</span>
                                <span className="text-[10px] text-text-muted sm:hidden block">
                                  {desc.exchange} • {desc.assetTypeLabel} • {desc.currency}
                                </span>
                              </div>
                            </Link>
                          </td>
                          {stockColumns.includes('market') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant={badgeVariant as any} size="sm">{desc.exchange}</Badge>
                                <span className="text-[11px] text-text-muted">{desc.assetTypeLabel} • {desc.currency}</span>
                              </div>
                            </td>
                          )}
                          {stockColumns.includes('sector') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs text-text-secondary hidden md:table-cell">
                              {stock.sector || '—'}
                            </td>
                          )}
                          {stockColumns.includes('price') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono font-semibold text-text-primary text-xs sm:text-sm whitespace-nowrap">
                              {(() => {
                                const statusInfo = classifyStockPriceStatus(stock);
                                if (statusInfo.status === 'missing') {
                                  return (
                                    <div className="flex flex-col items-end gap-0.5 font-sans">
                                      <span className="text-xs font-medium text-text-muted">Fiyat yok</span>
                                      <PriceStatusBadge statusInfo={statusInfo} />
                                    </div>
                                  );
                                }
                                const validP = stock.price as number;
                                const resolvedUnit = resolveAssetDisplayUnit({
                                  symbol: stock.symbol,
                                  exchange: stock.exchange,
                                  currency: stock.currency,
                                  unit: stock.unit,
                                  isIndex: activeMarket === 'INDEX' || stock.isIndex,
                                });
                                if (resolvedUnit === 'puan') {
                                  return (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span>{formatAssetUnitPrice({ value: validP, symbol: stock.symbol, exchange: stock.exchange, currency: stock.currency, unit: 'points', isIndex: true })}</span>
                                      <PriceStatusBadge statusInfo={statusInfo} />
                                    </div>
                                  );
                                }
                                if (activeMarket === 'COMMODITY' || resolvedUnit === 'TL/gram') {
                                  return (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <span>
                                        {resolvedUnit === 'TL/gram'
                                          ? formatAssetUnitPrice({ value: validP, symbol: stock.symbol, exchange: stock.exchange, currency: stock.currency, unit: 'TL/gram' })
                                          : `${curr}${validP < 1 ? validP.toFixed(4) : validP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                      </span>
                                      {stock.unit && resolvedUnit !== 'TL/gram' && (
                                        <span className="text-[10px] text-text-muted font-normal font-sans">{stock.unit}</span>
                                      )}
                                      <PriceStatusBadge statusInfo={statusInfo} />
                                    </div>
                                  );
                                }
                                return (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span>
                                      {curr}{validP < 1 ? (validP < 0.001 ? validP.toFixed(6) : validP.toFixed(4)) : validP.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: activeMarket === 'FOREX' ? 4 : 2 })}
                                    </span>
                                    <PriceStatusBadge statusInfo={statusInfo} />
                                  </div>
                                );
                              })()}
                            </td>
                          )}
                          {stockColumns.includes('changePercent') && (
                            <td className="py-2 sm:py-3 px-1.5 sm:px-4 text-right font-mono whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 font-semibold text-[11px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg ${isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                                {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                              </span>
                            </td>
                          )}
                          {stockColumns.includes('volume') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-text-secondary text-xs hidden md:table-cell">
                              {stock.volume ? (stock.volume > 1e6 ? `${(stock.volume / 1e6).toFixed(1)}M` : `${(stock.volume / 1e3).toFixed(0)}K`) : '-'}
                            </td>
                          )}
                          {stockColumns.includes('marketCap') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-text-secondary text-xs hidden lg:table-cell">
                              {stock.marketCap
                                ? stock.marketCap >= 1e12
                                  ? `${curr}${(stock.marketCap / 1e12).toFixed(2)} Tr`
                                  : stock.marketCap >= 1e9
                                  ? `${curr}${(stock.marketCap / 1e9).toFixed(1)} Mr`
                                  : stock.marketCap >= 1e6
                                  ? `${curr}${(stock.marketCap / 1e6).toFixed(0)} M`
                                  : '-'
                                : '-'}
                            </td>
                          )}
                          {stockColumns.includes('peRatio') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-text-secondary text-xs hidden lg:table-cell">
                              {typeof stock.peRatio === 'number' && Number.isFinite(stock.peRatio) && stock.peRatio > 0
                                ? stock.peRatio.toFixed(1)
                                : '—'}
                            </td>
                          )}
                          {stockColumns.includes('dividendYield') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-text-secondary text-xs hidden lg:table-cell">
                              {typeof stock.dividendYield === 'number' && Number.isFinite(stock.dividendYield)
                                ? `%${stock.dividendYield.toFixed(2)}`
                                : '—'}
                            </td>
                          )}
                          <td className="py-2 sm:py-3 px-1.5 sm:px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  const added = toggleWatchlist({ symbol: stock.symbol, name: stock.name, assetType: 'stock', price: stock.price, changePercent: stock.changePercent, exchange: stock.exchange });
                                  showToast({ type: 'success', title: added ? "Takip Listesine Eklendi " : 'Listeden Çıkarıldı', message: `${stock.symbol} ${added ? 'eklendi' : 'çıkarıldı'}.` });
                                }}
                                aria-label={`${stock.symbol} ${checkWatchlisted(stock.symbol) ? 'takipten çıkar' : 'takibe al'}`} aria-pressed={checkWatchlisted(stock.symbol)}
                                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors cursor-pointer ${checkWatchlisted(stock.symbol) ? 'bg-warning/10 text-warning' : 'text-text-muted hover:bg-bg-hover hover:text-warning'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${checkWatchlisted(stock.symbol) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                              </button>
                              <div className="hidden sm:inline-flex">
                                <Link href={`/stocks/${stock.symbol}`}>
                                  <Button variant="ghost" size="sm">→</Button>
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}</WindowedRows>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Stocks Grid with Lazy Load */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleStocks.map((stock) => {
                const isPositive = (stock.changePercent || 0) >= 0;
                const curr = (stock.currency as string) === 'TRY' ? '₺' : (stock.currency as string) === 'EUR' ? '€' : '$';
                const isStarred = checkWatchlisted(stock.symbol);
                const badgeVariant = getBadgeVariant(stock.exchange);

                return (
                  <div key={stock.symbol} className="glass-card p-4 hover:border-accent/40 hover:shadow-lg transition-all duration-300 group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/stocks/${stock.symbol}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                        <InstrumentLogo symbol={stock.symbol} name={stock.name} size="md" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">{stock.symbol}</h4>
                          <span className={`font-mono text-xs font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>{isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%</span>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist({ symbol: stock.symbol, name: stock.name, assetType: 'stock', price: stock.price, changePercent: stock.changePercent, exchange: stock.exchange }); }}
                        aria-label={`${stock.symbol} ${isStarred ? 'takipten çıkar' : 'takibe al'}`} aria-pressed={isStarred}
                        className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors cursor-pointer shrink-0 ${isStarred ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-warning'}`}
                      >
                        <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    </div>
                    <Link href={`/stocks/${stock.symbol}`}>
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-text-muted block mb-0.5">
                            {stock.isIndex || activeMarket === 'INDEX' ? 'Endeks Değeri' : 'Son Fiyat'}
                          </span>
                          {(() => {
                            const statusInfo = classifyStockPriceStatus(stock);
                            const hasObservedPrice = statusInfo.status !== 'missing';
                            return (
                              <div className="space-y-1">
                                <span className="text-sm font-bold font-mono text-text-primary block">
                                  {!hasObservedPrice
                                    ? 'Fiyat yok'
                                    : stock.isIndex || activeMarket === 'INDEX'
                                      ? `${(stock.price as number).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Pts`
                                      : `${curr}${(stock.price as number) < 1 ? (stock.price as number).toFixed(4) : (stock.price as number).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: activeMarket === 'FOREX' ? 4 : 2 })}`}
                                </span>
                                <PriceStatusBadge statusInfo={statusInfo} />
                              </div>
                            );
                          })()}
                          {stock.unit && (
                            <span className="text-[10px] text-text-muted block font-sans mt-0.5">{stock.unit}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-text-muted block">
                            {stock.isIndex || activeMarket === 'INDEX' ? 'Büyüklük' : 'Piyasa Değeri'}
                          </span>
                          <span className="text-xs font-semibold font-mono text-text-secondary">
                            {stock.marketCap
                              ? stock.marketCap >= 1e12
                                ? `${curr}${(stock.marketCap / 1e12).toFixed(1)} Tr`
                                : stock.marketCap >= 1e9
                                ? `${curr}${(stock.marketCap / 1e9).toFixed(1)} Mr`
                                : `${curr}${(stock.marketCap / 1e6).toFixed(0)} M`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Server-backed Stocks Pagination Bar */}
          {stockTotalCount > 0 && (
            <div
              data-testid="stocks-pagination"
              className="py-4 px-4 glass-card rounded-2xl border border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <span className="text-xs text-text-muted font-medium">
                Sayfa {stockPage} / {stockTotalPages} • Toplam {stockTotalCount} varlık ({visibleStocks.length} gösteriliyor)
              </span>
              {stockTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={stockPage <= 1}
                    onClick={() => {
                      setStockPage((p) => Math.max(1, p - 1));
                      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ← Önceki
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={stockPage >= stockTotalPages}
                    onClick={() => {
                      setStockPage((p) => Math.min(stockTotalPages, p + 1));
                      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Sonraki →
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ 3. TAB: TEFAS FUNDS ═══════════════════ */}
      {activeMarket === 'TEFAS' && (
        <div className="space-y-4">
          {/* Funds Filters */}
          <div className="glass-card p-2 sm:p-3 space-y-2 !bg-bg-card">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  type="search"
                  aria-label="TEFAS fon kodu veya kurucu ara"
                  placeholder="Fon kodu veya kurucu ara (örn: TI2, MAC)..."
                  value={fundSearch}
                  onChange={(e) => { setFundSearch(e.target.value); setFundPage(1); }}
                  leftIcon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                />
              </div>

              {/* Mobile Filter Button */}
              <button
                type="button"
                onClick={() => setShowFilterSheet(true)}
                className="sm:hidden flex items-center gap-1.5 h-10 px-3 rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover text-xs font-semibold text-text-primary shrink-0 transition-colors cursor-pointer"
                aria-label="Fon Kategori ve Sıralama"
              >
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filtre</span>
                {activeFundFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-accent text-white text-[10px] leading-none font-bold">
                    {activeFundFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Desktop Category Chips */}
            <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {fundCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id); setFundPage(1); }}
                  className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer shrink-0 text-xs ${selectedCategory === cat.id ? 'bg-accent/20 border-accent text-accent font-semibold' : 'bg-bg-tertiary/50 border-border/60 text-text-secondary hover:text-text-primary hover:border-border'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Desktop Extended Filters: Risk, Management Fee, and Period Return */}
            <div
              data-testid="fund-extended-filters"
              className="hidden sm:flex flex-wrap items-center gap-2 pt-2 border-t border-border/40"
            >
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="font-medium text-text-muted">Risk:</span>
                <select
                  aria-label="Fon risk seviyesi filtresi"
                  value={fundRiskRange}
                  onChange={(e) => { setFundRiskRange(e.target.value as FundRiskRange); setFundPage(1); }}
                  className="bg-bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  {FUND_RISK_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="font-medium text-text-muted">Ücret:</span>
                <select
                  aria-label="Fon yönetim ücreti filtresi"
                  value={fundFeeTier}
                  onChange={(e) => { setFundFeeTier(e.target.value as FundFeeTier); setFundPage(1); }}
                  className="bg-bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  {FUND_FEE_TIER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="font-medium text-text-muted">Dönem:</span>
                <select
                  aria-label="Fon getiri dönemi seçimi"
                  value={fundReturnPeriod}
                  onChange={(e) => {
                    const nextPeriod = e.target.value as FundReturnPeriod;
                    setFundReturnPeriod(nextPeriod);
                    if (
                      nextPeriod === 'dailyReturn' ||
                      nextPeriod === 'monthlyReturn' ||
                      nextPeriod === 'return3m' ||
                      nextPeriod === 'yearlyReturn' ||
                      nextPeriod === 'return3y' ||
                      nextPeriod === 'return5y'
                    ) {
                      setFundSortBy(nextPeriod);
                    }
                    setFundPage(1);
                  }}
                  className="bg-bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  {FUND_RETURN_PERIOD_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className="font-medium text-text-muted">Getiri:</span>
                <select
                  aria-label="Fon getiri eşiği filtresi"
                  value={fundReturnThreshold}
                  onChange={(e) => { setFundReturnThreshold(e.target.value as FundReturnThreshold); setFundPage(1); }}
                  className="bg-bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  {FUND_RETURN_THRESHOLD_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </label>

              {activeFundFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTefasPresetId(null);
                    resetFundFilters();
                  }}
                  className="ml-auto text-xs font-semibold text-accent hover:underline cursor-pointer"
                >
                  Filtreleri Temizle ({activeFundFilterCount})
                </button>
              )}
            </div>

            {/* Savable TEFAS Filter Sets (PIY-09) */}
            <div
              data-testid="tefas-saved-presets"
              className="pt-2 border-t border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-medium text-text-muted mr-1">Kayıtlı Setler:</span>
                {savedTefasPresets.length === 0 ? (
                  <span className="text-[11px] text-text-muted">Henüz kayıtlı fon filtresi yok</span>
                ) : (
                  savedTefasPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`inline-flex items-center rounded-lg border text-[11px] ${
                        activeTefasPresetId === preset.id
                          ? 'bg-accent/20 border-accent text-accent font-semibold'
                          : 'bg-bg-tertiary/60 border-border text-text-secondary'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyTefasPreset(preset)}
                        className="px-2.5 py-1 hover:text-text-primary cursor-pointer"
                      >
                        {preset.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`${preset.name} filtre setini sil`}
                        onClick={() => handleDeleteTefasPreset(preset.id)}
                        className="px-1.5 py-1 text-text-muted hover:text-danger cursor-pointer border-l border-border/50"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-1.5 max-w-xs w-full sm:w-auto">
                <input
                  type="text"
                  value={tefasPresetNameInput}
                  onChange={(e) => setTefasPresetNameInput(e.target.value)}
                  placeholder="Filtre seti adı (ör. Düşük Risk)"
                  aria-label="Kaydedilecek TEFAS filtre seti adı"
                  className="flex-1 sm:w-44 h-8 rounded-lg border border-border bg-bg-secondary px-2.5 text-xs text-text-primary"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveTefasPreset}
                >
                  Seti Kaydet
                </Button>
              </div>
            </div>

            {/* TEFAS Column Picker & CSV Export (PIY-10) */}
            <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  aria-expanded={showFundColumnMenu}
                  onClick={() => setShowFundColumnMenu((prev) => !prev)}
                  className={`px-3 py-1 rounded-xl border transition-colors cursor-pointer ${showFundColumnMenu ? 'bg-accent/15 border-accent text-accent font-medium' : 'border-border hover:text-text-primary'}`}
                >
                  Sütunlar ({fundColumns.length}/{FUND_TABLE_COLUMNS.length})
                </button>
                <button
                  type="button"
                  data-testid="fund-csv-export"
                  onClick={handleExportFundsCsv}
                  disabled={sortedFunds.length === 0}
                  className="px-3 py-1 rounded-xl border border-border hover:border-accent/50 hover:text-text-primary disabled:opacity-50 transition-colors cursor-pointer"
                >
                  CSV İndir ({sortedFunds.length})
                </button>
              </div>
              {showFundColumnMenu && (
                <div
                  data-testid="fund-column-picker"
                  className="w-full pt-2 flex flex-wrap items-center gap-1.5"
                >
                  <span className="text-[11px] font-medium text-text-muted mr-1">Görünür Sütunlar:</span>
                  {FUND_TABLE_COLUMNS.map((col) => {
                    const active = fundColumns.includes(col.id);
                    return (
                      <button
                        key={col.id}
                        type="button"
                        aria-pressed={active}
                        disabled={col.locked}
                        onClick={() =>
                          setFundColumns((prev) =>
                            toggleColumnSelection(
                              prev,
                              col.id,
                              ['code'],
                              FUND_TABLE_COLUMNS,
                            ),
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                          col.locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          active
                            ? 'bg-accent/15 border-accent text-accent font-semibold'
                            : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {col.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setFundColumns(DEFAULT_FUND_COLUMNS)}
                    className="ml-auto text-[11px] font-medium text-accent hover:underline cursor-pointer"
                  >
                    Varsayılana Dön
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Funds Content */}
          {fundsLoading ? (
            <div className="glass-card p-6"><TableSkeleton rows={8} cols={6} /></div>
          ) : fundsError ? (
            <StateView kind="error" title="Fonlar yüklenemedi" description={fundsError} action={<Button onClick={() => void refetchFunds()}>Tekrar Dene</Button>} />
          ) : sortedFunds.length === 0 ? (
            <StateView
              kind="empty"
              title="Kriterlere uygun TEFAS fonu bulunamadı"
              description="Seçili fon kategorisi, risk seviyesi, yönetim ücreti veya getiri kriterleriyle eşleşen fon yok."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetFundFilters}
                >
                  Filtreleri Temizle
                </Button>
              }
            />
          ) : viewMode === 'table' ? (
            /* Funds Table */
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-bg-secondary/80 text-text-muted text-[11px] sm:text-xs uppercase tracking-wider border-b border-border/80">
                    <tr>
                      <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold">Fon Kodu</th>
                      {fundColumns.includes('price') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleFundSort('price')}>
                          Fiyat {fundSortBy === 'price' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {fundColumns.includes('dailyReturn') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary" onClick={() => toggleFundSort('dailyReturn')}>
                          Günlük {fundSortBy === 'dailyReturn' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {fundColumns.includes('monthlyReturn') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary hidden sm:table-cell" onClick={() => toggleFundSort('monthlyReturn')}>
                          1 Ay {fundSortBy === 'monthlyReturn' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {fundColumns.includes('periodReturn') && (
                        <th
                          className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right cursor-pointer hover:text-text-primary"
                          onClick={() => {
                            const sortKey =
                              fundReturnPeriod === 'dailyReturn' ||
                              fundReturnPeriod === 'monthlyReturn' ||
                              fundReturnPeriod === 'return3m' ||
                              fundReturnPeriod === 'yearlyReturn' ||
                              fundReturnPeriod === 'return3y' ||
                              fundReturnPeriod === 'return5y'
                                ? fundReturnPeriod
                                : 'yearlyReturn';
                            toggleFundSort(sortKey);
                          }}
                        >
                          {selectedReturnPeriodMeta.shortLabel} {fundSortBy === fundReturnPeriod && (fundSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {fundColumns.includes('riskValue') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-center hidden md:table-cell cursor-pointer hover:text-text-primary" onClick={() => toggleFundSort('riskValue')}>
                          Risk / Ücret {fundSortBy === 'riskValue' && (fundSortOrder === 'desc' ? '↓' : '↑')}
                        </th>
                      )}
                      {fundColumns.includes('managementFee') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold text-right hidden lg:table-cell">Yönetim Ücreti</th>
                      )}
                      {fundColumns.includes('category') && (
                        <th className="py-2.5 sm:py-3 px-2 sm:px-4 font-semibold hidden lg:table-cell">Kategori</th>
                      )}
                      <th className="py-2.5 sm:py-3 px-1.5 sm:px-4 text-center">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    <WindowedRows columns={fundColumns.length + 1}>{visibleFunds.map((fund) => {
                      const dailyPos = (fund.dailyReturn || 0) >= 0;
                      const periodRet = getFundPeriodReturn(fund, fundReturnPeriod);
                      const periodPos = (periodRet ?? 0) >= 0;
                      const fundDesc = describeSearchResult({ code: fund.code, name: fund.name, exchange: 'TEFAS', assetType: 'fund', currency: 'TRY' });
                      return (
                        <tr key={fund.code} className="hover:bg-bg-hover/60 transition-colors group cursor-pointer">
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            <Link href={`/funds/${fund.code}`} className="flex items-center gap-2 sm:gap-2.5">
                              <InstrumentLogo symbol={fund.code} name={fund.name} size="sm" />
                              <div>
                                <span className="font-bold text-text-primary block group-hover:text-accent transition-colors text-xs sm:text-sm">{fundDesc.symbol}</span>
                                <span className="text-[11px] text-text-muted line-clamp-1 hidden sm:block">{fundDesc.name}</span>
                                <span className="text-[10px] text-text-muted block">
                                  {fundDesc.exchange} • {fundDesc.assetTypeLabel} • {fundDesc.currency}
                                </span>
                              </div>
                            </Link>
                          </td>
                          {fundColumns.includes('price') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono font-semibold text-text-primary text-xs sm:text-sm whitespace-nowrap">
                              <div className="flex flex-col items-end gap-0.5">
                                <span>{fund.price == null ? 'Fiyat yok' : `₺${fund.price.toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}</span>
                                <PriceStatusBadge statusInfo={classifyFundPriceStatus(fund)} />
                                {fund.price != null && (
                                  <span className="font-sans text-[10px] font-normal text-text-muted">
                                    {fund.navDate ? <time dateTime={fund.navDate} title="TEFAS değerleme tarihi">{formatDate(fund.navDate, 'tr-TR', { timeZone: 'UTC' })}</time> : 'Tarih bilinmiyor'}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {fundColumns.includes('dailyReturn') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 font-semibold text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-lg ${dailyPos ? 'text-success bg-success/10' : 'text-danger bg-danger/10'}`}>
                                {fund.price == null ? '—' : `${dailyPos ? '+' : ''}${fund.dailyReturn.toFixed(2)}%`}
                              </span>
                            </td>
                          )}
                          {fundColumns.includes('monthlyReturn') && (
                            <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-xs hidden sm:table-cell font-semibold ${(fund.monthlyReturn || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                              {fund.price == null ? '—' : `${fund.monthlyReturn >= 0 ? '+' : ''}${fund.monthlyReturn.toFixed(2)}%`}
                            </td>
                          )}
                          {fundColumns.includes('periodReturn') && (
                            <td className={`py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-xs font-bold ${periodPos ? 'text-success' : 'text-danger'}`}>
                              {periodRet == null ? '—' : `${periodPos ? '+' : ''}${periodRet.toFixed(2)}%`}
                            </td>
                          )}
                          {fundColumns.includes('riskValue') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-center hidden md:table-cell">
                              <div className="flex flex-col items-center gap-0.5">
                                {fund.riskValue ? (
                                  <Badge variant={fund.riskValue <= 2 ? 'success' : fund.riskValue <= 4 ? 'warning' : 'danger'} size="sm">
                                    Risk {fund.riskValue}/7
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-text-muted">Risk yok</span>
                                )}
                                <span className="text-[10px] font-mono text-text-muted">
                                  {fund.managementFee != null ? `%${fund.managementFee.toFixed(2)} ücret` : 'Ücret yok'}
                                </span>
                              </div>
                            </td>
                          )}
                          {fundColumns.includes('managementFee') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-mono text-xs text-text-secondary hidden lg:table-cell">
                              {fund.managementFee != null ? `%${fund.managementFee.toFixed(2)}` : '—'}
                            </td>
                          )}
                          {fundColumns.includes('category') && (
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs text-text-secondary hidden lg:table-cell">
                              {fund.category || '—'}
                            </td>
                          )}
                          <td className="py-2 sm:py-3 px-1.5 sm:px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  const added = toggleWatchlist({ symbol: fund.code, name: fund.name, assetType: 'fund', price: fund.price || 0, changePercent: fund.dailyReturn || 0, exchange: 'TEFAS' as any });
                                  showToast({ type: 'success', title: added ? "Takip Listesine Eklendi " : 'Listeden Çıkarıldı', message: `${fund.code} ${added ? 'eklendi' : 'çıkarıldı'}.` });
                                }}
                                aria-label={`${fund.code} ${checkWatchlisted(fund.code) ? 'takipten çıkar' : 'takibe al'}`} aria-pressed={checkWatchlisted(fund.code)}
                                className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors cursor-pointer ${checkWatchlisted(fund.code) ? 'bg-warning/10 text-warning' : 'text-text-muted hover:bg-bg-hover hover:text-warning'}`}
                              >
                                <svg className={`w-3.5 h-3.5 ${checkWatchlisted(fund.code) ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  toggleCompareFund(fund.code);
                                }}
                                aria-label={`${fund.code} karşılaştırmaya ${compareFundCodes.includes(fund.code) ? 'çıkar' : 'ekle'}`}
                                aria-pressed={compareFundCodes.includes(fund.code)}
                                className={`hidden sm:inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                                  compareFundCodes.includes(fund.code)
                                    ? 'bg-accent/15 border-accent/40 text-accent'
                                    : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-text-primary'
                                }`}
                              >
                                {compareFundCodes.includes(fund.code) ? 'Seçildi' : 'Kıyasla'}
                              </button>
                              <div className="hidden sm:inline-flex">
                                <Link href={`/funds/${fund.code}`}>
                                  <Button variant="ghost" size="sm">→</Button>
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}</WindowedRows>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Funds Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleFunds.map((fund) => {
                const dailyPos = (fund.dailyReturn || 0) >= 0;
                const yearlyPos = (fund.yearlyReturn || 0) >= 0;
                const isStarred = checkWatchlisted(fund.code);
                return (
                  <div key={fund.code} className="glass-card p-4 hover:border-accent/40 hover:shadow-lg transition-all duration-300 group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/funds/${fund.code}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                        <InstrumentLogo symbol={fund.code} name={fund.name} size="md" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-text-primary group-hover:text-accent transition-colors text-sm truncate">{fund.code}</h4>
                          <span className={`font-mono text-xs font-semibold ${dailyPos ? 'text-success' : 'text-danger'}`}>{fund.price == null ? 'Fiyat yok' : `${dailyPos ? '+' : ''}${fund.dailyReturn.toFixed(2)}%`}</span>
                          <div className="mt-1">
                            <PriceStatusBadge statusInfo={classifyFundPriceStatus(fund)} />
                          </div>
                          {fund.price != null && <span className="block text-[10px] text-text-muted mt-0.5">
                            {fund.navDate ? <>Değerleme <time dateTime={fund.navDate}>{formatDate(fund.navDate, 'tr-TR', { timeZone: 'UTC' })}</time></> : 'Değerleme tarihi bilinmiyor'}
                          </span>}
                        </div>
                      </Link>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatchlist({ symbol: fund.code, name: fund.name, assetType: 'fund', price: fund.price || 0, changePercent: fund.dailyReturn || 0, exchange: 'TEFAS' as any }); }}
                        aria-label={`${fund.code} ${isStarred ? 'takipten çıkar' : 'takibe al'}`} aria-pressed={isStarred}
                        className={`inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors cursor-pointer shrink-0 ${isStarred ? 'bg-warning/20 border-warning text-warning' : 'bg-bg-tertiary/60 border-border text-text-muted hover:text-warning'}`}
                      >
                        <svg className={`w-3.5 h-3.5 ${isStarred ? 'fill-warning text-warning' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    </div>
                    <Link href={`/funds/${fund.code}`}>
                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-text-muted block">1 Yıllık Getiri</span>
                          <span className={`text-sm font-bold font-mono ${yearlyPos ? 'text-success' : 'text-danger'}`}>
                            {fund.price == null ? '—' : `${yearlyPos ? '+' : ''}${fund.yearlyReturn.toFixed(2)}%`}
                          </span>
                        </div>
                        <Badge variant="info" size="sm">TEFAS</Badge>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          {/* Server-backed TEFAS Pagination Bar */}
          {fundTotalCount > 0 && (
            <div
              data-testid="funds-pagination"
              className="py-4 px-4 glass-card rounded-2xl border border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <span className="text-xs text-text-muted font-medium">
                Sayfa {fundPage} / {fundTotalPages} • Toplam {fundTotalCount} TEFAS fonu ({visibleFunds.length} gösteriliyor)
              </span>
              {fundTotalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={fundPage <= 1}
                    onClick={() => {
                      setFundPage((p) => Math.max(1, p - 1));
                      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    ← Önceki
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={fundPage >= fundTotalPages}
                    onClick={() => {
                      setFundPage((p) => Math.min(fundTotalPages, p + 1));
                      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Sonraki →
                  </Button>
                </div>
              )}
            </div>
          )}

          {compareFundCodes.length > 0 && (
            <div
              data-testid="fund-compare-bar"
              className="sticky bottom-16 lg:bottom-4 z-30 glass-card p-3 sm:p-4 border border-accent/40 shadow-xl flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-text-primary">
                  Karşılaştırma ({compareFundCodes.length}/4):
                </span>
                {compareFundCodes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCompareFund(c)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-xs font-bold hover:bg-accent/25 cursor-pointer"
                  >
                    {c} ✕
                  </button>
                ))}
                {compareFundCodes.length < 2 && (
                  <span className="text-[11px] text-text-muted">En az 1 fon daha seçin</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCompareFundCodes([])}>
                  Temizle
                </Button>
                <Link href={`/funds/compare?codes=${compareFundCodes.join(',')}`}>
                  <Button variant="primary" size="sm" disabled={compareFundCodes.length < 2}>
                    Yan Yana Karşılaştır
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Filter & Sort Drawer (Bottom Sheet) */}
      {showFilterSheet && (
        <Modal
          isOpen={showFilterSheet}
          onClose={() => setShowFilterSheet(false)}
          presentation="sheet"
          title="Filtre & Sıralama"
          description="Piyasa listesini kriterlerinize göre özelleştirin"
          size="md"
        >
          <div className="space-y-4 py-2">
            {/* 1. Sort Section */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                Sıralama Ölçütü
              </span>
              {activeMarket === 'TEFAS' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'yearlyReturn', label: '1 Yıllık Getiri' },
                    { id: 'monthlyReturn', label: '1 Aylık Getiri' },
                    { id: 'dailyReturn', label: 'Günlük Getiri' },
                    { id: 'return3y', label: '3 Yıllık Getiri' },
                    { id: 'price', label: 'Birim Fiyat' },
                    { id: 'riskValue', label: 'Risk Değeri' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleFundSort(opt.id as typeof fundSortBy)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer flex items-center justify-between ${
                        fundSortBy === opt.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {fundSortBy === opt.id && <span>{fundSortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'marketCap', label: 'Piyasa Değeri' },
                    { id: 'changePercent', label: 'Günlük Değişim' },
                    { id: 'volume', label: 'İşlem Hacmi' },
                    { id: 'price', label: 'Fiyat' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleStockSort(opt.id as typeof stockSortBy)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer flex items-center justify-between ${
                        stockSortBy === opt.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {stockSortBy === opt.id && <span>{stockSortOrder === 'desc' ? '↓' : '↑'}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Category / Sector Section */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                {activeMarket === 'TEFAS' ? 'Fon Kategorisi' : 'Sektör / Kategori'}
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
                {activeMarket === 'TEFAS' &&
                  fundCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCategory(c.id); setFundPage(1); }}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedCategory === c.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}

                {['BIST', 'ABD', 'NASDAQ', 'NYSE'].includes(activeMarket) &&
                  sectors.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSector(s)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSector === s
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {s === 'ALL' ? 'Tüm Sektörler' : s}
                    </button>
                  ))}

                {activeMarket === 'INDEX' &&
                  indexCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedSector(c.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSector === c.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}

                {activeMarket === 'COMMODITY' &&
                  commodityCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedSector(c.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSector === c.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}

                {activeMarket === 'FOREX' &&
                  forexCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedSector(c.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSector === c.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}

                {activeMarket === 'CRYPTO' &&
                  cryptoCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedSector(c.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        selectedSector === c.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-border bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
              </div>
            </div>

            {activeMarket === 'TEFAS' && (
              <div className="space-y-3 pt-1 border-t border-border/60">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                    Risk Seviyesi
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FUND_RISK_RANGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { setFundRiskRange(opt.id); setFundPage(1); }}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          fundRiskRange === opt.id
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-border bg-bg-secondary text-text-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider block">
                    Yönetim Ücreti
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {FUND_FEE_TIER_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => { setFundFeeTier(opt.id); setFundPage(1); }}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          fundFeeTier === opt.id
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-border bg-bg-secondary text-text-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs">
                    <span className="font-bold text-text-primary uppercase tracking-wider block">Dönem</span>
                    <select
                      aria-label="Mobil fon getiri dönemi"
                      value={fundReturnPeriod}
                      onChange={(e) => { setFundReturnPeriod(e.target.value as FundReturnPeriod); setFundPage(1); }}
                      className="w-full bg-bg-secondary border border-border rounded-xl px-2.5 py-2 text-xs text-text-primary"
                    >
                      {FUND_RETURN_PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="font-bold text-text-primary uppercase tracking-wider block">Getiri Eşiği</span>
                    <select
                      aria-label="Mobil fon getiri eşiği"
                      value={fundReturnThreshold}
                      onChange={(e) => { setFundReturnThreshold(e.target.value as FundReturnThreshold); setFundPage(1); }}
                      className="w-full bg-bg-secondary border border-border rounded-xl px-2.5 py-2 text-xs text-text-primary"
                    >
                      {FUND_RETURN_THRESHOLD_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}

            {/* 3. Watchlist Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-bg-secondary border border-border">
              <div>
                <span className="text-xs font-bold text-text-primary block">Yalnızca Takip Listem</span>
                <span className="text-[11px] text-text-muted">Favoriye eklediğiniz varlıkları filtreleyin</span>
              </div>
              <button
                type="button"
                onClick={() => setWatchlistOnly(!watchlistOnly)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  watchlistOnly ? 'bg-accent' : 'bg-bg-tertiary border border-border'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white transition-transform block shadow-sm ${
                    watchlistOnly ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedSector('ALL');
                  setStockSortBy('marketCap');
                  setStockSortOrder('desc');
                  resetFundFilters();
                }}
                className="flex-1"
              >
                Sıfırla
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowFilterSheet(false)}
                className="flex-1"
              >
                Uygula
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function PiyasalarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-fade-in p-4">
          <div className="h-10 w-48 bg-bg-secondary rounded-xl animate-pulse" />
          <div className="h-12 w-full bg-bg-secondary rounded-2xl animate-pulse" />
          <TableSkeleton rows={10} cols={5} />
        </div>
      }
    >
      <PiyasalarContent />
    </Suspense>
  );
}
