# Vorführung: Bausteinkonzept für drei Zielgruppen

**Stand:** 2026-11-11 · **Status:** Konzept, nichts gebaut · **Anker:** `docs/graphcode_leitlinie.md` §1, §2, §9.1

## Ziel

Eine Vorführung, drei Zielgruppen. Je Zielgruppe wählen wir aus festen Bausteinen die passenden aus,
statt jedes Mal neu zu erzählen. Ein kleines Beispiel trägt alle Bausteine: die Paketstation.

Die Leitlinie verlangt, dass jeder Claim **vorführbar** ist (§1 DoD, §9.1): Ein Außenstehender sieht ihn
an einer Demo, ohne das Repo zu kennen. Dieses Konzept zahlt darauf ein. Jeder Demo-Baustein nennt den
Test aus §9, den er vorführt.

## Zielgruppen

| Zielgruppe | Wer | Fragt zuerst | Claim (Leitlinie §1) |
|---|---|---|---|
| **Theorie** | kennt die Theorie guter Spezifikation und des Systems Engineering | Was bedeuten Kasten und Pfeil? Wo endet das Was, wo beginnt das Wie? | Verstehen (V) |
| **Spezifikation** | erstellt operativ Spezifikationen; Bestand nachträglich erschließen, verstreute Anforderungen zusammenführen | Wo sind meine Anforderungen, und wer erfüllt sie? | Verstehen (V), Nachweis (§2) |
| **Code** | erstellt operativ Code, interessiert am Wie: KI, Ablauf, technischer Aufbau | Wie führt das Modell den Agenten, und was kommt im Code an? | Managen (M), Beweis im Code (§6) |

## Ablauf (immer gleich)

| Teil | Dauer | Inhalt |
|---|---|---|
| Intro | 3 min | Baustein I1 |
| Elemente | 10 min | 2–3 Bausteine E |
| Live-Demo | 10 min | 1–2 Bausteine D am Modell der Paketstation |
| Fragen | offen | – |

**Grundsatz:** erst die Definition, dann das Beispiel, dann das Bild. Ein Netz zeigen wir nie vor dem
Begriff, der es erklärt.

## Bausteine

Jeder Baustein ist ein Abschnitt im Artefakt `systemmodell-in-bildern.html`. Ein Schalter oben wählt
die Zielgruppe (Theorie · Spezifikation · Code · Alle) und blendet die übrigen Abschnitte aus.

● zeigen · ○ bei Nachfrage · – weglassen · **1.** Einstieg der Zielgruppe

| Nr | Baustein | Quelle | Theorie | Spezifikation | Code |
|---|---|---|---|---|---|
| I1 | **Ziel:** Abstraktion statt 1:1-Abbild; die vier Fragen Warum · Wie · Womit · Worüber (Leitlinie §2) | neu | ● | ● | ● |
| E1 | Begriffe: Was und Wie, Blackbox und Whitebox | Kapitel 6 | ● **1.** | ○ | – |
| E2 | **Anforderungsbaum der Paketstation** | neu | ● | ● **1.** | ○ |
| E3 | Die zwölf Bausteine | Kapitel 1 | ● | ○ | ○ |
| E4 | Die sechs Verbindungen | Kapitel 2 | ● | – | ○ |
| E5 | Die Paketstation als Netz | Kapitel 3 | ○ | ● | ● |
| E6 | Regeln und Stufen | Kapitel 4 | ● | – | ○ |
| E7 | Die Methode: geführt, nicht gegängelt | Kapitel 5 | – | ○ | ● **1.** |
| D1 | Von der Anforderung zum Test, Einstieg über die Ansicht „Requirement Review" | Viewer | ● | ● | ○ |
| D2 | Eine Blackbox ein- und ausklappen, Anschlüsse am Rand | Viewer | ● | ○ | ● |
| D3 | Bestand einlesen, verstreute Anforderungen zusammenführen | `se:import-doc`, `se:import-code`; Kapitel neu | – | ● | – |
| D4 | Der Agent baut interaktiv eine Änderung durch das Gate, der Graph wählt die Tests | Agent | – | – | ● |

**Je Zielgruppe:**
- **Theorie:** I1 → E1 → E2 → E4 → D1
- **Spezifikation:** I1 → E2 → E5 → D1 → D3
- **Code:** I1 → E7 → E5 → D2 → D4

