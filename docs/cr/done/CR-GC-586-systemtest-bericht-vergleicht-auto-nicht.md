# CR-GC-586: Systemtest-Bericht vergleicht Auto nicht mit Hand: Trajektorie nach Review-18 (Steuerwert/Anker-Bewegung, Anker-Standzeiten, Modularitaet, Quoten je Zug aus dem Audit) und Profil gegen das Golden liefen nur als Scratch-Skripte — der handgefuehrte Lauf ist der Bezugspunkt

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-435 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-435.json (Lane: graph)

---

## 1 Befund

Der Bezugspunkt jeder Steuerungsaussage ist der handgefuehrte Lauf — der Auto-Modus soll ihn so
abbilden, dass daraus Verbesserungen folgen. Der Vergleich lief nur als Scratch-Skripte
(`steuerung.mjs` nach Review §18, `vergleich.mjs` Arm gegen Golden), mit absoluten Pfaden auf
einen Trail im Scratchpad. Der Systemtest konnte ihn nicht reproduzieren.

## 2 Umsetzung

- `rig/sigllm-spezifikation/golden/referenz-trail.jsonl`: der handgefuehrte sigllm-Trail bis v98,
  verschlankt auf operation/result/graphVersion/commands/consultedTools (484 KB statt 1,4 MB).
  Konvention: der Trail eines Korpus liegt neben seinem Golden.
- `rig/greenfield-systemtest/trajektorie.mjs`: `spieleNach` (Audit Zug fuer Zug durch
  `applyCommands`, je Zug Steuerwert, Anker, ℝ⁶, Q deklariert/erkannt, Engpass, drei Quoten),
  `bewegung`, `profil`, `vergleichBericht`.
- `report.mjs`: Abschnitt "Auto gegen Hand", Hand als erste Zeile; `GOLDEN` ist Berichtsparameter.
- Abnahme `tests/systemtest-rig.test.ts`: synthetischer Trail mit abgelehntem Zug; Fundort des
  Trails; Hand-Zeile zuerst; **der echte Hand-Trail spielt genau das Golden nach (255 Elemente)**.

## 3 Erster Befund aus dem Abschnitt (sigllm-Prosa)

| | Zuege | Steuerwert bewegt | Anker bewegt | laengste Anker-Standzeit |
|---|---:|---:|---:|---|
| Hand | 99 | 1 % | 1 % | 64 Zuege ohne Ueberschuss |
| opus5-7 | 38 | 11 % | 3 % | 32 Zuege RD-04@SYS |
| opus5-9 | 16 | 7 % | 13 % | 9 Zuege ohne Ueberschuss |

Der Steuerwert bewegte sich auch im Handlauf kaum — er ist juenger als der Handlauf und war dort
nicht im Kanal. In `opus5-7` stand RD-04 32 Zuege lang als Anker, ohne bearbeitet zu werden (das
ist CR-GC-583); in `opus5-9` wechselt der Anker, keiner steht laenger als 9 Zuege.

## 4 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Auto gegen Hand steht im Standardbericht, reproduzierbar aus dem Repo | erfuellt |
| 2 | Der Hand-Trail reproduziert das Golden | erfuellt, Test |

**Kongruenz:** RC-* nicht aus dieser Session geprueft — benannte Ausnahme.
