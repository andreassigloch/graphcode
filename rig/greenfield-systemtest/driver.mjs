// driver.mjs — minimal backend-agnostic graphcode executor ("graphcode's own OS").
//
// Replaces the full opencode/Claude-Code coding harness with a thin loop: the 22
// graphcode tools (schemas normalized by US, so LM Studio's strict OpenAI validator
// accepts them) + 3 scoped read tools + a ~1-page system prompt. graphcode itself
// supplies the method (graph_next_step = what to do, graph_authoring_guide = legal
// shape, the gate = correctness). Same driver → both backends: the model is the only
// variable, which is what makes "local ≈ frontier" a clean claim.
//
// The caller opens ONE harness and passes its tool registry; every graph_* call runs
// in-process against that store. No child MCP server, so no store-lock handoff.
//
// @author andreas@siglochconsulting
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SYSTEM = `Du autorierst Elemente in einen graphcode-Graphen. Der Graph ist die einzige Wahrheit — kein Code, keine Prosa.

Jede Nachricht gibt dir EINE präzise Generierungs-Instruktion (inkl. der legalen Kanten). Führe genau sie aus:
emittiere den geforderten Batch als EINEN graphcode_graph_mutate-Aufruf im commands-Format, dann STOPP.

graph_mutate-Form (exakt):
{"commands":[
  {"op":"add-node","node":{"uid":"UC-login","type":"UC","name":"Login","description":"...","attributes":{}}},
  {"op":"add-edge","edge":{"sourceId":"ACTOR-user","targetId":"UC-login","edgeType":"io","attributes":{}}}
]}
uid = "<TYP>-<kebab-name>". Nutze GENAU die Kanten aus der Instruktion (z.B. "ACTOR io→UC, SYS compose→UC").
list_dir/read_file/grep über ./material nur sparsam, um echte Modul-Namen zu finden — nicht statt Bauen.
Handeln vor Analysieren: rufe graph_mutate, rate die Instruktion nicht tot.`;

// --- schema normalization: LM Studio's OpenAI validator requires parameters.properties ---
function normSchema(s) {
  const o = s && typeof s === 'object' ? { ...s } : {};
  o.type = o.type || 'object';
  if (!o.properties || typeof o.properties !== 'object') o.properties = {};
  return o;
}

// --- read tools, scoped to the workspace (so ./material is readable, nothing else) ---
const READ_TOOLS = {
  list_dir: {
    desc: 'List entries under a workspace-relative directory (e.g. "material" or "material/packages").',
    params: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (dir, { path = '.' }) => readdirSync(join(dir, path)).map((n) => {
      try { return statSync(join(dir, path, n)).isDirectory() ? n + '/' : n; } catch { return n; }
    }).join('\n'),
  },
  read_file: {
    desc: 'Read a workspace-relative file (capped at 8000 chars).',
    params: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    run: (dir, { path }) => readFileSync(join(dir, path), 'utf8').slice(0, 8000),
  },
  grep: {
    desc: 'Case-insensitive substring search across ./material; returns up to 40 "relpath:line" hits.',
    params: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] },
    run: (dir, { pattern }) => {
      const hits = [], root = join(dir, 'material'), needle = String(pattern).toLowerCase();
      const walk = (d) => { for (const n of readdirSync(d)) {
        const p = join(d, n); let st; try { st = statSync(p); } catch { continue; }
        if (st.isDirectory()) { if (n !== 'node_modules' && n !== '.git') walk(p); }
        else if (/\.(ts|js|md|json|tsx)$/.test(n) && st.size < 200000) {
          const lines = readFileSync(p, 'utf8').split('\n');
          lines.forEach((ln, i) => { if (hits.length < 40 && ln.toLowerCase().includes(needle)) hits.push(`${relative(dir, p)}:${i + 1}`); });
        }
        if (hits.length >= 40) return;
      } };
      try { walk(root); } catch { /* material may be absent */ }
      return hits.join('\n') || '(no hits)';
    },
  },
};

