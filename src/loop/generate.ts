/**
 * generate.ts — der Kaltstart-Generierungstreiber (CR-GC-275,
 * aimpro-Fahrplan-Schritt 6, Regime 1: LLM schlägt vor, Gate scort/wählt).
 *
 * Bisher existierte nur Guidance (graph_authoring_guide: legale Struktur; Skills)
 * und daneben `graph_next_step`, eine generische Aktion pro Deficit-Dimension —
 * ein zweites Steuerungswerkzeug auf derselben Messung, seit CR-GC-560..562 weg.
 * Das hier ist der GENERATIVE Treiber und seither der einzige: aus Prosa-Intention + Graph-Zustand die
 * KONKRETE nächste Generierungs-Instruktion — welche Elemente, für welche
 * Eltern, wie viele Kandidaten, und das Gate-Protokoll (dryRun-Vergleich per
 * Verdict + fitAdvisory, bester Batch echt). Readiness-getrieben bis zur
 * Schwelle, dann Handoff auf die ℝ⁶-Optimierung (graph_suggest, Schritt 3).
 *
 * Deterministischer Kern nach dem se-plan-Muster: DIESE Funktion ist die
 * testbare Zustandsmaschine (seed → expand → handoff); das Vorschlagen selbst
 * bleibt beim MCP-Host — der einzige nicht-deterministische Punkt, exakt der
 * Determinismus-Split des Architekturgenerator-Modells (UMI urteilt, Operator-
 * Wahl bleibt deterministisch).
 */
import { z } from 'zod/v4';
import type { Graph } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS, STAGE_SETS } from '@sigloch/contracts/se';
import type { MetricPolicy } from '@sigloch/contracts/se';
import { takeSteeringSnapshot } from '../kernel/measure/steering-snapshot.js';
import { acceptedRuleIds } from '@sigloch/contracts/se';
import { isIntentTooThin, intentCoverage, type LoadedTargetProfile } from './target-profile.js';
import { winner } from './channel-rank.js';
import { decision } from './decisions.js';
import { ABNEHMBAR, focusViolations as fokusmenge, blockingOf } from '../kernel/measure/focus-set.js';
import { RULE_HELP, TASK_ENTRY, type RuleTask } from '@sigloch/contracts/se';
import { steerTerms, STEER_RULES } from '@sigloch/se-engine';
import { STEUER_FENSTER, type SteerOptimum, type SteerState } from './stagnation.js';
import { ANALYSE_TASKS } from './task-artifact.js';

/**
 * Datenvertrag der Generierungs-Instruktion (SCHEMA-generation-step) — Zod, nicht
 * `interface`: der Step ist das Ergebnis des MCP-Tools `graph_generate` und damit
 * die Grenze zwischen Substrat und Agent.
 */
export const GenerationStep = z.object({
  /** seed = leerer Graph; expand = Deficit-getriebene Verdichtung; handoff = Schwelle erreicht. */
  /** CR-GC-596: stalled = nur noch zurueckgestellte Funde — nicht fertig, Uebergabe an den Menschen. */
  phase: z.enum(['seed', 'expand', 'handoff', 'stalled']),
  /** true genau in phase 'handoff' — die Struktur trägt, weiter mit graph_suggest. */
  done: z.boolean(),
  /** Die konkrete generative Instruktion für den MCP-Host. */
  prompt: z.string(),
  /** Befunde je Stufe — nur die Stufen, in denen etwas meldet (CR-GC-757). */
  readiness: z.array(z.object({ stage: z.string(), findings: z.number() })),
  threshold: z.number(),
  /** Error-Violations (Gate-Blocker) — müssen vor dem Handoff auf 0. */
  blockingErrors: z.number(),
  /** Stabiler Identifikator des fokussierten Fund-Sets (CR-GC-281):
   * `${stufe}:${rule_id}:${element_ids sortiert}`. null wenn kein
   * Fokus (seed/handoff/keine regelbaren Funde). */
  focusKey: z.string().nullable(),
  /** Fokus-Elementtypen des Schritts (CR-GC-285): `STAGE_FOCUS_TYPES` der
   * Fokus-Dimension bzw. der seed-Phase; leer bei handoff/keinem Fokus. Als
   * Feld, damit ein Leser den Prompt-String nicht parsen muss. */
  focusTypes: z.array(z.string()),
  /** Die Fund-Knoten des Schritts (CR-GC-652) — dieselben uids, die im `focusKey` stecken, aber als
   * Feld: wer die uids braucht, soll sie lesen, nicht aus einem zusammengesetzten Schluessel
   * herausschneiden. Nur in der expand-Phase gesetzt; seed/handoff haben keinen Fund. */
  focusElements: z.array(z.string()).optional(),
  /** Fokus-Dimension des Schritts (CR-GC-558): Schluessel in `STAGE_FOCUS_TYPES`
   * (`seed` | `uc` | `req` | `arch` | ...), null bei handoff. Steckt zwar auch im
   * `focusKey`-Praefix, aber der ist ein zusammengesetzter Identifikator — wer die
   * Dimension braucht, soll sie lesen, nicht aus einem Key herausschneiden. */
  focusStage: z.string().nullable(),
  /** CR-GC-589: die Anleitung zur Fokus-Dimension als VERWEIS (`se:author-req`) — der Host laedt
   * den Skill ueber sein Skill-Werkzeug. null, wenn es fuer die Dimension keinen Autorier-Skill gibt. */
  skill: z.string().nullable(),
  /** CR-GC-608: der Steuerzustand (Termvektor, Summe der Ueberschuesse) — das Fertig-Kriterium der
   * Steuerregeln liest ihn im Sitzungsgedaechtnis. */
  steer: z.object({ key: z.string(), sum: z.number(), terms: z.array(z.string()) }).optional(),
  /** CR-GC-728: nur in phase 'stalled' — die Analyse-Tasks, deren Eintrittspunkt offen ist. Als Feld,
   * damit ein Leser sie nennen kann, ohne den Prompt-Text zu zerlegen. Leer = der Kern selbst sitzt fest. */
  offeneTasks: z.array(z.string()).optional(),
  /** CR-GC-728: nur in phase 'stalled' — die zurückgestellten Fund-Fenster (focusKeys). */
  offeneFunde: z.array(z.string()).optional(),
});
export type GenerationStep = z.infer<typeof GenerationStep>;

