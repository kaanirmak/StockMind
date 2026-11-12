export type ApplicationLogLevel = 'info' | 'warn' | 'error';
export interface ApplicationLogInput {
  level: ApplicationLogLevel;
  area: 'email' | 'bulletin' | 'admin' | 'api';
  event: string;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
}

const SENSITIVE_KEY = /password|passwd|secret|token|authorization|cookie|headers?|recipient|email|smtp_user|api.?key|html|payload|body/i;

/** Persist operational facts only; never copy provider objects, headers or message bodies. */
export function redactLogValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (typeof value === 'string') {
    let clean = value
      .replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer [REDACTED]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
      .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => { try { const u = new URL(url); return `${u.origin}${u.pathname}`; } catch { return '[URL]'; } });
    for (const key of ['SMTP_PASS', 'CRON_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'OPENROUTER_API_KEY', 'RESEND_API_KEY', 'BREVO_API_KEY']) {
      const secret = process.env[key]?.trim();
      if (secret && secret.length >= 4) clean = clean.split(secret).join('[REDACTED]');
    }
    return clean.slice(0, 1000);
  }
  if (Array.isArray(value)) return value.slice(0, 15).map(v => redactLogValue(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 25)
    .map(([key, item]) => [key.slice(0, 80), SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactLogValue(item, depth + 1)]));
  return typeof value === 'number' && !Number.isFinite(value) ? null : value;
}

/** Awaited at important boundaries so Workers do not discard a detached log write. */
export async function recordApplicationLog(input: ApplicationLogInput, client?: any) {
  try {
    const admin = client ?? (await import('@/lib/supabase/admin')).createAdminClient();
    const { error } = await admin.from('application_logs').insert({
      level: input.level,
      area: input.area,
      event: input.event.slice(0, 80),
      message: String(redactLogValue(input.message)).slice(0, 500),
      request_id: input.requestId ?? null,
      context: redactLogValue(input.context ?? {}),
    });
    if (error) throw new Error('Log write unavailable');
    return true;
  } catch {
    console.warn('Application log persistence unavailable', { area: input.area, event: input.event });
    return false;
  }
}
