#!/usr/bin/env node
/**
 * CR-GC-427 — Spike: Nachweis der Autopilot-Arbeit aus der echten History.
 * READ-ONLY. Kein Produktionscode, kein Modell-Schreibvorgang, keine Regeländerung.
 *
 * Rechnet über ALLE Stände von `docs/graph/graphcode.graph.json` in der git-History:
 *
 *   1. Zeitreihe je Stand: Elemente, Traces, graphVersion, Violations nach Severity —
 *      ZWINGEND mit den HEUTIGEN Regeln (eine Regel-Population über alle Stände;
 *      sonst zählt man Regeländerungen als Fortschritt = die CR-GC-408-Zirkularität).
 *   2. Vier Kandidaten-Kennzahlen: Violations/Element · Error-Freiheit ·
 *      Halbwertszeit einer Violation · Wachstum-vs-Violations als Pfad.
 *   3. Drei Gegenproben: Löschen · Regel-Artefakt (Regelmenge zum Startzeitpunkt) ·
 *      Hash-Wiederbesuche (der CR-GC-407-Detektor, erstmals am Bestand).
 *
 * MESSPFAD = DER PRODUKTPFAD. Kein zweiter: die Ontologie-JSON wird über denselben
 * `elementToNode`-Mapper wie `scripts/export-graph.mjs` in einen Graph gehoben und mit
 * demselben `createSeDescriptor(metricPolicy)` + `DefaultRuleEngine` ausgewertet, den
 * `Gate.evaluate()` (src/kernel/gate.ts) fährt. Die MetricPolicy kommt aus der echten Repo-Config.
 *
 * NICHT ausgewertet: die RC-Konformanzregeln (`evaluation.ts` Quelle `conformance`) —
 * die brauchen den Quellbaum des jeweiligen Commits. Das wird als übersprungene Quelle
 * BENANNT, nicht stillschweigend als 0 gebucht (dieselbe Regel wie `Evaluation.skipped`).
 *
 * WELCHE Regeln „heute" sind, ist NICHT beliebig: das Repo läuft zeitweise auf verlinkten
 * Arbeitskopien (`npm run link:siblings`), die der publizierten, in `package.json` gepinnten
 * Version vorauslaufen können. Gemessen wird deshalb mit dem Build, den das PRODUKT fährt
 * (`--core <dir>`, ein separater Install der gepinnten Range); der verlinkte Baum ist die
 * Sensitivitätsprobe. Die aufgelöste Version wird in jedem Lauf mit ausgegeben.
 *
 * Aufruf: node scripts/spike-nachweis-history.mjs [--json <pfad>] [--core <install-dir>]
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { elementToNode, exportGraphJson, loadGraphcodeConfig } from '../dist/index.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const REL = 'docs/graph/graphcode.graph.json';

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const JSON_OUT = arg('--json');
const CORE_DIR = arg('--core');

/** Der Regel-Build: entweder ein expliziter Install (Produktstand) oder die Repo-Auflösung. */
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
  source: CORE_DIR ? `expliziter Install ${CORE_DIR}` : `Repo-Auflösung ${REPO}/node_modules`,
  core: pkgVersion(buildBase, 'graph-api-core'),
  contracts: pkgVersion(buildBase, 'contracts'),
};

// ---------------------------------------------------------------------------
// Regelmenge zum Startzeitpunkt — für die Regel-Artefakt-Gegenprobe.
// Erhoben aus der contracts-Quelle in sigloch-modules zum Datum des ERSTEN
// graphcode-Standes. Kein Nachbau der Regeln: nur die ID-Menge, gegen die die
// heutigen Befunde gefiltert werden.
// ---------------------------------------------------------------------------
const CONTRACTS_REPO = '/Users/andreas/Developer/dev/sigloch-modules';
const CONTRACTS_SE = 'packages/contracts/src/se';

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { maxBuffer: 1 << 30 }).toString();
}

