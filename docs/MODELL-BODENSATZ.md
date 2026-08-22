# Modell-Bodensatz

Was hier steht, bleibt **absichtlich** offen. Zwei Gründe zählen, jeder muss benannt sein:

- **Widerspruch** — eine Regel verlangt etwas, das eine andere Regel oder die Realität ausschließt.
  Das gehört in einen Regel-CR gegen `@sigloch/contracts`, nicht in eine Kante.
- **Unverhältnismäßiger Aufwand** — der Knoten wäre wahr, aber niemand liest ihn je, und die
  Pflege kostet mehr als die Aussage wert ist.

Kein Eintrag darf hier landen, weil er *unbequem* ist. Wer einen Eintrag hinzufügt, nennt die
Bedingung, unter der er wieder herauskommt.

Stand: graphVersion 181.

---

## Widersprüche

### `MOD-hooks` ist nach einer Datei benannt, die es nicht enthält
Das Modul heißt *„hooks.ts — HookSystem"*, seine beiden allozierten Funktionen
(`FUNC-emit-trajectory`, `FUNC-emit-update-event`) liegen aber in `src/emit.ts`. `src/hooks.ts` mit
seiner exportierten `HookSystem` ist an keinen Knoten gebunden.

Auflösen hieße entscheiden, was `MOD-hooks` eigentlich ist: das Hook-System oder der
Emissionspfad. Beides ist vertretbar, keins ist aus dem Code ableitbar.
**Kommt heraus, wenn:** jemand den Modulschnitt zwischen Hooks und Emission entscheidet — dann
zusammen mit dem `MOD-cli`-Schnitt (LCOM4=5) in einem Architektur-CR.

### `SC-04` verlangt ein Datenformat für einen bewusst formatlosen Fluss
`FLOW-round-scope` trägt in seiner eigenen Beschreibung *„kein festes Wire-Format —
informationeller Rundenkontext"*. `SC-04` fordert trotzdem eine SCHEMA-Bindung. Dasselbe gilt seit
CR-GC-393 für `FLOW-round-injection`.
**Kommt heraus, wenn:** `SC-04` einen Ausnahme-Schalter für informationelle Flüsse bekommt —
Regel-CR gegen contracts, analog zum `concept`/`external`-Muster.

### Strukturregeln verlangen Flüsse für fremden Code
21 Findings aus `R-02`, `R-30` und `R-31` sitzen auf Knoten mit `external: true` — Viewer,
`se-engine`, `graphcode-client`. Für fremden Code Wirkketten und Flüsse zu zeichnen, behauptet eine
Struktur, die dieses Repo nicht besitzt und nicht pflegen kann.
**Status:** als `CR-SM-257` vorgeschlagen, im Familie-Review **abgelehnt**.
**Kommt heraus, wenn:** die Ablehnung mit einer neuen Messung aufgemacht wird — so wie CR-SM-256
die Entscheidung aus CR-GC-375 aufgemacht hat.

### `RD-01` feuert auf eine Vorbedingung
`REQ-model-exchange-pre` beschreibt einen Zustand vor einem Lauf, keine Funktion. `RD-01` verlangt
trotzdem einen realisierenden FUNC. Eine Vorbedingung wird nicht *gebaut*, sie wird *geprüft*.
**Kommt heraus, wenn:** `RD-01` REQs mit `kinds:["precondition"]` aus der Grundgesamtheit nimmt.

---

## Unverhältnismäßiger Aufwand

### Vier Quelldateien ohne Aufrufer über eine Modulgrenze
`src/authoring-example.ts`, `src/merge.ts`, `src/testreport.ts`, `src/test-selection-audit.ts`
exportieren Symbole, die kein anderes Modul ruft. Nach dem Kriterium aus CR-GC-393 verdienen sie
keinen Knoten; ein Knoten ohne Leser kostet Pflege und sagt nichts.
**Kommt heraus, wenn:** eine dieser Dateien über eine Modulgrenze gerufen wird oder eine bislang
unerfüllte REQ realisiert.

### Kein Modul für testbare Skill-Kerne
`src/se-plan.ts` (`deriveImplPlan`) und `src/se-author-uc.ts` (`lintUc`) sind echte, getestete
TypeScript-Kerne hinter prompt-realisierten Skills. `MOD-skills` ist ausdrücklich
*„skills/prompts — agent-realisierte Funktionen"*; ein TypeScript-Kern gehört dort nicht hinein, und
ein eigenes Modul für zwei Dateien anzulegen ist mehr Struktur als Aussage.
**Kommt heraus, wenn:** ein dritter solcher Kern entsteht — dann trägt ein eigenes Modul sich selbst.

### `package-version.ts` wird über Modulgrenzen gerufen, sagt aber nichts
Das Kriterium aus CR-GC-393 träfe zu, der Knoten trüge aber keine eigene Verantwortung im System.
**Kommt heraus, wenn:** das Versionslesen Teil einer geprüften Zusicherung wird, etwa für die
Pin-Prüfung beim Update.

### `test-selection.ts` wäre ein Parallelpfad
`impactedTests` ist die Implementierung hinter `FUNC-resolve-tests-from-code`, dessen `realRef` auf
`harness.ts::testImpact` zeigt. Ein zweiter Knoten für dieselbe Verantwortung ist genau der
Parallelpfad, den die Guardrails verbieten.
**Kommt heraus, wenn:** entschieden wird, dass die `realRef` auf die Implementierung statt auf den
Einstieg zeigen soll — dann wandert die Bindung, es entsteht kein zweiter Knoten.

### `REQ-published-counts-match-code` hat keinen Erfüller im Produktivcode
Die Anforderung ist real und wird von `tests/claims.conformance.test.ts` scharf geprüft — aber
durchgesetzt wird sie ausschließlich von diesem Test. Es gibt keine Produktivfunktion, die man als
Erfüller eintragen könnte, ohne eine zu erfinden.
**Kommt heraus, wenn:** die Prüfung in den Produktivpfad wandert, etwa als Konformanz-Regel.

### 41× `CR-R04` auf geschlossenen Change-Requests
Nachträglich zu verkabeln, welche Funktion ein längst abgeschlossener CR berührt hat, ist
Archäologie. Gemessen: 40 `done`, 1 `dropped`, **0 offen**.
**Kommt heraus, wenn:** `@sigloch/contracts` 6.1.0 publiziert und der Range hier gebumpt ist —
`CR-SM-255` ist angenommen und implementiert, die Regel fällt dann auf 0.
