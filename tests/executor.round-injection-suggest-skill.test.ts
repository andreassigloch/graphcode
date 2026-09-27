/**
 * Abnahme zu CR-GC-556 und CR-GC-557 — was der Rundeninhalt ab Element 1 traegt.
 *
 * Befund aus drei Rig-Laeufen: `graph_suggest` STAND dem Modell offen (toolset 'full')
 * und wurde null Mal gerufen. Der SYSTEM-Prompt verbietet Analyse-Turns ausdruecklich
 * („dann STOPP", „Handeln vor Analysieren") — das Regime haelt kleine Modelle beim Bauen
 * und ist richtig; falsch war der Kanal. Also ruft der Host, und das Ergebnis wird
 * injiziert, wie bei graph_generate.
 *
 * Dasselbe fuer die Skills: der Rundenprompt nannte „(Skill se:author-uc)", einen Zeiger,
 * den im Executor-Loop niemand einloesen kann. Jetzt steht der Inhalt da statt der Adresse.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { buildRoundInjection, WITHHELD_TOOLS } from '../src/loop/executor-prompt.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { z } from 'zod/v4';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SE_DESCRIPTOR, type Graph } from '@sigloch/graph-api-core';
import type { SuggestedEdit } from '@sigloch/se-engine';
import { KuzuAdapter } from './helpers/store.js';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { batchFor } from '../src/loop/suggest.js';
import { formatEToCommands } from '../src/loop/format-e-commands.js';
import { makeSteeringConfig, type FixtureGraph } from './fixtures/steering-graphs.js';

/** Eine Registry-Attrappe: nur die Handler, die die Injektion anfasst. */
function registry(suggestions: unknown[]): MCPToolRegistry {
  const tool = (schema: z.ZodType, handler: (i: unknown) => unknown) =>
    ({ name: 'x', description: '', inputSchema: schema, handler } as never);
  return {
    graph_suggest: tool(z.object({ k: z.number().max(20).default(5) }), () => ({ suggestions })),
    graph_elements: tool(
      z.object({ type: z.string().optional(), limit: z.number().default(100) }),
      () => ({ nodes: [], total: 0 }),
    ),
  } as unknown as MCPToolRegistry;
}

const vorschlag = (extra: Record<string, unknown> = {}) => ({
  ruleId: 'R-22',
  elementId: 'FUNC-task-execute',
  message: 'not allocated',
  fixHint: 'Link to a MOD',
  delta: [0.018, 0, -0.0046, 0.015, 0, 0],
  edit: { source: 'FUNC-task-execute', target: 'MOD-sched', type: 'allocate' },
  ...extra,
});

