/**
 * steuerung.mjs (CR-GC-585) — hat die Steuerung gesteuert?
 *
 * Der Bericht kannte bis hierher Form (Readiness), Kosten und Dry-Run-Quote. Die Fragen, an
 * denen jede Optimierungsrunde haengt, beantwortete er nicht — sie wurden in Runde 7/8 mit
 * Wegwerf-Skripten erhoben, jedes mit eigenem Parser:
 *
 *  1. Kanaele: welcher Kanal kam an, wurde er benutzt oder erwaehnt, und folgte der Agent ihm?
 *  2. Zeitlinie: wann im Lauf kam er — VOR der Entscheidung oder danach?
 *  3. Navigation: fand sich der Agent ueber den Graphen zurecht oder ueber grep/glob/Read?
 *  4. Effizienz je Element — die Kosten eines Laufs sagen nichts, solange die Ausbeute schwankt.
 *  5. Endstand der Freigabe: was fehlte beim letzten graph_generate zu done?
 *
 * Gilt fuer den Claude-Code-Arm (stream-json), also graphcode ueber MCP. Reine Auswertung,
 * keine Messung. Der Strom wird mit `zeilen()` aus turn-analyse.mjs gelesen — ein Parser.
 *
 * @author andreas@siglochconsulting
 */
import { zeilen } from './turn-analyse.mjs';

const GC = 'mcp__graphcode__';

/** Werkzeugaufrufe, -ergebnisse und Assistententext in Stromreihenfolge, je Aufruf einmal. */
export function leseStrom(pfad) {
  const aufrufe = [];
  const nachId = new Map();
  const texte = [];
  const gesehen = new Set();
  let schluss = null;
  for (const e of zeilen(pfad)) {
    if (e.type === 'result') schluss = e;
    const inhalt = e.message?.content;
    if (!Array.isArray(inhalt)) continue;
    for (const b of inhalt) {
      if (e.type === 'assistant' && b.type === 'tool_use' && !gesehen.has(b.id)) {
        gesehen.add(b.id);
        const a = { name: b.name.startsWith(GC) ? b.name.slice(GC.length) : b.name, input: b.input ?? {}, antwort: null, zeichen: 0 };
        aufrufe.push(a);
        nachId.set(b.id, a);
      }
      if (e.type === 'assistant' && (b.type === 'text' || b.type === 'thinking')) texte.push(b.text ?? b.thinking ?? '');
      if (b.type === 'tool_result' && nachId.has(b.tool_use_id)) {
        const roh = typeof b.content === 'string' ? b.content : (b.content ?? []).map((x) => x.text ?? '').join('');
        const a = nachId.get(b.tool_use_id);
        a.zeichen = roh.length;
        try { a.antwort = JSON.parse(roh); } catch { a.antwort = null; }
      }
    }
  }
  return { aufrufe, texte, schluss };
}

const istMutate = (a) => a.name === 'graph_mutate';
/**
 * Fokusquelle: graph_generate — oder seit CR-GC-588 die angewandte Mutation, die `next` traegt.
 * Fuer die Zaehlung ist das derselbe Schritt; ein Lauf, der nur ueber `next` faehrt, hat sonst
 * "0 graph_generate" und damit scheinbar nie einen Fokus.
 */
