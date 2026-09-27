# CR-GC-703: Executor-Prompt-Vorbilder lecken als Inhalt: REQ-login-* in 9 von 9 Laeufen eines Auftrags ohne Login

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-607 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-607.json (Lane: code)

---

Gemessen 2026-09-27 (CR-GC-682-Auswertung, 9 Laeufe qwen3-coder, Korpus sigllm-gcrun, Auftrag ohne Login): jeder Graph enthaelt 2-6 REQ zu Login/Passwort, wortgleich aus den Format-E-Vorbildern in src/loop/executor-prompt.ts:46-72 (REQ-login-passwort 'unter 2 s', seit CR-GC-667 zusaetzlich REQ-login-dauer — in 6/9 Laeufen woertlich). Die Blind-Gutachter nennen das Login-Modell in allen 9 Specs als Hauptverdraengung des Auftragskerns; Runde 20 fand dasselbe (REQ-login-passwort in gcrun-160/180). Das Vorbild lehrt die Form (Memory: Vorbild statt Verbot) — aber das kleine Modell uebernimmt auch den Inhalt. Kandidaten: Vorbild aus einer Domaene, die kein Auftrag hat (Platzhalter-Semantik), oder Vorbild aus dem Auftrag selbst generiert; Nachweis per Rig-Lauf: Leck-Zaehlung (uid/Text login|passwort) vor/nach. Nachtrag 2026-09-27 (Verhaltensanalyse): zweite Leck-Quelle ist das Skelett-Vorbild in src/loop/generate.ts:241-243 (ACTOR-nutzer -io-> FLOW-anfrage -io-> FUNC-anfrage-annehmen 'Nimmt die Anfrage entgegen', SCHEMA-anfrage, FCHAIN-sitzung): 63 'Annahme'-FUNCs in 9 Laeufen, 43 davon ohne jeden Befund angelegt; 23 von 39 FCHAINs bestehen aus genau einer FUNC; ACTOR 'nutzer' in 7/9 Laeufen; 'Sitzungs-ID' in den Schemas.

---

## Umfang

`FUNC-generation-step` (`src/loop/generate.ts`, RULE_CLAUSE UC-02), dazu `tests/generate.test.ts`
und die Leck-Liste `rig/greenfield-systemtest/verhalten.mjs` (`VORBILD_UIDS`, T-E11). 3 Dateien.

## Stand vorher

Die erste Leck-Quelle (executor-prompt.ts, REQ-login-*) ist seit CR-GC-667/672 ein Platzhalter-Vorbild,
und der Preflight sperrt `beispiel`-uids und «X A»-Texte (CR-GC-672). Offen war die zweite Quelle:
das UC-02-Skelett mit echtem Inhalt (FLOW-anfrage, FUNC-anfrage-annehmen, ACTOR-nutzer,
FCHAIN-sitzung, „Sitzungs-ID") — 63 Annahme-FUNCs in 9 Laeufen, ACTOR nutzer in 7/9.

## Ergebnis

- UC-02-Vorbild in Beispiel-Form: `FLOW-beispiel-eingabe`, `SCHEMA-beispiel-eingabe`,
  `FUNC-beispiel-verarbeiten`, `ACTOR-beispiel`, `FCHAIN-beispiel`, Texte mit «Eingabe A» usw.;
  der Text sagt, dass ACTOR und FCHAIN die vorhandenen des UC sind. Uebernimmt das Modell eine
  Vorbild-uid, blockt der Preflight (PREFLIGHT-VORBILD) mit Hinweis.
- Neuer Waechter ueber ALLE Klauseln: jede uid einer Vorbildzeile traegt `beispiel` — ein neues
  Vorbild mit Inhalt wird rot, statt im Lauf zu lecken.
- `VORBILD_UIDS` fuehrt die neuen uids, die alten bleiben unter „frueher" (die Leck-Messung alter
  Laeufe zaehlt weiter richtig).

## Akzeptanz

- [x] Rot zuerst: Waechter meldete 10 Inhalts-uids, alle UC-02.
- [x] generate, rig-verhalten, preflight, skill-rule-ids, channel-rank, statemachine, first-step 140/140; `tsc` sauber.
- [ ] Leck-Zaehlung im Lauf (T-E11 `pruefungen.vorbildLeck`, Annahme-FUNCs) vor/nach — naechste S2-Runde.
