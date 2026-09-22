// Greenfield system test — Phase 1 authoring benchmark orchestrator.
//
// For each arm × N runs: fresh empty graphcode workspace, inject the ONE prompt,
// let the model DISCOVER the module capabilities itself (no curated brief — that
// would remove the challenge), author the architecture through the real MCP
// Apply-Gate, then export the graph + readiness and score against the held-out
// golden. Raw per-run rows → results.json; report.mjs makes the table.
//
// Two executors, deliberately (see SPIKE-GC-loop-executor-benchmark: `claude -p`
// @local overflows the heavy harness; opencode's lean harness is the viable local
// path). Local arm = opencode + LM Studio; frontier arm = claude -p + Opus. The
// "opencode vs Claude Code" difference is thus IN the test, not a hidden confound.
//
// @author andreas@siglochconsulting
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runMetrics } from './metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GC_ROOT = join(HERE, '..', '..');
const MCP_ARGS = [join(GC_ROOT, 'dist', 'cli.js'), 'mcp']; // local dist, not npx-published

/**
 * Geheimnisse aus `graphcode/.env` — GELESEN, nicht in `process.env` geladen.
 *
 * Der Unterschied traegt: jeder Arm erbt `process.env`. Stuende `ANTHROPIC_API_KEY` dort,
 * wechselte `claude -p` im `opus5`-Arm still vom Claude-Code-Login auf API-Abrechnung —
 * ein anderer Auth-Pfad als in jedem frueheren Lauf, und eine Rechnung, die niemand
 * bestellt hat. So bekommt den Wert nur der Arm, der ihn namentlich liest.
 * Die Datei ist gitignored; `.env.example` nennt die Schluessel ohne Werte.
 */
export function readSecrets(path) {
  return existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
}
const SECRETS = readSecrets(join(GC_ROOT, '.env'));

