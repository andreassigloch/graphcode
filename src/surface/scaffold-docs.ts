/**
 * scaffold-docs.ts — die zwei verfassten Dokumente, die die Scaffold-Verben in ein
 * Member-Repo schreiben (CR-GC-508, geschnitten aus scaffold-templates.ts).
 *
 * GRAPHCODE.md: die Leitplanken für den Agenten, mit der Skill-Tabelle live aus dem
 * Frontmatter der ausgelieferten Skills. GRAPHCODE-STEERING.md: das Dokument für den
 * Menschen, mit der Tabelle der erzeugten Sichten. Pfade, Paketname und Skill-Quelle
 * kommen aus scaffold-templates.ts; hier steht nur der Text.
 *
 * @author andreas@siglochconsulting
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { MARKDOWN_VIEWS, VIEW_FILENAMES, type MarkdownView } from '@sigloch/graphcode-client';
import {
  GUARDRAILS_FILE,
  PACKAGE_SPEC,
  STEERING_FILE,
  packagedSkillsDir,
  parseSkillFrontmatter,
  shippedSkillFiles,
} from './scaffold-templates.js';

/**
 * The "## Available se-* skills" rows — derived LIVE from the shipped skills' frontmatter
 * (CR-GC-208), so the table can never drift from what `init`/`sync` actually copy. Each row
 * maps a skill `name:` → its `description:`; pipes in a description are escaped so the
 * Markdown table stays well-formed.
 */
export function skillTableRows(): string[] {
  const srcDir = packagedSkillsDir();
  return shippedSkillFiles().map((f) => {
    const meta = parseSkillFrontmatter(readFileSync(join(srcDir, f), 'utf8'));
    const name = meta.name || f.replace(/\.md$/, '');
    const desc = (meta.description || '').replace(/\|/g, '\\|');
    return `| \`${name}\` | ${desc} |`;
  });
}

