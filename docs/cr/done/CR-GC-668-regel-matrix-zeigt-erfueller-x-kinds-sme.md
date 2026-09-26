# CR-GC-668: Regel-Matrix zeigt Erfueller x kinds, Smeagol prueft Wertebereiche

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-578 (idea)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-578.json (Lane: code)

---

ZIELBILD (ITEM-2026-575, Diskussion 2026-09-25): REQ.kinds = genau EIN Wert aus {functional, non-functional}. functional -> FUNC; non-functional -> MOD (lokales Budget) | SYS (Systemebene) | FCHAIN (Ende-zu-Ende). Ohne kinds kein Erfueller (BQ-07). pre-/postcondition entfallen (Vorbedingung = Eingangs-FLOW der Kette, Nachbedingung = UC-Ziel, geprueft ueber R-21). risk/mitigation werden ein Rollen-Attribut (FM-01..03), satisfy-neutral. Gemischtes functional+non-functional = falsch zerlegt -> teilen.

BEFUND: Die Regel-Matrix (T-H2, scripts/regel-matrix.mjs -> docs/views/regel-matrix.md) fuehrt R-18 und BQ-07 als Zeilen, aber keine where-Praedikate der TRACE_PATTERNS. Welche REQ-Art welcher Erfueller-Typ tragen darf, steht dort nicht und ist nicht pruefbar. Der Smeagol-Check (CR-GC-571) prueft in Ratgebern nur, ob eine genannte Regel-ID existiert (Stufe a), nicht, ob genannte kinds-Werte und satisfy-Paare legal sind. Ein Skill, der nach dem Umbau noch "precondition" lehrt, bliebe gruen.

ZIEL: (1) Matrix um eine aus TRACE_PATTERNS generierte Tabelle "Erfueller x kinds" erweitern (Quelle: @sigloch/contracts/se, nie abgeschrieben). (2) Smeagol-Stufe: jeder in Skills/Help/Executor-Vorbild genannte kinds-Wert liegt in ReqKind; jedes dort gezeigte satisfy-Paar mit kinds ist nach TRACE_PATTERNS legal.

UMFANG (laut grep, <= 10 Dateien): scripts/regel-matrix.mjs, docs/views/regel-matrix.md, tests/skill-rule-ids.test.ts oder neu tests/skill-kinds-werte.test.ts, ggf. Test zum Matrix-Generator.

ABNAHME: Matrix zeigt die Tabelle; der Check ist heute gruen (6 Werte legal) und wird nach dem Ontologie-Major ([3]) rot an genau den Ratgebern, die [7]/[8]/[9] umstellen — er ist die Arbeitsliste und die Schranke der Kette. Positivkontrolle: ein kuenstlich illegales Beispiel wird gemeldet.

REIHENFOLGE der Kette (9 CRs): [1] GC Regel-Matrix + Smeagol-Wertebereich -> [2] SM Rollen-Attribut risk/mitigation -> [3] SM kinds auf zwei Werte + FCHAIN nur NFR (mit [2] EIN Ontologie-Major, Publish durch den Auftraggeber) -> [4] GC Migrationswerkzeug (vor dem Publish baubar) -> [5] GC Eigenmodell migrieren (graph-Lane) -> [6] GC Kern + Peer-Floor -> [7] GC Loop/Executor -> [8] GC Projektionen -> [9] GC Skills + Help. Danach Datenmigration je Familien-Repo (eigene Items, sobald [4] steht). Dies ist [1] — zuerst, damit er die uebrigen Schritte absichert.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
