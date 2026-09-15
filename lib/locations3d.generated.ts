/** Automatisch aus /public/3d_locations erzeugt. */
export const GENERIERTE_3D_LOCATIONS = [
  {
    "id": "akihabara",
    "name": "Akihabara",
    "datei": "/3d_locations/akihabara-web.glb"
  },
  {
    "id": "boulderbeach",
    "name": "Boulderbeach",
    "datei": "/3d_locations/boulderbeach-web.glb"
  },
  {
    "id": "donki2",
    "name": "Donki2",
    "datei": "/3d_locations/donki2-web.glb"
  },
  {
    "id": "residential",
    "name": "Residential",
    "datei": "/3d_locations/residential-web.glb"
  },
  {
    "id": "stellenbosch",
    "name": "Stellenbosch",
    "datei": "/3d_locations/stellenbosch-web.glb"
  },
  {
    "id": "tankstelle",
    "name": "Tankstelle",
    "datei": "/3d_locations/tankstelle-web.glb"
  },
  {
    "id": "tokyo1",
    "name": "Tokyo1",
    "datei": "/3d_locations/tokyo1-web.glb"
  },
  {
    "id": "tokyocanal",
    "name": "Tokyocanal",
    "datei": "/3d_locations/tokyocanal-web.glb"
  },
  {
    "id": "waterfront",
    "name": "Waterfront",
    "datei": "/3d_locations/waterfront-web.glb"
  }
] as const;

export const GENERIERTE_3D_LOCATION_IDS = GENERIERTE_3D_LOCATIONS.map((ort) => ort.id);
