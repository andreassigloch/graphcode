/**
 * CR-GC-576 — ein Advisory-Block ohne Aussage erscheint gar nicht.
 *
 * Gemessen an `rig/greenfield-systemtest/runs/opus5-5`, 23 Gate-Antworten: `fitAdvisory`
 * 12-mal von 21 leer, `workOrder` 18-mal von 21, `steerAdvisory` **21-mal von 21** —
 * durchgehend. Zusammen 11.990 Zeichen dafuer, dass nichts passiert ist. Ein leerer
 * `fitAdvisory` kostete allein 515, weil drei Arrays zu sechs Dimensionen je Zahl eine
 * eigene Zeile bekamen.
 *
 * Die zweite Haelfte der Zusage ist die wichtigere: ein Advisory MIT Aussage erscheint
 * unveraendert. Deshalb steht hier beides an EINEM echten Gate auf Platte — eine erzwungene
 * Regression und eine wandernde `allocate`-Kante.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, type GraphCodeHarness } from '../src/index.js';
import { bindToolsToHarness } from '../src/index.js';
import { fitAdvisoryIsSilent, steerAdvisoryIsSilent } from '../src/kernel/measure/fit-advisory.js';
import { workOrderIsSilent } from '../src/kernel/measure/work-order.js';

type Antwort = Record<string, unknown>;

let repoRoot: string;
let harness: GraphCodeHarness;
let tools: ReturnType<typeof bindToolsToHarness>;

const knoten = (uid: string, type: string, name: string, description: string) =>
  ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });
const kante = (sourceId: string, targetId: string, edgeType: string) =>
  ({ op: 'add-edge', edge: { sourceId, targetId, edgeType, attributes: {} } });

const mutiere = async (commands: unknown[]): Promise<Antwort> =>
  (await tools.graph_mutate.handler({ commands, consumerId: 'test' })) as Antwort;

beforeEach(async () => {
  repoRoot = mkdtempSync(join(tmpdir(), 'gc-silent-'));
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
  await harness.initialize();
  tools = bindToolsToHarness(harness);
});
afterEach(async () => {
  await harness.close();
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('TEST-silent-advisories: was nichts sagt, steht nicht da (CR-GC-576)', () => {
  it('ein Zug ohne Wirkung traegt keinen der drei Bloecke', async () => {
    // Ein einzelner CR-Knoten beruehrt weder den Architektur-Teilgraphen noch eine
    // allocate-Kante: alle drei Advisories haben nichts zu melden.
    const antwort = await mutiere([knoten('CR-X', 'CR', 'X', 'Ein Change Request ohne Umfang.')]);
    expect(antwort.success).toBe(true);
    expect(antwort).not.toHaveProperty('fitAdvisory');
    expect(antwort).not.toHaveProperty('steerAdvisory');
    expect(antwort).not.toHaveProperty('workOrder');
  });

  it('ein Advisory MIT Aussage erscheint unveraendert — wandernde allocate-Kante', async () => {
    await mutiere([
      knoten('MOD-a', 'MOD', 'A', 'Erstes Modul.'),
      knoten('MOD-b', 'MOD', 'B', 'Zweites Modul.'),
      knoten('FUNC-x', 'FUNC', 'X', 'Eine realisierte Funktion.'),
      kante('FUNC-x', 'MOD-a', 'allocate'),
    ]);
    await tools.graph_realize.handler({
      funcUid: 'FUNC-x', file: 'src/x.ts', symbol: 'x', consumerId: 'test',
    });

    // Umhaengen: die Datei muss mitwandern, also hat der workOrder etwas zu sagen.
    const antwort = await mutiere([
      { op: 'delete-edge', edge: { sourceId: 'FUNC-x', targetId: 'MOD-a', edgeType: 'allocate' } },
      kante('FUNC-x', 'MOD-b', 'allocate'),
    ]);
    expect(antwort.success).toBe(true);
    expect(antwort).toHaveProperty('workOrder');
    const wo = antwort.workOrder as { moves: { file: string; toMod: string }[] };
    expect(wo.moves).toEqual([
      { file: 'src/x.ts', funcId: 'FUNC-x', fromMod: 'MOD-a', toMod: 'MOD-b' },
    ]);
    expect(workOrderIsSilent(wo as never)).toBe(false);
  });

  /** Elemente in den Architektur-Teilgraphen legen, bis das Fit-Advisory ausschlaegt. */
  const architekturZug = () => [
      knoten('ACTOR-u', 'ACTOR', 'U', 'Ein Akteur am Systemrand.'),
      knoten('FUNC-a', 'FUNC', 'A', 'Erste Funktion der Kette.'),
      knoten('FUNC-b', 'FUNC', 'B', 'Zweite Funktion der Kette.'),
      knoten('SCHEMA-s', 'SCHEMA', 'S', 'Der Vertrag des Flusses.'),
      knoten('FLOW-f', 'FLOW', 'F', 'Der Fluss zwischen den beiden Funktionen.'),
      kante('FUNC-a', 'FLOW-f', 'io'),
      kante('FLOW-f', 'FUNC-b', 'io'),
      kante('FLOW-f', 'SCHEMA-s', 'relation'),
  ];

  it('ein Advisory MIT Regression erscheint unveraendert — MIT Zielprofil (CR-GC-590)', async () => {
    // Seit CR-GC-590 ist der ℝ⁶ ohne Ziel kein Verdict: erst das Profil macht ihn zur Richtung.
    writeFileSync(join(repoRoot, '.graphcode', 'target-profile.json'), JSON.stringify({ weights: { coherence: 1 } }));
    const antwort = await mutiere(architekturZug());
    expect(antwort.success).toBe(true);
    expect(antwort).toHaveProperty('fitAdvisory');
    const fit = antwort.fitAdvisory as { delta: number[] };
    expect(fit.delta.some((d) => d !== 0)).toBe(true);
    expect(fitAdvisoryIsSilent(fit as never)).toBe(false);
  });

  it('OHNE Zielprofil kommt kein fitAdvisory ueber die Leitung — auch nicht mit Regression (CR-GC-590)', async () => {
    // Runde 7: 8–15 fitAdvisory-Bloecke je Lauf, fast alle mit `regressions`, und der Agent
    // entschied Modulschnitte danach — obwohl der Satz "nur Bericht" hiess. Ohne Ziel ist eine
    // Regression keine Aussage; der Audit-Trail behaelt sie (Evidenz), die Antwort nicht.
    const antwort = await mutiere(architekturZug());
    expect(antwort.success).toBe(true);
    expect(antwort).not.toHaveProperty('fitAdvisory');
  });

  it('confidence ist auf keiner Antwort — eine Konstante ohne Leser (CR-GC-590)', async () => {
    const antwort = await mutiere([knoten('CR-Y', 'CR', 'Y', 'Ein Change Request ohne Umfang.')]);
    expect(antwort).not.toHaveProperty('confidence');
    const probe = (await tools.graph_mutate.handler({ commands: architekturZug(), consumerId: 'test', dryRun: true })) as Antwort;
    expect(probe).not.toHaveProperty('confidence');
    expect(probe).toHaveProperty('steeringDelta'); // die Probe behaelt ihr Vergleichsmass
  });

});

