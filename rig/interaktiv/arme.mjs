/**
 * arme.mjs — die zwei Arme des interaktiven Rigs (CR-GC-715): derselbe Agent, zwei Clients.
 *
 *   lokal    — OpenCode, Agent `modellieren`, qwen3.8 über sigllm. `opencode serve` hält EINEN Prozess (und damit
 *              EINEN graphcode-Host mit seinem Sitzungsgedächtnis, CR-GC-734) über alle Züge; je Zug ein
 *              `opencode run --attach --session`. Der Vorschlag kommt aus `.graphcode/vorschlag.txt` (Plugin).
 *   frontier — Claude Code (Opus), EIN `claude -p`-Prozess mit Nachrichten über stdin (stream-json), also auch
 *              ein Host über alle Züge. Der Vorschlag kommt aus der graph_mutate-Antwort im Stream.
 *
 * Beide Arme entstehen aus DERSELBEN Vorlage (todo-local, eingecheckter Stand ohne Modell): gleicher Prompt
 * (für Claude Code als CLAUDE.md, nur die Werkzeugnamen umgeschrieben), dieselben fünf Analyse-Skills, dieselbe
 * Werkzeugliste. Jeder Zug liefert { text, dauerMs, werkzeuge, vorschlag }.
 *
 * @author andreas@siglochconsulting
 */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync, cpSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { createInterface } from 'node:readline';

export const VORLAGE = '/Users/andreas/Developer/dev/todo-local';
const CA = join(process.env.HOME, 'Developer/prod/sigllm/data/tls/sig-llm-ca.crt');
/** Das Claude-Code-CLI: `GRAPHCODE_RIG_CLAUDE`, sonst das im PATH (Opus 5.5 braucht >= 2.1.280). */
export const CLAUDE = process.env.GRAPHCODE_RIG_CLAUDE ?? 'claude';
const LESER = ['graph_authoring_guide', 'graph_elements', 'graph_get_node', 'graph_get_edges', 'graph_context', 'graph_impact'];

/** Die Vorlage als frisches Repo ohne Modell: eingecheckter Stand, kein Store, kein Export, eigener Host-Port. */
export function repoAnlegen(ziel, hostPort) {
  execFileSync('git', ['clone', '--quiet', VORLAGE, ziel]);
  rmSync(join(ziel, 'docs', 'graph'), { recursive: true, force: true });
  rmSync(join(ziel, '.graphcode'), { recursive: true, force: true });
  const cfgPfad = join(ziel, 'opencode.json');
  const cfg = JSON.parse(readFileSync(cfgPfad, 'utf8'));
  cfg.mcp.graphcode.environment.GRAPHCODE_HOST_PORT = String(hostPort);
  writeFileSync(cfgPfad, JSON.stringify(cfg, null, 2) + '\n');
  return ziel;
}

