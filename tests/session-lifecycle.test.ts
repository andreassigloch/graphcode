/**
 * TEST-session-lifecycle — der Host stirbt mit seiner Session (CR-GC-370).
 *
 * Pinnt die Eigenschaften, ohne die der Zombie-Fall zurückkommt: umgekehrte
 * Abbaureihenfolge (Store-Lock zuletzt), Weiterlaufen nach einem Fehlschlag,
 * Idempotenz, harter Deckel, und stdin-EOF als gleichwertiger Auslöser zum Signal.
 * Alle Prozess-Effekte sind injiziert — kein echtes Signal, kein echtes exit.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { SessionLifecycle } from '../src/session-lifecycle.js';

interface Harness {
  lc: SessionLifecycle;
  fire: (sig: NodeJS.Signals | 'stdin') => void;
  exits: number[];
  log: string[];
  timers: Array<() => void>;
}

/** Ein Lifecycle mit vollständig injizierten Auslösern. */
function makeLifecycle(): Harness {
  const handlers = new Map<string, () => void>();
  const exits: number[] = [];
  const log: string[] = [];
  const timers: Array<() => void> = [];
  const lc = new SessionLifecycle({
    onSignal: (sig, h) => handlers.set(sig, h),
    onStdinEnd: (h) => handlers.set('stdin', h),
    exit: (code) => exits.push(code),
    write: (m) => log.push(m),
    setTimeoutImpl: ((fn: () => void) => {
      timers.push(fn);
      return { unref: () => undefined } as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout,
  });
  lc.installTriggers();
  return {
    lc,
    fire: (sig) => handlers.get(sig)?.(),
    exits,
    log,
    timers,
  };
}

describe('TEST-session-lifecycle', () => {
  it('räumt rückwärts ab — der Store-Lock als Letztes', async () => {
    const order: string[] = [];
    const h = makeLifecycle();
    h.lc.add({ name: 'store lock', close: () => void order.push('lock') });
    h.lc.add({ name: 'host.sock', close: () => void order.push('sock') });
    h.lc.add({ name: 'gve dashboard', close: () => void order.push('gve') });
    await h.lc.shutdown('test');
    expect(order).toEqual(['gve', 'sock', 'lock']);
  });

  it('gibt den Lock auch frei, wenn eine frühere Freigabe wirft', async () => {
    const closed: string[] = [];
    const h = makeLifecycle();
    h.lc.add({ name: 'store lock', close: () => void closed.push('lock') });
    h.lc.add({
      name: 'gve dashboard',
      close: () => {
        throw new Error('viewer already gone');
      },
    });
    await h.lc.shutdown('test');
    expect(closed).toEqual(['lock']);
    expect(h.log.join('')).toContain('gve dashboard not released cleanly');
  });

  it('räumt genau einmal ab, auch bei zwei Auslösern', async () => {
    let closes = 0;
    const h = makeLifecycle();
    h.lc.add({ name: 'store lock', close: () => void closes++ });
    h.fire('SIGTERM');
    h.fire('stdin');
    await h.lc.shutdown('direkt');
    expect(closes).toBe(1);
  });

  it('behandelt stdin-EOF wie ein Signal — ein geschlossenes Editor-Fenster sendet keins', async () => {
    let closed = false;
    const h = makeLifecycle();
    h.lc.add({ name: 'store lock', close: () => void (closed = true) });
    h.fire('stdin');
    await Promise.resolve();
    expect(closed).toBe(true);
    expect(h.log.join('')).toContain('client disconnected');
  });

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)('%s löst denselben Weg aus', async (sig) => {
    let closed = false;
    const h = makeLifecycle();
    h.lc.add({ name: 'store lock', close: () => void (closed = true) });
    h.fire(sig);
    await Promise.resolve();
    expect(closed).toBe(true);
  });

  it('beendet auch dann, wenn eine Freigabe hängt — der Lock darf nicht bleiben', async () => {
    const h = makeLifecycle();
    h.lc.add({ name: 'store lock', close: () => new Promise<void>(() => undefined) }); // hängt für immer
    h.fire('SIGTERM');
    expect(h.exits).toEqual([]); // noch im Abbau
    h.timers.forEach((fn) => fn()); // Deckel läuft ab
    expect(h.exits).toEqual([0]);
  });

  it('meldet den Grund des Abbaus auf stderr', async () => {
    const h = makeLifecycle();
    await h.lc.shutdown('SIGTERM');
    expect(h.log.join('')).toContain('shutting down (SIGTERM)');
    expect(h.lc.isClosing).toBe(true);
  });
});
