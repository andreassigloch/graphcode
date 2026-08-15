# CR-GC-338 — `testRefs` in den Konsumenten, und die Fixtures auf den korrigierten Nenner

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **11 — muss geteilt werden, s. §7**)
**Ziel:** graphcode 0.12.x
**Vorbedingung:** erfüllt — `@sigloch/contracts@4.0.0` ist publiziert (2026-08-15).
**Herkunft:** CR-SM-231 §„Nicht in diesem CR" (graphcode-Konsumenten, dort ausdrücklich vertagt)
und CR-GC-335 §4.4 (Tests ziehen nach). Beides fiel beim Nachziehen auf contracts 4.0.0 an und
blieb dort bewusst liegen, statt den CR zu sprengen.

---

## 1. Problem

Nach dem Umstieg auf contracts 4.0.0 laufen **11 Tests rot**. Sie zerfallen in drei Ursachen,
plus eine vierte, die nicht hierher gehört:

| # | Ursache | Tests | Klasse |
|---|---|---|---|
| A | `testRef` → `testRefs` nicht nachgezogen | 4 | Schema-Umbenennung, mechanisch |
| B | Fokus-Dimension der Fixtures verschoben | 6 | **semantisch** — der Nenner ist jetzt richtig |
| C | Audit-Größenzusage driftet | 1 | vorbestehend, **nicht** dieser CR |

### A — `testRef` heißt `testRefs` (1:n statt 1:1)

CR-SM-231 hat das Attribut ersatzlos umbenannt: eine Abnahme, **n** Testdateien. Acht
graphcode-Quellen kennen noch den alten Namen:

```
src/codec.ts          src/conformance.ts    src/exporter.ts      src/harness.ts
src/tools/read.ts     src/tools/write.ts    src/tools/report.ts  src/views/helpers.ts
```

Betroffene Tests: `conformance.test.ts`, `mcp.realize.test.ts`, `mutate.formate-binding.test.ts`
(`@testRef` als Format-E-Zeile), `skills.mcp-conformance.test.ts` (eine Skill instruiert ein
`attributes.<key>`, das die Ontologie nicht mehr deklariert).

**Dazu gehört `testResult`** (CR-SM-231b): das Ergebnis hängt nicht mehr am TEST-Knoten, sondern
**pro Eintrag** (`result`, `ranAt`, `evidence`). `graph_realize` und `graph_test_ingest` schreiben
es heute an den Knoten — das ist seit contracts 4.0.0 wirkungslos, nicht falsch-positiv: FM-03
liest die Einträge, ein Knoten-Attribut zählt nicht mehr als Evidenz.

### B — Die Fokus-Dimension hat sich verschoben, und zwar zu Recht

CR-SM-235 hat den `applicable`-Nenner korrigiert: 18 von 71 Regeln hatten gar keinen, und MS-03
zählte gegen die falsche Grundgesamtheit. **Auf dem graphcode-Graphen steigt `ms` dadurch von
0 % (97 / 21) auf 43,9 % (97 / 173) — bei identischen Verstößen.**

Damit ändert sich, welche Dimension die schwächste ist — und genau darauf sind die Fixtures
geeicht:

```
tests/generate.test.ts        erwartet /^uc:R-15:/   bekommt  req:AF-01:SYS-shop
tests/executor.bestofn.test.ts  „Fokus-Reparatur schlägt UC-Volumen"
```

**Das ist kein Regressionsbefund, sondern der beabsichtigte Effekt.** Geprüft, ob es ein Artefakt
der neuen AF-Domains ist: auf einem 10-Element-Graphen tragen AF-01/AF-03 zusammen **2 von 32**
zum `req`-Nenner bei — sie dominieren nichts. Die Verschiebung kommt aus der Breite der
Korrektur, nicht aus einer schlechten Einzelzuordnung.

---

## 2. Ziel

Die Konsumenten sprechen die Ontologie von contracts 4.0.0, und die Fixtures prüfen wieder das,
wofür sie geschrieben wurden.

---

## 3. Nicht-Ziele

