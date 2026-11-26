/**
 * generate-klauseln.ts — die Texte und Skill-Zeiger des Generierungsschritts (CR-GC-1032).
 *
 * Abgetrennt aus `generate.ts`: hier steht, WAS der Schritt dem Agenten sagt (Gate-Protokoll,
 * Regel-Klauseln, Vorlagen je Stufe, Handoff) und WELCHE Anleitung er nennt. Wann welcher Text
 * gilt, entscheidet `generate-step-core.ts`. Gemessen (Änderungs-Heatmap, CR-GC-1029, heute in graphanalyze): Text und
 * Logik änderten sich in getrennten Commits; getrennt bleibt jede Datei unter 500 Zeilen.
 */
import { RULE_HELP, TASK_ENTRY, type RuleTask } from '@sigloch/contracts/se';
import { decision } from './decisions.js';
import { STEUER_FENSTER, type SteerOptimum } from './stagnation.js';
import { ANALYSE_TASKS } from './task-artifact.js';

/**
 * Welche Autorier-Anleitung zu welcher Fokus-Dimension gehoert (CR-GC-558; seit CR-GC-589 HIER,
 * der Host liest sie als Verweis im Schritt). Vorher stand sie nur im Executor — Claude Code las `se:generate` einmal bei 2–5 % des
 * Laufs und die Anlege-Skills erst am Ende, um Frischestempel zu erfuellen.
 *
 * Sichten (`docs/views/*.md`) bleiben draussen: Darstellungen, keine Bauanleitungen. `ver`/`schema`/`cr`/`ms`
 * fehlen, weil es fuer sie keinen Autorier-Skill GIBT — ein Eintrag waere eine Luege.
 */
export const SKILL_FOR_STAGE: Record<string, { name: string; file: string } | undefined> = {
  'seed:sys': { name: 'se:top-level', file: 'top-level.md' },
  'seed:uc': { name: 'se:author-uc', file: 'author-uc.md' },
  'seed:actor': { name: 'se:author-actor', file: 'author-actor.md' },
  System: { name: 'se:author-uc', file: 'author-uc.md' },
  Anwendungsfall: { name: 'se:author-uc', file: 'author-uc.md' },
  Anforderung: { name: 'se:author-req', file: 'author-req.md' },
  Wirkkette: { name: 'se:author-uc', file: 'author-uc.md' },
  Funktion: { name: 'se:top-level', file: 'top-level.md' },
  Datenfluss: { name: 'se:top-level', file: 'top-level.md' },
  Modul: { name: 'se:top-level', file: 'top-level.md' },
  immer: { name: 'se:top-level', file: 'top-level.md' },
};

/** Gate-Protokoll — identisch in jeder Phase; Kandidatenwahl ist Gate-Sache, nie
 * LLM-Bauchgefühl. Bis CR-GC-777 stand daneben eine Treiber-Fassung fuer den eingebetteten
 * Executor (CR-GC-288); seit dessen Auslagerung (CR-GC-775) gibt es nur diese.
 *
 * CR-GC-577: das Protokoll verlangt die Probe nur noch bei MEHREREN Alternativen.
 * Gemessen an `runs/opus5-5`: sechs Paare aus Probe und Anwendung DESSELBEN Batches, und
 * das Gate lieferte seinen Befundsatz jedes Mal zweimal — 20 % des graph_mutate-Payloads,
 * auch nach CR-GC-570/576/579 (der Posten schrumpfte um 76 %, sein ANTEIL nur von 24 auf
 * 20 %, weil der Rest mitschrumpfte).
 *
 * Die Gegenrechnung ueber alle Rig-Laeufe entscheidet es: der `opus5`-Arm probte 30-mal,
 * 4 Proben ergaben `block`, 3 davon wurden nicht angewandt. Diese 3 haben KEINEN Schaden
 * verhindert — eine abgelehnte Anwendung persistiert nichts (Invariante in
 * `mcp.mutate-violations.test.ts`). Damit ist die Arithmetik eindeutig: ohne Probe kostet
 * ein sauberer Batch EINE Antwort und ein abgelehnter zwei; mit Probe kostet der saubere
 * zwei und der abgelehnte mindestens zwei. Proben ist bei einem Kandidaten nie billiger
 * und war es in 26 der 30 Faelle nachweislich nicht.
 *
 * Bei MEHREREN Alternativen bleibt die Probe richtig: sie ist die einzige Art, Verdicts zu
 * vergleichen, ohne sie zu verursachen — die Grundlage von Best-of-N (CR-GC-288). */
