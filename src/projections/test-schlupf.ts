/**
 * test-schlupf.ts — misst, ob die Testauswahl aus dem Graphen reicht (CR-GC-718).
 *
 * WARUM: Die Regel „volle Suite vor jedem CR-Abschluss" war eine Absicherung ohne Messung.
 * Zwei grüne Läufe nebeneinander beweisen nichts; die Frage ist, ob der Volllauf je einen
 * roten Test fand, den die Auswahl derselben Änderung nicht enthielt — der **Schlupf**.
 * Nach `SCHLUPF_SCHWELLE` CRs der CODE-Spur ohne Schlupf entfällt der Volllauf je CR
 * (Entscheid des Autors 2026-09-30); CI und Publish fahren ihn weiter.
 *
 * DIE ZUSAGE dahinter: die Tests der Blackboxen und ihrer Schnittstellen sind zu 100 % an
 * Laufadressen gebunden; was innerhalb einer Blackbox an Unit-Tests läuft, kennt die Blackbox
 * selbst (in der Auswahl: der direkte Import). `blackboxBindung` misst diese Zusage am Snapshot.
 *
 * Reine Funktionen — der Runner `scripts/verify-full.mjs` fährt die Suite und schreibt die Zeile.
 *
 * @author andreas@siglochconsulting
 */
import { lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';

/** So viele CRs der CODE-Spur ohne Schlupf in Folge, dann entfällt der Volllauf je CR. */
export const SCHLUPF_SCHWELLE = 10;

/**
 * Testdateien, die im Link-Modus (`npm run link:siblings`) erwartet rot sind (CR-GC-947). Sie messen den
 * Zustand des Rechners, nicht die Testauswahl; CI fährt ohne Link-Modus und fängt beide.
 */
export const UMGEBUNG_LINK_MODUS: readonly string[] = ['tests/distribution.test.ts', 'tests/lockfile-sync.test.ts'];

/** Link-Modus: mindestens ein `node_modules/@sigloch/*` ist ein Symlink. Ohne `node_modules` ist es keiner. */
export function linkModusVon(repoRoot: string): boolean {
  const dir = join(repoRoot, 'node_modules', '@sigloch');
  try {
    return readdirSync(dir).some((n) => lstatSync(join(dir, n)).isSymbolicLink());
  } catch {
    return false;
  }
}

const BindungsTeilSchema = z.object({ total: z.number().int(), gebunden: z.number().int(), offen: z.array(z.string()) });
const BlackboxBindungSchema = z.object({ blackbox: BindungsTeilSchema, schnittstelle: BindungsTeilSchema });

/** Eine Zeile von `docs/messung/testauswahl.jsonl` — geprüft beim Schreiben und beim Lesen. */
export const SchlupfZeileSchema = z.object({
  cr: z.string().regex(/^CR-[A-Z]+-\d+[A-Z]?$/),
  at: z.string().min(1),
  code: z.string().min(1),
  /** Spur der Auswahl für die Änderung des CR. Nur `CODE` ist ein Beleg — VOLL wählt ohnehin alles. */
  spur: z.enum(['CODE', 'VOLL', 'KEINE']),
  ausgewaehlt: z.number().int(),
  ausGraph: z.number().int(),
  gesamt: z.number().int(),
  rot: z.array(z.string()),
  /** Rote Testdateien außerhalb der Auswahl. */
  schlupf: z.array(z.string()),
  /** Rote Testdateien außerhalb des Graph-Anteils allein (ohne den direkten Import). */
  schlupfNurGraph: z.array(z.string()),
  zusage: BlackboxBindungSchema,
  /** CR-GC-947 — fehlt in älteren Zeilen; fehlend heißt „nicht erfasst", nie 0 oder `false`. */
  linkModus: z.boolean().optional(),
  /**
   * Rote Dateien, die die Umgebung verursacht: im Link-Modus erwartet rot, oder vom Autor als Störung
   * markiert (CR-GC-923: `npm pack` unter Last zweier paralleler Volläufe, einzeln grün). Sie stehen nicht in `schlupf`.
   */
  umgebung: z.array(z.string()).optional(),
  /** Laufzeit in ms, Summe je Testdatei (parallele Dateien addieren sich): der Auswahl und des Volllaufs. */
  dauer: z.object({ auswahlMs: z.number().int().nonnegative(), vollMs: z.number().int().nonnegative() }).optional(),
  /** FUNC und SCHEMA an Modulgrenzen: im Modell (`da`) von der Pflichtmenge (`scripts/grenzmenge.mjs`). */
  grenzmenge: z
    .object({ FUNC: z.object({ pflicht: z.number().int(), da: z.number().int() }), SCHEMA: z.object({ pflicht: z.number().int(), da: z.number().int() }) })
    .optional(),
});
export type SchlupfZeile = z.infer<typeof SchlupfZeileSchema>;

/** Die JSONL-Datei → geprüfte Zeilen; eine kaputte Zeile bricht laut ab. */
export function leseSchlupfZeilen(text: string): SchlupfZeile[] {
  return text.split('\n').filter(Boolean).map((l) => SchlupfZeileSchema.parse(JSON.parse(l)));
}

/**
 * Rote Dateien gegen die Auswahl derselben Änderung. Im Link-Modus zählen die Dateien aus
 * `UMGEBUNG_LINK_MODUS` nicht als Schlupf, sondern stehen unter `umgebung` (CR-GC-947).
 */
export function schlupfVon(
  rot: readonly string[],
  auswahl: readonly string[],
  ausGraph: readonly string[],
  linkModus = false,
): { schlupf: string[]; schlupfNurGraph: string[]; umgebung: string[] } {
  const a = new Set(auswahl);
  const g = new Set(ausGraph);
  const umgebung = linkModus ? rot.filter((f) => UMGEBUNG_LINK_MODUS.includes(f)) : [];
  const echt = rot.filter((f) => !umgebung.includes(f));
  return { schlupf: echt.filter((f) => !a.has(f)), schlupfNurGraph: echt.filter((f) => !g.has(f)), umgebung };
}

/**
 * Laufzeit aus dem JSON-Bericht von vitest: je Testdatei `endTime - startTime`, summiert — einmal für die
 * Dateien der Auswahl, einmal für alle. Dateien laufen parallel; die Summe ist Rechenzeit, nicht Wanduhr.
 */
export function dauerVon(
  bericht: string,
  auswahl: readonly string[],
  relativ: (abs: string) => string,
): { auswahlMs: number; vollMs: number } {
  const json = z
    .object({ testResults: z.array(z.object({ name: z.string(), startTime: z.number(), endTime: z.number() })) })
    .parse(JSON.parse(bericht));
  const a = new Set(auswahl);
  let auswahlMs = 0;
  let vollMs = 0;
  for (const t of json.testResults) {
    const ms = Math.max(0, t.endTime - t.startTime);
    vollMs += ms;
    if (a.has(relativ(t.name))) auswahlMs += ms;
  }
  return { auswahlMs: Math.round(auswahlMs), vollMs: Math.round(vollMs) };
}

/**
 * Die Folge ohne Schlupf, vom jüngsten CR rückwärts: CODE-CRs ohne Schlupf zählen, VOLL/KEINE
 * zählen nicht und brechen nicht ab, ein Schlupf bricht ab. Ein Schlupf in IRGENDEINEM Lauf eines
 * CR zählt — der Nachlauf nach dem Fix macht den ersten nicht ungeschehen (CR-GC-720: in CR-GC-719
 * verdeckte die jüngste Zeile drei rote Tests außerhalb der Auswahl).
 */
export function schlupfFreieFolge(zeilen: readonly SchlupfZeile[]): number {
  const jeCr = new Map<string, { at: string; spur: SchlupfZeile['spur']; schlupf: boolean }>();
  for (const z of [...zeilen].sort((x, y) => x.at.localeCompare(y.at))) {
    const vorher = jeCr.get(z.cr);
    jeCr.set(z.cr, { at: z.at, spur: z.spur, schlupf: (vorher?.schlupf ?? false) || z.schlupf.length > 0 });
  }
  const neueste = [...jeCr.values()].sort((x, y) => y.at.localeCompare(x.at));
  let folge = 0;
  for (const z of neueste) {
    if (z.schlupf) break;
    if (z.spur === 'CODE') folge++;
  }
  return folge;
}

export type BindungsTeil = z.infer<typeof BindungsTeilSchema>;
/** blackbox: TESTs an REQs, die eine Blackbox erfüllt (MOD, SYS, FCHAIN, Wurzel-FUNC).
 *  schnittstelle: realisierte Verträge (SCHEMA mit realRef an einem FLOW), je Vertrag ein gebundener TEST. */
export type BlackboxBindung = z.infer<typeof BlackboxBindungSchema>;

const gebunden = (attrs: Record<string, unknown> | undefined): boolean =>
  Array.isArray(attrs?.testRefs) && (attrs!.testRefs as Array<{ file?: string }>).some((r) => !!r?.file);

/** Die Zusage am Snapshot: Blackbox- und Schnittstellentests mit Laufadresse. */
export function blackboxBindung(graph: Graph): BlackboxBindung {
  const byUid = new Map(graph.nodes.map((n) => [n.uid, n]));
  const typ = (uid: string): string | undefined => byUid.get(uid)?.type;
  const kinder = new Set(
    graph.edges.filter((e) => e.edgeType === 'compose' && typ(e.sourceId) === 'FUNC' && typ(e.targetId) === 'FUNC').map((e) => e.targetId),
  );
  const istBlackbox = (uid: string): boolean => {
    const t = typ(uid);
    return t === 'MOD' || t === 'SYS' || t === 'FCHAIN' || (t === 'FUNC' && !kinder.has(uid));
  };
  const bbReq = new Set(
    graph.edges.filter((e) => e.edgeType === 'satisfy' && istBlackbox(e.sourceId) && typ(e.targetId) === 'REQ').map((e) => e.targetId),
  );
  const verify = graph.edges.filter((e) => e.edgeType === 'verify' && typ(e.sourceId) === 'TEST');

  const bbTests = [...new Set(verify.filter((e) => bbReq.has(e.targetId)).map((e) => e.sourceId))].sort();
  const bbOffen = bbTests.filter((uid) => !gebunden(byUid.get(uid)?.attributes));

  // Nur REALISIERTE Verträge (realRef), wie R-32: ein Vertrag ohne realRef hat keinen Code, den ein Test treffen kann.
  const realisiert = (uid: string): boolean => !!byUid.get(uid)?.attributes?.realRef;
  const vertraege = [
    ...new Set(
      graph.edges
        .filter((e) => e.edgeType === 'relation' && typ(e.sourceId) === 'FLOW' && typ(e.targetId) === 'SCHEMA' && realisiert(e.targetId))
        .map((e) => e.targetId),
    ),
  ].sort();
  const vOffen = vertraege.filter(
    (s) => !verify.some((e) => e.targetId === s && gebunden(byUid.get(e.sourceId)?.attributes)),
  );
  return {
    blackbox: { total: bbTests.length, gebunden: bbTests.length - bbOffen.length, offen: bbOffen },
    schnittstelle: { total: vertraege.length, gebunden: vertraege.length - vOffen.length, offen: vOffen },
  };
}

/** Was ein vitest-Lauf über sich sagt: Exit, Signal und der Text des JSON-Berichts (`undefined` = nicht geschrieben). */
export const VitestLaufSchema = z.object({
  status: z.number().nullable(),
  signal: z.string().nullable(),
  bericht: z.string().optional(),
});
export type VitestLauf = z.infer<typeof VitestLaufSchema>;

/** Ein Beleg nennt die roten Dateien; kein Beleg nennt den Grund. Grün ist nur ein Beleg ohne rote Datei. */
export const LaufUrteilSchema = z.discriminatedUnion('beleg', [
  z.object({ beleg: z.literal(true), rot: z.array(z.string()), gesamt: z.number() }),
  z.object({ beleg: z.literal(false), grund: z.string() }),
]);
export type LaufUrteil = z.infer<typeof LaufUrteilSchema>;

const VitestBerichtSchema = z.object({
  testResults: z.array(z.object({ name: z.string(), status: z.string() })),
});

/**
 * Das Urteil über einen vitest-Lauf (CR-GC-854). Die roten Dateien kommen aus dem Bericht; ein
 * Lauf ist nur dann ein Beleg, wenn vitest einen Bericht schrieb UND Bericht und Exit dasselbe
 * sagen. Zwei Lücken des Berichts schließt das: ein Lauf ohne Bericht (vitest endete vorzeitig,
 * am 2026-10-25 im Ruhezustand mit exit 0) und ein Fehler außerhalb eines Tests (Unhandled Error:
 * exit 1, im Bericht ist jede Datei `passed`).
 */
export function laufUrteil(eingang: VitestLauf, relativ: (abs: string) => string): LaufUrteil {
  const lauf = VitestLaufSchema.parse(eingang);
  const exit = `exit ${lauf.status ?? '-'}${lauf.signal ? `, Signal ${lauf.signal}` : ''}`;
  if (lauf.bericht === undefined) {
    return { beleg: false, grund: `vitest endete ohne Bericht (${exit}) — der Lauf ist unvollstaendig.` };
  }
  const json = VitestBerichtSchema.parse(JSON.parse(lauf.bericht));
  const rot = json.testResults.filter((t) => t.status === 'failed').map((t) => relativ(t.name)).sort();
  if (lauf.status !== 0 && rot.length === 0) {
    return { beleg: false, grund: `vitest meldet rot (${exit}), der Bericht nennt keine rote Datei — ein Fehler ausserhalb eines Tests.` };
  }
  return { beleg: true, rot, gesamt: json.testResults.length };
}
