/**
 * CR-GC-846 — `src/kernel/call-edges.ts`: welche Aufrufkanten der Lieferant für RC-12/RC-13 erzeugt.
 *
 * Ein Wegwerf-Repo mit echtem TypeScript-Quellbaum. Je Fall eine Kante: direkter Aufruf, Methode einer Klasse,
 * Aufruf über ein Interface, das eine Klasse nur strukturell erfüllt, über einen abgeleiteten Typ (`Pick`), Aufruf
 * eines destrukturierten Namens — und ein Versand über eine Signatur mit zwei Implementierungen, der keine Kante
 * erzeugt. Das Urteil über die Kanten testet contracts (CR-SM-415); hier steht nur, dass es in graphcode ankommt:
 * ein absichtlich falscher Abnehmer gibt RC-12, ein Aufruf ohne Fluss RC-13.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCallFacts } from '../src/kernel/call-edges.js';
import { conformanceEvaluation } from '../src/kernel/conformance.js';

const QUELLE = `
export function anfrage(): void { mitte(); }
export function mitte(): void { ziel(); }
export function ziel(): void {}
export function allein(): void {}

export interface Werk { lauf(): void }
export class Maschine { lauf(): void { ziel(); } }
export function treiber(w: Werk): void { w.lauf(); }
export function auswahl(w: Pick<Werk, 'lauf'>): void { w.lauf(); }

export interface Werkzeug { handler(): void }
export const eins: Werkzeug = { handler() { ziel(); } };
export const zwei: Werkzeug = { handler() { allein(); } };
export function versand(t: Werkzeug): void { t.handler(); }

export interface Kontext { melde(): void }
export function werkzeug(ctx: Kontext): void {
  const { melde } = ctx;
  melde();
}
export function kontext(): Kontext {
  function melde(): void {}
  return { melde };
}
`;

const edge = (from: string, to: string) => ({ from: { file: 'src/a.ts', symbol: from }, to: { file: 'src/a.ts', symbol: to } });

let repo: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'call-edges-'));
  mkdirSync(join(repo, 'src'));
  mkdirSync(join(repo, 'scripts'));
  writeFileSync(join(repo, 'src', 'a.ts'), QUELLE);
  writeFileSync(join(repo, 'scripts', 'werk.mjs'), 'export function lauf() {}\n');
  writeFileSync(
    join(repo, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ES2020', strict: true }, include: ['src/**/*'] }),
  );
}, 60_000);

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('call-edges: der Lieferant der Aufrufkanten (CR-GC-846)', () => {
  it('liefert je Aufruf eine Kante, das Symbol ist der Pfad der Deklaration', () => {
    expect(extractCallFacts(repo)!.callEdges).toEqual([
      // Eine Methode heißt nach ihrer Klasse, ein Handler nach seinem Objekt.
      edge('Maschine.lauf', 'ziel'),
      edge('anfrage', 'mitte'),
      // `Pick<Werk, 'lauf'>` endet an der Signatur und geht weiter an die Klasse.
      edge('auswahl', 'Maschine.lauf'),
      edge('eins.handler', 'ziel'),
      edge('mitte', 'ziel'),
      // `Werk` erfüllt `Maschine` nur strukturell: weiter an die eine Deklaration dieses Namens.
      edge('treiber', 'Maschine.lauf'),
      // `const { melde } = ctx` erreicht die Funktion hinter der Kurzschreibweise `{ melde }`.
      edge('werkzeug', 'kontext.melde'),
      edge('zwei.handler', 'allein'),
      // `versand` ruft `t.handler()`: zwei Implementierungen, ein Versand zur Laufzeit — keine Kante.
    ]);
  });

  it('callScope sind die Dateien der tsconfig, Skripte stehen nicht darin', () => {
    expect(extractCallFacts(repo)!.callScope).toEqual(['src/a.ts']);
  });

  it('ohne tsconfig.json liefert er nichts: nicht gesucht', () => {
    const leer = mkdtempSync(join(tmpdir(), 'call-edges-leer-'));
    try {
      expect(extractCallFacts(leer)).toBeUndefined();
    } finally {
      rmSync(leer, { recursive: true, force: true });
    }
  });

  it('gleicher Stand, dieselben Kanten; eine Änderung am Code rechnet neu', () => {
    const vorher = extractCallFacts(repo);
    expect(extractCallFacts(repo)).toBe(vorher);
    writeFileSync(join(repo, 'src', 'a.ts'), `${QUELLE}\nexport function neu(): void { allein(); }\n`);
    try {
      expect(extractCallFacts(repo)!.callEdges).toContainEqual(edge('neu', 'allein'));
    } finally {
      writeFileSync(join(repo, 'src', 'a.ts'), QUELLE);
    }
    expect(extractCallFacts(repo)).toEqual(vorher);
  });
});

