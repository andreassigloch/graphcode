# CR-GC-270: `SERVER_VERSION` aus `package.json` lesen statt hartkodieren

**Status:** Open (2026-07-27) · **Max Files:** 4
**Herkunft:** Frisch-Repo-Test gegen den publizierten Stand 2026-07-26/27.

## Problem (Why)

Der MCP-Handshake des publizierten `@sigloch/graphcode@0.5.0` meldet
`serverInfo.version = "0.4.1"`. Verifiziert nicht an der Quelle, sondern am Artefakt:
`~/.npm/_npx/*/node_modules/@sigloch/graphcode/dist/mcp-server.js` enthält `SERVER_VERSION = '0.4.1'`
bei `package.json` = `0.5.0`.

Ursache ist ein Literal in [`src/mcp-server.ts`](../../src/mcp-server.ts), das bei jedem Release von
Hand nachgezogen werden muss. Beim 0.5.0-Release ist das unterblieben — wie es Handpflege eben tut.

**Impact:** Bricht nichts. Macht aber jede Support-Frage irreführend, weil die einzige Stelle, an der
ein Nutzer die laufende Version sieht, die falsche nennt. Bei einem Paket, dessen Consumer per
`npx -y` immer `latest` ziehen, ist „welche Version läuft bei dir?" die erste Diagnosefrage.

**Warum es überhaupt ein Literal war** (der Kommentar im Code sagt es): ein `import pkg from
'../package.json'` liegt außerhalb von `rootDir` und bricht `tsc`. Das ist ein echter Constraint —
der Fix darf ihn nicht ignorieren, sondern muss ihn umgehen.

## Design

**Zur Laufzeit lesen, nicht importieren.** `readFileSync` auf den relativ zu `import.meta.url`
aufgelösten Pfad — kein JSON-Import, also kein `rootDir`-Problem, und kein Build-Schritt, der eine
generierte Datei erzeugt (die wieder driften könnte).

`dist/mcp-server.js` und `src/mcp-server.ts` liegen beide **eine** Ebene unter der Paketwurzel, der
Pfad `../package.json` stimmt also in beiden Welten — publiziert wie im Dev-Baum.

**Kein Fallback.** Fehlt `package.json`, wirft der Server beim Start mit klarer Meldung, statt eine
geratene Version zu melden. Ein stiller Default wäre exakt der Fehler, den dieser CR beseitigt: eine
Versionsangabe, der man nicht trauen kann. `package.json` ist in jedem npm-Install vorhanden.

**Erzwungen, nicht dokumentiert.** Ein Test vergleicht die vom Server gemeldete Version mit der aus
`package.json`. Damit kann die Drift nicht zurückkommen — sie wird rot, nicht übersehen.

## Dateien (4)

- `src/mcp-server.ts` — Literal raus, Read rein
- `tests/distribution.test.ts` — Assertion Handshake-Version == `package.json`-Version
- `package.json` — Bump auf 0.5.1
- dieser CR

## Akzeptanzkriterien

- [ ] `npm run type-check` grün
- [ ] Volle Suite grün (Basis: 314/314)
- [ ] Neuer Test schlägt fehl, wenn man die Version wieder hartkodiert
- [ ] Nach dem Publish meldet der Handshake im frischen Repo 0.5.1
