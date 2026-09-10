import { daemonWahrscheinlichkeit, type Character, type DaemonHaeufigkeit } from "./types";

/**
 * Entpuppt sich der Täter dieses Falls als etwas ganz anderes?
 *
 * Gewürfelt wird einmal je Fall und ausschließlich auf dem Server: Das
 * Ergebnis wandert ins Siegel, damit im Browser bis zur Beschuldigung nichts
 * darauf hindeutet - nicht einmal, dass es so etwas gibt.
 *
 * Zwei Dinge müssen zusammenkommen: eine Einstellung, die es zulässt, und
 * mindestens ein Tier, das als Dämonenform markiert ist. Fehlt eins davon,
 * passiert nichts. Das ist kein Fehler, sondern der Normalfall - wer keine
 * Gestalten angelegt hat, soll auch keine treffen.
 */
export function waehleDaemonform(
  charaktere: Character[],
  wie: DaemonHaeufigkeit | undefined,
  /** Der Täter - er ist der Wirt, und er selbst kommt nie als Gestalt infrage. */
  taeterId: string,
  /** Von außen, damit sich das prüfen lässt. */
  wuerfel: () => number = Math.random,
): Character | null {
  const chance = daemonWahrscheinlichkeit(wie);
  if (chance <= 0 || !taeterId) return null;
  if (wuerfel() >= chance) return null;

  const formen = charaktere.filter(
    (c) => c.istDaemon && !c.istDetektiv && c.id !== taeterId,
  );
  if (!formen.length) return null;

  const index = Math.min(formen.length - 1, Math.floor(wuerfel() * formen.length));
  return formen[index];
}
