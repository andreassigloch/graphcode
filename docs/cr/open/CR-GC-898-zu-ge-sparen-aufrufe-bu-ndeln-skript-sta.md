# CR-GC-898: Züge sparen: Aufrufe bündeln, Skript statt Kette, se-retro misst Einzelaufrufe

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1274 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1274.json (Lane: code)

---

Befund aus immo-infra, Hauptsitzung 2026-10-29..11-09: 1642 von 2174 Zügen mit Werkzeugen (76 %) enthalten genau einen Aufruf; sie tragen 330 M von 482 M Kontext-Token. Jeder Zug schickt den ganzen Kontext (Cache-Lesen zu 10 % des Eingabepreises; trotzdem rund 60 % der Kosten der Sitzung). Folgen von 3+ gleichen Einzelaufrufen (python3, grep, graph_mutate, ssh, Tests auf dem VPS) kosteten rund 150 Züge und 35 M Token. Rund 12 Fix-Commits für Skripte zum Ausrollen und Testen auf dem VPS (tar-Pfad, osm.sh, IPv4) waren Fehlversuche direkt auf der Zielumgebung.

Einordnung: Der größere Hebel ist die Kontextgröße (siehe CR zum Sitzungsbeginn). Dieser CR betrifft die Zahl der Züge.

## Änderung (GRAPHCODE.md-Vorlage `src/surface/scaffold-templates.ts`, se-retro)
1. Hausregel „Züge sparen“: unabhängige Lese- und Abfrageaufrufe im selben Zug absetzen; wiederkehrende Prüfungen (Tests auf der Zielumgebung, Abfragen über den Graph) als ein Skript mit kurzer Ausgabe statt einer Kette aus grep/sed/cat; Ausgaben begrenzen (`| tail -n 20`, gezielte Abfragen), weil alles im Kontext in jedem Folgezug mitgelesen wird.
2. Skripte zum Ausrollen erst gegen einen lokalen Trockenlauf prüfen, dann auf der Zielumgebung.
3. se-retro: Kennzahl „Einzelaufrufe“ — Anteil der Züge mit genau einem Werkzeugaufruf und Token in Folgen von 3+ gleichen Aufrufen.

## Akzeptanzkriterien
- Vorlage enthält die Hausregel; Scaffold-Test prüft sie.
- se-retro meldet die Kennzahl „Einzelaufrufe“ für immo-infra mit den Werten dieses Befunds als Ausgangswert.

---

## Umfang laut Modell

- `FUNC-harness-cli` (GRAPHCODE.md-Vorlage `src/surface/scaffold-docs.ts`), `FUNC-se-retro`
  (`.claude/commands/se-retro.md`, `scripts/retro-kpi.mjs`).
- `REQ-zuege-sparen` (neu, unter `UC-loop-closure`), verify durch `TEST-sitzung-kpi`.

## Ergebnis

- Punkt 1 und 2: GRAPHCODE.md, Abschnitt „Sessions and turns" (umbenannt aus „Starting a session",
  CR-GC-897): unabhaengige Lesezugriffe in einem Zug, wiederkehrende Pruefung als ein Skript mit kurzer
  Ausgabe, Skript zum Ausrollen erst lokal trocken. Ohne Werkzeugnamen; Vorlage 5.846 Zeichen.
- Punkt 3: `einzelaufrufe()` in `scripts/retro-kpi.mjs` — Zuege mit genau einem Aufruf (Anzahl, Anteil,
  Kontext) und Folgen aus 3+ gleichen Einzelaufrufen (gleiches Werkzeug, bei Bash gleiches erstes Wort
  des ersten Befehls) mit Zuegen und Kontext. Ein Zug mit mehreren Aufrufen bricht die Folge.
  se-retro Version 4 nennt die Kennzahl und ihre Deutung.
- Test: 4 neue Faelle in `tests/sitzung-kpi.test.ts`; gegen den alten Code alle 4 rot.
- Ausgangswert immo-infra (groesste Sitzung `f4eb0c78…`): 1702 von 2245 Zuegen mit Werkzeug haben genau
  einen Aufruf (76 %), Kontext 350 M; 91 Folgen aus 3+ gleichen Einzelaufrufen, 422 Zuege, 92 M Kontext.
  Der Befund nannte rund 150 Zuege in solchen Folgen; die Zaehlung hier ist weiter, weil sie jede Folge
  gleicher Werkzeuge zaehlt (auch Read, Edit), nicht nur Befehle wie python3, grep, ssh.
- `verify:full CR-GC-898`: 1732/1732 gruen (211 Dateien), Schlupf 0.
