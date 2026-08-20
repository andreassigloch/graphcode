/**
 * status.ts — `graphcode status` (CR-GC-368): läuft mein Host, und wo ist MEIN Dashboard?
 *
 * Beantwortet genau die zwei Fragen, die ein Mensch beim Öffnen eines Repos hat,
 * ohne dass er einen Port kennen, `lsof` bedienen oder eine Datei interpretieren muss.
 *
 * Warum die Identitätsprobe (und nicht „Datei lesen, URL zeigen"): jede GVE-Instanz
 * startet auf demselben Default-Port (4317) und Vite bumpt bei Konflikt. Repo A kann
 * `:4317` in seine `dashboard.url` schreiben, sterben, und Repo Bs Viewer übernimmt den
 * Port — die Datei zeigt dann auf ein FREMDES Repo. `GET <url>api/dashboard` nennt den
 * bedienten `repoRoot`; nur der zählt. Verglichen wird physisch (realpath beidseitig),
 * sonst liest ein Symlink-Start (/var vs. /private/var auf macOS, ein Worktree über
 * einen Link) als fremdes Repo. Dieselbe Regel wie in `maybeStartGve` — eine Wahrheit
 * über „gehört dieser Viewer zu mir", zwei Aufrufer.
 *
 * Warum die Versions-Zeile (CR-GC-376): eine angezeigte Version, die nicht die
 * laufende ist, ist derselbe Defekt wie ein Dashboard, das ein fremdes Repo zeigt.
 * Drei Builds können hier auseinanderlaufen — das getippte CLI, der Host, der den
 * Store besitzt (er lebt mit dem Code, mit dem er gebootet hat), und der Repo-Install
 * in `node_modules`, den `npx` aus `.mcp.json` ZUERST nimmt. Verglichen wird rein
 * lokal; „gibt es in der Registry etwas Neueres" ist eine andere Frage mit Netz,
 * Timeout und Cache (FUNC-search-updates, Entwurf) und gehört nicht in ein Verb,
 * das immer antworten muss.
 *
 * Read-only: `status` startet und stoppt nichts. Gestartet wird das Dashboard vom
 * MCP-Host, beendet mit ihm.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { deriveMemberName } from './mcp-server.js';
import { readPackageVersion } from './package-version.js';

/** Wie lange auf die Identitätsantwort eines Viewers gewartet wird. */
const PROBE_TIMEOUT_MS = 750;

export interface HostStatus {
  /** `running` = Lock gehört einem lebenden Prozess; `stale` = Owner tot; `none` = kein Lock. */
  state: 'running' | 'stale' | 'none';
  pid?: number;
  hostname?: string;
  startedAt?: string;
  /** Der Build des Owners (Lock-Stempel, CR-GC-376) — fehlt bei Locks älterer Owner. */
  version?: string;
}

export interface DashboardStatus {
  /**
   * `running` = bedient DIESES Repo; `foreign` = antwortet, bedient ein anderes;
   * `unidentified` = antwortet, nennt sein Repo aber nicht (Viewer älter als das
   * `repoRoot`-Feld) — nicht als meiner verwertbar; `not-running` = keine/tote Adresse.
   */
  state: 'running' | 'foreign' | 'unidentified' | 'not-running';
  url?: string;
  /** Bei `foreign`: das Repo, das die antwortende Instanz tatsächlich bedient. */
  servedRepo?: string;
}

export interface VersionStatus {
  /** Der Build, der DIESEN Bericht schreibt. */
  cli: string;
  /** Der Build, der den Store besitzt (Lock-Stempel) — fehlt, wenn kein Host läuft. */
  host?: string;
  /** Der Build, den eine Agent-Session in diesem Repo bootet (`node_modules`). */
  repo?: string;
  /**
   * `ok` = alle vorhandenen Zahlen gleich; `drift` = mindestens eine ist älter;
   * `host-unknown` = ein Host läuft, sein Lock nennt aber keine Version (Build vor
   * diesem Stempel) — nicht als gleich verwertbar.
   */
  state: 'ok' | 'drift' | 'host-unknown';
  /** Bei `drift`/`host-unknown`: die EINE nächste Aktion. */
  action?: string;
}

export interface RepoStatus {
  repoRoot: string;
  member: string;
  host: HostStatus;
  dashboard: DashboardStatus;
  version: VersionStatus;
}

interface StatusDeps {
  fetchImpl?: typeof fetch;
  /** Liveness-Probe des Lock-Owners; injizierbar, weil `process.kill` im Test nicht steuerbar ist. */
  pidAlive?: (pid: number) => boolean;
  hostnameImpl?: () => string;
  /** Die eigene Version; injizierbar, damit ein Test nicht gegen die echte package.json driftet. */
  cliVersion?: string;
}

/**
 * Ein Pfad in seiner physischen Form — die einzige Form, in der zwei Prozesse
 * vergleichen können. Nicht auflösbar (ein Repo, das der Viewer bedient, das diese
 * Maschine aber nicht hat) → wie geliefert: passt dann schlicht nicht, was das
 * richtige Urteil ist.
 */
function physicalPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** `kill(pid, 0)`: Signal zugestellt → lebt; EPERM → lebt, gehört nur jemand anderem. */
function defaultPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** Host-Zustand aus `.graphcode/owner.lock` — derselben Datei, die `StoreLock` schreibt. */
export function readHostStatus(repoRoot: string, deps: StatusDeps = {}): HostStatus {
  const lockPath = join(repoRoot, '.graphcode', 'owner.lock');
  if (!existsSync(lockPath)) return { state: 'none' };
  let owner: { pid?: unknown; hostname?: unknown; startedAt?: unknown; version?: unknown };
  try {
    owner = JSON.parse(readFileSync(lockPath, 'utf8')) as typeof owner;
  } catch {
    return { state: 'stale' }; // unlesbar = kein Owner, den man benennen könnte
  }
  if (typeof owner.pid !== 'number') return { state: 'stale' };
  const base = {
    pid: owner.pid,
    hostname: typeof owner.hostname === 'string' ? owner.hostname : undefined,
    startedAt: typeof owner.startedAt === 'string' ? owner.startedAt : undefined,
    version: typeof owner.version === 'string' ? owner.version : undefined,
  };
  // Fremder Host: Liveness ist von hier aus nicht prüfbar — als laufend melden statt
  // einen fremden Rechner für tot zu erklären (dieselbe Vorsicht wie StoreLock).
  const here = (deps.hostnameImpl ?? hostname)();
  if (base.hostname && base.hostname !== here) return { state: 'running', ...base };
  const alive = (deps.pidAlive ?? defaultPidAlive)(owner.pid);
  return { state: alive ? 'running' : 'stale', ...base };
}

/** Dashboard-Zustand: Adresse aus `docs/views/dashboard.url`, Wahrheit aus `api/dashboard`. */
async function readDashboardStatus(repoRoot: string, deps: StatusDeps): Promise<DashboardStatus> {
  const urlFile = join(repoRoot, 'docs', 'views', 'dashboard.url');
  if (!existsSync(urlFile)) return { state: 'not-running' };
  const url = readFileSync(urlFile, 'utf8').trim();
  if (!url) return { state: 'not-running' };
  try {
    const res = await (deps.fetchImpl ?? fetch)(new URL('api/dashboard', url), {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const served = res.ok ? ((await res.json()) as { repoRoot?: unknown }).repoRoot : undefined;
    if (typeof served === 'string' && physicalPath(served) === physicalPath(repoRoot)) {
      return { state: 'running', url };
    }
    // Antwortet, ist aber nicht meiner. Ein Viewer ohne `repoRoot` ist zu alt für das
    // Feld: nicht identifizierbar — eigener Zustand, weil die nächste Aktion eine andere
    // ist (Viewer erneuern statt Adresse ignorieren).
    if (typeof served !== 'string') return { state: 'unidentified', url };
    return { state: 'foreign', url, servedRepo: served };
  } catch {
    // Datei aus einer hart gekillten Instanz (kein Shutdown, keine Aufräumung).
    return { state: 'not-running' };
  }
}

/**
 * Die Version, die eine Agent-Session in diesem Repo tatsächlich bootet.
 *
 * `.mcp.json` startet `npx -y @sigloch/graphcode mcp`, und npx nimmt den LOKALEN
 * Bin zuerst — ein Repo mit altem `node_modules` bootet also den alten Build,
 * während dasselbe Verb im Terminal (globales Paket) den neuen fährt. Genau diese
 * Zahl fehlt sonst im Bericht.
 */
export function readRepoInstallVersion(repoRoot: string): string | undefined {
  const manifest = join(repoRoot, 'node_modules', '@sigloch', 'graphcode', 'package.json');
  if (!existsSync(manifest)) return undefined;
  try {
    const version = (JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown }).version;
    return typeof version === 'string' && version.length > 0 ? version : undefined;
  } catch {
    return undefined;
  }
}

/** Vergleicht `1.10.0` > `1.9.0` numerisch je Stelle; Vorabkennung entscheidet zuletzt. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] => v.split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * Der Versions-Befund. Rein lokal — KEINE Registry-Abfrage: `status` ist read-only
 * und darf nicht an einem Proxy hängen, und die Frage „ist woanders etwas Neueres"
 * ist eine andere als „widersprechen sich die Zahlen HIER" (FUNC-search-updates,
 * Entwurf).
 *
 * Ziel ist die höchste vorhandene Zahl — der neueste Build, der auf dieser Maschine
 * schon liegt. Die Reihenfolge der Aktion ist nicht kosmetisch: der Repo-Install ist
 * zuerst dran, weil er das ist, was die nächste Agent-Session bootet.
 */
function judgeVersions(repoRoot: string, host: HostStatus, deps: StatusDeps): VersionStatus {
  const cli = deps.cliVersion ?? readPackageVersion();
  const repo = readRepoInstallVersion(repoRoot);
  const hostVersion = host.state === 'running' ? host.version : undefined;
  const base: VersionStatus = { cli, host: hostVersion, repo, state: 'ok' };

  const known = [cli, hostVersion, repo].filter((v): v is string => typeof v === 'string');
  const target = known.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max), known[0]);
  const behind = (v: string | undefined): boolean => typeof v === 'string' && compareVersions(v, target) < 0;

  // Eine Aktion für jeden Fall: `graphcode upgrade` zieht den Repo-Install, schreibt die
  // Artefakte aus dem neuen Build und beendet den alten Host. Der Mensch soll nicht
  // wissen muessen, WELCHE der drei Zahlen hinterherhinkt — nur, dass sie es tun.
  if (behind(repo) || behind(hostVersion)) {
    return { ...base, state: 'drift', action: 'graphcode upgrade' };
  }
  // Nur das getippte CLI ist alt: das liegt ausserhalb des Repos, deshalb `--global`.
  if (behind(cli)) {
    return { ...base, state: 'drift', action: 'graphcode upgrade --global' };
  }
  // Der fehlende Stempel kommt ZULETZT: ein Host ohne Versionsangabe ist ein
  // Erkenntnis-, kein Handlungsproblem — solange eine BEKANNTE Zahl hinterherhinkt,
  // ist deren Fix die nuetzlichere Aktion.
  if (host.state === 'running' && !hostVersion) {
    return {
      ...base,
      state: 'host-unknown',
      action: 'graphcode upgrade — sein Build stempelt seine Version nicht in den Lock',
    };
  }
  return base;
}

