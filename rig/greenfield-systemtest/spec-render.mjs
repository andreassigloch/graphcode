#!/usr/bin/env node
/**
 * spec-render.mjs — einen Lauf-Graphen als lesbare, anonymisierte Spec rendern (Blindurteil).
 *
 * Runde 20 hat das von Hand gemacht; dieses Skript macht es wiederholbar. Aufbau: je UC die REQ mit
 * `kinds`, ihre Erfüller und TESTs; danach REQ ausserhalb eines UC, Wirkketten mit FUNCs, Flüsse mit
 * Vertrag, Module. Keine Lauf-, Modell- oder Arm-Kennung im Text — die Zuordnung bleibt beim Aufrufer.
 *
 *   node spec-render.mjs <graph.json> <ausgabe.md> <Kennbuchstabe>
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync } from 'node:fs';

export function render(graph, kennung) {
  const el = new Map(graph.elements.map((e) => [e.id, e]));
  const tr = graph.traces ?? [];
  const aus = (id, typ) => tr.filter((t) => t.source === id && t.type === typ).map((t) => t.target).filter((x) => el.has(x));
  const ein = (id, typ) => tr.filter((t) => t.target === id && t.type === typ).map((t) => t.source).filter((x) => el.has(x));
  const name = (id) => el.get(id)?.name ?? id;
  const beschr = (id) => (el.get(id)?.description ?? '').trim();
  const kinds = (id) => {
    // Der Export traegt `kinds` am Element selbst, nicht unter `attributes`.
    const k = el.get(id)?.kinds ?? el.get(id)?.attributes?.kinds;
    return Array.isArray(k) && k.length ? k.join(', ') : 'ohne kinds';
  };
  const typ = (t) => [...el.values()].filter((e) => e.type === t).map((e) => e.id).sort();
  const z = [];
  const reqBlock = (r, einzug = '') => {
    z.push(`${einzug}- **${r}** (${kinds(r)}) — ${beschr(r)}`);
    const erf = ein(r, 'satisfy');
    z.push(`${einzug}  - erfüllt von: ${erf.length ? erf.join(', ') : '—'}`);
    for (const t of ein(r, 'verify')) z.push(`${einzug}  - Test **${t}**: ${beschr(t)}`);
  };

  z.push(`# Spec ${kennung}`, '');
  for (const s of typ('SYS')) z.push(`**System ${s}** — ${beschr(s)}`, '');
  z.push('## Akteure', '');
  for (const a of typ('ACTOR')) z.push(`- **${a}** — ${beschr(a)}`);
  z.push('', '## Use Cases mit ihren Anforderungen', '');
  const unterUC = new Set();
  for (const u of typ('UC')) {
    z.push(`### ${u} — ${name(u)}`, '', beschr(u), '');
    for (const r of aus(u, 'compose').filter((x) => el.get(x).type === 'REQ')) {
      unterUC.add(r);
      reqBlock(r);
    }
    const ketten = aus(u, 'compose').filter((x) => el.get(x).type === 'FCHAIN');
    if (ketten.length) z.push(`- Wirkketten: ${ketten.join(', ')}`);
    z.push('');
  }
  const rest = typ('REQ').filter((r) => !unterUC.has(r));
  if (rest.length) {
    z.push('## Anforderungen ausserhalb eines Use Case', '');
    for (const r of rest) reqBlock(r);
    z.push('');
  }
  z.push('## Wirkketten', '');
  for (const c of typ('FCHAIN')) {
    z.push(`### ${c} — ${name(c)}`, '', beschr(c), '');
    for (const f of aus(c, 'compose')) z.push(`- ${f}: ${beschr(f)}`);
    z.push('');
  }
  const ohneKette = typ('FUNC').filter((f) => ein(f, 'compose').length === 0);
  if (ohneKette.length) {
    z.push('## Funktionen ausserhalb einer Wirkkette', '');
    for (const f of ohneKette) z.push(`- ${f}: ${beschr(f)}`);
    z.push('');
  }
  z.push('## Flüsse und Verträge', '');
  for (const f of typ('FLOW')) {
    const von = ein(f, 'io').join(', ') || '—';
    const nach = aus(f, 'io').join(', ') || '—';
    const vertrag = aus(f, 'relation').filter((x) => el.get(x).type === 'SCHEMA').join(', ') || '—';
    z.push(`- **${f}** (${von} → ${nach}; Vertrag ${vertrag}): ${beschr(f)}`);
  }
  for (const s of typ('SCHEMA')) z.push(`- Vertrag **${s}**: ${beschr(s)}`);
  z.push('', '## Module', '');
  for (const m of typ('MOD')) {
    const funcs = ein(m, 'allocate');
    z.push(`- **${m}**: ${beschr(m)}${funcs.length ? ` — enthält ${funcs.join(', ')}` : ''}`);
  }
  return z.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [pfad, ziel, kennung] = process.argv.slice(2);
  writeFileSync(ziel, render(JSON.parse(readFileSync(pfad, 'utf8')), kennung));
}
