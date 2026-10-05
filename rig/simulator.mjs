/**
 * simulator.mjs — der Nutzer des Rigs (CR-GC-715), rein und deterministisch; dazu die Aufgabe, die er mitbringt.
 *
 * Er tut, was der Nutzer in den Handläufen tat, und nichts darüber hinaus:
 *   - Zug 1 ist der Start-Prompt der Aufgabe.
 *   - Stellt der Agent eine echte Frage (nicht nur „Soll ich anfangen?"), antwortet er aus dem Antwortblatt —
 *     beim ersten Mal mit dem ganzen Blatt, danach mit dem Verweis darauf. Was dort nicht steht, ist offen; er
 *     erfindet nichts.
 *   - Sonst schickt er den Vorschlag dieses Zugs ab (das Enter im Eingabefeld). Brachte der Zug keinen (keine
 *     angewandte Mutation), stimmt er dem Plan des Agenten zu: vor der ersten Mutation „Ja, beginne mit Schritt 1.",
 *     danach „Ja, weiter mit dem nächsten Schritt."
 *   - Der Lauf endet, wenn die Readiness SRR und PDR als bestanden meldet (Entscheid Autor 2026-10-05), bei der
 *     Freigabe-Bitte oder am Zuglimit.
 *   - Eine Analyse läuft in einer frischen Sitzung: schlägt graphcode eine Analyse vor, die nicht das Thema der
 *     laufenden Sitzung ist — oder zeigt eine Analyse-Sitzung wieder auf Strukturarbeit —, beginnt die nächste
 *     Sitzung mit diesem Vorschlag. Analysen sprengen lokal sonst das Kontextfenster (lokal-2, 2026-10-04).
 * Antworten gehen vor dem Vorschlag, beides in einer Nachricht.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUFGABEN = join(dirname(fileURLToPath(import.meta.url)), 'aufgaben');

/**
 * Die Aufgabe, die der Nutzer mitbringt (Leitlinie §9.4): start.md (sein erster Prompt), antwortblatt.md (was er auf
 * Fragen antwortet), punkte.json (Raster der P- und O-Punkte fürs Blindurteil), aufgabe.json (Quelle, Sequenz der Stufen,
 * optional `basis`: ein Graph, mit dem der Lauf beginnt — etwa der Referenzlauf einer anderen Aufgabe). Eine spätere
 * Stufe der Sequenz bekommt ihren Prompt aus `<stufe>.md`; die erste aus start.md.
 */
export function aufgabeLaden(name, root = AUFGABEN) {
  const dir = join(root, name);
  const meta = JSON.parse(readFileSync(join(dir, 'aufgabe.json'), 'utf8'));
  const raster = JSON.parse(readFileSync(join(dir, 'punkte.json'), 'utf8'));
  return {
    name, ...meta, sequenz: meta.sequenz ?? ['modellieren'],
    basis: meta.basis ? resolve(dir, meta.basis) : null,
    start: readFileSync(join(dir, 'start.md'), 'utf8').trim(),
    stufenPrompt: (stufe) => (existsSync(join(dir, `${stufe}.md`)) ? readFileSync(join(dir, `${stufe}.md`), 'utf8').trim() : null),
    antwortblatt: readFileSync(join(dir, 'antwortblatt.md'), 'utf8').trim(),
    punkte: raster.punkte, rasterHinweis: raster.hinweis,
    referenz: (arm) => join(dir, 'referenz', arm),
  };
}

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

/** Die Analysen in den Vorschlagssätzen von graphcode (src/loop/next-step.ts, ANALYSE und Satz 2). */
const ANALYSE_VORSCHLAG = /^(?:Führe (?:das|den|die) (Einsatzkonzept|Annahmen-Review|Variantenvergleich|Fehlerbetrachtung|Bauplan)\b|(?:Das|Der|Den|Die) (Einsatzkonzept|Annahmen-Review|Variantenvergleich|Fehlerbetrachtung|Bauplan)\b.*ist noch nicht abgeschlossen)/i;

/** Die Analyse, die ein Vorschlag nennt (`Einsatzkonzept`, …), sonst null. */
export function analyseIn(vorschlag) {
  const m = ANALYSE_VORSCHLAG.exec(String(vorschlag ?? ''));
  return m ? (m[1] ?? m[2]) : null;
}

/** Neue Sitzung, wenn der Vorschlag ein anderes Thema hat als die laufende Sitzung (null = Strukturarbeit). */
export function sitzungswechsel(thema, vorschlag) {
  return vorschlag != null && analyseIn(vorschlag) !== thema;
}

/**
 * Das Ziel einer Stufe, geprüft am Nachbau aus dem Audit nach jedem Zug mit Mutation: `modellieren` endet, sobald die
 * Readiness SRR und PDR als bestanden meldet; `warnungsfrei` endet, sobald die Regelprüfung weder Fehler noch Warnung
 * meldet. Eine neue Stufe bekommt hier ihr Ziel — der Treiber kennt nur den Namen des erreichten Ziels.
 */
export const ZIEL = {
  modellieren: (gates) => (gates?.SRR && gates?.PDR ? 'srr+pdr' : null),
  warnungsfrei: (gates, befund) => (befund && befund.fehler === 0 && befund.warnungen === 0 ? 'warnungsfrei' : null),
};

/** Ende nach einem Zug: Ziel der Stufe erreicht, Freigabe-Bitte abgeschickt oder Zuglimit. */
export function ende(zug, maxZuege, letzteNachricht, erreicht = null) {
  if (erreicht) return erreicht;
  if (String(letzteNachricht ?? '').endsWith(FREIGABE)) return 'freigabe';
  return zug >= maxZuege ? 'zuglimit' : null;
}
