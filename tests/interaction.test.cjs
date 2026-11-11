const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, Date, Map, Set, Symbol, URLSearchParams, console, process: { env: {} },
    require: name => name.startsWith('.') ? load(path.join(path.dirname(file), `${name}.ts`), globals) : name.startsWith('@/') ? load(path.join('src', `${name.slice(2)}.ts`), globals) : require(name), ...globals });
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
test('Android test notifications report denied permission and can be retried after granting it', async () => {
  const data = new Map();
  let permitted = false;
  let sends = 0;
  const { requestNotificationPermission, sendPushNotification } = load('src/lib/notifications/pushNotification.ts', {
    Event,
    localStorage: { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) },
    window: {
      dispatchEvent() {},
      StockMindAndroid: {
        requestNotificationPermission() {},
        hasNotificationPermission: () => permitted,
        sendNativeNotification: () => { sends++; return true; },
      },
    },
  });
  assert.equal(await requestNotificationPermission(), false);
  assert.equal(sendPushNotification('Test', 'Cihaz bildirimi', '/settings', true), false);
  permitted = true;
  assert.equal(sendPushNotification('Test', 'Cihaz bildirimi', '/settings', true), true);
  assert.equal(sends, 1);
});

test('ALR-03: notification permission state and channel delivery outcome are tracked separately', () => {
  const data = new Map();
  let permitted = false;
  let nativeDeliveryResult = true;
  let nativeCalls = 0;

  const {
    getNotificationPermissionState,
    sendPushNotificationWithResult,
    loadLastPushDeliveryDiagnostic,
  } = load('src/lib/notifications/pushNotification.ts', {
    Event,
    localStorage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
    },
    window: {
      dispatchEvent() {},
      StockMindAndroid: {
        hasNotificationPermission: () => permitted,
        sendNativeNotification: () => {
          nativeCalls++;
          return nativeDeliveryResult;
        },
      },
    },
  });

  // 1. Permission OFF: test explicitly reports denied permission without attempting channel send
  assert.equal(getNotificationPermissionState(), 'denied');
  const deniedTest = sendPushNotificationWithResult('Test', 'İzin kapalı testi', '/settings', true);
  assert.equal(deniedTest.permissionState, 'denied');
  assert.equal(deniedTest.channel, 'none');
  assert.equal(deniedTest.channelOutcome, 'permission-denied');
  assert.equal(deniedTest.delivered, false);
  assert.equal(nativeCalls, 0);
  assert.equal(loadLastPushDeliveryDiagnostic()?.channelOutcome, 'permission-denied');

  // 2. Permission ON + Android channel succeeds: permission and delivered outcome stored separately
  permitted = true;
  nativeDeliveryResult = true;
  assert.equal(getNotificationPermissionState(), 'granted');
  const deliveredTest = sendPushNotificationWithResult('Test', 'Kanal açık testi', '/settings', true);
  assert.equal(deliveredTest.permissionState, 'granted');
  assert.equal(deliveredTest.channel, 'android');
  assert.equal(deliveredTest.channelOutcome, 'delivered');
  assert.equal(deliveredTest.delivered, true);
  assert.equal(nativeCalls, 1);
  assert.equal(loadLastPushDeliveryDiagnostic()?.channelOutcome, 'delivered');

  // 3. Permission ON + Android channel fails: permission stays 'granted' while outcome records 'failed'
  nativeDeliveryResult = false;
  const failedChannelTest = sendPushNotificationWithResult('Test', 'Kanal hatası testi', '/settings', true);
  assert.equal(failedChannelTest.permissionState, 'granted');
  assert.equal(failedChannelTest.channel, 'android');
  assert.equal(failedChannelTest.channelOutcome, 'failed');
  assert.equal(failedChannelTest.delivered, false);
  assert.equal(nativeCalls, 2);
  const persistedFailure = loadLastPushDeliveryDiagnostic();
  assert.equal(persistedFailure?.permissionState, 'granted');
  assert.equal(persistedFailure?.channelOutcome, 'failed');

  // Verify settings UI displays separated permission status and channel delivery result
  const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'src/app/(dashboard)/settings/page.tsx'), 'utf8');
  assert.match(settingsSource, /sendPushNotificationWithResult/);
  assert.match(settingsSource, /data-testid="push-delivery-diagnostic"/);
  assert.match(settingsSource, /Bildirim İzni Durumu/);
  assert.match(settingsSource, /Son Kanal Test Sonucu/);
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
    require: name => name === 'next/server' ? { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } } : name === 'crypto' ? { default: require('node:crypto') } : name === '@/lib/news/symbolMatch' ? load('src/lib/news/symbolMatch.ts') : name === '@/lib/news/sentiment' ? load('src/lib/news/sentiment.ts') : name === '@/lib/news/feeds' ? load('src/lib/news/feeds.ts') : name === '@/lib/news/sourceCoverage' ? load('src/lib/news/sourceCoverage.ts') : name === '@/lib/news/snapshot' ? { fetchNewsSnapshot: async () => snapshot } : text,
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
  const freshArticles = load('src/lib/news/feeds.ts').NEWS_FEEDS.filter(feed => feed.categories.includes('BIST')).map((feed, i) => ({ ...makeArticle(0), id: `fresh-${i}`, title: `BIST haber ${i}`, url: `https://example.com/news/${i}`, feedId: feed.id, source: feed.name }));
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
  const article = { id: '1', title: 'Enflasyon yükseldi', summary: '', url: 'https://example.com/inflation', category: 'MACRO', feedId: 'trt-economy', sentiment: 'positive', collectedAt: new Date().toISOString(), publishedAt: new Date().toISOString() };
  const { GET } = newsRoute(async () => { throw new Error('Must not fetch'); }, [article]);
  const result = await GET(new Request('https://example.com/api/news?category=MACRO'));
  assert.equal(result.body.data[0].sentiment, 'negative');
  assert.ok(result.body.data[0].sentimentReason);
});

test('A fresh news feed survives while only stale feeds are fetched again', async () => {
  const called = [];
  const now = new Date().toISOString();
  const article = { id: 'trt', title: 'BIST bilanço', summary: '', url: 'https://example.com/trt',
    source: 'TRT Haber', feedId: 'trt-economy', category: 'BIST', collectedAt: now, publishedAt: now };
  const { GET } = newsRoute(async url => { called.push(url); return { ok: false, status: 503 }; }, [article]);
  const result = await GET(new Request('https://example.com/api/news?category=BIST'));
  assert.ok(called.length > 0);
  assert.ok(called.every(url => !url.includes('trthaber')));
  assert.equal(result.body.count, 1);
  assert.equal(result.body.partial, true);
  assert.equal(result.body.stale, false);
});

test('News relevance prioritizes fresh portfolio events and keeps chronological sorting available', () => {
  const { rankNews } = load('src/lib/news/relevance.ts');
  const now = Date.now();
  const article = (title, hours) => ({ title, summary: '', publishedAt: new Date(now - hours * 3_600_000).toISOString() });
  const general = article('Piyasalarda günün görünümü', 0);
  const event = article('Aselsan yeni sözleşme imzaladı', 4);
  const old = article('Aselsan finansal sonuçlar', 72);
  const ranked = rankNews([general, old, event], ['ASELS'], true, now);
  assert.equal(ranked[0].article, event);
  assert.equal(ranked[0].event, 'Şirket işlemi veya sözleşme');
  assert.equal(ranked[1].article, general);
  assert.equal(rankNews([event, general], ['ASELS'], false, now)[0].article, general);
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
      if (name === '@/lib/portfolio/samplePortfolio') return {
        getSamplePortfolioSnapshot: () => ({ summary: {} }),
        readSampleModeSession: () => false,
        writeSampleModeSession: () => {},
        stripSampleRecords: items => items,
        SAMPLE_TRANSACTIONS: [],
      };
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

test('PRO-01: multi-portfolio limit permits 1 portfolio for free accounts and unlimited for pro', () => {
  const checkCanCreatePortfolio = (isPro, currentCount) => {
    if (!isPro && currentCount >= 1) return false;
    return true;
  };

  // Free tier
  assert.equal(checkCanCreatePortfolio(false, 0), true, 'Free user can create their 1st portfolio');
  assert.equal(checkCanCreatePortfolio(false, 1), false, 'Free user cannot create a 2nd portfolio');
  assert.equal(checkCanCreatePortfolio(false, 5), false, 'Free user cannot create more than 1 portfolio');

  // Pro tier
  assert.equal(checkCanCreatePortfolio(true, 0), true, 'Pro user can create 1st portfolio');
  assert.equal(checkCanCreatePortfolio(true, 1), true, 'Pro user can create 2nd portfolio');
  assert.equal(checkCanCreatePortfolio(true, 10), true, 'Pro user has unlimited portfolios');
});

test('PRO-02: price alert limit permits 3 alerts for free accounts while allowing existing alert edits and unlimited for pro', () => {
  const checkCanSetAlert = ({ isPro, existingAlerts, targetSymbol }) => {
    const activeAlertsCount = existingAlerts.filter(
      item => (item.targetPrice || item.alertPercent) && item.symbol.toUpperCase() !== targetSymbol.toUpperCase()
    ).length;
    const existingItem = existingAlerts.find(item => item.symbol.toUpperCase() === targetSymbol.toUpperCase());
    const hasExistingAlert = Boolean(existingItem?.targetPrice || existingItem?.alertPercent);
    const isLimitReached = !isPro && activeAlertsCount >= 3 && !hasExistingAlert;
    return !isLimitReached;
  };

  const threeAlerts = [
    { symbol: 'THYAO', targetPrice: 320 },
    { symbol: 'ASELS', alertPercent: 5 },
    { symbol: 'GARAN', targetPrice: 110 },
  ];

  // Free tier: 3 alerts configured, adding 4th should be blocked
  assert.equal(
    checkCanSetAlert({ isPro: false, existingAlerts: threeAlerts, targetSymbol: 'KCHOL' }),
    false,
    'Free user cannot set a 4th alert'
  );

  // Free tier: updating an already alerted stock (THYAO) should be permitted
  assert.equal(
    checkCanSetAlert({ isPro: false, existingAlerts: threeAlerts, targetSymbol: 'THYAO' }),
    true,
    'Free user can update an existing alert'
  );

  // Free tier: fewer than 3 alerts permits new alert
  assert.equal(
    checkCanSetAlert({ isPro: false, existingAlerts: threeAlerts.slice(0, 2), targetSymbol: 'KCHOL' }),
    true,
    'Free user with 2 alerts can set a 3rd alert'
  );

  // Pro tier: unlimited alerts
  assert.equal(
    checkCanSetAlert({ isPro: true, existingAlerts: threeAlerts, targetSymbol: 'KCHOL' }),
    true,
    'Pro user can set 4th and unlimited alerts'
  );
});

test('AI history fits server limits while preserving the latest user question', () => {
  const { prepareChatHistory } = load('src/lib/ai/chatHistory.ts');
  const messages = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', content: String(i).padEnd(4000, 'x') }));
  const history = prepareChatHistory(messages);
  assert.equal(history[0].role, 'user');
  assert.equal(history.at(-1).content, messages.at(-1).content);
  assert.ok(history.reduce((total, m) => total + m.content.length, 0) <= 32000);
  assert.ok(history.every(m => m.content.length <= 8000));
});

test('AI rejects HTTP 200 error envelopes and empty answers instead of reporting success', async () => {
  const { readOpenRouterResponse } = load('src/lib/ai/openrouter.ts');
  const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
  await assert.rejects(readOpenRouterResponse(response(200, { error: { code: 429 } })), e => e.code === 'AI_RATE_LIMITED');
  await assert.rejects(readOpenRouterResponse(response(200, { choices: [{ message: { content: '  ' } }] })), e => e.code === 'AI_INVALID_RESPONSE');
  await assert.rejects(readOpenRouterResponse(response(403, {})), e => e.code === 'AI_PROVIDER_FORBIDDEN');
  await assert.rejects(readOpenRouterResponse(response(408, {})), e => e.code === 'AI_TIMEOUT');
  assert.equal(await readOpenRouterResponse(response(200, { choices: [{ message: { content: ' Yanıt ' } }] })), 'Yanıt');
});

test('AI trims server credentials and maps connection errors without leaking details', async () => {
  let authorization;
  const { callOpenRouter } = load('src/lib/ai/openrouter.ts', {
    process: { env: { OPENROUTER_API_KEY: ' key-with-space ' } }, AbortSignal,
    fetch: async (_, options) => { authorization = options.headers.Authorization; throw new TypeError('private network detail'); },
  });
  await assert.rejects(callOpenRouter([{ role: 'user', content: 'Merhaba' }]), e => e.code === 'AI_PROVIDER_UNAVAILABLE' && !e.message.includes('private'));
  assert.equal(authorization, 'Bearer key-with-space');
});

test('AI context discloses unavailable market data and never inserts a fallback dollar price', async () => {
  const { buildLiveAIContext } = load('src/lib/ai/market-context.ts', {
    require: () => ({ getStockBySymbolLive: async () => null }),
  });
  const context = await buildLiveAIContext('dolar kaç tl');
  assert.ok(context.startsWith('Piyasa verisi alınamadı'));
  assert.ok(!context.includes('48.78'));
  assert.ok(!context.includes('ASLA'));
});

test('Cancelling a chat aborts the provider request and returns a cancellation code', async () => {
  const controller = new AbortController();
  let providerSignal;
  const { callOpenRouter } = load('src/lib/ai/openrouter.ts', {
    process: { env: { OPENROUTER_API_KEY: 'test-key' } }, AbortSignal,
    fetch: async (_, options) => {
      providerSignal = options.signal;
      return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
    },
  });
  const result = callOpenRouter([{ role: 'user', content: 'hello' }], { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, error => error.code === 'AI_CANCELLED' && error.status === 499);
  assert.equal(providerSignal.aborted, true);
});

test('Model preference survives independent changes and never deletes or crosses API keys', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const events = [];
  const api = load('src/lib/ai/apiKeyStorage.ts', {
    require: () => ({}), localStorage: storage,
    window: { dispatchEvent: event => events.push(event.type) },
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  api.saveStoredOpenRouterKey('private-key-a', 'user-a', 'catalog/model-a');
  values.set('stockmind_settings_user-a', JSON.stringify({ defaultModel: 'old/model' }));
  api.saveStoredDefaultModel('catalog/model-b', 'user-a');
  assert.equal(api.getStoredOpenRouterKey('user-a'), 'private-key-a');
  assert.equal(api.getStoredDefaultModel('user-a'), 'catalog/model-b');
  assert.equal(api.getStoredDefaultModel('user-b'), 'openrouter/free');
  assert.equal(api.getStoredOpenRouterKey('user-b'), '');
  api.saveStoredDefaultModel('catalog/model-c', 'user-b');
  assert.equal(api.getStoredDefaultModel('user-a'), 'catalog/model-b');
  assert.equal(api.getStoredDefaultModel('user-b'), 'catalog/model-c');
  api.saveStoredDefaultModel('guest/model', null);
  assert.equal(api.getStoredDefaultModel(null), 'openrouter/free');
  assert.ok(events.includes('stockmind_ai_key_updated'));
});

test('Catalog loading preserves saved selection and validates access only after a complete catalog', () => {
  const { resolvePreferredModel, selectStructuredModel } = load('src/lib/ai/modelCatalog.ts');
  const models = [{ id: 'openrouter/free', free: true }, { id: 'catalog/free', free: true }, { id: 'catalog/paid', free: false, supportedParameters: ['structured_outputs'] }];
  assert.equal(resolvePreferredModel('catalog/free', [models[0]], false, false), 'catalog/free');
  assert.equal(resolvePreferredModel('catalog/free', models, false, true), 'catalog/free');
  assert.equal(resolvePreferredModel('catalog/paid', models, false, true), 'openrouter/free');
  assert.equal(resolvePreferredModel('catalog/paid', models, true, true), 'catalog/paid');
  assert.equal(resolvePreferredModel('removed/model', models, true, true), 'openrouter/free');
  assert.equal(selectStructuredModel(models).id, 'catalog/paid');
  assert.throws(() => selectStructuredModel(models, 'removed/model'));
});

test('Provider uses configurable budgets and a short-answer instruction without rewriting its response', async () => {
  let payload;
  const { callOpenRouter } = load('src/lib/ai/openrouter.ts', {
    process: { env: { OPENROUTER_API_KEY: 'key', AI_CHAT_MAX_TOKENS: '2200', AI_CHAT_BRIEF_WORD_TARGET: '55' } }, AbortSignal,
    fetch: async (_, options) => { payload = JSON.parse(options.body); return new Response(JSON.stringify({ choices: [{ message: { content: 'Provider reply stays intact.' } }] })); },
  });
  const result = await callOpenRouter([{ role: 'user', content: 'Explain briefly' }]);
  assert.equal(result, 'Provider reply stays intact.');
  assert.equal(payload.max_tokens, 2200);
  assert.ok(payload.messages[0].content.includes('55'));
  assert.ok(payload.messages[0].content.includes('önceliklidir'));
});

test('Committee rejects incomplete reports and preserves legitimate zero scores', () => {
  const committee = load('src/lib/ai/investment-committee.ts', {
    require: name => name === '@/theme/palette' ? { palette: {} } : name === './modelCatalog' ? {} : name === './runtimePolicy' ? {} : {},
  });
  const value = { consensusVerdict: 'AL', consensusScore: 0, consensusSummary: 'Observed report', agents: committee.COMMITTEE_AGENTS_CONFIG.map(agent => ({ id: agent.id, verdict: 'TUT', score: 0, speech: 'Observed data', keyArguments: ['Evidence'] })) };
  assert.equal(committee.parseCommitteeResponse(JSON.stringify(value)).consensusScore, 0);
  assert.throws(() => committee.parseCommitteeResponse('{}'));
  assert.throws(() => committee.parseCommitteeResponse(JSON.stringify({ ...value, agents: value.agents.slice(1) })));
  assert.throws(() => committee.parseCommitteeResponse('```json\n' + JSON.stringify(value) + '\n```'));
});

test('Market context resolves current catalog symbols and unique names without a company alias list', () => {
  const { detectSymbolsInText } = load('src/lib/ai/market-context.ts', { require: () => ({}) });
  const catalog = [{ symbol: 'NEW1', name: 'Yeni Şirket Teknoloji' }, { symbol: 'NEW2', name: 'Yeni Şirket Enerji' }, { symbol: 'FRESH', name: 'Dinamik Kurum' }];
  assert.deepEqual(Array.from(detectSymbolsInText('FRESH ve NEW1 analizini yap', catalog)).sort(), ['FRESH', 'NEW1']);
  assert.deepEqual(Array.from(detectSymbolsInText('Dinamik Kurum nasıl?', catalog)), ['FRESH']);
  assert.deepEqual(Array.from(detectSymbolsInText('Yeni şirket nasıl?', catalog)), []);
  assert.deepEqual(Array.from(detectSymbolsInText('NEW1X nedir?', catalog)), []);
});

test('A timeout while reading provider JSON remains a timeout, rather than an invalid-answer error', async () => {
  const { callOpenRouter } = load('src/lib/ai/openrouter.ts', {
    process: { env: { OPENROUTER_API_KEY: 'key' } }, AbortSignal,
    fetch: async () => ({ ok: true, json: async () => { const error = new Error('timed out'); error.name = 'TimeoutError'; throw error; } }),
  });
  await assert.rejects(callOpenRouter([{ role: 'user', content: 'test' }]), error => error.code === 'AI_TIMEOUT');
});

test('Hourly quota gracefully falls back to in-memory sliding window when RPC is missing from schema cache', async () => {
  const { getHourlyChatQuota, checkAndConsumeHourlyChatQuota, refundHourlyChatQuota } = load('src/lib/ai/hourlyQuota.ts', {
    require: name => name === '@/lib/supabase/server' ? ({
      createClient: async () => ({
        rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.ai_hourly_quota(p_mode) in the schema cache' } })
      })
    }) : {}
  });

  const inspect = await getHourlyChatQuota('user-fallback-test', false);
  assert.equal(inspect.limit, 5);
  assert.equal(inspect.used, 0);
  assert.equal(inspect.remaining, 5);
  assert.equal(inspect.allowed, true);

  const consumed = await checkAndConsumeHourlyChatQuota('req-1', 'user-fallback-test', false);
  assert.equal(consumed.limit, 5);
  assert.equal(consumed.used, 1);
  assert.equal(consumed.remaining, 4);
  assert.equal(consumed.allowed, true);

  const refunded = await refundHourlyChatQuota('req-1', 'user-fallback-test', false);
  assert.equal(refunded.used, 0);
  assert.equal(refunded.remaining, 5);
});

test('AI response parser rejects safety classifier outputs and model catalog filters out classifier models', async () => {
  const { readOpenRouterResponse } = load('src/lib/ai/openrouter.ts');
  const response = (content) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) });
  await assert.rejects(readOpenRouterResponse(response('User Safety: safe')), e => e.code === 'AI_INVALID_RESPONSE');

  const { parseModelCatalog } = load('src/lib/ai/modelCatalog.ts');
  const catalog = parseModelCatalog({
    data: [
      { id: 'minimax/minimax-m3.1-flash:free', name: 'MiniMax', architecture: { output_modalities: ['text'] }, pricing: { prompt: '0', completion: '0' } },
      { id: 'nvidia/nemotron-3.5-content-safety:free', name: 'Nemotron Content Safety', architecture: { output_modalities: ['text'] }, pricing: { prompt: '0', completion: '0' } },
    ]
  });
  assert.ok(catalog.some(m => m.id === 'minimax/minimax-m3.1-flash:free'));
  assert.ok(!catalog.some(m => m.id === 'nvidia/nemotron-3.5-content-safety:free'));
});

test('AI response parser detects openrouter_free_tier_daily rate limit and falls back to reasoning text when content is null', async () => {
  const { readOpenRouterResponse } = load('src/lib/ai/openrouter.ts');
  const rateLimitResponse = {
    ok: false,
    status: 429,
    json: async () => ({
      error: {
        message: 'Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day',
        code: 429,
        metadata: { limit_source: 'openrouter_free_tier_daily' }
      }
    })
  };
  await assert.rejects(readOpenRouterResponse(rateLimitResponse), e => e.code === 'AI_DAILY_FREE_LIMIT_REACHED');

  const reasoningOnlyResponse = {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        finish_reason: 'stop',
        message: { content: null, reasoning: 'Modelin analiz düşüncesi ve cevabı buradadır.' }
      }]
    })
  };
  const extracted = await readOpenRouterResponse(reasoningOnlyResponse);
  assert.equal(extracted, 'Modelin analiz düşüncesi ve cevabı buradadır.');
});



