'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, Input, Badge, useToast } from '@/components/ui';
import { AVAILABLE_MODELS } from '@/lib/ai/openrouter';
import { useAuth } from '@/hooks/useAuth';

export default function SettingsPage() {
  const { showToast } = useToast();
  const { user, profile, loading: authLoading, updateProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [currency, setCurrency] = useState('TRY');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('google/gemma-4-31b-it:free');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [dailyReportEnabled, setDailyReportEnabled] = useState(true);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingDailyReport, setSendingDailyReport] = useState(false);
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);

  const userKey = user?.id ? `user_${user.id}` : 'guest';

  // Load user settings
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFullName(profile?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      if (profile?.preferredLanguage) setLanguage(profile.preferredLanguage);
      if (profile?.preferredCurrency) setCurrency(profile.preferredCurrency);
    } else {
      setEmail('misafir@stockmind.app');
      setFullName('Misafir Kullanıcı');
    }

    // Load AI & notification preferences per user
    try {
      const rawSettings = localStorage.getItem(`stockmind_settings_${userKey}`);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.openRouterKey !== undefined) setOpenRouterKey(parsed.openRouterKey);
        if (parsed.defaultModel) setDefaultModel(parsed.defaultModel);
        if (parsed.emailAlerts !== undefined) setEmailAlerts(parsed.emailAlerts);
        if (parsed.priceAlerts !== undefined) setPriceAlerts(parsed.priceAlerts);
        if (parsed.dailyReportEnabled !== undefined) setDailyReportEnabled(parsed.dailyReportEnabled);
      }
    } catch (e) {
      console.warn('Failed to load local user settings:', e);
    }
  }, [user, profile, userKey]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      if (user) {
        const success = await updateProfile({
          fullName: fullName.trim(),
          preferredLanguage: language,
          preferredCurrency: currency,
        });

        if (success) {
          showToast({
            type: 'success',
            title: 'Profil Güncellendi',
            message: 'Profil ve para birimi tercihleriniz hesabınıza kaydedildi.',
          });
        } else {
          showToast({
            type: 'warning',
            title: 'Kayıt Yapıldı',
            message: 'Bilgiler yerel olarak güncellendi.',
          });
        }
      } else {
        // Guest mode
        showToast({
          type: 'info',
          title: 'Misafir Ayarları Kaydedildi',
          message: 'Tercihleriniz bu tarayıcı için kaydedildi. Kalıcı hesap için giriş yapabilirsiniz.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: err.message || 'Profil güncellenirken bir hata oluştu.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAIConfig = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existing = localStorage.getItem(`stockmind_settings_${userKey}`);
      const parsed = existing ? JSON.parse(existing) : {};
      const updated = {
        ...parsed,
        openRouterKey: openRouterKey.trim(),
        defaultModel,
      };
      localStorage.setItem(`stockmind_settings_${userKey}`, JSON.stringify(updated));

      showToast({
        type: 'success',
        title: 'AI Ayarları Kaydedildi',
        message: 'OpenRouter API anahtarınız ve tercih ettiğiniz model hesabınıza kaydedildi.',
      });
    } catch (e) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: 'Ayarlar kaydedilemedi.',
      });
    }
  };

  const handleSaveNotificationPreferences = (newPrice: boolean, newEmail: boolean, newDaily: boolean) => {
    setPriceAlerts(newPrice);
    setEmailAlerts(newEmail);
    setDailyReportEnabled(newDaily);

    try {
      const existing = localStorage.getItem(`stockmind_settings_${userKey}`);
      const parsed = existing ? JSON.parse(existing) : {};
      const updated = {
        ...parsed,
        priceAlerts: newPrice,
        emailAlerts: newEmail,
        dailyReportEnabled: newDaily,
      };
      localStorage.setItem(`stockmind_settings_${userKey}`, JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
  };

  const handleTriggerDailyReport = async () => {
    const targetEmail = email || user?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast({
        type: 'danger',
        title: 'Geçersiz E-posta',
        message: 'Lütfen geçerli bir e-posta adresi girin.',
      });
      return;
    }

    setSendingDailyReport(true);
    try {
      const res = await fetch(
        `/api/cron/daily-report?email=${encodeURIComponent(targetEmail)}&name=${encodeURIComponent(
          fullName || 'Yatırımcı'
        )}`
      );
      const data = await res.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: '18:30 Bülteni Gönderildi! 📬',
          message: `Günlük piyasa kapanış ve portföy bülteni ${targetEmail} (${fullName}) adresine gönderildi.`,
        });
        if (data.emailResult?.previewUrl) {
          setEmailPreviewUrl(data.emailResult.previewUrl);
        }
      } else {
        showToast({
          type: 'danger',
          title: 'Bülten Gönderilemedi',
          message: data.error || 'Günlük bülten iletilemedi.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: err.message || 'Sunucuya bağlanılamadı.',
      });
    } finally {
      setSendingDailyReport(false);
    }
  };

  const handleSendTestEmail = async () => {
    const targetEmail = email || user?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast({
        type: 'danger',
        title: 'Geçersiz E-posta',
        message: 'Lütfen geçerli bir e-posta adresi girin.',
      });
      return;
    }

    setSendingEmail(true);
    setEmailPreviewUrl(null);

    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          userName: fullName || 'StockMind Yatırımcısı',
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'E-posta Gönderildi! 📨',
          message: data.message || `Test e-postası ${targetEmail} adresine iletildi.`,
        });
        if (data.previewUrl) {
          setEmailPreviewUrl(data.previewUrl);
        }
      } else {
        showToast({
          type: 'danger',
          title: 'Gönderim Başarısız',
          message: data.message || data.error || 'E-posta gönderilemedi.',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: err.message || 'Sunucuya bağlanılamadı.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const userInitial = (fullName || user?.email || 'M').charAt(0).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Kullanıcı & Sistem Ayarları</h1>
        <p className="text-text-secondary text-sm mt-1">
          Hesabınıza özel profil bilgilerini, para birimi tercihlerinizi ve OpenRouter AI API ayarlarınızı yapılandırın.
        </p>
      </div>

      {/* Guest vs Logged in Account Banner */}
      {!user ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <p className="text-sm font-bold text-amber-400">Misafir Modundasınız</p>
              <p className="text-xs text-text-muted">
                Portföy ve ayarlarınız sadece bu tarayıcıda saklanır. Tüm cihazlarınızdan erişmek ve verilerinizi yedeklemek için hesap açın.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="primary" size="sm">
                Giriş Yap / Kayıt Ol
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-emerald-400">Kişisel Hesabınızdasınız</p>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Özel Portföy & Ayarlar Aktif
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Giriş Yapılan E-posta: <strong className="text-text-primary">{user.email}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-text-primary">Profil Bilgileri</h3>
            <p className="text-xs text-text-muted">Kişisel bilgilerinizi ve tercih ettiğiniz para birimini güncelleyin.</p>
          </div>
          <Badge variant="purple" size="sm">
            {user ? 'Kişisel Hesap' : 'Misafir Profil'}
          </Badge>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent to-accent-secondary flex items-center justify-center font-bold text-2xl text-white shadow-lg shadow-accent/20">
              {userInitial}
            </div>
            <div>
              <h4 className="text-sm font-bold text-text-primary">{fullName || 'Kullanıcı'}</h4>
              <p className="text-xs text-text-muted">{email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ad Soyad"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Örn: Ahmet Yılmaz"
              required
            />
            <Input
              label="E-posta Adresi"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!user}
              helperText={user ? 'Kayıtlı e-posta adresi güvenlik nedeniyle sabittir.' : undefined}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Tercih Edilen Dil</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full bg-bg-input text-text-primary text-sm rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none"
              >
                <option value="tr">🇹🇷 Türkçe (Turkish)</option>
                <option value="en">🇬🇧 English (İngilizce)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Varsayılan Para Birimi</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-bg-input text-text-primary text-sm rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none"
              >
                <option value="TRY">₺ Türk Lirası (TRY)</option>
                <option value="USD">$ Amerikan Doları (USD)</option>
                <option value="EUR">€ Euro (EUR)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={isSavingProfile}>
              {isSavingProfile ? 'Kaydediliyor...' : 'Profili Kaydet'}
            </Button>
          </div>
        </form>
      </div>

      {/* OpenRouter AI Settings Card */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-text-primary">OpenRouter AI Entegrasyonu</h3>
            <p className="text-xs text-text-muted">Hesabınıza özel OpenRouter API anahtarınızı tanımlayın veya varsayılan modeli seçin.</p>
          </div>
          <Badge variant="success" size="sm">
            AI Hazır
          </Badge>
        </div>

        <form onSubmit={handleSaveAIConfig} className="space-y-4">
          <Input
            label="OpenRouter API Anahtarı (Opsiyonel)"
            type="password"
            placeholder="sk-or-v1-xxxxxxxx..."
            value={openRouterKey}
            onChange={(e) => setOpenRouterKey(e.target.value)}
            helperText="Boş bırakılırsa sistemin yerleşik analiz motoru kullanılır."
          />

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Varsayılan AI Modeli</label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full bg-bg-input text-text-primary text-sm rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary">
              AI Ayarlarını Kaydet
            </Button>
          </div>
        </form>
      </div>

      {/* Notifications Preferences */}
      <div className="glass-card p-6 space-y-4">
        <div className="pb-3 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-text-primary">Bildirim Tercihleri</h3>
            <p className="text-xs text-text-muted">Fiyat alarmları ve her gün 18:30 piyasa kapanış bülteni.</p>
          </div>
          <Badge variant="success" size="sm">
            Zamanlanmış Servis Aktif
          </Badge>
        </div>

        <div className="space-y-3">
          {/* Daily 18:30 Report Box */}
          <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary">⏰ Günlük Piyasa Kapanış Raporu (Her Gün 18:30)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success border border-success/30">
                  Her Gün 18:30
                </span>
              </div>
              <p className="text-xs text-text-muted">
                Borsa İstanbul, Altın, Döviz ve Kripto kapanış fiyatları ile portföy getiri analizi <strong className="text-text-primary">{fullName || 'Kullanıcı'} ({email})</strong> adresine otomatik gönderilir.
              </p>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={sendingDailyReport}
                onClick={handleTriggerDailyReport}
                leftIcon={
                  sendingDailyReport ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )
                }
              >
                {sendingDailyReport ? 'Gönderiliyor...' : '18:30 Raporunu Şimdi Gönder'}
              </Button>
              <input
                type="checkbox"
                checked={dailyReportEnabled}
                onChange={(e) =>
                  handleSaveNotificationPreferences(priceAlerts, emailAlerts, e.target.checked)
                }
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </div>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-text-primary block">Fiyat Alarmları Bildirimi</span>
              <span className="text-xs text-text-muted">Watchlist'teki hedef fiyatlara ulaşıldığında anlık uyarı al.</span>
            </div>
            <input
              type="checkbox"
              checked={priceAlerts}
              onChange={(e) =>
                handleSaveNotificationPreferences(e.target.checked, emailAlerts, dailyReportEnabled)
              }
              className="w-4 h-4 accent-accent rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer">
            <div>
              <span className="text-sm font-semibold text-text-primary block">Haftalık Portföy Özeti E-postası</span>
              <span className="text-xs text-text-muted">Her Pazartesi portföy getiri analizi ve bülteni al.</span>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) =>
                handleSaveNotificationPreferences(priceAlerts, e.target.checked, dailyReportEnabled)
              }
              className="w-4 h-4 accent-accent rounded"
            />
          </label>
        </div>
      </div>

      {/* Test Email Dispatcher Card */}
      <div className="glass-card p-6 space-y-4">
        <div className="pb-3 border-b border-border/60 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-text-primary">E-posta Bildirim Testi</h3>
            <p className="text-xs text-text-muted">Canlı piyasa ve portföy bülteni formatında test e-postası tetikleyin.</p>
          </div>
          <Badge variant="purple" size="sm">
            E-posta Servisi
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              label="Alıcı E-posta"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@domain.com"
              required
            />
          </div>
          <div className="sm:self-end w-full sm:w-auto">
            <Button
              type="button"
              variant="primary"
              disabled={sendingEmail}
              onClick={handleSendTestEmail}
              leftIcon={
                sendingEmail ? (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )
              }
            >
              {sendingEmail ? 'Gönderiliyor...' : 'Test Maili Gönder'}
            </Button>
          </div>
        </div>

        {emailPreviewUrl && (
          <div className="p-3 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-between text-xs animate-fade-in">
            <span className="text-text-primary">E-posta başarıyla oluşturuldu! Canlı önizlemeyi görüntüleyebilirsiniz:</span>
            <a
              href={emailPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent font-bold hover:underline inline-flex items-center gap-1"
            >
              <span>Önizle</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
