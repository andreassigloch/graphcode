#!/usr/bin/env node
/**
 * regel-matrix.mjs — die Regel-Matrix als lesbare Tabelle (CR-GC-600, Spalten seit CR-GC-605,
 * Stufe/Rolle/Marke seit CR-GC-750).
 *
 * Eine Zeile je Regel, jede Spalte aus der Quelle gelesen, nichts von Hand gepflegt. Keine Spalte,
 * die sich aus einer anderen ableiten laesst (CR-GC-605: „blockt am Gate" = Schwere error, „im
 * Kern-Fokus" = Task kern ∧ Bedarf Gate/Aehnlichkeit ∧ Schwere ≠ info, „Eintritt fuer" steckt im Task):
 *   Stufe (1–12 mit dem Namen ihrer Menge, oder `immer`), Rolle (existence | analysis | leer) und
 *   Marke (SRR/PDR/CDR/TRR/Bau, aus der Stufe berechnet) — alle drei aus `ALL_RULE_DEFS` (contracts 11,
 *   CR-SM-395); sie ersetzen die Spalte „Phase". Die Zeilen stehen in der Reihenfolge, in der der
 *   Schritt die Regeln waehlt: Stufe, in der Stufe die Existenz-Regel vorn.
 *   Bedarf (was die Regel zum Urteilen braucht: Gate | Aehnlichkeit (ND) | CodeFacts (RC) | nur Steuerung),
 *   Schwere (info / warning / error — error heisst blockt, CR-SM-353), Task (+ Eintritt fuer <task>),
 *   Steuerregel, abnehmbar (mit Grund, wo er nicht aus der Rolle folgt), Hilfe-Prompt (RULE_HELP.prompt), Vorschlag an den Nutzer (RULE_HELP.vorschlag, CR-GC-733), Skill (wie der Schritt ihn nennt:
 *   TASK_SKILL, der Skill der Analyse oder SKILL_FOR_STAGE), Konflikt (beide gesetzt und verschieden), nennt (Prosa-Nennungen in Skills),
 *   Fix und Folge-Regeln (CR-GC-616, beide aus `FIX_ROUNDTRIP` in se-engine — dem gemessenen
 *   Roundtrip je Fix-Vorlage, nicht aus einer gepflegten Liste).
 * Dazu (CR-GC-668) die Tabelle „Erfueller × kinds": welcher Typ welche REQ-Art per `satisfy` erfuellen
 * darf — je Zelle `isValidTrace` aus contracts gefragt, nicht aus den where-Listen abgeschrieben.
 * Schreibt docs/views/regel-matrix.csv und docs/views/regel-matrix.md.
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
import { STEER_RULES, FIX_ROUNDTRIP } from '@sigloch/se-engine';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { ABNEHMBAR, ABNEHMBAR_BEGRUENDET } = await import(join(ROOT, 'dist', 'kernel', 'measure', 'focus-set.js'));
const { TASK_SKILL, SKILL_FOR_STAGE, analyseSkill, stufenRang } = await import(join(ROOT, 'dist', 'loop', 'generate.js'));

const gate = new Set((SE_DESCRIPTOR.rules ?? []).map((r) => r.id));
const defs = new Map(se.ALL_RULE_DEFS.map((r) => [r.id, r]));
// Reihenfolge wie beim Schritt (generate.ts): Stufe, in der Stufe die Existenz-Regel vorn, dann die ID.
const ids = [...defs.keys()].sort((a, b) =>
  stufenRang(a) - stufenRang(b) ||
  Number(defs.get(b).role === 'existence') - Number(defs.get(a).role === 'existence') ||
  a.localeCompare(b, 'de', { numeric: true }));
const stufeVon = (def) => (def.stage === 'immer' ? 'immer' : `${def.stage} ${se.STAGE_SETS[def.stage - 1]}`);
const entryFor = new Map(Object.entries(se.TASK_ENTRY).filter(([, e]) => e).map(([t, e]) => [e, t]));
// Abnehmbar: die Menge aus focus-set.ts. Der Grund steht dabei, wo er nicht aus der Rolle folgt.
const abnehmbar = (id) => !ABNEHMBAR.has(id) ? '' : defs.get(id).role === 'analysis' ? 'ja (Analyse)'
  : entryFor.has(id) ? 'ja (Eintritt einer Analyse)' : `ja — ${ABNEHMBAR_BEGRUENDET[id]}`;

// Prosa-Nennungen (ohne se:generate/help/close-violations, die alle nennen) — Information, keine Bindung.
const skillTexte = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : n.endsWith('.md') && skillTexte.push([p.slice(join(ROOT, '.claude', 'commands').length + 1, -3).replace('/', ':'), readFileSync(p, 'utf8')]); } };
walk(join(ROOT, '.claude', 'commands'));
const nennt = (id) => skillTexte
  .filter(([n, t]) => !/^se:(generate|help|close-violations)$/.test(n) && new RegExp(`\\b${id.replace('-', '\\-')}\\b`).test(t))
  .map(([n]) => n);

const bedarf = (id) => gate.has(id) ? 'Gate' : id.startsWith('ND-') ? 'Aehnlichkeit (ND)' : id.startsWith('RC-') ? 'CodeFacts (RC)' : 'nur Steuerung';
// Wie generate.ts (CR-GC-604/748): im Task der Task-Skill, an einem Eintrittspunkt der Skill des Tasks,
// an einer Regel einer Analyse deren Skill, sonst der der Stufe.
/**
 * CR-GC-616 — was die Fix-Vorlage der Regel auf ihrem Ausloese-Fixture tatsaechlich tut. Gemessen
 * von `tests/unit/fix-roundtrip.test.ts` in se-engine, hier nur gelesen. Leer = keine Vorlage
 * (der Fund bleibt Fund-Ebene); `tot` = Vorlage da, leitet aber keinen Edit her — das ist der
 * Befund, den der Roundtrip sichtbar machen soll, nicht ein Fehler der Matrix.
 */
