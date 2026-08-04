/**
 * generate.ts — der Kaltstart-Generierungstreiber (CR-GC-275,
 * aimpro-Fahrplan-Schritt 6, Regime 1: LLM schlägt vor, Gate scort/wählt).
 *
 * Bisher existierte nur Guidance (graph_next_step: generische Aktion pro
 * Deficit-Dimension; graph_authoring_guide: legale Struktur; Skills). Das hier
 * ist der fehlende GENERATIVE Treiber: aus Prosa-Intention + Graph-Zustand die
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
import type { Graph } from '@sigloch/graph-api-core';
import { RULE_TO_DIMENSION } from '@sigloch/contracts/se';
import { takeSteeringSnapshot } from './steering-snapshot.js';
import { computePhaseReadiness, currentPhaseGate, type PhaseGateReadiness } from './readiness.js';

export interface GenerationStep {
  /** seed = leerer Graph; expand = Deficit-getriebene Verdichtung; handoff = Schwelle erreicht. */
  phase: 'seed' | 'expand' | 'handoff';
  /** true genau in phase 'handoff' — die Struktur trägt, weiter mit graph_suggest. */
  done: boolean;
  /** Die konkrete generative Instruktion für den MCP-Host. */
  prompt: string;
  /** Readiness-Stand je anwendbarer Dimension. */
  readiness: { dimension: string; score: number; violations: number }[];
  threshold: number;
  /** Error-Violations (Gate-Blocker) — müssen vor dem Handoff auf 0. */
  blockingErrors: number;
  /** SRR/PDR/CDR/TRR Regelabdeckung (CR-GC-296, RULE_TO_PHASE) — die zweite
   * Handoff-Bedingung neben Schwelle + blockingErrors: das AKTUELLE Gate
   * (erstes unvollständiges in SRR→PDR→CDR→TRR) muss covered===total sein. */
  phaseReadiness: PhaseGateReadiness[];
  /** Stabiler Identifikator des fokussierten Fund-Sets (CR-GC-281):
   * `${dimension}:${element_ids sortiert, komma-getrennt}`. null wenn kein
   * Fokus (seed/handoff/keine regelbaren Funde). */
  focusKey: string | null;
  /** Fokus-Elementtypen des Schritts (CR-GC-285): `DIMENSION_FOCUS_TYPES` der
   * Fokus-Dimension bzw. der seed-Phase; leer bei handoff/keinem Fokus. Der
   * Executor injiziert dafür Guide-Slice + Element-Index in den Runden-Prompt,
   * ohne den Prompt-String parsen zu müssen. */
  focusTypes: string[];
}

/** Wer die Kandidaten-Auswahl macht (CR-GC-288): 'host' = der MCP-Client vergleicht
 * selbst per dryRun (Protokoll-Prosa im Prompt); 'driver' = der Best-of-N-Treiber
 * probt und wählt deterministisch im Code — der dryRun-Vergleichs-Auftrag
 * verschwindet aus dem Prompt (keine parallelen Pfade: der Prompt verlangt nicht,
 * was der Code schon tut). */
export type GenerationSelection = 'host' | 'driver';

/** Gate-Protokoll — identisch in jeder Phase; Kandidatenwahl ist Gate-Sache, nie
 * LLM-Bauchgefühl. EIN Template, zwei Selektions-Varianten (CR-GC-288) — Schritt 1
 * (Guide) und der Folgeschritt (graph_generate) sind geteilt, nur der mittlere
 * Auswahl-Auftrag wechselt. */
const PROTOCOL_GUIDE =
  'Gate-Protokoll: (1) vor dem Schreiben graph_authoring_guide für jeden Elementtyp aufrufen (legale Kanten). ';
const PROTOCOL_NEXT = 'Danach graph_generate erneut aufrufen für den nächsten Schritt.';
const GATE_PROTOCOL: Record<GenerationSelection, string> = {
  host:
    PROTOCOL_GUIDE +
    '(2) Alternativen zuerst als graph_mutate mit dryRun:true einreichen und die Verdicts vergleichen — ' +
    'tier (auto-apply > suggest > block) und fitAdvisory (Δm auf layer:arch, regressions). ' +
    '(3) Nur den besten Batch OHNE dryRun anwenden; block-Verdicts verwerfen oder revidieren, nie erzwingen. ' +
    '(4) ' +
    PROTOCOL_NEXT,
  driver:
    PROTOCOL_GUIDE +
    '(2) Emittiere EINEN vollständigen Batch — keine eigenen Gate-Proben: der Treiber probt jeden ' +
    'Kandidaten selbst am Gate (tier, Δm-fitAdvisory, Element-Ausbeute) und wendet nur den Gewinner an. ' +
    '(3) ' +
    PROTOCOL_NEXT,
};

