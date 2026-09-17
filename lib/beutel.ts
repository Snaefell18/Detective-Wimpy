import type { Zubehoer } from "./zubehoer";

/**
 * Was in Wimpys Beutel liegt - und was ein Geschenk daraus macht.
 *
 * Der Beutel selbst hängt am Browser (lib/useBeutel.ts): Er wird geladen,
 * gespeichert und gezeichnet. Die Rechnung dahinter hängt an gar nichts, und
 * deshalb steht sie hier - so lässt sie sich prüfen, ohne eine Seite zu
 * öffnen.
 */
export type Beutel = {
  /** Der Wagen, mit dem Wimpy gerade fährt. */
  autoId?: string;
  yen: number;
  /** Gekaufte und geschenkte Gegenstände: Id -> Anzahl. */
  vorrat: Record<string, number>;
  /** Wofür schon gezahlt oder was schon übergeben wurde: Fall- und Saga-Ids. */
  bezahlt: string[];
};

export const LEERER_BEUTEL: Beutel = { yen: 0, vorrat: {}, bezahlt: [] };

/**
 * Ein Geschenk in den Beutel legen - oder nichts.
 *
 * `was` ist die Buchungs-Id (etwa "geschenk:saga-7:2"): Dasselbe Geschenk gibt
 * es nie zweimal, auch wenn ein Kapitel erneut gespielt wird. `null` kommt
 * zurück, wenn nichts passiert - kein Stück, keine Id, oder schon übergeben.
 *
 * Autos sind dabei die Ausnahme, die es zu kennen gilt: Sie gehören nicht in
 * die Beweistasche, sondern in die Garage. Es gibt sie genau einmal, und
 * gefahren werden sie sofort - wie ein gekaufter Wagen auch. Wer lieber beim
 * alten bleibt, stellt das im Laden mit zwei Tippern wieder um.
 */
export function mitGeschenk(
  beutel: Beutel,
  was: string,
  stueck: Zubehoer | null | undefined,
): Beutel | null {
  if (!was || !stueck?.id) return null;
  if (beutel.bezahlt.includes(was)) return null;

  const istAuto = stueck.wirkung === "auto";
  return {
    ...beutel,
    bezahlt: [...beutel.bezahlt, was],
    vorrat: {
      ...beutel.vorrat,
      [stueck.id]: istAuto ? 1 : (beutel.vorrat[stueck.id] ?? 0) + 1,
    },
    ...(istAuto ? { autoId: stueck.id } : {}),
  };
}

/** Ein geschenktes Auto steht in der Garage, alles andere in der Tasche. */
export const istAutoGeschenk = (stueck: Zubehoer | null | undefined): boolean =>
  stueck?.wirkung === "auto";
