/**
 * authoring-example.ts — der Format-E-Musterblock je ElementType (CR-GC-321).
 *
 * Warum eigenes Modul: `tools/report.ts` steht am 500-Zeilen-Limit (CR-GC-256 §6 —
 * „der nächste Reporting-Tool splittet die Datei, sie wächst nicht"), und der
 * Musterblock ist Format-E-Wissen, kein Reporting-Wissen.
 *
 * Der Block ist GEPRÜFT, nicht behauptet: `tests/mutate.formate-name.test.ts`
 * jagt ihn durch den Format-E-Parser und verlangt einen Knoten des
 * angefragten Typs mit `name !== uid` (REQ-N03). Ein Beispiel, das der Codec
 * nicht frisst, ist schlimmer als keins.
 *
 * @author andreas@siglochconsulting
 */
import { ELEMENT_ATTRIBUTES, ReqKind, ACCEPTED_FINDINGS_ATTRIBUTE } from '@sigloch/contracts/se';
import { ABNEHMBAR_JE_TASK } from '../loop/decisions.js';

/** Ein Attribut, wie ein Autor es schreiben muss — Schluessel, erlaubte Werte, Schreibform. */
export interface AttributeHint {
  key: string;
  type: string;
  enumValues?: readonly string[];
  description: string;
  syntax: string;
}

/**
 * Die Attribute eines Typs, samt erlaubter Werte (CR-GC-581).
 *
 * `kinds` am REQ steht NICHT in `ELEMENT_ATTRIBUTES` (dort nur FMEA-Felder), obwohl die
 * where-Praedikate der satisfy-Kanten und BQ-Regeln es lesen (und bis CR-SM-357 UC-05/06). Der Guide nannte deshalb
 * "behavioural kinds only" ohne einen einzigen Wert — Opus durchsuchte in Runde 7 bis zu 31-mal
 * den Quellcode nach der Schreibweise. Die Werte kommen aus `ReqKind`, der SSOT; lokal ist
 * nur die Tatsache, dass sie als `@kinds [...]` reisen.
 */
export function attributesFor(type: string): AttributeHint[] {
  const own: AttributeHint[] = (ELEMENT_ATTRIBUTES[type as keyof typeof ELEMENT_ATTRIBUTES] ?? []).map((a) => ({
    key: a.key,
    type: a.type,
    ...(a.enumValues ? { enumValues: a.enumValues } : {}),
    description: a.description,
    syntax: `@${a.key} <wert>`,
  }));
  // CR-GC-594: die benannte Abweichung gilt an jedem Typ — mit der abnehmbaren Klasse als Werte.
  const abnahme: AttributeHint = {
    key: ACCEPTED_FINDINGS_ATTRIBUTE.key,
    type: ACCEPTED_FINDINGS_ATTRIBUTE.type,
    enumValues: [...new Set(Object.values(ABNEHMBAR_JE_TASK).flat())],
    description: ACCEPTED_FINDINGS_ATTRIBUTE.description + ' Abnehmbar sind nur die Regeln in enumValues (im Kern die Eintrittspunkte AF-*, sonst je Task); Architekturregeln nicht.',
    syntax: '@acceptedFindings [{"ruleId":"FM-03","reason":"Nachweis erst mit dem ersten Testlauf"}]',
  };
  if (type !== 'REQ') return [...own, abnahme];
  return [
    {
      key: 'kinds',
      type: 'array',
      enumValues: ReqKind.options,
      description:
        'Art der Anforderung, eine oder mehrere. functional/postcondition/precondition sind ' +
        'behavioural (FUNC/FCHAIN satisfy), non-functional structural (MOD/SYS satisfy); ' +
        'Vor- und Nachbedingung eines UC stehen als precondition-/postcondition-REQ am UC (Schreibregel se:author-uc).',
      syntax: '@kinds ["postcondition"]',
    },
    ...own,
    abnahme,
  ];
}

/** Ein ausgehendes Kantenmuster des Typs — genau die Form, die `TRACE_PATTERNS` liefert. */
export interface AusgehendesMuster {
  edgeType: string;
  targetType: string;
}