// --- CONFIG (edit before running; no silent fallbacks) --------------------------
export const CFG = {
  claudeBin: process.env.CLAUDE_BIN ?? 'claude',
  opencodeBin: process.env.OPENCODE_BIN ?? 'opencode',
  runs: Number(process.env.RUNS ?? 3),
  startRun: Number(process.env.START_RUN ?? 0), // first run index (parallelize by ranges)
  resultsFile: process.env.RESULTS_FILE ?? 'results.json',
  timeoutMs: Number(process.env.RUN_TIMEOUT_S ?? 1200) * 1000, // per-run cap; stuck run fails clean
  golden: process.env.GOLDEN
    ?? '/Users/andreas/Developer/dev/sigloch-modules/docs/graph/sigloch-modules.graph.json',
  /** Prueflliste der Auftrags-Anforderungen (CR-GC-553). Optional: ohne sie entfaellt der Abgleich. */
  checklist: process.env.CHECKLIST ?? null,
  /**
   * Rewind (CR-GC-597): statt nur des SYS die ersten `rewindMoves` angewandten Zuege aus einem
   * Audit-Trail durchs Gate nachspielen — gezielter Endspiel-Test fuer einen Bruchteil der Kosten.
   * Beide gesetzt oder keins; ein halber Rewind waere ein stiller Volllauf.
   */
  rewindAudit: process.env.REWIND_AUDIT ?? null,
  rewindMoves: process.env.REWIND_MOVES ? Number(process.env.REWIND_MOVES) : null,
  // The module repo the model may READ to DISCOVER capabilities itself. Not a
  // pre-digested brief — discovery is the challenge. node_modules excluded via prompt.
  material: process.env.MATERIAL ?? '/Users/andreas/Developer/dev/sigloch-modules',
  lmstudio: process.env.LMSTUDIO ?? 'http://192.168.78.89:1234',
  // Korpus-Parameter. Defaults = der graphcode-Webapp-Korpus, mit dem dieses
  // Rig gebaut wurde — gesetzt liefern sie einen ZWEITEN Korpus durch DENSELBEN Treiber
  // (rig/sigllm-spezifikation). Kein zweiter Pfad: eine Frage je Rig, ein Runner.
  promptFile: process.env.PROMPT_FILE ?? join(HERE, 'prompt.txt'),
  seed: {
    uid: process.env.SEED_UID ?? 'SYS-webapp',
    name: process.env.SEED_NAME ?? 'GraphCode Multiuser Web App',
    description: process.env.SEED_DESC
      ?? 'Multiuser-faehige Web-App aus dem graphcode harness (System aus dem Prompt).',
  },
  materialHint: process.env.MATERIAL_HINT
    ?? 'Das sigloch-module-Quellrepo liegt im Workspace unter ./material — entdecke die'
     + ' Fähigkeiten selbst aus dem Quellcode, es gibt keinen fertigen Überblick.'
     + ' Nur der Graph zählt, kein Code.',
  arms: [
    { label: 'qwen-35b', executor: 'opencode', model: process.env.LOCAL_MODEL ?? 'qwen3.6-35b-a3b-mlx' },
    { label: 'opus5', executor: 'claude', model: process.env.FRONTIER_MODEL ?? 'claude-opus-5' },
    // Reasoning-Modell im FRONTIER-Harness statt im Emissions-Treiber. These
    // (executor-abschlussbericht.md, "zwei überraschende Befunde" Punkt 1): das enge
    // Emissions-Regime hilft kleinen Modellen und BESCHNEIDET denkende — es nimmt ihnen
    // erst-explorieren-dann-bauen. qwen3.8 denkt, also gehört es auf die Opus-Seite
    // dieser Trennlinie. Voraussetzung ist erst jetzt erfüllt: der `claude -p`-Harness
    // sprengte 2026-06 noch das lokale Fenster (SPIKE-GC-loop-executor-benchmark: @22k
    // Overflow, @40k lauffähig) — qwen3.8 lädt mit 119k Kontext.
    { label: 'qwen38-claude', executor: 'claude', local: true,
      model: process.env.LOCAL_CLAUDE_MODEL ?? 'qwen3.8-27b-mlx@4bit' },
    // DRITTER EXECUTOR (CR-GC-555): `graphcode run` statt eines fremden Agenten am
    // MCP-Server. Nur dieser Arm faehrt die Steuerungsmaschinerie — Rundenprompt aus
    // graph_generate, kuratiertes Toolset, Gate-Rueckkanal mit Reparatur, Preflight.
    // Die beiden Arme darueber messen einen Agenten, der zufaellig dieselben Werkzeuge hat.
    { label: 'gcrun', executor: 'gcrun',
      model: process.env.GCRUN_MODEL ?? 'qwen3-coder-30b-lms:latest',
      backend: process.env.GCRUN_BACKEND ?? 'openai',
      baseUrl: process.env.GCRUN_BASE_URL ?? 'http://127.0.0.1:11434',
      apiKey: process.env.GCRUN_API_KEY ?? 'ollama',
      maxTokens: process.env.GCRUN_MAX_TOKENS ?? '4096',
      maxRounds: process.env.GCRUN_MAX_ROUNDS ?? '8',
      // Best-of-N: >1 schaltet den dryRun-Kanal ein (CR-GC-568). Default 1 = der
      // Ein-Kandidaten-Pfad, der nicht probt — drei Laeufe lang gemessene Null.
      candidates: process.env.GCRUN_CANDIDATES ?? '1' },
    // VIERTER ARM (CR-GC-572): derselbe Treiber wie `gcrun`, aber am Frontier-Modell.
    //
    // Die Belegung der Betriebsmodi hatte ein leeres Feld: Mensch-treibt gab es lokal
    // UND frontier, Executor-treibt nur lokal. `opus5` gegen `gcrun` variierte deshalb
    // DREI Achsen zugleich (Treiber, Agent, Modell) — jede Aussage dieser Messreihe
    // ueber "die Steuerung" war dreifach konfundiert, und das war der Grund fuer zwoelf
    // Laeufe im Kreis. Gegen `opus5` unterscheidet sich dieser Arm in genau EINER Achse:
    // wer die Schleife treibt.
    //
    // Der Key ist die Leitung, nicht der Unterschied: `claude -p` ist ein AGENT (eigener
    // System-Prompt, Kontext-Management, Kompaktierung, Skills), der Executor ist UNSERE
    // Schleife (Rundenprompt aus graph_generate, kuratiertes Toolset, vorenthaltene
    // Werkzeuge, Preflight, Gate-Reparatur). Gleiches Modell, gleiche MCP-Werkzeuge,
    // andere Schleife.
    //
    // KOSTEN-RIEGEL: ~9 $/Lauf (Erfahrungswert `opus5`). Deshalb `optIn` — der Arm
    // faehrt NUR, wenn ARMS ihn namentlich nennt. Ein versehentliches `node run.mjs`
    // ohne ARMS darf keine Rechnung erzeugen. `maxRounds`/`maxStepTurns` begrenzen
    // zusaetzlich; ein Ausreisser kostet kein Vielfaches.
    { label: 'gcrun-frontier', executor: 'gcrun', optIn: true,
      model: process.env.GCRUN_FRONTIER_MODEL ?? 'claude-opus-5',
      backend: 'anthropic',
      baseUrl: process.env.GCRUN_FRONTIER_BASE_URL ?? 'https://api.anthropic.com',
      // Umgebung vor `.env` — dieselbe Rangfolge wie Nodes eigenes `--env-file`.
      apiKey: process.env.ANTHROPIC_API_KEY ?? SECRETS.ANTHROPIC_API_KEY ?? '',
      // 32000, nicht die 4096 des lokalen Arms: Opus 5 denkt, und das Denken zaehlt gegen
      // max_tokens. Mit 4096 gemessen (runde7, sigllm-Korpus): 38 von 45 Mutate-Turns am
      // Budget abgeschnitten, alle 38 als INPUT-SCHEMA abgelehnt — die leere Eingabe eines
      // gekappten Aufrufs. 32000 laesst Denken plus einen vollen Batch zu. Welches Budget
      // Claude Code im `opus5`-Arm setzt, ist NICHT geprueft — eine offene Achse im Vergleich.
      maxTokens: process.env.GCRUN_FRONTIER_MAX_TOKENS ?? '32000',
      maxRounds: process.env.GCRUN_FRONTIER_MAX_ROUNDS ?? '8',
      candidates: process.env.GCRUN_FRONTIER_CANDIDATES ?? '1' },
  ],
};

