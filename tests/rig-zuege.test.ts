/**
 * Zug-Analyse des Greenfield-Rigs (CR-GC-708) — die Auswertung wird selbst geprüft.
 *
 * Keine Mocks: Log und Audit liegen als echte Dateien auf Platte; das Nachspiel läuft über das echte
 * `dist/` (`generationStep`, `takeSteeringSnapshot`). Geprüft wird auch die Selbstprüfung: ein Log,
 * dessen Stagnation die heutige Steuerung nicht reproduziert, ergibt „nicht nachspielbar".
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — Rig-Auswertung in .mjs, bewusst ohne Typdeklaration (Messwerkzeug, kein Produkt-API)
import { rundenAusLog, zuordnen, zugTyp, regelSchluessel, deckung, zugPareto, nachspielen, regelBilanz } from '../rig/greenfield-systemtest/zuege.mjs';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'rig-zuege-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const knoten = (uid: string, type: string, name: string, description: string) =>
  ({ op: 'add-node', node: { uid, type, name, description, attributes: {} } });
const kante = (sourceId: string, edgeType: string, targetId: string) => ({ op: 'add-edge', edge: { sourceId, edgeType, targetId } });

const LOG = [
  '[generate 1] phase=seed done=false',
  '  1.1: graph_mutate',
  '[generate 2] phase=expand done=false',
  '  2.1: graph_elements',
  '  2.2: graph_mutate',
  '    gate rejected [R-18] — feeding violations back (turn 2/6)',
  '  2.3: graph_mutate',
  '    preflight blocked: R-18 FUNC satisfy REQ',
  '    gate rejected [R-18] — feeding violations back (turn 3/6)',
].join('\n');

describe('rundenAusLog + zuordnen', () => {
  it('liest Runden und ordnet Audit-Gruppen den Mutate-Turns zu; ein nur vom Preflight geblockter Turn schrieb nichts', () => {
    const runden = rundenAusLog(LOG);
    expect(runden.map((r: { n: number; phase: string }) => [r.n, r.phase])).toEqual([[1, 'seed'], [2, 'expand']]);
    const t = '2026-09-28T10:00:0';
    const audit = [
      { model: undefined, result: 'applied', timestamp: `${t}0Z`, commands: [] },
      // ein Aufruf, zwei Batches < 1,5 s auseinander → eine Gruppe
      { model: 'm', result: 'applied', timestamp: `${t}1.0Z`, commands: [] },
      { model: 'm', result: 'applied', timestamp: `${t}1.5Z`, commands: [] },
      { model: 'm', result: 'rejected', timestamp: `${t}5Z`, commands: [] },
    ];
    const { saat, warnungen } = zuordnen(runden, audit);
    expect(warnungen).toEqual([]);
    expect(saat).toHaveLength(1);
    expect(runden[0].audit).toHaveLength(2);
    expect(runden[1].audit.map((a: { result: string }) => a.result)).toEqual(['rejected']);
  });

  it('meldet eine Zuordnung, die nicht aufgeht', () => {
    const runden = rundenAusLog(LOG);
    const { warnungen } = zuordnen(runden, [{ model: 'm', result: 'rejected', timestamp: '2026-09-28T10:00:00Z', commands: [] }]);
    expect(warnungen.length).toBeGreaterThan(0);
  });
});

describe('Regel-Pareto je Zugtyp', () => {
  it('ordnet Züge nach dem, was sie anlegen — MOD zuerst', () => {
    expect(zugTyp([knoten('MOD-a', 'MOD', 'a', ''), knoten('FUNC-a', 'FUNC', 'a', '')])).toBe('MOD + allocate');
    expect(zugTyp([knoten('REQ-a', 'REQ', 'a', '')])).toBe('REQ/TEST');
    expect(zugTyp([kante('FUNC-a', 'allocate', 'MOD-a')])).toBe('nur allocate-Kanten');
    expect(zugTyp([])).toBe('Format-E unlesbar');
  });

  it('teilt R-18 nach der Meldung', () => {
    expect(regelSchluessel({ ruleId: 'R-18', message: 'FUNC-x has 2 allocate traces to MOD' })).toBe('R-18/ein MOD je FUNC');
    expect(regelSchluessel({ ruleId: 'IO-02', message: '' })).toBe('IO-02');
  });

  it('deckung: kleinste Regelmenge für den Zielanteil fehlerfreier Züge', () => {
    const zuege = [{ regeln: new Set(['A']) }, { regeln: new Set(['A']) }, { regeln: new Set(['B']) }, { regeln: new Set() }, { regeln: new Set(['C', 'D']) }];
    expect(deckung(zuege, 0.6)).toEqual(['A']);
    expect(deckung(zuege, 0.8)).toHaveLength(2);
  });

  it('zählt Gate-Fehler je Zugtyp und Befunde nur am berührten Element', () => {
    const audit = [
      { operation: 'mutate', model: 'm', result: 'rejected', commands: [knoten('MOD-a', 'MOD', 'a', ''), kante('FUNC-a', 'allocate', 'MOD-a')],
        violations: [{ ruleId: 'IO-02', severity: 'error', elementId: 'FLOW-x', message: '' }] },
      { operation: 'mutate', model: 'm', result: 'applied', commands: [knoten('REQ-a', 'REQ', 'a', '')],
        violations: [{ ruleId: 'RD-01', severity: 'warning', elementId: 'REQ-a', message: '' },
          { ruleId: 'R-16', severity: 'warning', elementId: 'ACTOR-fremd', message: '' }] },
      { operation: 'mutate', result: 'applied', commands: [knoten('SYS-s', 'SYS', 's', '')] }, // Saat: kein Zug des Modells
    ].map((a) => JSON.stringify(a)).join('\n');
    const p = zugPareto([audit]);
    expect(Object.keys(p).sort()).toEqual(['MOD + allocate', 'REQ/TEST']);
    expect(p['MOD + allocate']).toMatchObject({ n: 1, durchGate: 0, fehler80: ['IO-02'] });
    expect(p['REQ/TEST']).toMatchObject({ n: 1, durchGate: 100, ohneBefund: 0, fehler80: [], befunde80: 1 });
  });
});

describe('nachspielen (echtes dist)', () => {
  const lauf = (name: string, log: string) => {
    const d = join(dir, name);
    mkdirSync(d);
    const t = (s: number) => `2026-09-28T10:00:${String(s).padStart(2, '0')}Z`;
    const audit = [
      { operation: 'mutate', result: 'applied', timestamp: t(0), commands: [knoten('SYS-s', 'SYS', 'Shop', 'Ein Webshop verkauft Bücher an Kunden.')] },
      { operation: 'mutate', model: 'm', result: 'applied', timestamp: t(10), commands: [
        knoten('ACTOR-kunde', 'ACTOR', 'Kunde', 'Kauft Bücher.'),
        knoten('UC-kaufen', 'UC', 'Buch kaufen', 'Der Kunde kauft ein Buch.'),
        kante('SYS-s', 'compose', 'UC-kaufen'),
      ] },
    ];
    writeFileSync(join(d, 'audit.jsonl'), audit.map((a) => JSON.stringify(a)).join('\n') + '\n');
    writeFileSync(join(d, 'run-raw.log'), log);
    return d;
  };

  it('rechnet je Runde Fokus, Zug und neue Fokusfunde', async () => {
    const d = lauf('gut', ['[generate 1] phase=expand done=false', '  1.1: graph_mutate', '[generate 2] phase=expand done=false', '  2.1: graph_elements'].join('\n'));
    const s = await nachspielen(d);
    expect(s.grund).toBeUndefined();
    expect(s.nachspielbar).toBe(true);
    expect(s.zeilen).toHaveLength(2);
    expect(s.zeilen[0].zug).toBe('+ACTOR+UC');
    expect(s.zeilen[1].zug).toBe('ohne Zug');
    expect(Object.keys(s.zeilen[0].neu).length).toBeGreaterThan(0); // ein neuer UC ohne REQ/Kette erzeugt Fokusfunde
    const b = regelBilanz(s.zeilen);
    expect(Object.values(b).reduce((n: number, e) => n + (e as { runden: number }).runden, 0)).toBe(2);
  });

  it('meldet „nicht nachspielbar", wenn die heutige Steuerung die Stagnation des Logs nicht reproduziert', async () => {
    const d = lauf('abweichend', ['[generate 1] phase=expand done=false', '  stagnation x3: same generate prompt as last round', '  1.1: graph_mutate'].join('\n'));
    const s = await nachspielen(d);
    expect(s.nachspielbar).toBe(false);
    expect(s.grund).toMatch(/Stagnation/);
  });
});

describe('nachspielen: Lauf gegen ein heutiges Schema', () => {
  it('meldet „nicht nachspielbar" mit dem Schemabefund, statt den Bericht abzubrechen', async () => {
    const d = join(dir, 'altschema');
    mkdirSync(d);
    const audit = [
      { operation: 'mutate', result: 'applied', timestamp: '2026-09-28T10:00:00Z', commands: [
        knoten('SYS-s', 'SYS', 'Shop', 'Ein Webshop.'),
        { op: 'add-node', node: { uid: 'REQ-alt', type: 'REQ', name: 'Alt', description: 'Alt.', attributes: { kinds: ['risk'] } } },
      ] },
    ];
    writeFileSync(join(d, 'audit.jsonl'), audit.map((a) => JSON.stringify(a)).join('\n') + '\n');
    writeFileSync(join(d, 'run-raw.log'), '[generate 1] phase=expand done=false\n');
    const s = await nachspielen(d);
    expect(s.nachspielbar).toBe(false);
    expect(s.grund).toMatch(/Schema/);
  });
});

describe('verlauf (CR-GC-709)', () => {
  it('schreibt je Runde eine Zeile, je Lauf ein Wert, und legt die Datei mit Kopf an', async () => {
    // @ts-expect-error — s.o.
    const { zeile, anhaengen } = await import('../rig/greenfield-systemtest/verlauf.mjs');
    const rows = [{ tokens: { loop: { genRounds: 40 } } }, { tokens: { loop: { genRounds: 40 } } }];
    const ks = [
      { elemente: 100, gate: '80 %', dubletten: '5 %', ketten: '2/4', golden: '60 %', fokusEnde: '20', loesung: '70 %', mod: 3 },
      { elemente: 90, gate: '70 %', dubletten: '—', ketten: '1/3', golden: '55 %', fokusEnde: '25', loesung: '—', mod: 2 },
    ];
    const z = zeile('2026-09-28', 'CR-X', rows, ks);
    expect(z).toBe('| 2026-09-28 | CR-X | 2 × 40 | 100 / 90 | 80 % / 70 % | 5 % / — | 2/4 / 1/3 | 60 % / 55 % | 20 / 25 | 70 % / — | 3 / 2 |');
    const pfad = join(dir, 'verlauf.md');
    anhaengen(z, pfad);
    anhaengen(z, pfad);
    const text = readFileSync(pfad, 'utf8');
    expect(text.startsWith('# Kennzahlverlauf')).toBe(true);
    expect(text.split('\n').filter((l) => l.startsWith('| 2026-09-28')).length).toBe(2);
  });

  it('laufKennzahlen liest Ergebniszeile, Audit, Graph und Nachspiel eines echten Laufverzeichnisses', async () => {
    // @ts-expect-error — s.o.
    const { laufKennzahlen } = await import('../rig/greenfield-systemtest/verlauf.mjs');
    const d = join(dir, 'gut'); // aus „nachspielen (echtes dist)" — dort angelegt
    writeFileSync(join(d, 'graph.json'), JSON.stringify({ elements: [
      { id: 'SYS-s', type: 'SYS', name: 'Shop', description: 'Ein Webshop.' },
      { id: 'UC-kaufen', type: 'UC', name: 'Buch kaufen', description: 'Der Kunde kauft ein Buch.' },
    ], traces: [{ source: 'SYS-s', target: 'UC-kaufen', type: 'compose' }] }));
    const k = await laufKennzahlen({ elements: 3, structure: { MOD: 0 }, tokens: { loop: { mutatesApplied: 3, mutatesRejected: 1 } } }, d, null);
    expect(k.gate).toBe('75 %');
    expect(k.dubletten).toBe('0 %');
    expect(Number(k.fokusEnde)).toBeGreaterThan(0);
    expect(k.loesung).toMatch(/%$/);
  });
});
