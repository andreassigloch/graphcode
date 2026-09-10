# CR-GC-500: IO-02 Produzenten-Regel: 7 der 11 Zweier-FLOWs repariert, 4 Alternativquellen offen

**Status:** ✅ Done (2026-09-10)
**Typ:** aus Item ITEM-2026-024 (finding)
**Erstellt:** 2026-09-10
**Item:** bok/items/ITEM-2026-024.json (Lane: graph)

---

IO-02 (revidiert): ein FLOW hat genau EINEN Produzenten. Nur die Produzenten-Seite —
mehrere Konsumenten sind normal (zentrale Konfig: eine Quelle, viele Verbraucher; im Bestand
8 saubere 1:N, u.a. FLOW-dimension-readiness 1x7).

BESTAND gemessen 2026-09-10 (rig/flow-cardinality/measure.mjs, eingefrorener Korpus):
  graphcode 20/42 · graph-view-edit 5/8 · bok 3/15 · moneyflow 0/220 · test_karp 0/21
Die beiden Referenzen sind auch beidseitig sauber — die Lockerung rettet sie nicht.

REPARIERT (graphVersion 242 -> 243, 39 Kommandos durch das Gate, tier suggest, 0 Errors):
  A  Zwei Zustaende, derselbe FUNC ist P und K -> FLOW gespalten, SCHEMA geteilt (n FLOW -> 1 SCHEMA)
       FLOW-metric-policy   + FLOW-config-file          (Beschreibung sagte es selbst:
                                                        "Dieselbe Form in zwei Fassungen")
       FLOW-target-profile  + FLOW-target-profile-file
       FLOW-session-registry+ FLOW-session-entry        (+ FLOW-session-registry -io-> gve-supervise,
                                                        belegt: gve.ts:262 ruft liveSessions)
       FLOW-cli-command     + FLOW-cli-invocation
  B  Falsche Kante, der zweite "Produzent" ist Aufrufer/Konfigurator -> P-Kante geloescht
       FLOW-trajectory:      tool-context.ts:457,487 RUFT materializeTrajectory
       FLOW-store-ownership: create-harness.ts:84,87 setzt lockDir/onLockLost — konfiguriert
                             und konsumiert; P-Kante geloescht, K-Kante angelegt
  C  Zwei Inhalte unter einem Namen -> gespalten
       FLOW-audit-report (Aggregat, SCHEMA-audit-stats) + FLOW-audit-entries (Einzelsaetze,
       SCHEMA-audit-record). Kein neues SCHEMA erfunden — der Trail traegt den Satz-Vertrag.

ERGEBNIS: IO-02 20 -> 13. Ueberzaehlige Produzenten-Kanten 69 -> 62.

WAS DIE REPARATUR NICHT LOEST: die Sicht. FUNC->FUNC-Kreuzprodukt 513 -> 510. Die Linien
kommen aus den 9 Bussen, nicht aus den Zweiern.

BEWUSST OFFEN (Klasse D — zwei echte Alternativquellen desselben Inhalts, Spalten waere
Duplikation, das ist eine Entwurfsentscheidung):
  FLOW-skill-request  2P x 19K  ACTOR-agent + ACTOR-owner
  FLOW-markdown-docs  2P x  1K  export-markdown (Code) + render-views (Prompt-Skill)
  FLOW-round-prompt   2P x  4K  generation-step + next-step (kein Aufruf zwischen ihnen)
  FLOW-learning-query 2P x  1K  graph-suggest + next-step
Plus die 9 Busse (3-19 Produzenten), u.a. FLOW-mutate-cmd 19P, FLOW-graph-state 9P x 24K.

BENANNTE NEBENWIRKUNGEN (Warnings, keine Errors — der Preis des Splits):
  R-31 FUNC-tool-context und FUNC-create-harness ohne Ausgang. Beide erzeugen etwas Reales
       (ToolContext, Harness), das nicht als FLOW modelliert ist. Eigener Befund.
  FC-04 FCHAIN-recall nicht mehr actor-bounded: der Weg ist jetzt
       ACTOR-owner -> FLOW-cli-invocation -> cli-dispatch -> FLOW-cli-command -> rewind.
       Zwei Hops; FC-04 prueft nur einen. Regel-Frage, nicht Modell-Fehler.
  BW-02/CR-01/R-04 steigen leicht (5 neue FLOWs kreuzen Grenzen). fitAdvisory: 4 von 6
       Dimensionen regredieren minimal (coherence -0.061 am staerksten).
       Chebyshev-Steering praktisch unveraendert (+0.0000185).

NAECHSTER SCHRITT: Entscheidung zu Klasse D, dann IO-02 als error in contracts.


---

## Umfang dieser CR

Nur die vier offenen Klasse-D-Faelle im graphcode-Modell. Die Regel IO-02 selbst gehoert
nach `@sigloch/contracts/se` — neuer Rule heisst Familie-Review und Version-Bump
(Drift-Lock L1/L2), also eigenes Item im Ziel-Repo. Die neun Busse (3-19 Produzenten)
bleiben ebenfalls draussen: das ist Entwurfsarbeit je Fall, keine Reparatur.

## Entscheidung je Fall — mit Beleg, nicht mit Geschmack

