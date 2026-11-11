export interface NewsResponseLike {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
}

export interface ParsedNewsApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  payload: T | null;
  errorMessage: string | null;
}

const TECHNICAL_ERROR_PATTERN =
  /unexpected token|unexpected end of json|syntaxerror|invalid json|is not valid json|failed to execute 'json'/i;

export function mapNewsFetchErrorToTurkish(
  err: unknown,
  options?: { isOnline?: boolean; aborted?: boolean }
): string {
  if (options?.isOnline === false) {
    return 'İnternet bağlantısı yok. Bağlantınızı kontrol edip tekrar deneyin.';
  }

  const errObj = err && typeof err === 'object' ? (err as { name?: unknown; message?: unknown }) : null;
  const rawMsg =
    typeof errObj?.message === 'string'
      ? errObj.message
      : typeof err === 'string'
      ? err
      : '';
  const errName = typeof errObj?.name === 'string' ? errObj.name : '';

  if (
    options?.aborted ||
    errName === 'AbortError' ||
    errName === 'TimeoutError' ||
    /\b(abort|timeout|timed out)\b/i.test(rawMsg)
  ) {
    return 'Haber sunucusu zaman aşımına uğradı. Lütfen tekrar deneyin.';
  }

  if (err instanceof SyntaxError || errName === 'SyntaxError' || TECHNICAL_ERROR_PATTERN.test(rawMsg)) {
    return 'Haber servisi beklenen JSON yanıtını döndürmedi. Lütfen tekrar deneyin.';
  }

  if (/failed to fetch|networkerror|load failed|fetch failed|econnrefused|enotfound/i.test(rawMsg)) {
    return 'Haber sunucusuna bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.';
  }

  if (rawMsg.trim().length > 0 && !/^[A-Za-z]+Error:/.test(rawMsg)) {
    return rawMsg.trim();
  }

  return 'Haberler yüklenemedi. Lütfen tekrar deneyin.';
}

export async function parseNewsApiResponse<T extends Record<string, unknown> = Record<string, unknown>>(
  res: NewsResponseLike
): Promise<ParsedNewsApiResponse<T>> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return {
      ok: false,
      status: res.status,
      payload: null,
      errorMessage: 'Haber sunucusundan okunabilir bir yanıt alınamadı. Lütfen tekrar deneyin.',
    };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      ok: false,
      status: res.status,
      payload: null,
      errorMessage: 'Haber sunucusu boş yanıt döndürdü. Lütfen biraz sonra tekrar deneyin.',
    };
  }

  const contentType = (res.headers?.get('content-type') || '').toLowerCase();
  const looksLikeHtml = contentType.includes('text/html') || /^<(!doctype|html|head|body)\b/i.test(trimmed);
  if (looksLikeHtml) {
    const gatewayError = res.status === 502 || res.status === 503 || res.status === 504;
    return {
      ok: false,
      status: res.status,
      payload: null,
      errorMessage: gatewayError
        ? 'Haber servisi geçici olarak yanıt veremiyor. Lütfen biraz sonra tekrar deneyin.'
        : 'Haber servisi beklenen veri yerine HTML sayfası döndürdü. Lütfen tekrar deneyin.',
    };
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      ok: false,
      status: res.status,
      payload: null,
      errorMessage: 'Haber servisi geçersiz biçimde bir yanıt döndürdü. Lütfen tekrar deneyin.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      status: res.status,
      payload: null,
      errorMessage: 'Haber yanıtı beklenen yapıda değil. Lütfen tekrar deneyin.',
    };
  }

  const obj = parsed as T & { success?: unknown; error?: unknown };
  if (!res.ok || obj.success === false) {
    const serverError =
      typeof obj.error === 'string' && obj.error.trim().length > 0 && !TECHNICAL_ERROR_PATTERN.test(obj.error)
        ? obj.error.trim()
        : res.status === 504
        ? 'Haber sunucusu zaman aşımına uğradı. Lütfen tekrar deneyin.'
        : 'Haberler yüklenemedi. Lütfen tekrar deneyin.';
    return {
      ok: false,
      status: res.status,
      payload: obj,
      errorMessage: serverError,
    };
  }

  return {
    ok: true,
    status: res.status,
    payload: obj,
    errorMessage: null,
  };
}