test('Market overview returns unavailable for configured fallback prices and keeps observed quote metadata', async () => {
  const observation = {
    source: 'Yahoo Finance',
    asOf: '2026-11-10T10:00:00.000Z',
    fetchedAt: '2026-11-10T10:01:00.000Z',
    changePercent: null,
  };
  const { GET } = load('src/app/api/markets/overview/route.ts', {
    require: name => {
      if (name === 'next/server') return { NextResponse: { json: body => body } };
      if (name === '@/lib/market/lastVerifiedStore') {
        return {
          recordVerifiedQuotes: async () => 0,
          getLastVerifiedQuotes: async () => new Map(),
        };
      }
      assert.equal(name, '@/lib/data/stocks');
      return {
        fetchAllAlternativeMarkets: async () => ({
          indices: [{ symbol: 'XU100', price: 12188.73 }, { symbol: 'SPX', price: 7000, observation }],
          commodity: [{ symbol: 'XAUTRYG', price: 6645 }],
          forex: [],
          crypto: [],
        }),
      };
    },
  });
  const result = await GET();
  assert.equal(result.success, true);
  const bist = result.data.find(item => item.symbol === 'XU100');
  const gold = result.data.find(item => item.symbol === 'GA');
  const spx = result.data.find(item => item.symbol === 'SPX');
  assert.equal(bist.value, null);
  assert.equal(bist.status, 'unavailable');
  assert.equal(gold.value, null);
  assert.equal(result.sections.indices.length, 1);
  assert.equal(result.sections.commodity.length, 0);
  assert.equal(spx.value, 7000);
  assert.equal(spx.unit, 'points');
  assert.equal(spx.change, null);
  assert.equal(spx.observation, observation);
});

test('Fund directory has no price and a verified one-lira database price remains usable', async () => {
  const directory = [
    { code: 'AAA', name: 'First Fund', founder: 'Manager', category: 'Değişken Fon' },
    { code: 'BBB', name: 'Second Fund', founder: 'Manager', category: 'Değişken Fon' },
  ];
  const rows = [
    { ...directory[0], price: '1.0', last_sync_at: null },
    { ...directory[1], price: '1.0', last_sync_at: '2026-11-10T10:00:00.000Z' },
  ];
  const { getAllFunds, getFundByCode, getFundsFromDatabase } = load('src/lib/data/funds.ts', {
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture' } },
    require: name => {
      if (name === './tefas_funds_directory.json') return { default: directory };
      if (name === '@/lib/utils/search') return {};
      assert.equal(name, '@supabase/supabase-js');
      return {
        createClient: () => ({
          from: () => ({ select: () => ({ neq: () => ({ order: async () => ({ data: rows, error: null }) }) }) }),
        }),
      };
    },
  });
  assert.equal(getAllFunds()[0].price, null);
  assert.equal(getFundByCode('AAA').price, null);
  const funds = await getFundsFromDatabase();
  assert.equal(funds[0].price, null);
  assert.equal(funds[1].price, 1);
});

test('TEFAS sync identifies a rejected source and keeps the available fund price', async () => {
  const { fetchLiveFundDetail } = await import('../scripts/sync-tefas-funds.mjs');
  const issues = [];
  const detail = await fetchLiveFundDetail('TI2', issue => issues.push(issue), async url => {
    if (url.endsWith('fonBilgiGetir')) return Response.json({ resultList: [{ sonFiyat: 4.25 }] });
    if (url.endsWith('fonProfilBilgiGetir')) return new Response('blocked', { status: 403 });
    return new Response('<html>gateway</html>');
  });

  assert.equal(detail.price, 4.25);
  assert.equal(detail.nav_date, null);
  assert.equal(detail.risk_value, undefined);
  assert.equal(detail.monthly_return, undefined);
  assert.ok(issues.some(issue => issue.code === 'TI2' && issue.endpoint === 'fonProfilBilgiGetir' && issue.httpStatus === 403));
  assert.ok(issues.some(issue => issue.endpoint === 'fonFiyatBilgiGetir' && issue.reason === 'invalid_json'));
});

test('TEFAS sync identifies missing verified prices and never emits a placeholder record', async () => {
  const { fetchLiveFundDetail } = await import('../scripts/sync-tefas-funds.mjs');
  const issues = [];
  const detail = await fetchLiveFundDetail('TI2', issue => issues.push(issue), async url => {
    if (url.endsWith('fonBilgiGetir')) return Response.json({ resultList: [{ sonFiyat: 0 }] });
    if (url.endsWith('fonProfilBilgiGetir')) throw new DOMException('Deadline', 'TimeoutError');
    return Response.json({ resultList: [{ fiyat: 'invalid' }] });
  });

  assert.equal(detail, null);
  assert.ok(issues.some(issue => issue.endpoint === 'fonProfilBilgiGetir' && issue.reason === 'timeout'));
  assert.ok(issues.some(issue => issue.stage === 'price' && issue.reason === 'missing_positive_price'));
});

test('TEFAS sync keeps valuation date tied to the latest matching history price', async () => {
  const { fetchLiveFundDetail } = await import('../scripts/sync-tefas-funds.mjs');
  const rows = [
    { tarih: '2026-11-10', fiyat: '0.117476' },
    { tarih: '2026-11-09', fiyat: 0.114111 },
    { tarih: '2026-11-31', fiyat: 0.114111 },
    { tarih: '2026-11-11', fiyat: 'Infinity' },
  ];
  const fetchDetail = sonFiyat => fetchLiveFundDetail('TI2', () => {}, async url => {
    if (url.endsWith('fonBilgiGetir')) return Response.json({ resultList: [{ sonFiyat }] });
    if (url.endsWith('fonFiyatBilgiGetir')) return Response.json({ resultList: rows });
    return Response.json({ resultList: [] });
  });

  const matching = await fetchDetail(0.117476);
  assert.equal(matching.price, 0.117476);
  assert.equal(matching.nav_date, '2026-11-10');
  assert.ok(Number.isFinite(Date.parse(matching.last_sync_at)));

  const newerPriceWithoutDate = await fetchDetail(0.114111);
  assert.equal(newerPriceWithoutDate.price, 0.114111);
  assert.equal(newerPriceWithoutDate.nav_date, null);

  const fallback = await fetchDetail(undefined);
  assert.equal(fallback.price, 0.117476);
  assert.equal(fallback.nav_date, '2026-11-10');
});

test('TEFAS cron archives only a source-dated snapshot and keeps its retrieval timestamp', async () => {
  const lastSyncAt = '2026-11-11T00:15:00Z';
  const details = {
    TI2: { code: 'TI2', price: 0.117476, navDate: '2026-11-10', lastSyncAt },
    AAL: { code: 'AAL', price: 3.777852, navDate: null, lastSyncAt },
  };
  const writes = [];
  const { syncTefasFundsToDatabase } = load('src/lib/cron/syncTefasFunds.ts', {
    require: name => ({
      '@/lib/supabase/admin': { createAdminClient: () => ({
        from: table => ({ upsert: async (data, options) => {
          writes.push({ table, data, options });
          return { error: null };
        } }),
      }) },
      '@/lib/api/tefas': { fetchTefasLiveDetail: async code => details[code] },
      '@/lib/data/tefas_funds_directory.json': { default: Object.keys(details).map(code => ({ code })) },
    })[name],
  });

  assert.equal((await syncTefasFundsToDatabase()).successCount, 2);
  const snapshot = writes.find(write => write.table === 'funds' && write.data.code === 'TI2');
  assert.equal(snapshot.data.nav_date, '2026-11-10');
  assert.equal(snapshot.data.last_sync_at, lastSyncAt);
  assert.equal(writes.find(write => write.data.code === 'AAL').data.nav_date, null);
  const history = writes.filter(write => write.table === 'fund_daily_history');
  assert.equal(history.length, 1);
  assert.equal(history[0].data.fund_code, 'TI2');
  assert.equal(history[0].data.price_date, '2026-11-10');
  assert.equal(history[0].options.onConflict, 'fund_code,price_date');
});

test('TEFAS sync write mode reports missing writer configuration instead of using an anonymous key', () => {
  const { spawnSync } = require('node:child_process');
  const cwd = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'stockmind-tefas-test-'));
  try {
    const script = path.resolve(__dirname, '../scripts/sync-tefas-funds.mjs');
    const summaryPath = path.join(cwd, 'summary.md');
    const result = spawnSync(process.execPath, [script, '--code=TI2'], {
      cwd,
      env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anonymous-fixture', GITHUB_STEP_SUMMARY: summaryPath },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stderr), {
      event: 'tefas_sync_configuration_error',
      missing: ['SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY'],
    });
    assert.equal(result.stdout, '');
    assert.match(fs.readFileSync(summaryPath, 'utf8'), /Kapsam hesaplanamadı/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('TEFAS resume uses the Istanbul date and rejects invalid or future dates', async () => {
  const { getResumeCutoff } = await import('../scripts/sync-tefas-funds.mjs');
  const now = new Date('2026-11-10T21:01:00Z');
  assert.equal(getResumeCutoff(undefined, now), '2026-11-10T21:00:00.000Z');
  assert.equal(getResumeCutoff('2026-11-10', now), '2026-11-09T21:00:00.000Z');
  assert.equal(getResumeCutoff('2026-02-30', now), null);
  assert.equal(getResumeCutoff('2026-11-12', now), null);
});

test('TEFAS resume reports coverage from stored quotes and retries only missing or failed records', async () => {
  const { createClient } = require('@supabase/supabase-js');
  const { syncFunds } = await import('../scripts/sync-tefas-funds.mjs');
  const resumeSince = '2024-11-07T21:00:00.000Z';
  const now = new Date('2024-11-09T12:00:00Z');
  const selected = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG'].map(code => ({ code }));
  const records = new Map(['AAA', 'BBB', 'CCC', 'DDD', 'EEE'].map(code => [code, {
    code,
    price: code === 'DDD' ? 0 : 4.25,
    nav_date: code === 'CCC' ? null : ['BBB', 'EEE'].includes(code) ? '2024-11-07' : '2024-11-08',
    last_sync_at: code === 'EEE' ? '2024-11-07T00:00:00+03:00' : '2024-11-08T00:00:00+03:00',
  }]));
  let rejectWrite = true;
  let rejectCheckpoint = false;
  const checkpointCursors = [];
  const requested = [];
  const writeAttempts = [];
  const report = () => {};
  const supabase = createClient('https://example.supabase.co', 'test-key', {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      assert.equal(url.pathname, '/rest/v1/funds');
      if (init.method === 'POST') {
        assert.equal(url.searchParams.get('on_conflict'), 'code');
        const record = JSON.parse(init.body);
        writeAttempts.push(record.code);
        if (record.code === 'EEE' && rejectWrite) return Response.json({ code: '57014' }, { status: 500 });
        records.set(record.code, record);
        return new Response(null, { status: 201 });
      }
      if (rejectCheckpoint) return Response.json({ code: '42501' }, { status: 403 });
      assert.equal(url.searchParams.get('select'), 'code,price,nav_date,last_sync_at');
      assert.equal(url.searchParams.get('price'), 'gt.0');
      assert.equal(url.searchParams.get('order'), 'code.asc');
      const cursor = url.searchParams.get('code')?.slice(3) ?? '';
      checkpointCursors.push(cursor);
      const rows = [...records.values()]
        .filter(row => row.price > 0 && row.code > cursor)
        .sort((a, b) => a.code.localeCompare(b.code));
      // Simulate a server page cap below the requested limit.
      return Response.json(rows.slice(0, 2));
    } },
  });
  const fetcher = async (url, init) => {
    if (url.endsWith('fonBilgiGetir')) {
      const code = JSON.parse(init.body).fonKodu;
      requested.push(code);
      if (code === 'GGG' && rejectWrite) return Response.json({ resultList: [] });
      return Response.json({ resultList: [{ sonFiyat: 4.25 }] });
    }
    return Response.json({ resultList: [{ fiyat: 4.25, tarih: '2024-11-08', riskDegeri: 3 }] });
  };
  const run = () => syncFunds({ selected, supabase, resumeSince, fetcher, report, now });

  const first = await run();
  assert.deepEqual(checkpointCursors, ['', 'BBB', 'EEE']);
  assert.deepEqual(requested, ['DDD', 'EEE', 'FFF', 'GGG']);
  assert.equal(first.skipped, 3);
  assert.equal(first.succeeded, 2);
  assert.equal(first.databaseFailures, 1);
  assert.equal(first.failed, 2);
  assert.equal(first.remaining, 2);
  assert.deepEqual(first.coverage, { referenceDate: '2024-11-08', current: 3, stale: 2, missing: 1, unverified: 1 });

  rejectWrite = false;
  requested.length = 0;
  const second = await run();
  assert.deepEqual(requested, ['EEE', 'GGG']);
  assert.equal(second.skipped, 5);
  assert.equal(second.remaining, 0);
  assert.equal(records.size, 7);
  assert.deepEqual(second.coverage, { referenceDate: '2024-11-08', current: 5, stale: 1, missing: 0, unverified: 1 });

  requested.length = 0;
  const complete = await run();
  assert.equal(complete.status, 'ok');
  assert.equal(complete.skipped, 7);
  assert.deepEqual(complete.coverage, second.coverage);
  assert.deepEqual(requested, []);

  rejectCheckpoint = true;
  const failed = await run();
  assert.equal(failed.status, 'failed');
  assert.equal(failed.issues['[checkpoint] funds.select read_failed'], 1);
  assert.equal(failed.coverage, null);
  assert.deepEqual(requested, []);
  assert.deepEqual(writeAttempts.sort(), ['DDD', 'EEE', 'EEE', 'FFF', 'GGG']);
});

function createAliasedLoader() {
  const cache = new Map();
  return function loadWithAlias(file, extraRequire = {}, extraGlobals = {}) {
    const resolved = path.resolve(file);
    if (cache.has(resolved)) return cache.get(resolved);
    const module = { exports: {} };
    cache.set(resolved, module.exports);
    const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const loadJsonModule = (jsonPath) => {
      const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Object.prototype.hasOwnProperty.call(parsed, 'default')) {
        Object.defineProperty(parsed, 'default', { value: parsed, enumerable: false });
      }
      return parsed;
    };
    const customRequire = (name) => {
      if (Object.prototype.hasOwnProperty.call(extraRequire, name)) return extraRequire[name];
      if (name.startsWith('@/')) {
        const subPath = name.slice(2);
        if (subPath.endsWith('.json')) {
          return loadJsonModule(path.resolve('src', subPath));
        }
        const mjsPath = path.resolve('src', subPath);
        if (subPath.endsWith('.mjs') && fs.existsSync(mjsPath)) {
          return require(mjsPath);
        }
        const directTs = path.resolve('src', `${subPath}.ts`);
        const indexTs = path.resolve('src', subPath, 'index.ts');
        return loadWithAlias(fs.existsSync(directTs) ? directTs : indexTs, extraRequire, extraGlobals);
      }
      if (name.endsWith('.json')) {
        return loadJsonModule(path.resolve(path.dirname(resolved), name));
      }
      if (name.startsWith('.')) {
        const directRel = path.resolve(path.dirname(resolved), `${name}.ts`);
        const indexRel = path.resolve(path.dirname(resolved), name, 'index.ts');
        return loadWithAlias(fs.existsSync(directRel) ? directRel : indexRel, extraRequire, extraGlobals);
      }
      return require(name);
    };
    vm.runInNewContext(source, {
      module,
      exports: module.exports,
      Date,
      Map,
      Set,
      Symbol,
      URL,
      Response,
      AbortSignal,
      Promise,
      console,
      process: { env: {} },
      require: customRequire,
      ...extraGlobals,
    });
    cache.set(resolved, module.exports);
    return module.exports;
  };
}

