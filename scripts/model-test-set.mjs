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
  // CR-GC-591: liest die committete SSOT und verlangt Rang, Zeitpunkt und Treiber an jedem
  // FLOW-channel-* — eine Modellaenderung an den Kanaelen macht ihn rot, also gehoert er in die Spur.
  'tests/channel-model.test.ts',
  // CR-GC-490: haengt an der LEGALITAET von `FUNC -allocate-> MOD` und an `realRef` — faehrt
  // dafuer einen echten Gate-Zug. Eine Meta-Modell-Aenderung an diesem Pattern macht ihn rot,
  // also gehoert er in die Spur.
  'tests/work-order.test.ts',
  // CR-GC-530: haengt an der LEGALITAET von `ACTOR -io-> UC` (seit CR-SM-266 D1 kein Pattern) —
  // bekommt diese Kante ein Pattern zurueck oder faellt `compose` weg, wird er rot.
  'tests/harness.import-rejected-traces.test.ts',
  // CR-GC-489: seedet die echte docs/graph/graphcode.graph.json und prueft an ihr, dass eine
  // RC-Regel nie zugleich ausgewertet UND ausgelassen ist — eine Modellaenderung kann ihn
  // sehr wohl rot machen, also gehoert er in die Spur.
  'tests/readiness-conformance-skip.test.ts',
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
  // CR-GC-629: haelt die Randbreiten-Verteilung ueber die erreichbaren Familiengraphen. Den
  // eingefrorenen Korpus pinnt er, den LIVE-Graphen prueft er auf Grundgesamtheit (FUNC-Zahl,
  // Whiteboxen) — eine Modellaenderung, die graphcodes compose-Baum abraeumt, macht ihn rot.
  // Genau dafuer gehoert er in die Spur; er liest nur Dateien und braucht keine Sekunde.
  'tests/randbreiten.test.ts',
  'tests/readiness.model.test.ts',
  // CR-GC-537: misst den Steuerungsraum an der echten SSOT. Die Terme haengen an den
  // Container-/Randbreiten des Modells (RD-04/BW-02/R-04/CR-01/MT-02) — eine Modelländerung
  // verschiebt `worst` und `measured` unmittelbar, also gehoert er in die Spur.
  'tests/readiness.steer.test.ts',
  'tests/readiness.ontology-sync.test.ts',
  'tests/rewind.test.ts',
  'tests/se-author-uc.test.ts',
  'tests/security.path-containment.test.ts',
  'tests/smoke.create-harness.test.ts',
  // CR-GC-435: misst am Repo-Graphen, ob mindestens ein Arch-Vorschlag anwendbar
  // ist (Umhängen via retire) — eine Modelländerung an den Allokationen ändert
  // genau diesen Befund.
  'tests/suggest.rehang.test.ts',
  // CR-GC-444: zählt am Repo-Graphen die anwendbaren MERGE-Vorschläge. Werden FLOWs
  // konsolidiert oder Verträge umgehängt, ändert sich genau diese Zahl.
  'tests/suggest.merge.test.ts',
  'tests/views.auditor.test.ts',
  'tests/views.no-fork.test.ts',
  'tests/verify-model.completeness.test.ts',
  // Nachtrag CR-GC-401: diese fuenf bauen den SSOT-Pfad segmentiert und sind dem
  // ersten Muster entkommen. `hooks.inject-graph-slice` haelt eine Ground-Truth-Liste
  // realer uids und faellt bei jeder Loeschung — genau der Fall, den die Spur decken muss.
  'tests/hooks.inject-graph-slice.test.ts',
  'tests/mcp.member-name.test.ts',
  'tests/schema-guard.test.ts',
  // CR-GC-488: seit der Umstellung von der Momentaufnahme auf die INVARIANTE gehoert dieser
  // Spike in die Spur. Er haelt fest, dass jeder Produzent von `FLOW-graph-state` im Modell
  // auch im Code einen Schreibpfad hat — eine Modellaenderung, die einen Leser als Schreiber
  // eintraegt, muss hier auffallen. Vorher pinnte er „17 Produzenten, 8 falsch" und wurde bei
  // jeder Modellaenderung rot, ohne dass etwas kaputt war.
  'tests/repository-style.spike.test.ts',
  // CR-GC-541: pinnt die abgeleitete Testmenge einer CODE-Aenderung bitgenau gegen den
  // Handschnitt aus CR-GC-536. Wandert im Modell eine satisfy-/verify-Kante um codec
  // herum, aendert sich genau diese Menge — eine Modellaenderung kann ihn rot machen,
  // also gehoert er in die Spur.
  'tests/test-selection.audit.test.ts',
  'tests/skill-authoring-gate.test.ts',
  'tests/skill-report-measured.test.ts',
];

