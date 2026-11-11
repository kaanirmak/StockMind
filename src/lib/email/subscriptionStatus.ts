import { hasProAccess } from '@/lib/ai/modelCatalog';

export interface BulletinUserLike {
  email?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface BulletinSubscriptionView {
  targetAddress: string | null;
  isEmailVerified: boolean;
  isProEligible: boolean;
  savedEnabled: boolean;
  draftEnabled: boolean;
  isActiveForNextRun: boolean;
  hasUnsavedChange: boolean;
  statusKind: 'active' | 'paused' | 'unverified' | 'pro-required' | 'guest';
  statusLabel: string;
  addressLabel: string;
  nextRunEffectNote: string;
}

export function isUserEligibleForScheduledBulletin(
  user: BulletinUserLike | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!user) return false;
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  if (!email || !email.includes('@')) return false;
  if (!user.email_confirmed_at) return false;

  if (typeof user.banned_until === 'string' && user.banned_until.trim().length > 0) {
    const bannedMs = Date.parse(user.banned_until);
    if (Number.isFinite(bannedMs) && bannedMs > nowMs) return false;
  }

  if (!hasProAccess(user.app_metadata ?? undefined)) return false;
  if (user.user_metadata?.daily_report_enabled === false) return false;

  return true;
}

export function resolveBulletinSubscriptionView(
  user: BulletinUserLike | null | undefined,
  options?: { draftEnabled?: boolean }
): BulletinSubscriptionView {
  const targetAddress =
    typeof user?.email === 'string' && user.email.trim().includes('@')
      ? user.email.trim()
      : null;

  if (!user || !targetAddress) {
    return {
      targetAddress: null,
      isEmailVerified: false,
      isProEligible: false,
      savedEnabled: false,
      draftEnabled: false,
      isActiveForNextRun: false,
      hasUnsavedChange: false,
      statusKind: 'guest',
      statusLabel: 'Giriş Gerekli',
      addressLabel: 'Oturum açık değil',
      nextRunEffectNote:
        'Günlük bülten aboneliği ve hedef e-posta adresi yalnızca doğrulanmış hesaplarda görünür.',
    };
  }

  const isEmailVerified = Boolean(user.email_confirmed_at);
  const isProEligible = hasProAccess(user.app_metadata ?? undefined);
  const savedEnabled = user.user_metadata?.daily_report_enabled !== false;
  const draftEnabled =
    typeof options?.draftEnabled === 'boolean' ? options.draftEnabled : savedEnabled;
  const hasUnsavedChange = draftEnabled !== savedEnabled;
  const isActiveForNextRun = isUserEligibleForScheduledBulletin(user);

  if (!isEmailVerified) {
    return {
      targetAddress,
      isEmailVerified: false,
      isProEligible,
      savedEnabled,
      draftEnabled,
      isActiveForNextRun: false,
      hasUnsavedChange,
      statusKind: 'unverified',
      statusLabel: 'Adres Doğrulaması Bekleniyor',
      addressLabel: `${targetAddress} (doğrulanmamış)`,
      nextRunEffectNote:
        'E-posta adresiniz doğrulanana kadar otomatik bülten gönderimi başlatılmaz.',
    };
  }

  if (!isProEligible) {
    return {
      targetAddress,
      isEmailVerified: true,
      isProEligible: false,
      savedEnabled,
      draftEnabled,
      isActiveForNextRun: false,
      hasUnsavedChange,
      statusKind: 'pro-required',
      statusLabel: 'Pro Üyelik Gerekli',
      addressLabel: `${targetAddress} (doğrulanmış)`,
      nextRunEffectNote:
        'Otomatik 18:30 bülteni Pro hesaplara gönderilir; tercih kaydedilir ve Pro geçişinde aktif olur.',
    };
  }

  if (!savedEnabled) {
    return {
      targetAddress,
      isEmailVerified: true,
      isProEligible: true,
      savedEnabled: false,
      draftEnabled,
      isActiveForNextRun: false,
      hasUnsavedChange,
      statusKind: 'paused',
      statusLabel: 'Abonelik Durduruldu',
      addressLabel: `${targetAddress} (doğrulanmış)`,
      nextRunEffectNote: hasUnsavedChange
        ? `Kaydederseniz bir sonraki otomatik çalıştırmada (iş günleri 18:30 TSİ) ${targetAddress} adresine gönderim yeniden başlayacaktır.`
        : `Bir sonraki otomatik çalıştırmada ${targetAddress} adresine bülten gönderilmeyecektir.`,
    };
  }

  return {
    targetAddress,
    isEmailVerified: true,
    isProEligible: true,
    savedEnabled: true,
    draftEnabled,
    isActiveForNextRun,
    hasUnsavedChange,
    statusKind: 'active',
    statusLabel: 'Abone · Otomatik Gönderim Açık',
    addressLabel: `${targetAddress} (doğrulanmış)`,
    nextRunEffectNote: hasUnsavedChange
      ? `Kaydederseniz bir sonraki otomatik çalıştırmada (iş günleri 18:30 TSİ) ${targetAddress} adresine gönderim durdurulacaktır.`
      : `Bir sonraki otomatik çalıştırmada (iş günleri 18:30 TSİ) bülten ${targetAddress} adresine gönderilecektir.`,
  };
}