test('VER-02: valid stock, index, commodity, forex, crypto, fund, and history APIs include observation metadata and reject fake fallbacks', async () => {
  const loadWithAlias = createAliasedLoader();

  // 1. TradingView BIST & US list + specific symbols (Index, TR Gold, Commodity, Forex, Crypto, Scanner null rejection)
  const yahooTime = 1762858800; // 2025-11-11T11:00:00.000Z
  const mockFetch = async (url, init) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(init.body) : null;
    if (u.includes('scanner.tradingview.com/turkey/scan')) {
      const target = body?.filter?.find((f) => f.left === 'name')?.right;
      if (target === 'BROKEN') {
        return { ok: true, json: async () => ({ data: [{ d: ['BROKEN', null, 1.5, 100, 1000, 'Broken', null, null, null, null, null] }] }) };
      }
      if (target === 'ISCTR') {
        return { ok: true, json: async () => ({ data: [{ d: ['ISCTR', 14.2, 2.5, 500000, 1000000, 'Turkiye Is Bankasi', 'Finance', 16, 10, 5.2, 2.1] }] }) };
      }
      if (target) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return { ok: true, json: async () => ({ data: [{ d: ['THYAO', 310.5, 1.25, 1000000, 400000000, 'Turk Hava Yollari', 'Transportation', 340, 220, 6.5, 0] }] }) };
    }
    if (u.includes('scanner.tradingview.com/america/scan')) {
      const target = body?.filter?.find((f) => f.left === 'name')?.right;
      if (target === 'BROKENUS') {
        return { ok: true, json: async () => ({ data: [{ d: ['BROKENUS', 0, 1.0, 100, 1000, 'Broken US', null, null, null, null, null] }] }) };
      }
      if (target) {
        return { ok: true, json: async () => ({ data: [] }) };
      }
      return { ok: true, json: async () => ({ data: [{ d: ['AAPL', 225.4, -0.5, 2000000, 3000000000, 'Apple Inc.', 'Electronic Technology', 240, 170, 30.2, 0.45, 'NASDAQ'] }] }) };
    }
    if (u.includes('scanner.tradingview.com/forex/scan')) {
      const target = body?.filter?.[0]?.right;
      if (target === 'USDTRY') {
        return { ok: true, json: async () => ({ data: [{ d: ['USDTRY', 34.5, 0.2, 'USD / TRY', 35, 28] }] }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    }
    if (u.includes('scanner.tradingview.com/cfd/scan')) {
      const target = body?.filter?.[0]?.right;
      if (target === 'XAUUSD') {
        return { ok: true, json: async () => ({ data: [{ d: ['XAUUSD', 2650, 0.8, 'Gold Spot'] }] }) };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    }
    if (u.includes('scanner.tradingview.com/crypto/scan')) {
      return { ok: true, json: async () => ({ data: [{ d: ['BTCUSD', 89500, 3.2, 'Bitcoin', 90000, 35000] }] }) };
    }
    if (u.includes('query1.finance.yahoo.com/v8/finance/chart/')) {
      return {
        ok: true,
        json: async () => ({
          chart: {
            result: [{
              meta: {
                regularMarketPrice: 9250.4,
                chartPreviousClose: 9100,
                regularMarketChangePercent: 1.65,
                regularMarketTime: yahooTime,
              },
              timestamp: [yahooTime - 86400, yahooTime],
              indicators: {
                quote: [{
                  open: [9100, 9150],
                  high: [9200, 9280],
                  low: [9050, 9120],
                  close: [9120, 9250.4],
                  volume: [1000, 1200],
                }],
              },
            }],
          },
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const stocksMod = loadWithAlias(
    'src/lib/data/stocks.ts',
    {
      'next/cache': { unstable_cache: (fn) => fn },
      '@/lib/constants/stocks': { POPULAR_STOCKS: [] },
      '@/lib/api/tefas': {
        fetchTefasLiveDetail: async (code) =>
          code === 'MAC'
            ? {
                code: 'MAC',
                name: 'Marmara Capital Hisse Senedi Fonu',
                category: 'Hisse Senedi Fonu',
                founder: 'Marmara Portföy',
                price: 0.4512,
                navDate: '2026-11-10',
                dailyReturn: 1.4,
                investorCount: 12000,
                totalValue: 5000000000,
                lastSyncAt: '2026-11-11T09:00:00.000Z',
                observation: {
                  source: 'TEFAS',
                  asOf: '2026-11-10',
                  fetchedAt: '2026-11-11T09:00:00.000Z',
                  changePercent: 1.4,
                },
              }
            : null,
      },
    },
    { fetch: mockFetch }
  );

  const list = await stocksMod.fetchAllTradingViewStocks();
  assert.equal(list.bist[0].observation.source, 'TradingView');
  assert.equal(list.bist[0].observation.changePercent, 1.25);
  assert.ok(Date.parse(list.bist[0].observation.fetchedAt) > 0);
  assert.equal(list.us[0].observation.source, 'TradingView');

  const indexQuote = await stocksMod.fetchSpecificSymbolLive('XU100');
  assert.equal(indexQuote.observation.source, 'Yahoo Finance');
  assert.equal(indexQuote.observation.asOf, new Date(yahooTime * 1000).toISOString());

  const goldQuote = await stocksMod.fetchSpecificSymbolLive('XAUTRYG');
  assert.equal(goldQuote.observation.source, 'TradingView');
  assert.ok(goldQuote.price > 0);

  const fxQuote = await stocksMod.fetchSpecificSymbolLive('USDTRY');
  assert.equal(fxQuote.observation.source, 'TradingView');
  assert.equal(fxQuote.observation.changePercent, 0.2);

  const btcQuote = await stocksMod.fetchSpecificSymbolLive('BTCUSD');
  assert.equal(btcQuote.observation.source, 'TradingView');

  const tefasQuote = await stocksMod.fetchSpecificSymbolLive('MAC');
  assert.equal(tefasQuote.observation.source, 'TEFAS');
  assert.equal(tefasQuote.observation.asOf, '2026-11-10');
  assert.equal(tefasQuote.observation.fetchedAt, '2026-11-11T09:00:00.000Z');

  assert.equal(await stocksMod.fetchSpecificSymbolLive('BROKEN'), null);
  assert.equal(await stocksMod.fetchSpecificSymbolLive('BROKENUS'), null);

  // 2. DB cached fund observation preserves stored last_sync_at & nav_date
  const dbRowsResult = {
    data: [
      {
        code: 'MAC',
        name: 'Marmara Capital',
        category: 'Hisse Senedi Fonu',
        founder: 'Marmara',
        price: 0.4512,
        daily_return: 1.4,
        nav_date: '2026-11-10',
        last_sync_at: '2026-11-11T09:00:00.000Z',
      },
      {
        code: 'NOQ',
        name: 'No Price Fund',
        category: 'Para Piyasası Fonu',
        founder: 'Test',
        price: 0,
        daily_return: 0,
        nav_date: null,
        last_sync_at: null,
      },
    ],
    error: null,
  };
  const supabaseQueryChain = {
    select: () => supabaseQueryChain,
    neq: () => supabaseQueryChain,
    eq: () => supabaseQueryChain,
    order: () => supabaseQueryChain,
    range: () => supabaseQueryChain,
    then: (resolve, reject) => Promise.resolve(dbRowsResult).then(resolve, reject),
  };
  const fundsModWithEnv = loadWithAlias(
    'src/lib/data/funds.ts',
    {
      '@supabase/supabase-js': {
        createClient: () => ({
          from: () => supabaseQueryChain,
        }),
      },
    },
    { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' } } }
  );
  const dbFunds = await fundsModWithEnv.getFundsFromDatabase();
  assert.deepEqual({ ...dbFunds[0].observation }, {
    source: 'TEFAS',
    asOf: '2026-11-10',
    fetchedAt: '2026-11-11T09:00:00.000Z',
    changePercent: 1.4,
  });
  assert.equal(dbFunds[1].price, null);
  assert.equal(dbFunds[1].observation, null);

  // 3. History & Indicators API routes attach observation metadata
  const mockCandles = [
    { time: '2026-11-10', open: 300, high: 312, low: 299, close: 310, volume: 1000 },
    { time: '2026-11-11', open: 310, high: 315, low: 308, close: 314, volume: 1200 },
  ];
  const nextServerStub = { NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) } };
  const routeStocksStub = {
    getStockBySymbolLive: async () => ({
      price: 314,
      observation: { source: 'TradingView', asOf: null, fetchedAt: '2026-11-11T10:00:00.000Z', changePercent: 1.29 },
    }),
    fetchRealHistoricalCandles: async () => mockCandles,
    getStockTechnicalAnalysis: () => ({ symbol: 'THYAO', rsi14: 58, trend: 'BULLISH' }),
  };

  const historyRoute = loadWithAlias(
    'src/app/api/stocks/[symbol]/history/route.ts',
    { 'next/server': nextServerStub, '@/lib/data/stocks': routeStocksStub }
  );
  const historyRes = await historyRoute.GET({ url: 'https://app.local/api/stocks/THYAO/history?timeframe=1M' }, { params: Promise.resolve({ symbol: 'THYAO' }) });
  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body.observation.source, 'Yahoo Finance');
  assert.equal(historyRes.body.observation.asOf, '2026-11-11');
  assert.equal(historyRes.body.quoteObservation.source, 'TradingView');

  const indicatorsRoute = loadWithAlias(
    'src/app/api/stocks/[symbol]/indicators/route.ts',
    { 'next/server': nextServerStub, '@/lib/data/stocks': routeStocksStub }
  );
  const indicatorsRes = await indicatorsRoute.GET({ url: 'https://app.local/api/stocks/THYAO/indicators' }, { params: Promise.resolve({ symbol: 'THYAO' }) });
  assert.equal(indicatorsRes.status, 200);
  assert.equal(indicatorsRes.body.observation.source, 'Yahoo Finance');
  assert.equal(indicatorsRes.body.observation.asOf, '2026-11-11');
  assert.equal(indicatorsRes.body.quoteObservation.source, 'TradingView');
});

test('VER-03: classifyPriceStatus consistently separates current, delayed, last-close, stale, and missing quotes', () => {
  const {
    classifyPriceStatus,
    classifyStockPriceStatus,
    classifyFundPriceStatus,
  } = load('src/lib/market/priceStatus.ts');

  // Wednesday 2026-11-11 12:00:00+03:00 (09:00:00Z) — BIST session open (10:00-18:10 TR)
  const bistOpenNow = new Date('2026-11-11T09:00:00.000Z');
  // Saturday 2026-11-14 12:00:00+03:00 (09:00:00Z) — BIST closed
  const weekendNow = new Date('2026-11-14T09:00:00.000Z');

  // 1. Güncel (fresh open-session observation <= 5m)
  const currentRes = classifyPriceStatus({
    price: 310.5,
    exchange: 'BIST',
    now: bistOpenNow,
    observation: {
      source: 'TradingView',
      asOf: '2026-11-11T08:58:00.000Z',
      fetchedAt: '2026-11-11T08:59:30.000Z',
      changePercent: 1.2,
    },
  });
  assert.equal(currentRes.status, 'current');
  assert.equal(currentRes.label, 'Güncel');

  // 2. Gecikmeli (open-session observation 15m old)
  const delayedRes = classifyPriceStatus({
    price: 310.5,
    exchange: 'BIST',
    now: bistOpenNow,
    observation: {
      source: 'Yahoo Finance',
      asOf: '2026-11-11T08:45:00.000Z',
      fetchedAt: '2026-11-11T08:59:50.000Z',
      changePercent: 1.2,
    },
  });
  assert.equal(delayedRes.status, 'delayed');
  assert.equal(delayedRes.label, 'Gecikmeli');

  // 3. Son kapanış (closed BIST weekend session with Friday close & freshly fetched)
  const lastCloseRes = classifyPriceStatus({
    price: 310.5,
    exchange: 'BIST',
    now: weekendNow,
    observation: {
      source: 'TradingView',
      asOf: '2026-11-13T15:05:00.000Z',
      fetchedAt: '2026-11-14T08:50:00.000Z',
      changePercent: 0.4,
    },
  });
  assert.equal(lastCloseRes.status, 'last-close');
  assert.equal(lastCloseRes.label, 'Son kapanış');

  // 4. Eski (cached fallback or > 6h open session / > 4 days TEFAS)
  const lastKnownRes = classifyPriceStatus({
    price: 310.5,
    exchange: 'BIST',
    isLastKnown: true,
    now: bistOpenNow,
    observation: {
      source: 'TradingView',
      asOf: '2026-11-11T08:58:00.000Z',
      fetchedAt: '2026-11-11T08:58:00.000Z',
      changePercent: 1.2,
    },
  });
  assert.equal(lastKnownRes.status, 'stale');
  assert.equal(lastKnownRes.label, 'Eski');

  const staleOpenRes = classifyPriceStatus({
    price: 90000,
    exchange: 'CRYPTO',
    now: bistOpenNow,
    observation: {
      source: 'TradingView / Binance',
      asOf: '2026-11-11T01:00:00.000Z',
      fetchedAt: '2026-11-11T01:00:00.000Z',
      changePercent: 0.5,
    },
  });
  assert.equal(staleOpenRes.status, 'stale');
  assert.equal(staleOpenRes.label, 'Eski');

  // 5. Eksik (missing price or missing observation)
  const missingPriceRes = classifyStockPriceStatus({ price: null, exchange: 'BIST', observation: null }, bistOpenNow);
  assert.equal(missingPriceRes.status, 'missing');
  assert.equal(missingPriceRes.label, 'Eksik');

  const unverifiedPriceRes = classifyStockPriceStatus({ price: 100, exchange: 'BIST' }, bistOpenNow);
  assert.equal(unverifiedPriceRes.status, 'missing');
  assert.equal(unverifiedPriceRes.label, 'Eksik');

  // TEFAS fund valuation day states
  const tefasToday = classifyFundPriceStatus(
    { price: 0.4512, navDate: '2026-11-11', lastSyncAt: '2026-11-11T08:30:00.000Z', dailyReturn: 1.1 },
    bistOpenNow
  );
  assert.equal(tefasToday.status, 'current');
  assert.equal(tefasToday.label, 'Güncel');

  const tefasPrevDay = classifyFundPriceStatus(
    { price: 0.4512, navDate: '2026-11-10', lastSyncAt: '2026-11-11T08:30:00.000Z', dailyReturn: 1.1 },
    bistOpenNow
  );
  assert.equal(tefasPrevDay.status, 'last-close');
  assert.equal(tefasPrevDay.label, 'Son kapanış');

  const tefasOld = classifyFundPriceStatus(
    { price: 0.4512, navDate: '2026-11-01', lastSyncAt: '2026-11-11T08:30:00.000Z', dailyReturn: 1.1 },
    bistOpenNow
  );
  assert.equal(tefasOld.status, 'stale');
  assert.equal(tefasOld.label, 'Eski');

  const tefasMissing = classifyFundPriceStatus({ price: null, navDate: null }, bistOpenNow);
  assert.equal(tefasMissing.status, 'missing');
  assert.equal(tefasMissing.label, 'Eksik');
});

test('VER-04: last verified quotes survive provider outages with original timestamps and stay empty when never observed', async () => {
  const loadWithAlias = createAliasedLoader();
  const dbRows = new Map();
  const supabaseStub = {
    createClient: () => ({
      from: () => ({
        upsert: async (rows) => {
          for (const r of rows) dbRows.set(r.symbol, r);
          return { error: null };
        },
        select: () => ({
          in: async (_col, symbols) => ({
            data: symbols.filter((s) => dbRows.has(s)).map((s) => ({ symbol: s, quote: dbRows.get(s).quote })),
            error: null,
          }),
        }),
      }),
    }),
  };

  const envGlobals = {
    process: {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
      },
    },
  };

  let providerDown = false;
  let liveMarkets = {
    commodity: [
      {
        symbol: 'XAUTRYG',
        name: 'Gram Altın',
        exchange: 'COMMODITY',
        currency: 'TRY',
        sector: 'Kıymetli Madenler',
        basePrice: 3100,
        price: 3125.4,
        observation: {
          source: 'TradingView',
          asOf: null,
          fetchedAt: '2026-11-11T09:30:00.000Z',
          changePercent: 0.85,
        },
      },
    ],
    forex: [],
    crypto: [],
    indices: [],
  };

  const nextServerStub = {
    NextResponse: {
      json: (body, init) => ({ body, status: init?.status || 200 }),
    },
  };

  const route = loadWithAlias(
    'src/app/api/markets/overview/route.ts',
    {
      'next/server': nextServerStub,
      '@supabase/supabase-js': supabaseStub,
      '@/lib/data/stocks': {
        fetchAllAlternativeMarkets: async () => {
          if (providerDown) throw new Error('Provider outage');
          return liveMarkets;
        },
      },
    },
    envGlobals
  );

  // 1. Live request stores XAUTRYG cleanly, leaves unobserved symbols (e.g. XU100) unavailable
  const firstRes = await route.GET();
  assert.equal(firstRes.status, 200);
  const goldFirst = firstRes.body.data.find((d) => d.symbol === 'GA');
  const xuFirst = firstRes.body.data.find((d) => d.symbol === 'XU100');
  assert.equal(goldFirst.status, 'available');
  assert.equal(goldFirst.value, 3125.4);
  assert.equal(goldFirst.observation.fetchedAt, '2026-11-11T09:30:00.000Z');
  assert.equal(xuFirst.status, 'unavailable');
  assert.equal(xuFirst.value, null);
  assert.equal(xuFirst.observation, null);
  assert.ok(dbRows.has('XAUTRYG'));

  // 2. Simulate complete cold-start memory wipe + provider outage: DB still recovers XAUTRYG with original timestamp!
  const storeMod = loadWithAlias(
    'src/lib/market/lastVerifiedStore.ts',
    { '@supabase/supabase-js': supabaseStub },
    envGlobals
  );
  storeMod.__clearLastVerifiedQuotesForTests();
  providerDown = true;

  const outageRes = await route.GET();
  assert.equal(outageRes.status, 200);
  const goldOutage = outageRes.body.data.find((d) => d.symbol === 'GA');
  const xuOutage = outageRes.body.data.find((d) => d.symbol === 'XU100');
  assert.equal(goldOutage.status, 'last-known');
  assert.equal(goldOutage.value, 3125.4);
  assert.equal(goldOutage.observation.fetchedAt, '2026-11-11T09:30:00.000Z');
  assert.equal(goldOutage.observation.source, 'TradingView');
  // Unseen symbol remains unavailable (never fabricated)
  assert.equal(xuOutage.status, 'unavailable');
  assert.equal(xuOutage.value, null);
  assert.equal(xuOutage.observation, null);

  // 3. Classify recovered StockMarketInfo as Eski (stale) while preserving timestamp
  const { classifyStockPriceStatus } = load('src/lib/market/priceStatus.ts');
  const recoveredStock = await storeMod.getLastVerifiedQuote('XAUTRYG');
  assert.equal(recoveredStock.isLastKnown, true);
  assert.equal(classifyStockPriceStatus(recoveredStock).label, 'Eski');
});

test('VER-06: eksik, kaynaksız veya eski fiyatla alarm tetiklenmez; ertelenir ve nedeni kaydedilir', () => {
  const loadWithAlias = createAliasedLoader();
  const priceStatusMod = load('src/lib/market/priceStatus.ts');
  const alertFreshnessMod = loadWithAlias('src/lib/market/alertFreshness.ts', {
    '@/lib/market/priceStatus': priceStatusMod,
  });
  const watchlistStoreMod = loadWithAlias('src/store/useWatchlistStore.ts', {
    '@/lib/market/alertFreshness': alertFreshnessMod,
    zustand: { create: (fn) => () => fn(() => {}, () => ({ items: [] })) },
  });

  const {
    evaluateAlertPriceFreshness,
    recordDeferredAlert,
    loadDeferredAlerts,
    clearDeferredAlert,
  } = alertFreshnessMod;
  const { isPriceAlertTriggered } = watchlistStoreMod;

  const now = new Date('2026-11-11T10:15:00Z'); // BIST open

  // 1. Missing quote -> ineligible
  const missingRes = evaluateAlertPriceFreshness(null, now);
  assert.equal(missingRes.eligible, false);
  assert.equal(missingRes.reason, 'missing-quote');

  // 2. Placeholder / missing source -> ineligible
  const noSourceRes = evaluateAlertPriceFreshness(
    {
      price: 350,
      observation: { source: 'fallback', asOf: '2026-11-11T10:14:00Z', fetchedAt: '2026-11-11T10:14:00Z' },
    },
    now
  );
  assert.equal(noSourceRes.eligible, false);
  assert.equal(noSourceRes.reason, 'missing-source');

  // 3. Missing timestamp -> ineligible
  const noTsRes = evaluateAlertPriceFreshness(
    { price: 350, observation: { source: 'TradingView', asOf: null, fetchedAt: null } },
    now
  );
  assert.equal(noTsRes.eligible, false);
  assert.equal(noTsRes.reason, 'missing-timestamp');

  // 4. Last-known fallback -> ineligible
  const lastKnownRes = evaluateAlertPriceFreshness(
    {
      price: 350,
      isLastKnown: true,
      exchange: 'BIST',
      observation: { source: 'TradingView', asOf: '2026-11-11T10:14:00Z', fetchedAt: '2026-11-11T10:14:00Z' },
    },
    now
  );
  assert.equal(lastKnownRes.eligible, false);
  assert.equal(lastKnownRes.reason, 'last-known-fallback');

  // 5. Stale quote (fetched > 24h ago during open market / stale threshold) -> ineligible
  const staleRes = evaluateAlertPriceFreshness(
    {
      price: 350,
      exchange: 'BIST',
      observation: { source: 'TradingView', asOf: '2026-11-08T10:00:00Z', fetchedAt: '2026-11-08T10:00:00Z' },
    },
    now
  );
  assert.equal(staleRes.eligible, false);
  assert.equal(staleRes.reason, 'stale-price');

  // 6. Alert threshold crossed with stale quote is deferred instead of triggered
  const item = {
    id: 'w-ver06',
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    assetType: 'stock',
    price: 300,
    changePercent: 0,
    alertType: 'price',
    targetPrice: 320,
    alertBasePrice: 300,
  };
  const deferredCheck = isPriceAlertTriggered(
    item,
    350,
    {
      price: 350,
      isLastKnown: true,
      exchange: 'BIST',
      observation: { source: 'TradingView', asOf: '2026-11-11T10:14:00Z', fetchedAt: '2026-11-11T10:14:00Z' },
    },
    now
  );
  assert.equal(deferredCheck.triggered, false);
  assert.equal(deferredCheck.deferred, true);
  assert.equal(deferredCheck.deferralReason, 'last-known-fallback');
  assert.ok(deferredCheck.deferralDescription.includes('ertelendi'));

  // 7. Record and clear deferral reason in storage
  const backing = new Map();
  const memStorage = {
    getItem: (k) => backing.get(k) ?? null,
    setItem: (k, v) => backing.set(k, v),
    removeItem: (k) => backing.delete(k),
  };
  recordDeferredAlert(
    {
      symbol: 'THYAO',
      assetType: 'stock',
      alertType: 'price',
      targetPrice: 320,
      reason: deferredCheck.deferralReason,
      description: deferredCheck.deferralDescription,
      status: 'stale',
      source: 'TradingView',
      observedAt: '2026-11-11T10:14:00Z',
      deferredAt: now.toISOString(),
    },
    memStorage
  );
  const stored = loadDeferredAlerts(memStorage);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].symbol, 'THYAO');
  assert.equal(stored[0].reason, 'last-known-fallback');

  // 8. Fresh live quote clears deferral and triggers normally
  const freshQuote = {
    price: 350,
    exchange: 'BIST',
    observation: { source: 'TradingView', asOf: '2026-11-11T10:14:00Z', fetchedAt: '2026-11-11T10:14:00Z' },
  };
  assert.equal(evaluateAlertPriceFreshness(freshQuote, now).eligible, true);
  clearDeferredAlert('THYAO', 'stock', memStorage);
  assert.equal(loadDeferredAlerts(memStorage).length, 0);

  const triggeredCheck = isPriceAlertTriggered(item, 350, freshQuote, now);
  assert.equal(triggeredCheck.triggered, true);
  assert.match(triggeredCheck.title, /THYAO/);

  // 9. Fresh TEFAS fund quote passes as well
  const fundFresh = evaluateAlertPriceFreshness(
    {
      price: 12.5,
      assetType: 'fund',
      navDate: '2026-11-11',
      lastSyncAt: '2026-11-11T08:00:00Z',
    },
    now
  );
  assert.equal(fundFresh.eligible, true);
  assert.equal(fundFresh.source, 'TEFAS');
});

test('VER-07: eksik hacim, yüksek/düşük ve kapanış alanları boş kalır; teknik analizde varsayılan kullanılmaz', async () => {
  const loadWithAlias = createAliasedLoader();
  const indicatorsMod = load('src/lib/indicators/index.ts');

  const stocksMod = loadWithAlias(
    'src/lib/data/stocks.ts',
    {
      '@/lib/indicators': indicatorsMod,
      '@/lib/data/tefas_funds_directory.json': [],
      '@/lib/api/tefas': { fetchTefasLiveDetail: async () => null },
      '@/lib/utils/search': { calculateFuzzyScore: () => 0, normalizeText: (s) => s, POPULAR_ALIASES: {} },
      '@/lib/utils/symbol': { cleanSymbol: (s) => ({ symbol: String(s).toUpperCase(), assetType: 'stock' }) },
      '@/lib/constants/stocks': { POPULAR_STOCKS: [] },
      '@/lib/market/lastVerifiedStore': {
        getLastVerifiedQuote: async () => null,
        isVerifiedMarketQuote: () => true,
        recordVerifiedQuotes: async () => {},
      },
    },
    {
      fetch: async (url) => {
        const strUrl = String(url);
        if (strUrl.includes('query1.finance.yahoo.com/v8/finance/chart/XU100.IS')) {
          return {
            ok: true,
            json: async () => ({
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 9250,
                      chartPreviousClose: 9100,
                      regularMarketTime: 1731312000,
                      // Intentionally omit regularMarketDayHigh, Low, Open, Volume, 52W High/Low
                    },
                    timestamp: [1731139200, 1731225600, 1731312000],
                    indicators: {
                      quote: [
                        {
                          open: [null, 9080, 9120],
                          high: [null, null, 9290],
                          low: [null, 9050, null],
                          close: [null, 9100, 9250], // first bar has null close -> dropped
                          volume: [null, null, 0], // zero / missing -> undefined
                        },
                      ],
                    },
                  },
                ],
              },
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      },
    }
  );

  // 1. Live quote keeps missing intraday high/low/open/volume/52w undefined
  const indexQuote = await stocksMod.fetchSpecificSymbolLive('XU100');
  assert.ok(indexQuote);
  assert.equal(indexQuote.price, 9250);
  assert.equal(indexQuote.high, undefined);
  assert.equal(indexQuote.low, undefined);
  assert.equal(indexQuote.open, undefined);
  assert.equal(indexQuote.volume, undefined);
  assert.equal(indexQuote.high52w, undefined);
  assert.equal(indexQuote.low52w, undefined);

  // 2. Historical candles drop null close bars and leave missing OHLC/volume undefined
  const candles = await stocksMod.fetchRealHistoricalCandles('XU100', '1M');
  assert.equal(candles.length, 2);
  assert.equal(candles[0].close, 9100);
  assert.equal(candles[0].high, undefined);
  assert.equal(candles[0].volume, undefined);
  assert.equal(candles[1].low, undefined);
  assert.equal(candles[1].volume, undefined);

  // 3. Technical indicators exclude invalid closes and return null instead of fallback defaults (e.g. lastClose/50)
  const mixedCandles = [
    { time: '2026-10-01', close: NaN },
    { time: '2026-10-02', close: 0 },
    ...Array.from({ length: 16 }, (_, idx) => ({
      time: `2026-10-${String(idx + 3).padStart(2, '0')}`,
      close: 100 + idx,
    })),
  ];

  // With 16 valid closes (< 20 for SMA20 and < 50 for SMA50), SMA20 & SMA50 must be null (never lastClose!)
  const analysis = stocksMod.getStockTechnicalAnalysis('TEST', mixedCandles);
  assert.ok(analysis);
  assert.equal(analysis.candles.length, 16);
  assert.ok(typeof analysis.latest.rsi === 'number');
  assert.equal(analysis.latest.sma20, null);
  assert.equal(analysis.latest.sma50, null);
  assert.equal(analysis.latest.macd, null);

  // Too few valid closes (< 14) even with padding 0/NaN bars -> returns null
  const insufficient = stocksMod.getStockTechnicalAnalysis('TEST', [
    ...Array.from({ length: 10 }, (_, i) => ({ time: `2026-10-0${i + 1}`, close: 0 })),
    ...Array.from({ length: 10 }, (_, i) => ({ time: `2026-10-${i + 11}`, close: 50 + i })),
  ]);
  assert.equal(insufficient, null);
});

test('UX-01 mobile home priority ranks daily contributors and important event first', () => {
  const resolveReq = (name) => {
    if (name.startsWith('@/')) {
      return load(path.join('src', `${name.slice(2)}.ts`), { require: resolveReq });
    }
    if (name.startsWith('./')) {
      return load(path.join('src/lib/news', `${name.slice(2)}.ts`), { require: resolveReq });
    }
    return require(name);
  };
  const {
    DASHBOARD_MOBILE_SECTION_ORDER,
    extractDailyContributors,
    selectTopImportantEvent,
  } = load('src/lib/dashboard/homePriority.ts', { require: resolveReq });

  assert.deepEqual(
    Array.from(DASHBOARD_MOBILE_SECTION_ORDER.slice(0, 3)),
    ['portfolio-summary', 'daily-contributors-and-event', 'portfolio-heatmap']
  );

  const dashboardSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/dashboard/page.tsx'),
    'utf8'
  );
  const summaryPos = dashboardSrc.indexOf('<PortfolioSummary />');
  const pulsePos = dashboardSrc.indexOf('<DailyPulseRow />');
  const heatmapPos = dashboardSrc.indexOf('<PortfolioHeatmap />');
  assert.ok(summaryPos !== -1 && pulsePos !== -1 && heatmapPos !== -1);
  assert.ok(summaryPos < pulsePos && pulsePos < heatmapPos, 'mobile DOM order puts DailyPulseRow before Heatmap');
  assert.match(dashboardSrc, /className="order-1"[\s\S]*?<PortfolioSummary/);
  assert.match(dashboardSrc, /className="order-2"[\s\S]*?<DailyPulseRow/);
  assert.match(dashboardSrc, /className="order-3"[\s\S]*?<PortfolioHeatmap/);

  const contributors = extractDailyContributors([
    {
      symbol: 'THYAO',
      assetType: 'stock',
      exchange: 'BIST',
      totalQuantity: 100,
      averageCost: 280,
      totalCost: 28000,
      currentPrice: 300,
      currentValue: 30000,
      pnl: 2000,
      pnlPercent: 7.14,
      weight: 45,
      dailyPnL: 650,
      dailyChangePercent: 2.21,
    },
    {
      symbol: 'AEFES',
      assetType: 'stock',
      exchange: 'BIST',
      totalQuantity: 500,
      averageCost: 24,
      totalCost: 12000,
      currentPrice: 22,
      currentValue: 11000,
      pnl: -1000,
      pnlPercent: -8.33,
      weight: 30,
      dailyPnL: -1200,
      dailyChangePercent: -9.84,
    },
    {
      symbol: 'TI2',
      assetType: 'fund',
      exchange: 'TEFAS',
      totalQuantity: 1000,
      averageCost: 10,
      totalCost: 10000,
      currentPrice: 10.5,
      currentValue: 10500,
      pnl: 500,
      pnlPercent: 5,
      weight: 25,
      dailyChangePercent: 1.5,
    },
    {
      symbol: 'MISSING',
      assetType: 'stock',
      exchange: 'BIST',
      totalQuantity: 10,
      averageCost: 100,
      totalCost: 1000,
      currentPrice: 0,
      currentValue: 0,
      pnl: 0,
      pnlPercent: 0,
      weight: 0,
      priceMissing: true,
      dailyPnL: 9999,
    },
  ], 3);

  assert.equal(contributors.length, 3);
  assert.equal(contributors[0].symbol, 'AEFES');
  assert.equal(contributors[0].dailyPnL, -1200);
  assert.equal(contributors[1].symbol, 'THYAO');
  assert.equal(contributors[2].symbol, 'TI2');
  assert.equal(contributors[2].href, '/funds/TI2');

  const now = Date.parse('2026-11-11T12:00:00Z');
  const topEvent = selectTopImportantEvent(
    [
      {
        id: '1',
        title: 'Genel piyasa ozeti yayinlandi',
        summary: 'Haftalik genel bulten.',
        source: 'Test',
        publishedAt: '2026-11-11T11:30:00Z',
        url: 'https://example.com/1',
      },
      {
        id: '2',
        title: 'THYAO yeni ucak alim sozlesmesi ve faiz karari gundemi',
        summary: 'THYAO bilanco ve operasyon detaylari aciklandi.',
        source: 'Test',
        publishedAt: '2026-11-11T09:00:00Z',
        url: 'https://example.com/2',
      },
    ],
    ['THYAO'],
    now
  );

  assert.ok(topEvent);
  assert.equal(topEvent.article.id, '2');
  assert.deepEqual(Array.from(topEvent.matchedSymbols), ['THYAO']);
  assert.ok(topEvent.priority >= 2);
});

test('UX-02 portfolio heatmap starts compact with expandable treemap and equivalent asset list', () => {
  const loadFrom = (entry) => load(entry, {
    require: (name) => {
      if (name.startsWith('@/')) return loadFrom(path.join('src', `${name.slice(2)}.ts`));
      if (name.startsWith('./') || name.startsWith('../')) return loadFrom(path.join(path.dirname(entry), `${name}.ts`));
      return require(name);
    },
  });
  const {
    HEATMAP_DEFAULT_EXPANDED,
    buildHeatmapRows,
    buildHeatmapCompactSummary,
  } = loadFrom('src/lib/dashboard/heatmapModel.ts');

  assert.equal(HEATMAP_DEFAULT_EXPANDED, false);

  const heatmapSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/dashboard/PortfolioHeatmap.tsx'),
    'utf8'
  );
  assert.match(heatmapSrc, /useState<boolean>\(HEATMAP_DEFAULT_EXPANDED\)/);
  assert.match(heatmapSrc, /data-testid="heatmap-compact-summary"/);
  assert.match(heatmapSrc, /data-testid="heatmap-asset-list"/);
  assert.match(heatmapSrc, /aria-expanded=\{isExpanded\}/);

  const holdings = [
    {
      symbol: 'THYAO',
      assetType: 'stock',
      exchange: 'BIST',
      totalQuantity: 100,
      averageCost: 280,
      totalCost: 28000,
      currentPrice: 300,
      currentValue: 30000,
      pnl: 2000,
      pnlPercent: 7.14,
      weight: 60,
      dailyChangePercent: 2.5,
    },
    {
      symbol: 'TI2',
      assetType: 'fund',
      exchange: 'TEFAS',
      totalQuantity: 1000,
      averageCost: 20,
      totalCost: 20000,
      currentPrice: 20,
      currentValue: 20000,
      pnl: 0,
      pnlPercent: -1.5,
      weight: 40,
    },
  ];

  const rows = buildHeatmapRows(holdings, { TI2: { price: 20, changePercent: -1.25 } }, 'daily');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].symbol, 'THYAO');
  assert.equal(rows[0].weightPercent, 60);
  assert.equal(rows[0].metricValue, 2.5);
  assert.equal(rows[1].symbol, 'TI2');
  assert.equal(rows[1].href, '/funds/TI2');
  assert.equal(rows[1].metricValue, -1.25);

  const summary = buildHeatmapCompactSummary(rows);
  assert.equal(summary.assetCount, 2);
  assert.equal(summary.positiveCount, 1);
  assert.equal(summary.negativeCount, 1);
  assert.equal(summary.topHolding.symbol, 'THYAO');
  assert.equal(summary.strongestGainer.symbol, 'THYAO');
  assert.equal(summary.strongestLoser.symbol, 'TI2');
});

