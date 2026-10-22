---
name: se:import-code
version: 2
description: Bestehende TS-Codebasis deterministisch in den Graph importieren (graphify, kein LLM) — Reseed der importierten Knoten mit automatischem Backup, der handgeschriebene Teil bleibt; FUNC/MOD/FLOW+SCHEMA, keine UC/REQ; danach Ketten aus den Aufrufen bilden
---

Der deterministische Import-Pfad (CR-GC-298): eine **bestehende** TypeScript-Codebasis wird
reverse-engineert statt UC/REQ von Hand zu erfinden. Tree-sitter, kein LLM — gleicher Repo-Stand
ergibt immer denselben Graphen.

## Wann dieser Zug richtig ist

- Ein Repo hat schon Code, aber noch keinen (oder einen wegwerfbaren) Graphen → Initialbefüllung.
- Der Code hat sich stark bewegt und der Code-Teil des Graphen soll neu abgeleitet werden.
- Ein Repo wird nachträglich modelliert: der Import liefert die Aufrufe, aus denen die Ketten
  entstehen (unten).

Der Import ersetzt nur die Knoten, die er selbst angelegt hat (`origin: import-code`, CR-GC-527).
Der handgeschriebene Teil (SYS, UC, REQ, ACTOR, eigene FUNC/FLOW/TEST samt Kanten) bleibt stehen.
Vor dem ersten Import in ein hand-gepflegtes Modell trotzdem mit dem Nutzer klären: danach stehen
importierte und handgeschriebene FUNCs zum selben Code nebeneinander.

## Ausführung

```bash
npx @sigloch/graphcode import-code [dir]   # Default dir = cwd; Report auf stderr
```

Voraussetzung: kein laufender MCP-Host auf demselben Store (sonst `StoreOwnershipError` — Host
stoppen, Import laufen lassen, Host neu starten).

## Was passiert (Reseed, nie Merge)

1. **Automatisches Backup** des bestehenden Graphen nach `.graphcode/backup/graph-<ts>.json`
   (entfällt nur beim Erstlauf auf leerem Graph). Das ist der Recovery-Pfad.
2. **Ein atomarer Gate-Batch:** delete-node für importierte Knoten, die der Code nicht mehr
   enthält, plus die extrahierten Elemente als Upsert. Blockt das Gate, passiert nichts — der alte
   Graph bleibt stehen.
3. `graph_export` committet den neuen Stand (kanonischer Sync-Pfad).

## Was das Ergebnis bedeutet

- Nur **FUNC** (pro Funktion), **MOD** (pro Datei), **FLOW** (pro aufgelöstem internen Call) +
  **SCHEMA** (Callee-Signatur); TEST-Knoten isoliert ohne Kante. Alles confidence 1.0 —
  strukturell sicher, nicht inferiert.
- **Keine UC/REQ/ACTOR/SYS** — die Absichtsebene bleibt der generative Pfad (`se:generate`),
  der danach AUF dem importierten Code-Graphen aufsetzen kann.
- Erwartbare Warnings in `rules_evaluate`/`readiness` (z.B. FUNC ohne satisfy, R-20 codeRef):
  das ist der Arbeitsvorrat für die Absichtsebene, kein Fehler des Imports.

## Danach: Ketten aus den Aufrufen bilden

Jeder importierte FLOW ist ein Aufruf, den es im Code gibt. Das ist die Grundlage, auf der die
Absichtsebene entsteht, nicht eine Liste zum Aufräumen:

1. Je Use Case den Einstieg suchen: das Werkzeug, das Verb oder das Skript, das der Akteur ruft.
2. Von dort den Aufrufen folgen. Die erreichten Funktionen sind die Glieder der Kette.
3. Erst dann zusammenfassen: Blöcke über den Funktionen, Verträge über den Flüssen.

Eine Kette, die von Hand über bestehenden Code gezeichnet wird, beschreibt, was jemand vom Code
glaubt. In graphcodes eigenem Modell traf das 40 % der Flüsse in 25 Ketten (CR-GC-832..838).
Die Regeln für den Schnitt stehen in `se:top-level`, Abschnitt „Model the call path".

## Recovery

Backup zurückspielen: Backup-Datei nach `docs/graph/<member>.graph.json` kopieren, dann
`graph_reseed` (MCP) — oder Host stoppen, `rm .graphcode/kuzu*`, neu starten (seed-on-empty).
