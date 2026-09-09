/**
 * Schreibt die Liste aller Bilddateien aus /public in lib/bilder.generated.ts.
 *
 * Bilder kommen über den Ordner public/ ins Projekt - ein Verzeichnis, das der
 * Browser nicht durchsehen kann und das auf dem Server auch nicht überall
 * liegt. Deshalb wird die Liste beim Bauen einmal eingesammelt. Im Admin-Menü
 * lässt sich damit zeigen, welche Bilder noch zu keinem Tier, Ort oder Ding
 * gehören. Läuft automatisch vor jedem Build, damit sie nie veraltet.
 */
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ORDNER = ["charaktere", "orte", "items", "video"];
const ENDUNGEN = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"];

const listen = {};
for (const ordner of ORDNER) {
  const pfad = join(process.cwd(), "public", ordner);
  const dateien = (await readdir(pfad).catch(() => []))
    .filter((name) => ENDUNGEN.some((e) => name.toLowerCase().endsWith(e)))
    .sort((a, b) => a.localeCompare(b, "de"));
  listen[ordner] = dateien.map((name) => `/${ordner}/${name}`);
}

// Was direkt in public/ liegt - Titelbilder und Ähnliches. Die Icons bleiben
// außen vor: Sie gehören zur App, nicht ins Spiel.
const oben = (await readdir(join(process.cwd(), "public")).catch(() => []))
  .filter((name) => ENDUNGEN.some((e) => name.toLowerCase().endsWith(e)))
  .sort((a, b) => a.localeCompare(b, "de"));
listen.sonstige = oben.map((name) => `/${name}`);

const anzahl = Object.values(listen).reduce((summe, l) => summe + l.length, 0);

const block = (name) =>
  `  ${name}: [\n${listen[name].map((p) => `    "${p}",`).join("\n")}\n  ],`;

const inhalt = `/**
 * Alle Bilddateien aus /public - erzeugt von scripts/bilder-liste.mjs.
 * Nicht von Hand ändern: Beim nächsten Build wird die Datei überschrieben.
 */
export const BILD_DATEIEN: Record<string, string[]> = {
${[...ORDNER, "sonstige"].map(block).join("\n")}
};

/** Alle Pfade am Stück - in derselben Reihenfolge wie oben. */
export const ALLE_BILDER: string[] = Object.values(BILD_DATEIEN).flat();
`;

await writeFile(join(process.cwd(), "lib", "bilder.generated.ts"), inhalt);
console.log(`bilder.generated.ts: ${anzahl} Dateien`);
