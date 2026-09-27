# CR-GC-697: FCHAIN-skill-report: FUNC-test/-test-ui ohne REQ (R-21) - REQ Red-First mit Test

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-616 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-616.json (Lane: code)

---

Aus CR-SM-376 (R-21 ueber Glied-FUNCs, 2026-09-27): FCHAIN-skill-report bleibt mit 8 R-21-Befunden offen, weil FUNC-test und FUNC-test-ui (Skills se-test, se-test-ui) keine REQ erfuellen. Beide lehren Red-First (ein Test zaehlt erst, wenn er aus dem richtigen Grund rot gesehen wurde). Neue REQ-test-skill-red-first (functional), von beiden erfuellt, verifiziert durch einen Inhaltstest an beiden Skill-Texten (Prompt-FUNC: der Text IST die Realisierung).

---

## Ergebnis

- Neue `REQ-test-skill-red-first` (functional), erfuellt von FUNC-test und FUNC-test-ui, komponiert in
  UC-deterministic-steering; verifiziert von `TEST-skill-red-first` →
  `tests/skill-red-first.test.ts` (prueft den ausgelieferten Skill-Text beider Skills auf die drei Teile
  der Regel, mit Positivkontrolle; zuerst rot an se-test-ui wegen Zeilenumbruch im Satz — Muster auf
  Weissraum korrigiert, nicht der Skill).
- Wirkung: FCHAIN-skill-report hat damit an jedem Glied eine REQ → R-21 (CR-SM-376) deckt die Kette.
  Nachmessung mit dem naechsten Host-Neustart (der laufende Host urteilt noch mit dem R-21 vor CR-SM-376).
- Umfang: 1 Test, Modell (REQ, TEST, 4 Kanten), diese Datei.