/** The guardrails doc scaffolded into the target repo. */
export function guardrailsContent(): string {
  return [
    '# graphcode — Harness Guardrails',
    '',
    'This repo is governed by the **graphcode** graph substrate (MCP-stdio).',
    'Installed via `npx @sigloch/graphcode init`. Lifecycle: `init | upgrade | remove`.',
    '',
    "## Ask the graph, don't grep for it",
    '',
    '**The graph is the SSOT, not the docs.** Structural questions about this repo have exact',
    'answers in the model, reachable in one typed call. A text search only approximates those',
    'answers, and it cannot tell you what it missed.',
    '',
    'This is not a preference. In a measured rebuild of graphcode itself (2026-08-27) the agents',
    'moved **810 model elements** using **174 search operations and zero calls to `graph_impact`**.',
    'Every one of those searches was a guess at something the graph already held exactly.',
    '',
    '| Question | Tool — not a search |',
    '| --- | --- |',
    '| What breaks if I change this? | `graph_impact({id})` — the node plus everything pointing INTO it within `depth`, and the frontier at depth+1 named but not opened. Complete by construction; a search is not. |',
    '| What do I need in order to implement this? | `graph_context({id})` — the upstream closure in one call: the REQ/UC it satisfies, the TESTs verifying those, the FLOWs it exchanges, the MOD it is allocated to, plus its refs. |',
    '| Where does this live in the code? | the `realRef` attribute on the node — `graph_context` returns it and lists what has none under `missingRefs`. Never grep the element name. |',
    '| I need one more level of one branch | `graph_expand({handle, branch, depth})` — deepens callers / traces / tests on demand, recomputed live. |',
    '| Which elements of type X exist? | `graph_elements({type, search})` — a typed slice, never a full dump. |',
    '| Which tests must this change run? | `graph_tests({changeSet})` — the minimal `vitest run <affected files>` for exactly this change, plus what it could not resolve (see the next section). |',
    '| What is broken, and how do I fix it? | `rules_get_violations` — every finding carries a `fixHint` and its candidate targets, so the repair needs no follow-up query. `rules_evaluate` adds the full picture including what was *not* evaluated. |',
    '| Where does the project stand? | `graph_readiness` — compliance, the SRR/PDR/CDR/TRR gates, and the per-topic scores. |',
    '| What should I do next? | `graph_next_step` — one prioritised action derived from the largest readiness deficit, not a flat list to triage. |',
    '| Which restructuring actually pays off? | `graph_suggest` — candidate edits ranked by how far each moves the model along the target direction. It proposes; `graph_mutate` applies. |',
    '| Which module is the coupling problem? | `graph_metrics` — fan-in/out, instability, LCOM4 and cohesion for every MOD, together with the thresholds they were judged against. |',
    '| What does this rule / gate / term mean? | `graph_help` (or the `se:help` skill) — plain-language and SE explanation of any on-screen token, with the exact fix. |',
    '',
    '**Grep is not forbidden — it is scoped.** It stays the right tool for what the graph does not',
    'model: which file contains a given string, where a symbol is defined, free-text search across',
    'prose. It is the wrong tool for every row above. Before starting a broad search, name the row',
    'your question belongs to; if it has one, run that tool instead.',
    '',
    '## Which tests to run',
    '',
    '- **Inner loop: the selected set.** `graph_tests({changeSet})` walks',
    '  `code node →satisfy/allocate→ REQ →verify→ TEST`, resolves each TEST through its `testRefs`',
    '  bindings, and returns the minimal `vitest run <affected files>` command. Run that while working.',
    '- **The full suite is the gate before a change closes**, not the inner loop. Running everything',
    '  after every edit is the habit this tool exists to replace.',
    '- **Read the `unresolved` list in the answer.** A TEST reported there is concept-only — it has no',
    '  run artifact, so the selected run does not cover it. `graph_tests` reports it separately instead',
    '  of dropping it; that entry is a coverage gap to close, not noise to skip past.',
    '',
    '## Writing to the model',
    '',
    '- **Every edit goes through `graph_mutate`** — the single apply-gate, for human and agent alike.',
    '  Hand-edits of `docs/graph/*.graph.json` are blocked by the `deny-graph-write` hook, and an edit',
    '  that newly introduces an error-level violation is rejected with the rule that refused it.',
    '- **Concurrent writes (OCC):** every read returns `graphVersion`; pass it as `baseVersion` to',
    '  `graph_mutate`/`graph_realize` — a stale write is rejected with the delta of what changed:',
    '  re-read, reconcile, retry.',
    '- **Format-E v2:** the type is a `### <TYPE>` section header, never part of the uid',
    '  (e.g. `## Nodes` / `### MOD` / `+ MOD-harness|Harness module`). The `uid.TYPE`',
    '  suffix and the `Name.SY.001` spelling are both **dead** — do not reproduce them.',
    '- **The ontology is closed.** Element types, trace types and rules come from',
    '  `@sigloch/contracts/se`; none of them can be added in this repo. If the type you need does not',
    '  exist, say so — do not improvise a near-fit that the gate will certify as consistent.',
    '- **After seeding the graph, run `graph_export`** so `docs/graph/*.graph.json`',
    '  exists as a readable SSOT for the next session (a single-writer Kuzu store is not).',
    '- **Bootstrap prose is not authoritative.** A doc whose head declares `status: INPUT-ONLY` — a',
    '  legacy `docs/SPEC.md`, for instance — is input, and you do not read it to plan; the',
    '  `deny-stale-prose-read` hook blocks it anyway.',
    '',
    '## Available se-* skills',
    '',
    'These ship in `.claude/commands/`. Invoke them via the **Skill tool** instead of',
    'planning the same work ad-hoc — each is MCP-driven against the live graph. Run',
    '`npx @sigloch/graphcode skills sync` to refresh them when this package updates.',
    '',
    '| skill | purpose |',
    '| --- | --- |',
    ...skillTableRows(),
    '',
    '## What is here',
    '',
    '- `.graphcode/` — the per-repo Kuzu store (`.graphcode/kuzu`). On disk, single-writer,',
    '  exactly one owner process. Never edited by hand; it inits lazily on first `graphcode mcp`.',
    '- **Parallel sessions share ONE model:** the first `graphcode mcp` wins the',
    '  store election and becomes the host (`.graphcode/host.sock`); later sessions proxy to',
    '  it transparently — same tools, one gate, one write channel per store/worktree.',
    '- `.mcp.json` (Claude schema) + `opencode.json` (OpenCode schema) — both tell the',
    `  agent host to launch the server via \`npx -y ${PACKAGE_SPEC} mcp\`. Merged, never`,
    '  overwritten: foreign MCP servers and your `provider`/`model` block survive.',
    '- `.claude/commands/se*.md` — the SE skills (fmea/review/status + the views), MCP-driven.',
    '  Claude Code surface; on other hosts drive the MCP tools directly.',
    `- \`${STEERING_FILE}\` — the HUMAN's companion to this file: the four decisions only`,
    '  the person can make, and what the generated `docs/views/` documents are. Point',
    '  the user there when they ask how to steer the model — do not paraphrase it.',
    '- `.claude/hooks/deny-*.sh` + `.claude/settings.json` — PreToolUse enforcement:',
    '  gate-only writes, no binary source, no stale-prose reads. Your own',
    '  hooks/settings keys are preserved on upgrade and restored on `remove`.',
    '',
    '## Live view (dashboard)',
    '',
    '- **One command starts everything.** `graphcode mcp` (the agent host launches it',
    '  from `.mcp.json`) brings up three things: the MCP-stdio surface, the read-only',
    '  HTTP/SSE bridge, and the **GVE dashboard** itself. There is no second server to',
    '  start. `graphcode host` exists only as a fallback for a repo with no agent',
    '  session running — starting it alongside a live host hits the store lock.',
    '- **Ask where your dashboard is: `npx @sigloch/graphcode status`.** It reports the',
    '  host PID and the URL of the viewer that serves THIS repo — read-only, starts and',
    '  stops nothing. A viewer that answers but serves another repo is reported as such,',
    '  never as yours.',
    '- **The machine-readable source is `docs/views/dashboard.url`.** The viewer writes its ACTUAL',
    '  bound address there on startup and removes it on shutdown. The address is stable per repo',
    '  (derived from the repo path), so it survives restarts — but read the file rather than',
    '  assuming: on a rare port collision it moves, and a stale file then points at a NEIGHBOUR',
    '  repo\'s viewer. `status` settles that by asking `api/config` which repo is served —',
    '  the identity answer, deliberately NOT `api/dashboard`: that one computes readiness first',
    '  and a probe budget short enough to be useful reads a slow-but-live viewer as absent.',
    '- **The dashboard lives as long as the session.** It goes down with the host and comes',
    '  back with the next one; a viewer that dies in between is restarted automatically. There',
    '  is nothing to stop by hand, and no leftover process to hunt.',
    '- Silence it with `GRAPHCODE_NO_GVE=1`; point it elsewhere with `GRAPHCODE_GVE_BIN`.',
    '',
    '## Lifecycle',
    '',
    '- `npx @sigloch/graphcode upgrade` — install the newest version, rewrite the scaffolded',
    '  artifacts and host configs from that build, and stop the old host so the next session',
    '  boots the new code. The store is kept. `--check` reports drift and changes nothing.',
    '- `npx @sigloch/graphcode remove` — remove all scaffolded artifacts (incl. `.graphcode/`).',
    '',
  ].join('\n');
}

