# CR-GC-396 — Der Viewer steht zweimal im Modell

**Status:** offen, Vorschlag · **Angelegt:** 2026-08-22
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
