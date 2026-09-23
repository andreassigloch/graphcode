# CR-GC-629: Die Schwelle steht zweimal, ein Knopf treibt zwei Verteilungen, und niemand misst sie laufend

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-505 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-505.json (Lane: code)

---

## Befund

Gemessen am 2026-09-23 über zehn Familiengraphen mit `moduleCrossings` — **derselben** Funktion,
die BW-02 und R-04 benutzen:

| Graph | FUNC | MOD | WB | BW≥5 | BW≥7 | BWmax | MOD≥5 | MOD≥7 | MODmax |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| graphcode | 125 | 8 | 19 | **16** | 13 | 19 | 6 | 6 | 18 |
| sigllm-v98 | 24 | 7 | 4 | 1 | 0 | 6 | 0 | 0 | 4 |
| opus5-0 (Lauf) | 42 | 17 | 7 | 2 | 0 | 6 | 5 | 0 | 6 |
| opus5-16 (Lauf) | 21 | 4 | 5 | 0 | 0 | 4 | 0 | 0 | 4 |
| bok | 15 | 4 | 4 | 0 | 0 | 3 | 0 | 0 | 3 |
| sigloch-modules | 11 | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| graph-view-edit | 13 | 5 | 1 | 0 | 0 | 2 | 0 | 0 | 2 |
| sigllm (prod) | 24 | 7 | 4 | 1 | 0 | 6 | 0 | 0 | 4 |
| graphcodedemo | 24 | 7 | 0 | 0 | 0 | 0 | 5 | 2 | 9 |
| moneyflow | 306 | 155 | 0 | 0 | 0 | 0 | 8 | 5 | 17 |

`WB` ist die Zahl der zerlegten FUNC — die Grundgesamtheit von BW-02.

**1. BW-02 folgt nicht der FUNC-Zahl.** moneyflow hat 306 FUNC und **null** Whiteboxen: die Regel
kann dort strukturell nicht feuern (deckt sich mit ITEM-2026-483). graphcode hat 19 Whiteboxen und
16 Befunde — 84 % seiner eigenen Grundgesamtheit. Alle neun anderen Graphen zusammen: 4 Befunde.
Was die Regel misst, ist nicht Größe, sondern ob überhaupt jemand einen `FUNC -compose->`-Baum
gebaut hat.

**2. Ein Knopf, zwei Verteilungen.** `boundaryWidth` treibt BW-02 (FUNC-Rand) und R-04 (MOD-Rand).
Auf 7 angehoben fällt BW-02 auf 13 Befunde — **alle in graphcode**, sonst null. R-04 behält bei 7
in drei Graphen Befunde, verliert sie aber im Lauf `opus5-0` vollständig (5 → 0). Mit einer Zahl
sind beide nicht zu kalibrieren.

**3. Die Zahl steht zweimal.** `contracts/se/policy.js:154` trägt `boundaryWidth {warning:5}`,
`graphcode.config.jsonc:49` dieselbe 5. `src/surface/measured.ts` benennt die Folge selbst:
*„Heute folgenlos, weil `graphcode.config.jsonc` zeichengleich mit `DEFAULT_METRIC_POLICY` ist.
Invertierend, sobald ein Budget wandert"* — zwei der vier Messaufbauten fallen bei fehlendem
`opts.graphcodeConfig` still auf Default-Budgets zurück. Wer die 5 im Repo ändert, misst ab da mit
zwei Wahrheiten.

## Zielbild

**Die Schwelle steht an genau einer Stelle: der Config.** Nicht im Regelcode (dort ist sie schon
heute nur `policy.boundaryWidth`, das bleibt), und nicht als zweite Kopie im Repo. Der
contracts-Default bleibt als benannter Startwert für Repos ohne Config — aber ein Repo MIT Config
erbt ihn nicht doppelt, sondern der Vergleich wird geprüft und gemeldet.

**Getrennte Knöpfe, bevor einer gedreht wird.** `boundaryWidth` wird `funcBoundaryWidth` (BW-02)
und `modBoundaryWidth` (R-04). Das ist eine contracts-Änderung und damit Familie-Sache
(Version-Bump, Drift-Lock L1/L2) — dieser CR bereitet sie vor und misst, er dreht nicht.

