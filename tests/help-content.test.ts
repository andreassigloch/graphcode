/**
 * TEST-help-content-coverage (CR-GC-227) — the authored Plain/SE layer covers every
 * live dashboard token, checked against the registries (NOT a hand-count): a new rule,
 * gate, artifact, or ontology token fails this test only if its help entry is missing.
 */
import { describe, it, expect } from 'vitest';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { PHASE_GATE_RULES, IMPL_GATE_MILESTONES } from '../src/readiness.js';
import { ARTIFACT_CATALOG } from '../src/viewer/panels.js';
import { HELP_CONTENT, HELP_VOCAB, HELP_PANEL_IDS, HELP_ELEMENT_STATES } from '../src/viewer/help-content.js';

const nonEmpty = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

describe('TEST-help-content-coverage (CR-GC-227): authored Plain/SE covers the live dashboard', () => {
  it('every live V3_RULES rule id has a non-empty {plain, se} entry (derived, no hand-count)', () => {
    const ruleIds = (SE_DESCRIPTOR.rules as Array<{ id: string }>).map((r) => r.id);
    expect(ruleIds.length).toBeGreaterThan(0);
    for (const id of ruleIds) {
      const e = HELP_CONTENT[id];
      expect(e, `HELP_CONTENT missing rule ${id}`).toBeDefined();
      expect(nonEmpty(e?.plain), `${id}.plain`).toBe(true);
      expect(nonEmpty(e?.se), `${id}.se`).toBe(true);
    }
  });

  it('every phase + implementation gate id is covered (from readiness.ts, not hand-listed)', () => {
    const gateIds = [...Object.keys(PHASE_GATE_RULES), ...Object.keys(IMPL_GATE_MILESTONES)];
    expect(gateIds).toEqual(['SRR', 'PDR', 'CDR', 'TRR', 'SAR', 'FCA', 'SVR', 'FRR']);
    for (const id of gateIds) {
      expect(HELP_CONTENT[id], `HELP_CONTENT missing gate ${id}`).toBeDefined();
      expect(nonEmpty(HELP_CONTENT[id]?.plain) && nonEmpty(HELP_CONTENT[id]?.se)).toBe(true);
    }
  });

  it('every dashboard panel id is covered', () => {
    for (const id of HELP_PANEL_IDS) {
      expect(HELP_CONTENT[id], `HELP_CONTENT missing panel ${id}`).toBeDefined();
      expect(nonEmpty(HELP_CONTENT[id]?.plain) && nonEmpty(HELP_CONTENT[id]?.se)).toBe(true);
    }
  });

  it('every artifact id is covered (from ARTIFACT_CATALOG, CR-GC-222)', () => {
    expect(ARTIFACT_CATALOG.length).toBeGreaterThan(0);
    for (const a of ARTIFACT_CATALOG) {
      const e = HELP_CONTENT[a.id];
      expect(e, `HELP_CONTENT missing artifact ${a.id}`).toBeDefined();
      expect(nonEmpty(e?.plain) && nonEmpty(e?.se), `${a.id} plain/se`).toBe(true);
    }
  });

  it('the Vocabulary covers every ontology element + trace token, plus depends-on', () => {
    const elementTokens = Object.keys(SE_DESCRIPTOR.nodeTypes);
    const traceTokens = Object.keys(SE_DESCRIPTOR.edgeTypes);
    expect(elementTokens.length).toBeGreaterThan(0);
    expect(traceTokens.length).toBeGreaterThan(0);
    for (const t of [...elementTokens, ...traceTokens, 'depends-on']) {
      const v = HELP_VOCAB[t];
      expect(v, `HELP_VOCAB missing token ${t}`).toBeDefined();
      expect(nonEmpty(v?.plain) && nonEmpty(v?.se), `${t} plain/se`).toBe(true);
    }
  });

  it('no HELP_CONTENT entry is half-authored (both layers always present)', () => {
    for (const [id, e] of Object.entries(HELP_CONTENT)) {
      expect(nonEmpty(e.plain), `${id}.plain`).toBe(true);
      expect(nonEmpty(e.se), `${id}.se`).toBe(true);
    }
    expect(nonEmpty(HELP_ELEMENT_STATES)).toBe(true);
  });
});
