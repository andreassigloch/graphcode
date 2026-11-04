# Why AI Agents Convincingly Build the Wrong Thing

**Thesis:** An AI without a precise specification fills every gap with the most likely guess. The
result compiles and looks right — and still isn't what you wanted. The fix comes **before the first
line of code**: a clean specification model that enforces a fixed rule set — without the heavy
tooling of classic modelling (*MBSE* in the jargon), and without an AI having a say in the verdict.

## Plausible is not wanted

Correctness is decided in the specification, not in the code. The
[structure benchmark](01-structure-and-llm-needs.md) puts it to the test: there the prose
specification was deliberately wrong — and the AI still stayed correct, because it followed the
specification model and never read the faulty document.

## Phase 1 does exactly two things

**1. Specification as a model — without the modelling ballast.**
What remains is the substance: *what* the system must do, *how* tests prove it, *what* implements
it, and *how* it all connects. What goes: heavy modelling tools, diagram ceremony, a separate
specialist role. Instead, a lean, linked plan, kept in the same workflow as the code.

**2. Governed by rules — not by AI.**
Whether the specification is complete is judged by a fixed rule set, not by a language model: every
requirement needs a test that checks it; every function needs a module that implements it. The
dashboard shows live what is still missing — the same result on every run, no tokens, no
hallucination. The AI may *propose* content; the rule decides "complete?".

## Specification first, then code

Phase 1 (specification) is the precondition for Phase 2 (implementation). Only a precise,
rule-checked specification turns "plausible" into "wanted" — and makes the lean implementation
loop from [article 01](01-structure-and-llm-needs.md) (a small model, correct from **667 tokens**)
dependable at all. Without Phase 1 the agent guesses the intent; with it, the agent reads it.

## Honest limit

The rule checks the *form* — whether every requirement has its test, whether the connections are
legal. The judgement on *content* — is this the right requirement? — stays with the human. Phase 1
automates recording it cleanly, not the decision.

---

*Repo: <https://github.com/andreassigloch/graphcode>. The implementation benchmark:
[article 01](01-structure-and-llm-needs.md). Concept & stack:
[article 03](03-graphcode-harness-goal-and-concept.md).*
