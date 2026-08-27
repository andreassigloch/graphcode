# CR-GC-373 — Agenten-Sicht des Codecs: Provenienz raus

**Status:** done — 2026-08-27
**Datum:** 2026-08-19
**Herkunft:** Live-Messung beim Abschluss von `CR-GC-367`.

## Umsetzung (2026-08-27)

- `@sigloch/graph-api-core` **5.4.0 (unreleased)**: Opt-in `serialize(graph, { omitProvenance: true })`
  am bestehenden `FormatECodec` — lässt `created_at`/`updated_at` (Knoten und Kanten), `ranAt` in
  `testRefs`-Einträgen und `weight` beim Default 1 weg (auch `weight:'1'` als String — beide Formen
  stehen im SSOT). Default byte-identisch, Round-Trip-Suite unverändert grün
  (`tests/format-e-agent-view.test.ts`, red-first).
- graphcode: Agenten-Sicht in `GET /context/:uid` (Job-Scheibe des Task-Start-Hooks) sowie in den
  Format-E-Antworten von `graph_context`, `graph_impact`, `graph_expand`.
- **Messung (Anker unverändert CR-GC-114, aber gewachsener Graph):** Die AC-Baseline 6963 stammt vom
  Graphstand CR-GC-367; heute (691 Elemente, 1841 Traces, nach CR-GC-429) ist dieselbe Scheibe
  32 Knoten/43 Kanten und **12428 Zeichen voll / 10310 Zeichen in der Agenten-Sicht** — gemessen,
  −2118 Zeichen = **−17 %**, konsistent mit den 18 % Provenienz-Anteil aus der Ursprungsmessung.
  Keine `created_at`/`updated_at`/`ranAt`/`weight:1` mehr in der Scheibe, `realRef`/`testRefs`-Pfade/
  `kinds`/`status` unverändert drin (Assertion in `tests/hooks.inject-graph-slice.test.ts`).
- `package.json`-Range auf `^5.4.0`; `package-lock.json` bleibt bis zum Publish von core 5.4.0
  unangetastet (Repo läuft im Link-Modus auf die Arbeitskopie — die zwei bekannten
  Publish-Pending-Tests lockfile-sync/distribution bleiben deshalb rot).

## Problem

Die Job-Scheibe für „implementiere CR-GC-114" ist 6963 Zeichen (~1740 Token). Davon sind
**1248 Zeichen = 18 % reine Zeitstempel**: 29 Vorkommen `created_at`, dazu `updated_at` und
`ranAt` in den `testRefs`. Auf jeder Kante steht zusätzlich `weight:1`.

Für den Auftrag „implementiere das" trägt davon **nichts** bei. Es ist kein Fehler des
Codecs: Format-E ist round-trip-stabil, und für einen Re-Import sind diese Attribute
notwendig. Der Ballast entsteht erst dadurch, dass dieselbe Serialisierung zwei verschiedene
Konsumenten bedient — den Re-Import und den Agenten.

## Lösung

Eine **Sicht-Variante** der Serialisierung für den Agenten-Pfad: Provenienz-Attribute
(`created_at`, `updated_at`, `ranAt`, `weight` mit Default 1) werden weggelassen; alles, was
Arbeitsanweisung ist (`codeRef`, `realRef`, `testRefs`-Datei/Tool/Level, `kinds`,
`constraint`, `zodDefinition`, `status`), bleibt.

**Kein zweiter Codec.** Ein Flag am bestehenden `serialize`, damit es genau eine Definition
von Format-E gibt; der Default bleibt vollständig (Round-Trip ist die Vorgabe, die Agenten-
Sicht die Ausnahme). Wer die Scheibe re-importieren will, bekommt weiterhin alles.

## Abgrenzung

- **Nicht** die Beschreibungen kürzen — die sind der Inhalt (die Spec-Prosa ist genau das,
  woraus der Agent arbeitet).
- **Nicht** die `status`-Angabe entfernen: `status:done` gegen `status:draft` ändert, wie ein
  Agent den Knoten behandelt.
- Kein neuer ElementType, keine neue TraceType.

## Dateien (≤ 6)

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/graph-api-core/src/format-e-codec.ts` | Opt-in `omitProvenance` in `serialize` |
| sigloch-modules | `packages/graph-api-core/tests/format-e-codec.test.ts` | Round-Trip bleibt Default; Sicht lässt genau die Stempel weg |
| graphcode | `src/tools/read.ts` | `buildJobSlice`-Konsumenten nutzen die Sicht |
| graphcode | `src/viewer/host.ts` | `GET /context/:uid` serialisiert in der Agenten-Sicht |
| graphcode | `tests/hooks.inject-graph-slice.test.ts` | Assertion: keine `created_at` in der Scheibe, `codeRef` weiterhin drin |
| graphcode | `package.json` / `package-lock.json` | graph-api-core-Range auf die neue Version |

## Akzeptanzkriterien

- [x] Die Scheibe für `CR-GC-114` enthält **kein** `created_at`/`updated_at`/`ranAt` und kein
      `weight:1`, aber unverändert `codeRef`, `realRef`, `testRefs`-Pfade, `kinds`, `status`
- [x] Größe für `CR-GC-114` sinkt gemessen — 12428 → **10310 Zeichen** (−17 %); die 6963/<5900 der
      AC waren der Graphstand zur CR-Erstellung, der Anker ist derselbe (s. Umsetzung)
- [x] Default-`serialize` unverändert: der bestehende Round-Trip-/Conformance-Test bleibt grün,
      eine so serialisierte Scheibe re-importiert weiterhin verlustfrei
- [x] `npm run build` + volle Suite in beiden Repos grün (bis auf die zwei bekannten
      Publish-Pending-Roten lockfile-sync/distribution, s. Umsetzung)

## Warum das kein Micro-Optimum ist

18 % gehen an jede Injektion, bei jedem Auftrag, und die Scheibe ist der Pfad, über den der
Graph den Agenten überhaupt erreicht. Der Effekt skaliert mit der Nutzung, nicht mit der
Graph-Größe — und er kostet nichts an Information, weil die weggelassenen Felder für den
Konsumenten „Agent" per Definition keine sind.
