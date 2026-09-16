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
import { executeUpgrade, formatUpgrade, UpgradeError, type UpgradeDeps } from '../src/surface/upgrade.js';

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

  /**
   * CR-GC-538: ein Repo, dem KEIN ausgeliefertes Artefakt fehlt. Ohne diesen Standard
   * meldete jeder Fall hier Drift — ein leeres Temp-Repo hat naturgemaess keinen Skill —,
   * und die Faelle wuerden nicht mehr messen, wofuer sie da sind (die Versionsdrift).
   * Der Fehlbestand bekommt eigene Faelle weiter unten.
   */
  const vollstaendig: Pick<UpgradeDeps, 'syncSkillsImpl'> = {
    syncSkillsImpl: (repoRoot) => ({ repoRoot, added: [], updated: [], unchanged: ['.claude/commands/se/status.md'] }),
  };

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
    const report = await executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: runner(), cliVersion: '0.17.0', sleep: async () => {} });
    expect(calls).toEqual([
      'npm view @sigloch/graphcode version',
      'npm outdated --json --long=false',
      'npm install @sigloch/graphcode@0.17.0',
      'node ./node_modules/@sigloch/graphcode/dist/cli.js upgrade --refresh-only',
    ]);
    expect(report.repoBefore).toBe('0.13.2');
    expect(report.repoAfter).toBe('0.17.0');
  });

  it('ruft im Übergang das alte Refresh-Verb, wenn das Ziel `--refresh-only` noch nicht kennt', async () => {
    writeRepoInstall('0.13.2');
    await executeUpgrade({ repoRoot: repo, to: '0.16.0' }, { ...vollstaendig, run: runner(), cliVersion: '0.16.0', sleep: async () => {} });
    expect(calls).toEqual([
      'npm outdated --json --long=false',
      'npm install @sigloch/graphcode@0.16.0',
      'node ./node_modules/@sigloch/graphcode/dist/cli.js update',
    ]);
  });

  it('beendet den Host, der auf altem Code weiterläuft', async () => {
    writeRepoInstall('0.13.2');
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z', version: '0.13.2' });
    const report = await executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: runner(), cliVersion: '0.17.0', ...releasingHost() });
    expect(report.hostStopped).toBe(true);
    expect(existsSync(join(repo, '.graphcode', 'owner.lock'))).toBe(false);
    expect(report.steps.join('\n')).toContain('pid 4242 beendet');
  });

  it('lässt den Host mit --keep-host stehen und sagt, dass er alt bleibt', async () => {
    writeRepoInstall('0.13.2');
    writeLock({ pid: 4242, hostname: 'this-box', startedAt: '2026-08-20T09:00:00.000Z', version: '0.13.2' });
    const report = await executeUpgrade(
      { repoRoot: repo, keepHost: true },
      { ...vollstaendig, run: runner(), cliVersion: '0.17.0', ...releasingHost() },
    );
    expect(report.hostStopped).toBe(false);
    expect(existsSync(join(repo, '.graphcode', 'owner.lock'))).toBe(true);
    expect(report.steps.join('\n')).toContain('läuft auf altem Code weiter');
  });

  it('fasst das globale Paket nur mit --global an', async () => {
    writeRepoInstall('0.17.0');
    const plain = await executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: runner(), cliVersion: '0.13.2', sleep: async () => {} });
    expect(calls.some((c) => c.includes('-g'))).toBe(false);
    expect(plain.steps.join('\n')).toContain('--global');

    calls = [];
    await executeUpgrade({ repoRoot: repo, global: true }, { ...vollstaendig, run: runner(), cliVersion: '0.13.2', sleep: async () => {} });
    expect(calls).toContain('npm install -g @sigloch/graphcode@0.17.0');
  });

  it('downgradet nicht, wenn die Registry hinter dem Installierten liegt', async () => {
    writeRepoInstall('0.16.0');
    await expect(
      executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: runner({ viewVersion: '0.15.0' }), cliVersion: '0.16.0' }),
    ).rejects.toThrow(/Downgrade/);
    // Die Bestandserhebung (CR-GC-538) laeuft VOR dem Downgrade-Riegel, ist aber read-only:
    // installiert wurde nichts, und genau das haelt diese Liste fest.
    expect(calls).toEqual(['npm view @sigloch/graphcode version', 'npm outdated --json --long=false']);
  });

  it('erzwingt dieselbe ältere Version mit --to', async () => {
    writeRepoInstall('0.16.0');
    const report = await executeUpgrade(
      { repoRoot: repo, to: '0.15.0' },
      { ...vollstaendig, run: runner(), cliVersion: '0.16.0', sleep: async () => {} },
    );
    expect(report.repoAfter).toBe('0.15.0');
  });

  it('--check ändert nichts und meldet die Drift per Exit-Signal', async () => {
    writeRepoInstall('0.13.2');
    const report = await executeUpgrade({ repoRoot: repo, check: true }, { ...vollstaendig, run: runner(), cliVersion: '0.17.0' });
    expect(calls).toEqual(['npm view @sigloch/graphcode version', 'npm outdated --json --long=false']);
    expect(report.drift).toBe(true);
    expect(formatUpgrade(report, true)).toContain('→ veraltet');
  });

  it('meldet einen aktuellen Stand als aktuell', async () => {
    writeRepoInstall('0.17.0');
    const report = await executeUpgrade({ repoRoot: repo, check: true }, { ...vollstaendig, run: runner(), cliVersion: '0.17.0' });
    expect(report.drift).toBe(false);
    expect(formatUpgrade(report, true)).toContain('→ aktuell');
  });

  it('bricht ohne Registry laut ab und nennt den Offline-Weg', async () => {
    const dead: UpgradeDeps['run'] = () => ({ status: 1, stdout: '', stderr: 'ENOTFOUND registry.npmjs.org' });
    await expect(executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: dead, cliVersion: '0.17.0' })).rejects.toThrow(/--to <version>/);
  });

  it('schreibt keine Artefakte, wenn die Installation fehlschlägt', async () => {
    writeRepoInstall('0.13.2');
    await expect(
      executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: runner({ failInstall: true }), cliVersion: '0.17.0' }),
    ).rejects.toThrow(UpgradeError);
    expect(calls.some((c) => c.includes('cli.js'))).toBe(false);
  });

  it('verschweigt einen fehlgeschlagenen Artefakt-Refresh nicht', async () => {
    writeRepoInstall('0.13.2');
    await expect(
      executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: runner({ failRefresh: true }), cliVersion: '0.17.0' }),
    ).rejects.toThrow(/Artefakte sind es nicht/);
  });

  it('verlangt ein initialisiertes Repo statt still nichts zu tun', async () => {
    rmSync(join(repo, 'package.json'));
    await expect(executeUpgrade({ repoRoot: repo }, { ...vollstaendig, run: runner() })).rejects.toThrow(/graphcode init/);
  });

  // -------------------------------------------------------------------------
  // CR-GC-538 — das Urteil bekommt eine unabhaengig erhobene Gegenzahl.
  //
  // Der Befund: bok meldete "aktuell" (exit 0) bei drei gleichen Versionsnummern,
  // waehrend `se/optimize.md` von 31 ausgelieferten Skills fehlte. `graphcode skills
  // sync` fand den Fehlbestand sofort — die Zahl EXISTIERTE also, sie wurde nur nie
  // gegen die Versionsgleichheit gehalten. Und der Blindfleck ist strukturell: bok
  // faehrt @sigloch/graphcode als SYMLINK auf den Arbeitsbaum, ein dort ergaenzter
  // Skill bekommt nie einen Versions-Bump, also KANN eine reine Versionspruefung ihn
  // prinzipiell nicht sehen.
  // -------------------------------------------------------------------------

  /** Ein npm, das `outdated` mit echten Daten beantwortet — der Rest wie `runner()`. */
  function runnerMitOutdated(outdated: Record<string, { current?: string; wanted?: string }>, status = 1): UpgradeDeps['run'] {
    const basis = runner();
    return (cmd, args, cwd) => {
      if (args[0] === 'outdated') {
        calls.push([cmd, ...args].join(' '));
        return { status, stdout: JSON.stringify(outdated), stderr: '' };
      }
      return basis!(cmd, args, cwd);
    };
  }

  it('gleiche Version, aber ein Skill fehlt → veraltet, und der Bericht NENNT ihn', async () => {
    writeRepoInstall('0.17.0');
    const fehlt = '.claude/commands/se/optimize.md';
    const report = await executeUpgrade(
      { repoRoot: repo, check: true },
      {
        run: runner(),
        cliVersion: '0.17.0',
        syncSkillsImpl: (repoRoot) => ({ repoRoot, added: [fehlt], updated: [], unchanged: ['.claude/commands/se/status.md'] }),
      },
    );

    // Alle drei Versionen gleich — die alte Quelle allein saehe hier nichts.
    expect(report.cli).toBe(report.repoAfter);
    expect(report.drift, 'ein fehlendes Artefakt ist Drift, auch bei gleicher Version').toBe(true);
    expect(report.missingSkills).toEqual([fehlt]);
    const text = formatUpgrade(report, true);
    expect(text).toContain(fehlt);
    expect(text).toContain('→ veraltet');
  });

  it('der Trockenlauf schreibt nichts — nach --check liegt kein Skill im Repo', async () => {
    writeRepoInstall('0.17.0');
    // Die ECHTE Bestandsquelle, nicht die injizierte: sie muss klassifizieren, ohne zu wirken.
    const report = await executeUpgrade({ repoRoot: repo, check: true }, { run: runner(), cliVersion: '0.17.0' });

    expect(report.missingSkills.length, 'ein leeres Repo hat keinen einzigen Skill').toBeGreaterThan(0);
    expect(existsSync(join(repo, '.claude')), '--check hat geschrieben').toBe(false);
  });

  it('ein Zug, der nur ein anderes @sigloch-Paket bewegt, ist ebenfalls Drift', async () => {
    writeRepoInstall('0.17.0');
    const report = await executeUpgrade(
      { repoRoot: repo, check: true },
      {
        ...vollstaendig,
        run: runnerMitOutdated({
          '@sigloch/contracts': { current: '10.5.0', wanted: '10.6.0' },
          'links-fremd': { current: '1.0.0', wanted: '2.0.0' }, // nicht unsere Familie
        }),
        cliVersion: '0.17.0',
      },
    );

    expect(report.drift).toBe(true);
    expect(report.staleDeps).toEqual([{ name: '@sigloch/contracts', current: '10.5.0', wanted: '10.6.0' }]);
    expect(formatUpgrade(report, true)).toContain('@sigloch/contracts 10.5.0→10.6.0');
  });

  it('kein Fehlalarm: vollstaendiges Repo, Familie im Range → aktuell', async () => {
    writeRepoInstall('0.17.0');
    const report = await executeUpgrade(
      { repoRoot: repo, check: true },
      { ...vollstaendig, run: runnerMitOutdated({ '@sigloch/contracts': { current: '10.6.0', wanted: '10.6.0' } }), cliVersion: '0.17.0' },
    );

    expect(report.drift).toBe(false);
    expect(report.staleDeps).toEqual([]);
    expect(report.depsChecked).toBe(true);
    expect(formatUpgrade(report, true)).toContain('→ aktuell');
  });

  it('nicht auswertbares npm outdated meldet NICHT GEPRUEFT, nie stumme Ruhe', async () => {
    writeRepoInstall('0.17.0');
    const kaputt: UpgradeDeps['run'] = (cmd, args, cwd) => {
      if (args[0] === 'outdated') return { status: 1, stdout: 'npm ERR! irgendwas', stderr: '' };
      return runner()!(cmd, args, cwd);
    };
    const report = await executeUpgrade({ repoRoot: repo, check: true }, { ...vollstaendig, run: kaputt, cliVersion: '0.17.0' });

    expect(report.depsChecked).toBe(false);
    expect(formatUpgrade(report, true)).toContain('NICHT GEPRÜFT');
  });
});
