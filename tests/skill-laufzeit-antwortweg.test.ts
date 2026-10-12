/**
 * CR-GC-783 — der Skill `se-laufzeit` liest den Antwortweg einer Wirkkette aus `graph_metrics`
 * (`answerPath`, `answerPathBlockedBy`; gerechnet in `chainMetrics`, CR-SM-408) und rechnet nichts.
 *
 * Der Test bindet den Skill-Text an den Vertrag in `@sigloch/contracts/se` und an die Hilfe zu
 * `graph_metrics`: nennt der Text ein Feld, das die Zeile der Kette nicht traegt, ist er rot. Was
 * der Text ueber den Weg behauptet (verhindert ohne Merkmal, verhindert bei synchronem Warten nach
 * draussen, kuerzer nach dem Vorverlagern), wird am Probemodell nachgerechnet. Muster:
 * `tests/skill-fmea-orte.test.ts`, `tests/skill-vorbereitung-felder.test.ts`.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS, FlowSync, chainMetrics, functionCriticality, requirementScope } from '@sigloch/contracts/se';
import { TOOL_HELP } from '../src/projections/tool-help.js';

const skill = readFileSync(join(__dirname, '..', '.claude', 'commands', 'se-laufzeit.md'), 'utf8');
const hilfe = TOOL_HELP.graph_metrics.se;

type Graph = Parameters<typeof chainMetrics>[0];
type Element = { id: string; type: string; name: string; attributes?: Record<string, unknown> };
type Modell = { elements: Element[]; traces: Array<{ source: string; target: string; type: string }> };

/**
 * Kette „Stand ansehen" (x): der Akteur fragt die Anzeige, die Anzeige ruft beim Aufruf die Ablage
 * (`FLOW-stand`, sync). Die Erfassung speist die Ablage im eigenen Takt (`FLOW-mess`, async) und ist
 * Glied der Kette y, die sich die Ablage mit x teilt.
 */
function modell(): Modell {
  return {
    elements: [
      { id: 'SYS-x', type: 'SYS', name: 'x' }, { id: 'UC-x', type: 'UC', name: 'x' },
      { id: 'FCHAIN-x', type: 'FCHAIN', name: 'Stand ansehen' }, { id: 'FCHAIN-y', type: 'FCHAIN', name: 'Erfassen' },
      { id: 'ACTOR-a', type: 'ACTOR', name: 'a' },
      { id: 'FUNC-anzeige', type: 'FUNC', name: 'Anzeige' }, { id: 'FUNC-ablage', type: 'FUNC', name: 'Ablage' },
      { id: 'FUNC-erfassung', type: 'FUNC', name: 'Erfassung' },
      { id: 'FLOW-in', type: 'FLOW', name: 'in', attributes: { sync: 'sync' } },
      { id: 'FLOW-stand', type: 'FLOW', name: 'stand', attributes: { sync: 'sync' } },
      { id: 'FLOW-out', type: 'FLOW', name: 'out', attributes: { sync: 'sync' } },
      { id: 'FLOW-mess', type: 'FLOW', name: 'mess', attributes: { sync: 'async' } },
      { id: 'MOD-ui', type: 'MOD', name: 'ui' }, { id: 'MOD-daten', type: 'MOD', name: 'daten' },
      { id: 'REQ-laufzeit', type: 'REQ', name: 'Laufzeit', attributes: { kinds: ['non-functional'] } },
    ],
    traces: [
      { source: 'SYS-x', target: 'UC-x', type: 'compose' },
      { source: 'UC-x', target: 'FCHAIN-x', type: 'compose' }, { source: 'UC-x', target: 'FCHAIN-y', type: 'compose' },
      { source: 'FCHAIN-x', target: 'FUNC-anzeige', type: 'compose' }, { source: 'FCHAIN-x', target: 'FUNC-ablage', type: 'compose' },
      { source: 'FCHAIN-y', target: 'FUNC-erfassung', type: 'compose' }, { source: 'FCHAIN-y', target: 'FUNC-ablage', type: 'compose' },
      { source: 'ACTOR-a', target: 'FLOW-in', type: 'io' }, { source: 'FLOW-in', target: 'FUNC-anzeige', type: 'io' },
      { source: 'FUNC-ablage', target: 'FLOW-stand', type: 'io' }, { source: 'FLOW-stand', target: 'FUNC-anzeige', type: 'io' },
      { source: 'FUNC-anzeige', target: 'FLOW-out', type: 'io' }, { source: 'FLOW-out', target: 'ACTOR-a', type: 'io' },
      { source: 'FUNC-erfassung', target: 'FLOW-mess', type: 'io' }, { source: 'FLOW-mess', target: 'FUNC-ablage', type: 'io' },
      { source: 'FUNC-anzeige', target: 'MOD-ui', type: 'allocate' }, { source: 'FUNC-ablage', target: 'MOD-daten', type: 'allocate' },
      { source: 'FUNC-erfassung', target: 'MOD-daten', type: 'allocate' },
      { source: 'FCHAIN-x', target: 'REQ-laufzeit', type: 'satisfy' },
    ],
  };
}

