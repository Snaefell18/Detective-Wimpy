/**
 * Schreibt alle GLB-Modelle samt eingebetteter Animationsnamen in
 * lib/animations.generated.ts. Der Browser kann /public/animations nicht
 * selbst auflisten, deshalb läuft dieser Schritt vor jedem Build.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const ORDNER = join(process.cwd(), "public", "animations");
const ZIEL = join(process.cwd(), "lib", "animations.generated.ts");
const JSON_CHUNK = 0x4e4f534a;

function glbJson(puffer) {
  if (puffer.length < 20 || puffer.toString("ascii", 0, 4) !== "glTF") return null;
  let position = 12;
  while (position + 8 <= puffer.length) {
    const laenge = puffer.readUInt32LE(position);
    const typ = puffer.readUInt32LE(position + 4);
    if (typ === JSON_CHUNK) {
      const text = puffer.subarray(position + 8, position + 8 + laenge)
        .toString("utf8").replace(/\0+$/, "").trim();
      return JSON.parse(text);
    }
    position += 8 + laenge;
  }
  return null;
}

function anzeigename(datei) {
  return basename(datei, extname(datei))
    .replace(/[-_]+/g, " ")
    .replace(/\b\p{L}/gu, (buchstabe) => buchstabe.toLocaleUpperCase("de"));
}

const dateien = (await readdir(ORDNER).catch(() => []))
  .filter((name) => name.toLowerCase().endsWith(".glb"))
  .sort((a, b) => a.localeCompare(b, "de"));

const modelle = [];
for (const datei of dateien) {
  let animationen = [];
  try {
    const json = glbJson(await readFile(join(ORDNER, datei)));
    animationen = (json?.animations ?? [])
      .map((animation) => String(animation?.name ?? "").trim())
      .filter(Boolean);
  } catch (fehler) {
    console.warn(`Animationen aus ${datei} konnten nicht gelesen werden:`, fehler);
  }
  modelle.push({
    id: basename(datei, extname(datei)).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: anzeigename(datei),
    datei: `/animations/${datei}`,
    animationen,
  });
}

const inhalt = `/**
 * Alle GLB-Charaktere aus /public/animations - erzeugt von
 * scripts/animations-liste.mjs. Nicht von Hand ändern.
 */
export type AnimationsModell = {
  id: string;
  name: string;
  datei: string;
  animationen: string[];
};

export const ANIMATIONS_MODELLE: AnimationsModell[] = ${JSON.stringify(modelle, null, 2)};
`;

await writeFile(ZIEL, inhalt);
console.log(`animations.generated.ts: ${modelle.length} Modelle`);
