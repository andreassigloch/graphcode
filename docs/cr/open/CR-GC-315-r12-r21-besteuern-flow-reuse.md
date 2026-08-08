# CR-GC-315 — R-12 und R-21 besteuern FLOW-Reuse: die einzige Art, sie stillzukriegen, ist Duplizieren

**Status:** open · **Angelegt:** 2026-08-08 · **Max Files:** 5
**Herkunft:** CR-Arbeit 2026-08-08. Ein Agent meldete „dryRun grün, aber zwei vermeidbare
Warnungen (R-12, R-21) — die entstehen nur, weil ich geteilte FLOWs wiederverwende. Ich
schneide zwei eigene." Genau der Trade, den das Modell nie erzwingen darf.
**Repo-Grenze:** Der Fix liegt in **`@sigloch/contracts/se`** (sigloch-modules), nicht in
graphcode. graphcode ist Konsument über den gepinnten Registry-Range.

## Problem

Beide Warnungen sind Artefakte derselben Modellierungstatsache: eine geteilte FLOW ist ein
Hub, und beide Regeln behandeln FLOW-Nachbarschaft, als wäre sie direkte FUNC→FUNC-Kopplung.
Wer wiederverwendet, sammelt Warnungen; wer dupliziert, ist sauber. Die Regeln belohnen die
schlechtere Architektur.

### R-12 — auf `io` strukturell ein reines False-Positive

`noDirectCircular` ist kein Zyklen-Detektor, sondern ein *direkter 2-Zyklus*-Test über
gleichtypige Kantenpaare. Auf `io` kann er genau eine Form treffen:

```
FUNC-a ─io→ FLOW-x ─io→ FUNC-a
```

Also Read-Modify-Write auf einer geteilten FLOW — das Reuse-Muster, keine Abhängigkeits-
Zirkularität. Echte io-Zyklen laufen über ≥2 FUNCs und sind einem 2-Zyklus-Test grundsätzlich
unsichtbar. Auf `io` findet die Regel damit nichts Echtes und bestraft nur Wiederverwendung.

Nebenbefund: der Dedup-Filter am Ende von `noDirectCircular` schlüsselt auf `v.message`. Die
beiden Richtungen erzeugen unterschiedliche Messages (`… between A and B` vs. `… between B and
A`), also kollabierte er nie etwas — **jeder Zyklus wurde doppelt gemeldet.** Toter Code seit
Einführung.

### R-21 — quadratische Strafe auf Reuse

`fchainMustHaveIntegrationTest` bildet die FUNC→FUNC-„connections" als **kartesisches Produkt**
producers × consumers pro FLOW:

```ts
for (const p of producers) for (const c of consumers) if (p !== c) connections.push([p, c]);
```

Eine FLOW mit P Produzenten und C Konsumenten erzeugt P·C Verbindungen. Jede verlangt eine
eigene FCHAIN plus Integrationstest — auch Paare, die nie miteinander reden. Ein Hub mit 3
Produzenten und 3 Konsumenten produziert 9 Findings aus null modellierten Ketten.

## Entscheidung (2026-08-08)

R-12 **einschränken**, R-21 **reduzieren** — beide behalten. Kein neues Attribut: ein
`shared: true`-Flag auf der FLOW wurde erwogen und verworfen, weil es den Modellierer zwingt,
eine Regelschwäche im Datenmodell zu deklarieren.

R-21 wurde ausdrücklich und ausschließlich für die fehlende Integrationstest-Abdeckung gebaut
(CR-GC-240 hatte „Integration" auf die UC-Ebene gefaltet und FUNC↔FUNC-Verdrahtung unverifiziert
gelassen). Diese Intention bleibt unangetastet — nur die Herleitung der zu prüfenden Kanten
ändert sich.

## Umsetzung

1. **R-12** auf abhängigkeitstragende Trace-Typen einschränken: `compose`, `allocate`,
   `relation`. `io` fällt raus. `satisfy`/`verify`/`produces`-2-Zyklen sind pattern-illegal und
   gehören zu R-18.
2. **R-12-Dedup** richtungsunabhängig schlüsseln (`type|sortiertes Paar`) — ein Zyklus, ein
   Finding.
3. **R-21**: Paare ohne gemeinsame FCHAIN sind stumm (`if (shared.length === 0) continue;`).
   Die FCHAIN ist die deklarierte Integrations-Scope; der Test wird auf die deklarierte
   Behauptung geschuldet, nicht auf zufällige Ko-Adjazenz an einer FLOW.
4. `RULES_VERSION` → `2.24.0`.

**Bewusster Preis von (3):** Ein Produzent/Konsument-Paar, das in **keiner** FCHAIN steht, wird
nicht mehr gemeldet. Das ist heute die laute und gleichzeitig die nutzlose Variante — sie
behauptet eine Schnittstelle, die niemand modelliert hat.

## Betroffene Dateien

| Datei | Repo | Änderung |
|---|---|---|
| `src/se/rules.ts` | contracts | R-12 Typ-Whitelist + Dedup-Key, R-21 FCHAIN-Voraussetzung |
| `src/se/index.ts` | contracts | `RULES_VERSION` 2.23.0 → 2.24.0 |
| `tests/unit/se-rules-r12.test.ts` | contracts | neu — 5 Fälle |
| `tests/unit/se-rules-r21.test.ts` | contracts | 2 Fälle invertiert, 2 Reuse-Fälle ergänzt |

## Akzeptanzkriterien

- [x] Read-Modify-Write auf geteilter FLOW → keine R-12-Violation
- [x] `compose`- und `relation`-2-Zyklus → weiterhin je **eine** R-12-Violation (nicht zwei)
- [x] Hub-FLOW 3×3 ohne FCHAIN → 0 statt 9 R-21-Violations
- [x] Deklarierte FCHAIN ohne verifizierte REQ → weiterhin R-21-Violation, verankert auf der FCHAIN
- [x] Unit-Test auf einer FUNC deckt die Verbindung weiterhin **nicht** ab
- [x] `npm run build` + volle Suite in contracts grün (193/193)
- [ ] contracts publiziert; graphcode-Range gezogen, Suite grün, Warnungen am realen Graphen weg

## Offen

Der letzte Punkt braucht einen contracts-Publish (Familie zieht die Version, s.
`sigloch-family-filedep-rollout`). Bis dahin sieht graphcode die alten Regeln.
