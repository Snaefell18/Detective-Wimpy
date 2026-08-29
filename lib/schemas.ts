import * as z from "zod/v4";
import { CHARACTERS } from "./characters";
import { ITEMS } from "./items";
import { LOCATIONS } from "./locations";

const characterIds = CHARACTERS.map((c) => c.id);
const locationIds = LOCATIONS.map((o) => o.id);
const itemIds = ITEMS.map((i) => i.id);

const characterId = z.enum(characterIds as [string, ...string[]]);
const locationId = z.enum(locationIds as [string, ...string[]]);
const itemId = z.enum(itemIds as [string, ...string[]]);

/** Was Claude beim Erzeugen eines Falls liefern muss. */
export const CaseDraftSchema = z.object({
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

export type CaseDraft = z.infer<typeof CaseDraftSchema>;

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