test('UX-03 empty portfolio onboarding exposes trade, excel import, and sample portfolio in one screen', () => {
  const {
    EMPTY_PORTFOLIO_ACTIONS,
    shouldShowEmptyOnboarding,
  } = load('src/lib/portfolio/emptyOnboarding.ts');

  assert.deepEqual(
    Array.from(EMPTY_PORTFOLIO_ACTIONS, (a) => a.id),
    ['first_trade', 'excel_import', 'sample_portfolio']
  );

  assert.equal(
    shouldShowEmptyOnboarding({ loading: true, holdingsCount: 0, transactionsCount: 0, hasCash: false }),
    false
  );
  assert.equal(
    shouldShowEmptyOnboarding({ loading: false, holdingsCount: 0, transactionsCount: 0, hasCash: false }),
    true
  );
  assert.equal(
    shouldShowEmptyOnboarding({ loading: false, holdingsCount: 1, transactionsCount: 1, hasCash: false }),
    false
  );

  const onboardingSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/portfolio/EmptyPortfolioOnboarding.tsx'),
    'utf8'
  );
  assert.match(onboardingSrc, /data-testid="empty-portfolio-onboarding"/);
  assert.match(onboardingSrc, /empty-action-\$\{action\.id\}/);

  const portfolioPageSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/portfolio/page.tsx'),
    'utf8'
  );
  assert.match(portfolioPageSrc, /<EmptyPortfolioOnboarding/);
  assert.match(portfolioPageSrc, /onImportExcel=\{\(\) => setIsExcelModalOpen\(true\)\}/);
  assert.match(portfolioPageSrc, /onExploreSamplePortfolio=\{\(\) => setIsSamplePreview\(true\)\}/);
});

