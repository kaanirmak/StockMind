export type BulletinRunStatus =
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'missed'
  | 'no_recipients';

export interface BulletinRunTelemetryRecord {
  id?: string;
  bulletin_date: string;
  job_type: string;
  scheduled_for: string;
  started_at: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  schedule_delay_ms?: number | null;
  status: BulletinRunStatus;
  recipients_count: number;
  successful_count: number;
  trigger_source?: string;
  notes?: string | null;
}

export interface BulletinScheduleSummary {
  available: boolean;
  latestRun: {
    bulletinDate: string;
    scheduledFor: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    scheduleDelayMs: number | null;
    status: BulletinRunStatus;
    recipientsCount: number;
    successfulCount: number;
  } | null;
  missedDates: string[];
  missedCount: number;
  recentRuns: BulletinRunTelemetryRecord[];
}

export const SCHEDULED_BULLETIN_GRACE_MINUTES = 20;

/**
 * Computes the scheduled daily 18:30 Europe/Istanbul bulletin time (UTC+3 = 15:30:00Z).
 */
export function computeScheduledBulletinTime(bulletinDate: string): Date {
  const cleanDate = bulletinDate.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const parsed = new Date(`${cleanDate}T18:30:00+03:00`);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }
  const fallbackDay = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  return new Date(`${fallbackDay}T18:30:00+03:00`);
}

