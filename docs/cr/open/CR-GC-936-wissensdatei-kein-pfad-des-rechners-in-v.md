# CR-GC-936: Wissensdatei: kein Pfad des Rechners in versionierter settings.json

**Typ:** aus Item ITEM-2026-1362 (bug)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1362.json (Lane: code)

---

## Befund

CR-GC-935 löst `knowledgeFile` beim `init` auf und schreibt den absoluten Pfad als Argument des Hooks in
`.claude/settings.json`. Die Datei ist versioniert. In einem öffentlichen Repo stünde damit der Pfad eines
Rechners samt Benutzername im Repo, und auf jedem anderen Rechner zeigt er ins Leere.

Freigabe des Autors am 2026-11-15.

## Auftrag

1. `.claude/settings.json` trägt den Pfad so, wie er in `graphcode.config.jsonc` steht (`~/…` bleibt `~/…`).
2. Der Hook `inject-knowledge.sh` löst `~` und einen relativen Pfad (gegen die Repo-Wurzel) zur Laufzeit auf.
3. `opencode.json` trägt weiter den absoluten Pfad: OpenCode löst `~` nicht auf (Probe in CR-GC-935).
4. Entfernen und Wechsel des Schlüssels arbeiten wie bisher.

## Abnahme

- [ ] Test zuerst rot: Nach `init` mit `knowledgeFile: "~/x/y.md"` enthält `.claude/settings.json` weder das
      Home-Verzeichnis noch einen anderen absoluten Pfad der Wissensdatei.
- [ ] Der Hook gibt mit `~/…` und mit relativem Pfad die Datei aus; echter Prozess, echte Datei.
- [ ] `upgrade` nach Wechsel und nach Entfernen des Schlüssels: alte Einbindung weg, auch die `instructions`-Zeile.
- [ ] `npm run verify:full CR-GC-936` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
