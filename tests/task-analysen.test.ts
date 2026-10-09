/**
 * CR-GC-724 — Analyse-Tasks: das Vorbild der Runde kommt aus `TASK_CLAUSE`, und ob eine Analyse
 * stattgefunden hat, sagt das Artefakt im Graphen (`task-artifact.ts`), nicht ein Stempel allein.
 * Der eingebettete Executor, der den Task fuhr und den Stempel setzte, ist mit CR-GC-775 ausgelagert.
 *
 * Reale Persistenz (Disk-Kuzu im temp repoRoot), echtes Gate.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness, bindToolsToHarness } from '../src/index.js';
import { DEFAULT_METRIC_POLICY, type OntologyGraph } from '@sigloch/contracts/se';
import { generationStep } from '../src/loop/generate.js';
import { TASK_CLAUSE, alsTaskGraph } from '../src/loop/task-clause.js';
import { ANALYSE_TASKS, STEMPEL_ID, abschluss, artefakte, offen, type TaskGraph } from '../src/loop/task-artifact.js';
import { toOntologyGraph } from '../src/kernel/conformance.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';

/** Ein kleiner, gate-gültiger Kern: ein UC, eine Kette mit zwei Gliedern, eine REQ mit TEST, ein Modul. */
const KERN = [
  '## Nodes',
  '### SYS',
  '+ SYS-app|Ein System zum Prüfen der Analyse-Tasks. [__name:Test App]',
  '@analysisFreshness {"trade":{"graphVersion":1}}',
  '### UC',
  '+ UC-ablauf|Der Nutzer löst den Ablauf aus und erhält das Ergebnis. [__name:Ablauf]',
  '### FCHAIN',
  '+ FCHAIN-ablauf|Vom Auslöser zum Ergebnis. [__name:Kette Ablauf]',
  '### FUNC',
  '+ FUNC-lesen|Liest die Eingabe. [__name:Lesen]',
  '+ FUNC-liefern|Liefert das Ergebnis. [__name:Liefern]',
  '### MOD',
  '+ MOD-kern|Der Kern. [__name:Kern]',
  '### REQ',
  '+ REQ-liefern|Das System muss das Ergebnis liefern. [__name:Liefern]',
  '@kinds ["functional"]',
  '### TEST',
  '+ TEST-liefern|Ablauf auslösen und das Ergebnis prüfen. [__name:Test Liefern]',
  '',
  '## Edges',
  '+ SYS-app -compose-> UC-ablauf, MOD-kern',
  '+ UC-ablauf -compose-> FCHAIN-ablauf, REQ-liefern',
  '+ FCHAIN-ablauf -compose-> FUNC-lesen, FUNC-liefern',
  '+ FUNC-liefern -satisfy-> REQ-liefern',
  '+ FUNC-lesen -allocate-> MOD-kern',
  '+ FUNC-liefern -allocate-> MOD-kern',
  '+ TEST-liefern -verify-> REQ-liefern',
  '',
].join('\n');

/** Das Vorbild einer Klausel als Batch — Platzhalter gefüllt, wie ein Modell es täte. */
function vorbildAlsBatch(text: string): string {
  return (
    text
      .slice(text.indexOf('## Nodes'))
      .replace(/beispiel/g, 'echt')
      .replace(/«1–10»/g, '5')
      .replace(/«([^»]*)»/g, '$1') + '\n'
  );
}