export function isBulletinWeekday(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const parsed = new Date(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return false;
  const day = parsed.getUTCDay();
  return day >= 1 && day <= 5;
}

export function calculateScheduleMetrics(input: {
  scheduledFor: Date;
  startedAt: Date;
  finishedAt?: Date | null;
}): {
  scheduleDelayMs: number;
  durationMs: number | null;
} {
  const schedMs = input.scheduledFor.getTime();
  const startMs = input.startedAt.getTime();
  const scheduleDelayMs =
    Number.isFinite(schedMs) && Number.isFinite(startMs)
      ? Math.max(0, startMs - schedMs)
      : 0;

  let durationMs: number | null = null;
  if (input.finishedAt) {
    const finishMs = input.finishedAt.getTime();
    if (Number.isFinite(finishMs) && Number.isFinite(startMs)) {
      durationMs = Math.max(0, finishMs - startMs);
    }
  }

  return { scheduleDelayMs, durationMs };
}

function getIstanbulDayKey(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

export function detectMissedBulletinRuns(input: {
  recentRuns: readonly BulletinRunTelemetryRecord[];
  now?: Date;
  lookbackDays?: number;
  graceMinutes?: number;
}): string[] {
  const now = input.now ?? new Date();
  const lookbackDays = input.lookbackDays ?? 7;
  const graceMs = (input.graceMinutes ?? SCHEDULED_BULLETIN_GRACE_MINUTES) * 60_000;

  const coveredDates = new Set<string>();
  for (const run of input.recentRuns) {
    if (
      run &&
      typeof run.bulletin_date === 'string' &&
      (run.status === 'completed' ||
        run.status === 'partial' ||
        run.status === 'no_recipients' ||
        run.status === 'running')
    ) {
      coveredDates.add(run.bulletin_date.slice(0, 10));
    }
  }

  const todayKey = getIstanbulDayKey(now);
  const todayAnchor = new Date(`${todayKey}T12:00:00Z`);
  if (!Number.isFinite(todayAnchor.getTime())) return [];

  const missed: string[] = [];
  for (let offset = 0; offset < lookbackDays; offset += 1) {
    const candidateDate = new Date(todayAnchor.getTime() - offset * 86_400_000);
    const dateKey = candidateDate.toISOString().slice(0, 10);
    if (!isBulletinWeekday(dateKey)) continue;

    const scheduled = computeScheduledBulletinTime(dateKey);
    if (now.getTime() < scheduled.getTime() + graceMs) {
      continue;
    }

    if (!coveredDates.has(dateKey)) {
      missed.push(dateKey);
    }
  }

  return missed.sort((a, b) => b.localeCompare(a));
}

function hasTableSupport(admin: any): boolean {
  return Boolean(admin && typeof admin.from === 'function');
}

export async function recordBulletinRunStart(
  admin: any,
  input: {
    bulletinDate: string;
    scheduledFor: Date;
    startedAt: Date;
    triggerSource?: string;
    recipientsCount?: number;
  }
): Promise<string | null> {
  if (!hasTableSupport(admin)) return null;
  try {
    const { scheduleDelayMs } = calculateScheduleMetrics({
      scheduledFor: input.scheduledFor,
      startedAt: input.startedAt,
    });
    const res = await admin
      .from('bulletin_run_telemetry')
      .insert({
        bulletin_date: input.bulletinDate,
        job_type: 'daily_bulletin',
        scheduled_for: input.scheduledFor.toISOString(),
        started_at: input.startedAt.toISOString(),
        schedule_delay_ms: scheduleDelayMs,
        status: 'running',
        recipients_count: input.recipientsCount ?? 0,
        successful_count: 0,
        trigger_source: input.triggerSource || 'cron',
      })
      .select('id')
      .maybeSingle();

    if (res?.error) return null;
    return res?.data?.id ? String(res.data.id) : null;
  } catch {
    return null;
  }
}

export async function recordBulletinRunFinish(
  admin: any,
  input: {
    runId: string | null;
    bulletinDate: string;
    scheduledFor: Date;
    startedAt: Date;
    finishedAt: Date;
    status: BulletinRunStatus;
    recipientsCount: number;
    successfulCount: number;
    triggerSource?: string;
    notes?: string;
  }
): Promise<BulletinRunTelemetryRecord> {
  const { scheduleDelayMs, durationMs } = calculateScheduleMetrics({
    scheduledFor: input.scheduledFor,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
  });

  const payload: BulletinRunTelemetryRecord = {
    id: input.runId ?? undefined,
    bulletin_date: input.bulletinDate,
    job_type: 'daily_bulletin',
    scheduled_for: input.scheduledFor.toISOString(),
    started_at: input.startedAt.toISOString(),
    finished_at: input.finishedAt.toISOString(),
    duration_ms: durationMs,
    schedule_delay_ms: scheduleDelayMs,
    status: input.status,
    recipients_count: input.recipientsCount,
    successful_count: input.successfulCount,
    trigger_source: input.triggerSource || 'cron',
    notes: input.notes ?? null,
  };

  if (!hasTableSupport(admin)) {
    return payload;
  }

  try {
    if (input.runId) {
      await admin
        .from('bulletin_run_telemetry')
        .update({
          finished_at: payload.finished_at,
          duration_ms: payload.duration_ms,
          schedule_delay_ms: payload.schedule_delay_ms,
          status: payload.status,
          recipients_count: payload.recipients_count,
          successful_count: payload.successful_count,
          notes: payload.notes,
        })
        .eq('id', input.runId);
    } else {
      await admin.from('bulletin_run_telemetry').insert({
        bulletin_date: payload.bulletin_date,
        job_type: payload.job_type,
        scheduled_for: payload.scheduled_for,
        started_at: payload.started_at,
        finished_at: payload.finished_at,
        duration_ms: payload.duration_ms,
        schedule_delay_ms: payload.schedule_delay_ms,
        status: payload.status,
        recipients_count: payload.recipients_count,
        successful_count: payload.successful_count,
        trigger_source: payload.trigger_source,
        notes: payload.notes,
      });
    }
  } catch {
    // Non-fatal: cron still returns complete metrics even if telemetry write fails
  }

  return payload;
}

export async function summarizeBulletinScheduleTelemetry(
  admin: any,
  now: Date = new Date()
): Promise<BulletinScheduleSummary> {
  if (!hasTableSupport(admin)) {
    return {
      available: false,
      latestRun: null,
      missedDates: [],
      missedCount: 0,
      recentRuns: [],
    };
  }

  try {
    const res = await admin
      .from('bulletin_run_telemetry')
      .select('*')
      .eq('job_type', 'daily_bulletin')
      .order('started_at', { ascending: false })
      .limit(20);

    if (res?.error) {
      return {
        available: false,
        latestRun: null,
        missedDates: [],
        missedCount: 0,
        recentRuns: [],
      };
    }

    const recentRuns: BulletinRunTelemetryRecord[] = Array.isArray(res?.data) ? res.data : [];
    const latest = recentRuns[0] ?? null;
    const missedDates = detectMissedBulletinRuns({ recentRuns, now });

    return {
      available: true,
      latestRun: latest
        ? {
            bulletinDate: latest.bulletin_date,
            scheduledFor: latest.scheduled_for,
            startedAt: latest.started_at,
            finishedAt: latest.finished_at ?? null,
            durationMs: latest.duration_ms ?? null,
            scheduleDelayMs: latest.schedule_delay_ms ?? null,
            status: latest.status,
            recipientsCount: latest.recipients_count,
            successfulCount: latest.successful_count,
          }
        : null,
      missedDates,
      missedCount: missedDates.length,
      recentRuns: recentRuns.slice(0, 7),
    };
  } catch {
    return {
      available: false,
      latestRun: null,
      missedDates: [],
      missedCount: 0,
      recentRuns: [],
    };
  }
}
