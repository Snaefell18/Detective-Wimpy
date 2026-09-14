/** Die derzeit fürs 3D-Stadtset vorbereiteten, web-optimierten Bausteine. */
export const DREI_D_LOCATIONS = [
  { id: "tokyo1", name: "Tokyo Häuserzeile", datei: "/3d_locations/tokyo1-web.glb" },
  { id: "akihabara", name: "Akihabara", datei: "/3d_locations/akihabara-web.glb" },
  { id: "residential", name: "Wohnviertel", datei: "/3d_locations/residential-web.glb" },
] as const;

export type DreiDLocationId = (typeof DREI_D_LOCATIONS)[number]["id"];

export type Kapitel3DVorgabe = {
  aktiv: boolean;
  /** IDs aus DREI_D_LOCATIONS; unbekannte alte IDs werden beim Laden ignoriert. */
  locations: string[];
};

export const STANDARD_KAPITEL_3D: Kapitel3DVorgabe = {
  aktiv: false,
  locations: DREI_D_LOCATIONS.map((ort) => ort.id),
};

export const dateienFuer3D = (ids: string[] | undefined): string[] => {
  const gewaehlt = new Set(ids?.length ? ids : DREI_D_LOCATIONS.map((ort) => ort.id));
  const dateien = DREI_D_LOCATIONS.filter((ort) => gewaehlt.has(ort.id)).map((ort) => ort.datei);
  return dateien.length ? dateien : DREI_D_LOCATIONS.map((ort) => ort.datei);
};

export const TOKYO_FASSADEN = DREI_D_LOCATIONS.map((ort) => ort.datei);
