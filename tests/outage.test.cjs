const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadTs(relPath, stubs = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.join(root, file);
    if (cache.has(full)) return cache.get(full);
    const exports = {};
    cache.set(full, exports);
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    vm.runInNewContext(
      source,
      {
        exports,
        module: { exports },
        Request,
        Response,
        Headers,
        URL,
        TextDecoder,
        TextEncoder,
        Uint8Array,
        Buffer,
        AbortSignal,
        crypto: webcrypto,
        console: { warn() {}, error() {}, log() {} },
        process: { env: {}, cwd: () => root },
        React: { createElement: () => null },
        ...globals,
        require(name) {
          if (Object.hasOwn(stubs, name)) return stubs[name];
          if (name === 'next/server') {
            class NextResponse extends Response {
              static json(body, init) {
                return Response.json(body, init);
              }
            }
            return { NextResponse };
          }
          if (name === 'crypto' || name.startsWith('node:')) return require(name);
          if (name === 'zustand') return { create: (fn) => (typeof fn === 'function' ? fn(() => {}, () => ({})) : {}) };
          if (name === 'react') return { createElement: () => null };
          if (name.startsWith('@/')) {
            if (name.endsWith('.json')) {
              const jsonPath = path.join(root, `src/${name.slice(2)}`);
              return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            }
            const candidateTs = `src/${name.slice(2)}.ts`;
            if (fs.existsSync(path.join(root, candidateTs))) return load(candidateTs);
            const candidateTsx = `src/${name.slice(2)}.tsx`;
            if (fs.existsSync(path.join(root, candidateTsx))) return load(candidateTsx);
            const candidateIndexTs = `src/${name.slice(2)}/index.ts`;
            if (fs.existsSync(path.join(root, candidateIndexTs))) return load(candidateIndexTs);
          }
          if (name.startsWith('.')) {
            const relTs = path.relative(root, path.resolve(path.dirname(full), `${name}.ts`));
            if (fs.existsSync(path.join(root, relTs))) return load(relTs);
          }
          throw new Error(`Unmocked dependency in outage test: ${name}`);
        },
      },
      { filename: full }
    );
    return exports;
  }
  return load(relPath);
}

function loadPortfolioStore() {
  return loadTs('src/lib/portfolio/calculations.ts');
}

test('OPS-04 (Stock Price Outage): /api/stocks returns 500 error & portfolio/alert UI surfaces missing-price partial valuation without fake prices', async () => {
  const stocksRoute = loadTs('src/app/api/stocks/route.ts', {
    '@/lib/data/stocks': {
      getAllStocksLive: async () => {
        throw new Error('Yahoo/BIST provider timeout');
      },
    },
  });

  const apiRes = await stocksRoute.GET(new Request('https://stockmind.test/api/stocks?liveOnly=true'));
  assert.equal(apiRes.status, 500);
  const apiJson = await apiRes.json();
  assert.equal(apiJson.success, false);
  assert.equal(apiJson.error, 'Hisse verileri alınamadı');

  const { calculatePortfolioSummary } = loadPortfolioStore();
  const { isPartialValuationStatus } = loadTs('src/components/portfolio/PartialValuationBanner.tsx', {
    '@/components/ui/Icon': { Icon: () => null },
    '@/components/ui/Badge': { Badge: () => null },
  });
  const { evaluateAlertPriceFreshness } = loadTs('src/lib/market/alertFreshness.ts');

  const summary = calculatePortfolioSummary(
    [
      {
        id: 't-stock-1',
        portfolioId: 'p-1',
        userId: 'u-1',
        symbol: 'THYAO',
        assetType: 'stock',
        transactionType: 'buy',
        quantity: 10,
        price: 300,
        commission: 0,
        currency: 'TRY',
        exchange: 'BIST',
        transactionDate: '2026-10-10',
        createdAt: '2026-10-10',
      },
    ],
    {} // Live quote missing due to stock provider outage
  );

  assert.equal(summary.valuationStatus.isPartialValuation, true);
  assert.equal(summary.valuationStatus.hasMissingPrices, true);
  assert.deepEqual([...summary.valuationStatus.missingPrices], ['THYAO']);
  assert.equal(isPartialValuationStatus(summary.valuationStatus), true);

  const freshness = evaluateAlertPriceFreshness(null);
  assert.equal(freshness.eligible, false);
  assert.equal(freshness.reason, 'missing-quote');
});

