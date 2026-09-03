# CR-GC-474 — `package-version` in den Kern

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467, Strang A (Tool-Interface an
den Rand) — der eine Eintrag darin, der kein Typ, sondern ein Helfer ist

## Root Cause

`kernel/store-lock.ts` stempelt den Lock mit der laufenden Version und importiert dafür
`surface/package-version.js` — der Kern kennt die Oberfläche (Inversion aus CR-GC-467). Der Helfer
selbst (54 Zeilen, `packageRootDir`, `readPackageVersion`) hat keine Abhängigkeit außer `node:`;
er liegt in `surface`, weil er dort zuerst gebraucht wurde (CR-GC-376), nicht weil er dorthin
gehört. „Welcher Build läuft" ist Infrastruktur der untersten Schicht.

## Änderung

- `git mv src/surface/package-version.ts src/kernel/package-version.ts`; der Aufwärtssuche nach
  `package.json` ist die Verzeichnistiefe egal (Kommentar in der Datei nachgezogen).
- Fünf Importeure: `kernel/store-lock` (jetzt Geschwister), `surface/mcp-server`,
  `surface/scaffold-templates`, `surface/status`, `surface/upgrade` (zeigen jetzt nach unten).
- Ratchet **26 → 25**. Kein Modell-Knoten trägt einen `realRef` auf diese Datei — kein Gate-Batch.

## Akzeptanzkriterien

- [x] Kein Verweis auf `surface/package-version` mehr in `src/`, `tests/`, `scripts/`.
- [x] Build grün; Ratchet, `store-lock` (18), `host-shim`, `host.bridge-attach`, `repo-lifecycle` grün.
      **Vorbestand:** `distribution.test.ts` › *installs from a packed tarball into a foreign repo* fällt
      identisch auf HEAD (Worktree-Gegenprobe) — `npm install` gegen die Registry, umgebungsabhängig.

## Dateien

1. `src/kernel/package-version.ts` (verschoben)
2. `src/kernel/store-lock.ts`
3. `src/surface/mcp-server.ts`
4. `src/surface/scaffold-templates.ts`
5. `src/surface/status.ts`
6. `src/surface/upgrade.ts`

Folgen: `tests/import-boundaries.test.ts`, ggf. Test-Pfade, dieser CR.
