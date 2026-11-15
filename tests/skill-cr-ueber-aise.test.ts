/**
 * CR-GC-938 — Skills lassen Nummer, Status und Kanten des CR von aise und vom Gate bestimmen.
 *
 * Entschieden (FAQ cr-nummer-vergeben, cr-knoten-status, cr-relation-zieltypen, cr-commitref):
 * `aise dispatch prepare` vergibt die Nummer und legt den CR-Knoten an, `aise cr close` setzt den
 * Status, `relation` von CR geht nur auf Typen, die `TRACE_PATTERNS` kennt, `commitRef` gibt es nicht.
 * Die Zieltypen kommen aus `isValidTrace`, keine gepflegte Liste.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isValidTrace, type ElementType } from '@sigloch/contracts/se';

const WURZEL = join(__dirname, '..', '.claude', 'commands');

function skills(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? skills(p) : p.endsWith('.md') ? [p] : [];
  });
}

const DATEIEN = skills(WURZEL).map((p) => ({ name: p.slice(WURZEL.length + 1), text: readFileSync(p, 'utf8') }));
const zeilen = (re: RegExp) =>
  DATEIEN.flatMap((d) => d.text.split('\n').flatMap((z, i) => (re.test(z) ? [`${d.name}:${i + 1}: ${z.trim().slice(0, 90)}`] : [])));

describe('TEST-skill-cr-ueber-aise (CR-GC-938)', () => {
  it('nennt keine CR-Nummer ohne Repo-Praefix als Anweisung', () => {
    expect(zeilen(/(?<![-\w])CR-\d{3}\b/)).toEqual([]);
    expect(zeilen(/next free number|nächste freie Nummer/)).toEqual([]);
  });

  it('schreibt den Status des CR nicht per graph_mutate', () => {
    expect(zeilen(/status: ?"done"|@status\s+(open|done)|`status`: ?"done"/)).toEqual([]);
  });

  it('nennt kein commitRef', () => {
    expect(zeilen(/commitRef/)).toEqual([]);
  });

  it('verlangt keine CR-Kante auf einen Typ, den das Gate ablehnt', () => {
    const kanten = DATEIEN.flatMap((d) =>
      [...d.text.matchAll(/CR\s*(?:-relation->|relation\s*→)\s*`?([A-Z]+)/g)]
        // se-plan nennt `CR -relation-> FCHAIN` als illegal: ein Verbot, keine Anweisung
        .filter((m) => !/illegal/.test(d.text.slice(m.index, m.index + 60)))
        .map((m) => ({ d: d.name, ziel: m[1] })),
    );
    expect(kanten.length).toBeGreaterThan(0);
    for (const k of kanten) {
      expect(isValidTrace({ source: 'CR', target: k.ziel as ElementType, type: 'relation' }), `${k.d}: CR relation ${k.ziel}`).toBe(true);
    }
    // jede Zeile, die eine CR-Kante beschreibt, nennt weder TEST noch FLOW als Ziel
    expect(zeilen(/CR[^.\n]{0,120}`relation`[^.\n]{0,80}\b(TEST|FLOW)\b|`relation`-Kante auf jede REQ und jeden TEST/)).toEqual([]);
  });

  it('zeigt den richtigen Weg: aise dispatch prepare und aise cr close', () => {
    for (const n of ['se-conops.md', 'se-irr.md', 'se-trade.md', 'se-fmea.md', 'se-laufzeit.md', join('se', 'optimize.md')]) {
      const t = DATEIEN.find((d) => d.name === n)!.text;
      expect(t, n).toMatch(/aise dispatch prepare/);
      expect(t, n).toMatch(/aise cr close/);
    }
  });
});
