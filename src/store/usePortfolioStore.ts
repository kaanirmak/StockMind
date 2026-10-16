'use client';

import { create } from 'zustand';
import { Portfolio, Transaction, PortfolioSummary, CashMovement } from '@/types/portfolio';
import { calculatePortfolioSummary, normalizeSymbolKey, cleanSymbol, PriceQuote } from '@/lib/portfolio/calculations';
import { calculateCashLedger, includeCashInSummary } from '@/lib/portfolio/cash';
import { createClient } from '@/lib/supabase/client';

interface PortfolioState {
  portfolios: Portfolio[];
  activePortfolioId: string;
  transactions: Transaction[];
  cashMovements: CashMovement[];
  cashError: string | null;
  addCashMovement: (movement: Omit<CashMovement, 'id' | 'createdAt' | 'userId'>) => Promise<boolean>;
  deleteCashMovement: (id: string) => Promise<boolean>;
  livePrices: Record<string, PriceQuote>;
  isRefreshingPrices: boolean;
  loading: boolean;
  error: string | null;
  currentUserId: string | null;
  fetchPortfoliosAndTransactions: () => Promise<void>;
  fetchLivePrices: () => Promise<void>;
  setActivePortfolioId: (id: string) => void;
  addPortfolio: (name: string, description?: string) => Promise<Portfolio | null>;
  deletePortfolio: (id: string) => Promise<boolean>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => Promise<Transaction | null>;
  addBatchTransactions: (txList: Omit<Transaction, 'id' | 'createdAt' | 'userId'>[]) => Promise<Transaction[]>;
  replacePortfolioTransactions: (portfolioId: string, txList: Omit<Transaction, 'id' | 'createdAt' | 'userId'>[]) => Promise<Transaction[] | null>;
  deleteTransaction: (id: string) => Promise<boolean>;
  clearPortfolioTransactions: (portfolioId: string) => Promise<boolean>;
  resetStore: () => void;
  getSummary: () => PortfolioSummary;
}

const INITIAL_PORTFOLIOS: Portfolio[] = [
  {
    id: 'p-default',
    userId: 'guest',
    name: 'Ana Portföy',
    description: 'Borsa ve fon yatırımlarım',
    currency: 'TRY',
    isDefault: true,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
];

function getLocalStorageKey(userId?: string | null): string {
  if (userId && userId !== 'guest') {
    return `stockmind_portfolio_state_user_${userId}`;
  }
  return 'stockmind_portfolio_state_guest';
}

function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function parseTransactionFromDb(t: any): Transaction {
  const { symbol, assetType, exchange } = cleanSymbol(t.symbol);
  const effectiveEx = exchange || t.exchange || (assetType === 'fund' ? 'TEFAS' : 'BIST');

  let currency = t.currency;
  let exchangeRate = t.exchange_rate != null ? Number(t.exchange_rate) : undefined;
  let cleanNotes = t.notes || undefined;

  // Extract from notes if encoded via fallback
  if (t.notes && typeof t.notes === 'string' && t.notes.includes('[CCY:')) {
    const match = t.notes.match(/\[CCY:([A-Z]+)(?:\|FX:([0-9.]+))?\]/);
    if (match) {
      if (!currency || currency === 'TRY') {
        currency = match[1];
      }
      if (!exchangeRate && match[2]) {
        exchangeRate = Number(match[2]);
      }
      cleanNotes = t.notes.replace(/\[CCY:[^\]]+\]/, '').trim() || undefined;
    }
  }

  const isUsd = (currency || '').toUpperCase() === 'USD' || effectiveEx === 'NASDAQ' || effectiveEx === 'NYSE';
  if (isUsd && !currency) {
    currency = 'USD';
  }

  return {
    id: t.id,
    portfolioId: t.portfolio_id,
    userId: t.user_id,
    symbol,
    assetType: t.asset_type === 'fund' || assetType === 'fund' ? 'fund' : 'stock',
    currency: isUsd ? 'USD' : currency || 'TRY',
    exchangeRate,
    transactionType: t.transaction_type,
    quantity: Number(t.quantity),
    price: Number(t.price),
    commission: Number(t.commission || 0),
    transactionDate: t.transaction_date,
    exchange: effectiveEx,
    notes: cleanNotes,
    createdAt: t.created_at,
  };
}

function loadLocalState(userId?: string | null): { portfolios: Portfolio[]; activePortfolioId: string; transactions: Transaction[] } {
  if (typeof window === 'undefined') {
    return { portfolios: INITIAL_PORTFOLIOS, activePortfolioId: 'p-default', transactions: [] };
  }
  try {
    const key = getLocalStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawTxs = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      const normalizedTxs: Transaction[] = rawTxs.map((t: any) => {
        const { symbol, assetType, exchange } = cleanSymbol(t.symbol);
        const effectiveEx = exchange || t.exchange || (assetType === 'fund' ? 'TEFAS' : 'BIST');
        const isUsd = (t.currency || '').toUpperCase() === 'USD' || effectiveEx === 'NASDAQ' || effectiveEx === 'NYSE';
        return {
          ...t,
          symbol,
          assetType: t.assetType === 'fund' || assetType === 'fund' ? 'fund' : 'stock',
          currency: isUsd ? 'USD' : t.currency || 'TRY',
          exchangeRate: t.exchangeRate != null ? Number(t.exchangeRate) : undefined,
          exchange: effectiveEx,
        };
      });

      const rawPortfolios = Array.isArray(parsed.portfolios) && parsed.portfolios.length > 0 ? parsed.portfolios : (userId ? [] : INITIAL_PORTFOLIOS);
      const activeId = parsed.activePortfolioId && rawPortfolios.some((p: any) => p.id === parsed.activePortfolioId)
        ? parsed.activePortfolioId
        : rawPortfolios[0]?.id || (userId ? '' : 'p-default');

      return {
        portfolios: rawPortfolios,
        activePortfolioId: activeId,
        transactions: normalizedTxs,
      };
    }
  } catch (e) {
    console.warn('Failed to load local portfolio state:', e);
  }
  return {
    portfolios: userId ? [] : INITIAL_PORTFOLIOS,
    activePortfolioId: userId ? '' : 'p-default',
    transactions: [],
  };
}

