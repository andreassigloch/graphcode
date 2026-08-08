# CR-GC-231 — Applicability-Aufzeichnung im Audit-Trail

**Status:** Vorschlag (Family-Review ausstehend) · **Datum:** 2026-08-01
**Ziel:** graphcode 0.8.0 · contracts 2.1.0 · graph-api-core 2.1.0
**Ontologie:** v4.0.0 — **unverändert** (keine neuen ElementTypes/TraceTypes/Rules)
**ID:** Platzhalter, Vergabe im Review

---

## 1. Problem

Der Audit-Trail hält Mutation, Autor und Ergebnis (accepted/rejected + Violations) fest. Zwei
semantisch verschiedene Fälle sind darin **nicht unterscheidbar**:

- **A** — Eine oder mehrere Regeln waren zuständig, haben geprüft, Ergebnis `pass`.
- **B** — Keine Regel war zuständig; das Gate hat mangels Prüfumfang durchgelassen.

Beide erscheinen als `accepted` ohne Violations. Daraus folgen zwei Defizite:

1. **Provenienz ist nicht belastbar.** Die Aussage „die Regel hat entschieden" lässt sich aus dem
   Trail nicht von „niemand hat entschieden" trennen. Das entwertet den zentralen Vorteil des
   Gates — Nachvollziehbarkeit gegen eine versionierte Regelbasis statt gegen einen
   nicht reproduzierbaren Modellzustand.
2. **Die ungegatete Fläche ist nicht messbar.** Genau dort entscheiden Agent-Priors statt
   Vorgaben. Bei wechselnden Modellen ist diese Fläche der Ort, an dem sich Modellverhalten
   ins Modell durchschlägt — ohne Signal.

Der Vorfall CR-SM-216 (ID-abgeleitetes Typing, still gescheitert) ist ein Beispiel dieser Klasse:
kein Fehler war sichtbar, weil keine Prüfung zuständig war.

---

## 2. Ziel

`mutate()` zeichnet je Mutation den **applicable Rule-Set mit Einzelergebnis** auf.
`audit_stats` aggregiert daraus eine **Gate-Coverage**. Kein Verhaltenswechsel des Gates.

---

## 3. Nicht-Ziele (Abgrenzung)

- Keine neuen Regeln, keine Änderung an R-/RC-/RD-Semantik.
- **Kein Blocker.** `applicableCount = 0` führt nicht zur Ablehnung.
- Keine Änderung an Readiness — bleibt emergent, Score-Definition unverändert.
- Keine Berührung der verriegelten Invarianten (One Store, One Transport, One Apply-Gate).
- Keine Bewertung der Regel*güte*, nur des Regel*umfangs*.

---

## 4. Anforderungen

| REQ | Kind | Anforderung | Verification |
|---|---|---|---|
| REQ-A01 | functional | `mutate()` erfasst je Mutation die Menge der applicable Regeln mit Status je Regel. | test |
| REQ-A02 | functional | Status-Domäne: `pass`, `fail`, `not-applicable`, `error`. | inspection |
| REQ-A03 | functional | Jeder Audit-Record trägt die zur Laufzeit geladene contracts-Version und die Ontologie-Version, gegen die evaluiert wurde — aus dem Paket, nicht aus Config. | test |
| REQ-A04 | functional | `audit_stats` liefert Gate-Coverage sowie deren Verteilung über ElementType und Operation (+/-/~). | test |
| REQ-A05 | non-functional | Trail-Zuwachs begrenzt: Speicherung als Rule-ID-Liste + Regelsatz-Version, nie als Regeltext. | analysis |
| REQ-A06 | non-functional | Applicability entsteht als Nebenprodukt der bestehenden Rule-Eval, kein zweiter Durchlauf. Latenzbudget offen (§11). | test |
| REQ-A07 | precondition | Rule-Eval in `graph-api-core` meldet Applicability **explizit**, nicht implizit über ein leeres Violation-Set. | test |
| REQ-A08 | negative | Records ohne das Feld (Altbestand) gelten als `unknown` und gehen **weder in Zähler noch in Nenner** der Coverage ein. | test |
| REQ-A09 | risk | Regeln mit datenabhängigem Scope: „applicable" muss in der Regeldefinition verankert sein, sonst wird die Entscheidung implizit und das Defizit reproduziert sich eine Ebene tiefer. | inspection |

