import * as z from "zod/v4";
import { ITEMS } from "./items";
import type { Character, Item, Location } from "./types";
import { STIMMUNGEN } from "./zuordnen";

/**
 * Wichtig: Feste Auswahllisten werden vom Modell nur *beschrieben*, nicht
 * erzwungen - liefert es einen Wert daneben ("misstrauisch" statt "nervös"),
 * würde eine strenge Prüfung den ganzen Aufruf scheitern lassen. Deshalb sind
 * solche Felder freie Texte mit klarer Beschreibung; die Zuordnung auf gültige
 * Werte passiert danach im Server (siehe lib/zuordnen.ts).
 */
const ausListe = (werte: string[], was: string) =>
  z.string().describe(`${was}. Genau einer dieser Werte: ${werte.join(", ")}`);

/**
 * Die erlaubten Ids hängen vom Fall ab (Besetzung, Stadt und die für diesen
 * Fall gezogenen Gegenstände wechseln), deshalb werden die Schemata pro Fall
 * gebaut.
 *
 * Ein Fall entsteht in drei Schritten - siehe lib/prompts.ts. Jeder Schritt
 * hat sein eigenes, kleines Schema.
 */
const idListen = (besetzung: Character[], orte: Location[]) => ({
  characterId: ausListe(
    besetzung.map((c) => c.id),
    "Id eines Charakters",
  ),
  locationId: ausListe(
    orte.map((o) => o.id),
    "Id eines Schauplatzes",
  ),
});

/** Schritt 1: Was ist passiert, wo und warum. */
export function makeGeruestSchema(besetzung: Character[], orte: Location[]) {
  const { locationId } = idListen(besetzung, orte);
  return z.object({
    titel: z.string(),
    tatbeschreibung: z.string(),
    introText: z.string(),
    schlagworte: z
      .array(z.string())
      .describe(
        "Vier bis sechs kurze Schlagworte zum Fall (ein bis zwei Wörter), die im Intro einzeln eingeblendet werden",
      ),
    tatort: locationId,
    motiv: z.string(),
    tathergang: z.string(),
  });
}

/** Schritt 2: Alibi, Geheimnis und Aufenthaltsort je Verdächtigem. */
export function makeVerdaechtigeSchema(besetzung: Character[], orte: Location[]) {
  const { characterId, locationId } = idListen(besetzung, orte);
  return z.object({
    verdaechtige: z.array(
      z.object({
        charakterId: characterId,
        aufenthaltsort: locationId,
        alibi: z.string(),
        geheimnis: z.string(),
        alibiIstGelogen: z.boolean(),
      }),
    ),
  });
}

