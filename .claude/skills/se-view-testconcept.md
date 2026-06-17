---
name: se-view:testconcept
description: Show test concept structure and coverage status
---

Read `docs/project/test-concept.md` and present a structured summary:

## 1. Testpyramide

Show the test distribution: Unit (70%) / Integration (20%) / E2E (10%) with current counts.

## 2. Testmatrix nach Phase

For each phase (1-7):
- List test objects with Testebene + Testfokus
- Highlight tests with TC-Nummern (TC.028-TC.043)
- Show Validation criteria per milestone

## 3. VCRM: Integrationstests pro Meilenstein

For each milestone IT-M0 to IT-M8:
- Testdatei(en)
- Testfokus (Stichpunkte)
- Verifizierte RQs
- Verbindungsmatrix-Zeile

This is the **Single Source of Truth** for milestone verification criteria.

## 4. Abdeckung

Summarize coverage tables:
- FN → Tests (7.1)
- FL → Tests (7.2)
- UC → CVE (7.3)
- SC → Tests (7.4)
- FMEA RQs (7.5)
- Config/Rollen/Init RQs (7.6)

Highlight gaps (elements without test coverage).

## 5. CVE (Customer View Evaluation)

List all CVE-001 to CVE-007 with UC, Testdatei, Requirements.

## 6. Impact-Matrix (Aenderungsstrategie)

Show the mapping: Geaenderte Datei → Unit → Integration → E2E.

## Dokumentaufbau (normativ)

Der test-concept.md hat folgenden Aufbau:

| Sektion | Inhalt | Normativ? |
|---------|--------|-----------|
| 1. Testebenen + Pyramide | Unit/IT/E2E/Validation Definitionen + Verteilung | Ja |
| 2. Testmatrix nach Phase | Testobjekte pro Phase mit Testebene + Fokus | Ja |
| 3. IT pro Meilenstein (VCRM) | Integrationstests mit Testdatei + RQ-Zuordnung | Ja (Single Source of Truth fuer Verifikation) |
| 4. FMEA-Tests | Safety-Tests zu RQ.024-RQ.029 | Ja |
| 5. Testdaten | Referenzdatensaetze | Ja |
| 6. Testinfrastruktur | Tools + Verzeichnisstruktur | Ja |
| 7. Abdeckungscheck | FN/FL/UC/SC/FMEA/Config → Tests | Ja (Vollstaendigkeitspruefung) |
| 8. CVE (E2E) | UC-basierte Playwright-Tests mit Schrittbeschreibung | Ja |
| 9. Aenderungsstrategie | Impact-Matrix: Quellpfad → betroffene Tests | Ja |
| 10. Luecken | Offene Punkte + Status | Ja |

**Regeln:**
- Sektion 3 (IT pro Meilenstein) ist die EINZIGE Stelle fuer Meilenstein-Verifikationskriterien
- implementation-plan.md verweist hierher, definiert keine eigenen Kriterien
- Jeder neue Meilenstein braucht einen IT-Block in Sektion 3 + Zeile in Verbindungsmatrix
- Jeder IT-Block muss mindestens ein RQ verifizieren
- Neue RQs muessen in Sektion 7 (Abdeckungscheck) eingetragen werden
- CVE-Tests in Sektion 8 korrespondieren 1:1 mit UC-Schritten aus der Spezifikation
- Impact-Matrix (Sektion 9) muss bei neuen Quellpfaden aktualisiert werden