const PROTOCOL_GUIDE =
  'Gate-Protokoll: (1) vor dem Schreiben graph_authoring_guide für jeden Elementtyp aufrufen (legale Kanten). ';
// CR-GC-729: der naechste Schritt des Agenten kommt nur von graph_generate. Der `vorschlag` an der
// Mutationsantwort ist fuer den Nutzer (CR-GC-588 hatte dort den Imperativ — der Client las ihn als Auftrag).
const PROTOCOL_NEXT_HOST =
  'Den nächsten Schritt holst du mit graph_generate; der `vorschlag` an der Mutationsantwort ist für den Nutzer, nicht für dich.';
export const GATE_PROTOCOL =
  PROTOCOL_GUIDE +
  // CR-GC-587: die Probe-Regel kommt aus dem Register, nicht aus Prosa hier.
  // CR-GC-928: keine Rangfolge — der Spike zu CR-GC-771 hat sie widerlegt, bei mehreren zulässigen Entwürfen wählt der Autor.
  '(2) ' + decision('probe') + ' ' +
  '(3) Mehrere zulässige Alternativen legst du dem Autor mit ihren Verdicts vor; er wählt. Den gewählten oder einzigen Batch wendest du OHNE dryRun an; block-Verdicts verwerfen oder revidieren, nie erzwingen. ' +
  '(4) ' +
  PROTOCOL_NEXT_HOST;

/**
 * Regel-spezifische Zusatzklausel, NUR gerendert wenn genau diese Regel das
 * Fund-Fenster der Runde stellt (CR-GC-358).
 *
 * Warum nicht im Dimensions-Template: dort stand die R-15-Klausel als
 * unbedingter Satz neben „FCHAIN-Szenarien (UC compose FCHAIN)" — also
 * „lege eine FCHAIN an" UND „lege KEINE neue FCHAIN an" in EINEM String, in
 * JEDER uc-Runde, unabhängig davon ob überhaupt eine leere FCHAIN existierte.
 * qwen3.8 hat den Widerspruch im Reasoning auseinandergenommen („this is a
 * direct conflict") und dann 4347 Denk-Token ohne Tool-Call verbraucht;
 * schwächere Modelle haben ihn überlesen. Die Regel R-15 selbst ist korrekt —
 * falsch war, sie als Prosa zu BEHAUPTEN statt aus dem Zustand abzuleiten
 * („enforce, don't document"). `windowsOf` gruppiert je rule_id, ein Fenster
 * trägt also genau eine Regel: die Klausel wird exakt und mit den konkreten
 * uids gerendert oder gar nicht.
 */
/** Der Ausschnitt des Bestands, den eine Klausel liest. */
export type KlauselBestand = {
  elements: ReadonlyArray<{ id: string; type: string }>;
  traces: ReadonlyArray<{ source: string; target: string; type: string }>;
};

/**
 * UC-02-Skelett je UC (ITEM-2026-625): die uids stehen fest, das Modell schreibt nur die Texte.
 * Gemessen S2 gcrun-333..335: ein Platzhalter-Vorbild (`FLOW-beispiel-eingabe` …) uebernahm
 * qwen3-coder 4–8x je Lauf woertlich, der Preflight blockte jedes Mal. FCHAIN und ACTOR kommen aus
 * dem Bestand, wo es sie gibt; eine fehlende FCHAIN wird angelegt und an den UC gehaengt. Die Texte
 * bleiben Platzhalter «… A» — uebernommen blockt sie der Preflight, mit Hinweis.
 */