test('UX-04 sample portfolio preview isolates sample records from user persistence', () => {
  const loadFrom = (entry) => {
    if (entry.endsWith('.json')) {
      return JSON.parse(fs.readFileSync(entry, 'utf8'));
    }
    return load(entry, {
      require: (name) => {
        if (name.endsWith('.json')) {
          const resolved = name.startsWith('@/')
            ? path.join('src', name.slice(2))
            : path.join(path.dirname(entry), name);
          return JSON.parse(fs.readFileSync(resolved, 'utf8'));
        }
        if (name.startsWith('./') || name.startsWith('../')) {
          return loadFrom(path.join(path.dirname(entry), `${name}.ts`));
        }
        if (name.startsWith('@/')) {
          return loadFrom(path.join('src', `${name.slice(2)}.ts`));
        }
        return require(name);
      },
    });
  };

  const sampleMod = loadFrom('src/lib/portfolio/samplePortfolio.ts');
  const snapshot = sampleMod.getSamplePortfolioSnapshot();
  assert.equal(snapshot.portfolio.id, sampleMod.SAMPLE_PORTFOLIO_ID);
  assert.ok(snapshot.transactions.length >= 4);
  assert.ok(snapshot.summary.holdings.length >= 4);
  assert.ok(snapshot.summary.totalValue > 0);
  assert.equal(sampleMod.isSampleRecordId('sample-tx-1'), true);
  assert.equal(sampleMod.isSampleRecordId('tx-123'), false);

  const mixed = [
    ...snapshot.transactions,
    { id: 'user-tx-1', portfolioId: 'p-default', userId: 'guest' },
  ];
  const stripped = sampleMod.stripSampleRecords(mixed);
  assert.equal(stripped.length, 1);
  assert.equal(stripped[0].id, 'user-tx-1');

  const storeSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/store/usePortfolioStore.ts'),
    'utf8'
  );
  assert.match(storeSrc, /isSampleMode:/);
  assert.match(storeSrc, /setSampleMode:/);
  assert.match(storeSrc, /stripSampleRecords\(state\.transactions\)/);
  assert.match(storeSrc, /if \(isSampleMode\) \{\s*return getSamplePortfolioSnapshot\(livePrices\)\.summary;/);

  const dashboardSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/dashboard/page.tsx'),
    'utf8'
  );
  assert.match(dashboardSrc, /data-testid="dashboard-sample-invite"/);
  assert.match(dashboardSrc, /data-testid="dashboard-sample-banner"/);
});

test('UX-05 prevents 0 balance flash while auth or portfolio is loading and separates empty vs real zero', () => {
  const { resolvePortfolioDisplayPhase } = load('src/lib/portfolio/displayState.ts');

  assert.equal(
    resolvePortfolioDisplayPhase({
      authLoading: true,
      portfolioLoading: false,
      hasLoaded: false,
      transactionsCount: 0,
      cashConfigured: false,
      holdingsCount: 0,
      totalValue: 0,
    }),
    'loading'
  );

  assert.equal(
    resolvePortfolioDisplayPhase({
      authLoading: false,
      portfolioLoading: false,
      hasLoaded: false,
      transactionsCount: 0,
      cashConfigured: false,
      holdingsCount: 0,
      totalValue: 0,
    }),
    'loading'
  );

  assert.equal(
    resolvePortfolioDisplayPhase({
      authLoading: false,
      portfolioLoading: false,
      hasLoaded: true,
      transactionsCount: 0,
      cashConfigured: false,
      holdingsCount: 0,
      totalValue: 0,
    }),
    'empty'
  );

  assert.equal(
    resolvePortfolioDisplayPhase({
      authLoading: false,
      portfolioLoading: false,
      hasLoaded: true,
      transactionsCount: 2,
      cashConfigured: false,
      holdingsCount: 0,
      totalValue: 0,
    }),
    'zero_value'
  );

  assert.equal(
    resolvePortfolioDisplayPhase({
      authLoading: false,
      portfolioLoading: false,
      hasLoaded: true,
      transactionsCount: 1,
      cashConfigured: false,
      holdingsCount: 1,
      totalValue: 12500,
    }),
    'active'
  );

  const summarySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/dashboard/PortfolioSummary.tsx'),
    'utf8'
  );
  assert.match(summarySrc, /data-testid="portfolio-summary-loading"/);
  assert.match(summarySrc, /data-testid="portfolio-summary-empty"/);
  assert.match(summarySrc, /data-testid="portfolio-zero-value-badge"/);

  const portfolioPageSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/portfolio/page.tsx'),
    'utf8'
  );
  assert.match(portfolioPageSrc, /displayPhase === 'loading'/);
  assert.match(portfolioPageSrc, /data-testid="portfolio-loading-state"/);
});

test('UX-06 portfolio summary card separates link, period selector, and privacy toggle into independent keyboard controls', () => {
  const summarySrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/dashboard/PortfolioSummary.tsx'),
    'utf8'
  );

  // Outer card is a non-interactive landmark section, never a nested role="button" wrapper
  assert.doesNotMatch(summarySrc, /role="button"/);
  assert.doesNotMatch(summarySrc, /tabIndex=\{0\}/);
  assert.match(summarySrc, /<section aria-label="Portföy özeti" data-testid="portfolio-summary-card">/);

  // Three independent controls with explicit ARIA attributes and keyboard focus rings
  assert.match(summarySrc, /data-testid="portfolio-privacy-toggle"/);
  assert.match(summarySrc, /aria-pressed=\{isPrivacyMode\}/);
  assert.match(summarySrc, /data-testid="portfolio-period-toggle"/);
  assert.match(summarySrc, /aria-label=\{`Getiri dönemi:/);
  assert.match(summarySrc, /<Link[\s\S]*?href="\/portfolio"[\s\S]*?data-testid="portfolio-summary-link"/);
});

test('UX-07 search inputs and icon buttons expose meaningful accessible names', () => {
  const checks = [
    ['src/app/(dashboard)/news/page.tsx', /aria-label="Haber, hisse veya kaynak ara"/],
    ['src/app/(dashboard)/piyasalar/page.tsx', /aria-label="TEFAS fon kodu veya kurucu ara"/],
    ['src/app/(dashboard)/portfolio/page.tsx', /aria-label="İşlem geçmişinde sembol veya not ara"/],
    ['src/app/(dashboard)/portfolio/page.tsx', /aria-label="İşlem aramasını temizle"/],
    ['src/app/(dashboard)/watchlist/page.tsx', /aria-label=\{`\$\{item\.symbol\} varlığını takip listesinden çıkar`\}/],
    ['src/app/(dashboard)/ai-assistant/page.tsx', /aria-label="AI modeli ara"/],
    ['src/app/(dashboard)/ai-assistant/page.tsx', /aria-label="Model aramasını temizle"/],
    ['src/app/(dashboard)/stocks/[symbol]/page.tsx', /aria-label=\{`\$\{symbol\} sayfasını paylaş`\}/],
    ['src/components/layout/Header.tsx', /aria-label=\{unreadCount > 0 \? `Bildirimler \(\$\{unreadCount\} okunmamış\)` : 'Bildirimler'\}/],
    ['src/components/layout/Header.tsx', /aria-label=\{`\$\{item\.title\} bildirimini sil`\}/],
    ['src/components/layout/Sidebar.tsx', /aria-label=\{collapsed \? 'Kenar çubuğunu genişlet' : 'Kenar çubuğunu daralt'\}/],
    ['src/components/ui/ApkDownloadModal.tsx', /aria-label="APK indirme penceresini kapat"/],
  ];

  for (const [relPath, pattern] of checks) {
    const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(content, pattern, `Expected accessible name match in ${relPath}`);
  }
});

test('UX-08 mobile navigation keeps core one-tap flows and surfaces news and alarms prominently in drawer', () => {
  const {
    MOBILE_PRIMARY_NAV_ITEMS,
    MOBILE_DRAWER_NAV_ITEMS,
    isMobileNavHrefActive,
  } = load('src/lib/navigation/mobileNavModel.ts');

  const primaryHrefs = Array.from(MOBILE_PRIMARY_NAV_ITEMS).map((item) => item.href);
  assert.deepEqual(
    primaryHrefs.slice(0, 4),
    ['/dashboard', '/piyasalar', '/portfolio', '/watchlist']
  );
  assert.ok(primaryHrefs.includes('/ai-assistant'));

  const drawerItems = Array.from(MOBILE_DRAWER_NAV_ITEMS);
  assert.equal(drawerItems[0].href, '/news');
  assert.equal(drawerItems[0].label, 'Haberler');
  assert.equal(drawerItems[1].href, '/settings#notifications');
  assert.equal(drawerItems[1].label, 'Alarmlar');

  assert.equal(isMobileNavHrefActive('/settings#notifications', '/settings', '#notifications'), true);
  assert.equal(isMobileNavHrefActive('/settings', '/settings', '#notifications'), false);
  assert.equal(isMobileNavHrefActive('/settings', '/settings', ''), true);

  const mobileNavSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/layout/MobileNav.tsx'),
    'utf8'
  );
  assert.match(mobileNavSrc, /MOBILE_PRIMARY_NAV_ITEMS/);
  assert.match(mobileNavSrc, /MOBILE_DRAWER_NAV_ITEMS/);
  assert.match(mobileNavSrc, /aria-label="Diğer sayfalar"/);
});

test('UX-09 light and dark themes pass WCAG 2.1 AA contrast across text, badges, charts, and focus rings', () => {
  const {
    LIGHT_THEME_TOKENS,
    DARK_THEME_TOKENS,
    auditThemeContrast,
    contrastRatio,
  } = load('src/lib/theme/contrast.ts');

  const lightResults = Array.from(auditThemeContrast(LIGHT_THEME_TOKENS));
  const darkResults = Array.from(auditThemeContrast(DARK_THEME_TOKENS));

  for (const check of [...lightResults, ...darkResults]) {
    assert.ok(
      check.passed,
      `Contrast check ${check.id} failed (${check.ratio}:1 < ${check.minRequired}:1)`
    );
  }

  assert.ok(contrastRatio(LIGHT_THEME_TOKENS.textMuted, LIGHT_THEME_TOKENS.bgTertiary) >= 6.5);
  assert.ok(contrastRatio('#ffffff', LIGHT_THEME_TOKENS.accentSolid) >= 5.5);
  assert.ok(contrastRatio(DARK_THEME_TOKENS.accentText, DARK_THEME_TOKENS.bgCard) >= 6.5);

  const tokensCss = fs.readFileSync(path.join(__dirname, '..', 'src/theme/tokens.css'), 'utf8');
  assert.match(tokensCss, /--text-muted:\s*#475569/);
  assert.match(tokensCss, /--text-secondary:\s*#cbd5e1/);
  assert.match(tokensCss, /--accent-text:\s*#a78bfa/);
  assert.match(tokensCss, /--focus-ring:\s*#6d28d9/);
  assert.match(tokensCss, /--focus-ring:\s*#a78bfa/);

  const globalsCss = fs.readFileSync(path.join(__dirname, '..', 'src/app/globals.css'), 'utf8');
  assert.match(globalsCss, /:where\(html\.dark\)\s+\.text-accent/);
  assert.match(globalsCss, /outline:\s*2px solid var\(--focus-ring\)/);

  const dailyPulseSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/dashboard/DailyPulseRow.tsx'),
    'utf8'
  );
  assert.match(dailyPulseSrc, /text-amber-800 dark:text-amber-400/);

  const heatmapSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/dashboard/PortfolioHeatmap.tsx'),
    'utf8'
  );
  assert.match(heatmapSrc, /text-emerald-800 dark:text-emerald-400/);
  assert.match(heatmapSrc, /text-rose-800 dark:text-rose-400/);
});

test('UX-10 keyboard and screen-reader flows cover menus, filters, modals, back links, and error messages', () => {
  const { getNextRovingTabIndex } = load('src/lib/accessibility/keyboard.ts');
  assert.equal(getNextRovingTabIndex(0, 'ArrowRight', 4), 1);
  assert.equal(getNextRovingTabIndex(3, 'ArrowRight', 4), 0);
  assert.equal(getNextRovingTabIndex(0, 'ArrowLeft', 4), 3);
  assert.equal(getNextRovingTabIndex(2, 'Home', 4), 0);
  assert.equal(getNextRovingTabIndex(1, 'End', 4), 3);
  assert.equal(getNextRovingTabIndex(0, 'Enter', 4), null);
  assert.equal(getNextRovingTabIndex(0, 'ArrowRight', 0), null);

  const tabsSrc = fs.readFileSync(path.join(__dirname, '..', 'src/components/ui/Tabs.tsx'), 'utf8');
  assert.match(tabsSrc, /role="tablist"/);
  assert.match(tabsSrc, /role="tab"/);
  assert.match(tabsSrc, /aria-selected=\{isActive\}/);
  assert.match(tabsSrc, /getNextRovingTabIndex/);

  const modalSrc = fs.readFileSync(path.join(__dirname, '..', 'src/components/ui/Modal.tsx'), 'utf8');
  assert.match(modalSrc, /role="dialog"/);
  assert.match(modalSrc, /aria-modal="true"/);
  assert.match(modalSrc, /e\.key === 'Tab'/);
  assert.match(modalSrc, /e\.key === 'Escape'/);
  assert.match(modalSrc, /previouslyFocusedElementRef\.current\.focus\(\)/);

  const mobileNavSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/layout/MobileNav.tsx'),
    'utf8'
  );
  assert.match(mobileNavSrc, /moreButtonRef\.current\?\.focus\(\)/);
  assert.match(mobileNavSrc, /aria-haspopup="dialog"/);

  const headerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/layout/Header.tsx'),
    'utf8'
  );
  assert.match(headerSrc, /if \(e\.key === 'Escape'\)/);
  assert.match(headerSrc, /aria-label="Kullanıcı menüsü"/);
  assert.match(headerSrc, /aria-expanded=\{showUserMenu\}/);

  const layoutSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/layout.tsx'),
    'utf8'
  );
  assert.match(layoutSrc, /href="#main-content"/);
  assert.match(layoutSrc, /Ana içeriğe atla/);
  assert.match(layoutSrc, /id="main-content"/);

  const stockDetailSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/stocks/[symbol]/page.tsx'),
    'utf8'
  );
  assert.match(stockDetailSrc, /aria-label="Önceki sayfaya dön"/);

  const inputSrc = fs.readFileSync(path.join(__dirname, '..', 'src/components/ui/Input.tsx'), 'utf8');
  assert.match(inputSrc, /aria-invalid=\{Boolean\(error\)\}/);
  assert.match(inputSrc, /role="alert"/);

  const toastSrc = fs.readFileSync(path.join(__dirname, '..', 'src/components/ui/Toast.tsx'), 'utf8');
  assert.match(toastSrc, /role="region"/);
  assert.match(toastSrc, /aria-live="polite"/);
  assert.match(toastSrc, /aria-label="Bildirimi kapat"/);
});

test('UX-11 unifies loading, error, and empty states with status label, reason, and next action across core screens', () => {
  const { resolveUnifiedStateMeta, STATE_STATUS_LABELS } = load('src/lib/ui/stateDescriptor.ts');
  assert.equal(STATE_STATUS_LABELS.loading, 'Yükleniyor');
  assert.equal(STATE_STATUS_LABELS.empty, 'Veri Yok');
  assert.equal(STATE_STATUS_LABELS.error, 'Bağlantı / Veri Hatası');

  assert.deepEqual(
    { ...resolveUnifiedStateMeta('loading') },
    { role: 'status', ariaLive: 'polite', ariaBusy: true, statusLabel: 'Yükleniyor' }
  );
  assert.deepEqual(
    { ...resolveUnifiedStateMeta('error', 'Özel Hata') },
    { role: 'alert', ariaLive: 'assertive', ariaBusy: false, statusLabel: 'Özel Hata' }
  );

  const stateViewSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/ui/StateView.tsx'),
    'utf8'
  );
  assert.match(stateViewSrc, /resolveUnifiedStateMeta/);
  assert.match(stateViewSrc, /meta\.statusLabel/);
  assert.match(stateViewSrc, /data-state-kind=\{kind\}/);

  const screenPaths = [
    'src/app/(dashboard)/news/page.tsx',
    'src/app/(dashboard)/watchlist/page.tsx',
    'src/app/(dashboard)/piyasalar/page.tsx',
    'src/app/(dashboard)/portfolio/page.tsx',
    'src/components/dashboard/DailyPulseRow.tsx',
  ];
  for (const relPath of screenPaths) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /<StateView/, `Expected unified StateView usage in ${relPath}`);
  }
});

test('UX-12 enforces consistent Turkish decimals, currency symbols, signed percents, and safe dates across UI', () => {
  const {
    formatCurrency,
    formatSignedCurrency,
    formatPercent,
    formatSignedPercent,
    formatDate,
  } = load('src/lib/utils/format.ts');

  assert.equal(formatCurrency(1234.56, 'TRY'), '₺1.234,56');
  assert.equal(formatCurrency(-1234.56, 'TRY'), '-₺1.234,56');
  assert.equal(formatCurrency(1234.56, 'USD'), '$1.234,56');
  assert.equal(formatCurrency(-1234.56, 'USD'), '-$1.234,56');
  assert.equal(formatSignedCurrency(250.5, 'TRY'), '+₺250,50');
  assert.equal(formatSignedCurrency(-250.5, 'TRY'), '-₺250,50');
  assert.equal(formatPercent(-2.5), '-%2,50');
  assert.equal(formatSignedPercent(2.5), '+%2,50');
  assert.equal(formatSignedPercent(-2.5), '-%2,50');
  assert.equal(formatSignedPercent(-0.0), '%0,00');
  assert.equal(formatDate('not-a-date'), '—');

  const consistencyChecks = [
    ['src/components/dashboard/WatchlistPreview.tsx', /formatSignedPercent\(/],
    ['src/components/dashboard/TopMovers.tsx', /formatSignedPercent\(/],
    ['src/components/dashboard/PortfolioSummary.tsx', /formatSignedPercent\(/],
    ['src/components/dashboard/PortfolioHeatmap.tsx', /formatSignedPercent\(/],
    ['src/app/(dashboard)/watchlist/page.tsx', /formatSignedPercent\(/],
    ['src/components/dashboard/RecentTransactions.tsx', /formatCurrency\(total, currency\)/],
  ];
  for (const [relPath, pattern] of consistencyChecks) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, pattern, `Expected shared financial formatting in ${relPath}`);
  }
});

test('POR-01 primary transaction action uses İşlem Kaydet and opens direct recording form', () => {
  const {
    TRANSACTION_RECORD_ACTION_LABEL,
    TRANSACTION_RECORD_DEFAULT_MODE,
  } = load('src/lib/portfolio/transactionActionLabel.ts');

  assert.equal(TRANSACTION_RECORD_ACTION_LABEL, 'İşlem Kaydet');
  assert.equal(TRANSACTION_RECORD_DEFAULT_MODE, 'stock');

  const portfolioSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/portfolio/page.tsx'),
    'utf8'
  );
  assert.match(portfolioSrc, /TRANSACTION_RECORD_ACTION_LABEL/);
  assert.match(portfolioSrc, /useState<[^>]+>\(\s*TRANSACTION_RECORD_DEFAULT_MODE\s*\)/);
  assert.doesNotMatch(portfolioSrc, />İşlem Yap</);
  assert.doesNotMatch(portfolioSrc, />Manuel İşlem Ekle</);

  const quickTxSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/layout/QuickTransaction.tsx'),
    'utf8'
  );
  assert.match(quickTxSrc, /TRANSACTION_RECORD_ACTION_LABEL/);
  assert.match(quickTxSrc, /initialMode=\{TRANSACTION_RECORD_DEFAULT_MODE\}/);

  const quickActionsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/dashboard/QuickActions.tsx'),
    'utf8'
  );
  assert.match(quickActionsSrc, /TRANSACTION_RECORD_ACTION_LABEL/);

  const holdingsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/portfolio/HoldingsTable.tsx'),
    'utf8'
  );
  assert.match(holdingsSrc, /TRANSACTION_RECORD_ACTION_LABEL/);

  const stockDetailSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/stocks/[symbol]/page.tsx'),
    'utf8'
  );
  assert.match(stockDetailSrc, /useState<TransactionChannel>\('record'\)/);
  assert.match(stockDetailSrc, /setTradeModalTab\('record'\)/);
  assert.match(stockDetailSrc, /\{TRANSACTION_RECORD_ACTION_LABEL\}/);

  const fundDetailSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/funds/[code]/page.tsx'),
    'utf8'
  );
  assert.match(fundDetailSrc, /\{TRANSACTION_RECORD_ACTION_LABEL\}/);
});

test('POR-02 separates transaction recording, virtual cash balance, and external broker channels', () => {
  const {
    TRANSACTION_CHANNEL_OPTIONS,
    getInitialTransactionChannel,
    resolveChannelSubState,
  } = load('src/lib/portfolio/transactionChannels.ts');

  const options = Array.from(TRANSACTION_CHANNEL_OPTIONS).map((o) => ({ ...o }));
  assert.deepEqual(
    options.map((o) => ({ id: o.id, label: o.label, external: o.external })),
    [
      { id: 'record', label: 'İşlem Kaydet', external: false },
      { id: 'virtual_cash', label: 'Sanal Bakiye', external: false },
      { id: 'external_broker', label: 'Dış Aracı Kuruma Git', external: true },
    ]
  );

  assert.equal(getInitialTransactionChannel(undefined), 'record');
  assert.equal(getInitialTransactionChannel('stock'), 'record');
  assert.equal(getInitialTransactionChannel('fund'), 'record');
  assert.equal(getInitialTransactionChannel('cash'), 'virtual_cash');
  assert.equal(getInitialTransactionChannel('broker'), 'external_broker');

  assert.deepEqual(
    { ...resolveChannelSubState('record') },
    { executionMode: 'virtual', assetSubTab: 'instrument', cashMode: false }
  );
  assert.deepEqual(
    { ...resolveChannelSubState('virtual_cash') },
    { executionMode: 'virtual', assetSubTab: 'cash', cashMode: true }
  );
  assert.deepEqual(
    { ...resolveChannelSubState('external_broker') },
    { executionMode: 'broker', assetSubTab: 'instrument', cashMode: false }
  );

  const txModalSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/portfolio/TransactionModal.tsx'),
    'utf8'
  );
  assert.match(txModalSrc, /TRANSACTION_CHANNEL_OPTIONS/);
  assert.match(txModalSrc, /selectedChannel/);
  assert.doesNotMatch(txModalSrc, /StockMind Sanal Bakiye<\/span>/);

  const stockDetailSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/stocks/[symbol]/page.tsx'),
    'utf8'
  );
  assert.match(stockDetailSrc, /TRANSACTION_CHANNEL_OPTIONS/);
  assert.match(stockDetailSrc, /tradeModalTab === 'virtual_cash'/);
  assert.match(stockDetailSrc, /tradeModalTab === 'external_broker'/);
});

test('POR-03 moves portfolio deletion into management menu and shows portfolio impact on confirm', () => {
  const { computePortfolioDeletionImpact } = load('src/lib/portfolio/portfolioDeletionImpact.ts');

  const impact = {
    ...computePortfolioDeletionImpact({
      portfolio: { id: 'p-1', name: 'BIST Uzun Vade' },
      transactions: [
        { portfolioId: 'p-1', symbol: 'THYAO' },
        { portfolioId: 'p-1', symbol: 'THYAO' },
        { portfolioId: 'p-1', symbol: 'ASELS' },
        { portfolioId: 'p-2', symbol: 'GARAN' },
      ],
    }),
  };

  assert.equal(impact.portfolioName, 'BIST Uzun Vade');
  assert.equal(impact.transactionCount, 3);
  assert.equal(impact.distinctSymbolCount, 2);
  assert.match(impact.impactSummary, /"BIST Uzun Vade"/);
  assert.match(impact.impactSummary, /3 adet işlem kaydı/);
  assert.match(impact.impactSummary, /2 farklı varlığa/);

  const portfolioSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/portfolio/page.tsx'),
    'utf8'
  );
  assert.match(portfolioSrc, /title="Portföy Yönetimi"/);
  assert.match(portfolioSrc, /aria-label="Portföy Yönetimi"/);
  assert.match(portfolioSrc, /computePortfolioDeletionImpact/);
  // Pill switcher should no longer embed an inline delete trigger right next to pill labels
  assert.doesNotMatch(portfolioSrc, /portföyünü sil`/);
});

