// RIG flow-cardinality — die ECHTE Paarung aus dem AST, nicht aus dem Kreuzprodukt.
//
// graphify (tree-sitter) extrahiert aus src/ einen Call-Graphen und erzeugt dabei FLOWs, die
// die These bereits erfuellen: max 1 Produzent, max 1 Konsument, 0 IO-02-Verstoesse,
// 2,08 FLOW je SCHEMA (test_karp: 2,10). Diese Paarung wird hier auf die Modell-FUNCs
// abgebildet — ueber realRef {file,symbol}, nicht ueber Namensraten.
import { extractCodeRepo } from '@sigloch/graphify';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

export function astPairs() {
  const paths = execSync("find src -name '*.ts'", {encoding:'utf8'}).trim().split('\n');
  // CR-GF-148 (2026-09-10) hat die 32-KB-Grenze des tree-sitter-Bindings aufgehoben:
  // alle Dateien parsen. Der verbleibende Blindfleck sind Klassenmethoden (ITEM-2026-023).
  const skipped = [];
  const files = paths.map(p => ({ path:p, content: readFileSync(p,'utf8') }));
  const r = extractCodeRepo(files);
  const byId = new Map(r.nodes.map(n => [n.id, n]));
  // FUNC-Knoten von graphify trage file+symbol, damit sie auf realRef abbildbar sind
  const sig = new Map();  // "file::symbol" -> graphify-FUNC-id
  for (const n of r.nodes) {
    if (n.type !== 'FUNC') continue;
    const f = n.attributes?.file ?? n.file ?? n.attributes?.realRef?.file;
    const s = n.attributes?.symbol ?? n.symbol ?? n.name;
    if (f && s) sig.set(`${f}::${s}`, n.id);
  }
  // io-Paare: FUNC -> FLOW -> FUNC
  const prod = new Map(), cons = new Map();
  for (const e of r.edges) {
    if (e.edgeType !== 'io' && e.type !== 'io') continue;
    const s = e.source ?? e.sourceId, t = e.target ?? e.targetId;
    if (byId.get(s)?.type === 'FUNC' && byId.get(t)?.type === 'FLOW') prod.set(t, s);
    if (byId.get(s)?.type === 'FLOW' && byId.get(t)?.type === 'FUNC') cons.set(s, t);
  }
  const pairs = [];
  for (const [flow, p] of prod) { const c = cons.get(flow); if (c && c !== p) pairs.push([p, c, flow]); }
  return { pairs, sig, nodes: r.nodes, skipped, flows: prod.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { pairs, sig, nodes, skipped, flows } = astPairs();
  console.log(`AST: ${nodes.filter(n=>n.type==='FUNC').length} FUNC, ${flows} FLOW, ${pairs.length} gerichtete FUNC->FUNC-Paare`);
  console.log(`uebersprungen (>=32 KB, tree-sitter): ${skipped.length} — ${skipped.join(', ')}`);
  const sample = nodes.find(n=>n.type==='FUNC');
  console.log('\nFUNC-Knoten von graphify, Beispiel:');
  console.log(JSON.stringify(sample).slice(0,320));
  console.log('\nsig-Eintraege (file::symbol -> id):', sig.size);
}
