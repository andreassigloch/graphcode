# CR-GC-878: se-view-Verweise in Skill-Texten und Quell-Kommentaren nachziehen (Folge von CR-GC-876)

**Status:** ✅ Done
**Abgeschlossen:** 2026-11-11
**Typ:** aus Item ITEM-2026-1115 (finding)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1115.json (Lane: graph)

---

## Befund

Nach CR-GC-876 nannten 6 ausgelieferte Skills (se-fmea, se-conops, se-irr, se-plan, se:author-uc, se:top-level)
und 6 Quell-Kommentare noch die entfernten Befehle `se-view:*`.

## Ergebnis (2026-11-11, Commit 3a860118 zusammen mit CR-GC-879)

- Jeder Verweis nennt jetzt die Sicht `docs/views/<name>.md`; die `version:` der 6 Skills steigt um 1.
- Neuer Test in `tests/cli.scaffold.test.ts`: kein Skill des Pakets nennt einen `se:`- oder `se-x:`-Befehl, den
  das Paket nicht ausliefert. Rot gegen den alten Stand (10 Funde), grün danach.
- Bleibt: die Ausnahme `R-04` in `tests/skill-rule-ids.test.ts` (Hilfetext in contracts, CR-GC-876).
- Modell: `CR-GC-878 -relation->` die 6 Skill-FUNCs.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
