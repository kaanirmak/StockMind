const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function loadTs(relPath, stubs = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    const full = path.isAbsolute(file) ? file : path.join(root, file);
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
        URLSearchParams,
        TextDecoder,
        TextEncoder,
        ArrayBuffer,
        Uint8Array,
        Buffer,
        File: typeof File === 'function' ? File : class MockFile {},
        AbortSignal,
        crypto: webcrypto,
        console: { warn() {}, error() {}, log() {} },
        process: { env: {}, cwd: () => root },
        Date,
        Map,
        Set,
        Promise,
        ...globals,
        require(name) {
          if (Object.hasOwn(stubs, name)) return stubs[name];
          if (name === 'next/server') {
            class NextResponse extends Response {
              constructor(body, init) {
                super(body, init);
                this._cookiesSet = [];
                this.cookies = {
                  set: (cookieName, cookieVal, opts) => {
                    this._cookiesSet.push({ cookieName, cookieVal, opts });
                  },
                };
              }
              static json(body, init) {
                return new NextResponse(JSON.stringify(body), {
                  ...init,
                  headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
                });
              }
              static redirect(url, status = 307) {
                return new NextResponse(null, {
                  status,
                  headers: { Location: typeof url === 'string' ? url : url.toString() },
                });
              }
            }
            return { NextResponse };
          }
          if (name === 'xlsx' || name === 'nodemailer' || name === 'crypto' || name.startsWith('node:')) {
            return require(name);
          }
          if (name === 'zustand') {
            return { create: (fn) => (typeof fn === 'function' ? fn(() => {}, () => ({})) : {}) };
          }
          if (name === 'zustand/middleware') {
            return { persist: (fn) => fn };
          }
          if (name.startsWith('@/')) {
            if (name.endsWith('.json')) {
              return JSON.parse(fs.readFileSync(path.join(root, `src/${name.slice(2)}`), 'utf8'));
            }
            return load(`src/${name.slice(2)}.ts`);
          }
          if (name.startsWith('.')) {
            const target = path.resolve(path.dirname(full), `${name}.ts`);
            return load(target);
          }
          return require(name);
        },
      },
      { filename: full }
    );
    return exports;
  }
  return load(relPath);
}

test('OPS-10 Flow 1 (Guest Start): /demo entry sets guest cookie, redirects to ?demo=1, and activates sample snapshot', async () => {
  const { GET } = loadTs('src/app/demo/route.ts');
  const demoFlow = loadTs('src/lib/auth/demoFlow.ts');
  const sampleMod = loadTs('src/lib/portfolio/samplePortfolio.ts');

  const response = await GET(new Request('https://stockmind.kaanrmak7.workers.dev/demo'));
  assert.equal(response.status, 307);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/stockmind\.kaanrmak7\.workers\.dev\/dashboard\?demo=1/);
  assert.equal(response._cookiesSet[0].cookieName, demoFlow.GUEST_COOKIE_NAME);
  assert.equal(response._cookiesSet[0].cookieVal, 'true');

  const cookiesWritten = [];
  const sampleEnabledCalls = [];
  const navigatedUrls = [];
  demoFlow.enterGuestDemoClient({
    setCookie: (cookieStr) => cookiesWritten.push(cookieStr),
    writeSampleSession: (enabled) => sampleEnabledCalls.push(enabled),
    navigate: (url) => navigatedUrls.push(url),
  });
  assert.equal(cookiesWritten.length, 1);
  assert.deepEqual(sampleEnabledCalls, [true]);
  assert.deepEqual(navigatedUrls, [demoFlow.DEMO_DESTINATION_PATH]);
  assert.equal(demoFlow.isDemoQueryActive(new URLSearchParams('?demo=1')), true);
  assert.equal(demoFlow.isDemoQueryActive(new URLSearchParams('?tab=overview')), false);

  const snapshot = sampleMod.getSamplePortfolioSnapshot({
    THYAO: { price: 320, changePercent: 2.5 },
  });
  assert.ok(snapshot.transactions.length > 0);
  assert.ok(snapshot.summary.holdings.length > 0);
  assert.ok(snapshot.summary.totalValue > 0);
});

