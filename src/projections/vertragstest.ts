/**
 * vertragstest.ts — Vertragstest je SCHEMA, erzeugt allein aus dem Zod-Schema (zod 4) zur Laufzeit
 * (CR-GC-962; Herkunft graphanalyze, Spike CR-GC-958 G1 Go).
 *
 * Je Schema: ein gueltiges Beispiel, das angenommen wird, und je Objektfeld die Ablehnung ohne Feld,
 * mit falschem Typ und ausserhalb eines Enums, dazu ein unbekanntes Zusatzfeld; je Union-Variante
 * dasselbe. Die Faelle gelten auf jeder Ebene: in verschachtelten Objekten, in den Elementen einer Liste,
 * eines Tupels und eines Records (CR-GC-980). Die Tiefe ist auf `MAX_EBENE` begrenzt, ein rekursives
 * Schema (z.lazy) liefert sein Beispiel ohne optionale Felder; beides steht im Bericht (`begrenzt`).
 * Ein Fall kommt nur in die Datei, wenn das Original-Schema ihn so urteilt, wie der Fall es
 * erwartet; angenommene Faelle frieren die Ausgabe ein. Das Laden der TS-Quellen des Ziel-Repos
 * gehoert dem Aufrufer (`laden`), weil es Node-Flags braucht (vertragstest-verb.ts).
 *
 * Ein SCHEMA mit Vertragsdatei (`realRef {file}` auf `.md` ohne Symbol, Entscheidung CR-GC-961 F3d)
 * bekommt den Test von Hand (CR-GC-965): Die Tabelle traegt Größe, Einheit, Min, Nenn, Max, optional
 * Messpunkt, Quelle und Kriterium (CR-GC-966); je Zeile mit Grenzwert oder Kriterium entsteht ein
 * Pruefpunkt, eine Zeile ohne beides wird verworfen. Das Protokoll eines Laufs liegt getrennt (`evidence`, CR-GC-964).
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

/** Je SCHEMA: wie viele Faelle in der Datei stehen, welche verworfen wurden und wo die Tiefe begrenzt war, oder warum keine entstand. */
export const VertragstestBerichtSchema = z.array(
  z.union([
    z.strictObject({ schema: z.string(), datei: z.string(), faelle: z.number().int().positive(), verworfen: z.array(z.string()), begrenzt: z.array(z.string()) }),
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

/** Das Beispiel eines z.lazy-Schemas, das sich selbst enthaelt, hat kein Ende (CR-GC-980). */
export class RekursionsFehler extends Error {
  constructor() {
    super('rekursives Schema (z.lazy): kein endliches Beispiel');
    this.name = 'RekursionsFehler';
  }
}

/** Ein gueltiges Beispiel; `minimal` laesst optionale Objektfelder und, wo das Schema es erlaubt, Listenelemente weg. */
export function beispiel(schema: unknown, minimal = false, offen: readonly Zod[] = []): unknown {
  const s = schema as Zod;
  const d = def(s);
  const rek = (x: unknown, m = minimal): unknown => beispiel(x, m, offen);
  if (minimal && d.type === 'object') {
    return Object.fromEntries(
      Object.entries(d.shape)
        .filter(([, v]) => !v.safeParse(undefined).success)
        .map(([k, v]) => [k, rek(v, true)]),
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
      const n = c.find((x) => x.check === 'length_equals')?.length ?? c.find((x) => x.check === 'min_length')?.minimum ?? (minimal ? 0 : 1);
      return Array.from({ length: minimal ? n : Math.max(n, 1) }, () => rek(d.element));
    }
    case 'tuple':
      return d.items.map((x) => rek(x));
    case 'record': {
      const k = rek(d.keyType);
      return { [typeof k === 'string' ? k : 'k']: rek(d.valueType) };
    }
    case 'object':
      return Object.fromEntries(Object.entries(d.shape).map(([k, v]) => [k, rek(v)]));
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return rek(d.innerType);
    case 'union':
      return rek(d.options[0]);
    case 'pipe':
      return rek(d.in);
    case 'lazy': {
      if (offen.includes(s)) throw new RekursionsFehler();
      return beispiel(d.getter(), minimal, [...offen, s]);
    }
    case 'date':
      return new Date('2026-01-01');
    default:
      throw new Error(`Typ ${d.type} nicht unterstuetzt`);
  }
}

const WRAPPER = ['optional', 'nullable', 'default'];
const kern = (s: Zod): Zod => (WRAPPER.includes(def(s).type) ? kern(def(s).innerType) : s);
const HUELLE = [...WRAPPER, 'prefault', 'catch', 'readonly', 'nonoptional'];

/** Tiefste Ebene, auf der der Erzeuger noch Faelle bildet; darunter steht eine Meldung im Bericht. */
export const MAX_EBENE = 8;

/** Wo der Erzeuger steht: Pfad im Beispiel, Weg zurueck zur Wurzel, Ebene, Meldungen. */
interface Stelle {
  pfad: string;
  ebene: number;
  /** Setzt einen Teilwert an diese Stelle des Beispiels und liefert die ganze Eingabe. */
  einsetzen: (teil: unknown) => unknown;
  /** Der Erzeuger bildet den Typfall dieser Stelle selbst; bei einem Objektfeld bildet ihn das Objekt. */
  eigenerTypfall: boolean;
  begrenzt: string[];
}

const falschWie = (wert: unknown): unknown => (typeof wert === 'string' ? 12345 : '__falsch__');
const benannt = (st: Stelle, text: string): string => (st.pfad ? `${st.pfad}: ${text}` : text);
const tiefer = (st: Stelle, pfad: string, einsetzen: (teil: unknown) => unknown, eigenerTypfall: boolean): Stelle => ({
  ...st,
  pfad,
  ebene: st.ebene + 1,
  einsetzen,
  eigenerTypfall,
});

/** Das gueltige Beispiel einer Variante oder eines Teilschemas; ein Schema ohne endliches Beispiel meldet sich ueber `RekursionsFehler`. */
function gueltigesBeispiel(v: Zod, st: Stelle): unknown {
  let b: unknown;
  try {
    b = beispiel(v);
  } catch (e) {
    if (!(e instanceof RekursionsFehler)) throw e;
    st.begrenzt.push(`${st.pfad || 'Wurzel'}: rekursives Schema (z.lazy), Beispiel ohne optionale Felder`);
    return beispiel(v, true);
  }
  return v.safeParse(b).success ? b : beispiel(v, true);
}

/** Die Faelle zu einem Knoten des Schemas und seinem Beispielwert; jeder Fall ist die ganze Eingabe. */
function knoten(s: Zod, wert: unknown, st: Stelle): Fall[] {
  const d = def(s);
  if (HUELLE.includes(d.type)) return knoten(d.innerType, wert, st);
  if (d.type === 'pipe') return knoten(d.in, wert, st);
  if (d.type === 'lazy') return knoten(d.getter(), wert, st);
  if (st.ebene > MAX_EBENE) {
    st.begrenzt.push(`${st.pfad}: Tiefe ${MAX_EBENE} erreicht, darunter keine Fälle`);
    return [];
  }
  const faelle: Fall[] = [];
  if (d.type === 'union') {
    d.options.forEach((opt, n) => {
      const b = gueltigesBeispiel(opt, st);
      const vp = d.options.length > 1 ? (st.pfad ? `${st.pfad} (Variante ${n + 1})` : `Variante ${n + 1}`) : st.pfad;
      const vs: Stelle = { ...st, pfad: vp, eigenerTypfall: false };
      faelle.push({ name: benannt(vs, 'nimmt das Beispiel an'), eingabe: st.einsetzen(b), erwartet: true });
      faelle.push(...knoten(opt, b, { ...vs, ebene: st.ebene + 1 }));
    });
    return faelle;
  }
  if (d.type === 'object') {
    const b = wert as Record<string, unknown>;
    if (st.eigenerTypfall) faelle.push({ name: benannt(st, 'lehnt einen Wert ab, der kein Objekt ist'), eingabe: st.einsetzen('__falsch__'), erwartet: false });
    for (const k of Object.keys(d.shape)) {
      const feld = d.shape[k] as Zod;
      if (k in b) {
        const ohne = { ...b };
        delete ohne[k];
        faelle.push({ name: benannt(st, `lehnt ab ohne ${k}`), eingabe: st.einsetzen(ohne), erwartet: false });
      }
      faelle.push({ name: benannt(st, `lehnt ab: ${k} mit falschem Typ`), eingabe: st.einsetzen({ ...b, [k]: falschWie(b[k]) }), erwartet: false });
      if (def(kern(feld)).type === 'enum') {
        faelle.push({ name: benannt(st, `lehnt ab: ${k} außerhalb des Enums`), eingabe: st.einsetzen({ ...b, [k]: '__ausserhalb__' }), erwartet: false });
      }
      if (k in b) {
        faelle.push(...knoten(feld, b[k], tiefer(st, st.pfad ? `${st.pfad}.${k}` : k, (t) => st.einsetzen({ ...b, [k]: t }), false)));
      }
    }
    faelle.push({ name: benannt(st, 'lehnt ab: unbekanntes Zusatzfeld'), eingabe: st.einsetzen({ ...b, __zusatz__: 1 }), erwartet: false });
    return faelle;
  }
  if (d.type === 'array') {
    const a = wert as unknown[];
    if (st.eigenerTypfall) faelle.push({ name: benannt(st, 'lehnt einen Wert ab, der keine Liste ist'), eingabe: st.einsetzen('__falsch__'), erwartet: false });
    if (a.length > 0) {
      const el = tiefer(st, `${st.pfad}[]`, (t) => st.einsetzen(a.map((x, i) => (i === 0 ? t : x))), true);
      faelle.push(...knoten(d.element, a[0], el));
    }
    return faelle;
  }
  if (d.type === 'tuple') {
    const a = wert as unknown[];
    if (st.eigenerTypfall) faelle.push({ name: benannt(st, 'lehnt einen Wert ab, der kein Tupel ist'), eingabe: st.einsetzen('__falsch__'), erwartet: false });
    if (a.length > 0) faelle.push({ name: benannt(st, 'lehnt ab: Tupel zu kurz'), eingabe: st.einsetzen(a.slice(0, -1)), erwartet: false });
    d.items.forEach((item, i) => {
      const el = tiefer(st, `${st.pfad}[${i}]`, (t) => st.einsetzen(a.map((x, j) => (j === i ? t : x))), true);
      faelle.push(...knoten(item, a[i], el));
    });
    return faelle;
  }
  if (d.type === 'record') {
    const r = wert as Record<string, unknown>;
    const schluessel = Object.keys(r)[0] as string;
    if (st.eigenerTypfall) faelle.push({ name: benannt(st, 'lehnt einen Wert ab, der kein Record ist'), eingabe: st.einsetzen('__falsch__'), erwartet: false });
    faelle.push(...knoten(d.valueType, r[schluessel], tiefer(st, `${st.pfad}{}`, (t) => st.einsetzen({ [schluessel]: t }), true)));
    return faelle;
  }
  if (['string', 'number', 'boolean'].includes(d.type) && st.eigenerTypfall) {
    faelle.push({ name: benannt(st, 'lehnt einen Wert vom falschen Typ ab'), eingabe: st.einsetzen(falschWie(wert)), erwartet: false });
  }
  if (d.type === 'enum' && st.eigenerTypfall) {
    for (const w of Object.values(d.entries)) faelle.push({ name: benannt(st, `nimmt ${String(w)} an`), eingabe: st.einsetzen(w), erwartet: true });
    faelle.push({ name: benannt(st, 'lehnt einen Wert außerhalb ab'), eingabe: st.einsetzen('__ausserhalb__'), erwartet: false });
  }
  return faelle;
}

/** Alle Faelle eines Schemas; aufgenommen wird nur, was das Original so urteilt. `begrenzt` nennt Stellen, an denen die Tiefe oder ein z.lazy den Umfang beschnitt. */
export function erzeugeFaelle(schema: unknown): { aufgenommen: Fall[]; verworfen: string[]; begrenzt: string[] } {
  const S = schema as Zod;
  const aufgenommen: Fall[] = [];
  const verworfen: string[] = [];
  const begrenzt: string[] = [];
  for (const f of rohFaelle(S, begrenzt)) {
    const r = S.safeParse(f.eingabe);
    if (r.success === f.erwartet) aufgenommen.push(f.erwartet ? { ...f, ausgabe: r.data } : f);
    else verworfen.push(f.name);
  }
  return { aufgenommen, verworfen, begrenzt };
}

/** Die Faelle vor dem Urteil des Originals: das Beispiel der Wurzel, dazu die Faelle jeder Ebene darunter. */
function rohFaelle(S: Zod, begrenzt: string[]): Fall[] {
  const st: Stelle = { pfad: '', ebene: 0, einsetzen: (t) => t, eigenerTypfall: true, begrenzt };
  let offen: Zod = S;
  while (HUELLE.includes(def(offen).type) || ['pipe', 'lazy'].includes(def(offen).type)) {
    const d = def(offen);
    offen = d.type === 'pipe' ? d.in : d.type === 'lazy' ? d.getter() : d.innerType;
  }
  const b = gueltigesBeispiel(S, st);
  const faelle: Fall[] = [];
  if (def(offen).type !== 'union') faelle.push({ name: 'nimmt das Beispiel an', eingabe: b, erwartet: true });
  faelle.push(...knoten(S, b, st));
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
    const [groesse, einheit, min, nenn, max, ort, quelle, kriterium] = [
      'größe', 'einheit', 'min', 'nenn', 'max', 'messpunkt', 'quelle', 'kriterium',
    ].map((n) => spalte(z, n)) as [string, string, string, string, string, string, string, string];
    if (!min && !max && !kriterium) {
      verworfen.push(`${groesse}: kein Min, kein Max und kein Kriterium`);
      continue;
    }
    const grenze = min && max ? `${min} ${einheit} ≤ Wert ≤ ${max} ${einheit}` : min ? `Wert ≥ ${min} ${einheit}` : max ? `Wert ≤ ${max} ${einheit}` : '';
    const bedingung = [grenze, kriterium].filter(Boolean).join(' und ');
    const zusatz = [nenn ? `Nenn ${nenn} ${einheit}` : '', quelle ? `Quelle: ${quelle}` : ''].filter(Boolean).join('; ');
    const verb = grenze ? 'Miss' : 'Prüfe';
    punkte.push(`${verb} ${groesse}${ort ? ` (Messpunkt: ${ort})` : ''}. Bestanden, wenn ${bedingung}.${zusatz ? ` ${zusatz}.` : ''}`);
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
        bericht.push({ schema: e.id, datei: relative(root, datei), faelle: punkte.length, verworfen, begrenzt: [] });
        continue;
      }
      const mod = await laden(join(root, e.file));
      const S = mod[e.symbol] as Zod | undefined;
      if (!S?._zod) throw new Error(S ? 'kein Zod-4-Schema' : `Symbol ${e.symbol} nicht exportiert`);
      const { aufgenommen, verworfen, begrenzt } = erzeugeFaelle(S);
      if (!aufgenommen.some((f) => f.erwartet)) throw new Error('kein angenommenes Beispiel');
      const datei = join(zielDir, `${e.id}.vertrag.test.ts`);
      const imp = relative(zielDir, join(root, e.file)).replace(/\.ts$/, '.js');
      writeFileSync(datei, testDatei(e, imp.startsWith('.') ? imp : './' + imp, aufgenommen));
      bericht.push({ schema: e.id, datei: relative(root, datei), faelle: aufgenommen.length, verworfen, begrenzt });
    } catch (err) {
      bericht.push({ schema: e.id, fehler: err instanceof Error ? err.message : String(err) });
    }
  }
  return VertragstestBerichtSchema.parse(bericht);
}
