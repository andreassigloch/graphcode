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
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import {
  evaluateAll,
  ruleCatalogs,
  unevaluatedRuleIds,
  SKIPPED_RULE_PREFIX,
  type EvaluationHarness,
} from '../src/evaluation.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

/**
 * Die AKZEPTIERTE Differenz der beiden Kataloge — die sieben Regeln, die nur der
 * Steering-Pfad auswertet (CR-GC-287). Kein Zahlen-Snapshot: wächst die Differenz,
 * ist eine Regel still aus der ausgewerteten Grundgesamtheit gefallen, und genau
 * das soll hier auffallen statt in einer Kennzahl zu verschwinden.
 */
const ACCEPTED_GAP = ['BQ-01', 'BQ-02', 'BQ-04', 'BQ-06', 'BQ-07', 'ND-01', 'ND-02'];

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

  it('die Auswertung führt jede contracts-Regel auf, die der geladene Katalog nicht kennt', () => {
    const ev = evaluateAll(harness);

    expect(ruleGapOf(ev.skipped)).toEqual(unevaluatedRuleIds(harness.getLoadedRuleIds()));
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
    // Wächst diese Menge, ist eine Regel aus der ausgewerteten Grundgesamtheit
    // gefallen — dann ist zu entscheiden, nicht zu übernehmen.
    expect(unevaluatedRuleIds(harness.getLoadedRuleIds())).toEqual(ACCEPTED_GAP);

    // Warum die Ausweisung nötig ist: zwei der sieben sind error-Severity. Wer
    // `blocking.errors: 0` liest, liest ohne sie "keine Fehler" statt "keine Fehler
    // unter den geladenen Regeln".
    const errors = ALL_RULE_DEFS.filter((r) => ACCEPTED_GAP.includes(r.id) && r.severity === 'error');
    expect(errors.map((r) => r.id)).toEqual(['ND-01', 'ND-02']);
  });

  it('die Liste ist ABGELEITET: fällt eine Regel aus dem geladenen Katalog, erscheint sie von selbst', () => {
    const loaded = harness.getLoadedRuleIds();
    const victim = loaded[0]!; // eine ECHTE geladene Regel, kein erfundener Name
    const narrowed = evaluateAll({ ...port, getLoadedRuleIds: () => loaded.filter((id) => id !== victim) });

    // Niemand pflegt eine Tabelle nach — genau das ist der Nachweis gegen CR-SM-235.
    expect(narrowed.skipped).toContain(`${SKIPPED_RULE_PREFIX}${victim}`);
    expect(ruleGapOf(narrowed.skipped)).toEqual([...ACCEPTED_GAP, victim].sort());
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
    expect(degraded.skipped).toEqual(['conformance']);
  });

  it('alle drei Lese-Flächen weisen dieselbe Auslassung aus', async () => {
    const evaluate = await tools.rules_evaluate.handler({});
    const flat = await tools.rules_get_violations.handler({});
    const readiness = await tools.graph_readiness.handler({ detail: false });

    expect(evaluate.skipped).toEqual(flat.skipped);
    expect(readiness.skipped).toEqual(flat.skipped);
    expect(ruleGapOf(flat.skipped)).toEqual(ACCEPTED_GAP);
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
    expect(notInGate).toEqual(ACCEPTED_GAP);
    // Dieselbe Ableitung wie die Auswertung, kein zweiter Rechenweg.
    expect(notInGate).toEqual(ruleCatalogs(harness).notInGate);
  });

  it('die Beschreibung von rules_evaluate behauptet keine identische Grundgesamtheit mehr, wo keine ist', () => {
    const description = tools.rules_evaluate.description;

    expect(description).toMatch(new RegExp(`NOT to graph_readiness\\.${DIMENSION_READINESS_NAME}`));
    // Und sie sagt, was `skipped` auf der Regel-Ebene enthält.
    expect(description).toContain(`"${SKIPPED_RULE_PREFIX}ND-01"`);
  });
});
