#!/usr/bin/env node
/**
 * Liest data/characters.csv (Semikolon-getrennt, aus Excel exportiert) und
 * generiert lib/characters.generated.ts.
 *
 * Nach jeder Änderung an der Excel/CSV einfach `npm run import:csv` ausführen.
 *
 * Spalten: Nummer;Name;Tierart;Alter;Charisma;Freundlichkeit;Fitness;
 *          Zauberkraft;Schelmischkeit;Kriminalitätslevel;Intelligenz;Charakter[;Bild]
 * Die optionale letzte Spalte "Bild" überschreibt den automatischen Bildpfad.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(root, "data", "characters.csv");
const outPath = path.join(root, "lib", "characters.generated.ts");

const slugify = (value) =>
  value
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const num = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const raw = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "");
const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
const rows = lines.slice(1).map((line) => line.split(";").map((cell) => cell.trim()));

const characters = rows
  .filter((cells) => cells[1]) // Zeilen ohne Name überspringen (leere Vorlagen-Zeilen)
  .map((cells) => {
    const name = cells[1];
    const id = slugify(name);
    return {
      id,
      nummer: num(cells[0]),
      name,
      tierart: cells[2] || "Unbekannt",
      alter: num(cells[3]),
      stats: {
        charisma: num(cells[4]),
        freundlichkeit: num(cells[5]),
        fitness: num(cells[6]),
        zauberkraft: num(cells[7]),
        schelmischkeit: num(cells[8]),
        kriminalitaetslevel: num(cells[9]),
        intelligenz: num(cells[10]),
      },
      beschreibung: cells[11] || "",
      bild: cells[12] || `/charaktere/${id}.png`,
      istDetektiv: /detektiv/i.test(cells[11] || ""),
    };
  });

if (characters.length === 0) {
  throw new Error(`Keine Charaktere in ${csvPath} gefunden.`);
}
if (!characters.some((c) => c.istDetektiv)) {
  throw new Error(
    "Kein Detektiv gefunden - eine Zeile muss das Wort 'Detektiv' in der Spalte Charakter enthalten.",
  );
}

const banner = `// AUTOMATISCH GENERIERT - nicht von Hand bearbeiten.
// Quelle: data/characters.csv - neu erzeugen mit \`npm run import:csv\`.

import type { Character } from "./types";

export const CHARACTERS: Character[] = ${JSON.stringify(characters, null, 2)};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, banner, "utf8");

console.log(
  `${characters.length} Charaktere importiert -> lib/characters.generated.ts\n` +
    characters.map((c) => `  ${c.nummer}. ${c.name} (${c.tierart}) -> ${c.bild}`).join("\n"),
);
