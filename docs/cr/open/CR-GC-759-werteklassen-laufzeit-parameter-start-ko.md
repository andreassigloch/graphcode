# CR-GC-759: Werteklassen Laufzeit-Parameter, Start-Konfiguration, Invariante als Allgemeinvorgabe prüfen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-777 (idea)
**Erstellt:** 2026-10-08
**Item:** bok/items/ITEM-2026-777.json (Lane: graph)

---

## Befund

Im Modell des Energiemanagers (Repo `energymanager`, Commit `4f38a5e`, 2026-10-08) konnte ein
unabhängiger Gutachter nicht erkennen, welche festen Werte in Anforderungen Absicht sind und welche
nur noch nicht einstellbar. Er zählte 15 „erfundene Werte", die Zahl war am Text nicht entscheidbar.

Der Auftraggeber hat daraufhin eine Einteilung festgelegt, die dort als `REQ-ops-werteklassen` steht:

| Klasse | Bedeutung | Entsprechung im Code |
|---|---|---|
| Laufzeit-Parameter | im Betrieb änderbar, wirkt sofort, mit Verlauf; global, in einem Einstellungs-Vertrag | geteilter veränderlicher Zustand (Rust: `Arc<RwLock<Settings>>`) |
| Start-Konfiguration | beim Start aus einer Datei gelesen, bis zum Neustart unveränderlich | unveränderliches Struct (Rust: `&Config`) |
| Invariante | auf keinem Weg verstellbar | Konstante oder ein Typ ohne die verbotene Operation |
| Aufrufwert (keine Klasse) | gilt nur für einen Aufruf, steht im Vertrag dieses Aufrufs | Funktionsparameter |

Regel des Auftraggebers: Einstellbar ist alles, was Verhalten oder Funktion des Systems beeinflusst.

Was graphcode dabei nicht geleistet hat:

- Die Einteilung musste an 40 Anforderungen von Hand als freies Attribut `werteklasse` geschrieben
  werden. Das Gate nimmt freie Attribute an, prüft sie aber nicht.
- Keine der erzeugten Ansichten unter `docs/views/` zeigt freie Attribute. Das gilt ebenso für die
  dort verwendeten Vermerke `annahme`, `bestaetigt` und `auslegung` (geprüft: 0 Treffer in `srs.md`,
  `nfr.md`, `rtm.md`). Wer nur die Ansichten liest, sieht die Einteilung nicht.
- Kein Befund entsteht, wenn ein Wert ohne Klasse bleibt, wenn ein Laufzeit-Parameter in keinem
  Vertrag steht oder wenn eine Invariante keinen Test hat, der ihre Unverstellbarkeit belegt.

## Ziel

Prüfen, ob diese Einteilung eine Allgemeinvorgabe von graphcode werden soll, und entscheiden.
Dieser CR baut nichts; er endet mit einem begründeten Entscheid.

Zu beantworten:

1. **Trägt das Schema allgemein?** Gegenprobe an mindestens zwei weiteren Modellen (graphcode selbst
   und ein Modell ohne Gerätebezug): Lässt sich dort jeder Wert genau einer Klasse zuordnen, und wo
   nicht, warum?
2. **Träger:** Attribut mit festem Wertebereich an der REQ, eigenes Element oder nur Konvention im
   Skill `se:author-req`. Die Ontologie ist geschlossen; ein Attribut oder Element ist Sache der
   Contracts (`@sigloch/contracts/se`) und braucht dort einen eigenen CR.
3. **Regeln:** Kandidaten sind „REQ mit Zahl und Einheit trägt eine Klasse", „Laufzeit-Parameter
   steht in einem SCHEMA", „Invariante hat einen Test auf Unverstellbarkeit". Je Kandidat: Trefferzahl
   und Fehlalarme an den Modellen aus Frage 1.
4. **Ansichten:** Sollen `srs.md` und `nfr.md` die Klasse zeigen, und gilt das dann auch für Annahme-
   und Bestätigungsvermerke?
5. **Aufwand beim Schreiben:** Wie viele zusätzliche Angaben je Anforderung, und lohnt das gegen den
   Befund oben?

## Akzeptanz

- Entscheid in diesem CR: übernehmen, nur als Skill-Konvention übernehmen oder verwerfen, jeweils
  mit der verworfenen Alternative und dem Grund.
- Die Gegenprobe aus Frage 1 steht mit Zahlen im CR: Werte gesamt, zugeordnet, nicht zuordenbar.
- Bei Übernahme: je ein Item für Contracts, Regel und Ansicht; keine Umsetzung in diesem CR.

---

## Umfang laut `graph_impact`

Noch nicht bestimmt: Der CR wurde aus einer Sitzung im Repo `energymanager` angelegt, deren
Graph-Zugang nicht auf das Modell von graphcode zeigt. Erster Schritt der Lane ist `graph_impact`
auf die Knoten für REQ-Attribute, Regelkatalog, Schreibanleitung (`graph_authoring_guide`) und die
Ansichten SRS und NFR. Dieser CR ändert selbst keinen dieser Knoten.
