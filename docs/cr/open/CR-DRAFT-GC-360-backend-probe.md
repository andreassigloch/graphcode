# CR-GC-360 — `graphcode probe`: das Backend messen, bevor Stunden verbrannt werden

**Status:** draft — zurückgestuft 2026-08-21: nicht gebaut, `graphcode probe` existiert nicht (kein `probe`-Zweig im CLI-Switch). Hängt ohnehin an CR-GC-359.
**Datum:** 2026-08-18
**Vorgänger:** CR-GC-359 (der Deckel muss weg, sonst misst die Probe ihn statt des Modells)

**Namensklärung:** NICHT „preflight" — der Begriff ist in `src/preflight.ts` vergeben
(Batch-Hygiene vor dem Apply-Gate, CR-GC-284). Zwei Dinge gleichen Namens wären genau die
Verwechslung, die dieses Repo sonst vermeidet.

## Anlass (echte Kosten, gemessen)

Session 2026-08-16/17, Ziel „qwen3.8 durchtesten": **zwei Läufe, ~80 Minuten, null
verwertbare Messwerte**. Beide scheiterten an Eigenschaften der Kombination
Modell × Box × Transport, die VOR dem Lauf in Minuten feststellbar gewesen wären:

| Lauf | Kosten | Ursache | in Minuten feststellbar? |
|---|---|---|---|
| v1 (`graphcode run`) | 40 min, 1 von 33 Calls | Denk-Länge × 14,8 tok/s > 180 s Timeout | ja — ein Call mit Tool-Schema, Reasoning-Token zählen |
| v2 (`graphcode run`) | 26 min, 8 Elemente | undici-Deckel bei 300 s (CR-GC-359) | ja — ein Call jenseits 300 s |
| Greenfield-Arm (`claude -p`) | 40 min, 0 Elemente | ~350 s Prefill je Cache-Miss-Turn | ja — ein Turn mit realistischer Prompt-Größe |

Eine handgeschriebene Sampling-Matrix im Scratchpad hat alle drei Ursachen in ~2 Minuten
gezeigt. Dieses Wissen gehört neben den Run-Verb, nicht in ein weggeworfenes Skript.

## Ziel

`graphcode probe` misst die Kombination **Modell × Endpoint × Config** und meldet, ob ein
Lauf sinnvoll ist — bevor er startet. Kein Urteil über Modellqualität, nur über
Betreibbarkeit.

## Messgrößen (je eine Aussage, keine gestapelten Zahlen)

1. **Decode-Rate** (tok/s) — aus einem Call mit realistischem Tool-Schema.
2. **Denk-Anteil** — `reasoning_tokens` / `completion_tokens`; deckt Reasoning-Modelle auf,
   deren Budget die Wall-Zeit bestimmt.
3. **Prefill-Zeit** bei realistischer Prompt-Größe — der Posten, der den Frontier-Harness
   lokal unbrauchbar machte (~350 s/Turn) und in keiner Token-Statistik auftaucht.
4. **Tool-Call-Integrität** — kommt ein schema-valider Batch zurück? (Der `no-think`-Test
   lieferte `commands` als String statt Array: schnell **und** unbrauchbar.)
5. **Wirksame Call-Obergrenze** — ab wann bricht die Kette ab, und mit welchem `cause`.
6. **Wird `reasoning_effort` honoriert?** — die Antwort ist modell- und
   server-versionsabhängig; der LM-Studio-Bugtracker sagt „nein", gemessen war es „ja".

## Abgeleitete Empfehlung (der eigentliche Nutzen)

Aus 1–6 rechnet die Probe aus, was der Mensch sonst rät:
`maxTokens` (Budget ÷ Rate), `callTimeoutMs` (Budget + Prefill-Reserve) und eine
**Wall-Zeit-Schätzung für N Runden × M Kandidaten**. Ist die Schätzung jenseits einer
angegebenen Schranke, sagt die Probe das — statt dass es nach 40 Minuten auffällt.

## Verbindliche Bauvorgabe

Die Probe fährt **`buildCallModel`**, nicht einen eigenen HTTP-Client. Sonst misst sie
einen Pfad, den der Lauf nie benutzt — und wir hätten genau den Parallelpfad gebaut, den
dieses Repo verbietet. Der undici-Deckel aus CR-GC-359 ist das Musterbeispiel: ein
eigener Client hätte ihn nie gezeigt.

## Dateien (≤ 4)

- `src/probe-verb.ts` (neu) — Messung + Ableitung, testbar geschnitten wie `run-verb.ts`
- `src/cli.ts` — `case 'probe'`
- `tests/cli.probe.test.ts` (neu) — gescriptetes Backend, feste Zeiten
- `docs/RECOMMENDATIONS.md` — kurzer Verweis

## Akzeptanzkriterien

- [ ] `graphcode probe` meldet alle 6 Messgrößen + die abgeleiteten Empfehlungen
- [ ] Läuft über `buildCallModel` (Test weist nach, dass der Produktionspfad benutzt wird)
- [ ] Erkennt einen defekten Tool-Call (Argumente kein Objekt) als **Fehler**, nicht als
      schnellen Erfolg — Test mit genau der `commands`-als-String-Antwort aus dem echten
      no-think-Befund
- [ ] Läuft in < 3 min gegen ein lokales Modell
- [ ] Danach: qwen3.8-Verifikationslauf mit den empfohlenen Werten; Zeile in
      `rig/greenfield-systemtest/results/README.md` — der aus CR-GC-358 übernommene Punkt
