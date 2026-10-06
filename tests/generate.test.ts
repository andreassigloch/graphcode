/**
 * CR-GC-275 — generationStep/graph_generate: der Kaltstart-Generierungstreiber.
 *
 * Deterministische Zustandsmaschine seed → expand → handoff; der Prompt ist
 * die konkrete Generierungs-Instruktion (Funde + Kandidaten- + Gate-Protokoll).
 * Kern pur über Graph-Fixtures; Tool über echten disk-Kuzu-Harness.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ALL_RULE_DEFS, DEFAULT_METRIC_POLICY, MARK_STAGE } from '@sigloch/contracts/se';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { generationStep, DIMENSION_FOCUS_TYPES, SEED_STAGES, GENERATION_TEMPLATE, EIN_BATCH, vorschlagsText, RULE_CLAUSE, SKILL_FOR_DIMENSION } from '../src/loop/generate.js';
import { ElementType } from '@sigloch/contracts/se';
import { computeMarks } from '../src/kernel/measure/readiness.js';
import { takeSteeringSnapshot } from '../src/kernel/measure/steering-snapshot.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

/**
 * CR-GC-335: die Fokus-Schwelle ist Eingabe, kein Default der Signatur. 0.8 ist der
 * Config-Startwert (`DEFAULT_FOCUS_THRESHOLD`) und steht hier als Testeingabe —
 * im Betrieb liefert ihn `harness.getFocusThreshold()`.
 */
const FOCUS = 0.8;

const node = (uid: string, type: string, name: string, description = '', attributes: Record<string, unknown> = {}) => ({
  uid,
  type,
  name,
  description,
  attributes,
});
const edge = (sourceId: string, targetId: string, edgeType: string) => ({
  sourceId,
  targetId,
  edgeType,
  attributes: {},
});
const g = (nodes: unknown[], edges: unknown[]): Graph => ({ nodes, edges }) as Graph;

const EMPTY = g([], []);

/** Stufe einer Regel, aus dem Katalog gelesen — `immer` zaehlt als 0. */
const stufeVon = (ruleId: string): number => {
  const st = ALL_RULE_DEFS.find((r) => r.id === ruleId)?.stage;
  return st === undefined || st === 'immer' ? 0 : st;
};
/** Die Marken eines Graphen aus dem Regelstrom des Steuerkatalogs — dieselbe Rechnung wie im Bericht. */
const markenVon = (graph: Graph) =>
  computeMarks(
    takeSteeringSnapshot(graph, DEFAULT_METRIC_POLICY).violations.map((v) => ({
      ruleId: v.rule_id, severity: v.severity, elementId: v.element_id, message: v.message,
    })),
  );
const INTENT = 'Ein Bestellsystem, mit dem Kunden Ersatzteile suchen und bestellen.';

