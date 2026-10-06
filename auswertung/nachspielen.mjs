/**
 * nachspielen.mjs — der Graph eines Laufs nach n Mutationen, neu gebaut aus `audit.jsonl` durch das echte Gate
 * eines Wegwerf-Stores (`openMeasured`), und die Readiness darauf. Grundlage für das Ende-Urteil des Treibers
 * (SRR und PDR erreicht) und für jede Analyse, die Zwischenstände braucht (schatten-suggest). Ein laufender Host
 * wird nie angefasst; gemessen wird nie am Live-Store (rig/README.md, „die eine Regel").
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync } from 'node:fs';

/** Die Mutationen eines Audits in Reihenfolge (nur `operation: mutate`). */
export function mutationen(auditPfad) {
  if (!existsSync(auditPfad)) return [];
  return readFileSync(auditPfad, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((a) => a.operation === 'mutate');
}

/** Der flache Export eines Harness-Graphen — dieselbe Form wie `docs/graph/<member>.graph.json`. */
export function flach(g) {
  return {
    elements: g.nodes.map((x) => ({ id: x.uid, type: x.type, name: x.name, description: x.description, attributes: x.attributes ?? {} })),
    traces: g.edges.map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType, ...(e.attributes?.label ? { label: e.attributes.label } : {}) })),
  };
}

/**
 * Rein: der Befund einer Regelprüfung — Fehler und OFFENE Warnungen. Ein Fund, den sein Träger (das Element, sonst
 * das System) mit Grund abgenommen hat (`acceptedFindings`, CR-SM-349), zählt nicht als offen: `rules_evaluate` zeigt
 * ihn weiter wie jeden anderen (ITEM-2026-748), wer „warnungsfrei" prüft, muss ihn selbst herausnehmen.
 * `abgenommenVon(element)` liefert die abgenommenen Regel-IDs eines Elements (contracts `acceptedRuleIds`).
 */
export function befundAus(violations, graph, abgenommenVon) {
  const byId = new Map(graph.nodes.map((n) => [n.uid, n]));
  const sys = graph.nodes.find((n) => n.type === 'SYS');
  const ab = (v) => { const t = byId.get(v.elementId) ?? sys; return Boolean(t) && abgenommenVon({ attributes: t.attributes ?? {} }).has(v.ruleId); };
  const fehler = violations.filter((v) => v.severity === 'error');
  const warn = violations.filter((v) => v.severity === 'warning');
  const offen = warn.filter((v) => !ab(v));
  return {
    fehler: fehler.length, warnungen: offen.length, abgenommen: warn.length - offen.length,
    offen: [...fehler, ...offen].map((v) => ({ regel: v.ruleId, element: v.elementId })),
  };
}

/**
 * Rein, ohne Store und ohne Gate-Urteil: die angewandten Mutationen eines Audits in Reihenfolge durch
 * `applyCommands` — der Endgraph als Harness-Graph und die Zahl der Züge. Für Eigenschaftstests über Trails
 * (tests/generate.statemachine.test.ts); wer das Gate-Urteil braucht, nimmt `nachspielen`.
 */
export async function nachspielenRein(auditPfad) {
  const { applyCommands, cloneGraph } = await import('../dist/kernel/apply-commands.js');
  const alle = mutationen(auditPfad);
  let graph = { nodes: [], edges: [] };
  let zuege = 0;
  for (const a of alle) {
    if (a.result !== 'applied' || !a.commands?.length) continue;
    graph = applyCommands(cloneGraph(graph), a.commands).graph;
    zuege++;
  }
  return { zuege, abgelehnt: alle.filter((a) => a.result !== 'applied').length, graph };
}

/**
 * Die ersten `n` Mutationen (angewandte wie abgelehnte zählen) nachspielen: nur die angewandten gehen in
 * Reihenfolge durch das Gate. `jeZug(leer, i, commands)` läuft vor jeder angewandten Mutation mit dem offenen
 * Wegwerf-Store — für Analysen, die den Stand davor brauchen; `amEnde(leer)` läuft nach der letzten.
 */
export async function nachspielen(auditPfad, repo, n = Infinity, { systemId = 'todo', jeZug = null, amEnde = null, basis = null } = {}) {
  const angewandt = mutationen(auditPfad).slice(0, n).filter((a) => a.result === 'applied');
  const { openMeasured } = await import('../dist/index.js');
  const { commandsToFormatE } = await import('@sigloch/graph-api-core');
  const { acceptedRuleIds } = await import('@sigloch/contracts/se');
  // `basis`: der Graph, mit dem der Lauf begann (Aufgabe mit Basis) — der Wegwerf-Store startet dort, nicht leer.
  const leer = await openMeasured(basis ? { graph: basis, systemId, configFrom: repo } : { systemId, configFrom: repo });
  try {
    for (const [i, a] of angewandt.entries()) {
      if (jeZug) await jeZug(leer, i, a.commands);
      const typ = (uid) => leer.graph().nodes.find((x) => x.uid === uid)?.type;
      const r = await leer.tools.graph_mutate.handler({ formatE: commandsToFormatE(a.commands, typ), consumerId: 'nachspielen' });
      if (!r.success) throw new Error(`${auditPfad}: Audit-Eintrag ${a.id} geht beim Nachspielen nicht durchs Gate`);
    }
    if (amEnde) await amEnde(leer);
    const readiness = await leer.tools.graph_readiness.handler({});
    // Der Befund der ganzen Regelprüfung (ein Eintrag je Element): das Ziel der Stufe `warnungsfrei`.
    const ev = await leer.tools.rules_evaluate.handler({ detail: 'full' });
    return {
      flach: flach(leer.graph()),
      // Je Marke (SRR, PDR, CDR, TRR, Bau), ob sie erreicht ist. Das Feld heisst weiter `gates`: so steht es je Zug
      // in den eingefrorenen `lauf.json`, und `kennzahlen.gateZug` liest alte wie neue Laeufe ueber denselben Weg.
      gates: Object.fromEntries(readiness.marks.map((m) => [m.id, m.reached])),
      befund: befundAus(ev.violations, leer.graph(), acceptedRuleIds),
      readiness,
    };
  } finally {
    await leer.close();
  }
}
