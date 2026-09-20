# CR-GC-557: der Rundenprompt nennt Skills, die niemand lesen kann — also liefere ihren Inhalt

**Status:** 🟢 Done (2026-09-20)
**Typ:** aus Item ITEM-2026-371 (finding)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-371.json (Lane: code)

---

## 1. Root Cause

Der Rundenprompt schreibt wörtlich `UC-Stil: Actor–Verb–Objekt–Ergebnis, ≤25 Wörter (Skill
se:author-uc)`. Diesen Skill kann im Executor-Loop **niemand aufrufen**:

- Skills sind `.claude/commands/se*/**.md` — **Slash-Kommandos** des Claude-Code-Harness.
- `graphcode run` liest dieses Verzeichnis überhaupt nicht.
- `claude -p` kennt sie, ruft sie aber nur auf Nennung im Prompt auf. Gemessen über zwei
  Läufe: **null Aufrufe**.

Damit ist der Verweis ein toter Zeiger — und die Anleitung, auf die er zeigt, ist genau das,
was dem Modell fehlt. `se/author-uc.md` trägt die Stilregel, das Jargon-Budget, die
Mutate-Form und zwei Modellierungs-Konventionen, die nirgends sonst stehen.

## 2. Impact

Das Modell bekommt die Regel als **Schlagwort** („≤25 Wörter") statt als Anleitung, und den
Hinweis, wo die Anleitung stünde, kann es nicht einlösen. Was in `author-uc.md` steht und im
Rundenprompt fehlt: das Jargon-Budget (≤2 Begriffe, und jeder muss als SCHEMA- oder REQ-Knoten
existieren), die Aufforderung zu teilen statt zu verdichten, und die UC-Sequenzierung über
geteilte FUNC statt über eine neue Kante.

## 3. Fix

`buildRoundInjection` hängt den **Rumpf** des passenden Skills an — dieselbe Stelle, die heute
schon Kanten-Grammatik und Element-Index einbettet, und derselbe Auswahlschlüssel:
`focusTypes`.

| focusType | Skill |
|---|---|
| `UC` | `se/author-uc.md` |
| `REQ` | `se/author-req.md` |

Ein Skill je Runde, nie mehrere: `author-uc.md` sind 3.007 Zeichen (~750 Token) gegen 26.305
Zeichen Werkzeugkatalog — bezahlbar, solange es bei einem bleibt. Frontmatter wird abgeschnitten
(`name`/`description` sind Harness-Metadaten, keine Anleitung).

Der Verweis „(Skill se:author-uc)" im Rundenprompt entfällt, sobald der Inhalt danebensteht —
sonst zeigt er weiterhin ins Leere. Genau ein Schreiber pro Tatsache, dieselbe Linie wie beim
Guide-Slice (CR-GC-291).

### Dateien (4)

| # | Datei |
|---|---|
| 1 | `src/loop/executor-prompt.ts` — Skill-Rumpf in `buildRoundInjection` |
| 2 | `src/loop/generate.ts` — den toten Verweis aus dem Rundenprompt nehmen |
| 3 | `tests/executor.skill-injection.test.ts` — neu, die Abnahme |
| 4 | `docs/cr/open/…` → `done/` |

## 4. Nachweis

- [x] **Rot zuerst:** die beiden Skill-Prüfungen sind vor dem Patch rot.
- [x] Bei Fokus `UC` stehen Stilregel und Jargon-Budget im Rundeninhalt (2.775 Zeichen).
- [x] Höchstens EIN Skill je Runde, auch bei vier Fokus-Typen.
- [x] Frontmatter abgeschnitten.
- [x] Der tote Verweis in `generate.ts` ist ersetzt; `se:target-profile` bleibt stehen, das
      ist eine Anweisung **an den Menschen**, nicht ans Modell.
- [x] `npm test` grün.

**Gemessen am gcrun-Graphen:** Rundeninhalt 3.541 → 6.365 Zeichen. Gegen den Werkzeugkatalog
gerechnet ist der Steuerungsanteil damit 20 % (`toolset=full`) bzw. **50 %** (`authoring`) —
vorher 12 % bzw. 36 %. Der Zuwachs geht vollständig in Anleitung und Empfehlung, nicht in
Katalog.
