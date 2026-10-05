/**
 * nachspielen.mjs — der Graph eines Laufs nach n Mutationen, neu gebaut aus `audit.jsonl` durch das echte Gate
 * eines Wegwerf-Stores (`openMeasured`), und die Readiness darauf. Grundlage für das Ende-Urteil des Treibers
 * (SRR und PDR bestanden) und für jede Analyse, die Zwischenstände braucht (schatten-suggest). Ein laufender Host
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
 * Die ersten `n` Mutationen (angewandte wie abgelehnte zählen) nachspielen: nur die angewandten gehen in
 * Reihenfolge durch das Gate. `jeZug(leer, i, commands)` läuft vor jeder angewandten Mutation mit dem offenen
 * Wegwerf-Store — für Analysen, die den Stand davor brauchen; `amEnde(leer)` läuft nach der letzten.
 */
export async function nachspielen(auditPfad, repo, n = Infinity, { systemId = 'todo', jeZug = null, amEnde = null } = {}) {
  const angewandt = mutationen(auditPfad).slice(0, n).filter((a) => a.result === 'applied');
  const { openMeasured } = await import('../dist/index.js');
  const { commandsToFormatE } = await import('@sigloch/graph-api-core');
  const leer = await openMeasured({ systemId, configFrom: repo });
  try {
    for (const [i, a] of angewandt.entries()) {
      if (jeZug) await jeZug(leer, i, a.commands);
      const typ = (uid) => leer.graph().nodes.find((x) => x.uid === uid)?.type;
      const r = await leer.tools.graph_mutate.handler({ formatE: commandsToFormatE(a.commands, typ), consumerId: 'nachspielen' });
      if (!r.success) throw new Error(`${auditPfad}: Audit-Eintrag ${a.id} geht beim Nachspielen nicht durchs Gate`);
    }
    if (amEnde) await amEnde(leer);
    const readiness = await leer.tools.graph_readiness.handler({});
    return {
      flach: flach(leer.graph()),
      gates: Object.fromEntries(readiness.phaseGates.map((x) => [x.id, x.passed])),
      readiness,
    };
  } finally {
    await leer.close();
  }
}
