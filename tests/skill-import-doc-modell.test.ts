/**
 * CR-GC-859 — der Skill `se:import-doc` nennt kein LLM-Modell und rät keins.
 *
 * Regel des Auftraggebers: ein Modellname steht nie im Code oder Skill, auch nicht als Default. Er kommt
 * nur aus der Konfiguration; fehlt sie, bricht der Lauf mit klarer Meldung ab. graphify 0.6 liest das
 * Modell aus der Client-Option `model` oder der Umgebung `LLM_MODEL` (CR-GF-153); eine Konfigurationsdatei
 * hat es nicht.
 *
 * Drei Zusicherungen:
 *   1. der Skill-Text nennt keinen Modellnamen;
 *   2. jeder `new LMStudioClient(` im Skill übergibt `model` ausdrücklich;
 *   3. das Skript der Stufe 2, so wie der Skill es vorgibt, bricht ohne `LLM_MODEL` ab, bevor es einen
 *      Store öffnet — mit der Meldung, die sagt, was zu setzen ist.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = join(__dirname, '..');
const skill = readFileSync(join(REPO, '.claude', 'commands', 'se', 'import-doc.md'), 'utf8');

/** Familien lokaler und gehosteter Modelle, wie sie in Modellnamen stehen. */
const MODELLNAME = /\b(qwen|llama|mistral|devstral|gemma|phi-?\d|deepseek|gpt-|claude-|opus|sonnet|haiku)|nvfp4|gguf/i;

/** Der Code-Block unter „## Stufe 2". */
function stufe2Skript(): string {
  const abschnitt = skill.slice(skill.indexOf('## Stufe 2'));
  const m = abschnitt.match(/```ts\n([\s\S]*?)\n```/);
  if (!m) throw new Error('Stufe 2 hat keinen ts-Block');
  return m[1];
}

describe('CR-GC-859: se:import-doc — Modell nur aus der Konfiguration', () => {
  it('der Skill nennt keinen Modellnamen, auch nicht als Default', () => {
    expect(skill.match(MODELLNAME)?.[0]).toBeUndefined();
  });

  it('jeder LMStudioClient bekommt das Modell ausdrücklich', () => {
    const aufrufe = skill.match(/new LMStudioClient\([^)]*\)/g) ?? [];
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const a of aufrufe) expect(a).toMatch(/\{[^}]*\bmodel\b/);
  });

  it('Stufe 2 bricht ohne LLM_MODEL ab, bevor sie einen Store öffnet, und sagt, was zu setzen ist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gc-import-doc-'));
    try {
      // Bare Importe lösen über die Repo-node_modules, wie im Skill (Skript liegt im Repo).
      symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
      writeFileSync(join(dir, 'run.mts'), stufe2Skript());
      const env = { ...process.env };
      delete env.LLM_MODEL;
      const r = spawnSync(process.execPath, ['run.mts', 'decisions.json', 'doc.md'], { cwd: dir, env, encoding: 'utf8' });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('LLM_MODEL');
      expect(r.stderr).toContain('Kein LLM-Modell konfiguriert');
      // Abbruch VOR dem Store: kein .graphcode im Lauf-Verzeichnis.
      expect(existsSync(join(dir, '.graphcode'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
