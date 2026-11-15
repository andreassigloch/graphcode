/**
 * messung-stand.mjs — die reine Logik hinter `docs/messung/stand.md` (CR-GC-948).
 *
 * Vorwert und „seit wann unveraendert" kommen aus der Datei `docs/messung/stand.json`, die der letzte
 * Lauf neben `stand.md` geschrieben hat. Die Markdown-Tabelle zu parsen waere bruechig: Zellen tragen
 * `|`, Zeilenumbrueche und Text. `stand.md` wird aus `stand.json` und dem Verlauf erzeugt, nie gelesen.
 *
 * Alles hier ist rein (Eingabe → Ausgabe); `scripts/messung.mjs` liest und schreibt die Dateien.
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Die Zeile je Groesse, wie `stand.json` sie traegt. */
export const StandZeileSchema = z.object({
  id: z.string().min(1),
  /** Nummer der Groesse in `kennzahlen.md`; „—" fuer einen Test ohne Groesse. */
  nr: z.string().min(1),
  kriterium: z.string(),
  wert: z.string(),
  urteil: z.enum(['bestanden', 'nicht bestanden', 'ohne Schwelle']),
  /** Tag der Messung (YYYY-MM-DD). */
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Tag, seit dem Wert und Urteil gleich sind (YYYY-MM-DD). */
  seit: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stempel: z.string().min(1),
});

export const StandSchema = z.object({
  stempel: z.string().min(1),
  zeilen: z.array(StandZeileSchema),
});

/** `stand.json` → geprueft. Eine kaputte Datei bricht laut ab: ein falscher Vorwert waere eine Zahl ohne Messung. */
export function parseStand(text) {
  return StandSchema.parse(JSON.parse(text));
}

/**
 * Die Zeilen des Laufs mit Vorwert und „seit". `vorher` ist der Stand des letzten Laufs (oder `null`).
 * Gleicher Wert und gleiches Urteil: `seit` bleibt; sonst ist es das Datum dieses Laufs. Ohne Vorlauf
 * steht der Vorwert als `null` da.
 */
export function mitVorwert(zeilen, vorher) {
  const alt = new Map((vorher?.zeilen ?? []).map((z) => [z.id, z]));
  return zeilen.map((z) => {
    const v = alt.get(z.id);
    const gleich = v !== undefined && v.wert === z.wert && v.urteil === z.urteil;
    return { ...z, vorwert: v ? v.wert : null, seit: gleich ? v.seit : z.datum };
  });
}

/** ISO-Kalenderwoche eines Datums (YYYY-MM-DD) als `YYYY-Www`. */
export function kalenderwoche(datum) {
  const [j, m, t] = datum.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag); // der Donnerstag der Woche bestimmt das Jahr
  const jahr = d.getUTCFullYear();
  const woche = Math.ceil(((d - Date.UTC(jahr, 0, 1)) / 864e5 + 1) / 7);
  return `${jahr}-W${String(woche).padStart(2, '0')}`;
}

/**
 * „Ein Stand je Woche": der letzte Stand jeder Kalenderwoche, alt nach neu. `staende` ist der Verlauf von
 * `graph_readiness({verlauf})`; das Datum ist der Tag aus `ts` (so, wie Git ihn mit Zeitzone schreibt).
 * Befunde ohne Plan = Summe aller Stufen ausser Plan.
 */
export function wochenTabelle(staende) {
  const jeWoche = new Map();
  for (const s of [...staende].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))) {
    const datum = s.ts.slice(0, 10);
    jeWoche.set(kalenderwoche(datum), { datum, s }); // der spaetere Stand ueberschreibt
  }
  return [...jeWoche].map(([woche, { datum, s }]) => ({
    woche,
    datum,
    stand: s.short,
    marken: s.marks.filter((m) => m.reached).map((m) => m.id).join(' ') || 'keine',
    ohnePlan: s.stages.filter((x) => x.name !== 'Plan').reduce((n, x) => n + x.findings, 0),
    plan: s.stages.find((x) => x.name === 'Plan')?.findings ?? 0,
  }));
}

