/**
 * TEST-tool-context (CR-GC-991) — Verhalten der Zugriffe des Werkzeug-Kontexts.
 *
 * Der Vertrag SCHEMA-tool-context prueft die Form: jedes Mitglied eine Funktion, kein unbekannter
 * Schluessel. Den erzeugten Test dazu liefert `graphcode vertragstest`. Was die Zugriffe zurueckgeben
 * (Graphversion, Sitzungskennung, Besitzer-PID), steht in diesem Test, am ECHTEN Kontext (disk-Kuzu-
 * Harness, In-Memory-Audit-Log per Injektion). `createToolContext` gibt das Original zurueck, nicht
 * die Kopie von `parse`: Harness und Audit-Log bleiben dieselben Instanzen.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR, InMemoryAuditLog } from '@sigloch/graph-api-core';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { ToolContext } from '../src/surface/tool-context-contract.js';
import { createToolContext } from '../src/surface/tool-context.js';

describe('TEST-tool-context: Zugriffe des Kontexts und Uebergabe des Originals', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let log: InMemoryAuditLog;
  let ctx: ReturnType<typeof createToolContext>;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-tool-context-'));
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
    log = new InMemoryAuditLog();
    ctx = createToolContext(harness, log, { ownerPid: null });
  });

  afterAll(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('der echte Kontext erfuellt den Vertrag; Harness und Audit-Log bleiben dieselben Instanzen', () => {
    expect(ToolContext.safeParse(ctx).success).toBe(true);
    expect(ctx.harness).toBe(harness);
    expect(ctx.auditLog).toBe(log);
  });

  it('die Graphversion ist eine ganze Zahl ab 0 und beginnt bei 0', () => {
    expect(Number.isInteger(ctx.graphVersion())).toBe(true);
    expect(ctx.graphVersion()).toBe(0);
  });

  it('die Sitzungskennung ist nicht leer und bleibt ueber Aufrufe gleich', () => {
    expect(ctx.sessionId()).toMatch(/^sess-.+/);
    expect(ctx.sessionId()).toBe(ctx.sessionId());
  });

  it('die Besitzer-PID ist null, wenn die Ahnenkette unbekannt ist, und der gegebene Text sonst', () => {
    expect(ctx.ownerPid()).toBeNull();
    expect(createToolContext(harness, new InMemoryAuditLog(), { ownerPid: '4711' }).ownerPid()).toBe('4711');
  });

  it('ein Kontext mit fremdem Schluessel wird abgewiesen', () => {
    const r = ToolContext.safeParse({ ...ctx, extra: 1 });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: ['extra'] });
  });
});