function ruleIdsAt(dateIso) {
  try {
    const sha = git(CONTRACTS_REPO, ['log', '--format=%h', `--until=${dateIso}T23:59:59`, '-1', '--', CONTRACTS_SE])
      .trim();
    if (!sha) return null;
    const files = git(CONTRACTS_REPO, ['ls-tree', '--name-only', sha, `${CONTRACTS_SE}/`]).trim().split('\n');
    const ids = new Set();
    for (const f of files) {
      if (!f.endsWith('.ts')) continue;
      let src;
      try {
        src = git(CONTRACTS_REPO, ['show', `${sha}:${f}`]);
      } catch {
        continue;
      }
      for (const m of src.matchAll(/(?:rule_)?id: '([A-Z]{1,3}-\d{2})'/g)) ids.add(m[1]);
    }
    return { sha, ids };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Der EINE Auswertungspfad.
// ---------------------------------------------------------------------------
const policy = loadGraphcodeConfig(REPO).config.metricPolicy;
const descriptor = createSeDescriptor(policy);
const engine = new DefaultRuleEngine(descriptor.version);
engine.register(descriptor.rules ?? []);

/** elements/traces → nodes/edges, exakt wie scripts/export-graph.mjs (CR-GC-219-Mapper). */
function toGraph(ontology) {
  const nodes = (ontology.elements ?? []).map((e) => elementToNode(e));
  const edges = (ontology.traces ?? []).map((t) => {
    const { source, target, type, ...rest } = t;
    return { sourceId: source, targetId: target, edgeType: type, attributes: rest };
  });
  return { nodes, edges };
}

function revisions() {
  return git(REPO, ['log', '--format=%H|%h|%ad|%s', '--date=short', '--reverse', '--', REL])
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [full, sha, date, ...rest] = l.split('|');
      return { full, sha, date, subject: rest.join('|') };
    });
}

/** Violation-Identität über die Zeit: Regel + Element. Ohne Element: graph-global. */
const vkey = (v) => `${v.ruleId}|${v.elementId ?? '<graph>'}`;

// ===========================================================================
// MESSUNG — die Zeitreihe
// ===========================================================================
const revs = revisions();
const startDate = revs[0]?.date;
const startRules = startDate ? ruleIdsAt(startDate) : null;

const series = [];
const unreadable = [];

for (const r of revs) {
  let raw;
  try {
    raw = git(REPO, ['show', `${r.sha}:${REL}`]);
  } catch (e) {
    unreadable.push({ ...r, reason: `git show fehlgeschlagen: ${String(e.message ?? e).slice(0, 80)}` });
    continue;
  }
  let ontology;
  try {
    ontology = JSON.parse(raw);
  } catch (e) {
    unreadable.push({ ...r, reason: `JSON nicht parsebar: ${String(e.message ?? e).slice(0, 80)}` });
    continue;
  }
  if (!Array.isArray(ontology.elements) || !Array.isArray(ontology.traces)) {
    unreadable.push({ ...r, reason: 'Schema-Drift: kein elements/traces-Array' });
    continue;
  }
  let graph;
  let violations;
  try {
    graph = toGraph(ontology);
    violations = engine.evaluate(graph);
  } catch (e) {
    unreadable.push({ ...r, reason: `Regel-Engine warf: ${String(e.message ?? e).slice(0, 100)}` });
    continue;
  }

  // Kanonischer Export-Hash — derselbe deterministische Serializer wie das Produkt.
  let hash;
  try {
    hash = createHash('sha256').update(exportGraphJson(graph)).digest('hex').slice(0, 16);
  } catch {
    hash = createHash('sha256').update(JSON.stringify(graph)).digest('hex').slice(0, 16);
  }

  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byRule = {};
  const keys = new Set();
  for (const v of violations) {
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
    byRule[v.ruleId] = (byRule[v.ruleId] ?? 0) + 1;
    keys.add(vkey(v));
  }
  const restricted = startRules
    ? violations.filter((v) => startRules.ids.has(v.ruleId)).length
    : null;

  series.push({
    sha: r.sha,
    date: r.date,
    subject: r.subject,
    graphVersion: ontology.graphVersion ?? null,
    elements: ontology.elements.length,
    traces: ontology.traces.length,
    ...bySeverity,
    total: violations.length,
    perElement: violations.length / ontology.elements.length,
    restricted,
    restrictedPerElement: restricted === null ? null : restricted / ontology.elements.length,
    hash,
    byRule,
    keys,
    elementIds: new Set(ontology.elements.map((e) => e.id)),
    // Für die Löschen-/Reparatur-Gegenprobe: wie sah das Element aus, und welche
    // Kanten hingen daran? Beides je Stand, damit der SCHLIESSENDE Schritt einer
    // Violation klassifizierbar ist (Kante gezogen · Attribut geändert · Status
    // umgestellt · gar nichts am Element).
    elemJson: new Map(ontology.elements.map((e) => [e.id, JSON.stringify(e)])),
    elemStatus: new Map(ontology.elements.map((e) => [e.id, e.status ?? e.attributes?.status ?? null])),
    incident: (() => {
      const m = new Map();
      for (const t of ontology.traces) {
        const k = `${t.source}-${t.type}->${t.target}`;
        if (!m.has(t.source)) m.set(t.source, new Set());
        if (!m.has(t.target)) m.set(t.target, new Set());
        m.get(t.source).add(k);
        m.get(t.target).add(k);
      }
      return m;
    })(),
  });
}

