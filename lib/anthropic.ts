import Anthropic from "@anthropic-ai/sdk";

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

/** Modell für Gespräche; ohne eigene Angabe dasselbe wie oben. */
export const MODEL_GESPRAECH = process.env.ANTHROPIC_MODEL_TALK ?? MODEL;

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
