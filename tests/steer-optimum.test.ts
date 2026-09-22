/**
 * CR-GC-608 — das Fertig-Kriterium der Steuerregeln: Kreis oder Plateau ueber k = 3 Steuerzuege ist
 * ein lokales Optimum — die Steuerregeln verlassen den Fokus, die Maschine meldet `done` mit Vermerk.
 *
 * opus5-15: der R-04-Tausch erzeugte den CR-01-Ueberschuss, die Abbruchregel stellte CR-01 zurueck,
 * Ende `stalled` ("uebergib an den Menschen"). opus5-11: R-04 sechsmal ohne Bewegung.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { STEER_RULES } from '@sigloch/se-engine';
import { lokalesOptimum, stepWithMemory, type FocusMemory, type SteerOptimum, type SteerState } from '../src/loop/stagnation.js';
import { generationStep, steuerVermerk, type GenerationStep } from '../src/loop/generate.js';

const z = (key: string, sum: number): SteerState => ({ key, sum, terms: key ? key.split('|') : [] });

describe('CR-GC-608: lokalesOptimum (rein)', () => {
  it('Kreis: A → B → A — der Ueberschuss wandert nur', () => {
    expect(lokalesOptimum([z('R-04@m1', 1), z('CR-01@m1', 1), z('R-04@m1', 1)])).toBe('kreis');
  });
  it('Plateau: ueber drei Steuerzuege weniger als 5 % gesenkt', () => {
    expect(lokalesOptimum([z('a', 1), z('b', 0.99), z('c', 0.98), z('d', 0.97)])).toBe('plateau');
  });
  it('echte Verbesserung ist kein Optimum', () => {
    expect(lokalesOptimum([z('a', 2), z('b', 1.5), z('c', 1), z('d', 0.5)])).toBeNull();
  });
  it('ein Zug ohne Aenderung ist noch nichts (die Abbruchregel erlaubt ihn auch)', () => {
    expect(lokalesOptimum([z('a', 1), z('a', 1)])).toBeNull();
  });
  it('ohne Ueberschuss gibt es nichts zu optimieren', () => {
    expect(lokalesOptimum([z('', 0), z('', 0), z('', 0), z('', 0)])).toBeNull();
  });
});

describe('CR-GC-608: das Sitzungsgedaechtnis zaehlt nur Steuerzuege', () => {
  const neu = (): FocusMemory => ({ task: 'kern', last: null, deferred: new Set(), steerVerlauf: [], steerOptimum: null });
  /** Ein Schritt: Fokus je nach Optimum, Steuerzustand fest (kein Zug senkt ihn). */
  const rechner = (fokusOhneOptimum: string) => {
    const aufrufe: (SteerOptimum | null)[] = [];
    const compute = (_defer: string[], optimum: SteerOptimum | null): GenerationStep => {
      aufrufe.push(optimum);
      return {
        phase: optimum ? 'handoff' : 'expand', done: !!optimum, prompt: '', readiness: [], threshold: 0.8,
        blockingErrors: 0, phaseReadiness: [], focusKey: optimum ? null : fokusOhneOptimum, focusTypes: [],
        focusDimension: null, skill: null, steer: z('R-04@MOD-a (0.50)', 0.5),
      };
    };
    return { compute, aufrufe };
  };

  it('drei Steuerzuege ohne Wirkung: Optimum (Plateau), die Maschine meldet done — nie stalled', () => {
    const m = neu();
    const { compute } = rechner('alloc:R-04:MOD-a');
    let s = stepWithMemory(m, 1, compute);
    for (let v = 2; v <= 4 && !s.done; v++) s = stepWithMemory(m, v, compute);
    expect(m.steerOptimum?.grund).toBe('plateau');
    expect(s.done).toBe(true);
    expect(s.phase).toBe('handoff');
  });

  it('die Abbruchregel stellt einen Steuerfokus NICHT zurueck — das Fertig-Kriterium ist zustaendig', () => {
    const m = neu();
    const { compute } = rechner('alloc:R-04:MOD-a');
    for (let v = 1; v <= 3; v++) stepWithMemory(m, v, compute);
    expect(m.deferred.size).toBe(0);
  });

  it('Zuege bei einem Nicht-Steuerfokus zaehlen nicht (REQ-Arbeit ist kein Plateau)', () => {
    const m = neu();
    const { compute } = rechner('req:RD-01:REQ-a');
    for (let v = 1; v <= 6; v++) stepWithMemory(m, v, compute);
    expect(m.steerOptimum).toBeNull();
  });
});

describe('CR-GC-608: am Golden (sigllm v98, Steueranker BW-02 0,5)', () => {
  type Flat = { elements: { id: string; type: string; name?: string; description?: string; attributes?: Record<string, unknown>; [k: string]: unknown }[]; traces: { source: string; target: string; type: string }[] };
  const g: Flat = JSON.parse(readFileSync(fileURLToPath(new URL('../rig/sigllm-spezifikation/golden/sigllm-v98.graph.json', import.meta.url)), 'utf8'));
  const graph = {
    nodes: g.elements.map((e) => {
      const attrs: Record<string, unknown> = { ...(e.attributes ?? {}) };
      for (const [k, v] of Object.entries(e)) if (!['id', 'type', 'name', 'description', 'attributes'].includes(k)) attrs[k] = v;
      return { uid: e.id, type: e.type, name: e.name ?? e.id, description: e.description ?? '', attributes: attrs };
    }),
    edges: g.traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: {} })),
  } as never;
  const istSteuer = (key: string | null) => !!key && (STEER_RULES as readonly string[]).includes(key.split(':')[1] ?? '');

  it('der Schritt traegt den Steuerzustand; am Optimum steht keine Steuerregel mehr im Fokus', () => {
    const ohne = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'kern');
    expect(ohne.steer!.sum).toBeGreaterThan(0);
    const optimum: SteerOptimum = { grund: 'kreis', sum: ohne.steer!.sum, terms: ohne.steer!.terms };
    let s = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', null, 'kern', optimum);
    const defer: string[] = [];
    while (s.focusKey && defer.length < 80) {
      expect(istSteuer(s.focusKey)).toBe(false);
      defer.push(s.focusKey);
      s = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, defer, 'host', null, 'kern', optimum);
    }
  });

  it('done nennt die Terme am Optimum und wohin es weitergeht', () => {
    expect(steuerVermerk(null)).toBe('');
    const v = steuerVermerk({ grund: 'kreis', sum: 1, terms: ['R-04@MOD-a (0.50)', 'CR-01@MOD-b (0.50)'] });
    expect(v).toContain('lokalen Optimum (Kreis über 3 Steuerzüge)');
    expect(v).toContain('R-04@MOD-a (0.50), CR-01@MOD-b (0.50)');
    expect(v).toContain('graph_suggest');
  });
});
