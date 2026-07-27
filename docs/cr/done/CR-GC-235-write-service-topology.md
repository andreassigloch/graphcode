# CR-GC-235: Ein Write-Channel — Host-owned Store, Sessions als Clients (Singleton-Election)

**Status:** Open (2026-07-02) · **Milestone:** `MS-7-concurrency` · **Max Files:** 6
**Graph (SSOT):** geseedet (gate-only) `CR-GC-235`; REQ/FUNC/TEST bei Pick-up. Pointer, nicht autoritativ.
**Kontext:** Enterprise-Merge-Ladder Stufe 4 — die eigentliche Enterprise-Topologie: **ONE database,
one write channel, multiple read** (User-Zielbild 2026-07-02); Architektur-Vorlage für den aise-Nachfolger.

## Problem (Why)

Heute embedded **jede Session** ihren eigenen `graphcode mcp`-Prozess samt Store (wie jeder Client, der
sein eigenes SQLite linkt). CR-218/O2 macht den zweiten Writer auf demselben Store zwar **laut** (Refusal
statt Clobber) — aber er kann nicht **arbeiten**. Ziel: zweite Claude-Instanz UND parallele Subagents auf
demselben Verzeichnis arbeiten alle am **einen** Modell, seriell durchs eine Gate — Divergenz entsteht
innerhalb eines Modells gar nicht erst (Merge nur noch für **gewollte** Branches, CR-234).

## Decision (Phase A — Shim; hält den Transport-Lock in Letter + Spirit)

- **Singleton-Election via O2-Lock:** jeder `graphcode mcp`-Start versucht `owner.lock` (CR-218).
  **Gewinner = Host**: owns Store + Gate, bedient seine Session via stdio UND öffnet einen lokalen
  Unix-Socket (`.graphcode/host.sock`). **Verlierer = Client**: statt `StoreOwnershipError` zu sterben,
  degradiert der Prozess zum **dünnen stdio→Socket-Proxy** — dieselben 17+ Tools, geforwardet an den Host.
- Damit: Agents sprechen weiterhin **MCP-stdio** (der verriegelte Transport); der Socket ist ein
  interner Shim-Hop, keine zweite API-Surface (kein Express/REST, kein neues Protokoll nach außen).
- **Alle Writes** laufen durchs eine Gate (O3-serialisiert) + OCC (CR-233); **Reads** bedient der Host
  aus seiner In-Memory-Working-Copy (MVCC-artiger Snapshot, Reader blockieren den Writer nie).
- **Host-Lifecycle:** Host-Exit released den Lock (CR-218); nächster Client-Start gewinnt die Election.
  Client-Verhalten bei totem Socket: ein Reconnect-/Re-Election-Versuch, dann klarer Fehler.
- **Scope unverändert:** ein Host **pro Store** (= pro Worktree). `gcw`-Worktrees behalten volle
  Isolation (Tier 2); dieser CR entfernt nur die *ungewollte* Konkurrenz im geteilten Verzeichnis.

## Familie-Entscheid (Frontrunner — verifiziert 2026-07-02)

Doublecheck ausgeführt: **kein** Familie-Package hängt von `@sigloch/graphcode` als Library ab; jeder
`.graphcode`-Store ist repo-lokal; graphify konsumiert graphcode ausschließlich über das gescaffoldete
`.mcp.json` (eigener Store — Update kommt via `graphcode update`); die SSE-Bridge hat noch keinen
Live-Consumer (graph-view-edit ungebaut). → graphcode ist **alleiniger Nutzer** von Store + MCP-Surface;
der Transport-Lock-Touch wird hier als Frontrunner-Entscheid dokumentiert und beim nächsten Familie-Sync
notiert (`bok` governance) — kein separates Review-Verfahren nötig. **Phase B** (MCP über streamable
HTTP statt Shim, config-level Upgrade) bleibt explizit ein späterer, eigener Entscheid.

## Akzeptanz

- Zwei `graphcode mcp` auf demselben Verzeichnis: **beide funktionsfähig**; Prozess 2 ist Proxy;
  ein Mutate von Client 2 ist im nächsten Read von Client 1 sichtbar (ein Modell).
- Kill des Hosts → Lock-Reclaim (CR-218-Stale-Pfad) → nächster Start wird Host; kein toter Zustand.
- Gate-Semantik über den Shim identisch zu direkt (Symmetrie-Test analog CR-124).
- `docs/CONCURRENCY.md` aktualisiert (Election ersetzt das reine Refusal); Scaffold-`GRAPHCODE.md`-Zeile.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- **Phase B:** streamable-HTTP-Endpoint (öffnet den Transport-Lock formal; eigener Familie-Entscheid).
- Multi-Host-übergreifende Koordination (Remote-Teams) · AuthZ/AuthN am Socket (lokal, single-user).

## Dependencies

**CR-GC-218** (Lock = Election-Mechanik) · **CR-GC-233** (OCC am geteilten Write-Channel; empfohlen davor).
`src/mcp-server.ts` · `src/cli.ts` · neu `src/host-shim.ts`.