/**
 * One sentence per generated view — what QUESTION the document answers, in the
 * language of someone who has never met this ontology (CR-GC-322).
 *
 * Typed as a total `Record<MarkdownView, …>` on purpose: a view added to
 * `MARKDOWN_VIEWS` (@sigloch/graphcode-client) fails the build here until it has a
 * sentence, so `docs/views/` can never grow an undocumented file. The catalog itself
 * stays description-free — it is deliberately zero-dependency, plain data (CR-GC-264);
 * the wording is authored, so it lives with the other authored copy.
 */
export const VIEW_BLURBS: Record<MarkdownView, string> = {
  architecture: 'Which module realizes which function — the allocation, i.e. the design description.',
  'cr-list': 'Every change request with its status and description.',
  references: 'Every trace in the model as `source -type-> target` — the raw link inventory.',
  srs: 'The requirements narrative (ISO 29148): what the system must do, and why.',
  nfr: 'The non-functional register — the quality requirements and how each is measured.',
  rtm: 'Traceability: requirement → realizing element → verifying test. The audit view.',
  icd: 'The interfaces between the modules (Interface Control Document).',
  testconcept: 'The test pyramid over the model, with the end-to-end gap computed, not claimed.',
  testmatrix: 'Which test verifies which requirement (VCRM) — and which requirement has none.',
  intplan: 'Integration and test plan: in which order the parts come together, verified how.',
  changelog: 'The change history, derived from the CR nodes.',
  fmea: 'Failure modes with severity/occurrence/detection, action priority, and mitigation coverage.',
  conops: 'Concept of operations: user classes, scenarios, constraints — the operational picture.',
  trade: 'The decisions: which options were evaluated, which won, what superseded what.',
  implplan: 'Milestones and the change requests assigned to them — the build order.',
};

/**
 * The `docs/views/` table rows for the steering doc — derived from the shared catalog
 * (CR-GC-264) so filename and coverage cannot drift from what `graph_export` writes.
 */
export function viewTableRows(): string[] {
  return MARKDOWN_VIEWS.map((v) => `| \`${VIEW_FILENAMES[v]}\` | ${VIEW_BLURBS[v]} |`);
}

/**
 * `GRAPHCODE-STEERING.md` — the doc scaffolded FOR THE HUMAN (CR-GC-322).
 *
 * The other 17 scaffolded documents are instructions to the agent, written in this
 * ontology's vocabulary; `se/target-profile.md` even says so out loud (CR-GC-307: the
 * steering vocabulary is our device, not a customer concept). That left the person who
 * OWNS the intent with nothing addressed to them. This file is that, and only that:
 * the four levers they actually hold, plus the generated documents they are expected
 * to read. No element types, no Format-E, no rule IDs beyond one worked example.
 */
