/**
 * CR-GC-593 — die Zustandsmaschine der Generierung, als Eigenschaften ueber den Korpus.
 *
 * Bis hierher pruefte kein Test eine Phasenfolge, und die Freigabe hing an drei Waechtern aus
 * drei Quellen (Schwelle, blockingErrors aus dem 74-Regel-Strom, Phasen-Gate ueber 67 Regeln),
 * waehrend der Fokus aus einer vierten kam. Die Maschine konnte "nichts zu tun" und "nicht
 * fertig" zugleich sagen; gemessen war es ein Livelock: 0 von 9 Laeufen erreichten `handoff`.
 *
 * Die Invariante: `done ⇔ kein Fokus`. Geprueft an allem, was wir an Graphen haben — die Referenzlaeufe
 * des Rigs (CR-GC-738, lokal und frontier), das handgefuehrte Golden und der Endstand seines Trails. Keine Beispiele.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_METRIC_POLICY, evaluateAllRules, TASK_ENTRY } from '@sigloch/contracts/se';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { generationStep } from '../src/loop/generate.js';
import { ABNEHMBAR, focusViolations } from '../src/kernel/measure/focus-set.js';
// @ts-expect-error — Rig-Auswertung in .mjs, bewusst ohne Typdeklaration
import { nachspielenRein } from '../auswertung/nachspielen.mjs';
// @ts-expect-error — Migrationswerkzeug in .mjs (CR-GC-669), bewusst ohne Typdeklaration
import { proposeDecisions, buildCommands } from '../scripts/migrate-req-kinds.mjs';
import { applyCommands } from '../src/kernel/apply-commands.js';

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
const GOLDEN = 'beispielgraphen/sigllm-v98.graph.json';
/**
 * Ein Lauf-Graph wird nicht umgeschrieben — Messdaten bleiben, wie sie gemessen wurden —, sondern beim Laden
 * im Speicher durch dasselbe Werkzeug migriert, das die SSOTs migriert (CR-GC-669): Vorschlag, Batch,
 * Anwendung. Eine offene Entscheidung wirft; nichts faellt still weg. Die Referenzlaeufe von heute brauchen
 * keine Migration; der Pfad bleibt fuer die naechste Grammatik.
 */
function ladeLauf(rel: string): Flat {
  const g = lade(rel);
  const entscheidungen = proposeDecisions(g);
  if (entscheidungen.length === 0) return g;
  const { graph } = applyCommands(alsGraph(g), buildCommands(entscheidungen, alsGraph(g), { acceptHeuristic: true }));
  const { nodes, edges } = graph as unknown as {
    nodes: { uid: string; type: string; name: string; description: string; attributes: Record<string, unknown> }[];
    edges: { sourceId: string; targetId: string; edgeType: string }[];
  };
  return {
    elements: nodes.map((n) => ({ id: n.uid, type: n.type, name: n.name, description: n.description, attributes: n.attributes })),
    traces: edges.map((e) => ({ source: e.sourceId, target: e.targetId, type: e.edgeType })),
  };
}
/** Die Referenzlaeufe des Rigs — committet, einer je Arm (rig/README.md „Referenzlauf"). */
const RUNS = ['lokal', 'frontier'].map((arm) => `rig/aufgaben/todo/referenz/${arm}/graph.json`).filter((p) => existsSync(ROOT + p));
const step = (g: Flat, defer: string[] = []) => generationStep(alsGraph(g), DEFAULT_METRIC_POLICY, undefined, 0.8, defer);
const GATE = new Set(SE_DESCRIPTOR.rules.map((r: { id: string }) => r.id));

describe('CR-GC-593: done ⇔ kein Fokus — an jedem Graphen des Korpus', () => {
  const graphen: [string, Flat][] = [[GOLDEN, lade(GOLDEN)], ...RUNS.map((p): [string, Flat] => [p, ladeLauf(p)])];

  for (const [name, g] of graphen) {
    it(`${name.split('/').slice(-2).join('/')}: done genau dann, wenn kein Fokus`, () => {
      const s = step(g);
      expect(s.phase).not.toBe('seed');
      expect(s.done).toBe(s.focusKey === null);
      expect(s.done).toBe(s.phase === 'handoff');
      if (!s.done) expect(s.prompt).not.toMatch(/manuell/);
    });
  }

  it('der Endstand des Hand-Trails, nachgespielt: done ⇔ kein Fokus', async () => {
    // CR-GC-737: das Audit des Golden liegt neben ihm als <name>.audit.jsonl.
    const trail = ROOT + GOLDEN.replace(/\.graph\.json$/, '.audit.jsonl');
    expect(existsSync(trail)).toBe(true);
    const { zuege, graph } = await nachspielenRein(trail);
    expect(zuege).toBeGreaterThan(50);
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
    const g = RUNS[0] ? ladeLauf(RUNS[0]) : lade(GOLDEN);
    const erst = step(g);
    if (!erst.focusKey) return;
    const zweit = step(g, [erst.focusKey]);
    expect(zweit.prompt).not.toBe(erst.prompt);
    // Alle Fund-Sets zurueckstellen: die Maschine wiederholt mit Hinweis statt stillzustehen.
    const alle: string[] = [];
    let cur = step(g);
    while (cur.focusKey && !alle.includes(cur.focusKey) && alle.length < 200) { alle.push(cur.focusKey); cur = step(g, alle); }
    // CR-GC-596: alle zurueckgestellt → stalled (nicht done), nicht mehr "ignorieren und wiederholen".
    expect(cur.done || cur.phase === 'stalled').toBe(true);
    if (cur.phase === 'stalled') { expect(cur.done).toBe(false); expect(cur.focusKey).toBeNull(); }
  });
});

