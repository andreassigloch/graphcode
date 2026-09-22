# CR-GC-588: Naechster Fokus in der graph_mutate-Antwort: nach angewandtem Batch den kompakten naechsten GenerationStep mitliefern — 55 % der Mutationen kamen ohne frisches graph_generate, Turns sind der Kostentreiber

**Status:** ✅ Umgesetzt, Kriterium 2 faellt mit dem Phase-1-Lauf
**Typ:** aus Item ITEM-2026-437 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-437.json (Lane: graph)

---

**Reihenfolge:** nach CR-GC-587. **Beachte** [[one-imperative-principle]]: derselbe Schritt, anderer Transport — keine zweite Stimme.

## 1 Befund

Zwischen zwei Mutationen lag in 12–26 von 25–44 Faellen je Lauf **kein** `graph_generate`
(Bericht „Zeitlinie“, Spalte „Mutationen ohne frischen Fokus“, ~55 %). Dort steuert nur die
Gate-Antwort — und die sagt, was falsch ist, nicht was als Naechstes dran ist. Holt der Agent den
Fokus doch, kostet das einen Roundtrip; Turns sind seit CR-GC-570/579 der Kostentreiber (die
Cache-Lesung waechst mit Turns × Kontext: 41.601–86.142 Tokens je Element).

## 2 Zielbild

Nach einem **angewandten** Batch traegt die `graph_mutate`-Antwort ein Feld `next`: den kompakten
`GenerationStep` (phase, done, focusKey, focusTypes, der eine Imperativ) — berechnet von
`generationStep`, nicht neu formuliert. Bei `dryRun` und bei Ablehnung kein `next` (dort ist das
Urteil der Kanal). `graph_generate` bleibt fuer den Einstieg und fuer Hosts, die `next` ignorieren.

## 3 Umfang

`src/surface/write.ts` (Antwort), `src/loop/generate.ts` (kompakte Projektion), Test
`tests/mcp.mutate-next-step.test.ts`, Gate-Protokoll-Satz (ueber das Register aus CR-GC-587).

## 4 Kriterien

1. `next` gleich dem Schritt, den `graph_generate` unmittelbar danach liefern wuerde (Test).
2. Gemessen wird mit dem Standardbericht (`report.mjs`, Abschnitte CR-GC-585 „Steuerung“ und CR-GC-586 „Auto gegen Hand“), Claude-Code-Arm, sigllm-Prosa-Korpus, n ≥ 2. Turns je Element sinken gegenueber `opus5-9` (0,31) und Runde 7 (0,33–0,46), Fokus-Befolgung bleibt ≥ 85 %.
3. Antwortgroesse: `next` kostet < 5 % der mittleren `graph_mutate`-Antwort.

## 5 Ergebnis (2026-09-22)

- `src/loop/next-step.ts`: `compactStep` (Schritt ohne Gate-Protokoll und ohne Readiness-Tabellen)
  und `nextStepAfterApply` — derselbe `generationStep`-Aufruf wie `graph_generate` fuer einen Host
  (Intention aus dem SYS, Host-Schwelle, `selection: 'host'`, Profil frisch). `defer` kennt die
  Mutation nicht: Zurueckstellen bleibt der eine Fall fuer `graph_generate`.
- `write.ts`: `next` nur nach angewandter Mutation; nicht auf Probe, nicht auf Ablehnung.
- Host-Protokoll (Register): Schritt 4 zeigt auf `next`; der Treiber-Prompt bleibt unveraendert
  (der Executor geht am Tool vorbei ans Gate).
- Abnahme `tests/mcp.mutate-next-step.test.ts`: `next` ≡ `compactStep(graph_generate)`, Prompt ist
  Praefix, keine Tabellen, kleiner als die ersetzte Antwort, fehlt auf Probe/Ablehnung.

Kriterium 2 (Turns je Element sinken, Fokus-Befolgung ≥ 85 %) misst der Phase-1-Lauf im Bericht.
**Kongruenz:** benannte Ausnahme.