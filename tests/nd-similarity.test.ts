/**
 * CR-GC-287 — ND-Matrix-Injektion: die contracts-ND-Regeln (ND-01 FUNC,
 * ND-02 SCHEMA) liefern erst mit injizierter Similarity-Matrix Funde; die
 * Matrizen berechnet graphcode deterministisch nach den Formeln aus den
 * contracts-Kommentaren. Das Gate (V3_RULES+MT via SE_DESCRIPTOR) evaluiert
 * ND NIE — Regression hier mitgeprüft. Reale Duplikate aus den
 * Greenfield-Läufen (haiku45 / devstral-v14) dienen als Fixtures für den
 * REQ/UC-Hinweis-Pfad (duplicateHints, contracts-frei, keine Regel).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  evaluateAllRules,
  setND01SimilarityMatrix,
  setND02SimilarityMatrix,
  RULE_TO_DIMENSION,
  type OntologyGraph,
} from '@sigloch/contracts/se';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import {
  tokens,
  jaccard,
  nameDescrSimilarity,
  computeND01Matrix,
  computeND02Matrix,
  injectNDMatrices,
  duplicateHints,
  HINT_SIMILARITY_THRESHOLD,
} from '../src/nd-similarity.js';
import { generationStep } from '../src/generate.js';

const fixture = (name: string): OntologyGraph =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../rig/greenfield-systemtest/results/${name}.graph.json`, import.meta.url)), 'utf8'),
  ) as OntologyGraph;

// Modul-State der contracts-Regeln nach jedem Test zurücksetzen.
afterEach(() => {
  setND01SimilarityMatrix(null);
  setND02SimilarityMatrix(null);
});

const el = (id: string, type: string, name: string, description: string, attributes?: Record<string, unknown>) =>
  ({ id, type, name, description, ...(attributes ? { attributes } : {}) }) as OntologyGraph['elements'][number];
const tr = (source: string, target: string, type: string) => ({ source, target, type }) as OntologyGraph['traces'][number];

describe('nd-similarity — Grundbausteine', () => {
  it('tokens: lowercase, Unicode-Wörter ≥3 Zeichen', () => {
    expect(tokens('Der User exportiert Graph-Stand v2!')).toEqual(
      new Set(['der', 'user', 'exportiert', 'graph', 'stand']),
    );
    expect(tokens(undefined).size).toBe(0);
  });

  it('jaccard: identisch=1, disjunkt=0, ∅/∅=1', () => {
    const a = new Set(['eins', 'zwei']);
    expect(jaccard(a, new Set(a))).toBe(1);
    expect(jaccard(a, new Set(['drei']))).toBe(0);
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(a, new Set(['zwei', 'drei']))).toBeCloseTo(1 / 3);
  });
});

describe('ND-01 — FUNC-Near-Duplicates (konstruierte Duplikate)', () => {
  // Zwei FUNCs: gleiches Verb, identische Beschreibung, gleiche io-Partner,
  // gleiches satisfy-REQ ⇒ Similarity 1.0. Eine dritte, klar verschiedene FUNC.
  const og: OntologyGraph = {
    elements: [
      el('FUNC-generate-report', 'FUNC', 'Generate custom report', 'Assemble the selected metrics into a downloadable report document.'),
      el('FUNC-generate-report-2', 'FUNC', 'Generate tailored report', 'Assemble the selected metrics into a downloadable report document.'),
      el('FUNC-parse-input', 'FUNC', 'Parse uploaded input', 'Validate and normalize the uploaded source file before processing.'),
      el('FLOW-report-data', 'FLOW', 'report data', 'Metric rows for the report.'),
      el('REQ-report', 'REQ', 'Report generation', 'The system must generate a report from selected metrics.'),
    ],
    traces: [
      tr('FLOW-report-data', 'FUNC-generate-report', 'io'),
      tr('FLOW-report-data', 'FUNC-generate-report-2', 'io'),
      tr('FUNC-generate-report', 'REQ-report', 'satisfy'),
      tr('FUNC-generate-report-2', 'REQ-report', 'satisfy'),
    ],
  } as OntologyGraph;

  it('Matrix: Duplikat-Paar ≥0.85, verschiedenes Paar deutlich darunter', () => {
    const { funcIds, matrix } = computeND01Matrix(og);
    expect(funcIds).toEqual(['FUNC-generate-report', 'FUNC-generate-report-2', 'FUNC-parse-input']);
    expect(matrix[0][1]).toBeGreaterThanOrEqual(0.85);
    expect(matrix[0][2]).toBeLessThan(0.5);
    // symmetrisch, Diagonale 1
    expect(matrix[1][0]).toBeCloseTo(matrix[0][1]);
    expect(matrix[0][0]).toBe(1);
  });

  it('injectNDMatrices ⇒ evaluateAllRules meldet ND-01 GENAU für das Duplikat-Paar', () => {
    injectNDMatrices(og);
    const nd = evaluateAllRules(og, DEFAULT_METRIC_POLICY).filter((v) => v.rule_id === 'ND-01');
    expect(nd).toHaveLength(1);
    expect(nd[0].element_id).toBe('FUNC-generate-report-2');
    expect(nd[0].message).toContain('FUNC-generate-report');
    expect(nd[0].severity).toBe('error');
  });

  it('ohne Injektion liefert ND-01 nichts (der Alt-Zustand — leere Hülle)', () => {
    expect(evaluateAllRules(og, DEFAULT_METRIC_POLICY).filter((v) => v.rule_id === 'ND-01')).toHaveLength(0);
  });
});

describe('ND-02 — SCHEMA-Near-Duplicates (konstruierte Duplikate)', () => {
  const og: OntologyGraph = {
    elements: [
      el('SCHEMA-report-request', 'SCHEMA', 'ReportRequest', 'Request payload for a custom report.', { fields: ['metricIds', 'format', 'userId'] }),
      el('SCHEMA-report-req', 'SCHEMA', 'ReportReq', 'Request payload for a tailored report.', { fields: ['metricIds', 'format', 'userId'] }),
      el('SCHEMA-audit-entry', 'SCHEMA', 'AuditEntry', 'One immutable audit log line with author and verdict.', { fields: ['timestamp', 'author', 'verdict'] }),
      el('FLOW-report-request', 'FLOW', 'report request', 'Report request flow.'),
    ],
    traces: [
      tr('FLOW-report-request', 'SCHEMA-report-request', 'relation'),
      tr('FLOW-report-request', 'SCHEMA-report-req', 'relation'),
    ],
  } as OntologyGraph;

  it('injectNDMatrices ⇒ evaluateAllRules meldet ND-02 für das Feld-identische Paar', () => {
    const { schemaIds, matrix } = computeND02Matrix(og);
    expect(schemaIds[0]).toBe('SCHEMA-audit-entry');
    injectNDMatrices(og);
    const nd = evaluateAllRules(og, DEFAULT_METRIC_POLICY).filter((v) => v.rule_id === 'ND-02');
    expect(nd).toHaveLength(1);
    expect(nd[0].message).toContain('SCHEMA-report-req');
    expect(matrix.every((row) => row.every((v) => v >= 0 && v <= 1))).toBe(true);
  });
});

describe('Gate-Regression — ND ist NIE Gate-Regel (AK 2)', () => {
  it('SE_DESCRIPTOR (V3_RULES+MT, die Gate-Engine) enthält keine ND-Regel', () => {
    const ids = (SE_DESCRIPTOR.rules ?? []).map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => id.startsWith('ND-'))).toHaveLength(0);
  });

  it('RULE_TO_DIMENSION mappt ND-01→arch, ND-02→schema (generate-Fokus kann rotieren)', () => {
    expect(RULE_TO_DIMENSION['ND-01']).toBe('arch');
    expect(RULE_TO_DIMENSION['ND-02']).toBe('schema');
  });
});

describe('generate-Fokus sieht ND (AK 3)', () => {
  const node = (uid: string, type: string, name: string, description: string) => ({ uid, type, name, description, attributes: {} });
  const edge = (sourceId: string, targetId: string, edgeType: string) => ({ sourceId, targetId, edgeType, attributes: {} });
  const buildGraph = (secondDescr: string): Graph =>
    ({
      nodes: [
        node('SYS-app', 'SYS', 'App', 'Ein System, das Reports erzeugt und exportiert.'),
        node('FUNC-generate-report', 'FUNC', 'Generate custom report', 'Assemble the selected metrics into a downloadable report document.'),
        node('FUNC-generate-report-2', 'FUNC', 'Generate tailored report', secondDescr),
        node('FLOW-report-data', 'FLOW', 'report data', 'Metric rows for the report.'),
      ],
      edges: [
        edge('FLOW-report-data', 'FUNC-generate-report', 'io'),
        edge('FLOW-report-data', 'FUNC-generate-report-2', 'io'),
      ],
    }) as unknown as Graph;

  it('identische FUNC-Duplikate erhöhen blockingErrors um genau 1 vs. differenzierte', () => {
    const dup = generationStep(buildGraph('Assemble the selected metrics into a downloadable report document.'), DEFAULT_METRIC_POLICY);
    const distinct = generationStep(buildGraph('Stream raw audit events into the retention archive nightly.'), DEFAULT_METRIC_POLICY);
    expect(dup.blockingErrors).toBe(distinct.blockingErrors + 1);
  });
});

describe('duplicateHints — reale Duplikate aus den Greenfield-Läufen (AK 1)', () => {
  it('haiku45: REQ-Paar (mit/ohne messbarem Kriterium) liegt über der Hinweis-Schwelle', () => {
    const og = fixture('gc-run-haiku45');
    const a = og.elements.find((e) => e.id === 'REQ-batch-atomicity-all-or-nothing');
    const b = og.elements.find((e) => e.id === 'REQ-batch-atomicity-measurable');
    expect(a && b).toBeTruthy();
    expect(nameDescrSimilarity(a!, b!)).toBeGreaterThanOrEqual(HINT_SIMILARITY_THRESHOLD);
  });

  it('haiku45: neuer Duplikat-REQ-add-node löst den Hinweis auf das Bestandselement aus', () => {
    const og = fixture('gc-run-haiku45');
    const index = og.elements.map((e) => ({ uid: e.id, type: e.type, name: e.name, description: e.description }));
    const dup = og.elements.find((e) => e.id === 'REQ-batch-atomicity-measurable')!;
    const batch = {
      commands: [
        { op: 'add-node', node: { uid: 'REQ-neu', type: 'REQ', name: dup.name, description: dup.description } },
      ],
    };
    const hints = duplicateHints(batch, index);
    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain('REQ-neu ähnlich vorhanden');
    expect(hints[0]).toContain('REQ-batch-atomicity');
    expect(hints[0]).toContain('mergen oder differenzieren');
  });

  it('devstral-v14: UC-Export-Paar löst den Hinweis aus, FUNC/fremde Typen nicht', () => {
    const og = fixture('gc-run-devstral-v14');
    const index = og.elements
      .filter((e) => e.id !== 'UC-export-flow')
      .map((e) => ({ uid: e.id, type: e.type, name: e.name, description: e.description }));
    const flow = og.elements.find((e) => e.id === 'UC-export-flow')!;
    const hints = duplicateHints(
      { commands: [{ op: 'add-node', node: { uid: 'UC-export-flow', type: 'UC', name: flow.name, description: flow.description } }] },
      index,
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain('UC-export-graph');
  });

  it('unähnliche neue Elemente, Nicht-REQ/UC-Typen und kaputter Input ⇒ keine Hinweise', () => {
    const index = [{ uid: 'UC-login', type: 'UC', name: 'Login', description: 'User meldet sich an.' }];
    expect(
      duplicateHints(
        { commands: [{ op: 'add-node', node: { uid: 'UC-export', type: 'UC', name: 'Export graph', description: 'User downloads the governed graph as Format-E.' } }] },
        index,
      ),
    ).toHaveLength(0);
    expect(
      duplicateHints(
        { commands: [{ op: 'add-node', node: { uid: 'FUNC-login', type: 'FUNC', name: 'Login', description: 'User meldet sich an.' } }] },
        index,
      ),
    ).toHaveLength(0);
    expect(duplicateHints({ formatE: '### UC' }, index)).toHaveLength(0);
    expect(duplicateHints(null, index)).toHaveLength(0);
  });
});
