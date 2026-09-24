/**
 * TEST-retro-kpi (CR-GC-212) — the post-project KPI evaluator over a fixture session.
 *
 * Deterministic KPI values from a graph-rich fixture, and the key signal: a
 * deliberately graph-less session (grep-bypass) yields Graph-vs-Grep ratio < 1.
 * Real compute, no mocks.
 */
import { describe, it, expect } from 'vitest';
import { computeKpis, renderKpiTable } from '../scripts/retro-kpi.mjs';

const graphRich = {
  toolUsage: { graphCalls: 20, grepGlobDocReads: 5, mutate: 8, impact: 4, expand: 2, rulesEvaluate: 3 },
  audit: { applied: 18, rejected: 2 },
  readiness: { start: 0.6, end: 0.9 },
  git: { netLoc: 400, tokens: 80000 },
  plan: { dependsOnViolations: 0 },
  binding: { coveragePct: 100 },
};

const graphLess = {
  toolUsage: { graphCalls: 1, grepGlobDocReads: 30, mutate: 0, impact: 0, expand: 0, rulesEvaluate: 0 },
  audit: { applied: 5, rejected: 5 },
  readiness: { start: 0.5, end: 0.5 },
  git: { netLoc: 300, tokens: 120000 },
  plan: { dependsOnViolations: 3 },
  binding: { coveragePct: 40 },
};

describe('TEST-retro-kpi (CR-GC-212): post-project KPI standard', () => {
  it('graph-rich session → deterministic KPI values, ratio > 1', () => {
    const k = computeKpis(graphRich);
    expect(k.graphVsGrepRatio).toBe(4); // 20 / 5
    expect(k.graphVsGrepRatio).toBeGreaterThan(1);
    expect(k.tokenPerLoc).toBe(200); // 80000 / 400
    expect(k.planConformance).toBe(0); // target met
    expect(k.gateHealth.appliedRejectedRatio).toBe(9); // 18 / 2
    expect(k.gateHealth.readinessDelta).toBe(0.3); // 0.9 − 0.6
    expect(k.bindingCoverage).toBe(100);
  });

  it('graph-less session → Graph-vs-Grep ratio < 1 (graph bypass detected, not vacuous)', () => {
    const k = computeKpis(graphLess);
    expect(k.graphVsGrepRatio).toBeLessThan(1); // 1 / 30 ≈ 0.03
    expect(k.planConformance).toBe(3); // depends-on violations surfaced
  });

  it('tokenPerLoc is null when tokens were not captured (transcript follow-up)', () => {
    const k = computeKpis({ ...graphRich, git: { netLoc: 400 } });
    expect(k.tokenPerLoc).toBeNull();
  });

  it('renderKpiTable emits a markdown table with all 6 KPIs', () => {
    const md = renderKpiTable(computeKpis(graphRich));
    expect(md).toContain('| KPI | Value | Target |');
    for (const label of ['Graph-vs-Grep', 'Tool usage', 'Tokens per net-LOC', 'Plan conformance', 'Gate health', 'Binding coverage']) {
      expect(md).toContain(label);
    }
  });
});

/**
 * CR-GC-639 — KPI 1 aus dem PROTOKOLL, nicht von Hand.
 *
 * Bis hierher rechnete `computeKpis` KPI 1 aus Zahlen, die der Agent waehrend der Retro von Hand
 * zusammentrug — gezaehlt hat niemand. `rig/referenz-change/messen.mjs` zaehlte dann selbst, aber
 * mit EIGENER Definition (nur Leseaufrufe, ohne Doc-Reads). Zwei Definitionen derselben Kennzahl
 * sind derselbe Fehler wie zwei Format-E-Leser. Jetzt zaehlt EINE Funktion, nach `docs/KPI.md`:
 * `graph_*`-Aufrufe ÷ (Grep + Glob + Doc-Read).
 */
