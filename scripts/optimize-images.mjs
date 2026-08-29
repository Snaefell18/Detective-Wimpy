#!/usr/bin/env node
/**
 * Verkleinert die Bilder in public/ auf eine handytaugliche Größe.
 *
 * Hintergrund: Aus Bildgeneratoren kommen gern 2-3 MB große PNGs. Auf dem
 * Handy über Mobilfunk ist das viel zu schwer - besonders im Intro, wo mehrere
 * Figuren und Orte nacheinander erscheinen. Transparenz bleibt erhalten.
 *
 * Aufruf: npm run bilder:optimieren [-- --pruefen]
 *   --pruefen zeigt nur an, was passieren würde.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nurPruefen = process.argv.includes("--pruefen");

/** Maximale Kantenlänge je Ordner - Orte dürfen breiter sein als Gegenstände. */
const GRENZEN = {
  charaktere: 1100,
  // 1280 px reichen für ein randloses Hintergrundbild auf jedem Handy.
  orte: 1280,
  items: 640,
  ".": 1600, // start.png
};

const kb = (bytes) => `${Math.round(bytes / 1024)} kB`;

async function bearbeite(datei, grenze) {
  const vorher = (await fs.stat(datei)).size;
  const bild = sharp(datei);
  const info = await bild.metadata();
  const groesteKante = Math.max(info.width ?? 0, info.height ?? 0);

  const daten = await bild
    .resize({
      width: info.width && info.width >= (info.height ?? 0) ? Math.min(info.width, grenze) : undefined,
      height: info.height && (info.height > (info.width ?? 0)) ? Math.min(info.height, grenze) : undefined,
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9, palette: true, quality: 82, effort: 9 })
    .toBuffer();

  if (daten.length >= vorher) {
    console.log(`  ${path.basename(datei)}: schon gut (${kb(vorher)})`);
    return 0;
  }

  console.log(
    `  ${path.basename(datei)}: ${kb(vorher)} -> ${kb(daten.length)}` +
      ` (${groesteKante}px -> ${Math.min(groesteKante, grenze)}px)${nurPruefen ? " [nur geprüft]" : ""}`,
  );
  if (!nurPruefen) await fs.writeFile(datei, daten);
  return vorher - daten.length;
}

let gespart = 0;
for (const [ordner, grenze] of Object.entries(GRENZEN)) {
  const verzeichnis = path.join(root, "public", ordner);
  const dateien = (await fs.readdir(verzeichnis).catch(() => []))
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
  if (dateien.length === 0) continue;

  console.log(`public/${ordner === "." ? "" : ordner}`);
  for (const name of dateien) {
    gespart += await bearbeite(path.join(verzeichnis, name), grenze);
  }
}

console.log(`\nGespart: ${kb(gespart)}${nurPruefen ? " (nichts geschrieben)" : ""}`);
