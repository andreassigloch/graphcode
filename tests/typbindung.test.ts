/**
 * CR-GC-1026 — Typbindung je Blatt-FUNC gegen Anfrage- und Antwort-SCHEMA.
 *
 * Unit: die Regeln des Generators an einer Kette mit Aufrufer, gerufener FUNC und Helfer (Vorlage aus dem
 * Spike CR-GC-1024, Lauf 5). Die Richtung kommt als Funktion herein; welche Quelle sie verdrahtet, prüft der
 * Test des Verbs.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { snapshotToGraph } from '../src/projections/test-selection-audit.js';
import { toOntologyGraph } from '../src/kernel/conformance.js';
import { chainRoles } from '@sigloch/contracts/se';
import { aufruferAus, typbindungen } from '../src/projections/typbindung.js';
import { readFileSync } from 'node:fs';
import { erzeugeTypbindung, TYPBINDUNG_ZIEL } from '../src/surface/typbindung-verb.js';

const el = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ id, type, name: id, description: 'Vorlage CR-GC-1026', ...extra });
const io = (source: string, target: string) => ({ source, target, type: 'io' });
const rel = (source: string, target: string) => ({ source, target, type: 'relation' });

/** ACTOR → aufrufer → f → helfer; f bekommt `Ein`, antwortet `Aus`, fragt helfer und bekommt dessen Antwort. */
function vorlage(zusatz: { elements?: object[]; traces?: object[] } = {}) {
  return toOntologyGraph(
    snapshotToGraph({
      elements: [
        el('ACTOR-nutzer', 'ACTOR'),
        el('FCHAIN-k', 'FCHAIN'),
        el('FUNC-aufrufer', 'FUNC', { realRef: { file: 'src/code.ts', symbol: 'aufrufer' } }),
        el('FUNC-f', 'FUNC', { realRef: { file: 'src/code.ts', symbol: 'f' } }),
        el('FUNC-helfer', 'FUNC', { realRef: { file: 'src/code.ts', symbol: 'helfer' } }),
        el('FLOW-start', 'FLOW', { sync: 'sync' }),
        el('FLOW-ein', 'FLOW', { sync: 'sync' }),
        el('FLOW-aus', 'FLOW', { sync: 'sync' }),
        el('FLOW-frage', 'FLOW', { sync: 'sync' }),
        el('FLOW-antwort', 'FLOW', { sync: 'sync' }),
        el('FLOW-datei', 'FLOW', { sync: 'async' }),
        el('SCHEMA-ein', 'SCHEMA', { realRef: { file: 'src/code.ts', symbol: 'Ein' } }),
        el('SCHEMA-aus', 'SCHEMA', { realRef: { file: 'src/code.ts', symbol: 'Aus' } }),
        ...(zusatz.elements ?? []),
      ],
      traces: [
        io('ACTOR-nutzer', 'FLOW-start'), io('FLOW-start', 'FUNC-aufrufer'),
        io('FUNC-aufrufer', 'FLOW-ein'), io('FLOW-ein', 'FUNC-f'),
        io('FUNC-f', 'FLOW-aus'), io('FLOW-aus', 'FUNC-aufrufer'),
        io('FUNC-f', 'FLOW-frage'), io('FLOW-frage', 'FUNC-helfer'),
        io('FUNC-helfer', 'FLOW-antwort'), io('FLOW-antwort', 'FUNC-f'),
        io('FLOW-datei', 'FUNC-f'),
        rel('FLOW-ein', 'SCHEMA-ein'), rel('FLOW-aus', 'SCHEMA-aus'),
        rel('FLOW-frage', 'SCHEMA-ein'), rel('FLOW-antwort', 'SCHEMA-aus'),
        { source: 'FCHAIN-k', target: 'FUNC-aufrufer', type: 'compose' },
        { source: 'FCHAIN-k', target: 'FUNC-f', type: 'compose' },
        { source: 'FCHAIN-k', target: 'FUNC-helfer', type: 'compose' },
        ...(zusatz.traces ?? []),
      ],
    } as never),
  );
}

