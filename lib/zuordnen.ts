import type { TalkResult } from "./types";

/** Die Stimmungen, die ein Charakter im Gespräch haben kann. */
export const STIMMUNGEN = [
  "freundlich",
  "nervös",
  "genervt",
  "ausweichend",
  "panisch",
  "amüsiert",
] as const;

/**
 * Bringt die Antworten des Modells auf gültige Werte.
 *
 * Das Modell hält sich fast immer an die vorgegebenen Listen - aber eben nur
 * fast. Statt einen ganzen Spielzug an einem unerwarteten Wort scheitern zu
 * lassen, wird hier zugeordnet: bekannter Wert gewinnt, sonst der nächste
 * sinnvolle, sonst ein sicherer Standard.
 */

/** Findet die passende Id in einer Liste - auch bei Groß-/Kleinschreibung. */
export function passendeId(
  wert: string | null | undefined,
  gueltige: string[],
): string | null {
  if (!wert) return null;
  const sauber = wert.trim().toLowerCase();

  const treffer = gueltige.find((id) => id.toLowerCase() === sauber);
  if (treffer) return treffer;

  // Manchmal kommt der Name statt der Id ("Harry's Bar" statt "venedig-harry-s-bar").
  return gueltige.find((id) => id.toLowerCase().includes(sauber)) ?? null;
}

/** Wie passendeId, fällt aber auf einen Standardwert zurück. */
export const idOderStandard = (
  wert: string | null | undefined,
  gueltige: string[],
  standard: string,
): string => passendeId(wert, gueltige) ?? standard;

export function stimmungAus(wert: string): TalkResult["stimmung"] {
  const sauber = wert.trim().toLowerCase();
  const treffer = STIMMUNGEN.find((s) => s.toLowerCase() === sauber);
  if (treffer) return treffer;

  // Verwandte Wörter sinnvoll einsortieren, statt sie wegzuwerfen.
  const verwandt: Record<string, TalkResult["stimmung"]> = {
    misstrauisch: "ausweichend",
    unsicher: "nervös",
    ängstlich: "panisch",
    aufgeregt: "nervös",
    wütend: "genervt",
    beleidigt: "genervt",
    fröhlich: "freundlich",
    stolz: "amüsiert",
    spöttisch: "amüsiert",
    gelassen: "freundlich",
  };
  return verwandt[sauber] ?? "freundlich";
}
