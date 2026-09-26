/**
 * executor-prompt.ts — System-Prompt, Tool-Auswahl und Runden-Injektion des
 * embedded Executors (CR-GC-320, aus `executor.ts` herausgeschnitten).
 *
 * Diese Achse ist zustandsfrei: reine Stringerzeugung aus Registry-Reads, kein
 * Closure-Bezug zum Runden-Loop. Der Loop importiert sie, sie kennt den Loop
 * nicht — das ist der ganze Grund, warum der Schnitt hier mechanisch ist.
 *
 * @author andreas@siglochconsulting
 */
import { ElementType } from '@sigloch/contracts/se';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillDatei, type GenerationStep } from './generate.js';
import { byRank, type ChannelBlock } from './channel-rank.js';
import { buildInventoryBlock } from './executor-inventory.js';
import { decision } from './decisions.js';

// ---------------------------------------------------------------------------
// System-Prompt — bewusst ~1 Seite; die Methode kommt aus graph_generate.
//
// Der System-Prompt macht bewusst KEINE Aussage darüber, was die Runden-
// Instruktion enthält (CR-GC-358). Er ist eine Konstante und kann es nicht
// wissen: die Kanten-Grammatik landet nur dann im Rundeninhalt, wenn
// buildRoundInjection lief (injection=true). Genau EIN Schreiber pro Tatsache —
// seit CR-GC-651 ist das der Treiber: injection=true → der Grammatik-Block sagt
// „bereits eingebettet"; injection=false → GUIDE_HINT sagt „Guide aufrufen". Der
// Auftrag aus graph_generate schweigt im Treiber-Modus dazu.
// ---------------------------------------------------------------------------

/** Exportiert für den Contracts-Drift-Test (CR-GC-291): jeder ElementType.options-Wert
 * muss in diesem Prompt auftauchen, sonst halluziniert das Modell einen unbekannten Typ. */
export const SYSTEM = `Du autorierst Elemente in einen graphcode-Graphen. Der Graph ist die einzige Wahrheit — kein Code, keine Prosa.

Legale Elementtypen (NUR diese ${ElementType.options.length}): ${ElementType.options.join(', ')}. Kein anderer Typ
existiert — auch nicht für Dokumente/Specs (die bleiben Prosa, kein Graph-Knoten).

Jede Nachricht gibt dir EINE präzise Generierungs-Instruktion (inkl. der legalen Kanten). Führe genau sie aus:
emittiere den geforderten Batch als EINEN graphcode_graph_mutate-Aufruf mit {"formatE": "..."}, dann STOPP.

Format-E (exakt; Knoten unter "## Nodes" in ihrer "### <TYP>"-Sektion, Kanten unter "## Edges"):
## Nodes
### REQ
+ REQ-login-passwort|Das System muss Nutzer per Passwort in unter 2 s anmelden. [__name:Anmeldung per Passwort]
@kinds ["functional"]
### TEST
+ TEST-login-passwort|Lastlauf misst p95 der Anmeldung, Grenze 2 s. [__name:Anmeldung messen]

## Edges
+ UC-login -compose-> REQ-login-passwort
+ TEST-login-passwort -verify-> REQ-login-passwort

Jede REQ traegt @kinds: "functional"/"precondition"/"postcondition" erfuellt eine FUNC, "non-functional"/
"risk"/"mitigation" ein MOD oder das SYS; eine FCHAIN erfuellt jede. Ohne kinds ist FUNC/MOD/SYS -satisfy-> illegal.

Kanten zwischen BESTEHENDEN Knoten brauchen keine Knotenzeile — ein reiner Kanten-Batch:
## Edges
+ FUNC-login-pruefen -satisfy-> REQ-login-passwort

"+" legt an (auf eine bestehende uid: ueberschreibt sie), "~ uid|Text" ändert einen Knoten (nur was die
Zeile nennt), "- uid" löscht. Mehrere Ziele einer Kante: "+ A -verify-> B, C". uid = "<TYP>-<kebab-name>". Nie " -wort-> " in einer Beschreibung.
Nutze GENAU die Kanten aus der Instruktion und existierende uids aus der Element-Liste.
Lehnt das Gate deinen Batch ab (success:false), korrigiere NUR die beanstandeten Zeilen anhand der
violations/fixHints und reiche den VOLLSTÄNDIGEN korrigierten Batch erneut ein.
Nennt der Auftrag einen Wert nicht (Zeit, Anzahl, Kanal, Frist), erfinde keinen. Stell die Frage als
eigene Zeile im formatE und lege den Punkt mit offenem Wert an — die Antwort kommt mit der nächsten Nachricht:
? Innerhalb welcher Zeit muss die Anmeldung gelingen?
## Nodes
### REQ
+ REQ-login-dauer|Das System muss die Anmeldung innerhalb einer Zielzeit abschliessen; Zielwert offen, beim Auftraggeber erfragt. [__name:Anmeldedauer]
@kinds ["non-functional"]

list_dir/read_file/grep über ./material nur sparsam, um echte Modul-Namen zu finden — nicht statt Bauen.
Handeln vor Analysieren: rufe graph_mutate, rate die Instruktion nicht tot.`;

