/**
 * TEST-graph-tests-operational (CR-GC-204) — graph_tests ist OPERATIV auf dem echten
 * committeten SSOT-Graphen: ein CODE-ChangeSet löst über die gerichtete
 * code→REQ→TEST-Traversierung die VOLLSTÄNDIGE Menge betroffener Testdateien auf
 * (kein False-Green), und jeder lauffähige TEST-Knoten trägt einen testRefs-Eintrag auf
 * eine existierende Datei (konzeptionelle Knoten sind explizit als solche markiert und
 * tauchen unter `unresolved` auf).
 *
 * EIGENES Testobjekt, eigene Datei (CR-GC-383): dieser Lauf seedet den REALEN
 * docs/graph/graphcode.graph.json durchs Gate in einen Disk-Kuzu — ein anderer Aufbau als
 * die synthetische Fixture in `mcp.tests-deduction.test.ts`. Zwei Aufbauten, zwei Abnahmen,
 * zwei Knoten: eine Testdatei gehört zu genau einer Abnahme (R-29).
 *
 * Realer Disk-Kuzu (temp dir, nie `:memory:`). Keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { TestRefsSchema } from '@sigloch/contracts/se';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness } from '../src/mcp-tools.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

function makeConfig(repoRoot: string): HarnessConfig {
  return {
    repoRoot,
    scope: { workspaceId: 'test-ws', systemId: 'graphcode' },
    consumerType: 'system',
    preCommitTimeout: 5000,
  };
}

describe('TEST-graph-tests-operational: graph_tests operational on the committed SSOT (CR-GC-204)', () => {
  const REPO_ROOT = join(__dirname, '..');
  let tmp: string;
  let harness: GraphCodeHarness;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'graphcode-tests-operational-'));
    const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
    // lockDir = temp store dir, not repoRoot/.graphcode (a live dev server owns that, CR-GC-218).
    harness = new GraphCodeHarness(makeConfig(REPO_ROOT), storage, undefined, { lockDir: tmp });
    await harness.initialize();
    await harness.seedFromJson(); // load the real committed graph through the gate
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('(e) a code changeset resolves to the COMPLETE affected test-file set via directed code→REQ→TEST', async () => {
    // CR-GC-200 changed MOD-codec + MOD-harness; the new tests span THREE files
    // (graph-integrity, codec.validation, harness.gate). Plain incoming-impact
    // selected 0 TESTs (wrong direction); the directed resolver must reach all three.
    const res = await registry['graph_tests'].handler({ changeSet: ['MOD-codec', 'MOD-harness'], depth: 3 });

    expect(res.coverage.impactedTests).toBeGreaterThan(0);
    expect(res.coverage.files).toContain('tests/graph-integrity.test.ts');
    expect(res.coverage.files).toContain('tests/codec.validation.test.ts');
    expect(res.coverage.files).toContain('tests/harness.gate.test.ts');
    // Selective run command over exactly the affected files.
    expect(res.command.startsWith('vitest run ')).toBe(true);
    for (const f of res.coverage.files) expect(res.command).toContain(f);
    // Unrelated subsystem (dashboard panels) is NOT pulled in.
    expect(res.coverage.files).not.toContain('tests/panels.test.ts');
  });

  it('(f) testRefs-coverage conformance: every TEST node is runnable-with-existing-file OR explicitly concept-only', async () => {
    const testNodes = harness.getGraph().nodes.filter((n) => n.type === 'TEST');
    expect(testNodes.length).toBeGreaterThan(40);

    const offenders: string[] = [];
    for (const n of testNodes) {
      const raw = n.attributes?.testRefs;
      const isConcept = n.attributes?.concept === true;
      if (raw === undefined || raw === null) {
        // No silent gap: a TEST without a runnable binding MUST be flagged concept-only.
        if (!isConcept) offenders.push(`${n.uid}: no testRefs and not concept-only`);
        continue;
      }
      const parsed = TestRefsSchema.safeParse(raw);
      if (!parsed.success) {
        offenders.push(`${n.uid}: invalid testRefs`);
        continue;
      }
      // CR-GC-338: JEDER Eintrag muss auf eine existierende Datei zeigen — eine Abnahme aus
      // Unit- und Visual-Lauf ist erst dann wirklich lauffaehig, wenn beide Dateien da sind.
      for (const ref of parsed.data) {
        if (!existsSync(join(REPO_ROOT, ref.file))) {
          offenders.push(`${n.uid}: testRefs entry file missing on disk → ${ref.file}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('(g) impacted concept-only TESTs surface under unresolved, never silently dropped', async () => {
    // MOD-codec satisfies REQ-interface-schema, verified only by the concept-only
    // TEST-interface-schema → it must appear as unresolved, not vanish.
    const res = await registry['graph_tests'].handler({ changeSet: ['MOD-codec', 'MOD-harness'], depth: 3 });
    const unresolvedIds = res.unresolved.map((u: { id: string }) => u.id);
    expect(unresolvedIds).toContain('TEST-interface-schema');
    // Every unresolved entry is a genuinely concept-only node in the committed graph.
    const conceptIds = new Set(
      harness.getGraph().nodes.filter((n) => n.attributes?.concept === true).map((n) => n.uid),
    );
    for (const id of unresolvedIds) expect(conceptIds.has(id)).toBe(true);
    // Resolved + unresolved account for every impacted TEST.
    expect(res.coverage.resolved + res.unresolved.length).toBe(res.coverage.impactedTests);
  });
});
