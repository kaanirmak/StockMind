'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
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
    <header className="h-16 glass border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Search */}
      <div className="flex-1 max-w-lg relative" ref={searchContainerRef}>
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

      {/* Right Side */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-200 cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full animate-pulse-glow" />
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-bg-hover transition-all duration-200 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center text-white text-sm font-semibold">
              {profile?.fullName?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || '?'}
            </div>
            {profile && (
              <span className="hidden lg:block text-sm font-medium text-text-primary max-w-[120px] truncate">
                {profile.fullName || profile.username || 'Kullanıcı'}
              </span>
            )}
            <svg className={`w-4 h-4 text-text-muted transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 glass-card rounded-xl border border-border shadow-elevated py-1 animate-scale-in origin-top-right z-50">
              {profile && (
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {profile.fullName || 'Kullanıcı'}
                  </p>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {profile.username || ''}
                  </p>
                </div>
              )}
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
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  signOut();
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors w-full cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
