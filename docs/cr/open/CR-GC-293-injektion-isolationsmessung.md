# CR-GC-293 — Injektion isoliert messen (kein Code, nur ein Lauf)

**Status:** open — Mess-Schalter implementiert + getestet, Vergleichslauf noch
ausstehend (Nachtrag 2026-08-04)
**Datum:** 2026-08-03
**Kontext:** `docs/executor-abschlussbericht.md`, Nachtrag 2026-08-01, Punkt 3: „Injektion
(CR-285) nützt Frontier, hungert Local aus" — devstral v15 (mit Injektion) 22 Elemente
vs. v9 (ohne) 38, aber der Bericht selbst räumt ein: „Messung konfundiert 284+285
(Template-Änderung + Injektion) — der Turn-Effekt ist eindeutig 285, der
Ausbeute-Einbruch mutmaßlich beides."

## Ausgangslage

v9 hat WEDER Preflight (CR-284) NOCH Injektion (CR-285). v15 hat BEIDE. Der Vergleich
zeigt also den kombinierten Effekt, nicht den von Injektion allein. Diese Session hat
zusätzlich gezeigt: Preflight allein erklärt bereits einen großen Teil der Differenz auf
der FEHLER-Seite (R-18/R-01/R-08 gehen in v15 auf 0, unabhängig von Injektion — das ist
deterministische Preflight-Reparatur, siehe CR-GC-284). Ob Injektion für lokal auf der
ELEMENTE-Seite (22 vs. 38) tatsächlich noch zusätzlich schadet, wenn Preflight schon
aktiv ist, ist unbekannt.

## Ziel

**Ein Messlauf, kein Code:** devstral, gleiche Konfiguration wie `v18-bo3` (Preflight +
CR-289-Ranking aktiv), aber **Injektion (`buildRoundInjection`) für diesen Lauf
deaktiviert** — vergleiche Elementzahl, Turn-Verteilung (Lese- vs. Mutate-Turns) und
Warning-Profil gegen `v18-bo3` (40 Elemente, 78 Traces, R-15=34/R-14=23/R-02=13/R-20=13/
R-22=13, 0 Errors).

Damit die Injektion für einen einzelnen Lauf abschaltbar ist, braucht es einen
minimalen Schalter (kein neues Feature, keine Config-Fläche für die Zielnutzung —
nur ein Test-/Mess-Flag, das nach der Messung wieder entfernt werden kann, falls das
Ergebnis für "immer an" spricht).

## Abgrenzung

- Kein Entscheid über eine dauerhafte Injection-Config in diesem CR — das ist eine
  Folge dieser Messung, nicht ihr Gegenstand.
- Keine Änderung an Rules/Preflight-Logik/ΔM/ℝ⁶; der Schalter berührt nur, ob
  `buildRoundInjection` aufgerufen wird.

## Umsetzung (2026-08-04)

- `src/executor.ts`: `ExecutorConfigSchema.injection` (`boolean`, default `true`) —
  wenn `false`, wird `buildRoundInjection` im Runden-Loop nicht aufgerufen (Guide-Slice
  + Element-Index entfallen ersatzlos, die generative Instruktion selbst bleibt).
- `src/run-verb.ts`: `GRAPHCODE_LLM_INJECTION` Env-Var (`"false"` → `injection:false`,
  alles andere/fehlend → `true`) — der Schalter ist damit von der CLI aus nutzbar
  (`graphcode run`), kein separates Test-only-Flag.

## Validierung

- Unit (`tests/executor.test.ts`): `injection:false` unterdrückt den kompletten
  Guide/Index-Injektionsblock im Runden-Prompt, die generative Instruktion bleibt.
- Unit (`tests/cli.run.test.ts`): `GRAPHCODE_LLM_INJECTION` togglet den Schalter korrekt
  (default true, "false" → false, "true" → true).
- `npm run build` + volle Suite (68 Dateien / 427 Tests) grün.
- **Messlauf noch ausstehend:** in dieser Session wurden zwei volle `v18-bo3`-Läufe
  (mit Injektion, zur R-12-Nachzählung für CR-GC-292) gefahren — beide stagnierten in
  der `uc`-Dimension durch einen unabhängigen Bug (R-15/uc-Template-Lücke, gefixt in
  CR-GC-290-Nachtrag) und liefern deshalb KEINE verwertbare Baseline für den
  Injection-Vergleich. Der eigentliche `injection:false`-Vergleichslauf gegen die
  (jetzt gefixte) `v18-bo3`-Konfiguration wurde noch nicht gefahren — Ressourcen-Grenze
  dieser Session (siehe CR-GC-292-Nachtrag: LM-Studio-Box zeigte bereits Timeout-
  Symptome unter kumulierter Last).

## Nächster Schritt

Nach dem sauberen R-12-Recount für CR-GC-292 (frische Box, R-15/uc-Fix aktiv) denselben
Lauf ein zweites Mal mit `GRAPHCODE_LLM_INJECTION=false` wiederholen und vergleichen
(Elementzahl, Turn-Profil, Warning-Profil) — der Schalter ist einsatzbereit, es fehlt
nur noch der eigentliche Messlauf.

## Dateien (≤6)

- `src/executor.ts` (Mess-Schalter)
- `src/run-verb.ts` (Env-Var-Plumbing)
- `tests/executor.test.ts`
- `tests/cli.run.test.ts`
- Ergebnis-Artefakte unter `rig/greenfield-systemtest/results/` (kein Quellcode) —
  noch ausstehend

## Akzeptanzkriterien

- [x] Mess-Schalter implementiert (Config + Env), Unit-getestet
- [ ] Lauf durchgeführt (devstral, `v18-bo3`-Konfiguration minus Injektion)
- [ ] Vergleich gegen `v18-bo3` dokumentiert (Elemente, Warnings, Turn-Profil)
- [ ] Empfehlung für die Injection-Config-Entscheidung (an/aus je Backend) aktualisiert
      oder bestätigt
