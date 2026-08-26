/**
 * CR-GC-426 — zwei Flüsse bekommen einen prüfbaren Vertrag.
 *
 * Keine Mocks: die Backend-Hälfte fährt einen echten HTTP-Server auf Loopback und
 * lässt `buildCallModel` real dagegen `fetch`en; die Marker-Hälfte schreibt und liest
 * echte Dateien auf Platte und lässt den echten `scripts/githooks/pre-commit`-Ausdruck
 * darüber laufen. Geprüft wird jeweils die GRENZE, nicht die Innenseite.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExecutorConfigSchema, buildCallModel } from '../src/executor/executor.js';
import { ModelAnswer } from '../src/executor/model-answer-contract.js';
import { extractMutateFromText } from '../src/executor/executor-parse.js';
import {
  setExportPending,
  clearExportPending,
  isExportPending,
  readExportPending,
  EXPORT_PENDING_REL,
} from '../src/harness/export-marker.js';
import { ExportPending } from '../src/harness/export-pending-contract.js';

// ---------------------------------------------------------------------------
// FLOW-model-answer — der Eingang von FUNC-extract-mutate (CR-GC-422 §3)
// ---------------------------------------------------------------------------

describe('SCHEMA-model-answer: die Roh-Antwort des Modells hat einen Vertrag', () => {
  let server: Server;
  let baseUrl: string;
  /** Was der nächste Request zurückbekommt — je Fall gesetzt. */
  let body: unknown = {};

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const call = (backend: 'openai' | 'anthropic'): Promise<unknown> => {
    const config = ExecutorConfigSchema.parse({ backend, baseUrl, model: 'test-model' });
    return buildCallModel(config)('sys', [], []);
  };

  it('openai: Text, Tool-Calls und Stop-Grund kommen normalisiert an', async () => {
    body = {
      choices: [
        {
          finish_reason: 'tool_calls',
          message: {
            content: 'ich lege los',
            tool_calls: [
              { id: 'c1', function: { name: 'graphcode_graph_mutate', arguments: '{"commands":[]}' } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 11, completion_tokens: 22, completion_tokens_details: { reasoning_tokens: 3 } },
    };
    const answer = ModelAnswer.parse(await call('openai'));
    expect(answer.text).toBe('ich lege los');
    expect(answer.toolCalls).toEqual([
      { id: 'c1', name: 'graphcode_graph_mutate', input: { commands: [] } },
    ]);
    expect(answer.stopReason).toBe('tool_calls');
    expect(answer.usage).toEqual({ in: 11, out: 22, reasoning: 3 });
  });

  it('anthropic: dieselbe normalisierte Form, Stop-Grund inklusive', async () => {
    body = {
      stop_reason: 'max_tokens',
      content: [
        { type: 'text', text: 'abgeschnitten…' },
        { type: 'tool_use', id: 'c9', name: 'graphcode_graph_mutate', input: { commands: [] } },
      ],
      usage: { input_tokens: 5, output_tokens: 7 },
    };
    const answer = ModelAnswer.parse(await call('anthropic'));
    expect(answer.text).toBe('abgeschnitten…');
    expect(answer.toolCalls[0]?.id).toBe('c9');
    expect(answer.stopReason).toBe('max_tokens');
  });

  it('kein Stop-Grund im Körper heisst null, nicht geraten', async () => {
    body = { choices: [{ message: { content: 'nur Text' } }] };
    const answer = ModelAnswer.parse(await call('openai'));
    expect(answer.stopReason).toBeNull();
  });

  /**
   * Der Kern des CR: ein abweichendes Backend fällt HIER auf, nicht erst im Parser.
   * Vor dem Vertrag las der Cast `j.choices?.[0]?.message ?? {}` — eine Antwort ohne
   * `choices` wurde zu `{text:'', toolCalls:[]}` und lief als „Modell hat nichts
   * gesagt" weiter. Diagnostiziert wurde dann die Prosa-Recovery, nicht der Anbieter.
   */
  it('openai: eine Antwort ohne choices ist ein Vertragsbruch, kein leerer Turn', async () => {
    body = { output: [{ role: 'assistant', content: 'anderes Wire-Format' }] };
    await expect(call('openai')).rejects.toThrow(/breaks SCHEMA-model-answer \(openai wire\)/);
  });

  it('openai: ein Tool-Call ohne function.name ist ein Vertragsbruch', async () => {
    body = { choices: [{ message: { tool_calls: [{ id: 'c1', function: { arguments: '{}' } }] } }] };
    await expect(call('openai')).rejects.toThrow(/breaks SCHEMA-model-answer/);
  });

  it('anthropic: fehlender content-Block ist ein Vertragsbruch', async () => {
    body = { stop_reason: 'end_turn', usage: { input_tokens: 1 } };
    await expect(call('anthropic')).rejects.toThrow(/breaks SCHEMA-model-answer \(anthropic wire\)/);
  });

  it('ein Fehlerkörper bleibt ein Backend-Fehler, kein Vertragsbruch', async () => {
    body = { error: { type: 'invalid_request_error', message: 'model not found' } };
    await expect(call('openai')).rejects.toThrow(/^backend: /);
  });

  /**
   * Die modellierte Kante `FLOW-model-answer -io-> FUNC-extract-mutate`: was der
   * Vertrag trägt, ist genau das, was die Prosa-Recovery liest — Text plus den
   * Stop-Grund, der sie überhaupt erst rechtfertigt (`length` = am Budget
   * abgeschnitten, deshalb kein Tool-Call).
   */
  it('der Vertrag trägt, was FUNC-extract-mutate braucht: Text plus Stop-Grund', async () => {
    body = {
      choices: [
        {
          finish_reason: 'length',
          message: { content: 'Hier der Batch: {"commands":[{"op":"add-node"}]} …' },
        },
      ],
    };
    const answer = ModelAnswer.parse(await call('openai'));
    expect(answer.toolCalls).toEqual([]);
    expect(answer.stopReason).toBe('length');
    expect(extractMutateFromText(answer.text)).toEqual({ commands: [{ op: 'add-node' }] });
  });
});

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
