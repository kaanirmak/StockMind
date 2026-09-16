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
  fetchPortfoliosAndTransactions: () => Promise<void>;
  fetchLivePrices: () => Promise<void>;
  setActivePortfolioId: (id: string) => void;
  addPortfolio: (name: string, description?: string) => Promise<Portfolio | null>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => Promise<Transaction | null>;
  addBatchTransactions: (txList: Omit<Transaction, 'id' | 'createdAt' | 'userId'>[]) => Promise<Transaction[]>;
  deleteTransaction: (id: string) => Promise<boolean>;
  getSummary: () => PortfolioSummary;
}

const LOCAL_STORAGE_KEY = 'stockmind_portfolio_state_v1';

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

function loadLocalState(): { portfolios: Portfolio[]; activePortfolioId: string; transactions: Transaction[] } {
  if (typeof window === 'undefined') {
    return { portfolios: INITIAL_PORTFOLIOS, activePortfolioId: 'p-default', transactions: [] };
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
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

      const rawPortfolios = Array.isArray(parsed.portfolios) && parsed.portfolios.length > 0 ? parsed.portfolios : INITIAL_PORTFOLIOS;
      let activeId = parsed.activePortfolioId || rawPortfolios[0]?.id || 'p-default';

      // If activeId has 0 transactions but another portfolio has transactions, switch to the active one
      if (normalizedTxs.length > 0 && !normalizedTxs.some((t) => t.portfolioId === activeId)) {
        const portWithTxs = rawPortfolios.find((p: any) => normalizedTxs.some((t) => t.portfolioId === p.id));
        if (portWithTxs) {
          activeId = portWithTxs.id;
        }
      }

      return {
        portfolios: rawPortfolios,
        activePortfolioId: activeId,
        transactions: normalizedTxs,
      };
    }
  } catch (e) {
    console.warn('Failed to load local portfolio state:', e);
  }
  return { portfolios: INITIAL_PORTFOLIOS, activePortfolioId: 'p-default', transactions: [] };
}