// CR-GC-653: KEIN Verbot „schlag nicht nach" hier. Gemessen (gcrun-50..52): Verbote befolgt das
// lokale Modell kaum — Stichwortsuchen 80 → 69, das Nachlesen des SYS stieg sogar (18 → 26). Gewirkt
// hat nur, den AUSLOESER zu entfernen (die SCHEMA-Abfrage im Skill author-uc: 22 → 3). Deshalb
// stehen die Saetze nicht mehr im SYSTEM; wer hier ein Verbot ergaenzen will, misst vorher.

// CR-GC-657: jede Beispiel-REQ traegt @kinds, und die Beispielkante ist legal. Vorher zeigte das
// Beispiel eine Latenz-REQ ohne kinds und `FUNC -satisfy->` darauf — ein illegales Paar
// (contracts: FUNC erfuellt nur functional/pre/post, MOD/SYS nur non-functional/risk/mitigation).
// Im Rig geblockt: `FUNC satisfy REQ` 8 → 15 → 24 je drei Laeufe, seit das Beispiel da stand.

// CR-GC-654: der reine Kanten-Batch steht als ZWEITES Formvorbild im SYSTEM. Mit nur dem ersten
// (Knoten samt Kanten) deklarierte qwen3-coder bestehende Knoten neu, um eine Kante anzuhaengen —
// gemessen 5 → 16 je Lauf seit CR-GC-650, neue Kanten 58 → 44. Ein Upsert, der Beschreibung und
// Namen ueberschreiben kann. Vorbild statt Verbot: Verbote wirkten gemessen nicht (CR-GC-653).

// CR-GC-650: der Executor emittiert Format-E statt `commands` — gemessen 84–94 statt 223–279 Zeichen
// je geschriebenem Element (CR-GC-627), und lokal bestimmt die Ausgabelaenge die Wall-Zeit. Die Form
// steht EINMAL im SYSTEM; Suffix und Nachfassen verweisen nur darauf, statt sie zu wiederholen.
export const EMIT_SUFFIX =
  '\n\nEmittiere GENAU diesen Schritt als EINEN graph_mutate-Aufruf mit {"formatE": "..."} ' +
  '(## Nodes / ### <TYP> / + uid|Beschreibung [__name:Name], dann ## Edges / + A -kante-> B).';

/** Handlungs-Zwang bei Idle-Turns: Coder-Modelle dithern gern in Prosa (Rig-Befund
 * "6× guide/Runde") — EIN Nachfassen pro Step statt den Schritt still aufzugeben. */
