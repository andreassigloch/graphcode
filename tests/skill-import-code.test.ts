/**
 * TEST-skill-import-code-nennt-verb (CR-GC-877) — verifies REQ-skill-import-code-nennt-verb:
 * Die Command-Datei von se:import-code weist den Agenten an, das CLI-Verb aufzurufen, das
 * src/cli.ts registriert, und nennt das Werkzeug, mit dem der Import den Stand committet.
 *
 * Die Werte kommen aus Datei und Code, nicht aus einer Liste im Test:
 * - das Verb steht im Aufruf `npx @sigloch/graphcode <verb>` der Command-Datei;
 * - die Registrierung ist ein `case '<verb>':` in `main` (src/cli.ts);
 * - das Werkzeug ist `graph_export`, wie `executeImportCode` es an der Registry aufruft
 *   (src/surface/import-code-verb.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..');
const read = (rel: string): string => readFileSync(join(REPO, rel), 'utf8');

export interface Befund {
  verb: string | null;
  verbImCli: boolean;
  werkzeug: string | null;
  werkzeugInDatei: boolean;
}

/** Prueft einen Skill-Text gegen den Code. Reine Funktion, damit die Gegenprobe dieselbe Pruefung faehrt. */
export function pruefeSkill(skillText: string, cliQuelle: string, verbQuelle: string): Befund {
  const verb = /npx @sigloch\/graphcode ([a-z][a-z-]*)/.exec(skillText)?.[1] ?? null;
  const verbImCli = verb !== null && new RegExp(`case '${verb}':`).test(cliQuelle);
  const werkzeug = /registry\['(graph_export)'\]/.exec(verbQuelle)?.[1] ?? null;
  const werkzeugInDatei = werkzeug !== null && skillText.includes(werkzeug);
  return { verb, verbImCli, werkzeug, werkzeugInDatei };
}

const CLI = read('src/cli.ts');
const VERB = read('src/surface/import-code-verb.ts');
const SKILL_PFAD = '.claude/commands/se/import-code.md';

describe('TEST-skill-import-code-nennt-verb: se:import-code nennt das registrierte Verb (CR-GC-877)', () => {
  it('die Command-Datei ruft das Verb import-code, und src/cli.ts registriert es', () => {
    const b = pruefeSkill(read(SKILL_PFAD), CLI, VERB);
    expect(b.verb).toBe('import-code');
    expect(b.verbImCli).toBe(true);
  });

  it('die Command-Datei nennt graph_export, das der Import am Ende ruft', () => {
    const b = pruefeSkill(read(SKILL_PFAD), CLI, VERB);
    expect(b.werkzeug).toBe('graph_export');
    expect(b.werkzeugInDatei).toBe(true);
  });

  it('Gegenprobe: eine Datei ohne Verb und ohne graph_export faellt durch', () => {
    const kaputt = read(SKILL_PFAD).split('import-code').join('importiere').split('graph_export').join('export');
    const b = pruefeSkill(kaputt, CLI, VERB);
    expect(b.verbImCli).toBe(false);
    expect(b.werkzeugInDatei).toBe(false);
  });

  it('Gegenprobe: ein Verb, das cli.ts nicht registriert, faellt durch', () => {
    const b = pruefeSkill(read(SKILL_PFAD).replace('graphcode import-code', 'graphcode import-nichts'), CLI, VERB);
    expect(b.verb).toBe('import-nichts');
    expect(b.verbImCli).toBe(false);
  });
});
