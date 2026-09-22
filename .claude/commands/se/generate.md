---
name: se:generate
version: 2
description: Kaltstart-Generierung eines Systemmodells aus Prosa-Intention — readiness-getriebener Loop über graph_generate, Kandidaten durchs Gate (dryRun-Verdict + Steuerwert), Handoff auf graph_suggest
---

Der generative Treiber für Regime 1: **du schlägst vor, das Gate scort und wählt.** Du erfindest nie die Reihenfolge — `graph_generate` sagt dir bei jedem Schritt, was als Nächstes zu generieren ist.

## Der Loop

1. **Intention klären:** 1 Absatz Prosa vom Nutzer (was soll das System für wen leisten?). Nichts dazuerfinden.
   Was der Auftrag ausdrücklich offen lässt, bleibt offen: Eine offene Entscheidung des Auftraggebers (unbekannter Kanal, offener Zielwert, ungeklaerte Reihenfolge) wird als Annahme ins Modell gelegt — Assumption Review (se-irr), REQ mit offenem Zielwert oder ACTOR mit offenem Kanal — und in der Schlussmeldung genannt. Gefragt wird nur, wenn ein Mensch antworten kann.
2. `graph_generate {intent}` aufrufen → liefert `phase`, `prompt`, `readiness`, `blockingErrors`.
3. **Der `prompt` ist deine Arbeitsanweisung.** Führe genau sie aus:
   - Elementtypen VOR dem Schreiben mit `graph_authoring_guide` prüfen (legale Kanten, Pflichtattribute).
   - **Batches als `formatE`-Block schreiben, nicht als `commands`-JSON** — gleicher Gate-Durchlauf, ~2–3× weniger Tokens. JSON nur für deletes/updates/merges.
   - Hast du MEHRERE Alternativen, reiche sie zuerst mit `graph_mutate {formatE, dryRun:true}` ein und vergleiche die Verdicts. Hast du nur EINEN Batch, reiche ihn direkt ohne dryRun ein: eine Ablehnung persistiert nichts. Rangfolge der Verdicts: `block` verwerfen; dann `steeringDelta` der Fokus-Dimension; dann kein Anstieg blockierender Fehler; dann `tier` (auto-apply > suggest); dann `steerAdvisory.improvement` — entschärft der Zug die schlimmste Stelle? `fitAdvisory` ist nur Bericht und entscheidet ohne Zielprofil nicht (CR-GC-483/587). Jeder Preview wird auditiert (Vorschlag→Verdict) — auch verworfene Kandidaten sind Evidenz.
   - Nur den besten Batch ohne dryRun anwenden. `block` heißt verwerfen oder revidieren — nie erzwingen, nie am Gate vorbei.
4. Zurück zu 2 (ab jetzt ohne `intent` — steckt in der SYS-description), bis `done:true`.
5. **Festgefahren:** Steht derselbe Fokus nach zwei Zuegen noch, stellt die Maschine ihn zurueck und nennt den naechsten (Eintrittspunkte und Steuerregeln nie — Eintrittspunkte loest nur ihr Task oder eine Abnahme). Meldet sie phase stalled, sind nur noch zurueckgestellte Funde offen: nicht weiter mutieren, sondern der Ansage folgen — im Task zurueck in den Kern, bei offenem Eintrittspunkt den Task starten, sonst die Funde und deine Versuche in der Schlussmeldung nennen. stalled ist nicht fertig.
6. **Steuerregeln fertig:** Steuerregeln (RD-04, BW-02, R-04, CR-01, MT-02) sind fertig, wenn sich ihr Ueberschuss ueber drei Steuerzuege im Kreis bewegt oder um weniger als 5 % sinkt: lokales Optimum. Die Maschine nimmt sie dann aus dem Fokus und meldet done mit den verbliebenen Termen — weiter ueber graph_suggest oder den Menschen.
7. **Handoff:** bei `phase:'handoff'` Zielprofil mit dem Nutzer wählen (Gewichte je Metrik-Dimension) und auf `graph_suggest {target}` wechseln — ab hier wird optimiert, nicht mehr generiert.

## Regeln

- **Ein Schritt, ein Fokus:** nur die Funde bearbeiten, die der aktuelle `prompt` nennt — nicht vorgreifen.
- **Anleitung je Schritt:** der Schritt nennt in `skill` die Autorier-Anleitung (`se:author-uc`, `se:author-req`, `se:author-actor`, `se:top-level`) — lade sie über das Skill-Werkzeug, bevor du schreibst; nicht per `cat`, nicht erst am Ende.
- Zerlegungsbreite 7±2 pro Ebene (RD-04); bei Architektur-Schritten 2 Alternativen anbieten, der Steuerwert entscheidet — eine Ebene, die RD-04 erfüllt, schlägt ein besseres Δm.
- `blockingErrors > 0` hat immer Vorrang vor Neu-Generierung.
- **Tasks sind Blackboxen:** FMEA, Bauplan, ConOps, Trade, Annahmen-Review laufen als eigene Einheit mit ihrem Skill (`se-fmea`, `se-plan`, …). Der Loop sieht davon nur den Eintrittspunkt (AF-01..05); die Detailregeln (z. B. S/O/D der FMEA, Meilensteine des Bauplans) setzt der Task, nie dieser Loop. Nennt der Schritt einen Eintrittspunkt, starte den Task mit `graph_generate {task:'fmea'}` (bzw. `plan`, `conops`, …): dieselbe Maschine, sein Regelset als Warnung, `next` bleibt im Task. Er ist erst fertig, wenn sein Artefakt steht (Frischestempel am SYS) und sein Regelset keinen Fund mehr hat; dann kehre mit `graph_generate` ohne `task` in den Kern zurueck.
- **Benannte Abweichung:** Einen Fund, der im Modell nicht erfuellbar ist, legst du als benannte Abweichung ab: `acceptedFindings: [{ruleId, reason}]` am betroffenen Element (graphweite Regeln am SYS), der Grund ist Pflicht. Im Kern abnehmbar sind nur die Eintrittspunkte AF-01, AF-02, AF-03, AF-04, AF-05 (das Artefakt ist im schlanken Umfang nicht noetig); in einem Task: conops CL-01, fmea FM-03, plan MS-01/CR-R01, realisierung R-19/R-20/R-26/R-32. Architekturregeln sind nicht abnehmbar — eine Abnahme daran zaehlt nicht, der Fund bleibt: bauen. Nenne jede Abnahme in der Schlussmeldung.
- Am Ende `graph_export` + Commit — jeder Commit ein Graph-Stand, der zum Code passt.
