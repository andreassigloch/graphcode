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
import type { OntologyGraph } from '@sigloch/contracts/se';
import { evaluateAllRules, RULE_TO_DIMENSION } from '@sigloch/contracts/se';
import { computeReadiness } from '@sigloch/se-steering';
import { exportGraphJson } from './exporter.js';

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
}

/** Gate-Protokoll — identisch in jeder Phase; Kandidatenwahl ist Gate-Sache, nie LLM-Bauchgefühl. */
const GATE_PROTOCOL = [
  'Gate-Protokoll: (1) vor dem Schreiben graph_authoring_guide für jeden Elementtyp aufrufen (legale Kanten). ',
  '(2) Alternativen zuerst als graph_mutate mit dryRun:true einreichen und die Verdicts vergleichen — ',
  'tier (auto-apply > suggest > block) und fitAdvisory (Δm auf layer:arch, regressions). ',
  '(3) Nur den besten Batch OHNE dryRun anwenden; block-Verdicts verwerfen oder revidieren, nie erzwingen. ',
  '(4) Danach graph_generate erneut aufrufen für den nächsten Schritt.',
].join('');

/** Generative Instruktion je Readiness-Dimension (die Schreib-Zwillinge der graph_next_step-Aktionen). */
const GENERATION_TEMPLATE: Record<string, string> = {
  uc: 'Schlage je Fund 2–3 Kandidaten vor: fehlende ACTORs (io→UC), FCHAIN-Szenarien (UC compose FCHAIN) oder fehlende UCs aus der Intention. UC-Stil: Actor–Verb–Objekt–Ergebnis, ≤25 Wörter (Skill se:author-uc).',
  req: 'Schlage je UC ohne Requirements 3–5 REQ-Kandidaten vor (UC compose REQ), präzise und prüfbar formuliert; löse Platzhalter/Ambiguität in bestehenden REQs auf.',
  arch: 'Zerlege je Fund die FCHAIN/FUNC-Ebene: 7±2 FUNCs pro Zerlegungsebene (RD-04), FLOWs zwischen FUNCs (io), satisfy FUNC→REQ. Schlage 2 alternative Zerlegungen vor und lass das Gate wählen.',
  alloc: 'Schlage MOD-Schnitte vor (intern stark, extern schwach gekoppelt) und allocate-Kanten FUNC→MOD; 2 Alternativen, Δm-Vergleich entscheidet.',
  ver: 'Schlage je unverifiziertem REQ einen TEST-Kandidaten vor (TEST verify REQ), mit konkretem Prüfschritt in der description.',
  schema: 'Schlage SCHEMA-Definitionen für die FLOWs ohne Schema vor (FLOW relation SCHEMA bzw. produces), eine pro Datenform, wiederverwendet statt dupliziert.',
  cr: 'Lege CR-Knoten für die anstehenden Umbauten an (CR relation FUNC/MOD, status/commitRef nach Abschluss).',
  ms: 'Schlage 2–4 Milestones mit depends-on-Reihenfolge vor (MS relation MS) und ordne CRs zu (CR relation MS).',
};

function toOntology(graph: Graph): OntologyGraph {
  return JSON.parse(exportGraphJson(graph)) as OntologyGraph;
}

/**
 * Der nächste Generierungsschritt für (Graph, Intention). Deterministisch —
 * gleicher Graph + gleiche Intention ⇒ gleicher Schritt.
 */
export function generationStep(graph: Graph, intent?: string, threshold = 0.8): GenerationStep {
  const og = toOntology(graph);
  const sys = og.elements.find((e) => e.type === 'SYS');
  const effectiveIntent = intent?.trim() || sys?.description?.trim() || '';

  const violations = evaluateAllRules(og);
  const blockingErrors = violations.filter((v) => v.severity === 'error').length;
  const report = computeReadiness(og);
  const readiness = report.scores
    .filter((s) => s.applicable > 0)
    .map((s) => ({ dimension: s.dimension as string, score: s.score, violations: s.violations }));

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
      };
    }
    return {
      phase: 'seed',
      done: false,
      prompt:
        `Kaltstart aus der Intention: "${effectiveIntent}" — ` +
        'Schlage EINEN Seed-Batch vor: 1 SYS-Wurzel (description = die Intention wörtlich), ' +
        '1–3 ACTORs (wer nutzt/betreibt das System) und 3–7 UCs (je Actor–Verb–Objekt–Ergebnis, ≤25 Wörter, ' +
        'ACTOR io→UC, SYS compose UC). Keine FUNC/MOD-Ebene im Seed — Struktur folgt readiness-getrieben. ' +
        GATE_PROTOCOL,
      readiness,
      threshold,
      blockingErrors,
    };
  }

  // --- Phase handoff: Schwelle erreicht, keine Gate-Blocker ----------------
  const belowThreshold = readiness.filter((r) => r.score < threshold);
  if (belowThreshold.length === 0 && blockingErrors === 0) {
    return {
      phase: 'handoff',
      done: true,
      prompt:
        `Die Struktur trägt (alle Readiness-Dimensionen ≥ ${threshold}, keine error-Violations). ` +
        'Handoff auf die ℝ⁶-Optimierung: wähle ein Zielprofil (Gewichte je Dimension, z.B. ' +
        '{"scalability":1} oder {"coherence":1,"modifiability":0.5}) und rufe graph_suggest {target} auf. ' +
        'Arbeite die Funde ab (Fix-Template-Edits über graph_mutate, Fund-only-Suggestions manuell); ' +
        'das fitAdvisory jeder Mutation zeigt, ob Δm in Zielrichtung läuft. Die Metrik rankt, das Gate urteilt.',
      readiness,
      threshold,
      blockingErrors,
    };
  }

  // --- Phase expand: niedrigste Dimension mit handlungsfähigen Funden ------
  const focus = [...report.scores]
    .filter((s) => s.applicable > 0 && s.violations > 0)
    .sort((a, b) => a.score - b.score || b.violations - a.violations)[0];

  // Konkrete Funde der Fokus-Dimension (bis zu 3, deterministisch geordnet).
  const focusViolations = focus
    ? violations
        .filter((v) => RULE_TO_DIMENSION[v.rule_id] === focus.dimension)
        .sort((a, b) => a.rule_id.localeCompare(b.rule_id) || a.element_id.localeCompare(b.element_id))
        .slice(0, 3)
    : [];
  const funde = focusViolations.map((v) => `${v.element_id} (${v.rule_id}: ${v.message})`).join('; ');
  const template = focus ? (GENERATION_TEMPLATE[focus.dimension] ?? 'Behebe die Funde der Dimension.') : '';

  return {
    phase: 'expand',
    done: false,
    prompt: focus
      ? `Intention: "${effectiveIntent}". Schwächste Dimension: ${focus.dimension} ` +
        `(Score ${focus.score}, ${focus.violations} Funde). Funde: ${funde}. ${template} ${GATE_PROTOCOL}`
      : `Intention: "${effectiveIntent}". Unter Schwelle: ${belowThreshold.map((r) => r.dimension).join(', ')} — ` +
        `aber keine regelbaren Funde; prüfe fehlende Elemente der Dimensionen manuell. ${GATE_PROTOCOL}`,
    readiness,
    threshold,
    blockingErrors,
  };
}