// ---------------------------------------------------------------------------
const line = (c = '-') => console.log(c.repeat(112));
const n = (v, w) => String(v).padStart(w);
const f = (v, w, d = 3) => (v === null || v === undefined ? 'n/a'.padStart(w) : v.toFixed(d).padStart(w));

console.log('\nCR-GC-427 — Spike: Nachweis der Autopilot-Arbeit (read-only)');
console.log(`Gerechnet: ${new Date().toISOString().slice(0, 10)}  ·  Repo: ${REPO}`);
console.log(`Regel-Population: HEUTE, für ALLE Stände — descriptor ${descriptor.version}, ${(descriptor.rules ?? []).length} registrierte Regeln.`);
console.log(`Regel-Build: graph-api-core ${RULE_BUILD.core} · contracts ${RULE_BUILD.contracts} · Quelle: ${RULE_BUILD.source}`);
console.log('Nicht ausgewertet: RC-Konformanzregeln (brauchen den Quellbaum des jeweiligen Commits) — Quelle `conformance` SKIPPED.');
console.log('');
line('=');
console.log('MESSUNG 1 — Zeitreihe über die Stände');
line('=');
console.log(`Stände in der git-History: ${revs.length}  ·  auswertbar: ${series.length}  ·  nicht auswertbar: ${unreadable.length}`);
if (unreadable.length) {
  console.log('Nicht auswertbare Stände (gezählt UND benannt):');
  for (const u of unreadable) console.log(`  ${u.sha} ${u.date}  ${u.reason}  — ${u.subject.slice(0, 50)}`);
} else {
  console.log('Nicht auswertbare Stände: KEINE — Schema-Drift-Kill (Kriterium 4) feuert nicht.');
}
console.log('');
console.log('  #  sha      Datum       ver  Elem  Trace |  err  warn  info  ges | V/Elem | eingeschr. | hash');
line();
series.forEach((s, i) => {
  console.log(
    `${n(i, 3)}  ${s.sha.padEnd(8)} ${s.date}  ${n(s.graphVersion ?? '-', 4)} ${n(s.elements, 5)} ${n(s.traces, 6)} |` +
      `${n(s.error, 5)} ${n(s.warning, 5)} ${n(s.info, 5)} ${n(s.total, 5)} | ${f(s.perElement, 6)} |` +
      `${n(s.restricted ?? '-', 6)} ${f(s.restrictedPerElement, 6)} | ${s.hash.slice(0, 8)}`,
  );
});

const first = series[0];
const last = series[series.length - 1];

