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
  verwandlungSpruch: z
    .string()
    .describe(
      "Nur wenn ein Tier besessen ist: die ersten Worte der Gestalt, sobald sie aus ihrem Wirt gebrochen ist. Zwei bis vier Sätze wörtliche Rede in ihrer eigenen Stimme. Ohne Besessenheit leer lassen.",
    ),
});

export type FinaleDraft = z.infer<typeof FinaleSchema>;

/**
 * Schritt 3b: die Verhandlung statt eines Finalfalls.
 *
 * Der Saal lebt von der Mischung: ein paar Stücke tragen, die anderen sehen
 * nur so aus. Was trägt, steht später im Siegel - der Browser bekommt nur
 * Name, Herkunft und Text zu sehen.
 */
/*
 * Die Verhandlung entsteht in ZWEI Aufrufen, nicht in einem.
 *
 * Der Grund ist die Uhr: Acht Beweisstücke mit Reaktionen und dazu ein
 * Dutzend Sprechtexte sind mehrere tausend Wörter am Stück. Das dauerte
 * regelmäßig länger, als eine Serverfunktion laufen darf - und weil das
 * Finale ganz am Ende steht, war dann alles davor bezahlt und verloren.
 *
 * Deshalb: erst der Saal (was gesprochen wird), dann die Beweise. Jeder
 * Aufruf für sich ist gut halb so groß und läuft bequem durch.
 */
export const VerhandlungSaalSchema = z.object({
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
  anklageRichtig: z
    .string()
    .describe(
      "Was der Richter sagt, wenn Wimpy den Richtigen anklagt: zwei bis drei Sätze. Der Saal wird still, die Verhandlung beginnt.",
    ),
  anklageFalsch: z
    .string()
    .describe(
      "Was der Richter sagt, wenn Wimpy den Falschen anklagt: zwei bis drei Sätze, freundlich, aber ohne Zweifel. Verrät nicht, wer es stattdessen war.",
    ),
  urteilSchuldig: z
    .string()
    .describe("Das Urteil, wenn die Beweisführung trägt: drei bis fünf Sätze"),
  strafeWort: z
    .string()
    .describe(
      "Das Strafmaß in wenigen Worten, z.B. „Vier Tage Schrankhaft“ oder „Ein Sommer als Laternenwart“",
    ),
  strafeAuflage: z
    .string()
    .describe(
      "Die Wiedergutmachung in ein bis zwei Sätzen - sie hängt am Fall und macht die Sache aus der Welt",
    ),
  strafeFreiWort: z
    .string()
    .describe(
      "Strafmaß, falls auch ein misslungenes Verfahren jemanden verurteilt (nur bei „kein Täter“). Sonst leer lassen.",
    ),
  strafeFreiAuflage: z
    .string()
    .describe("Die zugehörige Auflage. Sonst leer lassen."),
  urteilFrei: z
    .string()
    .describe(
      "Was der Richter sagt, wenn die Beweisführung scheitert: drei bis fünf Sätze, bitter statt versöhnlich. Wird dabei jemand verurteilt, nennt der letzte Satz die Tage Schrankhaft.",
    ),
  verwandlungSpruch: z
    .string()
    .describe(
      "Nur wenn ein Tier besessen ist: die ersten Worte der Gestalt, sobald sie aus ihrem Wirt gebrochen ist. Zwei bis vier Sätze wörtliche Rede in ihrer eigenen Stimme. Ohne Besessenheit leer lassen.",
    ),
});

/** Der zweite Aufruf: nur noch die Beweisstücke. */
export const BeweiseSchema = z.object({
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
            "Was im Saal geschieht, wenn Wimpy es vorlegt: drei bis vier Sätze. Trägt es, gerät der Angeklagte ins Rutschen; trägt es nicht, dreht er es gegen Wimpy.",
          ),
      }),
    )
    .describe(
      "Sechs Beweisstücke, davon drei tragend, der Rest naheliegende Fehlschlüsse. Jedes Kapitel der Saga kommt mindestens einmal vor.",
    ),
});

export type VerhandlungSaalDraft = z.infer<typeof VerhandlungSaalSchema>;
export type BeweiseDraft = z.infer<typeof BeweiseSchema>;
/** Beides zusammen - so, wie der Bogen es am Ende braucht. */
export type VerhandlungDraft = VerhandlungSaalDraft & BeweiseDraft;

/**
 * Ein Zug in der Anhörung: was der Angeklagte sagt, was Öhö sagt, und was
 * der Zug im Saal bewegt hat.
 *
 * Beide Stimmen in einer Antwort - siehe lib/anhoerungPrompt.ts. Die Zahlen
 * werden serverseitig eingeklammert (lib/anhoerung.ts), bevor sie zu
 * Spielwerten werden.
 */
export const AnhoerungSchema = z.object({
  angeklagter: z
    .string()
    .describe("1-3 Sätze wörtliche Rede des Angeklagten, oder leer, wenn er schweigt"),
  richter: z
    .string()
    .describe("1-3 Sätze des Vorsitzes - Nachfrage, Einordnung oder Zurückweisung, oder leer"),
  ueberzeugungPlus: z
    .number()
    .describe("Wie viel weiter das Gericht durch diesen Zug ist: -15 bis 45"),
  geduldMinus: z
    .number()
    .describe("Wie viel Geduld dieser Zug gekostet hat: 0, 1 oder 2"),
  gestaendnis: z
    .boolean()
    .describe("true nur, wenn der Angeklagte in diesem Zug wirklich gesteht"),
});

export type AnhoerungDraft = z.infer<typeof AnhoerungSchema>;
