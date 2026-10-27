/**
 * TEST-host-ende-sichtbar — endet der Host, sieht sein Client das Ende (CR-GC-865).
 *
 * Der Befund: der Viewer erbte die stderr-Pipe des Hosts. Ein MCP-Client erkennt das Ende
 * des Servers am Ereignis `close`, und das kommt erst, wenn alle stdio-Pipes zu sind. Lebte
 * der Viewer weiter, weil eine zweite Sitzung ihn brauchte, hing jeder weitere Aufruf bis zum
 * Leerlauf-Abbruch des Clients (1800 s).
 *
 * Echte Prozesse: `dist/cli.js mcp` als Host, ein Stand-in-Viewer über GRAPHCODE_GVE_BIN, und
 * dieser Testprozess als zweite Sitzung, die den Viewer hält.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerSession, unregisterSession, rememberedViewerPid, isAlive } from '../src/surface/gve-sessions.js';
import { killProcessGroup } from '../src/surface/gve.js';

const cli = join(__dirname, '..', 'dist', 'cli.js');

/** Wartet, bis `ok()` gilt, höchstens `ms`. */
async function bis(ok: () => boolean, ms: number): Promise<boolean> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (ok()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return ok();
}

describe('TEST-host-ende-sichtbar', () => {
  let repo = '';
  let host: ChildProcess | null = null;

  afterEach(() => {
    const viewer = repo ? rememberedViewerPid(repo) : null;
    if (viewer !== null) killProcessGroup(viewer);
    if (host?.exitCode === null) host.kill('SIGKILL');
    if (repo) {
      unregisterSession(repo, process.pid);
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('der Client sieht das Ende des Hosts, auch wenn der Viewer für eine zweite Sitzung weiterläuft', async () => {
    repo = mkdtempSync(join(tmpdir(), 'gc-host-ende-'));
    const viewerScript = join(repo, 'stand-in-viewer.mjs');
    writeFileSync(viewerScript, 'setInterval(() => {}, 1000);\n');

    // VITEST und CI schalten das Dashboard ab — der Host soll es hier starten.
    const env: NodeJS.ProcessEnv = { ...process.env, GRAPHCODE_GVE_BIN: `${process.execPath} ${viewerScript}` };
    delete env.VITEST;
    delete env.CI;
    delete env.GRAPHCODE_NO_GVE;

    host = spawn(process.execPath, [cli, 'mcp'], { cwd: repo, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let closed = false;
    host.on('close', () => (closed = true));
    let stderr = '';
    host.stderr!.on('data', (d) => (stderr += String(d)));

    const lock = join(repo, '.graphcode', 'owner.lock');
    expect(await bis(() => existsSync(lock) && rememberedViewerPid(repo) !== null, 15_000), stderr).toBe(true);
    const viewer = rememberedViewerPid(repo)!;

    // Diese Sitzung braucht den Viewer noch: der Host darf ihn beim Abbau nicht beenden.
    registerSession(repo, process.pid);

    host.kill('SIGTERM');
    expect(await bis(() => host!.exitCode !== null, 5_000), 'der Host endet').toBe(true);
    expect(isAlive(viewer), 'der Viewer läuft für die zweite Sitzung weiter').toBe(true);
    expect(await bis(() => closed, 5_000), 'der Client sieht close — sonst hängt jeder weitere Aufruf').toBe(true);
  }, 30_000);
});
