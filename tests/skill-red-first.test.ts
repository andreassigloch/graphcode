/**
 * TEST-skill-red-first (CR-GC-697) — verifies REQ-test-skill-red-first: die Test-Skills
 * se-test und se-test-ui lehren Red-First — ein Test zaehlt erst, wenn er aus dem
 * richtigen Grund rot gesehen wurde.
 *
 * Beide FUNCs sind prompt-realisiert (realRef = die Skill-Datei): der Text IST die
 * Realisierung. Geprueft wird deshalb der ausgelieferte Text, und zwar die drei Teile,
 * ohne die die Regel leer waere: den Fehlerfall vorher benennen, rot sehen, und zwar aus
 * GENAU diesem Grund.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SKILLS = ['se-test.md', 'se-test-ui.md'];

function text(name: string): string {
  return readFileSync(join(__dirname, '..', '.claude', 'commands', name), 'utf8');
}

describe('TEST-skill-red-first: se-test und se-test-ui lehren Red-First', () => {
  it.each(SKILLS)('%s verlangt, den Test aus dem richtigen Grund rot zu sehen', (name) => {
    const t = text(name);
    expect(t).toMatch(/red-first/i);
    expect(t, 'rot sehen, bevor gruen zaehlt').toMatch(/observe\s+it\s+red\s+for\s+(?:exactly\s+)?that\s+reason/i);
    expect(t, 'ein Test, der gegen kaputten Code gruen ist, zaehlt nicht').toMatch(/must\s+fail\s+on\s+the\s+(?:current\s+)?\(?broken\)?\s+code/i);
  });

  it('Positivkontrolle — ein Skill ohne die Regel faellt durch', () => {
    const ohne = 'Write a test and make it pass.';
    expect(ohne).not.toMatch(/observe\s+it\s+red\s+for\s+(?:exactly\s+)?that\s+reason/i);
  });
});
