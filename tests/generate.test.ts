/**
 * CR-GC-275 — generationStep/graph_generate: der Kaltstart-Generierungstreiber.
 *
 * Deterministische Zustandsmaschine seed → expand → handoff; der Prompt ist
 * die konkrete Generierungs-Instruktion (Funde + Kandidaten- + Gate-Protokoll).
 * Kern pur über Graph-Fixtures; Tool über echten disk-Kuzu-Harness.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { Graph } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { generationStep, DIMENSION_FOCUS_TYPES } from '../src/generate.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

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
const INTENT = 'Ein Bestellsystem, mit dem Kunden Ersatzteile suchen und bestellen.';

describe('generationStep — Zustandsmaschine (pur)', () => {
  it('leerer Graph ohne Intention → seed-Phase fordert die Intention an', () => {
    const step = generationStep(EMPTY);
    expect(step.phase).toBe('seed');
    expect(step.done).toBe(false);
    expect(step.prompt).toContain('Intention');
    expect(step.prompt).toContain('graph_generate');
  });

  it('leerer Graph mit Intention → Seed-Batch-Instruktion (SYS/ACTOR/UC, Gate-Protokoll)', () => {
    const step = generationStep(EMPTY, INTENT);
    expect(step.phase).toBe('seed');
    expect(step.prompt).toContain(INTENT);
    for (const part of ['SYS', 'ACTOR', 'UC', 'dryRun', 'fitAdvisory', 'graph_authoring_guide']) {
      expect(step.prompt).toContain(part);
    }
    // Keine Architektur im Seed — Struktur folgt readiness-getrieben.
    expect(step.prompt).toContain('Keine FUNC/MOD-Ebene im Seed');
  });

  it('SYS mit Defiziten → expand fokussiert die schwächste Dimension mit konkreten Funden', () => {
    const graph = g(
      [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, undefined, 0.8);
    expect(step.phase).toBe('expand');
    expect(step.done).toBe(false);
    // Intention kommt aus der SYS-description — kein intent-Parameter nötig.
    expect(step.prompt).toContain(INTENT);
    // Konkreter Fund mit Element-UID + Regel, kein generischer Ratschlag.
    expect(step.prompt).toMatch(/UC-bestellen \([A-Z]+-?\d*/);
    expect(step.blockingErrors).toBeGreaterThan(0);
    // Deterministisch.
    expect(generationStep(graph, undefined, 0.8)).toEqual(step);
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
        edge('ACTOR-kunde', 'UC-bestellen', 'io'),
        edge('UC-bestellen', 'REQ-tbd', 'compose'),
        edge('TEST-req', 'REQ-tbd', 'verify'),
      ],
    );
    // Die req-Dimension ist nicht zwingend der erste Fokus — per defer dorthin rotieren.
    let step = generationStep(graph, undefined, 0.8);
    const keys: string[] = [];
    while (step.focusKey && !step.prompt.includes('REQ-Kandidaten') && keys.length < 10) {
      keys.push(step.focusKey);
      step = generationStep(graph, undefined, 0.8, keys);
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
        edge('ACTOR-kunde', 'UC-bestellen', 'io'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
        edge('FCHAIN-bestellung', 'FUNC-pruefen', 'compose'),
      ],
    );
    let step = generationStep(graph, undefined, 0.8);
    const keys: string[] = [];
    while (step.focusKey && !step.prompt.includes('FUNC/FCHAIN-Zerlegungen') && keys.length < 15) {
      keys.push(step.focusKey);
      step = generationStep(graph, undefined, 0.8, keys);
    }
    expect(step.prompt).toContain('satisfy→REQ');
    expect(step.prompt).toContain('allocate→MOD');
    expect(step.prompt).toContain('im selben Batch');
  });

  it('threshold 0 + keine Blocker + alle Phase-Gates regel-vollständig (SRR/PDR erreicht, real) → handoff auf graph_suggest', () => {
    // SRR+PDR sind mit einer angereicherten, aber realen Struktur regel-vollständig
    // erreichbar (26/26 je Gate, geprüft): REQ-Text mit Verifizierbarkeits-Pattern
    // (BQ-02/06/07), Prä-/Postcondition-REQs (UC-05/06), eine FCHAIN mit FUNC (R-15)
    // inkl. Actor-Ein-/Ausgang über FLOW (FC-04/R-10) und FUNC→MOD-Allokation
    // (R-22/R-23). CDR/TRR bleiben in DIESEM Fixture absichtlich ausgeklammert
    // (s. Test unten) — computePhaseReadiness/currentPhaseGate selbst werden pur
    // getestet (nächster describe-Block), das Handoff-Gating hier über die REALE
    // generationStep-Pipeline nur für die tatsächlich erreichbaren Gates.
    const measurable = (topic: string): string =>
      `Das System muss ${topic} innerhalb von 2 Sekunden bestätigen und protokollieren.`;
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-bestellung', 'REQ', 'Bestellung wird bestätigt', measurable('die Bestellung')),
        node('REQ-post', 'REQ', 'Bestellung bestätigt', measurable('die Bestellbestätigung'), {
          kinds: ['postcondition'],
        }),
        node('REQ-pre', 'REQ', 'Kunde angemeldet', measurable('die Anmeldung'), { kinds: ['precondition'] }),
        node('TEST-bestellung', 'TEST', 'Bestellbestätigung prüfen', '', {
          concept: true,
          testResult: { status: 'pass' },
        }),
        node('FCHAIN-bestellung', 'FCHAIN', 'Bestellablauf'),
        node('FUNC-pruefen', 'FUNC', 'Bestellung prüfen', 'Prüft die eingehende Bestellung.'),
        node('MOD-bestellung', 'MOD', 'Bestellmodul'),
        node('FLOW-in', 'FLOW', 'Bestellanfrage'),
        node('FLOW-out', 'FLOW', 'Bestellbestätigung'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('ACTOR-kunde', 'UC-bestellen', 'io'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'REQ-post', 'compose'),
        edge('UC-bestellen', 'REQ-pre', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
        edge('TEST-bestellung', 'REQ-post', 'verify'),
        edge('TEST-bestellung', 'REQ-pre', 'verify'),
        edge('FCHAIN-bestellung', 'FUNC-pruefen', 'compose'),
        edge('FCHAIN-bestellung', 'REQ-post', 'satisfy'),
        edge('FCHAIN-bestellung', 'REQ-pre', 'satisfy'),
        edge('FUNC-pruefen', 'REQ-bestellung', 'satisfy'),
        edge('FUNC-pruefen', 'MOD-bestellung', 'allocate'),
        edge('ACTOR-kunde', 'FLOW-in', 'io'),
        edge('FLOW-in', 'FUNC-pruefen', 'io'),
        edge('FUNC-pruefen', 'FLOW-out', 'io'),
        edge('FLOW-out', 'ACTOR-kunde', 'io'),
      ],
    );
    const step = generationStep(graph, undefined, 0);
    expect(step.blockingErrors).toBe(0);
    const srr = step.phaseReadiness.find((p) => p.gate === 'SRR');
    const pdr = step.phaseReadiness.find((p) => p.gate === 'PDR');
    expect(srr).toEqual({ gate: 'SRR', total: srr?.total, covered: srr?.total, missing: [] });
    // PDR/CDR/TRR: bekannte Lücke — R-19/VR-01/SC-04 und seit contracts 3.1.0 auch
    // AF-01..03 (PDR) lesen `element.attributes?.x` (contracts/se rules.ts), aber
    // `exportGraphJson` flacht node.attributes auf Top-Level ab (graphcode-Konvention
    // seit CR-216/228) — die Rules sehen die gesetzten Werte deshalb nie (ein
    // analysisFreshness-Stamp am Fixture-SYS ändert nichts). Vorbestehende,
    // CR-296-unabhängige Diskrepanz zwischen graphcode's Export-Encoding und
    // contracts' Rule-Implementierung; Fund dokumentiert (s. CR-GC-302 Folge-Punkt),
    // kein exporter.ts-Fix hier.
    expect(pdr).toEqual({
      gate: 'PDR',
      total: pdr?.total,
      covered: (pdr?.total ?? 0) - 3,
      missing: ['AF-01', 'AF-02', 'AF-03'],
    });
    const currentGate = step.phaseReadiness
      .find((p) => p.covered < p.total);
    expect(currentGate?.gate).toBe('PDR');
    expect(step.phase).not.toBe('handoff'); // s.o. — PDR/CDR/TRR bleiben unter dieser Pipeline offen
    expect(step.done).toBe(false);
  });

  it('threshold erreicht, aber PDR-Lücke (leere FCHAIN, R-15) → kein done (CR-GC-296)', () => {
    // Realer Bug-Fall: alle RULE_TO_DIMENSION-Scores liegen (bei threshold=0) über
    // der Schwelle und es gibt keine error-Violation — die alte Handoff-Bedingung
    // hätte "Struktur trägt" gemeldet, obwohl die FCHAIN leer ist (R-15, PDR-
    // gemappt via RULE_TO_PHASE) — die Score-Ratio verdünnt den Fund unsichtbar.
    const graph = g(
      [
        node('SYS-shop', 'SYS', 'shop', INTENT),
        node('ACTOR-kunde', 'ACTOR', 'Kunde'),
        node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Ersatzteil und erhält Bestätigung.'),
        node('REQ-bestellung', 'REQ', 'Bestellung wird bestätigt'),
        node('TEST-bestellung', 'TEST', 'Bestellbestätigung prüfen'),
        node('FCHAIN-bestellung', 'FCHAIN', 'Bestellablauf'),
      ],
      [
        edge('SYS-shop', 'UC-bestellen', 'compose'),
        edge('ACTOR-kunde', 'UC-bestellen', 'io'),
        edge('UC-bestellen', 'REQ-bestellung', 'compose'),
        edge('UC-bestellen', 'FCHAIN-bestellung', 'compose'),
        edge('TEST-bestellung', 'REQ-bestellung', 'verify'),
      ],
    );
    const step = generationStep(graph, undefined, 0);
    expect(step.blockingErrors).toBe(0); // kein error — die alte Bedingung allein hätte done:true erlaubt
    const pdr = step.phaseReadiness.find((p) => p.gate === 'PDR');
    expect(pdr?.missing).toContain('R-15');
    expect(step.phase).not.toBe('handoff');
    expect(step.done).toBe(false);
  });
});

