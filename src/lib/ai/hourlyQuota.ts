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

// In-memory timestamps store per user (sliding window)
const userQuestionTimestamps = new Map<string, number[]>();

/**
 * Filter out timestamps older than 1 hour for a given user.
 */
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

/**
 * Inspect the current hourly quota status without consuming a question credit.
 */
export function getHourlyChatQuota(userId: string, isPro: boolean): HourlyQuotaStatus {
  const now = Date.now();
  const limit = isPro ? HOURLY_QUOTA_PRO : HOURLY_QUOTA_STANDARD;
  const timestamps = getActiveTimestamps(userId, now);
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

/**
 * Check and consume 1 question credit from the user's hourly quota.
 * Returns the updated quota status.
 */
export function checkAndConsumeHourlyChatQuota(userId: string, isPro: boolean): HourlyQuotaStatus {
  const now = Date.now();
  const limit = isPro ? HOURLY_QUOTA_PRO : HOURLY_QUOTA_STANDARD;
  const timestamps = getActiveTimestamps(userId, now);
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

  // Record this question
  timestamps.push(now);
  userQuestionTimestamps.set(userId, timestamps);

  const newUsed = timestamps.length;
  const remaining = Math.max(0, limit - newUsed);

  return {
    limit,
    used: newUsed,
    remaining,
    retryAfter: 0,
    allowed: true,
    isPro,
  };
}

/**
 * Reset quota tracking for testing or administrative purposes.
 */
export function resetHourlyChatQuota(userId?: string): void {
  if (userId) {
    userQuestionTimestamps.delete(userId);
  } else {
    userQuestionTimestamps.clear();
  }
}
