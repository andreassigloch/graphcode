/**
 * store-lock.ts — store-ownership lock (CR-GC-218, option O2).
 *
 * Enforces the LOCKED constraint REQ-single-kuzu-owner ("exactly one StorageAdapter
 * owns `.graphcode/kuzu`") at runtime: a second writer on the SAME store is refused
 * LOUDLY instead of silently clobbering it. This is the recall-while-writing /
 * two-agents-one-repo failure (CR §2) turned into a safe, explicit error.
 *
 * The robust, aligned answer to concurrency is a git worktree per agent — the store
 * lives in `.graphcode/` (gitignored, repo-root-relative), so each worktree gets its
 * OWN store automatically, no shared mutable state (git's model). This lock covers the
 * remaining case: two agents that DO share one working directory. It does NOT try to
 * enable multi-writer concurrency (that would break single-writer Kuzu — rejected).
 *
 * Robustness: the lockfile is created atomically (`O_EXCL`); a held lock is reclaimed
 * ONLY on positive evidence the owner is gone (same host + PID dead) or a clearly stale
 * corrupt file (unparseable + old) — never when the owner might still be alive.
 *
 * @author andreas@siglochconsulting
 */
import { openSync, writeSync, closeSync, readFileSync, rmSync, mkdirSync, statSync, existsSync, utimesSync } from 'node:fs';
import { dirname } from 'node:path';
import { hostname } from 'node:os';

/** Grace period after which an UNPARSEABLE lockfile is treated as stale (a mid-write window is sub-second). */
const STALE_CORRUPT_MS = 5000;

/** Wie oft der Eigentümer seinen Lock stempelt (CR-GC-372). */
const HEARTBEAT_MS = 30_000;

/**
 * Ohne Puls so lange gilt ein Lock als frei — auch wenn seine PID lebt.
 *
 * Drei Schläge Spielraum: ein einzelner verpasster Schlag (Lastspitze, kurzer
 * Suspend) darf keinen Lock-Diebstahl auslösen.
 */
const STALE_HEARTBEAT_MS = 90_000;

/** Identity written into the lockfile so only the true owner releases it. */
export interface LockOwner {
  pid: number;
  hostname: string;
  startedAt: string;
}

/** Thrown when the store is already owned by a live process (a second writer is refused). */
export class StoreOwnershipError extends Error {
  constructor(
    readonly owner: LockOwner,
    readonly lockPath: string,
  ) {
    super(
      `graphcode: this store is already owned by pid ${owner.pid} on ${owner.hostname} ` +
        `(since ${owner.startedAt}) — exactly one writer per store (REQ-single-kuzu-owner). ` +
        `Run your second agent in its own git worktree (its own .graphcode store): ` +
        `\`gcw <branch>\` or \`git worktree add ../<dir> <branch>\`. ` +
        `If you are certain no other graphcode is running, delete ${lockPath}.`,
    );
    this.name = 'StoreOwnershipError';
  }
}

/** A single-owner lock over a store directory, held for the life of the harness process. */
export class StoreLock {
  private held = false;
  private readonly me: LockOwner;
  private pulse: NodeJS.Timeout | null = null;

  constructor(
    private readonly lockPath: string,
    private readonly opts: {
      /**
       * Der Lock gehört uns nicht mehr (ein anderer hat ihn übernommen, während wir
       * pulslos waren). Der Aufrufer MUSS die Session beenden — zwei Schreiber auf
       * einem Kuzu-Store sind der Fall, den O2 ausschließt.
       */
      onLockLost?: () => void;
    } = {},
  ) {
    this.me = { pid: process.pid, hostname: hostname(), startedAt: new Date().toISOString() };
  }

