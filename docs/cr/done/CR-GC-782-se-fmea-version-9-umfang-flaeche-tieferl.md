# CR-GC-782: se-fmea Version 9: Umfang, Flaeche, Tieferlegen

**Status:** ✅ Done (2026-10-12, veröffentlicht mit graphcode 0.31.0, contracts 12.6.0)
**Typ:** aus Item ITEM-2026-818 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-818.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10, Schritt Kettenanalyse (Stufe 8 der Regelmatrix). Sicht Wirkkette und Anforderung, Dimension Sicherheit und Verfügbarkeit,
Ergebnisse a bis d. **Wartet auf CR-SM-407 und CR-GC-784.**
**Entscheidungen des Autors (2026-10-11):** die Vorbereitung des Modells ist nicht Teil der FMEA (CR-GC-784). Eine Analyse ist
eine Schleife; ihr Ergebnis ist ein gewöhnlicher CR.

## Anlass

Der Skill liest seit Version 8 die Orte der Kette. Nach den Spikes fehlen ihm vier Dinge: die Vorbedingung, der
Betrachtungsumfang, die Fläche im Bericht und eine feste Form für Vorschläge.

## Umfang

`.claude/commands/se-fmea.md`, Version 9:

1. **Vorbedingung.** Der Skill liest den Stand der Kette (bewertbar, Träger je Risiko). Ist die Kette nicht
   geschlossen, endet er mit dem Verweis auf `se-vorbereitung`. Hängt eine Gegenmaßnahme an Modul oder System,
   ohne als quer geltend benannt zu sein, nennt er das und verweist ebenfalls dorthin; er legt nicht selbst
   tiefer.
2. **Betrachtungsumfang** aus `graph_metrics`: der Skill nennt die Anforderungen, die er für die Kette liest.
3. **Bewertung** unverändert (AIAG-VDA, Schwere, Auftreten, Entdeckung an den Orten).
4. **Regel:** einer geteilten Funktion wird kein weiteres Risiko aufgeladen, ohne dass der Bericht nennt, welche
   Risiken sie schon trägt und wie viele Ketten durch sie laufen (`riskCarriers`, `functionCriticality`).
5. **Bericht** nennt für die Kette die Träger je Risiko und die Funktionen, die mindestens ein Risiko tragen.
   Eine Gegenmaßnahme am System gilt als quer geltend und zählt nicht in die Träger.
5a. **Ergebnis ist ein CR.** Neue Risiken und Gegenmaßnahmen gehen durchs Gate; eine neue Gegenmaßnahme wird als
   funktionale Anforderung der Funktion zugeordnet, die sie trägt. Das ist das Schreiben des Ergebnisses. Alten
   Bestand am Modul räumt die FMEA nicht auf.
6. **Vorschläge (Ergebnis c) in fester Form** für den Optimierer (CR-GC-785): Zweck, Kette, Ort,
   Handlungsklasse, Prognose (was besser wird, was gleich bleibt), Preis. Die FMEA wendet keinen Umbau an.

Dazu `tests/skill-fmea-orte.test.ts`, `src/projections/tool-help.ts`, die Fassung unter
`.opencode/skills/se-fmea/`, Anforderung und Test am Knoten `FUNC-se-fmea`.

## Umfang laut `graph_impact` (graphVersion 681)

`FUNC-se-fmea`: zwei Flüsse (`FLOW-skill-request`, `FLOW-chain-metrics`), eine Kette (`FCHAIN-skill-authoring`),
ein Block (`FUNC-block-urteilsarbeit`). Kein weiterer Abnehmer.

## Abnahme

- Der Skilltext nennt keine Rechnung und legt keinen alten Bestand tiefer; der Test hält beides fest.
- Ein Lauf an einer Kette mit einer Gegenmaßnahme am Modul endet mit dem Verweis auf `se-vorbereitung`.
- Ein Lauf an `FCHAIN-steering-loop` nennt Umfang und Fläche und liefert den Vorschlag aus CR-GC-779 in der
  festen Form.

## Grenzen

Auftreten und Entdeckung bleiben Schätzungen. Kongruenz: kein Laufzeitcode, der Skill ist ein Prompt.

## Ergebnis

**Stand 2026-10-11.** Gebaut, nicht geschlossen.

| Teil | Ort |
|---|---|
| Skill, Version 9 | `.claude/commands/se-fmea.md` |
| Test | `tests/skill-fmea-orte.test.ts` (16 Fälle, 11 neu; gegen Version 8 waren 10 der neuen rot) |
| Hilfe | `src/projections/tool-help.ts`: `functions` mit `chains` und `useCases` war nicht erklärt |
| Modell | `REQ-fmea-checks-entry` an `FUNC-se-fmea`, geprüft von `TEST-fmea-reads-places`; Kante von `CR-GC-782`; Beschreibung von `FUNC-se-fmea` nachgezogen |

