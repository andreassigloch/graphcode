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
 * CR-GC-875 zieht die Akteur-Lehre (contracts `chainRoles`, FC-06) in author-actor, top-level Regel 4,
 * se-fmea, se-vorbereitung und se-laufzeit nach; der letzte Block prueft diese Saetze.
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
const authorActor = readFileSync(join(COMMANDS, 'se', 'author-actor.md'), 'utf8');
const fmea = readFileSync(join(COMMANDS, 'se-fmea.md'), 'utf8');
const laufzeit = readFileSync(join(COMMANDS, 'se-laufzeit.md'), 'utf8');
const regel4 = topLevel.split('\n').find((l) => l.startsWith('4. **One entry node per chain.**')) ?? '';
const stufe3Fluss = topLevel.split('\n').find((l) => l.startsWith('3. **FLOW + SCHEMA**')) ?? '';

describe('se:top-level Regel 4: ein Eingangsknoten je Kette (CR-GC-873)', () => {
  it('der Kopf traegt Version 7 (CR-GC-878)', () => {
    expect(topLevel).toMatch(/^version: 7$/m);
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
    expect(vorbereitung).toMatch(/^version: 8$/m);
    expect(vorbereitung).toMatch(/Das Merkmal `sync` setzt der Autor beim Kettenschnitt \(`se:top-level`, Phase 3, Schritt FLOW \+ SCHEMA\)/);
    expect(vorbereitung).not.toMatch(/Flüsse als synchron oder asynchron kennzeichnen/);
  });
});

describe('Akteur-Lehre in den Skills (CR-GC-875)', () => {
  it('Regel 4 nennt alle vier FC-06-Faelle und die Quittung', () => {
    expect(regel4).toMatch(/no trigger/);
    expect(regel4).toMatch(/different members or contracts/);
    expect(regel4).toMatch(/`\[predelivery\]`/);
    expect(regel4).toMatch(/flow without `sync`/);
    expect(regel4).toMatch(/A receipt \(`async` hand-over, `sync` back\) triggers nothing/);
  });

  it('author-actor: Version 2, kein „external service" mehr, Schritt 3 prueft Ausloesen oder Empfangen', () => {
    expect(authorActor).toMatch(/^version: 2$/m);
    expect(authorActor).not.toContain('external service');
    expect(authorActor).toMatch(/A service outside the boundary is an actor only if it triggers a chain or receives its result/);
    expect(authorActor).toMatch(/Does it only answer\?/);
  });

  it('author-actor: antwortende Dienste ruft die Funktion selbst, ohne Fluss im Modell', () => {
    expect(authorActor).toMatch(/A data source, a write target, a model or a backup that only answers is called by the function itself, with no flow in the model/);
  });

  it('author-actor: Vorab-Lieferung, Akteur in der Mitte, parallele Ausloeser, Quittung, Rolle als Feld', () => {
    expect(authorActor).toMatch(/An actor that only delivers in advance is none/);
    expect(authorActor).toContain('[predelivery]');
    expect(authorActor).toMatch(/An actor in the middle is allowed: it gets a `sync` flow from the chain and feeds a later member/);
    expect(authorActor).toMatch(/Several triggers only at the same member with the same SCHEMA/);
    expect(authorActor).toMatch(/A receipt \(`async` hand-over, `sync` back\) triggers nothing/);
    expect(authorActor).toMatch(/The role is not an attribute\. It is a field in the result of `chainRoles`, per entry \(actor, flow, member\) and chain/);
  });

  it('die Rolle `answer` steht in keinem der Skills (kein FC-06-Fall)', () => {
    for (const t of [authorActor, topLevel, fmea, vorbereitung, laufzeit]) expect(t).not.toMatch(/`answer`/);
  });

  it('se-fmea: Version 11, Akteur in der Mitte und Abschnitte aus chainRoles.segments', () => {
    expect(fmea).toMatch(/^version: 11$/m);
    expect(fmea).toMatch(/Akteur in der Mitte/);
    expect(fmea).toContain('chainRoles.segments');
  });

  it('se-vorbereitung und se-laufzeit: async am Fluss eines Akteurs ohne Rueckfluss ist eine Vorab-Lieferung', () => {
    expect(laufzeit).toMatch(/^version: 3$/m);
    for (const t of [vorbereitung, laufzeit]) {
      expect(t).toMatch(/`async` am Fluss eines Akteurs, der aus der Kette nichts empfängt, ist eine Vorab-Lieferung \(`FC-06`, `\[predelivery\]`\)/);
    }
  });
});
