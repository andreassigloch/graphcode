# CR-GC-988: CI-Suite auf zwei parallele Jobs teilen

**Typ:** aus Item ITEM-2026-1556 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1556.json (Lane: code)
**Auftrag:** Autor, 2026-11-21: „CI teilen ok, GO“.

---

## Befund

`.github/workflows/ci.yml` begrenzt den Job `build-test` auf 20 Minuten. Drei Läufe in Folge endeten am 2026-11-21 am Limit (abgebrochen, bis dahin keine rote Datei); lokal ist die volle Suite grün. Die Suite wuchs an diesem Tag von 246 auf 267 Testdateien (3444 Tests; lokal 491 s für den Volllauf).

## Änderung

Eine Datei: `.github/workflows/ci.yml`. Der Job `build-test` ist eine Matrix mit den Teilen 1 und 2. Jeder Teil fährt `npx vitest run --shard=<n>/2`. `timeout-minutes: 20` bleibt, `fail-fast: false`, `fetch-depth: 0` bleibt. Type-Check und Build laufen in beiden Teilen (24 Testdateien importieren `dist/`). Der Kopfkommentar nennt Grund und Aufteilung.

Geprüft, nichts nachzuziehen: Kein Test und kein Skript liest `ci.yml` (grep nach `ci.yml` und `.github/workflows`: nur Modell-Export, Sichten und geschlossene CR). `README.md` beschreibt die CI nicht; `CLAUDE.md` sagt „CI runs the full suite“ und „CI and publish keep it“: beide Teile zusammen sind die volle Suite, die Aussage bleibt wahr. Der Name des Jobs ändert sich von `build-test` zu `build-test (1/2)` und `build-test (2/2)`; ein Schutz der Verzweigung, der den alten Namen verlangt, müsste nachgezogen werden (im Repo nicht festgelegt, in den Einstellungen bei GitHub nicht geprüft).

## Nachweis

vitest 2.1.9. `--shard` arbeitet mit `fileParallelism: false` aus `vitest.config.ts` zusammen (beide Teile liefen lokal mit dieser Konfiguration). Lokal beide Teile nacheinander, am Stand von CR-GC-987:

| Teil | Testdateien | Tests | rot | Dauer |
|---|---|---|---|---|
| 1/2 | 134 | 1403 | 0 | 229 s |
| 2/2 | 133 | 2041 | 0 | 281 s |
| Summe | 267 | 3444 | 0 | 510 s (hintereinander) |

Alle Testdateien (`find tests -name "*.test.ts"`: 267) gegen die Vereinigung beider Berichte: 0 doppelt, 0 fehlend, 0 unbekannt. Die Summe der Tests entspricht dem Volllauf von `verify:full CR-GC-987` (3444). Die Laufzeit je Teil liegt bei 47 und 57 Prozent des Volllaufs von 491 s; auf dem Runner ist der Faktor nicht gemessen.

- CI-Lauf nach dem Push: **offen** (die Hauptsitzung pusht und beobachtet; der CR bleibt in `open/`, bis beide Teile grün sind und unter dem Limit liegen).

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

Relation-Kante: `MOD-dev-scripts` (wie CR-GC-969; die CI-Datei hat im Modell keinen eigenen Knoten). Kein Quellcode in `src/`, keine Testdatei geändert.