describe('generationStep — Zustandsmaschine (pur)', () => {
  it('leerer Graph ohne Intention → seed-Phase fordert die Intention an', () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('seed');
    expect(step.done).toBe(false);
    expect(step.prompt).toContain('Intention');
    expect(step.prompt).toContain('graph_generate');
  });

  it('leerer Graph mit Intention → Stufe 1 fordert GENAU die SYS-Wurzel (CR-GC-559)', () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS);
    expect(step.phase).toBe('seed');
    expect(step.focusDimension).toBe('seed:sys');
    expect(step.prompt).toContain(INTENT);
    for (const part of ['SYS', 'dryRun', 'fitAdvisory', 'graph_authoring_guide']) {
      expect(step.prompt).toContain(part);
    }
    // Eine Entscheidung je Stufe: ACTORs und UCs sind eigene Schritte.
    expect(step.prompt).toContain('Noch keine ACTORs, keine UCs');
  });

  it('SYS mit Defiziten → expand fokussiert die schwächste Dimension mit konkreten Funden', () => {
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      ],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('expand');
    expect(step.done).toBe(false);
    // Intention kommt aus der SYS-description — kein intent-Parameter nötig.
    expect(step.prompt).toContain(INTENT);
    // Konkreter Fund mit Element-UID + Regel, kein generischer Ratschlag.
    expect(step.prompt).toMatch(/UC-bestellen \([A-Z]+-?\d*/);
    // CR-SM-353: UC-01/UC-02 sind Warnungen — blockingErrors zaehlt nur noch Gate-Schuld.
    expect(step.blockingErrors).toBe(0);
    // Deterministisch.
    expect(generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS)).toEqual(step);
  });

  it('req-Template fordert den TEST (TEST verify REQ) im selben Batch (CR-GC-284)', () => {
    // R-01 ist error-severity: eine REQ ohne verify-TEST im selben Batch blockt
    // das Gate — das Template darf REQ-Kandidaten nicht mehr ohne TEST fordern.
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-tbd', 'REQ', 'Bestellung', 'TBD: wird noch definiert.'),
        node('TEST-req', 'TEST', 'Test', 'Prüft die Bestellung messbar.'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('UC-bestellen', 'REQ-tbd', 'compose'),
        edge('TEST-req', 'REQ-tbd', 'verify'),
      ],
    );
    // Die req-Dimension ist nicht zwingend der erste Fokus — per defer dorthin rotieren.
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const keys: string[] = [];
    while (step.focusKey && !step.prompt.includes('REQ-Kandidaten') && keys.length < 10) {
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
    }
    expect(step.prompt).toContain('REQ-Kandidaten');
    expect(step.prompt).toContain('TEST verify REQ');
    expect(step.prompt).toContain('im selben Batch');
  });

  it('arch-Template fordert satisfy→REQ und allocate→MOD im selben Batch (CR-GC-290)', () => {
    // R-02/R-20/R-22: FUNC ohne satisfy-REQ/allocate-MOD entsteht heute unbemerkt,
    // weil das arch-Template (anders als req) die Bindung nicht im selben Atemzug verlangt.
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-bestellung', 'REQ', 'Bestellung wird bestätigt'),
        node('TEST-bestellung', 'TEST', 'Bestellbestätigung prüfen'),
        node('FCHAIN-bestellung', 'FCHAIN', 'Bestellablauf'),
        node('FUNC-pruefen', 'FUNC', 'Bestellung prüfen', 'Prüft die Bestellung.'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
        edge('FCHAIN-bestellung', 'FUNC-pruefen', 'compose'),
      ],
    );
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const keys: string[] = [];
    while (step.focusKey && !step.prompt.includes('FUNC/FCHAIN-Zerlegungen') && keys.length < 15) {
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
    }
    expect(step.prompt).toContain('satisfy→REQ');
    expect(step.prompt).toContain('allocate→MOD');
    expect(step.prompt).toContain('im selben Batch');
  });

  it('SRR und PDR erreicht, spätere Stufen offen → kein done; die Marken bleiben Bericht (CR-GC-593/748)', () => {
    // SRR+PDR sind mit einer angereicherten, aber realen Struktur regel-vollständig
    // erreichbar (26/26 je Gate, geprüft): REQ-Text mit Verifizierbarkeits-Pattern
    // (BQ-02/06/07), Prä-/Postcondition-REQs (Schreibregel, seit CR-SM-357 keine Regel), eine FCHAIN mit FUNC (R-15)
    // inkl. Actor-Ein-/Ausgang über FLOW (FC-04/R-10) und FUNC→MOD-Allokation
    // (R-22/R-23). Die Stufen danach bleiben in DIESEM Fixture absichtlich offen (keine
    // FMEA, kein Bauplan) — die Freigabe folgt allein dem Fokus, nie einer Marke.
    const measurable = (topic: string): string =>
      `Das System muss ${topic} innerhalb von 2 Sekunden bestätigen und protokollieren.`;
    const graph = g(
      [
        // CR-GC-303: die Freshness-Stamps sind jetzt GESETZT. Vor dem Fix war
        // das wirkungslos — der Steering-Pfad las den geflachten Export, in dem
        // `attributes` gar nicht existiert, also feuerten AF-01..03 unabhängig vom
        // Modellinhalt. Jetzt trägt der Stamp und PDR wird erreichbar.
        // conops gehoert zu SRR, trade/assumption-review zu PDR (Stufe der Regel, contracts 11);
        // fmea und der Bauplan (offene Auftraege) fehlen — das sind die spaeteren Stufen.
        node('SYS-shop', 'SYS', 'shop', INTENT, {
          analysisFreshness: {
            conops: { graphVersion: 1 },
            trade: { graphVersion: 1, crRefs: ['CR-trade'] },
            'assumption-review': { graphVersion: 1 },
          },
        }),
        // CR-SM-355: TR-01 (PDR) verlangt die Entscheidung als CR mit decides-Kante; MS-03 (info)
        // verlangt den Meilenstein dazu — sonst bliebe SRR an einem info-Fund haengen.
        node('MS-1', 'MS', 'Spezifikation'),
        node('CR-trade', 'CR', 'Runtime-Entscheidung festgeschrieben'),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-bestellung', 'REQ', 'Bestellung wird bestätigt', measurable('die Bestellung'), { kinds: ['functional'] }),
        // CR-GC-672: pre-/postcondition gibt es nicht mehr (Vorbedingung = Eingangs-FLOW der Kette,
        // Nachbedingung = UC-Ziel). Die FCHAIN erfuellt jetzt die Ende-zu-Ende-Grenze (non-functional).
        node('REQ-post', 'REQ', 'Bestellung Ende-zu-Ende bestätigt', measurable('die Bestellbestätigung'), {
          kinds: ['non-functional'],
        }),
        node('TEST-bestellung', 'TEST', 'Bestellbestätigung prüfen', '', {
          testResult: { status: 'pass' },
        }),
        node('FCHAIN-bestellung', 'FCHAIN', 'Bestellablauf'),
        node('FUNC-pruefen', 'FUNC', 'Bestellung prüfen', 'Prüft die eingehende Bestellung.'),
        // CR-GC-515: seit CR-SM-311 ist ein Modul mit EINER Funktion eine entartete Ebene (RD-05,
        // PDR). Das Fixture soll PDR aus Modellinhalt erreichen — also traegt es jetzt, was ein
        // echtes Bestellmodul traegt: drei Schritte statt einem.
        node('FUNC-berechnen', 'FUNC', 'Preis berechnen', 'Berechnet den Preis der geprüften Bestellung.'),
        node('FUNC-bestaetigen', 'FUNC', 'Bestellung bestätigen', 'Bestätigt die berechnete Bestellung.'),
        node('MOD-bestellung', 'MOD', 'Bestellmodul'),
        node('FLOW-in', 'FLOW', 'Bestellanfrage'),
        node('FLOW-geprueft', 'FLOW', 'Geprüfte Bestellung'),
        node('FLOW-berechnet', 'FLOW', 'Berechnete Bestellung'),
        node('FLOW-out', 'FLOW', 'Bestellbestätigung'),
        // CR-GC-488: seit CR-SM-271 ist `FLOW -relation-> SCHEMA [1..1]` GRAMMATIK und
        // meldet als R-18 (error) statt als SC-04 (warning) — ohne Vertrag traegt dieses
        // Fixture zwei Sperrfehler und misst nicht mehr, was es messen will.
        node('SCHEMA-in', 'SCHEMA', 'Bestellanfrage-Vertrag'),
        node('SCHEMA-out', 'SCHEMA', 'Bestellbestaetigung-Vertrag'),
        node('SCHEMA-geprueft', 'SCHEMA', 'Gepruefte-Bestellung-Vertrag'),
        node('SCHEMA-berechnet', 'SCHEMA', 'Berechnete-Bestellung-Vertrag'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'REQ-post', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
        edge('TEST-bestellung', 'REQ-post', 'verify'),
        edge('FCHAIN-bestellung', 'FUNC-pruefen', 'compose'),
        edge('FCHAIN-bestellung', 'FUNC-berechnen', 'compose'),
        edge('FCHAIN-bestellung', 'FUNC-bestaetigen', 'compose'),
        edge('FCHAIN-bestellung', 'REQ-post', 'satisfy'),
        edge('FUNC-pruefen', 'REQ-bestellung', 'satisfy'),
        edge('FUNC-pruefen', 'MOD-bestellung', 'allocate'),
        edge('FUNC-berechnen', 'REQ-bestellung', 'satisfy'),
        edge('FUNC-berechnen', 'MOD-bestellung', 'allocate'),
        { sourceId: 'CR-trade', targetId: 'MOD-bestellung', edgeType: 'relation', attributes: { label: 'decides' } },
        { sourceId: 'CR-trade', targetId: 'MS-1', edgeType: 'relation', attributes: {} },
        edge('FUNC-bestaetigen', 'REQ-bestellung', 'satisfy'),
        edge('FUNC-bestaetigen', 'MOD-bestellung', 'allocate'),
        edge('ACTOR-kunde', 'FLOW-in', 'io'),
        edge('FLOW-in', 'FUNC-pruefen', 'io'),
        edge('FUNC-pruefen', 'FLOW-geprueft', 'io'),
        edge('FLOW-geprueft', 'FUNC-berechnen', 'io'),
        edge('FUNC-berechnen', 'FLOW-berechnet', 'io'),
        edge('FLOW-berechnet', 'FUNC-bestaetigen', 'io'),
        edge('FUNC-bestaetigen', 'FLOW-out', 'io'),
        edge('FLOW-out', 'ACTOR-kunde', 'io'),
        edge('FLOW-in', 'SCHEMA-in', 'relation'),
        edge('FLOW-out', 'SCHEMA-out', 'relation'),
        edge('FLOW-geprueft', 'SCHEMA-geprueft', 'relation'),
        edge('FLOW-berechnet', 'SCHEMA-berechnet', 'relation'),
      ],
    );
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0);
    expect(step.blockingErrors).toBe(0);
    // CR-GC-303: die Stempel am Fixture-SYS tragen — SRR und PDR sind aus MODELLINHALT erreicht,
    // nicht durch Encoding blockiert. CR-GC-748: gelesen an den Marken des Clients, nicht mehr an einer
    // eigenen Regelabdeckung je Phase.
    const marken = markenVon(graph);
    expect(marken.find((m) => m.id === 'SRR')).toMatchObject({ reached: true, holding: [] });
    expect(marken.find((m) => m.id === 'PDR')).toMatchObject({ reached: true, holding: [] });
    // Der Schritt ist trotzdem nicht fertig: sein Fokus liegt auf einer Regel HINTER der Marke PDR.
    expect(step.phase).not.toBe('handoff');
    expect(step.done).toBe(false);
    expect(stufeVon(step.focusKey!.split(':')[1]!)).toBeGreaterThan(MARK_STAGE.PDR);
    // Und er traegt keine Phasenzeilen mehr.
    expect(step).not.toHaveProperty('phaseReadiness');
  });

  it('threshold erreicht, aber eine leere FCHAIN (R-15) → kein done, und die Marke der Regel ist offen (CR-GC-296/748)', () => {
    // Realer Bug-Fall: alle RULE_TO_DIMENSION-Scores liegen (bei threshold=0) über
    // der Schwelle und es gibt keine error-Violation — die alte Handoff-Bedingung
    // hätte "Struktur trägt" gemeldet, obwohl die FCHAIN leer ist (R-15, eine
    // Existenz-Regel) — die Score-Ratio verdünnt den Fund unsichtbar.
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-bestellung', 'REQ', 'Bestellung wird bestätigt'),
        node('TEST-bestellung', 'TEST', 'Bestellbestätigung prüfen'),
        node('FCHAIN-bestellung', 'FCHAIN', 'Bestellablauf'),
        // contracts 9.x: UC-02 (error) prüft Erreichbarkeit über ACTOR io→FLOW io→FUNC.
        // Damit der Test weiterhin „kein error, nur die R-15-Lücke" misst, trägt eine
        // ZWEITE, volle Kette die Erreichbarkeit — die leere FCHAIN bleibt der Fund.
        node('FCHAIN-voll', 'FCHAIN', 'Getragener Ablauf'),
        node('FUNC-pruefen', 'FUNC', 'Bestellung prüfen', 'Prüft die eingehende Bestellung.'),
        node('FLOW-in', 'FLOW', 'Bestellanfrage'),
        // CR-GC-488: FLOW ohne SCHEMA ist seit CR-SM-271 R-18/error, nicht SC-04/warning.
        node('SCHEMA-in', 'SCHEMA', 'Bestellanfrage-Vertrag'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
        edge('UC-bestellen', 'FCHAIN-voll', 'compose'),
        edge('FCHAIN-voll', 'FUNC-pruefen', 'compose'),
        edge('ACTOR-kunde', 'FLOW-in', 'io'),
        edge('FLOW-in', 'FUNC-pruefen', 'io'),
        edge('FLOW-in', 'SCHEMA-in', 'relation'),
      ],
    );
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0);
    expect(step.blockingErrors).toBe(0); // kein error — die alte Bedingung allein hätte done:true erlaubt
    const r15 = ALL_RULE_DEFS.find((r) => r.id === 'R-15')!;
    const marke = markenVon(graph).find((m) => m.id === r15.mark)!;
    expect(marke.reached).toBe(false);
    expect(marke.holding.some((h) => h.ruleId === 'R-15' && h.elementId === 'FCHAIN-bestellung')).toBe(true);
    expect(step.phase).not.toBe('handoff');
    expect(step.done).toBe(false);
  });
});

