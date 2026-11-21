/**
 * vertragstest.ts — Vertragstest je SCHEMA, erzeugt allein aus dem Zod-Schema (zod 4) zur Laufzeit
 * (CR-GC-962; Herkunft graphanalyze, Spike CR-GC-958 G1 Go).
 *
 * Je Schema: ein gueltiges Beispiel, das angenommen wird, und je Objektfeld die Ablehnung ohne Feld
 * (bei einem optionalen Feld die Annahme ohne Feld), mit falschem Typ und ausserhalb eines Enums, dazu
 * ein unbekanntes Zusatzfeld; je Union-Variante dasselbe. Die Faelle gelten auf jeder Ebene: in verschachtelten Objekten, in den Elementen einer Liste,
 * eines Tupels und eines Records (CR-GC-980). Die Tiefe ist auf `MAX_EBENE` begrenzt, ein rekursives
 * Schema (z.lazy) liefert sein Beispiel ohne optionale Felder; beides steht im Bericht (`begrenzt`).
 * Ein Fall kommt nur in die Datei, wenn das Original-Schema ihn so urteilt, wie der Fall es
 * erwartet; angenommene Faelle frieren die Ausgabe ein. Das Laden der TS-Quellen des Ziel-Repos
 * gehoert dem Aufrufer (`laden`), weil es Node-Flags braucht (vertragstest-verb.ts).
 *
 * Ein SCHEMA mit `external: true` und `realRef` nach `packages/<name>/src/…` liegt als npm-Paket
 * `@sigloch/<name>` vor (CR-GC-981): `loeseAuf` waehlt den Export des installierten Pakets, dessen
 * Verzeichnis die Datei des realRef enthaelt, und der Test importiert aus dem Paketnamen.
 *
 * Ein SCHEMA mit Vertragsdatei (`realRef {file}` auf `.md` ohne Symbol, Entscheidung CR-GC-961 F3d)
 * bekommt den Test von Hand (CR-GC-965): Die Tabelle traegt Größe, Einheit, Min, Nenn, Max, optional
 * Messpunkt, Quelle und Kriterium (CR-GC-966); je Zeile mit Grenzwert oder Kriterium entsteht ein
 * Pruefpunkt, eine Zeile ohne beides wird verworfen. Das Protokoll eines Laufs liegt getrennt (`evidence`, CR-GC-964).
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { z } from 'zod';

/** Ein SCHEMA des Modells mit seinem Zod-Symbol im Code, im Paket (`paket`) oder mit seiner Vertragsdatei (`.md`, ohne Symbol). */
export const VertragstestSatzSchema = z.array(
  z.union([
    z.strictObject({ id: z.string().min(1), file: z.string().min(1), symbol: z.string().min(1) }),
    z.strictObject({ id: z.string().min(1), file: z.string().regex(/^packages\/[a-z0-9-]+\/src\/.+\.ts$/), symbol: z.string().min(1), paket: z.string().regex(/^@sigloch\/[a-z0-9-]+$/) }),
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
/** Ein Schritt im Schema von der Wurzel zu einer Stelle: Feld der Definition, bei Objekt, Tupel und Union mit Schluessel. */
export type Schritt = [string, (string | number)?];
interface Fall {
  name: string;
  eingabe: unknown;
  erwartet: boolean;
  ausgabe?: unknown;
  /** Kein Parse-Fall: die Werteliste des Enums an dieser Stelle (CR-GC-987). */
  enumWerte?: { weg: Schritt[]; liste: unknown[] };
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
    case 'void':
      return undefined;
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
  /** Wertregeln, zu denen der Erzeuger keinen sicheren Fall bilden konnte (CR-GC-987). */
  ungebildet: string[];
  /** Der Weg im Schema von der Wurzel zu dieser Stelle. */
  weg: Schritt[];
}

const falschWie = (wert: unknown): unknown => (typeof wert === 'string' ? 12345 : '__falsch__');
const benannt = (st: Stelle, text: string): string => (st.pfad ? `${st.pfad}: ${text}` : text);
const tiefer = (st: Stelle, pfad: string, einsetzen: (teil: unknown) => unknown, eigenerTypfall: boolean, schritt: Schritt): Stelle => ({
  ...st,
  pfad,
  ebene: st.ebene + 1,
  einsetzen,
  eigenerTypfall,
  weg: [...st.weg, schritt],
});
const hinein = (st: Stelle, schritt: Schritt): Stelle => ({ ...st, weg: [...st.weg, schritt] });

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

/** Laengere Texte und Listen bildet der Erzeuger nicht; die Grenze steht im Bericht. */
const MAX_LAENGE = 1000;

const langText = (n: number): string => 'x'.repeat(n);

/** Untere und obere Laenge aus `min_length`, `max_length` und `length_equals`. */
function laengen(c: Check[]): { lo: number; hi: number; geregelt: boolean } {
  const art = c.filter((x) => x.check === 'min_length' || x.check === 'max_length' || x.check === 'length_equals');
  const lo = Math.max(0, ...art.filter((x) => x.check === 'min_length').map((x) => x.minimum ?? 0), ...art.filter((x) => x.check === 'length_equals').map((x) => x.length ?? 0));
  const hi = Math.min(Infinity, ...art.filter((x) => x.check === 'max_length').map((x) => x.maximum ?? Infinity), ...art.filter((x) => x.check === 'length_equals').map((x) => x.length ?? Infinity));
  return { lo, hi, geregelt: art.length > 0 };
}

/** Faelle an den Grenzen einer Laenge: knapp ausserhalb abgelehnt, auf der Grenze angenommen; `bilde(n)` baut einen Wert der Laenge n. */
function laengenFaelle(c: Check[], st: Stelle, was: string, einheit: string, bilde: (n: number) => unknown): Fall[] {
  const { lo, hi } = laengen(c);
  const faelle: Fall[] = [];
  const gesehen = new Set<string>();
  const fall = (text: string, n: number, erwartet: boolean): void => {
    const eingabe = st.einsetzen(bilde(n));
    const schluessel = JSON.stringify(eingabe) + erwartet;
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    faelle.push({ name: benannt(st, text), eingabe, erwartet });
  };
  if (lo > 0) fall(`lehnt ab: ${was} mit ${lo - 1} ${einheit} (unter der Mindestlänge ${lo})`, lo - 1, false);
  fall(`nimmt ${was} mit ${lo} ${einheit} an (Untergrenze)`, lo, true);
  if (hi < Infinity) {
    if (hi > MAX_LAENGE) {
      st.ungebildet.push(`${st.pfad || 'Wurzel'}: Obergrenze ${hi} über ${MAX_LAENGE}, kein Fall an der Obergrenze`);
    } else {
      fall(`nimmt ${was} mit ${hi} ${einheit} an (Obergrenze)`, hi, true);
      fall(`lehnt ab: ${was} mit ${hi + 1} ${einheit} (über der Obergrenze ${hi})`, hi + 1, false);
    }
  }
  return faelle;
}

/** Faelle zu den Laengenregeln einer Liste. */
function listenFaelle(s: Zod, element: unknown, st: Stelle): Fall[] {
  return laengenFaelle(checks(s), st, 'Liste', 'Elementen', (n) => Array.from({ length: n }, () => element));
}

/** Faelle zu Laenge, Format und Regex eines Textes. Ein Text mit Format oder Regex bekommt keine Laengenfaelle: der Wert muss beides erfuellen. */
function textFaelle(s: Zod, st: Stelle): Fall[] {
  const d = def(s);
  const c = checks(s);
  const regexe = c.filter((x) => x.format === 'regex' && x.pattern);
  const fmt = d.format ?? c.find((x) => x.format && x.format !== 'regex')?.format;
  const { lo, hi, geregelt } = laengen(c);
  const faelle: Fall[] = [];
  const fall = (text: string, eingabe: string, erwartet: boolean): void => {
    faelle.push({ name: benannt(st, text), eingabe: st.einsetzen(eingabe), erwartet });
  };
  if (regexe.length === 0 && !fmt) {
    faelle.push(...laengenFaelle(c, st, 'Text', 'Zeichen', langText));
  } else if (geregelt) {
    st.ungebildet.push(`${st.pfad || 'Wurzel'}: Längenregel an einem Text mit Format oder Regex, kein sicherer Fall`);
  }
  if (fmt && regexe.length === 0 && FORMATE[fmt] !== undefined) {
    if (geregelt) st.ungebildet.push(`${st.pfad || 'Wurzel'}: Format ${fmt} mit Längenregel, kein verletzender Text`);
    else fall(`lehnt ab: Text ohne das Format ${fmt}`, '__kein_format__', false);
  }
  const KANDIDATEN = ['!', '__verletzt__', '', ' ', '0', 'a', 'A', '\n'];
  for (const r of regexe) {
    const treffer = (t: string, re: RegExp): boolean => new RegExp(re.source, re.flags.replace(/[gy]/g, '')).test(t);
    const text = KANDIDATEN.find((t) => !treffer(t, r.pattern as RegExp) && regexe.every((o) => o === r || treffer(t, o.pattern as RegExp)) && t.length >= lo && t.length <= hi);
    if (text === undefined) st.ungebildet.push(`${st.pfad || 'Wurzel'}: Regex ${r.pattern}: kein verletzender Text bildbar`);
    else fall(`lehnt ab: Text verletzt die Regel ${String(r.pattern)}`, text, false);
  }
  return faelle;
}

/** Faelle zu Grenzen und Ganzzahl-Regel einer Zahl: je Grenze knapp ausserhalb abgelehnt, auf der Grenze angenommen. */
function zahlFaelle(s: Zod, wert: unknown, st: Stelle): Fall[] {
  const d = def(s);
  const c = checks(s);
  // Je Richtung zaehlt die engste Grenze (bei Gleichstand die ausgeschlossene); eine weitere, weitere Grenze aendert das Urteil nie.
  const engste = (art: string, vorzeichen: 1 | -1): Check[] => {
    const alle = c.filter((x) => x.check === art && x.value !== undefined);
    const best = alle.reduce<Check | undefined>((b, x) => {
      if (!b) return x;
      const d = ((x.value as number) - (b.value as number)) * vorzeichen;
      return d > 0 || (d === 0 && b.inclusive && !x.inclusive) ? x : b;
    }, undefined);
    return best ? [best] : [];
  };
  const unten = engste('greater_than', 1);
  const oben = engste('less_than', -1);
  const ganz = Boolean(d.format?.includes('int')) || c.some((x) => x.check === 'number_format' && x.format?.includes('int'));
  const schritt = ganz ? 1 : 0.001;
  const faelle: Fall[] = [];
  const hält = (x: number, auch: Check | undefined, ohneGanz = false): boolean =>
    (ohneGanz || !ganz || Number.isInteger(x)) &&
    c.filter((u) => u.check === 'greater_than' && u.value !== undefined).every((u) => u === auch || (u.inclusive ? x >= (u.value as number) : x > (u.value as number))) &&
    c.filter((o) => o.check === 'less_than' && o.value !== undefined).every((o) => o === auch || (o.inclusive ? x <= (o.value as number) : x < (o.value as number)));
  const fall = (text: string, x: number, erwartet: boolean): void => {
    faelle.push({ name: benannt(st, text), eingabe: st.einsetzen(x), erwartet });
  };
  const ohne = (was: string): void => {
    st.ungebildet.push(`${st.pfad || 'Wurzel'}: ${was}, kein sicherer Fall`);
  };
  for (const u of unten) {
    const v = u.value as number;
    const aussen = u.inclusive ? v - schritt : v;
    if (hält(aussen, u)) fall(`lehnt ab: ${aussen} ${u.inclusive ? 'unter' : 'auf'} der ${u.inclusive ? 'Untergrenze' : 'ausgeschlossenen Untergrenze'} ${v}`, aussen, false);
    else ohne(`Untergrenze ${v}`);
    const innen = u.inclusive ? v : v + schritt;
    if (hält(innen, undefined)) fall(`nimmt ${innen} an (kleinster erlaubter Wert, Untergrenze ${v})`, innen, true);
    else ohne(`kleinster erlaubter Wert über ${v}`);
  }
  for (const o of oben) {
    const v = o.value as number;
    const aussen = o.inclusive ? v + schritt : v;
    if (hält(aussen, o)) fall(`lehnt ab: ${aussen} ${o.inclusive ? 'über' : 'auf'} der ${o.inclusive ? 'Obergrenze' : 'ausgeschlossenen Obergrenze'} ${v}`, aussen, false);
    else ohne(`Obergrenze ${v}`);
    const innen = o.inclusive ? v : v - schritt;
    if (hält(innen, undefined)) fall(`nimmt ${innen} an (größter erlaubter Wert, Obergrenze ${v})`, innen, true);
    else ohne(`größter erlaubter Wert unter ${v}`);
  }
  if (ganz) {
    const w = typeof wert === 'number' ? wert : 1;
    const x = [w + 0.5, w - 0.5, 0.5].find((k) => hält(k, undefined, true));
    if (x === undefined) ohne('Ganzzahl-Regel');
    else fall(`lehnt ab: ${x} ist keine ganze Zahl`, x, false);
  }
  return faelle;
}

/** Die Faelle zu einem Knoten des Schemas und seinem Beispielwert; jeder Fall ist die ganze Eingabe. */
function knoten(s: Zod, wert: unknown, st: Stelle): Fall[] {
  const d = def(s);
  if (HUELLE.includes(d.type)) {
    const innen = knoten(d.innerType, wert, hinein(st, ['innerType']));
    if (d.type !== 'nullable') return innen;
    return [{ name: benannt(st, 'nimmt null an'), eingabe: st.einsetzen(null), erwartet: true }, ...innen];
  }
  if (d.type === 'pipe') return knoten(d.in, wert, hinein(st, ['in']));
  if (d.type === 'lazy') return knoten(d.getter(), wert, hinein(st, ['getter']));
  if (st.ebene > MAX_EBENE) {
    st.begrenzt.push(`${st.pfad}: Tiefe ${MAX_EBENE} erreicht, darunter keine Fälle`);
    return [];
  }
  const faelle: Fall[] = [];
  if (d.type === 'union') {
    d.options.forEach((opt, n) => {
      const b = gueltigesBeispiel(opt, st);
      const vp = d.options.length > 1 ? (st.pfad ? `${st.pfad} (Variante ${n + 1})` : `Variante ${n + 1}`) : st.pfad;
      const vs: Stelle = { ...st, pfad: vp, eigenerTypfall: false, weg: [...st.weg, ['options', n]] };
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
        const darfFehlen = feld.safeParse(undefined).success;
        faelle.push({ name: benannt(st, darfFehlen ? `nimmt an ohne ${k} (optional)` : `lehnt ab ohne ${k}`), eingabe: st.einsetzen(ohne), erwartet: darfFehlen });
      }
      faelle.push({ name: benannt(st, `lehnt ab: ${k} mit falschem Typ`), eingabe: st.einsetzen({ ...b, [k]: falschWie(b[k]) }), erwartet: false });
      if (def(kern(feld)).type === 'enum') {
        faelle.push({ name: benannt(st, `lehnt ab: ${k} außerhalb des Enums`), eingabe: st.einsetzen({ ...b, [k]: '__ausserhalb__' }), erwartet: false });
      }
      if (k in b) {
        faelle.push(...knoten(feld, b[k], tiefer(st, st.pfad ? `${st.pfad}.${k}` : k, (t) => st.einsetzen({ ...b, [k]: t }), false, ['shape', k])));
      }
    }
    faelle.push({ name: benannt(st, 'lehnt ab: unbekanntes Zusatzfeld'), eingabe: st.einsetzen({ ...b, __zusatz__: 1 }), erwartet: false });
    return faelle;
  }
  if (d.type === 'array') {
    const a = wert as unknown[];
    if (st.eigenerTypfall) faelle.push({ name: benannt(st, 'lehnt einen Wert ab, der keine Liste ist'), eingabe: st.einsetzen('__falsch__'), erwartet: false });
    if (a.length > 0) {
      const el = tiefer(st, `${st.pfad}[]`, (t) => st.einsetzen(a.map((x, i) => (i === 0 ? t : x))), true, ['element']);
      faelle.push(...knoten(d.element, a[0], el));
    }
    faelle.push(...listenFaelle(s, a.length > 0 ? a[0] : gueltigesBeispiel(d.element, st), st));
    return faelle;
  }
  if (d.type === 'tuple') {
    const a = wert as unknown[];
    if (st.eigenerTypfall) faelle.push({ name: benannt(st, 'lehnt einen Wert ab, der kein Tupel ist'), eingabe: st.einsetzen('__falsch__'), erwartet: false });
    if (a.length > 0) faelle.push({ name: benannt(st, 'lehnt ab: Tupel zu kurz'), eingabe: st.einsetzen(a.slice(0, -1)), erwartet: false });
    d.items.forEach((item, i) => {
      const el = tiefer(st, `${st.pfad}[${i}]`, (t) => st.einsetzen(a.map((x, j) => (j === i ? t : x))), true, ['items', i]);
      faelle.push(...knoten(item, a[i], el));
    });
    return faelle;
  }
  if (d.type === 'record') {
    const r = wert as Record<string, unknown>;
    const schluessel = Object.keys(r)[0] as string;
    if (st.eigenerTypfall) faelle.push({ name: benannt(st, 'lehnt einen Wert ab, der kein Record ist'), eingabe: st.einsetzen('__falsch__'), erwartet: false });
    faelle.push({ name: benannt(st, 'nimmt einen leeren Record an'), eingabe: st.einsetzen({}), erwartet: true });
    faelle.push(...knoten(d.valueType, r[schluessel], tiefer(st, `${st.pfad}{}`, (t) => st.einsetzen({ [schluessel]: t }), true, ['valueType'])));
    return faelle;
  }
  if (['string', 'number', 'boolean', 'void'].includes(d.type) && st.eigenerTypfall) {
    faelle.push({ name: benannt(st, 'lehnt einen Wert vom falschen Typ ab'), eingabe: st.einsetzen(falschWie(wert)), erwartet: false });
  }
  if (d.type === 'enum') {
    // Ein Wert mehr im Enum laesst sich durch keinen Parse-Fall fassen: die Werteliste selbst wird eingefroren.
    faelle.push({ name: benannt(st, 'Werteliste unverändert'), eingabe: null, erwartet: true, enumWerte: { weg: st.weg, liste: Object.values(d.entries) } });
    if (st.eigenerTypfall) {
      for (const w of Object.values(d.entries)) faelle.push({ name: benannt(st, `nimmt ${String(w)} an`), eingabe: st.einsetzen(w), erwartet: true });
      faelle.push({ name: benannt(st, 'lehnt einen Wert außerhalb ab'), eingabe: st.einsetzen('__ausserhalb__'), erwartet: false });
    }
  }
  if (d.type === 'string') faelle.push(...textFaelle(s, st));
  if (d.type === 'number') faelle.push(...zahlFaelle(s, wert, st));
  return faelle;
}

/** Alle Faelle eines Schemas; aufgenommen wird nur, was das Original so urteilt. `begrenzt` nennt Stellen, an denen die Tiefe oder ein z.lazy den Umfang beschnitt. */
export function erzeugeFaelle(schema: unknown): { aufgenommen: Fall[]; verworfen: string[]; begrenzt: string[] } {
  const S = schema as Zod;
  const aufgenommen: Fall[] = [];
  const verworfen: string[] = [];
  const begrenzt: string[] = [];
  for (const f of rohFaelle(S, begrenzt, verworfen)) {
    if (f.enumWerte) {
      aufgenommen.push(f);
      continue;
    }
    const r = S.safeParse(f.eingabe);
    if (r.success === f.erwartet) aufgenommen.push(f.erwartet ? { ...f, ausgabe: r.data } : f);
    else verworfen.push(f.name);
  }
  return { aufgenommen, verworfen, begrenzt };
}

/** Die Faelle vor dem Urteil des Originals: das Beispiel der Wurzel, dazu die Faelle jeder Ebene darunter. */
function rohFaelle(S: Zod, begrenzt: string[], ungebildet: string[]): Fall[] {
  const st: Stelle = { pfad: '', ebene: 0, einsetzen: (t) => t, eigenerTypfall: true, begrenzt, ungebildet, weg: [] };
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

/** Liest ein Teilschema ueber den Weg von der Wurzel; dient dem Enum-Fall (CR-GC-987). */
const ENUM_HELFER = [
  `interface Z { _zod: { def: Record<string, unknown> } }`,
  `const bei = (weg: Array<[string, (string | number)?]>): Z =>`,
  `  weg.reduce<Z>((s, [art, k]) => {`,
  `    const d = s._zod.def;`,
  `    if (art === 'getter') return (d.getter as () => Z)();`,
  `    return k === undefined ? (d[art] as Z) : (d[art] as Record<string | number, Z>)[k]!;`,
  `  }, S as unknown as Z);`,
];

/** Der Text der vitest-Datei fuer ein SCHEMA. */
export function testDatei(eintrag: CodeVertrag, importPfad: string, faelle: Fall[]): string {
  const zeilen = [
    `// erzeugt aus dem Modell (graphcode vertragstest) — ${eintrag.id} → ${eintrag.file}#${eintrag.symbol}. Nicht von Hand ändern, neu erzeugen.`,
    `import { describe, it, expect } from 'vitest';`,
    `import { ${eintrag.symbol} as S } from '${importPfad}';`,
    ``,
    `describe('Vertrag ${eintrag.id}', () => {`,
  ];
  if (faelle.some((f) => f.enumWerte)) zeilen.splice(4, 0, ...ENUM_HELFER, ``);
  for (const f of faelle) {
    zeilen.push(`  it(${JSON.stringify(f.name)}, () => {`);
    if (f.enumWerte) zeilen.push(`    expect(Object.values(bei(${JSON.stringify(f.enumWerte.weg)})._zod.def.entries as Record<string, unknown>)).toEqual(${JSON.stringify(f.enumWerte.liste)});`);
    else if (f.erwartet) zeilen.push(`    expect(S.parse(${JSON.stringify(f.eingabe)})).toEqual(${JSON.stringify(f.ausgabe)});`);
    else zeilen.push(`    expect(S.safeParse(${JSON.stringify(f.eingabe)}).success).toBe(false);`);
    zeilen.push(`  });`);
  }
  zeilen.push(`});`, ``);
  return zeilen.join('\n');
}

type PaketVertrag = Extract<VertragstestSatz[number], { paket: string }>;

/** Ziel eines Eintrags in `exports`: Text, oder die Bedingung `default`/`import`. */
const exportZiel = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v;
  const o = v as { default?: unknown; import?: unknown } | null;
  const z = o?.default ?? o?.import;
  return typeof z === 'string' ? z : undefined;
};

/**
 * Der Paket-Spezifikator eines external-SCHEMA. Aus `packages/<name>/src/<pfad>.ts` wird `dist/<pfad>.js`;
 * in Frage kommen die Exports des installierten Pakets, deren Zielverzeichnis dieses Verzeichnis enthaelt,
 * davon die mit dem laengsten. Genau einer von ihnen muss das Symbol tragen; sonst Fehler mit der Liste.
 * Kein Fallback auf einen anderen Export.
 */
async function loeseAuf(
  e: PaketVertrag,
  root: string,
  laden: (ziel: string) => Promise<Record<string, unknown>>,
): Promise<{ spezifikator: string; modul: Record<string, unknown> }> {
  const manifest = join(root, 'node_modules', e.paket, 'package.json');
  if (!existsSync(manifest)) throw new Error(`Paket ${e.paket} nicht installiert (${relative(root, manifest)} fehlt)`);
  const pj = JSON.parse(readFileSync(manifest, 'utf8')) as { exports?: unknown };
  const exportsMap: Record<string, unknown> = typeof pj.exports === 'string' ? { '.': pj.exports } : ((pj.exports ?? {}) as Record<string, unknown>);
  const dist = 'dist/' + e.file.replace(/^packages\/[^/]+\/src\//, '').replace(/\.ts$/, '.js');
  const dir = (z: string): string => posix.dirname(posix.normalize(z));
  const zuordnung = Object.entries(exportsMap)
    .map(([k, v]) => ({ k, ziel: exportZiel(v) }))
    .filter((x): x is { k: string; ziel: string } => x.ziel !== undefined && (dir(x.ziel) === '.' ? false : (dir(dist) + '/').startsWith(dir(x.ziel) + '/')));
  const tiefste = Math.max(-1, ...zuordnung.map((x) => dir(x.ziel).length));
  const kandidaten = zuordnung.filter((x) => dir(x.ziel).length === tiefste).map((x) => (x.k === '.' ? e.paket : e.paket + x.k.slice(1)));
  if (kandidaten.length === 0) throw new Error(`Kein Export von ${e.paket} deckt ${dist} ab (exports: ${Object.keys(exportsMap).join(', ') || 'keine'})`);
  const treffer: Array<{ spezifikator: string; modul: Record<string, unknown> }> = [];
  const nichtLadbar: string[] = [];
  for (const spezifikator of kandidaten) {
    try {
      const modul = await laden(spezifikator);
      if (e.symbol in modul) treffer.push({ spezifikator, modul });
    } catch (err) {
      nichtLadbar.push(`${spezifikator}: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    }
  }
  if (treffer.length > 1) throw new Error(`Symbol ${e.symbol} steht in mehreren Exports von ${e.paket}: ${treffer.map((t) => t.spezifikator).join(', ')}`);
  if (treffer.length === 0) {
    throw new Error(`Symbol ${e.symbol} steht in keinem Export von ${e.paket} (geprüft: ${kandidaten.join(', ')}): Symbol ist kein Zod-Schema, vermutlich nur ein TS-Typ${nichtLadbar.length > 0 ? `; nicht ladbar: ${nichtLadbar.join('; ')}` : ''}`);
  }
  return treffer[0] as { spezifikator: string; modul: Record<string, unknown> };
}

/**
 * Schreibt je SCHEMA `<id>.vertrag.test.ts` nach `zielDir`, fuer eine Vertragsdatei den Test von Hand
 * `<id>.vertrag.md` (CR-GC-965). `laden(ziel)` liefert das Modul mit dem Zod-Symbol; `ziel` ist ein
 * absoluter Pfad oder der Spezifikator eines Pakets (CR-GC-981). Ein Fehler je SCHEMA bricht den Lauf nicht ab; er steht im Bericht.
 */
export async function erzeugeVertragstests(
  satz: VertragstestSatz,
  root: string,
  zielDir: string,
  laden: (ziel: string) => Promise<Record<string, unknown>>,
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
      const aufgeloest = 'paket' in e ? await loeseAuf(e, root, laden) : undefined;
      const mod = aufgeloest ? aufgeloest.modul : await laden(join(root, e.file));
      const S = mod[e.symbol] as Zod | undefined;
      if (!S?._zod) {
        throw new Error(aufgeloest ? `Symbol ${e.symbol} aus ${aufgeloest.spezifikator}: Symbol ist kein Zod-Schema` : S ? 'kein Zod-4-Schema' : `Symbol ${e.symbol} nicht exportiert`);
      }
      const { aufgenommen, verworfen, begrenzt } = erzeugeFaelle(S);
      if (!aufgenommen.some((f) => f.erwartet)) throw new Error('kein angenommenes Beispiel');
      const datei = join(zielDir, `${e.id}.vertrag.test.ts`);
      const imp = relative(zielDir, join(root, e.file)).replace(/\.ts$/, '.js');
      const importPfad = aufgeloest ? aufgeloest.spezifikator : imp.startsWith('.') ? imp : './' + imp;
      writeFileSync(datei, testDatei(e, importPfad, aufgenommen));
      bericht.push({ schema: e.id, datei: relative(root, datei), faelle: aufgenommen.length, verworfen, begrenzt });
    } catch (err) {
      bericht.push({ schema: e.id, fehler: err instanceof Error ? err.message : String(err) });
    }
  }
  return VertragstestBerichtSchema.parse(bericht);
}