/**
 * Welche Autorier-Anleitung zu welcher Fokus-Dimension gehoert (CR-GC-558; seit CR-GC-589 HIER,
 * der Host liest sie als Verweis im Schritt). Vorher stand sie nur im Executor — Claude Code las `se:generate` einmal bei 2–5 % des
 * Laufs und die Anlege-Skills erst am Ende, um Frischestempel zu erfuellen.
 *
 * `se-view:*` bleibt draussen: Darstellungen, keine Bauanleitungen. `ver`/`schema`/`cr`/`ms`
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
const GATE_PROTOCOL =
  PROTOCOL_GUIDE +
  // CR-GC-587: Probe-Regel und Rangfolge kommen aus dem Register, nicht aus Prosa hier.
  // (CR-GC-583 hatte hier den Steuerwert VOR dem tier genannt — `rankCandidates` sortierte
  // tier vor Steuerwert. Genau die Klasse Fehler, gegen die das Register steht.)
  '(2) ' + decision('probe') + ' ' + decision('verdictRank') + ' ' +
  '(3) Nur den besten Batch OHNE dryRun anwenden; block-Verdicts verwerfen oder revidieren, nie erzwingen. ' +
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
  'Zerlege je Fund die FCHAIN/FUNC-Ebene: 7±2 FUNCs pro Zerlegungsebene (RD-04), FLOWs zwischen FUNCs (io). Schlage je Fund 2 alternative FUNC/FCHAIN-Zerlegungen vor — jede neue FUNC zusammen mit satisfy→REQ und allocate→MOD im selben Batch (fehlt die REQ oder das MOD im Graphen, zuerst anlegen). Lass das Gate wählen.';
const VORLAGE_ALLOC =
  'Schlage MOD-Schnitte vor (intern stark, extern schwach gekoppelt) und allocate-Kanten FUNC→MOD; 2 Alternativen, der Steuerwert entscheidet.';
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
 * Die Stufen des Kaltstarts (CR-GC-559).
 *
 * Vorher war der Seed EIN Batch aus SYS + ACTORs + UCs — die einzige Runde ohne
 * Regelung, weil ein leerer Graph nichts zu messen gibt. Gemessen im Rig-Lauf: das
 * Modell haengte ACTOR direkt an FCHAIN, viermal, alle vom Gate wegen R-18 abgewiesen.
 * Die Systemgrenze ist die Stelle, an der der Kaltstart scheitert, und drei
 * Entscheidungen in einem Batch lassen sich nicht einzeln anleiten.
 *
 * Kein Zaehler und kein Zustand: die Stufe folgt aus dem Graphen (kein SYS / kein UC /
 * kein ACTOR), `generationStep` bleibt rein. `seed` steht bewusst NICHT mehr in
 * STAGE_FOCUS_TYPES — dort gehoeren Readiness-Dimensionen hin, und der Seed ist keine.
 */
// Die Fokusmenge lebt in kernel/measure/focus-set.ts (CR-GC-598/600) — eine Definition fuer
// Schritt, Probe und Bericht, abgeleitet aus der Eigentuemer-Spalte der Regeln.
const windowRuleOf = (vs: readonly { rule_id: string }[]): string | undefined => vs[0]?.rule_id;

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
const TASK_OF_ENTRY = new Map(
  (Object.entries(TASK_ENTRY) as [Exclude<RuleTask, 'kern'>, string | null][]).filter(([, e]) => e).map(([t, e]) => [e as string, t]),
);

/**
 * Der Skill der Analyse, zu der eine Regel gehoert (CR-GC-748) — gelesen aus der Regelhilfe
 * (contracts `RULE_HELP[…].prompt`), wenn sie einen Analyse-Skill nennt; sonst undefined.
 *
 * Bis contracts 10 nahm ein Arbeitsschritt dem Kern die Regeln seiner Analyse ab (FM-01..03 der
 * Fehlerbetrachtung, CL-01 dem Einsatzkonzept).
 * Seit der gekuerzten Zuordnung (CR-SM-395) fuehrt sie der Kern. Wem sie gehoeren, sagt weiter der
 * Katalog — der Skill-Zeiger der Regel —, nicht eine Liste hier: der Schritt nennt dann diesen Skill
 * statt der Autorier-Anleitung der Dimension (fuer FM-01 waere das `se:author-req`).
 */
const ANALYSE_SKILLS: ReadonlySet<string> = new Set(ANALYSE_TASKS.map((t) => TASK_SKILL[t]));
export function analyseSkill(ruleId: string): string | undefined {
  const skill = RULE_HELP[ruleId]?.prompt;
  return skill !== undefined && ANALYSE_SKILLS.has(skill) ? skill : undefined;
}

export const SEED_STAGES = {
  sys: ['SYS'],
  uc: ['SYS', 'UC'],
  actor: ['ACTOR', 'UC'],
} as const;

