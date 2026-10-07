/**
 * CR-GC-288 — Best-of-N-Auswahl im Treiber (deterministisch) +
 * CR-GC-289 — Ranking auf Ziel-Delta statt Volumen.
 *
 * Reale Persistenz (Disk-Kuzu in temp repoRoot), gescriptetes Modell-Backend —
 * der Modell-Endpoint ist die einzige simulierte Grenze; Gate, dryRun-Proben,
 * fitAdvisory, steeringDelta und Audit sind der echte Pfad.
 *
 * Kern-Invarianten: N Kandidaten werden als Gate-dryRun geprobt (auditiert als
 * validate, nie ein Step-Abschluss), NUR der Gewinner wird ohne dryRun
 * angewandt; die Auswahl ist deterministisch (block verwerfen → Befund-Delta der
 * Fokus-Stufe → kein Anstieg blockierender Fehler → tier → Zerstoerungs-Sperre →
 * Chebyshev-Verbesserung → Ausbeute → Index; CR-GC-758: KEIN Gesamt-Delta, auch
 * nicht als Stufe); judge:'model' loggt BEIDE Picks; N=1 bleibt der unveränderte
 * heutige Pfad.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { alsEingabe } from './helpers/format-e.js';
import {
  runExecutor,
  ExecutorConfigSchema,
  type ModelResponse,
  type CallModel,
} from '../src/loop/executor.js';
import {
  rankCandidates,
  effectiveFocusDelta,
  deltaSum,
  steerImprovement,
  removesElements,
  focusDelta,
  temperatureSpread,
  TEMPERATURE_ANCHORS,
} from '../src/loop/executor-rank.js';

const config = (over: Record<string, unknown> = {}) =>
  ExecutorConfigSchema.parse({
    baseUrl: 'http://scripted.invalid',
    model: 'scripted',
    maxRounds: 1,
    maxStepTurns: 4,
    ...over,
  });

/** Gescriptetes Backend: Antworten der Reihe nach, protokolliert Calls inkl. opts (Temperatur). */
function scriptedModel(responses: ModelResponse[]): {
  callModel: CallModel;
  calls: { system: string; messages: unknown[]; opts?: { temperature?: number } }[];
} {
  const calls: { system: string; messages: unknown[]; opts?: { temperature?: number } }[] = [];
  const queue = [...responses];
  const callModel: CallModel = (system, messages, _tools, opts) => {
    calls.push({ system, messages: JSON.parse(JSON.stringify(messages)) as unknown[], opts });
    const next = queue.shift();
    if (!next) throw new Error('scripted model exhausted');
    return Promise.resolve(next);
  };
  return { callModel, calls };
}

const usage = { in: 10, out: 10, reasoning: 0 };

function toolCallResponse(id: string, input: unknown): ModelResponse {
  return {
    text: '',
    toolCalls: [{ id, name: 'graphcode_graph_mutate', input }],
    stopReason: 'tool_use',
    assistantMsg: {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id, type: 'function', function: { name: 'graphcode_graph_mutate', arguments: JSON.stringify(input) } },
      ],
    },
    usage,
  };
}

function textResponse(text: string): ModelResponse {
  return { text, toolCalls: [], stopReason: 'end_turn', assistantMsg: { role: 'assistant', content: text }, usage };
}

// --- Kandidaten-Batches mit empirisch verifizierten Gate-Verdicts (dryRun) ----
// GHOST → tier block (STRUCT) · UC_EXPORT → suggest, Δm=0, mutations=3 ·
// UPDATE_SYS → auto-apply, mutations=1 · FUNC_PAIR → suggest, Δm≈+4.58, mutations=5.

const BLOCK_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'GHOST-x', type: 'GHOST', name: 'Ghost', description: 'Unbekannter Typ.', attributes: {} } },
  ],
};

const UC_EXPORT_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'UC-export', type: 'UC', name: 'Export', description: 'User exportiert den Stand und erhält die Datei.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-export', edgeType: 'compose', attributes: {} } },
  ],
};

const UPDATE_SYS_BATCH = {
  commands: [
    { op: 'update-node', node: { uid: 'SYS-app', type: 'SYS', attributes: { note: 'aktualisiert' } } },
  ],
};

const FUNC_PAIR_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'FUNC-auth', type: 'FUNC', name: 'Authentifizieren', description: 'Prüft Credentials.', attributes: {} } },
    { op: 'add-node', node: { uid: 'FUNC-session', type: 'FUNC', name: 'Session anlegen', description: 'Erzeugt die Session.', attributes: {} } },
    { op: 'add-node', node: { uid: 'FLOW-cred', type: 'FLOW', name: 'Credentials', description: 'Credential-Fluss.', attributes: {} } },
    // CR-GC-488: der Vertrag gehoert in DENSELBEN Batch. Seit CR-SM-271 ist
    // `FLOW -relation-> SCHEMA [1..1]` Grammatik und ein FLOW ohne SCHEMA meldet als
    // R-18/error — das Gate stufte diesen Kandidaten damit auf `tier=block`, er fiel aus
    // der Viabilitaet, und der Judge wurde nie gerufen (2 Modell-Calls statt 3). Dasselbe
    // Muster wie bei UC-01 im scriptedActor: ein Batch, der seinen eigenen Folgefehler
    // gleich mitraeumt, sonst blockt das Gate die ganze Charge.
    { op: 'add-node', node: { uid: 'SCHEMA-cred', type: 'SCHEMA', name: 'CredentialSet', description: 'Form der uebergebenen Credentials.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'FUNC-auth', targetId: 'FLOW-cred', edgeType: 'io', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'FLOW-cred', targetId: 'FUNC-session', edgeType: 'io', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'FLOW-cred', targetId: 'SCHEMA-cred', edgeType: 'relation', attributes: {} } },
  ],
};

