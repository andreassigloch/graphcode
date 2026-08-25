# CR-GC-425 — Elf Dateien, die RC-05 nicht prüfen kann

**Status:** open (Befund, kein Fix) · **Angelegt:** 2026-08-25
**Herkunft:** CR-DRAFT-GC-409 §C. CR-GC-423 hat die drei RC-05-Befunde geschlossen,
CR-GC-424 sechs der 17 nicht zugeordneten Dateien. Diese elf bleiben — und ohne diesen
CR bleiben sie **unsichtbar**, weil die Liste nur als Anhang einer RC-05-Meldung existierte
und mit deren Verschwinden mit verschwunden ist.

## Root Cause

RC-05 (`@sigloch/contracts`, `se/conformance-rules.ts:288–307`) bildet eine Quelldatei auf ihre
MOD ab über genau zwei Wege: die `realRef` einer allozierten **FUNC**, oder das **eine**
`path`-Präfix einer MOD. Eine Datei, die keinen der beiden trifft, wird von der Regel nicht
geprüft: ihre Importe dürfen jede Modulgrenze überqueren, ohne dass ein Befund entsteht.

## Impact

11 der 176 Import-Endpunkte unter `src/` liegen außerhalb der Prüfung. Kein aktueller
Fehlbefund — nachgerechnet gegen die realen Import-Kanten entsteht bei keiner plausiblen
Zuordnung eine neue Modulgrenze. Es ist eine **Prüflücke**, kein Defekt: `graph_impact` und
RC-05 sagen über diese Dateien nichts, und sagen auch nicht, dass sie nichts sagen.

## Die elf, nach Ursache getrennt

### A · Vier Dateien SIND im Modell — als SCHEMA, nicht als FUNC (Regel-Lücke)

| Datei | Modellknoten |
|---|---|
| `src/gve-session-contract.ts` | SCHEMA-session-registry |
| `src/schema-fingerprint-contract.ts` | SCHEMA-schema-fingerprint |
| `src/target-profile-contract.ts` | SCHEMA-target-profile |
| `src/test-selection.ts` | SCHEMA-impacted-tests, SCHEMA-test-selection |

Diese vier sind das Ergebnis von Gruppe A (CR-GC-412/416/419/421): reine Zod-Vertragsdateien.
Sie tragen eine `realRef` — aber an einem **SCHEMA**, und RC-05 liest nur FUNC-realRefs.
Eine FUNC dafür zu erfinden wäre falsch: in diesen Dateien steht kein Verhalten.

### B · Sieben Dateien haben keinen Modellknoten

`src/authoring-example.ts`, `src/evaluation.ts`, `src/package-version.ts`,
`src/scaffold-templates.ts`, `src/se-plan.ts`, `src/test-selection-audit.ts`, `src/testreport.ts`

Für sie eine FUNC anzulegen ist **nicht** die billige Mapping-Geste, nach der es aussieht:
jede neue FUNC schuldet sofort io-Ein- und -Ausgang (R-31), FCHAIN-Mitgliedschaft (R-30) und
einen erfüllten REQ (R-02). Sieben FUNCs ohne diese Verankerung tauschen eine RC-05-Prüflücke
gegen 21 neue Warnungen — kein Fortschritt.

Zwei davon verdienen die Modellierung wirklich, aber je als eigener CR mit REQ und TEST:

- **`src/evaluation.ts`** — „DIE Auswertungsfläche" aus CR-GC-398 (`evaluateAll`, ein Ergebnis,
  jedes Finding mit `source`, jedes Resultat mit `skipped`). Sie hat heute weder FUNC noch REQ,
  obwohl die Eigenschaft „eine Grundgesamtheit für alle Auswertungswerkzeuge" genau die Art
  Zusage ist, die ein REQ trägt. Absehbarer Schnitt: FUNC `evaluateAll`, Eingang
  FLOW-graph-state, Ausgang FLOW-violations.
- **`src/testreport.ts`** — `graph_test_ingest` / `graph_test_report` sind ausgeliefert, aber
  keine FUNC im Modell (`FUNC-deduce-tests` ist `graph_tests`, ein anderes Werkzeug).

Die übrigen fünf sind Konstanten-, Beispiel- und Hilfsdateien; ihre Funktion ist die FUNC, der
sie zuarbeiten. Für sie ist eine eigene FUNC Modell-Inflation.

## Fix-Vorschlag (Entscheidung nötig)

1. **Billigster vollständiger Fix — contracts-CR: `MOD.path` als Liste.** `resolveMod` prüft
   heute ein einzelnes Präfix; eine Liste (`path: string | string[]`, gleiche
   Longest-Prefix-Auflösung) würde alle elf Dateien ohne eine einzige erfundene FUNC zuordnen —
   MOD-cli benennt seine flachen Dateien, MOD-mcp-tools die seinen. Kosten: ein
   `@sigloch/contracts`-Version-Bump, Drift-Lock L1/L2 → Familie-Review.
2. **Alternativ/ergänzend:** RC-05 zusätzlich SCHEMA-realRefs lesen. Braucht eine Regel dafür,
   welche MOD ein SCHEMA erbt (SCHEMA hat keine `allocate`-Kante) — das ist die teurere
   Variante und löst nur Gruppe A.
3. **Unabhängig davon:** die Prüflücke sichtbar machen. RC-05 meldet die nicht zugeordneten
   Dateien nur als Anhang eines *anderen* Befundes; bei drift = 0 verschwindet die Angabe
   stumm. Das ist derselbe Fehler, den CR-GC-398 für `skipped` schon einmal behoben hat:
   eine Compliance-Zahl ohne ihre Grundgesamtheit ist nicht interpretierbar.

**Benötigte Entscheidung:** ob (1) als contracts-CR aufgesetzt wird — ohne sie bleibt die
Zuordnung dieser elf Dateien in diesem Repo nicht ehrlich schließbar.

## Nicht Teil dieses CR

Kein Code, kein Modell-Schreibvorgang. Der CR bleibt offen, bis die Entscheidung fällt.
