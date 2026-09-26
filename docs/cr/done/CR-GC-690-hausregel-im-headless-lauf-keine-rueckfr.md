# CR-GC-690: Hausregel 'im headless-Lauf keine Rueckfrage' steht in GRAPHCODE.md, wird aber nicht durchgesetzt: opus5-0 rief AskUserQuestion zu einer selbst als Rauschen gemessenen Entscheidung

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-484 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-484.json (Lane: code)

---

## 1 Befund

CR-GC-592 hat die Regel als Prosa in `GRAPHCODE.md` gelegt („When the brief leaves something open":
offene Punkte als Annahme ins Modell, gefragt wird nur, wenn ein Mensch antworten kann). Durchgesetzt
wird sie nirgends: `.claude/settings.json` registriert kein Hook auf `AskUserQuestion`.

Belege aus `rig/greenfield-systemtest/runs/opus5-*/claude-stream.jsonl` (Claude-Code-Arm, `claude -p`):

- **5 der 18** heute liegenden `opus5`-Laeufe rufen `AskUserQuestion` (opus5-5, -8, -10, -16, -17);
  dazu der in `docs/archive/research/testlauf-2026-09-22.md` §3 beschriebene `opus5-0`, dessen
  Verzeichnis inzwischen ueberschrieben ist. Drei der fuenf (opus5-10, -16, -17) stammen vom
  Abschlusstag von CR-GC-592 oder danach (22.–23.09.) — die Prosa-Regel hat sie nicht verhindert.
- Jedes Mal antwortet der Harness mit `is_error: true`, Inhalt `"Answer questions?"` — der Zug ist
  verloren, und die Fehlermeldung sagt dem Agenten nicht, was er stattdessen tun soll.

Erkennbarkeit von headless (gemessen 2026-09-26, Env-Dump-Hook unter `claude -p`, claude 2.1.167):
Claude Code setzt fuer Hooks `CLAUDE_CODE_ENTRYPOINT=sdk-cli`. Interaktiv ist es `cli`, in VS Code
`claude-vscode`, im Agent SDK `sdk-ts`/`sdk-py` — dort antwortet ein Mensch oder ein Host.

## 2 Zielbild

Ein PreToolUse-Hook `deny-headless-question.sh` (Matcher `AskUserQuestion`) blockt den Aufruf, wenn
`CLAUDE_CODE_ENTRYPOINT=sdk-cli`, und gibt dem Agenten die Hausregel als Blockgrund zurueck: Annahme
ins Modell, in der Schlussmeldung nennen, weitermachen. Ueberall sonst laeuft der Aufruf durch.

Ausgeliefert wird es wie die anderen Hooks: `shippedHookFiles()` kopiert jedes `.sh`,
`shippedHookEvents()` liest die Registrierung live aus dem eigenen `.claude/settings.json`. Damit gilt
die Regel in jedem Consumer-Repo nach `init`/`upgrade` — auch im Rig, das `graphcode init` faehrt.

**Verworfen:** `--disallowedTools AskUserQuestion` im Rig-Aufruf. Durchgesetzt, aber nur im Rig; die
Regel ist fuer Consumer geschrieben, und der Agent erfaehrt dort nicht, was er stattdessen tun soll.

## 3 Umfang

| Datei | Aenderung |
|---|---|
| `.claude/hooks/deny-headless-question.sh` | neu: Hook, blockt nur bei `sdk-cli` |
| `.claude/settings.json` | PreToolUse-Eintrag, Matcher `AskUserQuestion` |
| `src/surface/scaffold-docs.ts` | `GRAPHCODE.md`-Hausregel nennt das Hook (Budget < 6.000 Zeichen, CR-GC-612) |
| `tests/hooks.deny-headless-question.test.ts` | neu: echtes Shell-Hook, Registrierung, Auslieferung |
| dieser CR | |

Modell-Zug: keiner in diesem CR (Lane ohne Graph-Schreibrecht) — benannte Ausnahme, siehe Ergebnis.

## 4 Akzeptanz

1. Red first: der neue Test ist vor dem Hook rot (7/7).
2. Hook mit `CLAUDE_CODE_ENTRYPOINT=sdk-cli` → exit 2, stderr nennt Annahme + Schlussmeldung;
   `cli`, `claude-vscode`, `sdk-ts`, ohne Variable → exit 0.
3. `mergedSettingsContent(null)` enthaelt den Eintrag mit Matcher `AskUserQuestion`,
   `shippedHookFiles()` das Skript.
4. Smoke: echter `claude -p`-Lauf mit dem gescaffoldeten Settings-Eintrag — der Aufruf wird geblockt,
   der Agent bekommt den Blockgrund.
5. `npm run build` gruen, volle Suite gruen (bekannt rot: `tests/rig-measured.test.ts`).

## 5 Ergebnis (2026-09-26)

- `deny-headless-question.sh` blockt `AskUserQuestion` bei `CLAUDE_CODE_ENTRYPOINT=sdk-cli` (exit 2)
  und gibt die Hausregel als Blockgrund zurueck; registriert in `.claude/settings.json`, damit
  ausgeliefert durch `init`/`upgrade` (keine Aenderung am Scaffold-Code noetig).
- `GRAPHCODE.md` nennt das Hook bei der Hausregel; Laenge 5.988 Zeichen (Budget CR-GC-612: < 6.000).
- Red first: `tests/hooks.deny-headless-question.test.ts` 7/7 rot ohne Hook, danach gruen.
- Smoke: `claude -p` (haiku) mit dem gescaffoldeten Eintrag, Auftrag „rufe AskUserQuestion" — der
  Aufruf landet in `permission_denials`, der Agent zitiert den Blockgrund und nennt die Annahme als Weg.
- **Offen:** Validierung im Rig (Spalte „Rueckfragen" in `report.mjs` = 0 ueber n ≥ 2 Laeufe) faellt
  mit dem naechsten bezahlten Lauf. Der opencode-Arm hat kein `AskUserQuestion` und ist nicht betroffen.
- **Kongruenz:** benannte Ausnahme — kein Modell-Zug in dieser Lane (kein Graph-Schreibrecht); der
  CR-Knoten wird beim Integrieren per `aise cr close` gespiegelt.
