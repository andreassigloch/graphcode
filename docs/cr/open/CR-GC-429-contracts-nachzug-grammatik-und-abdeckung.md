# CR-GC-429 — Nachzug auf contracts 9.1.0: Grammatik-Härtung, Abdeckungszahl, Verzeichnisse

**Status:** offen — Release-Zug vorbereitet; §1 und der io-Teil von §3 sind **erledigt** (2026-08-26).

**Stand 2026-08-26:** §1 komplett (preflight mit kinds-Auflösung Graph ∪ Batch,
nd-similarity/generate/help-content bereinigt; parseFormatE-resolveKinds entfiel —
graphcode nutzt graph-api-cores FormatECodec, der nur Typ-Paare prüft, die
where-Durchsetzung trägt R-18 im Gate) · §5 komplett (null-sichere Rangfolge in
generate/steering/steering-snapshot/report, null rankt oben) · §3 io-Teil komplett
(24 `ACTOR -io-> UC` migriert, Commit 485df1c: 13 Paare waren schon getragen, 7
Ersatzkanten auf bestehende FLOWs, 3 Paar-Assoziationen ersatzlos entfallen
[graphify→code-quality, vibe-coder→reduced-llm/-efficient-testing], UC-loop-closure
= der eine dokumentierte UC-02-Fall) · Testbasis grün (952 Tests; distribution +
Lock-Spiegel bis zum Publish geskippt, CR-GC-411). **Offen:** §2 (importCoverage
durchreichen), §3-Rest (satisfy-kinds-Schuld, drei `negative`-REQs), §4 (Verzeichnisse).
**Angelegt:** 2026-08-26 · **Herkunft:** die Konsumenten-Hälften der contracts-CRs CR-SM-266
(Grammatik-Härtung), CR-SM-268 (Abdeckung + Ablage) und CR-SM-270 (Readiness), entschieden im
sigloch-modules-Repo am 2026-08-25/26.

Die Regeln leben im Paket, nicht in diesem Repo: **nichts hiervon ist vor dem Release machbar.**
Die contracts-Seite ist gebaut und committet; hier steht ausschließlich, was graphcode schuldet.

**Führender CR für die RC-05-Prüflücke:** [CR-GC-425](../done/CR-GC-425-zwoelf-dateien-die-rc-05-nicht-sieht.md)
(Befund, 2026-08-26 geschlossen) ist hierher konsolidiert — §2 trägt das Durchreichen der
Abdeckungszahl, §4 das Aufräumen, das die zwölf Dateien tatsächlich zuordnet.

**Was sich im Paket geändert hat:** ONTOLOGY 7.0.0 → 8.0.0, META_MODEL 2.0.0 → 4.0.0,
RULES 6.3.0 → 9.1.0. Fünf Trace-Patterns entfallen (`ACTOR -io-> UC`, `MOD -io-> MOD`,
`MS -compose-> MS`, `FLOW -io-> UC`, `SESSION -produces-> *`), mit ihnen der TraceType `produces`,
der ElementType `SESSION` und `Trace.category`. Die vier satisfy-Patterns tragen neu ein
`where`-Prädikat auf `REQ.kinds`. `FUNC -allocate-> MOD` und `FLOW -relation-> SCHEMA` haben eine
Obergrenze `[0..1]`, durchgesetzt als zweites Bein von R-18.

---

## 1 — Die Nachzüge, ohne die der Autorenpfad bricht

Nach dem Bump zieht das Gate die neue Matrix automatisch. **Nicht** automatisch sind:

