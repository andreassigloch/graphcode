# CR-GC-769: Scaffold stellt OpenCode auf den eingefrorenen Executor-Weg; Executor-Pfad ist nirgends als geparkt gekennzeichnet

**Status:** ✅ Done (2026-10-09)
**Typ:** aus Item ITEM-2026-799 (finding)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-799.json (Lane: code)

---

## Befund

Seit 2026-10-03 schreibt auch der lokale Client (OpenCode + qwen3.8 mit Denkstufe) direkt durchs Gate; der
Executor im Host ist eingefroren (Entscheid des Autors). Belegt in der OpenCode-Datenbank: letzte Delegation
2026-10-02, danach nur noch `graph_mutate`; der Energy-Manager-Lauf lokal vom 2026-10-09 hat 39 Schreibzüge,
alle direkt.

Der Code bildet noch den Stand vom 2026-09-28 ab:

- `opencodeConfigContent` schreibt `GRAPHCODE_CLIENT_LLM=local` in jede neue `opencode.json`. Das Profil
  `local` bietet nur `graph_delegate` und drei Leser und verweigert ohne `executor`-Abschnitt den Start. Ein
  frisch aufgesetztes lokales Repo landet also auf dem eingefrorenen Weg.
- Nirgends steht, dass der Executor-Weg geparkt ist: nicht im Code, nicht im README, nicht im Modell.

Der direkte lokale Weg läuft heute nur, weil die Rig-Vorlage von Hand auf `cloud` steht.

## Entscheid des Autors (2026-10-09)

Executor-Weg **als geparkt kennzeichnen**, nicht streichen. Scaffold korrigieren.

## Umfang

| Datei | Änderung |
|---|---|
| `src/surface/scaffold-templates.ts` | `opencode.json` bekommt `cloud` wie `.mcp.json` |
| `src/surface/tool-profile.ts` | Kopfkommentar: Profil `local` ist geparkt, mit Datum und Grund |
| `README.md` | Abschnitt zur Variable: beide Hosts direkt; `local` als geparkter Weg |
| `tests/cli.scaffold.test.ts`, `tests/mcp.tool-profile.test.ts` | Erwartung der Voreinstellung |
| Modell | Beschreibung an `FUNC-tool-profile`, `FUNC-graph-delegate`, `FUNC-run-executor`: geparkt seit 2026-10-03 |

## Nicht in dieser CR

- **Bestehende Repos.** `update` erhält einen vorhandenen Wert (`keptEnv`), also auch das alte `local`. Ein
  früher gescaffoldeter Wert ist von einem bewusst gesetzten nicht zu unterscheiden; stillschweigend umstellen
  wäre ein Fallback. Betroffen (Wert `local`, kein `executor`-Abschnitt): energymanager, sigllm, bok, sirail,
  siconizer, sigloch-modules, graphcodedemo, KPI_dashboard, test_karp, test_local, MessageRouter,
  graphify-harness. Umstellen von Hand oder eigener Befund.
- **Die Werte heißen weiter `cloud` und `local`.** Sie benennen inzwischen den Schreibweg, nicht die Art des
  Modells. Umbenennen bricht jede vorhandene Host-Konfiguration und ist eine eigene Entscheidung.
- **Der Schnitt der Steuerungsschleife im Modell** (eine Kette Führung von außen, Executor-Teil getrennt) —
  eigener Befund.

## Akzeptanz

- Rot zuerst: `init` in einem leeren Repo schreibt `cloud` in `opencode.json`.
- Ein von Hand gesetztes `local` überlebt `update`; das Profil `local` selbst arbeitet unverändert.
- README, Kopfkommentar und die drei Modellknoten nennen den Weg geparkt, mit Datum.
- `npm run verify:code` und `npm run verify:full CR-GC-769`.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
