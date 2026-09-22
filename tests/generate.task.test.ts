/**
 * CR-GC-601 — der Task-Modus: dieselbe Maschine, das detaillierte Regelset des Tasks als Warnung.
 *
 * Der Kern sieht von einem Task nur den Eintrittspunkt (AF-01..05); `graph_generate {task}` startet
 * ihn. Geprueft am echten Golden (sigllm v98) und am echten Gate.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_METRIC_POLICY, taskOf } from '@sigloch/contracts/se';
import { generationStep, TASK_SKILL } from '../src/loop/generate.js';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';

type Flat = { elements: { id: string; type: string; name?: string; description?: string; attributes?: Record<string, unknown>; [k: string]: unknown }[]; traces: { source: string; target: string; type: string; label?: string }[] };
const golden: Flat = JSON.parse(readFileSync(fileURLToPath(new URL('../rig/sigllm-spezifikation/golden/sigllm-v98.graph.json', import.meta.url)), 'utf8'));
const alsGraph = (g: Flat) => {
  const KNOWN = new Set(['id', 'type', 'name', 'description', 'attributes']);
  return {
    nodes: g.elements.map((e) => {
      const attrs: Record<string, unknown> = { ...(e.attributes ?? {}) };
      for (const [k, v] of Object.entries(e)) if (!KNOWN.has(k)) attrs[k] = v;
      return { uid: e.id, type: e.type, name: e.name ?? e.id, description: e.description ?? '', attributes: attrs };
    }),
    // CR-GC-607: das Label MUSS mit — sonst sieht kein Leser eine decides-/depends-on-Kante (TR-01, MS-02).
    edges: g.traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: t.label ? { label: t.label } : {} })),
  } as never;
};
const step = (task: Parameters<typeof generationStep>[7] = 'kern', defer: string[] = []) =>
  generationStep(alsGraph(golden), DEFAULT_METRIC_POLICY, undefined, 0.8, defer, 'host', null, task);

describe('CR-GC-601: graph_generate {task}', () => {
  it('fmea am Golden: Fokus auf einer FMEA-Regel, Skill se-fmea, nichts blockiert', () => {
    const s = step('fmea');
    expect(s.phase).toBe('expand');
    expect(taskOf(s.focusKey!.split(':')[1])).toBe('fmea');
    expect(s.skill).toBe('se-fmea');
    expect(s.prompt.startsWith('Task fmea (Skill se-fmea): ')).toBe(true);
    expect(s.blockingErrors).toBe(0); // Task-Regeln sind Warnungen
  });

  it('plan am Golden: ohne implplan-Stempel steht zuerst der Eintritt, danach die Plan-Regeln — im Kern nicht', () => {
    const plan = step('plan');
    expect(plan.focusKey).toMatch(/:AF-05:/); // CR-GC-603: das Artefakt fehlt
    const weiter = step('plan', [plan.focusKey!]);
    expect(taskOf(weiter.focusKey!.split(':')[1])).toBe('plan');
    const kernRegel = step('kern').focusKey!.split(':')[1];
    expect(taskOf(kernRegel)).toBe('kern');
  });

  it('CR-GC-603: ein Task ohne Artefakt ist nicht fertig — ohne trade-Stempel steht AF-02 im Task-Fokus', () => {
    const ohne = structuredClone(golden);
    const sys = ohne.elements.find((e) => e.type === 'SYS')!;
    const stempel = { ...(sys.attributes!.analysisFreshness as Record<string, unknown>) };
    delete stempel.trade;
    sys.attributes = { ...sys.attributes, analysisFreshness: stempel };
    const s = generationStep(alsGraph(ohne), DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'trade');
    expect(s.done).toBe(false);
    expect(s.focusKey).toMatch(/:AF-02:/);
    expect(s.prompt).toContain('Das Artefakt des Tasks trade fehlt noch');
    // ein im Kern abgenommener Eintritt ("im schlanken Umfang nicht noetig") gilt auch im Task
    sys.attributes = { ...sys.attributes, acceptedFindings: [{ ruleId: 'AF-02', reason: 'lean' }] };
    const ab = generationStep(alsGraph(ohne), DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'trade');
    expect(ab.done).toBe(true);
  });

  it('CR-GC-607: trade mit Stempel ohne crRefs ist NICHT durch (TR-01) — mit Entscheidungs-CR im Stempel ist er es', () => {
    const ohne = step('trade');
    expect(ohne.done).toBe(false);
    expect(ohne.focusKey).toMatch(/:TR-01:/);
    expect(ohne.skill).toBe(TASK_SKILL.trade);
    // Der Golden traegt genau eine Entscheidung: CR-SL-001 -relation[decides]-> MOD-llm-runtime.
    const mit = structuredClone(golden);
    const sys = mit.elements.find((e) => e.type === 'SYS')!;
    const af = sys.attributes!.analysisFreshness as Record<string, { graphVersion: number }>;
    sys.attributes = { ...sys.attributes, analysisFreshness: { ...af, trade: { ...af.trade, crRefs: ['CR-SL-001'] } } };
    const s = generationStep(alsGraph(mit), DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'trade');
    expect(s.phase).toBe('handoff');
    expect(s.done).toBe(true);
    expect(s.prompt).toMatch(/Task trade fertig/);
    expect(s.prompt).toMatch(/graph_generate ohne task/);
  });

  it('CR-GC-607: irr — leere crRefs sind ein legitimer Ausgang, ein fehlender CR nicht (IR-01)', () => {
    const g = structuredClone(golden);
    const sys = g.elements.find((e) => e.type === 'SYS')!;
    const af = sys.attributes!.analysisFreshness as Record<string, { graphVersion: number }>;
    const mitRefs = (crRefs: string[]) => {
      sys.attributes = { ...sys.attributes, analysisFreshness: { ...af, 'assumption-review': { ...af['assumption-review'], crRefs } } };
      return generationStep(alsGraph(g), DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'irr');
    };
    expect(mitRefs([]).done).toBe(true);
    const kaputt = mitRefs(['CR-gibt-es-nicht']);
    expect(kaputt.done).toBe(false);
    expect(kaputt.focusKey).toMatch(/:IR-01:/);
  });

  it('im Kern: steht ein Eintrittspunkt im Fokus, nennt der Prompt den Task und seinen Skill', () => {
    let cur = step('kern');
    const defer: string[] = [];
    while (cur.focusKey && !/^[a-z]+:AF-0\d:/.test(cur.focusKey) && defer.length < 60) {
      defer.push(cur.focusKey);
      cur = step('kern', defer);
    }
    expect(cur.focusKey).toMatch(/:AF-05:/);
    expect(cur.prompt).toContain("graph_generate {task:'plan'} (Skill se-plan)");
  });
});

describe('CR-GC-601: next bleibt im Task der Sitzung', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: ReturnType<typeof bindToolsToHarness>;
  const knoten = (uid: string, type: string, name: string, description: string) =>
    ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-task-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
    await harness.initialize();
    tools = bindToolsToHarness(harness);
    await tools.graph_mutate.handler({
      commands: [
        knoten('SYS-s', 'SYS', 'S', 'Ein System fuer Bestellungen.'),
        knoten('UC-a', 'UC', 'Bestellen', 'Kunde bestellt ein Teil und erhaelt eine Bestaetigung.'),
        knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Wer bestellt.'),
        knoten('MS-1', 'MS', 'Fundament', 'Erster Meilenstein.'),
        { op: 'add-edge', edge: { sourceId: 'SYS-s', targetId: 'UC-a', edgeType: 'compose', attributes: {} } },
      ],
      consumerId: 't',
    });
  });
  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('graph_generate {task:plan}, dann ein Zug: next spricht weiter vom Plan-Task, ohne task zurueck in den Kern', async () => {
    const plan = await tools.graph_generate.handler({ task: 'plan' });
    expect(plan.skill).toBe('se-plan');
    const r = (await tools.graph_mutate.handler({
      commands: [{ op: 'update-node', node: { uid: 'SYS-s', description: 'Fassung 2.' } }],
      consumerId: 't',
    })) as { next?: { skill: string | null } };
    expect(r.next!.skill).toBe('se-plan');
    const kern = await tools.graph_generate.handler({});
    expect(kern.skill).not.toBe('se-plan');
  });
});
