import * as z from "zod/v4";
import type { Character } from "./types";

/**
 * Der Bogen einer Saga entsteht in vielen kleinen Schritten statt in einem:
 *
 *   1. Kern     - Titel, Überthema, Wahrheit, Auftakt
 *   2. Kapitel  - je ein Aufruf pro Kapitel, nacheinander
 *   3. Finale   - Frage, Erzählertext, Epilog
 *
 * Ein einziger Aufruf für den ganzen Bogen lief bei langen Sagas in das
 * Zeitlimit der Plattform. Nebenbei werden die Kapitel dadurch besser: Jedes
 * kennt die Enthüllungen der vorherigen und kann darauf aufbauen.
 */

const charakterAuswahl = (besetzung: Character[]) =>
  z
    .string()
    .describe(
      `Id eines Charakters. Genau einer dieser Werte: ${besetzung
        .filter((c) => !c.istDetektiv)
        .map((c) => c.id)
        .join(", ")}`,
    );

/** Schritt 1: Worum es in der ganzen Saga geht. */
export const KernSchema = z.object({
  name: z.string().describe("Titel der Saga, höchstens 5 Wörter"),
  thema: z.string().describe("Das Überthema in ein bis zwei Sätzen"),
  klappentext: z
    .string()
    .describe("Zwei bis drei Sätze für die Auswahlliste, ohne den Drahtzieher zu verraten"),
  wahrheit: z.string().describe("Was wirklich hinter allem steckt. Sieht nur der Server."),
  drahtzieherMotiv: z.string().describe("Warum der Drahtzieher das alles tut"),
  auftaktText: z
    .string()
    .describe("Erzählertext vor dem ersten Kapitel: vier bis sechs kurze Zeilen"),
  schlagworte: z
    .array(z.string())
    .describe(
      "Vier bis sechs einzelne Wörter für den Vorspann - je eins pro Bildschirm, groß und hart geschnitten. Keine Sätze, keine Namen, die den Drahtzieher verraten.",
    ),
});

export type KernDraft = z.infer<typeof KernSchema>;

/** Schritt 2: ein einzelnes Kapitel. */
export function makeKapitelSchema(besetzung: Character[]) {
  return z.object({
    name: z.string().describe("Kapitelname, höchstens 5 Wörter"),
    teaser: z.string().describe("Ein Satz für die Übersicht"),
    erzaehlerText: z
      .string()
      .describe("Erzählertext vor diesem Kapitel: drei bis fünf kurze Zeilen"),
    auftrag: z.string().describe("Worum es im Fall dieses Kapitels geht"),
    enthuellung: z.string().describe("Was dieses Kapitel über den großen Bogen preisgibt"),
    taeterId: charakterAuswahl(besetzung).describe(
      "Wer den Fall dieses Kapitels begangen hat - niemals der Drahtzieher",
    ),
  });
}

export type KapitelDraft = z.infer<ReturnType<typeof makeKapitelSchema>>;

/** Schritt 3: der Abschluss. */
export const FinaleSchema = z.object({
  frage: z.string().describe("Die Frage, um die es im Finale geht"),
  auftrag: z.string().describe("Worum es im Finalfall geht"),
  erzaehlerText: z.string().describe("Erzählertext vor dem Finale, vier bis sechs Zeilen"),
  epilogText: z.string().describe("Erzählertext nach dem gelösten Finale, drei bis fünf Zeilen"),
});

export type FinaleDraft = z.infer<typeof FinaleSchema>;
