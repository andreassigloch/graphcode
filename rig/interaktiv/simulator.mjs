/**
 * simulator.mjs — der Nutzer des interaktiven Rigs (CR-GC-715), rein und deterministisch.
 *
 * Er tut, was der Nutzer in den Handläufen tat, und nichts darüber hinaus:
 *   - Zug 1 ist der Start-Prompt des Korpus.
 *   - Stellt der Agent eine echte Frage (nicht nur „Soll ich anfangen?"), antwortet er aus dem Antwortblatt —
 *     beim ersten Mal mit dem ganzen Blatt, danach mit dem Verweis darauf. Was dort nicht steht, ist offen; er
 *     erfindet nichts.
 *   - Sonst schickt er den Vorschlag dieses Zugs ab (das Enter im Eingabefeld). Brachte der Zug keinen (keine
 *     angewandte Mutation), stimmt er dem Plan des Agenten zu: vor der ersten Mutation „Ja, beginne mit Schritt 1.",
 *     danach „Ja, weiter mit dem nächsten Schritt."
 *   - Er endet nach fester Zugzahl oder nachdem er die Freigabe-Bitte abgeschickt hat.
 * Antworten gehen vor dem Vorschlag, beides in einer Nachricht.
 *
 * @author andreas@siglochconsulting
 */

/** Der Vorschlag, mit dem graphcode die Freigabe einleitet (src/loop/next-step.ts, Phase handoff im Kern). */
export const FREIGABE = 'Fasse das Modell zusammen — ich prüfe es und gebe es frei.';
export const ZUSTIMMUNG = 'Ja, beginne mit Schritt 1.';
export const WEITER = 'Ja, weiter mit dem nächsten Schritt.';
export const OFFEN = 'Was dort nicht steht, ist offen — bitte als offen führen, nicht festlegen.';

/** „Soll ich …?", „Weiter?" — eine Bitte um Zustimmung, keine Frage nach Wissen des Auftraggebers. */
const ZUSTIMMUNGSFRAGE = /^(soll(en)? (ich|wir)|darf ich|möchtest du|willst du|weiter|ja\?|oder )/i;

/** Die Fragen einer Agentenantwort: Sätze mit Fragezeichen, ohne Zustimmungsfragen. */
export function fragen(text) {
  return String(text ?? '')
    .split('\n')
    .map((z) => z.replace(/^[\s>*\-–•]*(\d+[.)]\s*)?/, '').replace(/\*\*/g, '').trim())
    .filter((z) => z.endsWith('?') && !ZUSTIMMUNGSFRAGE.test(z));
}

/**
 * Die nächste Nachricht des Nutzers.
 * @param {{ antwort: string, vorschlag: string | null, blattGegeben: boolean, antwortblatt: string, gebaut: boolean }} lage
 * @returns {{ nachricht: string, blattGegeben: boolean, beantwortet: number }}
 */
export function naechsteNachricht({ antwort, vorschlag, blattGegeben, antwortblatt, gebaut }) {
  const offen = fragen(antwort);
  const teile = [];
  if (offen.length > 0) {
    teile.push(blattGegeben ? `Meine Vorgaben stehen in meiner früheren Antwort. ${OFFEN}` : `${antwortblatt.trim()}\n\n${OFFEN}`);
  }
  teile.push(vorschlag ?? (gebaut ? WEITER : ZUSTIMMUNG));
  return { nachricht: teile.join('\n\n'), blattGegeben: blattGegeben || offen.length > 0, beantwortet: offen.length };
}

/** Ende: Zugzahl erreicht oder die Freigabe-Bitte ist abgeschickt. */
export function ende(zug, maxZuege, letzteNachricht) {
  if (String(letzteNachricht ?? '').endsWith(FREIGABE)) return 'freigabe';
  return zug >= maxZuege ? 'zuglimit' : null;
}
