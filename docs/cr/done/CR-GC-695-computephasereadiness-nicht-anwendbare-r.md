# CR-GC-695: computePhaseReadiness: nicht anwendbare Regel nicht als erfuellt zaehlen (ruleApplies, CR-SM-372) + Nachzuege FC-05/R-16

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-609 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-609.json (Lane: code)

---

Aus CR-SM-343/372 (SM a163f7a, 2026-09-27): contracts/se-engine lassen eine Regel, deren Vorbedingung nicht erfuellt ist, aus dem Nenner (ruleApplies/RULE_PRECONDITION; CR-R05 ohne CR-Knoten = nicht ausgewertet). graphcode computePhaseReadiness zaehlt eine Regel ohne Befunde als erfuellt - CR-R05 liest dort auf einem Graphen ohne CRs als bestanden. Auf ruleApplies umstellen (nach contracts-Publish, Peer-Floor heben). Dazu Nachzuege nach dem Publish: Kennzahlen-Spike liest FC-05-Befund als nicht bewertbar; se:author-actor-Hinweis auf den kaputten R-16-fix_hint entfernen (CR-SM-371 behebt ihn).

---

## Umfang laut `graph_impact`

Aus dem committeten Snapshot (Host dieser Sitzung auf altem Code): `computePhaseReadiness` ist
`FUNC-compute-phase-readiness` (satisfy REQ-steering-from-metrics); Aufrufer `report.ts`
(graph_readiness) und `steering-snapshot.ts` (Steuerraum). Bindung 3/3 Quelldateien, Spur
`verify:code`: 27 Dateien.

## Ergebnis

- `computePhaseReadiness(violations, countByType)`: eine Regel, fuer die contracts `ruleApplies`
  (`RULE_PRECONDITION`, CR-SM-343/372) nein sagt, steht weder in `covered` noch in `total`. Heute
  betrifft das CR-R05 (Vorbedingung: mindestens ein CR). Der zweite Parameter ist Pflicht — beide
  Aufrufer reichen `typeCounts(...)` ihres Graphen, kein stiller Default. Kein eigener
  Vorbedingungs-Katalog in graphcode.
- graphcodes Eigenmodell traegt 304 CR-Knoten → dort keine Zahlaenderung; wirksam auf Graphen ohne
  CR (`cr: docs`): TRR `total` −1, CR-R05 zaehlt nicht mehr als erfuellt.
- Nachzug Kennzahlen-Spike (`scripts/spike-kettenkennzahlen.mjs`): "messbar" liest FC-05 (contracts
  `fc05ChainConnected`, der eine Leser) statt der eigenen Komponenten-Rechnung; nicht bewertbar ist
  eine Kette mit FC-05-Befund oder mit einem Glied ohne io-Eingang/-Ausgang (dann urteilt FC-05 nicht,
  R-31 meldet es). Komponenten/lose/fehlendes Glied/Sack bleiben als Diagnose. Positivkontrolle und
  Gegenprobe weiter OK; ueber 76 Korpus-Ketten aendert sich das Urteil an 2 (graphcode
  FCHAIN-live-update, FCHAIN-snapshot-freshness: zusammenhaengend, aber ein Glied ohne io → jetzt
  nicht bewertbar), K-MESSBAR 2/10 und K-INFO r = −0,43 unveraendert.
- Nachzug `se:author-actor`: der Hinweis auf die widersprechenden Regeltexte (R-16-fix_hint, CL-01)
  ist entfernt — beide sind in den gelinkten contracts behoben (CR-SM-371 `85a1dc6`; CL-01 zaehlt
  ueber `ACTOR → FLOW → FUNC`).
- **Peer-Floor:** `ruleApplies`/`RULE_PRECONDITION`/`fc05ChainConnected` sind Neu-Exporte der noch
  unveroeffentlichten contracts (Paketversion weiter 10.12.0) — Floor im Release-Schritt, wie
  CR-GC-671.

Tests: rot gesehen (neuer Fall in `readiness.model`, ohne `ruleApplies` rot), dann gruen;
`steering.process-ratchet`, `steering-snapshot` auf die neue Signatur. Spur `verify:code` 27 Dateien
+ Skill-Tests: 28/30 gruen, rot nur `readiness.model` "EXHAUSTIVELY span all V3_RULES" (RC-10, CR-SM-344,
ohne CR) und `skill-rule-ids` (e) (vorher schon rot).

**Volle Suite (Link-Modus, Worktree):** 18 Dateien / 36 Tests rot, 170 gruen — keine davon beruehrt
diesen Diff (dieselbe Menge wie nach CR-GC-670, abzueglich der dort gruen gewordenen). `rig-measured`
ist nur im Worktree rot (erwartet `<repo>/.graphcode/kuzu`, das der Worktree nicht hat), im
Hauptbaum gruen.
