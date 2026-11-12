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

async function quotaOperation(
  mode: 'inspect' | 'consume' | 'refund',
  requestId?: string,
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

  throw new Error('Saatlik AI kotası doğrulanamadı.');
}

export const getHourlyChatQuota = () => quotaOperation('inspect');
export const checkAndConsumeHourlyChatQuota = (requestId: string) => quotaOperation('consume', requestId);
export const refundHourlyChatQuota = (requestId: string) => quotaOperation('refund', requestId);