/**
 * Welche Existenz-Regel welche Kaltstart-Stufe AUSLOEST (CR-GC-749).
 *
 * Bis hierher folgte die Stufe aus drei eigenen Zustandstests am Graphen (kein SYS / kein UC / kein
 * ACTOR). Seit contracts 11 (CR-SM-395) verlangt je eine Existenz-Regel die Menge: R-33 das System,
 * R-17 was das System unter sich hat, UC-02 den Akteur je Anwendungsfall. Der Ausloeser ist jetzt ihr
 * Befund; die Texte der Stufen (gemessen entstanden: CR-GC-559, ITEM-2026-625) sind unveraendert und
 * stehen als Kaltstart-Fassung dieser Regeln in `stepCore`.
 *
 * Was eine Regel nicht meldet, loest keine Stufe aus. Aendert der Katalog die Regel, folgt der Schritt
 * ohne Aenderung hier — so mit CR-SM-396: R-17 verlangt seither einen Anwendungsfall, nicht irgendeine
 * Unterstruktur.
 */
export const SEED_RULE = { sys: 'R-33', uc: 'R-17', actor: 'UC-02' } as const;

const REGEL = new Map(ALL_RULE_DEFS.map((r) => [r.id, r]));
/**
 * Der Rang einer Regel in der Reihenfolge der Stufen (CR-GC-749) — aus `ALL_RULE_DEFS[].stage`.
 * `immer` (Regeln ueber alle Elemente) gilt an jeder Stufe, also schon vor der ersten. Eine Regel,
 * die der Katalog nicht kennt, hat keine Stufe und steht hinten.
 */
export function stufenRang(ruleId: string): number {
  const stage = REGEL.get(ruleId)?.stage;
  return stage === undefined ? STAGE_SETS.length + 1 : stage === 'immer' ? 0 : stage;
}
/** Die Stufe einer Regel beim Namen ihrer Menge — fuer den Prompt. */
function stufenName(ruleId: string): string {
  const stage = REGEL.get(ruleId)?.stage;
  return stage === undefined || stage === 'immer' ? 'jede (gilt für alle Elemente)' : STAGE_SETS[stage - 1]!;
}

/**
 * Der nächste Generierungsschritt für (Graph, Intention). Deterministisch —
 * gleicher Graph + gleiche Intention + gleiches defer ⇒ gleicher Schritt.
 *
 * `defer` (CR-GC-281): zurückgestellte focusKeys — Fund-Sets, an denen sich
 * der Host festgefahren hat. Die Fokus-Wahl überspringt sie deterministisch
 * (das nächste Fenster in der Reihenfolge der Stufen, CR-GC-749); sind ALLE
 * Kandidaten zurückgestellt, endet die Maschine `stalled` (CR-GC-596).
 *
 * Ein 'local'-Minimal-Rendering (CR-GC-282) wurde gemessen und VERWORFEN:
 * v13b lieferte 22 Elemente vs. 82 mit diesem vollen Rendering — die
 * Multi-Kandidaten-Instruktion erzeugt die großen verbundenen Batches, und
 * Ein-Fund-Batches kollidieren mit Batch-Invarianten (REQ braucht TEST im
 * selben Batch). Ein Profil-Parameter existiert deshalb bewusst NICHT.
 */
export function generationStep(
  graph: Graph,
  policy: MetricPolicy,
  intent: string | undefined,
  threshold: number,
  defer: string[] = [],
  profile: LoadedTargetProfile | null = null,
  task: RuleTask = 'kern',
  steerOptimum: SteerOptimum | null = null,
): GenerationStep {
  const snap = takeSteeringSnapshot(graph, policy);
  const { imperativSkill, ...core } = stepCore(snap, policy, intent, threshold, defer, profile, task, steerOptimum);
  // CR-GC-601: im Task nennt der Schritt den Skill des Tasks, im Kern den der Fokus-Dimension.
  // CR-GC-604: steht im Kern ein Eintrittspunkt im Fokus, ist der Skill der des Tasks — nicht der
  // der Dimension (AF-04/AF-05 liegen in ver/ms, fuer die es keinen Autorier-Skill gibt: `next.skill` war null).
  const fensterRegel = core.focusKey?.split(':')[1] ?? '';
  const eintrittsTask = task === 'kern' && core.focusKey ? TASK_OF_ENTRY.get(fensterRegel) : undefined;
  // CR-GC-748: eine Regel, die zu einer Analyse gehoert und keine Klausel traegt, nennt deren Skill.
  const skillDerAnalyse = core.focusKey && !(fensterRegel in RULE_CLAUSE) ? analyseSkill(fensterRegel) : undefined;
  const skill =
    task !== 'kern'
      ? TASK_SKILL[task]
      : eintrittsTask
        ? TASK_SKILL[eintrittsTask]
        : skillDerAnalyse !== undefined
          ? skillDerAnalyse
        : // CR-GC-655: im expand entscheidet der Imperativ (Klausel vor Dimension); seed/handoff
          // haben keinen, dort gilt die Dimension (seed:uc → author-uc usw.).
          imperativSkill !== undefined
          ? imperativSkill
          : core.focusStage
            ? (SKILL_FOR_STAGE[core.focusStage]?.name ?? null)
            : null;
  return { ...core, skill, steer: steerState(snap.violations) };
}

/** CR-GC-608: der Vermerk im done-Prompt, wenn die Steuerregeln am lokalen Optimum stehen. */
export function steuerVermerk(optimum: SteerOptimum | null): string {
  if (!optimum) return '';
  return `Steuerregeln am lokalen Optimum (${optimum.grund === 'kreis' ? 'Kreis' : 'Plateau'} über ` +
    `${STEUER_FENSTER} Steuerzüge): ${optimum.terms.join(', ')} — weiter über graph_suggest oder den Menschen. `;
}

/** CR-GC-608: der kanonische Steuerzustand aus se-engines `steerTerms` — kein eigener Messpfad. */
function steerState(violations: Parameters<typeof steerTerms>[0]): SteerState {
  const terms = steerTerms(violations)
    .filter((t) => t.overshoot > 0)
    .map((t) => `${t.ruleId}@${t.elementId} (${t.overshoot.toFixed(2)})`)
    .sort();
  const sum = steerTerms(violations).reduce((a, t) => a + Math.max(0, t.overshoot), 0);
  return { key: terms.join('|'), sum, terms };
}

