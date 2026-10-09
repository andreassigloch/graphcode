/**
 * CR-GC-287 — ND-Matrix-Injektion: die contracts-ND-Regeln (ND-01 FUNC,
 * ND-02 SCHEMA) liefern erst mit injizierter Similarity-Matrix Funde; die
 * Matrizen berechnet graphcode deterministisch nach den Formeln aus den
 * contracts-Kommentaren. Das Gate (V3_RULES+MT via SE_DESCRIPTOR) evaluiert
 * ND NIE — Regression hier mitgeprüft. Der REQ/UC-Hinweis-Pfad des
 * Executor-Preflights (duplicateHits) ist mit CR-GC-775 ausgelagert.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import {
  evaluateAllRules,
  // CR-SM-286: die Aehnlichkeit kommt aus contracts, gecacht je Graph — es gibt keine
  // Setter und keinen Modulzustand mehr, den ein Test aufraeumen muesste.
  funcSimilarity,
  schemaSimilarity,
  tokens,
  jaccard,
  ALL_RULE_DEFS,
  STAGE_SETS,
  type OntologyGraph,
} from '@sigloch/contracts/se';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { generationStep } from '../src/loop/generate.js';

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

  it('Ähnlichkeit: Duplikat-Paar ≥0.85, verschiedenes Paar deutlich darunter', () => {
    // CR-SM-286: die Matrix kommt aus contracts (`similarity.ts`), nicht mehr von hier.
    const { ids, matrix } = funcSimilarity(og);
    expect(ids).toEqual(['FUNC-generate-report', 'FUNC-generate-report-2', 'FUNC-parse-input']);
    expect(matrix[0][1]).toBeGreaterThanOrEqual(0.85);
    expect(matrix[0][2]).toBeLessThan(0.5);
    // symmetrisch, Diagonale 1
    expect(matrix[1][0]).toBeCloseTo(matrix[0][1]);
    expect(matrix[0][0]).toBe(1);
  });

  it('evaluateAllRules meldet ND-01 GENAU für das Duplikat-Paar', () => {
    const nd = evaluateAllRules(og, DEFAULT_METRIC_POLICY).filter((v) => v.rule_id === 'ND-01');
    expect(nd).toHaveLength(1);
    expect(nd[0].element_id).toBe('FUNC-generate-report-2');
    expect(nd[0].message).toContain('FUNC-generate-report');
    expect(nd[0].severity).toBe('warning') // CR-SM-353: ND blockt nie am Gate;
  });

  /**
   * CR-SM-286 / CR-GC-488 — die Umkehrung des Alt-Zustands.
   *
   * Hier stand: „ohne Injektion liefert ND-01 nichts (der Alt-Zustand — leere Hülle)". Genau
   * das war der Defekt: eine `error`-Regel fiel ohne vorbereitete Matrix nach GRÜN, und das
   * war von „keine Duplikate" nicht zu unterscheiden. Es gibt keine Vorbereitung mehr, also
   * ist der einzig richtige Test der gegenteilige.
   */
  it('ohne jede Vorbereitung meldet ND-01 — kein Fail-open mehr', () => {
    expect(evaluateAllRules(og, DEFAULT_METRIC_POLICY).filter((v) => v.rule_id === 'ND-01')).toHaveLength(1);
  });
});

describe('ND-02 — SCHEMA-Near-Duplicates (konstruierte Duplikate)', () => {
  const og: OntologyGraph = {
    elements: [
      // Regelkatalog 42 (CR-SM-399): ND-02 liest die Beschreibung, das Attribut `fields` hat keinen Leser mehr.
      el('SCHEMA-report-request', 'SCHEMA', 'ReportRequest', 'Request payload for a custom report: metricIds, format, userId.'),
      el('SCHEMA-report-req', 'SCHEMA', 'ReportReq', 'Request payload for a custom report: metricIds, format, userId.'),
      el('SCHEMA-audit-entry', 'SCHEMA', 'AuditEntry', 'One immutable audit log line with timestamp, author and verdict.'),
      el('FLOW-report-request', 'FLOW', 'report request', 'Report request flow.'),
    ],
    traces: [
      tr('FLOW-report-request', 'SCHEMA-report-request', 'relation'),
      tr('FLOW-report-request', 'SCHEMA-report-req', 'relation'),
    ],
  } as OntologyGraph;

  it('evaluateAllRules meldet ND-02 für das Paar mit gleicher Beschreibung', () => {
    const { ids: schemaIds, matrix } = schemaSimilarity(og);
    expect(schemaIds[0]).toBe('SCHEMA-audit-entry');
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

  it('ND-01 steht in der Stufe Funktion, ND-02 in der Stufe Schema — und keine ist Abgleich (generate-Fokus kann rotieren)', () => {
    // CR-GC-757: die Stufe der Regel traegt Vorlage und Fokus-Typen des Fensters (vorher: die Dimension arch/schema).
    const regel = (id: string) => ALL_RULE_DEFS.find((r) => r.id === id)!;
    const stufe = (id: string): string => STAGE_SETS[(regel(id).stage as number) - 1]!;
    expect(stufe('ND-01')).toBe('Funktion');
    expect(stufe('ND-02')).toBe('Schema');
    // Profil `conformance` stellt kein Fenster — die ND-Regeln gehoeren nicht dazu.
    expect(regel('ND-01').profile).not.toBe('conformance');
    expect(regel('ND-02').profile).not.toBe('conformance');
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

  it('identische FUNC-Duplikate stehen als ND-01 im Fokus — als warning, blockingErrors bleibt gleich (CR-SM-353)', () => {
    // Die Fenster der Reihe nach (zurueckstellen bis zur Wiederholung): ND-01 ist eines davon —
    // beim differenzierten Paar nie. Ein Fund im Fokus, kein zweites Urteil ueber die Schwere.
    const fenster = (graph: Graph): string[] => {
      const gesehen: string[] = [];
      const keys: string[] = [];
      let s = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
      for (let i = 0; i < 12 && s.focusKey && !keys.includes(s.focusKey); i++) {
        gesehen.push(s.focusKey.split(':')[1]);
        keys.push(s.focusKey);
        s = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
      }
      return gesehen;
    };
    const dup = generationStep(buildGraph('Assemble the selected metrics into a downloadable report document.'), DEFAULT_METRIC_POLICY);
    const distinct = generationStep(buildGraph('Stream raw audit events into the retention archive nightly.'), DEFAULT_METRIC_POLICY);
    expect(dup.blockingErrors).toBe(distinct.blockingErrors);
    expect(fenster(buildGraph('Assemble the selected metrics into a downloadable report document.'))).toContain('ND-01');
    expect(fenster(buildGraph('Stream raw audit events into the retention archive nightly.'))).not.toContain('ND-01');
  });
});
