/**
 * TEST-tool-profile (CR-GC-723) — das Werkzeugprofil folgt der LLM-Art des Clients.
 *
 * Echte Registry auf Platten-Kuzu, echter MCP-Server; nur der Draht ist in-process.
 *
 *   (a) cloud  — dieselbe Registry, unverändert.
 *   (b) local  — genau graph_delegate + drei Leser über `tools/list`; kein graph_mutate.
 *   (c) local  — die Leser SIND die gebundenen Werkzeuge (Aufruf antwortet), nur ihre
 *                Beschreibung ist auf den ersten Satz gekürzt; graph_delegate bleibt ganz.
 *   (d) local ohne Executor — Fehler, der die Config nennt; kein stiller Lesemodus.
 *   (e) die Variable: nicht gesetzt = cloud, unbekannter Wert = Fehler.
 *   (f) die Nutzlast des lokalen Profils bleibt unter ihrer Schranke (Sperrklinke).
 *   (g) das Scaffold schreibt local nach opencode.json und cloud nach .mcp.json; ein von
 *       Hand gesetzter Wert überlebt `update`.
 *
 * GEGENPROBE zu (b)/(f): ohne `applyToolProfile` liefert derselbe Server 24 Werkzeuge und
 * rund 29.000 Zeichen — beide Fälle wären rot.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { bindRegistryToMcpServer } from '../src/surface/mcp-server.js';
import { DelegateConfigSchema } from '../src/surface/delegate.js';
import { scaffold } from '../src/surface/scaffold.js';
import {
  applyToolProfile,
  assertProfileServable,
  clientLlmFromEnv,
  CLIENT_LLM_ENV,
  LOCAL_READERS,
} from '../src/surface/tool-profile.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

const CONFIG = DelegateConfigSchema.parse({ baseUrl: 'http://scripted.invalid', model: 'scripted' });

/** Gemessen am 2026-10-01: 3.303 Zeichen (volle Liste: 28.210). Darf nur sinken. */
const LOKAL_SCHRANKE = 3_400;

async function listed(registry: MCPToolRegistry): Promise<Array<{ name: string; description?: string }>> {
  const server = bindRegistryToMcpServer(registry);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'opencode', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const { tools } = await client.listTools();
  await client.close();
  return tools;
}

describe('TEST-tool-profile: Werkzeugprofil je LLM-Art (CR-GC-723)', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let mitExecutor: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-profile-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'profile', systemId: 'profile' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    mitExecutor = bindToolsToHarness(harness, undefined, { delegate: { config: CONFIG } });
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('(a) cloud lässt die Registry unverändert', () => {
    expect(applyToolProfile(mitExecutor, 'cloud')).toBe(mitExecutor);
  });

  it('(b) local bietet über tools/list genau graph_delegate und die drei Leser', async () => {
    const names = (await listed(applyToolProfile(mitExecutor, 'local'))).map((t) => t.name).sort();
    expect(names).toEqual(['graph_context', 'graph_delegate', 'graph_elements', 'graph_get_node']);
    expect(names).not.toContain('graph_mutate');
  });

  it('(c) die Leser sind die gebundenen Werkzeuge, nur die Beschreibung ist gekürzt', async () => {
    const local = applyToolProfile(mitExecutor, 'local');
    for (const name of LOCAL_READERS) {
      const voll = mitExecutor[name].description;
      expect(voll.startsWith(local[name].description)).toBe(true);
      expect(local[name].description.length).toBeLessThanOrEqual(voll.length);
      expect(local[name].inputSchema).toBe(mitExecutor[name].inputSchema);
    }
    expect(local.graph_context.description.length).toBeLessThan(mitExecutor.graph_context.description.length);
    // Der Eingang zum Executor trägt sein Protokoll (fertig/frage/laeuft) — ungekürzt.
    expect(local.graph_delegate).toBe(mitExecutor.graph_delegate);
    const antwort = (await local.graph_elements.handler({ limit: 5, format: 'json', prosa: false })) as { nodes: unknown[] };
    expect(Array.isArray(antwort.nodes)).toBe(true);
  });

  it('(d) local ohne Executor ist ein Fehler, der die Config nennt', () => {
    const ohne = bindToolsToHarness(harness);
    expect(() => applyToolProfile(ohne, 'local')).toThrow(/executor.*graphcode\.config\.jsonc/);
    expect(() => assertProfileServable('local', false)).toThrow(/graph_delegate/);
    expect(() => assertProfileServable('local', true)).not.toThrow();
    expect(() => assertProfileServable('cloud', false)).not.toThrow();
  });

  it('(e) nicht gesetzt = cloud, unbekannter Wert = Fehler', () => {
    expect(clientLlmFromEnv({})).toBe('cloud');
    expect(clientLlmFromEnv({ [CLIENT_LLM_ENV]: '' })).toBe('cloud');
    expect(clientLlmFromEnv({ [CLIENT_LLM_ENV]: 'local' })).toBe('local');
    expect(clientLlmFromEnv({ [CLIENT_LLM_ENV]: 'cloud' })).toBe('cloud');
    expect(() => clientLlmFromEnv({ [CLIENT_LLM_ENV]: 'lokal' })).toThrow(/local \| cloud/);
  });

  it('(f) die Nutzlast des lokalen Profils bleibt unter ihrer Schranke (Sperrklinke)', async () => {
    const zeichen = (await listed(applyToolProfile(mitExecutor, 'local'))).reduce(
      (summe, t) => summe + JSON.stringify(t).length,
      0,
    );
    expect(zeichen).toBeLessThanOrEqual(LOKAL_SCHRANKE);
  });
});

describe('TEST-tool-profile: das Scaffold setzt die Variable (CR-GC-723)', () => {
  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'gc-profile-scaffold-'));
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('(g) opencode.json = local, .mcp.json = cloud; ein Handwert überlebt update', async () => {
    await scaffold('init', { repoRoot: repo });
    const oc = (): Record<string, string> =>
      JSON.parse(readFileSync(join(repo, 'opencode.json'), 'utf8')).mcp.graphcode.environment;
    const cc = (): Record<string, string> =>
      JSON.parse(readFileSync(join(repo, '.mcp.json'), 'utf8')).mcpServers.graphcode.env;
    expect(oc()[CLIENT_LLM_ENV]).toBe('local');
    expect(cc()[CLIENT_LLM_ENV]).toBe('cloud');

    // OpenCode gegen ein Cloud-Modell: der Betreiber stellt um, update lässt es stehen.
    const edited = JSON.parse(readFileSync(join(repo, 'opencode.json'), 'utf8'));
    edited.mcp.graphcode.environment[CLIENT_LLM_ENV] = 'cloud';
    writeFileSync(join(repo, 'opencode.json'), JSON.stringify(edited, null, 2) + '\n', 'utf8');
    await scaffold('update', { repoRoot: repo });
    expect(oc()[CLIENT_LLM_ENV]).toBe('cloud');
  });
});
