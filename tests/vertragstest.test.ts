// TEST-vertragstest-generator — Vertragstest-Generator und Verb `graphcode vertragstest` (CR-GC-962, CR-GC-965).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { beispiel, erzeugeFaelle, MAX_EBENE, pruefpunkte, testDatei, testVonHand } from '../src/projections/vertragstest.js';
import { executeVertragstest, VertragstestAufrufFehler } from '../src/surface/vertragstest-verb.js';

const S = z.strictObject({
  id: z.string().regex(/^CR-[A-Z]+-\d+$/),
  art: z.enum(['a', 'b']),
  zahl: z.number().int().nonnegative().min(2),
  liste: z.array(z.string()).length(3),
  wann: z.iso.datetime(),
  notiz: z.string().optional(),
});
const namen = (faelle: Array<{ name: string }>): string[] => faelle.map((f) => f.name);

describe('beispiel', () => {
  it('erfüllt Regex, Enum, Zahlengrenzen, exakte Länge und Datumsformat', () => {
    expect(S.safeParse(beispiel(S)).success).toBe(true);
  });
  it('lässt minimal die optionalen Felder weg', () => {
    expect(Object.keys(beispiel(S, true) as object)).not.toContain('notiz');
  });
});

describe('erzeugeFaelle', () => {
  const { aufgenommen, verworfen } = erzeugeFaelle(S);
  it('nimmt das Beispiel an und friert die Ausgabe ein', () => {
    expect(aufgenommen[0]).toMatchObject({ erwartet: true });
    expect(aufgenommen[0]?.ausgabe).toEqual(S.parse(aufgenommen[0]?.eingabe));
  });
  it('lehnt je Pflichtfeld ohne Feld ab; ein optionales Feld darf fehlen (CR-GC-987)', () => {
    expect(namen(aufgenommen)).toContain('lehnt ab ohne id');
    expect(namen(aufgenommen)).toContain('nimmt an ohne notiz (optional)');
    expect(verworfen).not.toContain('lehnt ab ohne notiz');
  });
  it('prüft Enum und Zusatzfeld beim strikten Objekt', () => {
    expect(namen(aufgenommen)).toContain('lehnt ab: art außerhalb des Enums');
    expect(namen(aufgenommen)).toContain('lehnt ab: unbekanntes Zusatzfeld');
  });
  it('erzeugt je Variante einer Union eigene Fälle', () => {
    const U = z.discriminatedUnion('k', [z.object({ k: z.literal(1), a: z.string() }), z.object({ k: z.literal(2), b: z.number() })]);
    expect(namen(erzeugeFaelle(U).aufgenommen)).toEqual(expect.arrayContaining(['Variante 1: lehnt ab ohne a', 'Variante 2: lehnt ab ohne b']));
  });
  it('findet kein Beispiel bei einer Querbedingung, die das volle und das minimale Beispiel ablehnt', () => {
    const R = z
      .object({ a: z.string().optional(), b: z.string().optional() })
      .refine((i) => i.a === undefined || i.b === undefined)
      .refine((i) => i.a !== undefined || i.b !== undefined);
    expect(erzeugeFaelle(R).aufgenommen.some((f) => f.erwartet)).toBe(false);
  });
  it('prüft bei einer Liste die Fälle ihres Elements und lehnt einen Nicht-Listenwert ab', () => {
    const L = z.array(z.strictObject({ id: z.string(), art: z.enum(['a', 'b']) })).length(2);
    const { aufgenommen } = erzeugeFaelle(L);
    expect(namen(aufgenommen)).toEqual(
      expect.arrayContaining(['nimmt das Beispiel an', '[]: lehnt ab ohne id', '[]: lehnt ab: art außerhalb des Enums', 'lehnt einen Wert ab, der keine Liste ist']),
    );
  });
  it('lehnt bei Text einen Wert vom falschen Typ ab', () => {
    expect(namen(erzeugeFaelle(z.string()).aufgenommen)).toEqual(['nimmt das Beispiel an', 'lehnt einen Wert vom falschen Typ ab', 'nimmt Text mit 0 Zeichen an (Untergrenze)']);
  });
});

