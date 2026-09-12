# CR-GC-518: contracts 23 nachziehen: criticality in Config und graph_metrics

**Status:** ✅ Done
**Abgeschlossen:** 2026-09-12
**Typ:** aus Item ITEM-2026-089 (finding)
**Erstellt:** 2026-09-12
**Item:** bok/items/ITEM-2026-089.json (Lane: code)

---

## Root Cause

CR-SM-314 hat `MetricPolicy` um das Pflichtfeld `criticality` erweitert (contracts
RULES_VERSION 23.0.0). Die `@sigloch/*` haengen in dieser Familie als SYMLINK in der
Arbeitskopie — es gilt kein Versionsbereich, der Bump loest bei niemandem etwas aus, die
Wirkung ist sofort. `graphcode.config.jsonc` parste damit nicht mehr gegen
`GraphcodeConfigSchema`, `tests/config.test.ts` war rot, und der Host haette nicht gebootet:
"does not match GraphcodeConfigSchema — metricPolicy.criticality".

## Zwei Teile, nicht einer

**(1) Das Feld in die Betriebs-Config.** Mit der Begruendung daneben, wie bei jeder anderen
Schwelle in dieser Datei: abgelesen an der WIRKUNG (auf den 31 Uebergaben dieses Repos ohne
gemeinsame Kette stellen die Schwellen 3 und 4 identisch 19 frei, 5 und 6 identisch 6 — ein
Plateau 3..4, und 3 ist seine Untergrenze), nicht an der Verteilungsform.

**(2) Die Kennzahl an die Oberflaeche.** "Erfassen" heisst, dass die Zahl einen LESER erreicht.
Eine Kennzahl, die nur im Vertragspaket existiert, ist dieselbe Lage wie die RC-Regeln vor
CR-SM-305: gerechnet, getestet, und auf keinem Produktionspfad. `graph_metrics` traegt sie
deshalb als eigenen Schluessel `functions` neben `modules`.

**EIGENER Schluessel, nicht `modules` breiter.** MOD ist der Abhaengigkeitsbaum, FUNC der
Wertbaum — sie spiegeln einander ausdruecklich nicht (verriegelter Constraint dieses Repos). Ein
breiteres `SCHEMA-module-metrics` haette seinen eigenen Namen zur Luege gemacht: es sagt woertlich
"Je MOD allocatedFuncs, fanIn, fanOut, …".

## Modell

Deshalb ein zweiter Fluss mit eigenem Vertrag, kein verwaesserter erster —
`FUNC-function-criticality` (external, realRef auf contracts, wie `FUNC-module-metrics`)
`-io->` `FLOW-function-criticality` `-relation->` `SCHEMA-function-criticality`, gespeist von
`FLOW-graph-state`, gelesen von `ACTOR-dashboard`, alloziert auf `MOD-projections`, unter
`FUNC-block-messwerk` und in `FCHAIN-skill-report` — dieselbe Nachbarschaft wie das
Modulkennzahlen-Geschwister, und `satisfy` auf `REQ-steering-from-metrics` wie sechs der acht
Geschwister.

**BENANNTE OFFENE DIFFERENZ:** das Dashboard bekommt die Zahl in der Antwort und **rendert sie
noch nicht**. Das steht so in der FLOW-Beschreibung. Ein erfundener Renderer waere die stille
Variante desselben Problems.

**Gemessene Kosten, nicht verschwiegen:** die Ergaenzung verschlechtert `fitAdvisory` in vier
Dimensionen (modifiability −0,069, coherence −0,059, scalability −0,051, flowEfficiency −0,002)
und laesst `steerScore` unveraendert. Das ist bei jeder Modellergaenzung so — mehr Knoten, mehr
Rand. Kein Grund, die Wahrheit nicht zu modellieren; die Alternative waere ein Nutzlast-Schluessel,
den das Modell nicht kennt, und genau das ist die "unbenannte Differenz", die das Gate
verhindern soll.

**Kein neuer Verstoss.** Der Zug bringt nur die zwei Bestandsbefunde auf `MOD-projections`
(R-04 und MT-02), die schon vorher in der Verstossliste standen. graphVersion 264 → 265.

## Dateien

