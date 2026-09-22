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
import { RULE_TO_DIMENSION } from '@sigloch/contracts/se';
import type { MetricPolicy } from '@sigloch/contracts/se';
import { takeSteeringSnapshot } from '../kernel/measure/steering-snapshot.js';
import { handoffGate, PhaseGateReadiness } from '../kernel/measure/readiness.js';
import { isIntentTooThin, intentCoverage, type LoadedTargetProfile } from './target-profile.js';
import { winner } from './channel-rank.js';
import { decision } from './decisions.js';

/**
 * Datenvertrag der Generierungs-Instruktion (SCHEMA-generation-step) — Zod, nicht
 * `interface`: der Step ist das Ergebnis des MCP-Tools `graph_generate` und damit
 * die Grenze zwischen Substrat und Agent/Executor. Der eingebettete Executor hat
 * ihn bisher blank gecastet; `GenerationStep.parse` in `runExecutor` macht daraus
 * einen erzwungenen Vertrag.
 */
export const GenerationStep = z.object({
  /** seed = leerer Graph; expand = Deficit-getriebene Verdichtung; handoff = Schwelle erreicht. */
  phase: z.enum(['seed', 'expand', 'handoff']),
  /** true genau in phase 'handoff' — die Struktur trägt, weiter mit graph_suggest. */
  done: z.boolean(),
  /** Die konkrete generative Instruktion für den MCP-Host. */
  prompt: z.string(),
  /** Readiness-Stand je anwendbarer Dimension. */
  // score: null = „nicht messbar" (Kernmenge leer, contracts 9.x) — nie 0 %.
  readiness: z.array(z.object({ dimension: z.string(), score: z.number().nullable(), violations: z.number() })),
  threshold: z.number(),
  /** Error-Violations (Gate-Blocker) — müssen vor dem Handoff auf 0. */
  blockingErrors: z.number(),
  /** SRR/PDR/CDR/TRR Regelabdeckung (CR-GC-296, RULE_TO_PHASE) — die zweite
   * Handoff-Bedingung neben Schwelle + blockingErrors: das AKTUELLE Gate
   * (erstes unvollständiges in SRR→PDR→CDR→TRR) muss covered===total sein. */
  phaseReadiness: z.array(PhaseGateReadiness),
  /** Stabiler Identifikator des fokussierten Fund-Sets (CR-GC-281):
   * `${dimension}:${element_ids sortiert, komma-getrennt}`. null wenn kein
   * Fokus (seed/handoff/keine regelbaren Funde). */
  focusKey: z.string().nullable(),
  /** Fokus-Elementtypen des Schritts (CR-GC-285): `DIMENSION_FOCUS_TYPES` der
   * Fokus-Dimension bzw. der seed-Phase; leer bei handoff/keinem Fokus. Der
   * Executor injiziert dafür Guide-Slice + Element-Index in den Runden-Prompt,
   * ohne den Prompt-String parsen zu müssen. */
  focusTypes: z.array(z.string()),
  /** Fokus-Dimension des Schritts (CR-GC-558): Schluessel in `DIMENSION_FOCUS_TYPES`
   * (`seed` | `uc` | `req` | `arch` | ...), null bei handoff. Steckt zwar auch im
   * `focusKey`-Praefix, aber der ist ein zusammengesetzter Identifikator — wer die
   * Dimension braucht, soll sie lesen, nicht aus einem Key herausschneiden. Der
   * Executor waehlt daran die Autorier-Anleitung. */
  focusDimension: z.string().nullable(),
});
export type GenerationStep = z.infer<typeof GenerationStep>;

/** Wer die Verdicts liest (CR-GC-288): 'host' = der MCP-Client probt selbst per
 * dryRun und vergleicht (Protokoll-Prosa im Prompt); 'driver' = der Treiber führt
 * den Batch am Gate — der dryRun-Vergleichs-Auftrag verschwindet aus dem Prompt
 * (keine parallelen Pfade: der Prompt verlangt nicht, was der Code schon tut).
 *
 * Eine Aussage über den KANAL, nicht über die Kandidatenzahl (CR-GC-568): die
 * 'driver'-Klausel gilt wortgleich bei einem wie bei N Kandidaten — ob der Treiber
 * zwischen mehreren wählt, ist seine Sache und geht das Modell nichts an. Der
 * Executor setzt deshalb immer 'driver'; der Default 'host' gehört dem MCP-Client,
 * der als einziger analysieren darf. */
