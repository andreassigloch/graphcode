/**
 * CR-GC-927 — se-plan nennt die Familienregel: hoechstens 10 Dateien je CR, nicht 5.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const plan = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-plan.md'), 'utf8');

describe('TEST-skill-se-plan-dateigrenze (CR-GC-927)', () => {
  it('nennt 10 Dateien je CR an allen vier Stellen', () => {
    expect(plan).toMatch(/cut CRs \(≤10 files\)/);
    expect(plan).toMatch(/grouped ≤10 files/);
    expect(plan).toMatch(/split by REQ if >10 files/);
    expect(plan).toMatch(/Each CR is \*\*≤10 files and implementable in one chat\*\*/);
  });

  it('nennt keine 5-Dateien-Grenze mehr', () => {
    expect(plan).not.toMatch(/≤ ?5 files|> ?5 files/);
  });

  it('Skill-Version ist 14', () => {
    expect(plan).toMatch(/^version: 14$/m);
  });
});
