# CR-GC-312 — Der Regelkatalog feuert nur zu einem Sechstel: 10 von 12 Regel-Familien sind nicht verdrahtet

**Status:** done · **Angelegt:** 2026-08-08 · **Abgeschlossen:** 2026-08-08 · **Max Files:** 5
(→ real größer, drei Repos)
**Herkunft:** ConOps-Review 2026-08-08. Gesucht war „warum flaggt uns keiner einen UC ohne
FCHAIN?" — die Regel dafür existiert seit Langem und lief nie.
**Repo-Grenze:** Der Fix liegt in **`@sigloch/graph-api-core`** (sigloch-modules), nicht in
graphcode. graphcode ist der messbare Konsument und trägt den Regressionstest.

## Problem

`SE_DESCRIPTOR.rules` ist auf zwei Familien verkürzt
(`graph-api-core/src/se-descriptor.ts`, dist Zeile 54):

```ts
const SE_RULES = [...V3_RULES, ...MT_RULES].map(...)
```

`@sigloch/contracts/se` exportiert zwölf: `V3_RULES`, `UC_RULES`, `FC_RULES`, `SC_RULES`,
`MT_RULES`, `CR_RULES`, `AO_RULES`, `FM_RULES`, `VIEW_RULES`, `AF_RULES` (SE-Profil) plus
`BQ_RULES`/`ND_RULES` (Coding-Profil). graphcodes Engine registriert genau
`SE_DESCRIPTOR.rules` (`src/harness.ts:108`) — also `R-*`, `RD-*`, `MT-*` und sonst nichts.
`rules_evaluate` / `rules_get_violations` / Gate sehen zehn Familien nie.

`evaluateAllRules` läuft parallel dazu in `src/steering.ts` und `src/steering-snapshot.ts`.
Dort werden die fehlenden Familien für die Metrik-Dimensionen ausgewertet — sie fließen in
das Steering-Signal ein, tauchen aber in keinem Violation-Report auf. Zwei Regelmengen,
zwei Sichtbarkeiten, eine davon stumm.

### Messung (2026-08-08, `docs/graph/graphcode.graph.json`, SE-Profil)

`rules_get_violations` meldet **2** Violations. `evaluateAllRules` auf demselben Graphen
meldet **276**:

| Regel | Sev | n | Regel | Sev | n |
|---|---|---:|---|---|---:|
| CR-R02 | error | 91 | UC-04 | warning | 3 |
| CR-R04 | warning | 62 | SC-04 | warning | 3 |
| VR-01 | info | 58 | MT-02 | info | 2 |
| CR-R01 | error | 22 | FC-02 | warning | 1 |
| IO-01 | warning | 13 | FC-04 | warning | 1 |
| UC-05/06 | info | 12 | UC-02 | error | 1 |
| AF-01..05 | warning | 5 | UC-03 | warning | 1 |
| | | | CR-R03 | warning | 1 |

Davon **114 error** (CR-R01 22 + CR-R02 91 + UC-02 1).

Der auslösende Einzelfall: `UC-graph-time-travel` wird von **UC-02** (error, kein ACTOR),
**UC-03** und **FC-02** getroffen — drei Treffer, null Anzeige.

## Warum das keine kosmetische Lücke ist

`CR-R02` („done, aber kein commitRef", 91×) und `CR-R01` („trackt nichts", 22×) sind genau
die Graph↔Realität-Prüfungen, die einen als `done` markierten CR ohne Nachweis auffliegen
lassen. Sie waren die ganze Zeit vorhanden und haben nie gemessen.

## Architektur-Entscheidung

