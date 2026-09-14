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
  /** Zusätzliche Drehung je Straßenbaustein in Grad (0/90/180/270). */
  locationDrehungen: Record<string, number>;
};

export type DreiDTageszeit = "morgen" | "tag" | "abend" | "nacht";
export type DreiDWetter = "klar" | "sonne" | "regen";
export type DreiDStrassentyp = "asphalt" | "sand";

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
];

export const DREI_D_STRASSENTYPEN: { id: DreiDStrassentyp; name: string }[] = [
  { id: "asphalt", name: "Asphalt" },
  { id: "sand", name: "Sand" },
];

export const STANDARD_KAPITEL_3D: Kapitel3DVorgabe = {
  aktiv: false,
  locations: DREI_D_LOCATIONS.map((ort) => ort.id),
  tageszeit: "tag",
  wetter: "klar",
  strassentyp: "asphalt",
  charakterModelle: {},
  locationDrehungen: {},
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

export const TOKYO_FASSADEN = DREI_D_LOCATIONS.map((ort) => ort.datei);
