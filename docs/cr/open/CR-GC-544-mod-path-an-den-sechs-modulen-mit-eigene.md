# CR-GC-544: MOD.path an den sechs Modulen mit eigenem Verzeichnis setzen: Datei->MOD-Aufloesung 59,1% -> 98,9%, MOD-dashboard bleibt bewusst ohne (Nachbarsystem)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-217 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-217.json (Lane: graph)

---

Reiner MODELL-Zug. Kein Produktionscode, keine Regel-Aenderung, kein Versions-Bump.

## Warum

`buildModResolver` in contracts (CR-SM-268) loest Datei -> MOD ueber ZWEI Wege auf:
1. ueber eine gebundene FUNC (`realRef.file` + `allocate` auf ein MOD),
2. ueber `MOD.attributes.path` als laengsten Praefix — als Auffang fuer alles Ungebundene.

**Weg 2 ist in graphcode tot: alle sieben MOD-Knoten tragen `path: undefined`.** Damit kennt die
Aufloesung nur die Dateien, die zufaellig eine modellierte FUNC tragen. Gemessen ueber die
93 `.ts`-Dateien unter `src/`:

| | Dateien | Anteil |
|---|---:|---:|
| ueber gebundene FUNC (Weg 1, heute) | 55 | 59,1 % |
| zusaetzlich ueber `MOD.path` (Weg 2, nach diesem Zug) | 37 | |
| **Summe** | **92** | **98,9 %** |
| weiterhin ohne MOD | 1 (`src/index.ts`) | |

Die Aufloesung ist kein Selbstzweck: RC-05 (Modul-Drift) urteilt nur ueber Dateien, die sie
zuordnen kann, und `importCoverage` sagt danebnen, wie belastbar das Urteil ist. Bei 59 %
Zuordnung ist „RC-05: 0 Befunde" eine Aussage ueber 55 Dateien, nicht ueber 93.

## Die Pfade — aus dem Bestand abgeleitet, nicht geraten

Je MOD der gemeinsame Praefix der Dateien, die seine allozierten FUNCs schon binden:

| MOD | `path` | Beleg |
|---|---|---|
| MOD-kernel | `src/kernel` | 12 gebundene Dateien, alle darunter |
| MOD-kernel-measure | `src/kernel/measure` | 3 darunter + 3 externe (`packages/se-engine/…`) |
| MOD-loop | `src/loop` | 11 gebundene Dateien, alle darunter |
| MOD-projections | `src/projections` | 7 darunter + 2 externe (`packages/contracts/…`) |
| MOD-surface | `src/surface` | 20 darunter + `src/cli.ts` (direkt gebunden, Weg 1) |
| MOD-agent-surface | `.claude/commands` | 27 gebundene Dateien, alle darunter |

**MOD-dashboard bekommt KEINEN Pfad** — und das ist der Punkt, an dem dieser Zug ehrlich bleiben
muss. Der Knoten modelliert das Nachbarsystem `@sigloch/graph-view-edit`: eigenes Repo, eigener
Release, keine Datei in diesem Repo. Ein Pfad waere eine Behauptung ueber fremdes Gebiet.

Damit gibt es ZWEI Gruende fuer ein fehlendes `path`, die man nicht verwechseln darf:
„Nachbarsystem, hat hier keine Dateien" und „hat welche, aber niemand hat den Pfad gesetzt".
Der erste ist ein Zustand, der zweite ein Befund. Dieser Zug setzt alle Pfade der zweiten Sorte;
danach ist ein leeres `path` gleichbedeutend mit „Nachbarsystem".

Die externen Dateien (`packages/se-engine/…`, `packages/contracts/…`) bleiben ueber Weg 1
gebunden — sie liegen ausserhalb des Repo-Dateibaums, ein Praefix kann sie nicht fassen. Das ist
RC-06s Gebiet („external realRef names a declared dependency"), nicht das von `MOD.path`.

## Was NICHT Teil dieses Zuges ist

- `src/index.ts` bleibt ohne MOD. Eine benannte Differenz, kein stiller Rest: der Paket-Eingang
  traegt keine FUNC. Ob er zu MOD-surface gehoert oder bewusst draussen bleibt, ist eine eigene
  Entscheidung.
- Die Grenzmengen-Messung („FUNC gehoert ins Modell, wenn ihr Symbol eine MOD-Grenze kreuzt")
  folgt SPAETER und braucht diesen Zug als Voraussetzung. Erst die Aufloesung, dann die Zahl.
- Kein Bericht, kein Regel-, kein Code-Zug.

## Abnahme

- Sechs MOD-Knoten tragen `path`, MOD-dashboard nicht.
- Nachgemessen mit derselben Rechnung wie oben: 92 von 93 `src/`-Dateien loesen auf, der
  Rest ist genau `src/index.ts`.
- `graph_readiness` bleibt mindestens so gruen wie vorher; RC-05 darf NEUE Befunde melden —
  das waere kein Rueckschritt, sondern Drift, die vorher unsichtbar war. Neue Befunde werden
  hier GEZAEHLT und benannt, nicht stillschweigend hingenommen.
- Snapshot exportiert und committet (der pre-commit-Hook erzwingt es).
