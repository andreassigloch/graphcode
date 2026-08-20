# @sigloch/graphcode

## Unreleased — Substrat auf zwei Schichten (CR-SM-248)

### Changed! — die Abhaengigkeitskette ist flach

Das Substrat war eine Kette der Tiefe 3 (`contracts → graph-api-core → graph-cypher-wasm`), und
`contracts/src` wird in **37 % aller Commits** angefasst (51 von 136 in 60 Tagen). Die
meistbewegte Schicht hatte damit den laengsten Nachlauf: ein contracts-Release war ein
3-Hop-Publish. Von 12 contracts-Releases waren **7 nicht-breaking** — fuer die war die gesamte
Kaskade ueberfluessig und kam allein aus der Deklarationsform.

Jetzt sitzt jedes Paket direkt auf `contracts`, keines auf einem Geschwister:

- `@sigloch/graph-cypher-wasm` ist **geloescht**, sein Inhalt liegt als Subpath
  `@sigloch/graph-api-core/kuzu` (**5.0.0**). `kuzu-wasm` ist dort eine *optionale*
  peerDependency — wer nur die Ontologie-Typen braucht (`/browser`), laedt kein WASM.
- `@sigloch/se-optimizer` + `@sigloch/se-steering` sind **geloescht**, zusammengefuehrt als
  `@sigloch/se-engine` (**1.0.0**).
- `@sigloch/contracts` ist in allen Paketen **peerDependency** statt dependency. Damit kann npm
  keine zweite Ontologie-Instanz nesten, und ein additives contracts-Release kostet **null**
  Downstream-Publishes.

Kein deprecated Re-Export, keine parallelen Pfade. Consumer-Umstellung ist ein Specifier je Zeile.
Der Paketname `graph-api-core` bleibt bewusst: ein Rename kostet gemessen 178 Import-Sites in acht
Repos und traegt null zur Struktur bei.

### Fixed — das Substrat wird genau einmal installiert

graphcodes Baum trug zwei `graph-api-core` und zwei `graphcode-client`, genestet unter
`graph-view-edit`, dessen Pins `^4.0.0`/`^0.10.0` die alleinige Ursache waren (behoben in gve
**0.5.0**). Jetzt liegt jedes Paket genau einmal im Baum.

### Added — der Waechter gegen die Doppelinstanz

`tests/distribution.test.ts` laeuft den installierten `@sigloch`-Baum rekursiv ab und verlangt:
keine Selbstreferenz, jedes Paket genau einmal. Die Defektklasse ist zweimal aufgetreten
(`contracts@5.0.0`, `graphify@0.2.0`) und ist unsichtbar fuer TypeScript wie fuer die Laufzeit —
strukturelle Typisierung bzw. keine Identitaetspruefung. Der Waechter hat den graphify-Fall beim
ersten Lauf gefunden.

### Intern

`tests/helpers/store.ts` ist die einzige Stelle in `tests/`, die den Store-Paketnamen kennt
(vorher 66 Testdateien).

## 0.15.0 — 2026-08-19

### Changed! — die vier Pflichten einer FUNC (CR-GC-366)

**Von den vier Pflichten einer FUNC waren nur zwei geprueft.** Zwei neue Regeln schliessen die
Luecke: **R-30** verlangt, dass eine FUNC in einer Wirkkette liegt (Mitgliedschaft erbt ueber
`FUNC-compose-FUNC` nach unten) — bisher verlangte R-15 nur die Gegenrichtung, weshalb IO-01 und
R-21 an Funktionen ausserhalb jeder Kette vorbeiliefen. **R-31** verlangt, dass eine FUNC per `io`
verdrahtet ist; nur ACTOR terminiert. R-02 prueft jetzt den Zieltyp und schwieg deshalb nicht mehr
bei `satisfy -> UC` (6 von 33 Befunden waren verdeckt).

**BREAKING:** das Pattern `FUNC -satisfy-> UC` entfaellt — ein zweiter, billigerer Weg zum UC, der
genau die Ketten-Pruefungen umging. Bestehende Graphen brauchen eine Migration: im Selbstmodell
wurden 26 solche Kanten durchs Gate geloescht (graphVersion 109 → 110, blockingErrors unveraendert
164 → 164, R-18 26 → 0). **On-Disk-Kuzu-Stores tragen das DDL der Ontologie, die sie angelegt hat**
— ein Store aus contracts 4.x meldet nach dem Update `Query node t violates schema`, bis er neu
angelegt ist.

