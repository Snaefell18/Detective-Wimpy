import { AUTO_MODELLE } from './autos.generated';
import type { Zubehoer } from './zubehoer';
export { AUTO_MODELLE };
export type Auto = Zubehoer & { modell: string; speed: number; beschleunigung: number; drehung: number };
export const START_AUTO_ID = 'auto-start';
/*
 * Jedes 3D-Modell steht anders in seiner Datei. Gefahren wird in Richtung +z:
 * Der Ferrari zeigt dort von Haus aus hin, der Lambo liegt quer und muss um
 * 270 Grad gedreht werden - bei 90 Grad fuhr er rückwärts voraus. Ein eigenes
 * Modell stellt man im Autokatalog (`drehung`) oder für eine einzelne Jagd in
 * der Verfolgungsjagd selbst gerade.
 */
export const STANDARD_AUTOS: Auto[] = AUTO_MODELLE.slice(0, 2).map((modell, i) => ({
  id: i === 0 ? START_AUTO_ID : 'auto-sport', name: i === 0 ? 'Wimpys Ferrari' : 'Lamborghini',
  modell: modell.id, speed: i === 0 ? 155 : 190, beschleunigung: i === 0 ? 28 : 38,
  preis: i === 0 ? 0 : 1200, drehung: /lambo/i.test(modell.name) ? 270 : 0, bild: '', wirkung: 'auto', erstelltAm: 0,
  beschreibung: 'Dein Wagen für die Verfolgungsjagd.',
}));
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