// ===========================================================================
// KENNZAHL 1 — Violations pro Element
// ===========================================================================
console.log('');
line('=');
console.log('KENNZAHL 1 — Violations pro Element (Qualität bei Wachstum)');
line('=');
const pe = series.map((s) => s.perElement);
console.log(`Start ${first.date} ${f(pe[0], 6)}  →  Ende ${last.date} ${f(pe[pe.length - 1], 6)}   (${(((pe[pe.length - 1] - pe[0]) / pe[0]) * 100).toFixed(1)} %)`);
console.log(`Max ${f(Math.max(...pe), 6)} (Stand #${pe.indexOf(Math.max(...pe))})   Min ${f(Math.min(...pe), 6)} (Stand #${pe.indexOf(Math.min(...pe))})`);
// Monotonie / Rauschen: Anteil Schritte, die gegen den Gesamttrend laufen.
let up = 0;
let down = 0;
let flat = 0;
for (let i = 1; i < pe.length; i++) {
  const d = pe[i] - pe[i - 1];
  if (Math.abs(d) < 1e-12) flat++;
  else if (d > 0) up++;
  else down++;
}
console.log(`Schritte: ${down} fallend · ${up} steigend · ${flat} unverändert  (Gegenläufer-Anteil ${((up / (pe.length - 1)) * 100).toFixed(1)} %)`);
// Trend-Stabilität gegen Messfenster-Verschiebung (Kill „Trend kippt bei kleinem Fensterwechsel").
console.log('Trend-Stabilität — lineare Steigung je Startversatz (Kill: Vorzeichenwechsel):');
function slope(ys) {
  const m = ys.length;
  const mx = (m - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / m;
  let num = 0;
  let den = 0;
  for (let i = 0; i < m; i++) {
    num += (i - mx) * (ys[i] - my);
    den += (i - mx) ** 2;
  }
  return num / den;
}
const windows = [0, 5, 10, 20, 30, 40];
let signFlip = false;
const s0 = Math.sign(slope(pe));
for (const w of windows) {
  if (pe.length - w < 5) continue;
  const sl = slope(pe.slice(w));
  if (Math.sign(sl) !== s0) signFlip = true;
  console.log(`  ab Stand #${n(w, 2)} (n=${n(pe.length - w, 2)}): Steigung ${sl.toExponential(2)}`);
}
// letzte Hälfte / letztes Drittel
for (const frac of [0.5, 0.33]) {
  const cut = Math.floor(pe.length * (1 - frac));
  const sl = slope(pe.slice(cut));
  if (Math.sign(sl) !== s0) signFlip = true;
  console.log(`  letzte ${Math.round(frac * 100)} % (n=${pe.length - cut}): Steigung ${sl.toExponential(2)}`);
}
console.log(`=> Kill „Rauschen/Trendkipp": ${signFlip ? 'FEUERT' : 'feuert nicht'}`);
// Konzentration: trägt der Rückgang die ganze Strecke, oder hängt er an drei Commits?
// Das ist keine Kill-Bedingung, aber es entscheidet, wie die Kurve GELESEN werden muss.
const drops = [];
for (let i = 1; i < series.length; i++) {
  const d = series[i - 1].total - series[i].total;
  if (d > 0) drops.push({ i, d, sha: series[i].sha, date: series[i].date, subject: series[i].subject });
}
const totalDrop = drops.reduce((a, x) => a + x.d, 0);
drops.sort((a, b) => b.d - a.d);
console.log(`Konzentration des Rückgangs: Summe aller Abwärtsschritte ${totalDrop}; die 3 größten tragen ${drops.slice(0, 3).reduce((a, x) => a + x.d, 0)} (${((drops.slice(0, 3).reduce((a, x) => a + x.d, 0) / totalDrop) * 100).toFixed(1)} %):`);
for (const x of drops.slice(0, 5)) console.log(`  Stand #${n(x.i, 2)} ${x.date} −${n(x.d, 4)}  ${x.subject.slice(0, 62)}`);

// ===========================================================================
// KENNZAHL 2 — Error-Freiheit als Zeitreihe
// ===========================================================================
console.log('');
line('=');
console.log('KENNZAHL 2 — Error-Freiheit (die Delta-Gate-Zusage: war `error` je > 0?)');
line('=');
const withErrors = series.filter((s) => s.error > 0);
console.log(`Stände mit error > 0: ${withErrors.length}/${series.length}`);
if (withErrors.length) {
  for (const s of withErrors.slice(0, 12)) console.log(`  ${s.sha} ${s.date} error=${s.error} — ${s.subject.slice(0, 60)}`);
  if (withErrors.length > 12) console.log(`  … ${withErrors.length - 12} weitere`);
}
console.log(`=> Trennschärfe: ${withErrors.length === 0 ? 'KEINE — die Reihe ist konstant 0, sie kann Fortschritt nicht von Stillstand unterscheiden.' : 'die Reihe variiert.'}`);
// Wann kippte sie auf 0, und wie lang hält der Zustand?
let firstZero = -1;
for (let i = 0; i < series.length; i++) {
  if (series[i].error === 0) {
    firstZero = i;
    break;
  }
}
if (firstZero >= 0) {
  let run = 0;
  let best = 0;
  let bestEnd = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].error === 0) {
      run++;
      if (run > best) {
        best = run;
        bestEnd = i;
      }
    } else run = 0;
  }
  console.log(`Erster error-freier Stand: #${firstZero} ${series[firstZero].sha} ${series[firstZero].date} — ${series[firstZero].subject.slice(0, 60)}`);
  console.log(`Längste error-freie Strecke: ${best} Stände, endet bei #${bestEnd} (${series[bestEnd].date}); am Ende der History error = ${last.error}.`);
  const after = series.slice(firstZero);
  const blips = after.filter((s) => s.error > 0);
  console.log(`Nach dem Kipppunkt: ${after.length - blips.length}/${after.length} Stände error-frei; ${blips.length} Ausreißer (${blips.map((b) => `#${series.indexOf(b)}=${b.error}`).join(', ') || '—'}).`);
  console.log('Lesart: die Reihe trennt „vor/nach dem Kipppunkt" — danach hat sie fast keine Auflösung mehr.');
}

