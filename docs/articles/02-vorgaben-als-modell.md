# Warum KI-Agenten überzeugend das Falsche programmieren

> **Titelbild (folgt):** die Dashboard-Tabs **Readiness** (Reifegrad der Vorgabe),
> **Recommendations** (was noch fehlt) und **Artifacts** (die Bausteine der
> Spezifikation) — alles ohne KI errechnet. Screenshot nach dem Tab-Umbau.

**These:** Eine KI ohne präzise Vorgabe füllt jede Lücke mit dem Wahrscheinlichsten.
Das Ergebnis kompiliert, sieht richtig aus — und ist trotzdem nicht das, was du wolltest.
Der Fix liegt **vor der ersten Zeile Code**: ein sauberes Spezifikations-Modell, das
einen festen Regelsatz erzwingt — ohne den schweren Werkzeug-Apparat klassischer
Modellierung (im Fachjargon *MBSE*), und ohne dass eine KI mitredet.

## Plausibel ist nicht gewünscht

Die Korrektheit entscheidet sich nicht im Code, sondern in der Vorgabe. Der
[Struktur-Benchmark](01-structure-and-llm-needs.md) zeigt die Probe aufs Exempel: dort
war die Prosa-Spezifikation absichtlich falsch — die KI blieb trotzdem korrekt, weil sie
der Vorgabe folgte und das fehlerhafte Dokument nie las.

## Phase 1 macht genau zwei Dinge

**1. Spezifikation als Modell — ohne den Modellierungs-Ballast.**
Was bleibt, ist die Substanz: *was* das System können muss, *wie* das durch Tests bewiesen
ist, *was* es umsetzt, und *wie* alles zusammenhängt. Was wegfällt: schwere
Modellierungswerkzeuge, Diagramm-Zeremonie, eine eigene Spezialisten-Rolle. Stattdessen
ein schlanker, verknüpfter Plan, gepflegt im selben Arbeitsfluss wie der Code.

**2. Gesteuert durch Regeln — nicht durch KI.**
Ob die Vorgabe vollständig ist, beurteilt kein Sprachmodell, sondern ein fester Regelsatz:
jede Anforderung braucht einen Test, der sie prüft; jede Funktion ein Modul, das sie
umsetzt. Das Dashboard zeigt live, was noch fehlt — bei jedem Lauf dasselbe Ergebnis,
ohne Token, ohne Halluzination. Die KI darf Inhalte *vorschlagen*; das Urteil
„vollständig?" fällt die Regel.

## Erst Vorgabe, dann Code

Phase 1 (Vorgabe) ist die Bedingung für Phase 2 (Umsetzung). Erst eine präzise,
regelgeprüfte Vorgabe macht aus „plausibel" das „Gewünschte" — und macht den schlanken
Umsetzungs-Loop aus [Artikel 01](01-structure-and-llm-needs.md) (ein kleines Modell,
korrekt aus **667 Token**) überhaupt belastbar. Ohne Phase 1 rät der Agent die Absicht;
mit ihr liest er sie.

## Ehrliche Grenze

Die Regel prüft die *Form* — ob jede Anforderung ihren Test hat, ob die Verbindungen
erlaubt sind. Das *inhaltliche* Urteil — ist das die richtige Anforderung? — bleibt beim
Menschen. Phase 1 automatisiert das saubere Festhalten, nicht die Entscheidung.

---

*Repo: <https://github.com/andreassigloch/graphcode>. Der Umsetzungs-Benchmark:
[Artikel 01](01-structure-and-llm-needs.md). Konzept & Stack:
[Artikel 03](03-graphcode-harness-goal-and-concept.md).*
