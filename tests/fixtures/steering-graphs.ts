/**
 * Shared steering fixtures (CR-GC-340 / CR-GC-341).
 *
 * The steering proofs are A/B differential tests: two runs, identical except for
 * ONE actuating variable, asserted on the DIFFERENCE and its SIGN. That only means
 * anything if both runs measure the SAME world — so the graphs live here, once,
 * instead of once per test file.
 *
 * `ARCH_FIXTURE` deliberately carries attribute-borne bindings (`realRef`,
 * `testRefs`, `SYS.analysisFreshness`). Those are exactly the attributes the flat
 * export encoding drops (CR-GC-303/324), so a fixture without them cannot detect a
 * regression back onto `JSON.parse(exportGraphJson(...))` — the whole point of T-0.
 *
 * @author andreas@siglochconsulting
 */
import type { HarnessConfig } from '@sigloch/contracts/harness';

/** Elements accept arbitrary extra keys — the importer folds them into `attributes`. */
export interface FixtureElement {
  id: string;
  type: string;
  name: string;
  description: string;
  [attribute: string]: unknown;
}

export interface FixtureTrace {
  source: string;
  target: string;
  type: string;
  [attribute: string]: unknown;
}

export interface FixtureGraph {
  elements: FixtureElement[];
  traces: FixtureTrace[];
}

/** One harness config shape for every steering test — same scope, same timeouts. */
export function makeSteeringConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'steering-ws', systemId: 'steering-sys' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

/**
 * The architecture fixture: a small but complete arch layer (MOD/FUNC/FLOW/SCHEMA)
 * plus the process elements whose rules carry an executable fix template
 * (`CR-R01`, `UC-02`, `MS-03` in `@sigloch/se-engine`'s FIX_TEMPLATES) — without
 * at least one of those, `graph_suggest` has findings but nothing to apply, and
 * T-C2 (apply the top suggestion for real) has no subject.
 *
 * Attribute-borne bindings on purpose:
 *  - `FUNC-parse.realRef`      → R-20 satisfied here, unsatisfied on FUNC-render
 *  - `TEST-parse.testRefs`     → R-19 satisfied here, unsatisfied on TEST-render
 *  - `SYS.analysisFreshness`   → AF-01/AF-02 satisfied, AF-03..05 not
 * A path that flattens attributes flips every one of those judgements.
 */
