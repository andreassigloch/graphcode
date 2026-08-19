/**
 * gve.ts — Start und Aufsicht des Live-Dashboards (CR-GC-369/371).
 *
 * Aus `mcp-server.ts` herausgelöst, als die Aufsicht dazukam: Starten ist ein Vorgang,
 * Am-Leben-Halten ein zweiter, und der Host-Bootstrap sollte keinen von beiden im Detail
 * kennen.
 *
 * @author andreas@siglochconsulting
 */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn, type ChildProcess } from 'node:child_process';

/**
 * Auto-start the GVE live dashboard for the elected host: once the MCP server
 * owns the store, the viewer is one URL away without a manual launch. GVE is
 * the DEFAULT for a graphcode session; opt out via GRAPHCODE_NO_GVE=1 (e.g. in
 * `.mcp.json` env). GRAPHCODE_GVE_BIN overrides the launch command (space-split)
 * — needed when a local checkout must serve instead of the installed package.
 *
 * The viewer is a DEPENDENCY, started from `node_modules` (CR-GC-369) — not fetched
 * per session with `npx -y`. That cost the customer a second registry roundtrip on
 * top of `graphcode init`, failed offline, and pinned the viewer to whatever the
 * registry called `latest` rather than to a version this package was tested against.
 *
 * Guards, in order:
 *   - never under a test/CI runner (VITEST/CI) — suites must not spawn viewers;
 *   - a docs/views/dashboard.url whose instance serves THIS repo means some
 *     instance (manual or a previous session) already has it — never a second
 *     spawn; a stale file (crashed instance) OR one now answered by a FOREIGN
 *     repo's viewer falls through to a fresh spawn.
 *
 * Why identity, not reachability: every GVE defaults to the SAME
 * port (4317 — the viewer's config schema default, per repo overridable only by
 * its own config.json), and Vite bumps on conflict. So repo A can write
 * `:4317` into its dashboard.url, die, and repo B's viewer take that port —
 * after which A's probe was answered by B and A never started its own viewer.
 * The reported symptom was exactly that: `graphcode mcp` in repo A opened B's
 * dashboard. `GET <url>api/dashboard` names the REPO it serves,
 * and only that repo counts as already-serving. The path is compared physical
 * (realpath both sides): a symlinked launch path — /var vs /private/var on
 * macOS, a worktree reached through a link — must not read as a foreign repo.
 * An instance that answers without a `repoRoot` is a viewer older than that
 * field:
 * unidentifiable, therefore foreign, so this repo gets its own viewer.
 *
 * The spawned GVE writes/removes dashboard.url itself with its ACTUAL bound
 * port (dynamic on conflict) — that file, not this function, is how parallel
 * sessions discover the URL. Election losers never get here (electAndBoot
 * only), so N proxy sessions still mean ONE viewer. A spawn failure must never
 * kill the gate: warn on stderr, serve without a dashboard. The child dies
 * with this process (detached group, killed on 'exit'); stdout stays off fd 1
 * — that is the MCP JSON-RPC channel.
 */
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

/**
 * Beendet den Viewer samt seiner Prozessgruppe (`detached: true` machte ihn zum
 * Gruppenfuehrer). Der Aufrufer ist der SessionLifecycle — der Host haengt keine
 * eigenen Signal-Handler mehr an, sonst gaebe es zwei Abraeumpfade nebeneinander.
 */
export function killProcessGroup(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
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
}

