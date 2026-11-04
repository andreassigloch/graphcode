# CR-GC-892: se-plan: Integrationsbaum aus dem Modell, Testkonzept vollständig vor dem Schnitt

**Status:** ✅ Done (2026-11-04)
**Typ:** aus Item ITEM-2026-1251 (finding)
**Erstellt:** 2026-11-04
**Item:** bok/items/ITEM-2026-1251.json (Lane: code)

---

Befund aus dem Lauf von se-plan in immo-infra am 2026-11-04 (CR-INF-042..106). (1) Erster Schnitt nach Themen statt nach dem Integrationsbaum des Modells; der Nutzer musste von den Blättern nach oben einfordern. (2) Systemtest je Anwendungsfall fehlte, der Nutzer musste ihn einfordern. (3) 5 Ketten ohne eigenen Durchlauftest, 10 von 47 FUNC-Verbindungen ungetestet; die Ansicht testconcept zeigte die Lücke, der Skill prüft sie nicht. (4) Fragen nach Altbestand bis zur Umschaltung, Tests auf der Zielumgebung und Ort der Verträge stellt der Skill nicht. (5) Werkzeugwege: CR über aise statt add-node, CR→FCHAIN verboten (R-18), TEST→UC verboten, status open für AF-05 nötig, Deckung zählt erledigte CR mit.

---

## Umfang

Nur Skill-Text, keine Code-Datei: `.claude/commands/se-plan.md` (Version 6 → 7). Kein Knoten im Modell bindet die Datei; `tests/task-analysen.test.ts` hält die Pflichtstellen (`status: "open"`, „sets **no** stamp“) und läuft grün.

## Änderung

1. **Reihenfolge = Integrationsbaum, von den Blättern nach oben.** Feste Stufen: Umgebung (nur nach Entscheidung) → Verträge → Blattfunktionen → Wirkketten → Module → System → Systemtest je Anwendungsfall → Umschalten (nur bei Altbestand). Keine Meilensteine nach Themen; Prüfung, dass kein CR unter den Kindern seines Trägers liegt.
2. **Testkonzept vollständig vor dem Schnitt.** Die Ansicht testconcept wird gelesen; je Ebene ist ein eigener Test Pflicht: Vertragstest je SCHEMA, Durchlauf-REQ + TEST je Wirkkette (Risiko-REQ ersetzen ihn nicht), Systemtest-REQ je UC unter einer Eltern-REQ. Fehlende Glieder einer Kette per `compose` nachziehen, wenn der Kettentext sie nennt; bei FC-06 die Ausnahme R-21 benennen.
3. **Fragen vor dem Schnitt**, jede Antwort als REQ + TEST: Altbestand bis zur Umschaltung, Tests auf der Zielumgebung, Ort der geteilten Verträge.
4. **Werkzeugwege:** CR über `aise item new` + `aise dispatch prepare`, nicht `add-node`; `CR → FCHAIN` und `TEST → UC` sind verboten (R-18); `@status open` setzen; nach aise-Aufrufen die graphVersion neu lesen.
5. **Deckung über offene CR zählen.**

## Befunde am Werkzeug (nicht in diesem CR)

- `computeReqCoverage` (`src/loop/se-plan.ts`) zählt die `relation` aller CR, auch erledigter Spec-CR. In immo-infra deckten 40 erledigte CR schon 119 von 123 Blatt-REQ, bevor ein Bauauftrag existierte.
- `hasOpenOrder` (contracts `rule-due.ts`) liest `attributes.status === 'open'`; die Familienregel (bok ITEM-UND-CR) verbietet einen Status am CR-Knoten. Zwei Wahrheiten.
- Die Ansicht testconcept zählt eine Verbindung mit angenommenem R-21-Befund weiter als Lücke (immo-infra: 45/47, die 2 offenen sind die begründete Ausnahme Läufe starten ↔ Lauf ausführen).
