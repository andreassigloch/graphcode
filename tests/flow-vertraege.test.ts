/**
 * TEST-flow-vertraege — die Verträge der Flüsse am Viewer und am Sitzungsende (CR-GC-989):
 * Repo-Pfad, Sitzungsende, Aufruf ohne Daten. Jeder Parse an der Grenze ist hier rot gesehen worden,
 * bevor er im Code stand.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { spawn } from 'node:child_process';
import { ZodError } from 'zod/v4';
import { ensureViewer, attachGve } from '../src/surface/gve.js';
import { serveStdio } from '../src/surface/mcp-server.js';
import { SessionLifecycle } from '../src/surface/session-lifecycle.js';
import { SITZUNGSENDE_SIGNALE, SitzungsendeSchema } from '../src/surface/session-end-contract.js';

describe('Repo-Pfad (SCHEMA-repo-pfad)', () => {
  it('ensureViewer lehnt einen leeren Pfad ab und startet keinen Viewer', async () => {
    const calls: unknown[] = [];
    const spawnImpl = ((...a: unknown[]) => void calls.push(a)) as unknown as typeof spawn;
    await expect(ensureViewer('', { env: {}, spawnImpl, resolveGve: () => '/x/gve.mjs' })).rejects.toBeInstanceOf(ZodError);
    expect(calls).toHaveLength(0);
  });
  it('serveStdio lehnt einen leeren Pfad ab, bevor es Store oder Dashboard anfasst', async () => {
    // Der Pfad des Fehlers ist leer: der Wert selbst ist falsch, nicht ein Feld im ToolContext (dort scheitert ein leerer Pfad später).
    const fehler = await serveStdio({ repoRoot: '' }).then(() => null, (e: unknown) => e);
    expect(fehler).toBeInstanceOf(ZodError);
    expect((fehler as ZodError).issues[0]?.path).toEqual([]);
  });
});

describe('Sitzungsende (SCHEMA-sitzungsende)', () => {
  const handlers = (): { lc: SessionLifecycle; signale: string[]; stdin: number } => {
    const signale: string[] = [];
    let stdin = 0;
    const lc = new SessionLifecycle({
      onSignal: (sig) => void signale.push(sig),
      onStdinEnd: () => void stdin++,
      exit: () => undefined,
      write: () => undefined,
      setTimeoutImpl: (() => ({ unref: () => undefined })) as unknown as typeof setTimeout,
    });
    lc.installTriggers();
    return { lc, signale, stdin };
  };

  it('installTriggers bindet genau die Signale der Aufzählung, keine zweite Liste', () => {
    const h = handlers();
    expect(h.signale).toEqual([...SITZUNGSENDE_SIGNALE]);
    expect(h.signale).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP']);
    expect(h.stdin).toBe(1);
  });
  it('jedes Ereignis der Aufzählung beendet die Sitzung', () => {
    for (const e of SitzungsendeSchema.options) {
      const h = handlers();
      h.lc.end(e);
      expect(h.lc.isClosing).toBe(true);
    }
  });
  it('end lehnt ein Ereignis außerhalb der Aufzählung ab', () => {
    const h = handlers();
    expect(() => h.lc.end('SIGUSR1' as never)).toThrow(ZodError);
    expect(h.lc.isClosing).toBe(false);
  });
});

describe('Aufruf ohne Daten (SCHEMA-aufruf-ohne-daten)', () => {
  it('stop() ohne Argument meldet ab; mit Argument wirft es und meldet nicht ab', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'flow-vertraege-'));
    try {
      const handle = await attachGve(repo, { env: { GRAPHCODE_NO_GVE: '' , VITEST: '' , CI: '' }, resolveGve: () => { throw new Error('kein Viewer'); }, setIntervalImpl: (() => ({ unref: () => undefined })) as unknown as typeof setInterval });
      expect(handle).not.toBeNull();
      expect(() => (handle as unknown as { stop: (d: unknown) => void }).stop('daten')).toThrow(ZodError);
      expect(() => handle!.stop()).not.toThrow();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
