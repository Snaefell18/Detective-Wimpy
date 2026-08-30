import type { Item } from "./types";

/**
 * Gegenstände/Spuren. Die Bilder liegen in /public/items und heißen wie die Id.
 * Neue Gegenstände einfach hier ergänzen und ein PNG mit passendem Namen ablegen.
 */
export const ITEMS: Item[] = [
  {
    id: "lupe",
    name: "Lupe",
    beschreibung: "Wimpys Lieblingswerkzeug. Ohne sie geht er nirgendwo hin.",
    bild: "/items/lupe.png",
  },
  {
    id: "fussabdruck",
    name: "Fußabdruck",
    beschreibung: "Ein Abdruck im weichen Boden. Größe und Form verraten viel.",
    bild: "/items/fussabdruck.png",
  },
  {
    id: "haarbueschel",
    name: "Haarbüschel",
    beschreibung: "Ein paar Haare, hängen geblieben an einer rauen Kante.",
    bild: "/items/haarbueschel.png",
  },
  {
    id: "zettel",
    name: "Zerknüllter Zettel",
    beschreibung: "Eine halb lesbare Nachricht, hastig geschrieben.",
    bild: "/items/zettel.png",
  },
  {
    id: "schluessel",
    name: "Schlüssel",
    beschreibung: "Ein kleiner Messingschlüssel ohne Anhänger.",
    bild: "/items/schluessel.png",
  },
  {
    id: "kekskrumel",
    name: "Kekskrümel",
    beschreibung: "Krümel einer ganz bestimmten Sorte. Nicht jeder mag die.",
    bild: "/items/kekskrumel.png",
  },
  {
    id: "schal",
    name: "Verlorener Schal",
    beschreibung: "Riecht noch schwach nach seinem Besitzer.",
    bild: "/items/schal.png",
  },
  {
    id: "fotografie",
    name: "Alte Fotografie",
    beschreibung: "Zwei Tiere, ein Lächeln - und jemand, der weggeschnitten wurde.",
    bild: "/items/fotografie.png",
  },
  {
    id: "brille",
    name: "Brille",
    beschreibung: "Ein Bügel ist verbogen, auf dem Glas klebt ein Fingerabdruck.",
    bild: "/items/brille.png",
  },
  {
    id: "buerste",
    name: "Bürste",
    beschreibung: "Zwischen den Borsten steckt Fell - und etwas, das da nicht hingehört.",
    bild: "/items/buerste.png",
  },
  {
    id: "kamera",
    name: "Kamera",
    beschreibung: "Auf dem letzten Bild ist jemand zu sehen, der nicht dort sein wollte.",
    bild: "/items/kamera.png",
  },
  {
    id: "notizbuch",
    name: "Notizbuch",
    beschreibung: "Eine Seite fehlt. Der Abdruck der Schrift ist noch zu erahnen.",
    bild: "/items/notizbuch.png",
  },
  {
    id: "taschenlampe",
    name: "Taschenlampe",
    beschreibung: "Noch warm. Wer auch immer sie hielt, war eben erst hier.",
    bild: "/items/taschenlampe.png",
  },
];

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export const getItem = (id: string): Item | undefined => ITEM_BY_ID.get(id);
