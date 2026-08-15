/**
 * scaffold.ts — `graphcode init | update | remove` lifecycle (MOD-cli, FUNC-harness-cli).
 *
 * Self-contained installer that scaffolds the governed graph harness into ANY
 * repo. A member repo consumes `@sigloch/graphcode` as a dependency (CR-121) and
 * launches the MCP-stdio server via the scaffolded `.mcp.json`. The CURRENT
 * architecture is MCP-stdio only (the retired localhost Controller is gone, CR-111).
 * The PreToolUse deny-hooks ARE scaffolded (CR-GC-214): read-side/write-side
 * enforcement must protect agents working in CONSUMER repos, not only this dev repo.
 *
 * Artifacts this CLI owns, per target repo:
 *   - `.graphcode/`            the per-repo Kuzu store dir (`.graphcode/kuzu`, KUZU_DIR).
 *                              `init` creates it; the store inits lazily on first
 *                              `graphcode mcp`. NEVER `:memory:` (REQ-disk-persistence).
 *   - `.mcp.json`             so a Claude-schema agent host launches the server via npx.
 *   - `opencode.json`         the same server in OpenCode's schema (CR-GC-263). Both are
 *                              always written: each is invisible to the other host, and
 *                              which host opens the repo is unknowable at init time. Both
 *                              are MERGED — foreign servers / provider blocks survive.
 *   - `GRAPHCODE.md`          the guardrails doc — the AGENT's contract.
 *   - `GRAPHCODE-STEERING.md` the HUMAN's companion (CR-GC-322): the four decisions
 *                              only the person can make + what `docs/views/` is.
 *   - `.claude/commands/se…`  the MCP-driven SE skills as commands (CR-GC-133/277).
 *   - `.claude/hooks/deny-*.sh` the PreToolUse enforcement hooks (gate-only writes,
 *                              no binary source, no stale-prose reads) — CR-GC-214.
 *   - `.claude/settings.json`  registers those hooks (merged: a member's own hooks +
 *                              other settings keys are preserved).
 *   - `package.json`          gains the `@sigloch/graphcode` dependency.
 *
 * Realizes: REQ-pre-harness-cli (repo + node/npx present), REQ-post-harness-cli
 * (artifacts installed/updated/restlos removed, idempotent, store preserved on
 * update), REQ-repo-install, REQ-repo-update, REQ-repo-uninstall,
 * REQ-install-idempotent.
 *
 * @author andreas@siglochconsulting
 */
import { join, dirname } from 'node:path';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { z } from 'zod/v4';
import { KUZU_DIR } from './index.js';
import {
  PACKAGE_NAME,
  PACKAGE_RANGE,
  GRAPHCODE_DIR,
  MCP_CONFIG,
  OPENCODE_CONFIG,
  GUARDRAILS_FILE,
  STEERING_FILE,
  COMMANDS_DIR,
  LEGACY_SKILLS_DIR,
  LEGACY_WORKSPACE_DIR,
  TRAJECTORY_FILE,
  HOOKS_DIR,
  SETTINGS_FILE,
  packagedSkillsDir,
  packagedHooksDir,
  shippedSkillFiles,
  shippedHookFiles,
  parseSkillFrontmatter,
  isGraphcodeHookEntry,
  mergedSettingsContent,
  mcpConfigContent,
  opencodeConfigContent,
  hostConfigWithoutGraphcode,
  guardrailsContent,
  steeringContent,
  type SettingsShape,
  type HookEntry,
} from './scaffold-templates.js';


/** `CliCommand` (SCHEMA-cli-command) — the npx-CLI verbs this installer dispatches. */
export const CliCommandSchema = z.enum(['init', 'update', 'remove']);
export type CliCommand = z.infer<typeof CliCommandSchema>;

/**
 * `InstallResult` (FLOW-install-result) — what the scaffold created / updated /
 * removed / preserved, plus the resolved repo root. Repo-relative paths so the
 * result is stable/loggable across machines.
 */
