/**
 * CR-GC-295 — Zielprofil (ℝ⁶) + Intentions-Anker als Steuer-Config.
 *
 * Schema/Loader/Konflikt-Check pur; graph_suggest-Config-Default über echten
 * disk-Kuzu-Harness (real, keine Mocks). Der Konflikt-Check ist EIN Pfad:
 * er läuft bei jedem Load — ein fs.writeFileSync-Hand-Edit durchläuft
 * denselben Check wie die Skill-Route.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/surface/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import {
  TargetProfileSchema,
  TARGET_PROFILE_REL,
  loadTargetProfile,
  conflictWarnings,
  extractIntentAnchors,
  intentCoverage,
} from '../src/loop/target-profile.js';
import type { GraphSuggestResult } from '../src/loop/suggest.js';

describe('TargetProfileSchema (CR-GC-295)', () => {
  it('akzeptiert ein gültiges Profil (Gewichte + Anker)', () => {
    const parsed = TargetProfileSchema.parse({
      weights: { coherence: 0.5, scalability: 1, flowEfficiency: -0.25 },
      intentAnchors: ['bestellung', 'ersatzteile', 'kunden'],
    });
    expect(parsed.weights.scalability).toBe(1);
    expect(parsed.intentAnchors).toHaveLength(3);
  });

  it('leeres Objekt ist gültig — weights default {} (unentschieden, CR-289-Verhalten)', () => {
    expect(TargetProfileSchema.parse({}).weights).toEqual({});
  });

  it('lehnt Gewichte außerhalb [-1,1] ab', () => {
    expect(TargetProfileSchema.safeParse({ weights: { coherence: 1.5 } }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ weights: { coherence: -2 } }).success).toBe(false);
  });

  it('lehnt unbekannte Dimensionen und Felder ab (strict — Config-Typo scheitert laut)', () => {
    expect(TargetProfileSchema.safeParse({ weights: { koherenz: 1 } }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ gewichte: {} }).success).toBe(false);
  });

  it('intentAnchors: 3–7 Strings', () => {
    expect(TargetProfileSchema.safeParse({ intentAnchors: ['a', 'b'] }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ intentAnchors: Array(8).fill('x') }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ intentAnchors: ['a', 'b', 'c'] }).success).toBe(true);
  });
});

describe('Konflikt-Check — Warning, kein Block', () => {
  it('modifiability:1 + flowEfficiency:1 → Warnung, Profil bleibt gültig', () => {
    const conflicts = conflictWarnings({ modifiability: 1, flowEfficiency: 1 });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('modifiability');
    expect(conflicts[0]).toContain('flowEfficiency');
    expect(conflicts[0]).toContain('kein Block');
  });

  it('coherence:1 + scalability:0.5 → das zweite formelmäßig hergeleitete Paar feuert', () => {
    const conflicts = conflictWarnings({ coherence: 1, scalability: 0.5 });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain('scalability');
  });

  it('nur eine Seite positiv oder Gegenrichtung → keine Warnung', () => {
    expect(conflictWarnings({ modifiability: 1 })).toEqual([]);
    expect(conflictWarnings({ modifiability: 1, flowEfficiency: -1 })).toEqual([]);
    expect(conflictWarnings({})).toEqual([]);
  });
});

describe('loadTargetProfile — der EINE Check-Pfad (jeder Read prüft)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-target-profile-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('fehlende Datei → null (kein Profil ist gültig)', () => {
    expect(loadTargetProfile(tmp)).toBeNull();
  });

  it('Hand-Edit via fs.writeFileSync durchläuft denselben Konflikt-Check — Warnung, trotzdem ladbar', () => {
    // Bewusst KEINE Skill-/Helper-Route: der rohe Datei-Write simuliert den
    // manuellen Edit. Der Check sitzt im Loader, nicht im Schreiber.
    writeFileSync(
      join(tmp, TARGET_PROFILE_REL),
      JSON.stringify({ weights: { modifiability: 1, flowEfficiency: 1 } }),
    );
    const loaded = loadTargetProfile(tmp);
    expect(loaded).not.toBeNull();
    expect(loaded!.conflicts).toHaveLength(1);
    expect(loaded!.profile.weights.modifiability).toBe(1);
  });

  it('ungültige Datei scheitert laut mit Pfad — nie stumm als "kein Profil"', () => {
    writeFileSync(join(tmp, TARGET_PROFILE_REL), JSON.stringify({ weights: { coherence: 9 } }));
    expect(() => loadTargetProfile(tmp)).toThrow(/target-profile.*Schema/);
    writeFileSync(join(tmp, TARGET_PROFILE_REL), '{nicht json');
    expect(() => loadTargetProfile(tmp)).toThrow(/kein gültiges JSON/);
  });
});

describe('Intentions-Anker — Extraktion + Coverage (KPI, nie Veto)', () => {
  const INTENT = 'Ein Bestellsystem, mit dem Kunden Ersatzteile suchen und bestellen.';

  it('extrahiert deterministisch Inhaltswörter (Funktionswörter raus, max 7, Erstauftritts-Reihenfolge)', () => {
    const anchors = extractIntentAnchors(INTENT);
    expect(anchors).toEqual(['bestellsystem', 'kunden', 'ersatzteile', 'suchen', 'bestellen']);
    expect(extractIntentAnchors(INTENT)).toEqual(anchors);
  });

  it('Coverage: Anker mit Name/Beschreibungs-Match in UC/REQ/FUNC adressiert, sonst nicht', () => {
    const elements = [
      { id: 'UC-bestellen', type: 'UC', name: 'bestellen', description: 'Kunde bestellt Ersatzteile.' },
      { id: 'MOD-x', type: 'MOD', name: 'zauberdrache', description: 'zählt nicht — kein UC/REQ/FUNC' },
    ];
    const cov = intentCoverage(['ersatzteile', 'zauberdrache', 'bestellen'], elements);
    expect(cov).toEqual([
      { anchor: 'ersatzteile', addressed: true, elements: ['UC-bestellen'] },
      { anchor: 'zauberdrache', addressed: false, elements: [] },
      { anchor: 'bestellen', addressed: true, elements: ['UC-bestellen'] },
    ]);
  });
});

describe('graph_suggest — Config-Default (echter Harness, disk-Kuzu)', () => {
  let tmp: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  const FIXTURE = {
    elements: [
      { id: 'FUNC-parse', type: 'FUNC', name: 'parse', description: 'parses input' },
      { id: 'REQ-uncovered', type: 'REQ', name: 'Uncovered requirement', description: 'needs a verifying test' },
    ],
    traces: [] as Array<{ source: string; target: string; type: string }>,
  };

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-suggest-config-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    const config: HarnessConfig = {
      repoRoot: tmp,
      scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
    await harness.importGraph(FIXTURE);
    tools = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('ohne target UND ohne Config → leeres Ziel (Regression: Verhalten wie vor CR-295)', async () => {
    const input = tools.graph_suggest.inputSchema.parse({});
    const res = (await tools.graph_suggest.handler(input)) as GraphSuggestResult;
    expect(res.target).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('ohne target MIT Config → Gewichte aus .graphcode/target-profile.json', async () => {
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    writeFileSync(join(tmp, TARGET_PROFILE_REL), JSON.stringify({ weights: { scalability: 1 } }));
    const input = tools.graph_suggest.inputSchema.parse({});
    const fromConfig = (await tools.graph_suggest.handler(input)) as GraphSuggestResult;
    const explicit = (await tools.graph_suggest.handler(
      tools.graph_suggest.inputSchema.parse({ target: { scalability: 1 } }),
    )) as GraphSuggestResult;
    expect(fromConfig.target).toEqual(explicit.target);
    expect(fromConfig.target.some((w) => w !== 0)).toBe(true);
  });

  it('explizites target hat Vorrang vor der Config', async () => {
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    writeFileSync(join(tmp, TARGET_PROFILE_REL), JSON.stringify({ weights: { scalability: 1 } }));
    const fromConfig = (await tools.graph_suggest.handler(tools.graph_suggest.inputSchema.parse({}))) as GraphSuggestResult;
    const explicit = (await tools.graph_suggest.handler(
      tools.graph_suggest.inputSchema.parse({ target: { coherence: 1 } }),
    )) as GraphSuggestResult;
    expect(explicit.target).not.toEqual(fromConfig.target);
  });
});

/**
 * CR-GC-457 — der Zielwert steht auf DERSELBEN Skala wie der Ist-Wert.
 *
 * Das Gewicht (−1…1) steuert `graph_suggest`, der Zielwert (0…5) ist die Marke,
 * gegen die ein Mensch den Ist-Wert liest. Vor diesem CR gab es nur das Gewicht,
 * und ein Dashboard schrieb „heben (1.0)" neben einen Ist-Wert von 3.71 — auf der
 * Werteskala gelesen das Gegenteil dessen, was gemeint war.
 */
