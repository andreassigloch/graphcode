# CR-GC-350 — Die elternlosen REQ an ihre Ableitung hängen

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **1 Datei, ~75 Gate-Mutationen**)
**Ziel:** 0 REQ ohne `compose`-Elternteil — die Ableitungskette des eigenen Modells ist nach oben
geschlossen.
**Herkunft:** CR-GC-342 §2.2 + §6 (Block 3 des dort empfohlenen Schnitts). CR-GC-342 ist mit Block 1
geschlossen; dies ist der ausgeschnittene Rest.

---

## 1. Problem

Gemessen nach CR-GC-342 (2026-08-15): **75 von 123 REQ** haben keinen `compose`-Elternteil — weder
UC noch SYS. Sie hängen ausschließlich von unten dran (`verify` ← TEST, `satisfy` ← FUNC/FCHAIN/MOD,
`relation` ← CR).

Die Verifikationsseite trägt sauber (0 von 123 REQ ohne verify-TEST, R-01 hält). Die
**Ableitungsseite** trägt nicht. `06-claims.md` behauptet „Traceability is guaranteed by the same
graph rules" — für 61 % der Anforderungen ist die Kette nach oben offen, und **keine Regel feuert
darauf**. Genau der Fall aus `docs/MESSGROESSEN.md`: *Regeln sehen keine Abwesenheit.*

---

## 2. Umfang

Je REQ die zutreffende Ableitung setzen, durchs Gate (`graph_mutate` → `graph_export`):

- `UC compose REQ` wo ein Use Case sie fordert,
- `SYS compose REQ` wo es eine echte Systemanforderung ohne Use Case ist.

`SYS compose REQ` ist ein legales TRACE_PATTERN und kein Notausgang — aber es muss die **Wahrheit**
sein, nicht die bequeme Kante. Eine falsche `SYS`-Kante ist schlimmer als eine fehlende, weil sie die
Lücke unsichtbar macht.

**Nicht mit einer Heuristik durchschieben.** Der Aufwand ist ~75 Fachurteile, nicht 75 Edits. Das ist
der Grund, warum dieser Block einen eigenen Lauf bekommt.

**Reihenfolge-Falle:** `delete`+`add` derselben uid im **selben** Batch ist verboten — `persist`
schreibt Deletes zuletzt, das divergiert den Store. Nur `add-edge`, keine Umhänge-Batches.

---

## 3. Akzeptanzkriterien

- [ ] **0** REQ ohne `compose`-Elternteil (UC oder SYS). Nachweis: die Zählung aus §1 reproduzieren.
- [ ] Weiterhin 0 REQ ohne `verify`-TEST — R-01 darf nicht kippen.
- [ ] Jede Änderung ging durchs Gate; `graph_export` danach gelaufen.
- [ ] `npm run build` + `npm test` grün.

---

## 4. Betroffene Dateien (1)

| Datei | Änderung |
|---|---|
| `docs/graph/graphcode.graph.json` | **erzeugt** durch `graph_export` nach den Gate-Mutationen — nie direkt editiert |

`docs/views/*.md` ziehen als generierte Artefakte automatisch nach.

---

## 5. Der eigentliche Root Cause gehört woanders hin

Die fehlende **Layer-Presence-Regel** („eine REQ ohne `compose`-Elternteil ist nicht abgeleitet")
verhindert den Rückfall; dieser CR repariert nur die Daten. Eine neue Regel ist Familie-Review +
Version-Bump in `@sigloch/contracts/se` (Drift-Lock L1/L2) — kein lokaler Regel-Parser, kein Fork,
also ein **CR-SM-xxx** in `sigloch-modules`. Ohne sie wächst der Befund wieder nach.

@author andreas@siglochconsulting
