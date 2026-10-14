import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type ProtectedAction = 'ai_chat' | 'ai_committee' | 'test_email';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  // Provider/database errors can contain credentials or request content.
  redactedLog('error', 'Unhandled server error', { errorType: error instanceof Error ? error.name : typeof error });
  return NextResponse.json(
    { success: false, error: 'İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.' },
    { status: 503 }
  );
}

/**
 * Structured logger with automatic sensitive data redaction (OPS-04).
 */
export function redactedLog(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  const safeMeta: Record<string, unknown> = {};
  if (meta) {
    for (const [key, val] of Object.entries(meta)) {
      if (/key|secret|token|pass|auth|email|cookie|header/i.test(key)) {
        safeMeta[key] = '[REDACTED]';
      } else {
        safeMeta[key] = val;
      }
    }
  }
  const timestamp = new Date().toISOString();
  if (level === 'error') {
    console.error(`[${timestamp}] [ERROR] ${message}`, safeMeta);
  } else if (level === 'warn') {
    console.warn(`[${timestamp}] [WARN] ${message}`, safeMeta);
  } else {
    console.log(`[${timestamp}] [INFO] ${message}`, safeMeta);
  }
}

/** Verify identity and a database-backed quota before any paid/provider work. */
export async function authorizeAction(request: Request, action: ProtectedAction) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, 'Bu kaynaktan istek kabul edilmiyor.');
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, 'Devam etmek için giriş yapın.');

  const { data: quota, error: quotaError } = await supabase.rpc('consume_api_quota', {
    p_action: action,
  });
  if (quotaError || !quota || typeof quota.allowed !== 'boolean') {
    throw new ApiError(503, 'Kullanım sınırı doğrulanamadı. Lütfen daha sonra tekrar deneyin.');
  }
  if (!quota.allowed) {
    const retryAfter = Number.isFinite(quota.retry_after) ? Math.max(1, Math.ceil(quota.retry_after)) : 60;
    return {
      response: NextResponse.json(
        { success: false, error: 'Kullanım sınırına ulaştınız. Lütfen daha sonra tekrar deneyin.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      ),
      user: null,
    } as const;
  }
  return { response: null, user: data.user } as const;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Bound actual bytes, even when Content-Length is missing or inaccurate. */
export async function readJsonObject(request: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'İstek JSON biçiminde olmalıdır.');
  }
  const declaredSize = Number(request.headers.get('content-length'));
  if (declaredSize > maxBytes) throw new ApiError(413, 'İstek çok büyük.');
  if (!request.body) throw new ApiError(400, 'İstek gövdesi zorunludur.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'İstek çok büyük.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw new ApiError(400, 'Geçersiz JSON.');
  }
  if (!isRecord(parsed)) throw new ApiError(400, 'İstek bir JSON nesnesi olmalıdır.');
  return parsed;
}

export function optionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ApiError(400, 'Geçersiz veya çok uzun metin alanı.');
  }
  return value.trim() || undefined;
}
