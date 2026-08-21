#!/usr/bin/env node
// test-selection-audit — misst, ob der Graph sagen kann, welche Tests laufen müssen
// (CR-GC-381, Instrument zu SPIKE-GC-selective-tests).
//
// Liest den COMMITTETEN Snapshot (`docs/graph/*.graph.json`), nie den Kuzu-Store: der
// MCP-Server besitzt das einzige Handle (REQ-single-kuzu-owner). Die Traversal-Semantik
// kommt aus derselben Funktion, die `graph_tests` benutzt — kein zweiter Pfad.
//
// Logik liegt in `src/test-selection-audit.ts` (gebaut nach dist/, unit-getestet in
// `tests/test-selection.audit.test.ts`); dieser Runner ist dünn und setzt einen aktuellen
// Build voraus (`npm run build`).
//
// Usage: node scripts/test-selection-audit.mjs [--commits 60] [--json]
// @author andreas@siglochconsulting
import { execFileSync } from 'node:child_process';
import { buildContext, coverage, recall, potential, renderAudit } from '../dist/test-selection-audit.js';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const commitFlag = process.argv.indexOf('--commits');
const commits = commitFlag > -1 ? Number(process.argv[commitFlag + 1]) : 60;

if (process.argv.includes('--json')) {
  const ctx = buildContext(repoRoot);
  const rec = recall(ctx);
  const pot = potential(repoRoot, ctx, commits);
  console.log(
    JSON.stringify(
      { coverage: coverage(ctx), recall: { selected: rec.selected, coupled: rec.coupled, hit: rec.hit, ratio: rec.ratio }, potential: { ...pot, perCommit: undefined } },
      null,
      2,
    ),
  );
} else {
  console.log(renderAudit(repoRoot, commits));
}
