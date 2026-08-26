#!/usr/bin/env node
/**
 * CR-GC-432 - Falsifikationstest fuer Kern-Claim A: "Die Regeln lassen Agenten selbst steuern."
 * READ-ONLY. Kein Produktionscode, kein Modell-Schreibvorgang, keine Regelaenderung.
 *
 * FRAGE (deterministisch, ohne LLM): Folgten die REALEN Reparaturen den Regel-Hinweisen?
 * Wenn die Schliessung einer Violation dem `fixHint` ihrer Regel entspricht, hat die Regel
 * gesteuert. Verschwand sie auf anderem Weg (Loeschung, veraenderte Grundgesamtheit, Zufall),
 * hat sie es nicht.
 *
 * Baut auf CR-GC-427 auf (678 Episoden ueber 73 Staende), aber mit FEINERER Aufloesung:
 * die `how`-Klassifikation aus 427 ist priorisiert-grob (Status > Kante > Attribut) und sagt
 * NICHT, WELCHE Kante / WELCHES Attribut. Fuer Hint-Konformanz braucht es genau das.
 *
 * MESSPFAD = DER PRODUKTPFAD, identisch zu 427: derselbe `elementToNode`-Mapper,
 * derselbe `createSeDescriptor(metricPolicy)` + `DefaultRuleEngine`. Der Regel-Build ist
 * per `--core <dir>` der gepinnte Produktstand (contracts 6.3.0), nicht der verlinkte Baum.
 *
 * Aufruf:
 *   node scripts/spike-hint-konformanz.mjs --core <pinned-install> [--json <pfad>] [--dump-hints]
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { elementToNode, loadGraphcodeConfig } from '../dist/index.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const REL = 'docs/graph/graphcode.graph.json';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const JSON_OUT = arg('--json');
const CORE_DIR = arg('--core');
const DUMP_HINTS = process.argv.includes('--dump-hints');

const coreEntry = CORE_DIR
  ? pathToFileURL(join(CORE_DIR, 'node_modules/@sigloch/graph-api-core/dist/index.js')).href
  : '@sigloch/graph-api-core';
const { createSeDescriptor, DefaultRuleEngine } = await import(coreEntry);

function pkgVersion(base, name) {
  const p = join(base, 'node_modules/@sigloch', name, 'package.json');
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).version : '?';
  } catch {
    return '?';
  }
}
const buildBase = CORE_DIR ?? REPO;
const RULE_BUILD = {
  source: CORE_DIR ? `expliziter Install ${CORE_DIR}` : `Repo-Aufloesung ${REPO}/node_modules`,
  core: pkgVersion(buildBase, 'graph-api-core'),
  contracts: pkgVersion(buildBase, 'contracts'),
};

const git = (root, args) => execFileSync('git', ['-C', root, ...args], { maxBuffer: 1 << 30 }).toString();
const n = (x, w = 5) => String(x).padStart(w);
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + ' %' : '-');
const line = (c = '-') => console.log(c.repeat(100));

// ---------------------------------------------------------------------------
// Der EINE Auswertungspfad (identisch zu scripts/spike-nachweis-history.mjs).
// ---------------------------------------------------------------------------
const policy = loadGraphcodeConfig(REPO).config.metricPolicy;
const descriptor = createSeDescriptor(policy);
const engine = new DefaultRuleEngine(descriptor.version);
engine.register(descriptor.rules ?? []);

function toGraph(ontology) {
  const nodes = (ontology.elements ?? []).map((e) => elementToNode(e));
  const edges = (ontology.traces ?? []).map((t) => {
    const { source, target, type, ...rest } = t;
    return { sourceId: source, targetId: target, edgeType: type, attributes: rest };
  });
  return { nodes, edges };
}

/** Violation-Identitaet ueber die Zeit: Regel + Element (wie 427). */
const vkey = (v) => `${v.ruleId}|${v.elementId ?? '<graph>'}`;

// Bookkeeping-Felder: aendern sich bei JEDER Edit und sind nie der Fix selbst.
const BOOKKEEPING = new Set(['created_at', 'updated_at', 'closed_at']);

function revisions() {
  return git(REPO, ['log', '--format=%H|%h|%ad|%an|%s', '--date=short', '--reverse', '--', REL])
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [full, sha, date, author, ...rest] = l.split('|');
      return { full, sha, date, author, subject: rest.join('|') };
    });
}

// ===========================================================================
// 1 - Zeitreihe mit VOLLEN Violation-Records (inkl. fixHint) + Element-Snapshots
// ===========================================================================
const revs = revisions();
const series = [];
const unreadable = [];

