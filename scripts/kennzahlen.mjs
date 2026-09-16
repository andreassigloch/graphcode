#!/usr/bin/env node
// CR-GC-546 — Kennzahlen-Verlauf: EINE Zeile je Zug, angehängt an docs/project/kennzahlen.md.
//
// Warum als Skript und nicht von Hand: der Verlauf ist nur so viel wert wie seine
// Vergleichbarkeit. Abgeschriebene Zahlen driften, und zwei Rechenwege sind zwei Ergebnisse —
// deshalb kommen Steuerung und Befunde vom LAUFENDEN Host (derselbe Pfad, den das Gate nimmt)
// und die Grenzmenge aus `grenzmenge.mjs` (derselbe Rechenweg, den CR-GC-545 belegt hat).
//
//   node scripts/kennzahlen.mjs "<Anlass>"        Zeile anhängen
//   node scripts/kennzahlen.mjs "<Anlass>" --dry  nur zeigen
//
// Braucht einen laufenden graphcode-Host (`.graphcode/host.sock`). Ohne ihn bricht es ab,
// statt eine Zeile mit halben Zahlen zu schreiben.
import { readFileSync, appendFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { callHost, HOST_SOCK_BASENAME } from '@sigloch/graphcode-client';
import { metrics, METRIC_DIMENSIONS } from '@sigloch/se-engine';
import { messeGrenzmenge } from './grenzmenge.mjs';

// Repo als erstes Argument, damit die Null-Zeile eines FREMDEN Projekts von hier aus gezogen
// werden kann — der Recorder liegt in graphcode, gemessen wird anderswo (CR-GC-548).
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const REPO = args.length > 1 ? args[0].replace(/\/+$/, '') : process.cwd();
const SOCK = `${REPO}/.graphcode/${HOST_SOCK_BASENAME}`;
// Auf dem Kennzahlen-Regal, nicht in docs/records/: das ist git-ignored (gate-review records
// bleiben lokal), und ein Verlauf ohne History waere keiner. MESSGROESSEN.md traegt die
// DEFINITIONEN, KPI.md den Nachprojekt-Standard, hier steht die REIHE — eine Definition,
// eine Rechenstelle, ein Ort.
const ZIEL = `${REPO}/docs/kennzahlen.md`;
const anlass = args.length > 1 ? args[1] : args[0];
const dry = process.argv.includes('--dry');
if (!anlass) { console.error('Aufruf: node scripts/kennzahlen.mjs [<repo>] "<Anlass>" [--dry]'); process.exit(2); }
if (!existsSync(SOCK)) {
  console.error(`Kein Host in ${REPO}: ${SOCK} fehlt.\nOhne ihn gäbe es nur halbe Zahlen — Host starten (graphcode mcp) und erneut.`);
  process.exit(1);
}

const rd = await callHost(SOCK, 'graph_readiness', { detail: true });
const g = messeGrenzmenge(REPO);
const snapshot = g.graph;
const m = metrics({ elements: snapshot.elements, traces: snapshot.traces }, { layer: 'arch' });

const schwere = { error: 0, warning: 0, info: 0 };
for (const v of rd.violations ?? []) schwere[v.severity] = (schwere[v.severity] ?? 0) + 1;

const [func, schema] = g.r;
const z = {
  datum: new Date().toISOString().slice(0, 10),
  v: snapshot.graphVersion,
  anlass: g.leer ? `${anlass} · NULL-ZEILE (noch kein Modell/Quellcode)` : anlass,
  knoten: snapshot.elements.length,
  r6: METRIC_DIMENSIONS.map((d) => m[d].toFixed(3)).join(' / '),
  steer: rd.steer?.score?.toFixed(3) ?? '—',
  worstAt: rd.steer?.worstAt ? `${rd.steer.worstAt.ruleId}@${rd.steer.worstAt.elementId}` : '—',
  error: schwere.error,
  warning: schwere.warning,
  reichweite: g.dateien.length === 0 ? '—' : `${(100 * g.aufloesung).toFixed(0)} %`,
  func: `${func.da}/${func.pflicht}`,
  schema: `${schema.da}/${schema.pflicht}`,
};

const zeile = `| ${z.datum} | ${z.v} | ${z.anlass} | ${z.knoten} | ${z.r6} | ${z.steer} | ${z.worstAt} | ${z.error} | ${z.warning} | ${z.reichweite} | ${z.func} | ${z.schema} |`;

const KOPF = `# Kennzahlen-Verlauf

Eine Zeile je Zug, geschrieben von \`scripts/kennzahlen.mjs\` — nie von Hand.
\`MESSGROESSEN.md\` trägt die Definitionen, hier steht der Verlauf. Der Verlauf ist nur
so viel wert wie seine Vergleichbarkeit: Steuerung und Befunde kommen vom laufenden Host
(derselbe Pfad wie das Gate), die Grenzmenge aus \`grenzmenge.mjs\` (CR-GC-545).

**ℝ⁶ (arch)** = ${METRIC_DIMENSIONS.join(' / ')}.
**Steuerung** = Chebyshev-Score über die Regelüberschüsse; \`worstAt\` ist der dominierende Term.
**Reichweite** = Quelldateien, die zu einem MOD auflösen. Unter 80 % ist die Grenzdeckung daneben\neine Aussage über einen kleinen Nenner.\n**Grenzmenge** = modellierte von pflichtigen Schnittstellen (Symbole, die eine MOD-Grenze kreuzen).

| Datum | v | Anlass | Knoten | ℝ⁶ (arch) | Steuerung | dominant | error | warning | Reichweite | FUNC-Grenze | SCHEMA-Grenze |
|---|---:|---|---:|---|---:|---|---:|---:|---:|---:|---:|
`;

if (dry) { console.log(zeile); process.exit(0); }
if (!existsSync(ZIEL)) { mkdirSync(ZIEL.slice(0, ZIEL.lastIndexOf('/')), { recursive: true }); writeFileSync(ZIEL, KOPF); }
appendFileSync(ZIEL, zeile + '\n');
console.log(zeile);
console.log(`\n→ ${ZIEL.slice(REPO.length + 1)}`);
