/**
 * CR-GC-275 — generationStep/graph_generate: der Kaltstart-Generierungstreiber.
 *
 * Deterministische Zustandsmaschine seed → expand → handoff; der Prompt ist
 * die konkrete Generierungs-Instruktion (Funde + Kandidaten- + Gate-Protokoll).
 * Kern pur über Graph-Fixtures; Tool über echten disk-Kuzu-Harness.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { generationStep, DIMENSION_FOCUS_TYPES } from '../src/generate.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const node = (uid: string, type: string, name: string, description = '') => ({
  uid,
  type,
  name,
  description,
  attributes: {},
});
const edge = (sourceId: string, targetId: string, edgeType: string) => ({
  sourceId,
  targetId,
  edgeType,
  attributes: {},
});
const g = (nodes: unknown[], edges: unknown[]): Graph => ({ nodes, edges }) as Graph;

const EMPTY = g([], []);
const INTENT = 'Ein Bestellsystem, mit dem Kunden Ersatzteile suchen und bestellen.';

describe('generationStep — Zustandsmaschine (pur)', () => {
  it('leerer Graph ohne Intention → seed-Phase fordert die Intention an', () => {
    const step = generationStep(EMPTY);
    expect(step.phase).toBe('seed');
    expect(step.done).toBe(false);
    expect(step.prompt).toContain('Intention');
    expect(step.prompt).toContain('graph_generate');
  });

  it('leerer Graph mit Intention → Seed-Batch-Instruktion (SYS/ACTOR/UC, Gate-Protokoll)', () => {
    const step = generationStep(EMPTY, INTENT);
    expect(step.phase).toBe('seed');
    expect(step.prompt).toContain(INTENT);
    for (const part of ['SYS', 'ACTOR', 'UC', 'dryRun', 'fitAdvisory', 'graph_authoring_guide']) {
      expect(step.prompt).toContain(part);
    }
    // Keine Architektur im Seed — Struktur folgt readiness-getrieben.
    expect(step.prompt).toContain('Keine FUNC/MOD-Ebene im Seed');
  });

  it('SYS mit Defiziten → expand fokussiert die schwächste Dimension mit konkreten Funden', () => {
    const graph = g(
      [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, undefined, 0.8);
    expect(step.phase).toBe('expand');
    expect(step.done).toBe(false);
    // Intention kommt aus der SYS-description — kein intent-Parameter nötig.
    expect(step.prompt).toContain(INTENT);
    // Konkreter Fund mit Element-UID + Regel, kein generischer Ratschlag.
    expect(step.prompt).toMatch(/UC-bestellen \([A-Z]+-?\d*/);
    expect(step.blockingErrors).toBeGreaterThan(0);
    // Deterministisch.
    expect(generationStep(graph, undefined, 0.8)).toEqual(step);
  });

  it('threshold 0 + keine Blocker → handoff auf graph_suggest', () => {
    // Minimal blockerfrei: SYS + verifiziertes REQ-UC-Paar mit Actor/FCHAIN-Kette.
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-bestellung', 'REQ', 'Bestellung wird bestätigt'),
        node('TEST-bestellung', 'TEST', 'Bestellbestätigung prüfen'),
        node('FCHAIN-bestellung', 'FCHAIN', 'Bestellablauf'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('ACTOR-kunde', 'UC-bestellen', 'io'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
      ],
    );
    const step = generationStep(graph, undefined, 0);
    expect(step.blockingErrors).toBe(0);
    expect(step.phase).toBe('handoff');
    expect(step.done).toBe(true);
    expect(step.prompt).toContain('graph_suggest');
    expect(step.prompt).toContain('target');
  });
});

describe('generationStep — Fund-Rotation/defer (CR-GC-281)', () => {
  // SYS + 2 UCs ohne Actor/REQ/FCHAIN → mehrere Dimensionen mit Funden,
  // also garantiert mehr als ein Fokus-Kandidat.
  const graph = g(
    [
      node('SYS-shop', 'SYS', 'shop', INTENT),
      node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      node('UC-suchen', 'UC', 'suchen', 'Kunde sucht Teil.'),
    ],
    [edge('SYS-shop', 'UC-bestellen', 'compose'), edge('SYS-shop', 'UC-suchen', 'compose')],
  );

  it('focusKey ist stabil und deterministisch (dimension:element_ids sortiert)', () => {
    const step = generationStep(graph, undefined, 0.8);
    expect(step.phase).toBe('expand');
    expect(step.focusKey).toMatch(/^[a-z]+:.+/);
    // Gleicher Graph + gleiches defer ⇒ identischer Schritt inkl. focusKey.
    expect(generationStep(graph, undefined, 0.8)).toEqual(step);
    // Kein Fokus ⇒ kein focusKey (seed).
    expect(generationStep(EMPTY, INTENT).focusKey).toBeNull();
  });

  it('defer überspringt das Fund-Set — anderer focusKey, anderer Prompt', () => {
    const first = generationStep(graph, undefined, 0.8);
    const second = generationStep(graph, undefined, 0.8, [first.focusKey as string]);
    expect(second.phase).toBe('expand');
    expect(second.focusKey).not.toBe(first.focusKey);
    expect(second.prompt).not.toBe(first.prompt);
    // Deterministisch auch mit defer.
    expect(generationStep(graph, undefined, 0.8, [first.focusKey as string])).toEqual(second);
  });

  it('alles deferred → Fallback ohne Dead-End, Hinweis im Prompt', () => {
    // Alle Kandidaten einsammeln, bis sich ein focusKey wiederholt.
    const keys: string[] = [];
    let step = generationStep(graph, undefined, 0.8, keys);
    while (step.focusKey && !keys.includes(step.focusKey) && keys.length < 30) {
      keys.push(step.focusKey);
      step = generationStep(graph, undefined, 0.8, keys);
    }
    // Kein Dead-End: defer wird ignoriert, der erste Kandidat kommt zurück …
    expect(step.phase).toBe('expand');
    expect(step.focusKey).toBe(keys[0]);
    // … und der Prompt macht die aufgehobene Zurückstellung kenntlich.
    expect(step.prompt).toContain('Zurückstellung wird ignoriert');
  });
});

