#!/usr/bin/env node
// CR-GC-629 — Randbreiten: steuert `boundaryWidth` ueberhaupt, und wo?
//
// EIN Knopf, ZWEI Verteilungen. `policy.boundaryWidth` treibt BW-02 (Rand einer FUNC-Whitebox,
// `moduleCrossings.byFunc`) UND R-04 (Rand eines Moduls, `moduleCrossings.byModule`). Die Zahl
// war bis hierher einmal je CR gemessen und danach eine Behauptung. Dieses Skript zieht die
// Verteilung ueber die erreichbaren Familiengraphen; `tests/randbreiten.test.ts` haelt den
// gemessenen Stand und nennt im Fehlertext, welche Zahl gewandert ist.
//
// EIN Rechenweg: die Zaehlung kommt aus `moduleCrossings` — derselben Funktion, die BW-02 und
// R-04 im Gate benutzen. Ein zweiter waere ein zweites Ergebnis.
//
// WB ist die Grundgesamtheit von BW-02: die ZERLEGTEN FUNC (`FUNC -compose-> FUNC`). Sie steht
// hier, weil ohne sie die Befundzahl nicht lesbar ist — moneyflow hat 306 FUNC und null
// Whiteboxen, die Regel kann dort strukturell nicht feuern. Die Definition ist woertlich die
// aus `module-crossings.ts`; gezaehlt wird die Grundgesamtheit, nicht die Kreuzung.
//
// Aufruf aus dem graphcode-Repo:  node scripts/randbreiten.mjs [--json]
// Read-only: liest Graph-Snapshots, schreibt nichts.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { moduleCrossings, DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Die zwei Schwellen, gegen die gezaehlt wird — die geltende und die erwogene. */
export const SCHWELLEN = [5, 7];

/**
 * Die erreichbaren Graphen, in fester Reihenfolge.
 *
 * Drei Klassen, bewusst getrennt:
 *   - `snapshot` — eingefroren und eingecheckt (`rig/graphs/`, das Golden). Nur diese haelt der
 *     Test fest: ihre Zahlen koennen sich nur aendern, wenn die REGEL oder die Zaehlung wandert.
 *   - `live`     — der eigene SSOT. Wandert mit jedem Modellzug; wird berichtet, nicht gehalten.
 *   - `lauf`     — Rig-Laeufe unter `runs/` (gitignored). Auf einer frischen Maschine nicht da;
 *     ihr Fehlen ist ein ZUSTAND, kein Fehler.
 */
export function quellen(repo = REPO) {
  const out = [];
  const nimm = (name, pfad, klasse) => {
    if (existsSync(pfad)) out.push({ name, pfad, klasse });
  };

  nimm('graphcode (live)', join(repo, 'docs/graph/graphcode.graph.json'), 'live');
  nimm('sigllm-v98 (golden)', join(repo, 'rig/sigllm-spezifikation/golden/sigllm-v98.graph.json'), 'snapshot');

  const korpus = join(repo, 'rig/graphs');
  if (existsSync(korpus)) {
    for (const datei of readdirSync(korpus).filter((f) => f.endsWith('.graph.json')).sort()) {
      nimm(datei.replace(/\.graph\.json$/, ''), join(korpus, datei), 'snapshot');
    }
  }

  const laeufe = join(repo, 'rig/greenfield-systemtest/runs');
  if (existsSync(laeufe)) {
    for (const lauf of readdirSync(laeufe).sort()) {
      const dir = join(laeufe, lauf, 'docs/graph');
      if (!existsSync(dir)) continue;
      const dateien = readdirSync(dir).filter((f) => f.endsWith('.graph.json')).sort();
      for (const datei of dateien) {
        // Ein Lauf kann mehrere Systeme tragen (`opus5-2` fuehrt `opus5-2` und `webapp`). Der
        // Name muss sie unterscheiden, sonst stehen zwei Zeilen unter einem Schluessel.
        const stamm = datei.replace(/\.graph\.json$/, '');
        nimm(dateien.length > 1 ? `${lauf}/${stamm} (Lauf)` : `${lauf} (Lauf)`, join(dir, datei), 'lauf');
      }
    }
  }
  return out;
}