describe('erzeugeFaelle unter der ersten Feldebene (CR-GC-980)', () => {
  const eingabe = (faelle: Array<{ name: string; eingabe: unknown }>, name: string): unknown => faelle.find((f) => f.name === name)?.eingabe;

  it('prüft ein verschachteltes Objekt: Pflichtfeld, Typ, Enum, Zusatzfeld', () => {
    const N = z.strictObject({ a: z.strictObject({ b: z.string(), c: z.enum(['x', 'y']) }) });
    const { aufgenommen } = erzeugeFaelle(N);
    expect(namen(aufgenommen)).toEqual(
      expect.arrayContaining(['a: lehnt ab ohne b', 'a: lehnt ab: b mit falschem Typ', 'a: lehnt ab: c außerhalb des Enums', 'a: lehnt ab: unbekanntes Zusatzfeld']),
    );
    expect(eingabe(aufgenommen, 'a: lehnt ab ohne b')).toEqual({ a: { c: 'x' } });
  });
  it('prüft die Elemente einer Liste im Objekt und tauscht nur das erste Element', () => {
    const L = z.strictObject({ bindings: z.array(z.strictObject({ tool: z.string(), file: z.string() })).min(2) });
    const { aufgenommen } = erzeugeFaelle(L);
    expect(namen(aufgenommen)).toEqual(expect.arrayContaining(['bindings[]: lehnt ab ohne tool', 'bindings[]: lehnt ab: file mit falschem Typ']));
    const e = eingabe(aufgenommen, 'bindings[]: lehnt ab ohne tool') as { bindings: unknown[] };
    expect(e.bindings).toEqual([{ file: 'beispiel' }, { tool: 'beispiel', file: 'beispiel' }]);
  });
  it('prüft die Elemente eines Tupels und lehnt ein zu kurzes ab', () => {
    const T = z.strictObject({ t: z.tuple([z.string(), z.strictObject({ n: z.number() })]) });
    const { aufgenommen } = erzeugeFaelle(T);
    expect(namen(aufgenommen)).toEqual(expect.arrayContaining(['t[1]: lehnt ab ohne n', 't[0]: lehnt einen Wert vom falschen Typ ab', 't: lehnt ab: Tupel zu kurz']));
  });
  it('prüft den Wert eines Records', () => {
    const R = z.strictObject({ r: z.record(z.string(), z.strictObject({ n: z.number() })) });
    expect(namen(erzeugeFaelle(R).aufgenommen)).toEqual(expect.arrayContaining(['r{}: lehnt ab ohne n']));
  });
  it('prüft jede Variante einer Union im Feld und nimmt sie an', () => {
    const U = z.strictObject({ u: z.discriminatedUnion('k', [z.strictObject({ k: z.literal(1), a: z.string() }), z.strictObject({ k: z.literal(2), b: z.number() })]) });
    const { aufgenommen } = erzeugeFaelle(U);
    expect(namen(aufgenommen)).toEqual(
      expect.arrayContaining(['u (Variante 2): nimmt das Beispiel an', 'u (Variante 1): lehnt ab ohne a', 'u (Variante 2): lehnt ab ohne b']),
    );
    expect(eingabe(aufgenommen, 'u (Variante 2): lehnt ab ohne b')).toEqual({ u: { k: 2 } });
  });
  it('geht durch optional und nullable hindurch', () => {
    const O = z.strictObject({ o: z.strictObject({ a: z.string() }).optional(), p: z.array(z.strictObject({ q: z.string() })).nullable() });
    expect(namen(erzeugeFaelle(O).aufgenommen)).toEqual(expect.arrayContaining(['o: lehnt ab ohne a', 'p[]: lehnt ab ohne q']));
  });
  it('lehnt ab, was das Original annimmt, und verwirft den Fall statt ihn aufzunehmen', () => {
    const N = z.strictObject({ a: z.object({ b: z.string() }) });
    const { aufgenommen, verworfen } = erzeugeFaelle(N);
    expect(namen(aufgenommen)).not.toContain('a: lehnt ab: unbekanntes Zusatzfeld');
    expect(verworfen).toContain('a: lehnt ab: unbekanntes Zusatzfeld');
  });
  it('begrenzt die Tiefe und meldet es', () => {
    let T: z.ZodType = z.strictObject({ blatt: z.string() });
    for (let i = 0; i < MAX_EBENE + 3; i++) T = z.strictObject({ n: T });
    const { aufgenommen, begrenzt } = erzeugeFaelle(T);
    expect(begrenzt.length).toBe(1);
    expect(begrenzt[0]).toMatch(/Tiefe 8 erreicht/);
    expect(aufgenommen.some((f) => f.name.includes('lehnt ab ohne blatt'))).toBe(false);
  });
  it('liefert bei einem rekursiven Schema das Beispiel ohne optionale Felder und meldet es', () => {
    type Knoten = { name: string; kinder?: Knoten[] };
    const K: z.ZodType<Knoten> = z.strictObject({ name: z.string(), kinder: z.array(z.lazy(() => K)).optional() });
    const { aufgenommen, begrenzt } = erzeugeFaelle(K);
    expect(aufgenommen[0]?.eingabe).toEqual({ name: 'beispiel' });
    expect(begrenzt).toEqual(['Wurzel: rekursives Schema (z.lazy), Beispiel ohne optionale Felder']);
  });
  it('wirft bei einem rekursiven Schema ohne endliches Beispiel, ohne Endlosschleife', () => {
    type Knoten = { kinder: Knoten[] };
    const K: z.ZodType<Knoten> = z.strictObject({ kinder: z.array(z.lazy(() => K)).min(1) });
    expect(() => erzeugeFaelle(K)).toThrow(/rekursives Schema/);
  });
});

