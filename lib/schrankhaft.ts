/**
 * Das Strafmaß dieser Stadt: Schrankhaft.
 *
 * Wer überführt wird, geht nicht ins Gefängnis - er muss in den Schrank, und
 * zwar für eine feste Anzahl Tage. Jedes Urteil im Spiel läuft darauf hinaus:
 * die Auflösung eines einzelnen Falls genauso wie der Schuldspruch am Ende
 * einer Verhandlung.
 *
 * Die Zahl kommt vom Modell, aber verlassen kann man sich darauf nicht: Sie
 * wird hier eingefangen, gerundet und in einen Bereich gezwungen, in dem sie
 * noch nach Urteil klingt. Null heißt "niemand muss in den Schrank" - ein
 * Freispruch, ein geplatztes Verfahren, eine danebengegangene Beschuldigung.
 */

/** Kürzeste und längste Strafe. Darunter wäre es albern, darüber grausam. */
export const KUERZESTE_HAFT = 1;
export const LAENGSTE_HAFT = 99;

/**
 * Eine Zahl aus dem Modell in ein gültiges Strafmaß verwandeln.
 *
 * `fallback` gilt, wenn gar nichts Brauchbares ankam - sonst stünde am Ende
 * einer gewonnenen Verhandlung ein Urteil ohne Strafe.
 */
export function haftTage(roh: unknown, fallback = 7): number {
  const zahl = typeof roh === "number" ? roh : Number(roh);
  if (!Number.isFinite(zahl)) return fallback;
  const ganz = Math.round(zahl);
  if (ganz <= 0) return 0;
  return Math.min(LAENGSTE_HAFT, Math.max(KUERZESTE_HAFT, ganz));
}

/** „14 Tage Schrankhaft“ - und im Einzelfall „1 Tag Schrankhaft“. */
export const haftSatz = (tage: number): string =>
  `${tage} ${tage === 1 ? "Tag" : "Tage"} Schrankhaft`;

/**
 * Die Ansage ans Modell - überall dieselbe, damit die Urteile im ganzen Spiel
 * gleich klingen.
 */
export const HAFT_REGEL = `DAS STRAFMASS DIESER STADT
- Wer überführt ist, muss in den Schrank: Schrankhaft, gemessen in Tagen. Ein Gefängnis gibt es hier nicht, und niemand spricht von einem.
- Jedes Urteil endet mit genau dieser Strafe, ausgesprochen als Zahl: "${haftSatz(
  14,
)}". Die Länge passt zur Tat - ein geklauter Keks sind wenige Tage, ein Bogen über mehrere Fälle deutlich mehr.
- Der Schrank ist ein echter Schrank: Man hört die Tür, man sieht den Spalt Licht darunter, jemand schiebt ein Kissen hinein. Das darf ruhig anschaulich werden, aber nie grausam.`;
