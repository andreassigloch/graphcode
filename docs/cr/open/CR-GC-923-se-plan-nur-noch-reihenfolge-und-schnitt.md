# CR-GC-923: se-plan nur noch Reihenfolge und Schnitt: Fragen, Schreiben und Bau herauslösen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1326 (finding)
**Erstellt:** 2026-11-13
**Item:** bok/items/ITEM-2026-1326.json (Lane: code)

---

## Befund

se-plan (Version 11, 88 Zeilen) erledigt drei Aufgaben:

| Abschnitt | Tätigkeit | Gehört zu |
|---|---|---|
| §2 | offene Fragen stellen, Antwort als REQ schreiben | Spezifikation |
| §3 | fehlende REQ und TEST schreiben | Spezifikation |
| §4 Stufe 1 | SCHEMA als erste Baustufe | Spezifikation (CR-GC-917) |
| §4 bis §6 | Reihenfolge ableiten, CRs schneiden | Plan |
| §7 Absatz 2 | Lücke der Spezifikation schließen | Spezifikation |
| §10 | Agenten starten, zusammenführen, ausrollen | Bau |

Beleg: immo-infra, Bau 2026-11-10 bis 11-12 (Stufe MS-INF-2). 17 von 20 Rückfragen an den Auftraggeber waren Lücken der Spezifikation. Einordnung je Frage: Sitzungsprotokoll 5126f023, ausgewertet 2026-11-13.

## Root Cause

Review und Bau-Skill fehlten. se-plan hat beide Lücken über sieben CRs nebenbei gefüllt.

## Zielbild

1. **Vorbedingung:** se-cdr meldet keine offene Frage.
2. **§2 wandert nach se-conops:** Altbestand, Zielumgebung und Ort der geteilten Verträge sind Betriebsbelange.
3. **§3 prüft nur noch.** Fehlt ein Test in der Sicht `testconcept`, stoppt se-plan und verweist auf se:author-req.
4. **Stufe „Contracts" entfällt.** Das Zod-Schema ist Teil der Spezifikation. Der Plan beginnt bei den Blattfunktionen.
5. **§7 Absatz 2 wird ein Stopp:** Lücke gefunden → zurück zu se-cdr.
6. **§10 wandert in den Skill se-bau.**

## Akzeptanz

- `se-plan.md` enthält kein AskUserQuestion und keine Anweisung „write it".
- Für ein Modell mit ungebundenem SCHEMA an einer Blattfunktion stoppt se-plan vor dem Schnitt.
- `deriveImplPlan` liefert keine Stufe für SCHEMA; die Abdeckung `reqCoverage` bleibt gleich.
- Tests zum Skill-Text vorher rot, nachher grün.

## Dateien (4)

`.claude/commands/se-plan.md`, `.claude/commands/se-conops.md`, `src/loop/se-plan.ts` (nur falls die Stufe dort abgeleitet wird), `tests/skill-plan*.test.ts`.

## Abhängig von

CR-GC-922 (se-cdr), CR-GC-924, CR-GC-917.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