test('PIY-01 keeps BIST, TEFAS and ABD market choices at the top on mobile', () => {
  const {
    MOBILE_PRIMARY_MARKETS,
    normalizeMarketParam,
    matchesMarketExchangeFilter,
  } = load('src/lib/market/marketSelector.ts');

  const ids = Array.from(MOBILE_PRIMARY_MARKETS, (m) => m.id);
  assert.deepEqual(ids.slice(0, 3), ['BIST', 'TEFAS', 'ABD']);
  assert.equal(normalizeMarketParam('us'), 'ABD');
  assert.equal(normalizeMarketParam('abd'), 'ABD');
  assert.equal(normalizeMarketParam('funds'), 'TEFAS');
  assert.equal(normalizeMarketParam('bist'), 'BIST');

  assert.equal(matchesMarketExchangeFilter('NASDAQ', 'ABD'), true);
  assert.equal(matchesMarketExchangeFilter('NYSE', 'ABD'), true);
  assert.equal(matchesMarketExchangeFilter('BIST', 'ABD'), false);
  assert.equal(matchesMarketExchangeFilter('BIST', 'BIST'), true);

  const piyasalarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/piyasalar/page.tsx'),
    'utf8'
  );
  assert.match(piyasalarSrc, /data-testid="mobile-top-market-bar"/);
  assert.match(piyasalarSrc, /sticky top-0/);
  assert.match(piyasalarSrc, /MOBILE_PRIMARY_MARKETS/);
});

test('PIY-02 remembers last market and filter while honoring explicit shared URL params', () => {
  const {
    MARKET_FILTER_STORAGE_KEY,
    resolveMarketStateWithPersistence,
    buildMarketSearchParams,
    sanitizePersistedMarketState,
  } = load('src/lib/market/marketFilterPersistence.ts');

  const saved = {
    market: 'BIST',
    sector: 'Teknoloji',
    category: 'ALL',
    search: 'ASELS',
    watchlistOnly: true,
    viewMode: 'grid',
    stockSortBy: 'changePercent',
    stockSortOrder: 'asc',
    fundSortBy: 'yearlyReturn',
    fundSortOrder: 'desc',
  };

  // Returning to /piyasalar without query params restores last selection
  const restored = { ...resolveMarketStateWithPersistence(new URLSearchParams(''), saved) };
  assert.equal(restored.market, 'BIST');
  assert.equal(restored.sector, 'Teknoloji');
  assert.equal(restored.search, 'ASELS');
  assert.equal(restored.watchlistOnly, true);
  assert.equal(restored.viewMode, 'grid');
  assert.equal(restored.stockSortBy, 'changePercent');
  assert.equal(restored.stockSortOrder, 'asc');

  // Shared URL overrides stale localStorage selection deterministically
  const sharedUrl = new URLSearchParams('market=tefas&category=Hisse+Senedi+Fonu&q=YAC');
  const fromShared = { ...resolveMarketStateWithPersistence(sharedUrl, saved) };
  assert.equal(fromShared.market, 'TEFAS');
  assert.equal(fromShared.category, 'Hisse Senedi Fonu');
  assert.equal(fromShared.sector, 'ALL');
  assert.equal(fromShared.search, 'YAC');
  assert.equal(fromShared.watchlistOnly, false);

  // Round-trip query serialization preserves shared filters
  const qs = buildMarketSearchParams(fromShared);
  const reparsed = { ...resolveMarketStateWithPersistence(new URLSearchParams(qs), saved) };
  assert.equal(reparsed.market, 'TEFAS');
  assert.equal(reparsed.category, 'Hisse Senedi Fonu');
  assert.equal(reparsed.search, 'YAC');

  // Malformed storage payload degrades cleanly without crashing
  const sanitized = { ...sanitizePersistedMarketState({ market: 'BOGUS', viewMode: 123, watchlistOnly: 'yes' }) };
  assert.deepEqual(sanitized, {});
  assert.equal(MARKET_FILTER_STORAGE_KEY, 'stockmind.piyasalar.filters.v1');

  const piyasalarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/piyasalar/page.tsx'),
    'utf8'
  );
  assert.match(piyasalarSrc, /MARKET_FILTER_STORAGE_KEY/);
  assert.match(piyasalarSrc, /resolveMarketStateWithPersistence/);
  assert.match(piyasalarSrc, /buildMarketSearchParams/);
});

test('PIY-03 ensures every search result displays symbol, exchange, asset type and currency', () => {
  const { describeSearchResult } = load('src/lib/market/searchResultDescriptor.ts');

  const bist = { ...describeSearchResult({ symbol: 'THYAO.IS', name: 'Türk Hava Yolları', exchange: 'BIST', currency: 'TRY' }) };
  assert.deepEqual(bist, {
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    exchange: 'BIST',
    assetTypeLabel: 'Hisse',
    currency: 'TRY',
  });

  const us = { ...describeSearchResult({ symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currency: 'USD' }) };
  assert.deepEqual(us, {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    assetTypeLabel: 'Hisse',
    currency: 'USD',
  });

  const fund = { ...describeSearchResult({ code: 'TI2', name: 'İş Portföy BIST 30 Fonu', assetType: 'fund' }) };
  assert.deepEqual(fund, {
    symbol: 'TI2',
    name: 'İş Portföy BIST 30 Fonu',
    exchange: 'TEFAS',
    assetTypeLabel: 'Fon',
    currency: 'TRY',
  });

  const crypto = { ...describeSearchResult({ symbol: 'BTC', name: 'Bitcoin', exchange: 'CRYPTO' }) };
  assert.deepEqual(crypto, {
    symbol: 'BTC',
    name: 'Bitcoin',
    exchange: 'CRYPTO',
    assetTypeLabel: 'Kripto',
    currency: 'USD',
  });

  for (const relPath of [
    'src/components/layout/SearchPalette.tsx',
    'src/components/portfolio/TransactionModal.tsx',
    'src/app/(dashboard)/piyasalar/page.tsx',
  ]) {
    const src = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    assert.match(src, /describeSearchResult/, `${relPath} should use describeSearchResult`);
  }
});

test('PIY-04 exposes chart timeframe, price unit, last candle time and missing-data state', () => {
  const { buildChartDataCoverageReport } = load('src/lib/market/chartDataCoverage.ts');

  const complete = {
    ...buildChartDataCoverageReport({
      timeframe: '1Y',
      currency: 'TRY',
      candles: Array.from({ length: 120 }, (_, i) => ({
        time: i === 0 ? '2025-05-01' : i === 119 ? '2026-04-30' : `2025-06-0${(i % 9) + 1}`,
        close: 300 + i * 0.2,
      })),
    }),
  };
  assert.equal(complete.timeframeLabel, '1Y (1 Yıl)');
  assert.equal(complete.priceUnitLabel, 'TRY (₺)');
  assert.equal(complete.lastCandleTime, '2026-04-30');
  assert.equal(complete.rangeSummary, '2025-05-01 – 2026-04-30');
  assert.equal(complete.coverageStatus, 'complete');
  assert.equal(complete.missingDataNotice, null);

  const missing = {
    ...buildChartDataCoverageReport({
      timeframe: '1D',
      currency: 'USD',
      candles: [],
      error: 'Tarihsel veri sağlayıcıda bulunamadı.',
    }),
  };
  assert.equal(missing.coverageStatus, 'missing');
  assert.equal(missing.priceUnitLabel, 'USD ($)');
  assert.equal(missing.lastCandleTime, null);
  assert.match(missing.missingDataNotice, /bulunamadı/);

  const partial = {
    ...buildChartDataCoverageReport({
      timeframe: '1Y',
      isIndex: true,
      candles: [
        { time: '2026-04-28', close: 9800 },
        { time: '2026-04-29', close: 9850 },
      ],
    }),
  };
  assert.equal(partial.priceUnitLabel, 'Endeks Puanı (Puan)');
  assert.equal(partial.coverageStatus, 'partial');
  assert.match(partial.missingDataNotice, /2 mum/);

  const chartSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/components/stocks/CandlestickChart.tsx'),
    'utf8'
  );
  assert.match(chartSrc, /data-testid="chart-coverage-bar"/);
  assert.match(chartSrc, /data-testid="chart-missing-data"/);
  assert.match(chartSrc, /buildChartDataCoverageReport/);
});

test('PIY-05 lists only verified upcoming corporate events with date and source', () => {
  const {
    resolveEquityYahooTicker,
    normalizeUpcomingEvents,
    buildUpcomingEventsReport,
  } = load('src/lib/market/upcomingEvents.ts');

  assert.equal(resolveEquityYahooTicker('THYAO', 'BIST'), 'THYAO.IS');
  assert.equal(resolveEquityYahooTicker('AAPL', 'NASDAQ'), 'AAPL');

  const nowMs = Date.parse('2026-05-01T10:00:00Z');
  const futureEarningsTs = Math.floor(Date.parse('2026-05-20T00:00:00Z') / 1000);
  const pastDivTs = Math.floor(Date.parse('2026-04-01T00:00:00Z') / 1000);
  const futurePayTs = Math.floor(Date.parse('2026-06-15T00:00:00Z') / 1000);

  const report = {
    ...buildUpcomingEventsReport({
      symbol: 'THYAO',
      nowMs,
      yahooCalendar: {
        earnings: { earningsDate: [{ raw: futureEarningsTs }] },
        exDividendDate: { raw: pastDivTs }, // Past date must be ignored
        dividendDate: { raw: futurePayTs },
      },
      verifiedDisclosures: [
        {
          title: 'Olağan Genel Kurul Toplantısı',
          date: '2026-05-12',
          source: 'KAP',
          sourceUrl: 'https://www.kap.org.tr/tr/Bildirim/12345',
          verified: true,
        },
        {
          title: 'Söylenti Temettü Tarihi',
          date: '2026-05-18',
          source: '',
          verified: false, // Must be rejected
        },
      ],
    }),
  };

  const events = Array.from(report.events, (e) => ({ ...e }));
  assert.equal(report.status, 'ok');
  assert.equal(events.length, 3);
  assert.deepEqual(events.map((e) => e.eventDate), ['2026-05-12', '2026-05-20', '2026-06-15']);
  assert.equal(events[0].source, 'KAP');
  assert.equal(events[1].type, 'earnings');
  assert.equal(events[1].source, 'Yahoo Finance');
  assert.equal(events[2].type, 'dividend');

  const emptyReport = {
    ...buildUpcomingEventsReport({ symbol: 'ASELS', nowMs, yahooCalendar: null }),
  };
  assert.equal(emptyReport.status, 'empty');
  assert.equal(emptyReport.events.length, 0);

  const unavailableReport = {
    ...buildUpcomingEventsReport({ symbol: 'ASELS', nowMs, providerFailed: true }),
  };
  assert.equal(unavailableReport.status, 'unavailable');
  assert.equal(unavailableReport.events.length, 0);

  const stockDetailSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/(dashboard)/stocks/[symbol]/page.tsx'),
    'utf8'
  );
  assert.match(stockDetailSrc, /UpcomingEventsCard/);
});

