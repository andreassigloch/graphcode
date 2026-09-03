/**
 * TEST-trajectory-stamps (CR-GC-434) — die Trajektorie stempelt den Auslöser.
 *
 * CR-GC-432 hat Claim A ("die Regeln lassen Agenten selbst steuern") an 678 realen
 * Episoden geprüft und für NICHT MESSBAR befunden: trajectory.jsonl kannte keinen
 * Auslöser. Vier Stempel schließen die Datenlücke — je Mutation:
 *
 *   respondsTo     — welche Violation(s) die Mutation beantwortet (Vorher/Nachher-
 *                    Delta der Gate-Regeln; [] = keine, Feld fehlt = nicht ermittelbar)
 *   trigger        — 'human-order' (erste Mutation unter neuem Prompt) vs.
 *                    'agent-round' (Folgemutation unter demselben Prompt);
 *                    fehlt, wenn kein Prompt bekannt ist (Absenz = nicht erfasst,
 *                    CR-GC-354-Asymmetrie — nie geraten)
 *   consultedTools — welche Read-Tools seit der letzten Mutation liefen (Namensliste,
 *                    [] = nachweislich kein Abruf)
 *   editSource     — 'suggestion-template' (Batch = von graph_suggest gelieferter
 *                    Template-Edit) vs. 'authored'
 *
 * Real disk Kuzu in mkdtemp, durable FileOperationsLog, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { AuditEntry } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsWithContext } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { ToolContext } from '../src/surface/tool-context.js';
import type { TrajectoryStamps } from '../src/projections/trajectory.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

type StampedEntry = AuditEntry & TrajectoryStamps;

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'stamps-ws', systemId: 'stamps-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

/** Vorbestehende Schuld (Import umgeht das Delta-Gate): R-01 auf REQ-uncovered;
 *  CR-1 nennt FUNC-parse im Text, damit das CR-R01-Fix-Template einen Edit liefert. */
const DEBT_FIXTURE = {
  elements: [
    { id: 'CR-1', type: 'CR', name: 'parser fix', description: 'betrifft FUNC-parse und nichts sonst' },
    { id: 'FUNC-parse', type: 'FUNC', name: 'parse', description: 'parses input' },
    { id: 'REQ-uncovered', type: 'REQ', name: 'Uncovered requirement', description: 'needs a verifying test' },
  ],
  traces: [] as Array<{ source: string; target: string; type: string }>,
};

/** Selbst-verifizierter REQ-Batch — immer gate-legal, beantwortet keine Alt-Violation. */
function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-st-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-st-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-st-${suffix}`, targetId: `REQ-st-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