export const IDLE_NUDGE =
  'Du hast KEINEN graph_mutate-Call emittiert. Emittiere JETZT den geforderten Batch als EINEN ' +
  'graphcode_graph_mutate-Tool-Call mit {"formatE": "..."} — keine Prosa, keine weitere Analyse.';

/**
 * CR-GC-667: die Antwort auf Fragezeilen, wenn niemand da ist — der Registertext aus CR-GC-592,
 * derselbe, den `GRAPHCODE.md` und `se:generate` einsetzen. Ein Text, zwei Pfade.
 */
export function headlessAnswer(questions: readonly string[]): string {
  return (
    `Niemand antwortet in diesem Lauf auf: ${questions.map((q) => `„${q}“`).join(' ')}\n` +
    decision('openQuestions')
  );
}

/** CR-GC-667: die Antwort des Auftraggebers, wie sie das Modell in der naechsten Nachricht sieht. */
export function ownerAnswer(questions: readonly string[], antwort: string): string {
  return `Antwort des Auftraggebers auf ${questions.map((q) => `„${q}“`).join(' ')}:\n${antwort.trim() || '(keine Angabe — als Annahme mit offenem Wert anlegen)'}`;
}

/** Der Guide-Hinweis, wenn die Grammatik NICHT eingebettet ist (injection=false, CR-GC-651). */
export const GUIDE_HINT = 'Rufe vor dem Schreiben graph_authoring_guide für jeden Elementtyp auf (legale Kanten).';

/** Diese Tools ruft der EXECUTOR deterministisch — dem Modell werden sie vorenthalten. */
export const WITHHELD_TOOLS = new Set(['graph_generate', 'graph_suggest']);

/**
 * Das kuratierte Minimal-Set für den generativen Loop (toolset 'authoring') — je Werkzeug die
 * Parameter, die das Modell hier braucht (CR-GC-651). Die Schlüssel SIND das Werkzeugset.
 *
 * Gemessen an einer Executor-Runde (2026-09-24): vom Katalog (7.835 Zeichen) trug `graph_mutate`
 * allein 3.733 an Schema — davon `formatE`-Sprachdoku 1.879, `violations` 1.000, `baseVersion` 380,
 * `dryRun` 257. Hier probt der Treiber, schreibt ein einziger Schreiber, und die Form steht im
 * SYSTEM. `graph_readiness` fällt ganz: seine Frage ist „was als Nächstes", und die beantwortet im
 * Executor der Treiber. Parameterbeschreibungen entfallen (die Form steht einmal im SYSTEM), von
 * der Werkzeugbeschreibung bleibt der erste Satz — abgeleitet, kein zweiter Text daneben.
 */
export const AUTHORING_PARAMS: Readonly<Record<string, { params: readonly string[]; required?: readonly string[] }>> = {
  // Pflicht, obwohl das Originalschema `formatE` und `commands` beide optional fuehrt (genau eins
  // von beiden): mit nur einem angebotenen Feld waere sonst ein leerer Aufruf formal gueltig.
  graph_mutate: { params: ['formatE'], required: ['formatE'] },
  graph_authoring_guide: { params: ['type'] },
  graph_get_node: { params: ['uid'] },
  graph_elements: { params: ['type', 'search', 'limit'] },
};

// ---------------------------------------------------------------------------
// Runden-Prompt-Injektion (CR-GC-285): deterministisch berechenbare Lese-
// Inhalte (Guide-Slice der Fokus-Typen + Element-Index) direkt in den Runden-
// Prompt statt sie das Modell erfragen zu lassen — Turn-Analyse der Testläufe:
// 41–59 % reine Lese-Turns, graph_authoring_guide 72–107× pro Lauf für
// dieselben Typen (History resettet pro Runde). Die Lese-Tools bleiben im
// Toolset (Detail-Nachfragen); nur der Standard-Rundenstart braucht sie nicht.
// ---------------------------------------------------------------------------


