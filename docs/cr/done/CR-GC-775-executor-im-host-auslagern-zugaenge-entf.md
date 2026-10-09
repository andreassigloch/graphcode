# CR-GC-775: Executor im Host auslagern: Zugaenge entfernen (graph_delegate, graphcode run, Schalter, Config-Abschnitt)

**Status:** ✅ Done (2026-10-09)
**Typ:** aus Item ITEM-2026-806 (idea)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-806.json (Lane: code)

---

## Auftrag (Autor, 2026-10-09)

„Auslagern und hier löschen." Der Executor im Host war seit 2026-10-03 geparkt, kostete aber weiter:
alle drei Umbauten vom 2026-10-09 (zweite Kette, Helfer-Verträge, Schalter) galten ihm.

## Auslagerung

Marke `executor-geparkt-2026-10-09` auf dem letzten Stand mit Executor (lokal gesetzt; pushen muss der
Autor). Kein eigenes Paket: der Executor importiert Kern, Schleife und Werkzeugschicht und liefe ohne
sie nicht; die Marke ist der Stand, an dem er lauffähig und getestet ist.

## Umfang dieser CR: Quellcode

**Geändert (8 Dateien):**

| Datei | Was fällt |
|---|---|
| `src/cli.ts` | Befehl `graphcode run` |
| `src/surface/mcp-server.ts` | Werkzeugprofil und Bindung von `graph_delegate` |
| `src/surface/host-shim.ts`, `src/surface/mcp-tools.ts` | Option `delegate` |
| `src/kernel/config.ts` | Abschnitt `executor` im Config-Schema |
| `src/surface/scaffold-templates.ts` | Schalter im Host-Block; `update` entfernt `GRAPHCODE_CLIENT_LLM` und `GRAPHCODE_WRITE_PATH` |
| `src/loop/channel-rank.ts`, `src/loop/task-artifact.ts` | Exporte, die nur der Executor nutzte |

Dazu `README.md` und `scripts/model-test-set.mjs`.

**Gelöscht (21 Dateien, 4.833 Zeilen):** `src/loop/executor*.ts` (10), `anthropic-stream`, `openai-stream`,
`faltung`, `fund-kontext`, `preflight`, `model-answer-contract`, `zugvermerk`; `src/surface/delegate.ts`,
`tool-profile.ts`, `run-verb.ts`; `src/kernel/measure/nd-similarity.ts`.

Die Löschungen sind Folge einer Entscheidung, kein eigener Entwurf: von außen griffen nur die fünf
Dateien oben zu (gemessen per Import-Suche vor dem Löschen). Deshalb eine CR trotz mehr als zehn Dateien.

## Wirkung

| | vorher | nachher |
|---|---|---|
| Quellzeilen | 26.300 | 21.460 |
| Testdateien | 202 | 180 |

- Ein Repo mit Abschnitt `executor` in der Konfiguration lädt weiter; der Abschnitt wird ignoriert.
- Ein Repo mit einem der zwei Schalter in der Host-Datei startet weiter; der Host liest sie nicht.
  `graphcode update` räumt sie ab. Die Startsperre aus CR-GC-772 ist damit wieder weg.
- CR-GC-771 (Kandidatenvergleich): die Rangfolge `rankCandidates` liegt an der Marke.

## Tests

Tests und Modell: CR-GC-776. Volllauf nach beiden: 178 von 180 Dateien grün; rot nur
`tests/distribution.test.ts` und `tests/lockfile-sync.test.ts` (Link-Modus, contracts 11.1 unveröffentlicht).

## Offen

Zweiter Ring, ITEM-2026-808: Zweige und Exporte, die nach der Auslagerung keinen Aufrufer im Host mehr
haben (Treiber-Zweig in `generate.ts` und `suggest.ts`, Stempel-Funktionen in `task-artifact.ts`,
`bindToolsWithContext`, Kommentare mit Executor-Bezug).
