/**
 * TEST-randbreiten (CR-GC-629) — steuert `boundaryWidth`, und wo?
 *
 * BEFUND (2026-09-23, zehn Familiengraphen): BW-02 folgt NICHT der Zahl der FUNC. moneyflow hat
 * 306 FUNC und null Whiteboxen — die Regel kann dort strukturell nicht feuern. graphcode hat 19
 * Whiteboxen und 16 Befunde, also 84 % seiner eigenen Grundgesamtheit; alle anderen Graphen des
 * eingefrorenen Korpus zusammen: null. Was die Regel misst, ist nicht Groesse, sondern ob
 * ueberhaupt jemand einen `FUNC -compose->`-Baum gebaut hat.
 *
 * Und EIN Knopf treibt ZWEI Verteilungen: `boundaryWidth` urteilt in BW-02 ueber den FUNC-Rand
 * und in R-04 ueber den MOD-Rand. Auf 7 angehoben faellt BW-02 im Korpus auf null, waehrend R-04
 * bei moneyflow Befunde behaelt — mit einer Zahl sind beide nicht zu kalibrieren. Dieser Test
 * DREHT nichts; er haelt den Stand fest, damit die Frage jederzeit beantwortbar ist.
 *
 * WAS GEHALTEN WIRD, und was nicht: nur die EINGEFRORENEN Graphen (`rig/graphs/`, das Golden).
 * Ihre Zahlen koennen sich nur aendern, wenn die Regel oder die Zaehlung wandert — genau das
 * soll auffallen. Der eigene LIVE-Graph wandert mit jedem Modellzug und wird deshalb nur auf
 * Plausibilitaet geprueft, nicht gepinnt; Rig-Laeufe liegen unter `runs/` und sind auf einer
 * frischen Maschine gar nicht da.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { randbreiten, SCHWELLEN } from '../scripts/randbreiten.mjs';

interface Zeile {
  name: string;
  klasse: 'live' | 'snapshot' | 'lauf';
  func: number;
  mod: number;
  wb: number;
  bwUeber: Record<number, number>;
  bwMax: number;
  modUeber: Record<number, number>;
  modMax: number;
}

const REPO = join(__dirname, '..');
const zeilen = randbreiten(REPO) as Zeile[];
const nach = (name: string): Zeile | undefined => zeilen.find((z) => z.name === name);

/**
 * Der gemessene Stand der eingefrorenen Graphen, 2026-09-23 — `FUNC MOD WB | BW>=5 BW>=7 BWmax |
 * MOD>=5 MOD>=7 MODmax`. Die Quelle ist `node scripts/randbreiten.mjs`; wer bewusst neu
 * verankert, faehrt es und schreibt die neue Zahl in den CR, der sie verankert.
 */
const STAND: Record<string, [number, number, number, number, number, number, number, number, number]> = {
  'sigllm-v98 (golden)': [24, 7, 4, 1, 0, 6, 0, 0, 4],
  bok: [12, 4, 3, 0, 0, 3, 0, 0, 3],
  'gc_test-graphview': [24, 7, 0, 0, 0, 0, 0, 0, 3],
  'graph-view-edit': [13, 5, 1, 0, 0, 2, 0, 0, 2],
  graphcode: [115, 7, 20, 12, 9, 19, 6, 6, 16],
  moneyflow: [306, 155, 0, 0, 0, 0, 8, 5, 17],
};

const FELDER = ['FUNC', 'MOD', 'WB', 'BW>=5', 'BW>=7', 'BWmax', 'MOD>=5', 'MOD>=7', 'MODmax'] as const;

const alsVektor = (z: Zeile): number[] => [
  z.func, z.mod, z.wb,
  z.bwUeber[5], z.bwUeber[7], z.bwMax,
  z.modUeber[5], z.modUeber[7], z.modMax,
];