/**
 * Die vier Achsen, an denen sich ein Arm unterscheidet (CR-GC-572).
 *
 * Steht hier und nicht im Bericht, weil der Bericht sie nur ANZEIGT: wer einen Arm
 * hinzufuegt, traegt seine Achsen hier ein, und der Vergleich bleibt lesbar. Ohne diese
 * Tabelle nennt kein Bericht die Achse, in der sich zwei Arme unterscheiden — und genau
 * das fehlte, als zwoelf Laeufe lang an einem dreifach konfundierten Proxy optimiert wurde.
 */
export const ARM_ACHSEN = {
  'qwen-35b':      { treiber: 'Agent',    modell: 'lokal',    agent: 'opencode' },
  'opus5':         { treiber: 'Agent',    modell: 'frontier', agent: 'claude-code' },
  'qwen38-claude': { treiber: 'Agent',    modell: 'lokal',    agent: 'claude-code' },
  'gcrun':         { treiber: 'Executor', modell: 'lokal',    agent: null },
  'gcrun-frontier':{ treiber: 'Executor', modell: 'frontier', agent: null },
};

/**
 * `agent: null` heisst ENTFAELLT, nicht "unbekannt" — und die Unterscheidung traegt.
 *
 * Treibt der Executor, gibt es keinen fremden Agenten; seine Abwesenheit IST die
 * Treiber-Differenz und keine zweite Variable daneben. Wer sie als eigene Achse mitzaehlt,
 * bekommt fuer `opus5` gegen `gcrun-frontier` zwei Unterschiede statt einem und haette
 * damit genau den Vergleich zerredet, fuer den dieser Arm gebaut wurde. Unter den
 * agent-getriebenen Armen ist der Agent sehr wohl eine Achse: `qwen-35b` (opencode) gegen
 * `qwen38-claude` (claude-code).
 */
export function achsenUnterschied(a, b) {
  const x = ARM_ACHSEN[a];
  const y = ARM_ACHSEN[b];
  if (!x || !y) return null;
  return ['treiber', 'modell', 'agent'].filter(
    (k) => x[k] != null && y[k] != null && x[k] !== y[k],
  );
}

/**
 * Der Auftragstext fuer den `claude -p`-Arm (CR-GC-565).
 *
 * Das ist woertlich der Einstieg, den `GRAPHCODE-STEERING.md` dem Menschen vorgibt — das
 * Dokument, das das Scaffold in jeden Workspace legt. Vorher stand hier eine selbst
 * erfundene Werkzeugfolge (graph_generate, graph_mutate, graph_authoring_guide in dieser
 * Reihenfolge). Zwei Schaeden: das Rig mass einen Prompt, den kein Kunde je schreibt, und
 * der gcrun-Arm bekam diese Hilfe nicht — ein eingebauter Unterschied in jedem
 * Arm-Vergleich. Die Methode gehoert dem Produkt: GRAPHCODE.md und der Skill.
 */
function buildPrompt() {
  return `Read GRAPHCODE.md, then \`se:generate\`: "${readFileSync(CFG.promptFile, 'utf8').trim()}"`
    + `\n\n${CFG.seed.uid} existiert bereits im Graphen (das System aus dem Auftrag).`
    + `\n${CFG.materialHint}`;
}

