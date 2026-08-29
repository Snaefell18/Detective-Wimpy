import { CHARACTERS } from "./characters.generated";
import type { Character } from "./types";

export { CHARACTERS };

export const CHARACTER_BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export const getCharacter = (id: string): Character | undefined =>
  CHARACTER_BY_ID.get(id);

/** Wimpy selbst - die Spielfigur. */
export const DETECTIVE: Character =
  CHARACTERS.find((c) => c.istDetektiv) ?? CHARACTERS[0];

/** Alle spielbaren Verdächtigen (alle außer dem Detektiv). */
export const SUSPECTS: Character[] = CHARACTERS.filter((c) => !c.istDetektiv);

/**
 * Beschreibt die Werte eines Charakters in Worten - damit Claude sie
 * beim Rollenspiel wirklich benutzt, statt nur Zahlen zu sehen.
 */
export function describeStats(character: Character): string {
  const { stats } = character;
  const level = (wert: number) =>
    wert >= 9 ? "sehr hoch" : wert >= 7 ? "hoch" : wert >= 4 ? "mittel" : "niedrig";

  return [
    `Charisma ${stats.charisma}/10 (${level(stats.charisma)})`,
    `Freundlichkeit ${stats.freundlichkeit}/10 (${level(stats.freundlichkeit)})`,
    `Fitness ${stats.fitness}/10 (${level(stats.fitness)})`,
    `Zauberkraft ${stats.zauberkraft}/10 (${level(stats.zauberkraft)})`,
    `Schelmischkeit ${stats.schelmischkeit}/10 (${level(stats.schelmischkeit)})`,
    `Kriminalitätslevel ${stats.kriminalitaetslevel}/10 (${level(stats.kriminalitaetslevel)})`,
    `Intelligenz ${stats.intelligenz}/10 (${level(stats.intelligenz)})`,
  ].join(", ");
}

/** Kompakter Steckbrief für den Prompt. */
export function characterBrief(character: Character): string {
  return `${character.name} (${character.tierart}, ${character.alter} Jahre) - ${character.beschreibung} Werte: ${describeStats(character)}.`;
}
