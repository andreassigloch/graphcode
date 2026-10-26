---
name: se:import-doc
version: 2
description: Dokument (PDF/Markdown/Text) zweistufig in den Graph importieren (»Struktur vor KI«) — Skelett zeigen, Typ-Entscheidungen im Chat, LLM-Extract durchs Apply-Gate; Merge (adds-only), nie Reseed
---

Der Dokument-Import-Pfad (CR-GC-337, graphify CR-GF-139): ein Chaos-Dokument (Manual, Datenblatt,
Lastenheft) wird **zweistufig** in den Graph gebracht. Stufe 1 ist deterministisch (0 LLM) und zeigt
das Gliederungs-Skelett; der Mensch entscheidet die Typ-Zuordnung **im Chat** (der MCP-Client ist das
UI); Stufe 2 extrahiert mit LLM und importiert durchs Apply-Gate.

## Wann dieser Zug richtig ist

- Ein governtes Dokument (PDF/md/txt) soll SE-Elemente (UC/REQ/MOD/FUNC …) in den Graph beitragen.
- Der bestehende Graph soll **erhalten** bleiben: der Import ist Merge (adds-only durchs Gate),
  nie Reseed — Gegensatz zu `se:import-code`.

**Nicht** der richtige Zug: TS-Codebasis → `se:import-code` (deterministisch, Reseed).

## Voraussetzungen

- Kein laufender MCP-Host auf demselben Store (sonst `StoreOwnershipError`).
- Ein OpenAI-kompatibler LLM-Endpunkt ist erreichbar (Env `LLM_BASE`, sonst der Default von graphify) und
  das Modell ist gesetzt: `LLM_MODEL=<modellname>`. Das Modell kommt nur aus der Umgebung (graphify ≥ 0.6,
  CR-GF-153); dieser Skill nennt und wählt keins (CR-GC-859).
- **Ist `LLM_MODEL` nicht gesetzt: vor Stufe 2 anhalten** und dem Nutzer sagen: „Setze `LLM_MODEL` auf das
  Modell deines LLM-Endpunkts (und `LLM_BASE`, wenn es nicht der Default von graphify ist) und starte
  Stufe 2 neu." Kein Modell raten, keins vorschlagen. Das Skript der Stufe 2 bricht in diesem Fall selbst
  ab, bevor es den Store öffnet.
- **Laufzeit-Warnung:** Stufe 2 slict das ganze Dokument
  durchs lokale LLM — bei großen Manuals Stunden (LLM-LOAD-PROFILE). Erst mit kleinen/mittleren
  Dokumenten arbeiten.
- `@sigloch/graphify` ≥ 0.6: `graphify_structure`-API (CR-GF-139), `verifies` an der
  TEST-Entscheidung samt `rejectedVerifies` (CR-GF-144) und das Modell nur aus der Konfiguration
  (CR-GF-153).
- PDF-Eingang braucht poppler `pdftotext` auf dem PATH.

## Stufe 1 — Skelett zeigen (deterministisch, 0 LLM)

Schreibe dieses Skript nach `.graphcode/tmp/import-doc-structure.mts` (im Repo — bare imports
lösen über die Repo-`node_modules`) und führe es vom Repo-Root aus:
`npx tsx .graphcode/tmp/import-doc-structure.mts <datei> [...]`

```ts
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { handleMcpStructure, pdfToText } from '@sigloch/graphify';

const files = process.argv.slice(2);
const read = (p: string): string => (extname(p).toLowerCase() === '.pdf' ? pdfToText(p) : readFileSync(p, 'utf8'));
const documents = files.map((p) => ({ id: basename(p), filename: basename(p), text: read(p) }));
console.log(JSON.stringify(handleMcpStructure({ documents }), null, 1));
```

Dann dem Nutzer **rendern** (kompakter Markdown-Baum, nicht das rohe JSON): pro Knoten
`number`/`name`, Einrückung nach `depth`, `blockTokens` als Größenindiz. Knoten ohne `name` sind
nicht adressierbar (vom Harvest gefiltert) — weglassen.

Dazu einen **Typ-Vorschlag** machen (Draft-Zuordnung nach Dokumenttyp, Familie-Heuristik:
Manual-Knoten = MOD-Anker, SYS nur komponentenübergreifend):

