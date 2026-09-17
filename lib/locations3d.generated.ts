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
    "id": "kabukicho",
    "name": "Kabukicho",
    "datei": "/3d_locations/kabukicho-web.glb"
  },
  {
    "id": "kikanbooffen",
    "name": "Kikanbooffen",
    "datei": "/3d_locations/kikanbooffen-web.glb"
  },
  {
    "id": "longyearbyen-brauerei",
    "name": "Longyearbyen Brauerei",
    "datei": "/3d_locations/longyearbyen brauerei-web.glb"
  },
  {
    "id": "longyearbyenbuildings1",
    "name": "Longyearbyenbuildings1",
    "datei": "/3d_locations/longyearbyenbuildings1-web.glb"
  },
  {
    "id": "longyearbyenbuildings2",
    "name": "Longyearbyenbuildings2",
    "datei": "/3d_locations/longyearbyenbuildings2-web.glb"
  },
  {
    "id": "longyearbyenbuildingsreihe",
    "name": "Longyearbyenbuildingsreihe",
    "datei": "/3d_locations/longyearbyenbuildingsreihe-web.glb"
  },
  {
    "id": "longyearbyenkirche",
    "name": "Longyearbyenkirche",
    "datei": "/3d_locations/longyearbyenkirche-web.glb"
  },
  {
    "id": "marokko-bazaar",
    "name": "Marokko Bazaar",
    "datei": "/3d_locations/marokko bazaar-web.glb"
  },
  {
    "id": "marokko-buildings-1",
    "name": "Marokko Buildings 1",
    "datei": "/3d_locations/marokko buildings 1-web.glb"
  },
  {
    "id": "marokko-moschee",
    "name": "Marokko Moschee",
    "datei": "/3d_locations/marokko moschee-web.glb"
  },
  {
    "id": "marokko-surfshop",
    "name": "Marokko Surfshop",
    "datei": "/3d_locations/marokko surfshop-web.glb"
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
    "id": "tankstelle-longyearbyen",
    "name": "Tankstelle Longyearbyen",
    "datei": "/3d_locations/tankstelle longyearbyen-web.glb"
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
    "id": "tokyopolizei",
    "name": "Tokyopolizei",
    "datei": "/3d_locations/tokyopolizei-web.glb"
  },
  {
    "id": "waterfront",
    "name": "Waterfront",
    "datei": "/3d_locations/waterfront-web.glb"
  }
] as const;

export const GENERIERTE_3D_LOCATION_IDS = GENERIERTE_3D_LOCATIONS.map((ort) => ort.id);