/** Generative Instruktion je Readiness-Dimension (die Schreib-Zwillinge der graph_next_step-Aktionen). */
const GENERATION_TEMPLATE: Record<string, string> = {
  uc: 'Schlage je Fund 2–3 Kandidaten vor: fehlende ACTORs (io→UC), FCHAIN-Szenarien (UC compose FCHAIN) oder fehlende UCs aus der Intention. UC-Stil: Actor–Verb–Objekt–Ergebnis, ≤25 Wörter (Skill se:author-uc). ' +
    'FCHAIN OHNE Compose-Kante (R-15): KEINE neue FCHAIN/UC anlegen — stattdessen 3±2 FUNC-Elemente an die BESTEHENDE FCHAIN hängen (FCHAIN compose→FUNC), die den Ablauf in Schritte zerlegen.',
  req: 'Schlage je UC ohne Requirements 3–5 REQ-Kandidaten vor (UC compose REQ), präzise und prüfbar formuliert; emittiere jede neue REQ zusammen mit einem TEST (TEST verify REQ) im selben Batch — eine REQ ohne verify-TEST blockt das Gate (R-01). Löse Platzhalter/Ambiguität in bestehenden REQs auf.',
  arch: 'Zerlege je Fund die FCHAIN/FUNC-Ebene: 7±2 FUNCs pro Zerlegungsebene (RD-04), FLOWs zwischen FUNCs (io). Schlage je Fund 2 alternative FUNC/FCHAIN-Zerlegungen vor — jede neue FUNC zusammen mit satisfy→REQ und allocate→MOD im selben Batch (fehlt die REQ oder das MOD im Graphen, zuerst anlegen). Lass das Gate wählen.',
  alloc: 'Schlage MOD-Schnitte vor (intern stark, extern schwach gekoppelt) und allocate-Kanten FUNC→MOD; 2 Alternativen, Δm-Vergleich entscheidet.',
  ver: 'Schlage je unverifiziertem REQ einen TEST-Kandidaten vor (TEST verify REQ), mit konkretem Prüfschritt in der description.',
  schema: 'Schlage SCHEMA-Definitionen für die FLOWs ohne Schema vor (FLOW relation SCHEMA bzw. produces), eine pro Datenform, wiederverwendet statt dupliziert.',
  cr: 'Lege CR-Knoten für die anstehenden Umbauten an (CR relation FUNC/MOD, status/commitRef nach Abschluss).',
  ms: 'Schlage 2–4 Milestones mit depends-on-Reihenfolge vor (MS relation MS) und ordne CRs zu (CR relation MS).',
};

/**
 * Fokus-Elementtypen je Readiness-Dimension (CR-GC-285) — plus `seed` für die
 * Kaltstart-Phase. Grundlage der Runden-Prompt-Injektion: der Executor holt
 * die `graph_authoring_guide`-Slices dieser Typen und filtert den
 * Element-Index darauf, statt das Modell sie pro Runde erfragen zu lassen
 * (Turn-Analyse: 41–59 % reine Lese-Turns, guide 72–107× pro Lauf).
 * Keys = seed + die Dimensionen von GENERATION_TEMPLATE.
 */
