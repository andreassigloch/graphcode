# CR-GC-521: graph_tests laeuft den Vertragspfad FUNC → FLOW → SCHEMA → TEST

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-064 (idea)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-064.json (Lane: code)
**Vorlauf:** contracts CR-SM-317 (Muster `TEST -verify-> SCHEMA`, META_MODEL 5.1.0), CR-SM-318 (RC-04 auch external), CR-SM-319 (R-32, RULES 26.0.0)

---

## 1. Root Cause

`impactedTests()` (`graph_tests`) kennt nur die Anforderungskette `TEST -verify-> REQ <-satisfy- FUNC -allocate-> MOD`. Seit contracts 5.1 haengt ein Vertragstest am SCHEMA (`TEST -verify-> SCHEMA`), nicht an einer REQ — eine geaenderte FUNC waehlt ihren Vertragstest also nie. Der Floor `>=10.2` liesse zudem ein contracts ohne das Muster zu.

## 2. Impact

Ohne den Pfad ist Schicht b) aus ITEM-2026-064 (Vertragstest je SCHEMA, unabhaengig vom Szenario) zwar modellierbar, aber fuer die selektive Auswahl unsichtbar: `graph_tests` faehrt bei einer FUNC-Aenderung nur die Kettentests, die Grenzen zwischen Ketten bleiben ungeprueft. Nicht betroffen: Auswahl ueber REQ/UC, Paritaet Store/Snapshot, das Audit-Skript (gleiche Funktion).

## 3. Fix

- `impactedTests`: von einer FUNC ueber `io` (beide Richtungen — Eingang und Ausgang sind Vertraege der FUNC) zu ihren FLOWs, vom FLOW ueber `relation` zum SCHEMA, dort sammelt die bestehende `verify`-Regel den TEST. Der Lauf endet am FLOW: `FLOW -io-> FUNC` wird nie betreten, sonst waere jede Auswahl der transitive Abschluss des Graphen. Typpruefung ueber `nodeById`, Reihenfolge bleibt deterministisch (Kantenreihenfolge des Graphen).
- Floor `@sigloch/contracts` `>=10.3 <11` (package.json + Root-Eintrag package-lock.json; 10.3.0 = Release mit CR-SM-317..319, in link mode noch nicht auf npm).
- Nicht hier: die Zahlen 30/65 → 31/66 in Artikeln und `claims.conformance.test.ts` → CR-GC-522 (6-Dateien-Grenze).

## 4. Dateien

- `src/kernel/measure/test-selection.ts`
- `tests/test-selection.audit.test.ts`
- `package.json`
- `package-lock.json`
- `docs/cr/open/CR-GC-521-…md` (diese Datei)

## 5. Akzeptanzkriterien

- [x] Red-first: neuer describe-Block „Vertragspfad" — 2 von 4 Faellen rot vor dem Fix (`expected [] to deeply equal ['TEST-CONTRACT-A']`), alle 21 gruen danach.
- [x] Eine FUNC-Aenderung waehlt den Vertragstest des SCHEMAs ihres FLOWs; der Vertragstest eines fremden SCHEMAs (hinter `FLOW -io-> FUNC`) wird NICHT gewaehlt.
- [x] Konsumenten-FUNC: Eingangs- und Ausgangsvertrag gewaehlt, Produzenten-FUNC nicht als Anker.
- [x] `npm run type-check`, `npm run lint`, `npm run build` gruen; `npm test` gruen bis auf EINEN erwarteten Fall (kuzu-wasm-Flake ITEM-2026-072: einmal wiederholen, ausweisen).

## 6. Der eine rote Test — benannt, nicht weggeredet

`tests/distribution.test.ts` › „installs from a packed tarball into a foreign repo" installiert gegen die **Registry**: `ETARGET No matching version found for @sigloch/contracts@>=10.3 <11`. 10.3.0 ist noch nicht publiziert (Link-Modus); derselbe Zustand wie CR-GC-518/520 — der Floor folgt den Imports, Registry-Faehigkeit kommt mit dem contracts-Release. Kein Defekt dieses CR, kein Symptom-Fix.
- [x] Kein Versions-Bump, kein Release, sigloch-modules unberuehrt.
