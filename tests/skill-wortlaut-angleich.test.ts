/**
 * CR-GC-945 — drei Skill-Wortlaute folgen FAQ und Regel.
 *
 * Entschieden (FAQ systemparameter, flows-zusammenlegen, sync-async-ablage; Regeln ND-01/ND-02 in
 * `@sigloch/contracts/se`). Je berichtigtem Satz ein Test.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = join(__dirname, '..', '.claude', 'commands');
const lies = (...p: string[]) => readFileSync(join(C, ...p), 'utf8');
const conops = lies('se-conops.md');
const closeV = lies('se', 'close-violations.md');
const laufzeit = lies('se-laufzeit.md');
const authorReq = lies('se', 'author-req.md');
const version = (t: string) => Number(t.match(/^version: (\d+)$/m)![1]);

describe('TEST-skill-wortlaut-angleich (CR-GC-945)', () => {
  it('Prämisse: se:author-req nennt den Aufrufwert als vierte Werteklasse', () => {
    expect(authorReq).toMatch(/\*call value\*/);
  });

  it('se-conops nennt wie se:author-req vier Werteklassen, mit dem Aufrufwert', () => {
    expect(conops).toMatch(/which invariants, which call values/);
  });

  it('se:close-violations wendet die Ähnlichkeitsschwelle nicht auf FLOWs an', () => {
    expect(closeV).not.toMatch(/same SCHEMA or similarity from 0\.85/);
    expect(closeV).toMatch(/No rule measures the similarity of FLOWs: ND-01 measures FUNC, ND-02 measures SCHEMA/);
  });

  it('se-laufzeit hebt die Ablage nicht hervor; es zählt, ob der Abnehmer wartet', () => {
    expect(laufzeit).not.toMatch(/gehaltenen Zustands \(Store, Ablage\)/);
    expect(laufzeit).toMatch(/Ob der Abnehmer beim Aufruf wartet, entscheidet den Wert, nicht die Art des Glieds/);
  });

  it('die berichtigten Skills tragen eine höhere Version als vorher', () => {
    expect(version(conops)).toBeGreaterThanOrEqual(9);
    expect(version(closeV)).toBeGreaterThanOrEqual(7);
    expect(version(laufzeit)).toBeGreaterThanOrEqual(5);
  });
});
