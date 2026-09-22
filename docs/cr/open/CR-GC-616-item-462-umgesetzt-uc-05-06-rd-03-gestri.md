# CR-GC-616: ITEM-462 umgesetzt: UC-05/06/RD-03 gestrichen (UC-Schreibregel), MT-02 warning, Fix-Roundtrip-Test, Folge-Regel-Spalte

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-477 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-477.json (Lane: graph)

---

ENTSCHEIDUNG AUFTRAGGEBER 2026-09-22 zu ITEM-2026-462 ('wie vorgeschlagen'; Aehnlichkeit ITEM-2026-464 bleibt offen). GEMESSEN ueber 21 Graphen (20 Familie + sigllm-Golden) und Leser in graphcode src: (1) UC-05/UC-06 (Pre-/Postcondition, info): 2 Leser in src, feuern in 14 von 21 Graphen an fast jedem UC — werden Schreibregel in se:author-uc (Praezedenz BQ in author-req, CR-GC-602) und als Regel gestrichen. RD-03 (keine vorzeitige Zerlegung, info): 0 Leser, feuert in 1 von 21 Graphen einmal — gestrichen (Gate 3 der Grammatik-Review: Regel ohne Leser und ohne Feuern). MS-03 (CR ohne Meilenstein, info): feuert 62x graphcode / 73x gve — bleibt info, Task plan (als warning wuerde sie den Plan-Task fluten). MT-04 (0 Leser, 2 Funde graphcode) und VR-01 (7 Leser in src) bleiben. (2) MT-02 info -> warning: Steuerregel darf nicht info sein; Messung: 0-1 Fund je Graph, moneyflow 9/155 MOD — kein Fluten des Kern-Fokus. (5) Fix-Roundtrip-Test nach Clippy-.fixed-Muster: fuer jede Regel mit Fix-Vorlage (se-engine fix-templates/rule-apply) Trigger-Fixture -> Vorlage anwenden -> Fund weg, kein neuer error-Fund. (6) Folge-Regel-Spalte in der Regel-Matrix: aus demselben Roundtrip die Regeln, die NACH dem Fix neu feuern; als generierter Snapshot in se-engine (Regel -> {cleared, sequels}), von scripts/regel-matrix.mjs gelesen. RULES_VERSION MAJOR (drei Regeln entfallen).

---

## Stand 2026-09-22 — angefangen, NICHT gemergt (Fortsetzung nach Restart)

Code liegt committet auf Branch `item/ITEM-2026-477` in graphcode (Worktree entfernt, Branch bleibt:
`git worktree add ~/.aise-lanes/graphcode-ITEM-2026-477 item/ITEM-2026-477 && npm ci`).

**Fertig auf dem Branch (Textteil, kompatibel mit contracts 10.10)**
- `se:author-uc`: Schreibregel Vor-/Nachbedingung als REQ mit kinds (ohne Regel-IDs).
- Leser von UC-05/06 umgestellt: `authoring-example.ts`, `conformance.ts` (Kommentar),
  `scripts/spike-hint-konformanz.mjs`, Tests `focus-set` (info-Beispiel jetzt MT-04), `generate`,
  `steering.artifact-coupling`, Fixture `steering-graphs.ts` (UC-05/06-Reparaturfaelle weg).
  5 betroffene Testdateien gruen (91 Tests).

**Offen**
1. Diesen Textteil zuerst nach master mergen — contracts `check:grammar` sweept den Haupt-Worktree.
2. Nach contracts-Release: Floors heben (contracts, se-engine), `scripts/regel-matrix.mjs` Spalte
   **Folge-Regeln** aus `FIX_ROUNDTRIP` (@sigloch/se-engine) + Spalte **Fix** (applied/cleared),
   Matrix neu generieren.
3. `claims.conformance` + drei Artikel: engine rules 69 → 66.
4. `skill-rule-ids.test.ts`: das `it.todo` „Steuerregel nie info" scharf schalten (MT-02 ist warning).
5. Volle Suite, Merge, CR-Knoten-Kanten (CR-GC-616 → FUNC-author-uc, FUNC-generation-step), Export.
