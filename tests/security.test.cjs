const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Run the real TypeScript modules, replacing only network/framework boundaries.
function loader(stubs = {}, env = {}) {
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
    { email: 'ADMIN@example.com', email_confirmed_at: '2026-01-01', app_metadata: {} },
    { email: 'other@example.com', app_metadata: { role: 'admin' } },
  ]) {
    const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) } }, { ADMIN_EMAIL: 'admin@example.com' });
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
    approveUrl: 'https://stockmind.test/approve',
    rejectUrl: 'https://stockmind.test/reject',
  });

  assert.equal(capturedHtml.includes('<script>evil()</script>'), false);
  assert.equal(capturedHtml.includes('&lt;script&gt;evil()&lt;/script&gt;'), true);
  assert.equal(capturedHtml.includes('<img src=x'), false);
  assert.equal(capturedHtml.includes('&lt;img src=x'), true);
  assert.equal(capturedHtml.includes('user&lt;hack&gt;@example.com'), true);
});

test('SEC-02: Pro approval rejects replay when pro_request_status is not pending', async () => {
  const token = 'valid.token';
  const makeLoader = (requestStatus) => loader({
    '@/lib/pro/tokens': {
      verifyProActionToken: () => ({ valid: true, action: 'approve', userId: 'user-42', email: 'investor@example.com' }),
    },
    '@/lib/supabase/admin': {
      createAdminClient: () => ({
        auth: {
          admin: {
            getUserById: async () => ({
              data: {
                user: {
                  id: 'user-42',
                  email: 'investor@example.com',
                  app_metadata: {},
                  user_metadata: { pro_request_status: requestStatus },
                },
              },
              error: null,
            }),
            updateUserById: async () => ({ error: null }),
          },
        },
        from: () => ({ update: () => ({ eq: async () => ({}) }) }),
      }),
    },
    '@/lib/email/service': { sendProApprovedUserEmail: async () => ({ success: true }) },
  });

  // Replay attempt on an already-approved user must be rejected with 400
  const approvedRoute = makeLoader('approved')('src/app/api/admin/pro-request/approve/route.ts');
  const replayRes = await approvedRoute.GET(new Request('https://stockmind.test/api/admin/pro-request/approve?userId=user-42&token=valid.token'));
  assert.equal(replayRes.status, 400);
  const replayBody = await replayRes.text();
  assert.match(replayBody, /daha önce sonuçlandırılmış veya beklemede değil/);

  // Fresh pending request must succeed with 200
  const pendingRoute = makeLoader('pending')('src/app/api/admin/pro-request/approve/route.ts');
  const validRes = await pendingRoute.GET(new Request('https://stockmind.test/api/admin/pro-request/approve?userId=user-42&token=valid.token'));
  assert.equal(validRes.status, 200);
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



