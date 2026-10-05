/**
 * simulator.mjs — der Nutzer des Rigs (CR-GC-715, CR-GC-742), rein und deterministisch; dazu die Aufgabe, die er
 * mitbringt.
 *
 * Er unterscheidet, was der Agent gerade von ihm will, und gibt je Anliegen EINE Antwort (CR-GC-742 — bis dahin las
 * er auf jede Frage das ganze Blatt vor und schickte graphcodes nächsten Schritt hinterher; an einer Entscheidungsfrage
 * kostete das 66 000 Zeichen Kreisen bis zum Ausgabelimit, und eine Frage „welche Analysen?" beantwortete er, indem er
 * alle fünf anstieß):
 *
 *   - Zug 1 ist der Start-Prompt der Aufgabe.
 *   - Verfahrensfrage („Soll ich mit Schritt 1 beginnen?") — keine Frage nach Wissen; er stimmt zu.
 *   - Wissensfrage, erste Runde der Sitzung — das ganze Antwortblatt (so beantwortete der Autor die Fragen im
 *     Handlauf); danach je Frage die passende Zeile des Blatts (Stichwortabgleich). Kein Treffer: „offen, bitte als
 *     offen führen". Er erfindet nichts, und er stimmt keinem Inhalt zu, den das Blatt nicht deckt — eine Zustimmung
 *     wäre eine Vorgabe.
 *   - Modellfrage (nennt Elemente oder Modellbegriffe: löschen oder verbinden, welcher Erfüller) — die Entscheidung
 *     gehört dem Agenten; er sagt das, statt ein Blatt vorzulesen.
 *   - Analysefrage (welche Analysen, welcher Abnahmegrund) — die Politik der Aufgabe antwortet.
 *   - Fragt der Agent nichts, schickt er graphcodes Vorschlag dieses Zugs ab (das Enter im Eingabefeld) — außer die
 *     Politik der Aufgabe steht dagegen: Analysen `ablehnen` → er lehnt den Analyse-Vorschlag ab und nennt, was offen
 *     ist; Freigabe `bei-ziel` → er gibt erst frei, wenn das Ziel der Stufe steht. Ohne Vorschlag stimmt er dem Plan
 *     des Agenten zu („Ja, beginne mit Schritt 1." / „Ja, weiter mit dem nächsten Schritt.").
 *   - Antworten gehen vor dem Vorschlag, beides in einer Nachricht — wie im Handlauf. Nur wenn der Agent auf eine
 *     Entscheidung wartet (Modellfrage, Analysefrage), bleibt graphcodes Vorschlag für diesen Zug liegen: er wäre eine
 *     zweite, womöglich widersprechende Anweisung.
 *   - Eine Analyse läuft in einer frischen Sitzung: schickt er einen Analyse-Vorschlag ab, der nicht das Thema der
 *     laufenden Sitzung ist — oder zeigt eine Analyse-Sitzung wieder auf Strukturarbeit —, beginnt die nächste Sitzung
 *     mit diesem Vorschlag. Analysen sprengen lokal sonst das Kontextfenster (lokal-2, 2026-10-04).
 *   - Die Stufe endet, wenn ihr Ziel steht (ZIEL), bei der abgeschickten Freigabe-Bitte, im Stillstand oder am Zuglimit.
 *
 * Jede Entscheidung steht als `{ art, … }` im Ergebnis; der Treiber schreibt sie je Zug nach lauf.json — der
 * Simulator ist Teil des Messaufbaus und damit selbst eine gemessene Größe.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUFGABEN = join(dirname(fileURLToPath(import.meta.url)), 'aufgaben');

/**
 * Das Antwortblatt: Zeilen `- [stichwort, stichwort] Antwort`. Die Stichworte sind der Abgleich des Simulators; der
 * Text ohne sie ist, was der Nutzer sagt (und was der Gutachter des Blindurteils als Vorgabe liest). Zeilen ohne
 * Stichworte gehören nur zum ganzen Blatt.
 */
export function blattLesen(text) {
  const eintraege = [];
  const zeilen = String(text ?? '').trim().split('\n').map((z) => {
    const m = /^(\s*[-*]\s*)\[([^\]]*)\]\s*(.*)$/.exec(z);
    if (!m) return z;
    eintraege.push({ stichworte: m[2].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean), text: m[3].trim() });
    return `${m[1]}${m[3]}`;
  });
  return { text: zeilen.join('\n'), eintraege };
}

/** Was der Nutzer zu Analysen und zur Freigabe will, solange die Aufgabe nichts anderes sagt: wie im Handlauf. */
export const POLITIK = { analysen: 'folgen', freigabe: 'immer' };