Ein Regressionsfund aus derselben Aenderung ist mitgefixt: `buildContextSlice` folgte ausgehenden
`satisfy`-Kanten und haette eine FUNC nach dem Pattern-Wegfall ihren UC nicht mehr finden lassen —
also genau das gebrochen, was `graph_context` zusagt. Jetzt zwei typgebundene Rueckkanten ueber
`UC-compose-FCHAIN-compose-FUNC`; `MS-compose-FUNC` bleibt draussen, sonst verschwaende der
Unterschied zu `graph_impact`.

### Added — Job-Scheibe beim Task-Start (CR-GC-367)

`buildJobSlice()` loest einen CR-Anker auf seine `relation`-Ziele auf und bildet darueber die
Spec-Closure — ohne Blackbox-Ring, ohne CR/MS. `GET /context/:uid` stellt sie zu, der
`UserPromptSubmit`-Hook schiebt sie in den Agenten-Kontext. Anker ist ein exaktes uid aus dem
Prompt, nie ein Pattern: unbekanntes Token = No-op, kein Fuzzy-Match. Gegen die Spike-Ground-Truth
am echten Modell: 12/12 (CR-114) und 16/16 (CR-115) der real geaenderten Knoten, **1740 Token statt
~34k Prosa**.

### Fixed — zwei Ontologien in einem Baum

`@sigloch/contracts@5.0.0` deklarierte eine Abhaengigkeit auf sich selbst (`^4.1.0`), womit npm
eine zweite Ontologie-Instanz unter die erste legte (contracts 5.0.0 + 4.2.0, graph-api-core 3.2.0
+ 2.1.0 in einem Baum). Zur Laufzeit prueft nichts die Identitaet, TypeScript typt strukturell —
der Fehler war unsichtbar, bis man den Baum zaehlt. Behoben in `contracts@5.0.1`; graphcode zieht
die gesamte Substrat-Linie nach (contracts ^5, graph-api-core ^4, graph-cypher-wasm ^0.2.4,
graphcode-client ^0.10, se-optimizer ^0.6, se-steering ^0.7, graph-view-edit ^0.4).
Der strukturelle Nachlauf ist CR-SM-248.

## 0.14.0 — 2026-08-19

### Fixed — ein Host stirbt mit seiner Session (CR-GC-370)

**Elf MCP-Hosts liefen verwaist, fuenf davon drei Tage alt, und hielten die Store-Locks ihrer
Repos.** `serveStdio` hatte keinen Shutdown-Pfad: jede neue Session lief als Proxy eines laengst
geschlossenen Editors, ohne Dashboard. Jetzt raeumt **ein** `SessionLifecycle` auf Signale *und*
stdin-EOF rueckwaerts ab — Viewer, Bridge, `host.sock`, Store-Lock zuletzt, mit hartem Deckel,
damit ein haengender Store den Lock nicht behaelt.

### Added — Herzschlag im Store-Lock (CR-GC-372)

Der Eigentuemer stempelt seinen Lock alle 30 s (`utimes`, kein zerrissener Lesevorgang). Ein Lock
ohne Puls (> 90 s) gilt als frei — auch bei lebender PID und cross-host. Das entschaerft
PID-Wiederverwendung nach Reboot und haengende Hosts. Wird der Lock uebernommen, meldet der
Alteigentuemer `onLockLost` und beendet seine Session, statt als zweiter Schreiber weiterzulaufen.

### Added — das Dashboard wird beaufsichtigt, nicht nur gestartet (CR-GC-371)

Stirbt der Viewer mitten in der Session, startet `superviseGve` ihn neu (1 s / 3 s / 10 s, dann
Aufgabe mit ehrlicher Meldung; Budget-Reset nach 60 s stabiler Laufzeit). `stop()` beim Sessionende
unterdrueckt jeden Neustart. Start + Aufsicht liegen jetzt in `src/gve.ts`, `mcp-server.ts` faellt
von 473 auf 335 Zeilen.

### Added — `graphcode status` zeigt MEIN Dashboard (CR-GC-368)

Read-only-Bericht auf zwei Fragen: besitzt ein lebender Prozess den Store, und welcher Viewer
bedient *dieses* Repo? Die Adresse aus `docs/views/dashboard.url` wird nicht geglaubt, sondern per
`api/dashboard` auf Repo-Identitaet geprueft (`realpath` beidseitig) — ein Nachbar-Viewer auf
demselben Port meldet sich als „fremdes Repo", einer ohne `repoRoot`-Feld als „unbekannt".

### Changed — GVE als Dependency statt `npx -y` (CR-GC-369)

