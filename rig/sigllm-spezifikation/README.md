# rig/sigllm-spezifikation — derselbe Input, einmal von Hand geführt, einmal im Auto-Modus

**Die eine Frage:** kommt der Auto-Modus mit *derselben* Projektdefinition auf eine
vergleichbare Spezifikation wie der handgeführte Lauf vom 17./18.09.2026?

Das ist die Stufe, die der Replay nicht liefern kann. `docs/research/fremdlauf-sigllm-2026-09.md`
§18 rechnet die Kennzahlen des Laufs nach und simuliert einzelne Gegenzüge — beides exakt, aber
beides auf **derselben Zugfolge**. Was ein Agent mit anderer Führung *getan* hätte, steht dort
nicht und kann dort nicht stehen. Dafür braucht es einen zweiten Lauf, und der steht hier.

## Aufbau

| | |
|---|---|
| **Input** | `material/docs/project/sig-local-projektdefinition.md` — 245 Zeilen, exakt die Fassung aus sigllms Initialisierungs-Commit `d413707` (2026-09-17 08:40Z), also **vor** dem ersten Graph-Zug (09:06Z). Nicht die heutige, 26 Zeilen längere. |
| **Saat** | ein SYS-Knoten, Wortlaut aus der Definition selbst. Das eine Rahmenstück, das der Mensch setzt — sonst gibt `graph_next_step` auf dem leeren Graphen keine Richtung. Symmetrisch zum Nachbar-Rig. |
| **Golden** | `golden/sigllm-v98.graph.json` — der handgeführte Stand am **Ende der Spezifikationsphase**: 255 Elemente, 506 Traces, v98. Ab v99 legt CR-SL-034 die 22 CR-Knoten an, dort beginnt die Bauphase. Das Golden wird nur zum **Werten** geladen, nie als Material. |
| **Treiber** | `../greenfield-systemtest/run.mjs`, unverändert. Dieses Rig ist ein zweiter **Korpus**, kein zweiter Runner. |
| **Arm** | `opus5` über `claude -p`. Ausdrücklich **kein lokales Modell**: der Vergleichsmaßstab ist der handgeführte Lauf, und der lief auf Opus im Claude-Code-Harness. |

## Lauf

```bash
set -a && source rig/sigllm-spezifikation/lauf.env && set +a
node rig/greenfield-systemtest/run.mjs      # → results-sigllm.json
node rig/greenfield-systemtest/report.mjs
```

Jeder Lauf hinterlässt `../greenfield-systemtest/runs/opus5-<i>/` mit `graph.json`,
`readiness.json`, `audit.jsonl`, `usage.json` und dem rohen `claude-raw.json`.

## Was der Vergleich zeigt — und was nicht

**Zeigt er:** Form (Readiness über acht Dimensionen), Menge und Typmischung, Legalität
(Gate-Ablehnungen aus dem Audit-Log), Kosten und Wall-Zeit. Dazu die Hand-Audit-Liste
`moduleAudit`: welche Module, Use Cases und Akteure der Arm gefunden hat, neben denen des
Goldens. Bewusst **kein** Score auf Namensgleichheit — Paraphrasen erzeugen falsche Nullen.

**Zeigt er nicht:**

- **Ob die Architektur gut ist.** Das bleibt menschliches Urteil. Gemessen wird Form,
  Legalität und Deckung, nicht Zweckmäßigkeit (`docs/konzept/architekturmessung-r6-grenze.md`).
- **Den Kontrollarm aus Leitlinie Satz 7.** Dieser Arm läuft **mit** graphcode. Die Frage
  „besser als frei laufendes Claude Code ohne Harness" ist eine andere und liegt als
  [ITEM-2026-338](../../../bok/items/ITEM-2026-338.json).
- **Eine Aussage mit Streuung.** n = 1 je Arm. Ein großer Unterschied ist damit sichtbar,
  ein kleiner nicht. `RUNS` hochsetzen, wer Streuung braucht.

**Ein Vorbehalt, der ins Ergebnis gehört:** die Projektdefinition trägt bereits eine
Systemzerlegung (SYS-00…05) und sechs Akteure. Der Arm bekommt also einen *strukturierten*
Brief, keinen rohen Prosa-Auftrag. Der handgeführte Lauf hatte denselben Brief — der Vergleich
ist fair —, aber „top-down aus dem Nichts" prüft dieses Rig nicht.

## Stand

Aufgebaut und verdrahtet, **noch nicht ausgeführt**. Der generische Runner ist bis heute nie
end-to-end gelaufen (siehe Nachbar-README): die erste Ausführung bestätigt die Form der
`claude -p`-Usage-JSON und der `graph_export`/`graph_readiness`-Rückgaben. Beides ist defensiv
behandelt, aber ungeprüft. Der erste Lauf ist deshalb ein Plumbing-Test, dessen Zahlen man
erst nimmt, wenn er sauber durchläuft.
