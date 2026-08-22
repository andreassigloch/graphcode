# CR-GC-399 — Eine Modelländerung braucht keine sieben Minuten

**Status:** done · **Angelegt:** 2026-08-22 · **Umgesetzt:** 2026-08-22 · **Umsetzung:** dieses Repo
**Dateien (6):** `package.json` · `scripts/model-test-set.mjs` (neu) · `scripts/verify-model.mjs` (neu) ·
`scripts/githooks/pre-commit` · `tests/verify-model.completeness.test.ts` (neu) ·
`tests/lockfile-sync.test.ts` (neu)

## Problem — gemessen

Diese Sitzung hat **sechs volle Testläufe** gekostet, zusammen rund **41 Minuten**, für Änderungen,
die keine einzige Quelldatei angefasst haben. 111 der 112 Testdateien können von einer Kante im
Graphen nicht betroffen sein.

`graph_tests` löst dieses Problem **nicht**, und das ist der Punkt: es leitet aus einem
**Code**-Changeset ab (`code → REQ → TEST`-BFS über `harness.testImpact`). Eine reine
Graph-Mutation hat keinen Code-Changeset, also auch keine Ableitung. Das Werkzeug beantwortet eine
andere Frage.

Die relevante Menge für eine Modelländerung ist klein und stabil: alles, was die committete
`docs/graph/graphcode.graph.json` liest — in diesem Repo **8 Dateien**, per Grep bestimmbar — plus
die Regel- und Ontologie-Tests.

## Änderung — drei Stufen, von auffindbar nach fest

**1. Skript.** `npm run verify:model` fährt genau diese Menge. Ein Wort statt sieben Minuten.

**2. Vollständigkeits-Test.** Ein Test greppt `tests/` nach `docs/graph` und vergleicht das
Ergebnis mit der Liste im Skript. Damit kann die Menge nicht veralten, wenn jemand einen neuen
Test schreibt, der den Graphen liest. Ohne diesen Test ist Stufe 1 eine Liste, die still falsch
wird.

**3. Spurwahl im Hook.** `scripts/githooks/pre-commit` weiß bereits, welche Dateien im Spiel sind —
er staged `docs/graph` und `docs/views` selbst dazu. Er wählt künftig die Spur nach dem Umfang des
Diffs:

| gestagter Diff | Spur |
|---|---|
| nur `docs/graph`, `docs/views`, `docs/cr`, `docs/*.md` | `verify:model` |
| irgendetwas unter `src/`, `tests/`, `scripts/` | volle Suite |

**Der Hook druckt, welche Spur er gewählt hat.** Das ist nicht Kosmetik: derselbe Hook hat in
dieser Sitzung dreimal still `docs/graph` und `docs/views` mit eingesammelt und damit einen
beabsichtigten Zwei-Commit-Schnitt zunichtegemacht. Erst `git config --get core.hooksPath` hat es
erklärt. Ein Hook, der schweigend entscheidet, kostet mehr Zeit, als er spart.

## Was dieser CR ausdrücklich nicht tut

Er baut `graph_tests` nicht um. Ein Modell-Modus dort wäre eine eigene Entscheidung — die
Testauswahl für Code-Änderungen funktioniert und soll nicht mit einer zweiten Semantik belastet
werden.

## Akzeptanzkriterien

- [ ] `npm run verify:model` läuft unter 60 Sekunden und deckt alle Tests ab, die den committeten
      Graphen lesen.
- [ ] Der Vollständigkeits-Test ist **rot gesehen**: ein neuer Test, der `docs/graph` liest und
      nicht in der Liste steht, lässt ihn fallen.
- [ ] Der Hook wählt die Spur nach Diff-Umfang und **schreibt die Wahl nach stderr**.
- [ ] Ein Commit, der `src/` anfasst, fährt weiterhin die volle Suite — kein Weg, sie zu umgehen.

---

## Ergebnis (2026-08-22)

### Die Prämisse des CR war falsch — zweimal, beide Male nach unten korrigiert

**„in diesem Repo 8 Dateien, per Grep bestimmbar".** Der Grep liefert **23** Dateien für
`docs/graph` allein; mit den Regel-/Ontologie-Tests sind es **31**. Genau deshalb steht das
Kriterium jetzt als Code (`MODEL_TEST_PATTERNS`) und nicht als Zahl in einem Dokument.

**„die volle Suite ist das Durchsetzungsmittel".** Der Anlass, die Spur überhaupt zu wählen, war
Zeitersparnis — aber die Prüfung der CI-Historie (15 Läufe, 7 rot) zeigt, dass die Fehler, die
tatsächlich beim Autor ankommen, mehrheitlich **gar nicht lokal entstehen**:

| Klasse | Läufe | lokal fangbar? |
|---|---|---|
| Perf-Spike reißt Wanduhr-Budget (33 416 / 40 391 / 44 633 ms gegen 30 000 ms) | 3 | **Nein** — der CI-Runner ist Faktor 1,05–1,41 langsamer als die Entwicklermaschine → [CR-GC-400](CR-GC-400-perf-spike-misst-das-modell.md) |
| `npm ci`: Lock nicht in sync mit `package.json` (EUSAGE) | 1 | **Nein** — lokal hat `npm install` es längst aufgelöst → **in diesem CR geschlossen** |
| `ETARGET`: `graph-view-edit@^0.5.0` nicht publiziert | 1 | Ja — `tests/distribution.test.ts` sieht es (Fremd-Install aus der Registry) |
| `distribution`: `@sigloch/graphify -> itself` | 1 | Ja — derselbe Test |

