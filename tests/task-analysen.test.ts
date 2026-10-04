/**
 * CR-GC-724 — Analysen über den Executor: der Task reist durch `graph_delegate`/`runExecutor`, das
 * Vorbild der Runde kommt aus `TASK_CLAUSE`, und den Stempel setzt der Executor, wenn das Artefakt steht.
 *
 * Reale Persistenz (Disk-Kuzu im temp repoRoot), echtes Gate — simuliert ist nur der Modell-Endpunkt.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { DEFAULT_METRIC_POLICY, type OntologyGraph } from '@sigloch/contracts/se';
import { runExecutor, ExecutorConfigSchema, type CallModel, type ModelResponse } from '../src/loop/executor.js';
import { generationStep } from '../src/loop/generate.js';
import { ohneStempelzeilen } from '../src/loop/executor-gate.js';
import { TASK_CLAUSE, alsTaskGraph } from '../src/loop/task-clause.js';
import { ANALYSE_TASKS, abschluss, artefakte, offen, stempelZug, type AnalyseTask, type TaskGraph } from '../src/loop/task-artifact.js';
import { DelegateInputSchema } from '../src/surface/delegate.js';
import { toOntologyGraph } from '../src/kernel/conformance.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

/** Ein kleiner, gate-gültiger Kern: ein UC, eine Kette mit zwei Gliedern, eine REQ mit TEST, ein Modul. */
const KERN = [
  '## Nodes',
  '### SYS',
  '+ SYS-app|Ein System zum Prüfen der Analyse-Tasks. [__name:Test App]',
  '@analysisFreshness {"trade":{"graphVersion":1,"crRefs":[]}}',
  '### UC',
  '+ UC-ablauf|Der Nutzer löst den Ablauf aus und erhält das Ergebnis. [__name:Ablauf]',
  '### FCHAIN',
  '+ FCHAIN-ablauf|Vom Auslöser zum Ergebnis. [__name:Kette Ablauf]',
  '### FUNC',
  '+ FUNC-lesen|Liest die Eingabe. [__name:Lesen]',
  '+ FUNC-liefern|Liefert das Ergebnis. [__name:Liefern]',
  '### MOD',
  '+ MOD-kern|Der Kern. [__name:Kern]',
  '### REQ',
  '+ REQ-liefern|Das System muss das Ergebnis liefern. [__name:Liefern]',
  '@kinds ["functional"]',
  '### TEST',
  '+ TEST-liefern|Ablauf auslösen und das Ergebnis prüfen. [__name:Test Liefern]',
  '',
  '## Edges',
  '+ SYS-app -compose-> UC-ablauf, MOD-kern',
  '+ UC-ablauf -compose-> FCHAIN-ablauf, REQ-liefern',
  '+ FCHAIN-ablauf -compose-> FUNC-lesen, FUNC-liefern',
  '+ FUNC-liefern -satisfy-> REQ-liefern',
  '+ FUNC-lesen -allocate-> MOD-kern',
  '+ FUNC-liefern -allocate-> MOD-kern',
  '+ TEST-liefern -verify-> REQ-liefern',
  '',
].join('\n');

/** Das Vorbild einer Klausel als Batch — Platzhalter gefüllt, wie ein Modell es täte. */
function vorbildAlsBatch(text: string): string {
  return (
    text
      .slice(text.indexOf('## Nodes'))
      .replace(/beispiel/g, 'echt')
      .replace(/«1–10»/g, '5')
      .replace(/«([^»]*)»/g, '$1') + '\n'
  );
}

const usage = { in: 10, out: 10, reasoning: 0 };
function mutateCall(id: string, formatE: string): ModelResponse {
  const input = { formatE };
  return {
    text: '',
    toolCalls: [{ id, name: 'graphcode_graph_mutate', input }],
    stopReason: 'tool_use',
    assistantMsg: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id, type: 'function', function: { name: 'graphcode_graph_mutate', arguments: JSON.stringify(input) } }],
    },
    usage,
  };
}
function scripted(responses: ModelResponse[]): { callModel: CallModel; prompts: string[] } {
  const prompts: string[] = [];
  const queue = [...responses];
  const callModel: CallModel = async (_system, messages) => {
    prompts.push(JSON.stringify(messages));
    const next = queue.shift();
    if (!next) throw new Error('scripted model exhausted');
    return next;
  };
  return { callModel, prompts };
}

const CONFIG = ExecutorConfigSchema.parse({ baseUrl: 'http://scripted.invalid', model: 'scripted', maxRounds: 1, maxStepTurns: 2 });