**FLOW-skill-request** (ACTOR-agent + ACTOR-owner, 19 Konsumenten)
Kante `ACTOR-owner -io->` loeschen. Skills sind `.claude/commands` — sie laufen unter dem
Agenten, nicht unter dem Menschen. Der Mensch bittet den Agenten; die Systemgrenze, die
graphcode sieht, ist der Agent (`ACTOR-agent`: "MCP-stdio-Client"). Sein CLI-Weg steht
bereits eigenstaendig als `FLOW-cli-invocation`.
Spalten waere hier der teure Fehler: zwei identische Fluesse zu je 19 Konsumenten.

**FLOW-markdown-docs** (export-markdown + render-views, 1 Konsument)
Spalten. Beide erzeugen Markdown mit GENERATED-Header, aber nicht dasselbe: `exportMarkdown`
rendert die 15 deterministischen Views nach `docs/views/`, `render-views` ist der
Prompt-Skill fuer die `se-view`-Kommandos. Ein Konsument je Fluss, also keine Verdopplung.
Neu: `FLOW-rendered-views`, gleicher Vertrag `SCHEMA-markdown-view`.

**FLOW-round-prompt** (generation-step + next-step, 4 Konsumenten)
Spalten entlang der Konsumenten — sie sind bereits disjunkt. `generation-step` waehlt die
Runde fuer den Executor (`build-round-injection`, `rank-candidates`, `run-executor`);
`next-step` ist der Advisory-Rueckweg an den fragenden Agenten (`ACTOR-agent`).
Neu: `FLOW-next-step-advice` fuer den Agenten, gleicher Vertrag `SCHEMA-generation-step`.

**FLOW-learning-query** (graph-suggest + next-step, 1 Konsument)
Kante `FUNC-next-step -io->` loeschen. Der Vertrag sagt selbst, was drin steht: "die Lage
plus die Kandidaten, die der Fragende bereits gebildet hat". Kandidaten bildet nur
`graph-suggest` ("rankt die feuernden Operationen"); `next-step` waehlt aus Scores eine
Fokus-Dimension und bildet keine. `steering.ts:7` sagt zudem ausdruecklich, dass dort
NICHT die Learning-Schicht haengt. `next-step` bleibt Konsument von `FLOW-learning-advice`.

## Akzeptanzkriterien

1. IO-02 (Produzenten-Seite) am Realmodell: **13 -> 9**. Die neun verbleibenden sind genau
   die Busse mit 3 bis 19 Produzenten.
2. Kein FLOW mit genau zwei Produzenten bleibt uebrig.
3. Kein neuer Error im Gate; Verdict `suggest`.
4. Kein Konsument verliert seinen Zugang: die Konsumentenmengen von `round-prompt` und
   `markdown-docs` sind nach dem Split die Vereinigung von vorher.
5. SSOT und Views re-exportiert; die Messung mit `rig/flow-cardinality/measure.mjs`
   dokumentiert vorher/nachher.

## Nicht in dieser CR

- IO-02 als Regel in `@sigloch/contracts/se` (Familie-Review, Version-Bump)
- die neun Bus-FLOWs
- die Sicht: der Split bewegt das FUNC->FUNC-Kreuzprodukt nicht nennenswert (513 -> 510
  bei den ersten sieben), die Linien kommen aus den Bussen


---

## Ergebnis

graphVersion 244 -> 245, 15 Kommandos, `tier: suggest`, 0 Errors.

1. ✅ IO-02 am Realmodell **13 -> 9**. Die neun sind genau die Busse:
   ```
   19P x  3K  FLOW-mutate-cmd        6P x 7K  FLOW-formatE-artifact
   11P x 13K  FLOW-query-request     6P x 1K  FLOW-skill-report
    9P x 24K  FLOW-graph-state       3P x 1K  FLOW-steering-trigger
    7P x 10K  FLOW-gate-verdict      3P x 4K  FLOW-live-event
                                     3P x 1K  FLOW-install-result
   ```
2. ✅ Kein FLOW mit genau zwei Produzenten mehr (11 -> 0). Ueberzaehlige
   Produzenten-Kanten 69 -> 58.
3. ✅ `rules_evaluate` ueber den ganzen Graphen: 0 Errors.
4. ✅ Konsumenten vollstaendig: `round-prompt` {build-round-injection, rank-candidates,
   run-executor} + `next-step-advice` {ACTOR-agent} = die vier von vorher;
   `markdown-docs` {ACTOR-owner} + `rendered-views` {ACTOR-owner} = der eine von vorher.
5. ✅ SSOT und 15 Views re-exportiert (682 Elemente / 1845 Spuren).
   `npm run verify:model`: 44 Dateien / 351 Tests gruen.

Die Sicht bewegt sich wie vorhergesagt nicht: FUNC->FUNC-Kreuzprodukt 513 -> 515 (leicht
hoeher, weil 12 io-Spuren dazukamen). Die Linien haengen an den neun Bussen, an nichts sonst.

Benannt offen (Warnings, keine Errors): FC-04 an `FCHAIN-recall` — der Weg des Menschen zu
`rewind` laeuft seit dem cli-command-Split ueber zwei Hops, FC-04 prueft einen.
