/**
 * CR-GC-719 — Vertragstests der Surface-Schnittstellen, die bis hier keinen gebundenen TEST hatten.
 *
 *   SCHEMA-audit-stats  → `AuditStatsSchema.parse` am Ende von `aggregateAuditEntries`, die Antwort
 *                         von `audit_stats` (FLOW-audit-report)
 *   SCHEMA-mutate-result → das Gate-Verdict, das graphcode über FLOW-gate-verdict ausliefert. Der
 *                         Vertrag stammt aus @sigloch/contracts; graphcode ist sein ERZEUGER, also
 *                         prüft dieser Test jede Verdict-Variante, die graphcode wirklich liefert
 *                         (angewandt, geblockt, dryRun), gegen ihn — und dass er eine formfremde abweist.
 *
 * Keine Mocks: Kuzu auf Platte in mkdtemp, echte Tool-Registry.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { MutateResultSchema, type HarnessConfig, type MutateCommand } from '@sigloch/contracts/harness';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { AuditStatsSchema, aggregateAuditEntries } from '../src/surface/audit.js';
import { alsFormatE } from './helpers/format-e.js';

function makeHarness(repoRoot: string): GraphCodeHarness {
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, 'kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'contracts-ws', systemId: 'contracts-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

const validSet: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-ok', type: 'REQ', name: 'ok', description: '', attributes: {} } },
  { op: 'add-node', node: { uid: 'TEST-ok', type: 'TEST', name: 'ok', description: '', attributes: {} } },
  { op: 'add-edge', edge: { sourceId: 'TEST-ok', targetId: 'REQ-ok', edgeType: 'verify', attributes: {} } },
];
/** R-01: ein REQ ohne verify blockt. */
const lonelyReq: MutateCommand[] = [
  { op: 'add-node', node: { uid: 'REQ-lonely', type: 'REQ', name: 'lonely', description: '', attributes: {} } },
];

describe('CR-GC-719 Surface-Verträge', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-contract-surface-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('SCHEMA-audit-stats', () => {
    it('die ECHTE audit_stats-Antwort nach einem angewandten und einem geblockten Batch erfüllt den Vertrag', async () => {
      const tools = bindToolsToHarness(harness);
      await tools.graph_mutate.handler({ formatE: alsFormatE(validSet, harness), consumerId: 'a' });
      await tools.graph_mutate.handler({ formatE: alsFormatE(lonelyReq, harness), consumerId: 'a' });

      const stats = AuditStatsSchema.parse(await tools.audit_stats.handler({}));
      expect(stats.totals).toEqual({ applied: 1, rejected: 1, partial: 0 });
      expect(stats.byRule.some((r) => r.ruleId === 'R-01')).toBe(true);
    });

    it('der Erzeuger gibt keine formfremde Zahl weiter: ein NaN-Stand bricht laut ab', () => {
      // Ohne den Parse am Ausgang verliesse `graphVersion: NaN` den Host als „Messung".
      expect(() => aggregateAuditEntries([], Number.NaN)).toThrow(/graphVersion/);
      expect(AuditStatsSchema.safeParse(aggregateAuditEntries([], 3)).success).toBe(true);
    });

    it('eine Antwort ohne Lesehorizont (window) passiert den Vertrag NICHT', () => {
      const { window: _w, ...ohneFenster } = aggregateAuditEntries([], 3);
      expect(AuditStatsSchema.safeParse(ohneFenster).success).toBe(false);
    });
  });

  describe('SCHEMA-mutate-result (graphcode als Erzeuger)', () => {
    it('angewandt, geblockt und dryRun: jede Verdict-Variante des Gates erfüllt den Vertrag', async () => {
      const applied = await harness.mutate(validSet);
      expect(applied.success).toBe(true);
      expect(MutateResultSchema.safeParse(applied).success).toBe(true);

      const blocked = await harness.mutate(lonelyReq);
      expect(blocked.success).toBe(false);
      expect(blocked.tier).toBe('block');
      expect(MutateResultSchema.safeParse(blocked).success).toBe(true);

      const preview = await harness.mutate(lonelyReq, { dryRun: true } as never);
      expect(MutateResultSchema.safeParse(preview).success).toBe(true);
    });

    it('ein Verdict mit unbekanntem tier, ohne Mutationszahl oder mit fremdem Befund ist keins', async () => {
      const applied = await harness.mutate(validSet);
      expect(MutateResultSchema.safeParse({ ...applied, tier: 'vielleicht' }).success).toBe(false);
      const { mutations: _m, ...ohneZahl } = applied;
      expect(MutateResultSchema.safeParse(ohneZahl).success).toBe(false);
      expect(MutateResultSchema.safeParse({ ...applied, violations: [{ rule: 'R-01' }] }).success).toBe(false);
    });
  });
});