test('HBR-04 matches news by asset identity, company aliases, and exchange without false positives', () => {
  const { matchNewsAssetIdentity } = load('src/lib/news/symbolMatch.ts');

  // 1. Company aliases (built-in and dynamic identity name)
  const aselsMatch = { ...matchNewsAssetIdentity('ASELSAN yeni savunma anlaşması imzaladı', { symbol: 'ASELS', exchange: 'BIST' }) };
  assert.equal(aselsMatch.matched, true);
  assert.equal(aselsMatch.matchedBy, 'company_alias');

  const customAliasMatch = {
    ...matchNewsAssetIdentity('Mavi Giyim mağaza sayısını artırdı', {
      symbol: 'MAVI',
      exchange: 'BIST',
      name: 'Mavi Giyim Sanayi A.Ş.',
    }),
  };
  assert.equal(customAliasMatch.matched, true);
  assert.equal(customAliasMatch.matchedBy, 'company_alias');

  // 2. Same symbol across different exchanges must stay separated
  const nasdaqOnlyText = 'NASDAQ:BIMAS veya NASDAQ:LOGO Wall Street kapanışında yükseldi';
  assert.equal(matchNewsAssetIdentity(nasdaqOnlyText, { symbol: 'LOGO', exchange: 'BIST' }).matched, false);
  assert.equal(matchNewsAssetIdentity(nasdaqOnlyText, { symbol: 'LOGO', exchange: 'NASDAQ' }).matched, true);

  assert.equal(
    matchNewsAssetIdentity('Borsa İstanbul BIST seansında ARCLK ve ABC hareketlendi', { symbol: 'ABC', exchange: 'NASDAQ' }, { category: 'BIST' }).matched,
    false
  );
  assert.equal(
    matchNewsAssetIdentity('Borsa İstanbul BIST seansında ARCLK ve ABC hareketlendi', { symbol: 'ABC', exchange: 'BIST' }, { category: 'BIST' }).matched,
    true
  );

  // 3. Ordinary prose / month / adjective false positives rejected unless explicit cashtag/alias
  assert.equal(matchNewsAssetIdentity('YENİ LOGO VE MAVİ RENKLİ KAMPANYA DUYURULDU', { symbol: 'LOGO', exchange: 'BIST' }).matched, false);
  assert.equal(matchNewsAssetIdentity('YENİ LOGO VE MAVİ RENKLİ KAMPANYA DUYURULDU', { symbol: 'MAVI', exchange: 'BIST' }).matched, false);
  assert.equal(matchNewsAssetIdentity('EKİM VE KASIM AYLARINDA ENFLASYON BEKLENTİSİ', { symbol: 'EKIM', exchange: 'BIST' }).matched, false);
  assert.equal(matchNewsAssetIdentity('GOLD WATCH RETAILERS REPORT HOLIDAY SALES', { symbol: 'GOLD', exchange: 'NYSE' }).matched, false);
  assert.equal(matchNewsAssetIdentity('$LOGO bilançosu beklentileri aştı', { symbol: 'LOGO', exchange: 'BIST' }).matched, true);
});

test('HBR-05: news ranking exposes matched asset, event type, and match reason for portfolio connections', () => {
  const { rankNews } = load('src/lib/news/relevance.ts');
  const newsPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/news/page.tsx'), 'utf8');
  const now = Date.now();
  const ranked = Array.from(rankNews(
    [
      {
        title: 'Aselsan yeni sözleşme imzaladı',
        summary: 'Savunma tarafında ek sipariş duyuruldu.',
        publishedAt: new Date(now - 3_600_000).toISOString(),
        category: 'BIST',
        source: 'KAP',
      },
      {
        title: 'Küresel teknoloji hisseleri',
        summary: 'NASDAQ:NVDA için temettü duyurusu paylaşıldı.',
        publishedAt: new Date(now - 7_200_000).toISOString(),
        category: 'GLOBAL',
        source: 'Reuters',
      },
    ],
    [
      { symbol: 'ASELS', exchange: 'BIST', name: 'Aselsan Elektronik A.Ş.' },
      { symbol: 'NVDA', exchange: 'NASDAQ', name: 'NVIDIA Corporation' },
    ],
    true,
    now,
  ));

  assert.equal(ranked.length, 2);
  assert.deepEqual(Array.from(ranked[0].matchedSymbols), ['ASELS']);
  assert.equal(ranked[0].event, 'Şirket işlemi veya sözleşme');
  assert.equal(ranked[0].eventTypeLabel, 'Şirket işlemi veya sözleşme');
  assert.equal(ranked[0].matchDetails.length, 1);
  assert.equal(ranked[0].matchDetails[0].matchedBy, 'company_alias');
  assert.match(ranked[0].matchDetails[0].reasonText, /Şirket adı/i);
  assert.match(ranked[0].connectionSummary, /ASELS \(BIST\).*Şirket işlemi veya sözleşme/);

  assert.deepEqual(Array.from(ranked[1].matchedSymbols), ['NVDA']);
  assert.equal(ranked[1].event, 'Temettü veya sermaye işlemi');
  assert.equal(ranked[1].matchDetails[0].matchedBy, 'exchange_ticker');
  assert.match(ranked[1].matchDetails[0].reasonText, /Borsa kodu/i);

  assert.match(newsPageSource, /data-testid="news-portfolio-reason"/);
  assert.match(newsPageSource, /Portföy Bağlantısı:/);
  assert.match(newsPageSource, /Olay: \{eventTypeLabel\}/);
  assert.match(newsPageSource, /detail\.reasonText/);
});

test('HBR-06: featured vs newest news stream expires old portfolio boost after 48h and switches sort order cleanly', () => {
  const { rankNews, normalizeNewsSortOrder, PORTFOLIO_PRIORITY_WINDOW_MS } = load('src/lib/news/relevance.ts');
  const newsPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/news/page.tsx'), 'utf8');
  const now = Date.parse('2026-11-11T12:00:00Z');
  assert.equal(PORTFOLIO_PRIORITY_WINDOW_MS, 48 * 60 * 60 * 1000);
  assert.equal(normalizeNewsSortOrder('recent'), 'recent');
  assert.equal(normalizeNewsSortOrder('important'), 'important');
  assert.equal(normalizeNewsSortOrder('invalid'), 'important');

  const freshPortfolio = {
    title: 'ASELS yeni iş anlaşması',
    summary: 'Aselsan yeni sözleşme imzaladı.',
    publishedAt: new Date(now - 6 * 3_600_000).toISOString(),
  };
  const expiredPortfolio = {
    title: 'ASELS eski bilanço haberi',
    summary: 'Aselsan bilançosunu açıkladı.',
    publishedAt: new Date(now - 60 * 3_600_000).toISOString(),
  };
  const newestGeneral = {
    title: 'Küresel piyasalarda son durum',
    summary: 'Avrupa ve ABD endeksleri açılışta yatay.',
    publishedAt: new Date(now - 1 * 3_600_000).toISOString(),
  };
  const invalidDatePortfolio = {
    title: 'ASELS tarihsiz kayıt',
    summary: 'ASELS duyurusu.',
    publishedAt: 'not-a-date',
  };

  const featured = Array.from(
    rankNews([expiredPortfolio, newestGeneral, freshPortfolio, invalidDatePortfolio], ['ASELS'], true, now),
  );
  // Fresh (<48h) portfolio event leads, followed strictly chronologically by newer general news,
  // then expired (>48h) portfolio news (priority 0), then invalid date at bottom.
  assert.equal(featured[0].article.title, freshPortfolio.title);
  assert.equal(featured[0].withinPriorityWindow, true);
  assert.equal(featured[1].article.title, newestGeneral.title);
  assert.equal(featured[2].article.title, expiredPortfolio.title);
  assert.equal(featured[2].withinPriorityWindow, false);
  assert.equal(featured[2].priority, 0);
  assert.equal(featured[3].article.title, invalidDatePortfolio.title);

  const newest = Array.from(
    rankNews([expiredPortfolio, newestGeneral, freshPortfolio, invalidDatePortfolio], ['ASELS'], false, now),
  );
  assert.deepEqual(
    newest.map((item) => item.article.title),
    [newestGeneral.title, freshPortfolio.title, expiredPortfolio.title, invalidDatePortfolio.title],
  );

  assert.match(newsPageSource, /data-testid="news-sort-controls"/);
  assert.match(newsPageSource, /data-testid="news-sort-important"/);
  assert.match(newsPageSource, /data-testid="news-sort-recent"/);
  assert.match(newsPageSource, /Son 48 saatlik portföy ve kritik olaylar üstte/);
});

test('HBR-07: separates news, official disclosures, and calendar events and splits headline tone from portfolio impact', () => {
  const { classifyNewsCardKind, buildNewsToneAndImpact } = load('src/lib/news/cardClassification.ts');
  const newsPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/news/page.tsx'), 'utf8');

  const officialKap = {
    ...classifyNewsCardKind({
      title: 'ASELS Özel Durum Açıklaması: Yeni sipariş sözleşmesi',
      summary: 'Kamuyu Aydınlatma Platformu üzerinden bildirildi.',
      source: 'KAP',
      category: 'KAP',
    }),
  };
  assert.equal(officialKap.kind, 'official_disclosure');
  assert.equal(officialKap.label, 'Resmî Açıklama');

  const officialCentralBank = {
    ...classifyNewsCardKind({
      title: 'Monetary policy decisions',
      summary: 'Governing Council decision on key ECB interest rates.',
      source: 'ECB',
      category: 'MACRO',
    }),
  };
  assert.equal(officialCentralBank.kind, 'official_disclosure');

  const calendarEvent = {
    ...classifyNewsCardKind({
      title: 'TCMB faiz kararı 20 Kasım tarihinde açıklanacak',
      summary: 'Ekonomik takvim içinde PPK toplantısı bekleniyor.',
      source: 'Investing.com Türkiye',
      category: 'MACRO',
    }),
  };
  assert.equal(calendarEvent.kind, 'calendar_event');
  assert.equal(calendarEvent.label, 'Takvim Olayı');

  const standardNews = {
    ...classifyNewsCardKind({
      title: 'BIST 100 endeksi günü artıda tamamladı',
      summary: 'Bankacılık öncülüğünde alımlar görüldü.',
      source: 'TRT Haber',
      category: 'BIST',
    }),
  };
  assert.equal(standardNews.kind, 'news');
  assert.equal(standardNews.label, 'Haber');

  const portfolioImpact = {
    ...buildNewsToneAndImpact({
      sentiment: 'positive',
      sentimentReason: 'Sözleşme artışı metinde olumlu geçti.',
      matchedSymbols: ['ASELS'],
      event: 'Şirket işlemi veya sözleşme',
      cardKind: 'news',
    }),
  };
  assert.equal(portfolioImpact.toneLabel, 'Olumlu');
  assert.match(portfolioImpact.impactScopeLabel, /ASELS/);
  assert.match(portfolioImpact.impactNote, /fiyatlaması|beklenti|marj/i);

  const macroImpact = {
    ...buildNewsToneAndImpact({
      sentiment: 'neutral',
      matchedSymbols: [],
      event: 'Faiz kararı',
      cardKind: 'calendar_event',
    }),
  };
  assert.equal(macroImpact.toneLabel, 'Nötr');
  assert.match(macroImpact.impactScopeLabel, /Makro/);

  assert.match(newsPageSource, /data-testid="news-card-type"/);
  assert.match(newsPageSource, /data-testid="news-tone-vs-impact"/);
  assert.match(newsPageSource, /Haber Tonu:/);
  assert.match(newsPageSource, /Olası Portföy Etkisi:/);
});

test('ALR-04: asset detail quick alert creation supports price/percent thresholds, explicit direction, and asset currency', () => {
  const {
    inferAssetAlertCurrency,
    formatAlertPrice,
    buildQuickAlertConfig,
  } = load('src/lib/market/alertForm.ts');
  const modalSource = fs.readFileSync(path.join(process.cwd(), 'src/components/stocks/PriceAlertModal.tsx'), 'utf8');
  const stockPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/stocks/[symbol]/page.tsx'), 'utf8');
  const fundPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/funds/[code]/page.tsx'), 'utf8');

  assert.equal(inferAssetAlertCurrency({ symbol: 'AAPL', exchange: 'NASDAQ' }), 'USD');
  assert.equal(inferAssetAlertCurrency({ symbol: 'THYAO', exchange: 'BIST' }), 'TRY');
  assert.equal(inferAssetAlertCurrency({ symbol: 'TI2', exchange: 'TEFAS', assetType: 'fund' }), 'TRY');
  assert.equal(inferAssetAlertCurrency({ symbol: 'SAP', currency: 'EUR' }), 'EUR');

  assert.equal(formatAlertPrice(210.5, 'USD', 'stock'), '$210.50');
  assert.equal(formatAlertPrice(1.23456, 'TRY', 'fund'), '₺1.2346');

  const usdPriceAlert = {
    ...buildQuickAlertConfig({
      symbol: 'AAPL',
      currentPrice: 200,
      assetType: 'stock',
      nativeCurrency: 'USD',
      selectedCurrency: 'USD',
      mode: 'price',
      direction: 'down',
      percentValue: 2,
      targetPriceInput: '190.50',
    }),
  };
  assert.equal(usdPriceAlert.ok, true);
  assert.equal(usdPriceAlert.alertType, 'price');
  assert.equal(usdPriceAlert.targetPrice, 190.5);
  assert.equal(usdPriceAlert.alertCurrency, 'USD');
  assert.equal(usdPriceAlert.alertDirection, 'down');
  assert.match(usdPriceAlert.descriptionText, /\$190\.50/);

  const fundPercentAlert = {
    ...buildQuickAlertConfig({
      symbol: 'TI2',
      currentPrice: 2.0,
      assetType: 'fund',
      nativeCurrency: 'TRY',
      selectedCurrency: 'TRY',
      mode: 'percent',
      direction: 'both',
      percentValue: 3.5,
      targetPriceInput: '',
    }),
  };
  assert.equal(fundPercentAlert.ok, true);
  assert.equal(fundPercentAlert.alertType, 'percent_both');
  assert.equal(fundPercentAlert.alertPercent, 3.5);
  assert.equal(fundPercentAlert.alertCurrency, 'TRY');

  const mismatchedCurrency = {
    ...buildQuickAlertConfig({
      symbol: 'AAPL',
      currentPrice: 200,
      assetType: 'stock',
      nativeCurrency: 'USD',
      selectedCurrency: 'TRY',
      mode: 'price',
      direction: 'up',
      percentValue: 2,
      targetPriceInput: '7000',
    }),
  };
  assert.equal(mismatchedCurrency.ok, false);
  assert.match(mismatchedCurrency.errorTitle, /Para Birimi/);

  assert.match(modalSource, /data-testid="alert-currency-selector"/);
  assert.match(modalSource, /data-testid="alert-fixed-direction"/);
  assert.match(stockPageSource, /data-testid="asset-quick-alert-btn"/);
  assert.match(stockPageSource, /currency: stock\.currency/);
  assert.match(fundPageSource, /data-testid="asset-quick-alert-btn"/);
  assert.match(fundPageSource, /<PriceAlertModal/);
});

test('ALR-05: All Alerts screen partitions active vs paused rules, describes thresholds, and supports pausing/editing', () => {
  const {
    partitionAlertRules,
    describeAlertRule,
    isAlertPaused,
  } = load('src/lib/market/alertRules.ts');
  const alertFormMod = load('src/lib/market/alertForm.ts');
  const alertFreshnessMod = load('src/lib/market/alertFreshness.ts');
  let storeState = {
    items: [
      {
        id: '1',
        symbol: 'ASELS',
        name: 'Aselsan',
        assetType: 'stock',
        price: 100,
        targetPrice: 110,
        alertType: 'price',
        alertBasePrice: 100,
        alertCurrency: 'TRY',
        alertDirection: 'up',
        alertPaused: false,
      },
      {
        id: '2',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        assetType: 'stock',
        price: 200,
        targetPrice: 210,
        alertPercent: 5,
        alertType: 'percent_up',
        alertBasePrice: 200,
        alertCurrency: 'USD',
        alertPaused: true,
      },
      {
        id: '3',
        symbol: 'THYAO',
        name: 'Türk Hava Yolları',
        assetType: 'stock',
        price: 300,
      },
    ],
    currentUserId: null,
  };
  const loadWithAlias = createAliasedLoader();
  const { isPriceAlertTriggered, useWatchlistStore } = loadWithAlias('src/store/useWatchlistStore.ts', {
    '@/lib/market/alertFreshness': alertFreshnessMod,
    '@/lib/market/alertForm': alertFormMod,
    zustand: {
      create: (fn) => {
        const set = (partial) => {
          storeState = { ...storeState, ...(typeof partial === 'function' ? partial(storeState) : partial) };
        };
        const get = () => storeState;
        const actions = fn(set, get);
        storeState = { ...actions, ...storeState };
        return Object.assign(() => storeState, { getState: () => storeState, setState: set });
      },
    },
  });

  const all = { ...partitionAlertRules(storeState.items, 'all') };
  assert.equal(all.allRules.length, 2);
  assert.equal(all.activeRules.length, 1);
  assert.equal(all.pausedRules.length, 1);
  assert.equal(all.pausedRules[0].symbol, 'AAPL');
  assert.equal(isAlertPaused(all.pausedRules[0]), true);

  const onlyPaused = { ...partitionAlertRules(storeState.items, 'paused', 'apple') };
  assert.equal(onlyPaused.filteredRules.length, 1);
  assert.equal(onlyPaused.filteredRules[0].symbol, 'AAPL');

  const descUsd = { ...describeAlertRule(storeState.items[1]) };
  assert.equal(descUsd.modeLabel, 'Yüzde Eşiği');
  assert.equal(descUsd.currency, 'USD');
  assert.match(descUsd.conditionText, /\$210\.00/);

  // Paused alert must not fire even when price breaches threshold
  const pausedEval = { ...isPriceAlertTriggered(storeState.items[1], 220) };
  assert.equal(pausedEval.triggered, false);
  assert.equal(pausedEval.paused, true);

  // Resume AAPL via toggleAlertPaused and verify it triggers now
  useWatchlistStore.getState().toggleAlertPaused('AAPL', false);
  assert.equal(storeState.items[1].alertPaused, false);
  const resumedEval = { ...isPriceAlertTriggered(storeState.items[1], 220) };
  assert.equal(resumedEval.triggered, true);
  assert.match(resumedEval.message, /\$220\.00/);

  const alertsPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/alerts/page.tsx'), 'utf8');
  const proxySource = fs.readFileSync(path.join(process.cwd(), 'src/lib/supabase/proxy.ts'), 'utf8');
  assert.match(alertsPageSource, /Tüm Alarmlar/);
  assert.match(alertsPageSource, /data-testid="alert-edit-btn"/);
  assert.match(alertsPageSource, /data-testid="alert-pause-toggle-btn"/);
  assert.match(alertsPageSource, /<PriceAlertModal/);
  assert.match(proxySource, /'\/alerts'/);
});

