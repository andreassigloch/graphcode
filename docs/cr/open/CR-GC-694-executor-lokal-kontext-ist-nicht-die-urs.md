# CR-GC-694: Saettigungsstopp aus dem Ertrag statt aus der Rundenzahl

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-572 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-572.json (Lane: code)

---

Rig 2026-09-25, qwen3-coder-30b (4 bit, Ollama), 200 Runden (runs/gcrun-180), Prompt-Tokens je Aufruf aus dem Ollama-server.log den 649 Modellzuegen zugeordnet. (1) KONTEXT: erster Prompt je Runde 2,8k -> 3,8k Token, Maximum je Runde 8-14k, Spitze 23k — bei 256k Fenster. Neue Knoten je Runde nach Kontextband flach (1,3-1,9 von <6k bis >=16k); was mit dem Kontext steigt, sind Ablehnungen (0,27 -> 5,05) — Folge, nicht Ursache: Gate-Rueckmeldungen verlaengern die Runde. Der Rueckgang ueber die Runden (neue Knoten 3,4 -> 0,5 je Runde, Doppel-Kanten steigen) ist Saettigung, kein Kontexteffekt. 4-bit-Einfluss auf Urteilsqualitaet damit NICHT ausgeschlossen, nur der Kontext-Mechanismus — Pruefung braeuchte ein q8-Modell. (2) HAUPTLAST: 166 Preflight-Blocks, davon 107 satisfy-Kanten, deren Legalitaet an REQ.kinds haengt (FUNC->non-functional-REQ, MOD/SYS->functional-REQ, REQ ohne kinds), dazu 51 umgedrehte Richtung (REQ satisfy MOD/TEST/REQ). Von den 107: 54 REQs standen schon vor der Runde im Graphen — das Inventar zeigt uid · TYPE · name OHNE kinds, das Modell sieht die Eigenschaft nicht, an der die Legalitaet haengt. Vorschlag: kinds in die Inventarzeile fuer REQ. (3) BEISPIEL-LECK: das Format-E-Vorbild im Executor-SYSTEM (REQ-login-passwort, CR-GC-657) wird bei Saettigung inhaltlich uebernommen — 21 Knoten bis UC-login im 200-Runden-Lauf, 2 im 40-Runden-Lauf, 5 in gcrun-152; der Auftrag sagt das Gegenteil (ohne Anmeldung). Opus/qwen3.8 nicht betroffen. Vorbild aus auftragsfremder Domaene oder erkennbare Platzhalter. (4) STOPP: done kommt in expand nicht (jeder Zuwachs erzeugt neue Funde); 40 schneidet Opus produktiv ab, 200 laesst den Coder ab ~Runde 80 Dubletten und Varianten (-2, -3, -5-neu) schreiben. Vorschlag: Saettigungsstopp aus dem Ertrag (neue Knoten je Runde ueber ein Fenster), nicht aus einer Rundenzahl. (5) Frage Auftraggeber: drei Durchgaenge mit getrennten Aufgaben (Breite UC+REQ mit kinds / Realisierung je UC entlang des Graphen / Verifikation) statt einer gemischten Schleife — die Befunde (2) sprechen fuer die Trennung, weil die Hauptlast genau die Mischung REQ-schreiben + Realisierer-anhaengen ist. NACHTRAG kinds-Analyse (gleicher Tag): (a) Das Modell waehlt den Erfueller nach dem THEMA der REQ (FUNC-ergebnis fuer "Ergebnis in unter 10 s speichern"), die kinds nach der EIGENSCHAFT — daher FUNC->non-functional (29), MOD/SYS->functional (32), ohne kinds (46). (b) preflight.kindsBefund schlaegt als ERSTE Reparatur vor, die kinds der REQ auf allowed[0] zu setzen — lehrt Einstufung-nach-Kante (Umkippen beobachtet: REQ-anmeldung-sperre non-functional); Partner nur als Typ, nie als uid. (c) Vorbilder mischen: REQ-login-passwort "per Passwort in unter 2 s" als functional (SYSTEM + UC-01-Klausel generate.ts:213), TEST misst p95. (d) Anleitung projections/authoring-example.ts: kinds-Text nennt risk/mitigation nicht beim Erfueller, kein Wort zu gemischten kinds (every -> nur FCHAIN). contracts: FCHAIN-satisfy-Beschreibung "end-to-end NFR" verschweigt, dass die FCHAIN JEDE REQ erfuellen darf; BQ-02 verlangt an JEDER REQ ein Messkriterium und draengt funktionale REQs zur Zahl — Familie-Thema. (e) Endstand-Messung: Opus 17/90 REQs mit mehreren kinds, qwen3.8 fast keine satisfy-Kanten (1 in gcrun-130). VORSCHLAG in drei messbaren Stufen: A Vorbilder atomar + auftragsfremd, fixHint Partner-zuerst mit konkreter uid (FCHAIN der FUNC ueber compose), kinds in der Inventarzeile, Anleitungstext; B RD-01 mit vorberechneten legalen Kandidaten je REQ entlang des Graphen (functional -> FUNCs der Kette des besitzenden UC, sonst die Kette selbst); C Redaktionsdurchgang nach jedem REQ-Batch: nur ~-Patches (eine Aussage je REQ, Verhalten oder Guete, Mischung in zwei REQs teilen).

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

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

- [ ] Rot zuerst: Loop-Test mit einem Modell, das ab Runde k nur noch Dubletten liefert — laeuft heute bis maxRounds.
- [ ] Stopp nach Fenster, Grund `saettigung` im Lauf-Ergebnis und in der Trace.
- [ ] Default aus gcrun-180 hergeleitet und im CR begruendet; keine Wirkung auf Laeufe mit Ertrag.
- [ ] VOLL-Spur gruen.