const warteAufPort = async (port, ms = 60_000) => {
  const bis = Date.now() + ms;
  while (Date.now() < bis) {
    const offen = await new Promise((r) => {
      const s = createConnection({ port, host: '127.0.0.1' }, () => { s.end(); r(true); });
      s.on('error', () => r(false));
    });
    if (offen) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Port ${port} nicht offen nach ${ms} ms`);
};

const vorschlagDatei = (repo) => join(repo, '.graphcode', 'vorschlag.txt');
const mtime = (p) => (existsSync(p) ? statSync(p).mtimeMs : 0);

/** Arm lokal: OpenCode-Server + je Zug ein angehängter Lauf. */
export async function lokal(repo, port) {
  const env = { ...process.env, OPENCODE_DISABLE_CLAUDE_CODE: '1', NODE_EXTRA_CA_CERTS: CA };
  const server = spawn('opencode', ['serve', '--port', String(port), '--hostname', '127.0.0.1'], { cwd: repo, env, stdio: 'ignore' });
  await warteAufPort(port);
  let sitzung = null;
  return {
    modell: JSON.parse(readFileSync(join(repo, 'opencode.json'), 'utf8')).model,
    async zug(nachricht) {
      const start = Date.now();
      const vorher = mtime(vorschlagDatei(repo));
      const args = ['run', '--attach', `http://127.0.0.1:${port}`, '--format', 'json', '--agent', 'modellieren', '--dir', repo];
      if (sitzung) args.push('--session', sitzung);
      args.push(nachricht);
      const out = await new Promise((res, rej) => {
        const p = spawn('opencode', args, { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let o = '', e = '';
        p.stdout.on('data', (d) => (o += d));
        p.stderr.on('data', (d) => (e += d));
        p.on('close', (code) => (code === 0 ? res(o) : rej(new Error(`opencode run ${code}: ${e.slice(-500)}`))));
      });
      const ereignisse = out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      sitzung ??= ereignisse.find((x) => x.sessionID)?.sessionID ?? null;
      const text = ereignisse.filter((x) => x.type === 'text').map((x) => x.part.text).join('\n');
      const werkzeuge = ereignisse.filter((x) => x.type === 'tool_use').map((x) => x.part.tool);
      const neu = mtime(vorschlagDatei(repo)) > vorher;
      return { text, dauerMs: Date.now() - start, werkzeuge, vorschlag: neu ? readFileSync(vorschlagDatei(repo), 'utf8').trim() : null };
    },
    /** Das Denken der Sitzung aus der OpenCode-DB (steht nicht im JSON-Strom, Memory opencode-denken-in-db). */
    denken() {
      if (!sitzung) return [];
      const db = join(process.env.HOME, '.local/share/opencode/opencode.db');
      const sql = `select p.data from part p join message m on p.message_id=m.id where m.session_id='${sitzung}' and json_extract(p.data,'$.type')='reasoning' order by p.time_created`;
      return execFileSync('sqlite3', [db, sql], { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean).map((l) => JSON.parse(l).text);
    },
    get sitzung() { return sitzung; },
    async ende() { server.kill('SIGTERM'); await new Promise((r) => server.on('close', r)); },
  };
}

/** Den OpenCode-Prompt in die Claude-Code-Fassung: nur Werkzeugnamen, sonst wortgleich. */
export function alsClaudeMd(prompt) {
  return prompt
    .replace(/graphcode_(graph_|rules_)/g, 'mcp__graphcode__$1')
    .replace(/`read`, `glob`, `grep`/g, '`Read`, `Glob`, `Grep`')
    .replace(/`webfetch`/g, '`WebFetch`') + '\n@graph_memory.md\n';
}

/** Repo für den Frontier-Arm: CLAUDE.md, .mcp.json, Skills unter .claude/skills — aus derselben Vorlage. */
export function frontierRepo(repo, hostPort) {
  writeFileSync(join(repo, 'CLAUDE.md'), alsClaudeMd(readFileSync(join(repo, '.opencode', 'prompts', 'modellieren.md'), 'utf8')));
  const oc = JSON.parse(readFileSync(join(repo, 'opencode.json'), 'utf8')).mcp.graphcode;
  const mcp = { mcpServers: { graphcode: { command: oc.command[0], args: oc.command.slice(1), env: { ...oc.environment, GRAPHCODE_HOST_PORT: String(hostPort) } } } };
  writeFileSync(join(repo, '.mcp.json'), JSON.stringify(mcp, null, 2) + '\n');
  for (const s of readdirSync(join(repo, '.opencode', 'skills'))) {
    mkdirSync(join(repo, '.claude', 'skills'), { recursive: true });
    cpSync(join(repo, '.opencode', 'skills', s), join(repo, '.claude', 'skills', s), { recursive: true });
  }
}

/** Arm frontier: ein claude-Prozess, Züge über stdin. */
export async function frontier(repo, modell = 'claude-opus-5-5') {
  const erlaubt = [...LESER, 'graph_mutate', 'rules_evaluate'].map((w) => `mcp__graphcode__${w}`).concat(['Skill', 'Read', 'Glob', 'Grep', 'WebFetch']);
  const env = { ...process.env };
  delete env.CLAUDECODE;
  const p = spawn(CLAUDE, ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--model', modell,
    '--mcp-config', '.mcp.json', '--strict-mcp-config', '--setting-sources', 'project',
    '--allowedTools', erlaubt.join(','), '--disallowedTools', 'AskUserQuestion,Bash,Edit,Write,MultiEdit,NotebookEdit,Task'],
  { cwd: repo, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const zeilen = createInterface({ input: p.stdout });
  const warteschlange = [];
  let wecker = null;
  zeilen.on('line', (l) => { try { warteschlange.push(JSON.parse(l)); } catch { /* keine JSON-Zeile */ } wecker?.(); });
  const naechstes = async () => {
    while (warteschlange.length === 0) await new Promise((r) => (wecker = r));
    return warteschlange.shift();
  };
  const denken = [];
  let modellId = null;
  return {
    get modell() { return modellId ?? modell; },
    async zug(nachricht) {
      const start = Date.now();
      p.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: nachricht }] } }) + '\n');
      const texte = [], werkzeuge = [], namen = new Map();
      let vorschlag = null;
      for (;;) {
        const x = await naechstes();
        if (x.type === 'system' && x.model) modellId = x.model;
        if (x.type === 'assistant') {
          for (const c of x.message.content ?? []) {
            if (c.type === 'text') texte.push(c.text);
            if (c.type === 'thinking') denken.push(c.thinking);
            if (c.type === 'tool_use') { werkzeuge.push(c.name); namen.set(c.id, c.name); }
          }
        }
        if (x.type === 'user') {
          for (const c of x.message.content ?? []) {
            if (c.type !== 'tool_result' || namen.get(c.tool_use_id) !== 'mcp__graphcode__graph_mutate') continue;
            const roh = Array.isArray(c.content) ? c.content.map((t) => t.text ?? '').join('') : String(c.content ?? '');
            try { const v = JSON.parse(roh).vorschlag; if (typeof v === 'string') vorschlag = v; } catch { /* Fehlertext */ }
          }
        }
        // Ein Fehler-Ergebnis (Modell abgelehnt, API-Fehler) ist kein Zug — der Lauf bricht laut ab.
        if (x.type === 'result' && x.is_error) throw new Error(`claude: ${x.result}`);
        if (x.type === 'result') return { text: texte.join('\n'), dauerMs: Date.now() - start, werkzeuge, vorschlag, kostenUsd: x.total_cost_usd };
      }
    },
    denken: () => denken,
    async ende() { p.stdin.end(); await new Promise((r) => p.on('close', r)); },
  };
}
