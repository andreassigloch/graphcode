/**
 * upgrade.ts — `graphcode upgrade` (CR-GC-377): ein Befehl, der wirklich alles aktuell macht.
 *
 * Vorgänger war `graphcode update`, und dessen Name war eine Lüge: es refreshte
 * Artefakte und schrieb einen Dep-Range, installierte aber nichts und beendete keinen
 * Host. Wer „update" tippte, blieb mit drei ungetanen Schritten zurück (Install,
 * Artefakte aus dem NEUEN Build, alter Host im Speicher) — und musste dafür wissen,
 * wie npx auflöst und wer den Store besitzt. Genau das soll ein Nutzer NICHT lernen
 * müssen. `update` ist deshalb ersatzlos gestrichen, nicht umbenannt.
 *
 * Die Reihenfolge ist die ganze Logik:
 *
 *   1. Ziel bestimmen — `npm view` (oder `--to <version>`, damit der Befehl auch
 *      ohne Registry benutzbar bleibt).
 *   2. Repo-Install ziehen — das ist der Build, den `npx` aus `.mcp.json` ZUERST
 *      nimmt, also der, den die nächste Agent-Session bootet.
 *   3. Artefakte vom NEU installierten Build schreiben lassen (Re-Exec), nicht vom
 *      laufenden. Sonst schreibt der alte Build die Skills der neuen Version — genau
 *      die Drift, die dieser Befehl beseitigt.
 *   4. Den alten Host beenden. Ein Prozess lebt mit dem Code, mit dem er gebootet hat;
 *      ohne diesen Schritt ist nach dem Upgrade weiter die alte Ontologie im Betrieb.
 *
 * Kein Schritt ist optional-still: jeder landet im Bericht, auch wenn er übersprungen
 * wurde. `--check` macht nichts und berichtet nur.
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { PACKAGE_NAME } from './scaffold-templates.js';
import { readPackageVersion } from './package-version.js';
import { readHostStatus, readRepoInstallVersion, compareVersions } from './status.js';

/**
 * Ab dieser Version kennt der installierte Build `upgrade --refresh-only`.
 * Darunter heißt der Artefakt-Refresh noch `update` — Migrations-Schalter für genau
 * diesen Übergang, löschbar, sobald kein Repo mehr unter 0.17.0 liegt.
 */
const REFRESH_ONLY_SINCE = '0.17.0';

/** Wie lange auf das Verschwinden des Locks gewartet wird, nachdem der Host SIGTERM bekam. */
const HOST_STOP_TIMEOUT_MS = 5000;
const HOST_STOP_POLL_MS = 100;

export class UpgradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpgradeError';
  }
}

export interface UpgradeOptions {
  repoRoot: string;
  /** Nur berichten, nichts ändern. */
  check?: boolean;
  /** Den laufenden Host NICHT beenden (er fährt dann weiter auf altem Code). */
  keepHost?: boolean;
  /** Auch das global installierte Paket ziehen — sonst fasst dieser Befehl nur das Repo an. */
  global?: boolean;
  /** Zielversion explizit; überspringt die Registry-Abfrage (offline benutzbar). */
  to?: string;
}

export interface UpgradeDeps {
  /** Kommando-Ausführung; injizierbar, damit ein Test weder npm noch Netz braucht. */
  run?: (cmd: string, args: string[], cwd: string) => { status: number; stdout: string; stderr: string };
  pidAlive?: (pid: number) => boolean;
  killPid?: (pid: number) => void;
  hostnameImpl?: () => string;
  cliVersion?: string;
  sleep?: (ms: number) => Promise<void>;
}

export interface UpgradeReport {
  target: string;
  cli: string;
  repoBefore?: string;
  repoAfter?: string;
  hostBefore?: string;
  /** Hinkte vor dem Lauf irgendetwas hinter dem Ziel her? */
  drift: boolean;
  /** Was getan (oder bewusst nicht getan) wurde, in Reihenfolge. */
  steps: string[];
  hostStopped: boolean;
}