**Neu im Skill:** die Eingangsprüfung in drei Teilen (Verdrahtung, Betrachtungsumfang aus `scope`, Träger je
Risiko aus `riskCarriers`) mit dem Verweis auf `se-vorbereitung`; die Regel zur geteilten Funktion (`surface`,
`functions`); der Berichtsabschnitt „Träger und Fläche" mit dem Sockel; die neue Gegenmaßnahme als funktionale
Anforderung an der Funktion, quer Geltendes am System; die feste Form des Vorschlags mit Preis.

**Gestrichen:** „das Schließen dieser Befunde ist das Ergebnis dieses Laufs" und „erst schließen" (die FMEA
stellte die Verdrahtung selbst her); die Zuordnung einer Gegenmaßnahme an das zuständige Modul; am Vorschlag
„die erwartete Wirkung auf die Kennzahlen des Modul- und des Funktionsbaums", ersetzt durch den Preis. Eine
Kennzahl, die es nicht gibt, stand in Version 8 nicht; der Test hält „Gewicht" und „Flüsse an den Trägern"
jetzt draußen. AIAG-VDA, Bewertung, Quellen A bis F und der Stempel sind unverändert.

### Trockenprobe a: eigenes Modell, `FCHAIN-steering-loop` (graphVersion 693)

Am Text gegangen, Daten aus `graph_metrics` und aus `requirementScope`/`riskCarriers` am exportierten Modell.

1. **Verdrahtung.** `measurable: true`. Ein offener Befund an einem Glied: `R-21` an
   `FUNC-compute-steering-delta`, in CR-GC-779 vom Autor als bewusst offen bestätigt. Der Lauf geht weiter.
