const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Run the real TypeScript modules, replacing only network/framework boundaries.
function loader(stubs = {}, env = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.join(root, file);
    if (cache.has(full)) return cache.get(full);
    const exports = {};
    cache.set(full, exports);
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, {
      exports, module: { exports }, Request, Response, Headers, URL, TextDecoder, TextEncoder,
      Uint8Array, Buffer, AbortSignal, crypto: webcrypto, console: { warn() {}, error() {} },
      process: { env },
      ...globals,
      require(name) {
        if (Object.hasOwn(stubs, name)) return stubs[name];
        if (name === 'next/server') {
          class NextResponse extends Response {
            static json(body, init) { return Response.json(body, init); }
          }
          return { NextResponse };
        }
        if (name === 'crypto' || name.startsWith('node:')) return require(name);
        if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
        if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(full), `${name}.ts`)));
        throw new Error(`Unmocked dependency: ${name}`);
      },
    }, { filename: full });
    return exports;
  }
  return load;
}

// Shared durable queue boundary. Claims execute atomically, as the SQL UPDATE does.
function queueAdmin(users, rows = new Map()) {
  return {
    auth: { admin: { listUsers: async () => ({ data: { users } }) } },
    rpc: async (name, args) => {
      if (name === 'claim_bulletin_delivery') {
        const key = `${args.p_bulletin_date}:daily_bulletin:${args.p_recipient_email}`;
        const row = rows.get(key);
        if (!row || row.status === 'processing' || (!args.p_force && (
          !['pending', 'retry_scheduled'].includes(row.status) || row.attempt_count >= row.max_attempts ||
          (row.next_retry_at && Date.parse(row.next_retry_at) > Date.now())
        ))) return { data: null, error: null };
        const updated = { ...row, status: 'processing', claim_token: args.p_claim_token, attempt_count: row.attempt_count + 1 };
        rows.set(key, updated);
        return { data: updated, error: null };
      }
      if (name === 'complete_bulletin_delivery') {
        const entry = [...rows.entries()].find(([, r]) => r.status === 'processing' && r.claim_token === args.p_claim_token);
        if (!entry) return { data: null, error: null };
        const updated = { ...entry[1], ...args.p_result, claim_token: null };
        rows.set(entry[0], updated);
        return { data: updated, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from: (table) => {
      if (table !== 'email_delivery_queue') throw new Error('Optional telemetry table not present');
      return {
        select: () => {
          const filters = [];
          const query = {
            eq(k, v) { filters.push([k, v]); return this; },
            order() { return this; }, limit() { return this; },
            then(resolve) { return Promise.resolve({ data: [...rows.values()].filter(r => filters.every(([k,v]) => r[k] === v)), error: null }).then(resolve); },
          };
          return query;
        },
        upsert: (payload, opts = {}) => {
          const saved = [];
          for (const item of (Array.isArray(payload) ? payload : [payload])) {
            const key = `${item.bulletin_date}:${item.job_type}:${item.recipient_email}`;
            if (!(opts.ignoreDuplicates && rows.has(key))) rows.set(key, { ...item });
            saved.push(rows.get(key));
          }
          return { select: async () => ({ data: saved, error: null }), then: resolve => Promise.resolve({ data: saved, error: null }).then(resolve) };
        },
      };
    },
  };
}

function fixture(options = {}) {
  const calls = { quota: 0, ai: 0, mail: 0, quote: 0, write: 0, hourly: [] };
  const userMetadata = options.pro ? { plan: 'pro', is_pro: true } : (options.app_metadata || (options.plan ? { plan: options.plan } : {}));
  const supabase = {
    auth: { getUser: async () => ({ data: { user: options.anonymous ? null : { id: 'user-1', email: 'owner@example.com', email_confirmed_at: options.unverified ? null : '2026-01-01', app_metadata: userMetadata } }, error: options.authError || null }) },
    rpc: async (name, args) => { if (name === 'ai_hourly_quota') { calls.hourly.push(args); return { data: options.hourlyQuota === undefined ? { allowed: true, limit: 5, used: 1, remaining: 4, retryAfter: 3600, isPro: false } : options.hourlyQuota, error: options.hourlyError || null }; } calls.quota++; return { data: options.quota === undefined ? { allowed: true } : options.quota, error: options.quotaError || null }; },
  };
  const load = loader({
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/ai/openrouter': { OpenRouterError: class extends Error {}, AVAILABLE_MODELS: [{ id: 'openrouter/free' }], callOpenRouter: async (...args) => { calls.ai++; calls.aiArgs = args; if (options.aiError) throw options.aiError; return 'answer'; } },
    '@/lib/ai/modelCatalog': { AUTO_MODEL: { id: 'openrouter/free', free: true }, getModelCatalog: async () => [{ id: 'openrouter/free', free: true }, { id: 'paid/model', free: false }], hasProAccess: metadata => metadata?.plan === 'pro' },
    '@/lib/ai/market-context': { buildLiveAIContext: async () => 'server context' },
    '@/lib/ai/investment-committee': { runInvestmentCommittee: async (...args) => { calls.ai++; calls.aiArgs = args; return { isLiveLLM: true }; } },
    '@/lib/data/stocks': { getStockBySymbolLive: async () => { calls.quote++; return options.quote === undefined ? { price: 123, name: 'Verified' } : options.quote; } },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ gold: 123 }) },
    '@/lib/email/service': { sendTestEmail: async (payload) => { calls.mail++; calls.mailArgs = payload; return { success: true }; } },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: (table) => { calls.table = table; return { upsert: async (payload) => { calls.write++; calls.writeArgs = payload; return { error: options.writeError || null }; } }; } }) },
  }, { OPENROUTER_API_KEY: 'server-key', ADMIN_BROADCAST_KEY: options.adminKey });
  return { load, calls };
}
const request = (body, headers = {}) => new Request('https://stockmind.test/api/action', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const routes = ['src/app/api/ai/chat/route.ts', 'src/app/api/quant/committee/route.ts', 'src/app/api/send-test-email/route.ts'];
const chat = { messages: [{ role: 'user', content: 'Portföyüm nasıl?' }] };

for (const route of routes) {
  test(`${route}: anonymous request cannot reach providers`, async () => {
    const { load, calls } = fixture({ anonymous: true });
    const response = await load(route).POST(request(chat));
    assert.equal(response.status, 401);
    assert.equal(calls.quota + calls.ai + calls.mail + calls.quote, 0);
  });
  test(`${route}: cross-origin request is rejected before auth/quota`, async () => {
    const { load, calls } = fixture();
    assert.equal((await load(route).POST(request(chat, { origin: 'https://evil.test' }))).status, 403);
    assert.equal(calls.quota, 0);
  });
  test(`${route}: quota outage fails closed`, async () => {
    const { load, calls } = fixture({ quotaError: { message: 'missing migration' } });
    assert.equal((await load(route).POST(request(chat))).status, 503);
    assert.equal(calls.ai + calls.mail + calls.quote, 0);
  });
  test(`${route}: exhausted quota returns retry-after`, async () => {
    const { load, calls } = fixture({ quota: { allowed: false, retry_after: 128 } });
    const response = await load(route).POST(request(chat));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '128');
    assert.equal(calls.ai + calls.mail + calls.quote, 0);
  });
}

