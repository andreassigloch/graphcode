# CR-GC-873: ConOps Ausgelöst von/Beteiligt, se:top-level Regel 4 und sync beim Kettenschnitt

**Status:** ✅ Done (2026-10-28)
**Typ:** aus Item ITEM-2026-1108 (idea)
**Erstellt:** 2026-10-28
**Item:** bok/items/ITEM-2026-1108.json (Lane: code)

---

Befund: Die ConOps-Sicht (src/projections/graphcode.ts, ucsOfActor) nennt jeden Akteur, der eine Funktion einer Kette berührt, in beiden Richtungen als „triggert" und „Ausgeloest von". Beleg: immo-infra v58, der Freigeber „löst" alle drei Ketten aus.

Entscheidung Andreas 2026-10-28: Rollen je Kette werden abgeleitet (Funktion in @sigloch/contracts/se, Item an sigloch-modules, gleicher Tag). Ein Akteur in der Mitte ist erlaubt. Mehrere Auslöser nur am selben Eingangsknoten mit gleichem Vertrag, sonst eigene Kette.

Für graphcode:
1. ConOps: „Ausgelöst von" nur der Auslöser; neue Zeile „Beteiligt" für Akteure in der Mitte; Senken getrennt. §3 „triggert" nur, wo der Akteur Auslöser ist.
2. se:top-level: Regel 4 „One trigger per chain" neu fassen als „ein Eingangsknoten je Kette; parallele Auslöser nur dort mit gleichem Vertrag" und auf FC-06 verweisen. `sync`/`async` wird beim Kettenschnitt gesetzt (Stufe 3, FLOW + SCHEMA), nicht erst in se-vorbereitung; FC-06 meldet einen Fluss ohne Merkmal ab se:top-level.
3. Eigenes Modell (gemessen v971): 7 Ketten mit Auslösern an verschiedenen Knoten werden Befunde — 5 mit den async-Kanälen des Regelhalters (dashboard-metrics, generation-states, schema-migration, steering-loop; Konfiguration statt Akteursfluss?), host-start und model-import (MCP agent-loop vs. CLI cli-dispatch: zwei Ketten), docked-session (agent-loop vs. host-socket). Dazu 2 Ketten ohne Auslöser (loop-closure: FUNC-tool-context, repo-lifecycle: FUNC-claim-store-lock unerreichbar).

---

## Umfang

Kein Wurzelknoten am Item. Im Modell gebunden: `FUNC-export-markdown` (realRef `src/projections/exporter.ts`,
rendert die ConOps-Sicht aus `src/projections/graphcode.ts`), `FUNC-se-top-level`, `FUNC-se-vorbereitung`.
Der CR-Knoten traegt `relation` auf alle drei.

## Umsetzung

1. **ConOps** (`renderConOps`): die Rolle je Kette kommt aus `chainRoles` (contracts CR-SM-420) ueber
   `toOntologyGraph` — das traegt `attributes` genestet, `readFlowSync` sieht `sync`; `toEvaluableGraph` ist
   nicht noetig. §4 je UC: „Ausgeloest von" (Rolle `trigger`), „Beteiligt" (`middle`), „Empfaenger"
   (Senken ohne die Akteure in der Mitte), „Liefert zu" (`answer`/`predelivery`/`unknown`). `neighbor` steht
   nicht dort: der Akteur loest die Nachbarkette aus und steht dort als Ausloeser. §3 je Akteur: „triggert",
   „beteiligt an", „empfaengt aus", „liefert zu". Die alte Ableitung `ucsOfActor`/`funcToUcs` ist geloescht.
2. **se:top-level** (Version 5): Regel 4 heisst „One entry node per chain" — parallele Ausloeser nur am
   selben Eingangsknoten mit gleichem Vertrag, Akteur in der Mitte erlaubt (Abschnitte), Verweis auf FC-06.
   Phase 3, Schritt FLOW + SCHEMA setzt `@sync sync|async`. **se-vorbereitung** (Version 6): Schritt 3 prueft
   das Merkmal nach und nennt se:top-level als Ort.