const fokusVon = (a) => (a.name === 'graph_generate' && a.antwort) ? a.antwort : (istMutate(a) && a.antwort?.next) ? a.antwort.next : null;
const typenIm = (a) => [...new Set([...String(a.input.formatE ?? '').matchAll(/^### (\w+)/gm)].map((m) => m[1]))];

/**
 * Kanal-Wirkung. "geliefert" = so oft kam der Kanal beim Agenten an; "erwaehnt" = in wie vielen
 * Denk-/Textbloecken er beim Namen genannt wird. Erwaehnt ist nicht befolgt — aber ein Kanal,
 * der 37-mal kommt und nie genannt wird, traegt die Entscheidung erkennbar nicht.
 */
export function kanalWirkung({ aufrufe, texte }) {
  const nenn = (re) => texte.filter((t) => re.test(t)).length;
  const zaehl = (name) => aufrufe.filter((a) => a.name === name).length;
  const mut = aufrufe.filter(istMutate);
  const feld = (k) => mut.filter((a) => a.antwort && a.antwort[k] !== undefined).length;

  // Fokus befolgt: der naechste angewandte Batch nach einem graph_generate enthaelt die
  // Fokus-Typen und — falls benannt — eine der Fokus-uids. Grob, aber je Lauf vergleichbar.
  let beurteilt = 0, befolgt = 0, wiederholt = 0;
  let vorher = null;
  for (let i = 0; i < aufrufe.length; i++) {
    const a = aufrufe[i];
    const schritt = fokusVon(a);
    if (!schritt) continue;
    const fokus = schritt.focusKey ?? schritt.focusDimension ?? null;
    if (vorher !== null && fokus === vorher) wiederholt++;
    vorher = fokus;
    // Das Fenster reicht bis zur naechsten Fokusquelle — EINSCHLIESSLICH, wenn sie eine Mutation ist:
    // die wurde unter DIESEM Fokus geschrieben, ihr `next` ist erst die Antwort darauf (CR-GC-716).
    // Ohne das ist das Fenster leer, sobald jede Mutation `next` traegt (Kette A).
    const bis = aufrufe.findIndex((x, j) => j > i && fokusVon(x));
    const ende = bis < 0 ? undefined : istMutate(aufrufe[bis]) ? bis + 1 : bis;
    const batches = aufrufe.slice(i + 1, ende).filter((x) => istMutate(x) && !x.input.dryRun);
    const typen = schritt.focusTypes ?? [];
    const uids = schritt.focusKey ? String(schritt.focusKey).split(':')[2]?.split(',').filter(Boolean) ?? [] : [];
    // Ein Schritt ohne Fokus (`done`, Handoff) gibt keine Richtung vor — nichts zu befolgen (CR-GC-716).
    if (!batches.length || (!typen.length && !uids.length)) continue;
    beurteilt++;
    const text = batches.map((x) => String(x.input.formatE ?? JSON.stringify(x.input))).join('\n');
    const typTreffer = typen.some((t) => text.includes(`### ${t}`) || text.includes(`${t}-`));
    const uidTreffer = uids.length === 0 || uids.some((u) => text.includes(u));
    if (typTreffer && uidTreffer) befolgt++;
  }

  return {
    gateBlock: mut.filter((a) => a.antwort?.tier === 'block' || a.antwort?.success === false).length,
    generate: { aufrufe: aufrufe.filter((a) => fokusVon(a)).length, beurteilt, befolgt, wiederholt },
    guide: zaehl('graph_authoring_guide'),
    proben: mut.filter((a) => a.input.dryRun).length,
    skills: aufrufe.filter((a) => a.name === 'Skill').map((a) => a.input.skill ?? a.input.command ?? '?'),
    fitAdvisory: { geliefert: feld('fitAdvisory'), erwaehnt: nenn(/fitAdvisory|regression|Δm|modifiability|coherence/i) },
    steerAdvisory: { geliefert: feld('steerAdvisory'), erwaehnt: nenn(/steerAdvisory|Steuerwert|steer-improvement|improvement/i) },
    steeringDelta: { geliefert: feld('steeringDelta'), erwaehnt: nenn(/steeringDelta/i) },
    workOrder: { geliefert: feld('workOrder'), erwaehnt: nenn(/workOrder/i) },
    readiness: zaehl('graph_readiness'),
    help: zaehl('graph_help'),
    suggest: zaehl('graph_suggest'),
    steeringMd: aufrufe.filter((a) => JSON.stringify(a.input).includes('GRAPHCODE-STEERING')).length,
    rueckfragen: zaehl('AskUserQuestion'),
  };
}

/** Wann im Lauf (Anteil der Werkzeugaufrufe) — und kam die Grammatik VOR dem Schreiben? */
export function zeitlinie({ aufrufe }) {
  const n = aufrufe.length || 1;
  const pct = (i) => (i < 0 ? null : Math.round((100 * i) / n));
  const erst = (p) => pct(aufrufe.findIndex(p));
  const alle = (name) => aufrufe.map((a, i) => (a.name === name ? pct(i) : null)).filter((x) => x !== null);
  const geführt = new Set();
  let typBatches = 0, ungeführt = 0;
  for (const a of aufrufe) {
    if (a.name === 'graph_authoring_guide') geführt.add(a.input.type);
    if (istMutate(a) && !a.input.dryRun) {
      for (const t of typenIm(a)) { typBatches++; if (!geführt.has(t) && t !== 'SYS') ungeführt++; }
    }
  }
  const mi = aufrufe.map((a, i) => (istMutate(a) ? i : -1)).filter((i) => i >= 0);
  // Frischer Fokus: ein graph_generate dazwischen — oder die vorige Mutation trug `next` (CR-GC-588).
  const gi = aufrufe.map((a, i) => (a.name === 'graph_generate' ? i : -1)).filter((i) => i >= 0);
  let ohneFokus = 0;
  for (let k = 1; k < mi.length; k++) {
    const vorige = aufrufe[mi[k - 1]];
    if (vorige.antwort?.next) continue;
    if (!gi.some((g) => g > mi[k - 1] && g < mi[k])) ohneFokus++;
  }
  return {
    ersterSkill: erst((a) => a.name === 'Skill'),
    ersterGuide: erst((a) => a.name === 'graph_authoring_guide'),
    erstesGenerate: erst((a) => a.name === 'graph_generate'),
    ersteMutation: erst(istMutate),
    readinessBei: alle('graph_readiness'),
    typBatches, ungeführt,
    mutationenOhneFrischenFokus: { n: ohneFokus, von: Math.max(0, mi.length - 1) },
  };
}

/** Wohin ein Datei-Werkzeug greift. Die Reihenfolge der Muster entscheidet. */
function ziel(text) {
  if (/material\/|auftrag\.md/.test(text)) return 'auftrag';
  if (/docs\/(views|graph)\//.test(text)) return 'sichten';
  if (/GRAPHCODE[\w-]*\.md|\.claude\/(commands|skills)|\bse-[\w-]+\.md/.test(text)) return 'doku';
  // Kein nacktes `contracts`: das traf das eigene src/contracts/ eines Fremdrepos (CR-GC-716).
  // @sigloch/contracts steckt in node_modules/@sigloch bzw. sigloch-modules.
  if (/graphcode\/(src|dist)|node_modules\/@sigloch|sigloch-modules|se-engine|graph-api-core|ontology\.ts|meta-model|format-e-codec/.test(text)) return 'werkzeugQuelle';
  return 'sonst';
}

const DATEI_WERKZEUGE = new Set(['Read', 'Grep', 'Glob']);
const LESE_VERBEN = new Set(['grep', 'rg', 'find', 'cat', 'ls', 'head', 'sed', 'tail']);

/** Zerlegt an Trennern AUSSERHALB von Anfuehrungszeichen — `grep "a\\|b"` ist ein Segment. */
function teile(text, trenner) {
  const teileListe = [];
  let akt = '', quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && quote === '"') { akt += c + (text[++i] ?? ''); continue; }
      if (c === quote) quote = null;
      akt += c;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; akt += c; continue; }
    const t = trenner.exec(text.slice(i, i + 2));
    if (t) { teileListe.push(akt); akt = ''; i += t[0].length - 1; continue; }
    akt += c;
  }
  teileListe.push(akt);
  return teileListe;
}

/**
 * Die lesenden Segmente einer Bash-Zeile — leer, wenn sie nichts nachschlaegt (CR-GC-716).
 * Lesend ist ein Segment, dessen Pipeline-KOPF ein Lese-Verb ist. Nicht lesend: Heredoc-Koerper
 * und `$(…)` (Argumente, kein Nachschlagen), `cat >`/`sed -i` (Schreiben), ein grep HINTER `|`
 * (filtert die Ausgabe eines Testlaufs oder Commits). Auf einem Sitzungs-Transcript waren 77 von
 * 148 „Dateizugriffen" Commit-, Testlauf- oder Schreibzeilen.
 */
export function leseSegmente(command) {
  const ohneHeredoc = String(command).replace(/<<-?\s*['"]?(\w+)['"]?[^\n]*\n[\s\S]*?\n\1(?=\n|$)/g, '');
  let ohneSubst = ohneHeredoc;
  for (let alt = null; alt !== ohneSubst;) { alt = ohneSubst; ohneSubst = ohneSubst.replace(/\$\([^()]*\)|`[^`]*`/g, ''); }
  const kopf = (seg) => teile(seg, /^\|/)[0].trim().replace(/^(do|then|else|\{|\()\s+/, '').replace(/^(\w+=\S*\s+)+/, '');
  return teile(ohneSubst, /^(&&|\|\||;|\n)/).map(kopf).filter((k) => {
    const [verb, ...rest] = k.split(/\s+/);
    if (!LESE_VERBEN.has(verb)) return false;
    if (verb === 'cat' && /^>/.test(rest[0] ?? '')) return false;
    if (verb === 'sed' && rest.includes('-i')) return false;
    return true;
  });
}
const GRAPH_LESEN = new Set([
  'graph_elements', 'graph_get_node', 'graph_get_edges', 'graph_context', 'graph_expand',
  'graph_impact', 'graph_readiness', 'graph_help', 'graph_authoring_guide', 'rules_get_violations',
  'rules_evaluate', 'graph_metrics', 'graph_tests',
]);

/**
 * Navigation: Graph gegen Datei. `auftrag` ist legitim (der Input des Laufs), `doku` auch
 * (GRAPHCODE.md, Skill-Dateien — per cat gelesen statt ueber das Skill-Werkzeug); `sichten` heisst,
 * der Agent liest den Graphen UEBER seine Markdown-Projektion statt ueber die Werkzeuge;
 * `werkzeugQuelle` heisst, ihm fehlte etwas, das der Guide haette sagen muessen (CR-GC-581).
 */
export function navigation({ aufrufe }) {
  const datei = { auftrag: 0, doku: 0, sichten: 0, werkzeugQuelle: 0, sonst: 0 };
  const zeichen = { auftrag: 0, doku: 0, sichten: 0, werkzeugQuelle: 0, sonst: 0 };
  let graph = 0, graphZeichen = 0;
  for (const a of aufrufe) {
    const lesend = a.name === 'Bash' ? leseSegmente(a.input.command ?? '') : [];
    if (DATEI_WERKZEUGE.has(a.name) || lesend.length) {
      // Das Ziel nur aus dem, was gelesen wird — nicht aus Commit-Botschaft oder Heredoc.
      const k = ziel(a.name === 'Bash' ? lesend.join('\n') : JSON.stringify(a.input));
      datei[k]++; zeichen[k] += a.zeichen;
    } else if (GRAPH_LESEN.has(a.name)) {
      graph++; graphZeichen += a.zeichen;
    }
  }
  // Nur, was der Graph haette beantworten koennen: nicht Auftrag, nicht Produkt-Doku.
  const dateiOhneAuftrag = datei.sichten + datei.werkzeugQuelle + datei.sonst;
  return {
    graph, graphZeichen, datei, zeichen,
    graphAnteil: graph + dateiOhneAuftrag ? +(graph / (graph + dateiOhneAuftrag)).toFixed(2) : null,
  };
}

/**
 * Kosten je Element aus der `result`-Zeile — die einzige vollstaendige Usage des Laufs. Ein
 * Sitzungs-Transcript (Kette A) hat keine: dann sagt das Ergebnis das, statt still leer zu sein.
 */
export function effizienz(schluss, elemente) {
  const u = schluss?.usage;
  if (!u) return { verfuegbar: false, grund: 'kein result' };
  if (!elemente) return { verfuegbar: false, grund: 'keine Elementzahl' };
  return {
    verfuegbar: true,
    centJeElement: +((100 * (schluss.total_cost_usd ?? 0)) / elemente).toFixed(1),
    ausgabeJeElement: Math.round((u.output_tokens ?? 0) / elemente),
    cacheSchreibungJeElement: Math.round((u.cache_creation_input_tokens ?? 0) / elemente),
    cacheLesungJeElement: Math.round((u.cache_read_input_tokens ?? 0) / elemente),
    turnsJeElement: +((schluss.num_turns ?? 0) / elemente).toFixed(2),
    sekundenJeElement: +((schluss.duration_ms ?? 0) / 1000 / elemente).toFixed(1),
  };
}

/**
 * Der Endstand der Freigabe — alles aus EINER Quelle, der letzten Fokusquelle (CR-GC-716). Ist das
 * ein `next`, fehlen ihm Schwellen, Gates und blockierende Fehler: dann `null`, nie die Tabellen
 * eines aelteren graph_generate (die zeigten im Frontier-Lauf den Stand v25 neben dem Endstand).
 */
export function endstand({ aufrufe }) {
  const letzte = [...aufrufe].reverse().find(fokusVon);
  if (!letzte) return null;
  const g = fokusVon(letzte);
  const tabellen = letzte.name === 'graph_generate';
  return {
    quelle: tabellen ? 'graph_generate' : 'next',
    done: g.done === true,
    phase: g.phase,
    blockierend: tabellen ? g.blockingErrors : null,
    unterSchwelle: tabellen ? (g.readiness ?? []).filter((r) => r.score === null || r.score < g.threshold)
      .map((r) => `${r.dimension}=${r.score ?? 'null'}`) : null,
    gateOffen: tabellen ? (g.phaseReadiness ?? []).filter((p) => p.missing.length).map((p) => `${p.gate}: ${p.missing.join(', ')}`) : null,
    letzterFokus: g.focusKey ?? g.focusDimension ?? null,
  };
}

const zahl = (x) => (x === null || x === undefined ? '—' : typeof x === 'number' ? x.toLocaleString('de-DE') : String(x));
const ge = (k) => `${k.geliefert}/${k.erwaehnt}`;

/**
 * Der Berichtsabschnitt. `laeufe` = [{ label, strom, elemente }] — je Claude-Code-Lauf der Pfad
 * zu `claude-stream.jsonl` und die Elementzahl aus der Ergebniszeile. Liefert Markdown.
 */
export function steuerungsBericht(laeufe) {
  const rows = laeufe.map((l) => {
    const s = leseStrom(l.strom);
    return { l, k: kanalWirkung(s), z: zeitlinie(s), n: navigation(s), e: effizienz(s.schluss, l.elemente), end: endstand(s) };
  });
  const out = [];
  out.push('## Steuerung — hat sie gesteuert? (CR-GC-585, Claude-Code-Arme)\n');
  out.push('### Kanaele: geliefert/erwaehnt, befolgt\n');
  out.push('| Lauf | Gate-Block | Fokus befolgt | Wiederholung | Guide | Proben | fitAdvisory | steerAdvisory | steeringDelta | workOrder | readiness | help | suggest | STEERING.md | Rueckfragen |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const { l, k } of rows) {
    out.push(`| ${l.label} | ${k.gateBlock} | ${k.generate.befolgt}/${k.generate.beurteilt} | ${k.generate.wiederholt} | ${k.guide} | ${k.proben} `
      + `| ${ge(k.fitAdvisory)} | ${ge(k.steerAdvisory)} | ${ge(k.steeringDelta)} | ${ge(k.workOrder)} `
      + `| ${k.readiness} | ${k.help} | ${k.suggest} | ${k.steeringMd} | ${k.rueckfragen} |`);
  }
  out.push('\nFokus befolgt = der naechste angewandte Batch nach einer Fokusquelle (`graph_generate` oder `next`) enthaelt die Fokus-Typen');
  out.push('und eine Fokus-uid (grob, je Lauf vergleichbar). geliefert/erwaehnt: ein Kanal, der oft kommt und');
  out.push('nie genannt wird, traegt die Entscheidung erkennbar nicht. 0 bei suggest/STEERING.md = toter Kanal.\n');

  out.push('### Zeitlinie: wann kam was (Anteil der Werkzeugaufrufe)\n');
  out.push('| Lauf | 1. Skill | 1. generate | 1. Guide | 1. Mutation | readiness bei | ungefuehrte Typ-Batches | Mutationen ohne frischen Fokus |');
  out.push('|---|---:|---:|---:|---:|---|---:|---:|');
  for (const { l, z } of rows) {
    const p = (x) => (x === null ? '—' : `${x} %`);
    out.push(`| ${l.label} | ${p(z.ersterSkill)} | ${p(z.erstesGenerate)} | ${p(z.ersterGuide)} | ${p(z.ersteMutation)} `
      + `| ${z.readinessBei.map((x) => `${x} %`).join(', ') || '—'} | ${z.ungeführt}/${z.typBatches} `
      + `| ${z.mutationenOhneFrischenFokus.n}/${z.mutationenOhneFrischenFokus.von} |`);
  }
  out.push('\nUngefuehrt = Elementtyp geschrieben, ohne vorher `graph_authoring_guide` dafuer zu fragen.');
  out.push('Ohne frischen Fokus = zwischen zwei Mutationen kein `graph_generate` — dort steuert nur die Gate-Antwort.\n');

  out.push('### Navigation: Graph gegen Datei (grep/glob/Read)\n');
  out.push('| Lauf | Graph-Lesen | Auftrag | Doku | Sichten | Werkzeug-Quelltext | sonst | Graph-Anteil |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const { l, n } of rows) {
    const d = (k) => `${n.datei[k]} (${zahl(n.zeichen[k])} Z.)`;
    out.push(`| ${l.label} | ${n.graph} (${zahl(n.graphZeichen)} Z.) | ${d('auftrag')} | ${d('doku')} | ${d('sichten')} `
      + `| ${d('werkzeugQuelle')} | ${d('sonst')} | ${zahl(n.graphAnteil)} |`);
  }
  out.push('\nGraph-Anteil = Graph-Lesen / (Graph-Lesen + Dateizugriffe ohne Auftrag und Doku). Sichten = der Graph');
  out.push('ueber seine Markdown-Projektion gelesen; Werkzeug-Quelltext = dem Agenten fehlte, was der Guide sagen muesste.\n');

  out.push('### Effizienz je Element\n');
  out.push('| Lauf | Elemente | Cent | Ausgabe-Tokens | Cache-Schreibung | Cache-Lesung | Turns | Sekunden |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const { l, e } of rows) {
    out.push(e.verfuegbar
      ? `| ${l.label} | ${zahl(l.elemente)} | ${zahl(e.centJeElement)} | ${zahl(e.ausgabeJeElement)} | ${zahl(e.cacheSchreibungJeElement)} `
        + `| ${zahl(e.cacheLesungJeElement)} | ${zahl(e.turnsJeElement)} | ${zahl(e.sekundenJeElement)} |`
      : `| ${l.label} | ${zahl(l.elemente)} | nicht verfuegbar (${e.grund}) | — | — | — | — | — |`);
  }
  out.push('\nDie Cache-Lesung waechst mit Turns x Kontextlaenge — sie ist der Posten, sobald die Gate-Antwort klein ist.\n');

  out.push('### Endstand der Freigabe (letzte Fokusquelle: `graph_generate` oder `next`)\n');
  out.push('| Lauf | done | blockierend | unter Schwelle | offen an den Gates | letzter Fokus |');
  out.push('|---|---|---:|---|---|---|');
  // `next` traegt keine Tabellen — benannt statt mit einem aelteren generate aufgefuellt.
  const tab = (x, f) => (x === null ? 'nicht im next' : f(x) || '—');
  for (const { l, end } of rows) {
    out.push(end
      ? `| ${l.label} | ${end.done ? 'ja' : 'nein'} | ${tab(end.blockierend, zahl)} | ${tab(end.unterSchwelle, (x) => x.join(', '))} `
        + `| ${tab(end.gateOffen, (x) => x.join(' · '))} | ${end.letzterFokus ?? '—'} |`
      : `| ${l.label} | — | — | — | — | — |`);
  }
  return out.join('\n');
}
