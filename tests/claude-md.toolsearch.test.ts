/**
 * CR-GC-638 — die Werkzeugtabelle in CLAUDE.md liefert die ToolSearch-Abfrage mit.
 *
 * In Claude Code sind MCP-Werkzeuge deferred: ihr Schema ist nicht geladen, ein Aufruf verlangt
 * vorher `ToolSearch`. Bash liegt immer bereit — gemessen am Referenz-Change gewann grep das
 * Lesen (2 ToolSearch-Aufrufe, beide fuer graph_mutate). Die Zeile laedt alle Leser in EINEM Aufruf.
 *
 * Gegen Drift: jeder Name der Zeile muss im echten MCP-Register stehen (kein erfundenes Werkzeug),
 * das Praefix muss der Server-Name aus .mcp.json sein, und jedes Lese-Werkzeug, das die Tabelle
 * nennt, muss in der Zeile stehen — sonst laedt die Zeile nicht, was die Tabelle empfiehlt.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../src/surface/create-harness.js';
import { bindToolsToHarness, NON_CONSULTING_TOOLS } from '../src/surface/mcp-tools.js';

const ROOT = join(__dirname, '..');
const CLAUDE_MD = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');

async function registeredTools(): Promise<string[]> {
  const dir = mkdtempSync(join(tmpdir(), 'gc-638-'));
  const h = await createHarness({ repoRoot: dir, scope: { workspaceId: 'v', systemId: 'v' } });
  await h.initialize();
  const names = Object.keys(bindToolsToHarness(h));
  await h.close();
  rmSync(dir, { recursive: true, force: true });
  return names;
}

/** Die Namen aus der Zeile `ToolSearch select:a,b,c` — genau eine solche Zeile. */
function toolSearchNames(): string[] {
  const hits = [...CLAUDE_MD.matchAll(/ToolSearch select:([A-Za-z0-9_,]+)/g)];
  expect(hits, 'CLAUDE.md traegt genau eine ToolSearch-select-Zeile').toHaveLength(1);
  return hits[0][1].split(',');
}

/** Die Werkzeugnamen, die die Tabelle „Ask the graph" nennt. */
function tableTools(registered: string[]): string[] {
  const section = CLAUDE_MD.split("## Ask the graph, don't grep for it")[1].split('\n## ')[0];
  const table = section.split('\n').filter((l) => l.startsWith('| ')).join('\n');
  return registered.filter((n) => new RegExp('`' + n + '[`(]').test(table));
}

describe('CR-GC-638: CLAUDE.md laedt die Lese-Werkzeuge mit einem ToolSearch-Aufruf', () => {
  it('das Praefix ist der Server-Name aus .mcp.json', () => {
    const servers = Object.keys(JSON.parse(readFileSync(join(ROOT, '.mcp.json'), 'utf8')).mcpServers);
    expect(servers).toContain('graphcode');
    for (const n of toolSearchNames()) expect(n.startsWith('mcp__graphcode__'), n).toBe(true);
  });

  it('nennt nur Werkzeuge, die es im MCP-Register gibt, und keine Schreiber', async () => {
    const registered = await registeredTools();
    for (const full of toolSearchNames()) {
      const n = full.replace(/^mcp__graphcode__/, '');
      expect(registered, `${n} ist kein registriertes Werkzeug`).toContain(n);
      expect(NON_CONSULTING_TOOLS.has(n), `${n} ist kein Lese-Werkzeug`).toBe(false);
    }
  }, 60_000);

  it('laedt jedes Lese-Werkzeug, das die Tabelle empfiehlt', async () => {
    const registered = await registeredTools();
    const readers = tableTools(registered).filter((n) => !NON_CONSULTING_TOOLS.has(n));
    expect(readers.length, 'Gegenprobe: die Tabelle nennt Lese-Werkzeuge').toBeGreaterThan(5);
    const loaded = toolSearchNames().map((f) => f.replace(/^mcp__graphcode__/, ''));
    expect(readers.filter((n) => !loaded.includes(n)), 'von der Tabelle genannt, nicht geladen').toEqual([]);
  }, 60_000);
});
