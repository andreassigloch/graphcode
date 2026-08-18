# CR-DRAFT-GC-358 — sirail-Migration: was ein Alt-Repo beim Nachziehen kostet

**Status:** DRAFT (Findings-Sammlung — die Migration selbst ist ausgeführt, die Schlüsse sind offen)
**Angelegt:** 2026-08-18 · **Herkunft:** Auftrag „sirail auf den aktuellen Stand bringen + mit
Zusatzebenen umbauen, Findings zum Prozess mitschreiben".
**Testcase-Rolle:** dritter Import-Beleg für [CR-DRAFT-GC-357](CR-DRAFT-GC-357-testhandling.md)
(Testhandling) und zweiter Beleg für SPIKE-GC-abstraction-levels (Ebenen).

---

## 1. Was gemacht wurde

| Schritt | Ergebnis |
|---|---|
| `graphcode init` in sirail | Harness gescaffoldet: 14 Commands, 9 Hooks, `.graphcode/`, Dep `@sigloch/graphcode@^0.13.2` |
| Alt-Graph durchs **Gate** migriert | 190 Elemente / 271 Traces aus `.aimprove/graph.json.bak-2026-06-11`, 461 Kommandos, `success: true` |
| Ebene 0 eingezogen | 5 Funktionsblöcke + 1 Gruppen-MOD, 40 Kommandos |
| Export | `docs/graph/sirail.graph.json` — 196 Elemente / 305 Traces |

**Der Ebene-0-Schnitt** (sirails eigene uid-Konvention `Name.FN.NNN`, nicht graphcodes):

| Block | Kinder | allokiert auf |
|---|---|---|
| **Fahrbetrieb** | BlockStateMachine, TurnoutLogic, RoutePathfinding, TrainSimulator, CollisionDetection, FailSafe (6) | Steuerungssoftware |
| **Leitstand** | TopologyLoader, TrackPlanRenderer (2) | Steuerungssoftware |
| **Anlagenanschluss** | WebSocketServer, MqttClient, TrackAdapter, EspBoot, MeshFormation, ModuleSync (6) | HardwareModule |
| **Zugang** | RestApi, RoleModel (2) | Steuerungssoftware |
| **Inbetriebnahme** | ConfigManagement, SystemInit, ServerStartup (3) | Steuerungssoftware |

Verifiziert: 19 FUNC-compose-Kanten, **0** Doppel-Eltern, **5** FUNC-Wurzeln, MOD-in-MOD 7 → 16,
**keine elternlose MOD** mehr.

**Ein Fachurteil, das anders ausfiel als die Ablage:** `Anlagenanschluss` ist auf
`HardwareModule` allokiert, obwohl 3 seiner 6 Kinder Server-Software sind. Der Block IST die
Naht zur Anlage; ihn auf die Software zu legen hätte die ESP32-Firmware (EspBoot,
MeshFormation) unsichtbar in die Software gezogen.

---

## 2. Findings — Prozess

### F1 · Ein 5 Monate altes Repo migriert strukturell **ohne einen einzigen Bruch**

Gemessen vor der Migration, Alt-Graph gegen die *heutigen* Regeln (Ontologie 6.0.0, Rules 2.28.0):

- **0 illegale Trace-Paare** — alle 271 Kanten sind gegen die aktuellen `TRACE_PATTERNS` noch
  legal, obwohl seither u. a. `REQ→MOD allocate` entfernt wurde (CR-228).
- **2 Errors** in 190 Elementen; 132 Warnings, 14 Infos.

Das ist der eigentliche Befund: **die Ontologie hat sich additiv entwickelt, nicht brechend.**
Die Migrationsangst aus der Reparaturwoche (`docs/review.md` P5) gilt für **Paket-APIs**, nicht
für **Graphdaten**. Beides wurde bislang in einen Topf geworfen.

### F2 · Die Warnungen sind fast vollständig „was seither dazukam" — nicht Verfall