/**
 * Ein kurzer, decodierbarer Format-E-v2-Block für `type`.
 *
 * Er zeigt ZWEI Stellen, an denen Autoren etwas verlieren:
 *
 * 1. den NAMEN — `+ uid|text` hat zwei positionale Felder (uid, Beschreibung); der Name reist als
 *    `__name`-Attribut, ohne ihn wird die uid zum Namen (stiller Fallback, `codec.ts` decode).
 * 2. den FAN-OUT (CR-GC-625) — `+ A -kante-> B, C` schreibt ZWEI Kanten. Der Codec kann das seit
 *    jeher in beide Richtungen (`parseEdgeLine` spaltet auf Kommas, `serializeEdges` gruppiert seit
 *    CR-GC-268), gezeigt wurde es nie: im Rig-Lauf `opus5-16` gingen 343 Kantenschreibungen in 194
 *    Gruppen — 149 Zeilen (43 %) unnötig einzeln, Fan-out 0-mal genutzt.
 *
 * Das Muster ist ein ECHTES `TRACE_PATTERN` des angefragten Typs, keines aus der Luft: der Aufrufer
 * reicht `outgoing` herein (in `report.ts` liegt es ohnehin schon vor). Bevorzugt wird ein Muster
 * auf einen ANDEREN Typ — `SYS -compose-> SYS` wäre legal, aber als Beispiel irreführend. Ein Typ
 * ohne ausgehendes Muster (SCHEMA) behält den Block ohne Kanten.
 *
 * Die Zielknoten werden mitdeklariert, weil sie es müssen: ohne `### <TYPE>`-Sektion kann der Codec
 * den Typ eines Kantenziels nicht auflösen und `decode` wirft. Ein Beispiel, das der Codec nicht
 * frisst, ist schlimmer als keins.
 */
export function formatEExampleFor(type: string, outgoing: readonly AusgehendesMuster[] = []): string {
  const uid = `${type}-example`;
  const muster = outgoing.find((m) => m.targetType !== type) ?? outgoing[0];
  /**
   * Am REQ die kinds — ohne sie ist keine Vor-/Nachbedingung lesbar. Und STRUKTURELL, wo ein
   * MOD oder SYS erfuellt: contracts 9.x prueft das `where`-Praedikat am satisfy-Muster, ein
   * Beispiel mit `functional` waere dort am Gate illegal (dieselbe Klausel, die das
   * Bootstrap-Template seit CR-SM-266 traegt).
   */
  const kinds = (t: string, alsZiel = false): string[] => {
    if (t !== 'REQ') return [];
    const strukturell = alsZiel && muster?.edgeType === 'satisfy' && (type === 'MOD' || type === 'SYS');
    return [`@kinds ["${strukturell ? 'non-functional' : 'functional'}"]`];
  };

  const knoten = ['## Nodes', `### ${type}`, `+ ${uid}|One sentence stating what this ${type} is; this field is the DESCRIPTION [__name:Readable ${type} name]`, ...kinds(type)];
  const kanten: string[] = [];
  if (muster) {
    const ziele = [`${muster.targetType}-example-one`, `${muster.targetType}-example-two`];
    const zielZeilen = ziele
      .map((z, i) => [`+ ${z}|Target ${i + 1} of the fan-out line below [__name:Target ${i + 1}]`, ...kinds(muster.targetType, true)])
      .flat();
    if (muster.targetType === type) knoten.push(...zielZeilen);
    else knoten.push(`### ${muster.targetType}`, ...zielZeilen);
    kanten.push(
      '',
      '## Edges',
      `# EINE Zeile, ZWEI Kanten — Ziele kommagetrennt. Ein Inline-Attributblock gilt fuer ALLE Ziele`,
      `# der Zeile; Kanten mit eigenem cardinality/constraint/notes bleiben einzeln.`,
      `+ ${uid} -${muster.edgeType}-> ${ziele.join(', ')}`,
    );
  }

  return [
    ...knoten,
    ...kanten,
    '',
    `# Name mit Komma oder eckiger Klammer -> Folgezeile statt inline:`,
    `# + ${uid}|One sentence stating what this ${type} is`,
    `# @__name Readable ${type} name, with a comma`,
    '',
    // CR-GC-627: das Praefix entscheidet ueber die Operation — derselbe Block, dasselbe Gate.
    // Kommentiert, weil dieser Beispielblock ADDITIV bleiben muss: `decode()` ist der Leseweg
    // und wirft bei Nicht-Add-Ops (geprueft in tests/mutate.formate-ops.test.ts).
    `# Nicht nur anlegen — das Praefix ist die Operation:`,
    `# ~ ${uid}|New description; a PATCH, only what this line names  (update-node)`,
    `# - ${uid}                                                       (delete-node)`,
    `# - ${uid} -${muster?.edgeType ?? 'relation'}-> ${muster ? `${muster.targetType}-example-one` : 'OTHER-uid'}   (delete-edge)`,
    `# M ${uid} + OTHER-uid   unter "## Merges": OTHER-uid nimmt ${uid} auf (merge-nodes)`,
  ].join('\n');
}
