# CR-GC-708: S2-Standardmessung: Zug-Analyse je Runde und Regel-Pareto je Zugtyp

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-637 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-637.json (Lane: code)

---

## Befund

Die S2-Auswertung (`report.mjs` → `verhalten.mjs`) zählt Ergebnisse: Ablehnungen, Dubletten, Struktur
gegen das Golden. Sie sagt nicht, **welcher Fokus welchen Zug auslöste und was der Zug anrichtete**.
Genau das brauchte die Analyse vom 2026-09-28 (gcrun-342..344), und sie lief als Einmal-Skripte:

- Fokusregeln ohne eigenen Auftragstext werden nie gelöst (IO-01, R-16, FC-03, MT-02: 0 %), mit
  Auftragstext fast immer (RD-01, UC-01, FC-04: 93–100 %). RD-05 und R-31 standen in keiner Runde im
  Fokus — sie sind Nebenprodukt der falschen Züge.
- Je Zugtyp reichen 0–2 Regeln für 80 % Gate-Durchgang; nur „MOD + allocate" braucht 4.
- Die Dublettenmetrik zählte nur REQ/FUNC/UC/FCHAIN und nur gegen den Bestand vor dem Batch: in
  gcrun-342 58 % Textkopien über alle Typen statt gemessener 28 %.

Ohne diese Sicht im Standardbericht ist jede Iteration am Executor ein Blindflug (KVP braucht die
Ursache je Runde, nicht nur das Endergebnis).

## Ziel

Jeder S2-Bericht enthält ohne Zusatzaufruf:

1. **Regelbilanz je Fokusregel** — Runden, gelöst (alle Funde des Fokusfensters weg), Runden ohne
   angewandten Zug, typischer Zug, neue Fokusfunde je Runde nach Regel.
2. **Auffällige Muster** — Fokusregel → Zug → neue Funde, mit Anzahl, Lösungsquote und Beispielrunde.
3. **Regel-Pareto je Zugtyp** — Gate-Durchgang, befundfreie Züge, wie viele Regeln 80 % / 95 %
   der Züge fehlerfrei machen würden und welche.
4. **Dubletten über alle Typen**, auch innerhalb eines Batches.

## Umsetzung

- `rig/greenfield-systemtest/zuege.mjs` (neu): Runden aus `run-raw.log`, Zuordnung der Audit-Einträge,
  Nachspiel mit `dist/` (`generationStep`, `takeSteeringSnapshot`), Bilanz, Muster, Pareto, Bericht.
  **Selbstprüfung:** das Nachspiel rechnet den Fokus mit dem heutigen Code neu. Stimmen berechnete
  Stagnation und Defer-Keys nicht mit dem Log überein, meldet der Bericht „nicht nachspielbar" statt
  Zahlen — ein alter Lauf gegen neuen Code misst sonst die falsche Steuerung. Das Pareto liest nur
  das Audit (Gate-Delta) und gilt immer.
- `report.mjs`: ruft den Bericht für jeden Executor-Lauf.
- `verhalten.mjs`: `dubletten` über alle Typen, je Kommando gegen den laufenden Bestand.
- `tests/rig-zuege.test.ts`, `tests/rig-verhalten.test.ts`: echte Dateien, echte Funktionen.
- `rig/greenfield-systemtest/README.md`, `docs/messung/kennzahlen.md`: Eintrag.

## Akzeptanz

- `npm run build`, die Rig-Tests grün.
- `report.mjs` über `results-s2-40r-cr707.json` gibt die drei Abschnitte aus; die Zahlen decken sich
  mit der Analyse vom 2026-09-28 (IO-01 0 % gelöst in 16 Runden, RD-01 ≥ 90 %).
- Nicht Teil: ND-01-Artefakt `jaccard(∅,∅)=1` (contracts, eigener CR), Änderungen an der Steuerung.

## Nachweis (2026-09-28)

- `RESULTS_FILE=results-s2-40r-cr707.json node report.mjs`: alle drei Läufe nachspielbar (Selbstprüfung
  ohne Abweichung), die Zahlen decken sich mit der Analyse: RD-01 28 Runden / 93 % gelöst, IO-01 16 / 0 %,
  UC-01 15 / 100 %, R-16 11 / 0 %; Muster „IO-01 → +FUNC+MOD+REQ+TEST" 3 Runden, R-31 +17, RD-05 +14, ND-01 +12.
- Pareto (174 Züge): „MOD + allocate" 36 % durchs Gate, 4 Regeln für 95 % (IO-02, ein MOD je FUNC,
  FLOW braucht SCHEMA, ein compose-Parent); alle anderen Zugtypen 0–2 Regeln.
- Dubletten neu (jeder Typ, im Batch, Schablone getrennt): 83 / 13 / 22 (+35 / 6 / 6 Schablone) statt
  53 / 9 / 14. Stichprobe: kurze TEST-Texte bleiben unscharf (~80 % echt).
- `tests/rig-zuege.test.ts` (8, echtes `dist/`, inkl. Negativfall „nicht nachspielbar"),
  `tests/rig-verhalten.test.ts` (7), `tests/systemtest-rig.test.ts` (51) grün.
