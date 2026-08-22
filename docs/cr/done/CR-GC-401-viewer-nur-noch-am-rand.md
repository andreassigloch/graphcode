# CR-GC-401 — Der Viewer steht zweimal im Modell

**Status:** done · **Angelegt:** 2026-08-22 · **Umgesetzt:** 2026-08-22 (graphVersion 181 → 184)
**Umnummeriert:** 2026-08-22 von `CR-GC-396` — die Nummer war doppelt vergeben
(`done/CR-GC-396-uc-repo-lebenszyklus.md`).
**Herkunft:** Ablehnung von `sigloch-modules/docs/cr/done/CR-SM-257`. Dort sollten `R-02`, `R-30`
und `R-31` Knoten mit `external: true` überspringen. Das wurde abgelehnt — die 21 Befunde, die es
entfernt hätte, kommen nicht aus einer zu strengen Grammatik, sondern aus **diesem** Modellfehler.

## Root Cause

graphcode führt `@sigloch/graph-view-edit` **zweimal**:

| Modellierung | Inhalt | Zustand |
|---|---|---|
| **Rand** | `ACTOR-dashboard`, gespeist von `FLOW-live-event → SCHEMA-update-event [external]` und `FLOW-module-metrics`, löst `UC-live-graph-view` / `UC-code-quality` aus | vollständig und richtig |
| **Innenleben** | `MOD-dashboard` + `FUNC-block-arch-sicht` + `FUNC-block-reifegrad-sicht` + 7 × `FUNC-render-*` + `FUNC-subscribe-updates` | kein `realRef`, keine `io`-Kante, keine Kettenmitgliedschaft |

Zwei Wege zu derselben Aussage — und der billigere (der ACTOR) umgeht jede Prüfung, die am
teureren hängt. Das ist Gate 2 des `se-grammar-review` wörtlich, dieselbe Klasse wie
`FUNC -satisfy-> UC` in CR-GC-366.

`FUNC-subscribe-updates` zeigt es am schärfsten: der Knoten hängt in `FCHAIN-live-update`, empfängt
`FLOW-live-event` und hat keinen Ausgang — weil sein Ausgang **der Viewer** ist, und der ist als
`ACTOR-dashboard` bereits Ziel genau dieses FLOWs. Der FUNC ist die zweite, lose Kopie eines
Randübergangs, den der ACTOR schon trägt.

## Impact

Gemessen, graphVersion 171: die acht Knoten tragen **21 Befunde** — `R-02` 6, `R-30` 7, `R-31` 8.
Sie sind nicht falsch gemeldet. Sie sagen korrekt: *diese Funktionen hängen an nichts.* Man kann
sie nur auf zwei Arten stillstellen — die Struktur eines fremden Repos hier erfinden (und beim
nächsten Release des Fremdpakets stillschweigend falsch liegen), oder die Knoten dorthin
zurückgeben, wo sie hingehören.

**Warum die Grammatik nicht der Hebel ist.** Am Systemrand greifen drei Regeln in Reihe:

```
FUNC -io-> FLOW -io-> ACTOR      R-31 erzwingt, dass der Grenz-FLOW existiert
FLOW ----> SCHEMA                 SC-04 erzwingt seinen Datenvertrag
SCHEMA.external = true            der Vertrag wird drüben veröffentlicht
```

33 von 33 Grenz-FLOWs in graphcode tragen heute so ein SCHEMA. Eine Ausnahme in `R-31` hätte das
erste Glied gekappt: ohne geforderten FLOW feuert `SC-04` nie, und an keiner externen Schnittstelle
würde je wieder ein Schema-Vertrag verlangt.

## Fix

1. **Löschen:** `FUNC-render-artifacts`, `-graph`, `-health`, `-impact`, `-impl-gates`,
   `-readiness`, `-recommendations`, `FUNC-subscribe-updates`, `FUNC-block-arch-sicht`,
   `FUNC-block-reifegrad-sicht`. Alle durchs Gate (`mutate()`), ein Batch.