/** Die echte Richtung der Vorlage im Code: aufrufer ruft f, f ruft helfer. */
const richtig = [{ from: 'FUNC-aufrufer', to: 'FUNC-f' }, { from: 'FUNC-f', to: 'FUNC-helfer' }];
const quellen = { 'src/code.ts': 'export const Ein = 1; export const Aus = 2;\nexport function aufrufer() {}\nexport function f() {}\nexport function helfer() {}\n' };
const basis = { rufe: richtig, tiefen: [], quellen, altlast: [], ziel: 'tests/typbindung/bindungen.ts' };
const zeileVon = (text: string, func: string) => text.split('\n').find((l) => l.startsWith(`export const _${func.replace(/\W/g, '_')}:`));

describe('typbindungen (CR-GC-1026)', () => {
  it('bindet f an Anfrage `Ein` und Antwort `Aus`; Aufruf an helfer und async-FLOW gehören nicht zur Signatur', () => {
    const { text, befunde } = typbindungen({ ...basis, graph: vorlage() });
    expect(zeileVon(text, 'FUNC-f')).toBe(
      'export const _FUNC_f: (p1: z.infer<typeof Ein_SCHEMA_ein>) => (z.infer<typeof Aus_SCHEMA_aus>) | Promise<z.infer<typeof Aus_SCHEMA_aus>> = fn_FUNC_f;',
    );
    expect(text).toContain("import { Aus as Aus_SCHEMA_aus, Ein as Ein_SCHEMA_ein, f as fn_FUNC_f, helfer as fn_FUNC_helfer } from '../../src/code.js';");
    expect(befunde.find((b) => b.func === 'FUNC-f')).toEqual({ func: 'FUNC-f', klasse: 'gebunden' });
    // FLOW-start vom Akteur trägt kein SCHEMA: aufrufer wird nicht gebunden, sondern mit Grund genannt.
    expect(befunde.find((b) => b.func === 'FUNC-aufrufer')).toEqual({ func: 'FUNC-aufrufer', klasse: 'nicht prüfbar', grund: 'SCHEMA ohne realRef: FLOW-start' });
  });

  it('dreht die Richtung um, wenn der Aufrufer es sagt: dann ist FLOW-frage die Anfrage an f', () => {
    const verkehrt = richtig.map(({ from, to }) => ({ from: to, to: from }));
    const zeile = zeileVon(typbindungen({ ...basis, rufe: verkehrt, graph: vorlage() }).text, 'FUNC-f');
    // helfer ruft jetzt f: FLOW-frage (an helfer) wird Rückgabe, FLOW-antwort (von helfer) Anfrage — beide Typen vertauscht.
    expect(zeile).toContain('(p1: z.infer<typeof Aus_SCHEMA_aus>) => (z.infer<typeof Ein_SCHEMA_ein>)');
  });

  it('nennt die FUNC nicht prüfbar, wenn die Richtung eines FLOW offen ist', () => {
    const { text, befunde } = typbindungen({ ...basis, rufe: [], graph: vorlage() });
    expect(zeileVon(text, 'FUNC-f')).toBeUndefined();
    expect(befunde.find((b) => b.func === 'FUNC-f')).toEqual({ func: 'FUNC-f', klasse: 'nicht prüfbar', grund: 'Richtung offen: FLOW-antwort, FLOW-aus, FLOW-ein, FLOW-frage' });
  });

  it('nennt mehrere Operationen, wenn die Anfrage-FLOW der Signatur mehr als ein SCHEMA tragen', () => {
    const graph = vorlage({
      elements: [el('ACTOR-zweit', 'ACTOR'), el('FLOW-stopp', 'FLOW', { sync: 'sync' }), el('SCHEMA-stopp', 'SCHEMA', { realRef: { file: 'src/code.ts', symbol: 'Aus' } })],
      traces: [io('ACTOR-zweit', 'FLOW-stopp'), io('FLOW-stopp', 'FUNC-f'), rel('FLOW-stopp', 'SCHEMA-stopp')],
    });
    expect(typbindungen({ ...basis, graph }).befunde.find((b) => b.func === 'FUNC-f')?.grund).toBe('mehrere Operationen: SCHEMA-ein, SCHEMA-stopp');
  });

  it('bindet ein nicht exportiertes Symbol nicht und erkennt ein MCP-Werkzeug', () => {
    const privat = { 'src/code.ts': quellen['src/code.ts'].replace('export function f()', 'function f()') };
    expect(typbindungen({ ...basis, quellen: privat, graph: vorlage() }).befunde.find((b) => b.func === 'FUNC-f')?.grund).toBe('nicht exportiert');
    const werkzeug = { 'src/code.ts': quellen['src/code.ts'].replace('export function f() {}', 'const f: MCPTool<typeof Ein, unknown> = {} as never;') };
    expect(typbindungen({ ...basis, quellen: werkzeug, graph: vorlage() }).befunde.find((b) => b.func === 'FUNC-f')?.grund).toBe('MCP-Werkzeug, MCPTool<…> bindet den Typ');
  });

  it('markiert eine FUNC der Altlast mit @ts-expect-error direkt über ihrer Zeile', () => {
    const { text, befunde } = typbindungen({ ...basis, altlast: ['FUNC-f'], graph: vorlage() });
    const zeilen = text.split('\n');
    const i = zeilen.findIndex((l) => l.startsWith('export const _FUNC_f:'));
    expect(zeilen[i - 1]).toMatch(/^\/\/ @ts-expect-error Altlast/);
    expect(befunde.find((b) => b.func === 'FUNC-f')?.klasse).toBe('altlast');
  });

  it('aufruferAus: der Code entscheidet vor der Kette, die Kette nur, wo der Code schweigt', () => {
    // Kette: Auslöser an aufrufer (Abstand 0), f 1, helfer 2 — aus `ChainRoles.depth` in contracts.
    const tiefen = chainRoles(vorlage()).map((k) => k.depth);
    expect(tiefen).toEqual([{ 'FUNC-aufrufer': 0, 'FUNC-f': 1, 'FUNC-helfer': 2 }]);
    const nurKette = aufruferAus([], tiefen);
    expect(nurKette('FUNC-f', 'FUNC-aufrufer')).toBe('FUNC-aufrufer');
    expect(nurKette('FUNC-f', 'FUNC-helfer')).toBe('FUNC-f');
    // Der Code sagt das Gegenteil für f/helfer: er gewinnt. Für aufrufer/f schweigt er: die Kette bleibt.
    const mitCode = aufruferAus([{ from: 'FUNC-helfer', to: 'FUNC-f' }], tiefen);
    expect(mitCode('FUNC-f', 'FUNC-helfer')).toBe('FUNC-helfer');
    expect(mitCode('FUNC-f', 'FUNC-aufrufer')).toBe('FUNC-aufrufer');
    // Rufen sich beide im Code, entscheidet wieder die Kette; ohne Kette und Code bleibt es offen.
    const beide = aufruferAus([{ from: 'FUNC-helfer', to: 'FUNC-f' }, { from: 'FUNC-f', to: 'FUNC-helfer' }], tiefen);
    expect(beide('FUNC-f', 'FUNC-helfer')).toBe('FUNC-f');
    expect(aufruferAus([], [])('FUNC-f', 'FUNC-helfer')).toBeNull();
  });

  it('nennt ein SCHEMA ohne realRef als Grund', () => {
    const graph = vorlage();
    const aus = graph.elements.find((e) => e.id === 'SCHEMA-aus')!;
    (aus as { attributes?: Record<string, unknown> }).attributes = {};
    expect(typbindungen({ ...basis, graph }).befunde.find((b) => b.func === 'FUNC-f')?.grund).toBe('SCHEMA ohne realRef: FLOW-aus');
  });
});

describe('Bindungsdatei im Repo (CR-GC-1027)', () => {
  it('die committete tests/typbindung/bindungen.ts entspricht der neu erzeugten aus Snapshot, Code und Altlast', () => {
    // Ändert sich Modell, Code oder Altlast, ohne dass jemand `graphcode typbindung` fährt, wird dieser Test rot.
    // Den Inhalt der Bindungen prüft `npm run type-check`.
    const { text } = erzeugeTypbindung(process.cwd());
    expect(readFileSync(TYPBINDUNG_ZIEL, 'utf8')).toBe(text);
  }, 60_000);
});
