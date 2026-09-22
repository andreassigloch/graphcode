#!/usr/bin/env node
/**
 * schatten-suggest.mjs — was HAETTE graph_suggest an jedem Zug vorgeschlagen? (CR-GC-609)
 *
 * In den Claude-Code-Laeufen ruft der Agent graph_suggest nie: se:generate verweist erst beim Handoff
 * darauf, und der wartet auf ein Zielprofil vom Menschen. Der Kanal ist damit ungemessen — dabei war
 * er das beste Werkzeug, um die Steuerung selbst zu verbessern. Diese Datei misst ihn im Schatten:
 * sie spielt die angewandten Zuege eines Laufs (audit.jsonl) in einem Wegwerf-Arbeitsbereich durchs
 * heutige Gate nach und fragt VOR jedem Zug graph_suggest. Der Agent sieht davon nichts.
 *
 * Je Zug: Steuerwert vorher/nachher (se-engine, derselbe Pfad wie das Fertig-Kriterium), die Zahl der
 * (anwendbaren) Vorschlaege, der beste anwendbare mit seiner Steuerverbesserung und ob der Zug des
 * Agenten dessen Element beruehrte. Schreibt <lauf>/schatten-suggest.json; report.mjs rendert es.
 *
 * Aufruf: node rig/greenfield-systemtest/schatten-suggest.mjs rig/greenfield-systemtest/runs/opus5-15
 * (braucht ein gebautes dist; kostet kein Modell, nur Dry-Runs — ein Lauf mit 34 Zuegen ~ Minuten)
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GC_ROOT = resolve(HERE, '..', '..');

/** Die angewandten Zuege eines Laufs in Reihenfolge (dieselbe Auswahl wie der Rewind). */
export function angewandteZuege(auditText) {
  const zuege = [];
  for (const zeile of auditText.split('\n')) {
    if (!zeile.trim()) continue;
    const r = JSON.parse(zeile);
    if (r.operation === 'mutate' && r.result === 'applied' && r.commands?.length) zuege.push(r.commands);
  }
  return zuege;
}

/** Beruehrt ein Zug das Element? (Knoten-uid, Kante als Quelle/Ziel, Merge.) */
export function beruehrt(commands, elementId) {
  return commands.some((c) =>
    c.node?.uid === elementId || c.uid === elementId || c.edge?.sourceId === elementId || c.edge?.targetId === elementId ||
    c.sourceUid === elementId || c.targetUid === elementId);
}

/**
 * Rein: die Bilanz ueber alle Zuege. `verpasst` = Zuege, in denen ein anwendbarer Vorschlag den
 * Steuerwert staerker gesenkt haette als der Zug des Agenten.
 */
export function schattenBilanz(zeilen) {
  const mitVorschlag = zeilen.filter((z) => z.bester);
  const verpasst = mitVorschlag.filter((z) => z.bester.score > z.agentVerbesserung + 1e-9);
  return {
    zuege: zeilen.length,
    mitAnwendbaremVorschlag: mitVorschlag.length,
    agentTrafVorschlag: mitVorschlag.filter((z) => z.agentTrifft).length,
    verpasst: verpasst.length,
    verpassteVerbesserung: Number(verpasst.reduce((a, z) => a + (z.bester.score - Math.max(0, z.agentVerbesserung)), 0).toFixed(3)),
    agentVerbesserung: Number(zeilen.reduce((a, z) => a + z.agentVerbesserung, 0).toFixed(3)),
    regeln: Object.entries(
      mitVorschlag.reduce((m, z) => ({ ...m, [z.bester.ruleId]: (m[z.bester.ruleId] ?? 0) + 1 }), {}),
    ).sort((a, b) => b[1] - a[1]),
  };
}

