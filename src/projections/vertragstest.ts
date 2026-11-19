/**
 * vertragstest.ts — Vertragstest je SCHEMA, erzeugt allein aus dem Zod-Schema (zod 4) zur Laufzeit
 * (CR-GC-962; Herkunft graphanalyze, Spike CR-GC-958 G1 Go).
 *
 * Je Schema: ein gueltiges Beispiel, das angenommen wird, und je Objektfeld die Ablehnung ohne Feld,
 * mit falschem Typ und ausserhalb eines Enums, dazu ein unbekanntes Zusatzfeld; je Union-Variante
 * dasselbe. Ein Fall kommt nur in die Datei, wenn das Original-Schema ihn so urteilt, wie der Fall es
 * erwartet; angenommene Faelle frieren die Ausgabe ein. Das Laden der TS-Quellen des Ziel-Repos
 * gehoert dem Aufrufer (`laden`), weil es Node-Flags braucht (vertragstest-verb.ts).
 *
 * Ein SCHEMA mit Vertragsdatei (`realRef {file}` auf `.md` ohne Symbol, Entscheidung CR-GC-961 F3d)
 * bekommt den Test von Hand (CR-GC-965): Die Tabelle traegt Größe, Einheit, Min, Nenn, Max, optional
 * Messpunkt und Quelle; je Zeile mit Grenzwert entsteht ein Pruefpunkt, eine Zeile ohne Min und Max
 * wird verworfen. Das Protokoll eines Laufs liegt getrennt (`evidence`, CR-GC-964).
 *
 * @author andreas@siglochconsulting
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { z } from 'zod';

/** Ein SCHEMA des Modells mit seinem Zod-Symbol im Code oder mit seiner Vertragsdatei (`.md`, ohne Symbol). */
export const VertragstestSatzSchema = z.array(
  z.union([
    z.strictObject({ id: z.string().min(1), file: z.string().min(1), symbol: z.string().min(1) }),
    z.strictObject({ id: z.string().min(1), file: z.string().regex(/\.md$/) }),
  ]),
);
export type VertragstestSatz = z.infer<typeof VertragstestSatzSchema>;

/** Je SCHEMA: wie viele Faelle in der Datei stehen und welche verworfen wurden, oder warum keine entstand. */
export const VertragstestBerichtSchema = z.array(
  z.union([
    z.strictObject({ schema: z.string(), datei: z.string(), faelle: z.number().int().positive(), verworfen: z.array(z.string()) }),
    z.strictObject({ schema: z.string(), fehler: z.string() }),
  ]),
);
export type VertragstestBericht = z.infer<typeof VertragstestBerichtSchema>;

/** Sicht auf die Introspektion von zod 4 (`_zod.def`); nur die Felder, die der Erzeuger liest. */
interface Def {
  type: string;
  format?: string;
  checks?: Array<{ _zod: { def: Check } }>;
  shape: Record<string, Zod>;
  element: Zod;
  items: Zod[];
  keyType: Zod;
  valueType: Zod;
  innerType: Zod;
  options: Zod[];
  in: Zod;
  getter: () => Zod;
  values: unknown[];
  entries: Record<string, unknown>;
}
interface Check {
  check?: string;
  format?: string;
  pattern?: RegExp;
  minimum?: number;
  maximum?: number;
  length?: number;
  value?: number;
  inclusive?: boolean;
}
interface Zod {
  _zod: { def: Def };
  safeParse(v: unknown): { success: boolean; data?: unknown };
}
interface Fall {
  name: string;
  eingabe: unknown;
  erwartet: boolean;
  ausgabe?: unknown;
}

const def = (s: Zod): Def => s._zod.def;
const checks = (s: Zod): Check[] => (def(s).checks ?? []).map((c) => c._zod.def);

