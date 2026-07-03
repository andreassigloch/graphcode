/**
 * audit-file.ts — durable append-only command log (CR-GC-232).
 *
 * `FileAuditLog implements AuditLog` (interface from `@sigloch/graph-api-core`, no
 * fork): one JSONL file per store at `.graphcode/audit.jsonl` (gitignored,
 * per-worktree — like the store itself). Event-sourcing foundation of the
 * MS-7-concurrency ladder: the durable operations log is what OCC deltas (CR-233)
 * and replay-merge (CR-234) derive from — state is derived, never diffed.
 *
 * Log handling is built in from day one (not bolted on later):
 *   - Entries carry the `MutateCommand[]` batch (`GraphcodeAuditEntry.commands`,
 *     a local additive extension) — without commands, replay is impossible.
 *   - A CHECKPOINT record anchors the version across compaction:
 *     `latestVersion() = checkpoint.version + applied entries after it`, so the
 *     monotonic graphVersion (CR-233) survives every compaction.
 *   - `compact()` archives the active log (`.graphcode/audit-<ts>.jsonl`) and starts
 *     a fresh one with the checkpoint line; auto-compaction fires at a size
 *     threshold on bind. Archives are local and freely deletable.
 *   - Torn-tail tolerant: a crash mid-append leaves a truncated last line — it is
 *     skipped with a warning, never a read failure.
 *
 * Single-process safety: the store-ownership lock (CR-218 O2) guarantees one writer
 * per store, so `appendFileSync` needs no cross-process coordination.
 *
 * @author andreas@siglochconsulting
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AuditEntry, AuditLog } from '@sigloch/graph-api-core';
import type { MutateCommand } from '@sigloch/contracts/harness';

/** AuditEntry + the gated command batch — required for replay (CR-GC-234). */
export interface GraphcodeAuditEntry extends AuditEntry {
  commands?: MutateCommand[];
}

/** First line of a compacted log — the version anchor that survives compaction. */
interface CheckpointLine {
  checkpoint: true;
  version: number;
  timestamp: string;
  reason: string;
}

type LogLine = GraphcodeAuditEntry | CheckpointLine;

const isCheckpoint = (l: LogLine): l is CheckpointLine => (l as CheckpointLine).checkpoint === true;

/** Auto-compaction size threshold (bytes). */
export const DEFAULT_COMPACT_BYTES = 10 * 1024 * 1024;

/** Log filename inside the store dir — the log lives BESIDE the store it describes. */
export const AUDIT_BASENAME = 'audit.jsonl';

/** Standard-layout location relative to the repo root (store dir = `.graphcode`). */
export const AUDIT_FILE = join('.graphcode', AUDIT_BASENAME);

export class FileAuditLog implements AuditLog {
  private readonly path: string;
  private readonly maxBytes: number;

  /**
   * `storeDir` = the directory of the Kuzu store this log describes (same anchoring
   * rule as the O2 lock: per store, never per repo — a temp-store harness must not
   * write into the repo's live `.graphcode`).
   */
  constructor(storeDir: string, opts?: { maxBytes?: number }) {
    this.path = join(storeDir, AUDIT_BASENAME);
    this.maxBytes = opts?.maxBytes ?? DEFAULT_COMPACT_BYTES;
    // Session start is the safe compaction moment: no reader is mid-delta.
    this.maybeCompact();
  }

  async record(entry: AuditEntry): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, JSON.stringify(entry) + '\n', 'utf8');
  }

  /** Mirrors InMemoryAuditLog semantics: `since` inclusive, `limit` = last N. */
  async query(filter: { consumerId?: string; since?: string; limit?: number }): Promise<AuditEntry[]> {
    let result: GraphcodeAuditEntry[] = this.readEntries();
    if (filter.consumerId) result = result.filter((e) => e.consumerId === filter.consumerId);
    if (filter.since) result = result.filter((e) => e.timestamp >= filter.since!);
    if (filter.limit) result = result.slice(-filter.limit);
    return result;
  }

  /** The compaction anchor: checkpoint version, or 0 on a never-compacted log. */
  baseVersion(): number {
    const lines = this.readLines();
    const cp = lines.find(isCheckpoint);
    return cp?.version ?? 0;
  }

  /**
   * Highest known graph version — checkpoint anchor or the max recorded entry
   * version, whichever is higher. Seeds the tool-layer counter so versions run
   * on across sessions AND across compactions (CR-233's continuity requirement).
   */
  latestVersion(): number {
    const lines = this.readLines();
    let version = 0;
    for (const l of lines) {
      if (isCheckpoint(l)) version = Math.max(version, l.version);
      else if (typeof l.graphVersion === 'number') version = Math.max(version, l.graphVersion);
    }
    return version;
  }

  /**
   * Archive the active log and start a fresh one anchored by a checkpoint line.
   * Version-safe by construction: `latestVersion()` is identical before and after.
   * No-op on a missing/empty log.
   */
  compact(reason = 'manual'): { archivedTo: string | null; checkpointVersion: number } {
    if (!existsSync(this.path)) return { archivedTo: null, checkpointVersion: 0 };
    const version = this.latestVersion();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archive = this.path.replace(/\.jsonl$/, `-${stamp}.jsonl`);
    renameSync(this.path, archive);
    const cp: CheckpointLine = { checkpoint: true, version, timestamp: new Date().toISOString(), reason };
    writeFileSync(this.path, JSON.stringify(cp) + '\n', 'utf8');
    return { archivedTo: archive, checkpointVersion: version };
  }

  private maybeCompact(): void {
    try {
      if (existsSync(this.path) && statSync(this.path).size > this.maxBytes) this.compact('auto-size');
    } catch {
      // A stat/rename race only defers compaction to the next bind — never fatal.
    }
  }

  /** Read all parseable lines; skip a torn tail (crash mid-append) with a warning. */
  private readLines(): LogLine[] {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, 'utf8');
    const lines: LogLine[] = [];
    let skipped = 0;
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        lines.push(JSON.parse(line) as LogLine);
      } catch {
        skipped += 1;
      }
    }
    if (skipped > 0) {
      process.stderr.write(`[graphcode] WARN: ${this.path}: skipped ${skipped} unparseable line(s) (torn tail after a crash?).\n`);
    }
    return lines;
  }

  private readEntries(): GraphcodeAuditEntry[] {
    return this.readLines().filter((l): l is GraphcodeAuditEntry => !isCheckpoint(l));
  }
}
