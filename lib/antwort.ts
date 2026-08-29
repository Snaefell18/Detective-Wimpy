import type { Message } from "@anthropic-ai/sdk/resources/messages";

/**
 * Wertet eine Antwort der Claude-API aus.
 *
 * Bewusst wird hier selbst geparst statt über messages.parse(): Dessen strenge
 * Prüfung wirft eine Ausnahme, sobald ein einziges Feld nicht exakt zum Schema
 * passt - und ein Charakter, der "misstrauisch" statt "nervös" ist, hätte den
 * ganzen Spielzug gekostet. Die Feinarbeit macht danach lib/zuordnen.ts.
 */
export function ergebnisAus<T>(
  antwort: Message,
  bereich: string,
): { daten: T } | { fehler: string; status: number } {
  const text = antwort.content
    .filter((block): block is Extract<typeof block, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  // Das Modell liefert JSON; manchmal mit Vor- oder Nachrede drumherum.
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
