/**
 * typbindung-verb.ts — `graphcode typbindung [--ziel <datei>]` (CR-GC-1026).
 *
 * Erzeugt je Blatt-FUNC eine Zeile Typbindung gegen Anfrage- und Antwort-SCHEMA (`typbindungen`) und
 * schreibt sie in eine Datei, die `npm run type-check` prüft. Das Modell kommt aus dem committeten Snapshot
 * `docs/graph/*.graph.json` (kein Store, kein Konflikt mit einem laufenden Host).
 *
 * Die Richtung eines FLOW zwischen f und p verdrahtet dieses Verb: Ruft im Code genau eine Seite die andere
 * (`funcCalls` aus contracts, die Bedeutung von RC-13), gilt das. Sonst gilt die Wirkkette: das Glied mit dem
 * kleineren Abstand vom Auslöser (`ChainRoles.depth`), wenn alle Ketten mit beiden Gliedern einig sind.
 * Sonst ist die Richtung offen (gemessen in CR-GC-1026, Lauf 5: Code vor Kette).
 *
 * Die Altlast steht in `<ziel-verzeichnis>/altlast.json` und wird nur von Hand geändert: Eine behobene FUNC
 * muss die Liste verlassen, weil ihr `@ts-expect-error` sonst unbenutzt ist.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod/v4';
import { chainRoles, funcCalls, readRealRef, type OntologyGraph } from '@sigloch/contracts/se';
import { extractCodeFacts, toOntologyGraph } from '../kernel/conformance.js';
import { snapshotPathOf, snapshotToGraph } from '../projections/test-selection-audit.js';
import { typbindungen, type Aufrufer, type TypbindungErgebnis } from '../projections/typbindung.js';

/** Ziel ohne `--ziel`, relativ zum Repo. */
export const TYPBINDUNG_ZIEL = 'tests/typbindung/bindungen.ts';

/** Die Altlast: uids der FUNC, deren Bindung heute rot ist. */
export const TypbindungAltlastSchema = z.array(z.string());

/** Falscher Aufruf: kein Snapshot, unlesbare Altlast. Die CLI endet mit Exit-Code 2. */
export class TypbindungAufrufFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypbindungAufrufFehler';
  }
}

/** Richtung aus Code vor Kette. */
export function aufruferAus(graph: OntologyGraph, rufe: ReadonlyArray<{ from: string; to: string }>): Aufrufer {
  const ruft = new Set(rufe.map((c) => `${c.from}|${c.to}`));
  const ketten = chainRoles(graph);
  return (_flow, f, p) => {
    const hin = ruft.has(`${f}|${p}`);
    const her = ruft.has(`${p}|${f}`);
    if (hin !== her) return hin ? f : p;
    const urteile = new Set(
      ketten
        .filter((k) => f in k.depth && p in k.depth)
        .map((k) => (k.depth[f] === k.depth[p] ? null : k.depth[f] < k.depth[p] ? f : p)),
    );
    return urteile.size === 1 ? [...urteile][0] : null;
  };
}

/** Erzeugt den Text der Bindungsdatei aus Snapshot, Code und Altlast, ohne zu schreiben. */
export function erzeugeTypbindung(repoRoot: string, ziel = TYPBINDUNG_ZIEL): TypbindungErgebnis {
  let pfad: string;
  try {
    pfad = snapshotPathOf(repoRoot);
  } catch (err) {
    throw new TypbindungAufrufFehler(err instanceof Error ? err.message : String(err));
  }
  const graph = snapshotToGraph(JSON.parse(readFileSync(pfad, 'utf8')));
  const onto = toOntologyGraph(graph);
  const facts = extractCodeFacts(graph, repoRoot);

  const altlastPfad = join(repoRoot, dirname(ziel), 'altlast.json');
  let altlast: string[] = [];
  if (existsSync(altlastPfad)) {
    const gelesen = TypbindungAltlastSchema.safeParse(JSON.parse(readFileSync(altlastPfad, 'utf8')));
    if (!gelesen.success) throw new TypbindungAufrufFehler(`${altlastPfad}: keine Liste von uids`);
    altlast = gelesen.data;
  }

  const quellen: Record<string, string> = {};
  for (const e of onto.elements) {
    if (e.type !== 'FUNC') continue;
    const r = readRealRef(e.attributes);
    if (r.state !== 'bound' || !r.value.file.endsWith('.ts')) continue;
    const datei = join(repoRoot, r.value.file);
    if (existsSync(datei)) quellen[r.value.file] = readFileSync(datei, 'utf8');
  }

  return typbindungen({ graph: onto, aufrufer: aufruferAus(onto, funcCalls(onto, facts)), quellen, altlast, ziel });
}

/** Erzeugt und schreibt die Bindungsdatei; liefert die Befunde für den Bericht. */
export function executeTypbindung(opts: { repoRoot: string; ziel?: string }): TypbindungErgebnis['befunde'] {
  const ziel = opts.ziel ?? TYPBINDUNG_ZIEL;
  const ergebnis = erzeugeTypbindung(opts.repoRoot, ziel);
  const datei = join(opts.repoRoot, ziel);
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(datei, ergebnis.text);
  return ergebnis.befunde;
}
