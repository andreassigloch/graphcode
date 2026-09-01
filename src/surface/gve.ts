/**
 * gve.ts — Start und Aufsicht des Live-Dashboards (CR-GC-369/371/404).
 *
 * Aus `mcp-server.ts` herausgelöst, als die Aufsicht dazukam: Starten ist ein Vorgang,
 * Am-Leben-Halten ein zweiter, und der Host-Bootstrap sollte keinen von beiden im Detail
 * kennen.
 *
 * Seit CR-GC-404 gehört der Viewer dem REPO, nicht der Session, die zufällig die
 * Store-Wahl gewonnen hat: JEDE Session (Host wie Proxy) sorgt dafür, dass einer läuft,
 * und erst die LETZTE beendet ihn. Vorher hing das Dashboard am ältesten Fenster —
 * wer es schloss, nahm es allen anderen mit.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  forgetViewer,
  isAlive,
  liveSessions,
  rememberViewer,
  rememberedViewerPid,
  registerSession,
  reserveSpawn,
  unregisterSession,
} from './gve-sessions.js';

/**
 * A path in its physical form — the only form two processes can compare. A path
 * that cannot be resolved (a repo the viewer serves but this machine doesn't
 * have) stays as given: it will simply not match, which is the correct verdict.
 */
function physicalPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** Beendet eine Prozessgruppe (der Viewer ist `detached`, also ihr Führer). */
export function killProcessGroup(pid: number): void {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Schon weg.
  }
}

/** The installed viewer's CLI entry — resolved from THIS package's dependency tree. */
function resolveGveEntry(): string {
  return createRequire(import.meta.url).resolve('@sigloch/graph-view-edit/bin/gve.mjs');
}

export interface StartGveDeps {
  spawnImpl?: typeof spawn;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  resolveGve?: () => string;
  now?: () => number;
  /**
   * Darf dieser Durchlauf einen Viewer STARTEN, oder nur nachsehen? Der Poll dreht das
   * ab, wenn sein Startbudget aufgebraucht ist — nachsehen bleibt richtig (jemand kann
   * von Hand einen gestartet haben), ein vierter Startversuch nicht. Default: ja.
   */
  allowSpawn?: boolean;
  /** Wie ein Viewer beendet wird; injizierbar, damit Tests keine echte PID abschiessen. */
  killImpl?: (pid: number) => void;
}

/**
 * Budget der Identitaetsprobe — EINE Quelle fuer beide Frager (`ensureViewer` hier,
 * `graphcode status`). Zwei Kopien derselben Zahl waeren ein Parallelpfad: der Starter
 * duerfte einen Viewer fuer abwesend halten, den der Bericht noch sieht (oder umgekehrt),
 * und genau diese Uneinigkeit erzeugt die Waisen.
 *
 * 750 ms reichen, WEIL die Probe `api/config` fragt — eine Antwort ohne Graph-Rechnung
 * (gemessen 0,5 ms). Gegen `api/dashboard` war dasselbe Budget zu knapp; die Antwort war
 * damals aber nicht ein groesseres Budget, sondern der guenstigere Endpunkt.
 */
export const PROBE_TIMEOUT_MS = 750;

/** GVE ist der DEFAULT einer graphcode-Session; abschaltbar per Env, nie unter einem Runner. */
function gveDisabled(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.GRAPHCODE_NO_GVE || env.VITEST || env.CI);
}

