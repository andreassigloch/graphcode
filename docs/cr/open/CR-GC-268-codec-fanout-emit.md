# CR-GC-268 — GraphCodeCodec: Fan-out erzeugen

**Status:** 🟠 Open
**Typ:** Fix (Token-Effizienz)
**Erstellt:** 2026-07-27
**Repo:** graphcode (`src/codec.ts`)
**Dependency:** sigloch-modules `CR-215` (Parser-Seite) — **muss vorher done sein**
**Graph:** betrifft `REQ-deterministic-serialization`, `REQ-roundtrip-conformance`, `MOD-codec`

## Problem

`GraphCodeCodec.encode` erzeugt Format-E-Text **direkt** (nicht über `FormatECodec.serialize`), weil
es die `@attr-line`-Form für komma-/klammerhaltige Attributwerte braucht. Damit erbt es die
Fan-out-Reparatur aus `CR-215` **nicht** — es schreibt weiter eine Zeile pro Kante:

```ts
lines.push(`+ ${fmtSource} -${arrow}-> ${fmtTarget}${inlinePart}`);
```

Auf dem eigenen SSOT-Graphen (369 Knoten / 751 Kanten) sind das **751 Quell-UID-Vorkommen**, die auf
**318** fallen könnten. Gemessen (`cl100k_base`): **−2 101 UID-Token, −4,3 % des Gesamtprompts**
(49 066 → 46 965). UIDs machen heute 20,1 % jedes Format-E-Prompts aus — beim realistischen
`graph_context`-Slice (23 Knoten, 35 Kanten) 19,7 %.

Das trifft jeden `graph_impact` / `graph_context` / `graph_expand`-Call, also den Hot-Path zum LLM.

## Änderung

In `encode()` den Edges-Block nach `(sourceId, edgeType)` gruppieren:

```
+ MOD-harness.MOD -cp-> MOD-codec.MOD, MOD-store.MOD, MOD-emit.MOD
```

**Determinismus-Garantie 1 (`REQ-deterministic-serialization`) bleibt bindend:** Gruppen nach
`sourceId`, dann `edgeType` sortieren; Ziele innerhalb der Gruppe nach `targetId`. Die bestehende
Sortierung `[sourceId, targetId, edgeType]` wird zu `[sourceId, edgeType, targetId]` umgestellt,
damit Gruppen zusammenhängend liegen.

**Kanten mit Attributen bleiben einzeilig** — `inlinePart` hängt an der einzelnen Kante.

Decode braucht keine Änderung: `this.inner.parse()` (= `FormatECodec.parse`) beherrscht 1:n bereits
(`format-e-codec.ts:231`), nach `CR-215` auch der `contracts`-Parser.

## File List (3)

- `src/codec.ts` — `encode()` gruppiert Kanten; Sortier-Schlüssel `[sourceId, edgeType, targetId]`
- `tests/codec.roundtrip.test.ts` — Assertions erweitern: Fan-out-Zeilen-Count + Round-Trip
- `package.json` — `@sigloch/graph-api-core` + `@sigloch/contracts` auf die CR-215-Minors heben

## Akzeptanzkriterien

- [ ] `encode()` auf `docs/graph/graphcode.graph.json`: **318 Kanten-Zeilen statt 751**
- [ ] `encode(g)` zweimal aufgerufen → byte-identisch (Garantie 1 unverletzt)
- [ ] `decode(encode(g))` deep-equals `g` (Garantie 2, L3-Conformance)
- [ ] `encode(decode(encode(g)))` === `encode(g)` (Idempotenz)
- [ ] Kanten mit Attributen weiterhin einzeilig, Attribute vollständig erhalten
- [ ] `validate()` unverändert — Fan-out ändert keine Meta-Model-Prüfung
- [ ] Alle **291** Tests grün, `npm run build` grün
- [ ] Ein `graph_context`-Aufruf über MCP liefert Fan-out-Text (Smoke, nicht nur Unit)

## Abgrenzung

- Nur der Edges-Block. Knoten-Zeilen, `@attr`-Form und UID-Kodierung unverändert.
- Der `.TYPE`-Suffix auf jeder UID bleibt hier — das ist `CR-GC-269` (nach sigloch-modules
  `CR-216`), zusätzliche **−5,1 %**.
- Kein npm-Publish in diesem CR; Version zieht der nächste Release-CR.