function defaultRun(cmd: string, args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error?.message ?? '') };
}

function defaultPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Der Artefakt-Refresh als eigener Einstieg — das, was der NEUE Build für uns tut. */
function refreshArgs(target: string): string[] {
  return compareVersions(target, REFRESH_ONLY_SINCE) < 0 ? ['update'] : ['upgrade', '--refresh-only'];
}

/**
 * Beendet den Host, der den Store besitzt, und wartet, bis sein Lock weg ist.
 *
 * Nur der Host auf DIESER Maschine: ein Lock von einem anderen Rechner ist von hier
 * aus weder prüf- noch beendbar (dieselbe Vorsicht wie in `StoreLock`).
 */
async function stopHost(repoRoot: string, deps: UpgradeDeps, steps: string[]): Promise<boolean> {
  const host = readHostStatus(repoRoot, { pidAlive: deps.pidAlive, hostnameImpl: deps.hostnameImpl });
  if (host.state !== 'running' || typeof host.pid !== 'number') {
    steps.push('Host: läuft nicht — nichts zu beenden');
    return false;
  }
  const here = (deps.hostnameImpl ?? hostname)();
  if (host.hostname && host.hostname !== here) {
    steps.push(`Host: pid ${host.pid} läuft auf ${host.hostname} — von hier nicht beendbar`);
    return false;
  }
  (deps.killPid ?? ((pid: number) => process.kill(pid, 'SIGTERM')))(host.pid);
  const lockPath = join(repoRoot, '.graphcode', 'owner.lock');
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  for (let waited = 0; waited < HOST_STOP_TIMEOUT_MS; waited += HOST_STOP_POLL_MS) {
    if (!existsSync(lockPath)) {
      steps.push(`Host: pid ${host.pid} beendet — startet mit der nächsten Agent-Session neu`);
      return true;
    }
    await sleep(HOST_STOP_POLL_MS);
  }
  steps.push(`Host: pid ${host.pid} hat auf SIGTERM nicht losgelassen — Lock prüfen`);
  return false;
}

