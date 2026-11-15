# CR-GC-937: Config: metricPolicy und focusThreshold duerfen fehlen

**Typ:** aus Item ITEM-2026-1363 (bug)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1363.json (Lane: code)

---

## Befund

CR-GC-935 legt `knowledgeFile` in `graphcode.config.jsonc`. `GraphcodeConfigSchema` verlangt dort
`metricPolicy` und `focusThreshold`. Fehlen sie, wirft `loadGraphcodeConfig`, und der Host startet nicht
(gesehen am 2026-11-15 in aise-bok mit einer Config, die nur `knowledgeFile` trägt).

Nur graphcode selbst hat eine Config. Sieben Repos der Familie laufen ohne Datei mit den Standardwerten
(`policySource: "default"`). Sie können den Schlüssel so nicht tragen, ohne alle Schwellen festzuschreiben.

## Entscheidung des Autors (2026-11-15)

`metricPolicy` und `focusThreshold` dürfen in der Datei fehlen. Für ein fehlendes Feld gilt der Standardwert,
und die Herkunft sagt das, wie heute bei fehlender Datei. Ein vorhandenes, schemawidriges Feld bricht weiter ab.

## Auftrag

1. Beide Felder im Schema optional; `loadGraphcodeConfig` setzt für ein fehlendes Feld den Wert aus `DEFAULT_CONFIG`.
2. Die Herkunft bleibt ehrlich: Fehlt `metricPolicy` in der Datei, meldet `graph_metrics` `policySource: "default"`.
3. `upgrade` meldet bei fehlendem `metricPolicy` keinen Mangel mehr („von Hand zu prüfen“ entfällt).
4. Kein zweiter Weg: Die Standardwerte stehen weiter nur in `DEFAULT_CONFIG` bzw. contracts.

## Abnahme

- [x] Test zuerst rot: Eine Config nur mit `knowledgeFile` lädt, liefert die Standardwerte und `policySource: "default"`.
- [x] Eine Config mit `metricPolicy` und ohne `focusThreshold` lädt; Herkunft der Policy ist `config`.
- [x] Ein vorhandenes, falsches Feld bricht weiter ab (bestehender Test bleibt grün).
- [x] `init` mit einer Config nur aus `knowledgeFile` schreibt die Einbindung, und der Host startet (Smoke).
- [x] `npm run verify:full CR-GC-937` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Herkunft: eine Angabe oder je Feld? | Eine Angabe: `LoadedConfig.source` gilt für `metricPolicy`. `'config'` nur, wenn die Datei `metricPolicy` trägt, sonst `'default'`. | Nur die Policy trägt eine Herkunft zum Konsumenten (`graph_metrics.policySource`, `measured`-Provenienz, Host-Log). `focusThreshold` meldet keine Herkunft. |

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
