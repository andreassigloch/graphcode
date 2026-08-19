# CR-GC-367 — Graph-Scheibe beim Task-Start injizieren (Push, kein Pull)

**Status:** done (2026-08-19)
**Datum:** 2026-08-19
**Ersetzt:** `CR-DRAFT-GC-361-hook-graph-slice-injektion` (PreToolUse auf `Grep|Glob`).
Umnummeriert wegen Kollision mit `CR-GC-361-ranking-sieht-duplikate`.
**Grundlage:** `docs/spikes/SPIKE-GC-minimal-whitebox-RESULTS.md`

## Was sich gegenüber dem Draft ändert — und warum

| | Draft (verworfen) | Dieser CR |
|---|---|---|
| Aufhänger | `PreToolUse` auf `Grep\|Glob`, eine Scheibe **pro Tool-Call** | **Task-Start** (`UserPromptSubmit`), eine Scheibe **pro Job** |
| Seed | Grep-Pattern → uid **auflösen** (offener Entwurfspunkt) | uid **steht im Prompt** („implementiere CR-GC-366") — exakter Lookup |
| Inhalt | „passende Scheibe" (undefiniert) | `graph_context`-Closure, **ohne** Blackbox-Ring, CR/MS gefiltert |

Der Draft wollte ein Pattern, das auf **Dateiinhalt** zielt, gegen **Knotennamen und
-beschreibungen** matchen — unscharfe String-Suche über Prosa, also genau das Verfahren, das
R12 ersetzen soll. Der Job-Knoten macht das Problem gegenstandslos: uids sind explizite Token
(`CR-GC-366`, `FUNC-serve-sse`), der Abgleich ist ein **Set-Lookup gegen die uid-Menge**, keine
Ähnlichkeitssuche. Kein uid im Prompt ⇒ No-op.

## Belege aus dem Spike

- **Push, nicht Pull.** Mit `graph_context`/`graph_impact`/`graph_expand` im Angebot rief das
  Modell sie **4×** bei über **400** Tool-Calls auf. Eine Scheibe, die der Agent selbst holen
  soll, wird nicht geholt.
- **Inhalt = Arm B** (Whitebox ohne Ring): deckt **12/12** bzw. **16/16** der Knoten, die die
  Schluss-Commits von CR-GC-114/115 real geändert haben — der heutige Voll-Index trifft 42 %.
  Größe 1,6–3,2k Token (CR/MS gefiltert), `\|W\|/\|G\|` = 3–5 %.
- **Der Ring ist Ballast:** ~60 % seiner Knoten sind CR-Historie, 0 davon wurden geändert.

## Nicht verhandelbar

- **Kein zweites Kuzu-Handle** (ein Owner-Prozess pro Repo). Der Hook liest über die
  bestehende read-only Host-Bridge (`src/viewer/host.ts`, Loopback). Dafür **ein** neuer
  read-only Endpoint `GET /context/:uid` — die Closure rechnet der Host, nicht der Hook.
- **Bridge nicht erreichbar ⇒ Exit 0, keine Ausgabe.** Nie Exit 2; Blocken ist den
  Deny-Hooks vorbehalten.
- **Keine Zeile „nicht erneut aufrufen".** Gemessen (qwen3.6-35b): mit dieser Zeile fallen die
  Lese-Calls des Modells von 77 auf 3. Sie ist die einzige streuungsarm belegte Nebenwirkung
  der Injektion — Inhalt liefern, Lesen nicht verbieten.

## Dateien (≤ 6)

- `.claude/hooks/inject-graph-slice.sh` (neu)
- `.claude/settings.json` (Hook-Registrierung)
- `src/viewer/host.ts` (`GET /context/:uid`, read-only)
- `tests/hooks.inject-graph-slice.test.ts` (neu)

## Akzeptanzkriterien

- [ ] Prompt mit bekanntem uid → Format-E-Scheibe auf stdout, Exit 0; Prompt ohne uid → keine
      Ausgabe, Exit 0
- [ ] Unbekanntes uid-artiges Token (`CR-GC-999`) → No-op, **kein** Fuzzy-Match
- [ ] Scheibe = `graph_context`-Closure ohne Ring, CR/MS gefiltert; für `CR-GC-114` enthält sie
      alle 12 real geänderten Knoten (Regressionstest gegen die Spike-Ground-Truth)
- [ ] Bridge aus → Exit 0, keine Ausgabe; Unit-Test belegt **kein** zweites Kuzu-Handle
- [ ] Schalter `GRAPHCODE_HOOK_INJECT`, Test beide Richtungen
- [ ] `npm run build` + Tests grün

## Umsetzung (2026-08-19)

Implementiert wie entworfen; zwei Punkte, die erst beim Bauen sichtbar wurden:

- **Port:** der Draft nannte 4317 — das ist der GVE-Viewer. Die read-only Bridge startet nur,
  wenn `GRAPHCODE_HOST_PORT` gesetzt ist (`maybeStartBridge`), und genau dort. Der Hook liest
  dieselbe Variable; kein Port ⇒ keine Bridge ⇒ kein Inject.
- **Testfalle:** `spawnSync` blockiert die Event-Loop, die Bridge im selben Prozess nimmt die
  Verbindung nie an, der Hook läuft in sein curl-Timeout und schweigt korrekt. Der Test spawnt
  deshalb asynchron; der Grund steht als Kommentar im Test.

Regression gegen die Spike-Ground-Truth (echtes Selbstmodell, 555 Knoten): `buildJobSlice`
liefert für CR-GC-114 **12/12** und für CR-GC-115 **16/16** der real geänderten Knoten,
0 CR/MS im Slice, 16 bzw. 26 Knoten (< 5 % des Graphen). Live gemessen: 1740 Token für
CR-GC-114. Volle Suite grün (808 Tests).

Offen geblieben (→ CR-GC-368): 18 % der Scheibe sind Provenienz-Stempel
(`created_at`/`updated_at`/`ranAt`, `weight:1`), die für „implementiere das" nichts tragen.

## Was dieser CR NICHT entscheidet

Ob Injektion die **Ausbeute** verbessert. Arm C konnte das nicht messen: zwei Läufe derselben
Bedingung lieferten 35 und 101 Elemente — die Wiederholungs-Streuung übersteigt jeden
Arm-Unterschied. Belegt ist die **Deckung** der Scheibe (deterministisch gerechnet, Phase 1),
nicht ihr Ertrag im Autorier-Loop. `CR-GC-297` bleibt davon unberührt gesperrt.
