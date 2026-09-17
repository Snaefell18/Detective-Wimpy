import type { Stadtplan } from "./stadtplan";
import { GENERIERTE_3D_LOCATIONS } from "./locations3d.generated";

/** Beim Build automatisch aus /public/3d_locations gelesen. */
export const DREI_D_LOCATIONS = GENERIERTE_3D_LOCATIONS;

export type DreiDLocationId = (typeof DREI_D_LOCATIONS)[number]["id"];

export type Kapitel3DVorgabe = {
  aktiv: boolean;
  /** IDs aus DREI_D_LOCATIONS; unbekannte alte IDs werden beim Laden ignoriert. */
  locations: string[];
  tageszeit: DreiDTageszeit;
  wetter: DreiDWetter;
  strassentyp: DreiDStrassentyp;
  /** Charakter-Id -> Modell-Id; leer bedeutet automatische Namenszuordnung. */
  charakterModelle: Record<string, string>;
  /** Größenfaktor pro Charakter: 1 entspricht der Standardgröße. */
  charakterGroessen: Record<string, number>;
  /** Zusätzliche Drehung je Straßenbaustein in Grad (0/90/180/270). */
  locationDrehungen: Record<string, number>;
  /**
   * Welcher Baustein die Tankstelle ist - dort steigt Wimpy in sein Auto.
   *
   * Leer heißt: Der Baustein wird am Namen erkannt (alles mit „Tank“ darin).
   * So genügt es, eine `tankstelle-web.glb` in den Ordner zu legen; wer
   * mehrere hat oder eine anders benannte nutzen will, wählt sie hier aus.
   */
  tankstelleId?: string;
  /**
   * Welcher Baustein die Polizeiwache ist - dort spricht Wimpy die
   * Beschuldigung aus.
   *
   * Leer heißt wie bei der Tankstelle: am Namen erkannt. Steht in der Stadt
   * keine Wache, bleibt die Beschuldigung dort, wo sie immer war - im Menü.
   */
  polizeiId?: string;
  /**
   * Ein selbst gelegter Stadtplan statt des gereihten Straßenzugs.
   *
   * Fehlt er oder hat er keine Straße, entsteht die Stadt wie bisher: Die
   * gewählten Bausteine werden hintereinandergehängt. Liegt hier ein Plan,
   * wird er Feld für Feld aufgebaut - mit Kreuzungen, Sackgassen und
   * Gebäuden, die so oft vorkommen dürfen, wie man mag.
   */
  plan?: Stadtplan | null;
};

export type DreiDTageszeit = "morgen" | "tag" | "abend" | "nacht";
export type DreiDWetter =
  | "klar"
  | "sonne"
  | "regen"
  | "schnee"
  | "schneesturm"
  | "blizzard"
  | "sandsturm"
  | "nebel";
export type DreiDStrassentyp = "asphalt" | "sand" | "schnee" | "gras";

export const DREI_D_TAGESZEITEN: { id: DreiDTageszeit; name: string }[] = [
  { id: "morgen", name: "Morgen" },
  { id: "tag", name: "Tag" },
  { id: "abend", name: "Abend" },
  { id: "nacht", name: "Nacht" },
];

export const DREI_D_WETTER: { id: DreiDWetter; name: string }[] = [
  { id: "klar", name: "Klar" },
  { id: "sonne", name: "Strahlender Sonnenschein" },
  { id: "regen", name: "Regen" },
  { id: "schnee", name: "Schneefall" },
  { id: "schneesturm", name: "Schneechaos / Schneesturm" },
  { id: "blizzard", name: "Blizzard · extremster Schneesturm" },
  { id: "sandsturm", name: "Sandsturm" },
  { id: "nebel", name: "Nebel" },
];

export const DREI_D_STRASSENTYPEN: { id: DreiDStrassentyp; name: string }[] = [
  { id: "asphalt", name: "Asphalt" },
  { id: "sand", name: "Sand" },
  { id: "schnee", name: "Schneestraße · Arktis" },
  { id: "gras", name: "Graspiste · Wiese und Wald" },
];