// ===========================================================================
// KENNZAHL 3 — Halbwertszeit einer Violation
// ===========================================================================
console.log('');
line('=');
console.log('KENNZAHL 3 — Lebensdauer einer Violation (erstes Auftreten → Schließen)');
line('=');
// Lebensläufe: je Schlüssel die Episoden zwischen Auftreten und Verschwinden.
/**
 * Wie wurde die Violation im Schritt i-1 → i geschlossen? Die Frage, die die
 * Löschen-Gegenprobe schärft: ein Verstoß kann auch verschwinden, weil das Element
 * gelöscht wurde oder weil ein STATUS-Wechsel die Regel unanwendbar macht — beides
 * ist kein Modellfortschritt und muss getrennt ausgewiesen werden.
 */
function classifyClose(i, elementId) {
  if (elementId === '<graph>') return 'graph-weit';
  const prev = series[i - 1];
  const cur = series[i];
  if (!cur.elementIds.has(elementId)) return 'Element gelöscht';
  const edgesBefore = prev.incident.get(elementId) ?? new Set();
  const edgesAfter = cur.incident.get(elementId) ?? new Set();
  let edgeChanged = edgesBefore.size !== edgesAfter.size;
  if (!edgeChanged) for (const k of edgesAfter) if (!edgesBefore.has(k)) edgeChanged = true;
  const statusChanged = prev.elemStatus.get(elementId) !== cur.elemStatus.get(elementId);
  const bodyChanged = prev.elemJson.get(elementId) !== cur.elemJson.get(elementId);
  if (statusChanged) return 'Status umgestellt';
  if (edgeChanged) return 'Kante gezogen/geändert';
  if (bodyChanged) return 'Attribut geändert';
  return 'Element unberührt (Kontext anderswo)';
}

const episodes = [];
const openAtEnd = new Map();
const seenOpen = new Map(); // key -> {startIdx}
for (let i = 0; i < series.length; i++) {
  const cur = series[i].keys;
  const prev = i > 0 ? series[i - 1].keys : new Set();
  for (const k of cur) if (!seenOpen.has(k)) seenOpen.set(k, i);
  for (const k of prev) {
    if (cur.has(k)) continue;
    const startIdx = seenOpen.get(k);
    if (startIdx === undefined) continue;
    seenOpen.delete(k);
    const elementId = k.split('|')[1];
    episodes.push({
      key: k,
      ruleId: k.split('|')[0],
      elementId,
      startIdx,
      endIdx: i,
      states: i - startIdx,
      days: (Date.parse(series[i].date) - Date.parse(series[startIdx].date)) / 86400000,
      // Löschen-Gegenprobe auf Violation-Ebene: existierte das Element beim Schließen noch?
      byDeletion: elementId !== '<graph>' && !series[i].elementIds.has(elementId),
      // Wie wurde geschlossen? (Kante · Attribut · Status · nichts am Element)
      how: classifyClose(i, elementId),
    });
  }
}
for (const [k, idx] of seenOpen) openAtEnd.set(k, idx);
const median = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
console.log(`Geschlossene Episoden: ${episodes.length}   noch offen am Ende (zensiert): ${openAtEnd.size}`);
if (episodes.length) {
  console.log(`  Lebensdauer in Ständen: Median ${median(episodes.map((e) => e.states))}  Mittel ${(episodes.reduce((a, e) => a + e.states, 0) / episodes.length).toFixed(2)}  Max ${Math.max(...episodes.map((e) => e.states))}`);
  console.log(`  Lebensdauer in Tagen:   Median ${median(episodes.map((e) => e.days))}  Mittel ${(episodes.reduce((a, e) => a + e.days, 0) / episodes.length).toFixed(2)}  Max ${Math.max(...episodes.map((e) => e.days))}`);
  const sameDay = episodes.filter((e) => e.days === 0).length;
  console.log(`  Episoden mit Lebensdauer 0 Tage: ${sameDay} (${((sameDay / episodes.length) * 100).toFixed(1)} %) — Auflösung der Zeitachse ist der Commit-Tag, nicht die Minute.`);
}
// Links-Trunkierung: alles, was schon im ERSTEN Stand da war, hat kein bekanntes
// Entstehungsdatum — die History beginnt 2026-07-26 (frische Repo-History), nicht
// mit dem Modell. Für diese Episoden ist die gemessene Lebensdauer eine UNTERGRENZE.
const truncated = episodes.filter((e) => e.startIdx === 0);
console.log(`  Links-trunkiert (schon im ersten Stand vorhanden, wahres Alter unbekannt): ${truncated.length} (${((truncated.length / episodes.length) * 100).toFixed(1)} %) — für die ist die Lebensdauer eine UNTERGRENZE.`);
const clean = episodes.filter((e) => e.startIdx > 0);
if (clean.length) {
  console.log(`  Nur untrunkierte Episoden (n=${clean.length}): Median ${median(clean.map((e) => e.states))} Stände / ${median(clean.map((e) => e.days))} Tage.`);
}
const censoredShare = openAtEnd.size / (openAtEnd.size + episodes.length);
console.log(`  Zensierungsanteil: ${(censoredShare * 100).toFixed(1)} % — bei hoher Zensur ist eine Halbwertszeit nicht schätzbar, nur die geschlossene Teilmenge.`);
// Alter der offenen Befunde
if (openAtEnd.size) {
  const ages = [...openAtEnd.values()].map((i) => (Date.parse(last.date) - Date.parse(series[i].date)) / 86400000);
  console.log(`  Alter der am Ende OFFENEN Befunde in Tagen: Median ${median(ages)}  Max ${Math.max(...ages)}`);
}

