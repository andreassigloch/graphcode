// RIG flow-cardinality / Schritt 3+5 — Graph aendern, Kennzahlen davor und danach.
//
// Repariert FLOW-mutate-cmd (17 Produzenten x 3 Konsumenten) nach der These:
// je Verbindung ein FLOW, alle auf demselben SCHEMA-mutate-command.
//
// PAARUNG — die Annahme steht hier, nicht im Ergebnis:
//   host-socket -> mutate        (Socket schreibt direkt ans Gate)
//   preflight   -> mutate        (der Vorposten reicht weiter; executor.ts importiert preflightBatch)
//   alle uebrigen -> preflight   (Autoren-/Skill-Pfad laeuft ueber den Vorposten)
//
// Gefahren wird auf dem WEGWERF-Store von openMeasured. harness.mutate statt Tool-Layer,
// weil hier keine Trajektorie entstehen soll — dasselbe Gate, dieselben Regeln.
import { openMeasured, stampLine } from '../../dist/index.js';
import { moduleMetrics, evaluateAllRules } from '@sigloch/contracts/se';
import { metrics as fitMetrics } from '@sigloch/se-engine';
import { io02 } from './measure.mjs';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const BUS = 'FLOW-mutate-cmd', SCHEMA = 'SCHEMA-mutate-command';
const m = await openMeasured({ graph: resolve('docs/graph/graphcode.graph.json'), systemId: 'graphcode', repoRoot: resolve('.') });
console.log(stampLine(m.provenance) + '\n');

const toOnt = g => ({ elements: g.nodes.map(n => ({ ...n, id: n.uid })),
                      traces: g.edges.map(e => ({ source: e.sourceId, target: e.targetId, type: e.edgeType })) });

async function snapshot(label) {
  const g = await m.graph(); const o = toOnt(g);
  const mm = moduleMetrics(o, m.policy);
  const vs = evaluateAllRules(o, m.policy);
  const c = {}; for (const v of vs) c[v.rule_id] = (c[v.rule_id] ?? 0) + 1;
  const fit = fitMetrics(o, { layer: 'arch' });
  const { findings } = io02(g);
  return { label, nodes: g.nodes.length, edges: g.edges.length, io02: findings.length,
    lcom4: Object.fromEntries(mm.filter(x => x.lcom4 !== null).map(x => [x.moduleId.replace('MOD-',''), x.lcom4])),
    rules: { 'BW-02': c['BW-02']??0, 'CR-01': c['CR-01']??0, 'MT-02': c['MT-02']??0, 'R-04': c['R-04']??0,
             'R-31': c['R-31']??0, 'IO-01': c['IO-01']??0, 'R-18': c['R-18']??0, total: vs.length },
    fit: Object.fromEntries(Object.entries(fit).map(([k,v]) => [k, +v.toFixed(3)])) };
}

const before = await snapshot('VORHER');

// --- Schritt 3: die Mutation ---
const g0 = await m.graph();
const P = new Set(), C = new Set();
for (const e of g0.edges) {
  if (e.edgeType !== 'io') continue;
  if (e.targetId === BUS) P.add(e.sourceId);
  if (e.sourceId === BUS) C.add(e.targetId);
}
const partner = p => (p === 'FUNC-host-socket' || p === 'FUNC-preflight') ? 'FUNC-mutate' : 'FUNC-preflight';
const busNode = g0.nodes.find(n => n.uid === BUS);
const adds = [];
for (const p of [...P].sort()) {
  const k = partner(p); if (k === p) continue;
  const uid = `${BUS}--${p.replace('FUNC-','')}`;
  adds.push({ op:'add-node', node:{ uid, type:'FLOW', name:`${busNode.name} / ${p.replace('FUNC-','')}`,
              description: busNode.description, attributes: busNode.attributes ?? {} } });
  adds.push({ op:'add-edge', edge:{ sourceId:p, targetId:uid, edgeType:'io' } });
  adds.push({ op:'add-edge', edge:{ sourceId:uid, targetId:k, edgeType:'io' } });
  adds.push({ op:'add-edge', edge:{ sourceId:uid, targetId:SCHEMA, edgeType:'relation' } });
}
const r1 = await m.harness.mutate(adds, { author:'rig-flow-cardinality' });
console.log(`Batch 1 (anlegen): ${r1.success ? 'OK' : 'BLOCKIERT'} — ${adds.length} Kommandos, tier=${r1.tier}`);
if (!r1.success) console.log('  ' + (r1.violations??[]).slice(0,4).map(v=>`${v.ruleId ?? v.rule_id}: ${v.message}`).join('\n  '));

const r2 = await m.harness.mutate([{ op:'delete-node', uid: BUS }], { author:'rig-flow-cardinality' });
console.log(`Batch 2 (Bus loeschen): ${r2.success ? 'OK' : 'BLOCKIERT'}, tier=${r2.tier}`);

const after = await snapshot('NACHHER');

// --- Schritt 5: Kennzahlen ---
const row = (a,b,k) => `${k.padEnd(18)} ${String(a).padStart(9)} ${String(b).padStart(9)}`;
console.log(`\n${'Kennzahl'.padEnd(18)} ${'VORHER'.padStart(9)} ${'NACHHER'.padStart(9)}`);
console.log(row(before.nodes, after.nodes, 'Knoten'));
console.log(row(before.edges, after.edges, 'Kanten'));
console.log(row(before.io02, after.io02, 'IO-02-Verstoesse'));
for (const k of Object.keys(before.rules)) console.log(row(before.rules[k], after.rules[k], k));
console.log('\nLCOM4:');
for (const k of Object.keys(before.lcom4)) console.log(row(before.lcom4[k], after.lcom4[k] ?? '—', '  '+k));
console.log('\nFit (arch):');
for (const k of Object.keys(before.fit)) console.log(row(before.fit[k], after.fit[k], '  '+k));

mkdirSync('rig/flow-cardinality/results', { recursive: true });
const gz = await m.graph();
writeFileSync('rig/flow-cardinality/results/graphcode-io02-repaired.graph.json',
  JSON.stringify({ elements: gz.nodes.map(n=>({id:n.uid,type:n.type,name:n.name,description:n.description,status:n.status})),
                   traces: gz.edges.map(e=>({source:e.sourceId,target:e.targetId,type:e.edgeType,weight:1,created_at:'2026-09-10'})),
                   graphVersion: 999 }, null, 2));
console.log('\nExport fuer den View-Check: rig/flow-cardinality/results/graphcode-io02-repaired.graph.json');
await m.close();
