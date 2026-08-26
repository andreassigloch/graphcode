/**
 * The divergence fixture (CR-GC-430) — a start graph with real ARCHITECTURAL slack.
 *
 * CR-GC-430 asks whether two opposed target profiles, run n greedy steps along
 * `graph_suggest` from the SAME start, end in structurally different graphs. That
 * is only answerable on a fixture where the architecture layer
 * (FUNC/FLOW/MOD/SCHEMA/ACTOR — se-engine's `ARCH_TYPES`) has many open moves:
 *
 *   - 7 FUNC with no `allocate` edge   → R-22 can fire six times in a row
 *   - 1 MOD with no allocated FUNC     → R-23 can fire once
 *   - 3 FLOW with no data contract     → SC-02 / SC-04 can fire three times
 *
 * `ARCH_FIXTURE` (CR-GC-340) is deliberately NOT reused: it has exactly one
 * unallocated FUNC and one contract-less FLOW, so its chain is over after two
 * steps and "the runs did not diverge" would be a statement about the fixture.
 *
 * TWO CONSTRUCTION RULES, both learned by measuring this fixture rather than
 * assumed — get either wrong and the chain dies at step one for reasons that
 * have nothing to do with steering:
 *
 *  1. `suggestEdits` keeps only the FIRST violation per rule, and the
 *     architecture fix templates derive their target from the element TEXT
 *     (uniqueness fallback only when exactly one candidate of the type exists —
 *     never the case here, with 4 MOD and 4 SCHEMA). So the first violation of a
 *     rule, in the store's ALPHABETICAL element order, must be one the template
 *     can derive; otherwise that rule is dead for the whole run. `FUNC-watchdog`
 *     and `FLOW-webhook` name nothing on purpose and sort LAST — they are the
 *     floor the chain runs into, not a hole in the middle of it.
 *  2. `MOD-delivery` starts with `FUNC-report` allocated so that R-23's first
 *     violation is `MOD-retention`, the module whose text names a function.
 *  3. `FUNC-notify` is CONTESTED: its own text puts it in `MOD-delivery` (R-22's
 *     derivation) while `MOD-retention`'s text claims it (R-23's derivation).
 *     R-22 walks the functions alphabetically and only reaches `notify` on its
 *     fifth firing, so whether the function ends up in delivery or in retention
 *     depends on how highly the profile ranks R-23 against R-22 — the one place
 *     in the catalogue where the TARGET, not the element text, decides WHERE a
 *     function lands.
 *
 * WHY IDS IN THE DESCRIPTIONS: naming the id makes the template's derivation
 * deterministic instead of name-collision-dependent.
 *
 * GRAMMAR: written against the LOADED `@sigloch/contracts/se` (ONTOLOGY 8.0.0 /
 * RULES 9.1.0), where `ACTOR -io-> UC` no longer exists — an actor reaches a use
 * case through a FLOW that feeds one of its chain functions. The repo SSOT still
 * carries the retired pattern (CR-GC-429), which is exactly why this spike runs
 * on its own fixture and not on the SSOT.
 *
 * @author andreas@siglochconsulting
 */
import type { FixtureGraph } from './steering-graphs.js';

const ref = (symbol: string) => ({ file: 'tests/fixtures/divergence-graph.ts', symbol, lang: 'ts' });
const testRef = (uid: string, name: string) => [
  { file: `tests/fixtures/divergence/${uid}.test.ts`, case: name, tool: 'vitest', level: 'unit' },
];

/**
 * A document-triage pipeline. The io chain is a real pipeline with two branch
 * points (`FLOW-clean` and `FLOW-verdict`), so betweenness — and with it
 * `scalability = 5·(1 − maxBetweenness)` — has something to move, while the four
 * modules give community detection — and with it `coherence` — something to
 * partition.
 */
