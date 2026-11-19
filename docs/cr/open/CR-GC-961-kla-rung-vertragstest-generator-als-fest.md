# CR-GC-961: Klärung — Vertragstest als Bauschritt, Kanal am FLOW, Vertrag physischer Schnittstellen

**Typ:** Klärung (Entscheidung des Autors), aus Item ITEM-2026-1475 (idea)
**Status:** Open
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1475.json (Lane: graph); betrifft graphcode und sigloch-modules (contracts)
**Herkunft:** CR-GC-958 (Spike Tests aus dem Modell), CR-GC-959 (Fehlbindungen), ITEM-2026-1454 (Zod-Schutz)

---

## Warum ein CR für drei Fragen

Die drei Fragen hängen an einer Stelle: Was beweist, dass ein FLOW den Vertrag seines SCHEMA einhält?
- Bei einem Funktionsaufruf beweist es ein Zod-Schema, das an der Grenze parst und einen Vertragstest hat.
- Bei einer Datei, einem Ereignis, einem elektrischen Signal oder einer Kraft gibt es keinen Funktionsaufruf, oft kein Zod-Schema und manchmal keinen Code.

Heute behandeln die Regeln jeden FLOW wie einen Aufruf. Das zeigen zwei Messungen aus CR-GC-958:
- **Generator:** Der Vertragstest-Generator findet 44 von 48 eingebauten Schema-Fehlern, die Handtests 27. Er braucht aber ein Zod-Schema.
- **Regel-Prototyp:** Der Prototyp „passt das SCHEMA zum übergebenen Wert“ trifft in der Stichprobe nur 3 von 10 echte Fehlbindungen. 4 von 10 Fehltreffern sind Flüsse über eine Datei, einen Callback oder ein Feld in einer Liste. Ihm fehlt die Angabe, über welchen Kanal der FLOW läuft.

Offen ist auch die FAQ `schema-bei-physischem-fluss`: Ein SCHEMA je physischem Fluss ist Pflicht. Ungeklärt ist, wie es R-26, RC-04 und RC-08 ohne Zod-Symbol erfüllt.

## Fragen an den Autor

### F1: Vertragstest-Generator als fester Bauschritt

Der Generator liegt in `graphanalyze/werkzeuge/vertragstest/`. graphcode ist kein Generator.

| Variante | Was | Preis |
|---|---|---|
| **a** (Empfehlung) | `se-bau` ruft den Generator je neuem oder geändertem SCHEMA auf; die erzeugte Datei wird als TEST verify SCHEMA gebunden. Der Generator bleibt in graphanalyze. | Ein Bau braucht graphanalyze. Der Koordinator ruft das Werkzeug auf, nicht der Umsetzer. |
| b | Generator wird eigenes Familienpaket (z. B. `@sigloch/vertragstest`), `se-bau` ruft es auf | Paket, Release, Version-Bump |
| c | Kein fester Schritt; R-32 meldet weiter, der Mensch entscheidet je SCHEMA | Testqualität hängt am Menschen (Handtests fanden 27 von 48) |

Dazu ITEM-2026-1454 (Zod-Schutz): Der erzeugte Test friert die Struktur ein und findet jede Strukturänderung außer einer Enum-Erweiterung. Vorschlag: Er ersetzt den Hash-Vorschlag. Die Enum-Lücke schließt der Generator mit einem Abgleich der eingefrorenen Werteliste.

### F2: Kanal-Attribut am FLOW

Neues Attribut am FLOW in contracts, orthogonal zu `sync`/`async` (`sync`/`async` sagt, ob der Abnehmer wartet; der Kanal sagt, worüber geliefert wird).

