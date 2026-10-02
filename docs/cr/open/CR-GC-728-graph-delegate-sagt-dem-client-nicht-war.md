# CR-GC-728: graph_delegate sagt dem Client nicht, warum ein Lauf endete und was als Naechstes geht. Probe todo B4 (2026-10-02): nach fertigem Kern meldete der Executor stopReason stalled, 0 Zuege, 0 Token — offen waren nur die Eintrittspunkte der Analysen. Der Client (qwen3.8) hielt das fuer einen Ausfall des Modells und schickte fuenf weitere Auftraege mit genauen Kantenanweisungen; jeder endete gleich. Dazu: ein auftrag bei bestehendem Modell wird still verworfen (Intent nur in der Seed-Phase), der Client erfaehrt es nicht

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-710 (bug)
**Erstellt:** 2026-10-02
**Item:** bok/items/ITEM-2026-710.json (Lane: code)

---

## Befund

Probe `todo` B4 (2026-10-02, Client qwen3.8 medium, Executor qwen3-coder, Etappen von 10 Runden):

- Etappe 1 endete am Rundenbudget, Etappe 2 nach vier Runden mit `stopReason: stalled`.
- Der Client schickte danach fünf Aufträge mit genauen Kantenanweisungen. Jeder kam nach 20 ms zurück:
  `stalled`, 0 Züge, 0 Token. Offen waren nur noch die Eintrittspunkte der Analysen; `graph_generate` sagte
  das in seinem Prompt, `graph_delegate` gab es nicht weiter.
- Der Client schloss auf einen Ausfall des Modells („Der lokale LLM-Endpoint ist vermutlich nicht
  erreichbar“), prüfte Prozesse und wollte das Gateway mit dem Schlüssel abfragen.
- Der Auftragstext eines zweiten Auftrags wirkt nicht: der Executor liest ihn nur, solange das Modell in der
  Seed-Phase ist. Der Client erfuhr das nicht.

## Umsetzung

- `src/loop/generate.ts`: `GenerationStep` trägt in der Phase `stalled` die Felder `offeneTasks` (Analysen mit
  offenem Eintrittspunkt) und `offeneFunde` (zurückgestellte Fund-Fenster) — bisher nur im Prompt-Text.
- `src/loop/executor.ts`: `ExecutorStats.startPhase` (Phase der ersten Runde), `offeneTasks`, `offeneFunde`.
- `src/surface/delegate.ts`: `ergebnis.hinweis` aus `schlussHinweis` — je Stoppgrund ein Satz mit dem Aufruf, der
  weiterführt (`graph_delegate({task:"conops"})`, `graph_delegate({auftrag:"weiter"})`), oder der Aussage, dass
  keiner weiterführt; dazu der Satz, dass der Auftragstext nicht gelesen wurde, wenn der Lauf nicht in der
  Seed-Phase begann.

## Abnahme

`tests/delegate.test.ts`: Ende am Rundenbudget nennt den Fortsetzungs-Aufruf; `stalled` mit offenen Analysen
nennt den Task-Aufruf, ohne Analysen das Ende und die zurückgestellten Funde; ein nicht gelesener Auftrag
steht im Hinweis. `tests/executor.saturation.test.ts`: `startPhase` eines Laufs auf bestehendem Modell.

## Nicht in diesem CR

Dass der Executor einen Auftragstext auf bestehendem Modell **ausführt** (gezielte Änderung auf Zuruf des
Clients), ist eine neue Fähigkeit und nicht gebaut — ITEM-2026-711.

## Umfang laut Graph

`FUNC-graph-delegate`, `SCHEMA-generation-step`, `REQ-delegate-schluss-in-worten` (neu, verifiziert von
`TEST-delegate-in-host`). Fünf Dateien.
