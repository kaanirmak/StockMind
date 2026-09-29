'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/theme/ThemeProvider';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  category: 'portfolio' | 'market' | 'ai' | 'system';
  link?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'THYAO Direnç Seviyesinde',
    description: 'THYAO hisseniz +%2.8 artışla ₺284 seviyesine ulaştı. Kâr realizasyonu hedefleri güncellendi.',
    time: '15 dk önce',
    read: false,
    category: 'portfolio',
    link: '/portfolio',
  },
  {
    id: 'notif-2',
    title: 'BIST 100 Günlük Kapanış',
    description: 'BIST 100 endeksi günü pozitif bölgede kapattı. Volatilite göstergeleri dengeli seyrediyor.',
    time: '45 dk önce',
    read: false,
    category: 'market',
    link: '/dashboard',
  },
  {
    id: 'notif-3',
    title: 'TEFAS Fon Sepeti Analizi Hazır',
    description: 'StockMind AI, teknoloji ve büyüme fonları için haftalık sepet önerisini tamamladı.',
    time: '2 saat önce',
    read: false,
    category: 'ai',
    link: '/ai-assistant',
  },
  {
    id: 'notif-4',
    title: '18:30 Günlük Bülten Servisi',
    description: 'E-posta bildirim servisiniz aktif. Günlük kapanış bülteniniz her akşam iletilecektir.',
    time: 'Bugün',
    read: true,
    category: 'system',
    link: '/settings',
  },
];

