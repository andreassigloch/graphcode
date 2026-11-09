/**
 * TEST-init-verb (CR-GC-900) — `graphcode init` installiert die Abhaengigkeit und nennt dem
 * Menschen die naechsten Schritte. Der Scaffold laeuft echt in ein Temp-Repo; nur der
 * Paketmanager ist injiziert, damit der Test weder Netz noch Registry braucht. Die echte
 * Installation prueft der Smoke-Lauf im CR.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeInit, formatInit, packageManager, type Run } from '../src/surface/init-verb.js';
import { checkVerbArgs } from '../src/surface/cli-args.js';

describe('TEST-init-verb (CR-GC-900)', () => {
  let repo: string;
  let calls: string[];

  function runner(fail = false): Run {
    return (cmd, args, cwd) => {
      calls.push(`${cmd} ${args.join(' ')} @${cwd === repo ? 'repo' : cwd}`);
      return fail ? { status: 1, stdout: '', stderr: 'npm ERR! 404' } : { status: 0, stdout: '', stderr: '' };
    };
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'gc-init-verb-'));
    calls = [];
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('scaffoldet, traegt die Abhaengigkeit ein und installiert sie im Repo', async () => {
    const report = await executeInit({ repoRoot: repo }, { run: runner() });
    expect(existsSync(join(repo, '.mcp.json'))).toBe(true);
    expect(existsSync(join(repo, 'package.json'))).toBe(true);
    expect(calls).toEqual(['npm install @repo']);
    expect(report.installOk).toBe(true);
    expect(report.result.action).toBe('init');
  });

  it('nennt nach erfolgreicher Installation die vier naechsten Schritte', async () => {
    const text = formatInit(await executeInit({ repoRoot: repo }, { run: runner() }));
    expect(text).toContain('Installed @sigloch/graphcode (`npm install`)');
    expect(text).toContain('.graphcode/` to .gitignore');
    expect(text).toContain('Reload your agent host');
    expect(text).toContain('Read GRAPHCODE.md, then call graph_readiness');
    expect(text).toContain('Read GRAPHCODE-STEERING.md');
    expect(text).not.toContain('"created"');
  });

  it('fehlgeschlagene Installation: Meldung nennt den Befehl, Dateien bleiben stehen', async () => {
    const report = await executeInit({ repoRoot: repo }, { run: runner(true) });
    const text = formatInit(report);
    expect(report.installOk).toBe(false);
    expect(text).toContain('Install failed: `npm install`');
    expect(text).toContain('npm ERR! 404');
    expect(text).not.toContain('Next steps');
    expect(existsSync(join(repo, '.mcp.json'))).toBe(true);
  });

  it('folgt der Lockdatei: pnpm und yarn statt npm', async () => {
    expect(packageManager(repo)).toBe('npm');
    writeFileSync(join(repo, 'yarn.lock'), '');
    expect(packageManager(repo)).toBe('yarn');
    writeFileSync(join(repo, 'pnpm-lock.yaml'), '');
    await executeInit({ repoRoot: repo }, { run: runner() });
    expect(calls).toEqual(['pnpm install @repo']);
  });

  it('init kennt --json und kein anderes Flag', () => {
    expect(checkVerbArgs('init', ['--json'])).toEqual({ kind: 'run' });
    expect(checkVerbArgs('init', ['--yes']).kind).toBe('error');
  });
});
