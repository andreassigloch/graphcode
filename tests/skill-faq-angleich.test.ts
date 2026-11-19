/**
 * TEST-skill-faq-angleich
 *
 * CR-GC-939 — Skills folgen den entschiedenen Modellfragen der FAQ.
 *
 * Entschieden (FAQ keine-kette-fuer-eigenschaft, zerlegungsbreite, import-code-sys,
 * flows-zusammenlegen, modell-dem-code-voraus, sync-async-pflicht, sync-async-bedeutung,
 * modell-zug-wann). Das Band der Zerlegungsbreite kommt aus der Policy, nicht aus dem Skill.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';

const C = join(__dirname, '..', '.claude', 'commands');
const lies = (...p: string[]) => readFileSync(join(C, ...p), 'utf8');
const topLevel = lies('se', 'top-level.md');
const generate = lies('se', 'generate.md');
const importCode = lies('se', 'import-code.md');
const closeV = lies('se', 'close-violations.md');
const vorbereitung = lies('se-vorbereitung.md');
const umbau = lies('se-umbau.md');

describe('TEST-skill-faq-angleich (CR-GC-939)', () => {
  it('Nr. 5: eine Eigenschaft ist eine funktionale REQ an der FUNC', () => {
    expect(topLevel).not.toContain('A property is a non-functional REQ');
    expect(topLevel).toMatch(/A property is a functional REQ at the FUNC that carries it/);
  });

  it('Nr. 6: kein Skill nennt 7±2 oder „more than five"; beide verweisen auf RD-04 und RD-05', () => {
    expect(topLevel).not.toContain('7±2');
    expect(generate).not.toContain('7±2');
    expect(topLevel).not.toMatch(/More than five top-level/);
    expect(topLevel).toMatch(/RD-04.*RD-05|RD-05.*RD-04/);
    expect(generate).toMatch(/RD-04.*RD-05|RD-05.*RD-04/);
    expect(topLevel).toContain('decompositionBreadth');
  });

  it('Nr. 6: das Band, auf das die Skills verweisen, ist 3 bis 9 in der Policy', () => {
    expect(DEFAULT_METRIC_POLICY.decompositionBreadth).toEqual({ min: 3, warning: 9 });
  });

  it('Nr. 9: der Import stellt genau ein SYS sicher', () => {
    expect(importCode).not.toMatch(/Keine UC\/REQ\/ACTOR\/SYS/);
    expect(importCode).toMatch(/genau ein SYS/);
    expect(importCode).toMatch(/SYS compose MOD/);
  });

  it('Nr. 12: ein Duplikat wird je Paar geprüft; FLOWs nur bei gleichem Vertrag und gleicher Verbindung', () => {
    expect(closeV).not.toContain('A duplicate (ND-01, ND-02) is merged, not deleted');
    expect(closeV).toMatch(/Check each pair/);
    expect(closeV).toMatch(/same producers and readers|same contract and the same connection/);
  });

  it('Nr. 13: eine Differenz zum Code steht in der FLOW-Beschreibung, der Autor entscheidet', () => {
    expect(vorbereitung).not.toContain('Fluss löschen; ist er gewollt, wird er ein Item, nicht Modell');
    expect(vorbereitung).toMatch(/Beschreibung des Flusses/);
    expect(vorbereitung).toMatch(/legst beides dem Autor vor/);
  });

  it('Nr. 14: se-vorbereitung setzt sync nicht erstmals', () => {
    expect(vorbereitung).not.toContain('kennzeichnet, was dort offen blieb');
    expect(vorbereitung).toMatch(/Trägt der Fluss einen anderen Wert/);
    expect(vorbereitung).toMatch(/setzt es nicht erstmals/);
    expect(vorbereitung).toMatch(/zurück an `se:top-level`/);
  });

  it('Nr. 15: sync fragt nach dem Abnehmer', () => {
    expect(topLevel).not.toContain('does the caller await the answer');
    expect(topLevel).toMatch(/does the consumer await the delivery/);
  });

  it('Nr. 16: der Modell-Zug läuft vor dem Löschen der Dateien', () => {
    expect(umbau).not.toContain('Nach dem Löschen im Code ist das Modell **falsch**');
    expect(umbau).toMatch(/Der Modell-Zug läuft \*\*vor\*\* dem Löschen der Dateien/);
  });

  it('die Versionen stehen höher', () => {
    expect(topLevel).toMatch(/^version: 13$/m);
    const v = (t: string) => Number(t.match(/^version: (\d+)$/m)![1]);
    expect(v(generate)).toBeGreaterThanOrEqual(6);
    expect(importCode).toMatch(/^version: 5$/m);
    expect(v(closeV)).toBeGreaterThanOrEqual(5);
    expect(Number(vorbereitung.match(/^version: (\d+)$/m)![1])).toBeGreaterThanOrEqual(10);
    expect(v(umbau)).toBeGreaterThanOrEqual(3);
  });
});
