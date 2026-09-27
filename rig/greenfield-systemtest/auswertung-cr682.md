# Auswertung CR-GC-682: Inventar-Zuschnitt, Blindurteil über die Spec

Stand 2026-09-27. Neun Läufe qwen3-coder-30b über das sigllm-Gateway, Korpus `sigllm-gcrun`
(Prosa-Auftrag, Saat `SYS-sig-local`), 40 Runden, je 3 Läufe pro Zuschnitt: `fund` (Befund-Kontext,
heute), `index` (alle Knoten als `uid · type · name`), `faltung` (Compose-Faltung + nackte uids).

## Ergebnis

**Der Zuschnitt ändert die Qualität der Spec nicht messbar — alle neun Specs sind unbrauchbar.**
Kein einziger der 28 Auftragspunkte ist in irgendeiner Spec voll abgedeckt. Die Mengenvorteile von
`index` (mehr Elemente, weniger Ablehnungen, weniger Lese-Aufrufe) sind kein Qualitätsvorteil: der
Rekordlauf `gcrun-310` (193 Elemente) hat 35 Dubletten unter 49 REQ.

| Zuschnitt | Läufe | ~ von 28 (✓ = 0 überall) | O-Punkte offen geführt | erfundene Werte | Dubletten | Notensumme (5–25) |
|---|---|---|---|---|---|---|
| fund | 300 · 301 · 302 | 8 · 8 · 9 | 1 · 0 · 0 | 6 · 14 · 7 | 32 · 16 · 17 | 6 · 7 · 7 |
| index | 310 · 311 · 312 | 4 · 9 · 8 | 0 · 0 · 0 | 9 · 13 · 13 | 35 · 10 · 18 | 5 · 5 · 5 |
| faltung | 320 · 321 · 322 | 6 · 6 · 3 | 0 · 0 · 0 | 8 · 12 · 10 | 9 · 8 · 12 | 5 · 7 · 7 |

Notensumme = Treue + Dubletten + REQ + Tests + Struktur, je 1–5. Der Boden liegt bei 5.

## Was die Specs gemeinsam haben

Aus den neun Gutachten, in jeder Spec genannt:

- **Login statt Auftrag.** Jede Spec baut ein Passwort-Login mit Sitzungen, oft mit Kontosperre
  („5 Fehlversuche / 15 min“). Der Auftrag kennt kein Login; er verlangt widerrufbare Zugänge je
  Nutzer und Gerät und einen Neustart **ohne** Anmeldung. Herkunft: die Vorbilder im Executor-Prompt
  (`src/loop/executor-prompt.ts:46–72`) — siehe deterministische Prüfung unten.
- **Beide Abnahmefälle fehlen oder sind verdreht** (Arbeitstagebuch, Erreichbarkeitsprüfung).
- **Offene Punkte werden erfunden:** O3 (Antwortbeginn) bekommt 2 s oder 5 s. Das einzige „Zielwert
  offen“ steht meist an `REQ-login-dauer` — dem Vorbild aus CR-GC-667, also an der falschen Größe.
- **Erfüller ohne Inhalt:** Wirkketten aus einer einzigen „nimmt die Anfrage entgegen“-FUNC, die
  fast jede REQ erfüllen soll; viele REQ ohne Erfüller; Module fehlen meist ganz.

## Deterministische Prüfungen (ohne Urteil)

| Lauf | REQ | Login/Passwort-REQ | REQ ohne kinds | kinds-falscher Erfüller | namensgleiche REQ | REQ ohne Erfüller |
|---|---|---|---|---|---|---|
| fund 300 · 301 · 302 | 23 · 31 · 21 | 2 · 3 · 2 | 0 | 0 | 0 · 8 · 0 | 12 · 7 · 0 |
| index 310 · 311 · 312 | 49 · 28 · 31 | 5 · 3 · 6 | 0 | 0 | 30 · 6 · 7 | 0 · 0 · 13 |
| faltung 320 · 321 · 322 | 19 · 22 · 24 | 5 · 4 · 4 | 0 | 0 | 4 · 0 · 2 | 0 · 7 · 6 |

- **Leck aus dem Prompt-Vorbild in 9 von 9 Läufen.** `REQ-login-dauer` (Vorbild seit CR-GC-667)
  steht in 6 von 9 Läufen wörtlich. ITEM-2026-607.
- **kinds und Erfüller-Typ stimmen überall** — das hält der Preflight. Das Problem sitzt im Inhalt,
  nicht in der Form.

## Prüfung der Gutachter

Vier Befunde stichprobenartig am Graphen nachgesehen, alle bestätigt:
`REQ-throughput-latency` „innerhalb von 5 Sekunden“ (`gcrun-301`); `REQ-nachtlauf-aufgaben-erfolg`
„mindestens einmal pro Planung“ gegen „nie zweimal“ (`gcrun-312`), dort fünf REQ mit „5 s“; dreimal
wortgleich „per Passwort in unter 2 s“ (`gcrun-310`); das einzige ✓ bei O3 (`gcrun-300`) steht zu
Recht — `REQ-interaktive-session` führt den Zielwert offen.

**Methodenfehler, korrigiert:** die erste Gutachterrunde lief auf Specs, die alle REQ als „ohne kinds“
zeigten — der Renderer las `kinds` unter `attributes`, der Export trägt es am Element. Die Runde wurde
verworfen und auf korrigierten Specs wiederholt; nur diese zweite Runde steht oben.

## Folgerung

1. **Den Default nicht nach diesem Lauf umstellen.** `index` ist billiger (weniger Lese-Aufrufe), aber
   nicht besser; die Mehr-Elemente sind Dubletten.
2. **Der Engpass ist nicht der Kontext, sondern der Inhalt:** das kleine Modell übernimmt den Inhalt der
   Vorbilder, erfindet Werte und verdrängt den Auftrag. Das deckt sich mit Runde 20 (qwen3-coder:
   „unbrauchbar“) und mit dem Befund aus `test_local`: für die Spezifikation taugt qwen3.8, nicht der Coder.
3. **Nächster Hebel:** ITEM-2026-607 (Vorbild-Leck). Erst danach lohnt ein Vergleich der Zuschnitte
   mit qwen3.8 — mit dem Coder misst er nur Rauschen am Boden.

## Grenzen

- n = 3 je Arm; die Gutachter sind Claude-Subagenten mit je einer Spec, ohne Vergleichsgutachten.
- Raster neu festgelegt (`rig/sigllm-spezifikation/golden/auftragspunkte.json`, 28 + 5 Punkte) —
  nicht identisch mit den 26 Punkten aus Runde 20, die nicht abgelegt waren.

## Artefakte

`blind-cr682/` — die neun gerenderten Specs, die Gutachten (JSON) und `zuordnung.json`.
Renderer: `spec-render.mjs`. Ergebnisdateien der Läufe: `results-cr682-{fund,index,faltung}.json`.