describe('generationStep — Fund-Rotation/defer (CR-GC-281)', () => {
  // SYS + 2 UCs ohne Actor/REQ/FCHAIN → mehrere Dimensionen mit Funden,
  // also garantiert mehr als ein Fokus-Kandidat.
  const graph = g(
    [
      node('ACTOR-kunde', 'ACTOR', 'Kunde'),
      node('SYS-shop', 'SYS', 'shop', INTENT),
      node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      node('UC-suchen', 'UC', 'suchen', 'Kunde sucht Teil.'),
    ],
    [edge('SYS-shop', 'UC-bestellen', 'compose'), edge('SYS-shop', 'UC-suchen', 'compose')],
  );

  it('focusKey ist stabil und deterministisch (dimension:element_ids sortiert)', () => {
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('expand');
    expect(step.focusKey).toMatch(/^[a-z]+:.+/);
    // Gleicher Graph + gleiches defer ⇒ identischer Schritt inkl. focusKey.
    expect(generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS)).toEqual(step);
    // Kein Fokus ⇒ kein focusKey (seed).
    expect(generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS).focusKey).toBeNull();
  });

  it('defer überspringt das Fund-Set — anderer focusKey, anderer Prompt', () => {
    const first = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const second = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, [first.focusKey as string]);
    expect(second.phase).toBe('expand');
    expect(second.focusKey).not.toBe(first.focusKey);
    expect(second.prompt).not.toBe(first.prompt);
    // Deterministisch auch mit defer.
    expect(generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, [first.focusKey as string])).toEqual(second);
  });

  it('alles deferred → stalled: kein Wiederholen, kein done, die Liste im Prompt (CR-GC-596)', () => {
    // Bis CR-GC-596 hiess dieser Test "Fallback ohne Dead-End": defer wurde ignoriert, der erste
    // Kandidat kam zurueck — genau dort entstand in Lauf 11 die Schleife (R-04 sechsmal).
    const keys: string[] = [];
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
    while (step.focusKey && !keys.includes(step.focusKey) && keys.length < 30) {
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
    }
    expect(step.phase).toBe('stalled');
    expect(step.done).toBe(false);
    expect(step.focusKey).toBeNull();
    for (const k of keys) expect(step.prompt).toContain(k);
    // CR-GC-604: unter den zurueckgestellten sind Eintrittspunkte — die Ansage ist "Task starten", nicht "Mensch".
    expect(step.prompt).toContain('Offen sind Eintrittspunkte');
    expect(step.prompt).not.toContain('Menschen');
  });
});

describe('generationStep — Fund-Fenster/Prompt-Vollständigkeit (CR-GC-290)', () => {
  it('Fund-Fenster mischt nie zwei rule_id in derselben Dimension (uc: R-15 FCHAIN-leer + UC-01 UC-ohne-REQ)', () => {
    // Realer Fall aus dem Audit (gc-run-haiku45, Batch audit-1785579447396-8092tv):
    // eine leere FCHAIN (R-15) und eine REQ-lose UC (UC-01) landeten im selben Fenster.
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('FCHAIN-leer', 'FCHAIN', 'Leerer Ablauf'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('UC-bestellen', 'FCHAIN-leer', 'compose'),
      ],
    );
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const keys: string[] = [];
    const seenUcWindows: string[] = [];
    while (step.focusKey && !keys.includes(step.focusKey) && keys.length < 20) {
      if (step.focusKey.startsWith('uc:')) seenUcWindows.push(step.focusKey);
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
    }
    // Jedes uc-Fenster trägt genau eine rule_id im Key (dimension:rule_id:elemente) —
    // R-15 (FCHAIN-leer) und UC-Funde (UC-bestellen) tauchen nie im selben Fenster auf.
    expect(seenUcWindows.length).toBeGreaterThan(0);
    for (const key of seenUcWindows) {
      const [, ruleId] = key.split(':');
      expect(ruleId).toMatch(/^[A-Z]+-\d+$/);
    }
    expect(new Set(seenUcWindows).size).toBe(seenUcWindows.length);
  });

  it('Prompt trägt kein "(Score X, N Funde)" mehr — die "Funde: ..."-Liste bleibt', () => {
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      ],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('expand');
    expect(step.prompt).not.toMatch(/\(Score [\d.]+,\s*\d+ Funde\)/);
    expect(step.prompt).toContain('Funde: ');
  });
});