/**
 * Bewusst NICHT gefahren — jeder Eintrag mit Grund, damit ein Ausschluss eine
 * Entscheidung bleibt und nicht zu einer stillen Lücke wird.
 */
export const EXCLUDED = {
  'tests/retro-kpi.test.ts':
    'CR-GC-639: die Fixture nennt `docs/graph/` und `docs/views/` als PFAD-Zeichenketten in einem\n' +
    'gestellten Sitzungsprotokoll — genau diese Lesezugriffe muss KPI 1 als Doc-Read erkennen. Die\n' +
    'SSOT selbst liest der Test nie; eine Modellaenderung kann ihn nicht rot machen.',
  'tests/cr-messung.test.ts':
    'CR-GC-639: legt ein TEMP-Repo mit docs/cr/open → done und ein Temp-Protokoll an und faehrt den\n' +
    'post-commit-Messpfad. Daher der Treffer auf `docs/cr`. graphcodes eigene SSOT liest er nie — eine\n' +
    'Modellaenderung kann ihn nicht rot machen; eine Aenderung an der Zaehlung sehr wohl.',
  'tests/skill-rule-ids.test.ts':
    'Smeagol (CR-GC-571/602): prueft Skill- und Prompt-TEXTE gegen den Regelkatalog und die\n' +
    'Eigentuemer-Spalte (contracts). Liest weder graphcodes Modell noch dessen SSOT; der Treffer ist\n' +
    'der Regelkatalog. Eine Modellaenderung kann ihn nicht rot machen; eine neue Regel-ID im Skill\n' +
    'oder eine Klausel an einer Task-Regel sehr wohl.',
  'tests/cli.scaffold.test.ts':
    'Scaffold-Verben (init | update | remove) gegen ein TEMP-Repo. Seit CR-GC-612 prueft er, dass\n' +
    'GRAPHCODE.md die Rohdateien als AUSGABEN benennt — daher der Treffer auf `docs/graph/`. Gelesen\n' +
    'wird graphcodes eigene SSOT nicht: die Datei entsteht im Temp-Verzeichnis. Eine Modellaenderung\n' +
    'kann ihn nicht rot machen; eine Aenderung am ausgelieferten Text sehr wohl.',
  'tests/vorspann.test.ts':
    'CR-GC-612: misst GRAPHCODE.md und die Laengen der Werkzeugbeschreibungen gegen den\n' +
    'Regelkatalog. Der Treffer ist der KATALOG, nie graphcodes eigene SSOT — eine Modellaenderung\n' +
    'kann ihn nicht rot machen; ein Werkzeug, das sich wieder selbst erklaert, sehr wohl.',
  'tests/executor-gate.duplicate-index.test.ts':
    'CR-GC-621: prueft, dass der ND-Index des Executor-Preflights weiter Beschreibungen traegt.\n' +
    'Der Treffer ist ein FIXTURE-DATEINAME (`scheduler.graph.json` in einem Wegwerf-Repo), nie\n' +
    'graphcodes eigene SSOT. Eine Modellaenderung kann ihn nicht rot machen; ein Schnitt an\n' +
    '`graph_elements` oder an der Aehnlichkeitsrechnung sehr wohl.',
  'tests/git-env-isolation.test.ts':
    'CR-GC-626: prueft, dass ein Testlauf die git-Umgebung seines Aufrufers nicht erbt. Der\n' +
    'Treffer ist der DATEINAME im Befundtext (`docs/graph/fremd-anlage.graph.json`), nicht der\n' +
    'Inhalt der SSOT — der Test liest keinen Graphen. Eine Modellaenderung kann ihn nicht rot\n' +
    'machen; eine weggefallene setupFiles-Zeile sehr wohl.',
  'tests/policy-herkunft.test.ts':
    'CR-GC-629: prueft die HERKUNFT der Urteilsschwellen — Config gegen den contracts-Startwert,\n' +
    'Policy-Stempel der Messaufbauten, Schwellenbehauptungen in Skilltexten. Der Treffer ist das\n' +
    'GOLDEN EINES RIG-KORPUS als Fixture fuer `openMeasured`, nie graphcodes eigene SSOT. Eine\n' +
    'Aenderung an graphcodes Modell kann ihn nicht rot machen; ein gewandertes Budget ohne Marke\n' +
    'oder eine nackte Schwelle im Skilltext sehr wohl.',
  'tests/read-tools.scope.test.ts':
    'CR-GC-613: misst die ANTWORTGROESSEN der Lesewerkzeuge gegen das GOLDEN EINES RIG-KORPUS\n' +
    '(`rig/sigllm-spezifikation/golden/sigllm-v98.graph.json`), nie graphcodes eigene SSOT. Eine\n' +
    'Aenderung an graphcodes Modell kann ihn nicht rot machen; eine am Schnitt der Lesewerkzeuge\n' +
    'oder am Format-E-Serialisierer sehr wohl.',
  'tests/steer-optimum.test.ts':
    'CR-GC-608: liest den sigllm-Golden als Eingabe fuer das Fertig-Kriterium der Steuerregeln — Maschinen-Test, kein Modell-TEST',
  'tests/generate.task.test.ts':
    'Task-Modus der Zustandsmaschine (CR-GC-601). Der Treffer ist das GOLDEN EINES RIG-KORPUS, nie\n' +
    'graphcodes eigene SSOT. Eine Aenderung an graphcodes Modell kann ihn nicht rot machen; eine an\n' +
    'der Eigentuemer-Spalte oder am Task-Fokus sehr wohl.',
  'tests/generate.statemachine.test.ts':
    'Eigenschaftstest der Zustandsmaschine (CR-GC-593). Der Treffer ist das GOLDEN EINES RIG-KORPUS\n' +
    'und die Auto-Graphen unter rig/, nie graphcodes eigene SSOT: geprueft wird done ⇔ kein Fokus\n' +
    'ueber fremde Graphen. Eine Aenderung an graphcodes Modell kann ihn nicht rot machen; eine an\n' +
    'der Fokuswahl oder am Regelkatalog sehr wohl.',
  'tests/systemtest-rig.test.ts':
    'Auswertungen des Systemtest-Rigs (CR-GC-574/585/586). Der Treffer ist das GOLDEN EINES\n' +
    'RIG-KORPUS (`rig/sigllm-spezifikation/golden/sigllm-v98.graph.json`), nie graphcodes eigene\n' +
    'SSOT: geprueft wird, dass der Hand-Trail dieses Golden nachspielt. Eine Aenderung an\n' +
    'graphcodes Modell kann ihn nicht rot machen; eine an der Nachspiel-Rechnung sehr wohl.',
  'tests/flow-contracts.test.ts':
    'Fluss-Vertraege (CR-GC-426/535). Der Treffer ist ein FIXTURE-DATEINAME: der Hook-Teil\n' +
    'legt `docs/graph/x.graph.json` mit LEEREM Inhalt in einem Wegwerf-Repo an und prueft,\n' +
    'ob `pre-commit` den Pfad als Snapshot erkennt. Geprueft wird die Pfaderkennung, nie\n' +
    'Modellinhalt — die committete SSOT liest er nicht. Eine Modellaenderung kann ihn nicht\n' +
    'rot machen.',
  'tests/no-default-policy-when-judging.test.ts':
    'Waechter (CR-GC-492). Baut keinen Harness und liest keinen Graphen — er SCANNT die\n' +
    'Testdateien nach der Kombination "Handaufbau + echte Repo-Wurzel + urteilende Flaeche".\n' +
    'Eine Modellaenderung kann ihn nicht rot machen; eine neue Testdatei sehr wohl.',
  'tests/rig-measured.test.ts':
    'Messaufbau-Test (CR-GC-491). Beruehrt die Regel-/Ontologie-Konstanten nur als ' +
    'STEMPELFELD: assertiert wird ihre FORM (`/^\\d+\\.\\d+\\.\\d+$/`), nie ein Wert. ' +
    'Der Graph ist eine synthetische Zwei-Knoten-Fixture, nicht die committete SSOT — ' +
    'eine Modellaenderung kann ihn nicht rot machen. Was er prueft, ist die Verdrahtung ' +
    '(Config-Herkunft, Store/Lock, Blindheitsausgang), und die haengt an keinem Modellinhalt.',
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
