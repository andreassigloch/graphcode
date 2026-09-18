#!/usr/bin/env node
// CR-GC-549 — Zugverlauf: die Kennzahlen JE ZUG, rekonstruiert aus dem Audit-Log.
//
// Warum rekonstruiert und nicht mitgeschrieben: `kennzahlen.mjs` (CR-GC-546/548) braucht einen
// laufenden Host und einen Menschen, der es aufruft. Gemessen am ersten Fremdlauf (sigllm,
// 2026-09-17/18): 105 Graphversionen, EINE Zeile. Ein Verlauf, den jemand von Hand auslösen
// muss, ist kein Verlauf.
//
// Das Log kann es besser, weil es das ohnehin schon trägt: CR-GC-234 schreibt jeden Stapel MIT
// seinen Kommandos, also ist der Graph an jeder Version wiederherstellbar. Derselbe Applier wie
// im Gate (`applyCommands`), dieselbe Projektion wie in der Konformanz (`toOntologyGraph`),
// dieselbe Metrik wie im Optimizer (`metrics`) — ein Rechenweg, kein zweites Ergebnis.
//
//   node scripts/zugverlauf.mjs <repo>            Verlauf + Kennzahlen schreiben
//   node scripts/zugverlauf.mjs <repo> --verify   gegen docs/graph/<member>.graph.json prüfen
//   node scripts/zugverlauf.mjs <repo> --dry      nur zeigen
//
// Read-only gegenüber dem Graphen: es wird NICHTS mutiert, nur gelesen und gerechnet.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyCommands, cloneGraph } from '../dist/kernel/apply-commands.js';
import { toOntologyGraph } from '../dist/kernel/conformance.js';
import { metrics, METRIC_DIMENSIONS, steerScore } from '@sigloch/se-engine';
// Der Gate-Befund im Log ist STAPELBEZOGEN — er nennt, was dieser Stapel auslöste, nicht den
// Stand des Graphen. Gemessen an sigllm v101: letzter Gate-Befund E1/W0, voller Katalog 16/219.
// Für einen Verlauf zählt der Stand, also wird je Version neu gerechnet — mit demselben
// Katalog und derselben Policy, die auch `rules_evaluate` nimmt.
import { evaluateAllRules, DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';

// ---------------------------------------------------------------------------
// Rechenkern — exportiert, damit der Test denselben Weg nimmt wie die CLI.
// ---------------------------------------------------------------------------

/**
 * Den Graphen aus den Kommandos des Logs nachvollziehen und je Zug messen.
 *
 * Wirft, wenn das Log nicht bei Version 0 beginnt: dann fehlt der Zustand davor, und ein
 * Verlauf ab einem unbekannten Anfang wäre geraten. (graphcode selbst ist so ein Fall —
 * sein Modell ist älter als sein Log.)
 */
export function replayZuege(records) {
  // Rekonstruierbar ist ein Log, dessen ERSTER Datensatz auf dem LEEREN Graphen aufsetzt.
  // Der Vorzustand ist graphVersion-1, wenn dieser Datensatz selbst die Version bewegt hat
  // (applied mutate), sonst die Version selbst. Nur der Vorzustand 0 ist bekannt.
  const ersterSatz = records[0];
  const bewegt = ersterSatz?.operation === 'mutate' && ersterSatz?.result === 'applied';
  const vorzustand = (ersterSatz?.graphVersion ?? 0) - (bewegt ? 1 : 0);
  if (vorzustand > 0) {
    throw new Error(
      `Log beginnt auf graphVersion ${vorzustand}, nicht auf dem leeren Graphen — der Zustand davor steht nirgends.`,
    );
  }
  let graph = { nodes: [], edges: [] };
  const zeilen = [];
  const standBeiVersion = new Map();
  const zaehle = (viol, schwere) => viol.filter((v) => v.severity === schwere).length;

  for (const r of records) {
    const angewendet = r.operation === 'mutate' && r.result === 'applied';
    if (angewendet && r.commands?.length) {
      graph = applyCommands(cloneGraph(graph), r.commands).graph;
    }
    const og = toOntologyGraph(graph);
    const m = metrics(og, { layer: 'arch' });
    // Stand nach diesem Zug (voller Katalog) vs. was das Gate zu diesem Stapel sagte.
    const stand = evaluateAllRules(og, DEFAULT_METRIC_POLICY);
    const steer = steerScore(stand);
    zeilen.push({
      ts: r.timestamp,
      v: r.graphVersion,
      op: r.operation,
      ergebnis: r.result,
      consumer: r.consumerId,
      kommandos: r.commands?.length ?? 0,
      knoten: og.elements.length,
      kanten: og.traces.length,
      r6: Object.fromEntries(METRIC_DIMENSIONS.map((d) => [d, Number(m[d].toFixed(4))])),
      steer: Number((steer.score ?? 0).toFixed(4)),
      worstAt: steer.worstAt ? `${steer.worstAt.ruleId}@${steer.worstAt.elementId}` : null,
      error: zaehle(stand, 'error'),
      warning: zaehle(stand, 'warning'),
      // `evaluateAllRules` liefert snake_case (rule_id), das Gate camelCase (ruleId) — zwei
      // Formen für dasselbe Feld. Hier wird auf EINE normalisiert.
      standRegeln: Object.entries(
        stand
          .filter((v) => v.severity === 'error')
          .reduce((a, v) => ({ ...a, [v.rule_id ?? v.ruleId]: (a[v.rule_id ?? v.ruleId] ?? 0) + 1 }), {}),
      ).sort((a, b) => b[1] - a[1]),
      // Gate-Befund zu DIESEM Stapel — die Zahl, die das Log bisher als einzige trug.
      gateError: zaehle(r.violations ?? [], 'error'),
      gateWarning: zaehle(r.violations ?? [], 'warning'),
      // Die Stempel, aus denen die Nutzungsraten kommen (CR-GC-434). `null` heißt NICHT
      // ERFASST, `[]` heißt gemessen leer — der Unterschied ist die halbe Aussage.
      consultedTools: r.consultedTools ?? null,
      respondsTo: r.respondsTo ? r.respondsTo.map((x) => x.ruleId) : null,
      editSource: r.editSource ?? null,
      trigger: r.trigger ?? null,
      intent: r.intent ? true : false,
      fehlerRegeln: [...new Set((r.violations ?? []).filter((v) => v.severity === 'error').map((v) => v.ruleId))],
      rulesPassed: r.rulesPassed?.length ?? null,
    });
    if (angewendet) standBeiVersion.set(r.graphVersion, og);
  }
  return { zeilen, standBeiVersion };
}

/** Rekonstruierter Stand gegen einen exportierten Snapshot — die Prüfung des Replays. */
export function pruefeGegenSnapshot(standBeiVersion, snapshot) {
  const ist = standBeiVersion.get(snapshot.graphVersion);
  if (!ist) return { ok: false, grund: `Version ${snapshot.graphVersion} nicht im Log` };
  const key = (t) => `${t.source}|${t.type}|${t.target}`;
  const idsSoll = new Set(snapshot.elements.map((e) => e.id));
  const idsIst = new Set(ist.elements.map((e) => e.id));
  const trSoll = new Set(snapshot.traces.map(key));
  const trIst = new Set(ist.traces.map(key));
  const nurSoll = [...idsSoll].filter((x) => !idsIst.has(x));
  const nurIst = [...idsIst].filter((x) => !idsSoll.has(x));
  const trNurSoll = [...trSoll].filter((x) => !trIst.has(x));
  const trNurIst = [...trIst].filter((x) => !trSoll.has(x));
  return {
    ok: !nurSoll.length && !nurIst.length && !trNurSoll.length && !trNurIst.length,
    knotenSoll: idsSoll.size,
    knotenIst: idsIst.size,
    kantenSoll: trSoll.size,
    kantenIst: trIst.size,
    nurSoll,
    nurIst,
    trNurSoll,
    trNurIst,
  };
}


/** Die Kennzahlen des ganzen Laufs aus den Zug-Zeilen — Waste, Nutzung, Architekturweg. */
export function laufKennzahlen(zeilen) {
  const mut = zeilen.filter((z) => z.op === 'mutate');
  const val = zeilen.filter((z) => z.op === 'validate');
  const abgelehnt = zeilen.filter((z) => z.ergebnis !== 'applied');
  const cmdGesamt = zeilen.reduce((s, z) => s + z.kommandos, 0);
  const cmdVerworfen = abgelehnt.reduce((s, z) => s + z.kommandos, 0);
  const haeufig = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
  const zaehl = (paare) => paare.reduce((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {});

  const ursachen = zaehl(abgelehnt.flatMap((z) => z.fehlerRegeln));
  const mitTools = mut.filter((z) => z.consultedTools && z.consultedTools.length > 0);
  const antwortet = mut.filter((z) => z.respondsTo && z.respondsTo.length > 0);
  const angewendet = mut.filter((z) => z.ergebnis === 'applied');
  // Der Kern des Ganzen: wie oft meldete das Gate "nichts", während der Graph Fehler trug.
  const stillGruen = angewendet.filter((z) => z.gateError === 0 && z.error > 0).length;
  // Wie oft bewegte ein Zug die Architekturkennzahl ueberhaupt? Eine Kennzahl, die sich
  // nicht bewegt, steuert nicht — egal wie richtig sie ist.
  let bewegt = 0;
  for (let i = 1; i < angewendet.length; i++) {
    if (METRIC_DIMENSIONS.some((d) => Math.abs(angewendet[i].r6[d] - angewendet[i - 1].r6[d]) > 1e-9)) bewegt++;
  }
  const letzte = zeilen[zeilen.length - 1];
  const erste = zeilen.find((z) => z.knoten > 0) ?? zeilen[0];

  return {
    lauf: { von: zeilen[0].ts, bis: letzte.ts, zuege: zeilen.length, mutate: mut.length, validate: val.length },
    endstand: { version: letzte.v, knoten: letzte.knoten, kanten: letzte.kanten, error: letzte.error, warning: letzte.warning },
    waste: {
      abgelehnteZuege: abgelehnt.length,
      ablehnquote: Number((abgelehnt.length / zeilen.length).toFixed(4)),
      kommandosGesamt: cmdGesamt,
      kommandosVerworfen: cmdVerworfen,
      verworfenAnteil: Number((cmdVerworfen / cmdGesamt).toFixed(4)),
      dryRunAnteil: Number((val.length / zeilen.length).toFixed(4)),
      vomDryRunGefangen: abgelehnt.filter((z) => z.op === 'validate').length,
      ursachen: haeufig(ursachen),
    },
    sichtbarkeit: {
      angewendeteZuege: angewendet.length,
      gateStillObwohlFehler: stillGruen,
      stillAnteil: Number((stillGruen / (angewendet.length || 1)).toFixed(4)),
    },
    nutzung: {
      mutationenMitVorherigerLesung: mitTools.length,
      konsultationsrate: Number((mitTools.length / (mut.length || 1)).toFixed(4)),
      werkzeuge: haeufig(zaehl(mut.flatMap((z) => z.consultedTools ?? []))),
      editSource: zaehl(mut.map((z) => z.editSource ?? 'nicht erfasst')),
      trigger: zaehl(zeilen.map((z) => z.trigger ?? 'nicht erfasst')),
      mutationenMitRegelbezug: antwortet.length,
      regelbezugsrate: Number((antwortet.length / (mut.length || 1)).toFixed(4)),
      beantworteteRegeln: haeufig(zaehl(mut.flatMap((z) => z.respondsTo ?? []))),
    },
    architektur: {
      zuegeMitBewegung: bewegt,
      bewegungsrate: Number((bewegt / (angewendet.length - 1 || 1)).toFixed(4)),
      erste: erste.r6,
      letzte: letzte.r6,
      delta: Object.fromEntries(METRIC_DIMENSIONS.map((d) => [d, Number((letzte.r6[d] - erste.r6[d]).toFixed(4))])),
    },
  };
}

// ---------------------------------------------------------------------------
// CLI — laeuft nur beim Aufruf. Ohne diese Schranke fuehrt schon der Import (Test,
// spaeterer Aufrufer) den ganzen Ablauf samt process.exit aus.
// ---------------------------------------------------------------------------
if (import.meta.url !== pathToFileURL(process.argv[1] ?? '').href) {
  // importiert, nicht aufgerufen — der Rechenkern oben ist alles, was der Importeur bekommt.
} else {
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const REPO = (args.find((a) => !a.startsWith('--')) ?? process.cwd()).replace(/\/+$/, '');
const MEMBER = REPO.split('/').pop();
const LOG = join(REPO, '.graphcode/audit.jsonl');

if (!existsSync(LOG)) {
  console.error(`Kein Audit-Log in ${REPO}: ${LOG} fehlt.`);
  process.exit(1);
}

const records = readFileSync(LOG, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

let zeilen, standBeiVersion;
try {
  ({ zeilen, standBeiVersion } = replayZuege(records));
} catch (e) {
  console.error(`${e.message}\nRekonstruierbar ist nur ein Lauf, dessen Log den Graphen von Anfang an trägt.`);
  process.exit(1);
}

if (flags.has('--verify')) {
  const pfad = join(REPO, `docs/graph/${MEMBER}.graph.json`);
  if (!existsSync(pfad)) {
    console.error(`Kein Snapshot zum Vergleich: ${pfad}`);
    process.exit(1);
  }
  const soll = JSON.parse(readFileSync(pfad, 'utf8'));
  const p = pruefeGegenSnapshot(standBeiVersion, soll);
  console.log(`PRÜFUNG gegen ${MEMBER}.graph.json @ v${soll.graphVersion}`);
  if (p.grund) {
    console.log(`  ${p.grund}`);
    process.exit(2);
  }
  console.log(`  Knoten  Snapshot ${p.knotenSoll}  Replay ${p.knotenIst}  nur-Snapshot ${p.nurSoll.length}  nur-Replay ${p.nurIst.length}`);
  console.log(`  Kanten  Snapshot ${p.kantenSoll}  Replay ${p.kantenIst}  nur-Snapshot ${p.trNurSoll.length}  nur-Replay ${p.trNurIst.length}`);
  if (p.nurSoll.length) console.log(`  nur im Snapshot: ${p.nurSoll.slice(0, 10).join(', ')}`);
  if (p.nurIst.length) console.log(`  nur im Replay:   ${p.nurIst.slice(0, 10).join(', ')}`);
  if (p.trNurSoll.length) console.log(`  Kante nur Snapshot: ${p.trNurSoll.slice(0, 5).join(' · ')}`);
  if (p.trNurIst.length) console.log(`  Kante nur Replay:   ${p.trNurIst.slice(0, 5).join(' · ')}`);
  console.log(`  → ${p.ok ? 'IDENTISCH' : 'ABWEICHUNG'}`);
  process.exit(p.ok ? 0 : 2);
}

// Die Prüfung läuft IMMER mit, nicht nur auf Verlangen. Ein Versionszähler, der bei 0
// weiterläuft, obwohl der Graph schon Knoten hatte, macht die Vorzustands-Schranke oben zu
// einem falschen Grün — gemessen an graphcode selbst: Log ab v0, Snapshot trägt 115 Knoten,
// die kein Kommando im Log je angelegt hat. Deshalb steht das Ergebnis IM Kopf der Datei.
function selbstpruefung() {
  const pfad = join(REPO, `docs/graph/${MEMBER}.graph.json`);
  if (!existsSync(pfad)) return { lage: 'kein Snapshot', text: 'kein Snapshot zum Abgleich — der Verlauf ist ungeprüft.' };
  const soll = JSON.parse(readFileSync(pfad, 'utf8'));
  const p = pruefeGegenSnapshot(standBeiVersion, soll);
  if (p.grund) return { lage: 'nicht prüfbar', text: `Snapshot steht auf v${soll.graphVersion}; ${p.grund}.` };
  if (p.ok) {
    return {
      lage: 'geprüft',
      text: `Replay == Snapshot bei v${soll.graphVersion} (${p.knotenSoll} Knoten / ${p.kantenSoll} Kanten, keine Abweichung).`,
    };
  }
  return {
    lage: 'ABWEICHUNG',
    text:
      `Replay != Snapshot bei v${soll.graphVersion}: Knoten ${p.knotenIst} statt ${p.knotenSoll} ` +
      `(${p.nurSoll.length} nur im Snapshot, ${p.nurIst.length} nur im Replay), Kanten ${p.kantenIst} statt ${p.kantenSoll}. ` +
      `Das Log trägt den Graphen NICHT von Anfang an — die Zeilen unten sind der Weg der geloggten Züge, nicht der Weg des Modells.`,
  };
}
const pruef = selbstpruefung();

const k = laufKennzahlen(zeilen);
if (flags.has('--dry')) {
  console.log(JSON.stringify(k, null, 2));
  process.exit(0);
}

const kopf = `# Zugverlauf — ${MEMBER}

Rekonstruiert aus \`.graphcode/audit.jsonl\` von \`scripts/zugverlauf.mjs\` (CR-GC-549), nie von Hand.
Eine Zeile je Zug, auch je abgelehntem. \`kennzahlen.md\` trägt die Meilensteinzeilen MIT
Quellcode-Bindung (Reichweite, Grenzmenge); hier steht der Modellweg, den das Log allein trägt.

**Selbstprüfung: ${pruef.lage}** — ${pruef.text}

**ℝ⁶ (arch)** = ${METRIC_DIMENSIONS.join(' / ')} · **Steuerung** = Chebyshev über die Regelüberschüsse.
**Stand-E/W** = voller Regelkatalog am Graphen NACH dem Zug. **Gate-E** = was das Gate zu DIESEM
Stapel meldete. Die beiden sind nicht dasselbe, und die Differenz ist der Grund für diese Datei.
**Konsult.** = Lesewerkzeuge zwischen der letzten und dieser Mutation; \`—\` heißt nicht erfasst
(Vorschau-Datensätze tragen keine Stempel), \`0\` heißt gemessen keine.

| ts | v | op | Ergebnis | cmd | Knoten | Kanten | ℝ⁶ (arch) | Steuerung | dominant | Stand-E | Stand-W | Gate-E | Konsult. | Quelle | Auslöser |
|---|---:|---|---|---:|---:|---:|---|---:|---|---:|---:|---:|---:|---|---|
`;

const tabelle = zeilen
  .map((z) => {
    const r6 = METRIC_DIMENSIONS.map((d) => z.r6[d].toFixed(3)).join(' / ');
    const kons = z.consultedTools === null ? '—' : String(z.consultedTools.length);
    return `| ${z.ts.slice(5, 19)} | ${z.v} | ${z.op} | ${z.ergebnis} | ${z.kommandos} | ${z.knoten} | ${z.kanten} | ${r6} | ${z.steer.toFixed(3)} | ${z.worstAt ?? '—'} | ${z.error} | ${z.warning} | ${z.gateError} | ${kons} | ${z.editSource ?? '—'} | ${z.trigger ?? '—'} |`;
  })
  .join('\n');

writeFileSync(join(REPO, 'docs/zugverlauf.md'), `${kopf}${tabelle}\n\n## Kennzahlen des Laufs\n\n\`\`\`json\n${JSON.stringify(k, null, 2)}\n\`\`\`\n`);
writeFileSync(join(REPO, 'docs/zugverlauf.json'), JSON.stringify({ selbstpruefung: pruef, kennzahlen: k, zuege: zeilen }, null, 2));
console.log(`Selbstprüfung: ${pruef.lage} — ${pruef.text}`);
console.log(`${zeilen.length} Züge rekonstruiert, Endstand v${k.endstand.version}: ${k.endstand.knoten} Knoten / ${k.endstand.kanten} Kanten`);
console.log(`→ ${REPO}/docs/zugverlauf.md`);
console.log(`→ ${REPO}/docs/zugverlauf.json`);
}
