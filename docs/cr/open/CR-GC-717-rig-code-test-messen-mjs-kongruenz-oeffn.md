# CR-GC-717: rig/code-test/messen.mjs: kongruenz oeffnet createHarness auf dem echten Repo (Live-Store, :144) statt openMeasured; architektur kopiert *.test.ts mit (:103) — jede Testdatei wird ein MOD

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-664 (bug)
**Erstellt:** 2026-09-30
**Item:** bok/items/ITEM-2026-664.json (Lane: graph)

---

## Befund

`rig/code-test/messen.mjs`:

- `kongruenz(ws)` oeffnet `createHarness({ repoRoot: ws })` — auf dem **Live-Store** des gemessenen
  Repos. Laeuft dort ein Host, ist das ein zweiter Kuzu-Schreiber (REQ-single-kuzu-owner); die
  Rig-Regel „ein Bootstrap: openMeasured“ (rig/README.md) ist verletzt.
- `architektur(ws)` kopiert `src/` samt `*.test.ts` in den Import-Arbeitsbereich; `import-code`
  macht aus jeder Testdatei einen Knoten — der Steuerwert des Codes misst die Tests mit.

## Root Cause

`kongruenz` wurde vor CR-GC-496 (openMeasured mit `repoRoot`) geschrieben und nie umgestellt;
`architektur` filtert nur Stubs, nicht Testdateien (`istTest` existiert, wird dort nicht angewandt).

## Aenderung

1. `kongruenz`: der Stand wird aus dem Live-Store gelesen, ohne ihn zu oeffnen — `openMeasured({ graph, repoRoot: ws })`
   mit dem exportierten Snapshot; Store ist Wegwerf, realRef-Aufloesung gegen das echte Repo.
2. `architektur`: Testdateien (`istTest`) werden aus der Kopie entfernt wie die Stubs; `architektur`
   wird exportiert.

## Umfang

- `rig/code-test/messen.mjs`
- `tests/systemtest-rig.test.ts`

## Abnahme

- Red-first-Test fuer beide Fehler, danach gruen.
- Lauf gegen `agentdiary-frontier` lesend (Wegwerf-Store), Kongruenz-Zahlen im Abschluss.

## Ergebnis

- `kongruenz(ws, scheibe)`: `openMeasured({ graph: docs/graph/<deriveMemberName(ws)>.graph.json, repoRoot: ws })`
  — Wegwerf-Store, realRef/Config am Arbeitsbereich; kein Snapshot → `null`. Neues Feld
  `snapshot: { pfad, hinterStore }` (Inhalt von `.graphcode/EXPORT_PENDING` oder `null`); die
  Vergleichszeile nennt „Snapshot hinter Store!“. Abweichung von CR-GC-698 (las den Store): der
  Store ist nur ohne zweiten Schreiber lesbar; die Frische sichert jetzt die benannte Marke.
- `architektur` exportiert; entfernt `istTest`-Dateien (und Stubs) aus `src/` und `vertrag/` der Kopie.
- README Code-Test, Punkte 4 und 5, nachgezogen.

Tests (`tests/systemtest-rig.test.ts`, 52/52):
- „misst die Kongruenz am exportierten Snapshot im Wegwerf-Store“ — lebender Fremdprozess haelt
  `owner.lock`: vorher `StoreOwnershipError`, nachher 1/1, Lock unveraendert, kein `kuzu` im Repo.
  Ersetzt den Store-Test aus ITEM-2026-509; dessen Absicht (nicht die Saat `<lauf>.graph.json`) bleibt drin.
- „architektur importiert den Code ohne die mitliegenden Testdateien“ — vorher MOD/FUNC/FLOW 7/4/3
  gegen 5/2/1 ohne Tests, nachher gleich.

Lauf:
- Code-Test auf Kopien von gefuehrt-2/frei-0 (nach `migrate-req-kinds` auf der Kopie, bekannt aus
  CR-GC-698): laeuft durch; gefuehrt-2 Scheibe 4/4 (100 %) statt 0/5 der Saat, Urteil gedriftet
  (RC-09 ×1, RC-10 ×6), Modell 14 %. Architektur unveraendert (Tests liegen dort in `test/`).
- agentdiary-frontier lesend (Host pid 71786 laeuft, Lock unberuehrt): Kongruenz **kongruent**,
  Bindung 11/11 (100 %), Scheibe MOD-run-state 4/4; Architektur MOD/FUNC/FLOW/SCHEMA 54/58/53/41,
  Steuerwert 15,183 → 23/48/44/39, Steuerwert 8,083.

Modell: `CR-GC-717 -relation-> REQ-single-kuzu-owner` (messen.mjs ist nicht als FUNC gebunden).
