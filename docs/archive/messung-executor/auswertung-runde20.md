# Auswertung Runde 20: Opus und lokale Modelle, Blindurteil über die Spec

Stand 2026-09-25, Code-Stand `2cd6fd3` (vor CR-GC-666). Korpus `sigllm-gcrun` (Prosa-Auftrag, Saat `SYS-sig-local`).
Beitrag zu **T-E1** (Lokal ≈ Frontier, Modell) der Aise-Leitlinie.

## Ergebnis

Die beste Spec liefert **Opus 5 über Claude Code**. Über unseren Executor liefert Opus 5 die zweitbeste.
Die lokalen Modelle liegen deutlich dahinter. Die **Readiness bildet das nicht ab**: Der lokale
Coder hat die höchste Readiness und das schlechteste Urteil. Als Kriterium für T-E1 taugt sie deshalb
nicht allein.

## Läufe

| Lauf | Modell · Treiber | Budget | Ende | Elemente | Readiness req / uc | Ablehnungen | Tokens ein / aus |
|---|---|---|---|---:|---|---:|---|
| `gcrun-frontier-3` | Opus 5 · Executor (Anthropic, Streaming) | 40 Runden | Rundengrenze, 13 min | 187 | .86 / .92 | 0 | 457k / 64k |
| `gcrun-160` | qwen3-coder-30b · Executor | 40 Runden | Rundengrenze, 12 min | 91 | .91 / .90 | 5 | 706k / 32k |
| `gcrun-180` | qwen3-coder-30b · Executor | 200 Runden | Rundengrenze, 140 min | 334 | .91 / .95 | 29 | – |
| `gcrun-170` | qwen3.8-27b, Thinking · Executor | 40 Runden | **Zeitgrenze 6 h nach 23 Runden** | 86 | .80 / .84 | 2 | – |
| `opus5-17` (runde18) | Opus 5 · Claude Code (`claude -p`) | – | – | 400 | .86 / .99 | 4 | – |

Ergebnisdateien: `results-runde20-frontier-ungebunden.json`, `-coder-ungebunden.json`, `-coder-200.json`, `-q38-40.json`.
Die Kosten weist das Rig nicht aus (`cost_usd` 0).

## Blindurteil

**Aufbau.** Jeder Graph wurde anonymisiert als lesbare Spec gerendert (UC → REQ mit `kinds` → TEST, dazu
FUNC/FCHAIN/FLOW/SCHEMA). Vier Gutachter (Claude-Subagenten) bewerteten je eine Spec gegen den Auftrag,
ein fünfter alle vier vergleichend. Keiner kannte die Zuordnung.

**Zuordnung.** Spec A = `gcrun-frontier-3` · B = `gcrun-170` · C = `opus5-17` · D = `gcrun-160`.

| Rang | Spec | Auftragspunkte ✓ / ~ / ✗ (von 26) | Treue | Dubletten | REQ | Tests | Struktur | Urteil |
|---|---|---|---:|---:|---:|---:|---:|---|
| 1 | C · Opus · Claude Code | 24 / 2 / 0 | 4 | 4 | 5 | 5 | 4 | mit Nacharbeit baubar |
| 2 | A · Opus · Executor | 22 / 4 / 0 | 3 | 2 | 3 | 4 | 2 | baubar nach gründlicher Bereinigung |
| 3 | B · qwen3.8 · Executor | 10 / 5 / 11 | 4 | 3 | 2 | 3 | 2 | treu, lückenhaft, nur Gerüst |
| 4 | D · qwen3-coder · Executor | 1 / 7 / 18 | 1 | 1 | 1 | 1 | 1 | unbrauchbar |

Noten 1–5 aus dem Vergleichsgutachten; 5 = gut, bei Dubletten 5 = keine.

**Kernbefunde je Spec**

- **C:**
  - Es fehlen die beiden Abnahmeaufgaben (Arbeitstagebuch, Erreichbarkeitsprüfung) als eigene UC/REQ/TEST.
  - Einige Betriebs-REQs gehen über den Auftrag hinaus (`REQ-aufbewahrungsdauer`, `REQ-sicherungskopie`).
  - Widerspruch: „höchstens ein Profil geladen“ gegen „64 GB für beide Profile“.
  - Stark: FMEA-Befunde mit Gegenmaßnahme; offene Punkte stehen ausdrücklich als ANNAHME da.
