# CR-GC-402 — Dashboard rechnet eine zweite Wahrheit

**Status:** ERLEDIGT (2026-08-27) — **Option C** umgesetzt (Auftraggeber-Entscheidung).
Das Dashboard fragt die Readiness beim graphcode-Host (`graph_readiness` über
`.graphcode/host.sock`) und rechnet nichts selbst; nur ohne erreichbaren Host fällt es auf die
eine vorhandene Auswertung zurück — und sagt das mit einem Banner an.

Vorgeschichte, beide Hälften:

1. **Loader-Hälfte (2026-08-24)**, besser als Option A: `loadGraph()` nutzt die publizierte
   Inverse `fromOntologyGraph` (CR-SM-254) statt eines handgerollten Mirrors
   (graph-view-edit 0.7.1, Regression in `tests/vite-config-load-graph.test.mjs`). Danach waren
   beide Rechenwege regelmengengleich bis auf zwei Rest-Deltas.
2. **Rest-Deltas, mit Option C geschlossen:**
   - RC-01..06 fehlten dashboard-seitig (CodeFacts nur am Checkout) → kommen über den Host mit.
   - MT-01 feuerte dashboard-seitig 1×, hostseitig 0×, weil `DefaultRuleEngine.evaluate()` keine
     MetricPolicy durchreichte → `evaluate(graph, policy?)` in graph-api-code 5.4.0 (unreleased,
     kein weiterer Bump); die Ersatzrechnung liest jetzt `graphcode.config.jsonc`.

**Anhangsbefunde ausgelagert:** `docs/cr/open/CR-DRAFT-GC-439-fixhint-menschenlesbar.md` (fixHint
als Agenten-Anweisung an Menschen) und `docs/cr/open/CR-DRAFT-GC-440-exporter-sprache.md`
(deutsche Sätze in generierten Dokumenten) — bewusst nicht in diesem CR mitumgesetzt.

**Datum:** 2026-08-22 (Befund) / 2026-08-27 (Abschluss)
**Herkunft:** Vorbereitung der Kundenvorführung in `graphcodedemo` (City People Mover, 195 Elemente).
Aufgefallen, weil das Dashboard auf der Leinwand dem Chat widersprochen hätte.

## Problem

Dieselbe Sekunde, dasselbe Repo, dieselbe Datei — zwei unvereinbare Antworten:

| | `graph_readiness` (MCP, maßgeblich) | `GET /api/dashboard` |
|---|---|---|
| Compliance | 97,9 % | **100 %** |
| Elemente mit Fehlern | 4 | **0** |
| TRR | nicht bestanden, Score 0,909 | nicht bestanden, **Score 0** |
| Violations gesamt | 53 | **144** |
| Regeln | R-21 ×34, RD-01 ×8, FM-03 ×4, CL-01 ×2, AF-01…05 je ×1 | **R-19 ×33, R-20 ×17** |

Die beiden Regelmengen sind **disjunkt**: keine einzige Regel-ID kommt in beiden vor.
Das ist keine Abweichung in einer Zahl, das sind zwei Bewertungen desselben Graphen,
die nichts voneinander wissen.

Für die Vorführung ist der Effekt fatal: das Dashboard meldet ein fertiges Projekt
(100 %, null Fehler), während der Chat aus demselben Modell vier ungedeckte Risiken
nennt. Wer beides zeigt, hat auf der Leinwand einen Widerspruch, den er nicht auflösen kann.

## Root Cause

`graph-view-edit@0.6.0`, `vite.config.js:184` — `loadGraph()` hebt beim Einlesen der
committeten `graph.json` **genau vier** flache Felder nach `attributes`:

```js
attributes: { ...(e.attributes ?? {}), status: e.status, asil: e.asil, method: e.method, kinds: e.kinds },
```

Alles andere, was der Exporter flach schreibt, fällt auf den Boden: `concept`,
`severity`, `occurrence`, `detection`, `level`, `tool`, `safety_relevant`, `protocol`,
`qos`, `operatingMode`, `testRefs`, `codeRef`, `realRef`.

Damit erklären sich beide Spalten aus **einer** Ursache:

- `concept` verloren → alle 33 TEST des Modells gelten als runnable → R-19 ×33.
  Nachgeprüft: jeder dieser TEST trägt in der committeten Datei `"concept": true`.
- `severity`/`occurrence`/`detection` verloren → RPN nicht berechenbar → **FM-03 feuert nie**
  → null Fehler → 100 %. Nachgeprüft: jedes RISK-REQ trägt die drei Werte in der Datei.
- Die attributabhängigen Gate-Nenner brechen mit → TRR-Score 0 statt 0,909.

Die Allowlist ist der Mechanismus, nicht der eigentliche Defekt. Der eigentliche Defekt
ist, dass es **zwei Rechenwege für dieselbe Zahl** gibt: der Host wertet den Kuzu-Store
über das Gate aus, das Dashboard baut sich in `dashboardApiPlugin()` eine eigene
`DefaultRuleEngine` über die committete Datei und ruft ein zweites `computeReadiness()`.
Jede Ontologie-Erweiterung muss seither an zwei Stellen nachgezogen werden — hier ist
sie es nicht worden, und niemand hat es gemerkt, weil beide Seiten plausibel aussehen.

## Lösung (zu entscheiden)

**Option A — Allowlist raus (klein, sofort).** `loadGraph()` übernimmt alle nicht
reservierten flachen Schlüssel nach `attributes`, statt vier zu nennen. Behebt den
Befund, lässt die zwei Rechenwege bestehen.

**Option B — ein Loader (richtig, größer).** Das Einlesen der committeten `graph.json`
kommt aus `@sigloch/graph-api-core` — derselbe Codec, den Export und Reseed benutzen.
GVE hört auf, ein eigenes Elementmodell zu bauen. Keine parallelen Pfade.

**Option C — gar keine zweite Rechnung.** Das Dashboard fragt die Readiness beim Host
ab (die Bridge steht bereits) und rechnet nichts selbst. Nur solange kein Host läuft,
fällt es auf eine eigene Auswertung zurück — und sagt das dann auch an.

Empfehlung: **A sofort als Stopfen, C als Zielbild.** B löst die Attributfrage, aber nicht
die Frage, warum dieselbe Kennzahl zweimal berechnet wird.

**Entscheidung des Auftraggebers (2026-08-27): Option C.** Die Loader-Hälfte (faktisch B für
das Einlesen) war schon da; C beantwortet die verbliebene Frage — dieselbe Kennzahl wird nicht
mehr zweimal gerechnet, sondern einmal am Host geholt. Die Ersatzrechnung bleibt genau für den
Fall ohne Host bestehen und ist als solche gekennzeichnet.

## Abgrenzung

- **Keine** neue Regel, keine Änderung an `V3_RULES` — die Regeln sind in Ordnung,
  sie bekommen im Viewer nur einen kastrierten Graphen zu sehen.
- **Nicht** die Zahl im Panel "korrigieren". `readinessPanel()` bildet den Report
  getreu ab; der Report selbst ist falsch.
- Nicht die Empfehlungsliste anfassen — dazu siehe den Anhang, das ist ein eigener CR.