function uc02Skelett(uc: string, og?: KlauselBestand): string {
  const name = uc.replace(/^UC-/, '');
  const typ = new Map((og?.elements ?? []).map((e) => [e.id, e.type]));
  const kette = og?.traces.find((t) => t.source === uc && t.type === 'compose' && typ.get(t.target) === 'FCHAIN')?.target;
  const akteure = (og?.elements ?? []).filter((e) => e.type === 'ACTOR').map((e) => e.id);
  const fchain = kette ?? `FCHAIN-${name}`;
  const actor = akteure[0] ?? `ACTOR-${name}-akteur`;
  const knoten = [
    `### FLOW\n+ FLOW-${name}-eingabe|«Eingabe A» von «Akteur A» an das System [__name:«Eingabe A»]`,
    `### SCHEMA\n+ SCHEMA-${name}-eingabe|Form von «Eingabe A»: «Feld A» und «Feld B» [__name:Vertrag «Eingabe A»]`,
    `### FUNC\n+ FUNC-${name}-annehmen|Nimmt «Eingabe A» entgegen und «Wirkung A». [__name:«Eingabe A» annehmen]`,
    ...(kette ? [] : [`### FCHAIN\n+ ${fchain}|«Ablauf A» des UC [__name:«Ablauf A»]`]),
    ...(akteure.length ? [] : [`### ACTOR\n+ ${actor}|«Akteur A» aus dem Auftrag [__name:«Akteur A»]`]),
  ];
  const kanten = [
    ...(kette ? [] : [`+ ${uc} -compose-> ${fchain}`]),
    `+ ${actor} -io-> FLOW-${name}-eingabe`,
    `+ FLOW-${name}-eingabe -io-> FUNC-${name}-annehmen`,
    `+ FLOW-${name}-eingabe -relation-> SCHEMA-${name}-eingabe`,
    `+ ${fchain} -compose-> FUNC-${name}-annehmen`,
  ];
  const wahl = akteure.length > 1 ? ` (ACTOR: den passenden aus ${akteure.join(', ')})` : '';
  return `Fuer ${uc}${wahl}:\n## Nodes\n${knoten.join('\n')}\n\n## Edges\n${kanten.join('\n')}`;
}

/**
 * FC-04-Skelett je Kette (ITEM-2026-629): Eingang ACTOR→FLOW→FUNC und Ausgang FUNC→FLOW→ACTOR, nur
 * was fehlt. FUNC (Eingang: erste, Ausgang: letzte der Kette) und ACTOR kommen aus dem Bestand; die
 * neuen FLOW/SCHEMA-uids stehen fest. Gemessen S2 gcrun-336..338: ohne Klausel ~16 von 40 Runden
 * Stillstand, der Ausgang (FUNC -io-> FLOW -io-> ACTOR) in keinem Lauf.
 */
function fc04Skelett(kette: string, og?: KlauselBestand): string {
  const name = kette.replace(/^FCHAIN-/, '');
  const typ = new Map((og?.elements ?? []).map((e) => [e.id, e.type]));
  const io = (og?.traces ?? []).filter((t) => t.type === 'io');
  const glieder = (og?.traces ?? [])
    .filter((t) => t.source === kette && t.type === 'compose' && typ.get(t.target) === 'FUNC')
    .map((t) => t.target);
  const akteure = (og?.elements ?? []).filter((e) => e.type === 'ACTOR').map((e) => e.id);
  const actor = akteure[0] ?? `ACTOR-${name}-akteur`;
  const vonAkteur = new Set(io.filter((t) => typ.get(t.source) === 'ACTOR').map((t) => t.target));
  const zuAkteur = new Set(io.filter((t) => typ.get(t.target) === 'ACTOR').map((t) => t.source));
  const eingang = io.some((t) => glieder.includes(t.target) && vonAkteur.has(t.source));
  const ausgang = io.some((t) => glieder.includes(t.source) && zuAkteur.has(t.target));
  const neueFunc = glieder.length === 0;
  const erste = glieder[0] ?? `FUNC-${name}-liefern`;
  const letzte = glieder.at(-1) ?? erste;

  const flows: string[] = [];
  const schemas: string[] = [];
  const kanten: string[] = [];
  if (!eingang) {
    flows.push(`+ FLOW-${name}-eingabe|«Eingabe A» von «Akteur A» an die Kette [__name:«Eingabe A»]`);
    schemas.push(`+ SCHEMA-${name}-eingabe|Form von «Eingabe A»: «Feld A» und «Feld B» [__name:Vertrag «Eingabe A»]`);
    kanten.push(`+ ${actor} -io-> FLOW-${name}-eingabe`, `+ FLOW-${name}-eingabe -io-> ${erste}`,
      `+ FLOW-${name}-eingabe -relation-> SCHEMA-${name}-eingabe`);
  }
  if (!ausgang) {
    flows.push(`+ FLOW-${name}-ergebnis|«Ergebnis A», das die Kette an «Akteur A» liefert [__name:«Ergebnis A»]`);
    schemas.push(`+ SCHEMA-${name}-ergebnis|Form von «Ergebnis A»: «Feld A» und «Feld B» [__name:Vertrag «Ergebnis A»]`);
    kanten.push(`+ ${letzte} -io-> FLOW-${name}-ergebnis`, `+ FLOW-${name}-ergebnis -io-> ${actor}`,
      `+ FLOW-${name}-ergebnis -relation-> SCHEMA-${name}-ergebnis`);
  }
  const knoten = [
    `### FLOW\n${flows.join('\n')}`,
    `### SCHEMA\n${schemas.join('\n')}`,
    ...(neueFunc ? [`### FUNC\n+ ${erste}|Liefert «Ergebnis A». [__name:«Ergebnis A» liefern]`] : []),
    ...(akteure.length ? [] : [`### ACTOR\n+ ${actor}|«Akteur A» aus dem Auftrag [__name:«Akteur A»]`]),
  ];
  if (neueFunc) kanten.push(`+ ${kette} -compose-> ${erste}`);
  const wahl = akteure.length > 1 ? ` (ACTOR: den passenden aus ${akteure.join(', ')})` : '';
  return `Fuer ${kette}${wahl}:\n## Nodes\n${knoten.join('\n')}\n\n## Edges\n${kanten.join('\n')}`;
}

