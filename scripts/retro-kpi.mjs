#!/usr/bin/env node
// retro-kpi — post-project KPI evaluator (CR-GC-212).
//
// Computes the 6 standard KPIs (docs/KPI.md) from a session-data JSON the agent
// assembles during the retro: graph-vs-grep tool usage (transcript), audit_stats
// (applied/rejected), graph_readiness start→end, git net-LOC, plan conformance,
// and R-19/R-20 binding coverage at close. The agent reads audit_* / graph_readiness
// over MCP (no 2nd DB handle here — this runner only reads the JSON + git).
//
// Logic (computeKpis / renderKpiTable) is exported + unit-tested; the main block
// reads ./retro-session.json (or argv[2]), auto-fills git net-LOC, and prints the table.
//
// Usage: node scripts/retro-kpi.mjs [session.json]
// @author andreas@siglochconsulting
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Round to 2 decimals for deterministic, comparable KPI values. */
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Compute the 6 KPIs from session data. Pure — every input is supplied by the caller
 * (the agent reads the audit + readiness tools over MCP, the transcript for tool counts, git for LOC).
 *
 * `s` shape: `{ toolUsage:{graphCalls,grepGlobDocReads,mutate?,impact?,expand?,rulesEvaluate?},`
 * `audit:{applied,rejected}, readiness:{start,end}, git:{netLoc,tokens?},`
 * `plan:{dependsOnViolations}, binding:{coveragePct} }`.
 */
export function computeKpis(s) {
  const grep = Math.max(1, s.toolUsage.grepGlobDocReads ?? 0);
  return {
    // KPI 1 — Graph-vs-Grep ratio. Target > 1 (the graph was used, not grep-bypassed).
    graphVsGrepRatio: r2((s.toolUsage.graphCalls ?? 0) / grep),
    // KPI 2 — tool usage counts (no target; a usage profile).
    toolUsage: {
      mutate: s.toolUsage.mutate ?? 0,
      impact: s.toolUsage.impact ?? 0,
      expand: s.toolUsage.expand ?? 0,
      rulesEvaluate: s.toolUsage.rulesEvaluate ?? 0,
    },
    // KPI 3 — tokens per net LOC. Target ↓. null if tokens not captured (transcript follow-up).
    tokenPerLoc: s.git.tokens != null && s.git.netLoc > 0 ? r2(s.git.tokens / s.git.netLoc) : null,
    // KPI 4 — plan conformance: # CRs violating depends-on order. Target 0.
    planConformance: s.plan.dependsOnViolations,
    // KPI 5 — gate health: applied÷rejected + readiness delta start→end.
    gateHealth: {
      appliedRejectedRatio: r2((s.audit.applied ?? 0) / Math.max(1, s.audit.rejected ?? 0)),
      readinessDelta: r2((s.readiness.end ?? 0) - (s.readiness.start ?? 0)),
    },
    // KPI 6 — binding coverage: R-19/R-20 (testRef/codeRef) at close. Target 100%.
    bindingCoverage: s.binding.coveragePct,
  };
}

/** Render the KPI set as a markdown table. */
export function renderKpiTable(k) {
  const rows = [
    ['Graph-vs-Grep ratio', String(k.graphVsGrepRatio), '> 1'],
    ['Tool usage (mutate/impact/expand/rules)', `${k.toolUsage.mutate}/${k.toolUsage.impact}/${k.toolUsage.expand}/${k.toolUsage.rulesEvaluate}`, '—'],
    ['Tokens per net-LOC', k.tokenPerLoc == null ? 'n/a' : String(k.tokenPerLoc), '↓'],
    ['Plan conformance (depends-on violations)', String(k.planConformance), '0'],
    ['Gate health (applied÷rejected)', String(k.gateHealth.appliedRejectedRatio), '—'],
    ['Readiness Δ (start→end)', String(k.gateHealth.readinessDelta), '↑'],
    ['Binding coverage (R-19/R-20)', `${k.bindingCoverage}%`, '100%'],
  ];
  return ['| KPI | Value | Target |', '|---|---|---|', ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} |`)].join('\n');
}

/** Net LOC from `git diff --shortstat` (insertions − deletions), 0 if unavailable. */
function gitNetLoc() {
  try {
    const out = execSync('git diff --shortstat HEAD', { encoding: 'utf8' });
    const ins = Number(/(\d+) insertion/.exec(out)?.[1] ?? 0);
    const del = Number(/(\d+) deletion/.exec(out)?.[1] ?? 0);
    return ins - del;
  } catch {
    return 0;
  }
}

// --- main: read the session JSON, auto-fill git net-LOC, print the table ---
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2] ?? 'retro-session.json';
  if (!existsSync(path)) {
    console.error(
      `retro-kpi: no session file at ${path}.\n` +
        'Assemble it during the retro (se-retro): toolUsage (transcript), audit (audit_stats), ' +
        'readiness {start,end} (graph_readiness), git {netLoc,tokens}, plan {dependsOnViolations}, binding {coveragePct}.',
    );
    process.exit(1);
  }
  const session = JSON.parse(readFileSync(path, 'utf8'));
  if (session.git?.netLoc == null) session.git = { ...session.git, netLoc: gitNetLoc() };
  console.log(renderKpiTable(computeKpis(session)));
}
