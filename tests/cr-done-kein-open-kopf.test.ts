/**
 * CR-GC-930 — der Ordner entscheidet, ob ein CR offen oder erledigt ist. Ein CR in `docs/cr/done/`
 * nennt sich im Kopf nicht „Open": 27 taten es, und neun Prüfer wussten nicht, ob der CR gilt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DONE = join(__dirname, '..', 'docs', 'cr', 'done');

/** Dateien, deren Kopf (erste 10 Zeilen) eine Status-Zeile trägt, die mit „Open" beginnt. */
export function offenImKopf(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => readFileSync(join(dir, f), 'utf8').split('\n').slice(0, 10)
      .some((z) => /^\*\*Status:?\*\*:?\s*open\b/i.test(z)))
    .sort();
}

describe('TEST-cr-done-kein-open-kopf (CR-GC-930)', () => {
  it('kein CR in docs/cr/done nennt sich im Kopf Open', () => {
    expect(offenImKopf(DONE)).toEqual([]);
  });
});