export const RULE_CLAUSE: Record<
  string,
  {
    types: string[];
    /** `og`: der Bestand, fuer Klauseln, die ihr Vorbild aus dem Fund ableiten (ITEM-2026-625). */
    text: (uids: string[], og?: KlauselBestand) => string;
    skill: { name: string; file: string } | null;
  }
> = {
  'R-15': {
    types: ['FCHAIN', 'FUNC'],
    text: (uids) =>
      `Diese Funde sind BESTEHENDE, leere FCHAINs (${uids.join(', ')}): häng an jede davon 3±2 FUNC-Elemente` +
      ' (FCHAIN compose→FUNC), die den Ablauf in Schritte zerlegen.',
    // CR-GC-655: keine Anleitung — die Klausel beschreibt die Arbeit; der uc-Skill zeigte UC-Anlegen.
    skill: null,
  },
  // CR-GC-564: Wortlaut aus dem req-Template — dort beschreibt er dieselbe Arbeit korrekt.
  // UC-01 liegt in der uc-Dimension, deren Template ACTOR/FCHAIN/UC verlangt und REQ nicht
  // einmal erwähnt. Gemessen in Rig-Lauf 5: das Modell folgte dem Template, null REQ.
  'UC-01': {
    // CR-GC-566: REQ und TEST gehören in den Fokus, sonst liefert die Injektion die
    // Grammatik nicht, die dieser Text verlangt — und das Modell MUSS danach fragen.
    types: ['UC', 'REQ', 'TEST'],
    // CR-GC-661: die MENGE steht im Vorbild, nicht nur im Satz. Gemessen gcrun-100..102: mit einem
    // Ein-REQ-Beispiel schrieb qwen3-coder in 9 von 11 UC-01-Batches genau eine REQ fuer einen UC.
    // CR-GC-667: die Grenz-REQ zeigt den offenen Wert samt Fragezeile. Mit „in hoechstens «Grenzwert A»"
    // fuellte das Modell den Platzhalter (gcrun-0..2 am 2026-09-27: 10 erfundene Grenzen, 0 Fragen).
    text: (uids) =>
      `Diese UCs haben keine Anforderungen (${uids.join(', ')}): schlage je UC 3–5 REQ-Kandidaten vor` +
      ' (UC compose→REQ), präzise und prüfbar formuliert. Emittiere jede neue REQ zusammen mit einem' +
      ' TEST (TEST verify→REQ) im selben Batch — eine REQ ohne verify-TEST blockt das Gate (R-01).' +
      ` Bediene ALLE ${uids.length} UCs in EINEM Batch, je UC mindestens zwei REQs — Vorbild fuer zwei UCs — Platzhalter «…» aus dem Auftrag fuellen, eine Aussage je REQ, genau ein kinds-Wert. Nennt der Auftrag einen Wert nicht, erfinde keinen — Fragezeile und offener Wert:\n` +
      '? Welcher Grenzwert gilt fuer «Ergebnis A»?\n## Nodes\n### REQ\n' +
      '+ REQ-beispiel-a-ablauf|Das System muss «Ergebnis A» erzeugen, sobald «Ausloeser A» eintritt. [__name:«Ergebnis A» erzeugen]\n@kinds ["functional"]\n' +
      '+ REQ-beispiel-a-grenze|Das System muss «Ergebnis A» innerhalb eines Grenzwerts erzeugen; Grenzwert offen, beim Auftraggeber erfragt. [__name:Grenze fuer «Ergebnis A»]\n@kinds ["non-functional"]\n' +
      '+ REQ-beispiel-b-ablauf|Das System muss «Ergebnis B» an «Empfaenger B» uebergeben. [__name:«Ergebnis B» uebergeben]\n@kinds ["functional"]\n' +
      '+ REQ-beispiel-b-abweisung|Das System muss «Eingabe B» abweisen, wenn «Bedingung B» verletzt ist. [__name:«Eingabe B» abweisen]\n@kinds ["functional"]\n' +
      '### TEST\n' +
      '+ TEST-beispiel-a-ablauf|«Ausloeser A» herbeifuehren, «Ergebnis A» pruefen. [__name:Ablauf A pruefen]\n' +
      '+ TEST-beispiel-a-grenze|«Ausloeser A» herbeifuehren, Zeit gegen den erfragten Grenzwert messen. [__name:Grenze A messen]\n' +
      '+ TEST-beispiel-b-ablauf|«Ergebnis B» erzeugen, Eingang bei «Empfaenger B» pruefen. [__name:Uebergabe B pruefen]\n' +
      '+ TEST-beispiel-b-abweisung|«Eingabe B» mit verletzter «Bedingung B» senden, Abweisung pruefen. [__name:Abweisung B pruefen]\n\n' +
      '## Edges\n+ UC-beispiel-a -compose-> REQ-beispiel-a-ablauf, REQ-beispiel-a-grenze\n' +
      '+ UC-beispiel-b -compose-> REQ-beispiel-b-ablauf, REQ-beispiel-b-abweisung\n' +
      '+ TEST-beispiel-a-ablauf -verify-> REQ-beispiel-a-ablauf\n+ TEST-beispiel-a-grenze -verify-> REQ-beispiel-a-grenze\n' +
      '+ TEST-beispiel-b-ablauf -verify-> REQ-beispiel-b-ablauf\n+ TEST-beispiel-b-abweisung -verify-> REQ-beispiel-b-abweisung',
    skill: { name: 'se:author-req', file: 'author-req.md' },
  },
  // CR-GC-564: der legale Pfad AUSGESCHRIEBEN. ACTOR direkt an UC oder FCHAIN ist die
  // Fehlerart, die Lauf 3 zwei Runden an R-18-Ablehnungen gekostet hat.
  'UC-02': {
    // CR-GC-658: SCHEMA im Fokus — der Pfad braucht je FLOW einen Vertrag, und das Vorbild nennt ihn.
    types: ['ACTOR', 'UC', 'FCHAIN', 'FUNC', 'FLOW', 'SCHEMA'],
    text: (uids, og) =>
      `Diese UCs sind von keinem ACTOR erreichbar (${uids.join(', ')}): der EINZIGE legale Weg ist` +
      ' ACTOR io→FLOW io→FUNC, wobei die FUNC Mitglied einer FCHAIN des UC ist. ACTOR direkt an UC' +
      ' oder an FCHAIN wird von R-18 abgewiesen, in beiden Richtungen. Jeder FLOW braucht genau einen' +
      ' Vertrag (FLOW relation→SCHEMA) und genau einen Erzeuger. Die uids unten stehen fest — uebernimm' +
      ' sie; ersetze jeden Platzhalter «… A» durch Text aus dem Auftrag. Alle UCs in EINEM Batch:\n' +
      uids.map((uc) => uc02Skelett(uc, og)).join('\n\n'),
    // ITEM-2026-607: Platzhalter statt Inhalt. Das fruehere Vorbild (Anfrage/Nutzer/Sitzungs-ID) stand
    // woertlich in 7 von 9 Laeufen (CR-GC-682); `beispiel`-uids und «X A» sperrt der Preflight (CR-GC-672).
    // CR-GC-658: das Vorbild steht in der Klausel, weil sie die Arbeit beschreibt — ohne es scheiterte
    // qwen3-coder an FLOW ohne SCHEMA (42x R-18) und an Platzhalter-uids (STRUCT), gcrun-70..72.
    // CR-GC-655: bewusst KEIN se:author-uc (so empfiehlt es contracts RULE_HELP). Gemessen gcrun-60/62:
    // mit dem uc-Skill schrieb qwen3-coder dessen Beispiel ab (SYS compose UC, UC compose FCHAIN) und
    // deklarierte drei Runden lang dieselben UCs neu, teils mit neuer Beschreibung — Fund ungeloest.
    skill: null,
  },
  // ITEM-2026-629: Eingang und Ausgang je Kette, uids aus dem Bestand vorgegeben.
  'FC-04': {
    types: ['FCHAIN', 'FUNC', 'FLOW', 'SCHEMA', 'ACTOR'],
    text: (uids, og) =>
      `Diese Wirkketten sind nicht an Akteure gebunden (${uids.join(', ')}): jede braucht einen Eingang` +
      ' (ACTOR io→FLOW io→FUNC der Kette — etwas loest sie aus) UND einen Ausgang (FUNC der Kette io→FLOW' +
      ' io→ACTOR — sie liefert etwas zurueck). Jeder FLOW braucht genau einen Vertrag (FLOW relation→SCHEMA).' +
      ' Die uids unten stehen fest — uebernimm sie; ersetze jeden Platzhalter «… A» durch Text aus dem' +
      ' Auftrag. Alle Ketten in EINEM Batch:\n' +
      uids.map((k) => fc04Skelett(k, og)).join('\n\n'),
    skill: null,
  },
  // CR-GC-648: RD-01 liegt in der req-Dimension, deren Template „3–5 neue REQs je UC" verlangt —
  // das Gegenteil dessen, was der Fund braucht: die REQ existiert, ihr fehlt der Erfüller. Und
  // die Fokus-Typen der Dimension (UC/REQ/TEST) enthielten keinen einzigen Quelltyp: gemessen am
  // eigenen Modell trug die Element-Liste 6,7k Zeichen REQ-Namen und keine FUNC-uid, an die
  // das Modell die satisfy-Kante haette haengen koennen.
  'RD-01': {
    types: ['REQ', 'FUNC', 'FCHAIN', 'MOD', 'SYS'],
    text: (uids) =>
      `Diese REQs sind Blaetter ohne Erfueller (${uids.join(', ')}): verbinde jede mit dem Element,` +
      ' das sie erfuellt — FUNC, FCHAIN, MOD oder SYS satisfy→REQ, mit existierenden uids aus der' +
      ' Element-Liste. Lege KEINE neue REQ an. Eine REQ mit kinds functional erfuellt eine FUNC der' +
      ' zugehoerigen FCHAIN; non-functional erfuellt ein MOD, das SYS oder eine FCHAIN (Ende-zu-Ende).' +
      ' Fehlen einer REQ die kinds, setze genau einen Wert im selben Batch. Vorbild:\n' +
      '## Nodes\n### REQ\n~ REQ-beispiel-ablauf\n@kinds ["functional"]\n\n' +
      '## Edges\n+ FUNC-beispiel-erzeugen -satisfy-> REQ-beispiel-ablauf\n' +
      '+ FCHAIN-beispiel -satisfy-> REQ-beispiel-grenze',
    // CR-GC-655: keine Anleitung — author-req zeigt REQ-Anlegen, die Klausel verbietet genau das.
    skill: null,
  },
};

