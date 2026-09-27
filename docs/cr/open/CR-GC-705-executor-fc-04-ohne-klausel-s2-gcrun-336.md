# CR-GC-705: Executor: FC-04 ohne Klausel — S2 gcrun-336..338 stagnieren je Lauf ~16 von 40 Runden an FC-04/R-16/AF-04, arch nie erreicht; Ausgang FUNC->FLOW->ACTOR fehlt in allen Laeufen. Klausel mit Skelett-uids aus dem Bestand

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-629 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-629.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang

`FUNC-generation-step` (`src/loop/generate.ts`: neue `RULE_CLAUSE` FC-04, `fc04Skelett`),
`tests/generate.test.ts`. 2 Dateien. Abgrenzung: ITEM-2026-603 (Vorschlagsvorlage FC-04 in se-engine)
ist ein anderer Kanal — dies ist die Executor-Klausel.

## Ergebnis

FC-04 bekommt eine Klausel nach dem Muster von CR-GC-704: je Kette nur, was fehlt — Eingang
ACTOR→FLOW→FUNC (erste FUNC der Kette), Ausgang FUNC→FLOW→ACTOR (letzte FUNC); FUNC und ACTOR aus
dem Bestand, FLOW/SCHEMA-uids fest (`FLOW-<kette>-eingabe|ergebnis`). Eine Regel mit Klausel
rangiert im Fundfenster vor einer ohne (`klauselRang`) — FC-04 wird damit bearbeitet statt nach drei
Runden zurueckgestellt.

## Akzeptanz

- [x] Rot zuerst: „FC-04 gibt je Kette das Skelett fuer den fehlenden Ausgang vor".
- [x] Betroffene Tests 154/154, `tsc` sauber.
- [x] Im Lauf (S2 gcrun-339..341, 40 Runden, gegen gcrun-336..338 ohne Klausel): FC-04 in keinem Lauf
      mehr zurueckgestellt (vorher je Lauf mehrfach); `FUNC -io-> FLOW` und `FLOW -io-> ACTOR` jetzt in
      allen Laeufen (vorher in keinem); Aehnlichkeit zum Golden 56/56/59 % (vorher 46/48/44 %);
      Stillstand-Runden 11/10/13 (vorher ~16).
- Nicht erreicht, benannt: `arch` nur einmal im Fokus (AF-02), Ketten weiter mit genau einer FUNC
  (14/14), MOD 0–1 — CR-GC-702 und T-V5 bleiben ungemessen. Neuer Engpass: Stillstand an AF-01..04
  (Analyse-Stempel, die der Executor nicht erzeugen kann). Und: die gewonnenen Runden gehen in die
  req-Phase, wo das Modell bestehende REQ/TEST neu anlegt — Dubletten 23/16/5 (vorher 2/1/4),
  „ohne Befund" ausgeloest. Beides eigene Items.
