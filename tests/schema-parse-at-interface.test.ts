/**
 * CR-GC-413 — RC-04: modellierte SCHEMAs sind Zod-Verträge, keine `interface`.
 *
 * Der Befund war nicht „ein `.parse()` fehlt", sondern: drei Datenverträge, die
 * die Prozessgrenze überqueren (MCP-Tool-Ergebnis → Client), waren im Code
 * `interface` und wurden am Empfang blank gecastet. Ein `as GenerationStep` auf
 * eine fremde Tool-Antwort ist keine Prüfung — es ist die Behauptung, geprüft
 * zu haben.
 *
 * Der Empfänger im Host (der eingebettete Executor) ist mit CR-GC-775 ausgelagert;
 * was bleibt, sind die Verträge selbst. Diese Suite prüft, dass sie die emittierte
 * Form annehmen und die kaputte abweisen:
 *   SCHEMA-generation-step  → `GenerationStep`
 *   SCHEMA-fit-advisory     → `FitAdvisory`
 *   SCHEMA-steering-delta   → `SteeringDelta`
 *
 * Echter Pfad für den Schritt: disk-Kuzu-Harness + echte Tool-Registry.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { GenerationStep } from '../src/loop/generate.js';
import { FitAdvisory } from '../src/kernel/measure/fit-advisory.js';
import { SteeringDelta } from '../src/kernel/measure/steering-snapshot.js';

// ---------------------------------------------------------------------------
// SCHEMA-fit-advisory + SCHEMA-steering-delta — die Verträge am Verdict
// ---------------------------------------------------------------------------

/** Ein fitAdvisory, wie `harness.mutate()` es emittiert. */
const FIT = {
  layer: 'arch' as const,
  dimensions: ['a', 'b'],
  before: [1, 1],
  after: [1.5, 0.75],
  delta: [0.5, -0.25],
  regressions: ['b'],
};

/** Ein steeringDelta, wie der dryRun-Zweig von `graph_mutate` es emittiert. */
const DELTA = {
  blockingErrors: { before: 2, after: 0 },
  // CR-GC-757: Befunde je Stufe, `delta = before − after` (positiv = weniger Befunde).
  stages: { Anforderung: { before: 5, after: 3, delta: 2 }, Modul: { before: 1, after: 2, delta: -1 } },
};

describe('SCHEMA-fit-advisory ist ein geprüfter Vertrag (RC-04)', () => {
  it('vertragstreues Advisory kommt als Daten durch', () => {
    expect(FitAdvisory.parse(FIT)).toEqual(FIT);
  });

  it('ein Advisory mit falsch typisiertem delta ist KEINE Messung', () => {
    // Genau die Antwort, die ein blanker Cast durchlässt: `delta` kein Zahlen-Array.
    expect(FitAdvisory.safeParse({ ...FIT, delta: 'kaputt' }).success).toBe(false);
  });

  it('ein unvollständiges Advisory zählt nicht als Messung (Vertrag, nicht Teilform)', () => {
    // `{delta}` allein ist keine FitAdvisory: layer/dimensions/before/after/
    // regressions gehören zum Vertrag, das Gate liefert sie immer mit.
    expect(FitAdvisory.safeParse({ delta: [9] }).success).toBe(false);
  });
});

describe('SCHEMA-steering-delta ist ein geprüfter Vertrag (RC-04)', () => {
  it('vertragstreues Delta kommt als Daten durch — je Stufe, die es nennt', () => {
    const delta = SteeringDelta.parse(DELTA);
    expect(delta).toEqual(DELTA);
    expect(delta.stages.Anforderung.delta).toBe(2);
    expect(delta.stages.Modul.delta).toBe(-1);
  });

  it('die alte Form (`dimensions` statt `stages`) ist kein Delta mehr (CR-GC-757)', () => {
    const alt = { blockingErrors: DELTA.blockingErrors, dimensions: { req: { before: 0.5, after: 0.7, delta: 0.2 } } };
    expect(SteeringDelta.safeParse(alt).success).toBe(false);
  });

  it('ein Delta ohne blockingErrors ist kein Delta', () => {
    // Der gefährliche Fall: ohne Prüfung zöge `stages`, während `blockingErrors` fehlt — ein Zug,
    // der Gate-Fehler einführt, läse sich als sauberer Fortschritt.
    expect(SteeringDelta.safeParse({ stages: DELTA.stages }).success).toBe(false);
    expect(SteeringDelta.safeParse({ blockingErrors: 'keine', stages: { Anforderung: { delta: 9 } } }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SCHEMA-generation-step — Registry-Grenze
// ---------------------------------------------------------------------------

describe('SCHEMA-generation-step: die Tool-Antwort erfüllt den Vertrag (RC-04)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: MCPToolRegistry;

  const makeConfig = (repoRoot: string): HarnessConfig => ({
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'greenfield' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  });

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-schema-parse-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('die ECHTE Tool-Antwort erfüllt den Vertrag (Produzent und Schema driften nicht)', async () => {
    const raw = await registry.graph_generate.handler({ intent: 'Ein Testsystem für den Vertrag.' });
    const step = GenerationStep.parse(raw);
    expect(step.phase).toBe('seed');
    // Genestete Felder sind mitgeprüft: die Readiness-Zeilen tragen je eine Stufe und ihre Zahl (CR-GC-757).
    // Am leeren Graphen meldet genau die Existenz-Regel des Systems — die Liste ist nicht leer.
    expect(step.readiness).toEqual([{ stage: 'System', findings: 1 }]);
    expect(step.focusStage).toBe('seed:sys');
    // Die alte Zeilenform (Dimension, Prozentwert) erfüllt den Vertrag nicht mehr.
    const alt = { ...(raw as Record<string, unknown>), readiness: [{ dimension: 'req', score: 0.5, violations: 1 }] };
    expect(GenerationStep.safeParse(alt).success).toBe(false);
  });

  it('eine gewanderte Tool-Antwort erfüllt den Vertrag nicht, statt still auf undefined zu steuern', () => {
    // Vor CR-GC-413 stand am Empfang `as GenerationStep`: `gen.phase`/`gen.focusKey` wären
    // undefined gewesen, `gen.done` falsy — eine Antwort ohne Instruktion wäre durchgegangen.
    const parsed = GenerationStep.safeParse({ phase: 'seed', done: false });
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues.map((i) => i.path.join('.'))).toEqual(expect.arrayContaining(['prompt', 'readiness']));
  });

  it('eine Antwort mit unbekannter phase wird abgewiesen (Enum, nicht freier String)', async () => {
    const raw = (await registry.graph_generate.handler({ intent: 'Ein Testsystem.' })) as Record<string, unknown>;
    expect(GenerationStep.safeParse({ ...raw, phase: 'finish' }).success).toBe(false);
    expect(GenerationStep.safeParse(raw).success).toBe(true);
  });
});
