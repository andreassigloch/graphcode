/**
 * executor-tools (CR-GC-506) — die aus executor.ts geschnittene Werkzeug-Ausführung.
 *
 * Bis zum Schnitt prüften die Executor-Tests nur die NAMEN der Lese-Werkzeuge im
 * Tool-Angebot; ausgeführt wurde keines, der Containment-Guard lief nie. Diese Datei
 * prüft, was die Werkzeug-Ausführung zusagt: Lese-Werkzeuge auf einem realen
 * Workspace, kein Ausbruch aus ihm, Registry-Werkzeuge unter `graphcode_`, Fehler
 * als Text statt Throw, und das backend-korrekte Anhängen der Ergebnisse.
 * Realer Temp-Workspace und realer Disk-Store, keine Mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { execReadOrGraphTool, pushToolResults } from '../src/loop/executor-tools.js';

describe('executor-tools (CR-GC-506)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-executor-tools-'));
    mkdirSync(join(repoRoot, 'material', 'sub'), { recursive: true });
    writeFileSync(join(repoRoot, 'material', 'a.ts'), 'erste Zeile\nhier steht die Nadel\n');
    writeFileSync(join(repoRoot, 'material', 'sub', 'lang.md'), 'x'.repeat(9000));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'exec-tools', systemId: 'exec-tools' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const run = (name: string, input: unknown): Promise<string> =>
    execReadOrGraphTool(registry, repoRoot, name, input);

  it('list_dir markiert Verzeichnisse, read_file kappt bei 8000 Zeichen', async () => {
    expect((await run('list_dir', { path: 'material' })).split('\n').sort()).toEqual(['a.ts', 'sub/']);
    expect(await run('read_file', { path: 'material/a.ts' })).toBe('erste Zeile\nhier steht die Nadel\n');
    expect((await run('read_file', { path: 'material/sub/lang.md' })).length).toBe(8000);
  });

  it('grep findet relpath:zeile unter ./material, sonst "(no hits)"', async () => {
    expect(await run('grep', { pattern: 'NADEL' })).toBe('material/a.ts:2');
    expect(await run('grep', { pattern: 'gibt es nicht' })).toBe('(no hits)');
  });

  it('kein Ausbruch aus dem Workspace — der Fehler kommt als Text zurück, nicht als Throw', async () => {
    expect(await run('read_file', { path: '../etwas' })).toBe('ERROR: path escapes workspace: ../etwas');
    expect(await run('list_dir', { path: '/etc' })).toBe('ERROR: path escapes workspace: /etc');
  });

  it('Registry-Werkzeuge laufen unter graphcode_<name>; Unbekanntes wird als Fehlertext gemeldet', async () => {
    const out = JSON.parse(await run('graphcode_graph_elements', {})) as { nodes: unknown[] };
    expect(out.nodes).toEqual([]);
    expect(await run('graphcode_gibt_es_nicht', {})).toBe('ERROR: unknown tool graphcode_gibt_es_nicht');
    expect(await run('gibt_es_nicht', {})).toBe('ERROR: unknown tool gibt_es_nicht');
  });

  it('ein vom Modell angeforderter dryRun geht unverändert durch und persistiert nichts', async () => {
    const batch = {
      dryRun: true,
      commands: [
        { op: 'add-node', node: { uid: 'SYS-x', type: 'SYS', name: 'X', description: 'Probe.', attributes: {} } },
      ],
    };
    const verdict = JSON.parse(await run('graphcode_graph_mutate', batch)) as { success: boolean };
    expect(verdict.success).toBe(true);
    expect(harness.getGraph().nodes).toEqual([]);
  });

  const calls = [
    { id: 'c1', name: 'list_dir', input: {} },
    { id: 'c2', name: 'read_file', input: {} },
  ];

  it('anthropic: EINE User-Message mit tool_result-Blöcken, Feedback als eigener Text-Block', () => {
    const messages: unknown[] = [];
    pushToolResults('anthropic', messages, calls, ['r1', 'r2'], 'FEEDBACK');
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'c1', content: 'r1' },
          { type: 'tool_result', tool_use_id: 'c2', content: 'r2' },
          { type: 'text', text: 'FEEDBACK' },
        ],
      },
    ]);
  });

  it('openai: eine tool-Message je Call, Feedback nur im letzten Ergebnis (Rollen-Alternierung)', () => {
    const messages: unknown[] = [];
    pushToolResults('openai', messages, calls, ['r1', 'r2'], 'FEEDBACK');
    expect(messages).toEqual([
      { role: 'tool', tool_call_id: 'c1', content: 'r1' },
      { role: 'tool', tool_call_id: 'c2', content: 'r2\n\nFEEDBACK' },
    ]);
  });
});

describe('CR-GC-647: Modell-Aufrufe laufen durch dieselbe Schema-Grenze wie der MCP-Server', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-executor-schema-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'exec-schema', systemId: 'exec-schema' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    // Mehr REQs als der deklarierte Default `limit` — ohne Parse kaeme der ganze Satz zurueck.
    // Jede REQ mit ihrem verify-TEST — eine REQ allein blockt das Gate (R-01).
    const commands = Array.from({ length: 130 }, (_, i) => [
      { op: 'add-node', node: { uid: `REQ-r${i}`, type: 'REQ', name: `Anforderung ${i}`, description: 'x'.repeat(200), attributes: {} } },
      { op: 'add-node', node: { uid: `TEST-r${i}`, type: 'TEST', name: `Pruefung ${i}`, description: 'Prueft die Anforderung.', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: `TEST-r${i}`, targetId: `REQ-r${i}`, edgeType: 'verify', attributes: {} } },
    ]).flat();
    const res = (await registry.graph_mutate.handler({ commands, consumerId: 'test' })) as { success: boolean };
    expect(res.success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('graph_elements({type}) bekommt den Default-limit statt des ganzen Graphen', async () => {
    const out = JSON.parse(await execReadOrGraphTool(registry, repoRoot, 'graphcode_graph_elements', { type: 'REQ' }));
    // Vorher: ohne Parse kein limit, der ganze Graph, und jsonCapped strich die Liste ganz —
    // ein Stummel ohne einen einzigen Knoten. Jetzt: Default-limit, Liste auf den Anfang gekappt.
    expect(out.total).toBe(130);
    expect(out.nodes.length).toBeGreaterThan(0);
    expect(out.gekappt.nodes).toBe(`${out.nodes.length}/100`);
  });

  it('ein unbekannter Argumentname ist ein Fehler mit dem Namen, keine leere Eingabe', async () => {
    const out = await execReadOrGraphTool(registry, repoRoot, 'graphcode_graph_help', { id: 'graph_metrics' });
    expect(out).toMatch(/^ERROR: invalid input for graphcode_graph_help/);
    expect(out).toContain('id');
  });
});
