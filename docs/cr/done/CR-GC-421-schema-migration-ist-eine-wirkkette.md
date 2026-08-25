# CR-GC-421 — Schema-Migration ist eine Wirkkette

**Status:** done — 2026-08-25 (graphVersion 201)
**Herkunft:** CR-GC-409 §A, Paket „Kette" (R-30) + Einzelfall `schema-guard`.
**Ziel:** R-30 für `FUNC-migrate-schema` und R-31 für `FUNC-schema-guard`
schließen.

## Befund

Zwei Funktionen tun dasselbe Geschäft und gehörten im Modell nirgends zusammen:

- `FUNC-migrate-schema` war beidseitig verdrahtet (`FLOW-version-bump` rein,
  `FLOW-migrated-graph` raus), aber Mitglied keiner Wirkkette (R-30). Damit
  sahen IO-01 und R-21 es nie — die beiden Netze prüfen nur INNERHALB einer Kette.
- `FUNC-schema-guard` hing an keiner `io`-Kante (R-31) und stand in
  `FCHAIN-recall`. Dort ist es falsch: der Fingerabdruck erkennt die Drift, die
  Wiederherstellung macht `apply-reseed`. Verdrahtet man es in `FCHAIN-recall`,
  meldet es sofort IO-01 (gemessen im dryRun: „no FLOW path to
  FUNC-apply-reseed") — der Beweis, dass die Zuordnung nicht stimmte.

Beide hängen am selben Auslöser: `FLOW-version-bump`.

## Umfang

**Code**
- `src/schema-fingerprint-contract.ts` (neu): `SchemaFingerprintSchema` —
  16 Hex-Zeichen. Eigene Datei, weil der Marker eine Prozessgrenze quert
  (geschrieben beim Anlegen, gelesen beim nächsten Start, oft von einem anderen
  Build) und weil RC-04 Import UND `parse` verlangt.
- `src/schema-guard.ts`: `readStoredFingerprint` parst den Marker.
  **Verhaltensänderung, absichtlich:** formfremd zählt ab jetzt wie fehlend.
  Der Marker entscheidet, ob der Store WEGGEWORFEN und neu befüllt wird; ein
  abgeschnittener oder halb geschriebener verglich sich schlicht als „anders",
  und damit wischte ein kaputtes Byte den Store. Ein FEHLENDER Marker tut das
  ausdrücklich nicht (er wird beim aktuellen Fingerabdruck adoptiert), ein
  unlesbarer seit jeher auch nicht — ein formfremder muss dasselbe tun.

**Modell (gate-only, `graph_mutate`)**
- `FCHAIN-schema-migration` unter `UC-repo-lifecycle`, mit `FUNC-schema-guard`
  und `FUNC-migrate-schema`; `FCHAIN-recall -compose-> FUNC-schema-guard` entfällt.
- `FLOW-schema-fingerprint` + `SCHEMA-schema-fingerprint`
  (realRef `SchemaFingerprintSchema`)
- io: `FLOW-version-bump → FUNC-schema-guard → FLOW-schema-fingerprint →
  FUNC-open-store` (dessen Beschreibung die Aufgabe schon nennt: „erkennt
  Meta-Modell-Drift").

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 4 | 3 |
| R-30 | 1 | 0 |
| IO-01 | 0 | 0 |

## Abnahme

`tests/schema-guard.test.ts`: neuer Fall „ein formfremder Marker liest null —
nicht 'anderer Schemastand'"; die beiden Fixtures, die vorher Platzhaltertext
als Fingerabdruck benutzten, tragen jetzt die echte Form (ein Platzhalter pinnte
eine Form, die es nicht gibt). Der Integrationsfall „stale → wipe + reseed"
bleibt unverändert in seiner Aussage.
