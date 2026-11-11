export type AuthFlowContext = 'login' | 'register' | 'forgot_password' | 'reset_password';

export interface AuthNotice {
  tone: 'error' | 'warning' | 'info' | 'success';
  code: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}

export function isExpiredAuthError(params: {
  error?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): boolean {
  const haystack = `${params.error ?? ''} ${params.errorCode ?? ''} ${params.errorMessage ?? ''}`.toLowerCase();
  return (
    haystack.includes('otp_expired') ||
    haystack.includes('token_expired') ||
    haystack.includes('expired') ||
    haystack.includes('invalid_grant')
  );
}

export function classifyAuthCallbackFailure(params: {
  error?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  type?: string | null;
  next?: string | null;
  hasTokenOrCode: boolean;
}): {
  redirectPath: string;
  code: string;
} {
  const isRecovery = params.type === 'recovery' || params.next === '/reset-password';
  const expired = isExpiredAuthError(params);

  if (isRecovery) {
    return {
      redirectPath: '/reset-password?error=recovery_link_expired',
      code: 'recovery_link_expired',
    };
  }

  if (expired) {
    return {
      redirectPath: '/login?error=link_expired',
      code: 'link_expired',
    };
  }

  if (!params.hasTokenOrCode && !params.error) {
    return {
      redirectPath: '/login?error=missing_verification_code',
      code: 'missing_verification_code',
    };
  }

  return {
    redirectPath: '/login?error=auth_callback_error',
    code: 'auth_callback_error',
  };
}

export function resolveAuthPageNotice(params: {
  reason?: string | null;
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}): AuthNotice | null {
  if (params.reason === 'session_too_large') {
    return {
      tone: 'warning',
      code: 'session_too_large',
      message: 'Oturum verileriniz çok büyük olduğu için temizlendi. Lütfen tekrar giriş yapın.',
    };
  }

  if (params.reason === 'session_expired') {
    return {
      tone: 'warning',
      code: 'session_expired',
      message: 'Oturumunuzun süresi doldu veya geçersiz hale geldi. Güvenliğiniz için lütfen yeniden giriş yapın.',
    };
  }

  if (params.error === 'recovery_link_expired') {
    return {
      tone: 'error',
      code: 'recovery_link_expired',
      message:
        'Şifre sıfırlama bağlantısının süresi dolmuş veya daha önce kullanılmış. Güvenlik için yeni bir sıfırlama bağlantısı isteyin.',
      actionHref: '/forgot-password',
      actionLabel: 'Yeni Sıfırlama Bağlantısı İste',
    };
  }

  if (params.error === 'link_expired' || params.errorCode === 'otp_expired' || isExpiredAuthError(params)) {
    return {
      tone: 'error',
      code: 'link_expired',
      message:
        'Doğrulama bağlantısının süresi dolmuş veya geçersiz hale gelmiş. Yeni bir doğrulama veya şifre sıfırlama bağlantısı talep edebilirsiniz.',
      actionHref: '/forgot-password',
      actionLabel: 'Yeni Bağlantı İste',
    };
  }

  if (
    params.error === 'auth_callback_error' ||
    params.error === 'access_denied' ||
    params.error === 'missing_verification_code' ||
    params.error
  ) {
    const desc = params.errorDescription?.trim();
    return {
      tone: 'error',
      code: params.error || 'auth_callback_error',
      message:
        desc && !desc.toLowerCase().includes('internal')
          ? `Doğrulama tamamlanamadı (${desc}). Lütfen tekrar giriş yapın veya yeni bağlantı isteyin.`
          : 'Oturum doğrulaması tamamlanamadı veya bağlantı geçersiz. Lütfen tekrar giriş yapın.',
    };
  }

  return null;
}

export function validateRegisterInput(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (!input.fullName.trim()) {
    return 'Lütfen adınızı ve soyadınızı girin.';
  }
  const cleanEmail = input.email.trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'Lütfen geçerli bir e-posta adresi girin.';
  }
  if (input.password.length < 6) {
    return 'Şifre en az 6 karakter olmalıdır.';
  }
  if (input.password !== input.confirmPassword) {
    return 'Şifreler eşleşmiyor.';
  }
  return null;
}

export function mapAuthErrorMessage(
  error: { message?: string | null; code?: string | null; status?: number } | null | undefined,
  context: AuthFlowContext
): string {
  const raw = (error?.message || '').trim();
  const code = (error?.code || '').trim().toLowerCase();
  const lower = raw.toLowerCase();

  if (lower.includes('invalid login credentials') || code === 'invalid_credentials') {
    return 'E-posta veya şifre hatalı.';
  }
  if (lower.includes('email not confirmed') || code === 'email_not_confirmed') {
    return 'E-posta adresiniz henüz doğrulanmamış. Lütfen gelen kutunuzdaki onay bağlantısına tıklayın.';
  }
  if (lower.includes('user already registered') || code === 'user_already_exists') {
    return 'Bu e-posta adresi ile kayıtlı bir hesap zaten bulunuyor. Giriş yapabilir veya şifrenizi sıfırlayabilirsiniz.';
  }
  if (lower.includes('new password should be different')) {
    return 'Yeni şifreniz mevcut şifrenizle aynı olamaz.';
  }
  if (
    lower.includes('auth session missing') ||
    lower.includes('session_not_found') ||
    error?.status === 401 ||
    error?.status === 403
  ) {
    return context === 'reset_password'
      ? 'Aktif şifre sıfırlama oturumu bulunamadı veya süresi doldu. Lütfen yeni bir sıfırlama bağlantısı isteyin.'
      : 'Oturum doğrulaması başarısız veya süresi dolmuş. Lütfen tekrar giriş yapın.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || error?.status === 429) {
    return 'Çok fazla deneme yapıldı. Lütfen kısa bir süre bekleyip tekrar deneyin.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  }
  if (isExpiredAuthError({ error: code, errorMessage: raw })) {
    return 'Doğrulama bağlantısının süresi dolmuş. Lütfen yeni bir bağlantı talep edin.';
  }
  if (raw) return raw;

  switch (context) {
    case 'login':
      return 'Giriş yapılamadı. Bilgilerinizi kontrol edip tekrar deneyin.';
    case 'register':
      return 'Kayıt işlemi tamamlanamadı. Lütfen tekrar deneyin.';
    case 'forgot_password':
      return 'Şifre sıfırlama bağlantısı gönderilemedi. Lütfen tekrar deneyin.';
    case 'reset_password':
      return 'Şifre güncellenemedi. Lütfen tekrar deneyin.';
  }
}
