import type { Character } from "./types";

/**
 * Liest die Charakter-Tabelle (Semikolon-getrennt, wie aus Excel exportiert).
 *
 * Spalten: Nummer;Name;Tierart;Alter;Charisma;Freundlichkeit;Fitness;
 *          Zauberkraft;Schelmischkeit;Kriminalitätslevel;Intelligenz;
 *          Charakter[;Bild]
 *
 * Wird sowohl vom Admin-Menü im Browser als auch von scripts/import-csv.mjs
 * benutzt - es gibt also nur eine Stelle, an der das Format definiert ist.
 */
export function slugify(wert: string): string {
  return wert
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const zahl = (wert: string | undefined): number => {
  const geparst = Number.parseInt(String(wert ?? "").trim(), 10);
  return Number.isFinite(geparst) ? geparst : 0;
};

export function parseCharacterCsv(text: string): Character[] {
  const zeilen = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((zeile) => zeile.trim().length > 0);

  // Semikolon ist Standard aus deutschem Excel; Komma als Notnagel.
  const trenner = (zeilen[0]?.split(";").length ?? 0) > 1 ? ";" : ",";

  return zeilen
    .slice(1)
    .map((zeile) => zeile.split(trenner).map((zelle) => zelle.trim()))
    .filter((zellen) => Boolean(zellen[1])) // Zeilen ohne Name überspringen
    .map((zellen) => {
      const name = zellen[1];
      const id = slugify(name);
      return {
        id,
        nummer: zahl(zellen[0]),
        name,
        tierart: zellen[2] || "Unbekannt",
        alter: zahl(zellen[3]),
        stats: {
          charisma: zahl(zellen[4]),
          freundlichkeit: zahl(zellen[5]),
          fitness: zahl(zellen[6]),
          zauberkraft: zahl(zellen[7]),
          schelmischkeit: zahl(zellen[8]),
          kriminalitaetslevel: zahl(zellen[9]),
          intelligenz: zahl(zellen[10]),
        },
        beschreibung: zellen[11] || "",
        bild: zellen[12] || `/charaktere/${id}.png`,
        istDetektiv: /detektiv/i.test(zellen[11] || ""),
      } satisfies Character;
    });
}

/** Prüft, ob mit dieser Besetzung gespielt werden kann. */
export function pruefeBesetzung(charaktere: Character[]): string | null {
  if (charaktere.length === 0) return "Die Datei enthält keine Charaktere.";

  const detektive = charaktere.filter((c) => c.istDetektiv);
  if (detektive.length === 0)
    return "Kein Detektiv gefunden - bei genau einem Tier muss das Wort „Detektiv“ in der Spalte Charakter stehen.";
  if (detektive.length > 1)
    return `Mehrere Detektive gefunden (${detektive.map((c) => c.name).join(", ")}) - es darf nur einer sein.`;

  const verdaechtige = charaktere.length - 1;
  if (verdaechtige < 2)
    return "Zu wenige Verdächtige - neben dem Detektiv braucht es mindestens zwei weitere Tiere.";

  const doppelt = charaktere
    .map((c) => c.id)
    .filter((id, i, alle) => alle.indexOf(id) !== i);
  if (doppelt.length > 0)
    return `Doppelte Namen: ${[...new Set(doppelt)].join(", ")}.`;

  return null;
}
