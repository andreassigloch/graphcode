# CR-GC-400 — Der Perf-Spike misst das Modellwachstum, nicht die Engine

**Status:** open · **Angelegt:** 2026-08-22 · **Umsetzung:** dieses Repo
**Datei:** `tests/perf.advisory-roundtrip.spike.test.ts`

## Problem — der Test ist heute rot, und zwar zu Recht und aus dem falschen Grund

```
5x cloned SSOT: erwartet 31745 ms < 30000 ms   → FAIL
```

Drei Fakten, alle im Test selbst nachlesbar:

1. **Sein eigener Docstring verbietet die Assertion:** *„Reports numbers; does NOT assert a target
   threshold — that's the REQ this spike is meant to inform, not assume."* Der Code assertiert
   trotzdem zweimal, `< 10_000` und `< 30_000`.
2. **Die Titel sind veraltet.** *„real graphcode SSOT size (382 nodes / 785 edges)"* — tatsächlich
   sind es 667 Knoten und 1746 Kanten. Der 5×-Klon heißt „~1910 nodes", gemessen wurden **3335**.
3. **Der Eingang wächst mit dem Modell, das Budget ist absolut.** `cloneGraph(loadRealGraph(), 5)`
   liest die lebende SSOT. Jeder Knoten, den irgendjemand anlegt, macht diesen Test langsamer —
   unabhängig von der Code-Qualität. Er wird immer wieder rot, und jedes Mal ist die Engine
   unschuldig.

In dieser Sitzung ist das Modell von 636 auf 667 Knoten gewachsen; der Klon damit um rund 155
Knoten. Das hat gereicht.

## Die Messung, die der Test liefert — sie ist wertvoll

```
 667 Knoten / 1746 Kanten:   1418 ms  (read 66 · status 295 · propose 445 · apply 607)
3335 Knoten / 8730 Kanten:  31745 ms  (read 74 · status 7572 · propose 8245 · apply 15754)
```

**5× Knoten → 22× Zeit, `apply` allein 26×.** `read` bleibt bei rund 70 ms — der Store ist nicht der
Engpass, die Regelauswertung ist es. Das ist die Aussage, für die der Spike gebaut wurde, und sie
geht verloren, sobald der Test wegen eines gerissenen Wanduhr-Budgets rot ist statt gelesen zu
werden.

## Änderung

**Fixer Eingang.** Der Klon zielt auf eine feste Größe (~2000 Knoten) statt auf einen Faktor der
lebenden SSOT. Ein Skalierungs-Datenpunkt braucht einen stabilen Eingang, sonst vergleicht er
Äpfel mit dem Modellstand vom Vormonat. Die Titel nennen die gemessene Größe, nicht eine geerbte.

**Assertion auf Kosten pro Element**, nicht auf absolute Millisekunden — `ms/Knoten` unter einer
Schwelle, die aus der heutigen Messung abgeleitet und im Test begründet wird. Dann meldet der Test
eine Regression der Engine und schweigt zu Modellwachstum.

**Der zweite Datenpunkt bleibt absolut**, aber ohne Assertion — die reale SSOT-Größe ist per
Definition beweglich; ihre Zahl gehört ins Protokoll, nicht in eine Schranke. Das stellt den
Docstring wieder her.

## Ausdrücklich nicht

Das Budget von 30 auf 35 Sekunden anheben. Das ist der Symptom-Fix, den die Guardrails verbieten,
und er kauft genau so lange Ruhe, bis jemand die nächsten 150 Knoten anlegt.

## Akzeptanzkriterien

- [ ] Der Eingang ist unabhängig von der Größe der lebenden SSOT.
- [ ] Die Testtitel nennen die tatsächlich gemessene Knoten- und Kantenzahl.
- [ ] Die Assertion ist auf `ms/Knoten` normiert, die Schwelle im Test begründet.
- [ ] Der Realgrößen-Datenpunkt protokolliert, ohne zu assertieren — wie der Docstring es sagt.
- [ ] Ein künstlich verlangsamter Regel-Pfad lässt den Test fallen — **rot gesehen**, sonst ist die
      neue Schwelle nur eine andere Zahl ohne Wirkung.
