/**
 * TEST-skill-reports-measured-values (CR-GC-390) — verifies REQ-skill-reads-only:
 * "Ein lesender Skill bezieht jede Aussage seiner Ausgabe aus mindestens einem
 *  lesenden Werkzeug der MCP-Registry und ruft kein schreibendes Werkzeug auf."
 *
 * Grundgesamtheit ist NICHT hier aufgezaehlt: sie kommt aus dem Graphen — die
 * FUNCs, die `FCHAIN-skill-report` per compose fuehrt. Wer einen Skill in die
 * Kette haengt, unterwirft ihn damit automatisch diesem Test. Die Datei jedes
 * Skills kommt aus seiner `realRef` (kein zweiter Pfad-Begriff im Test).
 *
 * Die Werkzeugnamen kommen aus der LIVE-Registry (`bindToolsToHarness`), nicht
 * aus einer Konstante: ein umbenanntes oder entferntes Tool faellt hier auf.
 * Die Read/Write-Partition ist explizit, weil die Registry selbst kein
 * Schreib-Flag traegt — dafuer prueft `partition is exhaustive`, dass JEDES
 * Registry-Tool zugeordnet ist. Ein NEUES Tool macht diesen Test rot, bis
 * jemand entscheidet, ob es liest oder schreibt. Genau das ist der Zweck.
 *
 * Real disk Kuzu (temp dir) baut die echte Registry; keine Mocks.
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

/** Werkzeuge, die den Graphen VERAENDERN. Alles andere liest. */
const WRITE_TOOLS = [
  'graph_mutate',
  'graph_realize',
  'graph_reseed',
  'graph_merge',
  'graph_test_ingest',
  'graph_export',
  'graph_generate',
];

type Element = { id: string; type: string; realRef?: { file?: string } | null };
type Trace = { source: string; target: string; type: string };

function graph(): { elements: Element[]; traces: Trace[] } {
  return JSON.parse(readFileSync(GRAPH, 'utf8'));
}

/** Die FUNCs, die eine Kette per compose fuehrt — die Grundgesamtheit aus dem Modell. */
function chainMembers(chainUid: string): Element[] {
  const g = graph();
  const byId = new Map(g.elements.map((e) => [e.id, e]));
  return g.traces
    .filter((t) => t.type === 'compose' && t.source === chainUid)
    .map((t) => byId.get(t.target))
    .filter((e): e is Element => !!e && e.type === 'FUNC');
}

/** Nur die prompt-realisierten Glieder: die dem Skill-Modul zugeteilten FUNCs. */
function skillMembers(chainUid: string): Element[] {
  const g = graph();
  const inSkills = new Set(
    g.traces.filter((t) => t.type === 'allocate' && t.target === 'MOD-skills').map((t) => t.source),
  );
  return chainMembers(chainUid).filter((e) => inSkills.has(e.id));
}

function toolsNamedIn(text: string, tools: string[]): string[] {
  return tools.filter((t) => new RegExp(`\\b${t}\\b`).test(text));
}

describe('TEST-skill-reports-measured-values: lesende Skills lesen und schreiben nicht', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let registry: string[];

  beforeAll(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-skill-report-'));
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

  it('partition is exhaustive — jedes Registry-Tool ist als lesend oder schreibend eingeordnet', () => {
    // Ein NEUES MCP-Tool macht diesen Test rot, bis es eingeordnet ist. Ohne
    // diese Zusicherung koennte ein neues Schreibwerkzeug still in einem
    // lesenden Skill landen, weil es in WRITE_TOOLS fehlt.
    const unknownWrites = WRITE_TOOLS.filter((t) => !registry.includes(t));
    expect(unknownWrites, 'WRITE_TOOLS nennt Tools, die es nicht (mehr) gibt').toEqual([]);
  });

  it('die Kette ist besetzt — sonst prueft dieser Test nichts', () => {
    expect(skillMembers('FCHAIN-skill-report').length).toBeGreaterThan(0);
  });

  it.each(skillMembers('FCHAIN-skill-report').map((e) => [e.id, e.realRef?.file] as const))(
    '%s liest ueber die Registry und schreibt nicht',
    (uid, file) => {
      expect(file, `${uid} hat keine realRef`).toBeTruthy();
      const abs = join(REPO, file!);
      expect(existsSync(abs), `${uid}: realRef zeigt auf ${file}, das es nicht gibt`).toBe(true);
      const text = readFileSync(abs, 'utf8');

      const readTools = registry.filter((t) => !WRITE_TOOLS.includes(t));
      expect(
        toolsNamedIn(text, readTools).length,
        `${uid} nennt kein lesendes Werkzeug der Registry`,
      ).toBeGreaterThan(0);
      expect(
        toolsNamedIn(text, WRITE_TOOLS),
        `${uid} ist ein lesender Skill, nennt aber ein schreibendes Werkzeug`,
      ).toEqual([]);
    },
  );
});
