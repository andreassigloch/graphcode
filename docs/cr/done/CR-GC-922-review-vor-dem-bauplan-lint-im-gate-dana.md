# CR-GC-922: Review vor dem Bauplan: Lint im Gate, danach Agent ohne Vorwissen (Marke CDR)

**Status:** ✅ Done (2026-11-18, Akzeptanz 4 von 5, siehe Ergebnis)
**Typ:** aus Item ITEM-2026-1325 (finding)
**Erstellt:** 2026-11-13
**Item:** bok/items/ITEM-2026-1325.json (Lane: code)

---

## Ergebnis (2026-11-18)

- Neuer Skill `.claude/commands/se-cdr.md`, Version 2. Schichten: Lint im Gate, je Blattfunktion ein Agent ohne
  Vorwissen, Abgleich über alle Blattfunktionen, Versuch bei Messfragen, Liste je Funktion mit Rang.
- Entscheidungen des Autors 2026-11-18:
  - Der Stopp zählt nur Befunde bis Stufe 8 an den Blattfunktionen im Review, ihren Flüssen und SCHEMA.
    Marke CDR = Stufe 8 (`MARK_STAGE` in contracts `readiness.js`). RC-08 liegt auf Stufe 12 und steht nur in der
    Bedingung „baureif".
  - FAQ `headless-keine-rueckfrage` geht vor: Im Lauf ohne Mensch schreibt se:author-req jede offene Frage als
    Annahme.
  - Probe am Commit 8699429 von immo-infra (Stand 196). Stand 154 liegt in keinem Commit; 8699429 ist der erste Commit
    nach dem Schnitt von CR-INF-069 und liegt vor dem Bau.

### Probe (rückwirkend, immo-infra Stand 196)

Aufbau: je Funktion ein Agent ohne Vorwissen. Er las nur den Ausschnitt seiner Funktion und §2/§3 des Skills ohne die
Beispielzeilen, weil die Beispiele die gesuchten Lücken nennen. Geprüft: `FUNC-anwendung-rechnen`,
`FUNC-umfeld-pruefen`, `FUNC-daten-wiederherstellen`. Bei Stand 196 hatten die SCHEMA noch kein Zod; die Agenten
lasen die SCHEMA-Beschreibung.

| Lücke aus dem Befund | Version 1 (je Funktion) | Version 2 (+ Abgleich) |
|---|---|---|
| Umfang der Wiederherstellung | gefunden (ganze DB gegen ein Satz; Test widerspricht der REQ) | gefunden |
| Benutzer des Umfeld-Laufs | gefunden | gefunden |
| zweite Quelle für das Protokoll der Läufe | halb (nur „wohin schreibt der Lauf sein Protokoll") | gefunden (drei Listen „wer tat was") |
| falscher Träger (Abgleich) | nicht gefunden | gefunden (beide Funktionen erkennen den Maklerwechsel) |
| Widerspruch zur Invariante Ablage | nicht gefunden | nicht gefunden |

- **Akzeptanz „mindestens die fünf Lücken": nicht erreicht, 4 von 5.** Die Invariante war im Ausschnitt nicht als
  Widerspruch sichtbar: Bei Stand 196 sagt `REQ-kundendaten-ablage`, Verträge liegen nur in der Dateiablage, und
  `REQ-partnervertrag-verknuepft` legt sie dorthin. Ob die Regel aus CR-INF-046 bei Stand 196 im Modell stand, ist
  nicht geprüft.
- Version 1 lieferte rund 170 Fragen für drei Funktionen; die Treffer gingen darin unter. Daraus kam der Rang
  `behaviour`/`detail`. Der Abgleich lieferte 15 Befunde, 13 davon `behaviour`. Ob der Rang die Liste der Schicht 2
  kürzt, ist nicht gemessen.
- Positivkontrolle: Die vier Tests zu Abgleich und Rang waren gegen den Skill ohne §3 und Rang rot (4 von 17).

### Modell

`FUNC-se-cdr` unter `FUNC-block-urteilsarbeit`, auf `MOD-agent-surface`, in `FCHAIN-skill-report` (der Skill
schreibt nichts; zuerst stand er in `FCHAIN-skill-authoring`, `tests/skill-authoring-gate.test.ts` wurde im Volllauf
rot), erfüllt `REQ-cdr-fragen-vor-dem-bau` (unter `REQ-code-quality`), verifiziert von `TEST-skill-cdr`
(graphVersion 1264).

