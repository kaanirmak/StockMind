import { createClient } from '@/lib/supabase/server';

export const HOURLY_QUOTA_STANDARD = 5;
export const HOURLY_QUOTA_PRO = 20;
export const HOURLY_WINDOW_MS = 60 * 60 * 1000; // 1 hour sliding window

export interface HourlyQuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  retryAfter: number;
  allowed: boolean;
  isPro: boolean;
}

// In-memory timestamps store per user (sliding window fallback)
const userQuestionTimestamps = new Map<string, number[]>();
const requestReservations = new Map<string, { userId: string; timestamp: number }>();

function getActiveTimestamps(userId: string, now: number): number[] {
  const cutoff = now - HOURLY_WINDOW_MS;
  const list = userQuestionTimestamps.get(userId) || [];
  const active = list.filter((ts) => ts > cutoff);
  if (active.length !== list.length) {
    if (active.length === 0) {
      userQuestionTimestamps.delete(userId);
    } else {
      userQuestionTimestamps.set(userId, active);
    }
  }
  return active;
}

function inMemoryQuota(
  mode: 'inspect' | 'consume' | 'refund',
  userId: string,
  isPro: boolean,
  requestId?: string
): HourlyQuotaStatus {
  const now = Date.now();
  const limit = isPro ? HOURLY_QUOTA_PRO : HOURLY_QUOTA_STANDARD;
  const timestamps = getActiveTimestamps(userId, now);

  if (mode === 'refund') {
    if (requestId && requestReservations.has(requestId)) {
      const reservation = requestReservations.get(requestId)!;
      requestReservations.delete(requestId);
      const list = userQuestionTimestamps.get(reservation.userId) || [];
      const idx = list.indexOf(reservation.timestamp);
      if (idx !== -1) {
        list.splice(idx, 1);
        if (list.length === 0) userQuestionTimestamps.delete(reservation.userId);
        else userQuestionTimestamps.set(reservation.userId, list);
      }
    } else if (timestamps.length > 0) {
      timestamps.pop();
      if (timestamps.length === 0) userQuestionTimestamps.delete(userId);
      else userQuestionTimestamps.set(userId, timestamps);
    }
    const currentActive = getActiveTimestamps(userId, now);
    const used = currentActive.length;
    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      retryAfter: 0,
      allowed: true,
      isPro,
    };
  }

  if (mode === 'consume') {
    const used = timestamps.length;
    if (used >= limit) {
      const oldest = timestamps[0];
      const retryAfter = Math.max(1, Math.ceil((oldest + HOURLY_WINDOW_MS - now) / 1000));
      return {
        limit,
        used,
        remaining: 0,
        retryAfter,
        allowed: false,
        isPro,
      };
    }
    timestamps.push(now);
    userQuestionTimestamps.set(userId, timestamps);
    if (requestId) {
      requestReservations.set(requestId, { userId, timestamp: now });
    }
    const newUsed = timestamps.length;
    return {
      limit,
      used: newUsed,
      remaining: Math.max(0, limit - newUsed),
      retryAfter: 0,
      allowed: true,
      isPro,
    };
  }

  // mode === 'inspect'
  const used = timestamps.length;
  const remaining = Math.max(0, limit - used);
  const allowed = remaining > 0;
  let retryAfter = 0;
  if (!allowed && timestamps.length > 0) {
    const oldest = timestamps[0];
    retryAfter = Math.max(1, Math.ceil((oldest + HOURLY_WINDOW_MS - now) / 1000));
  }
  return {
    limit,
    used,
    remaining,
    retryAfter,
    allowed,
    isPro,
  };
}

async function quotaOperation(
  mode: 'inspect' | 'consume' | 'refund',
  requestId?: string,
  userId?: string,
  isPro?: boolean
): Promise<HourlyQuotaStatus> {
  const client = await createClient();
  const { data, error } = await client.rpc('ai_hourly_quota', { p_mode: mode, p_request_id: requestId ?? null });

  // If the database has the ai_hourly_quota RPC installed, validate and use its durable state
  if (!error && data) {
    if (typeof data.allowed === 'boolean' && typeof data.isPro === 'boolean' &&
        Number.isInteger(data.limit) && data.limit >= 1 && Number.isInteger(data.used) && data.used >= 0 &&
        Number.isInteger(data.remaining) && data.remaining >= 0 &&
        data.remaining === Math.max(0, data.limit - data.used) && Number.isFinite(data.retryAfter) && data.retryAfter >= 0) {
      return data as HourlyQuotaStatus;
    }
    throw new Error('Saatlik AI kotası doğrulanamadı.');
  }

  // If database RPC is not installed (PGRST202 or function not defined in schema cache),
  // fall back to in-memory sliding-window quota tracking for authenticated users
  const isRpcMissing = error && (
    error.code === 'PGRST202' ||
    (typeof error.message === 'string' && (
      error.message.includes('ai_hourly_quota') ||
      error.message.includes('schema cache') ||
      error.message.includes('Could not find')
    ))
  );

  if (isRpcMissing && userId) {
    return inMemoryQuota(mode, userId, Boolean(isPro), requestId);
  }

  throw new Error('Saatlik AI kotası doğrulanamadı.');
}

export const getHourlyChatQuota = (userId?: string, isPro?: boolean) => quotaOperation('inspect', undefined, userId, isPro);
export const checkAndConsumeHourlyChatQuota = (requestId: string, userId?: string, isPro?: boolean) => quotaOperation('consume', requestId, userId, isPro);
export const refundHourlyChatQuota = (requestId: string, userId?: string, isPro?: boolean) => quotaOperation('refund', requestId, userId, isPro);