function saveLocalState(userId: string | null | undefined, state: { portfolios: Portfolio[]; activePortfolioId: string; transactions: Transaction[] }) {
  if (typeof window === 'undefined') return;
  try {
    const key = getLocalStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save local portfolio state:', e);
  }
}

function loadGuestCash(): CashMovement[] {
  try { const rows = JSON.parse(localStorage.getItem('stockmind_cash_guest') || '[]'); return Array.isArray(rows) ? rows : []; } catch { return []; }
}
function saveGuestCash(rows: CashMovement[]) {
  try { localStorage.setItem('stockmind_cash_guest', JSON.stringify(rows)); } catch { /* Private browsing may disable storage. */ }
}

async function ensurePortfolioInSupabase(supabase: any, user: any, portfolio: Portfolio): Promise<string> {
  try {
    if (isUuid(portfolio.id)) {
      const { data } = await supabase.from('portfolios').select('id').eq('id', portfolio.id).eq('user_id', user.id).maybeSingle();
      if (data?.id) return data.id;
    }

    // Try finding by name for this specific user
    const { data: byName } = await supabase
      .from('portfolios')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', portfolio.name)
      .maybeSingle();

    if (byName?.id) return byName.id;

    // Create new portfolio in DB for this user
    const { data: created, error } = await supabase
      .from('portfolios')
      .insert({
        user_id: user.id,
        name: portfolio.name,
        description: portfolio.description || null,
        currency: portfolio.currency || 'TRY',
        is_default: portfolio.isDefault || false,
      })
      .select()
      .single();

    if (!error && created?.id) {
      return created.id;
    }
  } catch (err) {
    console.warn('ensurePortfolioInSupabase error:', err);
  }
  return portfolio.id;
}

async function insertSingleTransactionSupabase(
  supabase: any,
  user: any,
  portfolioId: string,
  tx: Omit<Transaction, 'id' | 'createdAt' | 'userId'>
): Promise<Transaction | null> {
  try {
    // Attempt 1: Full insert with all columns
    const fullPayload = {
      portfolio_id: portfolioId,
      user_id: user.id,
      symbol: tx.symbol.toUpperCase(),
      asset_type: tx.assetType,
      transaction_type: tx.transactionType,
      quantity: tx.quantity,
      price: tx.price,
      commission: tx.commission || 0,
      currency: tx.currency || 'TRY',
      exchange_rate: tx.exchangeRate || null,
      transaction_date: tx.transactionDate,
      exchange: tx.exchange || null,
      notes: tx.notes || null,
    };

    const { data, error } = await supabase.from('transactions').insert(fullPayload).select().single();
    if (!error && data) {
      return parseTransactionFromDb(data);
    }

    if (error) {
      console.error('insertSingleTransactionSupabase error:', error.message || error);
    }
    return null;
  } catch (e) {
    console.error('insertSingleTransactionSupabase error:', e);
    return null;
  }
}

async function insertBatchTransactionsSupabase(
  supabase: any,
  user: any,
  portfolioId: string,
  txList: Omit<Transaction, 'id' | 'createdAt' | 'userId'>[]
): Promise<Transaction[] | null> {
  if (!isUuid(portfolioId)) {
    console.warn('insertBatchTransactionsSupabase: portfolioId is not a valid UUID:', portfolioId);
    return null;
  }

  try {
    // Attempt 1: Full insert with currency & exchange_rate
    const fullRows = txList.map((tx) => {
      const { symbol, assetType, exchange } = cleanSymbol(tx.symbol);
      const isUsd = (tx.currency || '').toUpperCase() === 'USD' || exchange === 'NASDAQ' || exchange === 'NYSE';
      return {
        portfolio_id: portfolioId,
        user_id: user.id,
        symbol: (symbol || tx.symbol).toUpperCase().trim(),
        asset_type: (tx.assetType === 'fund' || assetType === 'fund') ? 'fund' : 'stock',
        transaction_type: tx.transactionType === 'sell' ? 'sell' : 'buy',
        quantity: Math.max(0.0001, Number(tx.quantity) || 1),
        price: Math.max(0, Number(tx.price) || 0),
        currency: isUsd ? 'USD' : (tx.currency || 'TRY').toUpperCase(),
        exchange_rate: tx.exchangeRate ? Number(tx.exchangeRate) : null,
        commission: Math.max(0, Number(tx.commission) || 0),
        transaction_date: tx.transactionDate || new Date().toISOString().split('T')[0],
        exchange: exchange || tx.exchange || null,
        notes: tx.notes || null,
      };
    });

    const { data, error } = await supabase.from('transactions').insert(fullRows).select();
    if (!error && data && data.length > 0) {
      return data.map((d: any, idx: number) => {
        const parsed = parseTransactionFromDb(d);
        if (!parsed.currency && txList[idx]?.currency) parsed.currency = txList[idx].currency;
        if (!parsed.exchangeRate && txList[idx]?.exchangeRate) parsed.exchangeRate = txList[idx].exchangeRate;
        return parsed;
      });
    }

    if (error) {
      console.error('insertBatchTransactionsSupabase error:', error.message || error);
    }

    return null;
  } catch (e) {
    console.error('insertBatchTransactionsSupabase error:', e);
    return null;
  }
}

