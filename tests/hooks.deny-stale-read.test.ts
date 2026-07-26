/**
 * TEST-deny-stale-read — CR-GC-214 read-side enforcement hook.
 *
 * Runs the actual PreToolUse shell hook with crafted stdin (the JSON Claude Code passes).
 * Asserts: a file declaring itself INPUT-ONLY is BLOCKED (exit 2, redirect to graph_context);
 * an unmarked file is ALLOWED; the GRAPHCODE_ALLOW_STALE_READ escape hatch works; a missing
 * file_path is a no-op.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK = join(__dirname, '..', '.claude', 'hooks', 'deny-stale-prose-read.sh');

function runHook(filePath: string | null, env: Record<string, string> = {}) {
  const payload = JSON.stringify({ tool_name: 'Read', tool_input: filePath ? { file_path: filePath } : {} });
  return spawnSync('bash', [HOOK], { input: payload, encoding: 'utf8', env: { ...process.env, ...env } });
}

describe('TEST-deny-stale-read: CR-GC-214 read-side graph-first enforcement', () => {
  let tmp: string;
  let stale: string;
  let live: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'gc-staleread-'));
    stale = join(tmp, 'SPEC.md');
    writeFileSync(stale, '# SPEC\n\nstatus: INPUT-ONLY\n\nold prose nobody should ingest.\n');
    live = join(tmp, 'slice.ts');
    writeFileSync(live, 'export function slice() { return []; }\n');
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('BLOCKS a file declaring status: INPUT-ONLY (exit 2, redirect to graph_context)', () => {
    const r = runHook(stale);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('CR-GC-214');
    expect(r.stderr).toContain('graph_context');
  });

  it('ALLOWS a normal source file (exit 0)', () => {
    const r = runHook(live);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('escape hatch GRAPHCODE_ALLOW_STALE_READ=1 lets the stale read through', () => {
    const r = runHook(stale, { GRAPHCODE_ALLOW_STALE_READ: '1' });
    expect(r.status).toBe(0);
  });

  it('no file_path is a no-op (exit 0)', () => {
    const r = runHook(null);
    expect(r.status).toBe(0);
  });
});
