/**
 * se-author-uc — the executable UC-authoring style linter (CR-GC-211).
 *
 * The testable core behind the `se:author-uc` skill. A use case is the ConOps
 * entry point: it must be terse (Actor–Verb–Object–Outcome, no implementation
 * detail) and spend almost no jargon — graphify's UCs drifted to 60–90 words
 * dense with load-bearing terms (`SlicerInput`, `ElementType`, `V3_RULES`),
 * simultaneously too long AND too technical.
 *
 * Style is a WARNING, not a gate error (no engine rule is forked into
 * `@sigloch/contracts/se` — that would need a family-review + version bump). This
 * linter lets the skill self-check and the test catch a deliberately-bad UC.
 *
 * @author andreas@siglochconsulting
 */

/** UC description word ceiling — terse Actor–Verb–Object–Outcome. */
export const UC_MAX_WORDS = 25;
/** Jargon budget per UC — at most this many load-bearing technical terms. */
export const UC_JARGON_BUDGET = 2;

/**
 * A load-bearing jargon token: CamelCase (`SlicerInput`, `ElementType`) or
 * CONSTANT_CASE (`V3_RULES`, `TRACE_PATTERNS`). Plain capitalized words (a
 * sentence start, an actor name) are NOT jargon.
 */
const JARGON = /\b([A-Z][a-z]+(?:[A-Z][a-z]*)+|[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)*)\b/g;

export interface UcLintResult {
  uid: string;
  wordCount: number;
  /** Over the 25-word ceiling. */
  tooLong: boolean;
  /** The load-bearing jargon terms found. */
  jargon: string[];
  /** More than UC_JARGON_BUDGET jargon terms. */
  overBudget: boolean;
  /** Jargon terms NOT backed by a `SCHEMA`/`REQ` node (undefined → must not be used). */
  ungrounded: string[];
  /** True iff terse AND within the jargon budget AND every term is grounded. */
  ok: boolean;
}

/** Normalize a token for grounding comparison. */
const norm = (s: string) => s.toLowerCase();

/**
 * Lint one UC description against the style rule. `groundedTerms` is the set of
 * terms that ARE defined in the model (from `groundedTermsFrom`); a jargon term
 * absent from it is undefined and flagged.
 */
export function lintUc(uid: string, description: string, groundedTerms: Set<string>): UcLintResult {
  const words = description.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const jargon = [...new Set(description.match(JARGON) ?? [])];
  const ungrounded = jargon.filter((t) => !groundedTerms.has(norm(t)));
  const tooLong = wordCount > UC_MAX_WORDS;
  const overBudget = jargon.length > UC_JARGON_BUDGET;
  return {
    uid,
    wordCount,
    tooLong,
    jargon,
    overBudget,
    ungrounded,
    ok: !tooLong && !overBudget && ungrounded.length === 0,
  };
}

/**
 * Build the grounded-term set from a graph's `SCHEMA` + `REQ` nodes — a jargon
 * term is "defined" iff it appears (as a token) in one of those nodes' uid/name.
 */
export function groundedTermsFrom(
  nodes: Array<{ type: string; uid: string; name?: string }>,
): Set<string> {
  const grounded = new Set<string>();
  for (const n of nodes) {
    if (n.type !== 'SCHEMA' && n.type !== 'REQ') continue;
    for (const part of `${n.uid} ${n.name ?? ''}`.split(/[^A-Za-z0-9]+/)) {
      if (part) grounded.add(norm(part));
    }
  }
  return grounded;
}
