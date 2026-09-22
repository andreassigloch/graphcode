/**
 * CR-GC-591 — die Steuerungskanaele BEIDER Treiber stehen im Modell, mit Rang und Zeitpunkt.
 *
 * CR-GC-573 modellierte die neun Kanaele des Executor-Rundenprompts. Die Kanaele, ueber die
 * Claude Code gesteuert wird (Gate-Verdict, `next`, Advisories, Skill-Verweis, GRAPHCODE.md,
 * Freigabe), fehlten — und genau die toten darunter fielen erst im Bericht auf. Der Rang
 * (channel-rank.ts) sagt, wer gewinnt; der Zeitpunkt sagt, ob der Kanal VOR der Entscheidung
 * ueberhaupt da ist. Beides muss am Knoten stehen, sonst ist es im Bericht nicht pruefbar.
 *
 * Liest die committete SSOT. Eine Modellaenderung kann ihn rot machen — das ist der Zweck.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHANNEL_ORDER, CHANNEL_TIMINGS, rankOf, type Channel } from '../src/loop/channel-rank.js';

type El = { id: string; type: string; name: string; channelRank?: string; zeitpunkt?: string; treiber?: string; attributes?: Record<string, unknown> };
type Tr = { source: string; target: string; type: string };
const g = JSON.parse(readFileSync(fileURLToPath(new URL('../docs/graph/graphcode.graph.json', import.meta.url)), 'utf8')) as { elements: El[]; traces: Tr[] };
const at = (e: El, k: 'channelRank' | 'zeitpunkt' | 'treiber'): unknown => e[k] ?? e.attributes?.[k];
const kanaele = g.elements.filter((e) => e.type === 'FLOW' && e.id.startsWith('FLOW-channel-'));

describe('CR-GC-591: jeder Kanal traegt Rang, Zeitpunkt und Treiber', () => {
  it('es gibt Kanaele fuer beide Treiber', () => {
    const treiber = new Set(kanaele.map((k) => String(at(k, 'treiber'))));
    expect(treiber.has('executor')).toBe(true);
    expect(treiber.has('host')).toBe(true);
    expect(kanaele.length).toBeGreaterThanOrEqual(9 + 6);
  });

  for (const k of kanaele) {
    it(`${k.id}: Rang aus CHANNEL_ORDER, Zeitpunkt aus CHANNEL_TIMINGS, Treiber benannt`, () => {
      expect(CHANNEL_ORDER as readonly string[]).toContain(at(k, 'channelRank'));
      expect(CHANNEL_TIMINGS as readonly string[]).toContain(at(k, 'zeitpunkt'));
      expect(['host', 'executor', 'beide']).toContain(at(k, 'treiber'));
      // Jeder Kanal ist ein Beitrag zum Rundenprompt — ein Vertrag fuer alle (CR-GC-573).
      expect(g.traces.some((t) => t.source === k.id && t.type === 'relation' && t.target === 'SCHEMA-steering-channel')).toBe(true);
    });
  }

  it('die Host-Kanaele der Bericht-Tabelle sind da: Verdict, next, Advisories, Skill-Verweis, Guardrails, Freigabe', () => {
    const ids = new Set(kanaele.map((k) => k.id));
    for (const id of ['FLOW-channel-gate-verdict', 'FLOW-channel-next-step', 'FLOW-channel-steer-advisory',
      'FLOW-channel-fit-advisory', 'FLOW-channel-skill-reference', 'FLOW-channel-guardrails', 'FLOW-channel-handoff']) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('was NACH der Entscheidung kommt, hat nie den Rang eines Imperativs — sonst gaebe es zwei Stimmen je Runde', () => {
    // Zwei Ausnahmen, beide begruendet: das Gate-Verdict IST die Gate-Wahrheit (Rang 1) und kommt
    // naturgemaess als Antwort; `next` IST der Imperativ der naechsten Runde, nur frueher transportiert.
    for (const k of kanaele) {
      if (at(k, 'zeitpunkt') !== 'antwort' || k.id === 'FLOW-channel-next-step' || at(k, 'channelRank') === 'gate-truth') continue;
      expect(rankOf(at(k, 'channelRank') as Channel), `${k.id} kommt nach der Entscheidung und darf keinen Imperativ-Rang tragen`)
        .toBeGreaterThan(rankOf('rule-clause'));
    }
  });
});
