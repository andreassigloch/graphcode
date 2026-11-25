/**
 * generate-step-core.ts — die Zustandsmaschine des Generierungsschritts (CR-GC-1032).
 *
 * Abgetrennt aus `generate.ts`: `stepCore` wählt aus dem Steering-Snapshot Phase, Fund-Fenster und
 * Imperativ (seed → expand → handoff | stalled). Die Texte stehen in `generate-klauseln.ts`; den
 * Vertrag des Ergebnisses und den Einstieg `generationStep` trägt `generate.ts`.
 */
import { ALL_RULE_DEFS, STAGE_SETS, TASK_ENTRY, acceptedRuleIds, type MetricPolicy, type RuleTask } from '@sigloch/contracts/se';
import { STEER_RULES } from '@sigloch/se-engine';
import { takeSteeringSnapshot } from '../kernel/measure/steering-snapshot.js';
import { ABNEHMBAR, focusViolations as fokusmenge, blockingOf } from '../kernel/measure/focus-set.js';
import { isIntentTooThin, intentCoverage, type LoadedTargetProfile } from './target-profile.js';
import { winner } from './channel-rank.js';
import type { SteerOptimum } from './stagnation.js';
import type { GenerationStep } from './generate.js';
import {
  GATE_PROTOCOL,
  GENERATION_TEMPLATE,
  RULE_CLAUSE,
  SKILL_FOR_STAGE,
  STAGE_FOCUS_TYPES,
  TASK_OF_ENTRY,
  TASK_SKILL,
  analyseSkill,
  handoffPrompt,
} from './generate-klauseln.js';

// Die Fokusmenge lebt in kernel/measure/focus-set.ts (CR-GC-598/600) — eine Definition fuer
// Schritt, Probe und Bericht, abgeleitet aus der Eigentuemer-Spalte der Regeln.
const windowRuleOf = (vs: readonly { rule_id: string }[]): string | undefined => vs[0]?.rule_id;

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

export function stepCore(
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
): Omit<GenerationStep, 'skill' | 'steer' | 'umbau'> & { imperativSkill?: string | null } {
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
      // CR-GC-853: keine Frage nach Zielgewichten mehr — die Gewichte sind zurueckgebaut.
      return {
        phase: 'seed',
        done: false,
        prompt:
          'Es gibt noch kein SYS-Element und keine Intention. Erfrage die Systemintention als 1 Absatz ' +
          'Prosa (was soll das System für wen leisten?) und rufe graph_generate erneut mit {intent} auf.',
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
    const seedRumpf = (prompt: string, stufe: keyof typeof SEED_STAGES): Omit<GenerationStep, 'skill' | 'umbau'> => ({
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
    return {
      phase: 'handoff',
      done: true,
      prompt: handoffPrompt(steerOptimum, coverageLine),
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
