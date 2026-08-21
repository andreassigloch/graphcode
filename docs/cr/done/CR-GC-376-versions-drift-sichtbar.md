# CR-GC-376 — Was angezeigt wird, ist was läuft: Versions-Drift in `graphcode status`

**Status:** done · **Angelegt:** 2026-08-20 · **Geschlossen:** 2026-08-21

## Problem

Die Versionsanzeige kann etwas anderes behaupten als das, was tatsächlich läuft. Real
beobachtet in `graphcodedemo` am 2026-08-20:

| Startweg | Build | Ontologie / Rules |
|---|---|---|
| `graphcode mcp` im Terminal (globales Paket) | 0.15.0 | 7.0.0 / 4.0.0 |
| Agent-Session über `.mcp.json` | **0.13.2** (Repo-`node_modules`) | **6.0.0 / 2.28.0** |

Ursache ist `npx`: `.mcp.json` startet `npx -y @sigloch/graphcode mcp`, und `npx` nimmt
den **lokalen** Bin zuerst. Verifiziert — die Usage aus dem Demo-Repo kennt das Verb
`status` gar nicht, das es seit 0.14 gibt. Das Dashboard zeigt jeweils die Zahlen des
Prozesses, der gewonnen hat; welcher das war, sagt keine Anzeige.

Zweite Quelle derselben Klasse: ein Host lebt mit dem Code, mit dem er gebootet hat.
Nach einem Update im selben Repo tippt der Mensch eine neue Version, während der alte
Host weiter den Store besitzt (bekannt aus dem Fall „stale MCP-Server macht View-CRs
still rückgängig").

`graphcode update` schließt die Lücke **nicht** und kann es nicht: es refresht
Artefakte und schreibt den Dep-Range der Version, **die es gerade ausführt** — es ruft
kein `npm install` (kein `execSync`/`spawnSync` in `scaffold.ts`) und startet keinen
Host neu. In einem Repo mit altem lokalem Install führt `npx … update` also den **alten**
Build aus und zementiert dessen Range.

## Ziel

```
  Version     OK             CLI 0.16.0 · Host 0.16.0 · Repo 0.16.0
  Version     Drift          CLI 0.16.0 · Repo 0.13.2 → npm i @sigloch/graphcode@0.16.0
  Version     Drift          CLI 0.16.0 · Host 0.13.2 · Repo 0.16.0 → Host neu starten (graphcode mcp)
  Version     unbekannt      CLI 0.16.0 → Host neu starten — sein Build stempelt seine Version nicht in den Lock
```

Drei lokal lesbare Zahlen, eine Zeile, **eine** nächste Aktion:

- **CLI** — die eigene `package.json` (der Build, der den Bericht schreibt),
- **Host** — Stempel im `.graphcode/owner.lock` (der Build, der den Store besitzt),
- **Repo** — `node_modules/@sigloch/graphcode` (der Build, den die nächste
  Agent-Session bootet).

Ziel der Aktion ist die **höchste vorhandene** Zahl. Reihenfolge nicht kosmetisch: der
Repo-Install zuerst, weil er das ist, was der Agent bootet; dann der Host (Neustart,
keine Installation); zuletzt das globale CLI. Der **fehlende Stempel kommt ganz zuletzt**:
solange eine bekannte Zahl hinterherhinkt, ist deren Fix die nützlichere Aktion — ein
Neustart würde sonst im Extremfall genau den alten Repo-Install hochfahren. Drift setzt `statusIsHealthy` auf false
(Exit 1) — eine angezeigte Version, die nicht die laufende ist, ist derselbe Defekt wie
ein Dashboard, das ein fremdes Repo zeigt.

**Kein Netz.** „Gibt es in der Registry etwas Neueres" ist eine andere Frage — mit
Timeout, Offline-Verhalten und Cache — und liegt als Entwurf im Graphen
(`FUNC-search-updates`, allocate → `MOD-cli`, nicht realisiert). Ein Verb, das immer
antworten muss, hängt nicht an einem Proxy.

## Änderungen

| Datei | Was |
|---|---|
| `src/package-version.ts` | **neu** — der eine Leser der eigenen Version (Move aus `mcp-server.ts`) |
| `src/mcp-server.ts` | liest aus dem neuen Modul, re-exportiert `readPackageVersion` (kein Parallelpfad) |
| `src/store-lock.ts` | `LockOwner.version` — der Owner stempelt seinen Build |
| `src/status.ts` | `VersionStatus` + Zeile + Exit-Code |
| `tests/status.test.ts` | 8 Fälle: gleich, Repo alt, Host alt, Stempel fehlt, Stempel fehlt UND Repo alt, nur CLI, numerischer Vergleich (0.9.0 < 0.10.0), Repo neuer |
| `tests/store-lock.test.ts` | 1 Fall: der Lock trägt wirklich `readPackageVersion()` — sonst ist die Host-Zahl unbelegt |

Sechs Dateien, davon zwei Tests. `scaffold-templates.packageVersion()` bleibt vorerst
ein zweiter Leser — er beantwortet eine andere Frage (Dep-Range beim Scaffold) und
zusammenzulegen hieße, `scaffold-templates.ts` in diesen CR zu ziehen. **Offen**, bewusst.

## Nicht in diesem CR

- **`FUNC-search-updates`** (Registry-Abfrage) — Entwurf im Graphen, Realisierung offen.
  Vor der Umsetzung zu entscheiden: eigenes Verb oder Flag, Cache-Dauer, Verhalten ohne
  Netz, ob die Peers (`contracts`, `graph-view-edit`) mitgeprüft werden.
- **`graphcode update` installiert nicht** — es könnte nach dem Scaffold ein
  `npm install @sigloch/graphcode@<latest>` fahren; das ist eine eigene Entscheidung
  (Update-Verb mit Netz-Nebenwirkung), kein Anhängsel dieses CR.
- **Demo-Repo aufräumen** (`graphcodedemo`: Install auf 0.13.2, tote Pakete
  `se-optimizer`/`se-steering`/`graph-cypher-wasm` im Baum) — eigene Aufgabe im
  anderen Repo.

## Akzeptanzkriterien

- [x] `status` nennt CLI-, Host- und Repo-Version, sobald sie existieren
- [x] Drift → genau eine nächste Aktion, Ziel ist die höchste vorhandene Version
- [x] Lock ohne Stempel = `unbekannt`, nicht „gleich"
- [x] Drift → Exit 1
- [x] Versionsvergleich numerisch je Stelle (0.9.0 < 0.10.0)
- [x] Keine Registry-Abfrage, kein Netz im Status-Pfad
- [x] `npm run build` + Gesamtsuite grün (105 Dateien / 817 Tests, Stand vor der letzten Umsortierung)
- [x] Realer Smoke: `graphcodedemo` meldet `Drift … Repo 0.13.2 → npm i @sigloch/graphcode@0.16.0`, Exit 1