describe('TEST-trajectory-stamps (CR-GC-434): jede Mutation trägt ihren Auslöser', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;
  let ctx: ToolContext;

  async function mutate(commands: MutateCommand[]): Promise<Record<string, unknown>> {
    return (await tools['graph_mutate'].handler({ commands, consumerId: 'stamps-test' })) as Record<string, unknown>;
  }

  async function lastEntry(): Promise<StampedEntry> {
    const all = (await ctx.auditLog.query({})) as StampedEntry[];
    return all[all.length - 1];
  }

  function lastFeedLine(): Record<string, unknown> {
    const raw = readFileSync(join(repoRoot, '.graphcode', 'trajectory.jsonl'), 'utf8').trim();
    const lines = raw.split('\n');
    return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
  }

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-stamps-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    await harness.importGraph(DEBT_FIXTURE);
    ({ registry: tools, ctx } = bindToolsWithContext(harness));
  });

  afterEach(async () => {
    await harness.close?.();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  // AC 1 — jede applied Mutation trägt die Stempel; fehlende Information ist
  // EXPLIZIT leer ([] / Feld-Absenz nach CR-GC-354-Asymmetrie), nie geraten.
  it('stempelt eine applied Mutation: leere Felder sind explizit leer, nie geraten', async () => {
    const res = await mutate(validSet('a'));
    expect(res.success).toBe(true);

    const entry = await lastEntry();
    expect(entry.result).toBe('applied');
    // Kein Read-Tool lief, keine Alt-Violation beantwortet, kein Template benutzt:
    expect(entry.consultedTools).toEqual([]);
    expect(entry.respondsTo).toEqual([]);
    expect(entry.editSource).toBe('authored');
    // Kein Prompt bekannt → trigger ist NICHT ERFASST (Absenz, nie ein Ratewert).
    expect(Object.prototype.hasOwnProperty.call(entry, 'trigger')).toBe(false);

    // Die Projektion trägt dieselben Stempel — trajectory.jsonl ist der Messpunkt.
    const line = lastFeedLine();
    expect(line.applied).toBe(true);
    expect(line.consultedTools).toEqual([]);
    expect(line.respondsTo).toEqual([]);
    expect(line.editSource).toBe('authored');
    expect(Object.prototype.hasOwnProperty.call(line, 'trigger')).toBe(false);
  });

  // AC 2 — trigger unterscheidet die zwei Fälle nachweisbar, je ein echter Gate-Lauf.
  it('trigger: erste Mutation unter neuem Prompt = human-order, Folgemutation = agent-round', async () => {
    ctx.setOrigin({ model: 'test-model', intent: 'schliesse die violations' });
    await mutate(validSet('b'));
    expect((await lastEntry()).trigger).toBe('human-order');

    // Gleicher Auftrag, nächste Runde: die Mutation entstand agentenintern.
    await mutate(validSet('c'));
    expect((await lastEntry()).trigger).toBe('agent-round');

    // Neuer menschlicher Auftrag ⇒ wieder human-order.
    ctx.setOrigin({ model: 'test-model', intent: 'baue das schema aus' });
    await mutate(validSet('d'));
    expect((await lastEntry()).trigger).toBe('human-order');
  });

  // AC 3 — consultedTools erfasst graph_next_step/graph_suggest; ein Lauf ohne Abruf
  // ist als solcher erkennbar ([]).
  it('consultedTools: erfasst die Read-Tools vor der Mutation, [] ohne Abruf', async () => {
    await tools['graph_next_step'].handler({});
    await tools['graph_suggest'].handler({ target: { coherence: 1 } });
    await mutate(validSet('e'));

    const consulted = (await lastEntry()).consultedTools ?? [];
    expect(consulted).toContain('graph_next_step');
    expect(consulted).toContain('graph_suggest');

    // Nächste Mutation ohne jeden Abruf: die Liste ist geleert, [] ist die Aussage.
    await mutate(validSet('f'));
    expect((await lastEntry()).consultedTools).toEqual([]);
  });

  // respondsTo — die beantwortete Violation kommt aus dem Vorher/Nachher-Delta der
  // Gate-Regeln, nie aus einer Vermutung.
  it('respondsTo: die Mutation, die R-01 auf REQ-uncovered schliesst, trägt genau diesen Fund', async () => {
    const res = await mutate([
      { op: 'add-node', node: { uid: 'TEST-covers', type: 'TEST', name: 'covers', description: '', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-covers', targetId: 'REQ-uncovered', edgeType: 'verify', attributes: {} } },
    ]);
    expect(res.success).toBe(true);

    const entry = await lastEntry();
    expect(entry.respondsTo).toContainEqual({ ruleId: 'R-01', elementId: 'REQ-uncovered' });
  });

  // editSource — Zirkularitäts-Stempel: Template-Edit von graph_suggest vs. eigene
  // Formulierung.
  it('editSource: ein von graph_suggest gelieferter Template-Edit stempelt suggestion-template', async () => {
    const suggest = (await tools['graph_suggest'].handler({ target: { coherence: 1 }, k: 20, layer: 'all' })) as {
      suggestions: Array<{ ruleId: string; edit?: { source: string; target: string; type: string } }>;
    };
    const templated = suggest.suggestions.find((s) => s.edit);
    expect(templated?.edit).toBeDefined();

    // Exakt den gelieferten Edit anwenden — das ist der Template-Pfad.
    const res = await mutate([
      {
        op: 'add-edge',
        edge: { sourceId: templated!.edit!.source, targetId: templated!.edit!.target, edgeType: templated!.edit!.type, attributes: {} },
      } as MutateCommand,
    ]);
    expect(res.success).toBe(true);
    expect((await lastEntry()).editSource).toBe('suggestion-template');

    // Eine eigene Formulierung danach ist authored.
    await mutate(validSet('g'));
    expect((await lastEntry()).editSource).toBe('authored');
  });

  // AC 4 (Abgrenzung) — dryRun-Previews (operation:'validate') tragen KEINE Stempel:
  // sie sind Konsultation, nicht Mutation, und dürfen weder die consulted-Liste
  // leeren noch die Prompt-Frische verbrauchen.
  it('dryRun-Preview trägt keine Stempel und verbraucht weder Konsultation noch Prompt-Frische', async () => {
    ctx.setOrigin({ intent: 'preview dann apply' });
    await tools['graph_next_step'].handler({});
    await tools['graph_mutate'].handler({ commands: validSet('h'), dryRun: true, consumerId: 'stamps-test' });

    const preview = await lastEntry();
    expect(preview.operation).toBe('validate');
    expect(Object.prototype.hasOwnProperty.call(preview, 'consultedTools')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(preview, 'trigger')).toBe(false);

    await mutate(validSet('h'));
    const applied = await lastEntry();
    expect(applied.trigger).toBe('human-order');
    expect(applied.consultedTools).toContain('graph_next_step');
  });
});
