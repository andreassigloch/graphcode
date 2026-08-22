/**
 * TEST-skill-authors-through-gate (CR-GC-390) — verifies REQ-skill-authors-through-gate:
 * "Ein Autoren-Skill erzeugt Knoten und Kanten ausschliesslich ueber graph_mutate
 *  oder graph_realize und weist an keiner Stelle einen direkten Schreibzugriff
 *  auf die Graph-SSOT an."
 *
 * ABGRENZUNG — was hier BEWUSST NICHT steht: dass ein abgelehnter Batch keinen
 * Teilstand hinterlaesst, prueft `harness.gate.test.ts` (d) und
 * `mutate.schema-guard.test.ts`; dass der Seitenweg am Hook scheitert, prueft
 * `gate.single-door.test.ts` (3). Diese Datei prueft die Luecke, die keiner der
 * drei sieht: dass die Autoren-Skills ueberhaupt AUF diesem Gate liegen. Kein
 * zweiter Pfad zu einer schon geprueften Zusicherung.
 *
 * Grundgesamtheit kommt aus dem Graphen (compose-Glieder von
 * `FCHAIN-skill-authoring`, auf MOD-skills alloziert), die Datei aus der
 * `realRef` des Knotens, die Werkzeugnamen aus der LIVE-Registry.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const REPO = join(__dirname, '..');
const GRAPH = join(REPO, 'docs', 'graph', 'graphcode.graph.json');

/** Die Tuer, durch die eine Modell-Erzeugung gehen MUSS. */
const GATE_TOOLS = ['graph_mutate', 'graph_realize'];

/**
 * Ein direkter Schreibzugriff auf die SSOT: ein Werkzeugaufruf (Write/Edit/
 * MultiEdit) oder eine Shell-Umlenkung, deren Ziel der Graph-Pfad ist. Die
 * blosse ERWAEHNUNG des Pfades ist erlaubt — mehrere Skills verbieten den
 * Hand-Edit ausdruecklich, und ein Test, der auch das rot macht, bestraft
 * genau die richtige Anweisung.
 */
const DIRECT_SSOT_WRITE = /(?:\b(?:Write|Edit|MultiEdit)\b[^\n]*|>>?\s*)docs\/graph\/[^\s`)]*\.graph\.json/;

type Element = { id: string; type: string; realRef?: { file?: string } | null };
type Trace = { source: string; target: string; type: string };

function graph(): { elements: Element[]; traces: Trace[] } {
  return JSON.parse(readFileSync(GRAPH, 'utf8'));
}

function skillMembers(chainUid: string): Element[] {
  const g = graph();
  const byId = new Map(g.elements.map((e) => [e.id, e]));
  const inSkills = new Set(
    g.traces.filter((t) => t.type === 'allocate' && t.target === 'MOD-skills').map((t) => t.source),
  );
  return g.traces
    .filter((t) => t.type === 'compose' && t.source === chainUid)
    .map((t) => byId.get(t.target))
    .filter((e): e is Element => !!e && e.type === 'FUNC' && inSkills.has(e.id));
}

describe('TEST-skill-authors-through-gate: Autoren-Skills liegen auf dem Apply-Gate', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let registry: string[];

  beforeAll(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-skill-authoring-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
    const config: HarnessConfig = {
      repoRoot,
      scope: { workspaceId: 'demo-ws', systemId: 'graphcode' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
    registry = Object.keys(bindToolsToHarness(harness));
  });

  afterAll(async () => {
    await harness?.shutdown?.();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('das Gate-Werkzeug heisst in der Registry noch so', () => {
    const missing = GATE_TOOLS.filter((t) => !registry.includes(t));
    expect(missing, 'GATE_TOOLS nennt Tools, die es nicht (mehr) gibt').toEqual([]);
  });

  it('die Kette ist besetzt — sonst prueft dieser Test nichts', () => {
    expect(skillMembers('FCHAIN-skill-authoring').length).toBeGreaterThan(0);
  });

  it.each(skillMembers('FCHAIN-skill-authoring').map((e) => [e.id, e.realRef?.file] as const))(
    '%s schreibt durchs Gate und kennt keinen Seitenweg',
    (uid, file) => {
      expect(file, `${uid} hat keine realRef`).toBeTruthy();
      const abs = join(REPO, file!);
      expect(existsSync(abs), `${uid}: realRef zeigt auf ${file}, das es nicht gibt`).toBe(true);
      const text = readFileSync(abs, 'utf8');

      const named = GATE_TOOLS.filter((t) => new RegExp(`\\b${t}\\b`).test(text));
      expect(named.length, `${uid} ist ein Autoren-Skill, nennt aber kein Gate-Werkzeug`).toBeGreaterThan(0);

      const bypass = text.match(DIRECT_SSOT_WRITE);
      expect(bypass?.[0] ?? null, `${uid} weist einen direkten Schreibzugriff auf die SSOT an`).toBeNull();
    },
  );
});