test('OPS-04 (TEFAS Fund Outage): /api/funds surfaces upstream outage or unsynced directory state as Missing status & defers TEFAS alerts', async () => {
  // 1. Complete DB/provider error returns explicit HTTP 500
  const failingFundsRoute = loadTs('src/app/api/funds/route.ts', {
    '@/lib/data/funds': {
      getFundsFromDatabase: async () => {
        throw new Error('Supabase/TEFAS unreachable');
      },
      getAllFunds: () => [],
    },
    '@/lib/api/tefas': { fetchTefasLiveDetail: async () => null },
  });
  const failRes = await failingFundsRoute.GET(new Request('https://stockmind.test/api/funds'));
  assert.equal(failRes.status, 500);
  const failJson = await failRes.json();
  assert.equal(failJson.success, false);
  assert.equal(failJson.error, 'Fon verileri alınamadı');

  // 2. When DB sync returns empty & only unpriced directory metadata exists, UI classifies Missing ('Eksik') and defers alerts
  const directoryOnlyRoute = loadTs('src/app/api/funds/route.ts', {
    '@/lib/data/funds': {
      getFundsFromDatabase: async () => [],
      getAllFunds: () => [{ code: 'TCD', title: 'Tacirler Değişken Fon', price: null, lastSyncAt: null, navDate: null }],
    },
    '@/lib/api/tefas': { fetchTefasLiveDetail: async () => null },
  });
  const dirJson = await (await directoryOnlyRoute.GET(new Request('https://stockmind.test/api/funds'))).json();
  assert.equal(dirJson.success, true);
  assert.equal(dirJson.data[0].price, null);

  const { classifyPriceStatus } = loadTs('src/lib/market/priceStatus.ts');
  const { evaluateAlertPriceFreshness } = loadTs('src/lib/market/alertFreshness.ts');

  const statusInfo = classifyPriceStatus({ price: dirJson.data[0].price, observation: null, exchange: 'TEFAS' });
  assert.equal(statusInfo.status, 'missing');
  assert.equal(statusInfo.label, 'Eksik');

  const freshness = evaluateAlertPriceFreshness({
    price: null,
    assetType: 'fund',
    exchange: 'TEFAS',
    lastSyncAt: null,
    navDate: null,
  });
  assert.equal(freshness.eligible, false);
  assert.equal(freshness.reason, 'invalid-price');
});

test('OPS-04 (News Provider Outage): /api/news returns 503 on total outage and explicit stale warning banner when falling back to snapshot', async () => {
  const totalOutageRoute = loadTs(
    'src/app/api/news/route.ts',
    {
      '@/lib/news/snapshot': { fetchNewsSnapshot: async () => [] },
    },
    {
      fetch: async () => {
        throw new Error('RSS network unreachable');
      },
    }
  );
  const outageRes = await totalOutageRoute.GET(new Request('https://stockmind.test/api/news?category=BIST'));
  assert.equal(outageRes.status, 503);
  const outageJson = await outageRes.json();
  assert.equal(outageJson.success, false);
  assert.match(outageJson.error, /Haber kaynaklarına şu anda ulaşılamıyor/);
  assert.deepEqual(outageJson.data, []);

  // Partial/stale snapshot preserved when upstream fails
  const staleCollectedAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  const staleFallbackRoute = loadTs(
    'src/app/api/news/route.ts',
    {
      '@/lib/news/snapshot': {
        fetchNewsSnapshot: async () => [
          {
            id: 'snap-1',
            title: 'Borsa İstanbul kapanış değerlendirmesi',
            summary: 'BIST 100 günü yatay tamamladı.',
            category: 'BIST',
            source: 'Bloomberg HT',
            url: 'https://example.com/news/1',
            publishedAt: staleCollectedAt,
            collectedAt: staleCollectedAt,
            feedId: 'investing-bist',
          },
        ],
      },
    },
    {
      fetch: async () => {
        throw new Error('Upstream 502');
      },
    }
  );
  const staleRes = await staleFallbackRoute.GET(new Request('https://stockmind.test/api/news?category=BIST'));
  assert.equal(staleRes.status, 200);
  const staleJson = await staleRes.json();
  assert.equal(staleJson.success, true);
  assert.equal(staleJson.stale, true);
  assert.match(staleJson.warning || '', /Canlı kaynaklara ulaşılamadı; son başarılı haberler gösteriliyor/);
});