3. **Neuverankerung durch FC-06** (contracts Regelkatalog 49.2.0): `tests/claims.conformance.test.ts`
   66 -> 67 engine rules, zwei Artikel nachgezogen; `tests/generate.statemachine.test.ts` erwartet am Golden
   `sigllm-v98` zusaetzlich FC-06 (4 Ketten, Ursache `unsynced`). Das Golden ist ein Messstand und bleibt.
4. **Modell**: Beschreibungen von `FUNC-se-top-level` und `FUNC-se-vorbereitung` (Version 6) ueber
   `graph_mutate` am laufenden Host, v972 -> v973, Views mit `scripts/export-graph.mjs` neu gerendert.

## Rot gesehen

- `tests/exporter.test.ts` „CR-GC-873": 4 von 5 rot gegen den alten Code. Beleg: `Ausgeloest von:
  ACTOR-auftraggeber · ACTOR-freigeberin · ACTOR-leser`, keine Zeile „Beteiligt"/„Empfaenger", die
  Freigeberin „triggert". Der fuenfte Fall (Akteur ohne Kette bleibt ohne Kopplung) war schon gruen.
- `tests/skill-top-level-ausloeser.test.ts`: 7 von 7 rot gegen den alten Skill-Text.
- Der alte Test „§3 maps each actor … over ACTOR io UC" ist geloescht: er stuetzte sich auf die seit
  contracts 9 entfallene Kante `ACTOR io UC` und war nur gruen, weil die UC-uid spaeter im Dokument steht.

## Smoke

ConOps fuer immo-infra (v59) aus dem neuen Renderer, Ausgabe ausserhalb des Repos:
`UC-ki-inhalt` „Ausgeloest von: `ACTOR-ki-client`", „Beteiligt: `ACTOR-freigeber`";
`UC-geplanter-lauf` „Ausgeloest von: `ACTOR-freigeber` · `ACTOR-zeitplan`" (freigeber ueber
`FLOW-lauf-anstoss`), „Beteiligt: `ACTOR-freigeber`" (ueber `FLOW-freigabe`).

## Dateien

`src/projections/graphcode.ts`, `tests/exporter.test.ts`, `tests/skill-top-level-ausloeser.test.ts` (neu),
`tests/skill-vorbereitung-felder.test.ts`, `tests/claims.conformance.test.ts`,
`tests/generate.statemachine.test.ts`, `.claude/commands/se/top-level.md`, `.claude/commands/se-vorbereitung.md`,
`docs/articles/03-graphcode-harness-goal-and-concept.md`, `docs/articles/04-the-graphcode-story.md` — 10 Dateien.
Dazu das erzeugte Modell (`docs/graph`, `docs/views`, `docs/messung/testauswahl.jsonl`).

## Offen

- **FC-06 am eigenen Modell (v973), 10 Befunde, nicht gerichtet** — Entscheidung des Autors noetig:
  - `triggers-disagree` (8): dashboard-metrics, generation-states, schema-migration, steering-loop (die
    async-Kanaele des Regelhalters — Konfiguration statt Akteursfluss?), host-start und model-import (MCP
    agent-loop vs. CLI cli-dispatch: zwei Ketten?), docked-session (agent-loop vs. host-socket), dazu
    **verify-lane** (nicht in der Messung v971 genannt): `ACTOR-auftraggeber` ueber `FLOW-cli-invocation`
    an zwei Gliedern, `FUNC-verify-lane-code` und `FUNC-verify-lane-full`.
  - `no-trigger` (2): loop-closure, repo-lifecycle.
- **`tests/distribution.test.ts` rot** — Root Cause: das veroeffentlichte `@sigloch/contracts` 12.8.0 hat
  kein `chainRoles`; die Arbeitskopie traegt dieselbe Versionsnummer. Impact: die Installation aus dem
  Tarball bricht beim Import, alles andere ist gruen (1656/1657). Fix: contracts mit CR-SM-420 als 12.9.0
  veroeffentlichen, dann die Spanne in graphcode auf `>=12.9 <13` heben. `verify:full` hat das als Schlupf
  gezaehlt (Folge 0/10).
- **Laufender Host rendert mit altem Code** (gebootet 2026-10-27, vor diesem Bau): ein Export ueber den
  Host schreibt `docs/views/conops.md` in der alten Form. Nach einem Neustart des Hosts verschwindet das.
