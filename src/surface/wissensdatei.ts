/**
 * wissensdatei.ts — die Wissensdatei des Repos im Kontext des Agenten (CR-GC-935).
 *
 * WARUM: Ein Verweis in den Anweisungen genuegt nicht; gemessen lasen damit 3 von 8 Agenten die
 * Datei, mit der Datei im Kontext 8 von 8. Die Datei gehoert nicht zu graphcode — graphcode kennt
 * nur ihren Pfad, den das Repo in `graphcode.config.jsonc` unter `knowledgeFile` nennt.
 *
 * WAS: Claude Code bekommt den Hook `inject-knowledge.sh` (SessionStart + SubagentStart), OpenCode
 * einen Eintrag in `instructions`. `.claude/settings.json` ist versioniert und traegt den Pfad so, wie die
 * Config ihn nennt (CR-GC-936: kein Pfad des Rechners im Repo); der Hook loest `~` und Relatives zur
 * Laufzeit auf. `opencode.json` traegt den ABSOLUTEN Pfad: OpenCode loest `~` nicht auf
 * (am echten Lauf geprueft), also loest graphcode es beim `init` auf. Fehlt der Schluessel, entsteht nichts,
 * und eine fruehere Einbindung faellt weg. Welcher Pfad frueher eingebunden war, steht im
 * Befehl des Hook-Eintrags in `.claude/settings.json`.
 *
 * @author andreas@siglochconsulting
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { CONFIG_FILENAME, ConfigError, stripJsonComments } from '../kernel/config.js';

export const KNOWLEDGE_HOOK = 'inject-knowledge.sh';
export const KNOWLEDGE_EVENTS = ['SessionStart', 'SubagentStart'] as const;

type Entry = { matcher?: string; hooks?: { type: string; command: string }[] };

/** Der Pfad aus `knowledgeFile` wie in der Config geschrieben; `null` ohne Schluessel oder Config. */
export function knowledgePathOf(repoRoot: string): string | null {
  const path = join(repoRoot, CONFIG_FILENAME);
  if (!existsSync(path)) return null;
  let parsed: { knowledgeFile?: unknown };
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(path, 'utf8')));
  } catch (err) {
    throw new ConfigError(path, `invalid JSONC — ${(err as Error).message}`);
  }
  const value = parsed.knowledgeFile;
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ConfigError(path, '`knowledgeFile` muss ein nichtleerer Pfad sein');
  }
  return value;
}

/** Der absolute Pfad zu `raw`: `~` gegen das Home-Verzeichnis, Relatives gegen die Repo-Wurzel. */
export function resolveKnowledgePath(raw: string | null, repoRoot: string): string | null {
  if (raw === null) return null;
  const home = raw === '~' || raw.startsWith('~/') ? homedir() + raw.slice(1) : raw;
  return resolve(repoRoot, home);
}

const quote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
const unquote = (s: string): string => s.replace(/'\\''/g, "'");

/** Der Befehl, den Claude Code ausfuehrt; der Pfad steht als einziges Argument darin. */
export function knowledgeCommand(path: string): string {
  return `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/${KNOWLEDGE_HOOK}" ${quote(path)}`;
}

const isKnowledge = (e: Entry): boolean =>
  Array.isArray(e.hooks) && e.hooks.some((h) => typeof h.command === 'string' && h.command.includes(KNOWLEDGE_HOOK));

/** Der bisher eingebundene Pfad aus einer vorhandenen `settings.json`; `null`, wenn keiner. */
export function knowledgePathOfSettings(settingsRaw: string | null): string | null {
  if (!settingsRaw) return null;
  const hooks = (JSON.parse(settingsRaw) as { hooks?: Record<string, unknown> }).hooks ?? {};
  for (const event of KNOWLEDGE_EVENTS) {
    const entries = Array.isArray(hooks[event]) ? (hooks[event] as Entry[]) : [];
    for (const e of entries.filter(isKnowledge)) {
      for (const h of e.hooks ?? []) {
        const m = /'((?:[^']|'\\'')*)'\s*$/.exec(h.command);
        if (h.command.includes(KNOWLEDGE_HOOK) && m) return unquote(m[1]);
      }
    }
  }
  return null;
}

/** `hooks` ohne unsere Wissens-Eintraege, mit ihnen neu gesetzt, wenn `path` da ist. Fremde bleiben. */
export function withKnowledgeHooks(hooks: Record<string, unknown>, path: string | null): Record<string, unknown> {
  const next = { ...hooks };
  for (const event of KNOWLEDGE_EVENTS) {
    const current = Array.isArray(next[event]) ? (next[event] as Entry[]) : [];
    const kept = current.filter((e) => !isKnowledge(e));
    const all = path ? [...kept, { hooks: [{ type: 'command', command: knowledgeCommand(path) }] }] : kept;
    if (all.length > 0) next[event] = all;
    else delete next[event];
  }
  return next;
}

/** `instructions` ohne den frueheren Pfad, mit dem neuen am Ende. Fremde Zeilen bleiben; leer → `undefined`. */
export function withKnowledgeInstruction(
  instructions: unknown,
  previous: string | null,
  path: string | null,
): string[] | undefined {
  const kept = (Array.isArray(instructions) ? instructions : []).filter((i) => i !== previous && i !== path);
  const all = path ? [...kept, path] : kept;
  return all.length > 0 ? all : undefined;
}
