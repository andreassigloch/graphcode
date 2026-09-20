/**
 * Abnahme zu CR-GC-556 und CR-GC-557 — was der Rundeninhalt ab Element 1 traegt.
 *
 * Befund aus drei Rig-Laeufen: `graph_suggest` STAND dem Modell offen (toolset 'full')
 * und wurde null Mal gerufen. Der SYSTEM-Prompt verbietet Analyse-Turns ausdruecklich
 * („dann STOPP", „Handeln vor Analysieren") — das Regime haelt kleine Modelle beim Bauen
 * und ist richtig; falsch war der Kanal. Also ruft der Host, und das Ergebnis wird
 * injiziert, wie bei graph_generate und graph_next_step.
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
    const out = await buildRoundInjection(registry([vorschlag()]), { focusTypes: ['FUNC'] });
    expect(out).toContain('FUNC-task-execute -allocate-> MOD-sched');
    expect(out).toContain('R-22 @ FUNC-task-execute');
    expect(out, 'ohne delta ist der Optimizer unsichtbar').toContain('delta [');
  });

  it('ein Vorschlag OHNE Kante bleibt draussen — der fixHint steht schon im Rundenprompt', async () => {
    const ohne = { ...vorschlag() };
    delete (ohne as { edit?: unknown }).edit;
    const out = await buildRoundInjection(registry([ohne]), { focusTypes: ['FUNC'] });
    expect(out).not.toContain('R-22 @');
  });

  it('nur Fokus-Typen — ein UC-Vorschlag taucht in einer FUNC-Runde nicht auf', async () => {
    const fremd = vorschlag({ elementId: 'UC-login', edit: { source: 'UC-login', target: 'FCHAIN-a', type: 'compose' } });
    const out = await buildRoundInjection(registry([fremd]), { focusTypes: ['FUNC'] });
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
    await buildRoundInjection(reg, { focusTypes: ['FUNC'] });
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
    const out = await buildRoundInjection(registry([s]), { focusTypes: ['ACTOR', 'UC', 'FCHAIN', 'FUNC'] });
    expect(out).toContain('FCHAIN-interactive-session -satisfy-> REQ-data-security');
  });

  it('ein kaputter graph_suggest bricht die Runde nicht', async () => {
    const kaputt = {
      graph_suggest: { name: 'x', description: '', inputSchema: z.object({}), handler: () => { throw new Error('boom'); } },
    } as unknown as MCPToolRegistry;
    await expect(buildRoundInjection(kaputt, { focusTypes: ['FUNC'] })).resolves.toBeTypeOf('string');
  });
});

describe('CR-GC-557: der Skill-Rumpf steht im Rundeninhalt statt seiner Adresse', () => {
  it('bei Fokus UC kommt die Stilregel samt Jargon-Budget mit', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['UC'] });
    expect(out).toContain('se:author-uc');
    expect(out, 'die Stilregel ist der Grund fuer den Block').toContain('25');
    expect(out.toLowerCase(), 'das Jargon-Budget steht nirgends sonst').toContain('jargon');
  });

  it('das Frontmatter ist abgeschnitten — es ist Harness-Metadatum, keine Anleitung', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['UC'] });
    expect(out).not.toContain('version: 1');
    expect(out).not.toContain('description: Author a UC node');
  });

  it('hoechstens EIN Skill je Runde, auch bei mehreren Fokus-Typen', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['UC', 'REQ'] });
    expect(out.match(/Anleitung fuer den Fokus-Typ/g) ?? []).toHaveLength(1);
  });

  it('ein Fokus-Typ ohne Autorier-Skill bekommt keinen Block', async () => {
    const out = await buildRoundInjection(registry([]), { focusTypes: ['MOD'] });
    expect(out).not.toContain('Anleitung fuer den Fokus-Typ');
  });
});
