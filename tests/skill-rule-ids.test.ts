/**
 * CR-GC-571 — Smeagol-Check Stufe (a): jede in einem Skill oder Rundenprompt genannte
 * Regel-ID steht im Katalog.
 *
 * Befund: `se:author-uc` behauptete *"a UC with no `compose` raises R-14"*. **R-14 gibt es
 * nicht** — die Regel wurde mit CR-SM-294/295 gestrichen, der Satz blieb stehen. Der Skill
 * wird in JEDE `uc`- und `seed:uc`-Runde injiziert; das Modell las die Falschaussage in
 * jeder UC-Runde. Gefunden wurde sie nicht von einem Test, sondern von Hand.
 *
 * Derselbe Scan fand beim ersten Lauf zwei weitere: `FC-01` in `se-fmea` und `R-03` in
 * `se-view:fmea`, beide ebenfalls gestrichene Regeln. Drei von 20 genannten IDs waren
 * erfunden — genau die Klasse, die keine Bindung und kein Gate erreicht, weil sie in Prosa
 * steht.
 *
 * Bewusst KEINE gepflegte Liste: Praefixe und IDs kommen aus `ALL_RULE_DEFS`. Eine neue
 * Regelfamilie ist damit automatisch abgedeckt, eine gestrichene Regel faellt automatisch
 * auf — eine zweite Liste waere derselbe Fehler noch einmal.
 *
 * Was dieser Test NICHT prueft: ob die Aussage ÜBER die Regel stimmt (Stufe c der CR).
 * Er prueft die Existenz, nicht die Wahrheit.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS } from '@sigloch/contracts/se';
import { RULE_CLAUSE, GENERATION_TEMPLATE } from '../src/loop/generate.js';

const KATALOG = new Set(ALL_RULE_DEFS.map((r) => r.id));

/**
 * Was wie eine Regel-ID aussieht: ein Praefix aus dem Katalog plus zwei Ziffern.
 * Zwei Ziffern, weil der Katalog durchgehend nullgepolstert ist (`R-01`, `UC-03`) — uids
 * wie `MS-1-specification` haben nur eine und fallen damit nicht faelschlich hinein.
 */
const ID_MUSTER = new RegExp(
  '\\b(' +
    [...new Set(ALL_RULE_DEFS.map((r) => r.id.slice(0, r.id.lastIndexOf('-'))))]
      .sort((a, b) => b.length - a.length)
      .join('|') +
    ')-\\d{2}\\b',
  'g',
);

