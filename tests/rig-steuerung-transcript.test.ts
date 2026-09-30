/**
 * CR-GC-716 — steuerung.mjs auf einem Claude-Code-Sitzungs-Transcript (Kette A).
 *
 * Ein Sitzungs-Transcript unterscheidet sich vom `claude -p`-Strom in drei Punkten, an denen die
 * Auswertung falsch zaehlte (gemessen am Frontier-Lauf agentdiary 2026-09-29):
 *  - jede angewandte Mutation traegt `next` → das Fenster fuer „befolgt" war leer;
 *  - Bash schreibt, committet und testet → jede Zeile mit ls/grep/cat zaehlte als Navigation;
 *  - es gibt keine `result`-Zeile → Effizienz „—" ohne Grund.
 * Dazu mischte `endstand` die Tabellen des letzten graph_generate mit dem `next` der letzten Mutation.
 *
 * Das Fixture ist synthetisch und von Hand abzaehlbar; das echte 6-MB-Transcript bleibt draussen.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error — reines .mjs-Rig ohne Typen
import * as m from '../rig/greenfield-systemtest/steuerung.mjs';

const GC = 'mcp__graphcode__';
const use = (id: string, name: string, input: unknown) =>
  ({ type: 'assistant', message: { id: `m-${id}`, content: [{ type: 'tool_use', id, name, input }] } });
const res = (id: string, content: unknown) =>
  ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: typeof content === 'string' ? content : JSON.stringify(content) }] } });
const bash = (id: string, command: string) => [use(id, 'Bash', { command }), res(id, 'o'.repeat(10))];

// Kette A: kein `result` am Ende; nach dem ersten generate steuert nur noch `next`.
const strom = [
  use('g1', `${GC}graph_generate`, {}),
  res('g1', { phase: 'expand', done: false, focusKey: 'uc:UC-01:UC-a', focusTypes: ['UC'], threshold: 0.8, blockingErrors: 3,
    readiness: [{ dimension: 'uc', score: 0.5 }], phaseReadiness: [{ gate: 'SRR', missing: ['UC-01'] }] }),
  use('m1', `${GC}graph_mutate`, { formatE: '## Nodes\n### UC\n+ UC-a|a\n' }),
  res('m1', { success: true, tier: 'auto-apply', next: { phase: 'expand', done: false, focusKey: 'req:REQ-01:REQ-b', focusTypes: ['REQ'], focusDimension: 'req' } }),
  use('m2', `${GC}graph_mutate`, { formatE: '## Nodes\n### REQ\n+ REQ-b|b\n' }),
  res('m2', { success: true, tier: 'auto-apply', next: { phase: 'handoff', done: true, focusKey: null, focusTypes: [], focusDimension: null } }),
  // Nach `done` ohne Fokus: ein weiterer Batch. Ohne Fokus gibt es nichts zu befolgen — nicht beurteilt.
  use('m3', `${GC}graph_mutate`, { formatE: '## Nodes\n### REQ\n+ REQ-c|c\n' }), res('m3', { success: true, tier: 'auto-apply' }),
  // Keine Navigation: Commit mit $(ls …), Testlauf mit | grep, Heredoc-Schreiben, sed -i.
  ...bash('b1', 'git add docs/cr $(ls docs/views/*.md) && git commit -q -m "feat: x" && git log --oneline -1'),
  ...bash('b2', 'npx vitest run 2>&1 | grep -E "Tests "; npx tsc --noEmit && echo tsc-ok'),
  ...bash('b3', "cat > src/a.ts <<'EOF'\nimport { x } from './contracts/grep.js';\nls\nEOF"),
  ...bash('b4', "sed -i '' 's/a/b/' src/a.ts"),
  // Navigation: Werkzeug-Quelltext, Sicht, sonst (Schleife), eigenes src/contracts eines Fremdrepos.
  ...bash('b5', 'cd /Users/x/dev && grep -n "RC-09" -A25 graphcode/src/kernel/conformance.ts | head -20'),
  ...bash('b6', 'cat docs/views/rtm.md | head -5'),
  // `\\|` im Suchmuster trennt keine Pipeline — sonst verliert das Segment seinen Pfad.
  ...bash('b8', 'grep -rn "isTestFile\\|TEST_FILE" sigloch-modules/packages/contracts/src/se/rules.ts | head'),
  ...bash('b7', 'for f in docs/cr/open/*; do echo "== $f"; cat "$f"; done'),
  use('r1', 'Read', { file_path: '/Users/x/dev/agentdiary/src/contracts/schemas.ts' }), res('r1', 'z'.repeat(20)),
];

let dir: string;
let pfad: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gc-steuerung-a-'));
  pfad = join(dir, 'session.jsonl');
  writeFileSync(pfad, strom.map((z) => JSON.stringify(z)).join('\n') + '\n');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('steuerung.mjs auf Kette A (CR-GC-716)', () => {
  it('befolgt: die Mutation, die selbst `next` traegt, liegt im Fenster des vorigen Fokus', () => {
    const k = m.kanalWirkung(m.leseStrom(pfad));
    // g1 → m1 (UC-a), m1.next → m2 (REQ-b); m2.next traegt keinen Fokus — m3 danach wird nicht beurteilt.
    expect(k.generate).toEqual({ aufrufe: 3, beurteilt: 2, befolgt: 2, wiederholt: 0 });
  });

  it('Navigation: Schreib-, Commit- und Testzeilen zaehlen nicht, fremdes src/contracts ist kein Werkzeug-Quelltext', () => {
    const n = m.navigation(m.leseStrom(pfad));
    expect(n.datei).toEqual({ auftrag: 0, doku: 0, sichten: 1, werkzeugQuelle: 2, sonst: 2 });
  });

  it('Endstand: alles aus der letzten Fokusquelle, nichts vom aelteren generate beigemischt', () => {
    expect(m.endstand(m.leseStrom(pfad))).toEqual({
      quelle: 'next', done: true, phase: 'handoff', blockierend: null, unterSchwelle: null, gateOffen: null, letzterFokus: null,
    });
  });

  it('Effizienz ohne result-Zeile: ausdruecklich nicht verfuegbar, im Bericht benannt', () => {
    const s = m.leseStrom(pfad);
    expect(s.schluss).toBeNull();
    expect(m.effizienz(s.schluss, 10)).toEqual({ verfuegbar: false, grund: 'kein result' });
    const md = m.steuerungsBericht([{ label: 'frontier', strom: pfad, elemente: 10 }]);
    expect(md).toContain('| frontier | 10 | nicht verfuegbar (kein result) |');
    expect(md).toContain('| frontier | ja | nicht im next | nicht im next | nicht im next | — |');
  });
});
