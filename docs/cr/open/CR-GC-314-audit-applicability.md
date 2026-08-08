# CR-GC-314 — Positive Entscheidungen im Audit-Trail

**Status:** Vorschlag · **Datum:** 2026-08-08 (vereinfacht)
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

---

## 7. Akzeptanzkriterien

1. Eine akzeptierte Mutation ist im Trail an den Regeln erkennbar, die sie bestätigt haben.
2. Ein Regelsatz-Wechsel ist an `rulesetVersion` der betroffenen Records ablesbar.
3. Gate-Verhalten unverändert gegenüber 0.7.0 — identische Accept/Reject-Entscheidungen auf
   identischem Input.
4. Alte Records ohne die Felder werden von `audit_trail` weiterhin fehlerfrei ausgegeben.