describe('CR-GC-724: Analyse-Tasks', () => {
  let repoRoot: string;
  let harness: Awaited<ReturnType<typeof createHarness>>;
  let registry: MCPToolRegistry;

  const mutate = async (formatE: string): Promise<{ success: boolean; violations?: unknown }> =>
    (await registry['graph_mutate'].handler(registry['graph_mutate'].inputSchema.parse({ formatE, consumerId: 'test' }))) as {
      success: boolean;
      violations?: unknown;
    };
  const og = (): OntologyGraph => toOntologyGraph(harness.getGraph());
  const stempel = (): Record<string, { graphVersion: number }> =>
    (harness.getGraph().nodes.find((n) => n.type === 'SYS')!.attributes?.analysisFreshness ?? {}) as Record<
      string,
      { graphVersion: number }
    >;

  beforeEach(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'gc-task-'));
    harness = await createHarness({
      repoRoot,
      scope: { workspaceId: 'task', systemId: 'task' },
      consumerType: 'system',
      preCommitTimeout: 5000,
    });
    await harness.initialize();
    registry = bindToolsToHarness(harness);
    const kern = await mutate(KERN);
    expect(kern.success, JSON.stringify(kern.violations)).toBe(true);
  });

  afterEach(async () => {
    await harness.close();
    rmSync(repoRoot, { recursive: true, force: true });
  });

  describe('das Vorbild jeder Analyse geht durchs Gate und ergibt eine Einheit des Artefakts', () => {
    for (const task of ANALYSE_TASKS) {
      it(task, async () => {
        const vorher = new Set(artefakte(task, alsTaskGraph(og())));
        const text = TASK_CLAUSE[task].text(og());
        // Form ohne Fachinhalt und ohne den Stempel.
        expect(text).not.toMatch(/analysisFreshness|graphVersion|Stempel|graph_generate|Skill/);
        const res = await mutate(vorbildAlsBatch(text));
        expect(res.success, JSON.stringify(res.violations)).toBe(true);
        const neu = artefakte(task, alsTaskGraph(og())).filter((id) => !vorher.has(id));
        expect(neu.length, `${task}: das Vorbild erzeugt keine Einheit`).toBeGreaterThan(0);
      });
    }
  });

  it('Rundenprompt: im Treiber-Modus trägt der Task-Eintritt die Klausel, beim Host den Verweis auf den Skill', () => {
    const schritt = (selection: 'driver' | 'host') =>
      generationStep(harness.getGraph(), DEFAULT_METRIC_POLICY, undefined, 0.8, [], selection, null, 'fmea');
    const driver = schritt('driver');
    expect(driver.focusKey).toMatch(/:AF-04:/);
    expect(driver.prompt).toContain('Noch ohne Fehlermodus: FCHAIN-ablauf');
    expect(driver.prompt).toContain('+ FCHAIN-ablauf -satisfy-> REQ-risk-beispiel-a');
    expect(driver.prompt).not.toMatch(/Lade den Skill|graph_generate|analysisFreshness/);
    expect(driver.focusTypes).toEqual([...TASK_CLAUSE.fmea.types]);
    // Bestand nach Typ, nicht aus dem Kontext des SYS.
    expect(driver.focusElements).toEqual([]);
    const host = schritt('host');
    expect(host.prompt).toContain('Lade den Skill se-fmea');
    expect(host.prompt).not.toContain('REQ-risk-beispiel-a');
  });

  it('Kriterium: ein Stempel allein ist kein Artefakt, eine vollständige Einheit schon', () => {
    const leer: TaskGraph = alsTaskGraph(og());
    expect(artefakte('fmea', leer)).toEqual([]);
    expect(offen('fmea', leer)).toEqual(['FCHAIN-ablauf']);
    expect(abschluss('fmea', leer, new Set(), undefined).fertig).toBe(false);
    // Auch nach einer Runde ohne Ertrag: null Einheiten bleiben null.
    expect(abschluss('fmea', leer, new Set(), 0).fertig).toBe(false);
    // Risiko ohne Gegenmaßnahme zählt nicht.
    const halb: TaskGraph = {
      nodes: [...leer.nodes, { id: 'REQ-r', type: 'REQ', attributes: { role: 'risk' } }],
      edges: [...leer.edges, { source: 'FCHAIN-ablauf', type: 'satisfy', target: 'REQ-r' }],
    };
    expect(artefakte('fmea', halb)).toEqual([]);
    const ganz: TaskGraph = {
      nodes: [...halb.nodes, { id: 'REQ-m', type: 'REQ', attributes: { role: 'mitigation' } }],
      edges: [...halb.edges, { source: 'REQ-r', type: 'compose', target: 'REQ-m' }],
    };
    expect(artefakte('fmea', ganz)).toEqual(['REQ-r']);
    expect(offen('fmea', ganz)).toEqual([]);
    expect(abschluss('fmea', ganz, new Set(), undefined).fertig).toBe(true);
    // conops/irr: was vor dem Task schon da war, ist nicht der Ertrag des Tasks.
    // irr (CR-GC-754): die Einheit ist eine REQ mit verifizierendem TEST — ein CR zaehlt nicht, eine REQ ohne TEST auch nicht.
    const annahme: TaskGraph = {
      nodes: [...leer.nodes, { id: 'CR-alt', type: 'CR' }, { id: 'REQ-nackt', type: 'REQ' }, { id: 'REQ-alt', type: 'REQ' }, { id: 'TEST-alt', type: 'TEST' }],
      edges: [...leer.edges, { source: 'TEST-alt', type: 'verify', target: 'REQ-alt' }],
    };
    const bestand = new Set(artefakte('irr', leer));
    expect(abschluss('irr', annahme, new Set([...bestand, 'REQ-alt']), 0).fertig).toBe(false);
    expect(abschluss('irr', annahme, bestand, 0).einheiten).toEqual(['REQ-alt']);
  });

  // CR-GC-752 (contracts 11, CR-SM-395): der Bauplan ist die Menge der offenen Auftraege, kein Stempel.
  describe('CR-GC-752: der Bauplan setzt keinen Stempel — sein Ergebnis sind offene Auftraege', () => {
    const planFokus = () => generationStep(harness.getGraph(), DEFAULT_METRIC_POLICY, undefined, 0.8, [], 'driver', null, 'plan');

    it('es gibt fuer den Bauplan keinen Stempel-Schluessel; die vier Analysen behalten ihren', () => {
      expect(STEMPEL_ID).not.toHaveProperty('plan');
      expect(Object.keys(STEMPEL_ID).sort()).toEqual(ANALYSE_TASKS.filter((t) => t !== 'plan').sort());
      expect(Object.values(STEMPEL_ID)).not.toContain('implplan');
    });

    it('das Vorbild schreibt offene Auftraege — kein Stempel, der Eintritt ist damit geschlossen, der Task durch', async () => {
      // Vorher: es gibt Ungebautes ohne Auftrag — der Eintritt des Bauplans steht im Fokus.
      expect(planFokus().focusKey).toMatch(/:AF-05:/);
      const text = TASK_CLAUSE.plan.text(og());
      expect(text).toContain('@status open');
      // Das Vorbild geht durchs Gate — samt Meilenstein-Reihenfolge (`MS -relation-> MS [depends-on]`).
      const res = await mutate(vorbildAlsBatch(text));
      expect(res.success, JSON.stringify(res.violations)).toBe(true);
      expect(stempel()).not.toHaveProperty('implplan');
      const auftraege = harness.getGraph().nodes.filter((n) => n.type === 'CR');
      expect(auftraege.length).toBeGreaterThan(0);
      expect(auftraege.every((n) => n.attributes?.status === 'open')).toBe(true);
      // Der offene Auftrag schliesst den Eintritt: der Task meldet fertig, ohne dass jemand etwas stempelt.
      const danach = planFokus();
      expect(danach.done).toBe(true);
      expect(danach.prompt).toMatch(/Task plan fertig/);
    });

    it('ein Bauplan-Stempel von Hand schliesst den Eintritt NICHT — er wird nicht mehr gelesen', async () => {
      const res = await mutate(`## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness ${JSON.stringify({ ...stempel(), implplan: { graphVersion: 2 } })}\n`);
      expect(res.success, JSON.stringify(res.violations)).toBe(true); // ein Alt-Graph mit Stempel laedt und schreibt weiter
      expect(planFokus().focusKey).toMatch(/:AF-05:/);
    });

    it('der Skill se-plan stempelt nicht mehr und nennt den offenen Auftrag als Ergebnis', () => {
      const text = readFileSync(fileURLToPath(new URL('../.claude/commands/se-plan.md', import.meta.url)), 'utf8');
      expect(text).not.toMatch(/"implplan"\s*:/);
      expect(text).not.toContain('keep every entry already in `analysisFreshness`');
      expect(text).toContain('`status: "open"`');
      expect(text).toMatch(/sets \*\*no\*\* stamp/);
    });
  });

  it('CR-GC-735: ein Patch ersetzt analysisFreshness ganz — lesen, übernehmen, ganz schreiben hält alle', async () => {
    expect(Object.keys(stempel())).toEqual(['trade']);
    // Der Teil-Stempel, wie die Skills ihn bis CR-GC-735 nahelegten: trade geht verloren (todo-local, 2026-10-04).
    await mutate('## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness {"conops":{"graphVersion":2}}\n');
    expect(Object.keys(stempel())).toEqual(['conops']);
    // Lesen, übernehmen, ganz schreiben — der Weg der Skills.
    await mutate(`## Nodes\n### SYS\n~ SYS-app\n@analysisFreshness ${JSON.stringify({ ...stempel(), fmea: { graphVersion: 3 } })}\n`);
    expect(Object.keys(stempel()).sort()).toEqual(['conops', 'fmea']);
  });

  it('CR-GC-735: jeder Analyse-Skill mit Stempel schließt mit lesen, übernehmen, ganz schreiben', () => {
    // CR-GC-752: ohne se-plan — der Bauplan stempelt nicht (eigener Fall oben).
    for (const skill of ['se-conops', 'se-trade', 'se-irr', 'se-fmea']) {
      const text = readFileSync(fileURLToPath(new URL(`../.claude/commands/${skill}.md`, import.meta.url)), 'utf8');
      expect(text, skill).toContain('read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`');
      expect(text, skill).not.toMatch(/attributes\.analysisFreshness[.[]/);
    }
  });

  it('eine Entscheidung ist ein erledigter Auftrag: Analysen und Optimierung halten sich als CR in done/ fest', () => {
    // Ein Ort fuer den Text (docs/cr/done), ein schlanker Knoten, relation-Kanten auf das Geaenderte —
    // kein zweites Dokument unter docs/records, keine Etiketten an Kanten, keine Optionsknoten.
    for (const skill of ['se-conops', 'se-trade', 'se-irr', 'se-fmea', 'se/optimize']) {
      const text = readFileSync(fileURLToPath(new URL(`../.claude/commands/${skill}.md`, import.meta.url)), 'utf8');
      expect(text, skill).toContain('docs/cr/done/');
      expect(text, skill).toContain('status: "done"');
      expect(text, skill).toMatch(/`relation`/);
      expect(text, skill).not.toMatch(/Write `docs\/records\//);
      expect(text, skill).not.toMatch(/superseded-by|label: ?decides|architectureOnly|commitRef/);
    }
  });
});
