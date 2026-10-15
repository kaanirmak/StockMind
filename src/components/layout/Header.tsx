'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { readInbox, saveInbox } from '@/lib/notifications/inbox';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { SearchPalette } from '@/components/layout/SearchPalette';
import { useTheme } from '@/components/theme/ThemeProvider';
import { ApkDownloadModal, LegalDisclaimerModal } from '@/components/ui';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  category: 'portfolio' | 'market' | 'ai' | 'system';
  link?: string;
  archived?: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  useScrollLock(showNotifications || showUserMenu);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reload = () => setNotifications(readInbox());
    reload();
    window.addEventListener('storage', reload);
    window.addEventListener('stockmind:inbox', reload);
    return () => { window.removeEventListener('storage', reload); window.removeEventListener('stockmind:inbox', reload); };
  }, []);

  const saveNotifications = (items: NotificationItem[]) => { setNotifications(items); saveInbox(items); };

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  const clearAllNotifications = () => {
    saveNotifications(notifications.map((n) => ({ ...n, read: true, archived: true })));
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

  const unreadCount = notifications.filter((n) => !n.read && !n.archived).length;
  const displayedNotifications = notifications.filter((n) => Boolean(n.archived) === showArchive && (!filterUnreadOnly || !n.read));

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


  return (
    <header className="h-14 sm:h-16 bg-bg-card/98 backdrop-blur-xl border-b border-border shadow-xs flex items-center justify-between px-3 sm:px-4 lg:px-6 sticky top-0 z-30">
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
              'opacity-40 group-hover:opacity-100 group-hover:scale-105'
            }`}
          />
          <img
            src="/icon-brain-light.png"
            alt="StockMind"
            className={`h-7 w-7 object-contain dark:hidden relative z-10 transition-transform ${
              'group-hover:scale-105'
            }`}
          />
          <img
            src="/icon-brain-dark.png"
            alt="StockMind"
            className={`h-7 w-7 object-contain hidden dark:block relative z-10 drop-shadow-[0_0_10px_rgba(139,92,246,0.45)] transition-transform ${
              'group-hover:scale-105'
            }`}
          />
        </Link>
        <SearchPalette />
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

        {/* Android APK Download Button */}
        <button
          type="button"
          onClick={() => setShowApkModal(true)}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 shrink-0"
          title="StockMind Android Uygulamasını İndir (v1.4.0 APK)"
        >
          <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.997-3.459a.416.416 0 00-.152-.5684.417.417 0 00-.569.152l-2.0223 3.503C15.583 8.359 13.856 8 12 8s-3.583.359-5.1352.949L4.8425 5.446a.417.417 0 00-.569-.152.416.416 0 00-.152.5684l1.997 3.459C2.688 11.086 0 14.887 0 19.341h24c0-4.454-2.688-8.255-6.1185-10.0196" />
          </svg>
          <span className="hidden sm:inline">APK İndir</span>
        </button>

        {/* Theme Toggle Button (Siyah Plan / Beyaz Plan) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="relative p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-200 cursor-pointer min-h-11 min-w-11 hidden sm:flex items-center justify-center shrink-0 border border-transparent hover:border-border"
          title={resolvedTheme === 'dark' ? 'Açık Temaya Geç' : 'Koyu Temaya Geç'}
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

        {/* Legal Disclaimer & Data Transparency Button (DATA-10) */}
        <button
          type="button"
          onClick={() => setShowDisclaimerModal(true)}
          className="relative p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-200 cursor-pointer min-h-11 min-w-11 hidden sm:flex items-center justify-center shrink-0 border border-transparent hover:border-border"
          title="Piyasa Verileri ve Yasal Uyarı"
          aria-label="Piyasa Verileri ve Yasal Uyarı"
        >
          <svg className="w-5 h-5 text-text-muted hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => { setShowUserMenu(false); setShowNotifications(!showNotifications); }}
            className={`relative p-2 min-h-11 min-w-11 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all duration-200 cursor-pointer ${
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
            <>
              {/* Mobile backdrop overlay */}
              <div
                className="sm:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs animate-fade-in"
                onClick={() => setShowNotifications(false)}
              />
              <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-14 sm:top-full mt-1.5 sm:mt-2 w-auto sm:w-[380px] max-w-none sm:max-w-[400px] glass-card rounded-2xl border border-border shadow-2xl py-2 animate-scale-in origin-top-right z-50 overflow-hidden">
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
                  onClick={() => { setFilterUnreadOnly(false); setShowArchive(false); }}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    !filterUnreadOnly
                      ? 'bg-accent/20 text-accent font-semibold'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  Tümü ({notifications.length})
                </button>
                <button
                  onClick={() => { setFilterUnreadOnly(true); setShowArchive(false); }}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                    filterUnreadOnly
                      ? 'bg-accent/20 text-accent font-semibold'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  Okunmamış ({unreadCount})
                </button>
              </div>

              <div className="px-4 flex justify-between text-xs">
                <button onClick={() => { setShowArchive(!showArchive); setFilterUnreadOnly(false); }} className="text-accent">{showArchive ? 'Gelen kutusu' : 'Arşiv'}</button>
                <Link href="/settings#notifications" onClick={() => setShowNotifications(false)} className="inline-flex items-center min-h-11 text-text-secondary">Bildirim tercihleri</Link>
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
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(item); }}
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

                      <button type="button" title="Bildirim tercihini düzenle" aria-label={`${item.title} bildirim tercihini düzenle`} onClick={(e) => { e.stopPropagation(); setShowNotifications(false); router.push('/settings#notifications'); }} className="min-w-11 text-text-muted hover:text-accent"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /></svg></button>
                      {/* Delete button on hover */}
                      <button
                        onClick={(e) => deleteNotification(item.id, e)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1 text-text-muted hover:text-danger rounded hover:bg-bg-secondary transition-all shrink-0 cursor-pointer"
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
                    Tümünü Arşivle
                  </button>
                ) : <span />}

                <Link
                  href="/settings#notifications"
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
          </>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => { setShowNotifications(false); setShowUserMenu(!showUserMenu); }}
            className="flex min-h-11 items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-1.5 rounded-xl hover:bg-bg-hover transition-all duration-200 cursor-pointer"
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
                {Boolean(profile?.isPro) && (
                  <span className="px-1.5 py-0.2 rounded-md bg-gradient-to-r from-violet-600 via-accent to-fuchsia-600 text-white text-[9px] font-black tracking-wider uppercase shadow-xs shadow-accent/30 flex items-center gap-0.5 shrink-0">
                    <span className="text-[8px]">★</span> PRO
                  </span>
                )}
              </div>
              <span className="text-[10px] text-text-muted">
                {profile ? (profile?.isPro ? 'StockMind Pro' : 'Hesabım') : 'Misafir Modu'}
              </span>
            </div>
            <svg className={`w-4 h-4 text-text-muted transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <>
              <div
                className="sm:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs animate-fade-in"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] glass-card rounded-xl border border-border shadow-elevated py-1 animate-scale-in origin-top-right z-50">
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
                    {Boolean(profile?.isPro) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-violet-600 via-accent to-fuchsia-600 text-white text-[10px] font-black tracking-wider uppercase shadow-xs shadow-accent/30 flex items-center gap-0.5 shrink-0">
                        <span className="text-[8px]">★</span> PRO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {profile?.username || 'Giriş Yapılmadı'} • {profile?.isPro ? " Pro Üye" : 'Standart'}
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
                  <span>Tema: {resolvedTheme === 'dark' ? 'Koyu Tema' : 'Açık Tema'}</span>
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
          </>
        )}
        </div>
      </div>

      {/* Android APK Modal */}
      <ApkDownloadModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />

      {/* Legal & Data Transparency Modal (DATA-10) */}
      <LegalDisclaimerModal isOpen={showDisclaimerModal} onClose={() => setShowDisclaimerModal(false)} />
    </header>
  );
}