const fixOf = (id) => {
  const e = FIX_ROUNDTRIP[id];
  if (!e) return '';
  if (!e.applied) return 'tot';
  return e.cleared ? 'schliesst' : 'Teil-Fix';
};
const skillOf = (id, task, stufe) => task !== 'kern' ? TASK_SKILL[task] : entryFor.has(id) ? TASK_SKILL[entryFor.get(id)] : (analyseSkill(id) ?? SKILL_FOR_STAGE[stufe]?.name ?? '');

const rows = ids.map((id) => {
  const def = defs.get(id);
  const task = se.taskOf(id);
  const stufe = def.stage === 'immer' ? 'immer' : se.STAGE_SETS[def.stage - 1];
  const prompt = se.RULE_HELP[id]?.prompt ?? '';
  const vorschlag = se.RULE_HELP[id]?.vorschlag ?? '';
  const skill = skillOf(id, task, stufe);
  return {
    // `Regel` bleibt die erste Spalte: `scripts/messung.mjs` (T-H2) liest die IDs dort.
    Regel: id,
    Name: def.name ?? '',
    Stufe: stufeVon(def),
    Rolle: def.role ?? '',
    Marke: def.mark ?? '–',
    Schwere: def.severity ?? '',
    Bedarf: bedarf(id),
    Task: entryFor.has(id) ? `${task}, Eintritt fuer ${entryFor.get(id)}` : task,
    Steuerregel: STEER_RULES.includes(id) ? 'ja' : '',
    abnehmbar: abnehmbar(id),
    'Hilfe-Prompt': prompt,
    Vorschlag: vorschlag,
    Skill: skill,
    Konflikt: prompt && skill && prompt !== skill ? 'ja' : '',
    nennt: nennt(id).join(' '),
    Fix: fixOf(id),
    'Folge-Regeln': (FIX_ROUNDTRIP[id]?.sequels ?? []).join(' '),
  };
});

// CR-GC-668 — Erfueller × kinds. Spalten: jeder Quelltyp mit einem `-satisfy-> REQ`-Pattern; Zeilen:
// jeder ReqKind plus „ohne kinds" (fehlend = nicht deklariert, ein where-Pattern lehnt dann ab).
const erfueller = [...new Set(se.TRACE_PATTERNS.filter((p) => p.type === 'satisfy' && p.target === 'REQ').map((p) => p.source))];
const kindsZeilen = [...se.ReqKind.options.map((k) => [k, [k]]), ['(ohne kinds)', undefined]];
const erfuellerTabelle = [
  `| kinds | ${erfueller.join(' | ')} |`,
  `|---|${erfueller.map(() => ':---:').join('|')}|`,
  ...kindsZeilen.map(([name, kinds]) => `| ${name} | ${erfueller
    .map((source) => (se.isValidTrace({ source, target: 'REQ', type: 'satisfy', targetKinds: kinds }) ? '✓' : '')).join(' | ')} |`),
];