describe('generationStep — R-15 Stagnations-Fix (CR-GC-290-Nachtrag, Messlauf-Befund)', () => {
  // Messlauf-Befund (devstral, v18-bo3-Config + CR-290/291): 24 Runden lang im
  // uc-Fokus festgefahren — R-15 (FCHAIN ohne compose→FUNC) sitzt in der 'uc'-
  // Dimension, aber weder das uc-Template noch DIMENSION_FOCUS_TYPES.uc noch die
  // Funde-Zeile erwähnten FUNC/fix_hint. Das Modell befolgte das Template
  // wörtlich (mehr ACTOR/FCHAIN/UC) und erzeugte dadurch IMMER MEHR R-15-Funde,
  // statt die leere FCHAIN mit FUNC zu befüllen — ein sich selbst verstärkender
  // Loop, den CR-290s reine Rule-ID-Fenster (viele Runden am Stück nur R-15)
  // sichtbar machten.
  const graph = g(
    [
      node('SYS-shop', 'SYS', 'shop', INTENT),
      node('ACTOR-kunde', 'ACTOR', 'Kunde'),
      node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
      node('FCHAIN-leer', 'FCHAIN', 'Leerer Ablauf'),
    ],
    [
      edge('SYS-shop', 'UC-bestellen', 'compose'),
      edge('UC-bestellen', 'FCHAIN-leer', 'compose'),
    ],
  );

  it('uc-Template weist bei R-15 explizit auf FUNC compose→FCHAIN hin statt auf neue ACTOR/FCHAIN/UC', () => {
    // contracts 9.x: auf einer leeren Kette feuert FC-01 zwangsläufig mit (eine
    // Actor-Grenze über den Eltern-UC gibt es ohne ACTOR io→UC nicht mehr) und
    // rankt lexikographisch vor R-15 — per defer ins R-15-Fenster rotieren.
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const keys: string[] = [];
    while (step.focusKey && !/^uc:R-15:/.test(step.focusKey) && keys.length < 10) {
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    expect(step.phase).toBe('expand');
    expect(step.focusKey).toMatch(/^uc:R-15:/);
    expect(step.prompt).toContain('FUNC');
    expect(step.prompt).toContain('compose→FUNC');
    // CR-GC-564: die Klausel IST die Anweisung. Vorher wurde sie an das Dimensions-Template
    // angehaengt und musste es mit „KEINE neue FCHAIN" widerrufen — zwei Imperative, der
    // zweite nahm den ersten zurueck. Jetzt steht das Template gar nicht mehr daneben.
    expect(step.prompt).not.toContain('FCHAIN-Szenarien (UC compose FCHAIN)');
    expect(step.prompt).not.toContain('KEINE neue FCHAIN');
    // Die Klausel benennt die konkreten Funde, statt global zu verbieten (CR-GC-358).
    expect(step.prompt).toContain('FCHAIN-leer');
  });

  it('je Fenster genau EIN Imperativ: Klausel oder Template, nie beide (CR-GC-358/564)', () => {
    // Der Widerspruch, den qwen3.8 auseinandernahm: das uc-Template trug den Satz
    // "KEINE neue FCHAIN/UC anlegen" unbedingt — also auch neben Funden, deren Fix
    // GENAU das Anlegen einer FCHAIN ist ("FCHAIN-Szenarien (UC compose FCHAIN)").
    // CR-GC-564 loest das an der Wurzel: wo eine Klausel existiert, entfaellt das Template.
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const keys: string[] = [];
    let checkedNonR15 = 0;
    let checkedR15 = 0;
    while (step.focusKey && !keys.includes(step.focusKey) && keys.length < 20) {
      if (step.focusKey.startsWith('uc:')) {
        const [, ruleId] = step.focusKey.split(':');
        const template = 'FCHAIN-Szenarien (UC compose FCHAIN)';
        if (ruleId === 'R-15') {
          expect(step.prompt).toContain('3±2 FUNC-Elemente');
          expect(step.prompt, 'Klausel UND Template im selben Prompt').not.toContain(template);
          checkedR15++;
        } else if (ruleId === 'UC-01' || ruleId === 'UC-02') {
          expect(step.prompt, 'Klausel UND Template im selben Prompt').not.toContain(template);
          checkedNonR15++;
        } else {
          // Regel ohne eigene Klausel ⇒ das Dimensions-Template ist der Imperativ.
          expect(step.prompt).toContain(template);
          expect(step.prompt).not.toContain('3±2 FUNC-Elemente');
          checkedNonR15++;
        }
      }
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, keys);
    }
    // Beide Zweige müssen wirklich durchlaufen worden sein, sonst prüft der Test nichts.
    expect(checkedR15).toBeGreaterThan(0);
    expect(checkedNonR15).toBeGreaterThan(0);
  });

  it('Funde-Zeile trägt den fix_hint der Violation (R-15: "Add FUNC elements via compose trace")', () => {
    // Wie oben: erst ins R-15-Fenster rotieren (FC-01 rankt seit contracts 9.x davor).
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const keys: string[] = [];
    while (step.focusKey && !/^uc:R-15:/.test(step.focusKey) && keys.length < 10) {
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    expect(step.prompt).toContain('Fix: Add FUNC elements via compose trace');
  });

  it('DIMENSION_FOCUS_TYPES.uc trägt FUNC — Runden-Injektion liefert die FUNC-Kantengrammatik im uc-Fokus mit', () => {
    expect(DIMENSION_FOCUS_TYPES.uc).toContain('FUNC');
    // CR-GC-566: im R-15-Fenster bestimmt die KLAUSEL die Typen, nicht die Dimension —
    // und sie nennt genau die zwei, um die es geht. Dorthin rotieren statt das erste
    // beliebige uc-Fenster zu nehmen (das ist seit CR-GC-563 UC-01 und redet über REQ).
    const keys: string[] = [];
    let step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    while (step.focusKey && !/^uc:R-15:/.test(step.focusKey) && keys.length < 10) {
      keys.push(step.focusKey);
      step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    expect(step.focusKey).toMatch(/^uc:R-15:/);
    expect(step.focusTypes).toContain('FUNC');
  });
});

describe('DIMENSION_FOCUS_TYPES / GenerationStep.focusTypes (CR-GC-285)', () => {
  it('das Mapping trägt genau die 8 Readiness-Dimensionen — der Seed ist keine (CR-GC-559)', () => {
    expect(Object.keys(DIMENSION_FOCUS_TYPES).sort()).toEqual(
      ['alloc', 'arch', 'cr', 'ms', 'req', 'schema', 'uc', 'ver'],
    );
    for (const types of Object.values(DIMENSION_FOCUS_TYPES)) {
      expect(types.length).toBeGreaterThan(0);
    }
    expect(DIMENSION_FOCUS_TYPES.ver).toEqual(['TEST', 'REQ']);
  });

  it('Stufe 1 trägt nur SYS; seed ohne Intention trägt keine Typen', () => {
    expect(generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS).focusTypes).toEqual([...SEED_STAGES.sys]);
    expect(generationStep(EMPTY, DEFAULT_METRIC_POLICY, undefined, FOCUS).focusTypes).toEqual([]);
  });

  it('expand trägt die Typen der Fokus-Dimension (konsistent zum focusKey)', () => {
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      ],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('expand');
    const [dim, regel] = (step.focusKey as string).split(':');
    // CR-GC-566: die Klausel hat Vorrang, wenn es eine gibt — sonst die Dimension.
    expect(step.focusTypes).toEqual(RULE_CLAUSE[regel]?.types ?? DIMENSION_FOCUS_TYPES[dim]);
  });

  // 'handoff trägt keine Fokus-Typen' (die literale focusTypes:[] im handoff-Return)
  // ist mit einer über generationStep erreichten 'handoff'-Phase nicht mehr sinnvoll
  // testbar, seit CR-GC-296 den zweiten Handoff-Baustein (Phase-Gate-Vollständigkeit)
  // verlangt: CDR/TRR sind über die evaluateAllRules/exportGraphJson-Pipeline für
  // JEDEN Graphen mit ≥1 TEST/FUNC strukturell nie voll abgedeckt (R-19/R-20/VR-01
  // lesen `element.attributes?.x`, exportGraphJson flacht node.attributes aber auf
  // Top-Level ab — vorbestehende, CR-296-unabhängige Diskrepanz, s. Test oben). Die
  // Literal-Garantie selbst steht im Code (der handoff-Return trägt `focusTypes: []`
  // hart, keine Berechnung) und ist über computePhaseReadiness/currentPhaseGate pur
  // getestet (nächster describe-Block).
});

// Hinweis: Ein 'local'-Minimal-Rendering (CR-GC-282) wurde hier getestet und
// nach negativer Validierung (v13b: 22 vs. 82 Elemente) wieder ENTFERNT —
// der Executor fährt das volle Rendering; siehe docs/cr/done/CR-GC-282.

describe('Zielprofil + Intentions-Anker im Prompt (CR-GC-295)', () => {
  const withProfile = (weights = {}, intentAnchors?: string[]) => ({
    profile: { weights, ...(intentAnchors ? { intentAnchors } : {}) },
    conflicts: [],
  });

  it('Runde-1-Prompt (kein SYS, keine Intention) fragt optional nach dem Zielprofil', () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.prompt).toContain('Zielprofil');
    expect(step.prompt).toContain('se:target-profile');
    expect(step.prompt).toContain('[-1,1]');
    // Nicht blockierend: die Intentions-Frage bleibt der Hauptauftrag.
    expect(step.prompt).toContain('Systemintention');
  });

  it('mit vorhandenem Profil entfällt die Runde-1-Zielprofil-Frage', () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', withProfile({ coherence: 1 }));
    expect(step.prompt).not.toContain('Zielprofil');
  });

  it('Seed MIT tragfähiger Intention: KEINE Anker-Rückfrage mehr (CR-GC-307)', () => {
    // CR-GC-295 legte dem Menschen hier die extrahierten Anker zur Bestätigung vor.
    // Der Begriff ist Steuerungsinternes — der Kunde kann damit nichts anfangen, und
    // ein Frontier-Modell hat die Vorschläge später ohnehin still korrigiert. Die
    // Anker werden jetzt im Hintergrund gesetzt (Tool-Schicht), nicht erfragt.
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS);
    expect(step.prompt).not.toMatch(/Intentions-Anker/i);
    expect(step.prompt).not.toContain('se:target-profile');
    // Der eigentliche Seed-Auftrag bleibt unberührt.
    expect(step.prompt).toContain('Kaltstart aus der Intention');
  });

  it('Seed MIT zu dünner Intention: fachliche Rückfragen statt Steuerungs-Jargon (CR-GC-307)', () => {
    // "Ein System zum Verwalten von Daten" parst sauber und verankert nichts — jedes
    // dieser Wörter matcht fast jedes Element, die Coverage läse 100% und sagte nichts.
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, 'Ein System zum Verwalten von Daten');
    expect(step.prompt).toMatch(/FACHFRAGEN/);
    expect(step.prompt).not.toMatch(/Intentions-Anker/i);
    // Der Prompt verbietet dem Modell ausdrücklich, nach der Steuerung zu fragen.
    expect(step.prompt).toMatch(/Frage NICHT nach Steuerungs-Einstellungen/);
  });

  it('expand trägt die Unadressierte-Anker-Zeile — nur für Anker ohne UC/REQ/FUNC-Match', () => {
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      ],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const profile = withProfile({}, ['bestellen', 'zauberdrache', 'teil']);
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', profile);
    expect(step.phase).toBe('expand');
    // CR-GC-307: Klartext statt Steuerungs-Vokabular — der Mensch sieht die WIRKUNG
    // (ein Thema kommt nirgends vor), nie den Mechanismus.
    expect(step.prompt).toContain('Noch nirgends beschrieben: zauberdrache');
    expect(step.prompt).not.toMatch(/Intentions-Anker/i);
    // 'bestellen'/'teil' sind über UC-Name/Beschreibung adressiert — nicht gelistet.
    expect(step.prompt).not.toMatch(/Noch nirgends beschrieben:[^.]*bestellen/);
    // Deterministisch auch mit Profil.
    expect(generationStep(graph, DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'host', profile)).toEqual(step);
  });

  it('ohne Profil: expand-Prompt unverändert ohne Anker-Zeile (N=1-Determinismus, Regression)', () => {
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      ],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.prompt).not.toContain('Intentions-Anker');
    expect(generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS)).toEqual(step);
  });
});