/**
 * Die Aufgabe, die der Nutzer mitbringt (Leitlinie §9.4): start.md (sein erster Prompt), antwortblatt.md (was er auf
 * Fragen antwortet), punkte.json (Raster der P- und O-Punkte fürs Blindurteil), aufgabe.json (Quelle, Sequenz der Stufen,
 * optional `basis`: ein Graph, mit dem der Lauf beginnt, und `politik`: { analysen: folgen | ablehnen, freigabe:
 * immer | bei-ziel }). Eine spätere Stufe der Sequenz bekommt ihren Prompt aus `<stufe>.md`; die erste aus start.md.
 */
export function aufgabeLaden(name, root = AUFGABEN) {
  const dir = join(root, name);
  const meta = JSON.parse(readFileSync(join(dir, 'aufgabe.json'), 'utf8'));
  const raster = JSON.parse(readFileSync(join(dir, 'punkte.json'), 'utf8'));
  const blatt = blattLesen(readFileSync(join(dir, 'antwortblatt.md'), 'utf8'));
  return {
    name, ...meta, sequenz: meta.sequenz ?? ['modellieren'],
    politik: { ...POLITIK, ...(meta.politik ?? {}) },
    basis: meta.basis ? resolve(dir, meta.basis) : null,
    start: readFileSync(join(dir, 'start.md'), 'utf8').trim(),
    stufenPrompt: (stufe) => (existsSync(join(dir, `${stufe}.md`)) ? readFileSync(join(dir, `${stufe}.md`), 'utf8').trim() : null),
    antwortblatt: blatt.text, antworten: blatt.eintraege,
    punkte: raster.punkte, rasterHinweis: raster.hinweis,
    referenz: (arm) => join(dir, 'referenz', arm),
  };
}

/** Der Vorschlag, mit dem graphcode die Freigabe einleitet (src/loop/next-step.ts, Phase handoff im Kern). */
export const FREIGABE = 'Fasse das Modell zusammen — ich prüfe es und gebe es frei.';
export const ZUSTIMMUNG = 'Ja, beginne mit Schritt 1.';
export const WEITER = 'Ja, weiter mit dem nächsten Schritt.';
export const OFFEN = 'Was dort nicht steht, ist offen — bitte als offen führen, nicht festlegen.';
export const OFFEN_EINZELN = 'Das habe ich nicht festgelegt — bitte als offen führen, nicht festlegen.';
export const DEINE_ENTSCHEIDUNG = 'Das ist eine Entscheidung am Modell — triff sie selbst und sag mir in einem Satz, was du gewählt hast und warum.';
export const ANALYSEN_NEIN = 'Die Analysen (Einsatzkonzept, Annahmen-Review, Variantenvergleich, Fehlerbetrachtung, Bauplan) sind in diesem Auftrag nicht beauftragt: führe sie nicht durch, sondern nimm ihre Hinweise mit genau diesem Grund ab.';
export const ANALYSEN_JA = 'Ja, führe die Analysen der Reihe nach durch — jeweils die, die als nächste ansteht.';
export const NOCH_NICHT = 'Noch keine Freigabe.';
export const MACH_WEITER = 'Mach damit weiter.';

/** „Soll ich …?", „Weiter?" — die Form einer Bitte um Zustimmung. */
const ZUSTIMMUNGSFORM = /^(soll(en)? (ich|wir)|darf ich|möchtest du|willst du|weiter|ja\?|oder )/i;
/** … und ihr Gegenstand: das Vorgehen, nicht der Inhalt. „Soll ich X als Anforderung festschreiben?" ist eine Frage. */
const VERFAHREN = /\b(beginn\w*|anfang\w*|weiter\w*|fortfahr\w*|fortsetz\w*|loslegen|start\w*|schritt\w*|so vorgehen|so umsetzen)\b/i;
const istVerfahrensfrage = (z) => ZUSTIMMUNGSFORM.test(z) && (VERFAHREN.test(z) || z.length < 12);

const zeilenMitFrage = (text) => String(text ?? '')
  .split('\n')
  .map((z) => z.replace(/^[\s>*\-–•]*(\d+[.)]\s*)?/, '').replace(/\*\*/g, '').trim())
  .filter((z) => z.endsWith('?'));

/** Die Fragen einer Agentenantwort: Sätze mit Fragezeichen, ohne die Bitte um Zustimmung zum Vorgehen. */
export function fragen(text) {
  return zeilenMitFrage(text).filter((z) => !istVerfahrensfrage(z));
}