/** Schritt 3: Die Gegenstände, die an den Orten zu finden sind. */
export function makeSpurenSchema(
  besetzung: Character[],
  orte: Location[],
  items: Item[] = ITEMS,
) {
  const { characterId, locationId } = idListen(besetzung, orte);
  const itemId = ausListe(
    items.map((i) => i.id),
    "Id eines Gegenstands",
  );
  return z.object({
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

export type Geruest = z.infer<ReturnType<typeof makeGeruestSchema>>;
export type VerdaechtigeDraft = z.infer<ReturnType<typeof makeVerdaechtigeSchema>>;
export type SpurenDraft = z.infer<ReturnType<typeof makeSpurenSchema>>;

/** Was Claude bei einem Gespräch liefern muss. */
export const TalkSchema = z.object({
  antwort: z.string(),
  stimmung: ausListe([...STIMMUNGEN], "Stimmung des Charakters"),
  neueNotiz: z
    .string()
    .nullable()
    .describe("Kurze Notiz für Wimpys Notizbuch, oder null"),
  // Welche Ids gültig sind, steht im Gesprächsprompt - der Fall bringt seine
  // eigenen Gegenstände mit, deshalb hier keine feste Liste.
  gefundeneSpurItemId: z
    .string()
    .nullable()
    .describe("Id einer hier entdeckten Spur, oder null"),
  verdachtsaenderung: z
    .number()
    .describe("Änderung des Verdachts, -20 bis +20"),
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
  sprachstil: z.string().max(800).optional(),
  beziehungen: z
    .object({
      besteFreunde: z.array(z.string().max(40)).max(24),
      freunde: z.array(z.string().max(40)).max(24),
      feinde: z.array(z.string().max(40)).max(24),
      erzfeinde: z.array(z.string().max(40)).max(24),
    })
    .optional(),
});

/** Prüft die Orte, die der Client aus dem Admin-Menü mitschickt. */
export const LocationSchema = z.object({
  id: z.string().min(1).max(80),
  stadt: z.string().min(1).max(60),
  stadtId: z.string().min(1).max(60),
  name: z.string().min(1).max(60),
  atmosphaere: z.string().max(120),
  beschreibung: z.string().max(300),
  bild: z.string().max(300),
});

/** Prüft die Gegenstände, die der Client aus der Datenbank mitschickt. */
export const ItemSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  beschreibung: z.string().max(400),
  bild: z.string().max(300),
});

/** Vorgaben aus dem Admin-Menü für einen neuen Fall. */
export const VorgabenSchema = z.object({
  thema: z.string().max(400),
  stadt: z.string().max(60),
  charaktere: z.array(z.string().max(40)).max(24),
  items: z.array(z.string().max(40)).max(24),
  taeterId: z.string().max(40),
  schwierigkeit: z.enum(["leicht", "mittel", "knifflig"]),
  // Ältere Kampagnen kennen die beiden Felder noch nicht.
  reifegrad: z.enum(["kindgerecht", "jugendlich", "erwachsen"]).default("kindgerecht"),
  absurditaet: z.enum(["bodenstaendig", "verspielt", "absurd"]).default("verspielt"),
});

/**
 * Ein kompletter Fall, wie ihn das Admin-Menü zurückschickt.
 *
 * Bewusst großzügig: Ob der Fall danach noch spielbar ist, prüft
 * lib/aktePruefen.ts - dort gibt es verständliche Meldungen statt
 * Schema-Fehlern.
 */
export const CaseFileSchema = z.object({
  id: z.string().min(1).max(80),
  besetzung: CharacterSchema.array().min(3).max(24),
  items: ItemSchema.array().min(1).max(60),
  ton: z.enum(["kindgerecht", "spannend", "albern"]),
  reifegrad: z.enum(["kindgerecht", "jugendlich", "erwachsen"]).default("kindgerecht"),
  absurditaet: z.enum(["bodenstaendig", "verspielt", "absurd"]).default("verspielt"),
  stadt: z.string().min(1).max(60),
  orte: LocationSchema.array().min(2).max(12),
  introText: z.string().max(2000),
  schlagworte: z.array(z.string().max(80)).max(8),
  titel: z.string().max(160),
  tatbeschreibung: z.string().max(4000),
  tatort: z.string().max(80),
  taeterId: z.string().max(40),
  motiv: z.string().max(2000),
  tathergang: z.string().max(4000),
  verdaechtige: z
    .array(
      z.object({
        charakterId: z.string().max(40),
        aufenthaltsort: z.string().max(80),
        alibi: z.string().max(1000),
        geheimnis: z.string().max(1000),
        alibiIstGelogen: z.boolean(),
      }),
    )
    .max(24),
  spuren: z
    .array(
      z.object({
        itemId: z.string().max(80),
        ortId: z.string().max(80),
        bedeutung: z.string().max(1000),
        zeigtAufCharakterId: z.string().max(40),
        fuehrtInDieIrre: z.boolean(),
      }),
    )
    .max(20),
  erstelltAm: z.number(),
});

/** Vorgaben für eine ganze Saga aus dem Admin-Menü. */
export const SagaVorgabenSchema = z.object({
  name: z.string().max(120),
  thema: z.string().max(2000),
  kapitelAnzahl: z.number().min(2).max(8),
  kapitelWuensche: z.array(z.string().max(400)).max(8),
  kapitelStaedte: z.array(z.string().max(60)).max(9).default([]),
  stadt: z.string().max(60),
  staedteWechseln: z.boolean(),
  charaktere: z.array(z.string().max(40)).max(24),
  items: z.array(z.string().max(40)).max(24),
  drahtzieherId: z.string().max(40),
  schwierigkeit: z.enum(["leicht", "mittel", "knifflig"]),
  reifegrad: z.enum(["kindgerecht", "jugendlich", "erwachsen"]),
  absurditaet: z.enum(["bodenstaendig", "verspielt", "absurd"]),
  ton: z.enum(["kindgerecht", "spannend", "albern"]),
  ortsAnzahl: z.number().min(2).max(8),
  beschuldigungen: z.number().min(1).max(5),
});

export const EinstellungenSchema = z.object({
  beschuldigungen: z.number().min(1).max(5),
  startverdacht: z.number().min(0).max(80),
  ton: z.enum(["kindgerecht", "spannend", "albern"]),
  stadt: z.string().max(60),
  ortsAnzahl: z.number().min(3).max(8),
  intro: z.boolean(),
});