| Regel | n | eingeführt durch |
|---|---|---|
| R-19 (TEST ohne `testRefs`) | 43 | CR-GC-205 — Bindungs-Vollständigkeit |
| R-20 (FUNC ohne `realRef`) | 19 | CR-GC-205 |
| R-26 (SCHEMA ohne `realRef`) | 11 | BOK-CR-026 |
| AF-01..05 (Freshness-Stempel) | 5 | CR-SM-227 |
| R-10/RD-01/R-23/FC-04/IO-01/SC-04 | 52 | Qualitätsregeln nach 03/2026 |

**Die Bindungsschicht fehlt vollständig** (43 + 19 + 11 = 73 von 132 Warnungen = 55 %). sirails
Modell wurde nie an seinen Code gebunden — es entstand vor `realRef`/`testRefs`. Das ist keine
Reparatur, das ist Arbeit, die es noch nie gab.

### F3 · Zwei Fremdkörper: CRs über das Werkzeug im Graphen des Produkts

Die einzigen 2 **Errors** (CR-R01, „tracks nothing") sind `MilestoneOntology.CR.014` und
`ImplPlanTestConceptSkills.CR.015` — beide dokumentieren **aimprove-/graphcode-Arbeit**
(MS-Ontologie, se-view-Skills), nicht sirail. Sie wurden **bewusst mitimportiert statt still
gelöscht**, damit der Befund im Graphen sichtbar bleibt.

**Entscheidung offen:** löschen (sie gehören in die Werkzeug-Historie) oder verdrahten. Die
allgemeine Frage dahinter: *Wie verhindert man, dass Werkzeug-CRs im Produktgraphen landen?* —
mit der Föderations-Idee (`docs/proposals/graph-federation.md`) wären das Fremd-Repo-Knoten.

### F4 · Der Ebenen-Einzug kostet 12 neue Warnungen — dieselbe Klasse wie in graphcode

Nach dem Umbau: 160 statt 148 Violations. Die Differenz sind **5× R-02** (Block ohne satisfy),
**5× R-20** (Block ohne realRef), MT-01/MT-02 an der neuen Gruppen-MOD.

**Systematisch, nicht sirail-spezifisch:** ein Abstraktionsknoten ist per Konstruktion nicht
gebunden und erfüllt keine Anforderung direkt. In graphcode entstand exakt dasselbe Muster
(SPIKE §5/§6). Zwei Möglichkeiten, beide unentschieden:

- **(a)** Blöcke tragen `concept: true` — es gibt das Attribut bereits (R-20-fixHint nennt es).
- **(b)** R-02/R-20 lernen Eltern-FUNCs kennen: wer Kinder hat, wird durch sie realisiert (die
  Meta-Modell-Beschreibung sagt das bereits wörtlich: *„leaf FUNCs carry realRef, the parent is
  realized by its children"*) — R-20 hat diese Vererbung für den *Eltern*-Fall schon
  implementiert (Meldung „not fully realized — unbound compose children"), aber sie greift nur,
  wenn die Kinder gebunden sind.

**Empfehlung: (b) prüfen, bevor (a) zur Gewohnheit wird.** `concept:true` auf jeden Block zu
setzen macht die Abstraktionsebene per Konvention unsichtbar für die Bindungsregeln — das ist
genau die Sorte Prosa-Vertrauen, die `docs/review.md` P1 als Hauptdefektklasse ausweist.

### F5 · Alt-Werkzeug läuft parallel weiter — der Schnitt fehlt

`.mcp.json` trägt nach `graphcode init` **beide** Server: den neuen `graphcode` und den alten
`graph-server` (`.claude/mcp-graph-server.js` → `GRAPH_API http://localhost:3001`, die
Express-API des Vorgängerprodukts). Dazu `scripts/aimprove-local.sh` und `@sigloch/dashboard`
als `file:`-Dep.

**`init` räumt nicht auf, was es ersetzt** — es kann es auch nicht wissen. Aber damit entsteht
bei jeder Migration ein Parallelpfad (CLAUDE.md: *keine parallelen Pfade*). Offen: soll
`graphcode init` bekannte Vorgänger-Einträge erkennen und ihre Entfernung *anbieten*
(nicht: still tun)?

### F6 · Testhandling — dritter Beleg, und er widerspricht moneyflow

Für [CR-DRAFT-GC-357](CR-DRAFT-GC-357-testhandling.md): sirails 43 TEST-Knoten sind
**handmodellierte Abnahmen** (`BlockStateTest.TC.001` — „Verify block state transitions"), nicht
Datei- oder Fall-Knoten wie im moneyflow-Codeimport. Sie tragen **keine** `testRefs` (R-19, 43×).

Damit liegen **zwei unvereinbare TEST-Begriffe** nebeneinander:

| Herkunft | Granularität | n je Repo |
|---|---|---|
| Handmodelliert (sirail) | eine Abnahme, fachlich benannt | 43 |
| Codeimport (moneyflow) | Datei **und** Testfall | 25 + 400 |

Das stützt Option **b** aus CR-DRAFT-GC-357 (TEST = Abnahme, Dateien hängen als `testRefs`
daran) — der Import müsste dann Dateien **an** Abnahmen binden statt Abnahmen zu erfinden. Auf
einem Repo ohne vorhandene Abnahmen hat er allerdings nichts zum Binden. **Genau das ist die
offene Frage**, und sie ist jetzt an zwei echten Beispielen belegt statt an einem.

---

## 3. Was noch offen ist (nicht in diesem Draft entschieden)

1. **F4 — Abstraktionsknoten und die Bindungsregeln** (Vererbung vs. `concept:true`). Betrifft
   graphcode und sirail gleichermaßen → gehört in contracts, nicht ins Repo.
2. **F3 — die 2 Werkzeug-CRs** löschen oder verdrahten.
3. **F5 — `init` und die Vorgänger-Artefakte**: erkennen und Entfernung anbieten?
4. **Bindungsschicht sirail** (F2): 73 Warnungen sind Modellarbeit (welcher Code realisiert
   welche FUNC, welche Datei belegt welche Abnahme) — eigener CR, ~19 FUNC + 43 TEST Urteile.
5. **Ebene 1** in sirail: die Blätter sind heute Ebene 1. Erst nötig, wenn ein Block über
   ~8 Kinder wächst.
6. **Alt-Daten**: `.aimprove/` (82 MB Kuzu, learning.db, state.json) bleibt liegen. Die
   Migration hat aus dem **JSON-Backup vom 11.06.** gelesen, nicht aus dem Alt-Kuzu — falls
   dort neuere Stände liegen, sind sie nicht mitgekommen. **Vor dem Löschen prüfen.**

---

## 4. Reproduktion

Die Migration lief nicht über einen CLI-Verb, sondern über ein Skript gegen die Harness-API
(`createHarness({repoRoot, scope}) → mutate(commands)`), weil `graphcode import-code` nur
TS-Code kann und `seedFromJson` ein *bereits governtes* SSOT erwartet. **Ein Alt-Graph aus
Fremdformat hat heute keinen Verb** — er ist der klassische `bootstrap()`-Fall (ungovernt →
durchs Gate), aber ohne CLI-Oberfläche. Kandidat für einen eigenen CR: `graphcode import-graph
<datei>`.

**Falle, die zweimal zuschlug:** die Shell setzt das Arbeitsverzeichnis zwischen Aufrufen
zurück; ein Lauf mit relativem `process.cwd()` griff dadurch nach **graphcodes** Store und lief
in dessen `owner.lock` (folgenlos, aber verwirrend). Bei Cross-Repo-Arbeit immer absoluter
`repoRoot`.

@author andreas@siglochconsulting
