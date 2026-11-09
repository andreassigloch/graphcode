# CR-GC-881: UC- und FCHAIN-Namen benennen das Bedürfnis, nicht die Umsetzung: Regel oder Skill

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1128 (idea)
**Erstellt:** 2026-10-31
**Item:** bok/items/ITEM-2026-1128.json (Lane: code)

---

Anlass (Andreas 2026-10-31, aus CR-GVE-386): Die Kundenansicht zeigt UC- und FCHAIN-Namen als Reiter und Schritte. Diese Ebene ist die Ebene der Needs: was der Kunde will. Dort ist es Pflicht, die Namen am Bedürfnis auszurichten, nicht an der Umsetzung.

Befund heute: se:author-uc regelt nur die Beschreibung eines UC (≤25 Wörter, keine Modulnamen, kein „via X“), nicht den Namen. Für FCHAIN-Namen gibt es keine Vorgabe.

Belege aus immo-infra (graphVersion 91), UC → FCHAIN:
- KI-Inhalt ins Ziel → KI-Inhalt ins Ziel: benennt den Weg, nicht das Bedürfnis (z. B. Beitrag veröffentlichen).
- Geplanter Lauf → Geplanter Lauf: benennt den Mechanismus; das Bedürfnis ist z. B. Wochenbericht erhalten.
- Skills bereitstellen → Zugang und Rollen verwalten: UC und Kette nennen verschiedene Dinge.
- Gute Beispiele: Lagebeschreibung erstellen → Lagebeschreibung; Daten abfragen; Berichte lesen.

Vorschlag:
1. Skill: se:author-uc und die Kettenbildung (se:top-level) verlangen einen Namen der Form Verb + Objekt aus Sicht des Akteurs, ohne Namen von MOD, FUNC, SCHEMA oder Technik (KI, MCP, Gate, Lauf, Ziel).
2. Regel (Warnung): UC- und FCHAIN-Name enthält keinen Namen eines MOD oder SCHEMA des Modells und keinen Begriff aus einer Liste technischer Wörter; FCHAIN-Name gehört zu einem UC-Namen (gleiches Verb oder gleiches Objekt).

Offen: nur Skill, nur Regel oder beides; wo die Liste technischer Wörter liegt (je Repo oder Familie).

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
