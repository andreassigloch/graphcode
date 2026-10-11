/**
 * CR-GC-774 — der Skill `se-fmea` liest die Orte einer Wirkkette aus `graph_metrics` und rechnet
 * kein eigenes Kettenprofil (eine Rechnung, nicht zwei: `chainMetrics` in `@sigloch/contracts/se`).
 *
 * Gemessen 2026-10-10: das von Hand gerechnete Profil des Skills (Linearität, Importgrad) widersprach
 * `chainMetrics` an allen 10 Ketten mit Rückkopplung, und der Importgrad ergab bis zu 29 Pflichtstellen
 * je Kette. Der Test bindet den Skill-Text an das Schema: nennt der Text ein Feld, das `ChainMetrics`
 * nicht trägt, ist er rot.
 *
 * CR-GC-782 — Version 9: der Skill prueft den Eingang und verweist bei einer Luecke auf
 * `se-vorbereitung`, liest Umfang (`scope`), Traeger (`riskCarriers`) und die Ketten durch eine
 * Funktion (`functions`) aus `graph_metrics`, legt keinen alten Bestand tiefer und gibt Vorschlaege
 * in fester Form ab. Jedes genannte Feld traegt der Vertrag in contracts und erklaert die Hilfe.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_RULE_DEFS,
  chainMetrics,
  functionCriticality,
  requirementScope,
  riskCarriers,
} from '@sigloch/contracts/se';
import { TOOL_HELP } from '../src/projections/tool-help.js';

const skill = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-fmea.md'), 'utf8');

/** Eine bewertbare Kette mit Kreislauf, damit jede Ortsliste des Schemas ein Feld der Zeile ist. */
const graph = {
  elements: [
    { id: 'SYS-x', type: 'SYS', name: 'x' }, { id: 'UC-x', type: 'UC', name: 'x' },
    { id: 'FCHAIN-x', type: 'FCHAIN', name: 'x' }, { id: 'ACTOR-a', type: 'ACTOR', name: 'a' },
    { id: 'FUNC-a', type: 'FUNC', name: 'a' }, { id: 'FUNC-b', type: 'FUNC', name: 'b' },
    { id: 'FLOW-in', type: 'FLOW', name: 'in' }, { id: 'FLOW-ab', type: 'FLOW', name: 'ab' },
    { id: 'FLOW-ba', type: 'FLOW', name: 'ba' }, { id: 'FLOW-out', type: 'FLOW', name: 'out' },
    { id: 'MOD-m', type: 'MOD', name: 'm' },
  ],
  traces: [
    { source: 'SYS-x', target: 'UC-x', type: 'compose' }, { source: 'UC-x', target: 'FCHAIN-x', type: 'compose' },
    { source: 'FCHAIN-x', target: 'FUNC-a', type: 'compose' }, { source: 'FCHAIN-x', target: 'FUNC-b', type: 'compose' },
    { source: 'ACTOR-a', target: 'FLOW-in', type: 'io' }, { source: 'FLOW-in', target: 'FUNC-a', type: 'io' },
    { source: 'FUNC-a', target: 'FLOW-ab', type: 'io' }, { source: 'FLOW-ab', target: 'FUNC-b', type: 'io' },
    { source: 'FUNC-b', target: 'FLOW-ba', type: 'io' }, { source: 'FLOW-ba', target: 'FUNC-a', type: 'io' },
    { source: 'FUNC-b', target: 'FLOW-out', type: 'io' }, { source: 'FLOW-out', target: 'ACTOR-a', type: 'io' },
    { source: 'FUNC-a', target: 'MOD-m', type: 'allocate' }, { source: 'FUNC-b', target: 'MOD-m', type: 'allocate' },
  ],
} as unknown as Parameters<typeof chainMetrics>[0];

/** Die Ortsfelder, die der Skill je Kette liest. */
const ORTE = ['memberCount', 'fanIn', 'loops', 'shared', 'boundaries', 'imports', 'handovers'];

describe('se-fmea liest die Orte, er rechnet sie nicht (CR-GC-774)', () => {
  it('der Skill-Text traegt keine Rechenvorschrift fuer eine Kettenkennzahl', () => {
    expect(skill).not.toMatch(/Linearität/);
    expect(skill).not.toMatch(/Importgrad/);
    expect(skill, 'kein Quotient im Text').not.toContain('÷');
  });

  it('der Skill holt das Profil aus graph_metrics', () => {
    expect(skill).toMatch(/`graph_metrics`/);
    for (const feld of ORTE) expect(skill, `Ortsfeld ${feld}`).toContain(`\`${feld}`);
  });

  it('jedes Ortsfeld, das der Skill nennt, traegt die bewertbare Zeile von chainMetrics', () => {
    const kette = chainMetrics(graph).chains[0] as Record<string, unknown>;
    expect(kette.measurable, 'Praemisse: die Probekette ist bewertbar').toBe(true);
    for (const feld of ORTE) expect(kette, `chainMetrics ohne ${feld}`).toHaveProperty(feld);
  });

  it('der erste Schritt ist die Verdrahtung, und eine nicht bewertbare Kette wird nicht analysiert', () => {
    expect(skill).toMatch(/measurable: false/);
    for (const regel of ['R-30', 'R-31', 'R-21', 'IO-01', 'FC-04', 'FC-05']) expect(skill, regel).toContain(regel);
  });

  it('die Reichweite geht nicht in die Schwere', () => {
    expect(skill).toMatch(/Reichweite[^\n]*nicht[^\n]*(Schwere|Severity)/i);
  });
});

