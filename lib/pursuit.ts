import type { AnimationsModell } from "./animations.generated";

const LAUF_MUSTER = /(run|running|sprint|jog|laufen|rennen|walk|walking)/i;
const RUHE_MUSTER = /(rest|idle|t.?pose)/i;

/** Bevorzugt für die Jagd einen echten Laufclip, bleibt aber mit jedem GLB spielbar. */
export function laufAnimation(animationen: string[]): string | null {
  return animationen.find((name) => LAUF_MUSTER.test(name)) ?? animationen[0] ?? null;
}

/** Die Startpose soll möglichst auffällig und bei jedem Aufruf neu sein. */
export function zufaelligeIntroAnimation(
  animationen: string[],
  zufall = Math.random,
): string | null {
  const lebhaft = animationen.filter((name) => !LAUF_MUSTER.test(name) && !RUHE_MUSTER.test(name));
  const auswahl = lebhaft.length ? lebhaft : animationen.filter((name) => !LAUF_MUSTER.test(name));
  const kandidaten = auswahl.length ? auswahl : animationen;
  if (!kandidaten.length) return null;
  const index = Math.min(kandidaten.length - 1, Math.floor(Math.max(0, zufall()) * kandidaten.length));
  return kandidaten[index];
}

/** Drei verschiedene Rollen, sofern mindestens drei Modelle vorhanden sind. */
export function pursuitStartauswahl(modelle: AnimationsModell[]): [string, string, string] | null {
  if (modelle.length < 3) return null;
  return [modelle[0].id, modelle[1].id, modelle[2].id];
}

export function pursuitAuswahlGueltig(auswahl: string[], modelle: AnimationsModell[]): boolean {
  const vorhanden = new Set(modelle.map((modell) => modell.id));
  return auswahl.length === 3 && new Set(auswahl).size === 3 && auswahl.every((id) => vorhanden.has(id));
}

export const PURSUIT_STATEMENTS = [
  "Ich bin geflohen, weil ich den letzten warmen Kakao ganz allein trinken wollte.",
  "Ich dachte, der Wagen sei ein Taxi. Dann fand ich den Turbo-Knopf.",
  "Ich musste weg, bevor jemand merkt, dass die geheimnisvolle Reifenspur von mir stammt.",
  "Ich wollte nur testen, ob ihr im Schnee wirklich so schnell seid, wie alle behaupten.",
];