- **A:**
  - Erfundene Werte bei ausdrücklich offenen Punkten: 10 s, „höchstens zweimal“ wiederholen.
  - Ein 24-h-Nachholfenster widerspricht „jeder Tag zählt“.
  - Rund 15 Dubletten.
  - Fachlich falsche `satisfy`-Kanten, etwa `FUNC-weckruf-annehmen` → `REQ-interaktiv-api-kompatibel`.
  - Als einzige Spec mit ausdrücklichem Abnahmetest für beide Aufgaben.
- **B:**
  - Kaum Erfundenes, aber 11 Auftragspunkte fehlen, darunter Speicher/Profile, Umzug, Zustandserhalt und die Abgrenzungen.
  - REQs sind oft nur Titel.
  - Ketten mit je einer FUNC.
- **D:**
  - „Ohne Anmeldung“ (gemeint ist: nach einem Neustart steht der Dienst ohne Anmeldung wieder bereit) ist als anmeldefreier Nutzerzugang gelesen.
  - `REQ-login-passwort` stammt aus dem Format-E-Vorbild des Executor-Prompts und widerspricht dem Auftrag.
  - Erfundene Export-Anforderungen (CSV/JSON, 10.000 Zeilen).

**Grenzen.**
- N = 1 je Modell.
- Die Budgets sind ungleich: A und D endeten an der Rundengrenze, B an der Zeitgrenze; C lief über einen anderen Treiber.
- Die Gutachter sind Claude-Modelle, eine Vorliebe für Opus-Stil ist nicht ausgeschlossen. Die Treue-Befunde sind aber am Auftrag belegt.

## Befunde für die Weiterarbeit

1. **Readiness ≠ Spec-Qualität.**
   - D hat die höchste `req`-Readiness (.91) und das schlechteste Urteil.
   - Das Kriterium von T-E1 („Spannen überlappen“) würde hier „lokal ≈ frontier“ bestätigen.
   - Ein Maß für den Inhalt fehlt. Kandidaten: der Umfang der Nacharbeit aus dem Gutachten und die Zahl der offenen Punkte, die als Frage statt als erfundene Zahl stehen.
2. **Treiber:** Bei gleichem Modell ist Claude Code besser als der Executor, vor allem bei Dubletten, REQ-Qualität und Erfindungen.
3. **Sättigung, nicht Kontext** (ITEM-2026-572):
   - Der Coder wird ab etwa Runde 80 schlechter (Dubletten, Varianten `-2`/`-3`, Leck aus dem Vorbild).
   - Der Kontext je Aufruf bleibt bei 3–23k Tokens (Fenster 256k).
   - Der Ertrag hängt nicht an der Kontextgröße.
4. **`satisfy`/`kinds`** (ITEM-2026-572):
   - Hauptlast der Ablehnungen: 107 von 166 Preflight-Blocks.
   - In allen Armen fachlich falsche Erfüller.
   - Die FCHAIN wird als Ausweg genutzt. Erfüllte REQs je Erfüller-Typ:

   | | FUNC | FCHAIN | MOD / SYS |
   |---|---|---|---|
   | Hand-Golden `sigllm-v98` | 35 functional | 3 precondition, 3 postcondition, 1 non-functional | 20 mitigation, 7 non-functional |
   | `opus5-17` | 45 functional | 16 mitigation+functional, 5 andere | 23 non-functional |
   | `gcrun-frontier-3` | 38 functional | 16 functional, 9 andere | 10 |
   | `gcrun-180` | 62 functional | 46 functional, 8 ohne kinds, 22 non-functional | 9 |

   Von Hand erfüllt die FCHAIN nur den Rahmen eines Szenarios (Vor- und Nachbedingung) und eine
   Ende-zu-Ende-Güte. In den Läufen fängt sie alles auf, was unentschieden ist, auch REQs ohne `kinds`,
   weil ihr Pattern kein `where` trägt.
