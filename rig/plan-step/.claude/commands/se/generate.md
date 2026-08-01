---
name: se:generate
version: 2
description: Kaltstart-Generierung eines Systemmodells aus Prosa-Intention — readiness-getriebener Loop über graph_generate, Kandidaten durchs Gate (dryRun-Verdict + fitAdvisory), Handoff auf graph_suggest
---

Der generative Treiber für Regime 1: **du schlägst vor, das Gate scort und wählt.** Du erfindest nie die Reihenfolge — `graph_generate` sagt dir bei jedem Schritt, was als Nächstes zu generieren ist.

## Der Loop

1. **Intention klären:** 1 Absatz Prosa vom Nutzer (was soll das System für wen leisten?). Nichts dazuerfinden.
2. `graph_generate {intent}` aufrufen → liefert `phase`, `prompt`, `readiness`, `blockingErrors`.
3. **Der `prompt` ist deine Arbeitsanweisung.** Führe genau sie aus:
   - Elementtypen VOR dem Schreiben mit `graph_authoring_guide` prüfen (legale Kanten, Pflichtattribute).
   - **Batches als `formatE`-Block schreiben, nicht als `commands`-JSON** — gleicher Gate-Durchlauf, ~2–3× weniger Tokens. JSON nur für deletes/updates/merges.
   - Alternativen als `graph_mutate {formatE, dryRun:true}` einreichen; Verdicts vergleichen — `tier` (auto-apply > suggest > block) und `fitAdvisory` (Δm auf layer:arch, `regressions`). Jeder Preview wird auditiert (Vorschlag→Verdict) — auch verworfene Kandidaten sind Evidenz.
   - Nur den besten Batch ohne dryRun anwenden. `block` heißt verwerfen oder revidieren — nie erzwingen, nie am Gate vorbei.
4. Zurück zu 2 (ab jetzt ohne `intent` — steckt in der SYS-description), bis `done:true`.
5. **Handoff:** bei `phase:'handoff'` Zielprofil mit dem Nutzer wählen (Gewichte je Metrik-Dimension) und auf `graph_suggest {target}` wechseln — ab hier wird optimiert, nicht mehr generiert.

## Regeln

- **Ein Schritt, ein Fokus:** nur die Funde bearbeiten, die der aktuelle `prompt` nennt — nicht vorgreifen.
- UC-Stil aus `se:author-uc` (Actor–Verb–Objekt–Ergebnis, ≤25 Wörter), REQs aus `se:author-req`.
- Zerlegungsbreite 7±2 pro Ebene (RD-04); bei Architektur-Schritten 2 Alternativen anbieten, Δm-Vergleich entscheidet.
- `blockingErrors > 0` hat immer Vorrang vor Neu-Generierung.
- Am Ende `graph_export` + Commit — jeder Commit ein Graph-Stand, der zum Code passt.