const VERTRAG = [
  '# 24-V-Bus',
  '',
  'Text vor der Tabelle.',
  '',
  '| Größe | Einheit | Min | Nenn | Max | Messpunkt | Quelle |',
  '|---|---|---|---|---|---|---|',
  '| Spannung | V | 23,76 | 24 | 24,24 | Netzteilausgang | Datenblatt LRS-150 |',
  '| Welligkeit | mVpp | | | 150 | Netzteilausgang | |',
  '| Polarität | – | | plus an Klemme 1 | | | |',
  '',
].join('\n');

describe('erzeugeFaelle: Wertregeln (CR-GC-987)', () => {
  type F = { eingabe: unknown; erwartet: boolean; name: string };
  const hat = (faelle: F[], eingabe: unknown, erwartet: boolean): boolean => faelle.some((f) => f.erwartet === erwartet && JSON.stringify(f.eingabe) === JSON.stringify(eingabe));
  const alle = (schema: unknown): F[] => erzeugeFaelle(schema).aufgenommen as F[];

  it('Text: Mindest- und Höchstlänge, knapp außerhalb abgelehnt, auf der Grenze angenommen', () => {
    const f = alle(z.string().min(2).max(4));
    expect([hat(f, 'x', false), hat(f, 'xx', true), hat(f, 'xxxx', true), hat(f, 'xxxxx', false)]).toEqual([true, true, true, true]);
  });
  it('Text: exakte Länge', () => {
    const f = alle(z.string().length(3));
    expect([hat(f, 'xx', false), hat(f, 'xxx', true), hat(f, 'xxxx', false)]).toEqual([true, true, true]);
  });
  it('Text ohne Längenregel: der leere Text wird angenommen, es gibt keinen Ablehnungsfall zur Länge', () => {
    const f = alle(z.string());
    expect(hat(f, '', true)).toBe(true);
    expect(f.filter((x) => !x.erwartet).map((x) => x.name)).toEqual(['lehnt einen Wert vom falschen Typ ab']);
  });
  it('Zahl: ganze Zahl über einer ausgeschlossenen Grenze; Grenze selbst und Nicht-Ganzzahl abgelehnt', () => {
    const f = alle(z.number().int().positive());
    expect([hat(f, 0, false), hat(f, 1, true), hat(f, 1.5, false)]).toEqual([true, true, true]);
  });
  it('Zahl: eingeschlossene Grenzen, Dezimalzahl knapp außerhalb', () => {
    const f = alle(z.number().min(0).max(10));
    expect([hat(f, -0.001, false), hat(f, 0, true), hat(f, 10, true), hat(f, 10.001, false)]).toEqual([true, true, true, true]);
  });
  it('Zahl: beide Grenzen ausgeschlossen', () => {
    const f = alle(z.number().int().gt(0).lt(3));
    expect([hat(f, 0, false), hat(f, 1, true), hat(f, 2, true), hat(f, 3, false)]).toEqual([true, true, true, true]);
  });
  it('Liste: ein Element zu wenig, ein Element zu viel, Grenzen angenommen', () => {
    const f = alle(z.array(z.string()).min(1).max(2));
    expect([hat(f, [], false), hat(f, ['beispiel'], true), hat(f, ['beispiel', 'beispiel'], true), hat(f, ['beispiel', 'beispiel', 'beispiel'], false)]).toEqual([true, true, true, true]);
  });
  it('Liste ohne Längenregel: die leere Liste wird angenommen', () => {
    expect(hat(alle(z.array(z.string())), [], true)).toBe(true);
  });
  it('Format und Regex: ein verletzender Text wird abgelehnt', () => {
    expect(hat(alle(z.string().email()), '__kein_format__', false)).toBe(true);
    expect(hat(alle(z.string().regex(/^CR-\d+$/)), '!', false)).toBe(true);
  });
  it('Regex, die jeder Kandidat trifft: kein Fall, die Prüfung steht in `verworfen`', () => {
    const { aufgenommen, verworfen } = erzeugeFaelle(z.string().regex(/^/));
    expect(aufgenommen.filter((f) => !f.erwartet).map((f) => f.name)).toEqual(['lehnt einen Wert vom falschen Typ ab']);
    expect(verworfen.some((v) => v.includes('Regex') && v.includes('kein verletzender Text'))).toBe(true);
  });
  it('Längenregel an einem Text mit Regex: kein Fall, in `verworfen` genannt', () => {
    const { verworfen } = erzeugeFaelle(z.string().regex(/^a+$/).min(3));
    expect(verworfen.some((v) => v.includes('Längenregel'))).toBe(true);
  });
  it('gilt auf jeder Ebene: Objektfeld, Listenelement, Tupel, Record, Union-Variante, optional', () => {
    const E = z.strictObject({
      o: z.strictObject({ n: z.number().int().min(1) }),
      l: z.array(z.strictObject({ t: z.string().min(2) })),
      u: z.tuple([z.number().max(5)]),
      r: z.record(z.string(), z.number().int().nonnegative()),
      v: z.union([z.strictObject({ a: z.string().max(3) }), z.strictObject({ b: z.number().min(7) })]),
      p: z.string().min(3).optional(),
    });
    const f = alle(E);
    const abgelehnt = f.filter((x) => !x.erwartet).map((x) => x.name);
    for (const pfad of ['o.n: lehnt ab: 0 ', 'l[].t: lehnt ab: Text mit 1 ', 'u[0]: lehnt ab: 5.001 ', 'r{}: lehnt ab: -1 ', 'v (Variante 1).a: lehnt ab: Text mit 4 ', 'v (Variante 2).b: lehnt ab: 6.999 ', 'p: lehnt ab: Text mit 2 ']) {
      expect(abgelehnt.some((n) => n.startsWith(pfad)), pfad).toBe(true);
    }
  });
  it('nullable: null wird angenommen, auf jeder Ebene', () => {
    const f = alle(z.strictObject({ a: z.strictObject({ v: z.string().min(1).nullable() }) }));
    expect(hat(f, { a: { v: null } }, true)).toBe(true);
  });
  it('Enum: friert die Werteliste mit dem Weg zur Stelle ein', () => {
    const f = erzeugeFaelle(z.strictObject({ art: z.enum(['a', 'b']).optional() })).aufgenommen;
    const e = f.find((x) => x.enumWerte);
    expect(e?.enumWerte).toEqual({ weg: [['shape', 'art'], ['innerType']], liste: ['a', 'b'] });
  });
  it('die erzeugte Datei bestätigt die Werteliste und lässt sich gegen ein um einen Wert erweitertes Enum rot sehen', async () => {
    const E = z.strictObject({ art: z.enum(['a', 'b']) });
    const text = testDatei({ id: 'SCHEMA-x', file: 'x.ts', symbol: 'S' }, './x.js', erzeugeFaelle(E).aufgenommen);
    expect(text).toContain(`.toEqual(["a","b"])`);
    expect(text).toContain(`"shape","art"`);
  });
});