test('OPS-04 (FX / USDTRY Outage): missing currency feed triggers missingFx partial valuation warning instead of fabricating exchange rates', () => {
  const { calculatePortfolioSummary } = loadPortfolioStore();
  const { calculateCashLedger, includeCashInSummary } = loadTs('src/lib/portfolio/cash.ts');
  const { isPartialValuationStatus } = loadTs('src/components/portfolio/PartialValuationBanner.tsx', {
    '@/components/ui/Icon': { Icon: () => null },
    '@/components/ui/Badge': { Badge: () => null },
  });

  const usdStockBuy = {
    id: 't-fx-1',
    portfolioId: 'p-1',
    userId: 'u-1',
    symbol: 'AAPL',
    assetType: 'stock',
    transactionType: 'buy',
    quantity: 2,
    price: 200,
    commission: 0,
    currency: 'USD',
    exchange: 'NASDAQ',
    transactionDate: '2026-10-10',
    createdAt: '2026-10-10',
  };

  // USDTRY intentionally absent in marketPrices to simulate FX provider outage
  const summaryWithoutFx = calculatePortfolioSummary([usdStockBuy], {
    AAPL: { price: 220, changePercent: 1.5 },
  });
  assert.equal(summaryWithoutFx.valuationStatus.isPartialValuation, true);
  assert.equal(summaryWithoutFx.valuationStatus.missingFx, true);

  const cashWithoutFx = calculateCashLedger(
    [usdStockBuy],
    [
      {
        id: 'm-1',
        portfolioId: 'p-1',
        userId: 'u-1',
        amount: 500,
        movementType: 'deposit',
        currency: 'USD',
        exchangeRate: 34,
        movementDate: '2026-10-01',
        createdAt: '2026-10-01',
      },
    ],
    { AAPL: { price: 220, changePercent: 1.5 } },
    '2026-10-15'
  );
  assert.ok(cashWithoutFx.missingRates.includes('USD'));

  const merged = includeCashInSummary(summaryWithoutFx, cashWithoutFx);
  assert.equal(merged.valuationStatus.missingFx, true);
  assert.equal(isPartialValuationStatus(merged.valuationStatus, cashWithoutFx.missingRates), true);
});

test('HBR-01 translates HTML, empty, malformed JSON and timeout responses into Turkish user messages', async () => {
  const {
    parseNewsApiResponse,
    mapNewsFetchErrorToTurkish,
  } = loadTs('src/lib/news/responseParser.ts');

  // 1. HTML 502 gateway page
  const htmlGateway = await parseNewsApiResponse({
    ok: false,
    status: 502,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
    text: async () => '<html><body><h1>502 Bad Gateway</h1></body></html>',
  });
  assert.equal(htmlGateway.ok, false);
  assert.doesNotMatch(htmlGateway.errorMessage, /SyntaxError|Unexpected token|JSON/i);
  assert.match(htmlGateway.errorMessage, /Haber servisi geçici olarak yanıt veremiyor/);

  // 2. HTML 200 captive portal / fallback page
  const html200 = await parseNewsApiResponse({
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    text: async () => '<!DOCTYPE html><html><body>Login</body></html>',
  });
  assert.equal(html200.ok, false);
  assert.match(html200.errorMessage, /HTML sayfası döndürdü/);

  // 3. Empty body
  const emptyRes = await parseNewsApiResponse({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '   ',
  });
  assert.equal(emptyRes.ok, false);
  assert.match(emptyRes.errorMessage, /boş yanıt döndürdü/);

  // 4. Truncated / invalid JSON
  const brokenJson = await parseNewsApiResponse({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '{"success": true, "data": [',
  });
  assert.equal(brokenJson.ok, false);
  assert.doesNotMatch(brokenJson.errorMessage, /SyntaxError|Unexpected end/i);
  assert.match(brokenJson.errorMessage, /geçersiz biçimde bir yanıt/);

  // 5. Timeout / Abort
  const timeoutErr = Object.assign(new Error('The operation was aborted due to timeout'), {
    name: 'TimeoutError',
  });
  const timeoutMsg = mapNewsFetchErrorToTurkish(timeoutErr, { aborted: true });
  assert.match(timeoutMsg, /zaman aşımına uğradı/);

  // 6. SyntaxError thrown externally
  const syntaxMsg = mapNewsFetchErrorToTurkish(new SyntaxError("Unexpected token '<', \"<html>\" is not valid JSON"));
  assert.doesNotMatch(syntaxMsg, /Unexpected token|SyntaxError/i);
  assert.match(syntaxMsg, /beklenen JSON yanıtını döndürmedi/);
});

