# CR-GC-738: rig/ ist das eine Rig: Treiber mit Sequenz, Aufgaben (todo, sigllm-prosa), serie.json, Referenzlauf je Standardfall

**Status:** ✅ Done (2026-10-05)
**Typ:** aus Item ITEM-2026-741 (idea)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-741.json (Lane: code)

---

CR 2 von 5 des Konzepts [`docs/graphcode_messaufbau_konzept.md`](../../graphcode_messaufbau_konzept.md).

## Befund

Das interaktive Rig lag als `rig/interaktiv/` neben acht anderen Aufbauten; seine Aufgabe steckte als ein JSON
(`korpus/todo.json`) im Treiber, die Ende-Regel und die Schleife waren fest auf Modellieren verdrahtet, eine
Serie (N ≥ 3 je Arm) fuhr man von Hand, und kein Lauf lag als Referenz im Repo. Die Leitlinie nennt S2 auf
`sigllm-prosa`; dessen Teile lagen verstreut unter `rig/sigllm-spezifikation/`.

## Umsetzung

- `rig/` ist das Rig: `treiber.mjs`, `simulator.mjs`, `arme.mjs`, `auswertung.mjs` (bis CR 3) eine Ebene hoch;
  `runs/<aufgabe>/<arm>-<nr>/` (gitignored), die Läufe vom 2026-10-04 lokal nach `runs/todo/`.
- **Aufgabe** `aufgaben/<name>/`: `start.md`, `antwortblatt.md`, `punkte.json`, `aufgabe.json` (Quelle, Sequenz);
  `aufgabeLaden` im Simulator. `todo` aus dem Korpus, `sigllm-prosa` aus Auftrag (Start), Projektdefinition
  (Antwortblatt) und `auftragspunkte.json` (Raster) der sigllm-Spezifikation.
- **Sequenz**: `aufgabe.sequenz` nennt die Stufen; der Treiber führt `STUFEN[stufe](lage)` aus, heute nur
  `modellieren` (Ende SRR+PDR). Jeder Zug trägt seine Stufe. Eine weitere Stufe ist eine Funktion, kein Treiber.
- **Serie** `serie.json` + `treiber.mjs serie [--plan]`: fährt je Aufgabe × Arm, was für den heutigen Stand fehlt
  (`fehlendeLaeufe`, rein). **Stand** = Code-Stand graphcode + Commit der Vorlage (`vorlageStand`), in `lauf.json`
  und im Stempel (`· vorlage <sha>`).
- **Referenzlauf** `treiber.mjs referenz <lauf-dir>` → `aufgaben/<name>/referenz/<arm>/` (graph, audit, lauf,
  denken, stempel.json), ersetzt den alten (`referenzSetzen`, rein bis auf Dateien).
- `rig/README.md`: Abschnitt „Das Rig"; `docs/messung/interaktiv.md` Pfade.

Die ersten Referenzläufe (todo, lokal nvfp4 und frontier) entstehen mit der ersten Serie nach dieser CR und
kommen mit CR 3 ins Repo — dort braucht die Auswertung sie ohnehin.

## Verifikation

`tests/rig-interaktiv.test.ts`: 16 grün (Aufgabe laden, Stufen, `fehlendeLaeufe`, `referenzSetzen`, Simulator,
Kennzahlen). Smoke: `node rig/treiber.mjs` (Usage), `node rig/treiber.mjs serie --plan` nennt sechs fehlende
Läufe mit den nächsten freien Nummern (lokal-4…6, frontier-4…6). `npm run verify:full CR-GC-738`: 1812 grün; rot `distribution` (Publish-Pending, bekannt) sowie zwei Folgen dieser
CR, danach behoben und einzeln grün: `rig-verhalten` (das alte `blindurteil.mjs` zeigte auf das verschobene Raster —
jetzt auf `rig/aufgaben/sigllm-prosa/`, bis es mit CR 4 fällt) und `verify-model.completeness`
(`rig-interaktiv.test.ts` nennt `graph.json` als Artefaktnamen → EXCLUDED mit Grund).
