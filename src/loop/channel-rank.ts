/**
 * channel-rank.ts — die Rangfolge der Steuerungskanaele (CR-GC-575).
 *
 * Bis hierher entschied verstreuter Code, welcher Kanal gewinnt, wenn zwei dasselbe
 * adressieren: ein Ternaer in `generate.ts` (Klausel schlaegt Template, CR-GC-564), ein
 * zweiter Ternaer drei Zeilen weiter fuer die Fokus-Typen (CR-GC-566), und die Reihenfolge
 * der Bloecke in `executor-prompt.ts`, die niemand erklaert hat. **Es gab keine erklaerte
 * Rangfolge** — jeder Konflikt musste durch einen Lauf gefunden werden, viermal in der
 * Serie CR-GC-560..568.
 *
 * Hier steht sie, einmal. Die Reihung ist absteigend nach **Verbindlichkeit**:
 * was das Gate erzwingt, ist nicht verhandelbar; was die Runde will, ist eine
 * Entscheidung; Grammatik und Bestand sind Tatsachen; Anleitung ist Qualitaet;
 * ein Vorschlag ist eine Option.
 *
 * Was hier ausdruecklich NICHT steht: Fokus-Typen-Wahl, `defer`, Kandidatenzahl und die
 * Selektionsvariante. Das ist Mechanik des Treibers, kein Kanal, der dem Modell etwas SAGT
 * — sie in dieselbe Ordnung zu ziehen waere eine zweite Bedeutung fuer dasselbe Wort.
 *
 * @author andreas@siglochconsulting
 */

/**
 * Die Kanaele in absteigender Verbindlichkeit. Die Reihenfolge des Arrays IST die
 * Rangfolge — kein zweites Zahlenfeld, das damit auseinanderlaufen koennte.
 */
export const CHANNEL_ORDER = [
  'gate-truth',
  'rule-clause',
  'grammar',
  'inventory',
  'guidance',
  'proposal',
] as const;

export type Channel = (typeof CHANNEL_ORDER)[number];

/**
 * WANN ein Kanal den Agenten erreicht (CR-GC-591) — die zweite Achse neben dem Rang.
 *
 * Der Rang sagt, wer gewinnt, wenn zwei Kanaele dasselbe adressieren. Er sagt nicht, ob der
 * Kanal ueberhaupt VOR der Entscheidung da ist. Gemessen (Bericht "Zeitlinie"): die Advisories
 * haengen an der Antwort auf die angewandte Mutation — sie kommen, wenn entschieden ist. Der
 * Guide kommt davor. Ein Kanal, der nach der Entscheidung kommt, kann nur die naechste steuern.
 *
 *   prompt  — im Rundenprompt bzw. vor dem Schreiben (Guide, Klausel, Skill, GRAPHCODE.md)
 *   probe   — in der Antwort auf dryRun, also vor dem Anwenden (steeringDelta, Verdict der Probe)
 *   antwort — in der Antwort auf die angewandte Mutation, also nach der Entscheidung
 *             (Advisories, `vorschlag`, das Verdict der Anwendung)
 *
 * Am Kanal-Knoten im Modell als Attribut `zeitpunkt`; `tests/channel-model.test.ts` verlangt
 * es fuer jeden FLOW-channel-* und prueft es gegen diese Liste.
 */
export const CHANNEL_TIMINGS = ['prompt', 'probe', 'antwort'] as const;

/** Rang eines Kanals — kleiner ist verbindlicher. Abgeleitet, nie gepflegt. */
export function rankOf(channel: Channel): number {
  return CHANNEL_ORDER.indexOf(channel);
}

/** Schlaegt `a` den Kanal `b`? Die einzige Stelle, an der ein Vorrang entschieden wird. */
export function outranks(a: Channel, b: Channel): boolean {
  return rankOf(a) < rankOf(b);
}

/** Ein Kanal mit seinem Inhalt — `value` fehlt, wenn dieser Kanal in dieser Runde schweigt. */
export interface ChannelSlot<T> {
  readonly channel: Channel;
  readonly value: T | null | undefined;
}

/**
 * Der Kanal, der gewinnt: der verbindlichste, der ueberhaupt etwas zu sagen hat.
 *
 * Ersetzt die zwei Ternaere in `generate.ts`. Dass Text und Fokus-Typen aus DEMSELBEN
 * Gewinner kommen, ist nicht mehr eine Zusage im Kommentar (CR-GC-566), sondern eine
 * Folge davon, dass es nur einen Aufruf gibt.
 */
export function winner<T>(slots: readonly ChannelSlot<T>[]): { channel: Channel; value: T } | null {
  let best: { channel: Channel; value: T } | null = null;
  for (const slot of slots) {
    if (slot.value === null || slot.value === undefined) continue;
    if (best === null || outranks(slot.channel, best.channel)) {
      best = { channel: slot.channel, value: slot.value };
    }
  }
  return best;
}

/** Ein Beitrag EINES Kanals zum Rundenprompt (CR-GC-573). */
export interface ChannelBlock {
  readonly channel: Channel;
  readonly text: string;
}

/** Zwei Kanaele, die in derselben Runde dasselbe sagen. */
export interface ChannelEcho {
  readonly a: Channel;
  readonly b: Channel;
  readonly satzA: string;
  readonly satzB: string;
  /** Jaccard-Ueberlappung der bedeutungstragenden Woerter, 0..1. */
  readonly overlap: number;
}
