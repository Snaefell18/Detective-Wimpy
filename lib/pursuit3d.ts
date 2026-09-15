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
};

export type DreiDTageszeit = "morgen" | "tag" | "abend" | "nacht";
export type DreiDWetter = "klar" | "sonne" | "regen" | "schnee" | "schneesturm" | "nebel";
export type DreiDStrassentyp = "asphalt" | "sand" | "schnee";

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
  { id: "nebel", name: "Nebel" },
];

export const DREI_D_STRASSENTYPEN: { id: DreiDStrassentyp; name: string }[] = [
  { id: "asphalt", name: "Asphalt" },
  { id: "sand", name: "Sand" },
  { id: "schnee", name: "Schneestraße · Arktis" },
];

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

/**
 * Die Tankstelle unter den gewählten Bausteinen - oder nichts.
 *
 * Gewählt schlägt erkannt: Steht im Kapitel ausdrücklich eine Tankstelle und
 * ist sie auch aufgebaut, gilt sie. Sonst entscheidet der Name, damit eine
 * frisch hinzugefügte Datei ohne weiteres Zutun funktioniert.
 */
export function tankstelleAus(
  ids: string[] | undefined,
  gewaehlt?: string,
): { id: string; name: string; datei: string } | null {
  const gebaut = locationsFuer3D(ids);
  if (gewaehlt) {
    const genau = gebaut.find((ort) => ort.id === gewaehlt);
    if (genau) return genau;
  }
  return gebaut.find((ort) => TANK_NAME.test(ort.id) || TANK_NAME.test(ort.name)) ?? null;
}

export const TOKYO_FASSADEN = DREI_D_LOCATIONS.map((ort) => ort.datei);
