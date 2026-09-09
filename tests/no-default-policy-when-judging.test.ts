/**
 * CR-GC-492 — wer über ein ECHTES Repo urteilt, urteilt mit dessen Budgets.
 *
 * `new GraphCodeHarness(cfg, storage)` faellt ohne `opts.graphcodeConfig` still auf
 * `DEFAULT_CONFIG` zurueck (`harness.ts`). Fuer ein Wegwerf-Repo ist das die RICHTIGE Antwort —
 * dort liegt keine Config. Es beisst genau dort, wo die Wurzel ein echtes Repo mit
 * `graphcode.config.jsonc` ist UND geurteilt wird: dann misst der Test auf Startwerten statt auf
 * den Schwellen, mit denen die Produktion urteilt.
 *
 * Heute folgenlos (die Config ist zeichengleich mit `DEFAULT_METRIC_POLICY`), invertierend sobald
 * ein Budget wandert — und genau das will CR-SM-303, nachdem CR-GC-484 T-S3 das Budget als DIE
 * Stellgroesse nachgewiesen hat.
 *
 * Ein Wächter statt einer Erinnerung: ohne ihn ist der Fix in vier Wochen zur Haelfte zurueck.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const TESTS = join(__dirname);

/**
 * Ein Ausdruck, der auf das ECHTE Repo zeigt, kein `mkdtemp`.
 *
 * Die Anwesenheit im Text reicht NICHT: `readFileSync(join(REPO_ROOT, 'docs/graph/…'))` liest
 * nur eine Datei und urteilt nicht. Erst wenn der Ausdruck als **`repoRoot` der Harness-Config**
 * ankommt, misst der Test auf der echten Wurzel — siehe `zeigtAufEchtesRepo`.
 */
const REAL_ROOT_EXPR = String.raw`join\(__dirname, *'\.\.'\)|process\.cwd\(\)`;

/**
 * Zeigt die `repoRoot` der Harness-Config auf das echte Repo?
 *
 * Zwei Wege, beide in `tests/` real vorhanden:
 *   1. direkt   — `repoRoot: join(__dirname, '..')`
 *   2. ueber eine Konstante — `const REPO_ROOT = join(__dirname, '..')`, dann `repoRoot: REPO_ROOT`
 *      oder `makeConfig(REPO_ROOT)`, wo `makeConfig` die Config baut.
 *
 * Was bewusst NICHT zaehlt: derselbe Ausdruck als Argument von `join(...)`, `readFileSync(...)`
 * oder `existsSync(...)` — das ist Dateizugriff, kein Urteil. Genau daran hat die erste Fassung
 * drei Dateien falsch angeschuldigt (CR-GC-492 §6).
 */
