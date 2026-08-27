/**
 * Die Testmenge einer MODELLÄNDERUNG (CR-GC-399) — SSOT für `npm run verify:model`
 * UND für den Vollständigkeits-Test, der verhindert, dass sie still veraltet.
 *
 * Anlass: eine Sitzung mit sechs vollen Suite-Läufen (~41 Minuten) für Änderungen,
 * die keine einzige Quelldatei angefasst haben. `graph_tests` löst das nicht — es
 * leitet aus einem CODE-Changeset ab (code → REQ → TEST); eine reine Graph-Mutation
 * hat keinen Code-Changeset und damit keine Ableitung.
 *
 * Ein Test gehört in die Menge, wenn er die committete SSOT liest ODER gegen die
 * Regel-/Ontologie-Konstanten prüft. Genau dieses Kriterium steht als `MODEL_TEST_PATTERNS`
 * hier und wird vom Vollständigkeits-Test auf `tests/` angewandt — die Liste kann
 * deshalb nicht auseinanderlaufen, ohne dass ein Test rot wird.
 *
 * @author andreas@siglochconsulting
 */

/** Was einen Test modellrelevant macht. Ein Kriterium, zwei Anwender. */
export const MODEL_TEST_PATTERNS = [
  /docs\/graph/,
  // CR-GC-401 hat die Luecke gezeigt: `join(REPO, 'docs', 'graph', 'x.graph.json')`
  // baut den Pfad SEGMENTIERT — der Literal-String `docs/graph` kommt nie vor. Sechs
  // Testdateien sind so durch das erste Muster gefallen, eine davon (die Job-Scheibe)
  // ist bei der naechsten Modellaenderung prompt rot geworden, waehrend `verify:model`
  // 243/243 gruen meldete. Der Dateiname ist die robustere Spur als der Verzeichnispfad.
  /graph\.json/,
  /RULES_VERSION|ONTOLOGY_VERSION|V3_RULES|SE_DESCRIPTOR\.rules/,
];

export function isModelRelevant(source) {
  return MODEL_TEST_PATTERNS.some((p) => p.test(source));
}

/** Die Menge, die `verify:model` fährt. */
export const INCLUDED = [
  'tests/audit.rules-passed.test.ts',
  'tests/auto-export.shutdown-flush.test.ts',
  'tests/auto-export.test.ts',
  'tests/codec.roundtrip.test.ts',
  'tests/conformance.test.ts',
  // CR-GC-442: hält fest, dass ND ausgewertet wird UND außerhalb von
  // `SE_DESCRIPTOR.rules` bleibt — ein contracts-Bump, der ND ins Gate legt, muss
  // hier auffallen und nicht erst an einer blockierten Mutation.
  'tests/evaluation.near-duplicate.test.ts',
  'tests/evaluation.reconciliation.test.ts',
  // CR-GC-428: prüft die Differenz der beiden Regelkataloge gegen ALL_RULE_DEFS —
  // ein contracts-Bump, der eine Regel nur ins Steering legt, muss hier auffallen.
  'tests/evaluation.rule-catalog.test.ts',
  'tests/executor.preflight.test.ts',
  'tests/export-graph-guard.test.ts',
  'tests/exporter.test.ts',
  'tests/gate.single-door.test.ts',
  'tests/graph-integrity.test.ts',
  'tests/graph-timetravel.test.ts',
  'tests/harness.import-sys-anchor.test.ts',
  'tests/harness.import.test.ts',
  'tests/help-content.test.ts',
  'tests/help.test.ts',
  'tests/host.bridge.test.ts',
  'tests/mcp.export-guard.test.ts',
  'tests/mcp.export.test.ts',
  'tests/mcp.impact.test.ts',
  'tests/mcp.tests-operational.test.ts',
  'tests/mvp-e2e.test.ts',
  'tests/nd-similarity.test.ts',
  'tests/readiness.model.test.ts',
  'tests/readiness.ontology-sync.test.ts',
  'tests/rewind.test.ts',
  'tests/se-author-uc.test.ts',
  'tests/security.path-containment.test.ts',
  'tests/smoke.create-harness.test.ts',
  // CR-GC-435: misst am Repo-Graphen, ob mindestens ein Arch-Vorschlag anwendbar
  // ist (Umhängen via retire) — eine Modelländerung an den Allokationen ändert
  // genau diesen Befund.
  'tests/suggest.rehang.test.ts',
  'tests/views.auditor.test.ts',
  'tests/views.no-fork.test.ts',
  'tests/verify-model.completeness.test.ts',
  // Nachtrag CR-GC-401: diese fuenf bauen den SSOT-Pfad segmentiert und sind dem
  // ersten Muster entkommen. `hooks.inject-graph-slice` haelt eine Ground-Truth-Liste
  // realer uids und faellt bei jeder Loeschung — genau der Fall, den die Spur decken muss.
  'tests/hooks.inject-graph-slice.test.ts',
  'tests/mcp.member-name.test.ts',
  'tests/schema-guard.test.ts',
  'tests/skill-authoring-gate.test.ts',
  'tests/skill-report-measured.test.ts',
];

/**
 * Bewusst NICHT gefahren — jeder Eintrag mit Grund, damit ein Ausschluss eine
 * Entscheidung bleibt und nicht zu einer stillen Lücke wird.
 */
export const EXCLUDED = {
  'tests/arch.optimization-dry-run.spike.test.ts':
    'Arch-Optimierungs-Spike (CR-GC-436, abgeschlossen No-Go). Liest die SSOT nur als ' +
    'Startzustand in einen eigenen Temp-Store und assertiert Spike-Messwerte (Kohaesion, ' +
    'Q, Befund-Bilanz) plus den Unveraendert-Hash der SSOT — kein Modellinhalt, den die ' +
    'Modell-Spur decken muesste; kostet zwei volle Gate-Laeufe.',
  'tests/steering.convergence-witness.spike.test.ts':
    'Konvergenz-Zeugen-Spike (CR-GC-407). Liest die SSOT nur als realistisch grosses ' +
    'Fixture (degradierte Kopie in einem Temp-Store); assertiert werden Zeugen-/Archiv-' +
    'Eigenschaften der Sequenzen, kein Modellinhalt — keine uid-Pins, eine ' +
    'Modellaenderung kann ihn nicht sinnvoll rot machen. Kostet allein ~5 s Gate-Lauf.',
  'tests/perf.advisory-roundtrip.spike.test.ts':
    'Perf-Spike. Liest die SSOT nur noch für einen Datenpunkt, der seit CR-GC-400 ' +
    'NICHT mehr assertiert; die Assertion hängt an einem modellunabhängigen Eingang ' +
    'fester Größe. Eine Modelländerung kann ihn also nicht rot machen — er kostet ' +
    'aber allein 45 s, mehr als die gesamte restliche Menge.',
};

/**
 * Parallelität: `vitest.config.ts` fährt die Suite seriell (Kuzu = ein Schreiber
 * pro Store). Für DIESE Menge ist parallel nachweislich sicher — jeder Test, der
 * das echte Repo als repoRoot benutzt, übergibt ein eigenes `lockDir` und öffnet
 * damit NIE den Repo-Store. Das ist keine Annahme: der Vollständigkeits-Test
 * prüft es je Datei. Ohne Parallelität sind es 141 s, mit 45 s.
 */
export const FILE_PARALLELISM = true;
