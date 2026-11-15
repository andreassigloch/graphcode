# CR-GC-945: Drei Skill-Wortlaute an FAQ und Regel angleichen

**Typ:** aus Item ITEM-2026-1373 (finding)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1373.json (Lane: code)

---

Drei Wortlaute in ausgelieferten Skills weichen von FAQ und Regel ab: se-conops nennt drei Werteklassen statt vier (FAQ systemparameter), se/close-violations wendet ND-02 auf FLOWs an (ND-02 misst SCHEMA), se-laufzeit hebt die Ablage als sync hervor (FAQ sync-async-ablage).

---

## Entscheidungen

keine. Der CR wendet FAQ und Regel an.

---

## Umfang

Drei Skills, ein Test, zwei Test-Anpassungen (Versionsprüfung `>=` statt fester Zahl).

| Skill | Alt | Neu |
|---|---|---|
| `se-conops` (v9) | drei Werteklassen | vier, mit dem Aufrufwert (FAQ systemparameter) |
| `se/close-violations` (v7) | „same SCHEMA or similarity from 0.85" für FLOWs | „No rule measures the similarity of FLOWs: ND-01 measures FUNC, ND-02 measures SCHEMA." (Regelhilfe ND-01/ND-02) |
| `se-laufzeit` (v5) | „Der Abruf eines gehaltenen Zustands (Store, Ablage) ist `sync`." | „Ob der Abnehmer beim Aufruf wartet, entscheidet den Wert, nicht die Art des Glieds." (FAQ sync-async-ablage) |

Kopien der Skills unter `.opencode/` oder in Templates: keine (grep).

Offen, nicht Teil dieses CR: die FAQ `flows-zusammenlegen` nennt in der Antwort Nr. 1 und in Variante 2 noch „Ähnlichkeit ab 0,85 (Regel ND-02)" für FLOWs.

## Tests

`tests/skill-wortlaut-angleich.test.ts`, ein Test je Satz, vorher rot.
