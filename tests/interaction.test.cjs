const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, Date, Map, Set, Symbol, console, ...globals });
  return module.exports;
}
test('Nested overlays keep background locked until the last overlay closes and restore scroll/style', () => {
  const cleanups = [];
  const body = { style: { position: 'relative', top: '', width: '80%', overflow: 'auto', paddingRight: '2px' } };
  const html = { style: { overflow: 'clip' }, clientWidth: 380, dataset: {} };
  const scrolls = [];
  const { useScrollLock } = load('src/hooks/useScrollLock.ts', { require: () => ({ useEffect: (effect) => cleanups.push(effect()) }), document: { body, documentElement: html }, window: { scrollY: 420, innerWidth: 390, scrollTo: (args) => scrolls.push(args) } });
  useScrollLock(true);
  useScrollLock(true);
  useScrollLock(false);
  assert.equal(body.style.position, 'fixed');
  assert.equal(body.style.top, '-420px');
  cleanups[0]();
  assert.equal(body.style.overflow, 'hidden');
  cleanups[1]();
  assert.equal(body.style.position, 'relative');
  assert.equal(body.style.width, '80%');
  assert.equal(body.style.overflow, 'auto');
  assert.equal(body.style.paddingRight, '2px');
  assert.equal(html.style.overflow, 'clip');
  assert.equal(html.dataset.scrollLocked, undefined);
  assert.equal(scrolls[0].top, 420);
});
test('Public market requests are deduplicated, cached, and explicitly refreshable', async () => {
  let requests = 0;
  let resolve;
  const { marketJson } = load('src/lib/api/clientCache.ts', { fetch: () => { requests++; return new Promise((r) => { resolve = () => r({ ok: true, json: async () => ({ success: true, data: requests }) }); }); } });
  const a = marketJson('/api/stocks');
  const b = marketJson('/api/stocks');
  assert.equal(requests, 1);
  resolve();
  assert.equal((await a).data, (await b).data);
  assert.equal((await marketJson('/api/stocks')).data, 1);
  assert.equal(requests, 1);
  const forced = marketJson('/api/stocks', 30_000, true);
  assert.equal(requests, 2);
  resolve();
  assert.equal((await forced).data, 2);
});
test('Failed market requests are never cached and can be retried', async () => {
  let requests = 0;
  const { marketJson } = load('src/lib/api/clientCache.ts', { fetch: async () => ({ ok: ++requests > 1, json: async () => ({ success: true }) }) });
  await assert.rejects(marketJson('/api/stocks'));
  await marketJson('/api/stocks');
  assert.equal(requests, 2);
});
test('Notification inbox migrates old alarm fields and refuses external navigation', () => {
  let stored = JSON.stringify([{ id: 'old', title: 'Alarm', route: '/stocks/THYAO', category: 'price', timestamp: 'Az önce', read: false }, { id: 'unsafe', route: 'https://example.com' }]);
  const events = [];
  const { readInbox, saveInbox, safeInboxLink } = load('src/lib/notifications/inbox.ts', { localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } }, window: { dispatchEvent: (e) => events.push(e.type) }, Event: class { constructor(type) { this.type = type; } } });
  const items = readInbox();
  assert.equal(items[0].link, '/stocks/THYAO');
  assert.equal(items[0].category, 'market');
  assert.equal(items[0].time, 'Az önce');
  assert.equal(items[1].link, undefined);
  assert.equal(safeInboxLink('//evil.com'), undefined);
  assert.equal(safeInboxLink('/stocks/\\evil'), undefined);
  saveInbox(items.map((n) => ({ ...n, archived: true, read: true })));
  assert.equal(readInbox()[0].archived, true);
  assert.deepEqual(events, ['stockmind:inbox']);
});
test('Losses have an explicit minus sign so meaning does not depend on color', () => {
  const { getPnLSign } = load('src/lib/utils/format.ts');
  assert.equal(getPnLSign(-12.4), '-');
  assert.equal(getPnLSign(12.4), '+');
  assert.equal(getPnLSign(0), '');
});

function chatScrollHarness() {
  const effects = [], frames = new Map();
  let nextFrame = 0, resize, visible;
  const el = { scrollTop: 500, scrollHeight: 1000, clientHeight: 500, scrollTo({ top }) { this.scrollTop = Math.min(top, this.scrollHeight - this.clientHeight); } };
  const { useChatScroll } = load('src/hooks/useChatScroll.ts', {
    require: () => ({ useRef: (v) => ({ current: v }), useCallback: (fn) => fn, useEffect: (fn) => effects.push(fn), useState: () => [false, (v) => { visible = v; }] }),
    requestAnimationFrame: (fn) => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() {} },
  });
  const hook = useChatScroll([], 'one');
  hook.containerRef.current = el;
  hook.contentRef.current = {};
  const cleanups = effects.map(fn => fn());
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  return { hook, el, flush, resize: () => resize(), visible: () => visible, dispose: () => cleanups.forEach(fn => fn?.()) };
}

