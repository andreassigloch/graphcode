---
name: se:author-actor
version: 1
description: Cut the actor set — the minimum number of distinct roles that makes the system boundary unambiguous, each named by what crosses the boundary, wired only via the one legal path ACTOR io FLOW io FUNC
---

Actors are not a cast list, they are **the boundary**. Every actor you add is a claim that something outside the system sends or receives something the system must handle. Too few and the boundary is undefined; too many and it is fiction. This skill decides the cut — `se:author-uc` writes what happens inside it.

## The one legal wiring — read this before you emit an edge

An `ACTOR` has **exactly two** legal traces in the whole ontology:

```
ACTOR -io-> FLOW        FLOW -io-> ACTOR
```

That is all. `ACTOR compose UC`, `ACTOR io UC`, `ACTOR io FCHAIN`, `ACTOR io FUNC`, `SYS compose ACTOR` — **every one of these is rejected by R-18**, in both directions. The actor reaches a use case only along `ACTOR → FLOW → FUNC`, where that FUNC is a member of one of the UC's function chains. There is no shortcut, and the gate will not invent one for you.

> Two rule texts in the catalogue still contradict this and will be repaired: R-16's fix hint says "link to a UC or FLOW", and CL-01 counts `ACTOR io UC` edges (ITEM-2026-378 / ITEM-2026-379). Follow the grammar, not those two hints.

## At seed time you name actors; you do not wire them

There are no FUNCs yet, so there is nothing legal to wire *to*. Emit the actors as bare nodes via `graph_mutate` and stop. `R-16` (actor with no io) will fire as a **warning** and is the correct state at this point — it closes by itself when the chains exist. Do not silence it with an invented edge; an R-18 rejection costs a whole round.

## The minimum distinct set

**Distinct means: crosses the boundary differently.** Two roles are the same actor when they send and receive the same things. Merge them. An org chart is not an actor set — "junior analyst" and "senior analyst" are one actor unless the system treats what they send differently.

Work it out from the use cases you already have, not from the prose — read them with `graph_elements {type:"UC"}`, and emit the actors with `graph_mutate`:

1. For each UC, name **who triggers it** and **who consumes its result**. Write both down, in the customer's words.
2. Collapse the list: same things crossing → one actor.
3. Keep every non-human counterpart that sits outside the boundary — an external service, a scheduler, a device. "The system itself" is **never** an actor; if you catch yourself writing `ACTOR-system`, the behaviour belongs inside as a FUNC.
4. What is left is the set. Typically 2–5 at the top level. If you have more than 7, you are modelling users, not the boundary.

## Every UC needs a source and a drain

`UC-02` is an **error**, not a warning: a UC that no actor can reach blocks the gate. `FC-04` asks the same of each chain — it needs an actor trigger going **in** and an actor consumer coming **out**. So an actor set that gives some UC no origin, or no destination for its result, is incomplete no matter how tidy it looks.

Check it per use case, both directions. A UC whose result nobody outside receives is either missing an actor or is not a use case.

## Check before you call the set done

- Can you name, for every UC, one actor in and one actor out?
- Would merging any two actors lose a distinction the system actually acts on? If no — merge them.
- Is any actor a part of the system wearing a costume?
- Does every actor appear in at least one use case? An actor with no UC is a leftover from the prose.