/** Führt das Upgrade aus (oder berichtet nur, mit `check`). */
export async function executeUpgrade(opts: UpgradeOptions, deps: UpgradeDeps = {}): Promise<UpgradeReport> {
  const { repoRoot } = opts;
  const run = deps.run ?? defaultRun;
  const pidAlive = deps.pidAlive ?? defaultPidAlive;
  if (!existsSync(join(repoRoot, 'package.json'))) {
    throw new UpgradeError(`graphcode upgrade: ${repoRoot} hat keine package.json — zuerst \`graphcode init\``);
  }

  const cli = deps.cliVersion ?? readPackageVersion();
  const repoBefore = readRepoInstallVersion(repoRoot);
  const host = readHostStatus(repoRoot, { pidAlive, hostnameImpl: deps.hostnameImpl });
  const hostBefore = host.state === 'running' ? host.version : undefined;

  let target = opts.to;
  if (!target) {
    const view = run('npm', ['view', PACKAGE_NAME, 'version'], repoRoot);
    target = view.stdout.trim();
    if (view.status !== 0 || !/^\d+\.\d+\.\d+/.test(target)) {
      throw new UpgradeError(
        `graphcode upgrade: Registry nicht erreichbar (npm view ${PACKAGE_NAME}) — ` +
          `mit \`--to <version>\` läuft der Befehl auch offline.\n${view.stderr.trim()}`,
      );
    }
  }

  const behind = (v: string | undefined): boolean => typeof v === 'string' && compareVersions(v, target) < 0;
  const report: UpgradeReport = {
    target,
    cli,
    repoBefore,
    repoAfter: repoBefore,
    hostBefore,
    drift: behind(repoBefore) || behind(hostBefore) || behind(cli) || (host.state === 'running' && !hostBefore),
    steps: [],
    hostStopped: false,
  };
  if (opts.check) {
    report.steps.push('--check: nichts geändert');
    return report;
  }

  // Registry-Ziel HINTER dem, was schon da liegt: auf einer Entwicklermaschine ist das
  // der Normalfall (lokaler Build noch nicht publiziert). Ein Downgrade waere hier ein
  // stiller Datenverlust an Ontologie-Ständen — deshalb Abbruch statt Automatik.
  if (!opts.to && repoBefore && compareVersions(target, repoBefore) < 0) {
    throw new UpgradeError(
      `graphcode upgrade: die Registry kennt nur ${target}, installiert ist ${repoBefore} — ` +
        `das waere ein Downgrade. Nichts geaendert; mit \`--to ${target}\` ist es erzwingbar.`,
    );
  }
  if (!opts.to && compareVersions(target, cli) < 0) {
    report.steps.push(`Hinweis: das laufende CLI ${cli} ist neuer als die Registry (${target}) — unveroeffentlichter Build?`);
  }

  if (repoBefore === target) {
    report.steps.push(`Repo-Install: bereits ${target}`);
  } else {
    const install = run('npm', ['install', `${PACKAGE_NAME}@${target}`], repoRoot);
    if (install.status !== 0) {
      throw new UpgradeError(
        `graphcode upgrade: \`npm install ${PACKAGE_NAME}@${target}\` fehlgeschlagen — nichts geändert.\n${install.stderr.trim()}`,
      );
    }
    report.steps.push(`Repo-Install: ${repoBefore ?? '—'} → ${target}`);
  }

  // Der frisch installierte Build schreibt seine EIGENEN Artefakte — nicht der hier
  // laufende, der beliebig alt sein kann.
  const installedCli = join(repoRoot, 'node_modules', PACKAGE_NAME, 'dist', 'cli.js');
  if (!existsSync(installedCli)) {
    throw new UpgradeError(
      `graphcode upgrade: ${installedCli} fehlt nach der Installation — Artefakte NICHT geschrieben.`,
    );
  }
  const refresh = run(process.execPath, [installedCli, ...refreshArgs(target)], repoRoot);
  if (refresh.status !== 0) {
    throw new UpgradeError(
      `graphcode upgrade: Artefakt-Refresh durch ${target} fehlgeschlagen — Paket ist installiert, ` +
        `Artefakte sind es nicht.\n${refresh.stderr.trim()}`,
    );
  }
  report.steps.push(`Artefakte: von ${target} geschrieben`);

  if (opts.global) {
    const g = run('npm', ['install', '-g', `${PACKAGE_NAME}@${target}`], repoRoot);
    report.steps.push(
      g.status === 0 ? `Globales Paket: → ${target}` : `Globales Paket: fehlgeschlagen (${g.stderr.trim()})`,
    );
  } else if (compareVersions(cli, target) < 0) {
    report.steps.push(`Globales Paket: ${cli} bleibt alt — mit \`--global\` wird es mitgezogen`);
  }

  report.hostStopped = opts.keepHost
    ? (report.steps.push('Host: --keep-host — läuft auf altem Code weiter'), false)
    : await stopHost(repoRoot, { ...deps, pidAlive }, report.steps);

  report.repoAfter = readRepoInstallVersion(repoRoot);
  return report;
}

/** Der Bericht für Menschen — eine Zeile je Schritt, keine JSON-Wolke. */
export function formatUpgrade(r: UpgradeReport, check: boolean): string {
  const head = check
    ? `graphcode upgrade --check — Ziel ${r.target}`
    : `graphcode upgrade — Ziel ${r.target}`;
  const state = [
    `  CLI          ${r.cli}`,
    `  Repo-Install ${r.repoAfter ?? '—'}${r.repoBefore !== r.repoAfter ? ` (vorher ${r.repoBefore ?? '—'})` : ''}`,
    `  Host         ${r.hostBefore ?? (r.hostStopped ? 'beendet' : 'läuft nicht')}`,
  ].join('\n');
  const verdict = check ? (r.drift ? '\n  → veraltet: `graphcode upgrade`' : '\n  → aktuell') : '';
  return `${head}\n${state}\n${r.steps.map((s) => `  · ${s}`).join('\n')}${verdict}\n`;
}
