/**
 * CR-GC-873 — se:top-level Regel 4 und das Merkmal `sync` beim Kettenschnitt.
 *
 * Regel 4 hiess „One trigger per chain" und verbot damit auch den Akteur in der Mitte (die
 * Freigeberin, die einen Vorschlag sieht und freigibt). Neu, abgeleitet aus `chainRoles`
 * (contracts CR-SM-420): ein Eingangsknoten je Kette, parallele Ausloeser nur dort mit gleichem
 * Vertrag, ein Akteur in der Mitte ist erlaubt. FC-06 meldet die uebrigen Faelle und eine Kette mit
 * einem Fluss ohne `sync` — deshalb setzt der Autor `sync` beim Kettenschnitt (Stufe 3, FLOW +
 * SCHEMA), nicht erst in se-vorbereitung. Der Test bindet den Text an den Regelkatalog: nennt er
 * FC-06, muss es FC-06 geben.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS, FlowSync } from '@sigloch/contracts/se';

const COMMANDS = join(import.meta.dirname, '..', '.claude', 'commands');
const topLevel = readFileSync(join(COMMANDS, 'se', 'top-level.md'), 'utf8');
const vorbereitung = readFileSync(join(COMMANDS, 'se-vorbereitung.md'), 'utf8');
const regel4 = topLevel.split('\n').find((l) => l.startsWith('4. **One entry node per chain.**')) ?? '';
const stufe3Fluss = topLevel.split('\n').find((l) => l.startsWith('3. **FLOW + SCHEMA**')) ?? '';

describe('se:top-level Regel 4: ein Eingangsknoten je Kette (CR-GC-873)', () => {
  it('der Kopf traegt Version 5', () => {
    expect(topLevel).toMatch(/^version: 5$/m);
  });

  it('die alte Regel „One trigger per chain" ist weg', () => {
    expect(topLevel).not.toContain('One trigger per chain');
  });

  it('Regel 4 erlaubt parallele Ausloeser nur am selben Eingangsknoten mit gleichem Vertrag', () => {
    expect(regel4).toMatch(/only at that entry node and with the same contract/);
  });

  it('Regel 4 erlaubt den Akteur in der Mitte und nennt die Abschnitte', () => {
    expect(regel4).toMatch(/An actor in the middle is allowed/);
    expect(regel4).toMatch(/segments/);
  });

  it('Regel 4 verweist auf FC-06, und FC-06 steht im Regelkatalog mit Stufe 8', () => {
    expect(regel4).toContain('FC-06');
    expect(ALL_RULE_DEFS.find((r) => r.id === 'FC-06')?.stage).toBe(8);
  });
});

describe('`sync` wird beim Kettenschnitt gesetzt, nicht erst in se-vorbereitung (CR-GC-873)', () => {
  it('Stufe 3 (FLOW + SCHEMA) setzt jeden Wert aus FlowSync und nennt FC-06', () => {
    for (const wert of FlowSync.options) expect(stufe3Fluss, wert).toContain(`@sync ${wert}`);
    expect(stufe3Fluss).toMatch(/while you cut the chain/);
    expect(stufe3Fluss).toContain('FC-06');
  });

  it('se-vorbereitung nennt se:top-level als Ort des Merkmals und prueft nur nach', () => {
    expect(vorbereitung).toMatch(/^version: 6$/m);
    expect(vorbereitung).toMatch(/Das Merkmal `sync` setzt der Autor beim Kettenschnitt \(`se:top-level`, Phase 3, Schritt FLOW \+ SCHEMA\)/);
    expect(vorbereitung).not.toMatch(/Flüsse als synchron oder asynchron kennzeichnen/);
  });
});
