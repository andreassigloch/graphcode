/**
 * nachspielen-rein.ts — Testhelfer (CR-GC-764): die angewandten Mutationen eines Audits in Reihenfolge durch
 * `applyCommands`, ohne Store und ohne Gate-Urteil. Liefert den Endgraphen als Harness-Graph und die Zahl der Züge —
 * für Eigenschaftstests über Trails (`generate.statemachine.test.ts`).
 *
 * Herkunft: `auswertung/nachspielen.mjs` (`nachspielenRein`). Die Auswertung ist mit dem Rig nach graphanalyze
 * gezogen; dort lebt auch das Nachspielen durchs echte Gate. Hier bleibt nur dieser reine Teil, als Testeingabe.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync } from 'node:fs';
import { applyCommands, cloneGraph } from '../../src/kernel/apply-commands.js';

type Kommandos = Parameters<typeof applyCommands>[1];
type AuditZeile = { operation: string; result: string; commands?: Kommandos };

export function nachspielenRein(auditPfad: string) {
  const alle = readFileSync(auditPfad, 'utf8').split('\n').filter(Boolean)
    .map((l) => JSON.parse(l) as AuditZeile).filter((a) => a.operation === 'mutate');
  let graph: Parameters<typeof applyCommands>[0] = { nodes: [], edges: [] };
  let zuege = 0;
  for (const a of alle) {
    if (a.result !== 'applied' || !a.commands?.length) continue;
    graph = applyCommands(cloneGraph(graph), a.commands).graph;
    zuege++;
  }
  return { zuege, abgelehnt: alle.filter((a) => a.result !== 'applied').length, graph };
}