// Build the combined tool set (graphcode + read) once, per backend format.
function buildTools(reg, backend) {
  const gc = Object.keys(reg).map((n) => ({
    name: 'graphcode_' + n, description: (reg[n].description || '').slice(0, 400), schema: normSchema(reg[n].inputSchema),
  }));
  const rd = Object.entries(READ_TOOLS).map(([n, t]) => ({ name: n, description: t.desc, schema: t.params }));
  const all = [...gc, ...rd];
  return backend === 'anthropic'
    ? all.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema }))
    : all.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.schema } }));
}

async function execTool(name, input, reg, dir) {
  if (READ_TOOLS[name]) { try { return String(READ_TOOLS[name].run(dir, input || {})); } catch (e) { return 'ERROR: ' + e.message; } }
  if (name.startsWith('graphcode_')) {
    const tool = name.slice('graphcode_'.length);
    if (!reg[tool]) return 'ERROR: unknown tool ' + name;
    try {
      const out = JSON.stringify(await reg[tool].handler(input || {})).slice(0, 6000);
      if (process.env.DRIVER_TRACE && tool === 'graph_mutate')
        process.stderr.write(`    MUTATE in=${JSON.stringify(input).slice(0, 300)}\n    MUTATE out=${out.slice(0, 300)}\n`);
      return out;
    } catch (e) {
      const msg = 'ERROR: ' + (e?.message ?? String(e));
      if (process.env.DRIVER_TRACE && tool === 'graph_mutate')
        process.stderr.write(`    MUTATE in=${JSON.stringify(input).slice(0, 300)}\n    ${msg.slice(0, 300)}\n`);
      return msg;
    }
  }
  return 'ERROR: unknown tool ' + name;
}

// --- backend call: returns {text, toolCalls:[{id,name,input}], usage, assistantMsg} ---
async function callBackend({ backend, baseUrl, model, apiKey }, system, messages, tools) {
  if (backend === 'anthropic') {
    const r = await fetch(`${baseUrl}/v1/messages`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', ...(apiKey ? { 'x-api-key': apiKey } : {}),
    }, body: JSON.stringify({ model, max_tokens: 8000, system, tools, messages }), signal: AbortSignal.timeout(180000) });
    const j = await r.json();
    if (j.type === 'error' || j.error) throw new Error('backend: ' + JSON.stringify(j.error ?? j).slice(0, 300));
    const calls = (j.content || []).filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input }));
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { text, toolCalls: calls, assistantMsg: { role: 'assistant', content: j.content },
      usage: { in: j.usage?.input_tokens ?? 0, out: j.usage?.output_tokens ?? 0, reasoning: 0 } };
  }
  // openai (LM Studio)
  const r = await fetch(`${baseUrl}/v1/chat/completions`, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(apiKey ? { Authorization: 'Bearer ' + apiKey } : {}),
  }, body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'system', content: system }, ...messages], tools }), signal: AbortSignal.timeout(180000) });
  const j = await r.json();
  if (j.error) throw new Error('backend: ' + JSON.stringify(j.error).slice(0, 300));
  const msg = j.choices?.[0]?.message ?? {};
  const calls = (msg.tool_calls || []).map((c) => ({ id: c.id, name: c.function.name, input: safeParse(c.function.arguments) }));
  return { text: msg.content || '', toolCalls: calls, assistantMsg: msg,
    usage: { in: j.usage?.prompt_tokens ?? 0, out: j.usage?.completion_tokens ?? 0,
      reasoning: j.usage?.completion_tokens_details?.reasoning_tokens ?? 0 } };
}

const safeParse = (s) => { try { return JSON.parse(s); } catch { return {}; } };

// Recover a mutate the model wrote as PROSE instead of a tool-call (common with coder
// models like devstral): find the outermost {…} enclosing "commands" and parse it.
function extractMutateFromText(text) {
  if (!text || !text.includes('"commands"')) return null;
  const at = text.indexOf('"commands"');
  let start = text.lastIndexOf('{', at);
  while (start >= 0) {
    let depth = 0, end = -1;
    for (let k = start; k < text.length; k++) {
      if (text[k] === '{') depth++;
      else if (text[k] === '}' && --depth === 0) { end = k; break; }
    }
    if (end > start) {
      try { const o = JSON.parse(text.slice(start, end + 1)); if (Array.isArray(o.commands)) return o; } catch { /* keep scanning */ }
    }
    start = text.lastIndexOf('{', start - 1);
  }
  return null;
}

