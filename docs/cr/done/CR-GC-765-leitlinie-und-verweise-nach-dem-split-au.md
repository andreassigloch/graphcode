# CR-GC-765: Leitlinie und Verweise nach dem Split auf graphanalyze umstellen

**Status:** ✅ Done (2026-10-08)
**Typ:** aus Item ITEM-2026-791 (idea)
**Erstellt:** 2026-10-08
**Item:** bok/items/ITEM-2026-791.json (Lane: graph)

---

Zweiter CR des Splits (Entscheidung Autor 2026-10-08: zwei CRs). Nach CR-GC-764 zeigen Texte auf Verzeichnisse, die es in graphcode nicht mehr gibt. Nachziehen: docs/graphcode_leitlinie.md (26 Stellen: Messmethoden T-E3, T-E5, T-E9, T-E10, T-E11, T-M2, T-M5, T-V5 und die Abschnitte zum Rig) — die Testdefinitionen bleiben, die Messmethode verweist auf graphanalyze; README.md Zeile zum Messaufbau; CLAUDE.md, falls dort das Rig genannt ist; docs/messung/kennzahlen.md (Verweis auf benchmark.jsonl); beispielgraphen/README.md (Aufgabe sigllm-prosa, Referenzlaeufe, rig/runs); scripts/messung.mjs und stand.md (Text zu T-V1 nennt rig/moneyflow-struktur). Herkunftskommentare in src/ und tests/ bleiben, sie beschreiben Vergangenes. Die Leitlinie aendert nur der Autor: der CR legt den Wortlaut zur Abnahme vor.

---

## Umfang

Kein Modellknoten ändert sich: der Zug betrifft nur Texte. `SYS-graphcode` trägt den Verweis auf die Leitlinie,
nicht ihren Wortlaut. Vorbedingung: CR-GC-764 ist geschlossen.

| Datei | Stellen | Änderung |
|---|---|---|
| `docs/graphcode_leitlinie.md` | 26 | Messmethode je Test-ID verweist auf graphanalyze; Definition und Kriterium bleiben |
| `README.md` | 1 | Satz zum Messaufbau |
| `docs/messung/kennzahlen.md` | 2 | Verweis auf `benchmark.jsonl` |
| `beispielgraphen/README.md` | 5 | Aufgabe `sigllm-prosa`, Referenzläufe, `rig/runs` |
| `scripts/messung.mjs`, `docs/messung/stand.md` | 2 | Text zu T-V1 |
| `CLAUDE.md` | prüfen | nur falls das Rig genannt ist |

Sechs bis sieben Dateien. Die Leitlinie ändert nur der Autor: der Wortlaut wird vor dem Commit vorgelegt.

## Abnahme

- `git grep -nE "(rig|auswertung)/[a-z]"` trifft außerhalb von `docs/cr`, `docs/archive`, `docs/spikes` und
  `docs/articles` nur noch Herkunftskommentare.
- `npm run verify:model` grün.

## Ergebnis (2026-10-08)

Auftrag des Autors: „Leitlinie updaten" (Änderung delegiert, im Kopf der Leitlinie vermerkt).

- **Leitlinie** (58 Zeilen neu, 49 entfernt): Aufbau-Spalte in §9.3 für 16 Tests, §9.4 (Aufgaben und Referenzen,
  Standard-Set, Vergleiche) und §9.5 (Bestand). Fragen, Kriterien und Stände sind unverändert.
- **Mehr als der Split:** Die Leitlinie nannte noch Aufbauten, die CR-GC-740 gelöscht hat (Greenfield-Systemtest,
  Code-Test, Referenz-Change, Minimal-Whitebox-Arme, dummy-slicer, `turn-analyse`), und führte das Rig als „geplant".
  Das ist jetzt benannt: ohne Aufbau sind T-C1, T-C2, T-C3, T-E4, T-E5 und T-E9.
- **Weitere Dateien:** `README.md`, `docs/messung/kennzahlen.md`, `beispielgraphen/README.md` (zwei neue Zeilen für
  `todo-referenz`), `scripts/messung.mjs` (Text zu T-V1). `CLAUDE.md` nennt das Rig nicht.
- **Nicht geändert:** `docs/messung/stand.md` ist generiert und nennt den alten Text zu T-V1 bis zum nächsten
  `npm run messung`. Herkunftskommentare in `src/`, `tests/`, `scripts/` und im Skill `se-umbau` beschreiben
  Vergangenes und bleiben.
- **Modell:** eine Kante, `CR-GC-765 -relation-> REQ-benchmark-harness` (Graph-Version 643).
