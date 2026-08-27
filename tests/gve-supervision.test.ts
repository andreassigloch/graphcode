/**
 * TEST-gve-supervision — das Dashboard gehoert dem Repo, nicht der Session (CR-GC-371/404).
 *
 * Der erste Auslöser (371): ein gesunder Host ohne Dashboard, weil der Viewer irgendwann
 * nach dem Start starb und das niemand bemerkte. Der zweite (404): der Viewer hing am
 * Gewinner der Store-Wahl — wer das aelteste Fenster schloss, nahm allen anderen offenen
 * Sessions das Dashboard mit. Diese Tests pinnen beides: den Neustart samt Grenze, und
 * dass erst die LETZTE Session das Licht ausmacht.
 *
 * Spawn, Zeit, Timer, Probe und Kill sind injiziert — kein echter Viewer, kein Netz,
 * keine echte PID.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { spawn, ChildProcess } from 'node:child_process';
import { attachGve } from '../src/surface/gve.js';
import { liveSessions, rememberedViewerPid } from '../src/surface/gve-sessions.js';

describe('TEST-gve-supervision', () => {
  let repo: string;
  let spawned: number[];
  let killed: number[];
  let ticks: Array<() => void>;
  let clock: number;
  /** Beantwortet die Identitaets-Probe: `true` = ein Viewer bedient dieses Repo. */
  let serving: boolean;
  let nextPid: number;

  const resolveGve = () => '/opt/node_modules/@sigloch/graph-view-edit/bin/gve.mjs';

  /** Ein Spawn, der nur seine PID hinterlaesst — der Viewer selbst ist hier nicht der Punkt. */
  const spawnImpl = (() => {
    const pid = nextPid++;
    spawned.push(pid);
    return { pid, on: () => undefined } as unknown as ChildProcess;
  }) as unknown as typeof spawn;

  /** Die Probe antwortet nur, solange `serving` gilt — sonst wie ein toter Port. */
  const fetchImpl = (async () => {
    if (!serving) throw new Error('ECONNREFUSED');
    return { ok: true, json: async () => ({ repoRoot: realpathSync(repo) }) };
  }) as unknown as typeof fetch;

  /** Der Viewer ist da: URL-Datei geschrieben, Probe antwortet. */
  function viewerCameUp(): void {
    mkdirSync(join(repo, 'docs', 'views'), { recursive: true });
    writeFileSync(join(repo, 'docs', 'views', 'dashboard.url'), 'http://localhost:4317/\n');
    serving = true;
  }

  const deps = (pid?: number) => ({
    env: {},
    spawnImpl,
    resolveGve,
    fetchImpl,
    pid,
    killImpl: (p: number) => void killed.push(p),
    now: () => clock,
    setIntervalImpl: ((fn: () => void) => {
      ticks.push(fn);
      return { unref: () => undefined } as unknown as NodeJS.Timeout;
    }) as unknown as typeof setInterval,
  });

  /** Laesst jeden Poll einmal laufen (der Durchlauf selbst ist asynchron). */
  async function poll(): Promise<void> {
    clock += 30_000; // ein Poll spaeter — die Spawn-Reservierung ist abgelaufen
    ticks.forEach((fn) => fn());
    await new Promise((r) => setTimeout(r, 0));
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'gve-sup-'));
    spawned = [];
    killed = [];
    ticks = [];
    clock = 1_000_000;
    serving = false;
    nextPid = 4242;
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it('startet den Viewer, wenn keiner dieses Repo bedient', async () => {
    const handle = await attachGve(repo, deps());
    expect(handle).not.toBeNull();
    expect(spawned).toEqual([4242]);
    expect(rememberedViewerPid(repo)).toBe(4242);
  });

  it('startet ihn neu, wenn er unbemerkt stirbt — auch ohne Eltern-Kind-Band', async () => {
    await attachGve(repo, deps());
    viewerCameUp();
    await poll();
    expect(spawned).toHaveLength(1); // bedient: kein zweiter Start
    serving = false; // der Viewer stirbt, niemand bekommt ein 'exit'
    await poll();
    expect(spawned).toEqual([4242, 4243]);
  });

  it('gibt nach drei Startversuchen auf, statt endlos zu starten', async () => {
    await attachGve(repo, deps()); // Versuch 1
    await poll(); // 2
    await poll(); // 3
    expect(spawned).toHaveLength(3);
    await poll();
    await poll();
    expect(spawned).toHaveLength(3); // kein vierter
  });

  it('setzt das Budget zurueck, wenn ein Viewer lange genug bediente', async () => {
    await attachGve(repo, deps());
    await poll();
    await poll();
    expect(spawned).toHaveLength(3); // Budget aufgebraucht
    viewerCameUp();
    clock += 120_000; // der letzte lief zwei Minuten
    await poll();
    serving = false;
    await poll();
    expect(spawned).toHaveLength(4); // Budget zurueckgesetzt: wird wieder gestartet
  });

  it('zwei Sessions starten EINEN Viewer, nicht zwei (Spawn-Reservierung)', async () => {
    await attachGve(repo, deps(process.pid));
    await attachGve(repo, deps(process.ppid));
    expect(spawned).toHaveLength(1);
  });

  it('das Ende EINER Session laesst den Viewer stehen, solange eine zweite lebt', async () => {
    const a = await attachGve(repo, deps(process.pid));
    const b = await attachGve(repo, deps(process.ppid));
    expect(liveSessions(repo)).toHaveLength(2);
    a!.stop();
    expect(killed).toEqual([]); // <- der CR: das Dashboard ueberlebt das erste Fenster
    expect(rememberedViewerPid(repo)).toBe(4242);
    b!.stop();
    expect(killed).toEqual([4242]); // erst die letzte macht das Licht aus
    expect(rememberedViewerPid(repo)).toBeNull();
    expect(liveSessions(repo)).toEqual([]);
  });

  it('beendet nur, was graphcode selbst gestartet hat (Hand-Start bleibt stehen)', async () => {
    viewerCameUp(); // jemand hat `gve --repo .` von Hand gestartet
    const handle = await attachGve(repo, deps());
    expect(spawned).toEqual([]);
    handle!.stop();
    expect(killed).toEqual([]);
  });

  it('raeumt den Viewer eines hart gekillten Hosts ab (der Waisen-Pfad)', async () => {
    // Ein Host, den das OS erschlagen hat: sein Session-Eintrag bleibt liegen, sein
    // Viewer laeuft weiter. Bisher fand ihn niemand mehr — jetzt zaehlt der Eintrag
    // nicht mehr mit, und die naechste Session, die geht, macht das Licht aus.
    const dead = await attachGve(repo, deps(0x7ffffffe)); // PID, die es nicht gibt
    void dead;
    expect(spawned).toEqual([4242]);
    const live = await attachGve(repo, deps(process.pid));
    expect(liveSessions(repo)).toEqual([process.pid]);
    live!.stop();
    expect(killed).toEqual([4242]);
  });

  // CR-GC-416 — FLOW-session-registry hat seit diesem CR einen Vertrag. Vorher las
  // `liveSessions` den Eintrag mit einem ungeprueften Cast: ein Eintrag ohne
  // `hostname` galt als "anderer Rechner", zaehlte nicht mit und blieb liegen — und
  // die letzte lebende Sitzung machte das Licht aus, obwohl noch eine da war.
  it('verwirft einen formfremden Sitzungseintrag, statt ihn als fremden Rechner zu lesen', async () => {
    await attachGve(repo, deps(process.pid));
    const bogus = join(repo, '.graphcode', 'sessions', '999999');
    writeFileSync(bogus, JSON.stringify({ pid: 999999, startedAt: '2026-08-25T00:00:00.000Z' })); // kein hostname

    expect(liveSessions(repo)).toEqual([process.pid]);
    expect(existsSync(bogus)).toBe(false); // formfremd = wertlos, wie unlesbar
  });

  it('liefert keinen Handle und traegt keine Session ein, wenn GVE abgeschaltet ist', async () => {
    const handle = await attachGve(repo, { ...deps(), env: { GRAPHCODE_NO_GVE: '1' } });
    expect(handle).toBeNull();
    expect(spawned).toEqual([]);
    expect(existsSync(join(repo, '.graphcode', 'sessions'))).toBe(false);
  });
});
