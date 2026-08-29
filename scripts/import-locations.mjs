#!/usr/bin/env node
/**
 * Liest data/locations.csv und generiert lib/locations.generated.ts.
 * Nach Änderungen an der Tabelle `npm run import:orte` ausführen.
 *
 * Format (siehe lib/csv.ts): Stadt;Location;Atmosphäre[;Bild]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { alsStaedte, parseLocationCsv, pruefeOrte } from "../lib/csv.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data", "locations.csv");
const outPath = path.join(root, "lib", "locations.generated.ts");

const orte = parseLocationCsv(fs.readFileSync(csvPath, "utf8"));

const problem = pruefeOrte(orte, 5);
if (problem) {
  console.error(`Fehler in ${path.relative(root, csvPath)}: ${problem}`);
  process.exit(1);
}

fs.writeFileSync(
  outPath,
  `// AUTOMATISCH GENERIERT - nicht von Hand bearbeiten.
// Quelle: data/locations.csv - neu erzeugen mit \`npm run import:orte\`.

import type { Location } from "./types";

export const LOCATIONS: Location[] = ${JSON.stringify(orte, null, 2)};
`,
  "utf8",
);

for (const stadt of alsStaedte(orte)) {
  console.log(`${stadt.name} (${stadt.orte.length} Orte)`);
  for (const ort of stadt.orte) console.log(`  ${ort.name} -> ${ort.bild}`);
}
