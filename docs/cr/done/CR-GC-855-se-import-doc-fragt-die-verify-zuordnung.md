# CR-GC-855: se:import-doc fragt die verify-Zuordnung ab (graphify CR-GF-144 Schritt 4)

**Status:** ✅ Done (2026-10-26)
**Typ:** aus Item ITEM-2026-1078 (idea)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1078.json (Lane: code)

---

## Ziel

Schritt 4 aus graphify CR-GF-144: graphify nimmt `verifies` an einer TEST-Entscheidung an und
meldet verworfene Zuordnungen in `McpExtractResponse.rejectedVerifies`. Der Skill `se:import-doc`
fragt in Stufe 1 zu jeder REQ-Entscheidung den deckenden TEST ab, schreibt ihn als `verifies` in
`decisions.json` und zeigt `rejectedVerifies` nach Stufe 2 dem Nutzer.

## Änderung

- `.claude/commands/se/import-doc.md`: Frage (d) verify-Zuordnung, Beispiel-`decisions.json` mit
  `verifies`, `rejectedVerifies` in der Ausgabe von Stufe 2 und unter „Ergebnis deuten",
  Voraussetzung graphify ≥ CR-GF-144.
- `bok/docs/governance/graphify-governance.md` §2 (bok-Commit 35307a9): `candidateId`,
  `realRef`, `anchor`, `confidence` und `verifies` (StructureDecision) nach graphify `src/schema.ts`.
- Modell: Beschreibung `FUNC-import-doc`.

## Befunde

- Rig-Code und kopierter Inline-Hash: in graphcode nicht mehr vorhanden. Das Rig
  `rig/import-doc-live/` (Live-Lauf CR-GC-337) ist mit 43b966cd (CR-GC-678) gelöscht; dort lagen
  nur `.graphcode`-Artefakte im Git, die Skripte waren nie committet. Suche nach `cand_`, `sha1`,
  `candidateId`, `createHash` in Quellen, Skripten, Skills und Tests: kein Treffer zum Hash.
  Der Skill adressiert Knoten per Skelett-Name; `candidateId` braucht er nicht.
- Version: die Registry-Version `@sigloch/graphify@0.5.2` hat weder `verifies` noch
  `rejectedVerifies` noch den `candidateId`-Export; die Arbeitskopie trägt dieselbe Nummer 0.5.2.
  Build und Tests von graphcode brauchen die neue Version nicht (kein Code-Import). Der Skill
  braucht sie zur Laufzeit; bis zum Release nur im Link-Modus nutzbar.
- Die verteilten Skill-Kopien in Member-Repos (z. B. `bok/.claude/commands/se/import-doc.md`,
  `bok/.opencode/skills/se-import-doc/`) ziehen erst mit dem nächsten `graphcode upgrade` nach.

## Prüfung

- Smoke gegen die graphify-Arbeitskopie (`src/`, tsx): Skelett eines Lastenhefts mit
  Ladesteuerung/Sicherheit/Abnahme, die Beispiel-`decisions.json` parst, `verifies` ergibt zwei
  Kanten `TEST -verify-> REQ`; `verifies` an einer REQ-Entscheidung wird abgelehnt.
- Stufe 2 nicht live gefahren: braucht das lokale LLM und die unveröffentlichte graphify-Version.


---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 897, Tiefe 1, Wurzeln: `FUNC-import-doc`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se/import-doc.md

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
