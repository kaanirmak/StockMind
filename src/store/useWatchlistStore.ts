'use client';

import { create } from 'zustand';

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
  currentUserId: string | null;
  loadUserWatchlist: (userId?: string | null) => void;
  resetWatchlist: () => void;
  addItem: (item: Omit<WatchlistItem, 'id'>) => void;
  removeItem: (id: string) => void;
  removeBySymbol: (symbol: string) => void;
  toggleWatchlist: (item: Omit<WatchlistItem, 'id'>) => boolean;
  isWatchlisted: (symbol: string) => boolean;
  setTargetPrice: (id: string, targetPrice: number) => void;
}

function getWatchlistKey(userId?: string | null): string {
  if (userId && userId !== 'guest') {
    return `stockmind_watchlist_user_${userId}`;
  }
  return 'stockmind_watchlist_guest';
}

function loadLocalWatchlist(userId?: string | null): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getWatchlistKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to load watchlist:', e);
  }
  return [];
}

function syncNativeWatchlist(items: WatchlistItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const bridge = (window as any).StockMindAndroid;
    if (bridge && typeof bridge.syncWatchlistAlerts === 'function') {
      bridge.syncWatchlistAlerts(JSON.stringify(items));
    }
  } catch (err) {
    console.warn('Native watchlist sync failed:', err);
  }
}

function saveLocalWatchlist(userId: string | null | undefined, items: WatchlistItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getWatchlistKey(userId), JSON.stringify(items));
    syncNativeWatchlist(items);
  } catch (e) {
    console.warn('Failed to save watchlist:', e);
  }
}

export const useWatchlistStore = create<WatchlistState>((set, get) => {
  return {
    items: [],
    currentUserId: null,

    loadUserWatchlist: (userId) => {
      const loaded = loadLocalWatchlist(userId);
      set({ items: loaded, currentUserId: userId || null });
      syncNativeWatchlist(loaded);
    },

    resetWatchlist: () => {
      const guestItems = loadLocalWatchlist(null);
      set({ items: guestItems, currentUserId: null });
    },

    addItem: (item) => {
      const { currentUserId, items } = get();
      const sym = item.symbol.toUpperCase();
      if (items.some((i) => i.symbol.toUpperCase() === sym)) {
        return;
      }
      const newItem: WatchlistItem = {
        ...item,
        id: `w-${Date.now()}-${sym}`,
        addedAt: new Date().toISOString(),
      };
      const updated = [newItem, ...items];
      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
    },

    removeItem: (id) => {
      const { currentUserId, items } = get();
      const updated = items.filter((i) => i.id !== id);
      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
    },

    removeBySymbol: (symbol) => {
      const { currentUserId, items } = get();
      const sym = symbol.toUpperCase();
      const updated = items.filter((i) => i.symbol.toUpperCase() !== sym);
      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
    },

    toggleWatchlist: (item) => {
      const { currentUserId, items } = get();
      const sym = item.symbol.toUpperCase();
      const exists = items.some((i) => i.symbol.toUpperCase() === sym);

      if (exists) {
        const updated = items.filter((i) => i.symbol.toUpperCase() !== sym);
        set({ items: updated });
        saveLocalWatchlist(currentUserId, updated);
        return false; // removed
      } else {
        const newItem: WatchlistItem = {
          ...item,
          id: `w-${Date.now()}-${sym}`,
          addedAt: new Date().toISOString(),
        };
        const updated = [newItem, ...items];
        set({ items: updated });
        saveLocalWatchlist(currentUserId, updated);
        return true; // added
      }
    },

    isWatchlisted: (symbol) => {
      const sym = symbol.toUpperCase();
      return get().items.some((i) => i.symbol.toUpperCase() === sym);
    },

    setTargetPrice: (id, targetPrice) => {
      const { currentUserId, items } = get();
      const updated = items.map((i) => (i.id === id ? { ...i, targetPrice } : i));
      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
    },
  };
});
