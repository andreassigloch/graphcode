/**
 * TEST-bootstrap — REQ-bootstrap-through-gate (CR-GC-122, CR-GC-840).
 *
 * Der Kaltstart eines neuen Mitglieds: Format-E fuellt einen LEEREN Graphen ausschliesslich
 * ueber graph_mutate und damit durchs Gate (kein Direct-Write); rule-verletzender Format-E
 * wird GEBLOCKT und nichts persistiert. Bis CR-GC-840 lief das ueber eine eigene Funktion
 * `bootstrap()`, die das Gate ohne Werkzeugschicht rief — ohne Audit und ohne Trajektorie.
 *
 * Disk-Kuzu auf mkdtemp-Tempdir, echter KuzuAdapter, keine Mocks, nie :memory:.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { formatEToCommands } from '../src/kernel/format-e-commands.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

/** Ein gate-gueltiger Kaltstart: SYS, eine verifizierte REQ, ein erfuellendes MOD. */
const KALTSTART = [
  '## Nodes',
  '### MOD',
  '+ MOD-template|Module that satisfies the template requirement [__name:Template module]',
  '### REQ',
  '+ REQ-template-root|First requirement of the new member graph [__name:Template root requirement]',
  '@kinds ["non-functional"]',
  '### SYS',
  '+ SYS-template|Cold-start system of a new family member [__name:Template system]',
  '### TEST',
  '+ TEST-template-root|Verifies the template root requirement [__name:Template root test]',
  '',
  '## Edges',
  '+ SYS-template -compose-> REQ-template-root, MOD-template',
  '+ MOD-template -satisfy-> REQ-template-root',
  '+ TEST-template-root -verify-> REQ-template-root',
].join('\n');

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'new-member' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-bootstrap: new-member fill THROUGH graph_mutate', () => {
  let tmp: string;
  let kuzuPath: string;
  let harness: GraphCodeHarness;
  const mutate = (formatE: string) =>
    bindToolsToHarness(harness)['graph_mutate'].handler({ formatE, consumerId: 'kaltstart' });

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-bootstrap-'));
    kuzuPath = join(tmp, 'kuzu');
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('starts from a genuinely empty disk-Kuzu graph', () => {
    const g = harness.getGraph();
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
    // Empty baseline → no error, so ANY new error in a batch would block. The one finding an empty
    // graph carries since contracts 11 (CR-SM-395) is the existence rule that demands the system —
    // a warning, and exactly what the first fill below closes.
    const leer = harness.evaluateRules();
    expect(leer.filter((v) => v.severity === 'error')).toEqual([]);
    expect(leer.map((v) => ALL_RULE_DEFS.find((r) => r.id === v.ruleId)?.role)).toEqual(['existence']);
  });

  it('fills the empty graph from Format-E THROUGH the gate', async () => {
    const erwartet = formatEToCommands(harness.getGraph(), KALTSTART).commands;

    const result = await mutate(KALTSTART);

    // Gate verdict: applies cleanly (R-01 satisfied, no error-severity violation), at 'suggest' tier.
    // The placeholder TEST is unbound — in a draft that is the state, not a finding: R-19 is not
    // evaluated before realization has begun (contracts CR-SM-392).
    expect(result.success).toBe(true);
    expect(result.tier).toBe('suggest');
    expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
    expect(result.violations.some((v) => v.ruleId === 'R-19')).toBe(false);
    // Nodes first, then edges, in ONE batch.
    expect(result.appliedCommands).toBe(erwartet.length);

    const g = harness.getGraph();
    expect(g.nodes.map((n) => n.uid).sort()).toEqual(
      ['MOD-template', 'REQ-template-root', 'SYS-template', 'TEST-template-root'],
    );
    expect(
      g.edges.some((e) => e.sourceId === 'TEST-template-root' && e.targetId === 'REQ-template-root' && e.edgeType === 'verify'),
    ).toBe(true);
  });

  it('persists the first fill to disk (reload from a fresh handle)', async () => {
    await mutate(KALTSTART);
    await harness.close();

    // Fresh adapter on the SAME disk store — proves the gate persisted, not memory.
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    const g = harness2.getGraph();
    expect(g.nodes.find((n) => n.uid === 'SYS-template')).toBeDefined();
    expect(g.nodes.find((n) => n.uid === 'REQ-template-root')).toBeDefined();
    expect(g.edges.some((e) => e.sourceId === 'TEST-template-root' && e.targetId === 'REQ-template-root')).toBe(true);
    harness = harness2;
  });

  it('is governed: the first fill itself is in the audit trail', async () => {
    const result = await mutate(KALTSTART);
    expect(result.success).toBe(true);

    const { entries } = await bindToolsToHarness(harness)['audit_trail'].handler({ limit: 10 });
    expect(entries.some((e) => e.operation === 'mutate' && e.consumerId === 'kaltstart')).toBe(true);
  });

  it('Direct-Write schlägt fehl: rule-violating Format-E is BLOCKED by the gate; graph stays empty', async () => {
    // A lone orphan REQ with no verifying TEST → R-01 (error) is NEWLY introduced
    // against the empty baseline, so the gate must block and persist nothing.
    const result = await mutate(['## Nodes', '### REQ', '+ REQ-orphan|A requirement with no verifying test [__name:Orphan requirement]'].join('\n'));

    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(result.mutations).toBe(0);
    const r01 = result.violations.find((v) => v.ruleId === 'R-01');
    expect(r01?.severity).toBe('error');

    expect(harness.getGraph().nodes).toHaveLength(0);
    await harness.close();
    const storage2 = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: kuzuPath });
    const harness2 = new GraphCodeHarness(makeConfig(tmp), storage2);
    await harness2.initialize();
    expect(harness2.getGraph().nodes).toHaveLength(0);
    harness = harness2;
  });

  it('nimmt nach dem Kaltstart ein `~` an — die Sprache ganz (CR-GC-630)', async () => {
    await mutate(KALTSTART);

    const result = await mutate(['## Nodes', '### REQ', '~ REQ-template-root|Geschaerfte Fassung der ersten Anforderung'].join('\n'));

    expect(result.success).toBe(true);
    const req = harness.getGraph().nodes.find((n) => n.uid === 'REQ-template-root');
    expect(req?.description).toBe('Geschaerfte Fassung der ersten Anforderung');
    // Der Name stand NICHT in der Patch-Zeile — er darf nicht auf die uid zurueckfallen.
    expect(req?.name).toBe('Template root requirement');
  });

  it('meldet Knoten ohne __name, statt still die uid zum Namen zu machen (CR-GC-321)', async () => {
    const result = await mutate(['## Nodes', '### MOD', '+ MOD-namenlos|Ein Modul, dessen Zeile keinen __name traegt'].join('\n'));

    expect(result.nameWarning).toContain('MOD-namenlos');
  });

  it('meldet einen Format-E-Lesefehler als Block, kein stilles Durchwinken', async () => {
    const result = await mutate('+ this-is-not-valid-format-e-@@@');

    expect(result.success).toBe(false);
    expect(result.tier).toBe('block');
    expect(result.violations.some((v) => v.ruleId === 'STRUCT')).toBe(true);
    expect(harness.getGraph().nodes).toHaveLength(0);
  });
});
