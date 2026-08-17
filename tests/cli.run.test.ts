/**
 * CR-GC-279 — `graphcode run` (run-verb.ts): Env-Config + End-to-End über den
 * Produktions-Pfad (executeRun = exakt der cli.ts-Pfad, kein Parallelweg).
 * Realer Disk-Store, gescriptetes Modell-Backend.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AUDIT_FILE, type AuditEntry } from '@sigloch/graph-api-core';
import { createHarness } from '../src/index.js';
import { executeRun, parseExecutorEnv } from '../src/run-verb.js';
import { ExecutorConfigSchema, buildCallModel, type ModelResponse } from '../src/executor.js';

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

  it('GRAPHCODE_LLM_INJECTION toggles the Mess-Schalter (CR-GC-293) — default stays on', () => {
    const base = { GRAPHCODE_LLM_BASE_URL: 'http://localhost:1234', GRAPHCODE_LLM_MODEL: 'devstral' };
    expect(parseExecutorEnv(base).injection).toBe(true);
    expect(parseExecutorEnv({ ...base, GRAPHCODE_LLM_INJECTION: 'false' }).injection).toBe(false);
    expect(parseExecutorEnv({ ...base, GRAPHCODE_LLM_INJECTION: 'true' }).injection).toBe(true);
  });

  it('GRAPHCODE_LLM_REASONING_EFFORT sets the Denk-Budget — unset stays undefined (Feld wird nicht gesendet)', () => {
    const base = { GRAPHCODE_LLM_BASE_URL: 'http://localhost:1234', GRAPHCODE_LLM_MODEL: 'qwen3.8-27b' };
    expect(parseExecutorEnv(base).reasoningEffort).toBeUndefined();
    expect(parseExecutorEnv({ ...base, GRAPHCODE_LLM_REASONING_EFFORT: 'low' }).reasoningEffort).toBe('low');
    expect(() => parseExecutorEnv({ ...base, GRAPHCODE_LLM_REASONING_EFFORT: 'schnell' })).toThrowError();
  });
});

describe('buildCallModel openai body — reasoning_effort (qwen3.8)', () => {
  /** Fängt genau EINEN Request ab und gibt seinen geparsten Body zurück. */
  async function captureBody(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const original = globalThis.fetch;
    let body: Record<string, unknown> = {};
    globalThis.fetch = (async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body) as Record<string, unknown>;
      return {
        json: async () => ({
          choices: [{ message: { content: 'ok', tool_calls: [] } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      };
    }) as unknown as typeof globalThis.fetch;
    try {
      const call = buildCallModel(
        ExecutorConfigSchema.parse({ baseUrl: 'http://localhost:1234', model: 'qwen3.8-27b', ...config }),
      );
      await call('sys', [{ role: 'user', content: 'hi' }], [], undefined);
    } finally {
      globalThis.fetch = original;
    }
    return body;
  }

  it('sends reasoning_effort only when configured (Denk-Budget-Schalter erreicht das Backend)', async () => {
    expect(await captureBody({ reasoningEffort: 'low' })).toMatchObject({ reasoning_effort: 'low' });
    // Unkonfiguriert darf das Feld NICHT im Body stehen — Backends ohne das Feld
    // (Anthropic-kompatible Proxies) würden den Request sonst ablehnen.
    expect(await captureBody({})).not.toHaveProperty('reasoning_effort');
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

  it('stamps model and the human prompt onto every record of the run (CR-GC-355)', async () => {
    // THE path without a client-side transcript: `~/.claude/projects` is a rolling ~30-day
    // window and exists for Claude Code alone, so for a local or third-party model the
    // trail is the only place "who, on which prompt" can ever be answered.
    const repoRoot = mkdtempSync(join(tmpdir(), 'graphcode-run-origin-'));
    try {
      await executeRun({
        repoRoot,
        intent: 'Eine Test-App für das run-Verb.',
        config: ExecutorConfigSchema.parse({
          baseUrl: 'http://scripted.invalid',
          model: 'devstral-small:24b',
          maxRounds: 1,
        }),
        callModel: () => Promise.resolve(SEED_RESPONSE),
      });

      const entries = readFileSync(join(repoRoot, AUDIT_FILE), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as AuditEntry)
        .filter((e) => e.operation === 'mutate' || e.operation === 'validate');
      expect(entries.length).toBeGreaterThan(0);

      for (const entry of entries) {
        expect(entry.model).toBe('devstral-small:24b');
        // VERBATIM human prose — not the generated round instruction. The instruction is
        // derivable from graph state + the templates in this repo; the human sentence is
        // not recoverable from anything once the process exits.
        expect(entry.intent).toBe('Eine Test-App für das run-Verb.');
      }
      // One run = one session: the id is what re-assembles a flat trail into runs.
      expect(new Set(entries.map((e) => e.sessionId)).size).toBe(1);
      expect(entries[0].sessionId).toBeTruthy();
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
