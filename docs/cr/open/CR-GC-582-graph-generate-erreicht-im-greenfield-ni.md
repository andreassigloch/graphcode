# CR-GC-582: graph_generate erreicht im Greenfield nie done=true: Endspiel haengt an AF-01/03 (Frischestempel), BQ-02, FM-01, CR-R03 — der Agent beendet nach eigenem Urteil, im Webapp-Korpus Schleife bis Timeout (runde7, 4/4 Laeufe)

**Status:** 🟠 Umgesetzt, Bestaetigungslauf offen
**Typ:** aus Item ITEM-2026-430 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-430.json (Lane: graph)

---

## 1 Befund — und was die Messung am Item korrigiert

Kein `opus5`-Lauf erreichte je `done=true`. Das Item vermutete die Frischestempel (AF-*) als Ursache.
Der Endstand der vier Laeufe sagt etwas anderes:

| Lauf | blockierende Fehler | offen an den Phasengates |
|---|---:|---|
| `opus5-5` | 5 | viele, u.a. AF-01..05 |
| `opus5-6` | 9 | BQ-02, BQ-06, CR-R03, UC-05/06, BW-02, CR-01, R-04, R-22, RD-05, FM-03, R-21 |
| `opus5-7` | **0** | FM-01, **CR-01, RD-04** |
| `opus5-8` | 7 | BQ-02, BQ-06, CR-R03, BW-02, CR-01, R-04, R-22, RD-05, FM-03 |

In 6 und 8 hatte die Steuerung **recht** — dort stoppte der Agent mit offenen Fehlern. In 7 blieb
die Freigabe an zwei **Steuerregeln** haengen: RD-04 und CR-01 gehoeren zu `STEER_RULES`
(se-engine: RD-04, BW-02, R-04, CR-01, MT-02), den Termen des Steuerwerts. Der Freigabe-Prompt
schickt genau diese Funde in die Optimierung danach ("arbeite die Funde ab, das fitAdvisory zeigt,
ob Δm in Zielrichtung laeuft"). Die Befunde der naechsten Phase versperrten den Eintritt in sie.

## 2 Umsetzung

`handoffGate(phaseReadiness)` in `kernel/measure/readiness.ts`: wie `currentPhaseGate`, aber ohne
`STEER_RULES`. `generationStep` entscheidet die Freigabe damit. `phaseReadiness` selbst bleibt
unveraendert wahr — die Regeln stehen weiter als offen im Bericht.

Abnahme `tests/readiness.model.test.ts`: der Endstand von `opus5-7` sperrt nicht mehr; FM-01 sperrt
weiter; jede Steuerregel ist wirklich einem Gate zugeordnet (sonst waere der Filter leer).

**Nicht Teil dieses Zugs:** dass der Agent in 6 und 8 mit offenen Fehlern aufhoert. Das ist die
Gegenrichtung — die Steuerung sagt "nicht fertig", der Agent ueberstimmt sie.

## 3 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Steuerregeln sperren die Freigabe nicht, alles andere weiter | erfuellt, Test |
| 2 | Bestaetigungslauf: erreicht er ohne blockierende Fehler die Freigabe? | offen |
