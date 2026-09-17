import { ANIMATIONS_MODELLE } from "./animations.generated";
import { START_AUTO_ID } from "./autos";
import { DREI_D_LOCATIONS, type DreiDStrassentyp, type DreiDTageszeit, type DreiDWetter } from "./pursuit3d";
import { STRASSENTYPEN, TAGESZEITEN, WETTERLAGEN } from "./staedte";
import type { JagdWelt } from "./verfolgung";

/**
 * Der Abspann - was ganz am Ende läuft.
 *
 * Eine Saga endet bisher mit dem Epilog: Der Erzähler sagt, wie es ausging,
 * man tippt auf „Zum Hauptmenü", und das war's. Das ist ein Schluss, aber kein
 * Ende - ein Ende hat Musik, und es hat ein Bild, bei dem man sitzen bleibt.
 *
 * Deshalb gibt es hier Abspänne, und zwar in Arten. Angelegt werden sie im
 * Saga-Editor und genauso in einem Arc; beide benutzen dasselbe Feld.
 *
 *   "keiner"        - wie bisher: nach dem Epilog ist Schluss.
 *   "strassenfahrt" - zwei Tiere steigen in einen Wagen und fahren die Straße
 *                     entlang, solange der Song läuft. Am Straßenrand stehen
 *                     die Häuser der Verfolgungsjagd. Ist der Song zu Ende,
 *                     blendet das Bild auf Schwarz, und man darf die Saga
 *                     beenden.
 *   "rolle"         - der klassische Abspann: Text, der zur Musik hochläuft.
 *                     Den gab es im Arc schon; hier steht er neben der Fahrt.
 */
export type AbspannArt = "keiner" | "strassenfahrt" | "rolle";

export const ABSPANN_ARTEN: { id: AbspannArt; label: string; hinweis: string }[] = [
  { id: "keiner", label: "Kein Abspann", hinweis: "Nach dem Epilog ist Schluss - wie bisher." },
  {
    id: "strassenfahrt",
    label: "Straßenfahrt",
    hinweis: "Zwei Tiere steigen ein und fahren durch die Stadt, solange der Song läuft.",
  },
  { id: "rolle", label: "Abspannrolle", hinweis: "Text, der zur Musik hochläuft." },
];

/** Wie viele Tiere in den Wagen steigen. Zwei - Fahrer und Beifahrer. */
export const ABSPANN_TIERE = 2;

export type AbspannVorgabe = {
  art: AbspannArt;
  /**
   * Der Song - ein Pfad in /public/audio oder eine Aufnahme aus der
   * Datenbank. Er bestimmt die Länge: Der Abspann endet mit dem letzten Ton.
   */
  song: string;
  /** Die beiden Tiere im Wagen - Modell-Ids aus /public/animations. */
  modelle: string[];
  /** Der Wagen - eine Id aus dem Autokatalog. */
  autoId: string;
  /** Die Strecke - dieselben Begriffe wie bei der Verfolgungsjagd. */
  strassentyp?: DreiDStrassentyp;
  tageszeit?: DreiDTageszeit;
  wetter?: DreiDWetter;
  /** Bis zu drei Bausteine am Straßenrand. */
  locations?: string[];
  /** Nur bei der Rolle: der Text, der hochläuft. */
  text: string;
};

export const STANDARD_ABSPANN: AbspannVorgabe = {
  art: "keiner",
  song: "",
  modelle: ["", ""],
  autoId: "",
  strassentyp: "asphalt",
  tageszeit: "abend",
  wetter: "klar",
  locations: [],
  text: "",
};

/** Ein frischer Abspann einer Art - mit allem, was er braucht, vorbelegt. */
export function neuerAbspann(art: AbspannArt): AbspannVorgabe {
  return {
    ...STANDARD_ABSPANN,
    art,
    modelle: standardModelle(),
    autoId: START_AUTO_ID,
  };
}

/**
 * Zwei Modelle, die nicht dasselbe sind.
 *
 * Wimpy fährt, und neben ihm sitzt irgendwer - Hauptsache, es sind zwei
 * verschiedene. Umgestellt wird das im Editor mit zwei Auswahlfeldern.
 */
