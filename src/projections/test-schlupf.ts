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
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';

/** So viele CRs der CODE-Spur ohne Schlupf in Folge, dann entfällt der Volllauf je CR. */
export const SCHLUPF_SCHWELLE = 10;

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
});
export type SchlupfZeile = z.infer<typeof SchlupfZeileSchema>;

/** Die JSONL-Datei → geprüfte Zeilen; eine kaputte Zeile bricht laut ab. */
export function leseSchlupfZeilen(text: string): SchlupfZeile[] {
  return text.split('\n').filter(Boolean).map((l) => SchlupfZeileSchema.parse(JSON.parse(l)));
}

/** Rote Dateien gegen die Auswahl derselben Änderung. */
export function schlupfVon(
  rot: readonly string[],
  auswahl: readonly string[],
  ausGraph: readonly string[],
): { schlupf: string[]; schlupfNurGraph: string[] } {
  const a = new Set(auswahl);
  const g = new Set(ausGraph);
  return { schlupf: rot.filter((f) => !a.has(f)), schlupfNurGraph: rot.filter((f) => !g.has(f)) };
}

/**
 * Die Folge ohne Schlupf, vom jüngsten Eintrag rückwärts: CODE-Zeilen ohne Schlupf zählen,
 * VOLL/KEINE zählen nicht und brechen nicht ab, ein Schlupf bricht ab. Je CR zählt die jüngste Zeile.
 */
export function schlupfFreieFolge(zeilen: readonly SchlupfZeile[]): number {
  const jeCr = new Map<string, SchlupfZeile>();
  for (const z of zeilen) jeCr.set(z.cr, z);
  const neueste = [...jeCr.values()].sort((x, y) => y.at.localeCompare(x.at));
  let folge = 0;
  for (const z of neueste) {
    if (z.schlupf.length > 0) break;
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

  // Nur REALISIERTE Verträge (realRef), wie R-32: ein Konzept-Vertrag hat keinen Code, den ein Test treffen kann.
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
