/**
 * TEST-help-content-coverage (CR-GC-227) — the authored Plain/SE layer covers every
 * live dashboard token, checked against the registries (NOT a hand-count): a new rule,
 * gate, artifact, or ontology token fails this test only if its help entry is missing.
 */
import { describe, it, expect } from 'vitest';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { PHASE_GATE_RULES, IMPL_GATE_MILESTONES } from '../src/kernel/measure/readiness.js';
import { ARTIFACT_CATALOG } from '../src/projections/panels.js';
import { HELP_CONTENT, HELP_VOCAB, HELP_PANEL_IDS, HELP_ELEMENT_STATES, METRIC_HELP } from '../src/projections/help-content.js';
import { helpEntry } from '../src/projections/help.js';
import { METRIC_DIMENSIONS } from '@sigloch/se-engine';
import { ALL_RULE_DEFS, CODE_CONFORMANCE_RULES } from '@sigloch/contracts/se';

const nonEmpty = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

describe('TEST-help-content-coverage (CR-GC-227): authored Plain/SE covers the live dashboard', () => {
  /**
   * CR-GC-487: der VOLLE Katalog, nicht nur `SE_DESCRIPTOR.rules`.
   *
   * Die Deckung lief bis hierher ueber den GATE-Katalog. BW-02, BQ-01/02/04/06/07, ND-01/02
   * und RC-06 stehen dort nicht — acht davon hatten deshalb ueberhaupt keinen Hilfeeintrag,
   * ohne dass etwas rot wurde. BW-02 ist der bitterste Fall: eine der vier messenden Regeln
   * des Chebyshev-Scores, also eine Regel, die STEUERT und sich nicht erklaert.
   */
  it('every rule in the FULL catalogue has a non-empty {plain, se} entry (derived, no hand-count)', () => {
    const ruleIds = [...ALL_RULE_DEFS.map((r) => r.id), ...CODE_CONFORMANCE_RULES.map((r) => r.id)];
    expect(ruleIds.length).toBeGreaterThan(0);
    // Der Gate-Katalog ist eine TEILMENGE davon — bleibt er es nicht, prueft die Zeile darunter
    // etwas anderes als gedacht.
    for (const r of SE_DESCRIPTOR.rules as Array<{ id: string }>) expect(ruleIds).toContain(r.id);
    for (const id of ruleIds) {
      const e = HELP_CONTENT[id];
      expect(e, `HELP_CONTENT missing rule ${id}`).toBeDefined();
      expect(nonEmpty(e?.plain), `${id}.plain`).toBe(true);
      expect(nonEmpty(e?.se), `${id}.se`).toBe(true);
    }
  });

  /**
   * CR-GC-487 — die GEGENRICHTUNG. Elf Eintraege gehoerten zu Regeln, die es nicht mehr gibt
   * (R-03, R-14, R-27, FC-01, SC-04, CR-R04, AO-D01, AO-D03, RT-01, PH-01, CA-01); `AO-D03`
   * stand dort seit CR-SM-283, also drei Wochen. Ein toter Eintrag urteilt nie falsch, er
   * liest sich nur wie eine Regel, die es gibt.
   */
  it('kein Eintrag zu einer Regel, die es nicht mehr gibt', () => {
    const known = new Set([
      ...ALL_RULE_DEFS.map((r) => r.id),
      ...CODE_CONFORMANCE_RULES.map((r) => r.id),
      ...Object.keys(PHASE_GATE_RULES),
      ...Object.keys(IMPL_GATE_MILESTONES),
      ...HELP_PANEL_IDS,
      ...ARTIFACT_CATALOG.map((a) => a.id),
      ...Object.keys(HELP_VOCAB),
      // Die drei Zahlen des Compliance-Kastens haben keine Live-Registry, aus der sie
      // ableitbar waeren — sie stehen nur hier und im Dashboard. Deshalb einmal benannt,
      // statt die Pruefung dafuer aufzuweichen.
      'compliance', 'totalElements', 'elementsWithErrors',
    ]);
    expect(Object.keys(HELP_CONTENT).filter((id) => !known.has(id))).toEqual([]);
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

/**
 * CR-GC-458 — die sechs ℝ⁶-Dimensionen erklären sich wie jede Regel.
 *
 * Sie entscheiden über jede graph_suggest-Empfehlung, stehen im Zielprofil und
 * verlassen seit CR-GC-451 den Host als Ist-Vektor — im Hilfe-Katalog kamen sie
 * nicht vor. `graph_help({token:'coherence'})` antwortete `unknown token`, also
 * schrieb jeder Konsument, der sie erklären wollte, eigene Texte.
 *
 * Abdeckung gegen METRIC_DIMENSIONS aus der Engine, NICHT gegen eine Liste hier:
 * eine siebte Dimension drüben lässt diesen Test fallen, ohne dass ihn jemand anfasst.
 */
describe('TEST-metric-help-coverage (CR-GC-458): jede Zieldimension erklärt sich', () => {
  it('jede Dimension der Engine hat Messung, Zweck und Stellhebel', () => {
    expect(METRIC_DIMENSIONS.length).toBe(6);
    for (const dim of METRIC_DIMENSIONS) {
      const e = METRIC_HELP[dim];
      expect(e, `METRIC_HELP missing dimension ${dim}`).toBeDefined();
      expect(nonEmpty(e?.title), `${dim}.title`).toBe(true);
      expect(nonEmpty(e?.measure), `${dim}.measure`).toBe(true);
      expect(nonEmpty(e?.purpose), `${dim}.purpose`).toBe(true);
      expect(nonEmpty(e?.lever), `${dim}.lever`).toBe(true);
    }
  });

  it('kein Eintrag beschreibt eine Dimension, die es in der Engine nicht gibt', () => {
    const known = new Set<string>(METRIC_DIMENSIONS);
    for (const id of Object.keys(METRIC_HELP)) {
      expect(known.has(id), `METRIC_HELP kennt ${id}, die Engine nicht`).toBe(true);
    }
  });

  it('der Titel ist der Alltagsbegriff, nicht der Enum-Name — sonst erklärt er nichts', () => {
    for (const dim of METRIC_DIMENSIONS) {
      expect(METRIC_HELP[dim]!.title.toLowerCase()).not.toBe(dim.toLowerCase());
    }
  });

  it('helpEntry liefert die Dimension als kind `metric`, mit Skala und den drei Feldern', () => {
    for (const dim of METRIC_DIMENSIONS) {
      const entry = helpEntry(dim);
      expect(entry, `helpEntry('${dim}')`).toBeDefined();
      expect(entry!.kind).toBe('metric');
      expect(entry!.token).toBe(dim);
      expect(entry!.measure).toBe(METRIC_HELP[dim]!.measure);
      expect(entry!.purpose).toBe(METRIC_HELP[dim]!.purpose);
      expect(entry!.lever).toBe(METRIC_HELP[dim]!.lever);
      // Die Skala steht mit in der Antwort — sonst raet der Konsument sie.
      expect(entry!.scale).toEqual({ min: 0, max: 5 });
      // Die eine Aktion, die aus dem Verstaendnis einer Zieldimension folgt.
      expect(entry!.prompt).toBe('se:target-profile');
    }
  });

  it('die zwei klassischen Ebenen bleiben belegt — ein Alt-Konsument sieht kein leeres Feld', () => {
    for (const dim of METRIC_DIMENSIONS) {
      const entry = helpEntry(dim)!;
      expect(nonEmpty(entry.plain), `${dim}.plain`).toBe(true);
      expect(nonEmpty(entry.se), `${dim}.se`).toBe(true);
    }
  });

  it('die bestehenden Token-Arten antworten unveraendert', () => {
    expect(helpEntry('R-04')?.kind).toBe('rule');
    expect(helpEntry('REQ')?.kind).toBe('token');
    expect(helpEntry('readiness')?.kind).toBe('panel');
    expect(helpEntry('gibtesnicht')).toBeUndefined();
  });
});