type Graph = Parameters<typeof chainMetrics>[0];

/**
 * Die Probekette oben, dazu ein Risiko mit drei Gegenmassnahmen: eine funktionale an der Funktion,
 * eine am Modul (alter Bestand) und eine am System (gilt quer).
 */
function mitRisiko(): Graph {
  const g = graph as unknown as { elements: unknown[]; traces: unknown[] };
  return {
    elements: [
      ...g.elements,
      { id: 'REQ-risk', type: 'REQ', name: 'risk', attributes: { role: 'risk', kinds: ['non-functional'] } },
      { id: 'REQ-mit-func', type: 'REQ', name: 'an der Funktion', attributes: { role: 'mitigation', kinds: ['functional'] } },
      { id: 'REQ-mit-mod', type: 'REQ', name: 'am Modul', attributes: { role: 'mitigation', kinds: ['non-functional'] } },
      { id: 'REQ-mit-sys', type: 'REQ', name: 'am System', attributes: { role: 'mitigation', kinds: ['non-functional'] } },
    ],
    traces: [
      ...g.traces,
      { source: 'REQ-risk', target: 'REQ-mit-func', type: 'compose' },
      { source: 'REQ-risk', target: 'REQ-mit-mod', type: 'compose' },
      { source: 'REQ-risk', target: 'REQ-mit-sys', type: 'compose' },
      { source: 'FUNC-a', target: 'REQ-mit-func', type: 'satisfy' },
      { source: 'MOD-m', target: 'REQ-mit-mod', type: 'satisfy' },
      { source: 'SYS-x', target: 'REQ-mit-sys', type: 'satisfy' },
    ],
  } as unknown as Graph;
}

const regel = (id: string) => ALL_RULE_DEFS.find((r) => r.id === id);
const hilfe = TOOL_HELP.graph_metrics.se;