function getNotificationIcon(category: NotificationItem['category']) {
  switch (category) {
    case 'portfolio':
      return (
        <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'market':
      return (
        <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'ai':
      return (
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'system':
    default:
      return (
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
  }
}

function getNotificationIconColor(category: NotificationItem['category']) {
  switch (category) {
    case 'portfolio':
      return 'bg-emerald-500/15 border border-emerald-500/30';
    case 'market':
      return 'bg-cyan-500/15 border border-cyan-500/30';
    case 'ai':
      return 'bg-accent/15 border border-accent/30';
    case 'system':
    default:
      return 'bg-amber-500/15 border border-amber-500/30';
  }
}

export default function Header() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Load and persist notifications
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stockmind_notifications');
      if (saved) {
        setNotifications(JSON.parse(saved));
      } else {
        setNotifications(INITIAL_NOTIFICATIONS);
      }
    } catch (_) {
      setNotifications(INITIAL_NOTIFICATIONS);
    }
  }, []);

  const saveNotifications = (items: NotificationItem[]) => {
    setNotifications(items);
    try {
      localStorage.setItem('stockmind_notifications', JSON.stringify(items));
    } catch (_) {}
  };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const clearAllNotifications = () => {
    saveNotifications([]);
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    saveNotifications(notifications.filter((n) => n.id !== id));
  };

  const handleNotificationClick = (item: NotificationItem) => {
    const updated = notifications.map((n) => (n.id === item.id ? { ...n, read: true } : n));
    saveNotifications(updated);
    setShowNotifications(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayedNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.read)
    : notifications;

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [searchResults, setSearchResults] = useState<{
    stocks: any[];
    funds: any[];
    loading: boolean;
  }>({ stocks: [], funds: [], loading: false });
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (⌘K or Ctrl+K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
      if (e.key === 'Escape') {
        setShowSearchDropdown(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live search effect with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ stocks: [], funds: [], loading: false });
      return;
    }

    const timer = setTimeout(async () => {
      setSearchResults((prev) => ({ ...prev, loading: true }));
      try {
        const [stocksRes, fundsRes] = await Promise.all([
          fetch(`/api/stocks?search=${encodeURIComponent(searchQuery.trim())}`),
          fetch(`/api/funds?search=${encodeURIComponent(searchQuery.trim())}`),
        ]);
        const stocksData = await stocksRes.json();
        const fundsData = await fundsRes.json();

        setSearchResults({
          stocks: stocksData.success ? stocksData.data.slice(0, 6) : [],
          funds: fundsData.success ? fundsData.data.slice(0, 6) : [],
          loading: false,
        });
        setShowSearchDropdown(true);
      } catch (err) {
        setSearchResults({ stocks: [], funds: [], loading: false });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      setShowSearchDropdown(false);
      if (searchResults.stocks.length > 0) {
        router.push(`/stocks/${searchResults.stocks[0].symbol}`);
      } else if (searchResults.funds.length > 0) {
        router.push(`/funds/${searchResults.funds[0].code}`);
      } else {
        router.push(`/stocks/${searchQuery.toUpperCase().trim()}`);
      }
      setSearchQuery('');
    }
  };

  return (
    <header className="h-16 glass border-b border-border flex items-center justify-between px-3 sm:px-4 lg:px-6 sticky top-0 z-30">
      {/* Mobile Brand Logo + Search Container */}
      <div className="flex items-center gap-2 flex-1 max-w-lg min-w-0 mr-2 sm:mr-4">
        <Link
          href="/dashboard"
          className="md:hidden relative flex items-center justify-center shrink-0 rounded-xl p-1 group transition-all"
          title="StockMind Ana Sayfa"
        >
          {/* Transition gradient aura behind mobile logo */}
          <div
            className={`absolute inset-0 rounded-xl bg-gradient-to-tr from-violet-600/30 via-fuchsia-500/25 to-indigo-600/30 blur-sm transition-all duration-500 ${
              searchResults.loading
                ? 'opacity-100 scale-110 animate-aura-expand'
                : 'opacity-40 group-hover:opacity-100 group-hover:scale-105'
            }`}
          />
          <img
            src="/icon-brain-light.png"
            alt="StockMind"
            className={`h-7 w-7 object-contain dark:hidden relative z-10 transition-transform ${
              searchResults.loading ? 'animate-brain-pulse' : 'group-hover:scale-105'
            }`}
          />
          <img
            src="/icon-brain-dark.png"
            alt="StockMind"
            className={`h-7 w-7 object-contain hidden dark:block relative z-10 drop-shadow-[0_0_10px_rgba(139,92,246,0.45)] transition-transform ${
              searchResults.loading ? 'animate-brain-pulse' : 'group-hover:scale-105'
            }`}
          />
        </Link>
        <div className="flex-1 relative min-w-0" ref={searchContainerRef}>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setShowSearchDropdown(true);
            }}
            onKeyDown={handleSearchSubmit}
            placeholder="Tüm hisse veya fonları ara... (örn: KONTR, TI2, ASTOR, AFT)"
            className="w-full pl-10 pr-12 py-2 rounded-xl bg-bg-input border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-200"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-text-muted bg-bg-tertiary border border-border">
            ⌘K
          </kbd>
        </div>

        {/* Live Search Autocomplete Dropdown */}
        {showSearchDropdown && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 glass-card rounded-2xl border border-border shadow-2xl p-2 z-50 max-h-[420px] overflow-y-auto space-y-3 animate-fade-in">
            {searchResults.loading ? (
              <div className="p-4 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Aranıyor...</span>
              </div>
            ) : searchResults.stocks.length === 0 && searchResults.funds.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted">
                <p>"{searchQuery}" için doğrudan sonuç bulunamadı.</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <Link
                    href={`/stocks/${searchQuery.toUpperCase().trim()}`}
                    onClick={() => setShowSearchDropdown(false)}
                    className="text-accent hover:underline font-semibold"
                  >
                    {searchQuery.toUpperCase().trim()} Piyasada Ara &rarr;
                  </Link>
                  {searchQuery.trim().length === 3 && (
                    <>
                      <span>•</span>
                      <Link
                        href={`/funds/${searchQuery.toUpperCase().trim()}`}
                        onClick={() => setShowSearchDropdown(false)}
                        className="text-accent hover:underline font-semibold"
                      >
                        {searchQuery.toUpperCase().trim()} TEFAS Kodu &rarr;
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Stocks Section */}
                {searchResults.stocks.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      Hisse Senetleri ({searchResults.stocks.length})
                    </div>
                    <div className="space-y-1">
                      {searchResults.stocks.map((stock: any) => {
                        const isPos = (stock.changePercent || 0) >= 0;
                        const curr = stock.currency === 'TRY' ? '₺' : '$';
                        return (
                          <Link
                            key={stock.symbol}
                            href={`/stocks/${stock.symbol}`}
                            onClick={() => {
                              setShowSearchDropdown(false);
                              setSearchQuery('');
                            }}
                            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-bg-hover transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-bg-tertiary group-hover:bg-accent group-hover:text-white transition-colors flex items-center justify-center font-bold text-xs text-text-primary">
                                {stock.symbol.substring(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-xs text-text-primary group-hover:text-accent transition-colors block">
                                  {stock.symbol}
                                </span>
                                <span className="text-[11px] text-text-muted line-clamp-1">
                                  {stock.name}
                                </span>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <span className="text-xs font-bold text-text-primary block">
                                {curr}{Number(stock.price).toFixed(2)}
                              </span>
                              <span className={`text-[10px] font-semibold ${isPos ? 'text-success' : 'text-danger'}`}>
                                {isPos ? '+' : ''}{Number(stock.changePercent).toFixed(2)}%
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Funds Section */}
                {searchResults.funds.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider border-t border-border/50 pt-2">
                      TEFAS Yatırım Fonları ({searchResults.funds.length})
                    </div>
                    <div className="space-y-1">
                      {searchResults.funds.map((fund: any) => (
                        <Link
                          key={fund.code}
                          href={`/funds/${fund.code}`}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-bg-hover transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 text-accent flex items-center justify-center font-bold text-xs">
                              {fund.code}
                            </div>
                            <div>
                              <span className="font-bold text-xs text-text-primary group-hover:text-accent transition-colors block">
                                {fund.code}
                              </span>
                              <span className="text-[11px] text-text-muted line-clamp-1">
                                {fund.name}
                              </span>
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <span className="text-xs font-bold text-text-primary block">
                              ₺{Number(fund.price).toFixed(4)}
                            </span>
                            <span className="text-[10px] font-semibold text-success">
                              +{Number(fund.yearlyReturn || 0).toFixed(1)}% (1Y)
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Guest Login Direct CTA */}
        {!profile && (
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 text-xs font-semibold transition-all cursor-pointer"
          >
            <span>Giriş Yap</span>
          </Link>
        )}

        {/* Theme Toggle Button (Siyah Plan / Beyaz Plan) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="relative p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-200 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0 border border-transparent hover:border-border"
          title={resolvedTheme === 'dark' ? 'Beyaz Plana Geç (Açık Tema)' : 'Siyah Plana Geç (Koyu Tema)'}
          aria-label="Tema Değiştir"
        >
          {resolvedTheme === 'dark' ? (
            <svg className="w-5 h-5 text-amber-400 hover:text-amber-300 transition-transform duration-300 hover:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-violet-600 hover:text-violet-700 transition-transform duration-300 hover:-rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
          )}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-200 cursor-pointer ${
              showNotifications ? 'bg-bg-hover text-text-primary' : ''
            }`}
            title="Bildirimler"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            {/* Unread badge counter */}
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-extrabold flex items-center justify-center shadow-lg shadow-accent/40 animate-pulse-glow">
                {unreadCount}
              </span>
            ) : (
              <span className="sr-only">Bildirim yok</span>
            )}
          </button>

          {/* Notification Panel Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[380px] max-w-[calc(100vw-1.5rem)] glass-card rounded-2xl border border-border shadow-elevated py-2 animate-scale-in origin-top-right z-50 overflow-hidden">
              {/* Panel Header */}
              <div className="px-4 py-3 border-b border-border/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-text-primary">Bildirimler</span>
                  {unreadCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-accent/20 text-accent">
                      {unreadCount} yeni
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-bg-secondary text-text-muted">
                      Güncel
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-accent hover:underline font-medium cursor-pointer"
                  >
                    Tümünü Okundu Say
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 border-b border-border/40 text-xs">
                <button
                  onClick={() => setFilterUnreadOnly(false)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    !filterUnreadOnly
                      ? 'bg-accent/20 text-accent font-semibold'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  Tümü ({notifications.length})
                </button>
                <button
                  onClick={() => setFilterUnreadOnly(true)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    filterUnreadOnly
                      ? 'bg-accent/20 text-accent font-semibold'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  Okunmamış ({unreadCount})
                </button>
              </div>

              {/* Notifications List */}
              <div className="max-h-[340px] overflow-y-auto divide-y divide-border/40">
                {displayedNotifications.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-bg-secondary flex items-center justify-center mx-auto mb-2 text-text-muted">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-text-primary">Yeni bildirim bulunmuyor</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Tüm piyasa ve portföy hareketleri takip ediliyor.</p>
                  </div>
                ) : (
                  displayedNotifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={`p-3 sm:px-4 hover:bg-bg-hover transition-colors cursor-pointer flex items-start gap-3 relative group ${
                        !item.read ? 'bg-accent/[0.04]' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${getNotificationIconColor(item.category)}`}>
                        {getNotificationIcon(item.category)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs truncate ${!item.read ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                            {item.title}
                          </p>
                          <span className="text-[10px] text-text-muted shrink-0">{item.time}</span>
                        </div>
                        <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!item.read && (
                        <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0 animate-pulse" />
                      )}

                      {/* Delete button on hover */}
                      <button
                        onClick={(e) => deleteNotification(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger rounded hover:bg-bg-secondary transition-all shrink-0 cursor-pointer"
                        title="Sil"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Panel Footer */}
              <div className="px-4 py-2.5 bg-bg-secondary/40 border-t border-border/60 flex items-center justify-between text-xs">
                {notifications.length > 0 ? (
                  <button
                    onClick={clearAllNotifications}
                    className="text-text-muted hover:text-danger transition-colors cursor-pointer text-[11px]"
                  >
                    Tümünü Temizle
                  </button>
                ) : <span />}

                <Link
                  href="/settings"
                  onClick={() => setShowNotifications(false)}
                  className="text-accent hover:underline font-medium text-[11px] inline-flex items-center gap-1"
                >
                  <span>Bildirim Ayarları</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-bg-hover transition-all duration-200 cursor-pointer"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-sm overflow-hidden flex-shrink-0 ${
              profile ? 'gradient-accent' : 'bg-amber-500/80'
            }`}>
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName || 'Profil'}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    // fallback if image fails to load
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                profile?.fullName?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || 'M'
              )}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-text-primary max-w-[110px] truncate leading-tight">
                  {profile?.fullName || profile?.username || 'Misafir Kullanıcı'}
                </span>
                {(profile?.isPro ?? true) && (
                  <span className="px-1.5 py-0.2 rounded-md bg-gradient-to-r from-violet-600 via-accent to-fuchsia-600 text-white text-[9px] font-black tracking-wider uppercase shadow-xs shadow-accent/30 flex items-center gap-0.5 shrink-0">
                    <span className="text-[8px]">★</span> PRO
                  </span>
                )}
              </div>
              <span className="text-[10px] text-text-muted">
                {profile ? ((profile?.isPro ?? true) ? 'StockMind Pro' : 'Hesabım') : 'Misafir Modu'}
              </span>
            </div>
            <svg className={`w-4 h-4 text-text-muted transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 glass-card rounded-xl border border-border shadow-elevated py-1 animate-scale-in origin-top-right z-50">
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-semibold shadow-sm overflow-hidden flex-shrink-0 ${
                  profile ? 'gradient-accent' : 'bg-amber-500/80'
                }`}>
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName || 'Profil'}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    profile?.fullName?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || 'M'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {profile?.fullName || 'Misafir Kullanıcı'}
                    </p>
                    {(profile?.isPro ?? true) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-violet-600 via-accent to-fuchsia-600 text-white text-[10px] font-black tracking-wider uppercase shadow-xs shadow-accent/30 flex items-center gap-0.5 shrink-0">
                        <span className="text-[8px]">★</span> PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {profile?.username || 'Giriş Yapılmadı'} • {(profile?.isPro ?? true) ? '⭐ Pro Üye' : 'Standart'}
                  </p>
                </div>
              </div>

              {!profile && (
                <>
                  <Link
                    href="/login"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-accent font-semibold hover:bg-accent/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Giriş Yap
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 75v6m3-3h-6m-1.5-4.5a3 3 0 11-6 0 3 3 0 016 0zM4 19a6 6 0 0112 0v1H4v-1z" />
                    </svg>
                    Yeni Hesap Oluştur
                  </Link>
                </>
              )}

              {/* Theme Toggle in Menu */}
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                }}
                className="flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors w-full cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {resolvedTheme === 'dark' ? (
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                  )}
                  <span>Plan: {resolvedTheme === 'dark' ? 'Siyah Plan' : 'Beyaz Plan'}</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                  {resolvedTheme === 'dark' ? 'Koyu' : 'Açık'}
                </span>
              </button>

              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Ayarlar
              </Link>

              {profile && (
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    signOut();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors w-full cursor-pointer border-t border-border/40 mt-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Çıkış Yap
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
