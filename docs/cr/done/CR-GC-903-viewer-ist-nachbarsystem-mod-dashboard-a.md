# CR-GC-903: Viewer ist Nachbarsystem: MOD-dashboard aus dem System nehmen, fuenf Anforderungen neu zuordnen

**Status:** ✅ Done (2026-11-12)
**Abgeschlossen:** 2026-11-12
**Typ:** aus Item ITEM-2026-1283 (finding)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1283.json (Lane: graph)

---

**Bezug:** Spike `docs/archive/spikes/SPIKE-GC-regeln-aus-definitionen-RESULTS.md`, Rang 3. Definition
Akteur im Artefakt „Das Systemmodell in Bildern", Abschnitt 6: wer von außen etwas über die Grenze gibt
oder bekommt. Ein Nachbarsystem darf Akteur sein, ein Teil des Systems nicht.

## Befund

Der Viewer `@sigloch/graph-view-edit` steht zweimal im Modell: als `ACTOR-dashboard` außen und als
`MOD-dashboard` innen, unter `SYS-graphcode`. Das Modul ist laut eigener Beschreibung ein Nachbarsystem,
trägt `external: true` und hat keine Funktion. R-23 meldet es deshalb heute. Die Leitplanke in
`CLAUDE.md` sagt dasselbe: graphcode ist kein Viewer. Der Viewer ist damit Akteur, kein Modul.

## Zielbild

1. `MOD-dashboard` entfällt mit seiner compose-Kante von `SYS-graphcode`.
2. `ACTOR-dashboard` bleibt der einzige Ort des Viewers im Modell. Seine sechs Flüsse bleiben.
3. Die fünf Güte-Anforderungen, die heute nur `MOD-dashboard` erfüllt, bekommen einen Träger auf der
   graphcode-Seite der Grenze:

| Anforderung | Inhalt | Vorschlag Träger | Begründung |
|---|---|---|---|
| `REQ-dashboard-readonly` | Viewer ohne Schreibpfad | `MOD-surface` | Die Host-Bridge ist die einzige Tür. Ob der Viewer schreiben darf, entscheidet CR-GC-808 |
| `REQ-readiness-transparent` | Jede Stufe nennt ihre blockierenden Elemente | `MOD-kernel-measure` | Dort wird Readiness gerechnet |
| `REQ-dashboard-ontology-sync` | Readiness rechnet mit Ontologie und Regeln aus contracts | `MOD-kernel-measure` | Dort wird Readiness gerechnet |
| `REQ-artifact-freshness` | Ampel grün, gelb, rot je Dokument | `MOD-projections` | Die Projektion leitet Dokumente ab |
| `REQ-shared-views-no-fork` | Eine Sichtenberechnung, kein Regelfork | `MOD-projections` | Die Projektion trägt die Sichten |

Den Vorschlag je Zeile bei Lane-Start mit `graph_context` prüfen. Eine Anforderung, die nur den Viewer
selbst betrifft, gehört nach graph-view-edit und entfällt hier.

4. Die relation-Kanten von CR-GC-115 und CR-GC-125 auf `MOD-dashboard` entfallen. Beide CRs sind
   abgeschlossen. Hat einer danach keine relation-Kante mehr, bekommt er eine auf `ACTOR-dashboard`,
   falls das Muster es zulässt, sonst auf die neu zugeordnete Anforderung.

## Akzeptanz

- [x] `graph_elements({type:'MOD'})` nennt kein `MOD-dashboard`, R-23 meldet nichts mehr.
- [x] Die fünf Anforderungen haben je einen Erfüller, RD-01 meldet keine von ihnen.
- [x] `rules_evaluate` meldet keinen neuen Fehler gegenüber dem Stand vor dem CR.
- [x] `tests/hooks.inject-graph-slice.test.ts` erwartet für CR-GC-115 kein `MOD-dashboard` mehr und ist grün.
- [x] Kommentare in `src/README.md`, `src/index.ts`, `src/projections/panels.ts`,
      `src/projections/help-content.ts` nennen den Viewer als Nachbarsystem, nicht als Modul.
- [x] Modell und Sichten re-exportiert und mit dem CR committet.

## Nicht Ziel

- Keine Änderung an Code-Logik. Die Panel-Datenschicht liegt schon in `@sigloch/graphcode-client`.
- Keine Regel „Akteur gleicht keinem Modul". Sie ist ein Kandidat für contracts, eigenes Item.
- Die Anwendungsfälle aus Kundensicht sind CR-GC-806, 807 und 881.


---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

Modell: `MOD-dashboard`, `SYS-graphcode`, die fünf Anforderungen oben, `MOD-surface`,
`MOD-kernel-measure`, `MOD-projections`, CR-GC-115, CR-GC-125. Dateien: die fünf aus der Akzeptanz plus
`docs/graph/graphcode.graph.json` und `docs/views/`. Über `/se-umbau`: `graph_impact` vor dem Löschzug.

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

---

## Ergebnis (2026-11-12)

- Modell v1094: `MOD-dashboard` mit compose-, satisfy- und drei relation-Kanten gelöscht. Träger wie
  vorgeschlagen: `MOD-surface` → readonly; `MOD-kernel-measure` → readiness-transparent,
  ontology-sync; `MOD-projections` → artifact-freshness, shared-views-no-fork.
- Abweichung Punkt 4: CR → ACTOR verbietet R-18. Ersatz entfällt, denn CR-GC-115 und CR-GC-125
  behalten weitere relation-Kanten (REQ, MS-4-mvp2, MOD-surface).
- R-23 meldet nichts, RD-01 nennt keine der fünf Anforderungen, `rules_evaluate` ohne Fehler.
- Folge in der Testauswahl: `MOD-projections` zieht jetzt `tests/panels.test.ts`. Der Test
  `mcp.tests-operational` (e) nahm Panels als fremdes Subsystem an; er prüft jetzt die Aufnahme und
  nimmt `skill-red-first.test.ts` als fremde Datei.
- `verify:full CR-GC-903`: 214/214 Dateien grün, Schlupf 0. Commit aa87cd61.
