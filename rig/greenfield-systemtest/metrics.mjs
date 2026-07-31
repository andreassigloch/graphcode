// Pure, auditable metric math for the greenfield system test.
// No AI judge, no live store: every number is derived from static artifacts a
// run leaves behind — the exported graph.json, readiness.json, audit.jsonl —
// compared against the held-out golden (the real sigloch-modules graph).
//
// Kept pure on purpose: the numbers must be reproducible and inspectable, which
// is the whole "valide Daten" bar. Store access (export + readiness) happens in
// run.mjs via the proven bindToolsToHarness path; here we only do arithmetic.
//
// @author andreas@siglochconsulting
import { readFileSync, existsSync } from 'node:fs';

/** Load a graphcode graph export ({elements, traces}) or throw a clear error. */
export function loadGraph(path) {
  if (!existsSync(path)) throw new Error(`graph not found: ${path}`);
  const g = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(g.elements)) throw new Error(`not a graph export (no elements[]): ${path}`);
  return g;
}

/** legality: blocked/illegal mutations recorded in the run's audit log. */
export function legality(auditPath) {
  if (!existsSync(auditPath)) return { blocked: 0, note: 'no audit log' };
  let blocked = 0, total = 0;
  for (const line of readFileSync(auditPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    total++;
    try {
      const ev = JSON.parse(line);
      const tier = ev.tier ?? ev.result?.tier;
      if (tier === 'block' || ev.blocked === true) blocked++;
    } catch { /* skip malformed line */ }
  }
  return { blocked, mutations: total };
}

/** readiness: graph_readiness returns {compliance, phaseGates, implGates, ...}. Headline is
 *  compliance (error-severity, 0..1); phase/impl gates give SE-phase completeness. */
export function readiness(readinessPath) {
  if (!existsSync(readinessPath)) return { compliance: null, gatesPassed: null, note: 'not captured' };
  const r = JSON.parse(readFileSync(readinessPath, 'utf8'));
  const gates = [...(r.phaseGates ?? []), ...(r.implGates ?? [])];
  const passed = gates.filter((g) => g.passed).length;
  return {
    compliance: r.compliance?.score ?? null,
    elementsWithErrors: r.compliance?.elementsWithErrors ?? null,
    gatesPassed: gates.length ? `${passed}/${gates.length}` : null,
  };
}

/** Module-reuse AUDIT (not a score): authored vs golden module names, side by side, for a
 *  human to judge overlap. Exact-name matching proved too brittle (paraphrases → false 0). */
export function moduleAudit(runGraph, golden) {
  const names = (g, t) => g.elements.filter((e) => e.type === t).map((e) => e.name).filter(Boolean);
  return {
    MOD: { authored: names(runGraph, 'MOD'), golden: names(golden, 'MOD') },
    FUNC: { authored: names(runGraph, 'FUNC').length, golden: names(golden, 'FUNC').length },
    UC: { authored: names(runGraph, 'UC'), golden: names(golden, 'UC') },
  };
}

/** Assemble one run's metric row. Primary metrics are rule-based (compliance, structure,
 *  gate-rejections, cost); module reuse is a human-audit list, not a score (see README). */
export function runMetrics({ graphPath, readinessPath, auditPath, goldenPath, usage }) {
  const run = loadGraph(graphPath);
  const golden = loadGraph(goldenPath);
  const el = run.elements;
  const byType = (t) => el.filter((e) => e.type === t).length;
  return {
    elements: el.length,
    traces: (run.traces ?? []).length,
    structure: { UC: byType('UC'), FUNC: byType('FUNC'), MOD: byType('MOD'), REQ: byType('REQ'), TEST: byType('TEST') },
    readiness: readiness(readinessPath),
    gate_rejections: legality(auditPath).blocked,
    tokens: usage ?? null,
    moduleAudit: moduleAudit(run, golden), // human-audited, not scored
  };
}

// CLI: node metrics.mjs <runDir> <goldenPath>  — prints one metric row as JSON.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [runDir, goldenPath] = process.argv.slice(2);
  if (!runDir || !goldenPath) {
    console.error('usage: node metrics.mjs <runDir> <goldenGraphPath>');
    process.exit(1);
  }
  const row = runMetrics({
    graphPath: `${runDir}/graph.json`,
    readinessPath: `${runDir}/readiness.json`,
    auditPath: `${runDir}/audit.jsonl`,
    goldenPath,
    usage: existsSync(`${runDir}/usage.json`) ? JSON.parse(readFileSync(`${runDir}/usage.json`, 'utf8')) : null,
  });
  console.log(JSON.stringify(row, null, 2));
}
