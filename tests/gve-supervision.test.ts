/**
 * TEST-gve-supervision — das Dashboard wird am Leben gehalten (CR-GC-371).
 *
 * Der Auslöser: ein gesunder Host ohne Dashboard, weil der Viewer irgendwann nach dem
 * Start starb und das niemand bemerkte. Diese Tests pinnen den Neustart, seine Grenze
 * und die eine Stelle, an der NICHT neu gestartet werden darf — das Sessionende.
 * Spawn, Zeit und Timer sind injiziert.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { spawn, ChildProcess } from 'node:child_process';
import { superviseGve } from '../src/gve.js';

/** Ein Kind, das man sterben lassen kann — `exit` ist das Ereignis, um das es geht. */
class FakeChild extends EventEmitter {
  pid = 4242;
  die(signal: NodeJS.Signals | null = null, code: number | null = 1): void {
    this.emit('exit', code, signal);
  }
}

describe('TEST-gve-supervision', () => {
  let repo: string;
  let children: FakeChild[];
  let timers: Array<() => void>;
  let clock: number;

  const resolveGve = () => '/opt/node_modules/@sigloch/graph-view-edit/bin/gve.mjs';

  const spawnImpl = (() => {
    const child = new FakeChild();
    children.push(child);
    return child as unknown as ChildProcess;
  }) as unknown as typeof spawn;

  const deps = () => ({
    env: {},
    spawnImpl,
    resolveGve,
    now: () => clock,
    setTimeoutImpl: ((fn: () => void) => {
      timers.push(fn);
      return { unref: () => undefined } as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout,
  });

  /** Lässt alle fälligen Neustart-Timer laufen (der Neustart selbst ist asynchron). */
  async function runTimers(): Promise<void> {
    const due = timers.splice(0);
    due.forEach((fn) => fn());
    await new Promise((r) => setTimeout(r, 0));
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'gve-sup-'));
    children = [];
    timers = [];
    clock = 1_000_000;
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('startet den Viewer neu, wenn er unerwartet stirbt', async () => {
    const handle = await superviseGve(repo, deps());
    expect(children).toHaveLength(1);
    children[0].die('SIGSEGV');
    expect(timers).toHaveLength(1);
    await runTimers();
    expect(children).toHaveLength(2);
    expect(handle).not.toBeNull();
  });

  it('gibt nach drei Fehlversuchen auf, statt endlos zu starten', async () => {
    await superviseGve(repo, deps());
    for (let i = 0; i < 3; i++) {
      children[children.length - 1].die(null, 1);
      await runTimers();
    }
    expect(children).toHaveLength(4); // Erststart + 3 Neustarts
    children[children.length - 1].die(null, 1);
    expect(timers).toHaveLength(0); // kein vierter Neustart
  });

  it('setzt das Budget zurueck, wenn ein Viewer lange genug lief', async () => {
    await superviseGve(repo, deps());
    for (let i = 0; i < 3; i++) {
      children[children.length - 1].die(null, 1);
      await runTimers();
    }
    clock += 120_000; // der vierte laeuft zwei Minuten
    children[children.length - 1].die(null, 1);
    expect(timers).toHaveLength(1); // Budget zurueckgesetzt: wird wieder gestartet
  });

  it('startet NICHT neu, nachdem stop() den Viewer beendet hat (Sessionende)', async () => {
    const handle = await superviseGve(repo, deps());
    handle!.stop();
    children[0].die('SIGTERM');
    expect(timers).toHaveLength(0);
    expect(children).toHaveLength(1);
  });

  it('liefert keinen Handle, wenn gar kein Viewer startet (Opt-out)', async () => {
    const handle = await superviseGve(repo, { ...deps(), env: { GRAPHCODE_NO_GVE: '1' } });
    expect(handle).toBeNull();
    expect(children).toHaveLength(0);
  });
});
