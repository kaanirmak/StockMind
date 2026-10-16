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
function newsRoute(fetch, snapshot = []) {
  const text = load('src/lib/news/rssText.ts');
  return load('src/app/api/news/route.ts', {
    require: name => name === 'next/server' ? { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } } : name === 'crypto' ? { default: require('node:crypto') } : name === '@/lib/news/symbolMatch' ? load('src/lib/news/symbolMatch.ts') : name === '@/lib/news/sentiment' ? load('src/lib/news/sentiment.ts') : name === '@/lib/news/feeds' ? load('src/lib/news/feeds.ts') : name === '@/lib/news/snapshot' ? { fetchNewsSnapshot: async () => snapshot } : text,
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
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pending.length, load('src/lib/news/feeds.ts').NEWS_FEEDS.length);
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

test('Fresh collected news avoids publisher calls; stale collected news survives an upstream outage', async () => {
  const makeArticle = age => ({ id: 'snapshot-1', title: 'BIST haber', summary: 'Haber', url: 'https://example.com/news', source: 'TRT Haber', feedId: 'trt-economy', category: 'BIST', sentiment: 'neutral', publishedAt: new Date().toISOString(), collectedAt: new Date(Date.now() - age).toISOString() });
  let calls = 0;
  const freshArticles = load('src/lib/news/feeds.ts').NEWS_FEEDS.filter(feed => feed.categories.includes('BIST')).map((feed, i) => ({ ...makeArticle(0), id: `fresh-${i}`, title: `BIST haber ${i}`, feedId: feed.id, source: feed.name }));
  const fresh = newsRoute(async () => { calls++; throw new Error('Unavailable'); }, freshArticles);
  const result = await fresh.GET(new Request('https://example.com/api/news?category=BIST'));
  assert.equal(result.status, 200);
  assert.equal(result.body.count, freshArticles.length);
  assert.equal(calls, 0);
  const stale = newsRoute(async () => { throw new Error('Unavailable'); }, [makeArticle(3600000)]);
  const fallback = await stale.GET(new Request('https://example.com/api/news?category=BIST'));
  assert.equal(fallback.status, 200);
  assert.equal(fallback.body.stale, true);
  assert.equal(fallback.body.count, 1);
});
test('News snapshots reject expired and malformed entries', () => {
  const { readNewsSnapshot } = load('src/lib/news/snapshot.ts', { require: () => load('src/lib/news/feeds.ts') });
  const now = Date.now();
  const a = { id: '1', title: 'Haber', summary: '', source: 'TRT Haber', feedId: 'trt-economy', url: 'https://example.com', category: 'BIST', sentiment: 'neutral', publishedAt: new Date(now).toISOString(), collectedAt: new Date(now).toISOString() };
  assert.equal(readNewsSnapshot({ data: [a] }, now).length, 1);
  assert.equal(readNewsSnapshot({ data: [{ ...a, collectedAt: new Date(now - 86400001).toISOString() }, { ...a, url: 'javascript:bad()' }] }, now).length, 0);
});

test('KAP never presents publisher articles as official company disclosures', async () => {
  const { GET } = newsRoute(async () => { throw new Error('Must not fetch'); });
  const result = await GET(new Request('https://example.com/api/news?category=KAP'));
  assert.equal(result.status, 200);
  assert.equal(result.body.count, 0);
  assert.match(result.body.warning, /KAP/);
});
test('A symbol without matching news does not receive unrelated general headlines', async () => {
  const article = { id: '1', title: 'Ekonomi haber', summary: 'Genel ekonomi', category: 'BIST', feedId: 'trt-economy', collectedAt: new Date().toISOString(), publishedAt: new Date().toISOString() };
  const { GET } = newsRoute(async () => { throw new Error('Must not fetch'); }, [article]);
  const result = await GET(new Request('https://example.com/api/news?category=BIST&symbol=UNKNOWN'));
  assert.equal(result.body.count, 0);
});

test('News sentiment distinguishes financial context, ambiguity, negation and mixed developments', () => {
  const { analyzeNewsSentiment } = load('src/lib/news/sentiment.ts');
  for (const [title, expected] of [
    ['Merkez Bankası faiz kararını açıkladı', 'neutral'],
    ['ECB raises interest rates', 'neutral'],
    ['Borsa yükselecek mi?', 'neutral'],
    ['Borsa yükselecek', 'neutral'],
    ['Karadeniz limanlarında yeni karar', 'neutral'],
    ['Enflasyon yüzde 40’a yükseldi', 'negative'],
    ['Enflasyon geriledi', 'positive'],
    ['Şirketin net kârı yüzde 20 arttı', 'positive'],
    ['Şirket net zarar açıkladı', 'negative'],
    ['BIST endeksi geriledi', 'negative'],
    ['Borsada yükseliş bekleniyor', 'neutral'],
    ['Şirket zarar açıklamadı', 'neutral'],
    ['Company profits increased', 'positive'],
    ['Inflation rose', 'negative'],
    ['Stocks fell', 'negative'],
    ['Borsa yükseldi ancak şirket net zarar açıkladı', 'neutral'],
  ]) assert.equal(analyzeNewsSentiment(title).sentiment, expected, title);
});
test('Snapshot sentiment is recalculated instead of trusting old cached labels', async () => {
  const article = { id: '1', title: 'Enflasyon yükseldi', summary: '', category: 'MACRO', feedId: 'trt-economy', sentiment: 'positive', collectedAt: new Date().toISOString(), publishedAt: new Date().toISOString() };
  const { GET } = newsRoute(async () => { throw new Error('Must not fetch'); }, [article]);
  const result = await GET(new Request('https://example.com/api/news?category=MACRO'));
  assert.equal(result.body.data[0].sentiment, 'negative');
  assert.ok(result.body.data[0].sentimentReason);
});

test('news symbols reject month names, substrings and ordinary prose', () => {
  const { mentionsNewsSymbol } = load('src/lib/news/symbolMatch.ts');
  assert.equal(mentionsNewsSymbol("Faiz kararı 22 Ekim'de açıklanacak", 'EKIM'), false);
  assert.equal(mentionsNewsSymbol('22 EKIM tarihinde', 'EKIM'), false);
  assert.equal(mentionsNewsSymbol('ASELS bilançosunu açıkladı', 'ASELS'), true);
  assert.equal(mentionsNewsSymbol('ASELSAN yeni sözleşme imzaladı', 'ASELS'), true);
  assert.equal(mentionsNewsSymbol('THFON yeni fon', 'THF'), false);
  assert.equal(mentionsNewsSymbol('Fon $THF için açıklama', 'THF'), true);
  assert.equal(mentionsNewsSymbol('Hisse $EKIM yükseldi', 'EKIM'), true);
  assert.equal(mentionsNewsSymbol('Türkiye inovasyon ödülleri', 'ON'), false);
});

test('portfolio news recognizes company names with Turkish casing without generic sector matches', () => {
  const { mentionsNewsSymbol } = load('src/lib/news/symbolMatch.ts');
  assert.equal(mentionsNewsSymbol('Aselsan yeni ihracat sözleşmesi imzaladı', 'ASELS'), true);
  assert.equal(mentionsNewsSymbol('Türk Hava Yolları yolcu sayısını açıkladı', 'THYAO'), true);
  assert.equal(mentionsNewsSymbol('ŞİŞECAM yatırımlarını artırıyor', 'SISE'), true);
  assert.equal(mentionsNewsSymbol('Migros büyüyor', 'MGROS'), true);
  assert.equal(mentionsNewsSymbol('Hava yollarında genel büyüme', 'THYAO'), false);
  assert.equal(mentionsNewsSymbol('Şişe üretimi artıyor', 'SISE'), false);
});

test('portfolio news scans beyond the first fifteen feed items', async () => {
  const items = Array.from({ length: 25 }, (_, index) => `<item><title>${index === 24 ? 'Aselsan ihracat sözleşmesi imzaladı' : 'Genel haber ' + index}</title><link>https://example.com/item-${index}</link><pubDate>Fri, 16 Oct 2026 10:00:00 GMT</pubDate></item>`).join('');
  const { GET } = newsRoute(async () => ({ ok: true, text: async () => `<rss><channel>${items}</channel></rss>` }));
  const result = await GET(new Request('https://example.com/api/news?category=PORTFOLIO&symbols=ASELS'));
  assert.equal(result.status, 200);
  assert.equal(result.body.count, 1);
  assert.equal(result.body.data[0].title, 'Aselsan ihracat sözleşmesi imzaladı');
});

test('portfolio publishes ready quotes while a slower asset is still loading', async () => {
  let state;
  let releaseSlow;
  const pendingSlow = new Promise(resolve => { releaseSlow = resolve; });
  const { usePortfolioStore } = load('src/store/usePortfolioStore.ts', {
    AbortSignal,
    require(name) {
      if (name === 'zustand') return { create: initializer => {
        state = initializer(update => { state = { ...state, ...update }; }, () => state);
        return state;
      } };
      if (name === '@/lib/portfolio/calculations') return { normalizeSymbolKey: s => s, cleanSymbol: s => ({ symbol: s, assetType: 'stock' }) };
      if (name === '@/lib/portfolio/cash') return {};
      if (name === '@/lib/supabase/client') return {};
      throw new Error(name);
    },
    fetch: async (url, options) => {
      assert.ok(options.signal);
      if (url.endsWith('/THYAO')) await pendingSlow;
      return { ok: true, json: async () => ({ success: true, data: { price: url.endsWith('/USDTRY') ? 40 : 100, changePercent: -1 } }) };
    },
  });
  state.transactions = [{ symbol: 'ASELS', assetType: 'stock' }, { symbol: 'THYAO', assetType: 'stock' }];
  const request = usePortfolioStore.fetchLivePrices();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(state.livePrices.USDTRY.price, 40);
  assert.equal(state.livePrices.ASELS.price, 100);
  assert.equal(state.livePrices.THYAO, undefined);
  assert.equal(state.isRefreshingPrices, true);
  releaseSlow();
  await request;
  assert.equal(state.livePrices.THYAO.price, 100);
  assert.equal(state.isRefreshingPrices, false);
});
