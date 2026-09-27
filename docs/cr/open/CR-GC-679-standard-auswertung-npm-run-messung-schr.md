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

## Schnitt vor dem Start (2026-09-27)

Bestandsaufnahme der S1-Quellen: keine liefert ein lesbares Urteil. Fuenf geben nur Prosa aus oder
schreiben ins Repo (T-V1 moneyflow-Driver, T-M3 Nachweis-History, T-E2 `run-phase1.mjs`, T-O4
Known-Answer-Set, T-O6 ND/Engpass). Sie alle umzubauen sprengt ≤ 10 Dateien — geteilt:
**dieser CR** = Runner, Datei, Test und die sechs Quellen mit lesbarem Wert; die fuenf stehen als
`nicht erhoben` mit Grund in `stand.md`. **Folge:** ITEM-2026-623 (CR-GC-679B).

## Umfang (8 Dateien)

Runner und Messmittel ohne Modellknoten: `scripts/messung.mjs` (neu), `docs/messung/stand.md`
(generiert), `tests/messung.test.ts` (neu), `scripts/model-test-set.mjs` (Test liest die
Leitlinie → Spur MODELL), `package.json` (Script), `docs/graphcode_leitlinie.md` (§9.1, §9.3 Stand
der sechs, §9.4 S1, §9.5), `docs/views/regel-matrix.{md,csv}` (neu generiert, s. T-H2).

## Ergebnis

- `npm run messung` (~30 s): T-V2 (`randbreiten`, Zeile `graphcode (live)`), T-V4 (Kongruenz +
  Bindung aus `graph_readiness`/`codeVerdict`, Grenzmenge aus `messeGrenzmenge` — alle drei Teile
  des Kriteriums), T-H2 (neu: Regel-IDs der Matrix gegen `ALL_RULE_DEFS`, beide Richtungen),
  T-M4 (JSON-Reporter), T-E8 (Messpunkt `fixed` des Perf-Spikes, per Label statt erster
  Fundstelle), T-E1 (Median KPI 1 der letzten 20 CRs aus `.graphcode/cr-messung.jsonl`).
- Urteile: bestanden · nicht bestanden · **ohne Schwelle** (T-E1 — die Leitlinie nennt bewusst
  keine; ein fuenfter Wert statt eines erfundenen Kriteriums) · nicht erhoben.
- Stempel: `openMeasured` → `stampLine` (Pfad repo-relativ); T-E1 traegt den Commit seiner Zeile.
  Ein Adapter, der wirft, bricht den Lauf ab — keine Zeile aus einem verschluckten Fehler.

**Erster Stand:** T-M4 und T-H2 bestanden; T-V2 (BW-02 15), T-V4 (gedriftet, Grenzmenge FUNC
15/61) und T-E8 nicht bestanden. **T-H2 fing beim ersten Lauf eine echte Luecke:** die Matrix vom
2026-09-26 fuehrte CR-R05, FC-05, RC-10 nicht (contracts neuer als die Matrix) — neu generiert, jetzt
bestanden. **T-E8:** 2,66 s bei 2000 Knoten gegen 200 ms, der Vorschlag allein 1,85 s →
ITEM-2026-622.

## Akzeptanz

- [x] `npm run messung` laeuft ohne Fehler und schreibt `stand.md` mit allen S1-IDs aus §9.4 —
      fuenf davon `nicht erhoben` mit Grund (Schnitt oben).
- [x] Jede Zeile traegt einen Stempel; `renderStand` wirft ohne (Test).
- [x] Eine Matrix ohne RC-08/09 macht T-H2 rot (Test) — und am echten Stand fehlten CR-R05/FC-05/RC-10.
- [x] `tests/messung.test.ts` rot gesehen (Runner fehlte), dann gruen (5/5); die S1-Liste haelt er
      gegen die Leitlinie gleich.
- [x] ≤ 10 Dateien (8).
