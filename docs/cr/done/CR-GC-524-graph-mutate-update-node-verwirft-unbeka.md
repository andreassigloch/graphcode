# CR-GC-524: graph_mutate update-node verwirft unbekannte Felder still und meldet trotzdem Erfolg

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-103 (bug)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-103.json (Lane: code)
**Commit:** ab144b5

---

## 1. Root Cause

`MutateCommandSchema` (contracts) ist ein nicht-striktes Zod-Objekt: `safeParse` STREICHT
unbekannte Schluessel. `{op:'update-node', node:{uid, realRef:{…}}}` — die Form, die man nach
dem Lesen des abgeflachten Exports schreibt — parst sauber zu `{uid}`, `applyCommands` baut
den Knoten aus der Basis neu (identisch), schiebt ihn trotzdem ins Delta, das Gate meldet
`mutations: 1`, `recordAudit` zaehlt `graphVersion` hoch. Drei Stellen sagen Fortschritt, wo
keiner ist.

## 2. Impact

Jeder Aufrufer, der dem Verdict vertraut (Agent, Skill, Export danach), traegt stille Drift
in den Commit. Kein Datenverlust — der Store bleibt, wie er war; falsch ist nur die Zusage.

## 3. Aenderung

- `src/kernel/gate.ts` (Step 0): nach erfolgreichem Parse werden die Schluessel des rohen
  Kommandos gegen die Shape der passenden Union-Option gelaufen (rekursiv in `node`/`edge`/
  `set`, nicht in Records wie `attributes`). Unbekannte Felder → `SCHEMA-01`, Batch blockt,
  Meldung nennt das Feld und den richtigen Ort (`node.attributes`). Gilt fuer add-node UND
  update-node — dieselbe Wache, kein Sonderpfad. Entscheidung: ablehnen, nicht als Attribut
  annehmen (das waere eine zweite Schreibform neben `attributes`).
- `src/kernel/apply-commands.ts`: ein Upsert, dessen Ergebnis dem Basisknoten strukturell
  gleicht (Schluesselreihenfolge egal), geht nicht ins Delta.
- `src/kernel/gate.ts` (Step 4): `setExportPending` nur bei `mutations > 0`.
- `src/surface/tool-context.ts` `recordAudit`: `graphVersion` steigt nur bei
  `success && mutations > 0`. Audit-Eintrag bleibt `applied` (nichts wurde abgelehnt).

Contracts-Schema unveraendert (kein `.strict()` in sigloch-modules — ausserhalb dieses CR).

## 4. Dateien (4 + CR)

- `src/kernel/gate.ts`
- `src/kernel/apply-commands.ts`
- `src/surface/tool-context.ts`
- `tests/mutate.schema-guard.test.ts` (TEST-mutate-schema-guard, +3 Faelle)

## 5. Test-Nachweis

Rot zuerst: 3 neue Faelle rot (update-node mit `realRef` auf Knotenebene → success:true;
add-node dito; No-op-update → mutations 1, graphVersion 1→2). Nach dem Fix:
`npx vitest run tests/mutate.schema-guard.test.ts` 7/7 gruen (vorher 4). Gate-Umfeld
(33 Dateien: mutate.*, harness.gate, mcp.mutate-*, gate.single-door, schema-guard, alle
Dateien mit `graphVersion`): 275/275 gruen, 62 s. `npm run build` gruen.

Volllauf danach: 1 rot — `tests/verify-model.completeness.test.ts`, weil der neue
Testkommentar den SSOT-Pfad woertlich nannte und die Datei damit als modellrelevant
klassifiziert wurde, obwohl sie weder SSOT noch Regelkonstanten liest. Kommentar umformuliert
(Folge-Commit), keine Ausnahme in `model-test-set.mjs`.

## 6. Modell

Keine neuen Symbole, keine neue Testdatei: `FUNC-mutate` (gate.ts#apply),
`FUNC-tool-context` (tool-context.ts#createToolContext), `TEST-mutate-schema-guard`
(tests/mutate.schema-guard.test.ts) — alle realRef/testRefs loesen weiter auf (per grep der
Symbole belegt). Bewusst offen: der MCP-Host dieser Session ist an den bok-Store gebunden,
RC-*/readiness gegen das graphcode-Modell wurde deshalb nicht per Tool, sondern nur per
Symbolpraesenz geprueft.