const func = (id: string, symbol?: string, file = 'src/a.ts') => ({
  uid: id,
  type: 'FUNC',
  name: id,
  description: '',
  attributes: symbol ? { realRef: { file, symbol, lang: 'ts' } } : {},
});
const flow = (id: string, sync: 'sync' | 'async', realRef?: { file: string; symbol: string }) => ({
  uid: id,
  type: 'FLOW',
  name: id,
  description: '',
  attributes: { sync, ...(realRef ? { realRef } : {}) },
});
const io = (von: string, f: string, nach: string) => [
  { sourceId: von, targetId: f, edgeType: 'io', attributes: {} },
  { sourceId: f, targetId: nach, edgeType: 'io', attributes: {} },
];

const GRAPH = {
  nodes: [
    func('FUNC-anfrage', 'anfrage'), func('FUNC-mitte', 'mitte'), func('FUNC-ziel', 'ziel'), func('FUNC-allein', 'allein'),
    func('FUNC-versand', 'versand'), func('FUNC-werkzeug', 'werkzeug'), func('FUNC-kontext', 'kontext'),
    func('FUNC-extern'), func('FUNC-skript', 'lauf', 'scripts/werk.mjs'),
    flow('FLOW-direkt', 'sync'), flow('FLOW-ueber', 'sync'), flow('FLOW-antwort', 'sync'),
    flow('FLOW-falsch', 'sync'), flow('FLOW-versand', 'sync'), flow('FLOW-belegt', 'sync', { file: 'src/a.ts', symbol: 'kontext' }),
    flow('FLOW-ungebunden', 'sync'), flow('FLOW-skript', 'sync'), flow('FLOW-datei', 'async'),
  ],
  edges: [
    ...io('FUNC-anfrage', 'FLOW-direkt', 'FUNC-mitte'),
    ...io('FUNC-anfrage', 'FLOW-ueber', 'FUNC-ziel'),
    // Die Antwort fließt vom Gerufenen zurück an den Aufrufer: der Weg zählt in der Gegenrichtung.
    ...io('FUNC-ziel', 'FLOW-antwort', 'FUNC-mitte'),
    // Absichtlich falsch: `anfrage` ruft `allein` nicht.
    ...io('FUNC-anfrage', 'FLOW-falsch', 'FUNC-allein'),
    ...io('FUNC-versand', 'FLOW-versand', 'FUNC-allein'),
    ...io('FUNC-versand', 'FLOW-belegt', 'FUNC-allein'),
    ...io('FUNC-anfrage', 'FLOW-ungebunden', 'FUNC-extern'),
    ...io('FUNC-anfrage', 'FLOW-skript', 'FUNC-skript'),
    ...io('FUNC-anfrage', 'FLOW-datei', 'FUNC-allein'),
  ],
};

describe('call-edges: RC-12 und RC-13 urteilen über die gelieferten Kanten (CR-GC-846)', () => {
  const auswertung = () => conformanceEvaluation({ getGraph: () => GRAPH, getRepoRoot: () => repo });
  const befunde = (rule: string) =>
    auswertung().violations.filter((v) => v.ruleId === rule).map((v) => v.elementId).sort();

  it('ein falscher Abnehmer und ein Versand ohne Beleg geben RC-12, sonst schweigt die Regel', () => {
    expect(befunde('RC-12')).toEqual(['FLOW-falsch', 'FLOW-versand']);
  });

  it('ein Aufruf zwischen zwei verankerten Funktionen ohne Fluss gibt RC-13 am Aufrufer', () => {
    expect(befunde('RC-13')).toEqual(['FUNC-werkzeug']);
  });

  it('die Abdeckung zählt die Paare je Grund', () => {
    expect(auswertung().callCoverage).toEqual({ checked: 6, unbound: 1, outOfScope: 1, async: 1, syncUnknown: 0, anchored: 7 });
  });
});
