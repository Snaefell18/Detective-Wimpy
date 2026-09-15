import { FELD_GROESSE, gebaeudeFelder, strassenFelder, type Stadtplan } from "./stadtplan";

/**
 * Was sich ein Gerät zumuten lässt.
 *
 * Ein einzelner Stadtbaustein hat um die 180.000 Dreiecke und bringt drei
 * Texturen mit. Solange eine Straße aus vier Häusern besteht, merkt das
 * niemand. Eine selbst gelegte Stadt aus vierzig Häusern dagegen hält ein
 * MacBook noch aus - ein iPhone stürzt ab: erst ruckelt es, dann ist der Tab
 * weg. Schuld ist selten die Rechenleistung, sondern der Speicher, den
 * entpackte Texturen fressen.
 *
 * Deshalb entscheidet diese Stelle, was in der Szene erlaubt ist. Sie kennt
 * zwei Fragen: Wie groß ist die Stadt, und wie viel Luft hat das Gerät? Alles
 * Weitere - Sichtweite, Schatten, Auflösung, Texturgröße - folgt daraus.
 */

export type LeistungsProfil = {
  /** Ab welcher Entfernung zur Kamera ein Häuserblock nicht mehr gezeichnet wird. */
  sichtweite: number;
  /** Schatten kosten einen zweiten Durchgang durch die ganze Stadt. */
  schatten: boolean;
  /** Kantenglättung ist auf einem dreifach aufgelösten Handybild Luxus. */
  kantenglaettung: boolean;
  /** Obergrenze für die Auflösung - ein Handy rechnet sonst dreifach. */
  pixelGrenze: number;
  /** Texturen größer als das werden beim Laden verkleinert. */
  texturGrenze: number;
  /** Nur fürs Admin-Menü: Was gerade dafür sorgt, dass gespart wird. */
  grund: "klein" | "groß" | "handy";
};

/** Ein Handy erkennt man am ehesten daran, dass man es anfassen kann. */
export function istHandy(): boolean {
  if (typeof window === "undefined") return false;
  const grob = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const schmal = Math.min(window.innerWidth, window.innerHeight) <= 820;
  return grob && schmal;
}

/**
 * Wie viele Häuser gleichzeitig zu sehen sind, ist das, was zählt - nicht wie
 * viele die Stadt hat. Ein halbes Dutzend Blöcke in Sichtweite schafft jedes
 * Gerät, vierzig keines.
 */
export function leistungsProfil(plan: Stadtplan | null | undefined, handy = istHandy()): LeistungsProfil {
  const haeuser = plan ? gebaeudeFelder(plan).length : 0;
  const strassen = plan ? strassenFelder(plan).length : 0;
  const gross = haeuser + strassen > 60 || haeuser > 24;

  if (handy) {
    return {
      // Gemessen ab Kamera, und die steht schon rund zehn Meter hinter Wimpy.
      // Vier Felder sind also die Gasse, in der er steht, plus die nächste
      // Kreuzung und ein Stück dahinter. Weiter trägt der Nebel ohnehin nicht.
      sichtweite: FELD_GROESSE * (gross ? 4.2 : 6),
      /*
       * Schatten und Kantenglättung fallen nur in der gelegten Stadt weg -
       * das ist die Bauweise, die auf dem iPhone abgestürzt ist. Der
       * Straßenzug von früher lief dort immer schon, und der soll aussehen
       * wie bisher.
       */
      schatten: !plan,
      kantenglaettung: !plan,
      pixelGrenze: plan && gross ? 1.25 : 1.5,
      texturGrenze: plan && gross ? 512 : 768,
      grund: "handy",
    };
  }
  if (gross) {
    return {
      sichtweite: FELD_GROESSE * 8,
      schatten: true,
      kantenglaettung: true,
      pixelGrenze: 1.65,
      texturGrenze: 1024,
      grund: "groß",
    };
  }
  return {
    sichtweite: FELD_GROESSE * 10,
    schatten: true,
    kantenglaettung: true,
    pixelGrenze: 1.65,
    texturGrenze: 2048,
    grund: "klein",
  };
}

/**
 * Und wenn das Profil immer noch zu viel verlangt?
 *
 * Kein Vorabwissen über Geräte hilft gegen das eine Handy, das schwächer ist
 * als gedacht, oder gegen die eine Stadt, in der ausnahmsweise acht Türme
 * gleichzeitig im Bild stehen. Also misst die Szene einfach mit, wie lange
 * ihre Bilder brauchen, und nimmt sich zurück, wenn es klemmt - und gibt
 * wieder frei, sobald es länger flüssig läuft.
 *
 * Die Regelung ist träge, und sie hat einen Boden: Sie darf die Sicht
 * halbieren, nicht mehr. Lieber ein knapperes Bild als ein Absturz, aber
 * nichts, was vor den Augen springt.
 */
export type Regelung = {
  /** Womit die Sichtweite multipliziert wird: 1 = volles Profil. */
  faktor: number;
  /** Wie lange es am Stück flüssig lief (Sekunden). */
  gut: number;
  /** Wie lange es am Stück geruckelt hat (Sekunden). */
  schlecht: number;
};

export const REGEL_START: Regelung = { faktor: 1, gut: 0, schlecht: 0 };

/** Unter das hier geht die Sichtweite nie - sonst steht man im Nichts. */
export const REGEL_BODEN = 0.55;
const RUCKELT = 1 / 26;
const FLUESSIG = 1 / 50;

export function nachregeln(stand: Regelung, dt: number): Regelung {
  if (dt > RUCKELT) {
    const schlecht = stand.schlecht + dt;
    if (schlecht > 1.5 && stand.faktor > REGEL_BODEN) {
      return { faktor: Math.max(REGEL_BODEN, Math.round((stand.faktor - 0.15) * 100) / 100), gut: 0, schlecht: 0 };
    }
    return { ...stand, gut: 0, schlecht };
  }
  if (dt < FLUESSIG) {
    const gut = stand.gut + dt;
    if (gut > 6 && stand.faktor < 1) {
      return { faktor: Math.min(1, Math.round((stand.faktor + 0.1) * 100) / 100), gut: 0, schlecht: 0 };
    }
    return { ...stand, gut, schlecht: 0 };
  }
  // Dazwischen: alles halb so wild, die Zähler laufen langsam zurück.
  return { ...stand, gut: Math.max(0, stand.gut - dt), schlecht: Math.max(0, stand.schlecht - dt) };
}

/**
 * Wie viele verschiedene Bausteine eine Stadt verträgt.
 *
 * Wiederholung ist umsonst: Dasselbe Haus zehnmal zu setzen kostet keinen
 * Speicher dazu, weil alle Kopien sich dieselbe Geometrie und dieselben
 * Texturen teilen. Jede neue Bauart dagegen bringt ihre eigenen mit - und
 * genau das ist es, was den Speicher füllt und den Tab abstürzen lässt.
 */
export const ARTEN_EMPFEHLUNG = 4;

export const artenWarnung = (arten: number): string =>
  arten > ARTEN_EMPFEHLUNG
    ? `${arten} verschiedene Bauarten. Jede bringt eigene Texturen mit; auf dem Handy sind ${ARTEN_EMPFEHLUNG} sicher. Dasselbe Haus mehrfach zu setzen kostet dagegen nichts.`
    : "";
