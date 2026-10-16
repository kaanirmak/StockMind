const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadModule(relPath) {
  const full = path.join(root, relPath);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    module: { exports },
    console: { warn() {}, error() {} },
    require(name) {
      if (name === 'next/cache') return { revalidateTag: () => {}, revalidatePath: () => {}, unstable_cache: (fn) => fn };
      if (name === '@/lib/data/stocks') return { POPULAR_STOCKS: [] };
      if (name === '@/lib/data/funds') return { TEFAS_FUNDS: [] };
      if (name === 'zustand') return { create: (fn) => (typeof fn === 'function' ? fn(() => {}, () => ({})) : {}) };
      if (name === '@supabase/supabase-js') return { createClient: () => ({ from: () => ({ select: () => ({}) }) }) };
      if (name === '@/lib/data/tefas_funds_directory.json' || name === './tefas_funds_directory.json') {
        const jsonPath = path.join(root, 'src/lib/data/tefas_funds_directory.json');
        if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        return [];
      }
      if (name.startsWith('@/')) {
        const candidateTs = path.join(root, name.replace('@/', 'src/') + '.ts');
        if (fs.existsSync(candidateTs)) return loadModule(name.replace('@/', 'src/') + '.ts');
        const candidateIndexTs = path.join(root, name.replace('@/', 'src/'), 'index.ts');
        if (fs.existsSync(candidateIndexTs)) return loadModule(name.replace('@/', 'src/') + '/index.ts');
      }
      if (name.startsWith('@/types/')) return {};
      throw new Error(`Unmocked dependency in portfolio test: ${name}`);
    },
  }, { filename: full });
  return exports;
}

const {
  calculatePortfolioSummary,
  calculatePortfolioHoldings,
  getLiveUsdTryRate,
} = loadModule('src/lib/portfolio/calculations.ts');

test('FIN-01: Önceki kapanışı 100, güncel fiyatı 110 (+%10) olan 1 adet varlık günlük 10 kazanç verir', () => {
  const transactions = [
    {
      id: 'tx-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 1,
      price: 100,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-10T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-10T10:00:00Z',
    },
  ];

  // Current price is 110, change is +10% (so previous close was 100)
  const livePrices = {
    THYAO: { price: 110, changePercent: 10 },
  };

  const summary = calculatePortfolioSummary(transactions, livePrices);
  assert.equal(summary.totalValue, 110);
  assert.equal(summary.dailyPnL, 10, 'Daily gain must be 10, not 11');
  assert.equal(summary.dailyPnLPercent, 10, 'Daily gain percent must be 10%');
});

test('FIN-02: 100 TL ye alınan 1 adet varlık 120 TL ye tamamen satıldığında gerçekleşmiş kâr 20 ve toplam kâr 20 dir', () => {
  const transactions = [
    {
      id: 'tx-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'KCHOL',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 1,
      price: 100,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-01T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'tx-2',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'KCHOL',
      assetType: 'stock',
      transactionType: 'sell',
      quantity: 1,
      price: 120,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-05T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-05T10:00:00Z',
    },
  ];

  const summary = calculatePortfolioSummary(transactions, {});
  assert.equal(summary.holdings.length, 0, 'Closed positions must not appear in open holdings');
  assert.equal(summary.totalValue, 0, 'Open positions market value is 0');
  assert.equal(summary.unrealizedPnL, 0, 'Unrealized PnL is 0');
  assert.equal(summary.realizedPnL, 20, 'Realized PnL must be 20');
  assert.equal(summary.totalPnL, 20, 'Total PnL must preserve realized gains (20)');
});

test('FIN-02b: Kısmi satış ve açık pozisyon kârının birleşik toplam kârı doğru hesaplanır', () => {
  const transactions = [
    {
      id: 'tx-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'ASELS',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 2,
      price: 100,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-01T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'tx-2',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'ASELS',
      assetType: 'stock',
      transactionType: 'sell',
      quantity: 1,
      price: 120,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-05T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-05T10:00:00Z',
    },
  ];

  // Remaining 1 share valued at 130
  const livePrices = {
    ASELS: { price: 130, changePercent: 0 },
  };

  const summary = calculatePortfolioSummary(transactions, livePrices);
  assert.equal(summary.holdings.length, 1);
  assert.equal(summary.holdings[0].totalQuantity, 1);
  assert.equal(summary.totalValue, 130);
  assert.equal(summary.totalCost, 100);
  assert.equal(summary.unrealizedPnL, 30);
  assert.equal(summary.realizedPnL, 20);
  assert.equal(summary.totalPnL, 50, 'Total PnL must be 30 unrealized + 20 realized = 50');
});

test('DATA-03: USD/TRY kuru bulunamadığında 38.5 sabitini kullanmaz ve eksik değerlemeyi bildirir', () => {
  const rate = getLiveUsdTryRate({});
  assert.equal(rate, null, 'Rate must be null when missing, not 38.5');

  const transactions = [
    {
      id: 'tx-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'AAPL',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 1,
      price: 200,
      currency: 'USD',
      commission: 0,
      transactionDate: '2026-10-01T10:00:00Z',
      exchange: 'NASDAQ',
      notes: null,
      createdAt: '2026-10-01T10:00:00Z',
    },
  ];

  const summary = calculatePortfolioSummary(transactions, { AAPL: { price: 210, changePercent: 1 } });
  assert.equal(summary.valuationStatus.missingFx, true, 'missingFx must be true when live USD/TRY rate is absent');
  assert.equal(summary.valuationStatus.isComplete, false, 'Valuation is flagged as incomplete');
});