/**
 * Der Auftragstext fuer `graphcode run` (CR-GC-555).
 *
 * BEWUSST NICHT `buildPrompt()`: der nennt `GRAPHCODE.md` und den Skill `se:generate`, also
 * den Einstieg des Claude-Code-Harness. `graphcode run` liest weder das eine noch das andere
 * — der Loop baut seine Rundenprompts selbst aus `graph_generate` (dem Modell vorenthalten)
 * und traegt die Methode im SYSTEM-Prompt. Hier steht deshalb nur das ZIEL und wo das
 * Material liegt; das Wie gehoert dem Loop.
 */
function buildIntent() {
  return readFileSync(CFG.promptFile, 'utf8').trim()
    + `\n\n${CFG.seed.uid} existiert bereits im Graphen. Baue die Architektur darauf auf.`
    + `\n${CFG.materialHint}`;
}

// graphcode enforces single-writer via .graphcode/owner.lock. Our orchestrator opens
// the store to seed, then hands off to the executor's MCP server — but the lock file
// outlives our in-process harness.close() while run.mjs stays alive, so the executor
// sees the store as "owned" and fast-exits. We drive the store strictly sequentially
// (seed → executor → capture, never concurrent), so releasing the lock between steps
// is safe and is exactly what the StoreOwnershipError message advises.
function releaseStore(dir) {
  for (const f of ['owner.lock', 'host.sock']) rmSync(join(dir, '.graphcode', f), { force: true });
}

function initWorkspace(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // graphcode init scaffolds .mcp.json + opencode.json into cwd → run INSIDE workspace.
  execFileSync('node', [join(GC_ROOT, 'dist', 'cli.js'), 'init'], { cwd: dir, stdio: 'pipe' });
  // Copy the module SOURCE into the workspace so the executor's sandbox may read it
  // (opencode blocks external-dir reads even with --dangerously-skip-permissions).
  // Exclude noise (node_modules/dist/.git) AND the golden graph (docs/graph) — the
  // golden must never be visible to the model, only used for scoring.
  // Exclude .graphcode too: it holds the LIVE Kuzu store (~100M) which both drowns
  // the executor's file index AND leaks the golden graph data.
  execFileSync('rsync', ['-a', '--exclude', 'node_modules', '--exclude', 'dist',
    '--exclude', '.git', '--exclude', 'docs/graph', '--exclude', '.graphcode',
    `${CFG.material}/`, join(dir, 'material') + '/'],
    { stdio: 'pipe' });
  isolateGit(dir);
}

/**
 * Der Arbeitsbereich wird ein eigenes Git-Repo (CR-GC-580).
 *
 * Er liegt unter `graphcode/rig/.../runs/`. Ohne eigenes `.git` loest jedes `git` des Agenten
 * zum graphcode-Repo auf: in Runde 7 committete `claude -p` (Berechtigungen uebersprungen)
 * per `git add -A` fremde Dateien ins Produkt-Repo und setzte selbst zurueck. Beim Kunden ist
 * der Arbeitsbereich immer ein Repo — das Rig bildet das jetzt ab. Bewusst NACH `graphcode init`:
 * so installiert init keine Hooks, und die Laufbedingungen bleiben mit Runde 1–7 vergleichbar.
 */
export function isolateGit(dir) {
  execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'pipe' });
}

/**
 * Die Umgebung fuer `claude -p`. Frontier faehrt nativ ueber den Claude-Code-Login, lokal
 * ueber LM Studios Anthropic-Endpunkt. `ANTHROPIC_API_KEY` faellt in BEIDEN Faellen weg:
 * exportiert in der Shell, schaltete er `opus5` sonst still auf API-Abrechnung um —
 * ein anderer Auth-Pfad als in jedem frueheren Lauf dieses Arms.
 */
export function claudeEnv(arm, env = process.env) {
  const baseEnv = { ...env };
  delete baseEnv.ANTHROPIC_API_KEY;
  if (arm.local) {
    // Lokaler Arm im Claude-Code-Harness: LM Studio bedient ein Anthropic-kompatibles
    // /v1/messages inkl. tool_use (verifiziert), also treibt `claude -p` das lokale Modell.
    baseEnv.ANTHROPIC_BASE_URL = CFG.lmstudio;
    baseEnv.ANTHROPIC_AUTH_TOKEN = 'lmstudio-local';
  } else {
    delete baseEnv.ANTHROPIC_BASE_URL; delete baseEnv.ANTHROPIC_AUTH_TOKEN; // frontier = native
  }
  return baseEnv;
}

