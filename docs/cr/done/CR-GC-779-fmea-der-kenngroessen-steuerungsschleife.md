# CR-GC-779: FMEA der Kenngrößen-Steuerungsschleife

**Status:** ✅ Done (2026-10-10)
**Typ:** Analyse (Skill `se-fmea`, Version 8) — erster Lauf nach CR-GC-774
**Erstellt:** 2026-10-10
**Stand:** 2026-10-10 · **Methodik:** AIAG-VDA 7-Step, Action Priority
**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md` (Sicht Wirkkette, Dimension Sicherheit und
Verfügbarkeit, Ergebnisse a bis d); Leitlinie T-O7

---

## 1. Zusammenfassung

Analysiert ist eine Wirkkette: `FCHAIN-steering-loop` (Use Case `UC-deterministic-steering`). Sieben
Fehlerarten, davon vier als Risiko mit Gegenmaßnahme im Modell.

Die drei Risiken mit der höchsten Priorität:

1. **Ein falscher Regelbefund läuft im Kreislauf um** (S 8, O 3, D 7) — keine Stelle sieht über mehrere Runden.
2. **Der Store ist nach einem Abbruch nicht lesbar** (S 9, O 2, D 3) — trifft alle acht Ketten durch den Store.
3. **Die Schleife pendelt über Sitzungen hinweg** (S 6, O 4, D 5) — das Gedächtnis der Abbruchregel lebt nur im Prozess.

Zwei Befunde vor jeder Bewertung:

- **Der Zweck hing am falschen Träger.** `REQ-monotone-convergence` ist die Anforderung an die Kette von
  Auslöser bis Ergebnis, erfüllt wurde sie vom Modul `MOD-loop`. Sie hängt jetzt an der Wirkkette; ein Modul
  kann zur Konvergenz eines Kreislaufs über vier Module nichts zusagen.
- **Die Entdeckung über Runden fehlt.** Kreis und Plateau erkennt `src/loop/stagnation.ts` innerhalb einer
  Sitzung; nichts davon wird protokolliert, und ein Neustart des Hosts löscht es.

## 2. Kettenprofil (aus `graph_metrics`, graphVersion 674)

**Verdrahtung:** `measurable: true`. Ein offener Befund an einem Glied: R-21 an `FUNC-compute-steering-delta`
(übergibt an `FUNC-bind-tools` ohne gemeinsame Kette) — das ist zugleich die eine Übergabe der Kette. Vom
Autor nicht als Hindernis gewertet; der Befund bleibt offen.

| Kette | Glieder | Kreisläufe | geteilte Funktionen | Importe | Übergaben | Modulgrenzen (Verträge) | Akteursgrenze |
|---|---|---|---|---|---|---|---|
| `FCHAIN-steering-loop` | 17 | 1 (10 Glieder) | 12 | 0 | 1 | 14 Kanten über 7 Modulpaare (12 Verträge) | ✓ |

- **Kreislauf:** `FUNC-arch-fitness`, `FUNC-compute-readiness`, `FUNC-evaluate-rules`, `FUNC-fit-advisory`,
  `FUNC-generation-step`, `FUNC-graph-store`, `FUNC-graph-suggest`, `FUNC-mutate`,
  `FUNC-take-steering-snapshot`, `FUNC-zug-bericht`.
- **Geteilte Funktionen nach Reichweite:** `FUNC-mutate` (13 Ketten, 8 Anwendungsfälle), `FUNC-graph-store`
  (8, 5), `FUNC-evaluate-rules` (7, 5), `FUNC-graph-suggest` und `FUNC-held-back-traces` (je 3), sieben
  weitere mit je 2.
- **Übergabe:** `FLOW-steering-delta` von `FUNC-compute-steering-delta`.
- **Modulgrenzen mit den meisten Verträgen:** `MOD-kernel-measure` → `MOD-loop` (2 Kanten, 3 Verträge:
  `SCHEMA-measurement-vector`, `SCHEMA-steering-snapshot`, `SCHEMA-zug-bericht`).
- **Länge 4, Verzweigung 7, Zulauf 5.**

## 3. Fehlerarten im Detail

Bewertung: Vorschlag des Skills, vom Autor am 2026-10-10 bestätigt („Werte passen").

| # | Quelle | Ort | Fehlerart | Ursache | Wirkung am Nutzer | S | O | D |
|---|---|---|---|---|---|---|---|---|
| FM-01 | E Kreislauf | der Kreislauf | Schleife pendelt über Sitzungen | Abbruchgedächtnis lebt im Prozess; ein Neustart beginnt die Zählung neu | Runden ohne Fortschritt | 6 | 4 | 5 |
| FM-02 | E Kreislauf | der Kreislauf | ein Glied rechnet auf dem Stand vor dem letzten Zug | zweiter Messpfad oder zwischengespeicherter Stand | Empfehlung passt nicht zum Modell | 7 | 3 | 6 |
| FM-03 | E Kreislauf | der Kreislauf | ein falscher Regelbefund läuft um | Regel oder Schwelle falsch; Fokus, Vorschlag und Zug folgen ihr | Modell wird schlechter, jede Runde meldet Fortschritt | 8 | 3 | 7 |
| FM-04 | F geteilt | `FUNC-graph-store` | Store nicht lesbar oder beschädigt nach Abbruch | Prozess endet während des Schreibens; Lock eines toten Besitzers | keine der acht Ketten erreicht ihr Ergebnis | 9 | 2 | 3 |
| FM-05 | F geteilt | `FUNC-mutate`, `FUNC-evaluate-rules` | Regelauswertung wirft oder hängt im Gate | Fehler in einer Regel; ein Graph, den eine Regel nicht erwartet | kein Schreiben mehr, in 13 Ketten | 8 | 2 | 2 |
| FM-06 | Modulgrenze | `MOD-kernel-measure` → `MOD-loop` | Vertrag des Messvektors nicht an Code gebunden, ohne Test | `SCHEMA-measurement-vector` ohne Bindung (R-26) und ohne Vertragstest (R-32) | Schleife liest ein Feld, das die Messung anders liefert | 6 | 3 | 7 |
| FM-07 | B Übergabe | `FLOW-steering-delta` | Delta fehlt oder ist falsch in der Antwort des Werkzeugs | Übergabe ohne gemeinsame Kette, also ohne erklärten Integrationsumfang (R-21) | der Agent sieht einen falschen Fortschritt | 5 | 3 | 5 |

Quellen A (Importe), C und D (doppelte und nicht aufgezählte Zustandsgrößen): keine Importe; C und D sind in
diesem Lauf nicht abgegangen (siehe Abschnitt 7).

Am Code gelesen zu FM-05: `src/kernel/gate.ts` fängt einen Fehler der Regelauswertung nicht; er tritt als
Ausnahme aus `mutate()` aus. Die Auswertung läuft am Kandidaten vor `store.commit` — nach Lesart bleibt der
Store dabei unverändert. Kein Test belegt das.

## 4. Risikomatrix

Einstufung nach der Übergangsregel des Regelkatalogs (`rpn-interim`, FM-03): High bei RPN über 100 oder
Schwere 9 bis 10. Die lizenzierte AP-Tabelle ist nicht hinterlegt.

| # | Fehlerart | S | O | D | RPN | AP | Kategorie |
|---|---|---|---|---|---|---|---|
| FM-03 | falscher Befund läuft um | 8 | 3 | 7 | 168 | High | SW (Pflicht) |
| FM-02 | Glied rechnet auf altem Stand | 7 | 3 | 6 | 126 | High | gedeckt, siehe unten |
| FM-06 | Vertrag des Messvektors ungebunden | 6 | 3 | 7 | 126 | High | bestehender Befund, siehe unten |
| FM-01 | Schleife pendelt | 6 | 4 | 5 | 120 | High | SW (Pflicht) |
| FM-04 | Store nicht lesbar | 9 | 2 | 3 | 54 | High | SW (Pflicht) |
| FM-07 | Delta fehlt in der Antwort | 5 | 3 | 5 | 75 | Medium | bestehender Befund |
| FM-05 | Regelauswertung fällt im Gate aus | 8 | 2 | 2 | 32 | Medium | SW (Pflicht) |

## 5. Handlungsempfehlungen

### Anforderungen (Ergebnis b) — vom Autor gewählt: FM-01, FM-03, FM-04, FM-05

| Risiko | Gegenmaßnahme | Wirkt auf | Stand |
|---|---|---|---|
| `REQ-risk-loop-oscillation` | `REQ-loop-round-log` — jede Runde dauerhaft protokolliert, geschrieben von der Schleifenseite | D | nicht gebaut |
| `REQ-risk-loop-degradation` | `REQ-loop-convergence-monitor` — Auswertung außerhalb des Kreislaufs meldet Pendeln, Plateau, Rückschritt | D | nicht gebaut, keine Funktion im Modell |
| `REQ-risk-store-unreadable` | `REQ-store-recovery` (bestand schon; jetzt als Gegenmaßnahme gekennzeichnet) | O, D | Test `TEST-store-recovery` ungebunden |
| `REQ-risk-gate-rule-eval-fails` | `REQ-gate-survives-rule-failure` — Ablehnung mit Grund, Store unverändert, Gate bleibt bereit | O | Verhalten nach Lesart teils da, kein Test |

**Nicht als Anforderung, mit Begründung:**

- **FM-02** ist gedeckt: `REQ-single-measurement-path` und `REQ-steering-post` verlangen den einen Messpfad und
  sind durch `TEST-single-measurement-path` geprüft.
- **FM-06** und **FM-07** sind bestehende Befunde des Regelkatalogs an denselben Elementen (R-26 und R-32 an
  `SCHEMA-measurement-vector`, R-21 an `FUNC-compute-steering-delta`). Eine zweite Anforderung daneben wäre
  ein Doppelurteil; zu schließen sind die Befunde.

### Architekturvorschläge (Ergebnis c) — nicht angewandt

| Zweck | Kette | Ort | Handlungsklasse | Prognose | Wirkung auf Modul- und Funktionsbaum |
|---|---|---|---|---|---|
| `REQ-monotone-convergence` | `FCHAIN-steering-loop` | der Kreislauf | Aufteilen: die Entdeckung wird eine eigene Funktion **außerhalb** des Kreislaufs, die nur das Rundenprotokoll liest und an den Nutzer liefert | besser: Entdeckung von FM-01 und FM-03 (D sinkt). Gleich bleiben muss: Zahl und Mitglieder der Kreisläufe der Kette, kein neuer Zufluss am Gate | eine Funktion mehr in `MOD-kernel-measure` oder `MOD-projections`; ein Glied und ein Ausgang mehr in der Kette; ein Vertrag mehr (Rundenprotokoll) an einer Modulgrenze, an der R-04 schon meldet |

Läge die Entdeckung im Kreislauf, träfe sie der Fehler, den sie entdecken soll.

### Konflikte an Kreuzungspunkten (Ergebnis d)

| Kreuzungspunkt | Ketten | Was gegeneinander steht |
|---|---|---|
| `FUNC-mutate` (13 Ketten) | `FCHAIN-steering-loop` gegen die zwölf übrigen | Das Rundenprotokoll will bei jedem Zug schreiben. Im Gate geschrieben, trüge jeder Schreibvorgang aller Ketten die Last der Steuerungsschleife — CR-GC-778 hat die Berichte gerade aus dem Gate gezogen. **Auflösung in `REQ-loop-round-log`:** die Schleifenseite schreibt, das Gate nicht. |

## 6. Auswirkung auf das Modell

- `FCHAIN-steering-loop` erfüllt `REQ-monotone-convergence`; die Kante von `MOD-loop` ist entfernt.
- Vier Risiko-Anforderungen, drei neue Gegenmaßnahmen, `REQ-store-recovery` als Gegenmaßnahme gekennzeichnet.
- Drei neue Tests ohne Bindung (`TEST-loop-round-log`, `TEST-loop-convergence-monitor`,
  `TEST-gate-survives-rule-failure`) — Rundenprotokoll, Entdeckung und der Test am Gate sind nicht gebaut.
- **Benannt offen:** `REQ-loop-convergence-monitor` hat keinen Erfüller (RD-01), weil die Funktion nicht
  existiert — das ist der Architekturvorschlag oben. FM-03 des Regelkatalogs meldet die drei High-Risiken als
  unverifiziert, bis ihre Tests gebunden und grün sind.

## 7. Grenzen dieses Laufs und Quellen

- **Eine Kette von 25.** Die geteilten Funktionen Gate, Store und Regelauswertung sind hier mit analysiert und
  werden in späteren Läufen zitiert.
- **Die Glieder sind am Modell gelesen, nicht am Code** — mit zwei Ausnahmen: `src/loop/stagnation.ts`
  (Abbruchregel, Gedächtnis im Prozess) und `src/kernel/gate.ts` (kein Abfangen der Regelauswertung).
- **Quellen C und D** (doppelt geführte Zustandsgrößen, Zustandsgrößen ohne Werte) sind nicht abgegangen.
- **Auftreten und Entdeckung** sind Schätzungen des Autors; keine Betriebsmessung liegt zugrunde.
- Quellen: das Modell (`graph_metrics`, `rules_evaluate`, graphVersion 674), die zwei Dateien oben, die
  Betriebsnotiz „Store-Korruption nach Abbruch" des Autors.
