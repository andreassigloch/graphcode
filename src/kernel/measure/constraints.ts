/**
 * constraints.ts — Prüffunktionen für Constraints (CR-GC-851, Konzept CR-GC-804).
 *
 * Ein Constraint ist eine nicht-funktionale Anforderung am Element mit verifizierendem TEST; die
 * Testdatei liest den committeten Snapshot und ruft eine dieser Funktionen. Je Antwortform eine
 * Funktion. Der Subpath `@sigloch/graphcode/constraints` exportiert sie, damit Constraint-Tests
 * anderer Repos dieselbe Prüfung rufen statt sie nachzubauen.
 *
 * Misst contracts schon (LCOM4, kreuzende Flüsse, Kettenkennzahlen), ruft die Prüffunktion diese
 * Messung und rechnet nicht nach. Die Lookups kommen aus dem Index von contracts (`indexOf`).
 *
 * Rein: Graph rein, Befund raus. Kein Store, kein Dateisystem.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { indexOf, type OntologyGraph } from '@sigloch/contracts/se';

/** Befund von `eingaengeNurAus`. Beide Listen leer = Constraint erfüllt. */
export const EingangsBefund = z.strictObject({
  /** Eingehende Flüsse außerhalb der erlaubten Liste, je mit den Elementen, die in ihn schreiben. */
  fremd: z.array(z.strictObject({ fluss: z.string(), absender: z.array(z.string()) })),
  /** Flüsse der erlaubten Liste, die im Modell nicht in das Element führen. */
  fehlend: z.array(z.string()),
});
export type EingangsBefund = z.infer<typeof EingangsBefund>;

/**
 * Eingänge eines Elements nur aus der erlaubten Liste.
 *
 * Eingang = jede `io`-Kante, die in `elementId` zeigt. Eine Ratsche in beide Richtungen: ein Fluss
 * außerhalb der Liste ist `fremd`, ein Fluss der Liste ohne Kante ins Element ist `fehlend`. So
 * kann die Liste weder still wachsen noch still veralten.
 */
export function eingaengeNurAus(
  graph: OntologyGraph,
  elementId: string,
  erlaubt: readonly string[],
): EingangsBefund {
  const idx = indexOf(graph);
  const erlaubtSet = new Set(erlaubt);
  const eingaenge = [...new Set(idx.in(elementId, 'io').map((t) => t.source))].sort();
  const fremd = eingaenge
    .filter((fluss) => !erlaubtSet.has(fluss))
    .map((fluss) => ({ fluss, absender: [...new Set(idx.in(fluss, 'io').map((t) => t.source))].sort() }));
  const vorhanden = new Set(eingaenge);
  const fehlend = [...erlaubtSet].filter((fluss) => !vorhanden.has(fluss)).sort();
  return EingangsBefund.parse({ fremd, fehlend });
}

/** Befund von `grenzeNurMitSchema`. Liste leer = Constraint erfüllt. */
export const GrenzBefund = z.strictObject({
  /** Flüsse über die Grenze eines Kind-Moduls (auch zwischen zwei Kind-Modulen) ohne Schema oder mit einem Schema außerhalb der Liste. */
  ohneSchema: z.array(
    z.strictObject({ fluss: z.string(), module: z.array(z.string()), schemas: z.array(z.string()) }),
  ),
});
export type GrenzBefund = z.infer<typeof GrenzBefund>;

/** Befund von `einAdapterJeAkteur`. Alle Listen leer = Constraint erfüllt. */
export const AdapterBefund = z.strictObject({
  /** Flüsse eines Akteurs, die nicht in genau einem Kind-Modul enden (`module` leer oder mehr als eins). */
  flussOhneEinModul: z.array(z.strictObject({ akteur: z.string(), fluss: z.string(), module: z.array(z.string()) })),
  /** Kind-Module, die nicht genau einen Akteur der Liste bedienen (`akteure` leer oder mehr als einer). */
  moduleOhneEinenAkteur: z.array(z.strictObject({ modul: z.string(), akteure: z.array(z.string()) })),
  /** Akteure der Liste ohne Fluss, der in einem Kind-Modul endet. */
  akteurOhneAdapter: z.array(z.string()),
});
export type AdapterBefund = z.infer<typeof AdapterBefund>;

/**
 * Kind-Module von `elternMod` und ihre FUNC. Ein Fluss gehört zu einem Kind-Modul über
 * `FUNC allocate MOD`; eine FUNC an einem Enkel-Modul zählt zum Kind-Modul (compose-Hülle).
 * Wie `eingaengeNurAus` liest die Zuordnung nur Kanten, ohne Namens- oder Pfadregel.
 */
