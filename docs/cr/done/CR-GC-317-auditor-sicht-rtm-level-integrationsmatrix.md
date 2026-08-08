# CR-GC-317 — Auditor-Sicht: REQ-Levels und Integrationsabdeckung ohne Graph-Walk

**Status:** done · **Angelegt:** 2026-08-08 · **Abgeschlossen:** 2026-08-08 · **Max Files:** 3
**Herkunft:** Paket B aus `CR-GC-301` (A-SPICE-Nachschärfungen, draft). Das Original sagt
selbst „vor Implementierung splitten, Max-6-Dateien-Regel" — dies ist der Schnitt.
**Warum genau dieses Paket:** A und C brauchen Entscheidungen, die nicht meine sind
(A: contracts-Bump + Familie-Review; C: offene Option a/b/c). B braucht keine — es rendert
Evidenz, die im Graphen bereits liegt.

## Problem

Die A-SPICE-Coverage-Evaluation (2026-08-05) hat die Engineering-Prozesse als abgedeckt
bewertet, aber mit einem Vorbehalt: **die Evidenz liegt transitiv im Graphen.** Ein Assessor,
der die SYS.2-vs-SWE.1-Trennung sehen will, muss sie sich erlaufen:

- **REQ-Level** steckt im Compose-Anker — `SYS -compose-> REQ` ist eine Systemanforderung,
  `UC -compose-> REQ` eine funktionale, `REQ -compose-> REQ` eine abgeleitete. `docs/views/rtm.md`
  listet heute alle 96 REQ in einer flachen, nach uid sortierten Tabelle. Die Ebene ist da,
  sie ist nur nirgends ausgewiesen.
- **Integrationsabdeckung** einer FUNC↔FUNC-Verbindung steht am Ende der Kette
  `TEST -verify-> REQ <-satisfy- FCHAIN -compose-> FUNC`. Vier Hops für die Frage „welcher
  Test deckt diese Schnittstelle ab?".

GVE rendert versteckte Kettenglieder längst als „rolled-up"-Link. Die deterministischen Views
(CR-GC-220-Exporter) tun es nicht — und genau die sind das, was ein Assessor zu sehen bekommt.

## Architektur-Entscheidung

**Zwei bestehende Views ausbauen, keine neue.** Ein `se-view:aspice` wäre eine dritte Sicht auf
dieselben Kanten neben RTM und VCRM — ein Parallelpfad, der beim nächsten Ontologie-Bump
dreifach nachgezogen werden müsste.

- **REQ-Level → RTM.** Die Zeilen sind bereits REQ-gekeyed; die Ebene ist eine Spalte plus
  Gruppierung, kein neues Artefakt.
- **Integrationsmatrix → VCRM (`testmatrix`).** Ihre Zeilen sind verifikations-gekeyed; eine
  FUNC↔FUNC-Verbindung ist eine Verifikationsaussage, keine Anforderung. In die RTM gehört sie
  nicht — deren Zeilen sind REQs.

**Level-Ableitung aus der Graph-Position, nicht aus einem Attribut.** Dieselbe Entscheidung wie
CR-GC-240 für die Testpyramide, und aus demselben Grund: reale Knoten tragen das Attribut fast
nie, eine attributbasierte Klassifikation degeneriert zu „alles unassigned". Der Compose-Anker
ist immer da.

Ein REQ mit mehreren Ankern (SYS **und** UC) trägt beide Ebenen — Mehrfachzuordnung ist erlaubt
und wird ausgewiesen, nicht zu einer „gewinnenden" Ebene verkürzt.

## Scope (≤ 3 Dateien)

1. `src/views/helpers.ts` — `reqLevels(reqUid, idx, compose)` analog zu `levelsOfTest`;
   `rolledUpCoverage(graph)` liefert je FUNC↔FUNC-Verbindung die abdeckenden TESTs
2. `src/views/incose.ts` — `renderRtm` gruppiert nach Level; `renderTestMatrix` bekommt den
   Abschnitt „Integrationsabdeckung (rolled-up)"
3. `tests/views.auditor.test.ts` (neu)

## Akzeptanzkriterien

- [x] RTM weist je REQ die Ebene(n) aus: System (SYS-compose) · funktional (UC-compose) ·
      abgeleitet (REQ-compose) · unassigned
- [x] Ein REQ mit zwei Ankern zeigt beide Ebenen, keine wird stillschweigend gewählt
- [x] VCRM zeigt je FUNC→FLOW→FUNC-Verbindung die abdeckenden TESTs über die volle Kette,
      mit `testRef.level` und `testResult`
- [x] Eine Verbindung ohne abdeckenden Test rendert sichtbar als Lücke, nicht als leere Zelle
- [x] Render deterministisch: zweimaliges Rendern desselben Graphen ist byte-identisch, und
      das Umsortieren der Eingabeknoten ändert die Ausgabe nicht
- [x] Bestehende RTM/VCRM-Aussagen unverändert (Coverage-Zahlen, R-01-Lückenzählung)
- [x] `npm test && npm run build` grün

## Ergebnis am realen Graphen

> **KORRIGIERT durch `CR-GC-318` (2026-08-08).** Die ursprünglich hier stehende Zahl
> „69 REQ ohne Anker" war **falsch** — und die Behauptung „ein echter Befund, kein
> Renderfehler" war genau verkehrt herum. `reqLevels` las nur die `compose`-Kante, einen
> Hop weit; 67 der 68 gemeldeten REQ tragen ihre Zuordnung über `satisfy` von FUNC, MOD
> oder FCHAIN. Die Lücke lag im Reporter, nicht im Modell.
>
> Mit Pfadsuche über alle zuordnungstragenden Beine (CR-GC-318), 111 REQ:
> **19 System · 23 funktional · 30 Integration · 82 Komponente · 1 ohne Anker.**
> Mehrfachzuordnung erklärt die Summe > 111.

VCRM: 11 deklarierte FUNC↔FUNC-Verbindungen, alle abgedeckt. `testResult` ist durchgängig
leer — an keinem TEST-Knoten gepflegt. Genau die Lücke, die Paket A (SUP.9, `PR-01`) adressiert;
die Spalte macht sie jetzt sichtbar, statt sie zu verschweigen.

## Nachweis (Mutationsprobe auf beiden tragenden Behauptungen)

- `reqLevels` auf „erster Anker gewinnt" gedreht → der Doppelanker-Test wird rot. Ohne ihn
  träfe der Renderer eine stille Modellierungsentscheidung.
- Die `shared FCHAIN`-Bedingung in `rolledUpCoverage` entfernt → der Ko-Adjazenz-Test wird rot,
  `FUNC-c` taucht als erfundene Schnittstelle auf. Das ist exakt der R-21-Defekt aus CR-GC-315,
  hier im Renderer.

## Nicht in diesem CR

Paket A (R-21-Level-Check, PR-01 für SUP.9) und Paket C (SUP.10-Evidenz) bleiben in
`CR-GC-301`. A ist contracts + Familie-Review, C hat eine unentschiedene Option a/b/c.