// --- CR-GC-289: A-vs-B — Volumen gegen Reparatur (Fokus nach Seed = Stufe 'Anwendungsfall') ---
// A: 6 neue UCs ohne REQ (12 Mutationen) — 12 Befunde MEHR in der Fokus-Stufe (UC-02, FC-02 je UC).
// B: REQ+TEST auf UC-login (4 Mutationen) — die Fokus-Stufe bleibt bei 3 Befunden, UC-01 faellt weg
//    (Stufe Anforderung), die neue REQ bringt eigene Befunde mit. Beide tier=suggest.

const VOLUME_UC_BATCH = {
  commands: Array.from({ length: 6 }, (_, i) => i + 1).flatMap((i) => [
    { op: 'add-node', node: { uid: `UC-vol-${i}`, type: 'UC', name: `Volumen ${i}`, description: `User erledigt Aufgabe ${i} und erhält das Ergebnis ${i}.`, attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: `UC-vol-${i}`, edgeType: 'compose', attributes: {} } },
  ]),
};

const FOCUS_REPAIR_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'REQ-login', type: 'REQ', name: 'Login bestätigt', description: 'Der Login wird innerhalb von 2s bestätigt.', attributes: {} } },
    { op: 'add-node', node: { uid: 'TEST-login', type: 'TEST', name: 'Login-Test', description: 'Prüft die Login-Bestätigung.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'UC-login', targetId: 'REQ-login', edgeType: 'compose', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'TEST-login', targetId: 'REQ-login', edgeType: 'verify', attributes: {} } },
  ],
};

