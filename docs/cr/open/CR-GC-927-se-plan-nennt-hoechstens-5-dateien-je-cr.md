# CR-GC-927: se-plan nennt hoechstens 5 Dateien je CR, die Familienregel sagt 10 (Rest aus BOK-CR-067)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1049 (finding)
**Erstellt:** 2026-11-14
**Item:** bok/items/ITEM-2026-1049.json (Lane: code)

---

## Befund

Der Skill `.claude/commands/se-plan.md` schneidet nach 5 Dateien: Zeile 42 „grouped ≤5 files", Zeile 43
„split by REQ if >5 files". Die Familienregel nennt 10 Dateien je CR (globale Anweisungsdatei, seit
2026-09-23; FAQ `cr-dateigrenze-zahl`). Ein Agent, der dem Skill folgt, schneidet doppelt so viele CRs wie
verlangt.

Herkunft: einmaliger Scan der geschlossenen CRs in die FAQ (CR-AB-005, aise-bok), Abschnitt „Kandidaten für Vorschläge des Agenten". Vorschlag des Agenten, vom Auftraggeber nicht freigegeben. Das Item ITEM-2026-1049 besteht seit 2026-10-25.

## Vorschlag

Beide Stellen nennen 10. Die Grenze steht im Skill genau einmal. Die Skill-Version steigt, der
Konformanztest der Skills läuft.

## Abnahme

- [ ] `se-plan.md` nennt 10 an beiden Stellen, keine 5 mehr.
- [ ] Skill-Version erhöht; Konformanztest grün.
- [ ] Ausgelieferte Kopien (OpenCode, Vorlage für neue Repos) tragen denselben Stand.

## Offen für den Auftraggeber

Gilt für Verträge (Schritt 1 des Skills) dieselbe Grenze wie für alle CRs, oder bleibt dort die 5?

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

keine, bis der Auftraggeber über den Vorschlag entschieden hat.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