2. **`MOD-dashboard` bleibt** — es ist die Paketgrenze und trägt fünf `satisfy`-Kanten
   (`REQ-artifact-freshness`, `-dashboard-ontology-sync`, `-dashboard-readonly`,
   `-readiness-transparent`, `-shared-views-no-fork`). `ACTOR -satisfy-> REQ` ist kein legales
   Pattern, die Kanten können also nicht an den ACTOR wandern, und die fünf REQ dürfen ihren
   Erfüller nicht verlieren.
   Dabei: `external: true` setzen und die Beschreibung korrigieren — sie sagt „graphcode-owned"
   und `path: src/viewer`, seit dem Carve-Out nach `@sigloch/graph-view-edit` beides falsch.
3. **`FUNC-block-schaufenster`** verliert zwei `compose`-Kinder — prüfen, ob der Block danach noch
   trägt oder selbst entfällt.

## Kosten, ehrlich

**+1 Befund** (`R-23`, *MOD must have allocated FUNC*, warning): `MOD-dashboard` hat danach keine
Funktion mehr im Modell. Das ist die richtige Aussage — wir modellieren das Innenleben eines
fremden Pakets nicht — und ist als eine sichtbare Warnung billiger als acht Knoten, die so tun,
als gehörten sie uns.

**−21 Befunde** aus `R-02`/`R-30`/`R-31`, ohne einen einzigen Grammatik-Eingriff.

## Akzeptanzkriterien

- [ ] Die zehn Knoten sind über das Gate gelöscht, `graph_export` geschrieben, Reseed-Roundtrip grün.
- [ ] `ACTOR-dashboard` und `FLOW-live-event → SCHEMA-update-event` unverändert — der Rand bleibt
      vollständig modelliert, inklusive Schema-Vertrag.
- [ ] `MOD-dashboard` trägt `external: true`, eine zutreffende Beschreibung, kein `path`, und alle
      fünf `satisfy`-Kanten.
- [ ] `rules_evaluate`: `R-02`, `R-30`, `R-31` fallen um zusammen 21; `R-23` steigt um 1; sonst
      bewegt sich kein Zähler.
- [ ] Kein FUNC im Modell trägt noch `external: true`, ohne in einer lokalen Wirkkette zu hängen.
      Die vier, die bleiben (`FUNC-arch-fitness`, `-compute-readiness`, `-module-metrics`,
      `-score-completeness`), tun das bereits — sie sind integriert, nicht fremd.

## Abgrenzung

`external: true` behält seine **eine** Bedeutung: der Code liegt in einem anderen Paket, deshalb
schuldet der Knoten keinen `realRef` (`R-20`, `R-27`, `RC-01..03`). Modellstruktur schuldet er
weiter. Die Unterscheidung, die dieser CR trifft, ist nicht „eigen vs. fremd", sondern
**integriert vs. Nachbarsystem**: läuft unsere Wirkkette durch den Code hindurch und kommt zurück?
Bei `se-engine`, `contracts` und `graphcode-client` ja — die bleiben FUNC. Bei `graph-view-edit`
nein — das ist ein ACTOR.

@author andreas@siglochconsulting

---

## Ergebnis (2026-08-22, graphVersion 181 → 184)

Drei Gate-Batches, alle mit `baseVersion` (eine Parallel-Session arbeitete im selben Repo):
181 → 182 die zehn Löschungen (43 Mutationen: 10 Knoten + 33 kaskadierte Kanten, `auto-apply`,
**0 neue Violations**) · 182 → 183 die Ent-Allokation · 183 → 184 Neu-Allokation + `MOD-dashboard`.

### Die Zahlen — die Vorhersage trifft exakt

| Regel | v181 | v184 | Δ | CR sagte |
|---|---|---|---|---|
| `R-02` | 19 | 13 | **−6** | −6 ✓ |
| `R-30` | 14 | 7 | **−7** | −7 ✓ |
| `R-31` | 33 | 25 | **−8** | −8 ✓ |
| `R-23` | 0 | 1 | **+1** | +1 ✓ |

Elemente 667 → 657. Compliance bleibt 1,0 (0 Error-Violations), `arch` steigt 0,975 → 0,981.

