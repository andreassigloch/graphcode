# CR-GC-1013: SCHEMA-skill-text ohne Zod-Schema und Vertragstest (R-32)

**Typ:** aus Item ITEM-2026-1617 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1617.json (Lane: code)

---

## Befund

`SCHEMA-skill-text` (29 Skill-Flüsse) hat kein Zod-Schema und keinen Vertragstest (R-32). Es steht als `external`, weil der Agent-Host das Format der Skill-Datei festlegt.
graphcode liest aber selbst einen Teil davon: `parseSkillFrontmatter` liest `name`, `description` und `version` aus dem Kopf jeder Skill-Datei. Danach verteilt `syncSkills` die Skills, und ein Entwurf (`version: 0`) wird nicht ausgeliefert.
Der Typ `SkillMeta` war ein TS-Typ ohne Schema.

## Zug

1. `SkillMetaSchema` (`z.strictObject`, `version` ganzzahlig ≥ 0) in `src/surface/scaffold-templates.ts`. `SkillMeta` ist daraus abgeleitet.
2. `parseSkillFrontmatter` parst sein Ergebnis mit `SkillMetaSchema` (der Erzeuger parst den Vertrag).
3. Modell: `SCHEMA-skill-text` bekommt die realRef auf `SkillMetaSchema`. `external` entfällt, weil die Bindung jetzt im eigenen Code liegt. Die Beschreibung nennt, dass der Vertrag nur den Kopf festlegt.
4. Vertragstest mit `graphcode vertragstest SCHEMA-skill-text`, TEST-Knoten `TEST-vertrag-skill-text`.
5. Beifang aus derselben Durchsicht: `SCHEMA-steering-channel` behält R-26 und R-32 nach Entscheidung des Autors. Die Beschreibung nennt jetzt den Grund für beide Befunde. Das wirkungslose `concept` entfällt (FAQ `befund-stehen-lassen`).

## Abnahme

- R-26 und R-32 nennen `SCHEMA-skill-text` nicht mehr.
- Der Vertragstest ist grün. Eine Gegenprobe macht ihn rot.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1547, Tiefe 1, Wurzeln: `SCHEMA-skill-text`._

Reichweite: 28 Elemente (FLOW 28); Blackbox-Rand 28, nicht geoeffnet.

Dateien (realRef, 0):
- (keine)

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