/** Generative Instruktion je Readiness-Dimension — die einzige Handlungsanweisung des
 * Systems, seit die generischen Lese-Zwillinge in `steering.ts` mit CR-GC-562 gefallen sind. */
const VORLAGE_UC =
  'Schlage je Fund 2–3 Kandidaten vor: fehlende ACTORs (Anbindung ACTOR io→FLOW io→FUNC in der FCHAIN des UC), FCHAIN-Szenarien (UC compose FCHAIN) oder fehlende UCs aus der Intention. UC-Stil: Actor–Verb–Objekt–Ergebnis, ≤25 Wörter — die volle Anleitung steht als Block im Rundeninhalt.';
const VORLAGE_REQ =
  'Schlage je UC ohne Requirements 3–5 REQ-Kandidaten vor (UC compose REQ), präzise und prüfbar formuliert; emittiere jede neue REQ zusammen mit einem TEST (TEST verify REQ) im selben Batch — eine REQ ohne verify-TEST blockt das Gate (R-01). Löse Platzhalter/Ambiguität in bestehenden REQs auf.';
const VORLAGE_ARCH =
  'Zerlege je Fund die FCHAIN/FUNC-Ebene: 7±2 FUNCs pro Zerlegungsebene (RD-04), FLOWs zwischen FUNCs (io). Schlage je Fund 2 alternative FUNC/FCHAIN-Zerlegungen vor — jede neue FUNC zusammen mit satisfy→REQ und allocate→MOD im selben Batch (fehlt die REQ oder das MOD im Graphen, zuerst anlegen). Mehrere zulässige Zerlegungen legst du dem Autor vor.';
