/**
 * model-answer-contract.ts — SCHEMA-model-answer, der Datenvertrag der rohen
 * Modellantwort (FLOW-model-answer, CR-GC-426).
 *
 * Bis hierher las `buildCallModel` beide Backend-Antworten ad hoc: ein
 * `(await r.json()) as { choices?: … }`. Ein Cast prüft nichts. Wandert ein Feld
 * (ein anderer Anbieter, eine neue API-Version, ein lokaler Server mit eigener
 * Auslegung von „OpenAI-kompatibel"), dann ist `msg.tool_calls` schlicht
 * `undefined`, die Antwort gilt als tool-call-los, und der Fehler taucht erst
 * viel später auf: als Prosa-Recovery, die nichts findet, oder als Runde, die in
 * die Idle-Nudge läuft. Diagnostiziert wird dann der Parser, nicht der Anbieter.
 *
 * Deshalb liegt der Vertrag VOR der Normalisierung, an der Draht-Form jedes
 * Backends — dort fällt Drift beim Empfang auf, mit Feldnamen im Fehlertext.
 *
 * Warum überhaupt ein Vertrag über etwas, das am Ende Freitext ist: das Format
 * IST prüfbar, auch wenn der Text es nicht ist. graphcode modelliert auch
 * mechanische und elektrische Systeme — auch ein Tastendruck am Bildschirm
 * bekommt eine so gut wie möglich prüfbare Beschreibung des Flusses. „Der Inhalt
 * ist unstrukturiert" ist kein Grund, die HÜLLE ungeprüft zu lassen.
 *
 * Eigene Datei, weil RC-04 Import UND `parse` im Datei-Satz der io-verbundenen
 * FUNC verlangt — ein in derselben Datei definiertes Schema erfüllt das nie
 * (Lehre aus CR-GC-413/420).
 *
 * @author andreas@siglochconsulting
 */
import { z } from 'zod/v4';

/** Ein vom Modell angeforderter Werkzeugaufruf, backend-unabhängig. */
export const ModelToolCall = z.object({
  id: z.string(),
  name: z.string(),
  /** Die Argumente — vom Werkzeug-Schema geprüft, nicht hier. */
  input: z.unknown(),
});
export type ModelToolCall = z.infer<typeof ModelToolCall>;

/**
 * Die normalisierte Modellantwort: Text, Tool-Calls, Stop-Grund.
 *
 * `stopReason` ist neu (CR-GC-426) und kein Beiwerk: ohne ihn ist eine am
 * Token-Budget ABGESCHNITTENE Antwort von einer geschwätzigen nicht zu
 * unterscheiden — beide kommen ohne Tool-Call an. Genau für den ersten Fall
 * existiert der Salvage-Pfad in `executor-parse.ts` („devstrals [ARGS]-Mega-Batches
 * werden vom maxTokens-Budget mitten im JSON abgeschnitten"). `null`, wenn das
 * Backend keinen nennt — nie geraten.
 */
export const ModelAnswer = z.object({
  text: z.string(),
  toolCalls: z.array(ModelToolCall),
  stopReason: z.string().nullable(),
  /**
   * Die assistant-Nachricht in der Form DES BACKENDS, unverändert in die History
   * gepusht. Bewusst `unknown`: sie ist kein gemeinsamer Vertrag, sondern das,
   * was derselbe Anbieter beim nächsten Request wieder entgegennimmt.
   */
  assistantMsg: z.unknown(),
  usage: z.object({ in: z.number(), out: z.number(), reasoning: z.number() }),
});
export type ModelAnswer = z.infer<typeof ModelAnswer>;

/**
 * Die Fehlerhülle beider Backends — vor dem Antwortvertrag geprüft, weil ein
 * Fehlerkörper die Antwortform nicht erfüllen MUSS und sein Text die bessere
 * Diagnose ist als ein Zod-Issue über fehlende `choices`.
 */
export const BackendFailure = z
  .object({ type: z.string().optional(), error: z.unknown() })
  .refine((v) => v.type === 'error' || v.error !== undefined);

/** Draht-Form der Anthropic-Messages-API. */
export const AnthropicWireAnswer = z.object({
  content: z.array(
    z.object({
      type: z.string(),
      id: z.string().optional(),
      name: z.string().optional(),
      // Nur tool_use-Bloecke tragen `input`; ein text-Block hat keins.
      input: z.unknown().optional(),
      text: z.string().optional(),
    }),
  ),
  stop_reason: z.string().nullish(),
  usage: z
    .object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() })
    .optional(),
});

/** Draht-Form der OpenAI-kompatiblen chat/completions-API (auch lokale Server). */
export const OpenAiWireAnswer = z.object({
  choices: z.array(
    z.object({
      finish_reason: z.string().nullish(),
      message: z
        .object({
          content: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .nullish(),
        })
        .optional(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      completion_tokens_details: z.object({ reasoning_tokens: z.number().optional() }).optional(),
    })
    .optional(),
});

/** Kurze, lesbare Fassung eines Zod-Fehlers für die Backend-Diagnose. */
export function describeWireIssues(err: z.ZodError): string {
  return err.issues
    .slice(0, 4)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}
