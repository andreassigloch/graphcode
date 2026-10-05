/**
 * TEST-realref-materialize (BOK-CR-026 §6b) — the SCHEMA arm of the no-phantom-file
 * guarantee: graph_export scaffolds a `z.unknown()` Zod stub for every bound SCHEMA
 * whose realRef file is ABSENT, exactly as it does for a bound TEST's testRef. Without
 * it, `realRef` becoming the single SCHEMA binding still allowed "bound in the graph,
 * no artifact in the code".
 *
 * Asserts: (a) a missing realRef file is materialized as a valid Zod stub, exporting the
 * realRef's symbol, and listed under `stubs`; (b) an EXISTING schema file is never
 * overwritten; (c) an `external` SCHEMA is skipped (its contract lives in another package);
 * the retired `concept` attribute decides nothing (contracts CR-SM-393) — a bound Alt-SCHEMA
 * carrying it is materialized like any other; (d) an unbound SCHEMA scaffolds nothing.
 *
 * Real disk Kuzu (tmp dir, never :memory:). repoRoot is the tmp dir, so all scaffolded
 * files land under it and are cleaned up. No mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return { repoRoot, scope: { workspaceId: 'test-ws', systemId: 'graphcode' }, consumerType: 'system', preCommitTimeout: 5000 };
}

describe('TEST-realref-materialize: graph_export scaffolds missing realRef stubs (BOK-CR-026 §6b)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: ReturnType<typeof bindToolsToHarness>;

  const BOUND_MISSING = 'src/schemas/_generated-order.ts'; // file does NOT exist → materialize
  const BOUND_EXISTING = 'src/schemas/_already-real.ts'; // file exists → never overwrite
  const BOUND_ALT = 'src/schemas/_generated-alt.ts'; // Alt-Graph: bound AND still carrying `concept: true`
  const SENTINEL = '// REAL SCHEMA — must not be overwritten\n';

  const fixture = {
    elements: [
      {
        id: 'SCHEMA-bound', type: 'SCHEMA', name: 'Order Request', description: 'bound, not yet written',
        realRef: { file: BOUND_MISSING, symbol: 'OrderRequestSchema' },
      },
      {
        id: 'SCHEMA-existing', type: 'SCHEMA', name: 'Existing', description: 'already implemented',
        realRef: { file: BOUND_EXISTING, symbol: 'ExistingSchema' },
      },
      // Alt-Graph: `concept: true` — ohne Bindung schlicht ungebunden, mit Bindung materialisiert.
      { id: 'SCHEMA-alt-unbound', type: 'SCHEMA', name: 'AltUnbound', description: 'no Zod export yet', concept: true },
      {
        id: 'SCHEMA-alt-bound', type: 'SCHEMA', name: 'AltBound', description: 'bound, attribute left over', concept: true,
        realRef: { file: BOUND_ALT, symbol: 'AltBoundSchema' },
      },
      { id: 'SCHEMA-external-bound', type: 'SCHEMA', name: 'ExternalBound', description: 'foreign contract, bound', external: true, realRef: { file: 'src/schemas/_external.ts', symbol: 'Foreign' } },
      { id: 'SCHEMA-external', type: 'SCHEMA', name: 'External', description: 'foreign contract', external: true },
      { id: 'SCHEMA-unbound', type: 'SCHEMA', name: 'Unbound', description: 'no realRef at all — R-26 surfaces it' },
    ],
    traces: [],
  };

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-realref-'));
    // A pre-existing real schema file the export must NOT clobber.
    mkdirSync(join(tmp, 'src', 'schemas'), { recursive: true });
    writeFileSync(join(tmp, BOUND_EXISTING), SENTINEL);
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    await harness.importGraph(fixture);
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) materializes the missing realRef file as a valid Zod stub and lists it under stubs', async () => {
    const res = await registry['graph_export'].handler({ force: false });

    expect(res.stubs).toContain(BOUND_MISSING);
    const abs = join(tmp, BOUND_MISSING);
    expect(existsSync(abs)).toBe(true);
    const content = readFileSync(abs, 'utf8');
    expect(content).toContain("import { z } from 'zod/v4'");
    expect(content).toContain('export const OrderRequestSchema = z.unknown();');
    expect(content).toContain('SCHEMA-bound');
    expect(content).toContain('TODO');
  });

  it('(b) never overwrites an existing schema file, (c) skips external — `concept` decides nothing, (d) skips unbound', async () => {
    const res = await registry['graph_export'].handler({ force: false });

    // (b) the real file is untouched and absent from the created list.
    expect(readFileSync(join(tmp, BOUND_EXISTING), 'utf8')).toBe(SENTINEL);
    expect(res.stubs).not.toContain(BOUND_EXISTING);
    // (c)+(d) external and unbound SCHEMAs produce no file; the bound Alt-SCHEMA does,
    // although it carries `concept: true`.
    expect([...res.stubs].sort()).toEqual([BOUND_ALT, BOUND_MISSING].sort());
    expect(existsSync(join(tmp, 'src/schemas/_external.ts'))).toBe(false);
    expect(readFileSync(join(tmp, BOUND_ALT), 'utf8')).toContain('export const AltBoundSchema = z.unknown();');
    // R-26 reports exactly the unbound ones — with or without the retired attribute.
    const r26 = harness.evaluateRules().filter((v) => v.ruleId === 'R-26').map((v) => v.elementId).sort();
    expect(r26).toEqual(['SCHEMA-alt-unbound', 'SCHEMA-unbound']);
  });
});