function standardModelle(): string[] {
  const wimpy = ANIMATIONS_MODELLE.find((modell) => modell.id === "wimpy") ?? ANIMATIONS_MODELLE[0];
  const zweiter =
    ANIMATIONS_MODELLE.find((modell) => modell.id !== wimpy?.id) ?? ANIMATIONS_MODELLE[0];
  return [wimpy?.id ?? "", zweiter?.id ?? ""];
}

/**
 * Läuft dieser Abspann überhaupt?
 *
 * Ohne Song nicht: Er ist die Uhr des Abspanns, und ohne Uhr wüsste niemand,
 * wann das Bild auf Schwarz geht. Die Rolle braucht zusätzlich Text - eine
 * leere Rolle ist eine Minute schwarzes Bild.
 */
export function abspannSpielbar(vorgabe: AbspannVorgabe | null | undefined): boolean {
  if (!vorgabe || vorgabe.art === "keiner") return false;
  if (!vorgabe.song.trim()) return false;
  if (vorgabe.art === "rolle") return Boolean(vorgabe.text.trim());
  return true;
}

/** Der Abspann einer Saga oder eines Arcs - aufgefüllt und nur, wenn er läuft. */
export function abspannVon(
  vorgabe: AbspannVorgabe | null | undefined,
): AbspannVorgabe | null {
  if (!abspannSpielbar(vorgabe)) return null;
  return { ...STANDARD_ABSPANN, ...vorgabe };
}

/**
 * Die Strecke des Abspanns - mit allem, was fehlt, aufgefüllt.
 *
 * Dieselbe Rechnung wie bei der Jagd (lib/verfolgung.ts), nur mit einem
 * anderen Ausgangspunkt: Eine Abschiedsfahrt läuft nicht durch die Nacht,
 * sondern in den Abend hinein.
 */
export function abspannWelt(vorgabe: AbspannVorgabe | null | undefined): JagdWelt {
  const erlaubt = <T extends string>(wert: unknown, liste: readonly T[], standard: T): T =>
    liste.includes(wert as T) ? (wert as T) : standard;
  return {
    strassentyp: erlaubt(vorgabe?.strassentyp, STRASSENTYPEN, "asphalt"),
    tageszeit: erlaubt(vorgabe?.tageszeit, TAGESZEITEN, "abend"),
    wetter: erlaubt(vorgabe?.wetter, WETTERLAGEN, "klar"),
    locations: (vorgabe?.locations ?? []).filter((id) =>
      DREI_D_LOCATIONS.some((ort) => ort.id === id),
    ),
  };
}

/** Die beiden Modelle, die wirklich einsteigen - ohne Lücken und ohne Unsinn. */
export function abspannModelle(vorgabe: AbspannVorgabe | null | undefined): string[] {
  const gewaehlt = (vorgabe?.modelle ?? []).filter((id) =>
    ANIMATIONS_MODELLE.some((modell) => modell.id === id),
  );
  const auffuellen = [...gewaehlt, ...standardModelle()];
  return auffuellen.slice(0, ABSPANN_TIERE);
}

/** Eine Zeile für den Editor: Was passiert hier eigentlich? */
export function abspannZeile(vorgabe: AbspannVorgabe | null | undefined): string {
  if (!vorgabe || vorgabe.art === "keiner") return "Kein Abspann - nach dem Epilog ist Schluss.";
  if (!vorgabe.song.trim()) return "Ohne Song läuft kein Abspann - er ist seine Uhr.";
  if (vorgabe.art === "rolle") {
    return vorgabe.text.trim()
      ? "Die Abspannrolle läuft genau so lange wie der Song."
      : "Eine Rolle ohne Text bleibt schwarz - bitte etwas eintragen.";
  }
  const welt = abspannWelt(vorgabe);
  const haeuser = welt.locations.length
    ? `${welt.locations.length} Bausteine am Straßenrand`
    : "die gerechnete Landschaft";
  return `Zwei Tiere, ein Wagen, ${haeuser} - so lange, wie der Song dauert.`;
}
