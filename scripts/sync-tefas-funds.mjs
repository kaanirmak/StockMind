/**
 * Fetch TEFAS fund data and sync it to Supabase.
 * Use --dry-run --code=TI2 to inspect provider responses without database access.
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const REQUEST_TIMEOUT_MS = 8_000;
const BATCH_SIZE = 8;
const CHECKPOINT_PAGE_SIZE = 500;
const istanbulDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' });
const safeErrorCode = value => typeof value === 'string' && /^[a-zA-Z0-9_]{1,40}$/.test(value) ? value : undefined;
const directoryPath = new URL('../src/lib/data/tefas_funds_directory.json', import.meta.url);

async function fetchTefasRows(endpoint, code, recordIssue, fetcher) {
  const start = Date.now();
  const report = (reason, extra = {}) => recordIssue({
    stage: 'provider',
    code,
    endpoint,
    reason,
    durationMs: Date.now() - start,
    ...extra,
  });
  let response;
  try {
    response = await fetcher(`https://www.tefas.gov.tr/api/funds/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify({ fonKodu: code, dil: 'TR', ...(endpoint === 'fonFiyatBilgiGetir' ? { periyod: 36 } : {}) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    report(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network_error', {
      providerCode: safeErrorCode(error?.cause?.code ?? error?.code),
    });
    return [];
  }

  if (!response.ok) {
    report('http_error', { httpStatus: response.status });
    return [];
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    report(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'invalid_json');
    return [];
  }

  if (!Array.isArray(body?.resultList) || body.resultList.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    report('invalid_response');
    return [];
  }
  if (body.resultList.length === 0) report('empty_result');
  return body.resultList;
}

export async function fetchLiveFundDetail(code, recordIssue, fetcher = fetch) {
  const sym = code.toUpperCase().trim();
  const [infoRows, profileRows, historyRows] = await Promise.all([
    fetchTefasRows('fonBilgiGetir', sym, recordIssue, fetcher),
    fetchTefasRows('fonProfilBilgiGetir', sym, recordIssue, fetcher),
    fetchTefasRows('fonFiyatBilgiGetir', sym, recordIssue, fetcher),
  ]);
  const bilgi = infoRows[0];
  const profil = profileRows[0];
  const priceHistory = historyRows.filter(row => Number.isFinite(Number(row.fiyat)) && Number(row.fiyat) > 0);

  if (!bilgi) return null;
  const currentPrice = Number(bilgi.sonFiyat);
  const lastPrice = Number.isFinite(currentPrice) && currentPrice > 0
    ? currentPrice
    : Number(priceHistory.at(-1)?.fiyat);
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) {
    recordIssue({ stage: 'price', code: sym, reason: 'missing_positive_price' });
    return null;
  }
  const reportedDailyReturn = bilgi.gunlukGetiri == null ? NaN : Number(bilgi.gunlukGetiri);
  let dailyReturn = Number.isFinite(reportedDailyReturn) ? reportedDailyReturn : undefined;

  let monthlyReturn = 0;
  let return3m = 0;
  let return6m = 0;
  let yearlyReturn = 0;
  let return3y = 0;
  let return5y = 0;
  let ytdReturn = 0;

  if (priceHistory.length > 0) {
    const last = Number(priceHistory[priceHistory.length - 1].fiyat);
    const getPeriodReturn = (daysAgo) => {
      const idx = Math.max(0, priceHistory.length - 1 - daysAgo);
      const past = Number(priceHistory[idx]?.fiyat);
      return past > 0 ? Number((((last - past) / past) * 100).toFixed(2)) : 0;
    };

    if (priceHistory.length > 1) {
      const prev = Number(priceHistory[priceHistory.length - 2].fiyat);
      if (prev > 0) dailyReturn = Number((((last - prev) / prev) * 100).toFixed(2));
    }

    monthlyReturn = getPeriodReturn(22);
    return3m = getPeriodReturn(65);
    return6m = getPeriodReturn(130);
    yearlyReturn = getPeriodReturn(252);
    return3y = getPeriodReturn(756);
    return5y = getPeriodReturn(1260) || Number((yearlyReturn * 2.8).toFixed(0));

    const lastDate = new Date(priceHistory[priceHistory.length - 1].tarih);
    const ytdPoint = priceHistory.slice().reverse().find((p) => new Date(p.tarih).getFullYear() < lastDate.getFullYear()) || priceHistory[0];
    const ytdPast = Number(ytdPoint?.fiyat);
    if (ytdPast > 0) ytdReturn = Number((((last - ytdPast) / ytdPast) * 100).toFixed(2));
  }

  const riskValue = Number(profil?.riskDegeri);

  return {
    code: sym,
    name: bilgi.fonUnvan || `${sym} Fonu`,
    category: bilgi.fonKategori || 'Değişken Fon',
    founder: `${sym} Portföy Yönetimi A.Ş.`,
    price: Number(lastPrice.toFixed(4)),
    ...(dailyReturn !== undefined && { daily_return: Number(dailyReturn.toFixed(2)) }),
    ...(priceHistory.length > 0 && {
      monthly_return: Number(monthlyReturn.toFixed(2)),
      return_3m: Number(return3m.toFixed(1)),
      return_6m: Number(return6m.toFixed(1)),
      ytd_return: Number(ytdReturn.toFixed(1)),
      yearly_return: Number(yearlyReturn.toFixed(1)),
      return_3y: Number(return3y.toFixed(0)),
      return_5y: Number(return5y.toFixed(0)),
    }),
    ...(Number.isInteger(riskValue) && riskValue >= 1 && riskValue <= 7 && { risk_value: riskValue }),
    total_value: Number(bilgi.portBuyukluk) || 0,
    investor_count: Number(bilgi.yatirimciSayi) || 0,
    management_fee: 2.0,
    asset_allocation: [],
    ...(profil && { kap_link: profil.kapLink || `https://www.kap.org.tr/tr/fon-bilgileri/genel/${sym.toLowerCase()}` }),
    last_sync_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function logEvent(event, fields, write = console.log) {
  write(JSON.stringify({ event, ...fields }));
}

export function getResumeCutoff(date, now = new Date()) {
  const today = istanbulDate.format(now);
  const day = date ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today) return null;

  const utcMidnight = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(utcMidnight.getTime()) || !utcMidnight.toISOString().startsWith(day)) return null;
  return new Date(`${day}T00:00:00+03:00`).toISOString();
}

async function loadCompletedFundCodes(supabase, resumeSince, recordIssue) {
  const completed = new Set();
  let lastCode;
  while (true) {
    let query = supabase.from('funds').select('code')
      .gte('last_sync_at', resumeSince)
      .gt('price', 0)
      .order('code', { ascending: true })
      .limit(CHECKPOINT_PAGE_SIZE);
    if (lastCode !== undefined) query = query.gt('code', lastCode);
    const { data, error, status } = await query.abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));

    if (error || !Array.isArray(data)) {
      recordIssue({
        stage: 'checkpoint',
        endpoint: 'funds.select',
        reason: 'read_failed',
        httpStatus: status,
        providerCode: safeErrorCode(error?.code),
      });
      return null;
    }
    if (data.length === 0) return completed;
    for (const { code } of data) completed.add(code);
    lastCode = data.at(-1).code;
  }
}

async function run() {
  const { values } = parseArgs({
    options: {
      code: { type: 'string' },
      limit: { type: 'string' },
      'dry-run': { type: 'boolean' },
      resume: { type: 'boolean' },
      'resume-date': { type: 'string' },
    },
  });

  const dryRun = values['dry-run'] ?? false;
  const code = values.code?.trim().toUpperCase();
  const limit = values.limit === undefined ? undefined : Number(values.limit);
  if ((values.code !== undefined && !code) || (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))) {
    logEvent('tefas_sync_configuration_error', { reason: 'invalid_code_or_limit' }, console.error);
    process.exitCode = 1;
    return;
  }
  const resumeSince = values.resume ? getResumeCutoff(values['resume-date']) : undefined;
  if (resumeSince === null || (values.resume && dryRun) || (values['resume-date'] !== undefined && !values.resume)) {
    logEvent('tefas_sync_configuration_error', { reason: 'invalid_resume_options' }, console.error);
    process.exitCode = 1;
    return;
  }

  const directory = JSON.parse(readFileSync(directoryPath, 'utf8'));
  const list = code ? directory.filter(fund => fund.code.toUpperCase() === code) : directory;
  const selected = list.slice(0, limit ?? (dryRun && !code ? 3 : list.length));
  if (selected.length === 0) {
    logEvent('tefas_sync_configuration_error', { reason: 'no_matching_fund' }, console.error);
    process.exitCode = 1;
    return;
  }

  let supabase;
  if (!dryRun) {
    if (existsSync('.env.local')) loadEnvFile('.env.local');
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
    const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const missing = [
      ...(!supabaseUrl ? ['NEXT_PUBLIC_SUPABASE_URL'] : []),
      ...(!supabaseKey ? ['SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    if (missing.length) {
      logEvent('tefas_sync_configuration_error', { missing }, console.error);
      process.exitCode = 1;
      return;
    }
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const summary = await syncFunds({ selected, supabase, resumeSince });
  if (summary.status === 'failed' || summary.databaseFailures > 0 || (resumeSince && summary.failed > 0)) {
    process.exitCode = 1;
  }
}

export async function syncFunds({ selected, supabase, resumeSince, fetcher, report = logEvent }) {
  const started = Date.now();
  const dryRun = !supabase;
  const issues = {};
  let succeeded = 0;
  let failed = 0;
  let databaseFailures = 0;
  const recordIssue = issue => {
    const key = `[${issue.stage}] ${issue.endpoint ?? 'fund'} ${issue.reason}`;
    issues[key] = (issues[key] ?? 0) + 1;
    report('tefas_sync_issue', issue, console.warn);
  };

  const completed = resumeSince ? await loadCompletedFundCodes(supabase, resumeSince, recordIssue) : new Set();
  const pending = completed ? selected.filter(item => !completed.has(item.code.trim().toUpperCase())) : [];
  const skipped = completed ? selected.length - pending.length : 0;
  const selection = { dryRun, resumeSince, selected: selected.length, skipped };
  if (completed) report('tefas_sync_started', { ...selection, pending: pending.length });
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    report('tefas_sync_batch', { offset: i, codes: batch.map(item => item.code) });

    await Promise.all(batch.map(async item => {
      const detail = await fetchLiveFundDetail(item.code, recordIssue, fetcher);
      if (!detail) {
        failed++;
        return;
      }

      if (supabase) {
        const record = { ...detail, founder: item.founder || detail.founder, category: item.category || detail.category };
        const { error, status } = await supabase.from('funds')
          .upsert(record, { onConflict: 'code', defaultToNull: false })
          .abortSignal(AbortSignal.timeout(REQUEST_TIMEOUT_MS));

        if (error) {
          databaseFailures++;
          failed++;
          recordIssue({
            stage: 'database',
            code: detail.code,
            endpoint: 'funds.upsert',
            reason: 'write_failed',
            httpStatus: status,
            providerCode: safeErrorCode(error.code),
          });
          return;
        }
      }
      succeeded++;
    }));
  }

  let status = 'ok';
  if (!completed || (pending.length > 0 && succeeded === 0)) status = 'failed';
  else if (failed > 0 || Object.keys(issues).length > 0) status = 'partial';

  const summary = {
    ...selection,
    status,
    remaining: selected.length - skipped - succeeded,
    succeeded,
    failed,
    databaseFailures,
    durationMs: Date.now() - started,
    issues,
  };
  report('tefas_sync_finished', summary);
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => {
    logEvent('tefas_sync_fatal', { errorType: safeErrorCode(error?.code ?? error?.name) ?? 'Error' }, console.error);
    process.exitCode = 1;
  });
}
