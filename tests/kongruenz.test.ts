/**
 * CR-GC-574/740 — das dreiwertige Code-Urteil und die Bindungsquote (`scripts/kongruenz.mjs`), rein geprueft.
 * Leser ist `scripts/messung.mjs` (T-V4); die Tests kamen aus dem Systemtest-Rig mit, als es fiel.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — Messskript in .mjs, bewusst ohne Typdeklaration
import { binding, codeVerdict } from '../scripts/kongruenz.mjs';

describe('kongruenz: Bindungsquote und Code-Urteil', () => {
  it('die Bindungsquote zaehlt BLATT-FUNCs — ein Elter ohne realRef ist keine Luecke', () => {
    const graph = {
      elements: [
        { id: 'FUNC-elter', type: 'FUNC' },
        { id: 'FUNC-a', type: 'FUNC', realRef: { file: 'src/a.ts' } },
        { id: 'FUNC-b', type: 'FUNC', attributes: { realRef: { file: 'src/b.ts' } } },
        { id: 'FUNC-c', type: 'FUNC' },
      ],
      traces: [
        { source: 'FUNC-elter', target: 'FUNC-a', type: 'compose' },
        { source: 'FUNC-elter', target: 'FUNC-b', type: 'compose' },
      ],
    };
    // Blatt sind a, b, c — nicht der Elter. Zwei von dreien sind gebunden.
    expect(binding(graph)).toEqual({ leafFuncs: 3, bound: 2, pct: 67 });
  });

  it('das Code-Urteil ist dreiwertig und nennt IMMER seine Reichweite', () => {
    const graph = { elements: [{ id: 'FUNC-a', type: 'FUNC', realRef: { file: 'src/a.ts' } }], traces: [] };
    const reichweite = { endpoints: 10, assigned: 9 };

    const nichtPruefbar = codeVerdict({ skipped: ['rule:RC-01'], importCoverage: reichweite }, graph);
    expect(nichtPruefbar.verdict).toBe('nicht pruefbar');
    expect(nichtPruefbar.why).toContain('RC-01');

    const gedriftet = codeVerdict({ skipped: [], violationsByRule: { 'RC-02': 3, 'R-20': 7 }, importCoverage: reichweite }, graph);
    expect(gedriftet.verdict).toBe('gedriftet');
    expect(gedriftet.rcViolations).toEqual({ 'RC-02': 3 });

    const kongruent = codeVerdict({ skipped: [], violationsByRule: { 'R-20': 7 }, importCoverage: reichweite }, graph);
    expect(kongruent.verdict).toBe('kongruent');
    // Der Kern: auch das gruene Urteil traegt die Reichweite — ein Gate, das ohne Bindung "gruen" meldet,
    // ist schlimmer als keins.
    expect(kongruent.reach.pct).toBe(90);
    expect(kongruent.binding.pct).toBe(100);
    expect(kongruent.why).toContain('90 % Reichweite');

    // Ohne Bindung und ohne aufloesbare Quelldatei gibt es nichts zu pruefen — kein falsches Gruen.
    const leer = codeVerdict({ skipped: [], violationsByRule: {}, importCoverage: { endpoints: 0, assigned: 0 } }, { elements: [], traces: [] });
    expect(leer.verdict).toBe('nicht pruefbar');
  });
});
