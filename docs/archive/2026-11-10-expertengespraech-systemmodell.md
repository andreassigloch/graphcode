# Expertengespräch zum Systemmodell: Einschätzung

**Datum des Gesprächs:** 2026-11-10 · **Gegenstand:** graphcode-Systemmodell (Ontologie, Wirkketten,
Verträge, Regelkatalog) · **Gegenüber:** Experte für Requirements und Systems Engineering aus der
Fahrzeugentwicklung

## Kernbefund

Der Ansatz trägt: Der Experte bewertete Verträge auf Flüssen, wenige abgeleitete Kantentypen und den
Testbaum bis zum Systemtest positiv. Die Vorführung scheiterte aber lange an fehlenden Definitionen.
Zwei Einwände treffen den Kern: Anforderung und Lösung waren in der Darstellung nicht getrennt, und
Linien ins Innere eines Blocks verletzen Information Hiding.

## Einwände des Experten

1. **Anforderung ohne Struktur.** Eine Anforderung braucht Auslöser, Ergebnis, Quantifizierung und
   Ausführungsbedingung als einen Block. KI-erzeugte Anforderungen fehlt das meist.
2. **Was und Wie vermischt.** Eine Anforderung nennt eine Lösungsidee nicht. Architektur erfüllt keine
   Anforderung, sie liefert eine Lösungsidee.
3. **Use Case ist Analyseinstrument**, Obermenge der Anforderungen, nicht selbst Anforderung.
4. **Zwei Sichten trennen.** Die statische Zerlegung zeigt Komponenten und Schnittstellen, die
   funktionale Zerlegung die Funktionsfolge. In einer Kette erscheint eine Funktion, nie ein Block.
5. **Information Hiding.** Linien enden am Rand einer Blackbox, nicht an inneren Elementen.
6. **Akteur ist eine Rolle** an der Systemgrenze, keine Komponente wie ein Dashboard.
7. **Regeln je Kontext.** Von vielen Regeln greifen in einer Lage nur wenige, das muss sichtbar sein.
8. **Eigene Ontologie behalten**, aber jeden Begriff hart definieren. Vorsicht mit Versionen und
   Änderungsaufträgen im Modell.

## Schwache Stellen der Darstellung

1. **Keine Definitionen parat.** Nach Pfeil, Kasten, Funktion, Anforderung und Vertrag wurde
   mehrfach gefragt. Die Elementliste kam erst gegen Ende.
2. **Anforderungstiefe gegen Lösungsfreiheit.** „So tief wie möglich, 1:1 an eine Funktion" und
   „eine Anforderung ist lösungsfrei" widersprechen sich, solange die Ebene nicht benannt ist.
3. **Use Case in drei Rollen**: Kundenanforderung, Sammelelement, Ende der Spezifikation.
4. **Blackbox ohne Begriff.** Die Bedeutung wechselte zwischen Wirkkette und Funktion. Dass Blackbox
   relativ zur Betrachtungsebene ist, kam vom Experten.
5. **Wirkkette falsch eingeordnet.** Sie ist die Innensicht des Systems für einen Use Case, nicht
   selbst eine Blackbox.
6. **Information Hiding als Grafikfrage abgetan.** Ohne berechnete Außenschnittstelle ist ein Block
   keine Blackbox, unabhängig vom Bild.
7. **Behauptung ohne Beleg.** Die 1:1-Zuordnung von Anforderung zu Funktion wurde nicht gezeigt.
8. **Selbstwiderspruch zu Optimierung und Regeln.** Automatische Optimierung hieß erst gescheitert,
   dann wirksam. Der Regelkatalog hieß erst Führung, dann Fehlerquelle für die KI.
9. **Modell in der Vorführung abgewertet.** Das schwächte die Aussage, der Ansatz sei reif.

## Was daraus folgte

- **Artefakt „Das Systemmodell in Bildern", Abschnitt 6** (`docs/project/systemmodell-in-bildern.html`):
  Definition je Element mit Normquelle (ISO/IEC/IEEE 24765, 29148, 15288, IREB, SysML, Arcadia),
  Satzmuster für Anforderungen als Empfehlung, Blackbox und Whitebox, die Treppe Was/Wie mit dem
  Modulbaum daneben, Format, Träger und Verfeinerung einer Übergabe.
- **Regelabschnitt:** 80 Regeln gesamt, je Stufe greifen 1 bis 12 plus 3 ständige.
- **CR-GVE-400** (graph-view-edit): Anschlusspunkte am Rand, Steckbrief, Kapselungsbefund im Viewer.

## Offen

- Satzmuster als Regel testen und Regelkandidaten am realen Modell abgleichen.
- 1:1-Zuordnung Anforderung zu Funktion am realen Modell belegen.
- Anforderung „Antwort ≤ 200 ms" an einer Funktion widerspricht der satisfy-Regel (Güte an Kette,
  Modul oder System). Nicht entschieden.
- Nicht adressiert: Dashboard als Akteur im eigenen Modell, Skalierung auf zehn vernetzte
  Betriebssysteme, Versionen und Änderungsaufträge im Modell, Vergleich der Ontologien.
