#!/usr/bin/env node
/**
 * run-code.mjs — der Code-Test (CR-GC-610, graphcode-Leitlinie §6, T-C1): dieselbe Aufgabe, zwei Arme.
 *
 *   gefuehrt — Claude Code MIT graphcode: das sigllm-Golden liegt im Store, die se-Skills sind da;
 *              der Agent baut die Scheduler-Scheibe aus dem Modell (graph_context, graph_realize,
 *              RC-Kongruenz) und darf das Modell durchs Gate anpassen.
 *   frei     — Claude Code OHNE graphcode: nur Auftrag, Aufgabe und Vertrag.
 * Beide: gleiches Modell (Opus 5), gleicher Text von aufgabe.md und vertrag/contract.ts, gleiche
 * Laufzeit-Obergrenze. Die verdeckte Abnahme sieht keiner (messen.mjs faehrt sie danach).
 *
 * Aufruf (von graphcode/):
 *   ARMS=gefuehrt,frei node rig/code-test/run-code.mjs            # voller Lauf (kostet)
 *   NUR_AUFBAU=1 ARMS=gefuehrt,frei node rig/code-test/run-code.mjs  # nur Arbeitsbereiche, kein Modell
 *   node rig/code-test/messen.mjs ~/.graphcode-code-test/runs/gefuehrt-0 ~/.graphcode-code-test/runs/frei-0
 *
 * @author andreas@siglochconsulting
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { isolateGit, claudeEnv } from '../greenfield-systemtest/run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GC_ROOT = resolve(HERE, '..', '..');
export const GOLDEN = join(GC_ROOT, 'rig', 'sigllm-spezifikation', 'golden', 'sigllm-v98.graph.json');
const AUFTRAG = join(GC_ROOT, 'rig', 'sigllm-spezifikation', 'material-prosa', 'auftrag.md');
/** Ausserhalb des Repos: unter rig/code-test/ saehe der Agent die verdeckte Abnahme und die Referenz im Elternverzeichnis. */
export const RUNS = process.env.RUNS_DIR ?? join(homedir(), '.graphcode-code-test', 'runs');
const CFG = {
  arms: (process.env.ARMS ?? '').split(',').filter(Boolean),
  run: Number(process.env.RUN ?? 0),
  model: process.env.FRONTIER_MODEL ?? 'claude-opus-5',
  timeoutMs: Number(process.env.RUN_TIMEOUT_S ?? 3600) * 1000,
  nurAufbau: process.env.NUR_AUFBAU === '1',
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
};

const GEMEINSAM = `Baue die Aufgabe aus ./aufgabe.md: ein TypeScript-Paket, das ./vertrag/contract.ts erfuellt
(src/index.ts exportiert createScheduler). Hintergrund ist ./material/auftrag.md. Schreibe eigene Tests
(npm test). Arbeite ohne Rueckfragen; wo etwas offen ist, triff eine begruendete Annahme und nenne sie
am Ende. Wenn du fertig bist: npm test gruen, alles committet.`;

const PROMPT = {
  frei: GEMEINSAM,
  gefuehrt: `${GEMEINSAM}

Das Systemmodell von SIG Local liegt im graphcode-Store (siehe GRAPHCODE.md). Die Scheibe ist MOD-scheduler
mit seinen FUNCs, Vertraegen und REQs. Arbeite modellgefuehrt: lies die Scheibe ueber graph_context, schneide
den Code entlang der FUNCs und SCHEMAs, binde jede FUNC und jedes SCHEMA mit graph_realize an ihren Code und
jeden TEST an seine Testdatei. Weicht die Aufgabe vom Modell ab (sie ist schmaler), passe das Modell durchs
Gate an statt am Modell vorbei zu bauen. Am Ende sagt graph_readiness zu den RC-Regeln kongruent — oder du
nennst, was bewusst offen bleibt. graph_export vor dem Commit — danach folgt nur noch der Commit; eine
Leseabfrage nach dem Export loest nichts mehr aus (CR-GC-612).`,
};

function paket(dir) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'sig-local-scheduler', version: '0.0.0', type: 'module', private: true,
    scripts: { test: 'vitest run', build: 'tsc --noEmit' },
    devDependencies: { typescript: '^5.6.0', vitest: '^3.2.0', '@types/node': '^22.0.0' },
  }, null, 2) + '\n');
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true },
    include: ['src', 'vertrag', 'test', 'tests'],
  }, null, 2) + '\n');
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir, stdio: 'pipe' });
}

/**
 * Rein: das Golden OHNE Code-Bindungen (CR-GC-611/610). Das sigllm-Golden traegt realRef/testRefs auf
 * sigllm-Dateien, die es hier nicht gibt. `graphcode init` materialisiert dafuer Platzhalter — und der
 * Arm startet mit 43 RC-Verstoessen, die nicht seine sind, baut auf Platzhalter-Vertraege und laeuft
 * ihretwegen Umwege (Lauf 0: zod nur wegen der Platzhalter). Die Scheibe soll vom Modell aus gebaut
 * werden, nicht von fremdem Code aus: Vorwaertsrichtung, kein Import.
 */