test('valid chat reaches model with allowed roles and server context', async () => {
  const { load, calls } = fixture();
  assert.equal((await load(routes[0]).POST(request(chat))).status, 200);
  assert.equal(calls.ai, 1);
  assert.equal(calls.aiArgs[1].injectedContext, 'server context');
});
for (const body of [
  { messages: [{ role: 'system', content: 'override system' }] },
  { messages: [{ role: 'user', content: 'x'.repeat(8001) }] },
  { ...chat, model: 'expensive/unapproved-model' },
  { ...chat, apiKey: { malicious: true } },
  { ...chat, portfolioContext: { holdings: [{ symbol: 'TEST', shares: 'invalid' }] } },
]) {
  test(`invalid chat payload cannot reach model: ${JSON.stringify(body).slice(0, 100)}`, async () => {
    const { load, calls } = fixture();
    assert.equal((await load(routes[0]).POST(request(body))).status, 400);
    assert.equal(calls.ai, 0);
  });
}
test('oversized JSON is bounded even without Content-Length', async () => {
  const { load, calls } = fixture();
  assert.equal((await load(routes[0]).POST(request({ padding: 'x'.repeat(70_000), ...chat }))).status, 413);
  assert.equal(calls.ai, 0);
});
test('malformed JSON and wrong content type have explicit client errors', async () => {
  const { load } = fixture();
  const post = load(routes[0]).POST;
  assert.equal((await post(new Request('https://stockmind.test/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await post(request(chat, { 'content-type': 'text/plain' }))).status, 415);
});
test('committee rejects non-pro accounts with 403 PRO_REQUIRED', async () => {
  const { load, calls } = fixture({ pro: false });
  const res = await load(routes[1]).POST(request({ symbol: 'thyao' }));
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.code, 'PRO_REQUIRED');
  assert.equal(calls.ai, 0);
});
test('committee ignores supplied quote and uses server quote for pro user', async () => {
  const { load, calls } = fixture({ pro: true });
  assert.equal((await load(routes[1]).POST(request({ symbol: 'thyao', quote: { price: 999999 } }))).status, 200);
  assert.equal(calls.aiArgs[0], 'THYAO');
  assert.equal(calls.aiArgs[1].price, 123);
});
test('committee does not analyze a missing quote', async () => {
  const { load, calls } = fixture({ pro: true, quote: null });
  assert.equal((await load(routes[1]).POST(request({ symbol: 'UNKNOWN' }))).status, 503);
  assert.equal(calls.ai, 0);
});
test('test mail uses confirmed account address and fixed test content', async () => {
  const { load, calls } = fixture();
  assert.equal((await load(routes[2]).POST(request({ to: 'OWNER@example.com', userName: '<script>attack</script>', subject: 'spam' }))).status, 200);
  assert.equal(calls.mailArgs.to, 'owner@example.com');
  assert.equal(calls.mailArgs.isDailyReport, false);
  assert.equal(calls.mailArgs.subject, undefined);
});
test('test mail dispatches daily report for authenticated pro user', async () => {
  const { load, calls } = fixture({ pro: true });
  const res = await load(routes[2]).POST(request({ to: 'OWNER@example.com', isDailyReport: true }));
  assert.equal(res.status, 200);
  assert.equal(calls.mailArgs.to, 'owner@example.com');
  assert.equal(calls.mailArgs.isDailyReport, true);
});
test('test mail daily report is forbidden for free accounts with 403 PRO_REQUIRED', async () => {
  const { load, calls } = fixture({ pro: false });
  const res = await load(routes[2]).POST(request({ to: 'OWNER@example.com', isDailyReport: true }));
  assert.equal(res.status, 403);
  assert.equal(calls.mail, 0);
});
for (const [options, body, status] of [
  [{ unverified: true }, {}, 403], [{}, { to: 'victim@example.com' }, 403],
  [{}, { customSmtp: { host: '127.0.0.1', user: 'x', pass: 'x' } }, 400],
]) {
  test(`test mail rejects unsafe target/configuration ${JSON.stringify(body)}`, async () => {
    const { load, calls } = fixture(options);
    assert.equal((await load(routes[2]).POST(request(body))).status, status);
    assert.equal(calls.mail, 0);
  });
}
const broadcastRoute = 'src/app/api/notifications/broadcast/route.ts';
test('broadcast requires explicit dedicated configuration', async () => {
  const { load, calls } = fixture();
  assert.equal((await load(broadcastRoute).POST(request({ message: 'hello' }))).status, 503);
  assert.equal(calls.write, 0);
});
for (const key of ['stockmind-admin-2026', 'stockmind_cron_secret_2026_secure', 'wrong-key']) {
  test(`broadcast rejects legacy/nonmatching secret ${key}`, async () => {
    const { load, calls } = fixture({ adminKey: 'dedicated-admin-key' });
    assert.equal((await load(broadcastRoute).POST(request({ message: 'hello' }, { authorization: `Bearer ${key}` }))).status, 401);
    assert.equal(calls.write, 0);
  });
}
test('broadcast rejects external navigation', async () => {
  const { load, calls } = fixture({ adminKey: 'dedicated-admin-key' });
  assert.equal((await load(broadcastRoute).POST(request({ message: 'hello', route: '//evil.test' }, { 'x-admin-key': 'dedicated-admin-key' }))).status, 400);
  assert.equal(calls.write, 0);
});
test('broadcast database failure never reports delivery success', async () => {
  const { load } = fixture({ adminKey: 'dedicated-admin-key', writeError: { message: 'private DB detail' } });
  const response = await load(broadcastRoute).POST(request({ message: 'hello' }, { 'x-admin-key': 'dedicated-admin-key' }));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('private DB detail'), false);
});
test('broadcast persists in its own table', async () => {
  const { load, calls } = fixture({ adminKey: 'dedicated-admin-key' });
  assert.equal((await load(broadcastRoute).POST(request({ message: 'hello', route: '/stocks/THYAO' }, { authorization: 'Bearer dedicated-admin-key' }))).status, 200);
  assert.equal(calls.table, 'broadcasts');
  assert.equal(calls.writeArgs.payload.route, '/stocks/THYAO');
});
test('admin client never falls back to public credentials', () => {
  let called = false;
  const load = loader({ '@supabase/supabase-js': { createClient: () => { called = true; } } }, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-key',
  });
  assert.throws(() => load('src/lib/supabase/admin.ts').createAdminClient(), /yapılandırması eksik/);
  assert.equal(called, false);
});
test('test email template contains no fabricated market or portfolio metrics', () => {
  const load = loader({ nodemailer: {}, '@supabase/supabase-js': {} });
  const html = load('src/lib/email/service.ts').generateStockMindEmailHtml('User', { isDailyReport: false });
  assert.match(html, /test e-postası/);
  for (const fake of ['184500', '184.500', '4309', '48.63', 'Kâr', 'Getiri']) assert.equal(html.includes(fake), false);
});

test('Scheduled bulletin respects preferences and reports partial provider failure', async () => {
  const accepted = [];
  const users = [
    { email: 'ok@example.test', app_metadata: { plan: 'pro' } },
    { email: 'fail@example.test', app_metadata: { plan: 'enterprise' } },
    { email: 'optout@example.test', app_metadata: { plan: 'pro' }, user_metadata: { daily_report_enabled: false } },
    { email: 'free@example.test', app_metadata: { plan: 'free' } },
  ].map(user => ({ ...user, email_confirmed_at: '2026-01-01T00:00:00Z' }));
  const load = loader({
    '@/lib/email/service': { sendTestEmail: async ({ to }) => {
      accepted.push(to);
      return { success: to === 'ok@example.test' };
    } },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({}) },
    '@/lib/supabase/admin': { createAdminClient: () => queueAdmin(users) },
  }, { CRON_SECRET: 'cron-secret' });
  const { POST } = load('src/app/api/cron/daily-report/route.ts');
  const response = await POST(request({}, { authorization: 'Bearer cron-secret' }));
  assert.equal(response.status, 207);
  assert.equal((await response.json()).success, false);
  assert.deepEqual(accepted, ['ok@example.test', 'fail@example.test']);
});

test('EPO-02: günlük bülten 51 ve üzeri alıcıyı sınır olmadan partiler halinde işler', async () => {
  const sentTo = [];
  const users = Array.from({ length: 65 }, (_, idx) => ({
    email: `pro-${idx + 1}@example.test`,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { plan: 'pro' },
  }));
  const load = loader({
    '@/lib/email/service': {
      sendTestEmail: async ({ to }) => {
        sentTo.push(to);
        return { success: true, method: 'google_smtp' };
      },
    },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 42 }) },
    '@/lib/supabase/admin': {
      createAdminClient: () => queueAdmin(users),
    },
  }, { CRON_SECRET: 'cron-secret' });

  const { POST } = load('src/app/api/cron/daily-report/route.ts');
  const response = await POST(request({}, { authorization: 'Bearer cron-secret' }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.recipientsCount, 65);
  assert.equal(body.successfulCount, 65);
  assert.equal(body.batchesProcessed, 3);
  assert.equal(sentTo.length, 65);
});

