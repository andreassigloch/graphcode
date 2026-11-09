# CR-GC-897: Sitzungsbeginn: Einstieg über CR und graph_context statt ganzes Modell

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1273 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1273.json (Lane: code)

---

Befund aus immo-infra, gemessen an 8 Sitzungsprotokollen 2026-10-23..11-09: Eine neue Sitzung startet mit 51 k Token (Systemprompt, CLAUDE.md, Werkzeuge) und braucht dann 22..78 Züge bis zur ersten Änderung. Danach liegt ihr Kontext bei 140..296 k, also so hoch wie in einer alten Sitzung. Bis zur ersten Änderung kostete das 2,2..11,9 M Token. Eine Hauptsitzung lief 11 Tage, wurde rund 12-mal zusammengefasst und kostete im Schnitt 203 k Token je Zug.

Was die Sitzung in dieser Zeit tut (wiederholt sich in jeder Sitzung):
- sucht die Governance-Dateien (`find / -maxdepth 6 … ITEM-UND-CR.md`), weil CLAUDE.md `bok/docs/governance/…` ohne absoluten Pfad nennt;
- liest `docs/graph/*.graph.json` roh mit node/python und entdeckt dabei jedes Mal die Struktur `elements`/`traces` neu;
- lädt das ganze Modell per graph_elements (UC, ACTOR, MOD, FUNC bis 200, FCHAIN, alle io- und allocate-Kanten);
- lädt graphcode-Werkzeuge in 5..7 einzelnen ToolSearch-Aufrufen, liest `aise --help`;
- liest veraltete Prosa-Dateien des Projekts.

## Änderung
1. GRAPHCODE.md-Vorlage (`src/surface/scaffold-templates.ts`): Abschnitt „Sitzung beginnen“ — eine Sitzung = ein CR oder eine Gruppe unabhängiger CRs; Einstieg über die CR-Datei und `graph_context` ihrer Träger, nie über graph_elements des ganzen Modells; `graph.json` nie roh lesen; alle Leser in einem ToolSearch laden; neue Sitzung nach jedem Meilenstein oder ab rund 150 k Token Kontext. Spec-Arbeit und Nebenthemen in eigene Sitzungen.
2. Scaffold schreibt den absoluten Pfad der Familien-Governance (aus family.json/bok) in den Verweis der CLAUDE.md bzw. GRAPHCODE.md.
3. se-retro: neue Kennzahl „Einstieg“ — Züge, Kontext und Token bis zur ersten Änderung je Sitzung, und Kontext je Zug im Schnitt.

## Akzeptanzkriterien
- Vorlage enthält den Abschnitt; Scaffold-Test prüft ihn und den absoluten Pfad.
- se-retro meldet die Kennzahl „Einstieg“ für immo-infra (Vergleich: heute 22..78 Züge, Ziel unter 10 Zügen und unter 100 k Kontext bei der ersten Änderung).

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** kein Host in /Users/andreas/Developer/dev/graphcode (keine host.sock).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