function markdownDateien(dir: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir)) {
    const p = join(dir, eintrag);
    if (statSync(p).isDirectory()) out.push(...markdownDateien(p));
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Jede ID-foermige Nennung in `text`, ohne Dubletten. */
function genannteIds(text: string): string[] {
  return [...new Set([...text.matchAll(ID_MUSTER)].map((m) => m[0]))];
}

describe('TEST-skill-rule-ids: keine erfundenen Regeln in Skills und Prompts (CR-GC-571)', () => {
  const skills = markdownDateien(new URL('../.claude/commands', import.meta.url).pathname);

  it('der Scan greift ueberhaupt — die Skills nennen Regeln, und der Katalog ist nicht leer', () => {
    // Ohne diese Kontrolle wuerde ein kaputtes Muster als "alles sauber" durchgehen.
    expect(KATALOG.size).toBeGreaterThan(50);
    expect(skills.length).toBeGreaterThan(10);
    const alle = skills.flatMap((f) => genannteIds(readFileSync(f, 'utf8')));
    expect(alle.length).toBeGreaterThan(10);
    // Und das Muster erkennt eine erfundene ID wirklich als solche.
    expect(genannteIds('a UC with no compose raises R-14.')).toEqual(['R-14']);
    expect(KATALOG.has('R-14')).toBe(false);
  });

  it('jede in einem Skill genannte Regel-ID steht im Katalog', () => {
    const erfunden: string[] = [];
    for (const datei of skills) {
      for (const id of genannteIds(readFileSync(datei, 'utf8'))) {
        if (!KATALOG.has(id)) erfunden.push(`${datei.split('/.claude/')[1] ?? datei}: ${id}`);
      }
    }
    expect(erfunden).toEqual([]);
  });

  it('jede im Rundenprompt genannte Regel-ID steht im Katalog', () => {
    // Der Weg, der das Modell WIRKLICH erreicht: Klausel-Schluessel, Klauseltexte
    // und Stufen-Vorlagen.
    const texte = [
      ...Object.keys(RULE_CLAUSE),
      ...Object.entries(RULE_CLAUSE).map(([, k]) => k.text(['UID-1'])),
      ...Object.values(GENERATION_TEMPLATE),
    ];
    const erfunden = texte.flatMap(genannteIds).filter((id) => !KATALOG.has(id));
    expect([...new Set(erfunden)]).toEqual([]);
  });

  it('die Schluessel von RULE_CLAUSE sind Regeln, keine freien Namen', () => {
    // Eine Klausel unter einem Schluessel, den keine Regel stellt, wird NIE gerendert —
    // ein toter Kanal, den nur ein Lauf entlarvt haette.
    for (const schluessel of Object.keys(RULE_CLAUSE)) expect(KATALOG.has(schluessel)).toBe(true);
  });
});

/**
 * Smeagol Stufe (d) — Task-Konsistenz (CR-GC-602). Seit die Regeln einen Eigentuemer haben
 * (CR-SM-350), gibt es eine neue Klasse Widerspruch: ein Kanal des Kerns, der an einer Task-Regel
 * zieht. Genau das war die FM-01-Klausel aus CR-GC-598 — sie forderte den Kern-Loop auf, S/O/D zu
 * setzen, was nur die FMEA darf. Diese Stufe haette sie beim ersten Lauf gefangen.
 */
describe('TEST-skill-rule-ids (d): Kanaele, Tasks und Abnahmen passen zusammen (CR-GC-602)', () => {
  it('RULE_CLAUSE nur an Kern-Regeln — eine Klausel steuert den Kern-Loop, nie einen Task', async () => {
    const { taskOf } = await import('@sigloch/contracts/se');
    for (const id of Object.keys(RULE_CLAUSE)) expect(taskOf(id), `${id} gehoert ${taskOf(id)}`).toBe('kern');
  });

  it('jeder Task hat einen Skill, und der Skill liegt ausgeliefert vor', async () => {
    const { TASK_SKILL } = await import('../src/loop/generate.js');
    const { RULE_TASKS } = await import('@sigloch/contracts/se');
    const dateien = markdownDateien(join(__dirname, '..', '.claude', 'commands')).map((p) =>
      p.split('/.claude/commands/')[1].replace(/\.md$/, '').replace('/', ':'),
    );
    for (const t of RULE_TASKS) {
      if (t === 'kern') continue;
      const skill = (TASK_SKILL as Record<string, string>)[t];
      expect(skill, `${t} ohne Skill`).toBeTruthy();
      expect(dateien, `${t}: ${skill} nicht ausgeliefert`).toContain(skill);
    }
  });

  it('jeder Eintrittspunkt ist eine Kern-Regel im Gate-Katalog und keine info — sonst sieht der Kern ihn nie', async () => {
    const { TASK_ENTRY, taskOf } = await import('@sigloch/contracts/se');
    const { SE_DESCRIPTOR } = await import('@sigloch/graph-api-core');
    const gate = new Map((SE_DESCRIPTOR.rules ?? []).map((r: { id: string; severity: string }) => [r.id, r]));
    for (const [task, entry] of Object.entries(TASK_ENTRY)) {
      if (entry === null) continue;
      expect(taskOf(entry), `${task}: ${entry}`).toBe('kern');
      expect(gate.has(entry), `${task}: ${entry} nicht im Gate-Katalog`).toBe(true);
      expect(gate.get(entry)!.severity).not.toBe('info');
    }
  });

  // CR-GC-748: eine Menge statt „je Task" — die Regeln der Analysen stehen im Kern und werden dort abgenommen.
  it('abnehmbar ist nur, was der Fokus zeigen kann: Regeln des Katalogs, im Gate-Katalog, keine info', async () => {
    const { ABNEHMBAR } = await import('../src/kernel/measure/focus-set.js');
    const { ALL_RULE_DEFS } = await import('@sigloch/contracts/se');
    const { SE_DESCRIPTOR } = await import('@sigloch/graph-api-core');
    const gate = new Set((SE_DESCRIPTOR.rules ?? []).map((r: { id: string }) => r.id));
    for (const id of ABNEHMBAR) {
      const def = ALL_RULE_DEFS.find((r) => r.id === id);
      expect(def, `${id} ist keine Regel des Katalogs`).toBeDefined();
      expect(gate.has(id), `${id} nicht im Gate-Katalog — der Fokus zeigt sie nie`).toBe(true);
      expect(def!.severity, id).not.toBe('info');
    }
  });
});

/**
 * Smeagol Stufe (e) — Empfehlungskonsistenz (CR-GC-605). Eine Regel gibt ihre Empfehlung an drei
 * Stellen: `fix_hint` (Regeldefinition), `RULE_HELP.prompt` (contracts, der Skill-Zeiger) und in
 * graphcode `TASK_SKILL` / `SKILL_FOR_STAGE`. Bis hierher prueften contracts nur die FORM des
 * Prompts; ob der Skill existiert, weiss nur das Repo, das die Skills ausliefert. Vorbild: rustc
 * `lint-docs`, Clippy `cargo dev update_lints --check`, Roslyn `FixableDiagnosticIds`.
 */
describe('TEST-skill-rule-ids (e): Empfehlungen passen zu Regeln und Skills (CR-GC-605)', () => {
  const ausgeliefert = new Set(
    markdownDateien(join(__dirname, '..', '.claude', 'commands')).map((p) =>
      p.split('/.claude/commands/')[1].replace(/\.md$/, '').replace('/', ':'),
    ),
  );

  it('jeder RULE_HELP.prompt nennt einen ausgelieferten Skill', async () => {
    const { RULE_HELP } = await import('@sigloch/contracts/se');
    const fremd = Object.entries(RULE_HELP)
      .filter(([, e]) => e.prompt !== undefined && !ausgeliefert.has(e.prompt))
      .map(([id, e]) => `${id}: ${e.prompt}`);
    expect(fremd).toEqual([]);
  });

  it('TASK_SKILL ist die Hilfe des Eintrittspunkts — eine Zuordnung, nicht zwei', async () => {
    const { RULE_HELP, TASK_ENTRY } = await import('@sigloch/contracts/se');
    const { TASK_SKILL } = await import('../src/loop/generate.js');
    for (const [task, entry] of Object.entries(TASK_ENTRY)) {
      if (entry === null) continue;
      expect((TASK_SKILL as Record<string, string>)[task], `${task} ↔ ${entry}`).toBe(RULE_HELP[entry].prompt);
    }
  });

  it('Kern-Regel: Hilfe-Prompt und Skill der Stufe stimmen ueberein — oder die Abweichung steht hier mit Grund (Ratsche)', async () => {
    const { RULE_HELP, ALL_RULE_DEFS, STAGE_SETS, TASK_ENTRY, taskOf } = await import('@sigloch/contracts/se');
    const { SKILL_FOR_STAGE } = await import('../src/loop/generate.js');
    // CR-GC-757: der Skill haengt an der STUFE der Regel (vorher: an ihrer Dimension).
    const stufenName = (id: string): string | undefined => {
      const st = ALL_RULE_DEFS.find((r) => r.id === id)?.stage;
      return st === undefined ? undefined : st === 'immer' ? 'immer' : STAGE_SETS[st - 1];
    };
    // Benannte Abweichungen: der Fix liegt in einer anderen Stufe als der Fund. Eine Ausnahme,
    // die nicht mehr abweicht, laesst den Test fallen — die Liste darf nur schrumpfen.
    // CR-GC-757: UC-01 ist gestrichen — die Regel steht in der Stufe Anforderung, deren Skill
    // se:author-req ist; Hilfe und Stufe stimmen jetzt ueberein (vorher: Dimension uc → se:author-uc).
    const AUSNAHMEN: Record<string, string> = {
      'RD-01': 'unaufgeloeste REQ — der Fix ist eine satisfy-Kante (se:close-violations), kein neuer Text',
      'R-04': 'Modul-Grenzbreite — der Fix beginnt mit der Sicht (se-view:arch), nicht mit dem Schnitt',
    };
    const eintritte = new Set(Object.values(TASK_ENTRY).filter(Boolean));
    // CR-GC-748: eine Regel, deren Hilfe einen Analyse-Skill nennt (FM-01..03, CL-01, TR-01, IR-01 — seit
    // contracts 11 Kern-Regeln), nimmt die Stufe gar nicht: der Schritt nennt den Skill der Analyse
    // (`analyseSkill`, Fall darunter). Sie ist deshalb keine Abweichung und steht nicht in der Ratsche.
    const { analyseSkill } = await import('../src/loop/generate.js');
    const abweichend = Object.entries(RULE_HELP)
      .filter(([id, e]) => e.prompt && taskOf(id) === 'kern' && !eintritte.has(id) && analyseSkill(id) === undefined)
      .filter(([id, e]) => {
        const stufe = stufenName(id);
        const skill = stufe ? SKILL_FOR_STAGE[stufe]?.name : undefined;
        return skill !== undefined && skill !== e.prompt;
      })
      .map(([id]) => id);
    expect(abweichend.filter((id) => !(id in AUSNAHMEN)), 'unbenannte Abweichung').toEqual([]);
    expect(Object.keys(AUSNAHMEN).filter((id) => !abweichend.includes(id)), 'Ausnahme ohne Abweichung — streichen').toEqual([]);
  });

  it('CR-GC-748: steht eine Regel einer Analyse im Kern-Fokus, nennt der Schritt den Skill der Analyse — nicht den der Stufe', async () => {
    const { DEFAULT_METRIC_POLICY, RULE_HELP } = await import('@sigloch/contracts/se');
    const { generationStep, analyseSkill, SKILL_FOR_STAGE } = await import('../src/loop/generate.js');
    // Eine Risiko-Anforderung ohne Bewertung: FM-01 meldet — eine Regel der Fehlerbetrachtung, im Kern sichtbar.
    const n = (uid: string, type: string, description: string, attributes: Record<string, unknown> = {}) =>
      ({ uid, type, name: uid, description, attributes });
    const e = (sourceId: string, targetId: string, edgeType: string) => ({ sourceId, targetId, edgeType, attributes: {} });
    const graph = {
      nodes: [
        n('SYS-s', 'SYS', 'Ein System fuer Bestellungen.'),
        n('UC-a', 'UC', 'Kunde bestellt ein Teil und erhaelt eine Bestaetigung.'),
        n('ACTOR-k', 'ACTOR', 'Wer bestellt.'),
        n('FUNC-f', 'FUNC', 'Nimmt die Bestellung entgegen.'),
        n('REQ-risk', 'REQ', 'Das System muss Datenverlust beim Schreiben ausschliessen.', { role: 'risk', kinds: ['non-functional'] }),
        n('TEST-risk', 'TEST', 'Schreibabbruch herbeifuehren, Datei pruefen.'),
      ],
      edges: [e('SYS-s', 'UC-a', 'compose'), e('SYS-s', 'REQ-risk', 'compose'), e('SYS-s', 'REQ-risk', 'satisfy'), e('TEST-risk', 'REQ-risk', 'verify')],
    } as never;
    let cur = generationStep(graph, DEFAULT_METRIC_POLICY, 'Bestellungen', 0.8, []);
    const defer: string[] = [];
    while (cur.focusKey && cur.focusKey.split(':')[1] !== 'FM-01' && defer.length < 40) {
      defer.push(cur.focusKey);
      cur = generationStep(graph, DEFAULT_METRIC_POLICY, 'Bestellungen', 0.8, defer);
    }
    expect(cur.focusKey).toMatch(/:FM-01:/);
    expect(analyseSkill('FM-01')).toBe(RULE_HELP['FM-01']!.prompt);
    expect(cur.skill).toBe(analyseSkill('FM-01'));
    // Die Stufe haette einen eigenen Skill — sonst waere „nicht den der Stufe" leer geprueft.
    expect(cur.focusStage).toBe('Anforderung');
    expect(SKILL_FOR_STAGE[cur.focusStage!]?.name).toBe('se:author-req');
    expect(cur.skill).not.toBe(SKILL_FOR_STAGE[cur.focusStage!]?.name);
    expect(cur.prompt).toContain(`lade den Skill ${cur.skill}`);
    // Eine gewoehnliche Kern-Regel gehoert zu keiner Analyse.
    expect(analyseSkill('R-22')).toBeUndefined();
  });

  it('Werkzeugnamen in Hilfe und Skills existieren in der MCP-Registry', async () => {
    const { RULE_HELP } = await import('@sigloch/contracts/se');
    const { mkdtempSync, rmSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { createHarness, bindToolsToHarness } = await import('../src/index.js');
    const repoRoot = mkdtempSync(join(tmpdir(), 'gc-smeagol-e-'));
    mkdirSync(join(repoRoot, '.graphcode'), { recursive: true });
    const harness = await createHarness({ repoRoot, scope: { workspaceId: 'w', systemId: 's' } });
    await harness.initialize();
    try {
      const registry = new Set(Object.keys(bindToolsToHarness(harness)));
      expect(registry.has('graph_mutate')).toBe(true);
      const texte = [
        ...Object.values(RULE_HELP).flatMap((e) => [e.plain, e.se, e.prompt ?? '']),
        ...markdownDateien(join(__dirname, '..', '.claude', 'commands')).map((f) => readFileSync(f, 'utf8')),
      ];
      const genannt = new Set(texte.flatMap((t) => [...t.matchAll(/\b(graph|rules|audit)_[a-z_]+\b/g)].map((m) => m[0])));
      expect([...genannt].filter((n) => !registry.has(n)).sort()).toEqual([]);
    } finally {
      await harness.close();
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('error nur im Gate-Katalog — ohne Ausnahmeliste (CR-SM-353)', async () => {
    const { SE_DESCRIPTOR } = await import('@sigloch/graph-api-core');
    const gate = new Set((SE_DESCRIPTOR.rules ?? []).map((r: { id: string }) => r.id));
    const errors = ALL_RULE_DEFS.filter((r) => r.severity === 'error').map((r) => r.id);
    expect(errors.filter((id) => !gate.has(id))).toEqual([]);
  });

  it('keine Regel eines Arbeitsschritts hat Gate-Wirkung — der Task-Fokus reicht die Schwere trotzdem durch', async () => {
    const { taskOf } = await import('@sigloch/contracts/se');
    // Bis contracts 10 stand hier R-29 (Testdatei-Exklusivitaet, Arbeitsschritt `realisierung`): ein
    // Altfund davon im Task war Gate-Schuld, keine Warnung — deshalb schreibt der Fokus die Schwere
    // nicht um (CR-GC-605). Den Arbeitsschritt gibt es nicht mehr (CR-SM-395), R-29 gehoert dem Kern.
    // Waechst diese Liste, hat eine Task-Regel Gate-Wirkung bekommen: entscheiden, nicht uebernehmen.
    expect(ALL_RULE_DEFS.filter((r) => taskOf(r.id) !== 'kern' && r.severity === 'error').map((r) => r.id)).toEqual([]);
  });

  /**
   * CR-GC-616 (Entscheidung zu ITEM-2026-462, umgesetzt in CR-SM-357): scharf geschaltet.
   *
   * Eine Steuerregel bestimmt, wohin der naechste Zug geht — und `info` faellt aus dem
   * Kern-Fokus heraus. Eine Regel, die lenkt, aber nicht gezeigt wird, lenkt niemanden: MT-02
   * stand genau so da. Sie ist jetzt `warning` (Messung vor der Umstellung: 0-1 Fund je Graph,
   * Spitze moneyflow 9 von 155 MOD — kein Fluten des Fokus).
   *
   * Der Test ist die Zusage nach vorn: eine NEUE Steuerregel darf nicht als `info` einziehen.
   */
  it('Steuerregel nie info (STEER_RULES ∩ info = ∅)', async () => {
    const { STEER_RULES } = await import('@sigloch/se-engine');
    const severity = new Map(ALL_RULE_DEFS.map((r) => [r.id, r.severity]));
    expect(STEER_RULES.filter((id: string) => severity.get(id) === 'info')).toEqual([]);
  });
});
