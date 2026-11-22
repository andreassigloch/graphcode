/**
 * TEST-vertrag-ausdruck — der Generator liest `refine` in drei festen Formen (CR-GC-1000):
 * Vergleich zweier Zahlfelder, mindestens eines von N optionalen Feldern, Text ohne Muster. Alles andere bricht ab.
 * Mutanten: jede Aenderung am Vertrag muss von den erzeugten Faellen rot werden.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { liesAusdruck } from '../src/projections/vertrag-ausdruck.js';
import { erzeugeFaelle } from '../src/projections/vertragstest.js';

const namen = (f: Array<{ name: string }>): string[] => f.map((x) => x.name);
const rot = (faelle: Array<{ eingabe: unknown; erwartet: boolean }>, mutant: z.ZodType): number => faelle.filter((f) => mutant.safeParse(f.eingabe).success !== f.erwartet).length;

const Spanne = (check: (b: { von: number; bis: number }) => boolean) => z.strictObject({ von: z.number().int().min(0), bis: z.number().int().min(0) }).refine(check);
const Eines = z.strictObject({ a: z.string().optional(), b: z.string().optional(), c: z.string().optional() }).refine((s) => s.a !== undefined || s.b !== undefined || s.c !== undefined);

describe('liesAusdruck: reine Datenform', () => {
  const felder = ['von', 'bis', 'a', 'b'];
  it('Vergleich zweier Felder, Parametername frei, Klammern und Leerraum egal', () => {
    expect(liesAusdruck('(b) => b.von <= b.bis', felder)).toEqual({ art: 'vergleich', links: 'von', operator: '<=', rechts: 'bis' });
    expect(liesAusdruck('x=>(x.von   >   x.bis)', felder)).toEqual({ art: 'vergleich', links: 'von', operator: '>', rechts: 'bis' });
    expect(liesAusdruck('($) => { return $.von >= $.bis; }', felder)).toEqual({ art: 'vergleich', links: 'von', operator: '>=', rechts: 'bis' });
    expect(liesAusdruck('function (r) { return r.von < r.bis }', felder)).toEqual({ art: 'vergleich', links: 'von', operator: '<', rechts: 'bis' });
  });
  it('mindestens eines von N Feldern', () => {
    expect(liesAusdruck('(s) => s.a !== undefined || s.b !== undefined', felder)).toEqual({ art: 'mindestensEines', felder: ['a', 'b'] });
    expect(liesAusdruck('(s) => (s.a !== undefined) || (s.b !== undefined)', felder)).toEqual({ art: 'mindestensEines', felder: ['a', 'b'] });
  });
  it('Text ohne Muster: Regex-Literal ohne Flags, Parametername frei', () => {
    expect(liesAusdruck('(p) => !/^[/~]/.test(p)', [])).toEqual({ art: 'textOhneMuster', muster: '^[/~]' });
    expect(liesAusdruck('x => !/(^|\\/)\\.\\.(\\/|$)/.test(x)', [])).toEqual({ art: 'textOhneMuster', muster: '(^|\\/)\\.\\.(\\/|$)' });
  });
  it.each([
    ['Muster mit Flag', '(p) => !/a/i.test(p)'],
    ['Muster ohne Negation', '(p) => /a/.test(p)'],
    ['Muster in Variable', '(p) => !MUSTER.test(p)'],
    ['ungueltiges Muster', '(p) => !/(/.test(p)'],
  ])('bricht ab bei %s (Text ohne Muster)', (_n, q) => {
    expect(() => liesAusdruck(q, [])).toThrow(/gelesen: /);
  });
  it.each([
    ['&&', '(s) => s.a !== undefined && s.b !== undefined'],
    ['Hilfsaufruf', '(s) => pruefe(s)'],
    ['aeussere Konstante', '(s) => s.von <= GRENZE'],
    ['Methodenaufruf', '(s) => s.a.includes("x")'],
    ['verschachtelter Zugriff', '(s) => s.von.x <= s.bis'],
    ['Vergleich mit Zahl', '(s) => s.von <= 3'],
    ['unbekanntes Feld', '(s) => s.von <= s.hoehe'],
    ['ein Feld mit sich selbst', '(s) => s.von <= s.von'],
    ['zwei Parameter (superRefine)', '(s, ctx) => s.von <= s.bis'],
    ['nur ein Glied der Oder-Kette', '(s) => s.a !== undefined'],
    ['Oder-Kette mit fremdem Glied', '(s) => s.a !== undefined || s.b === 1'],
  ])('bricht ab bei %s und nennt den Ausdruck', (_n, q) => {
    expect(() => liesAusdruck(q, felder)).toThrow(/gelesen: /);
  });
});

describe('erzeugeFaelle mit refine in den zwei Formen', () => {
  it.each([
    ['<=', Spanne((b) => b.von <= b.bis)],
    ['<', Spanne((b) => b.von < b.bis)],
    ['>=', Spanne((b) => b.von >= b.bis)],
    ['>', Spanne((b) => b.von > b.bis)],
  ])('Vergleich %s: Grenzfall angenommen und Grenzfall abgelehnt, nichts verworfen', (op, S) => {
    const { aufgenommen, verworfen } = erzeugeFaelle(S);
    const n = namen(aufgenommen);
    expect(n.some((x) => x.startsWith(`nimmt an: von ${op} bis auf der Grenze`))).toBe(true);
    expect(n.some((x) => x.startsWith(`lehnt ab: von ${op} bis knapp verletzt`))).toBe(true);
    expect(verworfen.filter((v) => v.includes(`von ${op} bis`))).toEqual([]);
    expect(aufgenommen.every((f) => S.safeParse(f.eingabe).success === f.erwartet)).toBe(true);
  });
  it('mindestens eines: alle fehlen abgelehnt, je Feld nur dieses angenommen', () => {
    const { aufgenommen } = erzeugeFaelle(Eines);
    const n = namen(aufgenommen);
    expect(n).toContain('lehnt ab: keines von a, b, c gesetzt');
    for (const f of ['a', 'b', 'c']) expect(n.some((x) => x.startsWith(`nimmt an: nur ${f} gesetzt`))).toBe(true);
  });
  it('Wertregel verhindert das Paar: der Fall steht in verworfen mit Grund, nicht im Satz', () => {
    const S = z.strictObject({ von: z.number().int().min(5).max(5), bis: z.number().int().min(5).max(5) }).refine((b) => b.von < b.bis);
    expect(() => erzeugeFaelle(S)).toThrow(/kein Beispiel/);
  });
  it('Zahlfelder mit Nachkommastellen: kleinster Schritt 0.001', () => {
    const S = z.strictObject({ von: z.number(), bis: z.number() }).refine((b) => b.von < b.bis);
    const f = erzeugeFaelle(S).aufgenommen.find((x) => x.name.startsWith('nimmt an: von < bis'));
    expect(f).toBeDefined();
  });
});

describe('erzeugeFaelle bricht ab', () => {
  it.each([
    ['superRefine', z.strictObject({ a: z.number() }).superRefine((i, c) => { if (i.a === 1) c.addIssue({ code: 'custom', message: 'm' }); }), /refine\/superRefine/],
    ['refine mit &&', z.strictObject({ a: z.string().optional(), b: z.string().optional() }).refine((s) => s.a !== undefined && s.b !== undefined), /gelesen: s\.a !== (undefined|void 0) && s\.b !== (undefined|void 0)/],
    ['refine an einem Feld', z.strictObject({ a: z.string().refine((v) => v.length > 0) }), /gelesen: v\.length > 0/],
    ['Vergleich an Textfeldern', z.strictObject({ a: z.string(), b: z.string() }).refine((s) => s.a <= s.b), /kein Zahlfeld/],
    ['Oder-Kette mit Pflichtfeld', z.strictObject({ a: z.string(), b: z.string().optional() }).refine((s) => s.a !== undefined || s.b !== undefined), /nicht optional/],
    ['transform', z.strictObject({ a: z.string().transform((v) => v.trim()) }), /transform/],
    ['preprocess', z.strictObject({ a: z.preprocess((v) => v, z.string()) }), /transform/],
  ])('%s', (_n, S, muster) => {
    expect(() => erzeugeFaelle(S)).toThrow(muster);
  });
  it('pipe ohne transform bleibt erlaubt', () => {
    expect(() => erzeugeFaelle(z.strictObject({ a: z.string().pipe(z.string().min(1)) }))).not.toThrow();
  });
});

describe('Mutanten: jede Aenderung am Vertrag wird rot', () => {
  const faelle = (): Array<{ eingabe: unknown; erwartet: boolean }> => erzeugeFaelle(Spanne((b) => b.von <= b.bis)).aufgenommen;
  it('Operator <= wird <', () => expect(rot(faelle(), Spanne((b) => b.von < b.bis))).toBeGreaterThan(0));
  it('Operator <= wird >=', () => expect(rot(faelle(), Spanne((b) => b.von >= b.bis))).toBeGreaterThan(0));
  it('Check entfernt', () => expect(rot(faelle(), z.strictObject({ von: z.number().int().min(0), bis: z.number().int().min(0) }))).toBeGreaterThan(0));
  it('Original: kein roter Fall', () => expect(rot(faelle(), Spanne((b) => b.von <= b.bis))).toBe(0));
  const eines = (): Array<{ eingabe: unknown; erwartet: boolean }> => erzeugeFaelle(Eines).aufgenommen;
  const Objekt = { a: z.string().optional(), b: z.string().optional(), c: z.string().optional() };
  it('Feld a aus der Oder-Kette genommen', () => expect(rot(eines(), z.strictObject(Objekt).refine((s) => s.b !== undefined || s.c !== undefined))).toBeGreaterThan(0));
  it('Feld c aus der Oder-Kette genommen', () => expect(rot(eines(), z.strictObject(Objekt).refine((s) => s.a !== undefined || s.b !== undefined))).toBeGreaterThan(0));
  it('Check entfernt (Oder-Kette)', () => expect(rot(eines(), z.strictObject(Objekt))).toBeGreaterThan(0));
  it('Original (Oder-Kette): kein roter Fall', () => expect(rot(eines(), Eines)).toBe(0));
});

const FUENF: Array<[string, string, (p: string) => boolean]> = [
  ['ein Backslash', '\\\\', (p) => !/\\/.test(p)],
  ['Anfang / oder ~', '^[/~]', (p) => !/^[/~]/.test(p)],
  ['Laufwerk am Anfang', '^[A-Za-z]:', (p) => !/^[A-Za-z]:/.test(p)],
  ['Segment ..', '(^|/)\\.\\.(/|$)', (p) => !/(^|\/)\.\.(\/|$)/.test(p)],
  ['Slug ueber 60 Zeichen', '^[A-Z]+-.{61,}$', (p) => !/^[A-Z]+-.{61,}$/.test(p)],
];

describe('Text ohne Muster', () => {
  it.each(FUENF)('%s: Beispiel ohne Muster, ablehnender Fall mit Muster', (_n, m, regel) => {
    const S = z.string().min(1).refine(regel);
    const { aufgenommen, verworfen } = erzeugeFaelle(S);
    const f = aufgenommen.find((x) => x.name.startsWith('lehnt ab: Text passt auf das verbotene Muster'));
    expect(f).toBeDefined();
    expect(new RegExp(m).test(f?.eingabe as string)).toBe(true);
    expect(S.safeParse(f?.eingabe).success).toBe(false);
    expect(S.safeParse(aufgenommen.find((x) => x.name === 'nimmt das Beispiel an')?.eingabe).success).toBe(true);
    expect(verworfen).toEqual([]);
  });
  it('Muster ausserhalb dessen, was die Beispielbildung kann: Abbruch mit Ausdruck, nicht verworfen', () => {
    expect(() => erzeugeFaelle(z.string().refine((p) => !/^(?!a)/.test(p)))).toThrow(/Lookaround.*gelesen/s);
    expect(() => erzeugeFaelle(z.string().refine((p) => !/[^a]/.test(p)))).toThrow(/negierte Zeichenklasse/);
  });
  it('mehrere Muster am selben Text: jedes hat seinen Fall, der Fall trifft kein anderes', () => {
    const S = z
      .string()
      .min(1)
      .refine((p) => !/^~/.test(p))
      .refine((p) => !/\\/.test(p));
    const { aufgenommen } = erzeugeFaelle(S);
    const faelle = aufgenommen.filter((x) => x.name.startsWith('lehnt ab: Text passt auf das verbotene Muster'));
    expect(faelle).toHaveLength(2);
  });
  it('ein Muster an einem Objekt bricht ab', () => {
    expect(() => erzeugeFaelle(z.strictObject({ a: z.string() }).refine((o) => !/x/.test(o.a)))).toThrow(/gelesen/);
  });
  const M = z.string().min(1).refine((p) => !/^[/~]/.test(p));
  const faelle = () => erzeugeFaelle(M).aufgenommen;
  it('Mutant: Muster entfernt', () => expect(rot(faelle(), z.string().min(1))).toBeGreaterThan(0));
  it('Mutant: Negation entfernt', () => expect(rot(faelle(), z.string().min(1).refine((p) => /^[/~]/.test(p)))).toBeGreaterThan(0));
  it('Mutant: Muster verengt', () => expect(rot(faelle(), z.string().min(1).refine((p) => !/^~/.test(p)))).toBeGreaterThan(0));
  it('Original: kein roter Fall', () => expect(rot(faelle(), M)).toBe(0));
});
