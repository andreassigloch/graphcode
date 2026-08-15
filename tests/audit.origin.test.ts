/**
 * TEST-audit-origin (CR-GC-354) — the provenance half of an audit record.
 *
 * The trail's base question is "WHO, with WHICH PROMPT, reached WHICH RESULT". The
 * result half was always recorded; `sessionId`/`model`/`intent` are the other two, and
 * they are DERIVED at the recording site (`ctx.setOrigin`), never accepted from a tool
 * input — a model's account of its own prompt is a paraphrase, and `consumerId` already
 * demonstrates what a self-declared field is worth (40% anonymous default on the real trail).
 *
 * Real disk Kuzu in mkdtemp, durable FileOperationsLog beside the store, no mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import type { AuditEntry } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsWithContext, type MCPToolRegistry } from '../src/mcp-tools.js';
import { INTENT_MAX_CHARS, type ToolContext } from '../src/tool-context.js';
import type { HarnessConfig, MutateCommand } from '@sigloch/contracts/harness';

function makeHarness(repoRoot: string): GraphCodeHarness {
  mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode/kuzu') });
  const config: HarnessConfig = {
    repoRoot,
    scope: { workspaceId: 'origin-ws', systemId: 'origin-svc' },
    consumerType: 'agent',
    preCommitTimeout: 5000,
  };
  return new GraphCodeHarness(config, storage);
}

/** A self-verified REQ batch — always legal through the gate. */
function validSet(suffix: string): MutateCommand[] {
  return [
    { op: 'add-node', node: { uid: `REQ-org-${suffix}`, type: 'REQ', name: `r-${suffix}`, description: '', attributes: {} } },
    { op: 'add-node', node: { uid: `TEST-org-${suffix}`, type: 'TEST', name: `t-${suffix}`, description: '', attributes: {} } },
    { op: 'add-edge', edge: { sourceId: `TEST-org-${suffix}`, targetId: `REQ-org-${suffix}`, edgeType: 'verify', attributes: {} } },
  ];
}

describe('TEST-audit-origin (CR-GC-354): who, and on which prompt', () => {
  let repoRoot: string;
  let harness: GraphCodeHarness;
  let tools: MCPToolRegistry;
  let ctx: ToolContext;

  async function mutate(suffix: string): Promise<void> {
    await tools['graph_mutate'].handler({ commands: validSet(suffix), consumerId: 'origin-test' });
  }

  async function lastEntry(): Promise<AuditEntry> {
    const all = (await ctx.auditLog.query({})) as AuditEntry[];
    return all[all.length - 1];
  }

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-origin-'));
    harness = makeHarness(repoRoot);
    await harness.initialize();
    ({ registry: tools, ctx } = bindToolsWithContext(harness));
  });

  afterEach(async () => {
    await harness.close?.();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('stamps the verbatim prompt and the model onto the record', async () => {
    ctx.setOrigin({ model: 'devstral-small:24b', intent: 'mach den audit trail fertig' });
    await mutate('a');

    const entry = await lastEntry();
    expect(entry.result).toBe('applied');
    expect(entry.model).toBe('devstral-small:24b');
    // VERBATIM — not a summary, not a normalization. The prompt is the training datum.
    expect(entry.intent).toBe('mach den audit trail fertig');
    expect(entry.intentTruncated).toBeUndefined();
  });

  it('truncates above INTENT_MAX_CHARS and SAYS SO — no silent cut', async () => {
    const long = 'x'.repeat(INTENT_MAX_CHARS + 1000);
    ctx.setOrigin({ intent: long });
    await mutate('b');

    const entry = await lastEntry();
    expect(entry.intent).toHaveLength(INTENT_MAX_CHARS);
    expect(entry.intent).toBe(long.slice(0, INTENT_MAX_CHARS));
    expect(entry.intentTruncated).toBe(true);
  });

  it('leaves intentTruncated OFF at exactly the bound — false would be noise', async () => {
    const exact = 'y'.repeat(INTENT_MAX_CHARS);
    ctx.setOrigin({ intent: exact });
    await mutate('c');

    const entry = await lastEntry();
    expect(entry.intent).toBe(exact);
    // Not `false`: on the real trail 372 of 379 prompts fit, so a `false` on every one of
    // them is volume claiming to be information. Absence carries the same statement.
    expect(Object.prototype.hasOwnProperty.call(entry, 'intentTruncated')).toBe(false);
  });

  it('records ABSENCE as absence — never an empty prompt (CR-GC-314 REQ-A05 asymmetry)', async () => {
    // No setOrigin at all: this is every pre-CR-354 record and every client that cannot
    // supply a prompt. A consumer must be able to tell "not recorded" from "empty prompt".
    await mutate('d');
    const unset = await lastEntry();
    expect(Object.prototype.hasOwnProperty.call(unset, 'intent')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(unset, 'model')).toBe(false);

    // An EMPTY string is the same statement as no prompt, and must not be recorded as ''.
    ctx.setOrigin({ intent: '' });
    await mutate('e');
    const empty = await lastEntry();
    expect(Object.prototype.hasOwnProperty.call(empty, 'intent')).toBe(false);
  });

  it('keeps one sessionId across a process and a different one per process', async () => {
    ctx.setOrigin({ intent: 'erste runde' });
    await mutate('f');
    ctx.setOrigin({ intent: 'zweite runde' });
    await mutate('g');

    const all = (await ctx.auditLog.query({})) as AuditEntry[];
    const ids = new Set(all.map((e) => e.sessionId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).toBe(ctx.sessionId());
    // The prompts differ within the session — sessionId groups, intent distinguishes.
    expect(all.map((e) => e.intent)).toEqual(['erste runde', 'zweite runde']);

    // A second context on the SAME store is a second process's view: same trail, new session.
    const { ctx: ctx2 } = bindToolsWithContext(harness);
    expect(ctx2.sessionId()).not.toBe(ctx.sessionId());
  });

  it('stamps a REJECTED record too — a blocked prompt is the calibration datum', async () => {
    ctx.setOrigin({ model: 'haiku-4.5', intent: 'baue eine REQ ohne test' });
    // A REQ without a verifying TEST trips the gate; the record must still carry provenance,
    // otherwise "which prompt produced which rejection" is exactly the question that stays open.
    await tools['graph_mutate'].handler({
      commands: [
        { op: 'add-node', node: { uid: 'REQ-org-lonely', type: 'REQ', name: 'lonely', description: '', attributes: {} } },
      ],
      consumerId: 'origin-test',
    });

    const entry = await lastEntry();
    expect(entry.result).toBe('rejected');
    expect(entry.model).toBe('haiku-4.5');
    expect(entry.intent).toBe('baue eine REQ ohne test');
    expect((entry.violations ?? []).length).toBeGreaterThan(0);
  });

  it('clears provenance when the caller stops knowing it — no stale prompt carried over', async () => {
    ctx.setOrigin({ model: 'opus-5', intent: 'runde eins' });
    await mutate('h');
    // setOrigin REPLACES wholesale. A caller that hands back an empty origin must not leave
    // the previous round's prompt stamped on unrelated later writes.
    ctx.setOrigin({});
    await mutate('i');

    const entry = await lastEntry();
    expect(Object.prototype.hasOwnProperty.call(entry, 'intent')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(entry, 'model')).toBe(false);
    expect(entry.sessionId).toBe(ctx.sessionId());
  });
});
