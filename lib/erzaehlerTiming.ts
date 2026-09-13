/**
 * Wie viele Zeilen bei einem Audiofortschritt zu sehen sind.
 *
 * Nicht jede Zeile bekommt gleich viel Zeit: Eine lange Erzählerzeile dauert
 * beim Sprechen länger als ein einzelnes Wort. Zeichenlängen sind keine
 * Wort-Zeitmarken, liegen aber erheblich näher an der Aufnahme als eine
 * gleichmäßige Verteilung pro Zeile.
 */
export function sichtbareErzaehlerZeilen(zeilen: string[], fortschritt: number): number {
  if (!zeilen.length) return 0;
  const gesamt = zeilen.reduce((summe, zeile) => summe + Math.max(1, zeile.length), 0);
  const ziel = Math.max(0, Math.min(1, fortschritt)) * gesamt;
  let bis = 0;
  for (let i = 0; i < zeilen.length; i++) {
    bis += Math.max(1, zeilen[i].length);
    if (bis >= ziel) return i + 1;
  }
  return zeilen.length;
}