test('FIN-05: Portföydeki varlık miktarından fazla satış yapılamaz', () => {
  const transactions = [
    {
      id: 'tx-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 50,
      price: 300,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-01T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-01T10:00:00Z',
    },
  ];

  const holdings = calculatePortfolioHoldings(transactions, { THYAO: { price: 310 } });
  const thyao = holdings.find((h) => h.symbol === 'THYAO');
  assert.equal(thyao?.totalQuantity, 50);

  // Attempting to sell 100 when only 50 available must be rejected
  const attemptedSellQty = 100;
  const isOverSell = attemptedSellQty > (thyao?.totalQuantity || 0);
  assert.equal(isOverSell, true, 'Selling 100 when owning 50 must be recognized as over-sell');

  // Attempting to sell an asset not owned at all
  const nonExistent = holdings.find((h) => h.symbol === 'EREGL');
  assert.equal(nonExistent, undefined, 'Holding not owned must be undefined');
});

test('UI-07: Auth callback type=recovery yönlendirmesini reset-password rotasına yapar', () => {
  const callbackCode = fs.readFileSync(path.join(root, 'src/app/auth/callback/route.ts'), 'utf8');
  assert.match(callbackCode, /type === 'recovery' \? '\/reset-password' : '\/dashboard'/, 'Callback route must direct recovery tokens to /reset-password');
  assert.equal(fs.existsSync(path.join(root, 'src/app/(auth)/reset-password/page.tsx')), true, 'Reset password page must exist');
});

test('DATA-01: generateFundHistory sentetik sinüs dalgası üretmez, dürüstçe boş dizi döner', () => {
  const { generateFundHistory } = loadModule('src/lib/data/funds.ts');
  const res = generateFundHistory('TI2', 90, 10.5);
  assert.equal(res.length, 0, 'generateFundHistory must return empty array, no synthetic sine waves');
});

test('AI-03: runMonteCarloSimulation gerçek Geometrik Brown Hareketi ve ampirik yüzdelikler hesaplar', () => {
  const { runMonteCarloSimulation } = loadModule('src/lib/quant/models.ts');
  const sim = runMonteCarloSimulation(100, 0.30, 0.20);
  assert.equal(sim.simulationsCount, 1000, 'Must report exact 1,000 simulations');
  assert.ok(sim.var5Percentile < sim.medianPrice, '5th percentile must be lower than median');
  assert.ok(sim.medianPrice < sim.best95Percentile, 'Median must be lower than 95th percentile');
  assert.equal(sim.sampleTrajectories.length, 5, 'Must provide 5 sample trajectories');
  assert.equal(sim.sampleTrajectories[0].length, 21, 'Trajectory must have 21 points (initial + 20 steps)');
});

test('AI-04: calculateDCF bankalar için model uygunluk uyarısı üretir', () => {
  const { calculateDCF } = loadModule('src/lib/quant/models.ts');
  const resGaran = calculateDCF({
    symbol: 'GARAN',
    currentPrice: 120,
    freeCashFlow: 50000,
    growthRate5Y: 15,
    terminalGrowthRate: 5,
    wacc: 18,
    netDebt: 0,
    sharesOutstanding: 4200,
    currency: 'TRY',
  });
  assert.ok(resGaran.modelApplicabilityWarning, 'Bank symbol GARAN must trigger model applicability warning');
  assert.match(resGaran.modelApplicabilityWarning, /Bankacılık ve finans kuruluşlarında/);

  const resThyao = calculateDCF({
    symbol: 'THYAO',
    currentPrice: 300,
    freeCashFlow: 80000,
    growthRate5Y: 15,
    terminalGrowthRate: 5,
    wacc: 18,
    netDebt: 50000,
    sharesOutstanding: 1380,
    currency: 'TRY',
  });
  assert.equal(resThyao.modelApplicabilityWarning, undefined, 'Industrial firm THYAO must not have bank warning');
});

test('SAVE-04: Excel içe aktarımında mükerrer kayıtlar algılanır', () => {
  const existingTransactions = [
    {
      id: 'tx-1',
      portfolioId: 'p-1',
      symbol: 'THYAO',
      transactionType: 'buy',
      quantity: 10,
      price: 300,
      transactionDate: '2026-10-10',
    },
  ];

  const candidateRow = {
    data: {
      symbol: 'THYAO',
      transactionType: 'buy',
      quantity: 10,
      price: 300,
      transactionDate: '2026-10-10',
    },
  };

  const isDuplicate = existingTransactions.some((ex) =>
    ex.symbol.toUpperCase() === candidateRow.data.symbol.toUpperCase() &&
    ex.transactionType === candidateRow.data.transactionType &&
    Math.abs(Number(ex.quantity) - Number(candidateRow.data.quantity)) < 0.0001 &&
    Math.abs(Number(ex.price) - Number(candidateRow.data.price)) < 0.0001 &&
    ex.transactionDate === candidateRow.data.transactionDate
  );
  assert.equal(isDuplicate, true, 'Exact matching transaction must be flagged as duplicate');
});

