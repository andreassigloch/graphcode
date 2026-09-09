/**
 * TEST-rule-catalog-gap (CR-GC-428) — die NICHT ausgewerteten Regeln werden benannt.
 *
 * Es laufen zwei Regelkataloge: der Gate-/Diagnosepfad registriert den Descriptor-
 * Katalog, der Steering-Pfad wertet den vollen contracts-Katalog aus (BQ + ND
 * zusätzlich). Die unterschiedliche Blockier-Semantik ist eine Entscheidung
 * (CR-GC-287: ND bleibt Steering, nie Gate-Blocker) und bleibt. Der Fehler war,
 * dass `rules_evaluate` daneben `skipped: []` lieferte und damit eine
 * Vollständigkeit behauptete, die es nicht gibt — dieselbe Klasse wie CR-GC-398:
 * eine Compliance-Zahl ohne ihre Grundgesamtheit ist nicht interpretierbar.
 *
 * Der Kern dieser Suite ist NICHT die Zahl, sondern die ABLEITUNG: die Liste
 * entsteht aus `ALL_RULE_DEFS` minus dem geladenen Katalog. Eine gepflegte Tabelle
 * driftet (CR-SM-235: 18 von 71 Regeln fehlten in einer zweiten Tabelle, und kein
 * Test zwang den Nachzug). Deshalb nimmt der Drift-Wächter unten eine ECHTE Regel
 * aus dem geladenen Katalog und verlangt, dass sie von selbst in der Ausweisung
 * erscheint — ohne dass irgendwo etwas nachgetragen wird.
 *
 * Realer Disk-Kuzu-Store, echte Harness, echter Regel-Engine-Lauf — kein Mock.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { ALL_RULE_DEFS, DIMENSION_READINESS_NAME } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import {
  evaluateAll,
  ruleCatalogs,
  unevaluatedRuleIds,
  LOCALLY_EVALUATED_RULE_IDS,
  SKIPPED_RULE_PREFIX,
  type EvaluationHarness,
} from '../src/kernel/evaluation.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

/**
 * Die AKZEPTIERTE Differenz der beiden Kataloge — die Regeln, die das GATE nicht
 * kennt (CR-GC-287). Kein Zahlen-Snapshot: wächst die Differenz, ist eine Regel
 * still aus dem Gate-Katalog gefallen, und genau das soll hier auffallen statt in
 * einer Kennzahl zu verschwinden.
 *
 * CR-SM-305 hat sie um sechs erweitert, und der Zuwachs ist der ERWÜNSCHTE Ausfall
 * dieses Wächters: die Kongruenz-Regeln RC-01…RC-06 stehen seit contracts 10.1 im
 * Katalog und werden dort NICHT ausgeführt — ihre Signatur ist `(graph, CodeFacts)`,
 * und `evaluateAllRules` hat keine CodeFacts. Vorher standen sie überhaupt nicht im
 * Katalog: ein Modell-Zug, der die Bindung an den Code bricht, ging lautlos durch.
 * Jetzt steht die Nicht-Auswertung als Aussage da, statt zu fehlen.
 */
const NOT_IN_GATE = [
  'BQ-01', 'BQ-02', 'BQ-04', 'BQ-06', 'BQ-07', 'ND-01', 'ND-02',
  'RC-01', 'RC-02', 'RC-03', 'RC-04', 'RC-05', 'RC-06',
];

/**
 * Was davon wirklich NICHT AUSGEWERTET wird (CR-GC-442). ND-01/ND-02 sind seit
 * CR-GC-442 aus dieser Liste heraus: der Report-Pfad wertet sie lokal aus (der
 * Gate-Katalog trägt sie weiterhin nicht — die beiden Aussagen sind ab hier
 * getrennt).
 *
 * CR-GC-489: die RC-Regeln ebenso, aber BEDINGT — dieser Port hat eine lesbare
 * Repo-Wurzel, also läuft die Konformanz und wertet sie aus. Vorher standen sie hier
 * unbedingt drin, und damit behauptete DIESELBE Antwort „RC-04 nicht ausgewertet"
 * neben drei RC-04-Befunden. Übrig bleiben die BQ-Regeln, die nur der Steering-Pfad
 * fährt. Was passiert, wenn die Wurzel FEHLT, prüft der Test weiter unten.
 */
const SKIPPED_RULES = NOT_IN_GATE.filter(
  (id) => !LOCALLY_EVALUATED_RULE_IDS.includes(id) && !id.startsWith('RC-'),
);

/**
 * Die Kongruenz-Regeln, deren Nicht-Auswertung STRUKTURELL ist und nicht ein Ausfall.
 *
 * Sie sind der zweite Grund, aus dem eine `error`-Regel in der Lücke stehen darf — der
 * erste ist ND (lokal nachgeholt). Der Unterschied, auf den es ankommt: eine ND-Regel
 * KÖNNTE das Gate fahren und tut es woanders; eine RC-Regel kann es hier gar nicht, weil
 * die Eingabe fehlt. Beides ist erlaubt, **stillschweigend** ist keins von beidem — und
 * genau das prüft der Test unten.
 */