/**
 * Bedient ein laufender Viewer GENAU DIESES Repo?
 *
 * Warum Identität und nicht Erreichbarkeit: eine `dashboard.url` kann von einem
 * fremden Viewer beantwortet werden, der den Port geerbt hat — genau der gemeldete
 * Fehler „`graphcode mcp` in Repo A öffnet das Dashboard von B". `GET
 * <url>api/config` nennt das Repo, das dort bedient wird; verglichen wird
 * PHYSISCH (realpath auf beiden Seiten), damit ein symlink-Pfad — /var vs
 * /private/var auf macOS, ein Worktree hinter einem Link — nicht als fremdes Repo
 * liest. Eine Antwort ohne `repoRoot` stammt von einem Viewer vor
 * graph-view-edit 0.8.0: nicht identifizierbar, also fremd.
 *
 * Warum `api/config` und nicht `api/dashboard` (CR-GC-452): dieselbe Identität,
 * aber ohne Rechnung. `api/dashboard` ermittelt zuerst Readiness über den
 * Host-Socket gegen den Store — in graphcode selbst ~1,1 s gemessen, gegen ein
 * Probe-Budget von 750 ms. Die Probe timeoutete also IMMER, `ensureViewer` las
 * das als „kein Viewer da" und startete einen weiteren; Vite bumpte den Port,
 * der neue schrieb seine Adresse, und die vorige Instanz blieb als Waise
 * stehen — sieben Viewer für ein Repo. Ein Timeout ist hier nicht „langsam",
 * sondern wird als Abwesenheit gehandelt; die Probe darf deshalb nichts
 * anfragen, was mit dem Graphen wächst.
 */
