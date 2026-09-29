#!/usr/bin/env node
/**
 * blindurteil.mjs — Qualität der Spec gegen den Auftrag, blind beurteilt (Leitlinie T-E10).
 *
 * Zwei Schritte, dazwischen das Urteil (ein Gutachter je Spec, ohne Vergleich, ohne Herkunft):
 *
 *   node blindurteil.mjs vorbereiten <ziel-dir> runs/gcrun-310 runs/gcrun-311 …
 *     → spec-<K>.md je Lauf (anonym, `spec-render.mjs`), zuordnung.json (K → Lauf, zufällig),
 *       gutachter-<K>.txt (die Vorgabe für genau einen Gutachter)
 *   node blindurteil.mjs auswerten <ziel-dir>
 *     → Tabelle je Lauf: ✓/~/✗ über die Auftragspunkte P*, offen geführte O*, erfundene Werte,
 *       Dubletten, Notensumme (5–25, Boden 5)
 *
 * Raster: `rig/sigllm-spezifikation/golden/auftragspunkte.json`; ein anderer Korpus per
 *   `--raster=<json> --auftrag=<md>` (z. B. `rig/agentdiary/golden/`). Die Gutachter sind Subagenten; ihre
 * Vorgabe steht hier, damit jede Runde dieselbe Frage stellt (Herkunft: Auswertung CR-GC-682).
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from './spec-render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RASTER = resolve(HERE, '../sigllm-spezifikation/golden/auftragspunkte.json');
export const AUFTRAG = resolve(HERE, '../sigllm-spezifikation/material-prosa/auftrag.md');
const KENNUNG = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');

export function gutachterVorgabe(spec, gutachten, { auftrag = AUFTRAG, raster = RASTER } = {}) {
  const r = JSON.parse(readFileSync(raster, 'utf8')).punkte;
  const p = r.filter((x) => x.id.startsWith('P')).length, o = r.length - p;
  return `Du bist Gutachter für eine Systemspezifikation. Bewerte GENAU EINE Spec streng gegen den Auftrag. Du kennst weder Autor noch Werkzeug — urteile nur am Text.

Dateien (nur lesen, nichts ändern):
- Auftrag: ${auftrag}
- Raster (${r.length} Punkte, ${p} Anforderungen P*, ${o} bewusst offene Punkte O*): ${raster}
- Die Spec: ${spec}

Lies keine anderen Dateien in diesen Verzeichnissen (insbesondere keine anderen spec-*.md).

Bewerte:
1. Je Rasterpunkt: "✓" (klar abgedeckt), "~" (teilweise/vage), "✗" (fehlt oder falsch). Nenne je Punkt die belegenden uids (REQ/UC/TEST/FUNC). Bei O* ist ✓ nur, wenn der Punkt als offen/Annahme/Frage geführt ist; ein erfundener konkreter Wert ist ✗.
2. Erfundene Werte: jede konkrete Zahl/Festlegung, die der Auftrag nicht hergibt (uid + Zitat).
3. Auftragsfremdes: Anforderungen, die dem Auftrag widersprechen oder nichts mit ihm zu tun haben (uid + Grund).
4. Dubletten: Anzahl inhaltlich doppelter REQ/FUNC, mit Beispielen.
5. Fachlich falsche Erfüller-Zuordnungen ("erfüllt von"), mit Beispielen.
6. Noten 1–5 (5 = gut; bei Dubletten 5 = keine): Treue zum Auftrag, Dubletten, REQ-Qualität (prüfbar, eindeutig), Tests (prüfen sie die REQ wirklich), Struktur (UC/Ketten/Flüsse/Module sinnvoll).
7. Urteil in einem Satz: wie weit ist die Spec von "baubar" entfernt.

Schreibe dein Ergebnis als JSON nach ${gutachten} mit den Schlüsseln: spec, punkte (Objekt id → {bewertung, belege, anmerkung}), erfunden (Liste), fremd (Liste), dubletten {anzahl, beispiele}, falscheErfueller (Liste), noten {treue, dubletten, req, tests, struktur}, urteil.
Antworte am Ende knapp: Zahl ✓/~/✗ über die P*, Zahl ✓ über die O*, die fünf Noten, das Urteil.
`;
}

/** `korpus`: Raster und Auftrag eines anderen Korpus (z. B. rig/agentdiary) — Vorgabe sigllm. */
export function vorbereiten(ziel, laeufe, zufall = Math.random, korpus = {}) {
  mkdirSync(ziel, { recursive: true });
  const k = KENNUNG.slice(0, laeufe.length);
  for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
  const zuordnung = {};
  laeufe.forEach((lauf, i) => {
    const kennung = k[i];
    zuordnung[kennung] = lauf.split('/').pop();
    const spec = join(ziel, `spec-${kennung}.md`);
    writeFileSync(spec, render(JSON.parse(readFileSync(join(lauf, 'graph.json'), 'utf8')), kennung));
    writeFileSync(join(ziel, `gutachter-${kennung}.txt`), gutachterVorgabe(resolve(spec), resolve(ziel, `gutachten-${kennung}.json`), korpus));
  });
  writeFileSync(join(ziel, 'zuordnung.json'), JSON.stringify(zuordnung, null, 1) + '\n');
  return zuordnung;
}

