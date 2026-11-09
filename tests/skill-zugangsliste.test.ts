/**
 * CR-GC-895 — se-conops leitet die Zugangsliste aus dem Modell ab, se-plan macht daraus die
 * Pflicht-Stufe 0 mit Pruefskript.
 *
 * Gemessen in immo-infra (2026-11-02..09): der Bau stoppte 8-mal fuer einen Zugang, den nur der
 * Nutzer anlegen konnte. Der Test haelt beide Pflichtstellen fest: die Spalten der Liste und ihre
 * Quellen im Modell, und in se-plan die Pflicht, das Pruefskript und die Sperre fuer Stufe 1.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lies = (name: string): string => readFileSync(join(__dirname, '..', '.claude', 'commands', name), 'utf8');
const conops = lies('se-conops.md');
const plan = lies('se-plan.md');

describe('TEST-skill-zugangsliste (CR-GC-895)', () => {
  it('se-conops leitet die Liste aus dem Modell ab', () => {
    const liste = conops.slice(conops.indexOf('**Access list'), conops.indexOf('## 2.'));
    expect(liste.length).toBeGreaterThan(0);
    expect(liste).toMatch(/every `io` FLOW to an `ACTOR` or a foreign system/);
    expect(liste).toMatch(/every service with a domain/);
    expect(liste).toMatch(/every private package registry/);
    expect(liste).toMatch(/every deploy target \(host, account\)/);
    expect(liste).toMatch(/\| Access \| Created by \(human \/ agent\) \| Stored where \| Check call \|/);
  });

  it('se-plan: Stufe 0 ist Pflicht bei einer Zeile mit Mensch, mit Pruefskript', () => {
    const stufe0 = plan.slice(plan.indexOf('0. **Environment**'), plan.indexOf('1. **Contracts**'));
    expect(stufe0).toMatch(/mandatory as soon as the access list of `se-conops` has a line created by a \*human\*/);
    expect(stufe0).toMatch(/CR \*\*Provide access\*\*/);
    expect(stufe0).toMatch(/a script calls the check call of every line/);
  });

  it('se-plan: Stufe 1 erst bei ganz gruenem Skript; spaeter Zugang erst in die Liste', () => {
    expect(plan).toMatch(/\*\*Stage 1 starts only when that script is all green\.\*\*/);
    expect(plan).toMatch(/An access found later is first written into the list, then obtained/);
  });
});
