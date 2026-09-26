/**
 * TEST-deny-headless-question — CR-GC-690: die Hausregel "im headless-Lauf keine Rueckfrage"
 * wird vom Harness durchgesetzt, nicht nur in GRAPHCODE.md behauptet.
 *
 * Laeuft das echte PreToolUse-Shell-Hook mit dem stdin-JSON, das Claude Code uebergibt.
 * Headless = `claude -p`: Claude Code setzt dort `CLAUDE_CODE_ENTRYPOINT=sdk-cli` (gemessen
 * 2026-09-26 mit einem Env-Dump-Hook, claude 2.1.167; interaktiv `cli`, VS Code `claude-vscode`).
 * Dazu: das Hook ist registriert UND wird mit dem Scaffold ausgeliefert — sonst gilt die Regel
 * nur in diesem Repo, nicht beim Consumer, fuer den sie geschrieben ist.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { mergedSettingsContent, shippedHookFiles, type SettingsShape } from '../src/surface/scaffold-templates.js';
import { guardrailsContent } from '../src/surface/scaffold-docs.js';

const HOOK_FILE = 'deny-headless-question.sh';
const HOOK = join(__dirname, '..', '.claude', 'hooks', HOOK_FILE);

function runHook(entrypoint: string | undefined) {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CLAUDE_CODE_ENTRYPOINT;
  if (entrypoint !== undefined) env.CLAUDE_CODE_ENTRYPOINT = entrypoint;
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [{ question: 'Welcher Kanal?', header: 'Kanal', options: [] }] },
  });
  return spawnSync('bash', [HOOK], { input: payload, encoding: 'utf8', env });
}

describe('TEST-deny-headless-question: CR-GC-690 keine Rueckfrage ins Leere', () => {
  it('headless (claude -p, entrypoint sdk-cli): BLOCKIERT, exit 2, lenkt auf die Annahme', () => {
    const r = runHook('sdk-cli');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('CR-GC-690');
    expect(r.stderr).toMatch(/assumption/i);
    expect(r.stderr).toMatch(/closing message/i);
  });

  it.each(['cli', 'claude-vscode', 'sdk-ts'])('mit Menschen am anderen Ende (%s): erlaubt, exit 0', (ep) => {
    const r = runHook(ep);
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('ohne Entrypoint (kein Claude-Code-Host bekannt): erlaubt — nur ein belegtes headless blockt', () => {
    expect(runHook(undefined).status).toBe(0);
  });

  it('ist fuer AskUserQuestion registriert und geht mit dem Scaffold zum Consumer', () => {
    expect(shippedHookFiles()).toContain(HOOK_FILE);
    const merged = JSON.parse(mergedSettingsContent(null)) as SettingsShape;
    const entry = (merged.hooks?.PreToolUse ?? []).find((e) =>
      (e.hooks ?? []).some((h) => h.command.includes(HOOK_FILE)));
    expect(entry, 'kein PreToolUse-Eintrag fuer das Hook').toBeDefined();
    expect(entry!.matcher).toBe('AskUserQuestion');
  });

  it('GRAPHCODE.md nennt bei der Hausregel das Hook, das sie durchsetzt', () => {
    expect(guardrailsContent()).toContain('deny-headless-question');
  });
});