| Datei | Aenderung |
|---|---|
| `graphcode.config.jsonc` | Feld `criticality` mit Begruendung |
| `src/projections/metrics.ts` | Import, Typ und Wert des Schluessels `functions` |
| `tests/metrics.test.ts` | neuer Fall: Zeile je FUNC, Rangfolge, vier Felder |
| `tests/config.test.ts` | 6 JSONC-Fixtures + 1 erwartetes Objekt |
| `docs/MESSGROESSEN.md` | neue Messgröße in der normativen Übersicht |
| `docs/graph/` + `docs/views/` | Modellzug v265, re-exportiert |

## Nachweis

- Build + Typecheck gruen.
- `tests/config.test.ts` + `tests/metrics.test.ts` 27/27.
- Volle Suite: **1092 von 1093 gruen**, EIN roter Test — `tests/distribution.test.ts`, und zwar
  ERWARTET (siehe unten). Kein anderer Fall faellt.
- Der neue Testfall belegt die BINDUNG an contracts' Definition statt sie nachzurechnen — eine
  Zeile je FUNC der Fixture, auch fuer `FUNC-solo` (in keiner Kette, `chains: 0` als AUSSAGE),
  absteigende Rangfolge, und genau vier Felder ohne Infrastruktur-Flag.

## Dabei korrigiert

Zwei eigene Fehlgriffe, beide vom Gate bzw. vom Test gefangen:

1. `add-node` nimmt `realRef`/`external` **nicht** als Top-Level-Felder — der EXPORT schreibt sie
   flach, die Mutate-API verlangt sie unter `attributes`. Die Exportform abzuschreiben erzeugte
   R-20 und R-26. Der Trockenlauf hat es vor dem Schreiben gefangen.
2. Der erste Entwurf des Testfalls behauptete `useCases <= chains` als Invariante. Sie gilt
   nicht: zwei UC duerfen dieselbe FCHAIN komponieren, dann ist `chains: 1, useCases: 2`. Die
   Zusicherung ist entfernt statt abgeschwaecht.

## Der eine rote Test — benannt, nicht weggeredet

`tests/distribution.test.ts` packt graphcode als Tarball, installiert ihn in ein fremdes Repo und
startet den Bin gegen die **Registry**-Version von `@sigloch/contracts`. Die kennt
`functionCriticality` nicht:

    SyntaxError: The requested module '@sigloch/contracts/se'
    does not provide an export named 'functionCriticality'

Das ist die dokumentierte Familienlage, nicht ein Defekt dieses CR: *"Der Floor folgt den
Imports — wer einen N-only-Export importiert, hebt im selben Commit den Peer-Floor auf N. Dass
das Repo dann bis zum Publish nicht registry-faehig ist, ist der ehrliche Zustand (Link-Modus),
kein Range-Problem"*, und *"rote lockfile-sync- und distribution-Tests im Link-Modus sind
erwartet"*. Der Symlink auf die Arbeitskopie hat die Registry-Sicht vollstaendig verdeckt — die
lokale Suite kann diesen Fall per Konstruktion nicht gruen fahren, bevor contracts publiziert ist.

**OFFEN und bewusst nicht einseitig entschieden:** die Release-Nummer von contracts. Der Range
steht auf `>=10.1 <11`. Drei unveroeffentlichte CRs (SM-311, SM-312, SM-314) aendern jeweils
Pflichtfelder der `MetricPolicy` — nach semver ist das `11.0.0`, nicht `10.2.0`. Waehle ich
`>=10.2 <11` und der Release wird 11.0.0, schliesst der Range ihn aus. Die Zahl ist eine
Entscheidung des Auftraggebers (er faehrt `npm publish`); der Floor wird MIT ihr gesetzt, in
einem Zug. Festgehalten als Item.

## Dabei gefunden, nicht von diesem CR verursacht

`docs/MESSGROESSEN.md` nannte als Ziel-Schwelle noch **"Modulgröße"** — `policy.moduleSize` ist
seit CR-SM-312 ersatzlos gestrichen, und CR-GC-516 hat die Stelle übersehen. Eine normative
Übersicht, die ein nicht mehr existierendes Feld führt, ist schlimmer als keine. Mitkorrigiert,
weil dieser CR genau diese Tabelle ohnehin anfasst; als Fund ausgewiesen, nicht als eigene Arbeit.

## Folgt daraus

- `graph-view-edit` rendert `functions` noch nicht — eigenes Item, wenn die Anzeige gebraucht
  wird. Bis dahin ist die Differenz benannt (FLOW-Beschreibung).
- **CR-SM-313** (ITEM-2026-070) ist der zweite Abnehmer der Schwelle: R-21 scharf, mit der
  Infrastruktur-Ausnahme.