// Claude Code path (frontier): .mcp.json → repoint at local dist; claude -p JSON out.
function authorViaClaude(dir, arm) {
  const mcpPath = join(dir, '.mcp.json');
  const mcp = JSON.parse(readFileSync(mcpPath, 'utf8'));
  mcp.mcpServers.graphcode.command = 'node';
  mcp.mcpServers.graphcode.args = MCP_ARGS;
  writeFileSync(mcpPath, JSON.stringify(mcp, null, 2));
  const baseEnv = claudeEnv(arm);
  const t0 = Date.now();
  const r = spawnSync(
    CFG.claudeBin,
    // acceptEdits does NOT grant MCP tool calls → graphcode tools get denied; skip all
    // permissions (throwaway sandbox), symmetric with opencode's --dangerously-skip-permissions.
    // CR-GC-567: `stream-json` statt `json`. `json` liefert EINE Usage-Zeile je Lauf —
    // damit ist nicht zu trennen, welche Werkzeugantwort den Cache entwertet. Gemessen:
    // der Rewind schrieb bei halber Turn-Zahl 70 % mehr cache_creation als die Erstsitzung,
    // und cache_creation ist der teure Posten (~15x cache_read). `--verbose` ist in
    // `-p`-Laeufen Pflicht fuer stream-json. Die Schlusszeile bleibt dasselbe result-Objekt.
    ['-p', buildPrompt(), '--output-format', 'stream-json', '--verbose',
     '--model', arm.model, '--dangerously-skip-permissions'],
    { cwd: dir, env: baseEnv, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: CFG.timeoutMs },
  );
  const wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  const out = r.stdout ?? '';
  // Der ganze Strom bleibt liegen — `turn-analyse.mjs` liest ihn je Turn (CR-GC-567).
  writeFileSync(join(dir, 'claude-stream.jsonl'), out);
  // Die Schlusszeile ist dasselbe Objekt, das `--output-format json` geliefert haette.
  // Sie bleibt unter dem alten Namen liegen, damit bestehende Auswertungen weiterlesen.
  const schluss = out.split('\n').map((z) => z.trim()).filter(Boolean).reverse()
    .map((z) => { try { return JSON.parse(z); } catch { return null; } })
    .find((e) => e && e.type === 'result');
  writeFileSync(join(dir, 'claude-raw.json'), JSON.stringify(schluss ?? {}, null, 2));
  if (r.stderr) writeFileSync(join(dir, 'claude-stderr.log'), r.stderr);
  if (r.status !== 0) throw new Error(`claude exit=${r.status} signal=${r.signal}; stderr: ${(r.stderr ?? '').slice(-600)}`);
  let usage = { wall_s };
  try {
    const j = schluss ?? {};
    const u = j.usage ?? {};
    // ITEM-2026-365: `input_tokens` zaehlt NUR den ungecachten Rest. Gemessen an Lauf 2:
    // 8.822 gemeldet gegen 7.056.849 tatsaechlich — Faktor 800. Ohne cache_read und
    // cache_creation sieht der Frontier-Arm sparsamer aus als der lokale, obwohl er das
    // Zwanzigfache liest. Die Aufschluesselung bleibt daneben stehen, weil gecachte und
    // frische Eingabe verschieden viel kosten.
    const cacheRead = u.cache_read_input_tokens ?? 0;
    const cacheNeu = u.cache_creation_input_tokens ?? 0;
    usage = {
      wall_s, cost_usd: j.total_cost_usd ?? 0,
      tokens_in: (u.input_tokens ?? 0) + cacheRead + cacheNeu,
      tokens_in_uncached: u.input_tokens ?? null,
      tokens_in_cache_read: cacheRead,
      tokens_in_cache_creation: cacheNeu,
      tokens_out: u.output_tokens ?? null,
      tokens_reasoning: u.output_tokens_details?.reasoning_tokens ?? null,
      turns: j.num_turns ?? null,
    };
  } catch { /* raw saved */ }
  return usage;
}

