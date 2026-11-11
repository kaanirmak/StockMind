#!/usr/bin/env node
/**
 * OPS-13: Tracks ESLint errors, high-impact bug/hook/a11y warnings, and total warning budget.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

export const BASELINE_TOTAL_WARNINGS = 489;
export const MAX_TOTAL_WARNINGS = 455;
export const HIGH_IMPACT_RULES = [
  'react-hooks/exhaustive-deps',
  'react-hooks/immutability',
  'react-hooks/purity',
  'react-hooks/preserve-manual-memoization',
  'prefer-const',
];

export function evaluateEslintReport(results, options = {}) {
  const maxWarnings = options.maxWarnings ?? MAX_TOTAL_WARNINGS;
  let errorCount = 0;
  let warningCount = 0;
  const byRule = {};

  for (const fileResult of results) {
    errorCount += fileResult.errorCount || 0;
    warningCount += fileResult.warningCount || 0;
    for (const msg of fileResult.messages || []) {
      const ruleId = msg.ruleId || 'unknown';
      byRule[ruleId] = (byRule[ruleId] || 0) + 1;
    }
  }

  const highImpactViolations = {};
  for (const [ruleId, count] of Object.entries(byRule)) {
    if (HIGH_IMPACT_RULES.includes(ruleId) || ruleId.startsWith('jsx-a11y/')) {
      highImpactViolations[ruleId] = count;
    }
  }

  const failures = [];
  if (errorCount > 0) {
    failures.push(`ESLint error count must be 0 (found ${errorCount})`);
  }
  if (Object.keys(highImpactViolations).length > 0) {
    failures.push(
      `High-impact ESLint rules must stay at 0: ${JSON.stringify(highImpactViolations)}`,
    );
  }
  if (warningCount > maxWarnings) {
    failures.push(
      `Total ESLint warnings ${warningCount} exceeds budget ${maxWarnings} (baseline was ${BASELINE_TOTAL_WARNINGS})`,
    );
  }

  return {
    passed: failures.length === 0,
    errorCount,
    warningCount,
    maxWarnings,
    baselineWarnings: BASELINE_TOTAL_WARNINGS,
    byRule,
    highImpactViolations,
    failures,
  };
}

function main() {
  const eslintBin = path.join(ROOT_DIR, 'node_modules', 'eslint', 'bin', 'eslint.js');
  const proc = spawnSync(process.execPath, [eslintBin, '.', '--format', 'json'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    maxBuffer: 25 * 1024 * 1024,
  });

  if (proc.error) {
    console.error('Failed to run ESLint:', proc.error);
    process.exit(1);
  }

  const rawOut = (proc.stdout || '').trim();
  if (!rawOut) {
    console.error('ESLint produced empty JSON output.', proc.stderr);
    process.exit(proc.status || 1);
  }

  const parsed = JSON.parse(rawOut);
  const summary = evaluateEslintReport(parsed);

  const sortedRules = Object.entries(summary.byRule).sort((a, b) => b[1] - a[1]);
  console.log(
    `[OPS-13] ESLint summary: errors=${summary.errorCount}, warnings=${summary.warningCount}/${summary.maxWarnings} (baseline=${summary.baselineWarnings})`,
  );
  for (const [rule, count] of sortedRules) {
    console.log(`  - ${rule}: ${count}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '### OPS-13 ESLint Warning Budget',
      `- Errors: **${summary.errorCount}**`,
      `- Total Warnings: **${summary.warningCount}** / Budget: **${summary.maxWarnings}** (Baseline: ${summary.baselineWarnings})`,
      '',
      '| Rule | Count |',
      '|---|---:|',
      ...sortedRules.map(([rule, count]) => `| \`${rule}\` | ${count} |`),
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }

  if (!summary.passed) {
    for (const reason of summary.failures) {
      console.error(`[FAIL] ${reason}`);
    }
    process.exit(1);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}

