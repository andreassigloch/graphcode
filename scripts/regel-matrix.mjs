#!/usr/bin/env node
/**
 * regel-matrix.mjs — die Regel-Matrix als lesbare Tabelle (CR-GC-600).
 *
 * Eine Zeile je Regel, jede Spalte aus der Quelle gelesen, nichts von Hand gepflegt:
 * Katalog (Gate / nur Steuerung / Code), Schwere, blockt am Gate, Eigentuemer-Task, Eintrittspunkt
 * fuer, Phase, Dimension, Steuerregel, abnehmbar in, im Kern-Fokus, Skills, die sie nennen.
 * Schreibt docs/research/regel-matrix.csv und docs/research/regel-matrix.md.
 *
 * Aufruf: node scripts/regel-matrix.mjs   (nach npm run build nicht noetig — liest Pakete + dist)
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

const gate = new Map((SE_DESCRIPTOR.rules ?? []).map((r) => [r.id, r]));
const steering = new Map(se.ALL_RULE_DEFS.map((r) => [r.id, r]));
const code = new Map(se.CODE_CONFORMANCE_RULES.map((r) => [r.id, r]));
const ids = [...new Set([...steering.keys(), ...gate.keys(), ...code.keys()])].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
const entryFor = new Map(Object.entries(se.TASK_ENTRY).filter(([, e]) => e).map(([t, e]) => [e, t]));
const abIn = new Map();
for (const [t, list] of Object.entries(ABNEHMBAR_JE_TASK)) for (const id of list) abIn.set(id, [...(abIn.get(id) ?? []), t]);

// Skills, die eine Regel beim Namen nennen (ohne se:generate/help/close-violations, die alle nennen).
const skillTexte = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : n.endsWith('.md') && skillTexte.push([p.slice(join(ROOT, '.claude', 'commands').length + 1, -3), readFileSync(p, 'utf8')]); } };
walk(join(ROOT, '.claude', 'commands'));
const skillsOf = (id) => skillTexte
  .filter(([n, t]) => !/^se\/(generate|help|close-violations)$/.test(n) && new RegExp(`\\b${id.replace('-', '\\-')}\\b`).test(t))
  .map(([n]) => n);

const rows = ids.map((id) => {
  const def = steering.get(id) ?? gate.get(id) ?? code.get(id);
  const task = se.taskOf(id);
  const katalog = gate.has(id) ? 'Gate' : steering.has(id) ? 'nur Steuerung' : 'Code (RC)';
  const kernFokus = task === 'kern' && (gate.has(id) || id === 'ND-01' || id === 'ND-02') && def.severity !== 'info';
  return {
    Regel: id,
    Name: def.name ?? '',
    Katalog: katalog,
    Schwere: def.severity ?? '',
    'blockt am Gate': gate.has(id) && def.severity === 'error' && gate.get(id).gating !== false ? 'ja' : '',
    Task: task,
    'Eintritt fuer': entryFor.get(id) ?? '',
    Phase: se.RULE_TO_PHASE[id] ?? '',
    Dimension: se.RULE_TO_DIMENSION[id] ?? '',
    Steuerregel: STEER_RULES.includes(id) ? 'ja' : '',
    'abnehmbar in': (abIn.get(id) ?? []).join(' '),
    'im Kern-Fokus': kernFokus ? 'ja' : '',
    Skills: skillsOf(id).join(' '),
  };
});

const cols = Object.keys(rows[0]);
const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => String(r[c]).replace(/;/g, ',')).join(';'))].join('\n') + '\n';

const zaehl = (f) => rows.filter(f).length;
const perTask = se.RULE_TASKS.map((t) => `| ${t} | ${zaehl((r) => r.Task === t)} | ${t === 'kern' ? '—' : (se.TASK_ENTRY[t] ?? 'ausdruecklich / Zustand')} | ${(ABNEHMBAR_JE_TASK[t] ?? []).join(', ') || '—'} |`);
const md = [
  '# Regel-Matrix',
  '',
  '> GENERIERT von `scripts/regel-matrix.mjs` aus contracts, graph-api-core, se-engine und graphcode — nicht von Hand bearbeiten.',
  `> ${rows.length} Regeln · ${zaehl((r) => r.Katalog === 'Gate')} im Gate-Katalog · ${zaehl((r) => r['blockt am Gate'])} blocken am Gate · ${zaehl((r) => r['im Kern-Fokus'])} im Kern-Fokus.`,
  '',
  '## Tasks',
  '',
  '| Task | Regeln | Eintrittspunkt im Kern | abnehmbar im Task |',
  '|---|---:|---|---|',
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