export type GenerationSelection = 'host' | 'driver';

/** Gate-Protokoll — identisch in jeder Phase; Kandidatenwahl ist Gate-Sache, nie
 * LLM-Bauchgefühl. EIN Template, zwei Selektions-Varianten (CR-GC-288) — Schritt 1
 * (Guide) und der Folgeschritt (graph_generate) sind geteilt, nur der mittlere
 * Auswahl-Auftrag wechselt.
 *
 * CR-GC-577: die host-Variante verlangt die Probe nur noch bei MEHREREN Alternativen.
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
const PROTOCOL_NEXT = 'Danach graph_generate erneut aufrufen für den nächsten Schritt.';
const GATE_PROTOCOL: Record<GenerationSelection, string> = {
  host:
    PROTOCOL_GUIDE +
    // CR-GC-587: Probe-Regel und Rangfolge kommen aus dem Register, nicht aus Prosa hier.
    // (CR-GC-583 hatte hier den Steuerwert VOR dem tier genannt — `rankCandidates` sortiert
    // tier vor Steuerwert. Genau die Klasse Fehler, gegen die das Register steht.)
    '(2) ' + decision('probe') + ' ' + decision('verdictRank') + ' ' +
    '(3) Nur den besten Batch OHNE dryRun anwenden; block-Verdicts verwerfen oder revidieren, nie erzwingen. ' +
    '(4) ' +
    PROTOCOL_NEXT,
  driver:
    PROTOCOL_GUIDE +
    '(2) Emittiere EINEN vollständigen Batch — keine eigenen Gate-Proben: der Treiber führt ihn ' +
    'selbst ans Gate (Fokus-Delta, Steuerwert, tier, Element-Ausbeute) und wendet nur an, was dort besteht. ' +
    '(3) ' +
    PROTOCOL_NEXT,
};

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
export const RULE_CLAUSE: Record<string, { types: string[]; text: (uids: string[]) => string }> = {
  'R-15': {
    types: ['FCHAIN', 'FUNC'],
    text: (uids) =>
      `Diese Funde sind BESTEHENDE, leere FCHAINs (${uids.join(', ')}): häng an jede davon 3±2 FUNC-Elemente` +
      ' (FCHAIN compose→FUNC), die den Ablauf in Schritte zerlegen.',
  },
  // CR-GC-564: Wortlaut aus dem req-Template — dort beschreibt er dieselbe Arbeit korrekt.
  // UC-01 liegt in der uc-Dimension, deren Template ACTOR/FCHAIN/UC verlangt und REQ nicht
  // einmal erwähnt. Gemessen in Rig-Lauf 5: das Modell folgte dem Template, null REQ.
  'UC-01': {
    // CR-GC-566: REQ und TEST gehören in den Fokus, sonst liefert die Injektion die
    // Grammatik nicht, die dieser Text verlangt — und das Modell MUSS danach fragen.
    types: ['UC', 'REQ', 'TEST'],
    text: (uids) =>
      `Diese UCs haben keine Anforderungen (${uids.join(', ')}): schlage je UC 3–5 REQ-Kandidaten vor` +
      ' (UC compose→REQ), präzise und prüfbar formuliert. Emittiere jede neue REQ zusammen mit einem' +
      ' TEST (TEST verify→REQ) im selben Batch — eine REQ ohne verify-TEST blockt das Gate (R-01).',
  },
  // CR-GC-564: der legale Pfad AUSGESCHRIEBEN. ACTOR direkt an UC oder FCHAIN ist die
  // Fehlerart, die Lauf 3 zwei Runden an R-18-Ablehnungen gekostet hat.
  'UC-02': {
    types: ['ACTOR', 'UC', 'FCHAIN', 'FUNC', 'FLOW'],
    text: (uids) =>
      `Diese UCs sind von keinem ACTOR erreichbar (${uids.join(', ')}): der EINZIGE legale Weg ist` +
      ' ACTOR io→FLOW io→FUNC, wobei die FUNC Mitglied einer FCHAIN des UC ist. Lege die fehlenden' +
      ' FLOWs und FUNCs im selben Batch an. ACTOR direkt an UC oder an FCHAIN wird von R-18' +
      ' abgewiesen, in beiden Richtungen.',
  },
};

/** Generative Instruktion je Readiness-Dimension — die einzige Handlungsanweisung des
 * Systems, seit die generischen Lese-Zwillinge in `steering.ts` mit CR-GC-562 gefallen sind. */
