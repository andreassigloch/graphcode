// Reference implementation from the feasibility spike (the "referenceImpl" — which is just a
// codeRef target, not a new attribute). TEST-recall points here as its scoring tool.
// Recall = |found ∩ truth| / |truth| over the candidate texts.

export function scoreRecall(found: string[], truth: string[]): number {
  if (truth.length === 0) return 1;
  const norm = (s: string) => s.trim().toLowerCase();
  const foundSet = new Set(found.map(norm));
  const hit = truth.filter((t) => foundSet.has(norm(t))).length;
  return hit / truth.length;
}