// ===========================================================================
// KENNZAHL 4 — Wachstum vs. Violations als Pfad
// ===========================================================================
console.log('');
line('=');
console.log('KENNZAHL 4 — Wachstum ohne Fehlerwachstum: Elemente vs. Violations als Pfad');
line('=');
console.log(`Elemente ${first.elements} → ${last.elements}  (${(((last.elements - first.elements) / first.elements) * 100).toFixed(1)} %)`);
console.log(`Traces   ${first.traces} → ${last.traces}  (${(((last.traces - first.traces) / first.traces) * 100).toFixed(1)} %)`);
console.log(`Violations ${first.total} → ${last.total}  (${(((last.total - first.total) / first.total) * 100).toFixed(1)} %)`);
function pearson(xs, ys) {
  const m = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / m;
  const my = ys.reduce((a, b) => a + b, 0) / m;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < m; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? null : num / Math.sqrt(dx * dy);
}
console.log(`Korrelation Elemente ↔ Violations über die Stände: r = ${f(pearson(series.map((s) => s.elements), series.map((s) => s.total)), 6)}`);
console.log(`Korrelation Elemente ↔ V/Elem:                      r = ${f(pearson(series.map((s) => s.elements), pe), 6)}`);
// Quadranten der Schritte
let q = { grow_clean: 0, grow_dirty: 0, shrink_clean: 0, shrink_dirty: 0, still: 0 };
for (let i = 1; i < series.length; i++) {
  const de = series[i].elements - series[i - 1].elements;
  const dv = series[i].total - series[i - 1].total;
  if (de === 0 && dv === 0) q.still++;
  else if (de >= 0 && dv <= 0) q.grow_clean++;
  else if (de >= 0 && dv > 0) q.grow_dirty++;
  else if (de < 0 && dv <= 0) q.shrink_clean++;
  else q.shrink_dirty++;
}
console.log(`Schritt-Quadranten: wächst&sauberer ${q.grow_clean} · wächst&mehr Violations ${q.grow_dirty} · schrumpft&weniger ${q.shrink_clean} · schrumpft&mehr ${q.shrink_dirty} · still ${q.still}`);

