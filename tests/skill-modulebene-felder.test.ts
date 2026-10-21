/**
 * ITEM-2026-985 — der Skill-Entwurf `se-modulebene` prueft die oberste Modulebene und liest dafuer
 * Regelbefunde, `graph_metrics` und Kanten. Er rechnet nichts.
 *
 * Der Test bindet den Skill-Text an das, woraus er liest: jede genannte Regel steht im Katalog,
 * jedes aufgerufene Werkzeug steht in der Registry des Hosts, jedes genannte Feld steht im Vertrag
 * (`ModuleMetrics`, `ChainMetrics` in `@sigloch/contracts/se`), und die Vorschlagsform ist die, die
 * `se:optimize` als Quelle (a) annimmt. Muster: `tests/skill-vorbereitung-felder.test.ts`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS, ChainMetrics, ModuleMetrics } from '@sigloch/contracts/se';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import { openMeasured } from '../src/surface/measured.js';
import { shippedSkillFiles } from '../src/surface/scaffold-templates.js';

const commands = join(__dirname, '..', '.claude', 'commands');
const skill = readFileSync(join(commands, 'se-modulebene.md'), 'utf8');
const optimize = readFileSync(join(commands, 'se', 'optimize.md'), 'utf8');

const regelnIm = (text: string) => [...new Set([...text.matchAll(/`((?:[A-Z]{1,3})-\d{2})`/g)].map((m) => m[1]))];
const werkzeugeIm = (text: string) => [...new Set([...text.matchAll(/\b((?:graph|rules)_[a-z_]+)\(/g)].map((m) => m[1]))];
const unbekannteRegeln = (text: string) => regelnIm(text).filter((id) => !ALL_RULE_DEFS.some((r) => r.id === id));
// Die Werkzeugnamen aus der echten Registry — dieselbe, die der Host bindet.
let werkzeuge: string[] = [];
const unbekannteWerkzeuge = (text: string) => werkzeugeIm(text).filter((w) => !werkzeuge.includes(w));

beforeAll(async () => {
  const repo = join(__dirname, '..');
  const measured = await openMeasured({ graph: join(repo, 'docs', 'graph', 'graphcode.graph.json'), repoRoot: repo, systemId: 'graphcode' });
  try {
    werkzeuge = Object.keys(bindToolsToHarness(measured.harness));
  } finally {
    await measured.close();
  }
}, 60000);

describe('se-modulebene: der Text nennt nur, was es gibt', () => {
  it('jede genannte Regel steht im Katalog', () => {
    expect(regelnIm(skill).length, 'Praemisse: der Text nennt Regeln').toBeGreaterThan(0);
    expect(unbekannteRegeln(skill)).toEqual([]);
  });

  it('jedes aufgerufene Werkzeug steht in der Registry', () => {
    expect(werkzeugeIm(skill).length, 'Praemisse: der Text ruft Werkzeuge').toBeGreaterThan(0);
    expect(unbekannteWerkzeuge(skill)).toEqual([]);
  });

  it('die Pruefung faengt einen erfundenen Namen (nicht vacuous)', () => {
    expect(unbekannteRegeln('`XY-99`')).toEqual(['XY-99']);
    expect(unbekannteWerkzeuge('graph_erfunden({})')).toEqual(['graph_erfunden']);
  });

  it('die Felder je Modul stehen in ModuleMetrics', () => {
    const felder = Object.keys(ModuleMetrics.shape);
    for (const feld of ['cohesion', 'fanIn', 'fanOut', 'uphillDependencies']) {
      expect(skill, feld).toContain(feld);
      expect(felder, feld).toContain(feld);
    }
    expect(skill).toContain('cohesion.ratio');
  });

  it('die Felder je Kette stehen in ChainMetrics', () => {
    const zeile = ChainMetrics.shape.chains.element.options.find((o) => 'answerPath' in o.shape)!;
    for (const feld of ['answerPath', 'answerPathBlockedBy']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(Object.keys(zeile.shape), feld).toContain(feld);
    }
  });

  it('die Vorschlaege tragen die feste Form, die se:optimize als Quelle (a) annimmt', () => {
    const form = '| Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis |';
    expect(optimize).toContain('`Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis`');
    expect(skill).toContain(form);
  });

  it('Version 0 ist ein Entwurf: er bleibt im Repo und wird nicht ausgeliefert', () => {
    expect(skill).toMatch(/^version: 0$/m);
    expect(shippedSkillFiles()).not.toContain('se-modulebene.md');
    expect(shippedSkillFiles(), 'Praemisse: die anderen Skills werden ausgeliefert').toContain('se-laufzeit.md');
  });

  it('der Skill wendet nichts an und trennt Modellfehler von Vorschlaegen', () => {
    expect(skill).toMatch(/Du wendest nichts an/);
    expect(skill).toMatch(/Modellfehler zuerst/);
  });
});
