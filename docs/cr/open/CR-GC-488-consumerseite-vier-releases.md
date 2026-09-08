# CR-GC-488 — Die Consumer-Seite von vier SSOT-Releases ist nie nachgezogen worden

**Status:** offen · **Angelegt:** 2026-09-08 · **Art:** Migration (keine Grammatik-Änderung)
**Fundstelle:** Compliance-Nachmessung nach CR-SM-294..297, sigloch-modules
**Grundlage:** vollständiger Lauf von `npm test` in diesem Repo, 2026-09-08

---

## 1. Root Cause

**`npm test` ist rot: 43 von 1034 Tests, 22 von 130 Dateien** — und keiner der Fehlschläge ist ein
neuer Defekt. Alle rufen Symbole, Zahlen oder Antwortformen an, die `@sigloch/contracts` bzw.
`@sigloch/se-engine` in den letzten vier Releases **entfernt** haben. Die Familienregel „keine
parallelen Pfade" verlangt, dass eine Entfernung im SSOT bei allen Nutzern nachgezogen wird; hier
ist sie viermal hintereinander nur zur Hälfte vollzogen worden.

Sichtbar wurde es erst jetzt, weil dieses Repo `@sigloch/contracts` per **Symlink** auf die
Arbeitskopie zieht: die laufenden Hosts stammen aus der Registry und tragen alte Stände, während
Build und Suite gegen den frischen SSOT laufen. Dieselbe Konstellation wie in CR-GC-486 — und
dieselbe Ursache dafür, dass niemand es gemerkt hat.

## 1a. Warum es vier Releases lang still blieb — der Symlink schlägt den Bereich

Das ist nicht Nachlässigkeit, sondern eine fehlende Prüfung. `package.json` dieses Repos verlangt

    "@sigloch/contracts":      ">=9.1 <10"
    "@sigloch/graph-api-core": "^5.4.0"
    "@sigloch/se-engine":      "^1.4.0"

und `node_modules/@sigloch/*` sind **Symlinks in die Arbeitskopie**. Damit gilt der Bereich für
nichts: gebaut und getestet wird gegen contracts **10.0.0** — eine Version, die die eigene
Deklaration ausdrücklich **ausschließt**. Ein Major-Bump im SSOT löst hier keinen Installations-
fehler aus, weil gar nicht installiert wird.

Die Gegenprobe steht seit heute im Testlauf: `distribution` packt ein Tarball und installiert es in
ein fremdes Repo — genau dort greift der Bereich wieder, und es bricht:

    npm error notarget No matching version found for @sigloch/graph-api-core@^5.4.0

| Paket | verlangt | in der Registry | lokal |
|---|---|---|---|
| `@sigloch/graph-api-core` | `^5.4.0` | **5.3.0** | 5.4.0 |
| `@sigloch/contracts` | `>=9.1 <10` | 9.1.0 | **10.0.0** |
| `@sigloch/se-engine` | `^1.4.0` | **1.3.0** | 1.4.0 |

**Zwei Wahrheiten über denselben Stand, und die billigere gewinnt.** Der Symlink ist der billigere
Weg und umgeht die Prüfung, die am teureren hängt — dieselbe Klasse wie CR-GC-366, nur zwischen
Paketen statt zwischen Kanten. `distribution` ist der einzige Test, der die andere Wahrheit sieht;
er ist rot, und das ist die richtige Farbe.

## 2. Impact

**Der Bau war bis heute gebrochen.** `npm run build` scheiterte an
`src/kernel/conformance.ts:327` — `toOntologyGraph` hebt `asil` als typisierte Spalte heraus, und
CR-SM-294 hat das Feld aus der Ontologie entfernt. Das Repo, das die Werkzeuge baut, konnte sein
eigenes `dist/` nicht mehr erzeugen. **In diesem CR bereits behoben** (siehe §4), weil ohne `dist/`
kein Treiber und kein Host mehr startet.

Die vier Herkünfte der übrigen Fehlschläge, jeweils am fehlenden Symbol belegt:

| Herkunft | fehlt seither | betroffene Dateien | Tests |
|---|---|---|---|
| **CR-SM-286** — ND-Injektionsnaht entfällt, ND-01/ND-02 rechnen selbst | `setND01SimilarityMatrix`, `setND02SimilarityMatrix`, `withNDMatrices`, `clearNDMatrices` (contracts) sowie `computeND01Matrix`, `computeND02Matrix`, `injectNDMatrices` in `src/kernel/measure/nd-similarity.ts` | `nd-similarity`, `evaluation.near-duplicate` | 21 |
| **CR-SM-292** — Chebyshev statt ℝ⁶ | `targetFor`; dazu der Sechs-Vektor in der `graph_suggest`-Antwort | `target-profile`, `perf.advisory-roundtrip`, `mcp.suggest`, `suggest.ranks-the-delivered-edit`, `steering.*`, `executor.bestofn`, `arch.optimization-dry-run` | ~14 |
| **CR-SM-283** — BW-02 kommt neu | Hilfeeintrag für BW-02 | `help`, `help-content` | 2 (= CR-GC-487) |
| **CR-SM-294/295** — Katalog 72 → 63 | die Zahl in drei Artikeln und im Kanarienvogel | `claims.conformance` | 2 |

