# CR-GC-950: Skill se:import-doc uebergibt skill im Aufruf von graph_mutate, nicht nur im Kommentar

**Typ:** aus Item ITEM-2026-1379 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1379.json (Lane: code)

---

**Status:** Umgesetzt 2026-11-15. Freigabe des Autors am selben Tag („import doc auch noch richten").

## Anlass

CR-GC-949 trug in 17 Skills den Satz ein, den Parameter `skill` an `graph_mutate` zu nennen. `se:import-doc`
zeigt den Aufruf als Code in einem Treiber-Skript. Dort stand der Satz als Kommentar, der Aufruf selbst übergab
`skill` nicht. Jeder Zug aus diesem Skill wäre unter `skill: null` („nicht erfasst") gezählt worden.

## Änderung

- `.claude/commands/se/import-doc.md`: der Aufruf übergibt `skill: "se:import-doc"`, der Kommentar entfällt,
  Version 3 → 4.
- `tests/skill-nennt-parameter.test.ts`: zweiter Fall. Zeigt ein Skill den Aufruf von `graph_mutate` als Code,
  muss die Zeile des Aufrufs `skill:` tragen.

- `tests/mutate-violations-leser.test.ts`: das Wegwerf-Repo trägt die Skill-Datei. Der Test ruft das Werkzeug
  mit den Argumenten des Skills; ohne die Datei lehnt es `skill: "se:import-doc"` als unbekannt ab. Der erste
  Volllauf dieses CRs war deshalb rot (Schlupf 1, die Folge ohne Schlupf steht wieder bei 0). Die Auswahl sah
  den Test nicht, weil eine Skill-Datei ihn nicht über das Modell erreicht.

## Abnahme

- [x] Der neue Testfall ist vor der Änderung rot und nennt `se/import-doc.md:144`; danach grün.
- [x] `npm run verify:full CR-GC-950` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

keine. Der CR setzt die Festlegung aus CR-GC-943 um.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1224, Tiefe 1, Wurzeln: `FUNC-import-doc`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se/import-doc.md

Tests (`graph_tests`, 2):
- tests/mutate-violations-leser.test.ts
- tests/skill-import-doc-modell.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
