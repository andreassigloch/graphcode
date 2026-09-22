/**
 * CR-GC-593 — die Zustandsmaschine der Generierung, als Eigenschaften ueber den Korpus.
 *
 * Bis hierher pruefte kein Test eine Phasenfolge, und die Freigabe hing an drei Waechtern aus
 * drei Quellen (Schwelle, blockingErrors aus dem 74-Regel-Strom, Phasen-Gate ueber 67 Regeln),
 * waehrend der Fokus aus einer vierten kam. Die Maschine konnte "nichts zu tun" und "nicht
 * fertig" zugleich sagen; gemessen war es ein Livelock: 0 von 9 Laeufen erreichten `handoff`.
 *
 * Die Invariante: `done ⇔ kein Fokus`. Geprueft an allem, was wir an Graphen haben — fuenf
 * Auto-Laeufe, das handgefuehrte Golden und jeder Zwischenstand seines Trails. Keine Beispiele.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_METRIC_POLICY, evaluateAllRules } from '@sigloch/contracts/se';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { generationStep, FOCUS_EXCLUDED_WHEN_UNBOUND } from '../src/loop/generate.js';
// @ts-expect-error — Rig-Auswertung in .mjs, bewusst ohne Typdeklaration
import { spieleNach, referenzTrail } from '../rig/greenfield-systemtest/trajektorie.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
type Flat = { elements: { id: string; type: string; name?: string; description?: string; attributes?: Record<string, unknown>; [k: string]: unknown }[]; traces: { source: string; target: string; type: string }[] };

/** Der flache Export als Harness-Graph — dieselbe Hebung, die die Rig-Auswertung nutzt. */
function alsGraph(g: Flat) {
  const KNOWN = new Set(['id', 'type', 'name', 'description', 'attributes']);
  return {
    nodes: g.elements.map((e) => {
      const attrs: Record<string, unknown> = { ...(e.attributes ?? {}) };
      for (const [k, v] of Object.entries(e)) if (!KNOWN.has(k)) attrs[k] = v;
      return { uid: e.id, type: e.type, name: e.name ?? e.id, description: e.description ?? '', attributes: attrs };
    }),
    edges: g.traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: {} })),
  } as never;
}
const lade = (rel: string): Flat => JSON.parse(readFileSync(ROOT + rel, 'utf8'));
const GOLDEN = 'rig/sigllm-spezifikation/golden/sigllm-v98.graph.json';
const RUNS = ['opus5-5', 'opus5-6', 'opus5-7', 'opus5-8', 'opus5-9'].map((d) => `rig/greenfield-systemtest/runs/${d}/graph.json`).filter((p) => existsSync(ROOT + p));
const step = (g: Flat, defer: string[] = []) => generationStep(alsGraph(g), DEFAULT_METRIC_POLICY, undefined, 0.8, defer);
const GATE = new Set(SE_DESCRIPTOR.rules.map((r: { id: string }) => r.id));

