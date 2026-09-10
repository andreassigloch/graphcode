// RIG flow-cardinality — Bestandszahl fuer den Regelkandidaten IO-02.
//
// FRAGE (revidiert 2026-09-10, Konfig-Fall): Hat ein FLOW genau EINEN Produzenten?
//
// These (Auftraggeber, 2026-09-10):
//   Code   def funcA(paramsA){ x = funcB(paramsB) }
//   Model  FuncA..1 -io- FLOW_a..1 -io- FuncB..1 ;  FLOW_a..1 -relation- SCHEMA(paramsB)..n
//   View   FuncA.port[FLOW_a] — FuncB.port[FLOW_a]
//
// Die SCHEMA-Haelfte IST Grammatik (META_MODEL: FLOW -relation-> SCHEMA cardinality '1',
// per R-18 erzwungen seit CR-SM-271 Teil 2). Die io-Haelfte ist NICHT deklariert — die vier
// io-Zeilen in TRACE_PATTERNS tragen kein cardinality-Feld, fallen also durch
// REQUIRED_PATTERNS (= filter(p => p.cardinality === '1')). Kein Gate hat je geprueft,
// wie viele Enden ein FLOW hat.
//
// WARUM NUR DIE PRODUZENTEN-SEITE (Entscheidung Auftraggeber, Konfig-Fall):
//   Mehrere Produzenten sind ein Modellfehler — der Inhalt eines FLOW kommt von EINER
//   Stelle. Haengen zwei Quellen dran, sind es zwei Fluesse unter einem Namen, und der
//   Leser kann nicht wissen, welche Fassung er bekommt. Beleg im Bestand:
//   FLOW-metric-policy hat ACTOR-owner UND load-config als Produzent — das sind die
//   Konfig-Datei und die geladene Policy, zwei Inhalte mit einem SCHEMA.
//   Mehrere Konsumenten sind normal. Wer abholt, aendert am Fluss nichts. Genau so
//   sieht eine zentrale Konfiguration aus: eine Quelle, viele Verbraucher (im Bestand
//   8 saubere 1:N-Faelle, u.a. FLOW-dimension-readiness 1x7).
//
// KANDIDAT IO-02:
//   domain     FLOW (nur solche mit >= 1 io-Kante)
//   Verstoss   |Produzenten| > 1                     (Endpunkt = FUNC oder ACTOR)
//   Anker      EIN Befund je FLOW (Klasse CR-SM-242, nicht je ueberzaehliger Kante)
//   Masse      value = |P|, threshold = 1            (CR-SM-288)
//   severity   error — Hygiene, nicht Steering (Entscheidung Auftraggeber 2026-09-10)
import { openMeasured, stampLine } from '../../dist/index.js';
import { resolve } from 'node:path';

const CORPUS = [
  ['graphcode',      'rig/graphs/graphcode.graph.json'],
  ['graph-view-edit','rig/graphs/graph-view-edit.graph.json'],
  ['bok',            'rig/graphs/bok.graph.json'],
  ['moneyflow',      'rig/graphs/moneyflow.graph.json'],
  ['gc_test-gv',     'rig/graphs/gc_test-graphview.graph.json'],
  // Referenz des Auftraggebers: so SOLL es aussehen. Ausserhalb des eingefrorenen Korpus.
  ['test_karp',      '/Users/andreas/Developer/dev/test_karp/docs/graph/test_karp.graph.json'],
];

// Endpunkt-Zaehlung: liefert je FLOW die Mengen P (Produzenten) und K (Konsumenten).
export function endpoints(graph) {
  const byId = new Map(graph.nodes.map(e => [e.uid, e]));
  const P = new Map(), C = new Map();
  const add = (m,k,v) => (m.get(k) ?? m.set(k,new Set()).get(k)).add(v);
  const isEnd = t => t === 'FUNC' || t === 'ACTOR';
  for (const t of graph.edges) {
    if (t.edgeType !== 'io') continue;
    const st = byId.get(t.sourceId)?.type, tt = byId.get(t.targetId)?.type;
    if (isEnd(st) && tt === 'FLOW') add(P, t.targetId, t.sourceId);
    if (st === 'FLOW' && isEnd(tt))  add(C, t.sourceId, t.targetId);
  }
  return { P, C, wired: new Set([...P.keys(), ...C.keys()]) };
}

export function io02(graph) {
  const { P, C, wired } = endpoints(graph);
  const findings = [];
  let bothSided = 0;          // Vergleichszahl: was die verworfene beidseitige Fassung faende
  let oneToMany = 0;          // saubere 1:N — genau der Konfig-Fall
  for (const f of [...wired].sort()) {
    const p = P.get(f)?.size ?? 0, c = C.get(f)?.size ?? 0;
    if (p > 1 || c > 1) bothSided++;
    if (p === 1 && c > 1) oneToMany++;
    if (p <= 1) continue;
    findings.push({ rule_id:'IO-02', severity:'error', element_id:f,
      message:`${f} hat ${p} Produzenten — der Inhalt eines FLOW kommt von genau einer Stelle`,
      fix_hint:'Je Quelle einen eigenen FLOW anlegen; den gemeinsamen Vertrag traegt das SCHEMA (n FLOW -> 1 SCHEMA)',
      context:{ value: p, threshold: 1, producers:p, consumers:c } });
  }
  return { findings, wired: wired.size, bothSided, oneToMany };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('RIG flow-cardinality — Kandidat IO-02 (ein FLOW, ein Produzent)\n');
  console.log('System           FLOW(io)  IO-02   Quote  schlimmster   |  beidseitig  davon 1:N');
  for (const [id, rel] of CORPUS) {
    const abs = rel.startsWith('/') ? rel : resolve(process.cwd(), rel);
    let m;
    try { m = await openMeasured({ graph: abs, systemId: id }); }
    catch (e) { console.log(`${id.padEnd(16)} — nicht ladbar: ${String(e.message).slice(0,60)}`); continue; }
    try {
      const { findings, wired, bothSided, oneToMany } = io02(await m.graph());
      const worst = findings.reduce((a,b) => (b.context.value > (a?.context.value ?? 0) ? b : a), null);
      const q = wired ? (100*findings.length/wired).toFixed(0)+' %' : '—';
      console.log(`${id.padEnd(16)} ${String(wired).padStart(6)} ${String(findings.length).padStart(6)} ${q.padStart(7)}`
        + `  ${(worst ? `${worst.element_id} (${worst.context.value}P)` : '—').padEnd(30)}`
        + `| ${String(bothSided).padStart(9)} ${String(oneToMany).padStart(10)}`);
      console.log(`                 ${stampLine(m.provenance)}`);
    } finally { await m.close(); }
  }
}
