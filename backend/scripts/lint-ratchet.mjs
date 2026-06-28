#!/usr/bin/env node
// M4: lint ratchet. The backend carries a backlog of pre-existing strict
// type-aware ESLint errors (see .lint-baseline.json). We don't block CI on the
// whole backlog, but we DO block any *increase* — so the count can only ever go
// down. When you fix some, lower the baseline (this script tells you the new
// number). Replaces the old `continue-on-error: true` lint step, which hid new
// violations entirely.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(backendDir, '.lint-baseline.json');

const result = spawnSync(
  'npx',
  ['eslint', 'src/**/*.ts', '-f', 'json'],
  { cwd: backendDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

if (!result.stdout) {
  console.error('[lint-ratchet] eslint produced no output');
  console.error(result.stderr || '(no stderr)');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('[lint-ratchet] could not parse eslint JSON output');
  console.error(result.stdout.slice(0, 2000));
  process.exit(2);
}

const errors = report.reduce((sum, file) => sum + file.errorCount, 0);
const warnings = report.reduce((sum, file) => sum + file.warningCount, 0);

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const allowAutolower = process.env.LINT_RATCHET_AUTOLOWER === '1';

console.log(
  `[lint-ratchet] errors=${errors} (baseline ${baseline.errors}) warnings=${warnings}`,
);

if (errors > baseline.errors) {
  console.error(
    `[lint-ratchet] FAIL: ${errors - baseline.errors} new lint error(s) introduced. ` +
      `Fix them, or run eslint locally to see them. The baseline never goes up.`,
  );
  process.exit(1);
}

if (errors < baseline.errors) {
  console.log(
    `[lint-ratchet] Progress! ${baseline.errors - errors} fewer error(s) than baseline. ` +
      `Lower backend/.lint-baseline.json "errors" to ${errors} to lock it in.`,
  );
  if (allowAutolower) {
    writeFileSync(
      baselinePath,
      JSON.stringify({ ...baseline, errors }, null, 2) + '\n',
    );
    console.log(`[lint-ratchet] Auto-lowered baseline to ${errors}.`);
  }
}

process.exit(0);
