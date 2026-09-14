/**
 * Erstellt den Katalog aller GLB-Straßen in /public/3d_locations.
 * Gibt es zu `ort.glb` auch `ort-web.glb`, wird nur die kleinere Webfassung
 * angeboten. Dadurch taucht jede neu eingecheckte Straße beim Vercel-Build
 * automatisch im Editor und in Pursuit auf.
 */
import { readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const ORDNER = join(process.cwd(), "public", "3d_locations");
const ZIEL = join(process.cwd(), "lib", "locations3d.generated.ts");

const anzeigename = (id) =>
  id
    .replace(/[-_]+/g, " ")
    .replace(/\b\p{L}/gu, (buchstabe) => buchstabe.toLocaleUpperCase("de"));

const alle = (await readdir(ORDNER).catch(() => []))
  .filter((name) => name.toLowerCase().endsWith(".glb"));
const webBasen = new Set(
  alle
    .filter((name) => /-web\.glb$/i.test(name))
    .map((name) => basename(name, extname(name)).replace(/-web$/i, "").toLowerCase()),
);

const locations = alle
  .filter((name) => {
    const basis = basename(name, extname(name)).toLowerCase();
    return basis.endsWith("-web") || !webBasen.has(basis);
  })
  .map((datei) => {
    const roh = basename(datei, extname(datei)).replace(/-web$/i, "");
    const id = roh.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return { id, name: anzeigename(roh), datei: `/3d_locations/${datei}` };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "de"));

const inhalt = `/** Automatisch aus /public/3d_locations erzeugt. */
export const GENERIERTE_3D_LOCATIONS = ${JSON.stringify(locations, null, 2)} as const;

export const GENERIERTE_3D_LOCATION_IDS = GENERIERTE_3D_LOCATIONS.map((ort) => ort.id);
`;

await writeFile(ZIEL, inhalt);
console.log(`locations3d.generated.ts: ${locations.length} Straßen`);
