/**
 * CR-GC-587 — Text gegen Code: jede Entscheidung, die dem Agenten als Text begegnet, hat genau
 * eine Fassung, und kein ausgelieferter Text widerspricht ihr.
 *
 * Gefunden in der Serie CR-GC-564..583: die Rangfolge der Verdicts stand an vier Stellen, drei
 * davon falsch — zuletzt CR-GC-583 selbst, das den Steuerwert VOR dem tier nannte, waehrend
 * `rankCandidates` tier vor Steuerwert sortiert. Tests prueften den Code; niemand die Texte.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISIONS, VERDICT_ORDER, decision } from '../src/loop/decisions.js';
import { generationStep } from '../src/loop/generate.js';
import { rankCandidates } from '../src/loop/executor-rank.js';
import { guardrailsContent } from '../src/surface/scaffold-docs.js';
import { DEFAULT_METRIC_POLICY } from '@sigloch/contracts/se';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Alles, was ein Agent zu lesen bekommt: Skills, Scaffold-Doku, Prompt-Quellen. */
function ausgelieferteTexte(): { pfad: string; text: string }[] {
  const out: { pfad: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.md')) out.push({ pfad: p.slice(ROOT.length), text: readFileSync(p, 'utf8') });
    }
  };
  walk(join(ROOT, '.claude', 'commands'));
  for (const f of ['src/loop/generate.ts', 'src/loop/executor-prompt.ts', 'src/surface/scaffold-docs.ts']) {
    out.push({ pfad: f, text: readFileSync(join(ROOT, f), 'utf8') });
  }
  return out;
}

describe('CR-GC-587: kein ausgelieferter Text widerspricht dem Register', () => {
  const texte = ausgelieferteTexte();

  it('liest Skills, Scaffold-Doku und Prompt-Quellen — nicht nur eine Datei', () => {
    expect(texte.length).toBeGreaterThan(20);
    expect(texte.some((t) => t.pfad.endsWith('se/generate.md'))).toBe(true);
  });

  for (const [key, d] of Object.entries(DECISIONS)) {
    it(`${key} (${d.source}): keine widersprechende Formulierung in irgendeinem Text`, () => {
      const treffer: string[] = [];
      for (const t of texte) {
        // Kommentare in .ts-Quellen zitieren die alten Formulierungen als Befund — die zaehlen nicht.
        const ohneKommentare = t.pfad.endsWith('.ts') ? t.text.replace(/^\s*(\/\/|\*|\/\*).*$/gm, '') : t.text;
        for (const re of d.forbidden) {
          const m = ohneKommentare.match(re);
          if (m) treffer.push(`${t.pfad}: "${m[0].slice(0, 80)}"`);
        }
      }
      expect(treffer, `widerspricht ${key}:\n  ${treffer.join('\n  ')}`).toEqual([]);
    });
  }

  it('der Host-Prompt setzt die Saetze des Registers ein, statt sie zu wiederholen', () => {
    const step = generationStep(
      { nodes: [], edges: [] } as never,
      DEFAULT_METRIC_POLICY,
      'Ein Testsystem, das etwas leistet.',
      0.8,
    );
    expect(step.prompt).toContain(decision('probe'));
    expect(step.prompt).toContain(decision('verdictRank'));
  });

  it('se:generate traegt dieselbe Rangfolge in derselben Reihenfolge', () => {
    const md = texte.find((t) => t.pfad.endsWith('se/generate.md'))!.text;
    const pos = ['`block` verwerfen', '`steeringDelta`', 'blockierender Fehler', '`tier`', '`steerAdvisory.improvement`'].map((s) => md.indexOf(s));
    expect(pos.every((p) => p >= 0), `fehlt: ${pos}`).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });
});

describe('CR-GC-592: offene Punkte werden Annahmen, keine Rueckfragen ins Leere', () => {
  it('se:generate und GRAPHCODE.md tragen die Regel', () => {
    const md = readFileSync(join(ROOT, '.claude/commands/se/generate.md'), 'utf8');
    expect(md).toContain(decision('openQuestions'));
    const guard = guardrailsContent();
    expect(guard).toContain('## When the brief leaves something open');
    expect(guard).toMatch(/as an assumption/);
    expect(guard).toMatch(/headless run/);
  });
});

describe('CR-GC-594: die Abnahme-Politik steht einmal und ueberall gleich', () => {
  it('CR-GC-596: se:generate traegt den stalled-Satz woertlich', () => {
    const md = readFileSync(join(ROOT, '.claude/commands/se/generate.md'), 'utf8');
    expect(md).toContain(decision('stalled'));
  });

  it('se:generate traegt den Registersatz woertlich', () => {
    const md = readFileSync(join(ROOT, '.claude/commands/se/generate.md'), 'utf8');
    expect(md).toContain(decision('acceptance'));
  });

  it('der Guide nennt acceptedFindings an jedem Typ, mit genau der abnehmbaren Klasse', async () => {
    const { attributesFor } = await import('../src/projections/authoring-example.js');
    const { ABNEHMBAR_JE_TASK } = await import('../src/loop/decisions.js');
    const alle = [...new Set(Object.values(ABNEHMBAR_JE_TASK).flat())];
    for (const t of ['REQ', 'FUNC', 'MOD', 'SYS', 'UC']) {
      const a = attributesFor(t).find((x: { key: string }) => x.key === 'acceptedFindings');
      expect(a, t).toBeDefined();
      expect(a!.enumValues).toEqual(alle);
    }
  });

  it('keine Architekturregel ist abnehmbar', async () => {
    const { ABNEHMBAR_JE_TASK } = await import('../src/loop/decisions.js');
    const { STEER_RULES } = await import('@sigloch/se-engine');
    const alle = new Set(Object.values(ABNEHMBAR_JE_TASK).flat());
    for (const id of [...STEER_RULES, 'R-02', 'R-10', 'R-15', 'R-22', 'RD-01', 'RD-05', 'UC-01', 'UC-02', 'FC-02', 'FC-04', 'IO-01']) {
      expect(alle.has(id), id).toBe(false);
    }
  });
});

describe('CR-GC-587: VERDICT_ORDER ist die Ordnung von rankCandidates, nicht eine zweite', () => {
  const steer = (improvement: number) => ({
    rules: ['RD-04'], before: 1, after: 1 - improvement, improvement, worstAt: null, removesElements: false,
  });
  const cand = (index: number, tier: string, improvement: number) => ({
    index,
    verdict: { success: true, tier, mutations: 3, steerAdvisory: steer(improvement) },
  });

  it('tier vor Steuerwert — der Fehler in CR-GC-583s Prosa', () => {
    // A: schlechteres tier, besserer Steuerwert. B: besseres tier, kein Steuerwert-Gewinn.
    const [erster] = rankCandidates([cand(0, 'suggest', 0.5), cand(1, 'auto-apply', 0)] as never);
    expect(erster.index).toBe(1);
    expect(VERDICT_ORDER.findIndex((v) => v.key === 'tier')).toBeLessThan(VERDICT_ORDER.findIndex((v) => v.key === 'steerImprovement'));
  });

  it('bei gleichem tier entscheidet der Steuerwert — die Parse-Gegenprobe', () => {
    const [erster] = rankCandidates([cand(0, 'suggest', 0), cand(1, 'suggest', 0.5)] as never);
    expect(erster.index).toBe(1);
  });

  it('der Registersatz nennt die Kriterien in der Ordnung des Komparators', () => {
    const t = decision('verdictRank');
    const pos = VERDICT_ORDER.map((v) => t.indexOf(v.text));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });
});
