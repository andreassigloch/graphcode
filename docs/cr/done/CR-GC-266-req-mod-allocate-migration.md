# CR-GC-266: REQ→MOD allocate migrieren (CR-228 Teil A, graphcode-Seite)

**Status:** Done (2026-07-26) · **Max Files:** 3
**Herkunft:** Familien-CR-228 („Ontologie-Evolution — physisches MOD, satisfy-Dreiklang, realRef",
`aimpro/docs/cr/open/`) Teil A. Der CR verlangt ausdrücklich Abstimmung mit dem graphcode-SSOT;
dies ist diese Seite.

## Problem (Why)

CR-228 Teil A entfernt das Trace-Pattern `REQ → MOD (allocate)` aus `@sigloch/contracts/se`
(META_MODEL 1.4.0) und löscht R-24/R-25, die nur dieses Muster prüfen. Begründung dort: `allocate`
behandelt MOD fälschlich als REQ-Besitzer; REQ-Besitz liegt bei SYS/UC (`compose`), Erfüllung bei
FUNC/FCHAIN/MOD/SYS (`satisfy`).

graphcodes eigenes Modell trägt **8** solche Kanten. Sobald die contracts-Änderung gebaut ist,
lehnt schon das Kuzu-DDL sie ab („Query node s violates schema. Expected labels are FUNC") — 28
Tests fallen, `graph_reseed` aus dem committeten SSOT läuft auf denselben Fehler. Der Befund ist
beim Sibling-Rebuild im Rahmen des Publish-Audits aufgeschlagen, nicht theoretisch.

## Design

1. **Richtung drehen, Bedeutung behalten:** aus `REQ -allocate-> MOD` wird `MOD -satisfy-> REQ`.
   Alle 8 Fälle sind Modul-Constraints („Dashboard strikt read-only", „Bridge read-only",
   „Health = echter Funktionscheck", „versioned Diff-Broadcast", „TEST hat lauffähige Bindung") —
   also genau die Aussage, die `MOD → satisfy → REQ` trägt.
2. **Jetzt statt nach CR-228:** `MOD → satisfy → REQ` ist im **committeten** Meta-Modell bereits
   legal (Zeile 45, seit CR-154) und bleibt es unter 1.4.0. Die Migration ist damit in beiden
   Richtungen kompatibel und braucht das Landen von CR-228 nicht abzuwarten.
3. **Durchs Gate, nicht am JSON:** `graph_mutate` mit `delete-edge`/`add-edge`, danach
   `graph_export` — kein Hand-Edit des SSOT (`REQ-gate-only-writes`).

## Akzeptanzkriterien

- [ ] 0 `REQ -allocate-> MOD`-Kanten im SSOT; 8 neue `MOD -satisfy-> REQ`.
- [ ] `rules_evaluate` bringt keine neue Error-Violation (Compliance bleibt 1.0).
- [ ] `npm test` grün gegen die gebaute contracts-Arbeitskopie **und** gegen den committeten Stand.
- [ ] Kein Hand-Edit an `docs/graph/graphcode.graph.json` (nur Gate + Export).

## Close-Befund (2026-07-26)

- 8 Kanten gedreht, `rules_evaluate` sauber: Compliance bleibt 1.0, und die **8 R-24-Warnungen
  („Redundant REQ→MOD allocation") sind weg** — sie hingen genau an diesen Kanten. Rest-Warnungen
  unverändert (R-04/1, R-21/2, R-22/2, R-26/9, RC-05/6).
- 314/314 Tests grün gegen den aktuellen contracts-Stand.
- **Messhinweis:** Während der Umsetzung wechselte die contracts-Arbeitskopie (CR-228 Teil A war
  zwischenzeitlich gebaut, dann wieder auf META_MODEL 1.3.0 zurück). Die Migration ist von diesem
  Hin und Her unabhängig, weil `MOD → satisfy → REQ` in **beiden** Meta-Modell-Ständen legal ist.
- **Offener Rest für den Tag, an dem CR-228 Teil A landet** (nicht hier, weil er graphcode an die
  neue Version koppelt und gegen die alte bricht):
  1. `tests/mcp.impact.test.ts` baut in seiner Fixture selbst ein `REQ-A -allocate-> MOD-DEP` —
     braucht eine andere ausgehende REQ-Kante.
  2. `src/readiness.ts` listet `R-24`/`R-25` in `PHASE_GATE_RULES.CDR`; der Exhaustiv-Test
     „gates span all V3_RULES" schlägt fehl, sobald die beiden Regeln aus `V3_RULES` verschwinden.

## Nicht in diesem CR

CR-228 Teil B (NFR-01-Budget-Ziele), Teil C (`realRef`-Vereinheitlichung), Teil D
(RULE_TO_DIMENSION) — das ist contracts-Arbeit und zieht eigene graphcode-Folgen nach sich.
