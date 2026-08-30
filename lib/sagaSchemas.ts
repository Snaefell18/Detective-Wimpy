import * as z from "zod/v4";
import type { Character } from "./types";

/**
 * Der "Bogen" einer Saga: alles, was über die einzelnen Fälle hinausgeht.
 * Er entsteht in einem eigenen, kleinen Aufruf - die Fälle der Kapitel werden
 * danach einzeln über /api/case gebaut.
 */
export function makeBogenSchema(besetzung: Character[], kapitelAnzahl: number) {
  const verdaechtige = besetzung.filter((c) => !c.istDetektiv);
  const charakterId = z
    .string()
    .describe(
      `Id eines Charakters. Genau einer dieser Werte: ${verdaechtige
        .map((c) => c.id)
        .join(", ")}`,
    );

  return z.object({
    name: z.string().describe("Titel der Saga, höchstens 5 Wörter"),
    thema: z
      .string()
      .describe("Das Überthema in ein bis zwei Sätzen, wie es am Ende dasteht"),
    klappentext: z
      .string()
      .describe("Zwei bis drei Sätze für die Auswahlliste, ohne den Drahtzieher zu verraten"),
    auftaktText: z
      .string()
      .describe(
        "Erzählertext vor dem ersten Kapitel: vier bis sechs kurze Zeilen, die den Bogen anteasern",
      ),
    wahrheit: z
      .string()
      .describe("Was wirklich hinter allem steckt. Sieht nur der Server."),
    drahtzieherMotiv: z.string().describe("Warum der Drahtzieher das alles tut"),
    kapitel: z
      .array(
        z.object({
          name: z.string().describe("Kapitelname, höchstens 5 Wörter"),
          teaser: z.string().describe("Ein Satz für die Übersicht"),
          erzaehlerText: z
            .string()
            .describe("Erzählertext vor diesem Kapitel: drei bis fünf kurze Zeilen"),
          auftrag: z
            .string()
            .describe("Worum es im Fall dieses Kapitels geht - Vorgabe für die Fallerzeugung"),
          enthuellung: z
            .string()
            .describe("Was dieses Kapitel über den großen Bogen preisgibt"),
          taeterId: charakterId.describe(
            "Wer den Fall dieses Kapitels begangen hat - darf ein Handlanger sein",
          ),
        }),
      )
      .describe(`Genau ${kapitelAnzahl} Kapitel`),
    finale: z.object({
      frage: z.string().describe("Die Frage, um die es im Finale geht"),
      erzaehlerText: z.string().describe("Erzählertext vor dem Finale, vier bis sechs Zeilen"),
      epilogText: z.string().describe("Erzählertext nach dem gelösten Finale, drei bis fünf Zeilen"),
      auftrag: z.string().describe("Worum es im Finalfall geht"),
    }),
  });
}

export type BogenDraft = z.infer<ReturnType<typeof makeBogenSchema>>;