for (const r of revs) {
  let ontology;
  try {
    ontology = JSON.parse(git(REPO, ['show', `${r.sha}:${REL}`]));
  } catch (e) {
    unreadable.push({ ...r, reason: String(e.message ?? e).slice(0, 90) });
    continue;
  }
  if (!Array.isArray(ontology.elements) || !Array.isArray(ontology.traces)) {
    unreadable.push({ ...r, reason: 'Schema-Drift: kein elements/traces-Array' });
    continue;
  }
  let violations;
  try {
    violations = engine.evaluate(toGraph(ontology));
  } catch (e) {
    unreadable.push({ ...r, reason: `Regel-Engine warf: ${String(e.message ?? e).slice(0, 90)}` });
    continue;
  }

  // Element-Snapshot: Attribute (ohne Bookkeeping), Status, inzidente Kanten mit Typ+Richtung.
  const elems = new Map();
  for (const e of ontology.elements) {
    const attrs = {};
    for (const [k, v] of Object.entries(e)) {
      if (k === 'id' || BOOKKEEPING.has(k)) continue;
      attrs[k] = JSON.stringify(v ?? null);
    }
    elems.set(e.id, { type: e.type, status: e.status ?? null, attrs });
  }
  const incident = new Map();
  const addInc = (id, key) => {
    if (!incident.has(id)) incident.set(id, new Set());
    incident.get(id).add(key);
  };
  for (const t of ontology.traces) {
    addInc(t.source, `out|${t.type}|${t.target}`);
    addInc(t.target, `in|${t.type}|${t.source}`);
  }

  const vios = new Map();
  for (const v of violations) vios.set(vkey(v), v);

  series.push({ ...r, i: series.length, elems, incident, vios, keys: new Set(vios.keys()) });
}

console.log('');
line('=');
console.log('CR-GC-432 - Hint-Konformanz: folgten die realen Reparaturen den Regel-Hinweisen?');
line('=');
console.log(`Regel-Build: core ${RULE_BUILD.core} / contracts ${RULE_BUILD.contracts}  (${RULE_BUILD.source})`);
console.log(`Regelversion: ${descriptor.version}   registrierte Regeln: ${(descriptor.rules ?? []).length}`);
console.log(`Staende: ${series.length} auswertbar, ${unreadable.length} nicht auswertbar`);
for (const u of unreadable) console.log(`   NICHT AUSWERTBAR  ${u.sha} ${u.date}: ${u.reason}`);

// ===========================================================================
// 2 - Episoden (identische Rekonstruktion wie CR-GC-427) + FEINER Schliess-Diff
// ===========================================================================
/** Was hat sich am Element im Schritt i-1 -> i konkret geaendert? */
function elementDelta(i, elementId) {
  const prev = series[i - 1];
  const cur = series[i];
  const before = prev.elems.get(elementId);
  const after = cur.elems.get(elementId);
  if (!before) return { kind: 'element-neu-oder-unbekannt' };
  if (!after) return { kind: 'geloescht' };

  const attrsChanged = [];
  const keys = new Set([...Object.keys(before.attrs), ...Object.keys(after.attrs)]);
  for (const k of keys) {
    if (before.attrs[k] !== after.attrs[k]) {
      attrsChanged.push({ key: k, from: before.attrs[k] ?? '<fehlt>', to: after.attrs[k] ?? '<fehlt>' });
    }
  }
  const eb = prev.incident.get(elementId) ?? new Set();
  const ea = cur.incident.get(elementId) ?? new Set();
  const edgesAdded = [...ea].filter((k) => !eb.has(k));
  const edgesRemoved = [...eb].filter((k) => !ea.has(k));
  const statusChanged = before.status !== after.status ? { from: before.status, to: after.status } : null;

  return {
    kind: 'veraendert',
    statusChanged,
    attrsChanged: attrsChanged.filter((a) => a.key !== 'status'),
    edgesAdded,
    edgesRemoved,
    untouched: !attrsChanged.length && !edgesAdded.length && !edgesRemoved.length,
  };
}

const episodes = [];
const seenOpen = new Map();
for (let i = 0; i < series.length; i++) {
  const cur = series[i].keys;
  const prev = i > 0 ? series[i - 1].keys : new Set();
  for (const k of cur) if (!seenOpen.has(k)) seenOpen.set(k, i);
  for (const k of prev) {
    if (cur.has(k)) continue;
    const startIdx = seenOpen.get(k);
    if (startIdx === undefined) continue;
    seenOpen.delete(k);
    const ruleId = k.split('|')[0];
    const elementId = k.split('|').slice(1).join('|');
    const vio = series[i - 1].vios.get(k);
    episodes.push({
      key: k,
      ruleId,
      elementId,
      severity: vio?.severity ?? null,
      fixHint: vio?.fixHint ?? null,
      message: vio?.message ?? null,
      startIdx,
      endIdx: i,
      closeSha: series[i].sha,
      closeDate: series[i].date,
      closeAuthor: series[i].author,
      closeSubject: series[i].subject,
      delta: elementId === '<graph>' ? { kind: 'graph-weit' } : elementDelta(i, elementId),
    });
  }
}
console.log(`Geschlossene Episoden: ${episodes.length}  (CR-GC-427: 678 - muss uebereinstimmen)`);

