/**
 * CR-GC-784 — der Skill `se-vorbereitung` fuehrt durch die Vorbereitung des Modells (Ketten
 * schliessen, Anforderungen zuordnen, Fluesse kennzeichnen) und liest dafuer `graph_metrics` und
 * die Regelbefunde. Er rechnet nichts.
 *
 * Der Test bindet den Skill-Text an die Vertraege, aus denen er liest (`RiskCarriers`,
 * `RequirementScope`, `ChainMetrics`, Regelkatalog, `FlowSync` in `@sigloch/contracts/se`): nennt
 * der Text ein Feld, einen Grund oder eine Regel, die es dort nicht gibt, ist er rot. Muster:
 * `tests/skill-fmea-orte.test.ts`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ALL_RULE_DEFS,
  ChainMetrics,
  FlowSync,
  chainMetrics,
  requirementScope,
  riskCarriers,
} from '@sigloch/contracts/se';

const skill = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-vorbereitung.md'), 'utf8');

type Graph = Parameters<typeof chainMetrics>[0];

/**
 * Eine geschlossene Kette (x) mit einem Risiko, dessen eine Gegenmassnahme am Modul und dessen
 * andere am System haengt, und eine offene Kette (y) mit einem Glied ohne Fluss.
 */
function modell(): { elements: Array<Record<string, unknown>>; traces: Array<Record<string, string>> } {
  return {
    elements: [
      { id: 'SYS-x', type: 'SYS', name: 'x' }, { id: 'UC-x', type: 'UC', name: 'x' },
      { id: 'FCHAIN-x', type: 'FCHAIN', name: 'x' }, { id: 'FCHAIN-y', type: 'FCHAIN', name: 'y' },
      { id: 'ACTOR-a', type: 'ACTOR', name: 'a' },
      { id: 'FUNC-a', type: 'FUNC', name: 'a' }, { id: 'FUNC-b', type: 'FUNC', name: 'b' },
      { id: 'FUNC-c', type: 'FUNC', name: 'c' },
      { id: 'FLOW-in', type: 'FLOW', name: 'in' }, { id: 'FLOW-ab', type: 'FLOW', name: 'ab' },
      { id: 'FLOW-out', type: 'FLOW', name: 'out' },
      { id: 'MOD-m', type: 'MOD', name: 'm' },
      { id: 'REQ-risk', type: 'REQ', name: 'risk', attributes: { role: 'risk', kinds: ['non-functional'] } },
      { id: 'REQ-mit-mod', type: 'REQ', name: 'am Modul', attributes: { role: 'mitigation', kinds: ['non-functional'] } },
      { id: 'REQ-mit-sys', type: 'REQ', name: 'am System', attributes: { role: 'mitigation', kinds: ['non-functional'] } },
    ],
    traces: [
      { source: 'SYS-x', target: 'UC-x', type: 'compose' },
      { source: 'UC-x', target: 'FCHAIN-x', type: 'compose' }, { source: 'UC-x', target: 'FCHAIN-y', type: 'compose' },
      { source: 'FCHAIN-x', target: 'FUNC-a', type: 'compose' }, { source: 'FCHAIN-x', target: 'FUNC-b', type: 'compose' },
      { source: 'FCHAIN-y', target: 'FUNC-c', type: 'compose' },
      { source: 'ACTOR-a', target: 'FLOW-in', type: 'io' }, { source: 'FLOW-in', target: 'FUNC-a', type: 'io' },
      { source: 'FUNC-a', target: 'FLOW-ab', type: 'io' }, { source: 'FLOW-ab', target: 'FUNC-b', type: 'io' },
      { source: 'FUNC-b', target: 'FLOW-out', type: 'io' }, { source: 'FLOW-out', target: 'ACTOR-a', type: 'io' },
      { source: 'FUNC-a', target: 'MOD-m', type: 'allocate' }, { source: 'FUNC-b', target: 'MOD-m', type: 'allocate' },
      { source: 'FUNC-c', target: 'MOD-m', type: 'allocate' },
      { source: 'REQ-risk', target: 'REQ-mit-mod', type: 'compose' },
      { source: 'REQ-risk', target: 'REQ-mit-sys', type: 'compose' },
      { source: 'MOD-m', target: 'REQ-mit-mod', type: 'satisfy' },
      { source: 'SYS-x', target: 'REQ-mit-sys', type: 'satisfy' },
    ],
  };
}

