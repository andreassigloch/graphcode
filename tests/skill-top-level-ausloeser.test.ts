/**
 * TEST-skill-top-level-ausloeser
 *
 * CR-GC-873 — se:top-level Regel 4 und das Merkmal `sync` beim Kettenschnitt.
 *
 * Regel 4 hiess „One trigger per chain" und verbot damit auch den Akteur in der Mitte (die
 * Freigeberin, die einen Vorschlag sieht und freigibt). Neu, abgeleitet aus `chainRoles`
 * (contracts CR-SM-420): ein Eingangsknoten je Kette, parallele Ausloeser nur dort mit gleichem
 * Vertrag, ein Akteur in der Mitte ist erlaubt. FC-06 meldet die uebrigen Faelle und eine Kette mit
 * einem Fluss ohne `sync` — deshalb setzt der Autor `sync` beim Kettenschnitt (Stufe 3, FLOW +
 * SCHEMA), nicht erst in se-vorbereitung. Der Test bindet den Text an den Regelkatalog: nennt er
 * FC-06, muss es FC-06 geben.
 *
 * CR-GC-875 zieht die Akteur-Lehre (contracts `chainRoles`, FC-06) in author-actor, top-level Regel 4,
 * se-fmea, se-vorbereitung und se-laufzeit nach; der letzte Block prueft diese Saetze.
 *
 * CR-GC-863 (sirail): ein Teil des eigenen Produkts ist nie ein ACTOR, und die Domaenenregel fuer den
 * MOD-Schnitt steht in author-actor, top-level, se-modulebene und se:optimize.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_RULE_DEFS, FlowSync } from '@sigloch/contracts/se';

const COMMANDS = join(import.meta.dirname, '..', '.claude', 'commands');
const topLevel = readFileSync(join(COMMANDS, 'se', 'top-level.md'), 'utf8');
const vorbereitung = readFileSync(join(COMMANDS, 'se-vorbereitung.md'), 'utf8');
const authorActor = readFileSync(join(COMMANDS, 'se', 'author-actor.md'), 'utf8');
const fmea = readFileSync(join(COMMANDS, 'se-fmea.md'), 'utf8');
const laufzeit = readFileSync(join(COMMANDS, 'se-laufzeit.md'), 'utf8');
const regel4 = topLevel.split('\n').find((l) => l.startsWith('4. **One entry node per chain.**')) ?? '';
const stufe3Fluss = topLevel.split('\n').find((l) => l.startsWith('3. **FLOW + SCHEMA**')) ?? '';

describe('se:top-level Regel 4: ein Eingangsknoten je Kette (CR-GC-873)', () => {
  it('der Kopf traegt Version 14 (CR-GC-939, CR-GC-949, CR-GC-925, CR-GC-968)', () => {
    expect(topLevel).toMatch(/^version: 14$/m);
  });

  it('die alte Regel „One trigger per chain" ist weg', () => {
    expect(topLevel).not.toContain('One trigger per chain');
  });

  it('Regel 4 erlaubt parallele Ausloeser nur am selben Eingangsknoten mit gleichem Vertrag', () => {
    expect(regel4).toMatch(/only at that entry node and with the same contract/);
  });

  it('Regel 4 erlaubt den Akteur in der Mitte und nennt die Abschnitte', () => {
    expect(regel4).toMatch(/An actor in the middle is allowed/);
    expect(regel4).toMatch(/segments/);
  });

  it('Regel 4 verweist auf FC-06, und FC-06 steht im Regelkatalog mit Stufe 8', () => {
    expect(regel4).toContain('FC-06');
    expect(ALL_RULE_DEFS.find((r) => r.id === 'FC-06')?.stage).toBe(8);
  });
});

describe('`sync` wird beim Kettenschnitt gesetzt, nicht erst in se-vorbereitung (CR-GC-873)', () => {
  it('Stufe 3 (FLOW + SCHEMA) setzt jeden Wert aus FlowSync und nennt FC-06', () => {
    for (const wert of FlowSync.options) expect(stufe3Fluss, wert).toContain(`@sync ${wert}`);
    expect(stufe3Fluss).toMatch(/while you cut the chain/);
    expect(stufe3Fluss).toContain('FC-06');
  });

  it('se-vorbereitung nennt se:top-level als Ort des Merkmals und prueft nur nach', () => {
    expect(Number(vorbereitung.match(/^version: (\d+)$/m)![1])).toBeGreaterThanOrEqual(10);
    expect(vorbereitung).toMatch(/Das Merkmal `sync` setzt der Autor beim Kettenschnitt \(`se:top-level`, Phase 3, Schritt FLOW \+ SCHEMA\)/);
    expect(vorbereitung).not.toMatch(/Flüsse als synchron oder asynchron kennzeichnen/);
  });
});

describe('`sync` hängt am Warten, nicht am Übertragungsweg; Beleg aus jeder Beschreibung (CR-GC-968)', () => {
  const regel7 = topLevel.split('\n').find((l) => l.startsWith('7. **`sync` answers one question')) ?? '';
  const pruefung = vorbereitung.slice(vorbereitung.indexOf('> Wartet die Antwort des Abnehmers auf diese Lieferung?'), vorbereitung.indexOf('## 4. Flüsse am Code prüfen'));

  it('kein Skill setzt einen Rückruf oder ein Ereignis pauschal auf async', () => {
    expect(regel7).not.toMatch(/A callback, an event or a file that someone reads later is `async`/);
    expect(pruefung).not.toMatch(/Ein Rückruf, ein Ereignis oder eine Datei, die später jemand liest, heißt Nein/);
    expect(regel7).toMatch(/The carrier does not decide/);
    expect(pruefung).toMatch(/Der Übertragungsweg entscheidet nicht/);
  });

  it('der Beleg kommt aus der Beschreibung der Realisierung, Code ist ein Fall davon', () => {
    for (const quelle of ['Code (Datei und Zeile)', 'Schaltplan (Blatt und Netz)', 'Protokoll oder Datenblatt (Abschnitt)', 'Zeichnung (Position)', 'eine REQ, die das Verhalten fordert'])
      expect(pruefung, quelle).toContain(quelle);
  });

  it('ohne Beleg fragt der Skill den Autor; ohne Autor bleibt das Merkmal leer', () => {
    expect(pruefung).toMatch(/Fehlt jeder Beleg, frag den Autor/);
    expect(pruefung).toMatch(/Ohne Autor \(headless\) lass das Merkmal weg/);
    expect(regel7).toMatch(/ask the author/);
  });

  it('die Beispieltabelle zeigt Software, Elektrik, Mechanik, Hydraulik und Organisation, Rückruf in beiden Spalten', () => {
    for (const bereich of ['Software', 'Elektrisch', 'Mechanisch', 'Hydraulisch', 'Organisation']) expect(pruefung, bereich).toMatch(new RegExp(`^\\| ${bereich}`, 'm'));
    expect(pruefung).toMatch(/^\| Software, Ereignis \|[^\n]*Rückruf[^\n]*\|[^\n]*Ereignis/m);
  });
});

describe('Akteur-Lehre in den Skills (CR-GC-875)', () => {
  it('Regel 4 nennt alle vier FC-06-Faelle und die Quittung', () => {
    expect(regel4).toMatch(/no trigger/);
    expect(regel4).toMatch(/different members or contracts/);
    expect(regel4).toMatch(/`\[predelivery\]`/);
    expect(regel4).toMatch(/flow without `sync`/);
    expect(regel4).toMatch(/A receipt \(`async` hand-over, `sync` back\) triggers nothing/);
  });

  it('author-actor: kein „external service" mehr', () => {
    expect(authorActor).not.toContain('external service');
  });

  it('author-actor: Vorab-Lieferung, Akteur in der Mitte, parallele Ausloeser, Quittung, Rolle als Feld', () => {
    expect(authorActor).toMatch(/An actor that only delivers in advance is none/);
    expect(authorActor).toContain('[predelivery]');
    expect(authorActor).toMatch(/An actor in the middle is allowed: it gets a `sync` flow from the chain and feeds a later member/);
    expect(authorActor).toMatch(/Several triggers only at the same member with the same SCHEMA/);
    expect(authorActor).toMatch(/A receipt \(`async` hand-over, `sync` back\) triggers nothing/);
    expect(authorActor).toMatch(/The role is not an attribute\. It is a field in the result of `chainRoles`, per entry \(actor, flow, member\) and chain/);
  });

  it('die Rolle `answer` steht nur in author-actor (CR-GC-925), nicht in den Analyse-Skills', () => {
    for (const t of [fmea, vorbereitung, laufzeit]) expect(t).not.toMatch(/`answer`/);
  });

  it('se-fmea: Version 13, Akteur in der Mitte und Abschnitte aus chainRoles.segments', () => {
    expect(Number(fmea.match(/^version: (\d+)$/m)![1])).toBeGreaterThanOrEqual(13);
    expect(fmea).toMatch(/Akteur in der Mitte/);
    expect(fmea).toContain('chainRoles.segments');
  });

  it('se-vorbereitung und se-laufzeit: async am Fluss eines Akteurs ohne Rueckfluss ist eine Vorab-Lieferung', () => {
    expect(Number(laufzeit.match(/^version: (\d+)$/m)![1])).toBeGreaterThanOrEqual(4);
    for (const t of [vorbereitung, laufzeit]) {
      expect(t).toMatch(/`async` am Fluss eines Akteurs, der aus der Kette nichts empfängt, ist eine Vorab-Lieferung \(`FC-06`, `\[predelivery\]`\)/);
    }
  });
});

describe('Hardware-Systeme: Produktteile und Domaenenregel (CR-GC-863)', () => {
  const modulebene = readFileSync(join(COMMANDS, 'se-modulebene.md'), 'utf8');
  const optimize = readFileSync(join(COMMANDS, 'se', 'optimize.md'), 'utf8');

  it('author-actor: ein Teil des eigenen Produkts ist nie ein Akteur, in Schritt 3 und in der Pruefliste', () => {
    expect(authorActor).toMatch(/A part of your own product is never an actor/);
    expect(authorActor).toMatch(/turnout drive \(servo, linkage, end-position switches\)/);
    expect(authorActor).toMatch(/Is any actor a part of your own product/);
  });

  it('top-level: Domaenenregel mit beiden Beispielen, Kennzahl entscheidet nicht', () => {
    expect(topLevel).toMatch(/## Domains: a module may mix mechanics, electronics and software/);
    expect(topLevel).toMatch(/controller hardware \(board\) and controller software \(firmware\)/);
    expect(topLevel).toMatch(/servo drive made of motor, gearbox/);
    expect(topLevel).toMatch(/A metric justifies neither merging nor splitting/);
  });

  it('se-modulebene und se:optimize stellen die Domaenenfrage vor Zusammenlegen oder Teilen', () => {
    expect(modulebene).toMatch(/\*\*Domänenfrage\*\*/);
    expect(modulebene).toMatch(/Vor jedem Zusammenlegen oder Teilen steht die Domänenfrage/);
    expect(optimize).toMatch(/stell vor der Probe die Domänenfrage/);
  });

  it('jede genannte Regel steht im Katalog', () => {
    const ids = new Set(ALL_RULE_DEFS.map((r) => r.id));
    for (const id of ['RD-05', 'CR-01']) expect(ids.has(id), id).toBe(true);
  });
});

