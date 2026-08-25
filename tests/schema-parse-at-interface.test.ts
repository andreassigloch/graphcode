/**
 * CR-GC-413 — RC-04: modellierte SCHEMAs werden an ihrer Schnittstelle GEPARST.
 *
 * Der Befund war nicht „ein `.parse()` fehlt", sondern: drei Datenverträge, die
 * die Prozessgrenze überqueren (MCP-Tool-Ergebnis → Executor), waren im Code
 * `interface` und wurden am Empfang blank gecastet. Ein `as GenerationStep` auf
 * eine fremde Tool-Antwort ist keine Prüfung — es ist die Behauptung, geprüft
 * zu haben.
 *
 * Diese Suite prüft genau die drei Stellen, an denen der Vertrag jetzt gilt:
 *   SCHEMA-generation-step  → `GenerationStep.parse` in `runExecutor`
 *   SCHEMA-fit-advisory     → `FitAdvisory.safeParse` in `executor-rank`
 *   SCHEMA-steering-delta   → `SteeringDelta.safeParse` in `executor-rank`
 *
 * Echter Pfad: disk-Kuzu-Harness + echte Tool-Registry; simuliert wird nur die
 * kaputte Tool-Antwort, also genau der Fall, den der Cast verschluckt hat.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { GenerationStep } from '../src/generate.js';
import { FitAdvisory } from '../src/fit-advisory.js';
import { SteeringDelta } from '../src/steering-snapshot.js';
import { runExecutor, ExecutorConfigSchema, type CallModel } from '../src/executor.js';
import {
  fitAdvisoryOf,
  steeringDeltaOf,
  deltaSum,
  focusDelta,
  totalDelta,
  rankCandidates,
} from '../src/executor-rank.js';

// ---------------------------------------------------------------------------
// SCHEMA-fit-advisory + SCHEMA-steering-delta — Ranking-Grenze (executor-rank)
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
  dimensions: { req: { before: 0.5, after: 0.7, delta: 0.2 } },
};

const cand = (index: number, verdict: Record<string, unknown> | null) =>
  ({ index, verdict }) as Parameters<typeof rankCandidates>[0][number];

describe('SCHEMA-fit-advisory wird im Ranking geparst (RC-04)', () => {
  it('vertragstreues Advisory kommt als Daten durch — Σ delta ist der Δm-Wert', () => {
    expect(fitAdvisoryOf(cand(0, { success: true, fitAdvisory: FIT }).verdict)).toEqual(FIT);
    expect(deltaSum(cand(0, { success: true, fitAdvisory: FIT }).verdict)).toBeCloseTo(0.25);
  });

  it('ein Advisory mit falsch typisiertem delta ist KEINE Messung — vorher warf reduce', () => {
    // Genau die Antwort, die der `as MutateOutcome`-Cast in `runExecutor`
    // durchgelassen hat: `delta` kein Zahlen-Array. Ohne safeParse lief das in
    // `(...).reduce()` und riss den ganzen Best-of-N-Schritt mit.
    const broken = cand(0, { success: true, fitAdvisory: { ...FIT, delta: 'kaputt' } });
    expect(fitAdvisoryOf(broken.verdict)).toBeNull();
    expect(() => deltaSum(broken.verdict)).not.toThrow();
    expect(deltaSum(broken.verdict)).toBe(0);
  });

  it('ein unvollständiges Advisory zählt nicht als Messung (Vertrag, nicht Teilform)', () => {
    // `{delta}` allein ist keine FitAdvisory: layer/dimensions/before/after/
    // regressions gehören zum Vertrag, das Gate liefert sie immer mit.
    expect(fitAdvisoryOf(cand(0, { success: true, fitAdvisory: { delta: [9] } }).verdict)).toBeNull();
    expect(deltaSum(cand(0, { success: true, fitAdvisory: { delta: [9] } }).verdict)).toBe(0);
  });
});

describe('SCHEMA-steering-delta wird im Ranking geparst (RC-04)', () => {
  it('vertragstreues Delta steuert Fokus- und Gesamt-Delta', () => {
    const c = cand(0, { success: true, steeringDelta: DELTA });
    expect(steeringDeltaOf(c.verdict)).toEqual(DELTA);
    expect(focusDelta(c.verdict, 'req')).toBeCloseTo(0.2);
    expect(totalDelta(c.verdict)).toBeCloseTo(0.2);
  });

  it('ein Delta ohne blockingErrors ist kein Delta — es rankt nicht als Fortschritt', () => {
    // Der gefährliche Fall: ohne Prüfung hätte `dimensions` gezogen, während
    // `blockingErrors` fehlt — ein Kandidat, der Gate-Fehler einführt, wäre als
    // sauberer Fortschritt gerankt worden.
    const broken = cand(0, { success: true, steeringDelta: { dimensions: DELTA.dimensions } });
    expect(steeringDeltaOf(broken.verdict)).toBeNull();
    expect(focusDelta(broken.verdict, 'req')).toBe(0);
    expect(totalDelta(broken.verdict)).toBe(0);
  });

  it('geprüftes Delta schlägt ungeprüftes: der Kandidat mit gültigem Vertrag gewinnt', () => {
    const valid = cand(0, { success: true, tier: 'suggest', mutations: 1, steeringDelta: DELTA });
    const garbage = cand(1, {
      success: true,
      tier: 'suggest',
      mutations: 99,
      steeringDelta: { blockingErrors: 'keine', dimensions: { req: { delta: 9 } } },
    });
    expect(rankCandidates([garbage, valid], 'req')[0]).toBe(valid);
  });
});

// ---------------------------------------------------------------------------
// SCHEMA-generation-step — Registry-Grenze (runExecutor)
// ---------------------------------------------------------------------------

describe('SCHEMA-generation-step wird am Registry-Übergang geparst (RC-04)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: MCPToolRegistry;

  const makeConfig = (repoRoot: string): HarnessConfig => ({
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'greenfield' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  });

  const execConfig = ExecutorConfigSchema.parse({
    baseUrl: 'http://scripted.invalid',
    model: 'scripted',
    maxRounds: 1,
    maxStepTurns: 1,
  });

  /** Das Modell darf nie drankommen: der Parse bricht vor dem ersten Turn ab. */
  const neverCalled: CallModel = () => {
    throw new Error('model must not be called — the contract broke before the first turn');
  };

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
    // phaseReadiness ist genestet mitgeprüft (SCHEMA-phase-readiness).
    expect(step.phaseReadiness.length).toBeGreaterThan(0);
    for (const gate of step.phaseReadiness) expect(gate.covered).toBeLessThanOrEqual(gate.total);
  });

  it('eine gewanderte Tool-Antwort bricht laut ab, statt still auf undefined zu steuern', async () => {
    // Vor CR-GC-413 stand hier `as GenerationStep`: `gen.phase`/`gen.focusKey`
    // wären undefined gewesen, `gen.done` falsy — der Executor hätte die volle
    // Rundenzahl gegen eine Antwort gefahren, die keine Instruktion enthält.
    const broken = { ...registry.graph_generate, handler: () => Promise.resolve({ phase: 'seed', done: false }) };
    await expect(
      runExecutor({
        registry: { ...registry, graph_generate: broken } as MCPToolRegistry,
        workspaceDir: tmp,
        config: execConfig,
        callModel: neverCalled,
      }),
    ).rejects.toThrow(/prompt|phaseReadiness|invalid/i);
  });

  it('eine Antwort mit unbekannter phase wird abgewiesen (Enum, nicht freier String)', async () => {
    const raw = (await registry.graph_generate.handler({ intent: 'Ein Testsystem.' })) as Record<string, unknown>;
    expect(GenerationStep.safeParse({ ...raw, phase: 'finish' }).success).toBe(false);
    expect(GenerationStep.safeParse(raw).success).toBe(true);
  });
});