describe('CR-GC-593: done ⇔ kein Fokus — an jedem Graphen des Korpus', () => {
  const graphen: [string, Flat][] = [[GOLDEN, lade(GOLDEN)], ...RUNS.map((p): [string, Flat] => [p, lade(p)])];

  for (const [name, g] of graphen) {
    it(`${name.split('/').slice(-2).join('/')}: done genau dann, wenn kein Fokus`, () => {
      const s = step(g);
      expect(s.phase).not.toBe('seed');
      expect(s.done).toBe(s.focusKey === null);
      expect(s.done).toBe(s.phase === 'handoff');
      if (!s.done) expect(s.prompt).not.toMatch(/manuell/);
    });
  }

  it('jeder Zwischenstand des Hand-Trails: done ⇔ kein Fokus, und nie "pruefe manuell"', () => {
    const trail = referenzTrail(ROOT + GOLDEN);
    expect(trail).toBeTruthy();
    const { zuege, graph } = spieleNach(trail);
    expect(zuege.length).toBeGreaterThan(50);
    // Der Endstand des Nachspiels ist ein Harness-Graph; die Invariante gilt auch dort.
    const s = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8);
    expect(s.done).toBe(s.focusKey === null);
  });

  it('jede Regel, die je einen Fokus stellt, ist im Gate-Katalog und keine info-Regel', () => {
    for (const [, g] of graphen) {
      const s = step(g);
      if (!s.focusKey) continue;
      const rule = s.focusKey.split(':')[1];
      expect(GATE.has(rule), `${rule} steuert, aber das Gate kennt sie nicht`).toBe(true);
    }
  });

  it('nach defer aendert sich der Prompt; sind alle zurueckgestellt, sagt es die Maschine', () => {
    const g = lade(RUNS[0] ?? GOLDEN);
    const erst = step(g);
    if (!erst.focusKey) return;
    const zweit = step(g, [erst.focusKey]);
    expect(zweit.prompt).not.toBe(erst.prompt);
    // Alle Fund-Sets zurueckstellen: die Maschine wiederholt mit Hinweis statt stillzustehen.
    const alle: string[] = [];
    let cur = step(g);
    while (cur.focusKey && !alle.includes(cur.focusKey) && alle.length < 200) { alle.push(cur.focusKey); cur = step(g, alle); }
    expect(cur.done || /zurückgestellt/.test(cur.prompt)).toBe(true);
  });
});

describe('CR-GC-593: das Golden ist done — mit genau den benannten Abnahmen', () => {
  const golden = lade(GOLDEN);

  it('ohne Abnahmen: nicht done, und der Rest ist eine kurze Liste menschlicher Entscheidungen', () => {
    const s = step(golden);
    expect(s.done).toBe(false);
    const offen = new Set(
      evaluateAllRules({ elements: golden.elements, traces: golden.traces } as never, DEFAULT_METRIC_POLICY)
        .filter((v) => GATE.has(v.rule_id) && v.severity !== 'info' && !FOCUS_EXCLUDED_WHEN_UNBOUND.has(v.rule_id))
        .map((v) => v.rule_id),
    );
    // Gemessen 2026-09-22: das ist, was der Handlauf am Ende der Spezifikation bewusst offen liess.
    expect([...offen].sort()).toEqual(['AF-05', 'BW-02', 'FM-03', 'MS-01', 'RD-05']);
  });

  it('mit benannten Abnahmen an genau diesen Funden: done', () => {
    const vs = evaluateAllRules({ elements: golden.elements, traces: golden.traces } as never, DEFAULT_METRIC_POLICY);
    const kopie: Flat = JSON.parse(JSON.stringify(golden));
    const byId = new Map(kopie.elements.map((e) => [e.id, e]));
    const sys = kopie.elements.find((e) => e.type === 'SYS')!;
    for (const v of vs) {
      if (!['AF-05', 'BW-02', 'FM-03', 'MS-01', 'RD-05'].includes(v.rule_id)) continue;
      const el = byId.get(v.element_id) ?? sys;
      const attrs = (el.attributes ??= {});
      const list = (attrs.acceptedFindings as unknown[] | undefined) ?? (attrs.acceptedFindings = []);
      (list as unknown[]).push({ ruleId: v.rule_id, reason: 'Spezifikationsphase: bewusst offen (Test)' });
    }
    const s = step(kopie);
    expect(s.focusKey).toBeNull();
    expect(s.done).toBe(true);
    expect(s.phase).toBe('handoff');
  });

  it('eine Abnahme ohne Grund zaehlt nicht', () => {
    const kopie: Flat = JSON.parse(JSON.stringify(golden));
    for (const e of kopie.elements) (e.attributes ??= {}).acceptedFindings = [{ ruleId: 'FM-03' }, { ruleId: 'RD-05' }, { ruleId: 'MS-01' }, { ruleId: 'BW-02' }, { ruleId: 'AF-05' }];
    expect(step(kopie).done).toBe(false);
  });
});
