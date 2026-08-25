# CR-GC-419 — Das Zielprofil bekommt seinen Datenvertrag

**Status:** done — 2026-08-25 (graphVersion 200)
**Herkunft:** CR-GC-409 §A, Paket „Policy/Profil" — die Profil-Hälfte.
**Ziel:** R-31 für `FUNC-target-profile-load` schließen.

## Befund

`.graphcode/target-profile.json` hat zwei Schreiber (den Skill `se:target-profile`
und einen Hand-Edit) und mehrere Leser (der Runden-Prompt liest die
Intentions-Anker, das Suggestion-Ranking die ℝ⁶-Gewichte). Im Modell hing
`FUNC-target-profile-load` an keiner `io`-Kante (R-31) — der Weg der Datei, der
die ganze Steuerung trägt, stand nirgends.

Der Vertrag existiert und wird geprüft (`TargetProfileSchema.safeParse` bei
JEDEM Load, auch beim Hand-Edit). Er lag nur in der Datei des Lesers.

## Umfang

**Code**
- `src/target-profile-contract.ts` (neu): `TargetWeightsSchema` und
  `TargetProfileSchema` ziehen um. Reiner Umzug, keine Verhaltensänderung —
  `target-profile.ts` importiert sie und re-exportiert sie, damit es weiterhin
  genau EINE Definition gibt.
  Grund: der Vertrag gehört keiner der beiden Seiten; formal verlangt RC-04
  Import UND `parse` am modellierten Interface, und eine Deklaration im selben
  File zählt nicht.

**Modell (gate-only, `graph_mutate`)**
- `FLOW-target-profile` + `SCHEMA-target-profile` (realRef `TargetProfileSchema`)
- io: `FUNC-target-profile (Skill) → FLOW-target-profile → FUNC-target-profile-load
  → FLOW-target-profile → {FUNC-generation-step, FUNC-graph-suggest}`

`FUNC-generation-step` ist nicht kosmetisch: es ist das einzige Glied der
`FCHAIN-steering-loop`, das das geladene Profil wirklich liest
(`profile?.profile.intentAnchors` steuert jede Runde) — ohne diese Kante stünde
`target-profile-load` als eigene io-Komponente in seiner Kette und meldete IO-01.

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 5 | 4 |

`MT-02` für `MOD-steering` verbessert sich von LCOM4=5 auf 4 — die Kanten
verbinden zwei bisher getrennte Gruppen.

## Abnahme

Bestehend: `tests/target-profile.test.ts` (16 Fälle, u. a. „ungültige Datei
scheitert laut mit Pfad — nie stumm als kein Profil"), `tests/generate.test.ts`
und `tests/mcp.suggest.test.ts` fahren beide Leser gegen echte Dateien.
