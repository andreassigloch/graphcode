/**
 * TEST-policy-herkunft (CR-GC-629) — eine Urteilsschwelle steht an genau EINER Stelle, und
 * jede Abweichung von ihr ist BENANNT.
 *
 * BEFUND: `contracts/se/policy.js` trägt `boundaryWidth {warning:5}`, `graphcode.config.jsonc`
 * dieselbe 5. Solange beide zeichengleich sind, ist die doppelte Haltung folgenlos — und damit
 * unsichtbar. `src/surface/measured.ts` benennt die Folge selbst: *„Heute folgenlos … invertierend,
 * sobald ein Budget wandert."* Wer die 5 im Repo ändert, misst ab da mit zwei Wahrheiten.
 *
 * Und eine DRITTE Kopie stand in der Prosa: `se/top-level.md` sagte zweimal „max 5 blocks per
 * level". Die Zerlegungsbreite urteilt RD-04 über `decompositionBreadth`, und die steht auf **9**.
 * Der Autor lernte 5, das Gate maß 9 — kein Widerspruch (5 ≤ 9), aber eine Zahl im Fließtext, die
 * keiner Policy folgt: wandert die Policy, wandert der Skill nicht mit.
 *
 * Drei Wächter, eine Frage („wo steht die Zahl?"):
 *   1. CONFIG   — jede Abweichung vom contracts-Startwert trägt ihre Marke, jede Marke eine
 *                 Abweichung.
 *   2. AUFBAU   — jeder Messaufbau nennt seine Policy-Herkunft; keiner fällt still auf Default.
 *   3. SKILL    — kein Skill behauptet eine Schwelle, die keine Policy trägt (Smeagol-Check
 *                 CR-GC-571, hier um die ZAHLEN erweitert — Stufe (a) prüft nur Regel-IDs).
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_METRIC_POLICY, type MetricPolicy } from '@sigloch/contracts/se';
import { CONFIG_FILENAME, loadGraphcodeConfig } from '../src/kernel/config.js';
import { openMeasured } from '../src/surface/measured.js';

const REPO = join(__dirname, '..');
const CONFIG_TEXT = readFileSync(join(REPO, CONFIG_FILENAME), 'utf8');
const GOLDEN = join(REPO, 'rig', 'sigllm-spezifikation', 'golden', 'sigllm-v98.graph.json');

/** Die Marke, mit der eine bewusste Abweichung sich zu erkennen gibt. */
const MARKE = /^\s*\/\/\s*ABWEICHUNG\s+(\w+)\s*:/gm;

const markierteFelder = (): Set<string> =>
  new Set([...CONFIG_TEXT.matchAll(MARKE)].map((m) => m[1]));

describe('CR-GC-629 (1): die Schwelle steht an EINER Stelle — Abweichung nur benannt', () => {
  it('jedes Feld, das vom contracts-Startwert abweicht, trägt seine Marke', () => {
    const geladen = loadGraphcodeConfig(REPO);
    expect(geladen.source, 'ohne gelesene Config prueft dieser Test die Startwerte gegen sich selbst').toBe('config');

    const ist = geladen.config.metricPolicy as Record<string, unknown>;
    const start = DEFAULT_METRIC_POLICY as unknown as Record<string, unknown>;
    const felder = [...new Set([...Object.keys(start), ...Object.keys(ist)])].sort();
    // Sonst prueft der Vergleich nichts: die Policy MUSS Felder haben.
    expect(felder.length).toBeGreaterThan(5);

    const markiert = markierteFelder();
    const unbenannt = felder.filter(
      (k) => JSON.stringify(ist[k]) !== JSON.stringify(start[k]) && !markiert.has(k),
    );
    expect(
      unbenannt,
      `${CONFIG_FILENAME} weicht hier vom contracts-Startwert ab, ohne dass die Abweichung ` +
        'markiert ist. Entweder den Startwert uebernehmen, oder eine Zeile "// ABWEICHUNG <feld>: ' +
        '<Grund, gemessen>" darueber setzen — eine stille zweite Wahrheit ist keine Option:',
    ).toEqual([]);
  });

  it('jede Marke nennt ein Feld, das es gibt, und eine Abweichung, die es gibt', () => {
    const geladen = loadGraphcodeConfig(REPO);
    const ist = geladen.config.metricPolicy as Record<string, unknown>;
    const start = DEFAULT_METRIC_POLICY as unknown as Record<string, unknown>;
    // Eine Marke ohne Abweichung ist dieselbe Unwahrheit in der Gegenrichtung — sie behauptet
    // eine bewusste Entscheidung, die niemand mehr treffen musste.
    for (const feld of markierteFelder()) {
      expect(Object.keys(start), `ABWEICHUNG ${feld}: dieses Policy-Feld gibt es nicht`).toContain(feld);
      expect(
        JSON.stringify(ist[feld]),
        `ABWEICHUNG ${feld}: markiert, aber zeichengleich mit dem Startwert — Karteileiche`,
      ).not.toBe(JSON.stringify(start[feld]));
    }
  });

  it('die Schwelle steht im Repo genau EINMAL — kein zweiter Halter neben der Config', () => {
    // Gesucht wird der WERT in Haltender Position (`boundaryWidth: {...}` / `"boundaryWidth": {...}`),
    // nicht die blosse Nennung: Regelcode und Skripte LESEN `policy.boundaryWidth`, und das
    // sollen sie.
    const halter: string[] = [];
    const scan = (dir: string): void => {
      for (const eintrag of readdirSync(dir)) {
        if (eintrag === 'node_modules' || eintrag === '.git' || eintrag === 'dist') continue;
        const p = join(dir, eintrag);
        if (statSync(p).isDirectory()) {
          scan(p);
          continue;
        }
        if (!/\.(ts|mjs|js|jsonc|json)$/.test(p)) continue;
        if (p.endsWith(CONFIG_FILENAME)) continue;
        if (p.includes('/tests/') || p.includes('/rig/')) continue; // Fixtures und Waechter duerfen
        const text = readFileSync(p, 'utf8');
        if (/["']?boundaryWidth["']?\s*:\s*\{\s*["']?(info|warning|min)/.test(text)) {
          halter.push(p.slice(REPO.length + 1));
        }
      }
    };
    scan(join(REPO, 'src'));
    scan(join(REPO, 'scripts'));
    expect(
      halter,
      'Diese Dateien SETZEN boundaryWidth statt es zu lesen — die Schwelle gehoert in ' +
        `${CONFIG_FILENAME}, sonst misst das Repo mit zwei Wahrheiten:`,
    ).toEqual([]);
  });
});

