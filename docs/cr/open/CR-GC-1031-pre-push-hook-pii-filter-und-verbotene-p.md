# CR-GC-1031: Pre-push-Hook: PII-Filter und verbotene Pfade

**Typ:** aus Item ITEM-2026-1681 (idea)
**Erstellt:** 2026-11-25
**Item:** bok/items/ITEM-2026-1681.json (Lane: code)

---

Vor jedem Push auf origin: abbrechen bei getrackten Dateien unter spike*/, archive/spikes/, docs/messung/ (ausser stand.*), Gesprächsprotokollen und bei PII-Mustern (Postadresse, E-Mail, Telefon, IBAN, Firmenname mit Rechtsform) im zu pushenden Diff.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Was darf ein Push ins öffentliche graphcode-Repo nicht enthalten? | Keine Datei unter `verbotenePfade` (Spikes, eigene Messungen außer `docs/messung/stand.*`, Gesprächsprotokolle, interne Notizen) und keine personenbezogenen Daten in hinzugefügten Zeilen oder Commit-Nachrichten: Postadresse, E-Mail-Adresse, Telefonnummer, IBAN, Firmenname mit Rechtsform. Ausnahmen nur ausdrücklich in `scripts/push-pruefung.config.json`. | Entscheidung des Autors am 2026-11-25: klassischer PII-Filter; öffentlich ist alles, was git trackt. |

---

## Umfang

- `scripts/push-pruefung.mjs` (FUNC-push-check), `scripts/push-pruefung.config.json`, `scripts/githooks/pre-push`.
- `tests/push-pruefung.test.ts` (TEST-push-check → REQ-push-check-public): Wegwerf-Repo, echter `git push` über den echten Hook.
- Modell: REQ, FUNC, TEST, `allocate` an MOD-dev-scripts, `io` von FLOW-cli-invocation.

## Messung

- Muster gegen den ganzen getrackten Bestand: 0 Fehltreffer (vorher 7 aus UUID-Nullen, „Rendering 22“, „39672 Token“; das Muster „Postleitzahl mit Ort“ fiel deshalb weg).
- Positivkontrolle: 7 von 7 Beispielzeilen erkannt.
- Gegenprobe mit einem Hook, der alles durchlässt: 9 der 11 Fälle rot, die 2 Durchlass-Fälle grün.

## Grenzen und Abweichungen

- Ein Kunden- oder Personenname ohne Rechtsform, Adresse oder Kontaktdaten ist mit Mustern nicht erkennbar.
- Der Hook blockt, solange `docs/messung/` (außer `stand.*`) und `scripts/spike-*.mjs` getrackt sind; deren Umzug ist ITEM-2026-1682.
- R-30 und R-31 an FUNC-push-check bleiben als benannte Abweichung stehen: Die Meldung geht nur ans Terminal, keine Funktion liest sie (FAQ `r31-warnung-bleibt`).
