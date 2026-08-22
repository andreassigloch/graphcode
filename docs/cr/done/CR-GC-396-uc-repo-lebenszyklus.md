# CR-GC-396 — Der Repo-Lebenszyklus hatte keinen Use Case

**Status:** done 2026-08-22 · **Angelegt:** 2026-08-22 · **Basis:** graphVersion 177 → **179**
**Umsetzung:** dieses Repo (reine Modellarbeit durchs Gate, kein Code)
**Herkunft:** Befund 2 aus CR-GC-395

## Problem

Nach CR-GC-395 meldeten sechs Funktionen `R-30` — sie hängen in keiner Wirkkette. Das waren nicht
sechs Befunde, sondern einer: für die Reihenfolge, die ein Entwickler an der Kommandozeile
tatsächlich durchläuft, gab es weder Kette noch Use Case. Eine Kette allein hätte nicht gereicht:
`R-15` verlangt seit CR-SM-249, dass über jeder Kette ein UC steht.

Die CLI ist der meistbenutzte Einstieg ins System und war im Modell nur als Sammlung
unzusammenhängender Funktionen vorhanden.

## Änderung

`UC-repo-lifecycle` — *„Der Entwickler richtet ein Repo ein, fährt Läufe darin und beendet die
Sitzung; danach ist das Repo arbeitsfähig und kein Prozess bleibt zurück."* 23 Wörter, aktiv,
Akteur–Verb–Objekt–Ergebnis, **null** Fachbegriffe aus dem Jargonbudget.

`FCHAIN-repo-lifecycle` mit sechs Gliedern in der Reihenfolge, die real durchlaufen wird:
`FUNC-harness-cli` → `FUNC-bootstrap` → `FUNC-cli-dispatch` → `FUNC-run-verb` → `FUNC-upgrade` →
`FUNC-session-shutdown`.

Der UC komponiert vier **bestehende** Anforderungen, die genau dieses Szenario beschreiben:
`REQ-npx-distribution`, `REQ-install-idempotent`, `REQ-repo-update`, `REQ-bootstrap-through-gate`.
Keine wurde für diesen Zweck neu geschrieben.

Zusätzlich: `FUNC-import-code-verb` hängt jetzt in `FCHAIN-model-import`, wo es hingehört — dieselbe
Kette wie `FUNC-import` und die beiden Import-Skills.

## Ein Fehler unterwegs, sofort geschlossen

Der erste Batch erzeugte einen **`UC-01`-Fehler**: ein UC ohne Anforderungen. Das Gate hat ihn
gemeldet, der zweite Batch hat ihn mit den vier compose-Kanten geschlossen. Zwischenstand
dokumentiert, weil er zeigt, dass die Reihenfolge UC-zuerst-dann-REQ falsch ist — beides gehört in
**einen** Batch, wie es `se:author-req` für REQ und TEST längst vorschreibt.

## Ergebnis

| Regel | Δ | Grund |
|---|---|---|
| `R-30` | **−6** | Die sechs Kettenglieder plus `FUNC-import-code-verb`; `FUNC-session-shutdown` war schon in einer Kette |
| `IO-01` | +3 | Bootstrap, Sitzungsende und Import-Verb hängen in ihrer Kette, ohne dass ein Datenpfad sie mit den Nachbarn verbindet |
| `UC-05` `UC-06` | +2 | Der neue UC nennt keine Vor- und Nachbedingung als eigene REQ |

Findings **155 → 154**. Fehler 0, Compliance 1,000. SRR-Vollständigkeit 16/17 → **18/19**,
Score 0,941 → 0,947. PDR bleibt bei 1,000 mit gewachsenem Nenner (34 → 36).

Der `IO-01`-Anstieg ist die ehrliche Gegenrechnung: die Kette ist real, die Datenübergaben zwischen
ihren Gliedern laufen über den Store und sind im Modell nicht gezeichnet. Das ist eine wahre
Aussage über das Modell und kein Grund, einen Fluss zu erfinden.

## Akzeptanzkriterien

- [x] UC ≤25 Wörter, aktiv, ≤2 gegroundete Fachbegriffe — erfüllt mit 23 Wörtern und null Begriffen.
- [x] Der UC komponiert nur bestehende REQ.
- [x] `R-30` fällt um 6.
- [x] Fehler 0, Compliance 1,000.
- [x] Der `IO-01`-Anstieg ist benannt, nicht wegmodelliert.

## Nicht in diesem CR

Vor- und Nachbedingung des UC als eigene REQ (`UC-05`/`UC-06`, beide info). Sie wären formulierbar —
Repo mit Schreibrecht davor, Store auf Disk und kein Prozess danach —, gehören aber mit
`se:author-req` samt Abnahme autoriert, nicht als Kante nachgeschoben.