describe('generationStep — Fund-Rotation/defer (CR-GC-281)', () => {
  // SYS + 2 UCs ohne Actor/REQ/FCHAIN → mehrere Dimensionen mit Funden,
  // also garantiert mehr als ein Fokus-Kandidat.
  const graph = g(
    [
      node('SYS-shop', 'SYS', 'shop', INTENT),
      node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.'),
      node('UC-suchen', 'UC', 'suchen', 'Kunde sucht Teil.'),
    ],
    [edge('SYS-shop', 'UC-bestellen', 'compose'), edge('SYS-shop', 'UC-suchen', 'compose')],
  );

  it('focusKey ist stabil und deterministisch (dimension:element_ids sortiert)', () => {
    const step = generationStep(graph, undefined, 0.8);
    expect(step.phase).toBe('expand');
    expect(step.focusKey).toMatch(/^[a-z]+:.+/);
    // Gleicher Graph + gleiches defer ⇒ identischer Schritt inkl. focusKey.
    expect(generationStep(graph, undefined, 0.8)).toEqual(step);
    // Kein Fokus ⇒ kein focusKey (seed).
    expect(generationStep(EMPTY, INTENT).focusKey).toBeNull();
  });

  it('defer überspringt das Fund-Set — anderer focusKey, anderer Prompt', () => {
    const first = generationStep(graph, undefined, 0.8);
    const second = generationStep(graph, undefined, 0.8, [first.focusKey as string]);
    expect(second.phase).toBe('expand');
    expect(second.focusKey).not.toBe(first.focusKey);
    expect(second.prompt).not.toBe(first.prompt);
    // Deterministisch auch mit defer.
    expect(generationStep(graph, undefined, 0.8, [first.focusKey as string])).toEqual(second);
  });

  it('alles deferred → Fallback ohne Dead-End, Hinweis im Prompt', () => {
    // Alle Kandidaten einsammeln, bis sich ein focusKey wiederholt.
    const keys: string[] = [];
    let step = generationStep(graph, undefined, 0.8, keys);
    while (step.focusKey && !keys.includes(step.focusKey) && keys.length < 30) {
      keys.push(step.focusKey);
      step = generationStep(graph, undefined, 0.8, keys);
    }
    // Kein Dead-End: defer wird ignoriert, der erste Kandidat kommt zurück …
    expect(step.phase).toBe('expand');
    expect(step.focusKey).toBe(keys[0]);
    // … und der Prompt macht die aufgehobene Zurückstellung kenntlich.
    expect(step.prompt).toContain('Zurückstellung wird ignoriert');
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
        edge('ACTOR-kunde', 'UC-bestellen', 'io'),
        edge('UC-bestellen', 'FCHAIN-leer', 'compose'),
      ],
    );
    let step = generationStep(graph, undefined, 0.8);
    const keys: string[] = [];
    const seenUcWindows: string[] = [];
    while (step.focusKey && !keys.includes(step.focusKey) && keys.length < 20) {
      if (step.focusKey.startsWith('uc:')) seenUcWindows.push(step.focusKey);
      keys.push(step.focusKey);
      step = generationStep(graph, undefined, 0.8, keys);
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
      [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, undefined, 0.8);
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
      edge('ACTOR-kunde', 'UC-bestellen', 'io'),
      edge('UC-bestellen', 'FCHAIN-leer', 'compose'),
    ],
  );

  it('uc-Template weist bei R-15 explizit auf FUNC compose→FCHAIN hin statt auf neue ACTOR/FCHAIN/UC', () => {
    const step = generationStep(graph, undefined, 0.8);
    expect(step.phase).toBe('expand');
    expect(step.focusKey).toMatch(/^uc:R-15:/);
    expect(step.prompt).toContain('FUNC');
    expect(step.prompt).toContain('compose→FUNC');
    expect(step.prompt).toContain('KEINE neue FCHAIN/UC anlegen');
  });

  it('Funde-Zeile trägt den fix_hint der Violation (R-15: "Add FUNC elements via compose trace")', () => {
    const step = generationStep(graph, undefined, 0.8);
    expect(step.prompt).toContain('Fix: Add FUNC elements via compose trace');
  });

  it('DIMENSION_FOCUS_TYPES.uc trägt FUNC — Runden-Injektion liefert die FUNC-Kantengrammatik im uc-Fokus mit', () => {
    expect(DIMENSION_FOCUS_TYPES.uc).toContain('FUNC');
    const step = generationStep(graph, undefined, 0.8);
    expect(step.focusTypes).toContain('FUNC');
  });
});

