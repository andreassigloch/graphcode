/**
 * CR-GC-984 — RC-04 in surface: das Verb der CLI und das Update-Ereignis werden an der Grenze geparst.
 *
 * Rot-zuerst: (1) das Update-Ereignis mit einer Version ausserhalb des Vertrags lief bis in die
 * Senke durch; (2) es gab kein Schema fuer das Verb, `main` schaltete den rohen String.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeResetEventHook, makeUpdateEventHook, type LiveUpdateEvent } from '../src/surface/emit.js';
import { CliVerbSchema, checkVerbArgs } from '../src/surface/cli-args.js';

const ERGEBNIS = { success: true, appliedCommands: 1, mutations: 1, violations: [] };

describe('CR-GC-984: der Erzeuger des Update-Ereignisses parst', () => {
  it('gibt ein Ereignis mit gueltiger Version an die Senke', () => {
    const got: LiveUpdateEvent[] = [];
    makeUpdateEventHook((e) => got.push(e))({ phase: 'post-apply', result: ERGEBNIS, version: 3 } as never);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ type: 'invalidate', version: 3 });
  });

  it('lehnt ein Ereignis mit Version NaN ab, die Senke bekommt nichts', () => {
    const got: LiveUpdateEvent[] = [];
    expect(() =>
      makeUpdateEventHook((e) => got.push(e))({ phase: 'post-apply', result: ERGEBNIS, version: Number.NaN } as never),
    ).toThrow();
    expect(got).toHaveLength(0);
  });

  it('lehnt auch ein Reset-Ereignis mit Version NaN ab', () => {
    const got: LiveUpdateEvent[] = [];
    expect(() => makeResetEventHook((e) => got.push(e))({ phase: 'post-reset', version: Number.NaN } as never)).toThrow();
    expect(got).toHaveLength(0);
  });
});

describe('CR-GC-984: das Verb der CLI ist ein Schema', () => {
  it('kennt genau die Verben, fuer die checkVerbArgs eine Argumenttabelle hat', () => {
    for (const verb of CliVerbSchema.options) {
      expect(checkVerbArgs(verb, ['--help']), verb).toEqual({ kind: 'help' });
    }
    expect(CliVerbSchema.options).toHaveLength(12); // + typbindung (CR-GC-1026)
  });

  it('weist `update` und ein unbekanntes Wort ab', () => {
    expect(CliVerbSchema.safeParse('update').success).toBe(false);
    expect(CliVerbSchema.safeParse('bogus').success).toBe(false);
  });

  it('die CLI lehnt ein unbekanntes Verb mit Exit 1 und Namen ab, ein gueltiges nimmt seine Hilfe', () => {
    const cli = join(__dirname, '..', 'dist', 'cli.js');
    const repo = mkdtempSync(join(tmpdir(), 'gc-cli-verb-'));
    try {
      const bad = spawnSync(process.execPath, [cli, 'bogus'], { cwd: repo, encoding: 'utf8' });
      expect(bad.status).toBe(1);
      expect(bad.stderr).toContain('unknown command "bogus"');
      const gut = spawnSync(process.execPath, [cli, 'status', '--help'], { cwd: repo, encoding: 'utf8' });
      expect(gut.status).toBe(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