describe('TEST-retro-kpi: KPI 1 wird aus dem Sitzungsprotokoll gezaehlt (CR-GC-639)', () => {
  const nutzung = (name: string, input: Record<string, unknown> = {}) => ({
    message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] },
  });
  const nutzer = (text: string) => ({ message: { role: 'user', content: text } });

  const protokoll = [
    nutzer('vorher, anderes Thema'),
    nutzung('Bash', { command: 'grep -rn alt src' }),                 // VOR dem Fenster
    nutzer('bitte CR-GC-900 umsetzen'),                                 // Fensterbeginn
    nutzung('Bash', { command: 'grep -rn foo src' }),                   // Suche
    nutzung('mcp__graphcode__graph_impact', { id: 'FUNC-x' }),          // Graph, lesend
    nutzung('Bash', { command: 'cat docs/graph/graphcode.graph.json' }),// Doc-Read (Ausgabe, nicht Modell)
    nutzung('Read', { file_path: '/repo/docs/views/rtm.md' }),          // Doc-Read
    nutzung('Read', { file_path: '/repo/src/surface/read.ts' }),        // KEIN Doc-Read: Quelltext
    nutzung('Bash', { command: 'npm test 2>&1 | tail' }),               // Volllauf
    nutzung('Bash', { command: 'npx vitest run tests/a.test.ts' }),     // selektiv
    nutzung('mcp__graphcode__graph_mutate', { commands: [] }),          // Graph, schreibend
    nutzung('Grep', { pattern: 'x' }),                                  // Suche (Werkzeug)
    nutzung('Bash', { command: 'npm run build 2>&1 | grep -E "error" | head' }), // FILTER, keine Suche
    nutzung('Bash', { command: 'cd /repo && git grep -n foo' }),       // Suche, nach cd &&
  ];

  it('zaehlt nach der Definition aus docs/KPI.md — und nur im Fenster ab der CR-ID', async () => {
    const { werkzeugNutzung, fensterFuer } = await import('../scripts/retro-kpi.mjs');
    const fenster = fensterFuer(protokoll, 'CR-GC-900');
    expect(fenster.length).toBe(protokoll.length - 2);

    const n = werkzeugNutzung(fenster);
    expect(n.graphCalls).toBe(2);
    expect(n.graphReads).toBe(1);          // Schreiben ersetzt kein grep — getrennt ausgewiesen
    expect(n.grepGlobDocReads).toBe(5);    // grep, cat docs/graph, Read docs/views, Grep, git grep — NICHT `| grep`
    expect(n.impact).toBe(1);
    expect(n.mutate).toBe(1);
    expect(n.volllaeufe).toBe(1);
    expect(n.selektiv).toBe(1);
  });

  it('das Fenster ENDET mit dem Abschluss des CR — spaetere Arbeit zaehlt nicht mit', async () => {
    const { fensterFuer } = await import('../scripts/retro-kpi.mjs');
    const mitAbschluss = [
      ...protokoll,
      nutzung('Bash', { command: 'git mv docs/cr/open/CR-GC-900-x.md docs/cr/done/' }),
      { message: { role: 'user', content: [{ type: 'tool_result', content: 'R  docs/cr/open/CR-GC-900-x.md -> docs/cr/done/CR-GC-900-x.md' }] } },
      nutzer('naechster CR'),
      nutzung('Bash', { command: 'npm test' }),   // gehoert NICHT mehr zu CR-GC-900
    ];
    const f = fensterFuer(mitAbschluss, 'CR-GC-900');
    expect(f.at(-1)).toEqual(mitAbschluss.at(-3));   // endet mit der Zeile, die done/ nennt
  });

  it('Text in einem Heredoc ist kein Befehl — nur was LAEUFT, zaehlt', async () => {
    // Gemessen an CR-GC-639 selbst: 8 „Volllaeufe", davon 7 Heredocs, die Dateien schrieben und
    // `npm test` nur ERWAEHNTEN (Kommentare, Fixtures, der CR-Text). Der echte Lauf stand am Ende
    // eines davon.
    const { werkzeugNutzung } = await import('../scripts/retro-kpi.mjs');
    const b = (command: string) => ({ message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } });
    const n = werkzeugNutzung([
      b("cat > x.md <<'EOF'\nFuehre npm test aus.\ngrep -rn foo src\nEOF"),       // nur Text
      b("python3 - <<'PY'\ns = 'npm test'\nPY\nnpm run build && npm test | tail"), // Text + ECHTER Lauf danach
      b('cd /repo && env -u GIT_DIR npm test 2>&1 | tail -5'),                          // echter Lauf
      b('echo "npm test und grep -r x"'),                                               // nur Text
      b('grep -E "Test Files|FAIL" /private/tmp/claude-501/x/tasks/abc.output'),        // Log lesen, nicht Code
      b('tail -5 /tmp/lauf.log | grep FAIL'),                                           // dito, und nach Pipe
    ]);
    expect(n.volllaeufe).toBe(2);
    expect(n.grepGlobDocReads).toBe(0);
  });

  it('eine CR-ID, die im Protokoll nicht vorkommt, ergibt ein LEERES Fenster, kein ganzes', async () => {
    const { fensterFuer } = await import('../scripts/retro-kpi.mjs');
    expect(fensterFuer(protokoll, 'CR-GC-999')).toEqual([]);
  });

  it('das Ergebnis passt in computeKpis — eine Kennzahl, eine Rechnung', async () => {
    const { werkzeugNutzung, fensterFuer } = await import('../scripts/retro-kpi.mjs');
    const n = werkzeugNutzung(fensterFuer(protokoll, 'CR-GC-900'));
    const k = computeKpis({ ...graphRich, toolUsage: n });
    expect(k.graphVsGrepRatio).toBe(0.4);  // 2 ÷ 5
  });
});
