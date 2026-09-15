import { ANIMATIONS_MODELLE, type AnimationsModell } from "./animations.generated";
import type { Character } from "./types";

/**
 * Welches 3D-Modell ein Tier bekommt.
 *
 * Die Reihenfolge ist die ganze Regel - und sie steht bewusst hier und nicht
 * in der Szene, damit man sie prüfen kann, ohne eine Grafikkarte zu starten:
 *
 * 1. Was dieses Kapitel ausdrücklich zuordnet. Wer einmal etwas anderes
 *    braucht, soll es sagen dürfen.
 * 2. Was in den Stammdaten beim Tier steht. Das ist der Normalfall: einmal
 *    zugeordnet, tritt das Tier überall so auf.
 * 3. Ein Modell, dessen Name zu Id, Name oder Tierart passt - so wie es
 *    war, bevor es die Zuordnung gab.
 * 4. Irgendeines der Reihe nach, damit niemand unsichtbar bleibt.
 */
const normal = (wert: string) => wert.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

export function modellFuerTier(
  charakter: Character,
  index: number,
  kapitelModellId?: string,
): AnimationsModell | undefined {
  const schluessel = [charakter.id, charakter.name, charakter.tierart].map(normal);
  return (
    ANIMATIONS_MODELLE.find((modell) => modell.id === kapitelModellId) ??
    ANIMATIONS_MODELLE.find((modell) => modell.id === charakter.modell3d) ??
    ANIMATIONS_MODELLE.find((modell) =>
      schluessel.some((wert) => wert && (normal(modell.id).includes(wert) || wert.includes(normal(modell.id)))),
    ) ??
    ANIMATIONS_MODELLE.filter((modell) => modell.id !== "wimpy")[
      index % Math.max(1, ANIMATIONS_MODELLE.length - 1)
    ]
  );
}

/**
 * Die Spielfigur.
 *
 * Auch Wimpy ist ein Tier in den Stammdaten: Ist ihm dort ein Modell
 * zugeordnet, läuft er damit durch die Stadt. Sonst bleibt es beim Modell,
 * das seinen Namen trägt.
 */
export function spielerModell(detektiv?: Character): AnimationsModell | undefined {
  return (
    ANIMATIONS_MODELLE.find((modell) => modell.id === detektiv?.modell3d) ??
    ANIMATIONS_MODELLE.find((modell) => modell.id === "wimpy") ??
    ANIMATIONS_MODELLE[0]
  );
}