describe('pruefpunkte (Vertragsdatei)', () => {
  it('macht je Zeile mit Grenzwert einen Prüfpunkt und verwirft die Zeile ohne', () => {
    const { punkte, verworfen } = pruefpunkte(VERTRAG);
    expect(punkte).toEqual([
      'Miss Spannung (Messpunkt: Netzteilausgang). Bestanden, wenn 23,76 V ≤ Wert ≤ 24,24 V. Nenn 24 V; Quelle: Datenblatt LRS-150.',
      'Miss Welligkeit (Messpunkt: Netzteilausgang). Bestanden, wenn Wert ≤ 150 mVpp.',
    ]);
    expect(verworfen).toEqual(['Polarität: kein Min, kein Max und kein Kriterium']);
  });
  it('nimmt eine Zeile nur mit Kriterium und hängt das Kriterium an eine Grenze an (CR-GC-966)', () => {
    const v = [
      '| Größe | Einheit | Min | Nenn | Max | Messpunkt | Kriterium |',
      '|---|---|---|---|---|---|---|',
      '| Polarität | – | | | | Gleisanschluss | kehrt mit der Richtung um |',
      '| Frequenz | kHz | 19 | 20 | 21 | RPWM | je Richtung taktet genau ein Eingang |',
      '| Farbe | – | | rot | | | |',
    ].join('\n');
    expect(pruefpunkte(v)).toEqual({
      punkte: [
        'Prüfe Polarität (Messpunkt: Gleisanschluss). Bestanden, wenn kehrt mit der Richtung um.',
        'Miss Frequenz (Messpunkt: RPWM). Bestanden, wenn 19 kHz ≤ Wert ≤ 21 kHz und je Richtung taktet genau ein Eingang. Nenn 20 kHz.',
      ],
      verworfen: ['Farbe: kein Min, kein Max und kein Kriterium'],
    });
  });
  it('lehnt eine Datei ohne Tabelle mit Größe, Einheit, Min, Nenn, Max ab', () => {
    expect(() => pruefpunkte('# leer\n\n| a | b |\n|---|---|\n| 1 | 2 |\n')).toThrow('keine Vertragstabelle');
  });
});