describe('CR-GC-589: der Schritt nennt seine Anleitung — eine Zuordnung fuer beide Treiber', () => {
  it('seed:uc → se:author-uc, ohne Skill → null', () => {
    const seed = generationStep(g([node('SYS-shop', 'SYS', 'shop', INTENT)], []), DEFAULT_METRIC_POLICY, INTENT, 0.8);
    expect(seed.focusDimension).toBe('seed:uc');
    expect(seed.skill).toBe('se:author-uc');
    expect(SKILL_FOR_DIMENSION['ver']).toBeUndefined(); // keine Anleitung, kein erfundener Eintrag
  });

  it('der Executor hat keine zweite Tabelle und keine zweite Entscheidung (CR-GC-655)', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/loop/executor-prompt.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/const SKILL_FOR_DIMENSION\s*[:=]/);
    // Er liest den Skill, den der Schritt nennt — nicht die Dimension.
    expect(src).not.toContain('SKILL_FOR_DIMENSION[');
    expect(src).toContain('skillDatei(step.skill)');
  });
});

describe('GATE_PROTOCOL-Selektion (CR-GC-288)', () => {
  const expandGraph = g(
    [
      node('SYS-shop', 'SYS', 'shop', INTENT),
      node('ACTOR-kunde', 'ACTOR', 'Kunde'),
      node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
    ],
    [edge('SYS-shop', 'UC-bestellen', 'compose')],
  );

  it("Default 'host': der dryRun-Vergleichs-Auftrag bleibt im Prompt (MCP-Clients ohne Treiber)", () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS);
    expect(step.prompt).toContain('dryRun:true');
    expect(step.prompt).toContain('fitAdvisory');
    // Explizites 'host' ist identisch zum Default — kein zweiter Pfad.
    expect(generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, 0.8, [], 'host')).toEqual(step);
  });

  it("'host': die Probe gilt MEHREREN Alternativen, nicht einem einzelnen Batch (CR-GC-577)", () => {
    // Gemessen an `runs/opus5-5`: sechs Paare aus Probe und Anwendung DESSELBEN Batches,
    // 20 % des graph_mutate-Payloads. Die Gegenrechnung ueber alle Laeufe: der opus5-Arm
    // probte 30-mal, 4-mal kam `block`, 3 davon wurden nicht angewandt — und diese 3 haben
    // keinen Schaden verhindert, weil eine abgelehnte Anwendung nichts persistiert.
    const klausel = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS)
      .prompt.split('Gate-Protokoll')[1];
    expect(klausel).toContain('MEHRERE Alternativen');
    // Der EINE Batch geht direkt ans Gate — und der Prompt sagt auch warum, sonst liest
    // sich die Anweisung wie eine Nachlaessigkeit statt wie eine Rechnung.
    expect(klausel).toContain('nur EINEN Batch');
    expect(klausel).toContain('persistiert nichts');
  });

  it("'host': die Rangfolge kommt aus dem Register — tier vor Steuerwert, wie rankCandidates (CR-GC-583/587)", () => {
    // CR-GC-583 hatte hier "Steuerwert vor tier" gepinnt — und damit den Widerspruch zu
    // `rankCandidates` zementiert. Seit CR-GC-587 ist der Satz aus VERDICT_ORDER abgeleitet;
    // die Ordnung selbst prueft tests/decision-texts.test.ts gegen den Komparator.
    const klausel = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS).prompt.split('Gate-Protokoll')[1];
    const tier = klausel.indexOf('tier (auto-apply > suggest)');
    const steer = klausel.indexOf('steerAdvisory.improvement');
    expect(klausel.indexOf('block verwerfen')).toBeLessThan(tier);
    expect(tier).toBeLessThan(steer);
    expect(klausel).toContain('fitAdvisory ist nur Bericht');
  });

  it("'driver' (seed): dryRun-Auftrag, Guide-Schritt und Folgeschritt raus", () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, 0.8, [], 'driver');
    expect(step.phase).toBe('seed');
    expect(step.prompt).not.toContain('dryRun');
    expect(step.prompt).toContain('Treiber');
    // CR-GC-651: auch den Guide-Schritt sagt im Treiber-Modus der Treiber, nicht der Auftrag.
    expect(step.prompt).not.toContain('graph_authoring_guide');
    // CR-GC-648: den Folgeschritt macht der Treiber — dem Modell ist graph_generate vorenthalten.
    expect(step.prompt.split('Gate-Protokoll')[1]).not.toContain('graph_generate');
    // Nur das Protokoll wechselt — die generative Instruktion selbst ist identisch.
    const host = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, FOCUS);
    expect(step.prompt.split('Gate-Protokoll')[0]).toBe(host.prompt.split('Gate-Protokoll')[0]);
  });

  it("'driver' verspricht keinen Kandidaten-Vergleich — die Klausel gilt bei einem wie bei N Kandidaten (CR-GC-568)", () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, INTENT, 0.8, [], 'driver');
    const klausel = step.prompt.split('Gate-Protokoll')[1];
    // Der Executor setzt 'driver' auch bei candidates=1; dann gibt es NICHTS zu
    // waehlen. Eine Klausel, die "jeden Kandidaten" oder "den Gewinner" nennt,
    // waere dort schlicht falsch — das Modell emittiert genau einen Batch.
    for (const wort of ['Kandidaten', 'Gewinner']) expect(klausel).not.toContain(wort);
    expect(klausel).toContain('EINEN vollständigen Batch');
    expect(klausel).toContain('keine eigenen Gate-Proben');
  });

  it('jede uid eines Klausel-Vorbilds ist als Vorbild erkennbar — kein Inhalt, der lecken kann (ITEM-2026-607)', () => {
    // Gemessen CR-GC-682 (9 Laeufe): das UC-02-Vorbild (FLOW-anfrage, FUNC-anfrage-annehmen,
    // ACTOR-nutzer, FCHAIN-sitzung, „Sitzungs-ID") stand als Inhalt in den Graphen — 63
    // Annahme-FUNCs, ACTOR nutzer in 7/9. Der Preflight (CR-GC-672) sperrt nur uids mit `beispiel`.
    const uid = /\b(?:SYS|UC|ACTOR|FCHAIN|FUNC|FLOW|REQ|TEST|MOD|SCHEMA)-[a-z][a-z0-9-]*/g;
    const lecks: string[] = [];
    for (const [regel, klausel] of Object.entries(RULE_CLAUSE)) {
      const vorbild = klausel.text(['UC-fund']).split('\n').filter((z) => /^[+~] /.test(z));
      // Erlaubt: `beispiel` (Preflight sperrt es) oder aus dem Fund abgeleitet (`fund`) — nie Domaeneninhalt.
      for (const u of vorbild.flatMap((z) => z.split('|')[0].match(uid) ?? [])) {
        if (!/(^|-)(beispiel|fund)(-|$)/.test(u)) lecks.push(`${regel}: ${u}`);
      }
    }
    expect(lecks).toEqual([]);
  });

  it('UC-02 gibt die Skelett-uids je UC vor, mit FCHAIN und ACTOR aus dem Bestand (ITEM-2026-625)', () => {
    // Gemessen S2 gcrun-333..335: qwen3-coder uebernahm FLOW/SCHEMA/FUNC-beispiel-* 4–8x je Lauf
    // woertlich, der Preflight blockte jedes Mal, die Runden verfielen. Die uids stehen jetzt fest.
    const og = {
      elements: [
        { id: 'UC-nachtlauf', type: 'UC' }, { id: 'UC-abfrage', type: 'UC' },
        { id: 'FCHAIN-nachtlauf-kette', type: 'FCHAIN' }, { id: 'ACTOR-betreiber', type: 'ACTOR' },
      ],
      traces: [{ source: 'UC-nachtlauf', target: 'FCHAIN-nachtlauf-kette', type: 'compose' }],
    };
    const text = RULE_CLAUSE['UC-02'].text(['UC-nachtlauf', 'UC-abfrage'], og as never);
    expect(text).toContain('+ FLOW-nachtlauf-eingabe|');
    expect(text).toContain('+ FUNC-nachtlauf-annehmen|');
    expect(text).toContain('+ FCHAIN-nachtlauf-kette -compose-> FUNC-nachtlauf-annehmen');
    expect(text).toContain('+ ACTOR-betreiber -io-> FLOW-nachtlauf-eingabe');
    // Kein FCHAIN im Bestand: wird angelegt und an den UC gehaengt.
    expect(text).toContain('+ FCHAIN-abfrage|');
    expect(text).toContain('+ UC-abfrage -compose-> FCHAIN-abfrage');
    expect(text).not.toMatch(/beispiel/);
  });

  it('FC-04 gibt je Kette das Skelett fuer den fehlenden Ausgang vor — FUNC und ACTOR aus dem Bestand (ITEM-2026-629)', () => {
    // Gemessen S2 gcrun-336..338: ~16 von 40 Runden Stillstand an FC-04 & Co.; FUNC -io-> FLOW und
    // FLOW -io-> ACTOR (der Ausgang) in keinem Lauf. Ohne Klausel stand dort nur der uc-Text.
    const og = {
      elements: [
        { id: 'FCHAIN-nachtlauf', type: 'FCHAIN' }, { id: 'FUNC-nachtlauf-annehmen', type: 'FUNC' },
        { id: 'FUNC-nachtlauf-ausfuehren', type: 'FUNC' }, { id: 'FLOW-nachtlauf-eingabe', type: 'FLOW' },
        { id: 'ACTOR-betreiber', type: 'ACTOR' }, { id: 'FCHAIN-leer', type: 'FCHAIN' }, { id: 'FUNC-leer-a', type: 'FUNC' },
      ],
      traces: [
        { source: 'FCHAIN-nachtlauf', target: 'FUNC-nachtlauf-annehmen', type: 'compose' },
        { source: 'FCHAIN-nachtlauf', target: 'FUNC-nachtlauf-ausfuehren', type: 'compose' },
        { source: 'ACTOR-betreiber', target: 'FLOW-nachtlauf-eingabe', type: 'io' },
        { source: 'FLOW-nachtlauf-eingabe', target: 'FUNC-nachtlauf-annehmen', type: 'io' },
        { source: 'FCHAIN-leer', target: 'FUNC-leer-a', type: 'compose' },
      ],
    };
    const text = RULE_CLAUSE['FC-04'].text(['FCHAIN-nachtlauf', 'FCHAIN-leer'], og as never);
    // Eingang da → nur der Ausgang, an der LETZTEN FUNC der Kette.
    expect(text).toContain('+ FUNC-nachtlauf-ausfuehren -io-> FLOW-nachtlauf-ergebnis');
    expect(text).toContain('+ FLOW-nachtlauf-ergebnis -io-> ACTOR-betreiber');
    expect(text).toContain('+ FLOW-nachtlauf-ergebnis -relation-> SCHEMA-nachtlauf-ergebnis');
    expect(text).not.toContain('FLOW-nachtlauf-eingabe|');
    // Weder Eingang noch Ausgang → beide.
    expect(text).toContain('+ ACTOR-betreiber -io-> FLOW-leer-eingabe');
    expect(text).toContain('+ FUNC-leer-a -io-> FLOW-leer-ergebnis');
    expect(text).not.toMatch(/beispiel/);
  });

  it("'driver' verlangt je Dimension EINE Loesung, keine Alternativen im selben Batch (ITEM-2026-610)", () => {
    // Gemessen gcrun-310 (candidates=1): „2 alternative Zerlegungen, lass das Gate waehlen" — der
    // Treiber wendet den GANZEN Batch an, also landeten beide, danach Alternativen der Alternativen
    // (-alt1..alt6, -alt2-alt1), 35 von 49 REQ Dubletten. Alternativen entstehen im Treiber ueber
    // N Stichproben (Best-of-N), nie innerhalb eines Batches.
    for (const dimension of Object.keys(GENERATION_TEMPLATE)) {
      expect(vorschlagsText(dimension, 'driver'), dimension).not.toMatch(/[Aa]lternativ|Lass das Gate wählen/);
    }
    // Der Host probt selbst per dryRun — dort bleiben Alternativen richtig.
    expect(vorschlagsText('arch', 'host')).toContain('2 alternative');
    expect(vorschlagsText('arch', 'driver')).toContain('Genau EINE Zerlegung');
  });

  it("'driver' (expand): gleiche Funde/Fokus, nur das Protokoll wechselt", () => {
    const host = generationStep(expandGraph, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const driver = generationStep(expandGraph, DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'driver');
    expect(driver.phase).toBe('expand');
    expect(driver.focusKey).toBe(host.focusKey);
    expect(driver.focusTypes).toEqual(host.focusTypes);
    expect(driver.prompt).not.toContain('dryRun');
    expect(host.prompt).toContain('dryRun:true');
    // Deterministisch auch mit selection.
    expect(generationStep(expandGraph, DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'driver')).toEqual(driver);
  });
});