describe('CR-GC-556: die Vorschlaege kommen als Inhalt, nicht als Werkzeug', () => {
  it('graph_suggest ist dem Modell vorenthalten — der Host ruft es', () => {
    expect(WITHHELD_TOOLS.has('graph_suggest')).toBe(true);
  });

  it('die Kante steht im Rundeninhalt, mit delta', async () => {
    const out = await buildRoundInjection(registry([vorschlag()]), { focusTypes: ['FUNC'], skill: 'se:top-level' });
    expect(out).toContain('FUNC-task-execute -allocate-> MOD-sched');
    expect(out).toContain('R-22 @ FUNC-task-execute');
    expect(out, 'ohne delta ist der Optimizer unsichtbar').toContain('delta [');
  });

  it('ein Vorschlag OHNE Kante bleibt draussen — der fixHint steht schon im Rundenprompt', async () => {
    const ohne = { ...vorschlag() };
    delete (ohne as { edit?: unknown }).edit;
    const out = await buildRoundInjection(registry([ohne]), { focusTypes: ['FUNC'], skill: 'se:top-level' });
    expect(out).not.toContain('R-22 @');
  });

  it('nur Fokus-Typen — ein UC-Vorschlag taucht in einer FUNC-Runde nicht auf', async () => {
    const fremd = vorschlag({ elementId: 'UC-login', edit: { source: 'UC-login', target: 'FCHAIN-a', type: 'compose' } });
    const out = await buildRoundInjection(registry([fremd]), { focusTypes: ['FUNC'], skill: 'se:top-level' });
    expect(out).not.toContain('UC-login -compose->');
  });

  it('fragt mit k an der Schema-Obergrenze, nicht mit dem Default', async () => {
    // Der Default ist k=5 — ein Top-k fuer einen menschlichen Leser. GEMESSEN am
    // gcrun-Graphen liefert k=5 NULL Vorschlaege mit Kante und k=20 den einen, den es
    // gibt. Der Block filtert selbst auf die ausfuehrbaren; mit dem Default schneidet er
    // genau das Anwendbare weg und ist dann schlimmer als kein Block.
    const gesehen: unknown[] = [];
    const reg = {
      graph_suggest: {
        name: 'x', description: '',
        inputSchema: z.object({ k: z.number().max(20).default(5) }),
        handler: (i: unknown) => { gesehen.push(i); return { suggestions: [] }; },
      },
    } as unknown as MCPToolRegistry;
    await buildRoundInjection(reg, { focusTypes: ['FUNC'], skill: 'se:top-level' });
    expect(gesehen).toHaveLength(1);
    expect((gesehen[0] as { k: number }).k).toBe(20);
  });

  it('der Fund darf ausserhalb der Fokus-Typen liegen, wenn die KANTE hineinreicht', async () => {
    // Der reale Fall: RD-01 @ REQ-data-security, Kante FCHAIN -satisfy-> REQ, Fokus
    // ACTOR/UC/FCHAIN/FUNC. Ein Filter allein auf den Fund haette den einzigen
    // anwendbaren Zug der Runde verworfen.
    const s = vorschlag({
      ruleId: 'RD-01', elementId: 'REQ-data-security',
      edit: { source: 'FCHAIN-interactive-session', target: 'REQ-data-security', type: 'satisfy' },
    });
    const out = await buildRoundInjection(registry([s]), { focusTypes: ['ACTOR', 'UC', 'FCHAIN', 'FUNC'], skill: 'se:top-level' });
    expect(out).toContain('FCHAIN-interactive-session -satisfy-> REQ-data-security');
  });

  it('ein kaputter graph_suggest bricht die Runde nicht', async () => {
    const kaputt = {
      graph_suggest: { name: 'x', description: '', inputSchema: z.object({}), handler: () => { throw new Error('boom'); } },
    } as unknown as MCPToolRegistry;
    await expect(buildRoundInjection(kaputt, { focusTypes: ['FUNC'], skill: 'se:top-level' })).resolves.toBeTypeOf('string');
  });
});

describe('CR-GC-557: der Skill-Rumpf steht im Rundeninhalt statt seiner Adresse', () => {
  it('in einer uc-Runde kommt die Stilregel samt Jargon-Budget mit', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['UC'], skill: 'se:author-uc' });
    expect(out).toContain('se:author-uc');
    expect(out, 'die Stilregel ist der Grund fuer den Block').toContain('25');
    expect(out.toLowerCase(), 'das Jargon-Budget steht nirgends sonst').toContain('jargon');
  });

  it('das Frontmatter ist abgeschnitten — es ist Harness-Metadatum, keine Anleitung', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['UC'], skill: 'se:author-uc' });
    expect(out).not.toContain('version: 1');
    expect(out).not.toContain('description: Author a UC node');
  });

  it('hoechstens EIN Skill je Runde', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['FCHAIN', 'FUNC', 'FLOW', 'REQ'], skill: 'se:top-level' });
    expect(out.match(/Anleitung fuer diese Runde/g) ?? []).toHaveLength(1);
  });
});

