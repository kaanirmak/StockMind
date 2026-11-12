export type EmailDeliveryStatus = 'pending' | 'processing' | 'accepted' | 'failed' | 'retry_scheduled';

export interface EmailDeliveryQueueRecord {
  id?: string;
  claim_token?: string | null;
  bulletin_date: string;
  job_type: string;
  recipient_email: string;
  recipient_name?: string | null;
  status: EmailDeliveryStatus;
  attempt_count: number;
  max_attempts: number;
  next_retry_at?: string | null;
  sender_email?: string | null;
  transport_method?: string | null;
  provider_message_id?: string | null;
  last_error?: string | null;
  idempotency_key: string;
  created_at?: string;
  updated_at?: string;
  sent_at?: string | null;
}

export interface QueueRecipientInput {
  email: string;
  name?: string;
}

export interface EnqueueResult {
  persisted: boolean;
  existingByEmail: Map<string, EmailDeliveryQueueRecord>;
}

export interface DeliveryQueueSummary {
  pending: number;
  processing: number;
  accepted: number;
  failed: number;
  retryScheduled: number;
  total: number;
  bulletinDate: string;
  available: boolean;
  recentItems: EmailDeliveryQueueRecord[];
}

export const DEFAULT_MAX_DELIVERY_ATTEMPTS = 3;

export function buildDeliveryIdempotencyKey(
  bulletinDate: string,
  recipientEmail: string,
  jobType = 'daily_bulletin'
): string {
  return `${jobType}:${bulletinDate}:${recipientEmail.trim().toLowerCase()}`;
}

function hasTableSupport(admin: any): boolean {
  return Boolean(admin && typeof admin.from === 'function');
}

function isMissingTableError(error: any): boolean {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || message.includes('email_delivery_queue');
}

/**
 * Pure check deciding whether a recipient has already been accepted for the bulletin date
 * so retries and re-triggers never create duplicate deliveries.
 */
export function shouldSkipDuplicateDelivery(
  existingRow: Pick<EmailDeliveryQueueRecord, 'status'> | null | undefined,
  inMemoryAlreadySent: boolean,
  force = false
): boolean {
  if (force) return false;
  return existingRow?.status === 'accepted' || inMemoryAlreadySent;
}

/** Atomically reserve the recipient before touching an external mail provider. */
export async function claimBulletinDelivery(
  admin: any,
  bulletinDate: string,
  recipientEmail: string,
  claimToken: string,
  force = false,
): Promise<EmailDeliveryQueueRecord | null> {
  const { data, error } = await admin.rpc('claim_bulletin_delivery', {
    p_bulletin_date: bulletinDate,
    p_recipient_email: recipientEmail.trim().toLowerCase(),
    p_claim_token: claimToken,
    p_force: force,
  });
  if (error) throw new Error('Bülten gönderim kilidi alınamadı.');
  return data || null;
}

/**
 * Ensures every eligible recipient has a persistent queue row before dispatch begins
 * without overwriting already completed ('accepted') rows across process restarts.
 */
export async function enqueueBulletinRecipients(
  admin: any,
  bulletinDate: string,
  recipients: QueueRecipientInput[],
  options: { jobType?: string; maxAttempts?: number } = {}
): Promise<EnqueueResult> {
  const existingByEmail = new Map<string, EmailDeliveryQueueRecord>();
  if (!hasTableSupport(admin) || recipients.length === 0) {
    return { persisted: false, existingByEmail };
  }

  const jobType = options.jobType || 'daily_bulletin';
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_DELIVERY_ATTEMPTS;

  try {
    const existingRes = await admin
      .from('email_delivery_queue')
      .select('*')
      .eq('bulletin_date', bulletinDate)
      .eq('job_type', jobType);

    if (existingRes?.error) {
      if (isMissingTableError(existingRes.error)) {
        return { persisted: false, existingByEmail };
      }
      throw existingRes.error;
    }

    for (const row of existingRes?.data || []) {
      if (row?.recipient_email) {
        existingByEmail.set(String(row.recipient_email).trim().toLowerCase(), row);
      }
    }

    const toInsert: EmailDeliveryQueueRecord[] = [];
    for (const recipient of recipients) {
      const normalizedEmail = recipient.email.trim().toLowerCase();
      if (!normalizedEmail || existingByEmail.has(normalizedEmail)) continue;
      const nowIso = new Date().toISOString();
      const row: EmailDeliveryQueueRecord = {
        bulletin_date: bulletinDate,
        job_type: jobType,
        recipient_email: normalizedEmail,
        recipient_name: recipient.name?.trim() || null,
        status: 'pending',
        attempt_count: 0,
        max_attempts: maxAttempts,
        idempotency_key: buildDeliveryIdempotencyKey(bulletinDate, normalizedEmail, jobType),
        created_at: nowIso,
        updated_at: nowIso,
      };
      toInsert.push(row);
    }

    if (toInsert.length > 0) {
      const upsertRes = await admin
        .from('email_delivery_queue')
        .upsert(toInsert, {
          onConflict: 'bulletin_date,job_type,recipient_email',
          ignoreDuplicates: true,
        })
        .select?.('*');

      if (upsertRes?.error) {
        if (isMissingTableError(upsertRes.error)) {
          return { persisted: false, existingByEmail };
        }
        throw upsertRes.error;
      }

      const insertedRows: EmailDeliveryQueueRecord[] = Array.isArray(upsertRes?.data) && upsertRes.data.length > 0
        ? upsertRes.data
        : toInsert;
      for (const row of insertedRows) {
        if (row?.recipient_email) {
          existingByEmail.set(String(row.recipient_email).trim().toLowerCase(), row);
        }
      }
    }

    return { persisted: true, existingByEmail };
  } catch (err) {
    console.warn('email_delivery_queue enqueue failed:', err);
    return { persisted: false, existingByEmail };
  }
}