- **Keine Regeländerung, keine neue Kenngröße.** Nur Umbenennung und Fixture-Pflege.
- **Kein Umschreiben der Assertions in B.** Die Fälle tragen Lehraussagen („das uc-Template weist
  bei R-15 auf `FUNC compose→FCHAIN` hin"). Wird die Assertion auf die neue Fokus-Dimension
  umgeschrieben, prüft der Test etwas anderes als vorher und die Aussage verliert ihren Träger.
  **Die Fixture wird so erweitert, dass `uc` wieder die schwächste Dimension ist** — Entscheid
  2026-08-15.
- **Nicht der Audit-Größentest.** `audit.trail-projection.test.ts` fordert ≥ 89 % Reduktion und
  liegt bei 88,3 % (38,7 KB statt ≤ 37,3 KB). Das ist Drift auf echten Repo-Daten, unabhängig von
  contracts. Eigener CR — entweder die Zusage nachmessen und anpassen oder die Projektion
  verbessern; beides ist eine Entscheidung, keine Reparatur.

---

## 4. Anforderungen

1. **`testRef` → `testRefs` in allen acht Quellen.** Kein Alias, kein Union — contracts hat das
   alte Attribut ersatzlos entfernt, und ein Kompatibilitätspfad hier wäre der zweite Pfad, den
   CR-SM-231 gerade beseitigt hat.
2. **1:n wird auch benutzt, nicht nur akzeptiert.** `graph_tests` liefert je TEST **n** Dateien —
   das ist der Punkt für selektive Läufe. `graph_realize` bindet einen Eintrag, ohne die
   bestehenden zu überschreiben.
3. **`testResult` pro Eintrag** (CR-SM-231b): `graph_realize`/`graph_test_ingest` schreiben
   `result`/`ranAt`/`evidence` an den Eintrag, nicht an den Knoten. Ein Lauf, der eine von zwei
   Dateien betrifft, färbt nur diese.
4. **Skills nachziehen**, bis `skills.mcp-conformance.test.ts` grün ist: kein
   `attributes.<key>`, das die Ontologie nicht deklariert.
5. **Fixtures aus B erweitern**, Assertions unangetastet. Der Nachweis, dass es richtig gemacht
   ist: der Test schlägt weiter fehl, wenn man die *Lehraussage* bricht — nicht nur, wenn man die
   Zahl ändert.
6. **R-29 gilt jetzt.** Testdatei-Exklusivität ist `error`. Fällt beim Nachziehen eine doppelt
   beanspruchte Datei an, ist das ein Befund, kein Testproblem.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/codec.ts`, `src/exporter.ts` | Attributname im Encoding |
| `src/conformance.ts` | RC-02 iteriert Einträge |
| `src/harness.ts`, `src/tools/read.ts`, `src/tools/report.ts` | Lesepfade |
| `src/tools/write.ts` | `graph_realize` / `graph_test_ingest`: Eintrag statt Knoten |
| `src/views/helpers.ts` | Projektion |
| `templates/skills/*` | Vokabular |
| `tests/generate.test.ts`, `tests/executor.bestofn.test.ts` | Fixtures (B) |
| `tests/conformance.test.ts`, `tests/mcp.realize.test.ts`, `tests/mutate.formate-binding.test.ts` | Erwartungen (A) |

**11+ Dateien — über der Grenze.**

---

## 6. Akzeptanzkriterien

- [ ] `grep -rn "testRef\b" src/ templates/` findet nur noch Prosa, die die Umbenennung erklärt.
- [ ] `graph_tests` liefert für einen TEST mit zwei Einträgen **beide** Dateien.
- [ ] Ein Lauf-Ingest auf einer von zwei Dateien färbt nur diesen Eintrag; der andere bleibt ohne
      `result` und VR-01 meldet ihn.
- [ ] `generate.test.ts` und `executor.bestofn.test.ts` grün, **mit unveränderten Assertions**.
- [ ] Gegenprobe zu B: die Lehraussage kaputtmachen → Test wird rot. Ein Test, der nur die neue
      Zahl abnickt, belegt nichts.
- [ ] Suite grün bis auf `audit.trail-projection.test.ts` (eigener CR).

---

## 7. Schnitt (die 6-Dateien-Regel greift)

Bei 11+ Dateien wird nicht weitergemacht, sondern geteilt:

| Teil | Umfang | Dateien |
|---|---|---|
| **338a** | `testRefs` in den Lesepfaden + Encoding (`codec`, `exporter`, `conformance`, `harness`, `read`, `report`) | 6 |
| **338b** | Schreibpfad + Ergebnis pro Eintrag (`write.ts`, `views/helpers.ts`, Skills, zugehörige Tests) | ~5 |
| **338c** | Fixtures aus B (`generate.test.ts`, `executor.bestofn.test.ts`) | 2 |

338a und 338b hängen zusammen (dasselbe Attribut), 338c ist unabhängig und kann zuerst laufen.

---

## 8. Gate-Evidenz

- **Zahlen gemessen, nicht geschätzt:** 11 rote Tests namentlich; acht Quellen per `grep`; `ms`
  0 % → 43,9 % bei identischen 97 Verstößen; AF-Anteil am `req`-Nenner 2 von 32.
- **Ursache-Trennung belegt:** A ist mechanisch, B ist der beabsichtigte Effekt einer Korrektur,
  C ist unabhängig — die drei nicht in einen Topf zu werfen ist der halbe CR.
- **Kein Prior Art:** CR-GC-335 (Config + Fokus-Schwelle) und CR-GC-336 (`weights`) sind
  geschlossen und berühren das Attribut nicht.
