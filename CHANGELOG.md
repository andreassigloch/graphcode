# @sigloch/graphcode

## 0.13.0 — 2026-08-15

### Changed (BREAKING) — auf die Familie 4.x nachgezogen

**Jede bestehende `graphcode.config.jsonc` braucht vier Felder mehr.** `MetricPolicySchema` hat
seit contracts 4.0.0 `crossingFlows`, `riskRpn`, `moduleSize` und `apTable` als Pflichtfelder.
Fehlen sie, bricht der Start ab — das ist CR-GC-329s Fail-Fast, das korrekt anschlaegt, kein
neuer Defekt. Ein stiller Default waere die schlechtere Antwort.

```jsonc
"crossingFlows": { "warning": 3 },                          // vorher inline `count > 2`
"riskRpn": 100,                                             // FM-03, vorher inline
"moduleSize": { "large": 12, "coupled": 8, "crossings": 2 },// R-04, vorher 8/12/2 inline
"apTable": null                                             // gehoert NICHT in diese Datei
```

`apTable` bleibt `null`: die lizenzierte AIAG-VDA-Tabelle darf nicht in eine eingecheckte Datei.
Wer eine Lizenz hat, legt sie nach `.graphcode/ap-table.json` (gitignored).

### Changed — `testRefs` statt `testRef`: eine Abnahme, n Testdateien (CR-GC-338)

Die Ontologie hat das Attribut ersatzlos umbenannt (CR-SM-231). graphcode benutzt 1:n jetzt
wirklich, statt es nur zu akzeptieren:

- `graph_tests` nimmt **alle** Dateien einer Abnahme in den selektiven Lauf.
- `graph_export` scaffoldet **je Eintrag** einen Stub — sonst bliebe die zweite Datei ein Phantom.
- `graph_realize` **ergaenzt** einen Eintrag, statt die anderen zu ueberschreiben.
- `graph_test_ingest` schreibt `result`/`ranAt` **an den passenden Eintrag** (CR-SM-231b): ein
  Lauf ueber eine von zwei Dateien faerbt nur diese. „Einer rot, einer gruen" ist damit
  ueberhaupt erst darstellbar.
- Der Pruefreport aggregiert **streng**: jeder Eintrag muss `passed` sein; ein Eintrag ohne
  Ergebnis ist `not-run` — nicht gelaufen ist nicht gruen.

**Bestehende Graphen muessen migriert werden.** Ein Knoten mit `testRef` faellt R-19 zur Last,
und R-29 (neu, `error`) meldet jede Testdatei, die von zwei Abnahmen beansprucht wird.

### Changed — `weights` faellt aus `graph_next_step` (CR-GC-336)

Der D1–D6-Vektor wurde ausgegeben, aber niemand handelte auf ihm (CR-SM-237): er gewichtete
keinen Kandidaten und verschob keine Auswahl. Die Fokus-Dimension steht in `nextStep` — sie war
die einzige Information, die der Vektor je trug. Das Zielprofil-`weights` aus
`.graphcode/target-profile.json` ist eine andere Groesse und bleibt.

### Fixed — eine Zahl fuer „ist diese Dimension zu schwach?" (CR-GC-335)

`focusThreshold` aus der Config bekommt endlich seinen Konsumenten: `harness.getFocusThreshold()`
reicht ihn an `computeReadiness` und an die Fokuswahl durch. Der Default-Parameter
`threshold = 0.8` in `generate.ts` faellt, ebenso der Zod-Default im `graph_generate`-Schema —
der Override bleibt, sein Fallback ist jetzt der Config-Wert.

**Nachgemessen:** `ms` auf dem eigenen Graphen steigt von **0 %** (97 Verstoesse / 21 anwendbar)
auf **44 %** (97 / 172). Identische Verstoesse — nur der Nenner hat sich korrigiert (CR-SM-235).

### Added — R-29 im Hilfe-Katalog

Testdatei-Exklusivitaet, `error`: jede Datei gehoert zu hoechstens einem TEST. Eine doppelt
beanspruchte Datei macht Gate-Zahlen falsch — der TRR-Gate zaehlt dieselbe Evidenz doppelt.