// opencode path (local, lean harness): write opencode.json (lmstudio + graphcode MCP),
// then `opencode run --format json`. Usage shape is captured raw and parsed defensively.
function authorViaOpencode(dir, arm) {
  const cfg = {
    $schema: 'https://opencode.ai/config.json',
    provider: {
      lmstudio: {
        npm: '@ai-sdk/openai-compatible',
        name: 'LM Studio (local)',
        options: { baseURL: `${CFG.lmstudio}/v1` },
        models: { [arm.model]: { name: arm.model } },
      },
    },
    mcp: { graphcode: { type: 'local', command: ['node', ...MCP_ARGS], enabled: true } },
    permission: { edit: 'allow', bash: 'allow', webfetch: 'deny' },
    model: `lmstudio/${arm.model}`,
  };
  writeFileSync(join(dir, 'opencode.json'), JSON.stringify(cfg, null, 2));
  const t0 = Date.now();
  const r = spawnSync(
    CFG.opencodeBin,
    ['run', buildPrompt(), '-m', `lmstudio/${arm.model}`, '--format', 'json', '--dangerously-skip-permissions'],
    { cwd: dir, env: process.env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: CFG.timeoutMs },
  );
  const wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  const out = r.stdout ?? '';
  writeFileSync(join(dir, 'opencode-raw.json'), out);
  if (r.stderr) writeFileSync(join(dir, 'opencode-stderr.log'), r.stderr);
  // opencode may exit non-zero yet still have authored through the gate — don't throw;
  // record the exit and let metrics read whatever landed in the store.
  if (r.status !== 0) writeFileSync(join(dir, 'opencode-exit.txt'), `status=${r.status} signal=${r.signal}`);
  // opencode emits newline-delimited events; sum tokens across all `step-finish`
  // events ({part:{tokens:{input,output,reasoning}, cost}}).
  let tokens_in = 0, tokens_out = 0, tokens_reasoning = 0, cost_usd = 0, seen = false;
  for (const line of out.split('\n')) {
    try {
      const ev = JSON.parse(line);
      const t = ev.part?.tokens;
      if (t) { seen = true; tokens_in += t.input ?? 0; tokens_out += t.output ?? 0; tokens_reasoning += t.reasoning ?? 0; }
      if (ev.part?.cost != null) cost_usd += ev.part.cost;
    } catch { /* not a json line */ }
  }
  return { wall_s, cost_usd, tokens_in: seen ? tokens_in : null,
    tokens_out: seen ? tokens_out : null, tokens_reasoning: seen ? tokens_reasoning : null };
}

// Seed the ONE frame the human decides: the SYS from the prompt. On an empty graph
// next_step returns null (nothing to advise); with a SYS it points at "add use cases",
// giving the model the scaffold small models need. Identical for both arms → fair.
//
// MUST run in a SEPARATE process: createHarness loads Kuzu's native binding, which
// holds an OS-level lock on the store file that h.close() does NOT release while the
// parent process lives — the executor's MCP child would then fail to open the store.
// A subprocess releases every handle on exit, handing the executor a clean store.
/**
 * `graphcode run` als Executor (CR-GC-555) — der EINZIGE Arm, der den Loop faehrt.
 *
 * Der Loop waehlt die Store-Election selbst, genau wie `graphcode mcp`; deshalb gilt
 * dasselbe releaseStore davor wie bei den anderen Armen. Die Zahlen kommen aus dem
 * `graphcode run:`-Statistikblock am Ende von stderr — gemessen, nicht geschaetzt. Kosten
 * sind 0: lokale Modelle kosten Rechenzeit, kein Geld, und eine erfundene Zahl waere
 * schlimmer als keine.
 */
function authorViaGraphcodeRun(dir, arm) {
  const env = {
    ...process.env,
    GRAPHCODE_LLM_BACKEND: arm.backend,
    GRAPHCODE_LLM_BASE_URL: arm.baseUrl,
    GRAPHCODE_LLM_MODEL: arm.model,
    GRAPHCODE_LLM_API_KEY: arm.apiKey,
    GRAPHCODE_LLM_MAX_TOKENS: String(arm.maxTokens),
    GRAPHCODE_LLM_MAX_ROUNDS: String(arm.maxRounds),
    GRAPHCODE_LLM_CANDIDATES: String(arm.candidates),
    GRAPHCODE_LLM_TIMEOUT_MS: String(CFG.timeoutMs),
  };
  const t0 = Date.now();
  const r = spawnSync('node', [join(GC_ROOT, 'dist', 'cli.js'), 'run', buildIntent()], {
    cwd: dir, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: CFG.timeoutMs,
  });
  const wall_s = +((Date.now() - t0) / 1000).toFixed(1);
  // stdout bleibt fuer MCP-Transporte reserviert — der Loop meldet ALLES auf stderr.
  const log = (r.stderr ?? '') + (r.stdout ?? '');
  writeFileSync(join(dir, 'run-raw.log'), log);
  if (r.status !== 0) {
    throw new Error(`graphcode run exit=${r.status} signal=${r.signal}; ${log.slice(-600)}`);
  }
  let stats = {};
  const m = log.lastIndexOf('graphcode run: {');
  if (m >= 0) {
    try { stats = JSON.parse(log.slice(log.indexOf('{', m))); } catch { /* raw gesichert */ }
  }
  return {
    wall_s,
    cost_usd: 0,
    tokens_in: stats.tokensIn ?? null,
    tokens_out: stats.tokensOut ?? null,
    tokens_reasoning: stats.tokensReasoning ?? null,
    // Die Loop-Kennzahlen, die es NUR auf diesem Arm gibt — der eigentliche Grund fuer ihn.
    loop: {
      genRounds: stats.genRounds ?? null,
      modelTurns: stats.modelTurns ?? null,
      mutatesApplied: stats.mutatesApplied ?? null,
      mutatesRejected: stats.mutatesRejected ?? null,
      repairedAfterRejection: stats.repairedAfterRejection ?? null,
      preflightFixed: stats.preflightFixed ?? null,
      preflightBlocked: stats.preflightBlocked ?? null,
      dryRunProbes: stats.dryRunProbes ?? null,
      done: stats.done ?? null,
    },
  };
}