// ===========================================================================
// 3 - Hint-Katalog: WAS verlangt der Hinweis?
// ===========================================================================
if (DUMP_HINTS) {
  const cat = new Map();
  for (const e of episodes) {
    const k = `${e.ruleId}\t${e.fixHint ?? '<kein Hint>'}`;
    cat.set(k, (cat.get(k) ?? 0) + 1);
  }
  line('=');
  console.log('HINT-KATALOG (distinkte fixHints der geschlossenen Episoden, absteigend)');
  line('=');
  for (const [k, c] of [...cat.entries()].sort((a, b) => b[1] - a[1])) {
    const [rule, hint] = k.split('\t');
    console.log(`${n(c, 4)}  ${rule.padEnd(8)} ${hint}`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Hint -> geforderte Handlung. EXPLIZITE Tabelle, kein Fuzzy-Matching:
// jede Zeile ist am Hint-Text pruefbar (Katalog via --dump-hints).
//   edge:<typ>   der Hinweis verlangt eine Trace dieses Typs
//   attr:<name>  der Hinweis verlangt ein Attribut dieses Namens
//   status       der Hinweis verlangt eine Statusaenderung
//   delete       der Hinweis bietet Loeschen als zulaessige Alternative an
//   strukturell  der Hinweis verlangt einen Umbau ohne EINEN mechanisch pruefbaren Edit
// Ein Hint kann mehrere Forderungen tragen (Alternativen, "or remove").
// ---------------------------------------------------------------------------
/**
 * Die Tabelle ist NICHT geraten: sie ist aus dem Hint-Katalog abgeleitet, den derselbe
 * Lauf mit `--dump-hints` ausgibt (33 distinkte Hint-Texte ueber die 678 Episoden). Der
 * Hint-Text steht als Kommentar daneben, damit jede Zeile am Original pruefbar ist.
 *
 * Forderungsformen:
 *   {edge, type, dir, otherType}  eine Trace dieses Typs, Richtung, Gegenstueck-Typ
 *   {edge, type:'*'}              irgendeine Trace-Aenderung (nur R-18: "use a trace
 *                                 type that ... allows" verlangt das Entfernen der illegalen)
 *   {attr, key, must?}            ein Attribut dieses Namens (optional: Teilstring im Wert)
 * Mehrere Eintraege = ODER-Alternativen, die der Hinweis selbst anbietet.
 * Leeres Array = der Hinweis nennt keine mechanisch pruefbare Einzelhandlung.
 */
const HINT_DEMANDS = {
  // "Add commitRef with Git SHA, or set architectureOnly=true"
  'CR-R02': [{ attr: 'commitRef' }, { attr: 'architectureOnly' }],
  // "Add CR->MS [relation] trace to assign this CR to a milestone" (Praedikat: source=CR)
  'MS-03': [{ edge: 'relation', dir: 'out', otherType: ['MS'] }],
  // "Add the FUNC to the FCHAIN of the use case it serves (FCHAIN -compose-> FUNC)"
  'R-30': [{ edge: 'compose', dir: 'in', otherType: ['FCHAIN'] }],
  // "Connect the FUNC to a FLOW on the missing side (FLOW -io-> FUNC ... )"
  'R-31': [{ edge: 'io', dir: 'any', otherType: ['FLOW'] }],
  // "Record the run outcome on the entry (result, ranAt, evidence)"
  'VR-01': [{ attr: 'testRefs', must: 'result' }],
  // "Add attributes.testRefs [...] with at least one entry, or set attributes.concept:true"
  'R-19': [{ attr: 'testRefs' }, { attr: 'concept' }],
  // "Link to a REQ via satisfy trace"
  'R-02': [{ edge: 'satisfy', dir: 'any', otherType: ['REQ'] }],
  // "Add attributes.realRef {...}, or concept:true / external:true"
  'R-20': [{ attr: 'realRef' }, { attr: 'codeRef' }, { attr: 'concept' }, { attr: 'external' }],
  'R-26': [{ attr: 'realRef' }, { attr: 'codeRef' }, { attr: 'concept' }, { attr: 'external' }],
  // "Add relation traces to affected UC, REQ, FUNC, or MOD elements"
  'CR-R01': [{ edge: 'relation', dir: 'any', otherType: ['UC', 'REQ', 'FUNC', 'MOD'] }],
  // "Add CR->FUNC [relation] traces to define which functions this CR changes"
  'CR-R04': [{ edge: 'relation', dir: 'any', otherType: ['FUNC'] }],
  // "Use a trace type whose TRACE_PATTERNS allows this source/target element-type pair"
  'R-18': [{ edge: '*' }],
  // "A test file belongs to at most one TEST. Split the file, or drop the entry ..."
  'R-29': [{ attr: 'testRefs' }],
  // "Link to a MOD via allocate trace"
  'R-22': [{ edge: 'allocate', dir: 'any', otherType: ['MOD'] }],
  // "Add satisfy trace from FUNC, FCHAIN, MOD, or SYS"
  'RD-01': [{ edge: 'satisfy', dir: 'in', otherType: ['FUNC', 'FCHAIN', 'MOD', 'SYS'] }],
  // "Add a REQ with kinds=[...] via compose trace"
  'UC-05': [{ edge: 'compose', dir: 'any', otherType: ['REQ'] }],
  'UC-06': [{ edge: 'compose', dir: 'any', otherType: ['REQ'] }],
  // "Add a FCHAIN via compose trace ..."
  'UC-03': [{ edge: 'compose', dir: 'any', otherType: ['FCHAIN'] }],
  'FC-02': [{ edge: 'compose', dir: 'any', otherType: ['FCHAIN'] }],
  // "Attach the chain to the use case it realises (UC -compose-> FCHAIN)"
  'R-15': [{ edge: 'compose', dir: 'in', otherType: ['UC'] }],
  // "Link a SCHEMA via relation trace to define this FLOW's data contract"
  'SC-04': [{ edge: 'relation', dir: 'any', otherType: ['SCHEMA'] }],
  // "Verify an FCHAIN-satisfied REQ with an integration TEST"
  'R-21': [{ edge: 'verify', dir: 'in', otherType: ['TEST'] }],
  // "Link an ACTOR via io trace to this UC or its FCHAIN"
  'UC-02': [{ edge: 'io', dir: 'any', otherType: ['ACTOR', 'FLOW'] }],
  // "Add a FLOW (or io traces on an existing one) linking <FUNC> to a function of the same chain"
  'IO-01': [{ edge: 'io', dir: 'any', otherType: ['FLOW'] }],
  // "Link an ACTOR->FLOW->FUNC entry and a FUNC->FLOW->ACTOR exit ..."
  'FC-04': [{ edge: 'io', dir: 'any', otherType: ['FLOW'] }],
  // "Provide a meaningful description (min 10 chars, no TBD/TODO)"
  'UC-04': [{ attr: 'description' }],
  // "Set attributes.analysisFreshness.<artefakt>.graphVersion to the current graphVersion()"
  'AF-01': [{ attr: 'analysisFreshness' }],
  'AF-02': [{ attr: 'analysisFreshness' }],
  'AF-03': [{ attr: 'analysisFreshness' }],
  'AF-04': [{ attr: 'analysisFreshness' }],
  'AF-05': [{ attr: 'analysisFreshness' }],
  // Keine mechanisch pruefbare Einzelhandlung:
  'CR-R03': [], // "Coordinate changes to avoid merge conflicts"
  'R-04': [], // "Reduce crossing flows or split module"
  'RD-04': [], // "Introduce an intermediate level (func-of-func / sub-MOD)"
  'MT-02': [], // kein fixHint
};

const demandLabel = (d) =>
  d.edge ? `edge:${d.edge}${d.otherType ? '/' + d.otherType.join('|') : ''}` : `attr:${d.attr}${d.must ? '.' + d.must : ''}`;

/** Inzidente Kante `out|verify|X` -> {dir, type, other}. */
const parseEdge = (k) => {
  const [dir, type, other] = k.split('|');
  return { dir, type, other };
};

// ===========================================================================
// 4 - Konformanz-Urteil je Episode
// ===========================================================================
const V = {
  KONFORM: 'konform (Hinweis befolgt)',
  ABWEICHEND: 'abweichend (etwas anderes geschah)',
  ABWEICHEND_DEL: 'abweichend (Element geloescht statt repariert)',
  U_HINT: 'nicht entscheidbar (Hinweis nennt keine pruefbare Einzelhandlung)',
  U_KEIN_HINT: 'nicht entscheidbar (kein fixHint)',
  U_GRAPH: 'nicht entscheidbar (graph-weite Violation, kein Element)',
  U_UNBERUEHRT: 'nicht entscheidbar (Element unberuehrt - Grundgesamtheit anderswo veraendert)',
  U_UNBEKANNT: 'nicht entscheidbar (Regel nicht im Hint-Katalog)',
};

/** Typ des Gegenstuecks einer Kante im Zustand i (fuer die otherType-Pruefung). */
function typeOf(i, id) {
  return series[i].elems.get(id)?.type ?? null;
}

function judge(ep) {
  const d = ep.delta;
  if (d.kind === 'graph-weit') return { v: V.U_GRAPH, why: 'elementId = <graph>' };
  if (!ep.fixHint) return { v: V.U_KEIN_HINT, why: 'Violation ohne fixHint' };

  const demands = HINT_DEMANDS[ep.ruleId];
  if (demands === undefined) {
    return { v: V.U_UNBEKANNT, why: `Regel ${ep.ruleId} nicht in HINT_DEMANDS`, demands: [] };
  }
  const labels = demands.map(demandLabel);
  if (!demands.length) {
    return { v: V.U_HINT, why: `Hinweis: "${(ep.fixHint ?? '').slice(0, 60)}"`, demands: labels };
  }
  if (d.kind === 'geloescht') {
    return { v: V.ABWEICHEND_DEL, why: `verlangt ${labels.join('|')}; Element wurde geloescht`, demands: labels };
  }
  if (d.kind === 'element-neu-oder-unbekannt') {
    return { v: V.U_UNBERUEHRT, why: 'Element im Vorzustand nicht auffindbar', demands: labels };
  }
  if (d.untouched) {
    return { v: V.U_UNBERUEHRT, why: 'Element unveraendert; Violation fiel durch Kontext weg', demands: labels };
  }

  // R-31 nennt die fehlende Seite in der Meldung ("missing: input + output"). Der Hinweis
  // verlangt die Kante GENAU auf dieser Seite - ohne diese Schaerfung waere jede io-Kante
  // konform, auch die, die die Regel gar nicht schliesst.
  let effective = demands;
  let requireAll = false;
  if (ep.ruleId === 'R-31' && ep.message) {
    const m = /missing: (.+)$/.exec(ep.message);
    if (m) {
      const sides = [];
      if (m[1].includes('input')) sides.push('in');
      if (m[1].includes('output')) sides.push('out');
      effective = sides.map((dir) => ({ edge: 'io', dir, otherType: ['FLOW'] }));
      requireAll = sides.length > 1; // beide Seiten fehlen => beide muessen kommen
    }
  }

  const hits = [];
  for (const dem of effective) {
    if (dem.edge === '*') {
      if (d.edgesRemoved.length) hits.push(`illegale Kante entfernt (${[...new Set(d.edgesRemoved.map((k) => parseEdge(k).type))].join(',')})`);
    } else if (dem.edge) {
      const ok = d.edgesAdded.some((k) => {
        const e = parseEdge(k);
        if (e.type !== dem.edge) return false;
        if (dem.dir && dem.dir !== 'any' && e.dir !== dem.dir) return false;
        if (dem.otherType && !dem.otherType.includes(typeOf(ep.endIdx, e.other))) return false;
        return true;
      });
      if (ok) hits.push(`Kante ${dem.edge} gezogen`);
    } else if (dem.attr) {
      const ch = d.attrsChanged.find((c) => c.key === dem.attr);
      if (ch && (!dem.must || (ch.to ?? '').includes(dem.must))) hits.push(`Attribut ${dem.attr} gesetzt/geaendert`);
    }
  }
  if (hits.length && (!requireAll || hits.length === effective.length)) {
    return { v: V.KONFORM, why: hits.join(' + '), demands: labels };
  }

  const what = [];
  if (d.statusChanged) what.push(`Status ${d.statusChanged.from}->${d.statusChanged.to}`);
  if (d.attrsChanged.length) what.push(`Attribute: ${d.attrsChanged.map((c) => c.key).join(',')}`);
  if (d.edgesAdded.length) what.push(`Kanten+: ${[...new Set(d.edgesAdded.map((k) => parseEdge(k).type))].join(',')}`);
  if (d.edgesRemoved.length) what.push(`Kanten-: ${[...new Set(d.edgesRemoved.map((k) => parseEdge(k).type))].join(',')}`);
  return { v: V.ABWEICHEND, why: `verlangt ${labels.join('|')}; beobachtet: ${what.join(' / ') || 'nichts'}`, demands: labels };
}

for (const ep of episodes) {
  const j = judge(ep);
  ep.verdict = j.v;
  ep.verdictWhy = j.why;
  ep.demands = j.demands ?? [];
}

// Stichprobe zur Handpruefung: --sample <ruleId>
const SAMPLE = arg('--sample');
if (SAMPLE) {
  for (const e of episodes.filter((x) => x.ruleId === SAMPLE).slice(0, 12)) {
    console.log(`\n${e.ruleId} ${e.elementId}  #${e.startIdx}->#${e.endIdx} ${e.closeSha} ${e.closeSubject.slice(0, 60)}`);
    console.log(`   hint : ${e.fixHint}`);
    console.log(`   delta: ${JSON.stringify(e.delta).slice(0, 500)}`);
    console.log(`   urteil: ${e.verdict} | ${e.verdictWhy}`);
  }
  process.exit(0);
}

// ===========================================================================
// 5 - Auswertung
// ===========================================================================
const isKonform = (e) => e.verdict === V.KONFORM;
const isUnent = (e) => e.verdict.startsWith('nicht entscheidbar');
const decidable = episodes.filter((e) => !isUnent(e));
const konform = episodes.filter(isKonform);

console.log('');
line('=');
console.log('ERGEBNIS - Hint-Konformanz gesamt');
line('=');
const byVerdict = {};
for (const e of episodes) byVerdict[e.verdict] = (byVerdict[e.verdict] ?? 0) + 1;
for (const [k, v] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(58)} ${n(v, 4)}  (${pct(v, episodes.length)})`);
}
console.log('');
console.log(`  Entscheidbar:        ${n(decidable.length, 4)} / ${episodes.length}  (${pct(decidable.length, episodes.length)})`);
console.log(`  NICHT entscheidbar:  ${n(episodes.length - decidable.length, 4)} / ${episodes.length}  (${pct(episodes.length - decidable.length, episodes.length)})`);
console.log('');
console.log(`  HINT-KONFORMANZ-QUOTE (auf den entscheidbaren): ${konform.length}/${decidable.length} = ${pct(konform.length, decidable.length)}`);
console.log(`  Auf ALLEN Episoden (unentscheidbare als nicht-konform gezaehlt = Untergrenze): ${pct(konform.length, episodes.length)}`);

// --- je Regel ---------------------------------------------------------------
console.log('');
line('=');
console.log('JE REGEL (Episoden >= 3; sortiert nach Episodenzahl)');
line('=');
console.log('Regel     Epis.  entsch.  konform   Quote     unentsch.  typische Forderung');
line('-');
const rules = new Map();
for (const e of episodes) {
  if (!rules.has(e.ruleId)) rules.set(e.ruleId, []);
  rules.get(e.ruleId).push(e);
}
const perRule = [];
for (const [rid, eps] of [...rules.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const dec = eps.filter((e) => !isUnent(e));
  const kon = eps.filter(isKonform);
  const dem = [...new Set(eps.flatMap((e) => e.demands ?? []))].join(',') || '-';
  perRule.push({ ruleId: rid, episodes: eps.length, decidable: dec.length, konform: kon.length, demand: dem });
  if (eps.length < 3) continue;
  console.log(
    `${rid.padEnd(9)} ${n(eps.length, 4)}   ${n(dec.length, 5)}   ${n(kon.length, 5)}   ${(dec.length ? pct(kon.length, dec.length) : '-').padStart(8)}   ${n(eps.length - dec.length, 6)}     ${dem.slice(0, 34)}`,
  );
}
const rest = perRule.filter((r) => r.episodes < 3);
console.log(`(+ ${rest.length} Regeln mit < 3 Episoden: ${rest.reduce((a, r) => a + r.episodes, 0)} Episoden, davon konform ${rest.reduce((a, r) => a + r.konform, 0)})`);

// --- AUSSAGEKRAFT: ist die Konformanz ueberhaupt falsifizierbar? -------------
console.log('');
line('=');
console.log('AUSSAGEKRAFT - konnte die Quote ueberhaupt anders ausfallen?');
line('=');
/**
 * Eine Regel ist ERZWUNGEN, wenn ihr fix_hint die woertliche Negation ihres Praedikats ist
 * UND das Praedikat nur Eigenschaften DES ELEMENTS liest. Dann gibt es genau zwei Wege, die
 * Violation zu schliessen: den Hinweis befolgen oder das Element loeschen. Die Konformanz ist
 * dort keine Beobachtung ueber Steuerung, sondern eine Tautologie.
 * Belegt an der Regelquelle (contracts/dist/se), z. B.:
 *   CR-R02  Praedikat: status===done && !architectureOnly && !commitRef
 *           Hint:      "Add commitRef ..., or set architectureOnly=true"      -> Negation
 *   MS-03   Praedikat: kein CR -relation-> MS
 *           Hint:      "Add CR->MS [relation] trace"                          -> Negation
 *   R-31    Praedikat: FUNC ohne io-Kante auf einer Seite
 *           Hint:      "Connect the FUNC to a FLOW on the missing side"       -> Negation
 * NICHT erzwungen (die Violation kann auch durch eine Aenderung an einem ANDEREN Element
 * oder durch mehrere gleichwertige Umbauten verschwinden):
 *   R-29    Praedikat: Testdatei von >= 2 TEST beansprucht (elementuebergreifend)
 *   IO-01   Praedikat: Kettenebene, nicht Elementebene
 *   R-04 / RD-04 / CR-R03  strukturelle Hinweise ohne Einzel-Edit
 */
const NICHT_ERZWUNGEN = new Set(['R-29', 'IO-01', 'R-04', 'RD-04', 'CR-R03']);
const forced = episodes.filter((e) => !NICHT_ERZWUNGEN.has(e.ruleId));
const free = episodes.filter((e) => NICHT_ERZWUNGEN.has(e.ruleId));
const forcedDec = forced.filter((e) => !isUnent(e));
const freeDec = free.filter((e) => !isUnent(e));
console.log(`  Episoden auf ERZWUNGENEN Regeln (Hint = Negation des Praedikats): ${forced.length} (${pct(forced.length, episodes.length)})`);
console.log(`     Quote dort: ${forced.filter(isKonform).length}/${forcedDec.length} = ${pct(forced.filter(isKonform).length, forcedDec.length)}`);
console.log(`     Lesart: dort misst die Quote NUR "repariert statt geloescht" - nicht, ob der Hinweis die Handlung waehlte.`);
console.log(`  Episoden auf NICHT erzwungenen Regeln (echte Wahl):               ${free.length} (${pct(free.length, episodes.length)})`);
console.log(`     Quote dort: ${free.filter(isKonform).length}/${freeDec.length} = ${pct(free.filter(isKonform).length, freeDec.length)}   (${[...new Set(free.map((e) => e.ruleId))].join(', ')})`);

// --- Chirurgisch oder Kampagne? ---------------------------------------------
const deltaSize = (e) => {
  const d = e.delta;
  if (d.kind !== 'veraendert') return null;
  return d.attrsChanged.length + d.edgesAdded.length + d.edgesRemoved.length;
};
const surgical = episodes.filter((e) => deltaSize(e) === 1 && isKonform(e));
const bulk = episodes.filter((e) => (deltaSize(e) ?? 0) > 1 && isKonform(e));
console.log('');
console.log('  Chirurgisch vs. Sammel-Edit (wie viele Aenderungen trug das Element im Schliess-Schritt?):');
console.log(`     konform mit GENAU EINER Aenderung am Element (= der Hinweis-Edit):  ${surgical.length} (${pct(surgical.length, konform.length)} der konformen)`);
console.log(`     konform als Teil eines Sammel-Edits (> 1 Aenderung am Element):      ${bulk.length} (${pct(bulk.length, konform.length)} der konformen)`);

// --- Informationsgewinn gegenueber CR-GC-427 ---------------------------------
const VS427 = arg('--vs427');
if (VS427 && existsSync(VS427)) {
  const old = JSON.parse(readFileSync(VS427, 'utf8'));
  const oldHow = new Map();
  for (const e of old.episodes ?? []) oldHow.set(`${e.ruleId}|${e.elementId}|${e.endIdx}`, e.how);
  const cross = {};
  let matched = 0;
  for (const e of episodes) {
    const how = oldHow.get(`${e.ruleId}|${e.elementId}|${e.endIdx}`);
    if (!how) continue;
    matched++;
    const k = `${how}  ->  ${e.verdict}`;
    cross[k] = (cross[k] ?? 0) + 1;
  }
  console.log('');
  console.log(`  Kreuztabelle gegen CR-GC-427 (${matched} von ${episodes.length} Episoden zuordenbar):`);
  for (const [k, v] of Object.entries(cross).sort((a, b) => b[1] - a[1])) console.log(`     ${n(v, 4)}  ${k}`);
  const naive = episodes.filter((e) => {
    const how = oldHow.get(`${e.ruleId}|${e.elementId}|${e.endIdx}`);
    return how && how !== 'Element geloescht' && how !== 'Element gelöscht';
  }).length;
  console.log(`  427 sagte "repariert statt geloescht": ${naive}. 432 sagt "Hinweis befolgt": ${konform.length}.`);
  console.log(`  => Informationsgewinn der feineren Messung: ${Math.abs(naive - konform.length)} Episoden (${pct(Math.abs(naive - konform.length), episodes.length)}).`);
}

// --- Zirkularitaet: mechanisch erzeugte Edits --------------------------------
console.log('');
line('=');
console.log('ZIRKULARITAETS-PRUEFUNG - entstand die Konformanz dort, wo ein Fix-TEMPLATE den Edit erzeugt?');
line('=');
/**
 * Der Template-Pfad ist NICHT geschaetzt, er steht im Code: `applyRule`/`suggestEdits`
 * (@sigloch/se-engine) erzeugen den Edit fuer jede Regel der Klasse **Operator**, und der
 * Kantentyp kommt dort aus `inferTraceType(v.fix_hint)` — das Template LIEST den Hinweis.
 * Wer so einen Vorschlag anwendet, ist per Konstruktion hint-konform; gemessen wird dann
 * das Template, nicht die Steuerung. Dazu R-19: `graph_export` materialisiert fehlende
 * testRef-Stubs (`it.todo`), CLAUDE.md "Bindungs-Vollstaendigkeit".
 */
let CLASS_MAP = {};
try {
  ({ CLASS_MAP } = await import('@sigloch/se-engine'));
} catch {
  console.log('  (CLASS_MAP nicht ladbar - Operator-Klassifikation uebersprungen)');
}
const operatorRules = new Set(Object.entries(CLASS_MAP).filter(([, v]) => v.class === 'Operator').map(([k]) => k));
const TEMPLATE_RULES = new Set([...operatorRules, ...String(arg('--template-rules') ?? 'R-19').split(',').filter(Boolean)]);
const tmplEps = episodes.filter((e) => TEMPLATE_RULES.has(e.ruleId));
const tmplKon = tmplEps.filter(isKonform);
const restEps = episodes.filter((e) => !TEMPLATE_RULES.has(e.ruleId));
const restDec = restEps.filter((e) => !isUnent(e));
const restKon = restEps.filter(isKonform);
console.log(`Operator-Regeln laut CLASS_MAP (Template-Edit aus dem fixHint): ${operatorRules.size}`);
console.log(`  davon in der History feuernd: ${[...new Set(tmplEps.map((e) => e.ruleId))].sort().join(', ') || '-'}`);
console.log(`  Episoden auf Template-Regeln: ${tmplEps.length} (${pct(tmplEps.length, episodes.length)}), davon konform ${tmplKon.length}`);
console.log(`  Anteil der Template-Regeln an ALLEN konformen Episoden: ${pct(tmplKon.length, konform.length)}`);
console.log(`  Quote OHNE Template-Regeln: ${restKon.length}/${restDec.length} = ${pct(restKon.length, restDec.length)}`);
console.log(`  => Kill "zirkulaer" (Template traegt die Mehrheit der Konformanz): ${tmplKon.length > konform.length / 2 ? 'FEUERT' : 'feuert nicht'}`);

// --- Confounder Mensch ------------------------------------------------------
console.log('');
line('=');
console.log('CONFOUNDER MENSCH - fielen die Schliessungen in Commits mit expliziter CR-Beauftragung?');
line('=');
// Erfasst beide Schreibweisen der Commit-Betreffs: "CR-GC-389" und die kurze "CR-420".
const CR_RE = /\bCR-(?:[A-Z]{2,4}-)?\d{2,4}\b/;
const withCR = episodes.filter((e) => CR_RE.test(e.closeSubject ?? ''));
const withoutCR = episodes.filter((e) => !CR_RE.test(e.closeSubject ?? ''));
console.log(`  Episoden, deren Schliess-Commit einen CR nennt:      ${n(withCR.length, 4)} (${pct(withCR.length, episodes.length)})`);
console.log(`  Episoden ohne CR-Nennung im Schliess-Commit:         ${n(withoutCR.length, 4)} (${pct(withoutCR.length, episodes.length)})`);
const decCR = withCR.filter((e) => !isUnent(e));
const decNo = withoutCR.filter((e) => !isUnent(e));
console.log(`  Konformanz-Quote MIT CR-Nennung:                     ${pct(withCR.filter(isKonform).length, decCR.length)}  (n=${decCR.length})`);
console.log(`  Konformanz-Quote OHNE CR-Nennung:                    ${pct(withoutCR.filter(isKonform).length, decNo.length)}  (n=${decNo.length})`);
const authors = {};
for (const e of episodes) authors[e.closeAuthor] = (authors[e.closeAuthor] ?? 0) + 1;
console.log(`  git-Autor der Schliess-Commits: ${Object.entries(authors).map(([a, c]) => `${a}=${c}`).join(', ')}`);

const byCommit = new Map();
for (const e of episodes) {
  const k = `#${e.endIdx} ${e.closeSha} ${e.closeDate} ${e.closeSubject}`;
  if (!byCommit.has(k)) byCommit.set(k, []);
  byCommit.get(k).push(e);
}
console.log('');
console.log('  Die 10 schliessstaerksten Commits (Konzentration = Kampagne, nicht Autopilot-Fluss):');
const topCommits = [...byCommit.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
for (const [k, eps] of topCommits) {
  const kon = eps.filter(isKonform).length;
  const dec = eps.filter((e) => !isUnent(e)).length;
  console.log(`   ${n(eps.length, 4)} Ep.  konform ${n(kon, 3)}/${n(dec, 3)}  ${CR_RE.test(k) ? '[CR]' : '[  ]'}  ${k.slice(0, 78)}`);
}
const top10 = topCommits.reduce((a, [, eps]) => a + eps.length, 0);
console.log(`  => die Top-10-Commits tragen ${top10}/${episodes.length} Episoden (${pct(top10, episodes.length)}).`);

// Kampagne vs. Einzelfall: schliesst ein Commit >= 5 Violations, ist es eine Aufraeum-Aktion,
// kein beilaeufiger Schritt eines Agenten, der gerade etwas anderes baut.
const kampagneEps = [];
const tailEps = [];
for (const [, eps] of byCommit) (eps.length >= 5 ? kampagneEps : tailEps).push(...eps);
console.log('');
console.log(`  Schliess-Commits insgesamt: ${byCommit.size}`);
console.log(`  Episoden in KAMPAGNEN-Commits (>= 5 Schliessungen):  ${n(kampagneEps.length, 4)} (${pct(kampagneEps.length, episodes.length)}), Quote ${pct(kampagneEps.filter(isKonform).length, kampagneEps.filter((e) => !isUnent(e)).length)}`);
console.log(`  Episoden in Einzel-Commits (< 5 Schliessungen):      ${n(tailEps.length, 4)} (${pct(tailEps.length, episodes.length)}), Quote ${pct(tailEps.filter(isKonform).length, tailEps.filter((e) => !isUnent(e)).length)}`);
const unconfounded = tailEps.filter((e) => !CR_RE.test(e.closeSubject ?? ''));
console.log(`  UNCONFOUNDED (weder Kampagne noch CR-Nennung im Commit):            ${n(unconfounded.length, 4)} (${pct(unconfounded.length, episodes.length)})`);
for (const e of unconfounded) console.log(`     ${e.ruleId} ${e.elementId} @ ${e.closeSha} "${e.closeSubject.slice(0, 60)}" -> ${e.verdict}`);
console.log('  Die Einzel-Commits (der einzige Ort, an dem ein beilaeufiger Regel-Folge-Schritt sichtbar waere):');
for (const [k, eps] of [...byCommit.entries()].filter(([, e]) => e.length < 5).slice(0, 14)) {
  console.log(`     ${n(eps.length, 3)} Ep.  ${CR_RE.test(k) ? '[CR]' : '[  ]'}  ${k.slice(0, 84)}`);
}

// --- Trajektorie: kennt sie einen Ausloeser? --------------------------------
console.log('');
line('-');
const trajPath = join(REPO, '.graphcode/trajectory.jsonl');
if (existsSync(trajPath)) {
  const lines = readFileSync(trajPath, 'utf8').trim().split('\n').filter(Boolean);
  const consumers = {};
  const authorsT = {};
  let withTrigger = 0;
  const fields = new Set();
  for (const l of lines) {
    try {
      const o = JSON.parse(l);
      for (const k of Object.keys(o)) fields.add(k);
      const ct = o.consumerType ?? '<fehlt>';
      consumers[ct] = (consumers[ct] ?? 0) + 1;
      if (o.author) authorsT[o.author] = (authorsT[o.author] ?? 0) + 1;
      if (o.trigger || o.cr || o.crRef || o.prompt) withTrigger++;
    } catch {
      /* ignore */
    }
  }
  console.log(`Trajektorie: ${lines.length} Zeilen. consumerType: ${Object.entries(consumers).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  author: ${Object.entries(authorsT).map(([k, v]) => `${k}=${v}`).join(', ') || '-'}`);
  console.log(`  Zeilen mit Ausloeser-Feld (trigger/cr/crRef/prompt): ${withTrigger}${withTrigger ? '' : ' - KEIN Ausloeser-Stempel vorhanden.'}`);
  console.log(`  vorhandene Felder: ${[...fields].sort().join(', ')}`);
} else {
  console.log('Trajektorie: .graphcode/trajectory.jsonl nicht gefunden.');
}

// --- Abweichende Episoden ---------------------------------------------------
console.log('');
line('=');
console.log('ABWEICHENDE EPISODEN - was geschah statt des Hinweises (Top-Regeln)');
line('=');
const abw = episodes.filter((e) => e.verdict === V.ABWEICHEND);
const abwByRule = new Map();
for (const e of abw) {
  if (!abwByRule.has(e.ruleId)) abwByRule.set(e.ruleId, []);
  abwByRule.get(e.ruleId).push(e);
}
for (const [rid, eps] of [...abwByRule.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
  console.log(`  ${rid} (${eps.length}): ${eps[0].elementId} - ${eps[0].verdictWhy.slice(0, 92)}`);
}

if (JSON_OUT) {
  writeFileSync(
    JSON_OUT,
    JSON.stringify(
      {
        meta: {
          generated: new Date().toISOString(),
          ruleBuild: RULE_BUILD,
          ruleVersion: descriptor.version,
          states: series.length,
          unreadable,
        },
        totals: {
          episodes: episodes.length,
          decidable: decidable.length,
          konform: konform.length,
          quote: decidable.length ? konform.length / decidable.length : null,
          byVerdict,
        },
        perRule,
        episodes: episodes.map((e) => ({
          ruleId: e.ruleId,
          elementId: e.elementId,
          severity: e.severity,
          fixHint: e.fixHint,
          startIdx: e.startIdx,
          endIdx: e.endIdx,
          closeSha: e.closeSha,
          closeDate: e.closeDate,
          closeSubject: e.closeSubject,
          demands: e.demands,
          verdict: e.verdict,
          verdictWhy: e.verdictWhy,
        })),
      },
      null,
      1,
    ),
  );
  console.log(`\nJSON geschrieben: ${JSON_OUT}`);
}