| Dokumenttyp | Gliederungsknoten → | Blocktext liefert → |
|---|---|---|
| Datenblatt | MOD (Baugruppe/Peripherie) | SCHEMA, REQ, FUNC |
| Betriebsanleitung | MOD-Anker, semantisch FUNC/UC | UC, REQ, MOD |
| Installationshandbuch | FCHAIN/UC (Ablauf) | REQ, MOD |
| Lastenheft/Spec | REQ-Gruppen | REQ, TEST |

Mit AskUserQuestion klären: (a) Dokumenttyp bestätigen, (b) abweichende Knoten-Typen, (c) Knoten
ausschließen, (d) **verify-Zuordnung**, sobald eine Entscheidung `type: "REQ"` trägt: welcher
Skelett-Knoten ist der TEST, der diese REQ deckt? Eine REQ ohne verify-TEST blockt das Gate
(R-01, REQ-with-test-Invariante). Liefert das Skelett keinen passenden Knoten, fragen: wird ein
Kapitel (z. B. „Abnahme") zum TEST, oder fällt die REQ heraus?

Ergebnis nach `.graphcode/tmp/decisions.json` schreiben:

```json
[
  {"node": "Ladesteuerung", "type": "REQ"},
  {"node": "Sicherheit", "type": "REQ"},
  {"node": "Abnahme", "type": "TEST", "verifies": ["Ladesteuerung", "Sicherheit"]},
  {"node": "Anhang", "exclude": true}
]
```

`node` und jeder Eintrag in `verifies` = Skelett-`name` **verbatim**; nur 13 SE-Typen aus
`@sigloch/contracts/se`. `verifies` steht nur an einer Entscheidung mit `type: "TEST"`, sonst
lehnt graphify die Datei ab. Jeder Eintrag wird zur Kante `TEST -verify-> <node>`.

## Stufe 2 — Extract + Import durchs Gate

Skript nach `.graphcode/tmp/import-doc-run.mts`, Decisions-JSON daneben, dann vom Repo-Root:
`npx tsx .graphcode/tmp/import-doc-run.mts .graphcode/tmp/decisions.json <datei> [...]`:

```ts
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { handleMcpExtract, pdfToText, LMStudioClient, McpConsumerGate } from '@sigloch/graphify';
import { commandsToFormatE } from '@sigloch/graph-api-core';

// CR-GC-859: das Modell kommt nur aus der Konfiguration (LLM_MODEL), nie aus diesem Skript.
const model = process.env.LLM_MODEL;
if (!model) {
  console.error('Kein LLM-Modell konfiguriert: setze LLM_MODEL auf das Modell deines LLM-Endpunkts (LLM_BASE) und starte Stufe 2 neu.');
  process.exit(2);
}

const repoRoot = process.cwd();
// Member-Repo: Paket aus node_modules; graphcode-Dev-Repo selbst: dist-Fallback.
const gc = await import('@sigloch/graphcode').catch(() => import(join(repoRoot, 'dist/index.js')));

const [decisionsPath, ...files] = process.argv.slice(2);
const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8'));
const read = (p: string): string => (extname(p).toLowerCase() === '.pdf' ? pdfToText(p) : readFileSync(p, 'utf8'));
const documents = files.map((p) => ({ id: basename(p), filename: basename(p), text: read(p) }));

// Member-Name wie graphcode mcp (package.json-Name, unscoped, sanitisiert; Fallback Verzeichnisname).
const member = ((): string => {
  try {
    const n = String(JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).name ?? '');
    const u = n.includes('/') ? n.slice(n.lastIndexOf('/') + 1) : n;
    return u.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^-+|-+$/g, '') || basename(repoRoot);
  } catch { return basename(repoRoot); }
})();

const harness = await gc.createHarness({ repoRoot, scope: { workspaceId: member, systemId: member } });
await harness.initialize();
try {
  if (harness.getGraph().nodes.length === 0) { try { await harness.seedFromJson(); } catch { /* Erstlauf */ } }
  const registry = gc.bindToolsToHarness(harness);
  const transport = async (commands: unknown[]) => {
    // Leerer Store: der Batch braucht den SYS-Anker (R-18) — wie import-code ensureSys, nie Overwrite.
    // Anders als import-code kann der Doc-Pfad selbst ein SYS extrahieren (z.B. "Wallbox-Ladestation")
    // — auch add-node mit type SYS zaehlt, sonst legt ensureSys ein zweites SYS an (Live-Lauf 2026-08-31).
    const hasSys = harness.getGraph().nodes.some((n: any) => n.type === 'SYS') ||
      (commands as any[]).some((c) => c.op === 'add-node' && (String(c.node?.uid ?? '').startsWith('SYS-') || c.node?.type === 'SYS'));
    const ensureSys = hasSys ? [] : [{ op: 'add-node', node: { uid: `SYS-${member}`, type: 'SYS', name: member, description: '', attributes: { status: 'draft' } } }];
    // graph_mutate nimmt nur Format-E (graphcode ≥ 0.27): die Kommandos als Text, Typen aus dem Bestand.
    const typ = new Map(harness.getGraph().nodes.map((n: any) => [n.uid, n.type]));
    const formatE = commandsToFormatE([...ensureSys, ...commands] as any, (u: string) => typ.get(u));
    // CR-GC-860: je Befund ein Element nur im Format `full` (MutateResultSchema in contracts); der
    // Default `summary` faltet je Regel in `elements` und schreibt die uid als `{el}` in die Meldung.
    const res = await registry['graph_mutate'].handler({ formatE, consumerId: 'import-doc', violations: 'full' });
    return { success: res.success, tier: res.tier, violations: (res.violations ?? []).map((v: any) => ({
      ruleId: v.ruleId, severity: v.severity, elementId: v.elementId ?? '', message: v.message,
      ...(v.fixHint !== undefined ? { fixHint: v.fixHint } : {}) })) };
  };
  const r = await handleMcpExtract(
    { documents, decisions, bundleId: `import-doc-${new Date().toISOString().slice(0, 10)}` },
    { client: new LMStudioClient({ model }), gate: new McpConsumerGate(transport) },
  );
  let exportPath: string | undefined, exportError: string | undefined;
  try { exportPath = ((await registry['graph_export'].handler({})) as any)?.graphJson?.path; }
  catch (e) { exportError = e instanceof Error ? e.message : String(e); }
  console.log(JSON.stringify({
    status: r.importResult.status, candidates: r.candidateCount,
    autoApprove: r.autoApprove, review: r.review,
    applied: { nodes: r.importResult.appliedNodesCount, edges: r.importResult.appliedEdgesCount },
    violations: r.importResult.violations, rejectedVerifies: r.rejectedVerifies, exportPath, exportError,
  }, null, 1));
} finally { await harness.close(); }
```

## Ergebnis deuten

- `tier`/`violations` sind das **governte Gate-Verdict** — Warnings (z. B. FUNC ohne satisfy) sind
  Arbeitsvorrat für die Absichtsebene, kein Importfehler. Blockt das Gate: nichts wurde geschrieben.
- `rejectedVerifies` (`[{test, target, reason}]`) sind verify-Zuordnungen, die keine Kante wurden:
  das Ziel ist kein Kandidat, oder das Paar ist illegal (das Ziel wurde nicht REQ). Jeden Eintrag
  dem Nutzer zeigen und die Zuordnung in Stufe 1 korrigieren lassen. Eine REQ, deren einzige
  Zuordnung hier steht, hat keinen verify-TEST.
- `graph_export` committet den Stand (kanonischer Sync-Pfad); `exportError` berichten, nicht crashen.
- Dem Nutzer melden: Status, Kandidaten (auto/review), applied nodes/edges, Top-Violations,
  `rejectedVerifies`.

## Grenzen (v1) + Recovery

- Eine Decision wirkt auf den **Skelett-Knoten-Kandidaten** (Typ/Ausschluss). Block-Vererbung
  (Typ-Prior für Funde im Block, block-scoped Windows) kommt mit dem `proseWindows`-Umbau (offen).
- Merge ist adds-only: bestehende Knoten werden nie gelöscht. Rückbau: `graphcode rewind <ref>`
  (CR-GC-311) oder gezielte delete-Kommandos via `graph_mutate`.