const alsGraph = (m: ReturnType<typeof modell>): Graph => m as unknown as Graph;
const regel = (id: string) => ALL_RULE_DEFS.find((r) => r.id === id);

const VERDRAHTUNG = ['R-30', 'R-31', 'R-21', 'IO-01', 'FC-04', 'FC-05'];
const KLASSEN = ['Tieferlegen', 'Zerlegen', 'Funktion fehlt', 'Gilt quer'];

describe('se-vorbereitung liest Kennzahlen und Befunde, er rechnet nichts (CR-GC-784)', () => {
  it('der Skill-Text traegt keine Rechnung und nennt keine Kennzahl fuer das Merkmal am Fluss', () => {
    expect(skill).toMatch(/rechnest keine Kennzahl/);
    expect(skill, 'keine Rechenvorschrift').not.toMatch(/÷|Quotient|Durchschnitt|Mittelwert|Summe|Prozent|%/);
    // Das Merkmal `sync` liest noch keine Kennzahl (CR-SM-408 wartet); `syncDepth` waere eine Behauptung.
    expect(skill).not.toContain('syncDepth');
  });

  it('er liest aus graph_metrics und den Regelbefunden und schreibt nur durchs Gate', () => {
    for (const werkzeug of ['graph_metrics', 'rules_evaluate', 'rules_get_violations', 'graph_mutate']) {
      expect(skill, werkzeug).toContain(`\`${werkzeug}\``);
    }
  });

  it('Schritt 1: eine nicht bewertbare Kette beendet den Lauf, und jeder genannte Grund steht im Vertrag', () => {
    expect(skill).toMatch(/measurable: false/);
    expect(skill).toMatch(/measurable: false[^\n]*endet/);
    const zeile = ChainMetrics.shape.chains.element;
    const offen = chainMetrics(alsGraph(modell())).chains.find((c) => c.chainId === 'FCHAIN-y')!;
    expect(offen.measurable, 'Praemisse: die Kette mit dem losen Glied ist nicht bewertbar').toBe(false);
    expect(offen).toHaveProperty('reasons');
    expect(skill).toContain('`reasons`');
    for (const grund of ['FC-05', 'loose-member', 'no-entry', 'no-exit', 'empty']) {
      expect(skill, `Grund ${grund}`).toContain(`\`${grund}\``);
      expect(zeile.safeParse({ chainId: 'c', chainName: 'c', measurable: false, reasons: [grund] }).success, grund).toBe(true);
    }
  });

  it('die Regeln der Verdrahtung sind Warnungen, FC-05 haelt PDR, FC-03 ist ein Fehler', () => {
    for (const id of VERDRAHTUNG) {
      expect(skill, id).toContain(`\`${id}\``);
      expect(regel(id)?.severity, id).toBe('warning');
    }
    expect(regel('FC-05')?.mark).toBe('PDR');
    expect(skill).toMatch(/`FC-05`[^\n]*PDR/);
    expect(regel('FC-03')?.severity).toBe('error');
    expect(skill).toMatch(/`FC-03`[^\n]*Fehler/);
    // Risiko ohne Gegenmassnahme oder ohne Erfueller meldet der Katalog schon.
    for (const id of ['FM-02', 'RD-01']) {
      expect(skill, id).toContain(`\`${id}\``);
      expect(regel(id), id).toBeDefined();
    }
  });

  it('Schritt 2: jedes Feld, das der Skill aus riskCarriers und scope nennt, traegt der Vertrag', () => {
    const g = alsGraph(modell());
    const traeger = riskCarriers(g);
    const risiko = traeger.risks[0] as Record<string, unknown>;
    expect(skill).toContain('`riskCarriers`');
    for (const feld of ['riskId', 'carriers', 'satisfiers']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(risiko, feld).toHaveProperty(feld);
    }
    for (const feld of ['mitigation', 'by']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(traeger.risks[0].satisfiers[0], feld).toHaveProperty(feld);
    }
    expect(skill).toContain('`surface`');
    for (const feld of ['funcId', 'risks']) expect(traeger.surface[0], feld).toHaveProperty(feld);

    const umfang = requirementScope(g, ['FCHAIN-x']) as Record<string, unknown>;
    expect(skill).toContain('`scope`');
    for (const feld of ['modules', 'chains', 'requirements']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(umfang, feld).toHaveProperty(feld);
    }
  });

  it('die vier Klassen stehen da, und was der Skill ueber Traeger sagt, rechnet der Vertrag so', () => {
    for (const klasse of KLASSEN) expect(skill, klasse).toContain(`**${klasse}`);

    // „Gilt quer": die Gegenmassnahme am System steht in satisfiers und zaehlt nicht in die Traeger.
    const davor = riskCarriers(alsGraph(modell())).risks[0];
    expect(davor.satisfiers).toContainEqual({ mitigation: 'REQ-mit-sys', by: 'SYS-x' });
    expect(davor.carriers, 'am Modul: jede Blattfunktion des Moduls traegt').toEqual(['FUNC-a', 'FUNC-b', 'FUNC-c']);

    // „Tieferlegen": der Zug aus dem Vorbild des Skills, am Probemodell nachgezogen.
    expect(skill).toMatch(/^~ REQ-\S+\n@kinds \["functional"\]$/m);
    expect(skill).toMatch(/^- MOD-\S+ -satisfy-> REQ-\S+$/m);
    expect(skill).toMatch(/^\+ FUNC-\S+ -satisfy-> REQ-\S+$/m);
    const m = modell();
    (m.elements.find((e) => e.id === 'REQ-mit-mod')!.attributes as { kinds: string[] }).kinds = ['functional'];
    m.traces = m.traces.filter((t) => !(t.source === 'MOD-m' && t.target === 'REQ-mit-mod'));
    m.traces.push({ source: 'FUNC-a', target: 'REQ-mit-mod', type: 'satisfy' });
    expect(riskCarriers(alsGraph(m)).risks[0].carriers, 'danach genau ein Traeger').toEqual(['FUNC-a']);
  });

  it('die Grammatik steht im Text: Funktion nur funktional, die Zuordnung prueft er an der Bindung', () => {
    expect(skill).toMatch(/Funktion erfüllt nur funktionale Anforderungen/);
    expect(skill).toMatch(/nicht-funktionale[^\n]*(Kette, Modul oder System)/);
    expect(skill).toContain('`realRef`');
    expect(skill).toMatch(/Funktion fehlt[^\n]*Item/);
  });

  it('Schritt 3: der Skill fragt je Fluss und schlaegt die Werte vor, die die Ontologie kennt', () => {
    expect(skill).toContain('Wartet die Antwort des Abnehmers auf diese Lieferung?');
    for (const wert of FlowSync.options) expect(skill, wert).toMatch(new RegExp(`^@sync ${wert}$`, 'm'));
    expect(skill).toMatch(/zwei Flüsse/);
    expect(skill).toMatch(/außerhalb[^\n]*nicht vollständig/);
  });

  it('er baut nicht selbst um und beurteilt weder Risiko noch Laufzeit', () => {
    expect(skill).toMatch(/schlägst vor[^\n]*Autor wählt/);
    expect(skill).toMatch(/beurteilst kein Risiko und keine Laufzeit/);
  });
});
