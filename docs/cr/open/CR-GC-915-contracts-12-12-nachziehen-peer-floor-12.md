# CR-GC-915: contracts 12.12 nachziehen: Peer-Floor >=12.12, metricPolicy.needNameTerms (ohne Gate/Ziel), UC-07 in se:author-uc nennen (Folge CR-GC-881, CR-SM-434)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1305 (finding)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1305.json (Lane: code)

---

## Befund

contracts 12.12.0 (CR-SM-434) bringt die Warnung UC-07 und macht `needNameTerms` zum Pflichtfeld
von `MetricPolicy`. graphcode prueft `graphcode.config.jsonc` gegen dieses Schema. Alle 14 Configs
der Familie (graphcode, agentdiary-local*, todo-*) tragen das Feld nicht. Mit 12.12 im Baum wirft
`loadGraphcodeConfig` einen `ConfigError`, und der Host startet nicht. Gemessen am Build von
contracts 12.12: eine Config ohne das Feld wird abgelehnt.

## Zielbild

1. `graphcode upgrade` im Schritt `--refresh-only` (intern `scaffold(update)`, gefahren vom neu installierten Build)
   traegt jedes Feld aus `DEFAULT_METRIC_POLICY`, das in `metricPolicy` fehlt, mit dem Startwert
   ein. Gesetzte Werte und Kommentare bleiben zeichengleich. Geprueft wird vor dem Schreiben.
2. `upgrade --check` zaehlt ein fehlendes Feld als Drift und nennt es unter „Artefakte".
3. graphcode setzt seine eigene Liste ohne Gate und Ziel: beide sind Fachbegriffe des Produkts
   (2 UC/FCHAIN-Namen mit Gate, 1 mit Ziel).
4. Peer-Floor `@sigloch/contracts >=12.12 <13`. Auf Wunsch von CR-GC-914 im selben Zug:
   `@sigloch/graph-view-edit >=0.21 <1`.
5. `se:author-uc` nennt UC-07 und die Wortliste (Version 4).

## Dateien

- `src/surface/config-nachziehen.ts` (neu), `src/surface/scaffold.ts`, `src/surface/upgrade.ts`
- `graphcode.config.jsonc`, `package.json`, `package-lock.json`
- `.claude/commands/se/author-uc.md`
- `tests/config-nachziehen.test.ts` (neu), `tests/upgrade.test.ts`, `tests/config.test.ts`

## Umfang im Modell

`relation` auf REQ-repo-update, FUNC-upgrade, FUNC-load-config, FUNC-author-uc. REQ-repo-update
nennt den Nachtrag; TEST-upgrade bindet `tests/config-nachziehen.test.ts` zusaetzlich.

## Akzeptanz

- Eine Config ohne `needNameTerms` laedt nach `graphcode upgrade --refresh-only`; ohne den Schritt wirft sie.
- `upgrade --check` meldet „Config ohne metricPolicy.needNameTerms" und schreibt nichts.
- Volllauf gruen gegen contracts 12.12.

## Ergebnis

- Umgesetzt wie im Zielbild, Commits 0827fead, 859d4a6e und der Abschluss-Commit.
- Volllauf gegen contracts 12.12.0 aus der Registry: 213 Dateien, 1769 Tests gruen, Schlupf 0.
- Smoke: Die Config aus agentdiary-local-3 laedt ohne Nachtrag nicht. Nach
  `graphcode upgrade --refresh-only` mit dem gebauten CLI laedt sie, mit dem Startwert der Familie.
  Alle uebrigen Zeilen sind zeichengleich.
- Zug Stufe 1 publiziert: contracts 12.12.0, se-engine 3.0.4 (Klassen fuer UC-07, BQ-03).
- Mitgezogen auf das neue contracts: Regelzahl in zwei Artikeln (67 auf 68), Katalog-Luecke
  (BQ-03 statt BQ-06), Versions-Pin von se:author-uc.
