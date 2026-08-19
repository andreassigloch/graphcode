/**
 * TEST-formate-name (CR-GC-321) — `__name` ist entdeckbar, der `name = uid`-Fallback ist laut.
 *
 * Der gemessene Schaden (Session 2026-08-10, Fremdrepo): 87 von 134 Knoten trugen
 * ihren uid als Namen, weil `+ uid|text` zwei positionale Felder hat und der Name
 * als `__name`-Attribut reist — was in keiner Tool-Beschreibung stand. Sichtbar
 * wurde es erst mehrere Arbeitsschritte später in den generierten Sichten.
 *
 * Zwei Hälften, beide hier geprüft:
 *   1. ENTDECKBARKEIT — die formatE-Feldbeschreibung nennt `__name`;
 *      `graph_authoring_guide` liefert ein Beispiel, das der Codec wirklich frisst
 *      (REQ-N03: geprüft, nicht behauptet).
 *   2. LAUTSTÄRKE — ein Batch ohne `__name` meldet `nameWarning` mit den uids,
 *      im Apply UND im dryRun, ohne `success`/`tier`/`violations` anzufassen.
 *
 * Reales Disk-Kuzu im tmp-Verzeichnis, nie `:memory:`. Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { GraphCodeCodec } from '../src/codec.js';
import { formatEExampleFor } from '../src/authoring-example.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

const SEED = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'Beispielsystem', description: 'Ein System.' },
    {
      id: 'REQ-seed',
      type: 'REQ',
      name: 'Bestehende Anforderung',
      description: 'Das System muss einen frueheren Graph-Stand herstellen koennen.',
    },
    {
      id: 'TEST-seed',
      type: 'TEST',
      name: 'Seed-Test',
      description: 'Prueft die bestehende Anforderung.',
    },
    {
      id: 'FUNC-seed',
      type: 'FUNC',
      name: 'Seed-Funktion',
      description: 'Erfuellt die bestehende Anforderung.',
    },
  ],
  traces: [],
};

/**
 * Die Kanten, die jeden neuen REQ sofort verifiziert und aufgeloest machen —
 * sonst blockt das Gate an R-01 und der Namensfall waere gar nicht messbar.
 */
const BINDING_EDGES =
  '\n## Edges\n' +
  '+ TEST-seed -verify-> REQ-alpha, REQ-beta\n' +
  '+ FUNC-seed -satisfy-> REQ-alpha, REQ-beta\n';

/** Zwei neue REQ OHNE `__name` — der stille Fallback-Fall. */
const UNNAMED_BATCH =
  '## Nodes\n### REQ\n' +
  '+ REQ-alpha|Das System muss den Namen eines Knotens sichtbar machen.\n' +
  '+ REQ-beta|Das System muss den Fallback melden.\n' +
  BINDING_EDGES;

/** Dieselben zwei REQ MIT `__name` — inline und als Folgezeile. */
const NAMED_BATCH =
  '## Nodes\n### REQ\n' +
  '+ REQ-alpha|Das System muss den Namen eines Knotens sichtbar machen. [__name:Sichtbarer Name]\n' +
  '+ REQ-beta|Das System muss den Fallback melden.\n' +
  '@__name Fallback melden, laut\n' +
  BINDING_EDGES;

/** Kanten zwischen bestehenden Knoten (CR-GC-310) — kein Knoten, also kein Namensfall. */
const EDGE_ONLY = '## Edges\n+ TEST-seed -verify-> REQ-seed\n';

type MutateOut = {
  success: boolean;
  tier: string;
  mutations: number;
  violations: unknown[];
  nameWarning?: string;
};

