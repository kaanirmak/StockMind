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
  const [notificationEmail, setNotificationEmail] = useState('');
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [currency, setCurrency] = useState('TRY');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('google/gemma-4-31b-it:free');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [dailyReportEnabled, setDailyReportEnabled] = useState(true);

  // Custom SMTP Configuration
  const [useCustomSmtp, setUseCustomSmtp] = useState(false);
  const [smtpService, setSmtpService] = useState('gmail');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmailSettings, setIsSavingEmailSettings] = useState(false);
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
        if (parsed.notificationEmail) setNotificationEmail(parsed.notificationEmail);
        else if (user?.email) setNotificationEmail(user.email);

        if (parsed.openRouterKey !== undefined) setOpenRouterKey(parsed.openRouterKey);
        if (parsed.defaultModel) setDefaultModel(parsed.defaultModel);
        if (parsed.emailAlerts !== undefined) setEmailAlerts(parsed.emailAlerts);
        if (parsed.priceAlerts !== undefined) setPriceAlerts(parsed.priceAlerts);
        if (parsed.dailyReportEnabled !== undefined) setDailyReportEnabled(parsed.dailyReportEnabled);

        // SMTP
        if (parsed.useCustomSmtp !== undefined) setUseCustomSmtp(parsed.useCustomSmtp);
        if (parsed.smtpService) setSmtpService(parsed.smtpService);
        if (parsed.smtpHost) setSmtpHost(parsed.smtpHost);
        if (parsed.smtpPort) setSmtpPort(parsed.smtpPort);
        if (parsed.smtpUser) setSmtpUser(parsed.smtpUser);
        if (parsed.smtpPass) setSmtpPass(parsed.smtpPass);
        if (parsed.smtpFrom) setSmtpFrom(parsed.smtpFrom);
      } else if (user?.email) {
        setNotificationEmail(user.email);
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

  const handleSaveEmailSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingEmailSettings(true);
    try {
      const existing = localStorage.getItem(`stockmind_settings_${userKey}`);
      const parsed = existing ? JSON.parse(existing) : {};
      const updated = {
        ...parsed,
        notificationEmail: notificationEmail.trim(),
        useCustomSmtp,
        smtpService,
        smtpHost,
        smtpPort,
        smtpUser: smtpUser.trim(),
        smtpPass: smtpPass.trim(),
        smtpFrom: smtpFrom.trim(),
        priceAlerts,
        emailAlerts,
        dailyReportEnabled,
      };
      localStorage.setItem(`stockmind_settings_${userKey}`, JSON.stringify(updated));

      showToast({
        type: 'success',
        title: 'E-posta & Bildirim Ayarları Kaydedildi',
        message: 'Bildirim e-posta adresiniz ve SMTP tercihleriniz başarıyla saklandı.',
      });
    } catch (e) {
      showToast({
        type: 'danger',
        title: 'Hata',
        message: 'E-posta ayarları kaydedilemedi.',
      });
    } finally {
      setIsSavingEmailSettings(false);
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

  const getCustomSmtpPayload = () => {
    if (!useCustomSmtp || !smtpUser || !smtpPass) return undefined;
    return {
      service: smtpService,
      host: smtpHost,
      port: Number(smtpPort),
      user: smtpUser,
      pass: smtpPass,
      from: smtpFrom || smtpUser,
    };
  };

  const handleTriggerDailyReport = async () => {
    const targetEmail = notificationEmail || email || user?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast({
        type: 'danger',
        title: 'Geçersiz E-posta',
        message: 'Lütfen geçerli bir bildirim e-posta adresi girin.',
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
    const targetEmail = notificationEmail || email || user?.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      showToast({
        type: 'danger',
        title: 'Geçersiz E-posta',
        message: 'Lütfen geçerli bir alıcı e-posta adresi girin.',
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
          customSmtp: getCustomSmtpPayload(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: 'E-posta Gönderildi! 📨',
          message: data.message || `Test e-postası ${targetEmail} adresine iletildi. (${data.method || 'smtp'})`,
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
          Hesabınıza özel profil bilgilerini, bildirim e-postanızı, SMTP sunucunuzu ve OpenRouter AI ayarlarınızı yapılandırın.
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
              label="Kayıtlı Giriş E-postası"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!user}
              helperText={user ? 'Kayıtlı e-posta güvenlik amacıyla sabittir. Bildirimler için aşağıdaki bülten e-postasını değiştirebilirsiniz.' : undefined}
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

      {/* Email & Notification Settings Card */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-text-primary">E-posta Bildirimleri & SMTP Yapılandırması</h3>
            <p className="text-xs text-text-muted">
              18:30 günlük piyasa bültenlerinin ve portföy alarmlarının gönderileceği e-posta adresini ve gönderici sunucusunu belirleyin.
            </p>
          </div>
          <Badge variant="accent" size="sm">
            E-posta Hattı
          </Badge>
        </div>

        <form onSubmit={handleSaveEmailSettings} className="space-y-5">
          {/* Target Notification Email */}
          <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📬</span>
              <h4 className="text-sm font-bold text-text-primary">Hedef Bildirim & Bülten E-postası</h4>
            </div>
            <Input
              label="Bülten ve Alarm Alıcı E-postası"
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="ornek@domain.com"
              helperText="Günlük 18:30 kapanış bülteni ve hedef fiyat alarmları bu adrese gönderilecektir."
              required
            />
          </div>

          {/* Notification Toggles */}
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer">
              <div className="pr-4">
                <span className="text-sm font-semibold text-text-primary block">⏰ Günlük 18:30 Piyasa Kapanış Raporu</span>
                <span className="text-xs text-text-muted">Her iş günü kapanışta BIST, Altın, Döviz ve Portföy özetini e-posta al.</span>
              </div>
              <input
                type="checkbox"
                checked={dailyReportEnabled}
                onChange={(e) => setDailyReportEnabled(e.target.checked)}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer">
              <div className="pr-4">
                <span className="text-sm font-semibold text-text-primary block">🎯 Hedef Fiyat & Portföy Alarmları</span>
                <span className="text-xs text-text-muted">Takip listenizdeki hisse ve fonlar hedefe ulaştığında e-posta uyarısı al.</span>
              </div>
              <input
                type="checkbox"
                checked={priceAlerts}
                onChange={(e) => setPriceAlerts(e.target.checked)}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer">
              <div className="pr-4">
                <span className="text-sm font-semibold text-text-primary block">📊 Haftalık Portföy Özeti</span>
                <span className="text-xs text-text-muted">Her Pazartesi sabahı haftalık getiri ve sektör dağılımı analizi al.</span>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Custom SMTP Toggle */}
          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-bold text-text-primary">Özel Gönderici E-posta Sunucusu (SMTP)</h4>
                <p className="text-xs text-text-muted">Kendi Gmail veya kurumsal e-posta sunucunuzdan gönderim yapın.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomSmtp}
                  onChange={(e) => setUseCustomSmtp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-bg-input peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
              </label>
            </div>

            {useCustomSmtp ? (
              <div className="p-4 rounded-xl bg-bg-tertiary/60 border border-border/60 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Servis Tipi</label>
                    <select
                      value={smtpService}
                      onChange={(e) => {
                        setSmtpService(e.target.value);
                        if (e.target.value === 'gmail') {
                          setSmtpHost('smtp.gmail.com');
                          setSmtpPort(587);
                        }
                      }}
                      className="w-full bg-bg-input text-text-primary text-sm rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none"
                    >
                      <option value="gmail">Google Gmail (Önerilen)</option>
                      <option value="custom">Özel SMTP Sunucusu (Yandex, Outlook, Kurumsal)</option>
                    </select>
                  </div>

                  <Input
                    label="Gönderici Başlığı (From)"
                    value={smtpFrom}
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    placeholder="StockMind <ben@gmail.com>"
                    helperText="Boş bırakılırsa SMTP kullanıcı adı kullanılır."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="SMTP E-posta / Kullanıcı Adı"
                    type="email"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="ornek@gmail.com"
                    required={useCustomSmtp}
                  />

                  <Input
                    label="SMTP Şifresi / Google Uygulama Şifresi"
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder="Google 16 haneli uygulama şifresi"
                    helperText="Gmail için 'Uygulama Şifreleri' (App Password) oluşturulmalıdır."
                    required={useCustomSmtp}
                  />
                </div>

                {smtpService === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="SMTP Sunucu Adresi (Host)"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="mail.sirketiniz.com"
                    />

                    <Input
                      label="SMTP Port"
                      type="number"
                      value={smtpPort.toString()}
                      onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                      placeholder="587 veya 465"
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">
                Varsayılan olarak StockMind sisteminin tanımlı güvenli bulut SMTP servisi kullanılır.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={sendingEmail}
                onClick={handleSendTestEmail}
                leftIcon={
                  sendingEmail ? (
                    <svg className="animate-spin h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )
                }
              >
                {sendingEmail ? 'Gönderiliyor...' : 'Test E-postası Gönder'}
              </Button>

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
                {sendingDailyReport ? 'Gönderiliyor...' : '18:30 Bültenini Şimdi Gönder'}
              </Button>
            </div>

            <Button type="submit" variant="primary" disabled={isSavingEmailSettings}>
              {isSavingEmailSettings ? 'Kaydediliyor...' : 'E-posta Ayarlarını Kaydet'}
            </Button>
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
    </div>
  );
}

