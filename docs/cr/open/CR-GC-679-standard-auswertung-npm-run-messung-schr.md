# CR-GC-679: Standard-Auswertung: npm run messung schreibt docs/messung/stand.md je Test-ID

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-592 (idea)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-592.json (Lane: code)

---

## Befund

Die Leitlinie §9 führt je Test einen „Stand" — von Hand nachgetragen, oft veraltet (Runde 20
„unausgewertet", T-E8 363 ms). §8 nennt es selbst: „Eine strukturierte Zusammenfassung fehlt."
Die deterministischen Auswertungen (Stufe S1, §9.4) laufen einzeln, jede mit eigenem Format.

## Zielbild

Ein Befehl `npm run messung` fährt die Stufe S1 und schreibt **eine** committete Datei
`docs/messung/stand.md`: je Test-ID eine Zeile mit Wert, Kriterium, Urteil
(bestanden / nicht bestanden / blind / nicht erhoben), Datum und Stempel (`openMeasured`).
Die Spalte „Stand" der Leitlinie verweist künftig auf diese Datei, statt Zahlen zu tragen.

## Umfang

- Neu: `scripts/messung.mjs` (Runner), `docs/messung/stand.md` (Ausgabe), `tests/messung.test.ts`
  (Runner-Kern gegen feste Eingabe, rot bei fehlender Test-ID).
- Eingebunden (bestehende Skripte, nur aufrufen): `grenzmenge` (T-V4), `randbreiten` (T-V2),
  `regel-matrix` (T-H2, **plus** Aktualitätsprüfung: Regel-IDs der Matrix = Regel-IDs aus contracts),
  `known-answer-set`, `spike-nd-`/`spike-engpass-known-answer` (T-O4, T-O6),
  `spike-nachweis-history` (T-M3), `spike-kettenkennzahlen` (T-O1), `test-selection-audit` (T-E7),
  `retro-kpi`/`cr-messung` (T-E1, letzter Stand aus `.graphcode/cr-messung.jsonl`),
  Dauertests `perf.advisory-roundtrip` (T-E8) und `steering.steer-causality` (T-M4).
- `package.json`: Script `messung`.
- Leitlinie §9.4/§9.5: S1 verweist auf `npm run messung`; §9.1: „ohne Stempel keine Zahl" gilt für `stand.md`.
- S2/S3 (Greenfield, Code-Test, Referenz-Change) sind **nicht** Teil dieses CR — sie schreiben ihre
  Zeilen später in dieselbe Datei (Folge-CR).

## Abnahme

- `npm run messung` läuft auf sauberem Stand ohne Fehler und erzeugt `stand.md` mit allen S1-Test-IDs aus §9.4.
- Jede Zeile trägt Stempel (Graph, Policy, Regeln, Code-Commit).
- Eine Regel-Matrix, der RC-08/09 fehlen, macht die T-H2-Zeile rot.
- `tests/messung.test.ts` gesehen rot, dann grün (se-test).
- ≤ 10 Dateien; sonst vor Start teilen.

## Umfang laut `graph_impact`

_(vor der Arbeit füllen: Messungs-FUNC im Modell, `realRef` der eingebundenen Skripte)_
