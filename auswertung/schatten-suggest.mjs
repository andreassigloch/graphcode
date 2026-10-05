/**
 * schatten-suggest.mjs — was HÄTTE `graph_suggest` an jedem Zug vorgeschlagen, und hat der Agent es getroffen?
 * (Leitlinie T-M5, CR-GC-609.) Der interaktive Agent ruft `graph_suggest` nie; der Kanal ist sonst ungemessen.
 *
 * Nachgespielt mit `nachspielen` im Wegwerf-Store: vor jeder angewandten Mutation der Steuerwert und der beste
 * anwendbare Vorschlag, danach der Steuerwert wieder — `agentTrifft`, wenn die Mutation das Element des Vorschlags
 * berührt. Herkunft: rig/greenfield-systemtest (dort noch mit `createHarness` statt `openMeasured`); hierher mit CR-GC-739.
 *
 * @author andreas@siglochconsulting
 */
import { join } from 'node:path';
import { nachspielen } from './nachspielen.mjs';

/** Berührt ein Zug das Element? (Knoten-uid, Kante als Quelle/Ziel, Merge.) */
export function beruehrt(commands, elementId) {
  return commands.some((c) =>
    c.node?.uid === elementId || c.uid === elementId || c.edge?.sourceId === elementId || c.edge?.targetId === elementId ||
    c.sourceUid === elementId || c.targetUid === elementId);
}

/**
 * Rein: die Bilanz über alle Züge. `verpasst` = Züge, in denen ein anwendbarer Vorschlag den Steuerwert stärker
 * gesenkt hätte als der Zug des Agenten.
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
    regeln: Object.entries(mitVorschlag.reduce((m, z) => ({ ...m, [z.bester.ruleId]: (m[z.bester.ruleId] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]),
  };
}

export async function schatten(laufDir, repo = join(laufDir, 'todo'), { basis = null } = {}) {
  const { generationStep } = await import('../dist/loop/generate.js');
  const zeilen = [];
  let offen = null;
  const steuerwert = (leer) => generationStep(leer.graph(), leer.policy, undefined, 0.8, [], 'driver', null, 'kern').steer?.sum ?? 0;
  // Der Stand nach dem vorigen Zug ist der Stand vor diesem: die offene Zeile schließt mit dem heutigen Steuerwert.
  const schliessen = (leer) => {
    if (!offen) return;
    const nachher = steuerwert(leer);
    offen.steuerNachher = Number(nachher.toFixed(3));
    offen.agentVerbesserung = Number((offen.steuerVorher - nachher).toFixed(3));
    offen = null;
  };
  await nachspielen(join(laufDir, 'audit.jsonl'), repo, Infinity, {
    basis,
    jeZug: async (leer, i, commands) => {
      schliessen(leer);
      const vorher = steuerwert(leer);
      const s = await leer.tools.graph_suggest.handler({ k: 20, layer: 'arch' });
      const anwendbar = (s.suggestions ?? []).filter((x) => x.applicable && x.score > 1e-12);
      const bester = anwendbar[0] ? { ruleId: anwendbar[0].ruleId, elementId: anwendbar[0].elementId, score: anwendbar[0].score } : null;
      offen = { zug: i + 1, steuerVorher: Number(vorher.toFixed(3)), steuerNachher: null, agentVerbesserung: 0, vorschlaege: (s.suggestions ?? []).length, anwendbar: anwendbar.length, bester, agentTrifft: bester ? beruehrt(commands, bester.elementId) : false };
      zeilen.push(offen);
    },
    amEnde: async (leer) => schliessen(leer),
  });
  return { bilanz: schattenBilanz(zeilen), zeilen };
}
