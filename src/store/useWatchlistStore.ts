'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  assetType: 'stock' | 'fund';
  price: number;
  changePercent: number;
  exchange?: string;
  targetPrice?: number;
  addedAt?: string;
}

interface WatchlistState {
  items: WatchlistItem[];
  addItem: (item: Omit<WatchlistItem, 'id'>) => void;
  removeItem: (id: string) => void;
  removeBySymbol: (symbol: string) => void;
  toggleWatchlist: (item: Omit<WatchlistItem, 'id'>) => boolean;
  isWatchlisted: (symbol: string) => boolean;
  setTargetPrice: (id: string, targetPrice: number) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const sym = item.symbol.toUpperCase();
        if (get().items.some((i) => i.symbol.toUpperCase() === sym)) {
          return;
        }
        const newItem: WatchlistItem = {
          ...item,
          id: `w-${Date.now()}-${sym}`,
          addedAt: new Date().toISOString(),
        };
        set((state) => ({ items: [newItem, ...state.items] }));
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },

      removeBySymbol: (symbol) => {
        const sym = symbol.toUpperCase();
        set((state) => ({
          items: state.items.filter((i) => i.symbol.toUpperCase() !== sym),
        }));
      },

      toggleWatchlist: (item) => {
        const sym = item.symbol.toUpperCase();
        const exists = get().items.some((i) => i.symbol.toUpperCase() === sym);

        if (exists) {
          set((state) => ({
            items: state.items.filter((i) => i.symbol.toUpperCase() !== sym),
          }));
          return false; // removed
        } else {
          const newItem: WatchlistItem = {
            ...item,
            id: `w-${Date.now()}-${sym}`,
            addedAt: new Date().toISOString(),
          };
          set((state) => ({
            items: [newItem, ...state.items],
          }));
          return true; // added
        }
      },

      isWatchlisted: (symbol) => {
        const sym = symbol.toUpperCase();
        return get().items.some((i) => i.symbol.toUpperCase() === sym);
      },

      setTargetPrice: (id, targetPrice) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, targetPrice } : i)),
        }));
      },
    }),
    {
      name: 'stockmind-watchlist-storage',
    }
  )
);