### Demo-Bausteine und die Tests der Leitlinie

| Demo | führt vor | Test (§9.3) | Stand laut Leitlinie |
|---|---|---|---|
| D1 | Traceability aus dem Modell statt behauptet | T-N2 | teilweise: 137 von 158 TEST gebunden |
| D2 | jede Ebene eine Blackbox mit 3–9 Kindern und schmalem Rand | T-V1, T-V2 | nicht bestanden an graphcode; an der Paketstation herzustellen |
| D3 | Modell aus Fremdquellen einlesen | T-N3 (Aufbau `se:import-doc`) | nicht gemessen |
| D4 | Gate hält Verstöße fern; Graph wählt die Tests | T-M1, T-E7 | nicht bestanden (5 von 76 Regeln blocken); Trefferquote 13 % |

**Regel:** Die Demo zeigt, was trägt. Was laut §9 offen ist, nennen wir offen. Eine Aussage, die wir
in der Vorführung zurücknehmen müssen, schwächt den ganzen Ansatz.

## Der neue Kernbaustein E2: Anforderungsbaum

**Problem:** Die Zielgruppe Spezifikation steigt über Anforderungen ein. Die Startansicht des Viewers
zeigt ein Netz, an dem die Anforderungen nur hängen. Diese Zuhörer verlieren wir dort.

**Inhalt:** Links der Baum, wie ihn eine gute Spezifikation gliedert. Rechts je Zeile ein Verweis ins Modell.
Das Modell beantwortet so die Frage „Wer erfüllt das?". Es ist nicht der Einstieg.

```
Systemanforderung   Kunde holt sein Paket ohne Personal ab
└─ Anwendungsfall   Paket abholen
   ├─ Anforderung   Fach öffnet ≤ 2 s nach gültigem Code         → Funktion „Code prüfen"   → Test
   ├─ Anforderung   Nach 3 Fehlversuchen 60 s Sperre             → Funktion „Code prüfen"   → Test
   └─ Anforderung   Riegel öffnet nur bei Netzspannung ≥ 11 V    → Funktion „Riegel ziehen" → Test
```

Jede Anforderung trägt Auslöser, Ergebnis, Quantifizierung und Ausführungsbedingung. Damit zeigt E2
zugleich das Satzmuster aus Kapitel 6.

**Offen:** Die Ansicht „Requirement Review" ist heute eine Liste und kein Baum. Ob sie für D1 reicht,
entscheiden wir am fertigen E2. Reicht sie nicht, wird daraus ein CR im Viewer-Repo.

## Beispiele

| Beispiel | Rolle | Größe |
|---|---|---|
| **Paketstation** | trägt alle Bausteine; als echtes Modell für die Live-Demo; Software, Elektrik und Mechanik in einem kleinen System | Ziel: 1 System, 2 Anwendungsfälle, ≤ 7 Funktionen, ≤ 3 Module, ~10 Anforderungen |
| sirail | Zusatz Elektromechanik; Fremdsystem der Leitlinie (§1 DoD, §8) | vorhanden, muss auf Stand gebracht werden |
| City People Mover (`prod/graphcodedemo`) | nicht für den Einstieg | 219 Einträge, zu groß |
| graphcode selbst | **nicht** als Beispiel: ein Werkzeug, das sich selbst modelliert, ist für Außenstehende doppelt abstrakt | – |

Bild und Live-Modell der Paketstation verwenden dieselben Namen wie Kapitel 3 und die Treppe in Kapitel 6.

## Use Cases von graphcode je Zielgruppe

Die neun Use Cases des Modells, zugeordnet nach dem Nutzen, den die Zielgruppe daraus zieht.

| Use Case | Theorie | Spezifikation | Code |
|---|---|---|---|
| `UC-deterministic-steering` Deterministisch auf ein mehrdimensionales Ziel steuern | ● | ○ | ● |
| `UC-code-quality` Jede Änderung geht durchs Gate | ● | ● | ● |
| `UC-model-exchange` Modell ein- und ausgeben | ○ | ● | ○ |
| `UC-live-graph-view` Modellstand live mitlesen | – | ● | ○ |
| `UC-graph-time-travel` Graph-Stand pro Commit wiederherstellbar | ○ | ● | ● |
| `UC-efficient-testing` Effizientes, impact-basiertes Testen | – | – | ● |
| `UC-reduced-llm` Mit kleinem oder lokalem Modell arbeiten | – | – | ● |
| `UC-repo-lifecycle` Repo einrichten und betreiben | – | – | ○ |
| `UC-loop-closure` Schwellen und Prompts am Trail kalibrieren | – | – | – (Betreiber des Regelwerks, nicht vorführen) |

