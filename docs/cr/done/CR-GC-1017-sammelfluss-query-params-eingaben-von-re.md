# CR-GC-1017: Sammelfluss query-params: Eingaben von reseed und audit ohne eigenen Vertrag

**Typ:** aus Item ITEM-2026-1621 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1621.json (Lane: code)

---

## Befund

Fortsetzung von CR-GC-1014 bis CR-GC-1016. `FLOW-query-request-agent` führt noch zu graph_reseed, audit_trail und audit_stats, mit `SCHEMA-query-params`. Danach hat der Sammelfluss kein Ziel mehr.

Dazu kommt ein Nachtrag zu CR-GC-1013: Seit `SCHEMA-skill-text` an `SkillMetaSchema` gebunden ist, meldet RC-04 dieses SCHEMA. Seine 28 Flüsse führen von den Skill-Dateien (Markdown) zur Ablaufsteuerung im Agent-Host. Keine Code-Funktion auf ihnen kann parsen. graphcode parst den Kopf in `parseSkillFrontmatter` beim Ausliefern, und das liegt nicht auf diesen Flüssen. RC-04 ist nicht abnehmbar.

## Zug

1. `GraphReseedInputSchema` wird exportiert. Die Handler von graph_reseed, audit_trail und audit_stats parsen ihre Eingabe selbst.
2. Modell: `FLOW-reseed-call`, `FLOW-audit-trail-call` und `FLOW-audit-stats-call` von `FUNC-agent-loop`, je mit eigenem SCHEMA. `FLOW-query-request-agent` wird gelöscht.
3. Je SCHEMA ein erzeugter Vertragstest. Der Probelauf-Test ist neu gemessen.
4. `SCHEMA-skill-text`: Die Beschreibung nennt den Grund, warum RC-04 stehen bleibt (FAQ `befund-stehen-lassen`).

## Folge für die Kennzahlen

Der Steuerwert geht von 13,00 auf 13,50. Im Probelauf hängt der Optimierer neun Elemente um statt vier, und keines davon ist fachlich begründet (ITEM-2026-798).

## Abnahme

- R-32 nennt keines der drei neuen SCHEMA.
- `FLOW-query-request-agent` existiert nicht mehr.
- Die Vertragstests sind grün. Die Gegenprobe ohne `positive` an `limit` von audit_trail macht 1 Fall rot.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1568, Tiefe 1, Wurzeln: `FLOW-query-request-agent`._

Reichweite: 2 Elemente (FLOW 1, FUNC 1); Blackbox-Rand 51, nicht geoeffnet.

Dateien (realRef, 0):
- (keine)

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
