/**
 * CR-GC-276 — graph_mutate: Format-E-Input, dryRun, Preview-Audit.
 *
 * (a) formatE-Block → dieselben Gate-Semantiken wie commands (ein Input-Codec,
 *     kein zweiter Schreibweg); Parse-Fehler = Block-Verdict, kein Crash.
 * (b) dryRun:true = volles Verdict inkl. fitAdvisory, NICHTS persistiert,
 *     graphVersion unbewegt, Working Copy restauriert.
 * (c) F2-Evidenz: jeder Preview landet als operation:'validate' im Audit-Log
 *     (auch abgelehnte Kandidaten); der Merge-Replay überspringt validate.
 * Real disk Kuzu (temp dir), no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { readBranchLog } from '../src/merge.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/** audit.jsonl neben dem Store lesen — die durable Evidenz jeder Gate-Entscheidung. */
function readAudit(repoRoot: string): {
  operation: string;
  result: string;
  consumerId?: string;
  violations?: { ruleId: string }[];
  commands?: unknown[];
}[] {
  const logPath = join(repoRoot, '.graphcode', 'audit.jsonl');
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ReturnType<typeof readAudit>[number]);
}

const FE_BATCH = [
  '## Nodes',
  '### REQ',
  '+ REQ-fe-input|Format-E input reaches the gate. [__name:FE input]',
  '### TEST',
  '+ TEST-fe-input|Verifies the Format-E input path. [__name:FE input test]',
  '',
  '## Edges',
  '+ TEST-fe-input -verify-> REQ-fe-input',
].join('\n');

