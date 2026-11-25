#!/usr/bin/env node
/**
 * push-pruefung.mjs — die Prüfung im pre-push-Hook (CR-GC-1031).
 *
 * graphcode ist öffentlich: alles, was ein Push hochlädt, ist veröffentlicht. Die Prüfung bricht den Push ab,
 *   1. wenn der Stand eines gepushten Commits eine Datei auf einem verbotenen Pfad trägt (Spikes, eigene
 *      Messungen, Gesprächsprotokolle, interne Notizen) — Liste in push-pruefung.config.json;
 *   2. wenn eine hinzugefügte Zeile der gepushten Commits personenbezogene Daten trägt: Postadresse (Straße mit Hausnummer),
 *      E-Mail-Adresse, Telefonnummer, IBAN oder einen Firmennamen mit Rechtsform.
 * Ein Kunden- oder Personenname ohne solches Merkmal ist mit Mustern nicht erkennbar; das deckt die Prüfung nicht.
 * Eine Ausnahme steht ausdrücklich in der Config (`erlaubtePfade`, `erlaubteTreffer`), nie im geprüften Text.
 *
 * Aufruf durch git: `pre-push <remote> <url>`, auf stdin je Ref `<lokal-ref> <lokal-sha> <remote-ref> <remote-sha>`.
 * Exit 0 = durchlassen, Exit 1 = Abbruch mit Liste der Befunde.
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NULL_SHA = /^0+$/;
/** Reservierte Domains (RFC 2606/6761) gehören nie einer echten Person. */
const RESERVIERT = /@(?:[\w-]+\.)*(?:example\.(?:com|org|net)|[\w-]+\.(?:invalid|test|example))$/i;

/** Muster für personenbezogene Daten; je Muster ein Name für die Meldung. */
export const PII_MUSTER = [
  { art: 'E-Mail-Adresse', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { art: 'IBAN', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b/g },
  { art: 'Telefonnummer', re: /(?:\+|\b00)[1-9]\d[ /-]?\(?\d{2,5}\)?[ /-]?\d{3,}[ -]?\d{0,6}|\b(?:Tel|Telefon|Mobil|Fax)\.?:?\s*\(?0\d[\d /-]{5,}\d/gi },
  { art: 'Postadresse', re: /\b[A-ZÄÖÜ][a-zäöüß-]*(?:straße|strasse|str\.|weg|gasse|allee|platz)\s+\d{1,4}\s?[a-z]?\b/g },
  { art: 'Firma mit Rechtsform', re: /\b[A-ZÄÖÜ][\wÄÖÜäöüß&.-]*(?:\s[A-ZÄÖÜ&][\wÄÖÜäöüß&.-]*){0,3}\s(?:GmbH|mbH|AG|KG|KGaA|OHG|GbR|UG|Inc\.?|Ltd\.?|LLC|e\.\s?V\.)(?=[\s,.;:)]|$)/g },
];

export function ladeConfig(pfad = join(dirname(fileURLToPath(import.meta.url)), 'push-pruefung.config.json')) {
  const roh = JSON.parse(readFileSync(pfad, 'utf8'));
  return {
    verboten: roh.verbotenePfade.map((s) => new RegExp(s, 'i')),
    erlaubtePfade: new Set(roh.erlaubtePfade),
    erlaubteTreffer: new Set(roh.erlaubteTreffer),
  };
}

/** Pfade eines Stands, die die Config verbietet und nicht ausdrücklich erlaubt. */
export function verbotenePfade(pfade, config) {
  return pfade.filter((p) => !config.erlaubtePfade.has(p) && config.verboten.some((re) => re.test(p)));
}

/** PII-Treffer in den hinzugefügten Zeilen eines Unified-Diffs: {datei, zeile, art, text}. */
export function piiTreffer(diff, config) {
  const treffer = [];
  let datei = null;
  for (const zeile of diff.split('\n')) {
    if (zeile.startsWith('+++ ')) {
      datei = zeile.startsWith('+++ b/') ? zeile.slice(6) : null;
      continue;
    }
    if (!datei || !zeile.startsWith('+') || config.erlaubtePfade.has(datei)) continue;
    const text = zeile.slice(1);
    for (const { art, re } of PII_MUSTER) {
      for (const m of text.matchAll(re)) {
        if (art === 'E-Mail-Adresse' && RESERVIERT.test(m[0])) continue;
        if (!config.erlaubteTreffer.has(m[0].trim())) treffer.push({ datei, art, text: m[0].trim() });
      }
    }
  }
  return treffer;
}

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/** Die Commits, die ein Ref-Update neu zum Remote bringt (Spitze zuerst). */
function neueCommits(cwd, remote, lokalSha, remoteSha) {
  const bereich = NULL_SHA.test(remoteSha) ? [lokalSha, '--not', `--remotes=${remote}`] : [`${remoteSha}..${lokalSha}`];
  return git(cwd, ['rev-list', ...bereich]).split('\n').filter(Boolean);
}

/** Prüft alle Ref-Updates eines Pushs; liefert die Befunde (leer = durchlassen). */
export function pruefePush(cwd, remote, refZeilen, config) {
  const befunde = [];
  for (const zeile of refZeilen) {
    const [, lokalSha, remoteRef, remoteSha] = zeile.trim().split(/\s+/);
    if (!lokalSha || NULL_SHA.test(lokalSha)) continue; // Löschen eines Remote-Refs lädt nichts hoch
    const commits = neueCommits(cwd, remote, lokalSha, remoteSha);
    if (commits.length === 0) continue;
    const pfade = git(cwd, ['ls-tree', '-r', '--name-only', lokalSha]).split('\n').filter(Boolean);
    for (const p of verbotenePfade(pfade, config)) befunde.push({ ref: remoteRef, art: 'verbotener Pfad', datei: p, text: p });
    for (const c of commits) {
      const diff = git(cwd, ['show', '--format=', '--no-color', '--unified=0', '--diff-filter=AM', c]);
      const meldung = git(cwd, ['log', '-1', '--format=%B', c]).split('\n').map((z) => `+${z}`).join('\n');
      for (const t of piiTreffer(`${diff}\n+++ b/(Commit-Nachricht ${c.slice(0, 8)})\n${meldung}`, config)) {
        befunde.push({ ref: remoteRef, ...t });
      }
    }
  }
  return befunde;
}

function main() {
  const [remote = 'origin'] = process.argv.slice(2);
  const cwd = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const refZeilen = readFileSync(0, 'utf8').split('\n').filter((z) => z.trim());
  const befunde = pruefePush(cwd, remote, refZeilen, ladeConfig());
  if (befunde.length === 0) {
    console.log(`[pre-push] ${remote}: keine verbotenen Pfade, keine personenbezogenen Daten in den neuen Commits.`);
    return;
  }
  const eindeutig = [...new Map(befunde.map((b) => [`${b.art}|${b.datei}|${b.text}`, b])).values()];
  console.error(`[pre-push] Push nach ${remote} abgebrochen: ${eindeutig.length} Befund(e).`);
  for (const b of eindeutig) console.error(`  ${b.art}: ${b.datei}${b.art === 'verbotener Pfad' ? '' : ` — „${b.text}"`}`);
  console.error('[pre-push] Datei nach graphanalyze oder aise-bok verschieben bzw. Daten entfernen.');
  console.error('[pre-push] Ausnahme nur ausdrücklich: scripts/push-pruefung.config.json (erlaubtePfade, erlaubteTreffer).');
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