/** Zeichen-Budget eines einzelnen Tool-Ergebnisses im Runden-Prompt. */
export const TOOL_RESULT_CHAR_BUDGET = 6000;

/**
 * Ein Tool-Ergebnis als **gültiges JSON** unter dem Budget (CR-GC-309).
 *
 * Vorher stand hier zweimal `JSON.stringify(x).slice(0, N)`. Ein Byte-Schnitt
 * zerlegt das JSON mitten im Objekt: bei einer 70-KB-Antwort bekam das lokale
 * Modell einen abgehackten Blob — nicht parsebar, also auch keine verwertbare
 * Violation. Statt zu schneiden geben wir ein KLEINERES, gültiges Objekt zurück,
 * das sagt, was fehlt.
 *
 * Der Summary-Default aus demselben CR macht das für Mutationen zum seltenen Fall;
 * seltener heißt aber nicht nie — ein großer Graph kann auch eine Leseantwort über
 * das Budget heben, und dann ist "gültig, aber knapp" das einzig Brauchbare.
 */
export function jsonCapped(value: unknown, budget = TOOL_RESULT_CHAR_BUDGET): string {
  const full = JSON.stringify(value) ?? 'null';
  if (full.length <= budget) return full;
  // Skalare Felder der obersten Ebene behalten — dort stehen success/tier/counts,
  // also genau das, wonach der Treiber verzweigt. Verschachtelte Objekte fallen weg.
  const scalars: Record<string, unknown> = {};
  const listen: [string, unknown[]][] = [];
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || typeof v !== 'object') scalars[k] = v;
      else if (Array.isArray(v)) listen.push([k, v]);
    }
  }
  const out: Record<string, unknown> = {
    ...scalars,
    truncated: true,
    originalChars: full.length,
    note:
      `Ergebnis über ${budget} Zeichen und deshalb gekürzt — Listen auf den Anfang gekappt, ` +
      'verschachtelte Felder entfernt. Enger fragen (type, search, limit) statt das volle Ergebnis anzufordern.',
  };
  // CR-GC-647: Listen auf ihren ANFANG kappen statt sie zu streichen. Vorher fielen alle Arrays
  // weg — `graph_elements` mit Default-limit (100 REQ, ~18k Zeichen auch ohne Prosa) kam beim
  // Modell als Antwort ohne einen einzigen Knoten an. Der Anfang einer Liste ist eine Antwort,
  // ihr Fehlen ist keine.
  const gekappt: Record<string, string> = {};
  for (const [k, liste] of listen) {
    const behalten: unknown[] = [];
    out[k] = behalten;
    gekappt[k] = `0/${liste.length}`;
    out.gekappt = gekappt;
    let groesse = JSON.stringify(out).length;
    for (const el of liste) {
      const zusatz = (JSON.stringify(el) ?? 'null').length + 1;
      if (groesse + zusatz + 8 > budget) break;
      behalten.push(el);
      groesse += zusatz;
    }
    gekappt[k] = `${behalten.length}/${liste.length}`;
  }
  return JSON.stringify(out);
}

interface GuideSlice {
  outgoing: { edgeType: string; targetType: string; cardinality?: string }[];
  incoming: { edgeType: string; sourceType: string; cardinality?: string }[];
  requiredAttrs: string[];
}

/** Die Paketwurzel — Rueckfall, wenn das Arbeitsverzeichnis keine Skills scaffolded hat. */
const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Eine Zeile aus `graph_suggest`, so weit die Injektion sie liest (CR-GC-556). */
interface SuggestRow {
  ruleId?: string;
  elementId?: string;
  delta?: unknown[];
  edit?: { source: string; target: string; type: string };
}

/** Hoechstens so viele Vorschlagszeilen je Runde — der Block bleibt eine Beigabe. */
const SUGGEST_MAX_ROWS = 8;

