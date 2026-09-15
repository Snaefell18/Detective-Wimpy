import { AUTO_MODELLE } from './autos.generated';
import type { Zubehoer } from './zubehoer';
export { AUTO_MODELLE };
export type Auto = Zubehoer & { modell: string; speed: number; beschleunigung: number; drehung: number };
export const START_AUTO_ID = 'auto-start';
export const STANDARD_AUTOS: Auto[] = AUTO_MODELLE.slice(0, 2).map((modell, i) => ({
  id: i === 0 ? START_AUTO_ID : 'auto-sport', name: i === 0 ? 'Wimpys Ferrari' : 'Lamborghini',
  modell: modell.id, speed: i === 0 ? 155 : 190, beschleunigung: i === 0 ? 28 : 38,
  preis: i === 0 ? 0 : 1200, drehung: /lambo/i.test(modell.name) ? 90 : 0, bild: '', wirkung: 'auto', erstelltAm: 0,
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
/** km/h -> Weltmeter pro Sekunde. Fluchtwagen bremst regelmäßig für Kurven. */
export function fluchtTempo(auto: Auto, zeit: number) {
  return auto.speed / 3.6 * (Math.sin(zeit * 0.28) > 0.15 ? 0.08 : 0.24);
}
