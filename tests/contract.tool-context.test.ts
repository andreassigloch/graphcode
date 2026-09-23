/**
 * TEST-tool-context-contract (CR-GC-523, ITEM-2026-064) — SCHEMA-tool-context.
 *
 * Der Werkzeug-Kontext ist die Uebergabe `createToolContext` → `bindToolsToHarness`:
 * ein Objektliteral aus vier Traegern (Harness, Audit-Log, zwei Codecs) und dreizehn
 * Funktionen, hinter denen der Sitzungszustand lebt. Der Vertrag ist strikt — ein
 * unbekannter Schluessel wuerde in jede Registry-Enumeration lecken (mcp.symmetry) —
 * und prueft die Datenanteile hinter den Zugriffen: Graphversion, Sitzungskennung,
 * Besitzer-PID.
 *
 * Akzeptanz am ECHTEN Kontext (disk-Kuzu-Harness, In-Memory-Audit-Log per Injektion),
 * Abweisung an Kopien desselben Objekts — jede Abweichung nennt ihren Pfad.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR, InMemoryAuditLog } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import type { ToolPort } from '../src/kernel/tool-contract.js';
import { ToolContext } from '../src/surface/tool-context-contract.js';
import { createToolContext } from '../src/surface/tool-context.js';

function pathsOf(input: unknown): string[] {
  const r = ToolContext.safeParse(input);
  expect(r.success).toBe(false);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
}

describe('TEST-tool-context-contract: SCHEMA-tool-context ist ein Zod-Vertrag', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let ctx: ToolContext;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-tool-context-contract-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, '.graphcode/kuzu') });
    const config: HarnessConfig = {
      repoRoot: tmp,
      scope: { workspaceId: 'tc-ws', systemId: 'tc-sys' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
    ctx = createToolContext(harness, new InMemoryAuditLog(), { ownerPid: null });
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('akzeptiert den echten Kontext; die Traeger bleiben dieselben Instanzen', () => {
    const parsed = ToolContext.parse(ctx);
    expect(parsed.harness).toBe(harness);
    expect(parsed.codec).toBe(ctx.codec);
    expect(parsed.graphVersion()).toBe(0);
    expect(parsed.sessionId()).toMatch(/^sess-/);
    expect(parsed.ownerPid()).toBeNull();
  });

  it('der Kontext erfuellt den Port der Tool-Fabriken (ToolContext extends ToolPort)', () => {
    const port: ToolPort = ctx;
    expect(port.harness).toBe(harness);
  });

  it('weist einen unbekannten Schluessel ab und nennt ihn beim Namen', () => {
    const r = ToolContext.safeParse({ ...ctx, extra: 1 });
    expect(r.success).toBe(false);
    const issues = r.success ? [] : r.error.issues;
    // zod v4 meldet unbekannte Schluessel als EIN Befund am Objekt (Pfad []) mit `keys`.
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['extra'] });
  });

  it('weist ein fehlendes Mitglied ab und nennt es als Pfad', () => {
    for (const key of ['harness', 'auditLog', 'codec', 'recordAudit', 'serializeToolWrite', 'occReject'] as const) {
      const { [key]: _dropped, ...without } = ctx;
      expect(pathsOf(without)).toEqual([key]);
    }
  });

  it('weist ein falsch typisiertes Mitglied ab und nennt es als Pfad', () => {
    expect(pathsOf({ ...ctx, recordAudit: 'nein' })).toEqual(['recordAudit']);
    expect(pathsOf({ ...ctx, auditLog: { record: 1 } })).toEqual(['auditLog']);
    expect(pathsOf({ ...ctx, codec: {} })).toEqual(['codec']);
    // Der Griff selbst wird in createHarness geprueft (SCHEMA-harness-handle); hier zaehlt
    // nur, dass ein Objekt vorliegt — der Host-Shim bindet die Vorlage an einen Stand-in.
    expect(pathsOf({ ...ctx, harness: null })).toEqual(['harness']);
    expect(pathsOf({ ...ctx, harness: 'harness' })).toEqual(['harness']);
  });

  it('prueft die Datenanteile hinter den Zugriffen: Graphversion, Sitzungskennung, Besitzer-PID', () => {
    expect(pathsOf({ ...ctx, graphVersion: () => -1 })).toEqual(['graphVersion']);
    expect(pathsOf({ ...ctx, graphVersion: () => '3' })).toEqual(['graphVersion']);
    expect(pathsOf({ ...ctx, sessionId: () => '' })).toEqual(['sessionId']);
    expect(pathsOf({ ...ctx, ownerPid: () => 1234 })).toEqual(['ownerPid']);
  });

  it('weist Nicht-Objekte ab', () => {
    expect(ToolContext.safeParse(null).success).toBe(false);
    expect(ToolContext.safeParse(undefined).success).toBe(false);
  });
});
