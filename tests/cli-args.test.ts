/**
 * TEST-cli-args — `--help` zeigt Hilfe, ein unbekanntes Argument bricht ab (CR-GC-886).
 *
 * Dreimal hat ein `--help` das Verb wirklich ausgefuehrt (`init` in graphcode und siglochimmo,
 * `upgrade` in graph-view-edit): `cli.ts` las nur die Flags, die es kannte, und warf den Rest weg.
 * Der letzte Block startet deshalb den echten Einstieg in einem Temp-Repo: dort darf keine Datei
 * entstehen, und ein laufender Host waere gar nicht erst erreichbar.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkVerbArgs } from '../src/surface/cli-args.js';

describe('checkVerbArgs: je Verb nur die Argumente, die es kennt (CR-GC-886)', () => {
  it.each(['mcp', 'host', 'status', 'init', 'remove', 'upgrade', 'import-code', 'rewind', 'skills'])(
    '%s --help und -h sind Hilfe, nie Ausfuehrung',
    (verb) => {
      expect(checkVerbArgs(verb, ['--help'])).toEqual({ kind: 'help' });
      expect(checkVerbArgs(verb, ['-h'])).toEqual({ kind: 'help' });
    },
  );

  it('die dokumentierten Aufrufe laufen', () => {
    for (const [verb, args] of [
      ['mcp', []],
      ['upgrade', ['--check']],
      ['upgrade', ['--to', '0.36.0', '--keep-host', '--global']],
      ['upgrade', ['--refresh-only']],
      ['rewind', ['HEAD~1', '--force', '--snapshot', 'alt/stand.json']],
      ['import-code', ['src']],
      ['import-code', []],
      ['skills', ['sync']],
    ] as const) {
      expect(checkVerbArgs(verb, [...args]), `${verb} ${args.join(' ')}`).toEqual({ kind: 'run' });
    }
  });

  it('ein unbekanntes Flag bricht ab und nennt es', () => {
    const v = checkVerbArgs('upgrade', ['--chek']);
    expect(v).toMatchObject({ kind: 'error' });
    expect(v.kind === 'error' && v.message).toContain('--chek');
  });

  it('ein ueberzaehliges Argument bricht ab', () => {
    expect(checkVerbArgs('init', ['foo'])).toMatchObject({ kind: 'error' });
    expect(checkVerbArgs('upgrade', ['0.36.0'])).toMatchObject({ kind: 'error' });
    expect(checkVerbArgs('status', ['x'])).toMatchObject({ kind: 'error' });
  });

  it('ein Flag ohne seinen Wert bricht ab', () => {
    expect(checkVerbArgs('upgrade', ['--to'])).toMatchObject({ kind: 'error' });
    expect(checkVerbArgs('upgrade', ['--to', '--check'])).toMatchObject({ kind: 'error' });
  });
});

describe('der echte Einstieg fasst bei --help nichts an (CR-GC-886)', () => {
  let repo: string;
  const cli = join(import.meta.dirname, '..', 'dist', 'cli.js');

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'gc-cli-args-'));
    writeFileSync(join(repo, 'package.json'), '{"name":"demo"}\n');
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it.each(['init', 'upgrade', 'remove'])('%s --help: Exit 0, Hilfe auf stderr, keine Datei', (verb) => {
    const r = spawnSync(process.execPath, [cli, verb, '--help'], { cwd: repo, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('Usage:');
    expect(readdirSync(repo)).toEqual(['package.json']);
  });

  it('init --chek: Exit 1, keine Datei', () => {
    const r = spawnSync(process.execPath, [cli, 'init', '--chek'], { cwd: repo, encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('--chek');
    expect(readdirSync(repo)).toEqual(['package.json']);
  });
});
