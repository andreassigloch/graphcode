/**
 * CR-GC-940 — Skills führen keine eigene Liste von Regel-IDs, keine Schwelle, keine eigene
 * Reihenfolge und urteilen über Bindung nur mit der Deckung; sie nennen Abgeschafftes nicht.
 *
 * Entschieden (FAQ skill-keine-eigene-rechnung, befund-abnehmen, befunde-reihenfolge,
 * bindungsquote-und-deckung, kein-paralleler-pfad, geschuetzte-tabelle-nicht-ausliefern).
 * Die Angaben kommen aus dem Werkzeug; die Prämissen unten prüfen das am Code.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { actionPriority, apMethod } from '@sigloch/contracts/se';
import { attributesFor } from '../src/projections/authoring-example.js';
import { ABNEHMBAR } from '../src/kernel/measure/focus-set.js';
import { TOOL_HELP } from '../src/projections/tool-help.js';

const C = join(__dirname, '..', '.claude', 'commands');
const lies = (...p: string[]) => readFileSync(join(C, ...p), 'utf8');
const generate = lies('se', 'generate.md');
const closeV = lies('se', 'close-violations.md');
const importCode = lies('se', 'import-code.md');
const optimize = lies('se', 'optimize.md');
const vorbereitung = lies('se-vorbereitung.md');
const fmea = lies('se-fmea.md');
const status = lies('se-status.md');
const review = lies('se-review.md');
const retro = lies('se-retro.md');

describe('TEST-skill-keine-eigene-rechnung (CR-GC-940)', () => {
  it('Prämisse: der Guide liefert die abnehmbaren Regeln als enumValues von acceptedFindings', () => {
    const a = attributesFor('UC').find((x: { key: string }) => x.key === 'acceptedFindings') as { enumValues: string[] };
    expect([...a.enumValues].sort()).toEqual([...ABNEHMBAR].sort());
  });

  it('Prämisse: rules_evaluate liefert die Arbeitsreihenfolge, graph_readiness die Deckung', () => {
    expect(TOOL_HELP.rules_evaluate.se).toMatch(/grouped/);
    expect(TOOL_HELP.rules_evaluate.se).toMatch(/Fehler zuerst/);
    expect(TOOL_HELP.graph_readiness.se).toMatch(/importCoverage/);
  });

  it('Nr. 7: se:generate nennt weder Steuerregel-Liste noch 5 %', () => {
    expect(generate).not.toMatch(/Steuerregeln \(RD-04/);
    expect(generate).not.toContain('5 %');
    expect(generate).toMatch(/Wann eine Steuerregel fertig ist, nennt der `prompt` von `graph_generate`/);
  });

  it('Nr. 7 und 11: se:generate führt keine Liste der abnehmbaren Regeln, sie steht im Guide', () => {
    expect(generate).not.toContain('AF-01, AF-02');
    expect(generate).not.toContain('AF-01..05');
    expect(generate).toMatch(/unter `acceptedFindings` als `enumValues`/);
  });

  it('Nr. 11: se:close-violations nimmt nur ab, was der Guide nennt', () => {
    expect(closeV).not.toContain('AF-01 … AF-05');
    expect(closeV).not.toContain('a finding the model cannot satisfy in this job');
    expect(closeV).toMatch(/only what `graph_authoring_guide` lists as `enumValues` of `acceptedFindings`/);
  });

  it('Nr. 7: se-vorbereitung, se-fmea und se:optimize führen keine Regel-ID-Listen', () => {
    expect(vorbereitung).not.toContain('`R-30`, `R-31`, `R-21`, `IO-01`');
    expect(fmea).not.toContain('`R-30`, `R-31`, `R-21`, `IO-01`');
    expect(optimize).not.toContain('`R-19`, `R-20`, `R-26`, `R-32`');
    for (const s of [vorbereitung, fmea]) expect(s).toMatch(/`holding` in `graph_readiness\(\{ detail: true \}\)`/);
    expect(optimize).toMatch(/\| Befunde \| je Regel die Zahl aus `rules_get_violations\(\{ detail: "grouped" \}\)`, ohne die Stufen Bindung und Abgleich/);
  });

  it('Nr. 17: se-status liest die Reihenfolge aus rules_evaluate grouped, es zählt nicht selbst', () => {
    expect(status).not.toContain('carrying the most error-severity violations');
    expect(status).toMatch(/first three groups of `rules_evaluate\(\{ detail: "grouped" \}\)`/);
    expect(status).not.toMatch(/rank the fixes by violation severity\/count/);
  });

  it('Nr. 18: das Urteil kongruent nennt die Deckung und die nicht zugeordneten Dateien', () => {
    expect(review).not.toMatch(/\| `importCoverage` da, keine RC-Verstöße \|/);
    expect(review).toMatch(/Deckung/);
    expect(review).toMatch(/`unassigned`/);
    expect(review).toMatch(/Bindungsquote und Deckung, nie nur eine/);
    expect(status).toMatch(/`unassigned`/);
  });

  it('Nr. 2 und 3: kein codeRef, testRef heißt testRefs, R-20 prüft realRef', () => {
    expect(retro).not.toContain('codeRef');
    expect(retro).not.toMatch(/`testRef`/);
    expect(retro).toMatch(/`testRefs`\/`realRef` \(R-19\/R-20\)/);
    expect(importCode).not.toContain('codeRef');
    expect(importCode).toMatch(/R-20 realRef/);
  });

  it('Nr. 19: Prämisse, actionPriority ist ausgeliefert, ohne Tabelle gilt der Übergang', () => {
    expect(typeof actionPriority).toBe('function');
    expect(apMethod(undefined)).toBe('rpn-interim');
  });

  it('Nr. 19: se-fmea sagt, AP kommt aus actionPriority() und trägt ohne Tabelle den Stern', () => {
    expect(fmea).not.toContain('is not published yet');
    expect(fmea).not.toContain('Use the canonical AIAG-VDA AP lookup table');
    expect(fmea).toMatch(/comes from `actionPriority\(\)`/);
    expect(fmea).toMatch(/`AP\*`/);
  });

  it('die Versionen stehen höher', () => {
    const v = (t: string) => Number(t.match(/^version: (\d+)$/m)![1]);
    expect(v(generate)).toBeGreaterThanOrEqual(6);
    expect(v(closeV)).toBeGreaterThanOrEqual(5);
    expect(v(importCode)).toBeGreaterThanOrEqual(4);
    expect(v(optimize)).toBeGreaterThanOrEqual(9);
    expect(v(vorbereitung)).toBeGreaterThanOrEqual(10);
    expect(v(fmea)).toBeGreaterThanOrEqual(13);
    expect(v(status)).toBeGreaterThanOrEqual(3);
    expect(v(review)).toBeGreaterThanOrEqual(3);
    expect(v(retro)).toBeGreaterThanOrEqual(7);
  });
});
