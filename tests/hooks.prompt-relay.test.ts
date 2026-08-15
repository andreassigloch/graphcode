/**
 * TEST-prompt-relay (CR-GC-356) — the MCP path's half of "with which prompt".
 *
 * The harness cannot see a Claude Code / OpenCode prompt: no tool call carries it. The
 * `UserPromptSubmit` hook relays the client's own VERBATIM copy into `.graphcode/prompts/`
 * and `recordAudit` stamps it (CR-GC-354). Two properties are load-bearing and both are
 * asserted here rather than trusted:
 *   - the hook itself produces the relay file the reader expects (script + reader tested
 *     against each other, not against a hand-written fixture that could drift), and
 *   - AMBIGUITY IS RECORDED AS ABSENCE — with two live sessions there is no way to tell
 *     whose prompt caused a write, and a wrong pairing poisons the data being collected.
 *
 * Real disk Kuzu in mkdtemp, the real bash hook, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { AuditEntry } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsWithContext, type MCPToolRegistry } from '../src/mcp-tools.js';
import { PROMPT_RELAY_DIR, type ToolContext } from '../src/tool-context.js';
import { mergedSettingsContent, shippedHookFiles } from '../src/scaffold-templates.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

const HOOK = join(process.cwd(), '.claude/hooks/record-prompt.sh');

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'relay-ws', systemId: 'relay-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-rly-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-rly-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-rly-${suffix}`, targetId: `REQ-rly-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

/** Run the REAL hook exactly as Claude Code would: event JSON on stdin, repo via env. */
function submitPrompt(repoRoot: string, sessionId: string, prompt: string): void {
  execFileSync('bash', [HOOK], {
    input: JSON.stringify({ session_id: sessionId, prompt, cwd: repoRoot, hook_event_name: 'UserPromptSubmit' }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
  });
}

describe('TEST-prompt-relay (CR-GC-356): the client relays, the trail records', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;
  let ctx: ToolContext;

  async function mutate(suffix: string): Promise<void> {
    await tools['graph_mutate'].handler({ commands: validSet(suffix), consumerId: 'relay-test' });
  }

  async function lastEntry(): Promise<AuditEntry> {
    const all = (await ctx.auditLog.query({})) as AuditEntry[];
    return all[all.length - 1];
  }

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-relay-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    ({ registry: tools, ctx } = bindToolsWithContext(harness));
  });

  afterEach(async () => {
    await harness.close?.();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('stamps the relayed prompt verbatim and adopts the CLIENT session id', async () => {
    submitPrompt(repoRoot, 'claude-sess-001', 'immer die saubere lösung');
    await mutate('a');

    const entry = await lastEntry();
    expect(entry.intent).toBe('immer die saubere lösung');
    // The client's id, not our minted one: it names the transcript in ~/.claude/projects,
    // so the record stays joinable to its conversation while that window lasts.
    expect(entry.sessionId).toBe('claude-sess-001');
    expect(entry.sessionId).not.toBe(ctx.sessionId());
  });

  it('follows the session — a later prompt replaces the earlier one', async () => {
    submitPrompt(repoRoot, 'claude-sess-001', 'erste frage');
    await mutate('b');
    submitPrompt(repoRoot, 'claude-sess-001', 'zweite frage');
    await mutate('c');

    const all = (await ctx.auditLog.query({})) as AuditEntry[];
    expect(all.map((e) => e.intent)).toEqual(['erste frage', 'zweite frage']);
  });

  it('records ABSENCE when two sessions are live — never a guessed pairing', async () => {
    submitPrompt(repoRoot, 'claude-sess-001', 'session A prompt');
    submitPrompt(repoRoot, 'claude-sess-002', 'session B prompt');
    await mutate('d');

    const entry = await lastEntry();
    // A "newest wins" heuristic would stamp B's prompt here; whether that is right is
    // unknowable, and a wrong prompt→result pair is worse than a missing one.
    expect(Object.prototype.hasOwnProperty.call(entry, 'intent')).toBe(false);
    expect(entry.sessionId).toBe(ctx.sessionId());
  });

  it('survives a torn or mangled relay file without failing the write', async () => {
    const dir = join(repoRoot, PROMPT_RELAY_DIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'half-written.json'), '{"sessionId":"x","pro', 'utf8');

    // The write path must not throw on unreadable provenance — losing the stamp is a gap
    // in the data, losing the mutation would be a defect.
    await expect(mutate('e')).resolves.toBeUndefined();
    const entry = await lastEntry();
    expect(entry.result).toBe('applied');
    expect(Object.prototype.hasOwnProperty.call(entry, 'intent')).toBe(false);
  });

  it('an explicitly set origin wins over the relay (executor path is authoritative)', async () => {
    submitPrompt(repoRoot, 'claude-sess-001', 'ein fremder prompt');
    ctx.setOrigin({ model: 'devstral-small:24b', intent: 'graphcode run intent' });
    await mutate('f');

    const entry = await lastEntry();
    expect(entry.intent).toBe('graphcode run intent');
    expect(entry.model).toBe('devstral-small:24b');
    expect(entry.sessionId).toBe(ctx.sessionId());
  });

  it('ships the hook to consumer repos and registers it under UserPromptSubmit', () => {
    // The name-prefix filter this replaced would have shipped deny-*.sh only — the relay
    // would work here and silently not exist in any scaffolded repo.
    expect(shippedHookFiles()).toContain('record-prompt.sh');
    expect(existsSync(HOOK)).toBe(true);

    const merged = JSON.parse(mergedSettingsContent(null)) as {
      hooks: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
    };
    const submit = merged.hooks.UserPromptSubmit ?? [];
    expect(submit.flatMap((e) => e.hooks ?? []).map((h) => h.command).join(' ')).toContain(
      'record-prompt.sh',
    );
    // A member's own settings and the existing PreToolUse hooks must survive the merge.
    const withUser = JSON.parse(
      mergedSettingsContent(JSON.stringify({ model: 'opus', hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'mine.sh' }] }] } })),
    ) as { model: string; hooks: Record<string, Array<{ hooks?: Array<{ command?: string }> }>> };
    expect(withUser.model).toBe('opus');
    const cmds = withUser.hooks.UserPromptSubmit.flatMap((e) => e.hooks ?? []).map((h) => h.command);
    expect(cmds).toContain('mine.sh');
    expect(cmds.some((c) => (c ?? '').includes('record-prompt.sh'))).toBe(true);
    expect(Object.keys(withUser.hooks)).toContain('PreToolUse');
  });
});