export const GENERATION_TEMPLATE: Record<string, string> = {
  uc: 'Schlage je Fund 2–3 Kandidaten vor: fehlende ACTORs (Anbindung ACTOR io→FLOW io→FUNC in der FCHAIN des UC), FCHAIN-Szenarien (UC compose FCHAIN) oder fehlende UCs aus der Intention. UC-Stil: Actor–Verb–Objekt–Ergebnis, ≤25 Wörter — die volle Anleitung steht als Block im Rundeninhalt.',
  req: 'Schlage je UC ohne Requirements 3–5 REQ-Kandidaten vor (UC compose REQ), präzise und prüfbar formuliert; emittiere jede neue REQ zusammen mit einem TEST (TEST verify REQ) im selben Batch — eine REQ ohne verify-TEST blockt das Gate (R-01). Löse Platzhalter/Ambiguität in bestehenden REQs auf.',
  arch: 'Zerlege je Fund die FCHAIN/FUNC-Ebene: 7±2 FUNCs pro Zerlegungsebene (RD-04), FLOWs zwischen FUNCs (io). Schlage je Fund 2 alternative FUNC/FCHAIN-Zerlegungen vor — jede neue FUNC zusammen mit satisfy→REQ und allocate→MOD im selben Batch (fehlt die REQ oder das MOD im Graphen, zuerst anlegen). Lass das Gate wählen.',
  alloc: 'Schlage MOD-Schnitte vor (intern stark, extern schwach gekoppelt) und allocate-Kanten FUNC→MOD; 2 Alternativen, der Steuerwert entscheidet.',
  ver: 'Schlage je unverifiziertem REQ einen TEST-Kandidaten vor (TEST verify REQ), mit konkretem Prüfschritt in der description.',
  schema: 'Schlage SCHEMA-Definitionen für die FLOWs ohne Schema vor (FLOW relation SCHEMA), eine pro Datenform, wiederverwendet statt dupliziert.',
  cr: 'Lege CR-Knoten für die anstehenden Umbauten an (CR relation FUNC/MOD, status/commitRef nach Abschluss).',
  ms: 'Schlage 2–4 Milestones mit depends-on-Reihenfolge vor (MS relation MS) und ordne CRs zu (CR relation MS).',
};

/**
 * Fokus-Elementtypen je Readiness-Dimension (CR-GC-285). Der Kaltstart steht seit
 * CR-GC-559 in `SEED_STAGES` — hier stehen nur Readiness-Dimensionen.
 * Grundlage der Runden-Prompt-Injektion: der Executor holt
 * die `graph_authoring_guide`-Slices dieser Typen und filtert den
 * Element-Index darauf, statt das Modell sie pro Runde erfragen zu lassen
 * (Turn-Analyse: 41–59 % reine Lese-Turns, guide 72–107× pro Lauf).
 * Keys = die Dimensionen von GENERATION_TEMPLATE.
 */
