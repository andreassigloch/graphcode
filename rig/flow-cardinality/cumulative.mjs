// RIG flow-cardinality / Schritt 5 — ist die Wirkung der Reparatur ADDITIV?
//
// Lauf 1 (repair.mjs) hat EINEN Bus repariert: IO-02 28->27, jede andere Kennzahl unveraendert.
// Frage: liegt das am einen Bus, oder bewegt sich die Zahl erst, wenn ALLE weg sind?
//
// Paarung: je Produzent ein eigener FLOW, die Konsumenten bleiben an jedem Teil-FLOW.
// Das loest die PRODUZENTEN-Seite auf — und genau die liest LCOM4 (`idx.out(fid,'io')`).
// Keine erfundene Paarung, deshalb auch keine zerrissenen Wirkketten.
import { openMeasured, stampLine } from '../../dist/index.js';
import { moduleMetrics, evaluateAllRules } from '@sigloch/contracts/se';
import { io02 } from './measure.mjs';
import { resolve } from 'node:path';

const m = await openMeasured({ graph: resolve('docs/graph/graphcode.graph.json'), systemId:'graphcode', repoRoot: resolve('.') });
console.log(stampLine(m.provenance) + '\n');

// CR-GC-302-Klasse: die Attribute liegen im Harness unter `attributes`, die Regeln lesen sie FLACH.
const toOnt = g => ({
  elements: g.nodes.map(n => ({ id:n.uid, type:n.type, name:n.name, description:n.description, ...(n.attributes ?? {}) })),
  traces: g.edges.map(e => ({ source:e.sourceId, target:e.targetId, type:e.edgeType })),
});

async function kpi() {
  const g = await m.graph(); const o = toOnt(g);
  const mm = moduleMetrics(o, m.policy);
  const vs = evaluateAllRules(o, m.policy);
  const c = {}; for (const v of vs) c[v.rule_id] = (c[v.rule_id]??0)+1;
  return { io02: io02(g).findings.length,
    lcom: mm.filter(x=>x.lcom4!==null).map(x=>`${x.moduleId.replace('MOD-','')}=${x.lcom4}`).join(' '),
    r18: c['R-18']??0, mt02: c['MT-02']??0, bw02: c['BW-02']??0, cr01: c['CR-01']??0, total: vs.length };
}

async function busse() {
  const g = await m.graph();
  const P=new Map(), C=new Map(), S=new Map();
  const add=(m,k,v)=>(m.get(k)??m.set(k,new Set()).get(k)).add(v);
  const byId=new Map(g.nodes.map(n=>[n.uid,n]));
  const isEnd=t=>t==='FUNC'||t==='ACTOR';
  for(const e of g.edges){
    if(e.edgeType==='relation'&&byId.get(e.sourceId)?.type==='FLOW'&&byId.get(e.targetId)?.type==='SCHEMA') S.set(e.sourceId,e.targetId);
    if(e.edgeType!=='io')continue;
    const st=byId.get(e.sourceId)?.type, tt=byId.get(e.targetId)?.type;
    if(isEnd(st)&&tt==='FLOW') add(P,e.targetId,e.sourceId);
    if(st==='FLOW'&&isEnd(tt))  add(C,e.sourceId,e.targetId);
  }
  return [...new Set([...P.keys(),...C.keys()])]
    .filter(f => (P.get(f)?.size??0) > 1)                      // nur die mit mehreren PRODUZENTEN
    .sort((a,b) => (P.get(b).size*(C.get(b)?.size??1)) - (P.get(a).size*(C.get(a)?.size??1)))
    .map(f => ({ f, P:[...(P.get(f)??[])], C:[...(C.get(f)??[])], S:S.get(f), node:byId.get(f) }));
}

const list = await busse();
console.log(`${list.length} FLOWs mit mehr als einem Produzenten — kumulativ repariert:\n`);
const k0 = await kpi();
console.log(`${'nach Bus'.padEnd(30)} ${'IO-02'.padStart(5)} ${'MT-02'.padStart(5)} ${'BW-02'.padStart(5)}  LCOM4`);
console.log(`${'(Ausgang)'.padEnd(30)} ${String(k0.io02).padStart(5)} ${String(k0.mt02).padStart(5)} ${String(k0.bw02).padStart(5)}  ${k0.lcom}`);

let done = 0;
for (const b of list) {
  const adds = [];
  for (const p of b.P.sort()) {
    const uid = `${b.f}--${p.replace(/^(FUNC|ACTOR)-/,'')}`;
    adds.push({ op:'add-node', node:{ uid, type:'FLOW', name:`${b.node.name} / ${p}`, description:b.node.description, attributes:b.node.attributes??{} } });
    adds.push({ op:'add-edge', edge:{ sourceId:p, targetId:uid, edgeType:'io' } });
    if (b.S) adds.push({ op:'add-edge', edge:{ sourceId:uid, targetId:b.S, edgeType:'relation' } });
    for (const c of b.C) if (c !== p) adds.push({ op:'add-edge', edge:{ sourceId:uid, targetId:c, edgeType:'io' } });
  }
  const r1 = await m.harness.mutate(adds, { author:'rig-cumulative' });
  if (!r1.success) { console.log(`  ${b.f}: BLOCKIERT — ${(r1.violations??[]).slice(0,1).map(v=>v.message).join('')}`); continue; }
  await m.harness.mutate([{ op:'delete-node', uid:b.f }], { author:'rig-cumulative' });
  done++;
  const k = await kpi();
  console.log(`${(String(done).padStart(2)+'. '+b.f).padEnd(30)} ${String(k.io02).padStart(5)} ${String(k.mt02).padStart(5)} ${String(k.bw02).padStart(5)}  ${k.lcom}`);
}
await m.close();
