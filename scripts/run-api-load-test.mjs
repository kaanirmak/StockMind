#!/usr/bin/env node
/**
 * OPS-14: Load test runner for market and portfolio API endpoints.
 * Usage:
 *   node scripts/run-api-load-test.mjs
 *   STOCKMIND_LOAD_TEST_BASE_URL=http://127.0.0.1:3000 node scripts/run-api-load-test.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');

function loadTsModule(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const mod = { exports: {} };
  const context = {
    module: mod,
    exports: mod.exports,
    require,
    console,
    Date,
    Math,
    Map,
    Set,
    Promise,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Error,
    setTimeout,
    clearTimeout,
    performance,
  };
  vm.runInNewContext(transpiled.outputText, context, { filename: fullPath });
  return mod.exports;
}

function createLiveHttpExecutor(baseUrl) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return async (target) => {
    const url = `${cleanBase}${target.path}`;
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method: target.method,
        headers: { 'x-stockmind-loadtest': '1' },
      });
      const cacheHeader = response.headers.get('x-stockmind-cache') || response.headers.get('cf-cache-status') || '';
      const headerCalls = response.headers.get('x-provider-calls');
      const cacheHit = /hit/i.test(cacheHeader);
      const providerCalls = headerCalls !== null ? Number(headerCalls) : cacheHit ? 0 : 1;
      await response.arrayBuffer();
      return {
        ok: response.ok,
        status: response.status,
        durationMs: Math.max(0.1, performance.now() - started),
        providerCalls: Number.isFinite(providerCalls) ? providerCalls : 1,
        cacheHit,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        durationMs: Math.max(0.1, performance.now() - started),
        providerCalls: 1,
        cacheHit: false,
        error: err instanceof Error ? err.message : 'Fetch error',
      };
    }
  };
}

async function main() {
  const loadTestMod = loadTsModule('src/lib/ops/apiLoadTest.ts');
  const baseUrl = process.env.STOCKMIND_LOAD_TEST_BASE_URL?.trim();
  const jsonOutput = process.argv.includes('--json');

  const report = await loadTestMod.runApiLoadTestSuite(
    baseUrl
      ? {
          mode: 'live-http',
          baseUrl,
          executeTarget: createLiveHttpExecutor(baseUrl),
        }
      : {
          mode: 'instrumented-local',
          createExecutorForProfile: () =>
            loadTestMod.createInstrumentedCoalescingExecutor({
              ttlMs: 30_000,
              baseProviderLatencyMs: 8,
            }),
        },
  );

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `[OPS-14] Piyasa & Portföy Yük Testi Raporu (${report.mode}${report.baseUrl ? ` @ ${report.baseUrl}` : ''})`,
    );
    for (const p of report.profiles) {
      console.log(
        `\n- ${p.profile.label} (concurrency=${p.profile.concurrency}): requests=${p.totalRequests}, errorRate=${(p.errorRate * 100).toFixed(2)}%, p50=${p.latencyMs.p50}ms, p95=${p.latencyMs.p95}ms, p99=${p.latencyMs.p99}ms, providerCalls=${p.totalProviderCalls} (${p.providerCallsPerRequest}/req, dedupSavings=${(p.dedupSavingsRatio * 100).toFixed(1)}%), throughput=${p.throughputRps} req/s [${p.slaPassed ? 'PASS' : 'FAIL'}]`,
      );
      for (const t of p.byTarget) {
        console.log(
          `    • ${t.targetId} (${t.category}): n=${t.requests}, err=${t.failures}, p50=${t.latencyMs.p50}ms, p95=${t.latencyMs.p95}ms, upstreamCalls=${t.providerCalls}, cacheHits=${t.cacheHits}`,
        );
      }
      if (p.slaViolations.length > 0) {
        console.log(`    ! SLA ihlalleri: ${p.slaViolations.join('; ')}`);
      }
    }
  }

  if (!report.overallPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('OPS-14 load test failed:', err);
  process.exit(1);
});