export async function maybeStartGve(
  repoRoot: string,
  deps: StartGveDeps = {},
): Promise<ChildProcess | null> {
  const env = deps.env ?? process.env;
  if (env.GRAPHCODE_NO_GVE || env.VITEST || env.CI) return null;
  const urlFile = join(repoRoot, 'docs', 'views', 'dashboard.url');
  if (existsSync(urlFile)) {
    const url = readFileSync(urlFile, 'utf8').trim();
    const mine = physicalPath(repoRoot);
    try {
      const res = await (deps.fetchImpl ?? fetch)(new URL('api/dashboard', url), {
        signal: AbortSignal.timeout(750),
      });
      const served = res.ok ? ((await res.json()) as { repoRoot?: unknown }).repoRoot : undefined;
      if (typeof served === 'string' && physicalPath(served) === mine) {
        process.stderr.write(`[graphcode] gve: dashboard already serving this repo at ${url}\n`);
        return null;
      }
      process.stderr.write(
        `[graphcode] gve: ${url} serves ${typeof served === 'string' ? served : 'another repo'}, ` +
          `not ${mine} — starting this repo's own dashboard\n`,
      );
    } catch {
      // Stale file from a crashed instance — fall through and spawn fresh.
    }
  }
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
    // process.execPath, not the shebang: the entry is run by the SAME node that
    // runs this host, independent of exec bits and of what `node` means on PATH.
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
  process.stderr.write('[graphcode] gve: dashboard starting — URL lands in docs/views/dashboard.url\n');
  return child;
}

/** Wartezeiten zwischen den Neustartversuchen — kurz, kurz, einmal lang. */
const RESTART_DELAYS_MS = [1000, 3000, 10_000];
/** So lange muss ein Viewer gelebt haben, damit sein Vorgänger nicht mehr zählt. */
const STABLE_MS = 60_000;

export interface GveHandle {
  /** Beendet den Viewer endgültig — kein Neustart mehr (Sessionende). */
  stop(): void;
}

interface SuperviseDeps extends StartGveDeps {
  setTimeoutImpl?: typeof setTimeout;
  now?: () => number;
}

/**
 * Startet das Dashboard und hält es am Leben (CR-GC-371).
 *
 * Ohne Aufsicht war der Start ein Einmalvorgang in `electAndBoot`: stirbt der Viewer
 * danach — Vite-Absturz, jemand nimmt ihm den Port, OOM —, merkt es niemand. Der Host
 * lebt, der Store ist gesund, das Dashboard ist weg, und `status` meldet einen gesunden
 * Host ohne Adresse. Genau dieser Zustand war der Auslöser des CR.
 *
 * Grenzen sind Absicht: nach drei Fehlversuchen wird nicht weiter neu gestartet. Ein
 * Viewer, der dreimal in Folge sofort stirbt, hat ein Problem, das ein vierter Start
 * nicht löst (belegter Port, kaputte Installation) — dann ist eine ehrliche stderr-Zeile
 * besser als eine Neustartschleife. Ein Viewer, der lange genug lief, setzt das Budget
 * zurück; sonst würde eine Woche alte Session an drei über Tage verteilten Abstürzen
 * verhungern.
 */
export async function superviseGve(repoRoot: string, deps: SuperviseDeps = {}): Promise<GveHandle | null> {
  const setTimeoutFn = deps.setTimeoutImpl ?? setTimeout;
  const now = deps.now ?? Date.now;
  let stopped = false;
  let attempts = 0;
  let current: ChildProcess | null = null;

  const startOnce = async (): Promise<ChildProcess | null> => {
    const child = await maybeStartGve(repoRoot, deps);
    if (!child) return null;
    current = child;
    const startedAt = now();
    child.once('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (stopped) return; // wir haben ihn selbst beendet
      if (now() - startedAt >= STABLE_MS) attempts = 0; // lief lange genug: Budget zurück
      const delay = RESTART_DELAYS_MS[attempts];
      if (delay === undefined) {
        process.stderr.write(
          `[graphcode] WARN: gve: dashboard died ${RESTART_DELAYS_MS.length} times — giving up. ` +
            'Start it by hand with `gve --repo .` after fixing the cause.\n',
        );
        return;
      }
      attempts++;
      process.stderr.write(
        `[graphcode] gve: dashboard exited (${signal ?? `code ${code}`}) — restarting in ${delay / 1000}s\n`,
      );
      const timer = setTimeoutFn(() => void startOnce(), delay);
      (timer as { unref?: () => void }).unref?.();
    });
    return child;
  };

  const first = await startOnce();
  if (!first) return null;
  return {
    stop(): void {
      stopped = true;
      if (current) killProcessGroup(current);
    },
  };
}
