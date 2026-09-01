/**
 * Zeichnet die App-Icons im Noir-Design.
 *
 * Grund fast schwarz, Monogramm in Creme, ein Messing-Detail - dieselben drei
 * Werte, die auch das Design im Spiel trägt. Bewusst ohne Schriftart: das W ist
 * ein Pfad, damit das Ergebnis überall gleich aussieht.
 *
 *   node scripts/icons.mjs
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const GRUND = "#080808";
const CREME = "#efe9dd";
const MESSING = "#c2913f";

/**
 * @param {number} groesse  Kantenlänge in Pixeln
 * @param {number} luft     Anteil Rand, den maskierbare Icons brauchen (0…0.2)
 */
function svg(groesse, luft = 0) {
  const s = 512;
  const m = s * luft; // Sicherheitsrand für runde Masken
  const innen = s - 2 * m;
  const rahmen = m + innen * 0.1;
  const strich = innen * 0.09;

  // Ein schweres, schmales W aus vier Strichen.
  const oben = m + innen * 0.3;
  const unten = m + innen * 0.7;
  const links = m + innen * 0.22;
  const rechts = m + innen * 0.78;
  const mitte = m + innen * 0.5;
  const spitze = m + innen * 0.44;
  const w = `M ${links} ${oben} L ${links + innen * 0.11} ${unten} L ${mitte} ${spitze} L ${rechts - innen * 0.11} ${unten} L ${rechts} ${oben}`;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${groesse}" height="${groesse}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${GRUND}"/>
  <rect x="${rahmen}" y="${rahmen}" width="${s - 2 * rahmen}" height="${s - 2 * rahmen}"
        fill="none" stroke="${MESSING}" stroke-opacity="0.55" stroke-width="${s * 0.006}"/>
  <path d="${w}" fill="none" stroke="${CREME}" stroke-width="${strich}"
        stroke-linejoin="miter" stroke-linecap="butt" stroke-miterlimit="6"/>
  <rect x="${mitte - innen * 0.022}" y="${unten + innen * 0.09}"
        width="${innen * 0.044}" height="${innen * 0.044}" fill="${MESSING}"/>
</svg>`);
}

await mkdir("public/icons", { recursive: true });

const dateien = [
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-180.png", 180, 0],
  // Maskierbar: mehr Luft, damit die runde Maske nichts abschneidet.
  ["public/icons/icon-maskable-512.png", 512, 0.14],
];

for (const [pfad, groesse, luft] of dateien) {
  await sharp(svg(groesse, luft)).png({ compressionLevel: 9 }).toFile(pfad);
  console.log("geschrieben:", pfad);
}
