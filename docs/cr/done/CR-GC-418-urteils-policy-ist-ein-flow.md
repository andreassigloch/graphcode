# CR-GC-418 — Die Urteils-Policy ist ein FLOW

**Status:** done — 2026-08-25 (graphVersion 199)
**Herkunft:** CR-GC-409 §A, Paket „Policy/Profil" — die Policy-Hälfte.
**Ziel:** R-31 für `FUNC-load-config` schließen, ohne einen Vertrag zu erfinden.

## Befund

`loadGraphcodeConfig` liest `graphcode.config.jsonc` und liefert die
Urteilsschwellen als Policy — seit CR-GC-329 steht keine Schwelle mehr als
Literal im Regelcode. Im Modell hing die FUNC an keiner `io`-Kante (R-31),
obwohl der Weg dieser Daten der Grund für ihre Existenz ist: der Mensch schreibt
die Schwelle, `load-config` füllt sie mit `DEFAULT_METRIC_POLICY` auf, und die
Regelauswertung urteilt mit ihr statt neben ihr.

Der Vertrag existiert bereits und wird bereits geprüft: `MetricPolicySchema`
(`@sigloch/contracts/se`) ist Teil von `GraphcodeConfigSchema`, das
`loadGraphcodeConfig` per `safeParse` auf die Datei anwendet. Deshalb braucht
dieser CR keinen Zeile Code — nur die Kanten.

## Umfang

**Modell (gate-only, `graph_mutate`)**
- `FLOW-metric-policy` + `SCHEMA-metric-policy` (`external`, realRef
  `packages/contracts/src/se/policy.ts#MetricPolicy` — dieselbe Herkunft wie
  `SCHEMA-module-metrics`)
- io: `ACTOR-developer → FLOW-metric-policy → FUNC-load-config →
  FLOW-metric-policy → {FUNC-take-steering-snapshot, FUNC-evaluate-rules}`

Ein FLOW, nicht zwei: geschriebene und aufgefüllte Fassung haben dieselbe Form,
und `load-config` ist genau der Lese-und-Auffüllen-Schritt dazwischen. Zwei
Verträge zu behaupten, wo `MetricPolicySchema` beide beschreibt, wäre eine
Erfindung.

`FUNC-take-steering-snapshot` als Konsument ist nicht kosmetisch: es ist das
einzige Glied der `FCHAIN-steering-loop`, das die Policy wirklich entgegennimmt
(`takeSteeringSnapshot(graph, policy)`) — ohne diese Kante stünde `load-config`
als eigene io-Komponente in seiner Kette und meldete IO-01.

**Kein Code.**

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 6 | 5 |

`R-04` meldet für `MOD-harness` und `MOD-steering` höhere Kreuzungszahlen — kein
neuer Befund, dieselben zwei Meldungen mit aktualisierter Zahl.

## Abnahme

Bestehend: `tests/config.test.ts` (TEST-thresholds-from-config) fährt die
Schwelle als Knopf gegen unveränderten Graphen; `tests/steering-snapshot.test.ts`
und `tests/metrics.test.ts` prüfen, dass die geladene Policy das Urteil trägt.