export const usePortfolioStore = create<PortfolioState>((set, get) => {
  let fetchGeneration = 0;
  return {
    portfolios: INITIAL_PORTFOLIOS,
    activePortfolioId: 'p-default',
    transactions: [],
    cashMovements: [],
    cashError: null,
    livePrices: {},
    isRefreshingPrices: false,
    loading: false,
    error: null,
    currentUserId: null,

    resetStore: () => {
      fetchGeneration++;
      const local = loadLocalState(null);
      set({
        portfolios: local.portfolios,
        activePortfolioId: local.activePortfolioId,
        transactions: local.transactions,
        cashMovements: loadGuestCash(),
        cashError: null,
        currentUserId: null,
        error: null,
      });
    },

    setActivePortfolioId: (id) => {
      const { currentUserId } = get();
      set({ activePortfolioId: id });
      saveLocalState(currentUserId, {
        portfolios: get().portfolios,
        activePortfolioId: id,
        transactions: get().transactions,
      });
    },

    fetchLivePrices: async () => {
      const { transactions, cashMovements } = get();
      if (!transactions.length && !cashMovements.length) return;

      const assetMap = new Map<string, { symbol: string; rawSymbol: string; assetType: 'stock' | 'fund' }>();
      for (const t of transactions) {
        const { symbol: cleanSym, assetType: cleanType } = cleanSymbol(t.symbol);
        const effectiveType = t.assetType === 'fund' || cleanType === 'fund' ? 'fund' : 'stock';
        if (cleanSym) {
          assetMap.set(`${effectiveType}_${cleanSym}`, {
            symbol: cleanSym,
            rawSymbol: t.symbol,
            assetType: effectiveType,
          });
        }
      }

      const assets = Array.from(assetMap.values());
      if (assets.length === 0 && !cashMovements.length) return;

      set({ isRefreshingPrices: true });

      const newQuotes: Record<string, PriceQuote> = { ...get().livePrices };

      // 1. Fetch live USD/TRY exchange rate
      try {
        const fxRes = await fetch('/api/stocks/USDTRY', { signal: AbortSignal.timeout(15000) });
        if (fxRes.ok) {
          const fxJson = await fxRes.json();
          if (fxJson.success && fxJson.data && fxJson.data.price > 0) {
            const fxQuote: PriceQuote = {
              price: Number(fxJson.data.price),
              changePercent: Number(fxJson.data.changePercent || 0),
            };
            newQuotes['USDTRY'] = fxQuote;
            newQuotes['USD'] = fxQuote;
            newQuotes['USDTRY=X'] = fxQuote;
            set({ livePrices: { ...newQuotes } });
          }
        }
      } catch (e) {
        console.warn('[PortfolioStore] Failed to fetch live USDTRY rate:', e);
      }

      if (cashMovements.some((m) => m.currency === 'EUR')) {
        try { const response = await fetch('/api/stocks/EURTRY', { signal: AbortSignal.timeout(15000) }); const result = await response.json(); if (result.success && result.data?.price > 0) newQuotes['EURTRY'] = { price: Number(result.data.price), changePercent: Number(result.data.changePercent || 0) }; } catch { /* Missing rates are disclosed by the cash ledger. */ }
      }
      await Promise.all(
        assets.map(async ({ symbol, rawSymbol, assetType }) => {
          try {
            const normKey = normalizeSymbolKey(symbol);
            const querySymbol = normKey || symbol;

            if (assetType === 'fund') {
              try {
                const res = await fetch(`/api/funds/${encodeURIComponent(symbol)}`, { signal: AbortSignal.timeout(15000) });
                if (res.ok) {
                  const json = await res.json();
                  if (json.success && json.data && json.data.price > 0) {
                    const quote: PriceQuote = {
                      price: Number(json.data.price),
                      changePercent: Number(json.data.dailyReturn || 0),
                    };
                    newQuotes[symbol] = quote;
                    newQuotes[rawSymbol] = quote;
                    newQuotes[normKey] = quote;
                    newQuotes[`FON:${symbol}`] = quote;
                    newQuotes[`IST:${symbol}`] = quote;
                    set({ livePrices: { ...newQuotes } });
                  }
                }
              } catch (err) {
                console.warn(`[PortfolioStore] Failed to fetch live fund price for ${symbol}:`, err);
              }
              return;
            }

            // Asset is a stock or commodity
            try {
              const res = await fetch(`/api/stocks/${encodeURIComponent(querySymbol)}`, { signal: AbortSignal.timeout(15000) });
              if (res.ok) {
                const json = await res.json();
                if (json.success && json.data && (json.data.price > 0 || json.data.basePrice > 0)) {
                  const p = Number(json.data.price || json.data.basePrice);
                  const quote: PriceQuote = {
                    price: p,
                    changePercent: Number(json.data.changePercent || 0),
                  };
                  newQuotes[symbol] = quote;
                  newQuotes[rawSymbol] = quote;
                  newQuotes[normKey] = quote;
                  newQuotes[`FON:${symbol}`] = quote;
                  newQuotes[`IST:${symbol}`] = quote;
                    set({ livePrices: { ...newQuotes } });
                  return;
                }
              }
            } catch (err) {
              console.warn(`[PortfolioStore] Failed to fetch live stock price for ${querySymbol}:`, err);
            }

            // Fallback for 3-letter codes that might be TEFAS funds
            if (symbol.length === 3) {
              try {
                const fundRes = await fetch(`/api/funds/${encodeURIComponent(symbol)}`, { signal: AbortSignal.timeout(15000) });
                if (fundRes.ok) {
                  const fundJson = await fundRes.json();
                  if (fundJson.success && fundJson.data && fundJson.data.price > 0) {
                    const quote: PriceQuote = {
                      price: Number(fundJson.data.price),
                      changePercent: Number(fundJson.data.dailyReturn || 0),
                    };
                    newQuotes[symbol] = quote;
                    newQuotes[rawSymbol] = quote;
                    newQuotes[normKey] = quote;
                    newQuotes[`FON:${symbol}`] = quote;
                    newQuotes[`IST:${symbol}`] = quote;
                    set({ livePrices: { ...newQuotes } });
                  }
                }
              } catch (err) {
                // ignore
              }
            }
          } catch (e) {
            console.warn(`[PortfolioStore] Failed to fetch live price for ${symbol}:`, e);
          }
        })
      );

      set({ livePrices: newQuotes, isRefreshingPrices: false });
    },

    fetchPortfoliosAndTransactions: async () => {
      const generation = ++fetchGeneration;
      set({ loading: true, error: null });
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (generation !== fetchGeneration) return;

        if (!user) {
          // Guest mode: load strictly from guest storage
          const local = loadLocalState(null);
          const activeId = local.activePortfolioId || 'p-default';
          const guestTxs = local.transactions.map((t) => ({
            ...t,
            portfolioId: t.portfolioId || activeId,
          }));
          set({
            portfolios: local.portfolios.length > 0 ? local.portfolios : INITIAL_PORTFOLIOS,
            activePortfolioId: activeId,
            transactions: guestTxs,
            cashMovements: loadGuestCash(),
            cashError: null,
            currentUserId: null,
            loading: false,
          });
          get().fetchLivePrices();
          return;
        }

        if (get().currentUserId !== user.id) set({ cashMovements: [], cashError: null });
        // Authenticated user mode
        const local = loadLocalState(user.id);

        // 1. Fetch user's portfolios from Supabase DB
        let { data: dbPortfolios, error: portError } = await supabase
          .from('portfolios')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (generation !== fetchGeneration) return;
        if (portError) {
          console.warn('Failed to fetch DB portfolios, falling back to user local state:', portError);
          set({
            portfolios: local.portfolios.length > 0 ? local.portfolios : INITIAL_PORTFOLIOS,
            activePortfolioId: local.activePortfolioId || 'p-default',
            transactions: local.transactions,
            currentUserId: user.id,
            loading: false,
          });
          get().fetchLivePrices();
          return;
        }

        // If no portfolio exists in Supabase for user, create initial 'Ana Portföy' in DB
        if (!dbPortfolios || dbPortfolios.length === 0) {
          const { data: newPort } = await supabase
            .from('portfolios')
            .insert({
              user_id: user.id,
              name: 'Ana Portföy',
              description: 'Borsa ve fon yatırımlarım',
              currency: 'TRY',
              is_default: true,
            })
            .select()
            .single();

          if (newPort) {
            dbPortfolios = [newPort];
          }
        }

        const mappedPortfolios: Portfolio[] = (dbPortfolios || []).map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          name: p.name,
          description: p.description,
          currency: p.currency || 'TRY',
          isDefault: p.is_default || false,
          createdAt: p.created_at,
        }));

        // 2. Fetch user's transactions from Supabase DB
        const { data: dbTransactions, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: true })
          .order('created_at', { ascending: true });

        if (txError) {
          console.warn('Failed to fetch DB transactions:', txError);
        }

        const mappedTransactions: Transaction[] = (dbTransactions || []).map(parseTransactionFromDb);
        const cashResult = await supabase.from('cash_movements').select('*').eq('user_id', user.id).order('movement_date', { ascending: true });
        const mappedCash: CashMovement[] = (cashResult.data || []).map((row) => ({ id: row.id, userId: row.user_id, portfolioId: row.portfolio_id, movementType: row.movement_type, amount: Number(row.amount), currency: row.currency, exchangeRate: Number(row.exchange_rate), movementDate: row.movement_date, notes: row.notes || '', createdAt: row.created_at }));

        // Determine valid activePortfolioId for this user
        const currentActive = get().activePortfolioId;
        let validActiveId = currentActive;

        if (!mappedPortfolios.some((p) => p.id === validActiveId)) {
          validActiveId = local.activePortfolioId;
          if (!mappedPortfolios.some((p) => p.id === validActiveId)) {
            validActiveId = mappedPortfolios[0]?.id || 'p-default';
          }
        }

        // Safety check: If Supabase returned 0 transactions, but local storage HAS transactions:
        // DO NOT obliterate local transactions! Preserve them and trigger sync to Supabase.
        let effectiveTransactions = mappedTransactions;
        if (mappedTransactions.length === 0 && local.transactions && local.transactions.length > 0) {
          console.info('[PortfolioStore] Supabase returned 0 transactions, preserving local transactions & syncing...');
          effectiveTransactions = local.transactions;
          if (validActiveId && isUuid(validActiveId)) {
            insertBatchTransactionsSupabase(
              supabase,
              user,
              validActiveId,
              local.transactions.map((t) => ({ ...t, portfolioId: validActiveId }))
            ).catch((err) => console.warn('Background sync to Supabase failed:', err));
          }
        }

        // Check if effectiveTransactions are all under a specific portfolioId
        // If current validActiveId has NO transactions, but another portfolio in mappedPortfolios DOES,
        // switch to that portfolio!
        const portWithTxs = mappedPortfolios.find((p) => effectiveTransactions.some((t) => t.portfolioId === p.id));
        if (portWithTxs && !effectiveTransactions.some((t) => t.portfolioId === validActiveId)) {
          validActiveId = portWithTxs.id;
        }

        // If transactions exist with 'p-default' or missing portfolioId, re-tag them to validActiveId.
        // Filter out orphaned transactions that belong to deleted/unknown portfolios instead of merging them!
        const validPortfolioIds = new Set(mappedPortfolios.map((p) => p.id));
        if (effectiveTransactions.length > 0 && validActiveId) {
          effectiveTransactions = effectiveTransactions
            .map((t) => {
              if ((!t.portfolioId || t.portfolioId === 'p-default') && validActiveId) {
                return { ...t, portfolioId: validActiveId };
              }
              return t;
            })
            .filter((t) => validPortfolioIds.has(t.portfolioId));
        }

        if (generation !== fetchGeneration) return;
        set({
          portfolios: mappedPortfolios.length > 0 ? mappedPortfolios : INITIAL_PORTFOLIOS,
          activePortfolioId: validActiveId,
          transactions: effectiveTransactions,
          cashMovements: cashResult.error ? get().cashMovements : mappedCash,
          cashError: cashResult.error ? 'Nakit hareketleri yüklenemedi. Lütfen tekrar deneyin.' : null,
          currentUserId: user.id,
          loading: false,
        });

        get().fetchLivePrices();

        saveLocalState(user.id, {
          portfolios: mappedPortfolios.length > 0 ? mappedPortfolios : INITIAL_PORTFOLIOS,
          activePortfolioId: validActiveId,
          transactions: effectiveTransactions,
        });
      } catch (err: any) {
        console.error('Error in fetchPortfoliosAndTransactions:', err);
        set({
          error: err.message,
          loading: false,
        });
      }
    },

    addPortfolio: async (name, description) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        let newPort: Portfolio;

        if (user) {
          const { data, error } = await supabase
            .from('portfolios')
            .insert({
              user_id: user.id,
              name: name.trim(),
              description: description?.trim() || null,
              currency: 'TRY',
              is_default: false,
            })
            .select()
            .single();

          if (!error && data) {
            newPort = {
              id: data.id,
              userId: data.user_id,
              name: data.name,
              description: data.description,
              currency: data.currency || 'TRY',
              isDefault: data.is_default || false,
              createdAt: data.created_at,
            };
          } else {
            console.warn('Supabase portfolio insert fallback:', error);
            newPort = {
              id: `p-${Date.now()}`,
              userId: user.id,
              name: name.trim(),
              description: description?.trim() || null,
              currency: 'TRY',
              isDefault: false,
              createdAt: new Date().toISOString(),
            };
          }
        } else {
          newPort = {
            id: `p-${Date.now()}`,
            userId: 'guest',
            name: name.trim(),
            description: description?.trim() || null,
            currency: 'TRY',
            isDefault: false,
            createdAt: new Date().toISOString(),
          };
        }

        set((state) => {
          const updatedPortfolios = [...state.portfolios, newPort];
          saveLocalState(user?.id, {
            portfolios: updatedPortfolios,
            activePortfolioId: newPort.id,
            transactions: state.transactions,
          });
          return {
            portfolios: updatedPortfolios,
            activePortfolioId: newPort.id,
          };
        });

        return newPort;
      } catch (e: any) {
        console.error('addPortfolio error:', e);
        return null;
      }
    },

    deletePortfolio: async (id) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (user) {
          if (isUuid(id)) {
            const { error: txErr } = await supabase.from('transactions').delete().eq('portfolio_id', id).eq('user_id', user.id);
            if (txErr) {
              console.error('deletePortfolio transactions error:', txErr);
              set({ error: 'Portföy işlemleri silinemedi: ' + txErr.message });
              return false;
            }
            const { error: portErr } = await supabase.from('portfolios').delete().eq('id', id).eq('user_id', user.id);
            if (portErr) {
              console.error('deletePortfolio error:', portErr);
              set({ error: 'Portföy silinemedi: ' + portErr.message });
              return false;
            }
          } else {
            const port = get().portfolios.find((p) => p.id === id);
            if (port) {
              const { data: dbP } = await supabase
                .from('portfolios')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', port.name)
                .maybeSingle();
              if (dbP?.id) {
                const { error: txErr } = await supabase.from('transactions').delete().eq('portfolio_id', dbP.id).eq('user_id', user.id);
                if (txErr) {
                  console.error('deletePortfolio transactions error:', txErr);
                  set({ error: 'Portföy işlemleri silinemedi: ' + txErr.message });
                  return false;
                }
                const { error: portErr } = await supabase.from('portfolios').delete().eq('id', dbP.id).eq('user_id', user.id);
                if (portErr) {
                  console.error('deletePortfolio error:', portErr);
                  set({ error: 'Portföy silinemedi: ' + portErr.message });
                  return false;
                }
              }
            }
          }
        }

        set((state) => {
          let updatedPortfolios = state.portfolios.filter((p) => p.id !== id);
          if (updatedPortfolios.length === 0) {
            updatedPortfolios = [
              {
                id: 'p-default',
                userId: user?.id || 'guest',
                name: 'Ana Portföy',
                description: 'Borsa ve fon yatırımlarım',
                currency: 'TRY',
                isDefault: true,
                createdAt: '2025-01-01T00:00:00.000Z',
              },
            ];
          }

          const updatedTransactions = state.transactions.filter((t) => t.portfolioId !== id);

          let newActiveId = state.activePortfolioId;
          if (newActiveId === id || !updatedPortfolios.some((p) => p.id === newActiveId)) {
            newActiveId = updatedPortfolios[0].id;
          }

          saveLocalState(user?.id, {
            portfolios: updatedPortfolios,
            activePortfolioId: newActiveId,
            transactions: updatedTransactions,
          });

          return {
            portfolios: updatedPortfolios,
            activePortfolioId: newActiveId,
            transactions: updatedTransactions,
          };
        });

        get().fetchLivePrices();
        return true;
      } catch (e: any) {
        console.error('deletePortfolio error:', e);
        return false;
      }
    },

    addTransaction: async (tx) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        const currentPortfolios = get().portfolios;
        const targetPortfolioId = tx.portfolioId || get().activePortfolioId;
        let targetPort = currentPortfolios.find((p) => p.id === targetPortfolioId) || currentPortfolios[0];

        if (user && targetPort) {
          const realPortfolioId = await ensurePortfolioInSupabase(supabase, user, targetPort);

          if (realPortfolioId !== targetPort.id) {
            set((state) => {
              const updatedPorts = state.portfolios.map((p) => (p.id === targetPort.id ? { ...p, id: realPortfolioId } : p));
              const updatedTxs = state.transactions.map((t) => (t.portfolioId === targetPort.id ? { ...t, portfolioId: realPortfolioId } : t));
              const newActiveId = state.activePortfolioId === targetPort.id ? realPortfolioId : state.activePortfolioId;
              return {
                portfolios: updatedPorts,
                transactions: updatedTxs,
                activePortfolioId: newActiveId,
              };
            });
            targetPort = { ...targetPort, id: realPortfolioId };
          }

          const insertedDbTx = await insertSingleTransactionSupabase(supabase, user, targetPort.id, {
            ...tx,
            portfolioId: targetPort.id,
          });

          if (insertedDbTx) {
            set((state) => {
              const updated = [insertedDbTx, ...state.transactions];
              saveLocalState(user.id, {
                portfolios: state.portfolios,
                activePortfolioId: state.activePortfolioId,
                transactions: updated,
              });
              return { transactions: updated, error: null };
            });
            get().fetchLivePrices();
            return insertedDbTx;
          } else {
            console.error('addTransaction: Supabase insert failed');
            set({ error: 'İşlem sunucuya kaydedilemedi. Lütfen bağlantınızı kontrol edin.' });
            return null;
          }
        }

        // Guest mode only (never used as fallback for authenticated users)
        const fallbackTx: Transaction = {
          ...tx,
          id: `tx-${Date.now()}`,
          portfolioId: targetPort?.id || targetPortfolioId || 'p-default',
          userId: 'guest',
          currency: tx.currency || 'TRY',
          exchangeRate: tx.exchangeRate,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          const updated = [fallbackTx, ...state.transactions];
          saveLocalState('guest', {
            portfolios: state.portfolios,
            activePortfolioId: state.activePortfolioId,
            transactions: updated,
          });
          return { transactions: updated };
        });

        get().fetchLivePrices();
        return fallbackTx;
      } catch (e: any) {
        console.error('addTransaction error:', e);
        set({ error: e.message || 'İşlem eklenirken hata oluştu.' });
        return null;
      }
    },

    addBatchTransactions: async (txList) => {
      if (!txList || txList.length === 0) return [];
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        const currentPortfolios = get().portfolios;
        const targetPortfolioId = txList[0]?.portfolioId || get().activePortfolioId;
        let targetPort = currentPortfolios.find((p) => p.id === targetPortfolioId) || currentPortfolios[0];

        if (user && targetPort) {
          const realPortfolioId = await ensurePortfolioInSupabase(supabase, user, targetPort);

          if (realPortfolioId !== targetPort.id) {
            set((state) => {
              const updatedPorts = state.portfolios.map((p) => (p.id === targetPort.id ? { ...p, id: realPortfolioId } : p));
              const updatedTxs = state.transactions.map((t) => (t.portfolioId === targetPort.id ? { ...t, portfolioId: realPortfolioId } : t));
              const newActiveId = state.activePortfolioId === targetPort.id ? realPortfolioId : state.activePortfolioId;
              return {
                portfolios: updatedPorts,
                transactions: updatedTxs,
                activePortfolioId: newActiveId,
              };
            });
            targetPort = { ...targetPort, id: realPortfolioId };
          }

          const insertedList = await insertBatchTransactionsSupabase(
            supabase,
            user,
            targetPort.id,
            txList.map((t) => ({ ...t, portfolioId: targetPort.id }))
          );

          if (insertedList && insertedList.length > 0) {
            set((state) => {
              // Preserve existing transactions and prepend newly inserted ones
              const insertedIds = new Set(insertedList.map((t) => t.id));
              const existingTxs = state.transactions.filter((t) => !insertedIds.has(t.id));
              const updated = [...insertedList, ...existingTxs];
              saveLocalState(user.id, {
                portfolios: state.portfolios,
                activePortfolioId: targetPort.id,
                transactions: updated,
              });
              return { transactions: updated, activePortfolioId: targetPort.id, error: null };
            });
            get().fetchLivePrices();
            return insertedList;
          } else {
            console.error('addBatchTransactions: Supabase batch insert failed');
            set({ error: 'İşlemler sunucuya kaydedilemedi.' });
            return [];
          }
        }

        // Guest mode batch insert
        const fallbackTxs: Transaction[] = txList.map((tx, idx) => ({
          ...tx,
          id: `tx-${Date.now()}-${idx}`,
          portfolioId: targetPort?.id || targetPortfolioId || 'p-default',
          userId: 'guest',
          currency: tx.currency || 'TRY',
          exchangeRate: tx.exchangeRate,
          createdAt: new Date().toISOString(),
        }));

        set((state) => {
          const updated = [...fallbackTxs, ...state.transactions];
          saveLocalState('guest', {
            portfolios: state.portfolios,
            activePortfolioId: targetPort?.id || targetPortfolioId || 'p-default',
            transactions: updated,
          });
          return { transactions: updated, activePortfolioId: targetPort?.id || targetPortfolioId || 'p-default' };
        });

        get().fetchLivePrices();
        return fallbackTxs;
      } catch (e: any) {
        console.error('addBatchTransactions error:', e);
        set({ error: e.message || 'İşlemler eklenirken hata oluştu.' });
        return [];
      }
    },

    replacePortfolioTransactions: async (portfolioId, txList) => {
      if (!txList || txList.length === 0) return [];
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        const currentPortfolios = get().portfolios;
        let targetPort = currentPortfolios.find((p) => p.id === portfolioId) || currentPortfolios[0];

        if (user && targetPort) {
          const realPortfolioId = await ensurePortfolioInSupabase(supabase, user, targetPort);
          const currentTxs = get().transactions;
          const backupTxs = currentTxs.filter((t) => t.portfolioId === realPortfolioId || t.portfolioId === targetPort.id);

          // Delete existing transactions for this portfolio
          const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .eq('portfolio_id', realPortfolioId)
            .eq('user_id', user.id);

          if (deleteError) {
            console.error('replacePortfolioTransactions delete error:', deleteError);
            set({ error: 'Mevcut işlemler silinirken hata oluştu, işlem iptal edildi.' });
            return null;
          }

          const insertedList = await insertBatchTransactionsSupabase(
            supabase,
            user,
            realPortfolioId,
            txList.map((t) => ({ ...t, portfolioId: realPortfolioId }))
          );

          if (!insertedList || insertedList.length === 0) {
            // Rollback: restore previous transactions to prevent data loss!
            console.warn('replacePortfolioTransactions failed insert, rolling back...');
            if (backupTxs.length > 0) {
              await insertBatchTransactionsSupabase(
                supabase,
                user,
                realPortfolioId,
                backupTxs.map((t) => ({
                  symbol: t.symbol,
                  assetType: t.assetType,
                  transactionType: t.transactionType,
                  quantity: t.quantity,
                  price: t.price,
                  currency: t.currency,
                  exchangeRate: t.exchangeRate,
                  commission: t.commission,
                  transactionDate: t.transactionDate,
                  exchange: t.exchange,
                  notes: t.notes,
                  portfolioId: realPortfolioId,
                }))
              );
            }
            set({ error: 'Yeni işlemler kaydedilemedi. Eski kayıtlarınız korundu.' });
            return null;
          }

          set((state) => {
            const otherPortTxs = state.transactions.filter((t) => t.portfolioId !== realPortfolioId && t.portfolioId !== targetPort.id);
            const updated = [...insertedList, ...otherPortTxs];
            saveLocalState(user.id, {
              portfolios: state.portfolios,
              activePortfolioId: realPortfolioId,
              transactions: updated,
            });
            return { transactions: updated, activePortfolioId: realPortfolioId, error: null };
          });

          get().fetchLivePrices();
          return insertedList;
        }

        // Guest mode replace
        const fallbackTxs: Transaction[] = txList.map((tx, idx) => ({
          ...tx,
          id: `tx-${Date.now()}-${idx}`,
          portfolioId: targetPort?.id || portfolioId || 'p-default',
          userId: 'guest',
          currency: tx.currency || 'TRY',
          exchangeRate: tx.exchangeRate,
          createdAt: new Date().toISOString(),
        }));

        set((state) => {
          const otherPortTxs = state.transactions.filter((t) => t.portfolioId !== (targetPort?.id || portfolioId || 'p-default'));
          const updated = [...fallbackTxs, ...otherPortTxs];
          saveLocalState('guest', {
            portfolios: state.portfolios,
            activePortfolioId: targetPort?.id || portfolioId || 'p-default',
            transactions: updated,
          });
          return { transactions: updated, activePortfolioId: targetPort?.id || portfolioId || 'p-default' };
        });

        get().fetchLivePrices();
        return fallbackTxs;
      } catch (e: any) {
        console.error('replacePortfolioTransactions error:', e);
        set({ error: e.message || 'İşlemler güncellenemedi.' });
        return null;
      }
    },

    deleteTransaction: async (id) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (user && isUuid(id)) {
          const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
          if (error) {
            console.error('deleteTransaction Supabase error:', error);
            set({ error: 'İşlem silinemedi: ' + error.message });
            return false;
          }
        }

        set((state) => {
          const updated = state.transactions.filter((t) => t.id !== id);
          saveLocalState(user?.id, {
            portfolios: state.portfolios,
            activePortfolioId: state.activePortfolioId,
            transactions: updated,
          });
          return { transactions: updated };
        });

        get().fetchLivePrices();
        return true;
      } catch (e: any) {
        console.error('deleteTransaction error:', e);
        return false;
      }
    },

    clearPortfolioTransactions: async (portfolioId) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        let dbPortId = portfolioId;
        if (user) {
          if (!isUuid(portfolioId)) {
            const port = get().portfolios.find((p) => p.id === portfolioId) || get().portfolios[0];
            if (port) {
              dbPortId = await ensurePortfolioInSupabase(supabase, user, port);
            }
          }
          if (isUuid(dbPortId)) {
            const { error } = await supabase.from('transactions').delete().eq('portfolio_id', dbPortId).eq('user_id', user.id);
            if (error) {
              console.error('clearPortfolioTransactions Supabase error:', error);
              set({ error: 'İşlemler silinemedi: ' + error.message });
              return false;
            }
          }
        }

        set((state) => {
          const updated = state.transactions.filter((t) => t.portfolioId !== portfolioId && t.portfolioId !== dbPortId);
          saveLocalState(user?.id, {
            portfolios: state.portfolios,
            activePortfolioId: state.activePortfolioId,
            transactions: updated,
          });
          return { transactions: updated };
        });

        get().fetchLivePrices();
        return true;
      } catch (e: any) {
        console.error('clearPortfolioTransactions error:', e);
        return false;
      }
    },

    addCashMovement: async (movement) => {
      if (!Number.isFinite(movement.amount) || movement.amount <= 0 || movement.amount >= 1e12 || !['TRY', 'USD', 'EUR'].includes(movement.currency) || !Number.isFinite(movement.exchangeRate) || movement.exchangeRate <= 0 || movement.exchangeRate >= 1e6 || !/^\d{4}-\d{2}-\d{2}$/.test(movement.movementDate) || !Number.isFinite(Date.parse(movement.movementDate)) || new Date(movement.movementDate).toISOString().slice(0, 10) !== movement.movementDate || !['deposit', 'withdrawal'].includes(movement.movementType) || movement.movementDate > new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()) || (movement.currency === 'TRY' && movement.exchangeRate !== 1)) return false;
      try {
        const client = createClient();
        const { data: { user } } = await client.auth.getUser();
        const owner = user?.id || null;
        const portfolio = get().portfolios.find((p) => p.id === movement.portfolioId);
        if (!portfolio) return false;
        if (movement.movementType === 'withdrawal') {
          const ledger = calculateCashLedger(get().transactions.filter((t) => t.portfolioId === movement.portfolioId), get().cashMovements.filter((m) => m.portfolioId === movement.portfolioId), get().livePrices);
          const available = ledger.balances.find((row) => row.currency === movement.currency)?.amount || 0;
          if (movement.amount > available + 0.000001) { set({ cashError: 'Yeterli nakit bakiyesi bulunmuyor.' }); return false; }
        }
        let item: CashMovement;
        if (user) {
          const portfolioId = await ensurePortfolioInSupabase(client, user, portfolio);
          const { data, error } = await client.from('cash_movements').insert({ user_id: user.id, portfolio_id: portfolioId, movement_type: movement.movementType, amount: movement.amount, currency: movement.currency, exchange_rate: movement.exchangeRate, movement_date: movement.movementDate, notes: (movement.notes || '').slice(0, 500) }).select().single();
          if (error || !data) throw error;
          item = { ...movement, portfolioId, userId: user.id, id: data.id, createdAt: data.created_at };
        } else {
          item = { ...movement, userId: 'guest', id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        }
        if (get().currentUserId !== owner) return true;
        set((state) => { const cashMovements = [...state.cashMovements, item]; if (!user) saveGuestCash(cashMovements); return { cashMovements, cashError: null }; });
        return true;
      } catch { set({ cashError: 'Nakit hareketi kaydedilemedi. Lütfen tekrar deneyin.' }); return false; }
    },
    deleteCashMovement: async (id) => {
      try {
        const client = createClient();
        const { data: { user } } = await client.auth.getUser();
        const owner = user?.id || null;
        if (user) { const { error } = await client.from('cash_movements').delete().eq('id', id).eq('user_id', user.id); if (error) return false; }
        if (get().currentUserId !== owner) return true;
        set((state) => { const cashMovements = state.cashMovements.filter((m) => m.id !== id); if (!user) saveGuestCash(cashMovements); return { cashMovements }; });
        return true;
      } catch { return false; }
    },

    getSummary: () => {
      const { transactions, activePortfolioId, livePrices, portfolios } = get();
      const effectiveActiveId = activePortfolioId || portfolios[0]?.id || 'p-default';
      let filtered = transactions.filter((t) => t.portfolioId === effectiveActiveId);
      if (filtered.length === 0 && transactions.length > 0 && portfolios.length <= 1) {
        filtered = transactions;
      }
      const movements = get().cashMovements.filter((m) => m.portfolioId === effectiveActiveId);
      return includeCashInSummary(calculatePortfolioSummary(filtered, livePrices), calculateCashLedger(filtered, movements, livePrices));
    },
  };
});
