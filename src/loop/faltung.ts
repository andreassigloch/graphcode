/**
 * faltung.ts — der Graph als Blackbox-Baum statt als Liste (CR-GC-682, SPIKE-GC-compose-faltung).
 *
 * Ein System wird als Baum aus Blackboxes gelesen: eine FUNC mit ihren Unter-FUNCs (`compose`) ist
 * von aussen EINE Box, dasselbe fuer MOD in MOD, UC mit seinen REQ, FCHAIN mit ihren FUNC. Offen ist
 * nur der Ast, an dem gearbeitet wird; die Geschwister stehen als Box da, alles andere als nackte uid.
 *
 * Der uid-Index ist nicht Beiwerk, sondern der Grund, warum die Faltung traegt. Gemessen im Nachspiel
 * ueber 1 190 Mutationen: ohne ihn braucht jede vierte Mutation etwas Verborgenes — fast immer nur
 * eine uid fuer eine Kante in einen anderen Ast. Mit ihm muss nur noch 5 % Inhalt nachgeladen werden.
 *
 * Rein: Knoten und Kanten rein, Sicht raus. Kein Registry-, kein Store-Zugriff.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod';

export const FaltKnoten = z.object({
  uid: z.string(),
  type: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
export type FaltKnoten = z.infer<typeof FaltKnoten>;

export const FaltKante = z.object({
  sourceId: z.string(),
  targetId: z.string(),
  edgeType: z.string(),
});
export type FaltKante = z.infer<typeof FaltKante>;

export interface Baum {
  eltern: Map<string, string>;
  kinder: Map<string, string[]>;
}

/** Wer einen Knoten ohne compose-Elternteil besitzt — in dieser Reihenfolge (Spike §2). */
const EIGNER_KANTEN = ['verify', 'io', 'relation', 'satisfy', 'allocate'] as const;

/**
 * Eltern je Knoten: `compose` zuerst; ein Knoten ausserhalb des compose-Baums haengt an seinem
 * Eigner ueber die erste Kante aus EIGNER_KANTEN zu einem Baumknoten. Ohne Eigner: Wurzel.
 */
export function elternBaum(knoten: readonly FaltKnoten[], kanten: readonly FaltKante[]): Baum {
  const da = new Set(knoten.map((n) => n.uid));
  const eltern = new Map<string, string>();
  const composeQuellen = new Set<string>();
  for (const e of kanten) {
    if (e.edgeType !== 'compose' || !da.has(e.sourceId) || !da.has(e.targetId)) continue;
    composeQuellen.add(e.sourceId);
    if (!eltern.has(e.targetId)) eltern.set(e.targetId, e.sourceId);
  }
  const imBaum = (u: string): boolean => eltern.has(u) || composeQuellen.has(u);
  const baumknoten = new Set([...da].filter(imBaum));
  for (const typ of EIGNER_KANTEN) {
    for (const e of kanten) {
      if (e.edgeType !== typ) continue;
      for (const [kind, eigner] of [
        [e.sourceId, e.targetId],
        [e.targetId, e.sourceId],
      ] as const) {
        if (kind === eigner || !da.has(kind) || !da.has(eigner)) continue;
        if (eltern.has(kind) || baumknoten.has(kind)) continue;
        if (!baumknoten.has(eigner) && !eltern.has(eigner)) continue;
        eltern.set(kind, eigner);
      }
    }
  }
  // Zyklen brechen: wer ueber seine Eltern zu sich selbst kommt, wird Wurzel.
  for (const u of [...eltern.keys()]) {
    const gesehen = new Set([u]);
    let p = eltern.get(u);
    while (p !== undefined) {
      if (gesehen.has(p)) {
        eltern.delete(u);
        break;
      }
      gesehen.add(p);
      p = eltern.get(p);
    }
  }
  const kinder = new Map<string, string[]>();
  for (const [k, p] of eltern) kinder.set(p, [...(kinder.get(p) ?? []), k]);
  return { eltern, kinder };
}

/**
 * Offen: die Saat, ihre Teilbaeume, ihre Vorfahren. Box: Kinder offener Vorfahren und jede Wurzel,
 * die nicht offen ist. Alles uebrige ist verborgen.
 */
export function falten(
  alle: Iterable<string>,
  baum: Baum,
  saat: readonly string[],
): { offen: Set<string>; box: Set<string> } {
  const offen = new Set<string>();
  const stapel = [...saat];
  while (stapel.length > 0) {
    const u = stapel.pop() as string;
    if (offen.has(u)) continue;
    offen.add(u);
    stapel.push(...(baum.kinder.get(u) ?? []));
  }
  const vorfahren = new Set<string>();
  for (const s of saat) {
    let p = baum.eltern.get(s);
    while (p !== undefined && !vorfahren.has(p)) {
      vorfahren.add(p);
      p = baum.eltern.get(p);
    }
  }
  for (const v of vorfahren) offen.add(v);
  const box = new Set<string>();
  for (const v of vorfahren) for (const k of baum.kinder.get(v) ?? []) if (!offen.has(k)) box.add(k);
  for (const u of alle) if (!baum.eltern.has(u) && !offen.has(u)) box.add(u);
  return { offen, box };
}

/** Der Vertrag der gefalteten Sicht — was der Inventar-Kanal von der Faltung bekommt (CR-GC-773). */
export const Faltung = z.object({
  offen: z.array(FaltKnoten),
  box: z.array(FaltKnoten),
  kanten: z.array(FaltKante),
  /** uids der verborgenen Knoten — reicht, um sie als Kantenziel zu nennen. */
  index: z.array(z.string()),
});
export type Faltung = z.infer<typeof Faltung>;

/** Die gefaltete Sicht fuer eine Saat. Unbekannte Saat-uids fallen weg. */
export function faltung(knoten: readonly FaltKnoten[], kanten: readonly FaltKante[], saat: readonly string[]): Faltung {
  const nach = new Map(knoten.map((n) => [n.uid, n]));
  const baum = elternBaum(knoten, kanten);
  const { offen, box } = falten(nach.keys(), baum, saat.filter((u) => nach.has(u)));
  const sichtbar = (u: string): boolean => offen.has(u) || box.has(u);
  const sortiert = (ids: Iterable<string>): FaltKnoten[] =>
    [...ids].sort().map((u) => nach.get(u) as FaltKnoten);
  return {
    offen: sortiert(offen),
    box: sortiert(box),
    kanten: kanten.filter((e) => sichtbar(e.sourceId) && sichtbar(e.targetId)),
    index: [...nach.keys()].filter((u) => !sichtbar(u)).sort(),
  };
}
