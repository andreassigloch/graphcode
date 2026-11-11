# CR-GC-881: UC- und FCHAIN-Namen benennen das Bedürfnis, nicht die Umsetzung: Regel oder Skill

**Status:** ✅ Done
**Abgeschlossen:** 2026-11-11
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

---

## Entscheidung (Auftraggeber 2026-11-11): beides, Skill und Regel

## Ergebnis

- **Skill** (graphcode, Commit 91cac602): `se:author-uc` Version 3, Abschnitt „The name states the need, not the
  solution" (Verb + Objekt aus Sicht des Akteurs, keine MOD-/FUNC-/SCHEMA-Namen, keine Technikwörter, falsche und
  richtige Beispiele aus immo-infra, dieselbe Regel für die Ketten des UC). `se:top-level` Version 10, Prüffrage 4.
  Test-Block in `tests/skill-top-level-ausloeser.test.ts`, 3 von 3 rot gegen den alten Text.
- **Regel** (sigloch-modules CR-SM-434, contracts 12.12.0, RULES_VERSION 50.0.0, unveröffentlicht): `UC-07` „Name states
  the need", Warnung an UC und FCHAIN, Wortliste in `MetricPolicy.needNameTerms` (Familienvorgabe KI, MCP, Gate, Lauf,
  Ziel; das Repo ersetzt sie). Verworfen nach Messung an 9 Modellen: „kein MOD-/SCHEMA-Name im Namen" (7 von 10 Treffern
  Fehlalarme) und „Kettenname gehört zum UC-Namen" (39 von 110 Paaren ohne gemeinsames Wort, meist gute Namen).
- Der Skill nennt `UC-07` noch nicht: graphcode läuft auf contracts 12.9. Nachziehen (Peer-Floor, `needNameTerms` ohne
  „Gate"/„Ziel", UC-07 im Skill) in ITEM-2026-1305, nach dem Publish von contracts.
- CR-Knoten fehlte im Graphen; per `graph_mutate` angelegt (v1074) mit `relation` auf FUNC-author-uc, FUNC-se-top-level.
- `verify:full CR-GC-864` (selber Stand): 1761 Tests grün.
