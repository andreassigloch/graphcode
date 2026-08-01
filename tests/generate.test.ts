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
import { evaluateAllRules, type OntologyGraph } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { exportGraphJson } from '../src/exporter.js';
import { generationStep } from '../src/generate.js';
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

describe('generationStep — profile-Rendering (CR-GC-282)', () => {
  const graph = g(
    [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
    [edge('SYS-shop', 'UC-bestellen', 'compose')],
  );

  it("profile 'local' expand: EIN Fund mit fixHint aus der Regel + REGELN, kein Gate-Protokoll", () => {
    const step = generationStep(graph, undefined, 0.8, [], 'local');
    expect(step.phase).toBe('expand');
    expect(step.prompt).not.toContain('Gate-Protokoll');
    expect(step.prompt).not.toContain('2–3 Kandidaten');
    expect(step.prompt).toContain('Aufgabe: EIN Batch, der GENAU diesen Fund behebt.');
    expect(step.prompt).toContain('REGELN:');
    expect(step.prompt).toContain('im SELBEN Batch');
    // v13-Befund: die Kanten-Grammatik der Fokus-Dimension muss im local-Prompt
    // stehen — ohne sie rät das Modell illegale Kanten (30 Rejections/24 Runden).
    expect(step.prompt).toContain('Baue: ');

    // Der gerenderte Fund ist der ERSTE Fokus-Fund — element_id/rule_id/message/
    // fixHint kommen aus der Regel (evaluateAllRules), nichts ist hart kodiert.
    const m = /Fund: (\S+) \((\S+): /.exec(step.prompt);
    expect(m).not.toBeNull();
    const [, elementId, ruleId] = m as RegExpExecArray;
    expect(step.focusKey).toContain(elementId);
    const og = JSON.parse(exportGraphJson(graph)) as OntologyGraph;
    const violation = evaluateAllRules(og).find(
      (v) => v.element_id === elementId && v.rule_id === ruleId,
    );
    expect(violation).toBeDefined();
    expect(step.prompt).toContain(violation!.message);
    if (violation!.fix_hint) expect(step.prompt).toContain(`— Fix: ${violation!.fix_hint}`);
  });

  it("profile default/'frontier': Prompt identisch zum bisherigen Verhalten (Gate-Protokoll)", () => {
    const byDefault = generationStep(graph, undefined, 0.8);
    const explicit = generationStep(graph, undefined, 0.8, [], 'frontier');
    expect(explicit).toEqual(byDefault);
    expect(byDefault.prompt).toContain('Gate-Protokoll');
    expect(byDefault.prompt).toContain('dryRun');
    // Seed default ebenso unverändert.
    expect(generationStep(EMPTY, INTENT).prompt).toContain('Gate-Protokoll');
  });

  it("profile 'local' seed: Struktur-Anforderung ohne Gate-Protokoll-Absatz", () => {
    const step = generationStep(EMPTY, INTENT, 0.8, [], 'local');
    expect(step.phase).toBe('seed');
    for (const part of ['SYS', 'ACTOR', 'UC', 'ACTOR io→UC', 'Keine FUNC/MOD-Ebene im Seed']) {
      expect(step.prompt).toContain(part);
    }
    expect(step.prompt).not.toContain('Gate-Protokoll');
    expect(step.prompt).not.toContain('dryRun');
  });
});

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
