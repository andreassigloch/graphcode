/**
 * CR-GC-574 — die Auswertungen des Systemtests werden selbst geprueft.
 *
 * Das Rig ist der Systemtest des Produkts: es fuettert den Audit-Log, und seine
 * Auswertungen sind die Voraussetzung jeder Optimierungsschleife. Bis hierher pruefte
 * sie niemand — genau die Klasse Fehler, die zweimal erst am lebenden Lauf auffiel:
 * `legality()` meldete 0 Ablehnungen, wo 2 standen (CR-GC-553), und `leseTurns()`
 * zaehlte 746.749 statt 368.297 Cache-Schreibung, weil eine Assistant-Nachricht je
 * Content-Block im Strom steht (CR-GC-567).
 *
 * Keine Mocks: jede Pruefung schreibt echte Artefakte auf Platte und laesst die echten
 * Auswertungsfunktionen darueber laufen — dieselben, die `run.mjs` und `report.mjs` rufen.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — Rig-Auswertung in .mjs, bewusst ohne Typdeklaration (Messwerkzeug, kein Produkt-API)
import { leseTurns, pruefeGegenResultzeile, cacheVerursacher, dryRunWirkung } from '../rig/greenfield-systemtest/turn-analyse.mjs';
// @ts-expect-error — s.o.
import { legality, binding, codeVerdict } from '../rig/greenfield-systemtest/metrics.mjs';

let dir: string;
const schreibe = (name: string, zeilen: unknown[]): string => {
  const p = join(dir, name);
  writeFileSync(p, zeilen.map((z) => JSON.stringify(z)).join('\n') + '\n');
  return p;
};

/** Eine Assistant-Nachricht des stream-json-Protokolls, so wie `claude -p --verbose` sie schreibt. */
const assistant = (
  id: string,
  usage: { input?: number; read?: number; create?: number },
  content: unknown[] = [],
): unknown => ({
  type: 'assistant',
  message: {
    id,
    usage: {
      input_tokens: usage.input ?? 0,
      cache_read_input_tokens: usage.read ?? 0,
      cache_creation_input_tokens: usage.create ?? 0,
    },
    content,
  },
});

const toolErgebnis = (id: string): unknown => ({
  type: 'user',
  message: { content: [{ type: 'tool_result', tool_use_id: id }] },
});

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gc-rig-'));
  mkdirSync(join(dir, '.graphcode'), { recursive: true });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('turn-analyse: der Strom misst denselben Lauf wie die Ergebniszeile (CR-GC-574)', () => {
  it('fasst eine Nachricht ueber ihre Content-Bloecke zusammen statt sie doppelt zu zaehlen', () => {
    // Derselbe `message.id` erscheint dreimal — einmal je Content-Block, jedes Mal mit
    // DERSELBEN usage. Naiv summiert waere die Cache-Schreibung das Dreifache.
    const pfad = schreibe('stream-dedupe.jsonl', [
      assistant('m1', { create: 1000 }, [{ type: 'text' }]),
      assistant('m1', { create: 1000 }, [{ type: 'tool_use', id: 't1', name: 'graph_mutate' }]),
      assistant('m1', { create: 1000 }, [{ type: 'text' }]),
      toolErgebnis('t1'),
      assistant('m2', { create: 500 }),
    ]);
    const turns = leseTurns(pfad);
    expect(turns).toHaveLength(2);
    expect(turns[0].verbrauch.cacheCreate).toBe(1000);
    expect(turns[0].ruft).toEqual(['graph_mutate']);
    const summe = turns.reduce((a: number, t: { verbrauch: { cacheCreate: number } }) => a + t.verbrauch.cacheCreate, 0);
    expect(summe).toBe(1500);
  });

  it('meldet Abweichung, wenn die Strom-Summe nicht der result-Zeile entspricht', () => {
    const lauf = join(dir, 'lauf-abweichung');
    mkdirSync(lauf, { recursive: true });
    writeFileSync(join(lauf, 'claude-stream.jsonl'),
      [assistant('m1', { input: 10, read: 20, create: 30 })].map((z) => JSON.stringify(z)).join('\n'));
    writeFileSync(join(lauf, 'claude-raw.json'), JSON.stringify({
      type: 'result',
      usage: { input_tokens: 10, cache_read_input_tokens: 20, cache_creation_input_tokens: 999 },
    }));
    const urteil = pruefeGegenResultzeile(lauf);
    expect(urteil.ok).toBe(false);
    expect(urteil.felder.find((f: { name: string }) => f.name === 'cacheCreate'))
      .toEqual({ name: 'cacheCreate', strom: 30, resultZeile: 999 });
  });

  it('meldet OK, wenn beide dasselbe sagen — sonst waere jede Zuschreibung wertlos', () => {
    const lauf = join(dir, 'lauf-ok');
    mkdirSync(lauf, { recursive: true });
    writeFileSync(join(lauf, 'claude-stream.jsonl'),
      [assistant('m1', { input: 1, read: 2, create: 3 }), assistant('m2', { input: 4, read: 5, create: 6 })]
        .map((z) => JSON.stringify(z)).join('\n'));
    writeFileSync(join(lauf, 'claude-raw.json'), JSON.stringify({
      usage: { input_tokens: 5, cache_read_input_tokens: 7, cache_creation_input_tokens: 9 },
    }));
    expect(pruefeGegenResultzeile(lauf).ok).toBe(true);
  });

  it('schreibt die Cache-Schreibung dem Werkzeug zu, dessen Ergebnis dem Turn voranging', () => {
    const pfad = schreibe('stream-verursacher.jsonl', [
      assistant('m1', {}, [{ type: 'tool_use', id: 't1', name: 'graph_mutate' }]),
      toolErgebnis('t1'),
      assistant('m2', { create: 800 }, [{ type: 'tool_use', id: 't2', name: 'graph_elements' }]),
      toolErgebnis('t2'),
      assistant('m3', { create: 200 }),
    ]);
    expect(cacheVerursacher(leseTurns(pfad))).toEqual([
      { werkzeug: 'graph_mutate', tokens: 800 },
      { werkzeug: 'graph_elements', tokens: 200 },
    ]);
  });
});

