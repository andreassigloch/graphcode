#!/usr/bin/env node
/**
 * regel-matrix.mjs — die Regel-Matrix als lesbare Tabelle (CR-GC-600, Spalten seit CR-GC-605).
 *
 * Eine Zeile je Regel, jede Spalte aus der Quelle gelesen, nichts von Hand gepflegt. Keine Spalte,
 * die sich aus einer anderen ableiten laesst (CR-GC-605: „blockt am Gate" = Stufe error, „im
 * Kern-Fokus" = Task kern ∧ Bedarf Gate/Aehnlichkeit ∧ Stufe ≠ info, „Eintritt fuer" steckt im Task):
 *   Bedarf (was die Regel zum Urteilen braucht: Gate | Aehnlichkeit (ND) | CodeFacts (RC) | nur Steuerung),
 *   Stufe (info / warning / error — error heisst blockt, CR-SM-353), Task (+ Eintritt fuer <task>),
 *   Phase, Dimension, Steuerregel, abnehmbar in, Hilfe-Prompt (RULE_HELP.prompt), Skill (TASK_SKILL bzw.
 *   SKILL_FOR_DIMENSION), Konflikt (beide gesetzt und verschieden), nennt (Prosa-Nennungen in Skills).
 * Schreibt docs/research/regel-matrix.csv und docs/research/regel-matrix.md.
 *
 * Aufruf: node scripts/regel-matrix.mjs   (liest Pakete + dist — vorher npm run build)
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as se from '@sigloch/contracts/se';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { STEER_RULES } from '@sigloch/se-engine';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ABNEHMBAR_JE_TASK } = await import(join(ROOT, 'dist', 'kernel', 'measure', 'focus-set.js'));
const { TASK_SKILL, SKILL_FOR_DIMENSION } = await import(join(ROOT, 'dist', 'loop', 'generate.js'));

const gate = new Set((SE_DESCRIPTOR.rules ?? []).map((r) => r.id));
const defs = new Map(se.ALL_RULE_DEFS.map((r) => [r.id, r]));
const ids = [...defs.keys()].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
const entryFor = new Map(Object.entries(se.TASK_ENTRY).filter(([, e]) => e).map(([t, e]) => [e, t]));
const abIn = new Map();
for (const [t, list] of Object.entries(ABNEHMBAR_JE_TASK)) for (const id of list) abIn.set(id, [...(abIn.get(id) ?? []), t]);

// Prosa-Nennungen (ohne se:generate/help/close-violations, die alle nennen) — Information, keine Bindung.
const skillTexte = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : n.endsWith('.md') && skillTexte.push([p.slice(join(ROOT, '.claude', 'commands').length + 1, -3).replace('/', ':'), readFileSync(p, 'utf8')]); } };
walk(join(ROOT, '.claude', 'commands'));
const nennt = (id) => skillTexte
  .filter(([n, t]) => !/^se:(generate|help|close-violations)$/.test(n) && new RegExp(`\\b${id.replace('-', '\\-')}\\b`).test(t))
  .map(([n]) => n);

const bedarf = (id) => gate.has(id) ? 'Gate' : id.startsWith('ND-') ? 'Aehnlichkeit (ND)' : id.startsWith('RC-') ? 'CodeFacts (RC)' : 'nur Steuerung';
// Wie generate.ts (CR-GC-604): im Task der Task-Skill, an einem Eintrittspunkt der Skill des Tasks, sonst der der Dimension.
const skillOf = (id, task, dim) => task !== 'kern' ? TASK_SKILL[task] : entryFor.has(id) ? TASK_SKILL[entryFor.get(id)] : (SKILL_FOR_DIMENSION[dim]?.name ?? '');

const rows = ids.map((id) => {
  const def = defs.get(id);
  const task = se.taskOf(id);
  const dim = se.RULE_TO_DIMENSION[id] ?? '';
  const prompt = se.RULE_HELP[id]?.prompt ?? '';
  const skill = skillOf(id, task, dim);
  return {
    Regel: id,
    Name: def.name ?? '',
    Bedarf: bedarf(id),
    Stufe: def.severity ?? '',
    Task: entryFor.has(id) ? `${task}, Eintritt fuer ${entryFor.get(id)}` : task,
    Phase: se.RULE_TO_PHASE[id] ?? '',
    Dimension: dim,
    Steuerregel: STEER_RULES.includes(id) ? 'ja' : '',
    'abnehmbar in': (abIn.get(id) ?? []).join(' '),
    'Hilfe-Prompt': prompt,
    Skill: skill,
    Konflikt: prompt && skill && prompt !== skill ? 'ja' : '',
    nennt: nennt(id).join(' '),
  };
});

const cols = Object.keys(rows[0]);
const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => String(r[c]).replace(/;/g, ',')).join(';'))].join('\n') + '\n';

const zaehl = (f) => rows.filter(f).length;
const perTask = se.RULE_TASKS.map((t) => `| ${t} | ${zaehl((r) => se.taskOf(r.Regel) === t)} | ${t === 'kern' ? '—' : (se.TASK_ENTRY[t] ?? 'ausdruecklich / Zustand')} | ${TASK_SKILL[t] ?? '—'} | ${(ABNEHMBAR_JE_TASK[t] ?? []).join(', ') || '—'} |`);
const md = [
  '# Regel-Matrix',
  '',
  '> GENERIERT von `scripts/regel-matrix.mjs` aus contracts, graph-api-core, se-engine und graphcode — nicht von Hand bearbeiten.',
  `> ${rows.length} Regeln · ${zaehl((r) => r.Bedarf === 'Gate')} im Gate-Katalog · ${zaehl((r) => r.Stufe === 'error')} blocken (Stufe error) · ${zaehl((r) => r.Konflikt)} Prompt/Skill-Konflikte (Ausnahmen in tests/skill-rule-ids.test.ts).`,
  '',
  '## Tasks',
  '',
  '| Task | Regeln | Eintrittspunkt im Kern | Skill | abnehmbar im Task |',
  '|---|---:|---|---|---|',
  ...perTask,
  '',
  '## Alle Regeln',
  '',
  `| ${cols.join(' | ')} |`,
  `|${cols.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${cols.map((c) => String(r[c]).replace(/\|/g, '/')).join(' | ')} |`),
  '',
].join('\n');

mkdirSync(join(ROOT, 'docs', 'research'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'research', 'regel-matrix.csv'), csv);
writeFileSync(join(ROOT, 'docs', 'research', 'regel-matrix.md'), md);
console.log(`${rows.length} Regeln → docs/research/regel-matrix.{csv,md}`);