/** Erhebt den Zustand des Repos. Read-only, ohne Store-Zugriff (nimmt keinen Lock). */
export async function collectStatus(repoRoot: string, deps: StatusDeps = {}): Promise<RepoStatus> {
  const host = readHostStatus(repoRoot, deps);
  return {
    repoRoot,
    member: deriveMemberName(repoRoot),
    host,
    dashboard: await readDashboardStatus(repoRoot, deps),
    version: judgeVersions(repoRoot, host, deps),
  };
}

/** Feste Spaltenbreite, damit die zwei Zeilen als Tabelle lesbar sind. */
function row(label: string, state: string, detail: string): string {
  return `  ${label.padEnd(11)} ${state.padEnd(14)} ${detail}`;
}

/**
 * Der Bericht. Jede Nicht-OK-Zeile nennt EINE nächste Aktion — nie ein Menü, sonst
 * wird der Bericht gelesen und weggelegt (dieselbe Regel wie `firstStepHint`).
 */
export function formatStatus(s: RepoStatus): string {
  const host =
    s.host.state === 'running'
      ? row('MCP-Host', 'OK', `pid ${s.host.pid}${s.host.startedAt ? `, seit ${s.host.startedAt}` : ''}`)
      : s.host.state === 'stale'
        ? row('MCP-Host', 'läuft nicht', `→ Lock von pid ${s.host.pid ?? '?'} ist verwaist; graphcode mcp`)
        : row('MCP-Host', 'läuft nicht', '→ graphcode mcp');
  const dash =
    s.dashboard.state === 'running'
      ? row('Dashboard', 'OK', s.dashboard.url ?? '')
      : s.dashboard.state === 'foreign'
        ? row('Dashboard', 'fremdes Repo', `${s.dashboard.url} bedient ${s.dashboard.servedRepo}`)
        : s.dashboard.state === 'unidentified'
          ? row('Dashboard', 'unbekannt', `${s.dashboard.url} nennt sein Repo nicht (Viewer veraltet) → Agent-Session neu starten`)
          : row('Dashboard', 'läuft nicht', '→ startet mit dem MCP-Host; GRAPHCODE_NO_GVE gesetzt?');
  const parts = [
    `CLI ${s.version.cli}`,
    s.version.host ? `Host ${s.version.host}` : null,
    s.version.repo ? `Repo ${s.version.repo}` : null,
  ].filter((p): p is string => p !== null);
  const ver =
    s.version.state === 'ok'
      ? row('Version', 'OK', parts.join(' · '))
      : row('Version', s.version.state === 'drift' ? 'Drift' : 'unbekannt', `${parts.join(' · ')} → ${s.version.action}`);
  return `graphcode status — ${s.member}  (${s.repoRoot})\n${host}\n${dash}\n${ver}\n`;
}

/** Beide grün? Bestimmt den Exit-Code, damit ein Skript den Zustand abfragen kann. */
export function statusIsHealthy(s: RepoStatus): boolean {
  // Versions-Drift zählt als ungesund: eine angezeigte Zahl, die nicht die laufende
  // ist, ist derselbe Defekt wie ein Dashboard, das ein fremdes Repo zeigt.
  return s.host.state === 'running' && s.dashboard.state === 'running' && s.version.state === 'ok';
}
