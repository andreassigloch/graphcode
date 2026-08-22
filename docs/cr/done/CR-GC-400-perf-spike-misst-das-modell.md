# CR-GC-400 — Der Perf-Spike misst das Modellwachstum, nicht die Engine

**Status:** done · **Angelegt:** 2026-08-22 · **Umgesetzt:** 2026-08-22 · **Umsetzung:** dieses Repo
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

## Die andere Hälfte liegt in sigloch-modules

Dieser CR macht den Spike wieder lesbar; er erklärt die 22× nicht. Das tun zwei CRs im
Regelsatz-Repo, und sie hängen an dieser Messung:

- **CR-SM-260** (Profil je Regel) — die Rangliste, welche der 73 Regeln die Kurve trägt.
  `read` bleibt bei 70 ms, also ist es die Regelauswertung, nicht der Store.
- **CR-SM-261** (Adjazenz-Index + Memoisierung) — der Eingriff, **gegated auf CR-SM-260**.
  Er nennt diesen CR als Perf-Wächter, ohne den die nächste Regel-Erweiterung unbemerkt bleibt.

Wer nur einen der drei umsetzt, hat entweder eine Zahl ohne Ursache oder eine Optimierung ohne
Wächter.

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

---

## Ergebnis (2026-08-22)

| AK | Beleg |
|---|---|
| Eingang unabhängig von der SSOT-Größe | `buildFixedSizeGraph(base, FIXED_NODES)` — Kopien bis `FIXED_NODES = 2000`, dann exakt abgeschnitten, nur Kanten mit beidseitig überlebenden Enden. Knotenzahl ist invariant; Kopie 0 bleibt vollständig, `FUNC-mutate` also unangetastet. |
| Titel nennen die gemessene Größe | Titel sind Template-Literale über die zur Collection-Zeit geladene SSOT: *live SSOT (667 nodes / 1746 edges)* und *fixed 2000 nodes / 5232 edges*. Sie können nicht mehr veralten. |
| Assertion auf `ms/Knoten`, Schwelle begründet | `MAX_MS_PER_NODE = 7`, hergeleitet im Test aus drei Messpunkten (1,77 · 4,60 · 9,52 ms/Knoten bei 667 · 2000 · 3335). |
| Realgröße protokolliert ohne Assertion | Der `expect` im ersten Fall ist ersatzlos entfallen; Hang-Guard ist der 60-s-Timeout, im Kommentar benannt. Damit gilt der Docstring wieder. |
| **Rot gesehen** | Regel-Pfad künstlich 4× (`evaluateRules()` viermal statt einmal): `AssertionError: expected 7.668110250000002 to be less than 7`. Ungeslowt grün bei **4,51–4,60 ms/Knoten**. Die Schwelle hat also Wirkung und ist nicht nur eine andere Zahl. |

**Gemessen nach der Änderung:** live 667 Knoten → 1182 ms (1,77 ms/Knoten) · fixed 2000 Knoten →
9205 ms (4,60 ms/Knoten). Die Kernaussage des Spikes ist unverändert lesbar: `read` bleibt bei ~70 ms
über alle Größen, die Regelauswertung trägt die Superlinearität (n^1,93).