Der Viewer startet aus `node_modules`, mit dem node des Hosts (`process.execPath`): kein zweiter
Registry-Roundtrip beim Erststart, offline lauffaehig, Version an semver gebunden statt an
`latest`. Damit steigt `@sigloch/graph-view-edit` auf **^0.3.0** (stabiler Port je Repo).
`GRAPHCODE_GVE_BIN` / `GRAPHCODE_NO_GVE` unveraendert; eine nicht aufloesbare Dependency warnt und
laesst den Gate laufen.

## 0.13.0 — 2026-08-15

### Changed (BREAKING) — auf die Familie 4.x nachgezogen

**Jede bestehende `graphcode.config.jsonc` braucht vier Felder mehr.** `MetricPolicySchema` hat
seit contracts 4.0.0 `crossingFlows`, `riskRpn`, `moduleSize` und `apTable` als Pflichtfelder.
Fehlen sie, bricht der Start ab — das ist CR-GC-329s Fail-Fast, das korrekt anschlaegt, kein
neuer Defekt. Ein stiller Default waere die schlechtere Antwort.

```jsonc
"crossingFlows": { "warning": 3 },                          // vorher inline `count > 2`
"riskRpn": 100,                                             // FM-03, vorher inline
"moduleSize": { "large": 12, "coupled": 8, "crossings": 2 },// R-04, vorher 8/12/2 inline
"apTable": null                                             // gehoert NICHT in diese Datei
```

`apTable` bleibt `null`: die lizenzierte AIAG-VDA-Tabelle darf nicht in eine eingecheckte Datei.
Wer eine Lizenz hat, legt sie nach `.graphcode/ap-table.json` (gitignored).

### Changed — `testRefs` statt `testRef`: eine Abnahme, n Testdateien (CR-GC-338)

Die Ontologie hat das Attribut ersatzlos umbenannt (CR-SM-231). graphcode benutzt 1:n jetzt
wirklich, statt es nur zu akzeptieren:

- `graph_tests` nimmt **alle** Dateien einer Abnahme in den selektiven Lauf.
- `graph_export` scaffoldet **je Eintrag** einen Stub — sonst bliebe die zweite Datei ein Phantom.
- `graph_realize` **ergaenzt** einen Eintrag, statt die anderen zu ueberschreiben.
- `graph_test_ingest` schreibt `result`/`ranAt` **an den passenden Eintrag** (CR-SM-231b): ein
  Lauf ueber eine von zwei Dateien faerbt nur diese. „Einer rot, einer gruen" ist damit
  ueberhaupt erst darstellbar.
- Der Pruefreport aggregiert **streng**: jeder Eintrag muss `passed` sein; ein Eintrag ohne
  Ergebnis ist `not-run` — nicht gelaufen ist nicht gruen.

**Bestehende Graphen muessen migriert werden.** Ein Knoten mit `testRef` faellt R-19 zur Last,
und R-29 (neu, `error`) meldet jede Testdatei, die von zwei Abnahmen beansprucht wird.

### Changed — `weights` faellt aus `graph_next_step` (CR-GC-336)

Der D1–D6-Vektor wurde ausgegeben, aber niemand handelte auf ihm (CR-SM-237): er gewichtete
keinen Kandidaten und verschob keine Auswahl. Die Fokus-Dimension steht in `nextStep` — sie war
die einzige Information, die der Vektor je trug. Das Zielprofil-`weights` aus
`.graphcode/target-profile.json` ist eine andere Groesse und bleibt.

### Fixed — eine Zahl fuer „ist diese Dimension zu schwach?" (CR-GC-335)

`focusThreshold` aus der Config bekommt endlich seinen Konsumenten: `harness.getFocusThreshold()`
reicht ihn an `computeReadiness` und an die Fokuswahl durch. Der Default-Parameter
`threshold = 0.8` in `generate.ts` faellt, ebenso der Zod-Default im `graph_generate`-Schema —
der Override bleibt, sein Fallback ist jetzt der Config-Wert.

**Nachgemessen:** `ms` auf dem eigenen Graphen steigt von **0 %** (97 Verstoesse / 21 anwendbar)
auf **44 %** (97 / 172). Identische Verstoesse — nur der Nenner hat sich korrigiert (CR-SM-235).

### Added — R-29 im Hilfe-Katalog

Testdatei-Exklusivitaet, `error`: jede Datei gehoert zu hoechstens einem TEST. Eine doppelt
beanspruchte Datei macht Gate-Zahlen falsch — der TRR-Gate zaehlt dieselbe Evidenz doppelt.