describe('se:top-level liest Constraints, Ausnahme fuer gleiche Ketten hinter einer Plugin-Grenze (CR-GC-864)', () => {
  it('Phase 2 nennt constraintCarriers als Vorgabe des Schnitts', () => {
    expect(topLevel).toMatch(/Read the set constraints before you cut:\*\* `graph_metrics\(\{ constraintCarriers: true \}\)`/);
  });

  it('Sub use cases und Pruefrage 2 nennen die Ausnahme', () => {
    expect(topLevel).toMatch(/\*\*Exception: the same chain behind a plugin boundary\.\*\*/);
    const frage2 = topLevel.split('\n').find((l) => l.startsWith('2. **Are the use cases disjoint?**')) ?? '';
    expect(frage2).toMatch(/Exception: use cases that differ in actor, goal or approval rule/);
  });
});

describe('UC- und FCHAIN-Namen benennen das Beduerfnis (CR-GC-881)', () => {
  const authorUc = readFileSync(join(COMMANDS, 'se', 'author-uc.md'), 'utf8');

  it('se:author-uc: Abschnitt zum Namen mit falschem und richtigem Beispiel, auch fuer die Kette', () => {
    expect(authorUc).toMatch(/^version: 5$/m);
    expect(authorUc).toMatch(/## The name states the need, not the solution/);
    expect(authorUc).toMatch(/Verb \+ Object from the actor's view/);
    expect(authorUc).toMatch(/Wrong: "AI content to target"/);
    expect(authorUc).toMatch(/Name each FCHAIN of the UC the same way/);
  });

  it('se:author-uc nennt die Regel UC-07 und wo ihre Wortliste steht (CR-GC-915)', () => {
    expect(authorUc).toMatch(/Rule `UC-07` \(warning\)/);
    expect(authorUc).toMatch(/`metricPolicy\.needNameTerms` in `graphcode\.config\.jsonc`/);
  });

  it('se:top-level: Pruefrage 4 verlangt dasselbe fuer UC- und Kettennamen', () => {
    const frage4 = topLevel.split('\n').find((l) => l.startsWith('4. **Is every name active?**')) ?? '';
    expect(frage4).toMatch(/UC and FCHAIN names state the actor's need as Verb \+ Object/);
  });
});

describe('Antwortende Akteure und eigene Speicher bekommen Fluss und SCHEMA (CR-GC-925)', () => {
  const schritt3 = authorActor.split('\n').find((l) => l.startsWith('3. Keep a non-human counterpart')) ?? '';
  const schritt4 = authorActor.split('\n').find((l) => l.startsWith('4. What is left is the set.')) ?? '';

  it('author-actor: Version 5, die alte Regel „ohne Fluss im Modell" ist weg', () => {
    expect(authorActor).toMatch(/^version: 5$/m);
    expect(authorActor).not.toMatch(/no flow in the model/);
    expect(authorActor).not.toMatch(/Only answering is not an actor/);
    expect(authorActor).not.toMatch(/Does any actor only answer, or only deliver in advance\? Then it is no actor/);
  });

  it('author-actor Schritt 3: ein antwortendes fremdes System ist ein Akteur mit der Rolle `answer`', () => {
    expect(schritt3).toMatch(/A system outside the boundary that only answers is an actor too/);
    expect(schritt3).toMatch(/derive the role `answer`/);
    expect(schritt3).toMatch(/never triggers a chain and is never its sink/);
  });

  it('author-actor Schritt 3: je rufender Funktion ein Paar, Anfrage `async`, Antwort `sync`, je mit SCHEMA', () => {
    expect(schritt3).toMatch(/one pair per function that calls it in code/);
    expect(schritt3).toMatch(/request flow `async`/);
    expect(schritt3).toMatch(/answer flow `sync`/);
    expect(schritt3).toMatch(/each with its SCHEMA/);
    expect(schritt3).toMatch(/names only the fields that function reads/);
  });

  it('author-actor Schritt 3: Adapter-Funktion nur, wenn der Code einen hat (Entscheidung 2026-11-18)', () => {
    expect(schritt3).toMatch(/Two functions that call the same system get one pair each/);
    expect(schritt3).toMatch(/Model an adapter function only when the code has one/);
  });

  it('author-actor Schritt 3: ein eigener Speicher ist kein Akteur, der Zugriff ein `sync`-Fluss mit SCHEMA', () => {
    expect(schritt3).toMatch(/A store of your own product is no actor/);
    expect(schritt3).toMatch(/access is a `sync` flow with a SCHEMA/);
  });

  it('author-actor Schritt 4: die Schwelle zaehlt nur Ausloeser und Empfaenger', () => {
    expect(schritt4).toMatch(/Count only the actors that trigger a chain or receive its result/);
    expect(schritt4).toMatch(/more than 7/);
  });

  it('author-actor: die Pruefliste fragt nach dem Paar des antwortenden Akteurs', () => {
    expect(authorActor).toMatch(/Does it only answer\? Then it keeps its request and answer pair, each with a SCHEMA/);
  });

  it('top-level Stufe 3: fremdes System und eigener Speicher mit Fluss und SCHEMA', () => {
    expect(stufe3Fluss).toMatch(/A system outside the boundary that answers gets a request flow `async` and an answer flow `sync`/);
    expect(stufe3Fluss).toMatch(/Access to a store of your own is a `sync` flow between two FUNCs with a SCHEMA/);
  });

  it('FC-04 steht im Katalog: der Satz zur Anfrage beruft sich auf eine echte Regel', () => {
    expect(authorActor).toContain('FC-04');
    expect(ALL_RULE_DEFS.some((r) => r.id === 'FC-04')).toBe(true);
  });
});