**Fix im Descriptor, nicht in graphcode.** Ein lokales `engine.register(UC_RULES, …)` in
graphcode wäre ein zweiter Regel-Pfad neben `SE_DESCRIPTOR.rules` und bricht L2
(„Regeln kommen aus contracts, nie geforkt, kein lokaler Parser").

**Zwei Stufen, weil 114 error sonst sofort das Gate schließen.** Das Apply-Gate blockt auf
*neu eingeführten* error-Violations (Delta-Semantik) — ein Batch, der einen CR anfasst,
würde ab Stufe 1 an CR-R01/R02 hängenbleiben, obwohl der Batch den Fehler nicht verursacht
hat.

- **Stufe 1 (dieser CR):** `SE_DESCRIPTOR.rules` erhält alle SE-Profil-Familien. Regeln
  außerhalb von `V3_RULES`/`MT_RULES` kommen mit `gating: false` — sie erscheinen in
  `rules_evaluate`, `rules_get_violations` und `readiness`, zählen aber nicht ins
  Gate-Delta. Das Feld sitzt am Descriptor-Rule, nicht an der contracts-Definition; die
  Severity der Regel bleibt unangetastet.
- **Stufe 2 (Folge-CR, nach Abbau des Bestands):** `gating: true` für die error-Regeln.
  Reihenfolge: erst UC-02 (1 Fall), dann CR-R01, zuletzt CR-R02.

## Manuelle Wirkketten — die Autoren-Konvention, die dieser CR mit erzwingt

FC-02/UC-03 werden erst dann tragbar, wenn klar ist, wann eine FCHAIN Code braucht und wann
nicht. Das Meta-Modell erlaubt `FCHAIN -compose-> FUNC (1..*)` und sonst nichts — ein ACTOR
kann **nicht** zwischen zwei Schritten in der Kette stehen; ACTOR bindet nur über
`ACTOR→FLOW` / `FLOW→ACTOR` / `ACTOR→UC` an. Eine `ACTOR-delete-ACTOR-load-ACTOR`-Kette ist
also nicht ausdrückbar — und wird auch nicht gebraucht. FC-01/FC-04 sagen es schon richtig:
**der ACTOR begrenzt die Kette (Trigger + Konsument), die FUNCs sind die Schritte.**

Damit ist die Antwort auf „muss ich für jede Kombination einen Sammelbefehl schreiben?":
**nein.** Eine FCHAIN ist die *Sequenz*, nicht der *Sammelbefehl*. Sie kostet einen Knoten
plus compose-Kanten, keinen Code. Drei Stufen, in dieser Reihenfolge zu prüfen:

1. **FCHAIN aus vorhandenen FUNCs, kein neuer Code** — der Default. Gilt, wenn jeder
   Schritt für sich eine sinnvolle Operation ist und die Reihenfolge aus den Signaturen
   folgt. Der Actor reiht an.
2. **FCHAIN plus eine FUNC mit `realRef.lang: "prompt"`** — wenn der Schritt Wissen
   braucht, das nicht aus den Signaturen folgt. Die dokumentierte Prozedur *ist* die
   Realisierung. Etablierter Präzedenzfall im Graphen: `FUNC-view-conops`, `FUNC-test`,
   `FUNC-render-views` binden alle `.claude/commands/*.md`. Skills sind Funktionen.
3. **Neue Code-FUNC (Sammelbefehl)** — nur wenn die Sequenz eine Invariante trägt, die die
   Einzelschritte nicht garantieren können: Atomarität, Rollback, Reihenfolge-Zwang,
   Sicherheits-Vorbedingung. Beispiel: CR-GC-311 (`rewind`).

Ein UC ohne FCHAIN ist damit tatsächlich „nicht implementiert" im Sinn von: es gibt keinen
beschriebenen Betriebsablauf. Stufe 1 und 2 machen die Behebung billig genug, dass die
Warnung nicht zu Lärm wird.

## Scope (≤ 5 Dateien)

**In `sigloch-modules/packages/graph-api-core`:**

1. `src/se-descriptor.ts` — `SE_RULES` aus allen SE-Profil-Familien; `gating`-Flag pro Regel
2. `src/types.ts` (o. äquiv.) — `gating?: boolean` am Rule-Typ, Default `true`
3. `test/se-descriptor.test.ts` — Katalog-Vollständigkeit gegen
   `getRuleDefsForProfile('se')` (Drift-Lock: eine neue contracts-Familie fällt auf);
   `gating: false` für die Nicht-V3/MT-Regeln

**In graphcode:**

4. `tests/rules.catalog.test.ts` (neu) — `rules_evaluate` liefert Treffer aus mindestens
   UC/FC/CR/AF; ein Gate-Batch auf einem Graphen mit bestehenden CR-R01/R02 wird **nicht**
   geblockt
5. `package.json` — Range-Bump auf die neue `@sigloch/graph-api-core`-Version

## Stand 2026-08-08 — was gebaut ist, und der tiefere Befund

**In `graph-api-core` fertig, Suite grün (9 Dateien / 91 Tests), NICHT publiziert:**

- `src/rule-engine.ts` — `Rule.gating?: boolean` (Default `true`), `RuleViolation.gating`;
  `DefaultRuleEngine.evaluate` stempelt es aus der Regel. Nur wenn eine Regel *abwählt* —
  ein fehlendes Feld heißt gating, also unverändertes Verhalten für jeden Bestandskonsumenten.
- `src/se-descriptor.ts` — `SE_RULES` aus **allen zehn SE-Familien** (V3, MT, UC, FC, SC, CR,
  AO, FM, VIEW, AF). Draußen bleiben BQ/ND (Coding-Profil) und RC (braucht `CodeFacts` aus
  einem Checkout, den dieses Paket nicht hat). Katalog: **32 → 66 Regeln.**
- `tests/se-descriptor.test.ts` — Erwartung aus `ALL_RULE_DEFS` **abgeleitet** statt
  hartkodiert: eine neue contracts-Familie ohne Descriptor-Eintrag wird rot.

**In graphcode fertig gewesen, wieder zurückgenommen** (der Baum darf nicht rot bleiben):
`src/harness.ts` filtert `v.gating !== false` im Block-Zweig; `tests/rules.catalog.test.ts`
(4 Tests) beweist Sichtbarkeit **und** dass die neuen Fehler nicht blocken, mit V3-Kontrolle
gegen zu breites `gating`. Beides lief lokal grün gegen die gebaute graph-api-core.

### Der eigentliche Root Cause liegt tiefer als beschrieben

`graph-api-core@2.0.0` pinnt `@sigloch/contracts: ^2.0.0`. npm installiert deshalb in
graphcode eine **zweite, geschachtelte** `contracts@2.0.0` neben der Top-Level-`3.1.0`:

```
node_modules/@sigloch/contracts                          → 3.1.0
node_modules/@sigloch/graph-api-core/node_modules/…/contracts → 2.0.0
```

Damit laufen im selben Prozess **zwei Regelstände**: das **Gate** (über `SE_DESCRIPTOR`) auf
contracts 2.0.0, `steering.ts`/`steering-snapshot.ts` (`evaluateAllRules`) auf 3.1.0. Das ist
der Grund, warum AF-01..05 nie im Gate auftauchten — sie existieren in 2.0.0 gar nicht. Ohne
den Range-Bump hätte das Katalog-Wiring die Familien aus dem *veralteten* Stand gezogen.

`^2.0.0` → `^3.1.0` gebaut und getestet. Es ist kein Alleingang: `graphcode-client`,
`se-optimizer` und `se-steering` stehen längst auf `^3.0.0` — `graph-api-core` war das
letzte Paket auf `^2`.

### Preis: 3 rote Tests in graphcode — und sie kommen NICHT vom Katalog

Gemessen, nicht geschätzt. Mit contracts 3.1.0 **und dem alten V3+MT-Katalog** fallen bereits:

| Test | Grund |
|---|---|
| `help.test.ts` · `help-content.test.ts` | `R-28` hat keinen authored Plain/SE-Eintrag — die Regel existiert erst ab contracts 3.x, `HELP_CONTENT` ist gegen 2.0.0 geschrieben |
| `readiness.model.test.ts` | Readiness-Modell deckt 31 Regeln ab, der Descriptor liefert 32 |

Das Katalog-Wiring fügt **keinen vierten** Fehlschlag hinzu — es verbreitert dieselben drei:
Readiness-Modell auf 66 Regeln, und `HELP_CONTENT` bräuchte ~34 weitere authored
Plain/SE-Paare (UC-*, FC-*, CR-R*, AF-*, AO-*, FM-*, VIEW-*, SC-*).

Genau daran endet dieser CR: das ist Schreibarbeit für zwei Zielgruppen (CR-GC-227), kein
Wiring — und sie sprengt 6 Dateien deutlich.

### Zweiter, unabhängiger Befund (eigener CR nötig)

`getRuleDefsForProfile('se')` in contracts kennt kein `'MS-'`. `MS-01`/`MS-02` (V3_RULES) und
`MS-03` (CR_RULES) fallen für **jeden** Konsumenten aus dem `se`-Profil — dieselbe Klasse wie
die `RD-`-Lücke, die der Funktionskommentar selbst dokumentiert (CR-SM-221). Ein
Ein-Zeilen-Fix in contracts, hier bewusst nicht mitgemacht (drittes Repo, eigener Bump). In
`tests/se-descriptor.test.ts` ist die Lücke als Test **festgenagelt**, nicht kommentiert —
wer sie in contracts schließt, macht diesen Test rot und weiß, dass er ihn löschen darf.

### Beide Entscheidungen getroffen und umgesetzt (2026-08-08)

1. **Publiziert** — `contracts 3.2.0` → `graph-api-core 2.1.0` → `graphcode-client 0.8.0`,
   graphcode-Ranges gezogen. Der Range-Bump war der eigentliche Fix: es gibt jetzt genau
   **eine** contracts-Instanz statt einer geschachtelten 2.0.0 unter core.
2. **Help-Rest in diesem CR erledigt**, nicht ausgelagert: 36 authored Plain/SE-Paare
   geschrieben (`R-28`, UC-*, FC-*, SC-*, CR-R*, MS-03, AO-*, RT/PH/CA/IO, FM-*, NFR-01,
   VR-01, CL-01, AF-*). Der befürchtete Prompt-Bloat wurde vorher separat abgeräumt —
   `graph_help` fasst seit **CR-GC-316** pro Regel zusammen statt pro Vorkommen, sonst
   hätte das Authorn den token-losen Modus von 2 KB auf ~178 KB getrieben.

### Der dritte Parallelpfad, gefunden beim Nachziehen des Readiness-Modells

`PHASE_GATE_RULES` in `graphcode-client` war ein handgepflegtes Literal über 33 Regeln —
und contracts hatte es längst ersetzt: CR-SM-226 entfernte `emergentPhase`/`phaseScore` als
„ein drittes, undokumentiertes Phase-Konstrukt neben `RULE_TO_DIMENSION` und der (damals
noch ad-hoc) Phase-Gate-Gruppierung" und führte `RULE_TO_PHASE` ein, „exportiert, damit kein
Konsument sie neu erfindet". Diese ad-hoc-Gruppierung **war** dieses Literal; der Umbau kam
nie an.

Preis des Liegenlassens: die beiden waren bei **21 von 33** geteilten Regeln
auseinandergelaufen (`R-01` SRR vs. TRR, `R-08` TRR vs. PDR, `RD-01..03` CDR vs. SRR).
Readiness wurde gegen die eingefrorene Karte gerechnet. Jetzt abgeleitet; `IMPL_GATE_RULES`
ebenso (per `MS-`/`CR-R`-Präfix statt `['MS-01','MS-02']`). Die 5 `RC-*` sind die einzige
echte Lokal-Ergänzung — sie liegen bewusst außerhalb `ALL_RULE_DEFS` — und auch die nicht
handverlesen: jede erbt das Gate ihrer Presence-Regel.

**Vier Tests fielen dabei um, und das ist der eigentliche Befund.** Sie nannten das Gate
beim Namen (`R-01 → SRR`, `RC-01 → CDR`, `IMPL_GATE_RULES === ['MS-01','MS-02']`,
Score `2/3`). Genau deshalb konnte die Drift monatelang grün bleiben — die Tests hatten sie
mitgelernt. Sie fragen jetzt die Zuordnung ab, statt sie zu behaupten.

### Ergebnis

64 Regeln im Descriptor (vorher 32), 69 im Readiness-Modell (disjunkt + vollständig gegen
`SE_DESCRIPTOR` geprüft), `HELP_CONTENT` deckt den Katalog vollständig ab.
**85 Dateien / 622 Tests grün** gegen die publizierten Pakete.

## Akzeptanzkriterien

- [ ] `rules_get_violations` auf dem heutigen Graphen liefert Treffer aus UC-*, FC-*, CR-R*,
      AF-*, IO-01, VR-01 — Zahl im Test gegen `evaluateAllRules` asserted, nicht hart kodiert
- [ ] `UC-graph-time-travel` erscheint mit UC-02, UC-03, FC-02 (vor CR-GC-311)
- [ ] Ein `graph_mutate`-Batch auf einem Graphen mit 114 bestehenden error-Violations wird
      nicht geblockt — `gating: false` wirkt, Delta-Semantik unverändert
- [ ] `readiness` ändert sich nachvollziehbar; die Differenz ist im Test benannt, nicht
      beiläufig
- [ ] Neue contracts-Regel-Familie ohne Descriptor-Eintrag lässt den Katalog-Test rot werden
- [ ] `steering.ts`/`steering-snapshot.ts` liefern unverändert (Regression — sie riefen
      `evaluateAllRules` schon vorher direkt auf)
- [ ] graph-api-core publiziert, graphcode-Range gepinnt, `package-lock.json` als Nachweis
- [ ] `npm test && npm run build` in beiden Paketen grün