function kindModule(graph: OntologyGraph, elternMod: string) {
  const idx = indexOf(graph);
  const kinder = [...new Set(idx.out(elternMod, 'compose').map((t) => t.target))]
    .filter((id) => idx.typeOf(id) === 'MOD')
    .sort();
  const modulVon = new Map<string, string>(); // MOD (Kind oder Nachfahre) -> Kind-Modul
  for (const kind of kinder) {
    const stapel = [kind];
    while (stapel.length > 0) {
      const m = stapel.pop()!;
      if (modulVon.has(m)) continue;
      modulVon.set(m, kind);
      for (const t of idx.out(m, 'compose')) if (idx.typeOf(t.target) === 'MOD') stapel.push(t.target);
    }
  }
  const kindVon = (func: string): string | undefined => {
    for (const t of idx.out(func, 'allocate')) {
      const kind = modulVon.get(t.target);
      if (kind !== undefined) return kind;
    }
    return undefined;
  };
  /** Endpunkte eines Flusses: Quellen (`X io FLOW`) und Ziele (`FLOW io X`). */
  const endpunkte = (fluss: string): string[] => [
    ...new Set([...idx.in(fluss, 'io').map((t) => t.source), ...idx.out(fluss, 'io').map((t) => t.target)]),
  ];
  const kinderVon = (ids: readonly string[]): string[] => [
    ...new Set(ids.map(kindVon).filter((k): k is string => k !== undefined)),
  ].sort();
  return { idx, kinder, kindVon, kinderVon, endpunkte };
}

/**
 * Grenze der Kind-Module von `elternMod` nur mit Schema.
 *
 * Ein Fluss über die Grenze eines Kind-Moduls (ein Endpunkt in ihm, einer außerhalb, auch ein Akteur oder ein
 * anderes Kind-Modul) trägt mindestens ein Schema und keines außerhalb von `schemas`. Ein Fluss zwischen zwei
 * Kind-Modulen ist ein Grenzfluss wie jeder andere, kein eigener Befund (CR-GC-956, Autor 2026-11-19).
 * Ein Fluss gehört zu einem Kind-Modul über `FUNC allocate MOD`; sein Schema steht an `FLOW relation SCHEMA`.
 */
export function grenzeNurMitSchema(
  graph: OntologyGraph,
  elternMod: string,
  schemas: readonly string[],
): GrenzBefund {
  const { idx, kindVon, kinderVon, endpunkte } = kindModule(graph, elternMod);
  const erlaubt = new Set(schemas);
  const ohneSchema: GrenzBefund['ohneSchema'] = [];
  for (const fluss of [...idx.idsOfType('FLOW')].sort()) {
    const punkte = endpunkte(fluss);
    const drin = kinderVon(punkte);
    if (drin.length === 0) continue;
    const ueberGrenze = drin.length > 1 || punkte.some((p) => kindVon(p) === undefined);
    if (!ueberGrenze) continue;
    const eigene = [...new Set(idx.out(fluss, 'relation').map((t) => t.target).filter((s) => idx.typeOf(s) === 'SCHEMA'))].sort();
    if (eigene.length === 0 || eigene.some((s) => !erlaubt.has(s))) {
      ohneSchema.push({ fluss, module: drin, schemas: eigene });
    }
  }
  return GrenzBefund.parse({ ohneSchema });
}

/**
 * Ein Adapter je Akteur: jeder Fluss zu oder von einem Akteur aus `akteure` endet in genau einem Kind-Modul
 * von `elternMod`, und jedes Kind-Modul bedient genau einen Akteur dieser Liste. Zuordnung wie bei
 * `grenzeNurMitSchema`: Fluss → FUNC am anderen Ende → `FUNC allocate MOD` → Kind-Modul.
 */
export function einAdapterJeAkteur(
  graph: OntologyGraph,
  elternMod: string,
  akteure: readonly string[],
): AdapterBefund {
  const { idx, kinder, kinderVon, endpunkte } = kindModule(graph, elternMod);
  const flussOhneEinModul: AdapterBefund['flussOhneEinModul'] = [];
  const akteureJeModul = new Map<string, Set<string>>(kinder.map((k) => [k, new Set<string>()]));
  const bedient = new Set<string>();
  const liste = [...new Set(akteure)].sort();
  for (const akteur of liste) {
    const fluesse = new Set([...idx.out(akteur, 'io').map((t) => t.target), ...idx.in(akteur, 'io').map((t) => t.source)]);
    for (const fluss of [...fluesse].filter((f) => idx.typeOf(f) === 'FLOW').sort()) {
      const module = kinderVon(endpunkte(fluss).filter((p) => p !== akteur));
      if (module.length !== 1) flussOhneEinModul.push({ akteur, fluss, module });
      for (const m of module) akteureJeModul.get(m)!.add(akteur);
      if (module.length > 0) bedient.add(akteur);
    }
  }
  const moduleOhneEinenAkteur = kinder
    .map((modul) => ({ modul, akteure: [...akteureJeModul.get(modul)!].sort() }))
    .filter((m) => m.akteure.length !== 1);
  const akteurOhneAdapter = liste.filter((a) => !bedient.has(a));
  return AdapterBefund.parse({ flussOhneEinModul, moduleOhneEinenAkteur, akteurOhneAdapter });
}
