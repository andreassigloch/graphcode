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
 * Read-only: `status` startet und stoppt nichts. Gestartet wird das Dashboard vom
 * MCP-Host, beendet mit ihm.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { deriveMemberName } from './mcp-server.js';

/** Wie lange auf die Identitätsantwort eines Viewers gewartet wird. */
const PROBE_TIMEOUT_MS = 750;

export interface HostStatus {
  /** `running` = Lock gehört einem lebenden Prozess; `stale` = Owner tot; `none` = kein Lock. */
  state: 'running' | 'stale' | 'none';
  pid?: number;
  hostname?: string;
  startedAt?: string;
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

export interface RepoStatus {
  repoRoot: string;
  member: string;
  host: HostStatus;
  dashboard: DashboardStatus;
}

interface StatusDeps {
  fetchImpl?: typeof fetch;
  /** Liveness-Probe des Lock-Owners; injizierbar, weil `process.kill` im Test nicht steuerbar ist. */
  pidAlive?: (pid: number) => boolean;
  hostnameImpl?: () => string;
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
function readHostStatus(repoRoot: string, deps: StatusDeps): HostStatus {
  const lockPath = join(repoRoot, '.graphcode', 'owner.lock');
  if (!existsSync(lockPath)) return { state: 'none' };
  let owner: { pid?: unknown; hostname?: unknown; startedAt?: unknown };
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

/** Erhebt den Zustand des Repos. Read-only, ohne Store-Zugriff (nimmt keinen Lock). */
export async function collectStatus(repoRoot: string, deps: StatusDeps = {}): Promise<RepoStatus> {
  return {
    repoRoot,
    member: deriveMemberName(repoRoot),
    host: readHostStatus(repoRoot, deps),
    dashboard: await readDashboardStatus(repoRoot, deps),
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
        ? row('MCP-Host', 'läuft nicht', `→ Lock von pid ${s.host.pid ?? '?'} ist verwaist; Agent-Session neu starten`)
        : row('MCP-Host', 'läuft nicht', '→ Agent-Session in diesem Repo starten (.mcp.json)');
  const dash =
    s.dashboard.state === 'running'
      ? row('Dashboard', 'OK', s.dashboard.url ?? '')
      : s.dashboard.state === 'foreign'
        ? row('Dashboard', 'fremdes Repo', `${s.dashboard.url} bedient ${s.dashboard.servedRepo}`)
        : s.dashboard.state === 'unidentified'
          ? row('Dashboard', 'unbekannt', `${s.dashboard.url} nennt sein Repo nicht (Viewer veraltet) → Agent-Session neu starten`)
          : row('Dashboard', 'läuft nicht', '→ startet mit dem MCP-Host; GRAPHCODE_NO_GVE gesetzt?');
  return `graphcode status — ${s.member}  (${s.repoRoot})\n${host}\n${dash}\n`;
}

/** Beide grün? Bestimmt den Exit-Code, damit ein Skript den Zustand abfragen kann. */
export function statusIsHealthy(s: RepoStatus): boolean {
  return s.host.state === 'running' && s.dashboard.state === 'running';
}
