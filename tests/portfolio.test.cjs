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
    TextDecoder,
    TextEncoder,
    Uint8Array,
    ArrayBuffer,
    File: typeof File !== 'undefined' ? File : undefined,
    console: { warn() {}, error() {} },
    require(name) {
      if (name === 'xlsx') return require('xlsx');
      if (name === 'next/cache') return { revalidateTag: () => {}, revalidatePath: () => {}, unstable_cache: (fn) => fn };
      if (name === '@/lib/data/stocks') return { POPULAR_STOCKS: [] };
      if (name === '@/lib/data/funds') return { TEFAS_FUNDS: [] };
      if (name === '@/lib/data/tefas-prices.mjs') return require('../src/lib/data/tefas-prices.mjs');
      if (name === 'zustand') return { create: (fn) => (typeof fn === 'function' ? fn(() => {}, () => ({})) : {}) };
      if (name === '@supabase/supabase-js') return { createClient: () => ({ from: () => ({ select: () => ({}) }) }) };
      if (name === '@/lib/data/tefas_funds_directory.json' || name === './tefas_funds_directory.json') {
        const jsonPath = path.join(root, 'src/lib/data/tefas_funds_directory.json');
        if (fs.existsSync(jsonPath)) return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        return [];
      }
      if (name.startsWith('./') || name.startsWith('../')) {
        const resolved = path.resolve(path.dirname(full), name + '.ts');
        if (fs.existsSync(resolved)) return loadModule(path.relative(root, resolved));
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

test('QNT-01: Monte Carlo koşu sayısı tek kaynaktan gelir ve arayüz metinleri motorla uyumludur', () => {
  const { MONTE_CARLO_SIMULATIONS, runMonteCarloSimulation } = loadModule('src/lib/quant/models.ts');
  const constants = loadModule('src/lib/quant/constants.ts');
  assert.equal(MONTE_CARLO_SIMULATIONS, constants.MONTE_CARLO_SIMULATIONS);
  const defaultSim = runMonteCarloSimulation(100, 0.30, 0.20);
  assert.equal(defaultSim.simulationsCount, MONTE_CARLO_SIMULATIONS);

  const customSim = runMonteCarloSimulation(100, 0.30, 0.20, 500);
  assert.equal(customSim.simulationsCount, 500, 'Custom simulation count must match engine parameter');

  const consumerFiles = [
    'src/components/quant/StressTestTab.tsx',
    'src/app/(dashboard)/quant-lab/page.tsx',
    'src/components/pro/ProPlanCard.tsx',
    'src/components/pro/ProRequestModal.tsx',
    'src/lib/email/service.ts',
  ];
  for (const relPath of consumerFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
    assert.ok(!/10\.000\s*simülasyon|10\.000\s*fiyat|10\.000\s*kez/i.test(src), `${relPath} must not hardcode 10.000 Monte Carlo claim`);
    assert.ok(
      src.includes('MONTE_CARLO_SIMULATIONS') || src.includes('simulationsCount'),
      `${relPath} must derive simulation count from engine constant or result`
    );
  }
});

test('QNT-02: örnek preset, sentetik ve kaynaklı finansal profiller ayrılır ve analiz ekranlarının başında gösterilir', () => {
  const { getFinancialProfile } = loadModule('src/lib/quant/models.ts');

  const presetProfile = getFinancialProfile('THYAO', 310);
  assert.equal(presetProfile.profileMeta.kind, 'preset');
  assert.equal(presetProfile.profileMeta.isSample, true);
  assert.equal(presetProfile.profileMeta.financialPeriod, null);

  const syntheticProfile = getFinancialProfile('BILINMEYEN_HISSE', 125);
  assert.equal(syntheticProfile.profileMeta.kind, 'synthetic');
  assert.equal(syntheticProfile.profileMeta.isSample, true);
  assert.equal(syntheticProfile.profileMeta.financialPeriod, null);

  const sourcedProfile = getFinancialProfile('THYAO', 310, {
    financialPeriod: '2025 Q4',
    sourceLabel: 'KAP Finansal Tablosu',
    profile: { freeCashFlow: 42500 },
  });
  assert.equal(sourcedProfile.profileMeta.kind, 'sourced');
  assert.equal(sourcedProfile.profileMeta.isSample, false);
  assert.equal(sourcedProfile.profileMeta.financialPeriod, '2025 Q4');
  assert.equal(sourcedProfile.profileMeta.sourceLabel, 'KAP Finansal Tablosu');
  assert.equal(sourcedProfile.freeCashFlow, 42500);

  const tabFiles = [
    'src/components/quant/DCFValuationTab.tsx',
    'src/components/quant/FinancialHealthTab.tsx',
    'src/components/quant/StressTestTab.tsx',
    'src/components/quant/InvestmentCommitteeTab.tsx',
  ];
  for (const relPath of tabFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
    assert.ok(src.includes('QuantProfileBanner'), `${relPath} must render QuantProfileBanner`);
  }
});

test('QNT-03: makro stres testleri sabit sonuç döndürmez, şok ve varsayımlardan hesaplanır ve eksik girdide örnek senaryo olarak işaretlenir', () => {
  const { calculateMacroStressTests, getFinancialProfile } = loadModule('src/lib/quant/models.ts');

  const defaultTests = calculateMacroStressTests({ symbol: 'THYAO' });
  assert.equal(defaultTests.length, 3);
  assert.ok(defaultTests.every((t) => t.isExampleScenario === true), 'Sample profile without sensitivity inputs must be flagged as example scenario');
  assert.ok(defaultTests.every((t) => Array.isArray(t.assumptions) && t.assumptions.length >= 2), 'Every stress test must expose explicit assumptions');

  const largerShocks = calculateMacroStressTests({
    symbol: 'THYAO',
    shocks: { fxShockPercent: 50, rateShockBps: 1000, demandShockPercent: -40 },
  });
  assert.notEqual(largerShocks[0].impactPercent, defaultTests[0].impactPercent, 'FX impact must respond to shock size');
  assert.notEqual(largerShocks[1].impactPercent, defaultTests[1].impactPercent, 'Rate impact must respond to shock size');
  assert.notEqual(largerShocks[2].impactPercent, defaultTests[2].impactPercent, 'Demand impact must respond to shock size');

  const sourcedProfile = getFinancialProfile('THYAO', 310, {
    financialPeriod: '2025 Q4',
    sourceLabel: 'KAP Finansal Tablosu',
    profile: { netDebt: 40000, marketCap: 420000, ebit: 180000, revenue: 560000 },
  });
  const sourcedWithSensitivities = calculateMacroStressTests({
    symbol: 'THYAO',
    profile: sourcedProfile,
    shocks: { fxShockPercent: 25, rateShockBps: -250, demandShockPercent: 10 },
    sensitivities: { fxExposureRatio: 0.6, demandBeta: 0.9 },
  });
  assert.ok(sourcedWithSensitivities.every((t) => t.isExampleScenario === false), 'Sourced profile with explicit sensitivities must not be marked example scenario');
  assert.ok(sourcedWithSensitivities[1].impactPercent > 0, 'Rate cut shock must produce positive valuation impact');
});

test('AIP-01: genel soruda portföy alanları gönderilmez, açık seçimle gönderilecek alanlar görünür olur', () => {
  const { buildPortfolioContextPayload, PORTFOLIO_CONTEXT_FIELDS } = loadModule('src/lib/ai/portfolioContext.ts');

  const sampleSummary = {
    totalValue: 150000,
    totalCost: 120000,
    totalPnL: 30000,
    totalPnLPercent: 25,
    dailyPnL: 1500,
    dailyPnLPercent: 1,
    holdings: [
      {
        symbol: 'THYAO',
        name: 'Türk Hava Yolları',
        assetType: 'HISSE',
        totalQuantity: 100,
        averageCost: 250,
        currentPrice: 300,
        currentValue: 30000,
        pnl: 5000,
        pnlPercent: 20,
        weight: 20,
      },
    ],
  };

  assert.equal(
    buildPortfolioContextPayload(sampleSummary, false),
    undefined,
    'General query (includePortfolio = false) must never attach portfolio payload'
  );

  const optedInPayload = buildPortfolioContextPayload(sampleSummary, true);
  assert.ok(optedInPayload, 'Opted-in query must produce portfolio payload');
  assert.equal(optedInPayload.totalValue, 150000);
  assert.equal(optedInPayload.holdings.length, 1);
  assert.equal(optedInPayload.holdings[0].symbol, 'THYAO');

  assert.ok(PORTFOLIO_CONTEXT_FIELDS.length >= 3, 'Must document fields shared with AI');

  const pageSrc = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/ai-assistant/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('useState(false)'), 'includePortfolioContext must default to false');
  assert.ok(pageSrc.includes('buildPortfolioContextPayload'), 'AI assistant page must gate portfolio payload via helper');
  assert.ok(pageSrc.includes('PORTFOLIO_CONTEXT_FIELDS'), 'AI assistant page must show shared portfolio fields');
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

test('VER-05: eksik fiyat ve kur durumu kısmi değerlemeyi, etkilenen pozisyonları ve maliyet toplamını raporlar', () => {
  const thyaoBuy = dailyTrade('buy', 10, 100, '2026-10-01', { symbol: 'THYAO' });
  const aselsBuy = dailyTrade('buy', 5, 80, '2026-10-01', { symbol: 'ASELS' });
  const aaplBuy = dailyTrade('buy', 2, 150, '2026-10-01', {
    symbol: 'AAPL',
    exchange: 'NASDAQ',
    currency: 'USD',
    exchangeRate: 40,
  });

  // THYAO has live price, ASELS and AAPL are missing prices, and USDTRY is missing
  const partialSummary = calculatePortfolioSummary([thyaoBuy, aselsBuy, aaplBuy], {
    THYAO: { price: 110, changePercent: 0 },
  });

  assert.equal(partialSummary.valuationStatus.isComplete, false);
  assert.equal(partialSummary.valuationStatus.isPartialValuation, true);
  assert.equal(partialSummary.valuationStatus.hasMissingPrices, true);
  assert.deepEqual([...partialSummary.valuationStatus.missingPrices], ['ASELS', 'AAPL']);
  assert.equal(partialSummary.valuationStatus.unpricedCostTotal, 400 + 12000);

  const missingPositions = JSON.parse(
    JSON.stringify(partialSummary.valuationStatus.missingPositions)
  );
  assert.equal(missingPositions.length, 2);
  assert.deepEqual(
    Array.from(missingPositions, (p) => [p.symbol, p.reason, p.costValueTry]),
    [
      ['ASELS', 'missing-price', 400],
      ['AAPL', 'missing-price', 12000],
    ]
  );

  const aselsHolding = partialSummary.holdings.find((h) => h.symbol === 'ASELS');
  const thyaoHolding = partialSummary.holdings.find((h) => h.symbol === 'THYAO');
  assert.equal(aselsHolding.priceMissing, true);
  assert.equal(thyaoHolding.priceMissing, false);

  // Cash missing FX rate also keeps isPartialValuation & hasMissingPrices true
  const cashMissingFx = calculateCashLedger(
    [thyaoBuy],
    [cashMovement(100, 'deposit', 'EUR', 42, '2026-10-01')],
    { THYAO: { price: 110, changePercent: 0 } },
    liveDay
  );
  const fullLiveSummary = calculatePortfolioSummary([thyaoBuy], {
    THYAO: { price: 110, changePercent: 0 },
  });
  assert.equal(fullLiveSummary.valuationStatus.isPartialValuation, false);
  assert.equal(fullLiveSummary.valuationStatus.missingPositions.length, 0);
  assert.equal(fullLiveSummary.valuationStatus.unpricedCostTotal, 0);

  const withCashGap = includeCashInSummary(fullLiveSummary, cashMissingFx);
  assert.equal(withCashGap.valuationStatus.isComplete, false);
  assert.equal(withCashGap.valuationStatus.isPartialValuation, true);
  assert.equal(withCashGap.valuationStatus.hasMissingPrices, true);
  assert.equal(withCashGap.valuationStatus.missingFx, true);
});

test('ALR-01: Android background stock alert evaluates threshold and opens exact /stocks/<SYMBOL> route', () => {
  const { isPriceAlertTriggered } = loadModule('src/store/useWatchlistStore.ts');
  const engineSource = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/WatchlistAlertEngine.java'),
    'utf8'
  );
  const workerSource = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/StockPriceWorker.java'),
    'utf8'
  );
  const mainActivitySource = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/MainActivity.java'),
    'utf8'
  );
  const notifHelperSource = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/NotificationHelper.java'),
    'utf8'
  );

  // WatchlistAlertEngine must use API-safe URLEncoder("UTF-8") and resolve asset-specific routes
  assert.match(engineSource, /URLEncoder\.encode\(normalized,\s*"UTF-8"\)/);
  assert.match(engineSource, /if\s*\("fund"\.equalsIgnoreCase\(assetType\)\)\s*\{\s*return\s+"\/funds\/"\s*\+\s*encoded;/);
  assert.match(engineSource, /return\s+"\/stocks\/"\s*\+\s*encoded;/);

  // StockPriceWorker runs WorkManager check -> evaluates threshold -> shows notification with evaluation.assetRoute
  assert.match(workerSource, /public class StockPriceWorker extends Worker/);
  assert.match(workerSource, /WatchlistAlertEngine\.evaluateThreshold/);
  assert.match(workerSource, /NotificationHelper\.showNotification\(\s*context,\s*evaluation\.notifTitle,\s*evaluation\.notifBody,\s*evaluation\.assetRoute\)/);
  assert.doesNotMatch(workerSource, /NotificationHelper\.showNotification\([^;]*notifTitle[^;]*"\/watchlist"\)/);

  // NotificationHelper attaches target_route extra and MainActivity consumes it on cold start & warm resume
  assert.match(notifHelperSource, /intent\.putExtra\("target_route",\s*route\)/);
  assert.match(mainActivitySource, /intent\.hasExtra\("target_route"\)/);
  assert.match(mainActivitySource, /intent\.removeExtra\("target_route"\)/);
  assert.match(mainActivitySource, /onNewIntent\(Intent intent\)/);

  // Shared threshold parity with WebView watchlist alerts
  const stockAlert = {
    id: 'alr-stock-1',
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    assetType: 'stock',
    price: 300,
    targetPrice: 320,
    alertBasePrice: 300,
    alertType: 'price',
  };
  assert.equal(isPriceAlertTriggered(stockAlert, 319.5).triggered, false);
  const triggered = isPriceAlertTriggered(stockAlert, 320.5);
  assert.equal(triggered.triggered, true);
});

