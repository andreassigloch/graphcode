# CR-GC-757: Stufe statt Dimension - Befunde zaehlen statt Prozent

**Status:** ✅ Done (2026-10-07)
**Typ:** aus Item (idea)
**Erstellt:** 2026-10-07

---

## Entscheidung des Autors (2026-10-07)

„Dimension & Stufen: 3. Die zeigen wir auch erstmal so an ( GVE ), später eventuell noch aggregiert" — Weg 3:
Stufe statt Dimension, Befunde zählen statt Prozent. Katalog: CR-SM-401 (`RULES_VERSION` 44, `countByStage`).

## Was gestrichen wird

- Die Dimension als zweite Einteilung der Regeln: `RULE_TO_DIMENSION`, die acht Prozentwerte mit Nenner und
  Kerntyp, „kein Urteil".
- Im Schritt: der Rang „schwächste Dimension" unterhalb der Stufe.
- Im Bericht `graph_readiness`: das Feld `dimension_readiness`.
- Die Vorlage `cr` („Lege CR-Knoten für die anstehenden Umbauten an") — den Bauplan schneidet `se-plan`.

## Was an ihre Stelle tritt

| Stelle | vorher | nachher |
|---|---|---|
| Snapshot | `report.scores` (Prozent je Dimension) | `stages` — Befunde je Stufe, aus `countByStage` |
| Schritt `readiness` | `{dimension, score, violations}` | `{stage, findings}`, nur Stufen mit Befund |
| Fokus-Schlüssel | `dimension:regel:elemente` | `stufe:regel:elemente` |
| `focusDimension` | Dimension oder `seed:*` | `focusStage` — Name der Stufe oder `seed:*` |
| Vorlage, Fokus-Typen, Skill | je Dimension | je Stufe (`GENERATION_TEMPLATE`, `STAGE_FOCUS_TYPES`, `SKILL_FOR_STAGE`) |
| Kandidatenwahl | Prozent-Zuwachs der Fokus-Dimension | weniger Befunde in der Fokus-Stufe (`steeringDelta.stages`) |
| Bericht | `dimension_readiness` | `stages` |

Zuordnung der acht Vorlagen: System, Anwendungsfall, Wirkkette ← uc · Anforderung ← req · Funktion, Datenfluss,
immer ← arch · Modul ← alloc · Schema ← schema · Test, Bindung ← ver · Plan ← ms. Abgleich hat keine Vorlage;
die Abgleich-Regeln (Profil `conformance`) stellen wie bisher kein Fenster.

## Verhaltensänderung

Eine Regel bekommt jetzt die Vorlage ihrer Stufe, nicht mehr die ihrer Dimension. Betroffen sind die Regeln, deren
Dimension über mehrere Stufen lief (z. B. AF-03: Dimension req, Stufe Modul). Regeln mit eigener Klausel (R-15,
UC-01, UC-02, FC-04, RD-01) sind nicht betroffen. Wirkung auf das lokale Modell: Rig-Lauf nach dem Release.

## Umfang

Über der 10-Dateien-Grenze: die Schnittstellenänderung lässt sich nicht teilen, ohne dass der Baum zwischen zwei
Aufträgen nicht baut. Quelltext 8 Dateien, dazu 16 Testdateien und das Skript der Regelmatrix.

## Abnahme

- `verify:full CR-GC-757` grün (im Link-Modus: `distribution`/`lockfile-sync` erwartet rot bis zum Publish).
- Kein Leser von `dimension`, `score`, `applicable`, `RULE_TO_DIMENSION` in `src/`.