const zelle = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/**
 * Die Datei. Wirft, wenn eine erwartete ID fehlt oder eine Zeile keinen Stempel traegt: eine Zahl
 * ohne Stempel ist keine Messung. `erwartet` ist die Liste der Zeilen-IDs, die der Lauf fuehrt.
 */
export function renderStand(zeilen, stempel, wochen, erwartet) {
  const fehlt = erwartet.filter((id) => !zeilen.some((z) => z.id === id));
  if (fehlt.length) throw new Error(`messung: keine Zeile fuer ${fehlt.join(', ')}`);
  const ohne = zeilen.filter((z) => !z.stempel).map((z) => z.id);
  if (ohne.length) throw new Error(`messung: ohne Stempel keine Zahl — ${ohne.join(', ')}`);
  return [
    '# Messstand',
    '',
    '> GENERIERT von `npm run messung` (`scripts/messung.mjs`) — nicht von Hand bearbeiten. Die Definition je Größe steht in [`kennzahlen.md`](kennzahlen.md).',
    `> Stempel des Laufs: ${stempel}`,
    '',
    '| Nr | Zeile | Kriterium | Wert | Vorwert | Seit | Urteil | Datum | Stempel |',
    '|---|---|---|---|---|---|---|---|---|',
    ...erwartet.map((id) => zeilen.find((z) => z.id === id)).map((z) =>
      `| ${z.nr} | ${z.id} | ${zelle(z.kriterium)} | ${zelle(z.wert)} | ${z.vorwert === null ? 'erster Lauf' : zelle(z.vorwert)} | ${z.seit} | ${z.urteil} | ${z.datum} | ${zelle(z.stempel)} |`),
    '',
    '## Ein Stand je Woche',
    '',
    'Der letzte committete Stand von `docs/graph` je Kalenderwoche. „Befunde ohne Plan“ summiert alle Stufen außer Plan.',
    '',
    '| Woche | Datum | Stand | Erreichte Marken | Befunde ohne Plan | Befunde Plan |',
    '|---|---|---|---|---|---|',
    ...wochen.map((w) => `| ${w.woche} | ${w.datum} | ${w.stand} | ${w.marken} | ${w.ohnePlan} | ${w.plan} |`),
    '',
  ].join('\n');
}

/** Der Teil der Zeilen, den der naechste Lauf als Vorwert liest. */
export function alsStand(zeilen, stempel) {
  return StandSchema.parse({
    stempel,
    zeilen: zeilen.map(({ id, nr, kriterium, wert, urteil, datum, seit, stempel: s }) => ({ id, nr, kriterium, wert, urteil, datum, seit, stempel: s })),
  });
}

// ---------------------------------------------------------------------------
// Werte der Groessen aus ihren Quellen (rein)
// ---------------------------------------------------------------------------

/** Nr 3 — Steuerwert und Ueberschreitungen je Steuerregel, aus dem juengsten Stand des Verlaufs. */
export function wertSteuer(stand) {
  const s = stand.steer;
  const je = s.byRule.map((r) => `${r.ruleId} ${r.over}`).join(', ');
  return `Steuerwert ${s.worst.toFixed(2)}${s.worstAt ? ` bei ${s.worstAt.ruleId} ${s.worstAt.elementId}` : ''}; Überschreitungen: ${je || 'keine'} (Stand ${stand.short})`;
}

/** Nr 4 — Testergebnis je Anforderung. */
export function wertTests(stand) {
  const t = stand.tests;
  return `${t.passed} von ${t.requirements} Anforderungen bestanden, ${t.failed} rot, ${t.neverRun} nie gelaufen (Stand ${stand.short})`;
}

/** Nr 5 — Ketten bewertbar. */
export function wertKetten(stand) {
  return `${stand.chains.measurable} von ${stand.chains.total} Ketten bewertbar (Stand ${stand.short})`;
}

