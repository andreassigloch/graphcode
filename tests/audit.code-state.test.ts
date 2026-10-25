/**
 * TEST-audit-code-state (CR-GC-848) — jeder Audit-Eintrag eines graph_mutate trägt den Code-Stand.
 *
 * `codeState: { head, dirty }`: `head` ist der Git-Commit, gegen den die Mutation lief, `dirty` sagt, ob unter
 * `callScope` (die TS-Dateien der tsconfig) ungespeicherte Änderungen offen waren. Ohne Commit fehlt das Feld —
 * nicht erfasst, nie geraten.
 *
 * Echtes Git-Repo in mkdtemp, echter Disk-Kuzu, dauerhafter FileOperationsLog, keine Mocks.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { AuditEntry } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsWithContext } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import type { ToolContext } from '../src/surface/tool-context.js';
import type { TrajectoryStamps } from '../src/projections/trajectory.js';
import type { HarnessConfig } from '@sigloch/contracts/harness';

type Entry = AuditEntry & TrajectoryStamps;

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' }).trim();

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'code-state-ws', systemId: 'code-state-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

/** Ein gate-legaler Batch: REQ mit verifizierendem TEST. */
const batch = (s: string): string =>
  `## Nodes\n### REQ\n+ REQ-cs-${s}|Anforderung ${s}\n### TEST\n+ TEST-cs-${s}|Test ${s}\n\n## Edges\n+ TEST-cs-${s} -verify-> REQ-cs-${s}\n`;

describe('TEST-audit-code-state (CR-GC-848): der Audit-Eintrag nennt den Code-Stand', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;
  let ctx: ToolContext;

  async function mutate(s: string, dryRun = false): Promise<Entry> {
    const res = (await tools['graph_mutate'].handler({ formatE: batch(s), consumerId: 'code-state-test', dryRun })) as { success: boolean };
    expect(res.success).toBe(true);
    const all = (await ctx.auditLog.query({})) as Entry[];
    return all[all.length - 1];
  }

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-code-state-'));
    mkdirSync(join(repoRoot, 'src'));
    writeFileSync(join(repoRoot, 'src', 'a.ts'), 'export function a(): void {}\n');
    writeFileSync(join(repoRoot, 'README.md'), '# x\n');
    writeFileSync(join(repoRoot, 'tsconfig.json'), JSON.stringify({ include: ['src/**/*'] }));
    writeFileSync(join(repoRoot, '.gitignore'), '.graphcode/\n');
    harness = makeHarness(repoRoot);
    await harness.initialize();
    ({ registry: tools, ctx } = bindToolsWithContext(harness));
  });

  afterEach(async () => {
    await harness.close?.();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('ohne Commit fehlt codeState — nicht erfasst, nie geraten', async () => {
    const entry = await mutate('ohne');
    expect(Object.prototype.hasOwnProperty.call(entry, 'codeState')).toBe(false);
  });

  it('sauberer Baum: head ist der Commit, dirty false — im Log und im Feed', async () => {
    git(repoRoot, 'init', '-q');
    git(repoRoot, 'add', '-A');
    git(repoRoot, 'commit', '-q', '-m', 'init');
    const head = git(repoRoot, 'rev-parse', 'HEAD');

    const entry = await mutate('sauber');
    expect(entry.codeState).toEqual({ head, dirty: false });

    const lines = readFileSync(join(repoRoot, '.graphcode', 'trajectory.jsonl'), 'utf8').trim().split('\n');
    expect((JSON.parse(lines[lines.length - 1]) as TrajectoryStamps).codeState).toEqual({ head, dirty: false });
  });

  it('dirty zählt nur unter callScope: README offen bleibt false, src/a.ts offen wird true, neue src-Datei auch', async () => {
    git(repoRoot, 'init', '-q');
    git(repoRoot, 'add', '-A');
    git(repoRoot, 'commit', '-q', '-m', 'init');
    const head = git(repoRoot, 'rev-parse', 'HEAD');

    writeFileSync(join(repoRoot, 'README.md'), '# geaendert\n');
    expect((await mutate('readme')).codeState).toEqual({ head, dirty: false });

    writeFileSync(join(repoRoot, 'src', 'a.ts'), 'export function a(): void { return; }\n');
    expect((await mutate('quelle')).codeState).toEqual({ head, dirty: true });

    git(repoRoot, 'checkout', '--', 'src/a.ts');
    writeFileSync(join(repoRoot, 'src', 'neu.ts'), 'export const n = 1;\n');
    expect((await mutate('neu')).codeState).toEqual({ head, dirty: true });
  });

  it('auch die Vorschau (dryRun) eines graph_mutate trägt codeState.head', async () => {
    git(repoRoot, 'init', '-q');
    git(repoRoot, 'add', '-A');
    git(repoRoot, 'commit', '-q', '-m', 'init');
    const entry = await mutate('vorschau', true);
    expect(entry.operation).toBe('validate');
    expect(entry.codeState?.head).toBe(git(repoRoot, 'rev-parse', 'HEAD'));
  });
});