describe('dry-run-wirkung: geprobt-und-verworfen ist der Beleg, dass ausgewaehlt wird (CR-GC-574)', () => {
  it('zaehlt jeden Preview, dem KEINE Anwendung folgte, als verworfen', () => {
    // Drei Previews, eine Anwendung: zwei wurden geprobt und verworfen. Danach ein
    // einzelner Preview ohne Anwendung am Ende des Laufs — ebenfalls verworfen.
    const pfad = schreibe('audit-dryrun.jsonl', [
      { operation: 'validate' }, { operation: 'validate' }, { operation: 'validate' },
      { operation: 'mutate' },
      { operation: 'validate' },
    ]);
    expect(dryRunWirkung(pfad)).toEqual({ previews: 4, anwendungen: 1, verworfen: 3, quote: 0.75 });
  });

  it('Quote 0 heisst: jeder Preview wurde angewandt — die Metrik waehlt nicht aus', () => {
    const pfad = schreibe('audit-quote0.jsonl', [
      { operation: 'validate' }, { operation: 'mutate' },
      { operation: 'validate' }, { operation: 'mutate' },
    ]);
    expect(dryRunWirkung(pfad).quote).toBe(0);
  });
});

describe('metrics: Ablehnungen und Bindungsquote (CR-GC-574)', () => {
  it('zaehlt eine Ablehnung auch ohne `tier` am Datensatz', () => {
    // Gemessen 2026-09-19: KEINER der 13 Saetze des sigllm-Laufs trug ein `tier`, wohl
    // aber `result: 'rejected'`. Nur auf `tier` zu schauen meldete 0 statt 2.
    const pfad = schreibe('audit-legality.jsonl', [
      { operation: 'mutate', result: 'applied' },
      { operation: 'mutate', result: 'rejected' },
      { operation: 'mutate', tier: 'block' },
    ]);
    expect(legality(pfad)).toEqual({ blocked: 2, mutations: 3 });
  });

  it('die Bindungsquote zaehlt BLATT-FUNCs — ein Elter ohne realRef ist keine Luecke', () => {
    const graph = {
      elements: [
        { id: 'FUNC-elter', type: 'FUNC' },
        { id: 'FUNC-a', type: 'FUNC', realRef: { file: 'src/a.ts' } },
        { id: 'FUNC-b', type: 'FUNC', attributes: { realRef: { file: 'src/b.ts' } } },
        { id: 'FUNC-c', type: 'FUNC' },
      ],
      traces: [
        { source: 'FUNC-elter', target: 'FUNC-a', type: 'compose' },
        { source: 'FUNC-elter', target: 'FUNC-b', type: 'compose' },
      ],
    };
    // Blatt sind a, b, c — nicht der Elter. Zwei von dreien sind gebunden.
    expect(binding(graph)).toEqual({ leafFuncs: 3, bound: 2, pct: 67 });
  });

  it('das Code-Urteil ist dreiwertig und nennt IMMER seine Reichweite', () => {
    const graph = { elements: [{ id: 'FUNC-a', type: 'FUNC', realRef: { file: 'src/a.ts' } }], traces: [] };
    const reichweite = { endpoints: 10, assigned: 9 };

    const nichtPruefbar = codeVerdict({ skipped: ['rule:RC-01'], importCoverage: reichweite }, graph);
    expect(nichtPruefbar.verdict).toBe('nicht pruefbar');
    expect(nichtPruefbar.why).toContain('RC-01');

    const gedriftet = codeVerdict(
      { skipped: [], violationsByRule: { 'RC-02': 3, 'R-20': 7 }, importCoverage: reichweite }, graph);
    expect(gedriftet.verdict).toBe('gedriftet');
    expect(gedriftet.rcViolations).toEqual({ 'RC-02': 3 });

    const kongruent = codeVerdict({ skipped: [], violationsByRule: { 'R-20': 7 }, importCoverage: reichweite }, graph);
    expect(kongruent.verdict).toBe('kongruent');
    // Der Kern: auch das gruene Urteil traegt die Reichweite — ein Gate, das ohne
    // Bindung "gruen" meldet, ist schlimmer als keins.
    expect(kongruent.reach.pct).toBe(90);
    expect(kongruent.binding.pct).toBe(100);
    expect(kongruent.why).toContain('90 % Reichweite');
  });
});