test('EPO-03: kalıcı e-posta kuyruğu iş yarıda kesilse bile yeniden başlatmadan sonra bekleyen ve tamamlanan alıcıları ayırt eder', async () => {
  const queueStore = new Map();
  const buildAdminMock = users => queueAdmin(users, queueStore);

  const users = [
    { email: 'a@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { plan: 'pro' } },
    { email: 'b@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { plan: 'pro' } },
  ];

  // Run 1: crashes mid-job after 'a' is delivered and before 'b' completes
  const run1Sent = [];
  const loadRun1 = loader({
    '@/lib/email/service': {
      sendTestEmail: async ({ to }) => {
        run1Sent.push(to);
        if (to === 'b@example.test') {
          throw new Error('Simulated worker crash before completion');
        }
        return { success: true, method: 'google_smtp', senderAddress: 'kaanrmak7@gmail.com', messageId: 'm1' };
      },
    },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 42 }) },
    '@/lib/supabase/admin': { createAdminClient: () => buildAdminMock(users) },
  }, { CRON_SECRET: 'cron-secret' });

  const crashRes = await loadRun1('src/app/api/cron/daily-report/route.ts').POST(
    request({}, { authorization: 'Bearer cron-secret' })
  );
  assert.equal(crashRes.status, 500);
  assert.deepEqual(run1Sent, ['a@example.test', 'b@example.test']);

  const rowsAfterCrash = Array.from(queueStore.values());
  assert.equal(rowsAfterCrash.length, 2, 'Both recipients must exist in persistent queue before dispatch');
  assert.equal(rowsAfterCrash.find((r) => r.recipient_email === 'a@example.test').status, 'accepted');
  assert.equal(rowsAfterCrash.find((r) => r.recipient_email === 'b@example.test').status, 'processing');

  // Run 2 (fresh module load -> simulated process restart with empty sentReportsCache)
  const run2Sent = [];
  const loadRun2 = loader({
    '@/lib/email/service': {
      sendTestEmail: async ({ to }) => {
        run2Sent.push(to);
        return { success: true, method: 'google_smtp', senderAddress: 'kaanrmak7@gmail.com', messageId: 'm2' };
      },
    },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 42 }) },
    '@/lib/supabase/admin': { createAdminClient: () => buildAdminMock(users) },
  }, { CRON_SECRET: 'cron-secret' });

  const recoverRes = await loadRun2('src/app/api/cron/daily-report/route.ts').POST(
    request({}, { authorization: 'Bearer cron-secret' })
  );
  assert.equal(recoverRes.status, 207);
  const recoverBody = await recoverRes.json();
  assert.deepEqual(run2Sent, [], 'Ambiguous SMTP outcome must not be automatically resent');
  assert.equal(recoverBody.queueSummary.accepted, 1);
  assert.equal(recoverBody.queueSummary.processing, 1);
});

test('EPO-04: aynı bülten günü ve alıcı için yeniden deneme veya tekrar tetiklemede çift gönderim oluşmaz', async () => {
  const queueStore = new Map();
  const buildAdminMock = users => queueAdmin(users, queueStore);

  const users = [
    { email: 'ok@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { plan: 'pro' } },
    { email: 'flaky@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { plan: 'pro' } },
  ];

  // Run 1: ok succeeds, flaky temporarily fails
  const run1Sent = [];
  const loadRun1 = loader({
    '@/lib/email/service': {
      sendTestEmail: async ({ to }) => {
        run1Sent.push(to);
        if (to === 'flaky@example.test') {
          return { success: false, message: 'Temporary SMTP timeout' };
        }
        return { success: true, method: 'google_smtp', messageId: 'ok-1' };
      },
    },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 42 }) },
    '@/lib/supabase/admin': { createAdminClient: () => buildAdminMock(users) },
  }, { CRON_SECRET: 'cron-secret' });

  const res1 = await loadRun1('src/app/api/cron/daily-report/route.ts').POST(
    request({}, { authorization: 'Bearer cron-secret' })
  );
  assert.equal(res1.status, 207);
  const body1 = await res1.json();
  assert.equal(body1.queueSummary.accepted, 1);
  assert.equal(body1.queueSummary.retryScheduled, 1);

  for (const row of queueStore.values()) if (row.status === 'retry_scheduled') row.next_retry_at = new Date(0).toISOString();
  // Run 2 (fresh worker): flaky succeeds; ok (even with uppercase casing) must NOT be sent again
  const run2Sent = [];
  const loadRun2 = loader({
    '@/lib/email/service': {
      sendTestEmail: async ({ to }) => {
        run2Sent.push(to);
        return { success: true, method: 'google_smtp', messageId: 'flaky-2' };
      },
    },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 42 }) },
    '@/lib/supabase/admin': {
      createAdminClient: () => buildAdminMock([
        { email: 'OK@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { plan: 'pro' } },
        { email: 'flaky@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { plan: 'pro' } },
      ]),
    },
  }, { CRON_SECRET: 'cron-secret' });

  const res2 = await loadRun2('src/app/api/cron/daily-report/route.ts').POST(
    request({}, { authorization: 'Bearer cron-secret' })
  );
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.deepEqual(run2Sent, ['flaky@example.test']);
  assert.equal(body2.newlySentCount, 1);
  assert.equal(body2.skippedDuplicatesCount, 1);

  // Run 3 (same bulletin day): zero emails sent
  const run3Sent = [];
  const loadRun3 = loader({
    '@/lib/email/service': {
      sendTestEmail: async ({ to }) => {
        run3Sent.push(to);
        return { success: true };
      },
    },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 42 }) },
    '@/lib/supabase/admin': { createAdminClient: () => buildAdminMock(users) },
  }, { CRON_SECRET: 'cron-secret' });

  const res3 = await loadRun3('src/app/api/cron/daily-report/route.ts').POST(
    request({}, { authorization: 'Bearer cron-secret' })
  );
  assert.equal(res3.status, 200);
  const body3 = await res3.json();
  assert.equal(run3Sent.length, 0);
  assert.equal(body3.newlySentCount, 0);
  assert.equal(body3.skippedDuplicatesCount, 2);

  // trigger-cron must not default force=true on daily-report
  const triggerSrc = fs.readFileSync(path.join(root, 'src/app/api/admin/system/trigger-cron/route.ts'), 'utf8');
  assert.equal(/force:\s*true/.test(triggerSrc), false, 'trigger-cron must not hardcode force: true');
});

test('EPO-05: admin stats ve operasyon ekranı bekleyen, kabul edilen, başarısız ve yeniden denenecek sayaçlarını ayrı gösterir', async () => {
  const queueRows = [
    { recipient_email: 'p@example.test', status: 'pending', attempt_count: 0 },
    { recipient_email: 'a1@example.test', status: 'accepted', attempt_count: 1 },
    { recipient_email: 'a2@example.test', status: 'accepted', attempt_count: 1 },
    { recipient_email: 'f@example.test', status: 'failed', attempt_count: 3 },
    { recipient_email: 'r@example.test', status: 'retry_scheduled', attempt_count: 1 },
  ];
  const load = loader({
    '@/lib/admin/desktopGuard': { requireDesktopAdmin: async () => ({ id: 'admin-id' }) },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'admin-id' } } }) } }) },
    '@supabase/supabase-js': {},
    '@/lib/data/tefas_funds_directory.json': [],
    '@/lib/email/service': {
      getEmailTransportDiagnostics: () => ({
        mode: 'gmail',
        gmailOnly: true,
        configured: true,
        senderAddress: 'kaanrmak7@gmail.com',
        expectedGmailSender: 'kaanrmak7@gmail.com',
        senderMatchesExpectedGmail: true,
      }),
    },
    '@/lib/supabase/admin': {
      createAdminClient: () => ({
        auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
        from: (table) => {
          if (table === 'email_delivery_queue') {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({ limit: async () => ({ data: queueRows, error: null }) }),
                }),
              }),
            };
          }
          return { select: async () => ({ count: 0, error: null }) };
        },
      }),
    },
  });

  const statsRoute = load('src/app/api/admin/stats/route.ts');
  const res = await statsRoute.GET(new Request('http://localhost:3000/api/admin/stats'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.stats.emailQueueSummary.available, true);
  assert.equal(body.stats.emailQueueSummary.pending, 1);
  assert.equal(body.stats.emailQueueSummary.accepted, 2);
  assert.equal(body.stats.emailQueueSummary.failed, 1);
  assert.equal(body.stats.emailQueueSummary.retryScheduled, 1);

  const adminSrc = fs.readFileSync(path.join(root, 'src/app/admin/page.tsx'), 'utf8');
  for (const marker of ['counter-pending', 'counter-accepted', 'counter-failed', 'counter-retry-scheduled']) {
    assert.ok(adminSrc.includes(marker), `Admin UI must display separate counter ${marker}`);
  }
});

test('Daily bulletin shows supplied market prices and omits sample portfolio values', () => {
  const load = loader({ nodemailer: {}, '@supabase/supabase-js': {} });
  const { generateStockMindEmailHtml } = load('src/lib/email/service.ts');
  const html = generateStockMindEmailHtml('<Üye>', { isDailyReport: true, marketData: { usdtry: 42, gold: NaN } });
  assert.match(html, /Dolar \/ TL/);
  assert.match(html, /42,00/);
  assert.match(html, /&lt;Üye&gt;/);
  assert.doesNotMatch(html, /Ons Altın|Portföy değeri|GÜÇLÜ AL|NaN/);
});

