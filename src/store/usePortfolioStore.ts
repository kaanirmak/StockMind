'use client';

import { create } from 'zustand';
import { Portfolio, Transaction, PortfolioSummary } from '@/types/portfolio';
import { calculatePortfolioSummary, normalizeSymbolKey, cleanSymbol, PriceQuote } from '@/lib/portfolio/calculations';
import { createClient } from '@/lib/supabase/client';

interface PortfolioState {
  portfolios: Portfolio[];
  activePortfolioId: string;
  transactions: Transaction[];
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

    // Attempt 2: Fallback with base columns from 001_initial_schema
    const notesMeta =
      tx.currency === 'USD'
        ? tx.notes
          ? `${tx.notes} [CCY:USD${tx.exchangeRate ? `|FX:${tx.exchangeRate}` : ''}]`
          : `[CCY:USD${tx.exchangeRate ? `|FX:${tx.exchangeRate}` : ''}]`
        : tx.notes || null;

    const basePayload = {
      portfolio_id: portfolioId,
      user_id: user.id,
      symbol: tx.symbol.toUpperCase(),
      asset_type: tx.assetType,
      transaction_type: tx.transactionType,
      quantity: tx.quantity,
      price: tx.price,
      commission: tx.commission || 0,
      transaction_date: tx.transactionDate,
      exchange: tx.exchange || null,
      notes: notesMeta,
    };