export const ARCH_FIXTURE: FixtureGraph = {
  elements: [
    {
      id: 'SYS-steering',
      type: 'SYS',
      name: 'Steering reference system',
      description: 'Fixture system for the steering causality proofs.',
      analysisFreshness: { conops: { graphVersion: 1 }, trade: { graphVersion: 1 } },
    },
    { id: 'ACTOR-operator', type: 'ACTOR', name: 'Operator', description: 'Drives the system.' },
    { id: 'ACTOR-auditor', type: 'ACTOR', name: 'Auditor', description: 'Reads the audit trail.' },

    { id: 'UC-ingest', type: 'UC', name: 'Operator ingests a document', description: 'Operator submits a document and receives a parsed result.' },
    { id: 'UC-review', type: 'UC', name: 'Auditor reviews a result', description: 'Auditor opens a parsed result and confirms or rejects it.' },

    { id: 'REQ-parse-accuracy', type: 'REQ', name: 'Parse accuracy', description: 'The parser resolves at least 95 percent of the fields it claims to support.' },
    { id: 'REQ-render-latency', type: 'REQ', name: 'Render latency', description: 'A parsed result renders in under 300 ms at reference size.' },

    {
      id: 'TEST-parse',
      type: 'TEST',
      name: 'Parse accuracy test',
      description: 'Runs the parser over the reference corpus and asserts the field recall.',
      testRefs: [{ file: 'tests/fixtures/steering-graphs.ts', case: 'parse accuracy', tool: 'vitest', level: 'unit' }],
    },
    {
      id: 'TEST-render',
      type: 'TEST',
      name: 'Render latency test',
      description: 'Measures render wall time at reference size and asserts the budget.',
    },

    {
      id: 'FUNC-parse',
      type: 'FUNC',
      name: 'parse()',
      description: 'Turns a raw document into a structured result.',
      realRef: { file: 'tests/fixtures/steering-graphs.ts', symbol: 'ARCH_FIXTURE', lang: 'ts' },
    },
    { id: 'FUNC-render', type: 'FUNC', name: 'render()', description: 'Turns a structured result into a view model.' },
    { id: 'FUNC-audit', type: 'FUNC', name: 'audit()', description: 'Appends the operation to the audit trail.' },

    { id: 'FLOW-document', type: 'FLOW', name: 'raw document', description: 'The unparsed input document.' },
    { id: 'FLOW-result', type: 'FLOW', name: 'parsed result', description: 'The structured parse result.' },

    { id: 'SCHEMA-result', type: 'SCHEMA', name: 'ParsedResult', description: 'Shape of the structured parse result.', realRef: { file: 'tests/fixtures/steering-graphs.ts', symbol: 'FixtureGraph', lang: 'ts' } },

    { id: 'MOD-parsing', type: 'MOD', name: 'parsing', description: 'Everything that turns documents into results.' },
    { id: 'MOD-presentation', type: 'MOD', name: 'presentation', description: 'Everything that turns results into views.' },

    { id: 'CR-1', type: 'CR', name: 'Speed up rendering', description: 'Reworks FUNC-render so the latency budget holds.' },
    { id: 'MS-1', type: 'MS', name: 'MS-1 first release', description: 'The first shippable increment.' },
  ],
  traces: [
    { source: 'SYS-steering', target: 'UC-ingest', type: 'compose' },
    { source: 'SYS-steering', target: 'UC-review', type: 'compose' },

    { source: 'ACTOR-operator', target: 'UC-ingest', type: 'io' },
    // ACTOR-auditor has NO io trace to UC-review on purpose — that is the UC-02
    // finding whose fix template T-C2 applies for real.

    { source: 'UC-ingest', target: 'REQ-parse-accuracy', type: 'compose' },
    { source: 'UC-review', target: 'REQ-render-latency', type: 'compose' },

    { source: 'TEST-parse', target: 'REQ-parse-accuracy', type: 'verify' },
    { source: 'TEST-render', target: 'REQ-render-latency', type: 'verify' },

    { source: 'FUNC-parse', target: 'REQ-parse-accuracy', type: 'satisfy' },
    { source: 'FUNC-render', target: 'REQ-render-latency', type: 'satisfy' },

    { source: 'FUNC-parse', target: 'MOD-parsing', type: 'allocate' },
    { source: 'FUNC-render', target: 'MOD-presentation', type: 'allocate' },
    // FUNC-audit is deliberately unallocated — R-22 fires (finding without template).

    { source: 'FUNC-parse', target: 'FLOW-document', type: 'io' },
    { source: 'FUNC-parse', target: 'FLOW-result', type: 'io' },
    { source: 'FUNC-render', target: 'FLOW-result', type: 'io' },

    { source: 'FLOW-result', target: 'SCHEMA-result', type: 'relation' },
    // FLOW-document has no SCHEMA — SC-02/SC-04 fire.
  ],
};

// ---------------------------------------------------------------------------
// The gate/artifact fixture (CR-GC-353 T-B4)
// ---------------------------------------------------------------------------

/**
 * One open finding per phase gate, each of which a RENDERED VIEW marks as a gap —
 * the subject of T-B4 ("the artifacts are process output, not decoration").
 *
 *   SRR · R-16  ACTOR-auditor has no io into a UC      → conops §3
 *   PDR · R-22  FUNC-audit is allocated to no module   → architecture
 *   CDR · R-26  SCHEMA-envelope carries no realRef     → icd
 *   TRR · R-01  REQ-audit-trail is verified by nothing → rtm + testmatrix
 *
 * Built ON TOP of `ARCH_FIXTURE` rather than beside it: `scriptedActor` repairs
 * against fixed anchors (`UC-ingest`, `MOD-parsing`), so the gate fixture must be a
 * world that actuator already lives in. Extending instead of editing also keeps
 * T-B3/T-B5 measuring the graph they were calibrated on — a fixture edit there
 * would silently move the ratchet's baseline.
 *
 * Each of the four is the ONLY violation of its rule in this graph, which is what
 * makes the coupling assertion ("marked in the document" = "open at the gate") an
 * equality instead of a subset.
 */