test('Touch cancels queued auto-follow; incoming content preserves the reading position', () => {
  const h = chatScrollHarness();
  h.hook.onTouchStart();
  h.el.scrollTop = 250;
  h.hook.onScroll();
  h.hook.onTouchEnd();
  h.el.scrollHeight = 1500;
  h.resize();
  h.flush();
  assert.equal(h.el.scrollTop, 250);
  assert.equal(h.visible(), true);
  h.dispose();
});

test('Small upward scrolling also pauses follow; explicit latest restores following after resize', () => {
  const h = chatScrollHarness();
  h.flush();
  h.hook.onWheel();
  h.el.scrollTop = 475;
  h.hook.onScroll();
  h.el.scrollHeight = 1100;
  h.resize();
  h.flush();
  assert.equal(h.el.scrollTop, 475);
  h.hook.followLatest();
  assert.equal(h.el.scrollTop, 600);
  h.el.clientHeight = 350;
  h.resize();
  h.flush();
  assert.equal(h.el.scrollTop, 750);
  h.dispose();
});

test('APK download appears only in an Android browser, never desktop or an installed app', () => {
  const { detectAppPlatform } = load('src/lib/utils/appPlatform.ts');
  assert.equal(detectAppPlatform({ userAgent: 'Mozilla Android 14' }).canDownloadApk, true);
  assert.equal(detectAppPlatform({ userAgent: 'Mozilla Android 14', nativeAndroid: true }).canDownloadApk, false);
  assert.equal(detectAppPlatform({ userAgent: 'Mozilla Android 14', standalone: true }).canDownloadApk, false);
  assert.equal(detectAppPlatform({ userAgent: 'Macintosh', platform: 'MacIntel' }).canDownloadApk, false);
  assert.equal(detectAppPlatform({ userAgent: 'Windows NT 10.0' }).canDownloadApk, false);
});
test('iPad desktop user agents receive iOS instructions and Mac receives Mac instructions', () => {
  const { detectAppPlatform } = load('src/lib/utils/appPlatform.ts');
  assert.equal(detectAppPlatform({ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 }).os, 'ios');
  assert.equal(detectAppPlatform({ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 0 }).os, 'mac');
  assert.equal(detectAppPlatform({ userAgent: 'iPhone Safari' }).os, 'ios');
});

test('RSS escaped descriptions become readable text without HTML markup', () => {
  const { rssPlainText } = load('src/lib/news/rssText.ts');
  assert.equal(rssPlainText('&lt;a href="https://example.com"&gt;Haber &amp; gelişme&lt;/a&gt;&amp;nbsp;&lt;font&gt;Kaynak&lt;/font&gt;'), 'Haber & gelişme Kaynak');
  assert.equal(rssPlainText('<![CDATA[<b>Başlık</b> &#x130;]]>'), 'Başlık İ');
  assert.equal(rssPlainText('&lt;script&gt;bad()&lt;/script&gt;Haber'), 'Haber');
});
function newsRoute(fetch) {
  const text = load('src/lib/news/rssText.ts');
  return load('src/app/api/news/route.ts', {
    require: name => name === 'next/server' ? { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } } : name === 'crypto' ? { default: require('node:crypto') } : text,
    fetch, AbortSignal, URL,
    console: { error() {} },
  });
}
test('News starts all feeds concurrently and preserves successful feeds when one source fails', async () => {
  const pending = [];
  const { GET } = newsRoute((url, options) => new Promise((resolve, reject) => {
    assert.ok(options.signal);
    pending.push({ resolve, reject });
  }));
  const response = GET(new Request('https://example.com/api/news'));
  assert.equal(pending.length, 4);
  pending[0].resolve({ ok: true, text: async () => '<rss><channel><item><title>ASELS haber</title><link>https://example.com/article</link><pubDate>Fri, 16 Oct 2026 10:00:00 GMT</pubDate><source>Kaynak</source></item></channel></rss>' });
  pending.slice(1).forEach(p => p.reject(new Error('Source timed out')));
  const result = await response;
  assert.equal(result.status, 200);
  assert.equal(result.body.count, 1);
  assert.equal(result.body.partial, true);
});
test('All failed news sources report service failure, rather than a successful empty news list', async () => {
  const { GET } = newsRoute(async () => ({ ok: false, status: 503 }));
  const result = await GET(new Request('https://example.com/api/news'));
  assert.equal(result.status, 503);
  assert.equal(result.body.success, false);
});
