/**
 * CR-GC-426 — ein Fluss bekommt einen prüfbaren Vertrag: die Drift-Marke des Exports.
 * (Der zweite Fluss des CR, die Roh-Antwort des Modells, ging mit dem eingebetteten
 * Executor — CR-GC-775.)
 *
 * Keine Mocks: der Test schreibt und liest echte Dateien auf Platte und lässt den echten
 * `scripts/githooks/pre-commit`-Ausdruck darüber laufen. Geprüft wird die GRENZE, nicht
 * die Innenseite.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  setExportPending,
  clearExportPending,
  isExportPending,
  readExportPending,
  EXPORT_PENDING_REL,
} from '../src/kernel/export-marker.js';
import { ExportPending } from '../src/kernel/export-pending-contract.js';

// ---------------------------------------------------------------------------
// FLOW-export-pending — der Ausgang von FUNC-export-marker (CR-GC-422 §2, Variante b)
// ---------------------------------------------------------------------------

describe('SCHEMA-export-pending: die Drift-Marke sagt, WIE WEIT der Snapshot zurückhängt', () => {
  let repo: string;
  const marker = (): string => join(repo, EXPORT_PENDING_REL);

  const setup = (): void => {
    repo = mkdtempSync(join(tmpdir(), 'gc-426-'));
    mkdirSync(join(repo, '.graphcode'), { recursive: true });
  };

  it('die erste Mutation setzt since und einen Rückstand von 1', () => {
    setup();
    try {
      const before = Date.now();
      setExportPending(repo);
      const pending = readExportPending(repo);
      expect(pending).not.toBeNull();
      expect(ExportPending.safeParse(pending).success).toBe(true);
      expect(pending?.versionsBehind).toBe(1);
      expect(Date.parse(pending!.since)).toBeGreaterThanOrEqual(before - 1000);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('jede weitere Mutation zählt hoch, since bleibt der ERSTE Zeitpunkt', () => {
    setup();
    try {
      setExportPending(repo);
      const first = readExportPending(repo)!;
      setExportPending(repo);
      setExportPending(repo);
      const third = readExportPending(repo)!;
      expect(third.versionsBehind).toBe(3);
      expect(third.since).toBe(first.since);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('der Export räumt die Marke ab; danach gibt es keinen Rückstand mehr', () => {
    setup();
    try {
      setExportPending(repo);
      clearExportPending(repo);
      expect(isExportPending(repo)).toBe(false);
      expect(readExportPending(repo)).toBeNull();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  /**
   * Rückwärtskompatibilität — die Bedingung des CR: der Hook testete bisher nur
   * Existenz und muss weiter funktionieren, auch wenn eine alte Marke ohne Inhalt
   * daliegt. Sie blockt weiter; nur „wie weit" ist an ihr nicht abzulesen, und
   * geraten wird dann nicht.
   */
  it('eine Alt-Marke ohne Inhalt blockt weiter, wird aber nicht geraten', () => {
    setup();
    try {
      writeFileSync(marker(), 'live graph mutated since last graph_export — run graph_export before commit\n');
      expect(isExportPending(repo)).toBe(true);
      expect(readExportPending(repo)).toBeNull();
      // Ab der nächsten Mutation zählt sie wieder — ab jetzt, nicht rückwirkend.
      setExportPending(repo);
      expect(readExportPending(repo)?.versionsBehind).toBe(1);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  /**
   * Die Prozessgrenze, um die es geht: geschrieben von TypeScript im Owner-Prozess,
   * gelesen von bash in einem beliebigen anderen. Hier läuft der ECHTE Ausdruck aus
   * `scripts/githooks/pre-commit` gegen die echte, geschriebene Marke — sonst wäre
   * „der Hook kann es lesen" eine Behauptung.
   */
  it('der pre-commit-Hook liest beide Felder aus der real geschriebenen Marke', () => {
    setup();
    try {
      setExportPending(repo);
      setExportPending(repo);
      const hook = readFileSync(join(__dirname, '..', 'scripts', 'githooks', 'pre-commit'), 'utf8');
      const extract = hook
        .split('\n')
        .filter((l) => /^\s*(marker|since|behind)=/.test(l))
        .join('\n');
      expect(extract).toContain('versionsBehind');
      const out = execFileSync(
        'bash',
        ['-c', `set -eu\ncd "${repo}"\n${extract}\nprintf '%s|%s' "$since" "$behind"`],
        { encoding: 'utf8' },
      );
      const [since, behind] = out.split('|');
      expect(behind).toBe('2');
      expect(since).toBe(readExportPending(repo)!.since);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('eine Alt-Marke lässt den Hook-Ausdruck leer laufen statt zu lügen', () => {
    setup();
    try {
      writeFileSync(marker(), 'irgendein Prosasatz\n');
      const hook = readFileSync(join(__dirname, '..', 'scripts', 'githooks', 'pre-commit'), 'utf8');
      const extract = hook
        .split('\n')
        .filter((l) => /^\s*(marker|since|behind)=/.test(l))
        .join('\n');
      const out = execFileSync(
        'bash',
        ['-c', `set -eu\ncd "${repo}"\n${extract}\nprintf '%s|%s' "$since" "$behind"`],
        { encoding: 'utf8' },
      );
      expect(out).toBe('|');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

/**
 * CR-GC-535 — ein Snapshot im Diff faehrt die Modell-Spur, statt sie nur anzusagen.
 * Der ECHTE Hook laeuft in einem echten Wegwerf-Repo; `VERIFY_MODEL_CMD` ersetzt nur
 * den 45-s-Lauf durch `true`/`false`, die Spurwahl und das Blocken sind echt.
 */
describe('CR-GC-535: pre-commit faehrt verify:model, sobald ein Snapshot gestaged ist', () => {
  const HOOK = join(__dirname, '..', 'scripts', 'githooks', 'pre-commit');
  function repoWith(staged: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'gc-hook-'));
    execFileSync('git', ['init', '-q', dir]);
    for (const [rel, body] of Object.entries(staged)) {
      mkdirSync(join(dir, dirname(rel)), { recursive: true });
      writeFileSync(join(dir, rel), body);
    }
    execFileSync('git', ['-C', dir, 'add', '-A']);
    return dir;
  }
  function runHook(dir: string, verifyCmd: string): { status: number; stderr: string } {
    const r = spawnSync('bash', [HOOK], { cwd: dir, encoding: 'utf8', env: { ...process.env, VERIFY_MODEL_CMD: verifyCmd } });
    return { status: r.status ?? -1, stderr: r.stderr };
  }
  const SNAP = { 'docs/graph/x.graph.json': '{"elements":[],"traces":[]}' };

  it('Snapshot gestaged + verify:model rot -> BLOCKED, exit 1', () => {
    const dir = repoWith(SNAP);
    try {
      const r = runHook(dir, 'false');
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('BLOCKED (CR-GC-535)');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('Snapshot gestaged + verify:model gruen -> Commit geht durch', () => {
    const dir = repoWith(SNAP);
    try {
      const r = runHook(dir, 'true');
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('Snapshot im Diff');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('nur docs/cr im Diff -> Ansage, verify:model laeuft NICHT (auch wenn es rot waere)', () => {
    const dir = repoWith({ 'docs/cr/open/CR-x.md': '# x' });
    try {
      const r = runHook(dir, 'false');
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('Snapshot im Diff');
      expect(r.stderr).toContain('Spur: MODELL');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
