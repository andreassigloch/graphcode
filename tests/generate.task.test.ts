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

type Flat = { elements: { id: string; type: string; name?: string; description?: string; attributes?: Record<string, unknown>; [k: string]: unknown }[]; traces: { source: string; target: string; type: string }[] };
const golden: Flat = JSON.parse(readFileSync(fileURLToPath(new URL('../rig/sigllm-spezifikation/golden/sigllm-v98.graph.json', import.meta.url)), 'utf8'));
const alsGraph = (g: Flat) => {
  const KNOWN = new Set(['id', 'type', 'name', 'description', 'attributes']);
  return {
    nodes: g.elements.map((e) => {
      const attrs: Record<string, unknown> = { ...(e.attributes ?? {}) };
      for (const [k, v] of Object.entries(e)) if (!KNOWN.has(k)) attrs[k] = v;
      return { uid: e.id, type: e.type, name: e.name ?? e.id, description: e.description ?? '', attributes: attrs };
    }),
    edges: g.traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: {} })),
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

  it('plan am Golden: MS-01 steht im Plan-Task, im Kern nicht', () => {
    const plan = step('plan');
    expect(taskOf(plan.focusKey!.split(':')[1])).toBe('plan');
    const kernRegel = step('kern').focusKey!.split(':')[1];
    expect(taskOf(kernRegel)).toBe('kern');
  });

  it('ein Task ohne eigene Regeln (trade) ist sofort durch — Ausgang: Artefakt mit dem Skill abschliessen', () => {
    const s = step('trade');
    expect(s.phase).toBe('handoff');
    expect(s.done).toBe(true);
    expect(s.prompt).toMatch(/Task trade fertig/);
    expect(s.prompt).toMatch(/graph_generate ohne task/);
    expect(s.skill).toBe(TASK_SKILL.trade);
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