export const DIVERGENCE_FIXTURE: FixtureGraph = {
  elements: [
    {
      id: 'SYS-triage',
      type: 'SYS',
      name: 'Document triage pipeline',
      description: 'Receives documents from an operator, classifies them, and reports the verdict to an auditor.',
    },

    { id: 'ACTOR-operator', type: 'ACTOR', name: 'Operator', description: 'Submits documents for triage.' },
    { id: 'ACTOR-auditor', type: 'ACTOR', name: 'Auditor', description: 'Reads the triage report.' },

    // --- modules ------------------------------------------------------------
    { id: 'MOD-intake', type: 'MOD', name: 'intake', description: 'Accepts and checks incoming documents.' },
    { id: 'MOD-analysis', type: 'MOD', name: 'analysis', description: 'Derives features and a triage class from a document.' },
    { id: 'MOD-delivery', type: 'MOD', name: 'delivery', description: 'Reports and distributes the finished decision.' },
    // The one module that starts empty, and the only one that names a function —
    // R-23's single opening (see construction rule 2 in the header). It claims
    // FUNC-notify, which FUNC-notify's own text assigns to MOD-delivery: the two
    // architecture operators CONTEST that function, and which one wins is decided
    // by the target profile. That contest is construction rule 3.
    { id: 'MOD-retention', type: 'MOD', name: 'retention', description: 'Keeps finished cases and watches for stalled ones. Home of FUNC-notify.' },

    // --- functions ----------------------------------------------------------
    { id: 'FUNC-archive', type: 'FUNC', name: 'archive', description: 'Stores a finished case for later retrieval. Runs in MOD-delivery.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-classify', type: 'FUNC', name: 'classify', description: 'Assigns a triage class to a feature set.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-explain', type: 'FUNC', name: 'explain', description: 'Turns a triage class into a readable verdict. Runs in MOD-analysis.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-extract', type: 'FUNC', name: 'extract', description: 'Derives the feature set of a document. Runs in MOD-analysis.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-normalize', type: 'FUNC', name: 'normalize', description: 'Rewrites a document into canonical form. Runs in MOD-intake.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-notify', type: 'FUNC', name: 'notify', description: 'Pushes the decision to the subscribed channels. Runs in MOD-delivery.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-receive', type: 'FUNC', name: 'receive', description: 'Accepts a raw document from the operator.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-report', type: 'FUNC', name: 'report', description: 'Renders the decision for the auditor.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'FUNC-validate', type: 'FUNC', name: 'validate', description: 'Checks a document against the intake policy. Runs in MOD-intake.', realRef: ref('DIVERGENCE_FIXTURE') },
    // Names no module and sorts last — the R-22 floor.
    { id: 'FUNC-watchdog', type: 'FUNC', name: 'watchdog', description: 'Detects stalled cases and puts them back in the queue.', realRef: ref('DIVERGENCE_FIXTURE') },

    // --- flows --------------------------------------------------------------
    { id: 'FLOW-clean', type: 'FLOW', name: 'clean document', description: 'The document in canonical form. Shaped by SCHEMA-clean.' },
    { id: 'FLOW-features', type: 'FLOW', name: 'feature set', description: 'The derived features of a document. Shaped by SCHEMA-features.' },
    { id: 'FLOW-raw', type: 'FLOW', name: 'raw document', description: 'The submitted document as received. Shaped by SCHEMA-raw.' },
    { id: 'FLOW-verdict', type: 'FLOW', name: 'triage verdict', description: 'The assigned triage class with its rationale. Shaped by SCHEMA-verdict.' },
    // Names no schema and sorts last — the SC-02/SC-04 floor.
    { id: 'FLOW-webhook', type: 'FLOW', name: 'outbound notice', description: 'The message that carries the decision out to a subscribed channel.' },

    // --- data contracts -----------------------------------------------------
    { id: 'SCHEMA-clean', type: 'SCHEMA', name: 'CleanDocument', description: 'Canonical text with a stable section index.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'SCHEMA-features', type: 'SCHEMA', name: 'FeatureSet', description: 'Named numeric features with their provenance.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'SCHEMA-raw', type: 'SCHEMA', name: 'RawDocument', description: 'Byte payload plus submission metadata.', realRef: ref('DIVERGENCE_FIXTURE') },
    { id: 'SCHEMA-verdict', type: 'SCHEMA', name: 'TriageVerdict', description: 'Triage class, confidence, and rationale text.', realRef: ref('DIVERGENCE_FIXTURE') },

    // --- process layer (kept minimal: it is outside ARCH_TYPES) --------------
    { id: 'UC-submit', type: 'UC', name: 'Operator submits a document', description: 'The Operator hands a document to the pipeline and it is accepted for triage.' },
    { id: 'UC-review', type: 'UC', name: 'Auditor reviews a verdict', description: 'The Auditor opens the triage report and confirms or rejects the verdict.' },

    { id: 'FCHAIN-submit', type: 'FCHAIN', name: 'Submission chain', description: 'The ordered steps that accept and normalize a document.' },
    { id: 'FCHAIN-review', type: 'FCHAIN', name: 'Review chain', description: 'The ordered steps that classify a document and report the verdict.' },

    { id: 'REQ-accept', type: 'REQ', name: 'Submission acceptance', description: 'The pipeline shall accept a well-formed document within two seconds of submission.', kinds: ['functional'] },
    { id: 'REQ-classify', type: 'REQ', name: 'Classification recall', description: 'The pipeline shall assign the correct triage class for at least ninety percent of the reference corpus.', kinds: ['functional'] },

    { id: 'TEST-accept', type: 'TEST', name: 'Submission acceptance test', description: 'Submits reference documents and asserts the acceptance budget.', testRefs: testRef('accept', 'submission acceptance') },
    { id: 'TEST-classify', type: 'TEST', name: 'Classification recall test', description: 'Runs the reference corpus and asserts the recall floor.', testRefs: testRef('classify', 'classification recall') },
  ],
  traces: [
    { source: 'SYS-triage', target: 'UC-submit', type: 'compose' },
    { source: 'SYS-triage', target: 'UC-review', type: 'compose' },
    { source: 'SYS-triage', target: 'MOD-intake', type: 'compose' },
    { source: 'SYS-triage', target: 'MOD-analysis', type: 'compose' },
    { source: 'SYS-triage', target: 'MOD-delivery', type: 'compose' },
    { source: 'SYS-triage', target: 'MOD-retention', type: 'compose' },

    { source: 'UC-submit', target: 'FCHAIN-submit', type: 'compose' },
    { source: 'UC-review', target: 'FCHAIN-review', type: 'compose' },
    { source: 'UC-submit', target: 'REQ-accept', type: 'compose' },
    { source: 'UC-review', target: 'REQ-classify', type: 'compose' },

    { source: 'FCHAIN-submit', target: 'FUNC-receive', type: 'compose' },
    { source: 'FCHAIN-submit', target: 'FUNC-validate', type: 'compose' },
    { source: 'FCHAIN-submit', target: 'FUNC-normalize', type: 'compose' },
    { source: 'FCHAIN-review', target: 'FUNC-extract', type: 'compose' },
    { source: 'FCHAIN-review', target: 'FUNC-classify', type: 'compose' },
    { source: 'FCHAIN-review', target: 'FUNC-explain', type: 'compose' },
    { source: 'FCHAIN-review', target: 'FUNC-report', type: 'compose' },

    { source: 'TEST-accept', target: 'REQ-accept', type: 'verify' },
    { source: 'TEST-classify', target: 'REQ-classify', type: 'verify' },
    { source: 'FUNC-receive', target: 'REQ-accept', type: 'satisfy' },
    { source: 'FUNC-classify', target: 'REQ-classify', type: 'satisfy' },

    // --- the io pipeline (the arch topology under measurement) ---------------
    { source: 'ACTOR-operator', target: 'FLOW-raw', type: 'io' },
    { source: 'FLOW-raw', target: 'FUNC-receive', type: 'io' },
    { source: 'FUNC-receive', target: 'FLOW-clean', type: 'io' },
    { source: 'FLOW-clean', target: 'FUNC-validate', type: 'io' },
    { source: 'FLOW-clean', target: 'FUNC-normalize', type: 'io' },
    { source: 'FUNC-normalize', target: 'FLOW-features', type: 'io' },
    { source: 'FLOW-features', target: 'FUNC-extract', type: 'io' },
    { source: 'FLOW-features', target: 'FUNC-classify', type: 'io' },
    { source: 'FUNC-classify', target: 'FLOW-verdict', type: 'io' },
    { source: 'FUNC-validate', target: 'FLOW-verdict', type: 'io' },
    { source: 'FLOW-verdict', target: 'FUNC-explain', type: 'io' },
    { source: 'FLOW-verdict', target: 'FUNC-report', type: 'io' },
    { source: 'FLOW-verdict', target: 'FUNC-notify', type: 'io' },
    { source: 'FLOW-verdict', target: 'FUNC-watchdog', type: 'io' },
    { source: 'FUNC-explain', target: 'FLOW-webhook', type: 'io' },
    { source: 'FUNC-notify', target: 'FLOW-webhook', type: 'io' },
    { source: 'FUNC-report', target: 'FLOW-webhook', type: 'io' },
    { source: 'FUNC-watchdog', target: 'FLOW-webhook', type: 'io' },
    { source: 'FLOW-webhook', target: 'ACTOR-auditor', type: 'io' },
    { source: 'FLOW-webhook', target: 'FUNC-archive', type: 'io' },

    // --- the allocations that already exist ---------------------------------
    // Three of ten functions are placed; the other seven are the slack.
    { source: 'FUNC-receive', target: 'MOD-intake', type: 'allocate' },
    { source: 'FUNC-classify', target: 'MOD-analysis', type: 'allocate' },
    { source: 'FUNC-report', target: 'MOD-delivery', type: 'allocate' },

    // --- the data contracts that already exist ------------------------------
    // One of five flows is bound; three more are derivable, one is the floor.
    { source: 'FLOW-raw', target: 'SCHEMA-raw', type: 'relation' },
  ],
};
