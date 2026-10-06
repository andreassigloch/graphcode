/**
 * task-clause.ts — der Imperativ einer Analyse-Runde im Executor (CR-GC-724).
 *
 * Im Task steht zuerst sein Eintrittspunkt im Fokus (AF-01..05, „das Artefakt fehlt“). Für einen
 * Client mit Skills reicht der Verweis auf den Skill. Der Executor kann keinen Skill laden — und
 * gemessen wirken beim lokalen Modell Vorbilder, Verweise nicht (CR-GC-650..664; local-2: der
 * konkrete kinds-Hinweis wurde in 1 von 1 Zügen befolgt, „Link a TEST element via verify trace“ in
 * 0 von 4). Darum trägt jede Analyse hier, wie die Regel-Klauseln in generate.ts, EINEN Auftrag und
 * EIN Vorbild in Format-E: die Form des Artefakts, mit den uids des Graphen, ohne Fachinhalt.
 *
 * Der Stempel kommt im Text nicht vor: ihn setzt der Executor, wenn das Artefakt steht
 * (task-artifact.ts). Der Bauplan hat keinen (CR-GC-752): sein Vorbild schreibt OFFENE Aufträge
 * (`@status open`) — der erste schließt die Eintrittsregel AF-05.
 *
 * @author andreas@siglochconsulting
 */
import type { OntologyGraph } from '@sigloch/contracts/se';
import { offen, type AnalyseTask, type TaskGraph } from './task-artifact.js';

export interface TaskKlausel {
  /** Die Typen, deren Grammatik und Bestand die Runde braucht. */
  types: readonly string[];
  text: (og: OntologyGraph) => string;
}

/** Dieselbe neutrale Form, die der Executor aus der Registry liest. */
export function alsTaskGraph(og: OntologyGraph): TaskGraph {
  return {
    nodes: og.elements.map((e) => ({ id: e.id, type: e.type, attributes: e.attributes })),
    edges: og.traces.map((t) => ({ source: t.source, type: t.type, target: t.target, label: t.label })),
  };
}

const ersteVom = (og: OntologyGraph, type: string, fallback: string): string =>
  og.elements.filter((e) => e.type === type).map((e) => e.id).sort()[0] ?? fallback;

const liste = (ids: readonly string[], max = 8): string =>
  ids.length <= max ? ids.join(', ') : `${ids.slice(0, max).join(', ')} (+${ids.length - max} weitere)`;

function fmea(og: OntologyGraph): string {
  const ohne = offen('fmea', alsTaskGraph(og));
  const kette = ohne[0] ?? ersteVom(og, 'FCHAIN', 'FCHAIN-beispiel');
  const func = og.traces.find((t) => t.type === 'compose' && t.source === kette && t.target.startsWith('FUNC-'))?.target;
  const uc = og.traces.find((t) => t.type === 'compose' && t.target === kette && t.source.startsWith('UC-'))?.source;
  const massnahmeKind = func ? 'functional' : 'non-functional';
  return (
    'FMEA je Wirkkette: nenne die Fehlermodi, die das Ergebnis der Kette verhindern oder verfälschen — was geht ' +
    'schief, und was kommt dann beim Nutzer an. Je Fehlermodus eine Risiko-REQ mit Bewertung (severity, occurrence, ' +
    'detection je 1–10), eine Gegenmaßnahme-REQ und ein TEST, alles in EINEM Batch. ' +
    (ohne.length > 0 ? `Noch ohne Fehlermodus: ${liste(ohne)}. ` : '') +
    'Hat eine Kette keinen Fehlermodus mit Wirkung, schreibe für sie nichts. Vorbild:\n' +
    '## Nodes\n### REQ\n' +
    '+ REQ-risk-beispiel-a|«Fehlermodus A»: das System muss «Folge A beim Nutzer» ausschließen. [__name:«Fehlermodus A»]\n' +
    '@role risk\n@kinds ["non-functional"]\n@severity «1–10»\n@occurrence «1–10»\n@detection «1–10»\n' +
    '+ REQ-mit-beispiel-a|Das System muss «Gegenmaßnahme A» ausführen, sobald «Auslöser A» eintritt. [__name:«Gegenmaßnahme A»]\n' +
    `@role mitigation\n@kinds ["${massnahmeKind}"]\n` +
    '### TEST\n' +
    '+ TEST-mit-beispiel-a|«Fehlermodus A» herbeiführen und prüfen, dass «Gegenmaßnahme A» greift. [__name:Test «Gegenmaßnahme A»]\n\n' +
    '## Edges\n' +
    (uc ? `+ ${uc} -compose-> REQ-risk-beispiel-a\n` : '') +
    '+ REQ-risk-beispiel-a -compose-> REQ-mit-beispiel-a\n' +
    `+ ${kette} -satisfy-> REQ-risk-beispiel-a\n` +
    `+ ${func ?? kette} -satisfy-> REQ-mit-beispiel-a\n` +
    '+ TEST-mit-beispiel-a -verify-> REQ-risk-beispiel-a, REQ-mit-beispiel-a'
  );
}

