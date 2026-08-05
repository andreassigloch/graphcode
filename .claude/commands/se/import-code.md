---
name: se:import-code
version: 1
description: Bestehende TS-Codebasis deterministisch in den Graph importieren (graphify, kein LLM) — Reseed-Semantik mit automatischem Backup; FUNC/MOD/FLOW+SCHEMA, keine UC/REQ
---

Der deterministische Import-Pfad (CR-GC-298): eine **bestehende** TypeScript-Codebasis wird
reverse-engineert statt UC/REQ von Hand zu erfinden. Tree-sitter, kein LLM — gleicher Repo-Stand
ergibt immer denselben Graphen.

## Wann dieser Zug richtig ist

- Ein Repo hat schon Code, aber noch keinen (oder einen wegwerfbaren) Graphen → Initialbefüllung.
- Der Code hat sich stark bewegt und der Code-Teil des Graphen soll neu abgeleitet werden
  (Re-Import = voller Reseed, siehe Warnung unten).

**Nicht** der richtige Zug: ein hand-gepflegter Graph mit UC/REQ/ACTOR, der erhalten bleiben soll —
der Import **ersetzt den gesamten Graphen**. Erst mit dem Nutzer klären, dann ausführen.

## Ausführung

```bash
npx @sigloch/graphcode import-code [dir]   # Default dir = cwd; Report auf stderr
```

Voraussetzung: kein laufender MCP-Host auf demselben Store (sonst `StoreOwnershipError` — Host
stoppen, Import laufen lassen, Host neu starten).

## Was passiert (Reseed, nie Merge)

1. **Automatisches Backup** des bestehenden Graphen nach `.graphcode/backup/graph-<ts>.json`
   (entfällt nur beim Erstlauf auf leerem Graph). Das ist der Recovery-Pfad.
2. **Ein atomarer Gate-Batch:** delete-node für alles Bestehende + die extrahierten Elemente.
   Blockt das Gate, passiert nichts — der alte Graph bleibt stehen.
3. `graph_export` committet den neuen Stand (kanonischer Sync-Pfad).

## Was das Ergebnis bedeutet

- Nur **FUNC** (pro Funktion), **MOD** (pro Datei), **FLOW** (pro aufgelöstem internen Call) +
  **SCHEMA** (Callee-Signatur); TEST-Knoten isoliert ohne Kante. Alles confidence 1.0 —
  strukturell sicher, nicht inferiert.
- **Keine UC/REQ/ACTOR/SYS** — die Absichtsebene bleibt der generative Pfad (`se:generate`),
  der danach AUF dem importierten Code-Graphen aufsetzen kann.
- Erwartbare Warnings in `rules_evaluate`/`readiness` (z.B. FUNC ohne satisfy, R-20 codeRef):
  das ist der Arbeitsvorrat für die Absichtsebene, kein Fehler des Imports.

## Recovery

Backup zurückspielen: Backup-Datei nach `docs/graph/<member>.graph.json` kopieren, dann
`graph_reseed` (MCP) — oder Host stoppen, `rm .graphcode/kuzu*`, neu starten (seed-on-empty).
