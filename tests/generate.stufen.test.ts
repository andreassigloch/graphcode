/**
 * CR-GC-749 — der Schritt waehlt nach STUFE, und der Kaltstart kommt aus den Existenz-Regeln.
 *
 * Bis hierher waehlte `generationStep` die schwaechste Readiness-Dimension und darin die Regel; die
 * Kaltstart-Stufen („kein System", „kein Anwendungsfall") standen als eigene Zustandstests im Code.
 * Mit contracts 11 (CR-SM-395) traegt jede Regel ihre Stufe und ihre Rolle am Katalog:
 *   - der naechste Schritt ist das erste Fenster in der Reihenfolge der Stufen, frueheste zuerst;
 *   - in einer Stufe steht die Existenz-Regel vorn — sie verlangt die Menge, ueber die die uebrigen urteilen;
 *   - „kein System" ist der Befund von R-33, „das System hat nichts unter sich" der von R-17.
 * Es bleibt bei EINER Regel und hoechstens drei Elementen je Schritt (CR-GC-290).
 *
 * Eigenschaften ueber echte Graphen (die Referenzlaeufe des Rigs, das Golden) und kleine Fixtures. Stufe
 * und Rolle werden aus dem Katalog gelesen, keine Regel-Reihenfolge steht hier.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ALL_RULE_DEFS, DEFAULT_METRIC_POLICY, STAGE_SETS } from '@sigloch/contracts/se';
import type { Graph } from '@sigloch/graph-api-core';
import { generationStep, SEED_RULE } from '../src/loop/generate.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
type Flat = { elements: { id: string; type: string; name?: string; description?: string; attributes?: Record<string, unknown>; [k: string]: unknown }[]; traces: { source: string; target: string; type: string; label?: string }[] };

/** Der flache Export als Harness-Graph — dieselbe Hebung wie in generate.statemachine.test.ts. */
function alsGraph(g: Flat): Graph {
  const KNOWN = new Set(['id', 'type', 'name', 'description', 'attributes']);
  return {
    nodes: g.elements.map((e) => {
      const attrs: Record<string, unknown> = { ...(e.attributes ?? {}) };
      for (const [k, v] of Object.entries(e)) if (!KNOWN.has(k)) attrs[k] = v;
      return { uid: e.id, type: e.type, name: e.name ?? e.id, description: e.description ?? '', attributes: attrs };
    }),
    edges: g.traces.map((t) => ({ sourceId: t.source, targetId: t.target, edgeType: t.type, attributes: t.label ? { label: t.label } : {} })),
  } as never;
}
const lade = (rel: string): Graph => alsGraph(JSON.parse(readFileSync(ROOT + rel, 'utf8')) as Flat);

const n = (uid: string, type: string, description = `Das System muss ${uid} leisten.`, attributes: Record<string, unknown> = {}) =>
  ({ uid, type, name: uid, description, attributes });
const e = (sourceId: string, targetId: string, edgeType: string) => ({ sourceId, targetId, edgeType, attributes: {} });
const g = (nodes: unknown[], edges: unknown[] = []): Graph => ({ nodes, edges }) as Graph;

const DEF = new Map(ALL_RULE_DEFS.map((r) => [r.id, r]));
/** Rang einer Regel in der Reihenfolge der Stufen — `immer` gilt an jeder Stufe, also schon vor der ersten. */
const rang = (ruleId: string): number => {
  const st = DEF.get(ruleId)!.stage;
  return st === 'immer' ? 0 : st;
};
const istExistenz = (ruleId: string): boolean => DEF.get(ruleId)!.role === 'existence';
const INTENT = 'Ein Werkzeug, das Aufgaben auf der Kommandozeile verwaltet.';
const step = (graph: Graph, defer: string[] = []) => generationStep(graph, DEFAULT_METRIC_POLICY, INTENT, 0.8, defer);
const regelVon = (focusKey: string): string => focusKey.split(':')[1]!;

/** Alle Fenster eines Graphen in der Reihenfolge, in der der Schritt sie stellt (jedes wird nach Erscheinen zurueckgestellt). */
function fensterfolge(graph: Graph): string[] {
  const folge: string[] = [];
  let cur = step(graph);
  while (cur.focusKey && folge.length < 400) {
    folge.push(cur.focusKey);
    cur = step(graph, folge);
  }
  return folge;
}

const KORPUS: [string, Graph][] = [
  ['Referenz lokal', lade('beispielgraphen/todo-referenz/lokal/graph.json')],
  ['Referenz frontier (nur Entscheidungs-Auftraege)', lade('beispielgraphen/todo-referenz/frontier/graph.json')],
  ['Golden sigllm v98', lade('beispielgraphen/sigllm-v98.graph.json')],
];

