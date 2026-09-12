# CR-GC-516: contracts 22 nachziehen: moduleSize raus, R-04 steuert mit

**Status:** ✅ Done (2026-09-12)
**Typ:** aus Item ITEM-2026-067 (finding)
**Erstellt:** 2026-09-12
**Item:** bok/items/ITEM-2026-067.json (Lane: code)

---

Folge von CR-SM-312 (contracts RULES_VERSION 22.0.0): policy.moduleSize entfaellt ersatzlos, R-04 misst die Randbreite des Moduls gegen boundaryWidth und steht jetzt in STEER_RULES. UMSETZUNG: moduleSize aus graphcode.config.jsonc und den Config-Tests, Erwartungen an steerAdvisory.rules (vier -> fuenf Eintraege), Suite gruen. Erwartete Befundwirkung am eigenen Modell: R-04 an allen sechs MOD (Rand 7..17 gegen Schwelle 5), vorher 5 Befunde aus der Groessenfrage.


## Umsetzung

| Datei | Änderung |
|---|---|
| `graphcode.config.jsonc` | `moduleSize` entfernt; der Kommentarblock erklärt jetzt R-04 als Randbreite gegen `boundaryWidth` |
| `tests/config.test.ts` | `moduleSize` aus allen Config-Fixtures, hängende Kommata bereinigt |

Keine Änderung an `steerAdvisory`: graphcode reicht `STEER_RULES` aus se-engine durch (`fit-advisory.ts`), die Liste wächst dort von vier auf fünf Einträge.

## Verifikation

- Build und Type-Check grün; volle Suite 137 Dateien, 1092/1092; `config.test.ts` 11/11.
- Befundwirkung am eigenen Modell, aus der Baseline des Suite-Laufs: R-04 6 (alle Module, Rand 7 bis 17 gegen Schwelle 5), RD-04 5, BW-02 15. Vorher waren es 5 R-04-Befunde aus der Größenfrage.
- Ein laufender MCP-Host urteilt bis zum Neustart mit dem alten Regelkatalog.
