/**
 * CR-GC-894 — se-irr prueft jede fremde Quelle mit einer Abfrage, die nur Zahlen liefert.
 *
 * Gemessen in immo-infra (2026-11-07): zwei Laeufe von se-irr fanden die Luecken der fremden Quelle
 * nicht, weil der Skill Annahmen nur in Texten sucht, die schon im Modell stehen. Der Test haelt die
 * Pflichtstellen des neuen Schritts fest: die vier Zaehlgroessen, das Verbot von Inhalten und den
 * Weg ohne Zugang.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const skill = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-irr.md'), 'utf8');
const schritt = skill.slice(skill.indexOf('**Foreign sources.**'), skill.indexOf('## 2.'));

describe('TEST-skill-irr-fremde-quellen (CR-GC-894)', () => {
  it('der Schritt steht in §1, vor der Liste in §2', () => {
    expect(skill.indexOf('**Foreign sources.**')).toBeGreaterThan(skill.indexOf('## 1.'));
    expect(schritt.length).toBeGreaterThan(0);
  });

  it('nennt die Schnittstellen, an denen er sucht', () => {
    expect(schritt).toMatch(/`ACTOR` or external system with an `io` FLOW/);
    expect(schritt).toMatch(/SCHEMA of that FLOW/);
  });

  it('nennt die vier Zaehlgroessen', () => {
    expect(schritt).toMatch(/count per status \/ type/);
    expect(schritt).toMatch(/count of distinct owners/);
    expect(schritt).toMatch(/count of fields that carry a value/);
    expect(schritt).toMatch(/response code per needed endpoint/);
  });

  it('verbietet Inhalte und fuehrt den Weg ohne Zugang', () => {
    expect(schritt).toMatch(/numbers only/);
    expect(schritt).toMatch(/Never names, addresses or free text/);
    expect(schritt).toMatch(/evidence `none`/);
    expect(schritt).toMatch(/`se-conops` \(access list\)/);
  });

  it('jede Abweichung wird eine Zeile der Liste in §2', () => {
    expect(schritt).toMatch(/becomes a line of the list in §2/);
  });
});
