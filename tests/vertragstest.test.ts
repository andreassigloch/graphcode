// TEST-vertragstest-generator — Vertragstest-Generator und Verb `graphcode vertragstest` (CR-GC-962).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { beispiel, erzeugeFaelle, testDatei } from '../src/projections/vertragstest.js';
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
      expect.arrayContaining(['Element: nimmt das Beispiel an', 'Element: lehnt ab ohne id', 'Element: lehnt ab: art außerhalb des Enums', 'lehnt einen Wert ab, der keine Liste ist']),
    );
  });
  it('lehnt bei Text einen Wert vom falschen Typ ab', () => {
    expect(namen(erzeugeFaelle(z.string()).aufgenommen)).toEqual(['nimmt das Beispiel an', 'lehnt einen Wert vom falschen Typ ab']);
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

  it('weist eine uid ohne realRef als Aufruffehler ab', () => {
    expect(() => executeVertragstest({ repoRoot: repo, ids: ['SCHEMA-ohne'] })).toThrow(VertragstestAufrufFehler);
  });
});
