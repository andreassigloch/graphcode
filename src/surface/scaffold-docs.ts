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
  HOST_ENTRY,
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

/**
 * The guardrails doc scaffolded into the target repo.
 *
 * CR-GC-612 — **jede Frage hat genau einen Ort.** Gemessen am 2026-09-22 stand diese Datei bei
 * 15.150 Zeichen, und 21 ihrer 165 Zeilen erklärten Werkzeuge, die sich selbst erklären: alle 15
 * Werkzeug-/Regelmarker der Datei standen auch in den Werkzeugbeschreibungen. Kein Copy-Paste
 * (gemeinsame Sätze ab 50 Zeichen: 0) — doppelt war die ZUSTÄNDIGKEIT, und das ist schlimmer, weil
 * beide Orte getrennt driften.
 *
 * Was hier steht: die HAUSREGELN des Repos — frag den Graphen, schreib nur durchs Gate, wo die
 * Sichten liegen, was der Ablauf verlangt. Keine Werkzeugnamen als Nachschlagewerk, keine
 * Regelsemantik.
 * Was NICHT hier steht: wann man welches Werkzeug nimmt (das sagt seine Beschreibung, ein Satz),
 * was eine Regel bedeutet (`graph_help`, auf Abruf), welcher Schritt wann kommt (der Skill).
 */
