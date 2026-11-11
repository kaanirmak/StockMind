export type ChatErrorCategory = 'network' | 'quota' | 'model' | 'cancelled' | 'auth' | 'unknown';

export interface ChatErrorClassification {
  category: ChatErrorCategory;
  title: string;
  message: string;
  retryable: boolean;
  suggestModelSwitch: boolean;
  suggestSettingsKey: boolean;
}

export interface ChatErrorInput {
  status?: number;
  code?: string;
  error?: string;
  networkError?: boolean;
  aborted?: boolean;
  retryAfterSeconds?: number;
}

/**
 * Classifies AI chat failures into clear user-facing categories so network drops,
 * quota limits, model/provider errors, and user cancellation each yield distinct guidance.
 */
export function classifyChatFailure(input: ChatErrorInput): ChatErrorClassification {
  if (input.aborted || input.code === 'AI_CANCELLED' || input.status === 499) {
    return {
      category: 'cancelled',
      title: 'İstek İptal Edildi',
      message: 'Analiz sizin tarafınızdan durduruldu. Hazır olduğunuzda soruyu yeniden gönderebilirsiniz.',
      retryable: true,
      suggestModelSwitch: false,
      suggestSettingsKey: false,
    };
  }

  if (input.networkError) {
    return {
      category: 'network',
      title: 'Ağ Bağlantısı Kesildi',
      message: 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip aynı soruyu yeniden deneyin.',
      retryable: true,
      suggestModelSwitch: false,
      suggestSettingsKey: false,
    };
  }

  const code = input.code;
  const status = input.status ?? 0;

  if (code === 'HOURLY_QUOTA_EXCEEDED') {
    const minutes =
      typeof input.retryAfterSeconds === 'number' && input.retryAfterSeconds > 0
        ? Math.max(1, Math.ceil(input.retryAfterSeconds / 60))
        : null;
    const waitNote = minutes ? ` Yaklaşık ${minutes} dakika içinde yenilenir.` : '';
    return {
      category: 'quota',
      title: 'Saatlik Soru Kotası Doldu',
      message:
        (input.error || 'Saatlik soru sınırına ulaştınız.') +
        waitNote +
        ' Kendi OpenRouter anahtarınızı ekleyebilir veya Pro hesaba geçebilirsiniz.',
      retryable: false,
      suggestModelSwitch: false,
      suggestSettingsKey: true,
    };
  }

  if (code === 'AI_DAILY_FREE_LIMIT_REACHED') {
    return {
      category: 'quota',
      title: 'Günlük Ücretsiz Model Kotası Doldu',
      message:
        input.error ||
        'OpenRouter günlük ücretsiz model kotası doldu. Ayarlar > AI bölümünden kişisel OpenRouter anahtarınızı ekleyebilirsiniz.',
      retryable: false,
      suggestModelSwitch: true,
      suggestSettingsKey: true,
    };
  }

  if (code === 'AI_RATE_LIMITED' || status === 429) {
    return {
      category: 'quota',
      title: 'Sağlayıcı Hız Sınırı',
      message:
        'Seçili model yoğunluk nedeniyle geçici hız sınırına takıldı. Başka bir model seçebilir veya biraz sonra yeniden deneyebilirsiniz.',
      retryable: true,
      suggestModelSwitch: true,
      suggestSettingsKey: false,
    };
  }

  if (code === 'AUTH_REQUIRED' || status === 401) {
    return {
      category: 'auth',
      title: 'Oturum Gerekli',
      message: 'Oturumunuz doğrulanamadı. Tekrar giriş yapıp mesajınızı yeniden gönderin.',
      retryable: true,
      suggestModelSwitch: false,
      suggestSettingsKey: false,
    };
  }

  if (code === 'FORBIDDEN_ORIGIN' || code === 'PRO_REQUIRED' || status === 403) {
    return {
      category: 'auth',
      title: 'Erişim Kısıtlaması',
      message:
        code === 'PRO_REQUIRED'
          ? 'Bu model yalnızca Pro hesaplara açıktır. Otomatik ücretsiz modele veya başka bir modele geçin.'
          : 'İstek adresi doğrulanamadı. Sayfayı uygulamanın kendi adresinden yeniden açın.',
      retryable: false,
      suggestModelSwitch: code === 'PRO_REQUIRED',
      suggestSettingsKey: false,
    };
  }

  if (code === 'AI_KEY_REQUIRED' || code === 'AI_PROVIDER_UNAUTHORIZED') {
    return {
      category: 'model',
      title: 'AI Anahtarı Gerekli veya Geçersiz',
      message:
        code === 'AI_KEY_REQUIRED'
          ? 'AI anahtarı tanımlı değil. Ayarlar > AI bölümünden OpenRouter anahtarınızı ekleyin.'
          : 'OpenRouter anahtarı reddedildi. Ayarlar > AI bölümündeki anahtarı kontrol edin.',
      retryable: false,
      suggestModelSwitch: false,
      suggestSettingsKey: true,
    };
  }

  if (code === 'AI_CREDITS_REQUIRED' || code === 'AI_PROVIDER_FORBIDDEN') {
    return {
      category: 'model',
      title: 'Model Sağlayıcı Kısıtlaması',
      message:
        code === 'AI_CREDITS_REQUIRED'
          ? 'Seçilen model için OpenRouter kredisi yetersiz. Ücretsiz modele geçip yeniden deneyin.'
          : 'Seçilen model sağlayıcı tarafından reddedildi. Başka bir model seçerek tekrar deneyin.',
      retryable: true,
      suggestModelSwitch: true,
      suggestSettingsKey: false,
    };
  }

  if (
    code === 'AI_TIMEOUT' ||
    code === 'AI_EMPTY_RESPONSE' ||
    code === 'AI_UNAVAILABLE' ||
    code === 'AI_PROVIDER_ERROR' ||
    status >= 500 ||
    (status === 400 && /model/i.test(input.error || ''))
  ) {
    return {
      category: 'model',
      title: code === 'AI_TIMEOUT' ? 'Model Yanıt Süresi Aşıldı' : 'Model Sağlayıcı Hatası',
      message:
        code === 'AI_TIMEOUT'
          ? 'Seçili AI modeli zamanında yanıt veremedi. Yeniden deneyin veya daha hızlı başka bir model seçin.'
          : input.error || 'Seçili model şu anda geçerli yanıt üretemedi. Yeniden deneyin veya farklı bir model seçin.',
      retryable: true,
      suggestModelSwitch: true,
      suggestSettingsKey: false,
    };
  }

  return {
    category: 'unknown',
    title: 'Analiz Tamamlanamadı',
    message: input.error || 'AI şu anda yanıt veremiyor. Lütfen tekrar deneyin.',
    retryable: true,
    suggestModelSwitch: false,
    suggestSettingsKey: false,
  };
}

export function chatErrorMessage(status: number, body: { code?: string; error?: string }): string {
  return classifyChatFailure({
    status,
    code: body.code,
    error: body.error,
  }).message;
}
