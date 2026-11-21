/**
 * harness-handle-contract.ts — SCHEMA-harness-handle, der Vertrag des Harness-Griffs
 * (FLOW-harness-handle, CR-GC-523, ITEM-2026-064; ohne z.custom CR-GC-991).
 *
 * Der Griff ist ein Objekt mit Verhalten: `createHarness` liefert ihn, sechs
 * Konsumenten (Tool-Bindung, Werkzeug-Kontext, stdio-Server, run/rewind/import-code)
 * holen ihn ab. Ein Stand-in in einem Test oder ein halb konstruierter Harness fiele
 * sonst erst beim ersten Aufruf eines fehlenden Mitglieds um, weit weg von der Uebergabe.
 *
 * Der Vertrag ist die Form: jedes oeffentliche Mitglied der Klasse ist eine Funktion
 * (`z.function()`), der Griff ist ein offenes Objekt — private Felder nennt er nicht, ein
 * Griff mit MEHR Mitgliedern bleibt ein Griff. Die genaue Signatur jedes Mitglieds steht an
 * `GraphCodeHarness`, nicht im Schema. Was die Zugriffe zurueckgeben (Repo-Wurzel, Scope,
 * Fokus-Schwelle), ist Verhalten: `HarnessConfigSchema.parse` im Konstruktor sichert es,
 * ein Test der Klasse prueft es.
 *
 * `parse` liefert eine Kopie ohne Prototyp, kein Harness. Der Erzeuger prueft deshalb und
 * gibt das ORIGINAL zurueck (FAQ erzeuger-parst-vertrag).
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import type { GraphCodeHarness } from './harness.js';

/**
 * Die Oberflaeche des Griffs. `satisfies Record<keyof GraphCodeHarness, …>` haelt die
 * Liste an der Klasse fest: ein neues oeffentliches Mitglied ohne Vertragszeile ist ein
 * Typfehler, ein Vertragsmitglied ohne Klassenmethode ebenso.
 */
const Mitglieder = {
  initialize: z.function(),
  close: z.function(),
  loadGraph: z.function(),
  getGraph: z.function(),
  getStore: z.function(),
  getHooks: z.function(),
  getRepoRoot: z.function(),
  getStoreDir: z.function(),
  getScope: z.function(),
  getGraphcodeConfig: z.function(),
  getMetricPolicy: z.function(),
  getLoadedRuleIds: z.function(),
  getFocusThreshold: z.function(),
  impact: z.function(),
  subgraph: z.function(),
  listElements: z.function(),
  testImpact: z.function(),
  mutate: z.function(),
  mutateWithStates: z.function(),
  evaluateRules: z.function(),
  importGraph: z.function(),
  seedFromJson: z.function(),
  reseed: z.function(),
} satisfies Record<keyof GraphCodeHarness, z.ZodType>;

/** Der Harness-Griff: ein offenes Objekt, dessen Mitglieder Funktionen sind. */
export const HarnessHandle = z.looseObject(Mitglieder);
