# CR-GC-653: Executor: Nachfrage-Ausloeser im Prompt abstellen (Duplikat-Vorpruefung, SCHEMA-Abfrage im Skill, SYS-Wiederlesen)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-553 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-553.json (Lane: code)

---

Gemessen 2026-09-24 mit Argument-Trace (gcrun-40..42, 416 Lese-Aufrufe, keiner Fehler oder gekappt): das Modell fragt aus drei Gewohnheiten nach, die der Prompt erzeugt. (1) ~90 Stichwortsuchen vor dem Anlegen, fast alle leer — Duplikat-Vorpruefung, ausgeloest durch 'keine Duplikate anlegen'; dieselbe Pruefung macht der Treiber beim Einreichen (duplicateHits, CR-GC-287). (2) 22x graph_elements {type:SCHEMA}, 22/22 leer — der injizierte Skill author-uc verlangt die Abfrage woertlich (Jargon-Regel). (3) graph_get_node 127x, SYS 17x — die Intention steht schon im Auftrag; dazu eben selbst angelegte Knoten. Abnahme: Lese-Aufrufe je Lauf unter 106 (Stand nach CR-GC-650/651), Elemente nicht schlechter.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