const VORLAGE_ALLOC =
  'Schlage MOD-Schnitte vor (intern stark, extern schwach gekoppelt) und allocate-Kanten FUNC→MOD; 2 Alternativen; mehrere zulässige legst du dem Autor vor.';
const VORLAGE_VER =
  'Schlage je unverifiziertem REQ einen TEST-Kandidaten vor (TEST verify REQ), mit konkretem Prüfschritt in der description.';
const VORLAGE_SCHEMA =
  'Schlage SCHEMA-Definitionen für die FLOWs ohne Schema vor (FLOW relation SCHEMA), eine pro Datenform, wiederverwendet statt dupliziert.';
const VORLAGE_MS =
  'Schlage 2–4 Milestones mit depends-on-Reihenfolge vor (MS relation MS) und ordne CRs zu (CR relation MS).';
/** Generative Instruktion je STUFE (CR-GC-757) — eine Vorlage kann an mehreren Stufen stehen. Abgleich hat keine: was
 * dort meldet, loest kein Modellzug. */
export const GENERATION_TEMPLATE: Record<string, string> = {
  System: VORLAGE_UC,
  Anwendungsfall: VORLAGE_UC,
  Anforderung: VORLAGE_REQ,
  Wirkkette: VORLAGE_UC,
  Funktion: VORLAGE_ARCH,
  Datenfluss: VORLAGE_ARCH,
  Modul: VORLAGE_ALLOC,
  Schema: VORLAGE_SCHEMA,
  Test: VORLAGE_VER,
  Plan: VORLAGE_MS,
  Bindung: VORLAGE_VER,
  immer: VORLAGE_ARCH,
};