const SEED_SCRIPT = `
const dir = process.argv[1];
const label = dir.split('/').pop();
const { createHarness } = await import(${JSON.stringify(join(GC_ROOT, 'dist', 'index.js'))});
const { bindToolsToHarness } = await import(${JSON.stringify(join(GC_ROOT, 'dist', 'index.js'))});
const h = await createHarness({ repoRoot: dir, scope: { workspaceId: label, systemId: label } });
await h.initialize();
const reg = bindToolsToHarness(h);
await reg['graph_mutate'].handler({ commands: [{ op: 'add-node', node: {
  uid: process.argv[2], type: 'SYS', name: process.argv[3],
  description: process.argv[4], attributes: {},
} }] });
await h.close();
`;
/**
 * Die ersten `n` angewandten Zuege eines Audit-Trails als Kommando-Batches (CR-GC-597). Rein —
 * dieselbe Lesart wie `trajektorie.spieleNach` (nur `mutate` + `applied` + Kommandos zaehlt).
 */
export function ersteZuege(auditPfad, n) {
  const batches = [];
  for (const zeile of readFileSync(auditPfad, 'utf8').split('\n')) {
    if (!zeile.trim() || batches.length >= n) continue;
    const r = JSON.parse(zeile);
    if (r.operation === 'mutate' && r.result === 'applied' && r.commands?.length) batches.push(r.commands);
  }
  if (batches.length < n) throw new Error(`Rewind: der Trail hat nur ${batches.length} angewandte Zuege, verlangt ${n}.`);
  return batches;
}

const REWIND_SCRIPT = `
const [dir, batchesPath] = process.argv.slice(1);
const label = dir.split('/').pop();
const { readFileSync } = await import('node:fs');
const { createHarness, bindToolsToHarness } = await import(${JSON.stringify(join(GC_ROOT, 'dist', 'index.js'))});
const h = await createHarness({ repoRoot: dir, scope: { workspaceId: label, systemId: label } });
await h.initialize();
const reg = bindToolsToHarness(h);
let i = 0;
for (const commands of JSON.parse(readFileSync(batchesPath, 'utf8'))) {
  const r = await reg['graph_mutate'].handler({ commands, consumerId: 'rewind' });
  i++;
  if (!r.success) { process.stderr.write('Rewind-Zug ' + i + ' vom heutigen Gate abgelehnt: ' + JSON.stringify(r.violations).slice(0, 300) + '\\n'); process.exit(3); }
}
await reg['graph_export'].handler({});
await h.close();
`;
/** Den Arbeitsbereich auf den Stand nach `n` Zuegen eines frueheren Laufs bringen — durchs Gate. */
function seedFromAudit(dir) {
  const batches = ersteZuege(CFG.rewindAudit, CFG.rewindMoves);
  const pfad = join(dir, '.graphcode', 'rewind-batches.json');
  writeFileSync(pfad, JSON.stringify(batches));
  execFileSync('node', ['--input-type=module', '-e', REWIND_SCRIPT, dir, pfad], { stdio: 'pipe' });
}

function seedSystem(dir) {
  execFileSync('node', ['--input-type=module', '-e', SEED_SCRIPT,
    dir, CFG.seed.uid, CFG.seed.name, CFG.seed.description], { stdio: 'pipe' });
}

