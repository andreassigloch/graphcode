/**
 * TEST-upgrade — `graphcode upgrade` (CR-GC-377).
 *
 * Pinnt die Reihenfolge, die den Befehl ausmacht: erst installieren, dann die
 * Artefakte vom NEU installierten Build schreiben lassen, dann den alten Host
 * beenden. Läuft ein Schritt nicht, steht das im Bericht — kein stiller Erfolg.
 *
 * npm und Signale sind injiziert (kein Netz, keine echte PID); Repo, package.json,
 * node_modules und Lock sind echte Dateien im Temp-Verzeichnis.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeUpgrade, formatUpgrade, UpgradeError, type UpgradeDeps } from '../src/upgrade.js';

describe('TEST-upgrade (CR-GC-377)', () => {
  let repo: string;
  let calls: string[];

  /** Ein npm/Node, das nichts tut, aber protokolliert — plus die Installation als Dateieffekt. */
  function runner(opts: { viewVersion?: string; failInstall?: boolean; failRefresh?: boolean } = {}): UpgradeDeps['run'] {
    return (cmd, args, cwd) => {
      calls.push([cmd === process.execPath ? 'node' : cmd, ...args.map((a) => a.replace(cwd, '.'))].join(' '));
      if (args[0] === 'view') return { status: 0, stdout: `${opts.viewVersion ?? '0.17.0'}\n`, stderr: '' };
      if (args[0] === 'install' && !args.includes('-g')) {
        if (opts.failInstall) return { status: 1, stdout: '', stderr: 'E404' };
        writeRepoInstall((args[1] ?? '').split('@').pop() ?? '0.0.0');
        return { status: 0, stdout: '', stderr: '' };
      }
      if (opts.failRefresh && args.some((a) => a.endsWith('cli.js'))) {
        return { status: 1, stdout: '', stderr: 'refresh kaputt' };
      }
      return { status: 0, stdout: '', stderr: '' };
    };
  }

  /** Der Repo-Install inkl. dist/cli.js — das Ziel des Re-Exec. */
  function writeRepoInstall(version: string): void {
    const dir = join(repo, 'node_modules', '@sigloch', 'graphcode');
    mkdirSync(join(dir, 'dist'), { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@sigloch/graphcode', version }));
    writeFileSync(join(dir, 'dist', 'cli.js'), '// stub\n');
  }

  function writeLock(owner: object): void {
    mkdirSync(join(repo, '.graphcode'), { recursive: true });
    writeFileSync(join(repo, '.graphcode', 'owner.lock'), JSON.stringify(owner));
  }

  /** Ein Host, der auf SIGTERM seinen Lock losgibt — wie der echte beim Shutdown. */
  function releasingHost(): UpgradeDeps {
    return {
      pidAlive: () => true,
      hostnameImpl: () => 'this-box',
      killPid: () => rmSync(join(repo, '.graphcode', 'owner.lock'), { force: true }),
      sleep: async () => {},
    };
  }

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), 'gc-upgrade-')));
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'demo' }));
    calls = [];
  });

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('installiert erst, lässt dann den NEUEN Build die Artefakte schreiben', async () => {
    writeRepoInstall('0.13.2');
    const report = await executeUpgrade({ repoRoot: repo }, { run: runner(), cliVersion: '0.17.0', sleep: async () => {} });
    expect(calls).toEqual([
      'npm view @sigloch/graphcode version',
      'npm install @sigloch/graphcode@0.17.0',
      'node ./node_modules/@sigloch/graphcode/dist/cli.js upgrade --refresh-only',
    ]);
    expect(report.repoBefore).toBe('0.13.2');
    expect(report.repoAfter).toBe('0.17.0');
  });

  it('ruft im Übergang das alte Refresh-Verb, wenn das Ziel `--refresh-only` noch nicht kennt', async () => {
    writeRepoInstall('0.13.2');
    await executeUpgrade({ repoRoot: repo, to: '0.16.0' }, { run: runner(), cliVersion: '0.16.0', sleep: async () => {} });
    expect(calls).toEqual([
      'npm install @sigloch/graphcode@0.16.0',
      'node ./node_modules/@sigloch/graphcode/dist/cli.js update',
    ]);
  });

  it('beendet den Host, der auf altem Code weiterläuft', async () => {
    writeRepoInstall('0.13.2');
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z', version: '0.13.2' });
    const report = await executeUpgrade({ repoRoot: repo }, { run: runner(), cliVersion: '0.17.0', ...releasingHost() });
    expect(report.hostStopped).toBe(true);
    expect(existsSync(join(repo, '.graphcode', 'owner.lock'))).toBe(false);
    expect(report.steps.join('\n')).toContain('pid 4242 beendet');
  });

  it('lässt den Host mit --keep-host stehen und sagt, dass er alt bleibt', async () => {
    writeRepoInstall('0.13.2');
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z', version: '0.13.2' });
    const report = await executeUpgrade(
      { repoRoot: repo, keepHost: true },
      { run: runner(), cliVersion: '0.17.0', ...releasingHost() },
    );
    expect(report.hostStopped).toBe(false);
    expect(existsSync(join(repo, '.graphcode', 'owner.lock'))).toBe(true);
    expect(report.steps.join('\n')).toContain('läuft auf altem Code weiter');
  });

  it('fasst das globale Paket nur mit --global an', async () => {
    writeRepoInstall('0.17.0');
    const plain = await executeUpgrade({ repoRoot: repo }, { run: runner(), cliVersion: '0.13.2', sleep: async () => {} });
    expect(calls.some((c) => c.includes('-g'))).toBe(false);
    expect(plain.steps.join('\n')).toContain('--global');

    calls = [];
    await executeUpgrade({ repoRoot: repo, global: true }, { run: runner(), cliVersion: '0.13.2', sleep: async () => {} });
    expect(calls).toContain('npm install -g @sigloch/graphcode@0.17.0');
  });

  it('downgradet nicht, wenn die Registry hinter dem Installierten liegt', async () => {
    writeRepoInstall('0.16.0');
    await expect(
      executeUpgrade({ repoRoot: repo }, { run: runner({ viewVersion: '0.15.0' }), cliVersion: '0.16.0' }),
    ).rejects.toThrow(/Downgrade/);
    expect(calls).toEqual(['npm view @sigloch/graphcode version']);
  });

  it('erzwingt dieselbe ältere Version mit --to', async () => {
    writeRepoInstall('0.16.0');
    const report = await executeUpgrade(
      { repoRoot: repo, to: '0.15.0' },
      { run: runner(), cliVersion: '0.16.0', sleep: async () => {} },
    );
    expect(report.repoAfter).toBe('0.15.0');
  });

  it('--check ändert nichts und meldet die Drift per Exit-Signal', async () => {
    writeRepoInstall('0.13.2');
    const report = await executeUpgrade({ repoRoot: repo, check: true }, { run: runner(), cliVersion: '0.17.0' });
    expect(calls).toEqual(['npm view @sigloch/graphcode version']);
    expect(report.drift).toBe(true);
    expect(formatUpgrade(report, true)).toContain('→ veraltet');
  });

  it('meldet einen aktuellen Stand als aktuell', async () => {
    writeRepoInstall('0.17.0');
    const report = await executeUpgrade({ repoRoot: repo, check: true }, { run: runner(), cliVersion: '0.17.0' });
    expect(report.drift).toBe(false);
    expect(formatUpgrade(report, true)).toContain('→ aktuell');
  });

  it('bricht ohne Registry laut ab und nennt den Offline-Weg', async () => {
    const dead: UpgradeDeps['run'] = () => ({ status: 1, stdout: '', stderr: 'ENOTFOUND registry.npmjs.org' });
    await expect(executeUpgrade({ repoRoot: repo }, { run: dead, cliVersion: '0.17.0' })).rejects.toThrow(/--to <version>/);
  });

  it('schreibt keine Artefakte, wenn die Installation fehlschlägt', async () => {
    writeRepoInstall('0.13.2');
    await expect(
      executeUpgrade({ repoRoot: repo }, { run: runner({ failInstall: true }), cliVersion: '0.17.0' }),
    ).rejects.toThrow(UpgradeError);
    expect(calls.some((c) => c.includes('cli.js'))).toBe(false);
  });

  it('verschweigt einen fehlgeschlagenen Artefakt-Refresh nicht', async () => {
    writeRepoInstall('0.13.2');
    await expect(
      executeUpgrade({ repoRoot: repo }, { run: runner({ failRefresh: true }), cliVersion: '0.17.0' }),
    ).rejects.toThrow(/Artefakte sind es nicht/);
  });

  it('verlangt ein initialisiertes Repo statt still nichts zu tun', async () => {
    rmSync(join(repo, 'package.json'));
    await expect(executeUpgrade({ repoRoot: repo }, { run: runner() })).rejects.toThrow(/graphcode init/);
  });
});