describe('TEST-silent-advisories: die Definition von "ohne Aussage" (CR-GC-576)', () => {
  it('fitAdvisory schweigt nur bei Null-Delta UND ohne Regression', () => {
    const basis = { layer: 'arch' as const, dimensions: ['a'], before: [1], after: [1] };
    expect(fitAdvisoryIsSilent({ ...basis, delta: [0], regressions: [] })).toBe(true);
    expect(fitAdvisoryIsSilent({ ...basis, delta: [0], regressions: ['a'] })).toBe(false);
    expect(fitAdvisoryIsSilent({ ...basis, delta: [0.1], regressions: [] })).toBe(false);
    expect(fitAdvisoryIsSilent({ ...basis, delta: [-0.1], regressions: [] })).toBe(false);
  });

  it('steerAdvisory schweigt nur bei durchgehend null — ein Pegel ist eine Aussage', () => {
    const basis = { rules: ['R-04'], worstAt: null, removesElements: false };
    expect(steerAdvisoryIsSilent({ ...basis, before: 0, after: 0, improvement: 0 })).toBe(true);
    // Die verworfene weitere Fassung: improvement 0 bei stehendem Ueberschuss. Der Block
    // traegt dann den Pegel UND worstAt — das ist etwas, auch wenn der Zug es nicht bewegt hat.
    expect(steerAdvisoryIsSilent({ ...basis, before: 3.75, after: 3.75, improvement: 0 })).toBe(false);
    expect(steerAdvisoryIsSilent({ ...basis, before: 0, after: 0, improvement: 0, removesElements: true })).toBe(false);
  });

  it('workOrder schweigt nur ohne moves UND ohne blind — eine blinde FUNC ist keine Stille', () => {
    expect(workOrderIsSilent({ moves: [], blind: [] })).toBe(true);
    expect(workOrderIsSilent({ moves: [], blind: [{ funcId: 'FUNC-x', reason: 'kein realRef' } as never] })).toBe(false);
  });
});
