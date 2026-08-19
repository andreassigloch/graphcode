# CR-GC-373 — Agenten-Sicht des Codecs: Provenienz raus

**Status:** open
**Datum:** 2026-08-19
**Herkunft:** Live-Messung beim Abschluss von `CR-GC-367`.

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

- [ ] Die Scheibe für `CR-GC-114` enthält **kein** `created_at`/`updated_at`/`ranAt` und kein
      `weight:1`, aber unverändert `codeRef`, `realRef`, `testRefs`-Pfade, `kinds`, `status`
- [ ] Größe für `CR-GC-114` sinkt von 6963 auf **< 5900 Zeichen** (gemessen, nicht geschätzt)
- [ ] Default-`serialize` unverändert: der bestehende Round-Trip-/Conformance-Test bleibt grün,
      eine so serialisierte Scheibe re-importiert weiterhin verlustfrei
- [ ] `npm run build` + volle Suite in beiden Repos grün

## Warum das kein Micro-Optimum ist

18 % gehen an jede Injektion, bei jedem Auftrag, und die Scheibe ist der Pfad, über den der
Graph den Agenten überhaupt erreicht. Der Effekt skaliert mit der Nutzung, nicht mit der
Graph-Größe — und er kostet nichts an Information, weil die weggelassenen Felder für den
Konsumenten „Agent" per Definition keine sind.
