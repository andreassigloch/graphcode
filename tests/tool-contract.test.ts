/**
 * tool-contract.test.ts — der Vertrags-TEST zu SCHEMA-mcp-tool / -registry / -tool-port
 * (CR-GC-547, R-32).
 *
 * Wogegen geprüft wird, ist die halbe Miete: die Registry kommt aus `bindToolsWithContext`,
 * also aus den ECHTEN acht Fabriken an einem ECHTEN Harness. Eine handgebaute Attrappe hätte
 * bewiesen, dass das Schema zu sich selbst passt, und nichts über die Grenze gesagt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod/v4';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { MCPToolSchema, MCPToolRegistrySchema } from '../src/kernel/tool-contract.js';
import { ToolContext } from '../src/surface/tool-context-contract.js';
import { bindToolsWithContext } from '../src/surface/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

describe('TEST-tool-contract: die drei Werkzeug-Verträge halten an der echten Grenze (CR-GC-547)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeAll(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'tool-contract-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
    const config: HarnessConfig = {
      repoRoot,
      scope: { workspaceId: 'contract-ws', systemId: 'contract-svc' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
  });

  afterAll(async () => { await harness?.close?.(); rmSync(repoRoot, { recursive: true, force: true }); });

  it('die ECHTE Registry aus acht Fabriken erfüllt MCPToolRegistrySchema', () => {
    const { registry, ctx } = bindToolsWithContext(harness);
    // `bindToolsWithContext` parst selbst — der Test belegt, dass es die echte Registry ist
    // und nicht ein leeres Objekt, das jedes Schema erfüllt.
    expect(Object.keys(registry).length).toBeGreaterThan(20);
    expect(() => MCPToolRegistrySchema.parse(registry)).not.toThrow();
    // Der Port hat bewusst KEIN eigenes Schema (das waere ein Duplikat): der Kontext, der ihn
    // erfuellt, ist `ToolContext` — und der wird hier gegen seinen echten Vertrag geparst.
    expect(() => ToolContext.parse(ctx)).not.toThrow();
  });

  it('ein Werkzeug OHNE handler fällt durch — mit dem Member im Text', () => {
    const r = MCPToolSchema.safeParse({
      name: 'graph_kaputt',
      description: 'ohne Handler',
      inputSchema: z.object({}),
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('handler');
  });

  it('ein inputSchema, das kein Zod-Schema ist, fällt durch', () => {
    const r = MCPToolSchema.safeParse({
      name: 'graph_kaputt',
      description: 'Schema ist ein Objekt-Literal',
      inputSchema: { type: 'object' },
      handler: async () => ({}),
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('inputSchema');
  });

  it('ein Kontext ohne serializeToolWrite fällt durch — die OCC-Kette ist nicht optional', () => {
    const r = ToolContext.safeParse({
      harness: {},
      auditLog: { record: () => {}, query: () => [] },
      graphVersion: () => 1,
      recordAudit: async () => {},
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('serializeToolWrite');
  });
});