test('cron endpoints strictly enforce header-based CRON_SECRET and disallow URL query secrets', () => {
  const syncFundsCode = fs.readFileSync(path.join(root, 'src/app/api/cron/sync-funds/route.ts'), 'utf8');
  const dailyReportCode = fs.readFileSync(path.join(root, 'src/app/api/cron/daily-report/route.ts'), 'utf8');
  assert.doesNotMatch(syncFundsCode, /secretQuery/, 'sync-funds must never accept secret in query string');
  assert.doesNotMatch(dailyReportCode, /searchParams\.get\(['"]secret/, 'daily-report must never accept secret in query string');
  assert.match(syncFundsCode, /authorization/, 'sync-funds must check authorization header');
  assert.match(syncFundsCode, /x-cron-secret/, 'sync-funds must check x-cron-secret header');
});


test('development permits same-port loopback normalization, production and other origins remain blocked', async () => {
  for (const [env, origin, host, expected] of [
    ['development', 'http://127.0.0.1:3000', '127.0.0.1:3000', 401],
    ['production', 'http://127.0.0.1:3000', '127.0.0.1:3000', 403],
    ['development', 'http://127.0.0.1:3001', '127.0.0.1:3001', 403],
    ['development', 'http://evil.test:3000', 'evil.test:3000', 403],
  ]) {
    const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) } }, { NODE_ENV: env });
    const security = load('src/lib/api/security.ts');
    await assert.rejects(() => security.authorizeAction(new Request('http://localhost:3000/api/ai/chat', { headers: { origin, host } }), 'ai_chat'), error => error.status === expected);
  }
});

test('model catalog includes text models and fails closed for unknown or nonzero prices', () => {
  const { parseModelCatalog, hasProAccess } = loader()('src/lib/ai/modelCatalog.ts');
  const row = (id, pricing, output = ['text']) => ({ id, name: id, pricing, architecture: { output_modalities: output } });
  const models = parseModelCatalog({ data: [
    row('free', { prompt: '0', completion: '0', request: '0' }),
    row('paid', { prompt: '0.01', completion: '0' }),
    row('unknown', { prompt: '0', completion: 'unknown' }),
    row('image', { prompt: '0', completion: '0' }, ['image']),
    row('mixed', { prompt: '0', completion: '0' }, ['text', 'audio']),
  ] });
  assert.equal(models[0].id, 'openrouter/free');
  assert.equal(models.find(m => m.id === 'free').free, true);
  assert.equal(models.find(m => m.id === 'paid').free, false);
  assert.equal(models.find(m => m.id === 'unknown').free, false);
  assert.equal(models.some(m => m.id === 'image'), false);
  assert.equal(models.some(m => m.id === 'mixed'), false);
  assert.equal(hasProAccess({ plan: 'free' }), false);
  assert.equal(hasProAccess({ plan: 'pro' }), true);
});

 test('paid model is forbidden for free accounts before provider execution', async () => {
  const { load, calls } = fixture();
  const response = await load('src/app/api/ai/chat/route.ts').POST(request({ ...chat, model: 'paid/model' }));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'PRO_REQUIRED');
  assert.equal(calls.ai, 0);
});

test('pro action token generates tamper-proof signatures and rejects expired or altered tokens', () => {
  const { createProActionToken, verifyProActionToken } = loader({}, {
    SUPABASE_SERVICE_ROLE_KEY: 'test-secret-key-12345678901234567890',
  })('src/lib/pro/tokens.ts');

  const token = createProActionToken('usr_42', 'investor@example.com', 'approve');

  const verified = verifyProActionToken(token);
  assert.equal(verified.valid, true, 'Valid token must be verified');
  assert.equal(verified.userId, 'usr_42');
  assert.equal(verified.email, 'investor@example.com');
  assert.equal(verified.action, 'approve');

  // Tampered payload
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'hacker', email: 'hacker@example.com', action: 'approve', exp: Date.now() + 10000 })).toString('base64url');
  assert.equal(verifyProActionToken(`${tamperedPayload}.${parts[1]}`).valid, false, 'Tampered payload must be rejected');

  // Tampered signature
  assert.equal(verifyProActionToken(`${parts[0]}.invalidsignature`).valid, false, 'Tampered signature must be rejected');

  // Expired token
  const expiredPayload = Buffer.from(JSON.stringify({ userId: 'usr_42', email: 'investor@example.com', action: 'approve', exp: Date.now() - 1000 })).toString('base64url');
  const crypto = require('node:crypto');
  const expiredSig = crypto.createHmac('sha256', 'test-secret-key-12345678901234567890').update(expiredPayload).digest('base64url');
  assert.equal(verifyProActionToken(`${expiredPayload}.${expiredSig}`).valid, false, 'Expired token must be rejected');
});


test('Pro admin rejects spoofed metadata and unverified configured email', async () => {
  for (const user of [
    { email: 'other@example.com', email_confirmed_at: '2026-01-01', user_metadata: { role: 'admin' }, app_metadata: {} },
    { email: 'admin@example.com', email_confirmed_at: null, app_metadata: {} },
  ]) {
    const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) } }, { ADMIN_EMAIL: 'admin@example.com' });
    await assert.rejects(load('src/lib/pro/admin.ts').requireProAdmin(), error => error.status === 403);
  }
});

test('Pro admin accepts verified configured email or trusted admin claim', async () => {
  for (const user of [
    { id: 'admin-id', email: 'ADMIN@example.com', email_confirmed_at: '2026-01-01', app_metadata: {} },
    { id: 'admin-id', email: 'other@example.com', app_metadata: { role: 'admin' } },
  ]) {
    const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }), getClaims: async () => ({ data: { claims: { sub: user.id, aal: 'aal2' } } }) } }) } }, { ADMIN_EMAIL: 'admin@example.com' });
    assert.equal(await load('src/lib/pro/admin.ts').requireProAdmin(), user);
  }
});

test('Pro decisions reject foreign origins, preserve claims, and report write failures', async () => {
  for (const writeError of [null, new Error('database unavailable')]) {
    let update;
    const load = loader({
      '@/lib/pro/admin': { requireProAdmin: async () => ({ id: 'admin-id' }) },
      '@/lib/supabase/server': { createClient: async () => ({}) },
      '@/lib/supabase/admin': { createAdminClient: () => ({ auth: { admin: {
        getUserById: async () => ({ data: { user: { id: '12345678-1234-1234-1234-123456789abc', app_metadata: { existing: true }, user_metadata: { pro_request_status: 'pending' } } } }),
        updateUserById: async (_, value) => { update = value; return { error: writeError }; },
      } } }) },
    });
    const route = load('src/app/api/admin/pro-requests/route.ts');
    const body = { userId: '12345678-1234-1234-1234-123456789abc', action: 'approve' };
    assert.equal((await route.POST(request(body, { origin: 'https://evil.test' }))).status, 403);
    assert.equal(update, undefined);
    const response = await route.POST(request(body, { origin: 'https://stockmind.test' }));
    assert.equal(response.status, writeError ? 503 : 200);
    assert.equal(update.app_metadata.existing, true);
    assert.equal(update.app_metadata.is_pro, true);
    assert.equal(update.user_metadata.pro_request_status, 'approved');
  }
});

test('Pro signing fails closed without a configured secret', () => {
  const { createProActionToken } = loader()('src/lib/pro/tokens.ts');
  assert.throws(() => createProActionToken('user', 'user@example.com', 'approve'));
});

test('Pro request keeps pending request but does not claim email delivery when SMTP fails', async () => {
  const user = { id: 'request-user', email: 'owner@example.com', app_metadata: {}, user_metadata: {} };
  let saved;
  const load = loader({
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      getUser: async () => ({ data: { user } }),
      updateUser: async () => ({ error: null }),
    } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ auth: { admin: {
      updateUserById: async (_, value) => { saved = value; return { error: null }; },
    } } }) },
    '@/lib/pro/tokens': { createProActionToken: () => 'signed-token' },
    '@/lib/email/service': { sendProRequestAdminEmail: async () => ({ success: false }) },
  });
  const response = await load('src/app/api/pro/request/route.ts').POST(request({ note: 'Please review' }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(saved.user_metadata.pro_request_status, 'pending');
  assert.equal(body.emailSent, false);
  assert.match(body.message, /e-posta gönderilemedi/);
});

test('Persistent quota fails closed when unavailable or malformed', async () => {
  for (const options of [{ hourlyError: new Error('unavailable') }, { hourlyQuota: { allowed: true } }]) {
    const { load, calls } = fixture(options);
    assert.equal((await load(routes[0]).POST(request(chat))).status, 503);
    assert.equal(calls.ai, 0);
  }
});

test('Provider failure refunds the exact reserved request rather than another concurrent credit', async () => {
  const { load, calls } = fixture({ aiError: new Error('provider unavailable') });
  assert.equal((await load(routes[0]).POST(request(chat))).status, 503);
  assert.equal(calls.hourly.length, 2);
  assert.equal(calls.hourly[0].p_mode, 'consume');
  assert.equal(calls.hourly[1].p_mode, 'refund');
  assert.equal(calls.hourly[0].p_request_id, calls.hourly[1].p_request_id);
  assert.ok(calls.hourly[0].p_request_id);
});

