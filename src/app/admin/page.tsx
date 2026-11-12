'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ApplicationLogsPanel } from '@/components/admin/ApplicationLogsPanel';

interface AdminStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  pendingRequests: number;
  dbFundsCount: number;
  directoryFundsCount: number;
  emailServiceMode: string;
  emailDiagnostics?: {
    mode: 'gmail' | 'resend' | 'brevo' | 'smtp' | 'unconfigured';
    gmailOnly: boolean;
    configured: boolean;
    senderAddress: string;
    expectedGmailSender: string;
    senderMatchesExpectedGmail: boolean;
  };
  emailQueueSummary?: {
    pending: number;
    processing: number;
    accepted: number;
    failed: number;
    retryScheduled: number;
    total: number;
    bulletinDate: string;
    available: boolean;
    recentItems?: Array<{
      recipient_email: string;
      status: string;
      attempt_count: number;
      last_error?: string | null;
      updated_at?: string;
    }>;
  };
  bulletinScheduleSummary?: {
    available: boolean;
    latestRun: {
      bulletinDate: string;
      scheduledFor: string;
      startedAt: string;
      finishedAt: string | null;
      durationMs: number | null;
      scheduleDelayMs: number | null;
      status: string;
      recipientsCount: number;
      successfulCount: number;
    } | null;
    missedDates: string[];
    missedCount: number;
  };
  providerHealthSummary?: {
    generatedAt: string;
    overallStatus: 'healthy' | 'degraded' | 'unknown';
    channels: Record<
      'stocks' | 'funds' | 'news' | 'alerts',
      {
        channel: string;
        label: string;
        status: 'healthy' | 'degraded' | 'unknown';
        lastSuccessAt: string | null;
        lastProvider: string | null;
        lastErrorAt: string | null;
        lastErrorCode: string | null;
        lastErrorSummary: string | null;
        successCount: number;
        errorCount: number;
      }
    >;
    bulletin: {
      status: 'on_time' | 'delayed' | 'missed' | 'no_runs';
      latestBulletinDate: string | null;
      scheduleDelayMs: number | null;
      durationMs: number | null;
      missedCount: number;
      missedDates: string[];
    };
    recentAlertErrors: Array<{
      at: string;
      code: string;
      summary: string;
    }>;
  };
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
  const [isMfaVerified, setIsMfaVerified] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [isAuthenticatingBiometric, setIsAuthenticatingBiometric] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpQr, setTotpQr] = useState('');
  const [totpSecret, setTotpSecret] = useState('');

  // Tab & Console State
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'crons' | 'stats' | 'logs'>('users');
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
  const [isVerifyingGmail, setIsVerifyingGmail] = useState(false);

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
        const response = await fetch('/api/admin/session', { cache: 'no-store' });
        if (!response.ok) {
          router.replace('/not-found');
          return;
        }
        const session = await response.json();
        setCurrentUserEmail(session.email);
        setIsMfaVerified(session.mfaVerified === true);
      } catch (err) {
        console.error('Admin check error:', err);
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkAdminUser();
  }, [router, supabase]);

  // The Auth service creates challenges and verifies signatures/codes. Only an
  // independently verified AAL2 session can call the administrative APIs.
  const confirmAdminMfa = async () => {
    const response = await fetch('/api/admin/session', { cache: 'no-store' });
    const session = await response.json();
    if (!response.ok || session.mfaVerified !== true) throw new Error('Sunucu ikinci faktörü doğrulayamadı.');
    setIsMfaVerified(true);
    setTotpQr('');
    setTotpSecret('');
    setTotpCode('');
  };

  const triggerBiometricUnlock = async () => {
    setIsAuthenticatingBiometric(true);
    setBiometricError(null);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factor = data.all.find((f) => f.factor_type === 'webauthn' && f.status === 'verified');
      const result = factor
        ? await supabase.auth.mfa.webauthn.authenticate({ factorId: factor.id })
        : await supabase.auth.mfa.webauthn.register({ friendlyName: 'StockMind Yönetici' });
      if (result.error) throw result.error;
      await confirmAdminMfa();
    } catch {
      setBiometricError('Biyometrik doğrulama tamamlanamadı. Tekrar deneyin veya doğrulama uygulamasını kullanın.');
    } finally {
      setIsAuthenticatingBiometric(false);
    }
  };

  const prepareTotp = async () => {
    setIsAuthenticatingBiometric(true);
    setBiometricError(null);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factor = data.totp.find((f) => f.status === 'verified');
      if (factor) {
        setMfaFactorId(factor.id);
      } else {
        const enrolled = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `StockMind-${Date.now()}` });
        if (enrolled.error) throw enrolled.error;
        setMfaFactorId(enrolled.data.id);
        setTotpQr(enrolled.data.totp.qr_code);
        setTotpSecret(enrolled.data.totp.secret);
      }
    } catch {
      setBiometricError('İkinci faktör hazırlanamadı. Hesap doğrulama ayarlarını kontrol edin.');
    } finally {
      setIsAuthenticatingBiometric(false);
    }
  };

  const verifyTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsAuthenticatingBiometric(true);
    setBiometricError(null);
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: totpCode });
      if (result.error) throw result.error;
      await confirmAdminMfa();
    } catch {
      setBiometricError('Doğrulama kodu kabul edilmedi. Güncel kodla tekrar deneyin.');
    } finally {
      setIsAuthenticatingBiometric(false);
    }
  };

  const lockConsole = async () => {
    setIsMfaVerified(false);
    setStats(null);
    setUsers([]);
    setProRequests([]);
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/login');
  };

  // 4. Fetch System Data once unlocked
  const fetchOverviewData = useCallback(async () => {
    if (!isMfaVerified) return;

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
  }, [isMfaVerified]);

  const fetchUsers = useCallback(async () => {
    if (!isMfaVerified) return;
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
  }, [isMfaVerified, page, searchQuery, userFilter]);

  useEffect(() => {
    if (isMfaVerified) {
      fetchOverviewData();
      fetchUsers();
    }
  }, [isMfaVerified, fetchOverviewData, fetchUsers]);

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
          { timestamp: new Date().toLocaleTimeString('tr-TR'), text: `❌ [${jobName}] HATA: ${data.error || data.message || 'Görev tamamlanamadı.'}`, status: 'error' },
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
      void fetchOverviewData();
    }
  };

  const handleVerifyGmailSender = async () => {
    setIsVerifyingGmail(true);
    setCronLogs((prev) => [
      { timestamp: new Date().toLocaleTimeString('tr-TR'), text: '[gmail-verify] Yetkili test e-postası gönderiliyor...', status: 'info' },
      ...prev,
    ]);
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDailyReport: false }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCronLogs((prev) => [
          {
            timestamp: new Date().toLocaleTimeString('tr-TR'),
            text: `✅ [gmail-verify] Gönderen: ${data.from || data.senderAddress || 'bilinmiyor'} · Yöntem: ${data.method || 'smtp'} · Kabul: ${(data.accepted || []).join(', ') || 'alıcı'}`,
            status: 'success',
          },
          ...prev,
        ]);
      } else {
        setCronLogs((prev) => [
          { timestamp: new Date().toLocaleTimeString('tr-TR'), text: `❌ [gmail-verify] ${data.error || data.message || 'Doğrulama başarısız.'}`, status: 'error' },
          ...prev,
        ]);
      }
    } catch (err: any) {
      setCronLogs((prev) => [
        { timestamp: new Date().toLocaleTimeString('tr-TR'), text: `❌ [gmail-verify] Bağlantı hatası: ${err.message}`, status: 'error' },
        ...prev,
      ]);
    } finally {
      setIsVerifyingGmail(false);
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

  // View 1: Mobile Friendly Desktop Requirement Information
  if (!isDesktop) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-primary p-6 text-center">
        <div className="max-w-md w-full rounded-3xl border border-border bg-card/90 p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

          {/* Desktop Screen Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/25 shadow-sm">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
            </svg>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold mb-3">
            <span>💻 Masaüstü Konsolu</span>
          </div>

          <h1 className="text-xl font-bold text-text-primary mb-2">
            Masaüstü Cihaz Gerekli
          </h1>

          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed mb-6">
            StockMind Yönetici Konsolu; geniş veri tabloları, kullanıcı denetimi ve biyometrik donanım sensörü (Touch ID / Windows Hello) gerektirdiğinden yalnızca masaüstü tarayıcılarda çalışacak şekilde optimize edilmiştir.
          </p>

          <div className="rounded-2xl border border-border bg-bg-secondary/60 p-4 text-left text-xs text-text-muted space-y-2.5 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>Mac veya Windows bilgisayarınızın tarayıcısından bağlanabilirsiniz.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-accent font-bold">✓</span>
              <span>Giriş sırasında ikinci faktörle doğrulanır.</span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-accent text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-accent/20 hover:opacity-90 transition-all cursor-pointer"
          >
            <span>← Uygulama Paneline Dön</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!isMfaVerified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#04060d] p-6 text-slate-200">
        <div className="w-full max-w-lg space-y-5 rounded-3xl border border-indigo-500/30 bg-slate-900 p-8">
          <h1 className="text-xl font-bold">Yönetici doğrulaması</h1>
          <p className="text-sm text-slate-300">{currentUserEmail} hesabını ikinci faktörle doğrulayın.</p>
          <button type="button" onClick={triggerBiometricUnlock} disabled={isAuthenticatingBiometric}
            className="w-full rounded-xl bg-indigo-600 p-3 font-semibold disabled:opacity-50">
            Biyometrik anahtarla doğrula
          </button>
          <button type="button" onClick={prepareTotp} disabled={isAuthenticatingBiometric}
            className="w-full rounded-xl border border-slate-500 p-3 disabled:opacity-50">
            Doğrulama uygulaması kullan
          </button>
          {mfaFactorId && (
            <form onSubmit={verifyTotp} className="space-y-3">
              {totpQr && <img src={totpQr} alt="Doğrulama uygulaması için kurulum QR kodu" className="mx-auto h-48 w-48 bg-white" />}
              {totpSecret && <p className="break-all text-sm">QR kodu tarayın veya kurulum anahtarını girin: <code>{totpSecret}</code></p>}
              <label htmlFor="admin-mfa-code" className="block text-sm">Altı haneli doğrulama kodu</label>
              <input id="admin-mfa-code" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required
                className="w-full rounded-lg border border-slate-500 bg-slate-950 p-3" />
              <button disabled={isAuthenticatingBiometric || totpCode.length !== 6} className="w-full rounded-xl bg-indigo-600 p-3 disabled:opacity-50">Doğrula</button>
            </form>
          )}
          {biometricError && <p role="alert" className="text-sm text-red-300">{biometricError}</p>}
          <Link href="/dashboard" className="block text-sm underline">Uygulamaya dön</Link>
        </div>
      </main>
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
                  <span>🛡️</span> MFA Doğrulandı
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
              <span>🔒</span> Oturumu Kapat
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

          <button type="button" onClick={() => setActiveTab('logs')}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab === 'logs' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
            Uygulama Logları
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

        {activeTab === 'logs' && <ApplicationLogsPanel />}

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
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white text-sm">Günlük 18:30 Kapanış Bülteni</span>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {stats?.emailDiagnostics?.mode === 'gmail' ? 'Gmail SMTP' : (stats?.emailServiceMode || 'E-posta Servisi')}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  BIST ve ons altın canlı piyasa kapanışını hazırlar ve tüm aktif Pro üyelerin e-postalarına iletir. Gönderen:{' '}
                  <span className="font-mono text-slate-200">{stats?.emailDiagnostics?.senderAddress || stats?.adminEmail || 'kaanrmak7@gmail.com'}</span>
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => triggerCronJob('daily-report')}
                    disabled={Boolean(isTriggeringCron)}
                    className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isTriggeringCron === 'daily-report' ? 'Gönderiliyor...' : '▶️ Bülteni Şimdi Gönder'}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyGmailSender}
                    disabled={isVerifyingGmail}
                    className="w-full rounded-xl border border-white/15 bg-white/5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isVerifyingGmail ? 'Doğrulanıyor...' : '✉️ Gönderici Test E-postası Gönder'}
                  </button>
                </div>
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

            {/* E-posta Teslimat Kuyruğu & Durum Sayaçları */}
            <div data-testid="email-delivery-counters" className="rounded-2xl border border-white/10 bg-[#070b16] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">E-posta Gönderim Kuyruğu Sonuçları</h4>
                  <p className="text-[11px] text-slate-400">
                    Bülten tarihi: {stats?.emailQueueSummary?.bulletinDate || 'Bugün'} · Kalıcı durum sayaçları
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchOverviewData}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 transition cursor-pointer"
                >
                  Sayaçları Yenile
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
                  <p className="text-[11px] text-slate-400 font-semibold">Bekleyen</p>
                  <p data-testid="counter-pending" className="text-xl font-black text-slate-200 mt-0.5">
                    {stats?.emailQueueSummary?.pending ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-[11px] text-emerald-300 font-semibold">Kabul Edilen</p>
                  <p data-testid="counter-accepted" className="text-xl font-black text-emerald-400 mt-0.5">
                    {stats?.emailQueueSummary?.accepted ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <p className="text-[11px] text-rose-300 font-semibold">Başarısız</p>
                  <p data-testid="counter-failed" className="text-xl font-black text-rose-400 mt-0.5">
                    {stats?.emailQueueSummary?.failed ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-[11px] text-amber-300 font-semibold">Yeniden Denenecek</p>
                  <p data-testid="counter-retry-scheduled" className="text-xl font-black text-amber-400 mt-0.5">
                    {stats?.emailQueueSummary?.retryScheduled ?? 0}
                  </p>
                </div>
              </div>

              {(stats?.emailQueueSummary?.processing ?? 0) > 0 && (
                <p role="status" className="text-xs text-amber-300">
                  İşleniyor veya teslimat doğrulaması bekliyor: {stats?.emailQueueSummary?.processing}.
                  Kesilen gönderimler tekrar gönderilmeden önce sağlayıcı kayıtlarından kontrol edilmelidir.
                </p>
              )}

              {stats?.emailQueueSummary && !stats.emailQueueSummary.available && (
                <p className="text-[11px] text-amber-400/90">
                  Kalıcı kuyruk tablosu henüz etkinleştirilmedi veya bugün için kayıt bulunmuyor.
                </p>
              )}

              {stats?.emailQueueSummary?.recentItems && stats.emailQueueSummary.recentItems.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/10 max-h-40 overflow-y-auto text-[11px]">
                  {stats.emailQueueSummary.recentItems.slice(0, 8).map((item) => (
                    <div key={item.recipient_email} className="flex items-center justify-between gap-2 text-slate-300">
                      <span className="font-mono truncate">{item.recipient_email}</span>
                      <span className="shrink-0 text-slate-400">
                        {item.status} ({item.attempt_count} deneme)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Zamanlanmış Bülten Gecikme & Kaçan Çalıştırma İzleme */}
            <div data-testid="bulletin-schedule-monitor" className="rounded-2xl border border-white/10 bg-[#070b16] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Zamanlanmış Bülten Gecikme &amp; Kaçan Çalıştırma İzleme</h4>
                  <p className="text-[11px] text-slate-400">
                    Planlanan (18:30 TSİ), başlama zamanı, dağıtım süresi ve kaçan iş günü kayıtları
                  </p>
                </div>
                <span
                  data-testid="bulletin-missed-badge"
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    (stats?.bulletinScheduleSummary?.missedCount ?? 0) > 0
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {(stats?.bulletinScheduleSummary?.missedCount ?? 0) > 0
                    ? `${stats?.bulletinScheduleSummary?.missedCount} Kaçan Çalıştırma`
                    : 'Kaçan Çalıştırma Yok'}
                </span>
              </div>

              {stats?.bulletinScheduleSummary?.latestRun ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
                    <p className="text-[11px] text-slate-400">Planlanan Zaman</p>
                    <p className="font-mono font-semibold text-white mt-0.5">
                      {new Date(stats.bulletinScheduleSummary.latestRun.scheduledFor).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
                    <p className="text-[11px] text-slate-400">Başlama Zamanı</p>
                    <p className="font-mono font-semibold text-white mt-0.5">
                      {new Date(stats.bulletinScheduleSummary.latestRun.startedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
                    <p className="text-[11px] text-slate-400">Planlama Gecikmesi</p>
                    <p className="font-mono font-semibold text-amber-300 mt-0.5">
                      {stats.bulletinScheduleSummary.latestRun.scheduleDelayMs != null
                        ? `${(stats.bulletinScheduleSummary.latestRun.scheduleDelayMs / 1000).toFixed(1)} sn`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3">
                    <p className="text-[11px] text-slate-400">Dağıtım Süresi</p>
                    <p className="font-mono font-semibold text-emerald-300 mt-0.5">
                      {stats.bulletinScheduleSummary.latestRun.durationMs != null
                        ? `${(stats.bulletinScheduleSummary.latestRun.durationMs / 1000).toFixed(2)} sn`
                        : 'Devam ediyor'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Henüz kaydedilmiş zamanlanmış bülten çalıştırması bulunmuyor.
                </p>
              )}

              {(stats?.bulletinScheduleSummary?.missedDates?.length ?? 0) > 0 && (
                <p className="text-xs text-rose-300 font-mono">
                  Kaçan günler: {stats?.bulletinScheduleSummary?.missedDates.join(', ')}
                </p>
              )}
            </div>

            {/* Provider & Background Task Health Board (OPS-11) */}
            <div
              data-testid="provider-health-board"
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Sağlayıcı &amp; Görev Durum Panosu</h4>
                  <p className="text-[11px] text-slate-400">
                    Son başarılı hisse, fon ve haber alımı ile bülten gecikmesi ve alarm hatalarının hassas veri içermeyen izlemesi
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    stats?.providerHealthSummary?.overallStatus === 'degraded'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : stats?.providerHealthSummary?.overallStatus === 'healthy'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-500/15 text-slate-300 border-slate-500/30'
                  }`}
                >
                  {stats?.providerHealthSummary?.overallStatus === 'degraded'
                    ? 'Kesinti / Gecikme Var'
                    : stats?.providerHealthSummary?.overallStatus === 'healthy'
                      ? 'Tüm Kanallar Sağlıklı'
                      : 'Veri Bekleniyor'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {(['stocks', 'funds', 'news', 'alerts'] as const).map((channelKey) => {
                  const ch = stats?.providerHealthSummary?.channels?.[channelKey];
                  const badgeStyle =
                    ch?.status === 'degraded'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : ch?.status === 'healthy'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-500/15 text-slate-300 border-slate-500/30';
                  return (
                    <div key={channelKey} className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">{ch?.label || channelKey.toUpperCase()}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${badgeStyle}`}>
                          {ch?.status === 'degraded' ? 'Sorunlu' : ch?.status === 'healthy' ? 'Sağlıklı' : 'Beklemede'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Son Başarılı:{' '}
                        <span className="text-slate-200 font-mono">
                          {ch?.lastSuccessAt
                            ? new Date(ch.lastSuccessAt).toLocaleString('tr-TR', {
                                timeZone: 'Europe/Istanbul',
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : 'Henüz yok'}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Başarı / Hata: <span className="text-emerald-300 font-mono">{ch?.successCount ?? 0}</span> /{' '}
                        <span className="text-rose-300 font-mono">{ch?.errorCount ?? 0}</span>
                      </p>
                      {ch?.lastErrorSummary && (
                        <p className="text-[11px] text-rose-300 truncate" title={ch.lastErrorSummary}>
                          Son Hata ({ch.lastErrorCode}): {ch.lastErrorSummary}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {(stats?.providerHealthSummary?.recentAlertErrors?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-1 text-[11px]">
                  <p className="font-semibold text-rose-300">Son Alarm Değerlendirme Hataları (Maskelenmiş)</p>
                  {stats?.providerHealthSummary?.recentAlertErrors.slice(0, 4).map((err, idx) => (
                    <p key={idx} className="text-slate-300 font-mono">
                      [{new Date(err.at).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}] {err.code}: {err.summary}
                    </p>
                  ))}
                </div>
              )}
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
              <h3 className="text-sm font-bold text-white">Yönetici Doğrulama Protokolü</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Bu konsol, StockMind Güvenlik Standartları uyarınca çok katmanlı donanım korumasına sahiptir:
              </p>

              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 space-y-1">
                  <div className="font-bold text-indigo-300">1. Sunucuda doğrulanan ikinci faktör</div>
                  <div className="text-slate-400 text-[11px]">
                    Biyometrik anahtar veya doğrulama uygulaması Auth servisi tarafından doğrulanır. Yönetim API’leri imzası doğrulanmış AAL2 oturumu ister.
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 space-y-1">
                  <div className="font-bold text-indigo-300">2. Masaüstü görünümü</div>
                  <div className="text-slate-400 text-[11px]">
                    Masaüstü kullanım tercihi cihaz başlıklarıyla uygulanır; güvenlik yetkisi yönetici kimliğine ve ikinci faktöre dayanır.
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3.5 space-y-1">
                  <div className="font-bold text-indigo-300">3. Oturum Güvenliği</div>
                  <div className="text-slate-400 text-[11px]">
                    Oturumu Kapat düğmesi bu cihazdaki Auth oturumunu sonlandırır.
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={lockConsole}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                >
                  Yönetici oturumunu kapat
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
