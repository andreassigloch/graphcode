# CR-GC-449 — Das Trajektorien-Leck: der Feed gehört zu SEINEM Log

**Status:** **ABGESCHLOSSEN** (2026-08-27) · **Angelegt:** 2026-08-27 · **Typ:** Bugfix (Datenverlust) + Messung
**Ausgangs-Commit:** `0214d38` (CR-DRAFT-GC-448)

## Befund

Am 2026-08-27 gingen rund **250 Modellelemente** durchs Gate (CR-GC-445: 23 FLOW-Merges + 9
`update-node` · CR-GC-446: 108 `allocate` umgehängt, 37 `satisfy`, 82 CR-Relationen, 16 MOD
gelöscht · CR-GC-447: 76 + 4 `update-node`). Danach hatte `.graphcode/trajectory.jsonl`
**zwei Zeilen**. Die zwei Zeilen waren vollständig und korrekt gestempelt — die CR-GC-434-Stempel
funktionieren also. Es kam nur fast nichts an.

Die naheliegende Lesart („der Feed wächst zu langsam") ist falsch. Der Feed wurde **überschrieben**:
die zwei Zeilen tragen `opCounts: 76` und `graphVersion: 1|2` — das ist exakt CR-GC-447 aus einer
frischen Temp-Store-Session. Kein Tröpfeln, ein Totalverlust.

## Root Cause (5× WHY)

1. **Warum zwei Zeilen?** Weil die Datei vollständig neu geschrieben wurde — aus einem Log mit zwei
   Einträgen.
2. **Warum aus einem Log mit zwei Einträgen?** Weil die schreibende Session auf einem **Temp-Kuzu-Store**
   lief, und das Operations-Log liegt **beim Store** (`FileOperationsLog(harness.getStoreDir())`,
   CR-GC-232). Ihr Log war frisch.
3. **Warum landete das im echten Repo?** Weil `materializeTrajectory` sein Ausgabeverzeichnis nicht
   vom Log nahm, sondern vom **repoRoot**: `join(harness.getRepoRoot(), GRAPHCODE_DIR)`. Die Session
   hatte den echten repoRoot (das Muster `new GraphCodeHarness(config(REPO_ROOT), storage, undefined,
   { lockDir: tmp })`).
4. **Warum sind die zwei Anker verschieden?** Weil sie aus zwei CRs stammen: CR-GC-232 verankerte das
   Log **pro Store**, CR-252 den Feed **pro Repo**. Niemand hat sie danach wieder gekoppelt.
5. **Warum fiel es nie auf?** Weil beide Anker im Normalfall **dasselbe Verzeichnis** sind
   (`createHarness` legt den Store nach `<repoRoot>/.graphcode`). Kein Test fuhr je einen Write über
   eine Harness, deren Store woanders liegt — die vorhandenen `lockDir`-Tests lesen nur oder
   reseeden.

Der Widerspruch stand schon wörtlich im Code: der Doc-Kommentar von `getStoreDir()` sagt *„Per store,
never per repo: a temp-store harness must not touch the repo's live `.graphcode`."* Genau das tat der
Feed — bei **jeder** Mutation, mit Vollüberschreibung.

## Fix

### 1. Der Feed liegt neben seinem Log (`src/surface/tool-context.ts`)

`materializeTrajectory(auditLog, harness.getStoreDir())` statt `…, join(getRepoRoot(), GRAPHCODE_DIR))`
— an beiden Aufrufstellen (`recordAudit`, `recordPreview`).

Damit gilt `trajectory.jsonl === project(log)` **per Konstruktion** statt per Zufall, und die
Zusicherung von `getStoreDir()` gilt auch für den Feed. In der Produktion ist die Änderung ein
**No-Op**: `createHarness` setzt `lockDir = dirname(<repoRoot>/.graphcode/kuzu)`, also dasselbe
Verzeichnis.

### 2. Der Rest-Verlust wird gezählt, nicht dokumentiert (`src/projections/trajectory.ts`)

Was der Fix **nicht** kann: eine Session, die auf einem eigenen Store arbeitet, schreibt ihren Feed
jetzt korrekt neben ihr Log — und der ist mit dem Temp-Verzeichnis weg. Dasselbe gilt für die seit
CR-252 dokumentierte Lücke „rohes `harness.mutate()` am Tool-Layer vorbei" (im Baum: `bootstrap()`).
Beides ist prinzipiell nicht feedbar, ohne dem Gate eine zweite Audit-Fläche zu geben — was verboten
ist.

Also wird es **gemessen**. `countUnfedMutations(repoRoot)` vergleicht zwei Zähler, die dasselbe
Ereignis sehen müssten:

| Zähler | Anker | zählt |
|---|---|---|
| `EXPORT_PENDING.versionsBehind` (CR-GC-217/426) | **repoRoot** | jede angewendete Gate-Mutation — egal welcher Store, welcher Prozess, welcher Aufrufpfad (`harness.mutate()` setzt die Marke selbst) |
| Feed-Zeilen mit `operation:'mutate'`, `applied:true`, `ts >= since` | repoRoot | was der Tool-Layer aufgeschrieben hat |

Die Differenz ist exakt „angewendet, aber nie gefeedet". Kein dritter Schreibpfad, keine zweite
Fläche: beide Artefakte existieren bereits, sie wurden nur nie gegeneinander gehalten.

### 3. Es fällt beim Export auf (`src/projections/export.ts`)

`graph_export` fragt die Differenz **vor** `clearExportPending()` ab (danach ist der Zähler weg) und
liefert `unfedMutations: N` im Report, sobald N > 0, plus eine stderr-Warnung. Der Export ist die
richtige Stelle: dort kommen Modell und Repo ohnehin zur Deckung, und jede Temp-Store-Session muss
dort vorbei, um `docs/graph/` zu aktualisieren.

## Was NICHT gefixt wurde (bewusst)

- **`graph_reseed` / `graphcode rewind` / `import-code`** stempeln nicht — richtig so: das sind
  **Ladevorgänge** (Store ← committete SSOT), keine autorisierten Mutationen. Sie räumen die Marke ab,
  weil der Store danach der SSOT entspricht.
- **`bootstrap()`** (exportierte API, rohes `harness.mutate()`, kein Audit) bleibt ohne Feed — wird
  aber ab jetzt von §2 gezählt.
- **Historie der Temp-Store-Sessions von CR-445/446/447** ist verloren; ihre Logs lagen in
  Temp-Verzeichnissen. Nicht rekonstruierbar.

## Abnahme

**Red-first** — `tests/trajectory.feed-anchor.test.ts`, vier Tests, vor dem Fix alle vier rot mit
genau dem Produktionsbild (3 Bestandszeilen → 1 fremde Zeile):

1. eine Temp-Store-Session überschreibt den Repo-Feed nicht,
2. ihr Feed liegt neben ihrem Log, gleiche Länge (Projektionsidentität),
3. `countUnfedMutations` = 3 nach 3 Mutationen über den leckenden Pfad, und `graph_export` meldet
   `unfedMutations: 3`,
4. **kein Fehlalarm** im Normalfall (Store == `repoRoot/.graphcode`): 0, und `unfedMutations` fehlt
   im Report.

**Messung (N = 3 Mutationen über den leckenden Pfad):**

| | Repo-Feed | Feed beim Store | Sichtbarkeit |
|---|---|---|---|
| vorher | 3 Bestandszeilen → **1** (Verlust) | 0 | keine |
| nachher | 3 Bestandszeilen, unberührt | **3** | `unfedMutations: 3` beim Export |

**Suite:** 20 rot vor dem CR (2 Publish-Pending + 18 contracts-10-Fixture-Kollateral), 20 rot danach —
dieselben; 983 → 987 grün (+4 neue). `npm run build` grün.

**Reparatur nebenbei:** `.graphcode/trajectory.jsonl` des Repos aus dem eigenen, intakten
`audit.jsonl` neu projiziert — **2 → 301 Zeilen**. Der Feed ist eine Projektion, das ist kein
Schreibvorgang gegen die SSOT.

## Offen

- Der laufende Host (PID 6226) trägt den alten Code; der Fix greift erst nach Neustart/Publish.
- Ob `unfedMutations > 0` auch den **pre-commit-Hook** blocken soll (heute nur Warnung im Export),
  ist eine Auftraggeber-Entscheidung — es würde einen Commit nach einer Temp-Store-Session
  verhindern, was manchmal genau der Arbeitsmodus ist.