describe('testVonHand', () => {
  it('schreibt Kopf, Überschrift mit der SCHEMA-uid, nummerierte Prüfpunkte und den Ablauf des Ergebnisses', () => {
    const t = testVonHand({ id: 'SCHEMA-bus', file: 'docs/vertrag/bus.md' }, pruefpunkte(VERTRAG).punkte);
    expect(t.split('\n')[0]).toBe('<!-- erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-bus → docs/vertrag/bus.md. Nicht von Hand ändern, neu erzeugen. -->');
    expect(t).toContain('# Vertragstest SCHEMA-bus');
    expect(t).toContain('1. Miss Spannung (Messpunkt: Netzteilausgang)');
    expect(t).toContain('2. Miss Welligkeit');
    expect(t).toContain('`graph_test_ingest`');
    expect(t).toContain('tool: "manuell"');
  });
});

describe('testDatei', () => {
  it('schreibt einen vitest-Rumpf je Fall mit dem Kopf des Verbs', () => {
    const { aufgenommen } = erzeugeFaelle(S);
    const t = testDatei({ id: 'SCHEMA-x', file: 'src/x.ts', symbol: 'S' }, '../src/x.js', aufgenommen);
    expect(t.split('\n')[0]).toContain('erzeugt aus dem Modell (graphcode vertragstest) — SCHEMA-x → src/x.ts#S');
    expect(t).toContain("import { S as S } from '../src/x.js';");
    expect(t.match(/ {2}it\(/g)).toHaveLength(aufgenommen.length);
  });
});

describe('executeVertragstest (Verb gegen ein Temp-Repo)', () => {
  let repo: string;
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'gc-vertragstest-'));
    symlinkSync(resolve('node_modules'), join(repo, 'node_modules'));
    mkdirSync(join(repo, 'src'));
    mkdirSync(join(repo, 'docs/graph'), { recursive: true });
    // Parameter-Property: braucht transform-types, nicht nur Typen streichen.
    writeFileSync(join(repo, 'src/hilfe.ts'), 'export class H { constructor(readonly n: number) {} }\n');
    writeFileSync(
      join(repo, 'src/vertrag.ts'),
      "import { z } from 'zod';\nimport { H } from './hilfe.js';\nexport const h = new H(1);\nexport const AuftragSchema = z.strictObject({ name: z.string(), art: z.enum(['x', 'y']) });\n",
    );
    const elements = [
      { id: 'SCHEMA-auftrag', type: 'SCHEMA', realRef: { file: 'src/vertrag.ts', symbol: 'AuftragSchema' } },
      { id: 'SCHEMA-fremd', type: 'SCHEMA', realRef: { file: 'node_modules/fremd/index.ts', symbol: 'X' } },
      { id: 'SCHEMA-ohne', type: 'SCHEMA' },
    ];
    writeFileSync(join(repo, 'docs/graph', `${repo.split('/').pop()}.graph.json`), JSON.stringify({ elements, traces: [] }));
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  it('schreibt je SCHEMA im Repo eine Testdatei und überspringt fremde und ungebundene', () => {
    const bericht = executeVertragstest({ repoRoot: repo });
    expect(bericht).toEqual([
      expect.objectContaining({ schema: 'SCHEMA-auftrag', datei: 'tests/vertrag/SCHEMA-auftrag.vertrag.test.ts' }),
    ]);
    const text = readFileSync(join(repo, 'tests/vertrag/SCHEMA-auftrag.vertrag.test.ts'), 'utf8');
    expect(text).toContain("import { AuftragSchema as S } from '../../src/vertrag.js';");
    expect(text).toContain('lehnt ab: art außerhalb des Enums');
  });

  it('nennt ein fehlendes Symbol im Bericht statt abzubrechen', () => {
    const p = join(repo, 'docs/graph', `${repo.split('/').pop()}.graph.json`);
    const g = JSON.parse(readFileSync(p, 'utf8'));
    g.elements.push({ id: 'SCHEMA-weg', type: 'SCHEMA', realRef: { file: 'src/vertrag.ts', symbol: 'Weg' } });
    writeFileSync(p, JSON.stringify(g));
    expect(executeVertragstest({ repoRoot: repo, ids: ['SCHEMA-weg'], ziel: 'tmp' })).toEqual([
      { schema: 'SCHEMA-weg', fehler: 'Symbol Weg nicht exportiert' },
    ]);
  });

  it('schreibt für ein SCHEMA mit Vertragsdatei den Test von Hand als Markdown', () => {
    mkdirSync(join(repo, 'docs/vertrag'), { recursive: true });
    writeFileSync(join(repo, 'docs/vertrag/bus.md'), VERTRAG);
    writeFileSync(join(repo, 'docs/vertrag/leer.md'), '# ohne Tabelle\n');
    const p = join(repo, 'docs/graph', `${repo.split('/').pop()}.graph.json`);
    const g = JSON.parse(readFileSync(p, 'utf8'));
    g.elements.push(
      { id: 'SCHEMA-bus', type: 'SCHEMA', realRef: { file: 'docs/vertrag/bus.md' } },
      { id: 'SCHEMA-leer', type: 'SCHEMA', realRef: { file: 'docs/vertrag/leer.md' } },
    );
    writeFileSync(p, JSON.stringify(g));
    expect(executeVertragstest({ repoRoot: repo, ids: ['SCHEMA-bus', 'SCHEMA-leer'] })).toEqual([
      { schema: 'SCHEMA-bus', datei: 'tests/vertrag/SCHEMA-bus.vertrag.md', faelle: 2, verworfen: ['Polarität: kein Min, kein Max und kein Kriterium'], begrenzt: [] },
      { schema: 'SCHEMA-leer', fehler: 'keine Vertragstabelle (Spalten Größe, Einheit, Min, Nenn, Max)' },
    ]);
    expect(readFileSync(join(repo, 'tests/vertrag/SCHEMA-bus.vertrag.md'), 'utf8')).toContain('# Vertragstest SCHEMA-bus');
    expect(executeVertragstest({ repoRoot: repo }).map((b) => b.schema)).toEqual(expect.arrayContaining(['SCHEMA-auftrag', 'SCHEMA-bus']));
  });

  it('weist eine uid ohne realRef als Aufruffehler ab', () => {
    expect(() => executeVertragstest({ repoRoot: repo, ids: ['SCHEMA-ohne'] })).toThrow(VertragstestAufrufFehler);
  });
});