| Wert | Beispiel | Beleg im Code | Prüfung |
|---|---|---|---|
| `aufruf` | `exportMarkdown()` liefert Text | Signatur: Rückgabe des Erzeugers oder Parameter des Empfängers | Typprüfung wie im Prototyp, Parse an der Grenze (RC-04) |
| `nachricht` | Socket, Ereignis, Queue, Callback | Sende- und Empfangsstelle | Parse beim Empfänger |
| `datei` | Lock-Datei, Snapshot, Policy | Schreib- und Lesestelle | Parse beim Lesen (Lade-FUNC, FAQ `policy-datei-als-flow`) |
| `physisch` | Spannung, Strom, Kraft, Volumenstrom | keiner im Code; Datenblatt oder Schnittstellenbeschreibung | Messung im TEST gegen Größe, Einheit und Grenzwert |
| `mensch` | Tastendruck, Anzeige, Formular | UI-Element oder Eingabevertrag | UI- oder Akzeptanztest |

Offene Teilfragen:
- **F2.1** Pflicht oder optional? Vorschlag: optional, ohne Angabe gilt `aufruf`. Eine Regel meldet erst, wenn ein Beleg dem Kanal widerspricht.
- **F2.2** Genügen fünf Werte, oder trennen wir `physisch` in elektrisch, mechanisch, hydraulisch? Vorschlag: ein Wert `physisch`. Die Domäne steht am SCHEMA (Größe und Einheit), nicht am Kanal.

### F3: Vertrag physischer und elektrischer Schnittstellen ohne Zod

| Variante | Was | Preis |
|---|---|---|
| **a** (Empfehlung) | SCHEMA mit `kanal: physisch` trägt strukturierte Attribute: Größe, Einheit, Nennwert, Grenzwerte, Toleranz. `realRef` zeigt auf ein Dokument (Datenblatt, ICD) statt auf ein Code-Symbol. R-26 gilt mit Dokument-`realRef` als erfüllt. RC-04 und RC-08 gelten nur für `aufruf`, `nachricht` und `datei`. R-32 verlangt einen TEST, der gegen die Grenzwerte misst. | Ontologie-Erweiterung in contracts (L1/L2, Version-Bump); Regeln R-26, RC-04, RC-08 und R-32 je Kanal |
| b | Physischer Vertrag als Zod-Schema mit Einheit im Feldnamen (`spannung_V: z.number().min(11).max(14)`), auch ohne Software | Kein Ontologie-Umbau. Aber ein Zod-Schema ohne Code-Verwender ist ein erfundenes Symbol (FAQ: „erfinde kein Zod-Schema“) |
| c | Physische Flüsse bleiben mit R-26-Befund stehen, Befund mit Begründung abnehmen | Keine Arbeit, aber kein prüfbarer Vertrag |

Mit F3a würde der Generator aus Größe und Grenzwerten ein Messgerüst erzeugen: je Grenzwert ein Prüfpunkt, Messwert von Hand oder vom Prüfstand.

## Was nach der Entscheidung folgt (je eigener CR)

1. **graphcode, `se-bau`:** Schritt „Vertragstest erzeugen“ (F1). Dateien: `.claude/commands/se-bau.md`, `tests/skill-bau.test.ts`.
2. **sigloch-modules, contracts:** Kanal-Attribut (F2), physische SCHEMA-Attribute (F3), Regeln je Kanal. Familien-Sache: Review, Version-Bump, Umsetzung durch den Hüter von sigloch-modules.
3. **graphanalyze:** Regel-Prototyp liest den Kanal; Messung der Treffergenauigkeit neu auf denselben 10 Stichproben. Kriterium vor dem Lauf: ≥ 8 von 10 richtig. Erst danach kommt die Regel nach contracts.
4. **FAQ:** `schema-bei-physischem-fluss` von „offen“ auf die Entscheidung.

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| F1 | offen | |
| F2 | offen | |
| F3 | offen | |

## Umfang laut `graph_impact`

Relation-Kanten: `FUNC-se-bau` (F1). F2 und F3 betreffen die Ontologie in contracts; ihr Umfang entsteht in den Folge-CRs.