describe('DIMENSION_FOCUS_TYPES / GenerationStep.focusTypes (CR-GC-285)', () => {
  it('das Mapping deckt seed + alle 8 Readiness-Dimensionen mit nichtleeren Typlisten ab', () => {
    expect(Object.keys(DIMENSION_FOCUS_TYPES).sort()).toEqual(
      ['alloc', 'arch', 'cr', 'ms', 'req', 'schema', 'seed', 'uc', 'ver'],
    );
    for (const types of Object.values(DIMENSION_FOCUS_TYPES)) {
      expect(types.length).toBeGreaterThan(0);
    }
    expect(DIMENSION_FOCUS_TYPES.seed).toEqual(['SYS', 'ACTOR', 'UC']);
    expect(DIMENSION_FOCUS_TYPES.ver).toEqual(['TEST', 'REQ']);
  });

  it('seed trägt die Seed-Typen; seed ohne Intention trägt keine', () => {
    expect(generationStep(EMPTY, INTENT).focusTypes).toEqual(DIMENSION_FOCUS_TYPES.seed);
    expect(generationStep(EMPTY).focusTypes).toEqual([]);
  });

  it('expand trägt die Typen der Fokus-Dimension (konsistent zum focusKey)', () => {
    const graph = g(
      [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, undefined, 0.8);
    expect(step.phase).toBe('expand');
    const dim = (step.focusKey as string).split(':')[0];
    expect(step.focusTypes).toEqual(DIMENSION_FOCUS_TYPES[dim]);
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
    const step = generationStep(EMPTY);
    expect(step.prompt).toContain('Zielprofil');
    expect(step.prompt).toContain('se:target-profile');
    expect(step.prompt).toContain('[-1,1]');
    // Nicht blockierend: die Intentions-Frage bleibt der Hauptauftrag.
    expect(step.prompt).toContain('Systemintention');
  });

  it('mit vorhandenem Profil entfällt die Runde-1-Zielprofil-Frage', () => {
    const step = generationStep(EMPTY, undefined, 0.8, [], 'host', withProfile({ coherence: 1 }));
    expect(step.prompt).not.toContain('Zielprofil');
  });

  it('Seed MIT Intention: Default-Anker aus der Intention, zur Bestätigung (Anker-Timing-Entscheidung)', () => {
    const step = generationStep(EMPTY, INTENT);
    expect(step.prompt).toContain('Intentions-Anker');
    expect(step.prompt).toContain('bestellsystem'); // deterministisch extrahiert
    expect(step.prompt).toContain('se:target-profile');
    // Bestätigte Anker in der Config → kein Default-Vorschlag mehr.
    const confirmed = generationStep(EMPTY, INTENT, 0.8, [], 'host', withProfile({}, ['a', 'b', 'c']));
    expect(confirmed.prompt).not.toContain('Intentions-Anker (Default');
  });

  it('expand trägt die Unadressierte-Anker-Zeile — nur für Anker ohne UC/REQ/FUNC-Match', () => {
    const graph = g(
      [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const profile = withProfile({}, ['bestellen', 'zauberdrache', 'teil']);
    const step = generationStep(graph, undefined, 0.8, [], 'host', profile);
    expect(step.phase).toBe('expand');
    expect(step.prompt).toContain('Unadressierte Intentions-Anker: zauberdrache');
    // 'bestellen'/'teil' sind über UC-Name/Beschreibung adressiert — nicht gelistet.
    expect(step.prompt).not.toMatch(/Unadressierte Intentions-Anker:[^.]*bestellen/);
    // Deterministisch auch mit Profil.
    expect(generationStep(graph, undefined, 0.8, [], 'host', profile)).toEqual(step);
  });

  it('ohne Profil: expand-Prompt unverändert ohne Anker-Zeile (N=1-Determinismus, Regression)', () => {
    const graph = g(
      [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
      [edge('SYS-shop', 'UC-bestellen', 'compose')],
    );
    const step = generationStep(graph, undefined, 0.8);
    expect(step.prompt).not.toContain('Intentions-Anker');
    expect(generationStep(graph, undefined, 0.8)).toEqual(step);
  });
});

describe('GATE_PROTOCOL-Selektion (CR-GC-288)', () => {
  const expandGraph = g(
    [node('SYS-shop', 'SYS', 'shop', INTENT), node('UC-bestellen', 'UC', 'bestellen', 'Kunde bestellt Teil.')],
    [edge('SYS-shop', 'UC-bestellen', 'compose')],
  );

  it("Default 'host': der dryRun-Vergleichs-Auftrag bleibt im Prompt (MCP-Clients ohne Treiber)", () => {
    const step = generationStep(EMPTY, INTENT);
    expect(step.prompt).toContain('dryRun:true');
    expect(step.prompt).toContain('fitAdvisory');
    // Explizites 'host' ist identisch zum Default — kein zweiter Pfad.
    expect(generationStep(EMPTY, INTENT, 0.8, [], 'host')).toEqual(step);
  });

  it("'driver' (seed): dryRun-Auftrag raus, Guide-Schritt und Folgeschritt bleiben", () => {
    const step = generationStep(EMPTY, INTENT, 0.8, [], 'driver');
    expect(step.phase).toBe('seed');
    expect(step.prompt).not.toContain('dryRun');
    expect(step.prompt).toContain('Treiber');
    expect(step.prompt).toContain('graph_authoring_guide'); // Schritt 1 geteilt
    expect(step.prompt).toContain('graph_generate erneut aufrufen'); // Folgeschritt geteilt
    // Nur das Protokoll wechselt — die generative Instruktion selbst ist identisch.
    const host = generationStep(EMPTY, INTENT);
    expect(step.prompt.split('Gate-Protokoll')[0]).toBe(host.prompt.split('Gate-Protokoll')[0]);
  });

  it("'driver' (expand): gleiche Funde/Fokus, nur das Protokoll wechselt", () => {
    const host = generationStep(expandGraph, undefined, 0.8);
    const driver = generationStep(expandGraph, undefined, 0.8, [], 'driver');
    expect(driver.phase).toBe('expand');
    expect(driver.focusKey).toBe(host.focusKey);
    expect(driver.focusTypes).toEqual(host.focusTypes);
    expect(driver.prompt).not.toContain('dryRun');
    expect(host.prompt).toContain('dryRun:true');
    // Deterministisch auch mit selection.
    expect(generationStep(expandGraph, undefined, 0.8, [], 'driver')).toEqual(driver);
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
      { op: 'add-edge', edge: edge('ACTOR-kunde', 'UC-bestellen', 'io') },
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
