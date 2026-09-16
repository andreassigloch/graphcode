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

---

# ERGEBNIS (2026-09-16, graphVersion 281 → 282)

Sechs `update-node`-Befehle durch das Apply-Gate: `appliedCommands 6`, `violations []`,
`tier auto-apply`, `steerAdvisory.improvement 0` — ein Metadaten-Zug bewegt die Metrik nicht,
und das ist richtig so.

| | vorher | nachher |
|---|---:|---:|
| MOD-Knoten mit `path` | 0 von 7 | **6 von 7** (MOD-dashboard bewusst ohne) |
| `src/`-Dateien mit MOD (eigene Rechnung, 93 Dateien) | 55 = 59,1 % | **92 = 98,9 %** |
| `importCoverage` am lebenden Gate (91 Import-Endpunkte) | — | **assigned 90, unassigned `["src/index.ts"]`** |

Das Gate nennt den Rest beim Namen, statt ihn zu zählen — genau die eine Datei, die dieser CR
vorab als bekannte Ausnahme benannt hat.

**Keine neuen Befunde.** RC-05 (Modul-Drift) meldet 0, RC-01/02/03 melden 0. Es bleiben
RC-04 ×20 und RC-07 ×4, beide `warning` und beide von diesem Zug unberührt (RC-07 zählt die
CR-Knoten, die `dispatch prepare` mangels laufendem Host nicht anlegen konnte — CR-GC-541
bis 544).

Die Aussage von RC-05 hat damit ihre Reichweite geändert, ohne dass sich ihr Ergebnis änderte:
vorher „0 Befunde über 55 zugeordnete Dateien", jetzt „0 Befunde über 90 von 91 Endpunkten".
Dasselbe Wort, zwei verschiedene Gewichte — das war der Zweck des Zuges.