describe('CR-GC-629 (2): kein Messaufbau fällt still auf Default-Budgets', () => {
  it('openMeasured über das ECHTE Repo nennt die Config als Herkunft — mit Pfad', async () => {
    const m = await openMeasured({ repoRoot: REPO, systemId: 'graphcode', workspaceId: 'gc-629' });
    try {
      expect(m.provenance.policy.source).toBe('file');
      expect(m.provenance.policy.from).toBe(join(REPO, CONFIG_FILENAME));
      // Und die Zahl, mit der gemessen wird, ist die aus der Datei — nicht der Startwert
      // „zufaellig gleich", sondern nachweislich dieselbe Quelle.
      expect(m.policy.boundaryWidth).toEqual(loadGraphcodeConfig(REPO).config.metricPolicy.boundaryWidth);
      expect(m.provenance.policy.value).toEqual(m.policy);
      // Der Stempel traegt sie sichtbar — ohne Stempel keine Zahl.
      expect(m.provenance.policy.from).toContain(CONFIG_FILENAME);
    } finally {
      await m.close();
    }
  }, 120_000);

  it('ein fremder Graph OHNE Config sagt `default` — die Abwesenheit wird gesagt, nicht verschwiegen', async () => {
    const fremd = mkdtempSync(join(tmpdir(), 'gc-629-fremd-'));
    mkdirSync(join(fremd, 'docs', 'graph'), { recursive: true });
    const graphPfad = join(fremd, 'docs', 'graph', 'fremd.graph.json');
    writeFileSync(graphPfad, readFileSync(GOLDEN));
    const m = await openMeasured({ graph: graphPfad, systemId: 'sigllm', workspaceId: 'gc-629' });
    try {
      expect(m.provenance.policy.source).toBe('default');
      expect(m.provenance.policy.from).toBeNull();
      expect(m.provenance.policy.value).toEqual(DEFAULT_METRIC_POLICY);
    } finally {
      await m.close();
      rmSync(fremd, { recursive: true, force: true });
    }
  }, 120_000);

  it('ein fremder Graph MIT Config erbt dessen Schwellen, nicht die Startwerte', async () => {
    const fremd = mkdtempSync(join(tmpdir(), 'gc-629-eigen-'));
    mkdirSync(join(fremd, 'docs', 'graph'), { recursive: true });
    const graphPfad = join(fremd, 'docs', 'graph', 'fremd.graph.json');
    writeFileSync(graphPfad, readFileSync(GOLDEN));
    // Ein gewandertes Budget — genau der Fall, in dem die stille Default-Ruecknahme invertiert.
    const eigene: MetricPolicy = { ...DEFAULT_METRIC_POLICY, boundaryWidth: { warning: 7 } };
    writeFileSync(join(fremd, CONFIG_FILENAME), JSON.stringify({ metricPolicy: eigene, focusThreshold: 0.8 }));

    const m = await openMeasured({ graph: graphPfad, systemId: 'sigllm', workspaceId: 'gc-629' });
    try {
      expect(m.provenance.policy.source).toBe('file');
      expect(m.policy.boundaryWidth).toEqual({ warning: 7 });
      expect(m.policy.boundaryWidth, 'sonst maesse der Aufbau am Gate vorbei').not.toEqual(
        DEFAULT_METRIC_POLICY.boundaryWidth,
      );
    } finally {
      await m.close();
      rmSync(fremd, { recursive: true, force: true });
    }
  }, 120_000);
});

