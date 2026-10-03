/**
 * CR-GC-732 — `graphcode init` liefert das OpenCode-Plugin aus, das den `vorschlag` (CR-GC-729) aus der
 * Mutationsantwort nimmt und dem Nutzer ins Eingabefeld legt. Gemessen in Probe G/H (2026-10-03): der Agent
 * sah den Vorschlag nicht, der Nutzer bekam ihn vorbefuellt.
 *
 * Installiert/entfernt wird echt (Dateisystem); der Hook laeuft gegen eine ECHTE graph_mutate-Antwort (Kuzu,
 * Gate). Die TUI ist der einzige Ersatz: ein Client, der die Aufrufe aufzeichnet — eine laufende TUI gibt es
 * im Test nicht.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scaffold } from '../src/surface/scaffold.js';
import { OPENCODE_PLUGIN, packagedOpencodePlugin } from '../src/surface/scaffold-templates.js';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { alsFormatE } from './helpers/format-e.js';

let repo: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'gc-ocplugin-'));
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('CR-GC-732: OpenCode-Plugin fuer den Vorschlag', () => {
  it('init legt das Plugin byte-gleich zum Paket ab, update auch, und meldet es', async () => {
    const res = await scaffold('init', { repoRoot: repo });
    const ziel = join(repo, OPENCODE_PLUGIN);
    expect(readFileSync(ziel, 'utf8')).toBe(readFileSync(packagedOpencodePlugin(), 'utf8'));
    expect([...res.created, ...res.updated, ...res.preserved]).toContain(OPENCODE_PLUGIN);
    rmSync(ziel);
    await scaffold('update', { repoRoot: repo });
    expect(existsSync(ziel)).toBe(true);
  });

  it('remove nimmt nur unser Plugin mit; ein fremdes bleibt, leere Ordner gehen', async () => {
    await scaffold('init', { repoRoot: repo });
    const fremd = join(repo, '.opencode', 'plugin', 'mein-plugin.js');
    writeFileSync(fremd, 'export const Mein = async () => ({});\n', 'utf8');
    await scaffold('remove', { repoRoot: repo });
    expect(existsSync(join(repo, OPENCODE_PLUGIN))).toBe(false);
    expect(readdirSync(join(repo, '.opencode', 'plugin'))).toEqual(['mein-plugin.js']);
    rmSync(fremd);
    await scaffold('init', { repoRoot: repo });
    await scaffold('remove', { repoRoot: repo });
    expect(existsSync(join(repo, '.opencode'))).toBe(false);
  });

  it('der Hook nimmt den Vorschlag aus einer echten Mutationsantwort und legt ihn ins Eingabefeld', async () => {
    mkdirSync(join(repo, '.graphcode'), { recursive: true });
    const harness = await createHarness({ repoRoot: repo, scope: { workspaceId: 'w', systemId: 's' } });
    await harness.initialize();
    try {
      const tools = bindToolsToHarness(harness);
      const sys = { op: 'add-node', node: { uid: 'SYS-s', type: 'SYS', name: 'S', description: 'Ein System, das Bestellungen annimmt.', attributes: {} } };
      const antwort = await tools.graph_mutate.handler({ formatE: alsFormatE([sys], harness), consumerId: 'test' });
      const vorschlag = (antwort as { vorschlag?: string }).vorschlag;
      expect(typeof vorschlag).toBe('string');

      const aufrufe: string[] = [];
      const client = {
        tui: {
          clearPrompt: async () => void aufrufe.push('clear'),
          appendPrompt: async (o: { body: { text: string } }) => void aufrufe.push(`append:${o.body.text}`),
        },
      };
      const mod = (await import(pathToFileURL(packagedOpencodePlugin()).href)) as {
        GraphcodeVorschlag: (i: { client: unknown; directory: string }) => Promise<Record<string, (a: unknown, b: unknown) => Promise<void>>>;
      };
      const hooks = await mod.GraphcodeVorschlag({ client, directory: repo });
      // OpenCode reicht bei MCP-Werkzeugen das rohe Ergebnis durch: content[] mit dem JSON-Text.
      const output = { content: [{ type: 'text', text: JSON.stringify(antwort) }] };
      await hooks['tool.execute.after']({ tool: 'graphcode_graph_mutate', sessionID: 's', callID: 'c', args: {} }, output);

      const gesehen = JSON.parse(output.content[0].text) as Record<string, unknown>;
      expect(gesehen).not.toHaveProperty('vorschlag');
      expect(gesehen.success).toBe(true);
      expect(aufrufe).toEqual(['clear', `append:${vorschlag}`]);
      expect(readFileSync(join(repo, '.graphcode', 'vorschlag.txt'), 'utf8')).toBe(`${vorschlag}\n`);

      // Andere Werkzeuge bleiben unberuehrt.
      const fremd = { content: [{ type: 'text', text: JSON.stringify({ vorschlag: 'x' }) }] };
      await hooks['tool.execute.after']({ tool: 'graphcode_graph_elements', sessionID: 's', callID: 'c', args: {} }, fremd);
      expect(JSON.parse(fremd.content[0].text)).toEqual({ vorschlag: 'x' });
    } finally {
      await harness.close();
    }
  });
});