**Befund:** Alle neun Use Cases sprechen „den Entwickler" an. Zwei Lücken:

1. **Spezifikation:** „Bestand erschließen und verstreute Anforderungen zusammenführen". `UC-model-exchange`
   deckt nur das Einlesen, nicht das Zusammenführen. Das ist der Kern von D3.
2. **Code:** Der Kern-Anwendungsfall „Entwickler (Mensch oder KI) bringt ein System von der Absicht bis
   zum Code" fehlt im eigenen Modell (Leitlinie §8, CR-GC-806).

Die Zielgruppe Theorie braucht keinen eigenen Use Case (Entscheidung des Autors, 2026-11-11): Sie
bewertet die Methode, sie nutzt das Werkzeug nicht. Ob aus den zwei Lücken neue Use Cases werden, ist
eine Modellentscheidung und gehört in einen eigenen CR, nicht in dieses Konzept.

## Abgleich mit der Leitlinie

| Stelle | Verhältnis |
|---|---|
| §1 Kern-Claim: Abstraktion, Blackboxen von der Wurzel bis zur Funktion | I1 und D2 führen genau das vor |
| §1 DoD, §9.1: jeder Claim vorführbar | Demo-Bausteine tragen je einen Test aus §9 |
| §2 vier Fragen Warum · Wie · Womit · Worüber | I1 nutzt sie als Gliederung; E2 beantwortet das Warum zuerst |
| §2 Gütemaß Verständlichkeit, wenige Blöcke je Ebene | Paketstation ≤ 7 Funktionen, ≤ 3 Module |
| §2 Geltungsbereich: modelliert wird jedes System, auch Mechanik und Elektrik | Paketstation und sirail zeigen das |
| §4 Hauptfall interaktiv, Automodus ist Testmodus | D4 zeigt den interaktiven Zug, nicht die Schleife |
| „Woran wir uns verlaufen": eine Diskussion ohne Test aus §9 zahlt auf keinen Claim ein | jeder Demo-Baustein nennt seinen Test |
| §8 Demo-Träger | Die Paketstation ersetzt den Energy Manager als Demo-Träger (Entscheidung des Autors, 2026-11-11; §8 angepasst). Der Energy Manager bleibt Rig-Aufgabe in §9.4 |

## Abnahmekriterien

1. Der Schalter für die Zielgruppe blendet je Gruppe nur deren Bausteine ein; „Alle" zeigt den heutigen Stand.
2. Jede Zielgruppe kommt mit höchstens 5 Bausteinen durch Intro, Elemente und Demo.
3. Bild und Live-Modell der Paketstation verwenden dieselben Namen.
4. E2 zeigt den Anforderungsbaum, bevor ein Netz zu sehen ist.
5. Jeder Demo-Baustein nennt seinen Test aus §9 und dessen Stand.

## Reihenfolge der Umsetzung

Jeder Schritt ist ein eigener CR.

| Nr | Schritt | CR | hängt an |
|---|---|---|---|
| 1 | I1 und E2 im Artefakt; legt die Namen der Paketstation fest | CR-GC-906 | – |
| 2 | Schalter für die Zielgruppe | CR-GC-907 | CR-GC-906 |
| 3 | Use Case Spezifikation im Modell | CR-GC-905 | – |
| 4 | Kapitel zu D3 (Bestand einlesen und zusammenführen) | CR-GC-908 | CR-GC-905, CR-GC-906 |
| 5 | Paketstation als Modell, neben dem City People Mover in `prod/graphcodedemo` | CR-PAKET-001 (graphcodedemo) | CR-GC-906 |
| 6 | sirail auf Stand bringen | CR-034 (sirail) | – |
| – | Ansicht Anforderungsbaum im Viewer | nur falls „Requirement Review" nicht reicht | CR-GC-906 |