export function steeringContent(): string {
  return [
    '# graphcode — steering the model (written for you, not for your agent)',
    '',
    `\`${GUARDRAILS_FILE}\` is the contract for your **agent**. This file is for **you**: what`,
    'graphcode decides on its own, the four decisions only you can make, and what the',
    'generated documents under `docs/views/` are.',
    '',
    '## What runs without you',
    '',
    'The agent does not invent the order of work. `graph_generate` derives from the live',
    'model what has to be described next and hands the agent that instruction; every write',
    'then passes the **apply-gate**, which checks it against the SE rules and rejects what',
    'would leave the model inconsistent. A requirement with no test that could falsify it,',
    'for example, is refused at the moment it is written — not flagged in a review later.',
    '',
    'So consistency takes care of itself. What no rule can check is whether the model',
    'describes **the system you wanted**. That is what the four levers below are for.',
    '',
    '## Lever 1 — the intent paragraph (this one is not optional)',
    '',
    'Everything derives from one paragraph of prose: **what should the system do, and for',
    'whom?** Write it in your own words — no method vocabulary, no module names, no file',
    'layout. Three things are worth naming explicitly, because each becomes structure:',
    '',
    '- **who uses it, and what they get out of it** — the users and their goals;',
    '- **what the system must not do, or must never lose** — the hard constraints;',
    '- **what happens when something goes wrong** — the cases people forget to mention.',
    '',
    'Say this to your agent, with your paragraph in the quotes:',
    '',
    '> Read GRAPHCODE.md, then `se:generate`: "<what the system should do, for whom>"',
    '',
    'On a repo that already has a model, start from where it stands instead:',
    '',
    '> Read GRAPHCODE.md, then: `graph_readiness` — where does the project stand, and what',
    '> is the next step?',
    '',
    '## Lever 2 — answering the questions you get asked',
    '',
    'If the paragraph is too thin to derive from, you get **questions about your domain, in',
    'plain language** ("What happens when a customer cancels an order?", "Who is allowed to',
    'change prices?"). They are not a formality: your answers are the material the model is',
    'built from. Answer them concretely — a vague answer produces a vague requirement, and',
    'the gate will happily certify it as consistent.',
    '',
    '## Lever 3 — the choices that come back to you',
    '',
    'At every design decision the agent is required to put **two** options in front of you,',
    'each previewed against the real model, and to show what each does to it — never to pick',
    'silently. Same for trade studies and failure-mode analysis: those produce options and',
    'evidence, not verdicts. You decide; the decision is recorded, including the option you',
    'turned down, so a later reader can see what was considered and why it lost.',
    '',
    'If your agent presents one option as settled, that is the moment to push back and ask',
    'for the alternative it did not show you.',
    '',
    '## Lever 4 — the target profile (optional, and only when you want to steer)',
    '',
    'You can tell the optimizer what "better" means for this project — how strongly to favour',
    'loosely coupled parts, redundancy, short data paths, cohesive modules, a balanced size,',
    'or the absence of bottlenecks. It lives in `.graphcode/target-profile.json`; your agent',
    'sets it up if you ask for it ("I want to steer the optimization").',
    '',
    'Leaving it unset is a legitimate choice — everything is then weighted equally. Note that',
    'some goals genuinely pull against each other (loosely coupled parts vs. short data paths,',
    'for instance); if you weight both up, you get a warning, not a block. A conscious',
    'trade-off is fine, an invisible one is not.',
    '',
    '## `docs/views/` — the generated documents',
    '',
    'Everything in `docs/views/` is a **deterministic render of the model**, written by',
    '`graph_export`. The same model always produces byte-identical files, and each one carries',
    'a `GENERATED … DO NOT HAND-EDIT` header.',
    '',
    'Take that literally: an edit you make there survives until the next export and is then',
    'gone without a trace. To change what a document says, change the **model** (your agent',
    'does that through the gate) and export again. The documents are the readable face of the',
    'model — for a review, a hand-off, or a diff in a pull request. Your agent does not read',
    'them to plan its work; it queries the model directly. They are for you.',
    '',
    '| file | answers |',
    '| --- | --- |',
    ...viewTableRows(),
    '',
    'Two generated things you will meet alongside them are **not** views:',
    '',
    '- `docs/views/dashboard.url` — the address of the live dashboard, written by the viewer',
    '  on startup and removed on shutdown. Same repo, same address every time; read the file',
    '  anyway, it is the one place that knows. File absent = nothing running, and',
    '  `graphcode status` says why.',
    '- `docs/graph/<name>.graph.json` — the exported model itself, the readable source the',
    '  documents above are rendered from. Also generated; a hand-edit is actively blocked.',
    '',
    '## When a document or a screen says something you do not recognize',
    '',
    'Ask for it by name — `se:help <whatever it said>` explains any rule, gate, panel, or term',
    'twice over: once in plain language, once in systems-engineering terms, plus the exact fix.',
    '`se:help` with nothing after it gives you the ranked next steps for this project.',
    '',
  ].join('\n');
}
