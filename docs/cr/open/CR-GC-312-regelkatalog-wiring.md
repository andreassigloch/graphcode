# CR-GC-312 — Der Regelkatalog feuert nur zu einem Sechstel: 10 von 12 Regel-Familien sind nicht verdrahtet

**Status:** open · **Angelegt:** 2026-08-08 · **Max Files:** 5
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