/**
 * Liegt bei dieser Lage Schnee in der Luft?
 *
 * Drei Lagen tun das: der leise Schneefall, der Sturm und der Blizzard. Sie
 * färben Himmel, Nebel und Licht gleich - nur eben verschieden heftig -, und
 * diese Frage wird an genug Stellen gestellt, dass sie einmal hier steht.
 */
export const istSchneeWetter = (wetter: DreiDWetter): boolean =>
  wetter === "schnee" || wetter === "schneesturm" || wetter === "blizzard";

/** Und nimmt sie die Sicht? Nebel, Sturm, Blizzard und Sandsturm tun das. */
export const istDunst = (wetter: DreiDWetter): boolean =>
  wetter === "nebel" ||
  wetter === "schneesturm" ||
  wetter === "blizzard" ||
  wetter === "sandsturm";

/**
 * Der Blizzard: die eine Lage, in der man die Hand vor Augen nicht sieht.
 *
 * Er ist kein stärkerer Schneesturm, sondern ein eigener Zustand - Sicht auf
 * wenige Meter, waagerechter Schnee, Böen, die für Augenblicke alles
 * schlucken. Wo im Code etwas nur für ihn gilt, steht diese Frage.
 */
export const istBlizzard = (wetter: DreiDWetter): boolean => wetter === "blizzard";

export const STANDARD_KAPITEL_3D: Kapitel3DVorgabe = {
  aktiv: false,
  locations: DREI_D_LOCATIONS.map((ort) => ort.id),
  tageszeit: "tag",
  wetter: "klar",
  strassentyp: "asphalt",
  charakterModelle: {},
  charakterGroessen: {},
  locationDrehungen: {},
  tankstelleId: "",
  polizeiId: "",
  plan: null,
};

export const locationsFuer3D = (ids: string[] | undefined) => {
  const reihenfolge = ids?.length ? ids : DREI_D_LOCATIONS.map((ort) => ort.id);
  const locations = reihenfolge.flatMap((id) => {
    const ort = DREI_D_LOCATIONS.find((eintrag) => eintrag.id === id);
    return ort ? [ort] : [];
  });
  return locations.length ? locations : [...DREI_D_LOCATIONS];
};

export const dateienFuer3D = (ids: string[] | undefined): string[] =>
  locationsFuer3D(ids).map((ort) => ort.datei);

/** Woran eine Tankstelle ohne ausdrückliche Wahl zu erkennen ist. */
const TANK_NAME = /tank|zapf|benzin|sprit|garage|werkstatt/i;
/** Und woran eine Polizeiwache. */
const POLIZEI_NAME = /polizei|police|revier|wache|kommissariat|koban/i;

export type DreiDBaustein = { id: string; name: string; datei: string };

/**
 * Ein besonderer Baustein unter den gewählten - oder nichts.
 *
 * Gewählt schlägt erkannt: Steht im Kapitel ausdrücklich einer und ist er
 * auch aufgebaut, gilt er. Sonst entscheidet der Name, damit eine frisch
 * hinzugefügte Datei ohne weiteres Zutun funktioniert.
 */
function bausteinAus(
  ids: string[] | undefined,
  gewaehlt: string | undefined,
  muster: RegExp,
): DreiDBaustein | null {
  const gebaut = locationsFuer3D(ids);
  if (gewaehlt) {
    const genau = gebaut.find((ort) => ort.id === gewaehlt);
    if (genau) return genau;
  }
  return gebaut.find((ort) => muster.test(ort.id) || muster.test(ort.name)) ?? null;
}

/** Die Tankstelle: Dort steigt Wimpy in sein Auto. */
export const tankstelleAus = (ids: string[] | undefined, gewaehlt?: string): DreiDBaustein | null =>
  bausteinAus(ids, gewaehlt, TANK_NAME);

/** Die Polizeiwache: Dort spricht er die Beschuldigung aus. */
export const polizeiAus = (ids: string[] | undefined, gewaehlt?: string): DreiDBaustein | null =>
  bausteinAus(ids, gewaehlt, POLIZEI_NAME);

export const TOKYO_FASSADEN = DREI_D_LOCATIONS.map((ort) => ort.datei);
