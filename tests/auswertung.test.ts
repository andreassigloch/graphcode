/**
 * CR-GC-739 — die Auswertung des Rigs, rein geprüft an gestellten Artefakten; `nachspielen` am echten Gate.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — Auswertung ist .mjs ohne Typen
import { kennzahlen, auditDelta } from '../auswertung/kennzahlen.mjs';
// @ts-expect-error — s.o.
import { ablehnungen, dubletten, struktur, pruefungen, ladeGraph, textAehnlich, verhalten } from '../auswertung/verhalten.mjs';
// @ts-expect-error — s.o.
import { vorbereiten, auswerten, blindurteilFuer, kennzahlen as gutachtenKennzahlen } from '../auswertung/blindurteil.mjs';
// @ts-expect-error — s.o.
import { schattenBilanz, beruehrt } from '../auswertung/schatten-suggest.mjs';
// @ts-expect-error — s.o.
import { datensatz, upsert, juengsteSerie, rendern, ANALYSEN } from '../auswertung/auswerten.mjs';
// @ts-expect-error — s.o.
import { mutationen, nachspielen, nachspielenRein } from '../auswertung/nachspielen.mjs';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'auswertung-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const zug = (n: number, extra: object = {}) => ({ zug: n, sitzung: 1, text: '', dauerMs: 60_000 * n, werkzeuge: ['a', 'b'], audit: { angenommen: 1, abgelehnt: 0 }, abbruch: { laenge: 0, fehler: 0 }, gates: {}, ...extra });
const lauf = {
  aufgabe: 'todo', arm: 'lokal', nr: 4, modell: 'm', stand: { code: 'c1', vorlage: 'v1' }, stempel: 'graph x', ende: 'srr+pdr', sitzungen: 2,
  graph: { elements: 30, traces: 50 },
  zuege: [zug(1, { text: 'Wie heißt die Datei?\nSoll ich anfangen?' }), zug(2, { gates: { SRR: false, PDR: true } }), zug(3, { gates: { SRR: true, PDR: false } }), zug(4, { sitzung: 2, gates: { SRR: true, PDR: true } })],
};
const mut = (result: string, commands: object[], violations: object[] = []) => ({ operation: 'mutate', result, commands, violations });
const knoten = (uid: string, type: string, name: string, description: string) => ({ op: 'add-node', node: { uid, type, name, description } });

describe('kennzahlen', () => {
  it('zählt Züge, Sitzungen, Fragen in Zug 1 (ohne Zustimmungsfragen) und den Zug, ab dem SRR bzw. PDR bestanden blieb', () => {
    const k = kennzahlen(lauf);
    expect(k).toMatchObject({ zuege: 4, sitzungen: 2, fragenZug1: 1, angenommen: 4, abgelehnt: 0, dauerMedianMs: 150_000, dauerMaxMs: 240_000, schritteMedian: 2, elemente: 30, kanten: 50 });
    // PDR war in Zug 2 nur leer bestanden — gezählt wird, ab wann es bestanden BLIEB.
    expect(k.gateZug).toEqual({ SRR: 3, PDR: 4 });
    expect(kennzahlen({ ...lauf, zuege: [zug(1)] }).gateZug).toEqual({ SRR: null, PDR: null });
  });
  it('auditDelta zählt angenommene und abgelehnte Mutationen der Zeilen eines Zugs', () => {
    const zeilen = [mut('applied', []), mut('rejected', []), { operation: 'validate', result: 'applied' }].map((x) => JSON.stringify(x));
    expect(auditDelta(zeilen)).toEqual({ angenommen: 1, abgelehnt: 1 });
  });
});

describe('verhalten', () => {
  const muts = [
    mut('applied', [knoten('REQ-a', 'REQ', 'Todo anlegen', 'add legt ein Todo mit Text an und speichert es')], [{ ruleId: 'UC-01', severity: 'warning' }]),
    mut('rejected', [], [{ ruleId: 'R-18', severity: 'error' }, { ruleId: 'R-10', severity: 'warning' }]),
    mut('applied', [knoten('REQ-b', 'REQ', 'Todo anlegen', 'add legt ein Todo mit Text an und speichert es in der Datei')]),
    mut('applied', [knoten('TEST-x', 'TEST', 'Benachrichtigung prüfen', 'prüft Fall A'), knoten('TEST-y', 'TEST', 'Benachrichtigung prüfen', 'prüft den ganz anderen Fall B mit Fehlermeldung und Exit-Code')]),
  ];
  it('ablehnungen: Fehler je Regel aus abgelehnten, Warnungen aus angenommenen Mutationen', () => {
    expect(ablehnungen(muts)).toEqual({ angenommen: 3, abgelehnt: 1, fehlerJeRegel: { 'R-18': 1 }, warnungenAngenommen: { 'UC-01': 1 } });
  });
  it('dubletten: ähnlicher Text desselben Typs zählt, gleicher Name allein nicht', () => {
    expect(textAehnlich('add legt ein Todo an', 'add legt ein Todo an')).toBe(1);
    const d = dubletten(muts);
    expect(d.anzahl).toBe(1);
    expect(d.typ).toEqual({ REQ: 1 });
    expect(d.form).toEqual({ 'gleicher Name, neue uid': 1 });
  });
  it('struktur gegen die Referenz und pruefungen am Graphen', () => {
    const g = (p: string, els: object[], trs: object[]) => { writeFileSync(join(dir, p), JSON.stringify({ elements: els, traces: trs })); return ladeGraph(join(dir, p)); };
    const lauf1 = g('l.json', [{ id: 'UC-1', type: 'UC', name: 'u' }, { id: 'REQ-1', type: 'REQ', name: 'r', kinds: ['functional'] }, { id: 'REQ-2', type: 'REQ', name: 'r' }, { id: 'FCHAIN-1', type: 'FCHAIN', name: 'k' }, { id: 'FUNC-1', type: 'FUNC', name: 'f' }],
      [{ source: 'UC-1', target: 'REQ-1', type: 'compose' }, { source: 'FCHAIN-1', target: 'FUNC-1', type: 'compose' }, { source: 'FUNC-1', target: 'REQ-1', type: 'satisfy' }]);
    const ref = g('r.json', [{ id: 'UC-1', type: 'UC', name: 'u' }, { id: 'REQ-1', type: 'REQ', name: 'r' }, { id: 'MOD-1', type: 'MOD', name: 'm' }, { id: 'FUNC-1', type: 'FUNC', name: 'f' }],
      [{ source: 'UC-1', target: 'REQ-1', type: 'compose' }, { source: 'FUNC-1', target: 'MOD-1', type: 'allocate' }]);
    const s = struktur(lauf1, ref);
    expect(s.aehnlichkeit).toBe(0.25);
    expect(s.nurReferenz).toEqual(['FUNC -allocate-> MOD']);
    expect(s.typen.MOD).toEqual({ lauf: 0, referenz: 1 });
    expect(s.ketten).toEqual({ mitFunc: 1, ohneFunc: 0, mitEinerFunc: 1, referenz: [] });
    expect(pruefungen(lauf1)).toEqual({ req: 2, ohneKinds: 1, ohneErfueller: 1, namensgleich: 1 });
  });
  it('verhalten eines Lauf-Verzeichnisses: ohne Referenz entfällt nur die Struktur', () => {
    const l = join(dir, 'runs', 'todo', 'lokal-9');
    mkdirSync(l, { recursive: true });
    writeFileSync(join(l, 'audit.jsonl'), muts.map((m) => JSON.stringify(m)).join('\n') + '\n');
    writeFileSync(join(l, 'graph.json'), JSON.stringify({ elements: [{ id: 'REQ-a', type: 'REQ', name: 'x', kinds: ['functional'] }], traces: [] }));
    const v = verhalten(l, null);
    expect(v.abgelehnt).toBe(1);
    expect(v.struktur).toBeNull();
    expect(v.pruefungen.req).toBe(1);
    expect(mutationen(join(l, 'fehlt.jsonl'))).toEqual([]);
  });
});

describe('blindurteil', () => {
  it('bereitet anonyme Specs mit Raster und Auftrag der Aufgabe vor, wertet Gutachten aus, findet sie je Lauf', () => {
    const l = join(dir, 'runs', 'todo', 'frontier-7');
    mkdirSync(l, { recursive: true });
    writeFileSync(join(l, 'lauf.json'), JSON.stringify({ aufgabe: 'todo', arm: 'frontier', nr: 7, ende: 'srr+pdr' }));
    writeFileSync(join(l, 'graph.json'), JSON.stringify({ elements: [{ id: 'SYS-s', type: 'SYS', description: 'lokal' }, { id: 'REQ-r', type: 'REQ', kinds: ['functional'], description: 'tut r' }], traces: [] }));
    const aufgabe = { start: 'Baue X.', antwortblatt: 'Antwort: Y.', punkte: [{ id: 'P01', text: 'x' }, { id: 'O01', text: 'y' }], rasterHinweis: 'h' };
    const ziel = join(dir, 'runs', 'todo', 'blind-1');
    const z = vorbereiten(ziel, [l], { zufall: () => 0, aufgabe });
    expect(z).toEqual({ A: 'frontier-7' });
    const spec = readFileSync(join(ziel, 'spec-A.md'), 'utf8');
    expect(spec).toContain('**REQ-r** (functional)');
    expect(spec).not.toContain('frontier');
    const vorgabe = readFileSync(join(ziel, 'gutachter-A.txt'), 'utf8');
    expect(vorgabe).toContain(join(ziel, 'raster.json'));
    expect(vorgabe).toContain('1 Anforderungen P*, 1 bewusst offene Punkte O*');
    expect(readFileSync(join(ziel, 'auftrag.md'), 'utf8')).toContain('Antwort: Y.');
    expect(existsSync(join(ziel, 'gutachten-A.json'))).toBe(false);
    expect(blindurteilFuer(l)).toBeNull();

    writeFileSync(join(ziel, 'gutachten-A.json'), JSON.stringify({
      punkte: { P01: { bewertung: '✓' }, O01: { bewertung: '✗' } }, erfunden: [{ uid: 'REQ-r' }], dubletten: { anzahl: 2 }, noten: { treue: 3, dubletten: 2, req: 1, tests: 1, struktur: 1 },
    }));
    expect(gutachtenKennzahlen(JSON.parse(readFileSync(join(ziel, 'gutachten-A.json'), 'utf8')))).toEqual({ voll: 1, teil: 0, fehlt: 0, offenGefuehrt: 0, erfunden: 1, dubletten: 2, notensumme: 8 });
    expect(auswerten(ziel)).toEqual([{ kennung: 'A', lauf: 'frontier-7', runde: 'blind-1', voll: 1, teil: 0, fehlt: 0, offenGefuehrt: 0, erfunden: 1, dubletten: 2, notensumme: 8 }]);
    expect(blindurteilFuer(l)?.notensumme).toBe(8);
    // Zwei Aufgaben in einer Runde sind keine Runde.
    const anders = join(dir, 'runs', 'prosa', 'lokal-1');
    mkdirSync(anders, { recursive: true });
    writeFileSync(join(anders, 'lauf.json'), JSON.stringify({ aufgabe: 'sigllm-prosa' }));
    expect(() => vorbereiten(join(dir, 'blind-x'), [l, anders], { aufgabe })).toThrow(/eine Aufgabe/);
  });
});

describe('schatten-suggest', () => {
  it('bilanz: getroffen, verpasst und die verpasste Steuerverbesserung', () => {
    const zeilen = [
      { bester: { ruleId: 'RD-04', score: 0.5 }, agentVerbesserung: 0.1, agentTrifft: false },
      { bester: { ruleId: 'BW-02', score: 0.2 }, agentVerbesserung: 0.3, agentTrifft: true },
      { bester: null, agentVerbesserung: 0, agentTrifft: false },
    ];
    expect(schattenBilanz(zeilen)).toEqual({ zuege: 3, mitAnwendbaremVorschlag: 2, agentTrafVorschlag: 1, verpasst: 1, verpassteVerbesserung: 0.4, agentVerbesserung: 0.4, regeln: [['RD-04', 1], ['BW-02', 1]] });
    expect(beruehrt([{ op: 'add-edge', edge: { sourceId: 'FUNC-a', targetId: 'MOD-b' } }], 'MOD-b')).toBe(true);
    expect(beruehrt([{ op: 'add-node', node: { uid: 'FUNC-a' } }], 'MOD-b')).toBe(false);
  });
});

describe('auswerten: Datensatz, Upsert, jüngste Serie, Dokument', () => {
  const satz = (arm: string, nr: number, code: string, datum: string, extra: object = {}) =>
    datensatz({ ...lauf, arm, nr, stand: { code, vorlage: 'v1' } }, { kennzahlen: kennzahlen(lauf), ...extra }, datum);
  it('datensatz trägt Identität, Stand, Gates des letzten Zugs und die Teile', () => {
    const d = satz('lokal', 4, 'c1', '2026-10-05');
    expect(d).toMatchObject({ id: 'todo/lokal-4', aufgabe: 'todo', arm: 'lokal', ende: 'srr+pdr', gates: { SRR: true, PDR: true } });
    expect(d.kennzahlen.zuege).toBe(4);
  });
  it('upsert ersetzt gleiche id und ordnet nach Datum, dann id; juengsteSerie nimmt je Aufgabe × Arm den jüngsten Stand', () => {
    let s = upsert([], satz('lokal', 4, 'alt', '2026-10-01'));
    s = upsert(s, satz('lokal', 5, 'neu', '2026-10-05'));
    s = upsert(s, satz('lokal', 6, 'neu', '2026-10-05'));
    s = upsert(s, satz('frontier', 4, 'neu', '2026-10-04'));
    s = upsert(s, { ...satz('lokal', 4, 'alt', '2026-10-01'), ende: 'zuglimit' });
    expect(s.map((d: { id: string }) => d.id)).toEqual(['todo/lokal-4', 'todo/frontier-4', 'todo/lokal-5', 'todo/lokal-6']);
    expect(s[0].ende).toBe('zuglimit');
    const j = juengsteSerie(s);
    expect(j.map((g: { arm: string; serie: unknown[] }) => [g.arm, g.serie.length])).toEqual([['frontier', 1], ['lokal', 2]]);
  });
  it('rendern: Stand- und Verlaufstabelle mit Spannen, Blindurteil und Archivverweis', () => {
    const s = [satz('lokal', 5, 'neu', '2026-10-05', { blindurteil: { voll: 9, teil: 1, fehlt: 1, offenGefuehrt: 0, erfunden: 2, dubletten: 0, notensumme: 17 } }), satz('lokal', 6, 'neu', '2026-10-05')];
    const md = rendern(s);
    expect(md).toContain('| todo | lokal | m | neu · v1 | 2 | 4 | 2 | 2.5 | 1 | 4 / 0 | 4 | — | 9 · 1 · 1 / 0 / 2 / 0 / 17 |');
    expect(md).toContain('| 2026-10-05 | todo | lokal | 6 | m | neu · v1 | srr+pdr | 4 · 2 | 2.5 / 4.0 | 1 |');
    expect(md).toContain('messung-interaktiv-2026-10-04.md');
    expect(ANALYSEN).toEqual(['kennzahlen', 'verhalten', 'schatten', 'blindurteil']);
  });
});

describe('nachspielen: die Referenzläufe der Aufgabe todo', () => {
  // Der vorrätige Referenzlauf ist nur dann eine Referenz, wenn sein Audit durchs heutige Gate geht und denselben
  // Graphen ergibt wie `graph.json` — sonst ist er mit dem Regelkatalog gedriftet und muss getauscht werden.
  it.each(['lokal', 'frontier'])('%s: Audit geht durchs Gate, ergibt den abgelegten Graphen, SRR und PDR bestanden', async (arm) => {
    const ref = join(process.cwd(), 'rig', 'aufgaben', 'todo', 'referenz', arm);
    const abgelegt = JSON.parse(readFileSync(join(ref, 'graph.json'), 'utf8'));
    const lauf = JSON.parse(readFileSync(join(ref, 'lauf.json'), 'utf8'));
    const repo = join(dir, `referenz-${arm}`);
    mkdirSync(repo, { recursive: true });
    const r = await nachspielen(join(ref, 'audit.jsonl'), repo);
    expect(mutationen(join(ref, 'audit.jsonl')).filter((a) => a.result === 'applied').length).toBe(kennzahlen(lauf).angenommen);
    expect(r.flach.elements.length).toBe(abgelegt.elements.length);
    expect(r.flach.traces.length).toBe(abgelegt.traces.length);
    expect(r.gates.SRR).toBe(true);
    expect(r.gates.PDR).toBe(true);
  }, 180_000);
});

describe('nachspielenRein: ohne Store, ohne Gate', () => {
  it('spielt die angewandten Mutationen des Referenzlaufs durch applyCommands und trifft den abgelegten Graphen', async () => {
    const ref = join(process.cwd(), 'rig', 'aufgaben', 'todo', 'referenz', 'lokal');
    const abgelegt = JSON.parse(readFileSync(join(ref, 'graph.json'), 'utf8'));
    const r = await nachspielenRein(join(ref, 'audit.jsonl'));
    expect(r.zuege).toBe(mutationen(join(ref, 'audit.jsonl')).filter((a) => a.result === 'applied').length);
    expect(r.abgelehnt).toBeGreaterThan(0);
    expect(r.graph.nodes.length).toBe(abgelegt.elements.length);
    expect(r.graph.edges.length).toBe(abgelegt.traces.length);
  });
});

describe('nachspielen mit Basis: ein Lauf, der auf einem Referenzgraphen beginnt', () => {
  it('leeres Audit auf der Basis ergibt die Basis — SRR und PDR bestanden, aber mit Warnungen (das Ziel der Stufe warnungsfrei)', async () => {
    const basis = join(process.cwd(), 'rig', 'aufgaben', 'todo', 'referenz', 'lokal', 'graph.json');
    const abgelegt = JSON.parse(readFileSync(basis, 'utf8'));
    const repo = join(dir, 'basis-leer');
    mkdirSync(repo, { recursive: true });
    const r = await nachspielen(join(repo, 'kein-audit.jsonl'), repo, Infinity, { basis });
    expect(r.flach.elements.length).toBe(abgelegt.elements.length);
    expect(r.gates.SRR && r.gates.PDR).toBe(true);
    expect(r.befund.fehler).toBe(0);
    expect(r.befund.warnungen).toBeGreaterThan(0);
  }, 60_000);
});