describe('CR-GC-593/594: das Golden und die benannten Abnahmen', () => {
  const golden = lade(GOLDEN);

  const og = { elements: golden.elements, traces: golden.traces } as never;
  const offeneRegeln = (): string[] => [...new Set(focusViolations(og, evaluateAllRules(og, DEFAULT_METRIC_POLICY)).map((v) => v.rule_id))].sort();

  it('ohne Abnahmen: nicht done, und der Rest ist eine kurze Liste', () => {
    const s = step(golden);
    expect(s.done).toBe(false);
    // Gemessen 2026-09-22 (contracts 10): AF-05, BW-02, RD-05 — was der Handlauf am Ende der Spezifikation
    // bewusst offen liess. Gemessen 2026-10-06 (contracts 11, CR-GC-748): dieselben drei, dazu was bis dahin
    // ein Arbeitsschritt dem Kern abnahm — FM-03 (Fehlerbetrachtung), MS-01 (Bauplan) und die Bindung
    // R-19/R-20 (das Golden traegt Bindungen, der Bau ist eroeffnet). TR-01 ist mit Regelkatalog 43 entfallen.
    expect(offeneRegeln()).toEqual(['AF-05', 'BW-02', 'FM-03', 'MS-01', 'R-19', 'R-20', 'RD-05']);
  });

  /** Nimmt an jedem Fund der genannten Regeln ab — am betroffenen Element, graphweit am SYS. */
  const mitAbnahmen = (regeln: string[]): Flat => {
    const vs = evaluateAllRules({ elements: golden.elements, traces: golden.traces } as never, DEFAULT_METRIC_POLICY);
    const kopie: Flat = JSON.parse(JSON.stringify(golden));
    const byId = new Map(kopie.elements.map((e) => [e.id, e]));
    const sys = kopie.elements.find((e) => e.type === 'SYS')!;
    for (const v of vs) {
      if (!regeln.includes(v.rule_id)) continue;
      const attrs = ((byId.get(v.element_id) ?? sys).attributes ??= {});
      ((attrs.acceptedFindings as unknown[] | undefined) ?? (attrs.acceptedFindings = [])) as unknown[];
      (attrs.acceptedFindings as unknown[]).push({ ruleId: v.rule_id, reason: 'Spezifikationsphase: bewusst offen (Test)' });
    }
    return kopie;
  };

  it('CR-GC-594/748: was abnehmbar ist, verschwindet mit der Abnahme aus dem Fokus — der Rest bleibt', () => {
    const abnehmbare = offeneRegeln().filter((r) => ABNEHMBAR.has(r));
    const rest = offeneRegeln().filter((r) => !ABNEHMBAR.has(r));
    expect(abnehmbare.length).toBeGreaterThan(0);
    expect(rest.length).toBeGreaterThan(0);
    const s = step(mitAbnahmen(abnehmbare));
    expect(s.done).toBe(false);
    expect(rest).toContain(s.focusKey!.split(':')[1]);
  });

  it('CR-GC-594: eine Abnahme an einer nicht abnehmbaren Regel zaehlt nicht — das Golden ist heute nicht done, und der Prompt sagt warum', () => {
    const rest = offeneRegeln().filter((r) => !ABNEHMBAR.has(r));
    const s = step(mitAbnahmen(offeneRegeln()));
    expect(s.done).toBe(false);
    const regel = s.focusKey!.split(':')[1];
    expect(rest).toContain(regel);
    expect(s.prompt).toContain(`Die Abnahme von ${regel} zählt nicht`);
  });

  /** Stellt Fenster zurueck, bis eine Regel aus `ziel` den Fokus stellt. */
  const bisFokusAuf = (ziel: (regel: string) => boolean) => {
    let cur = step(golden);
    const defer: string[] = [];
    while (cur.focusKey && !ziel(cur.focusKey.split(':')[1]!) && defer.length < 200) {
      defer.push(cur.focusKey);
      cur = step(golden, defer);
    }
    return cur;
  };
  const eintritte = new Set(Object.values(TASK_ENTRY).filter((e): e is string => e !== null));

  it('CR-GC-594/601: steht der Fokus auf einem Eintrittspunkt, nennt der Prompt den Task UND die Abnahme — zum Zeitpunkt der Entscheidung', () => {
    const cur = bisFokusAuf((r) => eintritte.has(r));
    expect(eintritte.has(cur.focusKey!.split(':')[1]!)).toBe(true);
    expect(cur.prompt).toMatch(/ist der Eintrittspunkt des Tasks/);
    expect(cur.prompt).toMatch(/acceptedFindings mit Grund ab/);
  });

  it('CR-GC-748: steht der Fokus auf einer anderen abnehmbaren Regel, nennt der Prompt die Abnahme ohne Task', () => {
    const cur = bisFokusAuf((r) => ABNEHMBAR.has(r) && !eintritte.has(r));
    const regel = cur.focusKey!.split(':')[1]!;
    expect(ABNEHMBAR.has(regel) && !eintritte.has(regel)).toBe(true);
    expect(cur.prompt).toContain(`${regel} ist abnehmbar`);
    expect(cur.prompt).not.toMatch(/ist der Eintrittspunkt des Tasks/);
  });

  it('eine Abnahme ohne Grund zaehlt nicht', () => {
    const kopie: Flat = JSON.parse(JSON.stringify(golden));
    for (const e of kopie.elements) (e.attributes ??= {}).acceptedFindings = [{ ruleId: 'RD-05' }, { ruleId: 'BW-02' }, { ruleId: 'AF-05' }];
    expect(step(kopie).done).toBe(false);
  });
});