describe('CR-GC-629: die Verteilung wird laufend gemessen, nicht je CR einmal', () => {
  it('das Skript misst ueberhaupt — sonst waere jede leere Erwartung gruen', () => {
    expect(SCHWELLEN).toEqual([5, 7]);
    expect(zeilen.length, 'kein einziger erreichbarer Graph — das Skript findet nichts').toBeGreaterThan(5);
    expect(zeilen.some((z) => z.klasse === 'snapshot')).toBe(true);
    // Mindestens EIN Graph muss Befunde tragen, sonst prueft der Stand unten nur Nullen.
    expect(zeilen.some((z) => z.bwUeber[5] > 0)).toBe(true);
    expect(zeilen.some((z) => z.modUeber[5] > 0)).toBe(true);
  });

  it('jeder eingefrorene Graph steht auf dem gemessenen Stand — und der Fehlertext nennt die Zahl', () => {
    const gewandert: string[] = [];
    for (const [name, erwartet] of Object.entries(STAND)) {
      const z = nach(name);
      if (!z) {
        gewandert.push(`${name}: nicht erreichbar — der Korpus ist unvollstaendig`);
        continue;
      }
      const ist = alsVektor(z);
      ist.forEach((wert, i) => {
        if (wert !== erwartet[i]) gewandert.push(`${name}.${FELDER[i]}: ${erwartet[i]} → ${wert}`);
      });
    }
    expect(
      gewandert,
      'Die Randbreiten-Verteilung hat sich bewegt. Entweder ist die Regel/Zaehlung gewandert ' +
        '(dann ist das der Befund), oder ein eingefrorener Graph wurde neu verankert (dann ' +
        'gehoert die neue Zahl in den CR, der sie verankert). `node scripts/randbreiten.mjs`:',
    ).toEqual([]);
  });

  it('BW-02 folgt der Zahl der WHITEBOXEN, nicht der Zahl der FUNC', () => {
    // Der Befund in einer Zeile: ohne Whitebox kein Befund, egal wie viele FUNC dastehen.
    for (const z of zeilen) {
      if (z.wb === 0) {
        expect(z.bwUeber[5], `${z.name}: ${z.func} FUNC, 0 Whiteboxen — BW-02 kann nicht feuern`).toBe(0);
      }
      expect(z.bwUeber[5], `${z.name}: mehr Befunde als Grundgesamtheit`).toBeLessThanOrEqual(z.wb);
    }
    // Die Spreizung, die den Punkt traegt: der groesste Graph hat die wenigsten BW-02-Befunde.
    const mf = nach('moneyflow')!;
    expect(mf.func).toBeGreaterThan(300);
    expect(mf.wb).toBe(0);
    expect(mf.modUeber[5], 'R-04 feuert dort sehr wohl — dieselbe Schwelle, andere Verteilung').toBeGreaterThan(0);
  });

  it('eine Schwelle von 7 wirkt auf beide Verteilungen VERSCHIEDEN — deshalb zwei Knoepfe, bevor eine gedreht wird', () => {
    const bw5 = zeilen.reduce((a, z) => a + z.bwUeber[5], 0);
    const bw7 = zeilen.reduce((a, z) => a + z.bwUeber[7], 0);
    const mod5 = zeilen.reduce((a, z) => a + z.modUeber[5], 0);
    const mod7 = zeilen.reduce((a, z) => a + z.modUeber[7], 0);
    // Anheben entschaerft BEIDE — aber nicht im selben Mass. Genau das ist der Grund, warum
    // dieser CR misst statt dreht: eine Zahl kann nicht beide Verteilungen treffen.
    expect(bw7).toBeLessThan(bw5);
    expect(mod7).toBeLessThan(mod5);
    expect(bw5 / Math.max(bw7, 1)).not.toBe(mod5 / Math.max(mod7, 1));
  });

  it('der eigene LIVE-Graph wird berichtet, aber nicht gepinnt — er wandert mit jedem Modellzug', () => {
    const live = nach('graphcode (live)');
    expect(live, 'ohne den eigenen SSOT misst das Skript an seinem Hauptfall vorbei').toBeDefined();
    expect(live!.klasse).toBe('live');
    expect(live!.func).toBeGreaterThan(50);
    // Der Befund, der diesen CR ausgeloest hat: graphcode traegt den Loewenanteil aller
    // BW-02-Funde. Solange das gilt, misst die Regel dieses Repo und kaum sonst etwas.
    expect(live!.wb).toBeGreaterThan(0);
  });
});