export const GATE_FIXTURE: FixtureGraph = {
  elements: [
    ...ARCH_FIXTURE.elements,
    {
      id: 'SCHEMA-envelope',
      type: 'SCHEMA',
      name: 'DocumentEnvelope',
      description: 'Shape of the raw document envelope carried into the parser.',
      // No realRef, and neither `external` nor `concept` — so the ICD prints the
      // R-26 warning rather than the legitimate "defined elsewhere" note.
    },
    {
      id: 'REQ-audit-trail',
      type: 'REQ',
      name: 'Audit trail completeness',
      description: 'Every accepted mutation appends exactly one record to the audit trail.',
    },
  ],
  traces: [
    ...ARCH_FIXTURE.traces,
    { source: 'FLOW-document', target: 'SCHEMA-envelope', type: 'relation' },
    { source: 'SYS-steering', target: 'REQ-audit-trail', type: 'compose' },
    { source: 'FUNC-audit', target: 'REQ-audit-trail', type: 'satisfy' },
    // Deliberately NO `TEST -verify-> REQ-audit-trail` — that is the R-01 finding.
  ],
};

/** The four (gate, rule, element) triples `GATE_FIXTURE` opens, in lifecycle order. */
export const GATE_FINDINGS = [
  { gate: 'SRR', ruleId: 'R-16', elementId: 'ACTOR-auditor' },
  { gate: 'PDR', ruleId: 'R-22', elementId: 'FUNC-audit' },
  { gate: 'CDR', ruleId: 'R-26', elementId: 'SCHEMA-envelope' },
  { gate: 'TRR', ruleId: 'R-01', elementId: 'REQ-audit-trail' },
] as const;

// ---------------------------------------------------------------------------
// The scripted actuator (CR-GC-341 T-B3)
// ---------------------------------------------------------------------------

/**
 * A focus key as `generationStep` emits it: `${dimension}:${ruleId}:${elementIds}`.
 * The driver hands the host exactly this, so parsing it here is not reaching into
 * internals — it is consuming the published steering signal.
 */
export interface ParsedFocus {
  dimension: string;
  ruleId: string;
  elementIds: string[];
}

export function parseFocusKey(focusKey: string): ParsedFocus {
  const [dimension, ruleId, ids] = focusKey.split(':');
  return { dimension, ruleId, elementIds: ids ? ids.split(',').filter(Boolean) : [] };
}

/**
 * The scripted actuator: focus finding → the canonical repair batch for its RULE.
 *
 * Deliberately DUMB. It carries no judgement, no retry, no repair of its own
 * mistakes — it only writes what the rule's own `fix_hint` and the matching
 * `GENERATION_TEMPLATE` in `src/generate.ts` already prescribe. The moment it
 * starts deciding, the ratchet test measures the actuator instead of the
 * controller, which is the one thing it must not do.
 *
 * Returns `null` for a rule it has no canonical batch for — the caller records
 * that as "the actuator could not act", never as progress.
 */
/**
 * The run binding for a TEST the actuator creates. ONE FILE PER TEST — R-29 is an
 * ERROR-level rule ("a test file belongs to at most one TEST"), so handing every
 * generated TEST the same path made the gate reject the whole batch. Measured in
 * CR-GC-353: the R-01 repair was refused because `TEST-parse` already claimed
 * `steering-graphs.ts`. The collision was an artefact of the actuator, not a
 * finding about the controller — a dumb actuator may write dull bindings, but not
 * illegal ones.
 */
const testRefFor = (uid: string, testCase: string) => [
  { file: `tests/fixtures/generated/${uid}.test.ts`, case: testCase, tool: 'vitest', level: 'unit' },
];