function stepCore(
  snap: ReturnType<typeof takeSteeringSnapshot>,
  policy: MetricPolicy,
  intent: string | undefined,
  // CR-GC-336: kein `= 0.8` mehr. Dieselbe Frage („ist diese Dimension zu schwach?")
  // hatte drei Antworten — hier, im Tool-Schema und in se-steering. Jetzt eine: die Config.
  threshold: number,
  defer: string[] = [],
  profile: LoadedTargetProfile | null = null,
  task: RuleTask = 'kern',
  steerOptimum: SteerOptimum | null = null,
): Omit<GenerationStep, 'skill' | 'steer'> & { imperativSkill?: string | null } {
  // Steering-Snapshot (CR-GC-289): og + ND-Injektion + Full-Katalog-Eval + Befunde je Stufe —
  // geteilt mit dem steeringDelta des dryRun-Verdicts.
  const { og, stages } = snap;
  // CR-GC-601: im Kern die Kern-Fokusmenge des Snapshots, im Task das detaillierte Regelset (Warnung).
  // CR-GC-608: am lokalen Optimum verlassen die Steuerregeln den Kern-Fokus.
  const violations = task === 'kern'
    ? steerOptimum ? snap.focus.filter((v) => !(STEER_RULES as readonly string[]).includes(v.rule_id)) : snap.focus
    : fokusmenge(og, snap.violations, task);
  const blockingErrors = task === 'kern' ? snap.blockingErrors : blockingOf(violations);
  const taskVorsatz = task === 'kern' ? '' : `Task ${task} (Skill ${TASK_SKILL[task]}): `;
  // CR-GC-593/598: `violations` IST die Fokusmenge (focus-set.ts); fuer Hinweise am Element:
  const elementById = new Map(og.elements.map((e) => [e.id, e]));
  const sysEl = og.elements.find((e) => e.type === 'SYS');
  const sys = og.elements.find((e) => e.type === 'SYS');
  const effectiveIntent = intent?.trim() || sys?.description?.trim() || '';
  // CR-GC-757: Befunde je Stufe (contracts `stage` an der Regel) — keine Prozentzahl, kein Nenner.
  const readiness = stages.filter((s) => s.findings > 0).map((s) => ({ stage: s.name, findings: s.findings }));

  // --- Phase seed: noch kein System im Graphen -----------------------------
  // CR-GC-749: der Ausloeser ist der Befund der Existenz-Regel des Systems (R-33), nicht mehr ein
  // eigener Blick in den Graphen. Er gilt in jedem Arbeitsschritt — ohne System gibt es keine Analyse —,
  // deshalb aus dem Kern-Fokus des Snapshots gelesen, nicht aus dem des Tasks.
  if (snap.focus.some((v) => v.rule_id === SEED_RULE.sys)) {
    if (!effectiveIntent) {
      // Runde-1-Frage (CR-GC-295): das Zielprofil beim Menschen erfragen, nicht
      // das Modell beim Handoff raten lassen. Optional, nie blockierend — ein
      // fehlendes Profil ist gültig (Gleichgewichtung, CR-289-Verhalten).
      const profileAsk = profile
        ? ''
        : ' Frage optional auch das ℝ⁶-Zielprofil ab (Gewicht je Metrik-Dimension in [-1,1], Default ' +
          'unentschieden = alle 0) und persistiere es über den Skill se:target-profile nach ' +
          '.graphcode/target-profile.json — ohne Profil bleibt die spätere Optimierung ungerichtet (gültig).';
      return {
        phase: 'seed',
        done: false,
        prompt:
          'Es gibt noch kein SYS-Element und keine Intention. Erfrage die Systemintention als 1 Absatz ' +
          'Prosa (was soll das System für wen leisten?) und rufe graph_generate erneut mit {intent} auf.' +
          profileAsk,
        readiness,
        threshold,
        blockingErrors,
        focusKey: null,
        focusTypes: [],
        focusStage: null,
      };
    }
    // Steuerung im Hintergrund (CR-GC-307): erst HIER existiert eine Intention.
    // Die Kernthemen werden STILL abgeleitet und persistiert — der Mensch bekommt
    // sie nie zu sehen. Das Konzept dahinter ist unser Hilfsmittel, um die
    // App-Targets einzustellen; für den Kunden ist es kein Begriff, mit dem er etwas
    // anfangen kann (belegt: ein Frontier-Modell hat die vorgeschlagenen Themen
    // später ohnehin still korrigiert — die Rückfrage gewann weder Information noch
    // Kontrolle). Trägt die Intention zu wenig dafür, wird FACHLICH nachgefragt.
    const steeringNote = (() => {
      if (profile?.profile.intentAnchors?.length) return '';
      if (isIntentTooThin(effectiveIntent)) {
        return (
          'Die Intention ist noch zu unbestimmt, um daraus zu arbeiten. Stelle dem Menschen ' +
          '2–3 GEZIELTE FACHFRAGEN zum System — in seiner Sprache, über sein Geschäft ' +
          '(z.B. "Was passiert, wenn ein Kunde eine Bestellung storniert?", "Wer darf Preise ' +
          'ändern?"). Frage NICHT nach Steuerungs-Einstellungen, Gewichten, Schlagworten oder ' +
          'internen Begriffen — die Antworten liefern das Nötige von selbst. Baue den Seed-Batch ' +
          'erst nach den Antworten. '
        );
      }
      // Das Persistieren macht die Tool-Schicht (`graph_generate`), nicht diese
      // Funktion: `generationStep` ist rein und deterministisch (N=1-AC aus
      // CR-GC-295) — ein Datei-Write hier wäre ein verstecktes Seiteneffekt-Loch.
      return '';
    })();
    // Stufe 1 (CR-GC-559): nur die Wurzel. Was das System IST, ist eine eigene
    // Entscheidung — sie mit Use Cases und Actors in einen Batch zu legen, hiess
    // drei Kriterien in einer Anleitung.
    return {
      phase: 'seed',
      done: false,
      prompt:
        `Kaltstart aus der Intention: "${effectiveIntent}" — ` +
        'Lege GENAU EIN Element an: die SYS-Wurzel, description = die Intention wörtlich. ' +
        'Noch keine ACTORs, keine UCs, keine Struktur — die folgen als eigene Schritte. ' +
        steeringNote +
        GATE_PROTOCOL,
      readiness,
      threshold,
      blockingErrors,
      focusKey: null,
      focusTypes: [...SEED_STAGES.sys],
      focusStage: 'seed:sys',
    };
  }

  // Intent-Coverage-Zeile (CR-GC-295): unadressierte Anker steuern JEDE Runde,
  // nicht nur Runde 1 — KPI/Read-out, nie ein Gate-Blocker oder Handoff-Veto.
  const anchors = profile?.profile.intentAnchors ?? [];
  const unaddressed =
    anchors.length > 0
      ? intentCoverage(anchors, og.elements)
          .filter((c) => !c.addressed)
          .map((c) => c.anchor)
      : [];
  // CR-GC-307: Klartext statt Steuerungs-Vokabular. Der Mensch sieht die WIRKUNG
  // (ein Thema kommt nirgends vor), nie den Mechanismus dahinter.
  const coverageLine =
    unaddressed.length > 0
      ? `Noch nirgends beschrieben: ${unaddressed.join(', ')}. Fehlt dazu ein Use Case oder Requirement? `
      : '';

  // --- Phase expand: das frueheste Fenster in der Reihenfolge der Stufen ----
  // CR-GC-749: die REGEL wird nach ihrer Stufe gewaehlt (contracts `ALL_RULE_DEFS[].stage`), frueheste
  // zuerst; in einer Stufe steht die Existenz-Regel vorn — sie verlangt die Menge, ueber die die
  // uebrigen Regeln der Stufe urteilen. Darunter gilt die bisherige Ordnung unveraendert: schwaechste
  // Dimension, Schwere, Klausel, Regel-ID. Vorher stand die Dimension an erster Stelle; der Schritt
  // sprang damit zwischen den Stufen (gemessen am Referenzlauf lokal: 3, 2, 7, 7, 6, 8, 10).
  // Fund-Rotation (CR-GC-281): Kandidaten = 3er-Fenster je Regel. Fenster, deren focusKey in `defer`
  // liegt, werden uebersprungen. Alles zurueckgestellt ⇒ stalled (CR-GC-596).
  // Rang der Severity (CR-GC-563): error vor warning vor allem anderen. Unbekanntes
  // rankt hinten statt NaN zu erzeugen.
  const severityRang = (v: (typeof violations)[number]): number =>
    v.severity === 'error' ? 0 : v.severity === 'warning' ? 1 : 2;
  // CR-GC-563: Severity ZUERST. Vorher stand hier nur `rule_id.localeCompare` — eine
  // lexikografische Ordnung, die CR-GC-290 fuer den DETERMINISMUS eingefuehrt hat und die
  // seither als PRIORITAET gelesen wurde. Gemessen in Rig-Lauf 4: FC-02 (warning) kam vor
  // UC-02 (error), weil F vor U steht; zwoelf Runden in derselben Dimension, kein einziges
  // FUNC im ganzen Lauf. Das System glaubt die Prioritaet ohnehin an anderer Stelle —
  // `blockingErrors` muss fuer den Handoff auf 0, Warnungen duerfen stehenbleiben.
  // Determinismus bleibt: die Ordnung ist weiterhin total und haengt nur vom Graphen ab.
  // CR-GC-605: seit `error` die Gate-Wirkung IST (CR-SM-353), sind UC-01/UC-02 Warnungen — die
  // Reihenfolge aus CR-GC-563 haette damit wieder FC-02 vorn (Rig-Lauf 4). Die Schwere trug die
  // Ordnung nur nebenbei; was sie wirklich stellt, ist die ANWEISUNG: eine Regel mit Klausel
  // (RULE_CLAUSE — UC-01, UC-02, R-15) baut Struktur, die andere Funde erst erreichbar macht,
  // und kommt innerhalb einer Schwere vor einer Regel, die nur einen Fund meldet.
  const klauselRang = (ruleId: string): number => (ruleId in RULE_CLAUSE ? 0 : 1);
  // Fund-Fenster (CR-GC-290): 3er-Fenster je rule_id-Gruppe, nie regelübergreifend
  // gemischt — sonst verschränken sich z.B. FCHAIN-Erzeugung (R-15) und
  // UC-Population (UC-01) über Runden hinweg statt sich sauber abzuschließen.
  const fundeVon = (ruleId: string): typeof violations =>
    violations.filter((v) => v.rule_id === ruleId).sort((a, b) => a.element_id.localeCompare(b.element_id));
  // rule_id im Key (CR-GC-290): ein Fenster traegt genau eine Regel,
  // also identifiziert (stufe, rule_id, element_ids) das Fund-Set eindeutig —
  // ohne rule_id würden zwei Fenster über dieselben Elemente, aber verschiedene
  // Regeln, auf denselben Key kollabieren.
  const keyOf = (stufe: string, vs: typeof violations): string =>
    `${stufe}:${vs[0]?.rule_id ?? ''}:${vs.map((v) => v.element_id).sort().join(',')}`;

  const deferSet = new Set(defer);
  // CR-GC-603: in einem Task steht der Eintritt (das fehlende Artefakt) VOR den Regeln des Tasks —
  // ausdruecklich, nicht ueber Stufe oder Dimension: wo die Regeln eines Tasks liegen, ist Sache des
  // Katalogs und wandert mit ihm.
  const eintritt = task !== 'kern' ? TASK_ENTRY[task] : null;
  const existenzRang = (ruleId: string): number => (REGEL.get(ruleId)?.role === 'existence' ? 0 : 1);
  const schwereVon = (ruleId: string): number => Math.min(...violations.filter((v) => v.rule_id === ruleId).map(severityRang));
  // Die Abgleich-Regeln (Profil `conformance`) stellen kein Fenster (CR-GC-757, vorher: „Regeln ohne
  // Dimension", dieselbe Menge) — ihren Befund loest kein Modellzug.
  const stufeVon = (ruleId: string): string => {
    const stage = REGEL.get(ruleId)?.stage;
    return stage === undefined ? '' : stage === 'immer' ? 'immer' : STAGE_SETS[stage - 1]!;
  };
  const regeln = [...new Set(violations.map((v) => v.rule_id))]
    .filter((id) => REGEL.get(id) !== undefined && REGEL.get(id)!.profile !== 'conformance')
    .sort(
      (a, b) =>
        Number(b === eintritt) - Number(a === eintritt) ||
        stufenRang(a) - stufenRang(b) ||
        existenzRang(a) - existenzRang(b) ||
        schwereVon(a) - schwereVon(b) ||
        klauselRang(a) - klauselRang(b) ||
        a.localeCompare(b),
    );
  const kandidaten = regeln.flatMap((ruleId) => {
    const funde = fundeVon(ruleId);
    const stufe = stufeVon(ruleId);
    const fenster: { stufe: string; funde: typeof violations; key: string }[] = [];
    for (let i = 0; i < funde.length; i += 3) {
      const teil = funde.slice(i, i + 3);
      fenster.push({ stufe, funde: teil, key: keyOf(stufe, teil) });
    }
    return fenster;
  });
  const gewaehlt = kandidaten.find((k) => !deferSet.has(k.key));
  const focus = gewaehlt?.stufe;
  const focusViolations: typeof violations = gewaehlt?.funde ?? [];
  const focusKey: string | null = gewaehlt?.key ?? null;

  // --- Kaltstart-Stufen 2 und 3 (CR-GC-559, Ausloeser seit CR-GC-749 aus der Regel) ------------
  // Stellt die Existenz-Regel des Systems (R-17) bzw. des Akteurs (UC-02) das Fenster und hat die
  // Struktur noch nicht begonnen, bekommt der Agent die Kaltstart-Fassung: die Stufe in EINEM
  // eigenen Schritt, mit den gemessenen Texten. Mit begonnener Struktur (FUNC oder MOD — ein
  // importierter oder reifer Graph) stellt dieselbe Regel ihr gewoehnliches Fenster: dort ist es
  // Rueckwaerts-Spezifikation, kein Kaltstart, und der Regler misst.
  const strukturBegonnen = og.elements.some((e) => e.type === 'FUNC' || e.type === 'MOD');
  if (task === 'kern' && !strukturBegonnen && gewaehlt) {
    const seedRumpf = (prompt: string, stufe: keyof typeof SEED_STAGES): Omit<GenerationStep, 'skill'> => ({
      phase: 'seed',
      done: false,
      prompt: prompt + GATE_PROTOCOL,
      readiness,
      threshold,
      blockingErrors,
      focusKey: null,
      focusTypes: [...SEED_STAGES[stufe]],
      focusStage: `seed:${stufe}`,
    });
    const regel = windowRuleOf(gewaehlt.funde);
    if (regel === SEED_RULE.uc) {
      return seedRumpf(
        `Intention: "${effectiveIntent}". Die SYS-Wurzel steht. Destilliere daraus 3–7 UCs ` +
          '(je Actor–Verb–Objekt–Ergebnis, ≤25 Wörter) und hänge jeden mit SYS compose UC an die Wurzel. ' +
          'Nur UCs — ACTORs und Struktur folgen als eigene Schritte. ',
        'uc',
      );
    }
    // Die Akteur-Stufe ist die Fassung von UC-02 fuer einen Bestand OHNE Akteur: erst die blossen
    // Knoten, die Anbindung folgt mit der Struktur. Gibt es Akteure, gilt die Klausel der Regel
    // (`RULE_CLAUSE['UC-02']`) — sie liest den Bestand auf dieselbe Weise.
    if (regel === SEED_RULE.actor && !og.elements.some((e) => e.type === 'ACTOR')) {
      return seedRumpf(
        `Intention: "${effectiveIntent}". SYS und die Use Cases stehen. Bestimme jetzt das MINIMUM ` +
          'distinkter ACTORs, das die Systemgrenze eindeutig macht: je UC einen Auslöser und einen ' +
          'Empfänger des Ergebnisses, dann zusammenfassen, was gleich über die Grenze geht. ' +
          'Emittiere die ACTORs als BLOSSE Knoten ohne Kanten — die einzige legale Anbindung ist ' +
          'ACTOR io→FLOW io→FUNC, und FLOWs/FUNCs gibt es noch nicht. R-16 (Actor ohne io) ist danach ' +
          'der richtige Zustand und schliesst sich mit der Struktur von selbst. ',
        'actor',
      );
    }
  }
  if (!focus && kandidaten.length > 0) {
    // CR-GC-596: alle offenen Funde sind zurueckgestellt. Frueher: "Zurueckstellung ignorieren,
    // wiederholen" — genau dort entstand die Schleife (Lauf 11: R-04 sechsmal). `done` waere
    // derselbe Ausweg, den die Abnahme-Politik verschliesst. Also ein eigener Endzustand.
    const offen = kandidaten.map((k) => k.key);
    const liste = `(${offen.length}): ${offen.join('; ')}. `;
    // CR-GC-604: wohin es weitergeht, haengt davon ab, WO die Maschine festsitzt. Im Task: zurueck in den
    // Kern (Task-Regeln sind Warnungen, opus5-14: CR-R03 im Plan). Im Kern mit offenem Eintrittspunkt
    // (nur nach ausdruecklichem defer moeglich): den Task starten. Erst sonst der Mensch.
    const offeneTasks = [...new Set(offen.map((k) => TASK_OF_ENTRY.get(k.split(':')[1] ?? '')).filter((t) => t !== undefined))];
    const weiter =
      task !== 'kern'
        ? `Task ${task} festgefahren. Nenne diese Funde mit Grund im Artefakt, dann zurück in den Kern: graph_generate ohne task.`
        : offeneTasks.length > 0
          ? `Offen sind Eintrittspunkte: starte ${offeneTasks.map((t) => `graph_generate {task:'${t}'} (Skill ${TASK_SKILL[t]})`).join(', ')} — ` +
            'oder nimm den Eintritt als acceptedFindings mit Grund ab.'
          : 'Nicht weiter mutieren. Übergib an den Menschen: nenne diese Funde, was du je Fund versucht hast und warum ' +
            'es nicht griff, in der Schlussmeldung; exportiere den Stand (graph_export).';
    return {
      phase: 'stalled',
      done: false,
      prompt: `Festgefahren: jeder offene Fund stand nach zwei Zügen noch und ist zurückgestellt ${liste}${weiter}`,
      readiness,
      threshold,
      blockingErrors,
      focusKey: null,
      focusTypes: [],
      focusStage: null,
      offeneTasks,
      offeneFunde: offen,
    };
  }

  // --- Freigabe (CR-GC-593): done ⇔ kein Fokus ----------------------------
  // Kein Waechter aus einer anderen Quelle als der Fokuswahl. Die Schwelle steht weiter im
  // Bericht (readiness), sie entscheidet nur nicht mehr — gemessen hatte sie in fuenf Laeufen nie
  // einen Schritt gewaehlt, aber in allen die Freigabe gesperrt. Die Marken stehen in graph_readiness.
  if (!focus && task !== 'kern') {
    // CR-GC-601/603: der Task ist durch — sein Eintritt schweigt (die Analyse ist gestempelt, beim
    // Bauplan: es gibt einen offenen Auftrag) oder ist abgenommen, und seine Regeln haben keinen
    // offenen Fund; der Eintritt steht in der Task-Fokusmenge. Dann zurueck in den Kern.
    return {
      phase: 'handoff',
      done: true,
      prompt:
        `Task ${task} fertig: sein Eintrittspunkt ist geschlossen (oder abgenommen), seine Regeln haben keinen offenen Fund. ` +
        'Zurück in den Kern: graph_generate ohne task.',
      readiness,
      threshold,
      blockingErrors,
      focusKey: null,
      focusTypes: [],
      focusStage: null,
    };
  }
  if (!focus) {
    // CR-GC-295: das Zielprofil kommt aus der Config (Mensch entscheidet in
    // Runde 1), nicht mehr als Erfindungs-Auftrag ans Modell.
    const weights = profile?.profile.weights ?? {};
    const hasWeights = Object.values(weights).some((w) => typeof w === 'number' && w !== 0);
    const targetInstruction = hasWeights
      ? `Zielprofil aus .graphcode/target-profile.json: rufe graph_suggest {target: ${JSON.stringify(weights)}} auf. ` +
        (profile && profile.conflicts.length > 0 ? profile.conflicts.join(' ') + ' ' : '')
      : 'Kein Zielprofil konfiguriert — erhebe es beim Menschen über den Skill se:target-profile ' +
        '(.graphcode/target-profile.json) und rufe dann graph_suggest {target} auf. ';
    return {
      phase: 'handoff',
      done: true,
      prompt:
        'Die Struktur trägt: kein offener Fund mehr in der Fokusmenge (Gate-Regeln ohne info, ' +
        'abgenommene Funde ausgenommen). ' +
        steuerVermerk(steerOptimum) +
        'Handoff auf die ℝ⁶-Optimierung: ' +
        targetInstruction +
        coverageLine +
        'Arbeite die Funde ab (Fix-Template-Edits über graph_mutate, Fund-only-Suggestions manuell); ' +
        'das fitAdvisory jedes Probelaufs (dryRun:true) zeigt, ob Δm in Zielrichtung läuft. Die Metrik rankt, das Gate urteilt.',
      readiness,
      threshold,
      blockingErrors,
      focusKey: null,
      focusTypes: [],
      focusStage: null,
    };
  }


  // fix_hint mitrendern (sonst bleibt z.B. R-15s "Add FUNC elements via compose
  // trace" für das Modell unsichtbar — es sieht nur die Symptom-Message).
  // CR-GC-594: steht an einem Element des Fensters eine Abnahme dieser (nicht abnehmbaren) Regel,
  // sagt der Prompt, warum der Fund trotzdem hier steht — sonst dreht der Agent eine Schleife.
  const ignorierteAbnahme =
    windowRuleOf(focusViolations) !== undefined &&
    !ABNEHMBAR.has(windowRuleOf(focusViolations)!) &&
    focusViolations.some((v) => acceptedRuleIds(elementById.get(v.element_id) ?? sysEl ?? {}).has(v.rule_id));
  const fensterRegel = windowRuleOf(focusViolations);
  const abnahmeHinweis = ignorierteAbnahme
    ? `Die Abnahme von ${fensterRegel} zählt nicht — Architekturregeln sind nicht abnehmbar; löse den Fund im Modell. `
    : fensterRegel !== undefined && task !== 'kern' && fensterRegel === TASK_ENTRY[task]
      ? // CR-GC-603: das Artefakt fehlt noch — der Task ist nicht durch, nur weil sein Regelset nichts findet.
        // CR-GC-721: der Satz nannte den Stempel als einzige greifbare Handlung ("setze am Ende seinen
        // Frischestempel am SYS (analysisFreshness)") — local-1 setzte ihn und sonst nichts. Jetzt nennt er
        // die Arbeit; den Stempel schreibt der letzte Schritt des Skills, der Fund-Hinweis den ersten.
        `Das Artefakt des Tasks ${task} fehlt noch. Lade den Skill ${TASK_SKILL[task]} und arbeite seine Schritte ` +
        'der Reihe nach ab, jeden Fund als Zug über graph_mutate; sein letzter Schritt schließt den Task ab. '
    : fensterRegel !== undefined && task === 'kern' && TASK_OF_ENTRY.has(fensterRegel)
      ? // CR-GC-601: ein Eintrittspunkt — der Task ist eine Blackbox, der Kern loest ihn nicht selbst.
        `${fensterRegel} ist der Eintrittspunkt des Tasks ${TASK_OF_ENTRY.get(fensterRegel)}: starte ihn mit ` +
        `graph_generate {task:'${TASK_OF_ENTRY.get(fensterRegel)}'} (Skill ${TASK_SKILL[TASK_OF_ENTRY.get(fensterRegel)!]}) — ` +
        'oder nimm ihn als acceptedFindings mit Grund ab, wenn das Artefakt im schlanken Umfang nicht nötig ist. '
      : // CR-GC-748: eine Regel einer Analyse im Kern — der Skill der Analyse beschreibt die Arbeit.
        (fensterRegel !== undefined && task === 'kern' && !(fensterRegel in RULE_CLAUSE) && analyseSkill(fensterRegel) !== undefined
          ? `${fensterRegel} gehört zu einer Analyse: lade den Skill ${analyseSkill(fensterRegel)} und behebe den Fund nach seinen Schritten. `
          : '') +
        (fensterRegel !== undefined && ABNEHMBAR.has(fensterRegel)
          ? `${fensterRegel} ist abnehmbar: ist der Fund im Modell nicht erfüllbar, lege ihn als acceptedFindings [{ruleId, reason}] mit Grund ab. `
          : '');
  const funde = focusViolations
    .map((v) => `${v.element_id} (${v.rule_id}: ${v.message}${v.fix_hint ? ` — Fix: ${v.fix_hint}` : ''})`)
    .join('; ');
  // Regel-Klausel nur für die Regel, die dieses Fenster stellt (windowsOf gruppiert
  // je rule_id) — und mit den konkreten uids, statt als globales Verbot.
  const windowRule = focusViolations[0]?.rule_id;
  const klausel = windowRule ? RULE_CLAUSE[windowRule] : undefined;
  // EIN Imperativ je Runde (CR-GC-564). Vorher wurde die Klausel an das Dimensions-Template
  // ANGEHÄNGT — und R-15s Klausel endete mit „KEINE neue FCHAIN anlegen", also mit dem
  // Widerruf dessen, was drei Zeilen vorher stand. Das Template ist nach DIMENSION
  // geschlüsselt, das Fenster seit CR-GC-290 nach REGEL; wo beide dieselbe Arbeit
  // verschieden beschreiben, gewinnt die regelgenaue Fassung.
  //
  // CR-GC-575: diese Vorrangfrage wird nicht mehr HIER entschieden, sondern in
  // `channel-rank.ts` — einmal, erklärt, und für Text UND Fokus-Typen in DEMSELBEN
  // Aufruf. Vorher standen dafür zwei Ternäre 40 Zeilen auseinander (CR-GC-564 für
  // den Text, CR-GC-566 für die Typen), deren Gleichlauf nur ein Kommentar zusagte.
  // CR-GC-655: derselbe Gewinner entscheidet auch die Anleitung — sonst stuende neben der Klausel der
  // Skill der Dimension, mit einem Beispiel fuer eine andere Arbeit (ITEM-2026-551).
  const imperativ = winner<{ text: string; types: string[]; skill: string | null }>([
    {
      channel: 'rule-clause',
      value: klausel
        ? {
            text: klausel.text(focusViolations.map((v) => v.element_id), og),
            types: [...klausel.types],
            skill: klausel.skill?.name ?? null,
          }
        : null,
    },
    {
      channel: 'proposal',
      value: focus
        ? {
            text: GENERATION_TEMPLATE[focus] ?? 'Behebe die Funde der Stufe.',
            types: [...(STAGE_FOCUS_TYPES[focus] ?? [])],
            skill: SKILL_FOR_STAGE[focus]?.name ?? null,
          }
        : null,
    },
  ]);
  const template = imperativ?.value.text ?? '';

  return {
    phase: 'expand',
    done: false,
    prompt:
      `${taskVorsatz}Intention: "${effectiveIntent}". ${coverageLine}${abnahmeHinweis}Stufe: ${stufenName(focusViolations[0]!.rule_id)}. ` +
      `Funde: ${funde}. ${template} ${GATE_PROTOCOL}`,
    readiness,
    threshold,
    blockingErrors,
    focusKey,
    // CR-GC-566: dieselbe Praezedenz wie beim Imperativ (CR-GC-564) — stellt eine Regel die
    // Anweisung, bestimmt sie auch die Typen. Sonst stuende im Rundeninhalt die Grammatik
    // einer Dimension, waehrend der Text nach anderen Typen verlangt. Seit CR-GC-575 ist das
    // keine zweite Bedingung mehr, sondern derselbe Gewinner.
    focusTypes: imperativ?.value.types ?? [],
    focusElements: [...new Set(focusViolations.map((v) => v.element_id))],
    focusStage: focus!,
    imperativSkill: imperativ?.value.skill ?? null,
  };
}