---

## 5. Betroffene Module

| Modul | Änderung | Bump |
|---|---|---|
| `contracts` | Harness-/Audit-Record-Schema um optionales Applicability-Feld erweitert | minor → 2.1.0 |
| `graph-api-core` | Rule-Eval gibt Applicability explizit zurück (REQ-A07) | minor → 2.1.0 |
| `graphcode` | Gate schreibt Feld; `audit_trail` gibt es aus; `audit_stats` aggregiert Coverage | minor → 0.8.0 |
| `graphcode-client` | keine (Feld ignorierbar) | — |
| `graph-view-edit` | optional: Ungated-Surface-Panel (§11) | — |
| `se-steering` | **keine** — Coverage fließt nicht in Readiness ein | — |

---

## 6. Datenmodell (Skizze)

Pro Audit-Record, additiv:

| Feld | Inhalt |
|---|---|
| `ruleEvaluations[]` | je Eintrag: `ruleId`, `status`, `scope` (Element- bzw. Trace-ID) |
| `applicableCount` | abgeleitet, Anzahl Einträge mit Status ≠ `not-applicable` |
| `contractsVersion` | Version des geladenen `@sigloch/contracts` |
| `ontologyVersion` | SE-Ontologie-Version |

---

## 7. Abgeleitete Kennzahlen

- **Gate-Coverage** = Mutationen mit ≥ 1 applicable Regel / alle Mutationen (ohne `unknown`).
- **Ungated Surface** = Menge der (ElementType, Operation)-Paare ohne applicable Regel.
  Report-Charakter — Input für die Regelpflege, **nicht** für Readiness, nicht für das Gate.

---

## 8. Migration / Kompatibilität

Rein additiv. Bestehende Trails bleiben lesbar und gültig. Nachträgliche Anreicherung alter
Records wird **nicht** vorgenommen — sie wäre eine Rekonstruktion gegen eine Regelversion, die
zum Zeitpunkt der Mutation nicht galt, und damit selbst eine Provenienzverletzung.

---

## 9. Risiken

| Risiko | Mitigation |
|---|---|
| Trail-Volumen wächst mit Regelanzahl × Elementanzahl je Mutation | REQ-A05; ggf. Verdichtung auf Regelsatz-Hash bei Vollabdeckung |
| **Falsche Sicherheit:** hohe Coverage wird als inhaltliche Korrektheit gelesen | Kennzahl explizit als Prüf*umfang* dokumentieren; nicht in Readiness aufnehmen (§3) |
| Applicability selbst wird zur impliziten Entscheidung | REQ-A09; RD-Ebene prüfen, ob eine Regel-über-Regeln nötig ist |

---

## 10. Akzeptanzkriterien

1. Eine Mutation, für die nachweislich keine Regel zuständig ist, ist im Trail als solche
   erkennbar und von einer geprüft-bestandenen unterscheidbar.
2. `audit_stats` liefert Gate-Coverage; Records ohne Feld verändern den Wert nicht (REQ-A08).
3. Ein Regelsatz-Wechsel (contracts-Bump) ist im Trail an den betroffenen Records ablesbar.
4. Gate-Verhalten ist gegenüber 0.7.0 unverändert — identische Accept/Reject-Entscheidungen
   auf identischem Input.

---

## 11. Offene Punkte

- Latenzbudget für REQ-A06 quantifizieren.
- Granularität: Applicability je Mutation oder je betroffenem Element/Trace.
- Ungated-Surface-Report als Panel in `graph-view-edit` — separates CR?
- Verhältnis zu RD-01…RD-04 klären: ist Applicability eine RD-Eigenschaft der Regeldefinition?
