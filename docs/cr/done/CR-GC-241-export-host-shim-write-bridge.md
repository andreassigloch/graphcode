# CR-GC-241 — Export the host-shim write bridge (callHost/HOST_SOCK_BASENAME)

**Status:** Open (implemented, pending review) · 2026-07-07
**Paket:** `@sigloch/graphcode` (public surface, `src/index.ts`)
**Quelle:** graph-view-edit CR-GVE-008 session — graph-view-edit needs a gated write transport
and, per CR-GC-235's own "Familie-Entscheid" note, is the anticipated first external consumer.

## Problem

CR-GC-235 (Phase A, write-service topology) built `.graphcode/host.sock` — a local Unix socket
the elected host serves so a second `graphcode mcp` process can proxy tool calls (including
`graph_mutate`) through the SAME Apply-Gate without opening a second Kuzu handle. `callHost` /
`HOST_SOCK_BASENAME` (`src/host-shim.ts`) are the client side of that — but they were never added
to `src/index.ts`'s public export list, only `./`, `./harness`, `./mcp` are published
(`package.json` `exports`). CR-GC-235's own doc flagged this explicitly: "kein Familie-Package
hängt von `@sigloch/graphcode` als Library ab... die SSE-Bridge hat noch keinen Live-Consumer
(graph-view-edit ungebaut)" — i.e. graph-view-edit becoming a real external consumer was the
anticipated trigger for opening this up, just not yet executed.

graph-view-edit (CR-GVE-008) needs exactly this: a write transport for its edit-surface that
never becomes a second Kuzu owner. Without the export, the only options were (a) reimplement the
socket's newline-delimited-JSON wire protocol by hand outside this package — real drift risk if
the protocol changes without a public-API contract — or (b) fall back to CR-GVE-008's original,
riskier design (graph-view-edit opens its own `createHarness` and becomes a second owner, guarded
by a hand-rolled lock check). Neither is as good as using the real client function that already
exists and is already tested (`tests/host-shim.test.ts`).

## Decision

Export `callHost`, `HOST_SOCK_BASENAME`, `startHostSocket`, and the `HostSocket` type from
`src/index.ts`, right after the existing `HostBridge`/`serveHost` (read-only bridge) exports in
the "Viewer surface — PROVISIONAL" section — this is the write-path counterpart to that existing
read-only bridge. `startHostSocket` is exported purely so a consumer's integration tests can spin
up a real temp-disk harness + its own throwaway socket rather than pointing at (and risking
mutating) a live repo's store.

No protocol change, no new AuthN — the socket stays local-only, no new outward transport (the
project's own "one transport = MCP-stdio (+ read-only SSE bridge)" constraint is unchanged: this
publishes the *client* for an *internal* shim hop, it does not add a new outward-facing protocol).
The no-AuthN scoping CR-GC-235 already accepted (local, single-user) covers this use: a consumer
process calling `callHost` still needs local filesystem access to find `.graphcode/host.sock`,
the same trust boundary as repo access.

## Acceptance

- [x] `export { callHost, HOST_SOCK_BASENAME } from './host-shim.js'` + `export type { HostSocket }`
      added to `src/index.ts`, next to the `HostBridge` exports.
- [x] `npm run build` clean.
- [x] `npm test` — 270/270 passed (no regressions; host-shim's own behavior is unchanged, only its
      export surface widened).
- [ ] Family review / merge (this CR is filed from an external consumer session — flagging for
      the usual review before landing on the default branch).

## Out of scope

- Phase B (public streamable-HTTP write endpoint) — still its own, separate family decision per
  CR-GC-235; this CR only publishes the existing internal-shim client, nothing new is reachable
  over the network.
- AuthN/AuthZ at the socket — unchanged from CR-GC-235's scoping (local, single-user).

## Dependencies

CR-GC-235 (the socket + `callHost` this exports).
