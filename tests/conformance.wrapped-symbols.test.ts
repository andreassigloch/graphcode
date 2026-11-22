/**
 * parseFileFacts füllt `wrappedSymbols` (CR-GC-1006, Vertrag CR-SM-449): die Symbole, die in einem
 * Schema stehen, das die Datei selbst parst. Gelesen wird echter Quelltext des Repos über
 * `extractCodeFacts`, kein Nachbau der Eingabe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { openMeasured, type Measured } from '../src/surface/measured.js';
import { extractCodeFacts } from '../src/kernel/conformance.js';

const REPO_ROOT = join(__dirname, '..');

describe('wrappedSymbols: umhüllendes Schema in derselben Datei (CR-GC-1006)', () => {
  let measured: Measured;
  let files: ReturnType<typeof extractCodeFacts>['files'];

  beforeAll(async () => {
    measured = await openMeasured({
      graph: join(REPO_ROOT, 'docs', 'graph', 'graphcode.graph.json'),
      repoRoot: REPO_ROOT,
      systemId: 'graphcode',
      workspaceId: 'test-ws',
    });
    files = extractCodeFacts(measured.harness.getGraph(), REPO_ROOT).files;
  });

  afterAll(async () => {
    await measured.close();
  });

  it('src/projections/metrics.ts: die Symbole der drei Metrik-Verträge, nicht das umhüllende selbst', () => {
    const f = files['src/projections/metrics.ts'];
    expect(f.parsedSymbols).toContain('GraphMetricsAnswerSchema');
    expect(f.wrappedSymbols).toEqual(expect.arrayContaining(['ChainMetrics', 'FunctionCriticality', 'ModuleMetrics']));
    expect(f.wrappedSymbols).not.toContain('GraphMetricsAnswerSchema');
  });

  it('src/kernel/config.ts: das Symbol der Metrik-Vorgaben', () => {
    const f = files['src/kernel/config.ts'];
    expect(f.parsedSymbols).toContain('GraphcodeConfigSchema');
    expect(f.wrappedSymbols).toContain('MetricPolicySchema');
    expect(f.wrappedSymbols).not.toContain('GraphcodeConfigSchema');
  });

  it('eine Datei ohne umhüllendes Schema trägt eine leere Liste', () => {
    const f = files['src/kernel/format-e-commands.ts'];
    expect(f.parsedSymbols).toContain('FormatEInputSchema');
    expect(f.wrappedSymbols).toEqual([]);
  });
});
