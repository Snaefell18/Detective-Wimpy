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
  /** Charakter-Id -> Modell-Id; leer bedeutet automatische Namenszuordnung. */
  charakterModelle: Record<string, string>;
};

export type DreiDTageszeit = "morgen" | "tag" | "abend" | "nacht";
export type DreiDWetter = "klar" | "sonne" | "regen";

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

export const STANDARD_KAPITEL_3D: Kapitel3DVorgabe = {
  aktiv: false,
  locations: DREI_D_LOCATIONS.map((ort) => ort.id),
  tageszeit: "tag",
  wetter: "klar",
  charakterModelle: {},
};

export const dateienFuer3D = (ids: string[] | undefined): string[] => {
  const reihenfolge = ids?.length ? ids : DREI_D_LOCATIONS.map((ort) => ort.id);
  const dateien = reihenfolge.flatMap((id) => {
    const ort = DREI_D_LOCATIONS.find((eintrag) => eintrag.id === id);
    return ort ? [ort.datei] : [];
  });
  return dateien.length ? dateien : DREI_D_LOCATIONS.map((ort) => ort.datei);
};

export const TOKYO_FASSADEN = DREI_D_LOCATIONS.map((ort) => ort.datei);