describe('CR-GC-558: die Anleitung folgt der Dimension, nicht dem ersten Fokus-Typ', () => {
  it('die Struktur-Runde bekommt se:top-level — vorher lief sie ohne jede Anleitung', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['FCHAIN', 'FUNC', 'FLOW', 'REQ'], skill: 'se:top-level' });
    expect(out).toContain('se:top-level');
    expect(out, 'Phase 0 ist der Grund: die Systemgrenze zuerst').toContain('SYS as a blackbox');
  });

  it('alloc bekommt dieselbe Anleitung — der Schnitt ist eine Entscheidung, kein Aufraeumen', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['FUNC', 'MOD'], skill: 'se:top-level' });
    expect(out).toContain('se:top-level');
  });

  it('nicht der erste Fokus-Typ entscheidet: req beginnt mit UC und bekommt trotzdem author-req', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['UC', 'REQ'], skill: 'se:author-req' });
    expect(out).toContain('se:author-req');
    expect(out, 'die alte typ-gekeyte Wahl haette hier author-uc geliefert').not.toContain('se:author-uc');
  });

  it('der Marker schneidet, nicht das Byte-Budget — der Block endet an inject:end', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['FUNC'], skill: 'se:top-level' });
    expect(out, 'ein blinder Schnitt bei 4.000 Zeichen haette mitten im Satz geendet').not.toContain('… (gekuerzt)');
    expect(out, 'die Marker selbst gehoeren nicht in den Prompt').not.toContain('inject:start');
    expect(out, 'ausserhalb der Marker steht Anleitung fuer den Menschen').not.toContain('Author the story first');
  });

  it('eine Dimension ohne Autorier-Skill bekommt keinen Block', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['TEST', 'REQ'], skill: null });
    expect(out).not.toContain('Anleitung fuer diese Runde');
  });

  it('ohne Dimension (handoff) gibt es keinen Block', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: [], skill: null });
    expect(out).not.toContain('Anleitung fuer diese Runde');
  });
});

describe('CR-GC-559: jede Kaltstart-Stufe traegt die Anleitung ihrer einen Entscheidung', () => {
  it('seed:actor traegt se:author-actor samt der einen legalen Kante', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['ACTOR', 'UC'], skill: 'se:author-actor' });
    expect(out).toContain('se:author-actor');
    expect(out, 'die Grammatik ist der Grund fuer den Skill — R-18 hat vier Versuche abgewiesen').toContain(
      'ACTOR -io-> FLOW',
    );
    expect(out.toLowerCase(), 'Minimalitaet ist das Kriterium der Stufe').toContain('minimum');
  });

  it('seed:sys traegt se:top-level — Phase 0 ist die Blackbox', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['SYS'], skill: 'se:top-level' });
    expect(out).toContain('se:top-level');
    expect(out).toContain('SYS as a blackbox');
  });

  it('seed:uc traegt se:author-uc', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['SYS', 'UC'], skill: 'se:author-uc' });
    expect(out).toContain('se:author-uc');
  });
});

describe('CR-GC-648: ein Null-Delta ist keine Aussage', () => {
  it('die Kante bleibt, die Nullen fallen weg', async () => {
    const out = await buildRoundInjection(
      registry([vorschlag({ delta: [0, 0, 0, -0.0001, 0, 0] })]),
      { focusTypes: ['FUNC'], skill: 'se:top-level' },
    );
    expect(out).toContain('FUNC-task-execute -allocate-> MOD-sched');
    expect(out).not.toContain('delta [');
  });
});

describe('CR-GC-651: der injizierte Skill-Ausschnitt passt zum Executor', () => {
  // Vorher kamen author-req und author-uc ganz: commands-JSON als Beispiel (das SYSTEM verlangt
  // seit CR-GC-650 Format-E) und Hinweise auf Werkzeuge, die dem Modell vorenthalten sind.
  for (const [skill, typen] of [['se:author-req', ['UC', 'REQ']], ['se:author-uc', ['UC']]] as const) {
    it(`${skill}: Format-E-Beispiel, kein commands-JSON, keine vorenthaltenen Werkzeuge`, async () => {
      const out = await buildRoundInjection(registry([]), { focusTypes: [...typen], skill });
      const anleitung = out.slice(out.indexOf('Anleitung fuer diese Runde'));
      expect(anleitung).toContain('## Nodes');
      expect(anleitung).not.toContain('"op"');
      expect(anleitung).not.toContain('graph_generate');
      expect(anleitung).not.toContain('rules_get_violations');
      // CR-GC-653: 22 von 22 SCHEMA-Abfragen im Rig kamen leer zurueck — ausgeloest von genau diesem Satz.
      expect(anleitung).not.toContain('{type:"SCHEMA"}');
      // CR-GC-657: eine REQ ohne kinds ist fuer FUNC/MOD/SYS nicht erfuellbar.
      if (skill === 'se:author-req') expect(anleitung).toContain('@kinds ["functional"]');
    });
  }
});

