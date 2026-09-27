# CR-GC-694: Saettigungsstopp aus dem Ertrag statt aus der Rundenzahl

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-572 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-572.json (Lane: code)

---

Rig 2026-09-25, qwen3-coder-30b (4 bit, Ollama), 200 Runden (runs/gcrun-180), Prompt-Tokens je Aufruf aus dem Ollama-server.log den 649 Modellzuegen zugeordnet. (1) KONTEXT: erster Prompt je Runde 2,8k -> 3,8k Token, Maximum je Runde 8-14k, Spitze 23k — bei 256k Fenster. Neue Knoten je Runde nach Kontextband flach (1,3-1,9 von <6k bis >=16k); was mit dem Kontext steigt, sind Ablehnungen (0,27 -> 5,05) — Folge, nicht Ursache: Gate-Rueckmeldungen verlaengern die Runde. Der Rueckgang ueber die Runden (neue Knoten 3,4 -> 0,5 je Runde, Doppel-Kanten steigen) ist Saettigung, kein Kontexteffekt. 4-bit-Einfluss auf Urteilsqualitaet damit NICHT ausgeschlossen, nur der Kontext-Mechanismus — Pruefung braeuchte ein q8-Modell. (2) HAUPTLAST: 166 Preflight-Blocks, davon 107 satisfy-Kanten, deren Legalitaet an REQ.kinds haengt (FUNC->non-functional-REQ, MOD/SYS->functional-REQ, REQ ohne kinds), dazu 51 umgedrehte Richtung (REQ satisfy MOD/TEST/REQ). Von den 107: 54 REQs standen schon vor der Runde im Graphen — das Inventar zeigt uid · TYPE · name OHNE kinds, das Modell sieht die Eigenschaft nicht, an der die Legalitaet haengt. Vorschlag: kinds in die Inventarzeile fuer REQ. (3) BEISPIEL-LECK: das Format-E-Vorbild im Executor-SYSTEM (REQ-login-passwort, CR-GC-657) wird bei Saettigung inhaltlich uebernommen — 21 Knoten bis UC-login im 200-Runden-Lauf, 2 im 40-Runden-Lauf, 5 in gcrun-152; der Auftrag sagt das Gegenteil (ohne Anmeldung). Opus/qwen3.8 nicht betroffen. Vorbild aus auftragsfremder Domaene oder erkennbare Platzhalter. (4) STOPP: done kommt in expand nicht (jeder Zuwachs erzeugt neue Funde); 40 schneidet Opus produktiv ab, 200 laesst den Coder ab ~Runde 80 Dubletten und Varianten (-2, -3, -5-neu) schreiben. Vorschlag: Saettigungsstopp aus dem Ertrag (neue Knoten je Runde ueber ein Fenster), nicht aus einer Rundenzahl. (5) Frage Auftraggeber: drei Durchgaenge mit getrennten Aufgaben (Breite UC+REQ mit kinds / Realisierung je UC entlang des Graphen / Verifikation) statt einer gemischten Schleife — die Befunde (2) sprechen fuer die Trennung, weil die Hauptlast genau die Mischung REQ-schreiben + Realisierer-anhaengen ist. NACHTRAG kinds-Analyse (gleicher Tag): (a) Das Modell waehlt den Erfueller nach dem THEMA der REQ (FUNC-ergebnis fuer "Ergebnis in unter 10 s speichern"), die kinds nach der EIGENSCHAFT — daher FUNC->non-functional (29), MOD/SYS->functional (32), ohne kinds (46). (b) preflight.kindsBefund schlaegt als ERSTE Reparatur vor, die kinds der REQ auf allowed[0] zu setzen — lehrt Einstufung-nach-Kante (Umkippen beobachtet: REQ-anmeldung-sperre non-functional); Partner nur als Typ, nie als uid. (c) Vorbilder mischen: REQ-login-passwort "per Passwort in unter 2 s" als functional (SYSTEM + UC-01-Klausel generate.ts:213), TEST misst p95. (d) Anleitung projections/authoring-example.ts: kinds-Text nennt risk/mitigation nicht beim Erfueller, kein Wort zu gemischten kinds (every -> nur FCHAIN). contracts: FCHAIN-satisfy-Beschreibung "end-to-end NFR" verschweigt, dass die FCHAIN JEDE REQ erfuellen darf; BQ-02 verlangt an JEDER REQ ein Messkriterium und draengt funktionale REQs zur Zahl — Familie-Thema. (e) Endstand-Messung: Opus 17/90 REQs mit mehreren kinds, qwen3.8 fast keine satisfy-Kanten (1 in gcrun-130). VORSCHLAG in drei messbaren Stufen: A Vorbilder atomar + auftragsfremd, fixHint Partner-zuerst mit konkreter uid (FCHAIN der FUNC ueber compose), kinds in der Inventarzeile, Anleitungstext; B RD-01 mit vorberechneten legalen Kandidaten je REQ entlang des Graphen (functional -> FUNCs der Kette des besitzenden UC, sonst die Kette selbst); C Redaktionsdurchgang nach jedem REQ-Batch: nur ~-Patches (eine Aussage je REQ, Verhalten oder Guete, Mischung in zwei REQs teilen).

