/**
 * kongruenz.mjs — das dreiwertige Code-Urteil der Readiness (kongruent · gedriftet · nicht pruefbar) samt seiner
 * Reichweite: Bindungsquote der Blatt-FUNC (`realRef`) und Import-Deckung. Rein; Eingang ist das Ergebnis von
 * `graph_readiness` und der flache Graph. Leser: `scripts/messung.mjs` (T-V4).
 *
 * Herkunft: `rig/greenfield-systemtest/metrics.mjs` (CR-GC-574); hierher mit CR-GC-740, als das Rig fiel.
 *
 * @author andreas@siglochconsulting
 */

/** Bindungsquote der BLATT-FUNC: ein Elter ohne realRef ist keine Luecke, seine Kinder tragen die Bindung. */
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

/** Das Urteil nennt IMMER seine Reichweite — nie nur das Wort. */
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