// ===========================================================================
// GEGENPROBE 1 — Löschen
// ===========================================================================
console.log('');
line('=');
console.log('GEGENPROBE 1 — Ist der Rückgang durch LÖSCHEN erklärbar? (Aufräumen statt Verbessern)');
line('=');
let deleted = 0;
let added = 0;
let shrinkSteps = 0;
for (let i = 1; i < series.length; i++) {
  const prev = series[i - 1].elementIds;
  const cur = series[i].elementIds;
  let d = 0;
  let a = 0;
  for (const id of prev) if (!cur.has(id)) d++;
  for (const id of cur) if (!prev.has(id)) a++;
  deleted += d;
  added += a;
  if (series[i].elements < series[i - 1].elements) shrinkSteps++;
}
console.log(`Über ${series.length - 1} Schritte: ${added} Elemente hinzugefügt, ${deleted} gelöscht (netto ${added - deleted}).`);
console.log(`Schritte mit sinkender Elementzahl: ${shrinkSteps}/${series.length - 1}.`);
const byDel = episodes.filter((e) => e.byDeletion).length;
console.log(`Geschlossene Violations: ${episodes.length} — davon durch ELEMENT-LÖSCHUNG geschlossen: ${byDel} (${episodes.length ? ((byDel / episodes.length) * 100).toFixed(1) : '0'} %),`);
console.log(`  durch echte Reparatur am überlebenden Element: ${episodes.length - byDel} (${episodes.length ? (((episodes.length - byDel) / episodes.length) * 100).toFixed(1) : '0'} %).`);
console.log(`=> Kill „durch Löschen erklärbar": ${byDel / Math.max(1, episodes.length) > 0.5 ? 'FEUERT' : 'feuert nicht'}`);
console.log('');
console.log('Schärfer — WIE wurde geschlossen? (Löschen und Status-Umstellung sind kein Modellfortschritt)');
const howCount = {};
for (const e of episodes) howCount[e.how] = (howCount[e.how] ?? 0) + 1;
for (const [k, v] of Object.entries(howCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(38)} ${n(v, 4)}  (${((v / episodes.length) * 100).toFixed(1)} %)`);
}
const softClose = (howCount['Element gelöscht'] ?? 0) + (howCount['Status umgestellt'] ?? 0);
console.log(`  => „weich" geschlossen (gelöscht ODER Status umgestellt): ${softClose} (${((softClose / episodes.length) * 100).toFixed(1)} %)`);

// ===========================================================================
// GEGENPROBE 2 — Regel-Artefakt
// ===========================================================================
console.log('');
line('=');
console.log('GEGENPROBE 2 — Regel-Artefakt: hält der Verlauf auf der Regelmenge des STARTZEITPUNKTS?');
line('=');
if (!startRules) {
  console.log('NICHT MESSBAR: contracts-History nicht lesbar — die Startregelmenge konnte nicht erhoben werden.');
} else {
  const todayIds = new Set(series.flatMap((s) => Object.keys(s.byRule)));
  const newIds = [...todayIds].filter((id) => !startRules.ids.has(id));
  console.log(`Startregelmenge (contracts @ ${startRules.sha}, Stand ${startDate}): ${startRules.ids.size} Regel-IDs.`);
  console.log(`In der History feuernde Regeln heute: ${todayIds.size}. Davon NACH dem Start entstanden: ${newIds.length} (${newIds.sort().join(', ') || '—'}).`);
  const rp = series.map((s) => s.restrictedPerElement);
  console.log(`V/Elem eingeschränkt: Start ${f(rp[0], 6)} → Ende ${f(rp[rp.length - 1], 6)}  (${(((rp[rp.length - 1] - rp[0]) / rp[0]) * 100).toFixed(1)} %)`);
  const slFull = slope(pe);
  const slRestricted = slope(rp);
  console.log(`Steigung volle Regelmenge ${slFull.toExponential(2)} · eingeschränkt ${slRestricted.toExponential(2)} · Vorzeichen ${Math.sign(slFull) === Math.sign(slRestricted) ? 'GLEICH' : 'VERSCHIEDEN'}`);
  // Anteil der Gesamtänderung, den die nach Start entstandenen Regeln tragen
  const dFull = last.total - first.total;
  const dRestricted = last.restricted - first.restricted;
  console.log(`Δ Violations gesamt ${dFull} · davon auf Startregeln ${dRestricted} (${dFull !== 0 ? ((dRestricted / dFull) * 100).toFixed(1) : 'n/a'} %)`);
  console.log(`=> Kill „Regel-Artefakt": ${Math.sign(slFull) !== Math.sign(slRestricted) ? 'FEUERT' : 'feuert nicht'}`);
}

// Regel-Zerlegung: welche Regeln tragen die Bewegung?
console.log('');
console.log('Regel-Zerlegung Start → Ende (Top-Bewegungen):');
const allRules = new Set([...Object.keys(first.byRule), ...Object.keys(last.byRule)]);
const moves = [...allRules]
  .map((id) => ({ id, a: first.byRule[id] ?? 0, b: last.byRule[id] ?? 0 }))
  .map((m) => ({ ...m, d: m.b - m.a }))
  .filter((m) => m.d !== 0)
  .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
for (const m of moves.slice(0, 15)) {
  console.log(`  ${m.id.padEnd(7)} ${n(m.a, 5)} → ${n(m.b, 5)}  Δ ${(m.d > 0 ? '+' : '') + m.d}${startRules && !startRules.ids.has(m.id) ? '   (Regel nach Start entstanden)' : ''}`);
}

// Leave-one-rule-out: hängt der Trend an EINER Regel? (die schärfste Form der
// Regel-Artefakt-Frage — schärfer als die Startmengen-Einschränkung, weil sie auch
// eine Regel trifft, die es schon zu Beginn gab.)
console.log('');
console.log('Leave-one-rule-out — Steigung von V/Elem ohne die je stärkste Regel (Kill: Vorzeichenwechsel):');
const drivers = [...new Set(series.flatMap((s) => Object.keys(s.byRule)))]
  .map((id) => ({ id, mass: series.reduce((a, s) => a + (s.byRule[id] ?? 0), 0) }))
  .sort((x, y) => y.mass - x.mass)
  .slice(0, 6);
let looFlip = false;
for (const d of drivers) {
  const ys = series.map((s) => (s.total - (s.byRule[d.id] ?? 0)) / s.elements);
  const sl = slope(ys);
  if (Math.sign(sl) !== s0) looFlip = true;
  console.log(`  ohne ${d.id.padEnd(7)} (Masse ${n(d.mass, 5)}): Start ${f(ys[0], 6)} → Ende ${f(ys[ys.length - 1], 6)}  Steigung ${sl.toExponential(2)}${Math.sign(sl) !== s0 ? '   ← KIPPT' : ''}`);
}
console.log(`=> Kill „Trend hängt an einer Regel": ${looFlip ? 'FEUERT' : 'feuert nicht'}`);

// ===========================================================================
// GEGENPROBE 3 — Hash-Wiederbesuche
// ===========================================================================
console.log('');
line('=');
console.log('GEGENPROBE 3 — Kreisverkehr: Wiederbesuche des kanonischen Export-Hashes (CR-GC-407-Detektor)');
line('=');
const seen = new Map();
const revisits = [];
series.forEach((s, i) => {
  if (seen.has(s.hash)) revisits.push({ at: i, seenAt: seen.get(s.hash), sha: s.sha, date: s.date, subject: s.subject });
  else seen.set(s.hash, i);
});
console.log(`Distinkte Zustände: ${seen.size}/${series.length}. Wiederbesuche: ${revisits.length}.`);
for (const r of revisits) {
  const adj = r.at - r.seenAt === 1;
  console.log(`  Stand #${r.at} (${r.sha} ${r.date}) == Stand #${r.seenAt}${adj ? '  [BENACHBART — der Commit hat den Graphen nicht verändert, kein Kreis]' : '  [ECHTER KREIS]'} — ${r.subject.slice(0, 55)}`);
}
const realCycles = revisits.filter((r) => r.at - r.seenAt > 1).length;
console.log(`  Davon echte Kreise (Abstand > 1 Stand): ${realCycles}.`);
if (!revisits.length) console.log('  Kein Zustand wurde je wiederbesucht — kein Kreisverkehr in der realen History.');

// ===========================================================================
// JSON-Ausgabe
// ===========================================================================
if (JSON_OUT) {
  const out = {
    meta: {
      cr: 'CR-GC-427',
      computedAt: new Date().toISOString(),
      repo: REPO,
      file: REL,
      descriptorVersion: descriptor.version,
      ruleBuild: RULE_BUILD,
      registeredRules: (descriptor.rules ?? []).length,
      rulePopulation: 'today, applied uniformly to every historical state',
      skippedSources: ['conformance (RC-*) — braucht den Quellbaum des jeweiligen Commits'],
      statesInHistory: revs.length,
      statesEvaluated: series.length,
      statesUnreadable: unreadable,
      startRuleSet: startRules ? { sha: startRules.sha, date: startDate, ids: [...startRules.ids].sort() } : null,
    },
    series: series.map((s, i) => ({
      i,
      sha: s.sha,
      date: s.date,
      subject: s.subject,
      graphVersion: s.graphVersion,
      elements: s.elements,
      traces: s.traces,
      error: s.error,
      warning: s.warning,
      info: s.info,
      total: s.total,
      perElement: s.perElement,
      restricted: s.restricted,
      restrictedPerElement: s.restrictedPerElement,
      hash: s.hash,
      byRule: s.byRule,
    })),
    episodes: episodes.map((e) => ({
      ruleId: e.ruleId,
      elementId: e.elementId,
      startIdx: e.startIdx,
      endIdx: e.endIdx,
      states: e.states,
      days: e.days,
      byDeletion: e.byDeletion,
      how: e.how,
    })),
    openAtEnd: [...openAtEnd].map(([k, idx]) => ({ key: k, sinceIdx: idx, sinceDate: series[idx].date })),
    hashRevisits: revisits,
    churn: { added, deleted, shrinkSteps },
  };
  writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));
  console.log(`\n✔ Zeitreihe geschrieben: ${JSON_OUT}`);
}
console.log('');