const SEED_BATCH = {
  commands: [
    { op: 'add-node', node: { uid: 'SYS-app', type: 'SYS', name: 'Test App', description: 'Eine Test-App für Best-of-N.', attributes: {} } },
    { op: 'add-node', node: { uid: 'ACTOR-user', type: 'ACTOR', name: 'User', description: 'Nutzt die App.', attributes: {} } },
    { op: 'add-node', node: { uid: 'UC-login', type: 'UC', name: 'Login', description: 'User meldet sich an und erhält Zugriff.', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-login', edgeType: 'compose', attributes: {} } },
  ],
};

describe('Best-of-N ranking (pur, deterministisch)', () => {
  const cand = (index: number, verdict: Record<string, unknown> | null) =>
    ({ index, verdict }) as Parameters<typeof rankCandidates>[0][number];

  /**
   * Ein VOLLSTÄNDIGES fitAdvisory, wie `harness.mutate()` es emittiert
   * (CR-GC-413): das Ranking prüft den Vertrag SCHEMA-fit-advisory jetzt per
   * safeParse, eine abgekürzte `{delta}`-Attrappe ist keine Messung mehr.
   */
  /**
   * CR-GC-483: das Steuer-Advisory, wie `harness.mutate()` es emittiert. `improvement > 0`
   * heisst, der Zug hat die SCHLIMMSTE Stelle des Modells entschaerft.
   */
  const steer = (improvement: number, removes = false) => ({
    rules: ['RD-04', 'BW-02', 'CR-01', 'MT-01', 'MT-02'],
    before: 1, after: 1 - improvement, improvement,
    worstAt: { ruleId: 'RD-04', elementId: 'MOD-x' },
    removesElements: removes,
  });

  const fit = (delta: number[]) => ({
    layer: 'arch' as const,
    dimensions: delta.map((_, i) => `d${i}`),
    before: delta.map(() => 0),
    after: [...delta],
    delta,
    regressions: delta.flatMap((d, i) => (d < 0 ? [`d${i}`] : [])),
  });

  it('ohne Ziel-Delta bleibt tier die Präferenz: auto-apply schlägt suggest trotz schlechterem Δm', () => {
    const a = cand(0, { success: true, tier: 'suggest', fitAdvisory: fit([0.9]), mutations: 99 });
    const b = cand(1, { success: true, tier: 'auto-apply', fitAdvisory: fit([-0.5]), mutations: 1 });
    expect(rankCandidates([a, b])[0]).toBe(b);
  });

  it('v17-Fix: Fortschritts-suggest schlägt Null-Fortschritt-auto-apply (tier ist keine Vorstufe mehr)', () => {
    // Der Runde-3-Fall aus v17: 20 Upsert-Mutationen als auto-apply mit total=0.00
    // gegen eine kleine Reparatur (ein Befund weniger in der Fokus-Stufe) als suggest.
    const noop = cand(0, {
      success: true, tier: 'auto-apply', mutations: 20,
      steeringDelta: steering(0, 0, {}),
    });
    const repair = cand(1, {
      success: true, tier: 'suggest', mutations: 2,
      steeringDelta: steering(0, 0, { Anwendungsfall: 1 }),
    });
    expect(rankCandidates([noop, repair], 'Anwendungsfall')[0]).toBe(repair);
    // Bei ECHTEM Gleichstand im Ziel-Delta bleibt auto-apply die Präferenz.
    const cleanEqual = cand(2, {
      success: true, tier: 'auto-apply', mutations: 2,
      steeringDelta: steering(0, 0, { Anwendungsfall: 1 }),
    });
    expect(rankCandidates([repair, cleanEqual], 'Anwendungsfall')[0]).toBe(cleanEqual);
  });

  /**
   * CR-GC-483 — der Metrik-Tiebreaker ist gewechselt. Bis hierher stand hier Δm (ℝ⁶); der ist an
   * drei Klassen von Gegenbeispielen gefallen (CR-SM-281/-287) und rankt nichts mehr. An seiner
   * Stelle steht der Chebyshev-Score (CR-SM-292): um wie viel der Zug die SCHLIMMSTE Stelle des
   * Modells entschaerft, normiert gegen die Regelschwellen.
   */
  it('Gleichstand im tier, kein steeringDelta → die Chebyshev-Verbesserung entscheidet', () => {
    const a = cand(0, { success: true, tier: 'suggest', steerAdvisory: steer(0.05), mutations: 99 });
    const b = cand(1, { success: true, tier: 'suggest', steerAdvisory: steer(0.40), mutations: 1 });
    expect(steerImprovement(a.verdict)).toBeCloseTo(0.05);
    expect(steerImprovement(b.verdict)).toBeCloseTo(0.40);
    expect(rankCandidates([a, b])[0]).toBe(b);
  });

  it('Δm rankt NICHT mehr: besseres Δm verliert gegen bessere Chebyshev-Verbesserung', () => {
    // Genau die Konstellation, die frueher andersherum ausging.
    const alt = cand(0, { success: true, tier: 'suggest', fitAdvisory: fit([2.0, 1.0]), steerAdvisory: steer(0.01), mutations: 1 });
    const neu = cand(1, { success: true, tier: 'suggest', fitAdvisory: fit([-0.5, -0.5]), steerAdvisory: steer(0.90), mutations: 1 });
    expect(deltaSum(alt.verdict)).toBeGreaterThan(deltaSum(neu.verdict));
    expect(rankCandidates([alt, neu])[0]).toBe(neu);
  });

  it('Zerstoerungs-Sperre: ein loeschender Zug rankt nie ueber einem, der nichts wegnimmt', () => {
    // CR-SM-291 §7.2 Grenze 1, gemessen: der ℝ⁵ misst Form und nie Substanz, also senkt
    // Loeschen ihn zuverlaessig. Die Sperre steht VOR dem Score, sonst gewaenne hier `loescht`.
    const loescht = cand(0, { success: true, tier: 'suggest', steerAdvisory: steer(0.90, true), mutations: 1 });
    const baut = cand(1, { success: true, tier: 'suggest', steerAdvisory: steer(0.05, false), mutations: 1 });
    expect(removesElements(loescht.verdict)).toBe(true);
    expect(steerImprovement(loescht.verdict)).toBeGreaterThan(steerImprovement(baut.verdict));
    expect(rankCandidates([loescht, baut])[0]).toBe(baut);
  });

  it('fehlendes Steuer-Advisory rankt wie „keine Verbesserung", nie besser', () => {
    const ohne = cand(0, { success: true, tier: 'suggest', mutations: 1 });
    const mit = cand(1, { success: true, tier: 'suggest', steerAdvisory: steer(0.10), mutations: 1 });
    expect(steerImprovement(ohne.verdict)).toBe(0);
    expect(rankCandidates([ohne, mit])[0]).toBe(mit);
  });

  /** CR-GC-757: Befunde je Stufe, ganze Zahlen — `delta = before − after`, positiv heisst weniger Befunde. */
  const steering = (blockBefore: number, blockAfter: number, stufen: Record<string, number>) => ({
    blockingErrors: { before: blockBefore, after: blockAfter },
    stages: Object.fromEntries(
      Object.entries(stufen).map(([s, delta]) => [s, { before: 10, after: 10 - delta, delta }]),
    ),
  });

  it('CR-GC-289: das Delta der Fokus-Stufe schlägt Fortschritt anderer Stufen, Δm UND Ausbeute', () => {
    // a: mehr Fortschritt in anderen Stufen + Δm + Volumen, aber NICHT in der Fokus-Stufe.
    const a = cand(0, {
      success: true, tier: 'suggest', mutations: 40,
      fitAdvisory: fit([2.0]),
      steeringDelta: steering(0, 0, { Funktion: 3, Modul: 2 }),
    });
    const b = cand(1, {
      success: true, tier: 'suggest', mutations: 12,
      fitAdvisory: fit([0]),
      steeringDelta: steering(0, 0, { Anforderung: 1 }),
    });
    expect(focusDelta(b.verdict, 'Anforderung')).toBe(1);
    expect(focusDelta(a.verdict, 'Anforderung')).toBe(0);
    expect(rankCandidates([a, b], 'Anforderung')[0]).toBe(b);
    // Ohne Fokus-Stufe fällt die Stufe weg — dann gewinnt a, und zwar ueber die Ausbeute (40 > 12),
    // nicht ueber die Summe der Stufen (CR-GC-758): mit getauschter Ausbeute gewinnt b.
    expect(rankCandidates([a, b], null)[0]).toBe(a);
    const aKlein = cand(0, { ...a.verdict, mutations: 12 });
    const bGross = cand(1, { ...b.verdict, mutations: 40 });
    expect(rankCandidates([aKlein, bGross], null)[0]).toBe(bGross);
  });

  it('CR-GC-758: die Summe ueber alle Stufen rankt nicht — der aufbauende Zug verliert nicht gegen den, der nichts tut', () => {
    // Der Anlass: jedes neue Element bringt erst eigene Befunde mit (hier 3 mehr, ausserhalb der
    // Fokus-Stufe). Mit dem Gesamt-Delta als Rangstufe stand `nichts` (Summe 0) vor `baut` (Summe -3).
    const nichts = cand(0, {
      success: true, tier: 'suggest', mutations: 1,
      steeringDelta: steering(0, 0, {}),
    });
    const baut = cand(1, {
      success: true, tier: 'suggest', mutations: 4,
      steeringDelta: steering(0, 0, { Anwendungsfall: 0, Anforderung: -2, Plan: -1 }),
    });
    expect(focusDelta(nichts.verdict, 'Anwendungsfall')).toBe(0);
    expect(focusDelta(baut.verdict, 'Anwendungsfall')).toBe(0);
    // Gleichstand in der Fokus-Stufe, bei den Blockern, im tier, in der Sperre und im Steuerwert —
    // es entscheidet die Ausbeute, in beiden Eingabe-Reihenfolgen.
    expect(rankCandidates([nichts, baut], 'Anwendungsfall')[0]).toBe(baut);
    expect(rankCandidates([baut, nichts], 'Anwendungsfall')[0]).toBe(baut);
    // Bei gleicher Ausbeute bleibt nur der Index — die Befunde der anderen Stufen sind kein Kriterium.
    const nichtsGleich = cand(0, { ...nichts.verdict, mutations: 4 });
    expect(rankCandidates([baut, nichtsGleich], 'Anwendungsfall')[0]).toBe(nichtsGleich);
    // Die Fokus-Stufe selbst zaehlt weiter: wer DORT Befunde hinzufuegt, verliert gegen Nichtstun.
    const verschlechtert = cand(2, {
      success: true, tier: 'suggest', mutations: 12,
      steeringDelta: steering(0, 0, { Anwendungsfall: -12 }),
    });
    expect(rankCandidates([verschlechtert, nichts], 'Anwendungsfall')[0]).toBe(nichts);
  });

  // -------------------------------------------------------------------------
  // CR-GC-361 — Fortschritt vs. Scheinfortschritt
  // -------------------------------------------------------------------------

  /** Kandidat MIT gemessenen REQ/UC-Beinahe-Duplikaten (Preflight-Messung). */
  const candDup = (index: number, verdict: Record<string, unknown>, dupes: number) =>
    ({
      index,
      verdict,
      duplicates: Array.from({ length: dupes }, () => ({ score: 0.9 })),
    }) as Parameters<typeof rankCandidates>[0][number];

  it('CR-GC-361: bei identischem Fokus-Delta gewinnt der eigenständige, nicht der volumigere Duplikat-Batch', () => {
    // Der gemessene Fehler: die Regeln sind strukturell pro Element, ein
    // Beinahe-Duplikat erfüllt sie exakt so gut. Beide Kandidaten raeumen in `Anforderung`
    // gleich viele Befunde — der Duplikat-Batch nur deshalb, weil er mehr Knoten mitbringt,
    // und er gewinnt ohne die Bereinigung den späten `mutations`-Tiebreaker.
    const dupes = candDup(
      0,
      { success: true, tier: 'suggest', mutations: 5, steeringDelta: steering(0, 0, { Anforderung: 2 }) },
      5,
    );
    const clean = cand(1, {
      success: true, tier: 'suggest', mutations: 3,
      steeringDelta: steering(0, 0, { Anforderung: 2 }),
    });

    // Der ROHE Fokus-Delta ist identisch — genau deshalb entschied vorher die Menge.
    expect(focusDelta(dupes.verdict, 'Anforderung')).toBe(2);
    expect(focusDelta(clean.verdict, 'Anforderung')).toBe(2);
    // Bereinigt: der Gewinn des Duplikat-Batches ist vollständig unbelegt.
    expect(effectiveFocusDelta(dupes, 'Anforderung')).toBeCloseTo(0);
    expect(effectiveFocusDelta(clean, 'Anforderung')).toBe(2);
    expect(rankCandidates([dupes, clean], 'Anforderung')[0]).toBe(clean);
  });

  it('CR-GC-361: echter Fortschritt MIT einem Duplikat schlägt weiterhin Null-Fortschritt', () => {
    // Die Gegenmaßnahme zum v16-Fehler in Gegenrichtung: die Bereinigung ist eine
    // Präferenz, kein Block. Ein Duplikat unter fünf Elementen kostet ein Fünftel
    // des Gewinns — es löscht ihn nicht aus.
    const progress = candDup(
      0,
      { success: true, tier: 'suggest', mutations: 5, steeringDelta: steering(0, 0, { Anforderung: 2 }) },
      1,
    );
    const noProgress = cand(1, {
      success: true, tier: 'auto-apply', mutations: 20,
      steeringDelta: steering(0, 0, { Anforderung: 0 }),
    });
    expect(effectiveFocusDelta(progress, 'Anforderung')).toBeCloseTo(1.6);
    expect(rankCandidates([progress, noProgress], 'Anforderung')[0]).toBe(progress);
  });

  it('CR-GC-361: Verluste werden nicht bereinigt, und ohne Duplikate ändert sich nichts', () => {
    // Ein negativer Fokus-Delta bleibt, wie er ist — Redundanz darf eine
    // Verschlechterung nicht abmildern.
    const loss = candDup(
      0,
      { success: true, tier: 'suggest', mutations: 4, steeringDelta: steering(0, 0, { Anforderung: -2 }) },
      4,
    );
    expect(effectiveFocusDelta(loss, 'Anforderung')).toBe(-2);
    // Ohne Duplikate ist der bereinigte Wert der rohe — der Pfad ist für alle
    // bisherigen Kandidaten unverändert.
    const plain = cand(1, { success: true, tier: 'suggest', mutations: 4, steeringDelta: steering(0, 0, { Anforderung: 3 }) });
    expect(effectiveFocusDelta(plain, 'Anforderung')).toBe(3);
    expect(focusDelta(plain.verdict, 'Anforderung')).toBe(3);
  });

  it('CR-GC-361: Determinismus — gleiche Kandidaten ⇒ gleiche Reihenfolge, Index bleibt der Anker', () => {
    const mk = () => [
      candDup(0, { success: true, tier: 'suggest', mutations: 4, steeringDelta: steering(0, 0, { Anforderung: 2 }) }, 2),
      cand(1, { success: true, tier: 'suggest', mutations: 4, steeringDelta: steering(0, 0, { Anforderung: 1 }) }),
      candDup(2, { success: true, tier: 'suggest', mutations: 4, steeringDelta: steering(0, 0, { Anforderung: 2 }) }, 2),
    ];
    const once = rankCandidates(mk(), 'Anforderung').map((c) => c.index);
    const twice = rankCandidates(mk(), 'Anforderung').map((c) => c.index);
    expect(once).toEqual(twice);
    // Alle drei liegen im bereinigten Fokus-Delta gleichauf (1 Befund): 0 und 2 durch
    // die Bereinigung (2 minus 2 von 4), 1 roh. Keine weitere Stufe trennt sie (CR-GC-758:
    // das ROHE Delta 2 gegen 1 ist kein Kriterium mehr, es gibt kein Gesamt-Delta) —
    // Blocker, tier, Sperre, Steuerwert und Ausbeute sind gleich, es bleibt der Index-Anker.
    expect(effectiveFocusDelta(mk()[0], 'Anforderung')).toBeCloseTo(1);
    expect(effectiveFocusDelta(mk()[1], 'Anforderung')).toBe(1);
    expect(once).toEqual([0, 1, 2]);
    // Der Anker ist der Index, nicht die Eingabe-Reihenfolge.
    expect(rankCandidates(mk().reverse(), 'Anforderung').map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it('CR-GC-289: blockingErrors-Anstieg ist strikt schlechter als jeder Befund-Abbau', () => {
    // a: großer Befund-Abbau, aber neue Steering-Blocker; b: kleines Plus, keine neuen Blocker.
    const a = cand(0, {
      success: true, tier: 'suggest', mutations: 26,
      steeringDelta: steering(1, 7, { Anwendungsfall: 5 }),
    });
    const b = cand(1, {
      success: true, tier: 'suggest', mutations: 3,
      steeringDelta: steering(1, 1, { Anwendungsfall: 1 }),
    });
    expect(rankCandidates([a, b], null)[0]).toBe(b);
    // Auf der Fokus-Stufe zählt weiterhin das reine Befund-Delta (Reihenfolge lt. CR).
    expect(rankCandidates([a, b], 'Anwendungsfall')[0]).toBe(a);
  });

  it('Gleichstand in tier UND Δm → Element-Ausbeute (mutations), dann Index', () => {
    const a = cand(0, { success: true, tier: 'suggest', fitAdvisory: { delta: [0] }, mutations: 3 });
    const b = cand(1, { success: true, tier: 'suggest', fitAdvisory: { delta: [0] }, mutations: 7 });
    expect(rankCandidates([a, b])[0]).toBe(b);
    const c = cand(2, { success: true, tier: 'suggest', fitAdvisory: { delta: [0] }, mutations: 7 });
    expect(rankCandidates([c, b])[0]).toBe(b); // voller Gleichstand → kleinerer Index
  });

  it('block/fehlendes Verdict rankt immer hinter jedem viablen Kandidaten', () => {
    const blocked = cand(0, { success: false, tier: 'block', mutations: 50 });
    const none = cand(1, null);
    const ok = cand(2, { success: true, tier: 'suggest', mutations: 1 });
    expect(rankCandidates([blocked, none, ok])[0]).toBe(ok);
  });

  it('temperatureSpread: N=3 trifft die Anker exakt, N≠3 interpoliert deterministisch', () => {
    expect(temperatureSpread(3)).toEqual([...TEMPERATURE_ANCHORS]);
    expect(temperatureSpread(2)).toEqual([0.15, 0.7]);
    expect(temperatureSpread(1)).toEqual([0.15]);
    const four = temperatureSpread(4);
    expect(four[0]).toBeCloseTo(0.15);
    expect(four[1]).toBeCloseTo(0.15 + (2 / 3) * 0.25);
    expect(four[2]).toBeCloseTo(0.4 + (1 / 3) * 0.3);
    expect(four[3]).toBeCloseTo(0.7);
  });
});

describe('Best-of-N executor (CR-GC-288, echter Gate-/Store-Pfad)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-bestofn-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'bestofn-test', systemId: 'bestofn-test' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    // Expand-Phase: Seed direkt durchs Gate, damit die Kandidaten-Batches auf
    // existierende uids referenzieren können.
    const res = (await registry['graph_mutate'].handler(alsEingabe(SEED_BATCH))) as { success: boolean };
    expect(res.success).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  const uids = (): string[] => harness.getGraph().nodes.map((n) => n.uid);

  const auditEntries = (): { operation?: string; result: string }[] =>
    readFileSync(join(repoRoot, '.graphcode', 'audit.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { operation?: string; result: string });

  it('3 Kandidaten (block/suggest/auto-apply) → auto-apply gewinnt, nur er wird persistiert, Proben als validate auditiert', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', BLOCK_BATCH),
      toolCallResponse('c2', UC_EXPORT_BATCH),
      toolCallResponse('c3', UPDATE_SYS_BATCH),
    ]);
    const traces: string[] = [];
    const before = auditEntries().length;

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 3 }),
      callModel,
      trace: (l) => traces.push(l),
    });

    // Jeder Kandidat sah dieselbe Runden-Prompt-Basis in getrennter History.
    expect(calls.length).toBe(3);
    for (const c of calls) expect(c.messages.length).toBe(1);
    expect(calls[1].messages[0]).toEqual(calls[0].messages[0]);
    expect(calls[2].messages[0]).toEqual(calls[0].messages[0]);

    // Auswahl: auto-apply (UPDATE_SYS) gewinnt — nur er ist persistiert.
    expect(stats.candidatesSampled).toBe(3);
    expect(stats.dryRunProbes).toBe(3);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.algoPicks).toBe(1);
    expect(stats.modelPicks).toBe(0);
    const sys = harness.getGraph().nodes.find((n) => n.uid === 'SYS-app') as { attributes?: Record<string, unknown> };
    expect(sys.attributes?.note).toBe('aktualisiert');
    expect(uids()).not.toContain('UC-export'); // der Verlierer-Kandidat ist NICHT im Store
    expect(uids()).not.toContain('GHOST-x');

    // Trace-Zeilen (CR-GC-289): ALLE Ranking-Stufen sichtbar — tier, Fokus-Delta,
    // Chebyshev-Verbesserung (CR-GC-483), Δm, mutations — plus der Pick.
    // `steer` steht VOR `Δm`, weil es rankt und Δm nur noch berichtet wird.
    // CR-GC-758: kein `total=` mehr — was nicht rankt, steht nicht in der Spur.
    expect(traces.some((l) => /total=/.test(l))).toBe(false);
    const CAND = String.raw`tier=(\S+) focus\(Anwendungsfall\)=([+-]\d+\.\d{2}) steer=([+-]\d+\.\d{2}) Δm=([+-]\d+\.\d{2}) mutations=(\d+)`;
    expect(traces.some((l) => new RegExp(String.raw`candidate 1/3: tier=block .*mutations=0`).test(l))).toBe(true);
    expect(traces.some((l) => new RegExp(String.raw`candidate 2/3: ${CAND}`).test(l))).toBe(true);
    expect(traces.some((l) => /candidate 3\/3: tier=auto-apply/.test(l))).toBe(true);
    expect(traces.some((l) => l.includes('pick: candidate 3 (judge=gate)'))).toBe(true);

    // Audit: 3 dryRun-Proben als operation:'validate' + genau 1 echter Apply.
    const entries = auditEntries().slice(before);
    expect(entries.filter((e) => e.operation === 'validate').length).toBe(3);
    expect(entries.filter((e) => e.operation !== 'validate' && e.result === 'applied').length).toBe(1);
  });

  it('CR-GC-289 Kern: REQ+TEST (4 Mutationen) schlägt UC-Volumen (12 Mutationen) über die Fokus-Stufe — echte Verdicts', async () => {
    // Fokus der Runde nach dem Seed = Stufe 'Anwendungsfall' (Fenster UC-02 an UC-login). A (Volumen):
    // 6 UCs ohne REQ — 12 Befunde mehr in der Fokus-Stufe. B (REQ+TEST auf UC-login): die Fokus-Stufe
    // bleibt unveraendert. Beide tier=suggest; unter CR-288-Ranking (Δm=0 beidseitig → mutations)
    // hätte A gewonnen — Volumen-Bias der v16-Monokultur.
    const { callModel } = scriptedModel([
      toolCallResponse('c1', VOLUME_UC_BATCH), // suggest, Δm=0, mutations=12
      toolCallResponse('c2', FOCUS_REPAIR_BATCH), // suggest, Δm=0, mutations=4
    ]);
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2 }),
      callModel,
      trace: (l) => traces.push(l),
    });

    expect(stats.mutatesApplied).toBe(1);
    // Der Trace macht den Pick nachvollziehbar. CR-GC-757: gezaehlt werden Befunde je Stufe, ganze Zahlen,
    // `delta = vorher − nachher`. CR-GC-758: die Spur traegt kein `total=` mehr — die Summe rankt nicht.
    // A: Fokus-Stufe 3 → 15 (je neuem UC UC-02 und FC-02).
    // B: Fokus-Stufe 3 → 3 — UC-01 faellt weg, die neue REQ bringt eigene Befunde in ANDEREN Stufen mit
    // (Anforderung, Plan). Der Pick ist Nr. 2, weil A die Fokus-Stufe verschlechtert — nicht, weil B sie verbessert.
    expect(traces.some((l) => /total=/.test(l))).toBe(false);
    expect(traces.some((l) => /candidate 1\/2: tier=suggest focus\(Anwendungsfall\)=-12\.00 steer=\+0\.00 Δm=\+0\.00 mutations=12$/.test(l))).toBe(true);
    expect(traces.some((l) => /candidate 2\/2: tier=suggest focus\(Anwendungsfall\)=\+0\.00 steer=\+0\.00 Δm=\+0\.00 mutations=4$/.test(l))).toBe(true);
    expect(traces.some((l) => l.includes('pick: candidate 2 (judge=gate)'))).toBe(true);
    expect(uids()).toContain('REQ-login'); // der Ziel-Delta-Gewinner ist persistiert …
    expect(uids()).toContain('TEST-login');
    expect(uids()).not.toContain('UC-vol-1'); // … das Volumen nicht
  });

  it('CR-GC-758 am echten Gate: Aufbau (REQ+TEST) gegen Nichtstun bei Gleichstand in der Fokus-Stufe — gemessen entscheidet tier, nicht mehr die Summe', async () => {
    // Der Anlass des CR: der aufbauende Zug bringt eigene Befunde mit, der Zug, der nichts tut, keine.
    // Gemessen (2026-10-07) an den echten dryRun-Verdicts:
    type Verdict = {
      success: boolean; tier: string; mutations: number;
      steeringDelta: { blockingErrors: { before: number; after: number }; stages: Record<string, { before: number; after: number; delta: number }> };
    };
    const probe = async (batch: { commands: readonly unknown[] }): Promise<Verdict> =>
      (await registry['graph_mutate'].handler({ ...alsEingabe(batch, harness), dryRun: true })) as Verdict;
    const baut = await probe(FOCUS_REPAIR_BATCH);
    const nichts = await probe(UPDATE_SYS_BATCH);
    const summe = (v: Verdict) => Object.values(v.steeringDelta.stages).reduce((n, d) => n + d.delta, 0);

    // Aufbau: Fokus-Stufe unveraendert (3 → 3), zwei Befunde mehr in Anforderung, einer mehr in Plan.
    expect(baut.tier).toBe('suggest');
    expect(baut.mutations).toBe(4);
    expect(baut.steeringDelta.blockingErrors).toEqual({ before: 0, after: 0 });
    expect(baut.steeringDelta.stages.Anwendungsfall).toEqual({ before: 3, after: 3, delta: 0 });
    expect(baut.steeringDelta.stages.Anforderung).toEqual({ before: 2, after: 4, delta: -2 });
    expect(baut.steeringDelta.stages.Plan).toEqual({ before: 0, after: 1, delta: -1 });
    expect(summe(baut)).toBe(-3);
    // Nichtstun: keine Stufe bewegt sich, kein neuer Befund — und GENAU DESHALB tier auto-apply.
    expect(nichts.tier).toBe('auto-apply');
    expect(nichts.mutations).toBe(1);
    expect(summe(nichts)).toBe(0);
    for (const d of Object.values(nichts.steeringDelta.stages)) expect(d.delta).toBe(0);

    // Was rankt. Die Summe (-3 gegen 0) ist kein Kriterium mehr: bei gleichem tier gewinnt der Aufbau
    // ueber die Ausbeute (4 > 1) — vor CR-GC-758 gewann hier Nichtstun ueber das Gesamt-Delta.
    const a = { index: 0, verdict: baut } as Parameters<typeof rankCandidates>[0][number];
    const n = { index: 1, verdict: nichts } as Parameters<typeof rankCandidates>[0][number];
    const nGleicherTier = { index: 1, verdict: { ...nichts, tier: 'suggest' } } as Parameters<typeof rankCandidates>[0][number];
    expect(rankCandidates([nGleicherTier, a], 'Anwendungsfall')[0]).toBe(a);
    // Mit den Verdicts, wie das Gate sie wirklich gibt, steht Nichtstun WEITER vorn — jetzt ueber die
    // Stufe tier (auto-apply > suggest): die Warnungen, die der Aufbau mitbringt, machen ihn zum suggest.
    // Das ist der gemessene Stand, kein Wunsch; faellt er, aendert sich die Rangfolge an dieser Zeile.
    expect(rankCandidates([a, n], 'Anwendungsfall')[0]).toBe(n);

    // Derselbe Befund durch den ganzen Treiber: gepickt und persistiert wird Kandidat 2 (Nichtstun).
    const { callModel } = scriptedModel([
      toolCallResponse('c1', FOCUS_REPAIR_BATCH),
      toolCallResponse('c2', UPDATE_SYS_BATCH),
    ]);
    const traces: string[] = [];
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2 }),
      callModel,
      trace: (l) => traces.push(l),
    });
    expect(stats.mutatesApplied).toBe(1);
    expect(traces.some((l) => /candidate 1\/2: tier=suggest focus\(Anwendungsfall\)=\+0\.00 steer=\+0\.00 Δm=\+0\.00 mutations=4$/.test(l))).toBe(true);
    expect(traces.some((l) => /candidate 2\/2: tier=auto-apply focus\(Anwendungsfall\)=\+0\.00 steer=\+0\.00 Δm=\+0\.00 mutations=1$/.test(l))).toBe(true);
    expect(traces.some((l) => l.includes('pick: candidate 2 (judge=gate)'))).toBe(true);
    expect(uids()).not.toContain('REQ-login');
    const sys = harness.getGraph().nodes.find((k) => k.uid === 'SYS-app') as { attributes?: Record<string, unknown> };
    expect(sys.attributes?.note).toBe('aktualisiert');
  });

  it("judge:'model': beide Picks werden geloggt, angewandt wird der Modell-Pick (Disagreement messbar)", async () => {
    // Algo-Pick = FUNC_PAIR (Δm>0); das Modell wählt Nr. 2 der gerankten Liste (= UC_EXPORT).
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', UC_EXPORT_BATCH),
      toolCallResponse('c2', FUNC_PAIR_BATCH),
      textResponse('Ich wähle 2.'),
    ]);
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2, judge: 'model' }),
      callModel,
      trace: (l) => traces.push(l),
    });

    // Der Judge-Call zeigt die gerenderten Verdicts der viablen Kandidaten.
    expect(calls.length).toBe(3);
    const judgePrompt = JSON.stringify(calls[2].messages);
    expect(judgePrompt).toContain('tier=suggest');
    expect(judgePrompt).toContain('Antworte NUR mit der Nummer');

    // Beide Picks geloggt; angewandt ist der Modell-Pick (UC_EXPORT), nicht der Algo-Pick.
    expect(stats.modelPicks).toBe(1);
    expect(stats.judgeDisagreements).toBe(1);
    expect(stats.algoPicks).toBe(0);
    expect(traces.some((l) => /pick: algo=2 model=1 applied=1 \(judge=model\)/.test(l))).toBe(true);
    expect(uids()).toContain('UC-export');
    expect(uids()).not.toContain('FUNC-auth');
  });

  it('ALLE Kandidaten block → bestes Feedback ans Modell, der reparierte Kandidat wird angewandt (Repair-Loop)', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', BLOCK_BATCH),
      toolCallResponse('c2', BLOCK_BATCH),
      toolCallResponse('c3', UC_EXPORT_BATCH), // Repair-Nachlieferung des besten Kandidaten
    ]);
    const traces: string[] = [];

    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2 }),
      callModel,
      trace: (l) => traces.push(l),
    });

    // Das Gate-Feedback (violations) stand in der History des Repair-Calls.
    expect(calls.length).toBe(3);
    const repairHistory = JSON.stringify(calls[2].messages);
    expect(repairHistory).toContain('NICHT übernommen');
    expect(traces.some((l) => l.includes('all candidates block'))).toBe(true);

    expect(stats.candidatesSampled).toBe(3); // 2 Kandidaten + 1 Repair-Nachlieferung
    expect(stats.dryRunProbes).toBe(3);
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.repairedAfterRejection).toBe(1);
    expect(uids()).toContain('UC-export');
    expect(uids()).not.toContain('GHOST-x');
  });

  it('driver-Prompt: mit candidates>1 verschwindet der dryRun-Vergleichs-Auftrag aus der Instruktion', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', UC_EXPORT_BATCH),
      toolCallResponse('c2', FUNC_PAIR_BATCH),
      toolCallResponse('c3', UPDATE_SYS_BATCH),
    ]);
    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 3 }),
      callModel,
    });
    const instruction = JSON.stringify(calls[0].messages[0]);
    expect(instruction).not.toContain('dryRun');
    expect(instruction).toContain('Treiber');
    expect(instruction).toContain('graph_authoring_guide'); // Schritt 1 bleibt

    // openai-Backend: Temperatur-Spread [0.15, 0.4, 0.7] pro Kandidat.
    expect(calls.map((c) => c.opts?.temperature)).toEqual([0.15, 0.4, 0.7]);
  });

  it('anthropic-Backend: N Calls OHNE temperature (die Claude-5-API lehnt den Parameter ab)', async () => {
    const { callModel, calls } = scriptedModel([
      toolCallResponse('c1', UC_EXPORT_BATCH),
      toolCallResponse('c2', FUNC_PAIR_BATCH),
    ]);
    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config({ candidates: 2, backend: 'anthropic' }),
      callModel,
    });
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0].opts?.temperature).toBeUndefined();
    expect(calls[1].opts?.temperature).toBeUndefined();
  });

  // CR-GC-526 (ITEM-2026-041): ein zweiter graph_mutate im SELBEN Modell-Turn fiel in den
  // Read-Tool-Zweig und ging direkt an registry['graph_mutate'] — ohne Preflight, ohne
  // Probe, ohne Ranking, ohne dryRun: persistiert, bevor irgendjemand gewaehlt hat.
  it('CR-GC-526: ein zweiter graph_mutate im selben Turn wird NICHT angewandt — ein Batch je Kandidat', async () => {
    const uc = (id: string) => ({
      commands: [
        { op: 'add-node', node: { uid: `UC-${id}`, type: 'UC', name: `Fall ${id}`, description: `User erledigt ${id} und erhält das Ergebnis.`, attributes: {} } },
        { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: `UC-${id}`, edgeType: 'compose', attributes: {} } },
      ],
    });
    const twoMutates: ModelResponse = {
      text: '',
      toolCalls: [
        { id: 'a', name: 'graphcode_graph_mutate', input: uc('a') },
        { id: 'b', name: 'graphcode_graph_mutate', input: uc('b') },
      ],
      stopReason: 'tool_use',
      assistantMsg: {
        role: 'assistant',
        content: null,
        tool_calls: ['a', 'b'].map((id) => ({
          id,
          type: 'function',
          function: { name: 'graphcode_graph_mutate', arguments: JSON.stringify(uc(id)) },
        })),
      },
      usage,
    };
    const { callModel } = scriptedModel([twoMutates, toolCallResponse('c', uc('c'))]);
    const traces: string[] = [];
    const before = auditEntries().length;

    const stats = await runExecutor({ registry, workspaceDir: repoRoot, config: config({ candidates: 2 }), callModel, trace: (l) => traces.push(l) });

    expect(stats.candidatesSampled).toBe(2);
    expect(stats.dryRunProbes).toBe(2);
    expect(stats.mutatesApplied).toBe(1);
    // Genau EIN Gewinner im Store; Seed b hat nie eine Probe gesehen und darf nicht drin sein.
    expect(uids()).not.toContain('UC-b');
    expect(uids().filter((u) => ['UC-a', 'UC-c'].includes(u)).length).toBe(1);
    expect(traces.some((l) => /dupes=1/.test(l))).toBe(false); // die Probe sah keine vorab persistierten Knoten
    expect(traces.some((l) => /weiterer graph_mutate/.test(l))).toBe(true);
    const entries = auditEntries().slice(before);
    expect(entries.filter((e) => e.operation !== 'validate' && e.result === 'applied').length).toBe(1);
  });

  it('Regression: candidates=1 (Default) fährt den Ein-Kandidaten-Pfad — driver-Protokoll, keine Best-of-N-Stats', async () => {
    const { callModel, calls } = scriptedModel([toolCallResponse('c1', UC_EXPORT_BATCH)]);
    const stats = await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: config(), // candidates default 1
      callModel,
    });
    // CR-GC-568: der Step-Pfad bleibt der Ein-Kandidaten-Pfad, das PROTOKOLL nicht.
    // Bis hierher rendert graph_generate 'host' und verlangte einen dryRun-Vergleich
    // in einem Turn, dessen SYSTEM-Prompt Analyse verbietet — und bei candidates=1
    // probt ohnehin niemand. Die MCP-Parität, die der frühere Test schützte, gehört
    // dem MCP-Client (Default 'host' am Tool), nicht dem Executor.
    const instruction = JSON.stringify(calls[0].messages[0]);
    expect(instruction).not.toContain('dryRun');
    expect(instruction).toContain('Treiber');
    // Ein Apply, keine Proben, keine Picks — heutiges Verhalten.
    expect(stats.mutatesApplied).toBe(1);
    expect(stats.dryRunProbes).toBe(0);
    expect(stats.candidatesSampled).toBe(0);
    expect(stats.algoPicks).toBe(0);
    expect(stats.modelPicks).toBe(0);
    expect(stats.judgeDisagreements).toBe(0);
    expect(uids()).toContain('UC-export');
  });
});