export const DIMENSION_FOCUS_TYPES: Record<string, string[]> = {
  seed: ['SYS', 'ACTOR', 'UC'],
  uc: ['ACTOR', 'UC', 'FCHAIN', 'FUNC'],
  req: ['UC', 'REQ'],
  arch: ['FCHAIN', 'FUNC', 'FLOW', 'REQ'],
  alloc: ['FUNC', 'MOD'],
  ver: ['TEST', 'REQ'],
  schema: ['FLOW', 'SCHEMA'],
  cr: ['CR', 'FUNC', 'MOD'],
  ms: ['MS', 'CR'],
};

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
  intent?: string,
  threshold = 0.8,
  defer: string[] = [],
  selection: GenerationSelection = 'host',
): GenerationStep {
  const gateProtocol = GATE_PROTOCOL[selection];
  // Steering-Snapshot (CR-GC-289): og + ND-Injektion + Full-Katalog-Eval +
  // computeReadiness — geteilt mit dem steeringDelta des dryRun-Verdicts.
  const { og, violations, blockingErrors, report } = takeSteeringSnapshot(graph);
  const sys = og.elements.find((e) => e.type === 'SYS');
  const effectiveIntent = intent?.trim() || sys?.description?.trim() || '';
  const readiness = report.scores
    .filter((s) => s.applicable > 0)
    .map((s) => ({ dimension: s.dimension as string, score: s.score, violations: s.violations }));
  // CR-GC-296: RULE_TO_PHASE-Achse aus demselben Regelstrom — die zweite,
  // strengere Handoff-Bedingung neben Schwelle + blockingErrors (s.u.).
  const phaseReadiness = computePhaseReadiness(violations.map((v) => ({ ruleId: v.rule_id })));
  const openGate = currentPhaseGate(phaseReadiness);

  // --- Phase seed: noch kein System im Graphen -----------------------------
  if (!sys) {
    if (!effectiveIntent) {
      return {
        phase: 'seed',
        done: false,
        prompt:
          'Es gibt noch kein SYS-Element und keine Intention. Erfrage die Systemintention als 1 Absatz ' +
          'Prosa (was soll das System für wen leisten?) und rufe graph_generate erneut mit {intent} auf.',
        readiness,
        threshold,
        blockingErrors,
        phaseReadiness,
        focusKey: null,
        focusTypes: [],
      };
    }
    const seedBase =
      `Kaltstart aus der Intention: "${effectiveIntent}" — ` +
      'Schlage EINEN Seed-Batch vor: 1 SYS-Wurzel (description = die Intention wörtlich), ' +
      '1–3 ACTORs (wer nutzt/betreibt das System) und 3–7 UCs (je Actor–Verb–Objekt–Ergebnis, ≤25 Wörter, ' +
      'ACTOR io→UC, SYS compose UC). Keine FUNC/MOD-Ebene im Seed — Struktur folgt readiness-getrieben. ';
    return {
      phase: 'seed',
      done: false,
      prompt: seedBase + gateProtocol,
      readiness,
      threshold,
      blockingErrors,
      phaseReadiness,
      focusKey: null,
      focusTypes: [...DIMENSION_FOCUS_TYPES.seed],
    };
  }

  // --- Phase handoff: Schwelle erreicht, keine Gate-Blocker, aktuelles ------
  // Phase-Gate vollständig (CR-GC-296) — sonst kann "Struktur trägt" melden,
  // während PDR/SRR/... noch Regel-Funde offen hat, die die Dimension-Score-
  // Ratio über viele Elemente verdünnt (real passiert: arch-Readiness 0.86 bei
  // null FLOWs — R-10 blieb unter der Schwelle unsichtbar).
  const belowThreshold = readiness.filter((r) => r.score < threshold);
  if (belowThreshold.length === 0 && blockingErrors === 0 && openGate === null) {
    return {
      phase: 'handoff',
      done: true,
      prompt:
        `Die Struktur trägt (alle Readiness-Dimensionen ≥ ${threshold}, keine error-Violations, ` +
        'alle Phase-Gates SRR/PDR/CDR/TRR regel-vollständig). ' +
        'Handoff auf die ℝ⁶-Optimierung: wähle ein Zielprofil (Gewichte je Dimension, z.B. ' +
        '{"scalability":1} oder {"coherence":1,"modifiability":0.5}) und rufe graph_suggest {target} auf. ' +
        'Arbeite die Funde ab (Fix-Template-Edits über graph_mutate, Fund-only-Suggestions manuell); ' +
        'das fitAdvisory jeder Mutation zeigt, ob Δm in Zielrichtung läuft. Die Metrik rankt, das Gate urteilt.',
      readiness,
      threshold,
      blockingErrors,
      phaseReadiness,
      focusKey: null,
      focusTypes: [],
    };
  }

  // --- Phase expand: niedrigste Dimension mit handlungsfähigen Funden ------
  // Fund-Rotation (CR-GC-281): Kandidaten = 3er-Fenster der deterministisch
  // sortierten Violations je Dimension (schwächste zuerst). Fenster, deren
  // focusKey in `defer` liegt, werden übersprungen — erst innerhalb der
  // Dimension, dann die nächstschwächere. Alles deferred ⇒ defer ignorieren.
  const dims = [...report.scores]
    .filter((s) => s.applicable > 0 && s.violations > 0)
    .sort((a, b) => a.score - b.score || b.violations - a.violations);
  const violationsOf = (dimension: string): typeof violations =>
    violations
      .filter((v) => RULE_TO_DIMENSION[v.rule_id] === dimension)
      .sort((a, b) => a.rule_id.localeCompare(b.rule_id) || a.element_id.localeCompare(b.element_id));
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
  const template = focus ? (GENERATION_TEMPLATE[focus.dimension] ?? 'Behebe die Funde der Dimension.') : '';
  const deferNote = deferExhausted
    ? 'Hinweis: ALLE Fund-Sets waren zurückgestellt (defer) — Zurückstellung wird ignoriert. '
    : '';

  return {
    phase: 'expand',
    done: false,
    prompt: focus
      ? `Intention: "${effectiveIntent}". ${deferNote}Schwächste Dimension: ${focus.dimension}. ` +
        `Funde: ${funde}. ${template} ${gateProtocol}`
      : belowThreshold.length > 0
        ? `Intention: "${effectiveIntent}". Unter Schwelle: ${belowThreshold.map((r) => r.dimension).join(', ')} — ` +
          `aber keine regelbaren Funde; prüfe fehlende Elemente der Dimensionen manuell. ${gateProtocol}`
        : `Intention: "${effectiveIntent}". Alle Dimensionen ≥ Schwelle, aber Phase-Gate ${openGate} ist noch ` +
          'nicht regel-vollständig (RULE_TO_PHASE) — aber keine regelbaren Funde; prüfe fehlende Elemente ' +
          `manuell. ${gateProtocol}`,
    readiness,
    threshold,
    blockingErrors,
    phaseReadiness,
    focusKey,
    focusTypes: focus ? [...(DIMENSION_FOCUS_TYPES[focus.dimension] ?? [])] : [],
  };
}