**Die Verteilung wird laufend gemessen, nicht je CR einmal.** Ein Skript im Repo, das über die
erreichbaren Familiengraphen dieselbe Tabelle wie oben erzeugt, plus ein Test, der sie gegen den
festgehaltenen Stand hält. Damit ist die Frage „steuert die Regel überhaupt?" jederzeit
beantwortbar statt einmal im Jahr.

**Was dieser CR NICHT tut: den Wert ändern.** Die vom Auftraggeber erwogene 7 wäre nach dieser
Messung für BW-02 vertretbar und für R-04 schädlich. Erst getrennte Knöpfe, dann die Zahl.

## Mitzuändern — und ein vierter Fundort, der beim Prüfen auffiel

- **`graphcode.config.jsonc`**: trägt die Schwelle, und zwar als einzige Kopie im Repo.
- **`src/surface/measured.ts`**: die zwei Aufbauten ohne `opts.graphcodeConfig`.
- **Skill `.claude/commands/se/top-level.md`** sagt zweimal **„max 5 blocks per level"** — in der
  Beschreibung und in Schritt 4. Das ist eine DRITTE Kopie einer Schwelle, und sie gehört zu einer
  anderen Regel: die Zerlegungsbreite urteilt RD-04 über `decompositionBreadth`, und die steht auf
  **9**. Der Autor lernt 5, das Gate misst 9. Kein Widerspruch (5 ≤ 9), aber eine Zahl im
  Fließtext, die keiner Policy folgt — wandert die Policy, wandert der Skill nicht mit. Der
  Kommentar in der Config sagt es selbst: *„7±2 ist die Doktrin (`se:top-level`), 9 ist ihre
  Obergrenze."* Die Doktrin gehört benannt, die Zahl nicht wiederholt.
- **Regelmatrix** `docs/research/regel-matrix.*`: **nicht betroffen** — geprüft, nicht angenommen.
  Ihre Spalten führen Regel, Stufe, Task, Phase, Dimension, Steuerregel, Skill, Fix, Folge-Regeln;
  eine Schwellenspalte gibt es nicht. BW-02 und R-04 stehen dort bereits als Steuerregeln.
- **`se-fmea.md` / `se/optimize.md`**: geprüft, nennen keine Zahl — `se-fmea` sagt ausdrücklich,
  dass es für Linearität und Importgrad *keine* Schwelle in `metricPolicy` gibt. So soll es sein.

## Akzeptanzkriterien

- [ ] Ein Test schlägt an, wenn `graphcode.config.jsonc` und `DEFAULT_METRIC_POLICY` auseinanderlaufen,
      ohne dass die Abweichung als bewusst markiert ist — heute stillschweigend gleich
- [ ] Die beiden Messaufbauten ohne `opts.graphcodeConfig` fallen nicht mehr still auf Default-Budgets;
      sie nennen ihre Policy-Herkunft oder brechen ab
- [ ] `scripts/randbreiten.mjs` erzeugt die Tabelle oben aus den erreichbaren Graphen, deterministisch
      und über `moduleCrossings` — kein zweiter Rechenweg
- [ ] Ein Test hält den gemessenen Stand fest und nennt im Fehlertext, welche Zahl gewandert ist
- [ ] `se/top-level.md` nennt die Doktrin, nicht die Zahl — und der Smeagol-Test (CR-GC-571) hält,
      dass ein Skill keine Schwelle behauptet, die keine Policy trägt
- [ ] Der Vorschlag „getrennte Knöpfe" liegt als Item für sigloch-modules vor (contracts-Änderung,
      Familie-Review) — nicht hier implementiert
- [ ] Testsuite grün

## Umfang

`graphcode.config.jsonc`, `src/surface/measured.ts`, `.claude/commands/se/top-level.md`,
`scripts/randbreiten.mjs` (neu), `tests/policy-herkunft.test.ts` (neu),
`tests/randbreiten.test.ts` (neu) — 6 Dateien, die harte Grenze.
