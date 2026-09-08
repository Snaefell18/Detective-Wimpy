/**
 * Schreibt die Liste aller Musikdateien in lib/audio.generated.ts.
 *
 * Neue Songs landen per Upload in /public/audio - ein Verzeichnis, das der
 * Browser nicht durchsehen kann. Deshalb wird die Liste beim Bauen einmal
 * eingesammelt; im Admin-Menü steht sie dann als Auswahl bereit. Läuft
 * automatisch vor jedem Build, damit sie nie veraltet.
 */
import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ORDNER = join(process.cwd(), "public", "audio");
const ZIEL = join(process.cwd(), "lib", "audio.generated.ts");
const ENDUNGEN = [".mp3", ".m4a", ".ogg", ".wav"];

const dateien = (await readdir(ORDNER).catch(() => []))
  .filter((name) => ENDUNGEN.some((e) => name.toLowerCase().endsWith(e)))
  .sort((a, b) => a.localeCompare(b, "de"));

const inhalt = `/**
 * Alle Musikdateien aus /public/audio - erzeugt von scripts/audio-liste.mjs.
 * Nicht von Hand ändern: Beim nächsten Build wird die Datei überschrieben.
 */
export const AUDIO_DATEIEN: string[] = [
${dateien.map((name) => `  "/audio/${name}",`).join("\n")}
];
`;

await writeFile(ZIEL, inhalt);
console.log(`audio.generated.ts: ${dateien.length} Dateien`);
