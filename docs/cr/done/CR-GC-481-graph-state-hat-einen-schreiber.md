# CR-GC-481 — `Graph-State` hat einen Schreiberblock (Pflege, ohne Architektur-Claim)

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-466
Spike, M1 — Entscheidungsvorlage 1, Auftraggeber-Go 2026-09-03

## Root Cause

`FLOW-graph-state` hatte 17 Produzenten. Im Code schreiben nur `kernel/harness.ts`, `kernel/merge.ts`
und `kernel/harness-import.ts` in den Store (nachgemessen: Kuzu-Schreibstatements nur dort; alle
Lifecycle-Schreiber sind Kernel-Methoden). Acht der Produzenten sind Leser oder Aufrufer, als Schreiber
modelliert: `decode` (liest JSON), `graph-export-snapshot` (liest den Graphen), `nd-similarity`
(rechnet im Speicher), `rewind`/`session-shutdown`/`own-kuzu-host` (rufen `reseed`/`close`/`open` —
die Schreiber sind die Kernel-Methoden), `migrate-schema` (kein Code), und `ACTOR-owner` (schreibt unter
L1 über `Mutate-Command`, nie den Zustand). Das Modell log über den Schreiber.

## Änderung (nur Modell, durchs Gate)

Acht `delete-edge` `X -io-> FLOW-graph-state`. Wer liest, liest weiter — die Konsumenten-Kanten
bleiben. Danach 9 Produzenten, alle im Store-Code.

## Gemessen (Spike CR-GC-466, Trockenübung — hier am produktiven Graphen bestätigt)

Δ·w gegen das Zielprofil **+0,006** — unter den Gewichten unsichtbar. CR-01-Warnungen **13 → 9**,
Grenz-Verträge 58 → 52, `scalability` +0,178. Das Zielprofil sieht den Effekt nicht (es gewichtet
`scalability` negativ), Regeln und `graph_suggest`-Rangliste sehen ihn. Deshalb **Pflege**: die
Korrektur ist wahr; ein Architektur-Claim wäre nicht durch das Profil gedeckt — und genau das ist die
Frage, die CR-GC-466 an die Familie gibt (Konzept-CR: was messen die Zieldimensionen?).

## Akzeptanzkriterien

- [x] dryRun 0 Blocker, apply, Export — Diff = genau acht gelöschte `io`-Kanten, sonst nichts.
- [x] `FLOW-graph-state` hat 9 Produzenten, alle mit `realRef` in `harness.ts`/`merge.ts`/`harness-import.ts`.
- [x] Docs-Lane grün.

## Dateien

1. `docs/graph/graphcode.graph.json` + Views (Export)
2. dieser CR
