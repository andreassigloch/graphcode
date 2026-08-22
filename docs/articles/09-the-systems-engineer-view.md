# For Systems Engineers: Keep the Thinking, Drop the Bookkeeping

**The short version:** a systems engineer should spend the day on *what the system must do* — not on
keeping a traceability matrix in sync with reality. In graphcode that matrix is not a document
anybody maintains. It is a view of the model, re-rendered on every change. The matrix in this repo
has **125 requirement rows, and nobody typed a single one of them.**

Everything below follows from that one idea: write the content once, in one place, and let every
deliverable fall out of it.

## The job as it usually looks

Most engineers I know spend a minority of their time on the system and a majority on the apparatus
around it. Requirements live in one tool, tests in another, the architecture in a third, and the
links between them live in a spreadsheet that was true three weeks ago. Before every review you stop
engineering and start reconciling.

The tooling was supposed to fix this. Mostly it added a fourth place to keep in sync, plus a
specialist role to operate it, plus diagram ceremony nobody reads afterwards.

## What changes

You describe the content — the users, what the system must do, the functions, the tests that prove
it, and how those hang together. That description lives in one connected model, not in prose. From
there:

**1. Traceability stops being work.**
The requirements traceability matrix, the verification matrix, the interface document, the
architecture allocation, the test concept, the plan, the change log — twelve documents in total —
are *rendered* from the model. Same model in, same bytes out. There is no hand-maintained copy that
can drift behind, because there is no copy at all.

The useful consequence: a hole in the matrix is a hole in the model. It is not a formatting problem
you fix before the review; it is a real gap, and the same check that leaves the hole in the document
also refuses the edit that would create it. One cause, two places you notice it.

**2. You do not need to carry the method in your head.**
The methods are in the tool: concept of operations, FMEA, trade study, assumption review,
implementation planning. You get asked the questions the method asks, in order, and your answers land
in the model in the right shape. That is a deliberate principle — *the tool and the method are the
machine's problem, not the user's.* Nobody has to remember which artefact a design review expects, or
what a well-formed requirement looks like, because the system already does.

This is what makes it usable by people who are not systems engineers at all — and, honestly, more
pleasant for those of us who are.

**3. "Done" means something was measured, not that someone ticked a box.**
Test results are fed back into the model, so a requirement counts as verified when a real run
reported it. The verification matrix in this repo shows exactly that, including the parts that are
not green: some rows say *passed*, some say *failed*, some say *never ran*. That is the point. A
status you can only get by running something is a status you can defend in a review.

**4. Only the tests that can be affected have to run.**
Because the model knows what connects to what, it can name the blast radius of a change and pick the
test set from it. Not "run everything and wait", not "run what I remember matters."

**5. Optimization gets support, not opinions.**
The structure of the system is measured on a handful of plain properties — how modular it is, how
much duplication it carries, how much sits on a single bottleneck. Improvements are then *ranked*
against a target direction you choose, because there is no universal "better": a payment system and
a social app want different tradeoffs, and only you know which one you are building.

Two boundaries matter here. The measurement never blocks anything — it advises, and after each change
it tells you honestly what got better *and what got slightly worse*. And it is arithmetic, not a
language model having a view.

**6. Yesterday's model is still there.**
The model is committed alongside the code, so the state of any past commit can be reconstructed. A
picture that a tool draws from today's code cannot be re-drawn for last spring. A committed model
can — every commit carries the model that went with it.

## Where the AI actually sits

Not where people expect. The assistant proposes content — a requirement, a function, a test. Whether
that content is complete and legal is decided by fixed rules, by query, with no model involved: same
input, same answer, every time, no tokens burned.

So the division of labour is: the machine does the drafting and all of the bookkeeping. The rules do
the checking. **You do the judging.** Which is the part that was always yours.

## The honest limits

- **The rules check form, not truth.** They can tell you every requirement has a test and every
  connection is legal. They cannot tell you it is the *right* requirement. That decision stays with
  you, and no tool is going to take it.
- **Model and code can still drift.** The system knows which file and which test belong to each
  element and complains loudly when a link is missing. It cannot tell you that the code behind a
  correct link does the wrong thing.
- **It asks for discipline.** Every change to the model goes through the same checkpoint, including
  yours. There is no quick hand-edit "just this once" — that is the whole point, and some days it
  will annoy you.

## Who this is for

If you have ever built the traceability matrix the night before the review, this is for you. If you
have ever watched a beautifully modelled system in a heavyweight tool slowly lose touch with the code
that shipped, this is for you.

And if you are not a systems engineer at all — if you direct work rather than type it — you get the
discipline without having to learn the discipline. That is the trade the whole thing is built
around.

```
npx @sigloch/graphcode init
```

---

*Repo: <https://github.com/andreassigloch/graphcode>. The narrative:
[the story](04-the-graphcode-story.md). The engineering detail:
[under the hood](03-graphcode-harness-goal-and-concept.md). Every measurement and what it does or
does not judge: [the scoring landscape](07-the-scoring-landscape.md).*
