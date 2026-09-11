/**
 * executor-tools.ts — Werkzeug-Ausführung des eingebetteten Executors (CR-GC-506,
 * geschnitten aus executor.ts).
 *
 * Was ein Werkzeugaufruf des Modells auslöst und wie sein Ergebnis in die History
 * zurückkommt: die auf den Workspace gescopten Lese-Werkzeuge, der Aufruf eines
 * Registry-Werkzeugs unter seinem `graphcode_`-Namen und das backend-korrekte
 * Anhängen der Ergebnisse. Der Aufruf reicht den Input des Modells unverändert
 * weiter; einen Batch, den der Executor selbst festlegt (Preflight-korrigiert,
 * als Probe markiert), schickt allein der Gate-Zugang in executor-gate.ts.
 *
 * @author andreas@siglochconsulting
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import type { ModelToolCall } from './model-answer-contract.js';
import { jsonCapped } from './executor-prompt.js';
import type { ExecutorConfig } from './executor.js';

// ---------------------------------------------------------------------------
// Read-Tools — auf den Workspace gescoped (Containment-Guard, kein ..-Ausbruch).
// ---------------------------------------------------------------------------

function contained(workspaceDir: string, p: string): string {
  const abs = resolve(workspaceDir, p);
  if (abs !== workspaceDir && !abs.startsWith(workspaceDir + '/')) {
    throw new Error(`path escapes workspace: ${p}`);
  }
  return abs;
}

export interface ReadTool {
  desc: string;
  params: Record<string, unknown>;
  run: (workspaceDir: string, input: Record<string, unknown>) => string;
}

export const READ_TOOLS: Record<string, ReadTool> = {
  list_dir: {
    desc: 'List entries under a workspace-relative directory (e.g. "material").',
    params: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (dir, input) => {
      const p = contained(dir, String(input.path ?? '.'));
      return readdirSync(p)
        .map((n) => {
          try {
            return statSync(join(p, n)).isDirectory() ? n + '/' : n;
          } catch {
            return n;
          }
        })
        .join('\n');
    },
  },
  read_file: {
    desc: 'Read a workspace-relative file (capped at 8000 chars).',
    params: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (dir, input) => readFileSync(contained(dir, String(input.path)), 'utf8').slice(0, 8000),
  },
  grep: {
    desc: 'Case-insensitive substring search across ./material; up to 40 "relpath:line" hits.',
    params: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] },
    run: (dir, input) => {
      const hits: string[] = [];
      const root = join(dir, 'material');
      const needle = String(input.pattern ?? '').toLowerCase();
      const walk = (d: string): void => {
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          let st;
          try {
            st = statSync(p);
          } catch {
            continue;
          }
          if (st.isDirectory()) {
            if (n !== 'node_modules' && n !== '.git') walk(p);
          } else if (/\.(ts|js|md|json|tsx)$/.test(n) && st.size < 200_000) {
            readFileSync(p, 'utf8')
              .split('\n')
              .forEach((ln, i) => {
                if (hits.length < 40 && ln.toLowerCase().includes(needle)) {
                  hits.push(`${relative(dir, p)}:${i + 1}`);
                }
              });
          }
          if (hits.length >= 40) return;
        }
      };
      try {
        walk(root);
      } catch {
        // ./material darf fehlen — dann gibt es schlicht keine Treffer.
      }
      return hits.join('\n') || '(no hits)';
    },
  },
};

// ---------------------------------------------------------------------------
// Ausführen und Zurückmelden.
// ---------------------------------------------------------------------------

/** Ein Lese-Werkzeug oder ein Registry-Werkzeug (`graphcode_<name>`) ausführen; Fehler als Text. */
export async function execReadOrGraphTool(
  registry: MCPToolRegistry,
  workspaceDir: string,
  name: string,
  input: unknown,
): Promise<string> {
  const rt = READ_TOOLS[name];
  if (rt) {
    try {
      return rt.run(workspaceDir, (input ?? {}) as Record<string, unknown>);
    } catch (err) {
      return 'ERROR: ' + (err instanceof Error ? err.message : String(err));
    }
  }
  if (name.startsWith('graphcode_')) {
    const tool = registry[name.slice('graphcode_'.length)];
    if (!tool) return 'ERROR: unknown tool ' + name;
    try {
      return jsonCapped(await tool.handler(input ?? {}));
    } catch (err) {
      return 'ERROR: ' + (err instanceof Error ? err.message : String(err));
    }
  }
  return 'ERROR: unknown tool ' + name;
}

/**
 * Backend-korrektes Anhängen der Tool-Results (+ optionales Gate-Feedback):
 * anthropic verlangt tool_result-Blöcke in der NÄCHSTEN User-Message — das
 * Feedback wandert dort als zusätzlicher Text-Block in dieselbe Message.
 */
export function pushToolResults(
  backend: ExecutorConfig['backend'],
  messages: unknown[],
  calls: ModelToolCall[],
  results: string[],
  feedback?: string,
): void {
  if (backend === 'anthropic') {
    const content: unknown[] = calls.map((c, i) => ({
      type: 'tool_result',
      tool_use_id: c.id,
      content: results[i],
    }));
    if (feedback) content.push({ type: 'text', text: feedback });
    messages.push({ role: 'user', content });
    return;
  }
  // openai/LM Studio: KEINE separate User-Message nach Tool-Results — Mistrals
  // Jinja-Template verlangt strikte Rollen-Alternierung und bricht sonst das
  // Rendering ("conversation roles must alternate", v3-Lauf-Befund). Das
  // Feedback wandert in den Content des letzten Tool-Results.
  calls.forEach((c, i) => {
    const content =
      feedback && i === calls.length - 1 ? results[i] + '\n\n' + feedback : results[i];
    messages.push({ role: 'tool', tool_call_id: c.id, content });
  });
}
