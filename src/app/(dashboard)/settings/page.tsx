'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button, Input, Badge, useToast } from '@/components/ui';
import { AVAILABLE_MODELS } from '@/lib/ai/openrouter';
import { getStoredOpenRouterKey, getStoredDefaultModel, saveStoredOpenRouterKey } from '@/lib/ai/apiKeyStorage';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  loadPushPreferences,
  savePushPreferences,
  sendPushNotification,
  playNotificationSound,
  hasNotificationPermission,
  requestNotificationPermission,
  isBatteryOptimizationIgnored,
  requestBatteryOptimizationExemption,
  isAndroidApp,
  PushNotificationPreferences,
  DEFAULT_PUSH_PREFERENCES,
} from '@/lib/notifications/pushNotification';

const AVATAR_PRESETS: Array<{ label: string; icon: string; colors: [string, string] }> = [
  { label: 'Boğa (Bull)', icon: '🐂', colors: ['#059669', '#10b981'] },
  { label: 'Ayı (Bear)', icon: '🐻', colors: ['#b45309', '#d97706'] },
  { label: 'Roket (Rocket)', icon: '🚀', colors: ['#4f46e5', '#7c3aed'] },
  { label: 'Elmas (Diamond)', icon: '💎', colors: ['#0284c7', '#38bdf8'] },
  { label: 'Yapay Zeka (AI)', icon: '🤖', colors: ['#9333ea', '#c084fc'] },
  { label: 'Aslan (Lion)', icon: '🦁', colors: ['#d97706', '#fbbf24'] },
  { label: 'Grafik (Trend)', icon: '📈', colors: ['#0d9488', '#14b8a6'] },
  { label: 'Para Çantası', icon: '💰', colors: ['#15803d', '#84cc16'] },
];

