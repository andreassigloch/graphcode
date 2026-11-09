# CR-GC-895: se-conops/se-plan: Zugangsliste aus dem Modell, Stufe 0 mit Prüfskript vor dem Bau

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1271 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1271.json (Lane: code)

---

Befund aus immo-infra, gemessen 2026-11-02..11-09: Der Bau wurde 8-mal unterbrochen, weil ein Zugang fehlte, den nur der Nutzer anlegen kann: SSH-Schlüssel und Passwort (11-02), DNS-Eintrag für die Portal-Domain (11-06), gh auth mit write:packages für das Paket der Verträge (11-06), Leseschlüssel ohne Recht auf /contacts (11-07), Schreibschlüssel PropStack (11-07), Schlüssel für den Agenten-Lauf mit claude -p (11-08), Token für das Konto (11-08), am Ende eine Sammelliste offener Terminal-Befehle (11-09).

Root Cause: se-conops lief am 2026-10-26..28, vor VPS, Domain und Paket-Register. Die Skill schreibt Regeln („Schlüssel nie im Quellcode“), aber keine Liste, wer welchen Zugang wo anlegt, und nichts prüft ihn vor dem Bau. se-plan §4 kennt Stufe 0 „Umgebung“ nur, wenn §2 sie entschieden hat.

## Änderung
1. se-conops §1 „creds/secrets“: aus dem Modell die Zugangsliste ableiten. Jeder io-FLOW zu einem ACTOR oder fremden System, jeder Dienst mit Domain, jedes private Paket-Register ergibt eine Zeile: Zugang, wer ihn anlegt (Mensch/Agent), Ablageort, Prüfaufruf.
2. se-plan §4: Stufe 0 „Umgebung“ ist Pflicht, sobald die Zugangsliste eine Zeile mit „Mensch“ hat. Sie enthält einen CR „Zugänge bereitstellen“: der Nutzer arbeitet die Liste in einem Block ab, ein Skript ruft je Zugang den Prüfaufruf (erwartet z. B. HTTP 200 / erfolgreicher Login) und meldet grün oder rot.
3. se-plan: Stufe 1 beginnt erst, wenn das Prüfskript ganz grün ist. Ein später entdeckter Zugang wird erst in die Liste geschrieben, dann eingeholt.

## Akzeptanzkriterien
- se-conops.md und se-plan.md tragen die Zugangsliste und die Pflicht-Stufe 0 mit Prüfskript.
- Test in `tests/` hält beide Pflichtstellen fest.
- Gegenprobe: Die 8 Unterbrechungen aus immo-infra stehen alle als Zeile in einer aus dem Modell abgeleiteten Liste.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** kein Host in /Users/andreas/Developer/dev/graphcode (keine host.sock).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