describe('graph_generate — MCP-Binding (echter Harness)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-generate-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    harness = new GraphCodeHarness(makeConfig(tmp), storage);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  function makeConfig(repoRoot: string): HarnessConfig {
    return {
      repoRoot,
      scope: { workspaceId: 'test-ws', systemId: 'greenfield' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
  }

  it('leerer Store → seed; nach Seed-Mutation durchs Gate → expand mit Intent aus SYS', async () => {
    const first = (await tools.graph_generate.handler({ intent: INTENT, threshold: 0.8 })) as {
      phase: string;
      prompt: string;
    };
    expect(first.phase).toBe('seed');
    expect(first.prompt).toContain(INTENT);

    const res = await harness.mutate([
      { op: 'add-node', node: node('SYS-shop', 'SYS', 'shop', INTENT) },
      { op: 'add-node', node: node('ACTOR-kunde', 'ACTOR', 'Kunde') },
      { op: 'add-node', node: node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.') },
      { op: 'add-edge', edge: edge('SYS-shop', 'UC-bestellen', 'compose') },
    ]);
    expect(res.success).toBe(true);

    const second = (await tools.graph_generate.handler({ threshold: 0.8 })) as { phase: string; prompt: string };
    expect(second.phase).toBe('expand');
    expect(second.prompt).toContain(INTENT); // aus SYS-description, ohne intent-Parameter
  });

  it("selection:'driver' schaltet die dryRun-Passage im Tool-Prompt ab; Default bleibt 'host' (CR-GC-288)", async () => {
    const host = (await tools.graph_generate.handler({ intent: INTENT })) as { prompt: string };
    expect(host.prompt).toContain('dryRun:true'); // MCP-Clients ohne Treiber: Protokoll bleibt

    const parsed = tools.graph_generate.inputSchema.parse({ intent: INTENT, selection: 'driver' });
    const driver = (await tools.graph_generate.handler(parsed)) as { prompt: string };
    expect(driver.prompt).not.toContain('dryRun');
    expect(driver.prompt).toContain('Treiber');
  });
});

describe('CR-GC-559: der Kaltstart in drei gegateten Stufen', () => {
  const sysOnly = g([node('SYS-shop', 'SYS', 'shop', INTENT)], []);
  const sysUc = g(
    [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
    [edge('SYS-shop', 'UC-bestellen', 'compose')],
  );

  it('SYS allein → Stufe 2 destilliert die UCs', () => {
    const step = generationStep(sysOnly, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('seed');
    expect(step.focusDimension).toBe('seed:uc');
    expect(step.focusTypes).toEqual([...SEED_STAGES.uc]);
    expect(step.prompt).toContain('3–7 UCs');
  });

  it('SYS + UC → Stufe 3 schneidet das Minimum distinkter ACTORs', () => {
    const step = generationStep(sysUc, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('seed');
    expect(step.focusDimension).toBe('seed:actor');
    expect(step.focusTypes).toEqual([...SEED_STAGES.actor]);
    expect(step.prompt).toContain('MINIMUM');
    // Der gemessene Fehler war die erfundene Kante — die Stufe verbietet sie ausdrücklich.
    expect(step.prompt).toContain('BLOSSE Knoten ohne Kanten');
    expect(step.prompt).toContain('ACTOR io→FLOW io→FUNC');
  });

  it('SYS + UC + ACTOR → raus aus dem Seed, der Regler übernimmt', () => {
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      ],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    expect(generationStep(graph, DEFAULT_METRIC_POLICY, undefined, FOCUS).phase).toBe('expand');
  });

  it('begonnene Struktur ohne ACTOR fällt NICHT in den Kaltstart zurück', () => {
    // Ein importierter Graph hat FUNCs und oft keine ACTORs. Dort messen UC-02/R-16/FC-04
    // auf dem expand-Pfad — eine Seed-Stufe wäre ein Rückschritt in den Kaltstart.
    const importiert = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
        node('FUNC-pruefen', 'FUNC', 'pruefen', 'Prüft die Bestellung.'),
      ],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    expect(generationStep(importiert, DEFAULT_METRIC_POLICY, undefined, FOCUS).phase).toBe('expand');
  });

  it('die Intentions-Rückfrage bleibt vorgeschaltet — ohne Intention keine Stufe', () => {
    const step = generationStep(EMPTY, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('seed');
    expect(step.focusDimension).toBeNull();
  });

  it('jede Stufe ist deterministisch', () => {
    for (const graph of [EMPTY, sysOnly, sysUc]) {
      expect(generationStep(graph, DEFAULT_METRIC_POLICY, INTENT, FOCUS)).toEqual(
        generationStep(graph, DEFAULT_METRIC_POLICY, INTENT, FOCUS),
      );
    }
  });
});

describe('CR-GC-563/605: Anweisung vor Fund — die Fundreihenfolge ist kein Alphabet', () => {
  // Der gemessene Fall aus Rig-Lauf 4: UCs ohne FCHAIN (FC-02) und dieselben UCs von keinem
  // ACTOR erreichbar (UC-02). Alphabetisch gewinnt FC-02 — zwoelf Runden lang, und kein FUNC
  // entstand. CR-GC-563 loeste das ueber die Schwere (UC-02 war error); seit CR-SM-353 sind
  // UC-01/UC-02 Warnungen, und die Ordnung haengt an der KLAUSEL (RULE_CLAUSE): eine Regel mit
  // Bauanweisung kommt vor einer, die nur meldet. Der Fund, der zuerst drankommt, bestimmt die Struktur.
  const lauf4 = g(
    [
      node('SYS-sig', 'SYS', 'SIG Local', 'Lokale LLM-Kapazitaet im internen Netz.'),
      node('ACTOR-nutzer', 'ACTOR', 'Nutzer'),
      node('UC-interactive', 'UC', 'Interactive Session', 'Nutzer fragt das lokale Modell und erhaelt eine Antwort.'),
      node('UC-scheduled', 'UC', 'Scheduled Tasks', 'Planer startet nachts eine Aufgabe und legt das Ergebnis ab.'),
      node('UC-offline', 'UC', 'Offline Operation', 'Nutzer arbeitet unterwegs ohne Netz weiter.'),
    ],
    [
      edge('SYS-sig', 'UC-interactive', 'compose'),
      edge('SYS-sig', 'UC-scheduled', 'compose'),
      edge('SYS-sig', 'UC-offline', 'compose'),
    ],
  );

  /** Die Regel des aktuellen Fund-Fensters. */
  const regelVon = (key: string | null): string => String(key).split(':')[1];

  it('das erste Fenster traegt eine Klausel-Regel, obwohl FC-02 alphabetisch vorne stuende', () => {
    const step = generationStep(lauf4, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(step.phase).toBe('expand');
    // Klausel: UC-01, UC-02 · ohne: FC-02, R-15, R-16, UC-03.
    // Alphabetisch gewaenne FC-02 — genau das ist in Rig-Lauf 4 passiert.
    expect(['UC-01', 'UC-02'], `erstes Fenster war ${regelVon(step.focusKey)}`).toContain(
      regelVon(step.focusKey),
    );
  });

  it('erst wenn KEIN Klausel-Fenster mehr offen ist, kommt der erste blosse Fund', () => {
    const gesehen: string[] = [];
    const keys: string[] = [];
    let step = generationStep(lauf4, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    for (let i = 0; i < 6 && step.focusKey && !keys.includes(step.focusKey); i++) {
      gesehen.push(regelVon(step.focusKey));
      keys.push(step.focusKey);
      step = generationStep(lauf4, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    const ersteWarnung = gesehen.findIndex((r) => !['UC-01', 'UC-02'].includes(r));
    expect(ersteWarnung, `Reihenfolge war ${gesehen.join(' → ')}`).toBeGreaterThan(0);
    // Vor dem ersten blossen Fund stehen ausschliesslich Klausel-Regeln.
    expect(gesehen.slice(0, ersteWarnung).every((r) => ['UC-01', 'UC-02'].includes(r))).toBe(true);
    // Und innerhalb eines Rangs bleibt es alphabetisch (Determinismus, CR-GC-290).
    expect(gesehen[ersteWarnung]).toBe('FC-02');
  });

  it('zweimal derselbe Graph ⇒ derselbe focusKey', () => {
    const a = generationStep(lauf4, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const b = generationStep(lauf4, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect(b.focusKey).toBe(a.focusKey);
  });

  it('ein Fenster traegt weiterhin genau EINE Regel', () => {
    const step = generationStep(lauf4, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const regel = regelVon(step.focusKey);
    // Die Fund-Liste im Prompt nennt nur Funde dieser einen Regel.
    const andere = ['FC-02', 'UC-01', 'UC-02', 'UC-03', 'R-15', 'R-16'].filter((r) => r !== regel);
    const genannt = andere.filter((r) => step.prompt.includes(`(${r}:`));
    expect(genannt, `regelfremde Funde im Fenster: ${genannt.join(', ')}`).toEqual([]);
  });
});

describe('CR-GC-564: die Regel-Klausel IST die Anweisung', () => {
  // Der gemessene Fall aus Rig-Lauf 5: UC-01 (error) ist der Fokus, der Fund sagt dreimal
  // „add REQ" — und der Imperativ darunter nannte ACTOR, FCHAIN und UC. Das Wort REQ kam
  // darin nicht vor. Das Modell folgte dem Imperativ: null REQ, zwei R-08-Blocks.
  const ohneReq = g(
    [
      node('SYS-sig', 'SYS', 'SIG Local', 'Lokale LLM-Kapazitaet im internen Netz.'),
      node('ACTOR-nutzer', 'ACTOR', 'Nutzer'),
      node('UC-interactive', 'UC', 'Interactive Session', 'Nutzer fragt das lokale Modell und erhaelt eine Antwort.'),
      node('UC-scheduled', 'UC', 'Scheduled Tasks', 'Planer startet nachts eine Aufgabe und legt das Ergebnis ab.'),
      node('UC-offline', 'UC', 'Offline Operation', 'Nutzer arbeitet unterwegs ohne Netz weiter.'),
    ],
    [
      edge('SYS-sig', 'UC-interactive', 'compose'),
      edge('SYS-sig', 'UC-scheduled', 'compose'),
      edge('SYS-sig', 'UC-offline', 'compose'),
    ],
  );

  it('UC-01 verlangt REQ — und NICHT die ACTOR/FCHAIN/UC-Aufzählung der Dimension', () => {
    const step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect((step.focusKey as string).split(':')[1]).toBe('UC-01');
    expect(step.prompt).toContain('REQ-Kandidaten');
    expect(step.prompt).toContain('UC compose→REQ');
    // Der Satz, den das Modell in Lauf 5 befolgt hat, darf nicht mehr im Prompt stehen.
    expect(step.prompt, 'das Dimensions-Template steht neben der Klausel').not.toContain(
      'FCHAIN-Szenarien (UC compose FCHAIN) oder fehlende UCs aus der Intention',
    );
  });

  it('UC-02 schreibt den legalen Pfad aus — R-18 hat ihn zwei Runden gekostet', () => {
    // UC-01 zurückstellen, dann ist UC-02 das nächste Fehler-Fenster.
    const erst = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS, [erst.focusKey as string]);
    expect((step.focusKey as string).split(':')[1]).toBe('UC-02');
    expect(step.prompt).toContain('ACTOR io→FLOW io→FUNC');
    expect(step.prompt).toContain('R-18');
  });

  it('eine Regel OHNE Klausel bekommt weiterhin das Dimensions-Template', () => {
    // UC-01 und UC-02 zurückstellen ⇒ FC-02, das keine eigene Klausel hat.
    const keys: string[] = [];
    let step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    for (let i = 0; i < 4 && ['UC-01', 'UC-02'].includes((step.focusKey as string).split(':')[1]); i++) {
      keys.push(step.focusKey as string);
      step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    expect((step.focusKey as string).split(':')[1]).toBe('FC-02');
    expect(step.prompt).toContain('FCHAIN-Szenarien (UC compose FCHAIN)');
  });

});

describe('CR-GC-566: der Fokus deckt, was die Anweisung verlangt', () => {
  const ohneReq = g(
    [
      node('SYS-sig', 'SYS', 'SIG Local', 'Lokale LLM-Kapazitaet im internen Netz.'),
      node('ACTOR-nutzer', 'ACTOR', 'Nutzer'),
      node('UC-interactive', 'UC', 'Interactive Session', 'Nutzer fragt das lokale Modell und erhaelt eine Antwort.'),
      node('UC-scheduled', 'UC', 'Scheduled Tasks', 'Planer startet nachts eine Aufgabe und legt das Ergebnis ab.'),
      node('UC-offline', 'UC', 'Offline Operation', 'Nutzer arbeitet unterwegs ohne Netz weiter.'),
    ],
    [
      edge('SYS-sig', 'UC-interactive', 'compose'),
      edge('SYS-sig', 'UC-scheduled', 'compose'),
      edge('SYS-sig', 'UC-offline', 'compose'),
    ],
  );

  it('UC-01 trägt REQ und TEST im Fokus — die Klausel verlangt beide', () => {
    const step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect((step.focusKey as string).split(':')[1]).toBe('UC-01');
    expect(step.focusTypes).toContain('REQ');
    expect(step.focusTypes).toContain('TEST');
  });

  it('UC-02 trägt FLOW im Fokus — ohne FLOW ist der legale Pfad nicht beschreibbar', () => {
    const erst = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS, [erst.focusKey as string]);
    expect((step.focusKey as string).split(':')[1]).toBe('UC-02');
    expect(step.focusTypes).toContain('FLOW');
  });

  it('eine Regel ohne Klausel bekommt die Typen ihrer Dimension', () => {
    const keys: string[] = [];
    let step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    for (let i = 0; i < 4 && ['UC-01', 'UC-02'].includes((step.focusKey as string).split(':')[1]); i++) {
      keys.push(step.focusKey as string);
      step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    expect((step.focusKey as string).split(':')[1]).toBe('FC-02');
    expect(step.focusTypes).toEqual(DIMENSION_FOCUS_TYPES.uc);
  });

  /**
   * Die eigentliche Zusicherung: nicht die drei Einzelfälle oben, sondern dass die Lücke
   * bei einem NEUEN Eintrag nicht wieder entsteht. Gemessen war sie fünfmal offen
   * (uc→FLOW, req→TEST, arch→MOD, UC-01→REQ+TEST, UC-02→FLOW), und jede dieser Lücken
   * zwingt das Modell zu einem Lese-Turn, den die Injektion sparen sollte.
   */
  it('KEIN Elementtyp, den eine Anweisung nennt, fehlt in ihren Fokus-Typen', () => {
    const typen = new Set(ElementType.options as readonly string[]);
    const genannt = (text: string): string[] =>
      [...new Set(text.match(/\b[A-Z]{2,7}\b/g) ?? [])].filter((w) => typen.has(w));
    const luecken: string[] = [];

    for (const [dimension, text] of [...Object.entries(GENERATION_TEMPLATE), ...Object.entries(EIN_BATCH)]) {
      const fokus = new Set(DIMENSION_FOCUS_TYPES[dimension] ?? []);
      for (const t of genannt(text)) {
        if (!fokus.has(t)) luecken.push(`Template ${dimension} nennt ${t}, Fokus hat es nicht`);
      }
    }
    for (const [regel, klausel] of Object.entries(RULE_CLAUSE)) {
      const fokus = new Set(klausel.types);
      // Nur der Anweisungstext, nicht die uids der konkreten Funde.
      for (const t of genannt(klausel.text([]))) {
        if (!fokus.has(t)) luecken.push(`Klausel ${regel} nennt ${t}, Fokus hat es nicht`);
      }
    }
    expect(luecken).toEqual([]);
  });
});

describe('CR-GC-648: RD-01 verlangt den Erfueller, nicht neue REQs', () => {
  // Gemessen am eigenen Modell: das RD-01-Fenster bekam das req-Template („3–5 REQ-Kandidaten
  // je UC") und die Fokus-Typen UC/REQ/TEST — keine einzige FUNC-uid in der Element-Liste, an
  // die das Modell die satisfy-Kante haette haengen koennen.
  const ohneErfueller = g(
    [
      node('SYS-sig', 'SYS', 'SIG Local', 'Lokale LLM-Kapazitaet im internen Netz.'),
      node('UC-interactive', 'UC', 'Interactive Session', 'Nutzer fragt das lokale Modell und erhaelt eine Antwort.'),
      node('REQ-latenz', 'REQ', 'Antwort unter 2 s', 'Das System muss 95 % der Antworten unter 2 s liefern.'),
      node('TEST-latenz', 'TEST', 'Latenzmessung', 'Lastlauf misst p95 der Antwortzeit, Grenze 2 s.'),
      node('FUNC-antworten', 'FUNC', 'Antworten', 'Beantwortet eine Anfrage.'),
    ],
    [
      edge('SYS-sig', 'UC-interactive', 'compose'),
      edge('UC-interactive', 'REQ-latenz', 'compose'),
      edge('TEST-latenz', 'REQ-latenz', 'verify'),
    ],
  );

  it('das RD-01-Fenster nennt satisfy von FUNC/FCHAIN/MOD/SYS und traegt die Quelltypen im Fokus', () => {
    const keys: string[] = [];
    let step = generationStep(ohneErfueller, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    for (let i = 0; i < 12 && step.focusKey && !step.focusKey.includes(':RD-01:'); i++) {
      keys.push(step.focusKey);
      step = generationStep(ohneErfueller, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    expect(step.focusKey, 'RD-01 wird Fokus').toContain(':RD-01:');
    expect(step.prompt).toContain('satisfy→REQ');
    expect(step.prompt).toContain('KEINE neue REQ');
    expect(step.prompt, 'das req-Template steht nicht daneben').not.toContain('REQ-Kandidaten');
    for (const t of ['FUNC', 'FCHAIN', 'MOD', 'SYS']) expect(step.focusTypes).toContain(t);
  });
});

describe('CR-GC-655: die Anleitung folgt dem Gewinner, nicht der Dimension', () => {
  // Gemessen (gcrun-60/62): im UC-02-Fenster stand der uc-Skill author-uc daneben; qwen3-coder schrieb
  // dessen Beispiel (SYS compose UC, UC compose FCHAIN) drei Runden lang ab, statt den ACTOR-Pfad zu
  // bauen — und ueberschrieb dabei UC-Beschreibungen.
  const ohneReq = g(
    [
      node('SYS-sig', 'SYS', 'SIG Local', 'Lokale LLM-Kapazitaet im internen Netz.'),
      node('ACTOR-nutzer', 'ACTOR', 'Nutzer'),
      node('UC-interactive', 'UC', 'Interactive Session', 'Nutzer fragt das lokale Modell und erhaelt eine Antwort.'),
      node('UC-scheduled', 'UC', 'Scheduled Tasks', 'Planer startet nachts eine Aufgabe und legt das Ergebnis ab.'),
    ],
    [edge('SYS-sig', 'UC-interactive', 'compose'), edge('SYS-sig', 'UC-scheduled', 'compose')],
  );

  it('UC-01 nennt se:author-req (die Arbeit ist REQ-Autorieren), nicht se:author-uc', () => {
    const step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    expect((step.focusKey as string).split(':')[1]).toBe('UC-01');
    expect(step.skill).toBe('se:author-req');
  });

  it('UC-02 nennt KEINEN Skill — die Klausel beschreibt den ACTOR-Pfad selbst', () => {
    const erst = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    const step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS, [erst.focusKey as string]);
    expect((step.focusKey as string).split(':')[1]).toBe('UC-02');
    expect(step.skill).toBeNull();
  });

  it('jede Klausel entscheidet ihren Skill ausdruecklich (Objekt oder null, nie „nicht gesetzt")', () => {
    for (const [regel, k] of Object.entries(RULE_CLAUSE)) {
      expect(k.skill === null || typeof k.skill?.name === 'string', regel).toBe(true);
    }
  });

  it('ein Template-Fenster (keine Klausel) behaelt den Skill seiner Dimension', () => {
    const keys: string[] = [];
    let step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS);
    for (let i = 0; i < 6 && step.focusKey && (step.focusKey.split(':')[1] as string) in RULE_CLAUSE; i++) {
      keys.push(step.focusKey);
      step = generationStep(ohneReq, DEFAULT_METRIC_POLICY, undefined, FOCUS, keys);
    }
    const regel = (step.focusKey as string).split(':')[1];
    expect(regel in RULE_CLAUSE, `Fenster ${regel}`).toBe(false);
    expect(step.skill).toBe(SKILL_FOR_DIMENSION[step.focusDimension as string]?.name ?? null);
  });
});