---

## Umfang — 5 Dateien

| Datei | Aenderung |
|---|---|
| `src/loop/executor.ts` | `saturationWindow`/`saturationMinNodes` in `ExecutorConfigSchema`; Ertrag je Runde = Zuwachs der Knotenzahl im Store (`graph_elements.total`), gemessen vor jeder Runde; Stopp mit Spurzeile `[saettigung] …`; `ExecutorStats.stopReason` (`handoff`/`stalled`/`saettigung`/`maxRounds`) |
| `src/surface/run-verb.ts` | `GRAPHCODE_LLM_SATURATION_WINDOW`, `GRAPHCODE_LLM_SATURATION_MIN_NODES` |
| `README.md` | `run`-Zeile nennt die Stoppgruende |
| `tests/executor.saturation.test.ts` (neu) | echter Loop, echter Store: kein Zuwachs → Stopp; Zuwachs je Runde → keine Wirkung; Default + Env |
| diese Datei | |

## Schnitt (2026-09-27)

Dieser CR nimmt nur Punkt **(4) STOPP** des Befunds oben. Die uebrigen Teile sind verteilt:
- (2) kinds-Hauptlast, kinds in der Inventarzeile, fixHint Partner-zuerst, (3) Beispiel-Leck
  `REQ-login-passwort` im Executor-Vorbild → **CR-GC-672** (dieselben Dateien: preflight.ts,
  executor-prompt.ts, executor-inventory.ts, generate.ts).
- (1) Kontext: Befund, kein Auftrag. (5) drei getrennte Durchgaenge: Frage an den Auftraggeber, offen.

## Zielbild

Der Executor stoppt, wenn der Ertrag versiegt: neue Knoten je Runde ueber ein gleitendes Fenster
(z. B. 3 Runden) unter einer Schwelle, und nicht erst an `maxRounds`. Die Rundenzahl bleibt als
Obergrenze. Schwelle und Fenster als Konfiguration mit gemessenem Default (gcrun-180: neue Knoten
3,4 → 0,5 je Runde, ab ~Runde 80 Dubletten und Varianten `-2`, `-3`, `-5-neu`).

## Akzeptanz

- [x] Rot zuerst: Loop-Test mit einem Modell, das nur noch bestehende Knoten aendert — lief bis maxRounds (10 statt 3 Runden).
- [x] Stopp nach Fenster, Grund `saettigung` im Lauf-Ergebnis (`stats.stopReason`) und in der Trace.
- [x] Default aus gcrun-180 hergeleitet und im CR begruendet (unten); keine Wirkung auf Laeufe mit Ertrag (Test), und keine auf S2 (12 Runden < Fenster 20).
- [x] VOLL-Spur gruen: 185/186 Dateien, 1632 Tests; rot nur `tests/rig-measured.test.ts` (vorbestehend, unabhaengig).

## Herleitung des Defaults (gcrun-180)

Quelle: `rig/greenfield-systemtest/runs/gcrun-180` (Hauptbaum), `audit.jsonl` (166 Applies) und
`run-raw.log` (200 Runden). Neue Knoten je Runde = `add-node`-uids, die vorher nicht im Graphen
standen, den Runden ueber die Spur zugeordnet (157 von 164 Runden-Applies eindeutig — die
Zuordnung ist ±7 Applies unscharf).

| gleitendes Fenster | kleinste Summe in Runde ≤ 180 | Rest ab Runde ~185 |
|---|--:|--:|
| 20 Runden | 13 (Runden 11–30: Fehlschlaege, R-18-Ablehnungen, bestehende Knoten erneut gesendet) | 5–12 |
| 25 Runden | 20 | 12–15 |

Kleine Fenster (5–12 Runden) stoppen gcrun-180 schon in Runde 15–22 — mitten in der Aufbauphase,
die danach noch ~120 Knoten brachte. Default deshalb **20 Runden, < 10 neue Knoten** (= 0,5 je
Runde, der gemessene Endstand): gcrun-180 haette um Runde ~187–191 gestoppt, jeder Lauf mit ≤ 20
Runden (S2: 12) bleibt unberuehrt.

## Ergebnis

Der Mechanismus steht: der Lauf endet, wenn der Store ueber ein Fenster keinen Zuwachs mehr zeigt,
mit Grund `saettigung` in Stats und Spur. **Auf gcrun-180 spart der Default nur ~10 von 200
Runden, nicht die ~120 ab Runde 80.** Grund: die Saettigung ab Runde ~80 ist in der Knotenzahl
nicht sichtbar — Varianten (`-2`, `-3`, `-5-neu`, kombinatorische Verlaengerungen wie
`FUNC-zeitstempel-ueberpruefen-nach-nachtlauf-ohne-netz-ohne-anmeldung`) sind neue uids und zaehlen
als Ertrag. Ein Stopp um Runde 80 braucht ein Ertragsmass ohne Varianten (z. B. Aehnlichkeit gegen
den Bestand, wie der Preflight-Hinweis „ähnlich vorhanden") — eigener Befund, nicht dieser CR.
