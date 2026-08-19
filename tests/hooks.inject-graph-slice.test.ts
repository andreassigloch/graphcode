/**
 * CR-GC-367 — Task-Start-Scheibe: Bridge-Endpoint `GET /context/:uid` + der
 * UserPromptSubmit-Hook, der sie in den Agenten-Kontext schiebt.
 *
 * Reale Disk-Kuzu in einem Temp-Verzeichnis (nie `:memory:`), realer HTTP-Aufruf,
 * realer Hook-Prozess über stdin/stdout. Keine Mocks.
 *
 * Beweist:
 *   (a) Ein CR-Anker wird auf seine `relation`-Ziele aufgeloest, und die Scheibe
 *       enthaelt die Knoten, die der Job wirklich braucht (Ground Truth aus
 *       SPIKE-GC-minimal-whitebox), OHNE CR/MS.
 *   (b) Ein unbekanntes uid-artiges Token ist ein No-op — NIE ein Fuzzy-Treffer.
 *       Das ist der Kern der Entwurfsentscheidung gegen den Grep-Hook.
 *   (c) Ohne Bridge (kein GRAPHCODE_HOST_PORT) schweigt der Hook mit Exit 0 —
 *       eine fehlende Scheibe degradiert den Kontext, sie bricht nie den Prompt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import type { MutateCommand } from '@sigloch/contracts/harness';
import { HostBridge } from '../src/viewer/host.js';
import { buildJobSlice } from '../src/tools/read.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(REPO, '.claude', 'hooks', 'inject-graph-slice.sh');

/**
 * Den Hook wie Claude Code aufrufen: UserPromptSubmit-JSON auf stdin.
 *
 * ASYNCHRON, nicht `spawnSync`: die Bridge laeuft IM SELBEN Prozess wie der Test.
 * `spawnSync` blockiert die Event-Loop, der HTTP-Server nimmt die Verbindung des
 * Hooks nie an, und dessen curl laeuft in sein Timeout — der Hook sieht dann
 * korrekt "keine Bridge" und schweigt. Das ist ein Artefakt des Testaufbaus, kein
 * Verhalten des Hooks.
 */
function runHook(
  prompt: string,
  env: Record<string, string> = {},
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('bash', [HOOK], {
      env: { ...process.env, GRAPHCODE_HOOK_INJECT: '1', ...env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += String(c)));
    child.stderr.on('data', (c) => (stderr += String(c)));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(JSON.stringify({ prompt, session_id: 'test', cwd: REPO }));
  });
}

