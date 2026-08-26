# CR-DRAFT-GC-437 — `graphcode migrate`: Gate-Migration über einen Grammatik-Major

**Status:** DRAFT · **Angelegt:** 2026-08-26 · **Herkunft:** BOK-CR-034 Punkt 4
(Retro contracts-9.1.0-Zug).

## Problem

Entfällt ein TRACE_PATTERN (Grammatik-Major), bootet kein Host mehr auf einem Alt-SSOT:
der Drift-Reseed importiert `docs/graph/*.graph.json` gegen das neue Kuzu-DDL und stirbt
an den nun illegalen Kanten. Damit ist das Gate unerreichbar — genau der Weg, über den
die Migration laufen MUSS (gate-only-writes). Henne-Ei.

Beim 9.1.0-Zug gelöst per node_modules-Chirurgie: Registry-Tarball der Alt-contracts
extrahieren, Symlinks in graphcode UND graph-api-core (DDL-Quelle!) umbiegen, halbe
Kuzu-Caches löschen, Migration in-process über den Tool-Layer, alles zurückbauen.
Funktioniert, ist aber nicht wiederholbar dokumentierbare Handarbeit
(Memory `grammar-major-migration-mechanik`).

## Soll

`graphcode migrate --with-contracts <version> [--batch <datei>|--commands …]`:

1. lädt die angegebene contracts-Version isoliert (Tarball-Extrakt in `.graphcode/tmp`,
   eigene Auflösung — kein Eingriff in node_modules),
2. baut damit Descriptor/DDL, seedet den SSOT in einen frischen Wegwerf-Store,
3. fährt den Batch durch **denselben Tool-Layer** (`graph_mutate` + `graph_export`,
   Audit/Trajectory inklusive),
4. räumt Store-Cache + Extrakt ab; der nächste normale Boot reseedet aus dem jetzt
   legalen JSON unter der neuen Grammatik.

Kein zweiter Schreibweg: das Verb IST der Tool-Layer, nur mit injizierter Alt-Ontologie.

## Offen (vor Umsetzung klären)

- Woher kommt der Batch — Hand-JSON, Format-E, oder ein Regel-getriebener Vorschlag
  (`rules_get_violations` unter neuer Grammatik → Lösch-/Umhäng-Kandidaten)?
- Braucht graph-api-core dafür einen Descriptor-Injektionspunkt statt des Modul-Imports?

Max 5 Dateien; erst nach Familie-Review starten (Drift-Lock L1: contracts-Versionen
bewusst mischen ist genau die Klasse, die sonst verboten ist).
