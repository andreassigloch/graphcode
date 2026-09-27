# CR-GC-695: computePhaseReadiness: nicht anwendbare Regel nicht als erfuellt zaehlen (ruleApplies, CR-SM-372) + Nachzuege FC-05/R-16

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-609 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-609.json (Lane: code)

---

Aus CR-SM-343/372 (SM a163f7a, 2026-09-27): contracts/se-engine lassen eine Regel, deren Vorbedingung nicht erfuellt ist, aus dem Nenner (ruleApplies/RULE_PRECONDITION; CR-R05 ohne CR-Knoten = nicht ausgewertet). graphcode computePhaseReadiness zaehlt eine Regel ohne Befunde als erfuellt - CR-R05 liest dort auf einem Graphen ohne CRs als bestanden. Auf ruleApplies umstellen (nach contracts-Publish, Peer-Floor heben). Dazu Nachzuege nach dem Publish: Kennzahlen-Spike liest FC-05-Befund als nicht bewertbar; se:author-actor-Hinweis auf den kaputten R-16-fix_hint entfernen (CR-SM-371 behebt ihn).

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