const cols = Object.keys(rows[0]);
const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => String(r[c]).replace(/;/g, ',')).join(';'))].join('\n') + '\n';

const zaehl = (f) => rows.filter(f).length;
const perTask = se.RULE_TASKS.map((t) => `| ${t} | ${zaehl((r) => se.taskOf(r.Regel) === t)} | ${t === 'kern' ? '—' : (se.TASK_ENTRY[t] ?? 'ausdruecklich')} | ${TASK_SKILL[t] ?? '—'} |`);
// Stufen und Marken: je Stufe ihre Menge, die Existenz-Regeln, die sie verlangen, und die Marke danach.
const markeNach = (stufe) => Object.entries(se.MARK_STAGE).find(([, s]) => s === stufe)?.[0] ?? '';
const stufenTabelle = [
  `| immer | (alle Elemente) |  |  | ${zaehl((r) => r.Stufe === 'immer')} |`,
  ...se.STAGE_SETS.map((menge, i) => {
    const hier = [...defs.values()].filter((d) => d.stage === i + 1);
    return `| ${i + 1} | ${menge} | ${hier.filter((d) => d.role === 'existence').map((d) => d.id).join(', ')} | ${markeNach(i + 1)} | ${hier.length} |`;
  }),
];
const md = [
  '# Regel-Matrix',
  '',
  '> GENERIERT von `scripts/regel-matrix.mjs` aus contracts, graph-api-core, se-engine und graphcode — nicht von Hand bearbeiten.',
  `> ${rows.length} Regeln · ${zaehl((r) => r.Bedarf === 'Gate')} im Gate-Katalog · ${zaehl((r) => r.Schwere === 'error')} blocken (Schwere error) · ${zaehl((r) => r.Rolle === 'existence')} Existenz-Regeln · ${zaehl((r) => r.Rolle === 'analysis')} Analysen · ${zaehl((r) => r.abnehmbar)} abnehmbar · ${zaehl((r) => r.Konflikt)} Prompt/Skill-Konflikte (Ausnahmen in tests/skill-rule-ids.test.ts).`,
  `> Fix-Vorlagen: ${zaehl((r) => r.Fix)} Regeln tragen eine · ${zaehl((r) => r.Fix === 'schliesst')} schliessen den Fund · ${zaehl((r) => r.Fix === 'Teil-Fix')} Teil-Fix · ${zaehl((r) => r.Fix === 'tot')} tot (CR-SM-357).`,
  '',
  '## Stufen und Marken',
  '',
  '> Fällig ist eine Regel, sobald ihre Menge nicht leer ist (Stufen 11 und 12: sobald es einen offenen Auftrag oder eine Bindung gibt). Eine Marke liegt hinter ihrer Stufe und ist erreicht, wenn kein Befund sie hält — gerechnet in `@sigloch/graphcode-client` (`computeMarks`).',
  '',
  '| Stufe | Menge | Existenz-Regeln | Marke danach | Regeln |',
  '|---|---|---|---|---:|',
  ...stufenTabelle,
  '',
  '## Tasks',
  '',
  '> Seit contracts 11 nimmt nur noch die Textqualität der Anforderungen dem Kern Regeln ab. Eine Analyse hat einen Eintrittspunkt; ihre übrigen Regeln führt der Kern, und der Schritt nennt an ihnen den Skill der Analyse.',
  '',
  '| Task | Regeln | Eintrittspunkt im Kern | Skill |',
  '|---|---:|---|---|',
  ...perTask,
  '',
  '## Erfueller × kinds',
  '',
  '> `X -satisfy-> REQ` ist legal (✓), wenn die REQ genau diese kinds traegt — gefragt bei `isValidTrace` (R-18). Smeagol prueft die in Skills und Prompts genannten Werte dagegen (tests/skill-kinds-werte.test.ts).',
  '',
  ...erfuellerTabelle,
  '',
  '## Alle Regeln',
  '',
  `| ${cols.join(' | ')} |`,
  `|${cols.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${cols.map((c) => String(r[c]).replace(/\|/g, '/')).join(' | ')} |`),
  '',
].join('\n');

mkdirSync(join(ROOT, 'docs', 'views'), { recursive: true });
writeFileSync(join(ROOT, 'docs', 'views', 'regel-matrix.csv'), csv);
writeFileSync(join(ROOT, 'docs', 'views', 'regel-matrix.md'), md);
console.log(`${rows.length} Regeln → docs/views/regel-matrix.{csv,md}`);