async function captureArtifacts(dir) {
  const { createHarness } = await import(join(GC_ROOT, 'dist', 'index.js'));
  const { bindToolsToHarness } = await import(join(GC_ROOT, 'dist', 'index.js'));
  const label = dir.split('/').pop();
  const h = await createHarness({ repoRoot: dir, scope: { workspaceId: label, systemId: label } });
  await h.initialize();
  const reg = bindToolsToHarness(h);
  // graph_export writes the committable {elements,traces} to graphJson.path (relative
  // to the workspace); it returns metadata, not the graph. Read the written file.
  const exported = await reg['graph_export'].handler({});
  const exportPath = join(dir, exported.graphJson?.path ?? `docs/graph/${label}.graph.json`);
  cpSync(exportPath, join(dir, 'graph.json'));
  const rd = await reg['graph_readiness'].handler({});
  writeFileSync(join(dir, 'readiness.json'), JSON.stringify(rd, null, 2));
  await h.close();
  const audit = join(dir, '.graphcode', 'audit.jsonl');
  if (existsSync(audit)) cpSync(audit, join(dir, 'audit.jsonl'));
}

async function main() {
  const outDir = join(HERE, 'runs');
  mkdirSync(outDir, { recursive: true });
  const only = process.env.ARMS ? new Set(process.env.ARMS.split(',')) : null;
  // optIn-Arme kosten Geld (CR-GC-572) und fahren nur auf namentliche Nennung.
  const arms = only ? CFG.arms.filter((a) => only.has(a.label)) : CFG.arms.filter((a) => !a.optIn);
  for (const arm of arms) {
    if (arm.optIn && !arm.apiKey) {
      throw new Error(
        `Arm ${arm.label} braucht ANTHROPIC_API_KEY — in graphcode/.env (gitignored, s. .env.example) oder der Umgebung.`,
      );
    }
  }
  const results = [];
  for (const arm of arms) {
    for (let i = CFG.startRun; i < CFG.startRun + CFG.runs; i++) {
      const dir = join(outDir, `${arm.label}-${i}`);
      process.stderr.write(`\n[${arm.label}/${arm.executor}] run ${i + 1}/${CFG.runs} — ${arm.model}\n`);
      try {
        initWorkspace(dir);
        if ((CFG.rewindAudit === null) !== (CFG.rewindMoves === null)) {
          throw new Error('REWIND_AUDIT und REWIND_MOVES nur zusammen — ein halber Rewind waere ein stiller Volllauf.');
        }
        if (CFG.rewindAudit) seedFromAudit(dir); // CR-GC-597: Stand nach n Zuegen eines frueheren Laufs
        else seedSystem(dir);  // seed SYS (subprocess) so next_step gives direction
        releaseStore(dir);     // free any lock so the executor's MCP can own the store
        const usage =
          arm.executor === 'opencode' ? authorViaOpencode(dir, arm)
          : arm.executor === 'gcrun' ? authorViaGraphcodeRun(dir, arm)
          : authorViaClaude(dir, arm);
        releaseStore(dir);     // executor's MCP may leave a lock (esp. on timeout kill)
        writeFileSync(join(dir, 'usage.json'), JSON.stringify(usage, null, 2));
        await captureArtifacts(dir);
        const m = runMetrics({
          graphPath: join(dir, 'graph.json'), readinessPath: join(dir, 'readiness.json'),
          auditPath: join(dir, 'audit.jsonl'), goldenPath: CFG.golden,
          checklistPath: CFG.checklist, usage,
        });
        results.push({ arm: arm.label, model: arm.model, executor: arm.executor, run: i, ...m });
        process.stderr.write(
          `  elements=${m.elements} compliance=${m.readiness.compliance ?? '?'} `
          + `gates=${m.readiness.gatesPassed ?? '?'} rejections=${m.gate_rejections} `
          + `tok=${usage.tokens_in}/${usage.tokens_out} $${usage.cost_usd ?? 0} ${usage.wall_s}s\n`,
        );
      } catch (err) {
        // Surface the executor's real stderr (execFileSync buries it on non-zero exit).
        const stderr = (err.stderr ?? '').toString().slice(-1500);
        if (stderr) writeFileSync(join(dir, 'error.log'), (err.stdout ?? '').toString() + '\n---STDERR---\n' + stderr);
        process.stderr.write(`  FAILED: ${err.message}\n${stderr ? '  stderr: ' + stderr.slice(-400) + '\n' : ''}`);
        results.push({ arm: arm.label, model: arm.model, executor: arm.executor, run: i, error: (stderr || err.message).slice(-500) });
      }
      writeFileSync(join(HERE, CFG.resultsFile), JSON.stringify(results, null, 2));
    }
  }
  process.stderr.write(`\nDone. ${results.length} rows → ${CFG.resultsFile}. Run: node report.mjs\n`);
}

// Nur als Programm fahren, nie beim Import (CR-GC-572): `report.mjs` liest ARM_ACHSEN
// aus dieser Datei — ein Import darf keinen Benchmark starten.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  main().catch((e) => { process.stderr.write(`fatal: ${e.stack}\n`); process.exit(1); });
}
