/**
 * TEST-audit-skill-und-feuerbild (CR-GC-943) — der Skill am Zug und das Feuerbild je Regel.
 *
 * Die Ablehnungsquote soll die Guete von Regeln UND Skills zeigen. Je Skill war nichts messbar:
 * `consumerId` ist ein freies Etikett, am 2026-11-15 standen ueber 170 verschiedene im Log. Je
 * Regel fehlte die Zahl der Zuege, in denen sie gefeuert hat.
 *
 * Echter Kuzu-Store in mkdtemp, die Skill-Dateien liegen dort unter `.claude/commands`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { aggregateAuditEntries, type AuditStats } from '../src/surface/audit-stats.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';
import { alsFormatE } from './helpers/format-e.js';

/** Ein REQ mit seinem TEST — geht durchs Gate. */
function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-ok-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-ok-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-ok-${suffix}`, targetId: `REQ-ok-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

/** Ein REQ ohne TEST — R-01 lehnt ihn ab. */
function lonelyReq(suffix: string): MutateCommand[] {
  return [{ op: 'add-node', node: { uid: `REQ-lonely-${suffix}`, type: 'REQ', name: `l-${suffix}`, description: '', attributes: {} } }];
}

describe('TEST-audit-skill-und-feuerbild (CR-GC-943)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  const jsonl = (file: string): Array<Record<string, unknown>> =>
    readFileSync(join(repoRoot, '.graphcode', file), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-skill-'));
    mkdirSync(join(repoRoot, '.claude', 'commands', 'se'), { recursive: true });
    writeFileSync(join(repoRoot, '.claude', 'commands', 'se-fmea.md'), '---\nname: se-fmea\n---\n');
    writeFileSync(join(repoRoot, '.claude', 'commands', 'se', 'author-req.md'), '---\nname: se:author-req\n---\n');
    const config: HarnessConfig = {
      repoRoot,
      scope: { workspaceId: 'skill-ws', systemId: 'skill-svc' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, 'kuzu') }));
    await harness.initialize();
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close?.();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('schreibt den genannten Skill in den Audit-Satz und in trajectory.jsonl', async () => {
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('a'), harness), skill: 'se-fmea' });

    expect(jsonl('audit.jsonl').at(-1)).toMatchObject({ operation: 'mutate', result: 'applied', skill: 'se-fmea' });
    expect(jsonl('trajectory.jsonl').at(-1)).toMatchObject({ skill: 'se-fmea' });
  });

  it('zaehlt die Schreibweise von OpenCode unter dem einen Namen des Skills', async () => {
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('a'), harness), skill: 'se-author-req' });
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('b'), harness), skill: 'se:author-req' });

    expect(jsonl('audit.jsonl').map((e) => e.skill)).toEqual(['se:author-req', 'se:author-req']);
  });

  it('traegt den Skill auch an der Probe und an der Ablehnung des Gates', async () => {
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('a'), harness), skill: 'se-fmea', dryRun: true });
    await tools['graph_mutate'].handler({ formatE: alsFormatE(lonelyReq('b'), harness), skill: 'se-fmea' });

    expect(jsonl('audit.jsonl')).toMatchObject([
      { operation: 'validate', skill: 'se-fmea' },
      { operation: 'mutate', result: 'rejected', skill: 'se-fmea' },
    ]);
  });

  it('laesst das Feld weg, wenn der Schreiber keinen Skill nennt', async () => {
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('a'), harness) });

    expect(jsonl('audit.jsonl').at(-1)).not.toHaveProperty('skill');
    expect(jsonl('trajectory.jsonl').at(-1)).not.toHaveProperty('skill');
  });

  it('lehnt einen unbekannten Skill-Namen ab und wendet nichts an', async () => {
    const result = (await tools['graph_mutate'].handler({
      formatE: alsFormatE(validSet('a'), harness),
      skill: 'cr-gc-857',
    })) as { success: boolean; violations: Array<{ ruleId: string; message: string }>; graphVersion: number };

    expect(result.success).toBe(false);
    expect(result.violations).toMatchObject([{ ruleId: 'SKILL' }]);
    expect(result.violations[0].message).toContain('cr-gc-857');
    expect(result.graphVersion).toBe(0);
    expect(harness.getGraph().nodes.length).toBe(0);
    // Die Ablehnung steht im Log, ohne Skill — der Name ist keiner.
    const last = jsonl('audit.jsonl').at(-1)!;
    expect(last).toMatchObject({ result: 'rejected' });
    expect(last).not.toHaveProperty('skill');
  });

  it('liefert bySkill; ein Satz ohne Feld zaehlt unter skill null, nicht als eigener Skill', async () => {
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('a'), harness), skill: 'se-fmea' });
    await tools['graph_mutate'].handler({ formatE: alsFormatE(lonelyReq('b'), harness), skill: 'se-fmea' });
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('c'), harness) });

    const stats = (await tools['audit_stats'].handler({})) as AuditStats;
    expect(stats.bySkill).toEqual([
      { skill: 'se-fmea', applied: 1, rejected: 1, topBlockingRule: 'R-01' },
      { skill: null, applied: 1, rejected: 0, topBlockingRule: null },
    ]);
  });

  it('zaehlt firedIn je Satz: ohne Fund 0, im Katalog und nie gelaufen null', () => {
    const entries = [
      // Zwei Funde derselben Regel in EINEM Satz: firedIn 1, occurrences 2.
      { id: 'a', result: 'applied', violations: [{ ruleId: 'R-04', severity: 'warning' }, { ruleId: 'R-04', severity: 'warning' }], rulesPassed: ['R-01'] },
      { id: 'b', result: 'rejected', violations: [{ ruleId: 'R-01', severity: 'error' }], rulesPassed: ['R-04'] },
      { id: 'c', result: 'applied', violations: [], rulesPassed: ['R-01', 'R-04', 'R-17'] },
    ];

    const { byRule } = aggregateAuditEntries(entries, 3, { catalog: ['R-01', 'R-04', 'R-17', 'MT-01'] });
    const rule = (id: string) => byRule.find((r) => r.ruleId === id)!;

    expect(rule('R-04')).toMatchObject({ firedIn: 1, occurrences: 2, evaluatedIn: 3 });
    expect(rule('R-01')).toMatchObject({ firedIn: 1, evaluatedIn: 3 });
    // Lief einmal und fand nichts: 0, eine Messung.
    expect(rule('R-17')).toMatchObject({ firedIn: 0, evaluatedIn: 1 });
    // Steht im Katalog, kein Satz zeigt einen Lauf: null, keine 0.
    expect(rule('MT-01')).toMatchObject({ firedIn: null, evaluatedIn: null, occurrences: 0, passed: null });
  });

  it('gibt evaluatedIn als null, sobald ein Satz des Fensters keine bestandenen Regeln fuehrt', () => {
    const entries = [
      { id: 'alt', result: 'applied', violations: [{ ruleId: 'R-04', severity: 'warning' }] },
      { id: 'neu', result: 'applied', violations: [], rulesPassed: ['R-04'] },
    ];

    const { byRule } = aggregateAuditEntries(entries, 2);
    expect(byRule.find((r) => r.ruleId === 'R-04')).toMatchObject({ firedIn: 1, evaluatedIn: null });
  });

  it('nennt im Werkzeug jede Regel des Katalogs, auch die nie gelaufene', async () => {
    await tools['graph_mutate'].handler({ formatE: alsFormatE(validSet('a'), harness) });

    const stats = (await tools['audit_stats'].handler({})) as AuditStats;
    const never = stats.byRule.filter((r) => r.firedIn === null);
    expect(never.length).toBeGreaterThan(0);
    expect(never.every((r) => r.occurrences === 0 && r.passed === null)).toBe(true);
  });
});
