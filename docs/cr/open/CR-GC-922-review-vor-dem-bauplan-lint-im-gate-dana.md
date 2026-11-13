# CR-GC-922: Review vor dem Bauplan: Lint im Gate, danach Agent ohne Vorwissen (Marke CDR)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1325 (finding)
**Erstellt:** 2026-11-13
**Item:** bok/items/ITEM-2026-1325.json (Lane: code)

---

## Befund

Beleg: immo-infra, Bau 2026-11-10 bis 11-12 (Stufe MS-INF-2). 17 von 20 Rückfragen an den Auftraggeber waren Lücken der Spezifikation. Einordnung je Frage: Sitzungsprotokoll 5126f023, ausgewertet 2026-11-13.

- Die Skills se:top-level, se-conops, se-irr, se-vorbereitung, se-fmea und se-plan liefen vor dem Bau. Keiner fand die Lücken.
- 5 der 17 Lücken zeigt kein Schema: Widerspruch einer Anforderung zu einer Invariante (drei REQ schrieben in die IONOS-Dateiablage, CR-INF-046 schloss das aus), falscher Träger (Abgleich an FUNC-anwendung-rechnen statt FUNC-umfeld-pruefen), zweite Quelle für das Protokoll der Läufe, Benutzer des Umfeld-Laufs, Umfang der Wiederherstellung.
- Wer das Modell geschrieben hat, liest diese Lücken nicht mehr. Gefunden hat sie erst der Umsetzer.

## Root Cause

Zwischen Spezifikation und Bauplan fehlt ein Review, das die Spezifikation liest wie der Umsetzer.

## Zielbild

Neuer Skill `se-cdr`, fällig nach dem Zod-Schema je Blattfunktion (CR-GC-917) und vor se-plan.

1. **Lint im Gate.** Der Skill liest `rules_get_violations` für die Regeln der Marke CDR (Bindung der SCHEMA, Regeln aus CR-SM-437). Ein Befund stoppt das Review.
2. **Review durch einen Agenten ohne Vorwissen.** Je Blattfunktion liest ein eigener Agent nur `graph_context` der Funktion und die Zod-Schemas an ihren Flüssen. Er listet jede Frage, die er vor dem Bau stellen müsste:
   - Datum der Anforderung fehlt als Feld im SCHEMA
   - Wert, Rolle oder Quelle fehlt
   - Anforderung widerspricht einer Invariante an SYS oder MOD
   - der Träger liest die Daten nicht, die die Anforderung braucht
   - Betriebsfrage offen (Benutzer, Rechte, Ort der Daten)
3. **Der Agent schreibt nichts ins Modell.** Der Autor beantwortet die Fragen, se:author-req schreibt sie.
4. **Klärt nur eine Messung die Frage, wird sie ein Versuch vor dem Plan** (Beispiel: Backup-Ziel am Webspace, immo-infra 2026-11-11).
5. **Ergebnis:** Liste der Fragen je Funktion. Eine leere Liste heißt baureif.

Grenze zwischen Spezifikation und Bau: Der Umsetzer entscheidet nichts, was das Verhalten ändert. Jede Frage an den Auftraggeber im Bau ist ein Befund gegen dieses Review.

Normbezug: Anforderung, Test und Schema zusammen entsprechen der „build-to"-Baseline nach dem CDR (NASA) und dem Detailentwurf vor dem Bau der Einheit (Automotive SPICE SWE.3).

## Akzeptanz

- Test auf den Skill-Text: beide Schichten, die fünf Fragearten, „schreibt nichts ins Modell".
- Rückwirkende Probe am Modell von immo-infra, Stand des Schnitts von CR-INF-069 (graphVersion 154, 2026-11-04): Das Review nennt mindestens die fünf Lücken aus dem Befund.
- Der Test war rot, bevor der Skill stand.

## Dateien (2)

`.claude/commands/se-cdr.md`, `tests/skill-cdr.test.ts`. Die Skill-Liste in `GRAPHCODE.md` entsteht beim Rollout aus dem Ordner der Skills.

## Abhängig von

CR-GC-917 (Zod-Schema je Blattfunktion), CR-SM-437.


---

## Umfang laut `graph_impact`

Kein Schnitt aus dem Modell: Der CR legt den Knoten `FUNC-se-cdr` neu an und ändert keinen bestehenden. Nachbarn zur Einordnung: `FUNC-se-irr` (läuft davor), `FUNC-se-plan` (läuft danach). Die Kante vom CR-Knoten auf `FUNC-se-cdr` entsteht mit dem Knoten.