const CONFORMANCE_RULES = ALL_RULE_DEFS.filter((r) => r.profile === 'conformance').map((r) => r.id);

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'catalog-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-rule-catalog-gap: die ungeladenen Regeln werden benannt (CR-GC-428)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: ReturnType<typeof bindToolsToHarness>;
  /** Die Harness-Fläche einer Auswertung — Basis für die verengten Varianten unten. */
  let port: EvaluationHarness;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-catalog-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    // Ein MOD ohne allokierte FUNC verstößt real gegen eine Regel — damit die
    // Auswertung unten Findings hat und die Aussagen nicht am leeren Graphen hängen.
    await harness.importGraph({
      elements: [
        { id: 'SYS-x', type: 'SYS', name: 'x', description: 'Ein System.' },
        { id: 'MOD-neu', type: 'MOD', name: 'neu', description: 'Ein Modul ohne FUNC.' },
      ],
      traces: [],
    });
    tools = bindToolsToHarness(harness);
    port = {
      evaluateRules: () => harness.evaluateRules(),
      getGraph: () => harness.getGraph(),
      getRepoRoot: () => harness.getRepoRoot(),
      getLoadedRuleIds: () => harness.getLoadedRuleIds(),
    };
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  /** Die Regel-IDs aus `skipped`, ohne Präfix. */
  const ruleGapOf = (skipped: string[]): string[] =>
    skipped.filter((s) => s.startsWith(SKIPPED_RULE_PREFIX)).map((s) => s.slice(SKIPPED_RULE_PREFIX.length));

  it('die Auswertung führt jede contracts-Regel auf, die niemand auswertet', () => {
    const ev = evaluateAll(harness);

    // Nicht ausgewertet = nicht im Gate-Katalog UND nicht lokal nachgeholt (CR-GC-442)
    // UND nicht von der Konformanz gefahren (CR-GC-489 — hier lief sie, die Wurzel ist lesbar).
    expect(ruleGapOf(ev.skipped)).toEqual(
      unevaluatedRuleIds(harness.getLoadedRuleIds()).filter(
        (id) => !LOCALLY_EVALUATED_RULE_IDS.includes(id) && !CONFORMANCE_RULES.includes(id),
      ),
    );
    // Der Graph hat wirklich Verstöße — sonst wäre die Aussage am leeren Fall geprüft.
    expect(ev.findings.length).toBeGreaterThan(0);
    // Die QUELLEN-Ebene ist hier vollständig (repoRoot ist lesbar): was in `skipped`
    // steht, steht dort wegen der Regel-Ebene — und nicht mehr gar nicht.
    expect(ev.skipped.filter((s) => !s.startsWith(SKIPPED_RULE_PREFIX))).toEqual([]);
  });

  it('ausgewertet + ausgelassen = der ganze contracts-Katalog, und das Gate kennt keine fremde Regel', () => {
    const loaded = harness.getLoadedRuleIds();
    const covered = new Set([...loaded, ...unevaluatedRuleIds(loaded)]);

    expect(ALL_RULE_DEFS.filter((r) => !covered.has(r.id)).map((r) => r.id)).toEqual([]);
    // Die Gegenrichtung: es gibt keine Regel, die nur das Gate kennt — sonst wäre
    // contracts nicht mehr die Regelquelle (L2), sondern ein zweiter Katalog.
    const allIds = new Set(ALL_RULE_DEFS.map((r) => r.id));
    expect(loaded.filter((id) => !allIds.has(id))).toEqual([]);
  });

  it('Drift-Wächter: die Differenz der beiden Kataloge ist genau die akzeptierte', () => {
    // Wächst diese Menge, ist eine Regel aus dem Gate-Katalog gefallen — dann ist
    // zu entscheiden, nicht zu übernehmen.
    expect(unevaluatedRuleIds(harness.getLoadedRuleIds())).toEqual(NOT_IN_GATE);

    // Warum ND lokal nachgeholt wird (CR-GC-442): genau die zwei error-Regeln der
    // Lücke sind ND. Wer `blocking.errors: 0` las, las ohne sie "keine Fehler" statt
    // "keine Fehler unter den geladenen Regeln" — und ein Beinahe-Duplikat war in
    // Verstoßliste, Report und Dashboard unsichtbar.
    const errors = ALL_RULE_DEFS.filter((r) => NOT_IN_GATE.includes(r.id) && r.severity === 'error');
    expect(errors.map((r) => r.id)).toEqual(['ND-01', 'ND-02', 'RC-01', 'RC-02', 'RC-03']);
    expect([...LOCALLY_EVALUATED_RULE_IDS]).toEqual(['ND-01', 'ND-02']);
    // CR-SM-305: kein error verschwindet still — jeder in der Lücke hat GENAU EINEN der zwei
    // erlaubten Gründe. ND wird lokal nachgeholt; RC kann hier strukturell nicht laufen und
    // sagt es (die Regel steht im Katalog und in `unevaluatedRuleIds`). Ein error OHNE einen
    // dieser beiden Gründe wäre der Zustand, gegen den dieser Test gebaut ist.
    const ohneGrund = errors
      .map((r) => r.id)
      .filter((id) => !LOCALLY_EVALUATED_RULE_IDS.includes(id) && !CONFORMANCE_RULES.includes(id));
    expect(ohneGrund).toEqual([]);
  });

  it('die Liste ist ABGELEITET: fällt eine Regel aus dem geladenen Katalog, erscheint sie von selbst', () => {
    const loaded = harness.getLoadedRuleIds();
    const victim = loaded[0]!; // eine ECHTE geladene Regel, kein erfundener Name
    const narrowed = evaluateAll({ ...port, getLoadedRuleIds: () => loaded.filter((id) => id !== victim) });

    // Niemand pflegt eine Tabelle nach — genau das ist der Nachweis gegen CR-SM-235.
    expect(narrowed.skipped).toContain(`${SKIPPED_RULE_PREFIX}${victim}`);
    expect(ruleGapOf(narrowed.skipped)).toEqual([...SKIPPED_RULES, victim].sort());
  });

  it('`skipped: []` heißt beweisbar „nichts ausgelassen" — auf BEIDEN Ebenen', () => {
    const everyRule = (): string[] => ALL_RULE_DEFS.map((r) => r.id);

    // Voller Katalog + lesbarer Quellbaum: erst dann ist die Liste leer.
    expect(evaluateAll({ ...port, getLoadedRuleIds: everyRule }).skipped).toEqual([]);

    // Fällt die QUELLE aus, steht sie in DERSELBEN Liste — eine Frage, eine Antwort.
    const degraded = evaluateAll({
      ...port,
      getRepoRoot: () => join(tmp, 'gibt-es-nicht'),
      getLoadedRuleIds: everyRule,
    });
    // CR-GC-489: die ausgefallene Konformanz nennt ihre Regeln beim NAMEN statt sich hinter
    // dem groben Token `'conformance'` zu verstecken — RC-01/02/03 sind `error`.
    expect(degraded.skipped).toEqual(CONFORMANCE_RULES.map((id) => `${SKIPPED_RULE_PREFIX}${id}`));
  });

  it('alle drei Lese-Flächen weisen dieselbe Auslassung aus', async () => {
    const evaluate = await tools.rules_evaluate.handler({});
    const flat = await tools.rules_get_violations.handler({});
    const readiness = await tools.graph_readiness.handler({ detail: false });

    expect(evaluate.skipped).toEqual(flat.skipped);
    expect(readiness.skipped).toEqual(flat.skipped);
    expect(ruleGapOf(flat.skipped)).toEqual(SKIPPED_RULES);
  });

  it('graph_readiness trägt die Katalog-Herkunft je Zahlenblock am ERGEBNIS', async () => {
    const readiness = await tools.graph_readiness.handler({ detail: false });
    const { gate, steering, notInGate } = readiness.catalogs;

    expect(gate.ruleCount).toBe(harness.getLoadedRuleIds().length);
    expect(steering.ruleCount).toBe(ALL_RULE_DEFS.length);
    expect(gate.ruleCount).toBeLessThan(steering.ruleCount);
    // Welche Zahl aus welchem Katalog kommt — die Frage, die vorher nur der
    // Beschreibungstext beantwortete.
    expect(gate.fields).toContain('violationsByRule');
    expect(steering.fields).toEqual([DIMENSION_READINESS_NAME]);
    expect(notInGate).toEqual(NOT_IN_GATE);
    // Dieselbe Ableitung wie die Auswertung, kein zweiter Rechenweg.
    expect(notInGate).toEqual(ruleCatalogs(harness).notInGate);
  });

  it('die Beschreibung von rules_evaluate behauptet keine identische Grundgesamtheit mehr, wo keine ist', () => {
    const description = tools.rules_evaluate.description;

    expect(description).toMatch(new RegExp(`NOT to graph_readiness\\.${DIMENSION_READINESS_NAME}`));
    // Und sie sagt, was `skipped` auf der Regel-Ebene enthält — seit CR-GC-442 eine
    // BQ-Regel, nicht mehr ND: ND wird ausgewertet und darf nicht als "ausgelassen"
    // beschrieben werden.
    expect(description).toContain(`"${SKIPPED_RULE_PREFIX}BQ-01"`);
    expect(description).not.toContain(`"${SKIPPED_RULE_PREFIX}ND-01"`);
  });
});
