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

**Variante d (Vorschlag des Autors, 2026-11-19): Testbeschreibung als Datei.** Ein Test, der von Hand läuft, ist eine Datei im Repo, z. B. `tests/manuell/bus-24v.md`:
- Kopf: die TEST-uid (bindet sich über `graph_test_ingest` wie eine `.test.ts`, FAQ `testref-binden` Punkt 4).
- Inhalt: Aufbau, Schritte, Kriterium „bestanden, wenn …“. Beispiel: „Kunde betätigt den Hebel xy; bestanden, wenn die Weiche in 2 s die Endlage meldet.“
- Ergebnis: ein Lauf von Hand trägt Datum, Prüfer, Messwerte und bestanden/nicht bestanden ein und meldet es über `graph_test_ingest`.

Das schließt R-19 ohne erfundenen Code. Die Endung (`.md` statt `.test.ts`) sagt, dass der Test von Hand läuft. Ein Attribut am TEST braucht es dafür nicht. Dieselbe Form trägt den physischen Vertrag: `realRef` des SCHEMA zeigt auf eine Vertragsdatei (Tabelle Größe, Einheit, Min, Nenn, Max, Quelle), das schließt R-26. Aus der Tabelle erzeugt der Generator (F1) das Gerüst der manuellen Testdatei: je Grenzwert ein Prüfpunkt. Die Prosa aus sirail zieht dafür vom Knoten in die Dateien um.

Offen dabei:
- **F3.1** Liest `graph_test_ingest` heute eine `.md`-Datei? Nein, es liest Läufe eines Testwerkzeugs (vitest). Ein Format für das Ergebnis von Hand fehlt.
- **F3.2** Wie alt darf ein Ergebnis von Hand sein? Ein `.test.ts` läuft bei jeder Änderung neu, ein Hebeltest nicht. Vorschlag: Das Ergebnis gilt, bis sich das SCHEMA oder die REQ ändert, die der TEST prüft (wie CR-GC-800 heute für Code).

## Befund sirail (2026-11-19)

sirail ist das Projekt mit den meisten physischen Flüssen (Stand graphVersion des Exports vom 2026-11-17).

| Was | Wie in sirail gelöst |
|---|---|
| Physischer Vertrag | SCHEMA mit Größe, Einheit, Grenzwerten und Toleranz als Prosa in `description`. Beispiele: `Bus24VSchema` (24 V ± 1 %, Welligkeit ≤ 150 mVpp, ≥ 20 V am Moduleingang), `SCHEMA-block-voltage`, `SCHEMA-pwm-signal`. Die Datenblatt-Quelle steht im CR (CR-SR-035), nicht am Knoten. |
| Test des Vertrags | TEST mit Messvorschrift und Kriterium „bestanden, wenn …“ in `description`, z. B. `Bus24VContractTest`: „Messung am Netzteilausgang … bei 9,3 A Last“. Präfixe nennen die Art: „Messung“, „HIL“, „HW-Validation“, „E2E“, „Firmware-Unit“. |
| Bindung | Keine. Kein SCHEMA trägt `realRef`, kein TEST trägt `testRefs`. R-26 und R-19 bleiben stehen (CR-SR-035, Abschnitt „Offen“). |
| Durchführung | Das Testkonzept nennt ein „manuelles HW-Testprotokoll“ als offene Lücke. Es existiert nicht. |
| Kanal | Kein Attribut. Nur `sync`/`async` an allen 86 FLOW. |

Folgerung: Der Inhalt ist in sirail gut. Ihm fehlt eine Datei, auf die `realRef` und `testRefs` zeigen können, und ein Ort für das Ergebnis eines Laufs von Hand.

## Was nach der Entscheidung folgt (je eigener CR)

1. **graphcode, `se-bau`:** Schritt „Vertragstest erzeugen“ (F1). Dateien: `.claude/commands/se-bau.md`, `tests/skill-bau.test.ts`.
2. **sigloch-modules, contracts:** Kanal-Attribut (F2), physische SCHEMA-Attribute (F3), Regeln je Kanal. Familien-Sache: Review, Version-Bump, Umsetzung durch den Hüter von sigloch-modules.
3. **graphanalyze:** Regel-Prototyp liest den Kanal; Messung der Treffergenauigkeit neu auf denselben 10 Stichproben. Kriterium vor dem Lauf: ≥ 8 von 10 richtig. Erst danach kommt die Regel nach contracts.
4. **FAQ:** `schema-bei-physischem-fluss` von „offen“ auf die Entscheidung.

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| F1 | Generator und Skill-Schritt kommen ins graphcode-Repo (2026-11-19, Autor) | Er wird fester Teil von graphcode und `se-bau`. Folge: Die Zeile „IS NOT: a generator“ in `CLAUDE.md` und README wird präzisiert auf „kein Code-Generator; erzeugt Prüfungen aus dem Modell“. |
| F2 | offen, nach Befund sirail | sirail kennt keinen Kanal. Mit F3d ist `physisch` an der Vertragsdatei erkennbar; der Kanal bleibt für `nachricht` und `datei` im Code nötig. |
| F3 | offen; Variante d vorgeschlagen | Autor: Testbeschreibung als Datei, von Hand durchzuführen, wo gefordert. Offen F3.1 und F3.2. |

## Umfang laut `graph_impact`

Relation-Kanten: `FUNC-se-bau` (F1). F2 und F3 betreffen die Ontologie in contracts; ihr Umfang entsteht in den Folge-CRs.
