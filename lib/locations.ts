import { alsStaedte } from "./csv";
import { LOCATIONS } from "./locations.generated";
import type { City, Location } from "./types";

export { LOCATIONS };

/** Alle Städte mit ihren Schauplätzen (aus data/locations.csv). */
export const CITIES: City[] = alsStaedte(LOCATIONS);

export const getCity = (id: string): City | undefined =>
  CITIES.find((stadt) => stadt.id === id);

/** Nur Städte, in denen genug Schauplätze für einen Fall liegen. */
export function spielbareStaedte(orte: Location[], anzahl: number): City[] {
  return alsStaedte(orte).filter((stadt) => stadt.orte.length >= anzahl);
}

/**
 * Wählt die Schauplätze eines Falls: eine Stadt, daraus `anzahl` Orte.
 * Hat die Stadt mehr Orte als nötig, wird zufällig gemischt - so fühlt sich
 * auch die gleiche Stadt beim nächsten Fall anders an.
 */
export function waehleSchauplaetze(
  orte: Location[],
  anzahl: number,
  stadtId?: string,
): { stadt: City; orte: Location[] } | null {
  const kandidaten = spielbareStaedte(orte, anzahl);
  if (kandidaten.length === 0) return null;

  const stadt =
    kandidaten.find((s) => s.id === stadtId) ??
    kandidaten[Math.floor(Math.random() * kandidaten.length)];

  const gemischt = [...stadt.orte];
  for (let i = gemischt.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gemischt[i], gemischt[j]] = [gemischt[j], gemischt[i]];
  }

  return { stadt, orte: gemischt.slice(0, anzahl) };
}

/** Sucht einen Ort in der Liste eines laufenden Falls. */
export const findeOrt = (orte: Location[], id: string): Location | undefined =>
  orte.find((ort) => ort.id === id);