export default function SettingsPage() {
  const { showToast } = useToast();
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [notificationEmail, setNotificationEmail] = useState('');
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [currency, setCurrency] = useState('TRY');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('openrouter/free');
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

  // Push & Mobile Notifications State
  const [pushSettings, setPushSettings] = useState<PushNotificationPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [isPermitted, setIsPermitted] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);

  // App Version & Update State
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [appVersionCode, setAppVersionCode] = useState<number>(4);
  const [appVersionName, setAppVersionName] = useState<string>('1.0.3');

  useEffect(() => {
    setPushSettings(loadPushPreferences());
    setIsPermitted(hasNotificationPermission());
    const isAnd = isAndroidApp();
    setIsAndroid(isAnd);
    if (isAnd && typeof window !== 'undefined') {
      const bridge = (window as any).StockMindAndroid;
      if (bridge) {
        if (typeof bridge.getAppVersion === 'function') {
          setAppVersionName(bridge.getAppVersion() || '1.0.2');
        }
        if (typeof bridge.getAppVersionCode === 'function') {
          setAppVersionCode(Number(bridge.getAppVersionCode()) || 3);
        }
      }
    }
  }, []);

  const handleRequestPushPermission = async () => {
    const granted = await requestNotificationPermission();
    setIsPermitted(hasNotificationPermission() || granted);
    if (granted) {
      showToast({
        type: 'success',
        title: 'Bildirim İzni Verildi 🔔',
        message: 'Telefon push bildirimleri başarıyla aktif edildi.',
      });
    } else {
      showToast({
        type: 'info',
        title: 'Bildirim İzni',
        message: 'Lütfen cihazınızın uygulama ayarlarından StockMind bildirimlerine izin verin.',
      });
    }
  };

  const handleSavePushSettings = () => {
    savePushPreferences(pushSettings);
    showToast({
      type: 'success',
      title: 'Mobil Bildirim Ayarları Kaydedildi',
      message: 'Telefon push bildirim tercihleriniz başarıyla güncellendi.',
    });
  };

  const handleSendTestPush = () => {
    setIsSendingTestPush(true);
    sendPushNotification(
      'StockMind: Bildirim Servisi Aktif! 🚀',
      'Fiyat alarmları ve portföy bildirimleriniz başarıyla telefonunuza iletilecektir.',
      '/settings'
    );
    setTimeout(() => {
      setIsSendingTestPush(false);
      showToast({
        type: 'success',
        title: 'Test Bildirimi Gönderildi 📱',
        message: 'Telefonunuzun bildirim çubuğunu veya kilit ekranını kontrol edin.',
      });
    }, 350);
  };

  const handleCheckAppUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus(null);
    try {
      const res = await fetch('/api/app/version');
      const data = await res.json();
      if (data && data.versionCode) {
        if (appVersionCode < data.versionCode) {
          setUpdateStatus(`🚀 Yeni sürüm mevcut: v${data.version} (Build ${data.versionCode}). Güncellemek için aşağıdaki APK İndir butonuna dokunun.`);
        } else {
          setUpdateStatus(`✅ Uygulamanız tamamen güncel! En son sürümü kullanıyorsunuz (v${appVersionName}).`);
        }
      }
    } catch {
      setUpdateStatus('Güncelleme sunucusuna bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const userKey = user?.id ? `user_${user.id}` : 'guest';

  // Load user settings
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFullName(profile?.fullName || user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      if (profile?.avatarUrl) setAvatarUrl(profile.avatarUrl);
      else if (user.user_metadata?.avatar_url) setAvatarUrl(user.user_metadata.avatar_url);
      else if (user.user_metadata?.picture) setAvatarUrl(user.user_metadata.picture);
      if (profile?.preferredLanguage) setLanguage(profile.preferredLanguage);
      if (profile?.preferredCurrency) setCurrency(profile.preferredCurrency);
    } else {
      setEmail('misafir@stockmind.app');
      setFullName(profile?.fullName || 'Misafir Kullanıcı');
      if (profile?.avatarUrl) setAvatarUrl(profile.avatarUrl);
    }

    // Load AI & notification preferences per user
    try {
      const storedAiKey = getStoredOpenRouterKey(user?.id);
      if (storedAiKey) setOpenRouterKey(storedAiKey);
      const storedModel = getStoredDefaultModel(user?.id);
      if (storedModel) setDefaultModel(storedModel);

      const rawSettings = localStorage.getItem(`stockmind_settings_${userKey}`);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed.notificationEmail) setNotificationEmail(parsed.notificationEmail);
        else if (user?.email) setNotificationEmail(user.email);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast({
        type: 'danger',
        title: 'Geçersiz Dosya Türü',
        message: 'Lütfen bir resim dosyası seçin (PNG, JPG, WebP vb.).',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast({
        type: 'danger',
        title: 'Dosya Boyutu Çok Büyük',
        message: 'Lütfen 10MB\'dan küçük bir görsel seçin.',
      });
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const size = 128;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setIsUploadingPhoto(false);
            return;
          }

          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
          // 128x128 JPEG at 0.75 is only ~4KB, keeping profile payload minimal
          const compressed = canvas.toDataURL('image/jpeg', 0.75);
          setAvatarUrl(compressed);
          showToast({
            type: 'success',
            title: 'Fotoğraf Seçildi',
            message: 'Profilinizi kaydetmek için lütfen "Profili Kaydet" butonuna tıklayın.',
          });
        } catch (err) {
          console.error('Image crop error:', err);
          showToast({
            type: 'danger',
            title: 'Hata',
            message: 'Görsel işlenemedi.',
          });
        } finally {
          setIsUploadingPhoto(false);
        }
      };
      img.onerror = () => {
        setIsUploadingPhoto(false);
        showToast({
          type: 'danger',
          title: 'Hata',
          message: 'Görsel okunamadı.',
        });
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploadingPhoto(false);
      showToast({
        type: 'danger',
        title: 'Hata',
        message: 'Dosya okunurken bir sorun oluştu.',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetAvatar = (emoji: string, bgGradient: [string, string]) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgGradient[0]}" />
          <stop offset="100%" stop-color="${bgGradient[1]}" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="64" fill="url(#g)" />
      <text x="50%" y="54%" font-size="120" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    setAvatarUrl(dataUrl);
    showToast({
      type: 'info',
      title: 'Avatar Seçildi',
      message: 'Değişikliği uygulamak için "Profili Kaydet" butonuna tıklayın.',
    });
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast({
      type: 'info',
      title: 'Fotoğraf Kaldırıldı',
      message: 'Profil baş harfi varsayılan olarak gösterilecek. "Profili Kaydet" ile onaylayın.',
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const success = await updateProfile({
        fullName: fullName.trim(),
        preferredLanguage: language,
        preferredCurrency: currency,
        avatarUrl: avatarUrl,
      });

      if (user) {
        if (success) {
          showToast({
            type: 'success',
            title: 'Profil Güncellendi',
            message: 'Profil bilgileriniz ve fotoğrafınız hesabınıza kaydedildi.',
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
          message: 'Profil fotoğrafınız ve tercihleriniz bu tarayıcı için kaydedildi.',
        });
      }
      if (openRouterKey) {
        saveStoredOpenRouterKey(openRouterKey, user?.id, defaultModel);
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

      if (!smtpUser.trim() || !smtpPass.trim()) {
        showToast({
          type: 'warning',
          title: 'Ayarlar Kaydedildi (SMTP Eksik)',
          message: 'Bildirim tercihleriniz saklandı ancak e-posta bildirimleri ve 18:30 bülteni için özel SMTP gönderici bilgileri zorunludur.',
        });
      } else {
        showToast({
          type: 'success',
          title: 'E-posta & Özel SMTP Ayarları Kaydedildi 🎉',
          message: 'Özel SMTP gönderici bilgileriniz ve bildirim tercihleriniz başarıyla aktif edildi.',
        });
      }
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
      saveStoredOpenRouterKey(openRouterKey, user?.id, defaultModel);

      showToast({
        type: 'success',
        title: 'AI Ayarları Kaydedildi',
        message: 'OpenRouter API anahtarınız ve tercih ettiğiniz model tüm sistemde başarıyla aktif edildi.',
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
    if (!smtpUser.trim() || !smtpPass.trim()) return undefined;
    return {
      service: smtpService,
      host: smtpHost,
      port: Number(smtpPort),
      user: smtpUser.trim(),
      pass: smtpPass.trim(),
      from: smtpFrom.trim() || smtpUser.trim(),
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

    if (!smtpUser.trim() || !smtpPass.trim()) {
      showToast({
        type: 'danger',
        title: 'Özel SMTP Bilgileri Zorunludur 🔑',
        message: '18:30 Günlük Bültenini gönderebilmek için aşağıdaki SMTP Yapılandırması alanından gönderici e-posta ve şifrenizi (Uygulama Şifresi) girip kaydedin.',
      });
      return;
    }

    setSendingDailyReport(true);
    try {
      const res = await fetch('/api/cron/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          name: fullName || 'Yatırımcı',
          customSmtp: getCustomSmtpPayload(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast({
          type: 'success',
          title: '18:30 Bülteni Gönderildi! 📬',
          message: `Günlük piyasa kapanış ve portföy bülteni ${targetEmail} (${fullName || 'Yatırımcı'}) adresine gönderildi.`,
        });
        if (data.emailResult?.previewUrl) {
          setEmailPreviewUrl(data.emailResult.previewUrl);
        }
      } else {
        showToast({
          type: 'danger',
          title: 'Bülten Gönderilemedi',
          message: data.error || data.emailResult?.message || 'Günlük bülten iletilemedi.',
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

    if (!smtpUser.trim() || !smtpPass.trim()) {
      showToast({
        type: 'danger',
        title: 'Özel SMTP Bilgileri Zorunludur 🔑',
        message: 'Test e-postası gönderebilmek için aşağıdaki SMTP Yapılandırması alanından gönderici e-posta ve şifrenizi (Google Uygulama Şifresi) tanımlamalısınız.',
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

      {/* Theme Selection Card (Görünüm ve Plan Tercihi) */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-text-primary">Görünüm & Tema (Plan Seçimi)</h3>
            <p className="text-xs text-text-muted">Arayüz için göz yormayan Siyah Plan (Koyu) veya aydınlık ferah Beyaz Plan (Açık) seçin.</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/30 self-start sm:self-auto">
            Aktif: {resolvedTheme === 'dark' ? 'Siyah Plan (Koyu)' : 'Beyaz Plan (Açık)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Siyah Plan Card */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              resolvedTheme === 'dark'
                ? 'border-accent bg-accent/10 shadow-lg shadow-accent/10 ring-2 ring-accent/30'
                : 'border-border bg-bg-secondary/60 hover:border-border-hover hover:bg-bg-hover'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌙</span>
                <span className="font-bold text-sm text-text-primary">Siyah Plan</span>
              </div>
              {resolvedTheme === 'dark' ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-accent">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Seçili
                </span>
              ) : (
                <span className="text-xs text-text-muted group-hover:text-text-primary transition-colors">
                  Seç
                </span>
              )}
            </div>

            {/* Dark Mode Miniature Preview */}
            <div className="h-16 rounded-xl bg-[#0a0b14] border border-[#1e1f3a] p-2 flex flex-col justify-between mb-2.5 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-12 h-2 rounded bg-violet-500/40" />
                <div className="w-4 h-2 rounded bg-emerald-500/40" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-6 flex-1 rounded bg-[#12142a] border border-[#2d2f55]" />
                <div className="h-6 flex-1 rounded bg-[#12142a] border border-[#2d2f55]" />
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Göz yormayan, modern mor-siyah neon cam tasarım. Düşük ışıkta kullanım ve gece analizleri için idealdir.
            </p>
          </button>

          {/* Beyaz Plan Card */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
              resolvedTheme === 'light'
                ? 'border-accent bg-accent/10 shadow-lg shadow-accent/10 ring-2 ring-accent/30'
                : 'border-border bg-bg-secondary/60 hover:border-border-hover hover:bg-bg-hover'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">☀️</span>
                <span className="font-bold text-sm text-text-primary">Beyaz Plan</span>
              </div>
              {resolvedTheme === 'light' ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-accent">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  Seçili
                </span>
              ) : (
                <span className="text-xs text-text-muted group-hover:text-text-primary transition-colors">
                  Seç
                </span>
              )}
            </div>

            {/* Light Mode Miniature Preview */}
            <div className="h-16 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] p-2 flex flex-col justify-between mb-2.5 overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="w-12 h-2 rounded bg-violet-600/40" />
                <div className="w-4 h-2 rounded bg-emerald-600/40" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-6 flex-1 rounded bg-white border border-[#cbd5e1] shadow-xs" />
                <div className="h-6 flex-1 rounded bg-white border border-[#cbd5e1] shadow-xs" />
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Ferah, temiz, yüksek kontrastlı aydınlık tasarım. Gündüz kullanımı ve net okunabilirlik için optimize edilmiştir.
            </p>
          </button>
        </div>
      </div>

      {/* Mobile App & APK Card */}
      <div className="glass-card p-6 space-y-4 border border-emerald-500/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993s-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.997-3.459a.416.416 0 00-.152-.5684.417.417 0 00-.569.152l-2.0223 3.503C15.583 8.359 13.856 8 12 8s-3.583.359-5.1352.949L4.8425 5.446a.417.417 0 00-.569-.152.416.416 0 00-.152.5684l1.997 3.459C2.688 11.086 0 14.887 0 19.341h24c0-4.454-2.688-8.255-6.1185-10.0196" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Mobil Uygulama (Android APK)</h3>
              <p className="text-xs text-text-muted">StockMind'ı Android cihazınızda tam ekran yerel uygulama olarak kullanın.</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 self-start sm:self-auto">
            v1.0.0 Güncel (5.9 MB)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="space-y-1">
            <div className="font-bold text-sm text-text-primary">StockMind.apk Paketini İndirin</div>
            <p className="text-xs text-text-muted">
              Doğrudan APK dosyasını indirerek Android 7.0+ telefon veya tabletinize saniyeler içinde kurabilirsiniz.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <a
              href="/api/download/apk"
              download="StockMind.apk"
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all cursor-pointer"
            >
              <span>Hemen İndir (5.9 MB)</span>
            </a>
            <Link
              href="/download"
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs border border-white/10 transition-all text-center"
            >
              QR & Rehber
            </Link>
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="text-base font-bold text-text-primary">Profil Bilgileri</h3>
            <p className="text-xs text-text-muted">Kişisel bilgilerinizi ve tercih ettiğiniz para birimini güncelleyin.</p>
          </div>
          <div className="flex items-center gap-2">
            {(profile?.isPro ?? true) && (
              <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600/15 via-accent/15 to-fuchsia-600/15 border border-accent/35 text-accent font-bold text-xs flex items-center gap-1.5 shadow-xs">
                <span>⭐</span> StockMind PRO
              </span>
            )}
            <Badge variant="purple" size="sm">
              {user ? 'Kişisel Hesap' : 'Misafir Profil'}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* Avatar Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-bg-surface-2/60 border border-border/60 flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="relative group flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-accent to-accent-secondary flex items-center justify-center font-bold text-3xl text-white shadow-lg shadow-accent/20 overflow-hidden ring-2 ring-border/50">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={fullName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  userInitial
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1 backdrop-blur-xs cursor-pointer"
                title="Fotoğraf Yükle / Değiştir"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Değiştir</span>
              </button>
            </div>

            <div className="flex-1 space-y-2.5 w-full">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-text-primary">{fullName || 'Kullanıcı'}</h4>
                    {(profile?.isPro ?? true) && (
                      <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-violet-600 via-accent to-fuchsia-600 text-white text-[10px] font-black tracking-wider uppercase shadow-xs shadow-accent/30 flex items-center gap-1 shrink-0">
                        <span>★</span> PRO
                      </span>
                    )}
                    {avatarUrl && (
                      <Badge variant="info" size="sm">Özel Fotoğraf</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="gap-1.5 text-xs h-8 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {isUploadingPhoto ? 'Yükleniyor...' : 'Fotoğraf Seç'}
                  </Button>

                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePhoto}
                      className="text-xs h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                    >
                      Kaldır
                    </Button>
                  )}
                </div>
              </div>

              {/* Avatar Presets */}
              <div className="pt-2 border-t border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="text-[11px] font-medium text-text-secondary">
                    Veya hazır bir finans avatarı seçin:
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Otomatik optimize edilir (JPG/WebP)
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {AVATAR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(p.icon, p.colors)}
                      title={p.label}
                      className="w-8 h-8 rounded-xl bg-bg-surface hover:scale-110 active:scale-95 border border-border/60 hover:border-accent hover:shadow-sm flex items-center justify-center text-sm transition-all duration-150 cursor-pointer"
                    >
                      {p.icon}
                    </button>
                  ))}
                </div>
              </div>
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

      {/* ═══════════════════════════════════════════
          MOBILE PHONE & PUSH NOTIFICATIONS CARD
          ═══════════════════════════════════════════ */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/60 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📱</span>
              <h3 className="text-base font-bold text-text-primary">Telefon & Push Bildirimleri (Mobil Anlık Bildirim)</h3>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Telefonunuzun kilit ekranına ve üst bildirim çubuğuna sesli/titreşimli anlık fiyat alarmları ve portföy uyarıları gönderilmesini yapılandırın.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={isAndroid ? 'success' : 'purple'} size="sm">
              {isAndroid ? '🤖 Android Uygulama' : '🌐 Web / Tarayıcı'}
            </Badge>
            <Badge variant={isPermitted ? 'success' : 'warning'} size="sm">
              {isPermitted ? '● İzin Verildi' : '⚠️ İzin Gerekli'}
            </Badge>
          </div>
        </div>

        {/* Permission Request Alert Banner if not permitted */}
        {!isPermitted && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-bold text-amber-400">Bildirim İzni Henüz Verilmedi</p>
              <p className="text-text-muted">
                Telefonunuzun kilit ekranında anlık fiyat uyarılarını görebilmek için bildirim iznini onaylamanız gerekir.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestPushPermission}
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/20 shrink-0"
            >
              🔔 İzin İste / Etkinleştir
            </Button>
          </div>
        )}

        {/* Toggles */}
        <div className="space-y-2.5">
          {/* Master Toggle */}
          <label className="flex items-center justify-between p-3.5 rounded-xl bg-accent/10 border border-accent/30 cursor-pointer transition-colors">
            <div className="pr-4">
              <span className="text-sm font-bold text-text-primary block">
                🔔 Telefon Push Bildirimlerini Etkinleştir
              </span>
              <span className="text-xs text-text-muted">
                Fiyat alarmları, portföy hareketleri ve kapanış bülteninin telefon bildirim çubuğuna düşmesini sağlar.
              </span>
            </div>
            <input
              type="checkbox"
              checked={pushSettings.enabled}
              onChange={(e) => setPushSettings({ ...pushSettings, enabled: e.target.checked })}
              className="w-5 h-5 accent-accent rounded cursor-pointer"
            />
          </label>

          {/* Sub Toggles */}
          <div className={`space-y-2 pl-1 sm:pl-3 transition-opacity ${pushSettings.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer hover:bg-bg-hover transition-colors">
              <div className="pr-4">
                <span className="text-sm font-semibold text-text-primary block">🎯 Anlık Hedef Fiyat Alarmları</span>
                <span className="text-xs text-text-muted">İzleme listenizdeki veya portföyünüzdeki hisse/fon belirlediğiniz fiyata ulaştığında doğrudan kilit ekranına bildirim gelir.</span>
              </div>
              <input
                type="checkbox"
                checked={pushSettings.priceAlerts}
                onChange={(e) => setPushSettings({ ...pushSettings, priceAlerts: e.target.checked })}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer hover:bg-bg-hover transition-colors">
              <div className="pr-4">
                <span className="text-sm font-semibold text-text-primary block">⏰ Günlük 18:30 Kapanış Bildirimi</span>
                <span className="text-xs text-text-muted">Piyasa kapandığında günün kâr/zararını ve BIST 100 durumunu telefonun bildirim çubuğunda gösterir.</span>
              </div>
              <input
                type="checkbox"
                checked={pushSettings.dailyReport}
                onChange={(e) => setPushSettings({ ...pushSettings, dailyReport: e.target.checked })}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer hover:bg-bg-hover transition-colors">
              <div className="pr-4">
                <span className="text-sm font-semibold text-text-primary block">⚡ Kritik Portföy Değişimleri (±%3)</span>
                <span className="text-xs text-text-muted">Portföyünüzde gün içinde %3 veya üzeri sert hareket olduğunda anında push uyarısı gönderir.</span>
              </div>
              <input
                type="checkbox"
                checked={pushSettings.portfolioMoves}
                onChange={(e) => setPushSettings({ ...pushSettings, portfolioMoves: e.target.checked })}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/40 border border-border/40 cursor-pointer hover:bg-bg-hover transition-colors">
              <div className="pr-4">
                <span className="text-sm font-semibold text-text-primary block">📢 Önemli KAP & Piyasa Gelişmeleri</span>
                <span className="text-xs text-text-muted">Sahip olduğunuz hisselerle ilgili kritik KAP bildirimleri ve flaş haberleri bildir.</span>
              </div>
              <input
                type="checkbox"
                checked={pushSettings.marketNews}
                onChange={(e) => setPushSettings({ ...pushSettings, marketNews: e.target.checked })}
                className="w-4 h-4 accent-accent rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Background Service Status Info */}
        <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0">⚡</span>
            <div className="space-y-0.5">
              <span className="font-bold text-accent">Uygulama Kapalıyken Arka Plan Fiyat Denetimi</span>
              <p className="text-text-muted leading-relaxed">
                Android WorkManager her 15 dakikada bir fiyatları denetler. Xiaomi, Samsung veya Huawei cihazlarda uygulamanın kapalıyken sistem tarafından dondurulmaması için pil tasarrufunun <strong>Kısıtlama Yok</strong> olması gerekir.
              </p>
            </div>
          </div>
          {isAndroidApp() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                requestBatteryOptimizationExemption();
              }}
              className="border-accent/40 text-accent hover:bg-accent/10 whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
            >
              🔋 Pil Kısıtlamasını Kaldır
            </Button>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendTestPush}
              disabled={isSendingTestPush}
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 cursor-pointer"
              leftIcon={
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              }
            >
              {isSendingTestPush ? 'Bildirim Gönderiliyor...' : '📱 Telefona Test Bildirimi Gönder'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                playNotificationSound();
                showToast({
                  type: 'info',
                  title: 'Özel Bildirim Sesi Çalındı 🔔',
                  message: 'StockMind özel bildirim sesi çalındı.',
                });
              }}
              className="border-primary/30 text-primary-400 hover:bg-primary-500/10 cursor-pointer"
              leftIcon={
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              }
            >
              🔔 Sesi Dinle
            </Button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSavePushSettings}
          >
            Mobil Tercihleri Kaydet
          </Button>
        </div>

      </div>

      {/* APK Version & In-App Update Management Card */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🚀</span>
              <h3 className="text-base font-bold text-text-primary">StockMind APK Sürümü & Güncelleme Merkezi</h3>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Yüklü Android uygulamanızın sürümünü kontrol edin ve yeni çıkan özellikleri tek dokunuşla güncelleyin.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="purple" size="sm">
              v{appVersionName} (Build {appVersionCode})
            </Badge>
            <Badge variant="success" size="sm">
              Güncel: v1.0.2
            </Badge>
          </div>
        </div>

        {/* Update Status Banner if checked */}
        {updateStatus && (
          <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 text-xs text-text-primary flex items-start gap-2.5 animate-in fade-in duration-200">
            <span className="text-base shrink-0">ℹ️</span>
            <p className="leading-relaxed font-medium">{updateStatus}</p>
          </div>
        )}

        {/* How updates work guide */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          <div className="p-4 rounded-xl bg-bg-tertiary/40 border border-border/50 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-text-primary">
              <span className="text-emerald-400">🛡️</span>
              <span>Eski APK'yı Silmeli miyim?</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              <strong className="text-emerald-400">Hayır, kesinlikle silmeyin!</strong> Yeni APK dosyasını indirip doğrudan çalıştırdığınızda Android sistemi eski uygulamanın üzerine günceller. Oturumunuz, izleme listeniz, portföyünüz ve ayarlarınız <strong className="text-text-primary">%100 korunur</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-tertiary/40 border border-border/50 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-text-primary">
              <span className="text-accent">🔔</span>
              <span>Uygulama Kapalıyken Bildirim Gelir mi?</span>
            </div>
            <p className="text-text-muted leading-relaxed">
              <strong className="text-accent">Evet!</strong> Yeni v1.0.2 sürümü ile gelen yerel Android arka plan servisi (WorkManager), uygulama tamamen kapalı olsa bile her 15 dakikada bir hedef fiyatlarınızı denetler ve kilit ekranına bildirim gönderir.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCheckAppUpdate}
            disabled={checkingUpdate}
            className="cursor-pointer"
            leftIcon={
              <svg className={`w-4 h-4 ${checkingUpdate ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          >
            {checkingUpdate ? 'Denetleniyor...' : 'Güncellemeleri Denetle'}
          </Button>

          <a
            href="/api/download/apk"
            download="StockMind.apk"
            onClick={(e) => {
              const bridge = typeof window !== 'undefined' ? (window as any).StockMindAndroid : null;
              if (bridge && typeof bridge.downloadAndInstallUpdate === 'function') {
                e.preventDefault();
                bridge.downloadAndInstallUpdate('/api/download/apk');
              } else if (isAndroid) {
                e.preventDefault();
                const fullUrl = `${window.location.origin}/StockMind.apk`;
                navigator.clipboard.writeText(fullUrl);
                showToast({
                  type: 'success',
                  title: 'Güncelleme Bağlantısı Kopyalandı! 📋',
                  message: 'Adres panonuza kopyalandı. Telefonunuzun Chrome tarayıcısını açıp yapıştırarak saniyeler içinde güncelleyebilirsiniz.',
                });
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-accent to-purple-600 hover:from-accent-hover hover:to-purple-700 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>StockMind v1.0.2 APK İndir / Güncelle</span>
          </a>
        </div>
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

          {/* Mandatory Custom SMTP Section */}
          <div className="pt-3 border-t border-border/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-text-primary">Özel Gönderici E-posta Sunucusu (SMTP)</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent/15 border border-accent/30 text-accent">
                    Zorunlu Yapılandırma
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  E-posta bildirimleri ve 18:30 piyasa bültenlerini gönderebilmek için kendi gönderici SMTP bilgilerinizi tanımlamanız zorunludur.
                </p>
              </div>

              {/* Status Pill */}
              <div className="shrink-0">
                {smtpUser && smtpPass ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Özel SMTP Aktif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 animate-pulse">
                    <span>⚠️ Gönderici Tanımlanmadı</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-bg-tertiary/60 border border-border/60 space-y-4">
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
                  label="SMTP E-posta / Gönderici Adresi *"
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="ornek@gmail.com"
                  required
                />

                <Input
                  label="SMTP Şifresi / Google 16 Haneli Uygulama Şifresi *"
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="16 haneli Google uygulama şifresi"
                  helperText="Gmail için hesap şifreniz değil, 'Uygulama Şifresi' girilmelidir."
                  required
                />
              </div>

              {smtpService === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="SMTP Sunucu Adresi (Host) *"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="mail.sirketiniz.com"
                    required
                  />

                  <Input
                    label="SMTP Port *"
                    type="number"
                    value={smtpPort.toString()}
                    onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                    placeholder="587 veya 465"
                    required
                  />
                </div>
              )}

              {/* Helpful Gmail Guide Box */}
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-xs text-text-secondary space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-accent">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Gmail ile Nasıl 16 Haneli Uygulama Şifresi Alınır?</span>
                </div>
                <p className="leading-relaxed">
                  1. Google Hesabınızda 2 Adımlı Doğrulama aktif olmalıdır.<br />
                  2.{' '}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline font-semibold hover:text-accent-secondary"
                  >
                    Google Uygulama Şifreleri Sayfası
                  </a>{' '}
                  bağlantısını açın.<br />
                  3. Uygulama adı olarak &ldquo;StockMind&rdquo; yazın ve &ldquo;Oluştur&rdquo; butonuna basın.<br />
                  4. Üretilen 16 haneli şifreyi kopyalayıp yukarıdaki alana yapıştırın.
                </p>
              </div>
            </div>
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
            onChange={(e) => {
              const val = e.target.value;
              setOpenRouterKey(val);
              saveStoredOpenRouterKey(val, user?.id, defaultModel);
            }}
            onBlur={() => {
              saveStoredOpenRouterKey(openRouterKey, user?.id, defaultModel);
            }}
            helperText="Yazdığınız anda anında tüm cihazlarınıza ve asistanlara kaydedilir. Boş bırakılırsa yerleşik analiz kullanılır."
          />

          {openRouterKey.trim() && (
            <div className="text-xs p-2.5 rounded-xl border">
              {openRouterKey.trim().startsWith('sk-or-') ? (
                <p className="text-emerald-400 flex items-center gap-1.5 font-medium">
                  <span>✅</span>
                  <span>Geçerli OpenRouter anahtar formatı aktif ({openRouterKey.slice(0, 8)}...{openRouterKey.slice(-4)}). Canlı Quant ve AI Asistan hazır!</span>
                </p>
              ) : (
                <p className="text-amber-400 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>
                    Girdiğiniz anahtar OpenRouter formatında (sk-or-v1-...) değil. Eğer OpenAI doğrudan anahtarı girdiyseniz, sistem OpenRouter altyapısını kullandığı için lütfen{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="underline font-bold text-accent">
                      openrouter.ai/keys
                    </a>{' '}
                    adresinden ücretsiz anahtar oluşturup yapıştırın.
                  </span>
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Varsayılan AI Modeli</label>
            <select
              value={defaultModel}
              onChange={(e) => {
                const newM = e.target.value;
                setDefaultModel(newM);
                saveStoredOpenRouterKey(openRouterKey, user?.id, newM);
              }}
              className="w-full bg-bg-input text-text-primary text-sm rounded-xl border border-border px-3.5 py-2.5 focus:border-accent focus:outline-none"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
            >
              <span>🔑 Ücretsiz OpenRouter API Key Al</span>
            </a>
            <Button type="submit" variant="primary">
              AI Ayarlarını Kaydet
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

