# CR-GC-552: graphcode run gegen sigllm statt direkt gegen die Runtime — drittes Backend sigllm im Executor

**Status:** 🟢 Done
**Abgeschlossen:** 2026-09-19
**Typ:** aus Item ITEM-2026-356 (idea)
**Erstellt:** 2026-09-19
**Item:** bok/items/ITEM-2026-356.json (Lane: code)

---

Auftrag vom 2026-09-19: die lokale LLM-Einbindung von graphcode laeuft ueber sigllm statt direkt gegen eine Runtime. qwen3.8-27b als Denker (reasoning), qwen3-coder-30b als Coder (fast).

Ist-Zustand: `graphcode run` liest GRAPHCODE_LLM_BASE_URL/_MODEL/_BACKEND und spricht /v1/chat/completions (openai) oder /v1/messages (anthropic). Das sigllm-Gateway kennt keinen der beiden Wege — verifiziert: HTTP 404 auf /v1/chat/completions.

Mit CR-SL-085 nimmt sigllm jetzt Werkzeuge am Client-Vertrag an. Damit fehlt nur noch die Gegenseite: ein drittes Backend `sigllm` in buildCallModel, das POST /v1/inference spricht.

Unterschiede zum openai-Backend, die der Zweig traegt:
- Der Vertrag ist .strict() OHNE `model`, `temperature`, `max_tokens` — Modell, Kontext und Budget kommen aus dem Profil. GRAPHCODE_LLM_MODEL traegt deshalb den PROFILNAMEN (fast|reasoning), nicht den Modellnamen.
- Pflichtfelder requestId (ULID) und token.
- Antwortform ist SCHEMA-inference-response, nicht die OpenAI-Wire-Form.
- Nachrichtenform camelCase (toolCalls/toolCallId) statt tool_calls/tool_call_id.
- TLS mit eigener CA; das Zertifikat traegt 127.0.0.1 als SAN, also reicht NODE_EXTRA_CA_CERTS.

---

## Umfang

| Datei | Aenderung |
|---|---|
| `src/loop/executor.ts` | `backend` kennt `sigllm`; `model` traegt dort den Profilnamen |
| `src/loop/executor-backend.ts` | dritter Zweig in `buildCallModel`: `POST /v1/inference` |
| `src/surface/run-verb.ts` | `GRAPHCODE_LLM_TOKEN`, Pflichtpruefung je Backend, Fehlertext |
| `tests/executor.sigllm.test.ts` | neu — die Abnahme |

Vier Dateien. `executor-tools.ts` bleibt unberuehrt: `pushToolResults` verzweigt nur auf
`anthropic`, alles andere faellt in den OpenAI-Pfad — und genau den braucht `sigllm` auch.

## Der Schnitt

Die Umwandlung liegt **im Backend-Zweig**, nicht in der Schleife. Die Schleife fuehrt weiter
OpenAI-foermige Nachrichten (`tool_call_id`, `tool_calls`), und der Zweig uebersetzt sie beim
Absenden nach sigllm (`toolCallId`, `toolCalls`) und die Antwort zurueck. Die Alternative waere
eine dritte Nachrichtenform in `executor.ts` gewesen — drei Formen in einer Schleife, die schon
zwei auseinanderhalten muss.

`GRAPHCODE_LLM_MODEL` traegt beim sigllm-Backend den **Profilnamen**, nicht den Modellnamen. Das
ist keine Umwidmung aus Bequemlichkeit: der Vertrag ist `.strict()` ohne `model`, weil die Bindung
Modell↔Profil der Plattform gehoert. Ein Feld `GRAPHCODE_LLM_PROFILE` daneben waere ein zweiter
Name fuer dieselbe Stelle.

Was NICHT mitgeschickt wird: `temperature`, `max_tokens`, `reasoning_effort`. Alle drei kommen
aus dem Profil, und `.strict()` weist sie ab. Best-of-N (`candidates > 1`) verliert damit seinen
Temperatur-Spread — der Zweig laesst das nicht still geschehen, sondern lehnt die Kombination ab.

## Abnahme

1. Ein Werkzeugdialog ueber zwei Runden gegen die laufende Anlage, beide Profile.
2. Fehlendes `GRAPHCODE_LLM_TOKEN` bricht mit benanntem Fehler ab, nicht mit HTTP 401 spaeter.
3. Ein unbekannter Profilname wird vom Gateway abgewiesen und der Fehler erreicht den Aufrufer.
4. `candidates > 1` mit Backend `sigllm` wird beim Start abgelehnt, nicht stillschweigend auf
   einen Kandidaten reduziert.
5. Die bestehenden Executor-Tests bleiben gruen — openai und anthropic unveraendert.

## Ergebnis

`npm run build` gruen. Volle Suite: **144 Dateien / 1175 Tests gruen** (294 s), davon 14 neu
in `tests/executor.sigllm.test.ts`.

**Validiert 2026-09-19** — die ganze Kette, kein Mock: graphcodes `buildCallModel` mit
`backend: 'sigllm'` gegen ein echtes SIG-Local-Gateway (eigener Port, echtes Zertifikat,
erteiltes Token) gegen echtes Ollama. Beide Profile, je zwei Runden Werkzeugdialog:

```
Profil fast (qwen3-coder-30b-lms)
  Runde 1  stopReason: tool_calls
           toolCalls: [{ name: graphcode_graph_context, input: { uid: SYS-00 } }]
  Runde 2  stopReason: stop   —  357 Prompt-, 55 Completion-Token
           "Der Kontext des Knotens SYS-00 ist wie folgt: UID SYS-00, Name SIG Local, Typ SYS …"

Profil reasoning (qwen3.8-27b-lms)
  Runde 1  stopReason: tool_calls
           toolCalls: [{ name: graphcode_graph_context, input: { uid: SYS-00 } }]
  Runde 2  stopReason: stop   —  412 Prompt-, 88 Completion-Token
           "Kontext des Knotens SYS-00: Name SIG Local, Type SYS …"
```

Beide Modelle haben das angebotene Werkzeug aufgerufen, die `assistantMsg` aus der
Uebersetzung zurueck in die naechste Runde getragen und aus dem Werkzeugergebnis geantwortet.

## Wie der Lauf konfiguriert wird

```bash
export NODE_EXTRA_CA_CERTS=/Users/andreas/Developer/prod/sigllm/data/tls/sig-llm-ca.crt
export GRAPHCODE_LLM_BACKEND=sigllm
export GRAPHCODE_LLM_BASE_URL=https://127.0.0.1:8080
export GRAPHCODE_LLM_TOKEN="$(cat /Users/andreas/Developer/prod/sigllm/data/client-token.txt)"

GRAPHCODE_LLM_MODEL=reasoning  npx @sigloch/graphcode run "<intent>"   # Denker
GRAPHCODE_LLM_MODEL=fast       npx @sigloch/graphcode run "<intent>"   # Coder
```

Das Zertifikat traegt `IP Address:127.0.0.1` als SAN — die Loopback-Adresse reicht, ein
Hosts-Eintrag fuer `sig-llm.local` ist nicht noetig.

## Modell

`FUNC-call-model` sagte "OpenAI-kompatibel oder Anthropic" und waere mit dem dritten Zweig
gedriftet. Beschreibung nachgezogen, `relation`-Kanten von `CR-GC-552` auf `FUNC-call-model`
und `FUNC-run-verb` gesetzt (graphVersion 302 → 303, fitAdvisory-Delta 0 auf allen sechs
Dimensionen — der Zweig verschiebt die Architektur nicht, er fuellt eine vorhandene Stelle).