describe('CR-GC-672B: ein add-node-Vorschlag steht als der Batch da, den das Gate bekommt', () => {
  // Vorher: EINE Zeile `FUNC-P -compose-> FUNC-mid` — die gespiegelte edges[0], eine Kante auf
  // einen Knoten, den es noch nicht gibt. Das Modell uebernahm sie, das Gate wies sie ab (R-08);
  // Knoten, weitere Kanten und retires sah es nie.
  const edit: SuggestedEdit = {
    op: 'add-node',
    source: 'FUNC-P', target: 'FUNC-mid', type: 'compose',
    rationale: 'x',
    node: { uid: 'FUNC-mid', type: 'FUNC', name: 'mid', description: 'Zwischenebene.' },
    edges: [
      { source: 'FUNC-P', target: 'FUNC-mid', type: 'compose' },
      { source: 'FUNC-mid', target: 'FUNC-c0', type: 'compose' },
    ],
    retires: [{ source: 'FUNC-P', target: 'FUNC-c0', type: 'compose', rationale: 'umgehaengt' }],
  };
  const bestand: Graph = {
    nodes: ['FUNC-P', 'FUNC-c0'].map((uid) => ({ uid, type: 'FUNC', name: uid, description: '', attributes: {} })),
    edges: [{ sourceId: 'FUNC-P', targetId: 'FUNC-c0', edgeType: 'compose', attributes: {} }],
  };

  it('Knotenzeile, Loeschzeile und alle Kanten — nicht die gespiegelte Einzelkante', async () => {
    const out = await buildRoundInjection(
      registry([vorschlag({ ruleId: 'RD-04', elementId: 'FUNC-P', edit })]),
      { focusTypes: ['FUNC'], skill: 'se:top-level' },
    );
    const block = formatEBlockOf(out, 'RD-04 @ FUNC-P');
    expect(block, 'kein Format-E-Block zum Vorschlag').not.toBeNull();
    expect(block).toContain('## Nodes\n### FUNC\n+ FUNC-mid|Zwischenebene. [__name:mid]');
    expect(block).toContain('- FUNC-P -compose-> FUNC-c0');
    expect(block).toContain('+ FUNC-mid -compose-> FUNC-c0');
    expect(block).toContain('+ FUNC-P -compose-> FUNC-mid');
  });

  it('der gerenderte Block IST batchFor — zurueckgelesen ergibt er dieselben Kommandos', async () => {
    const out = await buildRoundInjection(
      registry([vorschlag({ ruleId: 'RD-04', elementId: 'FUNC-P', edit })]),
      { focusTypes: ['FUNC'], skill: 'se:top-level' },
    );
    const { commands } = formatEToCommands(bestand, formatEBlockOf(out, 'RD-04 @ FUNC-P')!);
    const key = (c: unknown) => JSON.stringify(c);
    expect(commands.map(key).sort()).toEqual(batchFor(edit).map(key).sort());
  });

  it('ein Einzelkanten-Vorschlag mit retire zeigt die Loeschzeile', async () => {
    const umhaengen = vorschlag({
      edit: {
        op: 'add-trace', source: 'FUNC-task-execute', target: 'MOD-sched', type: 'allocate', rationale: 'x',
        retire: { source: 'FUNC-task-execute', target: 'MOD-alt', type: 'allocate', rationale: 'weicht' },
      },
    });
    const out = await buildRoundInjection(registry([umhaengen]), { focusTypes: ['FUNC'], skill: 'se:top-level' });
    const block = formatEBlockOf(out, 'R-22 @ FUNC-task-execute');
    expect(block).toContain('- FUNC-task-execute -allocate-> MOD-alt');
    expect(block).toContain('+ FUNC-task-execute -allocate-> MOD-sched');
  });

  it('merge-nodes steht als ## Merges da, nicht als relation-Kante', async () => {
    const merge = vorschlag({
      ruleId: 'OP-MERGE', elementId: 'FLOW-a',
      edit: {
        op: 'merge-nodes', source: 'FLOW-a', target: 'FLOW-b', type: 'relation', rationale: 'x',
        merges: [{ source: 'SCHEMA-a', target: 'SCHEMA-b', rationale: 'gekoppelt' }],
      },
    });
    const out = await buildRoundInjection(registry([merge]), { focusTypes: ['FLOW'], skill: null });
    const block = formatEBlockOf(out, 'OP-MERGE @ FLOW-a');
    expect(block).toContain('## Merges\nM FLOW-a + FLOW-b\nM SCHEMA-a + SCHEMA-b');
    expect(out).not.toContain('FLOW-a -relation-> FLOW-b');
  });

  it('RD-04 am echten Gate: der injizierte Block besteht den dryRun von graph_mutate', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'graphcode-672b-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    const harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
    try {
      await harness.initialize();
      await harness.importGraph(rd04Fixture());
      const tools = bindToolsToHarness(harness);
      const out = await buildRoundInjection(tools, { focusTypes: ['FUNC'], skill: null });
      const block = formatEBlockOf(out, 'RD-04 @ FUNC-P');
      expect(block, `kein RD-04-Block im Rundeninhalt:\n${out}`).not.toBeNull();
      expect(block).toContain('## Nodes');
      expect(block, 'RD-04 haengt Kinder um — die Loeschzeilen gehoeren in den Block').toMatch(/^- FUNC-P -compose-> FUNC-c\d$/m);
      const res = (await tools.graph_mutate.handler({ formatE: block!, dryRun: true })) as {
        success: boolean; violations?: { ruleId: string; message: string }[];
      };
      expect(res.success, JSON.stringify(res.violations)).toBe(true);
    } finally {
      await harness.close();
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});

/** Der ```format-e-Block, der im Rundeninhalt unter der Vorschlagszeile `kopf` steht. */
function formatEBlockOf(out: string, kopf: string): string | null {
  const ab = out.indexOf(kopf);
  if (ab < 0) return null;
  const m = /```format-e\n([\s\S]*?)\n```/.exec(out.slice(ab));
  return m ? m[1] : null;
}

/** RD-04: `FUNC-P` hat zehn Kinder; vier reichen einander Daten weiter (wie tests/suggest.add-node.test.ts). */
function rd04Fixture(): FixtureGraph {
  const kids = Array.from({ length: 10 }, (_, i) => `FUNC-c${i}`);
  const elements: FixtureGraph['elements'] = [
    { id: 'FUNC-P', type: 'FUNC', name: 'P', description: 'Eltern mit zu vielen Kindern.' },
    ...kids.map((id) => ({ id, type: 'FUNC', name: id, description: `Kind ${id}.` })),
  ];
  const traces: FixtureGraph['traces'] = kids.map((c) => ({ source: 'FUNC-P', target: c, type: 'compose' }));
  for (let i = 0; i < 3; i++) {
    const flow = `FLOW-k${i}`;
    const schema = `SCHEMA-k${i}`;
    elements.push(
      { id: flow, type: 'FLOW', name: flow, description: `Uebergabe ${i}.` },
      { id: schema, type: 'SCHEMA', name: schema, description: `Vertrag ${i}.` },
    );
    traces.push(
      { source: `FUNC-c${i}`, target: flow, type: 'io' },
      { source: flow, target: `FUNC-c${i + 1}`, type: 'io' },
      { source: flow, target: schema, type: 'relation' },
    );
  }
  return { elements, traces };
}
