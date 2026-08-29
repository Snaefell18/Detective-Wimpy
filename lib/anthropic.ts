import Anthropic from "@anthropic-ai/sdk";

/** Default-Modell; über die Env-Variable ANTHROPIC_MODEL überschreibbar. */
export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

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