Zwei der drei Klassen sind also bereits gedeckt; nur der Lock-Drift war blind. Das hat den Zuschnitt
dieses CR verändert (Punkt 4 unten) und die Entscheidung über den Hook getragen.

### Was gebaut wurde

**1. `npm run verify:model`.** `scripts/model-test-set.mjs` ist die SSOT der Menge (INCLUDED +
EXCLUDED mit Grund + das Kriterium selbst), `scripts/verify-model.mjs` fährt sie.
**Gemessen: 32 Dateien, 243 Tests, 27 s** — gegen 390 s der vollen Suite. Die Menge läuft
`--fileParallelism=true` (seriell wären es 141 s), was zulässig ist, weil kein Test der Menge den
Repo-Store öffnet — siehe Punkt 2.

**2. Vollständigkeits-Test.** `tests/verify-model.completeness.test.ts` wendet dasselbe Kriterium
auf `tests/` an: jede modellrelevante Datei ist in der Spur **oder** mit Begründung ausgeschlossen
(> 40 Zeichen, sonst rot). Zusätzlich — nicht im CR gefordert, aber die Voraussetzung der
Parallelität — prüft er je Datei, dass ein Test mit echtem `repoRoot` ein eigenes `lockDir`
übergibt. Sonst konkurrierten zwei Testdateien parallel um den Kuzu-Store (CR-GC-218).
**Rot gesehen:** eine neue Testdatei, die `docs/graph` liest, lässt ihn fallen und wird namentlich
genannt (`expected [ 'tests/zz-redseen-probe.test.ts' ] to deeply equal []`).

**3. Spurwahl im Hook — ansagen, nicht fahren.** Der Hook wählt die Spur aus dem **finalen**
gestagten Diff (also nach seinem eigenen Auto-Staging) und schreibt sie nach stderr; er benennt
außerdem, welche Pfade er selbst dazugestellt hat — das war die eigentliche Zeitfresserei
(dreimal ein zunichtegemachter Zwei-Commit-Schnitt).

Beide Spuren geprüft:

```
[pre-commit] Spur: MODELL — nur docs/ im Diff.
[pre-commit]   -> npm run verify:model   (31 Dateien, ~45 s)

[pre-commit] Spur: VOLL — scripts/githooks/pre-commit liegt ausserhalb von docs/.
[pre-commit]   -> npm test          (113 Dateien, ~6.5 min)
```

**Abweichung vom AK, bewusst und vom Auftraggeber bestätigt:** *„Ein Commit, der `src/` anfasst,
fährt weiterhin die volle Suite — kein Weg, sie zu umgehen"* ist **nicht** als Ausführung im Hook
umgesetzt. Der Hook führte noch nie Tests aus; die Suite läuft in CI. Sie zusätzlich im pre-commit
zu fahren kostete jeden Code-Commit 6,5 Minuten und fängt **keinen** der drei Clean-Machine-Fehler
oben. Die Durchsetzung bleibt CI; der Hook macht die Wahl sichtbar. Alles Unbekannte im Diff zählt
als volle Spur — ein Hook, der im Zweifel abkürzt, wäre nutzlos.

**4. Lock-Drift-Test (Erweiterung des Auftrags).** `tests/lockfile-sync.test.ts` prüft die
Invariante, die `npm ci` als erste prüft: der Dependency-Spiegel in `packages[""]` des Locks ist
zeichengleich mit der `package.json`. **Rot gesehen** mit dem echten CI-Fall nachgestellt
(`package.json` auf `^6.0.0` anheben ohne `npm install`):
`@sigloch/graph-api-core: package.json=^6.0.0 lock=^5.1.0`.
*Ehrliche Grenze, im Test dokumentiert:* Range-Arithmetik wird nicht geprüft — es gibt kein `semver`
im Baum, und eine handgeschriebene Range-Auswertung wäre eine zweite Wahrheit neben npm.

### Verifikation

- `npm run verify:model`: **32/32 Dateien, 243/243 Tests grün, 27 s**
- `npm run build` grün · volle Suite **895/896**

**Der eine Fehlschlag ist kein Regress dieses CR** und liegt außerhalb: `tests/distribution.test.ts`
meldet `expected 0 to be greater than or equal to 5` — sein eigener Wächter *„the guard is worthless
if it walked an empty tree"*. Ursache: eine **parallel laufende Session** hat um 13:20 in diesem
Repo `npm run link:siblings` ausgeführt; `node_modules/@sigloch/*` sind seither Symlinks auf lokale
Arbeitskopien (u. a. ein unpubliziertes `contracts@6.2.0`), und der Walk des Tests überspringt
Symlinks (`entry.isDirectory()` ist bei einem Symlink `false`). Der Wächter arbeitet also korrekt —
er sagt „du prüfst gerade nichts". Dass der Test unter verlinkten Siblings seine Aufgabe nicht
erfüllen **kann**, ist ein eigener Befund → **[CR-GC-403](../open/CR-GC-403-distribution-unter-links.md)**.

**Scope-Leck, offengelegt:** `tests/verify-model.completeness.test.ts` gehört zu diesem CR, wurde
aber durch ein `git add -A tests` in den Commit von CR-GC-400 (`6585de0`) mitgezogen. Nicht
nachträglich getrennt, weil die Branch parallel von einer anderen Session beschrieben wird und ein
History-Rewrite dort Schaden anrichtet.
