/**
 * CR-GC-279 — `graphcode run` (run-verb.ts): Env-Config + End-to-End über den
 * Produktions-Pfad (executeRun = exakt der cli.ts-Pfad, kein Parallelweg).
 * Realer Disk-Store, gescriptetes Modell-Backend.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from '../src/index.js';
import { executeRun, parseExecutorEnv } from '../src/run-verb.js';
import { ExecutorConfigSchema, type ModelResponse } from '../src/executor.js';

const SEED_RESPONSE: ModelResponse = {
  text: '',
  toolCalls: [
    {
      id: 'c1',
      name: 'graphcode_graph_mutate',
      input: {
        commands: [
          {
            op: 'add-node',
            node: {
              uid: 'SYS-app',
              type: 'SYS',
              name: 'Run App',
              description: 'System aus dem run-Verb-Test.',
              attributes: {},
            },
          },
          {
            op: 'add-node',
            node: {
              uid: 'ACTOR-user',
              type: 'ACTOR',
              name: 'User',
              description: 'Nutzt die App.',
              attributes: {},
            },
          },
          {
            op: 'add-node',
            node: {
              uid: 'UC-login',
              type: 'UC',
              name: 'Login',
              description: 'User meldet sich an und erhält Zugriff.',
              attributes: {},
            },
          },
          { op: 'add-edge', edge: { sourceId: 'ACTOR-user', targetId: 'UC-login', edgeType: 'io', attributes: {} } },
          { op: 'add-edge', edge: { sourceId: 'SYS-app', targetId: 'UC-login', edgeType: 'compose', attributes: {} } },
        ],
      },
    },
  ],
  assistantMsg: { role: 'assistant', content: null },
  usage: { in: 10, out: 10, reasoning: 0 },
};

describe('parseExecutorEnv (CR-GC-279)', () => {
  it('fails loud when required env vars are missing', () => {
    expect(() => parseExecutorEnv({})).toThrowError(/GRAPHCODE_LLM_BASE_URL, GRAPHCODE_LLM_MODEL/);
    expect(() => parseExecutorEnv({ GRAPHCODE_LLM_BASE_URL: 'http://x' })).toThrowError(
      /GRAPHCODE_LLM_MODEL/,
    );
  });

  it('parses the full config with defaults', () => {
    const config = parseExecutorEnv({
      GRAPHCODE_LLM_BASE_URL: 'http://192.168.78.89:1234',
      GRAPHCODE_LLM_MODEL: 'devstral-small',
      GRAPHCODE_LLM_MAX_ROUNDS: '5',
    });
    expect(config.backend).toBe('openai');
    expect(config.maxRounds).toBe(5);
    expect(config.maxStepTurns).toBe(6);
    expect(config.apiKey).toBeUndefined();
    // openai/local: 2048 (Decode-Rate-Budget) bleibt der Schema-Default.
    expect(config.maxTokens).toBe(2048);
  });

  it('anthropic backend defaults maxTokens to 8192 (Frontier-Batches: 2048 kappt das Tool-Call-JSON → input {})', () => {
    const base = {
      GRAPHCODE_LLM_BASE_URL: 'https://api.anthropic.com',
      GRAPHCODE_LLM_MODEL: 'claude-opus-5',
      GRAPHCODE_LLM_BACKEND: 'anthropic',
    };
    expect(parseExecutorEnv(base).maxTokens).toBe(8192);
    // explizite Env gewinnt weiterhin
    expect(parseExecutorEnv({ ...base, GRAPHCODE_LLM_MAX_TOKENS: '4096' }).maxTokens).toBe(4096);
  });
});

describe('executeRun (CR-GC-279)', () => {
  const config = ExecutorConfigSchema.parse({
    baseUrl: 'http://scripted.invalid',
    model: 'scripted',
    maxRounds: 1,
  });

  it('runs the executor, exports, reports readiness, and releases the store lock', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-run-'));
    try {
      const summary = await executeRun({
        repoRoot,
        intent: 'Eine Test-App für das run-Verb.',
        config,
        callModel: () => Promise.resolve(SEED_RESPONSE),
      });
      expect(summary.stats.mutatesApplied).toBe(1);
      expect(summary.exportPath).toBeTruthy();
      expect(existsSync(join(repoRoot, summary.exportPath as string))).toBe(true);
      expect(summary.readiness).toBeTruthy();

      // Lock freigegeben: ein zweiter Harness gewinnt die Election sofort.
      const again = await createHarness({
        repoRoot,
        scope: { workspaceId: 'again', systemId: 'again' },
      });
      await again.initialize();
      expect(again.getGraph().nodes.map((n) => n.uid)).toContain('SYS-app');
      await again.close();
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('a run with zero durable elements reports exportError instead of crashing', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-run-idle-'));
    const idle: ModelResponse = {
      text: 'nur Prosa, kein Batch',
      toolCalls: [],
      assistantMsg: { role: 'assistant', content: 'unused' },
      usage: { in: 1, out: 1, reasoning: 0 },
    };
    try {
      const summary = await executeRun({
        repoRoot,
        intent: 'Eine App, die nie autoriert wird.',
        config,
        callModel: () => Promise.resolve(idle),
      });
      // Der leere Lauf ist ein legitimes negatives Ergebnis: Stats bleiben erhalten,
      // der verweigerte Export wird berichtet statt geworfen.
      expect(summary.stats.mutatesApplied).toBe(0);
      expect(summary.exportPath).toBeUndefined();
      expect(summary.exportError).toMatch(/0 elements|empty/i);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects an empty graph without intent (headless — nobody can ask back)', async () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-run-empty-'));
    try {
      await expect(
        executeRun({ repoRoot, config, callModel: () => Promise.resolve(SEED_RESPONSE) }),
      ).rejects.toThrowError(/leerer Graph und kein Intent/);
      // Auch im Fehlerfall: Lock freigegeben.
      const again = await createHarness({
        repoRoot,
        scope: { workspaceId: 'again', systemId: 'again' },
      });
      await again.initialize();
      await again.close();
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
