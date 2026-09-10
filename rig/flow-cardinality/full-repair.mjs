// RIG flow-cardinality / Vollreparatur — beide Seiten, plus SCHEMA-Relation je FLOW.
//
// These: FuncA..1 -io- FLOW_a..1 -io- FuncB..1 ; FLOW_a..1 -relation- SCHEMA..n
// Also: je (Produzent, Konsument)-PAAR ein FLOW, jeder mit genau einer relation aufs SCHEMA
// des Ursprungs-FLOWs. Die Paarung ist hier das Kreuzprodukt — die echte steht nicht im
// Modell (s. ITEM-2026-019). Das ist die OBERGRENZE, und genau deshalb aussagekraeftig:
// was hier passiert, ist das Schlimmste, was die These fordern kann.
import { openMeasured, stampLine } from '../../dist/index.js';
import { moduleMetrics, evaluateAllRules } from '@sigloch/contracts/se';
import { io02 } from './measure.mjs';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const m = await openMeasured({ graph: resolve('docs/graph/graphcode.graph.json'), systemId:'graphcode', repoRoot: resolve('.') });
console.log('\n' + stampLine(m.provenance));
const toOnt = g => ({
  elements: g.nodes.map(n => ({ id:n.uid, type:n.type, name:n.name, description:n.description, ...(n.attributes ?? {}) })),
  traces: g.edges.map(e => ({ source:e.sourceId, target:e.targetId, type:e.edgeType })),
});
async function kpi(){
  const g=await m.graph(), o=toOnt(g);
  const mm=moduleMetrics(o,m.policy), vs=evaluateAllRules(o,m.policy);
  const c={}; for(const v of vs)c[v.rule_id]=(c[v.rule_id]??0)+1;
  return { n:g.nodes.length, e:g.edges.length, io02:io02(g).findings.length,
    lcom:mm.filter(x=>x.lcom4!==null).map(x=>`${x.moduleId.replace('MOD-','')}=${x.lcom4}`).join(' '),
    bw:c['BW-02']??0, cr:c['CR-01']??0, mt:c['MT-02']??0, r04:c['R-04']??0, r18:c['R-18']??0,
    r31:c['R-31']??0, io01:c['IO-01']??0, total:vs.length };
}
const g0=await m.graph();
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
const flows=[...new Set([...P.keys(),...C.keys()])];
const bad=flows.filter(f=>(P.get(f)?.size??0)>1||(C.get(f)?.size??0)>1);
const ohneSchema=bad.filter(f=>!S.has(f));
let paare=0; for(const f of bad){ const p=P.get(f)?.size??0,c=C.get(f)?.size??0; paare+=Math.max(1,p)*Math.max(1,c); }
console.log(`\n${bad.length} verletzende FLOWs -> ${paare} Paar-FLOWs (Kreuzprodukt).`);
console.log(`davon ohne SCHEMA-Relation: ${ohneSchema.length}${ohneSchema.length?' -> '+ohneSchema.join(', '):''}`);
const before=await kpi();

let ok=0, blocked=0;
for(const f of bad){
  const node=byId.get(f), adds=[];
  const ps=[...(P.get(f)??[])].sort(), cs=[...(C.get(f)??[])].sort();
  for(const p of ps) for(const c of cs){
    if(p===c) continue;
    const uid=`${f}--${p.replace(/^(FUNC|ACTOR)-/,'')}--${c.replace(/^(FUNC|ACTOR)-/,'')}`.slice(0,120);
    adds.push({op:'add-node',node:{uid,type:'FLOW',name:`${node.name} / ${p.replace(/^(FUNC|ACTOR)-/,'')}→${c.replace(/^(FUNC|ACTOR)-/,'')}`,description:node.description,attributes:node.attributes??{}}});
    adds.push({op:'add-edge',edge:{sourceId:p,targetId:uid,edgeType:'io'}});
    adds.push({op:'add-edge',edge:{sourceId:uid,targetId:c,edgeType:'io'}});
    if(S.get(f)) adds.push({op:'add-edge',edge:{sourceId:uid,targetId:S.get(f),edgeType:'relation'}});
  }
  if(!adds.length) continue;
  const r=await m.harness.mutate(adds,{author:'rig-full-repair'});
  if(!r.success){ blocked++; console.log(`  BLOCKIERT ${f}: ${(r.violations??[]).slice(0,1).map(v=>String(v.message).slice(0,80))}`); continue; }
  const d=await m.harness.mutate([{op:'delete-node',uid:f}],{author:'rig-full-repair'});
  if(d.success) ok++;
}
const after=await kpi();
console.log(`\n${ok} aufgeloest, ${blocked} blockiert\n`);
const row=(k,a,b)=>console.log(`${k.padEnd(20)} ${String(a).padStart(9)} ${String(b).padStart(9)}`);
console.log(`${'Kennzahl'.padEnd(20)} ${'VORHER'.padStart(9)} ${'NACHHER'.padStart(9)}`);
row('Knoten',before.n,after.n); row('Kanten',before.e,after.e);
row('IO-02',before.io02,after.io02); row('BW-02',before.bw,after.bw); row('CR-01',before.cr,after.cr);
row('MT-02',before.mt,after.mt); row('R-04',before.r04,after.r04); row('R-18',before.r18,after.r18);
row('R-31',before.r31,after.r31); row('IO-01',before.io01,after.io01); row('Verstoesse ges.',before.total,after.total);
console.log(`\nLCOM4 vorher : ${before.lcom}\nLCOM4 nachher: ${after.lcom}`);
const g=await m.graph();
mkdirSync('/private/tmp/claude-501/-Users-andreas-Developer-dev-graphcode/25acfeb9-bc3d-4b93-aa8c-4d3b0dff9293/scratchpad/io02-full/docs/graph',{recursive:true});
writeFileSync('/private/tmp/claude-501/-Users-andreas-Developer-dev-graphcode/25acfeb9-bc3d-4b93-aa8c-4d3b0dff9293/scratchpad/io02-full/docs/graph/io02-full.graph.json',
  JSON.stringify({elements:toOnt(g).elements,traces:g.edges.map(e=>({source:e.sourceId,target:e.targetId,type:e.edgeType,weight:1,created_at:'2026-09-10'})),graphVersion:1},null,2));
console.log('\nExport: scratchpad/io02-full/docs/graph/io02-full.graph.json');
await m.close();
