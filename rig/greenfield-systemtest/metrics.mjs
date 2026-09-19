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
      // `tier` steht nicht an jedem Datensatz — gemessen 2026-09-19 trug KEINER der 13
      // Saetze des sigllm-Laufs ein `tier`, wohl aber `result: 'rejected'`. Nur auf `tier`
      // zu schauen meldete 0 Ablehnungen, wo 2 standen.
      const tier = ev.tier ?? ev.result?.tier;
      const verworfen = typeof ev.result === 'string' && ev.result !== 'applied';
      if (tier === 'block' || ev.blocked === true || verworfen) blocked++;
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

/** Die ganze Bewertung, nicht nur ihre Spitze (CR-GC-552).
 *
 * `graph_readiness` liefert acht Felder, die das Rig bis hierher wegwarf: die
 * Dimensions-Readiness, den Steuerwert samt Anker, `skipped` (was gar nicht ausgewertet
 * wurde), `catalogs.notInGate` (was ausgewertet wurde, aber nicht blockt) und
 * `importCoverage` — die REICHWEITE. Ohne sie ist eine Konformanzaussage keine Aussage:
 * dieselbe Regel meldete an sigllm 0 Befunde bei 19 % Reichweite und 8 bei 81 %.
 */
export function specVerdict(r) {
  const dims = {};
  for (const d of r.dimension_readiness ?? []) dims[d.dimension] = d.score;
  return {
    compliance: r.compliance?.score ?? null,
    elementsWithErrors: r.compliance?.elementsWithErrors ?? null,
    dimensions: dims,
    steer: r.steer
      ? { worst: r.steer.worst ?? null, anchor: r.steer.worstAt ? `${r.steer.worstAt.ruleId}@${r.steer.worstAt.elementId}` : null }
      : null,
    /** Regeln, die NICHT liefen — `0 Befunde` heisst hier „nicht gefragt", nicht „sauber". */
    notEvaluated: r.skipped ?? [],
    /** Regeln, die liefen, aber nicht blocken. */
    advisoryOnly: r.catalogs?.notInGate ?? [],
  };
}

/** Bindungsquote: Blatt-FUNC mit `realRef`. Die Reichweite JEDER Aussage ueber den Code.
 *  Attribute stehen im Export flach ODER unter `attributes` (CR-GC-219) — beides lesen. */
export function binding(graph) {
  const at = (e, k) => e[k] ?? e.attributes?.[k];
  const kinder = new Map();
  for (const t of graph.traces ?? []) {
    if (t.type !== 'compose') continue;
    if (!kinder.has(t.source)) kinder.set(t.source, []);
    kinder.get(t.source).push(t.target);
  }
  const typeOf = new Map(graph.elements.map((e) => [e.id, e.type]));
  const funcs = graph.elements.filter((e) => e.type === 'FUNC');
  const leaves = funcs.filter((f) => !(kinder.get(f.id) ?? []).some((c) => typeOf.get(c) === 'FUNC'));
  const bound = leaves.filter((f) => at(f, 'realRef') != null);
  return {
    leafFuncs: leaves.length,
    bound: bound.length,
    pct: leaves.length ? Math.round((100 * bound.length) / leaves.length) : null,
  };
}

/** Code-Konformanz DREIWERTIG (globale CLAUDE.md, „Kongruenz"): kongruent / gedriftet /
 *  nicht pruefbar — und die Reichweite steht IMMER dabei, auch beim Urteil „kongruent".
 *  Ein Gate, das ohne Bindung „gruen" meldet, ist schlimmer als keins. */
export function codeVerdict(r, graph) {
  const rc = Object.entries(r.violationsByRule ?? {}).filter(([id]) => id.startsWith('RC-'));
  const nieGelaufen = (r.skipped ?? []).filter((s) => s.startsWith('rule:RC-'));
  const cov = r.importCoverage ?? { endpoints: 0, assigned: 0 };
  const reach = cov.endpoints ? Math.round((100 * cov.assigned) / cov.endpoints) : 0;
  const bind = binding(graph);

  let verdict;
  if (nieGelaufen.length) verdict = 'nicht pruefbar';
  else if (!cov.endpoints && !bind.bound) verdict = 'nicht pruefbar';
  else if (rc.length) verdict = 'gedriftet';
  else verdict = 'kongruent';

  return {
    verdict,
    /** Warum dieses Urteil — nie nur das Wort. */
    why: nieGelaufen.length
      ? `RC-Regeln nicht ausgewertet: ${nieGelaufen.join(', ')}`
      : !cov.endpoints && !bind.bound
        ? 'keine Bindung und keine aufloesbare Quelldatei — es gibt nichts zu pruefen'
        : rc.length
          ? `RC-Befunde: ${rc.map(([id, n]) => `${id} x${n}`).join(', ')}`
          : `keine RC-Befunde bei ${reach} % Reichweite`,
    reach: { endpoints: cov.endpoints, assigned: cov.assigned, pct: reach },
    binding: bind,
    rcViolations: Object.fromEntries(rc),
  };
}

/** Assemble one run's metric row. Primary metrics are rule-based (compliance, structure,
 *  gate-rejections, cost); module reuse is a human-audit list, not a score (see README). */
export function runMetrics({ graphPath, readinessPath, auditPath, goldenPath, usage }) {
  const run = loadGraph(graphPath);
  const golden = loadGraph(goldenPath);
  const el = run.elements;
  const byType = (t) => el.filter((e) => e.type === t).length;
  // CR-GC-552: die volle Bewertung, Spezifikation UND Code. `readiness` bleibt als
  // Kopfzeile, `spec`/`code` tragen, was bis hierher weggeworfen wurde.
  const raw = existsSync(readinessPath) ? JSON.parse(readFileSync(readinessPath, 'utf8')) : null;
  return {
    elements: el.length,
    traces: (run.traces ?? []).length,
    structure: { UC: byType('UC'), FUNC: byType('FUNC'), MOD: byType('MOD'), REQ: byType('REQ'), TEST: byType('TEST') },
    readiness: readiness(readinessPath),
    spec: raw ? specVerdict(raw) : null,
    code: raw ? codeVerdict(raw, run) : null,
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
