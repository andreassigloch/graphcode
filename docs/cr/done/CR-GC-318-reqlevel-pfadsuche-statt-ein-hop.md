# CR-GC-318 — `reqLevels` sucht keine Pfade: 68 REQ fälschlich als „ohne Anker" gemeldet

**Status:** done · **Angelegt:** 2026-08-08 · **Abgeschlossen:** 2026-08-08 · **Max Files:** 4
**Herkunft:** Review von `CR-GC-317` durch den Auftraggeber, 2026-08-08: „eigentlich hatte ich
definiert, dass die Ebenenzuordnung indirekt über die Zuordnung zu den Elementen FUNC/UC/SYS
funktioniert, das ist dann die Aufgabe des Reporters die Pfade zu suchen, kein Label dafür
einführen."
**Korrigiert:** `CR-GC-317` (done) — dessen Ergebnis war in diesem Punkt falsch.

## Problem

`reqLevels` (CR-GC-317) liest **eine** Kantenart und **einen** Hop: den direkten
`compose`-Elternteil. Damit findet es SYS- und UC-Anker, sonst nichts. Alles andere landete im
Eimer „ohne Anker (unassigned)".

Die Ebenenzuordnung ist aber über die **Zuordnung zu FUNC/UC/SYS** definiert, und diese
Zuordnung läuft je nach Ebene über verschiedene Beine:

| Weg | A-SPICE-Ebene |
|---|---|
| `SYS -compose-> REQ` | System (SYS.2) |
| `UC -compose-> REQ` | funktional (SWE.1) |
| `FUNC`/`MOD -satisfy-> REQ` | Komponente (SWE.2/3) |
| `FCHAIN -satisfy-> REQ` | Integration (SWE.4/SYS.4) |
| `REQ -compose-> REQ` | **keine eigene Ebene** — transitiv die des Elternteils |

Gemessen auf dem realen Graphen (111 REQ):

| | Ein-Hop-compose (CR-317) | Pfadsuche (dieser CR) |
|---|---:|---:|
| zugeordnet | 43 | **110** |
| ohne Anker | **68** | **1** |

Die 68 waren kein Modellbefund, sondern die Lücke im Reporter. 63 davon tragen eine
`satisfy`-Kante von FUNC, MOD oder FCHAIN — die Zuordnung lag da, sie wurde nur nicht gesucht.
Genau ein REQ (`REQ-one-gate-per-repo`) hängt tatsächlich an nichts.

**„abgeleitet" war ebenfalls falsch.** Es ist keine Ebene, sondern eine Herkunft: ein aus einem
System-REQ abgeleitetes REQ ist immer noch ein System-REQ. Als eigener Eimer ist es genau das
Label, das der Reporter nicht einführen soll.

### Warum es passieren konnte

Der Präzedenzfall stand daneben und wurde nicht gelesen: `levelsOfTest` (CR-GC-240) macht es
seit Langem richtig — compose-Elternteil **und** satisfy-Quelle, mit denselben Typ-Fällen. Der
CR-317-Code hat die halbe Regel nachgebaut statt die ganze.

## Architektur-Entscheidung

`reqLevels` wird eine **Pfadsuche über alle zuordnungstragenden Beine**, nicht ein Lookup:

- `compose` von SYS/UC → direkte Ebene
- `satisfy` von FUNC/MOD → `component`, von FCHAIN → `integration`
- `compose` von REQ → **rekursiv** die Ebene(n) des Eltern-REQ, mit `seen`-Set gegen Zyklen
  (R-12 verbietet 2-Zyklen, längere sind nicht ausgeschlossen)

Mehrfachzuordnung bleibt: ein REQ, das ein FUNC erfüllt **und** unter einem SYS hängt, trägt
beide Ebenen. Das war an CR-317 richtig und bleibt.

Kein neues Attribut, kein Label — die Kanten sind der SSOT.

## Scope (≤ 4 Dateien)

1. `src/views/helpers.ts` — `reqLevels` als Pfadsuche; `ReqLevel` = `system | functional |
   component | integration` (`derived` entfällt)
2. `src/views/incose.ts` — Gruppen-Reihenfolge/Labels angepasst
3. `tests/views.auditor.test.ts` — Fälle für satisfy-Beine, transitive Auflösung, Zyklus
4. `docs/cr/done/CR-GC-317-*.md` — Ergebniszahlen korrigiert (sie stehen dort falsch)

## Akzeptanzkriterien

- [x] Ein REQ, das nur `FUNC -satisfy-> REQ` trägt, erscheint als `component`, nicht als
      „ohne Anker"
- [x] `FCHAIN -satisfy-> REQ` → `integration`; `MOD -satisfy-> REQ` → `component`
- [x] Ein aus einem System-REQ abgeleitetes REQ (`REQ -compose-> REQ`) erbt `system` —
      kein eigener Eimer „abgeleitet"
- [x] Ein REQ→REQ-Zyklus terminiert und liefert die Ebene der erreichbaren Anker
- [x] Mehrfachzuordnung bleibt (Regression zu CR-GC-317)
- [x] Am realen Graphen: genau **1** REQ ohne Ebene, im Test gegen den committeten SSOT
      asserted statt als Zahl behauptet
- [x] `npm test && npm run build` grün