### Was der CR nicht gesehen hatte — und was ohne diesen Schritt falsch geworden wäre

**`MOD-dashboard` trug einen ELFTEN allokierten FUNC:** `FUNC-block-live-dashboard`, den der CR
nicht nennt. Er ist **kein** Viewer-Innenleben — seine verbleibenden drei Kinder sind graphcodes
EIGENER Code: `FUNC-broadcast-diff` (`src/viewer/host.ts:broadcast`), `FUNC-serve-sse`
(`src/viewer/host.ts:serveHost`), `FUNC-emit-update-event` (`src/emit.ts:makeUpdateEventHook`).
Zwei davon sind ohnehin schon `MOD-host-bridge` zugeteilt.

Hätte man Schritt 2 des CR wörtlich ausgeführt — `external: true` an `MOD-dashboard`, sonst nichts —
dann läge graphcodes eigener SSE-Host-Code in einem als **fremd** deklarierten Modul. Das ist genau
der Fehler, den dieser CR abschaffen will, nur mit umgekehrtem Vorzeichen. Und `R-23` hätte gar
nicht gefeuert, weil das Modul weiter einen FUNC gehabt hätte — die „ehrliche Kosten"-Rechnung des
CR wäre aus dem falschen Grund richtig gewesen.

**Deshalb ein vierter Schritt:** `FUNC-block-live-dashboard` von `MOD-dashboard` nach
`MOD-host-bridge` umallokiert. Erst danach ist `MOD-dashboard` leer, `external: true` zutreffend
und `R-23` das korrekte, gewollte Signal.

**Punkt 3 des CR beantwortet:** `FUNC-block-schaufenster` **trägt weiter** — er verliert zwei von
vier `compose`-Kindern, `FUNC-block-dokumentenwerk` und `FUNC-block-live-dashboard` bleiben.

### Abweichung von „sonst bewegt sich kein Zähler"

Zwei weitere Zähler haben sich bewegt, beide als Folge, keiner als Schaden:

- **`MT-02` 7 → 6.** `MOD-dashboard` fällt aus der Kohäsions-Messung (keine FUNCs mehr),
  `MOD-host-bridge` kommt hinein: `LCOM4=6 (6 FUNCs in 6 disconnected groups)`. Netto −1.
  *Beobachtung für später:* dass der Rollup `FUNC-block-live-dashboard` in `MOD-host-bridge` eine
  eigene Gruppe bildet, heißt, er ist mit seinen eigenen Blättern nicht über `io` verbunden.
- **`RC-05` 13 → 11.** Konformanz gegen den Import-Graphen; die gelöschten Knoten trugen zwei
  Befunde.

### Abnahme

| AK | Beleg |
|---|---|
| Zehn Knoten übers Gate gelöscht, exportiert, Roundtrip grün | 43 Mutationen, `graph_export` geschrieben (657 Knoten / 1713 Kanten); `npm run verify:model` **32 Dateien, 243/243 grün, 47 s** (enthält `codec.roundtrip`, `harness.import`, `graph-integrity`, `rewind`) |
| Rand unverändert | `ACTOR-dashboard` mit beiden `io`-Kanten zu `UC-code-quality`/`UC-live-graph-view`, gespeist von `FLOW-live-event` und `FLOW-module-metrics`; `FLOW-live-event -relation-> SCHEMA-update-event` steht |
| `MOD-dashboard`: `external`, Beschreibung, kein `path`, fünf `satisfy` | `external: true`, `path: null` (Grabstein — Attribute sind mergebar, nicht löschbar), Beschreibung auf das Nachbarsystem umgeschrieben; alle fünf `satisfy`-Kanten unversehrt |
| Kein externer FUNC ohne Wirkkette | Es bleiben genau die vier genannten — `FUNC-arch-fitness`, `-compute-readiness`, `-module-metrics`, `-score-completeness` — alle vier in einer Kette |
| Views ohne Fremdreversion | `git diff docs/views` geprüft: jede Änderung ist eine direkte Folge der Löschung (CR-Liste, ICD-Konsumenten, Testpyramide 112 → 102 FUNC). Keine unbeteiligte Zeile. |
