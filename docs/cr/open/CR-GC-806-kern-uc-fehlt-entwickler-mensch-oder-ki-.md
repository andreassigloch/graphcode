# CR-GC-806: Kern-UC fehlt: Entwickler (Mensch oder KI) bringt ein System von der Absicht bis zum realisierten Code; Sub-UCs Spec-Erstellung und Code-Erstellung (inkl. Test), optional verknuepft

**Status:** 🟠 Open — blockiert durch Metamodell (siehe Blocker)
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

- **Kern-UC:** Entwickler bringt ein System von der Absicht bis zum realisierten Code (inkl. Test).
- **Akteur:** „Entwickler" — Mensch oder KI. Heute beginnt das Modell bei `ACTOR-agent`; `ACTOR-owner`
  ist der Mensch am Repo. Zu klären im Zug: ein Akteur `Entwickler` statt/neben agent+owner, oder
  Entwickler als Rolle, die beide Akteure einnehmen.
- **Zwei Sub-UCs, optional verknüpft:** Spec-Erstellung (Modell bauen/ändern) und Code-Erstellung
  (realisieren, binden, testen). Jeder ist allein nutzbar.
- Kandidaten-Ketten (im Zug zu bestätigen, nicht festgelegt):
  - Spec-Erstellung: `apply-gate`, `live-update`, `skill-authoring`, `capture`, `steering-loop`
  - Code-Erstellung: `agent-query` (Kontext), `impact-testing`, `test-ingest`, `snapshot-freshness`
  - `FCHAIN` darf mehrere UC-Eltern haben (single-compose-parent gilt nur FUNC/MOD), die Ketten bleiben
    zusätzlich unter ihren bisherigen UC, bis CR-GC-807 entscheidet.

## Blocker: Metamodell kennt keine UC-Hierarchie

`@sigloch/contracts/se` meta-model: `SYS → compose → UC`, `UC → compose → FCHAIN|REQ`,
**kein `UC → compose → UC`**. Sub-UCs sind heute illegal (R-18). Wege:
- **A** contracts-Erweiterung `UC -compose-> UC` (0..*) — Ergänzung, also minor; Familie-Review (L1/L2),
  danach Release-Zug vor diesem Modellzug.
- **B** ohne Hierarchie: Spec-Erstellung und Code-Erstellung als zwei gleichrangige UC, der Kern-UC
  entfällt; die „optionale Verknüpfung" bleibt dann unmodelliert.
- **C** Kern-UC als SYS-Ebene (`SYS → compose → SYS`) — missbraucht SYS als Szenario, nicht empfohlen.

Entscheidung des Auftraggebers nötig, bevor die Lane startet.

## Vorgehen

Interaktiv mit dem Auftraggeber (se:author-uc), nicht im Automode: jedes Substantiv/Verb des Kern-UC ins
Modell, Lücken als Fragen. Ein Zug durchs Gate, danach `graph_export` + Views.

## Umfang

Modell: `SYS-graphcode`, neue UC (Kern + 2 Sub), compose auf die bestätigten FCHAIN, Akteur(e).
Keine Code-Änderung. Lane MODELL (`verify:model`).
