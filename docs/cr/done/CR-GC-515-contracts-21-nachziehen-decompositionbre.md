# CR-GC-515: contracts 21 nachziehen — decompositionBreadth.min und Regelzahl

**Status:** ✅ Done (2026-09-12)
**Typ:** aus Item ITEM-2026-065 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-065.json (Lane: code)
**Voraussetzung:** sigloch-modules CR-SM-311 (`RULES_VERSION` 21.0.0: RD-04 zählt eigene Funktionen, RD-05 neu, `decompositionBreadth.min` Pflicht)

---

## Befund

Mit CR-SM-311 hat `decompositionBreadth` das Pflichtfeld `min`. Ohne es verwirft das Schema die Repo-Config — der
Host liefe auf dem Default, statt mit der Policy des Repos zu urteilen. Der Katalog wächst um RD-05 (70 → 71), die
scorende Regelzahl der Artikel von 64 auf 65.

Eine Testfolge ist inhaltlich: das Fixture des Handoff-Tests in `generate.test.ts` hatte ein Modul mit einer
einzigen Funktion. RD-05 meldet das zu Recht als entartete Ebene (PDR fehlte RD-05). Der Test soll PDR aus
Modellinhalt erreichen — das Fixture trägt jetzt eine Bestellkette mit drei Funktionen im Modul, statt dass die
Regel nachgibt.

## Umsetzung

| Datei | Änderung |
|---|---|
| `graphcode.config.jsonc` | `decompositionBreadth: { min: 3, warning: 9 }` |
| `tests/config.test.ts` | alle Config-Fixtures mit `min` |
| `tests/steering.steer-causality.test.ts` | enges Budget `{ min: 1, warning: 2 }` — `min ≤ warning` ist Schema-Pflicht |
| `tests/claims.conformance.test.ts` | `engine rules=65` |
| `docs/articles/03, 04, 06` | „65 engine rules" |
| `tests/generate.test.ts` | Handoff-Fixture: drei Funktionen im Modul statt einer |

## Befundwirkung am eigenen Modell

Gegen contracts dist gemessen: RD-04 +5 an agent-surface (27), surface (24), kernel (20), loop (11), projections (10);
RD-05 0. Keine Modelländerung in diesem CR — die fünf Module sind Teilungskandidaten (Z3, Code wandert mit).

Ein laufender MCP-Host urteilt bis zum Neustart mit dem alten Regelkatalog.

## Verifikation

- Type-Check grün; volle Suite 137 Dateien, 1092/1092 gegen contracts 21 (Link-Modus).
- `generate.test.ts` 30/30: das Handoff-Fixture erreicht SRR und PDR vollständig, CDR bleibt wie beabsichtigt offen.
