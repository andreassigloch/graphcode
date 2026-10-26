/**
 * CR-GC-295 — die Profildatei als Steuer-Config; seit CR-GC-861 traegt sie nur noch die Themen.
 *
 * CR-GC-861 (Teil 3 von CR-GC-853): Gewichte und Zielwerte sind aus dem Vertrag zurueckgebaut. Eine Datei,
 * die sie noch traegt, scheitert laut mit Pfad — nie still als „kein Profil". Die Themen
 * (`intentAnchors`) bleiben; `graph_generate` liest sie. Loader pur, Werkzeuge ueber echten disk-Kuzu.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';
import {
  TargetProfileSchema,
  TARGET_PROFILE_REL,
  loadTargetProfile,
  extractIntentAnchors,
  intentCoverage,
} from '../src/loop/target-profile.js';
import type { GraphSuggestResult } from '../src/loop/suggest.js';

const ANKER = ['lokal', 'nachts', 'unterwegs'];

describe('TargetProfileSchema: nur die Themen (CR-GC-295, CR-GC-861)', () => {
  it('akzeptiert ein Profil mit Themen', () => {
    expect(TargetProfileSchema.parse({ intentAnchors: ANKER })).toEqual({ intentAnchors: ANKER });
  });

  it('leeres Objekt ist gültig — ein Profil ohne Themen ist noch keins', () => {
    expect(TargetProfileSchema.parse({})).toEqual({});
  });

  it('Gewichte und Zielwerte gibt es nicht mehr: eine Datei damit scheitert laut (strict)', () => {
    expect(TargetProfileSchema.safeParse({ weights: { coherence: 1 } }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ values: { coherence: 4.5 } }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ intentAnchors: ANKER, weights: {} }).success).toBe(false);
  });

  it('intentAnchors: 3–7 Strings', () => {
    expect(TargetProfileSchema.safeParse({ intentAnchors: ['a', 'b'] }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ intentAnchors: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }).success).toBe(false);
    expect(TargetProfileSchema.safeParse({ intentAnchors: ['a', 'b', 'c'] }).success).toBe(true);
  });
});

describe('loadTargetProfile — der EINE Lesepfad', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-target-profile-'));
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('fehlende Datei → null (kein Profil ist gültig)', () => {
    expect(loadTargetProfile(tmp)).toBeNull();
  });

  it('Hand-Edit mit Themen laedt die Themen', () => {
    writeFileSync(join(tmp, TARGET_PROFILE_REL), JSON.stringify({ intentAnchors: ANKER }));
    expect(loadTargetProfile(tmp)).toEqual({ profile: { intentAnchors: ANKER } });
  });

  it('ungültige Datei scheitert laut mit Pfad — auch eine mit Gewichten (CR-GC-861)', () => {
    writeFileSync(join(tmp, TARGET_PROFILE_REL), JSON.stringify({ weights: { coherence: 1 }, intentAnchors: ANKER }));
    expect(() => loadTargetProfile(tmp)).toThrow(/target-profile.*Schema/);
    writeFileSync(join(tmp, TARGET_PROFILE_REL), '{nicht json');
    expect(() => loadTargetProfile(tmp)).toThrow(/kein gültiges JSON/);
  });
});

describe('Intentions-Anker — Extraktion + Coverage (KPI, nie Veto)', () => {
  const INTENT = 'Ein Bestellsystem, mit dem Kunden Ersatzteile suchen und bestellen.';

  it('extrahiert deterministisch Inhaltswörter (Funktionswörter raus, max 7, Erstauftritts-Reihenfolge)', () => {
    const anchors = extractIntentAnchors(INTENT);
    // CR-GC-687: nur Substantive — `suchen`/`bestellen` sind Verben, kein Begriff, zu dem ein
    // Use Case fehlen koennte.
    expect(anchors).toEqual(['bestellsystem', 'kunden', 'ersatzteile']);
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

describe('CR-GC-483/861: die Profildatei rankt nicht und traegt keine Zielmarke', () => {
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
    mkdirSync(join(tmp, '.graphcode'), { recursive: true });
    writeFileSync(join(tmp, TARGET_PROFILE_REL), JSON.stringify({ intentAnchors: ANKER }));
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('graph_suggest nimmt kein `target` mehr entgegen und liefert keins zurueck', async () => {
    // Ein Aufrufer, der noch `target` schickt, bekommt kein Verhalten dafuer — das Feld
    // faellt beim Parsen weg, statt still zu gewichten.
    const parsed = tools.graph_suggest.inputSchema.parse({ target: { scalability: 1 } });
    expect(parsed).not.toHaveProperty('target');
    const res = (await tools.graph_suggest.handler(parsed)) as GraphSuggestResult;
    expect(res).not.toHaveProperty('target');
    expect(res.advisoryLayer).toBe('arch');
  });

  it('graph_metrics traegt den Ist-Vektor, aber keine Zielmarke (CR-GC-861)', async () => {
    const res = (await tools.graph_metrics.handler({})) as { fit: Record<string, unknown> };
    expect(res.fit).toHaveProperty('metrics');
    expect(res.fit).not.toHaveProperty('target');
  });
});