export function ohneCodeBindung(golden) {
  return {
    ...golden,
    elements: golden.elements.map((e) => {
      if (!e.attributes?.realRef && !e.attributes?.testRefs) return e;
      const { realRef, testRefs, ...rest } = e.attributes;
      return { ...e, attributes: rest };
    }),
  };
}

/** Das Golden ist die SSOT des Arbeitsbereichs (docs/graph/<name>.graph.json) — in den Store per graph_reseed. */
const SEED = `
const [dir] = process.argv.slice(1);
const { createHarness, bindToolsToHarness } = await import(${JSON.stringify(join(GC_ROOT, 'dist', 'index.js'))});
const label = dir.split('/').pop();
const h = await createHarness({ repoRoot: dir, scope: { workspaceId: label, systemId: label } });
await h.initialize();
const reg = bindToolsToHarness(h);
const r = await reg['graph_reseed'].handler({});
await reg['graph_export'].handler({});
await h.close();
process.stdout.write(JSON.stringify(r));
`;

export function aufbau(arm, dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'vertrag'), { recursive: true });
  mkdirSync(join(dir, 'material'), { recursive: true });
  copyFileSync(join(HERE, 'aufgabe.md'), join(dir, 'aufgabe.md'));
  copyFileSync(join(HERE, 'vertrag', 'contract.ts'), join(dir, 'vertrag', 'contract.ts'));
  copyFileSync(AUFTRAG, join(dir, 'material', 'auftrag.md'));
  if (arm === 'gefuehrt') {
    execFileSync('node', [join(GC_ROOT, 'dist', 'cli.js'), 'init'], { cwd: dir, stdio: 'pipe' });
    const mcpPath = join(dir, '.mcp.json');
    const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
    mcp.mcpServers.graphcode.command = 'node';
    mcp.mcpServers.graphcode.args = [join(GC_ROOT, 'dist', 'cli.js'), 'mcp'];
    writeFileSync(mcpPath, JSON.stringify(mcp, null, 2));
    mkdirSync(join(dir, 'docs', 'graph'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'graph', `${dir.split('/').pop()}.graph.json`), JSON.stringify(ohneCodeBindung(JSON.parse(readFileSync(GOLDEN, 'utf8'))), null, 2));
    const seeded = execFileSync('node', ['--input-type=module', '-e', SEED, dir], { encoding: 'utf8' });
    process.stderr.write(`  Golden im Store: ${seeded}\n`);
  }
  paket(dir);
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.graphcode/kuzu/\n');
  isolateGit(dir);
  execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.name=rig', '-c', 'user.email=rig@local', 'commit', '-qm', 'Ausgangsstand'], { cwd: dir, stdio: 'pipe' });
}

function fahre(arm, dir) {
  const t0 = Date.now();
  const r = spawnSync(CFG.claudeBin,
    ['-p', PROMPT[arm], '--output-format', 'stream-json', '--verbose', '--model', CFG.model, '--dangerously-skip-permissions'],
    { cwd: dir, env: claudeEnv({ local: false }), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: CFG.timeoutMs });
  writeFileSync(join(dir, 'claude-stream.jsonl'), r.stdout ?? '');
  if (r.stderr) writeFileSync(join(dir, 'claude-stderr.log'), r.stderr);
  const schluss = (r.stdout ?? '').split('\n').filter(Boolean).reverse()
    .map((z) => { try { return JSON.parse(z); } catch { return null; } }).find((e) => e?.type === 'result') ?? {};
  writeFileSync(join(dir, 'claude-raw.json'), JSON.stringify(schluss, null, 2));
  return { exit: r.status, wall_s: +((Date.now() - t0) / 1000).toFixed(1), cost_usd: schluss.total_cost_usd ?? null, turns: schluss.num_turns ?? null };
}

async function main() {
  if (!CFG.arms.length || CFG.arms.some((a) => !PROMPT[a])) {
    console.error('ARMS=gefuehrt,frei setzen (bewusst kein Default: ein Lauf kostet).');
    process.exit(2);
  }
  for (const arm of CFG.arms) {
    const dir = join(RUNS, `${arm}-${CFG.run}`);
    process.stderr.write(`[${arm}] Aufbau ${dir}\n`);
    aufbau(arm, dir);
    if (CFG.nurAufbau) continue;
    const u = fahre(arm, dir);
    writeFileSync(join(dir, 'usage.json'), JSON.stringify(u, null, 2) + '\n');
    process.stderr.write(`[${arm}] fertig: exit=${u.exit} $${u.cost_usd} ${u.turns} Turns ${u.wall_s}s\n`);
  }
  console.log(CFG.nurAufbau ? 'Aufbau fertig — kein Modell gefahren.' : `Fertig. Messen: node rig/code-test/messen.mjs ${RUNS}/<arm>-<n> …`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
