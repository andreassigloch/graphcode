/**
 * init-verb.ts — das Verb `graphcode init` fuer Menschen (CR-GC-900, FUNC-init-verb).
 *
 * `scaffold('init')` schreibt die Artefakte und traegt `@sigloch/graphcode` in `package.json` ein.
 * Die Host-Konfigurationen starten graphcode aus `node_modules` — ohne Installation startet der
 * Server nicht. Dieses Verb installiert deshalb gleich mit und sagt dem Menschen danach, was er
 * noch selbst tun muss. Das Ergebnis als JSON gibt es nur noch mit `--json`.
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { scaffold, type InstallResult } from './scaffold.js';
import { GUARDRAILS_FILE, STEERING_FILE } from './scaffold-templates.js';

export type Run = (cmd: string, args: string[], cwd: string) => { status: number; stdout: string; stderr: string };
/** Liegt ein Programm dieses Namens im PATH? */
export type OnPath = (program: string) => boolean;

/** Die Agent-Programme, die die geschriebenen Host-Konfigurationen lesen, mit ihrem Installationsbefehl. */
export const AGENT_HOSTS = [
  { program: 'claude', name: 'Claude Code', install: 'npm install -g @anthropic-ai/claude-code' },
  { program: 'opencode', name: 'OpenCode', install: 'npm install -g opencode-ai' },
] as const;

export interface InitReport {
  result: InstallResult;
  /** Der Installationsbefehl, wie ihn der Mensch selbst eingeben wuerde. */
  installCommand: string;
  installOk: boolean;
  installError: string;
  /** Die Agent-Programme, die im PATH liegen (CR-GC-902). */
  agentHosts: string[];
}

function defaultRun(cmd: string, args: string[], cwd: string): ReturnType<Run> {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: false });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? (r.error?.message ?? '') };
}

function defaultOnPath(program: string): boolean {
  const names = process.platform === 'win32' ? [`${program}.cmd`, `${program}.exe`] : [program];
  return (process.env.PATH ?? '').split(delimiter).some((dir) => dir !== '' && names.some((n) => existsSync(join(dir, n))));
}

/** Der Paketmanager folgt der Lockdatei des Repos; ohne Lockdatei npm. */
export function packageManager(repoRoot: string): 'pnpm' | 'yarn' | 'npm' {
  if (existsSync(join(repoRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(repoRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/** Scaffold, dann die eingetragene Abhaengigkeit installieren. */
export async function executeInit(opts: { repoRoot: string }, deps: { run?: Run; onPath?: OnPath } = {}): Promise<InitReport> {
  const run = deps.run ?? defaultRun;
  const onPath = deps.onPath ?? defaultOnPath;
  const result = await scaffold('init', { repoRoot: opts.repoRoot });
  const pm = packageManager(opts.repoRoot);
  const r = run(pm, ['install'], opts.repoRoot);
  return {
    result,
    installCommand: `${pm} install`,
    installOk: r.status === 0,
    installError: r.status === 0 ? '' : (r.stderr.trim() || r.stdout.trim()),
    agentHosts: AGENT_HOSTS.filter((h) => onPath(h.program)).map((h) => h.program),
  };
}

/** Der Bericht fuer Menschen: was geschah, und was der Mensch jetzt noch tut. */
export function formatInit(report: InitReport): string {
  const { result } = report;
  const written = result.created.length + result.updated.length;
  const lines = [
    `graphcode init: ${written} files written, ${result.preserved.length} unchanged (${result.repoRoot}).`,
  ];
  if (!report.installOk) {
    lines.push(
      `Install failed: \`${report.installCommand}\`.`,
      report.installError,
      `Run \`${report.installCommand}\` yourself — without it the graphcode server does not start.`,
    );
    return lines.join('\n') + '\n';
  }
  lines.push(`Installed @sigloch/graphcode (\`${report.installCommand}\`).`, '', 'Next steps:');
  lines.push('  1. Add `.graphcode/` to .gitignore — it holds the local graph store.');
  const found = AGENT_HOSTS.filter((h) => report.agentHosts.includes(h.program));
  if (found.length === 0) {
    lines.push(
      '  2. No agent host found on PATH. graphcode has no interface of its own; it needs one of these:',
      ...AGENT_HOSTS.map((h) => `       ${h.name}: ${h.install}`),
      '     Using Claude Code in VS Code or the desktop app? Those often put no `claude` on PATH —',
      '     open this folder there.',
      '  3. Then say this to your agent:',
    );
  } else {
    lines.push(
      `  2. Reload your agent host (found: ${found.map((h) => h.name).join(', ')}). Claude Code reads .mcp.json, OpenCode reads opencode.json.`,
      '  3. Say this to your agent:',
    );
  }
  lines.push(
    `       Read ${GUARDRAILS_FILE}, then call graph_readiness — where does the project stand, and what is the next step?`,
    `  4. Read ${STEERING_FILE}: the decisions only you make.`,
  );
  return lines.join('\n') + '\n';
}
