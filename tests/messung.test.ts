/**
 * `npm run messung` (CR-GC-679) — der Runner-Kern gegen feste Eingabe.
 *
 * Geprueft wird, was der Runner selbst entscheidet: jede S1-Test-ID aus Leitlinie §9.4 hat eine
 * Zeile (sonst Wurf), jede Zeile traegt einen Stempel, und die Regel-Matrix ist gegen den
 * Regelkatalog aktuell (T-H2) — eine Matrix ohne RC-08/09 macht die Zeile rot. Die Adapter der
 * einzelnen Skripte laufen im Aufruf selbst; ihre Zahlen stehen in `docs/messung/stand.md`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error — Mess-Skript in .mjs, bewusst ohne Typdeklaration
import { S1, regelMatrixAktuell, urteilT_H2, renderStand, medianAusLog } from '../scripts/messung.mjs';

const zeile = (id: string) => ({ id, kriterium: 'k', wert: '1', urteil: 'bestanden', datum: '2026-09-27', stempel: 's' });

describe('messung: Runner-Kern', () => {
  it('fuehrt genau die S1-Test-IDs der Leitlinie §9.4', () => {
    const leitlinie = readFileSync('docs/graphcode_leitlinie.md', 'utf8');
    const s1 = leitlinie.split('\n').find((z) => z.startsWith('| **S1 deterministisch**'));
    const ids = s1?.split('|').at(-2)?.match(/T-[A-Z]\d+/g) ?? [];
    expect(ids.length).toBeGreaterThan(5);
    expect([...S1].sort()).toEqual([...ids].sort());
  });

  it('wirft, wenn eine S1-Test-ID keine Zeile hat', () => {
    const alle = S1.map(zeile);
    expect(renderStand(alle, 'stempel')).toContain('| T-H2 |');
    expect(() => renderStand(alle.filter((z: { id: string }) => z.id !== 'T-H2'), 'stempel')).toThrow(/T-H2/);
  });

  it('wirft, wenn eine Zeile keinen Stempel traegt', () => {
    const alle = S1.map(zeile);
    alle[0].stempel = '';
    expect(() => renderStand(alle, 'stempel')).toThrow(/Stempel/);
  });

  it('T-H2: eine Matrix ohne RC-08/09 ist nicht bestanden, eine mit fremder ID auch', () => {
    const katalog = ['R-01', 'RC-08', 'RC-09'];
    const matrix = (ids: string[]) => ids.map((id) => `| ${id} | Name | Gate | warning |`).join('\n');
    expect(regelMatrixAktuell(matrix(['R-01']), katalog)).toEqual({ fehlt: ['RC-08', 'RC-09'], unbekannt: [] });
    expect(urteilT_H2(regelMatrixAktuell(matrix(['R-01']), katalog)).urteil).toBe('nicht bestanden');
    expect(regelMatrixAktuell(matrix([...katalog, 'X-99']), katalog)).toEqual({ fehlt: [], unbekannt: ['X-99'] });
    expect(urteilT_H2(regelMatrixAktuell(matrix(katalog), katalog)).urteil).toBe('bestanden');
  });

  it('T-E8: liest den Median des genannten Messpunkts, nicht die erste Fundstelle', () => {
    const log = [
      '[SPIKE live-size, 974 nodes] median total=1030.8ms (1.06 ms/node)',
      '[SPIKE calibration, 500 nodes] median total=256.5ms (0.51 ms/node)',
    ].join('\n');
    expect(medianAusLog(log, 'calibration')).toEqual({ knoten: 500, ms: 256.5 });
    expect(medianAusLog(log, 'live-size')).toEqual({ knoten: 974, ms: 1030.8 });
    expect(medianAusLog(log, 'fixed')).toBeNull();
  });
});