describe('DIMENSION_FOCUS_TYPES / GenerationStep.focusTypes (CR-GC-285)', () => {
  it('das Mapping deckt seed + alle 8 Readiness-Dimensionen mit nichtleeren Typlisten ab', () => {
    expect(Object.keys(DIMENSION_FOCUS_TYPES).sort()).toEqual(
      ['alloc', 'arch', 'cr', 'ms', 'req', 'schema', 'seed', 'uc', 'ver'],
    );
    for (const types of Object.values(DIMENSION_FOCUS_TYPES)) {
      expect(types.length).toBeGreaterThan(0);
    }
    expect(DIMENSION_FOCUS_TYPES.seed).toEqual(['SYS', 'ACTOR', 'UC']);
    expect(DIMENSION_FOCUS_TYPES.ver).toEqual(['TEST', 'REQ']);
  });

  it('seed trägt die Seed-Typen; seed ohne Intention trägt keine', () => {
    expect(generationStep(EMPTY, INTENT).focusTypes).toEqual(DIMENSION_FOCUS_TYPES.seed);
    expect(generationStep(EMPTY).focusTypes).toEqual([]);
  });

  it('expand trägt die Typen der Fokus-Dimension (konsistent zum focusKey)', () => {
    const graph = g(
      [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, undefined, 0.8);
    expect(step.phase).toBe('expand');
    const dim = (step.focusKey as string).split(':')[0];
    expect(step.focusTypes).toEqual(DIMENSION_FOCUS_TYPES[dim]);
  });

  it('handoff trägt keine Fokus-Typen', () => {
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-bestellung', 'REQ', 'Bestellung wird bestätigt'),
        node('TEST-bestellung', 'TEST', 'Bestellbestätigung prüfen'),
        node('FCHAIN-bestellung', 'FCHAIN', 'Bestellablauf'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('ACTOR-kunde', 'UC-bestellen', 'io'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
      ],
    );
    const step = generationStep(graph, undefined, 0);
    expect(step.phase).toBe('handoff');
    expect(step.focusTypes).toEqual([]);
  });
});

// Hinweis: Ein 'local'-Minimal-Rendering (CR-GC-282) wurde hier getestet und
// nach negativer Validierung (v13b: 22 vs. 82 Elemente) wieder ENTFERNT —
// der Executor fährt das volle Rendering; siehe docs/cr/done/CR-GC-282.

describe('graph_generate — MCP-Binding (echter Harness)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-generate-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  function makeConfig(repoRoot: string): HarnessConfig {
    return {
      repoRoot,
      scope: { workspaceId: 'test-ws', systemId: 'greenfield' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
  }

  it('leerer Store → seed; nach Seed-Mutation durchs Gate → expand mit Intent aus SYS', async () => {
    const first = (await tools.graph_generate.handler({ intent: INTENT, threshold: 0.8 })) as {
      phase: string;
      prompt: string;
    };
    expect(first.phase).toBe('seed');
    expect(first.prompt).toContain(INTENT);

    const res = await harness.mutate([
      { op: 'add-node', node: node('SYS-shop', 'SYS', 'shop', INTENT) },
      { op: 'add-node', node: node('ACTOR-kunde', 'ACTOR', 'Kunde') },
      { op: 'add-node', node: node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.') },
      { op: 'add-edge', edge: edge('SYS-shop', 'UC-bestellen', 'compose') },
      { op: 'add-edge', edge: edge('ACTOR-kunde', 'UC-bestellen', 'io') },
    ]);
    expect(res.success).toBe(true);

    const second = (await tools.graph_generate.handler({ threshold: 0.8 })) as { phase: string; prompt: string };
    expect(second.phase).toBe('expand');
    expect(second.prompt).toContain(INTENT); // aus SYS-description, ohne intent-Parameter
  });
});
