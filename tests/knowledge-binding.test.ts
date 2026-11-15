/**
 * TEST-knowledge-binding (CR-GC-935) — init/update binden die Wissensdatei aus
 * `graphcode.config.jsonc` (Schluessel `knowledgeFile`) in den Kontext des Agenten:
 * Claude Code ueber den Hook `inject-knowledge.sh` (SessionStart + SubagentStart),
 * OpenCode ueber `instructions` in `opencode.json`. Ohne Schluessel nichts; Entfernen raeumt auf.
 *
 * Echte Dateien in einem Temp-Repo, der Hook laeuft als echter Prozess.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';
import { scaffold } from '../src/surface/scaffold.js';

const HOOK_REL = join('.claude', 'hooks', 'inject-knowledge.sh');
const SETTINGS = join('.claude', 'settings.json');
const CONFIG = 'graphcode.config.jsonc';

type Entry = { matcher?: string; hooks?: { command: string }[] };
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const knowledgeEntries = (repo: string, event: string): Entry[] =>
  ((readJson(join(repo, SETTINGS)).hooks?.[event] ?? []) as Entry[]).filter((e) =>
    e.hooks?.some((h) => h.command.includes('inject-knowledge.sh')),
  );

describe('TEST-knowledge-binding: Wissensdatei im Kontext des Agenten (CR-GC-935)', () => {
  let repo: string;
  let dir: string;
  let wissen: string;

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'graphcode-kb-'));
    dir = mkdtempSync(join(tmpdir(), 'graphcode-kb-wissen-'));
    wissen = join(dir, 'index.md');
    writeFileSync(wissen, '# Index\nZeile-Eins: Mauve-7731\n');
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  });

  const config = (extra: Record<string, unknown>): void =>
    writeFileSync(
      join(repo, CONFIG),
      `// Config\n${JSON.stringify({ metricPolicy: DEFAULT_METRIC_POLICY, focusThreshold: 0.8, ...extra }, null, 2)}\n`,
    );
  const mitSchluessel = (pfad: string): void => config({ knowledgeFile: pfad });

  it('init mit Schluessel schreibt Hook, beide Eintraege und instructions', async () => {
    mitSchluessel(wissen);
    await scaffold('init', { repoRoot: repo });
    expect(existsSync(join(repo, HOOK_REL))).toBe(true);
    for (const event of ['SessionStart', 'SubagentStart']) {
      const e = knowledgeEntries(repo, event);
      expect(e).toHaveLength(1);
      expect(e[0].hooks![0].command).toContain(wissen);
    }
    expect(readJson(join(repo, 'opencode.json')).instructions).toEqual([wissen]);
  });

  it('init ohne Schluessel schreibt nichts davon', async () => {
    await scaffold('init', { repoRoot: repo });
    expect(existsSync(join(repo, HOOK_REL))).toBe(false);
    expect(knowledgeEntries(repo, 'SessionStart')).toHaveLength(0);
    expect(knowledgeEntries(repo, 'SubagentStart')).toHaveLength(0);
    expect(readJson(join(repo, 'opencode.json')).instructions).toBeUndefined();
  });

  it('~ im Schluessel wird zum absoluten Pfad aufgeloest (OpenCode kennt kein ~)', async () => {
    mitSchluessel('~/irgendwo/index.md');
    await scaffold('init', { repoRoot: repo });
    const ins = readJson(join(repo, 'opencode.json')).instructions as string[];
    expect(ins[0].startsWith('~')).toBe(false);
    expect(ins[0].endsWith('/irgendwo/index.md')).toBe(true);
  });

  it('update nach Entfernen des Schluessels raeumt auf; Fremdes bleibt', async () => {
    mitSchluessel(wissen);
    mkdirSync(join(repo, '.claude'), { recursive: true });
    writeFileSync(
      join(repo, SETTINGS),
      JSON.stringify({
        model: 'x',
        hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo fremd' }] }] },
      }),
    );
    writeFileSync(join(repo, 'opencode.json'), JSON.stringify({ model: 'y', instructions: ['fremd.md'] }));
    await scaffold('init', { repoRoot: repo });
    expect(readJson(join(repo, 'opencode.json')).instructions).toEqual(['fremd.md', wissen]);

    config({});
    await scaffold('update', { repoRoot: repo });
    expect(existsSync(join(repo, HOOK_REL))).toBe(false);
    expect(knowledgeEntries(repo, 'SessionStart')).toHaveLength(0);
    expect(knowledgeEntries(repo, 'SubagentStart')).toHaveLength(0);
    const settings = readJson(join(repo, SETTINGS));
    expect(settings.model).toBe('x');
    expect(JSON.stringify(settings.hooks.SessionStart)).toContain('echo fremd');
    const oc = readJson(join(repo, 'opencode.json'));
    expect(oc.model).toBe('y');
    expect(oc.instructions).toEqual(['fremd.md']);
  });

  it('update mit geaendertem Pfad ersetzt den alten Eintrag', async () => {
    mitSchluessel(wissen);
    await scaffold('init', { repoRoot: repo });
    const neu = join(dir, 'neu.md');
    writeFileSync(neu, 'x');
    mitSchluessel(neu);
    await scaffold('update', { repoRoot: repo });
    expect(readJson(join(repo, 'opencode.json')).instructions).toEqual([neu]);
    expect(knowledgeEntries(repo, 'SessionStart')).toHaveLength(1);
  });

  it('update ist wiederholbar ohne Doppelung', async () => {
    mitSchluessel(wissen);
    await scaffold('init', { repoRoot: repo });
    await scaffold('update', { repoRoot: repo });
    expect(readJson(join(repo, 'opencode.json')).instructions).toEqual([wissen]);
    expect(knowledgeEntries(repo, 'SubagentStart')).toHaveLength(1);
  });

  it('remove entfernt Hook, Eintraege und instructions-Zeile', async () => {
    mitSchluessel(wissen);
    writeFileSync(join(repo, 'opencode.json'), JSON.stringify({ model: 'y', instructions: ['fremd.md'] }));
    await scaffold('init', { repoRoot: repo });
    await scaffold('remove', { repoRoot: repo });
    expect(existsSync(join(repo, HOOK_REL))).toBe(false);
    expect(existsSync(join(repo, SETTINGS))).toBe(false);
    expect(readJson(join(repo, 'opencode.json'))).toMatchObject({ model: 'y', instructions: ['fremd.md'] });
    expect(readJson(join(repo, 'opencode.json')).mcp).toBeUndefined();
  });

  describe('der Hook als Prozess', () => {
    const run = (datei: string, event: string) => {
      mitSchluessel(datei);
      return scaffold('init', { repoRoot: repo }).then(() => {
        const cmd = knowledgeEntries(repo, event)[0].hooks![0].command;
        return spawnSync('bash', ['-c', cmd], {
          input: JSON.stringify({ hook_event_name: event }),
          env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
          encoding: 'utf8',
        });
      });
    };

    for (const event of ['SessionStart', 'SubagentStart']) {
      it(`${event}: gibt die Datei als additionalContext aus`, async () => {
        const r = await run(wissen, event);
        expect(r.status).toBe(0);
        const out = JSON.parse(r.stdout);
        expect(out.hookSpecificOutput.hookEventName).toBe(event);
        expect(out.hookSpecificOutput.additionalContext).toBe(readFileSync(wissen, 'utf8'));
      });
    }

    it('Datei ueber 10 000 Zeichen: ein Satz, kein Ausschnitt', async () => {
      writeFileSync(wissen, 'ä'.repeat(10001));
      const r = await run(wissen, 'SessionStart');
      expect(r.status).toBe(0);
      const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext as string;
      expect(ctx).toContain('10000');
      expect(ctx).not.toContain('ä');
      expect(ctx.split('\n')).toHaveLength(1);
    });

    it('Datei mit genau 10 000 Zeichen kommt vollstaendig an', async () => {
      writeFileSync(wissen, 'ä'.repeat(10000));
      const r = await run(wissen, 'SessionStart');
      expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toBe('ä'.repeat(10000));
    });

    it('fehlende Datei: ein Satz mit dem Pfad', async () => {
      const weg = join(dir, 'gibt-es-nicht.md');
      const r = await run(weg, 'SubagentStart');
      expect(r.status).toBe(0);
      const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext as string;
      expect(ctx).toContain(weg);
      expect(ctx.split('\n')).toHaveLength(1);
    });

    it('Pfad mit Apostroph und Leerzeichen funktioniert', async () => {
      const sonder = join(dir, "d'a ta");
      mkdirSync(sonder);
      const f = join(sonder, 'i.md');
      writeFileSync(f, 'Inhalt');
      const r = await run(f, 'SessionStart');
      expect(JSON.parse(r.stdout).hookSpecificOutput.additionalContext).toBe('Inhalt');
    });
  });
});
