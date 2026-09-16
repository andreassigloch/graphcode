# CR-GC-548: Kennzahlen-Recorder fuer die Null-Zeile eines fremden Projekts: Repo als Argument, Greenfield-fest (kein Snapshot, kein src), JS/JSX statt nur TS, und er meldet seine eigene Reichweite

**Status:** ✅ Done (2026-09-16)
**Typ:** aus Item ITEM-2026-226 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-226.json (Lane: code)

---

Vorbereitung fuer die Evaluation am 2026-09-17. **Die Null-Zeile ist das einzige Mass, das sich
nachtraeglich nicht rekonstruieren laesst** — `retro-kpi.mjs` (CR-GC-212) braucht
`graph_readiness` START → ENDE, und ohne Start gibt es keine Aussage ueber den Verlauf.

## Vier Dinge, die der Recorder vorher nicht konnte

**1. Er lief nur im eigenen Repo.** `process.cwd()` fest verdrahtet. Jetzt
`node scripts/kennzahlen.mjs <repo> "<Anlass>"` — der Recorder liegt in graphcode, gemessen
wird anderswo. Die Zeile landet in `<repo>/docs/kennzahlen.md`.

**2. Greenfield war ein Absturz.** Kein Snapshot, kein `src/` ⇒ `ENOENT`. Ein neues Projekt hat
beides nicht, und genau dort braucht man die Null-Zeile. Jetzt ein ZUSTAND: `graphVersion 0`,
0 Knoten, und die Zeile traegt den Vermerk `NULL-ZEILE (noch kein Modell/Quellcode)`. Geprueft
gegen ein leeres Verzeichnis.

**3. Er las nur `.ts`.** Gemessen an graph-view-edit: **0 Dateien** bei 53 vorhandenen — ein
JSX-Projekt war stumm, und stumm sah aus wie sauber. Jetzt `.ts/.tsx/.js/.jsx/.mjs`, und die
Importaufloesung probiert alle Endungen plus `index.*` statt nur `.js → .ts`.

**4. Er verschwieg seine Reichweite — der gefaehrlichste Punkt.** graph-view-edit meldete nach
Punkt 3 eine FUNC-Grenzdeckung von **2/2 = 100 %**. Das ist kein Guetesiegel, sondern ein
winziger Nenner: ohne `MOD.path` (ITEM-2026-220) loesen dort nur **8 von 53 Dateien** zu einem
MOD auf, also gilt fast nichts als grenzueberschreitend. Ein neues Projekt saehe morgen genauso
schmeichelhaft aus. Jetzt meldet die Messung `Reichweite: 8 von 53 (15,1 %)` mit Warnzeichen
unter 80 % — dieselbe Lehre wie `importCoverage` (CR-SM-268): **eine Zahl ohne ihre Reichweite
luegt.** Die Spalte steht auch im Verlauf.

## Was NICHT gemacht wurde

Die historischen Zeilen (v284–v291) tragen in der neuen Spalte `—`, keine nachgerechnete Zahl.
Die Reichweite war damals sehr wahrscheinlich dieselbe 99 %, aber eine nachtraeglich errechnete
Zahl ist keine gemessene, und in einer Reihe, die Verlaeufe belegen soll, ist der Unterschied
der ganze Punkt.

## Abnahme

- graphcode unveraendert: 93 Dateien, 92 Grenzsymbole, FUNC 15/44, SCHEMA 9/48, Reichweite 99 %.
- graph-view-edit lesbar statt stumm: 53 Dateien, Reichweite 15,1 % mit Warnung.
- Leeres Verzeichnis: `leer: true`, 0/0, kein Absturz.
- Fremdes Repo ohne Host: klare Absage, die das Repo nennt — keine halbe Zeile.
- Alle Zeilen der Reihe haben dieselbe Spaltenzahl (12).

## Morgen, als Reihenfolge

1. Repo anlegen, `graphcode init`, Host starten.
2. **`node <graphcode>/scripts/kennzahlen.mjs <neues-repo> "Null-Zeile"`** — VOR der ersten Mutation.
3. Danach je Zug eine Zeile, und die erwartete Guete des Zuges VORHER notieren (sonst wird die
   Auswertung eine nachtraegliche Begruendung).
