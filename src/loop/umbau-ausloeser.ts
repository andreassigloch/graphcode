/**
 * umbau-ausloeser.ts — wann ein Agent `graph_suggest` von selbst ruft (CR-GC-934).
 *
 * Ein Befund einer Regel, für die se-engine einen Zug hat, ist offen: dann nennen `graph_generate`
 * und `rules_get_violations` im Feld `umbau` das Werkzeug `graph_suggest` und die Befunde. Nach einem
 * Aufruf schweigt das Feld, bis sich Modellstand und Befundmenge geändert haben.
 *
 * Entscheidungen des Autors vom 2026-11-19 (CR-GC-934): die Regelliste ist die Zug-Tabelle von
 * se-engine, keine zweite Liste; der Auslöser steht im graphcode-Schritt, nicht im Hilfetext von
 * contracts; der Agent ruft ab dem Befund, die Probe per `se:optimize` erst an deren Platz (Stufe 9).
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';
import { STEER_OPERATORS } from '@sigloch/se-engine';

/**
 * Die Regeln, deren offener Befund `graph_suggest` auslöst: genau die, für die se-engine einen Zug
 * hat (`STEER_OPERATORS`). Bekommt eine Regel einen Zug, löst sie ohne Änderung hier aus.
 */
export const AUSLOESER_REGELN: readonly string[] = Object.keys(STEER_OPERATORS).sort();

const AusloeserBefund = z.strictObject({ ruleId: z.string(), elementId: z.string() });
type AusloeserBefund = z.infer<typeof AusloeserBefund>;

/** Der Hinweis in `graph_generate` und `rules_get_violations`: ein Befund mit Zug ist offen. */
export const UmbauHinweis = z.strictObject({
  werkzeug: z.literal('graph_suggest'),
  /** Die offenen Befunde der auslösenden Regeln, sortiert. */
  befunde: z.array(AusloeserBefund),
});
export type UmbauHinweis = z.infer<typeof UmbauHinweis>;

/** Ein Befund, wie ihn Gate und Regellauf liefern; ohne Element gibt es keinen Zug. */
type Befund = { ruleId: string; elementId?: string };

/** Die offenen Befunde der auslösenden Regeln, ohne Doppel, sortiert. */
export function offeneAusloeser(befunde: readonly Befund[]): AusloeserBefund[] {
  const regeln = new Set(AUSLOESER_REGELN);
  const schluessel = new Set(
    befunde.filter((b) => regeln.has(b.ruleId) && b.elementId !== undefined).map((b) => `${b.ruleId}|${b.elementId}`),
  );
  return [...schluessel].sort().map((k) => {
    const [ruleId, elementId] = k.split('|');
    return { ruleId, elementId };
  });
}

/** Contracts-Befund (`rule_id`/`element_id`) in die Form der Werkzeuge. */
export const alsBefund = (v: { rule_id: string; element_id: string }): AusloeserBefund => ({
  ruleId: v.rule_id,
  elementId: v.element_id,
});

/** Der Hinweis ohne Gedächtnis: gesetzt, sobald ein Befund einer auslösenden Regel offen ist. */
export function hinweisAus(befunde: readonly Befund[]): UmbauHinweis | null {
  const offen = offeneAusloeser(befunde);
  return offen.length === 0 ? null : UmbauHinweis.parse({ werkzeug: 'graph_suggest', befunde: offen });
}

/** Der letzte Aufruf von `graph_suggest` je Harness: Modellstand und Befundmenge. */
const letzterAufruf = new WeakMap<object, { graphVersion: number; schluessel: string }>();
const schluesselVon = (befunde: readonly AusloeserBefund[]) => befunde.map((b) => `${b.ruleId}|${b.elementId}`).join(',');

/** Merkt den Aufruf von `graph_suggest`: ab jetzt schweigt der Hinweis bis zur nächsten Modelländerung. */
export function merkeSuggestAufruf(owner: object, graphVersion: number, befunde: readonly Befund[]): void {
  letzterAufruf.set(owner, { graphVersion, schluessel: schluesselVon(offeneAusloeser(befunde)) });
}

/**
 * Der Hinweis nach dem Gedächtnis: `null`, wenn seit dem letzten Aufruf von `graph_suggest` der
 * Modellstand oder die Befundmenge gleich geblieben ist. Neu gerufen wird erst, wenn sich beides
 * geändert hat; ein Aufruf blockiert den Host 4,3 bis 4,6 s (CR-GVE-401).
 */
export function gedaempft(owner: object, graphVersion: number, hinweis: UmbauHinweis | null): UmbauHinweis | null {
  if (!hinweis) return null;
  const letzter = letzterAufruf.get(owner);
  if (letzter && (letzter.graphVersion === graphVersion || letzter.schluessel === schluesselVon(hinweis.befunde))) return null;
  return hinweis;
}
