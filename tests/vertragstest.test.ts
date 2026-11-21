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
  it('lehnt je Pflichtfeld ohne Feld ab und verwirft das optionale', () => {
    expect(namen(aufgenommen)).toContain('lehnt ab ohne id');
    expect(verworfen).toContain('lehnt ab ohne notiz');
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
    expect(namen(erzeugeFaelle(z.string()).aufgenommen)).toEqual(['nimmt das Beispiel an', 'lehnt einen Wert vom falschen Typ ab']);
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