describe('graph_mutate: formatE + dryRun + Preview-Audit (CR-GC-276)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-mutate-input-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('formatE-Block läuft durchs Gate und mutiert wie commands', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: FE_BATCH, consumerId: 'fe-test' })) as {
      success: boolean;
      mutations: number;
      graphVersion: number;
    };
    expect(res.success).toBe(true);
    expect(res.mutations).toBe(3); // 2 nodes + 1 edge
    expect(res.graphVersion).toBe(1);
    const g = harness.getGraph();
    expect(g.nodes.map((n) => n.uid).sort()).toEqual(['REQ-fe-input', 'TEST-fe-input']);
    expect(g.edges.length).toBe(1);
  });

  it('ungültiger Format-E-Block (illegales Kantenpaar) → Block-Verdict mit Codec-Meldung, kein Crash', async () => {
    const bad = [
      '## Nodes',
      '### REQ',
      '+ REQ-a|a. [__name:a]',
      '### TEST',
      '+ TEST-b|b. [__name:b]',
      '',
      '## Edges',
      '+ REQ-a -compose-> TEST-b',
    ].join('\n');
    const res = (await tools.graph_mutate.handler({ formatE: bad })) as {
      success: boolean;
      tier: string;
      violations: { ruleId: string; message: string }[];
    };
    expect(res.success).toBe(false);
    expect(res.tier).toBe('block');
    expect(res.violations[0].ruleId).toBe('STRUCT');
    expect(res.violations[0].message).toContain('REQ');

    // CR-GC-286: der Decode-Fehler ist KEIN unauditierter early return mehr —
    // audit.jsonl trägt den rejected-Eintrag mit STRUCT (F2-Kette lückenlos).
    const entries = readAudit(tmp);
    const rejected = entries.filter((e) => e.result === 'rejected');
    expect(rejected.length).toBe(1);
    expect(rejected[0].operation).toBe('mutate');
    expect(rejected[0].violations?.[0]?.ruleId).toBe('STRUCT');
  });

  it('Schema-Fehler am Handler (In-Process-Caller ohne commands/formatE) → auditiertes INPUT-SCHEMA-Verdict (CR-GC-286)', async () => {
    const res = (await tools.graph_mutate.handler({ consumerId: 'exec-test' })) as {
      success: boolean;
      tier: string;
      violations: { ruleId: string; message: string }[];
    };
    expect(res.success).toBe(false);
    expect(res.tier).toBe('block');
    expect(res.violations[0].ruleId).toBe('INPUT-SCHEMA');
    expect(res.violations[0].message).toContain('commands or formatE');

    const rejected = readAudit(tmp).filter((e) => e.result === 'rejected');
    expect(rejected.length).toBe(1);
    expect(rejected[0].consumerId).toBe('exec-test');
    expect(rejected[0].violations?.[0]?.ruleId).toBe('INPUT-SCHEMA');
  });

  it('dryRun: volles Verdict + fitAdvisory, nichts persistiert, Version unbewegt', async () => {
    const res = (await tools.graph_mutate.handler({ formatE: FE_BATCH, dryRun: true, consumerId: 'fe-preview' })) as {
      success: boolean;
      fitAdvisory?: unknown;
      graphVersion: number;
    };
    expect(res.success).toBe(true);
    expect(res.fitAdvisory).toBeDefined();
    expect(res.graphVersion).toBe(0); // nichts angewendet
    expect(harness.getGraph().nodes.length).toBe(0); // Working Copy restauriert
  });

  it('steeringDelta (CR-GC-289): im dryRun-Verdict, deterministisch, NICHT im Apply-Verdict', async () => {
    type SteeringDelta = {
      blockingErrors: { before: number; after: number };
      dimensions: Record<string, { before: number; after: number; delta: number }>;
    };
    const dryRun = async (): Promise<{ success: boolean; steeringDelta?: SteeringDelta; graphVersion: number }> =>
      (await tools.graph_mutate.handler({ formatE: FE_BATCH, dryRun: true, consumerId: 'sd-test' })) as never;

    const first = await dryRun();
    expect(first.success).toBe(true);
    expect(first.graphVersion).toBe(0); // Messung, keine Bewegung
    const sd = first.steeringDelta!;
    expect(sd.blockingErrors.before).toBe(0); // leerer Graph: keine Steering-Blocker
    // REQ+TEST+verify machen req/ver anwendbar — der Fortschritt ist messbar positiv.
    expect(sd.dimensions.req.after).toBeGreaterThan(sd.dimensions.req.before);
    for (const d of Object.values(sd.dimensions)) {
      expect(d.delta).toBeCloseTo(d.after - d.before, 10);
    }

    // Deterministisch: identischer Vorschlag auf identischem Zustand ⇒ identisches Delta.
    const second = await dryRun();
    expect(second.steeringDelta).toEqual(sd);

    // Apply-Pfad: KEIN steeringDelta (Entscheidung dryRun-only — der Nachher-
    // Zustand ist nach echtem Apply per graph_readiness lesbar; die doppelte
    // Katalog-Evaluierung pro Write hätte keinen Konsumenten).
    const applied = (await tools.graph_mutate.handler({ formatE: FE_BATCH, consumerId: 'sd-test' })) as {
      success: boolean;
      steeringDelta?: SteeringDelta;
    };
    expect(applied.success).toBe(true);
    expect(applied.steeringDelta).toBeUndefined();
  });

  it('steeringDelta bei Block-Verdict: Gate hat zurückgerollt ⇒ Delta 0, Blocker-Zählung unverändert', async () => {
    const res = (await tools.graph_mutate.handler({
      commands: [
        { op: 'add-node', node: { uid: 'REQ-solo', type: 'REQ', name: 'solo', description: 'Ohne TEST.', attributes: {} } },
      ],
      dryRun: true,
    })) as {
      success: boolean;
      tier: string;
      steeringDelta?: { blockingErrors: { before: number; after: number }; dimensions: Record<string, { delta: number }> };
    };
    expect(res.success).toBe(false); // R-01: REQ ohne verify-TEST
    const sd = res.steeringDelta!;
    expect(sd.blockingErrors.after).toBe(sd.blockingErrors.before);
    for (const d of Object.values(sd.dimensions)) expect(d.delta).toBe(0);
  });

  it('Preview-Audit: Vorschlag→Verdict im Log (validate), Merge-Replay überspringt ihn', async () => {
    await tools.graph_mutate.handler({ formatE: FE_BATCH, dryRun: true, consumerId: 'fe-preview' });
    // Abgelehnter Kandidat (illegales Paar) — auch der ist Evidenz.
    await tools.graph_mutate.handler({
      commands: [
        { op: 'add-node', node: { uid: 'REQ-solo', type: 'REQ', name: 'solo', description: '', attributes: {} } },
      ],
      dryRun: true,
      consumerId: 'fe-preview',
    });

    const logPath = join(tmp, '.graphcode', 'audit.jsonl');
    expect(existsSync(logPath)).toBe(true);
    const entries = readFileSync(logPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { operation: string; result: string; commands?: unknown[] });
    const previews = entries.filter((e) => e.operation === 'validate');
    expect(previews.length).toBe(2);
    expect(previews.map((p) => p.result).sort()).toEqual(['applied', 'rejected']); // REQ-solo: neuer R-01-Error
    expect(previews.every((p) => (p.commands?.length ?? 0) > 0)).toBe(true); // der Vorschlag selbst ist im Log

    // Replay-Sicherheit: validate-Einträge werden nie mitgereplayt.
    expect(readBranchLog(logPath, 0).length).toBe(0);
  });

  it('commands und formatE gleichzeitig (oder keins) → Schema-Fehler am Transport', () => {
    const schema = tools.graph_mutate.inputSchema;
    expect(schema.safeParse({ formatE: FE_BATCH, commands: [{ op: 'noop' }] }).success).toBe(false);
    expect(schema.safeParse({ consumerId: 'x' }).success).toBe(false);
    expect(schema.safeParse({ formatE: FE_BATCH }).success).toBe(true);
    expect(schema.safeParse({ commands: [{ op: 'noop' }] }).success).toBe(true);
  });
});