/** Der Berichtsabschnitt (report.mjs) — je Lauf eine Zeile aus <lauf>/schatten-suggest.json. */
export function schattenBericht(laeufe) {
  const zeilen = laeufe.map(({ label, schatten: j }) => {
    const b = j.bilanz;
    const regeln = b.regeln.map(([r, n]) => `${r}×${n}`).join(' ') || '—';
    return `| ${label} | ${b.zuege} | ${b.mitAnwendbaremVorschlag} | ${b.agentTrafVorschlag} | ${b.verpasst} | ${b.verpassteVerbesserung} | ${b.agentVerbesserung} | ${regeln} |`;
  });
  return [
    '## Schatten-graph_suggest — was haette der Optimierer je Zug vorgeschlagen? (CR-GC-609)',
    '',
    '| Lauf | Zuege | mit anwendbarem Vorschlag | Agent traf ihn | Vorschlag besser als Agent | verpasste Steuerverbesserung | Steuerverbesserung Agent | Regeln der besten Vorschlaege |',
    '|---|---:|---:|---:|---:|---:|---:|---|',
    ...zeilen,
    '',
    'Nachgespielt im Wegwerf-Arbeitsbereich durchs heutige Gate; der Agent sah davon nichts. 0 anwendbare',
    'Vorschlaege bei steigendem Steuerwert heisst: der Optimierer hat fuer die feuernden Regeln keinen Operator.',
    'Erzeugen: `node rig/greenfield-systemtest/schatten-suggest.mjs runs/<arm>-<n>`.',
  ].join('\n');
}

async function schatten(laufDir) {
  const { createHarness, bindToolsToHarness } = await import(join(GC_ROOT, 'dist', 'index.js'));
  const { generationStep } = await import(join(GC_ROOT, 'dist', 'loop', 'generate.js'));
  const zuege = angewandteZuege(readFileSync(join(laufDir, 'audit.jsonl'), 'utf8'));
  const repo = mkdtempSync(join(tmpdir(), 'gc-schatten-'));
  mkdirSync(join(repo, '.graphcode'), { recursive: true });
  const h = await createHarness({ repoRoot: repo, scope: { workspaceId: 'schatten', systemId: 'schatten' } });
  await h.initialize();
  const reg = bindToolsToHarness(h);
  const steuerwert = () =>
    generationStep(h.getGraph(), h.getMetricPolicy(), undefined, 0.8, [], 'driver', null, 'kern').steer?.sum ?? 0;
  const zeilen = [];
  try {
    for (let i = 0; i < zuege.length; i++) {
      const vorher = steuerwert();
      const s = await reg['graph_suggest'].handler({ k: 20, layer: 'arch' });
      const anwendbar = s.suggestions.filter((x) => x.applicable && x.score > 1e-12);
      const bester = anwendbar[0] ? { ruleId: anwendbar[0].ruleId, elementId: anwendbar[0].elementId, score: anwendbar[0].score } : null;
      const r = await reg['graph_mutate'].handler({ commands: zuege[i], consumerId: 'schatten' });
      if (!r.success) {
        zeilen.push({ zug: i + 1, abgelehnt: true, vorschlaege: s.suggestions.length, anwendbar: anwendbar.length, bester, agentVerbesserung: 0, agentTrifft: false });
        continue; // das heutige Gate lehnt einen Zug von damals ab — Stand bleibt, Zeile markiert
      }
      const nachher = steuerwert();
      zeilen.push({
        zug: i + 1,
        steuerVorher: Number(vorher.toFixed(3)),
        steuerNachher: Number(nachher.toFixed(3)),
        agentVerbesserung: Number((vorher - nachher).toFixed(3)),
        vorschlaege: s.suggestions.length,
        anwendbar: anwendbar.length,
        bester,
        agentTrifft: bester ? beruehrt(zuege[i], bester.elementId) : false,
      });
      process.stderr.write(`  Zug ${i + 1}/${zuege.length}: ${anwendbar.length} anwendbar\n`);
    }
  } finally {
    await h.close();
    rmSync(repo, { recursive: true, force: true });
  }
  const out = { lauf: laufDir.split('/').pop(), erzeugt: new Date().toISOString(), bilanz: schattenBilanz(zeilen), zeilen };
  writeFileSync(join(laufDir, 'schatten-suggest.json'), JSON.stringify(out, null, 2) + '\n');
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const lauf = process.argv[2];
  if (!lauf) { console.error('Aufruf: node schatten-suggest.mjs <runs/lauf>'); process.exit(2); }
  const out = await schatten(resolve(lauf));
  console.log(JSON.stringify(out.bilanz, null, 2));
}