test('SEC-01 & SEC-03: escapeHtml neutralizes XSS and HTML markup characters', () => {
  const { escapeHtml } = loader()('src/lib/utils/html.ts');
  assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("Tom & 'Jerry'"), 'Tom &amp; &#39;Jerry&#39;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('Gmail mode uses the authenticated sender and skips configured HTTP email providers', async () => {
  const calls = { http: 0 };
  const load = loader({
    nodemailer: {
      createTransport: (options) => {
        calls.options = options;
        return { sendMail: async mail => { calls.mail = mail; return { accepted: [mail.to] }; } };
      },
    },
  }, {
    EMAIL_TRANSPORT: 'gmail',
    SMTP_USER: 'sender@gmail.com',
    SMTP_PASS: 'app password',
    SMTP_PORT: '587',
    SMTP_FROM: 'legacy@example.test',
    RESEND_API_KEY: 'test-key',
    BREVO_API_KEY: 'test-key',
  }, { fetch: async () => { calls.http++; throw new Error('Unexpected HTTP transport'); } });
  const { sendEmailTransport } = load('src/lib/email/service.ts');
  const result = await sendEmailTransport({
    to: 'recipient@example.test', subject: 'Test', html: '<p>Test</p>', from: 'override@example.test',
  });
  assert.equal(result.method, 'google_smtp');
  assert.equal(calls.http, 0);
  assert.equal(calls.mail.from, 'StockMind <sender@gmail.com>');
  assert.equal(calls.options.host, 'smtp.gmail.com');
  assert.equal(calls.options.port, 587);
  assert.equal(calls.options.secure, false);
  assert.equal(calls.options.requireTLS, true);
});

test('EPO-01: Gmail gönderici doğrulaması kaanrmak7@gmail.com kimliğini ve kabul bilgilerini döner', async () => {
  const load = loader({
    nodemailer: {
      createTransport: () => ({
        sendMail: async mail => ({
          accepted: [mail.to],
          messageId: '<epo01-msg@gmail.com>',
        }),
      }),
    },
  }, {
    EMAIL_TRANSPORT: 'gmail',
    ADMIN_EMAIL: 'kaanrmak7@gmail.com',
    SMTP_USER: 'kaanrmak7@gmail.com',
    SMTP_PASS: 'app-password',
    RESEND_API_KEY: 'ignored-in-gmail-mode',
  }, { fetch: async () => { throw new Error('Should not call HTTP provider in gmail mode'); } });

  const { sendEmailTransport, getEmailTransportDiagnostics } = load('src/lib/email/service.ts');
  const diag = getEmailTransportDiagnostics();
  assert.equal(diag.mode, 'gmail');
  assert.equal(diag.configured, true);
  assert.equal(diag.senderAddress, 'kaanrmak7@gmail.com');
  assert.equal(diag.senderMatchesExpectedGmail, true);

  const result = await sendEmailTransport({
    to: 'verified-user@example.test',
    subject: 'EPO-01 Test',
    html: '<p>Test</p>',
  });
  assert.equal(result.success, true);
  assert.equal(result.method, 'google_smtp');
  assert.equal(result.from, 'StockMind <kaanrmak7@gmail.com>');
  assert.equal(result.senderAddress, 'kaanrmak7@gmail.com');
  assert.deepEqual(result.accepted, ['verified-user@example.test']);
  assert.equal(result.messageId, '<epo01-msg@gmail.com>');
});

test('SEC-01: sendProRequestAdminEmail sanitizes user note, name and email against HTML injection', async () => {
  let capturedHtml = '';
  const load = loader({
    nodemailer: {
      createTransport: () => ({
        sendMail: async (mail) => {
          capturedHtml = mail.html;
          return { messageId: 'msg-1' };
        },
      }),
    },
  }, {
    SMTP_USER: 'admin@example.com',
    SMTP_PASS: 'test-pass',
  });
  const service = load('src/lib/email/service.ts');

  await service.sendProRequestAdminEmail({
    adminEmail: 'admin@example.com',
    userName: '<img src=x onerror=alert(1)>Malicious Name',
    userEmail: 'user<hack>@example.com',
    userId: '12345',
    requestNote: '<script>evil()</script><a href="phish">Click</a>',
    reviewUrl: 'https://stockmind.test/admin',
  });

  assert.equal(capturedHtml.includes('<script>evil()</script>'), false);
  assert.equal(capturedHtml.includes('&lt;script&gt;evil()&lt;/script&gt;'), true);
  assert.equal(capturedHtml.includes('<img src=x'), false);
  assert.equal(capturedHtml.includes('&lt;img src=x'), true);
  assert.equal(capturedHtml.includes('user&lt;hack&gt;@example.com'), true);
});

test('Legacy approval/rejection links only open the admin console and never mutate privileges', async () => {
  for (const action of ['approve', 'reject']) {
    const route = loader()(`src/app/api/admin/pro-request/${action}/route.ts`);
    const response = await route.GET(new Request(`https://stockmind.test/api/admin/pro-request/${action}?userId=target&token=old-token`));
    assert.ok([302, 307].includes(response.status));
    assert.equal(response.headers.get('location'), 'https://stockmind.kaanrmak7.workers.dev/admin');
  }
});

test('SEC-04: trigger-cron fails closed when CRON_SECRET is not configured in environment', async () => {
  const load = loader({
    '@/lib/admin/desktopGuard': { requireDesktopAdmin: async () => ({ id: 'admin-id' }) },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'admin-id' } } }) } }) },
    '@/lib/cron/syncTefasFunds': { syncTefasFundsToDatabase: async () => ({ success: true }) },
    '@supabase/supabase-js': {},
  }, {
    // CRON_SECRET intentionally omitted
  });
  const route = load('src/app/api/admin/system/trigger-cron/route.ts');
  const res = await route.POST(request({ job: 'daily-report' }));
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.match(data.error, /CRON_SECRET sunucu ortamında yapılandırılmamış/);
});

test('SEC-05: /admin route is shielded in middleware and absent from user settings', () => {
  const settingsCode = fs.readFileSync(path.join(root, 'src/app/(dashboard)/settings/page.tsx'), 'utf8');
  assert.equal(settingsCode.includes('href="/admin"'), false, 'Settings page must not contain admin console links');
  assert.equal(settingsCode.includes('kaanrmak7@gmail.com'), false, 'Settings page must not expose admin email');

  const proxyCode = fs.readFileSync(path.join(root, 'src/lib/supabase/proxy.ts'), 'utf8');
  assert.match(proxyCode, /isAdminRoute/, 'Middleware must explicitly classify admin routes');
  assert.match(proxyCode, /url\.pathname = '\/not-found'/, 'Middleware must rewrite unauthorized admin requests to not-found');
  assert.match(proxyCode, /status: 404/, 'Middleware must return 404 status for unauthorized admin requests');
});

test('OPS-01: Android Gradle versionCode advances and matches package.json and /api/app/version', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/build-android-apk.yml'), 'utf8');

  const gradleVersionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
  const gradleVersionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];

  assert.ok(gradleVersionCode >= 12, `Expected incremented versionCode >= 12, got ${gradleVersionCode}`);
  assert.equal(gradleVersionName, pkg.version, 'Android versionName must match package.json version');
  assert.match(gradle, /signingConfigs\s*\{[\s\S]*release\s*\{/);
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /apksigner[\s\S]*verify/);

  const load = loader({
    '@/lib/supabase/server': {
      createClient: async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    },
  });

  const versionRoute = load('src/app/api/app/version/route.ts');
  const res = await versionRoute.GET();
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.version, gradleVersionName);
  assert.equal(payload.versionCode, gradleVersionCode);
  assert.equal(payload.packageId, 'com.kaanirmak.stockmind');
});

