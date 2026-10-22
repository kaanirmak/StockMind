'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface AdminStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  pendingRequests: number;
  dbFundsCount: number;
  directoryFundsCount: number;
  emailServiceMode: string;
  systemTime: string;
  adminEmail: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  isPro: boolean;
  plan: string;
  role: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  proRequestStatus: string;
  proRequestedAt?: string;
  proRequestNote?: string;
  isBanned: boolean;
  bannedUntil?: string | null;
}

interface ProRequest {
  id: string;
  email: string;
  name: string;
  note: string;
  requestedAt?: string;
}

export default function AdminConsolePage() {
  const router = useRouter();
  const supabase = createClient();

  // Authentication & Hardware States
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isDesktop, setIsDesktop] = useState(true);
  const [isBiometricUnlocked, setIsBiometricUnlocked] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [isAuthenticatingBiometric, setIsAuthenticatingBiometric] = useState(false);
  const [hasPlatformAuthenticator, setHasPlatformAuthenticator] = useState(true);

  // Tab & Console State
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'crons' | 'stats'>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [proRequests, setProRequests] = useState<ProRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'pro' | 'pending' | 'banned'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cron execution console logs
  const [cronLogs, setCronLogs] = useState<Array<{ timestamp: string; text: string; status: 'info' | 'success' | 'error' }>>([]);
  const [isTriggeringCron, setIsTriggeringCron] = useState<string | null>(null);

  // 1. Device check: Enforce Desktop Only
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk/i.test(ua);
      const isSmallScreen = width < 1024;
      setIsDesktop(!isMobileUA && !isSmallScreen);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 2. Check current authenticated user
  useEffect(() => {
    async function checkAdminUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login?next=/admin');
          return;
        }

        const email = user.email?.toLowerCase() || '';
        const isAdmin = email === 'kaanrmak7@gmail.com' || user.app_metadata?.role === 'admin';

        if (!isAdmin) {
          router.replace('/dashboard');
          return;
        }

        setCurrentUserEmail(email);

        // Check if biometric session is already active in sessionStorage
        const savedSession = sessionStorage.getItem('stockmind_admin_biometric_unlocked');
        if (savedSession === 'true') {
          setIsBiometricUnlocked(true);
        }

        // Check WebAuthn platform authenticator availability (Touch ID / Windows Hello)
        if (typeof window !== 'undefined' && window.PublicKeyCredential) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
          setHasPlatformAuthenticator(available);
        }
      } catch (err) {
        console.error('Admin check error:', err);
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkAdminUser();
  }, [router, supabase]);

  // 3. Biometric Unlock Handler (WebAuthn Platform Authenticator)
  const triggerBiometricUnlock = async () => {
    setIsAuthenticatingBiometric(true);
    setBiometricError(null);

    try {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        throw new Error('Tarayıcınız Web Authentication (WebAuthn) standardını desteklemiyor.');
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const storedCredId = localStorage.getItem('stockmind_admin_touchid_cred_id');

      const registerNewCredential = async () => {
        const userIdBytes = new TextEncoder().encode(currentUserEmail || 'admin');
        const newCred = (await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: 'StockMind Güvenli Yönetici Konsolu', id: window.location.hostname },
            user: {
              id: userIdBytes,
              name: currentUserEmail || 'kaanrmak7@gmail.com',
              displayName: 'StockMind Yönetici',
            },
            pubKeyCredParams: [
              { alg: -7, type: 'public-key' }, // ES256
              { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: 'platform', // Enforce Touch ID / Windows Hello
              userVerification: 'required',
              residentKey: 'preferred',
            },
            timeout: 60000,
          },
        })) as PublicKeyCredential;

        if (newCred && newCred.rawId) {
          const rawIdStr = btoa(String.fromCharCode(...new Uint8Array(newCred.rawId)));
          localStorage.setItem('stockmind_admin_touchid_cred_id', rawIdStr);
        }
      };

      if (storedCredId) {
        // Authenticate existing credential with Touch ID / Face ID
        const credIdBuffer = Uint8Array.from(atob(storedCredId), (c) => c.charCodeAt(0));

        try {
          await navigator.credentials.get({
            publicKey: {
              challenge,
              rpId: window.location.hostname,
              allowCredentials: [
                {
                  id: credIdBuffer,
                  type: 'public-key',
                  transports: ['internal'],
                },
              ],
              userVerification: 'required',
              timeout: 60000,
            },
          });
        } catch (getErr: any) {
          // If user explicitly cancelled or timed out, report it
          if (getErr.name === 'NotAllowedError') {
            throw getErr;
          }
          // If stored credential was invalid/removed, automatically re-register
          localStorage.removeItem('stockmind_admin_touchid_cred_id');
          await registerNewCredential();
        }
      } else {
        // First-time biometric registration on this Mac / PC
        await registerNewCredential();
      }

      // Biometric check succeeded!
      sessionStorage.setItem('stockmind_admin_biometric_unlocked', 'true');
      setIsBiometricUnlocked(true);
    } catch (err: any) {
      console.warn('Biometric verification error:', err);
      if (err.name === 'NotAllowedError') {
        setBiometricError('Biyometrik doğrulama iptal edildi veya parmak izi eşleşmedi. Tekrar deneyin.');
      } else {
        setBiometricError(err.message || 'Biyometrik donanım sensörüne erişilemedi.');
      }
    } finally {
      setIsAuthenticatingBiometric(false);
    }
  };

  const lockConsole = () => {
    sessionStorage.removeItem('stockmind_admin_biometric_unlocked');
    setIsBiometricUnlocked(false);
  };

  // 4. Fetch System Data once unlocked
  const fetchOverviewData = useCallback(async () => {
    if (!isBiometricUnlocked) return;

    try {
      const statsRes = await fetch('/api/admin/stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      const reqRes = await fetch('/api/admin/pro-requests');
      const reqData = await reqRes.json();
      if (reqData.success && Array.isArray(reqData.requests)) {
        setProRequests(reqData.requests);
      }
    } catch (err) {
      console.error('Error fetching admin overview:', err);
    }
  }, [isBiometricUnlocked]);

  const fetchUsers = useCallback(async () => {
    if (!isBiometricUnlocked) return;
    setIsLoadingUsers(true);
    try {
      const queryParam = searchQuery ? `&query=${encodeURIComponent(searchQuery)}` : '';
      const filterParam = userFilter !== 'all' ? `&filter=${userFilter}` : '';
      const res = await fetch(`/api/admin/users?page=${page}&perPage=25${queryParam}${filterParam}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [isBiometricUnlocked, page, searchQuery, userFilter]);

  useEffect(() => {
    if (isBiometricUnlocked) {
      fetchOverviewData();
      fetchUsers();
    }
  }, [isBiometricUnlocked, fetchOverviewData, fetchUsers]);

  // User Actions
  const handleTogglePlan = async (userId: string, currentIsPro: boolean) => {
    const targetPlan = currentIsPro ? 'standard' : 'pro';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: targetPlan }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: data.message, type: 'success' });
        fetchUsers();
        fetchOverviewData();
      } else {
        setActionMessage({ text: data.error || 'İşlem başarısız oldu.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    }
  };

  const handleUserAction = async (userId: string, action: 'ban' | 'unban' | 'reset_password' | 'purge_metadata') => {
    try {
      const res = await fetch('/api/admin/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: data.message, type: 'success' });
        fetchUsers();
      } else {
        setActionMessage({ text: data.error || 'İşlem gerçekleştirilemedi.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    }
  };

  const handleProDecision = async (userId: string, decision: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/pro-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: decision }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: data.message, type: 'success' });
        fetchOverviewData();
        fetchUsers();
      } else {
        setActionMessage({ text: data.error || 'Karar kaydedilemedi.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    }
  };

  // Cron Manual Trigger
  const triggerCronJob = async (jobName: 'sync-funds' | 'daily-report' | 'purge-sessions') => {
    setIsTriggeringCron(jobName);
    const nowStr = new Date().toLocaleTimeString('tr-TR');

    setCronLogs((prev) => [
      { timestamp: nowStr, text: `[${jobName}] Görev tetiklendi, çalıştırılıyor...`, status: 'info' },
      ...prev,
    ]);

    try {
      const res = await fetch('/api/admin/system/trigger-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job: jobName, limit: 30 }),
      });
      const data = await res.json();

      if (data.success) {
        setCronLogs((prev) => [
          { timestamp: new Date().toLocaleTimeString('tr-TR'), text: `✅ [${jobName}] ${data.message}`, status: 'success' },
          ...prev,
        ]);
        fetchOverviewData();
      } else {
        setCronLogs((prev) => [
          { timestamp: new Date().toLocaleTimeString('tr-TR'), text: `❌ [${jobName}] HATA: ${data.error || 'Görev tamamlanamadı.'}`, status: 'error' },
          ...prev,
        ]);
      }
    } catch (err: any) {
      setCronLogs((prev) => [
        { timestamp: new Date().toLocaleTimeString('tr-TR'), text: `❌ [${jobName}] Bağlantı Hatası: ${err.message}`, status: 'error' },
        ...prev,
      ]);
    } finally {
      setIsTriggeringCron(null);
    }
  };

  // View: Loading Auth
  if (isCheckingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#04060d]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-400">Yönetici kimliği doğrulanıyor...</span>
        </div>
      </div>
    );
  }

  // View 1: Mobile Lockout Shield (Hardware Rule Enforcement)
  if (!isDesktop) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#05070e] p-6 text-center">
        <div className="max-w-md rounded-3xl border border-red-500/30 bg-gradient-to-b from-[#110d18] to-[#0a0812] p-8 shadow-2xl shadow-red-500/10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 text-3xl text-red-400 border border-red-500/30">
            ⚠️
          </div>
          <span className="inline-block rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-400 uppercase tracking-widest mb-3">
            GÜVENLİK PROTOKOLÜ 403
          </span>
          <h1 className="text-xl font-extrabold text-white mb-2">Yetkisiz Cihaz Tipi</h1>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            StockMind Yönetici Konsolu, kullanıcı yetkilendirmesi ve kritik finansal veritabanı işlemlerini barındırdığı için <strong>mobil ve tablet cihazlara kapalıdır</strong>.
          </p>
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 text-left text-[11px] text-slate-400 space-y-2 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Yalnızca masaüstü tarayıcılardan erişilebilir.
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span> Donanım biyometrik sensörü (Touch ID) gereklidir.
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400">✕</span> Dokunmatik telefon ve tabletler engellenir.
            </div>
          </div>
          <Link
            href="/dashboard"
            className="inline-block w-full rounded-xl bg-slate-800 py-3 text-xs font-bold text-white hover:bg-slate-700 transition"
          >
            ← Standart Uygulama Paneline Dön
          </Link>
        </div>
      </div>
    );
  }

  // View 2: Biometric Hardware Lock Gate
  if (!isBiometricUnlocked) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#04060d] p-6 text-center select-none">
        <div className="relative max-w-lg w-full rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-[#0c1326] via-[#090d1c] to-[#05070e] p-10 shadow-2xl shadow-indigo-500/10 overflow-hidden">
          {/* Ambient Radar Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          {/* Biometric Scanner Visual Icon */}
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping opacity-40" />
            <div className="absolute inset-2 rounded-full border border-indigo-400/40 animate-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600/30 to-cyan-500/30 border border-indigo-400/50 shadow-inner text-4xl">
              <svg className="w-10 h-10 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004 11m0 0a8 8 0 00.957 3.824" />
              </svg>
            </div>
          </div>

          <div className="inline-block rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-1 text-[11px] font-bold text-indigo-300 uppercase tracking-wider mb-3">
            🔒 Biyometrik Donanım Koruması
          </div>

          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-2">
            StockMind Yönetici Konsolu
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Yönetim konsolu sadece yetkili yöneticinin donanım biyometrik verisi (<strong>Touch ID / Face ID / Windows Hello</strong>) ile açılabilir.
          </p>

          <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 text-xs text-left mb-6 space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Yetkili Hesap:</span>
              <span className="font-mono font-bold text-slate-200">{currentUserEmail}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Doğrulama Yöntemi:</span>
              <span className="font-semibold text-emerald-400">FIDO2 / WebAuthn Platform Biyometriği</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Masaüstü Durumu:</span>
              <span className="font-semibold text-emerald-400">Doğrulandı (İş İstasyonu)</span>
            </div>
          </div>

          {biometricError && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {biometricError}
            </div>
          )}

          <button
            type="button"
            onClick={triggerBiometricUnlock}
            disabled={isAuthenticatingBiometric}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 py-3.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-95 transition disabled:opacity-50 cursor-pointer"
          >
            {isAuthenticatingBiometric ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Biyometrik Sensör Bekleniyor...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004 11m0 0a8 8 0 00.957 3.824" />
                </svg>
                <span>Touch ID ile Doğrula ve Konsolu Aç</span>
              </>
            )}
          </button>

          <div className="mt-5 text-[11px] text-slate-500">
            Apple Mac Touch ID veya Windows Hello donanım parmak izinizi doğrulamak için butona tıklayın.
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('stockmind_admin_touchid_cred_id');
                setBiometricError('Kayıtlı biyometrik anahtar temizlendi. Yeni parmak izi tanımlamak için yukarıdaki butona tıklayın.');
              }
            }}
            className="mt-3 text-[11px] text-indigo-400/70 hover:text-indigo-300 underline transition cursor-pointer"
          >
            Farklı veya Yeni Parmak İzi Tanımla
          </button>
        </div>
      </div>
    );
  }

  // View 3: Unlocked Desktop Executive Command Suite
  return (
    <div className="min-h-screen bg-[#04060d] text-slate-200">
      {/* Top Navigation & Status Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b16]/90 backdrop-blur-md px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 font-black text-white shadow-md shadow-indigo-500/20">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white tracking-tight">StockMind Executive Console</span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  CANLI
                </span>
                <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                  <span>🛡️</span> Touch ID Yetkili
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                İş İstasyonu: {currentUserEmail} • {new Date().toLocaleTimeString('tr-TR')} TSI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={lockConsole}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              <span>🔒</span> Paneli Kilitle
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/25 transition"
            >
              <span>🌐</span> Uygulamaya Dön &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl p-6 space-y-6">
        {/* Action Notification Alert */}
        {actionMessage && (
          <div
            className={`flex items-center justify-between rounded-xl border p-4 text-xs animate-fade-in ${
              actionMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="font-bold hover:opacity-75 cursor-pointer ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* System Summary KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          <div className="rounded-2xl border border-white/5 bg-[#0a0f20]/80 p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Toplam Kullanıcı</span>
            <div className="mt-1 text-2xl font-black text-white">{stats?.totalUsers ?? '...'}</div>
            <span className="text-[10px] text-slate-500">Kayıtlı Supabase hesapları</span>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Pro Hesaplar</span>
            <div className="mt-1 text-2xl font-black text-emerald-300">{stats?.proUsers ?? '...'}</div>
            <span className="text-[10px] text-emerald-400/70">
              {stats?.totalUsers ? `%${Math.round((stats.proUsers / stats.totalUsers) * 100)} Pro oranı` : 'Aktif Pro'}
            </span>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Bekleyen Pro Talebi</span>
              {(stats?.pendingRequests ?? 0) > 0 && (
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <div className="mt-1 text-2xl font-black text-amber-300">{stats?.pendingRequests ?? proRequests.length}</div>
            <span className="text-[10px] text-amber-400/70">Onay bekleyen kullanıcı</span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-[#0a0f20]/80 p-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">TEFAS Fon Dizini</span>
            <div className="mt-1 text-2xl font-black text-white">{stats?.dbFundsCount ?? 1051}</div>
            <span className="text-[10px] text-slate-500">Takasbank canlı fon havuzu</span>
          </div>

          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4">
            <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">E-Posta Motoru</span>
            <div className="mt-1 text-xs font-bold text-indigo-200 truncate">
              {stats?.emailServiceMode || 'Resend REST API'}
            </div>
            <span className="text-[10px] text-indigo-400">Cloudflare Edge uyumlu</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span>👥</span> Kullanıcı Yönetimi ({stats?.totalUsers ?? '...'})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span>⭐</span> Pro Talepleri Kuyruğu ({proRequests.length})
            {proRequests.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.2 text-[10px] text-black font-extrabold">
                {proRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('crons')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'crons'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span>⏱️</span> Arka Plan Görevleri & Cron
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span>🛡️</span> Donanım & Biyometri Bilgisi
          </button>
        </div>

        {/* Tab 1: All Users Management */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search and Filter Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="E-posta veya isimle kullanıcı ara..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                {(['all', 'pro', 'pending', 'banned'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setUserFilter(f)}
                    className={`rounded-lg px-3 py-1.5 font-medium transition cursor-pointer ${
                      userFilter === f
                        ? 'bg-white/15 text-white font-bold'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {f === 'all' && 'Tümü'}
                    {f === 'pro' && 'Yalnızca Pro'}
                    {f === 'pending' && 'Bekleyenler'}
                    {f === 'banned' && 'Askıya Alınanlar'}
                  </button>
                ))}
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#070b16]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase text-[10px] tracking-wider">
                    <th className="p-3.5">Kullanıcı</th>
                    <th className="p-3.5">Plan Durumu</th>
                    <th className="p-3.5">Kayıt Tarihi</th>
                    <th className="p-3.5">Son Giriş</th>
                    <th className="p-3.5 text-right">Yönetici Aksiyonları</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Kullanıcılar yükleniyor...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Arama kriterlerine uygun kullanıcı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition">
                        <td className="p-3.5">
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="font-mono text-[11px] text-slate-400">{u.email}</div>
                          <div className="font-mono text-[9px] text-slate-600">{u.id}</div>
                        </td>

                        <td className="p-3.5">
                          {u.isPro ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              ⭐ PRO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
                              STANDART
                            </span>
                          )}
                          {u.proRequestStatus === 'pending' && (
                            <span className="ml-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                              Talep Bekliyor
                            </span>
                          )}
                          {u.isBanned && (
                            <span className="ml-1.5 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-300">
                              Askıda
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                        </td>

                        <td className="p-3.5 text-slate-400">
                          {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString('tr-TR') : 'Hiç girmedi'}
                        </td>

                        <td className="p-3.5 text-right space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePlan(u.id, u.isPro)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                              u.isPro
                                ? 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                            }`}
                          >
                            {u.isPro ? 'Standart Yap' : '⭐ Pro Yap'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUserAction(u.id, 'reset_password')}
                            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                            title="Şifre sıfırlama bağlantısı gönder"
                          >
                            📧 Şifre Sıfırla
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUserAction(u.id, 'purge_metadata')}
                            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                            title="Şişkin JWT avatar metadata temizle"
                          >
                            🧹 Temizle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUserAction(u.id, u.isBanned ? 'unban' : 'ban')}
                            className={`rounded-lg px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                              u.isBanned
                                ? 'border border-emerald-500/30 text-emerald-400'
                                : 'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            }`}
                          >
                            {u.isBanned ? 'Yasağı Aç' : 'Askıya Al'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Pro Requests Queue */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Bekleyen Pro Talepleri</h3>
                <p className="text-xs text-slate-400">
                  Kullanıcıların mobil veya masaüstü uygulamasından gönderdiği onay bekleyen Pro üyelik istekleri.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchOverviewData}
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Yenile
              </button>
            </div>

            {proRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#070b16] p-12 text-center text-slate-500">
                <span className="text-3xl block mb-2">🎉</span>
                Şu anda onay bekleyen Pro üyelik talebi bulunmuyor.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {proRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#12111c] to-[#070b16] p-5 space-y-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{req.name || req.email}</span>
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        PRO TALEBİ
                      </span>
                    </div>

                    <div className="font-mono text-xs text-slate-400">{req.email}</div>

                    {req.requestedAt && (
                      <div className="text-[10px] text-slate-500">
                        Talep Tarihi: {new Date(req.requestedAt).toLocaleString('tr-TR')}
                      </div>
                    )}

                    {req.note && (
                      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3 text-xs italic text-slate-300">
                        "{req.note}"
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleProDecision(req.id, 'approve')}
                        className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-2.5 text-xs font-bold text-white hover:opacity-95 shadow-md shadow-emerald-500/20 transition cursor-pointer"
                      >
                        ✅ Onayla & Pro Yap (Resend Mail Gönder)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleProDecision(req.id, 'reject')}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                      >
                        Reddet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Crons & Automation Control */}
        {activeTab === 'crons' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white">Arka Plan Görevleri (Crons) Denetim Merkezi</h3>
              <p className="text-xs text-slate-400">
                Piyasa saatleri, bülten gönderimleri ve veritabanı temizleme cron görevlerini buradan manuel tetikleyebilirsiniz.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cron 1: TEFAS Sync */}
              <div className="rounded-2xl border border-white/10 bg-[#070b16] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">TEFAS Fon Senkronizasyonu</span>
                  <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                    18:30 Cron
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Takasbank TEFAS API üzerinden 1.051 adet fonun güncel değerlemelerini çeker ve veritabanına yazar.
                </p>
                <button
                  type="button"
                  onClick={() => triggerCronJob('sync-funds')}
                  disabled={Boolean(isTriggeringCron)}
                  className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition disabled:opacity-50 cursor-pointer"
                >
                  {isTriggeringCron === 'sync-funds' ? 'Senkronize Ediliyor...' : '▶️ Şimdi Senkronize Et (25 Fon)'}
                </button>
              </div>

              {/* Cron 2: Daily Report */}
              <div className="rounded-2xl border border-white/10 bg-[#070b16] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Günlük 18:30 Kapanış Bülteni</span>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Resend API
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  BIST ve ons altın canlı piyasa kapanışını hazırlar ve tüm aktif Pro üyelerin e-postalarına iletir.
                </p>
                <button
                  type="button"
                  onClick={() => triggerCronJob('daily-report')}
                  disabled={Boolean(isTriggeringCron)}
                  className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
                >
                  {isTriggeringCron === 'daily-report' ? 'Gönderiliyor...' : '▶️ Bülteni Şimdi Gönder'}
                </button>
              </div>

              {/* Cron 3: Session Purge */}
              <div className="rounded-2xl border border-white/10 bg-[#070b16] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Şişkin Oturum Temizleme</span>
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                    Bakım
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Kullanıcı JWT çerezlerini şişiren base64 fotoğrafları temizleyerek Cloudflare 431 hatasını önler.
                </p>
                <button
                  type="button"
                  onClick={() => triggerCronJob('purge-sessions')}
                  disabled={Boolean(isTriggeringCron)}
                  className="w-full rounded-xl bg-slate-800 py-2 text-xs font-bold text-white hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {isTriggeringCron === 'purge-sessions' ? 'Temizleniyor...' : '▶️ Temizliği Başlat'}
                </button>
              </div>
            </div>

            {/* Terminal Live Output Console */}
            <div className="rounded-2xl border border-white/10 bg-black p-4 font-mono text-xs text-slate-300">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                <span className="text-[11px] font-bold text-slate-400">CANLI CRON YÜRÜTME TERMİNALİ</span>
                <button
                  type="button"
                  onClick={() => setCronLogs([])}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Temizle
                </button>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {cronLogs.length === 0 ? (
                  <span className="text-slate-600">Henüz manuel cron tetiklenmedi. Çıktılar burada görüntülenecektir.</span>
                ) : (
                  cronLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.status === 'success'
                          ? 'text-emerald-400'
                          : log.status === 'error'
                          ? 'text-red-400'
                          : 'text-slate-400'
                      }
                    >
                      <span className="text-slate-600 mr-2">[{log.timestamp}]</span>
                      {log.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Security & Hardware Biometrics info */}
        {activeTab === 'stats' && (
          <div className="max-w-3xl space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#070b16] p-6 space-y-4">
              <h3 className="text-sm font-bold text-white">Donanım ve Biyometrik Doğrulama Protokolü</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bu konsol, StockMind Güvenlik Standartları uyarınca çok katmanlı donanım korumasına sahiptir:
              </p>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 space-y-1">
                  <div className="font-bold text-indigo-300">1. Donanım Biyometriği (Apple Touch ID / Windows Hello)</div>
                  <div className="text-slate-400 text-[11px]">
                    FIDO2 ve Web Authentication API (WebAuthn) üzerinden parmak izi kriptografik olarak cihazınızın Secure Enclave donanımında saklanır ve doğrulanır.
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 space-y-1">
                  <div className="font-bold text-indigo-300">2. Masaüstü Donanım Sınırı</div>
                  <div className="text-slate-400 text-[11px]">
                    Mobil veya tablet ekranlarından (veya User-Agent'larından) yapılan tüm istekler sunucu ve istemci tarafında engellenir.
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 space-y-1">
                  <div className="font-bold text-indigo-300">3. Oturum Güvenliği</div>
                  <div className="text-slate-400 text-[11px]">
                    Biyometrik oturum tarayıcı kapatıldığında sıfırlanır; "Paneli Kilitle" butonuyla anında kapatılabilir.
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('stockmind_admin_touchid_cred_id');
                    sessionStorage.removeItem('stockmind_admin_biometric_unlocked');
                    setIsBiometricUnlocked(false);
                  }}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                >
                  Biyometrik Eşleşmeyi Sıfırla ve Yeniden Kilitle
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