function plan(og: OntologyGraph): string {
  const ohne = offen('plan', alsTaskGraph(og));
  const req = ohne[0] ?? ersteVom(og, 'REQ', 'REQ-beispiel');
  const req2 = ohne[1] ?? req;
  return (
    'Bauplan: schneide je Blatt-REQ einen offenen Bauauftrag (CR mit status open), der auf die REQ zeigt, und ordne die CRs Meilensteinen ' +
    '(MS) zu — ein Meilenstein ist ein Stand, der für sich läuft. Die Reihenfolge der Meilensteine steht als ' +
    'depends-on-Kante. ' +
    (ohne.length > 0 ? `Noch ohne Bauauftrag: ${liste(ohne)}. ` : '') +
    'Vorbild:\n' +
    '## Nodes\n### MS\n' +
    '+ MS-beispiel-1|«Was nach Meilenstein 1 läuft». [__name:«Meilenstein 1»]\n' +
    '+ MS-beispiel-2|«Was nach Meilenstein 2 zusätzlich läuft». [__name:«Meilenstein 2»]\n' +
    '### CR\n' +
    `+ CR-beispiel-1|Realisiere ${req}: Code, Test grün. [__name:«Bauauftrag 1»]\n@status open\n` +
    `+ CR-beispiel-2|Realisiere ${req2}: Code, Test grün. [__name:«Bauauftrag 2»]\n@status open\n\n` +
    '## Edges\n' +
    `+ CR-beispiel-1 -relation-> ${req}, MS-beispiel-1\n` +
    `+ CR-beispiel-2 -relation-> ${req2}, MS-beispiel-2\n` +
    '+ MS-beispiel-2 -relation-> MS-beispiel-1 [label:depends-on]'
  );
}

function trade(og: OntologyGraph): string {
  // CR zeigt nur auf FUNC, MOD, SCHEMA, REQ oder UC (R-18) — eine FCHAIN ist kein legales Ziel.
  const ziel = ersteVom(og, 'FUNC', ersteVom(og, 'UC', 'FUNC-beispiel'));
  return (
    'Trade Study: nenne die offene Entwurfsentscheidung mit mindestens zwei Optionen und den Kriterien, nach denen ' +
    'du wählst. Halte die Entscheidung als CR fest, der mit einer decides-Kante auf das zeigt, was er entscheidet. ' +
    'Kennst du ein Kriterium nicht, frage mit einer Fragezeile. Vorbild:\n' +
    '## Nodes\n### CR\n' +
    '+ CR-beispiel-entscheidung|Frage: «Entscheidung A». Optionen: «Option A», «Option B». Gewählt: «Option A», weil «Kriterium A». [__name:«Entscheidung A»]\n\n' +
    '## Edges\n' +
    `+ CR-beispiel-entscheidung -relation-> ${ziel} [label:decides]`
  );
}

function irr(og: OntologyGraph): string {
  const ziel = ersteVom(og, 'REQ', ersteVom(og, 'FUNC', 'FUNC-beispiel'));
  return (
    'Annahmen-Review: nenne die unbewiesenen Annahmen, auf denen das Modell ruht — ungemessene Zahlen, ungeprüfte ' +
    'Fremdsysteme, vorausgesetzte Rechte, Material ohne Auswertung. Stelle jede zuerst als Fragezeile an den ' +
    'Auftraggeber. Was nach der Antwort offen bleibt, lege als CR an, der auf das Element zeigt, das an der Annahme ' +
    'hängt. Vorbild:\n' +
    '? «Annahme A» — trifft das zu, und woran ist es belegt?\n' +
    '## Nodes\n### CR\n' +
    '+ CR-annahme-beispiel-a|Annahme: «Annahme A». Bricht, wenn sie falsch ist: «Folge A». Beleg: «Messung oder Spike A». [__name:Annahme «A»]\n\n' +
    '## Edges\n' +
    `+ CR-annahme-beispiel-a -relation-> ${ziel}`
  );
}

function conops(og: OntologyGraph): string {
  const sys = ersteVom(og, 'SYS', 'SYS-beispiel');
  return (
    'Betriebskonzept: gehe die Betriebsfragen durch — Konfiguration, Zugangsdaten, Nutzer und Rechte, Start und ' +
    'Betrieb (wer startet es, wo läuft es), Beobachtbarkeit (woran sieht man einen Fehllauf), Datenhaltung. Je ' +
    'Frage, die das Modell noch nicht beantwortet, eine nicht-funktionale REQ am System mit TEST. Kennst du die ' +
    'Antwort nicht, frage mit einer Fragezeile. Vorbild:\n' +
    '## Nodes\n### REQ\n' +
    '+ REQ-betrieb-beispiel-a|Das System muss «Betriebsanforderung A» einhalten. [__name:«Betriebsanforderung A»]\n' +
    '@kinds ["non-functional"]\n' +
    '### TEST\n' +
    '+ TEST-betrieb-beispiel-a|«Betriebsfall A» herbeiführen und «Betriebsanforderung A» prüfen. [__name:Test «Betriebsanforderung A»]\n\n' +
    '## Edges\n' +
    `+ ${sys} -compose-> REQ-betrieb-beispiel-a\n` +
    `+ ${sys} -satisfy-> REQ-betrieb-beispiel-a\n` +
    '+ TEST-betrieb-beispiel-a -verify-> REQ-betrieb-beispiel-a'
  );
}

export const TASK_CLAUSE: Readonly<Record<AnalyseTask, TaskKlausel>> = {
  conops: { types: ['SYS', 'ACTOR', 'REQ', 'TEST'], text: conops },
  trade: { types: ['CR', 'FUNC', 'MOD', 'UC'], text: trade },
  irr: { types: ['CR', 'REQ', 'FUNC'], text: irr },
  fmea: { types: ['FCHAIN', 'FUNC', 'REQ', 'TEST'], text: fmea },
  plan: { types: ['MS', 'CR', 'REQ'], text: plan },
};
