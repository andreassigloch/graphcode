/**
 * CR-GC-843 — `scripts/fluss-aufruf.mjs`: steht hinter jedem synchronen Fluss ein Aufruf?
 *
 * Ein Wegwerf-Repo mit echtem TypeScript-Quellbaum und einem Modell darüber. Je Ergebnis ein Fluss: direkter
 * Aufruf, Aufruf über einen Zwischenschritt, Aufruf über ein Interface, das eine Klasse nur strukturell erfüllt,
 * Aufruf eines destrukturierten Namens, kein Aufruf, ungebundene Seite — und ein asynchroner Fluss, der nicht
 * geprüft, nur gezählt wird.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeFluesse } from '../scripts/fluss-aufruf.mjs';

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

const func = (id: string, symbol?: string) => ({
  id,
  type: 'FUNC',
  name: id,
  ...(symbol ? { realRef: { file: 'src/a.ts', symbol } } : {}),
});
const flow = (id: string, sync: 'sync' | 'async') => ({ id, type: 'FLOW', name: id, sync });
const io = (von: string, f: string, nach: string) => [
  { source: von, target: f, type: 'io' },
  { source: f, target: nach, type: 'io' },
];

const GRAPH = {
  elements: [
    func('FUNC-anfrage', 'anfrage'), func('FUNC-mitte', 'mitte'), func('FUNC-ziel', 'ziel'),
    func('FUNC-allein', 'allein'), func('FUNC-treiber', 'treiber'), func('FUNC-werkzeug', 'werkzeug'),
    func('FUNC-kontext', 'kontext'), func('FUNC-extern'), func('FUNC-auswahl', 'auswahl'), func('FUNC-versand', 'versand'),
    flow('FLOW-direkt', 'sync'), flow('FLOW-ueber', 'sync'), flow('FLOW-antwort', 'sync'),
    flow('FLOW-interface', 'sync'), flow('FLOW-pick', 'sync'), flow('FLOW-versand', 'sync'), flow('FLOW-destrukturiert', 'sync'), flow('FLOW-keiner', 'sync'),
    flow('FLOW-ungebunden', 'sync'), flow('FLOW-datei', 'async'),
    { ...flow('FLOW-belegt', 'sync'), realRef: { file: 'src/a.ts', symbol: 'kontext' } },
    { ...flow('FLOW-beleg-kaputt', 'sync'), realRef: { file: 'src/a.ts', symbol: 'gibtEsNicht' } },
    { ...flow('FLOW-gebunden-mit-aufruf', 'sync'), realRef: { file: 'src/a.ts', symbol: 'gibtEsNicht' } },
  ],
  traces: [
    ...io('FUNC-anfrage', 'FLOW-direkt', 'FUNC-mitte'),
    ...io('FUNC-anfrage', 'FLOW-ueber', 'FUNC-ziel'),
    // Die Antwort fließt vom Gerufenen zurück an den Aufrufer: gefunden in der Gegenrichtung.
    ...io('FUNC-ziel', 'FLOW-antwort', 'FUNC-mitte'),
    ...io('FUNC-treiber', 'FLOW-interface', 'FUNC-ziel'),
    ...io('FUNC-auswahl', 'FLOW-pick', 'FUNC-ziel'),
    // Zwei Implementierungen: ein Versand zur Laufzeit, dem das Skript nicht folgt.
    ...io('FUNC-versand', 'FLOW-versand', 'FUNC-allein'),
    ...io('FUNC-werkzeug', 'FLOW-destrukturiert', 'FUNC-kontext'),
    ...io('FUNC-anfrage', 'FLOW-keiner', 'FUNC-allein'),
    ...io('FUNC-anfrage', 'FLOW-ungebunden', 'FUNC-extern'),
    ...io('FUNC-anfrage', 'FLOW-datei', 'FUNC-allein'),
    ...io('FUNC-anfrage', 'FLOW-belegt', 'FUNC-allein'),
    ...io('FUNC-anfrage', 'FLOW-beleg-kaputt', 'FUNC-allein'),
    // Der Code zeigt einen Weg: die (hier kaputte) Bindung am Fluss wird gar nicht gelesen.
    ...io('FUNC-anfrage', 'FLOW-gebunden-mit-aufruf', 'FUNC-mitte'),
  ],
};

let repo: string;
let r: { zeilen: Array<{ flow: string; ergebnis: string; weg?: string[]; grund?: string }>; summe: Record<string, number> };
const zeile = (flow: string) => r.zeilen.find((z) => z.flow === flow)!;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'fluss-aufruf-'));
  mkdirSync(join(repo, 'src'));
  writeFileSync(join(repo, 'src', 'a.ts'), QUELLE);
  writeFileSync(
    join(repo, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { target: 'ES2020', module: 'ES2020', strict: true }, include: ['src/**/*'] }),
  );
  r = pruefeFluesse({ repoRoot: repo, graph: GRAPH, tiefe: 3 });
}, 60_000);

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe('fluss-aufruf: Fluss gegen Aufruf (CR-GC-843)', () => {
  it('ein direkter Aufruf des Abnehmers ist ein Aufruf', () => {
    expect(zeile('FLOW-direkt')).toMatchObject({ ergebnis: 'aufruf', weg: ['anfrage', 'mitte'] });
  });

  it('ein Aufruf über einen Zwischenschritt nennt den Weg', () => {
    expect(zeile('FLOW-ueber')).toMatchObject({ ergebnis: 'ueber', weg: ['anfrage', 'mitte', 'ziel'] });
  });

  it('eine Antwort an den Aufrufer findet den Aufruf in der Gegenrichtung', () => {
    expect(zeile('FLOW-antwort')).toMatchObject({ ergebnis: 'aufruf', weg: ['mitte', 'ziel'] });
  });

  it('ein Aufruf über ein Interface geht an die Klasse, die es nur strukturell erfüllt', () => {
    expect(zeile('FLOW-interface')).toMatchObject({ ergebnis: 'ueber', weg: ['treiber', 'lauf', 'ziel'] });
  });

  it('ein Aufruf über einen abgeleiteten Typ (Pick) geht an die Signatur und weiter an die Klasse', () => {
    expect(zeile('FLOW-pick')).toMatchObject({ ergebnis: 'ueber', weg: ['auswahl', 'lauf', 'ziel'] });
  });

  it('der Aufruf eines destrukturierten Namens erreicht die Funktion dahinter', () => {
    expect(zeile('FLOW-destrukturiert')).toMatchObject({ ergebnis: 'aufruf', weg: ['werkzeug', 'melde'] });
  });

  it('einem Versand über eine Signatur mit mehreren Implementierungen folgt es nicht', () => {
    expect(zeile('FLOW-versand').ergebnis).toBe('kein-aufruf');
  });

  it('ohne Aufruf in beiden Richtungen meldet es kein-aufruf', () => {
    expect(zeile('FLOW-keiner').ergebnis).toBe('kein-aufruf');
  });

  it('eine Seite ohne Bindung ist ungeprüft, mit Grund', () => {
    expect(zeile('FLOW-ungebunden')).toMatchObject({ ergebnis: 'ungeprueft', grund: 'FUNC-extern: ohne Bindung' });
  });

  it('ohne Aufruf belegt die Bindung am Fluss die Übergabe, solange ihr Symbol existiert', () => {
    expect(zeile('FLOW-belegt')).toMatchObject({ ergebnis: 'belegt', beleg: 'src/a.ts#kontext' });
    expect(zeile('FLOW-beleg-kaputt')).toMatchObject({ ergebnis: 'beleg-kaputt', grund: 'Symbol nicht gefunden' });
  });

  it('zeigt der Code einen Weg, zählt der Weg, nicht die Bindung', () => {
    expect(zeile('FLOW-gebunden-mit-aufruf')).toMatchObject({ ergebnis: 'aufruf', weg: ['anfrage', 'mitte'] });
  });

  it('ein asynchroner Fluss wird nicht geprüft, nur gezählt', () => {
    expect(r.zeilen.some((z) => z.flow === 'FLOW-datei')).toBe(false);
    expect(r.summe).toEqual({ paare: 12, aufruf: 4, ueber: 3, belegt: 1, belegKaputt: 1, keinAufruf: 2, ungeprueft: 1, asynchron: 1 });
  });

  it('gleicher Stand, gleiche Ausgabe', () => {
    expect(pruefeFluesse({ repoRoot: repo, graph: GRAPH, tiefe: 3 })).toEqual(r);
  });
});
