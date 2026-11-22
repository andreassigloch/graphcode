/**
 * Der Erzeuger des Berichts von graph_readiness parst ihn an der Grenze (CR-GC-1006,
 * FAQ erzeuger-parst-vertrag): `readinessOf` prüft seine Ausgabe gegen `ReadinessReportSchema`
 * und gibt das Original zurück. Echte Funktion, echte Eingabe.
 */
import { describe, it, expect } from 'vitest';
import { ReadinessReportSchema } from '@sigloch/graphcode-client';
import { readinessOf, type Evaluation, type Finding } from '../src/kernel/evaluation.js';

function evaluation(findings: Finding[]): Evaluation {
  return { findings, skipped: [], notInGate: [], importCoverage: null, callCoverage: null } as Evaluation;
}

const echterBefund = {
  ruleId: 'R-01',
  severity: 'error',
  message: 'REQ-x has no verifying TEST',
  elementId: 'REQ-x',
  source: 'rules',
} as Finding;

describe('readinessOf parst seine Ausgabe (CR-GC-1006)', () => {
  it('ein Befund liefert einen Bericht, den das Schema annimmt, mit Marken in fester Reihenfolge', () => {
    const bericht = readinessOf(evaluation([echterBefund]));
    expect(ReadinessReportSchema.safeParse(bericht).success).toBe(true);
    expect(bericht.marks.map((m) => m.id)).toEqual(['SRR', 'PDR', 'CDR', 'TRR', 'Bau']);
    expect(bericht.violationsByRule['R-01']).toBe(1);
  });

  it('ein Befund mit unbekannter Schwere wird abgelehnt, nicht durchgereicht', () => {
    const kaputt = { ...echterBefund, severity: 'fatal' } as unknown as Finding;
    expect(() => readinessOf(evaluation([kaputt]))).toThrow();
  });
});
