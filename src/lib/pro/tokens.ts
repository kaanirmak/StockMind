import { createHmac, timingSafeEqual } from 'crypto';

interface TokenPayload {
  userId: string;
  email: string;
  action: 'approve' | 'reject';
  exp: number; // timestamp in ms
}

function getSecretKey(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET || 'stockmind-pro-approval-secret-key-2026';
  return secret.trim();
}

/**
 * Creates an HMAC-SHA256 signed action token for email approval/rejection.
 * Default validity: 30 days.
 */
export function createProActionToken(
  userId: string,
  email: string,
  action: 'approve' | 'reject',
  validityDays = 30
): string {
  const payload: TokenPayload = {
    userId,
    email: email.toLowerCase().trim(),
    action,
    exp: Date.now() + validityDays * 24 * 60 * 60 * 1000,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getSecretKey()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Validates the HMAC signature and expiration of a Pro action token.
 */
export function verifyProActionToken(token: string): {
  valid: boolean;
  userId?: string;
  email?: string;
  action?: 'approve' | 'reject';
  error?: string;
} {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Belirteç (token) eksik.' };
    }

    const parts = token.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Geçersiz belirteç biçimi.' };
    }

    const [payloadB64, signature] = parts;
    const expectedSig = createHmac('sha256', getSecretKey()).update(payloadB64).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: 'Yetkisiz veya bozulmuş belirteç imzası.' };
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    if (!payload.userId || !payload.email || !payload.action || !payload.exp) {
      return { valid: false, error: 'Geçersiz belirteç verisi.' };
    }

    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Onay bağlantısının süresi dolmuş (30 gün).' };
    }

    return {
      valid: true,
      userId: payload.userId,
      email: payload.email,
      action: payload.action,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Belirteç doğrulanamadı.' };
  }
}
