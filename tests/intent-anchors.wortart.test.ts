/**
 * TEST-intent-anchors-wortart (CR-GC-687) — Anker sind Begriffe, keine Verben/Funktionswoerter.
 *
 * Gemessen im Rig `sigllm-spezifikation`: der Auftrag „Spezifiziere das System SIG Local bis zur
 * Implementierungsreife. Die Projektdefinition liegt im Workspace …" lieferte die Anker
 * `spezifiziere`, `bis`, `liegt` — und der Rundenprompt forderte jede Runde einen Use Case fuer sie
 * („Noch nirgends beschrieben: spezifiziere, bis, liegt"). Ursache: `extractIntentAnchors`
 * kleinschreibt vor dem Filtern und verwirft damit das einzige Wortart-Signal, das der deutsche
 * Text von sich aus traegt — die Grossschreibung der Substantive.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { extractIntentAnchors, intentCoverage } from '../src/loop/target-profile.js';

const RIG_AUFTRAG =
  'Spezifiziere das System SIG Local bis zur Implementierungsreife. Die Projektdefinition liegt ' +
  'im Workspace unter ./material/docs/project/sig-local-projektdefinition.md — sie ist der einzige Input.';

describe('CR-GC-687: deutsche Anker nur aus Substantiven und Eigennamen', () => {
  it('der Rig-Auftrag liefert keine Verben, Praepositionen oder Pfadsplitter als Anker', () => {
    const anker = extractIntentAnchors(RIG_AUFTRAG);
    for (const falsch of ['spezifiziere', 'bis', 'liegt', 'unter', 'einzige', 'material', 'docs', 'md']) {
      expect(anker).not.toContain(falsch);
    }
    expect(anker).toEqual(['sig', 'local', 'implementierungsreife', 'projektdefinition', 'workspace', 'input']);
  });

  it('der Rundenprompt meldet deshalb keine Stoppwoerter als unbeschrieben', () => {
    // Die Wirkung, nicht der Mechanismus: was intentCoverage als offen meldet, landet
    // woertlich in „Noch nirgends beschrieben: …".
    const anker = extractIntentAnchors(RIG_AUFTRAG);
    const offen = intentCoverage(anker, []).map((c) => c.anchor);
    expect(offen).not.toEqual(expect.arrayContaining(['spezifiziere']));
    expect(offen).not.toEqual(expect.arrayContaining(['liegt']));
    expect(offen).not.toEqual(expect.arrayContaining(['bis']));
  });

  it('ein Substantiv am Satzanfang zaehlt, sobald es im Satzinneren wieder gross steht', () => {
    // Satzanfang ist mehrdeutig (Verb im Imperativ oder Substantiv) — erst ein zweites,
    // eindeutiges Vorkommen entscheidet.
    const anker = extractIntentAnchors('Kunden bestellen Ersatzteile. Der Shop zeigt Kunden ihre Rechnungen.');
    expect(anker).toEqual(['kunden', 'ersatzteile', 'shop', 'rechnungen']);
  });

  it('ein englischer Auftrag bleibt beim Funktionswort-Filter — Englisch schreibt Substantive klein', () => {
    const anker = extractIntentAnchors('A shop where customers order spare parts and pay invoices');
    expect(anker).toEqual(['shop', 'customers', 'order', 'spare', 'parts', 'pay', 'invoices']);
  });
});