const alsGraph = (m: Modell): Graph => m as unknown as Graph;
const zeile = (m: Modell): Record<string, unknown> =>
  chainMetrics(alsGraph(m)).chains.find((c) => c.chainId === 'FCHAIN-x') as Record<string, unknown>;
const fluss = (m: Modell, id: string): Element => m.elements.find((e) => e.id === id)!;

describe('se-laufzeit liest den Antwortweg, er rechnet ihn nicht (CR-GC-783)', () => {
  it('der Kopf traegt Version 1 und den Namen des Skills', () => {
    expect(skill).toMatch(/^name: se-laufzeit$/m);
    expect(skill).toMatch(/^version: 1$/m);
  });

  it('der Skill-Text traegt keine Rechnung und keine Kennzahl, die es nicht gibt', () => {
    expect(skill).toMatch(/rechnest keine Kennzahl/);
    expect(skill, 'keine Rechenvorschrift').not.toMatch(/÷|Quotient|Durchschnitt|Mittelwert|Summe|Prozent|%/);
    // `syncDepth` bleibt `null`; wer es nennt, behauptet eine Tiefe.
    expect(skill).not.toContain('syncDepth');
    expect(skill).toMatch(/Länge der Liste/);
  });

  it('die beiden Felder des Antwortwegs traegt die bewertbare Zeile, und die Hilfe erklaert sie', () => {
    const k = zeile(modell());
    expect(k.measurable, 'Praemisse: die Probekette ist bewertbar').toBe(true);
    for (const feld of ['answerPath', 'answerPathBlockedBy']) {
      expect(skill, feld).toContain(`\`${feld}`);
      expect(k, `chainMetrics ohne ${feld}`).toHaveProperty(feld);
      expect(hilfe, `Hilfe ohne ${feld}`).toContain(`\`${feld}\``);
    }
    // Die Hilfe behauptet nicht mehr, das Modell trage kein Attribut dafuer.
    expect(hilfe).not.toMatch(/trägt dafür kein Attribut/);
    expect(k.syncDepth).toBeNull();
  });

  it('der Antwortweg der Probekette: Anzeige und Ablage, die Erfassung steht nicht darauf', () => {
    const k = zeile(modell());
    expect(k.answerPath).toEqual(['FUNC-ablage', 'FUNC-anzeige']);
    expect(k.answerPathBlockedBy).toEqual([]);
    expect(skill).toMatch(/verlässt die Kette nicht/);
  });

  it('ohne Merkmal endet der Lauf mit den hindernden Fluessen und dem Verweis auf se-vorbereitung', () => {
    expect(skill).toMatch(/`answerPath: null`[^\n]*endet[^\n]*`answerPathBlockedBy`[^\n]*`se-vorbereitung`/);
    const m = modell();
    delete fluss(m, 'FLOW-out').attributes;
    const k = zeile(m);
    expect(k.answerPath).toBeNull();
    expect(k.answerPathBlockedBy).toEqual(['FLOW-out']);
    // Die Liste nennt, worauf der Weg trifft: `FLOW-stand` dahinter traegt das Merkmal, zaehlt also nicht.
    expect(skill).toMatch(/nicht jeden Fluss ohne Merkmal/);
    expect(hilfe).toMatch(/nicht jeden Fluss ohne Merkmal/);
  });

  it('synchrones Warten auf eine Funktion ausserhalb der Kette verhindert die Aussage ebenso', () => {
    expect(skill).toMatch(/`sync`[^\n]*außerhalb der Kette[^\n]*nicht vollständig/);
    const m = modell();
    fluss(m, 'FLOW-mess').attributes = { sync: 'sync' };
    const k = zeile(m);
    expect(k.answerPath).toBeNull();
    expect(k.answerPathBlockedBy).toEqual(['FLOW-mess']);
  });

  it('eine nicht bewertbare Kette beendet den Lauf, und kein Glied am Akteur ist der leere Weg', () => {
    expect(skill).toMatch(/`measurable: false`[^\n]*endet[^\n]*`reasons`[^\n]*`se-vorbereitung`/);
    expect(skill).toMatch(/`answerPath: \[\]`[^\n]*kein Glied liefert einem Akteur synchron/);
    const m = modell();
    fluss(m, 'FLOW-out').attributes = { sync: 'async' };
    expect(zeile(m).answerPath).toEqual([]);
  });

  it('der Skill setzt kein Merkmal: die Werte nennt er, einen Zug dafuer traegt er nicht', () => {
    for (const wert of FlowSync.options) expect(skill, wert).toContain(`\`${wert}\``);
    expect(skill, 'kein Zug, der das Merkmal setzt').not.toMatch(/^@sync /m);
    expect(skill).toMatch(/setzt kein Merkmal/);
    expect(skill).toMatch(/schätzt keine Zeit/);
  });

  it('der Umfang kommt aus scope, die Reichweite aus functions, und jedes Feld traegt der Vertrag', () => {
    expect(skill).toMatch(/graph_metrics\(\{ scope: \["<FCHAIN-uid>"\] \}\)/);
    const umfang = requirementScope(alsGraph(modell()), ['FCHAIN-x']) as Record<string, unknown>;
    for (const feld of ['modules', 'chains', 'requirements']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(umfang, feld).toHaveProperty(feld);
    }
    expect(umfang.requirements, 'Praemisse: die Laufzeitanforderung an der Kette liegt im Umfang').toContain('REQ-laufzeit');
    const reichweite = functionCriticality(alsGraph(modell())).find((f) => f.funcId === 'FUNC-ablage') as Record<string, unknown>;
    for (const feld of ['chains', 'useCases']) expect(reichweite, feld).toHaveProperty(feld);
    expect(reichweite.chains, 'die Ablage ist geteilt').toBe(2);
    for (const feld of ['functions', 'useCases']) expect(skill, feld).toContain(`\`${feld}\``);
  });

  it('jedes Ortsfeld, das der Skill nennt, traegt die Zeile der Kette', () => {
    const k = zeile(modell());
    for (const feld of ['shared', 'fanIn', 'branching', 'memberCount', 'loops']) {
      expect(skill, feld).toContain(`\`${feld}\``);
      expect(k, feld).toHaveProperty(feld);
    }
    expect(k.shared, 'die geteilte Funktion steht auf dem Antwortweg').toEqual(['FUNC-ablage']);
    expect(skill).toMatch(/`loops`[^\n]*`members`/);
  });

  it('die Ergebnisse a bis d stehen da, mit der Anforderung an das Datenalter', () => {
    for (const teil of ['**a — ', '**b — ', '**c — ', '**d — ']) expect(skill, teil).toContain(teil);
    expect(skill).toMatch(/Zu jeder Laufzeitanforderung[^\n]*Anforderung an das Datenalter/);
    expect(skill).toMatch(/Den Wert nennt der Autor/);
    expect(skill).toMatch(/Konflikt[^\n]*\*\*an der geteilten\n?\s*Funktion\*\*/);
  });

  it('der Vorschlag hat die feste Form der FMEA, der Preis nennt Datenalter und Schnittstelle', () => {
    expect(skill).toContain('`Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis`');
    for (const klasse of ['Vorverlagern', 'Entkoppeln']) expect(skill, klasse).toContain(`**${klasse}:**`);
    expect(skill).toMatch(/Prognose \(was besser wird, was gleich bleibt\)/);
    expect(skill).toMatch(/\*\*Datenalter\*\*/);
    expect(skill).toMatch(/\*\*Schnittstelle der Funktion, die speist\*\*/);
    expect(skill).toMatch(/zwei Flüsse/);
    expect(skill).toMatch(/Du wendest ihn nicht an/);
    expect(skill).toContain('`se:optimize`');
  });

  it('was der Skill ueber das Vorverlagern sagt, rechnet der Vertrag so: das speisende Glied verlaesst den Weg', () => {
    // Der Vorschlag des Vorbilds, am Probemodell nachgezogen: ein eigener Fluss mit async statt des Abrufs.
    const m = modell();
    m.elements.push({ id: 'FLOW-moment', type: 'FLOW', name: 'Momentanstand', attributes: { sync: 'async' } });
    m.traces = m.traces.filter((t) => t.source !== 'FLOW-stand' && t.target !== 'FLOW-stand');
    m.elements = m.elements.filter((e) => e.id !== 'FLOW-stand');
    m.traces.push(
      { source: 'FUNC-ablage', target: 'FLOW-moment', type: 'io' },
      { source: 'FLOW-moment', target: 'FUNC-anzeige', type: 'io' },
    );
    const k = zeile(m);
    expect(k.measurable, 'Praemisse: die Kette bleibt bewertbar').toBe(true);
    expect(k.answerPath).toEqual(['FUNC-anzeige']);
    expect(skill).toMatch(/liefert vorab und verlässt den Antwortweg/);
  });

  it('das Ergebnis ist ein CR: Anforderungen gehen durchs Gate, nicht-funktional an der Kette', () => {
    expect(skill).toMatch(/Ergebnis ist ein gewöhnlicher CR/);
    expect(skill).toContain('`graph_mutate`');
    expect(skill).toMatch(/^@kinds \["non-functional"\]$/m);
    expect(skill).toMatch(/^\+ FCHAIN-\S+ -satisfy-> REQ-\S+$/m);
    expect(skill).toMatch(/^\+ TEST-\S+ -verify-> REQ-\S+$/m);
    expect(skill).toContain('`R-18`');
    expect(ALL_RULE_DEFS.find((r) => r.id === 'R-18')?.severity).toBe('error');
    expect(skill).toMatch(/Ohne Wahl des Autors schreibst du nichts/);
  });
});
