import { createClient } from '@/lib/supabase/server';

export interface HourlyQuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  retryAfter: number;
  allowed: boolean;
  isPro: boolean;
}

async function quotaOperation(mode: 'inspect' | 'consume' | 'refund', requestId?: string): Promise<HourlyQuotaStatus> {
  const client = await createClient();
  const { data, error } = await client.rpc('ai_hourly_quota', { p_mode: mode, p_request_id: requestId ?? null });
  if (error || !data || typeof data.allowed !== 'boolean' || typeof data.isPro !== 'boolean' ||
      !Number.isInteger(data.limit) || data.limit < 1 || !Number.isInteger(data.used) || data.used < 0 ||
      !Number.isInteger(data.remaining) || data.remaining < 0 ||
      data.remaining !== Math.max(0, data.limit - data.used) || !Number.isFinite(data.retryAfter) || data.retryAfter < 0) {
    throw new Error('Saatlik AI kotası doğrulanamadı.');
  }
  return data as HourlyQuotaStatus;
}

export const getHourlyChatQuota = () => quotaOperation('inspect');
export const checkAndConsumeHourlyChatQuota = (requestId: string) => quotaOperation('consume', requestId);
export const refundHourlyChatQuota = (requestId: string) => quotaOperation('refund', requestId);