test('OPS-02: Android APK upgrade path preserves cookies, WebView storage, and background alert state', () => {
  const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const mainActivity = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/MainActivity.java'),
    'utf8'
  );
  const bootReceiver = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/BootReceiver.java'),
    'utf8'
  );
  const notifier = fs.readFileSync(path.join(root, 'src/components/ui/AppUpdateNotifier.tsx'), 'utf8');

  // Manifest must permit in-place APK upgrades, backups, and reschedule background worker on MY_PACKAGE_REPLACED
  assert.match(manifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.match(manifest, /android\.intent\.action\.MY_PACKAGE_REPLACED/);
  assert.match(manifest, /android:authorities="\$\{applicationId\}\.fileprovider"/);
  assert.match(bootReceiver, /Intent\.ACTION_MY_PACKAGE_REPLACED/);
  assert.match(bootReceiver, /ExistingPeriodicWorkPolicy\.UPDATE/);

  // MainActivity must keep WebView DOM storage, database, and flushed session cookies across upgrades
  assert.match(mainActivity, /settings\.setDomStorageEnabled\(true\)/);
  assert.match(mainActivity, /settings\.setDatabaseEnabled\(true\)/);
  assert.match(mainActivity, /cookieManager\.setAcceptCookie\(true\)/);
  assert.match(mainActivity, /preserveStateAcrossUpgrade\(/);
  assert.doesNotMatch(mainActivity, /StockMind v1\.4\.0 Güncellemesi/);

  // Web update notifier only clears dismissal cache after upgrade, never portfolio or auth storage
  assert.match(notifier, /localVersionCode >= data\.versionCode/);
  assert.doesNotMatch(notifier, /localStorage\.clear\(/);
});

test('OPS-03: APK distribution returns archive headers & SHA-256 checksum alongside release notes and rollback steps', async () => {
  const load = loader({
    fs,
    path,
    '@/lib/supabase/server': {
      createClient: async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    },
  }, {}, { process: { env: {}, cwd: () => root } });

  const downloadRoute = load('src/app/api/download/apk/route.ts');
  const apkRes = await downloadRoute.GET(new Request('https://stockmind.test/api/download/apk'));
  assert.equal(apkRes.status, 200);
  assert.equal(apkRes.headers.get('content-type'), 'application/vnd.android.package-archive');
  const sha = apkRes.headers.get('x-stockmind-sha256');
  assert.match(sha || '', /^[a-f0-9]{64}$/);
  assert.equal(apkRes.headers.get('etag'), `"${sha}"`);
  assert.equal(apkRes.headers.get('x-stockmind-version'), '2.1.0');
  assert.equal(apkRes.headers.get('x-stockmind-versioncode'), '21');

  const versionRoute = load('src/app/api/app/version/route.ts');
  const versionPayload = await (await versionRoute.GET()).json();
  assert.ok(typeof versionPayload.releaseNotes === 'string' && versionPayload.releaseNotes.length > 10);
  assert.match(versionPayload.previousSha256 || '', /^[a-f0-9]{64}$/);
  assert.ok(Array.isArray(versionPayload.rollbackSteps) && versionPayload.rollbackSteps.length >= 3);

  const runbook = fs.readFileSync(path.join(root, 'docs/android-release-runbook.md'), 'utf8');
  assert.match(runbook, /72677be35a633c22b6d77de19156a1f31e916e319de082c7997293772e12d39f/);
  assert.match(runbook, /Rollback Steps/);
});

test('EPO-06: bulletin subscription status and verified target address are visible and enforced on next scheduled run', async () => {
  const load = loader({
    '@/lib/ai/modelCatalog': { hasProAccess: (meta) => meta?.plan === 'pro' || meta?.plan === 'enterprise' },
  });
  const subMod = load('src/lib/email/subscriptionStatus.ts');

  const proActiveUser = {
    email: 'pro.member@example.com',
    email_confirmed_at: '2026-10-01T10:00:00Z',
    app_metadata: { plan: 'pro' },
    user_metadata: { daily_report_enabled: true },
  };
  const activeView = subMod.resolveBulletinSubscriptionView(proActiveUser);
  assert.equal(activeView.statusKind, 'active');
  assert.equal(activeView.targetAddress, 'pro.member@example.com');
  assert.match(activeView.addressLabel, /pro\.member@example\.com \(doğrulanmış\)/);
  assert.match(activeView.nextRunEffectNote, /pro\.member@example\.com/);
  assert.equal(subMod.isUserEligibleForScheduledBulletin(proActiveUser), true);

  // User switches preference off -> UI notes paused status & next scheduled run skips them
  const proPausedUser = {
    ...proActiveUser,
    user_metadata: { daily_report_enabled: false },
  };
  const pausedView = subMod.resolveBulletinSubscriptionView(proPausedUser);
  assert.equal(pausedView.statusKind, 'paused');
  assert.equal(pausedView.isActiveForNextRun, false);
  assert.match(pausedView.nextRunEffectNote, /gönderilmeyecektir/);
  assert.equal(subMod.isUserEligibleForScheduledBulletin(proPausedUser), false);

  // Unverified email stays blocked
  const unverifiedView = subMod.resolveBulletinSubscriptionView({
    ...proActiveUser,
    email_confirmed_at: null,
  });
  assert.equal(unverifiedView.statusKind, 'unverified');
  assert.match(unverifiedView.addressLabel, /doğrulanmamış/);

  // Verify settings page renders subscription card + verified address + next-run note
  const settingsPage = fs.readFileSync(path.join(root, 'src/app/(dashboard)/settings/page.tsx'), 'utf8');
  assert.match(settingsPage, /data-testid="bulletin-subscription-card"/);
  assert.match(settingsPage, /data-testid="bulletin-verified-address"/);
  assert.match(settingsPage, /data-testid="bulletin-subscription-status"/);
  assert.match(settingsPage, /data-testid="bulletin-next-run-note"/);

  const dailyCronSrc = fs.readFileSync(path.join(root, 'src/app/api/cron/daily-report/route.ts'), 'utf8');
  assert.match(dailyCronSrc, /isUserEligibleForScheduledBulletin/);
});

test('EPO-07: daily bulletin includes quote observation timestamps and explicit missing-source empty states', async () => {
  // 1. Partial source outage in getBulletinMarketData records valid observations + missingFields
  const marketLoader = loader({
    '@/lib/data/stocks': {
      fetchSpecificSymbolLive: async (symbol) => {
        if (symbol === 'XU100') {
          return {
            price: 10250.5,
            observation: {
              source: 'TradingView',
              asOf: '2026-11-11T15:10:00.000Z',
              fetchedAt: '2026-11-11T15:30:00.000Z',
            },
          };
        }
        if (symbol === 'USDTRY') {
          return {
            price: 34.45,
            observation: {
              source: 'TradingView',
              asOf: '2026-11-11T15:25:00.000Z',
              fetchedAt: '2026-11-11T15:30:00.000Z',
            },
          };
        }
        return null; // Simulate missing XAUUSD, BTCUSD, THYAO -> Gram Altin also missing
      },
    },
  });
  const mdMod = marketLoader('src/lib/email/marketData.ts');
  const partialData = await mdMod.getBulletinMarketData();

  assert.equal(partialData.bist100, 10250.5);
  assert.equal(partialData.usdtry, 34.45);
  assert.equal(partialData.btc, undefined);
  assert.equal(partialData.observedAt, '2026-11-11T15:25:00.000Z');
  assert.equal(partialData.observations.bist100.observedAt, '2026-11-11T15:10:00.000Z');
  assert.equal(partialData.observations.bist100.source, 'TradingView');
  assert.equal(partialData.missingFields.includes('Bitcoin (BTC/USD)'), true);
  assert.equal(partialData.missingFields.includes('Gram Altın (hesaplanan)'), true);

  // 2. Email HTML contains observation time column/text and explicit missing-source disclosure
  const emailLoader = loader({ nodemailer: {}, '@supabase/supabase-js': {} });
  const { generateStockMindEmailHtml } = emailLoader('src/lib/email/service.ts');
  const html = generateStockMindEmailHtml('Yatırımcı', {
    isDailyReport: true,
    marketData: partialData,
  });
  assert.match(html, /Veri gözlem zamanı/);
  assert.match(html, /Gözlem Zamanı/);
  assert.match(html, /TSİ/);
  assert.match(html, /TradingView/);
  assert.match(html, /Eksik \/ Alınamayan Kaynaklar \(Boş Veri\)/);
  assert.match(html, /Bitcoin \(BTC\/USD\)/);

  // 3. Complete outage shows explicit empty-data notice
  const emptyHtml = generateStockMindEmailHtml('Yatırımcı', {
    isDailyReport: true,
    marketData: {
      observedAt: null,
      missingFields: ['BIST 100 (XU100)', 'Bitcoin (BTC/USD)'],
    },
  });
  assert.match(emptyHtml, /Boş Veri Durumu/);
  assert.match(emptyHtml, /güncel fiyat alınamadı/);
});

test('EPO-08: scheduled bulletin records scheduled/start times, duration, delay, and detects missed runs', async () => {
  const schedMod = loader()('src/lib/email/scheduleMonitor.ts');

  const scheduled = schedMod.computeScheduledBulletinTime('2026-11-11');
  assert.equal(scheduled.toISOString(), '2026-11-11T15:30:00.000Z'); // 18:30 TSİ

  const metrics = schedMod.calculateScheduleMetrics({
    scheduledFor: new Date('2026-11-11T15:30:00.000Z'),
    startedAt: new Date('2026-11-11T15:32:15.000Z'),
    finishedAt: new Date('2026-11-11T15:32:45.000Z'),
  });
  assert.equal(metrics.scheduleDelayMs, 135_000);
  assert.equal(metrics.durationMs, 30_000);

  // Wednesday 2026-11-11 19:00 TSİ (16:00Z, past grace window).
  // Monday 2026-11-09 completed, Tuesday 2026-11-10 missed, Wednesday 2026-11-11 missed, weekend ignored.
  const missed = schedMod.detectMissedBulletinRuns({
    now: new Date('2026-11-11T16:00:00.000Z'),
    lookbackDays: 5,
    recentRuns: [
      {
        bulletin_date: '2026-11-09',
        job_type: 'daily_bulletin',
        scheduled_for: '2026-11-09T15:30:00.000Z',
        started_at: '2026-11-09T15:30:05.000Z',
        status: 'completed',
        recipients_count: 10,
        successful_count: 10,
      },
    ],
  });
  assert.deepEqual([...missed], ['2026-11-11', '2026-11-10']);

  // Verify cron route records and returns schedule telemetry
  const inserted = [];
  const updated = [];
  const fakeAdmin = {
    auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
    from: (table) => ({
      insert: (row) => {
        if (table === 'bulletin_run_telemetry') inserted.push(row);
        return {
          select: () => ({ maybeSingle: async () => ({ data: { id: 'run-1' }, error: null }) }),
        };
      },
      update: (patch) => {
        if (table === 'bulletin_run_telemetry') updated.push(patch);
        return { eq: async () => ({ error: null }) };
      },
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [], error: null }),
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
      upsert: async () => ({ error: null }),
    }),
  };
  const cronLoader = loader({
    '@/lib/supabase/admin': { createAdminClient: () => fakeAdmin },
    '@/lib/email/service': { sendTestEmail: async () => ({ success: true, message: 'ok', senderAddress: 'kaanrmak7@gmail.com' }) },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 34.2 }) },
    '@/lib/email/deliveryQueue': {
      enqueueBulletinRecipients: async () => ({ persisted: true, existingByEmail: new Map() }),
      claimBulletinDelivery: async () => ({ status: 'processing', attempt_count: 1, max_attempts: 3 }),
      recordDeliveryOutcome: async () => ({ status: 'accepted' }),
      shouldSkipDuplicateDelivery: () => false,
      summarizeDeliveryQueue: async () => ({ pending: 0, accepted: 1, failed: 0, retryScheduled: 0, total: 1, available: true, bulletinDate: '2026-11-11', recentItems: [] }),
    },
    '@/lib/ai/modelCatalog': { hasProAccess: () => true },
  }, { CRON_SECRET: 'cron-secret-test' });
  const cronRoute = cronLoader('src/app/api/cron/daily-report/route.ts');
  const res = await cronRoute.POST(
    new Request('https://stockmind.test/api/cron/daily-report', {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret-test', 'content-type': 'application/json' },
      body: JSON.stringify({
        recipients: [{ email: 'sub@example.com', name: 'Abone' }],
        scheduledFor: '2026-11-11T15:30:00.000Z',
      }),
    }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.telemetry);
  assert.equal(body.telemetry.scheduled_for, '2026-11-11T15:30:00.000Z');
  assert.ok(typeof body.telemetry.started_at === 'string');
  assert.ok(typeof body.telemetry.finished_at === 'string');
  assert.equal(typeof body.telemetry.duration_ms, 'number');
  assert.equal(typeof body.telemetry.schedule_delay_ms, 'number');
  assert.equal(inserted.length, 1);
  assert.equal(updated.length, 1);

  // Verify admin stats & page display monitor
  const statsSrc = fs.readFileSync(path.join(root, 'src/app/api/admin/stats/route.ts'), 'utf8');
  assert.match(statsSrc, /summarizeBulletinScheduleTelemetry/);
  const adminPageSrc = fs.readFileSync(path.join(root, 'src/app/admin/page.tsx'), 'utf8');
  assert.match(adminPageSrc, /data-testid="bulletin-schedule-monitor"/);
  assert.match(adminPageSrc, /data-testid="bulletin-missed-badge"/);
});

