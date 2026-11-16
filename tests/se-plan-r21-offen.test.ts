/**
 * CR-GC-952 — se-plan nimmt einen R-21-Befund nicht ab.
 *
 * Entschieden: Architekturregeln sind nicht abnehmbar (`ABNEHMBAR` in `src/kernel/measure/focus-set.ts`),
 * `se/close-violations` sagt dasselbe. Der Befund bleibt offen, bis Modell oder Code ihn schließt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ABNEHMBAR } from '../src/kernel/measure/focus-set.js';

const plan = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-plan.md'), 'utf8');

describe('TEST-se-plan-r21-offen (CR-GC-952)', () => {
  it('Prämisse: R-21 ist nicht abnehmbar', () => {
    expect(ABNEHMBAR.has('R-21')).toBe(false);
  });

  it('se-plan lässt den R-21-Befund offen, statt ihn abzunehmen', () => {
    expect(plan).not.toMatch(/keep the accepted R-21 finding/);
    expect(plan).toMatch(/the R-21 finding stays open \(no `acceptedFindings`; architecture rules are not acceptable\)/);
    expect(plan).toMatch(/you name the pair in the output as open work/);
  });

  it('se-plan nennt den Weg, den Befund zu schließen: Modell-Zug oder Code', () => {
    expect(plan).toMatch(/closes only by a model move or by code/);
  });

  it('se-plan lässt keine abgenommenen Funde zum Schnitt zu', () => {
    expect(plan).not.toMatch(/or named accepted findings/);
  });
});
