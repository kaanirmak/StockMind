'use client';

import { create } from 'zustand';

export type PriceAlertType = 'price' | 'percent_up' | 'percent_down' | 'percent_both';

export interface WatchlistAlertConfig {
  targetPrice?: number;
  alertType?: PriceAlertType;
  alertPercent?: number; // e.g. 1, 2, 3, 5, 10
  alertBasePrice?: number; // Price when alert was configured
}

export interface WatchlistItem extends WatchlistAlertConfig {
  id: string;
  symbol: string;
  name: string;
  assetType: 'stock' | 'fund';
  price: number;
  changePercent: number;
  exchange?: string;
  addedAt?: string;
}

export function calculateTargetPriceFromPercent(
  basePrice: number,
  percent: number,
  direction: 'up' | 'down'
): number {
  if (basePrice <= 0 || percent <= 0) return basePrice;
  if (direction === 'up') {
    return Number((basePrice * (1 + percent / 100)).toFixed(2));
  } else {
    return Number((basePrice * (1 - percent / 100)).toFixed(2));
  }
}

export function isPriceAlertTriggered(
  item: WatchlistItem,
  currentLivePrice: number
): { triggered: boolean; title: string; message: string } {
  if (currentLivePrice <= 0) return { triggered: false, title: '', message: '' };

  const alertType = item.alertType || 'price';
  const basePrice = item.alertBasePrice || item.price || currentLivePrice;
  const targetPrice = item.targetPrice;
  const alertPercent = item.alertPercent;
  const sym = item.symbol.toUpperCase();
  const name = item.name || sym;

  if (alertType === 'percent_up' && alertPercent && alertPercent > 0 && basePrice > 0) {
    const threshold = basePrice * (1 + alertPercent / 100);
    if (currentLivePrice >= threshold) {
      return {
        triggered: true,
        title: `📈 %${alertPercent} Yükseliş Alarmı: ${sym}`,
        message: `${name} (%${alertPercent} artış hedefine ulaştı (₺${currentLivePrice.toFixed(2)} / Baz: ₺${basePrice.toFixed(2)})`,
      };
    }
  } else if (alertType === 'percent_down' && alertPercent && alertPercent > 0 && basePrice > 0) {
    const threshold = basePrice * (1 - alertPercent / 100);
    if (currentLivePrice <= threshold) {
      return {
        triggered: true,
        title: `📉 %${alertPercent} Düşüş Alarmı: ${sym}`,
        message: `${name} %${alertPercent} düşüş eşiğine geriledi (₺${currentLivePrice.toFixed(2)} / Baz: ₺${basePrice.toFixed(2)})`,
      };
    }
  } else if (alertType === 'percent_both' && alertPercent && alertPercent > 0 && basePrice > 0) {
    const upper = basePrice * (1 + alertPercent / 100);
    const lower = basePrice * (1 - alertPercent / 100);
    if (currentLivePrice >= upper) {
      return {
        triggered: true,
        title: `📈 %${alertPercent} Yükseliş Sapması: ${sym}`,
        message: `${name} baz fiyattan %${alertPercent} yükselerek ₺${currentLivePrice.toFixed(2)} oldu!`,
      };
    }
    if (currentLivePrice <= lower) {
      return {
        triggered: true,
        title: `📉 %${alertPercent} Düşüş Sapması: ${sym}`,
        message: `${name} baz fiyattan %${alertPercent} gerileyerek ₺${currentLivePrice.toFixed(2)} oldu!`,
      };
    }
  } else if (targetPrice && targetPrice > 0) {
    if (targetPrice >= basePrice) {
      if (currentLivePrice >= targetPrice) {
        return {
          triggered: true,
          title: `🎯 Hedef Fiyat Ulaştı: ${sym}`,
          message: `${name} belirlediğiniz ₺${targetPrice.toFixed(2)} hedefine ulaştı! (Güncel: ₺${currentLivePrice.toFixed(2)})`,
        };
      }
    } else {
      if (currentLivePrice <= targetPrice) {
        return {
          triggered: true,
          title: `🎯 Alt Fiyat Eşiği: ${sym}`,
          message: `${name} belirlediğiniz ₺${targetPrice.toFixed(2)} alt seviyesine geriledi! (Güncel: ₺${currentLivePrice.toFixed(2)})`,
        };
      }
    }
  }

  return { triggered: false, title: '', message: '' };
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
  setAlert: (symbolOrId: string, alert: WatchlistAlertConfig, stockMeta?: Partial<WatchlistItem>) => void;
  removeAlert: (symbolOrId: string) => void;
  getAlert: (symbol: string) => WatchlistItem | undefined;
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

    setAlert: (symbolOrId, alert, stockMeta) => {
      const { currentUserId, items } = get();
      const searchKey = symbolOrId.toUpperCase();
      const index = items.findIndex((i) => i.id === symbolOrId || i.symbol.toUpperCase() === searchKey);

      let updated: WatchlistItem[];
      if (index >= 0) {
        updated = items.map((i, idx) => (idx === index ? { ...i, ...alert } : i));
      } else if (stockMeta && stockMeta.symbol) {
        const newItem: WatchlistItem = {
          id: `w-${Date.now()}-${stockMeta.symbol.toUpperCase()}`,
          symbol: stockMeta.symbol.toUpperCase(),
          name: stockMeta.name || stockMeta.symbol.toUpperCase(),
          assetType: stockMeta.assetType || 'stock',
          price: stockMeta.price || 0,
          changePercent: stockMeta.changePercent || 0,
          exchange: stockMeta.exchange || 'BIST',
          addedAt: new Date().toISOString(),
          ...alert,
        };
        updated = [newItem, ...items];
      } else {
        return;
      }

      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
    },

    removeAlert: (symbolOrId) => {
      const { currentUserId, items } = get();
      const searchKey = symbolOrId.toUpperCase();
      const updated = items.map((i) => {
        if (i.id === symbolOrId || i.symbol.toUpperCase() === searchKey) {
          const copy = { ...i };
          delete copy.targetPrice;
          delete copy.alertType;
          delete copy.alertPercent;
          delete copy.alertBasePrice;
          return copy;
        }
        return i;
      });
      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
    },

    getAlert: (symbol) => {
      const sym = symbol.toUpperCase();
      return get().items.find((i) => i.symbol.toUpperCase() === sym);
    },
  };
});
