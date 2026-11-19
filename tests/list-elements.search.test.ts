/**
 * TEST-list-elements-filter — Elemente-Scheibe nach Typ und Suche (FUNC-list-elements).
 *
 * Echter Kuzu-Store im Temp-Verzeichnis, vier MOD-Knoten durchs Gate: je einer mit dem Suchbegriff
 * in der uid, im Namen, in der Beschreibung und einer ohne Treffer. Geprueft wird `listElements`
 * ueber `harness.listElements` und ueber das Werkzeug `graph_elements`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { mitFeld } from './helpers/antwort.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';

const modul = (uid: string, name: string, description: string): MutateCommand => ({
  op: 'add-node',
  node: { uid, type: 'MOD', name, description, attributes: {} },
});

const SPEC: MutateCommand[] = [
  modul('MOD-zebra-uid', 'Alpha', 'Erstes'),
  modul('MOD-name', 'Das Zebra Modul', 'Zweites'),
  modul('MOD-beschr', 'Gamma', 'Hier steht ZEBRA im Text'),
  modul('MOD-ohne', 'Delta', 'Viertes'),
  { op: 'add-node', node: { uid: 'SYS-zebra', type: 'SYS', name: 'Zebra-System', description: 'Wurzel', attributes: {} } },
];

describe('TEST-list-elements-filter: Elemente-Scheibe nach Typ und Suche', () => {
  let tmp: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-list-elements-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, '.graphcode', 'kuzu') });
    const config: HarnessConfig = {
      repoRoot: tmp,
      scope: { workspaceId: 'le-ws', systemId: 'le-sys' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
    const res = await harness.mutate(SPEC);
    expect(res.success, JSON.stringify(res.violations)).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('search trifft uid, Name und Beschreibung ohne Beachtung der Gross-/Kleinschreibung und laesst den Nicht-Treffer weg', async () => {
    const uids = (await harness.listElements({ search: 'zEbRa' })).map((n) => n.uid).sort();
    expect(uids).toEqual(['MOD-beschr', 'MOD-name', 'MOD-zebra-uid', 'SYS-zebra']);
    expect(uids).not.toContain('MOD-ohne');
  });

  it('type und search zusammen schneiden die Menge: nur MOD mit Treffer', async () => {
    const uids = (await harness.listElements({ type: 'MOD', search: 'zebra' })).map((n) => n.uid).sort();
    expect(uids).toEqual(['MOD-beschr', 'MOD-name', 'MOD-zebra-uid']);
  });

  it('ohne Filter kommen alle Knoten, mit type nur dieser Typ', async () => {
    const alle = await harness.listElements({});
    expect(alle.length).toBe(harness.getGraph().nodes.length);
    const mods = await harness.listElements({ type: 'MOD' });
    expect(mods.map((n) => n.uid).sort()).toEqual(['MOD-beschr', 'MOD-name', 'MOD-ohne', 'MOD-zebra-uid']);
  });

  it('graph_elements reicht search an die Scheibe: total zaehlt nur die Treffer', async () => {
    const tools = bindToolsToHarness(harness);
    const antwort = mitFeld(await tools.graph_elements.handler({ search: 'zebra', limit: 100, format: 'json' }), 'nodes');
    expect(antwort.total).toBe(4);
    expect(antwort.nodes.map((n: { uid: string }) => n.uid)).not.toContain('MOD-ohne');
  });
});