const ANALYSE_WORT = /\b(ConOps|Einsatzkonzept|Trade(-| )?(off|Study|Studie)|Variantenvergleich|Annahmen-Review|Assumption Review|FMEA|Fehlerbetrachtung|Bauplan|Implementation Plan|Analysen?|abnehmen|abgenommen\w*|Abnahmegrund)\b|\bAF-(\*|0\d)/i;
/** Eine uid des Modells (Großschreibung zählt — „Test-Datei" ist keine) oder ein Begriff der Modellarbeit. */
const MODELL_UID = /\b(?:SYS|UC|REQ|FUNC|FCHAIN|FLOW|SCHEMA|MOD|TEST|ACTOR|CR|MS)-[A-Za-z0-9-]+/;
const MODELL_WORT = /\b(Kanten?|Knoten|Trace|satisfy|compose|allocate|Producer|Erzeuger|Konsument\w*|Erfüller|redundant|Duplikat|löschen|zusammenlegen|Meilenstein\w*|Wirkketten?|Kettenprofil|Datenfluss|Datenflüsse|Protokoll|Record)\b/i;

/** Die Zeilen des Blatts, die eine Frage am besten treffen (meiste Stichworte; ohne Treffer keine). */
export function blattTreffer(frage, eintraege) {
  const f = frage.toLowerCase();
  const gewertet = eintraege.map((e) => ({ e, n: e.stichworte.filter((s) => f.includes(s)).length })).filter((x) => x.n > 0);
  const best = Math.max(0, ...gewertet.map((x) => x.n));
  return gewertet.filter((x) => x.n === best).map((x) => x.e);
}

/** Was eine Frage ist: `analyse` (Politik antwortet) · `blatt` (das Blatt deckt sie) · `modell` (Entscheidung des Agenten) · `wissen` (Wissensfrage ohne Treffer). */
export function frageArt(frage, eintraege) {
  if (ANALYSE_WORT.test(frage)) return 'analyse';
  if (blattTreffer(frage, eintraege).length) return 'blatt';
  return MODELL_UID.test(frage) || MODELL_WORT.test(frage) ? 'modell' : 'wissen';
}

/**
 * Die nächste Nachricht des Nutzers.
 * @param {{ antwort: string, vorschlag: string | null, blattGegeben: boolean, antwortblatt: string, antworten?: {stichworte: string[], text: string}[],
 *   gebaut: boolean, politik?: { analysen: string, freigabe: string }, ziel?: { erreicht: boolean, text: string | null } }} lage
 * @returns {{ nachricht: string, blattGegeben: boolean, beantwortet: number, vorschlag: string | null, entscheidungen: object[] }}
 *   `vorschlag` ist graphcodes Vorschlag, wenn er abgeschickt wurde — sonst null.
 */
