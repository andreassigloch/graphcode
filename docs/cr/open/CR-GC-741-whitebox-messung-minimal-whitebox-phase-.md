# CR-GC-741: Whitebox-Messung (minimal-whitebox Phase 1) als S1-Messung in npm run messung (T-E2)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-744 (idea)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-744.json (Lane: code)

---

CR 5 von 5 des Konzepts [`docs/graphcode_messaufbau_konzept.md`](../../graphcode_messaufbau_konzept.md); schließt
den offenen Posten T-E2 aus CR-GC-679B. Dazu zwei Entscheide des Autors vom 2026-10-05: die Texte von `rig/agentdiary`
gehen ins Archiv, und das Rig bekommt eine Stufe `warnungsfrei` auf dem Referenzgraphen.

## Befund

T-E2 („Enthält die Whitebox, was sich tatsächlich ändert?") stand seit CR-GC-679 auf `nicht erhoben`: `run-phase1.mjs`
schrieb Textdateien nach `rig/minimal-whitebox/results/`, kein Urteil. Das Job-Set des Spikes war gegen das heutige
Modell gedriftet — `MOD-host-bridge` ist im 5er-Modulschnitt aufgegangen, die acht `FUNC-render-*` des Dashboards
gibt es nicht mehr (Probe 2026-10-05: J2a 9/11, J2b 6/14 Ground Truth vorhanden). Eine Liste von Hand veraltet mit
jedem Umbau; die Messung braucht Jobs, die mit dem Repo mitwachsen.

## Umsetzung

- `scripts/whitebox-messung.mjs` (neu): **Jobs aus der CR-Historie.** Jeder Commit an der SSOT, auf den ein
  abgeschlossener CR mit `commitRef` zeigt, ist ein Job: Seeds = relation-Ziele des CR im Graphen vor dem Commit,
  Ground Truth = die dort vorhandenen Knoten, die der Commit geändert oder entfernt hat (neue Knoten kann keine
  Scheibe vorhersehen; der CR-Knoten selbst zählt nicht). Gemessen am Graphen vor dem Commit im Wegwerf-Store
  (`openMeasured`, Policy des Repos): W = `graph_context`-Closure der Seeds, B = `harness.impact` als Kontrolle.
  Kriterium je Job: Ground Truth vollständig in W und |W|/|G| ≤ 0,05; Urteil über die jüngsten 10 Jobs. Die
  Kalibrier-Fixture J1 (`beispielgraphen/dummy-slicer.graph.json`) läuft mit und wird genannt, nicht beurteilt.
- `scripts/messung.mjs`: Zeile T-E2 aus `whiteboxMessung`; aus `NICHT_ERHOBEN` gestrichen.
- `rig/minimal-whitebox/` gelöscht (Phase-1-Rest; Alt-README im Archiv seit CR-GC-740); `rig/README.md`, Konzept §5.
- **Stufe `warnungsfrei`** (Entscheid Autor): `simulator.ZIEL` trägt je Stufe ihr Ziel (`modellieren` → SRR und PDR,
  `warnungsfrei` → `rules_evaluate` ohne Fehler und Warnung); `ende()` nimmt das erreichte Ziel. Eine Aufgabe kann eine
  `basis` nennen (Graph, auf dem der Lauf beginnt — der Host seedet aus `docs/graph/<systemId>.graph.json`);
  `nachspielen` startet dann auf der Basis und liefert zusätzlich den Befund (Fehler, Warnungen). Aufgabe
  `rig/aufgaben/todo-warnungsfrei/` = Referenzlauf todo/lokal als Basis, Antwortblatt und Raster wie todo.
  `auswerten`/`schatten` spielen Läufe mit Basis von dort nach.
- `rig/agentdiary` (lokal): die Auswertungstexte nach `docs/archive/messung-agentdiary/` (Regel 2), Rohdaten in den
  Papierkorb (`~/.Trash/graphcode-rig-rohdaten-2026-10-05/agentdiary`).

## Verifikation

- `tests/whitebox-messung.test.ts`: `aenderungen`, `jobAusCommit`, `jobErgebnis`, `urteil` rein; Historie liefert Jobs;
  Kalibrier-Fixture im Wegwerf-Store.
- `tests/rig-interaktiv.test.ts`: `ZIEL` je Stufe, `ende` mit erreichtem Ziel, Aufgabe mit Basis.
- `tests/auswertung.test.ts`: `nachspielen` mit Basis — leeres Audit ergibt die Basis, SRR und PDR bestanden, Warnungen > 0.
- `node scripts/whitebox-messung.mjs` (2026-10-05, SSOT bis dfe8e26): 7 Jobs aus der Historie (CR-GC-723 … 732; die
  Commits von 733–740 ändern oder berühren keinen vorhandenen Knoten — sie legen nur an), **4/7 bestanden**. Nicht in W:
  `REQ-repo-uninstall` (CR-GC-732), `FUNC-gate-client` (CR-GC-724, dort auch |W|/|G| 0,063), `FUNC-block-ruestzeug`,
  `UC-reduced-llm` (CR-GC-723). Kalibrierung J1: 1/1 in W. **T-E2 nicht bestanden** — die erste Zahl zu T-E2 überhaupt;
  Zeile in `docs/messung/stand.md`.
- `npm run messung` (2026-10-05): `docs/messung/stand.md` neu, T-E2 erstmals mit Urteil. T-E8 lief dabei unter Last
  (lokaler LLM-Lauf und Suite parallel): 4042 ms statt 2661 ms — kein neuer Stand, bei ruhiger Maschine wiederholen.
- `npm run verify:full CR-GC-741` (2026-10-05): 202 Dateien, 1760 Tests grün; Spur CODE, Auswahl 53/202, Schlupf 0
  (Folge ohne Schlupf 3/10). Kongruenz: `scripts/` hat kein MOD im Modell (wie `scripts/messung.mjs`); der CR hängt an
  `MOD-rig` (Stufe `warnungsfrei`) und `REQ-rig-benchmark`.