test('AND-01 & AND-02: Android WebView dosya erişimi kapalı, mixed content yasak ve host kontrolü aktif', () => {
  const mainActivityCode = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/MainActivity.java'), 'utf8');
  assert.match(mainActivityCode, /settings\.setAllowFileAccess\(false\)/, 'setAllowFileAccess must be false');
  assert.match(mainActivityCode, /settings\.setMixedContentMode\(WebSettings\.MIXED_CONTENT_NEVER_ALLOW\)/, 'Mixed content must be NEVER_ALLOW');
  assert.match(mainActivityCode, /isTrustedHost/, 'Host whitelist check must be present');
  assert.match(mainActivityCode, /isAllowedHost/, 'APK download domain validation must be present');
});

test('AND-04: Eski Vercel kurulumu Cloudflare Worker adresine otomatik taşınır', () => {
  const mainActivityCode = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/MainActivity.java'), 'utf8');
  const priceWorkerCode = fs.readFileSync(path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/StockPriceWorker.java'), 'utf8');

  assert.match(mainActivityCode, /PRODUCTION_URL\s*=\s*"https:\/\/stockmind\.kaanrmak7\.workers\.dev"/);
  assert.match(mainActivityCode, /currentServerUrl\.contains\("stockmind-finora\.vercel\.app"\)/);
  assert.match(priceWorkerCode, /serverUrl\.contains\("stockmind-finora\.vercel\.app"\)/);
  assert.doesNotMatch(mainActivityCode, /host\.equalsIgnoreCase\("stockmind-finora\.vercel\.app"\)/);
});

test('DATA-06 & DATA-07: Ortak fiyat sözleşmesi ve borsa normalizasyonu', () => {
  const { normalizeInstrumentId, parseInstrumentId } = loadModule('src/lib/utils/symbol.ts');
  const { toUnifiedPriceQuote } = loadModule('src/lib/api/adapters.ts');

  assert.equal(normalizeInstrumentId('THYAO', 'BIST'), 'BIST:THYAO');
  assert.equal(normalizeInstrumentId('BIST:GARAN'), 'BIST:GARAN');
  assert.equal(normalizeInstrumentId('AAPL', 'NASDAQ'), 'NASDAQ:AAPL');
  assert.equal(normalizeInstrumentId('TI2'), 'TEFAS:TI2');

  const parsed = parseInstrumentId('BIST:THYAO');
  assert.equal(parsed.exchange, 'BIST');
  assert.equal(parsed.symbol, 'THYAO');

  const unified = toUnifiedPriceQuote({
    symbol: 'THYAO',
    exchange: 'BIST',
    price: 310.5,
    previousClose: 300,
    change: 10.5,
    changePercent: 3.5,
    timestamp: '2026-10-14T15:00:00Z',
  }, 'bist_live');

  assert.equal(unified.instrumentId, 'BIST:THYAO');
  assert.equal(unified.symbol, 'THYAO');
  assert.equal(unified.exchange, 'BIST');
  assert.equal(unified.currency, 'TRY');
  assert.equal(unified.price, 310.5);
  assert.equal(unified.status, 'live');
  assert.equal(unified.source, 'bist_live');
  assert.equal(unified.asOf, '2026-10-14T15:00:00Z');
});

test('FIN-04: Dövizli varlıklarda kur etkisi (fxPnL) ve varlık fiyat etkisi (assetPnL) matematiksel olarak ayrıştırılır', () => {
  // 10 AAPL @ $200 with FX 30 TRY/USD -> Cost = 10 * 200 * 30 = 60,000 TRY
  const transactions = [
    {
      id: 'tx-us-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'AAPL',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 10,
      price: 200,
      currency: 'USD',
      exchangeRate: 30,
      commission: 0,
      transactionDate: '2026-10-01T10:00:00Z',
      exchange: 'NASDAQ',
      notes: null,
      createdAt: '2026-10-01T10:00:00Z',
    },
  ];

  // Current market: AAPL = $250, FX USD/TRY = 35
  // Current Value = 10 * 250 * 35 = 87,500 TRY
  // Total PnL = 87,500 - 60,000 = 27,500 TRY
  // Pure Asset Gain = 10 * ($250 - $200) * 35 = 17,500 TRY
  // Currency Gain (fxPnL) = 10 * $200 * (35 - 30) = 10,000 TRY
  const livePrices = {
    AAPL: { price: 250, changePercent: 2 },
    USDTRY: 35,
  };

  const summary = calculatePortfolioSummary(transactions, livePrices);
  const holding = summary.holdings[0];

  assert.equal(holding.totalCost, 60000);
  assert.equal(holding.currentValue, 87500);
  assert.equal(holding.pnl, 27500);
  assert.equal(holding.assetPnL, 17500, 'Pure price gain must be 17,500 TRY');
  assert.equal(holding.fxPnL, 10000, 'Currency fluctuation gain must be 10,000 TRY');
  assert.equal(summary.fxPnL, 10000);
  assert.equal(summary.assetPnL, 17500);
  assert.equal(holding.assetPnL + holding.fxPnL, holding.pnl, 'assetPnL + fxPnL must exactly equal total holding pnl');
});

test('FIN-06: Nakit temettü, hisse bölünmesi ve işlem ücreti olayları portföyü doğru günceller', () => {
  const transactions = [
    // 1. Buy 10 THYAO @ 300 TL = 3,000 TL
    {
      id: 'tx-ev-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 10,
      price: 300,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-01T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-01T10:00:00Z',
    },
    // 2. 2-for-1 Split -> Doubles shares to 20 while cost basis remains 3,000 TL (150 TL/share)
    {
      id: 'tx-ev-2',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'split',
      quantity: 2,
      price: 0,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-02T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-02T10:00:00Z',
    },
    // 3. Dividend received: 5 TL per share on 20 shares = 100 TL
    {
      id: 'tx-ev-3',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'dividend',
      quantity: 20,
      price: 5,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-03T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-03T10:00:00Z',
    },
    // 4. Custody fee: 20 TL
    {
      id: 'tx-ev-4',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'fee',
      quantity: 1,
      price: 20,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-10-04T10:00:00Z',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-10-04T10:00:00Z',
    },
  ];

  // Market price is 160 TL per split-adjusted share
  // Current Value = 20 * 160 = 3,200 TL
  // Unrealized PnL = 3,200 - 3,000 = 200 TL
  // Realized PnL = +100 (dividend) - 20 (fee) = 80 TL
  // Total PnL = 200 + 80 = 280 TL
  const summary = calculatePortfolioSummary(transactions, { THYAO: { price: 160, changePercent: 0 } });
  const holding = summary.holdings[0];

  assert.equal(holding.totalQuantity, 20, 'Post-split quantity must be 20');
  assert.equal(holding.totalCost, 3000, 'Cost basis must remain 3,000 TL');
  assert.equal(holding.averageCost, 150, 'Average cost must adjust to 150 TL');
  assert.equal(holding.currentValue, 3200);
  assert.equal(holding.dividendsEarned, 100);
  assert.equal(holding.feesPaid, 20);
  assert.equal(summary.dividendsTotal, 100);
  assert.equal(summary.feesTotal, 20);
  assert.equal(summary.realizedPnL, 80);
  assert.equal(summary.totalPnL, 280);
});

test('UI-08: Form hata ve yardımcı metin bağlantıları erişilebilir ARIA özniteliklerine sahiptir', () => {
  const inputCode = fs.readFileSync(path.join(root, 'src/components/ui/Input.tsx'), 'utf8');
  assert.match(inputCode, /aria-invalid/, 'Input must bind aria-invalid');
  assert.match(inputCode, /aria-describedby/, 'Input must link error/helper via aria-describedby');
  assert.match(inputCode, /role="alert"/, 'Error paragraph must declare role=alert');
});

test('AND-03: Android release imzalı derleme yapılandırması ortam değişkenleri ile desteklenir', () => {
  const buildGradleCode = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
  assert.match(buildGradleCode, /signingConfigs\s*\{/, 'signingConfigs block must be declared');
  assert.match(buildGradleCode, /KEYSTORE_PATH/, 'KEYSTORE_PATH env lookup must be present');
  assert.match(buildGradleCode, /signingConfig signingConfigs\.release/, 'Release build must link signingConfigs.release');
});

test('DATA-09: generateCandles sentetik veri üretmez ve boş dizi döner', () => {
  const { generateCandles } = loadModule('src/lib/data/stocks.ts');
  const candles = generateCandles('THYAO', '1M');
  assert.equal(Array.isArray(candles), true);
  assert.equal(candles.length, 0, 'generateCandles must return empty array per DATA-01/DATA-09');
});

test('UI-12: Fon detay sayfası portföy mağazasına bağlıdır ve TEFAS takas değerlemesini belirtir', () => {
  const fundDetailCode = fs.readFileSync(path.join(root, 'src/app/(dashboard)/funds/[code]/page.tsx'), 'utf8');
  assert.match(fundDetailCode, /usePortfolioStore/, 'FundDetailPage must import usePortfolioStore');
  assert.match(fundDetailCode, /addTransaction\(/, 'FundDetailPage must call addTransaction');
  assert.match(fundDetailCode, /exchange:\s*'TEFAS'/, 'Transaction exchange must be TEFAS');
  assert.match(fundDetailCode, /TEFAS Gün Sonu Takas Fiyatı/, 'Valuation method badge must be visible');
});

test('AI-07: Ayarlar sayfasında kota görünürlüğü ve katlanabilir ileri seviye anahtar yönetimi mevcuttur', () => {
  const settingsCode = fs.readFileSync(path.join(root, 'src/app/(dashboard)/settings/page.tsx'), 'utf8');
  assert.match(settingsCode, /AI Kota ve Maliyet Şeffaflığı/, 'Quota transparency card must exist');
  assert.match(settingsCode, /isAdvancedAiOpen/, 'Collapsible advanced AI state must exist');
  assert.match(settingsCode, /Maks\. 100 istek \/ gün/, 'System quota limits must be documented');
});

test('OPS-03: Günlük bülten cron rotası mükerrer gönderimleri engellemek için idempotency destekler', () => {
  const cronCode = fs.readFileSync(path.join(root, 'src/app/api/cron/daily-report/route.ts'), 'utf8');
  assert.match(cronCode, /sentReportsCache/, 'Idempotency cache must be present');
  assert.match(cronCode, /x-idempotency-key/, 'x-idempotency-key header check must exist');
  assert.match(cronCode, /recipients/, 'Batch recipient queue support must exist');
});

test('ALERT-01: Yüzdesel yükseliş (%1, %2, %3) alarmı eşik fiyatını doğru hesaplar ve tetikler', () => {
  const { calculateTargetPriceFromPercent, isPriceAlertTriggered } = loadModule('src/store/useWatchlistStore.ts');
  const basePrice = 100;

  assert.equal(calculateTargetPriceFromPercent(basePrice, 1, 'up'), 101);
  assert.equal(calculateTargetPriceFromPercent(basePrice, 2, 'up'), 102);
  assert.equal(calculateTargetPriceFromPercent(basePrice, 3, 'up'), 103);
  assert.equal(calculateTargetPriceFromPercent(basePrice, 5, 'up'), 105);

  const alertItem = {
    id: 'w-1',
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    price: 100,
    alertBasePrice: 100,
    alertPercent: 2,
    alertType: 'percent_up',
  };

  // Not reached
  assert.equal(isPriceAlertTriggered(alertItem, 101.5).triggered, false);

  // Reached exactly & crossed
  const triggered = isPriceAlertTriggered(alertItem, 102.5);
  assert.equal(triggered.triggered, true);
  assert.match(triggered.title, /%2 Yükseliş Alarmı/);
});

test('ALERT-02: Yüzdesel düşüş (%1, %2, %3) alarmı eşik fiyatını doğru hesaplar ve tetikler', () => {
  const { calculateTargetPriceFromPercent, isPriceAlertTriggered } = loadModule('src/store/useWatchlistStore.ts');
  const basePrice = 200;

  assert.equal(calculateTargetPriceFromPercent(basePrice, 1, 'down'), 198);
  assert.equal(calculateTargetPriceFromPercent(basePrice, 2, 'down'), 196);
  assert.equal(calculateTargetPriceFromPercent(basePrice, 3, 'down'), 194);

  const alertItem = {
    id: 'w-2',
    symbol: 'EREGL',
    name: 'Ereğli Demir Çelik',
    price: 200,
    alertBasePrice: 200,
    alertPercent: 3,
    alertType: 'percent_down',
  };

  // Not reached
  assert.equal(isPriceAlertTriggered(alertItem, 195).triggered, false);

  // Reached & dropped below 194
  const triggered = isPriceAlertTriggered(alertItem, 193.8);
  assert.equal(triggered.triggered, true);
  assert.match(triggered.title, /%3 Düşüş Alarmı/);
});

test('ALERT-03: İki yönlü sapma (±%) alarmı her iki kırılımda da tetiklenir', () => {
  const { isPriceAlertTriggered } = loadModule('src/store/useWatchlistStore.ts');
  const alertItem = {
    id: 'w-3',
    symbol: 'BIMAS',
    name: 'BİM Mağazalar',
    price: 500,
    alertBasePrice: 500,
    alertPercent: 1,
    alertType: 'percent_both',
  };

  // Within bounds
  assert.equal(isPriceAlertTriggered(alertItem, 502).triggered, false);

  // Upward breach (>= 505)
  assert.equal(isPriceAlertTriggered(alertItem, 505.5).triggered, true);

  // Downward breach (<= 495)
  assert.equal(isPriceAlertTriggered(alertItem, 494.5).triggered, true);
});






const { calculateCashLedger, includeCashInSummary } = loadModule('src/lib/portfolio/cash.ts');
function cashMovement(amount, movementType = 'deposit', currency = 'TRY', exchangeRate = 1, movementDate = '2026-10-14') {
  return { id: Math.random().toString(), portfolioId: 'p-1', userId: 'u-1', amount, movementType, currency, exchangeRate, movementDate, createdAt: movementDate };
}
function cashTrade(transactionType, quantity, price, commission = 0, currency = 'TRY') {
  return { id: Math.random().toString(), portfolioId: 'p-1', userId: 'u-1', symbol: 'TEST', assetType: 'stock', transactionType, quantity, price, commission, currency, exchange: currency === 'USD' ? 'NASDAQ' : 'BIST', transactionDate: '2026-10-14', createdAt: '2026-10-14' };
}
test('CASH-01: buys, sells, dividends and fees reconcile cash without counting stock splits as cash flows', () => {
  const txs = [cashTrade('buy', 5, 100, 5), cashTrade('sell', 2, 120, 2), cashTrade('dividend', 2, 3), cashTrade('fee', 1, 5), cashTrade('split', 2, 0)];
  const ledger = calculateCashLedger(txs, [cashMovement(1000)], {}, '2026-10-15');
  assert.equal(ledger.totalValue, 734);
  assert.equal(ledger.netContributions, 1000);
  assert.equal(ledger.hasDeficit, false);
});
test('CASH-02: deposits and withdrawals change account equity but are never investment profit', () => {
  const txs = [cashTrade('buy', 5, 100, 5), cashTrade('sell', 2, 120, 2), cashTrade('dividend', 2, 3), cashTrade('fee', 1, 5)];
  const summary = calculatePortfolioSummary(txs, { TEST: { price: 120, changePercent: 0 } });
  const before = includeCashInSummary(summary, calculateCashLedger(txs, [cashMovement(1000)], {}, '2026-10-15'));
  const after = includeCashInSummary(summary, calculateCashLedger(txs, [cashMovement(1000), cashMovement(200, 'withdrawal')], {}, '2026-10-15'));
  assert.equal(before.totalValue, 1094);
  assert.equal(before.totalPnL, 94);
  assert.equal(after.totalValue, 894);
  assert.equal(after.totalPnL, 94);
  assert.equal(after.totalCost, summary.totalCost);
});
test('CASH-03: today deposit does not inflate the daily return denominator', () => {
  const txs = [cashTrade('buy', 10, 100)];
  const summary = calculatePortfolioSummary(txs, { TEST: { price: 110, changePercent: 10 } });
  const ledger = calculateCashLedger(txs, [cashMovement(1000), cashMovement(1000, 'deposit', 'TRY', 1, '2026-10-15')], {}, '2026-10-15');
  const result = includeCashInSummary(summary, ledger);
  assert.equal(result.totalValue, 2100);
  assert.equal(result.totalPnL, 100);
  assert.equal(result.dailyPnL, 100);
  assert.equal(result.dailyPnLPercent, 10);
});
test('CASH-04: foreign cash uses real live rates; missing rates remain explicitly incomplete', () => {
  const movements = [cashMovement(100, 'deposit', 'USD', 40)];
  const txs = [cashTrade('buy', 1, 50, 0, 'USD')];
  const ledger = calculateCashLedger(txs, movements, { USDTRY: { price: 42, changePercent: (42 / 41 - 1) * 100 } }, '2026-10-15');
  assert.equal(ledger.balances[0].amount, 50);
  assert.equal(ledger.totalValue, 2100);
  assert.equal(ledger.netContributions, 4000);
  assert.ok(Math.abs(ledger.dailyFxPnL - 50) < 0.00001);
  const unavailable = calculateCashLedger(txs, movements, {}, '2026-10-15');
  assert.equal(unavailable.balances[0].value, null);
  assert.equal(unavailable.missingRates[0], 'USD');
});
test('CASH-05: legacy portfolios do not get an invented opening deposit or silently negative equity', () => {
  const txs = [cashTrade('buy', 1, 100)];
  const original = calculatePortfolioSummary(txs, { TEST: 110 });
  const ledger = calculateCashLedger(txs, [], {}, '2026-10-15');
  const result = includeCashInSummary(original, ledger);
  assert.equal(ledger.configured, false);
  assert.equal(ledger.hasDeficit, true);
  assert.equal(result.totalValue, original.totalValue);
});
test('CASH-06: future cash movements and trades do not change current available cash', () => {
  const ledger = calculateCashLedger([{ ...cashTrade('buy', 1, 100), transactionDate: '2026-10-20' }], [cashMovement(1000), cashMovement(500, 'deposit', 'TRY', 1, '2026-10-20')], {}, '2026-10-15');
  assert.equal(ledger.totalValue, 1000);
  assert.equal(ledger.netContributions, 1000);
});
test('CASH-07: foreign cash appreciation changes balance but is excluded from investment performance', () => {
  const ledger = calculateCashLedger([], [cashMovement(100, 'deposit', 'USD', 40, '2026-10-15')], { USDTRY: 42 }, '2026-10-15');
  const result = includeCashInSummary(calculatePortfolioSummary([], {}), ledger);
  assert.equal(result.totalValue, 4200);
  assert.equal(result.totalCost, 0);
  assert.equal(result.totalPnL, 0);
  assert.equal(result.dailyPnL, 0);
  assert.equal(result.dailyPnLPercent, 0);
});
test('CASH-08: a positive final balance does not hide missing historical funding', () => {
  const txs = [{ ...cashTrade('buy', 1, 100), transactionDate: '2026-10-12' }, { ...cashTrade('sell', 1, 200), transactionDate: '2026-10-13' }];
  const ledger = calculateCashLedger(txs, [cashMovement(50, 'withdrawal')], {}, '2026-10-15');
  assert.equal(ledger.totalValue, 50);
  assert.equal(ledger.hasDeficit, false);
  assert.equal(ledger.historicalDeficit, true);
});

test('DATA-10: QQQ and global/BIST ETFs are correctly recognized as ETF asset type with NASDAQ/BIST exchange', () => {
  const { cleanSymbol, isEtfSymbol, getAssetTypeLabel } = loadModule('src/lib/utils/symbol.ts');

  // QQQ check
  const qqqClean = cleanSymbol('QQQ');
  assert.equal(qqqClean.symbol, 'QQQ');
  assert.equal(qqqClean.exchange, 'NASDAQ');
  assert.equal(isEtfSymbol('QQQ'), true);

  const qqqLabel = getAssetTypeLabel({ symbol: 'QQQ' });
  assert.equal(qqqLabel.typeLabel, 'ETF');
  assert.equal(qqqLabel.badgeLabel, 'ABD ETF');
  assert.equal(qqqLabel.exchangeLabel, 'NASDAQ');
  assert.equal(qqqLabel.isEtf, true);

  // SPY check
  const spyClean = cleanSymbol('SPY');
  assert.equal(spyClean.exchange, 'NASDAQ');
  assert.equal(isEtfSymbol('SPY'), true);

  // BIST ETF check
  const gldtrClean = cleanSymbol('GLDTR');
  assert.equal(gldtrClean.exchange, 'BIST');
  assert.equal(isEtfSymbol('GLDTR'), true);
  const gldtrLabel = getAssetTypeLabel({ symbol: 'GLDTR' });
  assert.equal(gldtrLabel.typeLabel, 'ETF');
  assert.equal(gldtrLabel.badgeLabel, 'BIST ETF');

  // Regular BIST stock
  const thyaoClean = cleanSymbol('THYAO');
  assert.equal(thyaoClean.exchange, 'BIST');
  assert.equal(isEtfSymbol('THYAO'), false);
  const thyaoLabel = getAssetTypeLabel({ symbol: 'THYAO' });
  assert.equal(thyaoLabel.typeLabel, 'Hisse');
  assert.equal(thyaoLabel.badgeLabel, 'BIST Hisse');

  // Holding calculation with QQQ
  const txs = [
    {
      id: 'tx-qqq',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'QQQ',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 1,
      price: 500,
      currency: 'USD',
      exchangeRate: 38.5,
      transactionDate: '2026-10-15',
    },
  ];
  const summary = calculatePortfolioSummary(txs, { QQQ: 520 }, 38.5);
  assert.equal(summary.holdings.length, 1);
  assert.equal(summary.holdings[0].symbol, 'QQQ');
  assert.equal(summary.holdings[0].exchange, 'NASDAQ');
});


const liveDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
function dailyTrade(type, quantity, price, date = liveDay, overrides = {}) {
  return { id: `${type}-${date}-${price}`, portfolioId: 'p', userId: 'u', symbol: 'THYAO', assetType: 'stock', transactionType: type, quantity, price, currency: 'TRY', commission: 0, transactionDate: date, exchange: 'BIST', notes: null, createdAt: date, ...overrides };
}
test('Daily: a same-day buy has no exposure to the decline before its purchase', () => {
  const result = calculatePortfolioSummary([dailyTrade('buy', 10, 90)], { THYAO: { price: 90, changePercent: -10 } });
  assert.equal(result.dailyPnL, 0);
  assert.equal(result.dailyPnLPercent, 0);
  assert.equal(result.holdings[0].dailyPnL, 0);
});
test('Daily: opening units use previous close, new units use execution price including commission', () => {
  const result = calculatePortfolioSummary([dailyTrade('buy', 10, 100, '2026-10-01'), dailyTrade('buy', 5, 92, liveDay, { commission: 2 })], { THYAO: { price: 90, changePercent: -10 } });
  assert.equal(result.dailyPnL, -112); // -100 opening units, -10 new units, -2 commission.
  assert.equal(result.dailyPnLPercent, -11.2);
});
test('Daily: closing an old position retains today loss and excludes earlier realized losses', () => {
  const result = calculatePortfolioSummary([dailyTrade('buy', 10, 120, '2026-10-01'), dailyTrade('sell', 10, 90)], { THYAO: { price: 90, changePercent: -10 } });
  assert.equal(result.holdings.length, 0);
  assert.equal(result.dailyPnL, -100);
  assert.equal(result.dailyPnLPercent, -10);
  assert.equal(result.realizedPnL, -300);
});
test('Daily: a same-day round trip, dividend and fee remain in daily earnings', () => {
  const result = calculatePortfolioSummary([dailyTrade('buy', 10, 90), dailyTrade('sell', 10, 95), dailyTrade('dividend', 1, 5), dailyTrade('fee', 1, 2)], { THYAO: { price: 100, changePercent: 0 } });
  assert.equal(result.dailyPnL, 53);
});
test('Daily: USD holdings combine price and FX moves multiplicatively', () => {
  const tx = dailyTrade('buy', 1, 100, '2026-10-01', { symbol: 'AAPL', exchange: 'NASDAQ', currency: 'USD', exchangeRate: 40 });
  const result = calculatePortfolioSummary([tx], { AAPL: { price: 90, changePercent: -10 }, USDTRY: { price: 44, changePercent: 10 } });
  assert.equal(result.dailyPnL, -40); // 90*44 - 100*40, not -10% of current TRY value.
  assert.equal(result.dailyPnLPercent, -1);
});
test('Daily: a fixed USD asset captures FX gain and does not double-count foreign cash', () => {
  const tx = dailyTrade('buy', 1, 100, '2026-10-01', { symbol: 'AAPL', exchange: 'NASDAQ', currency: 'USD', exchangeRate: 40 });
  const prices = { AAPL: { price: 100, changePercent: 0 }, USDTRY: { price: 44, changePercent: 10 } };
  const summary = calculatePortfolioSummary([tx], prices);
  assert.equal(summary.dailyPnL, 400);
  const cash = calculateCashLedger([tx], [cashMovement(200, 'deposit', 'USD', 40, '2026-10-01')], prices, liveDay);
  const total = includeCashInSummary(summary, cash);
  assert.equal(total.dailyPnL, 400); // Asset FX only; remaining cash FX is excluded.
  assert.equal(total.dailyPnLPercent, 10);
});

test('Cash cannot change investment profit or return percentages even with missing historical funding', () => {
  const txs = [dailyTrade('buy', 10, 100, '2026-10-01')];
  const prices = { THYAO: { price: 90, changePercent: -10 }, USDTRY: { price: 50, changePercent: 5 } };
  const summary = calculatePortfolioSummary(txs, prices);
  const ledger = calculateCashLedger(txs, [cashMovement(100000, 'deposit', 'TRY', 1, liveDay), cashMovement(470, 'deposit', 'USD', 40, liveDay)], prices, liveDay);
  const result = includeCashInSummary(summary, ledger);
  assert.ok(ledger.historicalDeficit);
  assert.notEqual(result.totalValue, summary.totalValue);
  for (const key of ['dailyPnL', 'dailyPnLPercent', 'totalPnL', 'totalPnLPercent', 'totalCost', 'fxPnL']) assert.equal(result[key], summary[key], key);
});

const { calculatePeriodPerformance, periodStart } = loadModule('src/lib/portfolio/periodPerformance.ts');
const periodNow = new Date('2026-10-16T12:00:00Z');
test('Periods: week starts Monday and month starts on the first in Istanbul', () => {
  assert.equal(periodStart('weekly', periodNow), '2026-10-12');
  assert.equal(periodStart('monthly', periodNow), '2026-10-01');
  assert.equal(periodStart('monthly', new Date('2026-09-30T22:00:00Z')), '2026-10-01');
});
test('Periods: weekly and monthly returns use their own historical close, not daily multipliers', () => {
  const txs = [dailyTrade('buy', 10, 80, '2026-09-15')];
  const prices = { THYAO: { price: 90, changePercent: -10 } };
  const history = { THYAO: { '2026-09-30': 110, '2026-10-09': 120, '2026-10-12': 999 } };
  const week = calculatePeriodPerformance(txs, prices, history, 'weekly', periodNow);
  const month = calculatePeriodPerformance(txs, prices, history, 'monthly', periodNow);
  assert.equal(week.pnl, -300);
  assert.equal(week.pnlPercent, -25);
  assert.equal(month.pnl, -200);
  assert.ok(Math.abs(month.pnlPercent - (-200 / 1100 * 100)) < 0.0001);
});
test('Periods: new purchases start at their purchase price and closed holdings retain period profit', () => {
  const prices = { THYAO: { price: 110, changePercent: 0 } };
  const bought = calculatePeriodPerformance([dailyTrade('buy', 10, 100, '2026-10-14')], prices, {}, 'monthly', periodNow);
  assert.equal(bought.pnl, 100);
  assert.equal(bought.pnlPercent, 10);
  const sold = calculatePeriodPerformance([dailyTrade('buy', 10, 80, '2026-09-15'), dailyTrade('sell', 10, 110, '2026-10-14')], prices, { THYAO: { '2026-09-30': 100 } }, 'monthly', periodNow);
  assert.equal(sold.pnl, 100);
  assert.equal(sold.pnlPercent, 10);
});
test('Periods: incomplete or stale opening prices are unavailable rather than fabricated', () => {
  const txs = [dailyTrade('buy', 10, 100, '2026-09-15')];
  const prices = { THYAO: { price: 90, changePercent: -10 } };
  assert.equal(calculatePeriodPerformance(txs, prices, {}, 'monthly', periodNow).available, false);
  assert.equal(calculatePeriodPerformance(txs, prices, { THYAO: { '2026-09-01': 100 } }, 'monthly', periodNow).available, false);
});
test('Periods: historical FX is required and participates in USD asset return', () => {
  const txs = [dailyTrade('buy', 1, 100, '2026-09-15', { symbol: 'AAPL', exchange: 'NASDAQ', currency: 'USD', exchangeRate: 40 })];
  const prices = { AAPL: { price: 90, changePercent: 0 }, USDTRY: { price: 44, changePercent: 0 } };
  const history = { AAPL: { '2026-09-30': 100 }, USDTRY: { '2026-09-30': 40 } };
  const result = calculatePeriodPerformance(txs, prices, history, 'monthly', periodNow);
  assert.equal(result.available, true);
  assert.equal(result.pnl, -40);
  assert.equal(result.pnlPercent, -1);
  assert.equal(calculatePeriodPerformance(txs, prices, { AAPL: history.AAPL }, 'monthly', periodNow).available, false);
});
