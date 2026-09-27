# CR-GC-700: Der Subagent-Kanal ist ungemessen: ein einziger Agent/Explore-Aufruf lieferte im Lauf vom 2026-09-23 32.054 Zeichen = 18 Prozent aller Werkzeugantworten, und weder steuerung.mjs noch die Antwort-Diaet-CRs kennen ihn

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-503 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-503.json (Lane: code)

---

NACHGEMESSEN 2026-09-23 am claude-stream.jsonl des Laufs (Standard-Korpus, opus5).

Die erste Fassung dieses Items nannte 32.054 Zeichen (die Antwort des Agent-Aufrufs). Das ist nur
die Zusammenfassung, die zurueckkam. Der Strom traegt die INNEREN Zuege des Subagenten ebenfalls,
erkennbar an `parent_tool_use_id` (109 Zeilen):

  Hauptagent   60 Aufrufe   180.641 Zeichen   (davon graphcode 50 / 141.913)
  Subagent     54 Aufrufe   135.052 Zeichen   (47x Read, 7x Bash)

Der Subagent stellt damit 43 % aller Werkzeugantworten des Laufs und 0 % der Messung. Weder
`steuerung.mjs` noch `turn-analyse.mjs` trennen nach `parent_tool_use_id`; die Antwort-Diaet-CRs
(GC-611/613/621/624) messen ausschliesslich den Hauptagenten.

Die Daten liegen vor: der Strom fuehrt `parent_tool_use_id`, `subagent_type`, `task_id`,
`task_type`. Es fehlt nur die Auswertung.

WARUM DAS ZAEHLT: der Subagent hat hier die Materialerkundung uebernommen (47 Reads im
sigloch-modules-Repo) — dieselbe Arbeit, die der Hauptagent auf dem Prosa-Korpus selbst macht.
Ein Vergleich zweier Laeufe ueber 'Zeichen im Kontext' ist zwischen einem Lauf mit und einem ohne
Subagent nicht apples-to-apples, solange die Messung nur den Hauptagenten sieht.

---

## Umfang

Messwerkzeug ohne Modellknoten. 3 Dateien: `rig/greenfield-systemtest/turn-analyse.mjs`,
`rig/greenfield-systemtest/report.mjs`, `tests/systemtest-rig.test.ts`.

## Befund beim Nachmessen

Der Subagent war nicht nur ungemessen, er stand **vermischt** in der Messung: `leseTurns` fuehrte
seine Turns in der Folge des Hauptagenten (opus5-0: 20 von 71), und ein Werkzeugergebnis fiel dem
naechsten Turn gleich welchen Kanals zu — `lesenJeAusloeser` und `bedarfsAnalyse` rechneten damit
Subagent-Lesungen als Ausloeser von Hauptagent-Turns und umgekehrt.

## Ergebnis

- `leseTurns`: jeder Turn traegt `kanal` (`haupt` | `subagent`, aus `parent_tool_use_id`); je Kanal
  eine eigene Ergebnis-Warteschlange — ein Ergebnis loest nur den naechsten Turn SEINES Kanals aus.
- `kanalBilanz(turns)`: je Kanal Turns, Aufrufe, Zeichen der Werkzeugantworten, Cache-Lesung.
- `report.mjs`: Spalte „davon Subagent (Turns · Antwortzeichen)" in der Kontextkosten-Tabelle.
- Die Summen (`pruefeGegenResultzeile`) bleiben ueber beide Kanaele — die Ergebniszeile zaehlt den
  Subagenten mit.

## Akzeptanz

- [x] Rot zuerst: „trennt Haupt- und Subagent-Kanal" — `kanal` fehlte, das Bash-Ergebnis des
      Hauptagenten wurde dem ersten Subagent-Turn zugeschrieben.
- [x] `systemtest-rig.test.ts` 50/50.
- [x] Validiert an opus5-0: Subagent 20 Turns, 54 Aufrufe, 128.321 Antwortzeichen = 40 % aller
      Werkzeugantworten (Item: 54 Aufrufe, 135.052 Zeichen, 43 % — Differenz: das Item zaehlte
      Roh-Zeilen, hier je distinkter Nachricht). Bericht zeigt `20 · 128.321`.
- Nicht Teil: `steuerung.mjs` (misst Steuerzuege, keine Werkzeugantworten) und die
  Antwort-Diaet-CRs (GC-611/613/621/624, abgeschlossen) — kuenftige Vergleiche lesen die Spalte.