export function scriptedActor(focus: ParsedFocus, seq: number): unknown[] | null {
  const { ruleId, elementIds } = focus;
  const cmds: unknown[] = [];
  const node = (uid: string, type: string, name: string, description: string, attributes: Record<string, unknown> = {}) => ({
    op: 'add-node',
    node: { uid, type, name, description, attributes },
  });
  const edge = (sourceId: string, edgeType: string, targetId: string) => ({
    op: 'add-edge',
    edge: { sourceId, targetId, edgeType, attributes: {} },
  });

  switch (ruleId) {
    // A UC without requirements: give each one a requirement AND the test that
    // verifies it, in the SAME batch — a REQ without a verify-TEST is R-01, and
    // the gate would block the whole batch (the invariant the template states).
    case 'UC-01':
    case 'R-14':
      for (const uc of elementIds) {
        const req = `REQ-${uc}-${seq}`;
        const test = `TEST-${uc}-${seq}`;
        cmds.push(node(req, 'REQ', `Requirement for ${uc}`, `The system shall complete ${uc} within the agreed service window.`));
        cmds.push(
          node(test, 'TEST', `Test for ${uc}`, `Exercises ${uc} end to end and asserts the agreed service window.`, {
            testRefs: testRefFor(test, uc),
          }),
        );
        cmds.push(edge(test, 'verify', req));
        cmds.push(edge(uc, 'compose', req));
      }
      return cmds;

    // A REQ nobody verifies — add the test, nothing else.
    case 'R-01':
    case 'R-05':
      for (const req of elementIds) {
        const test = `TEST-${req}-${seq}`;
        cmds.push(
          node(test, 'TEST', `Test for ${req}`, `Asserts the acceptance criterion stated in ${req}.`, {
            testRefs: testRefFor(test, req),
          }),
        );
        cmds.push(edge(test, 'verify', req));
      }
      return cmds;

    // A FUNC that satisfies no requirement.
    case 'R-02':
      for (const fn of elementIds) {
        const req = `REQ-${fn}-${seq}`;
        const test = `TEST-${fn}-${seq}`;
        cmds.push(node(req, 'REQ', `Requirement behind ${fn}`, `${fn} shall produce its documented result for every accepted input.`));
        cmds.push(
          node(test, 'TEST', `Test for ${fn}`, `Drives ${fn} over the accepted input set and asserts the documented result.`, {
            testRefs: testRefFor(test, fn),
          }),
        );
        cmds.push(edge(test, 'verify', req));
        cmds.push(edge(fn, 'satisfy', req));
      }
      return cmds;

    // A FUNC allocated to no module.
    case 'R-22':
      for (const fn of elementIds) cmds.push(edge(fn, 'allocate', 'MOD-parsing'));
      return cmds;

    // An ACTOR with no io into a use case.
    case 'R-16':
    case 'UC-02':
      for (const id of elementIds) cmds.push(edge(id, 'io', 'UC-ingest'));
      return cmds;

    // A FLOW with no data contract.
    case 'SC-02':
    case 'SC-04':
      for (const flow of elementIds) {
        const schema = `SCHEMA-${flow}-${seq}`;
        cmds.push(
          node(schema, 'SCHEMA', `Shape of ${flow}`, `The data contract carried by ${flow}.`, {
            realRef: { file: 'tests/fixtures/steering-graphs.ts', symbol: 'FixtureGraph', lang: 'ts' },
          }),
        );
        cmds.push(edge(flow, 'relation', schema));
      }
      return cmds;

    // A SCHEMA or FUNC without its realization binding — attribute only, no topology.
    case 'R-20':
    case 'R-26':
      for (const id of elementIds) {
        cmds.push({
          op: 'update-node',
          node: {
            uid: id,
            attributes: { realRef: { file: 'tests/fixtures/steering-graphs.ts', symbol: 'FixtureGraph', lang: 'ts' } },
          },
        });
      }
      return cmds;

    // A TEST with no runnable binding — attribute only.
    case 'R-19':
      for (const id of elementIds) {
        cmds.push({
          op: 'update-node',
          node: {
            uid: id,
            attributes: { testRefs: testRefFor(id, id) },
          },
        });
      }
      return cmds;

    // A judgement artifact with no freshness stamp — attribute on the SYS anchor.
    // The actuator only STAMPS; it does not pretend to have done the thinking. That
    // is the honest model of what the rule checks (presence, never content).
    case 'AF-01':
    case 'AF-02':
    case 'AF-03':
    case 'AF-04':
    case 'AF-05': {
      // All five stamps at once, on purpose: attribute merge is per TOP-LEVEL key,
      // so writing `analysisFreshness: {implplan}` REPLACES the object and unstamps
      // conops/trade — one rule cleared, two re-opened. Measured, not assumed.
      const stamps: Record<string, { graphVersion: number }> = {};
      for (const artifact of Object.values(AF_ARTIFACT)) stamps[artifact] = { graphVersion: seq + 1 };
      cmds.push({ op: 'update-node', node: { uid: 'SYS-steering', attributes: { analysisFreshness: stamps } } });
      return cmds;
    }

    // A CR with no milestone / no affected element.
    case 'MS-01':
    case 'MS-03':
      for (const id of elementIds) cmds.push(edge(id.startsWith('CR-') ? id : 'CR-1', 'relation', 'MS-1'));
      return cmds;

    case 'CR-R01':
    case 'CR-R04':
      for (const cr of elementIds) cmds.push(edge(cr, 'relation', 'FUNC-render'));
      return cmds;

    // A UC with no scenario chain: give it a chain and decompose the chain into steps.
    case 'UC-03':
    case 'FC-02':
      for (const uc of elementIds) {
        const chain = `FCHAIN-${uc}-${seq}`;
        cmds.push(node(chain, 'FCHAIN', `Scenario of ${uc}`, `The ordered steps that carry out ${uc}.`));
        cmds.push(edge(uc, 'compose', chain));
      }
      return cmds;

    // An empty scenario chain — hang the existing functions off it as its steps.
    case 'R-15':
      for (const chain of elementIds) {
        for (const fn of ['FUNC-parse', 'FUNC-render']) cmds.push(edge(chain, 'compose', fn));
      }
      return cmds;

    // A pre/postcondition requirement the use case never states.
    case 'UC-05':
    case 'UC-06': {
      const kind = ruleId === 'UC-05' ? 'postcondition' : 'precondition';
      for (const uc of elementIds) {
        const req = `REQ-${uc}-${kind}-${seq}`;
        const test = `TEST-${uc}-${kind}-${seq}`;
        cmds.push(
          node(req, 'REQ', `${kind} of ${uc}`, `On completing ${uc} the system shall hold the stated ${kind}.`, { kinds: [kind] }),
        );
        cmds.push(
          node(test, 'TEST', `Test of the ${kind} of ${uc}`, `Asserts the ${kind} of ${uc} after the scenario runs.`, {
            testRefs: testRefFor(test, `${uc}-${kind}`),
          }),
        );
        cmds.push(edge(test, 'verify', req));
        cmds.push(edge(uc, 'compose', req));
      }
      return cmds;
    }

    // A scenario chain with no entry/exit flow to the outside world.
    case 'FC-01':
    case 'FC-04':
      // Only the ACTOR entry: a `FCHAIN io FLOW` edge is NOT a legal trace pattern
      // (R-18 blocks it — the gate said so, which is itself the point of T-A1).
      cmds.push(edge('ACTOR-operator', 'io', 'FLOW-document'));
      return cmds;

    // An element the system root never composes.
    case 'R-17':
      for (const id of elementIds) cmds.push(edge('SYS-steering', 'compose', id));
      return cmds;

    default:
      return null;
  }
}

/** Which analysis artifact each AF rule stamps. */
const AF_ARTIFACT: Record<string, string> = {
  'AF-01': 'conops',
  'AF-02': 'trade',
  'AF-03': 'assumption-review',
  'AF-04': 'fmea',
  'AF-05': 'implplan',
};
