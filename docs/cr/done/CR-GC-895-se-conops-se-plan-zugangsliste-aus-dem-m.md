# CR-GC-895: se-conops/se-plan: Zugangsliste aus dem Modell, Stufe 0 mit Prüfskript vor dem Bau

**Status:** ✅ Done (2026-11-09)
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

## Umfang laut Modell

- `FUNC-se-conops` (`.claude/commands/se-conops.md`), `FUNC-se-plan` (`.claude/commands/se-plan.md`) —
  satisfy `REQ-zugangsliste-vor-bau` (neu, unter `UC-code-quality`).
- `TEST-skill-zugangsliste` (neu, `tests/skill-zugangsliste.test.ts`) — verify `REQ-zugangsliste-vor-bau`.

## Ergebnis

- se-conops Version 6: §1 „Access list" — eine Zeile je Zugang aus vier Quellen im Modell: io-FLOW zu
  ACTOR oder fremdem System, Dienst mit Domain, privates Paket-Register, Ziel einer Auslieferung (Host,
  Konto). Spalten: Zugang, wer ihn anlegt, Ablageort, Pruefaufruf. Eine Zeile, die das Modell nicht
  fuellt, ist eine Luecke in §5.
- se-plan Version 8: §4 Stufe 0 ist Pflicht bei einer Zeile mit *human*, mit CR „Provide access" und
  Pruefskript; Stufe 1 erst bei ganz gruenem Skript; ein spaeter Zugang erst in die Liste.
- Test: 3 Faelle; gegen die alten Skill-Texte alle 3 rot.
- Gegenprobe an den 8 Unterbrechungen: SSH-Schluessel und Passwort → Ziel einer Auslieferung; DNS →
  Dienst mit Domain; gh auth write:packages → privates Paket-Register; Leseschluessel /contacts,
  Schreibschluessel PropStack, Schluessel fuer claude -p → io-FLOW zu fremdem System; Token fuer das
  Konto → Ziel einer Auslieferung (Konto). Die Sammelliste offener Terminal-Befehle (11-09) ist kein
  eigener Zugang, sondern die Folge der sieben anderen. Die vierte Quelle (Ziel einer Auslieferung)
  kam durch diese Gegenprobe dazu; ohne sie fehlten SSH und Konto.
- `verify:full CR-GC-895`: 1718/1718 gruen (209 Dateien), Schlupf 0.