/** Die ZERLEGTEN FUNC — Grundgesamtheit von BW-02, Definition woertlich aus `module-crossings.ts`. */
function whiteboxes(graph) {
  const typeOf = new Map(graph.elements.map((e) => [e.id, e.type]));
  const out = new Set();
  for (const t of graph.traces) {
    if (t.type !== 'compose') continue;
    if (typeOf.get(t.source) !== 'FUNC' || typeOf.get(t.target) !== 'FUNC') continue;
    out.add(t.source);
  }
  return out;
}

/** Zaehlungen einer Randmenge (`byFunc` oder `byModule`) gegen die Schwellen. */
function verteilung(map) {
  const werte = [...map.values()].map((s) => s.size);
  const ueber = Object.fromEntries(SCHWELLEN.map((s) => [s, werte.filter((v) => v >= s).length]));
  return { ueber, max: werte.length > 0 ? Math.max(...werte) : 0 };
}

/** Eine Zeile der Tabelle — aus EINEM `moduleCrossings`-Lauf je Graph. */
export function misst(quelle) {
  const graph = JSON.parse(readFileSync(quelle.pfad, 'utf8'));
  const kreuzungen = moduleCrossings(graph);
  const bw = verteilung(kreuzungen.byFunc);
  const mod = verteilung(kreuzungen.byModule);
  const zaehle = (typ) => graph.elements.filter((e) => e.type === typ).length;
  return {
    name: quelle.name,
    klasse: quelle.klasse,
    func: zaehle('FUNC'),
    mod: zaehle('MOD'),
    wb: whiteboxes(graph).size,
    bwUeber: bw.ueber,
    bwMax: bw.max,
    modUeber: mod.ueber,
    modMax: mod.max,
  };
}

/** Die ganze Tabelle, deterministisch: gleiche Dateien, gleiche Zahlen, gleiche Reihenfolge. */
export function randbreiten(repo = REPO) {
  return quellen(repo).map(misst);
}

// ---------------------------------------------------------------------------
// Bericht
// ---------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('randbreiten.mjs')) {
  const zeilen = randbreiten();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(zeilen, null, 2));
  } else {
    const geltend = DEFAULT_METRIC_POLICY.boundaryWidth?.warning ?? null;
    console.log(`# Randbreiten je Familiengraph — boundaryWidth treibt BW-02 (FUNC) und R-04 (MOD)`);
    console.log(`# contracts-Startwert: ${geltend ?? 'null (aus)'} · Schwellen hier: ${SCHWELLEN.join(', ')}\n`);
    const kopf = ['Graph', 'FUNC', 'MOD', 'WB', ...SCHWELLEN.map((s) => `BW>=${s}`), 'BWmax', ...SCHWELLEN.map((s) => `MOD>=${s}`), 'MODmax'];
    console.log('| ' + kopf.join(' | ') + ' |');
    console.log('|' + kopf.map(() => '---').join('|') + '|');
    for (const z of zeilen) {
      console.log(
        '| ' +
          [
            z.name,
            z.func,
            z.mod,
            z.wb,
            ...SCHWELLEN.map((s) => z.bwUeber[s]),
            z.bwMax,
            ...SCHWELLEN.map((s) => z.modUeber[s]),
            z.modMax,
          ].join(' | ') +
          ' |',
      );
    }
    const summe = (feld, s) => zeilen.reduce((a, z) => a + z[feld][s], 0);
    console.log(
      `\n# BW-02 gesamt: ${summe('bwUeber', 5)} Befunde bei 5, ${summe('bwUeber', 7)} bei 7 · ` +
        `R-04 gesamt: ${summe('modUeber', 5)} bei 5, ${summe('modUeber', 7)} bei 7`,
    );
    console.log('# Graphen ohne Whitebox koennen BW-02 strukturell nicht ausloesen — WB ist die Grundgesamtheit.');
  }
}
