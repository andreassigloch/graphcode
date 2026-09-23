/**
 * TEST-graph-authoring-guide (CR-GC-231) — surface legal incident edges from the
 * imported SE meta-model (TRACE_PATTERNS), never a local fork. The write-side read-twin
 * of graph_context: an agent queries it BEFORE authoring a node. Real disk Kuzu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'demo-ws', systemId: 'guide-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

describe('TEST-graph-authoring-guide (CR-GC-231): legal edges from the meta-model', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-guide-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('UC → legal outgoing/incoming edges derived from TRACE_PATTERNS', async () => {
    const tools = bindToolsToHarness(harness);
    const guide = await tools.graph_authoring_guide.handler({ type: 'UC' });

    expect(guide.type).toBe('UC');
    // Outgoing: UC composes REQ and FCHAIN.
    const out = guide.outgoing.map((e) => `${e.edgeType}->${e.targetType}`);
    expect(out).toEqual(expect.arrayContaining(['compose->REQ', 'compose->FCHAIN']));
    // Incoming: SYS/MS compose, CR relation.
    const inc = guide.incoming.map((e) => `${e.sourceType}-${e.edgeType}`);
    // CR-GC-366: 'FUNC-satisfy' ist hier weg — ein UC wird nicht mehr direkt von einer FUNC
    // erfuellt, sondern ueber `UC -compose-> FCHAIN -compose-> FUNC` erreicht.
    // contracts 9.x (CR-SM-266 D1/D4): auch 'ACTOR-io'/'FLOW-io' sind entfallen — der
    // tragende Pfad ist ACTOR io→FLOW io→FUNC in der FCHAIN des UC.
    expect(inc).toEqual(expect.arrayContaining(['SYS-compose', 'MS-compose', 'CR-relation']));
    expect(inc).not.toContain('FUNC-satisfy');
    expect(inc).not.toContain('ACTOR-io');
    expect(inc).not.toContain('FLOW-io');
    // requiredAttrs is present (an array, from the node descriptor).
    expect(Array.isArray(guide.requiredAttrs)).toBe(true);
    // Carries the meta-model descriptions/cardinality (not a bare pair list).
    expect(guide.outgoing.some((e) => typeof e.description === 'string' && e.description.length > 0)).toBe(true);
  });

  it('is read-only — the call mutates nothing', async () => {
    const tools = bindToolsToHarness(harness);
    const before = harness.getGraph().nodes.length;
    await tools.graph_authoring_guide.handler({ type: 'REQ' });
    expect(harness.getGraph().nodes.length).toBe(before);
  });

  it('unknown type → a clear error listing the valid types', async () => {
    const tools = bindToolsToHarness(harness);
    await expect(tools.graph_authoring_guide.handler({ type: 'WIDGET' })).rejects.toThrow(/unknown element type/i);
  });
});

/**
 * CR-GC-622 — Idempotenz im Werkzeug, nicht ein Satz in der Beschreibung.
 *
 * Gemessen im Spezifikationslauf `opus5-0` (2026-09-22): 10 Aufrufe / 22.769 Zeichen, obwohl die
 * Beschreibung seit CR-GC-612 „take it ONCE" sagt. Die Sitzung ist die Bindung der Registry —
 * deshalb bindet jeder Fall hier EINMAL und ruft dann mehrfach.
 */
describe('CR-GC-622: der zweite Aufruf desselben Typs ist kurz, nicht anders', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-622-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const groesse = (x: unknown) => JSON.stringify(x).length;

  it('erster Aufruf voll, zweiter unter 800 Zeichen — mit vollstaendiger Kanten-Grammatik', async () => {
    const erst = await tools.graph_authoring_guide.handler({ type: 'FUNC' });
    const zweit = await tools.graph_authoring_guide.handler({ type: 'FUNC' });

    expect(erst.attributes).toBeDefined();
    expect(erst.formatEExample).toBeTruthy();
    expect(erst.wiederholt).toBeUndefined();

    // Was der Executor JEDE Runde braucht, steht auch im zweiten Aufruf vollstaendig da.
    expect(zweit.outgoing.map((e) => `${e.edgeType}->${e.targetType}`)).toEqual(
      erst.outgoing.map((e) => `${e.edgeType}->${e.targetType}`),
    );
    expect(zweit.incoming.map((e) => `${e.sourceType}-${e.edgeType}`)).toEqual(
      erst.incoming.map((e) => `${e.sourceType}-${e.edgeType}`),
    );
    expect(zweit.requiredAttrs).toEqual(erst.requiredAttrs);
    // Weg ist, was sich nie aendert und schon dastand.
    expect(zweit.attributes).toBeUndefined();
    expect(zweit.formatEExample).toBeUndefined();
    expect(zweit.wiederholt).toMatch(/Aufruf 1 dieser Sitzung/);
    expect(groesse(zweit), `wiederholt: ${groesse(zweit)} statt ${groesse(erst)} Zeichen`).toBeLessThan(800);
  });

  it('jeder Typ hat sein eigenes erstes Mal — auch nach neun anderen', async () => {
    for (const t of ['SYS', 'UC', 'ACTOR', 'FCHAIN', 'FUNC', 'FLOW', 'REQ', 'TEST', 'MOD']) {
      await tools.graph_authoring_guide.handler({ type: t });
    }
    const schema = await tools.graph_authoring_guide.handler({ type: 'SCHEMA' });
    expect(schema.attributes, 'ein ungefragter Typ darf nie gekuerzt antworten').toBeDefined();
    expect(schema.formatEExample).toBeTruthy();
    const nochmal = await tools.graph_authoring_guide.handler({ type: 'SCHEMA' });
    expect(nochmal.wiederholt).toMatch(/Aufruf 10 dieser Sitzung/);
  });

  it('unbekannter Typ wirft auch beim zweiten Mal', async () => {
    await expect(tools.graph_authoring_guide.handler({ type: 'WIDGET' })).rejects.toThrow(/unknown element type/i);
    await expect(tools.graph_authoring_guide.handler({ type: 'WIDGET' })).rejects.toThrow(/unknown element type/i);
  });
});
