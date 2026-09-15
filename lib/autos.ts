import { AUTO_MODELLE } from './autos.generated';
import type { Zubehoer } from './zubehoer';
export { AUTO_MODELLE };
export type Auto = Zubehoer & { modell: string; speed: number; beschleunigung: number; drehung: number };
export const START_AUTO_ID = 'auto-start';

/**
 * Wimpys eigener Wagen: der RAV4.
 *
 * Er wird am Dateinamen erkannt, damit eine neu eingelegte `rav4.glb` ohne
 * weiteres Zutun zum Startwagen wird. Fehlt sie noch, bleibt es beim ersten
 * Modell im Ordner - besser ein anderer Wagen als gar keiner. Der Name folgt
 * dem, was wirklich fährt: Steht kein RAV4 im Ordner, heißt er auch nicht so.
 */
const RAV4 = /rav\s*-?\s*4/i;

const huebsch = (name: string) =>
  name.replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, (buchstabe) => buchstabe.toLocaleUpperCase('de'));

/**
 * Wie ein Modell gedreht werden muss, damit es vorwärts fährt.
 *
 * Gefahren wird in Richtung +z. Der Build misst beim Erzeugen des Katalogs,
 * ob ein Wagen quer in seiner Datei liegt (`quer`) - das ist die halbe
 * Antwort. Ob die Schnauze dann nach vorn oder nach hinten zeigt, sieht man
 * erst im Bild: Der Lambo braucht 270 Grad, der RAV4 genau die andere
 * Vierteldrehung. Für die mitgelieferten Wagen steht das Ergebnis deshalb
 * hier; alles Neue fängt bei der gemessenen Achse an.
 *
 * Fährt ein eigenes Modell trotzdem rückwärts: einmal im Autokatalog
 * („Modelldrehung") oder für eine einzelne Jagd in der Verfolgungsjagd
 * selbst geraderücken - dort sieht man die Wirkung sofort.
 */
const NACHGESEHEN: { muster: RegExp; grad: number }[] = [
  { muster: /rav\s*-?\s*4/i, grad: 90 },
  { muster: /lambo/i, grad: 270 },
];

const drehungFuer = (modell: { name: string; quer?: boolean } | undefined) => {
  const bekannt = NACHGESEHEN.find((eintrag) => eintrag.muster.test(modell?.name ?? ""));
  if (bekannt) return bekannt.grad;
  return modell?.quer ? 270 : 0;
};

type Modell = { id: string; name: string; quer?: boolean };

const auto = (
  id: string,
  name: string,
  modell: Modell | undefined,
  speed: number,
  beschleunigung: number,
  preis: number,
  beschreibung: string,
): Auto[] =>
  modell
    ? [{
        id, name, modell: modell.id, speed, beschleunigung, preis,
        drehung: drehungFuer(modell), bild: '', wirkung: 'auto', erstelltAm: 0, beschreibung,
      }]
    : [];

/**
 * Was ohne eigenen Autokatalog in der Garage steht.
 *
 * Der Startwagen gehört Wimpy von Anfang an; die Sportwagen stehen im Laden.
 * Sobald in der Datenbank ein Wagen mit derselben Id liegt, gilt der - hier
 * steht nur, was es ohne Zutun gibt.
 *
 * Die Liste hängt an den Dateien im Ordner: Deshalb ist es eine Funktion und
 * keine feste Liste - so lässt sich prüfen, was passiert, wenn eine dazukommt
 * oder fehlt.
 */
export function standardAutos(modelle: Modell[]): Auto[] {
  const mit = (muster: RegExp) =>
    modelle.find((modell) => muster.test(modell.name) || muster.test(modell.id));
  const start = mit(RAV4) ?? modelle[0];
  const ferrari = mit(/ferrari/i);
  const lambo = mit(/lambo/i);
  return [
    ...auto(
      START_AUTO_ID,
      start && RAV4.test(start.name) ? 'Wimpys RAV4' : `Wimpys ${huebsch(start?.name ?? 'Wagen')}`,
      start,
      155, 28, 0,
      'Wimpys eigener Wagen. Nicht der schnellste, aber er springt immer an.',
    ),
    // Der Ferrari ist nicht mehr Wimpys Wagen, sondern einer zum Kaufen -
    // außer er muss mangels RAV4 selbst als Startwagen herhalten.
    ...(ferrari && ferrari.id !== start?.id
      ? auto('auto-ferrari', 'Ferrari', ferrari, 205, 34, 900,
          'Schnell auf der Geraden, nervös in der Kurve.')
      : []),
    ...(lambo && lambo.id !== start?.id
      ? auto('auto-sport', 'Lamborghini', lambo, 190, 38, 1200,
          'Zieht an wie nichts anderes in der Stadt.')
      : []),
  ];
}

export const STANDARD_AUTOS: Auto[] = standardAutos(AUTO_MODELLE);
export function autoGueltig(auto: Auto) {
  return Boolean(auto.name.trim()) && AUTO_MODELLE.some(m => m.id === auto.modell)
    && Number.isFinite(auto.speed) && auto.speed >= 60 && auto.speed <= 320
    && Number.isFinite(auto.beschleunigung) && auto.beschleunigung >= 5 && auto.beschleunigung <= 100
    && Number.isFinite(auto.preis) && auto.preis >= 0 && Number.isFinite(auto.drehung);
}
export function autoRegal(daten: Auto[]) {
  const eigene = daten.filter(autoGueltig);
  return [...STANDARD_AUTOS.filter(a => !eigene.some(e => e.id === a.id)), ...eigene];
}
/**
 * Wie schnell der Fluchtwagen gerade fährt, in Weltmetern pro Sekunde.
 *
 * Er fährt nicht sein eigenes Tempo, sondern eines knapp unter Wimpys: So
 * bleibt die Jagd eine Jagd - man holt Meter für Meter auf, statt nach
 * sechs Sekunden aufzulaufen, und selbst der langsamste Wagen aus der Garage
 * hat eine Chance gegen den schnellsten Flüchtigen. Schneller gekaufte Wagen
 * verkürzen die Jagd trotzdem: Der Vorsprung schmilzt im gleichen Verhältnis
 * schneller.
 *
 * In den Kurven geht er vom Gas - das sind die Momente, in denen man
 * wirklich Boden gutmacht.
 */
export const FLUCHT_BAND = 0.93;
export const FLUCHT_KURVE = 0.55;
/**
 * Und wenn Wimpy zurückliegt, geht der Flüchtige unauffällig vom Gas.
 *
 * Ohne das wäre ein Rempler das Ende: Während Wimpy wieder auf Tempo kommt,
 * zieht der andere in ein paar Sekunden sechzig Meter davon. So bleibt auch
 * eine Jagd mit Fehlern zu gewinnen.
 */
export const FLUCHT_RUECKSTAND = 0.82;

export function fluchtTempo(auto: Auto, zeit: number, spielerTempo = Infinity) {
  const band = Math.min(auto.speed / 3.6 * 0.95, spielerTempo * FLUCHT_BAND);
  return Math.sin(zeit * 0.28) > 0.55 ? band * FLUCHT_KURVE : band;
}

/** Was ein Rempler kostet: Tempo und ein Stück Vorsprung. */
export const REMPLER = { tempo: 0.45, verlust: 8 };
