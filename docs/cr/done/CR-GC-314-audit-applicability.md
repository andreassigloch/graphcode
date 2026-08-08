# CR-GC-314 — Positive Entscheidungen im Audit-Trail

**Status:** done · **Datum:** 2026-08-08 (vereinfacht) · **Abgeschlossen:** 2026-08-08
**Ziel:** graphcode 0.8.0 · graph-api-core 2.1.0
**Ontologie:** v4.0.0 — **unverändert** (keine neuen ElementTypes/TraceTypes/Rules)

---

## 1. Problem

Der Audit-Trail hält nur die **negative** Evidenz fest: welche Regeln verletzt wurden. Was eine
Mutation *bestätigt* hat, steht nirgends — ein `accepted` ohne Violations ist ein leeres Feld.

Für einen späteren Lernmechanismus ist genau das die fehlende Hälfte: aus „Regel R-18 hat diese
Mutation geprüft und für gut befunden" lässt sich lernen, aus „keine Violation" nicht.

---

## 2. Ziel

Jeder Audit-Record trägt zusätzlich die Regeln, die bei dieser Mutation **ohne Befund** durchliefen,
plus die Regelsatz-Version, gegen die evaluiert wurde. Kein Verhaltenswechsel des Gates.

---

## 3. Nicht-Ziele

- Keine neuen Regeln, keine Änderung an Rule-Semantik oder Gate-Entscheidungen.
- Keine Kennzahl, kein Coverage-Score, kein Panel — der Trail ist Rohmaterial, kein Report.
- Kein Einfluss auf Readiness.
- Keine nachträgliche Anreicherung alter Records (wäre Rekonstruktion gegen eine Regelversion,
  die zum Mutationszeitpunkt nicht galt).

---

## 4. Anforderungen

| REQ | Kind | Anforderung | Verification |
|---|---|---|---|
| REQ-A01 | functional | `recordAudit()` schreibt `rulesPassed` = registrierte Rule-IDs minus IDs mit Violation dieser Mutation. | test |
| REQ-A02 | functional | Jeder Record trägt `rulesetVersion` (Version des geladenen Regelsatzes aus dem Paket, nicht aus Config). | test |
| REQ-A03 | non-functional | Ableitung aus der bestehenden Rule-Eval — kein zweiter Durchlauf, keine neue Engine-API. | test |
| REQ-A04 | non-functional | Nur Rule-IDs + Version, nie Regeltext. | analysis |
| REQ-A05 | negative | Records ohne die Felder (Altbestand) bleiben lesbar und gültig; Konsumenten dürfen sie nicht als „nichts bestanden" lesen. | test |
| REQ-A06 | non-functional | `audit_trail` gibt `rulesPassed` **nicht** per Default aus — nur bei explizitem `includeRulesPassed: true`. Das Feld ist Lernmaterial für den Datei-Leser, kein Agenten-Kontext. | test |

---

## 5. Betroffene Module

| Modul | Änderung | Bump |
|---|---|---|
| `graph-api-core` | `AuditEntry` um `rulesPassed?: string[]`, `rulesetVersion?: string` erweitert | minor → 2.1.0 |
| `graphcode` | `mutate()` gibt die bestandenen Rule-IDs zurück; `recordAudit`/`recordPreview` schreiben sie | minor → 0.8.0 |
| alle übrigen | keine (Felder optional/ignorierbar) | — |

---

## 6. Datenmodell

Additiv, pro Audit-Record:

| Feld | Inhalt |
|---|---|
| `rulesPassed` | Rule-IDs, die evaluiert wurden und für diese Mutation keine Violation lieferten |
| `rulesetVersion` | Version des Regelsatzes, gegen den evaluiert wurde |

`violations` (bestehend) bleibt die negative Hälfte — beide zusammen sind der vollständige Befund.

Der Trail liegt lokal pro Store (`.graphcode/audit.jsonl`, `FileOperationsLog` aus graph-api-core,
instanziiert in `tool-context.ts`) — kein zentraler Dienst. Konsument der Positiv-Hälfte ist der
Datei-Leser (späterer Lernmechanismus), nicht der Agent (REQ-A06).

---

## 7. Akzeptanzkriterien

1. [x] Eine akzeptierte Mutation ist im Trail an den Regeln erkennbar, die sie bestätigt haben.
2. [x] Ein Regelsatz-Wechsel ist an `rulesetVersion` der betroffenen Records ablesbar.
3. [x] Gate-Verhalten unverändert gegenüber 0.7.0 — identische Accept/Reject-Entscheidungen auf
   identischem Input.
4. [x] Alte Records ohne die Felder werden von `audit_trail` weiterhin fehlerfrei ausgegeben.
5. [x] `audit_trail` ohne `includeRulesPassed` liefert byte-identisch dasselbe wie vor dem CR — die
   Agenten-Payload wächst nicht.

---

## 8. Umsetzung

| Datei | Änderung |
|---|---|
| `graph-api-core/src/audit.ts` | `AuditEntry` um `rulesPassed?: string[]` + `rulesetVersion?: string` |
| `graphcode/src/tool-context.ts` | `positiveHalf(result)` — Mengendifferenz; `recordAudit` **und** `recordPreview` schreiben sie |
| `graphcode/src/tools/report.ts` | `includeRulesPassed` (Default `false`), Projektion auf dem Rückweg |
| `graphcode/tests/audit.rules-passed.test.ts` | 8 Tests |

**Abweichung von §5:** Die Modul-Tabelle sagt „`mutate()` gibt die bestandenen Rule-IDs
zurück". Umgesetzt ist die Ableitung direkt in `recordAudit`/`recordPreview` — dieselbe
Menge, aber ohne `MutateResult` zu erweitern. Das wäre ein contracts-Schema-Eingriff, den
dieselbe Tabelle unter „alle übrigen: keine" ausschließt. Die Tabelle gewinnt gegen die
Prosa; REQ-A03 (kein zweiter Durchlauf, keine neue Engine-API) ist damit trivial erfüllt:
es ist reine Mengenarithmetik über den registrierten Katalog und die Violations, die das
Ergebnis ohnehin trägt.

**Kappung auf dem Rückweg, nicht beim Schreiben.** Der Trail auf Disk ist der Lernkorpus
und muss vollständig sein; die Agenten-Payload ist ein anderes Publikum mit anderen Kosten.
`audit_trail` entfernt das Feld beim Ausliefern — per **Abwesenheit**, nie als leeres Array:
`[]` hieße „nichts bestanden", das genaue Gegenteil der Wahrheit (REQ-A05).

## 9. Nachweis

Mutationsprobe: Kappung deaktiviert → genau die zwei REQ-A06-Tests werden rot
(„WITHHOLDS … by default", „withholds by ABSENCE"). Die sechs übrigen bleiben grün — sie
prüfen das Schreiben, nicht das Ausliefern.

**Verworfener erster Anlauf:** gebaut wurde zunächst gegen die frühere, größere CR-Fassung
(Applicability/Gate-Coverage): `RuleDefinition.appliesTo` in contracts, `RuleEvaluation` +
`evaluateWithApplicability` in graph-api-core, `ruleEvaluations` im Audit-Record. Alles
zurückgenommen — die vereinfachte Fassung schließt Coverage-Kennzahlen aus (§3), listet
contracts gar nicht als betroffen (§5) und verbietet eine neue Engine-API (REQ-A03).
`rulesPassed` braucht keine Scope-Deklaration, weil es die Differenz gegen den
*registrierten* Katalog bildet, nicht gegen den *zuständigen*.
