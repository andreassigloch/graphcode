/**
 * TEST-readiness-altbestand (CR-GC-786) — Bericht und Schritt antworten an einem Modell mit
 * Altbestand ausserhalb des Element-Vertrags.
 *
 * Befund am siconizer-Modell: `graph_readiness` und `graph_generate` brachen mit einem ZodError ab
 * (`SteeringSnapshotSchema.parse`), weil 12 Anforderungen Art-Werte aus der Zeit vor contracts 10
 * tragen (`risk`, `mitigation`). `rules_evaluate` und `graph_metrics` liefen am selben Modell durch.
 * Entscheidung des Autors (2026-10-12): der Stand ist ein Fehler, den eine Regel meldet (R-08,
 * CR-SM-411); das Modell wird nicht beim Laden abgelehnt, die Werkzeuge berichten mit dem Befund.
 *
 * POSITIVKONTROLLE: mit `SteeringSnapshotSchema.parse` in `takeSteeringSnapshot` werfen beide
 * Aufrufe (rot gesehen vor dem Fix: "Invalid option: expected one of functional|non-functional").
 *
 * Echtes Kuzu auf Platte in mkdtemp, der Altbestand kommt ueber den Import-Port (ein Laden, kein Zug).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

const BEFUND = 'REQ-alt.kinds = ["risk"] is outside the element contract';

describe('TEST-readiness-altbestand (CR-GC-786)', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-altbestand-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
    const config: HarnessConfig = {
      repoRoot,
      scope: { workspaceId: 'alt-ws', systemId: 'alt-svc' },
      consumerType: 'agent',
      preCommitTimeout: 5000,
    };
    harness = new GraphCodeHarness(config, storage);
    await harness.initialize();
    tools = bindToolsToHarness(harness);
    await harness.importGraph({
      elements: [
        { id: 'SYS-alt', type: 'SYS', name: 'Altsystem', description: 'Ein System mit Altbestand.' },
        { id: 'REQ-alt', type: 'REQ', name: 'alt', description: 'Das System muss X.', kinds: ['risk'] },
        { id: 'TEST-alt', type: 'TEST', name: 't', description: 'prueft X' },
      ],
      traces: [{ source: 'TEST-alt', target: 'REQ-alt', type: 'verify' }],
    } as Parameters<typeof harness.importGraph>[0]);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('der Altbestand liegt wirklich im Store (sonst prueft der Test nichts)', () => {
    expect(harness.getGraph().nodes.find((n) => n.uid === 'REQ-alt')?.attributes?.kinds).toEqual(['risk']);
  });

  it('graph_readiness antwortet und nennt den R-08-Befund am Art-Wert', async () => {
    const report = (await tools.graph_readiness.handler({ detail: true })) as {
      violationsByRule: Record<string, number>;
      violations: { ruleId: string; elementId?: string; message: string; severity: string }[];
      stages: { name: string; findings: number }[];
    };
    expect(report.violationsByRule['R-08']).toBe(1);
    const v = report.violations.find((x) => x.ruleId === 'R-08');
    expect(v?.severity).toBe('error');
    expect(v?.message).toBe(BEFUND);
    // Gerechnet, nicht ausgelassen: der Befund zaehlt in seiner Stufe.
    expect(report.stages.find((s) => s.name === 'immer')?.findings).toBeGreaterThanOrEqual(1);
  });

  it('graph_generate antwortet mit einem Schritt', async () => {
    const step = (await tools.graph_generate.handler({ peek: true })) as { phase?: string; blockingErrors?: number };
    expect(step).toBeDefined();
    expect(JSON.stringify(step)).not.toContain('ZodError');
  });
});
