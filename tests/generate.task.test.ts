/**
 * CR-GC-601 — der Task-Modus: dieselbe Maschine, im Fokus der Eintrittspunkt des Tasks.
 *
 * Der Kern nennt den Eintrittspunkt einer Analyse (AF-01..05); `graph_generate {task}` startet sie.
 * CR-GC-748 (contracts 11, CR-SM-395): die Analysen fuehren kein eigenes Regelset mehr — FM-, MS-,
 * CR-R-Regeln, TR-01 und IR-01 gehoeren dem Kern und stehen dort an ihrer Stufe. Ein Task ist durch,
 * wenn sein Eintrittspunkt schweigt oder abgenommen ist. Geprueft am echten Golden (sigllm v98) und am
 * echten Gate.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_METRIC_POLICY, evaluateAllRules, taskOf } from '@sigloch/contracts/se';
import { focusViolations } from '../src/kernel/measure/focus-set.js';
import { generationStep, TASK_SKILL } from '../src/loop/generate.js';
import { createHarness, bindToolsToHarness, type GraphCodeHarness } from '../src/index.js';
import { alsFormatE } from './helpers/format-e.js';

type Flat = { elements: { id: string; type: string; name?: string; description?: string; attributes?: Record<string, unknown>; [k: string]: unknown }[]; traces: { source: string; target: string; type: string; label?: string }[] };
const golden: Flat = JSON.parse(readFileSync(fileURLToPath(new URL('../beispielgraphen/sigllm-v98.graph.json', import.meta.url)), 'utf8'));
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

/** Die Regeln, die im Kern-Fokus eines Graphen offen sind. */
const kernRegeln = (g: Flat): string[] => {
  const og = { elements: g.elements, traces: g.traces } as never;
  return [...new Set(focusViolations(og, evaluateAllRules(og, DEFAULT_METRIC_POLICY)).map((v) => v.rule_id))].sort();
};

