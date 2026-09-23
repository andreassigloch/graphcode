/**
 * CR-GC-626 — ein Testlauf schreibt nie in das Repo, aus dem er gestartet wurde.
 *
 * BEFUND (2026-09-23): ein Commit mit Snapshot im Diff brach ab mit
 * `invalid object … for 'docs/graph/fremd-anlage.graph.json'` / `Error building trees`.
 * git setzt jedem Hook `GIT_DIR` und `GIT_INDEX_FILE`; der `pre-commit` faehrt bei einem
 * Snapshot die Modell-Spur (CR-GC-535), in ihr liegt `rewind.test.ts`, und dessen `git add -A`
 * im Temp-Repo schrieb deshalb in den Index des UMGEBENDEN Repos, waehrend der Blob im
 * Objektspeicher des Temp-Repos blieb.
 *
 * Nachgewiesen vor dem Fix:
 *   cp .git/index /tmp/probe
 *   GIT_INDEX_FILE=/tmp/probe GIT_DIR=$PWD/.git npx vitest run tests/rewind.test.ts
 *   GIT_INDEX_FILE=/tmp/probe git ls-files --stage | grep fremd
 *   → 100644 aaa6ae95… 0  docs/graph/fremd-anlage.graph.json
 *
 * RED-FIRST, und zwar unter der Hook-Lage: startet man den Lauf mit gesetztem
 * `GIT_DIR`/`GIT_INDEX_FILE` und nimmt `setupFiles` aus `vitest.config.ts` heraus, sind die
 * ersten beiden Faelle rot (geprueft am 2026-09-23). Ohne die geerbten Variablen ist Fall 2
 * gruen, egal was das Setup tut — deshalb steht die Bedingung hier und nicht nur im CR.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GEERBTE_GIT_VARIABLEN, bereinigeGitUmgebung } from './setup/git-env.js';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });

describe('CR-GC-626: der Testprozess erbt die git-Umgebung des Hooks nicht', () => {
  it('keine geerbte git-Variable steht mehr in DIESEM Prozess', () => {
    expect(
      GEERBTE_GIT_VARIABLEN.filter((k) => process.env[k] !== undefined),
      'unter dem pre-commit-Hook stehen hier GIT_DIR und GIT_INDEX_FILE — das Setup nimmt sie weg',
    ).toEqual([]);
  });

  it('git in einem Temp-Repo meint das Temp-Repo — Index und HEAD gehoeren ihm', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'gc-626-'));
    try {
      mkdirSync(join(tmp, 'unter'), { recursive: true });
      git(tmp, 'init', '-q');
      writeFileSync(join(tmp, 'unter', 'neu.txt'), 'gehoert dem Lauf\n');
      git(tmp, 'add', '-A');
      git(tmp, 'commit', '-q', '-m', 'lauf');

      // Beides zeigt ins Temp-Repo. Mit geerbtem GIT_DIR waere es das umgebende gewesen —
      // und `add -A` haette dessen Index mit einem Blob beschrieben, den es dort nicht gibt.
      expect(realpathSync(git(tmp, 'rev-parse', '--show-toplevel').trim())).toBe(realpathSync(tmp));
      expect(git(tmp, 'show', '--name-only', '--format=', 'HEAD').trim()).toBe('unter/neu.txt');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('bereinigt wird gezielt, nicht pauschal', () => {
    const env = { PATH: '/bin', GIT_DIR: '/x', GIT_INDEX_FILE: '/y' } as NodeJS.ProcessEnv;
    expect(bereinigeGitUmgebung(env).sort()).toEqual(['GIT_DIR', 'GIT_INDEX_FILE']);
    expect(env.PATH, 'was nicht git ist, bleibt').toBe('/bin');
    expect(bereinigeGitUmgebung(env), 'ein zweiter Lauf findet nichts mehr').toEqual([]);
  });
});
