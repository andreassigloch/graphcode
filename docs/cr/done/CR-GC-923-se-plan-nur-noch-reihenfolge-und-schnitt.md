# CR-GC-923: se-plan nur noch Reihenfolge und Schnitt: Fragen, Schreiben und Bau herauslösen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1326 (finding)
**Erstellt:** 2026-11-13
**Item:** bok/items/ITEM-2026-1326.json (Lane: code)

---

## Ergebnis (2026-11-18)

- **se-plan** (Version 15 → 16, 89 → 86 Zeilen): neuer §0 Vorbedingung (se-cdr leer; SCHEMA ohne `realRef` auf Zod, R-26/RC-08, oder Befund bis Stufe 8 an einer geschnittenen Blattfunktion → Stopp vor dem Schnitt, Verweis se-cdr). §2 fragt nichts mehr: liest die REQ von se-conops (Altbestand → Stufe Switch-over, Zielumgebung → Stufe 0, Ort der geteilten Verträge → Voraussetzung im CR-Text); fehlt die Antwort, Stopp mit Verweis se-conops. §3 prüft nur: fehlender Test in `testconcept` → Stopp, Verweis se:author-req (Spalte „If missing: write it" entfällt). Stufe „Contracts" entfällt, Stufen neu nummeriert, der Plan beginnt bei den Blattfunktionen. §7: Lücke der Spezifikation → Stopp, zurück zu se-cdr. §10 (Agenten starten, zusammenführen, ausrollen) gelöscht, Verweis auf se-bau. Kein `AskUserQuestion`, kein Schreiben von REQ/TEST; MS/CR/relation über das Gate bleiben.
- **se-conops** (Version 10 → 11, 51 → 57 Zeilen): §1 trägt die Fragen Altbestand, Zielumgebung, Ort der geteilten Verträge (AskUserQuestion, Antwort über se:author-req als REQ mit TEST).
- `src/loop/se-plan.ts` unverändert; `reqCoverage` unverändert (`tests/se-plan.ordering.test.ts` grün).
- Tests: `tests/se-plan.groups.test.ts` um 7 Assertions erweitert (Skill-Text se-plan und se-conops), die alte Prüfung von §10 ersetzt; `tests/skill-zugangsliste.test.ts` Anker „1. **Contracts**" → „1. **Leaf functions**". Vorher 7 rot (richtiger Grund: alter Text), nachher 12 von 12 grün; 13 betroffene Testdateien (123 Tests) grün; `npm run verify:code` grün.
- `npm run verify:full CR-GC-923`: Auswahl 58/233, rot 1, Schlupf 1 (nur Graph): `tests/distribution.test.ts` (`npm pack` schlug fehl). Einzeln wiederholt: 13 von 13 grün. Der Lauf fand bei Last 112 statt, parallel lief `verify:full CR-GC-913`; Ursache der Pack-Störung nicht nachgewiesen. Der erste Volllauf hing und wurde abgebrochen.
- Modellvorschlag (nicht angewandt): Beschreibung von `FUNC-se-plan` auf „nur Reihenfolge und Schnitt" kürzen; Kante `FUNC-se-plan` → se-cdr/se-bau nicht vorhanden geprüft.

## Befund

se-plan (Version 11, 88 Zeilen) erledigt drei Aufgaben:

| Abschnitt | Tätigkeit | Gehört zu |
|---|---|---|
| §2 | offene Fragen stellen, Antwort als REQ schreiben | Spezifikation |
| §3 | fehlende REQ und TEST schreiben | Spezifikation |
| §4 Stufe 1 | SCHEMA als erste Baustufe | Spezifikation (Bedingung „baureif" in CR-GC-922) |
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
- Die Abdeckung `reqCoverage` aus `deriveImplPlan` bleibt gleich.
- Tests zum Skill-Text vorher rot, nachher grün.

## Dateien (4)

`.claude/commands/se-plan.md`, `.claude/commands/se-conops.md`, `tests/se-plan.groups.test.ts` (liest den Skill-Text), `tests/se-plan.ordering.test.ts`. `src/loop/se-plan.ts` leitet keine Stufe für SCHEMA ab (geprüft 2026-11-13) und bleibt unverändert.

## Abhängig von

CR-GC-922 (se-cdr), CR-GC-924.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1126, Tiefe 1, Wurzeln: `FUNC-se-plan`, `FUNC-se-conops`._

Reichweite: 4 Elemente (FLOW 1, FUNC 3); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 2):
- .claude/commands/se-conops.md
- .claude/commands/se-plan.md

Tests (`graph_tests`, 5):
- tests/se-plan.groups.test.ts
- tests/sitzung-kpi.test.ts
- tests/skill-authoring-gate.test.ts
- tests/skill-zugangsliste.test.ts
- tests/task-analysen.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
