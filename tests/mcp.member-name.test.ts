/**
 * TEST-member-name (CR-GC-128) — serveStdio derives the member identity from the
 * repo, so graph_export and the harness scope default to a repo-specific name
 * (e.g. auth-service.graph.json) instead of the generic 'graphcode' fallback.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { deriveMemberName } from '../src/mcp-server.js';

describe('TEST-member-name: deriveMemberName(repoRoot)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gc-member-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function withPkg(name: unknown): void {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }), 'utf8');
  }

  it('uses the unscoped package.json name', () => {
    withPkg('@acme/auth-service');
    expect(deriveMemberName(dir)).toBe('auth-service');
  });

  it('uses a plain package.json name as-is', () => {
    withPkg('notify-core');
    expect(deriveMemberName(dir)).toBe('notify-core');
  });

  it('sanitizes illegal filename characters', () => {
    withPkg('My Member!Name');
    expect(deriveMemberName(dir)).toBe('My-Member-Name');
  });

  it('falls back to the repo directory name when there is no package.json', () => {
    // A fresh `graphcode init` repo with no package.json name → repo dir name.
    expect(deriveMemberName(dir)).toBe(basename(dir));
  });

  it('falls back to the directory name on an invalid package.json', () => {
    writeFileSync(join(dir, 'package.json'), '{ not valid json', 'utf8');
    expect(deriveMemberName(dir)).toBe(basename(dir));
  });

  it('falls back to the directory name when name is empty/blank', () => {
    const nested = join(dir, 'member-x');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'package.json'), JSON.stringify({ name: '   ' }), 'utf8');
    expect(deriveMemberName(nested)).toBe('member-x');
  });
});