describe('Betriebsmodi der Arme: jeder Arm nennt seine Achsen (CR-GC-572)', () => {
  it('ARM_ACHSEN deckt jeden konfigurierten Arm — sonst steht im Bericht "unbekannt"', async () => {
    // @ts-expect-error — Rig-Orchestrator in .mjs, bewusst ohne Typdeklaration
    const { CFG, ARM_ACHSEN } = await import('../rig/greenfield-systemtest/run.mjs');
    const labels = CFG.arms.map((a: { label: string }) => a.label);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(ARM_ACHSEN[label], `Arm ${label} fehlt in ARM_ACHSEN`).toBeTruthy();
      expect(ARM_ACHSEN[label].treiber).toBeTruthy();
      expect(ARM_ACHSEN[label].modell).toBeTruthy();
      // `agent` darf null sein — das heisst ENTFAELLT (der Executor treibt selbst) und
      // ist eine Aussage, kein fehlender Eintrag. Der Schluessel muss trotzdem da sein.
      expect(Object.hasOwn(ARM_ACHSEN[label], 'agent'), `Arm ${label}: agent fehlt`).toBe(true);
    }
  });

  it('das leere Feld ist besetzt: Executor-treibt gibt es jetzt lokal UND frontier', async () => {
    // Der Grund fuer zwoelf Laeufe im Kreis: `opus5` gegen `gcrun` variierte drei Achsen
    // zugleich. Mit diesem Arm unterscheidet sich `opus5` in GENAU EINER.
    // @ts-expect-error — s.o.
    const { CFG, ARM_ACHSEN, achsenUnterschied } = await import('../rig/greenfield-systemtest/run.mjs');
    const frontier = CFG.arms.find((a: { label: string }) => a.label === 'gcrun-frontier');
    expect(frontier).toBeTruthy();
    expect(frontier.backend).toBe('anthropic');
    expect(frontier.executor).toBe('gcrun');
    // Kosten-Riegel: der Arm faehrt nur auf namentliche Nennung, nie bei `node run.mjs`.
    expect(frontier.optIn).toBe(true);

    expect(achsenUnterschied('opus5', 'gcrun-frontier')).toEqual(['treiber']);
    // Gegenkontrollen, sonst waere die Aussage oben nur deshalb wahr, weil die Tabelle
    // zu grob ist: der alte Vergleich bleibt konfundiert, und unter den agent-getriebenen
    // Armen ist der Agent sehr wohl eine Achse.
    expect(achsenUnterschied('opus5', 'gcrun')).toEqual(['treiber', 'modell']);
    expect(achsenUnterschied('qwen-35b', 'qwen38-claude')).toEqual(['agent']);
    expect(ARM_ACHSEN['gcrun-frontier'].agent).toBeNull();
  });
});

describe('Der Anthropic-Key kommt aus graphcode/.env — und nur zu dem Arm, der ihn liest', () => {
  it('readSecrets liest die Datei, ohne process.env anzufassen', async () => {
    // @ts-expect-error — s.o.
    const { readSecrets } = await import('../rig/greenfield-systemtest/run.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'gc-secrets-'));
    try {
      const file = join(dir, '.env');
      writeFileSync(file, '# Kommentar\nRIG_TEST_SECRET=wert-aus-datei\n');
      expect(readSecrets(file)).toEqual({ RIG_TEST_SECRET: 'wert-aus-datei' });
      expect(process.env.RIG_TEST_SECRET).toBeUndefined();
      expect(readSecrets(join(dir, 'fehlt.env'))).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('claude -p erbt keinen ANTHROPIC_API_KEY — sonst liefe opus5 still auf API-Abrechnung', async () => {
    // @ts-expect-error — s.o.
    const { claudeEnv } = await import('../rig/greenfield-systemtest/run.mjs');
    const shell = { PATH: '/bin', ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: 'http://x' };
    const frontier = claudeEnv({ local: false }, shell);
    expect(frontier.ANTHROPIC_API_KEY).toBeUndefined();
    expect(frontier.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(frontier.PATH).toBe('/bin');
    const lokal = claudeEnv({ local: true }, shell);
    expect(lokal.ANTHROPIC_API_KEY).toBeUndefined();
    expect(lokal.ANTHROPIC_AUTH_TOKEN).toBe('lmstudio-local');
    // Die Shell selbst bleibt unberuehrt.
    expect(shell.ANTHROPIC_API_KEY).toBe('sk-test');
  });

  it('.env ist gitignored, .env.example nicht', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const ignored = (f: string) =>
      spawnSync('git', ['check-ignore', '-q', f], { cwd: root }).status === 0;
    expect(ignored('.env')).toBe(true);
    expect(ignored('.env.local')).toBe(true);
    expect(ignored('.env.example')).toBe(false);
  });
});
