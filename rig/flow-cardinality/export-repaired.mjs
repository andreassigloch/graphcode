// RIG flow-cardinality — den vollstaendig reparierten Graphen fuer den View-Check exportieren.
// Loest ALLE FLOWs mit mehr als einem Produzenten auf (je Produzent ein FLOW, gleiches SCHEMA),
// durch das Gate, auf dem Wegwerf-Store. Das Quell-Repo wird nur gelesen.
import { openMeasured, stampLine } from '../../dist/index.js';
import { io02 } from './measure.mjs';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const m = await openMeasured({ graph: resolve('docs/graph/graphcode.graph.json'), systemId:'graphcode', repoRoot: resolve('.') });
console.log(stampLine(m.provenance));
const g0 = await m.graph();
const byId = new Map(g0.nodes.map(n=>[n.uid,n]));
const P=new Map(), C=new Map(), S=new Map();
const add=(mp,k,v)=>(mp.get(k)??mp.set(k,new Set()).get(k)).add(v);
const isEnd=t=>t==='FUNC'||t==='ACTOR';
for(const e of g0.edges){
  if(e.edgeType==='relation'&&byId.get(e.sourceId)?.type==='FLOW'&&byId.get(e.targetId)?.type==='SCHEMA') S.set(e.sourceId,e.targetId);
  if(e.edgeType!=='io')continue;
  const st=byId.get(e.sourceId)?.type, tt=byId.get(e.targetId)?.type;
  if(isEnd(st)&&tt==='FLOW') add(P,e.targetId,e.sourceId);
  if(st==='FLOW'&&isEnd(tt))  add(C,e.sourceId,e.targetId);
}
const busse=[...new Set([...P.keys(),...C.keys()])].filter(f=>(P.get(f)?.size??0)>1);
let ok=0;
for(const f of busse){
  const node=byId.get(f), adds=[];
  for(const p of [...P.get(f)].sort()){
    const uid=`${f}--${p.replace(/^(FUNC|ACTOR)-/,'')}`;
    adds.push({op:'add-node',node:{uid,type:'FLOW',name:`${node.name} / ${p.replace(/^(FUNC|ACTOR)-/,'')}`,description:node.description,attributes:node.attributes??{}}});
    adds.push({op:'add-edge',edge:{sourceId:p,targetId:uid,edgeType:'io'}});
    if(S.get(f)) adds.push({op:'add-edge',edge:{sourceId:uid,targetId:S.get(f),edgeType:'relation'}});
    for(const c of (C.get(f)??[])) if(c!==p) adds.push({op:'add-edge',edge:{sourceId:uid,targetId:c,edgeType:'io'}});
  }
  const r=await m.harness.mutate(adds,{author:'rig-export-repaired'});
  if(!r.success){ console.log(`  BLOCKIERT ${f}`); continue; }
  const d=await m.harness.mutate([{op:'delete-node',uid:f}],{author:'rig-export-repaired'});
  if(d.success) ok++;
}
const g=await m.graph();
console.log(`\n${ok}/${busse.length} Busse aufgeloest | IO-02 ${io02(g0).findings.length} -> ${io02(g).findings.length}`);
console.log(`Knoten ${g0.nodes.length} -> ${g.nodes.length} | Kanten ${g0.edges.length} -> ${g.edges.length}`);
const out = { elements: g.nodes.map(n=>({ id:n.uid, type:n.type, name:n.name, description:n.description, ...(n.attributes??{}) })),
              traces: g.edges.map(e=>({ source:e.sourceId, target:e.targetId, type:e.edgeType, weight:1, created_at:'2026-09-10' })),
              graphVersion: 1 };
mkdirSync('/private/tmp/claude-501/-Users-andreas-Developer-dev-graphcode/25acfeb9-bc3d-4b93-aa8c-4d3b0dff9293/scratchpad/io02-repo/docs/graph',{recursive:true});
writeFileSync('/private/tmp/claude-501/-Users-andreas-Developer-dev-graphcode/25acfeb9-bc3d-4b93-aa8c-4d3b0dff9293/scratchpad/io02-repo/docs/graph/io02-repo.graph.json', JSON.stringify(out,null,2));
console.log('geschrieben: scratchpad/io02-repo/docs/graph/io02-repo.graph.json');
await m.close();
