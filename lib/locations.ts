import type { Location } from "./types";

/**
 * Orte des Spiels. Die Bilder liegen in /public/orte und heißen wie die Id.
 * Neue Orte einfach hier ergänzen und ein PNG mit passendem Namen ablegen.
 */
export const LOCATIONS: Location[] = [
  {
    id: "marktplatz",
    name: "Marktplatz",
    beschreibung:
      "Das Herz der Stadt. Stände mit Früchten, viel Gerede, noch mehr Gerüchte.",
    bild: "/orte/marktplatz.png",
  },
  {
    id: "baumhaus",
    name: "Baumhaus",
    beschreibung:
      "Wimpys Zuhause hoch in der Krone. Von hier oben sieht man fast alles.",
    bild: "/orte/baumhaus.png",
  },
  {
    id: "cafe",
    name: "Café Mondlicht",
    beschreibung:
      "Warmes Licht, klebrige Tische und der beste Ort, um Gespräche zu belauschen.",
    bild: "/orte/cafe.png",
  },
  {
    id: "park",
    name: "Nachtpark",
    beschreibung:
      "Dunkle Wege, raschelnde Büsche. Nachts hört man hier jeden Schritt.",
    bild: "/orte/park.png",
  },
  {
    id: "turnhalle",
    name: "Turnhalle",
    beschreibung:
      "Schweiß, Matten und Mikkelis Trainingspläne an der Wand.",
    bild: "/orte/turnhalle.png",
  },
  {
    id: "hafen",
    name: "Alter Hafen",
    beschreibung:
      "Kisten, Möwen und Schatten zwischen den Booten. Hier verschwindet gern mal etwas.",
    bild: "/orte/hafen.png",
  },
];

export const LOCATION_BY_ID = new Map(LOCATIONS.map((ort) => [ort.id, ort]));

export const getLocation = (id: string): Location | undefined =>
  LOCATION_BY_ID.get(id);

export const DEFAULT_LOCATION_ID = LOCATIONS[0].id;
