/**
 * vertragstest-verb.ts — `graphcode vertragstest [SCHEMA-uid …] [--ziel <dir>]` (CR-GC-962).
 *
 * Erzeugt je SCHEMA mit Zod-`realRef` einen Vertragstest aus dem Schema selbst
 * (`erzeugeVertragstests`), je SCHEMA mit Vertragsdatei (`realRef` auf `.md` ohne Symbol) den Test
 * von Hand (CR-GC-965). Der Satz kommt aus dem committeten Snapshot `docs/graph/*.graph.json`;
 * das Verb oeffnet keinen Store und kollidiert deshalb nicht mit einem laufenden Host. Ohne uids
 * nimmt es jedes SCHEMA, dessen `realRef`-Datei im Repo liegt — ein Schema aus einem Paket gehoert
 * dem Paket, das es deklariert.
 *
 * Die TS-Quellen des Repos laedt ein Kindprozess mit `--experimental-transform-types` und einem
 * Lade-Hook `.js → .ts`: Node 22 ohne Flag kann nur Typen streichen und scheitert an
 * Parameter-Properties (gemessen an status.ts, scaffold.ts, init-verb.ts, upgrade.ts).
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { snapshotPathOf } from '../projections/test-selection-audit.js';
import {
  VertragstestBerichtSchema,
  VertragstestSatzSchema,
  type VertragstestBericht,
  type VertragstestSatz,
} from '../projections/vertragstest.js';

/** Ziel ohne `--ziel`, relativ zum Repo. */
export const VERTRAGSTEST_ZIEL = 'tests/vertrag';

/** Falscher Aufruf: unbekannte oder ungebundene uid, kein Snapshot. Die CLI endet mit Exit-Code 2. */
export class VertragstestAufrufFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VertragstestAufrufFehler';
  }
}

interface SnapshotElement {
  id: string;
  type: string;
  realRef?: { file?: string; symbol?: string };
}

/** Der Satz aus dem Snapshot: die genannten uids, sonst jedes SCHEMA mit `realRef` im Repo. */
export function vertragstestSatz(repoRoot: string, ids: readonly string[]): VertragstestSatz {
  let pfad: string;
  try {
    pfad = snapshotPathOf(repoRoot);
  } catch (err) {
    throw new VertragstestAufrufFehler(err instanceof Error ? err.message : String(err));
  }
  const elements = (JSON.parse(readFileSync(pfad, 'utf8')) as { elements: SnapshotElement[] }).elements;
  const satz = elements
    .filter((e) => e.type === 'SCHEMA' && e.realRef?.file && (e.realRef.symbol || e.realRef.file.endsWith('.md')))
    .filter((e) => (ids.length > 0 ? ids.includes(e.id) : existsSync(join(repoRoot, e.realRef?.file as string))))
    .map((e) => {
      const { file, symbol } = e.realRef as { file: string; symbol?: string };
      return symbol ? { id: e.id, file, symbol } : { id: e.id, file };
    });
  const fehlend = ids.filter((i) => !satz.some((s) => s.id === i));
  if (fehlend.length > 0) throw new VertragstestAufrufFehler(`kein SCHEMA mit realRef: ${fehlend.join(', ')}`);
  return VertragstestSatzSchema.parse(satz);
}

/** Laeuft im Kindprozess: Hook registrieren, Erzeuger laden, Bericht als JSON nach stdout. */
const KIND = `
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
const hook = "export async function resolve(s, c, n) { try { return await n(s, c); } catch (e) { if (e && e.code === 'ERR_MODULE_NOT_FOUND' && (/^\\\\.\\\\.?\\\\//.test(s) || s.startsWith('file:')) && s.endsWith('.js')) return n(s.slice(0, -3) + '.ts', c); throw e; } }";
register('data:text/javascript,' + encodeURIComponent(hook));
const [erzeuger, auftrag] = process.argv.slice(1);
const { satz, root, ziel } = JSON.parse(auftrag);
const { erzeugeVertragstests } = await import(erzeuger);
const bericht = await erzeugeVertragstests(satz, root, ziel, (p) => import(pathToFileURL(p).href));
process.stdout.write(JSON.stringify(bericht));
`;

export interface VertragstestOptionen {
  repoRoot: string;
  ids?: readonly string[];
  ziel?: string;
}

/** Erzeugt die Vertragstests und liefert den Bericht je SCHEMA. */
export function executeVertragstest(opt: VertragstestOptionen): VertragstestBericht {
  const root = resolve(opt.repoRoot);
  const satz = vertragstestSatz(root, opt.ids ?? []);
  const ziel = resolve(root, opt.ziel ?? VERTRAGSTEST_ZIEL);
  const erzeuger = new URL('../projections/vertragstest.js', import.meta.url).href;
  const lauf = spawnSync(
    process.execPath,
    ['--experimental-transform-types', '--no-warnings', '--input-type=module', '-e', KIND, erzeuger, JSON.stringify({ satz, root, ziel })],
    { cwd: root, encoding: 'utf8' },
  );
  if (lauf.status !== 0) {
    throw new Error(`Vertragstest-Kindprozess endete mit ${lauf.status ?? lauf.signal}: ${lauf.stderr.trim()}`);
  }
  return VertragstestBerichtSchema.parse(JSON.parse(lauf.stdout));
}