// --- the loop: graphcode's DESIGNED cold-start path (Regime 1) ---
// The DRIVER calls graph_generate deterministically each round and injects its
// per-step prompt (which carries the edge grammar). The model's only job is to
// emit the batch via graph_mutate — every "what next" decision is graphcode's,
// not the model's. That maximally de-skills the model (ideal for a coder).
// graph_generate/graph_next_step are withheld from the model's tool list.
export async function runDriver({ dir, backend, baseUrl, model, apiKey, reg, intent, maxIter = 40 }) {
  const withheld = new Set(['graph_generate', 'graph_next_step']);
  const tools = buildTools(reg, backend).filter((t) => {
    const n = (backend === 'anthropic' ? t.name : t.function.name).replace('graphcode_', '');
    return !withheld.has(n);
  });
  const usage = { in: 0, out: 0, reasoning: 0, iters: 0, genRounds: 0 };
  let intentArg = intent; // only the first graph_generate carries the prose intent
  for (let round = 0; round < maxIter; round++) {
    const gen = await reg['graph_generate'].handler(intentArg ? { intent: intentArg } : {});
    intentArg = null;
    usage.genRounds = round + 1;
    if (process.env.DRIVER_TRACE) process.stderr.write(`  [generate ${round + 1}] phase=${gen.phase} done=${gen.done}\n`);
    if (gen.done) break;
    const messages = [{ role: 'user', content:
      `${gen.prompt}\n\nEmittiere GENAU diesen Schritt als EINEN graph_mutate-Aufruf im commands-Format `
      + `({"commands":[{"op":"add-node","node":{"uid","type","name","description","attributes":{}}},`
      + `{"op":"add-edge","edge":{"sourceId","targetId","edgeType","attributes":{}}}]}). Kein weiterer Tool-Call danach.` }];
    for (let step = 0; step < 6; step++) { // bounded model turns per generate-step
      usage.iters += 1;
      let resp;
      try { resp = await callBackend({ backend, baseUrl, model, apiKey }, SYSTEM, messages, tools); }
      catch (e) { // slow/hung model call (undici headers timeout): skip to next generate round
        if (process.env.DRIVER_TRACE) process.stderr.write(`    ${round + 1}.${step + 1}: call failed (${e.message.slice(0, 60)}) — skip\n`);
        break;
      }
      usage.in += resp.usage.in; usage.out += resp.usage.out; usage.reasoning += resp.usage.reasoning;
      if (process.env.DRIVER_TRACE) process.stderr.write(
        `    ${round + 1}.${step + 1}: ${resp.toolCalls.map((c) => c.name.replace('graphcode_', '')).join(',') || '(no calls)'}\n`);
      if (!resp.toolCalls.length) {
        // model wrote the mutate as prose instead of a tool-call → recover it
        const recovered = extractMutateFromText(resp.text);
        if (recovered) {
          const out = await execTool('graphcode_graph_mutate', recovered, reg, dir);
          if (process.env.DRIVER_TRACE) process.stderr.write(`      recovered mutate from text → ${out.slice(0, 80)}\n`);
        }
        break; // step done (recovered or truly idle) → back to graph_generate
      }
      messages.push(resp.assistantMsg);
      const didMutate = resp.toolCalls.some((c) => c.name === 'graphcode_graph_mutate');
      if (backend === 'anthropic') {
        const results = [];
        for (const c of resp.toolCalls) results.push({ type: 'tool_result', tool_use_id: c.id, content: await execTool(c.name, c.input, reg, dir) });
        messages.push({ role: 'user', content: results });
      } else {
        for (const c of resp.toolCalls) messages.push({ role: 'tool', tool_call_id: c.id, content: await execTool(c.name, c.input, reg, dir) });
      }
      if (didMutate) break; // step authored → back to graph_generate for the next instruction
    }
  }
  return { wall_s: null, tokens_in: usage.in, tokens_out: usage.out, tokens_reasoning: usage.reasoning || null,
    iters: usage.iters, genRounds: usage.genRounds };
}
