# CR-GC-404 — Ein dauerhaft roter Guard ist kein Guard

**Status:** **UMGESETZT** (2026-08-23) · **Angelegt:** 2026-08-23
**Datei:** `tests/distribution.test.ts` · **Art:** Testinfrastruktur, kein Produktionscode
**Herkunft:** aufgefallen bei der Umsetzung von CR-SM-262

## Problem — der Duplikat-Guard läuft in dieser Arbeitskopie über einen leeren Baum

`TEST-distribution › installs each @sigloch package exactly once` (CR-SM-248) durchläuft
`node_modules/@sigloch` und betritt jeden Eintrag mit `entry.isDirectory()`.

Nach `npm run link:siblings` ist dort **kein einziges Verzeichnis**:

```
contracts isDirectory=false isSymlink=true
graph-api-core isDirectory=false isSymlink=true
…
```

`readdirSync(withFileTypes)` meldet einen Symlink als `isSymbolicLink()`, nicht als
`isDirectory()`. Der Walk betritt also nichts, findet null Manifeste und fällt über seine eigene
Absicherung: `expect(manifests.length).toBeGreaterThanOrEqual(5)` — *„The guard is worthless if it
walked an empty tree."*

**Der Guard verhält sich richtig.** Er ist laut statt still, genau wie gebaut. Falsch ist die
Folge: er bleibt dauerhaft rot, und ein dauerhaft roter Test wird nach zwei Tagen ignoriert —
samt dem echten Fehlschlag, der irgendwann daneben steht.

In CI ist er grün: `ci.yml` fährt `npm ci`, dort liegen echte Verzeichnisse. Der Kopf des Tests
sagt das sogar schon („linked siblings, no warm cache — and that only needs to run where work
lands"), nur zieht die Datei die Konsequenz nicht.

## Änderung

**Überspringen statt scheitern, mit Begründung in der Ausgabe.** Sind Symlinks im Baum, meldet
der Test, wie viele und warum er nicht prüft, und endet grün.

**Den Symlinks zu folgen wäre die falsche Reparatur.** Der Guard prüft eine **Installation** —
npm hat ein Paket zweimal ausgelegt, weil ein Manifest sich selbst als dependency führt. Ein
Workspace-Verzeichnis ist keine Installation. Er würde dann etwas anderes messen und trotzdem
grün melden: die schlechtere Lage.

## Die Hälfte, ohne die das ein Rückschritt wäre

Ein übersprungener Test, dessen Logik niemand mehr laufen sieht, ist kein Guard mehr. Deshalb
wandern Walk und Auswertung aus der Test-Closure heraus (`collectManifests`, `selfDependents`,
`duplicates`) und bekommen einen eigenen Fall an einem **gebauten** Verzeichnisbaum:

- ein sauberer Baum (zwei Pakete, je einmal) → keine Befunde;
- der reale Defekt aus CR-SM-248 nachgestellt — `@sigloch/graphify@0.2.0` führt sich selbst als
  dependency, npm nistet `0.1.0` in es hinein → **beide** Befunde, Selbst-Abhängigkeit und
  Duplikat, mit Version und Pfad.

Damit läuft die Logik auch lokal, und der übersprungene Fall betrifft nur noch das, was er
wirklich nicht prüfen kann: die Installation.

## Akzeptanzkriterien

- [x] In der verlinkten Arbeitskopie ist der Test grün und sagt in der Ausgabe, warum:
      `[distribution] uebersprungen: 7 verlinkte @sigloch-Pakete (contracts, graph-api-core, …).
      Der Guard prueft eine Installation, nicht einen Workspace — in CI (npm ci) laeuft er
      vollstaendig.`
- [x] Die Walk-Logik hat einen eigenen Fall an echten Verzeichnissen und findet dort Duplikat
      **und** Selbst-Abhängigkeit — gegengeprüft mit dem nachgestellten CR-SM-248-Defekt.
- [x] Kein Produktionscode geändert. 905/905 Tests grün (vorher 903/905).