describe('CR-GC-367: Job-Scheibe beim Task-Start', () => {
  let tmp: string;
  let bridge: HostBridge;
  let port: number;

  beforeAll(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-slice-hook-'));
    bridge = new HostBridge({ repoRoot: tmp, port: 0 });
    port = await bridge.start();
    // Minimal-Modell mit genau der Form, die der Spike gemessen hat:
    // CR -relation-> FUNC/REQ, FUNC -satisfy-> REQ, TEST -verify-> REQ.
    const commands: MutateCommand[] = [
      { op: 'add-node', node: { uid: 'REQ-slice-push', type: 'REQ', name: 'Scheibe wird gepusht', description: 'Der Agent bekommt die Scheibe ohne sie zu holen.', attributes: {} } },
      { op: 'add-node', node: { uid: 'FUNC-inject-slice', type: 'FUNC', name: 'injectSlice()', description: 'Schiebt die Job-Scheibe in den Kontext.', attributes: {} } },
      { op: 'add-node', node: { uid: 'TEST-slice-push', type: 'TEST', name: 'Scheibe-Push-Test', description: 'Verifiziert die Injektion.', attributes: {} } },
      { op: 'add-node', node: { uid: 'MS-1-slice', type: 'MS', name: 'MS-1', description: 'Meilenstein.', attributes: {} } },
      { op: 'add-node', node: { uid: 'CR-GC-367', type: 'CR', name: 'Task-Start-Scheibe', description: 'Dieser CR.', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'FUNC-inject-slice', targetId: 'REQ-slice-push', edgeType: 'satisfy', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'TEST-slice-push', targetId: 'REQ-slice-push', edgeType: 'verify', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'CR-GC-367', targetId: 'FUNC-inject-slice', edgeType: 'relation', attributes: {} } },
      { op: 'add-edge', edge: { sourceId: 'CR-GC-367', targetId: 'MS-1-slice', edgeType: 'relation', attributes: {} } },
    ];
    const result = await bridge.getHarness().mutate(commands, 'test');
    expect(result.success, JSON.stringify(result.violations)).toBe(true);
  }, 60_000);

  afterAll(async () => {
    await bridge.stop();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(a) loest den CR-Anker auf seine Arbeitsknoten auf und laesst CR/MS weg', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/context/CR-GC-367`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { seeds: string[]; formatE: string; nodeCount: number };
    // Seeds = die relation-Ziele OHNE MS
    expect(body.seeds).toEqual(['FUNC-inject-slice']);
    // Die Spec-Closure zieht REQ und den verifizierenden TEST mit
    expect(body.formatE).toContain('FUNC-inject-slice');
    expect(body.formatE).toContain('REQ-slice-push');
    expect(body.formatE).toContain('TEST-slice-push');
    // CR und MS sind draussen — 60% Graph-Text, 0% Beitrag zum Aenderungs-Set
    expect(body.formatE).not.toContain('MS-1-slice');
    expect(body.formatE).not.toContain('CR-GC-367');
  });

  it('(b) unbekanntes uid-artiges Token: 404 und KEIN Fuzzy-Treffer', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/context/CR-GC-999`);
    expect(res.status).toBe(404);
    // Gegenprobe: ein Praefix eines existierenden uid darf NICHT matchen.
    const partial = await fetch(`http://127.0.0.1:${port}/context/FUNC-inject`);
    expect(partial.status).toBe(404);
  });

  it('(b2) der Hook injiziert zur bekannten uid und schweigt zur unbekannten', async () => {
    const hit = await runHook('implementiere CR-GC-367 bitte', { GRAPHCODE_HOST_PORT: String(port) });
    expect(hit.status).toBe(0);
    expect(hit.stdout).toContain('FUNC-inject-slice');
    expect(hit.stdout).toContain('REQ-slice-push');
    expect(hit.stdout).not.toContain('MS-1-slice');

    const miss = await runHook('implementiere CR-GC-999 bitte', { GRAPHCODE_HOST_PORT: String(port) });
    expect(miss.status).toBe(0);
    expect(miss.stdout.trim()).toBe('');
  });

  it('(b3) ein Prompt ohne uid loest gar nichts aus', async () => {
    const r = await runHook('mach mal die tests gruen', { GRAPHCODE_HOST_PORT: String(port) });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('(c) ohne Bridge: Exit 0, keine Ausgabe — nie ein Block', async () => {
    const r = await runHook('implementiere CR-GC-367', { GRAPHCODE_HOST_PORT: '' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  /**
   * Die eigentliche Regression: gegen das ECHTE Selbstmodell und die Ground Truth
   * aus SPIKE-GC-minimal-whitebox — die Knoten, die die Schluss-Commits von
   * CR-GC-114/115 real veraendert haben (git-Diff des SSOT-Graphen, keine Schaetzung).
   * Rein ueber `buildJobSlice`, ohne Store: die Scheibe ist eine Funktion des Graphen.
   */
  it('(d) deckt auf dem echten Modell die real geaenderten Knoten — 12/12 und 16/16', () => {
    const raw = JSON.parse(
      readFileSync(join(REPO, 'docs', 'graph', 'graphcode.graph.json'), 'utf8'),
    ) as { elements: { id: string; type: string }[]; traces: { source: string; target: string; type: string }[] };
    const graph = {
      nodes: raw.elements.map((e) => ({ ...e, uid: e.id, attributes: {} })),
      edges: raw.traces.map((t) => ({
        sourceId: t.source,
        targetId: t.target,
        edgeType: t.type,
        attributes: {},
      })),
    } as unknown as Parameters<typeof buildJobSlice>[0];

    const groundTruth: Record<string, string[]> = {
      'CR-GC-114': [
        'FUNC-broadcast-diff', 'FUNC-health-endpoint', 'FUNC-own-kuzu-host', 'FUNC-serve-sse',
        'MOD-host-bridge', 'REQ-mutation-emits-event', 'REQ-readonly-bridge',
        'REQ-real-health-check', 'REQ-single-kuzu-owner', 'REQ-versioned-broadcast',
        'TEST-readonly-bridge', 'TEST-real-health-check',
      ],
      'CR-GC-115': [
        'FUNC-render-artifacts', 'FUNC-render-graph', 'FUNC-render-health', 'FUNC-render-impact',
        'FUNC-render-impl-gates', 'FUNC-render-readiness', 'FUNC-render-recommendations',
        'FUNC-subscribe-updates', 'MOD-dashboard', 'REQ-artifact-freshness',
        'REQ-dashboard-readonly', 'REQ-readiness-transparent', 'TEST-artifact-freshness',
        'TEST-dashboard-readonly', 'TEST-readiness-transparent', 'UC-live-graph-view',
      ],
    };

    for (const [cr, expected] of Object.entries(groundTruth)) {
      const { slice } = buildJobSlice(graph, cr);
      const have = new Set(slice.nodes.map((n) => n.uid));
      const missing = expected.filter((u) => !have.has(u));
      expect(missing, `${cr}: Scheibe verfehlt real geaenderte Knoten`).toEqual([]);
      // Kein CR/MS — 60 % des Graph-Textes, 0 % Beitrag zum Aenderungs-Set.
      expect(slice.nodes.filter((n) => n.type === 'CR' || n.type === 'MS')).toEqual([]);
      // Und die Scheibe bleibt klein: deutlich unter 10 % des Graphen (H3 des Spikes).
      expect(slice.nodes.length).toBeLessThan(raw.elements.length * 0.1);
    }
  });

  it('(c2) Schalter aus: der Hook tut nichts, auch mit laufender Bridge', async () => {
    const r = await runHook('implementiere CR-GC-367', {
      GRAPHCODE_HOOK_INJECT: '0',
      GRAPHCODE_HOST_PORT: String(port),
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });
});