- **`src/preflight.ts` und `src/se-author-uc.ts`** — beide rufen `isValidTrace`. Die Signatur
  nimmt jetzt optional `sourceKinds`/`targetKinds`; wer sie nicht mitgibt, bekommt für die vier
  satisfy-Patterns **`false`**, weil ein `where` ohne deklarierte Kinds ablehnt. Ohne diesen
  Nachzug lehnt der Autorenpfad jede satisfy-Kante ab. Das ist Absicht („unentscheidbar" darf
  nicht „erlaubt" heißen), verlangt aber, dass der Aufrufer die Kinds des Zielknotens beschafft.
- **Der Format-E-Weg** braucht die neue Option `resolveKinds` in `parseFormatE` — sonst sieht der
  Parser die `kinds` **bestehender** Knoten nicht (Knoten, die derselbe Text anlegt, trägt er
  bereits selbst nach, `@kinds` steht dort in denselben Zeilen).
- **`src/nd-similarity.ts`** — Typliste enthält `'produces'`.
- **`src/generate.ts`** — Prompt nennt „FLOW relation SCHEMA **bzw. produces**", stale.
- **`src/viewer/help-content.ts`** — Eintrag für den Elementtyp `SESSION`.

## 2 — `importCoverage` durchreichen

`@sigloch/contracts/se` exportiert neu `importCoverage(graph, facts)` →
`{ endpoints, assigned, unassigned: string[] }`. Das Feld gehört in `rules_evaluate`
**neben `skipped`** (`src/tools/report.ts`, `evaluateAll`) — dieselbe Frage, dieselbe Antwortform
wie CR-GC-398.

**Getrennt halten, nicht zusammenlegen:** `skipped` heißt „diese Quelle wurde **gar nicht**
ausgewertet" (kein lesbarer `repoRoot`); die Abdeckung heißt „ausgewertet, und ein Teil fällt
trotzdem durch". Zusammengelegt wären „nicht gelaufen" und „gelaufen, aber blind" wieder
ununterscheidbar — genau der Fehler, den CR-GC-398 behoben hat.

**Warum das eigenständig zählt:** Die Liste der nicht zugeordneten Dateien hing bisher als
Textanhang an der Meldung eines *anderen* Befundes und verschwand mit ihm. CR-GC-423 hat die drei
RC-05-Drift-Befunde geschlossen — und damit war die Liste weg; sie musste in CR-GC-424/425 von
Hand rekonstruiert werden. Der Anhang ist in contracts jetzt ersatzlos entfallen.

**Gemessen am Checkout (2026-08-26): 14 von 73 Import-Endpunkten unzugeordnet.** Nicht mit den
„12 von 178" aus CR-GC-425 gleichsetzen — dort waren es Kanten, hier verschiedene Dateien, und der
Graph steht mehrere Versionen weiter. Inhaltlich deckt sich die Liste: alle fünf dort benannten
reinen Zod-Vertragsdateien (`gve-session-`, `schema-fingerprint-`, `target-profile-`,
`lock-owner-contract`, `test-selection`) stehen drin, ebenso `src/evaluation.ts` und
`src/testreport.ts`.

## 3 — Migrationsschuld abtragen

graphcode trägt aus der Grammatik-Härtung, gemessen am Selbstmodell:

| Klasse | Anzahl |
|---|---|
| io-Kanten der entfallenen Patterns (v. a. `ACTOR -io-> UC`) | **24** |
| satisfy-Kanten auf REQs **ohne** `kinds` | **43** |
| satisfy-Kanten mit **unpassendem** kind (MOD/SYS auf functional, FUNC auf non-functional) | **44** |
| UC-02 (nach dem Umbau auf Erreichbarkeit) | **1** |
| REQs ohne `kinds` (BQ-07, warning) | **23** |

Alles unter Delta-Semantik: unberührter Bestand blockiert keine Mutation, aber jeder angefasste
Knoten zieht seine Schuld nach.

**Dazu die drei `negative`-REQs** — der ReqKind-Wert ist entfallen. Zielwert je REQ, nicht
pauschal: `REQ-dashboard-readonly` und `REQ-readonly-bridge` → `non-functional`
(Architektur-Constraint an der Modulgrenze), `REQ-no-extraction` → `functional`. Rest-Reject
danach: genau einer, `FUNC-serve-sse -satisfy-> REQ-readonly-bridge` — löschen oder auf die
FCHAIN heben.

## 4 — Aufräumen: ein Modul, ein Verzeichnis

**Befund:** 75 `.ts`-Dateien unter `src/`, davon **58 flach direkt darin**, drei
Unterverzeichnisse (`tools/`, `viewer/`, `views/`). **13 von 17 MODs** haben ihre Dateien
ausnahmslos flach liegen — die Modulstruktur existiert ausschließlich im Graphen, nicht auf der
Platte.

**Die Entscheidung dazu fiel gegen das Attribut:** `MOD.path` bleibt einwertig (`string`). Ein
mehrwertiges `path` hätte die unaufgeräumte Ablage in den Vertrag geschrieben und die MOD-Sicht in
eine handgepflegte Aufzählung verwandelt, die man sich zusammenklauben muss. Zusatzargument aus
derselben Auslieferung: `FUNC -allocate-> MOD [0..1]` ist jetzt Grammatik — eine Funktion wohnt in
genau einem Modul. Ein Verzeichnis je Modul lässt das Dateisystem dieser Grammatik zustimmen.

**Zwei Schritte, die zusammen laufen müssen:**
1. 58 Dateien in ~13 Modulverzeichnisse verschieben, Importe nachziehen.
2. `realRef.file` **jeder** betroffenen FUNC im Graphen nachziehen — **über das Gate**, nicht von
   Hand. Sonst schlagen RC-01/RC-02 (Dateiexistenz) reihenweise auf tote Pfade an.

Kein Verzeichnis brauchen `MOD-completeness`, `MOD-dashboard`, `MOD-repo-root` (keine eigenen
Dateien; `MOD-dashboard` ist seit CR-GC-401 ein Nachbarpaket). `MOD-metrics-engine` bindet extern
nach sigloch-modules und bleibt liegen. `MOD-skills` liegt unter `.claude/commands` bereits
strukturiert.

**Abnahme:** `importCoverage` meldet danach `unassigned: []` (heute 14).

## 5 — Readiness: `score` kann `null` sein

`ReadinessScore.score` ist jetzt `number | null`, dazu neu `coreApplicable`. `null` heißt „nicht
messbar", nie 0 % — eine Dimension, deren Kernmenge leer ist (moneyflow: 0 UC bei 306 FUNC meldete
vorher `uc: 0,997, ready: true`).

**Was das vom Konsumenten verlangt:** eine **null-sichere Rangfolge**. Ein naiver
`a.score - b.score`-Komparator ergibt mit `null` NaN und sortiert dann gar nicht. Nicht messbar
rankt **oben**, nicht unten — „existiert noch gar nicht" ist der dringendere Hinweis als „gemessen
schwach". Betrifft `graph_next_step` und die Dashboard-Kachel (dort „nicht begonnen" statt
Prozentzahl).

## Reihenfolge

Release → **1** (Nachzüge, sonst bricht der Autorenpfad) → **2** (Anzeige) → **5** (Ranking)
→ **3** (Schuld) → **4** (Aufräumen).

Danach ist die contracts-seitige Folge-Arbeit dran (CR-SM-271: R-30 auf `error`, SC-04 entfällt
zugunsten von `FLOW -relation-> SCHEMA [1..1]`) — sie setzt voraus, dass 3 und 4 erledigt sind.

## Nicht Teil dieses CR

Der vorbestehende `BQ-06`-Crash auf einem REQ ohne `description` (aufgefallen an `kadjar`, 305
REQs aus Doc-Import): ein Regellauf stirbt dort komplett, statt einen Befund zu melden. Liegt in
contracts, eigener CR.
