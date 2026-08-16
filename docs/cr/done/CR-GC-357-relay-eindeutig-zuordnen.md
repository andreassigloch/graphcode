# CR-GC-357 — Den Prompt-Relay exakt zuordnen

**Status:** done 2026-08-16 · **Angelegt:** 2026-08-16 · **Max Files:** 6 (dieser CR: **5**)
**Vorbedingung:** CR-GC-356 (der Relay selbst).
**Ziel:** die Eindeutigkeitsregel aus CR-GC-356 bekommt einen **Schlüssel** statt einer Bedingung,
die im Normalbetrieb nie erfüllt ist.

---

## 1. Problem — die sichere Regel war praktisch eine Aus-Regel

CR-GC-356 entscheidet: genau **ein** Relay in `.graphcode/prompts/` ⇒ verwenden, alles andere ⇒
nichts aufzeichnen. Die Sicherheitseigenschaft ist richtig — ein falsches Prompt→Ergebnis-Paar
vergiftet genau die Daten, für die gesammelt wird. Ihre praktische Wirkung war es nicht.

**Gemessen am 2026-08-16 auf dieser Maschine:**

```
.graphcode/prompts/  →  4 Relays, geschrieben zwischen 04:10 und 04:34
ps                   →  5 lebende `claude`-Prozesse
```

Der Hook räumte nach **Alter** auf (`-mtime +0`), also blieb jede Session des Tages liegen. Bei
mehr als einer Session pro Tag und Repo — in diesem Repo der Normalfall — war die Bedingung
„genau eine Datei" damit nie erfüllt: **`intent` wurde nie aufgezeichnet.**

**Und keine Zeit-Heuristik repariert das.** Vier Relays innerhalb von 24 Minuten trennt kein
Fenster; ein 30-Minuten-Fenster hätte hier exakt dieselbe Mehrdeutigkeit ergeben. „Der neueste
gewinnt" wäre eine Vermutung, und Vermutungen sind das, was CR-GC-356 bewusst ausgeschlossen hat.

Es braucht also einen **Schlüssel**, keine bessere Bedingung.

---

## 2. Der Schlüssel: der besitzende Client-Prozess

Aus derselben Messung, die das Problem zeigte, kam die Lösung. Die Ahnenkette eines echten
Servers:

```
node …/graphcode mcp   (87796)
  └─ npm exec @sigloch/graphcode@latest mcp   (87774)
       └─ claude   (87514)          ← genau EINER der fünf
```

Beide Seiten können denselben Prozess benennen:

- Der **Hook** läuft als Kind seines Client-Prozesses und schreibt dessen PID in den Relay.
- Der **graphcode-Prozess** läuft als Enkel desselben Prozesses und findet ihn beim Bind.

Gematcht wird auf den **Basenamen der ausführbaren Datei** (`comm`), nie auf die Kommandozeile:
der Pfad dieses Skripts enthält `.claude/hooks/`, eine Kommandozeilen-Suche fände also die eigene
Shell. `ps -o comm=` liefert `/…/native-binary/claude` für den Client und `/bin/zsh` für eine
Shell — der Basename trennt beide sauber.

**Fail-closed.** Keine Ahnenkette ⇒ kein Schlüssel ⇒ **nicht aufgezeichnet**. Ein erfundener
Schlüssel würde einen fremden Relay matchen, und das ist genau der Fehler, der hier vermieden wird.

### 2.1 Aufräumen nach Lebendigkeit statt nach Alter

Ein Relay, dessen Client-Prozess weg ist, kann nie wieder gematcht werden — er liegen zu lassen
war der Grund, warum das Verzeichnis mehrdeutig aussah. `kill -0` ist der exakte Test und ersetzt
das grobe `-mtime +0`.

### 2.2 Der Proxy-Fall bleibt bewusst blind

Der gewählte Host bedient andere Sessions über den Shim-Socket (CR-GC-235), und ein
durchgereichter Aufruf ist am Handler **nicht** von einem lokalen unterscheidbar. Sein eigener
Relay würde also auf den Write einer fremden Session gestempelt.

Solange ein durchgereichter Aufruf läuft, bekommt **niemand** einen Stempel: ein gleichzeitiger
lokaler Aufruf verliert seinen Prompt (eine Lücke), statt dass ein durchgereichter einen falschen
bekommt (ein Defekt). Die Asymmetrie ist Absicht und dieselbe wie überall sonst in dieser Kette.

---

## 3. Umfang

1. **Hook:** Ahnen-Suche, `ownerPid` im Relay, Pruning per `kill -0`. Ohne Ahnenkette wird gar
   nichts geschrieben.
2. **`tool-context.ts`:** `resolveOwnerPid()` (einmal beim Bind — die Ahnenkette eines lebenden
   Prozesses ändert sich nicht, und ein `ps` pro Mutation wäre Unfug), Match auf `ownerPid`,
   Proxy-Sperre.
3. **`host-shim.ts`:** markiert durchgereichte Aufrufe für die Dauer des Handlers.
4. **Test-Seam:** `ownerPid` ist in `createToolContext`/`bindToolsWithContext` injizierbar (wie
   `auditLog`, kein Parallelpfad), und der Hook akzeptiert `GRAPHCODE_OWNER_PID` als Override —
   dieselbe Escape-Form wie `GRAPHCODE_ALLOW_STALE_READ` in den Deny-Hooks. Sonst hinge der Test
   daran, ob der Runner zufällig einen `claude`-Vorfahren hat.

**Nicht-Ziele:** keine Änderung an Vertrag oder Aufzeichnungsformat (`AuditEntry` bleibt, wie
CR-GC-354 es gelassen hat), keine Zeit-Heuristik, keine Transport-Änderung am Shim-Protokoll.

---

## 4. Akzeptanzkriterien

- [x] Aus **drei** Relays (fremd/lebend, eigen, fremd/tot) wird der eigene gewählt; `sessionId`
      ist die des eigenen Relays.
- [x] Gehört **kein** Relay uns, fehlt `intent` — red-first: ohne den Match wird der fremde
      Prompt gestempelt, was der Fall als *expected true to be false* meldet.
- [x] Ein Relay mit totem `ownerPid` ist nach dem nächsten Prompt **weg**.
- [x] Während eines durchgereichten Aufrufs wird nicht gestempelt, danach wieder.
- [x] `resolveOwnerPid` liefert bei toter PID, bei PID 1 und bei PID 0 **null** und wirft nie —
      fail-closed statt erfundener Schlüssel.
- [x] Der Fall läuft weiter gegen den **echten** bash-Hook, nicht gegen eine handgeschriebene
      Relay-Datei.
- [x] `npm run build` + `npm test` grün.

---

## 5. Betroffene Dateien (5)

| Datei | Änderung |
|---|---|
| `.claude/hooks/record-prompt.sh` | Ahnen-Suche, `ownerPid`, Pruning per Lebendigkeit, Test-Override |
| `src/tool-context.ts` | `resolveOwnerPid`, Match statt Eindeutigkeits-Bedingung, Proxy-Sperre, `ownerPid()`-Reader |
| `src/host-shim.ts` | durchgereichte Aufrufe markieren |
| `src/mcp-tools.ts` | `ownerPid` durch `bindToolsWithContext` durchreichen |
| `tests/hooks.prompt-relay.test.ts` | fünf neue Fälle, alle red-first |
| `docs/cr/open/CR-GC-357-relay-eindeutig-zuordnen.md` | dieser CR |

@author andreas@siglochconsulting