export function guardrailsContent(): string {
  return [
    '# graphcode — Harness Guardrails',
    '',
    'This repo is governed by the **graphcode** graph substrate (MCP-stdio).',
    'Installed via `npx @sigloch/graphcode init`. Lifecycle: `init | upgrade | remove`.',
    '',
    'These are the house rules. What a tool is FOR stands in its own description; what a rule or a',
    'number MEANS is one help call away. Neither is repeated here.',
    '',
    "## Ask the graph, don't grep for it",
    '',
    '**The graph is the SSOT, not the docs.** Structural questions about this repo have exact',
    'answers in the model, reachable in one typed call. A text search only approximates those',
    'answers, and it cannot tell you what it missed.',
    '',
    'This is not a preference. In a measured rebuild of graphcode itself (2026-08-27) the agents',
    'moved **810 model elements** using **174 search operations and not one blast-radius query**.',
    'Every one of those searches was a guess at something the graph already held exactly.',
    '',
    '**Grep is not forbidden — it is scoped.** It stays the right tool for what the graph does not',
    'model: which file contains a given string, where a symbol is defined, free-text search across',
    'prose. Before starting a broad search, ask whether a typed call answers the question exactly;',
    'if one does, run that instead. Reading `docs/graph/*.graph.json`, `docs/views/` or',
    '`.graphcode/audit.jsonl` by hand is never the answer — those are outputs, not the model.',
    '',
    '## Which tests to run',
    '',
    '- **Inner loop: the selected set** for the change at hand, not the whole suite. Running',
    '  everything after every edit is the habit the selection exists to replace.',
    '- **The full suite is the gate before a change closes.**',
    '- **Read what the selection could NOT resolve.** A concept-only TEST has no run artifact, so the',
    '  selected run does not cover it — a coverage gap to close, not noise to skip past.',
    '',
    '## When the brief leaves something open',
    '',
    'An open decision of the client (unknown notification channel, an unset target value, an',
    'unsettled order) goes into the model **as an assumption** and is named in your closing message.',
    'Ask a question only when a human can answer it: in a headless run nobody does, and a question',
    'there is a dead end (CR-GC-592).',
    '',
    '## Writing to the model',
    '',
    '- **Every edit goes through the apply-gate** — for human and agent alike. Hand-edits of',
    '  `docs/graph/*.graph.json` are blocked by the `deny-graph-write` hook, and an edit that newly',
    '  introduces an error-level violation is rejected with the rule that refused it.',
    '- **Concurrent writes (OCC):** every read returns `graphVersion`; pass it back as `baseVersion`.',
    '  A stale write is rejected with the delta of what changed: re-read, reconcile, retry.',
    '- **Format-E v2:** the type is a `### <TYPE>` section header, never part of the uid',
    '  (`## Nodes` / `### MOD` / `+ MOD-harness|Harness module`). The `uid.TYPE` suffix and the',
    '  `Name.SY.001` spelling are **dead** — do not reproduce them.',
    '- **The ontology is closed.** Element types, trace types and rules come from',
    '  `@sigloch/contracts/se`; none of them can be added in this repo. If the type you need does not',
    '  exist, say so — do not improvise a near-fit that the gate will certify as consistent.',
    '- **After authoring, export**, so `docs/graph/*.graph.json` exists as a readable SSOT for the',
    '  next session (a single-writer Kuzu store is not). Export is the LAST step of a change, not a',
    '  checkpoint in the middle.',
    '- **Bootstrap prose is not authoritative.** A doc declaring `status: INPUT-ONLY` — a legacy',
    '  `docs/SPEC.md`, say — is input: do not read it to plan. The `deny-stale-prose-read` hook',
    '  blocks it anyway.',
    '',
    '## Available se-* skills',
    '',
    'They ship in `.claude/commands/` and are invoked via the **Skill tool**, each MCP-driven against',
    'the live graph — invoking one beats planning the same work ad-hoc. Each states its own purpose;',
    'refresh with `npx @sigloch/graphcode skills sync`.',
    '',
    skillNameList(),
    '',
    '## What is here',
    '',
    '- `.graphcode/` — the per-repo Kuzu store. On disk, single-writer, one owner process, never',
    '  edited by hand.',
    '- **Parallel sessions share ONE model:** the first host wins the store election, later ones',
    '  proxy to it — one gate, one write channel.',
    '- `.mcp.json` + `opencode.json` — they launch the repo-installed server; run `npm install`',
    '  first. Merged, never overwritten: foreign MCP servers and your `provider`/`model` block survive.',
    '- `GRAPHCODE-STEERING.md` — the HUMAN\'s companion: the four decisions only the person can make,',
    '  and what the generated `docs/views/` documents are. Point the user there when they ask how to',
    '  steer — do not paraphrase it.',
    '- `.claude/hooks/deny-*.sh` + `.claude/settings.json` — PreToolUse enforcement: gate-only writes,',
    '  no binary source, no stale-prose reads.',
    '',
    '## Live view and lifecycle',
    '',
    `- \`${HOST_ENTRY}\` starts the MCP surface, the read-only bridge and the dashboard.`,
    '  It lives as long as the session and is restarted automatically; there is nothing to stop by',
    '  hand. Silence it with `GRAPHCODE_NO_GVE=1`.',
    '- **Ask where your dashboard is: `npx @sigloch/graphcode status`** — it reports the viewer that',
    '  serves THIS repo; one serving another repo is reported as such, never as yours. The',
    '  machine-readable address is `docs/views/dashboard.url`. `graphcode host` is a fallback for a',
    '  repo with no agent session — started next to a live host it just hits the store lock.',
    '- `npx @sigloch/graphcode upgrade` — newest version, scaffolded artifacts rewritten from that',
    '  build; the store is kept. `--check` reports drift. `remove` deletes all of it.',
    '',
  ].join('\n');
}

/**
 * Die Skill-Namen als eine Zeile (CR-GC-612).
 *
 * Vorher stand hier eine Tabelle mit 33 Zeilen und der vollen `description:` je Skill — rund
 * 6.500 Zeichen, also fast die Hälfte der Datei, und wortgleich zu dem, was der Host beim Auflisten
 * der Skills ohnehin zeigt. Die Liste bleibt LIVE aus dem Frontmatter (`shippedSkillFiles`), damit
 * sie nicht von dem abweichen kann, was `init`/`sync` wirklich kopieren.
 */
function skillNameList(): string {
  return shippedSkillFiles()
    .map((f) => {
      const meta = parseSkillFrontmatter(readFileSync(join(packagedSkillsDir(), f), 'utf8'));
      return `\`${meta.name || f.replace(/\.md$/, '')}\``;
    })
    .join(' · ');
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