/** Ein Text, der den Regex trifft (Teilmenge: ^ $ Literale, \d \w \s, [..], (..|..), ? * + {n,m}). */
function ausRegex(re: RegExp): string {
  const src = re.source;
  let i = 0;
  const seq = (): string => {
    let out = '';
    while (i < src.length && src[i] !== '|' && src[i] !== ')') out += quant(atom());
    return out;
  };
  const alt = (): string => {
    const a = seq();
    while (src[i] === '|') {
      i++;
      seq();
    }
    return a;
  };
  const atom = (): string => {
    const c = src[i++];
    if (c === '^' || c === '$') return '';
    if (c === '\\') {
      const d = src[i++];
      return d === 'd' ? '1' : d === 'w' ? 'a' : d === 's' ? ' ' : (d ?? '');
    }
    if (c === '[') {
      let first = src[i] ?? '';
      if (first === '^') throw new Error('negierte Zeichenklasse nicht unterstuetzt');
      if (first === '\\') first = src[i + 1] === 'd' ? '1' : (src[i + 1] ?? '');
      while (src[i] !== ']') {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      return first;
    }
    if (c === '(') {
      if (src[i] === '?') {
        i++;
        if (src[i] === ':') i++;
        else throw new Error('Lookaround nicht unterstuetzt');
      }
      const r = alt();
      i++;
      return r;
    }
    if (c === '.') return 'a';
    return c ?? '';
  };
  const quant = (a: string): string => {
    const q = src[i];
    if (q === '?' || q === '*') {
      i++;
      return '';
    }
    if (q === '+') {
      i++;
      return a;
    }
    if (q === '{') {
      const m = /^\{(\d+)(,\d*)?\}/.exec(src.slice(i));
      if (!m) return a;
      i += m[0].length;
      return a.repeat(Number(m[1]));
    }
    return a;
  };
  return alt();
}

const FORMATE: Record<string, string> = {
  datetime: '2026-01-01T00:00:00.000Z',
  date: '2026-01-01',
  uuid: '00000000-0000-4000-8000-000000000000',
  email: 'a@b.de',
  url: 'https://example.org',
};

/** Ein gueltiges Beispiel; `minimal` laesst optionale Objektfelder weg. */
export function beispiel(schema: unknown, minimal = false): unknown {
  const s = schema as Zod;
  const d = def(s);
  if (minimal && d.type === 'object') {
    return Object.fromEntries(
      Object.entries(d.shape)
        .filter(([, v]) => !v.safeParse(undefined).success)
        .map(([k, v]) => [k, beispiel(v, true)]),
    );
  }
  switch (d.type) {
    case 'string': {
      const c = checks(s);
      const re = c.find((x) => x.format === 'regex');
      const fmt = d.format ?? c.find((x) => x.format && x.format !== 'regex')?.format;
      if (fmt && !re && !(fmt in FORMATE)) throw new Error(`Format ${fmt} nicht unterstuetzt`);
      let v = re?.pattern ? ausRegex(re.pattern) : fmt ? (FORMATE[fmt] as string) : 'beispiel';
      const min = c.find((x) => x.check === 'min_length')?.minimum ?? 0;
      if (!re) while (v.length < min) v += 'x';
      const max = c.find((x) => x.check === 'max_length')?.maximum;
      if (!re && max !== undefined) v = v.slice(0, Math.max(max, min));
      return v;
    }
    case 'number': {
      const c = checks(s);
      const unten = Math.max(-Infinity, ...c.filter((x) => x.check === 'greater_than').map((x) => Math.ceil((x.value ?? 0) + (x.inclusive ? 0 : 1))));
      const oben = Math.min(Infinity, ...c.filter((x) => x.check === 'less_than').map((x) => Math.floor((x.value ?? 0) - (x.inclusive ? 0 : 1))));
      const v = unten > -Infinity ? unten : Math.min(1, oben);
      if (v > oben) throw new Error('leerer Zahlenbereich');
      return v;
    }
    case 'int':
      return 1;
    case 'boolean':
      return true;
    case 'null':
      return null;
    case 'literal':
      return d.values[0];
    case 'enum':
      return Object.values(d.entries)[0];
    case 'unknown':
    case 'any':
      return 'beliebig';
    case 'array': {
      const c = checks(s);
      const n = c.find((x) => x.check === 'length_equals')?.length ?? c.find((x) => x.check === 'min_length')?.minimum ?? 1;
      return Array.from({ length: Math.max(n, 1) }, () => beispiel(d.element));
    }
    case 'tuple':
      return d.items.map((x) => beispiel(x));
    case 'record': {
      const k = beispiel(d.keyType);
      return { [typeof k === 'string' ? k : 'k']: beispiel(d.valueType) };
    }
    case 'object':
      return Object.fromEntries(Object.entries(d.shape).map(([k, v]) => [k, beispiel(v)]));
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return beispiel(d.innerType);
    case 'union':
      return beispiel(d.options[0]);
    case 'pipe':
      return beispiel(d.in);
    case 'lazy':
      return beispiel(d.getter());
    case 'date':
      return new Date('2026-01-01');
    default:
      throw new Error(`Typ ${d.type} nicht unterstuetzt`);
  }
}

const WRAPPER = ['optional', 'nullable', 'default'];
const kern = (s: Zod): Zod => (WRAPPER.includes(def(s).type) ? kern(def(s).innerType) : s);

function objektFaelle(obj: Zod, basis: Record<string, unknown>, etikett: string): Fall[] {
  const faelle: Fall[] = [];
  const shape = def(obj).shape;
  for (const k of Object.keys(shape)) {
    const ohne = { ...basis };
    delete ohne[k];
    faelle.push({ name: `${etikett}lehnt ab ohne ${k}`, eingabe: ohne, erwartet: false });
    const falsch = typeof basis[k] === 'string' ? 12345 : '__falsch__';
    faelle.push({ name: `${etikett}lehnt ab: ${k} mit falschem Typ`, eingabe: { ...basis, [k]: falsch }, erwartet: false });
    if (def(kern(shape[k] as Zod)).type === 'enum') {
      faelle.push({ name: `${etikett}lehnt ab: ${k} außerhalb des Enums`, eingabe: { ...basis, [k]: '__ausserhalb__' }, erwartet: false });
    }
  }
  faelle.push({ name: `${etikett}lehnt ab: unbekanntes Zusatzfeld`, eingabe: { ...basis, __zusatz__: 1 }, erwartet: false });
  return faelle;
}

/** Alle Faelle eines Schemas; aufgenommen wird nur, was das Original so urteilt. */
export function erzeugeFaelle(schema: unknown): { aufgenommen: Fall[]; verworfen: string[] } {
  const S = schema as Zod;
  const aufgenommen: Fall[] = [];
  const verworfen: string[] = [];
  for (const f of rohFaelle(S)) {
    const r = S.safeParse(f.eingabe);
    if (r.success === f.erwartet) aufgenommen.push(f.erwartet ? { ...f, ausgabe: r.data } : f);
    else verworfen.push(f.name);
  }
  return { aufgenommen, verworfen };
}

/** Die Faelle vor dem Urteil des Originals. Eine Liste traegt die Faelle ihres Elements, so oft wiederholt wie ihr Beispiel lang ist. */
function rohFaelle(S: Zod): Fall[] {
  const d = def(S);
  if (d.type === 'array') {
    const n = (beispiel(S) as unknown[]).length;
    const element = rohFaelle(d.element).map((f) => ({ ...f, name: `Element: ${f.name}`, eingabe: Array.from({ length: n }, () => f.eingabe) }));
    return [...element, { name: 'lehnt einen Wert ab, der keine Liste ist', eingabe: '__falsch__', erwartet: false }];
  }
  const faelle: Fall[] = [];
  const varianten = d.type === 'union' ? d.options : [S];
  varianten.forEach((v, n) => {
    let b = beispiel(v);
    if (!v.safeParse(b).success) b = beispiel(v, true);
    const etikett = varianten.length > 1 ? `Variante ${n + 1}: ` : '';
    faelle.push({ name: `${etikett}nimmt das Beispiel an`, eingabe: b, erwartet: true });
    if (def(v).type === 'object') faelle.push(...objektFaelle(v, b as Record<string, unknown>, etikett));
  });
  if (['string', 'number', 'boolean'].includes(d.type)) {
    faelle.push({ name: 'lehnt einen Wert vom falschen Typ ab', eingabe: d.type === 'string' ? 12345 : '__falsch__', erwartet: false });
  }
  if (d.type === 'enum') {
    for (const w of Object.values(d.entries)) faelle.push({ name: `nimmt ${String(w)} an`, eingabe: w, erwartet: true });
    faelle.push({ name: 'lehnt einen Wert außerhalb ab', eingabe: '__ausserhalb__', erwartet: false });
  }
  return faelle;
}

// --- Test von Hand aus einer Vertragsdatei (CR-GC-965) ---

const PFLICHT = ['größe', 'einheit', 'min', 'nenn', 'max'] as const;

const zellen = (zeile: string): string[] =>
  zeile
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((z) => z.trim());

const normiert = (kopf: string): string => kopf.toLowerCase().replace('groesse', 'größe');

/** Die Pruefpunkte der ersten Tabelle mit den Pflichtspalten. */
export function pruefpunkte(text: string): { punkte: string[]; verworfen: string[] } {
  const zeilen = text.split('\n');
  const start = zeilen.findIndex((z) => {
    if (!z.trim().startsWith('|')) return false;
    const k = zellen(z).map(normiert);
    return PFLICHT.every((p) => k.includes(p));
  });
  if (start < 0) throw new Error(`keine Vertragstabelle (Spalten Größe, Einheit, Min, Nenn, Max)`);
  const kopf = zellen(zeilen[start] as string).map(normiert);
  const spalte = (zeile: string[], name: string): string => {
    const i = kopf.indexOf(name);
    return i < 0 ? '' : (zeile[i] ?? '');
  };
  const punkte: string[] = [];
  const verworfen: string[] = [];
  for (const roh of zeilen.slice(start + 2)) {
    if (!roh.trim().startsWith('|')) break;
    const z = zellen(roh);
    const [groesse, einheit, min, nenn, max, ort, quelle] = ['größe', 'einheit', 'min', 'nenn', 'max', 'messpunkt', 'quelle'].map(
      (n) => spalte(z, n),
    ) as [string, string, string, string, string, string, string];
    if (!min && !max) {
      verworfen.push(`${groesse}: kein Min und kein Max`);
      continue;
    }
    const grenze = min && max ? `${min} ${einheit} ≤ Wert ≤ ${max} ${einheit}` : min ? `Wert ≥ ${min} ${einheit}` : `Wert ≤ ${max} ${einheit}`;
    const zusatz = [nenn ? `Nenn ${nenn} ${einheit}` : '', quelle ? `Quelle: ${quelle}` : ''].filter(Boolean).join('; ');
    punkte.push(`Miss ${groesse}${ort ? ` am ${ort}` : ''}; bestanden, wenn ${grenze}${zusatz ? ` (${zusatz})` : ''}.`);
  }
  return { punkte, verworfen };
}

/** Der Text der Testdatei von Hand fuer ein SCHEMA mit Vertragsdatei. */
export function testVonHand(v: { id: string; file: string }, punkte: readonly string[]): string {
  return [
    `<!-- erzeugt aus dem Modell (graphcode vertragstest) — ${v.id} → ${v.file}. Nicht von Hand ändern, neu erzeugen. -->`,
    `# Vertragstest ${v.id}`,
    ``,
    `Vertrag: \`${v.file}\`. Der Test läuft von Hand; jeder Prüfpunkt muss bestehen.`,
    ``,
    `## Prüfpunkte`,
    ``,
    ...punkte.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `## Ergebnis`,
    ``,
    `Lege das Protokoll mit Datum, Prüfer und Messwert je Prüfpunkt als Datei ab. Melde es über`,
    `\`graph_test_ingest\` mit \`results: [{ file, result, tool: "manuell", evidence: <Pfad des Protokolls> }]\`.`,
    `Ändert sich der Vertrag, nimmt \`graph_test_ingest({ changeSet: ["${v.id}"] })\` das Ergebnis zurück.`,
    ``,
  ].join('\n');
}

type CodeVertrag = Extract<VertragstestSatz[number], { symbol: string }>;

/** Der Text der vitest-Datei fuer ein SCHEMA. */
export function testDatei(eintrag: CodeVertrag, importPfad: string, faelle: Fall[]): string {
  const zeilen = [
    `// erzeugt aus dem Modell (graphcode vertragstest) — ${eintrag.id} → ${eintrag.file}#${eintrag.symbol}. Nicht von Hand ändern, neu erzeugen.`,
    `import { describe, it, expect } from 'vitest';`,
    `import { ${eintrag.symbol} as S } from '${importPfad}';`,
    ``,
    `describe('Vertrag ${eintrag.id}', () => {`,
  ];
  for (const f of faelle) {
    zeilen.push(`  it(${JSON.stringify(f.name)}, () => {`);
    if (f.erwartet) zeilen.push(`    expect(S.parse(${JSON.stringify(f.eingabe)})).toEqual(${JSON.stringify(f.ausgabe)});`);
    else zeilen.push(`    expect(S.safeParse(${JSON.stringify(f.eingabe)}).success).toBe(false);`);
    zeilen.push(`  });`);
  }
  zeilen.push(`});`, ``);
  return zeilen.join('\n');
}

/**
 * Schreibt je SCHEMA `<id>.vertrag.test.ts` nach `zielDir`, fuer eine Vertragsdatei den Test von Hand
 * `<id>.vertrag.md` (CR-GC-965). `laden(absPfad)` liefert das Modul mit
 * dem Zod-Symbol. Ein Fehler je SCHEMA bricht den Lauf nicht ab; er steht im Bericht.
 */
export async function erzeugeVertragstests(
  satz: VertragstestSatz,
  root: string,
  zielDir: string,
  laden: (absPfad: string) => Promise<Record<string, unknown>>,
): Promise<VertragstestBericht> {
  VertragstestSatzSchema.parse(satz);
  mkdirSync(zielDir, { recursive: true });
  const bericht: VertragstestBericht = [];
  for (const e of satz) {
    try {
      if (!('symbol' in e)) {
        const { punkte, verworfen } = pruefpunkte(readFileSync(join(root, e.file), 'utf8'));
        if (punkte.length === 0) throw new Error('keine Zeile mit Grenzwert');
        const datei = join(zielDir, `${e.id}.vertrag.md`);
        writeFileSync(datei, testVonHand(e, punkte));
        bericht.push({ schema: e.id, datei: relative(root, datei), faelle: punkte.length, verworfen });
        continue;
      }
      const mod = await laden(join(root, e.file));
      const S = mod[e.symbol] as Zod | undefined;
      if (!S?._zod) throw new Error(S ? 'kein Zod-4-Schema' : `Symbol ${e.symbol} nicht exportiert`);
      const { aufgenommen, verworfen } = erzeugeFaelle(S);
      if (!aufgenommen.some((f) => f.erwartet)) throw new Error('kein angenommenes Beispiel');
      const datei = join(zielDir, `${e.id}.vertrag.test.ts`);
      const imp = relative(zielDir, join(root, e.file)).replace(/\.ts$/, '.js');
      writeFileSync(datei, testDatei(e, imp.startsWith('.') ? imp : './' + imp, aufgenommen));
      bericht.push({ schema: e.id, datei: relative(root, datei), faelle: aufgenommen.length, verworfen });
    } catch (err) {
      bericht.push({ schema: e.id, fehler: err instanceof Error ? err.message : String(err) });
    }
  }
  return VertragstestBerichtSchema.parse(bericht);
}
