// TEST-vertragstest-generator — Vertragstest-Generator und Verb `graphcode vertragstest` (CR-GC-962, CR-GC-965).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { beispiel, erzeugeFaelle, pruefpunkte, testDatei, testVonHand } from '../src/projections/vertragstest.js';
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
      'Miss Spannung am Netzteilausgang; bestanden, wenn 23,76 V ≤ Wert ≤ 24,24 V (Nenn 24 V; Quelle: Datenblatt LRS-150).',
      'Miss Welligkeit am Netzteilausgang; bestanden, wenn Wert ≤ 150 mVpp.',
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
        'Prüfe Polarität am Gleisanschluss; bestanden, wenn kehrt mit der Richtung um.',
        'Miss Frequenz am RPWM; bestanden, wenn 19 kHz ≤ Wert ≤ 21 kHz und je Richtung taktet genau ein Eingang (Nenn 20 kHz).',
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
    expect(t).toContain('1. Miss Spannung am Netzteilausgang');
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
      { schema: 'SCHEMA-bus', datei: 'tests/vertrag/SCHEMA-bus.vertrag.md', faelle: 2, verworfen: ['Polarität: kein Min, kein Max und kein Kriterium'] },
      { schema: 'SCHEMA-leer', fehler: 'keine Vertragstabelle (Spalten Größe, Einheit, Min, Nenn, Max)' },
    ]);
    expect(readFileSync(join(repo, 'tests/vertrag/SCHEMA-bus.vertrag.md'), 'utf8')).toContain('# Vertragstest SCHEMA-bus');
    expect(executeVertragstest({ repoRoot: repo }).map((b) => b.schema)).toEqual(expect.arrayContaining(['SCHEMA-auftrag', 'SCHEMA-bus']));
  });

  it('weist eine uid ohne realRef als Aufruffehler ab', () => {
    expect(() => executeVertragstest({ repoRoot: repo, ids: ['SCHEMA-ohne'] })).toThrow(VertragstestAufrufFehler);
  });
});
