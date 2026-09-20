# CR-GC-558: Die Anleitung folgt der Fokus-Dimension, nicht dem ersten Typ

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-374 (idea)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-374.json (Lane: graph)

---

## 1 Befund

CR-GC-557 hat den Skill-Rumpf in den Rundeninhalt geholt und damit den toten Zeiger
`(Skill se:author-uc)` abgeloest. Die Zuordnung blieb aber an zwei Eintraegen haengen
(`UC`, `REQ`) und wurde ueber `focusTypes.map(...).find(Boolean)` aufgeloest — also
ueber die **Reihenfolge eines Arrays**.

Beides ist falsch:

- **Deckung.** `DIMENSION_FOCUS_TYPES` kennt neun Dimensionen. Zwei davon trafen einen
  Skill. Die Struktur-Runden (`arch`, `alloc`) — genau die, in denen der Schnitt
  entsteht — liefen ohne jede Anleitung, obwohl `se:top-level` sie beschreibt.
- **Auswahl.** Die Reihenfolge in `DIMENSION_FOCUS_TYPES` ist fuer den Guide-Slice
  autoriert, nicht fuer die Skill-Wahl. Sie als Prioritaet zu lesen, heisst eine
  Bedeutung unterzuschieben, die dort nie gemeint war: `arch` beginnt mit `FCHAIN`,
  `req` mit `UC` — die Wahl haette an Nebensaechlichkeiten gehangen.

`se:top-level` war in CR-GC-557 mit einer Groessen-Begruendung ausgeschlossen
(14.871 Zeichen gegen ein Budget von 4.000). Das war der richtige Reflex am falschen
Hebel: ein blinder Byte-Schnitt bei 27 % liefert ein Fragment, das mitten im Satz endet.

## 2 Zielbild

**Ein Schreiber je Tatsache.** Die Runde kennt ihre Fokus-Dimension bereits — sie steht
schon im `focusKey`-Praefix. Statt sie dort per String-Split wieder herauszupulen, traegt
`GenerationStep` sie explizit als `focusDimension`, und die Zuordnung liest sie:

| Dimension | Skill |
|---|---|
| `seed`, `uc` | `se:author-uc` |
| `req` | `se:author-req` |
| `arch`, `alloc` | `se:top-level` |
| `ver`, `schema`, `cr`, `ms` | — (kein Autorier-Skill vorhanden) |

**Ausschnitt statt Ausschluss.** `readSkillBody` respektiert ein Markerpaar
`<!-- inject:start -->` / `<!-- inject:end -->` im Skill. Damit entscheidet der Skill
selbst, welcher Teil seiner selbst modelltauglich ist — **eine** Quelle, kein zweites
Kurzdokument neben dem Original (das waere ein paralleler Pfad, und es wuerde als erstes
auseinanderlaufen). Ohne Marker bleibt es beim bisherigen Verhalten: ganzer Rumpf, Budget-Kappe.

## 3 Umfang

- `src/loop/generate.ts` — `focusDimension` an `GenerationStep`, in allen vier Rueckgaben gesetzt
- `src/loop/executor-prompt.ts` — `SKILL_FOR_DIMENSION` ersetzt `SKILL_FOR_TYPE`; Marker in `readSkillBody`
- `.claude/commands/se/top-level.md` — Markerpaar um die Doktrin
- `tests/executor.round-injection-suggest-skill.test.ts` — Abnahme

Kein paralleler Pfad: `SKILL_FOR_TYPE` wird **geloescht**, nicht danebengestellt.

## 4 Abnahme

1. `arch`-Runde traegt `se:top-level`, `req`-Runde `se:author-req` — belegt, nicht behauptet.
2. Der Marker greift: der injizierte `top-level`-Block endet an `inject:end`, nicht an Byte 4.000.
3. Eine Dimension ohne Skill bekommt keinen Block (kein leerer Rahmen).
4. Hoechstens EIN Skill je Runde (Invariante aus CR-GC-557 bleibt).
5. Suite gruen.

## 5 Was bewusst offen bleibt

`ACTOR` hat weiterhin keinen Skill — das ist ITEM-2026-375 und braucht zuerst die Stufe,
in der es Fokus werden kann (CR-GC-559). `ver`/`schema`/`cr`/`ms` haben keinen
Autorier-Skill; ein leerer Eintrag waere eine Luege ueber vorhandene Anleitung.