## Dateien (umgesetzt, Option C)

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/graph-api-core/src/rule-engine.ts` | `evaluate(graph, policy?)` — Policy am Aufruf, Default bleibt die gebundene |
| sigloch-modules | `packages/graph-api-core/src/se-descriptor.ts` | Adapter reicht die Call-Policy an die contracts-Regel durch |
| sigloch-modules | `packages/graph-api-core/tests/rule-engine-policy.test.ts` | red-first: Override wirkt, Default unverändert, Override gilt nur den einen Aufruf |
| sigloch-modules | `packages/graph-api-core/CHANGELOG.md` | Eintrag in die bestehende 5.4.0-Sektion (kein weiterer Bump) |
| graph-view-edit | `vite.config.js` | `fetchHostReadiness()` (graph_readiness über host.sock) als Primärweg; `readMetricPolicy()` für den Fallback; `readinessSource` im Payload |
| graph-view-edit | `src/dashboard/Dashboard.jsx` + `dashboard.css` | Banner „lokal gerechnet, kein Host erreichbar" (`dashboard-source-banner`, Token-Styling) |
| graph-view-edit | `tests/dashboard-host-parity.test.mjs` | **die Kernabsicherung** — Host-Antwort gegen Dashboard-Anzeige auf demselben Graphen |
| graph-view-edit | `tests/dashboard-readiness-fallback.test.mjs` | Fallback: Banner + Grund, und MT-01 schweigt mit `instability: null` aus der Repo-Config |
| graph-view-edit | `tests/dashboard.test.mjs` | Banner sichtbar bei `origin:'local'`, abwesend bei `'host'` |
| graph-view-edit | `package.json` | `@sigloch/graph-api-core` auf `>=5.4 <6` — ohne den Policy-Parameter wäre der Fallback wieder still falsch |

## Akzeptanzkriterien (Option C)

- [x] `GET /api/dashboard` meldet die Zahlen, die `graph_readiness` in derselben Sekunde
      liefert — Compliance, Elemente mit Fehlern, Gate-Scores und die Regelmenge inklusive
      RC-01..06
- [x] Ein Test vergleicht Host-Antwort und Dashboard-Anzeige auf demselben Graphen und
      schlägt fehl, sobald die Compliance-Zahlen auseinanderlaufen (das ist die eigentliche
      Absicherung — ohne ihn wandert der Befund beim nächsten Ontologie-Attribut zurück).
      Red-first belegt: im Zustand vor der Änderung **57,2 % gegen 47,8 %**, TRR grün gegen
      rot, 19 gegen 21 Regeln
- [x] Ohne erreichbaren Host rechnet der Viewer weiter — mit der `graphcode.config.jsonc`
      des Repos und einem sichtbaren Banner samt Grund. Eigener Test, ebenfalls red-first
- [x] Kein dritter Pfad: der Fallback ist die EINE vorhandene Rechnung
      (`fromOntologyGraph` + Engine), nicht eine Kopie daneben
- [x] `npm run build` + volle Suite grün: graph-api-core 151/151, gve 738/738
      (`npm test -- --no-ingest`, 729 vorher + 9 neue)

## Warum das nicht kosmetisch ist

Die Kennzahl auf dem Dashboard ist das Versprechen des Produkts: *Status wird gerechnet,
nicht behauptet.* Solange zwei Rechenwege existieren, von denen einer stumm die Hälfte
der Attribute verliert, ist genau dieses Versprechen die unsicherste Stelle im System —
und sie fällt zuerst dort auf, wo jemand hinschaut, der uns nicht kennt.

---

## Anhang — zwei weitere Befunde aus demselben Lauf (je eigener CR)

> **Ausgelagert, hier NICHT umgesetzt:**
> Befund 1 → `docs/cr/open/CR-DRAFT-GC-439-fixhint-menschenlesbar.md` ·
> Befund 2 → `docs/cr/open/CR-DRAFT-GC-440-exporter-sprache.md`

**1 · Das Dashboard druckt Agenten-Anweisungen an Menschen.**
`recommendationsPanel()` reicht `fixHint` unverändert durch, das Panel zeigt sie:
„Add attributes.testRefs [{file, case?, tool, level?}, …] with at least one entry".
Das ist eine Anweisung an eine Maschine, adressiert an einen Menschen. Dasselbe
Register-Problem hat `graph_help`: es liefert `plain`, `se` und `prompt` in einer
Antwort, und die Steering-Datei schickt den *Menschen* dorthin. Vorschlag: die
Mensch-Oberflächen zeigen nur die `plain`-Schicht; `fixHint` bekommt ein
menschenlesbares Gegenstück, oder das Panel zeigt statt der Anweisung die
Entscheidung, die ansteht.
*Folge in der Praxis: die Vorführung zeigt bewusst die gedruckten Dokumente statt des
Dashboards.*

**2 · Deutsche Sätze in generierten Dokumenten eines englischen Modells.**
`exportMarkdown` schreibt Fußzeilen und Spaltenköpfe teils deutsch — `fmea.md`
(„Render-Form von REQ kind=risk", Spalte „verifiziert"), dazu `conops.md`, `rtm.md`,
`testmatrix.md`. In einem englischsprachigen Modell steht das mitten im Dokument, das
der Kunde in die Hand bekommt. Vorschlag: Exporter-Prosa durchgängig englisch, oder
Sprache aus dem Modell/Config ableiten.