`npm run verify:full CR-GC-922`: 233 Testdateien, rot 0, Schlupf 0. Der Volllauf davor (für CR-GC-924) war rot an
`tests/skill-authoring-gate.test.ts`, Ursache die falsche Kette oben.

## Befund

Beleg: immo-infra, Bau 2026-11-10 bis 11-12 (Stufe MS-INF-2). 17 von 20 Rückfragen an den Auftraggeber waren Lücken der Spezifikation. Einordnung je Frage: Sitzungsprotokoll 5126f023, ausgewertet 2026-11-13.

- Die Skills se:top-level, se-conops, se-irr, se-vorbereitung, se-fmea und se-plan liefen vor dem Bau. Keiner fand die Lücken.
- 5 der 17 Lücken zeigt kein Schema: Widerspruch einer Anforderung zu einer Invariante (drei REQ schrieben in die IONOS-Dateiablage, CR-INF-046 schloss das aus), falscher Träger (Abgleich an FUNC-anwendung-rechnen statt FUNC-umfeld-pruefen), zweite Quelle für das Protokoll der Läufe, Benutzer des Umfeld-Laufs, Umfang der Wiederherstellung.
- Wer das Modell geschrieben hat, liest diese Lücken nicht mehr. Gefunden hat sie erst der Umsetzer.

## Root Cause

Zwischen Spezifikation und Bauplan fehlt ein Review, das die Spezifikation liest wie der Umsetzer.

## Zielbild

Neuer Skill `se-cdr`, fällig nach dem Zod-Schema je Blattfunktion und vor se-plan.

1. **Lint im Gate.** Der Skill liest `rules_get_violations` für die Regeln der Marke CDR (Bindung der SCHEMA, Regeln aus CR-SM-437). Ein Befund stoppt das Review. Baureif ist eine Blattfunktion erst, wenn jedes SCHEMA an ihren Flüssen einen `realRef` auf ein Zod-Schema trägt (R-26, RC-08; übernommen aus CR-GC-917, dort ohne Ort geschlossen).
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

CR-SM-437. CR-GC-917 ist geschlossen; seine Bedingung steht in Zielbild Punkt 1.


---

## Umfang laut `graph_impact`

Kein Schnitt aus dem Modell: Der CR legt den Knoten `FUNC-se-cdr` neu an und ändert keinen bestehenden. Nachbarn zur Einordnung: `FUNC-se-irr` (läuft davor), `FUNC-se-plan` (läuft danach). Die Kante vom CR-Knoten auf `FUNC-se-cdr` entsteht mit dem Knoten.

## Entscheidungen

_Nachtrag 2026-11-26 (CR-AB-036, aise-bok): Der Abschnitt fehlte beim Schließen. Übertragen aus dem Text oben; der Text oben bleibt unverändert._

| Frage | Festlegung | Begründung |
|---|---|---|
| Was zählt beim Stopp von se-cdr? | Nur Befunde bis Stufe 8 an den Blattfunktionen im Review, ihren Flüssen und SCHEMA. Marke CDR ist Stufe 8; RC-08 liegt auf Stufe 12 und steht nur in der Bedingung „baureif". | Entscheidung des Autors 2026-11-18 (Abschnitt „Ergebnis (2026-11-18)") |
| Was tut se-cdr im Lauf ohne Mensch? | Die FAQ `headless-keine-rueckfrage` geht vor: se:author-req schreibt jede offene Frage als Annahme. | Entscheidung des Autors 2026-11-18 (Abschnitt „Ergebnis (2026-11-18)") |
| Wann ist eine Blattfunktion baureif? | Wenn jedes SCHEMA an ihren Flüssen einen `realRef` auf ein Zod-Schema trägt (R-26, RC-08) und die Liste der Fragen aus dem Review leer ist. | Zielbild Punkt 1 und 5 (Abschnitt „Zielbild") |
| Darf der Review-Agent ins Modell schreiben? | Nein. Der Autor beantwortet die Fragen, se:author-req schreibt sie. | Zielbild Punkt 3 (Abschnitt „Zielbild") |
| Was geschieht mit einer Frage, die nur eine Messung klärt? | Sie wird ein Versuch vor dem Plan. | Im CR nicht genannt (Abschnitt „Zielbild", Punkt 4) |
| Was entscheidet der Umsetzer im Bau? | Nichts, was das Verhalten ändert. Jede Frage an den Auftraggeber im Bau ist ein Befund gegen das Review. | Grenze zwischen Spezifikation und Bau (Abschnitt „Zielbild") |