    const { data: baseData, error: baseError } = await supabase.from('transactions').insert(basePayload).select().single();
    if (!baseError && baseData) {
      const res = parseTransactionFromDb(baseData);
      res.currency = tx.currency || 'TRY';
      res.exchangeRate = tx.exchangeRate;
      return res;
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
  try {
    // Attempt 1: Full insert
    const fullRows = txList.map((tx) => ({
      portfolio_id: portfolioId,
      user_id: user.id,
      symbol: tx.symbol.toUpperCase(),
      asset_type: tx.assetType,
      transaction_type: tx.transactionType,
      quantity: tx.quantity,
      price: tx.price,
      currency: tx.currency || 'TRY',
      exchange_rate: tx.exchangeRate || null,
      commission: tx.commission || 0,
      transaction_date: tx.transactionDate,
      exchange: tx.exchange || null,
      notes: tx.notes || null,
    }));

    const { data, error } = await supabase.from('transactions').insert(fullRows).select();
    if (!error && data && data.length > 0) {
      return data.map((d: any, idx: number) => {
        const parsed = parseTransactionFromDb(d);
        if (!parsed.currency && txList[idx]?.currency) parsed.currency = txList[idx].currency;
        if (!parsed.exchangeRate && txList[idx]?.exchangeRate) parsed.exchangeRate = txList[idx].exchangeRate;
        return parsed;
      });
    }

    // Attempt 2: Fallback with base schema
    const baseRows = txList.map((tx) => {
      const notesMeta =
        tx.currency === 'USD'
          ? tx.notes
            ? `${tx.notes} [CCY:USD${tx.exchangeRate ? `|FX:${tx.exchangeRate}` : ''}]`
            : `[CCY:USD${tx.exchangeRate ? `|FX:${tx.exchangeRate}` : ''}]`
          : tx.notes || null;

      return {
        portfolio_id: portfolioId,
        user_id: user.id,
        symbol: tx.symbol.toUpperCase(),
        asset_type: tx.assetType,
        transaction_type: tx.transactionType,
        quantity: tx.quantity,
        price: tx.price,
        commission: tx.commission || 0,
        transaction_date: tx.transactionDate,
        exchange: tx.exchange || null,
        notes: notesMeta,
      };
    });

    const { data: baseData, error: baseError } = await supabase.from('transactions').insert(baseRows).select();
    if (!baseError && baseData && baseData.length > 0) {
      return baseData.map((d: any, idx: number) => {
        const parsed = parseTransactionFromDb(d);
        parsed.currency = txList[idx]?.currency || 'TRY';
        parsed.exchangeRate = txList[idx]?.exchangeRate;
        return parsed;
      });
    }

    return null;
  } catch (e) {
    console.error('insertBatchTransactionsSupabase error:', e);
    return null;
  }
}

export const usePortfolioStore = create<PortfolioState>((set, get) => {
  return {
    portfolios: INITIAL_PORTFOLIOS,
    activePortfolioId: 'p-default',
    transactions: [],
    livePrices: {},
    isRefreshingPrices: false,
    loading: false,
    error: null,
    currentUserId: null,

    resetStore: () => {
      const local = loadLocalState(null);
      set({
        portfolios: local.portfolios,
        activePortfolioId: local.activePortfolioId,
        transactions: local.transactions,
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
      const { transactions } = get();
      if (!transactions || transactions.length === 0) return;

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
      if (assets.length === 0) return;

      set({ isRefreshingPrices: true });

      const newQuotes: Record<string, PriceQuote> = { ...get().livePrices };

      // 1. Fetch live USD/TRY exchange rate
      try {
        const fxRes = await fetch('/api/stocks/USDTRY');
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
          }
        }
      } catch (e) {
        console.warn('[PortfolioStore] Failed to fetch live USDTRY rate:', e);
      }

      await Promise.all(
        assets.map(async ({ symbol, rawSymbol, assetType }) => {
          try {
            const normKey = normalizeSymbolKey(symbol);
            const querySymbol = normKey || symbol;

            if (assetType === 'fund') {
              try {
                const res = await fetch(`/api/funds/${encodeURIComponent(symbol)}`);
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
                  }
                }
              } catch (err) {
                console.warn(`[PortfolioStore] Failed to fetch live fund price for ${symbol}:`, err);
              }
              return;
            }

            // Asset is a stock or commodity
            try {
              const res = await fetch(`/api/stocks/${encodeURIComponent(querySymbol)}`);
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
                  return;
                }
              }
            } catch (err) {
              console.warn(`[PortfolioStore] Failed to fetch live stock price for ${querySymbol}:`, err);
            }

            // Fallback for 3-letter codes that might be TEFAS funds
            if (symbol.length === 3) {
              try {
                const fundRes = await fetch(`/api/funds/${encodeURIComponent(symbol)}`);
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
      set({ loading: true, error: null });
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!user) {
          // Guest mode: load strictly from guest storage
          const local = loadLocalState(null);
          set({
            portfolios: local.portfolios.length > 0 ? local.portfolios : INITIAL_PORTFOLIOS,
            activePortfolioId: local.activePortfolioId || 'p-default',
            transactions: local.transactions,
            currentUserId: null,
            loading: false,
          });
          get().fetchLivePrices();
          return;
        }

        // Authenticated user mode
        const local = loadLocalState(user.id);

        // 1. Fetch user's portfolios from Supabase DB
        let { data: dbPortfolios, error: portError } = await supabase
          .from('portfolios')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

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

        // 2. Fetch user's transactions from Supabase DB (Authoritative source of truth)
        const { data: dbTransactions, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false });

        if (txError) {
          console.warn('Failed to fetch DB transactions:', txError);
        }

        const mappedTransactions: Transaction[] = (dbTransactions || []).map(parseTransactionFromDb);

        // Determine valid activePortfolioId for this user
        const currentActive = get().activePortfolioId;
        let validActiveId = currentActive;

        if (!mappedPortfolios.some((p) => p.id === validActiveId)) {
          validActiveId = local.activePortfolioId;
          if (!mappedPortfolios.some((p) => p.id === validActiveId)) {
            validActiveId = mappedPortfolios[0]?.id || 'p-default';
          }
        }

        set({
          portfolios: mappedPortfolios.length > 0 ? mappedPortfolios : INITIAL_PORTFOLIOS,
          activePortfolioId: validActiveId,
          transactions: mappedTransactions,
          currentUserId: user.id,
          loading: false,
        });

        get().fetchLivePrices();

        saveLocalState(user.id, {
          portfolios: mappedPortfolios.length > 0 ? mappedPortfolios : INITIAL_PORTFOLIOS,
          activePortfolioId: validActiveId,
          transactions: mappedTransactions,
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
            await supabase.from('transactions').delete().eq('portfolio_id', id).eq('user_id', user.id);
            await supabase.from('portfolios').delete().eq('id', id).eq('user_id', user.id);
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
                await supabase.from('transactions').delete().eq('portfolio_id', dbP.id).eq('user_id', user.id);
                await supabase.from('portfolios').delete().eq('id', dbP.id).eq('user_id', user.id);
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
              return { transactions: updated };
            });
            get().fetchLivePrices();
            return insertedDbTx;
          }
        }

        // Fallback / Guest mode
        const fallbackTx: Transaction = {
          ...tx,
          id: `tx-${Date.now()}`,
          portfolioId: targetPort?.id || targetPortfolioId || 'p-default',
          userId: user?.id || 'guest',
          currency: tx.currency || 'TRY',
          exchangeRate: tx.exchangeRate,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          const updated = [fallbackTx, ...state.transactions];
          saveLocalState(user?.id, {
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
              const updated = [...insertedList, ...state.transactions];
              saveLocalState(user.id, {
                portfolios: state.portfolios,
                activePortfolioId: state.activePortfolioId,
                transactions: updated,
              });
              return { transactions: updated };
            });
            get().fetchLivePrices();
            return insertedList;
          }
        }

        // Fallback / Guest mode batch insert
        const fallbackTxs: Transaction[] = txList.map((tx, idx) => ({
          ...tx,
          id: `tx-${Date.now()}-${idx}`,
          portfolioId: targetPort?.id || targetPortfolioId || 'p-default',
          userId: user?.id || 'guest',
          currency: tx.currency || 'TRY',
          exchangeRate: tx.exchangeRate,
          createdAt: new Date().toISOString(),
        }));

        set((state) => {
          const updated = [...fallbackTxs, ...state.transactions];
          saveLocalState(user?.id, {
            portfolios: state.portfolios,
            activePortfolioId: state.activePortfolioId,
            transactions: updated,
          });
          return { transactions: updated };
        });

        get().fetchLivePrices();
        return fallbackTxs;
      } catch (e: any) {
        console.error('addBatchTransactions error:', e);
        return [];
      }
    },

    deleteTransaction: async (id) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (user && isUuid(id)) {
          await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
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

        if (user) {
          if (isUuid(portfolioId)) {
            await supabase.from('transactions').delete().eq('portfolio_id', portfolioId).eq('user_id', user.id);
          } else {
            const port = get().portfolios.find((p) => p.id === portfolioId);
            if (port) {
              const { data: dbP } = await supabase
                .from('portfolios')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', port.name)
                .maybeSingle();
              if (dbP?.id) {
                await supabase.from('transactions').delete().eq('portfolio_id', dbP.id).eq('user_id', user.id);
              }
            }
          }
        }

        set((state) => {
          const updated = state.transactions.filter((t) => t.portfolioId !== portfolioId);
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

    getSummary: () => {
      const { transactions, activePortfolioId, livePrices, portfolios } = get();
      const effectiveActiveId = activePortfolioId || portfolios[0]?.id || 'p-default';
      const filtered = transactions.filter((t) => t.portfolioId === effectiveActiveId);
      return calculatePortfolioSummary(filtered, livePrices);
    },
  };
});