/**
 * CR-GC-629 (3) — der Smeagol-Check auf ZAHLEN.
 *
 * Stufe (a) aus CR-GC-571 prueft, dass jede in einem Skill genannte Regel-ID existiert. Sie
 * prueft nicht, ob eine genannte SCHWELLE einer Policy folgt — genau daran stand „max 5 blocks
 * per level" zweimal in `se/top-level.md`, waehrend RD-04 gegen `decompositionBreadth: 9` urteilt.
 */
describe('CR-GC-629 (3): kein Skill behauptet eine Schwelle, die keine Policy trägt', () => {
  const SKILLS = join(REPO, '.claude', 'commands');

  function markdown(dir: string): string[] {
    const out: string[] = [];
    for (const eintrag of readdirSync(dir)) {
      const p = join(dir, eintrag);
      if (statSync(p).isDirectory()) out.push(...markdown(p));
      else if (p.endsWith('.md')) out.push(p);
    }
    return out;
  }

  /**
   * Eine Zerlegungs-Schwelle in Prosa: „max N … per level" / „N modules per level".
   *
   * Bewusst ENG auf die Zerlegungsbreite — `se:author-uc` sagt „max 4–5 UCs per batch", und das
   * ist Chat-Stueckelung, die keine Policy hat und keine braucht.
   *
   * Die DOKTRIN ist ausgenommen, und zwar am Zeichen, nicht an einer Ausnahmeliste: `7±2` ist
   * eine Spanne, keine Schwelle, und `(?<![±+\-\d])` haelt ihre `2` heraus. Ohne diese Klausel
   * meldete der Waechter genau die Korrektur, die er verlangt (aufgefallen am 2026-09-23).
   */
  const BREITE_IN_PROSA = /(?<![±+\-\d])\b(?:max(?:imum)?\s+)?(\d+)\s+(?:\w+\s+)?(?:blocks?|modules?|children|sub-?\w+)\s+per\s+level/gi;

  it('der Scan greift ueberhaupt — es gibt Skills, und sie reden ueber Ebenen', () => {
    const dateien = markdown(SKILLS);
    expect(dateien.length).toBeGreaterThan(10);
    expect(
      dateien.some((f) => /per level/i.test(readFileSync(f, 'utf8'))),
      'kein Skill spricht mehr ueber Ebenen — dann ist dieses Muster tot, nicht sauber',
    ).toBe(true);
  });

  it('keine nackte Zerlegungsbreite im Fließtext — die Zahl steht in der Policy', () => {
    const treffer: string[] = [];
    for (const datei of markdown(SKILLS)) {
      const text = readFileSync(datei, 'utf8');
      for (const m of text.matchAll(BREITE_IN_PROSA)) {
        treffer.push(`${datei.slice(REPO.length + 1)}: "${m[0].trim()}"`);
      }
    }
    expect(
      treffer,
      'Eine Zerlegungsbreite als Zahl im Skilltext folgt keiner Policy — wandert ' +
        '`decompositionBreadth`, wandert der Text nicht mit. Die Doktrin nennen (7±2) und die ' +
        'Zahl der Regel ueberlassen (RD-04 gegen `decompositionBreadth`):',
    ).toEqual([]);
  });

  it('die Doktrin selbst steht weiterhin da, und sie liegt IM Budget der Policy', () => {
    const text = readFileSync(join(SKILLS, 'se', 'top-level.md'), 'utf8');
    expect(text, 'ohne die Doktrin waere die Zahl nur geloescht, nicht ersetzt').toContain('7±2');
    expect(text).toContain('decompositionBreadth');

    // Und die Doktrin widerspricht der Policy nicht: ihre Obergrenze (7+2) ist das Budget.
    const breite = loadGraphcodeConfig(REPO).config.metricPolicy.decompositionBreadth;
    expect(breite, 'ohne Budget ist die Doktrin unbelegt').not.toBeNull();
    expect(breite!.warning).toBe(9);
  });
});
