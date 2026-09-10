import {
  daemonWahrscheinlichkeit,
  mittaeterWahrscheinlichkeit,
  type Character,
  type Haeufigkeit,
} from "./types";

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
  wie: Haeufigkeit | undefined,
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

/**
 * Hat noch jemand mitgemacht?
 *
 * Zwei Täter, dieselbe Tat: Sie waren zusammen dort, haben es zusammen getan
 * und decken sich seitdem gegenseitig. Wer einen von beiden beschuldigt, hat
 * den Fall gelöst - die Auflösung nennt ohnehin beide.
 *
 * Gewürfelt wird wie bei der Verwandlung: einmal je Fall, auf dem Server.
 * Wer den Zweiten in den Saga-Vorgaben ausdrücklich benannt hat, geht hier
 * gar nicht erst vorbei.
 */
export function waehleMittaeter(
  verdaechtige: Character[],
  wie: Haeufigkeit | undefined,
  taeterId: string,
  wuerfel: () => number = Math.random,
): Character | null {
  const chance = mittaeterWahrscheinlichkeit(wie);
  if (chance <= 0 || !taeterId) return null;
  if (wuerfel() >= chance) return null;

  /*
   * Drei Verdächtige sind das Mindeste: Wären es zwei, wären beide schuldig
   * und es gäbe nichts mehr zu kombinieren.
   */
  const andere = verdaechtige.filter(
    (c) => !c.istDetektiv && !c.istDaemon && c.id !== taeterId,
  );
  if (andere.length < 2) return null;

  const index = Math.min(andere.length - 1, Math.floor(wuerfel() * andere.length));
  return andere[index];
}