describe('CR-GC-724: Analysen über den Executor', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: MCPToolRegistry;

  const mutate = async (formatE: string): Promise<{ success: boolean; violations?: unknown }> =>
    (await registry['graph_mutate'].handler(registry['graph_mutate'].inputSchema.parse({ formatE, consumerId: 'test' }))) as {
      success: boolean;
      violations?: unknown;
    };
  const og = (): OntologyGraph => toOntologyGraph(harness.getGraph());
  const stempel = (): Record<string, { graphVersion: number; crRefs?: string[] }> =>
    (harness.getGraph().nodes.find((n) => n.type === 'SYS')!.attributes?.analysisFreshness ?? {}) as Record<
      string,
      { graphVersion: number; crRefs?: string[] }
    >;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-task-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'task', systemId: 'task' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    const kern = await mutate(KERN);
    expect(kern.success, JSON.stringify(kern.violations)).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('das Vorbild jeder Analyse geht durchs Gate und ergibt eine Einheit des Artefakts', () => {
    for (const task of ANALYSE_TASKS) {
      it(task, async () => {
        const vorher = new Set(artefakte(task, alsTaskGraph(og())));
        const text = TASK_CLAUSE[task].text(og());
        // Form ohne Fachinhalt und ohne den Stempel — den setzt der Executor.
        expect(text).not.toMatch(/analysisFreshness|graphVersion|Stempel|graph_generate|Skill/);
        const res = await mutate(vorbildAlsBatch(text));
        expect(res.success, JSON.stringify(res.violations)).toBe(true);
        const neu = artefakte(task, alsTaskGraph(og())).filter((id) => !vorher.has(id));
        expect(neu.length, `${task}: das Vorbild erzeugt keine Einheit`).toBeGreaterThan(0);
      });
    }
  });

  it('Rundenprompt: im Executor trägt der Task-Eintritt die Klausel, beim Host den Verweis auf den Skill', () => {
    const schritt = (selection: 'driver' | 'host') =>
      generationStep(harness.getGraph(), DEFAULT_METRIC_POLICY, undefined, 0.8, [], selection, null, 'fmea');
    const driver = schritt('driver');
    expect(driver.focusKey).toMatch(/:AF-04:/);
    expect(driver.prompt).toContain('Noch ohne Fehlermodus: FCHAIN-ablauf');
    expect(driver.prompt).toContain('+ FCHAIN-ablauf -satisfy-> REQ-risk-beispiel-a');
    expect(driver.prompt).not.toMatch(/Lade den Skill|graph_generate|analysisFreshness/);
    expect(driver.focusTypes).toEqual([...TASK_CLAUSE.fmea.types]);
    // Bestand nach Typ, nicht aus dem Kontext des SYS.
    expect(driver.focusElements).toEqual([]);
    const host = schritt('host');
    expect(host.prompt).toContain('Lade den Skill se-fmea');
    expect(host.prompt).not.toContain('REQ-risk-beispiel-a');
  });

  it('Kriterium: ein Stempel allein ist kein Artefakt, eine vollständige Einheit schon', () => {
    const leer: TaskGraph = alsTaskGraph(og());
    expect(artefakte('fmea', leer)).toEqual([]);
    expect(offen('fmea', leer)).toEqual(['FCHAIN-ablauf']);
    expect(abschluss('fmea', leer, new Set(), undefined).fertig).toBe(false);
    // Auch nach einer Runde ohne Ertrag: null Einheiten bleiben null.
    expect(abschluss('fmea', leer, new Set(), 0).fertig).toBe(false);
    // Risiko ohne Gegenmaßnahme zählt nicht.
    const halb: TaskGraph = {
      nodes: [...leer.nodes, { id: 'REQ-r', type: 'REQ', attributes: { role: 'risk' } }],
      edges: [...leer.edges, { source: 'FCHAIN-ablauf', type: 'satisfy', target: 'REQ-r' }],
    };
    expect(artefakte('fmea', halb)).toEqual([]);
    const ganz: TaskGraph = {
      nodes: [...halb.nodes, { id: 'REQ-m', type: 'REQ', attributes: { role: 'mitigation' } }],
      edges: [...halb.edges, { source: 'REQ-r', type: 'compose', target: 'REQ-m' }],
    };
    expect(artefakte('fmea', ganz)).toEqual(['REQ-r']);
    expect(offen('fmea', ganz)).toEqual([]);
    expect(abschluss('fmea', ganz, new Set(), undefined).fertig).toBe(true);
    // conops/irr: was vor dem Task schon da war, ist nicht der Ertrag des Tasks.
    const cr: TaskGraph = { nodes: [...leer.nodes, { id: 'CR-alt', type: 'CR' }], edges: leer.edges };
    expect(abschluss('irr', cr, new Set(['CR-alt']), 0).fertig).toBe(false);
    expect(abschluss('irr', cr, new Set(), 0).einheiten).toEqual(['CR-alt']);
  });

  it('Stempel-Zug: trägt die übrigen Stempel mit und nennt crRefs nur bei trade und irr', () => {
    const bisher = { conops: { graphVersion: 3 } };
    expect(stempelZug('fmea', 'SYS-app', bisher, 7, ['REQ-r'])).toBe(
      '## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness {"conops":{"graphVersion":3},"fmea":{"graphVersion":7}}\n',
    );
    expect(stempelZug('irr', 'SYS-app', {}, 7, ['CR-a'])).toContain('"assumption-review":{"graphVersion":7,"crRefs":["CR-a"]}');
    expect(stempelZug('plan', 'SYS-app', {}, 7, ['MS-1'])).toContain('"implplan":{"graphVersion":7}');
  });

  it('Executor: schreibt das Modell das Artefakt, setzt der Executor den Stempel — die übrigen bleiben', async () => {
    const batch = vorbildAlsBatch(TASK_CLAUSE.fmea.text(og()));
    const { callModel, prompts } = scripted([mutateCall('c1', batch)]);
    const stats = await runExecutor({ registry, workspaceDir: repoRoot, config: CONFIG, callModel, task: 'fmea' });
    // Der Task reiste bis in den Rundenprompt.
    expect(prompts[0]).toContain('Task fmea');
    expect(prompts[0]).toContain('REQ-risk-beispiel-a');
    expect(stats.taskStempel?.einheiten).toEqual(['REQ-risk-echt-a']);
    const s = stempel();
    expect(s.fmea.graphVersion).toBe(stats.taskStempel!.graphVersion);
    expect(s.fmea.graphVersion).toBe(harness.getGraph().nodes.length > 0 ? stats.taskStempel!.graphVersion : -1);
    expect(s.trade, 'der Stempel aus dem Kern-Graphen überlebt').toEqual({ graphVersion: 1, crRefs: [] });
  });

  it('Executor: ein Stempel des Modells erreicht das Gate nicht — ohne Artefakt bleibt der Task offen', async () => {
    const schummel = '## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness {"fmea":{"graphVersion":99}}\n';
    const { callModel } = scripted([mutateCall('c1', schummel), mutateCall('c2', schummel)]);
    const traces: string[] = [];
    const stats = await runExecutor({ registry, workspaceDir: repoRoot, config: CONFIG, callModel, task: 'fmea', trace: (l) => traces.push(l) });
    expect(traces.join('\n')).toContain('@analysisFreshness aus dem Batch genommen');
    expect(stats.taskStempel).toBeUndefined();
    expect(stempel().fmea).toBeUndefined();
  });

  it('CR-GC-735: ein Patch ersetzt analysisFreshness ganz — lesen, übernehmen, ganz schreiben hält alle', async () => {
    expect(Object.keys(stempel())).toEqual(['trade']);
    // Der Teil-Stempel, wie die Skills ihn bis CR-GC-735 nahelegten: trade geht verloren (todo-local, 2026-10-04).
    await mutate('## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness {"conops":{"graphVersion":2}}\n');
    expect(Object.keys(stempel())).toEqual(['conops']);
    // Lesen, übernehmen, ganz schreiben — der Weg der Skills und von stempelZug.
    await mutate(`## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness ${JSON.stringify({ ...stempel(), fmea: { graphVersion: 3 } })}\n`);
    expect(Object.keys(stempel()).sort()).toEqual(['conops', 'fmea']);
  });

  it('CR-GC-735: jeder Analyse-Skill schließt mit lesen, übernehmen, ganz schreiben', () => {
    for (const skill of ['se-conops', 'se-trade', 'se-irr', 'se-fmea', 'se-plan']) {
      const text = readFileSync(fileURLToPath(new URL(`../.claude/commands/${skill}.md`, import.meta.url)), 'utf8');
      expect(text, skill).toContain('read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`');
      expect(text, skill).not.toMatch(/attributes\.analysisFreshness[.[]/);
    }
  });

  it('ohneStempelzeilen nimmt nur die Stempelzeile', () => {
    const r = ohneStempelzeilen({ formatE: '## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness {"fmea":{}}\n@role x\n' });
    expect(r.entfernt).toBe(1);
    expect((r.input as { formatE: string }).formatE).toBe('## Nodes\n### SYS\n~ SYS-app\n@role x\n');
    expect(ohneStempelzeilen({ formatE: '## Edges\n+ A -io-> B\n' }).entfernt).toBe(0);
  });

  it('graph_delegate nimmt task allein oder mit auftrag — und nur die Analyse-Tasks', () => {
    for (const task of ANALYSE_TASKS) expect(() => DelegateInputSchema.parse({ task })).not.toThrow();
    expect(DelegateInputSchema.parse({ task: 'fmea', auftrag: 'nur die Zustellkette' }).task).toBe('fmea' satisfies AnalyseTask);
    expect(() => DelegateInputSchema.parse({ task: 'implplan' })).toThrow();
    expect(() => DelegateInputSchema.parse({ task: 'kern' })).toThrow();
  });
});