/** Schema-Obergrenze von `graph_suggest.k` — siehe Begruendung an der Aufrufstelle. */
const SUGGEST_K = 20;

// Welcher Skill gilt, entscheidet generate.ts (CR-GC-589/655) — hier wird nur der Rumpf gelesen.

/** Markerpaar, mit dem ein Skill selbst bestimmt, welcher Teil von ihm modelltauglich ist. */
const INJECT_START = '<!-- inject:start -->';
const INJECT_END = '<!-- inject:end -->';

/** Zeichen-Deckel je Skill — ein durchgerutschter Riesen-Skill soll die Runde nicht fluten. */
const SKILL_CHAR_BUDGET = 4000;

/**
 * Den Rumpf eines Skills lesen, ohne sein Frontmatter.
 *
 * `name`/`description` im Frontmatter sind Harness-Metadaten fuer die Slash-Kommando-Liste,
 * keine Anleitung — sie wuerden dem Modell nur eine Adresse zeigen, die es nicht aufrufen kann.
 * Fehlt die Datei (fremdes Repo, andere Installation), gibt es keinen Block: die Injektion
 * darf den Lauf nie brechen.
 */
function readSkillBody(skill: { name: string; file: string }): string | null {
  for (const basis of [process.cwd(), SKILL_ROOT]) {
    try {
      const roh = readFileSync(join(basis, '.claude', 'commands', 'se', skill.file), 'utf8');
      const ohneKopf = roh.startsWith('---') ? roh.slice(roh.indexOf('\n---', 3) + 4) : roh;
      // Ausschnitt statt Byte-Schnitt (CR-GC-558): setzt der Skill die Marker, bestimmt ER,
      // was das Modell sieht — eine Quelle, kein zweites Kurzdokument daneben.
      const von = ohneKopf.indexOf(INJECT_START);
      const bis = ohneKopf.indexOf(INJECT_END);
      const gewaehlt =
        von >= 0 && bis > von ? ohneKopf.slice(von + INJECT_START.length, bis) : ohneKopf;
      const rumpf = gewaehlt.trim();
      if (!rumpf) return null;
      return rumpf.length > SKILL_CHAR_BUDGET
        ? rumpf.slice(0, SKILL_CHAR_BUDGET) + '\n… (gekuerzt)'
        : rumpf;
    } catch {
      // naechste Basis probieren
    }
  }
  return null;
}

/**
 * Baut die beiden Injektions-Blöcke für den Rundenstart: (a) Kanten-Grammatik
 * der `focusTypes` (in-process `graph_authoring_guide`), (b) Element-Index des
 * Graph-Zustands als `uid · type · name`-Zeilen (in-process `graph_elements`).
 * Fehlertolerant — die Injektion darf den Lauf nie brechen (leerer Block statt
 * Throw); leerer Graph ⇒ kein Index-Block.
 */
export async function buildRoundInjection(
  registry: MCPToolRegistry,
  step: Pick<GenerationStep, 'focusTypes' | 'focusElements' | 'skill'>,
): Promise<string> {
  return (await buildRoundChannels(registry, step)).map((b) => b.text).join('\n\n');
}

/**
 * Dieselbe Injektion, aber je Kanal EINZELN (CR-GC-573).
 *
 * `buildRoundInjection` fuegt nur noch zusammen, was hier entsteht — kein zweiter Pfad.
 * Getrennt braucht sie, wer die Kanaele gegeneinander halten will: `duplicateChannels`
 * beantwortet daran die Frage „sagen zwei Kanaele dieser Runde dasselbe?", die bis hierher
 * nur ein LAUF beantworten konnte.
 */
