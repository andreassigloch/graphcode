# CR-GC-530: Seed prüft Kanten mit der R-18-Routine und bietet Reparatur an

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-142 (finding)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-142.json (Lane: code)
**Entscheidung:** Auftraggeber 2026-09-14 — Reparatur-Angebot statt offenem Speicher-Schema; eine Prüfroutine, geprüft nur beim Schreiben
**Nicht Teil:** Paarprüfung im Codec löschen (codec.ts:441, eigener CR aus ITEM-2026-144)

---

## 1. Root Cause

Der Seed (`importOntologyGraph`, src/kernel/harness-import.ts:100) reicht die committete Graph-Datei
ungeprüft an Kuzu. Eine Kante, deren Muster ein Grammatikwechsel entfernt hat (CR-SM-266 D1/D4:
`ACTOR/FLOW -io-> UC`), verletzt das Rel-Tabellen-Schema — `Binder exception … violates schema`, der
Host beendet sich. Das Gate ist für genau die Reparatur unerreichbar, die R-18 verlangt.

## 2. Impact

Zweimal nur per Direktschreiben der JSON gelöst: graph-view-edit `4837560` (11 Kanten), CR-SM-322 Zug 0
(5 Kanten). Jedes Repo mit Altbestand trifft es beim nächsten Seed.

## 3. Fix

**Eine Routine, zwei Eingänge.** Geprüft wird, wo Daten in den Store gelangen, beide Male mit
contracts `traceRejection` — derselben Funktion, die R-18 aufruft:

- **Gate** (unverändert): R-18 blockt neue musterfremde Kanten.
- **Seed** (neu): Kanten, deren Endpunkte auflösen und die `traceRejection` ablehnt, gehen nicht in
  den Store. `ImportResult.rejectedTraces` nennt sie mit Grund; der Host meldet sie beim Boot wie
  `unverifiedReqs`. Hängende Endpunkte bleiben R-08s Sache (unverändert).

**Reparatur annehmen** braucht kein Werkzeug: `delete-edge` durchs Gate. Die Kante fehlt im Store,
der Befehl wird trotzdem als angewandte Löschung auditiert (apply-commands.ts:99), und genau das lässt
die Export-Sperre (projections/export.ts:34) als eigene Löschung gelten. Bis dahin verweigert
`graph_export` — nichts verschwindet still aus der committeten Datei. Ersatzkanten gehen normal
durchs Gate. Kuzu-DDL und Speicherbedarf bleiben unverändert.

## 4. Akzeptanzkriterien

- [x] Test rot gegen heute (Binder exception in allen drei Fällen): Seed einer Graph-Datei mit
      `ACTOR -io-> UC` wirft nicht; die Kante steht in `rejectedTraces` (Grund `no-pattern`), nicht im
      Store; legale Kanten sind geladen.
- [x] `graph_export` verweigert, solange die Reparatur offen ist.
- [x] `delete-edge` der abgelehnten Kante durch `graph_mutate` → Erfolg; danach schreibt `graph_export`
      ohne `force` und ohne die Kante. (Über das Werkzeug, nicht `harness.mutate()` — nur das Werkzeug auditiert.)
- [x] Neue Kante `ACTOR -io-> UC` am Gate weiter blockiert (R-18).
- [x] Suite 1124/1124 grün, tsc grün. Smoke mit gebautem `dist/cli.js mcp` am sigloch-modules-Stand vor
      CR-SM-322: Host bootet, meldet die 5 Kanten, R-18×15 (kinds) und UC-02×1 sichtbar, Export verweigert.

**Gemessen über 31 Graph-Dateien der Familie:** was der Seed zurückhält, deckt sich in jeder Datei
exakt mit dem, was Kuzu nicht speichern kann (0 Abweichungen); kinds-Befunde bleiben geladen.
Heute nicht bootfähig bei frischem Seed, ab jetzt mit Reparatur-Angebot: graphify 31, graphcodedemo
(prod) 21, sirail 19, siconizer 10, gc_test-graphview 10 Kanten.

**Bewusst offen:** `graph_readiness` zeigt die abgelehnten Kanten nicht; die Export-Verweigerung nennt
nur Elemente, keine Kanten.

## 5. Dateien

`src/kernel/harness-import.ts` · `src/kernel/harness.ts` · `src/surface/mcp-server.ts` · `tests/harness.import-rejected-traces.test.ts` (neu) · `scripts/model-test-set.mjs` (Test in die Modell-Spur, CR-GC-399) · dieser CR
