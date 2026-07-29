# CR-GC-269 — `encodeUid`/`decodeUid` entfernen (Format-E v2)

**Status:** ✅ Done — 2026-07-29
**Typ:** Refactoring (Format-Bump-Nachzug)
**Erstellt:** 2026-07-27
**Repo:** graphcode (`src/codec.ts`)
**Dependencies:** `CR-GC-268` (Fan-out) **und** sigloch-modules `CR-SM-216` (Typ aus dem Feld) —
**beide OFFEN, nicht startbar** (korrigiert 2026-07-28; die Zeile behauptete vorher „beide done"):

| Blocker | Ort | Stand |
|---|---|---|
| `CR-GC-268` | `docs/cr/open/` | offen — `src/codec.ts:217` schreibt weiter eine Zeile pro Kante |
| `CR-SM-215` | sigloch-modules `docs/cr/open/` | offen |
| `CR-SM-216` | sigloch-modules `docs/cr/open/` | offen, **Entscheidung ausstehend** (Formatbruch) |

`encodeUid`/`decodeUid` stehen unverändert in `src/codec.ts:64` bzw. `:78`. Solange die
Formatentscheidung in `CR-SM-216` nicht gefallen ist, ist dieser CR nicht anfassbar — er würde die
Kodierung entfernen, deren Ersatz noch nicht beschlossen ist.
**Graph:** betrifft `MOD-codec`, `REQ-roundtrip-conformance`, `REQ-deterministic-serialization`

## Problem

`src/codec.ts` trägt eine eigene UID-Kodierung, deren einziger Zweck es ist, dem Parser den Typ
unterzuschieben (Header-Kommentar Zeile 31–38):

```
Canonical uid    :  <slug>.<TYPE>.<counter>   → encode lässt in Ruhe
Legacy/plain uid :  <slug>                    → encode hängt .<TYPE> an, decode schneidet ab
Decode           :  Dot-Segmente von hinten nach einem bekannten SE-Typ scannen
```

Nach `CR-SM-216` liest der Parser den Typ aus der Knoten-Sektion bzw. über den Resolver. Damit ist
`encodeUid`/`decodeUid` **toter Ballast** — und ein paralleler Pfad zur Modul-Logik, also genau das,
was nicht stehenbleiben darf.

Token-seitig (`cl100k_base`, eigener SSOT-Graph, 1871 UID-Vorkommen): der Suffix kostet **2 510
UID-Token** oben auf den `CR-GC-268`-Stand — **−5,1 % jedes Graph-Prompts**, kumuliert mit
`CR-GC-268` **−9,4 %** gegenüber heute (49 066 → 44 455).

## Änderung

1. `encodeUid` / `decodeUid` **löschen**. `encode()` schreibt die UID roh; `decode()` nimmt sie roh.
2. `encode()` gruppiert die Knoten nach `type` und schreibt Typ-Sektionen (`CR-SM-216`-Form).
   Determinismus: Sektionen nach Typ-Name sortiert, Knoten je Sektion nach `uid`.
3. `decode()` bezieht den Typ aus dem Parse-Ergebnis statt aus dem UID-Scan.
4. `_nodeTypeFor(graph, uid)` wird nur noch für die Sektionierung gebraucht — Aufrufe im Edges-Block
   entfallen.
5. `knownNodeTypes` wird nicht mehr zum Dekodieren gebraucht; bleibt nur, falls `validate()` es nutzt
   — sonst löschen.
6. Strict-Cross-Check aktivieren: graphcodes UIDs sind `TYPE-slug`, das Präfix muss zur Sektion
   passen. Widerspruch → `decode()` wirft (die Redundanz kostet bei `TYPE-slug` keine Token, siehe
   `CR-SM-216` §Risiko).

## File List (4)

- `src/codec.ts` — `encodeUid`/`decodeUid` raus, Typ-Sektionen rein, Header-Kontrakt neu geschrieben
- `tests/codec.roundtrip.test.ts` — Round-Trip + Determinismus gegen v2
- `tests/codec.validation.test.ts` — Strict-Cross-Check Präfix vs. Sektion
- `package.json` — `@sigloch/contracts` + `graph-api-core` auf die CR-SM-216-Majors

## Akzeptanzkriterien

- [ ] `encodeUid` / `decodeUid` existieren nicht mehr (grep leer, kein deprecated-Pfad)
- [ ] `encode()` auf `docs/graph/graphcode.graph.json`: keine UID enthält einen `.TYPE`-Suffix
- [ ] `encode(g)` zweimal → byte-identisch
- [ ] `decode(encode(g))` deep-equals `g`; `encode(decode(encode(g)))` === `encode(g)`
- [ ] Knoten unter falscher Typ-Sektion (`REQ-safety` unter `### MOD`) → `decode()` wirft
- [ ] Alle **291** Tests grün, `npm run build` grün
- [ ] MCP-Smoke: `graph_context` + `graph_impact` liefern v2-Text, Claude-Code-Session kann darauf
      mutieren (nicht nur Unit-Test)

## Abgrenzung

- Keine ID-Migration. `ACTOR-claude-code` bleibt `ACTOR-claude-code`.
- Kein npm-Publish hier; der Major-Bump von `@sigloch/graphcode` zieht der Release-CR.
- Der Kuzu-Store ist nicht betroffen — dort stand der Typ immer im Feld.

## Abschluss 2026-07-29

Blocker sind gefallen: `CR-SM-215`, `CR-SM-216` und `CR-GC-268` sind done.

- `encodeUid`/`decodeUid` **gelöscht**; UIDs reisen unverändert in beide Richtungen.
- `encode()` schreibt `### <TYPE>`-Sektionen; `decode()` nimmt den Typ aus
  `op.elementType` und wirft, wenn er fehlt — kein Raten aus der UID.
- Mitgefallen als toter Code: `_nodeTypeFor` und das Feld `knownNodeTypes`. Die
  Prüfung „Kante referenziert unbekannten Knoten" lag ohnehin schon in `validate()`.
- **Verhaltensänderung bei Implicit-Add:** Der Guard feuert jetzt eine Ebene früher —
  ein nicht deklarierter Knoten hat keine Typ-Sektion, also lehnt schon der Parser die
  Kante ab (`Cannot resolve type of target "..."`). Gleiche Garantie, präzisere
  Meldung; `codec.validation.test.ts` entsprechend nachgezogen.
- Nachgezogen, weil sie v1-Format-E enthielten: `TEMPLATE_FORMAT_E` (bootstrap.ts),
  die Orphan-Fixture in `bootstrap.test.ts`, `MEMBER_FORMAT_E` in `mvp-e2e.test.ts`.
- Zusätzlich aus dem Familien-Release: RD-04 (CR-SM-221) und MT-01..03 (CR-SM-222)
  brauchten Help-Texte (`viewer/help-content.ts`) und ein Gate — beide sitzen im CDR,
  Severity warning/info, also nie blockend.
- Volle Suite: **317/317**.