test('OPS-10 Flow 2 (Transaction Recording): multi-currency transactions update holdings and valuation summary', () => {
  const { calculatePortfolioSummary } = loadTs('src/lib/portfolio/calculations.ts');
  const { calculatePeriodPerformance } = loadTs('src/lib/portfolio/periodPerformance.ts');
  const now = new Date('2026-11-11T12:00:00Z');
  const transactions = [
    {
      id: 'tx-flow-1',
      portfolioId: 'p-flow',
      userId: 'u-flow',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 100,
      price: 250,
      currency: 'TRY',
      exchangeRate: 1,
      transactionDate: '2026-11-01',
      exchange: 'BIST',
    },
    {
      id: 'tx-flow-2',
      portfolioId: 'p-flow',
      userId: 'u-flow',
      symbol: 'AAPL',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 5,
      price: 200,
      currency: 'USD',
      exchangeRate: 40,
      transactionDate: '2026-11-01',
      exchange: 'NASDAQ',
    },
  ];

  const livePrices = {
    USDTRY: { price: 42, changePercent: 0.2 },
    THYAO: { price: 280, changePercent: 1.5 },
    AAPL: { price: 210, changePercent: 1.0 },
  };

  const summary = calculatePortfolioSummary(transactions, livePrices);
  // THYAO: 100 * 280 = 28,000 (cost 25,000 => +3,000)
  // AAPL: 5 * 210 * 42 = 44,100 (cost 40,000 => +4,100)
  assert.equal(summary.totalValue, 72_100);
  assert.equal(summary.totalCost, 65_000);
  assert.equal(summary.totalPnL, 7_100);

  const period = calculatePeriodPerformance(transactions, livePrices, {}, 'total', now);
  assert.equal(period.available, true);
  assert.equal(period.pnl, 7_100);
});

test('OPS-10 Flow 3 (File Import/Export): CSV and XLSX round-trip preserve transaction fidelity', async () => {
  const {
    buildTransactionsCsvContent,
    buildTransactionsExcelBuffer,
    parseExcelTransactions,
  } = loadTs('src/lib/portfolio/excelParser.ts');

  const records = [
    {
      symbol: 'ASELS',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 80,
      price: 68.5,
      currency: 'TRY',
      exchangeRate: 1,
      transactionDate: '2026-10-15',
      exchange: 'BIST',
    },
    {
      symbol: 'MSFT',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 4,
      price: 410.25,
      currency: 'USD',
      exchangeRate: 40.5,
      transactionDate: '2026-10-18',
      exchange: 'NASDAQ',
    },
  ];

  const xlsxBuf = await buildTransactionsExcelBuffer(records);
  const parsedXlsx = await parseExcelTransactions(xlsxBuf);
  assert.equal(parsedXlsx.invalidRows.length, 0);
  assert.equal(parsedXlsx.validRows.length, 2);
  assert.equal(parsedXlsx.validRows[0].data.symbol, 'ASELS');
  assert.equal(parsedXlsx.validRows[1].data.symbol, 'MSFT');
  assert.equal(parsedXlsx.validRows[1].data.exchangeRate, 40.5);

  const csvBuf = new TextEncoder().encode(buildTransactionsCsvContent(records)).buffer;
  const parsedCsv = await parseExcelTransactions(csvBuf);
  assert.equal(parsedCsv.invalidRows.length, 0);
  assert.equal(parsedCsv.validRows.length, 2);
  assert.equal(parsedCsv.validRows[0].data.quantity, 80);
});

