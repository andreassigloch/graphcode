// RIG flow-cardinality — Reparatur mit der ECHTEN Paarung aus dem AST.
// Statt des Kreuzprodukts (674 Paar-FLOWs) nur die Paare, die graphify im Code wirklich findet.
import { openMeasured, stampLine } from '../../dist/index.js';
import { moduleMetrics, evaluateAllRules } from '@sigloch/contracts/se';
import { io02 } from './measure.mjs';
import { astPairs } from './real-pairing.mjs';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

// graphify: idFor2("func", file, symbol) — dieselbe Normalisierung, sonst trifft das Mapping nicht.
const gid = (file, symbol) =>
  'func_' + [file, symbol].join('::').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');

const { pairs, skipped } = astPairs();
const astPairSet = new Set(pairs.map(([a,b]) => `${a}|${b}`));
console.log(`AST: ${pairs.length} gerichtete Paare · ${skipped.length} Dateien uebersprungen (>=32 KB)`);

const m = await openMeasured({ graph: resolve('docs/graph/graphcode.graph.json'), systemId:'graphcode', repoRoot: resolve('.') });
console.log(stampLine(m.provenance));
const toOnt = g => ({ elements: g.nodes.map(n=>({id:n.uid,type:n.type,name:n.name,description:n.description,...(n.attributes??{})})),
                      traces: g.edges.map(e=>({source:e.sourceId,target:e.targetId,type:e.edgeType})) });
async function kpi(){
  const g=await m.graph(), o=toOnt(g);
  const mm=moduleMetrics(o,m.policy), vs=evaluateAllRules(o,m.policy);
  const c={}; for(const v of vs)c[v.rule_id]=(c[v.rule_id]??0)+1;
  return {n:g.nodes.length,e:g.edges.length,io02:io02(g).findings.length,
    lcom:mm.filter(x=>x.lcom4!==null).map(x=>`${x.moduleId.replace('MOD-','')}=${x.lcom4}`).join(' '),
    bw:c['BW-02']??0,cr:c['CR-01']??0,mt:c['MT-02']??0,io01:c['IO-01']??0,r31:c['R-31']??0,total:vs.length};
}
const g0=await m.graph();
// Modell-FUNC -> graphify-id, ueber realRef
const g2model = new Map();
let mapped=0;
for (const n of g0.nodes) {
  if (n.type!=='FUNC') continue;
  let rr = n.attributes?.realRef; if (!rr) continue;
  if (typeof rr==='string') { try { rr=JSON.parse(rr); } catch { continue; } }
  if (!rr.file || !rr.symbol) continue;
  g2model.set(gid(rr.file, rr.symbol), n.uid); mapped++;
}
console.log(`Modell-FUNC mit realRef auf AST abgebildet: ${mapped}`);
// echte Paare in Modell-uids
const modelPairs = new Set();
for (const [a,b] of pairs) { const A=g2model.get(a), B=g2model.get(b); if (A&&B&&A!==B) modelPairs.add(`${A}|${B}`); }
console.log(`davon Paare zwischen zwei MODELL-FUNC: ${modelPairs.size}\n`);

const byId=new Map(g0.nodes.map(n=>[n.uid,n]));
const P=new Map(),C=new Map(),S=new Map();
const add=(mp,k,v)=>(mp.get(k)??mp.set(k,new Set()).get(k)).add(v);
const isEnd=t=>t==='FUNC'||t==='ACTOR';
for(const e of g0.edges){
  if(e.edgeType==='relation'&&byId.get(e.sourceId)?.type==='FLOW'&&byId.get(e.targetId)?.type==='SCHEMA') S.set(e.sourceId,e.targetId);
  if(e.edgeType!=='io')continue;
  const st=byId.get(e.sourceId)?.type, tt=byId.get(e.targetId)?.type;
  if(isEnd(st)&&tt==='FLOW') add(P,e.targetId,e.sourceId);
  if(st==='FLOW'&&isEnd(tt))  add(C,e.sourceId,e.targetId);
}
const bad=[...new Set([...P.keys(),...C.keys()])].filter(f=>(P.get(f)?.size??0)>1||(C.get(f)?.size??0)>1);
const before=await kpi();

let belegt=0, unbelegt=0, ok=0;
for(const f of bad){
  const node=byId.get(f), adds=[];
  for(const p of [...(P.get(f)??[])].sort()) for(const c of [...(C.get(f)??[])].sort()){
    if(p===c) continue;
    const real = modelPairs.has(`${p}|${c}`);
    if (real) belegt++; else { unbelegt++; continue; }   // NUR belegte Paare anlegen
    const uid=`${f}--${p.replace(/^(FUNC|ACTOR)-/,'')}--${c.replace(/^(FUNC|ACTOR)-/,'')}`.slice(0,120);
    adds.push({op:'add-node',node:{uid,type:'FLOW',name:`${node.name} / ${p.replace(/^(FUNC|ACTOR)-/,'')}→${c.replace(/^(FUNC|ACTOR)-/,'')}`,description:node.description,attributes:node.attributes??{}}});
    adds.push({op:'add-edge',edge:{sourceId:p,targetId:uid,edgeType:'io'}});
    adds.push({op:'add-edge',edge:{sourceId:uid,targetId:c,edgeType:'io'}});
    if(S.get(f)) adds.push({op:'add-edge',edge:{sourceId:uid,targetId:S.get(f),edgeType:'relation'}});
  }
  if(!adds.length) continue;
  const r=await m.harness.mutate(adds,{author:'rig-repair-real'});
  if(!r.success) continue;
  const d=await m.harness.mutate([{op:'delete-node',uid:f}],{author:'rig-repair-real'});
  if(d.success) ok++;
}
const after=await kpi();
console.log(`Kreuzprodukt-Kandidaten: ${belegt+unbelegt} · im AST BELEGT: ${belegt} (${(100*belegt/(belegt+unbelegt)).toFixed(0)} %) · verworfen: ${unbelegt}`);
console.log(`${ok}/${bad.length} Busse aufgeloest\n`);
const row=(k,a,b)=>console.log(`${k.padEnd(18)} ${String(a).padStart(9)} ${String(b).padStart(9)}`);
console.log(`${'Kennzahl'.padEnd(18)} ${'VORHER'.padStart(9)} ${'NACHHER'.padStart(9)}`);
row('Knoten',before.n,after.n); row('Kanten',before.e,after.e); row('IO-02',before.io02,after.io02);
row('BW-02',before.bw,after.bw); row('CR-01',before.cr,after.cr); row('MT-02',before.mt,after.mt);
row('IO-01',before.io01,after.io01); row('R-31',before.r31,after.r31); row('Verstoesse',before.total,after.total);
console.log(`\nLCOM4 vorher : ${before.lcom}\nLCOM4 nachher: ${after.lcom}`);
const g=await m.graph();
mkdirSync('/private/tmp/claude-501/-Users-andreas-Developer-dev-graphcode/25acfeb9-bc3d-4b93-aa8c-4d3b0dff9293/scratchpad/io02-real/docs/graph',{recursive:true});
writeFileSync('/private/tmp/claude-501/-Users-andreas-Developer-dev-graphcode/25acfeb9-bc3d-4b93-aa8c-4d3b0dff9293/scratchpad/io02-real/docs/graph/io02-real.graph.json',
  JSON.stringify({elements:toOnt(g).elements,traces:g.edges.map(e=>({source:e.sourceId,target:e.targetId,type:e.edgeType,weight:1,created_at:'2026-09-10'})),graphVersion:1},null,2));
await m.close();