export async function buildRoundChannels(
  registry: MCPToolRegistry,
  step: Pick<GenerationStep, 'focusTypes' | 'focusElements' | 'skill'>,
): Promise<ChannelBlock[]> {
  // CR-GC-575: die Bloecke tragen ihren Kanal und werden am Ende nach Rang sortiert —
  // die Reihenfolge des Rundenprompts folgt der Verbindlichkeit, nicht der Reihenfolge,
  // in der die Bloecke historisch angebaut wurden. Bis hierher stand die Anleitung
  // (Rang 5) UNTER den Vorschlaegen (Rang 6), weil CR-GC-556 vor CR-GC-557 kam.
  const blocks: ChannelBlock[] = [];
  const focusTypes = step.focusTypes ?? [];

  if (focusTypes.length > 0 && registry['graph_authoring_guide']) {
    const lines: string[] = [];
    for (const type of focusTypes) {
      try {
        const g = (await registry['graph_authoring_guide'].handler({ type })) as GuideSlice;
        const card = (c?: string): string => (c ? ` (${c})` : '');
        const out =
          g.outgoing.map((e) => `${e.edgeType}→${e.targetType}${card(e.cardinality)}`).join(', ') || '-';
        const inc =
          g.incoming.map((e) => `${e.sourceType} ${e.edgeType}→${card(e.cardinality)}`).join(', ') || '-';
        const attrs = g.requiredAttrs.length > 0 ? `; Pflicht-Attrs: ${g.requiredAttrs.join(', ')}` : '';
        lines.push(`- ${type}: ausgehend: ${out}; eingehend: ${inc}${attrs}`);
      } catch {
        // unbekannter Typ / Handler-Fehler: Typ überspringen, Rest injizieren
      }
    }
    if (lines.length > 0) {
      blocks.push({
        channel: 'grammar',
        text:
          'Kanten-Grammatik der Fokus-Typen (bereits eingebettet — graph_authoring_guide dafür nicht ' +
          'aufrufen):\n' + lines.join('\n'),
      });
    }
  }

  // Der Element-Index (CR-GC-285) — seit CR-GC-652 in executor-inventory.ts: mit Fund aus dessen
  // Kontext (gerichteter Weg zum Besitzer), ohne Fund (Seed) nach Fokus-Typ.
  const inventar = await buildInventoryBlock(registry, step);
  if (inventar) blocks.push(inventar);
  // -------------------------------------------------------------------------
  // (c) Die Vorlagen-Empfehlungen (CR-GC-556). ANREICHERUNG, keine zweite Liste:
  // der Rundenprompt nennt die Fokus-Funde samt fixHint bereits. Hier kommt nur
  // dazu, was dort FEHLT — die konkrete Kante, die die Vorlage vorschlaegt, und
  // das `delta` (der ℝ⁶-Zug, also der Optimizer). Ein Vorschlag ohne Kante traegt
  // nichts Neues und bleibt draussen.
  //
  // WARUM injiziert statt als Werkzeug: `graph_suggest` STAND dem Modell offen
  // (toolset 'full') und wurde in drei Laeufen null Mal gerufen. Der SYSTEM-Prompt
  // verbietet Analyse-Turns ausdruecklich („dann STOPP", „Handeln vor Analysieren").
  // Das Regime hat recht — es haelt kleine Modelle beim Bauen. Falsch war der Kanal.
  // -------------------------------------------------------------------------
  const suggestTool = registry['graph_suggest'];
  if (suggestTool) {
    try {
      // `k` bis an die Schema-Obergrenze, NICHT der Default. Der Default 5 ist ein
      // Top-k fuer einen menschlichen Leser; dieser Block filtert anschliessend auf die
      // ausfuehrbaren herunter und braucht dafuer das weite Netz. GEMESSEN am
      // gcrun-Graphen: k=5 liefert 0 Vorschlaege mit Kante, k=20 liefert den einen, den
      // es gibt. Ein Block, der genau das Anwendbare wegschneidet, waere schlimmer als keiner.
      const res = (await suggestTool.handler(
        suggestTool.inputSchema.parse({ k: SUGGEST_K }) as never,
      )) as { suggestions?: SuggestRow[] };
      const fokus = new Set(focusTypes);
      const zeilen: string[] = [];
      for (const s of res.suggestions ?? []) {
        if (!s.edit) continue; // ohne Kante nichts Neues gegenueber dem fixHint
        // Auf die Runde zuschneiden — aber ueber ALLE DREI beteiligten Knoten, nicht nur
        // ueber den Fund. GEMESSEN am gcrun-Graphen: der einzige ausfuehrbare Vorschlag
        // ist `RD-01 @ REQ-data-security` mit der Kante FCHAIN -satisfy-> REQ. Ein Filter
        // allein auf den Fund haette ihn bei Fokus ACTOR/UC/FCHAIN/FUNC weggeworfen — also
        // genau das eine, was die Runde haette anwenden koennen.
        const typVon = (id: unknown): string => String(id ?? '').split('-')[0];
        const beteiligt = [s.elementId, s.edit.source, s.edit.target].map(typVon);
        if (fokus.size > 0 && !beteiligt.some((ty) => fokus.has(ty))) continue;
        const kante = `${s.edit.source} -${s.edit.type}-> ${s.edit.target}`;
        // CR-GC-648: ein Null-Delta ist keine Aussage — gemessen trugen beide Vorschlaege einer
        // Runde `[0.000 ×6]` unter dem Satz „negativ heisst Verbesserung". Nur ein Zug, der
        // etwas bewegt, bekommt seine Zahlen.
        const bewegt =
          Array.isArray(s.delta) && s.delta.some((x) => typeof x !== 'number' || Math.abs(x) >= 0.0005);
        const d = bewegt
          ? ` · delta [${s.delta!.map((x) => (typeof x === 'number' ? x.toFixed(3) : '?')).join(' ')}]`
          : '';
        zeilen.push(`- ${s.ruleId} @ ${s.elementId}: ${kante}${d}`);
        if (zeilen.length >= SUGGEST_MAX_ROWS) break;
      }
      if (zeilen.length > 0) {
        blocks.push({
          channel: 'proposal',
          text:
            'Ausfuehrbare Vorschlaege (aus den Regel-Vorlagen gerechnet, Kante bereits geprueft; '
            + '`delta` ist der ℝ⁶-Zug — negativ heisst Verbesserung). Uebernimm sie, wenn sie zur '
            + 'Instruktion passen, sonst begruende im Batch, warum nicht:\n' + zeilen.join('\n'),
        });
      }
    } catch {
      // Vorschlaege optional — die Injektion darf den Lauf nie brechen
    }
  }

  // -------------------------------------------------------------------------
  // (d) Der Skill-Rumpf zum Fokus-Typ (CR-GC-557). Der Rundenprompt nannte bisher
  // „(Skill se:author-uc)" — einen Zeiger, den im Loop niemand einloesen kann:
  // Skills sind Slash-Kommandos des Claude-Code-Harness, `graphcode run` liest das
  // Verzeichnis nicht. Also liefern wir den Inhalt statt der Adresse.
  //
  // HOECHSTENS EINER je Runde: author-uc.md sind ~750 Token. Einer ist bezahlbar,
  // vier waeren der naechste Werkzeugkatalog.
  // -------------------------------------------------------------------------
  // CR-GC-655: der Skill, den der SCHRITT nennt — dort hat der Gewinner (Klausel vor Dimension)
  // entschieden. Vorher las der Executor die Dimension selbst und injizierte bei UC-02 author-uc,
  // dessen Beispiel das Modell statt der Klausel befolgte.
  const skill = step.skill ? skillDatei(step.skill) : undefined;
  if (skill) {
    const rumpf = readSkillBody(skill);
    if (rumpf) {
      blocks.push({ channel: 'guidance', text: `Anleitung fuer diese Runde (Skill ${skill.name}):\n${rumpf}` });
    }
  }

  return byRank(blocks);
}
