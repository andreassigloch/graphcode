# CR-GC-882: Skill customer-page: Seite für Kunden und Chef aus dem Modell erzeugen, auf Anfrage, mit Drift-Prüfung ohne Rendern

**Status:** ⛔ Verworfen (2026-11-01)
**Grund:** Folge von CR-GVE-386 (verworfen). Für ein einmaliges Dokument lohnt sich dieses Werkzeug nicht; die KI schreibt die Seite direkt. Der Text bleibt als Konzept erhalten.
**Typ:** aus Item ITEM-2026-1143 (idea)
**Erstellt:** 2026-10-31
**Item:** bok/items/ITEM-2026-1143.json (Lane: graph)

---

## Befund

Für das Systemmodell immo-infra entstand von Hand eine Seite für Leute ohne Vorwissen, Kunden und Chef.
Die Abläufe standen im Skript der Seite. Bei der ersten Prüfung wichen drei Schritte vom Modell ab, und
sechs Ketten fehlten. Die Rechnung liefert CR-GVE-386. Dieser CR liefert das Werkzeug, das jedes
Repo mit graphcode bekommt.

## Entscheidung des Autors (2026-10-31)

- Die Seite ist ein Dokument, das eine Skill auf Anfrage erzeugt. Sie ist keine GVE-View.
- Das Werkzeug gehört zu graphcode, nicht ins App-Repo. Das App-Repo installiert nichts zusätzlich.
- Kein Rendern nach jedem Commit und kein Eintrag im Auto-Export: Sonst liefe das LLM bei jeder Mutation.

## Zielbild

- **Skill `se:customer-page`** in `.claude/commands/se/`. Die Scaffold verteilt sie wie die anderen se-Skills.
- **Kommandozeile `graphcode customer-page`:** Sie ruft die Befehle aus CR-GVE-386 über `resolveGveEntry`
  (`src/surface/gve.ts`) auf. So gilt die gve-Version aus dem Abhängigkeitsbaum von graphcode.
- **Ablauf der Skill:**
  1. `graphcode customer-page --steps` liefert die Schritte als JSON.
  2. Die Skill formuliert fehlende Sätze aus den FLOW- und FUNC-Beschreibungen, einfach und ohne Fachwörter.
  3. Der Autor korrigiert in `docs/customer-page/texts.json`. Bestehende Sätze bleiben beim nächsten Lauf stehen.
  4. `graphcode customer-page` schreibt `docs/customer-page/index.html`.
- **Drift:** `graphcode customer-page --check` rechnet die Schritte und vergleicht ihre Prüfsumme je Kette
  mit `texts.json`. Es rendert nicht, ruft kein LLM und nennt die geänderten Ketten.
- **Eigener Ordner:** `docs/customer-page/` statt `docs/views/`, damit der Exporter die Dateien nie anfasst.

Kein Widerspruch zu CR-GC-876: Dort fällt der zweite Pfad zum Exporter weg. Für diese Seite gibt es
keinen Renderer im Exporter, und ihr Text braucht das LLM.

## Abhängigkeiten

- CR-GVE-386 muss als gve-Release vorliegen. Die Untergrenze von `@sigloch/graph-view-edit` in
  `package.json` steigt auf diese Version.
- `graphcode`-Repo: CR-Knoten fehlt, `aise dispatch prepare` fand keinen Host. Den Knoten beim ersten
  Modell-Zug nachziehen.

## Abnahme

- In einem Repo ohne eigene gve-Installation laufen `--steps`, `--check` und die Ausgabe der Seite.
- Am Modell immo-infra: Die Skill erzeugt `docs/customer-page/index.html` mit der graphVersion des Stands.
- Ein zweiter Lauf überschreibt keine Korrektur aus `texts.json`.
- `--check` nennt nach einer Änderung an einer Kette genau diese Kette und ändert keine Datei.
- `--check` läuft ohne LLM. Eine Kette ohne Änderung meldet nichts.
- Fehlt die nötige gve-Version, bricht der Befehl mit Exit 1 und nennt sie.
- `help-content.ts` und README nennen die Skill.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