Dazu drei Fälle, die **nichts** mit dem SSOT zu tun haben und getrennt gehören:

- `conformance` — zwei echte Bindungsdrifts im Selbstmodell (§3),
- `lockfile-sync` — `package.json` und `package-lock.json` auseinander; `npm ci` bricht auf einer
  frischen Maschine ab, lokal merkt man nichts,
- `verify-model.completeness` — `tests/repository-style.spike.test.ts` steht weder in `INCLUDED`
  noch in `EXCLUDED` von `scripts/model-test-set.mjs`.

**Der Kanarienvogel hat gesungen, nur hat ihn niemand gehört.** `claims.conformance` stand auf
`engine rules=73`, der Katalog auf 72 — die Zahl war schon **vor** diesem Schnitt daneben. Der Test
ist ausdrücklich als „canary for a contracts bump" geschrieben; er hat funktioniert. Was fehlte,
war jemand, der die rote Suite gelesen hat.

## 3. Das Selbstmodell ist grammatikalisch sauber, aber zweimal falsch gebunden

Gegen den lebenden Store gemessen (`rules_get_violations`, `severity: error`), nach der
Config-Reparatur aus CR-GC-486:

    RC-01  FUNC-nd-similarity — realRef.symbol 'injectNDMatrices' ist in
           'src/kernel/measure/nd-similarity.ts' nicht deklariert
    RC-02  TEST-applied-suggestion-moves-target — testRefs-Datei
           'tests/steering.architecture-causality.test.ts' existiert nicht

**Null R-18-Verstöße** — kein einziges illegales Trace-Paar über 669 Elemente und 1823 Traces. Die
Grammatik hält; gebrochen ist die Bindung an den Code, und beide Brüche sind dieselbe Migration wie
oben: `injectNDMatrices` ist mit CR-SM-286 verschwunden, die Testdatei heißt seit einer Umbenennung
`tests/steering.steer-causality.test.ts`.

## 4. In diesem CR bereits erledigt

1. **`asil` aus `toOntologyGraph`** (`src/kernel/conformance.ts`) — der Bau geht wieder. Ein Graph,
   der das Feld noch trägt, behält es im freien `attributes`-Sack; es ist nur keine Ontologiespalte
   mehr.
2. **Regelzahl 73 → 63** in `docs/articles/03…`, `04…`, `06-claims.md` und in der Kanarienliste von
   `tests/claims.conformance.test.ts`.

## 5. Fix-Vorschlag — vier Vorgänge, nicht einer

Die CR-Größenregel (max. 6 Dateien) verbietet ein Sammel-CR. Vorschlag in dieser Reihenfolge, weil
jede Stufe die nächste messbar macht:

1. **ND-Naht** — `tests/nd-similarity.test.ts` und `tests/evaluation.near-duplicate.test.ts` auf die
   selbstrechnenden ND-Regeln umschreiben; `src/kernel/measure/nd-similarity.ts` behält nur noch
   den Hinweis-Pfad (`duplicateHits`/`renderDuplicateHints`), der nie eine Regel war. Danach
   `FUNC-nd-similarity` neu binden (RC-01).
2. **ℝ⁶-Rest** — `targetFor` und den Sechs-Vektor aus Tests und Erwartungen entfernen, gegen
   `steerAdvisory`/Chebyshev stellen. Größter Block nach der ND-Naht.
3. **Hilfeschicht** — CR-GC-487, jetzt mit Zahl: BW-02 fehlt, und der Katalog ist um neun Regeln
   kleiner.
4. **Hausmeisterei** — Lockfile, Modell-Spur, `TEST-applied-suggestion-moves-target` neu binden.

**Und die eigentliche Lehre:** dieses Repo hat vier SSOT-Releases lang eine rote Suite getragen,
ohne dass es jemandem aufgefallen ist. Ein Familien-Release, das einen Consumer bricht, muss den
Consumer beim Namen nennen — `bok/docs/governance/USAGE-MATRIX.md` weiß, wer welchen Export zieht.
Das gehört an den Release-Zug, nicht in diesen CR.