describe('TEST-formate-name: der stille name=uid-Fallback wird laut (CR-GC-321)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-formate-name-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(SEED);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  // REQ-N04
  it('meldet die uids ohne __name als nameWarning', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: UNNAMED_BATCH, consumerId: 't' })) as MutateOut;

    expect(res.nameWarning, 'nameWarning fehlt trotz fehlender __name').toBeDefined();
    expect(res.nameWarning).toContain('REQ-alpha');
    expect(res.nameWarning).toContain('REQ-beta');
    expect(res.nameWarning).toContain('__name');
  });

  // REQ-N06 — reine Zusatzinformation
  it('laesst success, tier und die persistierten Daten unveraendert', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: UNNAMED_BATCH, consumerId: 't' })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.tier).toBe('auto-apply'); // das Pass-Tier des 3-Tier-Verdicts
    expect(res.mutations).toBe(6); // 2 Knoten + 4 Kanten
    // Der Fallback selbst bleibt, wie er ist — gemeldet, nicht repariert.
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-alpha')?.name).toBe('REQ-alpha');
  });

  // REQ-N05 (a) — alle Knoten benannt
  it('meldet nichts, wenn jeder Knoten __name traegt (inline wie als @-Zeile)', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: NAMED_BATCH, consumerId: 't' })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.nameWarning).toBeUndefined();
    const nodes = harness.getGraph().nodes;
    expect(nodes.find((n) => n.uid === 'REQ-alpha')?.name).toBe('Sichtbarer Name');
    expect(nodes.find((n) => n.uid === 'REQ-beta')?.name).toBe('Fallback melden, laut');
  });

  // REQ-N05 (b) — reiner Kanten-Batch
  it('meldet nichts fuer einen reinen Kanten-Batch', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: EDGE_ONLY, consumerId: 't' })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.nameWarning).toBeUndefined();
  });

  // REQ-N05 (c) — der commands-Pfad
  it('meldet nichts auf dem commands-Pfad (dort ist name explizite Autorenabsicht)', async () => {
    const res = (await tools.graph_mutate.handler({
      commands: [
        {
          op: 'add-node',
          node: { uid: 'REQ-gamma', type: 'REQ', name: 'REQ-gamma', description: 'Das System muss den Pfad trennen.' },
        },
        { op: 'add-edge', edge: { sourceId: 'TEST-seed', targetId: 'REQ-gamma', edgeType: 'verify' } },
        { op: 'add-edge', edge: { sourceId: 'FUNC-seed', targetId: 'REQ-gamma', edgeType: 'satisfy' } },
      ],
      consumerId: 't',
    })) as MutateOut;

    expect(res.success, JSON.stringify(res.violations)).toBe(true);
    expect(res.nameWarning).toBeUndefined();
  });

  // REQ-N07 — sonst meldet der Preview sauber und der Apply verliert die Namen
  it('meldet den Fall auch im dryRun', async () => {
    const res = (await tools.graph_mutate.handler({
      formatE: UNNAMED_BATCH,
      dryRun: true,
      consumerId: 't',
    })) as MutateOut;

    expect(res.nameWarning).toBeDefined();
    expect(res.nameWarning).toContain('REQ-alpha');
    // dryRun bleibt dryRun: nichts persistiert.
    expect(harness.getGraph().nodes.some((n) => n.uid === 'REQ-alpha')).toBe(false);
  });

  // REQ-N01 — Entdeckbarkeit an der Schreib-Oberflaeche
  it('nennt __name in der formatE-Feldbeschreibung, inkl. beider Formen und des Fallbacks', () => {
    const shape = (tools.graph_mutate.inputSchema as unknown as { def: { shape: Record<string, { description?: string }> } }).def.shape;
    const desc = shape.formatE.description ?? '';

    expect(desc).toContain('__name');
    expect(desc).toContain('[__name:');
    expect(desc).toContain('@__name');
    expect(desc.toLowerCase()).toMatch(/uid zum namen|uid becomes the name/);
  });

  // REQ-N02 / REQ-N03 — das Beispiel ist geprueft, nicht behauptet
  it('liefert je Typ ein formatEExample, das der Codec zu einem Knoten mit lesbarem Namen decodiert', async () => {
    for (const type of ['REQ', 'FUNC', 'TEST']) {
      const guide = await tools.graph_authoring_guide.handler({ type });
      const example = (guide as { formatEExample: string }).formatEExample;

      expect(example, `formatEExample fehlt fuer ${type}`).toBeDefined();
      expect(example).toContain('__name');

      const decoded = new GraphCodeCodec().decode(example);
      expect(decoded.nodes).toHaveLength(1);
      expect(decoded.nodes[0].type).toBe(type);
      expect(decoded.nodes[0].name).not.toBe(decoded.nodes[0].uid);
      expect(decoded.nodes[0].name.length).toBeGreaterThan(0);
    }
  });
});

describe('formatEExampleFor: der Musterblock selbst (CR-GC-321)', () => {
  it('interpoliert den angefragten Typ in die Sektion und die uid', () => {
    const example = formatEExampleFor('MOD');
    expect(example).toContain('### MOD');
    expect(example).toContain('+ MOD-example|');
  });
});
