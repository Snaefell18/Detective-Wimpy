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

/**
 * Schritt 3b: die Verhandlung statt eines Finalfalls.
 *
 * Der Saal lebt von der Mischung: ein paar Stücke tragen, die anderen sehen
 * nur so aus. Was trägt, steht später im Siegel - der Browser bekommt nur
 * Name, Herkunft und Text zu sehen.
 */
export const VerhandlungSchema = z.object({
  frage: z.string().describe("Die Frage, um die es in der Verhandlung geht"),
  erzaehlerText: z
    .string()
    .describe("Erzählertext vor der Verhandlung, vier bis sechs kurze Zeilen"),
  epilogText: z.string().describe("Erzählertext nach der Verhandlung, drei bis fünf Zeilen"),
  anklage: z
    .string()
    .describe(
      "Womit der Richter die Verhandlung eröffnet: zwei bis vier Sätze, gesprochen, ohne Anrede des Spielers",
    ),
  urteilSchuldig: z
    .string()
    .describe("Das Urteil, wenn die Beweisführung trägt: drei bis fünf Sätze"),
  urteilFrei: z
    .string()
    .describe(
      "Was der Richter sagt, wenn die Beweisführung scheitert: drei bis fünf Sätze, bitter statt versöhnlich",
    ),
  beweise: z
    .array(
      z.object({
        name: z.string().describe("Kurzer Name des Beweisstücks, höchstens 6 Wörter"),
        herkunft: z
          .string()
          .describe("Woher es stammt, z.B. „Kapitel 2 - Die Nacht am Hafen“"),
        text: z
          .string()
          .describe("Was Wimpy damit zeigen will: zwei bis drei Sätze, ohne Wertung"),
        traegt: z
          .boolean()
          .describe("Trägt dieses Stück vor Gericht wirklich? Steht nie im Browser."),
        reaktion: z
          .string()
          .describe(
            "Was im Saal geschieht, wenn Wimpy es vorlegt: drei bis fünf Sätze. Trägt es, gerät der Angeklagte ins Rutschen; trägt es nicht, dreht er es gegen Wimpy.",
          ),
      }),
    )
    .describe(
      "Sechs bis acht Beweisstücke, davon drei oder vier tragend, der Rest naheliegende Fehlschlüsse. Jedes Kapitel der Saga kommt mindestens einmal vor.",
    ),
});

export type VerhandlungDraft = z.infer<typeof VerhandlungSchema>;