export const InstallResultSchema = z.object({
  action: CliCommandSchema,
  repoRoot: z.string(),
  created: z.array(z.string()),
  updated: z.array(z.string()),
  removed: z.array(z.string()),
  preserved: z.array(z.string()),
});
export type InstallResult = z.infer<typeof InstallResultSchema>;

/**
 * `SkillSyncResult` (CR-GC-208) — per-skill diff-report from `graphcode skills sync`.
 * `added`   : the target had no copy → the shipped skill was written.
 * `updated` : the target copy's `version:` was lower/absent → it was overwritten.
 * `unchanged`: the target copy was already at the shipped `version:` → left untouched.
 * Repo-relative paths so the report is stable/loggable across machines.
 */
export const SkillSyncResultSchema = z.object({
  repoRoot: z.string(),
  added: z.array(z.string()),
  updated: z.array(z.string()),
  unchanged: z.array(z.string()),
});
export type SkillSyncResult = z.infer<typeof SkillSyncResultSchema>;

/** Read a scaffolded file if present — used to carry user edits across update. */
function readIfExists(abs: string): string | null {
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}


/** Idempotently write `content` to `abs`; push the repo-relative path to created/updated. */
function writeArtifact(
  abs: string,
  rel: string,
  content: string,
  res: InstallResult,
): void {
  const exists = existsSync(abs);
  // Idempotent: re-writing identical content still counts as the artifact being
  // present; we report created on first appearance, updated otherwise.
  const current = exists ? readFileSync(abs, 'utf8') : null;
  if (current === content) {
    // No change needed — but still owned. Report as preserved so re-running init
    // is observably stable (REQ-install-idempotent).
    res.preserved.push(rel);
    return;
  }
  writeFileSync(abs, content, 'utf8');
  (exists ? res.updated : res.created).push(rel);
}

/**
 * Register `@sigloch/graphcode` in the target package.json `dependencies`.
 * Idempotent: only writes when the range is missing/different; leaves all other
 * keys untouched and preserves the file's existing formatting style (2-space).
 */
