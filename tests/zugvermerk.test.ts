/**
 * CR-GC-614 — der Graph ist das Gedaechtnis, nicht der Gespraechsverlauf.
 *
 * Gemessen am Spec-Lauf opus5-15 (2026-09-22): hoechster Kontext 378k Tokens, davon ~220k
 * (≈58 %) DENKBLOECKE des Modells — mehr als alles, was graphcode in dem Lauf lieferte. In
 * Claude Code ist das nicht zu aendern; in unserer Schleife schon.
 *
 * Zwei Haelften, beide hier festgenagelt:
 *   (a) nichts aus einem abgeschlossenen Zug reist mit — auch kein Denkblock des anthropic-Zweigs,
 *       der bis CR-GC-614 seinen `content` unveraendert zurueckschickte;
 *   (b) was STATTDESSEN mitreist, ist benannt und begrenzt.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zugvermerk, ZUGVERMERK_MAX, type Zug } from '../src/loop/zugvermerk.js';
import { runExecutor, ExecutorConfigSchema } from '../src/loop/executor.js';
import type { CallModel, ModelResponse } from '../src/loop/executor-backend.js';
import { createHarness } from '../src/surface/create-harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';

const zug = (runde: number, over: Partial<Zug> = {}): Zug => ({
  runde, fokus: `req:RD-01:REQ-${runde}`, ergebnis: 'angewandt', regeln: '', ...over,
});

describe('CR-GC-614: der Zugvermerk ist benannt und begrenzt', () => {
  it('ohne Zuege ist er leer — kein leerer Kopf, der Platz kostet und nichts sagt', () => {
    expect(zugvermerk([])).toBe('');
  });

  it('nennt Fokus und Gate-Antwort je Zug — und bei einer Abweisung die Regel-IDs', () => {
    const v = zugvermerk([zug(1), zug(2, { ergebnis: 'abgewiesen', regeln: 'R-01,RD-01' })]);
    expect(v).toContain('R1 req:RD-01:REQ-1: angewandt');
    expect(v).toContain('R2 req:RD-01:REQ-2: abgewiesen (R-01,RD-01)');
    // Regel-IDs, nie Regeltext — derselbe Riegel wie im Audit.
    expect(v).not.toMatch(/must have|shall|Fix:/);
  });

  it('NEUESTE zuerst: was gerade abgewiesen wurde, wiegt mehr als der erste Zug der Sitzung', () => {
    const v = zugvermerk([zug(1), zug(2), zug(3)]);
    expect(v.indexOf('R3')).toBeLessThan(v.indexOf('R1'));
  });

  it('haelt die Obergrenze — und SAGT, dass er gekuerzt hat', () => {
    const viele = Array.from({ length: 200 }, (_, i) => zug(i + 1));
    const v = zugvermerk(viele);
    expect(v.length, `${v.length} Zeichen`).toBeLessThanOrEqual(ZUGVERMERK_MAX + 80);
    // Eine Grenze, die niemand sieht, ist ein Kontextleck mit Verzoegerung.
    expect(v).toMatch(/aeltere Zuege hier weggelassen|ältere Züge hier weggelassen/);
    // Der juengste Zug ist drin, der aelteste nicht.
    expect(v).toContain('R200 ');
    expect(v).not.toContain('R1 ');
  });

  it('eine enge Grenze liefert lieber nichts als eine halbe Zeile', () => {
    expect(zugvermerk([zug(1)], 10)).toBe('');
  });
});

/**
 * CR-GC-614, die GRENZE — gemessen, nicht angenommen.
 *
 * Der erste Anlauf dieses CR wollte die Denkbloecke auch INNERHALB eines Schrittes verwerfen: der
 * anthropic-Zweig schickt sein `content` unveraendert zurueck, und Denkbloecke sind der groesste
 * Posten im Kontext (Spec-Lauf opus5-15: ~220k von 378k Tokens). Das ist verboten, und zwar nicht
 * aus Vorsicht: CR-GC-572 hat den Fall GEMESSEN. Faellt der Block weg, antwortet die API auf Turn
 * .2 mit `messages.1.content.0.thinking.thinking: Field required` — Folge im ersten
 * `gcrun-frontier`-Lauf: keine einzige Reparatur nach einer Gate-Ablehnung, 11 von 12 Schritten
 * ohne zweiten Turn. Die Zusage steht in `tests/executor.anthropic-roundtrip.test.ts` und bleibt.
 *
 * Was daraus folgt, ist die Aufteilung, die dieser CR wirklich liefert:
 *   INNERHALB eines Schrittes reist der Denkblock mit — die API verlangt es.
 *   ZWISCHEN zwei Zuegen reist NICHTS mit: `executor.ts` baut `messages` je Runde neu.
 * Der Zugvermerk oben ist das, was diese Luecke ersetzt.
 */

/**
 * Die zweite Hälfte der Zusage, am ECHTEN Loop: zwischen zwei Zügen reist nichts mit.
 *
 * `executor.ts` baut `messages` je Runde neu. Das ist eine Zeile Code und deshalb genau die Sorte
 * Eigenschaft, die beim nächsten Umbau still verschwindet — hier wird sie am laufenden Executor
 * gemessen, nicht am Quelltext gelesen.
 */
describe('CR-GC-614: zwischen zwei Zuegen reist nichts mit', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: ReturnType<typeof bindToolsToHarness>;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-614-'));
    harness = await createHarness({
      repoRoot, scope: { workspaceId: 'gc614', systemId: 'gc614' }, consumerType: 'system', preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it('jede Runde startet mit EINER Nachricht — der Verlauf der Vorrunde ist weg, der Vermerk da', async () => {
    const calls: { messages: unknown[] }[] = [];
    const antwort: ModelResponse = {
      text: 'nichts zu tun', toolCalls: [], stopReason: 'end_turn',
      assistantMsg: { role: 'assistant', content: 'X'.repeat(4000) },
      usage: { in: 10, out: 10, reasoning: 0 },
    };
    const callModel: CallModel = (_system, messages) => {
      calls.push({ messages: JSON.parse(JSON.stringify(messages)) as unknown[] });
      return Promise.resolve(antwort);
    };

    await runExecutor({
      registry,
      workspaceDir: repoRoot,
      config: ExecutorConfigSchema.parse({
        baseUrl: 'http://scripted.invalid', model: 'scripted', maxRounds: 3, maxStepTurns: 2,
      }),
      callModel,
      trace: () => {},
    });

    // Mehr als eine Runde ist gelaufen — sonst prueft der Test nichts.
    const rundenstarts = calls.filter((c) => c.messages.length === 1);
    expect(rundenstarts.length, 'zu wenige Runden fuer die Aussage').toBeGreaterThan(1);

    // Und keine spaetere Runde traegt den Text der frueheren mit.
    const zweite = rundenstarts[1].messages[0] as { content: string };
    expect(zweite.content).not.toContain('X'.repeat(100));
    // Was STATTDESSEN mitreist, ist der benannte Vermerk.
    expect(zweite.content).toContain('BISHER IN DIESER SITZUNG');
    expect(zweite.content.length, 'der Rundenprompt bleibt in der Groessenordnung eines Prompts').toBeLessThan(20_000);
  }, 120_000);
});
