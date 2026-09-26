# CR-GC-674: SE-Skills und Help auf zwei REQ-kinds

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-585 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-585.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

BEFUND: Die ausgelieferten SE-Skills lehren pre/postcondition und mitigation als kinds und damit FCHAIN/MOD-Erfueller, die es kuenftig nicht mehr gibt. graphcode liefert die Skills per Scaffold an alle Consumer aus (sigloch-modules traegt eine veraltete Kopie) — ein falscher Skill wird woertlich abgeschrieben (CR-GC-655).

ZIEL: author-req/author-uc lehren genau zwei kinds und die Erfueller-Tabelle; Vor-/Nachbedingung eines UC stehen im Eingangs-FLOW bzw. im UC-Ziel, nicht als REQ; FMEA-Skills setzen das Rollen-Attribut.

UMFANG (laut grep, <= 10 Dateien): .claude/commands/se/author-req.md, se/author-uc.md, se/top-level.md, se-plan.md, se-conops.md, se-view/conops.md, se-fmea.md, se-view/fmea.md, se/help.md.

ABNAHME: Smeagol-Check aus [1] gruen fuer alle Skills (ohne Ausnahmeliste); Consumer ziehen die Skills per aise rollout nach.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [9].

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
