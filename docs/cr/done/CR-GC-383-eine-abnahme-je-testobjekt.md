# CR-GC-383 — Eine Abnahme je Testobjekt: R-29 auf null

**Status:** done · **Angelegt:** 2026-08-21 · **Geschlossen:** 2026-08-21 · **Basis:** SPIKE-GC-selective-tests M6, CR-GC-382

## Problem

16 R-29-Verletzungen (error) im eigenen Graphen: sieben Testdateien werden von je 2–3 TEST-Knoten
beansprucht. Sie überleben, weil das Gate auf dem **Delta** blockt — beim Anlegen war jeder Knoten
für sich neu und unauffällig; die Kollision entstand erst durch den nächsten.

Ursache ist ein Identitätsbruch: die Knoten wurden **je REQ** angelegt („jede Anforderung bekommt
ihre Abnahme"), gebunden wird aber **je Datei**. Unter dem Leitsatz (2026-08-21) ist der TEST-Knoten
die Repräsentation des **Testobjektes** — und das Objekt ist die Datei, die ein Ergebnis liefert.
Zwei Knoten auf einer Datei heißt: ein Lauf, zwei Ansprüche auf dasselbe Ergebnis; das TRR-Gate
zählt dieselbe Evidenz doppelt und ein roter Lauf ist keiner Abnahme mehr eindeutig zuzuordnen.

## Zwei Auflösungen, je nach Tatsache

Die Frage ist nicht Policy, sondern Befund: **ein Objekt oder zwei?**

**(a) Ein Objekt ⇒ Knoten verschmelzen** (`merge-nodes`, Kanten wandern automatisch auf das Ziel).
Die Abnahme verifiziert danach n REQ — legal und gelebt (`TEST-cli-scaffold` verifiziert 6 REQ).

| Datei | Ziel (überlebt) | verschmolzen |
|---|---|---|
| `tests/panels.test.ts` | `TEST-dashboard-readonly` | `TEST-artifact-freshness`, `TEST-readiness-transparent` |
| `tests/readiness.completeness.test.ts` | `TEST-readiness-completeness` | `TEST-completeness-actor-bounded`, `TEST-completeness-single-value` |
| `tests/cli.scaffold.test.ts` | `TEST-cli-scaffold` | `TEST-scaffold-skills` |
| `tests/mvp-e2e.test.ts` | `TEST-mvp-e2e` | `TEST-efficient-testing` |
| `tests/harness.gate.test.ts` | `TEST-mutate-gate` | `TEST-structural-rule-shared` |
| `tests/host.bridge.test.ts` | `TEST-readonly-bridge` | `TEST-real-health-check` |

**(b) Zwei Objekte ⇒ Datei real teilen.** `tests/mcp.tests-deduction.test.ts` enthält zwei
`describe`-Blöcke mit **eigenen Fixtures**: einen synthetischen Disk-Kuzu (CR-GC-134) und einen Lauf
gegen den echten committeten Graphen (CR-GC-204). Das sind zwei Abnahmen, nicht eine — der zweite
Block zieht nach `tests/mcp.tests-operational.test.ts` um, `TEST-graph-tests-operational` bindet
dorthin, `TEST-test-runnable-binding` behält die alte Datei.

Der Unterschied zwischen (a) und (b) ist beobachtbar, nicht Geschmack: eigene Fixture + eigener
Aufbau = eigenes Testobjekt.

## Änderungen

| Datei | Was |
|---|---|
| `tests/mcp.tests-deduction.test.ts` | zweiter `describe`-Block entfernt (zieht um) |
| `tests/mcp.tests-operational.test.ts` | **neu** — der SSOT-Lauf als eigenes Testobjekt |
| `tests/hooks.inject-graph-slice.test.ts` | Ground-truth-uids auf die überlebenden Knoten |
| `rig/minimal-whitebox/jobs.mjs` | dieselbe Ground truth im Spike-Rig |
| `tests/readiness.completeness.test.ts` | Kopfkommentar nennt nur noch die überlebende Abnahme |
| diese CR-Datei | |

Dazu gate-only: 7 `merge-nodes`, ein `add-node` + `add-edge` für die geteilte Abnahme, Namen der
Überlebenden auf den erweiterten Umfang nachgezogen, Export über den Owner-Prozess.

**Nicht angefasst:** `rig/minimal-whitebox/results/*` — das sind protokollierte Messergebnisse eines
abgeschlossenen Spikes. Ein nachträglich umgeschriebenes Ergebnis wäre gefälschte Evidenz.

## Akzeptanzkriterien

- [x] R-29 = 0 (vorher 16); R-01/R-05/R-19/R-20 unverändert 0, keine neuen error-Befunde
- [x] Keine Testdatei mehr in zwei `testRefs` — 0 Kollisionen über alle 50 gebundenen Dateien
- [x] Jede REQ weiterhin verifiziert (0 REQ ohne `verify`); die Gate-Vorschau meldete
      blockingErrors 164 → 148, Dimension `ver` 0.967 → 0.996
- [x] Ground truth in Test und Rig zeigt auf existierende Knoten (8 Knoten verschmolzen)
- [x] Gesamtsuite 849/850 — einzige Rotstelle ist der Vorbestand `tests/distribution.test.ts`
      (`@sigloch/graph-view-edit@^0.6.0` ist nicht publiziert, npm kennt nur bis 0.5.0)

@author andreas@siglochconsulting