/**
 * Fokus-Elementtypen je Readiness-Dimension (CR-GC-285). Der Kaltstart steht seit
 * CR-GC-559 in `SEED_STAGES` — hier stehen nur Readiness-Dimensionen.
 * Keys = die Dimensionen von GENERATION_TEMPLATE.
 */
export const STAGE_FOCUS_TYPES: Record<string, string[]> = {
  System: ['ACTOR', 'UC', 'FCHAIN', 'FUNC', 'FLOW'],
  Anwendungsfall: ['ACTOR', 'UC', 'FCHAIN', 'FUNC', 'FLOW'],
  Anforderung: ['UC', 'REQ', 'TEST'],
  Wirkkette: ['ACTOR', 'UC', 'FCHAIN', 'FUNC', 'FLOW'],
  Funktion: ['FCHAIN', 'FUNC', 'FLOW', 'REQ', 'MOD'],
  Datenfluss: ['FCHAIN', 'FUNC', 'FLOW', 'REQ', 'MOD'],
  Modul: ['FUNC', 'MOD'],
  Schema: ['FLOW', 'SCHEMA'],
  Test: ['TEST', 'REQ'],
  Plan: ['MS', 'CR'],
  Bindung: ['TEST', 'REQ'],
  immer: ['FCHAIN', 'FUNC', 'FLOW', 'REQ', 'MOD'],
};