/** Nr 6 — Schlupf: die Folge ohne Schlupf (`schlupfFreieFolge`) und der Anteil der CODE-CRs mit Schlupf. */
export function wertSchlupf(zeilen, folge, schwelle) {
  const jeCr = new Map();
  for (const z of zeilen) {
    const v = jeCr.get(z.cr) ?? { spur: z.spur, schlupf: false };
    jeCr.set(z.cr, { spur: z.spur, schlupf: v.schlupf || z.schlupf.length > 0 });
  }
  const code = [...jeCr.values()].filter((v) => v.spur === 'CODE');
  return `Folge ohne Schlupf ${folge} CRs der Spur CODE (Schwelle ${schwelle}); CODE-CRs mit Schlupf ${code.filter((v) => v.schlupf).length} von ${code.length}`;
}

/** Nr 7 — Bindung der Blackbox- und Schnittstellen-Tests, aus der juengsten Zeile je CR. */
export function wertZusage(zeile) {
  const { blackbox: b, schnittstelle: s } = zeile.zusage;
  return `Blackbox ${b.gebunden}/${b.total}, Schnittstelle ${s.gebunden}/${s.total} (${zeile.cr})`;
}

/**
 * Nr 9 — Dauer: Rechenzeit der Auswahl gegen den Volllauf, juengste Zeile der Spur CODE mit `dauer`. Eine Zeile der
 * Spur VOLL waehlt alles: Auswahl und Volllauf waeren dieselbe Zahl. `null`, wenn keine Zeile passt.
 */
export function wertDauer(zeilen) {
  const z = [...zeilen].reverse().find((x) => x.dauer && x.spur === 'CODE');
  if (!z) return null;
  const s = (ms) => `${Math.round(ms / 1000)} s`;
  return `Auswahl ${s(z.dauer.auswahlMs)} gegen Volllauf ${s(z.dauer.vollMs)}, Rechenzeit (${z.cr})`;
}

/**
 * Nr 12 — `graph_impact` bei CRs mit Loeschung. Je CR eine Aussage, auch bei mehreren Sitzungen: der CR
 * hat eine Loeschung, wenn eine Zeile Dateien als geloescht fuehrt, und `graph_impact` aufgerufen, wenn
 * irgendeine Sitzung ihn rief. Zeilen ohne Protokoll (`sitzung: null`) sagen nichts ueber den Aufruf.
 */
export function crsMitLoeschung(zeilen) {
  const jeCr = new Map();
  for (const z of zeilen) {
    const v = jeCr.get(z.cr) ?? { cr: z.cr, datum: z.datum, loeschung: false, protokoll: false, impact: false };
    v.loeschung ||= (z.geloeschteDateien ?? 0) > 0;
    if (z.sitzung) {
      v.protokoll = true;
      v.impact ||= (z.impact ?? 0) > 0;
    }
    jeCr.set(z.cr, v);
  }
  return [...jeCr.values()].filter((v) => v.loeschung && v.protokoll).sort((a, b) => a.datum.localeCompare(b.datum));
}

export function wertLoeschung(zeilen, fenster = 20) {
  const crs = crsMitLoeschung(zeilen).slice(-fenster);
  if (crs.length === 0) return 'kein CR mit Löschung im Protokoll';
  const mit = crs.filter((c) => c.impact);
  return `${mit.length} von ${crs.length} CRs mit Löschung riefen graph_impact (jüngste ${crs.length}; zuletzt ${crs.at(-1).cr}: ${crs.at(-1).impact ? 'ja' : 'nein'})`;
}

/**
 * Die Zeile T-E1 aus dem Inhalt von `.graphcode/cr-messung.jsonl` (CR-GC-951). Das Protokoll ist lokal und
 * nicht versioniert: fehlt es oder ist es leer (frischer Klon, CI), ist der Wert „nicht gemessen" mit Grund,
 * kein Abbruch und keine Zahl.
 */
export function zeileLoeschung(inhalt) {
  const zeilen = (inhalt ?? '').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
  if (zeilen.length === 0) {
    return { wert: 'nicht gemessen: das lokale Protokoll `.graphcode/cr-messung.jsonl` fehlt oder ist leer', extra: { stempel: 'keine Messung' } };
  }
  const letzte = zeilen.at(-1);
  return { wert: wertLoeschung(zeilen), extra: { datum: letzte.datum.slice(0, 10), stempel: `commit ${letzte.commit}` } };
}
