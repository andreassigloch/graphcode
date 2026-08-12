# CR-GC-327 — Prüfreport: Testergebnisse zurück in den Graph

**Status:** done (2026-08-12, Scope reduziert — siehe §8) · **Datum:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert** (`testResult` ist bereits deklariert)
**Bezug:** CR-GC-134/CR-GC-204 (`graph_tests`, testRef → lauffähiger Befehl), CR-184 (VR-01),
CR-GC-253/RC-02 (testRef zeigt auf einen echten Test), CR-GC-220 (Views sind deterministische
Projektionen), [CR-GC-324](CR-GC-324-nextstep-regelblind-rest-von-303.md) (Vorbedingung: `attributes.testResult` muss auf dem Auswertungspfad ankommen)

---

## 1. Problem

Der Hinweg steht: `graph_tests` löst einen changeSet über `TEST.attributes.testRef` in einen
minimalen `vitest run`-Befehl auf. Der **Rückweg fehlt** — kein Pfad bringt das Ergebnis eines Laufs
in den Graph zurück.

Das Feld dafür ist längst deklariert: `ontology.ts` führt `testResult` als Enum
`passed | failed | skipped | pending`, VR-01 prüft seine Anwesenheit („has no testResult — assumed
pending"). Auf graph-view-edit feuert VR-01 für **alle 14** TEST-Knoten; kein einziger trägt je ein
Ergebnis, obwohl die Suite dort mit 537 von 537 grün läuft.

**Die Konsequenz steht in einem ausgelieferten Dokument:** `docs/views/testmatrix.md` (VCRM) zeigt
für alle 72 REQ ein `✓ verified`. Dieses Häkchen bedeutet ausschließlich „es existiert eine
verify-Kante" — nicht „ein Test lief und bestand". Ein Prüfer, der die Matrix als Verifikationsnachweis
liest, liest sie falsch, und das Dokument gibt ihm keinen Anhaltspunkt dafür. Für die
Implementierungsphase ist das der teuerste offene Punkt: Verifikation wird behauptet, nicht belegt.

Ebenfalls unbelegt: **Evidenz**. Systemtests erzeugen Artefakte (Screenshots, Messwerte); es gibt
keinen Ort im Modell, der einen TEST mit seinem Nachweis verbindet.

---

## 2. Ziel

1. Ein Testlauf schreibt sein Ergebnis an die TEST-Knoten, die er ausgeführt hat.
2. Ein Konsument kann je REQ abfragen: welcher TEST, welcher Lauf, welches Ergebnis, welche Evidenz.
3. Die VCRM unterscheidet sichtbar „verify-Kante vorhanden" von „bestanden".

---

## 3. Nicht-Ziele

- **Kein Testrunner in graphcode.** graphcode führt nichts aus. Es nimmt das Ergebnis eines Laufs
  entgegen (Runner-JSON) — wer den Lauf startet, bleibt Sache des Aufrufers.
- **Kein neues Attribut, wo eines existiert.** `testResult` ist deklariert und wird benutzt; erfunden
  wird nichts.
- **Keine Ontologie-Änderung.** Falls Lauf-Zeitstempel und Evidenzpfad ein zusätzliches Feld
  brauchen, ist das ein contracts-CR und hier nur als Vorbedingung zu benennen — nicht nebenbei
  einzuführen.
- **Kein Vertrauensvorschuss.** Ein `testResult` ohne zugehörigen Lauf-Stempel ist wertlos: eine
  gestern bestandene Zusicherung über heute geändertem Code ist kein Nachweis. Die Alterung gehört
  in den Report, nicht in eine Fußnote.

---

## 4. Anforderungen

1. **Ingest:** ein Weg, ein Runner-Ergebnis (vitest `--reporter=json`; das Format trägt Datei,
   Fälle, Status, Dauer) auf die TEST-Knoten abzubilden — Zuordnung über `testRef.file`, nicht über
   Namensraten. Nicht zuordenbare Dateien werden **gemeldet**, nie still verworfen (dieselbe Regel
   wie `graph_tests` mit `unresolved`).
2. Jeder betroffene TEST-Knoten bekommt `testResult` plus den Lauf-Stempel (Zeitpunkt und die
   `graphVersion`, gegen die gelaufen wurde) — analog zum Freshness-Stempel der Analyse-Artefakte
   (CR-SM-227/CR-GC-300), damit „Ergebnis veraltet" überhaupt entscheidbar ist.
3. **Report:** ein Read-only-Tool, das je REQ liefert: verifizierende TESTs, deren `testRef`,
   `testResult`, Lauf-Stempel, Evidenzpfad — und einen expliziten Zustand `nicht ausgeführt` für
   TESTs ohne Ergebnis. Kein Default auf „grün", kein Weglassen der Zeile.
4. **Evidenz:** ein Feld für den Nachweis-Pfad (Screenshot, Messprotokoll) — pro Eintrag, siehe
   Vorbedingung.

**Vorbedingung — CR-SM-231 (`testRefs`: 1 Abnahme, n Testdateien):** solange ein TEST genau eine
Datei kennt, ist `testResult` am Knoten eindeutig. Mit `testRefs[]` ist es das nicht mehr —
`TEST-dashboard` läuft als `dashboard.test.mjs` (vitest) UND `dashboard-render.spec.mjs`
(playwright), „einer rot, einer grün" wäre nicht darstellbar. Ergebnis, Lauf-Stempel und
Evidenzpfad hängen deshalb **pro `testRefs`-Eintrag**, dort wo `tool` schon hängt. Dieser CR
setzt das voraus und definiert es nicht selbst; die Feld-/VR-01-Änderung ist ein contracts-CR
(in CR-SM-231 unter „Nicht in diesem CR" als Weg 2 vermerkt).
5. **VCRM ehrlich machen:** `docs/views/testmatrix.md` trennt „verify-Kante" von „bestanden"; ein
   REQ, dessen TEST nie lief, darf dort kein `✓` tragen.
6. Der Ingest schreibt über den bestehenden Mutationspfad (Gate, Audit, Provenienz) — kein
   Seitenkanal am Gate vorbei.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tools/report.ts` | Prüfreport-Tool registrieren |
| `src/tools/write.ts` | Ingest-Tool (Runner-JSON → `testResult` + Stempel) über den Gate-Pfad |
| `src/testreport.ts` (neu) | Zuordnung Runner-Ergebnis ↔ testRef, Projektion REQ × TEST × Ergebnis |
| `src/views/incose.ts` | `testmatrix` trennt Kante von Ergebnis |
| `tests/testreport.test.ts` (neu) | nicht zuordenbare Datei wird gemeldet; „nie gelaufen" ≠ grün; Stempel-Alterung |
| `docs/cr/…` | dieser CR |

5 Dateien (+ ggf. ein contracts-CR für das Evidenzfeld).

---

## 6. Akzeptanzkriterien

- [x] Nach Ingest eines echten vitest-JSON tragen die getroffenen TEST-Knoten `testResult`;
      VR-01 feuert für sie nicht mehr. (Lauf-Stempel → CR-GC-328, s. §8.)
- [x] Ein TEST ohne Lauf erscheint im Report als `not-run` — nicht als bestanden, nicht gar nicht.
- [x] Eine Runner-Datei ohne passenden `testRef` erscheint als `unresolved`.
- [x] `docs/views/testmatrix.md` zeigt für einen REQ mit verify-Kante, aber ohne Lauf, kein `✓`
      (zwei Spalten: `verify-Kante` und `Lauf-Ergebnis`, plus die Zeile „Belegt: n/m").
- [ ] ~~Ein Ergebnis, das gegen eine ältere `graphVersion` gelaufen ist, ist als veraltet
      erkennbar.~~ → **CR-GC-328** (§8).
- [x] `npm run build` + volle Suite grün.

---

## 7. Folgen

Damit wird der Prüfreport zum ersten Artefakt, das Verifikation **belegt** statt behauptet — die
Grundlage für TRR und für jede Abnahme, die Evidenz sehen will. graph-view-edit rendert ihn dann
als `docs/views/testreport.md` und als Dashboard-Karte, ohne selbst zu rechnen.

---

## 8. Abschluss: was geliefert ist und was nicht

**Geliefert** (`src/testreport.ts`, `src/tools/testreport.ts`, `src/views/incose.ts`,
`tests/testreport.test.ts`, `src/mcp-tools.ts`):

- `graph_test_ingest` — vitest-JSON (oder vorgeparste `[{file,result}]`) → `testResult` an den
  TEST-Knoten, Zuordnung über `testRef.file`, **durch das Gate** (auditiert, keine Sonderroute).
  Nicht zuordenbare Dateien kommen als `unresolved` zurück. `dryRun` liefert den Plan.
- `graph_test_report` — je REQ: verifizierende TESTs, `testRef`, Ergebnis, mit `not-run` als
  eigenem Zustand; Summary `withVerifyTrace / passed / neverRun / failed`.
- VCRM ehrlich: Kante und Ergebnis in getrennten Spalten.

**Bewusst NICHT geliefert — Entscheidung 2026-08-12:** Lauf-Stempel am Knoten und Evidenzfeld.
Beide brauchen ein neues Ontologie-Feld, und §3 dieses CR verbietet, so etwas nebenbei
einzuführen. Der Ingest **überschreibt**; der frühere Stand bleibt über die Historie lesbar
(Audit-Trail / `graph_timetravel`, CR-GC-311) — dort steht auch die `graphVersion` des Laufs.
Was damit offen bleibt: „ist DIESES Ergebnis veraltet?" pro Knoten in einer Antwort. Das plus
Evidenz steht in **[CR-GC-328](CR-GC-328-lauf-stempel-und-evidenz.md)**, zusammen mit den drei
Fragen, die vor einer Implementierung zu entscheiden sind.

@author andreas@siglochconsulting
