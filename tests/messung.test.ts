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
import { S1, WEITERE, ZEILEN, regelMatrixAktuell, urteilT_H2, urteilT_O1, urteilT_M3, renderStand, medianAusLog } from '../scripts/messung.mjs';
import { mitVorwert, parseStand, alsStand, kalenderwoche, wochenTabelle, crsMitLoeschung, wertLoeschung, zeileLoeschung, wertDauer } from '../scripts/messung-stand.mjs';

const zeile = (id: string) => ({ id, nr: '—', kriterium: 'k', wert: '1', urteil: 'bestanden', datum: '2026-09-27', seit: '2026-09-27', vorwert: null as string | null, stempel: 's' });

describe('messung: Runner-Kern', () => {
  it('fuehrt genau die S1-Test-IDs der Leitlinie §9.4 (CR-GC-948, CR-GC-951)', () => {
    const leitlinie = readFileSync('docs/graphcode_leitlinie.md', 'utf8');
    const s1 = leitlinie.split('\n').find((z) => z.startsWith('| **S1 deterministisch**'));
    const ids = s1?.split('|').at(-2)?.match(/T-[A-Z]\d+/g) ?? [];
    expect(ids.length).toBeGreaterThan(5);
    expect([...S1].sort()).toEqual([...ids].sort());
    expect([...ZEILEN].sort()).toEqual([...S1, ...WEITERE].sort());
  });

  it('wirft, wenn eine S1-Test-ID keine Zeile hat', () => {
    const alle = [...S1, ...WEITERE].map(zeile);
    expect(renderStand(alle, 'stempel')).toContain('| T-H2 |');
    expect(() => renderStand(alle.filter((z: { id: string }) => z.id !== 'T-H2'), 'stempel')).toThrow(/T-H2/);
  });

  // CR-GC-767: T-O1 steht im Messstand, obwohl die S1-Zeile der Leitlinie es nicht nennt.
  it('T-O1 hat eine Zeile im Messstand und fehlt nicht still', () => {
    const alle = [...S1, ...WEITERE].map(zeile);
    expect(WEITERE).toContain('T-O1');
    expect(renderStand(alle, 'stempel')).toContain('| T-O1 |');
    expect(() => renderStand(S1.map(zeile), 'stempel')).toThrow(/T-O1/);
  });

  it('T-O1: bestanden erst mit reproduzierter Referenzkette UND ≥ 90 % bewertbaren Ketten', () => {
    const basis = { posOk: true, negOk: true, chains: 10, measurable: 9, graphen: 2, nullKennzahlen: ['syncDepth'] };
    expect(urteilT_O1(basis)).toEqual({
      wert: 'Referenzkette reproduziert; 9 von 10 Ketten bewertbar (90 %, 2 Graphen); nicht gerechnet: syncDepth',
      urteil: 'bestanden',
    });
    expect(urteilT_O1({ ...basis, measurable: 8 }).urteil).toBe('nicht bestanden');
    // Die Gegenprobe schlaegt nicht um: die Zahl stimmt dann nur zufaellig.
    expect(urteilT_O1({ ...basis, negOk: false })).toMatchObject({ urteil: 'nicht bestanden', wert: expect.stringContaining('NICHT reproduziert') });
    // Kein Korpus ist keine 100 %.
    expect(urteilT_O1({ ...basis, chains: 0, measurable: 0 })).toMatchObject({ urteil: 'nicht bestanden', wert: expect.stringContaining('keine Kette') });
  });

  it('wirft, wenn eine Zeile keinen Stempel traegt', () => {
    const alle = [...S1, ...WEITERE].map(zeile);
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

describe('T-M3 (CR-GC-946): Fehler und Marken, die Befunde je Stufe als Wert', () => {
  const stand = (short: string, errors: number, reached: string[], plan: number, system: number) => ({
    short,
    errors,
    marks: ['SRR', 'PDR'].map((id) => ({ id, reached: reached.includes(id) })),
    stages: [{ name: 'System', findings: system }, { name: 'Plan', findings: plan }],
  });

  it('besteht bei 0 Fehlern und gehaltenen Marken; der Plan wachsend aendert das Urteil nicht', () => {
    const r = urteilT_M3([stand('a', 0, ['SRR'], 10, 5), stand('b', 0, ['SRR', 'PDR'], 200, 3)]);
    expect(r.urteil).toBe('bestanden');
    expect(r.wert).toContain('Befunde ohne Plan 5 → 3');
    expect(r.wert).toContain('Plan 10 → 200');
  });

  it('besteht nicht bei einem Fehler', () => {
    expect(urteilT_M3([stand('a', 0, ['SRR'], 0, 1), stand('b', 1, ['SRR'], 0, 1)]).urteil).toBe('nicht bestanden');
  });

  it('besteht nicht, wenn eine erreichte Marke zurueckfaellt, und nennt den Stand', () => {
    const r = urteilT_M3([stand('a', 0, ['SRR', 'PDR'], 0, 1), stand('b', 0, ['SRR'], 0, 1)]);
    expect(r.urteil).toBe('nicht bestanden');
    expect(r.wert).toContain('PDR bei b');
  });
});

describe('stand.md (CR-GC-948): Vorwert, seit wann, Wochentabelle', () => {
  const lauf = (wert: string, datum: string) => ZEILEN.map((id) => ({ ...zeile(id), wert, datum, seit: datum }));

  it('ein zweiter Lauf nennt je Groesse den Vorwert des ersten', () => {
    const erster = mitVorwert(lauf('A', '2026-11-01'), null);
    expect(erster.every((z: { vorwert: string | null }) => z.vorwert === null)).toBe(true);
    // Der Weg ueber die Datei: stand.json des ersten Laufs ist die Eingabe des zweiten.
    const vorher = parseStand(JSON.stringify(alsStand(erster, 'stempel')));
    const zweiter = mitVorwert(lauf('B', '2026-11-08'), vorher);
    for (const id of ZEILEN) expect(zweiter.find((z: { id: string }) => z.id === id)).toMatchObject({ vorwert: 'A', wert: 'B', seit: '2026-11-08' });
  });

  it('seit bleibt, solange Wert und Urteil gleich sind, und springt, wenn eines sich aendert', () => {
    const vorher = parseStand(JSON.stringify(alsStand(mitVorwert(lauf('A', '2026-11-01'), null), 'stempel')));
    const gleich = mitVorwert(lauf('A', '2026-11-08'), vorher);
    expect(gleich[0]).toMatchObject({ vorwert: 'A', seit: '2026-11-01', datum: '2026-11-08' });
    const anderesUrteil = mitVorwert(lauf('A', '2026-11-08').map((z) => ({ ...z, urteil: 'nicht bestanden' })), vorher);
    expect(anderesUrteil[0].seit).toBe('2026-11-08');
  });

  it('eine neue Zeile hat keinen Vorwert, die alten behalten ihren', () => {
    const vorher = parseStand(JSON.stringify(alsStand(mitVorwert(lauf('A', '2026-11-01').slice(1), null), 'stempel')));
    const r = mitVorwert(lauf('B', '2026-11-08'), vorher);
    expect(r[0].vorwert).toBeNull();
    expect(r[1].vorwert).toBe('A');
  });

  it('stand.json mit unbekanntem Urteil wird nicht gelesen', () => {
    const kaputt = JSON.stringify({ stempel: 's', zeilen: [{ ...zeile('T-H2'), urteil: 'nicht erhoben' }] });
    expect(() => parseStand(kaputt)).toThrow();
  });

  it('die Datei traegt Vorwert und Wochentabelle, und kein „nicht erhoben"', () => {
    const md = renderStand(mitVorwert(lauf('B', '2026-11-08'), parseStand(JSON.stringify(alsStand(mitVorwert(lauf('A', '2026-11-01'), null), 's')))), 'stempel',
      [{ woche: '2026-W45', datum: '2026-11-08', stand: 'abc1234', marken: 'SRR PDR', ohnePlan: 7, plan: 40 }]);
    expect(md).toContain('| Nr | Zeile | Kriterium | Wert | Vorwert | Seit |');
    expect(md).toContain('| 2026-W45 | 2026-11-08 | abc1234 | SRR PDR | 7 | 40 |');
    expect(md).not.toMatch(/nicht erhoben|679B/);
  });

  it('kalenderwoche: ISO-Zaehlung an den Jahresgrenzen', () => {
    expect(kalenderwoche('2026-11-15')).toBe('2026-W46');
    expect(kalenderwoche('2026-01-01')).toBe('2026-W01');
    expect(kalenderwoche('2027-01-01')).toBe('2026-W53');
    expect(kalenderwoche('2024-12-30')).toBe('2025-W01');
  });

  it('wochenTabelle: der letzte Stand je Woche, Plan getrennt, Marken benannt', () => {
    const st = (ts: string, short: string, marks: string[], plan: number, rest: number) => ({
      ts, short,
      marks: ['SRR', 'PDR'].map((id) => ({ id, reached: marks.includes(id) })),
      stages: [{ name: 'Modul', findings: rest }, { name: 'Test', findings: 1 }, { name: 'Plan', findings: plan }],
    });
    const t = wochenTabelle([
      st('2026-11-10T09:00:00+01:00', 'b', ['SRR', 'PDR'], 30, 5),
      st('2026-11-09T09:00:00+01:00', 'a', ['SRR'], 10, 9),
      st('2026-11-16T09:00:00+01:00', 'c', ['SRR'], 0, 2),
    ]);
    expect(t).toEqual([
      { woche: '2026-W46', datum: '2026-11-10', stand: 'b', marken: 'SRR PDR', ohnePlan: 6, plan: 30 },
      { woche: '2026-W47', datum: '2026-11-16', stand: 'c', marken: 'SRR', ohnePlan: 3, plan: 0 },
    ]);
  });

  it('Nr 12: je CR eine Aussage ueber alle Sitzungen; ohne Protokoll und ohne Loeschung zaehlt der CR nicht', () => {
    const z = (cr: string, sitzung: string | null, geloescht: number, impact: number) => ({ cr, datum: '2026-11-0' + cr.slice(-1), sitzung, geloeschteDateien: geloescht, impact });
    const rows = [z('CR-1', 'a', 2, 0), z('CR-1', 'b', 2, 3), z('CR-2', 'a', 1, 0), z('CR-3', 'a', 0, 5), z('CR-4', null, 4, 0)];
    expect(crsMitLoeschung(rows).map((c: { cr: string; impact: boolean }) => [c.cr, c.impact])).toEqual([['CR-1', true], ['CR-2', false]]);
    expect(wertLoeschung(rows)).toContain('1 von 2 CRs mit Löschung riefen graph_impact');
    expect(wertLoeschung([])).toBe('kein CR mit Löschung im Protokoll');
  });

  it('Nr 12: ohne das lokale Protokoll steht „nicht gemessen" mit Grund, kein Abbruch (CR-GC-951)', () => {
    for (const inhalt of [null, '', '\n']) {
      const z = zeileLoeschung(inhalt);
      expect(z.wert).toMatch(/^nicht gemessen: .*cr-messung\.jsonl/);
      expect(z.extra).toEqual({ stempel: 'keine Messung' });
    }
    const zeilen = [
      { cr: 'CR-1', datum: '2026-11-01T10:00:00Z', commit: 'aaa', geloeschteDateien: 1, sitzung: 's', impact: 1 },
      { cr: 'CR-2', datum: '2026-11-02T10:00:00Z', commit: 'bbb', geloeschteDateien: 0, sitzung: 's', impact: 0 },
    ];
    const z = zeileLoeschung(zeilen.map((x) => JSON.stringify(x)).join('\n') + '\n');
    expect(z.wert).toContain('1 von 1 CRs mit Löschung riefen graph_impact');
    expect(z.extra).toEqual({ datum: '2026-11-02', stempel: 'commit bbb' });
  });

  it('Nr 9: eine Zeile der Spur VOLL gibt keine Dauer, denn Auswahl und Volllauf waeren dieselbe Zahl', () => {
    const z = (cr: string, spur: string, a: number, v: number) => ({ cr, spur, dauer: { auswahlMs: a, vollMs: v } });
    expect(wertDauer([z('CR-1', 'CODE', 100000, 300000), z('CR-2', 'VOLL', 300000, 300000)])).toBe('Auswahl 100 s gegen Volllauf 300 s, Rechenzeit (CR-1)');
    expect(wertDauer([z('CR-2', 'VOLL', 300000, 300000)])).toBeNull();
  });
});