test('OPS-10 Flow 4 (Alert Setup): symbol-scoped query, fresh quote firing, and stale deferral work end-to-end', () => {
  const symQuery = loadTs('src/lib/market/symbolQuery.ts');
  const freshness = loadTs('src/lib/market/alertFreshness.ts');

  // Wednesday 2026-11-11 10:00 UTC = 13:00 Istanbul (BIST open)
  const openNow = new Date('2026-11-11T10:00:00Z');

  const reqs = symQuery.buildScopedQuoteRequests(
    [
      { symbol: 'THYAO', assetType: 'stock', targetPrice: 310 },
      { symbol: 'TI2', assetType: 'fund', targetPrice: 5.5 },
    ],
    { liveOnly: true }
  );
  assert.equal(reqs.length, 2);
  assert.match(reqs[0].url, /symbols=THYAO/);
  assert.match(reqs[1].url, /symbols=TI2/);

  const freshOpenQuote = freshness.evaluateAlertPriceFreshness(
    {
      price: 312,
      assetType: 'stock',
      exchange: 'BIST',
      isLastKnown: false,
      observation: {
        source: 'YAHOO',
        fetchedAt: new Date('2026-11-11T09:58:00Z').toISOString(),
        asOf: new Date('2026-11-11T09:58:00Z').toISOString(),
        changePercent: 1.8,
      },
    },
    openNow
  );
  assert.equal(freshOpenQuote.eligible, true);

  const staleLastKnownQuote = freshness.evaluateAlertPriceFreshness(
    {
      price: 312,
      assetType: 'stock',
      exchange: 'BIST',
      isLastKnown: true,
      observation: {
        source: 'YAHOO',
        fetchedAt: new Date('2026-11-11T09:58:00Z').toISOString(),
        asOf: new Date('2026-11-10T15:00:00Z').toISOString(),
        changePercent: 0,
      },
    },
    openNow
  );
  assert.equal(staleLastKnownQuote.eligible, false);
});

test('OPS-10 Flow 5 (News Outage): total upstream outage returns explicit 503 failure instead of fake empty news', async () => {
  const failingRoute = loadTs('src/app/api/news/route.ts', {
    '@/lib/news/rssText': loadTs('src/lib/news/rssText.ts'),
    '@/lib/news/snapshot': { fetchNewsSnapshot: async () => [] },
    '@/lib/news/sourceCoverage': loadTs('src/lib/news/sourceCoverage.ts'),
  }, {
    fetch: async () => {
      throw new Error('upstream network unreachable');
    },
  });

  const res = await failingRoute.GET(new Request('https://stockmind.app/api/news?fresh=true'));
  const body = await res.json();
  assert.equal(res.status >= 500, true);
  assert.equal(body.success, false);
  assert.ok(typeof body.error === 'string' && body.error.length > 0);
});

test('OPS-10 Flow 6 (Report Generation): bulletin data collector + HTML generator disclose missing sources and escape markup', async () => {
  const marketMod = loadTs('src/lib/email/marketData.ts', {
    '@/lib/data/stocks': {
      fetchSpecificSymbolLive: async (symbol) => {
        if (symbol === 'XU100') {
          return { price: 10250.4, changePercent: 1.1, source: 'YAHOO', lastSyncAt: '2026-11-11T15:00:00Z' };
        }
        return null;
      },
    },
  });

  const serviceMod = loadTs('src/lib/email/service.ts', {
    '@/lib/email/marketData': marketMod,
  });

  const market = await marketMod.getBulletinMarketData();
  assert.equal(market.bist100, 10250.4);
  assert.ok(Array.isArray(market.missingFields));
  assert.ok(market.missingFields.length >= 1);

  const html = serviceMod.generateStockMindEmailHtml('<script>alert(1)</script>Kaan', {
    isDailyReport: true,
    marketData: market,
  });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /10\.250|10,250|10250/);
});

test('OPS-10 Gate: package.json pre-release and CI scripts include critical user flow suite', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.test, /tests\/criticalFlows\.test\.cjs/);
  assert.ok(pkg.scripts['test:flows'], 'test:flows script must exist');
  assert.ok(pkg.scripts['test:pre-release'], 'test:pre-release script must exist');
});
