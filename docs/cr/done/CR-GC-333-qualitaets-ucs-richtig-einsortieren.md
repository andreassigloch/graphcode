# CR-GC-333 — Qualitäten sind keine Use Cases

**Status:** done · **Datum:** 2026-08-13 · **Abgeschlossen:** 2026-08-13
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert** (nur Graph-Inhalt)
**Bezug:** [CR-GC-332](CR-GC-332-steuerungsschleife-modellieren.md) (Enabler-UC `UC-selbststeuerung`),
`bok/docs/research/enabler-use-cases-und-entscheidungsmodellierung.md` (die allgemeine Fragestellung),
CR-SM-226 (UC-Regeln UC-01..06)

---

## 1. Problem

Drei der sechs Use Cases sind keine. Sie tragen `name == id` und eine **leere description** — nie
formuliert, nur befüllt:

| UC | name == id | description | Kinder |
|---|---|---|---|
| `UC-code-quality` | ja | leer | `FCHAIN-apply-gate`, `FCHAIN-capture`, `FCHAIN-codec-roundtrip`, `FCHAIN-interface-escalation` + 6 REQ |
| `UC-reduced-llm` | ja | leer | `FCHAIN-advisory-roundtrip`, `FCHAIN-modelfree-gate` + 2 REQ |
| `UC-token-efficiency` | ja | leer | `FCHAIN-agent-query` + 3 REQ |

Die drei ausformulierten UCs (`efficient-testing`, `graph-time-travel`, `live-graph-view`) stehen
dagegen im „Als Entwickler will ich…"-Stil. Die Trennlinie verläuft exakt entlang „wurde je ein Satz
geschrieben".

`REQ-greenfield-systemtest-dod` hängt unter **allen dreien** — der Beleg, dass es Sammelbehälter
sind, nicht Nutzungen.

**Warum das schadet, statt nur unsauber zu sein:** ein UC darf Ketten tragen, eine REQ nicht. Wer
eine Qualität als UC anlegt, bekommt einen legalen Platz für Mechanismen, die woanders hingehören —
`FCHAIN-agent-query` (Impact + progressive Expansion) hängt unter „Token-Effizienz", obwohl sie
Kontextsteuerung beschreibt, also einen Enabler. Das Modell sieht vollständig aus und ist falsch
sortiert; keine Regel kann das sehen.

---

## 2. Ziel

Qualitäten stehen als Anforderung, Mechanismen unter dem Enabler, Nutzungen als UC.

---

## 3. Nicht-Ziele

- **Keine Ontologie-Änderung.** Kein neuer Elementtyp „Enabler" oder „Qualität"; das ist die offene
  Diskussion im bok, nicht dieser CR.
- **Kein Neuschnitt der REQs.** Was heute unter den drei Eimern hängt, bleibt inhaltlich gleich —
  es bekommt nur den richtigen Elterntyp.
- **Kein Umbau von `UC-reduced-llm`.** Der bleibt UC: „kleine/lokale Modelle tragfähig" ist eine
  Nutzung, kein Attribut — er ist nur nie formuliert worden. Er bekommt einen Satz, nicht einen
  neuen Typ.

---

## 4. Anforderungen

1. **`UC-token-efficiency` → `REQ-token-efficiency`.** Eine Eigenschaft, kein Ablauf. Die drei
   REQ-Kinder hängen als `REQ→REQ` weiter (im Graphen belegte Kante), `FCHAIN-agent-query` wandert
   zu `UC-selbststeuerung` (CR-GC-332) — dorthin, wo Kontextsteuerung hingehört.
2. **`UC-code-quality` prüfen und entscheiden.** Vier Ketten und sechs REQs sind zu viel für einen
   Eimer: `FCHAIN-apply-gate` und `FCHAIN-interface-escalation` sind Governance-Mechanismen,
   `FCHAIN-capture` und `FCHAIN-codec-roundtrip` sind Nutzungen. Der CR entscheidet die Zuordnung
   **explizit im Text**, statt sie beim Verschieben nebenbei festzulegen.
3. **Alle drei bekommen einen Satz.** `name` ≠ `id`, description ausformuliert — für das, was sie
   nach dem Umbau sind (REQ-Formulierung „Das System soll…", UC-Formulierung „Als … will ich …").
4. **`REQ-greenfield-systemtest-dod` bekommt einen eindeutigen Elternteil.** Ein DoD-Requirement,
   das unter drei Zielen hängt, gehört an das SYS oder an genau einen davon.
5. **Reihenfolge:** erst CR-GC-332 (der Enabler existiert), dann dieser CR (die Ketten haben ein
   Ziel zum Hinwandern). Andersherum entstünden verwaiste FCHAINs.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `docs/graph/graphcode.graph.json` | Typwechsel, Umhängen, Formulierungen |
| `docs/views/*` | regeneriert |

Umsetzung über `graph_mutate` + `graph_export`. Der Typwechsel UC → REQ ist **kein** Umbenennen:
alter Knoten löschen, neuer anlegen, Kanten neu setzen — das ist ein Batch mit Provenienz, kein
In-Place-Edit.

