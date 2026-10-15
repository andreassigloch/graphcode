# CR-GC-812: Offline vorberechnete REQ-Vorschlaege gegen Review-Latenz

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-958 (idea)
**Erstellt:** 2026-10-15
**Item:** bok/items/ITEM-2026-958.json (Lane: code)

---

Ziel: Latenz beim REQ-Review senken. Vorschlaege (Formulierung, Qualitaet) werden asynchron vorberechnet (z. B. naechtlich, Skill/Agent) und als zurueckgestellter Schreibzug gespeichert: Batch + baseVersion + Lesemenge (Elemente, die die Analyse gelesen hat). Zustand, nicht SSOT. Anzeige beim naechsten Oeffnen/Review (reqreview) oder auf einem Scratchpad. Nur REQ. Dirty = kein eigener Mechanismus: es ist die OCC-Pruefung je Element (ITEM-2026-954) als Trockenlauf - geaendert seit baseVersion geschnitten mit Schreib- und Lesemenge des Vorschlags. Ein dirty Vorschlag waere beim Anwenden ohnehin abgelehnt worden; beim Oeffnen neu rechnen. Messung 2026-10-15, graphcode-Audit seit 01.09. (542 Batches): REQ-Text selbst macht nur 2 % ungueltig. Schreibmenge = REQ + eigene Kanten: gueltig nach 1 d 99 %, 7 d 93 %, 14 d 87 %. Mit Nachbarn als Lesemenge (ohne SYS/MOD) 7 d 88 %; SYS als Lesemenge kostet 17 Punkte - Lesemenge klein halten. Annahme = Lead wendet an (dieselbe OCC-Pruefung, echt); Ablehnung mit Grund merken. Erzeugen ist nicht graphcode (Skill/aimprove). Rechner: lokales LLM (Ollama/qwen, naechtlich, keine Latenz- und Kostengrenze) hinter den deterministischen Pruefungen: vorhandene REQ-Qualitaetsregeln BQ-01..07 (contracts quality-rules.ts: Weasel-Woerter, Messbarkeit, Modalverb, ...) plus ein Grammatik-/Rechtschreib-Parser (z. B. LanguageTool lokal, DE+EN) - Struktur vor KI: der Parser liefert die sicheren Funde, das LLM nur Formulierung/Qualitaet.

---

## Einordnung

**Menge B — vorberechnete REQ-Vorschläge (Prio 2).** Reihenfolge: CR-GC-811 → CR-GC-812 → CR-GVE-359. Setzt aus Menge A voraus: CR-GC-809 (geänderte uids im post-apply-Hook), CR-GVE-357 (Vorschau-Overlay).

Position 8 von 12. Nach CR-GC-811 und CR-GC-809. Rechner: BQ-01..07 + Grammatik-/Rechtschreib-Parser + lokales LLM.

Herkunft: Abgleich graphengine-Kommunikationskonzept (Sitzung 2026-10-15).

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