async function probeViewer(
  repoRoot: string,
  deps: StartGveDeps,
): Promise<{ url: string; servedBy: string | null } | null> {
  const urlFile = join(repoRoot, 'docs', 'views', 'dashboard.url');
  if (!existsSync(urlFile)) return null;
  const url = readFileSync(urlFile, 'utf8').trim();
  try {
    const res = await (deps.fetchImpl ?? fetch)(new URL('api/config', url), {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const served = res.ok ? ((await res.json()) as { repoRoot?: unknown }).repoRoot : undefined;
    return { url, servedBy: typeof served === 'string' ? served : null };
  } catch {
    return null; // Stale file from a crashed instance — no viewer answering.
  }
}

/**
 * Startet den Viewer als eigene Prozessgruppe und vermerkt seine PID im Repo.
 *
 * Der Viewer ist eine DEPENDENCY, gestartet aus `node_modules` (CR-GC-369) — nicht
 * je Session per `npx -y` geholt. Das kostete einen zweiten Registry-Roundtrip,
 * scheiterte offline und band den Viewer an das, was die Registry gerade `latest`
 * nannte, statt an die getestete Version. `process.execPath` statt Shebang: derselbe
 * node wie dieser Host, unabhängig von Exec-Bits und vom `node` auf dem PATH.
 * stdout bleibt weg von fd 1 — das ist der MCP-JSON-RPC-Kanal.
 */
function spawnViewer(repoRoot: string, deps: StartGveDeps): ChildProcess | null {
  const env = deps.env ?? process.env;
  retireOrphanViewer(repoRoot, deps);
  let bin: string;
  let args: string[];
  if (env.GRAPHCODE_GVE_BIN) {
    [bin, ...args] = env.GRAPHCODE_GVE_BIN.split(' ');
  } else {
    let entry: string;
    try {
      entry = (deps.resolveGve ?? resolveGveEntry)();
    } catch (err) {
      // No viewer installed (a stripped install, a broken hoist): warn and serve
      // without a dashboard. A missing viewer must never take the gate down.
      process.stderr.write(
        `[graphcode] WARN: gve not resolvable (${err instanceof Error ? err.message : String(err)}) — ` +
          'reinstall @sigloch/graphcode, set GRAPHCODE_GVE_BIN, or silence with GRAPHCODE_NO_GVE=1\n',
      );
      return null;
    }
    bin = process.execPath;
    args = [entry];
  }
  const child = (deps.spawnImpl ?? spawn)(bin, [...args, '--repo', repoRoot], {
    stdio: ['ignore', 2, 2],
    detached: true,
  });
  child.on('error', (err: Error) => {
    process.stderr.write(
      `[graphcode] WARN: gve failed to start (${err.message}) — set GRAPHCODE_GVE_BIN or silence with GRAPHCODE_NO_GVE=1\n`,
    );
  });
  if (child.pid !== undefined) rememberViewer(repoRoot, child.pid);
  return child;
}

/**
 * Beendet den zuvor vermerkten Viewer, bevor ein neuer vermerkt wird (CR-GC-452).
 *
 * `.graphcode/gve.pid` fasst EINEN Viewer — `rememberViewer` ueberschreibt. Wer hier
 * lebend ueberschrieben wird, ist ab diesem Moment unerreichbar: keine Session kennt
 * seine PID mehr, `stopViewerIfLastSession` beendet nur den vermerkten, also ueberlebt
 * er jedes Sitzungsende. So standen sieben Viewer auf sieben Ports fuer EIN Repo.
 *
 * Dass hier ueberhaupt gespawnt wird, heisst: unter der vermerkten Adresse antwortet
 * keiner. Ein trotzdem lebender Vermerk ist damit per Definition die Waise und nicht
 * der amtierende Viewer — der haette geantwortet und `ensureViewer` waere gar nicht bis
 * hierher gekommen. Beendet wird nur, was graphcode selbst gestartet hat; ein von Hand
 * gestarteter `gve --repo .` steht nie in dieser Datei.
 */
function retireOrphanViewer(repoRoot: string, deps: StartGveDeps): void {
  const pid = rememberedViewerPid(repoRoot);
  if (pid === null || !isAlive(pid)) return;
  process.stderr.write(`[graphcode] gve: retiring unreachable viewer pid ${pid} before starting a new one\n`);
  (deps.killImpl ?? killProcessGroup)(pid);
  forgetViewer(repoRoot);
}

/** Was ein Ensure-Durchlauf vorgefunden bzw. getan hat. */
export type EnsureResult =
  /** Ein Viewer bedient dieses Repo — nichts zu tun. */
  | { kind: 'serving'; url: string }
  /** Wir haben einen gestartet. */
  | { kind: 'spawned'; child: ChildProcess }
  /** Eine andere Session startet gerade — ihr nicht ins Wort fallen. */
  | { kind: 'busy' }
  /** Kein Viewer startbar (nicht auflösbar) oder abgeschaltet. */
  | { kind: 'unavailable'; reason: string };

/**
 * Ein Durchlauf: sorge dafür, dass EIN Viewer dieses Repo bedient.
 *
 * Die Reservierung (`reserveSpawn`) ist der Grund, warum N parallele Sessions
 * nicht N Viewer starten: zwischen „keiner antwortet" und „der neue bindet den
 * Port" liegen Sekunden, in denen die Identitäts-Probe noch nichts sieht.
 */
export async function ensureViewer(repoRoot: string, deps: StartGveDeps = {}): Promise<EnsureResult> {
  const env = deps.env ?? process.env;
  if (gveDisabled(env)) return { kind: 'unavailable', reason: 'disabled' };
  const mine = physicalPath(repoRoot);
  const found = await probeViewer(repoRoot, deps);
  if (found && found.servedBy !== null && physicalPath(found.servedBy) === mine) {
    return { kind: 'serving', url: found.url };
  }
  if (found) {
    process.stderr.write(
      `[graphcode] gve: ${found.url} serves ${found.servedBy ?? 'another repo'}, ` +
        `not ${mine} — starting this repo's own dashboard\n`,
    );
  }
  if (deps.allowSpawn === false) return { kind: 'unavailable', reason: 'budget spent' };
  if (!reserveSpawn(repoRoot, (deps.now ?? Date.now)())) return { kind: 'busy' };
  const child = spawnViewer(repoRoot, deps);
  if (!child) return { kind: 'unavailable', reason: 'gve not resolvable' };
  return { kind: 'spawned', child };
}

/** Wie oft nachgesehen wird, ob das Dashboard noch da ist. */
const POLL_MS = 10_000;
/** So lange muss ein Viewer gelebt haben, damit seine Vorgaenger nicht mehr zaehlen. */
const STABLE_MS = 60_000;
/** So viele erfolglose Startversuche in Folge, dann nur noch eine ehrliche stderr-Zeile. */
const MAX_ATTEMPTS = 3;

export interface GveHandle {
  /** Diese Session braucht das Dashboard nicht mehr (Sessionende). */
  stop(): void;
}

export interface AttachDeps extends StartGveDeps {
  setIntervalImpl?: typeof setInterval;
  /** Wer sich als Session eintraegt — injizierbar, damit ein Test zwei Sessions spielen kann. */
  pid?: number;
}

/**
 * Beendet den Viewer, wenn keine Session dieses Repos mehr lebt.
 *
 * Beendet wird nur, was graphcode selbst gestartet hat (`.graphcode/gve.pid`) — ein
 * von Hand gestarteter `gve --repo .` gehoert seinem Starter und wird nicht abgeraeumt.
 */
function stopViewerIfLastSession(repoRoot: string, kill: (pid: number) => void): void {
  if (liveSessions(repoRoot).length > 0) return;
  const pid = rememberedViewerPid(repoRoot);
  if (pid === null) return;
  kill(pid);
  forgetViewer(repoRoot);
}

/**
 * Haengt diese Session an das Dashboard des Repos (CR-GC-404).
 *
 * Drei Regeln, eine Quelle:
 *   - jede Session sorgt dafuer, dass EIN Viewer laeuft (Wahlgewinner wie Proxy),
 *   - die Aufsicht ist ein Poll, kein Eltern-Kind-Band: so merkt auch eine Session
 *     den Tod des Viewers, die ihn nicht gestartet hat,
 *   - erst die letzte Session beendet ihn.
 *
 * Grenzen sind Absicht: nach drei erfolglosen Startversuchen wird nicht weiter
 * gestartet. Ein Viewer, der dreimal in Folge sofort stirbt, hat ein Problem, das ein
 * vierter Start nicht loest (belegter Port, kaputte Installation) — dann ist eine
 * ehrliche stderr-Zeile besser als eine Neustartschleife. Gepollt wird trotzdem
 * weiter: startet jemand von Hand einen Viewer, zaehlt das Budget wieder von vorn.
 * Ein Viewer, der lange genug lief, setzt es ebenfalls zurueck — sonst wuerde eine
 * Woche alte Session an drei ueber Tage verteilten Abstuerzen verhungern.
 */
export async function attachGve(repoRoot: string, deps: AttachDeps = {}): Promise<GveHandle | null> {
  const env = deps.env ?? process.env;
  if (gveDisabled(env)) return null;
  const now = deps.now ?? Date.now;
  const pid = deps.pid ?? process.pid;
  registerSession(repoRoot, pid);

  let stopped = false;
  let attempts = 0;
  let dead = false; // kein Viewer installiert: Pollen waere sinnlos
  let lastSpawnAt = 0;
  let announced = '';

  /** Sagt eine Lage EINMAL — ein 10-Sekunden-Poll darf die stderr nicht zumuellen. */
  const announce = (line: string): void => {
    if (announced === line) return;
    announced = line;
    process.stderr.write(line);
  };

  const tick = async (): Promise<void> => {
    if (stopped || dead) return;
    const result = await ensureViewer(repoRoot, { ...deps, allowSpawn: attempts < MAX_ATTEMPTS });
    switch (result.kind) {
      case 'serving':
        if (lastSpawnAt && now() - lastSpawnAt >= STABLE_MS) attempts = 0;
        announce(`[graphcode] gve: dashboard at ${result.url}\n`);
        return;
      case 'busy':
        return;
      case 'spawned':
        attempts++;
        lastSpawnAt = now();
        announce('[graphcode] gve: dashboard starting — URL lands in docs/views/dashboard.url\n');
        return;
      case 'unavailable':
        if (result.reason === 'budget spent') {
          announce(
            `[graphcode] WARN: gve: dashboard did not come up in ${MAX_ATTEMPTS} attempts — no further ` +
              'restarts. Start it by hand with `gve --repo .` after fixing the cause.\n',
          );
          return;
        }
        dead = true; // nicht aufloesbar — daran aendert der naechste Poll nichts
        return;
    }
  };

  await tick();
  const timer = (deps.setIntervalImpl ?? setInterval)(() => void tick(), POLL_MS);
  (timer as { unref?: () => void }).unref?.();

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      clearInterval(timer as NodeJS.Timeout);
      unregisterSession(repoRoot, pid);
      stopViewerIfLastSession(repoRoot, deps.killImpl ?? killProcessGroup);
    },
  };
}
