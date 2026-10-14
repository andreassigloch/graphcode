# CR-GC-806: Kern-UC fehlt: Entwickler (Mensch oder KI) bringt ein System von der Absicht bis zum realisierten Code; Sub-UCs Spec-Erstellung und Code-Erstellung (inkl. Test), optional verknuepft

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-893 (idea)
**Erstellt:** 2026-10-14
**Item:** bok/items/ITEM-2026-893.json (Lane: graph)

---

## Problem

Der eigentliche Anwendungsfall von graphcode — ein Modell (Graph) erstellen und bis zum Code realisieren —
steht nicht im Modell (v750, 9 UC). Die vorhandenen UC lesen sich als Eigenschaften des Substrats
(„Jede Änderung geht durchs Gate", „Mit kleinem Modell arbeiten"). Folge, durchgespielt 2026-10-14: der
Ablauf „Entwickler lässt FUNC Test zwischen A und B anlegen" liegt in `FCHAIN-apply-gate`
(UC-code-quality) und `FCHAIN-live-update` (UC-live-graph-view); kein gemeinsamer Elternteil hält beide
als einen Ablauf zusammen, im Explorer ist der Weg nur über Namenswissen zu finden.

## Zielbild (Entscheidung Auftraggeber 2026-10-14)

- **EIN UC, keine Sub-UCs:** Entwickler bringt ein System von der Absicht bis zum realisierten Code
  (inkl. Test). Der Titel dieses CR („Sub-UCs") ist überholt.
- **Akteur:** „Entwickler" — Mensch oder KI. Heute beginnt das Modell bei `ACTOR-agent`; `ACTOR-owner`
  ist der Mensch am Repo. Im Zug zu klären: ein Akteur `Entwickler` statt/neben agent+owner, oder
  Entwickler als Rolle, die beide einnehmen.
- **Zwei Wirkketten an der Naht „Coding":**
  - **Spec-Kette (bis Coding):** Absicht → Modell im Gate → sichtbar.
  - **Code-Kette (ab Coding):** Kontext aus dem Graphen → Code → Bindung (`realRef`) → Testauswahl →
    Testergebnis zurück.
- **Die Reihenfolge ist Sache des Szenarios, nicht der Ketten:**
  - Neubau: Spec → Code.
  - Änderung: beide, in beliebiger Folge.
  - Reverse Engineering: Code → Spec. Hier ist „ab Coding" nicht die Code-Kette, sondern der Import
    (`FCHAIN-model-import`: Bestand einlesen), danach die Spec-Kette.
  Das Metamodell kennt keine Kante Kette → Kette; die Folge entsteht über die Flüsse an den gemeinsamen
  Gliedern. Der UC muss sie nicht festlegen.

## Verworfen: UC unter UC

`UC -compose-> UC` gibt es im Metamodell nicht. Smeagol (ITEM-2026-896) empfiehlt, es nicht einzuführen:
Leaf-Logik in UC-01/02/03 und CL-01, Single-Parent für UC, Existenzregel, RULES major. Mit einem UC und
mehreren Ketten entfällt der Bedarf — `UC -compose-> FCHAIN` ist 1..*, und eine FCHAIN darf mehrere
UC-Eltern haben (single-compose-parent gilt nur FUNC/MOD).

## Offene Entscheidung vor dem Zug

Wie die zwei Ketten gebaut werden:
- **(a) neue grobe Ketten** `FCHAIN-spec` / `FCHAIN-code`, die die Blatt-FUNCs der beteiligten feinen
  Ketten Ende-zu-Ende komponieren. Vorteil: Die Wirkkette-View zeigt den ganzen Ablauf auf einen Klick.
  Preis: FC-03 verbietet Blöcke als Glieder, also ~20–30 Blatt-FUNCs je Kette, die doppelt zu den
  feinen Ketten gepflegt werden.
- **(b) der UC komponiert die bestehenden feinen Ketten direkt**: Spec-Seite apply-gate, live-update,
  skill-authoring, capture; Code-Seite agent-query, impact-testing, test-ingest; Reverse model-import.
  „Spec" und „Code" sind dann nur eine Lesart. Ende-zu-Ende zeigt GVE erst mit CR-GVE-315 (Gruppierung)
  und CR-GVE-316 (Fluss folgen).

## Vorgehen

Interaktiv mit dem Auftraggeber (se:author-uc), nicht im Automode: jedes Substantiv/Verb des UC ins
Modell, Lücken als Fragen. Ein Zug durchs Gate, danach `graph_export` + Views.

## Umfang

Modell: `SYS-graphcode`, ein neuer UC, compose auf die Ketten nach (a) oder (b), Akteur. Keine
Code-Änderung. Lane MODELL (`verify:model`).