describe('CR-GC-601: graph_generate {task}', () => {
  it('fmea am Golden: die Analyse ist gestempelt — der Task ist durch, ihre Regeln stehen im Kern', () => {
    const s = step('fmea');
    expect(s.phase).toBe('handoff');
    expect(s.done).toBe(true);
    expect(s.skill).toBe('se-fmea');
    expect(s.prompt).toMatch(/Task fmea fertig/);
    // CR-GC-748: FM-03 nahm bis contracts 10 der Task dem Kern ab; jetzt fuehrt ihn der Kern.
    expect(taskOf('FM-03')).toBe('kern');
    expect(kernRegeln(golden)).toContain('FM-03');
  });

  it('plan am Golden: es gibt Ungebautes ohne offenen Auftrag — der Eintritt steht im Fokus; ein offener Auftrag schliesst ihn', () => {
    const plan = step('plan');
    expect(plan.done).toBe(false);
    expect(plan.focusKey).toMatch(/:AF-05:/); // CR-GC-603: der Plan fehlt
    expect(plan.skill).toBe('se-plan');
    // Der Plan ist die Menge der offenen Auftraege, kein Stempel (CR-SM-395): ein CR mit status open genuegt.
    const mit = structuredClone(golden);
    const ziel = mit.elements.find((e) => e.type === 'FUNC')!.id;
    mit.elements.push({ id: 'CR-bau-1', type: 'CR', name: 'Bauauftrag', description: 'Realisiere das Ungebaute.', attributes: { status: 'open' } });
    mit.traces.push({ source: 'CR-bau-1', target: ziel, type: 'relation' });
    const s = generationStep(alsGraph(mit), DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'plan');
    expect(s.done).toBe(true);
    expect(s.prompt).toMatch(/Task plan fertig/);
    expect(kernRegeln(golden)).toContain('AF-05');
    expect(kernRegeln(mit)).not.toContain('AF-05');
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
    // CR-GC-721: der Satz nennt die Arbeit (Skill, Schritte) — nicht mehr den Stempel als Handlung.
    // local-1 (2026-09-30) setzte nach "setze am Ende seinen Frischestempel am SYS (analysisFreshness)"
    // fuenf Stempel ohne ein Artefakt.
    expect(s.prompt).toContain('Lade den Skill se-trade');
    // (Der Fund-Hinweis dahinter kommt aus contracts — CR-SM-382 nimmt dort das Attribut heraus.)
    expect(s.prompt).not.toMatch(/Frischestempel|\(analysisFreshness/);
    // ein im Kern abgenommener Eintritt ("im schlanken Umfang nicht noetig") gilt auch im Task
    sys.attributes = { ...sys.attributes, acceptedFindings: [{ ruleId: 'AF-02', reason: 'lean' }] };
    const ab = generationStep(alsGraph(ohne), DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'trade');
    expect(ab.done).toBe(true);
  });

  it('CR-GC-755: trade mit Stempel — der Task ist durch; ein Alt-Vermerk mit crRefs oder reqRefs meldet nichts mehr', () => {
    const s = step('trade');
    expect(s.done).toBe(true); // der Eintritt (AF-02) schweigt: die Analyse ist gestempelt
    expect(s.skill).toBe(TASK_SKILL.trade);
    expect(s.prompt).toMatch(/Task trade fertig/);
    expect(s.prompt).toMatch(/graph_generate ohne task/);
    // TR-01 und IR-01 sind entfallen (Regelkatalog 42/43): die Felder haben keinen Leser, auch nicht mit toten Zeigern.
    const alt = structuredClone(golden);
    const sys = alt.elements.find((e) => e.type === 'SYS')!;
    const af = sys.attributes!.analysisFreshness as Record<string, { graphVersion: number }>;
    sys.attributes = {
      ...sys.attributes,
      analysisFreshness: { ...af, trade: { ...af.trade, crRefs: ['CR-gibt-es-nicht'] }, 'assumption-review': { ...af['assumption-review'], reqRefs: ['REQ-gibt-es-nicht'] } },
    };
    expect(kernRegeln(alt)).toEqual(kernRegeln(golden));
    expect(kernRegeln(alt)).not.toContain('TR-01');
    expect(kernRegeln(alt)).not.toContain('IR-01');
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

describe('ITEM-2026-632/633: der Treiber fokussiert keinen Eintrittspunkt', () => {
  // Gemessen S2 gcrun-339..341: AF-04 am SYS im Fokus, Text der ver-Dimension — der Executor kann
  // den Analyse-Stempel nicht setzen (dafuer braucht es den Task-Skill), er legte je Runde neue
  // SYS-REQs samt TEST an: 23/16 Dubletten, drei Runden Stillstand je AF-Befund.
  const drv = (defer: string[]) => generationStep(alsGraph(golden), DEFAULT_METRIC_POLICY, undefined, 0.8, defer, 'driver', null, 'kern');

  it('ueber alle Funde gelaufen, stand nie ein AF-Eintrittspunkt im Fokus', () => {
    let cur = drv([]);
    const defer: string[] = [];
    while (cur.focusKey && defer.length < 120) {
      defer.push(cur.focusKey);
      cur = drv(defer);
    }
    expect(defer.length).toBeGreaterThan(0);
    expect(defer.filter((k) => /^[a-z]+:AF-0\d:/.test(k))).toEqual([]);
  });

  it('der Host (Claude Code) bekommt den Eintrittspunkt weiter — er kann den Task starten', () => {
    let cur = step('kern');
    const defer: string[] = [];
    while (cur.focusKey && !/^[a-z]+:AF-0\d:/.test(cur.focusKey) && defer.length < 60) {
      defer.push(cur.focusKey);
      cur = step('kern', defer);
    }
    expect(cur.focusKey).toMatch(/:AF-0\d:/);
  });
});

describe('CR-GC-601: die Sitzung bleibt im Task', () => {
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
      formatE: alsFormatE([
        knoten('SYS-s', 'SYS', 'S', 'Ein System fuer Bestellungen.'),
        knoten('UC-a', 'UC', 'Bestellen', 'Kunde bestellt ein Teil und erhaelt eine Bestaetigung.'),
        knoten('ACTOR-k', 'ACTOR', 'Kunde', 'Wer bestellt.'),
        knoten('MS-1', 'MS', 'Fundament', 'Erster Meilenstein.'),
        // CR-GC-748: etwas Ungebautes — sonst ist der Bauplan nicht faellig und der Task sofort durch.
        knoten('FUNC-f', 'FUNC', 'Bestellung annehmen', 'Nimmt die Bestellung entgegen.'),
        { op: 'add-edge', edge: { sourceId: 'SYS-s', targetId: 'UC-a', edgeType: 'compose', attributes: {} } },
      ], harness),
      consumerId: 't',
    });
  });
  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('graph_generate {task:plan}, dann ein Zug: der Vorschlag spricht weiter vom Plan-Task, ohne task zurueck in den Kern', async () => {
    const plan = await tools.graph_generate.handler({ task: 'plan' });
    expect(plan.skill).toBe('se-plan');
    const r = (await tools.graph_mutate.handler({
      formatE: alsFormatE([{ op: 'update-node', node: { uid: 'SYS-s', description: 'Fassung 2.' } }], harness),
      consumerId: 't',
    })) as { vorschlag?: string };
    // CR-GC-729: der Vorschlag an den Nutzer ersetzt `next` — die Sitzung bleibt im Task.
    expect(r.vorschlag).toBe('Führe den Bauplan weiter.');
    const kern = await tools.graph_generate.handler({});
    expect(kern.skill).not.toBe('se-plan');
  });
});
