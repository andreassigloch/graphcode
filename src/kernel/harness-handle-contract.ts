/**
 * harness-handle-contract.ts — SCHEMA-harness-handle, der Vertrag des Harness-Griffs
 * (FLOW-harness-handle, CR-GC-523, ITEM-2026-064).
 *
 * Der Griff ist ein Objekt mit Verhalten: `createHarness` liefert ihn, sechs
 * Konsumenten (Tool-Bindung, Werkzeug-Kontext, stdio-Server, run/rewind/import-code)
 * holen ihn ab. Bis hierher war die Uebergabe eine TS-Klasse ohne Laufzeitpruefung —
 * ein Stand-in in einem Test oder ein halb konstruierter Harness fiel erst beim ersten
 * Aufruf eines fehlenden Mitglieds um, weit weg von der Uebergabe.
 *
 * Der Vertrag prueft die OEFFENTLICHE Oberflaeche (jedes Mitglied eine Funktion) und
 * die Datenanteile dahinter (Repo-Wurzel, Store-Verzeichnis, Scope, Fokus-Schwelle).
 * Private Felder der Klasse nennt er nicht — ein Griff mit MEHR Mitgliedern bleibt ein
 * Griff. `parse` reicht DIESELBE Instanz weiter (z.custom, kein Kopie-Objekt): ein
 * z.object-Ergebnis waere ein Plain Object ohne Prototyp und damit kein Harness.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { HarnessConfigSchema } from '@sigloch/contracts/harness';
import type { GraphCodeHarness } from './harness.js';

/** Ein aufrufbares Mitglied — die Abweisung nennt es beim Namen. */
const member = (name: string) =>
  z.custom<(...args: never[]) => unknown>((v) => typeof v === 'function', {
    message: `${name} muss eine Funktion sein`,
  });

/**
 * Die Oberflaeche des Griffs. `satisfies Record<keyof GraphCodeHarness, …>` haelt die
 * Liste an der Klasse fest: ein neues oeffentliches Mitglied ohne Vertragszeile ist ein
 * Typfehler, ein Vertragsmitglied ohne Klassenmethode ebenso.
 */
const Surface = z.object({
  initialize: member('initialize'),
  close: member('close'),
  loadGraph: member('loadGraph'),
  getGraph: member('getGraph'),
  getStore: member('getStore'),
  getHooks: member('getHooks'),
  getRepoRoot: member('getRepoRoot'),
  getStoreDir: member('getStoreDir'),
  getScope: member('getScope'),
  getGraphcodeConfig: member('getGraphcodeConfig'),
  getMetricPolicy: member('getMetricPolicy'),
  getLoadedRuleIds: member('getLoadedRuleIds'),
  getFocusThreshold: member('getFocusThreshold'),
  impact: member('impact'),
  subgraph: member('subgraph'),
  listElements: member('listElements'),
  testImpact: member('testImpact'),
  mutate: member('mutate'),
  evaluateRules: member('evaluateRules'),
  importGraph: member('importGraph'),
  seedFromJson: member('seedFromJson'),
  reseed: member('reseed'),
} satisfies Record<keyof GraphCodeHarness, z.ZodType>);

/** Die Mitglieder des Vertrags — fuer Tests, die die Oberflaeche einer Instanz abbilden. */
export const HARNESS_HANDLE_MEMBERS = Object.keys(Surface.shape) as ReadonlyArray<keyof GraphCodeHarness>;

/**
 * Traegt die Befunde eines Teil-Schemas unter `path` in den umgebenden Kontext —
 * so nennt eine Abweisung im Wert eines Zugriffs den Zugriff als Pfad.
 */
export function forwardIssues(ctx: z.RefinementCtx, path: PropertyKey[], result: z.ZodSafeParseResult<unknown>): void {
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({ code: 'custom', path: [...path, ...issue.path], message: issue.message });
  }
}

const NonEmptyPath = z.string().min(1);
const FocusThreshold = z.number().min(0).max(1);

/**
 * Der Harness-Griff. Output ist die Instanz selbst (`GraphCodeHarness`), nie eine Kopie.
 */
export const HarnessHandle = z.custom<GraphCodeHarness>().superRefine((value, ctx) => {
  const surface = Surface.safeParse(value);
  if (!surface.success) {
    forwardIssues(ctx, [], surface);
    return;
  }
  // Datenanteile hinter den Zugriffen — reine Getter, ohne Seiteneffekt.
  forwardIssues(ctx, ['getRepoRoot'], NonEmptyPath.safeParse(value.getRepoRoot()));
  forwardIssues(ctx, ['getStoreDir'], NonEmptyPath.safeParse(value.getStoreDir()));
  forwardIssues(ctx, ['getScope'], HarnessConfigSchema.shape.scope.safeParse(value.getScope()));
  forwardIssues(ctx, ['getFocusThreshold'], FocusThreshold.safeParse(value.getFocusThreshold()));
});

/** Der Griff, aus seinem Vertrag abgeleitet — die Instanz, nicht ihre Form. */
export type HarnessHandle = z.infer<typeof HarnessHandle>;