function zeigtAufEchtesRepo(text: string): boolean {
  // Konstanten, die an eine echte Wurzel gebunden sind — eine Ebene Aliasing, mehr nicht.
  const alias = [...text.matchAll(new RegExp(String.raw`const (\w+) = (?:${REAL_ROOT_EXPR})`, 'g'))]
    .map((m) => m[1]);
  const wurzel = [REAL_ROOT_EXPR, ...alias].join('|');

  // 1. direkt in der Config-Position
  if (new RegExp(String.raw`repoRoot:\s*(?:${wurzel})\s*[,}]`).test(text)) return true;

  // 2. als EINZIGES Argument an eine lokale Funktion, die eine Config baut
  for (const m of text.matchAll(/function (\w+)\([^)]*\)[^{]*\{/g)) {
    const rumpf = text.slice(m.index ?? 0, (m.index ?? 0) + 600);
    if (!/repoRoot/.test(rumpf)) continue;
    if (new RegExp(String.raw`\b${m[1]}\(\s*(?:${wurzel})\s*[,)]`).test(text)) return true;
  }
  return false;
}
/** Der Test URTEILT: Readiness, Regelauswertung, Metriken, Steuerung. */
const JUDGES = /readiness|evaluateAll|graph_metrics|metricPolicy|Advisory|steerScore/i;

/**
 * Wer den Konstruktor mit echter Wurzel BEWUSST behaelt, steht hier — mit Grund.
 * `harness.ts` erlaubt ihn ausdruecklich fuer Adapter-Injektion; verboten ist nicht der
 * Konstruktor, verboten ist das UNBEMERKTE Urteilen auf Startwerten.
 */
const ERLAUBT: Record<string, string> = {
  'no-default-policy-when-judging.test.ts':
    'der Waechter selbst — er nennt die Muster, die er sucht, und baut keinen Harness.',
  'rig-measured.test.ts':
    'CR-GC-491: der ZEUGE baut absichtlich von Hand, um zu zeigen, dass der Konstruktor ' +
    'still auf DEFAULT_CONFIG faellt. Seine Wurzel ist eine Fixture im Temp, nicht das Repo — ' +
    'die echte Wurzel kommt dort ueber openMeasured({ repoRoot }) herein.',
};

/**
 * NOCH NICHT umgestellt — eine schrumpfende Liste, kein Dauerzustand. Getrennt von `ERLAUBT`,
 * damit „bewusste Ausnahme" und „noch offen" nicht dasselbe Feld teilen: sonst ist in vier
 * Wochen nicht mehr unterscheidbar, was entschieden und was liegengeblieben ist.
 */
const OFFEN: Record<string, string> = {
  // Zeile 98: `repoRoot: join(__dirname, '..')` mit Readiness-Urteil — entstanden in CR-GC-489,
  // also in dem CR, der diese Klasse beheben sollte. Der einzige echte Rest.
  'readiness-conformance-skip.test.ts': 'CR-GC-497',
};

describe('CR-GC-492: kein Urteil ueber ein echtes Repo mit Startwerten', () => {
  it('kein Test baut von Hand und urteilt zugleich ueber die echte Repo-Wurzel', () => {
    const treffer: string[] = [];
    for (const name of readdirSync(TESTS).filter((f) => f.endsWith('.test.ts'))) {
      if (name in ERLAUBT || name in OFFEN) continue;
      const text = readFileSync(join(TESTS, name), 'utf8');
      if (!text.includes('new GraphCodeHarness')) continue;
      if (!zeigtAufEchtesRepo(text)) continue;
      if (!JUDGES.test(text)) continue;
      treffer.push(`tests/${name}`);
    }
    expect(
      treffer,
      'Diese Tests bauen den Harness von Hand, zeigen auf das ECHTE Repo und urteilen — sie ' +
        'messen damit auf DEFAULT_CONFIG statt auf graphcode.config.jsonc. Umstellen auf ' +
        '`openMeasured({ repoRoot })` (CR-GC-496) oder mit Grund in ERLAUBT eintragen:',
    ).toEqual([]);
  });

  it('der Melder ist nicht blind — er trennt Config-Position von blossem Dateizugriff', () => {
    // Ohne diesen Test kann eine Verschaerfung den Melder stumm machen: leere Liste,
    // gruener Lauf, keine Aussage. Erste Fassung war zu weit und schuldigte drei Dateien
    // falsch an (CR-GC-492 §6) — diese hier haelt beide Richtungen fest.
    expect(zeigtAufEchtesRepo("const c = { repoRoot: join(__dirname, '..'), scope: {} };")).toBe(true);
    expect(zeigtAufEchtesRepo("const R = join(__dirname, '..');\nconst c = { repoRoot: R, x: 1 };")).toBe(true);
    expect(
      zeigtAufEchtesRepo(
        "function makeConfig(repoRoot) { return { repoRoot, scope: {} }; }\nmakeConfig(process.cwd());",
      ),
    ).toBe(true);

    // Dateizugriff auf das echte Repo ist KEIN Urteil auf echter Wurzel.
    expect(zeigtAufEchtesRepo("const R = join(__dirname, '..');\nreadFileSync(join(R, 'docs/graph/x.json'));")).toBe(false);
    expect(
      zeigtAufEchtesRepo(
        "function makeConfig(repoRoot) { return { repoRoot, scope: {} }; }\nmakeConfig(tmp);",
      ),
    ).toBe(false);

    // Und er trifft den einen echten Rest wirklich — sonst waere OFFEN eine leere Behauptung.
    const rest = Object.keys(OFFEN);
    expect(rest.length).toBeGreaterThan(0);
    for (const name of rest) {
      expect(zeigtAufEchtesRepo(readFileSync(join(TESTS, name), 'utf8')), name).toBe(true);
    }
  });

  it('die Ausnahmeliste traegt zu jedem Eintrag einen Grund und keine Karteileiche', () => {
    for (const [name, grund] of Object.entries(ERLAUBT)) {
      expect(grund.length, `${name} ohne Begruendung`).toBeGreaterThan(40);
      expect(readdirSync(TESTS), `${name} in ERLAUBT, aber die Datei gibt es nicht`).toContain(name);
    }
  });

  it('jeder OFFEN-Eintrag nennt einen CR und existiert — eine Restliste, kein Vergessen', () => {
    for (const [name, cr] of Object.entries(OFFEN)) {
      expect(cr, `${name} ohne CR-Nummer`).toMatch(/^CR-GC-\d+$/);
      expect(readdirSync(TESTS), `${name} in OFFEN, aber die Datei gibt es nicht`).toContain(name);
    }
  });

  it('OFFEN und ERLAUBT ueberschneiden sich nicht — eine Datei, ein Grund', () => {
    const doppelt = Object.keys(OFFEN).filter((n) => n in ERLAUBT);
    expect(doppelt).toEqual([]);
  });
});