---

## 6. Akzeptanzkriterien

- [x] Kein UC im Graphen hat `name == id` oder eine leere description (6 UC geprüft, alle ok).
- [x] `FCHAIN-agent-query` hängt unter genau einem UC — **`UC-reduced-llm`**, nicht unter einer
      Qualität (Abweichung vom CR-Wortlaut, begründet in §8).
- [x] `REQ-token-efficiency` existiert mit seinen Kindern; kein `UC-token-efficiency` mehr.
- [x] `REQ-greenfield-systemtest-dod` hat genau einen Elternteil: `SYS-graphcode`.
- [x] UC-01 **0**, UC-02 **0**, UC-03 **0**, UC-04 **3 → 0**, FC-02 **0**, RD-01/RD-02 **0**.
      UC-05/UC-06 gehen 7 → 6 (ein UC weniger). FC-04 bleibt bei 1 — das ist
      `FCHAIN-live-update`, vorbestehend.
- [x] Views neu exportiert, Suite unverändert (dieselben zwei bekannten Roten).

---

## 7. Folgen

Danach trägt die UC-Ebene nur noch Nutzungen und Enabler — und die Frage „wo steht der Mechanismus?"
hat eine Antwort, die man traversieren kann statt sie zu suchen. Ob „Enabler" langfristig ein
eigener Typ sein sollte, bleibt die offene Diskussion im bok; dieser CR zeigt, wie weit man mit den
vorhandenen Mitteln kommt.

---

## 8. Abschluss 2026-08-13 — die zwei Entscheidungen, die der CR verlangt hat

**§4.1 — `FCHAIN-agent-query` hängt jetzt unter `UC-reduced-llm`, nicht unter dem Enabler.**
Der CR schickte sie zu „`UC-selbststeuerung` (CR-GC-332)". Der Enabler heißt dort real
`UC-deterministic-steering` und ist **enger** als angenommen: er beschreibt die
Kenngrößen-Schleife (messen → projizieren → Fokus → Rangfolge → Prompt → Gate), nicht
Kontextsteuerung. Eine Query-Kette dorthin zu hängen wäre genau die Fehlsortierung, gegen die
dieser CR antritt. Der Graph nennt den richtigen Platz selbst: `FUNC-graph-impact` **satisfy-t
schon heute `UC-reduced-llm`** — Präzisions-Query IST der Mechanismus, der kleine Modelle
tragfähig macht. Entscheidung mit dem Autor abgestimmt.

**§4.2 — `UC-code-quality` bleibt ein UC und wird formuliert.** Die Qualität selbst steht
bereits als `REQ-code-governed-quality` darunter; der UC ist die *Nutzung* („Jede Änderung geht
durchs Gate"). Die vier Ketten bleiben, wo sie sind — ein Verschieben der Governance-Ketten
hätte zwei neue Elternfragen aufgemacht, ohne eine zu beantworten. Kleinster Eingriff, keine
verwaiste Kette.

### Was der Umbau konkret war (zwei Gate-Batches, v76 → v78)

| | |
|---|---|
| **Neu** | `REQ-token-efficiency` (non-functional, ausformuliert), `SYS —compose→` als Elternteil, verifiziert durch `TEST-token-efficiency` |
| **Umgehängt** | `REQ-precise-context` + `REQ-benchmark-harness` als `REQ→REQ`; die drei FUNC-satisfy (`encode`, `graph-expand`, `graph-impact`) auf das **Kind** `REQ-precise-context`, nicht auf den Eltern-REQ; die drei CR-Relationen auf den neuen REQ; `FCHAIN-agent-query` unter `UC-reduced-llm` |
| **Formuliert** | `UC-code-quality` („Jede Änderung geht durchs Gate"), `UC-reduced-llm` („Mit kleinem oder lokalem Modell arbeiten") — beide im Actor-Verb-Objekt-Outcome-Stil, ≤ 25 Wörter |
| **Gelöscht** | `UC-token-efficiency` (mitsamt 5 ACTOR-io-Kanten, die als `ACTOR→REQ` illegal gewesen wären) und die zwei überzähligen Elternkanten von `REQ-greenfield-systemtest-dod` |

**Ein Regelfund unterwegs, sofort korrigiert:** der erste Entwurf hängte die drei FUNC-satisfy
an `REQ-token-efficiency` — RD-02 („Eltern-REQ mit Sub-REQs trägt keine direkte
FUNC-Realisierung") feuerte im dryRun. Die Kanten gehören ans Kind. Genau der Fall, für den der
dryRun da ist: Fund vor dem Schreiben, nicht danach.

**Nicht angefasst (Nicht-Ziel §3):** kein neuer Elementtyp. Ob „Enabler" langfristig einer sein
sollte, bleibt die bok-Diskussion; mit `SYS —compose→ REQ` für eine System-NFR und einem UC je
Nutzung kommt man ohne aus.

@author andreas@siglochconsulting