/** Ein Gutachten → Kennzahlen. Notensumme: Boden 5 (alles 1), Decke 25. */
export function kennzahlen(g) {
  const p = Object.entries(g.punkte).filter(([id]) => id.startsWith('P')).map(([, v]) => v.bewertung);
  const o = Object.entries(g.punkte).filter(([id]) => id.startsWith('O')).map(([, v]) => v.bewertung);
  return {
    voll: p.filter((b) => b === '✓').length,
    teil: p.filter((b) => b === '~').length,
    fehlt: p.filter((b) => b === '✗').length,
    offenGefuehrt: o.filter((b) => b === '✓').length,
    erfunden: g.erfunden?.length ?? 0,
    dubletten: g.dubletten?.anzahl ?? 0,
    notensumme: Object.values(g.noten ?? {}).reduce((a, b) => a + b, 0),
  };
}

export function auswerten(ziel) {
  const zuordnung = JSON.parse(readFileSync(join(ziel, 'zuordnung.json'), 'utf8'));
  const zeilen = readdirSync(ziel).filter((f) => /^gutachten-[A-Z]\.json$/.test(f)).map((f) => {
    const kennung = f.slice(10, 11);
    return { kennung, lauf: zuordnung[kennung], ...kennzahlen(JSON.parse(readFileSync(join(ziel, f), 'utf8'))) };
  });
  return zeilen.sort((a, b) => String(a.lauf).localeCompare(String(b.lauf), 'de', { numeric: true }));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  const [schritt, ziel, ...laeufe] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (schritt === 'vorbereiten' && ziel && laeufe.length) {
    const korpus = {
      ...(flags.raster ? { raster: resolve(flags.raster) } : {}),
      ...(flags.auftrag ? { auftrag: resolve(flags.auftrag) } : {}),
    };
    const z = vorbereiten(ziel, laeufe, Math.random, korpus);
    console.log(`${Object.keys(z).length} Specs in ${ziel}. Je Spec einen Gutachter mit gutachter-<K>.txt starten, dann: node blindurteil.mjs auswerten ${ziel}`);
  } else if (schritt === 'auswerten' && ziel && existsSync(join(ziel, 'zuordnung.json'))) {
    console.log('| Lauf | Spec | ✓ · ~ · ✗ (P*) | O* offen geführt | erfunden | Dubletten | Notensumme |');
    console.log('|---|---|---|---|---|---|---|');
    for (const z of auswerten(ziel)) {
      console.log(`| ${z.lauf} | ${z.kennung} | ${z.voll} · ${z.teil} · ${z.fehlt} | ${z.offenGefuehrt} | ${z.erfunden} | ${z.dubletten} | ${z.notensumme} |`);
    }
  } else {
    console.error('node blindurteil.mjs vorbereiten <ziel-dir> <lauf-dir> … [--raster=<json>] [--auftrag=<md>] | auswerten <ziel-dir>');
    process.exit(1);
  }
}
