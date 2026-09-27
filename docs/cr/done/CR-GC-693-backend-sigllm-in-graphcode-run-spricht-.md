# CR-GC-693: Backend 'sigllm' in graphcode run spricht das entfernte sigllm-Format (/v1/inference, Profile, keine temperature) — löschen; sigllm = backend openai|anthropic + GRAPHCODE_LLM_API_KEY + NODE_EXTRA_CA_CERTS

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-588 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-588.json (Lane: code)

---

## Befund

`graphcode run` fuehrte seit CR-GC-552 ein drittes Backend `sigllm`: POST `/v1/inference`, Token im
Body, `GRAPHCODE_LLM_MODEL` als Profilname (`fast|reasoning`), keine temperature/max_tokens,
Best-of-N gesperrt. Das sigllm-Gateway spricht dieses Format nicht mehr; es nimmt die openai- bzw.
anthropic-Drahtform mit API-Key. Der Zweig war toter Code mit eigener Env-Variable
(`GRAPHCODE_LLM_TOKEN`), eigener Nachrichtenuebersetzung und eigenem Antwortschema. Der Rig faehrt
das Gateway laengst ueber `GCRUN_BACKEND=openai` (`lauf-gcrun-qwen38.env`: Token als API-Key,
CA ueber `NODE_EXTRA_CA_CERTS`).

## Zielbild

sigllm ist kein Backend, sondern ein Endpunkt: `GRAPHCODE_LLM_BACKEND=openai|anthropic`,
`GRAPHCODE_LLM_API_KEY`, `NODE_EXTRA_CA_CERTS`. Der Zod-Enum kennt `sigllm` nicht mehr — kein
Alias, keine Sondermeldung; `GRAPHCODE_LLM_BACKEND=sigllm` scheitert an der Config-Validierung.

## Umfang — 8 Dateien

| Datei | Aenderung |
|---|---|
| `src/loop/executor.ts` | `backend: z.enum(['openai','anthropic'])`, Feldkommentare ohne Profil/Token |
| `src/loop/executor-backend.ts` | sigllm-Zweig, `ulid`, `toSigllmMessages`, `SigllmAnswer` geloescht |
| `src/surface/run-verb.ts` | `GRAPHCODE_LLM_TOKEN` und die sigllm-Pflichtpruefung geloescht; Usage nennt den Gateway-Weg |
| `src/loop/model-answer-contract.ts` | Kommentar: das Gateway meldet `length` (openai-Draht) |
| `README.md` | `run`-Zeile: zwei Backends, Gateway-Weg |
| `tests/executor.sigllm.test.ts` | geloescht (pruefte nur den entfernten Zweig) |
| `tests/executor-config-contract.test.ts` | zwei Backends geschlossen; sigllm = openai + API-Key; `sigllm` abgewiesen; `GRAPHCODE_LLM_TOKEN` kein Zugang |
| diese Datei | |

Im Graphen (`docs/graph`) haengt kein Knoten am entfernten Zweig (keine uid, kein testRef auf
`executor.sigllm.test.ts`, kein `SCHEMA-inference-response`) — kein Modell-Zug noetig.

## Akzeptanz

- [x] Rot zuerst: `backend: 'sigllm'` wurde angenommen (Vertragstest rot)
- [x] Kein `'sigllm'`-Backend, kein `GRAPHCODE_LLM_TOKEN`, kein `/v1/inference` mehr in `src/`
- [x] Rig-Envs unveraendert gueltig (alle `GCRUN_BACKEND=openai`)
- [x] `npm run build` gruen; 24 Testdateien (Importeure von executor/executor-backend/run-verb/model-answer-contract) gruen

## Ergebnis

Ein Pfad weniger: zwei Draht-Formen, das Gateway ist Konfiguration. Wer noch
`GRAPHCODE_LLM_BACKEND=sigllm` setzt, bekommt den Zod-Fehler mit den erlaubten Werten.
