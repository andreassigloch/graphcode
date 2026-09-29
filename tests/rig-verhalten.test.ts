/**
 * Verhaltensanalyse des Greenfield-Rigs (Leitlinie T-E10, T-E11) — die Auswertung wird selbst geprüft.
 *
 * Keine Mocks: Log, Audit und Graphen liegen als echte Dateien auf Platte, darüber laufen dieselben
 * Funktionen, die `report.mjs` ruft. Dazu ein Wächter: jede uid aus einem Format-E-Vorbild der
 * Executor-Prompts steht in `VORBILD_UIDS` — sonst misst das Vorbild-Leck an der falschen Liste.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — Rig-Auswertung in .mjs, bewusst ohne Typdeklaration (Messwerkzeug, kein Produkt-API)
import { VORBILD_UIDS, ablehnungen, dubletten, ladeGraph, pruefungen, struktur } from '../rig/greenfield-systemtest/verhalten.mjs';
// @ts-expect-error — s.o.
import { vorbereiten, auswerten } from '../rig/greenfield-systemtest/blindurteil.mjs';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'rig-verhalten-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const graph = (name: string, elements: object[], traces: object[]): string => {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify({ elements, traces }));
  return p;
};

describe('VORBILD_UIDS', () => {
  it('enthält jede uid aus den Format-E-Vorbildern der Executor-Prompts', () => {
    const uid = /\b(?:SYS|UC|ACTOR|FCHAIN|FUNC|FLOW|REQ|TEST|MOD|SCHEMA)-[a-z][a-z0-9-]*[a-z0-9]/g;
    const quelle = ['src/loop/executor-prompt.ts', 'src/loop/generate.ts'].map((p) => readFileSync(p, 'utf8')).join('\n');
    // Vorbildzeilen: Knotenzeile `+ UID|…` und Kantenzeile `+ UID -typ-> UID, UID`
    const zeilen = quelle.split(/\\n|\n/).filter((z) => /^\s*'?\+ [A-Z]+-[a-z]/.test(z));
    const imVorbild = new Set(zeilen.flatMap((z) => z.split('|')[0].match(uid) ?? []));
    expect(imVorbild.size).toBeGreaterThan(10);
    expect([...imVorbild].filter((u) => !VORBILD_UIDS.includes(u))).toEqual([]);
  });
});

describe('ablehnungen', () => {
  it('zählt Gate-Regeln, Preflight-Blocks mit satisfy-Paar und neu angelegten Bestand je Typ', () => {
    const log = [
      '    gate rejected [R-18, STRUCT] — feeding violations back (turn 2/6)',
      '    gate rejected [R-18] — feeding violations back (turn 3/6)',
      '    preflight blocked: R-18 FUNC satisfy REQ: REQ-x ist non-functional',
      '    preflight: bestehender Knoten REQ-a nicht ueberschrieben (aendern mit ~)',
      '    preflight: bestehender Knoten FUNC-b nicht ueberschrieben (aendern mit ~)',
      '    preflight: bestehender Knoten REQ-c nicht ueberschrieben (aendern mit ~)',
      '    preflight: REQ-a autocomplete: TEST-Stub TEST-a',
    ].join('\n');
    writeFileSync(join(dir, 'run-raw.log'), log);
    const a = ablehnungen(readFileSync(join(dir, 'run-raw.log'), 'utf8'));
    expect(a.gate).toEqual({ 'R-18': 2, STRUCT: 1 });
    expect(a.preflightBlock).toEqual({ 'R-18': 1 });
    expect(a.satisfyPaare).toEqual({ 'FUNC satisfy REQ': 1 });
    expect(a.wiederAngelegt).toEqual({ REQ: 2, FUNC: 1 });
    expect(Object.values(a.korrektur)).toEqual([1]);
  });
});

describe('dubletten', () => {
  it('erkennt Zwilling nach Text und nach Name mit ähnlichem Text, mit Auslöser aus respondsTo', () => {
    const req = (uid: string, name: string, description: string) =>
      ({ op: 'add-node', node: { uid, type: 'REQ', name, description } });
    const zeilen = [
      { operation: 'mutate', result: 'applied', commands: [req('REQ-login', 'Login', 'Anmeldung per Passwort am Portal')] },
      // gleicher Name, Suffix an den Zwilling, Text halb gleich (≥ 40 %), ohne Befund
      { operation: 'mutate', result: 'applied', commands: [req('REQ-login-neu', 'Login', 'Anmeldung per Passwort')] },
      // gleicher Name allein ist KEINE Dublette (CR-GC-708: „Benachrichtigung prüfen" heißen verschiedene TESTs)
      { operation: 'mutate', result: 'applied', commands: [req('REQ-login-sso', 'Login', 'Single Sign-on über den Firmen-IdP')] },
      // anderer Name, gleicher Text, auf einen Befund hin
      { operation: 'mutate', result: 'applied', respondsTo: [{ ruleId: 'UC-01', elementId: 'UC-a' }],
        commands: [req('REQ-anmelden', 'Anmelden', 'Anmeldung per Passwort am Portal')] },
      // abgelehnte Mutation zählt nicht
      { operation: 'mutate', result: 'rejected', commands: [req('REQ-login-x', 'Login', 'Anmeldung per Passwort am Portal')] },
      // Überschreiben derselben uid ist keine Dublette
      { operation: 'mutate', result: 'applied', commands: [req('REQ-login', 'Login', 'Anmeldung per Passwort am Portal')] },
    ];
    writeFileSync(join(dir, 'audit.jsonl'), zeilen.map((z) => JSON.stringify(z)).join('\n') + '\n');
    const d = dubletten(readFileSync(join(dir, 'audit.jsonl'), 'utf8'));
    expect(d.anzahl).toBe(2);
    expect(d.form).toEqual({ 'Suffix an den Zwilling': 1, 'ähnlicher Text, neue uid': 1 });
    expect(d.ausloeser).toEqual({ 'ohne Befund': 1, 'UC-01': 1 });
  });

  it('zählt jeden Typ, auch innerhalb eines Batches, und Schablonentext getrennt (CR-GC-708)', () => {
    const knoten = (uid: string, type: string, description: string) => ({ op: 'add-node', node: { uid, type, name: uid, description } });
    const zeilen = [{
      operation: 'mutate', result: 'applied', commands: [
        knoten('MOD-budget-1', 'MOD', 'Verwaltet das Rechenbudget der lokalen Instanz'),
        knoten('MOD-budget-2', 'MOD', 'Verwaltet das Rechenbudget der lokalen Instanz'),
        knoten('SCHEMA-a', 'SCHEMA', 'Form von Eingabe: Feld1 und Feld2'),
        knoten('SCHEMA-b', 'SCHEMA', 'Form von Eingabe: Feld1 und Feld2'),
      ],
    }];
    writeFileSync(join(dir, 'audit.jsonl'), zeilen.map((z) => JSON.stringify(z)).join('\n') + '\n');
    const d = dubletten(readFileSync(join(dir, 'audit.jsonl'), 'utf8'));
    expect(d.typ).toEqual({ MOD: 1 });
    expect(d.platzhalter).toBe(1);
  });
});

describe('pruefungen und struktur', () => {
  const lauf = () => ladeGraph(graph('lauf.json', [
    { id: 'SYS-s', type: 'SYS', name: 's' },
    { id: 'UC-a', type: 'UC', name: 'a' },
    { id: 'REQ-login-dauer', type: 'REQ', name: 'Dauer', kinds: ['non-functional'] },
    { id: 'REQ-dauer-2', type: 'REQ', name: 'Dauer', attributes: { kinds: ['non-functional'] } },
    { id: 'REQ-ohne', type: 'REQ', name: 'Ohne' },
    { id: 'FCHAIN-k', type: 'FCHAIN', name: 'k' },
    { id: 'FUNC-f', type: 'FUNC', name: 'f' },
  ], [
    { source: 'SYS-s', target: 'UC-a', type: 'compose' },
    { source: 'UC-a', target: 'REQ-login-dauer', type: 'compose' },
    { source: 'FCHAIN-k', target: 'FUNC-f', type: 'compose' },
    { source: 'FCHAIN-k', target: 'REQ-login-dauer', type: 'satisfy' },
    { source: 'FUNC-f', target: 'GONE', type: 'satisfy' },
  ]));

  it('zählt REQ ohne kinds (Element oder attributes), ohne Erfüller, überzählig namensgleich, Vorbild-Leck', () => {
    const p = pruefungen(lauf());
    expect(p).toEqual({ req: 3, ohneKinds: 1, ohneErfueller: 2, namensgleich: 1, vorbildLeck: ['REQ-login-dauer'] });
  });

  it('misst Muster-Ähnlichkeit gegen das Golden und Ketten mit einer FUNC', () => {
    const golden = ladeGraph(graph('golden.json', [
      { id: 'SYS-s', type: 'SYS' }, { id: 'UC-a', type: 'UC' }, { id: 'MOD-m', type: 'MOD' }, { id: 'REQ-r', type: 'REQ' },
    ], [
      { source: 'SYS-s', target: 'UC-a', type: 'compose' },
      { source: 'MOD-m', target: 'REQ-r', type: 'satisfy' },
    ]));
    const s = struktur([lauf(), lauf()], golden);
    expect(s.aehnlichLaeufe).toBe(1);
    // Lauf: 4 Muster, Golden: 2, gemeinsam 1 (SYS compose UC) → 1/5
    expect(s.aehnlichGolden).toEqual([0.2, 0.2]);
    expect(s.inAllen).toEqual(['SYS -compose-> UC']);
    expect(s.inKeinem).toEqual(['MOD -satisfy-> REQ']);
    expect(s.ketten).toEqual({ mitFunc: 2, ohneFunc: 0, mitEinerFunc: 2, golden: [] });
    expect(s.typMedian.MOD).toEqual({ lauf: 0, golden: 1 });
  });
});

describe('blindurteil', () => {
  it('bereitet anonyme Specs mit Zuordnung vor und wertet die Gutachten je Lauf aus', () => {
    const lauf = join(dir, 'runs', 'gcrun-7');
    mkdirSync(lauf, { recursive: true });
    writeFileSync(join(lauf, 'graph.json'), JSON.stringify({
      elements: [{ id: 'SYS-s', type: 'SYS', description: 'lokal' }, { id: 'REQ-r', type: 'REQ', kinds: ['functional'], description: 'tut r' }],
      traces: [],
    }));
    const ziel = join(dir, 'blind');
    const z = vorbereiten(ziel, [lauf], () => 0);
    expect(z).toEqual({ A: 'gcrun-7' });
    const spec = readFileSync(join(ziel, 'spec-A.md'), 'utf8');
    expect(spec).toContain('**REQ-r** (functional)');
    expect(spec).not.toContain('gcrun');
    expect(readFileSync(join(ziel, 'gutachter-A.txt'), 'utf8')).toContain(join(ziel, 'gutachten-A.json'));
    expect(existsSync(join(ziel, 'gutachten-A.json'))).toBe(false);
    // Ein anderer Korpus: Raster und Auftrag reisen in die Gutachter-Vorgabe, nicht die sigllm-Vorgabe.
    const raster = join(dir, 'raster.json');
    writeFileSync(raster, JSON.stringify({ punkte: [{ id: 'P01', text: 'x' }, { id: 'O01', text: 'y' }] }));
    const anders = join(dir, 'blind-anders');
    vorbereiten(anders, [lauf], () => 0, { raster, auftrag: join(dir, 'auftrag.md') });
    const vorgabe = readFileSync(join(anders, 'gutachter-A.txt'), 'utf8');
    expect(vorgabe).toContain(raster);
    expect(vorgabe).toContain(join(dir, 'auftrag.md'));
    expect(vorgabe).not.toContain('sigllm-spezifikation');

    writeFileSync(join(ziel, 'gutachten-A.json'), JSON.stringify({
      punkte: { P01: { bewertung: '✓' }, P02: { bewertung: '~' }, P03: { bewertung: '✗' }, O1: { bewertung: '✓' }, O2: { bewertung: '✗' } },
      erfunden: [{ uid: 'REQ-r', zitat: '2 s' }], dubletten: { anzahl: 3 },
      noten: { treue: 2, dubletten: 1, req: 1, tests: 1, struktur: 1 },
    }));
    expect(auswerten(ziel)).toEqual([
      { kennung: 'A', lauf: 'gcrun-7', voll: 1, teil: 1, fehlt: 1, offenGefuehrt: 1, erfunden: 1, dubletten: 3, notensumme: 6 },
    ]);
  });
});
