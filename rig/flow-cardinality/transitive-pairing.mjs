// RIG flow-cardinality — die echte Paarung TRANSITIV.
//
// Befund aus repair-real.mjs + LSP: Modell-FUNC != Code-Funktion. graphcodes FUNCs sind
// konzeptionell grob (115 Knoten), der AST kennt 287 Funktionen. `FUNC-mutate` ruft laut LSP
// nur serializeWrite/applyMutation — beide klassenintern, keine Modell-FUNC. Ein DIREKTER
// Aufruf zwischen zwei Modell-FUNC ist die Ausnahme (21 von 399 AST-Paaren).
//
// Richtig ist die transitive Huelle: von Modell-FUNC A ueber beliebig viele NICHT-modellierte
// Funktionen bis zur naechsten Modell-FUNC B. Genau das ist "A haengt von B ab" auf der
// Granularitaet, auf der das Modell spricht.
import { astPairs } from './real-pairing.mjs';
import { openMeasured } from '../../dist/index.js';
import { resolve } from 'node:path';

const gid = (file, symbol) => 'func_' + [file, symbol].join('::').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');

export async function transitivePairs() {
  const { pairs } = astPairs();
  const m = await openMeasured({ graph: resolve('docs/graph/graphcode.graph.json'), systemId:'graphcode', repoRoot: resolve('.') });
  const g = await m.graph();
  const g2model = new Map();
  for (const n of g.nodes) {
    if (n.type !== 'FUNC') continue;
    let rr = n.attributes?.realRef; if (!rr) continue;
    if (typeof rr === 'string') { try { rr = JSON.parse(rr); } catch { continue; } }
    if (rr.file && rr.symbol) g2model.set(gid(rr.file, rr.symbol), n.uid);
  }
  await m.close();
  // Call-Graph ueber AST-Funktions-ids
  const out = new Map();
  for (const [a,b] of pairs) (out.get(a) ?? out.set(a,new Set()).get(a)).add(b);
  // Von jeder gemappten Quelle: BFS, Zwischenknoten ohne Modell-Entsprechung durchlaufen
  const result = new Set();
  for (const [src, srcUid] of g2model) {
    const seen = new Set([src]); const q = [...(out.get(src) ?? [])];
    while (q.length) {
      const cur = q.shift();
      if (seen.has(cur)) continue; seen.add(cur);
      const uid = g2model.get(cur);
      if (uid) { if (uid !== srcUid) result.add(`${srcUid}|${uid}`); continue; }  // Modell-FUNC: Endpunkt
      for (const nx of (out.get(cur) ?? [])) q.push(nx);                          // sonst: durchlaufen
    }
  }
  return { direct: pairs.length, mapped: g2model.size, transitive: result };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { direct, mapped, transitive } = await transitivePairs();
  console.log(`AST-Paare direkt: ${direct} | Modell-FUNC gemappt: ${mapped}`);
  console.log(`TRANSITIVE Modell-FUNC-Paare: ${transitive.size}   (direkt waren es 21)`);
  console.log('\nBeispiele:');
  console.log([...transitive].slice(0,8).map(p=>'  '+p.replace('|',' -> ')).join('\n'));
}
