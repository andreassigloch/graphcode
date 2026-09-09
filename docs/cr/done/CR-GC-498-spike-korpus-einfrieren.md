# CR-GC-498 — Der Spike-Korpus wird eingefroren

**Status:** erledigt · **Angelegt:** 2026-09-09 · **Geschlossen:** 2026-09-09 · **Ring:** 2 (Werkzeug)
**Hängt an:** `CR-GC-493` (Herkunftsstempel — macht die Drift sichtbar, behebt sie nicht)
**Entscheidung des Auftraggebers (2026-09-09):** **Heute-Stand**, nicht Messzeitpunkt-Stand.
**Backlog:** `ITEM-2026-017` (bok)

---

## 1. Root Cause

`scripts/spike-lexikographisch.mjs` ist Korpus-Klasse — reine Rangfrage, kein Harness — liest
aber die **lebenden** `docs/graph/*.graph.json` von vier Repos, drei davon über absolute Pfade
in fremde Arbeitskopien. Ein Benchmark, dessen Eingabe weiterläuft, misst nichts.

`CR-GC-493` hat den Herkunftsstempel gebaut: jeder Lauf nennt Pfad, `sha256/12`, `graphVersion`
und Umfang je Eingabegraph. Damit ist die Drift **sichtbar** — sie ist nicht weg. Der Stempel
sagt, was gemessen wurde; er verhindert nicht, dass die nächste Messung etwas anderes misst.

Konkret betroffen: die Evidenz für `CR-SM-292` (Chebyshev statt R6). Zwei Läufe auf
verschiedenen Repo-Ständen lieferten zwei Zahlen ohne Erklärung.

## 2. Impact

**Die publizierte CR-SM-292-Zahl ist heute nicht nachrechenbar.** Wer den Spike jetzt fährt,
bekommt einen anderen Korpus als der Lauf, der die Entscheidung getragen hat — `graphcode`
allein steht bei `graphVersion 242`.

Zusätzlich: der Spike greift auf **fremde Arbeitskopien** zu. Wer `graph-view-edit` nicht
ausgecheckt hat, kann ihn nicht fahren; wer dort gerade arbeitet, verändert die Eingabe eines
graphcode-Benchmarks, ohne es zu merken.

## 3. Fix

Die vier Korpusgraphen im **heutigen** Stand nach `rig/graphs/` aufnehmen. Das Verzeichnis, sein
Aufnahmekriterium und die Begründung („eine Fixture-Kopie in `docs/graph/` wäre ein zweiter,
driftender SSOT") existieren bereits — dies ist eine Aufnahme, keine Neuanlage.

**Warum Heute-Stand:** die Alternative — den Stand des ursprünglichen Messzeitpunkts
rekonstruieren — macht *eine* publizierte Zahl nachrechenbar und alle künftigen Läufe
aussagelos, weil sie gegen einen historischen Korpus liefen. Der Heute-Stand macht jede künftige
Messung reproduzierbar und die alte Zahl **explizit** ungültig statt still falsch. Die alte Zahl
wird nicht nachgerechnet, sondern als auf anderem Korpus erhoben gekennzeichnet.

**Jeder eingefrorene Stand ist committet und sauber** — damit trägt er nicht nur einen `sha256`,
sondern einen Quell-Commit, aus dem er wiederherstellbar ist:

| Graph | `sha256/12` | `graphVersion` | Umfang | Quell-Commit |
|---|---|---|---|---|
| `bok` | `03fdd3eae9ad` | 25 | 104 / 177 | `4d36f92` |
| `graph-view-edit` | `a97af935f5b3` | 1192 | 276 / 671 | `b833e8d` |
| `graphcode` | `bc639cbc90c4` | 242 | 669 / 1823 | `27acdcd` |
| `moneyflow` | `e1d8a6cf3944` | 1 | 1229 / 966 | `8209648` |

**Die Prüfung wandert mit.** Der Spike trägt die erwarteten `sha256/12` als Konstante; weicht
eine Datei ab, **bricht er ab**. Ohne das ist ein eingefrorener Korpus nur ein Korpus, der
langsamer driftet: eine Handänderung an `rig/graphs/` ergäbe wieder still eine andere Zahl.
Kein zweites Manifest-File — die Erwartung steht neben dem Code, der sie liest.

### Dateien (6)

| # | Datei |
|---|---|
| 1–4 | `rig/graphs/{bok,graph-view-edit,graphcode,moneyflow}.graph.json` (neu) |
| 5 | `rig/graphs/README.md` — Tabelle und Abschnitt je Graph, nach bestehendem Aufnahmekriterium |
| 6 | `scripts/spike-lexikographisch.mjs` — liest aus `rig/graphs/`, prüft die Prüfsummen |

## 4. Akzeptanzkriterien

- [x] **Rot zuerst:** `graphVersion` in `bok.graph.json` auf 999 gesetzt → der Lauf bricht ab:
      *„Korpus veraendert: bok.graph.json hat sha `b5b9c37319a3`, erwartet `03fdd3eae9ad`."*
      Datei wiederhergestellt, Prüfsumme wieder `03fdd3eae9ad`.
- [x] `grep -n "Developer/dev" scripts/spike-lexikographisch.mjs` ist **leer**.
- [x] Der Spike läuft ohne ausgecheckte Nachbar-Repos durch. Die vier verbliebenen
      `atRef`-Aufrufe lesen **gepinnte Commit-SHAs der eigenen Historie**
      (`4cb5a3b^`, `c826ff2`, `ae4b57d`, `f2f3b62`, `e197995`, `b8e17f3`) — unveränderlich,
      immer verfügbar, kein Driftpfad. Sie bleiben absichtlich.
- [x] Der Stempel nennt `rig/graphs/…` und dieselben `sha256/12` wie die Tabelle oben. Sein
      Nachsatz behauptete noch „lebende Exporte" — ab jetzt falsch, also mitgezogen. Dabei fiel
      auf, dass die Dedup gegen den absoluten Pfad prüfte, während der relative gespeichert
      wurde: acht Zeilen statt vier. Behoben.
- [x] Die vier Einträge stehen in `rig/graphs/README.md`, Kriterium (c) **gemessen** statt
      behauptet: `realRef`-Bindung 33 % / 92 % / 81 % / **0 %**, Kanten je Element 1,70 / 2,43 /
      2,72 / 0,79. Die Spreizung ist der Zweck — eine Rangfrage, die nur auf gut gebundenen
      Graphen funktioniert, fällt an `moneyflow` (0 %) auf.
- [x] `npm test` grün.

## 5. Nicht im Scope

- **Die alte CR-SM-292-Zahl nachrechnen.** Sie wurde auf einem anderen Korpus erhoben; das
  festzuhalten ist die Aufgabe, sie zu reproduzieren wäre der verworfene Weg (§3).
- Die `--rig`-Fixtures (`00-baseline.json`, `01-struktur.json`) — die liegen schon rig-lokal.
- `gc_test-graphview.graph.json` — bereits aufgenommen, unberührt.