describe('se-fmea Version 9: Eingang pruefen, Umfang und Traeger lesen, Ergebnis ist ein CR (CR-GC-782)', () => {
  it('der Kopf traegt Version 9', () => {
    expect(skill).toMatch(/^version: 9$/m);
  });

  it('eine Luecke am Eingang geht an se-vorbereitung, der Skill stellt die Verdrahtung nicht selbst her', () => {
    expect(skill).toMatch(/measurable: false[^\n]*endet[^\n]*`se-vorbereitung`/);
    expect(skill, 'Verdrahtungsbefund am Glied').toMatch(/Verdrahtungsbefunde[^\n]*`se-vorbereitung`/);
    // Version 8 machte das Schliessen zum Ergebnis des Laufs.
    expect(skill).not.toMatch(/Schließen dieser Befunde ist das Ergebnis/);
    expect(skill).not.toMatch(/erst schließen/);
    expect(skill).toMatch(/schließt keine Kette/);
  });

  it('der Umfang kommt aus scope, und jedes genannte Feld traegt requirementScope', () => {
    expect(skill).toMatch(/graph_metrics\(\{ scope: \["<FCHAIN-uid>"\] \}\)/);
    const umfang = requirementScope(mitRisiko(), ['FCHAIN-x']) as Record<string, unknown>;
    for (const feld of ['scope', 'modules', 'chains', 'requirements']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(hilfe, `Hilfe ohne ${feld}`).toContain(`\`${feld}\``);
    }
    for (const feld of ['modules', 'chains', 'requirements']) expect(umfang, feld).toHaveProperty(feld);
    expect(umfang.requirements, 'Praemisse: Gegenmassnahmen an Funktion, Modul und System liegen im Umfang')
      .toEqual(expect.arrayContaining(['REQ-mit-func', 'REQ-mit-mod', 'REQ-mit-sys']));
    expect(skill).toMatch(/nenne[^\n]*`requirements`/i);
  });

  it('die Traeger kommen aus riskCarriers, und jedes genannte Feld traegt der Vertrag', () => {
    const traeger = riskCarriers(mitRisiko());
    expect(skill).toContain('`riskCarriers`');
    for (const feld of ['riskId', 'carriers', 'satisfiers']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(traeger.risks[0], feld).toHaveProperty(feld);
    }
    for (const feld of ['mitigation', 'by']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(traeger.risks[0].satisfiers[0], feld).toHaveProperty(feld);
    }
    for (const feld of ['surface', 'funcId', 'risks']) expect(skill, feld).toContain(`\`${feld}\``);
    for (const feld of ['funcId', 'risks']) expect(traeger.surface[0], feld).toHaveProperty(feld);
    for (const feld of ['riskCarriers', 'risks', 'carriers', 'satisfiers', 'surface']) {
      expect(hilfe, `Hilfe ohne ${feld}`).toContain(`\`${feld}\``);
    }
  });

  it('alter Bestand am Modul: nennen und verweisen, nicht tieferlegen', () => {
    expect(skill).toMatch(/`by`[^\n]*ein Modul[^\n]*`se-vorbereitung`/);
    expect(skill).toMatch(/legst nicht selbst tiefer/);
    expect(skill).toMatch(/Bestand[^\n]*räumst du nicht auf/);
    // Der Zug des Tieferlegens (Vorbild in se-vorbereitung) steht hier nicht: keine Kante vom Modul weg.
    expect(skill).not.toMatch(/^\s*- MOD-\S+ -satisfy->/m);
    // Was der Text behauptet, rechnet der Vertrag so: am Modul traegt jede Blattfunktion des Moduls.
    const risiko = riskCarriers(mitRisiko()).risks[0];
    expect(risiko.satisfiers).toContainEqual({ mitigation: 'REQ-mit-mod', by: 'MOD-m' });
    expect(risiko.carriers).toEqual(['FUNC-a', 'FUNC-b']);
  });

  it('eine Gegenmassnahme am System gilt quer und zaehlt nicht in die Traeger', () => {
    expect(skill).toMatch(/am System[^\n]*gilt quer[^\n]*nicht in (die Träger|`carriers`)/);
    const m = mitRisiko() as unknown as { traces: Array<{ source: string; target: string }> };
    m.traces = m.traces.filter((t) => t.target !== 'REQ-mit-mod' && t.target !== 'REQ-mit-func');
    const risiko = riskCarriers(m as unknown as Graph).risks[0];
    expect(risiko.carriers).toEqual([]);
    expect(risiko.satisfiers).toContainEqual({ mitigation: 'REQ-mit-sys', by: 'SYS-x' });
    // Risiko ohne Gegenmassnahme oder ohne Erfueller meldet der Katalog; der Skill zitiert.
    for (const id of ['FM-02', 'RD-01']) {
      expect(skill, id).toContain(`\`${id}\``);
      expect(regel(id), id).toBeDefined();
    }
  });

  it('das Ergebnis ist ein CR: die neue Gegenmassnahme haengt als funktionale Anforderung an ihrer Funktion', () => {
    expect(skill).toMatch(/Ergebnis ist ein gewöhnlicher CR/);
    expect(skill).toMatch(/^\s*@role mitigation\n\s*@kinds \["functional"\]$/m);
    expect(skill).toMatch(/^\s*\+ FUNC-\S+ -satisfy-> REQ-MMM$/m);
    // Nachgezogen am Probemodell: nur die Gegenmassnahme an der Funktion ergibt genau einen Traeger.
    const m = mitRisiko() as unknown as { traces: Array<{ source: string; target: string }> };
    m.traces = m.traces.filter((t) => t.target !== 'REQ-mit-mod');
    expect(riskCarriers(m as unknown as Graph).risks[0].carriers).toEqual(['FUNC-a']);
    // Ein Block traegt keine Anforderung und ist kein Glied einer Kette.
    expect(regel('FC-03')?.severity).toBe('error');
    expect(skill).toMatch(/Block[^\n]*`FC-03`[^\n]*Fehler|`FC-03`[^\n]*Block[^\n]*Fehler/);
  });

  it('einer geteilten Funktion wird kein Risiko aufgeladen, ohne ihre Risiken und ihre Ketten zu nennen', () => {
    expect(skill).toMatch(/geteilten Funktion[^\n]*kein weiteres Risiko[^\n]*`surface`[^\n]*`functions`/);
    const zeile = functionCriticality(mitRisiko())[0] as Record<string, unknown>;
    for (const feld of ['funcId', 'chains', 'useCases']) expect(zeile, feld).toHaveProperty(feld);
    for (const feld of ['functions', 'chains', 'useCases']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(hilfe, `Hilfe ohne ${feld}`).toContain(`\`${feld}\``);
    }
  });

  it('der Vorschlag hat die feste Form mit Preis, und der Skill wendet ihn nicht an', () => {
    expect(skill).toContain('`Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis`');
    expect(skill).toMatch(/Prognose[^\n]*was besser wird, was gleich bleibt/);
    expect(skill).toMatch(/Du wendest ihn nicht an/);
    expect(skill).toContain('`se:optimize`');
  });

  it('keine Rechnung und keine Kennzahl, die es nicht gibt', () => {
    expect(skill, 'keine Rechenvorschrift').not.toMatch(/Quotient|Durchschnitt|Mittelwert|Summe|Prozent|%/);
    expect(skill, 'verworfene Kennzahlen').not.toMatch(/Gewicht|Flüsse an den Trägern/);
    expect(skill).toMatch(/Länge der Liste/);
  });

  it('die Bewertung bleibt: Schwere, Auftreten, Entdeckung unter den Namen, die die Regeln lesen', () => {
    for (const name of ['attributes.severity', 'attributes.occurrence', 'attributes.detection']) {
      expect(skill, name).toContain(`\`${name}\``);
    }
    expect(skill).toContain('AIAG-VDA');
  });
});