  /** Acquire the lock, or throw StoreOwnershipError if a live owner already holds it. */
  acquire(): void {
    if (this.held) return;
    mkdirSync(dirname(this.lockPath), { recursive: true });
    // Two tries: the second runs only after a stale lock was reclaimed.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const fd = openSync(this.lockPath, 'wx'); // O_EXCL — atomic create-if-absent
        writeSync(fd, JSON.stringify(this.me, null, 2));
        closeSync(fd);
        this.held = true;
        this.startPulse();
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        if (this.reclaimIfStale()) continue; // stale → removed, retry
        throw new StoreOwnershipError(this.readOwner() ?? this.me, this.lockPath);
      }
    }
    throw new Error(`StoreLock: failed to acquire ${this.lockPath} after reclaiming a stale lock.`);
  }

  /** Release the lock — only if THIS process still owns it (never remove a foreign lock). */
  release(): void {
    this.stopPulse();
    if (!this.held) return;
    const owner = this.readOwner();
    if (owner && owner.pid === this.me.pid && owner.hostname === this.me.hostname) {
      rmSync(this.lockPath, { force: true });
    }
    this.held = false;
  }

  /**
   * Ein Schlag: bestätigt, dass die Datei noch uns gehört, und stempelt sie.
   *
   * Gestempelt wird per `utimesSync`, nicht durch Neuschreiben des Inhalts — ein
   * Zeitstempel kann nicht halb geschrieben sein, ein JSON-Dokument schon (und
   * `reclaimIfStale` liest genau diese Datei aus einem anderen Prozess).
   *
   * Rückgabe `false` heißt: der Lock ist weg oder gehört einem anderen. Öffentlich,
   * weil der Timer nur der übliche Auslöser ist — ein Aufrufer darf jederzeit fragen.
   */
  heartbeat(): boolean {
    const owner = this.readOwner();
    if (!owner || owner.pid !== this.me.pid || owner.hostname !== this.me.hostname) return false;
    try {
      const now = new Date();
      utimesSync(this.lockPath, now, now);
      return true;
    } catch {
      return false; // Datei verschwunden zwischen Lesen und Stempeln
    }
  }

  private startPulse(): void {
    this.stopPulse();
    this.pulse = setInterval(() => {
      if (this.heartbeat()) return;
      // Verloren: nicht mehr freigeben (das wäre ein fremder Lock) und den Aufrufer
      // informieren, damit die Session endet statt weiterzuschreiben.
      this.stopPulse();
      this.held = false;
      this.opts.onLockLost?.();
    }, HEARTBEAT_MS);
    this.pulse.unref?.(); // ein Lock darf den Prozess nicht am Leben halten
  }

  private stopPulse(): void {
    if (!this.pulse) return;
    clearInterval(this.pulse);
    this.pulse = null;
  }

  private readOwner(): LockOwner | null {
    try {
      return JSON.parse(readFileSync(this.lockPath, 'utf8')) as LockOwner;
    } catch {
      return null;
    }
  }

  /** Remove the lockfile IFF it is provably stale; return whether it was reclaimed. */
  private reclaimIfStale(): boolean {
    const owner = this.readOwner();
    if (!owner) {
      // Unparseable: stale only if it has sat around longer than a mid-write window.
      const age = this.lockAgeMs();
      if (age !== null && age > STALE_CORRUPT_MS) {
        rmSync(this.lockPath, { force: true });
        return true;
      }
      return false;
    }
    // Pulslos = frei, egal was die PID sagt (CR-GC-372): nach einem Reboot kann die
    // Nummer im Lock einem fremden Prozess gehören, und ein hängender Host lebt für
    // `kill(pid, 0)`, bedient aber niemanden. Gilt auch cross-host — der Puls ist die
    // eine Aussage, die über Rechnergrenzen hinweg trägt.
    const age = this.lockAgeMs();
    if (age !== null && age > STALE_HEARTBEAT_MS) {
      rmSync(this.lockPath, { force: true });
      return true;
    }
    // Cross-host: cannot verify liveness → never reclaim (safest: refuse).
    if (owner.hostname !== this.me.hostname) return false;
    // Same host: reclaim only if the owning process is provably gone.
    if (!this.pidAlive(owner.pid)) {
      rmSync(this.lockPath, { force: true });
      return true;
    }
    return false;
  }

  private pidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true; // signal delivered → alive
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === 'EPERM'; // exists but not ours → alive
    }
  }

  private lockAgeMs(): number | null {
    try {
      if (!existsSync(this.lockPath)) return null;
      return Date.now() - statSync(this.lockPath).mtimeMs;
    } catch {
      return null;
    }
  }
}
