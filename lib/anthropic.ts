import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";

/**
 * Standardmodell für das Spiel: Claude Sonnet 5.
 *
 * Sonnet kostet 2 $/10 $ je Million Token statt 5 $/25 $ bei Opus und ist für
 * Fallkonstruktion und Rollenspiel stark genug. Über Env-Variablen umstellbar:
 *
 *   ANTHROPIC_MODEL        - Fälle und Auflösungen
 *   ANTHROPIC_MODEL_TALK   - nur die Gespräche (der häufigste Aufruf).
 *                            Für sehr günstige Dialoge: claude-haiku-4-5
 */
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

/**
 * Modell für Gespräche: Haiku 4.5.
 *
 * Gespräche sind der mit Abstand häufigste Aufruf und der einzige, bei dem
 * jemand wartend auf den Bildschirm schaut. Haiku antwortet deutlich schneller
 * als Sonnet und kostet 1 $/5 $ statt 2 $/10 $ je Million Token. Wer lieber
 * die vollere Rollenprosa möchte, stellt um:
 *
 *   ANTHROPIC_MODEL_TALK=claude-sonnet-5
 */
export const MODEL_GESPRAECH = process.env.ANTHROPIC_MODEL_TALK ?? "claude-haiku-4-5";

/**
 * Ältere Modelle (Haiku 4.5, Sonnet 4.5 ...) kennen weder adaptives Denken
 * noch "effort" und lehnen beides mit einem Fehler ab. Wer über
 * ANTHROPIC_MODEL_TALK auf so ein Modell umstellt, soll trotzdem spielen
 * können.
 */
const kenntEffort = (modell: string) =>
  !/(haiku-4-5|sonnet-4-5|opus-4-5|claude-3)/.test(modell);

/**
 * Optionen für eine Antwort, die schnell kommen muss.
 *
 * Der Denkaufwand steht auf "low" - ein Tier sagt ein paar Sätze, mehr braucht
 * es nicht. Ganz abschalten lässt sich das Denken zwar auch, aber dann
 * schreiben manche Modelle Formatreste wie "json" oder Tags in den Antworttext.
 * Ältere Modelle (Haiku 4.5, Sonnet 4.5 ...) kennen weder adaptives Denken noch
 * "effort" und bekommen deshalb keins von beidem.
 */
export function schnellOptionen(modell: string, format: object) {
  return (
    kenntEffort(modell)
      ? {
          thinking: { type: "adaptive" },
          output_config: { effort: "low", format },
        }
      : { output_config: { format } }
  ) as Pick<MessageCreateParamsNonStreaming, "thinking" | "output_config">;
}

let client: Anthropic | null = null;

/**
 * Der Anthropic-Client wird erst beim ersten Aufruf gebaut, damit der Build
 * auch ohne gesetzten Key durchläuft (der Key liegt nur zur Laufzeit in Vercel).
 */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY ist nicht gesetzt. In Vercel unter Settings > Environment Variables hinterlegen.",
    );
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Zeitbudget für einen Modellaufruf.
 *
 * Vercel bricht eine Funktion nach maxDuration (60 s) hart ab und liefert dann
 * eine HTML-Fehlerseite statt JSON - der Browser zeigt daraufhin eine
 * kryptische Meldung. Deshalb bekommt jeder Aufruf ein eigenes, kleineres
 * Budget, damit noch Zeit für eine verständliche eigene Antwort bleibt.
 *
 * Achtung: Das Zeitlimit gilt je Versuch. Die Sekunden mal (versuche + 1)
 * müssen deshalb unter dem Limit der Plattform bleiben.
 */
export const budget = (sekunden: number, versuche = 0) => ({
  timeout: sekunden * 1000,
  maxRetries: versuche,
});
