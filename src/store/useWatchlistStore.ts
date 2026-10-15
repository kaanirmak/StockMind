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

async function getSupabaseClient() {
  // Keep the browser client lazy so pure portfolio/alert calculations can be
  // imported in native test runners without loading the SSR auth package.
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
}

async function getServerWatchlistId(userId: string): Promise<string | null> {
  const supabase = await getSupabaseClient();
  const existing = await supabase.from('watchlists').select('id').eq('user_id', userId).order('created_at').limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id;
  const created = await supabase.from('watchlists').insert({ user_id: userId, name: 'Ana Takip Listesi' }).select('id').single();
  if (created.error) throw created.error;
  return created.data.id;
}

function toServerRow(item: WatchlistItem, watchlistId: string) {
  return {
    watchlist_id: watchlistId,
    symbol: item.symbol.toUpperCase(),
    name: item.name,
    asset_type: item.assetType,
    exchange: item.exchange || null,
    target_price: item.targetPrice ?? null,
    alert_type: item.alertType ?? null,
    alert_percent: item.alertPercent ?? null,
    alert_base_price: item.alertBasePrice ?? null,
    updated_at: new Date().toISOString(),
  };
}

function fromServerRow(row: any, localBySymbol: Map<string, WatchlistItem>): WatchlistItem {
  const previous = localBySymbol.get(String(row.symbol).toUpperCase());
  return {
    id: `server-${row.id}`,
    symbol: String(row.symbol).toUpperCase(),
    name: row.name || previous?.name || row.symbol,
    assetType: row.asset_type === 'fund' ? 'fund' : 'stock',
    price: previous?.price || 0,
    changePercent: previous?.changePercent || 0,
    exchange: row.exchange || previous?.exchange,
    addedAt: row.added_at,
    targetPrice: row.target_price ?? undefined,
    alertType: row.alert_type ?? undefined,
    alertPercent: row.alert_percent ?? undefined,
    alertBasePrice: row.alert_base_price ?? undefined,
  };
}

async function saveServerWatchlist(userId: string | null, items: WatchlistItem[]) {
  if (!userId || userId === 'guest') return;
  const supabase = await getSupabaseClient();
  const watchlistId = await getServerWatchlistId(userId);
  if (!watchlistId) return;
  const existing = await supabase.from('watchlist_items').select('id,symbol,exchange').eq('watchlist_id', watchlistId);
  if (existing.error) throw existing.error;
  const wanted = new Set(items.map((item) => `${item.symbol.toUpperCase()}::${item.exchange || ''}`));
  const stale = (existing.data || []).filter((row) => !wanted.has(`${String(row.symbol).toUpperCase()}::${row.exchange || ''}`));
  if (stale.length) {
    const { error } = await supabase.from('watchlist_items').delete().in('id', stale.map((row) => row.id));
    if (error) throw error;
  }
  if (items.length) {
    const { error } = await supabase.from('watchlist_items').upsert(items.map((item) => toServerRow(item, watchlistId)), { onConflict: 'watchlist_id,symbol,exchange' });
    if (error) throw error;
  }
}

async function loadServerWatchlist(userId: string, localItems: WatchlistItem[]): Promise<WatchlistItem[]> {
  const supabase = await getSupabaseClient();
  const watchlistId = await getServerWatchlistId(userId);
  if (!watchlistId) return [];
  const { data, error } = await supabase.from('watchlist_items').select('*').eq('watchlist_id', watchlistId).order('added_at', { ascending: false });
  if (error) throw error;
  const localBySymbol = new Map(localItems.map((item) => [item.symbol.toUpperCase(), item]));
  const serverItems = (data || []).map((row) => fromServerRow(row, localBySymbol));
  // One-time migration for existing devices: only upload local data when the server list is empty.
  if (serverItems.length === 0 && localItems.length > 0) {
    await saveServerWatchlist(userId, localItems);
    return localItems;
  }
  return serverItems;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => {
  return {
    items: [],
    currentUserId: null,

    loadUserWatchlist: (userId) => {
      const localItems = loadLocalWatchlist(userId);
      set({ items: localItems, currentUserId: userId || null });
      syncNativeWatchlist(localItems);
      if (userId && userId !== 'guest') {
        void loadServerWatchlist(userId, localItems).then((serverItems) => {
          if (get().currentUserId !== userId) return;
          set({ items: serverItems });
          saveLocalWatchlist(userId, serverItems);
          syncNativeWatchlist(serverItems);
        }).catch((error) => console.warn('Failed to load server watchlist:', error));
      }
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
      void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
    },

    removeItem: (id) => {
      const { currentUserId, items } = get();
      const updated = items.filter((i) => i.id !== id);
      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
      void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
    },

    removeBySymbol: (symbol) => {
      const { currentUserId, items } = get();
      const sym = symbol.toUpperCase();
      const updated = items.filter((i) => i.symbol.toUpperCase() !== sym);
      set({ items: updated });
      saveLocalWatchlist(currentUserId, updated);
      void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
    },

    toggleWatchlist: (item) => {
      const { currentUserId, items } = get();
      const sym = item.symbol.toUpperCase();
      const exists = items.some((i) => i.symbol.toUpperCase() === sym);

      if (exists) {
        const updated = items.filter((i) => i.symbol.toUpperCase() !== sym);
        set({ items: updated });
        saveLocalWatchlist(currentUserId, updated);
        void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
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
        void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
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
      void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
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
      void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
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
      void saveServerWatchlist(currentUserId, updated).catch((error) => console.warn('Failed to save server watchlist:', error));
    },

    getAlert: (symbol) => {
      const sym = symbol.toUpperCase();
      return get().items.find((i) => i.symbol.toUpperCase() === sym);
    },
  };
});
