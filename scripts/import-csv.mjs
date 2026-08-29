#!/usr/bin/env node
/**
 * Liest data/characters.csv und generiert lib/characters.generated.ts.
 * Nach jeder Änderung an der Excel/CSV einfach `npm run import:csv` ausführen.
 *
 * Das Dateiformat selbst ist in lib/csv.ts definiert - dieselbe Funktion
 * benutzt auch das Admin-Menü im Browser.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCharacterCsv, pruefeBesetzung } from "../lib/csv.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data", "characters.csv");
const outPath = path.join(root, "lib", "characters.generated.ts");

const charaktere = parseCharacterCsv(fs.readFileSync(csvPath, "utf8"));

const problem = pruefeBesetzung(charaktere);
if (problem) {
  console.error(`Fehler in ${path.relative(root, csvPath)}: ${problem}`);
  process.exit(1);
}

fs.writeFileSync(
  outPath,
  `// AUTOMATISCH GENERIERT - nicht von Hand bearbeiten.
// Quelle: data/characters.csv - neu erzeugen mit \`npm run import:csv\`.

import type { Character } from "./types";

export const CHARACTERS: Character[] = ${JSON.stringify(charaktere, null, 2)};
`,
  "utf8",
);

console.log(
  `${charaktere.length} Charaktere importiert -> lib/characters.generated.ts\n` +
    charaktere
      .map((c) => `  ${c.nummer}. ${c.name} (${c.tierart}) -> ${c.bild}`)
      .join("\n"),
);