export function naechsteNachricht({ antwort, vorschlag, blattGegeben, antwortblatt, antworten = [], gebaut, politik = POLITIK, ziel = null }) {
  const offen = fragen(antwort);
  const stand = ziel?.text ? ` ${ziel.text}` : '';
  const entscheidungen = [];

  // Der Impuls des Nutzers, wenn er nichts (mehr) zu beantworten hat: graphcodes Vorschlag — soweit die Politik der
  // Aufgabe ihn trägt —, sonst die Zustimmung zum Plan des Agenten.
  const impuls = () => {
    if (vorschlag && analyseIn(vorschlag) && politik.analysen === 'ablehnen') {
      entscheidungen.push({ art: 'analyse-abgelehnt', vorschlag });
      return { text: `${ANALYSEN_NEIN}${stand}`, vorschlag: null };
    }
    if (vorschlag === FREIGABE && politik.freigabe === 'bei-ziel' && ziel && !ziel.erreicht) {
      entscheidungen.push({ art: 'freigabe-verweigert', stand: ziel.text });
      return { text: `${NOCH_NICHT}${stand}`, vorschlag: null };
    }
    if (vorschlag) {
      entscheidungen.push({ art: 'vorschlag', vorschlag });
      return { text: vorschlag, vorschlag };
    }
    entscheidungen.push({ art: 'zustimmung' });
    return { text: gebaut ? WEITER : ZUSTIMMUNG, vorschlag: null };
  };

  if (offen.length === 0) {
    const i = impuls();
    return { nachricht: i.text, blattGegeben, beantwortet: 0, vorschlag: i.vorschlag, entscheidungen };
  }

  const arten = offen.map((f) => ({ frage: f, art: frageArt(f, antworten) }));
  const teile = [];
  const analyse = arten.filter((a) => a.art === 'analyse');
  if (analyse.length > 0) {
    teile.push(politik.analysen === 'ablehnen' ? ANALYSEN_NEIN : ANALYSEN_JA);
    entscheidungen.push({ art: 'analyse-antwort', politik: politik.analysen, fragen: analyse.length });
  }
  const wissen = arten.filter((a) => a.art === 'blatt' || a.art === 'wissen');
  let jetztGegeben = blattGegeben;
  if (wissen.length > 0 && !blattGegeben) {
    // Erste Runde der Sitzung: das ganze Blatt, wie der Autor die Fragen im Handlauf beantwortet hat.
    teile.push(`${antwortblatt.trim()}\n\n${OFFEN}`);
    entscheidungen.push({ art: 'blatt-ganz', fragen: wissen.length });
    jetztGegeben = true;
  } else if (wissen.length > 0) {
    const zeilen = [];
    let ohneTreffer = false;
    for (const w of wissen) {
      const treffer = blattTreffer(w.frage, antworten);
      for (const t of treffer) if (!zeilen.includes(t.text)) zeilen.push(t.text);
      ohneTreffer ||= treffer.length === 0;
      entscheidungen.push(treffer.length ? { art: 'blatt-zeile', frage: w.frage, treffer: treffer.map((t) => t.text) } : { art: 'offen', frage: w.frage });
    }
    if (zeilen.length) teile.push(zeilen.map((z) => `- ${z}`).join('\n'));
    if (ohneTreffer) teile.push(zeilen.length ? `Zum Rest: ${OFFEN_EINZELN}` : OFFEN_EINZELN);
  }
  const modell = arten.filter((a) => a.art === 'modell');
  if (modell.length > 0) {
    teile.push(DEINE_ENTSCHEIDUNG);
    for (const m of modell) entscheidungen.push({ art: 'modell-entscheidung', frage: m.frage });
  }
  // Nach Wissensfragen folgt der Impuls wie im Handlauf (Antworten vor dem Vorschlag, eine Nachricht). Wartet der Agent
  // dagegen auf eine Entscheidung — am Modell oder über die Analysen —, wäre graphcodes Vorschlag eine zweite, womöglich
  // widersprechende Anweisung: er bleibt für diesen Zug liegen.
  if (modell.length > 0 || analyse.length > 0) {
    if (vorschlag) entscheidungen.push({ art: 'vorschlag-zurueckgestellt', vorschlag });
    teile.push(gebaut ? MACH_WEITER : ZUSTIMMUNG);
    return { nachricht: teile.join('\n\n'), blattGegeben: jetztGegeben, beantwortet: offen.length, vorschlag: null, entscheidungen };
  }
  const i = impuls();
  teile.push(i.text);
  return { nachricht: teile.join('\n\n'), blattGegeben: jetztGegeben, beantwortet: offen.length, vorschlag: i.vorschlag, entscheidungen };
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
 * Readiness SRR und PDR als bestanden meldet; `warnungsfrei` endet, sobald die Regelprüfung weder Fehler noch offene
 * Warnung meldet (mit Grund abgenommene Funde zählen nicht — `befund.abgenommen` weist sie aus). Eine neue Stufe
 * bekommt hier ihr Ziel — der Treiber kennt nur den Namen des erreichten Ziels.
 */
export const ZIEL = {
  modellieren: (gates) => (gates?.SRR && gates?.PDR ? 'srr+pdr' : null),
  warnungsfrei: (gates, befund) => (befund && befund.fehler === 0 && befund.warnungen === 0 ? 'warnungsfrei' : null),
};

/** Was dem Ziel der Stufe noch fehlt, als Satz des Nutzers — null, wenn die Stufe keinen Stand zu nennen hat. */
export function zielText(stufe, befund) {
  if (stufe !== 'warnungsfrei' || !befund) return null;
  const jeRegel = new Map();
  for (const o of befund.offen ?? []) jeRegel.set(o.regel, (jeRegel.get(o.regel) ?? 0) + 1);
  const liste = [...jeRegel.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => (n > 1 ? `${r} ×${n}` : r)).join(', ');
  const n = befund.fehler + befund.warnungen;
  return n === 0 ? 'Die Regelprüfung ist ohne offene Warnung.' : `Die Regelprüfung meldet noch ${n} offene ${n === 1 ? 'Warnung' : 'Warnungen'}${liste ? `: ${liste}` : ''}.`;
}

/** Nach so vielen Zügen in Folge ohne angenommene Mutation steht der Lauf still. */
export const STILLSTAND = 4;

/** Ende nach einem Zug: Ziel der Stufe erreicht, Freigabe-Bitte abgeschickt, Stillstand oder Zuglimit. */
export function ende(zug, maxZuege, letzteNachricht, erreicht = null, leerlauf = 0) {
  if (erreicht) return erreicht;
  if (String(letzteNachricht ?? '').endsWith(FREIGABE)) return 'freigabe';
  if (leerlauf >= STILLSTAND) return 'stillstand';
  return zug >= maxZuege ? 'zuglimit' : null;
}
