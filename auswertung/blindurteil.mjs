/**
 * blindurteil.mjs — Qualität der Spec gegen den Auftrag, blind beurteilt (Leitlinie T-E10).
 *
 * Zwei Schritte, dazwischen das Urteil (ein Gutachter je Spec, ohne Vergleich, ohne Herkunft):
 *   node auswertung/blindurteil.mjs vorbereiten <ziel-dir> <lauf-dir> …    rendert je Lauf eine anonyme Spec
 *        (spec-<K>.md), schreibt die Gutachter-Vorgabe (gutachter-<K>.txt) und die Zuordnung (zuordnung.json);
 *        Raster und Auftrag kommen aus der Aufgabe des Laufs (rig/aufgaben/<name>/) — nicht fest aus einem Korpus.
 *   node auswertung/blindurteil.mjs auswerten <ziel-dir>                    liest die Gutachten (gutachten-<K>.json)
 *        und gibt je Lauf die Kennzahlen: P-Punkte ✓/~/✗, O-Punkte offen geführt, erfundene Werte, Dubletten, Notensumme.
 * `auswerten.mjs` findet die Gutachten eines Laufs über `blindurteilFuer` (alle blind*-Verzeichnisse seiner Aufgabe).
 * Herkunft: rig/greenfield-systemtest (CR-GC-682), hierher mit CR-GC-739.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from './spec-render.mjs';
import { aufgabeLaden } from '../rig/simulator.mjs';

const KENNUNG = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');

export function gutachterVorgabe(spec, gutachten, { auftrag, raster, punkte }) {
  const p = punkte.filter((x) => x.id.startsWith('P')).length, o = punkte.length - p;
  return `Du bist Gutachter für eine Systemspezifikation. Bewerte GENAU EINE Spec streng gegen den Auftrag. Du kennst weder Autor noch Werkzeug — urteile nur am Text.

Dateien (nur lesen, nichts ändern):
- Auftrag: ${auftrag}
- Raster (${punkte.length} Punkte, ${p} Anforderungen P*, ${o} bewusst offene Punkte O*): ${raster}
- Die Spec: ${spec}

Lies keine anderen Dateien in diesen Verzeichnissen (insbesondere keine anderen spec-*.md).

Bewerte:
1. Je Rasterpunkt: "✓" (klar abgedeckt), "~" (teilweise/vage), "✗" (fehlt oder falsch). Nenne je Punkt die belegenden uids (REQ/UC/TEST/FUNC). Bei O* ist ✓ nur, wenn der Punkt als offen/Annahme/Frage geführt ist — ein konkreter Wert dort ist erfunden (✗ und unter 2. nennen).
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

const aufgabeDesLaufs = (laufDir) => JSON.parse(readFileSync(join(laufDir, 'lauf.json'), 'utf8')).aufgabe ?? basename(dirname(laufDir));

/**
 * Specs und Gutachter-Vorgaben für eine Runde; alle Läufe gehören zu EINER Aufgabe (deren Raster und Auftrag
 * werden ins Ziel kopiert, damit der Gutachter nur dort liest). `zufall` mischt die Kennungen.
 */
export function vorbereiten(ziel, laeufe, { zufall = Math.random, aufgabe = null } = {}) {
  mkdirSync(ziel, { recursive: true });
  const namen = [...new Set(laeufe.map(aufgabeDesLaufs))];
  if (namen.length !== 1) throw new Error(`Blindurteil: eine Runde hat eine Aufgabe, nicht ${namen.join(', ') || 'keine'}`);
  const a = aufgabe ?? aufgabeLaden(namen[0]);
  const raster = resolve(ziel, 'raster.json'), auftrag = resolve(ziel, 'auftrag.md');
  writeFileSync(raster, JSON.stringify({ hinweis: a.rasterHinweis, punkte: a.punkte }, null, 1) + '\n');
  writeFileSync(auftrag, `${a.start}\n\n---\n\nAntworten des Auftraggebers auf Rückfragen:\n\n${a.antwortblatt}\n`);
  const k = KENNUNG.slice(0, laeufe.length);
  for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
  const zuordnung = {};
  laeufe.forEach((lauf, i) => {
    const kennung = k[i];
    zuordnung[kennung] = basename(lauf);
    const spec = resolve(ziel, `spec-${kennung}.md`);
    writeFileSync(spec, render(JSON.parse(readFileSync(join(lauf, 'graph.json'), 'utf8')), kennung));
    writeFileSync(join(ziel, `gutachter-${kennung}.txt`), gutachterVorgabe(spec, resolve(ziel, `gutachten-${kennung}.json`), { auftrag, raster, punkte: a.punkte }));
  });
  writeFileSync(join(ziel, 'zuordnung.json'), JSON.stringify({ aufgabe: namen[0], laeufe: zuordnung }, null, 1) + '\n');
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
  const z = JSON.parse(readFileSync(join(ziel, 'zuordnung.json'), 'utf8'));
  const zuordnung = z.laeufe ?? z;
  const zeilen = readdirSync(ziel).filter((f) => /^gutachten-[A-Z]\.json$/.test(f)).map((f) => {
    const kennung = f.slice(10, 11);
    return { kennung, lauf: zuordnung[kennung], runde: basename(ziel), ...kennzahlen(JSON.parse(readFileSync(join(ziel, f), 'utf8'))) };
  });
  return zeilen.sort((a, b) => String(a.lauf).localeCompare(String(b.lauf), 'de', { numeric: true }));
}

/** Das Gutachten eines Laufs aus den blind*-Verzeichnissen neben ihm — das jüngste, wenn mehrere; sonst null. */
export function blindurteilFuer(laufDir) {
  const eltern = dirname(laufDir), name = basename(laufDir);
  const runden = readdirSync(eltern).filter((d) => d.startsWith('blind') && existsSync(join(eltern, d, 'zuordnung.json'))).sort();
  let treffer = null;
  for (const r of runden) for (const z of auswerten(join(eltern, r))) if (z.lauf === name) treffer = z;
  return treffer;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [schritt, ziel, ...laeufe] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (schritt === 'vorbereiten' && ziel && laeufe.length) {
    const z = vorbereiten(ziel, laeufe.map((l) => resolve(l)));
    console.log(`${Object.keys(z).length} Specs in ${ziel}. Je Spec einen Gutachter mit gutachter-<K>.txt starten, dann: node auswertung/blindurteil.mjs auswerten ${ziel}`);
  } else if (schritt === 'auswerten' && ziel && existsSync(join(ziel, 'zuordnung.json'))) {
    console.log('| Lauf | Spec | ✓ · ~ · ✗ (P*) | O* offen geführt | erfunden | Dubletten | Notensumme |');
    console.log('|---|---|---|---|---|---|---|');
    for (const z of auswerten(ziel)) console.log(`| ${z.lauf} | ${z.kennung} | ${z.voll} · ${z.teil} · ${z.fehlt} | ${z.offenGefuehrt} | ${z.erfunden} | ${z.dubletten} | ${z.notensumme} |`);
  } else {
    console.error('node auswertung/blindurteil.mjs vorbereiten <ziel-dir> <lauf-dir> … | auswerten <ziel-dir>');
    process.exit(1);
  }
}