/**
 * Updates durable queue state after a delivery attempt, distinguishing accepted,
 * retry_scheduled, and terminal failed items across restarts.
 */
export async function recordDeliveryOutcome(
  admin: any,
  params: {
    bulletinDate: string;
    recipientEmail: string;
    recipientName?: string;
    jobType?: string;
    previousAttemptCount?: number;
    maxAttempts?: number;
    success: boolean;
    claimToken: string;
    senderAddress?: string | null;
    method?: string | null;
    messageId?: string | null;
    errorMessage?: string | null;
  }
): Promise<EmailDeliveryQueueRecord | null> {
  const jobType = params.jobType || 'daily_bulletin';
  const normalizedEmail = params.recipientEmail.trim().toLowerCase();
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_DELIVERY_ATTEMPTS;
  const nextAttemptCount = Math.max(1, params.previousAttemptCount ?? 1);
  const now = new Date();
  const nowIso = now.toISOString();

  let status: EmailDeliveryStatus;
  let nextRetryAt: string | null = null;
  if (params.success) {
    status = 'accepted';
  } else if (nextAttemptCount < maxAttempts) {
    status = 'retry_scheduled';
    const backoffMinutes = Math.min(60, 5 * Math.pow(2, nextAttemptCount - 1));
    nextRetryAt = new Date(now.getTime() + backoffMinutes * 60_000).toISOString();
  } else {
    status = 'failed';
  }

  const record: EmailDeliveryQueueRecord = {
    bulletin_date: params.bulletinDate,
    job_type: jobType,
    recipient_email: normalizedEmail,
    recipient_name: params.recipientName?.trim() || null,
    status,
    attempt_count: nextAttemptCount,
    max_attempts: maxAttempts,
    next_retry_at: nextRetryAt,
    sender_email: params.senderAddress ?? null,
    transport_method: params.method ?? null,
    provider_message_id: params.messageId ?? null,
    last_error: params.success ? null : (params.errorMessage?.slice(0, 500) || 'Teslimat başarısız'),
    idempotency_key: buildDeliveryIdempotencyKey(params.bulletinDate, normalizedEmail, jobType),
    updated_at: nowIso,
    sent_at: params.success ? nowIso : null,
  };

  const { data, error } = await admin.rpc('complete_bulletin_delivery', {
    p_claim_token: params.claimToken,
    p_result: record,
  });
  if (error || !data) throw new Error('Bülten sonucu kalıcı kaydedilemedi; gönderim otomatik tekrarlanmayacak.');
  return data as EmailDeliveryQueueRecord;
}

export async function summarizeDeliveryQueue(
  admin: any,
  bulletinDate?: string
): Promise<DeliveryQueueSummary> {
  const targetDate = bulletinDate || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const empty: DeliveryQueueSummary = {
    pending: 0,
    processing: 0,
    accepted: 0,
    failed: 0,
    retryScheduled: 0,
    total: 0,
    bulletinDate: targetDate,
    available: false,
    recentItems: [],
  };

  if (!hasTableSupport(admin)) return empty;

  try {
    const res = await admin
      .from('email_delivery_queue')
      .select('*')
      .eq('bulletin_date', targetDate)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (res?.error) {
      if (isMissingTableError(res.error)) return empty;
      throw res.error;
    }

    const rows: EmailDeliveryQueueRecord[] = Array.isArray(res?.data) ? res.data : [];
    let pending = 0;
    let processing = 0;
    let accepted = 0;
    let failed = 0;
    let retryScheduled = 0;

    for (const row of rows) {
      if (row.status === 'pending') pending += 1;
      else if (row.status === 'processing') processing += 1;
      else if (row.status === 'accepted') accepted += 1;
      else if (row.status === 'failed') failed += 1;
      else if (row.status === 'retry_scheduled') retryScheduled += 1;
    }

    return {
      pending,
      processing,
      accepted,
      failed,
      retryScheduled,
      total: rows.length,
      bulletinDate: targetDate,
      available: true,
      recentItems: rows.slice(0, 20),
    };
  } catch (err) {
    console.warn('email_delivery_queue summarize failed:', err);
    return empty;
  }
}
