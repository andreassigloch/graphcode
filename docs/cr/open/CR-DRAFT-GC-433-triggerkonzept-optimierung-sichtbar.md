# CR-DRAFT-GC-433 — Triggerkonzept: die Optimierung im Nicht-Auto-Modus anstoßen und sehen

**Status:** DRAFT — Entscheidungen getroffen (2026-08-26, s. Entwurf), Start wartet auf CR-GC-431 · **Angelegt:** 2026-08-26
**Entwurf (final):** https://claude.ai/code/artifact/e555fc68-f3de-412c-96d1-4d807131f1fa
**Herkunft:** Auftraggeber 2026-08-26, wörtlich: *„wenn wir nicht im Automodus unterwegs sind,
weiß der Kunde ja gar nicht, was unsere Regel- und Architekturmaschine vorschlägt. Das
Triggerkonzept fehlt uns völlig."*

## Befund — es gibt heute keinen einzigen ungefragten Kanal

| Kanal | was er heute tut | was ihm fehlt |
|---|---|---|
| `mutate()` → `fitAdvisory` | bewertet, was gerade geschah | schlägt nichts vor |
| `graph_suggest` | rankt Architektur-Kandidaten | rein ziehend — jemand muss fragen |
| `graph_next_step` | nennt die schwächste Dimension | wird nur auf Abruf gelesen; Architektur kommt darin nicht vor |
| Rundenprompt (`generate.ts:279`) | nennt `graph_suggest` **erst im `handoff`** | Handoff = Endzustand (alle Dimensionen über Schwelle, 0 Fehler, kein offenes Gate) |
| Dashboard (gve) | Readiness, Verstöße, Artefakte, Health, Autopilot | **kein einziger Architektur-Vorschlag** |

Der Mensch sieht Hygiene. Was die Architekturmaschine vorschlägt, sieht er nie — es sei denn,
er ruft ein Werkzeug auf, von dem er wissen muss, dass es existiert.

**Verschärfend:** Solange CR-GC-431 offen ist, rankt `graph_suggest` nach einer Sonde statt nach
dem ausgelieferten Edit. Ein Trigger auf die heutige Zahl würde die falsche Empfehlung
prominent machen. **431 ist Voraussetzung, nicht Nachbar.**

## Die drei Trigger-Arten (Vorschlag des Auftraggebers, ergänzt)

1. **Ziehend, explizit — ein Empfehlungs-Skill.** `/se:optimize` o. ä.: erhebt Zielprofil (falls
   fehlt), ruft `graph_suggest`, zeigt die Top-Vorschläge mit ihrem Δm und der Frage „anwenden?".
   Billigste Variante, sofort baubar, aber der Mensch muss ihn kennen und starten.
2. **Zeigend, permanent — das Dashboard.** Eine Karte „Was die Maschine vorschlägt": Top-k aus
   `graph_suggest` gegen das aktuelle Zielprofil, je mit Regel, Element, Δm und Anwendbarkeit
   (auto-apply / Fund-only). Das ist der Kanal, der **ohne Wissen des Nutzers** wirkt — er sieht
   es, weil er ohnehin hinschaut.
3. **Schiebend, im Fluss — den nächsten Schritt anzeigen.** Der Rundenprompt bzw.
   `graph_next_step` wird sichtbar, statt nur im Autopilot-Loop zu leben. Offene Frage: als
   Dashboard-Zeile, als Hook-Ausgabe nach `mutate`, oder beides.

## Die Vorfrage — entschieden: (a)

**Architektur gehört an den Anfang, nicht ans Ende** (Auftraggeber, 2026-08-26): *„mit den
Func-of-Func und den Wirkketten und der Allokation FUNC zu Modulen bestimme ich die Architektur,
DAS ist Prio. Der Rest ist Hygiene."*

Heute ist die Reihenfolge umgekehrt: der Handoff auf `graph_suggest` liegt hinter „alles grün".
Solange das so bleibt, ist jeder Trigger ein Pflaster auf einer falschen Reihenfolge. Zur Wahl
standen: (a) Architektur-Kanal parallel zur Hygiene dauerhaft offen · (b) Architektur zuerst,
Hygiene folgt · (c) wie heute am Ende, nur sichtbarer.

**Entschieden (2026-08-26, Entwurf oben): (a).** Die Zeile „Der nächste Zug" steht permanent
im Dashboard — Architektur- und Hygiene-Empfehlung nebeneinander, kein Handoff-Endzustand als
Voraussetzung.

Belege für (a)/(b) aus dem Bestand: graphcode selbst hat nach 206 gegateten Mutationen, null
Fehlern und acht Dimensionen `ready:true` den Handoff **nie erreicht** (`graph_next_step` sagt
`req`, Defizit 0,182). Und die Blockebene kam per Retrofit (CR-GC-405), nachdem RD-04 anschlug —
nicht aus einer Architektur-Entscheidung.

## Ausdrücklich nicht

- Kein Auto-Apply: die Maschine schlägt vor, der Mensch entscheidet (Gate-Prinzip unberührt).
- Keine neue Metrik, keine 7. Dimension.
- Kein Trigger, bevor CR-GC-431 die Ranking-Zahl korrigiert hat.

## Entscheidungen (getroffen 2026-08-26, siehe Entwurf)

1. Reihenfolge: **(a)** — Architektur-Kanal permanent parallel zur Hygiene.
2. Trigger-Arten: **alle drei** — im Entwurf als eine Fläche: permanente Zeile „Der nächste
   Zug" (Art 3), Karte 2 „Wo steht die Architektur?" mit graph_suggest-Befunden gegen das
   Zielprofil (Art 2), Button `/se:optimize` (Art 1).
3. Rundenschritt außerhalb des Autopilot-Loops: **ja** — als die permanente Dashboard-Zeile.

## Dateien (beim Start zu schneiden)

Je Trigger ein eigener CR:
- **Art 1:** Skill `/se:optimize` (`.claude/skills/`) — graphcode-Repo.
- **Art 2 + 3:** Zeile „Der nächste Zug" + Karte 2 nach Entwurf — eigener CR im gve-Repo;
  Datenquelle `graph_next_step`/`graph_suggest`, ggf. SSE-Bridge-Erweiterung in graphcode.
- Karte 1 des Entwurfs („Wirkt die Arbeit?") läuft als CR-DRAFT-GC-410, nicht hier.

**Voraussetzung unverändert:** CR-GC-431 (Ranking nach ausgeliefertem Edit) vor Art 1 + 2 —
der Entwurf zeigt selbst warum: „13 Befunde, 0 anwendbar".