test('EPO-09: personalized daily bulletin includes only matched portfolio events and opted-in summary fields', async () => {
  const baseLoad = loader();
  const pbMod = baseLoad('src/lib/email/personalizedBulletin.ts');

  const defaultPrefs = pbMod.resolvePersonalizedBulletinPrefs({});
  assert.equal(defaultPrefs.enabled, false);

  const optedOutSection = pbMod.buildPersonalizedBulletinSection({
    prefs: defaultPrefs,
    assets: [{ symbol: 'THYAO.IS', name: 'Türk Hava Yolları', exchange: 'BIST' }],
    events: [{ title: 'THYAO yeni sipariş', source: 'KAP' }],
    valuation: { totalValue: 250000, dailyChangePct: 1.5, isVerified: true },
  });
  assert.equal(optedOutSection, null);

  const optedInPrefs = pbMod.resolvePersonalizedBulletinPrefs({
    daily_report_personalized: true,
    daily_report_portfolio_fields: { events: true, totalValue: false, dailyChange: true },
  });
  assert.equal(optedInPrefs.enabled, true);
  assert.equal(optedInPrefs.includeTotalValue, false);
  assert.equal(optedInPrefs.includeDailyChange, true);

  const section = pbMod.buildPersonalizedBulletinSection({
    prefs: optedInPrefs,
    assets: [{ symbol: 'THYAO.IS', name: 'Türk Hava Yolları', exchange: 'BIST' }],
    events: [
      { title: 'Türk Hava Yolları kâr açıkladı <script>x</script>', source: 'KAP' },
      { title: 'GARAN kredi anlaşması imzaladı', source: 'AA Finans' },
    ],
    valuation: { totalValue: 250000, dailyChangePct: 2.35, isVerified: true },
  });
  assert.equal(section.enabled, true);
  assert.equal(section.events.length, 1);
  assert.equal(section.events[0].symbol, 'THYAO.IS');
  assert.equal(section.omittedEventCount, 1);
  assert.equal(section.allowedSummary.totalValue, undefined);
  assert.equal(section.allowedSummary.dailyChangePct, 2.35);

  const emailLoad = loader({ nodemailer: { createTransport: () => ({}) } });
  const emailSvc = emailLoad('src/lib/email/service.ts');
  const htmlStandard = emailSvc.generateStockMindEmailHtml('Yatırımcı', {
    isDailyReport: true,
    marketData: { usdtry: 34.5 },
    personalizedPortfolio: null,
  });
  assert.ok(!htmlStandard.includes('Kişiselleştirilmiş Portföy Özeti'));

  const htmlPersonalized = emailSvc.generateStockMindEmailHtml('Yatırımcı', {
    isDailyReport: true,
    marketData: { usdtry: 34.5 },
    personalizedPortfolio: section,
  });
  assert.ok(htmlPersonalized.includes('Kişiselleştirilmiş Portföy Özeti'));
  assert.ok(htmlPersonalized.includes('THYAO.IS'));
  assert.ok(htmlPersonalized.includes('&lt;script&gt;'));
  assert.ok(!htmlPersonalized.includes('GARAN'));
  assert.ok(!htmlPersonalized.includes('Toplam Değer'));
  assert.ok(htmlPersonalized.includes('2.35%'));

  // Cron route sends personalizedPortfolio strictly for opted-in subscribers
  const dispatchedPayloads = [];
  const fakeAdmin = {
    auth: {
      admin: {
        listUsers: async () => ({
          data: {
            users: [
              {
                id: 'u-std',
                email: 'std@example.com',
                email_confirmed_at: '2026-01-01T00:00:00Z',
                app_metadata: { plan: 'pro' },
                user_metadata: { daily_report_enabled: true, daily_report_personalized: false },
              },
              {
                id: 'u-pers',
                email: 'pers@example.com',
                email_confirmed_at: '2026-01-01T00:00:00Z',
                app_metadata: { plan: 'pro' },
                user_metadata: {
                  daily_report_enabled: true,
                  daily_report_personalized: true,
                  daily_report_portfolio_fields: { events: true, totalValue: false, dailyChange: false },
                },
              },
            ],
          },
          error: null,
        }),
      },
    },
    from(table) {
      if (table === 'transactions') {
        return {
          select() { return this; },
          eq: async () => ({ data: [{ symbol: 'THYAO.IS', asset_type: 'stock' }], error: null }),
        };
      }
      return {
        insert() {
          return {
            select() {
              return { maybeSingle: async () => ({ data: { id: 'run-1' }, error: null }) };
            },
          };
        },
        update() { return { eq: async () => ({ error: null }) }; },
        select() { return this; },
        eq() { return this; },
        limit: async () => ({ data: [], error: null }),
      };
    },
  };

  const cronLoader = loader({
    '@/lib/supabase/admin': { createAdminClient: () => fakeAdmin },
    '@/lib/email/service': {
      sendTestEmail: async (p) => {
        dispatchedPayloads.push(p);
        return { success: true, message: 'ok', senderAddress: 'kaanrmak7@gmail.com' };
      },
    },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({ usdtry: 34.5 }) },
    '@/lib/news/snapshot': {
      fetchNewsSnapshot: async () => [
        { title: 'THYAO yolcu sayısı arttı', source: 'KAP', summary: '', publishedAt: '2026-11-11T15:00:00Z' },
        { title: 'Alakasız makro başlık', source: 'AA', summary: '', publishedAt: '2026-11-11T15:05:00Z' },
      ],
    },
    '@/lib/email/deliveryQueue': {
      enqueueBulletinRecipients: async () => ({ persisted: true, existingByEmail: new Map() }),
      claimBulletinDelivery: async () => ({ status: 'processing', attempt_count: 1, max_attempts: 3 }),
      recordDeliveryOutcome: async () => ({ status: 'accepted' }),
      shouldSkipDuplicateDelivery: () => false,
      summarizeDeliveryQueue: async () => ({ pending: 0, accepted: 2, failed: 0, retryScheduled: 0, total: 2, available: true, bulletinDate: '2026-11-11', recentItems: [] }),
    },
    '@/lib/ai/modelCatalog': { hasProAccess: () => true },
  }, { CRON_SECRET: 'cron-secret-test' });

  const cronRoute = cronLoader('src/app/api/cron/daily-report/route.ts');
  const res = await cronRoute.POST(
    new Request('https://stockmind.test/api/cron/daily-report', {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret-test', 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(res.status, 200);
  const stdPayload = dispatchedPayloads.find((p) => p.to === 'std@example.com');
  const persPayload = dispatchedPayloads.find((p) => p.to === 'pers@example.com');
  assert.equal(stdPayload.personalizedPortfolio, null);
  assert.equal(persPayload.personalizedPortfolio.enabled, true);
  assert.equal(persPayload.personalizedPortfolio.events.length, 1);
  assert.equal(persPayload.personalizedPortfolio.events[0].symbol, 'THYAO.IS');

  const settingsSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/settings/page.tsx'), 'utf8');
  assert.match(settingsSrc, /personalized-bulletin-prefs/);
});




test('Admin APIs require signed AAL2 claims belonging to the verified admin', async () => {
  const user = { id: 'admin-user', email: 'admin@example.com', email_confirmed_at: '2026-01-01', app_metadata: {} };
  for (const claims of [{ sub: user.id, aal: 'aal1' }, { sub: 'other-user', aal: 'aal2' }, { sub: user.id, aal: 'aal2' }]) {
    const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: {
      getUser: async () => ({ data: { user } }),
      getClaims: async () => ({ data: { claims } }),
    } }) } }, { ADMIN_EMAIL: 'admin@example.com' });
    if (claims.sub === user.id && claims.aal === 'aal2') assert.equal(await load('src/lib/pro/admin.ts').requireProAdmin(), user);
    else await assert.rejects(load('src/lib/pro/admin.ts').requireProAdmin(), error => error.code === 'ADMIN_MFA_REQUIRED');
  }
  const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: {
    getUser: async () => ({ data: { user } }),
    getClaims: async () => ({ data: null, error: new Error('Invalid signature') }),
  } }) } }, { ADMIN_EMAIL: 'admin@example.com' });
  await assert.rejects(load('src/lib/pro/admin.ts').requireProAdmin(), error => error.code === 'ADMIN_MFA_REQUIRED');
});