/**
 * Der Skill je Task (CR-GC-601) — die Blackbox, die das detaillierte Regelset abarbeitet.
 * Anforderungsqualitaet faehrt mit `se:author-req` (Entscheidung 2026-09-22: BQ ist Teil des
 * REQ-Autorierens, kein eigener Skill).
 */
export const TASK_SKILL: Readonly<Record<Exclude<RuleTask, 'kern'>, string>> = {
  conops: 'se-conops',
  trade: 'se-trade',
  irr: 'se-irr',
  fmea: 'se-fmea',
  plan: 'se-plan',
  anforderungsqualitaet: 'se:author-req',
};
export const TASK_OF_ENTRY = new Map(
  (Object.entries(TASK_ENTRY) as [Exclude<RuleTask, 'kern'>, string | null][]).filter(([, e]) => e).map(([t, e]) => [e as string, t]),
);

/**
 * Der Skill der Analyse, zu der eine Regel gehoert (CR-GC-748) — gelesen aus der Regelhilfe
 * (contracts `RULE_HELP[…].prompt`), wenn sie einen Analyse-Skill nennt; sonst undefined.
 *
 * Bis contracts 10 nahm ein Arbeitsschritt dem Kern die Regeln seiner Analyse ab (FM-01..03 der
 * Fehlerbetrachtung).
 * Seit der gekuerzten Zuordnung (CR-SM-395) fuehrt sie der Kern. Wem sie gehoeren, sagt weiter der
 * Katalog — der Skill-Zeiger der Regel —, nicht eine Liste hier: der Schritt nennt dann diesen Skill
 * statt der Autorier-Anleitung der Dimension (fuer FM-01 waere das `se:author-req`).
 */
const ANALYSE_SKILLS: ReadonlySet<string> = new Set(ANALYSE_TASKS.map((t) => TASK_SKILL[t]));
export function analyseSkill(ruleId: string): string | undefined {
  const skill = RULE_HELP[ruleId]?.prompt;
  return skill !== undefined && ANALYSE_SKILLS.has(skill) ? skill : undefined;
}

/**
 * Der Prompt des Handoffs: die Struktur traegt, weiter mit graph_suggest (CR-GC-853).
 *
 * Bis CR-GC-853 nannte er `graph_suggest {target: …}` mit den Gewichten des Zielprofils und das
 * fitAdvisory als Richtungsanzeige. Das Feld `target` gibt es seit CR-GC-483 nicht mehr, die Gewichte
 * nicht seit CR-GC-853. graph_suggest rankt nach dem Steuerwert, dem Abstand zu den Regelschwellen;
 * im Probelauf zeigt `steerAdvisory`, ob ein Zug ihn verringert.
 */
export function handoffPrompt(steerOptimum: SteerOptimum | null, coverageLine: string): string {
  return (
    'Die Struktur trägt: kein offener Fund mehr in der Fokusmenge (Gate-Regeln ohne info, ' +
    'abgenommene Funde ausgenommen). ' +
    steuerVermerk(steerOptimum) +
    'Handoff auf graph_suggest: es rankt die Umbau-Züge nach dem Steuerwert, dem Abstand zu den Regelschwellen. ' +
    coverageLine +
    'Arbeite die Vorschläge ab (Fix-Template-Edits über graph_mutate, Fund-only-Suggestions manuell); ' +
    'steerAdvisory jedes Probelaufs (dryRun:true) zeigt mit improvement, ob ein Zug den Abstand verringert. ' +
    'Die Metrik rankt, das Gate urteilt.'
  );
}

/** CR-GC-608: der Vermerk im done-Prompt, wenn die Steuerregeln am lokalen Optimum stehen. */
export function steuerVermerk(optimum: SteerOptimum | null): string {
  if (!optimum) return '';
  return `Steuerregeln am lokalen Optimum (${optimum.grund === 'kreis' ? 'Kreis' : 'Plateau'} über ` +
    `${STEUER_FENSTER} Steuerzüge): ${optimum.terms.join(', ')} — weiter über graph_suggest oder den Menschen. `;
}
