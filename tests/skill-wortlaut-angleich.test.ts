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
const bau = lies('se-bau.md');

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

/**
 * CR-GC-974 — ein Wert mit Einschränkung ist ein PARAM: Name, Wert, Einschränkung, in genau einer
 * Anforderung. Fünf Wege, woher der Wert kommt; wo die Einschränkung geprüft wird; wer entscheidet.
 * Die drei Skills tragen denselben Inhalt.
 */
describe('TEST-skill-wortlaut-angleich (CR-GC-974): PARAM als Konvention', () => {
  it('se:author-req: PARAM ist Name, Wert und Einschränkung, in genau einer Anforderung', () => {
    expect(authorReq).toMatch(/parameter \(PARAM\): name, value, restriction/);
    expect(authorReq).toMatch(/in exactly one requirement/);
    expect(authorReq).toMatch(/A value without a restriction is not a parameter/);
  });

  it('se:author-req nennt fünf Wege, woher der Wert kommt', () => {
    for (const weg of ['runtime parameter', 'start configuration', 'invariant', 'call value', 'computed']) {
      expect(authorReq, weg).toContain(`*${weg}*`);
    }
  });

  it('se:author-req nennt, wo die Einschränkung geprüft wird, und wer entscheidet', () => {
    expect(authorReq).toMatch(/checked: in code, in the contract or in a test/);
    expect(authorReq).toMatch(/What the requirement names is binding/);
    expect(authorReq).toMatch(/Only the author of the requirement sets or lifts \*invariant\*/);
  });

  it('se-conops fragt nach allen fünf Wegen und nach dem Ort der Prüfung', () => {
    expect(conops).toMatch(/which invariants, which call values/);
    expect(conops).toMatch(/which are computed/);
    expect(conops).toMatch(/where each restriction is checked/);
  });

  it('se-bau führt den Aufrufwert als Klasse und den berechneten Wert als fünfte Zeile', () => {
    expect(bau).not.toMatch(/Aufrufwert \(keine Klasse\)/);
    const zeilen = bau.split('\n').filter((z) => z.startsWith('| '));
    for (const k of ['Laufzeit-Parameter', 'Start-Konfiguration', 'Invariante', 'Aufrufwert', 'Berechneter Wert']) {
      expect(zeilen.some((z) => z.startsWith(`| ${k} |`)), k).toBe(true);
    }
  });

  it('se-bau: der Umsetzer wählt eine fehlende Klasse, nie die Invariante, und nennt die Wahl', () => {
    expect(bau).toMatch(/Nennt die Anforderung keine Klasse, wählst du/);
    expect(bau).toMatch(/nie Invariante/);
    expect(bau).toMatch(/Der Abschlussbericht nennt jede Wahl/);
  });

  it('se-bau: der Koordinator schreibt die gewählte Klasse in die Anforderung', () => {
    expect(bau).toMatch(/gewählte Klasse[^.\n]*se:author-req[^.\n]*Anforderung/);
  });

  it('die drei Skills tragen eine höhere Version als vorher', () => {
    expect(version(authorReq)).toBeGreaterThanOrEqual(7);
    expect(version(conops)).toBeGreaterThanOrEqual(12);
    expect(version(bau)).toBeGreaterThanOrEqual(4);
  });
});

/**
 * CR-GC-979 — feste Schreibweise: Die Klammer mit Name und Wert definiert einen Parameter, die Klammer
 * mit dem Namen allein verweist auf ihn. Eine fehlende Angabe ist Designfreiheit, keine Annahme.
 */
describe('TEST-skill-wortlaut-angleich (CR-GC-979): Schreibweise und Designfreiheit', () => {
  it('se:author-req: die Klammer mit Name und Wert definiert, die Klammer mit dem Namen verweist', () => {
    expect(authorReq).toContain('`[limit ≤ 100]`');
    expect(authorReq).toContain('`[U_supply = 24 V (21.6 … 26.4 V)]`');
    expect(authorReq).toMatch(/The bracket with name and value defines the parameter/);
    expect(authorReq).toMatch(/the bracket with the name alone, `\[limit\]`, refers to it/);
    expect(authorReq).toMatch(/One name has exactly one definition/);
  });

  it('se:author-req: kein Text endet mit einer Klammer', () => {
    expect(authorReq).toMatch(/Never end a description with a bracket/);
  });

  it('se:author-req: eine fehlende Angabe ist Designfreiheit, keine Annahme', () => {
    expect(authorReq).toMatch(/that is design freedom, not an assumption/);
    expect(authorReq).toMatch(/written back into the requirement/);
  });

  it('se-bau: Designfreiheit, keine Annahme; die Schreibweise der Klammer', () => {
    expect(bau).toMatch(/Das ist Designfreiheit, keine Annahme/);
    expect(bau).toContain('`[limit ≤ 100]`');
    expect(bau).toMatch(/`\[limit\]` verweist/);
  });

  it('beide Skills tragen eine höhere Version als nach CR-GC-974', () => {
    expect(version(authorReq)).toBeGreaterThanOrEqual(8);
    expect(version(bau)).toBeGreaterThanOrEqual(5);
  });
});