test('HBR-02 persists last successful news feed per category with timestamp and rejects expired entries', () => {
  const {
    NEWS_CLIENT_SNAPSHOT_KEY,
    NEWS_SNAPSHOT_MAX_AGE_MS,
    upsertNewsCategorySnapshot,
    getNewsCategorySnapshot,
  } = loadTs('src/lib/news/clientSnapshot.ts');

  const nowMs = Date.parse('2026-05-01T12:00:00Z');
  const savedAt = new Date(nowMs - 30 * 60_000).toISOString();

  const updated = upsertNewsCategorySnapshot(
    null,
    'BIST',
    [
      {
        id: 'n-1',
        title: 'THYAO yeni hat açılışı',
        summary: 'Özet',
        category: 'BIST',
        sentiment: 'positive',
        source: 'Investing.com',
        url: 'https://tr.investing.com/news/1',
        publishedAt: '2026-05-01T11:15:00Z',
      },
      {
        // Invalid URL should be filtered out
        id: 'n-bad',
        title: 'Kötü link',
        summary: 'Özet',
        category: 'BIST',
        sentiment: 'neutral',
        source: 'Test',
        url: 'javascript:alert(1)',
        publishedAt: '2026-05-01T11:15:00Z',
      },
    ],
    savedAt,
    nowMs
  );

  const restored = getNewsCategorySnapshot(updated, 'BIST', nowMs + 60_000);
  assert.ok(restored);
  assert.equal(restored.savedAt, savedAt);
  assert.equal(restored.articles.length, 1);
  assert.equal(restored.articles[0].id, 'n-1');

  // Expired snapshot (> 24h) is discarded
  const expired = getNewsCategorySnapshot(updated, 'BIST', nowMs + NEWS_SNAPSHOT_MAX_AGE_MS + 1000);
  assert.equal(expired, null);

  assert.equal(NEWS_CLIENT_SNAPSHOT_KEY, 'stockmind.news.last_good.v1');

  const newsPageSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/news/page.tsx'), 'utf8');
  assert.match(newsPageSrc, /NEWS_CLIENT_SNAPSHOT_KEY/);
  assert.match(newsPageSrc, /lastSuccessAt/);
  assert.match(newsPageSrc, /Tekrar Dene/);
});

test('HBR-03 reports per-source lastSuccessAt, articleCount and failure reason in coverage telemetry', () => {
  const { NEWS_FEEDS } = loadTs('src/lib/news/feeds.ts');
  const {
    classifyNewsFeedError,
    buildNewsSourceCoverageReport,
  } = loadTs('src/lib/news/sourceCoverage.ts');

  assert.equal(classifyNewsFeedError(new Error('RSS upstream HTTP 503')), 'HTTP 503 hatası');
  assert.equal(classifyNewsFeedError(new Error('News upstream did not return RSS')), 'Geçerli RSS akışı döndürmedi');
  assert.equal(classifyNewsFeedError(Object.assign(new Error('timed out'), { name: 'TimeoutError' })), 'Kaynak zaman aşımına uğradı');

  const feeds = NEWS_FEEDS.slice(0, 4);
  const nowIso = '2026-05-01T14:00:00.000Z';
  const snapTime = '2026-05-01T13:50:00.000Z';
  const staleTime = '2026-05-01T10:00:00.000Z';

  const report = buildNewsSourceCoverageReport({
    feeds,
    freshFeedIds: new Set([feeds[1].id]),
    liveResultsByFeedId: new Map([
      [feeds[0].id, { ok: true, count: 14 }],
      [feeds[2].id, { ok: false, errorReason: 'HTTP 502 hatası' }],
      [feeds[3].id, { ok: false, errorReason: 'Kaynak zaman aşımına uğradı' }],
    ]),
    snapshotArticlesByFeedId: new Map([
      [feeds[1].id, { count: 9, latestCollectedAt: snapTime }],
      [feeds[2].id, { count: 6, latestCollectedAt: staleTime }],
    ]),
    nowIso,
  });

  assert.equal(report.totalSources, 4);
  assert.equal(report.healthySources, 3);
  assert.equal(report.failedSources, 1);

  assert.deepEqual(
    Array.from(report.sources, (s) => ({
      feedId: s.feedId,
      status: s.status,
      articleCount: s.articleCount,
      lastSuccessAt: s.lastSuccessAt,
      errorReason: s.errorReason,
    })),
    [
      { feedId: feeds[0].id, status: 'live', articleCount: 14, lastSuccessAt: nowIso, errorReason: null },
      { feedId: feeds[1].id, status: 'snapshot', articleCount: 9, lastSuccessAt: snapTime, errorReason: null },
      { feedId: feeds[2].id, status: 'stale_fallback', articleCount: 6, lastSuccessAt: staleTime, errorReason: 'HTTP 502 hatası' },
      { feedId: feeds[3].id, status: 'failed', articleCount: 0, lastSuccessAt: null, errorReason: 'Kaynak zaman aşımına uğradı' },
    ]
  );

  const routeSrc = fs.readFileSync(path.join(root, 'src/app/api/news/route.ts'), 'utf8');
  assert.match(routeSrc, /buildNewsSourceCoverageReport/);
  assert.match(routeSrc, /sourceCoverage/);

  const pageSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/news/page.tsx'), 'utf8');
  assert.match(pageSrc, /data-testid="news-source-coverage"/);
  assert.match(pageSrc, /sourceCoverage/);
});