describe('CR-GC-749: der Schritt waehlt die frueheste Stufe', () => {
  it.each(KORPUS)('%s: das erste Fenster liegt an der fruehesten Stufe, an der ueberhaupt ein Fund im Fokus steht', (_name, graph) => {
    const fokus = takeSteeringSnapshot(graph, DEFAULT_METRIC_POLICY).focus;
    expect(fokus.length).toBeGreaterThan(0);
    const frueheste = Math.min(...fokus.map((v) => rang(v.rule_id)));
    const erster = step(graph);
    expect(erster.focusKey).not.toBeNull();
    expect(rang(regelVon(erster.focusKey!))).toBe(frueheste);
  });

  it.each(KORPUS)('%s: die Fenster kommen in der Reihenfolge der Stufen — nie eine fruehere nach einer spaeteren', (_name, graph) => {
    const stufen = fensterfolge(graph).map((k) => rang(regelVon(k)));
    expect(stufen.length).toBeGreaterThan(1);
    expect(stufen).toEqual([...stufen].sort((a, b) => a - b));
  });

  it.each(KORPUS)('%s: in einer Stufe steht die Existenz-Regel vor den uebrigen', (_name, graph) => {
    const folge = fensterfolge(graph).map(regelVon);
    for (let i = 1; i < folge.length; i++) {
      if (rang(folge[i]!) !== rang(folge[i - 1]!)) continue;
      expect(istExistenz(folge[i]!) && !istExistenz(folge[i - 1]!), `${folge[i - 1]} vor ${folge[i]}`).toBe(false);
    }
  });

  it('ein Fenster traegt weiter genau EINE Regel und hoechstens drei Elemente', () => {
    for (const [, graph] of KORPUS) {
      for (const key of fensterfolge(graph)) {
        const [, , elemente] = key.split(':');
        expect(elemente!.split(',').length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('der Prompt nennt die Stufe beim Namen ihrer Menge — nicht mehr eine „schwaechste Dimension"', () => {
    const graph = KORPUS[0]![1];
    const s = step(graph);
    const st = DEF.get(regelVon(s.focusKey!))!.stage;
    expect(st).not.toBe('immer');
    expect(s.prompt).toContain(`Stufe: ${STAGE_SETS[(st as number) - 1]}.`);
    expect(s.prompt).not.toContain('Schwächste Dimension');
  });

  it('ein offener Auftrag: die Bindungsbefunde stehen im Fokus, aber erst nach allem, was vor dem Bau liegt', () => {
    // Die Referenz traegt nur erledigte Auftraege (Entscheidungen); ein erledigter Auftrag eroeffnet den Bau nicht.
    expect(fensterfolge(KORPUS[1]![1]).map(regelVon).filter((r) => rang(r) === 11)).toEqual([]);
    const basis = KORPUS[1]![1];
    const func = basis.nodes.find((x) => x.type === 'FUNC')!.uid;
    const graph = g([...basis.nodes, n('CR-bau', 'CR', 'Baue die Funktion.', { status: 'open' })], [...basis.edges, e('CR-bau', func, 'relation')]);
    const folge = fensterfolge(graph).map(regelVon);
    const bindung = folge.filter((r) => rang(r) === 11);
    expect(bindung.length).toBeGreaterThan(0);
    const ersteBindung = folge.findIndex((r) => rang(r) === 11);
    expect(folge.slice(0, ersteBindung).every((r) => rang(r) < 11)).toBe(true);
  });
});

describe('CR-GC-749: der Kaltstart kommt aus den Existenz-Regeln', () => {
  const meldet = (graph: Graph, ruleId: string): boolean =>
    takeSteeringSnapshot(graph, DEFAULT_METRIC_POLICY).focus.some((v) => v.rule_id === ruleId);

  it('die Kaltstart-Stufen haengen an Existenz-Regeln des Katalogs', () => {
    for (const ruleId of Object.values(SEED_RULE)) expect(DEF.get(ruleId)?.role, ruleId).toBe('existence');
    // System vor Anwendungsfall vor Akteur: die Reihenfolge der Kaltstart-Stufen ist die der Regel-Stufen.
    const stufen = [SEED_RULE.sys, SEED_RULE.uc, SEED_RULE.actor].map(rang);
    expect(stufen).toEqual([...stufen].sort((a, b) => a - b));
  });

  it('leerer Graph: der Befund ist „es gibt kein System" — der Schritt verlangt die SYS-Wurzel', () => {
    const leer = g([]);
    expect(meldet(leer, SEED_RULE.sys)).toBe(true);
    const s = step(leer);
    expect(s).toMatchObject({ phase: 'seed', focusStage: 'seed:sys', focusTypes: ['SYS'], focusKey: null });
    expect(s.prompt).toContain('Lege GENAU EIN Element an: die SYS-Wurzel');
    // ohne Intention fragt er zuerst danach — der Befund ist derselbe
    expect(generationStep(leer, DEFAULT_METRIC_POLICY, undefined, 0.8)).toMatchObject({ phase: 'seed', focusStage: null });
  });

  it('Elemente ohne System (Import): derselbe Befund, derselbe Schritt — und mit SYS nicht mehr', () => {
    const ohneSys = g([n('REQ-r', 'REQ', undefined, { kinds: ['functional'] }), n('TEST-t', 'TEST')], [e('TEST-t', 'REQ-r', 'verify')]);
    expect(meldet(ohneSys, SEED_RULE.sys)).toBe(true);
    expect(step(ohneSys).focusStage).toBe('seed:sys');
    const mitSys = g([n('SYS-x', 'SYS'), ...ohneSys.nodes], ohneSys.edges);
    expect(meldet(mitSys, SEED_RULE.sys)).toBe(false);
    expect(step(mitSys).focusStage).not.toBe('seed:sys');
  });

  // Der Ausloeser ist die REGEL, nicht ein eigener Zustandstest. Ob R-17 auch dann meldet, wenn das System
  // etwas anderes als Anwendungsfaelle unter sich hat, entscheidet der Katalog (CR-SM-395 §10.5) — die Faelle
  // lesen deshalb, ob die Regel meldet, und verlangen nur die Gleichheit.
  const FAELLE: [string, Graph][] = [
    ['SYS allein', g([n('SYS-x', 'SYS')])],
    ['SYS mit Anwendungsfall darunter', g([n('SYS-x', 'SYS'), n('UC-a', 'UC')], [e('SYS-x', 'UC-a', 'compose')])],
    ['SYS und ein Anwendungsfall, der nicht darunter haengt', g([n('SYS-x', 'SYS'), n('UC-a', 'UC')])],
    ['SYS mit einer Anforderung darunter, kein Anwendungsfall', g(
      [n('SYS-x', 'SYS'), n('REQ-r', 'REQ', undefined, { kinds: ['non-functional'] }), n('TEST-t', 'TEST')],
      [e('SYS-x', 'REQ-r', 'compose'), e('SYS-x', 'REQ-r', 'satisfy'), e('TEST-t', 'REQ-r', 'verify')],
    )],
  ];
  it.each(FAELLE)('%s: die Stufe „Anwendungsfaelle" steht nur an, wenn die Existenz-Regel des Systems meldet — und dann, wenn keine andere der Stufe vor ihr steht', (_name, graph) => {
    const stufeUc = step(graph).focusStage === 'seed:uc';
    // notwendig: ohne Befund der Regel keine Stufe — auch dort, wo der alte Zustandstest („kein UC") sie stellte.
    if (stufeUc) expect(meldet(graph, SEED_RULE.uc)).toBe(true);
    // hinreichend, sobald sie die einzige meldende Existenz-Regel ihrer Stufe ist. Melden zwei (die UCs stehen,
    // haengen aber nicht am System, und keiner hat einen Akteur), entscheidet die Ordnung innerhalb der Stufe.
    const andereDerStufe = ALL_RULE_DEFS
      .filter((r) => r.role === 'existence' && r.stage === DEF.get(SEED_RULE.uc)!.stage && r.id !== SEED_RULE.uc)
      .some((r) => meldet(graph, r.id));
    if (!andereDerStufe) expect(stufeUc).toBe(meldet(graph, SEED_RULE.uc));
  });

  it('SYS allein: die Regel meldet, der Schritt destilliert die Anwendungsfaelle — Text wie bisher', () => {
    const s = step(FAELLE[0]![1]);
    expect(s).toMatchObject({ phase: 'seed', focusStage: 'seed:uc', focusTypes: ['SYS', 'UC'], focusKey: null, skill: 'se:author-uc' });
    expect(s.prompt).toContain('Die SYS-Wurzel steht. Destilliere daraus 3–7 UCs');
  });

  it('Anwendungsfaelle ohne Akteur, noch keine Struktur: die Existenz-Regel des Akteurs stellt das Fenster — der Schritt schneidet die Akteure', () => {
    const graph = FAELLE[1]![1];
    expect(meldet(graph, SEED_RULE.actor)).toBe(true);
    const s = step(graph);
    expect(s).toMatchObject({ phase: 'seed', focusStage: 'seed:actor', focusTypes: ['ACTOR', 'UC'], focusKey: null });
    expect(s.prompt).toContain('Bestimme jetzt das MINIMUM');
  });

  it('mit Akteur oder begonnener Struktur ist es kein Kaltstart mehr: dieselbe Regel stellt ihr gewoehnliches Fenster', () => {
    const mitAkteur = g([n('SYS-x', 'SYS'), n('UC-a', 'UC'), n('ACTOR-k', 'ACTOR')], [e('SYS-x', 'UC-a', 'compose')]);
    const a = step(mitAkteur);
    expect(a.phase).toBe('expand');
    expect(regelVon(a.focusKey!)).toBe(SEED_RULE.actor);
    const mitStruktur = g([n('SYS-x', 'SYS'), n('UC-a', 'UC'), n('FUNC-f', 'FUNC')], [e('SYS-x', 'UC-a', 'compose')]);
    expect(step(mitStruktur).phase).toBe('expand');
  });

  it('in einem Arbeitsschritt gilt der Kaltstart des Systems ebenso — ohne System gibt es keine Analyse', () => {
    const s = generationStep(g([]), DEFAULT_METRIC_POLICY, INTENT, 0.8, [], 'host', null, 'fmea');
    expect(s.focusStage).toBe('seed:sys');
  });
});