test('ALR-06: records and displays last check time, observed price, and last trigger telemetry per alert rule', () => {
  const {
    buildAlertTelemetryKey,
    loadAlertTelemetryMap,
    recordAlertCheck,
    recordAlertTrigger,
    clearAlertTelemetry,
  } = load('src/lib/market/alertTelemetry.ts');

  const backing = new Map();
  const storage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v)),
    removeItem: (k) => backing.delete(k),
  };

  recordAlertCheck({
    userId: 'user-1',
    symbol: 'NVDA',
    assetType: 'stock',
    checkedAt: '2026-11-11T14:00:00.000Z',
    observedPrice: 142.5,
    currency: 'USD',
    priceStatus: 'live',
  }, storage);

  let map = { ...loadAlertTelemetryMap('user-1', storage) };
  const nvdaKey = buildAlertTelemetryKey('stock', 'NVDA');
  assert.equal(map[nvdaKey].lastCheckedAt, '2026-11-11T14:00:00.000Z');
  assert.equal(map[nvdaKey].observedPrice, 142.5);
  assert.equal(map[nvdaKey].lastTriggeredAt, undefined);

  // Trigger records triggered timestamp and price
  recordAlertTrigger({
    userId: 'user-1',
    symbol: 'NVDA',
    assetType: 'stock',
    triggeredAt: '2026-11-11T14:05:00.000Z',
    triggeredPrice: 145.25,
    triggeredTitle: 'Hedef Fiyat Ulaştı: NVDA',
    currency: 'USD',
  }, storage);

  // Subsequent deferred check must update lastCheckedAt & status without wiping lastTriggeredAt
  recordAlertCheck({
    userId: 'user-1',
    symbol: 'NVDA',
    assetType: 'stock',
    checkedAt: '2026-11-11T14:10:00.000Z',
    observedPrice: null,
    currency: 'USD',
    priceStatus: 'deferred',
    deferralDescription: 'Piyasa kapalı',
  }, storage);

  map = { ...loadAlertTelemetryMap('user-1', storage) };
  assert.equal(map[nvdaKey].lastCheckedAt, '2026-11-11T14:10:00.000Z');
  assert.equal(map[nvdaKey].observedPrice, null);
  assert.equal(map[nvdaKey].priceStatus, 'deferred');
  assert.equal(map[nvdaKey].lastTriggeredAt, '2026-11-11T14:05:00.000Z');
  assert.equal(map[nvdaKey].lastTriggeredPrice, 145.25);

  // Account isolation: different user has empty map
  assert.deepEqual({ ...loadAlertTelemetryMap('user-2', storage) }, {});

  clearAlertTelemetry({ userId: 'user-1', symbol: 'NVDA', assetType: 'stock' }, storage);
  assert.equal(loadAlertTelemetryMap('user-1', storage)[nvdaKey], undefined);

  const watcherSource = fs.readFileSync(path.join(process.cwd(), 'src/components/watchlist/WatchlistAlertWatcher.tsx'), 'utf8');
  const alertsPageSource = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/alerts/page.tsx'), 'utf8');
  assert.match(watcherSource, /recordAlertCheck/);
  assert.match(watcherSource, /recordAlertTrigger/);
  assert.match(alertsPageSource, /data-testid="alert-rule-telemetry"/);
  assert.match(alertsPageSource, /Son Kontrol:/);
  assert.match(alertsPageSource, /Görülen Fiyat:/);
  assert.match(alertsPageSource, /Son Tetikleme:/);
});

test('ALR-07: server alert evaluator runs headlessly, skips paused/stale rules, and deduplicates identical threshold events', async () => {
  const loadWithAlias = createAliasedLoader();
  const priceStatusMod = load('src/lib/market/priceStatus.ts');
  const alertFreshnessMod = loadWithAlias('src/lib/market/alertFreshness.ts', {
    '@/lib/market/priceStatus': priceStatusMod,
  });
  const alertFormMod = load('src/lib/market/alertForm.ts');
  const { evaluateServerPriceAlerts } = loadWithAlias('src/lib/market/serverAlertEvaluator.ts', {
    '@/lib/market/alertFreshness': alertFreshnessMod,
    '@/lib/market/alertForm': alertFormMod,
  });

  const now = new Date('2026-11-11T10:15:00.000Z'); // BIST open window
  const recordedKeys = new Set();
  const persistedEvents = [];
  const updates = [];

  const store = {
    hasEventKey: async (key) => recordedKeys.has(key),
    insertEvent: async (evt) => {
      if (recordedKeys.has(evt.eventKey)) return { inserted: false, duplicate: true };
      recordedKeys.add(evt.eventKey);
      persistedEvents.push(evt);
      return { inserted: true };
    },
    updateRuleEvaluation: async (u) => {
      updates.push(u);
    },
  };

  const rules = [
    {
      watchlistItemId: 'w-1',
      userId: 'user-a',
      symbol: 'THYAO',
      name: 'Türk Hava Yolları',
      assetType: 'stock',
      exchange: 'BIST',
      targetPrice: 310,
      alertType: 'price',
      alertBasePrice: 295,
      alertCurrency: 'TRY',
      alertDirection: 'up',
      alertPaused: false,
    },
    {
      watchlistItemId: 'w-2',
      userId: 'user-a',
      symbol: 'ASELS',
      name: 'Aselsan',
      assetType: 'stock',
      exchange: 'BIST',
      targetPrice: 90,
      alertType: 'price',
      alertPaused: true,
    },
    {
      watchlistItemId: 'w-3',
      userId: 'user-a',
      symbol: 'GARAN',
      name: 'Garanti BBVA',
      assetType: 'stock',
      exchange: 'BIST',
      targetPrice: 120,
      alertType: 'price',
      alertPaused: false,
    },
  ];

  const quotes = new Map([
    [
      'stock:THYAO',
      {
        price: 315.4,
        exchange: 'BIST',
        assetType: 'stock',
        observation: { source: 'TradingView', asOf: now.toISOString(), fetchedAt: now.toISOString(), changePercent: 1.5 },
      },
    ],
    [
      'stock:ASELS',
      {
        price: 95,
        exchange: 'BIST',
        assetType: 'stock',
        observation: { source: 'TradingView', asOf: now.toISOString(), fetchedAt: now.toISOString(), changePercent: 0.4 },
      },
    ],
    // GARAN is missing -> deferred cleanly
  ]);

  const firstRun = await evaluateServerPriceAlerts({ rules, quotes, store, now });
  assert.equal(firstRun.skippedPausedCount, 1);
  assert.equal(firstRun.checkedCount, 2);
  assert.equal(firstRun.deferredCount, 1);
  assert.equal(firstRun.triggeredCount, 1);
  assert.equal(firstRun.deduplicatedCount, 0);
  assert.equal(persistedEvents.length, 1);
  assert.equal(persistedEvents[0].symbol, 'THYAO');
  assert.equal(persistedEvents[0].link, '/stocks/THYAO');

  // Re-evaluating the same threshold crossing 5 minutes later must deduplicate instead of recording twice
  const secondRun = await evaluateServerPriceAlerts({
    rules,
    quotes,
    store,
    now: new Date('2026-11-11T10:20:00.000Z'),
  });
  assert.equal(secondRun.triggeredCount, 0);
  assert.equal(secondRun.deduplicatedCount, 1);
  assert.equal(persistedEvents.length, 1);

  const cronRouteSource = fs.readFileSync(path.join(process.cwd(), 'src/app/api/cron/evaluate-alerts/route.ts'), 'utf8');
  assert.match(cronRouteSource, /CRON_SECRET/);
  assert.match(cronRouteSource, /evaluateServerPriceAlerts/);
});

test('ALR-08: account-bound notification inbox and preferences isolate accounts and merge cross-device state', () => {
  const storageMap = new Map();
  const mockStorage = {
    getItem(key) {
      return storageMap.has(key) ? storageMap.get(key) : null;
    },
    setItem(key, value) {
      storageMap.set(key, String(value));
    },
    removeItem(key) {
      storageMap.delete(key);
    },
  };

  const prevWindow = global.window;
  const prevLocalStorage = global.localStorage;
  const events = [];
  const prevEvent = global.Event;
  global.localStorage = mockStorage;
  global.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
  global.window = {
    dispatchEvent(event) {
      events.push(event?.type || 'unknown');
      return true;
    },
  };

  try {
    const loadWithAlias = createAliasedLoader();
    const vmGlobals = {
      localStorage: mockStorage,
      window: global.window,
      Event: global.Event,
    };
    const inboxMod = loadWithAlias('src/lib/notifications/inbox.ts', {}, vmGlobals);
    const inboxSyncMod = loadWithAlias(
      'src/lib/notifications/inboxSync.ts',
      { './inbox': inboxMod },
      vmGlobals,
    );
    const pushMod = loadWithAlias(
      'src/lib/notifications/pushNotification.ts',
      { './inbox': inboxMod, './inboxSync': inboxSyncMod },
      vmGlobals,
    );

    inboxMod.setActiveNotificationUser('user-a', mockStorage);
    inboxMod.saveInbox(
      [
        {
          id: 'notif-a-1',
          title: 'THYAO Hedef Fiyat',
          description: 'THYAO 320 TL seviyesine ulaştı.',
          time: '10:00',
          read: false,
          category: 'market',
          link: '/alerts',
          updatedAt: '2026-11-11T10:00:00.000Z',
        },
      ],
      undefined,
      mockStorage,
    );
    pushMod.savePushPreferences(
      {
        enabled: true,
        inAppEnabled: true,
        priceAlerts: false,
        dailyReport: true,
        portfolioMoves: false,
        marketNews: true,
      },
      undefined,
      { skipRemote: true },
    );

    assert.equal(inboxMod.readInbox(undefined, mockStorage).length, 1);
    assert.equal(pushMod.loadPushPreferences().marketNews, true);
    assert.equal(pushMod.loadPushPreferences().priceAlerts, false);

    // Switching to account B must completely hide account A's inbox and preferences
    inboxMod.setActiveNotificationUser('user-b', mockStorage);
    assert.equal(inboxMod.readInbox(undefined, mockStorage).length, 0);
    assert.equal(pushMod.loadPushPreferences().marketNews, false);
    assert.equal(pushMod.loadPushPreferences().priceAlerts, true);

    // Signing out clears active user context back to guest
    inboxMod.setActiveNotificationUser(null, mockStorage);
    assert.equal(inboxMod.readInbox(undefined, mockStorage).length, 0);
    assert.equal(events.includes('stockmind:inbox'), true);
    assert.equal(events.includes('stockmind:push-prefs'), true);

    // Cross-device merge keeps read/archived states monotonic
    const merged = inboxSyncMod.mergeAccountInboxItems(
      [
        {
          id: 'n1',
          title: 'Alarm 1',
          description: 'Cihaz 1 okudu ve arşivledi',
          time: '10:05',
          read: true,
          archived: true,
          category: 'market',
          updatedAt: '2026-11-11T10:05:00.000Z',
        },
        {
          id: 'n2',
          title: 'Alarm 2',
          description: 'Cihaz 1 henüz okumadı',
          time: '10:06',
          read: false,
          category: 'market',
          updatedAt: '2026-11-11T10:06:00.000Z',
        },
      ],
      [
        {
          id: 'n1',
          title: 'Alarm 1',
          description: 'Cihaz 2 eski önbellek',
          time: '10:01',
          read: false,
          category: 'market',
          updatedAt: '2026-11-11T10:01:00.000Z',
        },
        {
          id: 'n2',
          title: 'Alarm 2',
          description: 'Cihaz 2 okudu',
          time: '10:07',
          read: true,
          category: 'market',
          updatedAt: '2026-11-11T10:07:00.000Z',
        },
      ],
    );

    const n1 = merged.find((item) => item.id === 'n1');
    const n2 = merged.find((item) => item.id === 'n2');
    assert.equal(n1.read, true);
    assert.equal(n1.archived, true);
    assert.equal(n2.read, true);

    const syncRouteSource = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/notifications/sync/route.ts'),
      'utf8',
    );
    assert.match(syncRouteSource, /supabase\.auth\.getUser/);
    assert.match(syncRouteSource, /user_notification_states/);
    assert.match(syncRouteSource, /status:\s*401/);

    const authHookSource = fs.readFileSync(
      path.join(process.cwd(), 'src/hooks/useAuth.ts'),
      'utf8',
    );
    assert.match(authHookSource, /setActiveNotificationUser/);
    assert.match(authHookSource, /syncAccountNotificationState/);
  } finally {
    global.window = prevWindow;
    global.localStorage = prevLocalStorage;
    global.Event = prevEvent;
  }
});

test('ALR-09: device and notification channel manager lists active channels and prunes invalid devices automatically', () => {
  const devicesMod = load('src/lib/notifications/devices.ts');
  const nowMs = Date.parse('2026-11-11T12:00:00.000Z');

  const sampleDevices = [
    {
      id: 'dev-valid-android',
      deviceKey: 'android-pixel-9',
      deviceLabel: 'StockMind Android Uygulama',
      platform: 'android',
      channel: 'android',
      permissionState: 'granted',
      pushToken: 'fcm-live-token-123',
      channels: { inApp: true, push: true, email: true },
      status: 'active',
      lastSeenAt: '2026-11-11T11:30:00.000Z',
    },
    {
      id: 'dev-gone-410',
      deviceKey: 'chrome-old-mac',
      deviceLabel: 'Chrome (macOS)',
      platform: 'web',
      channel: 'web',
      permissionState: 'granted',
      pushToken: 'webpush-expired',
      channels: { inApp: true, push: true, email: false },
      status: 'active',
      invalidReason: 'HTTP 410 Gone NotRegistered',
      lastSeenAt: '2026-11-11T11:00:00.000Z',
    },
    {
      id: 'dev-stale',
      deviceKey: 'safari-iphone-60d',
      deviceLabel: 'Safari (iOS)',
      platform: 'web',
      channel: 'web',
      permissionState: 'granted',
      channels: { inApp: true, push: false, email: false },
      status: 'active',
      lastSeenAt: '2026-08-01T10:00:00.000Z',
    },
    {
      id: 'dev-denied-no-fallback',
      deviceKey: 'revoked-browser',
      deviceLabel: 'Edge (Windows)',
      platform: 'web',
      channel: 'web',
      permissionState: 'denied',
      channels: { inApp: false, push: false, email: false },
      status: 'active',
      lastSeenAt: '2026-11-11T10:00:00.000Z',
    },
  ];

  const { activeDevices, prunedDevices } = devicesMod.partitionAndPruneDevices(sampleDevices, nowMs);
  assert.equal(activeDevices.length, 1);
  assert.equal(activeDevices[0].id, 'dev-valid-android');
  assert.equal(prunedDevices.length, 3);
  assert.equal(devicesMod.isInvalidPushErrorCode('410'), true);
  assert.equal(devicesMod.isInvalidPushErrorCode('NotRegistered'), true);

  const summary = devicesMod.buildActiveChannelSummary({
    permissionState: 'granted',
    prefs: { enabled: true, inAppEnabled: true, priceAlerts: true, dailyReport: true },
    isAndroid: false,
    emailEnabled: true,
    devices: activeDevices,
  });

  const androidChannel = summary.find((item) => item.id === 'android-push');
  const webChannel = summary.find((item) => item.id === 'web-push');
  const emailChannel = summary.find((item) => item.id === 'email');
  assert.equal(androidChannel.active, true);
  assert.equal(webChannel.active, true);
  assert.equal(emailChannel.active, true);

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/notifications/devices/route.ts'),
    'utf8',
  );
  assert.match(routeSource, /partitionAndPruneDevices/);
  assert.match(routeSource, /supabase\.auth\.getUser/);
  assert.match(routeSource, /status:\s*401/);

  const settingsSource = fs.readFileSync(
    path.join(process.cwd(), 'src/app/(dashboard)/settings/page.tsx'),
    'utf8',
  );
  assert.match(settingsSource, /notification-device-management/);
  assert.match(settingsSource, /buildActiveChannelSummary/);
});

test('VER-08: asset types (Hisse, ETF, Fon, Endeks, Döviz, Emtia) and units (puan, TL/gram) are labeled consistently', () => {
  const assetMod = load('src/lib/market/assetClassification.ts');
  const { describeSearchResult } = load('src/lib/market/searchResultDescriptor.ts');

  assert.equal(assetMod.classifyAssetType({ symbol: 'THYAO', exchange: 'BIST' }).label, 'Hisse');
  assert.equal(assetMod.classifyAssetType({ symbol: 'QQQ', exchange: 'NASDAQ' }).label, 'ETF');
  assert.equal(assetMod.classifyAssetType({ symbol: 'GLDTR', exchange: 'BIST' }).label, 'ETF');
  assert.equal(assetMod.classifyAssetType({ code: 'TI2', exchange: 'TEFAS', assetType: 'fund' }).label, 'Fon');
  assert.equal(assetMod.classifyAssetType({ symbol: 'XU100', exchange: 'INDEX', isIndex: true }).label, 'Endeks');
  assert.equal(assetMod.classifyAssetType({ symbol: 'USDTRY', exchange: 'FOREX' }).label, 'Döviz');
  assert.equal(assetMod.classifyAssetType({ symbol: 'XAUTRYG', exchange: 'COMMODITY' }).label, 'Emtia');

  assert.equal(describeSearchResult({ symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE', currency: 'USD' }).assetTypeLabel, 'ETF');

  const xuFormatted = assetMod.formatAssetUnitPrice({
    value: 9850.25,
    symbol: 'XU100',
    exchange: 'INDEX',
    currency: 'TRY',
    unit: 'points',
    isIndex: true,
  });
  assert.match(xuFormatted, /puan$/);
  assert.doesNotMatch(xuFormatted, /₺/);

  const goldFormatted = assetMod.formatAssetUnitPrice({
    value: 3125.4,
    symbol: 'GA',
    exchange: 'COMMODITY',
    currency: 'TRY',
    unit: 'TL/gram',
  });
  assert.match(goldFormatted, /TL\/gram$/);
  assert.doesNotMatch(goldFormatted, /₺/);

  const overviewSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/api/markets/overview/route.ts'), 'utf8');
  assert.match(overviewSrc, /symbol:\s*'GA'[\s\S]*?unit:\s*'TL\/gram'/);
  assert.match(overviewSrc, /symbol:\s*'XU100'[\s\S]*?unit:\s*'points'/);

  const detailSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/stocks/[symbol]/page.tsx'), 'utf8');
  assert.match(detailSrc, /asset-type-badge/);
  assert.match(detailSrc, /formatAssetUnitPrice/);
});












