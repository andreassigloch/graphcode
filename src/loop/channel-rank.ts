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

/** Warum dieser Kanal an dieser Stelle steht — je Kanal ein Satz, nicht mehr. */
export const CHANNEL_REASON: Record<Channel, string> = {
  'gate-truth': 'Blockierendes: was den Batch verhindert, schlaegt alles.',
  'rule-clause': 'Die Regel-Klausel des Fokus-Funds — der EINE Imperativ der Runde.',
  grammar: 'Die Kanten-Grammatik der Fokus-Typen: was legal ist.',
  inventory: 'Der Element-Index: was es schon gibt.',
  guidance: 'Der Skill-Rumpf: wie man es gut macht.',
  proposal: 'Vorschlag aus Vorlage oder Optimizer: ein Kandidat, nie ein Auftrag.',
};

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

/**
 * Bloecke in Rangfolge bringen — stabil, damit zwei Bloecke desselben Kanals ihre
 * Erzeugungsreihenfolge behalten.
 *
 * Die Reihenfolge ist keine Kosmetik: der Runden-Prompt wird von oben gelesen, und bis
 * CR-GC-575 stand die Anleitung (Rang 5) UNTER den Vorschlaegen (Rang 6) — die Ordnung
 * des Zufalls, in dem die Bloecke angebaut wurden (CR-GC-556 vor CR-GC-557).
 */
export function byRank<T extends { channel: Channel }>(blocks: readonly T[]): T[] {
  return [...blocks].sort((a, b) => rankOf(a.channel) - rankOf(b.channel));
}

/** Ein Beitrag EINES Kanals zum Rundenprompt (CR-GC-573). */
export interface ChannelBlock {
  readonly channel: Channel;
  readonly text: string;
}

/**
 * Ein Satz, auf seine bedeutungstragenden Woerter reduziert. Kein Stemming und keine
 * Stoppwortliste je Sprache — beides waere eine zweite, ungeprueffte Annahme. Was bleibt,
 * ist Kleinschreibung, Wortgrenzen und eine Mindestlaenge.
 */
function wortmenge(satz: string): Set<string> {
  return new Set(
    satz
      .toLowerCase()
      .replace(/[^a-zäöüß0-9\s_-]/g, ' ')
      .split(/[\s_-]+/)
      .filter((w) => w.length > 3),
  );
}

/** Saetze eines Blocks — Zeilenumbrueche zaehlen wie Satzenden, Listen sind hier ueblich. */
function saetze(text: string): string[] {
  return text
    .split(/[.;:\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);
}

/** Wie stark ueberlappen zwei Wortmengen (Jaccard, 0..1). */
function ueberlappung(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let schnitt = 0;
  for (const w of a) if (b.has(w)) schnitt++;
  return schnitt / (a.size + b.size - schnitt);
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

/**
 * **Sagen zwei Kanaele dieser Runde dasselbe?** (CR-GC-573, Kriterium 2)
 *
 * Bis hierher liess sich diese Frage nur durch einen LAUF beantworten: das Prinzip
 * „ein Imperativ je Runde" musste viermal per Messung wiederentdeckt werden (CR-GC-560..568),
 * weil beide Schreiber im selben Knoten verschwanden und ihre Texte nirgends
 * nebeneinanderlagen.
 *
 * Bewusst **Ueberlappung statt Gleichheit**: der Fall, der die Serie ausgeloest hat, war
 * keine Dublette, sondern ein Widerspruch in Paraphrase — R-15s Klausel sagte „haeng FUNCs
 * an die bestehenden FCHAINs", das uc-Template drei Zeilen darueber „lege FCHAIN-Szenarien
 * an". Wortgleich war daran nichts; dieselbe Arbeit gemeint war sehr wohl. Ein
 * Exakt-Vergleich haette genau diesen Fall durchgelassen.
 *
 * Der Befund ist ein HINWEIS, kein Urteil: zwei Kanaele duerfen einander stuetzen. Er sagt
 * nur, dass zwei Stellen dieselbe Arbeit beschreiben — und wer das darf, sagt die Rangfolge.
 */
export function duplicateChannels(
  blocks: readonly ChannelBlock[],
  threshold = 0.6,
): ChannelEcho[] {
  const zerlegt = blocks.map((b) => ({
    channel: b.channel,
    saetze: saetze(b.text).map((s) => ({ satz: s, woerter: wortmenge(s) })),
  }));
  const funde: ChannelEcho[] = [];
  for (let i = 0; i < zerlegt.length; i++) {
    for (let j = i + 1; j < zerlegt.length; j++) {
      // Zwei Bloecke DESSELBEN Kanals sind kein zweiter Weg — sie sind derselbe.
      if (zerlegt[i].channel === zerlegt[j].channel) continue;
      for (const a of zerlegt[i].saetze) {
        for (const b of zerlegt[j].saetze) {
          const overlap = ueberlappung(a.woerter, b.woerter);
          if (overlap >= threshold) {
            funde.push({
              a: zerlegt[i].channel,
              b: zerlegt[j].channel,
              satzA: a.satz,
              satzB: b.satz,
              overlap: +overlap.toFixed(2),
            });
          }
        }
      }
    }
  }
  // Staerkste Ueberlappung zuerst; bei Gleichstand bleibt die Fundreihenfolge.
  return funde.sort((x, y) => y.overlap - x.overlap);
}
