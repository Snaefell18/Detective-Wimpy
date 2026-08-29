import * as z from "zod/v4";
import { ITEMS } from "./items";
import { LOCATIONS } from "./locations";
import type { Character } from "./types";

const enumOf = (werte: string[]) => z.enum(werte as [string, ...string[]]);

const locationId = enumOf(LOCATIONS.map((o) => o.id));
const itemId = enumOf(ITEMS.map((i) => i.id));

/**
 * Die erlaubten Charakter-Ids hängen von der Besetzung ab (im Admin-Menü kann
 * sie geändert werden), deshalb werden die Schemata pro Fall gebaut.
 */
export function makeCaseDraftSchema(besetzung: Character[]) {
  const characterId = enumOf(besetzung.map((c) => c.id));

  return z.object({
    titel: z.string(),
    tatbeschreibung: z.string(),
    tatort: locationId,
    motiv: z.string(),
    tathergang: z.string(),
    verdaechtige: z.array(
      z.object({
        charakterId: characterId,
        aufenthaltsort: locationId,
        alibi: z.string(),
        geheimnis: z.string(),
        alibiIstGelogen: z.boolean(),
      }),
    ),
    spuren: z.array(
      z.object({
        itemId,
        ortId: locationId,
        bedeutung: z.string(),
        zeigtAufCharakterId: characterId,
        fuehrtInDieIrre: z.boolean(),
      }),
    ),
  });
}

export type CaseDraft = z.infer<ReturnType<typeof makeCaseDraftSchema>>;

/** Was Claude bei einem Gespräch liefern muss. */
export const TalkSchema = z.object({
  antwort: z.string(),
  stimmung: z.enum([
    "freundlich",
    "nervös",
    "genervt",
    "ausweichend",
    "panisch",
    "amüsiert",
  ]),
  neueNotiz: z.string().nullable(),
  gefundeneSpurItemId: itemId.nullable(),
  verdachtsaenderung: z.number(),
  luegt: z.boolean(),
});

/** Was Claude bei der finalen Beschuldigung liefern muss. */
export const AccuseSchema = z.object({
  richtig: z.boolean(),
  aufloesung: z.string(),
  reaktion: z.string(),
});

/** Prüft die Charaktere, die der Client aus dem Admin-Menü mitschickt. */
export const CharacterSchema = z.object({
  id: z.string().min(1).max(40),
  nummer: z.number(),
  name: z.string().min(1).max(40),
  tierart: z.string().max(40),
  alter: z.number(),
  stats: z.object({
    charisma: z.number(),
    freundlichkeit: z.number(),
    fitness: z.number(),
    zauberkraft: z.number(),
    schelmischkeit: z.number(),
    kriminalitaetslevel: z.number(),
    intelligenz: z.number(),
  }),
  beschreibung: z.string().max(600),
  bild: z.string().max(300),
  istDetektiv: z.boolean(),
});

export const EinstellungenSchema = z.object({
  beschuldigungen: z.number().min(1).max(5),
  startverdacht: z.number().min(0).max(80),
  ton: z.enum(["kindgerecht", "spannend", "albern"]),
});