export const DIMENSION_FOCUS_TYPES: Record<string, string[]> = {
  // CR-GC-566: FLOW ist dabei, weil das Template die Anbindung ACTOR io→FLOW io→FUNC verlangt.
  uc: ['ACTOR', 'UC', 'FCHAIN', 'FUNC', 'FLOW'],
  // CR-GC-566: TEST, weil das Template die REQ nur MIT ihrem verify-TEST zulaesst (R-01).
  req: ['UC', 'REQ', 'TEST'],
  // CR-GC-566: MOD, weil das Template allocate→MOD im selben Batch verlangt.
  arch: ['FCHAIN', 'FUNC', 'FLOW', 'REQ', 'MOD'],
  alloc: ['FUNC', 'MOD'],
  ver: ['TEST', 'REQ'],
  schema: ['FLOW', 'SCHEMA'],
  cr: ['CR', 'FUNC', 'MOD'],
  ms: ['MS', 'CR'],
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
 * DIMENSION_FOCUS_TYPES — dort gehoeren Readiness-Dimensionen hin, und der Seed ist keine.
 */
export const SEED_STAGES = {
  sys: ['SYS'],
  uc: ['SYS', 'UC'],
  actor: ['ACTOR', 'UC'],
} as const;

/**
 * Der nächste Generierungsschritt für (Graph, Intention). Deterministisch —
 * gleicher Graph + gleiche Intention + gleiches defer ⇒ gleicher Schritt.
 *
 * `defer` (CR-GC-281): zurückgestellte focusKeys — Fund-Sets, an denen sich
 * der Host festgefahren hat. Die Fokus-Wahl überspringt sie deterministisch
 * (erst nächstes Fund-Fenster derselben Dimension, dann nächstschwächere
 * Dimension); sind ALLE Kandidaten zurückgestellt, wird defer ignoriert
 * (kein Dead-End) und das im Prompt kenntlich gemacht.
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
  // CR-GC-336: kein `= 0.8` mehr. Dieselbe Frage („ist diese Dimension zu schwach?")
  // hatte drei Antworten — hier, im Tool-Schema und in se-steering. Jetzt eine: die Config.
  threshold: number,
  defer: string[] = [],
  selection: GenerationSelection = 'host',
  profile: LoadedTargetProfile | null = null,
): GenerationStep {
  const gateProtocol = GATE_PROTOCOL[selection];
  // Steering-Snapshot (CR-GC-289): og + ND-Injektion + Full-Katalog-Eval +
  // computeReadiness + Phasen-Gates — geteilt mit dem steeringDelta des dryRun-Verdicts.
  const { og, violations, blockingErrors, report, phaseReadiness } = takeSteeringSnapshot(graph, policy);
  const sys = og.elements.find((e) => e.type === 'SYS');
  const effectiveIntent = intent?.trim() || sys?.description?.trim() || '';
  const readiness = report.scores
    .filter((s) => s.applicable > 0)
    .map((s) => ({ dimension: s.dimension as string, score: s.score, violations: s.violations }));
  // CR-GC-296: RULE_TO_PHASE-Achse aus demselben Regelstrom — die zweite,
  // strengere Handoff-Bedingung neben Schwelle + blockingErrors (s.u.). Seit CR-GC-502
  // rechnet sie der Snapshot, generationStep liest sie nur.
  // CR-GC-582: ohne die Steuerregeln — die gehoeren der Phase NACH der Freigabe.
  const openGate = handoffGate(phaseReadiness);

  // --- Phase seed: noch kein System im Graphen -----------------------------
  if (!sys) {
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
        phaseReadiness,
        focusKey: null,
        focusTypes: [],
        focusDimension: null,
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
        gateProtocol,
      readiness,
      threshold,
      blockingErrors,
      phaseReadiness,
      focusKey: null,
      focusTypes: [...SEED_STAGES.sys],
      focusDimension: 'seed:sys',
    };
  }

  // --- Seed-Stufen 2 und 3 (CR-GC-559) -------------------------------------
  // Greifen NUR, solange keine Struktur existiert: ein importierter oder reifer
  // Graph ohne ACTOR darf nicht in den Kaltstart zurückfallen — dort melden
  // UC-02/R-16/FC-04 dasselbe auf dem expand-Pfad, und der Regler misst.
  const strukturBegonnen = og.elements.some((e) => e.type === 'FUNC' || e.type === 'MOD');
  if (!strukturBegonnen) {
    const seedRumpf = (prompt: string, stufe: keyof typeof SEED_STAGES): GenerationStep => ({
      phase: 'seed',
      done: false,
      prompt: prompt + gateProtocol,
      readiness,
      threshold,
      blockingErrors,
      phaseReadiness,
      focusKey: null,
      focusTypes: [...SEED_STAGES[stufe]],
      focusDimension: `seed:${stufe}`,
    });
    if (!og.elements.some((e) => e.type === 'UC')) {
      return seedRumpf(
        `Intention: "${effectiveIntent}". Die SYS-Wurzel steht. Destilliere daraus 3–7 UCs ` +
          '(je Actor–Verb–Objekt–Ergebnis, ≤25 Wörter) und hänge jeden mit SYS compose UC an die Wurzel. ' +
          'Nur UCs — ACTORs und Struktur folgen als eigene Schritte. ',
        'uc',
      );
    }
    if (!og.elements.some((e) => e.type === 'ACTOR')) {
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

  // --- Phase handoff: Schwelle erreicht, keine Gate-Blocker, aktuelles ------
  // Phase-Gate vollständig (CR-GC-296) — sonst kann "Struktur trägt" melden,
  // während PDR/SRR/... noch Regel-Funde offen hat, die die Dimension-Score-
  // Ratio über viele Elemente verdünnt (real passiert: arch-Readiness 0.86 bei
  // null FLOWs — R-10 blieb unter der Schwelle unsichtbar).
  // null = nicht messbar → „existiert noch gar nicht" blockiert den Handoff wie ein
  // Unterschreiten der Schwelle (CR-GC-429 §5 — nie als 0 % oder als bestanden werten).
  const belowThreshold = readiness.filter((r) => r.score === null || r.score < threshold);
  if (belowThreshold.length === 0 && blockingErrors === 0 && openGate === null) {
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
        `Die Struktur trägt (alle Readiness-Dimensionen ≥ ${threshold}, keine error-Violations, ` +
        'alle Phase-Gates SRR/PDR/CDR/TRR regel-vollständig). ' +
        'Handoff auf die ℝ⁶-Optimierung: ' +
        targetInstruction +
        coverageLine +
        'Arbeite die Funde ab (Fix-Template-Edits über graph_mutate, Fund-only-Suggestions manuell); ' +
        'das fitAdvisory jeder Mutation zeigt, ob Δm in Zielrichtung läuft. Die Metrik rankt, das Gate urteilt.',
      readiness,
      threshold,
      blockingErrors,
      phaseReadiness,
      focusKey: null,
      focusTypes: [],
      focusDimension: null,
    };
  }

  // --- Phase expand: niedrigste Dimension mit handlungsfähigen Funden ------
  // Fund-Rotation (CR-GC-281): Kandidaten = 3er-Fenster der deterministisch
  // sortierten Violations je Dimension (schwächste zuerst). Fenster, deren
  // focusKey in `defer` liegt, werden übersprungen — erst innerhalb der
  // Dimension, dann die nächstschwächere. Alles deferred ⇒ defer ignorieren.
  // Nicht messbar (null) rankt OBEN: ein naiver Komparator ergäbe NaN und sortierte gar nicht.
  const dims = [...report.scores]
    .filter((s) => s.applicable > 0 && s.violations > 0)
    .sort((a, b) => (a.score ?? -1) - (b.score ?? -1) || b.violations - a.violations);
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
  const violationsOf = (dimension: string): typeof violations =>
    violations
      .filter((v) => RULE_TO_DIMENSION[v.rule_id] === dimension)
      .sort(
        (a, b) =>
          severityRang(a) - severityRang(b) ||
          a.rule_id.localeCompare(b.rule_id) ||
          a.element_id.localeCompare(b.element_id),
      );
  // Fund-Fenster (CR-GC-290): 3er-Fenster je rule_id-Gruppe, nie regelübergreifend
  // gemischt — sonst verschränken sich z.B. FCHAIN-Erzeugung (R-15) und
  // UC-Population (UC-01) über Runden hinweg statt sich sauber abzuschließen.
  const windowsOf = (vs: typeof violations): (typeof violations)[] => {
    const byRule = new Map<string, typeof violations>();
    for (const v of vs) {
      const list = byRule.get(v.rule_id);
      if (list) list.push(v);
      else byRule.set(v.rule_id, [v]);
    }
    const windows: (typeof violations)[] = [];
    for (const list of byRule.values()) {
      for (let i = 0; i < list.length; i += 3) windows.push(list.slice(i, i + 3));
    }
    return windows;
  };
  // rule_id im Key (CR-GC-290): windowsOf liefert nie regelgemischte Fenster mehr,
  // also identifiziert (dimension, rule_id, element_ids) das Fund-Set eindeutig —
  // ohne rule_id würden zwei Fenster über dieselben Elemente, aber verschiedene
  // Regeln, auf denselben Key kollabieren.
  const keyOf = (dimension: string, vs: typeof violations): string =>
    `${dimension}:${vs[0]?.rule_id ?? ''}:${vs.map((v) => v.element_id).sort().join(',')}`;

  const deferSet = new Set(defer);
  let focus: (typeof dims)[number] | undefined;
  let focusViolations: typeof violations = [];
  let focusKey: string | null = null;
  let deferExhausted = false;
  outer: for (const s of dims) {
    for (const window of windowsOf(violationsOf(s.dimension as string))) {
      const key = keyOf(s.dimension as string, window);
      if (!deferSet.has(key)) {
        focus = s;
        focusViolations = window;
        focusKey = key;
        break outer;
      }
    }
  }
  if (!focus && dims.length > 0) {
    // Alle Kandidaten zurückgestellt — lieber wiederholen als stillstehen.
    deferExhausted = true;
    focus = dims[0];
    focusViolations = windowsOf(violationsOf(focus.dimension as string))[0] ?? [];
    focusKey = keyOf(focus.dimension as string, focusViolations);
  }

  // fix_hint mitrendern (sonst bleibt z.B. R-15s "Add FUNC elements via compose
  // trace" für das Modell unsichtbar — es sieht nur die Symptom-Message).
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
  const imperativ = winner<{ text: string; types: string[] }>([
    {
      channel: 'rule-clause',
      value: klausel
        ? { text: klausel.text(focusViolations.map((v) => v.element_id)), types: [...klausel.types] }
        : null,
    },
    {
      channel: 'proposal',
      value: focus
        ? {
            text: GENERATION_TEMPLATE[focus.dimension] ?? 'Behebe die Funde der Dimension.',
            types: [...(DIMENSION_FOCUS_TYPES[focus.dimension] ?? [])],
          }
        : null,
    },
  ]);
  const template = imperativ?.value.text ?? '';
  const deferNote = deferExhausted
    ? 'Hinweis: ALLE Fund-Sets waren zurückgestellt (defer) — Zurückstellung wird ignoriert. '
    : '';

  return {
    phase: 'expand',
    done: false,
    prompt: focus
      ? `Intention: "${effectiveIntent}". ${coverageLine}${deferNote}Schwächste Dimension: ${focus.dimension}. ` +
        `Funde: ${funde}. ${template} ${gateProtocol}`
      : belowThreshold.length > 0
        ? `Intention: "${effectiveIntent}". ${coverageLine}Unter Schwelle: ${belowThreshold.map((r) => r.dimension).join(', ')} — ` +
          `aber keine regelbaren Funde; prüfe fehlende Elemente der Dimensionen manuell. ${gateProtocol}`
        : `Intention: "${effectiveIntent}". ${coverageLine}Alle Dimensionen ≥ Schwelle, aber Phase-Gate ${openGate} ist noch ` +
          'nicht regel-vollständig (RULE_TO_PHASE) — aber keine regelbaren Funde; prüfe fehlende Elemente ' +
          `manuell. ${gateProtocol}`,
    readiness,
    threshold,
    blockingErrors,
    phaseReadiness,
    focusKey,
    // CR-GC-566: dieselbe Praezedenz wie beim Imperativ (CR-GC-564) — stellt eine Regel die
    // Anweisung, bestimmt sie auch die Typen. Sonst stuende im Rundeninhalt die Grammatik
    // einer Dimension, waehrend der Text nach anderen Typen verlangt. Seit CR-GC-575 ist das
    // keine zweite Bedingung mehr, sondern derselbe Gewinner.
    focusTypes: imperativ?.value.types ?? [],
    focusDimension: focus ? (focus.dimension as string) : null,
  };
}
