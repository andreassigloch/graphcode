# CR-GC-356 — Der Prompt-Relay im MCP-Pfad

**Status:** done 2026-08-15 · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **6**)
**Vorbedingung:** CR-GC-354 (Vertrag), CR-GC-355 (der Executor-Pfad, unabhängig lauffähig).
**Ziel:** auch Claude Code / OpenCode liefern den auslösenden Prompt in den Trail — im Wortlaut,
ohne dass ein Modell ihn über sich selbst berichtet.

---

## 1. Problem

Im MCP-Pfad sieht der Harness den Prompt **prinzipiell nicht**: kein Tool-Call trägt ihn, und die
Aufzeichnung endet damit bei „`consumerId: 'mcp-client'` hat mutiert". Der naheliegende Ausweg —
ein `intent`-Feld im Tool-Input — ist der falsche, und zwar aus zwei unabhängigen Gründen:

1. **Selbstdeklaration ist wertlos.** `consumerId` *ist* dieses Feld, seit dem ersten Record: 49 von
   123 Records (40 %) tragen die anonymen Defaults `mcp-client` und `claude-code`.
2. **Ein Modell liefert eine Paraphrase, keinen Volltext.** Was ein Modell über seinen eigenen
   Prompt schreibt, enthält bereits die Interpretation, die ein späterer Konsument vorhersagen
   soll. Als Trainingsdatum ist es damit unbrauchbar — und „Volltext mit Kappung" war der Entscheid.

Dazu käme, dass ein pflichtiges `intent`-Argument die **11** Skill-Dateien angefasst hätte, die
heute `graph_mutate` aufrufen (`.claude/commands/se-*.md`, `se/*.md`).

---

## 2. Entwurf: der Client relayt, der Harness liest

`.claude/hooks/record-prompt.sh` auf `UserPromptSubmit` schreibt die **eigene, unberührte Kopie**
des Clients nach `.graphcode/prompts/<session_id>.json`; `recordAudit` liest sie beim nächsten
Write. Der Hook-Mechanismus ist in diesem Repo etabliert (drei PreToolUse-Deny-Hooks, CR-GC-201/214).

Zwei Eigenschaften sind tragend:

**`sessionId` wird die Client-Session-ID**, nicht die selbst vergebene. Sie benennt zugleich das
Transkript in `~/.claude/projects` — solange dessen ~30-Tage-Fenster reicht, bleibt der Record mit
seinem Gespräch verbunden.

**Mehrdeutigkeit wird als Abwesenheit aufgezeichnet.** Ein Host-Prozess kann mehrere Sessions
bedienen (Host-Shim, CR-GC-235), und der Relay trägt keine Marke, die einen Prompt an einen
bestimmten Tool-Call bindet. Bei zwei lebenden Relays ist nicht entscheidbar, wessen Prompt diesen
Write ausgelöst hat:

> Genau **ein** Relay ⇒ verwenden. Alles andere ⇒ **nichts** aufzeichnen.

Eine „der neueste gewinnt"-Heuristik stempelte Session B's Prompt auf Session A's Record. Ein
falsches Prompt→Ergebnis-Paar ist schlechter als ein fehlendes — es vergiftet genau die Daten, für
die gesammelt wird. Der Hook löscht tagesalte Relays, was den Normalfall (eine Session je Repo)
eindeutig hält.

**Ein explizit gesetzter Origin gewinnt** (Executor-Pfad, CR-GC-355) — der Relay ist der Fallback.

---

## 3. Der Scaffold-Filter war ein stiller Ausschluss

`shippedHookFiles()` filterte auf `deny-*.sh`. Der Relay hätte damit **in diesem Repo funktioniert
und in keinem gescaffoldeten existiert** — die Sorte Befund, die man erst Monate später an leeren
Feldern merkt. Zwei Verallgemeinerungen, beide ohne neue Liste:

| vorher | nachher |
|---|---|
| `shippedHookFiles()` filtert `deny-*.sh` | alle `*.sh` im gepackten Hook-Verzeichnis |
| `shippedPreToolUseEntries()` → nur `PreToolUse` | `shippedHookEvents()` → alle Event-Keys aus der eigenen `settings.json` |

`mergedSettingsContent` und `removeHooks` iterieren jetzt über Events statt über den einen
hartkodierten Namen. `removeHooks` geht dabei über die **vorgefundene** Datei, nicht über die
aktuell ausgelieferte Liste — sonst ließe ein Downgrade Registrierungen einer neueren Version stehen.

---

## 4. Akzeptanzkriterien

- [x] Der Fall läuft gegen den **echten** bash-Hook (`execFileSync`), nicht gegen eine
      handgeschriebene Relay-Datei — Skript und Leser prüfen einander, nichts kann auseinanderdriften.
- [x] Relayter Prompt landet **wörtlich** im Record; `sessionId` ist die Client-ID.
- [x] Zweiter Prompt derselben Session ersetzt den ersten.
- [x] **Zwei** lebende Sessions ⇒ `intent` fehlt, `sessionId` fällt auf die selbst vergebene zurück.
- [x] Zerrissene/manipulierte Relay-Datei: der Write **gelingt**, der Stempel fehlt — fehlende
      Provenienz ist eine Datenlücke, ein verlorener Write wäre ein Defekt.
- [x] Expliziter Origin schlägt den Relay.
- [x] `shippedHookFiles()` enthält `record-prompt.sh`; `mergedSettingsContent` registriert ihn unter
      `UserPromptSubmit` und lässt fremde Hooks **und** `PreToolUse` unangetastet.
- [x] Red-first nachgewiesen: ohne den Leser *expected undefined to be 'immer die saubere lösung'*.
- [x] `npm run build` + `npm test` grün (Ausnahme: die vorbestehende CR-GC-346-F3-Rotfärbung).

---

## 5. Grenzen — benannt, nicht versteckt

- **Mehrere gleichzeitige Sessions je Repo bekommen keinen `intent`** (§2). Bewusst: lieber eine
  Lücke als ein falsches Paar. Eine echte Zuordnung bräuchte eine Session-Marke am Tool-Call selbst,
  also eine MCP-Transport-Änderung — eigener CR, wenn der Fall je auftritt.
- **Ohne den Hook gibt es keinen Stempel.** Ein Client ohne `UserPromptSubmit` liefert nichts, und
  das Feld fehlt — was der Vertrag korrekt als „nicht aufgezeichnet" liest (CR-GC-354).
- **`jq` ist Voraussetzung** — wie bei den drei bestehenden Deny-Hooks. Fehlt es, endet der Hook
  still mit 0: er darf einen Prompt niemals blockieren.

---

## 6. Betroffene Dateien (6)

| Datei | Änderung |
|---|---|
| `.claude/hooks/record-prompt.sh` | **neu** — `UserPromptSubmit`-Relay, atomarer Swap, Pruning |
| `.claude/settings.json` | Registrierung unter `UserPromptSubmit` |
| `src/tool-context.ts` | `PROMPT_RELAY_DIR` + `readRelayedPrompt`, Mehrdeutigkeit ⇒ Abwesenheit |
| `src/scaffold-templates.ts` | `shippedHookFiles` ohne Präfix-Filter, `shippedHookEvents` statt PreToolUse-only |
| `src/scaffold.ts` | `removeHooks` räumt alle Events |
| `tests/hooks.prompt-relay.test.ts` | **neu** — echter Hook, Mehrdeutigkeit, torn file, Scaffold-Rollout |

@author andreas@siglochconsulting
