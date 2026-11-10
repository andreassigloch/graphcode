# CR-GC-902: init prueft nicht, ob Claude Code oder OpenCode installiert ist; ohne Agent-Programm laufen die naechsten Schritte ins Leere

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1281 (finding)
**Erstellt:** 2026-11-10
**Item:** bok/items/ITEM-2026-1281.json (Lane: graph)

---

## Befund

`npx @sigloch/graphcode init` installiert und druckt die naechsten Schritte, ohne zu pruefen, ob ein
Agent-Programm da ist. Fehlen Claude Code und OpenCode, laufen Schritt 2 („Reload your agent host")
und Schritt 3 („Say this to your agent") ins Leere. Der Nutzer erfaehrt nicht, was ihm fehlt.
graphcode hat keine eigene Oberflaeche; ohne Agent-Programm ist es nicht nutzbar.

## Zielbild

- `init` sucht `claude` und `opencode` im PATH.
- Findet es eins, nennt die Ausgabe das gefundene Programm, und die Schritte bleiben wie bisher.
- Findet es keins, ersetzt die Ausgabe Schritt 2 und 3 durch einen Hinweis mit je einem
  Installationsbefehl. Sie nennt dazu die VS-Code-Erweiterung und die Desktop-App, die oft kein
  `claude` im PATH ablegen.
- Die Dateien schreibt `init` in beiden Faellen, der Exit-Code bleibt 0.
- `--json` traegt die gefundenen Programme als `agentHosts`.
- Die README nennt die Voraussetzung: ein Agent-Programm.

## Akzeptanz

- TEST-init-verb: mit keinem gefundenen Programm steht der Hinweis samt beiden Installationsbefehlen in
  der Ausgabe, „Reload your agent host" fehlt; mit gefundenem Programm wird es genannt.
- Smoke: `node dist/cli.js init` in einem Temp-Repo mit leerem PATH-Anteil fuer die Programme.

---

## Umfang laut Modell

- `FUNC-init-verb` (src/surface/init-verb.ts) — satisfy auf die neue `REQ-init-agent-host`.
- `TEST-init-verb` (tests/init-verb.test.ts) — verify auf die neue REQ.
- README.md — Voraussetzung.
- `graph_tests({changeSet:[FUNC-init-verb]})` gibt die Testspur.

## Ergebnis

- `executeInit` sucht `claude` und `opencode` im PATH und traegt die gefundenen als `agentHosts` im
  Bericht. `formatInit` nennt das gefundene Programm oder ersetzt Schritt 2 durch den Hinweis mit
  beiden Installationsbefehlen. Exit-Code 0 in beiden Faellen.
- README: Voraussetzung „an agent host" vor dem Installationsbefehl.
- Modell: `REQ-init-agent-host`, satisfy von `FUNC-init-verb`, verify von `TEST-init-verb`.
- TEST-init-verb: 7 Faelle, davon 2 neu.
- Smoke: `node dist/cli.js init` in einem Temp-Repo, einmal mit PATH ohne beide Programme (Hinweis,
  exit 0), einmal mit vollem PATH (found: Claude Code, OpenCode).
- verify:full: Spur CODE, Auswahl 57/212, rot 0, Schlupf 0 (volle Suite, 212 Testdateien).
- Commit: 1b4bb7f3.
