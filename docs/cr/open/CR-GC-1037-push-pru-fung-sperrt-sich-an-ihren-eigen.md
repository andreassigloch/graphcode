# CR-GC-1037: Push-Prüfung sperrt sich an ihren eigenen Test-Beispielwerten

**Typ:** aus Item ITEM-2026-1712 (bug)
**Erstellt:** 2026-11-26
**Item:** bok/items/ITEM-2026-1712.json (Lane: code)

---

tests/push-pruefung.test.ts trug erfundene PII-Beispiele wörtlich; die Prüfung liest jeden ungepushten Commit und sperrte den Push. Fix: Werte zur Laufzeit bauen, die fünf Werte der älteren Commits ausdrücklich in erlaubteTreffer, der Test leert die Liste in seiner Kopie.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Wie trägt ein Test Beispielwerte für personenbezogene Daten, ohne dass die Push-Prüfung ihn sperrt? | Er baut sie zur Laufzeit aus Teilen; wörtlich stehen sie nie im Quelltext. Ein Test, der die echte Config nutzt, leert in seiner Kopie `erlaubteTreffer`. | Eine Ausnahme in der Config würde sonst die Abbruch-Fälle des Tests selbst durchlassen. |

---

## Root Cause

`tests/push-pruefung.test.ts` (CR-GC-1031, CR-GC-1035) trug erfundene Beispielwerte wörtlich: E-Mail, Straße, Telefon, IBAN. Die Kalibrierung lief vor dem Test über den Bestand, deshalb fiel es nicht auf. Ein Trockenlauf der Prüfung über die 43 ungepushten Commits meldete 5 Treffer, alle in dieser Datei.

## Zug

- `tests/push-pruefung.test.ts`: Beispielwerte entstehen zur Laufzeit; das Wegwerf-Repo bekommt die Config mit leerem `erlaubteTreffer`.
- `scripts/push-pruefung.config.json`: die fünf erfundenen Werte aus den älteren Commits stehen ausdrücklich in `erlaubteTreffer`. Die ungepushte History bleibt unverändert, weil sie Commits einer parallelen Sitzung enthält.

## Nachweis

- Prüfung über die Testdatei selbst: 0 Treffer. Test 12/12 grün.
- Trockenlauf `refs/heads/master HEAD … origin/master` durch `scripts/push-pruefung.mjs origin`: Exit 0, keine Befunde.
