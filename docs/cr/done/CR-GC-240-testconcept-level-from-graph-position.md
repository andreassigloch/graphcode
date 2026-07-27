# CR-GC-240 — Test-Concept: Pyramiden-Ebene aus Graph-Position statt `level`-Attribut

**Status:** done · 2026-07-07
**Paket:** `@sigloch/graphcode` (`src/exporter-views.ts` — `renderTestConcept` / `testLevel`)
**Quelle:** graph-view-edit Testkonzept-Session 2026-07-06 (Live-Befund; User-Vorgabe „level is defined by graph / position of req in graph")

## Problem (Befund)

`renderTestConcept` klassifiziert die Testpyramide über `testLevel(n)` — das liest ein **Attribut** am TEST-Knoten (`attributes.testRef.level`, sonst `attributes.level`), `src/exporter-views.ts:70–75`:

```ts
function testLevel(n: GraphNode): string {
  const ref = n.attributes['testRef'] as { level?: unknown } | null | undefined;
  if (ref && typeof ref === 'object' && typeof ref.level === 'string') return ref.level;
  const top = n.attributes['level'];
  return typeof top === 'string' ? top : '';
}
```

Reale TEST-Knoten tragen dieses Attribut praktisch nie (Concept-Tests haben keinen `testRef`; gebundene Tests setzen `testRef.level` selten). Folge: `e2e = integration = unit = 0`, `byLevel` landet auf `(unleveled)`, und die Pyramide degeneriert — **auch wenn jede REQ verifiziert und jede UC/SYS abgedeckt ist**:

- System-Zeile: `✗ 0 tests — NO end-to-end run exists` (obwohl `TEST-nfr`/`TEST-ops` System-REQ verifizieren).
- UC-Zeile: `0 / N UC exercised` — weil `scenarioTests` (Zeile 337–339) auf `testLevel(t) ∈ {e2e,acceptance,integration}` filtert; ohne Attribut ist die Menge leer, obwohl die `ucExercised`-Schleife (340–351) ansonsten korrekt über `compose`/`verify` läuft.

Die Ebene ist damit eine **redundante, driftende Wiederholung** dessen, was der Graph über `compose`/`satisfy` bereits eindeutig kodiert. Verstoß gegen „Rendern = reine Funktion des Graphen": die Funktion hängt an einem optionalen Attribut statt an der Topologie.

## Änderung

Die Pyramiden-Ebene eines Tests aus der **Position der verifizierten REQ** ableiten (nicht aus einem Attribut):

- Test `verify`t REQ, die `SYS` `compose`t → **e2e / System**
- Test `verify`t REQ, die eine `UC` `compose`t → **integration/acceptance / Use-Case**
- Test `verify`t REQ, die ein `FUNC` `satisfy`t → **unit / Function**

Ein Test erbt die Ebene(n) **aller** REQ, die er verifiziert (Mehrfachzuordnung erlaubt). NFR fällt automatisch korrekt: `nfr-*`/`ops-*` `compose`n `SYS` → ihre Tests landen auf System-Ebene, ohne Sonderfall.

Konkret in `src/exporter-views.ts`:
1. `testLevel` (attributbasiert) für die **Pyramiden-Klassifikation** durch `levelsOfTest(graph, t)` ersetzen — abgeleitet aus `verify.fwd(t)` → REQ → `compose.rev`(SYS/UC) bzw. `satisfy.rev`(FUNC). Rückgabe: Set von Ebenen.
2. `scenarioTests`-Filter (Zeile 337–339) fällt weg: eine UC gilt als „exercised", wenn eine von ihr `compose`-te REQ von **irgendeinem** Test verifiziert wird (die `ucExercised`-Schleife ist dann attributfrei korrekt).
3. `sysVerdict`/`sysGap`: `✓`, sobald ≥1 Test eine `SYS`-`compose`-te REQ verifiziert (e2e-Ebene nicht leer).
4. `testRef.level` und `method` (INCOSE TIAD) bleiben **deskriptive** Metadaten fürs Test-Inventar — nur nicht mehr die SoT der Pyramiden-Ebene.

## Akzeptanz

- [x] Graph mit 1 SYS, N UC, allen REQ verifiziert, **ohne** `level`/`testRef.level` an irgendeinem TEST ⇒ Pyramide zeigt System ✓, UC N/N, Function ✓.
- [x] Ein Test, der nur eine `SYS`-`compose`-REQ verifiziert, erscheint auf System-Ebene; ein Test auf einer `UC`-REQ auf Use-Case-Ebene; keiner braucht ein Attribut.
- [x] `renderTestConcept` 2× Lauf byte-identisch (Determinismus bleibt — unverändert per `adjacency()`/sorted-uid-Iteration).
- [x] `tests/exporter.test.ts`: Regressionsfall „unleveled tests, volle Coverage" ⇒ nicht mehr `✗ MISSING`.
- [x] `npm run build` + `npm test` grün (270/270).
- [ ] `exporter-views.ts` < 500 Zeilen — **war bereits vor diesem CR verletzt** (709 Zeilen, jetzt 739). Datei enthält 12 unabhängige View-Renderer; ein Split ist ein eigener CR (Scope-Grenze, nicht Teil von CR-240).

## Umsetzungsnotiz

`levelsOfTest()` prüft nur den UNMITTELBAREN `compose`-Parent einer REQ (SYS oder UC). Eine REQ, die über `REQ compose REQ` (Sub-Requirement-Zerlegung) an SYS/UC hängt, wird dadurch nicht rekursiv aufgelöst — außerhalb des CR-Scopes (3 explizite Fälle: SYS/UC/FUNC), betrifft aktuell keinen Akzeptanztest. `testRef.level`/`method` bleiben deskriptiv (SRS-Render zeigt sie weiter pro REQ-Eintrag).

**Konsument-Hinweis:** `docs/views/testconcept.md` (committed, `graph_export`-Output) ist jetzt STALE relativ zur neuen Render-Logik — Re-Export über die `graph_export`-MCP-Tool empfohlen, aber nicht in dieser Session ausgeführt (der laufende MCP-Server-Prozess müsste zuerst den neuen Build geladen haben; nicht ohne Rücksprache angestoßen).

## Dependencies / Kontext

- Baut auf **CR-GC-220** (renderTestConcept existiert) auf; korrigiert dessen Ebenen-Ableitung. Kein neuer View, kein neues Schema.
- **Konsument-Hinweis (kein Teil dieses CR):** `graph-view-edit` pinnt `@sigloch/graphcode@0.1.0` (4-View-Exporter, kein `renderTestConcept`) — dort ist der lokale `.claude/skills/se-view-testconcept.md` bis zum Paket-Upgrade auf **v3** (MCP-Hand-Render, Ebene aus Position) gepatcht. Nach diesem CR + Republish kann der Skill wieder Thin-Trigger auf die deterministische View werden.

## Files (≤6)

- `src/exporter-views.ts` — `renderTestConcept` + Ersatz von `testLevel` durch positionsbasierte `levelsOfTest`
- `tests/exporter.test.ts` — Regressionsfall attributfreie Pyramide