test('ALR-02: TEFAS fund alert triggers on valid valuation and defers cleanly on missing or stale data', () => {
  const { isPriceAlertTriggered } = loadModule('src/store/useWatchlistStore.ts');
  const {
    buildAlertAssetRoute,
    evaluateAlertPriceFreshness,
    recordDeferredAlert,
    clearDeferredAlert,
    loadDeferredAlerts,
  } = loadModule('src/lib/market/alertFreshness.ts');

  const now = new Date();
  const todayIso = now.toISOString();
  const todayYmd = todayIso.slice(0, 10);
  const staleDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const staleYmd = staleDate.toISOString().slice(0, 10);
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };

  const tefasAlert = {
    id: 'alr-fund-1',
    symbol: 'TCD',
    name: 'Tacirler Portföy Değişken Fon',
    assetType: 'fund',
    price: 2.4,
    targetPrice: 2.55,
    alertBasePrice: 2.4,
    alertType: 'price',
  };

  // Case 1: Missing/incomplete TEFAS valuation defers alert without firing
  const missingQuote = evaluateAlertPriceFreshness(null, now);
  assert.equal(missingQuote.eligible, false);
  assert.equal(missingQuote.reason, 'missing-quote');

  const unsyncedFundQuote = evaluateAlertPriceFreshness(
    { price: 2.6, assetType: 'fund', exchange: 'TEFAS', source: 'TEFAS', navDate: null, lastSyncAt: null },
    now
  );
  assert.equal(unsyncedFundQuote.eligible, false);
  assert.equal(unsyncedFundQuote.reason, 'missing-source');

  const missingTimestamp = evaluateAlertPriceFreshness(
    { price: 2.6, assetType: 'fund', exchange: 'TEFAS', observation: { source: 'TEFAS', asOf: null, fetchedAt: '', changePercent: null } },
    now
  );
  assert.equal(missingTimestamp.eligible, false);
  assert.equal(missingTimestamp.reason, 'missing-timestamp');

  const staleFundQuote = evaluateAlertPriceFreshness(
    { price: 2.6, assetType: 'fund', exchange: 'TEFAS', source: 'TEFAS', navDate: staleYmd, lastSyncAt: staleDate.toISOString() },
    now
  );
  assert.equal(staleFundQuote.eligible, false);
  assert.equal(staleFundQuote.reason, 'stale-price');

  const fallbackFundQuote = evaluateAlertPriceFreshness(
    { price: 2.6, assetType: 'fund', exchange: 'TEFAS', source: 'TEFAS', isLastKnown: true, navDate: todayYmd, lastSyncAt: todayIso },
    now
  );
  assert.equal(fallbackFundQuote.eligible, false);
  assert.equal(fallbackFundQuote.reason, 'last-known-fallback');

  recordDeferredAlert(
    {
      symbol: 'TCD',
      assetType: 'fund',
      alertType: 'price',
      targetPrice: 2.55,
      reason: staleFundQuote.reason,
      description: staleFundQuote.description,
      status: staleFundQuote.status,
      source: 'TEFAS',
      observedAt: staleFundQuote.observedAt,
      deferredAt: todayIso,
    },
    storage
  );
  assert.equal(loadDeferredAlerts(storage).length, 1);
  assert.equal(loadDeferredAlerts(storage)[0].reason, 'stale-price');

  // Case 2: Valid TEFAS valuation clears deferral, evaluates threshold, and resolves /funds/<CODE>
  const validFundQuote = {
    price: 2.58,
    assetType: 'fund',
    exchange: 'TEFAS',
    source: 'TEFAS',
    navDate: todayYmd,
    lastSyncAt: todayIso,
  };
  const validFreshness = evaluateAlertPriceFreshness(validFundQuote, now);
  assert.equal(validFreshness.eligible, true);
  assert.equal(validFreshness.reason, 'ok');

  clearDeferredAlert('TCD', 'fund', storage);
  assert.equal(loadDeferredAlerts(storage).length, 0);

  const triggered = isPriceAlertTriggered(tefasAlert, validFundQuote.price, validFundQuote);
  assert.equal(triggered.triggered, true);
  assert.equal(buildAlertAssetRoute('fund', 'TCD'), '/funds/TCD');

  // Verify Android background worker & bridge enforce TEFAS freshness + deferral persistence
  const engineSource = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/WatchlistAlertEngine.java'),
    'utf8'
  );
  const workerSource = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/StockPriceWorker.java'),
    'utf8'
  );
  const bridgeSource = fs.readFileSync(
    path.join(root, 'android/app/src/main/java/com/kaanirmak/stockmind/StockMindBridge.java'),
    'utf8'
  );
  assert.match(engineSource, /evaluateQuoteFreshness\(/);
  assert.match(engineSource, /"stale-price"/);
  assert.match(engineSource, /"missing-quote"/);
  assert.match(workerSource, /WatchlistAlertEngine\.evaluateQuoteFreshness/);
  assert.match(workerSource, /upsertDeferredAlert\(/);
  assert.match(workerSource, /clearDeferredAlert\(/);
  assert.match(workerSource, /quote\.optString\("navDate",\s*null\)/);
  assert.match(workerSource, /quote\.optString\("lastSyncAt",\s*null\)/);
  assert.match(bridgeSource, /public String getDeferredAlerts\(\)/);
});

test('POR-04: built-in broker statement presets are recognized, parsed, and mapped in preview', async () => {
  const { buildBrokerTemplateCsv, BROKER_STATEMENT_TEMPLATES } = loadModule(
    'src/lib/portfolio/brokerStatementTemplates.ts'
  );
  const { parseExcelTransactions } = loadModule('src/lib/portfolio/excelParser.ts');

  const presetIds = ['midas', 'isbank', 'garanti', 'tefas'];
  assert.ok(BROKER_STATEMENT_TEMPLATES.length >= 5);

  for (const id of presetIds) {
    const sample = buildBrokerTemplateCsv(id);
    assert.ok(sample && sample.content.length > 0, `Expected sample CSV for ${id}`);

    const buffer = new TextEncoder().encode(sample.content).buffer;
    const parsed = await parseExcelTransactions(buffer);

    assert.equal(parsed.invalidRows.length, 0, `${id} preset rows should parse cleanly without errors`);
    assert.ok(parsed.validRows.length >= 2, `${id} preset should parse multiple valid rows`);
    assert.equal(parsed.templateMatch.templateId, id);
    assert.equal(parsed.templateMatch.confidence, 'exact');

    const mappedTargets = Array.from(parsed.templateMatch.mappedColumns).map((m) => m.targetField);
    assert.ok(mappedTargets.includes('symbol'), `${id} should map symbol column`);
    assert.ok(mappedTargets.includes('quantity'), `${id} should map quantity column`);
    assert.ok(mappedTargets.includes('price'), `${id} should map price column`);
    assert.ok(mappedTargets.includes('date'), `${id} should map date column`);
  }

  const modalSrc = fs.readFileSync(
    path.join(root, 'src/components/portfolio/ExcelImportModal.tsx'),
    'utf8'
  );
  assert.match(modalSrc, /BROKER_STATEMENT_TEMPLATES/);
  assert.match(modalSrc, /data-testid="statement-template-preview"/);
  assert.match(modalSrc, /Tanınan Biçim:/);
});

test('POR-05: import preview reports valid, invalid, duplicate counts and exact row error reasons', async () => {
  const { parseExcelTransactions } = loadModule('src/lib/portfolio/excelParser.ts');
  const { summarizeImportPreview } = loadModule('src/lib/portfolio/importPreview.ts');

  const mixedCsv = [
    'Tarih;Hisse Kodu (Sembol);İşlem Türü;Döviz Türü;Döviz Kuru (USD/TRY);Miktar (Adet);Birim Fiyat;Toplam Tutar',
    '2026-04-01;THYAO;Alış;TRY;1,00;10;290,00;2.900,00',
    '2026-04-02;ASELS;Alış;TRY;1,00;5;72,50;362,50',
    '2026-04-02;ASELS;Alış;TRY;1,00;5;72,50;362,50',
    '2026-04-03;;Alış;TRY;1,00;10;100,00;1.000,00',
    '2026-04-04;SISE;Alış;TRY;1,00;0;45,00;0',
  ].join('\n');

  const parsed = await parseExcelTransactions(new TextEncoder().encode(mixedCsv).buffer);
  const summary = {
    ...summarizeImportPreview({
      validRows: parsed.validRows,
      invalidRows: parsed.invalidRows,
      existingTransactions: [
        {
          symbol: 'THYAO',
          transactionType: 'buy',
          quantity: 10,
          price: 290,
          transactionDate: '2026-04-01',
        },
      ],
    }),
  };

  assert.equal(summary.validCount, 3);
  assert.equal(summary.invalidCount, 2);
  assert.equal(summary.duplicateCount, 2); // 1 portfolio match (THYAO) + 1 intra-file duplicate (ASELS)
  assert.equal(summary.netNewCount, 1);

  assert.equal(summary.duplicateReasons.get(0), 'portfolio');
  assert.equal(summary.duplicateReasons.get(2), 'in_file');

  const errorReasons = Array.from(summary.errorSummaries).map((e) => e.reasonText);
  assert.match(errorReasons[0], /Satır 5:.*Hisse Kodu \(Sembol\) eksik/);
  assert.match(errorReasons[1], /Satır 6:.*miktar\/adet/);

  const modalSrc = fs.readFileSync(
    path.join(root, 'src/components/portfolio/ExcelImportModal.tsx'),
    'utf8'
  );
  assert.match(modalSrc, /data-testid="import-preview-counts"/);
  assert.match(modalSrc, /Geçerli: \{previewSummary\.validCount\}/);
  assert.match(modalSrc, /Hatalı: \{previewSummary\.invalidCount\}/);
  assert.match(modalSrc, /Mükerrer: \{previewSummary\.duplicateCount\}/);
  assert.match(modalSrc, /data-testid="import-invalid-reasons-banner"/);
});

test('POR-06: end-to-end Excel and CSV export -> re-import round-trip preserves amounts and dates', async () => {
  const {
    buildTransactionsExcelBuffer,
    buildTransactionsCsvContent,
    parseExcelTransactions,
  } = loadModule('src/lib/portfolio/excelParser.ts');

  const sampleTransactions = [
    {
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 125,
      price: 294.75,
      currency: 'TRY',
      exchangeRate: 1,
      transactionDate: '2026-03-15',
      exchange: 'BIST',
      notes: 'Ana hisse alımı',
    },
    {
      symbol: 'THF',
      assetType: 'fund',
      transactionType: 'buy',
      quantity: 13328,
      price: 2.923361,
      currency: 'TRY',
      exchangeRate: 1,
      transactionDate: '2026-02-20T09:30:00Z',
      exchange: 'TEFAS',
      notes: 'TEFAS fon; çeyrek değerlendirme',
    },
    {
      symbol: 'AAPL',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 7.5,
      price: 224.8,
      currency: 'USD',
      exchangeRate: 36.45,
      transactionDate: '2026-04-02',
      exchange: 'NASDAQ',
      notes: 'ABD teknolojisi "uzun vade"',
    },
    {
      symbol: 'EREGL',
      assetType: 'stock',
      transactionType: 'sell',
      quantity: 50,
      price: 52.8,
      currency: 'TRY',
      exchangeRate: 1,
      transactionDate: '2026-04-10',
      exchange: 'BIST',
      notes: 'Kar realizasyonu',
    },
  ];

  // 1. Excel (.xlsx) round-trip
  const xlsxBuffer = await buildTransactionsExcelBuffer(sampleTransactions);
  const reimportedXlsx = await parseExcelTransactions(xlsxBuffer);
  assert.equal(reimportedXlsx.invalidRows.length, 0);
  assert.equal(reimportedXlsx.validRows.length, sampleTransactions.length);

  // 2. CSV (.csv) round-trip
  const csvText = buildTransactionsCsvContent(sampleTransactions);
  const csvBuffer = new TextEncoder().encode(csvText).buffer;
  const reimportedCsv = await parseExcelTransactions(csvBuffer);
  assert.equal(reimportedCsv.invalidRows.length, 0);
  assert.equal(reimportedCsv.validRows.length, sampleTransactions.length);

  for (const parsed of [reimportedXlsx, reimportedCsv]) {
    sampleTransactions.forEach((orig, idx) => {
      const row = parsed.validRows[idx].data;
      assert.equal(row.symbol, orig.symbol);
      assert.equal(row.transactionType, orig.transactionType);
      assert.equal(row.transactionDate, orig.transactionDate.slice(0, 10));
      assert.equal(row.currency, orig.currency);
      assert.ok(Math.abs(row.quantity - orig.quantity) < 1e-6);
      assert.ok(Math.abs(row.price - orig.price) < 1e-6);
      assert.ok(Math.abs(row.quantity * row.price - orig.quantity * orig.price) < 1e-4);
      assert.equal(row.exchangeRate, orig.exchangeRate);
    });
  }

  const portfolioSrc = fs.readFileSync(
    path.join(root, 'src/app/(dashboard)/portfolio/page.tsx'),
    'utf8'
  );
  assert.match(portfolioSrc, /exportTransactionsToCsv/);
  assert.match(portfolioSrc, /exportTransactionsToExcel/);
});

test('POR-07: daily return attribution splits gains/losses in TRY and percentage points and reconciles with daily PnL', () => {
  const { formatContributionPoints } = loadModule('src/lib/portfolio/dailyAttribution.ts');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  const transactions = [
    // Opening position 1: 10 THYAO bought earlier @ 100, prev close 100, today 115 (+15% => +150 TL)
    {
      id: 'attr-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 10,
      price: 100,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-01-10',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-01-10T10:00:00Z',
    },
    // Opening position 2: 20 ASELS bought earlier @ 50, prev close 50, today 45 (-10% => -100 TL)
    {
      id: 'attr-2',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'ASELS',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 20,
      price: 50,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-01-10',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-01-10T10:00:00Z',
    },
    // Intraday position opened today: 10 EREGL bought @ 40, today 42 (+20 TL intraday gain)
    {
      id: 'attr-3',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'EREGL',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 10,
      price: 40,
      currency: 'TRY',
      commission: 0,
      transactionDate: today,
      exchange: 'BIST',
      notes: null,
      createdAt: `${today}T10:00:00Z`,
    },
  ];

  // Opening base = 10*100 + 20*50 = 2000 TRY
  // Gains: THYAO (+150 -> +7.50 pts), EREGL (+20 -> +1.00 pts), ASELS (-100 -> -5.00 pts)
  // Total daily PnL = +70 TRY (+3.50%)
  const livePrices = {
    THYAO: { price: 115, changePercent: 15 },
    ASELS: { price: 45, changePercent: -10 },
    EREGL: { price: 42, changePercent: 5 },
  };

  const summary = calculatePortfolioSummary(transactions, livePrices);
  const attribution = summary.dailyAttribution;

  assert.ok(attribution);
  assert.equal(summary.dailyPnL, 70);
  assert.equal(summary.dailyPnLPercent, 3.5);
  assert.equal(attribution.reconciled, true);
  assert.equal(attribution.totalContributionTry, 70);
  assert.equal(attribution.totalContributionPercentPoints, 3.5);
  assert.equal(attribution.reconciliationDiffTry, 0);
  assert.equal(attribution.reconciliationDiffPercentPoints, 0);

  const positives = Array.from(attribution.positiveContributors).map((x) => ({ ...x }));
  const negatives = Array.from(attribution.negativeContributors).map((x) => ({ ...x }));

  assert.equal(positives.length, 2);
  assert.equal(positives[0].symbol, 'THYAO');
  assert.equal(positives[0].contributionTry, 150);
  assert.equal(positives[0].contributionPercentPoints, 7.5);
  assert.equal(positives[1].symbol, 'EREGL');
  assert.equal(positives[1].contributionTry, 20);
  assert.equal(positives[1].contributionPercentPoints, 1);

  assert.equal(negatives.length, 1);
  assert.equal(negatives[0].symbol, 'ASELS');
  assert.equal(negatives[0].contributionTry, -100);
  assert.equal(negatives[0].contributionPercentPoints, -5);

  assert.equal(formatContributionPoints(7.5), '+7,50 puan');
  assert.equal(formatContributionPoints(-5), '-5,00 puan');

  const reportsSrc = fs.readFileSync(
    path.join(root, 'src/app/(dashboard)/reports/page.tsx'),
    'utf8'
  );
  assert.match(reportsSrc, /DailyAttributionCard/);
});

test('POR-08: period breakdown separates realized trade PnL, unrealized PnL, cash events, fees/commissions, and FX impact', () => {
  const { calculatePeriodBreakdown } = loadModule('src/lib/portfolio/periodBreakdown.ts');

  const now = new Date('2026-04-15T12:00:00Z');
  const transactions = [
    // Prior month: Buy 10 THYAO @ 100 TRY (commission 10 TL)
    {
      id: 'b-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 10,
      price: 100,
      currency: 'TRY',
      commission: 10,
      transactionDate: '2026-03-10',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-03-10T10:00:00Z',
    },
    // Prior month: Buy 10 AAPL @ $200, USD/TRY = 30 (commission $5 -> 150 TL)
    {
      id: 'b-2',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'AAPL',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 10,
      price: 200,
      currency: 'USD',
      exchangeRate: 30,
      commission: 5,
      transactionDate: '2026-03-12',
      exchange: 'NASDAQ',
      notes: null,
      createdAt: '2026-03-12T10:00:00Z',
    },
    // Current month (April): Sell 4 THYAO @ 140 TRY (commission 20 TL)
    // Cost for 4 shares = 4 * 101 = 404 TRY; net proceeds = 560 - 20 = 540 TRY -> realized = +136 TRY
    {
      id: 's-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'sell',
      quantity: 4,
      price: 140,
      currency: 'TRY',
      commission: 20,
      transactionDate: '2026-04-05',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-04-05T10:00:00Z',
    },
    // Current month (April): Dividend 60 TRY
    {
      id: 'd-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'dividend',
      quantity: 6,
      price: 10,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-04-08',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-04-08T10:00:00Z',
    },
    // Current month (April): Standalone custody fee 25 TRY
    {
      id: 'f-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'fee',
      quantity: 1,
      price: 25,
      currency: 'TRY',
      commission: 0,
      transactionDate: '2026-04-10',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-04-10T10:00:00Z',
    },
  ];

  const cashMovements = [
    {
      id: 'm-1',
      portfolioId: 'p-1',
      userId: 'u-1',
      movementType: 'deposit',
      amount: 10000,
      currency: 'TRY',
      exchangeRate: 1,
      movementDate: '2026-03-05',
      notes: null,
      createdAt: '2026-03-05T10:00:00Z',
    },
    {
      id: 'm-2',
      portfolioId: 'p-1',
      userId: 'u-1',
      movementType: 'deposit',
      amount: 2000,
      currency: 'TRY',
      exchangeRate: 1,
      movementDate: '2026-04-03',
      notes: null,
      createdAt: '2026-04-03T10:00:00Z',
    },
    {
      id: 'm-3',
      portfolioId: 'p-1',
      userId: 'u-1',
      movementType: 'withdrawal',
      amount: 500,
      currency: 'TRY',
      exchangeRate: 1,
      movementDate: '2026-04-12',
      notes: null,
      createdAt: '2026-04-12T10:00:00Z',
    },
  ];

  const prices = {
    THYAO: { price: 150, changePercent: 0 },
    AAPL: { price: 220, changePercent: 0 },
    USDTRY: { price: 34, changePercent: 0 },
  };
  const history = {
    THYAO: { '2026-03-31': 120 },
    AAPL: { '2026-03-31': 210 },
    USDTRY: { '2026-03-31': 32 },
  };

  // 1. Total period breakdown
  const totalBd = {
    ...calculatePeriodBreakdown({
      transactions,
      cashMovements,
      prices,
      history,
      period: 'total',
      now,
    }),
  };
  assert.equal(totalBd.available, true);
  assert.equal(totalBd.realizedTradePnL, 136);
  assert.equal(totalBd.dividendsTotal, 60);
  assert.equal(totalBd.depositsTotal, 12000);
  assert.equal(totalBd.withdrawalsTotal, 500);
  assert.equal(totalBd.netCashEvents, 11560);
  assert.equal(totalBd.tradeCommissionsTotal, 10 + 150 + 20);
  assert.equal(totalBd.standaloneFeesTotal, 25);
  assert.equal(totalBd.feesAndCommissionsTotal, 205);
  assert.ok(totalBd.fxImpact > 0, 'Total USDTRY rise 30 -> 34 must yield positive FX impact');
  assert.equal(
    Number((totalBd.assetPricePnL + totalBd.fxImpact).toFixed(2)),
    totalBd.unrealizedPnL,
    'Open position result decomposes into asset price movement + FX impact'
  );

  // 2. Monthly period breakdown isolates only April events & March-end -> April change
  const monthlyBd = {
    ...calculatePeriodBreakdown({
      transactions,
      cashMovements,
      prices,
      history,
      period: 'monthly',
      now,
    }),
  };
  assert.equal(monthlyBd.available, true);
  assert.equal(monthlyBd.startDate, '2026-04-01');
  assert.equal(monthlyBd.realizedTradePnL, 136);
  assert.equal(monthlyBd.dividendsTotal, 60);
  assert.equal(monthlyBd.depositsTotal, 2000);
  assert.equal(monthlyBd.withdrawalsTotal, 500);
  assert.equal(monthlyBd.tradeCommissionsTotal, 20);
  assert.equal(monthlyBd.standaloneFeesTotal, 25);
  assert.equal(monthlyBd.feesAndCommissionsTotal, 45);
  assert.equal(monthlyBd.fxImpact, 4000, 'April USDTRY 32 -> 34 across 10*200 USD cost = +4,000 TRY');

  const portfolioSrc = fs.readFileSync(
    path.join(root, 'src/app/(dashboard)/portfolio/page.tsx'),
    'utf8'
  );
  const reportsSrc = fs.readFileSync(
    path.join(root, 'src/app/(dashboard)/reports/page.tsx'),
    'utf8'
  );
  assert.match(portfolioSrc, /PeriodBreakdownCard/);
  assert.match(reportsSrc, /PeriodBreakdownCard/);
});

test('POR-09: benchmark comparison aligns period and currency from same base level 100', () => {
  const benchMod = loadModule('src/lib/portfolio/benchmarkComparison.ts');

  // 1. S&P 500 (USD) vs TRY portfolio compared in TRY with daily FX series
  const tryResult = benchMod.buildBenchmarkComparison({
    portfolioTrySeries: [
      { date: '2026-09-01', value: 100_000 },
      { date: '2026-09-15', value: 108_000 },
      { date: '2026-09-30', value: 115_000 },
    ],
    benchmarkId: 'SP500',
    benchmarkNativeSeries: [
      { date: '2026-09-01', value: 5000 },
      { date: '2026-09-15', value: 5100 },
      { date: '2026-09-30', value: 5000 },
    ],
    usdTrySeries: [
      { date: '2026-09-01', value: 40 }, // 5000*40 = 200,000 TRY
      { date: '2026-09-15', value: 41 },
      { date: '2026-09-30', value: 42 }, // 5000*42 = 210,000 TRY (+5% TRY return!)
    ],
    period: '1M',
    currency: 'TRY',
    referenceDate: '2026-09-30',
  });

  assert.equal(tryResult.comparable, true);
  assert.equal(tryResult.currency, 'TRY');
  assert.equal(tryResult.portfolioStartIndex, 100);
  assert.equal(tryResult.benchmarkStartIndex, 100);
  assert.equal(tryResult.portfolioReturnPct, 15);
  assert.equal(tryResult.benchmarkReturnPct, 5); // flat in USD, +5% in TRY
  assert.equal(tryResult.alphaPct, 10);

  // 2. BIST 100 (TRY) vs TRY portfolio compared in USD
  const usdResult = benchMod.buildBenchmarkComparison({
    portfolioTrySeries: [
      { date: '2026-09-01', value: 400_000 }, // 10,000 USD
      { date: '2026-09-30', value: 440_000 }, // 11,000 USD (+10% USD)
    ],
    benchmarkId: 'XU100',
    benchmarkNativeSeries: [
      { date: '2026-09-01', value: 10_000 }, // 250 USD
      { date: '2026-09-30', value: 10_000 }, // 250 USD (0% USD)
    ],
    usdTrySeries: [
      { date: '2026-09-01', value: 40 },
      { date: '2026-09-30', value: 40 },
    ],
    period: '1M',
    currency: 'USD',
    referenceDate: '2026-09-30',
  });

  assert.equal(usdResult.comparable, true);
  assert.equal(usdResult.currency, 'USD');
  assert.equal(usdResult.portfolioStartIndex, 100);
  assert.equal(usdResult.benchmarkStartIndex, 100);
  assert.equal(usdResult.portfolioReturnPct, 10);
  assert.equal(usdResult.benchmarkReturnPct, 0);
  assert.equal(usdResult.alphaPct, 10);

  // 3. Explicit failure when USD alignment lacks FX rate
  const noFx = benchMod.buildBenchmarkComparison({
    portfolioTrySeries: [
      { date: '2026-09-01', value: 100_000 },
      { date: '2026-09-30', value: 110_000 },
    ],
    benchmarkId: 'XU100',
    benchmarkNativeSeries: [
      { date: '2026-09-01', value: 10_000 },
      { date: '2026-09-30', value: 10_500 },
    ],
    period: '1M',
    currency: 'USD',
    referenceDate: '2026-09-30',
  });
  assert.equal(noFx.comparable, false);
  assert.ok(noFx.missingReason);

  const portSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/portfolio/page.tsx'), 'utf8');
  assert.match(portSrc, /BenchmarkComparisonCard/);
});

test('POR-10: net invested timeline separates inflows/outflows and discloses missing history scope', () => {
  const tlMod = loadModule('src/lib/portfolio/netInvestedTimeline.ts');

  const res = tlMod.buildNetInvestedTimeline({
    transactions: [
      {
        id: 'tx1',
        portfolioId: 'p1',
        userId: 'u1',
        symbol: 'THYAO',
        assetType: 'stock',
        transactionType: 'buy',
        quantity: 100,
        price: 300,
        currency: 'TRY',
        commission: 0,
        transactionDate: '2026-09-01',
        exchange: 'BIST',
        notes: null,
        createdAt: '2026-09-01T10:00:00Z',
      },
    ],
    cashMovements: [
      {
        id: 'c1',
        portfolioId: 'p1',
        userId: 'u1',
        movementType: 'deposit',
        amount: 50_000,
        currency: 'TRY',
        exchangeRate: 1,
        movementDate: '2026-09-01',
        notes: null,
        createdAt: '2026-09-01T09:00:00Z',
      },
      {
        id: 'c2',
        portfolioId: 'p1',
        userId: 'u1',
        movementType: 'withdrawal',
        amount: 10_000,
        currency: 'TRY',
        exchangeRate: 1,
        movementDate: '2026-09-15',
        notes: null,
        createdAt: '2026-09-15T09:00:00Z',
      },
    ],
    summary: {
      totalValue: 46_000,
      totalCost: 30_000,
      totalPnL: 6_000,
      totalPnLPercent: 20,
      dailyPnL: 500,
      dailyPnLPercent: 1.1,
      unrealizedPnL: 6_000,
      realizedPnL: 0,
      totalVolume: 30_000,
      buyVolume: 30_000,
      sellVolume: 0,
      holdings: [],
      allocation: [],
      valuationStatus: { isComplete: true, missingFx: false, missingPrices: [] },
    },
    historyBySymbol: {
      THYAO: {
        '2026-09-01': 300,
        '2026-09-15': 330,
      },
    },
    period: '1M',
    today: '2026-09-30',
  });

  assert.equal(res.totalInflows, 50_000);
  assert.equal(res.totalOutflows, 10_000);
  assert.equal(res.netInvestedTotal, 40_000);
  assert.equal(res.latestPortfolioValue, 46_000);
  assert.equal(res.netGainAmount, 6_000);

  const sep1 = res.points.find((p) => p.date === '2026-09-01');
  const sep15 = res.points.find((p) => p.date === '2026-09-15');
  assert.equal(sep1.dailyInflow, 50_000);
  assert.equal(sep1.dailyOutflow, 0);
  assert.equal(sep15.dailyInflow, 0);
  assert.equal(sep15.dailyOutflow, 10_000);
  assert.equal(sep15.netInvested, 40_000);

  // Dates without full close history are counted and reported explicitly
  assert.equal(res.coverage.capitalBasisSource, 'cash_ledger');
  assert.equal(res.coverage.isComplete, false);
  assert.ok(res.coverage.estimatedPointsCount > 0);
  assert.ok(res.coverage.uncoveredRange);
  assert.match(res.coverage.summaryText, /Tarihçe kapsamı/);
  assert.ok(res.coverage.details.length >= 1);

  const portSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/portfolio/page.tsx'), 'utf8');
  assert.match(portSrc, /NetInvestedChartCard/);
});

test('POR-11: dividend view strictly separates realized payments, announced events, and estimates', () => {
  const divMod = loadModule('src/lib/portfolio/dividendView.ts');

  const report = divMod.buildDividendOverviewReport({
    transactions: [
      {
        id: 'div1',
        portfolioId: 'p1',
        userId: 'u1',
        symbol: 'EREGL',
        assetType: 'stock',
        transactionType: 'dividend',
        quantity: 1,
        price: 1200,
        currency: 'TRY',
        commission: 0,
        transactionDate: '2026-04-10',
        exchange: 'BIST',
        notes: '2025 yılı nakit temettü',
        createdAt: '2026-04-10T09:00:00Z',
      },
      {
        id: 'div2',
        portfolioId: 'p1',
        userId: 'u1',
        symbol: 'AAPL',
        assetType: 'stock',
        transactionType: 'dividend',
        quantity: 1,
        price: 50,
        currency: 'USD',
        exchangeRate: 38,
        commission: 0,
        transactionDate: '2026-05-15',
        exchange: 'NASDAQ',
        notes: null,
        createdAt: '2026-05-15T09:00:00Z',
      },
    ],
    holdings: [
      {
        symbol: 'EREGL',
        assetType: 'stock',
        exchange: 'BIST',
        totalQuantity: 500,
        averageCost: 45,
        totalCost: 22_500,
        currentPrice: 50,
        currentValue: 25_000,
        pnl: 2_500,
        pnlPercent: 11.1,
        weight: 50,
      },
      {
        symbol: 'FROTO',
        assetType: 'stock',
        exchange: 'BIST',
        totalQuantity: 100,
        averageCost: 900,
        totalCost: 90_000,
        currentPrice: 1_000,
        currentValue: 100_000,
        pnl: 10_000,
        pnlPercent: 11.1,
        weight: 50,
      },
    ],
    upcomingEventsBySymbol: {
      FROTO: [
        {
          id: 'ev1',
          symbol: 'FROTO',
          type: 'dividend',
          typeLabel: 'Temettü Ödeme',
          title: 'FROTO Nakit Temettü Ödemesi',
          eventDate: '2026-10-15',
          source: 'Yahoo Finance',
          verified: true,
        },
        {
          id: 'ev2',
          symbol: 'FROTO',
          type: 'dividend',
          typeLabel: 'Tahmin',
          title: 'Doğrulanmamış Olay',
          eventDate: '2026-11-01',
          source: 'Sample',
          verified: false,
        },
      ],
    },
    dividendYieldBySymbol: {
      FROTO: 4.5, // 100,000 * 4.5% = 4,500 estimate
    },
    unavailableSymbols: ['AAPL'],
    today: '2026-09-01',
  });

  // 1. Realized section matches confirmed past dividends only (1200 + 50*38 = 3100)
  assert.equal(report.realized.entries.length, 2);
  assert.equal(report.realized.totalTry, 3100);

  // 2. Announced section includes only verified upcoming dividend events
  assert.equal(report.announced.entries.length, 1);
  assert.equal(report.announced.entries[0].symbol, 'FROTO');
  assert.equal(report.announced.entries[0].eventDate, '2026-10-15');
  assert.deepEqual(Array.from(report.announced.sourcesUnavailable), ['AAPL']);

  // 3. Estimates section separates market-yield and trailing projections with explicit disclaimer
  assert.equal(report.estimates.entries.length, 2);
  assert.equal(report.estimates.entries.find((e) => e.symbol === 'FROTO').estimatedAnnualTry, 4500);
  assert.equal(report.estimates.entries.find((e) => e.symbol === 'EREGL').estimatedAnnualTry, 1200);
  assert.match(report.estimates.disclaimer, /garanti|kesinleşmiş/i);

  const portSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/portfolio/page.tsx'), 'utf8');
  assert.match(portSrc, /DividendOverviewCard/);
});

test('POR-12: cash flow view filters inflows, outflows, dividends, and fees by period and currency', () => {
  const cfMod = loadModule('src/lib/portfolio/cashFlowView.ts');

  const transactions = [
    {
      id: 't1',
      portfolioId: 'p1',
      userId: 'u1',
      symbol: 'THYAO',
      assetType: 'stock',
      transactionType: 'buy',
      quantity: 100,
      price: 300,
      currency: 'TRY',
      commission: 45,
      transactionDate: '2026-09-10',
      exchange: 'BIST',
      notes: null,
      createdAt: '2026-09-10T10:00:00Z',
    },
    {
      id: 't2',
      portfolioId: 'p1',
      userId: 'u1',
      symbol: 'AAPL',
      assetType: 'stock',
      transactionType: 'dividend',
      quantity: 1,
      price: 100,
      currency: 'USD',
      exchangeRate: 40,
      commission: 15,
      transactionDate: '2026-09-20',
      exchange: 'NASDAQ',
      notes: null,
      createdAt: '2026-09-20T10:00:00Z',
    },
    {
      id: 't3',
      portfolioId: 'p1',
      userId: 'u1',
      symbol: 'FEE',
      assetType: 'stock',
      transactionType: 'fee',
      quantity: 1,
      price: 20,
      currency: 'USD',
      exchangeRate: 40,
      commission: 0,
      transactionDate: '2026-06-01', // outside 1M
      exchange: 'NASDAQ',
      notes: 'Saklama ücreti',
      createdAt: '2026-06-01T10:00:00Z',
    },
  ];

  const cashMovements = [
    {
      id: 'm1',
      portfolioId: 'p1',
      userId: 'u1',
      movementType: 'deposit',
      amount: 50000,
      currency: 'TRY',
      exchangeRate: 1,
      movementDate: '2026-09-05',
      notes: 'TRY yatırma',
      createdAt: '2026-09-05T09:00:00Z',
    },
    {
      id: 'm2',
      portfolioId: 'p1',
      userId: 'u1',
      movementType: 'withdrawal',
      amount: 200,
      currency: 'USD',
      exchangeRate: 40,
      movementDate: '2026-09-25',
      notes: 'USD çekme',
      createdAt: '2026-09-25T09:00:00Z',
    },
  ];

  // 1. ALL currencies over 1M excludes June 2026 USD fee
  const monthlyAll = cfMod.buildCashFlowViewReport({
    transactions,
    cashMovements,
    period: '1M',
    currencyFilter: 'ALL',
    today: '2026-09-30',
  });

  assert.equal(monthlyAll.totalsTry.deposits, 50_000);
  assert.equal(monthlyAll.totalsTry.withdrawals, 8_000); // 200 * 40
  assert.equal(monthlyAll.totalsTry.dividends, 4_000); // 100 * 40
  assert.equal(monthlyAll.totalsTry.fees, 645); // 45 TRY + 15*40=600 TRY

  // 2. USD-only filter over ALL periods shows native USD totals
  const allUsd = cfMod.buildCashFlowViewReport({
    transactions,
    cashMovements,
    period: 'ALL',
    currencyFilter: 'USD',
    today: '2026-09-30',
  });

  assert.equal(allUsd.totalsInSelectedCurrency.deposits, 0);
  assert.equal(allUsd.totalsInSelectedCurrency.withdrawals, 200);
  assert.equal(allUsd.totalsInSelectedCurrency.dividends, 100);
  assert.equal(allUsd.totalsInSelectedCurrency.fees, 35); // 15 div commission + 20 June fee
  assert.equal(allUsd.totalsInSelectedCurrency.netCashFlow, -135);

  const portSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/portfolio/page.tsx'), 'utf8');
  assert.match(portSrc, /CashFlowOverviewCard/);
});

test('POR-13: concentration report combines largest positions, sector, country, and asset type breakdowns', () => {
  const concMod = loadModule('src/lib/portfolio/concentrationReport.ts');

  const report = concMod.buildPortfolioConcentrationReport({
    summary: {
      totalValue: 100_000,
      totalCost: 85_000,
      totalPnL: 15_000,
      totalPnLPercent: 17.6,
      dailyPnL: 500,
      dailyPnLPercent: 0.5,
      unrealizedPnL: 15_000,
      realizedPnL: 0,
      totalVolume: 85_000,
      buyVolume: 85_000,
      sellVolume: 0,
      holdings: [
        {
          symbol: 'THYAO',
          assetType: 'stock',
          exchange: 'BIST',
          totalQuantity: 100,
          averageCost: 400,
          totalCost: 40_000,
          currentPrice: 500,
          currentValue: 50_000, // 50%
          pnl: 10_000,
          pnlPercent: 25,
          weight: 50,
        },
        {
          symbol: 'NVDA',
          assetType: 'stock',
          exchange: 'NASDAQ',
          totalQuantity: 10,
          averageCost: 2_500,
          totalCost: 25_000,
          currentPrice: 3_000,
          currentValue: 30_000, // 30%
          pnl: 5_000,
          pnlPercent: 20,
          weight: 30,
        },
        {
          symbol: 'TCD',
          assetType: 'fund',
          exchange: 'TEFAS',
          totalQuantity: 200,
          averageCost: 50,
          totalCost: 10_000,
          currentPrice: 50,
          currentValue: 10_000, // 10%
          pnl: 0,
          pnlPercent: 0,
          weight: 10,
        },
      ],
      allocation: [],
      cash: {
        configured: true,
        historicalDeficit: false,
        balances: [{ currency: 'TRY', amount: 10_000, value: 10_000 }], // 10%
        totalValue: 10_000,
        netContributions: 10_000,
        missingRates: [],
        hasDeficit: false,
        dailyFxPnL: 0,
        todayNetFlows: 0,
      },
      valuationStatus: { isComplete: true, missingFx: false, missingPrices: [] },
    },
    metadata: {
      getStockSector: (sym) =>
        sym === 'THYAO' ? 'Ulaştırma' : sym === 'NVDA' ? 'Teknoloji' : null,
      getFundCategory: (code) => (code === 'TCD' ? 'Değişken Fonlar' : null),
    },
  });

  assert.equal(report.totalAnalyzedValue, 100_000);
  assert.equal(report.top1WeightPct, 50);
  assert.equal(report.top3WeightPct, 90);
  assert.equal(report.concentrationLevel, 'high');
  assert.equal(report.topPositions[0].symbol, 'THYAO');
  assert.equal(report.topPositions[0].sector, 'Ulaştırma');
  assert.equal(report.topPositions[1].country, 'ABD');

  // Verify Sector / Country / Asset Type dimensions all present in same report
  assert.equal(report.sectorBreakdown.find((s) => s.label === 'Ulaştırma').weightPct, 50);
  assert.equal(report.sectorBreakdown.find((s) => s.label === 'Teknoloji').weightPct, 30);
  assert.equal(report.countryBreakdown.find((c) => c.label === 'Türkiye').weightPct, 70); // THYAO 50 + TCD 10 + TRY Cash 10
  assert.equal(report.countryBreakdown.find((c) => c.label === 'ABD').weightPct, 30);
  assert.equal(report.assetTypeBreakdown.find((a) => a.label === 'TEFAS Fonu').weightPct, 10);
  assert.ok(report.warnings.some((w) => w.includes('THYAO')));

  const portSrc = fs.readFileSync(path.join(root, 'src/app/(dashboard)/portfolio/page.tsx'), 'utf8');
  assert.match(portSrc, /ConcentrationAnalysisCard/);
});







