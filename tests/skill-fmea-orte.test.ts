/**
 * CR-GC-774 — der Skill `se-fmea` liest die Orte einer Wirkkette aus `graph_metrics` und rechnet
 * kein eigenes Kettenprofil (eine Rechnung, nicht zwei: `chainMetrics` in `@sigloch/contracts/se`).
 *
 * Gemessen 2026-10-10: das von Hand gerechnete Profil des Skills (Linearität, Importgrad) widersprach
 * `chainMetrics` an allen 10 Ketten mit Rückkopplung, und der Importgrad ergab bis zu 29 Pflichtstellen
 * je Kette. Der Test bindet den Skill-Text an das Schema: nennt der Text ein Feld, das `ChainMetrics`
 * nicht trägt, ist er rot.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chainMetrics } from '@sigloch/contracts/se';

const skill = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-fmea.md'), 'utf8');

/** Eine bewertbare Kette mit Kreislauf, damit jede Ortsliste des Schemas ein Feld der Zeile ist. */
const graph = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'x' }, { id: 'UC-x', type: 'UC', name: 'x' },
    { id: 'FCHAIN-x', type: 'FCHAIN', name: 'x' }, { id: 'ACTOR-a', type: 'ACTOR', name: 'a' },
    { id: 'FUNC-a', type: 'FUNC', name: 'a' }, { id: 'FUNC-b', type: 'FUNC', name: 'b' },
    { id: 'FLOW-in', type: 'FLOW', name: 'in' }, { id: 'FLOW-ab', type: 'FLOW', name: 'ab' },
    { id: 'FLOW-ba', type: 'FLOW', name: 'ba' }, { id: 'FLOW-out', type: 'FLOW', name: 'out' },
    { id: 'MOD-m', type: 'MOD', name: 'm' },
  ],
  traces: [
    { source: 'SYS-x', target: 'UC-x', type: 'compose' }, { source: 'UC-x', target: 'FCHAIN-x', type: 'compose' },
    { source: 'FCHAIN-x', target: 'FUNC-a', type: 'compose' }, { source: 'FCHAIN-x', target: 'FUNC-b', type: 'compose' },
    { source: 'ACTOR-a', target: 'FLOW-in', type: 'io' }, { source: 'FLOW-in', target: 'FUNC-a', type: 'io' },
    { source: 'FUNC-a', target: 'FLOW-ab', type: 'io' }, { source: 'FLOW-ab', target: 'FUNC-b', type: 'io' },
    { source: 'FUNC-b', target: 'FLOW-ba', type: 'io' }, { source: 'FLOW-ba', target: 'FUNC-a', type: 'io' },
    { source: 'FUNC-b', target: 'FLOW-out', type: 'io' }, { source: 'FLOW-out', target: 'ACTOR-a', type: 'io' },
    { source: 'FUNC-a', target: 'MOD-m', type: 'allocate' }, { source: 'FUNC-b', target: 'MOD-m', type: 'allocate' },
  ],
} as unknown as Parameters<typeof chainMetrics>[0];

/** Die Ortsfelder, die der Skill je Kette liest. */
const ORTE = ['memberCount', 'fanIn', 'loops', 'shared', 'boundaries', 'imports', 'handovers'];

describe('se-fmea liest die Orte, er rechnet sie nicht (CR-GC-774)', () => {
  it('der Skill-Text traegt keine Rechenvorschrift fuer eine Kettenkennzahl', () => {
    expect(skill).not.toMatch(/Linearität/);
    expect(skill).not.toMatch(/Importgrad/);
    expect(skill, 'kein Quotient im Text').not.toContain('÷');
  });

  it('der Skill holt das Profil aus graph_metrics', () => {
    expect(skill).toMatch(/`graph_metrics`/);
    for (const feld of ORTE) expect(skill, `Ortsfeld ${feld}`).toContain(`\`${feld}`);
  });

  it('jedes Ortsfeld, das der Skill nennt, traegt die bewertbare Zeile von chainMetrics', () => {
    const kette = chainMetrics(graph).chains[0] as Record<string, unknown>;
    expect(kette.measurable, 'Praemisse: die Probekette ist bewertbar').toBe(true);
    for (const feld of ORTE) expect(kette, `chainMetrics ohne ${feld}`).toHaveProperty(feld);
  });

  it('der erste Schritt ist die Verdrahtung, und eine nicht bewertbare Kette wird nicht analysiert', () => {
    expect(skill).toMatch(/measurable: false/);
    for (const regel of ['R-30', 'R-31', 'R-21', 'IO-01', 'FC-04', 'FC-05']) expect(skill, regel).toContain(regel);
  });

  it('die Reichweite geht nicht in die Schwere', () => {
    expect(skill).toMatch(/Reichweite[^\n]*nicht[^\n]*(Schwere|Severity)/i);
  });
});
