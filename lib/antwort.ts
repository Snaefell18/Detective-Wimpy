import type { Message } from "@anthropic-ai/sdk/resources/messages";

/**
 * Wertet eine Antwort der Claude-API aus.
 *
 * Statt jeden Misserfolg gleich zu behandeln, sagen wir genau, was los war -
 * sonst sieht man im Spiel nur "Fehler" und tappt im Dunkeln. Fehlt das
 * geparste Ergebnis, wird als letzter Versuch das JSON aus dem Text gelesen:
 * Das rettet Antworten, die inhaltlich stimmen, aber am Parser vorbeigingen.
 */
export function ergebnisAus<T>(
  antwort: Message & { parsed_output?: T | null },
  bereich: string,
): { daten: T } | { fehler: string; status: number } {
  if (antwort.parsed_output) return { daten: antwort.parsed_output };

  const text = antwort.content
    .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  // Notnagel: JSON aus dem Text fischen.
  const anfang = text.indexOf("{");
  const ende = text.lastIndexOf("}");
  if (anfang >= 0 && ende > anfang) {
    try {
      return { daten: JSON.parse(text.slice(anfang, ende + 1)) as T };
    } catch {
      // weiter zur Fehlermeldung
    }
  }

  if (antwort.stop_reason === "max_tokens") {
    console.error(`[${bereich}] Antwort abgeschnitten (max_tokens).`);
    return {
      fehler: "Die Antwort wurde abgeschnitten. Bitte noch einmal versuchen.",
      status: 502,
    };
  }

  if (antwort.stop_reason === "refusal") {
    console.error(`[${bereich}] Abgelehnt:`, antwort.stop_details);
    return {
      fehler: "Darauf möchte Claude nicht antworten. Formuliere es anders.",
      status: 502,
    };
  }

  console.error(
    `[${bereich}] Unbrauchbare Antwort. stop_reason=${antwort.stop_reason}, Text:`,
    text.slice(0, 400),
  );
  return {
    fehler: `Die Antwort war nicht lesbar (${antwort.stop_reason ?? "unbekannt"}).`,
    status: 502,
  };
}

/** Macht aus einem Fehler eine Meldung, die im Spiel weiterhilft. */
export function fehlerText(fehler: unknown, bereich: string): string {
  console.error(`[${bereich}]`, fehler);

  if (fehler instanceof Error) {
    // Fehler der Anthropic-API tragen Status und Grund im Text - beides ist
    // für die Fehlersuche Gold wert, deshalb bleibt es lesbar.
    return fehler.message.slice(0, 400);
  }
  return "Unbekannter Fehler.";
}