function registerDependency(repoRoot: string, res: InstallResult): void {
  const abs = join(repoRoot, 'package.json');
  let pkg: Record<string, unknown> = {};
  const existed = existsSync(abs);
  if (existed) {
    pkg = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  }
  const deps = (pkg.dependencies as Record<string, string> | undefined) ?? {};
  if (deps[PACKAGE_NAME] === PACKAGE_RANGE) {
    res.preserved.push('package.json');
    return;
  }
  deps[PACKAGE_NAME] = PACKAGE_RANGE;
  pkg.dependencies = deps;
  writeFileSync(abs, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  (existed ? res.updated : res.created).push('package.json');
}

/** Remove `@sigloch/graphcode` from the target package.json dependencies (restlos). */
function unregisterDependency(repoRoot: string, res: InstallResult): void {
  const abs = join(repoRoot, 'package.json');
  if (!existsSync(abs)) return;
  const pkg = JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>;
  const deps = pkg.dependencies as Record<string, string> | undefined;
  if (!deps || !(PACKAGE_NAME in deps)) return;
  delete deps[PACKAGE_NAME];
  if (Object.keys(deps).length === 0) delete pkg.dependencies;
  writeFileSync(abs, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  res.updated.push('package.json');
}

/**
 * De-register graphcode from a host config (CR-GC-263): strip our server entry and
 * keep the file iff anything of the user's remains; otherwise delete it. Restlos, but
 * never more than ours — a repo that configured other MCP servers keeps them.
 */
function removeHostConfig(
  abs: string,
  rel: string,
  serversKey: 'mcpServers' | 'mcp',
  res: InstallResult,
): void {
  if (!existsSync(abs)) return;
  const existingRaw = readFileSync(abs, 'utf8');
  const next = hostConfigWithoutGraphcode(existingRaw, serversKey);
  if (next === null) {
    removeArtifact(abs, rel, res);
    return;
  }
  if (next !== existingRaw) {
    writeFileSync(abs, next, 'utf8');
    res.updated.push(rel);
  }
}

/** Delete `abs` if present; record the repo-relative path as removed. */
function removeArtifact(abs: string, rel: string, res: InstallResult): void {
  if (!existsSync(abs)) return;
  rmSync(abs, { recursive: true, force: true });
  res.removed.push(rel);
}

/**
 * Bis CR-GC-330 schrieb graphcode seinen Learning-Feed in `.aimprove/`, den Workspace
 * des Vorgängerprodukts. `remove` versprach restlose Deinstallation, kannte den Ordner
 * aber nicht — in jedem so initialisierten Repo blieb die Datei liegen (CR-GC-331).
 *
 * Entfernt wird ausschließlich unsere `trajectory.jsonl`; der Ordner nur, wenn er danach
 * leer ist. Ein `.aimprove/` mit `learning.db`/`state.json` gehört aimprove selbst und
 * bleibt stehen — wir räumen unsere Datei weg, nicht fremde.
 */
function removeLegacyTrajectory(repoRoot: string, res: InstallResult): void {
  const legacyDir = join(repoRoot, LEGACY_WORKSPACE_DIR);
  if (!existsSync(legacyDir)) return;
  removeArtifact(
    join(legacyDir, TRAJECTORY_FILE),
    join(LEGACY_WORKSPACE_DIR, TRAJECTORY_FILE),
    res,
  );
  if (readdirSync(legacyDir).length === 0) {
    rmSync(legacyDir, { recursive: true, force: true });
  }
}

/**
 * Copy the package's shipped SE skills into the target repo's `.claude/commands/`
 * (CR-GC-277 — als registrierbare Commands: `/se:generate`, `/se-view:arch`, …).
 * Idempotent (byte-identical re-write = `preserved`). The se-* skills are MCP-driven
 * (CR-GC-130/131/132); without this a freshly-init'd member repo has none of them.
 */
function installSkills(repoRoot: string, res: InstallResult): void {
  const srcDir = packagedSkillsDir();
  const files = shippedSkillFiles();
  if (files.length === 0) return; // skills not packaged — substrate still installs.
  for (const f of files) {
    const content = readFileSync(join(srcDir, f), 'utf8');
    const destAbs = join(repoRoot, COMMANDS_DIR, f);
    mkdirSync(dirname(destAbs), { recursive: true });
    writeArtifact(destAbs, join(COMMANDS_DIR, f), content, res);
  }
  removeLegacySkills(repoRoot, res);
}

/**
 * Bis 0.9.0 landeten die Skills flach unter `.claude/skills/se-*.md` — dort
 * registrierte sie nichts. install/update/remove räumen diese verwaisten Kopien
 * ab (nur das paketeigene `se-*.md`-Muster, nie Member-Skills); keine parallelen
 * Pfade zwischen Alt- und Neu-Layout.
 */
function removeLegacySkills(repoRoot: string, res: InstallResult): void {
  const legacyDir = join(repoRoot, LEGACY_SKILLS_DIR);
  if (!existsSync(legacyDir)) return;
  for (const f of readdirSync(legacyDir)) {
    if (f.startsWith('se-') && f.endsWith('.md')) {
      removeArtifact(join(legacyDir, f), join(LEGACY_SKILLS_DIR, f), res);
    }
  }
  if (readdirSync(legacyDir).length === 0) {
    rmSync(legacyDir, { recursive: true, force: true });
  }
}

/**
 * Re-copy the shipped `se-*.md` skills into the target repo's `.claude/skills/`, overwriting
 * ONLY on a `version:` mismatch (CR-GC-208 — anti-drift). Compares the shipped skill's
 * frontmatter `version:` against the target copy's:
 *   - no target copy            → write it, report `added`.
 *   - shipped version > target  → overwrite, report `updated` (a stale/older/un-stamped copy).
 *   - shipped version == target → leave untouched, report `unchanged`.
 * Reuses `shippedSkillFiles()` + `parseSkillFrontmatter()` — no parallel copy path. A shipped
 * version LOWER than the target is never written back (the package is the source of truth, but
 * we don't downgrade a member who is somehow ahead — report `unchanged`).
 */
export function syncSkills(repoRoot: string): SkillSyncResult {
  const res: SkillSyncResult = { repoRoot, added: [], updated: [], unchanged: [] };
  const srcDir = packagedSkillsDir();
  const files = shippedSkillFiles();
  if (files.length === 0) return res; // skills not packaged — nothing to sync.
  // Alt-Layout-Migration läuft auch über sync (nicht nur init/update) — sonst
  // koexistieren Command- und Legacy-Kopie bis zum nächsten `graphcode update`.
  removeLegacySkills(repoRoot, { action: 'update', repoRoot, created: [], updated: [], removed: [], preserved: [] });
  for (const f of files) {
    const rel = join(COMMANDS_DIR, f);
    const content = readFileSync(join(srcDir, f), 'utf8');
    const destAbs = join(repoRoot, COMMANDS_DIR, f);
    mkdirSync(dirname(destAbs), { recursive: true });
    if (!existsSync(destAbs)) {
      writeFileSync(destAbs, content, 'utf8');
      res.added.push(rel);
      continue;
    }
    const shippedVersion = parseSkillFrontmatter(content).version;
    const targetVersion = parseSkillFrontmatter(readFileSync(destAbs, 'utf8')).version;
    if (shippedVersion > targetVersion) {
      writeFileSync(destAbs, content, 'utf8');
      res.updated.push(rel);
    } else {
      res.unchanged.push(rel);
    }
  }
  return res;
}

/**
 * Remove the graphcode-shipped skills restlos — only the `se-*.md` files this package
 * owns (never a member's own skills). Prune `.claude/skills` / `.claude` only when WE
 * emptied them.
 */
function removeSkills(repoRoot: string, res: InstallResult): void {
  removeLegacySkills(repoRoot, res);
  const destDir = join(repoRoot, COMMANDS_DIR);
  if (!existsSync(destDir)) return;
  for (const f of shippedSkillFiles()) {
    removeArtifact(join(destDir, f), join(COMMANDS_DIR, f), res);
    // Namespace-Unterordner (se/, se-view/) mit entfernen, wenn WIR sie geleert haben.
    const sub = dirname(join(destDir, f));
    if (sub !== destDir && existsSync(sub) && readdirSync(sub).length === 0) {
      rmSync(sub, { recursive: true, force: true });
    }
  }
  // Prune `.claude/commands` if WE emptied it; the shared `.claude/` prune runs once after
  // both skills + hooks are removed (pruneClaudeIfEmpty).
  if (readdirSync(destDir).length === 0) {
    rmSync(destDir, { recursive: true, force: true });
  }
}

/**
 * Copy the package's `deny-*.sh` PreToolUse hooks into the target repo's `.claude/hooks/`
 * and register them in `.claude/settings.json` (CR-GC-214). Idempotent (byte-identical
 * re-write = `preserved`). Without this, consumer-repo agents have no read/write enforcement.
 */
function installHooks(repoRoot: string, res: InstallResult): void {
  const srcDir = packagedHooksDir();
  const files = shippedHookFiles();
  if (files.length === 0) return; // hooks not packaged — substrate still installs.
  const destDir = join(repoRoot, HOOKS_DIR);
  mkdirSync(destDir, { recursive: true });
  for (const f of files) {
    const content = readFileSync(join(srcDir, f), 'utf8');
    writeArtifact(join(destDir, f), join(HOOKS_DIR, f), content, res);
  }
  // Register, merging so a member's own hooks + other settings keys survive.
  const abs = join(repoRoot, SETTINGS_FILE);
  const existingRaw = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  writeArtifact(abs, SETTINGS_FILE, mergedSettingsContent(existingRaw), res);
}

/**
 * Remove the graphcode-shipped hooks restlos — the `deny-*.sh` files this package owns and
 * its PreToolUse registrations in `.claude/settings.json`. A member's own hooks / other
 * settings keys survive; an emptied settings file or `.claude/hooks` dir is pruned.
 */
function removeHooks(repoRoot: string, res: InstallResult): void {
  // Strip our registrations from settings.json first.
  const abs = join(repoRoot, SETTINGS_FILE);
  if (existsSync(abs)) {
    const existingRaw = readFileSync(abs, 'utf8');
    const existing = JSON.parse(existingRaw) as SettingsShape;
    const hooks = existing.hooks && typeof existing.hooks === 'object' ? existing.hooks : {};
    const nextHooks: Record<string, unknown> = { ...hooks };
    // Every event we register, not just PreToolUse (CR-GC-356) — and driven by what is
    // ACTUALLY in the file, so removing still works for a repo scaffolded by an older
    // version that registered events this one no longer ships.
    for (const [event, entries] of Object.entries(hooks)) {
      if (!Array.isArray(entries)) continue;
      const userOwned = (entries as HookEntry[]).filter((e) => !isGraphcodeHookEntry(e));
      if (userOwned.length > 0) nextHooks[event] = userOwned;
      else delete nextHooks[event];
    }
    const next: SettingsShape = { ...existing };
    if (Object.keys(nextHooks).length === 0) delete next.hooks;
    else next.hooks = nextHooks as SettingsShape['hooks'];
    if (Object.keys(next).length === 0) {
      removeArtifact(abs, SETTINGS_FILE, res); // settings was graphcode-only.
    } else {
      const nextRaw = JSON.stringify(next, null, 2) + '\n';
      if (nextRaw !== existingRaw) {
        writeFileSync(abs, nextRaw, 'utf8');
        res.updated.push(SETTINGS_FILE);
      }
    }
  }
  // Then the hook files.
  const destDir = join(repoRoot, HOOKS_DIR);
  if (existsSync(destDir)) {
    for (const f of shippedHookFiles()) {
      removeArtifact(join(destDir, f), join(HOOKS_DIR, f), res);
    }
    if (readdirSync(destDir).length === 0) {
      rmSync(destDir, { recursive: true, force: true });
    }
  }
}

/** Prune the target's `.claude/` dir iff WE emptied it (skills + hooks both removed). */
function pruneClaudeIfEmpty(repoRoot: string): void {
  const claudeDir = join(repoRoot, '.claude');
  if (existsSync(claudeDir) && readdirSync(claudeDir).length === 0) {
    rmSync(claudeDir, { recursive: true, force: true });
  }
}

/**
 * Scaffold the harness into `opts.repoRoot`.
 *
 * - `init`   : create `.graphcode/`, write `.mcp.json` + guardrails, register the
 *              dependency. Idempotent — re-running never duplicates or corrupts.
 * - `update` : refresh `.mcp.json` + guardrails (+ dep), but PRESERVE the store
 *              (`.graphcode/kuzu` is never touched).
 * - `remove` : remove every artifact this CLI installed, restlos (incl. `.graphcode/`).
 */
export async function scaffold(
  action: CliCommand,
  opts: { repoRoot: string },
): Promise<InstallResult> {
  const repoRoot = opts.repoRoot;
  const res: InstallResult = {
    action,
    repoRoot,
    created: [],
    updated: [],
    removed: [],
    preserved: [],
  };

  const graphcodeAbs = join(repoRoot, GRAPHCODE_DIR);
  const mcpAbs = join(repoRoot, MCP_CONFIG);
  const opencodeAbs = join(repoRoot, OPENCODE_CONFIG);
  const guardrailsAbs = join(repoRoot, GUARDRAILS_FILE);
  const steeringAbs = join(repoRoot, STEERING_FILE);

  switch (action) {
    case 'init': {
      // The per-repo workspace dir. The Kuzu store opens lazily under it on first
      // `graphcode mcp`; init only ensures the parent exists (no fake store).
      if (existsSync(graphcodeAbs)) {
        res.preserved.push(GRAPHCODE_DIR + '/');
      } else {
        mkdirSync(graphcodeAbs, { recursive: true });
        res.created.push(GRAPHCODE_DIR + '/');
      }
      writeArtifact(mcpAbs, MCP_CONFIG, mcpConfigContent(repoRoot, readIfExists(mcpAbs)), res);
      writeArtifact(
        opencodeAbs,
        OPENCODE_CONFIG,
        opencodeConfigContent(repoRoot, readIfExists(opencodeAbs)),
        res,
      );
      writeArtifact(guardrailsAbs, GUARDRAILS_FILE, guardrailsContent(), res);
      // CR-GC-322: the human's companion doc. Shipped copy, so `update` REFRESHES it
      // like the guardrails — it carries no user content to preserve.
      writeArtifact(steeringAbs, STEERING_FILE, steeringContent(), res);
      installSkills(repoRoot, res);
      installHooks(repoRoot, res);
      registerDependency(repoRoot, res);
      return res;
    }

    case 'update': {
      // Refresh installed artifacts; NEVER wipe the store (REQ-repo-update). The
      // `.graphcode/` dir + its `kuzu` store are explicitly preserved.
      const kuzuAbs = join(repoRoot, KUZU_DIR);
      if (existsSync(kuzuAbs)) res.preserved.push(KUZU_DIR + '/');
      else if (existsSync(graphcodeAbs)) res.preserved.push(GRAPHCODE_DIR + '/');
      else {
        mkdirSync(graphcodeAbs, { recursive: true });
        res.created.push(GRAPHCODE_DIR + '/');
      }
      writeArtifact(mcpAbs, MCP_CONFIG, mcpConfigContent(repoRoot, readIfExists(mcpAbs)), res);
      writeArtifact(
        opencodeAbs,
        OPENCODE_CONFIG,
        opencodeConfigContent(repoRoot, readIfExists(opencodeAbs)),
        res,
      );
      writeArtifact(guardrailsAbs, GUARDRAILS_FILE, guardrailsContent(), res);
      // CR-GC-322: the human's companion doc. Shipped copy, so `update` REFRESHES it
      // like the guardrails — it carries no user content to preserve.
      writeArtifact(steeringAbs, STEERING_FILE, steeringContent(), res);
      installSkills(repoRoot, res);
      installHooks(repoRoot, res);
      registerDependency(repoRoot, res);
      return res;
    }

    case 'remove': {
      // Restlose Deinstallation — remove everything init/update installed. The two host
      // configs are de-registered key-wise (CR-GC-263), not deleted wholesale: a foreign
      // MCP server in `.mcp.json` / a `provider` block in `opencode.json` is not ours.
      removeArtifact(graphcodeAbs, GRAPHCODE_DIR + '/', res);
      removeHostConfig(mcpAbs, MCP_CONFIG, 'mcpServers', res);
      removeHostConfig(opencodeAbs, OPENCODE_CONFIG, 'mcp', res);
      removeArtifact(guardrailsAbs, GUARDRAILS_FILE, res);
      removeArtifact(steeringAbs, STEERING_FILE, res);
      removeSkills(repoRoot, res);
      removeHooks(repoRoot, res);
      removeLegacyTrajectory(repoRoot, res);
      pruneClaudeIfEmpty(repoRoot);
      unregisterDependency(repoRoot, res);
      return res;
    }
  }
}