function saveLocalState(state: { portfolios: Portfolio[]; activePortfolioId: string; transactions: Transaction[] }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save local portfolio state:', e);
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

    setActivePortfolioId: (id) => {
      set({ activePortfolioId: id });
      saveLocalState({
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
          // Guest mode: load from localStorage
          const local = loadLocalState();
          set({
            portfolios: local.portfolios,
            activePortfolioId: local.activePortfolioId,
            transactions: local.transactions,
            loading: false,
          });
          get().fetchLivePrices();
          return;
        }

        // 1. Fetch user's portfolios from Supabase DB
        let { data: dbPortfolios, error: portError } = await supabase
          .from('portfolios')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (portError) throw portError;

        // If no portfolio exists in Supabase for user, create initial 'Ana Portföy' in DB
        if (!dbPortfolios || dbPortfolios.length === 0) {
          const { data: newPort, error: createError } = await supabase
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

          if (!createError && newPort) {
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

        const currentActiveId = get().activePortfolioId;
        let validActiveId = mappedPortfolios.some((p) => p.id === currentActiveId)
          ? currentActiveId
          : mappedPortfolios[0]?.id || 'p-default';

        // 2. Fetch user's transactions from Supabase DB
        const { data: dbTransactions, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false });

        if (txError) throw txError;

        const mappedTransactions: Transaction[] = (dbTransactions || []).map((t: any) => {
          const { symbol, assetType, exchange } = cleanSymbol(t.symbol);
          const effectiveEx = exchange || t.exchange || (assetType === 'fund' ? 'TEFAS' : 'BIST');
          const isUsd = (t.currency || '').toUpperCase() === 'USD' || effectiveEx === 'NASDAQ' || effectiveEx === 'NYSE';
          return {
            id: t.id,
            portfolioId: t.portfolio_id,
            userId: t.user_id,
            symbol,
            assetType: t.asset_type === 'fund' || assetType === 'fund' ? 'fund' : 'stock',
            currency: isUsd ? 'USD' : t.currency || 'TRY',
            exchangeRate: t.exchange_rate != null ? Number(t.exchange_rate) : undefined,
            transactionType: t.transaction_type,
            quantity: Number(t.quantity),
            price: Number(t.price),
            commission: Number(t.commission || 0),
            transactionDate: t.transaction_date,
            exchange: effectiveEx,
            notes: t.notes,
            createdAt: t.created_at,
          };
        });

        if (mappedTransactions.length > 0 && !mappedTransactions.some((t) => t.portfolioId === validActiveId)) {
          const portWithTxs = mappedPortfolios.find((p) => mappedTransactions.some((t) => t.portfolioId === p.id));
          if (portWithTxs) {
            validActiveId = portWithTxs.id;
          }
        }

        set({
          portfolios: mappedPortfolios.length > 0 ? mappedPortfolios : INITIAL_PORTFOLIOS,
          activePortfolioId: validActiveId,
          transactions: mappedTransactions,
          loading: false,
        });

        get().fetchLivePrices();

        saveLocalState({
          portfolios: mappedPortfolios.length > 0 ? mappedPortfolios : INITIAL_PORTFOLIOS,
          activePortfolioId: validActiveId,
          transactions: mappedTransactions,
        });
      } catch (err: any) {
        console.error('Error fetching Supabase portfolio data:', err);
        set({ error: err.message, loading: false });
      }
    },

    addPortfolio: async (name, description) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (user) {
          // Insert into Supabase DB
          const { data, error } = await supabase
            .from('portfolios')
            .insert({
              user_id: user.id,
              name,
              description: description || null,
              currency: 'TRY',
              is_default: false,
            })
            .select()
            .single();

          if (error) {
            console.error('Failed to create portfolio in Supabase:', error);
          } else if (data) {
            const newPort: Portfolio = {
              id: data.id,
              userId: data.user_id,
              name: data.name,
              description: data.description,
              currency: data.currency,
              isDefault: data.is_default,
              createdAt: data.created_at,
            };

            set((state) => {
              const updated = [...state.portfolios, newPort];
              saveLocalState({
                portfolios: updated,
                activePortfolioId: newPort.id,
                transactions: state.transactions,
              });
              return {
                portfolios: updated,
                activePortfolioId: newPort.id,
              };
            });
            return newPort;
          }
        }

        // Fallback / Guest mode
        const fallbackPort: Portfolio = {
          id: `p-${Date.now()}`,
          userId: user?.id || 'guest',
          name,
          description: description || null,
          currency: 'TRY',
          isDefault: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          const updated = [...state.portfolios, fallbackPort];
          saveLocalState({
            portfolios: updated,
            activePortfolioId: fallbackPort.id,
            transactions: state.transactions,
          });
          return {
            portfolios: updated,
            activePortfolioId: fallbackPort.id,
          };
        });

        return fallbackPort;
      } catch (e: any) {
        console.error('addPortfolio error:', e);
        return null;
      }
    },

    addTransaction: async (tx) => {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        let targetPortfolioId = tx.portfolioId || get().activePortfolioId;

        // If user is authenticated, ensure valid portfolio in Supabase
        if (user) {
          let currentPort = get().portfolios.find((p) => p.id === targetPortfolioId);

          // If current portfolio is not a real UUID or not in DB, resolve/create DB portfolio
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPortfolioId);
          if (!isUuid || !currentPort) {
            const { data: existingPorts } = await supabase
              .from('portfolios')
              .select('*')
              .eq('user_id', user.id)
              .limit(1);

            if (existingPorts && existingPorts.length > 0) {
              targetPortfolioId = existingPorts[0].id;
            } else {
              const { data: createdPort } = await supabase
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

              if (createdPort) {
                targetPortfolioId = createdPort.id;
              }
            }
          }

          // Insert into Supabase DB
          const { data, error } = await supabase
            .from('transactions')
            .insert({
              portfolio_id: targetPortfolioId,
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
            })
            .select()
            .single();

          if (error) {
            console.error('Failed to insert transaction into Supabase:', error);
          } else if (data) {
            const newTx: Transaction = {
              id: data.id,
              portfolioId: data.portfolio_id,
              userId: data.user_id,
              symbol: data.symbol,
              assetType: data.asset_type,
              transactionType: data.transaction_type,
              quantity: Number(data.quantity),
              price: Number(data.price),
              currency: data.currency || tx.currency || 'TRY',
              exchangeRate: data.exchange_rate != null ? Number(data.exchange_rate) : tx.exchangeRate,
              commission: Number(data.commission || 0),
              transactionDate: data.transaction_date,
              exchange: data.exchange,
              notes: data.notes,
              createdAt: data.created_at,
            };

            set((state) => {
              const updated = [newTx, ...state.transactions];
              saveLocalState({
                portfolios: state.portfolios,
                activePortfolioId: state.activePortfolioId,
                transactions: updated,
              });
              return { transactions: updated };
            });

            get().fetchLivePrices();
            return newTx;
          }
        }

        // Fallback / Guest mode
        const fallbackTx: Transaction = {
          ...tx,
          id: `tx-${Date.now()}`,
          userId: user?.id || 'guest',
          currency: tx.currency || 'TRY',
          exchangeRate: tx.exchangeRate,
          createdAt: new Date().toISOString(),
        };

        set((state) => {
          const updated = [fallbackTx, ...state.transactions];
          saveLocalState({
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

        let targetPortfolioId = txList[0]?.portfolioId || get().activePortfolioId;

        if (user) {
          let currentPort = get().portfolios.find((p) => p.id === targetPortfolioId);
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPortfolioId);
          if (!isUuid || !currentPort) {
            const { data: existingPorts } = await supabase
              .from('portfolios')
              .select('*')
              .eq('user_id', user.id)
              .limit(1);

            if (existingPorts && existingPorts.length > 0) {
              targetPortfolioId = existingPorts[0].id;
            } else {
              const { data: createdPort } = await supabase
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

              if (createdPort) {
                targetPortfolioId = createdPort.id;
              }
            }
          }

          const rowsToInsert = txList.map((tx) => ({
            portfolio_id: targetPortfolioId,
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

          const { data, error } = await supabase
            .from('transactions')
            .insert(rowsToInsert)
            .select();

          if (error) {
            console.error('Failed to insert batch transactions into Supabase:', error);
          } else if (data && data.length > 0) {
            const newTxs: Transaction[] = data.map((d: any, idx: number) => ({
              id: d.id,
              portfolioId: d.portfolio_id,
              userId: d.user_id,
              symbol: d.symbol,
              assetType: d.asset_type,
              transactionType: d.transaction_type,
              quantity: Number(d.quantity),
              price: Number(d.price),
              currency: d.currency || txList[idx]?.currency || 'TRY',
              exchangeRate: d.exchange_rate != null ? Number(d.exchange_rate) : txList[idx]?.exchangeRate,
              commission: Number(d.commission || 0),
              transactionDate: d.transaction_date,
              exchange: d.exchange,
              notes: d.notes,
              createdAt: d.created_at,
            }));

            set((state) => {
              const updated = [...newTxs, ...state.transactions];
              saveLocalState({
                portfolios: state.portfolios,
                activePortfolioId: state.activePortfolioId,
                transactions: updated,
              });
              return { transactions: updated };
            });

            get().fetchLivePrices();
            return newTxs;
          }
        }

        // Fallback / Guest mode batch insert
        const fallbackTxs: Transaction[] = txList.map((tx, idx) => ({
          ...tx,
          id: `tx-${Date.now()}-${idx}`,
          userId: user?.id || 'guest',
          currency: tx.currency || 'TRY',
          exchangeRate: tx.exchangeRate,
          createdAt: new Date().toISOString(),
        }));

        set((state) => {
          const updated = [...fallbackTxs, ...state.transactions];
          saveLocalState({
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

        if (user) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          if (isUuid) {
            await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
          }
        }

        set((state) => {
          const updated = state.transactions.filter((t) => t.id !== id);
          saveLocalState({
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

    getSummary: () => {
      const { transactions, activePortfolioId, livePrices } = get();
      const filtered = transactions.filter((t) => t.portfolioId === activePortfolioId);
      return calculatePortfolioSummary(filtered, livePrices);
    },
  };
});

