/**
 * typbindung-verb.ts — `graphcode typbindung [--ziel <datei>]` (CR-GC-1026).
 *
 * Erzeugt je Blatt-FUNC eine Zeile Typbindung gegen Anfrage- und Antwort-SCHEMA (`typbindungen`) und
 * schreibt sie in eine Datei, die `npm run type-check` prüft. Das Modell kommt aus dem committeten Snapshot
 * `docs/graph/*.graph.json` (kein Store, kein Konflikt mit einem laufenden Host).
 *
 * Das Verb liefert dem Generator die Aufrufe aus dem Code (`funcCalls` aus contracts, Bedeutung von RC-13)
 * und je Wirkkette die Abstände vom Auslöser (`ChainRoles.depth`); die Regel „Code vor Kette“ wendet der
 * Generator an (gemessen in CR-GC-1026, Lauf 5).
 *
 * Die Altlast steht in `<ziel-verzeichnis>/altlast.json` und wird nur von Hand geändert: Eine behobene FUNC
 * muss die Liste verlassen, weil ihr `@ts-expect-error` sonst unbenutzt ist.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod/v4';
import { chainRoles, funcCalls, readRealRef } from '@sigloch/contracts/se';
import { extractCodeFacts, toOntologyGraph } from '../kernel/conformance.js';
import { snapshotPathOf, snapshotToGraph } from '../projections/test-selection-audit.js';
import { typbindungen, type TypbindungErgebnis } from '../projections/typbindung.js';

/** Ziel ohne `--ziel`, relativ zum Repo. */
export const TYPBINDUNG_ZIEL = 'tests/typbindung/bindungen.ts';

/** Aufrufvertrag des Verbs (CR-GC-1027): das Repo und optional der Pfad der Bindungsdatei. */
export const TypbindungOptionenSchema = z.strictObject({
  repoRoot: z.string(),
  ziel: z.string().optional(),
});
export type TypbindungOptionen = z.input<typeof TypbindungOptionenSchema>;

/** Die Altlast: uids der FUNC, deren Bindung heute rot ist. */
export const TypbindungAltlastSchema = z.array(z.string());

/** Falscher Aufruf: kein Snapshot, unlesbare Altlast. Die CLI endet mit Exit-Code 2. */
export class TypbindungAufrufFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypbindungAufrufFehler';
  }
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

  return typbindungen({
    graph: onto,
    rufe: funcCalls(onto, facts).map(({ from, to }) => ({ from, to })),
    tiefen: chainRoles(onto).map((k) => k.depth),
    quellen,
    altlast,
    ziel,
  });
}

/** Erzeugt und schreibt die Bindungsdatei; liefert Text und Befunde für den Bericht. */
export function executeTypbindung(optionen: TypbindungOptionen): TypbindungErgebnis {
  const { repoRoot, ziel = TYPBINDUNG_ZIEL } = TypbindungOptionenSchema.parse(optionen);
  const ergebnis = erzeugeTypbindung(repoRoot, ziel);
  const datei = join(repoRoot, ziel);
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(datei, ergebnis.text);
  return ergebnis;
}
