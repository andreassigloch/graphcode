# CR-GC-556: `graph_suggest` ab Element 1 — als Injektion, nicht als Modell-Werkzeug

**Status:** 🟢 Done (2026-09-20)
**Typ:** aus Item ITEM-2026-373 (idea)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-373.json (Lane: code)
**Entscheidung:** Auftrag vom 2026-09-20 — „graph_suggest ist ab Element 1 richtig, definitiv
einschalten. Genau wie der Optimizer."

---

## 1. Root Cause

`graph_suggest` war nie abgeschaltet: es steht im `full`-Werkzeugsatz, den der gcrun-Lauf
benutzt hat, und liefert auf dessen Graphen **9 Vorschläge** mit `fixHint` **und `delta`** —
der Optimizer rechnet also längst ab Element 1.

Gerufen wurde es trotzdem null Mal, und der Grund steht im SYSTEM-Prompt:

> Jede Nachricht gibt dir EINE präzise Generierungs-Instruktion. Führe genau sie aus:
> emittiere den geforderten Batch als EINEN graphcode_graph_mutate-Aufruf, **dann STOPP**.
> … **Handeln vor Analysieren:** rufe graph_mutate, rate die Instruktion nicht tot.

Das Emissions-Regime verbietet Analyse-Turns. Ein Werkzeug anzubieten und im selben Prompt
seine Benutzung zu untersagen, ist ein Widerspruch — und das Regime hat recht: es hält kleine
Modelle beim Bauen. Falsch ist nicht das Regime, falsch ist der Kanal.

Nur in der **handoff**-Phase fordert der Rundenprompt `graph_suggest` an. Erreicht wurde sie
nie: die drei Läufe kamen auf 3/8, 2/8 und 1/8 Readiness-Gates.

## 2. Impact

Der gesamte Vorlagen- und Optimizer-Apparat war in drei Läufen wirkungslos — nicht weil er
nichts kann, sondern weil sein Ergebnis keinen Weg zum Modell hat. Gemessen auf dem
gcrun-Graphen: 9 Vorschläge, davon 4 mit ausführbarer Kante (alle vier aus `RD-01`, einer
Vorlage aus dieser Arbeit). Keiner davon ist je beim Modell angekommen.

## 3. Fix

`graph_suggest` wandert auf die **Host-Seite**, genau wie `graph_generate` und
`graph_next_step`: der Executor ruft es deterministisch je Runde und hängt das Ergebnis an den
Rundenprompt. Das Modell bekommt die Empfehlungen als **Inhalt**, nicht als Werkzeug — damit
bleibt das Emissions-Regime unangetastet und es gibt keinen Analyse-Turn.

Damit ist auch der Optimizer an: `delta` ist der ℝ⁶-Zug je Vorschlag und wird mitgeliefert.
Ein Zielprofil (Gewichte) ist davon unabhängig und bleibt offen — es ist eine menschliche
Vorgabe, kein Werkzeugschalter (`se:target-profile`, ITEM-2026-377).

**Anreicherung, keine zweite Liste.** Der Rundenprompt nennt die Fokus-Funde bereits samt
`fixHint` — eine zweite Aufzählung derselben Funde wäre die zweite Wahrheit und würde den
Prompt verdoppeln. Injiziert wird deshalb nur, was dort **fehlt**: die konkrete Kante, die die
Vorlage vorschlägt, und das `delta`. Kein Fund ohne beides kommt in den Block.

### Dateien (4)

| # | Datei |
|---|---|
| 1 | `src/loop/executor-prompt.ts` — `graph_suggest` in `WITHHELD_TOOLS`, Block in `buildRoundInjection` |
| 2 | `src/loop/executor-prompt.ts` (derselbe) — Gate-Protokoll-Satz an die Injektion angeglichen |
| 3 | `tests/executor.suggest-injection.test.ts` — neu, die Abnahme |
| 4 | `docs/cr/open/…` → `done/` |

## 4. Nachweis

- [x] **Rot zuerst:** 4 von 9 Prüfungen rot vor dem Patch. Die fünf grünen sind die
      Negativ-Aussagen („taucht NICHT auf") — die halten trivial, solange es den Block nicht
      gibt, und sind erst nach dem Patch aussagekräftig.
- [x] Die Injektion trägt Kante und `delta` je ausführbarem Vorschlag.
- [x] `graph_suggest` steht in `WITHHELD_TOOLS` und in keinem Werkzeugsatz mehr.
- [x] Kein Duplikat: nur Vorschläge **mit Kante** kommen in den Block, der `fixHint` bleibt
      allein im Rundenprompt.
- [x] `npm test` grün.

**Zwei Fehler, die erst die Messung am echten Laufgraphen gezeigt hat** — beide sind jetzt
eigene Prüfungen:

1. **`k` muss an die Schema-Obergrenze.** `inputSchema.parse({})` setzt `k: 5` — ein Top-k für
   einen menschlichen Leser. Auf dem gcrun-Graphen liefert `k=5` **null** Vorschläge mit
   Kante, `k=20` den einen, den es gibt. Der Block hätte genau das Anwendbare weggeschnitten.
2. **Der Zuschnitt muss die Kante einbeziehen, nicht nur den Fund.** Der reale Vorschlag ist
   `RD-01 @ REQ-data-security` mit der Kante `FCHAIN -satisfy-> REQ`, bei Fokus
   ACTOR/UC/FCHAIN/FUNC. Ein Filter auf den Fund allein hätte ihn verworfen.

**Was der Block heute trägt** (gcrun-Graph, 49 Elemente):

```
- RD-01 @ REQ-data-security: FCHAIN-interactive-session -satisfy-> REQ-data-security · delta [0.000 …]
```

Ein Zug. Das ist wenig, aber es ist der erste, der das Modell je erreicht — und `delta` steht
dabei, der Optimizer ist damit ab Element 1 sichtbar. Dass dieses `delta` null ist, ist ein
ehrliches Ergebnis: der Zug verbessert die ℝ⁶-Lage nicht, er schließt einen Regel-Fund.