describe('executeVertragstest löst external-SCHEMA über den Paket-Import auf (CR-GC-981)', () => {
  let repo: string;
  const graph = (): string => join(repo, 'docs/graph', `${repo.split('/').pop()}.graph.json`);
  const paket = (dir: string, name: string, exportsMap: Record<string, string>, dateien: Record<string, string>): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', exports: exportsMap }));
    for (const [pfad, text] of Object.entries(dateien)) {
      mkdirSync(join(dir, pfad, '..'), { recursive: true });
      writeFileSync(join(dir, pfad), text);
    }
  };
  const zodText = (symbol: string): string => `import { z } from 'zod';\nexport const ${symbol} = z.strictObject({ name: z.string(), art: z.enum(['x', 'y']) });\n`;
  const ext = (id: string, name: string, pfad: string, symbol: string) => ({
    id,
    type: 'SCHEMA',
    external: true,
    realRef: { file: `packages/${name}/src/${pfad}`, symbol },
  });

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'gc-vertragstest-paket-'));
    mkdirSync(join(repo, 'node_modules/@sigloch'), { recursive: true });
    symlinkSync(resolve('node_modules/zod'), join(repo, 'node_modules/zod'));
    // Registry-Modus: ein Paket als Verzeichnis in node_modules.
    paket(
      join(repo, 'node_modules/@sigloch/demo'),
      '@sigloch/demo',
      { '.': './dist/index.js', './se': './dist/se/index.js', './b': './dist/b.js' },
      {
        'dist/index.js': "export { Gemeinsam } from './b.js';\nexport const Wurzel = (await import('zod')).z.string();\n",
        'dist/b.js': zodText('Gemeinsam'),
        'dist/se/index.js': zodText('Eigen') + 'export const KeinZod = 7;\n',
      },
    );
    // Link-Modus: das Paket liegt als Arbeitskopie ausserhalb, node_modules zeigt per Symlink darauf.
    paket(join(repo, 'arbeitskopie/verlinkt'), '@sigloch/verlinkt', { '.': './dist/index.js' }, { 'dist/index.js': zodText('Verlinkt') });
    symlinkSync(join(repo, 'arbeitskopie/verlinkt'), join(repo, 'node_modules/@sigloch/verlinkt'));
    mkdirSync(join(repo, 'docs/graph'), { recursive: true });
    const elements = [
      ext('SCHEMA-eigen', 'demo', 'se/eigen.ts', 'Eigen'),
      ext('SCHEMA-wurzel', 'demo', 'index.ts', 'Wurzel'),
      ext('SCHEMA-gemeinsam', 'demo', 'b.ts', 'Gemeinsam'),
      ext('SCHEMA-nur-typ', 'demo', 'se/typ.ts', 'NurTyp'),
      ext('SCHEMA-kein-zod', 'demo', 'se/eigen.ts', 'KeinZod'),
      ext('SCHEMA-fehlt', 'fehlt', 'x.ts', 'X'),
      ext('SCHEMA-verlinkt', 'verlinkt', 'index.ts', 'Verlinkt'),
      { id: 'SCHEMA-lokal-ohne-paket', type: 'SCHEMA', realRef: { file: 'packages/demo/src/se/eigen.ts', symbol: 'Eigen' } },
    ];
    writeFileSync(graph(), JSON.stringify({ elements, traces: [] }));
  });
  afterAll(() => rmSync(repo, { recursive: true, force: true }));

  const lauf = () => executeVertragstest({ repoRoot: repo });
  const je = (id: string) => lauf().find((b) => b.schema === id);

  it('findet den Export, dessen Verzeichnis die Datei des realRef enthält, und importiert aus dem Paketnamen', () => {
    expect(je('SCHEMA-eigen')).toMatchObject({ datei: 'tests/vertrag/SCHEMA-eigen.vertrag.test.ts' });
    const text = readFileSync(join(repo, 'tests/vertrag/SCHEMA-eigen.vertrag.test.ts'), 'utf8');
    expect(text).toContain("import { Eigen as S } from '@sigloch/demo/se';");
    expect(text).toContain('lehnt ab: art außerhalb des Enums');
  });
  it('löst auch ein Paket auf, das nur als Symlink auf eine Arbeitskopie in node_modules liegt (Link-Modus)', () => {
    expect(je('SCHEMA-verlinkt')).toMatchObject({ datei: 'tests/vertrag/SCHEMA-verlinkt.vertrag.test.ts' });
    expect(readFileSync(join(repo, 'tests/vertrag/SCHEMA-verlinkt.vertrag.test.ts'), 'utf8')).toContain("from '@sigloch/verlinkt';");
  });
  it('nennt bei einem Symbol in zwei Exports derselben Ebene beide, statt einen zu wählen', () => {
    expect(je('SCHEMA-gemeinsam')).toEqual({ schema: 'SCHEMA-gemeinsam', fehler: 'Symbol Gemeinsam steht in mehreren Exports von @sigloch/demo: @sigloch/demo, @sigloch/demo/b' });
  });
  it('meldet ein Symbol, das kein Export trägt, als kein Zod-Schema', () => {
    expect(je('SCHEMA-nur-typ')).toEqual({
      schema: 'SCHEMA-nur-typ',
      fehler: 'Symbol NurTyp steht in keinem Export von @sigloch/demo (geprüft: @sigloch/demo/se): Symbol ist kein Zod-Schema, vermutlich nur ein TS-Typ',
    });
  });
  it('meldet einen Export, der kein Zod-Schema ist', () => {
    expect(je('SCHEMA-kein-zod')).toEqual({ schema: 'SCHEMA-kein-zod', fehler: 'Symbol KeinZod aus @sigloch/demo/se: Symbol ist kein Zod-Schema' });
  });
  it('meldet ein nicht installiertes Paket mit Grund, ohne die übrigen abzubrechen', () => {
    expect(je('SCHEMA-fehlt')).toEqual({ schema: 'SCHEMA-fehlt', fehler: 'Paket @sigloch/fehlt nicht installiert (node_modules/@sigloch/fehlt/package.json fehlt)' });
  });
  it('nimmt ein SCHEMA mit packages-Pfad, aber ohne external, nicht in den Satz', () => {
    expect(lauf().map((b) => b.schema)).not.toContain('SCHEMA-lokal-ohne-paket');
  });
});