2. **Umfang.** `scope`: 5 Module, 16 Ketten, 74 Anforderungen (von 157 im Modell).
3. **Träger je Risiko.** Vier Risiken im Umfang:

   | Risiko | Gegenmaßnahme, `by` | Träger | Version 9 |
   |---|---|---|---|
   | `REQ-risk-gate-rule-eval-fails` | `REQ-gate-survives-rule-failure`, `FUNC-mutate` | 1 | in Ordnung |
   | `REQ-risk-loop-oscillation` | `REQ-loop-round-log`, `FUNC-generation-step` | 1 | in Ordnung |
   | `REQ-risk-store-unreadable` | `REQ-store-recovery`, `MOD-kernel` | 26, davon 11 Glieder der Kette | nennt Risiko, Gegenmaßnahme und Modul, verweist auf `se-vorbereitung`, legt nicht tiefer. Der Lauf endet hier, außer der Autor benennt den Stand als bewusst offen |
   | `REQ-risk-loop-degradation` | `REQ-loop-convergence-monitor`, kein Erfüller | 0 | zitiert `RD-01` an der Gegenmaßnahme, verweist auf `se-vorbereitung` (Klasse „Funktion fehlt"); richtet nichts |

   Für die Probe als bewusst offen angenommen, damit Bericht und Vorschlag prüfbar sind.
4. **Fläche im Bericht.** 12 der 17 Glieder tragen mindestens ein Risiko, 10 davon nur über die Gegenmaßnahme
   am Modul. Kein Sockel (keine Gegenmaßnahme am System). Zur Regel der geteilten Funktion nennt der Bericht:
   `FUNC-mutate` trägt 2 Risiken bei 13 Ketten, `FUNC-generation-step` 1 bei 2, `FUNC-graph-store` 1 bei 8.
5. **Vorschlag aus CR-GC-779 in der festen Form** (nicht angewandt):

   | Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis |
   |---|---|---|---|---|---|
   | `REQ-monotone-convergence` | `FCHAIN-steering-loop` | der Kreislauf (10 Glieder) | Aufteilen: die Entdeckung wird eine eigene Funktion außerhalb des Kreislaufs, die nur das Rundenprotokoll liest und an den Nutzer liefert | besser: Entdeckung der Fehlerarten FM-01 und FM-03 aus CR-GC-779; `REQ-loop-convergence-monitor` bekommt einen Erfüller. Gleich bleibt: Zahl und Mitglieder der Kreisläufe, kein neuer Zufluss am Gate | eine Funktion mehr in `MOD-kernel-measure` oder `MOD-projections`; ein Glied und ein Ausgang mehr in der Kette; ein Vertrag mehr (Rundenprotokoll) an einer Modulgrenze, an der `R-04` schon meldet |

   Der Preis stand in CR-GC-779 als „Wirkung auf Modul- und Funktionsbaum"; der Inhalt ist derselbe.

### Trockenprobe b: sigllm, `FCHAIN-local-agent-execution` (nur gelesen, graphVersion 326, Stand `f8c01c5`)

1. **Verdrahtung.** `measurable: true`. Die Befunde der Verdrahtung sind nicht gelesen: an sigllm lief kein Host.
2. **Umfang.** 4 Module, 2 Ketten, 33 Anforderungen (von 85).
3. **Träger je Risiko.** Neun Risiken im Umfang. Sieben haben Gegenmaßnahmen an einem Modul (neun
   Gegenmaßnahmen: sechs an `MOD-scheduler`, zwei an `MOD-agent-management`, eine an `MOD-agent-applications`),
   mit 3 bis 8 Trägern je Risiko; 9 der 10 Glieder tragen mindestens ein Risiko. Zwei hängen am System
   (`REQ-handover-is-acknowledged-or-times-out`, `REQ-shared-promise-is-split-or-owned`): quer geltend, Sockel,
   kein Befund.
4. **Ende.** Der Lauf endet mit dem Verweis auf `se-vorbereitung` für die sieben Risiken. Keine Bewertung, kein
   Vorschlag, kein Schreiben. Soll der Abnahme erfüllt. An sigllm ist nichts geändert.

### Abnahme

- `npm run build`, Typprüfung: ohne Befund.
- `verify:code`: Spur CODE, 78 von 183 Dateien, 697 Tests grün.
- `verify:full CR-GC-782`: 183 Dateien, 1526 Tests, 2 rot: `distribution` und `lockfile-sync`, beide wegen des
  Link-Modus auf contracts 12.3.0. Die Messung zählt sie als Schlupf; die Folge bleibt bei 0 von 10.
- `rules_evaluate` am eigenen Modell, je Regel vor (graphVersion 692) und nach (693) verglichen: kein Fehler,
  jede der 24 Regeln mit Befund zählt gleich, keine neue Warnung.
- Der Skilltext nennt keine Rechnung und trägt keinen Zug des Tieferlegens (Test).

### Abweichungen und Urteile

1. **Ein Test für zwei Anforderungen.** Verlangt waren Anforderung und Test. Das Gate lehnt einen zweiten
   TEST auf derselben Datei ab (`R-29`, Fehler). `TEST-fmea-reads-places` prüft deshalb beide Anforderungen;
   seine Beschreibung ist ergänzt. Die Alternative wäre eine zweite Testdatei.
2. **`.opencode/skills/se-fmea/`** gibt es im Repo nicht; die Fassung erzeugt `scaffold` beim Ausliefern aus
   derselben Datei (wie in CR-GC-784).
3. **Endet oder verweist.** Punkt 1 des Umfangs sagt zur Gegenmaßnahme am Modul „nennt und verweist", die
   Abnahme „endet mit dem Verweis". Der Skill endet, außer der Nutzer benennt den Stand als bewusst offen; ohne
   Antwort endet er. Sonst käme am eigenen Modell keine Kette durch `MOD-kernel` je zur Analyse.
4. **Welche Risiken zum Umfang gehören,** sagt der CR nicht. Der Skill nimmt ein Risiko, wenn es selbst oder
   eine seiner Gegenmaßnahmen in `requirements` steht. Eine Gegenmaßnahme am System liegt damit im Umfang
   jeder Kette.
5. **Gegenmaßnahme an einer Kette.** `riskCarriers` zählt dann die Glieder als Träger. Der Skill behandelt nur
   Funktion, Modul und System; der Fall kommt in beiden Modellen nicht vor.
6. **Risiko ohne Erfüller** beendet den Lauf nicht: der Skill zitiert `FM-02` oder `RD-01` und verweist. Die
   fehlende Funktion ist zugleich ein Vorschlag (Ergebnis c).
7. **Das Risiko selbst** hängt im Vorbild des Skills jetzt an der Kette statt am Modul; sein Erfüller zählt
   nicht in die Träger. Im eigenen Modell hängen zwei der vier Risiken am Modul; das bleibt.
8. **Handlungsklassen** sind die fünf aus Abschnitt 6 des Konzepts. Die Handlungen aus Abschnitt 10
   (Tieferlegen, Entdeckung außerhalb des Kreislaufs, ein Besitzer je Zustand) stehen nicht als Klassen im Skill.
9. **`graph_metrics` mit `scope`** war in dieser Sitzung nicht aufrufbar: das geladene Schema des Werkzeugs
   trug die Eingabe nicht (Ursache nicht geklärt). Der Umfang ist mit `requirementScope` aus contracts am
   exportierten Modell gelesen, derselben Funktion.

**Kongruenz:** kein Laufzeitcode außer dem Hilfetext. RC-* läuft nicht im Gate (`notInGate`), also nicht prüfbar.
