#!/usr/bin/env node
// gcw — git-worktree wrapper for concurrent graphcode agents (CR-GC-218, option O1).
//
// Concurrency the git way: run each agent in its OWN worktree. `.graphcode` is
// gitignored and repo-root-relative, so every worktree gets its OWN Kuzu store — no
// shared mutable state, no cross-agent clobber (the store is to graph.json what the
// working tree is to a commit: a derived, per-worktree cache). The store auto-seeds
// from that worktree's committed `docs/graph/*.graph.json` on first `graphcode mcp`.
//
// Robustness: several `git worktree add` racing on `.git/config.lock` is a known failure
// (anthropics/claude-code#34645); this retries with backoff so concurrent launches are safe.
//
// Usage: node scripts/gcw.mjs <branch> [worktree-dir]
// @author andreas@siglochconsulting
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';

/** Synchronous sleep (ms) without a busy loop. */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Run git, retrying on lock contention (config.lock / index.lock). */
function git(args, retries = 6) {
  for (let attempt = 0; ; attempt++) {
    try {
      return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      const msg = String(e.stderr || e.stdout || e.message || '');
      if (attempt < retries && /\.lock|another git process/i.test(msg)) {
        sleep(100 * 2 ** attempt); // 100ms, 200ms, 400ms, … back off then retry
        continue;
      }
      throw new Error(msg.trim() || `git ${args.join(' ')} failed`);
    }
  }
}

const branch = process.argv[2];
if (!branch) {
  console.error('usage: node scripts/gcw.mjs <branch> [worktree-dir]');
  process.exit(1);
}

const repo = basename(process.cwd());
const dir = resolve(process.argv[3] ?? `../${repo}-${branch.replace(/[^\w.-]+/g, '-')}`);

// New branch if it doesn't exist yet; otherwise check out the existing one.
const branchExists = git(['branch', '--list', branch]).trim() !== '';
git(branchExists ? ['worktree', 'add', dir, branch] : ['worktree', 'add', '-b', branch, dir]);

console.log(
  [
    ``,
    `✔ Worktree ready: ${dir}  (branch ${branch})`,
    ``,
    `  Its .graphcode store is SEPARATE (gitignored, per-worktree) — no shared mutable state.`,
    `  It auto-seeds from that worktree's docs/graph/*.graph.json on first \`graphcode mcp\`.`,
    ``,
    `  Launch an agent there:`,
    `    cd ${dir}`,
    `    claude            # or: opencode  — a fresh MCP server owns this worktree's store`,
    ``,
    `  When done:  git worktree remove ${dir}`,
    ``,
  ].join('\n'),
);