describe('TargetValues im Profil (CR-GC-457)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-target-values-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('akzeptiert Zielwerte auf der 0–5-Skala neben den Gewichten', () => {
    const parsed = TargetProfileSchema.parse({
      weights: { coherence: 1, scalability: -0.2 },
      values: { coherence: 4.5, scalability: 3.5 },
    });
    expect(parsed.values.coherence).toBe(4.5);
    expect(parsed.values.scalability).toBe(3.5);
    // Das Gewicht bleibt daneben stehen — zwei Felder, zwei Aufgaben.
    expect(parsed.weights.coherence).toBe(1);
  });

  it('weist Werte ausserhalb der Metrik-Skala ab — 6 und -1 sind keine Messwerte', () => {
    expect(() => TargetProfileSchema.parse({ values: { coherence: 6 } })).toThrow();
    expect(() => TargetProfileSchema.parse({ values: { coherence: -1 } })).toThrow();
    // Die Skalengrenzen selbst sind gültig (clamp05 liefert genau diese Randwerte).
    expect(TargetProfileSchema.parse({ values: { coherence: 0 } }).values.coherence).toBe(0);
    expect(TargetProfileSchema.parse({ values: { coherence: 5 } }).values.coherence).toBe(5);
  });

  it('ein bestehendes Profil ohne `values` laedt unveraendert — kein Repo muss nachziehen', () => {
    const parsed = TargetProfileSchema.parse({ weights: { coherence: 1 } });
    expect(parsed.values).toEqual({});
    expect(parsed.weights.coherence).toBe(1);
  });

  it('ein unbekanntes Dimensionswort bleibt ein Fehler (strictObject, kein stiller Tippfehler)', () => {
    expect(() => TargetProfileSchema.parse({ values: { coherenc: 4 } })).toThrow();
  });

  it('der Loader reicht die Zielwerte durch, samt Konflikt-Check auf den Gewichten', () => {
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    writeFileSync(
      join(tmp, TARGET_PROFILE_REL),
      JSON.stringify({ weights: { coherence: 1 }, values: { coherence: 4.5 } }),
    );
    const loaded = loadTargetProfile(tmp);
    expect(loaded?.profile.values).toEqual({ coherence: 4.5 });
    expect(loaded?.conflicts).toEqual([]);
  });
});