describe('erzeugeFaelle: Wurzel ohne Objekt (CR-GC-989)', () => {
  type F = { eingabe: unknown; erwartet: boolean; name: string };
  const alle = (schema: unknown): F[] => erzeugeFaelle(schema).aufgenommen as F[];
  const hat = (faelle: F[], eingabe: unknown, erwartet: boolean): boolean => faelle.some((f) => f.erwartet === erwartet && Object.is(f.eingabe, eingabe));

  it('z.void als Wurzel: nimmt undefined an, lehnt jeden Wert ab', () => {
    const { aufgenommen, verworfen } = erzeugeFaelle(z.void());
    expect(verworfen).toEqual([]);
    expect(hat(aufgenommen as F[], undefined, true)).toBe(true);
    expect(aufgenommen.some((f) => !f.erwartet)).toBe(true);
  });
  it('z.enum als Wurzel: Werteliste, jeder Wert angenommen, ein Fremdwert abgelehnt', () => {
    const f = alle(z.enum(['a', 'b']));
    expect([hat(f, 'a', true), hat(f, 'b', true), hat(f, '__ausserhalb__', false)]).toEqual([true, true, true]);
    expect(f.some((x) => x.name === 'Werteliste unverändert')).toBe(true);
  });
  it('z.string().min(1) als Wurzel: der leere Text wird abgelehnt, ein Zeichen angenommen', () => {
    const f = alle(z.string().min(1));
    expect([hat(f, '', false), hat(f, 'x', true)]).toEqual([true, true]);
  });
  it('z.void als Wurzel erzeugt eine Testdatei, die undefined parst', () => {
    const { aufgenommen } = erzeugeFaelle(z.void());
    const text = testDatei({ id: 'SCHEMA-void', file: 'src/x.ts', symbol: 'VoidSchema' }, '../../src/x.js', aufgenommen);
    expect(text).toContain('S.parse(undefined)');
    expect(text).toContain('toBe(false)');
  });
});