test('Auth callback ignores spoofed forwarded headers and rejects cross-origin next paths', async () => {
  const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: {
    exchangeCodeForSession: async () => ({ error: null }),
    getUser: async () => ({ data: { user: { user_metadata: {} } } }),
  } }) } }, { NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://stockmind.test' });
  const route = load('src/app/auth/callback/route.ts');
  for (const next of ['//attacker.example/', '/\\attacker.example/', '/\n/attacker.example/', 'https://attacker.example/', '/dashboard?tab=holdings']) {
    const response = await route.GET(new Request(`https://internal.invalid/auth/callback?code=code&next=${encodeURIComponent(next)}`, {
      headers: { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'http' },
    }));
    const target = new URL(response.headers.get('location'));
    assert.equal(target.origin, 'https://stockmind.test');
    assert.equal(target.pathname, '/dashboard');
    assert.equal(target.search, next === '/dashboard?tab=holdings' ? '?tab=holdings' : '');
  }
});

test('Two bulletin workers cannot send the same recipient concurrently or after restart', async () => {
  const users = [{ email: 'owner@example.test', email_confirmed_at: '2026-01-01', app_metadata: { plan: 'pro' } }];
  const rows = new Map();
  const admin = queueAdmin(users, rows);
  let sent = 0;
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const providerStarted = new Promise(resolve => { started = resolve; });
  const makeRoute = () => loader({
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/email/marketData': { getBulletinMarketData: async () => ({}) },
    '@/lib/email/service': { sendTestEmail: async () => { sent++; started(); await gate; return { success: true }; } },
  }, { CRON_SECRET: 'cron-secret' })('src/app/api/cron/daily-report/route.ts');
  const makeRequest = () => request({}, { authorization: 'Bearer cron-secret' });
  const first = makeRoute().POST(makeRequest());
  await providerStarted;
  try {
    const second = await makeRoute().POST(makeRequest());
    assert.equal(second.status, 503);
    assert.equal(sent, 1);
  } finally { release(); }
  assert.equal((await first).status, 200);
  assert.equal((await makeRoute().POST(makeRequest())).status, 200);
  assert.equal(sent, 1);
  assert.equal([...rows.values()][0].status, 'accepted');
});

test('A missing durable mail queue or claim RPC never reaches the email provider', async () => {
  for (const missing of ['table', 'rpc']) {
    let sent = 0;
    const users = [{ email: 'owner@example.test', email_confirmed_at: '2026-01-01', app_metadata: { plan: 'pro' } }];
    const admin = queueAdmin(users);
    if (missing === 'table') admin.from = () => { throw new Error('Missing table'); };
    else admin.rpc = async () => ({ data: null, error: { code: 'PGRST202' } });
    const route = loader({
      '@/lib/supabase/admin': { createAdminClient: () => admin },
      '@/lib/email/marketData': { getBulletinMarketData: async () => ({}) },
      '@/lib/email/service': { sendTestEmail: async () => { sent++; return { success: true }; } },
    }, { CRON_SECRET: 'cron-secret' })('src/app/api/cron/daily-report/route.ts');
    const response = await route.POST(request({}, { authorization: 'Bearer cron-secret' }));
    assert.ok([500, 503].includes(response.status));
    assert.equal(sent, 0);
  }
});

test('Admin mutation origin validation runs before administrator lookup', async () => {
  let lookups = 0;
  const load = loader({ '@/lib/pro/admin': { requireProAdmin: async () => { lookups++; return { id: 'admin' }; } }, '@/lib/supabase/server': {} });
  const { requireDesktopAdmin } = load('src/lib/admin/desktopGuard.ts');
  for (const origin of [undefined, 'https://attacker.example']) {
    await assert.rejects(requireDesktopAdmin(request({}, origin ? { origin } : {})), error => error.code === 'FORBIDDEN_ORIGIN');
  }
  assert.equal(lookups, 0);
  await requireDesktopAdmin(request({}, { origin: 'https://stockmind.test' }));
  assert.equal(lookups, 1);
});

test('Android origin policy rejects prefix, credential, protocol and port bypasses in real Java', (t) => {
  const { execFileSync, spawnSync } = require('node:child_process');
  const os = require('node:os');
  const candidates = [process.env.JAVA_HOME, '/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/homebrew/opt/openjdk@21'];
  const javaHome = candidates.find(p => p && fs.existsSync(path.join(p, 'bin', 'javac')));
  const javac = javaHome ? path.join(javaHome, 'bin', 'javac') : 'javac';
  const java = javaHome ? path.join(javaHome, 'bin', 'java') : 'java';
  if (spawnSync(javac, ['-version']).status !== 0) { t.skip('A JDK is required for the native origin policy test'); return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stockmind-origin-test-'));
  try {
    execFileSync(javac, ['-d', dir, path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/TrustedUrls.java'), path.join(root, 'tests/android/TrustedUrlsTest.java')]);
    assert.match(execFileSync(java, ['-cp', dir, 'TrustedUrlsTest'], { encoding: 'utf8' }), /checks passed/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
